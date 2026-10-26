// Geometry builder: composes primitives into one vertex-coloured, non-indexed BufferGeometry.
// Every prop and character part in the game is authored with this (no external models).
import * as THREE from 'three';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const _c = new THREE.Color();

export class GeoBuilder {
  constructor() { this.pos = []; this.nor = []; this.col = []; }
  add(geo, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
    g.applyMatrix4(_m);
    if (!g.attributes.normal) g.computeVertexNormals();
    const P = g.attributes.position.array, N = g.attributes.normal.array;
    const cols = Array.isArray(color) ? color : null;
    if (!cols) _c.set(color);
    for (let i = 0; i < P.length; i += 3) {
      this.pos.push(P[i], P[i + 1], P[i + 2]); this.nor.push(N[i], N[i + 1], N[i + 2]);
      if (cols) { const c = cols[(i / 3) % cols.length]; this.col.push(c.r, c.g, c.b); }
      else this.col.push(_c.r, _c.g, _c.b);
    }
    return this;
  }
  box(w, h, d, color, x, y, z, rx, ry, rz) { return this.add(new THREE.BoxGeometry(w, h, d), color, x, y, z, rx, ry, rz); }
  // y is the bottom of the box (convenient for building on the ground)
  boxB(w, h, d, color, x = 0, y = 0, z = 0, ry = 0) { return this.add(new THREE.BoxGeometry(w, h, d), color, x, y + h / 2, z, 0, ry, 0); }
  cyl(rt, rb, h, seg, color, x, y, z, rx, ry, rz) { return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), color, x, y, z, rx, ry, rz); }
  cone(r, h, seg, color, x, y, z, rx, ry, rz) { return this.add(new THREE.ConeGeometry(r, h, seg), color, x, y, z, rx, ry, rz); }
  sphere(r, ws, hs, color, x, y, z, sx = 1, sy = 1, sz = 1) { return this.add(new THREE.SphereGeometry(r, ws, hs), color, x, y, z, 0, 0, 0, sx, sy, sz); }
  ico(r, detail, color, x, y, z, sx = 1, sy = 1, sz = 1, ry = 0) { return this.add(new THREE.IcosahedronGeometry(r, detail), color, x, y, z, 0, ry, 0, sx, sy, sz); }
  dodeca(r, color, x, y, z, sx = 1, sy = 1, sz = 1, ry = 0) { return this.add(new THREE.DodecahedronGeometry(r, 0), color, x, y, z, 0, ry, 0, sx, sy, sz); }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    return g;
  }
  get empty() { return this.pos.length === 0; }
}

// Parametric roof surface: tiled Korean roof with concave slopes and up-turned eave corners (cheoma).
// Hipped ends are fanned from the eave midpoint so the silhouette reads as a hip-and-gable roof.
export function koreanRoof(len, depth, height, { upturn = 0.45, shrink = 0.3, segU = 14, segV = 6 } = {}) {
  const pos = [];
  const f = (u, v, side) => {
    const x = (u - 0.5) * len * (1 - shrink * (1 - v));
    const z = side * v * depth / 2;
    const corner = Math.pow(Math.max(0, Math.abs(u - 0.5) * 2 - 0.5) / 0.5, 2) * v;
    const y = height * Math.pow(1 - v, 1.3) + upturn * corner;
    return [x, y, z];
  };
  for (const side of [-1, 1]) for (let i = 0; i < segU; i++) for (let j = 0; j < segV; j++) {
    const a = f(i / segU, j / segV, side), b = f((i + 1) / segU, j / segV, side), c = f(i / segU, (j + 1) / segV, side), d = f((i + 1) / segU, (j + 1) / segV, side);
    pos.push(...a, ...c, ...b, ...b, ...c, ...d);
  }
  for (const u of [0, 1]) {
    const E = [(u - 0.5) * len * 1.02, height * 0.08 + upturn * 0.2, 0];
    for (const side of [-1, 1]) for (let j = 0; j < segV; j++) pos.push(...f(u, j / segV, side), ...f(u, (j + 1) / segV, side), ...E);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

// Simple gable roof prism (two slopes + gable triangles)
export function gableRoof(len, depth, height, overhang = 0.4) {
  const L = len / 2 + overhang, D = depth / 2 + overhang;
  const v = [
    [-L, 0, -D], [L, 0, -D], [L, height, 0], [-L, height, 0], [-L, 0, D], [L, 0, D],
  ];
  const tri = (a, b, c) => [...v[a], ...v[b], ...v[c]];
  const pos = [
    ...tri(0, 3, 1), ...tri(1, 3, 2), // back slope
    ...tri(4, 5, 3), ...tri(5, 2, 3), // front slope
    ...tri(0, 4, 3), ...tri(1, 2, 5), // gables
    ...tri(0, 1, 4), ...tri(1, 5, 4), // underside
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

export const VC_MAT = () => new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
