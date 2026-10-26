// Maps: the in-mission tactical sketch (only what has been observed) and the period travel map.
import { L } from '../engine/i18n.js';
import { LAND, ISLANDS, RIVERS, PLACES, AREAS, haversine } from '../data/geo.js';

// ---------------------------------------------------------------- tactical map (north = +z up, east = -x right)
export function drawTacticalMap(cv, g) {
  if (!cv) return;
  const T = g.terrain, W = cv.clientWidth || 600, H = cv.clientHeight || 400;
  const dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = W * dpr; cv.height = H * dpr;
  const c = cv.getContext('2d'); c.scale(dpr, dpr);
  const S = Math.min(W, H) - 20, ox = (W - S) / 2, oy = (H - S) / 2;
  const toS = (x, z) => [ox + (T.half - x) / T.size * S, oy + (T.half - z) / T.size * S];
  // relief from the height grid
  const N = 120, img = c.createImageData(N, N);
  let mn = Infinity, mx = -Infinity;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const h = T.heightAt(T.half - (i + 0.5) / N * T.size, T.half - (j + 0.5) / N * T.size); mn = Math.min(mn, h); mx = Math.max(mx, h); }
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = T.half - (i + 0.5) / N * T.size, z = T.half - (j + 0.5) / N * T.size;
    const h = T.heightAt(x, z), k = (h - mn) / (mx - mn || 1);
    const sh = (T.heightAt(x + 1.5, z + 1.5) - h) * 0.12;
    const road = T.roadAt(x, z);
    let r = 208 - k * 40 + sh * 60, gg = 196 - k * 34 + sh * 60, b = 160 - k * 22 + sh * 50;
    if (road > 0.5) { r = 170; gg = 150; b = 118; }
    if (T.waterLevel > -50 && h < T.waterLevel) { r = 130; gg = 150; b = 160; }
    const contour = Math.abs(((h - mn) % 4) - 2) < 0.18;
    if (contour) { r -= 22; gg -= 22; b -= 22; }
    const o = (j * N + i) * 4; img.data[o] = r; img.data[o + 1] = gg; img.data[o + 2] = b; img.data[o + 3] = 255;
  }
  const tmp = document.createElement('canvas'); tmp.width = N; tmp.height = N; tmp.getContext('2d').putImageData(img, 0, 0);
  c.imageSmoothingEnabled = true; c.drawImage(tmp, ox, oy, S, S);
  c.strokeStyle = '#3a2f22'; c.lineWidth = 2; c.strokeRect(ox, oy, S, S);
  // grid references
  c.font = '11px serif'; c.fillStyle = '#4a3c2c'; c.strokeStyle = 'rgba(60,45,30,0.25)'; c.lineWidth = 1;
  for (let i = 0; i <= 8; i++) { const p = ox + i / 8 * S; c.beginPath(); c.moveTo(p, oy); c.lineTo(p, oy + S); c.stroke(); const q = oy + i / 8 * S; c.beginPath(); c.moveTo(ox, q); c.lineTo(ox + S, q); c.stroke(); if (i < 8) { c.fillText('ABCDEFGH'[i], p + S / 16 - 3, oy - 3); c.fillText(String(i + 1), ox - 12, q + S / 16 + 4); } }
  // buildings and walls
  c.fillStyle = 'rgba(60,45,32,0.75)';
  for (const s of g.world.shapes) {
    if (s.kind !== 'box' || !s.solid || s.h < 1) continue;
    const [sx, sy] = toS(s.x, s.z);
    c.save(); c.translate(sx, sy); c.rotate(s.rot); // (x,z) -> (-x,-z) is a half-turn, so the angle is kept
    c.fillRect(-s.hw / T.size * S, -s.hd / T.size * S, s.hw * 2 / T.size * S, s.hd * 2 / T.size * S); c.restore();
  }
  // concealment (crops / brush)
  c.fillStyle = 'rgba(90,110,50,0.25)';
  for (const s of g.world.shapes) if (s.conceal && s.kind === 'box') { const [sx, sy] = toS(s.x, s.z); c.save(); c.translate(sx, sy); c.rotate(s.rot); c.fillRect(-s.hw / T.size * S, -s.hd / T.size * S, s.hw * 2 / T.size * S, s.hd * 2 / T.size * S); c.restore(); }
  const dot = (x, z, col, r = 4, shape = 'circle', label) => {
    const [sx, sy] = toS(x, z); c.fillStyle = col; c.strokeStyle = '#1c150e'; c.lineWidth = 1.2;
    c.beginPath();
    if (shape === 'tri') { c.moveTo(sx, sy - r); c.lineTo(sx + r, sy + r); c.lineTo(sx - r, sy + r); c.closePath(); }
    else if (shape === 'dia') { c.moveTo(sx, sy - r); c.lineTo(sx + r, sy); c.lineTo(sx, sy + r); c.lineTo(sx - r, sy); c.closePath(); }
    else c.arc(sx, sy, r, 0, Math.PI * 2);
    c.fill(); c.stroke();
    if (label) { c.fillStyle = '#1c150e'; c.font = '11px sans-serif'; c.fillText(label, sx + r + 3, sy + 4); }
  };
  // known patrol routes (only those inferred by watching)
  c.setLineDash([5, 4]); c.strokeStyle = 'rgba(140,40,30,0.8)'; c.lineWidth = 1.6;
  for (const e of g.enemies) if (e.routeKnown && e.route) { c.beginPath(); e.route.forEach((p, i) => { const [sx, sy] = toS(p[0], p[1]); i ? c.lineTo(sx, sy) : c.moveTo(sx, sy); }); if (!e.def.pingpong) { const [sx, sy] = toS(e.route[0][0], e.route[0][1]); c.lineTo(sx, sy); } c.stroke(); }
  c.setLineDash([]);
  // enemies: live (seen now) vs last-known
  for (const e of g.enemies) {
    if (!e.observed || !e.lastSeenByPlayer) continue;
    if (!e.active) { const [sx, sy] = toS(e.x, e.z); c.strokeStyle = '#6b5a48'; c.beginPath(); c.moveTo(sx - 3, sy - 3); c.lineTo(sx + 3, sy + 3); c.moveTo(sx + 3, sy - 3); c.lineTo(sx - 3, sy + 3); c.stroke(); continue; }
    const live = e.visibleToPlayer;
    const ls = e.lastSeenByPlayer;
    if (live) { // vision cone of an enemy you can currently see
      const [sx, sy] = toS(e.x, e.z), r = e.viewRange / T.size * S * (g.env.time === 'night' ? 0.45 : 1);
      const a = Math.atan2(-Math.cos(e.facing), -Math.sin(e.facing)); // facing in screen space
      c.fillStyle = 'rgba(180,60,40,0.15)'; c.beginPath(); c.moveTo(sx, sy); c.arc(sx, sy, r, a - e.fov / 2, a + e.fov / 2); c.closePath(); c.fill();
    }
    dot(live ? e.x : ls.x, live ? e.z : ls.z, live ? '#b8402e' : 'rgba(184,64,46,0.35)', 4, 'tri');
  }
  for (const it of g.interactables) if (it.marker && it.enabled(g)) { const [x, z] = typeof it.pos === 'function' ? it.pos(g) : it.pos; dot(x, z, '#e0c060', 3.5, 'dia'); }
  if (g.def.extraction) dot(g.def.extraction[0], g.def.extraction[1], '#2f6b3a', 6, 'circle', L('extraction'));
  const op = g.hud.objectivePos(); if (op) dot(op[0], op[1], '#f0d070', 6, 'dia');
  for (const civ of g.civilians) if (civ.def.escort && civ.active) dot(civ.x, civ.z, '#d8d2c4', 3);
  for (const a of g.squad) if (a.state !== 'lost') dot(a.x, a.z, a.state === 'wounded' ? '#d0a040' : '#3d6aa8', 4, 'circle');
  // player arrow
  const [px, py] = toS(g.player.x, g.player.z); const a = -g.cam.yaw;
  c.save(); c.translate(px, py); c.rotate(a); c.fillStyle = '#f4efe2'; c.strokeStyle = '#1c150e'; c.beginPath(); c.moveTo(0, -8); c.lineTo(6, 6); c.lineTo(0, 3); c.lineTo(-6, 6); c.closePath(); c.fill(); c.stroke(); c.restore();
  // compass
  c.fillStyle = '#3a2f22'; c.font = 'bold 13px serif'; c.fillText('N ↑', ox + S - 30, oy + 18);
}

