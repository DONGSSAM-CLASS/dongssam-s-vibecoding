// 2.5D collision world: circles and oriented boxes with a base height and a height.
// Shapes can block movement, sight, bullets; give cover; or only conceal (bushes, sorghum).
const CELL = 8;

export class CollisionWorld {
  constructor(terrain) {
    this.terrain = terrain;
    this.shapes = [];
    this.grid = new Map();
    this.nextId = 1;
  }
  _key(i, j) { return i * 73856093 ^ j * 19349663; }
  add(s) {
    s.id = this.nextId++;
    s.solid ??= true; s.sight ??= true; s.bullets ??= s.sight; s.cover ??= false; s.conceal ??= 0;
    if (s.y0 == null) s.y0 = this.terrain ? this.terrain.heightAt(s.x, s.z) - 0.1 : 0;
    if (s.kind === 'box') {
      s.rot ??= 0; s.cos = Math.cos(s.rot); s.sin = Math.sin(s.rot);
      s.rad = Math.hypot(s.hw, s.hd);
    } else s.rad = s.r;
    const i0 = Math.floor((s.x - s.rad) / CELL), i1 = Math.floor((s.x + s.rad) / CELL);
    const j0 = Math.floor((s.z - s.rad) / CELL), j1 = Math.floor((s.z + s.rad) / CELL);
    s.cells = [];
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const k = this._key(i, j);
      if (!this.grid.has(k)) this.grid.set(k, []);
      this.grid.get(k).push(s); s.cells.push(k);
    }
    this.shapes.push(s);
    return s;
  }
  remove(s) {
    if (!s) return;
    for (const k of s.cells || []) { const a = this.grid.get(k); if (a) { const i = a.indexOf(s); if (i >= 0) a.splice(i, 1); } }
    const i = this.shapes.indexOf(s); if (i >= 0) this.shapes.splice(i, 1);
  }
  query(x, z, r, out = []) {
    out.length = 0;
    const i0 = Math.floor((x - r) / CELL), i1 = Math.floor((x + r) / CELL);
    const j0 = Math.floor((z - r) / CELL), j1 = Math.floor((z + r) / CELL);
    const seen = this._seen || (this._seen = new Set()); seen.clear();
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const a = this.grid.get(this._key(i, j)); if (!a) continue;
      for (const s of a) if (!seen.has(s.id)) { seen.add(s.id); out.push(s); }
    }
    return out;
  }
  // local coordinates of a point relative to a box
  _local(s, x, z) { const dx = x - s.x, dz = z - s.z; return [dx * s.cos + dz * s.sin, -dx * s.sin + dz * s.cos]; }
  _world(s, lx, lz) { return [s.x + lx * s.cos - lz * s.sin, s.z + lx * s.sin + lz * s.cos]; }

  // push a circle of radius r out of solid shapes; returns [x, z, hitAny]
  resolve(x, z, r, footY = null) {
    const near = this.query(x, z, r + 2, this._q || (this._q = []));
    let hit = false;
    for (let iter = 0; iter < 3; iter++) {
      for (const s of near) {
        if (!s.solid) continue;
        if (footY != null && footY > s.y0 + s.h - 0.35) continue; // standing on / stepping over low things
        if (s.kind === 'circle') {
          const dx = x - s.x, dz = z - s.z, d = Math.hypot(dx, dz), m = s.r + r;
          if (d < m && d > 1e-5) { x = s.x + dx / d * m; z = s.z + dz / d * m; hit = true; }
        } else {
          const [lx, lz] = this._local(s, x, z);
          const cx = Math.max(-s.hw, Math.min(s.hw, lx)), cz = Math.max(-s.hd, Math.min(s.hd, lz));
          let dx = lx - cx, dz = lz - cz; const d = Math.hypot(dx, dz);
          if (d < r) {
            let nx, nz;
            if (d > 1e-5) { nx = cx + dx / d * r; nz = cz + dz / d * r; }
            else { // centre inside box: push out along the shallowest axis
              const px = s.hw - Math.abs(lx), pz = s.hd - Math.abs(lz);
              if (px < pz) { nx = Math.sign(lx || 1) * (s.hw + r); nz = lz; } else { nx = lx; nz = Math.sign(lz || 1) * (s.hd + r); }
            }
            [x, z] = this._world(s, nx, nz); hit = true;
          }
        }
      }
    }
    return [x, z, hit];
  }

  // Segment vs shapes. mode: 'sight' | 'bullets'. Returns {t, shape, conceal} for the first blocking shape.
  segment(ax, ay, az, bx, by, bz, mode = 'sight', ignore = null) {
    const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz);
    const minx = Math.min(ax, bx), maxx = Math.max(ax, bx), minz = Math.min(az, bz), maxz = Math.max(az, bz);
    const cx = (minx + maxx) / 2, cz = (minz + maxz) / 2;
    const near = this.query(cx, cz, Math.max(maxx - minx, maxz - minz) / 2 + 2, this._q2 || (this._q2 = []));
    let best = 2, bestS = null, conceal = 0;
    for (const s of near) {
      if (s === ignore) continue;
      const blocks = mode === 'sight' ? s.sight : s.bullets;
      if (!blocks && !s.conceal) continue;
      let t0, t1;
      if (s.kind === 'circle') {
        const fx = ax - s.x, fz = az - s.z;
        const a = dx * dx + dz * dz, b = 2 * (fx * dx + fz * dz), c = fx * fx + fz * fz - s.r * s.r;
        const disc = b * b - 4 * a * c; if (disc < 0 || a < 1e-9) continue;
        const sq = Math.sqrt(disc); t0 = (-b - sq) / (2 * a); t1 = (-b + sq) / (2 * a);
      } else {
        const [lax, laz] = this._local(s, ax, az), [lbx, lbz] = this._local(s, bx, bz);
        const ddx = lbx - lax, ddz = lbz - laz;
        let tmin = -Infinity, tmax = Infinity;
        for (const [o, d, e] of [[lax, ddx, s.hw], [laz, ddz, s.hd]]) {
          if (Math.abs(d) < 1e-9) { if (o < -e || o > e) { tmin = 1; tmax = 0; } }
          else { let u = (-e - o) / d, v = (e - o) / d; if (u > v) [u, v] = [v, u]; tmin = Math.max(tmin, u); tmax = Math.min(tmax, v); }
        }
        if (tmin > tmax) continue; t0 = tmin; t1 = tmax;
      }
      if (t1 < 0 || t0 > 1) continue;
      t0 = Math.max(0, t0); t1 = Math.min(1, t1);
      // vertical test at entry, middle and exit
      const top = s.y0 + s.h, bot = s.y0 - 0.3;
      let inside = false;
      for (const t of [t0, (t0 + t1) / 2, t1]) { const y = ay + (by - ay) * t; if (y < top && y > bot) { inside = true; break; } }
      if (!inside) continue;
      if (blocks) { if (t0 < best) { best = t0; bestS = s; } }
      else conceal = Math.max(conceal, s.conceal * Math.min(1, (t1 - t0) * len / 1.5));
    }
    return bestS ? { t: best, shape: bestS, conceal } : { t: 2, shape: null, conceal };
  }

  // Concealment at a point for a body whose top is at topY (bush or crop the body stands in)
  concealAt(x, z, topY) {
    const near = this.query(x, z, 2, this._q3 || (this._q3 = []));
    let c = 0;
    for (const s of near) {
      if (!s.conceal) continue;
      let inside;
      if (s.kind === 'circle') inside = Math.hypot(x - s.x, z - s.z) < s.r + 0.2;
      else { const [lx, lz] = this._local(s, x, z); inside = Math.abs(lx) < s.hw + 0.2 && Math.abs(lz) < s.hd + 0.2; }
      if (inside && s.y0 + s.h > topY - 0.25) c = Math.max(c, s.conceal);
    }
    return c;
  }

  // Candidate cover positions around point, protected from a threat position. Returns sorted list.
  findCover(x, z, threatX, threatZ, maxDist = 14, minHeight = 0.8) {
    const near = this.query(x, z, maxDist, this._q4 || (this._q4 = []));
    const out = [];
    for (const s of near) {
      if (!s.cover || s.h < minHeight) continue;
      let tx = s.x - threatX, tz = s.z - threatZ; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
      let reach;
      if (s.kind === 'circle') reach = s.r;
      else { const [lx, lz] = [tx * s.cos + tz * s.sin, -tx * s.sin + tz * s.cos]; reach = Math.abs(lx) * s.hw + Math.abs(lz) * s.hd; reach = Math.min(reach, Math.hypot(s.hw, s.hd)); }
      const px = s.x + tx * (reach + 0.55), pz = s.z + tz * (reach + 0.55);
      const d = Math.hypot(px - x, pz - z);
      if (d > maxDist) continue;
      if (this.terrain && !this.terrain.inBounds(px, pz, 2)) continue;
      const [rx, rz, hit] = this.resolve(px, pz, 0.35);
      out.push({ x: rx, z: rz, shape: s, d, high: s.h > 1.4 });
    }
    out.sort((a, b) => a.d - b.d);
    return out;
  }
  // Nearest cover surface to the player (for the take-cover action)
  nearestCoverShape(x, z, maxDist = 1.6) {
    const near = this.query(x, z, maxDist + 4, this._q5 || (this._q5 = []));
    let best = null, bd = maxDist;
    for (const s of near) {
      if (!s.cover) continue;
      let d, nx, nz;
      if (s.kind === 'circle') { const dx = x - s.x, dz = z - s.z, l = Math.hypot(dx, dz) || 1; d = l - s.r; nx = dx / l; nz = dz / l; }
      else {
        const [lx, lz] = this._local(s, x, z);
        const cx = Math.max(-s.hw, Math.min(s.hw, lx)), cz = Math.max(-s.hd, Math.min(s.hd, lz));
        const ddx = lx - cx, ddz = lz - cz; d = Math.hypot(ddx, ddz);
        const l = d || 1; const [wx, wz] = [(ddx / l) * s.cos - (ddz / l) * s.sin, (ddx / l) * s.sin + (ddz / l) * s.cos]; nx = wx; nz = wz;
      }
      if (d < bd) { bd = d; best = { shape: s, d, nx, nz }; }
    }
    return best;
  }
}
