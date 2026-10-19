'use strict';
// 지금 파주 첫 화면용 — 파주 3D 맵 v3 app.js(회사 PC 10-16)를 함수 안에 가두고 window.V3로 꺼낸 것.
//   바뀐 곳: 자료 위치(/v3/), 없는 패널 요소는 빈 칸으로, 패널 여백 없음, 시작은 V3.start(컨테이너)로.
(function () {
/* 파주 3D 맵 — MapLibre GL 5 + 브이월드 건물 + OSM + Mapterhorn 지형 */

const BASE = '/v3/';
const EXAG = 1.5;                       // 지형 과장 배율
const NOEL = document.createElement('div');
const $ = (s) => document.querySelector(s) || NOEL;   // 지금 파주에 없는 v3 패널 요소는 빈 칸으로
const fmt = (n) => Number(n).toLocaleString('ko-KR');

// ---------- 건물 용도 분류 (build_data.py USE_CAT과 같은 번호) ----------
const USE = {
  2: { name: '공동주택', plan: '#f4f2ec', wall: '#f7f4ec', win: '#7f9cb7', roof: '#d9d4c8', cols: 4 },
  1: { name: '단독주택', plan: '#efc6a9', wall: '#f3d9c2', win: '#8ea7bc', roof: '#c9775b', cols: 2 },
  3: { name: '상업·숙박', plan: '#e28e6d', wall: '#f1c6a9', win: '#6c8ca8', roof: '#d7a58a', cols: 3 },
  4: { name: '업무', plan: '#89a5d7', wall: '#bcd0e8', win: '#557696', roof: '#9fb4cc', cols: 5 },
  5: { name: '공공·교육·의료·문화', plan: '#9cc787', wall: '#dcebc9', win: '#7598ad', roof: '#a9c48f', cols: 3 },
  6: { name: '산업·물류·운수', plan: '#a8b1c3', wall: '#dde1e8', win: '#9aa6b6', roof: '#b9c0cb', cols: 1 },
  7: { name: '농업·축사', plan: '#d3c389', wall: '#ebe0b6', win: '#bba978', roof: '#c2b27a', cols: 1 },
  0: { name: '용도 미등록', plan: '#dcdad4', wall: '#efe9dc', win: '#9db1c2', roof: '#cdc5b5', cols: 2 },
};
const USE_ORDER = [2, 1, 3, 4, 5, 6, 7, 0];
// ---------- 건축연도(사용승인일) 구간 — 색 기준 '건축연도'일 때 ----------
const YEAR = [
  { name: '1979년 이전', to: 1979, plan: '#7d5b3e' },
  { name: '1980년대', to: 1989, plan: '#a97c52' },
  { name: '1990년대', to: 1999, plan: '#d2ad78' },
  { name: '2000년대', to: 2009, plan: '#a9c3a0' },
  { name: '2010년대', to: 2019, plan: '#6ea5b9' },
  { name: '2020년 이후', to: 9999, plan: '#3d6d9c' },
  { name: '연도 없음', to: 0, plan: '#dcdad4' },
];
const yearBin = (y) => (y ? YEAR.findIndex((b) => b.to && y <= b.to) : YEAR.length - 1);

// ---------- 화면 모드별 색 ----------
const MODE = {
  plan: {
    bg: '#e8ebe7', land: '#f1f0eb', water: '#a9cde3', wline: '#8fbdd8', road: '#ffffff', roadMajor: '#fdf1d8',
    casing: '#cfcdc6', mask: '#f3f4f1', maskOp: 0.62, bridge: '#e6e2d8',
    lc: { forest: '#cde0bd', park: '#c2dfa9', grass: '#d6e8c2', wetland: '#cfe3d6', farm: '#ebe8d2', urban: '#ebe8e2', industrial: '#e4e1e7' },
    hs: { shadow: '#7d8378', highlight: '#ffffff', accent: '#9aa392', ex: 0.28 },
    sky: { 'sky-color': '#bcd8ee', 'horizon-color': '#eef3f6', 'fog-color': '#eef1f1', 'sky-horizon-blend': 0.7, 'horizon-fog-blend': 0.6, 'fog-ground-blend': 0.75 },
  },
  illust: {
    bg: '#efe6d2', land: '#efe7d3', water: '#8ec7e6', wline: '#7bb8dc', road: '#fbf8f1', roadMajor: '#fff3d6',
    casing: '#c9bda4', mask: '#f5efe1', maskOp: 0.55, bridge: '#f3e8d2',
    lc: { forest: '#9fcb80', park: '#a9d58c', grass: '#c3e2a2', wetland: '#b9dcc5', farm: '#e6dcaf', urban: '#efe5d0', industrial: '#e4dccb' },
    hs: { shadow: '#5b7a48', highlight: '#fffbe8', accent: '#7fa35e', ex: 0.5 },
    sky: { 'sky-color': '#6fa9df', 'horizon-color': '#d8ecf6', 'fog-color': '#e7eef0', 'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.55, 'fog-ground-blend': 0.8 },
  },
  sat: {
    bg: '#2a3138', land: '#000000', water: '#3f6f8f', wline: '#5f8fb0', road: '#ffffff', roadMajor: '#ffe7b0',
    casing: '#00000000', mask: '#0f141a', maskOp: 0.42, bridge: '#e9e6df',
    lc: null, hs: null,
    sky: { 'sky-color': '#8fb7d9', 'horizon-color': '#dde8ee', 'fog-color': '#c9d3d8', 'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.5, 'fog-ground-blend': 0.7 },
  },
};

// 화풍 3종(10-16) — 3D 화풍판(styles.ts)의 땅·물·도로·건물 색을 v3 지도 모드로 옮긴 것. 지도 기능은 도면·일러스트와 똑같다(그림만 다름)
Object.assign(MODE, {
  real: { bg: '#c6d3dd', land: '#a9a58d', water: '#3f6378', wline: '#4f7488', road: '#76787b', roadMajor: '#62656a', casing: '#a7a39a', mask: '#d7dcde', maskOp: 0.5, bridge: '#b5b1a9',
    lc: { forest: '#465f35', park: '#6a8a4a', grass: '#879c64', wetland: '#738f7b', farm: '#a3a274', urban: '#b3aea2', industrial: '#a9a6a0' },
    hs: { shadow: '#3c4030', highlight: '#f2efe2', accent: '#5a6046', ex: 0.55 },
    sky: { 'sky-color': '#4f86c6', 'horizon-color': '#dbe6ee', 'fog-color': '#d3dde4', 'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.55, 'fog-ground-blend': 0.08 },
    osm: { 'raster-saturation': -0.7, 'raster-opacity': 0.8, 'raster-contrast': -0.05, 'raster-brightness-min': 0.12, 'raster-brightness-max': 0.88, 'raster-hue-rotate': 0 },
    win: '#6f8aa3', lit: 0, leaf: ['#4a6a34', '#577a3c', '#3d5c2c'], light: { color: '#fff6ea', intensity: 0.46, position: [1.3, 215, 46] },
    wall: ['#d4cfc4', '#d8c4a8', '#e6e3dc', '#d7d4cd', '#b7c2cc', '#e1d9c8', '#c6c9cc', '#d3cdbb'], roof: ['#99958d', '#8b5b45', '#b5b1a9', '#9fa2a5', '#8995a1', '#a3a08f', '#8d9aa5', '#c2c7c6'] },
  paint: { bg: '#e9f1f2', land: '#b6d57c', water: '#68b6d8', wline: '#7cc0de', road: '#f7f1e3', roadMajor: '#f4ecd8', casing: '#d4c39d', mask: '#f3f1e4', maskOp: 0.45, bridge: '#f3e8d2',
    lc: { forest: '#5d9d4a', park: '#7dbb5a', grass: '#a2cd6f', wetland: '#8cc4a4', farm: '#dccf86', urban: '#e7ddc4', industrial: '#ddd6c6' },
    hs: { shadow: '#4f7a3e', highlight: '#fffbe8', accent: '#7fa35e', ex: 0.5 },
    sky: { 'sky-color': '#4f9fe3', 'horizon-color': '#f6f2e2', 'fog-color': '#e9f1f2', 'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.55, 'fog-ground-blend': 0.15 },
    osm: { 'raster-saturation': -0.35, 'raster-opacity': 0.7, 'raster-contrast': -0.2, 'raster-brightness-min': 0.3, 'raster-brightness-max': 1, 'raster-hue-rotate': 0 },
    win: '#6f91b0', lit: 0, leaf: ['#5ea24b', '#7cbc5c', '#4e9142'], light: { color: '#fff3dc', intensity: 0.32, position: [1.2, 200, 38] },
    wall: ['#efe7d8', '#f5ead4', '#f7f2e6', '#f3dfc6', '#e4edf1', '#f0f1de', '#e8e4da', '#f1e6c6'], roof: ['#c9785a', '#c4513d', '#d98263', '#3f8f8b', '#5c87b6', '#6f9f5a', '#8aa0b3', '#b98c4f'] },
  ash: { bg: '#8d857e', land: '#8c876c', water: '#4c6470', wline: '#5d7480', road: '#bdb095', roadMajor: '#b4a78c', casing: '#6b604f', mask: '#8f8476', maskOp: 0.5, bridge: '#b8b1a3',
    lc: { forest: '#3d4d32', park: '#55643e', grass: '#72764d', wetland: '#5e6a59', farm: '#978c60', urban: '#8b8478', industrial: '#827e77' },
    hs: { shadow: '#2b2830', highlight: '#e8c9a8', accent: '#594a3b', ex: 0.6 },
    sky: { 'sky-color': '#2c323d', 'horizon-color': '#d98a55', 'fog-color': '#8d857e', 'sky-horizon-blend': 0.7, 'horizon-fog-blend': 0.7, 'fog-ground-blend': 0.15 },
    osm: { 'raster-saturation': -0.9, 'raster-opacity': 0.85, 'raster-contrast': 0.05, 'raster-brightness-min': 0.05, 'raster-brightness-max': 0.62, 'raster-hue-rotate': 25 },
    win: '#3a3a40', lit: 0.12, leaf: ['#4a5638', '#5a6444', '#3e4a30'], light: { color: '#eadfd6', intensity: 0.42, position: [1.4, 250, 58] },
    wall: ['#aaa69e', '#b8b0a2', '#b2aea6', '#aca69a', '#a3a3a0', '#b4ae9f', '#9a9893', '#a9a395'], roof: ['#7a6a5c', '#8a5a44', '#6e665e', '#74584a', '#6b6560', '#7a6650', '#5f5f5f', '#80705a'] },
});
const ART = ['real', 'paint', 'ash'];
const WALL_IDX = { 2: 0, 1: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 0: 7 };   // styleCol과 같은 용도 순서
const OSM0 = { 'raster-saturation': -0.85, 'raster-opacity': 0.75, 'raster-contrast': -0.15, 'raster-brightness-min': 0.2, 'raster-brightness-max': 1, 'raster-hue-rotate': 0 };   // v3 원래 톤
const LIGHT0 = { anchor: 'viewport', color: '#ffffff', intensity: 0.5, position: [1.15, 210, 30] };   // MapLibre 기본(도면·일러스트)
const styleCol = (arr) => ['match', ['get', 'u'], 2, arr[0], 1, arr[1], 3, arr[2], 4, arr[3], 5, arr[4], 6, arr[5], 7, arr[6], arr[7]];
// 지금 모드가 화풍이면(용도 색 기준일 때) 건물 벽·지붕을 화풍 색으로
const mWall = (f) => { const m = MODE[state.mode]; return m && m.wall && state.color !== 'year' ? styleCol(m.wall) : f(); };
const mRoof = () => { const m = MODE[state.mode]; return m && m.roof ? styleCol(m.roof) : roofColor(); };
const state = { mode: 'plan', useOn: new Set(USE_ORDER), color: 'use', yearOn: new Set(YEAR.map((b, i) => i)) };
try { if (localStorage.getItem('paju3d.color') === 'year') state.color = 'year'; } catch (e) { /* 저장소 없음 */ }
// 표시 요소 체크 칸: 키 → 이름·지도 층
const ELEMENTS = [
  { k: 'bld', name: '건물', layers: ['bld', 'bld-far', 'bld-ill', 'bld-roof'] },
  { k: 'tree', name: '나무', layers: ['trees'] },
  { k: 'bridge', name: '다리', layers: ['bridge'] },
  { k: 'road', name: '도로', layers: ['road', 'road-case', 'road-center'] },
  { k: 'rail', name: '철도', layers: ['rail-base', 'rail-dash', 'rail-tunnel'] },
  { k: 'water', name: '하천·호수', layers: ['water', 'waterline', 'water-edge'] },
  { k: 'green', name: '숲·농지', layers: ['landcover', 'landcover-pat'] },
  { k: 'shade', name: '산 음영', layers: ['hillshade'] },
  { k: 'terrain', name: '지형 입체', layers: [] },
  { k: 'bnd', name: '시·읍면동 경계', layers: ['bnd', 'bnd-case', 'emd-line'] },
  { k: 'car', name: '차량', layers: [] },
  { k: 'train', name: '열차', layers: [] },
  { k: 'lm', name: '명소 이름', layers: [] },
  { k: 'emd', name: '읍면동 이름', layers: [] },
];
state.show = Object.fromEntries(ELEMENTS.map((e) => [e.k, true]));
try { Object.assign(state.show, JSON.parse(localStorage.getItem('paju3d.show') || '{}')); } catch (e) { /* 저장소 없음 */ }
// 지형 과장: 멀리서(줌 12 이하) 1.5배 → 가까이(줌 15.5 이상) 1배(실제 높이). 비탈 건물이 땅에 묻혀 잘려 보이는 것을 줄임
const exagAt = (z) => EXAG - (EXAG - 1) * Math.max(0, Math.min(1, (z - 12) / 3.5));
const ex = () => (state.show.terrain ? (map && map.terrain ? map.terrain.exaggeration : exagAt(map ? map.getZoom() : 10)) : 0);   // 현재 지형 배율(입체 끄면 0)
function syncExag() {
  if (!map || !map.terrain) return;
  const e = exagAt(map.getZoom());
  if (Math.abs(map.terrain.exaggeration - e) > 0.005) { map.terrain.exaggeration = e; map.triggerRepaint(); }
}
let map, DATA = {}, ELEV = null, pajuBox = null;

// ---------- 좌표 도구 (파주 중심 기준 평면 미터) ----------
const LAT0 = 37.83, LON0 = 126.83;
const KX = 111320 * Math.cos(LAT0 * Math.PI / 180), KY = 110574;
const toM = (ll) => [(ll[0] - LON0) * KX, (ll[1] - LAT0) * KY];
const toLL = (m) => [m[0] / KX + LON0, m[1] / KY + LAT0];

function elevAt(lon, lat) {
  if (!ELEV) return 0;
  const [x0, y0, x1, y1] = ELEV.bbox;
  const fx = (lon - x0) / (x1 - x0) * (ELEV.w - 1), fy = (y1 - lat) / (y1 - y0) * (ELEV.h - 1);
  if (fx < 0 || fy < 0 || fx > ELEV.w - 1 || fy > ELEV.h - 1) return 0;
  const i = Math.floor(fx), j = Math.floor(fy), a = fx - i, b = fy - j;
  const z = ELEV.z, i1 = Math.min(i + 1, ELEV.w - 1), j1 = Math.min(j + 1, ELEV.h - 1);
  return (z[j][i] * (1 - a) + z[j][i1] * a) * (1 - b) + (z[j1][i] * (1 - a) + z[j1][i1] * a) * b;
}

async function getJSON(name) {
  // 지금 파주 첫 화면은 실시간 자료 요청이 함께 몰려 한두 개가 끊길 수 있어 세 번까지 다시 받는다
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(BASE + 'data/' + name);
      if (!r.ok) throw new Error(name + ' ' + r.status);
      return await r.json();
    } catch (e) {
      if (i >= 3) throw e;
      await new Promise((ok) => setTimeout(ok, 600 * (i + 1)));
    }
  }
}

function unpackBuildings(p) {
  const fs = new Array(p.g.length);
  for (let i = 0; i < p.g.length; i++) {
    const g = p.g[i], ring = [];
    let x = 0, y = 0;
    for (let j = 0; j < g.length; j += 2) { x += g[j]; y += g[j + 1]; ring.push([x / 1e6, y / 1e6]); }
    ring.push(ring[0]);
    const yr = p.y ? p.y[i] : 0;
    fs[i] = { type: 'Feature', id: i, properties: { i, u: p.u[i], h: p.h[i], f: p.f[i], n: p.n[i] || '', y: yr, yb: yearBin(yr) }, geometry: { type: 'Polygon', coordinates: [ring] } };
  }
  DATA.reg = { r: p.r || {}, P: p.P || [], S: p.S || [] };      // 건축물대장 요약(누르면 보여 줄 것만)
  return { type: 'FeatureCollection', features: fs };
}

// ---------- 일러스트 모드 그림 (창문 무늬·나무) ----------
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function shade(hex, k) {
  const n = parseInt(hex.slice(1, 7), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)));
  return '#' + [n >> 16 & 255, n >> 8 & 255, n & 255].map(f).map((v) => v.toString(16).padStart(2, '0')).join('');
}
function windowPattern(u, pal) {
  // 128px 한 장 = 4개 층(층당 32px), 지도에는 pixelRatio 4로 넣어 화면 크기는 그대로·세밀도만 4배
  //   pal(화풍): 벽·유리 색을 바꾸고, lit 비율만큼 창에 불을 켠다(잿빛 성곽)
  const s = pal ? { ...USE[u], wall: pal.wall, win: pal.win } : USE[u], S = 128, c = mkCanvas(S, S), g = c.getContext('2d');
  g.fillStyle = s.wall; g.fillRect(0, 0, S, S);
  if (u === 6 || u === 7) {                                                   // 공장·축사: 골강판 세로줄 + 높은 띠창
    g.fillStyle = shade(s.wall, -0.07);
    for (let x = 0; x < S; x += 6) g.fillRect(x, 0, 2, S);
    for (let r = 0; r < 4; r += 2) {
      const y = r * 32;
      g.fillStyle = shade(s.win, -0.4); g.fillRect(6, y + 9, S - 12, 12);
      const gr = g.createLinearGradient(0, y + 10, 0, y + 20); gr.addColorStop(0, shade(s.win, 0.45)); gr.addColorStop(1, s.win);
      g.fillStyle = gr; g.fillRect(7, y + 10, S - 14, 10);
      g.fillStyle = shade(s.win, -0.3); for (let x = 7; x < S - 7; x += 14) g.fillRect(x, y + 10, 1, 10);
    }
    return g.getImageData(0, 0, S, S);
  }
  const cols = s.cols, cw = S / cols;
  for (let r = 0; r < 4; r++) {
    const y = r * 32;
    g.fillStyle = shade(s.wall, 0.35); g.fillRect(0, y + 27, S, 1);           // 층 띠 윗선(밝게)
    g.fillStyle = shade(s.wall, -0.1); g.fillRect(0, y + 28, S, 4);            // 층 띠(슬래브)
    for (let k = 0; k < cols; k++) {
      const x = k * cw;
      const ww = u === 4 ? cw - 4 : Math.min(cw - 10, u === 2 ? 24 : 18), x0 = Math.round(x + (cw - ww) / 2);
      const wy = u === 4 ? y + 3 : y + 7, wh = u === 4 ? 23 : 15;
      g.fillStyle = shade(s.win, -0.5); g.fillRect(x0 - 1, wy - 1, ww + 2, wh + 2);   // 창틀
      const gr = g.createLinearGradient(0, wy, 0, wy + wh);
      gr.addColorStop(0, shade(s.win, 0.5)); gr.addColorStop(0.55, s.win); gr.addColorStop(1, shade(s.win, -0.15));
      g.fillStyle = gr; g.fillRect(x0, wy, ww, wh);
      g.fillStyle = 'rgba(255,255,255,.28)';                                        // 유리 반사 사선
      g.beginPath(); g.moveTo(x0 + ww * 0.15, wy + wh); g.lineTo(x0 + ww * 0.45, wy); g.lineTo(x0 + ww * 0.62, wy); g.lineTo(x0 + ww * 0.32, wy + wh); g.fill();
      g.fillStyle = shade(s.win, -0.35); g.fillRect(x0 + Math.floor(ww / 2), wy, 1, wh);  // 가운데 창살
      if (u !== 4) { g.fillStyle = shade(s.wall, 0.45); g.fillRect(x0 - 2, wy + wh + 1, ww + 4, 2); }  // 창턱
      if (u === 2) { g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(x0 - 3, wy + wh - 4, ww + 6, 1); }  // 발코니 난간
      if (pal && pal.lit && ((r * 7 + k * 13 + u * 3) % 20) < pal.lit * 20) {                           // 불 켜진 창(고정 무늬)
        const lg = g.createLinearGradient(0, wy, 0, wy + wh); lg.addColorStop(0, '#ffe2a8'); lg.addColorStop(1, '#f0a050');
        g.fillStyle = lg; g.fillRect(x0, wy, ww, wh);
      }
    }
  }
  return g.getImageData(0, 0, S, S);
}
function treeIcon(body, dark, kind) {
  // 96x120 = 화면 24x30 (pixelRatio 4)
  const c = mkCanvas(96, 120), g = c.getContext('2d');
  g.fillStyle = 'rgba(40,60,30,.2)'; g.beginPath(); g.ellipse(48, 113, 24, 6, 0, 0, Math.PI * 2); g.fill();
  const trunk = g.createLinearGradient(42, 0, 54, 0); trunk.addColorStop(0, '#7a5a3c'); trunk.addColorStop(1, '#9b7650');
  g.fillStyle = trunk; g.fillRect(43, 70, 10, 42);
  const blob = (x, y, r, col) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
  if (kind === 'pine') {                                                       // 침엽수: 세 겹 원뿔
    for (let i = 0; i < 3; i++) {
      const y0 = 18 + i * 22, w = 22 + i * 9;
      g.fillStyle = dark; g.beginPath(); g.moveTo(48, y0 - 6); g.lineTo(48 + w, y0 + 34); g.lineTo(48 - w, y0 + 34); g.fill();
      g.fillStyle = body; g.beginPath(); g.moveTo(48, y0 - 6); g.lineTo(48 + w * 0.15, y0 + 32); g.lineTo(48 - w, y0 + 32); g.fill();
    }
    g.strokeStyle = shade(dark, -0.35); g.lineWidth = 2; g.beginPath(); g.moveTo(48, 12); g.lineTo(79, 86); g.stroke();
    return g.getImageData(0, 0, 96, 120);
  }
  blob(48, 50, 34, dark); blob(34, 60, 22, dark); blob(63, 60, 22, dark);
  blob(44, 42, 26, body); blob(60, 50, 18, body); blob(32, 54, 16, body);
  blob(38, 32, 10, shade(body, 0.3)); blob(56, 38, 6, shade(body, 0.22));
  g.strokeStyle = shade(dark, -0.35); g.lineWidth = 2.2; g.beginPath(); g.arc(48, 50, 34, 0.25, Math.PI - 0.25); g.stroke();
  return g.getImageData(0, 0, 96, 120);
}
// 일러스트 땅 무늬(반투명, 바탕색 위에 겹침)
function groundPattern(kind) {
  const c = mkCanvas(64, 64), g = c.getContext('2d');
  if (kind === 'farm') {                                                       // 논밭 이랑
    g.strokeStyle = 'rgba(92,120,58,.22)'; g.lineWidth = 2;
    for (let i = -64; i < 128; i += 10) { g.beginPath(); g.moveTo(i, 64); g.lineTo(i + 64, 0); g.stroke(); }
  } else {                                                                     // 숲·공원 잎 점
    const pts = [[8, 10], [30, 6], [52, 14], [18, 30], [42, 34], [60, 44], [10, 50], [34, 56], [50, 60]];
    pts.forEach(([x, y], i) => { g.fillStyle = i % 2 ? 'rgba(46,96,44,.16)' : 'rgba(255,255,230,.18)'; g.beginPath(); g.arc(x, y, i % 3 ? 4 : 5, 0, Math.PI * 2); g.fill(); });
  }
  return g.getImageData(0, 0, 64, 64);
}

// 공원·숲 안에 나무 점 뿌리기
function makeTrees(landcover) {
  const pts = [];
  const area = (ring) => { let s = 0; for (let i = 0; i < ring.length - 1; i++) { const a = toM(ring[i]), b = toM(ring[i + 1]); s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s) / 2; };
  const inRing = (x, y, r) => { let o = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) o = !o; } return o; };
  let rnd = 12345; const rand = () => (rnd = (rnd * 1103515245 + 12345) % 2147483648) / 2147483648;
  const polys = landcover.features.filter((f) => f.properties.k === 'park' || f.properties.k === 'forest');
  const tot = { park: 0, forest: 0 };
  polys.forEach((f) => { f._a = area(f.geometry.coordinates[0]); tot[f.properties.k] += f._a; });
  const dens = { park: Math.min(1 / 220, 26000 / (tot.park || 1)), forest: Math.min(1 / 1800, 60000 / (tot.forest || 1)) };
  for (const f of polys) {
    const ring = f.geometry.coordinates[0], n = Math.round(f._a * dens[f.properties.k]);
    if (!n) continue;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [x, y] of ring) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    let made = 0, tries = 0;
    while (made < n && tries < n * 6) {
      tries++;
      const x = x0 + (x1 - x0) * rand(), y = y0 + (y1 - y0) * rand();
      if (!inRing(x, y, ring)) continue;
      pts.push({ type: 'Feature', properties: { v: f.properties.k === 'forest' && rand() < 0.35 ? 2 : (rand() < 0.5 ? 0 : 1), s: 0.75 + rand() * 0.5 }, geometry: { type: 'Point', coordinates: [x, y] } });
      made++;
    }
  }
  return { type: 'FeatureCollection', features: pts };
}

