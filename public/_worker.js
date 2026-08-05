// 지금 파주 (NOW PAJU) — Pages 고급 모드 워커
// /api/* 는 경기도 실시간 방문소비 API 프록시, 그 외는 정적 자산 서빙.
// 상세는 interestRegionId 기반 — 목록에서 ID를 동적으로 해석하므로 지점 개편에 안전.

const UPSTREAM = 'https://gg.whitescan.com';
const LIST_PATH = '/api/itrst-rgn?page=0&size=300&interestRegionType=0';
const MARKERS_PATH = '/api/itrst-rgn/markers?interestRegionType=0&labels=%EC%97%AC%EC%9C%A0&labels=%EB%B3%B4%ED%86%B5&labels=%EC%95%BD%EA%B0%84+%ED%98%BC%EC%9E%A1&labels=%ED%98%BC%EC%9E%A1&labels=%EB%A7%A4%EC%9A%B0+%ED%98%BC%EC%9E%A1';

async function upstreamJson(path, ttl, ctx) {
  const cache = caches.default;
  const cacheKey = new Request('https://cache.now-paju.internal' + encodeURI(path));
  const hit = await cache.match(cacheKey);
  if (hit) return hit.json();
  const up = await fetch(UPSTREAM + path, { headers: { accept: 'application/json' } });
  if (!up.ok) throw new Error('upstream ' + up.status);
  const body = await up.text();
  const store = new Response(body, { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=' + ttl } });
  ctx.waitUntil(cache.put(cacheKey, store));
  return JSON.parse(body);
}

function json(data, status = 200, ttl = 0) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': ttl ? 'public, max-age=' + ttl : 'no-store'
    }
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      if (url.pathname === '/api/summary') {
        const [listRaw, markers] = await Promise.all([
          upstreamJson(LIST_PATH, 180, ctx),
          upstreamJson(MARKERS_PATH, 180, ctx)
        ]);
        const items = listRaw.content || listRaw;
        const spots = items
          .filter(x => (x.sggName || '').includes('파주'))
          .map(p => {
            const m = markers.find(x => x.interestRegionName === p.interestRegionName);
            return {
              id: p.interestRegionId, name: p.interestRegionName,
              category: p.category, label: p.label,
              lat: m ? m.centerCoords.lat : null, lng: m ? m.centerCoords.lng : null
            };
          });
        return json({ asof: new Date().toISOString(), spots }, 200, 120);
      }

      const mSpot = url.pathname.match(/^\/api\/spot\/(\d+)$/);
      if (mSpot) {
        const id = mSpot[1];
        const [trendRaw, sex, age] = await Promise.all([
          upstreamJson(`/api/itrst-rgn-dades/${id}/24hours-1hour-current`, 600, ctx),
          upstreamJson(`/api/gid-ppltn/${id}/sex-ratio`, 1800, ctx),
          upstreamJson(`/api/gid-ppltn/${id}/age-ratio`, 1800, ctx)
        ]);
        const trend = (Array.isArray(trendRaw) ? trendRaw : []).map(x => ({
          d: x.createdDate, h: +x.createdTime.slice(0, 2), sum: Math.round(x.sum),
          label: x.dadeLabel, avgSum: Math.round(x.equalHourAvgSum),
          vsAvg: x.equalHourAvgContrastIncreaseRatio
        }));
        return json({ trend, sex, age }, 200, 300);
      }

      return json({ error: 'not found' }, 404);
    } catch (e) {
      return json({ error: 'upstream unavailable', detail: String(e).slice(0, 120) }, 503);
    }
  }
};
