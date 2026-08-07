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

// 방문자 수 — Cloudflare KV(STATS)에 오늘/전체 카운트를 둔다. 바인딩이 없으면 조용히 비활성.
function kstToday() {
  const d = new Date(Date.now() + 9 * 3600 * 1000);          // 한국시간 기준 날짜
  return d.toISOString().slice(0, 10);
}
async function visitStats(env, bump) {
  if (!env.STATS) return null;
  const dayKey = 'd:' + kstToday();
  const [t, d] = await Promise.all([env.STATS.get('total'), env.STATS.get(dayKey)]);
  let total = parseInt(t || '0', 10) || 0;
  let today = parseInt(d || '0', 10) || 0;
  if (bump) {
    total += 1; today += 1;
    await Promise.all([
      env.STATS.put('total', String(total)),
      env.STATS.put(dayKey, String(today), { expirationTtl: 60 * 60 * 24 * 40 })   // 40일 보관
    ]);
  }
  return { today, total, date: kstToday() };
}

// 경기도교통정보센터 소통정보 — 이 PC 중계가 끊겨도 주요 간선은 계속 나오게 하는 예비 경로.
//   국가교통정보센터(ITS)는 워커에서 막히지만(522) 경기도 서버는 직접 닿는다(실측 502ms).
const GG_ROUTES = [
  ['1050000231', '자유로'], ['1030000012', '국도1호선'], ['1050000561', '파주로'],
  ['1050003571', '제2자유로'], ['1010000173', '서울문산고속도로'], ['1010004008', '수도권제2순환선'],
  ['1070000101', '신평화로'], ['1050000566', '광남로']
];
const GG_LEVEL = { '1': '원활', '2': '서행', '3': '정체', '4': '정체' };