// ---------- 지도 스타일 ----------
// 파일로 열면(file://) 출처가 없어 OSM 공식 서버가 403 'Access blocked' 이미지를 준다 → 같은 OSM 지도의 독일 공식 미러 사용
const OSM_TILES = location.protocol === 'file:' ? 'https://tile.openstreetmap.de/{z}/{x}/{y}.png' : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
// 노선색(OSM 노선 관계의 colour): 경의·중앙선 #6AC2B3, GTX-A #AB087D
const LINE_COLOR = ['case', ['in', '수도권', ['get', 'n']], '#AB087D', '#6AC2B3'];
// 같은 용도 안에서도 건물마다 살짝 다른 톤(번호 i의 나머지로 3단)
const varColor = (pick) => ['match', ['get', 'u']].concat(...USE_ORDER.map((u) => { const c = pick(u); return [u, ['match', ['%', ['get', 'i'], 3], 0, shade(c, -0.05), 1, c, shade(c, 0.07)]]; }), ['#dcdad4']);
const roofPlan = () => varColor((u) => shade(USE[u].plan, 0.28));
const roofIll = () => varColor((u) => USE[u].roof);
const yearVar = (pick) => ['match', ['get', 'yb']].concat(...YEAR.map((b, k) => { const c = pick(b); return [k, ['match', ['%', ['get', 'i'], 3], 0, shade(c, -0.05), 1, c, shade(c, 0.07)]]; }), ['#dcdad4']);
// 색 기준(용도·건축연도)에 따라 벽·지붕·먼 건물 색
const wallColor = () => (state.color === 'year' ? yearVar((b) => b.plan) : varColor((u) => USE[u].plan));
const roofColor = () => (state.color === 'year' ? yearVar((b) => shade(b.plan, 0.28)) : (state.mode === 'illust' ? roofIll() : roofPlan()));
const farColor = () => (state.color === 'year' ? ['match', ['get', 'yb']].concat(...YEAR.map((b, k) => [k, b.plan]), ['#dcdad4']) : ['match', ['get', 'u']].concat(...USE_ORDER.map((u) => [u, USE[u].plan]), ['#dcdad4']));
const selColor = (base) => ['case', ['boolean', ['feature-state', 'sel'], false], '#ffc02e', base];   // 선택 건물: 용도 색과 겹치지 않는 노랑
function buildStyle() {
  const m = MODE.plan;
  const sources = {
    osm: { type: 'raster', tiles: [OSM_TILES], tileSize: 256, maxzoom: 19, attribution: '지도 © OpenStreetMap contributors' },
    dem: { type: 'raster-dem', tiles: [BASE + 'data/dem/{z}/{x}/{y}.webp'], tileSize: 512, maxzoom: 12, encoding: 'terrarium', bounds: pajuBox, attribution: '지형 © Mapterhorn' },
    demhs: { type: 'raster-dem', tiles: [BASE + 'data/dem/{z}/{x}/{y}.webp'], tileSize: 512, maxzoom: 12, encoding: 'terrarium', bounds: pajuBox },
    boundary: { type: 'geojson', data: DATA.boundary },
    mask: { type: 'geojson', data: DATA.mask },
    emd: { type: 'geojson', data: DATA.emd },
    landcover: { type: 'geojson', data: DATA.landcover, tolerance: 0.6 },
    water: { type: 'geojson', data: DATA.water, tolerance: 0.5 },
    waterline: { type: 'geojson', data: DATA.waterline },
    roads: { type: 'geojson', data: DATA.roads, tolerance: 0.4 },
    rail: { type: 'geojson', data: DATA.rail },
    bridges: { type: 'geojson', data: DATA.bridges },
    buildings: { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, maxzoom: 15, tolerance: 0.25, buffer: 16, promoteId: 'i', attribution: '건물·경계 © 국토교통부 VWorld' },
    trees: { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, maxzoom: 14 },
    traffic: { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, maxzoom: 16, buffer: 4 },
    sel: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
  };
  if (window.VWORLD_KEY) {
    sources.sat = { type: 'raster', tiles: ['https://api.vworld.kr/req/wmts/1.0.0/' + window.VWORLD_KEY + '/Satellite/{z}/{y}/{x}.jpeg'], tileSize: 256, maxzoom: 19, attribution: '위성 © 국토교통부 VWorld' };
  }
  const rk = (vals) => ['match', ['get', 'r'], 1, vals[0], 2, vals[1], 3, vals[2], 4, vals[3], 5, vals[4], vals[5]];
  const roadW = ['interpolate', ['exponential', 1.6], ['zoom'], 9, rk([1.3, 1.1, 0.8, 0.5, 0, 0]), 13, rk([4, 3.4, 2.8, 2.2, 1.4, 0.8]), 18, rk([30, 26, 22, 17, 12, 8])];
  const caseW = ['interpolate', ['exponential', 1.6], ['zoom'], 9, rk([2.2, 1.9, 1.5, 1, 0, 0]), 13, rk([6, 5.2, 4.4, 3.6, 2.6, 1.6]), 18, rk([34, 30, 25, 20, 14.5, 10])];
  const lcColor = (lc) => ['match', ['get', 'k'], 'forest', lc.forest, 'park', lc.park, 'grass', lc.grass, 'wetland', lc.wetland, 'farm', lc.farm, 'industrial', lc.industrial, lc.urban];
  const layers = [
    { id: 'bg', type: 'background', paint: { 'background-color': m.bg } },
    { id: 'osm', type: 'raster', source: 'osm', paint: { 'raster-saturation': -0.85, 'raster-opacity': 0.75, 'raster-contrast': -0.15, 'raster-brightness-min': 0.2 } },
  ];
  if (sources.sat) layers.push({ id: 'sat', type: 'raster', source: 'sat', layout: { visibility: 'none' } });
  layers.push(
    { id: 'land', type: 'fill', source: 'boundary', paint: { 'fill-color': m.land } },
    { id: 'landcover', type: 'fill', source: 'landcover', paint: { 'fill-color': lcColor(m.lc), 'fill-antialias': false } },
    { id: 'landcover-pat', type: 'fill', source: 'landcover', minzoom: 11, filter: ['in', ['get', 'k'], ['literal', ['farm', 'forest', 'park']]], layout: { visibility: 'none' }, paint: { 'fill-pattern': ['match', ['get', 'k'], 'farm', 'pat-farm', 'pat-green'], 'fill-antialias': false } },
    { id: 'hillshade', type: 'hillshade', source: 'demhs', paint: { 'hillshade-exaggeration': m.hs.ex, 'hillshade-shadow-color': m.hs.shadow, 'hillshade-highlight-color': m.hs.highlight, 'hillshade-accent-color': m.hs.accent } },
    { id: 'water', type: 'fill', source: 'water', paint: { 'fill-color': m.water } },
    { id: 'water-edge', type: 'line', source: 'water', minzoom: 12, paint: { 'line-color': shade(m.water, -0.22), 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.6, 17, 1.8] } },
    { id: 'waterline', type: 'line', source: 'waterline', paint: { 'line-color': m.wline, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, ['match', ['get', 'k'], 1, 1.2, 0.4], 16, ['match', ['get', 'k'], 1, 6, 2.5]] } },
    { id: 'road-case', type: 'line', source: 'roads', minzoom: 9, layout: { 'line-cap': 'round', 'line-join': 'round', 'line-sort-key': ['-', 10, ['get', 'r']] }, paint: { 'line-color': m.casing, 'line-width': caseW } },
    { id: 'road', type: 'line', source: 'roads', minzoom: 9, layout: { 'line-cap': 'round', 'line-join': 'round', 'line-sort-key': ['-', 10, ['get', 'r']] }, paint: { 'line-color': ['case', ['<=', ['get', 'r'], 2], m.roadMajor, m.road], 'line-width': roadW } },
    { id: 'road-center', type: 'line', source: 'roads', minzoom: 15, filter: ['all', ['<=', ['get', 'r'], 4], ['!=', ['get', 'o'], 1]], paint: { 'line-color': '#e9b949', 'line-width': ['interpolate', ['linear'], ['zoom'], 15, 0.6, 18, 2] } },
    { id: 'rail-tunnel', type: 'line', source: 'rail', filter: ['==', ['get', 't'], 1], paint: { 'line-color': LINE_COLOR, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.4, 17, 5], 'line-dasharray': [1.5, 1.5], 'line-opacity': 0.75 } },
    { id: 'rail-base', type: 'line', source: 'rail', filter: ['==', ['get', 't'], 0], paint: { 'line-color': LINE_COLOR, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.2, 17, 5] } },
    { id: 'rail-dash', type: 'line', source: 'rail', filter: ['==', ['get', 't'], 0], paint: { 'line-color': '#ffffff', 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.6, 17, 2.6], 'line-dasharray': [3, 3] } },
    { id: 'sel-fill', type: 'fill', source: 'sel', paint: { 'fill-color': '#f0863a', 'fill-opacity': 0.14 } },
    { id: 'sel-ring', type: 'line', source: 'sel', paint: { 'line-color': '#f0863a', 'line-width': 3, 'line-dasharray': [2, 1.2] } },
    { id: 'mask', type: 'fill', source: 'mask', paint: { 'fill-color': m.mask, 'fill-opacity': m.maskOp } },
    { id: 'emd-line', type: 'line', source: 'emd', minzoom: 9, maxzoom: 15, paint: { 'line-color': '#8d968e', 'line-width': 0.9, 'line-dasharray': [3, 2], 'line-opacity': 0.55 } },
    { id: 'bnd-case', type: 'line', source: 'boundary', paint: { 'line-color': '#ffffff', 'line-width': 5, 'line-opacity': 0.9 } },
    { id: 'bnd', type: 'line', source: 'boundary', paint: { 'line-color': '#e0793a', 'line-width': 2 } },
    { id: 'trees', type: 'symbol', source: 'trees', minzoom: 13.2, layout: { visibility: 'none', 'icon-image': ['match', ['get', 'v'], 0, 'tree0', 1, 'tree1', 'tree2'], 'icon-anchor': 'bottom', 'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-pitch-alignment': 'viewport', 'icon-size': ['interpolate', ['exponential', 1.6], ['zoom'], 13.2, ['*', ['get', 's'], 0.18], 16, ['*', ['get', 's'], 0.6], 18, ['*', ['get', 's'], 1.5]] } },
    { id: 'bridge', type: 'fill-extrusion', source: 'bridges', minzoom: 11.5, paint: { 'fill-extrusion-color': ['case', ['==', ['get', 'k'], 1], '#c6ccd4', m.bridge], 'fill-extrusion-base': ['get', 'b'], 'fill-extrusion-height': ['get', 't'], 'fill-extrusion-opacity': 1 } },
    { id: 'bld-far', type: 'fill-extrusion', source: 'buildings', minzoom: 9, maxzoom: 13, filter: ['>=', ['get', 'h'], 24], paint: { 'fill-extrusion-color': selColor(farColor()), 'fill-extrusion-height': ['get', 'h'], 'fill-extrusion-opacity': 0.95 } },
    { id: 'bld', type: 'fill-extrusion', source: 'buildings', minzoom: 13, paint: { 'fill-extrusion-color': selColor(wallColor()), 'fill-extrusion-height': ['get', 'h'], 'fill-extrusion-opacity': 1, 'fill-extrusion-vertical-gradient': true } },
    { id: 'bld-ill', type: 'fill-extrusion', source: 'buildings', minzoom: 13, layout: { visibility: 'none' }, paint: { 'fill-extrusion-pattern': ['concat', 'win', ['to-string', ['get', 'u']]], 'fill-extrusion-height': ['get', 'h'], 'fill-extrusion-opacity': 1, 'fill-extrusion-vertical-gradient': true } },
    { id: 'bld-roof', type: 'fill-extrusion', source: 'buildings', minzoom: 13, paint: { 'fill-extrusion-color': selColor(roofColor()), 'fill-extrusion-base': ['get', 'h'], 'fill-extrusion-height': ['+', ['get', 'h'], 0.5] } },
    { id: 'traffic', type: 'fill-extrusion', source: 'traffic', minzoom: 12.5, paint: { 'fill-extrusion-color': ['get', 'c'], 'fill-extrusion-height': ['get', 'h'], 'fill-extrusion-base': ['get', 'b'], 'fill-extrusion-opacity': 1 } },
  );
  return {
    version: 8, sources, layers,
    terrain: state.show.terrain ? { source: 'dem', exaggeration: EXAG } : undefined,
    sky: m.sky,
  };
}

