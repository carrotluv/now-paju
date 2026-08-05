// 지금 파주 (NOW PAJU) — Pages 고급 모드 워커
// /api/* 는 경기도 실시간 방문소비 API 프록시, 그 외는 정적 자산 서빙.
// 상세는 interestRegionId 기반 — 목록에서 ID를 동적으로 해석하므로 지점 개편에 안전.

const UPSTREAM = 'https://gg.whitescan.com';
const LIST_PATH = '/api/itrst-rgn?page=0&size=300&interestRegionType=0';
const MARKERS_PATH = '/api/itrst-rgn/markers?interestRegionType=0&labels=%EC%97%AC%EC%9C%A0&labels=%EB%B3%B4%ED%86%B5&labels=%EC%95%BD%EA%B0%84+%ED%98%BC%EC%9E%A1&labels=%ED%98%BC%EC%9E%A1&labels=%EB%A7%A4%EC%9A%B0+%ED%98%BC%EC%9E%A1';

// 상류가 브라우저 요청만 받아들이므로 동일한 요청 지문(헤더 + 세션 쿠키)을 만들어 보낸다.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36';
const UP_HEADERS = {
  'accept': 'application/json, text/plain, */*',
  'accept-language': 'ko-KR,ko;q=0.9,en;q=0.8',
  'user-agent': UA,
  'referer': UPSTREAM + '/',
  'origin': UPSTREAM,
  'sec-fetch-site': 'same-origin',
  'sec-fetch-mode': 'cors',
  'sec-fetch-dest': 'empty',
  'x-requested-with': 'XMLHttpRequest'
};

let sessionCookie = null;
async function ensureCookie(force) {
  if (sessionCookie && !force) return sessionCookie;
  try {
    const r = await fetch(UPSTREAM + '/', {
      headers: {
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'ko-KR,ko;q=0.9,en;q=0.8',
        'user-agent': UA,
        'sec-fetch-site': 'none',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-dest': 'document',
        'upgrade-insecure-requests': '1'
      }
    });
    const list = typeof r.headers.getSetCookie === 'function'
      ? r.headers.getSetCookie()
      : (r.headers.get('set-cookie') ? [r.headers.get('set-cookie')] : []);
    sessionCookie = list.map(c => c.split(';')[0]).filter(Boolean).join('; ') || null;
  } catch (e) { sessionCookie = null; }
  return sessionCookie;
}

async function callUpstream(path, cookie) {
  const headers = Object.assign({}, UP_HEADERS);
  if (cookie) headers.cookie = cookie;
  return fetch(UPSTREAM + path, { headers });
}

async function upstreamJson(path, ttl, ctx) {
  const cache = caches.default;
  const cacheKey = new Request('https://cache.now-paju.internal' + encodeURI(path));
  const hit = await cache.match(cacheKey);
  if (hit) return hit.json();
  let up = await callUpstream(path, await ensureCookie(false));
  if (up.status === 401 || up.status === 403) {
    up = await callUpstream(path, await ensureCookie(true));   // 세션 재발급 후 1회 재시도
  }
  if (!up.ok) {
    const peek = (await up.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 140);
    throw new Error('upstream ' + up.status + ' @' + path.slice(0, 34) + ' cookie=' + (sessionCookie ? 'yes' : 'no') + ' :: ' + peek);
  }
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
      return json({ error: 'upstream unavailable', detail: String(e && e.message || e).slice(0, 300) }, 503);
    }
  }
};