// ---------------------------------------------------------------- period travel map
export class TravelMap {
  constructor(app) { this.app = app; }
  // route: {from, to, via?, view:[lon0, lat0, lon1, lat1], date:{en,ko}, text:[{en,ko}], mode:{en,ko}, days, areas?:[ids], extra?:[placeIds]}
  show(route, onDone) {
    const root = document.createElement('section'); root.className = 'screen s-travel in';
    root.innerHTML = `<canvas class="travel-cv"></canvas><div class="travel-card"><div class="tc-date" id="tcDate"></div><h3 id="tcTitle"></h3><div class="tc-meta" id="tcMeta"></div><div class="tc-text" id="tcText"></div><button class="btn primary" data-k="go"><span>${L('continue')}</span></button></div>`;
    document.getElementById('screens').appendChild(root);
    const cv = root.querySelector('canvas');
    const pts = [route.from, ...(route.via || []), route.to].map((k) => PLACES[k]);
    let km = 0; for (let i = 0; i < pts.length - 1; i++) km += haversine(pts[i].ll, pts[i + 1].ll);
    root.querySelector('#tcDate').textContent = L(route.date);
    root.querySelector('#tcTitle').textContent = `${L(pts[0].name)} → ${L(pts[pts.length - 1].name)}`;
    root.querySelector('#tcMeta').textContent = L('travelMeta', { km: Math.round(km / 10) * 10, mode: route.mode, time: route.time });
    root.querySelector('#tcText').innerHTML = (route.text || []).map((p) => `<p>${L(p)}</p>`).join('');
    this.app.audio.playMusic('map');
    let t0 = performance.now(), raf;
    const dur = 3600;
    const draw = () => {
      const k = Math.min(1, (performance.now() - t0) / dur);
      this.render(cv, route, pts, k);
      if (k < 1) raf = requestAnimationFrame(draw);
    };
    draw();
    const done = () => { cancelAnimationFrame(raf); root.remove(); onDone(); };
    root.addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (!b) return; this.app.audio.ui(); done(); });
    this.cleanup = done;
    setTimeout(() => root.querySelector('[data-k="go"]').focus(), 50);
  }
  render(cv, route, pts, k) {
    const W = cv.clientWidth, H = cv.clientHeight, dpr = Math.min(2, devicePixelRatio || 1);
    if (cv.width !== W * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
    const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    let [lo0, la0, lo1, la1] = route.view;
    // keep aspect: expand view to fit screen
    const midLat = (la0 + la1) / 2, kx = Math.cos(midLat * Math.PI / 180);
    let vw = (lo1 - lo0) * kx, vh = la1 - la0;
    const ar = W / H;
    if (vw / vh < ar) { const nw = vh * ar / kx, cx = (lo0 + lo1) / 2; lo0 = cx - nw / 2; lo1 = cx + nw / 2; }
    else { const nh = vw / ar, cy = (la0 + la1) / 2; la0 = cy - nh / 2; la1 = cy + nh / 2; }
    const P = ([lo, la]) => [(lo - lo0) / (lo1 - lo0) * W, (la1 - la) / (la1 - la0) * H];
    // paper sea
    c.fillStyle = '#c9c3ae'; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(80,90,90,0.12)'; c.lineWidth = 1;
    for (let y = 0; y < H; y += 7) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y + 2); c.stroke(); }
    const poly = (arr, fill, stroke, w = 1.3) => { c.beginPath(); arr.forEach((p, i) => { const [x, y] = P(p); i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.closePath(); c.fillStyle = fill; c.fill(); c.strokeStyle = stroke; c.lineWidth = w; c.stroke(); };
    poly(LAND, '#e6dcc2', '#5a4a36', 1.6);
    for (const isl of ISLANDS) poly(isl, '#e6dcc2', '#5a4a36', 1.3);
    // coast ink double line
    c.save(); c.globalAlpha = 0.25; c.lineWidth = 5; c.strokeStyle = '#8a7a60';
    c.beginPath(); LAND.forEach((p, i) => { const [x, y] = P(p); i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke(); c.restore();
    c.strokeStyle = '#6f8a96'; c.lineWidth = 1.6;
    for (const r of Object.values(RIVERS)) { c.beginPath(); r.forEach((p, i) => { const [x, y] = P(p); i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke(); }
    // organisation areas
    for (const id of route.areas || []) {
      const a = AREAS[id]; const [x, y] = P(a.ll); const r = a.r / (lo1 - lo0) * W;
      c.fillStyle = 'rgba(150,60,40,0.14)'; c.strokeStyle = 'rgba(150,60,40,0.5)'; c.setLineDash([4, 3]);
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.stroke(); c.setLineDash([]);
      c.fillStyle = '#6a2a1c'; c.font = `bold ${Math.max(11, Math.min(15, W / 90))}px serif`; c.textAlign = 'center'; c.fillText(L(a.name), x, y - r - 4); c.textAlign = 'left';
    }
    // places
    const shown = new Set([...Object.keys(PLACES).filter((k) => (route.extra || []).includes(k)), route.from, route.to, ...(route.via || [])]);
    c.font = `${Math.max(11, Math.min(15, W / 95))}px serif`;
    for (const id of shown) {
      const pl = PLACES[id]; const [x, y] = P(pl.ll);
      if (x < -50 || x > W + 50 || y < -20 || y > H + 20) continue;
      c.fillStyle = '#2e241a'; c.beginPath(); c.arc(x, y, 3.2, 0, Math.PI * 2); c.fill();
      const off = pl.off || [1, -1];
      c.textAlign = off[0] < 0 ? 'right' : 'left';
      c.fillStyle = '#2e241a'; c.fillText(L(pl.name), x + off[0] * 7, y + (off[1] < 0 ? -6 : 14));
    }
    c.textAlign = 'left';
    // route with progress
    const seg = []; let total = 0;
    for (let i = 0; i < pts.length - 1; i++) { const a = P(pts[i].ll), b = P(pts[i + 1].ll); const l = Math.hypot(b[0] - a[0], b[1] - a[1]); seg.push([a, b, l]); total += l; }
    let rem = total * k;
    c.strokeStyle = '#8a2a1e'; c.lineWidth = 3; c.setLineDash([9, 6]); c.beginPath();
    let head = seg.length ? seg[0][0] : P(pts[0].ll);
    c.moveTo(head[0], head[1]);
    for (const [a, b, l] of seg) {
      if (rem <= 0) break;
      const t = Math.min(1, rem / l); head = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      c.lineTo(head[0], head[1]); rem -= l;
    }
    c.stroke(); c.setLineDash([]);
    c.fillStyle = '#8a2a1e'; c.beginPath(); c.arc(head[0], head[1], 6, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#f2ead6'; c.lineWidth = 2; c.stroke();
    // cartouche: era + compass
    c.fillStyle = 'rgba(46,36,26,0.85)'; c.font = `bold ${Math.max(14, W / 60)}px serif`;
    c.fillText(L(route.date), 24, H - 28);
    c.strokeStyle = '#2e241a'; c.lineWidth = 1.5; const cx = W - 60, cy = H - 70;
    c.beginPath(); c.moveTo(cx, cy - 26); c.lineTo(cx + 7, cy); c.lineTo(cx, cy + 26); c.lineTo(cx - 7, cy); c.closePath(); c.stroke();
    c.fillStyle = '#2e241a'; c.font = 'bold 14px serif'; c.fillText('N', cx - 5, cy - 32);
    // scale bar (approx)
    const kmPerPx = haversine([lo0, (la0 + la1) / 2], [lo1, (la0 + la1) / 2]) / W;
    const barKm = kmPerPx * 150 > 400 ? 500 : kmPerPx * 150 > 150 ? 200 : 100; const barPx = barKm / kmPerPx;
    c.fillRect(W - 40 - barPx, H - 22, barPx, 4); c.font = '12px serif'; c.fillText(`${barKm} km`, W - 40 - barPx, H - 28);
    // vignette
    const gr = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(60,40,20,0.35)'); c.fillStyle = gr; c.fillRect(0, 0, W, H);
  }
}