// ---------- 모드 전환 (스타일 재생성 없이 속성만 바꿔 깜박임 없음) ----------

// ---------- 가상 성벽(잿빛 성곽 화풍일 때만, 장식 — 실제 시설 아님) ----------
//   3D 화풍판 castle.ts처럼 파주 경계를 따라 높이 90m·두께 22m 벽(멀리서도 보이게 화풍판보다 키움)을 세우고, 위에 성가퀴(톱니)를 얹는다. 지형 위에 선다
function castleData() {
  const kx = 111320 * Math.cos(37.83 * Math.PI / 180), ky = 110574, T = 11;
  const wall = [], crest = [];
  const quad = (a, b, t0, t1, out) => {
    const dx = (b[0] - a[0]) * kx, dy = (b[1] - a[1]) * ky, L = Math.hypot(dx, dy);
    if (L < 1) return;
    const nx = -dy / L * T / kx, ny = dx / L * T / ky;
    const p = (q, s) => [a[0] + (b[0] - a[0]) * q + nx * s, a[1] + (b[1] - a[1]) * q + ny * s];
    out.push({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[p(t0, 1), p(t1, 1), p(t1, -1), p(t0, -1), p(t0, 1)]] } });
  };
  DATA.boundary.features.forEach((f) => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates).forEach((poly) => {
    const r = poly[0];
    for (let i = 0; i + 1 < r.length; i++) {
      const a = r[i], b = r[i + 1];
      quad(a, b, -0.02, 1.02, wall);                       // 이음매가 벌어지지 않게 조금 겹쳐 그린다
      const L = Math.hypot((b[0] - a[0]) * kx, (b[1] - a[1]) * ky), n = Math.floor(L / 24);
      for (let k = 0; k < n; k += 2) quad(a, b, k / Math.max(n, 1), (k + 1) / Math.max(n, 1), crest);   // 24m마다 톱니
    }
  }));
  return { wall: { type: 'FeatureCollection', features: wall }, crest: { type: 'FeatureCollection', features: crest } };
}
function showCastle(on) {
  if (!map) return;
  if (on && !map.getSource('castle-wall')) {
    const d = castleData();
    map.addSource('castle-wall', { type: 'geojson', data: d.wall });
    map.addSource('castle-crest', { type: 'geojson', data: d.crest });
    // 멀리서도 성곽이 보이게: 경계를 따라 굵은 돌담 선(가까이 오면 가늘어지고 3D 벽이 대신한다)
    map.addSource('castle-line', { type: 'geojson', data: DATA.boundary });
    map.addLayer({ id: 'castle-line-case', type: 'line', source: 'castle-line', layout: { 'line-join': 'round' }, paint: { 'line-color': '#4a4038', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 5, 11, 8, 13, 3], 'line-opacity': ['interpolate', ['linear'], ['zoom'], 12, 0.9, 14, 0] } });
    map.addLayer({ id: 'castle-line', type: 'line', source: 'castle-line', layout: { 'line-join': 'round' }, paint: { 'line-color': '#c9bca4', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 2.5, 11, 5, 13, 1.5], 'line-dasharray': [2, 1], 'line-opacity': ['interpolate', ['linear'], ['zoom'], 12, 1, 14, 0] } });
    map.addLayer({ id: 'castle-wall', type: 'fill-extrusion', source: 'castle-wall', paint: { 'fill-extrusion-color': '#b9ad98', 'fill-extrusion-height': 90, 'fill-extrusion-base': 0, 'fill-extrusion-opacity': 1, 'fill-extrusion-vertical-gradient': true } });
    map.addLayer({ id: 'castle-crest', type: 'fill-extrusion', source: 'castle-crest', paint: { 'fill-extrusion-color': '#a39782', 'fill-extrusion-height': 102, 'fill-extrusion-base': 90, 'fill-extrusion-opacity': 1 } });
  }
  ['castle-line-case', 'castle-line', 'castle-wall', 'castle-crest'].forEach((id) => map.getLayer(id) && map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none'));
}
function setMode(mode) {
  state.mode = mode;
  const m = MODE[mode];
  const paint = (id, k, v) => map.getLayer(id) && map.setPaintProperty(id, k, v);
  paint('bg', 'background-color', m.bg);
  paint('land', 'fill-color', m.land);
  if (m.lc) paint('landcover', 'fill-color', ['match', ['get', 'k'], 'forest', m.lc.forest, 'park', m.lc.park, 'grass', m.lc.grass, 'wetland', m.lc.wetland, 'farm', m.lc.farm, 'industrial', m.lc.industrial, m.lc.urban]);
  if (m.hs) { paint('hillshade', 'hillshade-exaggeration', m.hs.ex); paint('hillshade', 'hillshade-shadow-color', m.hs.shadow); paint('hillshade', 'hillshade-highlight-color', m.hs.highlight); paint('hillshade', 'hillshade-accent-color', m.hs.accent); }
  paint('water', 'fill-color', m.water);
  paint('water-edge', 'line-color', shade(m.water, -0.22));
  paint('water', 'fill-opacity', mode === 'sat' ? 0 : 1);
  paint('waterline', 'line-color', m.wline);
  paint('waterline', 'line-opacity', mode === 'sat' ? 0 : 1);
  paint('road', 'line-color', ['case', ['<=', ['get', 'r'], 2], m.roadMajor, m.road]);
  paint('road', 'line-opacity', mode === 'sat' ? 0.45 : 1);
  paint('road-case', 'line-color', m.casing);
  paint('mask', 'fill-color', m.mask);
  paint('mask', 'fill-opacity', m.maskOp);
  paint('bld-roof', 'fill-extrusion-color', selColor(mRoof()));
  paint('bld', 'fill-extrusion-color', selColor(mWall(wallColor)));
  paint('bld-far', 'fill-extrusion-color', selColor(mWall(farColor)));
  paint('bridge', 'fill-extrusion-color', ['case', ['==', ['get', 'k'], 1], '#c6ccd4', m.bridge]);
  map.setSky(m.sky);
  const art = ART.includes(mode);
  if (map.getLayer('bld-ill')) map.setPaintProperty('bld-ill', 'fill-extrusion-pattern', ['concat', art ? 'win-' + mode + '-' : 'win', ['to-string', ['get', 'u']]]);
  if (map.getLayer('trees')) map.setLayoutProperty('trees', 'icon-image', ['match', ['get', 'v'], 0, art ? 'tree0-' + mode : 'tree0', 1, art ? 'tree1-' + mode : 'tree1', art ? 'tree2-' + mode : 'tree2']);
  map.setLight(art ? { anchor: 'map', ...m.light } : LIGHT0);
  Object.entries(art ? m.osm : OSM0).forEach(([k, v]) => paint('osm', k, v));   // 파주 밖 바탕도 화풍 톤으로
  applyVisibility();
  showCastle(mode === 'ash');
  document.querySelectorAll('#seg-style button').forEach((b) => b.classList.toggle('on', b.dataset.style === mode));
}

