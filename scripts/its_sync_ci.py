# -*- coding: utf-8 -*-
"""
지금 파주 — ITS(국가교통정보센터) 데이터 수집 (GitHub Actions용)
  이 PC의 its_sync.py와 같은 일을 하되, 깃 작업은 워크플로가 맡고 여기서는 its.json만 만든다.
  인증키는 환경변수 ITS_KEY(저장소 Secret)로 받는다.

  사용: python scripts/its_sync_ci.py out/its.json
"""
import io, sys, os, json, datetime, urllib.request, urllib.error, ssl

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

BASE = 'https://openapi.its.go.kr:9443'
BBOX = 'minX=126.66&maxX=126.99&minY=37.68&maxY=38.00'
UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36')


def get(url, timeout=45):
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE                    # 상류 인증서 체인이 불완전해 검증은 끈다
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout, context=ctx) as r:
        return json.loads(r.read().decode('utf-8'))


def fetch(key):
    # type=all 은 고속도로만 반환하는 특성이 있어 ex(고속도로)+its(국도)를 각각 불러 합친다
    raw = []
    for t in ('ex', 'its'):
        d = get(f'{BASE}/cctvInfo?apiKey={key}&type={t}&cctvType=1&{BBOX}&getType=json')
        d = d['response']['data']
        raw += [d] if isinstance(d, dict) else d
    cams, seen = [], set()
    for c in raw:
        pos = (round(float(c['coordy']), 5), round(float(c['coordx']), 5))
        if pos in seen:
            continue
        seen.add(pos)
        url = (c.get('cctvurl') or '').replace('http://', 'https://', 1)
        if not url:
            continue
        cams.append({'n': (c.get('cctvname') or '').strip(),
                     'lat': round(float(c['coordy']), 6), 'lng': round(float(c['coordx']), 6),
                     'url': url, 'fmt': c.get('cctvformat') or 'HLS'})

    items = get(f'{BASE}/trafficInfo?apiKey={key}&type=all&drcType=all&{BBOX}&getType=json')['body']['items']
    by_road, by_link = {}, {}
    for it in items:
        road = (it.get('roadName') or '').strip() or '기타'
        try:
            sp = float(it.get('speed'))
        except (TypeError, ValueError):
            continue
        lid = str(it.get('linkId') or '').strip()
        if lid:
            by_link[lid] = round(sp)                   # 링크별 속도 — 지도 구간 색칠에 사용
        by_road.setdefault(road, []).append(sp)
    roads = []
    for road, arr in by_road.items():
        avg = round(sum(arr) / len(arr))
        roads.append({'road': road, 'speed': avg, 'links': len(arr),
                      'level': '원활' if avg >= 60 else ('서행' if avg >= 35 else '정체')})
    roads.sort(key=lambda x: -x['links'])

    kst = datetime.timezone(datetime.timedelta(hours=9))
    return {'asof': datetime.datetime.now(kst).isoformat(timespec='seconds'),
            'cams': cams, 'roads': roads[:24],
            'roadAvg': {r['road']: r['speed'] for r in roads},
            'links': by_link}


def main():
    key = (os.environ.get('ITS_KEY') or '').strip()
    if not key:
        print('ITS_KEY 시크릿이 없습니다 — 저장소 Settings > Secrets에 추가하세요')
        sys.exit(1)
    out = sys.argv[1] if len(sys.argv) > 1 else 'its.json'
    os.makedirs(os.path.dirname(out) or '.', exist_ok=True)
    try:
        data = fetch(key)
    except Exception as e:
        print(f'수집 실패: {type(e).__name__} {str(e)[:200]}')
        print('※ 상류(국가교통정보센터)가 해외 IP를 막고 있으면 이 단계에서 실패합니다.')
        sys.exit(1)
    with open(out, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    print(f"ok cams={len(data['cams'])} roads={len(data['roads'])} links={len(data['links'])} asof={data['asof']}")


if __name__ == '__main__':
    main()
