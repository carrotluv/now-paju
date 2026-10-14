'use strict';
/* 차량 연출 — 실측 색이 칠해진 도로 위에만, 그 구간의 실측 속도(5배속)로 달린다.
   대수는 도로 상황(원활·서행·정체)에 맞춘 연출이지 실제 대수가 아니다(경기도·국가교통정보센터 자료엔 대수가 없다).
   지도(WebGL)를 다시 그리지 않도록 지도 위 2D 캔버스에 따로 그린다 — 차를 지도 레이어로 넣으면 옮길 때마다
   지도가 통째로 다시 그려져 사무실 PC(UHD 770)에서 60→31fps, 0.1초마다 멈칫했다(2026-10-14 실측).
   지형이 켜진 지도의 map.project()는 매번 지형 높이를 읽어 한 번에 0.16ms(450대면 한 화면 147ms)라,
   높이는 도로 꼭짓점마다 한 번만 읽어 두고 화면 변환은 지도와 같은 행렬(_pixelMatrix3D)로 직접 한다(같은 결과, 0ms대).
   빼려면: index.html의 cars.js 줄과 '차량' 버튼, festival.js의 Cars 호출 세 곳을 지운다. */
const Cars = (() => {
  const KX = 111320 * Math.cos(37.89 * Math.PI / 180), KY = 110574;
  const COLORS = ['#f4f5f6', '#f4f5f6', '#dfe2e6', '#2d3238', '#3a4f6e', '#b23a33', '#e9e6dc', '#8d969f'];
  const DENS = { '원활': 0.35, '서행': 1.6, '정체': 3 };   // 같은 길이에 상대 대수(연출) — 10-14 사용자 '녹색인데도 많다'로 원활을 1→0.35
  const SPEEDUP = 5, MINZ = 12.8;
  let map, cv, ctx, dpr = 1, segs = [], ends = new Map(), cars = [], on = true, cap = 450, last = 0, acc = 0, nfr = 0, dirty = false, t0 = 0, movedAt = 0, slowRuns = 0;
  const merc = (lng, lat) => [(lng + 180) / 360, (1 - Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) / Math.PI) / 2];
  const key = (lng, lat) => Math.round(lng * 6000) + ',' + Math.round(lat * 6000);   // 약 15m 칸 — 끝점이 맞닿은 구간 찾기
  const rnd = (n) => Math.floor(Math.random() * n);

  function resize() {
    const c = map.getCanvas();
    dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(c.clientWidth * dpr); cv.height = Math.round(c.clientHeight * dpr);
    cv.style.width = c.clientWidth + 'px'; cv.style.height = c.clientHeight + 'px';
    dirty = false;                                                       // 크기를 바꾸면 캔버스가 저절로 비워진다
  }
  function init(m, isMobile) {
    map = m; cap = isMobile ? 420 : 900;                               // 10-14 사용자 '너무 많다 40% 줄여' — 1,500→900(성능 여유: 1,500대 59·2,000대 56fps 실측)
    cv = document.createElement('canvas');
    cv.className = 'carcv';
    cv.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none';
    map.getCanvasContainer().insertBefore(cv, map.getCanvas().nextSibling);   // 지도 바로 위, 표식(주차장·CCTV)보다는 아래
    resize(); map.on('resize', resize);
    requestAnimationFrame(loop);
  }
  // 구간: [{p:[[lat,lng],…], v: km/h}] — festival.js drawTraffic이 실측 구간만 넘긴다
  function setSegments(list) {
    segs = []; ends = new Map();
    list.forEach((r) => {
      const pts = r.p.map((q) => [q[1], q[0]]), cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot((pts[i][0] - pts[i - 1][0]) * KX, (pts[i][1] - pts[i - 1][1]) * KY));
      const L = cum[cum.length - 1];
      if (L < 25) return;
      const lv = r.v >= 48 ? '원활' : (r.v >= 24 ? '서행' : '정체');
      const sg = { pts, cum, L, v: r.v / 3.6 * SPEEDUP, w: L / 1000 * DENS[lv], m: pts.map((q) => merc(q[0], q[1])), el: new Array(pts.length).fill(null) };
      segs.push(sg);
      [[pts[0], 0], [pts[pts.length - 1], 1]].forEach(([p, e]) => { const k = key(p[0], p[1]); if (!ends.has(k)) ends.set(k, []); ends.get(k).push([sg, e]); });
    });
    spawn();
  }
  function pick() {                                                      // 길이×상황 가중치로 구간 고르기
    let t = Math.random() * segs.wsum;
    for (const s of segs) { t -= s.w; if (t <= 0) return s; }
    return segs[segs.length - 1];
  }
  function spawn() {
    segs.wsum = segs.reduce((a, s) => a + s.w, 0);
    if (!segs.length) { cars = []; return; }
    cars = Array.from({ length: cap }, () => {
      const g = pick();
      return { g, s: Math.random() * g.L, dir: Math.random() < 0.5 ? 1 : -1, c: COLORS[rnd(COLORS.length)], k: 0.85 + Math.random() * 0.3 };
    });
  }
  function next(car) {                                                   // 끝에 닿으면 맞닿은 다른 구간으로, 없으면 다른 곳에서 다시
    const p = car.dir > 0 ? car.g.pts[car.g.pts.length - 1] : car.g.pts[0];
    const opts = (ends.get(key(p[0], p[1])) || []).filter(([g]) => g !== car.g);
    if (opts.length) { const [g, e] = opts[rnd(opts.length)]; car.g = g; car.dir = e === 0 ? 1 : -1; car.s = e === 0 ? 0 : g.L; }
    else { car.g = pick(); car.s = Math.random() * car.g.L; }
  }
  function elev(g, i) {                                                   // 꼭짓점 높이 — 한 번 읽어 두고 쓴다. 지형 타일이 아직 없어 0이면 다음에 다시 읽는다
    if (g.el[i] != null) return g.el[i];
    const ter = map.terrain, v = ter ? ter.getElevationForLngLat(new maplibregl.LngLat(g.pts[i][0], g.pts[i][1]), map.transform) : 0;
    if (v) g.el[i] = v;
    return v || 0;
  }
  function at(g, s) {                                                    // 구간 위 s(m) 지점 → 화면 좌표
    s = Math.max(0, Math.min(g.L, s));
    let i = 1; while (i < g.cum.length - 1 && g.cum[i] < s) i++;
    const t = (s - g.cum[i - 1]) / ((g.cum[i] - g.cum[i - 1]) || 1), a = g.m[i - 1], b = g.m[i];
    const e = elev(g, i - 1) + (elev(g, i) - elev(g, i - 1)) * t, tr = map.transform;
    return tr.coordinatePoint({ x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t }, e, tr._pixelMatrix3D || tr._pixelMatrix);
  }
  function draw() {
    ctx = ctx || cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height); dirty = true;
    const W = cv.width / dpr, H = cv.height / dpr;
    // 같은 굵기(1px 단위)·같은 색끼리 묶어 한 번에 긋는다 — 차마다 따로 그으면 700대에 1,400번이라 대수를 못 늘렸다
    const outl = new Map(), body = new Map();
    for (const car of cars) {
      const f = at(car.g, car.s + 2.3 * car.dir), b = at(car.g, car.s - 2.3 * car.dir);
      if ((f.x < -20 && b.x < -20) || (f.x > W + 20 && b.x > W + 20) || (f.y < -20 && b.y < -20) || (f.y > H + 20 && b.y > H + 20)) continue;
      const dx = f.x - b.x, dy = f.y - b.y, len = Math.hypot(dx, dy);
      if (len < 0.3) continue;                                           // 아주 멀어 방향을 못 잡으면 생략
      // 연출이라 실제(4.6m)보다 크게 — 실제 크기면 이 확대에서 2~3px라 안 보였다(10-14 화면 확인)
      const ux = dx / len, uy = dy / len, hl = Math.max(len * 2.5, 7) / 2, w = Math.max(3, Math.round(Math.max(len * 1.05, 3.5)));
      const o = w * 0.55, cx = (f.x + b.x) / 2 - uy * o, cy = (f.y + b.y) / 2 + ux * o;   // 진행 방향 오른쪽 차로로
      const seg = [cx - ux * hl, cy - uy * hl, cx + ux * hl, cy + uy * hl];
      (outl.get(w) || outl.set(w, []).get(w)).push(seg);
      const k = w + car.c;
      (body.get(k) || body.set(k, [w, car.c]).get(k)).push(seg);
    }
    const stroke = (list, from) => { ctx.beginPath(); for (let n = from; n < list.length; n++) { const q = list[n]; ctx.moveTo(q[0], q[1]); ctx.lineTo(q[2], q[3]); } ctx.stroke(); };
    ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(35,39,47,.8)';
    outl.forEach((list, w) => { ctx.lineWidth = w + 1.6; stroke(list, 0); });
    body.forEach((list) => { ctx.lineWidth = list[0]; ctx.strokeStyle = list[1]; stroke(list, 2); });
  }
  function loop(t) {
    const dt = Math.min(0.1, last ? (t - last) / 1000 : 0); last = t;
    const show = on && !document.hidden && cars.length && map.getZoom() >= MINZ;
    if (show) {
      for (const car of cars) { car.s += car.g.v * car.k * dt * car.dir; if (car.s < 0 || car.s > car.g.L) next(car); }
      draw();
      // 자동 감속: 지도가 가만히 있는데도 2초 평균이 28fps보다 느리기를 두 번 연속하면 대수를 30% 줄인다.
      //   처음 불러오는 8초, 지도를 움직이는 동안과 멈춘 뒤 3초(지형 타일 불러오기)는 지도 탓이라 세지 않는다
      if (!t0) t0 = t;
      if (map.isMoving() || !map.areTilesLoaded()) movedAt = t;
      if (t - t0 > 8000 && t - movedAt > 3000) { acc += dt; nfr++; } else { acc = 0; nfr = 0; }
      if (acc >= 2) {
        slowRuns = nfr / acc < 28 ? slowRuns + 1 : 0;
        if (slowRuns >= 2 && cars.length > 100) { cars.length = Math.floor(cars.length * 0.7); slowRuns = 0; }
        acc = 0; nfr = 0;
      }
    } else if (dirty && ctx) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); dirty = false; }
    requestAnimationFrame(loop);
  }
  function setVisible(v) { on = v; }
  function setCap(n) { cap = n; spawn(); }                             // 대수 바꾸기(시험·조정용)
  const byLevel = () => cars.reduce((o, c) => { const k = c.g.v / SPEEDUP * 3.6 >= 48 ? '원활' : (c.g.v / SPEEDUP * 3.6 >= 24 ? '서행' : '정체'); o[k] = (o[k] || 0) + 1; return o; }, {});
  return { init, setSegments, setVisible, setCap, byLevel, count: () => cars.length };
})();