// 건물 색 기준: 용도 ↔ 건축연도(속성만 바꿔 깜박임 없음)
function setColorBy(c) {
  state.color = c;
  try { localStorage.setItem('paju3d.color', c); } catch (e) { /* 저장소 없음 */ }
  const paint = (id, k, v) => map.getLayer(id) && map.setPaintProperty(id, k, v);
  paint('bld', 'fill-extrusion-color', selColor(mWall(wallColor)));
  paint('bld-roof', 'fill-extrusion-color', selColor(mRoof()));
  paint('bld-far', 'fill-extrusion-color', selColor(mWall(farColor)));
  applyUseFilter();
  applyVisibility();
  buildLegend();
}

// 모드 조건과 체크 칸을 함께 보고 층마다 보이기 결정
function applyVisibility() {
  const mode = state.mode, owner = {};
  ELEMENTS.forEach((e) => e.layers.forEach((id) => { owner[id] = e.k; }));
  const modeOk = (id) => {
    if (id === 'sat') return mode === 'sat';
    if (['osm', 'land', 'landcover', 'hillshade'].includes(id)) return mode !== 'sat';
    const win = mode === 'illust' || ART.includes(mode);       // 일러스트·화풍은 창 무늬 건물
    if (id === 'bld') return !win || state.color === 'year';
    if (id === 'bld-ill') return win && state.color !== 'year';
    if (id === 'landcover-pat') return mode === 'illust' || mode === 'paint';
    if (id === 'water-edge') return mode !== 'sat';
    return true;
  };
  map.getStyle().layers.forEach((l) => {
    const on = modeOk(l.id) && (!owner[l.id] || state.show[owner[l.id]]);
    if ((map.getLayoutProperty(l.id, 'visibility') || 'visible') !== (on ? 'visible' : 'none')) map.setLayoutProperty(l.id, 'visibility', on ? 'visible' : 'none');
  });
  const hasT = !!map.getTerrain();
  if (hasT !== state.show.terrain) map.setTerrain(state.show.terrain ? { source: 'dem', exaggeration: exagAt(map.getZoom()) } : null);
  syncExag();
  document.body.classList.toggle('hide-lm', !state.show.lm);
  document.body.classList.toggle('hide-emd', !state.show.emd);
  if (sim.cars.length) renderSim();
}

function applyUseFilter() {
  const on = state.color === 'year' ? ['in', ['get', 'yb'], ['literal', [...state.yearOn]]] : ['in', ['get', 'u'], ['literal', [...state.useOn]]];
  ['bld', 'bld-ill', 'bld-roof'].forEach((id) => map.setFilter(id, on));
  map.setFilter('bld-far', ['all', ['>=', ['get', 'h'], 24], on]);
}

