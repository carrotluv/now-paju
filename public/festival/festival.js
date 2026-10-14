'use strict';
/* 임진각 축제 교통 상황판 — 임진각 반경 3D(파주 3D 맵 자료) + 지금 파주 실시간(도로·인파·주차·CCTV)
   한 벌의 화면을 축제마다 설정만 바꿔 쓴다: /festival/ = 장단콩축제, /festival/?f=ginseng = 개성인삼축제 */

// 지난 축제 방문객: 한국관광공사 관광빅데이터, 파주시 외지인 일별(2026-10-14 받음). 자료는 약 한 달 늦게 들어와
//   올해 값은 축제 한 달 뒤에 hist에 더한다. 2019~2021년은 돼지열병·코로나로 두 축제 모두 열리지 않았다.
const FESTS = {
  jangdan: {
    name: '장단콩축제', place: '임진각 평화누리', start: '2026-11-27', end: '2026-11-29', venue: '축제장 · 임진각 평화누리', ready: '12월 말 제공',
    hist: [
      { y: 2018, s: '11. 23.', e: '25.', d: [122619, 145512, 167100] },
      { y: 2022, s: '11. 25.', e: '27.', d: [148964, 205604, 188128] },
      { y: 2023, s: '11. 24.', e: '26.', d: [135009, 182518, 174909] },
      { y: 2024, s: '11. 22.', e: '24.', d: [139576, 193816, 184104] },
      { y: 2025, s: '11. 21.', e: '23.', d: [152271, 204099, 184264] },
    ],
    // 셔틀·임시주차장: 사용자가 준 파주시 안내·축제 교통 안내도(2026-10-14). 안내도의 '평화누리 주차장'은 OSM·브이월드에 없어
    //   안내도의 다섯 지점(행사장·평화누리·임진강역·평화주차장·임시주차장)으로 맞춘 좌표(오차 약 50m) — approx로 표시
    notHeld: [2019, 2020, 2021],
    // 작년 축제 날 임진각 시간별 인원(경기도 실시간 방문소비 = 지금 칸과 같은 자료, 원본 날짜 조회 24hours-1hour?date=, 2026-10-14 받음)
    //   이 자료는 2025-04-11부터라 지금은 작년 한 번과 비교한다. 내년엔 올해 값을 더해 평균으로
    prev: { y: 2025, days: [
      { d: '2025-11-21', h: [119, 107, 103, 91, 112, 112, 100, 112, 215, 368, 683, 1486, 2276, 2418, 2345, 2598, 1563, 831, 187, 137, 142, 124, 129, 127] },
      { d: '2025-11-22', h: [112, 126, 105, 124, 128, 132, 106, 141, 273, 636, 1322, 2401, 3370, 4140, 3927, 4185, 3661, 2452, 834, 240, 236, 262, 212, 131] },
      { d: '2025-11-23', h: [118, 137, 146, 137, 129, 123, 139, 141, 369, 627, 1260, 2219, 3403, 3777, 3997, 3697, 3190, 2124, 1132, 177, 118, 127, 119, 114] },
    ] },
    lots: [
      { n: '평화누리 주차장', addr: '임진각 평화누리 북동쪽(축제 교통 안내도)', lat: 37.89437, lng: 126.74489, approx: true },
      { n: '임진각 야외 보조주차장', addr: '문산읍 마정리 1177-8', lat: 37.89025, lng: 126.74581 },
      { n: '평화주차장', addr: '문산읍 마정리 989-1', lat: 37.89342, lng: 126.74676 },
    ],
    shuttle: '문산역 1번 출구 앞 ↔ 행사장', shuttleTime: '09:00~17:00 수시', shuttleShort: '09~17시 수시',
    shuttleStop: { n: '문산역 1번 출구 앞', lat: 37.85449, lng: 126.78740 },   // 승강장 좌표: OSM 문산역 1번 출구
  },
  ginseng: {
    // 셔틀·임시주차장: 파주시 관광 누리집 축제 안내(2026)·보도자료(10-12). 주차장 좌표는 브이월드 지번 검색
    name: '개성인삼축제', place: '임진각관광지', start: '2026-10-17', end: '2026-10-18', venue: '축제장 · 임진각관광지', ready: '11월 말 제공',
    hist: [
      { y: 2018, s: '10. 20.', e: '21.', d: [195562, 188668] },
      { y: 2022, s: '10. 22.', e: '23.', d: [230832, 225480] },
      { y: 2023, s: '10. 21.', e: '22.', d: [220798, 214284] },
      { y: 2024, s: '10. 19.', e: '20.', d: [201285, 197424] },
      { y: 2025, s: '10. 18.', e: '19.', d: [189231, 198618] },
    ],
    notHeld: [2019, 2020, 2021],
    // 작년 축제 날 임진각 시간별 인원(경기도 실시간 방문소비 = 지금 칸과 같은 자료, 원본 날짜 조회 24hours-1hour?date=, 2026-10-14 받음)
    //   이 자료는 2025-04-11부터라 지금은 작년 한 번과 비교한다. 내년엔 올해 값을 더해 평균으로
    prev: { y: 2025, days: [
      { d: '2025-10-18', h: [159, 141, 158, 171, 159, 191, 187, 268, 498, 816, 1330, 1969, 2528, 3078, 3292, 3384, 3104, 2298, 1003, 311, 266, 254, 208, 150] },
      { d: '2025-10-19', h: [217, 188, 203, 178, 171, 180, 181, 251, 486, 896, 1390, 2143, 3386, 4103, 4257, 4429, 4157, 3028, 1754, 431, 302, 223, 191, 154] },
    ] },
    lots: [
      { n: '임진각 야외 보조주차장', addr: '문산읍 마정리 1177-8', lat: 37.89025, lng: 126.74581 },
      { n: '평화주차장', addr: '문산읍 마정리 989-1', lat: 37.89342, lng: 126.74676 },
    ],
    shuttle: '문산역 1번 출구 앞 ↔ 행사장', shuttleTime: '09:00~17:00 수시', shuttleShort: '09~17시 수시',
    shuttleStop: { n: '문산역 1번 출구 앞', lat: 37.85449, lng: 126.78740 },   // 승강장 좌표: OSM 문산역 1번 출구
  },
};
const FKEY = new URLSearchParams(location.search).get('f') === 'ginseng' ? 'ginseng' : 'jangdan';
const FEST = FESTS[FKEY];
const BASE = location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, '');
const $ = (s) => document.querySelector(s);
const fmt = (n) => Number(n).toLocaleString('ko-KR');
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---- 지금 파주와 같은 도로 색 기준(now_colors.js의 computeColors가 이 전역들을 쓴다) ----
const LVC = { '원활': '#2f9b74', '서행': '#d18f3a', '정체': '#cc5647' };
const spdColor = (v) => (v >= 48 ? LVC['원활'] : (v >= 24 ? LVC['서행'] : LVC['정체']));
const mixWhite = (hex, t) => { const n = parseInt(hex.slice(1), 16), m = (x) => Math.round(x + (255 - x) * t); return `rgb(${m((n >> 16) & 255)},${m((n >> 8) & 255)},${m(n & 255)})`; };
let ROADGEO = [], LINKMAP = {}, ROADSIB = {}, ROADS = [], LINK_SPD = {};
const CROWD_C = { '여유': 'var(--s1)', '보통': 'var(--s2)', '약간 붐빔': 'var(--s3)', '붐빔': 'var(--s4)' };
const CROWD_HEX = { '여유': '#2fa876', '보통': '#d9a62e', '약간 붐빔': '#e07b2f', '붐빔': '#d94f3d' };

