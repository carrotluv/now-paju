'use strict';
// Leaflet 흉내 — 지금 파주 첫 화면 지도를 파주 3D 맵 v3(MapLibre)로 바꾸면서,
//   지점·도로 색·주차장·CCTV·내 위치를 그리는 첫 화면 코드는 그대로 두려고 만든 얇은 연결층(첫 화면이 쓰는 만큼만).
//   Leaflet 확대 단계는 256px 타일 기준이라 MapLibre(512px)보다 1 크다 — 주고받을 때 1을 더하고 뺀다.
//   바탕 타일·파주 가림막·경계선·노선 장식선은 v3가 직접 그리므로 여기선 그리지 않는다(빈 층).
(function () {
  const ZD = 1;
  let ML = null, loaded = false, openPop = null;
  const waitMap = [], waitLoad = [], popH = { popupopen: [], popupclose: [] };
  const whenMap = (fn) => (ML ? fn(ML) : waitMap.push(fn));
  const whenLoad = (fn) => (loaded ? fn(ML) : waitLoad.push(fn));
  const firePop = (type) => popH[type].forEach((f) => f({ type }));
  const ll = (p) => (Array.isArray(p) ? [+p[0], +p[1]] : [+p.lat, +p.lng]);   // → [위도, 경도]
  const lnglat = (p) => { const a = ll(p); return [a[1], a[0]]; };

  class Bounds {
    constructor(pts) {
      this.s = Infinity; this.w = Infinity; this.n = -Infinity; this.e = -Infinity;
      (pts || []).forEach((p) => { const [a, b] = ll(p); this.s = Math.min(this.s, a); this.n = Math.max(this.n, a); this.w = Math.min(this.w, b); this.e = Math.max(this.e, b); });
    }
    pad(r) {
      const b = new Bounds([]), dy = (this.n - this.s) * r, dx = (this.e - this.w) * r;
      Object.assign(b, { s: this.s - dy, n: this.n + dy, w: this.w - dx, e: this.e + dx });
      return b;
    }
    contains(p) {
      if (p instanceof Bounds) return p.s >= this.s && p.n <= this.n && p.w >= this.w && p.e <= this.e;
      const [a, b] = ll(p);
      return a >= this.s && a <= this.n && b >= this.w && b <= this.e;
    }
    ml() { return [[this.w, this.s], [this.e, this.n]]; }
    getNorth() { return this.n; } getSouth() { return this.s; } getEast() { return this.e; } getWest() { return this.w; }
    getCenter() { return { lat: (this.s + this.n) / 2, lng: (this.w + this.e) / 2 }; }
  }

  // ---- 선 묶음: 묶음마다 GeoJSON 소스·선 층 하나(도로 소통 색 등) ----
  let lineSeq = 0;
  class Group {
    constructor() { this.items = new Set(); this._on = false; this.id = 'lsh-' + (++lineSeq); }
    add(x) { this.items.add(x); if (this._on) x._show(); if (x instanceof Line) this.redraw(); return this; }
    addTo(m) { if (m instanceof Group) { m.add(this); return this; } this._on = true; this.items.forEach((x) => x._show()); this.redraw(); return this; }
    remove() { this._on = false; this.items.forEach((x) => x._hide()); this.redraw(); return this; }
    clearLayers() { this.items.forEach((x) => x._hide()); this.items.clear(); this.redraw(); return this; }
    eachLayer(fn) { this.items.forEach(fn); }
    redraw() {                                              // 바로 그린다 — 줄 몇 개뿐이라 setData 몇 번이면 된다(타이머는 뒤쪽 탭에서 밀린다)
      whenLoad((m) => {
        const fs = this._on ? [...this.items].filter((x) => x instanceof Line).map((x) => x.feature()) : [];
        const data = { type: 'FeatureCollection', features: fs };
        if (m.getSource(this.id)) { m.getSource(this.id).setData(data); return; }
        if (!fs.length) return;
        m.addSource(this.id, { type: 'geojson', data });
        m.addLayer({
          id: this.id, type: 'line', source: this.id,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': ['get', 'c'], 'line-width': ['get', 'w'], 'line-opacity': ['get', 'o'] },
        }, m.getLayer('bld') ? 'bld' : undefined);
      });
    }
  }
  class Line {
    constructor(pts, o) {                                  // 점 목록 하나(LineString) 또는 여러 줄(MultiLineString)
      this.multi = Array.isArray(pts[0]) && Array.isArray(pts[0][0]);
      this.pts = this.multi ? pts.map((q) => q.map(ll)) : pts.map(ll); this.o = o || {}; this._g = null;
    }
    addTo(t) { if (t instanceof Group) { this._g = t; t.add(this); } return this; }   // 지도에 바로 얹는 장식선은 v3가 대신 그린다
    _show() {} _hide() {}
    remove() { if (this._g) { this._g.items.delete(this); this._g.redraw(); } return this; }
    setStyle(o) { Object.assign(this.o, o); if (this._g) this._g.redraw(); return this; }
    feature() {
      return { type: 'Feature', properties: { c: this.o.color || '#3388ff', w: this.o.weight || 3, o: this.o.opacity == null ? 1 : this.o.opacity },
        geometry: this.multi ? { type: 'MultiLineString', coordinates: this.pts.map((q) => q.map((p) => [p[1], p[0]])) }
          : { type: 'LineString', coordinates: this.pts.map((p) => [p[1], p[0]]) } };
    }
  }
  class Nothing { addTo() { return this; } remove() { return this; } setLatLng() { return this; } setRadius() { return this; } setStyle() { return this; } _show() {} _hide() {} }

  // ---- 표식: divIcon html을 그대로 MapLibre Marker 요소로 ----
  const live = new Set();
  // 많이 기울이면 수평선 너머 지점이 하늘에 떠 보인다 — 땅 위가 아닌 자리에 찍히는 표식은 숨긴다(10-19)
  function horizonCull() {
    if (!ML) return;
    const t = ML.transform, tilt = ML.getPitch() > 50 && t.isPointOnMapSurface;
    live.forEach((mk) => {
      let show = true;
      if (tilt) { const q = ML.project(lnglat(mk.p)); show = t.isPointOnMapSurface(q); }
      if (mk._cull !== !show) { mk._cull = !show; mk.el.style.visibility = show ? '' : 'hidden'; }
    });
  }
  class Marker {
    constructor(p, o) {
      this.p = ll(p); this.o = o || {}; this._on = false; this._g = null;
      this.el = document.createElement('div');
      this.el.className = 'lsh-mk';
      if (this.o.interactive === false) this.el.style.pointerEvents = 'none';
      this.setIcon(this.o.icon);
      this.setZIndexOffset(this.o.zIndexOffset || 0);
    }
    setIcon(icon) { this.el.innerHTML = icon ? icon.html : ''; return this; }
    setZIndexOffset(z) { this.el.style.zIndex = String(2000 + Math.round(z)); return this; }
    addTo(t) { if (t instanceof Group) { this._g = t; t.add(this); return this; } this._show(); return this; }
    _show() {
      if (this._on) return;
      this._on = true;
      whenMap((m) => {
        if (!this._on) return;
        if (!this.mk) this.mk = new maplibregl.Marker({ element: this.el, anchor: 'top-left' }).setLngLat(lnglat(this.p));
        this.mk.addTo(m);
        live.add(this);
      });
    }
    _hide() { this._on = false; live.delete(this); if (this.mk) this.mk.remove(); if (this.pop && openPop === this.pop) this.pop.remove(); }
    remove() { if (this._g) this._g.items.delete(this); this._hide(); return this; }
    on(ev, fn) {
      if (ev === 'click') this.el.addEventListener('click', (e) => { e.stopPropagation(); fn({ target: this, originalEvent: e }); });
      return this;
    }
    getElement() { return this.el; }
    getLatLng() { return { lat: this.p[0], lng: this.p[1] }; }
    setLatLng(p) { this.p = ll(p); if (this.mk) this.mk.setLngLat(lnglat(this.p)); return this; }
    bindPopup(c, o) {
      this.popC = c; this.popO = o || {};
      this.el.addEventListener('click', (e) => { e.stopPropagation(); this.openPopup(); });
      return this;
    }
    openPopup() {
      whenMap((m) => {
        if (openPop) openPop.remove();
        const c = typeof this.popC === 'function' ? this.popC(this) : this.popC;
        const pop = new maplibregl.Popup({ closeButton: true, maxWidth: '260px', offset: 14, className: 'lsh-pop' }).setLngLat(lnglat(this.p));
        if (typeof c === 'string') pop.setHTML(c); else pop.setDOMContent(c);
        this.pop = pop; openPop = pop;
        pop.on('close', () => { if (openPop === pop) openPop = null; firePop('popupclose'); });
        pop.addTo(m);
        firePop('popupopen');
      });
      return this;
    }
  }

  class MapShim {
    on(evs, fn) {
      evs.split(' ').forEach((ev) => {
        if (popH[ev]) popH[ev].push(fn);
        else whenMap((m) => m.on(ev, fn));
      });
      return this;
    }
    once(ev, fn) { whenMap((m) => m.once(ev, fn)); return this; }
    getZoom() { return ML ? ML.getZoom() + ZD : 11; }
    flyTo(p, z, o) {
      whenMap((m) => m.flyTo({ center: lnglat(p), zoom: (z == null ? m.getZoom() + ZD : z) - ZD, duration: ((o && o.duration) ?? 0.6) * 1000, essential: true }));
      return this;
    }
    setView(p, z) { whenMap((m) => m.jumpTo({ center: lnglat(p), zoom: z - ZD })); return this; }
    fitBounds(b) { whenLoad((m) => m.fitBounds(b.ml(), { padding: 24, duration: 0 })); return this; }
    flyToBounds(b, o) { whenMap((m) => m.fitBounds(b.ml(), { padding: 24, duration: ((o && o.duration) ?? 0.7) * 1000 })); return this; }
    getBounds() {
      if (!ML) return new Bounds([[37.68, 126.65], [38.0, 127.0]]);
      const b = ML.getBounds();
      return new Bounds([[b.getSouth(), b.getWest()], [b.getNorth(), b.getEast()]]);
    }
    removeLayer(l) { if (l) l.remove(); return this; }
    addLayer(l) { l.addTo(this); return this; }
    hasLayer(l) { return !!(l && l._on); }
    closePopup() { if (openPop) openPop.remove(); return this; }
    invalidateSize() { if (ML) ML.resize(); return this; }
  }

  window.L = {
    map: (id) => {
      const shim = new MapShim();
      window.V3.start(id, (m) => {
        ML = m;
        waitMap.splice(0).forEach((f) => f(m));
        m.on('move', horizonCull); m.on('moveend', horizonCull);
        const go = () => { if (loaded) return; loaded = true; waitLoad.splice(0).forEach((f) => f(m)); };
        m.once('style.load', go); m.once('load', go);           // 층을 얹는 건 스타일만 읽히면 된다(타일·지형까지 기다리지 않음)
        const t = setInterval(() => { if (m.isStyleLoaded() || m.getLayer('bld')) { clearInterval(t); go(); } }, 300);
      });
      return shim;
    },
    tileLayer: () => new Nothing(),
    polygon: () => new Nothing(),
    circle: () => new Nothing(),
    polyline: (pts, o) => new Line(pts, o),
    marker: (p, o) => new Marker(p, o),
    divIcon: (o) => ({ html: o.html || '' }),
    layerGroup: () => new Group(),
    latLngBounds: (pts) => new Bounds(pts),
    _state: () => ({ map: !!ML, loaded, waitMap: waitMap.length, waitLoad: waitLoad.length }),
  };
})();