// ---------- 이름표 ----------
const markers = { lm: [], emd: [] };
function addLabels() {
  DATA.spots.forEach((l, i) => {
    const box = document.createElement('div'), el = document.createElement('div');
    el.className = 'lm' + (l.tour ? ' tour' : '') + (l.st ? ' st' : '');
    el.textContent = l.name;
    box.appendChild(el);
    box.style.zIndex = l.tour ? 3 : 2;
    el.addEventListener('click', (e) => { e.stopPropagation(); flyToSpot(l); });
    l._el = el;
    markers.lm.push(new maplibregl.Marker({ element: box, anchor: 'bottom', offset: [0, -6] }).setLngLat([l.lon, l.lat]).addTo(map));
  });
  DATA.emd.features.forEach((f) => {
    const box = document.createElement('div'), el = document.createElement('div');
    el.className = 'emd';
    el.textContent = f.properties.name;
    box.appendChild(el);
    box._dong = /동$/.test(f.properties.name);
    markers.emd.push(new maplibregl.Marker({ element: box, anchor: 'center' }).setLngLat(f.properties.lp).addTo(map));
  });
  const upd = () => {
    const z = map.getZoom();
    markers.emd.forEach((m) => { const d = m.getElement()._dong; m.getElement().style.display = z > (d ? 11.4 : 9.3) && z < 13.6 ? '' : 'none'; });
    markers.lm.forEach((m, i) => { const s = DATA.spots[i]; m.getElement().style.display = (s.tour || z > (s.st ? 13.5 : 12.5)) ? '' : 'none'; });
  };
  map.on('zoomend', upd); upd();
  // 많이 기울이면 수평선 너머 이름표가 하늘에 떠 보인다 — 땅 위가 아닌 자리에 찍히는 이름표는 숨긴다(10-19, 지금 파주)
  const cull = () => {
    const t = map.transform, tilt = map.getPitch() > 50 && t.isPointOnMapSurface;
    markers.emd.concat(markers.lm).forEach((m) => { const on = !tilt || t.isPointOnMapSurface(map.project(m.getLngLat())); m.getElement().style.visibility = on ? '' : 'hidden'; });
  };
  map.on('move', cull); map.on('moveend', cull);
  map.on('moveend', tidyLabels);
  setTimeout(tidyLabels, 300);
}

// 이름표 겹침 정리(지금 파주 tidyLabels와 같은 규칙: 반대쪽 → 위 → 아래 → 숨김)
function tidyLabels() {
  if (tour.on) return;   // 투어 중엔 매 프레임 이동이라 건너뜀
  const items = [];
  DATA.spots.forEach((s, i) => { const m = markers.lm[i]; if (m) items.push({ el: m.getElement().firstChild, pr: s._el && s._el.classList.contains('now') ? 0 : s.tour ? 1 + i * 0.01 : 3 }); });
  markers.emd.forEach((m) => items.push({ el: m.getElement().firstChild, pr: 5 }));
  items.forEach((it) => { it.el.style.translate = ''; it.el.style.visibility = ''; });
  const shown = items.filter((it) => it.el.parentElement.style.display !== 'none' && it.el.offsetParent).sort((a, b) => a.pr - b.pr);
  const placed = [];
  const hit = (r) => placed.some((p) => r.left < p.right + 2 && r.right > p.left - 2 && r.top < p.bottom + 2 && r.bottom > p.top - 2);
  for (const it of shown) {
    const r0 = it.el.getBoundingClientRect(), h = r0.height + 4;
    let ok = false;
    for (const dy of [0, -h, h, -2 * h]) {
      const r = { left: r0.left, right: r0.right, top: r0.top + dy, bottom: r0.bottom + dy };
      if (!hit(r)) { if (dy) it.el.style.translate = '0 ' + dy + 'px'; placed.push(r); ok = true; break; }
    }
    if (!ok) it.el.style.visibility = 'hidden';
  }
}

// ---------- 건물 색 범례(용도 또는 건축연도) ----------
function buildLegend() {
  const meta = DATA.meta, lg = $('#legend'), yr = state.color === 'year';
  document.querySelectorAll('#seg-color button').forEach((b) => b.classList.toggle('on', b.dataset.c === state.color));
  lg.innerHTML = '';
  const yc = DATA.bfc ? YEAR.map((b, k) => DATA.bfc.features.reduce((a, f) => a + (f.properties.yb === k ? 1 : 0), 0)) : null;
  (yr ? YEAR.map((b, k) => k) : USE_ORDER).forEach((k) => {
    const li = document.createElement('li'), on = yr ? state.yearOn : state.useOn;
    li.innerHTML = '<i style="background:' + (yr ? YEAR[k].plan : USE[k].plan) + '"></i><span></span><span></span>';
    li.children[1].textContent = yr ? YEAR[k].name : USE[k].name;
    li.children[2].textContent = yr ? (yc ? fmt(yc[k]) : '-') : fmt(meta.use[String(k)] || 0);
    li.classList.toggle('off', !on.has(k));
    li.onclick = () => {
      if (on.has(k)) on.delete(k); else on.add(k);
      li.classList.toggle('off', !on.has(k));
      applyUseFilter();
    };
    lg.appendChild(li);
  });
  const note = document.createElement('li');
  note.innerHTML = '<span class="note" style="grid-column:1/-1"></span>';
  note.firstChild.textContent = yr ? '항목을 누르면 해당 연대만 끄고 켭니다. 건축연도는 건축물대장 사용승인일.'
    : '항목을 누르면 해당 용도만 끄고 켭니다. 높이는 건물통합정보 높이, 없으면 건축물대장 높이, 둘 다 없으면 지상층수×3.3m.';
  note.style.cursor = 'default';
  lg.appendChild(note);
}

// ---------- 패널 ----------
function buildPanel() {
  const meta = DATA.meta;
  $('#sub').textContent = '파주시 전역 ' + meta.area_km2 + ' km² · 건물 ' + fmt(meta.buildings) + '동';
  // 명소 목록
  const ul = $('#spots');
  const tourList = DATA.landmarks.filter((l) => l.tour);
  DATA.landmarks.forEach((l) => {
    const li = document.createElement('li');
    const no = l.tour ? String(tourList.indexOf(l) + 1).padStart(2, '0') : '·';
    li.innerHTML = '<span class="no">' + no + '</span><div><b></b><small></small></div>';
    li.querySelector('b').textContent = l.name;
    li.querySelector('small').textContent = l.desc;
    li.onclick = () => flyToSpot(l);
    l._li = li;
    ul.appendChild(li);
  });
  // 노선별 역: 접힌 채로 맨 아래, 누르면 펼침
  DATA.stations.forEach((g) => {
    const li = document.createElement('li');
    li.className = 'line closed';
    li.innerHTML = '<div class="line-h"><i></i><b></b><span class="cnt"></span><span class="tog">+</span></div><ul class="line-st"></ul>';
    li.querySelector('i').style.background = g.line.startsWith('GTX') ? '#AB087D' : '#6AC2B3';
    li.querySelector('b').textContent = g.line;
    li.querySelector('.cnt').textContent = g.objs.length + '역';
    li.querySelector('.line-h').onclick = () => {
      li.classList.toggle('closed');
      li.querySelector('.tog').textContent = li.classList.contains('closed') ? '+' : '−';
      if (li.classList.contains('closed')) return;
      stopTour(); clearSpot();
      if (g.objs.length === 1) { flyToSpot(g.objs[0]); return; }
      const xs = g.objs.map((s) => s.lon), ys = g.objs.map((s) => s.lat);
      map.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], { padding: { top: 80, bottom: 80, left: spotPad().left + 60, right: 60 }, pitch: 45, bearing: -15, duration: 2600, essential: true });
    };
    const sub = li.querySelector('.line-st');
    g.objs.forEach((s) => {
      const r = document.createElement('li');
      r.textContent = s.name;
      r.onclick = (e) => { e.stopPropagation(); flyToSpot(s); };
      s._li = r;
      sub.appendChild(r);
    });
    ul.appendChild(li);
  });
  buildLegend();
  document.querySelectorAll('#seg-color button').forEach((b) => b.onclick = () => setColorBy(b.dataset.c));
  // 데이터 구성
  // 항목 | 출처 | 수량 세 칸(없는 값은 '-'), 추정·과장 안내는 표 아래 한 줄
  const rows = [
    ['건물', 'VWorld 건물통합정보', fmt(meta.buildings) + '동'],
    ['건축물대장', '국토교통부 건축HUB', meta.reg ? fmt(meta.reg) + '동 연결' : '-'],
    ['경계', 'VWorld 행정경계', meta.emd + '개 읍면동'],
    ['도로', 'OpenStreetMap', fmt(meta.roads) + '구간'],
    ['철도·역', 'OpenStreetMap', DATA.spots.filter((s) => s.st).length + '역'],
    ['다리', 'OpenStreetMap', fmt(DATA.bridges.features.length) + '곳'],
    ['물·녹지', 'OpenStreetMap', '-'],
    ['명소', 'OpenStreetMap', DATA.landmarks.length + '곳'],
    ['지형', 'Mapterhorn', '-'],
    ['바탕', 'OSM · VWorld 위성', '-'],
  ];
  $('#src').innerHTML = rows.map(() => '<tr><td></td><td></td><td></td></tr>').join('');
  $('#src').querySelectorAll('tr').forEach((tr, i) => rows[i].forEach((v, j) => { tr.children[j].textContent = v; }));
  $('#src-note').textContent = '다리 높이는 추정값, 지형은 멀리서 볼 때만 ' + EXAG + '배 과장';
  $('#src-foot').textContent = meta.built + ' 생성 · 만든이 이대희';
  // 접기
  document.querySelectorAll('.fold h2').forEach((h) => h.onclick = () => {
    const s = h.parentElement; s.classList.toggle('closed');
    h.querySelector('.tog').textContent = s.classList.contains('closed') ? '+' : '−';
  });
  // 버튼
  document.querySelectorAll('.btns button').forEach((b) => b.onclick = () => {
    const a = b.dataset.act;
    if (a === 'tour') { tour.on ? stopTour() : startTour(); return; }
    stopTour();
    clearSpot();
    if (a === 'overview') overview();
  });
  document.querySelectorAll('#seg-style button').forEach((b) => b.onclick = () => setMode(b.dataset.style));
  document.querySelectorAll('#seg-quality button').forEach((b) => {
    b.classList.toggle('on', b.dataset.q === state.quality);
    b.onclick = () => {
      try { localStorage.setItem('paju3d.quality', b.dataset.q); } catch (e) { /* 저장소 없음 */ }
      map.setPixelRatio(qualityRatio());
      document.querySelectorAll('#seg-quality button').forEach((x) => x.classList.toggle('on', x === b));
    };
  });
  if (!window.VWORLD_KEY) { $('#seg-style [data-style=sat]').remove(); $('#seg-style').style.gridTemplateColumns = 'repeat(2,1fr)'; }
  $('#line-legend').innerHTML = '<span><i style="background:#6AC2B3"></i>경의중앙선·경의선</span><span><i style="background:#AB087D"></i>GTX-A(점선은 지하)</span>';
  const box = $('#layer-chks');
  ELEMENTS.forEach((e) => {
    const lb = document.createElement('label'), cb = document.createElement('input');
    lb.className = 'chk'; cb.type = 'checkbox'; cb.checked = state.show[e.k];
    cb.onchange = () => { state.show[e.k] = cb.checked; saveShow(); applyVisibility(); };
    lb.append(cb, document.createTextNode(e.name));
    box.appendChild(lb);
  });
  const all = (on) => { ELEMENTS.forEach((e) => { state.show[e.k] = on; }); box.querySelectorAll('input').forEach((c) => { c.checked = on; }); saveShow(); applyVisibility(); };
  $('#chk-all').onclick = () => all(true);
  $('#chk-none').onclick = () => all(false);
}