let map, FD, CENTER, R, VENUE;
const KX = 111320 * Math.cos(37.89 * Math.PI / 180), KY = 110574;
const distM = (lon, lat) => Math.hypot((lon - CENTER[0]) * KX, (lat - CENTER[1]) * KY);
const distV = (lon, lat) => Math.hypot((lon - VENUE[0]) * KX, (lat - VENUE[1]) * KY);   // 축제장(행사장 표시)에서의 거리
const fmtDist = (m) => (m < 1000 ? Math.round(m / 10) * 10 + 'm' : (m / 1000).toFixed(1) + 'km');
const hhmm = (iso) => { if (!iso) return ''; const d = new Date(iso); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
const isMobile = () => window.innerWidth <= 760;
// 지도 오른쪽 위 버튼 상태(TG = 지도 표식·색)와 목록 카드(CARD). 넓은 화면은 둘이 같이 움직이고,
//   좁은 화면은 카드가 지도를 다 가려서 처음엔 접어 두고 누른 버튼의 카드 하나만 펼친다(지도를 누르면 닫힘)
const TG = { road: true, cam: true, park: true };
const CARD = { road: !isMobile(), cam: !isMobile() };
const cardsOpen = () => CARD.road || CARD.cam;
const viewPad = () => (isMobile() ? { top: 40, bottom: Math.round(window.innerHeight * 0.52) + 8, left: 0, right: 0 } : { top: 0, bottom: 0, left: 384, right: cardsOpen() ? 324 : 0 });   // 상황판이 왼쪽(지금 파주와 같은 배치), 목록 카드가 오른쪽

function unpackBuildings(p) {
  return { type: 'FeatureCollection', features: p.g.map((g, i) => {
    const ring = []; let x = 0, y = 0;
    for (let j = 0; j < g.length; j += 2) { x += g[j]; y += g[j + 1]; ring.push([x / 1e6, y / 1e6]); }
    ring.push(ring[0]);
    return { type: 'Feature', properties: { i, u: p.u[i], h: p.h[i], f: p.f[i], n: p.n[i] || '' }, geometry: { type: 'Polygon', coordinates: [ring] } };
  }) };
}

// ---- 축제 날짜 표시 ----
function dayChip() {
  const kst = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  const day = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 864e5);
  const el = $('#day-chip');
  if (kst < FEST.start) { el.textContent = '축제 D-' + day(FEST.start, kst); el.className = 'chip'; }
  else if (kst <= FEST.end) { el.textContent = '축제 ' + (day(kst, FEST.start) + 1) + '일차 · 진행 중'; el.className = 'chip live'; }
  else { el.textContent = '축제 종료'; el.className = 'chip'; }
}