async function ggTraffic(env, ctx) {
  if (!env.GITS_KEY) return null;
  const cache = caches.default;
  const ck = new Request('https://cache.now-paju.internal/gg-traffic');
  const hit = await cache.match(ck);
  if (hit) return hit.json();

  const one = async ([rid, nm]) => {
    try {
      const u = 'https://openapigits.gg.go.kr/api/rest/getRoadLinkTrafficInfoList'
        + '?serviceKey=' + encodeURIComponent(env.GITS_KEY) + '&routeId=' + rid;
      const r = await fetch(u, { headers: { accept: 'application/xml' } });
      if (!r.ok) return null;
      const t = await r.text();
      const items = t.split('<itemList>').slice(1);
      const links = {}; let sum = 0, n = 0, last = null;
      for (const it of items) {
        const id = (it.match(/<linkId>(\d+)<\/linkId>/) || [])[1];
        const sp = (it.match(/<spd>(\d+)<\/spd>/) || [])[1];
        if (!id || sp == null) continue;
        const v = +sp;
        if (!(v >= 0 && v <= 200)) continue;
        links[id] = v; sum += v; n++;
        const cd = (it.match(/<collDate>([^<]+)<\/collDate>/) || [])[1];
        if (cd && (!last || cd > last)) last = cd;
      }
      if (!n) return null;
      const avg = Math.round(sum / n);
      const g = (it => it >= 60 ? '1' : (it >= 35 ? '2' : '3'))(avg);
      return { nm, links, avg, level: GG_LEVEL[g], last };
    } catch (e) { return null; }
  };

  const got = (await Promise.all(GG_ROUTES.map(one))).filter(Boolean);
  if (!got.length) return null;
  const links = {}, roadAvg = {}, roads = [];
  let asof = null;
  for (const g of got) {
    Object.assign(links, g.links);
    roadAvg[g.nm] = g.avg;
    roads.push({ road: g.nm, speed: g.avg, links: Object.keys(g.links).length, level: g.level });
    if (g.last && (!asof || g.last > asof)) asof = g.last;
  }
  const out = {
    asof: asof ? asof.slice(0, 16).replace(' ', 'T') + ':00+09:00' : new Date().toISOString(),
    roads: roads.sort((a, b) => a.speed - b.speed), roadAvg, links, src: 'gg'
  };
  const body = JSON.stringify(out);
  ctx.waitUntil(cache.put(ck, new Response(body, {
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=240' } })));
  return out;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/visit' || url.pathname === '/api/stats') {
      const s = await visitStats(env, url.pathname === '/api/visit');
      return json(s || { off: true });
    }
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      if (url.pathname === '/api/cctv' || url.pathname === '/api/traffic') {
        let d = null;
        if (env.GH_TOKEN) { try { d = await ghItsData(env, ctx); } catch (e) { d = null; } }
        if (url.pathname === '/api/cctv') {
          if (!d) return json({ error: 'no-key', message: '데이터 채널(GH_TOKEN)이 아직 연결되지 않았습니다' }, 503);
          return json({ asof: d.asof, count: (d.cams || []).length, cams: d.cams || [] }, 200, 180);
        }
        // 중계본이 없거나 10분 이상 낡으면 경기도 소통정보로 갈아탄다(주요 간선 유지)
        const age = d && d.asof ? (Date.now() - Date.parse(d.asof)) / 60000 : Infinity;
        if (age <= 10) {
          return json({ asof: d.asof, roads: d.roads || [], roadAvg: d.roadAvg || {}, links: d.links || {}, src: 'its' }, 200, 180);
        }
        const g = await ggTraffic(env, ctx);
        if (g) {
          if (d) {                                            // 낡은 중계본은 빈 구간을 메우는 데만 쓴다
            for (const [k, v] of Object.entries(d.links || {})) if (g.links[k] == null) g.links[k] = v;
            for (const [k, v] of Object.entries(d.roadAvg || {})) if (g.roadAvg[k] == null) g.roadAvg[k] = v;
          }
          return json(g, 200, 180);
        }
        if (d) return json({ asof: d.asof, roads: d.roads || [], roadAvg: d.roadAvg || {}, links: d.links || {}, src: 'its-stale' }, 200, 180);
        return json({ error: 'no-key', message: '도로 소통 데이터 경로가 아직 연결되지 않았습니다' }, 503);
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

      if (url.pathname === '/api/weather') {                 // 지점별 날씨 — 좌표 기반(Open-Meteo, 키 불필요)
        const pts = (url.searchParams.get('pts') || '').split(';').filter(Boolean)
          .map(t => t.split(',').map(Number)).filter(a => a.length === 2 && a.every(n => isFinite(n)));
        if (!pts.length) return json({ error: 'no-points' }, 400);
        const lat = pts.map(a => a[0].toFixed(4)).join(',');
        const lng = pts.map(a => a[1].toFixed(4)).join(',');
        const asArr = v => Array.isArray(v) ? v : [v];
        const grab = async (base, q, ttl) => {
          const u = `${base}?latitude=${lat}&longitude=${lng}&${q}&timezone=Asia%2FSeoul`;
          const cache = caches.default;
          const key = new Request('https://cache.now-paju.internal/om' + encodeURIComponent(u));
          const hit = await cache.match(key);
          if (hit) return hit.json();
          const r = await fetch(u, { headers: { 'accept': 'application/json' } });
          if (!r.ok) throw new Error('open-meteo ' + r.status);
          const j = await r.json();
          ctx.waitUntil(cache.put(key, new Response(JSON.stringify(j), {
            headers: { 'content-type': 'application/json', 'cache-control': 'max-age=' + ttl } })));
          return j;
        };
        const [wRaw, aRaw] = await Promise.all([
          grab('https://api.open-meteo.com/v1/forecast',
               'current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m'
               + '&daily=temperature_2m_max,temperature_2m_min&forecast_days=1', 600),
          grab('https://air-quality-api.open-meteo.com/v1/air-quality', 'current=pm10,pm2_5', 1800)
            .catch(() => null)
        ]);
        const W = asArr(wRaw), A = aRaw ? asArr(aRaw) : [];
        const spots = pts.map((_, i) => {
          const c = W[i] && W[i].current, dd = W[i] && W[i].daily;
          const a = A[i] && A[i].current;
          return {
            w: c ? { code: c.weather_code, t: Math.round(c.temperature_2m),
                     feel: Math.round(c.apparent_temperature), hum: Math.round(c.relative_humidity_2m),
                     wind: c.wind_speed_10m,
                     lo: dd ? Math.round(dd.temperature_2m_min[0]) : null,
                     hi: dd ? Math.round(dd.temperature_2m_max[0]) : null } : null,
            air: a ? { pm10: Math.round(a.pm10), pm25: Math.round(a.pm2_5) } : null
          };
        });
        return json({ asof: new Date().toISOString(), src: 'open-meteo', spots }, 200, 600);
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