// 화질: 화면 배율 대비 렌더 배율(보통 1배·선명 1.5배·고선명 2배) — 높을수록 선이 매끈하지만 그래픽 부담 큼
function qualityRatio() {
  let q = 'high';
  try { q = localStorage.getItem('paju3d.quality') || 'high'; } catch (e) { /* 저장소 없음 */ }
  state.quality = q;
  const d = window.devicePixelRatio || 1;
  return Math.min(4, d * ({ normal: 1, high: 1.5, max: 2 }[q] || 1.5));
}
function saveShow() { try { localStorage.setItem('paju3d.show', JSON.stringify(state.show)); } catch (e) { /* 저장소 없음 */ } }
function panelPad() { return window.innerWidth > 760 ? { top: 40, bottom: 40, left: 40, right: 40 } : { top: 20, bottom: 20, left: 12, right: 12 }; }   // 지금 파주는 패널이 지도 밖
// 전체 조감: 파주 경계가 패널을 뺀 영역 한가운데·여백 고르게 오도록 화면에 실제로 투영해 보며 맞춤(보이지 않게 계산 후 되돌림)
function overviewCamera() {
  const prev = { center: map.getCenter(), zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing(), padding: map.getPadding() };
  const ring = DATA.boundary.features[0].geometry.coordinates[0][0];
  const pad = spotPad(), W = map.getCanvas().clientWidth, Hh = map.getCanvas().clientHeight;
  const c0 = map.cameraForBounds([[pajuBox[0] + 0.08, pajuBox[1] + 0.08], [pajuBox[2] - 0.08, pajuBox[3] - 0.08]], { padding: pad, bearing: -14 });
  const cam = { center: [c0.center.lng, c0.center.lat], zoom: c0.zoom, pitch: 55, bearing: -14, padding: pad };
  for (let k = 0; k < 4; k++) {
    map.jumpTo(cam);
    const ps = ring.map((p) => map.project(p)), xs = ps.map((p) => p.x), ys = ps.map((p) => p.y);
    const bx = (Math.min(...xs) + Math.max(...xs)) / 2, by = (Math.min(...ys) + Math.max(...ys)) / 2;
    const cx = pad.left + (W - pad.left) / 2, cy = (Hh - pad.bottom) / 2;
    const fill = Math.max((Math.max(...xs) - Math.min(...xs)) / (W - pad.left - 80), (Math.max(...ys) - Math.min(...ys)) / (Hh - pad.bottom - 80));
    const nc = map.unproject([bx, by]);   // 지금 경계 한가운데에 있는 땅을 새 중심으로
    cam.center = [map.getCenter().lng + (nc.lng - map.unproject([cx, cy]).lng), map.getCenter().lat + (nc.lat - map.unproject([cx, cy]).lat)];
    cam.zoom += Math.log2(1 / fill) * 0.9;
  }
  map.jumpTo(prev);
  return cam;
}
function overview() {
  map.flyTo({ ...overviewCamera(), duration: 2800, essential: true });
}
// 명소 선택: 패널을 뺀 지도 영역 정중앙에 두고 같은 각도(기울기 55°, 북쪽 기준 -15°)로 멈춤
const WIDE = /산$|호수|출판도시|LG|평화누리|헤이리|습지|수목원|프로방스/;   // 넓은 곳은 한 단계 멀리
const NO_PAD = { top: 0, bottom: 0, left: 0, right: 0 };
// 지도에서 패널이 가리지 않는 영역: 넓은 화면은 왼쪽 패널, 휴대폰은 아래 서랍(화면 높이 44%)
function spotPad() { return window.innerWidth > 900 ? { top: 70, bottom: 20, left: 0, right: 0 } : { top: 110, bottom: 30, left: 0, right: 0 }; }   // 지금 파주: 패널은 지도 밖, 위쪽은 지도 버튼 두 줄만큼
let selIds = [];
function clearSpot() {
  state.sel = null;
  selIds.forEach((id) => map.setFeatureState({ source: 'buildings', id }, { sel: false }));
  selIds = [];
  if (map.getSource('sel')) map.getSource('sel').setData({ type: 'FeatureCollection', features: [] });
  DATA.spots.forEach((l) => { l._el && l._el.classList.remove('now'); l._li && l._li.classList.remove('on'); });
}
function selectSpot(l) {
  clearSpot();
  state.sel = l;
  const wide = WIDE.test(l.name), r = wide ? 220 : 45, c = toM([l.lon, l.lat]), ring = [];
  for (let i = 0; i <= 48; i++) { const a = i / 48 * Math.PI * 2; ring.push(toLL([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r])); }
  map.getSource('sel').setData({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } }] });
  if (!wide && DATA.bfc) {
    // 명소 점이 들어 있는 건물 + 원(반지름 45m) 안에 걸치는 건물, 없으면 80m 안 가장 가까운 건물
    let best = null, bestD = 80;
    for (const f of DATA.bfc.features) {
      const rg = f.geometry.coordinates[0], p0 = toM(rg[0]);
      if (Math.abs(p0[0] - c[0]) > 300 || Math.abs(p0[1] - c[1]) > 300) continue;
      let inside = false;
      for (let i = 0, j = rg.length - 1; i < rg.length; j = i++) {
        const [xi, yi] = rg[i], [xj, yj] = rg[j];
        if ((yi > l.lat) !== (yj > l.lat) && l.lon < (xj - xi) * (l.lat - yi) / (yj - yi) + xi) inside = !inside;
      }
      let d = 1e9;
      if (!inside) for (const p of rg) { const m = toM(p); d = Math.min(d, Math.hypot(m[0] - c[0], m[1] - c[1])); }
      if (inside || d <= r) selIds.push(f.id);
      else if (d < bestD) { bestD = d; best = f.id; }
    }
    if (!selIds.length && best !== null) selIds.push(best);
    selIds.forEach((id) => map.setFeatureState({ source: 'buildings', id }, { sel: true }));
  }
  l._el && l._el.classList.add('now');
  l._li && l._li.classList.add('on');
}
// 산에 가리지 않는 화각 찾기: 기본(기울기 55°·방위 -15°)에서 카메라 쪽으로 지형을 훑어 시선이 막히면
// 방위를 돌려 보고, 그래도 막히면 더 내려다보는 각도로
function spotCamera(l) {
  const zoom = /산$/.test(l.name) ? 14.6 : WIDE.test(l.name) ? 15.3 : 16.7;
  const mpp = 40075016.686 * Math.cos(l.lat * Math.PI / 180) / (512 * Math.pow(2, zoom));
  const dist = 1.5 * window.innerHeight * mpp * 1.15;          // 카메라까지 수평 거리(넉넉히)
  const t = toM([l.lon, l.lat]), tz = elevAt(l.lon, l.lat) * ex();
  const clear = (bearing, pitch) => {
    const rise = Math.tan((90 - pitch) * Math.PI / 180), a = (bearing + 180) * Math.PI / 180;
    for (let d = 40; d <= dist; d += 40) {
      const q = toLL([t[0] + Math.sin(a) * d, t[1] + Math.cos(a) * d]);
      if (elevAt(q[0], q[1]) * ex() > tz + d * rise - 10) return false;
    }
    return true;
  };
  for (const pitch of [55, 45, 35]) {
    for (const bearing of [-15, 25, -55, 65, -95, 105, -135, 145, 180]) {
      if (clear(bearing, pitch)) return { zoom, pitch, bearing };
    }
  }
  return { zoom, pitch: 25, bearing: -15 };
}
function flyToSpot(l) {
  stopTour();
  selectSpot(l);
  // 날아가는 동안 엔진이 중심 높이를 출발지 값으로 고정하므로 목적지 지면 높이를 직접 준다(산꼭대기가 위로 밀리던 원인)
  let elevation = 0;
  if (state.show.terrain) {
    const q = map.queryTerrainElevation([l.lon, l.lat]);
    elevation = elevAt(l.lon, l.lat) * exagAt(spotCamera(l).zoom) || q || 0;
  }
  map.flyTo({ center: [l.lon, l.lat], elevation, ...spotCamera(l), padding: spotPad(), duration: 2600, essential: true });
  // 도착 후 실제 화면 위치를 재서 남은 차이만큼 한 번 더 맞춤(산·언덕 위 명소는 지면 높이 차로 위로 밀림)
  const token = (flyToSpot.n = (flyToSpot.n || 0) + 1);
  map.once('moveend', () => {
    if (token !== flyToSpot.n || tour.on) return;
    const fix = (left) => {
      const p = map.project([l.lon, l.lat]), pad = spotPad();
      const cx = pad.left + (map.getCanvas().clientWidth - pad.left) / 2, cy = (map.getCanvas().clientHeight - pad.bottom) / 2;
      if (left <= 0 || (Math.abs(p.x - cx) < 6 && Math.abs(p.y - cy) < 6)) return;
      map.panBy([p.x - cx, p.y - cy], { duration: 450, essential: true });
      map.once('moveend', () => { if (token === flyToSpot.n) fix(left - 1); });
    };
    fix(5);
  });
}