// ---- 지도 ----
function buildStyle() {
  const pad = 0.12, bb = FD.bbox;
  const demTiles = [BASE + 'dem/{z}/{x}/{y}.webp'];
  const roadW = (k) => ['interpolate', ['exponential', 1.6], ['zoom'], 11, ['match', ['get', 'r'], 1, 1.6 * k, 2, 1.4 * k, 3, 1.1 * k, 4, 0.9 * k, 0.5 * k], 17, ['match', ['get', 'r'], 1, 22 * k, 2, 19 * k, 3, 16 * k, 4, 12 * k, 8 * k]];
  return {
    version: 8,
    sources: {
      osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, maxzoom: 19, attribution: '지도 © OpenStreetMap contributors' },
      dem: { type: 'raster-dem', tiles: demTiles, tileSize: 512, maxzoom: 12, encoding: 'terrarium', bounds: [bb[0] - 0.02, bb[1] - 0.02, bb[2] + 0.02, bb[3] + 0.02], attribution: '지형 © Mapterhorn' },
      demhs: { type: 'raster-dem', tiles: demTiles, tileSize: 512, maxzoom: 12, encoding: 'terrarium', bounds: [bb[0] - 0.02, bb[1] - 0.02, bb[2] + 0.02, bb[3] + 0.02] },
      boundary: { type: 'geojson', data: FD.boundary }, mask: { type: 'geojson', data: FD.mask },
      landcover: { type: 'geojson', data: FD.landcover }, water: { type: 'geojson', data: FD.water },
      waterline: { type: 'geojson', data: FD.waterline }, roads: { type: 'geojson', data: FD.roads },
      rail: { type: 'geojson', data: FD.rail }, bridges: { type: 'geojson', data: FD.bridges },
      buildings: { type: 'geojson', data: unpackBuildings(FD.pack), maxzoom: 15, attribution: '건물·경계 © 국토교통부 VWorld' },
      traffic: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#e8ebe7' } },
      { id: 'osm', type: 'raster', source: 'osm', paint: { 'raster-saturation': -0.85, 'raster-opacity': 0.7, 'raster-contrast': -0.15, 'raster-brightness-min': 0.2 } },
      { id: 'land', type: 'fill', source: 'boundary', paint: { 'fill-color': '#f1f0eb' } },
      { id: 'landcover', type: 'fill', source: 'landcover', paint: { 'fill-color': ['match', ['get', 'k'], 'forest', '#cde0bd', 'park', '#c2dfa9', 'grass', '#d6e8c2', 'wetland', '#cfe3d6', 'farm', '#ebe8d2', 'industrial', '#e4e1e7', '#ebe8e2'], 'fill-antialias': false } },
      { id: 'hillshade', type: 'hillshade', source: 'demhs', paint: { 'hillshade-exaggeration': 0.28, 'hillshade-shadow-color': '#7d8378', 'hillshade-highlight-color': '#ffffff', 'hillshade-accent-color': '#9aa392' } },
      { id: 'water', type: 'fill', source: 'water', paint: { 'fill-color': '#a9cde3' } },
      { id: 'waterline', type: 'line', source: 'waterline', paint: { 'line-color': '#8fbdd8', 'line-width': ['interpolate', ['linear'], ['zoom'], 10, ['match', ['get', 'k'], 1, 1.2, 0.4], 16, ['match', ['get', 'k'], 1, 6, 2.5]] } },
      { id: 'road-case', type: 'line', source: 'roads', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#d3d1ca', 'line-width': roadW(1.25) } },
      { id: 'road', type: 'line', source: 'roads', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': roadW(1) } },
      { id: 'rail', type: 'line', source: 'rail', filter: ['==', ['get', 't'], 0], paint: { 'line-color': '#6AC2B3', 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.4, 17, 5] } },
      // 실시간 도로 색: 실측 구간만(추정 메우기 없음, 10-14)
      // 굵기는 바탕 도로(같은 등급)와 같게 — 더 가늘면 흰 바탕 도로가 가장자리로 비쳐 '빈 곳'처럼 보였다. 멀리선 최소 굵기 보장
      { id: 'tr-real', type: 'line', source: 'traffic', filter: ['==', ['get', 'k'], 'real'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['get', 'c'], 'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 11, ['match', ['get', 'r'], 1, 3.2, 2, 3, 2.6], 14, ['match', ['get', 'r'], 1, 6, 2, 5.4, 4.2], 17, ['match', ['get', 'r'], 1, 22, 2, 19, 3, 16, 4, 12, 8]] } },
      { id: 'mask', type: 'fill', source: 'mask', paint: { 'fill-color': '#f3f4f1', 'fill-opacity': 0.62 } },
      { id: 'bnd', type: 'line', source: 'boundary', paint: { 'line-color': '#e0793a', 'line-width': 1.6, 'line-dasharray': [3, 2] } },
      { id: 'bridge', type: 'fill-extrusion', source: 'bridges', minzoom: 12, filter: ['==', ['get', 'k'], 1], paint: { 'fill-extrusion-color': ['case', ['==', ['get', 'k'], 1], '#c6ccd4', '#e6e2d8'], 'fill-extrusion-base': ['get', 'b'], 'fill-extrusion-height': ['get', 't'] } },
      // 건물은 무채색 — 도로 색이 먼저 보이도록
      { id: 'bld', type: 'fill-extrusion', source: 'buildings', minzoom: 12.5, paint: { 'fill-extrusion-color': ['match', ['%', ['get', 'i'], 3], 0, '#d9d7d1', 1, '#dfddd7', '#e4e2dc'], 'fill-extrusion-height': ['get', 'h'], 'fill-extrusion-vertical-gradient': true, 'fill-extrusion-opacity': 0.92 } },
      { id: 'bld-roof', type: 'fill-extrusion', source: 'buildings', minzoom: 12.5, paint: { 'fill-extrusion-color': '#f1f0ec', 'fill-extrusion-base': ['get', 'h'], 'fill-extrusion-height': ['+', ['get', 'h'], 0.4], 'fill-extrusion-opacity': 0.92 } },
    ],
    terrain: { source: 'dem', exaggeration: 1.2 },
    sky: { 'sky-color': '#bcd8ee', 'horizon-color': '#eef3f6', 'fog-color': '#eef1f1', 'sky-horizon-blend': 0.7, 'horizon-fog-blend': 0.6, 'fog-ground-blend': 0.75 },
  };
}

function homeView(animate) {
  // 축제장(북서)과 진입로가 모이는 문산 방향(남동)이 한 화면에: 중심을 둘 사이로, 남동쪽이 화면 아래로 오게 방위 +25°
  //   좁은 화면은 가로가 짧아 같은 중심이면 축제장 표시가 왼쪽 끝에 잘린다(x=22px 실측) → 축제장 쪽으로 당긴다
  const cam = { center: isMobile() ? [VENUE[0] + 0.006, VENUE[1] - 0.009] : [VENUE[0] + 0.016, VENUE[1] - 0.014], zoom: isMobile() ? 12.5 : 13.0, pitch: 50, bearing: 25, padding: viewPad() };
  if (animate) map.flyTo({ ...cam, duration: 1800, essential: true }); else map.jumpTo(cam);
}

// ---- 실시간 자료 ----
async function getJSON(u) { const r = await fetch(u, { cache: 'no-store' }); if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); }

function drawTraffic() {
  if (!ROADGEO.length || !ROADS.length) return;
  ROADGEO._for = null;
  // 실측 구간만 칠한다(2026-10-14 사용자 "실측 구간만 남겨줘") — 같은 길 이름 평균·나들목 나눔·짧은 조각 색 맞추기 같은
  //   추정 메우기는 쓰지 않고, 그 구간에 매칭된 경기도·국가교통정보센터 측정값(등급·속도)만 쓴다. 측정값 없는 길은 비워 둔다
  const { measured } = computeColors(LINK_SPD);
  const near = (p) => distM(p[1], p[0]) <= R * 1.15;
  let curH = 5;                                                          // 지금 그리는 도로 등급(선 굵기를 바탕 도로와 같게)
  const feats = [], line = (pts, c) => feats.push({ type: 'Feature', properties: { c, k: 'real', r: curH }, geometry: { type: 'LineString', coordinates: pts.map((p) => [p[1], p[0]]) } });
  const byName = {};                                                     // 반경 안 구간의 실측값을 도로 이름별로 모은다(패널용)
  ROADGEO.forEach((r, i) => {
    if (r.p.length < 2 || !r.p.some(near)) return;
    curH = r.h || 5;
    const arr = measured[i], own = arr ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
    if (own == null) return;                                             // 측정값 없음 → 칠하지 않음
    if (r.n && (r.h || 5) <= 4 && !/회차로/.test(r.n)) {                 // 패널: 간선(지방도까지)만 — 시내 골목은 원래 느려 '정체'로 보인다
      const b = byName[r.n] = byName[r.n] || { v: [], d: 1e9 };
      b.v.push(own); b.d = Math.min(b.d, ...r.p.map((q) => distM(q[1], q[0])));
    }
    line(r.p, spdColor(own));                                            // 왕복 분리도로도 각 방향 구간을 제 측정값으로
  });
  map.getSource('traffic').setData({ type: 'FeatureCollection', features: feats });
  // 패널: 반경 안 실측 구간의 평균(서버 요약표는 6개 도로뿐이라 축제장 주변 도로가 빠진다), 축제장에서 가까운 순
  const rows = Object.entries(byName).map(([road, b]) => {
    const speed = Math.round(b.v.reduce((x, y) => x + y, 0) / b.v.length);
    return { road, speed, d: b.d, lv: speed >= 48 ? '원활' : (speed >= 24 ? '서행' : '정체') };
  }).sort((a, b) => a.d - b.d).slice(0, 8);
  $('#roads').innerHTML = rows.length ? rows.map((r) => `<div class="tr-row"><i style="background:${LVC[r.lv] || '#b5afa3'}"></i><span>${esc(r.road)}<small class="num dist">${fmtDist(r.d)}</small></span><span class="sp num">${r.speed}<small>km/h</small></span><span class="lv">${r.lv || '-'}</span></div>`).join('')
    : '<div class="empty">반경 안 도로 자료 없음</div>';
}

// 인파 단계 색(지금 파주 HEXC·TXTC와 같은 값)
const HEXC = { '여유': '#2fa876', '보통': '#d9a62e', '약간 혼잡': '#e07b2f', '약간 붐빔': '#e07b2f', '혼잡': '#d94f3d', '붐빔': '#d94f3d', '매우 혼잡': '#b3271b' };
const TXTC = { '여유': '#17714b', '보통': '#7a5f0e', '약간 혼잡': '#8f4713', '약간 붐빔': '#8f4713', '혼잡': '#b03225', '붐빔': '#b03225', '매우 혼잡': '#b03225' };
const fmtDiff = (v) => (v == null ? '-' : (v > 0 ? '+' : '') + Math.round(v) + '%');
function renderCrowd(sum, spot) {
  const s = (sum.spots || []).find((x) => x.id === 200) || (sum.spots || []).find((x) => /임진각/.test(x.name));
  const label = s ? s.label : '-';
  $('#crowd-label').textContent = s ? '임진각 지금 ' + label : '인파 자료 없음';
  $('#crowd-head').style.color = TXTC[label] || 'var(--sub)';
  $('#mc-pop').style.setProperty('--c', TXTC[label] || 'var(--ink)');
  const tr = (spot && spot.trend) || [];
  const last = tr[tr.length - 1];
  $('#v-pop').innerHTML = last ? fmt(last.sum) + '<small>명</small>' : '-';
  $('#v-diff').textContent = last ? fmtDiff(last.vsAvg) : '-';
  CROWD = { tr, last, label };
  const pc = prevCompare();
  $('#v-prev').textContent = pc && pc.vs != null ? fmtDiff(pc.vs) : '-';
  const max = Math.max(1, ...tr.map((x) => x.sum));                    // 그 지점의 24시간 중 가장 많은 실제 인원 = 칸 꽉 채움
  $('#v-max').innerHTML = tr.length ? fmt(max) + '<small>명</small>' : '-';
  $('#now-h').textContent = last ? '지금 ' + last.h + '시' : '';
  const byH = new Array(24).fill(0); tr.forEach((x) => { byH[x.h] = Math.round(x.sum / max * 100); });
  const nowIdx = last ? last.h : -1, hi = byH.reduce((b, v, j) => (v > byH[b] ? j : b), 0);
  $('#bars').innerHTML = byH.map((v, j) => {
    const isNow = j === nowIdx, isMk = j === hi && v > 0;
    const cls = (isNow ? 'now ' : '') + (isMk && !isNow ? 'mark ' : '') + (isMk ? (j <= 1 ? 's' : (j >= 22 ? 'e' : '')) : '');
    const st = 'height:' + Math.max(3, Math.round(v * 0.64)) + 'px' + (isNow ? ';color:' + (HEXC[label] || '#b5afa3') + ';background:' + (HEXC[label] || '#b5afa3') : '');
    return `<i class="${cls.trim()}" style="${st}">${isMk ? '<b>붐빔 ' + j + '시</b>' : ''}</i>`;
  }).join('');
  const age = spot && spot.age && spot.age.highestAge ? spot.age : null;
  const sex = spot && spot.sex && spot.sex.highestGender ? (spot.sex.highestGender === '여성' ? '여 ' : '남 ') + Math.max(spot.sex.maleRatio, spot.sex.femaleRatio).toFixed(0) + '%' : null;
  $('#kv').innerHTML = age || sex ? '주 방문층 ' + (age ? `<b>${esc(age.highestAge)}</b>${age.highestRatio != null ? ` <span class="num">${age.highestRatio}%</span>` : ''}` : '-') + (sex ? ` · <b>${sex}</b>` : '') : '';
}

// ---- 지난 축제 대비: 지금 임진각 인원 ÷ 작년 축제 같은 날차·같은 시각 인원(같은 통신 자료) ----
//   축제 기간이면 오늘이 몇째 날인지로, 축제 전·후엔 작년 1일차와 비교한다
let CROWD = null;
function prevCompare() {
  if (!FEST.prev || !CROWD || !CROWD.last) return null;
  const kst = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  const inFest = kst >= FEST.start && kst <= FEST.end;
  const n = inFest ? Math.round((Date.parse(kst) - Date.parse(FEST.start)) / 864e5) : 0;
  const day = FEST.prev.days[Math.min(n, FEST.prev.days.length - 1)];
  const h = CROWD.last.h, base = day.h[h];
  return { n: Math.min(n, FEST.prev.days.length - 1), inFest, day, h, now: CROWD.last.sum, base, vs: base ? (CROWD.last.sum / base - 1) * 100 : null, kst };
}
function prevSectionHtml() {
  const pc = prevCompare();
  if (!pc) return '';
  const today = new Array(24).fill(null);
  CROWD.tr.forEach((x) => { if (x.d === pc.kst || (!x.d && x.h <= pc.h)) today[x.h] = x.sum; });
  const max = Math.max(1, ...pc.day.h, ...today.filter((v) => v != null));
  const bars = pc.day.h.map((v, j) => `<div class="c"><i style="height:${Math.max(1, Math.round(v / max * 110))}px"></i><i class="t" style="height:${today[j] == null ? 0 : Math.max(1, Math.round(today[j] / max * 110))}px"></i></div>`).join('');
  const md = (s) => `${+s.slice(5, 7)}. ${+s.slice(8)}.`;
  const pk = pc.day.h.reduce((b, v, j) => (v > pc.day.h[b] ? j : b), 0);
  return `<div class="p-sec" style="margin-top:0">작년 축제와 같은 시각 비교<span class="hint num">${FEST.prev.y} ${pc.n + 1}일차(${md(pc.day.d)})${pc.inFest ? '' : ' · 축제 전·후엔 1일차와'}</span></div>`
    + `<div class="cmpv num">지금 ${pc.h}시 <b>${fmt(pc.now)}명</b> · 작년 같은 시각 <b>${fmt(pc.base)}명</b> · <b>${pc.vs == null ? '-' : fmtDiff(pc.vs)}</b></div>`
    + `<div class="cbars">${bars}</div><div class="bar-x num"><span>0시</span><span>6시</span><span>12시</span><span>18시</span><span>23시</span></div>`
    + `<div class="clg"><span><i></i>작년 ${pc.n + 1}일차(최다 ${fmt(pc.day.h[pk])}명 · ${pk}시)</span><span><i class="t"></i>오늘</span></div>`
    + `<div class="src">경기도 실시간 방문소비 현황(통신 기반 추정) · 임진각 평화누리공원 · 지금 칸과 같은 자료</div>`
    + `<div class="p-sec">연도별 축제 방문객<span class="hint">한국관광공사 · 파주시 전체</span></div>`;
}

function openHist() {
  const NOT_HELD = FEST.notHeld, nd = FEST.hist[0].d.length;
  const rows = FEST.hist.map((h) => ({ ...h, sum: h.d.reduce((a, b) => a + b, 0) }));
  rows.forEach((h, i) => {                                               // 지난 3번의 축제 평균과 비교(열린 해만 센다)
    const prev = rows.slice(Math.max(0, i - 3), i);
    h.vs = prev.length === 3 ? (h.sum / (prev.reduce((a, b) => a + b.sum, 0) / 3) - 1) * 100 : null;
  });
  const max = Math.max(...rows.map((h) => h.sum));
  const thisYear = +FEST.start.slice(0, 4), first = rows[0].y;
  const man = (v) => (v / 10000).toFixed(1) + '만';
  const cols = [];
  for (let y = first; y <= thisYear; y++) {
    const h = rows.find((r) => r.y === y);
    if (NOT_HELD.includes(y)) {                                          // 미개최 해는 한 칸으로 묶는다(휴대폰 폭에서 숫자가 맞닿지 않게)
      if (y === NOT_HELD[0]) cols.push({ y: `${String(NOT_HELD[0]).slice(2)}~${String(NOT_HELD[NOT_HELD.length - 1]).slice(2)}`, html: '<span class="na">미개최</span>' });
      continue;
    }
    cols.push({ y, html: h ? `<i style="height:${Math.round(h.sum / max * 150)}px"><b class="num">${man(h.sum)}</b></i>` : '<span class="na">집계 전</span>' });
  }
  const tr = rows.map((h, i) => `<tr><td class="num">${i + 1}</td><td class="num">${h.y}</td><td class="num">${h.s} ~ ${h.e}</td><td class="r num">${fmt(h.sum)}</td><td class="num">${h.vs == null ? '-' : fmtDiff(h.vs)}</td></tr>`).join('')
    + `<tr class="wait"><td class="num">${rows.length + 1}</td><td class="num">${thisYear}</td><td class="num">${+FEST.start.slice(5, 7)}. ${FEST.start.slice(8)}. ~ ${FEST.end.slice(8)}.</td><td class="r">${FEST.ready}</td><td>-</td></tr>`;
  $('#h-body').innerHTML = prevSectionHtml() + `<div class="hbars">${cols.map((c) => `<div class="c">${c.html}</div>`).join('')}</div>`
    + `<div class="hx num">${cols.map((c) => `<span>${c.y}</span>`).join('')}</div>`
    + `<div class="hunit">단위: 명</div>`
    + `<table class="htbl"><thead><tr><th>#</th><th>연도</th><th>기간</th><th>방문객(${nd}일)</th><th>3년 평균 대비</th></tr></thead><tbody>${tr}</tbody></table>`
    + `<div class="src">한국관광공사 관광빅데이터(이동통신 기반)</div>`;
  $('#h-title').textContent = FEST.name + ' 지난 축제 대비';
  $('#h-sub').textContent = '임진각 · 작년 같은 날차·같은 시각';
  $('#hist').classList.add('open');
}
function closeHist() { $('#hist').classList.remove('open'); }

// 날씨(지금 파주 /api/weather — 같은 아이콘·문구·미세먼지 등급)
const _SUN = '#f2a72c', _CLOUD = '#8fa6bd', _RAIN = '#4a90d9', _SNOW = '#8ec6ea', _FOG = '#9aa7b4';
const _sv = (d) => `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const _sun = `<g stroke="${_SUN}"><circle cx="12" cy="12" r="4.2"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4"/></g>`;
const _cloud = `<path stroke="${_CLOUD}" d="M7.5 18h9a3.5 3.5 0 0 0 .3-7 5 5 0 0 0-9.6 1.2A3.4 3.4 0 0 0 7.5 18z"/>`;
const _sunCloud = `<g stroke="${_SUN}"><circle cx="8.5" cy="8" r="3"/><path d="M8.5 2.6v1.5M3.6 8H2.1M4.9 4.4 3.9 3.4M12.1 4.4l1-1"/></g><path stroke="${_CLOUD}" d="M9.5 19h7.5a3.2 3.2 0 0 0 .3-6.4 4.6 4.6 0 0 0-8.8 1.1A3.1 3.1 0 0 0 9.5 19z"/>`;
const _rain = _cloud + `<path stroke="${_RAIN}" d="M9 20.5l-.8 1.6M12.5 20.5l-.8 1.6M16 20.5l-.8 1.6"/>`;
const _snow = _cloud + `<path stroke="${_SNOW}" d="M9 21h.01M12.5 21.6h.01M16 21h.01"/>`;
const _fog = `<path stroke="${_FOG}" d="M4 9h16M6 13h12M4 17h16"/>`;
const _storm = _cloud + `<path stroke="${_SUN}" d="M13 19.5l-2.2 3.2h3l-2 3"/>`;
const SKY = { 0: ['맑음', _sun], 1: ['대체로 맑음', _sunCloud], 2: ['구름 조금', _sunCloud], 3: ['흐림', _cloud], 45: ['안개', _fog], 48: ['서리 안개', _fog],
  51: ['이슬비', _rain], 53: ['이슬비', _rain], 55: ['이슬비', _rain], 56: ['얼음 이슬비', _rain], 57: ['얼음 이슬비', _rain], 61: ['비', _rain], 63: ['비', _rain], 65: ['강한 비', _rain],
  66: ['얼어붙는 비', _rain], 67: ['얼어붙는 비', _rain], 71: ['눈', _snow], 73: ['눈', _snow], 75: ['많은 눈', _snow], 77: ['싸락눈', _snow], 80: ['소나기', _rain], 81: ['소나기', _rain],
  82: ['강한 소나기', _rain], 85: ['소낙눈', _snow], 86: ['소낙눈', _snow], 95: ['천둥번개', _storm], 96: ['천둥번개', _storm], 99: ['우박 천둥번개', _storm] };
const PM_GRADE = (v) => (v == null ? null : (v <= 30 ? '좋음' : (v <= 80 ? '보통' : (v <= 150 ? '나쁨' : '매우나쁨'))));
function renderWx(j) {
  const d = (j.spots || [])[0];
  if (!d || !d.w) { $('#wx').hidden = true; return; }
  const w = d.w, sky = SKY[w.code] || ['-', _sun], air = d.air;
  $('#wx').innerHTML = `<i class="ic">${_sv(sky[1])}</i>`
    + `<div class="main"><span class="t num">${w.t}°</span><span class="cond">${sky[0]}${w.feel != null ? ' · 체감 ' + w.feel + '°' : ''}</span></div>`
    + `<div class="r num"><b>최저</b><span>${w.lo ?? '-'}</span><em>°</em><i>/</i><b>최고</b><span>${w.hi ?? '-'}</span><em>°</em>`
    + `<b>습도</b><span>${w.hum ?? '-'}</span><em>%</em>${air ? `<i>/</i><b>미세</b><span>${air.pm10 ?? '-'}</span><em class="g">${PM_GRADE(air.pm10) ?? ''}</em>` : '<i></i><b></b><span></span><em></em>'}</div>`;
  $('#wx').hidden = false;
}

let pkMarkers = [], LOTS = [], pkPop = null;
function lotPopupHtml(p) {
  const st = pkState(p), q = encodeURIComponent(p.n);
  if (st === 'tmp') return `<div class="pp"><div class="pp-h">${esc(p.n)}</div><div class="pp-av">축제 임시주차장 · 빈자리 안내 없음${FEST.basis ? ' · ' + FEST.basis : ''}</div><dl class="pp-kv"><dt>요금</dt><dd>무료(축제 기간)</dd><dt>${p.approx ? '위치' : '주소'}</dt><dd>${esc(p.addr)}${p.approx ? ' · 안내도 기준 대략' : ''}</dd></dl>`
    + `<div class="navs"><a target="_blank" rel="noopener" href="https://map.kakao.com/link/to/${q},${p.lat},${p.lng}">카카오맵</a><a target="_blank" rel="noopener" href="https://map.naver.com/p/directions/-/${p.lng},${p.lat},${q}/-/car">네이버</a><a href="tmap://route?goalname=${q}&goalx=${p.lng}&goaly=${p.lat}">티맵</a></div></div>`;
  const fees = [p.bt && p.bf ? `기본 ${p.bt}분 ${fmt(p.bf)}원` : '', p.at && p.af ? `추가 ${p.at}분 ${fmt(p.af)}원` : '', p.dd ? `1일 ${fmt(p.dd)}원` : ''].filter(Boolean);
  const fee = fees.length ? fees.join(' · ') : ((p.bf || p.af || p.dd) ? '유료' : '무료');
  const hours = !(p.ws && p.we) ? '-' : ((p.ws === '00:00' && ['23:59', '24:00', '00:00'].includes(p.we)) ? '24시간' : `평일 ${p.ws}–${p.we}`);
  const av = st === 'na' ? `<div class="pp-av">빈자리 안내 없음 <span>총 ${fmt(p.total)}면</span></div>`
    : `<div class="pp-av"><b style="color:${PK_COL[st]}">${fmt(p.avail)}</b><span>/ ${fmt(p.total)}면 남음 · ${PK_TXT[st]}</span></div><div class="meter"><i style="width:${p.total ? Math.round(p.avail / p.total * 100) : 0}%;background:${PK_COL[st]}"></i></div>`;
  return `<div class="pp"><div class="pp-h">${esc(p.n)}</div>${av}<dl class="pp-kv"><dt>요금</dt><dd>${fee}</dd><dt>운영</dt><dd>${hours}</dd></dl>`
    + `<div class="navs"><a target="_blank" rel="noopener" href="https://map.kakao.com/link/to/${q},${p.lat},${p.lng}">카카오맵</a><a target="_blank" rel="noopener" href="https://map.naver.com/p/directions/-/${p.lng},${p.lat},${q}/-/car">네이버</a><a href="tmap://route?goalname=${q}&goalx=${p.lng}&goaly=${p.lat}">티맵</a></div></div>`;
}
// 상황판의 주차장 줄·지도 P를 누르면 그 주차장으로 날아가 확대하고 정보창을 연다(지금 파주와 같은 동작)
function flyToLot(p) {
  if (pkPop) pkPop.remove();
  map.flyTo({ center: [p.lng, p.lat], zoom: 17, pitch: 55, bearing: map.getBearing(), padding: viewPad(), duration: 1800, essential: true });
  map.once('moveend', () => {
    pkPop = new maplibregl.Popup({ offset: [0, 28], maxWidth: '280px', closeButton: true }).setLngLat([p.lng, p.lat]).setHTML(lotPopupHtml(p)).addTo(map);
  });
}
function pkState(p) {
  if (p.tmp) return 'tmp';
  if (p.avail == null) return 'na';
  if (p.avail > 0) { const r = p.avail / p.total; return r >= 0.3 ? 'ok' : (r >= 0.1 ? 'mid' : 'low'); }
  return p.seen24 ? 'full' : 'na';
}
const PK_COL = { ok: '#2fa876', mid: '#d9a62e', low: '#d94f3d', full: '#b3271b', na: '#a39d91', tmp: '#6b665b' };
const PK_TXT = { ok: '여유', mid: '보통', low: '혼잡', full: '만차', na: '빈자리 안내 없음', tmp: '축제 임시' };
function renderParking(pk) {
  // 임시·실시간 구분 없이 축제장에서 가까운 순(거리도 축제장 기준). 반경 거르기는 지도 범위(CENTER) 기준 그대로
  const tmp = FEST.lots.map((p) => ({ ...p, tmp: true, d: distV(p.lng, p.lat) }));
  const real = (pk.lots || []).filter((p) => distM(p.lng, p.lat) <= R).map((p) => ({ ...p, d: distV(p.lng, p.lat) }));
  const lots = LOTS = tmp.concat(real).sort((a, b) => a.d - b.d);
  $('#pk-asof').textContent = pk.asof ? hhmm(pk.asof) + ' 기준' : '';
  // 셔틀은 주차장 표 맨 위 한 줄로(두 줄 안내문 대신) — 누르면 승강장으로
  const bus = FEST.shuttleStop ? `<button class="pkrow" data-bus="1" title="지도에서 승강장 보기"><span class="tag">셔틀</span><span class="nm">${esc(FEST.shuttleStop.n)}</span><span class="d sh num">${esc(FEST.shuttleShort)}</span><span class="av st">무료</span></button>` : '';
  $('#lots').innerHTML = bus + (lots.length ? lots.map((p, i) => {
    const st = pkState(p);
    const val = st === 'tmp' ? '<span class="av st">무료</span>'
      : st === 'na' ? '<span class="av na">안내 없음</span>'
      : st === 'full' ? '<span class="av full">만차</span>'
        : `<span class="av ${st} num"><b>${fmt(p.avail)}</b>/${fmt(p.total)}</span>`;
    return `<button class="pkrow" data-i="${i}" title="지도에서 보기"><span class="tag">${p.tmp ? '임시' : ((p.bf || p.af || p.dd) ? '유료' : '무료')}</span><span class="nm">${esc(p.tmp ? p.n : p.n.replace(/\s*주차장$/, ''))}</span><span class="d num">${fmtDist(p.d)}</span>${val}</button>`;
  }).join('') : '<div class="empty">반경 안 실시간 주차장 없음</div>');
  $('#lots').querySelectorAll('.pkrow').forEach((el) => { el.onclick = () => (el.dataset.bus ? flyToShuttle() : flyToLot(LOTS[+el.dataset.i])); });
  pkMarkers.forEach((m) => m.remove());
  pkMarkers = lots.map((p) => {
    const st = pkState(p), el = document.createElement('div');
    el.className = 'mk pk'; el.style.setProperty('--c', PK_COL[st]);
    el.innerHTML = `<b>P</b>${st === 'tmp' ? '임시' : (st === 'na' ? '' : fmt(p.avail))}`;
    el.title = p.n;
    el.onclick = (e) => { e.stopPropagation(); flyToLot(p); };
    if (!TG.park) el.style.display = 'none';
    return new maplibregl.Marker({ element: el, anchor: 'top', offset: [0, 6] }).setLngLat([p.lng, p.lat]).addTo(map);   // 축제장 표시(위)와 겹치지 않게 아래로
  });
}

// 셔틀 승강장 — 버스 실시간 위치는 공개 자료가 없어 승강장만 표시한다
const BUS_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="3" width="16" height="14" rx="2"/><path d="M4 11h16M8 21v-4M16 21v-4"/><circle cx="8" cy="14" r=".6"/><circle cx="16" cy="14" r=".6"/></svg>';
function shuttlePopupHtml() {
  const s = FEST.shuttleStop, q = encodeURIComponent('문산역');
  return `<div class="pp"><div class="pp-h">셔틀 승강장 · ${esc(s.n)}</div><div class="pp-av">행사장까지 무료 순환</div><dl class="pp-kv"><dt>운행</dt><dd>${esc(FEST.shuttleTime)}</dd><dt>구간</dt><dd>${esc(FEST.shuttle)}</dd></dl>`
    + `<div class="navs"><a target="_blank" rel="noopener" href="https://map.kakao.com/link/to/${q},${s.lat},${s.lng}">카카오맵</a><a target="_blank" rel="noopener" href="https://map.naver.com/p/directions/-/${s.lng},${s.lat},${q}/-/walk">네이버</a><a href="tmap://route?goalname=${q}&goalx=${s.lng}&goaly=${s.lat}">티맵</a></div></div>`;
}
function flyToShuttle() {
  const s = FEST.shuttleStop; if (!s) return;
  if (pkPop) pkPop.remove();
  map.flyTo({ center: [s.lng, s.lat], zoom: 16.5, pitch: 55, bearing: map.getBearing(), padding: viewPad(), duration: 1800, essential: true });
  map.once('moveend', () => { pkPop = new maplibregl.Popup({ offset: [0, -30], maxWidth: '280px' }).setLngLat([s.lng, s.lat]).setHTML(shuttlePopupHtml()).addTo(map); });
}
function addShuttleMarker() {
  const s = FEST.shuttleStop; if (!s) return;
  const el = document.createElement('div');
  el.className = 'mk bus'; el.innerHTML = BUS_SVG + '셔틀 승강장'; el.title = '셔틀 승강장 · ' + s.n;
  el.onclick = (e) => { e.stopPropagation(); flyToShuttle(); };
  new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([s.lng, s.lat]).addTo(map);
}

let camMarkers = [], CAMS = [];
const camName = (n) => String(n || '').replace(/^\[[^\]]*\]\s*/, '').replace(/^파주\s*/, '');
const camRoute = (n) => ((String(n || '').match(/^\[([^\]]*)\]/) || [])[1] || '').replace(/\s+/g, ' ').trim()
  .replace(/^(국도|지방도|국지도)\s*(\d+)(호선)?$/, '$1 $2호선');   // 원본 표기가 제각각('국도1'·'국도 1호선'·'국도1호선')이라 한 가지로
