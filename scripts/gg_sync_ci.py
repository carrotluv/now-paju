# -*- coding: utf-8 -*-
"""
지금 파주 — 경기도교통정보센터 소통정보 수집 (GitHub Actions용)

  국가교통정보센터(ITS)는 해외 IP를 막아 깃허브·클라우드플레어에서 닿지 않는다(실측 timeout).
  경기도는 깃허브에서 정상 접속되므로(실측 0.8초) 도로 소통은 여기서 받는다.
  CCTV는 ITS에만 있어 이 PC가 하루 1회만 갱신한다 — 그 목록은 이전 its.json에서 그대로 물려받는다.

  사용: python scripts/gg_sync_ci.py <이전 its.json 경로|없으면 -> out/its.json
"""
import io, sys, os, json, time, datetime, urllib.request, ssl

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

API = 'https://openapigits.gg.go.kr/api/rest/getRoadTrafficInfoList'
UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36')
NL = chr(10)


def fetch_xml(url, timeout=120):
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'application/xml'})
    with urllib.request.urlopen(req, timeout=timeout, context=ctx) as r:
        return r.read().decode('utf-8', 'replace')


def tag(chunk, name):
    a = chunk.find('<' + name + '>')
    if a < 0:
        return None
    a += len(name) + 2
    b = chunk.find('</' + name + '>', a)
    return chunk[a:b] if b > 0 else None


def collect(key, wanted, roadname):
    """전체 소통정보에서 우리 지도에 있는 링크만 추린다 (전체 11만건 중 약 4천건).
       도로 이름은 경기도 routeNm 대신 우리 지도(OSM)의 이름을 쓴다 —
       경기도는 링크의 83%에 노선명이 없어 통일로 같은 주요 도로가 빠지기 때문."""
    xml = fetch_xml(f'{API}?serviceKey={key}')
    links, by_road, latest = {}, {}, None
    for chunk in xml.split('<itemList>')[1:]:
        lid = tag(chunk, 'linkId')
        spd = tag(chunk, 'spd')
        if not lid or spd is None:
            continue
        try:
            sp = float(spd)
        except ValueError:
            continue
        if not 0 <= sp <= 200:
            continue
        if wanted and lid not in wanted:
            continue                                   # 파주 지도에 없는 링크는 도로 평균에도 넣지 않는다
        nm = (roadname.get(lid) or '').strip()
        if nm:
            by_road.setdefault(nm, []).append(sp)
        links[lid] = round(sp)
        cd = tag(chunk, 'collDate')
        if cd and (not latest or cd > latest):
            latest = cd
    roads = []
    for road, arr in by_road.items():
        avg = round(sum(arr) / len(arr))
        roads.append({'road': road, 'speed': avg, 'links': len(arr),
                      'level': '원활' if avg >= 60 else ('서행' if avg >= 35 else '정체')})
    roads.sort(key=lambda x: -x['links'])
    kst = datetime.timezone(datetime.timedelta(hours=9))
    asof = (latest[:19].replace(' ', 'T') + '+09:00') if latest else \
           datetime.datetime.now(kst).isoformat(timespec='seconds')
    return asof, links, roads


def main():
    key = (os.environ.get('GITS_KEY') or '').strip()
    prev_path = sys.argv[1] if len(sys.argv) > 1 else '-'
    out = sys.argv[2] if len(sys.argv) > 2 else 'out/its.json'
    os.makedirs(os.path.dirname(out) or '.', exist_ok=True)
    diag = os.path.join(os.path.dirname(out) or '.', 'diag.txt')
    kst = datetime.timezone(datetime.timedelta(hours=9))
    stamp = datetime.datetime.now(kst).isoformat(timespec='seconds')

    prev = {}
    if prev_path != '-' and os.path.isfile(prev_path):
        try:
            prev = json.load(open(prev_path, encoding='utf-8'))
        except Exception:
            prev = {}
    cams = prev.get('cams') or []                       # CCTV 목록은 이 PC가 하루 1회 갱신한 것을 물려받는다

    # 우리 지도에 실제로 쓰이는 링크만 남긴다 — 응답 11만건을 4천건대로 줄여 용량을 지킨다
    wanted, roadname = set(), {}
    rp = os.path.join('public', 'paju_roads.json')
    if os.path.isfile(rp):
        try:
            R = json.load(open(rp, encoding='utf-8'))
            wanted = set(R.get('map', {}).keys())
            roads_ = R.get('roads', [])
            for lid, ri in R.get('map', {}).items():       # 링크ID → 우리 지도의 도로명
                if 0 <= ri < len(roads_):
                    roadname[lid] = roads_[ri].get('n') or ''
        except Exception:
            wanted, roadname = set(), {}

    if not key:
        with open(diag, 'w', encoding='utf-8') as f:
            f.write(f'시각: {stamp}{NL}사유: GITS_KEY 시크릿이 저장소에 없음{NL}')
        print('GITS_KEY 시크릿이 없습니다')
        return
    t0 = time.time()
    try:
        asof, links, roads = collect(key, wanted, roadname)
    except Exception as e:
        with open(diag, 'w', encoding='utf-8') as f:
            f.write(f'시각: {stamp}{NL}사유: 수집 실패 {type(e).__name__} {str(e)[:200]}{NL}')
        print(f'수집 실패 {type(e).__name__} {str(e)[:200]}')
        return

    data = {'asof': asof, 'cams': cams, 'roads': roads[:24],
            'roadAvg': {r['road']: r['speed'] for r in roads}, 'links': links, 'src': 'gg'}
    with open(out, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    size = os.path.getsize(out) // 1024
    print(f'ok links={len(links)} roads={len(roads)} cams={len(cams)}(이월) '
          f'asof={asof} {size}KB {int(time.time() - t0)}초')


if __name__ == '__main__':
    main()
