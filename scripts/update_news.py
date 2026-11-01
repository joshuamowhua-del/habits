#!/usr/bin/env python3
"""Pick 3 headlines for 睿睿播报 (world focus / US-China economy / immigration)
from Chinese-language RSS feeds and write them to news.js next to index.html.

Standard library only, so it can run anywhere (locally or in a scheduled job):
    python3 scripts/update_news.py
"""
import email.utils
import html
import json
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path

FEEDS = [
    ('BBC中文', 'https://feeds.bbci.co.uk/zhongwen/simp/rss.xml'),
    ('德国之声', 'https://rss.dw.com/rdf/rss-chi-all'),
    ('法广', 'https://www.rfi.fr/cn/rss'),
]

US_CN = ['美国', '中国', '中美', '美中', '华盛顿', '北京', '特朗普', '习近平', '白宫']
CATEGORIES = [
    ('世界焦点', ['战争', '冲突', '停火', '峰会', '选举', '总统', '会谈', '制裁', '联合国', '袭击', '外交'] + US_CN),
    ('中美经济', ['经济', '关税', '贸易', '股市', '通胀', '利率', '美联储', '央行', 'GDP', '出口', '进口',
                 '就业', '失业', '房地产', '芯片', '投资', '美元', '人民币', '债务', '降息', '加息']),
    ('移民', ['移民', '签证', '绿卡', '难民', '驱逐', '遣返', '庇护', '入籍', '留学生', 'H-1B', '非法入境', '偷渡', '移民局', 'ICE']),
]
OUT = Path(__file__).resolve().parent.parent / 'news.js'


def text(el, *names):
    for child in el:
        tag = child.tag.rsplit('}', 1)[-1]
        if tag in names and (child.text or '').strip():
            return child.text.strip()
    return ''


def clean(s, limit=None):
    s = html.unescape(re.sub(r'<[^>]+>', '', s or ''))
    s = re.sub(r'\s+', ' ', s).strip()
    if limit and len(s) > limit:
        s = s[:limit].rstrip('，。、；： ') + '…'
    return s


def parse_date(s):
    if not s:
        return None
    try:
        d = email.utils.parsedate_to_datetime(s)
    except (TypeError, ValueError):
        try:
            d = datetime.fromisoformat(s.replace('Z', '+00:00'))
        except ValueError:
            return None
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def fetch(source, url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (habit-app news)'})
    with urllib.request.urlopen(req, timeout=20) as r:
        root = ET.fromstring(r.read())
    items = []
    for el in root.iter():
        if el.tag.rsplit('}', 1)[-1] != 'item':
            continue
        title = clean(text(el, 'title'))
        if not title:
            continue
        items.append({
            'title': title,
            'summary': clean(text(el, 'description', 'summary'), 90),
            'link': text(el, 'link') or el.get('{http://www.w3.org/1999/02/22-rdf-syntax-ns#}about', ''),
            'date': parse_date(text(el, 'pubDate', 'date', 'updated', 'published')),
            'source': source,
        })
    return items


def score(item, words):
    t, s = item['title'], item['summary']
    return sum(3 for w in words if w in t) + sum(1 for w in words if w in s)


def main():
    items = []
    for source, url in FEEDS:
        try:
            items += fetch(source, url)
        except Exception as e:  # one broken feed shouldn't stop the others
            print(f'skip {source}: {e}', file=sys.stderr)
    now = datetime.now(timezone.utc)
    recent = [i for i in items if i['date'] and now - i['date'] < timedelta(hours=48)] or items
    seen, sources, picks = set(), [], []
    for tag, words in CATEGORIES:
        bonus = US_CN if tag != '世界焦点' else []
        title_hit = lambda i: any(w in i['title'] for w in words)
        week = [i for i in items if not i['date'] or now - i['date'] < timedelta(days=7)]
        pool = []
        for group in (recent, week):  # newest first, then widen to the past week
            pool = [i for i in group if i['title'] not in seen and title_hit(i)]
            if not pool:  # nothing in the headlines; accept a strong match in the summary
                pool = [i for i in group if i['title'] not in seen and score(i, words) >= 2]
            if pool:
                break
        ranked = sorted(pool, key=lambda i: (
            score(i, words) + (2 if score(i, bonus) else 0) - 2 * sources.count(i['source']),
            i['date'] or now - timedelta(days=9)), reverse=True)
        if ranked:
            best = ranked[0]
            seen.add(best['title'])
            sources.append(best['source'])
            picks.append({
                'tag': tag, 'title': best['title'], 'summary': best['summary'], 'link': best['link'],
                'source': best['source'],
                'time': best['date'].astimezone().strftime('%-m月%-d日 %H:%M') if best['date'] else '',
            })
    # Always show three: top up with the newest remaining world headline.
    extra = sorted((i for i in recent if i['title'] not in seen), key=lambda i: (
        score(i, CATEGORIES[0][1]) - 2 * sources.count(i['source']), i['date'] or now), reverse=True)
    for best in extra[:max(0, 3 - len(picks))]:
        seen.add(best['title'])
        picks.append({
            'tag': '国际要闻', 'title': best['title'], 'summary': best['summary'], 'link': best['link'],
            'source': best['source'],
            'time': best['date'].astimezone().strftime('%-m月%-d日 %H:%M') if best['date'] else '',
        })
    if not picks:
        print('no news picked; keeping the old news.js', file=sys.stderr)
        return 1
    data = {'updated': datetime.now().astimezone().strftime('%Y-%m-%d'), 'items': picks}
    OUT.write_text('window.NEWS = ' + json.dumps(data, ensure_ascii=False, indent=1) + ';\n', encoding='utf-8')
    for p in picks:
        print(f"[{p['tag']}] {p['title']} ({p['source']} {p['time']})")
    return 0


if __name__ == '__main__':
    sys.exit(main())
