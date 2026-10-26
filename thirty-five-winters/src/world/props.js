// Prop kit: builds every environment piece procedurally and registers its collision.
// Region and season are passed in so Hanseong tiles, Manchurian mud walls, Chongqing shophouses and
// Burmese bamboo huts all come from period-appropriate shapes and colours.
import * as THREE from 'three';
import { GeoBuilder, koreanRoof, gableRoof, VC_MAT } from './geo.js';
import { makeRng } from '../engine/util.js';

export const windUniforms = { uTime: { value: 0 }, uWind: { value: 1 } };

function swayMaterial(base) {
  const m = base || VC_MAT();
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = windUniforms.uTime; sh.uniforms.uWind = windUniforms.uWind;
    sh.vertexShader = 'uniform float uTime; uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        float ph = instanceMatrix[3].x * 0.13 + instanceMatrix[3].z * 0.17;
      #else
        float ph = 0.0;
      #endif
      float sw = max(0.0, position.y - 1.2) * uWind;
      transformed.x += sin(uTime * 1.1 + ph) * 0.045 * sw;
      transformed.z += cos(uTime * 0.83 + ph) * 0.03 * sw;`);
  };
  return m;
}

// ---------- vegetation geometry (built once per kit) ----------
function treeGeo(type, season) {
  const B = new GeoBuilder();
  const autumn = season === 'autumn', winter = season === 'winter', spring = season === 'spring';
  if (type === 'pine') { // Korean red pine: orange-brown trunk, layered umbrella clumps
    B.cyl(0.14, 0.26, 6.5, 6, '#7d4a2c', 0, 3.25, 0, 0, 0, 0.06);
    B.cyl(0.05, 0.08, 2.2, 4, '#6b3e25', 0.7, 5.6, 0, 0, 0, -0.9);
    const g = winter ? '#47553f' : '#3f5a2e';
    B.ico(1.5, 0, g, 0.2, 7.0, 0, 1.4, 0.55, 1.2); B.ico(1.2, 0, g, 1.6, 6.0, 0.3, 1.2, 0.45, 1.0); B.ico(1.0, 0, '#4b6634', -0.8, 7.7, -0.4, 1.1, 0.45, 1.0);
    if (winter) { B.ico(1.2, 0, '#eef1f2', 0.2, 7.45, 0, 1.3, 0.25, 1.1); }
  } else if (type === 'larch') { // conical, gold in autumn, bare-ish in winter
    B.cyl(0.08, 0.2, 9, 5, '#5e4632', 0, 4.5, 0);
    const c = autumn ? '#c79a35' : winter ? '#6a5f52' : spring ? '#86a14a' : '#557a33';
    for (let i = 0; i < 4; i++) B.cone(1.7 - i * 0.35, 2.6, 7, c, 0, 3.2 + i * 1.6, 0, 0, i * 0.4, 0);
    if (winter) B.cone(0.9, 1.0, 7, '#eceff0', 0, 8.6, 0);
  } else if (type === 'birch') {
    B.cyl(0.08, 0.14, 7, 5, '#dcd8cc', 0, 3.5, 0);
    for (let i = 0; i < 5; i++) B.box(0.16, 0.05, 0.16, '#2b2a28', 0, 1 + i * 1.2, 0.0, 0, i, 0);
    const c = autumn ? '#d6b13f' : winter ? null : spring ? '#9cb85a' : '#6f9441';
    if (c) { B.ico(1.3, 0, c, 0.2, 6.2, 0, 1, 1.3, 1); B.ico(0.9, 0, c, -0.6, 5.2, 0.4); }
    else { B.cyl(0.02, 0.04, 2, 3, '#bfb9ad', 0.5, 6, 0, 0, 0, -0.6); B.cyl(0.02, 0.04, 2, 3, '#bfb9ad', -0.5, 5.6, 0.2, 0, 0, 0.7); }
  } else if (type === 'oak') {
    B.cyl(0.22, 0.34, 4, 6, '#5a4430', 0, 2, 0);
    const c = autumn ? '#a5562a' : winter ? null : spring ? '#7f9a45' : '#4f7031';
    if (c) { B.ico(2.1, 1, c, 0, 5.2, 0, 1.2, 0.85, 1.1); B.ico(1.3, 0, autumn ? '#c3772f' : '#5d7c38', 1.2, 4.8, 0.5); }
    else { for (let i = 0; i < 4; i++) B.cyl(0.04, 0.09, 2.6, 3, '#4e3d2d', Math.cos(i * 1.6) * 0.6, 4.6, Math.sin(i * 1.6) * 0.6, Math.sin(i) * 0.6, 0, Math.cos(i * 1.6) * 0.7); }
  } else if (type === 'poplar') {
    B.cyl(0.12, 0.2, 7, 5, '#6b5e4a', 0, 3.5, 0);
    B.ico(1.1, 0, autumn ? '#c9a640' : '#5c7d36', 0, 7.0, 0, 1, 2.6, 1);
  } else if (type === 'willow') {
    B.cyl(0.25, 0.35, 3.5, 6, '#5d4d3a', 0, 1.75, 0, 0, 0, 0.12);
    const c = autumn ? '#b0a14a' : '#7f9b47';
    B.ico(2.2, 1, c, 0.3, 4.4, 0, 1.2, 0.9, 1.2);
    for (let i = 0; i < 8; i++) B.box(0.25, 2.4, 0.25, c, Math.cos(i * 0.8) * 1.9, 3.0, Math.sin(i * 0.8) * 1.9);
  } else if (type === 'bamboo') {
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4, r = 0.15 + (i % 3) * 0.25, h = 6 + (i % 4);
      B.cyl(0.05, 0.07, h, 5, '#6f8a3c', Math.cos(a) * r, h / 2, Math.sin(a) * r, Math.sin(a) * 0.06, 0, Math.cos(a) * 0.06);
      B.ico(0.6, 0, '#5d7f35', Math.cos(a) * r * 1.4, h - 0.5, Math.sin(a) * r * 1.4, 1.4, 0.5, 1.4);
    }
  } else if (type === 'palm') { // Burmese foothill palm / banana-like
    B.cyl(0.12, 0.2, 5.5, 6, '#6a5a3e', 0, 2.75, 0, 0, 0, 0.08);
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; B.box(0.5, 0.05, 2.6, '#4f7a2c', Math.cos(a) * 1.2, 5.4, Math.sin(a) * 1.2, 0.5 * Math.sin(a), -a, 0.5 * Math.cos(a)); }
  } else if (type === 'jungle') {
    B.cyl(0.25, 0.4, 11, 6, '#5a4a36', 0, 5.5, 0);
    B.ico(2.8, 1, '#355f26', 0, 11.5, 0, 1.4, 0.6, 1.3); B.ico(2.0, 0, '#2f5221', 1.8, 9.5, 0.6, 1.3, 0.6, 1.1);
    B.cyl(0.04, 0.04, 9, 3, '#3d5a28', 0.4, 5, 0.35); // hanging vine
  } else if (type === 'dead') {
    B.cyl(0.12, 0.22, 5, 5, '#4d4339', 0, 2.5, 0, 0.05, 0, 0.04);
    B.cyl(0.04, 0.07, 2, 3, '#4d4339', 0.5, 4, 0, 0, 0, -0.8); B.cyl(0.04, 0.06, 1.6, 3, '#4d4339', -0.4, 3.4, 0.2, 0.3, 0, 0.8);
  }
  return B.build();
}
function bushGeo(season, kind = 'bush') {
  const B = new GeoBuilder();
  if (kind === 'grass') {
    const c = season === 'winter' ? '#b7b29e' : season === 'autumn' ? '#a58f4e' : '#6f8a3a';
    for (let i = 0; i < 5; i++) B.cone(0.08, 0.6 + (i % 3) * 0.2, 3, c, Math.cos(i * 1.3) * 0.18, 0.3, Math.sin(i * 1.3) * 0.18, Math.sin(i) * 0.3, 0, Math.cos(i) * 0.3);
    return B.build();
  }
  if (kind === 'stalk') { // sorghum / maize
    const c = season === 'autumn' ? '#a5884a' : season === 'winter' ? '#9a8f73' : '#5f7d32';
    B.cyl(0.03, 0.04, 2.4, 4, c, 0, 1.2, 0);
    for (let i = 0; i < 4; i++) B.box(0.08, 0.02, 0.9, c, 0, 0.6 + i * 0.45, 0.3, -0.5, i * 1.7, 0);
    B.ico(0.14, 0, season === 'autumn' || season === 'winter' ? '#8a3f22' : '#7d6d3a', 0, 2.5, 0, 1, 1.8, 1);
    return B.build();
  }
  if (kind === 'fern') {
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; B.box(0.25, 0.03, 1.1, '#3f6d28', Math.cos(a) * 0.45, 0.5, Math.sin(a) * 0.45, 0.6 * Math.sin(a), -a, 0.6 * Math.cos(a)); }
    return B.build();
  }
  const c = season === 'autumn' ? '#8c5a2a' : season === 'winter' ? '#77705f' : season === 'spring' ? '#6f8c3f' : '#4c6a2c';
  B.ico(0.8, 0, c, 0, 0.55, 0, 1.2, 0.8, 1.1); B.ico(0.6, 0, c, 0.6, 0.45, 0.3); B.ico(0.55, 0, c, -0.5, 0.4, -0.3);
  if (season === 'winter') B.ico(0.7, 0, '#e8ebec', 0, 0.95, 0, 1.1, 0.3, 1);
  return B.build();
}
function rockGeo(seed) {
  const B = new GeoBuilder();
  const r = makeRng(seed);
  B.dodeca(1, '#7a776f', 0, 0.35, 0, 1 + r() * 0.4, 0.6 + r() * 0.3, 0.9 + r() * 0.4, r() * 3);
  B.dodeca(0.55, '#6e6b63', 0.6, 0.25, 0.3, 1, 0.7, 1, r() * 3);
  return B.build();
}

// ---------- flags ----------
// Era-variant taegukgi. Before the Provisional Government's 1942 unified specification (and the 1949
// standard), flags were hand-made with differing taegeuk curves, colour proportions and trigram sizes.
// These are stylised representations of that variety, not copies of specific artefacts.
export function flagTexture(style = '1919') {
  const cv = document.createElement('canvas'); cv.width = 384; cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = style === '1910' ? '#efe7d4' : style === '1919' ? '#f3ecdc' : '#f6f3ea'; g.fillRect(0, 0, 384, 256);
  const cx = 192, cy = 128;
  const R = style === '1910' ? 62 : style === '1919' ? 58 : 64;
  const tilt = { 1910: -0.15, 1919: 0.22, 1940: 0.59 }[style] ?? 0.4; // taegeuk axis differs between makers
  const red = style === '1940' ? '#b8282f' : '#a83a32', blue = style === '1940' ? '#1f3f84' : '#2c4a7c';
  g.save(); g.translate(cx, cy); g.rotate(tilt);
  g.fillStyle = blue; g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill();
  g.fillStyle = red; g.beginPath(); g.arc(0, 0, R, Math.PI, 0); g.fill();
  const k = style === '1910' ? 0.5 : 0.5;
  g.fillStyle = red; g.beginPath(); g.arc(R * k, 0, R * (1 - k), 0, Math.PI); g.fill();
  g.fillStyle = blue; g.beginPath(); g.arc(-R * (1 - k), 0, R * k, Math.PI, 0); g.fill();
  g.restore();
  // trigrams: geon (☰) upper-left, gon (☷) lower-right, gam (☵) upper-right, ri (☲) lower-left
  const tri = (x, y, ang, lines) => {
    g.save(); g.translate(x, y); g.rotate(ang); g.fillStyle = '#1b1b1b';
    const w = style === '1910' ? 58 : style === '1919' ? 50 : 54, h = style === '1910' ? 9 : 8, gap = style === '1910' ? 6 : 5;
    lines.forEach((broken, i) => {
      const yy = -((h + gap) * 1) + i * (h + gap) - h / 2;
      if (!broken) g.fillRect(-w / 2, yy, w, h); else { g.fillRect(-w / 2, yy, w * 0.44, h); g.fillRect(w * 0.06, yy, w * 0.44, h); }
    });
    g.restore();
  };
  const d = style === '1910' ? 118 : 112;
  const a = Math.atan2(128, 192);
  tri(cx - d * Math.cos(a) * 1.15, cy - d * Math.sin(a) * 1.15, -(Math.PI / 2 - a) + Math.PI / 2, [0, 0, 0]);
  tri(cx + d * Math.cos(a) * 1.15, cy + d * Math.sin(a) * 1.15, -(Math.PI / 2 - a) + Math.PI / 2, [1, 1, 1]);
  tri(cx + d * Math.cos(a) * 1.15, cy - d * Math.sin(a) * 1.15, (Math.PI / 2 - a) - Math.PI / 2, [1, 0, 1]);
  tri(cx - d * Math.cos(a) * 1.15, cy + d * Math.sin(a) * 1.15, (Math.PI / 2 - a) - Math.PI / 2, [0, 1, 0]);
  if (style !== '1940') { // hand-made cloth: uneven dye and creases
    for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(90,70,40,${Math.random() * 0.05})`; g.fillRect(Math.random() * 384, Math.random() * 256, 2, 2); }
    g.strokeStyle = 'rgba(80,60,30,0.12)'; g.lineWidth = 2; g.beginPath(); g.moveTo(130, 0); g.lineTo(140, 256); g.moveTo(270, 0); g.lineTo(260, 256); g.stroke();
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// ---------- the kit ----------
export class Kit {
  constructor(scene, world, terrain, { season = 'summer', region = 'manchuria', seed = 5 } = {}) {
    this.scene = scene; this.world = world; this.terrain = terrain;
    this.season = season; this.region = region;
    this.rng = makeRng(seed);
    this.mat = VC_MAT();
    this.swayMat = swayMaterial(VC_MAT());
    this.inst = new Map(); // key -> {geo, mat, list: [matrix,color]}
    this.group = new THREE.Group(); this.group.name = 'props'; scene.add(this.group);
    this.flags = [];
    this.animated = [];
    this.lights = [];
  }
  y(x, z) { return this.terrain.heightAt(x, z); }
  _mesh(geo, x, z, ry = 0, y = null, cast = true, mat = this.mat) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y ?? this.y(x, z), z); m.rotation.y = ry;
    m.castShadow = cast; m.receiveShadow = true;
    this.group.add(m); return m;
  }
  _instance(key, geoFn, x, z, ry, s, sway = false, tint = 1) {
    if (!this.inst.has(key)) this.inst.set(key, { geo: geoFn(), mat: sway ? this.swayMat : this.mat, list: [] });
    const o = new THREE.Object3D(); o.position.set(x, this.y(x, z) - 0.05, z); o.rotation.y = ry; o.scale.setScalar(s); o.updateMatrix();
    this.inst.get(key).list.push([o.matrix.clone(), tint]);
  }

  tree(type, x, z, s = 1) {
    const r = this.rng;
    this._instance('tree_' + type, () => treeGeo(type, this.season), x, z, r() * 6.28, s * (0.85 + r() * 0.3), true, 0.88 + r() * 0.24);
    const trunk = { pine: 0.26, larch: 0.2, birch: 0.14, oak: 0.34, poplar: 0.2, willow: 0.35, bamboo: 0.5, palm: 0.2, jungle: 0.4, dead: 0.22 }[type] * s;
    this.world.add({ kind: 'circle', x, z, r: Math.max(0.15, trunk), h: 8 * s, solid: true, sight: type !== 'bamboo', bullets: trunk > 0.18, cover: trunk >= 0.3, surface: 'wood' });
  }
  bush(x, z, s = 1) {
    this._instance('bush', () => bushGeo(this.season), x, z, this.rng() * 6.28, s, true, 0.85 + this.rng() * 0.3);
    this.world.add({ kind: 'circle', x, z, r: 0.9 * s, h: 1.05 * s, solid: false, sight: false, bullets: false, conceal: 0.65 });
  }
  fern(x, z, s = 1) {
    this._instance('fern', () => bushGeo(this.season, 'fern'), x, z, this.rng() * 6.28, s, true);
    this.world.add({ kind: 'circle', x, z, r: 0.9 * s, h: 0.9 * s, solid: false, sight: false, bullets: false, conceal: 0.5 });
  }
  grass(x, z, s = 1) { this._instance('grass', () => bushGeo(this.season, 'grass'), x, z, this.rng() * 6.28, s, true, 0.85 + this.rng() * 0.3); }
  rock(x, z, s = 1, big = false) {
    const key = 'rock' + (this.rng() < 0.5 ? 'a' : 'b');
    this._instance(key, () => rockGeo(key === 'rocka' ? 3 : 9), x, z, this.rng() * 6.28, s, false, 0.85 + this.rng() * 0.3);
    this.world.add({ kind: 'circle', x, z, r: 1.0 * s, h: (big ? 1.4 : 0.95) * s, solid: true, sight: true, cover: true, surface: 'stone' });
  }
  log(x, z, ry = 0, len = 4) {
    const B = new GeoBuilder();
    B.cyl(0.32, 0.36, len, 7, '#5f4a35', 0, 0.32, 0, 0, 0, Math.PI / 2);
    B.cyl(0.3, 0.3, 0.02, 7, '#a88a62', len / 2, 0.32, 0, 0, 0, Math.PI / 2); B.cyl(0.33, 0.33, 0.02, 7, '#a88a62', -len / 2, 0.32, 0, 0, 0, Math.PI / 2);
    this._mesh(B.build(), x, z, ry);
    this.world.add({ kind: 'box', x, z, hw: len / 2, hd: 0.36, rot: -ry, h: 0.8, cover: true, surface: 'wood' });
  }
  scatter(fn, area, count, avoid = []) {
    const r = this.rng; let n = 0, tries = 0;
    while (n < count && tries++ < count * 10) {
      let x, z;
      if (area.r) { const a = r() * 6.283, d = Math.sqrt(r()) * area.r; x = area.x + Math.cos(a) * d; z = area.z + Math.sin(a) * d; }
      else { x = area.x + (r() - 0.5) * area.w; z = area.z + (r() - 0.5) * area.d; }
      if (!this.terrain.inBounds(x, z, -18)) continue;
      if (avoid.some((a) => (a.path ? pointNearPath(x, z, a.path, a.w) : Math.hypot(x - a.x, z - a.z) < a.r))) continue;
      if (this.terrain.waterLevel > -50 && this.y(x, z) < this.terrain.waterLevel + 0.3) continue;
      fn(x, z, r); n++;
    }
  }
  forest(area, count, types, avoid = [], scale = [0.9, 1.25]) {
    this.scatter((x, z, r) => this.tree(r.pick(types), x, z, r.range(scale[0], scale[1])), area, count, avoid);
  }

  crops(area, kind = 'stalk') { // sorghum / maize field: dense instanced stalks + concealment volume
    const step = 0.9;
    for (let x = area.x - area.w / 2; x < area.x + area.w / 2; x += step) for (let z = area.z - area.d / 2; z < area.z + area.d / 2; z += step * 0.75) {
      if (this.rng() < 0.15) continue;
      this._instance('crop_' + kind, () => bushGeo(this.season, kind), x + (this.rng() - 0.5) * 0.3, z + (this.rng() - 0.5) * 0.3, this.rng() * 6.28, 0.85 + this.rng() * 0.3, true);
    }
    this.world.add({ kind: 'box', x: area.x, z: area.z, hw: area.w / 2, hd: area.d / 2, rot: 0, h: kind === 'stalk' ? 2.3 : 1.2, solid: false, sight: false, bullets: false, conceal: 0.85 });
  }

  // ---------- buildings ----------
  house(type, x, z, ry = 0, opt = {}) {
    const B = new GeoBuilder(); let w = 8, d = 4.6, h = 2.3;
    const roofMeshes = [];
    if (type === 'choga') { // Korean thatched house
      w = opt.w || 8; d = opt.d || 4.4; h = 2.1;
      B.boxB(w + 0.4, 0.35, d + 0.4, '#8b8478', 0, 0, 0);
      B.boxB(w, h, d, '#c4ab7d', 0, 0.35, 0);
      for (let i = 0; i <= 4; i++) B.boxB(0.18, h, 0.18, '#5b3f29', -w / 2 + i * w / 4, 0.35, d / 2 + 0.02);
      B.boxB(w + 0.1, 0.16, 0.2, '#5b3f29', 0, 0.35 + h - 0.16, d / 2 + 0.03);
      for (let i = 0; i < 3; i++) { // paper doors with lattice
        const dx = -w / 2 + w / 8 + i * w / 4 + w / 8 * 0.0 + w / 8;
        B.boxB(1.0, 1.6, 0.06, '#e6dcc2', dx - w / 8, 0.55, d / 2 + 0.03);
        B.boxB(1.0, 0.05, 0.08, '#6b4a30', dx - w / 8, 1.3, d / 2 + 0.05); B.boxB(0.05, 1.6, 0.08, '#6b4a30', dx - w / 8, 0.55, d / 2 + 0.05);
      }
      B.boxB(w * 0.75, 0.12, 0.8, '#7a5a3a', 0, 0.35, d / 2 + 0.5); // maru step
      const R = new GeoBuilder();
      R.sphere(1, 12, 6, opt.snow ? '#d9d6cc' : '#b39554', 0, 0, 0, w * 0.64, 1.35, d * 0.86);
      for (let i = -3; i <= 3; i++) R.box(0.06, 0.06, d * 1.65, '#6e5a33', i * w * 0.14, 0.05, 0, 0, 0, 0);
      const rg = R.build();
      rg.translate(0, 0.35 + h - 0.15, 0);
      // clip the lower hemisphere by squashing vertices below eave height
      const p = rg.attributes.position.array; for (let i = 1; i < p.length; i += 3) p[i] = Math.max(p[i], 0.35 + h - 0.2);
      rg.computeVertexNormals();
      roofMeshes.push(rg);
      if (opt.chimney !== false) B.boxB(0.5, 1.6, 0.5, '#9a8466', w / 2 + 0.9, 0, -d / 2 + 0.4);
    } else if (type === 'giwa') { // tiled house (Hanseong)
      w = opt.w || 9; d = opt.d || 5.2; h = 2.6;
      B.boxB(w + 0.6, 0.5, d + 0.6, '#9a958c', 0, 0, 0);
      B.boxB(w, h, d, '#e3dccb', 0, 0.5, 0);
      for (let i = 0; i <= 5; i++) B.boxB(0.22, h, 0.22, '#5a3b26', -w / 2 + i * w / 5, 0.5, d / 2 + 0.05);
      B.boxB(w + 0.2, 0.25, 0.26, '#5a3b26', 0, 0.5 + h - 0.25, d / 2 + 0.05);
      for (let i = 0; i < 5; i++) { B.boxB(1.4, 1.8, 0.06, '#efe5cc', -w / 2 + w / 10 + i * w / 5, 0.6, d / 2 + 0.06); B.boxB(1.4, 0.05, 0.08, '#6a4a32', -w / 2 + w / 10 + i * w / 5, 1.5, d / 2 + 0.08); }
      const rg = koreanRoof(w + 2.2, d + 2.6, 2.0, { upturn: 0.5 }); rg.translate(0, 0.5 + h - 0.1, 0);
      roofMeshes.push(colorize(rg, '#4a4c50'));
      const ridge = new GeoBuilder().box(w * 0.75, 0.28, 0.4, '#d9d4c8', 0, 0.5 + h + 1.95, 0).build(); roofMeshes.push(ridge);
    } else if (type === 'manchu') { // Manchurian/Korean settler mud-brick house with detached chimney
      w = opt.w || 9; d = opt.d || 5; h = 2.4;
      B.boxB(w, h, d, '#a88d68', 0, 0, 0);
      B.boxB(w + 0.05, 0.4, d + 0.05, '#8d7656', 0, 0, 0);
      B.boxB(1.0, 1.9, 0.08, '#4f3a28', -w / 4, 0, d / 2 + 0.02);
      B.boxB(1.2, 0.9, 0.08, '#d8cdb0', w / 6, 1.0, d / 2 + 0.02); B.boxB(1.2, 0.06, 0.1, '#4f3a28', w / 6, 1.45, d / 2 + 0.03);
      const rg = gableRoof(w, d, 1.3, 0.35); rg.translate(0, h, 0); roofMeshes.push(colorize(rg, opt.snow ? '#cfccc2' : '#7b6a52'));
      B.cyl(0.35, 0.45, 3.6, 6, '#8d7656', w / 2 + 1.0, 1.8, 0); // separate chimney (gul-ttuk)
    } else if (type === 'brick') { // Chinese grey brick house with tiled gable roof
      w = opt.w || 9; d = opt.d || 5.5; h = 3.0;
      B.boxB(w, h, d, '#7f7e7a', 0, 0, 0);
      B.boxB(1.2, 2.2, 0.1, '#7a2e24', 0, 0, d / 2 + 0.02);
      for (const s of [-1, 1]) { B.boxB(1.0, 1.0, 0.1, '#3a3632', s * w / 3, 1.3, d / 2 + 0.02); B.boxB(1.1, 0.12, 0.2, '#5d5b57', s * w / 3, 1.2, d / 2 + 0.05); }
      const rg = gableRoof(w, d, 1.7, 0.45); rg.translate(0, h, 0); roofMeshes.push(colorize(rg, '#4c4e52'));
      const ridge = new GeoBuilder().box(w + 0.9, 0.3, 0.35, '#3f4145', 0, h + 1.75, 0).box(0.4, 0.6, 0.35, '#3f4145', w / 2 + 0.3, h + 1.95, 0).box(0.4, 0.6, 0.35, '#3f4145', -w / 2 - 0.3, h + 1.95, 0).build();
      roofMeshes.push(ridge);
    } else if (type === 'shophouse') { // two-storey shophouse (Hankou, Andong, Chongqing)
      w = opt.w || 7; d = opt.d || 7; h = 6.2;
      B.boxB(w, h, d, opt.color || '#8e8578', 0, 0, 0);
      B.boxB(w - 0.6, 2.4, 0.12, '#4a3626', 0, 0, d / 2 + 0.02);
      for (let i = 0; i < 4; i++) B.boxB(0.12, 2.4, 0.16, '#2b2018', -w / 2 + 0.3 + i * (w - 0.6) / 3, 0, d / 2 + 0.06);
      B.boxB(w + 0.2, 0.15, 1.3, '#5a4330', 0, 3.0, d / 2 + 0.6); // balcony
      for (let i = 0; i < 9; i++) B.boxB(0.06, 0.9, 0.06, '#5a4330', -w / 2 + i * w / 8, 3.15, d / 2 + 1.2);
      B.boxB(w + 0.2, 0.08, 0.08, '#5a4330', 0, 4.05, d / 2 + 1.2);
      for (const s of [-1, 1]) B.boxB(1.4, 1.6, 0.1, '#2f2a26', s * w / 4, 3.6, d / 2 + 0.02);
      B.boxB(2.6, 0.6, 0.12, '#2a2a2a', 0, 2.55, d / 2 + 0.12); // blank signboard (no fabricated text)
      const rg = gableRoof(w, d, 1.5, 0.35); rg.translate(0, h, 0); roofMeshes.push(colorize(rg, '#45474b'));
      if (opt.lantern !== false) { this._lantern(x, z, ry, w, d); }
    } else if (type === 'western') { // brick commercial building (e.g. treaty-port trading house)
      w = opt.w || 12; d = opt.d || 9; h = 7.2;
      B.boxB(w, h, d, '#8a4f3c', 0, 0, 0);
      B.boxB(w + 0.3, 0.35, d + 0.3, '#d8d0c0', 0, h - 0.35, 0); B.boxB(w + 0.3, 0.25, d + 0.3, '#d8d0c0', 0, 3.4, 0);
      for (let f = 0; f < 2; f++) for (let i = 0; i < 5; i++) {
        B.boxB(1.0, 1.9, 0.1, '#2e3238', -w / 2 + 1.4 + i * (w - 2.8) / 4, 0.9 + f * 3.6, d / 2 + 0.02);
        B.boxB(1.2, 0.18, 0.2, '#d8d0c0', -w / 2 + 1.4 + i * (w - 2.8) / 4, 2.8 + f * 3.6, d / 2 + 0.05);
      }
      B.boxB(1.6, 2.6, 0.12, '#3b2a20', 0, 0, d / 2 + 0.03);
      const rg = gableRoof(w, d, 1.6, 0.25); rg.translate(0, h, 0); roofMeshes.push(colorize(rg, '#55524e'));
    } else if (type === 'hut') { // bamboo stilt hut (India–Burma border hills)
      w = opt.w || 6; d = opt.d || 4.5; h = 2.2;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.cyl(0.1, 0.1, 1.4, 5, '#6d5a3a', sx * (w / 2 - 0.2), 0.7, sz * (d / 2 - 0.2));
      B.boxB(w, 0.15, d, '#8a7445', 0, 1.3, 0);
      B.boxB(w, h, d, '#a8945c', 0, 1.45, 0);
      B.boxB(1.0, 1.6, 0.06, '#4d3c22', 0, 1.45, d / 2 + 0.02);
      const rg = gableRoof(w, d, 2.0, 0.7); rg.translate(0, 1.45 + h, 0); roofMeshes.push(colorize(rg, '#9e8a4e'));
      h += 1.45;
    } else if (type === 'barracks') {
      w = opt.w || 16; d = opt.d || 6; h = 2.8;
      B.boxB(w, h, d, opt.color || '#8b7253', 0, 0, 0);
      for (let i = 0; i < 6; i++) B.boxB(1.1, 0.9, 0.08, '#3a3430', -w / 2 + 1.6 + i * (w - 3.2) / 5, 1.2, d / 2 + 0.02);
      B.boxB(1.2, 2.1, 0.08, '#4a3626', w / 2 - 1.2, 0, d / 2 + 0.02);
      const rg = gableRoof(w, d, 1.5, 0.4); rg.translate(0, h, 0); roofMeshes.push(colorize(rg, opt.snow ? '#d0cdc3' : opt.roof || '#6b5a44'));
    } else if (type === 'storehouse') { // raised corn crib — the 1911 school began in borrowed storage
      w = opt.w || 7; d = opt.d || 4; h = 2.6;
      for (const sx of [-1, 0, 1]) for (const sz of [-1, 1]) B.boxB(0.25, 0.7, 0.25, '#5d4632', sx * (w / 2 - 0.2), 0, sz * (d / 2 - 0.2));
      for (let i = 0; i < 9; i++) B.boxB(w, 0.16, d, i % 2 ? '#8a6c47' : '#7a5d3c', 0, 0.7 + i * 0.22, 0);
      for (let i = 0; i < 12; i++) B.boxB(0.12, h - 0.7, 0.12, '#5d4632', -w / 2 + i * w / 11, 0.7, d / 2);
      B.boxB(1.3, 1.8, 0.1, '#4b3828', 0, 0.7, d / 2 + 0.06);
      const rg = gableRoof(w, d, 1.4, 0.5); rg.translate(0, h, 0); roofMeshes.push(colorize(rg, opt.snow ? '#d6d2c6' : '#a58c55'));
    } else if (type === 'tent') {
      w = opt.w || 4; d = opt.d || 3; h = 0.01;
      const rg = gableRoof(w, d, 2.1, 0.05); roofMeshes.push(colorize(rg, opt.color || '#8b8463'));
    } else if (type === 'ruin') { // burnt-out house: broken walls and charred posts, no roof
      w = opt.w || 8; d = opt.d || 4.6; h = 1.4;
      B.boxB(w, 0.5, d, '#4a443c', 0, 0, 0);
      B.boxB(w * 0.6, 1.3, 0.35, '#5d5246', -w * 0.2, 0, d / 2); B.boxB(0.35, 1.0, d * 0.7, '#5d5246', w / 2, 0, -d * 0.1); B.boxB(w * 0.4, 0.8, 0.35, '#544a40', w * 0.25, 0, -d / 2);
      for (let i = 0; i < 4; i++) B.boxB(0.2, 1.6 + (i % 2) * 0.9, 0.2, '#211b16', -w / 2 + 0.3 + i * w / 3.2, 0, (i % 2 ? 1 : -1) * d / 3, (i % 3) * 0.2);
      B.box(w * 0.7, 0.12, 0.18, '#1f1914', 0, 0.62, 0, 0.1, 0, 0.35);
    } else if (type === 'pavilion') { // gate house / reception hall (e.g. Chongqing guest house frontage)
      w = opt.w || 14; d = opt.d || 8; h = 4.2;
      B.boxB(w + 1, 0.6, d + 1, '#8f8a80', 0, 0, 0);
      B.boxB(w, h, d, '#d4c9b3', 0, 0.6, 0);
      for (let i = 0; i < 7; i++) B.boxB(0.35, h, 0.35, '#6d2f26', -w / 2 + i * w / 6, 0.6, d / 2 + 0.3);
      for (let i = 0; i < 4; i++) B.boxB(1.6, 2.6, 0.08, '#4a3a2c', -w / 2 + w / 8 + i * w / 4, 0.6, d / 2 + 0.05);
      const rg = gableRoof(w, d, 2.0, 1.0); rg.translate(0, 0.6 + h, 0); roofMeshes.push(colorize(rg, '#3f4246'));
      h += 0.6;
    }
    const geo = B.empty ? null : B.build();
    const y = opt.y ?? this._footY(x, z, w, d, ry);
    if (geo) this._mesh(geo, x, z, ry, y);
    for (const rg of roofMeshes) this._mesh(rg, x, z, ry, y);
    if (type !== 'tent') this.world.add({ kind: 'box', x, z, hw: w / 2, hd: d / 2, rot: -ry, h: h + 1.5, y0: y, cover: true, surface: 'wood' });
    else this.world.add({ kind: 'box', x, z, hw: w / 2 + 0.05, hd: d / 2, rot: -ry, h: 2.1, y0: y, cover: false, bullets: false, surface: 'cloth' });
    return { x, z, ry, w, d, y };
  }
  _footY(x, z, w, d, ry) { // lowest corner so buildings never float
    let m = Infinity; const c = Math.cos(ry), s = Math.sin(ry);
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) { const lx = a * w / 2, lz = b * d / 2; m = Math.min(m, this.y(x + lx * c + lz * s, z - lx * s + lz * c)); }
    return m;
  }
  _lantern(x, z, ry, w, d) {
    const c = Math.cos(ry), s = Math.sin(ry);
    for (const sx of [-1, 1]) {
      const lx = sx * (w / 2 - 0.6), lz = d / 2 + 0.5;
      const px = x + lx * c + lz * s, pz = z - lx * s + lz * c;
      const B = new GeoBuilder(); B.sphere(0.22, 8, 6, '#b0402c', 0, 0, 0, 1, 1.3, 1); B.cyl(0.02, 0.02, 0.4, 3, '#222', 0, 0.45, 0);
      const m = this._mesh(B.build(), px, pz, 0, this._footY(x, z, w, d, ry) + 2.2, false);
      m.material = new THREE.MeshBasicMaterial({ vertexColors: true });
      this.lights.push({ x: px, y: m.position.y, z: pz, color: '#ffb46b', intensity: 0.6, dist: 9 });
    }
  }

  wall(x1, z1, x2, z2, h = 1.2, style = 'stone') {
    const len = Math.hypot(x2 - x1, z2 - z1), ry = Math.atan2(-(z2 - z1), x2 - x1);
    const x = (x1 + x2) / 2, z = (z1 + z2) / 2;
    const B = new GeoBuilder();
    if (style === 'stone') { B.boxB(len, h, 0.6, '#8a857b'); for (let i = 0; i < len / 0.8; i++) B.box(0.7, 0.25, 0.65, i % 2 ? '#7a756c' : '#9a948a', -len / 2 + 0.4 + i * 0.8, h * (0.3 + 0.4 * (i % 3) / 2), 0); B.boxB(len + 0.1, 0.18, 0.7, '#6d6a62', 0, h, 0); }
    else if (style === 'earth') { B.boxB(len, h, 0.5, '#a08561'); B.boxB(len + 0.1, 0.25, 0.7, '#8b7c5a', 0, h, 0); }
    else if (style === 'sandbag') { for (let r = 0; r < Math.round(h / 0.28); r++) for (let i = 0; i < len / 0.7; i++) B.sphere(0.36, 6, 4, i % 2 ? '#8a7d5c' : '#7d7152', -len / 2 + 0.35 + i * 0.7 + (r % 2) * 0.3, 0.14 + r * 0.28, 0, 1, 0.42, 0.6); }
    else if (style === 'brick') { B.boxB(len, h, 0.45, '#7f7c77'); B.boxB(len + 0.1, 0.15, 0.6, '#5f5d58', 0, h, 0); }
    else if (style === 'palisade') { for (let i = 0; i < len / 0.28; i++) B.cyl(0.12, 0.13, h + (i % 3) * 0.15, 5, '#6b5539', -len / 2 + 0.14 + i * 0.28, (h + (i % 3) * 0.15) / 2, 0); }
    this._mesh(B.build(), x, z, ry, this.y(x, z) - 0.05);
    this.world.add({ kind: 'box', x, z, hw: len / 2, hd: 0.35, rot: -ry, h, cover: true, surface: style === 'sandbag' ? 'dirt' : 'stone' });
  }
  fence(points, style = 'brush') {
    for (let i = 0; i < points.length - 1; i++) {
      const [x1, z1] = points[i], [x2, z2] = points[i + 1];
      const len = Math.hypot(x2 - x1, z2 - z1), ry = Math.atan2(-(z2 - z1), x2 - x1), x = (x1 + x2) / 2, z = (z1 + z2) / 2;
      const B = new GeoBuilder();
      const n = Math.max(2, Math.round(len / 1.6));
      for (let k = 0; k <= n; k++) B.cyl(0.06, 0.07, 1.3, 4, '#6b5539', -len / 2 + k * len / n, 0.65, 0);
      if (style === 'brush') { B.boxB(len, 0.9, 0.18, '#8a7448', 0, 0.2, 0); for (let k = 0; k < len * 3; k++) B.box(0.04, 1.1, 0.04, '#7d6640', -len / 2 + k / 3, 0.65, 0.08, 0, 0, (k % 5 - 2) * 0.08); }
      else { B.box(len, 0.08, 0.06, '#7a6142', 0, 0.9, 0); B.box(len, 0.08, 0.06, '#7a6142', 0, 0.45, 0); }
      this._mesh(B.build(), x, z, ry, this.y(x, z) - 0.05);
      this.world.add({ kind: 'box', x, z, hw: len / 2, hd: 0.15, rot: -ry, h: 1.15, solid: true, sight: style === 'brush', bullets: false, cover: false, conceal: style === 'brush' ? 0 : 0 });
    }
  }
  crates(x, z, ry = 0, n = 3, kind = 'crate') {
    const B = new GeoBuilder();
    for (let i = 0; i < n; i++) {
      const ox = (i % 2) * 0.95 - 0.45, oy = Math.floor(i / 2) * 0.82, oz = 0;
      if (kind === 'sack') B.sphere(0.45, 7, 5, i % 2 ? '#b8a77f' : '#a8976e', ox, 0.25 + oy * 0.6, oz, 1.1, 0.55, 0.75);
      else { B.boxB(0.9, 0.8, 0.8, i % 2 ? '#7d6243' : '#8a6d4a', ox, oy, oz); B.boxB(0.92, 0.1, 0.82, '#5d4630', ox, oy + 0.35, oz); }
    }
    this._mesh(B.build(), x, z, ry);
    const ht = kind === 'sack' ? 0.8 : n > 2 ? 1.6 : 0.8;
    this.world.add({ kind: 'box', x, z, hw: 1.0, hd: 0.5, rot: -ry, h: ht, cover: true, surface: 'wood' });
  }
  cart(x, z, ry = 0) {
    const B = new GeoBuilder();
    B.boxB(2.4, 0.15, 1.3, '#6e5438', 0, 0.75, 0); B.boxB(2.4, 0.4, 0.08, '#6e5438', 0, 0.9, 0.62); B.boxB(2.4, 0.4, 0.08, '#6e5438', 0, 0.9, -0.62);
    for (const s of [-1, 1]) { B.cyl(0.62, 0.62, 0.1, 10, '#4e3b28', 0, 0.62, s * 0.75, Math.PI / 2, 0, 0); B.cyl(0.12, 0.12, 0.14, 6, '#3a2b1d', 0, 0.62, s * 0.75, Math.PI / 2, 0, 0); }
    B.box(2.6, 0.08, 0.08, '#6e5438', 2.4, 0.8, 0.35, 0, 0, -0.15); B.box(2.6, 0.08, 0.08, '#6e5438', 2.4, 0.8, -0.35, 0, 0, -0.15);
    this._mesh(B.build(), x, z, ry);
    this.world.add({ kind: 'box', x, z, hw: 1.3, hd: 0.8, rot: -ry, h: 1.2, cover: true, bullets: true, surface: 'wood' });
  }
  telegraph(points, spacing = 28) {
    const poles = [];
    for (let i = 0; i < points.length - 1; i++) {
      const [x1, z1] = points[i], [x2, z2] = points[i + 1]; const len = Math.hypot(x2 - x1, z2 - z1); const n = Math.max(1, Math.floor(len / spacing));
      for (let k = 0; k < n; k++) poles.push([x1 + (x2 - x1) * k / n, z1 + (z2 - z1) * k / n]);
    }
    poles.push(points[points.length - 1]);
    const B = new GeoBuilder();
    B.cyl(0.1, 0.13, 7, 5, '#5b4a38', 0, 3.5, 0); B.box(1.4, 0.1, 0.1, '#5b4a38', 0, 6.6, 0);
    const geo = B.build();
    const tops = [];
    for (const [x, z] of poles) { this._mesh(geo, x, z, 0); tops.push(new THREE.Vector3(x, this.y(x, z) + 6.65, z)); this.world.add({ kind: 'circle', x, z, r: 0.14, h: 7, cover: false }); }
    for (const off of [-0.6, 0.6]) {
      const pts = []; for (let i = 0; i < tops.length - 1; i++) { for (let k = 0; k <= 8; k++) { const t = k / 8; const p = tops[i].clone().lerp(tops[i + 1], t); p.y -= Math.sin(t * Math.PI) * 0.6; p.x += off; pts.push(p); } }
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#2a2622' }));
      this.group.add(line);
    }
    return poles;
  }
  tramTracks(points) {
    for (let i = 0; i < points.length - 1; i++) {
      const [x1, z1] = points[i], [x2, z2] = points[i + 1]; const len = Math.hypot(x2 - x1, z2 - z1), ry = Math.atan2(-(z2 - z1), x2 - x1);
      const B = new GeoBuilder(); B.box(len, 0.06, 0.08, '#4b4844', 0, 0.03, -0.72); B.box(len, 0.06, 0.08, '#4b4844', 0, 0.03, 0.72);
      for (let k = 0; k < len / 1.2; k++) B.box(0.25, 0.04, 2.0, '#5a4a3a', -len / 2 + k * 1.2, 0.0, 0);
      const x = (x1 + x2) / 2, z = (z1 + z2) / 2; this._mesh(B.build(), x, z, ry, this.y(x, z) + 0.02, false);
    }
  }
  lamp(x, z) {
    const B = new GeoBuilder(); B.cyl(0.07, 0.1, 3.4, 5, '#2d2b29', 0, 1.7, 0); B.box(0.5, 0.06, 0.06, '#2d2b29', 0.25, 3.35, 0);
    const m = this._mesh(B.build(), x, z, 0);
    const g = new GeoBuilder().box(0.26, 0.34, 0.26, '#ffd9a0', 0.48, 3.15, 0).build();
    const l = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true })); l.position.copy(m.position); this.group.add(l);
    this.lights.push({ x: x + 0.48, y: m.position.y + 3.1, z, color: '#ffc27a', intensity: 0.9, dist: 14 });
    this.world.add({ kind: 'circle', x, z, r: 0.12, h: 3.4, cover: false });
  }
  boat(x, z, ry = 0, y = null) {
    const B = new GeoBuilder();
    B.box(4.2, 0.5, 1.3, '#5c4834', 0, 0.25, 0); B.box(1.0, 0.45, 0.9, '#5c4834', 2.4, 0.35, 0, 0, 0, 0.3); B.box(0.9, 0.45, 0.9, '#5c4834', -2.3, 0.35, 0, 0, 0, -0.3);
    B.box(1.6, 0.8, 1.2, '#8b7a5a', -0.6, 0.85, 0); B.cyl(0.04, 0.04, 3.5, 4, '#4d3b29', 1.1, 2.0, 0);
    this._mesh(B.build(), x, z, ry, y ?? this.terrain.waterLevel + 0.05);
  }
  bridge(x1, z1, x2, z2, width = 3, y = null) {
    const len = Math.hypot(x2 - x1, z2 - z1), ry = Math.atan2(-(z2 - z1), x2 - x1), x = (x1 + x2) / 2, z = (z1 + z2) / 2;
    const B = new GeoBuilder();
    B.box(len, 0.2, width, '#6e5a42', 0, 0, 0);
    for (let k = 0; k < len / 0.5; k++) B.box(0.45, 0.06, width, k % 2 ? '#7d6750' : '#6b5640', -len / 2 + 0.25 + k * 0.5, 0.12, 0);
    for (const s of [-1, 1]) { B.box(len, 0.1, 0.1, '#5a4734', 0, 0.9, s * width / 2); for (let k = 0; k <= len / 2.5; k++) B.box(0.12, 0.9, 0.12, '#5a4734', -len / 2 + k * 2.5, 0.45, s * width / 2); }
    for (let k = 1; k < len / 6; k++) B.box(0.3, 4, 0.3, '#4d3d2c', -len / 2 + k * 6, -2, 0);
    const yy = y ?? Math.max(this.y(x1, z1), this.y(x2, z2)) + 0.2;
    this._mesh(B.build(), x, z, ry, yy);
    this.bridges = this.bridges || []; this.bridges.push({ x, z, len, width, ry, y: yy + 0.15 });
  }
  table(x, z, ry = 0, items = true) {
    const B = new GeoBuilder();
    B.boxB(1.6, 0.06, 0.9, '#6d5238', 0, 0.74, 0); for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.boxB(0.07, 0.74, 0.07, '#5a4430', sx * 0.72, 0, sz * 0.38);
    if (items) { B.boxB(0.5, 0.02, 0.35, '#e8dfc8', -0.3, 0.8, 0, 0.2); B.boxB(0.4, 0.02, 0.3, '#ddd2b6', 0.25, 0.8, 0.1, -0.3); B.cyl(0.05, 0.05, 0.12, 6, '#2b2b2b', 0.55, 0.86, -0.2); }
    this._mesh(B.build(), x, z, ry);
    this.world.add({ kind: 'box', x, z, hw: 0.8, hd: 0.45, rot: -ry, h: 0.8, cover: false, sight: false, bullets: false });
  }
  campfire(x, z) {
    const B = new GeoBuilder();
    for (let i = 0; i < 7; i++) B.dodeca(0.18, '#5c5852', Math.cos(i * 0.9) * 0.55, 0.08, Math.sin(i * 0.9) * 0.55);
    for (let i = 0; i < 4; i++) B.cyl(0.05, 0.06, 0.9, 4, '#3e2e1f', Math.cos(i * 1.6) * 0.12, 0.2, Math.sin(i * 1.6) * 0.12, Math.sin(i * 1.6) * 0.9, 0, Math.cos(i * 1.6) * 0.9);
    this._mesh(B.build(), x, z, 0);
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.7, 5), new THREE.MeshBasicMaterial({ color: '#ffae4a', transparent: true, opacity: 0.85 }));
    fl.position.set(x, this.y(x, z) + 0.45, z); this.group.add(fl);
    this.animated.push((t) => { fl.scale.set(1 + Math.sin(t * 13) * 0.12, 1 + Math.sin(t * 9.7) * 0.25, 1 + Math.cos(t * 11) * 0.12); fl.rotation.y = t * 2; });
    this.lights.push({ x, y: this.y(x, z) + 0.8, z, color: '#ff9a4a', intensity: 1.6, dist: 14, flicker: true });
    return { x, z };
  }
  flag(x, z, style = '1919', height = 5, ry = 0) {
    const B = new GeoBuilder(); B.cyl(0.04, 0.05, height, 5, '#6a5136', 0, height / 2, 0); B.sphere(0.07, 6, 4, '#c8a050', 0, height + 0.05, 0);
    this._mesh(B.build(), x, z, ry);
    const geo = new THREE.PlaneGeometry(1.5, 1.0, 12, 4); geo.translate(0.75, 0, 0);
    const mat = new THREE.MeshLambertMaterial({ map: flagTexture(style), side: THREE.DoubleSide });
    const m = new THREE.Mesh(geo, mat); m.position.set(x, this.y(x, z) + height - 0.55, z); m.rotation.y = ry; m.castShadow = true;
    this.group.add(m);
    const base = geo.attributes.position.array.slice();
    this.animated.push((t) => {
      const p = geo.attributes.position.array;
      for (let i = 0; i < p.length; i += 3) { const u = base[i] / 1.5; p[i + 2] = Math.sin(t * 3 + base[i] * 3.2) * 0.12 * u; p[i + 1] = base[i + 1] - u * u * 0.05; }
      geo.attributes.position.needsUpdate = true; geo.computeVertexNormals();
    });
    this.world.add({ kind: 'circle', x, z, r: 0.06, h: height, cover: false, sight: false });
    return m;
  }
  banner(x, z, ry, w = 3, color = '#e9e2cf') { // cloth banner with abstract brush strokes (no invented slogans)
    const B = new GeoBuilder(); for (const s of [-1, 1]) B.cyl(0.05, 0.05, 3, 4, '#6a5136', s * w / 2, 1.5, 0);
    B.box(w, 0.9, 0.03, color, 0, 2.4, 0);
    for (let i = 0; i < 5; i++) B.box(0.12, 0.5, 0.04, '#2a2522', -w / 2 + 0.5 + i * (w - 1) / 4, 2.4, 0.02, 0, 0, (i % 2 ? 0.3 : -0.2));
    this._mesh(B.build(), x, z, ry);
  }
  target(x, z, ry = 0) {
    const B = new GeoBuilder();
    B.cyl(0.06, 0.06, 1.6, 4, '#5b4632', 0, 0.8, 0); B.box(0.08, 0.08, 0.9, '#5b4632', 0, 1.2, 0, 0, Math.PI / 2, 0);
    const T = new GeoBuilder(); T.cyl(0.45, 0.45, 0.12, 14, '#c9b27a', 0, 0, 0, Math.PI / 2, 0, 0); T.cyl(0.3, 0.3, 0.13, 14, '#e9e0c8', 0, 0, 0, Math.PI / 2, 0, 0); T.cyl(0.12, 0.12, 0.14, 10, '#2a2a2a', 0, 0, 0, Math.PI / 2, 0, 0);
    const post = this._mesh(B.build(), x, z, ry);
    const face = new THREE.Mesh(T.build(), this.mat); face.position.set(x, post.position.y + 1.55, z); face.rotation.y = ry; face.castShadow = true; this.group.add(face);
    const shape = this.world.add({ kind: 'circle', x, z, r: 0.45, h: 2.0, solid: true, sight: false, bullets: true, cover: false, surface: 'wood' });
    return { x, z, y: post.position.y + 1.55, face, shape, hit: false };
  }
  stretcher(x, z, ry = 0) {
    const B = new GeoBuilder(); B.boxB(2.0, 0.05, 0.6, '#9b8f6d', 0, 0.3, 0); for (const s of [-1, 1]) B.box(2.4, 0.05, 0.05, '#5d4a36', 0, 0.32, s * 0.32);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.boxB(0.05, 0.3, 0.05, '#5d4a36', sx * 0.9, 0, sz * 0.3);
    this._mesh(B.build(), x, z, ry);
  }
  radio(x, z, ry = 0) {
    const B = new GeoBuilder(); B.boxB(0.6, 0.4, 0.35, '#4a4f3c', 0, 0.8, 0); B.boxB(0.5, 0.25, 0.04, '#2a2c26', 0, 0.86, 0.18);
    B.cyl(0.01, 0.01, 1.6, 3, '#222', 0.25, 1.9, 0); for (let i = 0; i < 3; i++) B.cyl(0.03, 0.03, 0.03, 6, '#c9c4b0', -0.15 + i * 0.12, 1.0, 0.2, Math.PI / 2, 0, 0);
    this._mesh(B.build(), x, z, ry);
  }
  loudspeaker(x, z, ry = 0) {
    const B = new GeoBuilder(); B.cyl(0.05, 0.06, 2.6, 5, '#4d4031', 0, 1.3, 0); B.cone(0.35, 0.8, 8, '#5f6158', 0, 2.5, 0.3, Math.PI / 2, 0, 0);
    this._mesh(B.build(), x, z, ry);
  }
  well(x, z) {
    const B = new GeoBuilder(); B.cyl(0.8, 0.85, 0.8, 10, '#8a857b', 0, 0.4, 0); B.cyl(0.62, 0.62, 0.82, 10, '#2a2a28', 0, 0.42, 0);
    for (const s of [-1, 1]) B.boxB(0.12, 1.8, 0.12, '#5d4632', s * 0.8, 0.2, 0); B.box(1.8, 0.1, 0.1, '#5d4632', 0, 1.95, 0);
    this._mesh(B.build(), x, z, 0); this.world.add({ kind: 'circle', x, z, r: 0.85, h: 0.8, cover: true, surface: 'stone' });
  }
  pots(x, z) { // jangdokdae — row of earthenware crocks
    const B = new GeoBuilder(); for (let i = 0; i < 5; i++) B.sphere(0.35 - (i % 2) * 0.08, 8, 6, '#5a3a24', (i - 2) * 0.7, 0.35, (i % 2) * 0.4, 1, 1.1, 1);
    this._mesh(B.build(), x, z, 0); this.world.add({ kind: 'box', x, z, hw: 1.8, hd: 0.6, rot: 0, h: 0.75, cover: true, surface: 'stone' });
  }
  hay(x, z, s = 1) {
    const B = new GeoBuilder(); B.cone(1.2, 2.0, 8, this.season === 'winter' ? '#cbc6b5' : '#b39554', 0, 1.0, 0); B.cyl(1.2, 1.2, 0.5, 8, '#a38749', 0, 0.25, 0);
    this._mesh(B.build(), x, z, this.rng() * 6); this.world.add({ kind: 'circle', x, z, r: 1.1 * s, h: 1.9, cover: true, bullets: false, surface: 'grass' });
  }
  trenchLine(points) { // shallow earthwork with sandbag lip
    for (let i = 0; i < points.length - 1; i++) this.wall(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1], 0.85, 'sandbag');
  }
  signpost(x, z, ry = 0) {
    const B = new GeoBuilder(); B.cyl(0.06, 0.07, 2, 4, '#5d4632', 0, 1, 0); B.box(0.9, 0.25, 0.04, '#9b845e', 0.3, 1.7, 0); B.box(0.8, 0.22, 0.04, '#8f7a56', -0.2, 1.35, 0, 0, 0.6, 0);
    this._mesh(B.build(), x, z, ry);
  }

  finalize() {
    for (const [key, v] of this.inst) {
      const im = new THREE.InstancedMesh(v.geo, v.mat, v.list.length);
      const col = new THREE.Color();
      v.list.forEach(([m, tint], i) => { im.setMatrixAt(i, m); im.setColorAt(i, col.setScalar(tint)); });
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.castShadow = !key.startsWith('grass') && !key.startsWith('crop'); im.receiveShadow = true;
      im.computeBoundingSphere();
      im.name = key;
      this.group.add(im);
    }
    this.inst.clear();
  }
  update(t) { for (const f of this.animated) f(t); }
}

function colorize(geo, hex) {
  const n = geo.attributes.position.count, c = new THREE.Color(hex), arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const v = 0.92 + ((i * 7919) % 17) / 17 * 0.12; arr[i * 3] = c.r * v; arr[i * 3 + 1] = c.g * v; arr[i * 3 + 2] = c.b * v; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}
function pointNearPath(x, z, path, w) {
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, az] = path[i], [bx, bz] = path[i + 1];
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
    if (Math.hypot(x - ax - dx * t, z - az - dz * t) < w) return true;
  }
  return false;
}