// ---------- 차량·열차 ----------
const sim = { cars: [], trains: [], last: 0, acc: 0 };
function buildNet(features, ok) {
  const nodes = new Map(), edges = [];
  const key = (p) => Math.round(p[0] * 2e4) + ',' + Math.round(p[1] * 2e4);
  features.forEach((f) => {
    if (!ok(f.properties)) return;
    const pts = f.geometry.coordinates.map(toM);
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const L = cum[cum.length - 1];
    if (L < 5) return;
    const e = { pts, cum, L, r: f.properties.r || 3, one: !!f.properties.o, a: key(f.geometry.coordinates[0]), b: key(f.geometry.coordinates[f.geometry.coordinates.length - 1]) };
    edges.push(e);
    [e.a, e.b].forEach((k) => { if (!nodes.has(k)) nodes.set(k, []); nodes.get(k).push(e); });
  });
  return { nodes, edges };
}
function edgePoint(e, s) {
  s = Math.max(0, Math.min(e.L, s));
  let lo = 0, hi = e.cum.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (e.cum[mid] <= s) lo = mid; else hi = mid; }
  const a = e.pts[lo], b = e.pts[hi], seg = (e.cum[hi] - e.cum[lo]) || 1, t = (s - e.cum[lo]) / seg;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, Math.atan2(b[1] - a[1], b[0] - a[0])];
}
function nextEdge(net, e, dir, rnd) {
  const nodeKey = dir > 0 ? e.b : e.a;
  const opts = (net.nodes.get(nodeKey) || []).filter((x) => x !== e && !(x.one && x.b === nodeKey && x.a !== nodeKey));
  if (!opts.length) return null;
  const same = opts.filter((x) => Math.abs(x.r - e.r) <= 1);
  const pick = (same.length && rnd() < 0.85 ? same : opts);
  const n = pick[Math.floor(rnd() * pick.length)];
  return { e: n, dir: n.a === nodeKey ? 1 : -1 };
}
const CAR_COLORS = ['#f4f5f6', '#f4f5f6', '#c9ced4', '#2d3238', '#3a4f6e', '#b23a33', '#e9e6dc', '#8d969f'];
function initSim() {
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  sim.rnd = rnd;
  sim.road = buildNet(DATA.roads.features, (p) => p.r <= 5);
  const pool = sim.road.edges, wsum = pool.reduce((s, e) => s + e.L * (7 - e.r), 0);
  for (let i = 0; i < 1400; i++) {
    let t = rnd() * wsum, e = pool[0];
    for (const x of pool) { t -= x.L * (7 - x.r); if (t <= 0) { e = x; break; } }
    const v = [0, 26, 21, 16, 13, 10, 8][e.r] * (0.85 + rnd() * 0.3);
    sim.cars.push({ e, dir: e.one ? 1 : (rnd() < 0.5 ? 1 : -1), s: rnd() * e.L, v, c: CAR_COLORS[Math.floor(rnd() * CAR_COLORS.length)], lane: e.r <= 2 ? (rnd() < 0.5 ? 2 : 5.3) : 1.9, len: rnd() < 0.1 ? 10 : 4.6, wid: rnd() < 0.1 ? 2.4 : 1.85, hh: rnd() < 0.1 ? 3 : 1.5 });
  }
  sim.rail = buildNet(DATA.rail.features.filter((f) => !f.properties.t), () => true);
  const big = sim.rail.edges.filter((e) => e.L > 300);
  for (let i = 0; i < Math.min(6, big.length); i++) {
    const e = big[Math.floor(rnd() * big.length)];
    sim.trains.push({ e, dir: rnd() < 0.5 ? 1 : -1, s: rnd() * e.L, v: 22, trail: [], n: 8 });
  }
}
function rect(cx, cy, ang, len, wid) {
  const c = Math.cos(ang), s = Math.sin(ang), hl = len / 2, hw = wid / 2;
  const P = [[hl, hw], [-hl, hw], [-hl, -hw], [hl, -hw]].map(([x, y]) => toLL([cx + x * c - y * s, cy + x * s + y * c]));
  P.push(P[0]);
  return P;
}
function stepSim(dt) {
  const rnd = sim.rnd;
  for (const car of sim.cars) {
    car.s += car.v * dt;
    while (car.s > car.e.L) {
      car.s -= car.e.L;
      const n = nextEdge(sim.road, car.dir > 0 ? car.e : car.e, car.dir, rnd);
      if (n) { car.e = n.e; car.dir = n.dir; }
      else if (!car.e.one) { car.dir = -car.dir; }
      else { car.s = 0; }
    }
  }
  for (const t of sim.trains) {
    t.s += t.v * dt;
    while (t.s > t.e.L) {
      t.s -= t.e.L;
      const n = nextEdge(sim.rail, t.e, t.dir, rnd);
      if (n) { t.e = n.e; t.dir = n.dir; } else { t.dir = -t.dir; t.trail = []; }
    }
    const p = edgePoint(t.e, t.dir > 0 ? t.s : t.e.L - t.s);
    const last = t.trail[t.trail.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > 3) { t.trail.push([p[0], p[1]]); if (t.trail.length > 90) t.trail.shift(); }
  }
}
function renderSim() {
  const fs = [];
  const b = map.getBounds(), pad = 0.01;
  const inView = (ll) => ll[0] > b.getWest() - pad && ll[0] < b.getEast() + pad && ll[1] > b.getSouth() - pad && ll[1] < b.getNorth() + pad;
  if (state.show.car) for (const car of sim.cars) {
    const s = car.dir > 0 ? car.s : car.e.L - car.s;
    const p = edgePoint(car.e, s);
    const ang = p[2] + (car.dir > 0 ? 0 : Math.PI);
    const ox = Math.sin(ang) * car.lane, oy = -Math.cos(ang) * car.lane;   // 진행 방향 오른쪽 차로
    const cx = p[0] + (car.e.one ? 0 : ox), cy = p[1] + (car.e.one ? 0 : oy);
    if (!inView(toLL([cx, cy]))) continue;
    fs.push({ type: 'Feature', properties: { c: car.c, h: car.hh + 0.3, b: 0.3 }, geometry: { type: 'Polygon', coordinates: [rect(cx, cy, ang, car.len, car.wid)] } });
  }
  if (state.show.train) for (const t of sim.trains) {
    const tr = t.trail;
    if (tr.length < 2) continue;
    // 꼬리 쪽으로 20m 간격 차량 배치
    let k = 0, need = 0, i = tr.length - 1, acc = 0;
    while (k < t.n && i > 0) {
      const a = tr[i], c = tr[i - 1], d = Math.hypot(a[0] - c[0], a[1] - c[1]);
      if (acc + d >= need) {
        const f = (need - acc) / (d || 1), x = a[0] + (c[0] - a[0]) * f, y = a[1] + (c[1] - a[1]) * f;
        const ang = Math.atan2(a[1] - c[1], a[0] - c[0]);
        if (inView(toLL([x, y]))) fs.push({ type: 'Feature', properties: { c: k === 0 ? '#2f6db5' : '#e9eef3', h: 4.1, b: 0.6 }, geometry: { type: 'Polygon', coordinates: [rect(x - Math.cos(ang) * 9.6, y - Math.sin(ang) * 9.6, ang, 19, 3.1)] } });
        k++; need += 20;
      } else { acc += d; i--; }
    }
  }
  map.getSource('traffic').setData({ type: 'FeatureCollection', features: fs });
}
function simLoop(ts) {
  const dt = Math.min(0.1, (ts - (sim.last || ts)) / 1000);
  sim.last = ts;
  stepSim(dt);
  sim.acc += dt;
  // 투어 중엔 차량 갱신을 초당 6번으로 줄여 비행이 덜 끊기게
  if ((state.show.car || state.show.train) && map.getZoom() >= 12.5 && sim.acc > (tour.on ? 1 / 6 : 1 / 20)) { sim.acc = 0; renderSim(); }
  requestAnimationFrame(simLoop);
}

// ---------- 헬기투어 ----------
const tour = { on: false, paused: false, s: 0, L: 0, path: [], cum: [], stops: [], raf: 0, last: 0, tgt: null, alt: 0, cur: -1 };
const V_FAST = 760, V_SLOW = 210, PLAY = 10;     // m/s (재생 기준), 배속
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function buildTour() {
  // 지금 파주 첫 화면: 지점 리스트 순서(고른 지점부터)로 날아간다(10-16). 정해 주지 않으면 v3 명소 경로
  const stops = tour.custom && tour.custom.length > 1 ? tour.custom : DATA.landmarks.filter((l) => l.tour);
  const P = stops.map((l) => toM([l.lon, l.lat]));
  const OFF = 420;
  const W = P.map((p, i) => {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    return [p[0] + dy * OFF, p[1] - dx * OFF];
  });
  // 출발 전 진입 구간
  const d0 = [W[1][0] - W[0][0], W[1][1] - W[0][1]], l0 = Math.hypot(...d0);
  W.unshift([W[0][0] - d0[0] / l0 * 2600, W[0][1] - d0[1] / l0 * 2600]);
  const n = W.length, dn = [W[n - 1][0] - W[n - 2][0], W[n - 1][1] - W[n - 2][1]], ln = Math.hypot(...dn);
  W.push([W[n - 1][0] + dn[0] / ln * 1800, W[n - 1][1] + dn[1] / ln * 1800]);
  // Catmull-Rom (centripetal)
  const path = [], stopIdx = [];
  const g = (i) => W[Math.max(0, Math.min(W.length - 1, i))];
  for (let i = 0; i < W.length - 1; i++) {
    const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
    const tj = (a, b, t) => t + Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-3, 0.5);
    const t0 = 0, t1 = tj(p0, p1, t0), t2 = tj(p1, p2, t1), t3 = tj(p2, p3, t2);
    if (i >= 1 && i <= stops.length) stopIdx.push(path.length);
    const N = 80;
    for (let k = 0; k < N; k++) {
      const t = t1 + (t2 - t1) * k / N;
      const L = (pa, pb, ta, tb) => [(tb - t) / (tb - ta) * pa[0] + (t - ta) / (tb - ta) * pb[0], (tb - t) / (tb - ta) * pa[1] + (t - ta) / (tb - ta) * pb[1]];
      const A1 = L(p0, p1, t0, t1), A2 = L(p1, p2, t1, t2), A3 = L(p2, p3, t2, t3);
      const B1 = L(A1, A2, t0, t2), B2 = L(A2, A3, t1, t3);
      path.push(L(B1, B2, t1, t2));
    }
  }
  path.push(W[W.length - 1]);
  const cum = [0];
  for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
  tour.path = path; tour.cum = cum; tour.L = cum[cum.length - 1];
  tour.stops = stops.map((l, i) => ({ l, s: cum[stopIdx[i]], m: P[i] }));
}
function tourAt(s) {
  s = Math.max(0, Math.min(tour.L, s));
  const c = tour.cum;
  let lo = 0, hi = c.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (c[mid] <= s) lo = mid; else hi = mid; }
  const a = tour.path[lo], b = tour.path[hi], t = (s - c[lo]) / ((c[hi] - c[lo]) || 1);
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}
function tourCamera(dt) {
  // 명소 근처에서 감속·저공, 명소를 바라봄
  let w = 0, look = 0, near = null;
  for (const st of tour.stops) {
    const ds = st.s - tour.s;
    const wi = ds >= 0 ? 1 - smooth(500, 1500, ds) : 1 - smooth(150, 800, -ds);
    if (wi > w) { w = wi; near = st; }
    const li = ds >= 0 ? smooth(2300, 1300, ds) * smooth(-50, 450, ds) : 0;
    if (li > look) { look = li; }
  }
  const v = V_FAST + (V_SLOW - V_FAST) * w;
  tour.s += v * dt;
  if (tour.wrapped && tour.s >= tour.start) { stopTour(true); return; }
  if (tour.s >= tour.L) {
    if (tour.start > 0 && !tour.wrapped) { wrapTour(); return; }
    stopTour(true); return;
  }
  const cam = tourAt(tour.s), ahead = tourAt(tour.s + 1500);
  let tgt = ahead;
  const nxt = tour.stops.find((st) => st.s - tour.s > -50);
  if (nxt && look > 0) tgt = [ahead[0] + (nxt.m[0] - ahead[0]) * look, ahead[1] + (nxt.m[1] - ahead[1]) * look];
  const k = 1 - Math.exp(-dt / 0.8);
  tour.tgt = tour.tgt ? [tour.tgt[0] + (tgt[0] - tour.tgt[0]) * k, tour.tgt[1] + (tgt[1] - tour.tgt[1]) * k] : tgt;
  // 고도: 지면 + 여유, 앞쪽 지형도 고려
  const camLL = toLL(cam), tgtLL = toLL(tour.tgt);
  let ground = elevAt(camLL[0], camLL[1]);
  for (const d of [300, 700]) { const q = toLL(tourAt(tour.s + d)); ground = Math.max(ground, elevAt(q[0], q[1]) * (d === 300 ? 1 : 0.85)); }
  const agl = 270 + (175 - 270) * w;
  const want = ground * ex() + agl;
  tour.alt = tour.alt ? tour.alt + (want - tour.alt) * (1 - Math.exp(-dt / 1.1)) : want;
  tour.alt = Math.max(tour.alt, elevAt(camLL[0], camLL[1]) * ex() + 80);
  const opts = map.calculateCameraOptionsFromTo(new maplibregl.LngLat(camLL[0], camLL[1]), tour.alt, new maplibregl.LngLat(tgtLL[0], tgtLL[1]), elevAt(tgtLL[0], tgtLL[1]) * ex());
  map.jumpTo(opts);
  // 화면 글자
  const idx = near && w > 0.25 ? tour.stops.indexOf(near) : -1;
  if (idx !== tour.cur) showStop(idx);
  const agl2 = Math.round((tour.alt - elevAt(camLL[0], camLL[1]) * ex()) / (ex() || 1) / 5) * 5;
  const done = tour.wrapped ? tour.L - tour.start + tour.s : tour.s - tour.start;   // 출발점부터 지금까지(한 바퀴 기준)
  $('#hud-stat').textContent = '시속 ' + Math.round(v / PLAY * 3.6 / 5) * 5 + 'km · 고도 ' + agl2 + 'm · ' + PLAY + '배속 · 비행 ' + (done / 1000).toFixed(1) + ' / ' + (tour.L / 1000).toFixed(0) + 'km';
  $('#hud-bar').style.width = (done / tour.L * 100).toFixed(2) + '%';
}
function showStop(idx) {
  tour.cur = idx;
  const n = $('#hud-name'), d = $('#hud-desc'), i = $('#hud-idx');
  DATA.spots.forEach((l) => l._el && l._el.classList.remove('now'));
  if (idx < 0) { [n, d, i].forEach((e) => e.classList.add('fade')); return; }
  const st = tour.stops[idx];
  i.textContent = String(idx + 1).padStart(2, '0') + ' / ' + String(tour.stops.length).padStart(2, '0');
  n.textContent = st.l.name; d.textContent = st.l.desc;
  [n, d, i].forEach((e) => e.classList.remove('fade'));
  st.l._el && st.l._el.classList.add('now');
}
function tourLoop(ts) {
  const dt = Math.min(0.05, (ts - (tour.last || ts)) / 1000);
  tour.last = ts;
  if (!tour.paused) tourCamera(dt);
  if (tour.on) tour.raf = requestAnimationFrame(tourLoop);
}
function startTour() {
  if (!tour.L) buildTour();
  // 명소를 골라 둔 상태면 그 명소(투어 지점이 아니면 가장 가까운 투어 지점)부터 출발
  let s0 = 0;
  if (state.sel) {
    const m = toM([state.sel.lon, state.sel.lat]);
    const st = tour.stops.reduce((a, b) => (Math.hypot(b.m[0] - m[0], b.m[1] - m[1]) < Math.hypot(a.m[0] - m[0], a.m[1] - m[1]) ? b : a));
    s0 = Math.max(0, st.s - 1400);
  }
  // 투어 중엔 화면 배율 1배(보통)로 그려 끊김을 줄이고, 끝나면 고른 화질로 되돌림
  map.setPixelRatio(window.devicePixelRatio || 1);
  tour.start = s0; tour.wrapped = false;
  tour.on = true; tour.paused = false; tour.s = s0; tour.tgt = null; tour.alt = 0; tour.cur = -2; tour.last = 0; tour.jt = null;
  $('#btn-tour').classList.add('on'); $('#btn-tour').textContent = '투어 중';
  document.body.classList.add('touring');
  $('#hud').classList.add('on'); $('#t-pause').textContent = '일시정지';
  showStop(-1);
  // 첫 화면까지 부드럽게 날아간 뒤 시작
  const c = toLL(tourAt(s0)), t = toLL(tourAt(s0 + 1500));
  const alt = elevAt(c[0], c[1]) * ex() + 270;
  const o = map.calculateCameraOptionsFromTo(new maplibregl.LngLat(c[0], c[1]), alt, new maplibregl.LngLat(t[0], t[1]), elevAt(t[0], t[1]) * ex());
  clearSpot();
  map.setPadding(NO_PAD);
  map.flyTo({ ...o, padding: NO_PAD, duration: 3500, essential: true });
  map.once('moveend', () => { if (tour.on) { tour.alt = alt; tour.raf = requestAnimationFrame(tourLoop); } });
}
// 끝(보광사)에 닿으면 처음(운정)으로 날아가 고른 명소 직전까지 이어 감
function wrapTour() {
  tour.wrapped = true; tour.paused = true; tour.s = 0; tour.tgt = null;
  const c = toLL(tourAt(0)), t = toLL(tourAt(1500));
  const alt = elevAt(c[0], c[1]) * ex() + 270;
  const o = map.calculateCameraOptionsFromTo(new maplibregl.LngLat(c[0], c[1]), alt, new maplibregl.LngLat(t[0], t[1]), elevAt(t[0], t[1]) * ex());
  map.flyTo({ ...o, padding: NO_PAD, duration: 3500, essential: true });
  map.once('moveend', () => { if (tour.on) { tour.alt = alt; tour.paused = false; tour.last = 0; } });
}
function stopTour(finished) {
  if (!tour.on) return;
  tour.on = false; cancelAnimationFrame(tour.raf);
  map.setPixelRatio(qualityRatio());
  $('#btn-tour').classList.remove('on'); $('#btn-tour').textContent = '헬기투어';
  document.body.classList.remove('touring');
  $('#hud').classList.remove('on');
  DATA.spots.forEach((l) => l._el && l._el.classList.remove('now'));
  if (finished) overview();
}
function jumpStop(d) {
  if (!tour.on) return;
  // 기준 지점: 마지막으로 '다음·이전'으로 간 지점(아직 300m 넘게 지나치지 않았으면) → 화면에 보이는 다가가는 지점(1.5km 안) → 이미 지난 마지막 지점.
  //   예전엔 '1.6km 넘게 앞인 지점'을 기준으로 해서, 지점끼리 가까우면(오두산·운정 일대) 같은 지점을 또 골라 제자리였다(10-16)
  const S = tour.stops;
  let base = -1;
  if (tour.jt != null && tour.jt < S.length && tour.s <= S[tour.jt].s + 300) base = tour.jt;
  else {
    const ahead = S.findIndex((st) => st.s > tour.s + 300 && st.s - tour.s <= 1500);
    if (ahead >= 0) base = ahead;
    else S.forEach((st, k) => { if (st.s <= tour.s + 300) base = k; });
  }
  let target = Math.max(0, Math.min(S.length - 1, base + d));
  let pos = S[target].s - 2400;
  if (d > 0 && pos <= tour.s + 200) pos = S[target].s - 500;   // 지점끼리 가까우면 2.4km 앞이 이미 지나온 자리 — 그 지점 바로 앞으로
  tour.s = Math.max(0, pos); tour.tgt = null; tour.jt = target;
}

