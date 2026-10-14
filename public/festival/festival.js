'use strict';
/* 장단콩축제 교통 상황판 — 임진각 반경 3D(파주 3D 맵 자료) + 지금 파주 실시간(도로·인파·주차·CCTV) */

const FEST = { start: '2026-11-27', end: '2026-11-29' };
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
const fmtDist = (m) => (m < 1000 ? Math.round(m / 10) * 10 + 'm' : (m / 1000).toFixed(1) + 'km');
const hhmm = (iso) => { if (!iso) return ''; const d = new Date(iso); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
const isMobile = () => window.innerWidth <= 760;
const viewPad = () => (isMobile() ? { top: 40, bottom: Math.round(window.innerHeight * 0.52) + 8, left: 0, right: 0 } : { top: 0, bottom: 0, left: 384, right: 0 });   // 상황판이 왼쪽(지금 파주와 같은 배치)

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
      // 실시간 도로 색: 추정 구간(옅고 가늘게) 아래, 실측 구간 위
      // 굵기는 바탕 도로(같은 등급)와 같게 — 더 가늘면 흰 바탕 도로가 가장자리로 비쳐 '빈 곳'처럼 보였다. 멀리선 최소 굵기 보장
      { id: 'tr-est', type: 'line', source: 'traffic', filter: ['==', ['get', 'k'], 'est'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['get', 'c'], 'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 11, ['match', ['get', 'r'], 1, 2.6, 2, 2.4, 2.0], 14, ['match', ['get', 'r'], 1, 5, 2, 4.4, 3.4], 17, ['match', ['get', 'r'], 1, 22, 2, 19, 3, 16, 4, 12, 8]] } },
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
  const cam = { center: [VENUE[0] + 0.016, VENUE[1] - 0.014], zoom: isMobile() ? 12.5 : 13.0, pitch: 50, bearing: 25, padding: viewPad() };
  if (animate) map.flyTo({ ...cam, duration: 1800, essential: true }); else map.jumpTo(cam);
}

// ---- 실시간 자료 ----
async function getJSON(u) { const r = await fetch(u, { cache: 'no-store' }); if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); }

function drawTraffic() {
  if (!ROADGEO.length || !ROADS.length) return;
  ROADGEO._for = null;
  const { measured, inherit, roadAvg, split, smooth } = computeColors(LINK_SPD);
  const hasColor = (i) => measured[i] != null || roadAvg[ROADGEO[i].n] != null || inherit[i] != null || split[i] != null;
  const near = (p) => distM(p[1], p[0]) <= R * 1.15;
  let curH = 5;                                                          // 지금 그리는 도로 등급(선 굵기를 바탕 도로와 같게)
  const feats = [], line = (pts, c, k) => feats.push({ type: 'Feature', properties: { c: k === 'est' ? mixWhite(c, 0.22) : c, k, r: curH }, geometry: { type: 'LineString', coordinates: pts.map((p) => [p[1], p[0]]) } });
  const byName = {}, nameAll = {};
  ROADGEO.forEach((r, i) => {                                           // 같은 이름 도로의 반경 안 실측 평균(빈 조각 채우기용)
    const a = measured[i]; if (!a || !r.n || !r.p.some(near)) return;
    (nameAll[r.n] = nameAll[r.n] || []).push(a.reduce((x, y) => x + y, 0) / a.length);
  });
  const nameAvg = (n) => { const a = nameAll[n]; return a ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null; };                                                     // 반경 안 구간의 실측값을 도로 이름별로 모은다(패널용)
  ROADGEO.forEach((r, i) => {
    if (r.p.length < 2 || !r.p.some(near)) return;
    curH = r.h || 5;
    // 왕복 분리도로: 지금 파주(2D)는 한 줄만 그리지만, 3D에선 바탕 도로가 보여 반대 차로가 흰 줄로 비었다 → 두 줄 다,
    //   색은 computeColors가 이미 두 방향 중 더 막히는 쪽으로 맞춰 둔 값이라 규칙(더 막히는 쪽 색)은 그대로
    const arr = measured[i], own = arr ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
    if (own != null && r.n && (r.h || 5) <= 4 && !/회차로/.test(r.n)) {   // 패널: 간선(지방도까지)만 — 시내 골목은 원래 느려 '정체'로 보인다
      const b = byName[r.n] = byName[r.n] || { v: [], d: 1e9 };
      b.v.push(own); b.d = Math.min(b.d, ...r.p.map((q) => distM(q[1], q[0])));
    }
    if (own == null && split[i]) {                                       // 나들목: 앞뒤 절반을 각 끝 색으로
      const m = Math.max(1, Math.floor(r.p.length / 2));
      line(r.p.slice(0, m + 1), spdColor(split[i].a), 'est'); line(r.p.slice(m), spdColor(split[i].b), 'est');
      return;
    }
    const v = smooth[i] ?? (own != null ? own : (roadAvg[r.n] ?? inherit[i] ?? nameAvg(r.n)));   // 마지막: 같은 이름 도로 평균(옅게)
    if (v == null) return;
    line(r.p, spdColor(v), own != null ? 'real' : 'est');
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
  let ph = null, pv = -1; tr.forEach((x) => { if (x.avgSum > pv) { pv = x.avgSum; ph = x.h; } });
  $('#v-peak').textContent = ph != null ? ph + '시' : '-';
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
  if (p.avail == null) return 'na';
  if (p.avail > 0) { const r = p.avail / p.total; return r >= 0.3 ? 'ok' : (r >= 0.1 ? 'mid' : 'low'); }
  return p.seen24 ? 'full' : 'na';
}
const PK_COL = { ok: '#2fa876', mid: '#d9a62e', low: '#d94f3d', full: '#b3271b', na: '#a39d91' };
const PK_TXT = { ok: '여유', mid: '보통', low: '혼잡', full: '만차', na: '빈자리 안내 없음' };
function renderParking(pk) {
  const lots = LOTS = (pk.lots || []).map((p) => ({ ...p, d: distM(p.lng, p.lat) })).filter((p) => p.d <= R).sort((a, b) => a.d - b.d);
  $('#pk-asof').textContent = pk.asof ? hhmm(pk.asof) + ' 기준' : '';
  $('#lots').innerHTML = lots.length ? lots.map((p, i) => {
    const st = pkState(p);
    const val = st === 'na' ? '<span class="av na">안내 없음</span>'
      : st === 'full' ? '<span class="av full">만차</span>'
        : `<span class="av ${st} num"><b>${fmt(p.avail)}</b>/${fmt(p.total)}</span>`;
    return `<button class="pkrow" data-i="${i}" title="지도에서 보기"><span class="tag">${(p.bf || p.af || p.dd) ? '유료' : '무료'}</span><span class="nm">${esc(p.n.replace(/\s*주차장$/, ''))}</span><span class="d num">${fmtDist(p.d)}</span>${val}</button>`;
  }).join('') : '<div class="empty">반경 안 실시간 주차장 없음</div>';
  $('#lots').querySelectorAll('.pkrow').forEach((el) => { el.onclick = () => flyToLot(LOTS[+el.dataset.i]); });
  pkMarkers.forEach((m) => m.remove());
  pkMarkers = lots.map((p) => {
    const st = pkState(p), el = document.createElement('div');
    el.className = 'mk pk'; el.style.setProperty('--c', PK_COL[st]);
    el.innerHTML = `<b>P</b>${st === 'na' ? '' : fmt(p.avail)}`;
    el.title = p.n;
    el.onclick = (e) => { e.stopPropagation(); flyToLot(p); };
    return new maplibregl.Marker({ element: el, anchor: 'top', offset: [0, 6] }).setLngLat([p.lng, p.lat]).addTo(map);   // 축제장 표시(위)와 겹치지 않게 아래로
  });
}

let camMarkers = [], CAMS = [];
const camName = (n) => String(n || '').replace(/^\[[^\]]*\]\s*/, '').replace(/^파주\s*/, '');
const camRoute = (n) => ((String(n || '').match(/^\[([^\]]*)\]/) || [])[1] || '').replace(/\s+/g, ' ');
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
    return new maplibregl.Marker({ element: el }).setLngLat([c.lng, c.lat]).addTo(map);
  });
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
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
  map.on('load', () => {
    document.querySelectorAll('.maplibregl-ctrl-attrib').forEach((a) => a.classList.remove('maplibregl-compact-show'));
    homeView(false);
    const el = document.createElement('div');
    el.className = 'mk venue'; el.textContent = '축제장 · 임진각 평화누리';
    el.onclick = () => homeView(true);
    new maplibregl.Marker({ element: el, anchor: 'bottom', offset: [0, -4] }).setLngLat(VENUE).addTo(map);
    loadLive();
    setInterval(() => { dayChip(); loadLive(); }, 300000);
  });
  $('#reload').onclick = loadLive;
  $('#m-x').onclick = closeCam;
  $('#modal').onclick = (e) => { if (e.target.id === 'modal') closeCam(); };
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCam(); });
}