function renderCams(cc) {
  CAMS = (cc.cams || []).map((c) => ({ ...c, d: distM(c.lng, c.lat) })).filter((c) => c.d <= R).sort((a, b) => a.d - b.d).slice(0, 8);
  $('#cam-cnt').textContent = CAMS.length ? CAMS.length + '대' : '';
  $('#cams').innerHTML = CAMS.length ? CAMS.map((c, i) => `<button class="cambtn" data-i="${i}">${camRoute(c.n) ? `<span class="tag">${esc(camRoute(c.n))}</span>` : ''}<span class="nm">${esc(camName(c.n))}</span><span class="go">보기 ›</span></button>`).join('')
    : '<div class="empty">반경 안 CCTV 없음(사무실 PC 중계가 꺼져 있으면 비어 있습니다)</div>';
  $('#cams').querySelectorAll('.cambtn').forEach((b) => { b.onclick = () => openCam(CAMS[+b.dataset.i]); });
  camMarkers.forEach((m) => m.remove());
  camMarkers = CAMS.map((c) => {
    const el = document.createElement('div');
    el.className = 'mk cam'; el.title = camName(c.n);
    el.innerHTML = '<svg viewBox="0 0 24 24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>';
    el.onclick = () => openCam(c);
    if (!TG.cam) el.style.display = 'none';
    return new maplibregl.Marker({ element: el }).setLngLat([c.lng, c.lat]).addTo(map);
  });
}

