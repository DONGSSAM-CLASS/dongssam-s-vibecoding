// Coarse navigation grid with A* and line-of-walk smoothing, so companions, civilians and searching
// soldiers route around houses, walls, water and cliffs instead of sliding along them.
export class NavGrid {
  constructor(terrain, world, cell = 2) {
    this.t = terrain; this.w = world; this.cell = cell;
    this.n = Math.ceil(terrain.size / cell);
    this.half = terrain.size / 2;
    this.block = new Uint8Array(this.n * this.n);
    this.cost = new Float32Array(this.n * this.n);
    this.build();
  }
  build() {
    const { n, cell, half, t } = this;
    const q = [];
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = -half + (i + 0.5) * cell, z = -half + (j + 0.5) * cell, k = j * n + i;
      let b = 0, c = 1;
      if (!t.inBounds(x, z, 1)) b = 1;
      const sl = t.slopeAt(x, z).mag;
      if (sl > 1.25) b = 1; else if (sl > 0.7) c += (sl - 0.7) * 3;
      if (t.waterLevel > -50 && t.heightAt(x, z) < t.waterLevel - 0.35) b = 1;
      if (!b) {
        this.w.query(x, z, cell, q);
        for (const s of q) {
          if (!s.solid || s.h < 0.5) continue;
          let inside;
          if (s.kind === 'circle') inside = Math.hypot(x - s.x, z - s.z) < s.r + 0.45;
          else { const [lx, lz] = this.w._local(s, x, z); inside = Math.abs(lx) < s.hw + 0.45 && Math.abs(lz) < s.hd + 0.45; }
          if (inside) { b = 1; break; }
        }
      }
      // bridges override water
      for (const br of t.bridges || []) {
        const dx = x - br.x, dz = z - br.z, c0 = Math.cos(-br.ry), s0 = Math.sin(-br.ry);
        const lx = dx * c0 + dz * s0, lz = -dx * s0 + dz * c0;
        if (Math.abs(lx) < br.len / 2 && Math.abs(lz) < br.width / 2) { b = 0; c = 1; }
      }
      this.block[k] = b; this.cost[k] = c;
    }
  }
  idx(x, z) {
    const i = Math.floor((x + this.half) / this.cell), j = Math.floor((z + this.half) / this.cell);
    if (i < 0 || j < 0 || i >= this.n || j >= this.n) return -1;
    return j * this.n + i;
  }
  center(k) { const i = k % this.n, j = Math.floor(k / this.n); return [-this.half + (i + 0.5) * this.cell, -this.half + (j + 0.5) * this.cell]; }
  walkable(x, z) { const k = this.idx(x, z); return k >= 0 && !this.block[k]; }
  nearestFree(x, z) {
    let k = this.idx(x, z); if (k >= 0 && !this.block[k]) return k;
    const i0 = Math.floor((x + this.half) / this.cell), j0 = Math.floor((z + this.half) / this.cell);
    for (let r = 1; r < 12; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
      const i = i0 + di, j = j0 + dj; if (i < 0 || j < 0 || i >= this.n || j >= this.n) continue;
      k = j * this.n + i; if (!this.block[k]) return k;
    }
    return -1;
  }
  lineWalkable(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az), steps = Math.ceil(d / (this.cell * 0.5));
    for (let s = 1; s < steps; s++) { const t = s / steps; if (!this.walkable(ax + (bx - ax) * t, az + (bz - az) * t)) return false; }
    return true;
  }
  find(ax, az, bx, bz, maxNodes = 6000) {
    if (this.lineWalkable(ax, az, bx, bz)) return [[bx, bz]];
    const n = this.n, start = this.nearestFree(ax, az), goal = this.nearestFree(bx, bz);
    if (start < 0 || goal < 0) return null;
    const g = new Map([[start, 0]]), came = new Map(), open = new Heap();
    const [gx, gz] = this.center(goal);
    const h = (k) => { const [x, z] = this.center(k); return Math.hypot(x - gx, z - gz); };
    open.push(start, h(start));
    const closed = new Set();
    let found = false, expanded = 0;
    while (open.size) {
      const cur = open.pop();
      if (cur === goal) { found = true; break; }
      if (closed.has(cur)) continue; closed.add(cur);
      if (++expanded > maxNodes) break;
      const ci = cur % n, cj = Math.floor(cur / n);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= n || j >= n) continue;
        const k = j * n + i; if (this.block[k] || closed.has(k)) continue;
        if (di && dj && (this.block[cj * n + i] || this.block[j * n + ci])) continue; // no corner cutting
        const step = (di && dj ? 1.414 : 1) * this.cell * (this.cost[k] + this.cost[cur]) * 0.5;
        const ng = g.get(cur) + step;
        if (ng < (g.get(k) ?? Infinity)) { g.set(k, ng); came.set(k, cur); open.push(k, ng + h(k)); }
      }
    }
    if (!found) return null;
    const path = []; let k = goal;
    while (k !== start && k != null) { path.push(this.center(k)); k = came.get(k); }
    path.reverse();
    path.push([bx, bz]);
    // string-pull smoothing
    const out = []; let ox = ax, oz = az, i = 0;
    while (i < path.length) {
      let j = path.length - 1;
      while (j > i && !this.lineWalkable(ox, oz, path[j][0], path[j][1])) j--;
      out.push(path[j]); [ox, oz] = path[j]; i = j + 1;
    }
    return out;
  }
}

class Heap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(v, p) { const a = this.a; a.push([p, v]); let i = a.length - 1; while (i > 0) { const q = (i - 1) >> 1; if (a[q][0] <= a[i][0]) break; [a[q], a[i]] = [a[i], a[q]]; i = q; } }
  pop() {
    const a = this.a, top = a[0][1], last = a.pop();
    if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } }
    return top;
  }
}
