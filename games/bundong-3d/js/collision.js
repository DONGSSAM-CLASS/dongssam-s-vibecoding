// 충돌: 축정렬 상자(AABB)와 원기둥. 계단·스탠드는 '오를 수 있는 높이'로 처리
const CELL = 8;
const grid = new Map();
const all = [];

function key(cx, cz) { return cx * 73856093 ^ cz * 19349663; }

function addToGrid(c) {
  const cx0 = Math.floor(c.x0 / CELL), cx1 = Math.floor(c.x1 / CELL);
  const cz0 = Math.floor(c.z0 / CELL), cz1 = Math.floor(c.z1 / CELL);
  for (let i = cx0; i <= cx1; i++) for (let j = cz0; j <= cz1; j++) {
    const k = key(i, j);
    let arr = grid.get(k);
    if (!arr) grid.set(k, (arr = []));
    arr.push(c);
  }
}

function removeFromGrid(c) {
  for (const arr of grid.values()) {
    const i = arr.indexOf(c);
    if (i >= 0) arr.splice(i, 1);
  }
}

// 상자 충돌체. y0~y1 사이를 막음
export function addBox(x0, x1, z0, z1, y0, y1, tag) {
  const c = { type: 'box', x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), y0, y1, tag, on: true };
  all.push(c);
  addToGrid(c);
  return c;
}

export function addBoxC(cx, cz, w, d, y0, y1, tag) {
  return addBox(cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2, y0, y1, tag);
}

export function addCyl(x, z, r, y0, y1, tag) {
  const c = { type: 'cyl', x, z, r, x0: x - r, x1: x + r, z0: z - r, z1: z + r, y0, y1, tag, on: true };
  all.push(c);
  addToGrid(c);
  return c;
}

export function removeCollider(c) {
  c.on = false;
  removeFromGrid(c);
  const i = all.indexOf(c);
  if (i >= 0) all.splice(i, 1);
}

// 움직이는 친구의 원기둥 충돌체를 공간 격자와 함께 갱신
export function moveCyl(c, x, z) {
  removeFromGrid(c);
  Object.assign(c, { x, z, x0: x - c.r, x1: x + c.r, z0: z - c.r, z1: z + c.r });
  addToGrid(c);
}

const tmp = [];
const seen = new Set();
function nearby(x, z, r) {
  tmp.length = 0;
  seen.clear();
  const cx0 = Math.floor((x - r) / CELL), cx1 = Math.floor((x + r) / CELL);
  const cz0 = Math.floor((z - r) / CELL), cz1 = Math.floor((z + r) / CELL);
  for (let i = cx0; i <= cx1; i++) for (let j = cz0; j <= cz1; j++) {
    const arr = grid.get(key(i, j));
    if (!arr) continue;
    for (const c of arr) if (c.on && !seen.has(c)) { seen.add(c); tmp.push(c); }
  }
  return tmp;
}

// 원(플레이어 발)과 충돌체가 수평으로 겹치는지
function overlaps(c, x, z, r) {
  if (c.type === 'box') {
    const nx = Math.max(c.x0, Math.min(x, c.x1));
    const nz = Math.max(c.z0, Math.min(z, c.z1));
    return (x - nx) ** 2 + (z - nz) ** 2 < r * r;
  }
  return (x - c.x) ** 2 + (z - c.z) ** 2 < (r + c.r) ** 2;
}

// 발밑 높이: 오를 수 있는(feet+step 이하) 충돌체 윗면 중 가장 높은 값
export function groundAt(x, z, feet, r = 0.3, step = 0.45) {
  let g = 0;
  for (const c of nearby(x, z, r)) {
    if (c.y1 <= feet + step && c.y1 > g && overlaps(c, x, z, r * 0.7)) g = c.y1;
  }
  return g;
}

// 천장 높이
export function ceilingAt(x, z, head, r = 0.3) {
  let ce = Infinity;
  for (const c of nearby(x, z, r)) {
    if (c.y0 >= head - 0.05 && c.y0 < ce && overlaps(c, x, z, r)) ce = c.y0;
  }
  return ce;
}

// 수평 밀어내기. pos(x,z)를 수정. feet~feet+h 구간의 장애물만
export function resolve(pos, r, feet, h, step = 0.45) {
  let hit = false;
  for (let iter = 0; iter < 3; iter++) {
    let moved = false;
    for (const c of nearby(pos.x, pos.z, r + 0.1)) {
      if (c.y1 <= feet + step || c.y0 >= feet + h) continue;
      if (c.type === 'box') {
        const nx = Math.max(c.x0, Math.min(pos.x, c.x1));
        const nz = Math.max(c.z0, Math.min(pos.z, c.z1));
        let dx = pos.x - nx, dz = pos.z - nz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 < 1e-8) {
          // 중심이 상자 안: 가장 가까운 면으로
          const ex = [pos.x - c.x0, c.x1 - pos.x, pos.z - c.z0, c.z1 - pos.z];
          const m = Math.min(...ex);
          if (m === ex[0]) pos.x = c.x0 - r;
          else if (m === ex[1]) pos.x = c.x1 + r;
          else if (m === ex[2]) pos.z = c.z0 - r;
          else pos.z = c.z1 + r;
        } else {
          const d = Math.sqrt(d2);
          pos.x = nx + (dx / d) * r;
          pos.z = nz + (dz / d) * r;
        }
        moved = hit = true;
      } else {
        const dx = pos.x - c.x, dz = pos.z - c.z;
        const rr = r + c.r;
        const d2 = dx * dx + dz * dz;
        if (d2 >= rr * rr) continue;
        const d = Math.sqrt(d2) || 1e-4;
        pos.x = c.x + (dx / d) * rr;
        pos.z = c.z + (dz / d) * rr;
        moved = hit = true;
      }
    }
    if (!moved) break;
  }
  return hit;
}

// 선분(광선)과 상자 충돌 거리. 없으면 Infinity
export function rayCast(ox, oy, oz, dx, dy, dz, maxD, ignoreTag) {
  let best = maxD;
  const mx = ox + dx * maxD * 0.5, mz = oz + dz * maxD * 0.5;
  for (const c of nearby(mx, mz, maxD * 0.5 + 1)) {
    if (ignoreTag && c.tag === ignoreTag) continue;
    let t0 = 0, t1 = best;
    const lo = c.type === 'box' ? [c.x0, c.y0, c.z0] : [c.x - c.r * 0.8, c.y0, c.z - c.r * 0.8];
    const hi = c.type === 'box' ? [c.x1, c.y1, c.z1] : [c.x + c.r * 0.8, c.y1, c.z + c.r * 0.8];
    const o = [ox, oy, oz], d = [dx, dy, dz];
    let ok = true;
    for (let a = 0; a < 3; a++) {
      if (Math.abs(d[a]) < 1e-9) {
        if (o[a] < lo[a] || o[a] > hi[a]) { ok = false; break; }
      } else {
        let ta = (lo[a] - o[a]) / d[a], tb = (hi[a] - o[a]) / d[a];
        if (ta > tb) [ta, tb] = [tb, ta];
        t0 = Math.max(t0, ta);
        t1 = Math.min(t1, tb);
        if (t0 > t1) { ok = false; break; }
      }
    }
    if (ok && t0 < best) best = t0;
  }
  return best;
}

export function colliderCount() { return all.length; }
