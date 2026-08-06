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

// ── ITS(국가교통정보센터) 데이터 — Cloudflare에서 ITS(9443)로 직접 못 나가므로(클라우드 IP 차단),
//    사무실 PC의 its_sync.py 가 5분마다 data 브랜치에 올린 its.json 을 GitHub API로 읽는다.
//    GH_TOKEN(읽기 전용 PAT)은 Cloudflare Secret — 응답에 절대 싣지 않는다.
const GH_ITS = 'https://api.github.com/repos/carrotluv/now-paju/contents/its.json?ref=data';

async function ghItsData(env, ctx) {
  const cache = caches.default;
  const ck = new Request('https://cache.now-paju.internal/gh-its');
  const hit = await cache.match(ck);
  if (hit) return hit.json();
  const r = await fetch(GH_ITS, {
    headers: {
      accept: 'application/vnd.github.raw+json',
      authorization: 'Bearer ' + env.GH_TOKEN,
      'user-agent': 'now-paju-worker'
    }
  });
  if (!r.ok) throw new Error('gh ' + r.status);
  const body = await r.text();
  ctx.waitUntil(cache.put(ck, new Response(body, { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=180' } })));
  return JSON.parse(body);
}

// 브이월드 배경지도 타일 프록시 — 인증키(VWORLD_KEY Secret)는 서버에만 두고 브라우저엔 노출하지 않는다.
async function vworldTile(url, env, ctx) {
  const m = url.pathname.match(/^\/tiles\/(\d+)\/(\d+)\/(\d+)\.png$/);
  if (!m) return new Response('bad tile', { status: 400 });
  if (!env.VWORLD_KEY) return new Response('no key', { status: 503 });
  const cache = caches.default;
  const ck = new Request(url.toString());
  const hit = await cache.match(ck);
  if (hit) return hit;
  const up = await fetch(`https://api.vworld.kr/req/wmts/1.0.0/${env.VWORLD_KEY}/Base/${m[1]}/${m[2]}/${m[3]}.png`,
    { headers: { referer: 'https://now-paju.pajulab.workers.dev/' } });
  if (!up.ok || !(up.headers.get('content-type') || '').includes('image')) {
    return new Response('tile unavailable', { status: 502 });
  }
  const res = new Response(up.body, {
    headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=604800' }   // 7일 캐시
  });
  ctx.waitUntil(cache.put(ck, res.clone()));
  return res;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/tiles/')) return vworldTile(url, env, ctx);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      if (url.pathname === '/api/cctv' || url.pathname === '/api/traffic') {
        if (!env.GH_TOKEN) return json({ error: 'no-key', message: '데이터 채널(GH_TOKEN)이 아직 연결되지 않았습니다' }, 503);
        const d = await ghItsData(env, ctx);
        if (url.pathname === '/api/cctv') return json({ asof: d.asof, count: (d.cams || []).length, cams: d.cams || [] }, 200, 180);
        return json({ asof: d.asof, roads: d.roads || [], roadAvg: d.roadAvg || {}, links: d.links || {} }, 200, 180);
      }

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