// 오른쪽 위 버튼: 진입 도로 = 도로 색·범례·목록 카드, CCTV = 카메라 표식·목록 카드, 주차 = P 표식
function applyToggles() {
  $('#tg-road').classList.toggle('on', TG.road); $('#tg-cam').classList.toggle('on', TG.cam); $('#tg-park').classList.toggle('on', TG.park);
  $('#card-road').hidden = !CARD.road; $('#card-cam').hidden = !CARD.cam;
  $('#legend').style.visibility = TG.road ? '' : 'hidden';
  if (map && map.getLayer('tr-real')) map.setLayoutProperty('tr-real', 'visibility', TG.road ? 'visible' : 'none');
  camMarkers.forEach((m) => { m.getElement().style.display = TG.cam ? '' : 'none'; });
  pkMarkers.forEach((m) => { m.getElement().style.display = TG.park ? '' : 'none'; });
}

let camHls = null;
function stopStream() {
  if (camHls) { try { camHls.destroy(); } catch (e) { /* 무시 */ } camHls = null; }
  $('#m-body').innerHTML = '';
}
function openCam(c) {
  $('#m-title').textContent = camName(c.n);
  $('#m-sub').textContent = camRoute(c.n) + ' · 국가교통정보센터 실시간';
  stopStream();
  $('#m-body').innerHTML = '<video id="cv" autoplay muted playsinline controls></video>';
  const v = $('#cv');
  if (window.Hls && Hls.isSupported()) { camHls = new Hls({ maxBufferLength: 15 }); camHls.loadSource(c.url); camHls.attachMedia(v); } else { v.src = c.url; }
  $('#modal').classList.add('open');
}
function closeCam() { $('#modal').classList.remove('open'); stopStream(); }

