#!/usr/bin/env python3
"""Pick 10 headlines for 睿睿播报 from Chinese-language RSS feeds and write them to news.js:
2 中国大事, 2 美国大事, 1 中美关系, 2 AI大事, 3 中国民生 (topped up from the rest if a group is short).

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
    ('中新网', 'https://www.chinanews.com.cn/rss/china.xml'),
    ('中新网', 'https://www.chinanews.com.cn/rss/society.xml'),
    ('中新网', 'https://www.chinanews.com.cn/rss/finance.xml'),
    ('IT之家', 'https://www.ithome.com/rss/'),
    ('量子位', 'https://www.qbitai.com/feed'),
]

CN = ['中国', '国务院', '北京', '习近平', '全国', '央行', '人民币', '统计局', '发改委', '国家', '两岸', '台湾', '香港']
US = ['美国', '特朗普', '白宫', '美联储', '国会', '华盛顿', '纽约', '美股', '美军', '五角大楼', '共和党', '民主党']
BIG = ['经济', '关税', '贸易', '出口', 'GDP', 'PMI', '政策', '会议', '全会', '外交', '会谈', '选举', '总统', '制裁',
       '利率', '降息', '加息', '通胀', '就业', '股市', '芯片', '军', '改革', '法案', '峰会', '发布', '政府']
AI = ['AI', '人工智能', '大模型', 'OpenAI', 'ChatGPT', 'GPT', 'DeepSeek', 'Claude', 'Anthropic', 'Gemini', '智能体',
      'Agent', '英伟达', '算力', '机器人', '具身', '豆包', '通义', 'Kimi', '文心', '谷歌']
LIFE = ['医保', '社保', '养老', '退休', '医院', '医疗', '看病', '药', '教育', '学校', '高考', '就业', '工资', '房价',
        '房租', '住房', '物价', '菜价', '油价', '天气', '降温', '寒潮', '降雨', '降雪', '大风', '台风', '高温', '交通',
        '高铁', '铁路', '春运', '消费者', '食品', '诈骗', '骗', '老人', '老年', '儿童', '补贴', '个税', '公积金', '电费',
        '燃气', '供暖', '快递', '假期', '放假', '旅游', '景区', '居民', '市民', '社区', '养老金', '健康', '疫苗', '流感']
# Party-meeting boilerplate and culture features aren't "大事" for 爸爸妈妈.
SKIP = ['习言道', '考古', '文化', '论坛', '名单揭晓', '受权全文', '纪律审查', '严重违纪', '开除党籍', '一图', '视频', '直播',
        '图集', '早报', '晚报', '日报', '快讯丨']
NEWSROOMS = ['BBC中文', '德国之声', '法广', '中新网']  # tech sites only feed the AI group
# (tag, how many, title must hit one of these, and must also hit one of these (optional), allowed sources)
GROUPS = [
    ('中国大事', 2, CN, BIG, NEWSROOMS),
    ('美国大事', 2, US, None, NEWSROOMS),
    ('中美关系', 1, ['中美', '美中', '中国', '北京'], ['美国', '美方', '华盛顿', '特朗普', '白宫', '美中', '中美'], NEWSROOMS),
    ('AI大事', 2, AI, None, ['量子位', 'IT之家', 'BBC中文', '德国之声', '法广']),
    ('中国民生', 3, LIFE, None, ['中新网']),
]
AI_WORD = re.compile(r'(?<![A-Za-z])AI(?![A-Za-z])')
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
    # Datelines like "中新网11月2日电 据……" / "IT之家 11 月 2 日消息，" / "（记者 张三）" add nothing when read aloud.
    s = re.sub(r'^(中新网|中新社|新华社|人民网|IT之家)[^，。电]{0,20}(电|消息)\s*[，,]?\s*', '', s)
    s = re.sub(r'[（(]记者[^）)]{0,20}[）)]', '', s).strip()
    if limit:
        # Keep whole sentences only, so 睿睿 never stops mid-sentence.
        s = re.sub(r'(\.{3,}|…+)$', '', s).strip()
        cut = s[:limit] if len(s) > limit else s
        if cut and cut[-1] not in '。！？”」）)':
            stop = max(cut.rfind(c) for c in '。！？')
            cut = cut[:stop + 1] if stop >= 20 else cut.rstrip('，、；：,;: ') + '。'
        s = cut
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
        summary = clean(text(el, 'description', 'summary'), 220)
        items.append({
            'title': title,
            'summary': '' if summary.startswith(title[:12]) and len(summary) < len(title) + 6 else summary,
            'link': text(el, 'link') or el.get('{http://www.w3.org/1999/02/22-rdf-syntax-ns#}about', ''),
            'date': parse_date(text(el, 'pubDate', 'date', 'updated', 'published')),
            'source': source,
        })
    return items


def has(t, words):
    return any((AI_WORD.search(t) if w == 'AI' else w in t) for w in words)


def hits(t, words):
    return sum(1 for w in words if (AI_WORD.search(t) if w == 'AI' else w in t))


def main():
    items, seen_titles = [], set()
    for source, url in FEEDS:
        try:
            for i in fetch(source, url):
                if i['title'] not in seen_titles:
                    seen_titles.add(i['title'])
                    items.append(i)
        except Exception as e:  # one broken feed shouldn't stop the others
            print(f'skip {source} {url}: {e}', file=sys.stderr)
    now = datetime.now(timezone.utc)
    items = [i for i in items if not any(w in i['title'] for w in SKIP)]
    fresh = lambda hours: [i for i in items if i['date'] and now - i['date'] < timedelta(hours=hours)]
    seen, sources, picks = set(), [], []

    def take(i, tag):
        seen.add(i['title'])
        sources.append(i['source'])
        picks.append({
            'tag': tag, 'title': i['title'], 'summary': i['summary'], 'link': i['link'], 'source': i['source'],
            'time': i['date'].astimezone().strftime('%-m月%-d日 %H:%M') if i['date'] else '',
        })

    for tag, n, must, also, allowed in GROUPS:
        got = 0
        for pool in (fresh(36), fresh(72), fresh(24 * 7)):  # newest first, widen if the group is short
            cands = [i for i in pool if i['title'] not in seen and i['source'] in allowed and has(i['title'], must)
                     and (also is None or has(i['title'] + i['summary'], also))]
            if tag == '美国大事':  # anything about China goes to 中美关系 instead
                cands = [i for i in cands if not has(i['title'], ['中国', '中美', '美中', '北京'])]
            ranked = sorted(cands, key=lambda i: (
                hits(i['title'], must) * 2 + hits(i['title'] + i['summary'], also or BIG)
                + (1 if i['summary'] else 0)
                - 2 * sources.count(i['source']), i['date']), reverse=True)
            for i in ranked[:n - got]:
                take(i, tag)
                got += 1
            if got >= n:
                break
        print(f'{tag}: {got}/{n}', file=sys.stderr)

    # Always show ten: top up with the newest remaining big headlines.
    extra = sorted((i for i in fresh(48) if i['title'] not in seen and i['source'] in NEWSROOMS),
                   key=lambda i: (hits(i['title'], CN + US + BIG) - 2 * sources.count(i['source']), i['date']), reverse=True)
    for i in extra[:max(0, 10 - len(picks))]:
        take(i, '要闻')
    if len(picks) < 3:
        print('too little news picked; keeping the old news.js', file=sys.stderr)
        return 1
    order = [g[0] for g in GROUPS] + ['要闻']
    picks.sort(key=lambda p: order.index(p['tag']))
    data = {'updated': datetime.now().astimezone().strftime('%Y-%m-%d'),
            'sources': sorted(set(sources), key=sources.index), 'items': picks}
    OUT.write_text('window.NEWS = ' + json.dumps(data, ensure_ascii=False, indent=1) + ';\n', encoding='utf-8')
    for p in picks:
        print(f"[{p['tag']}] {p['title']} ({p['source']} {p['time']})")
    return 0


if __name__ == '__main__':
    sys.exit(main())