// ---------- 시작 ----------
async function main(container, onReady) {
  const L = $('#loading');
  L.textContent = '지도 자료 불러오는 중';
  const names = ['meta.json', 'landmarks.json', 'boundary.geojson', 'mask.geojson', 'emd.geojson', 'landcover.geojson', 'water.geojson', 'waterline.geojson', 'roads.geojson', 'rail.geojson', 'bridges.geojson', 'stations.json', 'elev.json'];
  const got = await Promise.all(names.map((n) => getJSON(n).catch(() => null)));
  names.forEach((n, i) => { DATA[n.replace(/\.(geo)?json$/, '')] = got[i]; });
  ELEV = DATA.elev;
  DATA.stations = DATA.stations || [];
  DATA.stations.forEach((g) => { g.objs = g.stations.map((s) => ({ ...s, desc: g.line, tour: 0, st: 1 })); });
  DATA.spots = DATA.landmarks.concat(...DATA.stations.map((g) => g.objs));
  ['landcover', 'water', 'waterline', 'rail', 'bridges'].forEach((k) => { if (!DATA[k]) DATA[k] = { type: 'FeatureCollection', features: [] }; });
  const ring = DATA.boundary.features[0].geometry.coordinates.flat(2);
  const xs = ring.map((p) => p[0]), ys = ring.map((p) => p[1]);
  pajuBox = [Math.min(...xs) - 0.08, Math.min(...ys) - 0.08, Math.max(...xs) + 0.08, Math.max(...ys) + 0.08];

  map = new maplibregl.Map({
    container, style: buildStyle(), center: [126.83, 37.83], zoom: 9.6, pitch: 45, bearing: -14,
    maxPitch: 85, minZoom: 8, maxBounds: [[125.9, 37.2], [127.8, 38.4]],
    canvasContextAttributes: { antialias: true },
    pixelRatio: qualityRatio(),
    attributionControl: { compact: true },
  });
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');
  if (onReady) onReady(map);
  map.on('styleimagemissing', () => {});
  map.on('load', async () => {
    USE_ORDER.forEach((u) => map.addImage('win' + u, windowPattern(u), { pixelRatio: 4 }));
    map.addImage('tree0', treeIcon('#6fb556', '#468c3c'), { pixelRatio: 4 });
    map.addImage('tree1', treeIcon('#8cc35c', '#5a9a45'), { pixelRatio: 4 });
    map.addImage('tree2', treeIcon('#4f9a55', '#2f7040', 'pine'), { pixelRatio: 4 });
    ART.forEach((k) => {
      const m = MODE[k];
      USE_ORDER.forEach((u) => map.addImage('win-' + k + '-' + u, windowPattern(u, { wall: m.wall[WALL_IDX[u]], win: m.win, lit: m.lit }), { pixelRatio: 4 }));
      map.addImage('tree0-' + k, treeIcon(m.leaf[0], shade(m.leaf[0], -0.25)), { pixelRatio: 4 });
      map.addImage('tree1-' + k, treeIcon(m.leaf[1], shade(m.leaf[1], -0.25)), { pixelRatio: 4 });
      map.addImage('tree2-' + k, treeIcon(m.leaf[2], shade(m.leaf[2], -0.3), 'pine'), { pixelRatio: 4 });
    });
    map.addImage('pat-farm', groundPattern('farm'), { pixelRatio: 2 });
    map.addImage('pat-green', groundPattern('green'), { pixelRatio: 2 });
    buildPanel();
    document.querySelectorAll('.maplibregl-ctrl-attrib').forEach((a) => a.classList.remove('maplibregl-compact-show'));
    addLabels();
    overview();
    L.textContent = '건물 ' + fmt(DATA.meta.buildings) + '동 불러오는 중';
    const pack = await getJSON('buildings.pack.json');
    DATA.bfc = unpackBuildings(pack);
    map.getSource('buildings').setData(DATA.bfc);
    buildLegend();
    map.getSource('trees').setData(makeTrees(DATA.landcover));
    initSim();
    applyVisibility();
    requestAnimationFrame(simLoop);
    L.textContent = '';
  });
  // 건물 누르면 정보
  map.on('zoom', syncExag);
  map.on('click', (e) => {
    const hits = map.queryRenderedFeatures(e.point, { layers: ['bld', 'bld-ill', 'bld-far'].filter((id) => map.getLayer(id)) });
    const f = hits.find((x) => DATA.reg && DATA.reg.r[x.properties.i]) || hits[0];   // 겹친 자리면 대장 붙은 건물 먼저
    if (!f) return;
    const p = f.properties, box = document.createElement('div');
    // 건축물대장이 연결된 건물은 대장 값(상세 용도·구조·지하층·세대·승강기·주차)까지, 없는 값은 줄을 빼거나 '-'
    const r = (DATA.reg && DATA.reg.r[p.i]) || null, R = DATA.reg || {};
    const fl = p.f ? '지상 ' + p.f + '층' + (r && r[2] ? ' · 지하 ' + r[2] + '층' : '') : '-';
    const rows = [['용도', r && r[0] >= 0 ? R.P[r[0]] : (USE[p.u] ? USE[p.u].name : '-')], ['층수', fl], ['높이', p.h + 'm'], ['사용승인', p.y ? p.y + '년' : '-']];
    if (r && r[1] >= 0) rows.splice(1, 0, ['구조', R.S[r[1]]]);
    if (r && r[3]) rows.push(['세대', fmt(r[3]) + '세대']);
    if (r && r[4]) rows.push(['승강기', fmt(r[4]) + '대']);
    if (r && r[5]) rows.push(['주차', fmt(r[5]) + '대']);
    box.innerHTML = '<b></b>' + rows.map(() => '<div class="pp-row"><span></span><span></span></div>').join('') + (r ? '<div class="pp-src">건축물대장 기준</div>' : '');
    box.querySelector('b').textContent = p.n || (USE[p.u] && p.u ? USE[p.u].name + ' 건물' : '건물(용도 미등록)');
    box.querySelectorAll('.pp-row').forEach((row, i) => { row.children[0].textContent = rows[i][0]; row.children[1].textContent = rows[i][1]; });
    new maplibregl.Popup({ closeButton: false, maxWidth: '260px' }).setLngLat(e.lngLat).setDOMContent(box).addTo(map);
  });
  map.on('mouseenter', 'bld', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'bld', () => { map.getCanvas().style.cursor = ''; });
  // 투어 중 사용자가 지도를 잡으면 일시정지
  const grab = (e) => { if (tour.on && e.originalEvent && !tour.paused) { tour.paused = true; $('#t-pause').textContent = '계속'; } };
  map.on('mousedown', grab); map.on('touchstart', grab); map.on('wheel', grab);
  $('#t-pause').onclick = () => { tour.paused = !tour.paused; $('#t-pause').textContent = tour.paused ? '계속' : '일시정지'; tour.tgt = null; };
  $('#t-stop').onclick = () => stopTour(true);
  $('#t-next').onclick = () => jumpStop(1);
  $('#t-prev').onclick = () => jumpStop(-1);
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') stopTour(true); });
}
function setQuality(q) {
  try { localStorage.setItem('paju3d.quality', q); } catch (e) { /* 저장소 없음 */ }
  if (map && !tour.on) map.setPixelRatio(qualityRatio());
}
window.V3 = {
  start: (container, onReady) => main(container, onReady).catch((e) => { $('#loading').textContent = '불러오기 실패: ' + e.message; console.error(e); }),
  get map() { return map; }, get state() { return state; }, get data() { return DATA; }, get touring() { return tour.on; },
  setMode, setQuality, overview, startTour, stopTour: () => stopTour(true),
  get tourInfo() { return { s: Math.round(tour.s), L: Math.round(tour.L), cur: tour.cur, stops: (tour.stops || []).map((x) => x.l.name), ss: (tour.stops || []).map((x) => Math.round(x.s)), paused: tour.paused }; },
  jumpStop,
  setTourStops: (list) => { tour.custom = list; tour.L = 0; state.sel = null; },   // [{name, desc, lon, lat}] — 다음 startTour 때 경로를 새로 만든다 quality: () => (qualityRatio(), state.quality),
};
})();