async function loadLive() {
  $('#upd').textContent = '갱신 중';
  const tasks = [
    Promise.all([getJSON('/api/summary'), getJSON('/api/spot/200').catch(() => null)]).then(([s, sp]) => renderCrowd(s, sp)),
    getJSON('/api/weather?pts=' + encodeURIComponent(VENUE[1].toFixed(4) + ',' + VENUE[0].toFixed(4))).then(renderWx),
    getJSON('/api/parking').then(renderParking),
    getJSON('/api/cctv').then(renderCams),
    getJSON('/api/traffic').then((t) => {
      ROADS = t.roads || [];
      const G = t.grades || {}, GCV = { 1: 75, 2: 45, 3: 20 };
      LINK_SPD = Object.fromEntries(Object.entries(t.links || {}).map(([k, v]) => [k, GCV[G[k]] ?? v]));
      $('#tr-asof').textContent = t.asof ? hhmm(t.asof) + ' 기준' : '';
      drawTraffic();
    }),
  ];
  const res = await Promise.allSettled(tasks);
  const fail = res.filter((r) => r.status === 'rejected').length;
  const now = new Date();
  $('#upd').textContent = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0') + ' 갱신' + (fail ? ' · ' + fail + '개 실패' : '');
}

async function startFestival() {
  // 축제별 이름·기간 표시
  const wd = (s) => '일월화수목금토'[new Date(s + 'T00:00:00Z').getUTCDay()];
  const md = (s) => `${+s.slice(5, 7)}월 ${+s.slice(8)}일(${wd(s)})`;
  document.title = FEST.name + ' 상황판 · 지금 파주';
  $('#brand-name').textContent = FEST.name + ' 상황판';
  $('#brand-sub').textContent = `${FEST.place} · ${md(FEST.start)} ~ ${+FEST.end.slice(8)}일(${wd(FEST.end)})`;
  // 출처는 한 줄로(상황판 세로 스크롤 없게)
  $('#pk-src').textContent = '경기도교통정보센터 실시간 · ' + (FEST.lots.length ? (FEST.basis ? '셔틀 파주시 안내 · 임시는 작년 안내' : '임시·셔틀은 파주시 안내') : '축제 임시주차장 미포함');
  // 축제 바꾸기: 열려 있는(끝나고 7일 안) 축제가 둘 이상일 때만 — 지금 파주 헤더 탭과 같은 기간
  { const kst = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
    const open = Object.entries(FESTS).filter(([, f]) => kst <= new Date(Date.parse(f.end) + 7 * 864e5).toISOString().slice(0, 10)).sort((a, b) => a[1].start.localeCompare(b[1].start));
    if (open.length > 1) $('#fsw').innerHTML = open.map(([k, f]) => `<a href="/festival/${k === 'jangdan' ? '' : '?f=' + k}"${k === FKEY ? ' class="on" aria-current="page"' : ''}>${esc(f.name.replace(/축제$/, ''))}</a>`).join(''); }
  dayChip();
  const [fd, rg] = await Promise.all([getJSON(BASE + 'fdata.json'), getJSON('/paju_roads.json')]);
  FD = fd; CENTER = fd.center; R = fd.radius;
  ROADGEO = rg.roads || []; LINKMAP = rg.map || {}; ROADSIB = rg.sib || {};
  const v = (fd.landmarks || []).find((l) => /임진각/.test(l.name));
  VENUE = v ? [v.lon, v.lat] : CENTER;
  map = new maplibregl.Map({
    container: 'map', style: buildStyle(), center: CENTER, zoom: 12, pitch: 50, bearing: -20, maxPitch: 80,
    minZoom: 10.5, maxBounds: [[FD.bbox[0] - 0.25, FD.bbox[1] - 0.2], [FD.bbox[2] + 0.25, FD.bbox[3] + 0.2]],
    canvasContextAttributes: { antialias: true }, attributionControl: { compact: true },
  });
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');   // 오른쪽 위는 지금 파주처럼 켜기/끄기 버튼
  map.on('load', () => {
    document.querySelectorAll('.maplibregl-ctrl-attrib').forEach((a) => a.classList.remove('maplibregl-compact-show'));
    homeView(false);
    const el = document.createElement('div');
    el.className = 'mk venue'; el.textContent = FEST.venue;
    el.style.zIndex = '3';                                                // 가까운 임시주차장 P가 이름표를 덮지 않게
    el.onclick = () => homeView(true);
    new maplibregl.Marker({ element: el, anchor: 'bottom', offset: [0, -4] }).setLngLat(VENUE).addTo(map);
    addShuttleMarker();
    loadLive();
    setInterval(() => { dayChip(); loadLive(); }, 300000);
  });
  $('#reload').onclick = loadLive;
  applyToggles();
  [['road', '#tg-road'], ['cam', '#tg-cam'], ['park', '#tg-park']].forEach(([k, id]) => {
    $(id).onclick = () => {
      const hasCard = k in CARD, mob = isMobile();
      if (hasCard && mob && TG[k] && !CARD[k]) CARD[k] = true;            // 좁은 화면: 켜져 있는데 카드가 접혀 있으면 펼치기만
      else { TG[k] = !TG[k]; if (hasCard) CARD[k] = TG[k]; }
      if (hasCard && mob && CARD[k]) Object.keys(CARD).forEach((o) => { if (o !== k) CARD[o] = false; });
      applyToggles();
    };
  });
  map.on('click', () => { if (isMobile() && cardsOpen()) { CARD.road = CARD.cam = false; applyToggles(); } });
  $('#m-x').onclick = closeCam;
  $('#mc-diff').onclick = openHist;
  $('#h-x').onclick = closeHist;
  $('#hist').onclick = (e) => { if (e.target.id === 'hist') closeHist(); };
  $('#modal').onclick = (e) => { if (e.target.id === 'modal') closeCam(); };
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeCam(); closeHist(); } });
}
