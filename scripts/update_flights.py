#!/usr/bin/env python3
"""Daily flight-price watch for 旅行管家.

Ranks destinations the same way the app does, looks up real round-trip fares for the
top few on Google Flights through SerpApi, and appends them to travel-prices.js.

    SERPAPI_KEY=... python3 scripts/update_flights.py

Standard library only. Settings live in travel-config.json (origin city code, nights, how many routes).
"""
import json
import math
import os
import sys
import urllib.parse
import urllib.request
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PRICES = ROOT / 'travel-prices.js'
HEAD = 'window.TRAVEL_PRICES = '
# Google Flights wants airports; a few cities have more than one.
AIRPORTS = {'SHA': 'PVG,SHA', 'BJS': 'PEK,PKX', 'CTU': 'CTU,TFU', 'CKG': 'CKG', 'SIA': 'XIY', 'HAK': 'HAK', 'TXN': 'TXN'}


def load_js(path, head):
    s = path.read_text(encoding='utf-8')
    body = s[s.index(head) + len(head):].strip().rstrip(';')
    return json.loads(body) if body != 'null' else None


def haversine(a, b):
    r = math.pi / 180
    h = (math.sin((b['lat'] - a['lat']) * r / 2) ** 2
         + math.cos(a['lat'] * r) * math.cos(b['lat'] * r) * math.sin((b['lng'] - a['lng']) * r / 2) ** 2)
    return 12742 * math.asin(math.sqrt(h))


def busy_windows(year, festivals):
    w = [(date(year, 4, 3), date(year, 4, 6)), (date(year, 4, 28), date(year, 5, 6)), (date(year, 9, 28), date(year, 10, 8))]
    for d in festivals:
        f = date.fromisoformat(d)
        w.append((f - timedelta(days=12), f + timedelta(days=14)))
    return w


def plan_dates(today, nights, festivals):
    """Same rule as the app: first clear Tuesday about 90 days out."""
    def next_tue(d):
        return d + timedelta(days=(1 - d.weekday()) % 7)

    start = next_tue(today + timedelta(days=90))
    for _ in range(8):
        end = start + timedelta(days=nights)
        wins = sum((busy_windows(y, festivals) for y in (start.year - 1, start.year, start.year + 1)), [])
        hit = next(((a, b) for a, b in wins if start <= b and end >= a), None)
        if not hit:
            break
        start = next_tue(hit[1] + timedelta(days=1))
    return start, start + timedelta(days=nights)


def comfort(t):
    if 20 <= t <= 28: return 5
    if 17 <= t <= 19 or 29 <= t <= 30: return 4
    if 14 <= t <= 16 or t == 31: return 3
    if 10 <= t <= 13 or t == 32: return 2
    return 1


def score(d, month):
    s = comfort(d['temp'][month - 1]) + (1 if month in d['bonus'] else 0) - (1 if month in d['rain'] else 0)
    return max(1, min(5, s))


def top_routes(travel, origin, start, nights, n):
    month = start.month
    ranked = []
    for d in travel['dests']:
        km = haversine(origin, d)
        if km < 450:  # high-speed rail distance, no flight to watch
            continue
        peak = month in d['peak']
        flight = round(max(350, km * 0.45) * (1.4 if peak else 1) * 2 / 50) * 50
        hotel = d['hotel'][1] if peak else d['hotel'][0]
        total = flight * 2 + hotel * nights + d['daily'] * (nights + 1)
        sc = score(d, month)
        if sc >= 3:
            ranked.append((sc ** 2.2 / total, d))
    ranked.sort(key=lambda x: -x[0])
    return [d for _, d in ranked[:n]]


def serp(params):
    url = 'https://serpapi.com/search.json?' + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=90) as r:
        return json.loads(r.read())


def cheapest(res):
    best = None
    for f in res.get('best_flights', []) + res.get('other_flights', []):
        if f.get('price') and (best is None or f['price'] < best['price']):
            best = f
    if not best:
        return None
    legs = best['flights']
    return {
        'price': best['price'],
        'airline': legs[0].get('airline', ''),
        'stops': len(legs) - 1,
        'time': legs[0]['departure_airport'].get('time', '')[-5:],
        'from': legs[0]['departure_airport'].get('id', ''),
    }


def main():
    key = os.environ.get('SERPAPI_KEY')
    if not key:
        print('SERPAPI_KEY is not set', file=sys.stderr)
        return 1
    cfg = json.loads((ROOT / 'travel-config.json').read_text(encoding='utf-8'))
    travel = load_js(ROOT / 'travel.js', 'window.TRAVEL = ')
    origin = next(o for o in travel['origins'] if o['code'] == cfg['origin'])
    today = date.today()
    start, end = plan_dates(today, cfg['nights'], travel['springFestival'])
    routes = top_routes(travel, origin, start, cfg['nights'], cfg['routes'])

    # Don't burn through the free monthly quota.
    acct = json.loads(urllib.request.urlopen('https://serpapi.com/account.json?api_key=' + key, timeout=30).read())
    left = acct.get('total_searches_left', acct.get('plan_searches_left', 0))
    if left < len(routes):
        print(f'only {left} searches left this month; skipping', file=sys.stderr)
        return 0

    data = (PRICES.exists() and load_js(PRICES, HEAD)) or {'routes': {}}
    data.setdefault('routes', {})
    for d in routes:
        res = serp({
            'engine': 'google_flights', 'departure_id': AIRPORTS.get(origin['code'], origin['code']),
            'arrival_id': AIRPORTS.get(d['code'], d['code']), 'outbound_date': start.isoformat(),
            'return_date': end.isoformat(), 'type': 1, 'currency': 'CNY', 'hl': 'zh-cn', 'adults': 1, 'api_key': key,
        })
        if 'error' in res:
            print(f"{d['name']}: {res['error']}", file=sys.stderr)
            continue
        c = cheapest(res)
        if not c:
            print(f"{d['name']}: no flights found", file=sys.stderr)
            continue
        k = f"{origin['code']}-{d['code']}"
        r = data['routes'].get(k, {})
        hist = [h for h in r.get('history', []) if h.get('dep') == start.isoformat() and h['d'] != today.isoformat()]
        hist.append({'d': today.isoformat(), 'p': c['price'], 'dep': start.isoformat()})
        data['routes'][k] = dict(c, depart=start.isoformat(), ret=end.isoformat(), history=hist[-60:])
        print(f"{k} {d['name']}: ¥{c['price']} {c['airline']} {c['from']} {c['time']} stops={c['stops']}")
    data['updated'] = today.isoformat()
    data['origin'] = origin['code']
    PRICES.write_text('// 机票实时低价（Google Flights，经 SerpApi 每天自动更新）\n' + HEAD
                      + json.dumps(data, ensure_ascii=False, indent=1) + ';\n', encoding='utf-8')
    return 0


if __name__ == '__main__':
    sys.exit(main())
