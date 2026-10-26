// Heightfield terrain composed from authored features (valleys, ridges, flats, rivers, roads, fields).
// Heights are baked to a grid once; gameplay samples it bilinearly, so LOS and movement are cheap.
import * as THREE from 'three';
import { makeNoise, clamp, smooth, lerp, distToPolyline } from '../engine/util.js';

export const SURF = { dirt: 0, grass: 1, snow: 2, mud: 3, stone: 4, leaves: 5, road: 6, wood: 7, water: 8, sand: 9 };
const SURF_NAMES = Object.keys(SURF);

// biome palettes: [low grass, high grass, dirt, rock, snow, road, field, leafLitter]
export const BIOMES = {
  seoul_summer: { grass: '#6f7d3e', grass2: '#8a8a4a', dirt: '#8c7354', rock: '#7d7468', snow: 0, road: '#a39072', field: '#6d7a35', litter: '#7a6a3f', surf: 'dirt' },
  manchuria_spring: { grass: '#7a8a45', grass2: '#98935a', dirt: '#7b6447', rock: '#77716a', snow: 0, road: '#9a8466', field: '#5f6b2e', litter: '#6d6340', surf: 'dirt' },
  manchuria_summer: { grass: '#4f6b2c', grass2: '#6e7f39', dirt: '#6e5a3f', rock: '#6c6a62', snow: 0, road: '#8d7a5b', field: '#58722d', litter: '#4f5a2a', surf: 'grass' },
  manchuria_autumn: { grass: '#6f6a3a', grass2: '#8c7440', dirt: '#6a5038', rock: '#6f6a64', snow: 0, road: '#85705a', field: '#8f7a42', litter: '#8a5428', surf: 'leaves' },
  manchuria_winter: { grass: '#8f9188', grass2: '#a8a79c', dirt: '#6d6458', rock: '#666a6e', snow: 0.85, road: '#9c978c', field: '#9a9888', litter: '#857c6c', surf: 'snow' },
  manchuria_night_spring: { grass: '#5d6a3c', grass2: '#76764c', dirt: '#6a5842', rock: '#66625c', snow: 0, road: '#857360', field: '#56622e', litter: '#5a5236', surf: 'dirt' },
  manchuria_lateWinter: { grass: '#867f5c', grass2: '#9a9070', dirt: '#6e5b45', rock: '#6c6a66', snow: 0.45, road: '#8e7d66', field: '#7c7350', litter: '#7a6a4a', surf: 'mud' },
  siberia_summer: { grass: '#5e7a34', grass2: '#7f8f45', dirt: '#6b5a40', rock: '#6a6862', snow: 0, road: '#8a7a5c', field: '#5f7a30', litter: '#5a5a30', surf: 'grass' },
  china_river: { grass: '#5a7038', grass2: '#76803f', dirt: '#86704f', rock: '#77736a', snow: 0, road: '#9a876a', field: '#4f6e3a', litter: '#6a6038', surf: 'mud' },
  chongqing: { grass: '#5c6d3a', grass2: '#6f7a44', dirt: '#7e6a52', rock: '#76726c', snow: 0, road: '#8b8174', field: '#5b6e38', litter: '#5d5838', surf: 'stone' },
  anhui_plain: { grass: '#7d7a48', grass2: '#938a52', dirt: '#8a7556', rock: '#7a756c', snow: 0, road: '#a08c6c', field: '#83793e', litter: '#7a6a42', surf: 'dirt' },
  jungle: { grass: '#3f6a2a', grass2: '#56782f', dirt: '#6a4e34', rock: '#5f6056', snow: 0, road: '#7a5e40', field: '#4a7030', litter: '#4b5a26', surf: 'mud' },
  xian_summer: { grass: '#6f7a3c', grass2: '#8d8a4c', dirt: '#9a8262', rock: '#857c6e', snow: 0, road: '#a99474', field: '#6f7f34', litter: '#7a6c42', surf: 'dirt' },
};

export class Terrain {
  constructor(spec) {
    this.spec = spec;
    this.size = spec.size || 240;
    this.half = this.size / 2;
    this.res = spec.res || Math.round(this.size / 2);
    this.cell = this.size / this.res;
    this.biome = BIOMES[spec.biome] || BIOMES.manchuria_summer;
    this.noise = makeNoise(spec.seed || 3);
    this.features = spec.features || [];
    this.waterLevel = spec.waterLevel ?? -100;
    this.bounds = spec.bounds ?? this.half - 10;
    const n = this.res + 1;
    this.h = new Float32Array(n * n);
    this.surf = new Uint8Array(n * n);
    this.roadMask = new Float32Array(n * n);
    this.fieldMask = new Float32Array(n * n);
    this._bake();
  }

  _raw(x, z) {
    const s = this.spec, N = this.noise;
    let h = (s.base || 0) + N.fbm(x * (s.noiseScale || 0.012), z * (s.noiseScale || 0.012), 5) * (s.noiseAmp ?? 6);
    h += N.fbm(x * 0.08 + 31, z * 0.08 - 7, 2) * (s.detailAmp ?? 0.35);
    let road = 0, field = 0;
    for (const f of this.features) {
      if (f.type === 'valley') {
        const { d } = distToPolyline(x, z, f.path);
        const w0 = f.floor ?? f.width * 0.3;
        const k = 1 - smooth(clamp((d - w0) / Math.max(1, f.width - w0), 0, 1));
        h -= f.depth * k;
      } else if (f.type === 'ridge') {
        const { d } = distToPolyline(x, z, f.path);
        const k = 1 - smooth(clamp(d / f.width, 0, 1));
        h += f.height * k * (0.85 + 0.3 * N.noise(x * 0.05, z * 0.05));
      } else if (f.type === 'hill') {
        const d = Math.hypot(x - f.x, z - f.z);
        h += f.h * (1 - smooth(clamp(d / f.r, 0, 1)));
      } else if (f.type === 'river') {
        const { d } = distToPolyline(x, z, f.path);
        const k = 1 - smooth(clamp((d - f.width * 0.3) / (f.width * 1.2), 0, 1));
        h -= f.depth * k;
      } else if (f.type === 'road') {
        const { d } = distToPolyline(x, z, f.path);
        road = Math.max(road, 1 - smooth(clamp((d - f.width * 0.5) / 1.6, 0, 1)));
      } else if (f.type === 'field') {
        if (Math.abs(x - f.x) < f.w / 2 && Math.abs(z - f.z) < f.d / 2) field = 1;
      }
    }
    // rising edges contain the arena and read as distant hills
    const e = Math.max(Math.abs(x), Math.abs(z)) - (this.bounds - 6);
    if (e > 0) h += (s.edgeRise ?? 18) * smooth(clamp(e / 26, 0, 1)) * (0.7 + 0.5 * N.noise(x * 0.02, z * 0.02));
    // flats are blended last so villages, ranges and parade grounds sit level
    for (const f of this.features) {
      if (f.type !== 'flat') continue;
      let d;
      if (f.w) d = Math.max(Math.abs(x - f.x) - f.w / 2, Math.abs(z - f.z) - f.d / 2, 0);
      else d = Math.max(0, Math.hypot(x - f.x, z - f.z) - f.r);
      const k = 1 - smooth(clamp(d / (f.fall || 10), 0, 1));
      const target = f.h ?? h;
      h = lerp(h, target, k);
    }
    if (road > 0) h -= road * 0.12;
    return [h, road, field];
  }

  _bake() {
    const n = this.res + 1, half = this.half, c = this.cell;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = -half + i * c, z = -half + j * c;
      const [h, r, f] = this._raw(x, z);
      const k = j * n + i;
      this.h[k] = h; this.roadMask[k] = r; this.fieldMask[k] = f;
    }
    // surface classification
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const k = j * n + i;
      const slope = this._slopeIdx(i, j);
      let s = SURF[this.biome.surf] ?? SURF.dirt;
      if (this.roadMask[k] > 0.5) s = this.biome.snow > 0.6 ? SURF.snow : SURF.road;
      else if (this.h[k] < this.waterLevel + 0.15) s = SURF.mud;
      else if (slope > 0.9) s = SURF.stone;
      else if (this.fieldMask[k] > 0) s = this.biome.snow > 0.6 ? SURF.snow : SURF.dirt;
      this.surf[k] = s;
    }
  }
  _slopeIdx(i, j) {
    const n = this.res + 1;
    const a = this.h[j * n + Math.min(n - 1, i + 1)] - this.h[j * n + Math.max(0, i - 1)];
    const b = this.h[Math.min(n - 1, j + 1) * n + i] - this.h[Math.max(0, j - 1) * n + i];
    return Math.hypot(a, b) / (2 * this.cell);
  }

  heightAt(x, z) {
    const n = this.res + 1;
    const fx = clamp((x + this.half) / this.cell, 0, this.res - 0.0001), fz = clamp((z + this.half) / this.cell, 0, this.res - 0.0001);
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
    const h = this.h;
    const a = h[j * n + i], b = h[j * n + i + 1], c = h[(j + 1) * n + i], d = h[(j + 1) * n + i + 1];
    // match the triangle split used by the mesh so feet sit exactly on the rendered surface
    if (u + v <= 1) return a + (b - a) * u + (c - a) * v;
    return d + (c - d) * (1 - u) + (b - d) * (1 - v);
  }
  slopeAt(x, z) {
    const e = 0.8;
    const dx = this.heightAt(x + e, z) - this.heightAt(x - e, z), dz = this.heightAt(x, z + e) - this.heightAt(x, z - e);
    return { gx: dx / (2 * e), gz: dz / (2 * e), mag: Math.hypot(dx, dz) / (2 * e) };
  }
  surfaceAt(x, z) {
    const n = this.res + 1;
    const i = clamp(Math.round((x + this.half) / this.cell), 0, this.res), j = clamp(Math.round((z + this.half) / this.cell), 0, this.res);
    if (this.waterLevel > -50 && this.heightAt(x, z) < this.waterLevel - 0.05) return 'water';
    return SURF_NAMES[this.surf[j * n + i]];
  }
  roadAt(x, z) {
    const n = this.res + 1;
    const i = clamp(Math.round((x + this.half) / this.cell), 0, this.res), j = clamp(Math.round((z + this.half) / this.cell), 0, this.res);
    return this.roadMask[j * n + i];
  }
  inBounds(x, z, pad = 0) { return Math.abs(x) < this.bounds - pad && Math.abs(z) < this.bounds - pad; }
  // true if the terrain blocks the straight segment a->b (heights are eye/target heights in world space)
  blocks(ax, ay, az, bx, by, bz, step = 2) {
    const d = Math.hypot(bx - ax, bz - az);
    const n = Math.max(2, Math.ceil(d / step));
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const x = ax + (bx - ax) * t, z = az + (bz - az) * t, y = ay + (by - ay) * t;
      if (this.heightAt(x, z) > y - 0.05) return true;
    }
    return false;
  }

  buildMesh() {
    const n = this.res + 1, half = this.half, c = this.cell, B = this.biome;
    const geo = new THREE.BufferGeometry();
    // non-indexed triangles so flatShading gives crisp faceted relief
    const pos = new Float32Array(this.res * this.res * 6 * 3);
    const col = new Float32Array(this.res * this.res * 6 * 3);
    const C = (hex) => new THREE.Color(hex);
    const cg = C(B.grass), cg2 = C(B.grass2), cd = C(B.dirt), cr = C(B.rock), cs = C('#e9ecef'), croad = C(B.road), cf = C(B.field), cl = C(B.litter), cmud = C('#4d4434');
    const tmp = new THREE.Color();
    const N = this.noise;
    const vcol = (i, j) => {
      const k = j * n + i; const x = -half + i * c, z = -half + j * c;
      const h = this.h[k], slope = this._slopeIdx(i, j);
      const nn = N.fbm(x * 0.035, z * 0.035, 3) + 0.5;
      tmp.copy(cg).lerp(cg2, clamp(nn * 1.3 - 0.15 + (h - (this.spec.base || 0)) * 0.015, 0, 1));
      const lit = N.fbm(x * 0.12 + 9, z * 0.12, 2) + 0.5;
      if (lit > 0.58) tmp.lerp(cl, clamp((lit - 0.58) * 2.2, 0, 0.85));
      const bare = N.fbm(x * 0.05 - 17, z * 0.05 + 4, 3) + 0.5;
      if (bare > 0.66) tmp.lerp(cd, clamp((bare - 0.66) * 2.5, 0, 0.7));
      // damp hollows read darker, crests lighter
      tmp.multiplyScalar(0.9 + clamp((h - (this.spec.base || 0)) * 0.012, -0.12, 0.12));
      if (this.fieldMask[k] > 0) {
        const row = Math.sin((this.spec.fieldRowsAlongX ? z : x) * 2.6) > 0.2 ? 1 : 0;
        tmp.copy(cf).lerp(cd, row ? 0.15 : 0.55);
      }
      tmp.lerp(cr, smooth(clamp((slope - 0.55) / 0.5, 0, 1)));
      const road = this.roadMask[k];
      if (road > 0) tmp.lerp(croad, road * 0.9);
      if (this.waterLevel > -50 && h < this.waterLevel + 0.6) tmp.lerp(cmud, clamp((this.waterLevel + 0.6 - h) / 0.8, 0, 1));
      if (B.snow > 0) {
        const sn = B.snow * (1 - smooth(clamp((slope - 0.45) / 0.6, 0, 1))) * (0.75 + 0.35 * N.noise(x * 0.05 + 3, z * 0.05));
        tmp.lerp(cs, clamp(sn * (road > 0.5 ? 0.6 : 1), 0, 1));
      }
      const v = 0.93 + 0.12 * (N.noise(x * 0.5, z * 0.5));
      return [tmp.r * v, tmp.g * v, tmp.b * v];
    };
    let p = 0;
    const put = (i, j) => {
      pos[p] = -half + i * c; pos[p + 1] = this.h[j * n + i]; pos[p + 2] = -half + j * c;
      const cc = vcol(i, j); col[p] = cc[0]; col[p + 1] = cc[1]; col[p + 2] = cc[2]; p += 3;
    };
    for (let j = 0; j < this.res; j++) for (let i = 0; i < this.res; i++) {
      put(i, j); put(i, j + 1); put(i + 1, j);
      put(i + 1, j + 1); put(i + 1, j); put(i, j + 1);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.name = 'terrain';
    return mesh;
  }

  buildWater() {
    if (this.waterLevel < -50) return null;
    const geo = new THREE.PlaneGeometry(this.size + 400, this.size + 400, 1, 1);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshLambertMaterial({ color: this.spec.waterColor || '#4f6670', transparent: true, opacity: 0.82 });
    const m = new THREE.Mesh(geo, mat); m.position.y = this.waterLevel; m.receiveShadow = true;
    return m;
  }
}

// Faceted mountain ring beyond the arena so the horizon reads as real Manchurian / Chinese ranges.
export function buildBackdrop(spec, colorHex = '#5d6670', snow = 0) {
  const g = new THREE.Group();
  const N = makeNoise((spec.seed || 3) + 101);
  const R = (spec.size || 240) * 0.5 + 140;
  const segs = 96;
  for (let ring = 0; ring < 3; ring++) {
    const rr = R + ring * 140;
    const geo = new THREE.BufferGeometry();
    const pos = [], col = [];
    const base = new THREE.Color(colorHex).lerp(new THREE.Color(spec.fogColor || '#9aa6ad'), 0.25 + ring * 0.25);
    const top = base.clone().lerp(new THREE.Color('#ffffff'), snow * (0.55 - ring * 0.1));
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI * 2, a1 = ((i + 1) / segs) * Math.PI * 2;
      const h0 = (spec.backdropHeight ?? 60) * (0.4 + 0.8 * Math.abs(N.fbm(Math.cos(a0) * 2 + ring, Math.sin(a0) * 2, 4) + 0.3)) * (1 + ring * 0.35);
      const h1 = (spec.backdropHeight ?? 60) * (0.4 + 0.8 * Math.abs(N.fbm(Math.cos(a1) * 2 + ring, Math.sin(a1) * 2, 4) + 0.3)) * (1 + ring * 0.35);
      const p = [[Math.cos(a0) * rr, -20, Math.sin(a0) * rr], [Math.cos(a1) * rr, -20, Math.sin(a1) * rr], [Math.cos(a0) * rr, h0, Math.sin(a0) * rr], [Math.cos(a1) * rr, h1, Math.sin(a1) * rr]];
      pos.push(...p[0], ...p[2], ...p[1], ...p[1], ...p[2], ...p[3]);
      for (const k of [0, 2, 1, 1, 2, 3]) { const c = k >= 2 ? top : base; col.push(c.r, c.g, c.b); }
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: true, side: THREE.DoubleSide }));
    g.add(m);
  }
  return g;
}

// Gradient sky dome with procedural clouds, sun/moon disc and stars.
export function buildSky(sky) {
  const geo = new THREE.SphereGeometry(1800, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      uTop: { value: new THREE.Color(sky.top) }, uHorizon: { value: new THREE.Color(sky.horizon) }, uBottom: { value: new THREE.Color(sky.bottom || sky.horizon) },
      uSunDir: { value: new THREE.Vector3(...(sky.sunDir || [0.3, 0.5, 0.2])).normalize() }, uSunColor: { value: new THREE.Color(sky.sunColor || '#fff4d6') },
      uCloud: { value: sky.clouds ?? 0.4 }, uNight: { value: sky.night ? 1 : 0 }, uTime: { value: 0 },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform vec3 uTop, uHorizon, uBottom, uSunDir, uSunColor; uniform float uCloud, uNight, uTime; varying vec3 vDir;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
      float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y); }
      float fbm(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<5;i++){ s+=a*noise(p); p*=2.1; a*=0.5; } return s; }
      void main(){
        float y = vDir.y;
        vec3 c = y > 0.0 ? mix(uHorizon, uTop, pow(clamp(y,0.0,1.0), 0.55)) : mix(uHorizon, uBottom, clamp(-y*4.0,0.0,1.0));
        float sd = max(dot(vDir, uSunDir), 0.0);
        c += uSunColor * (pow(sd, 900.0) * (uNight > 0.5 ? 0.8 : 2.0) + pow(sd, 12.0) * 0.18);
        if (y > 0.0) {
          vec2 uv = vDir.xz / (y + 0.15) * 1.4 + vec2(uTime * 0.004, 0.0);
          float cl = smoothstep(0.55 - uCloud * 0.35, 0.95, fbm(uv));
          vec3 cc = mix(uHorizon * 1.08, vec3(1.0), 0.35 + 0.4 * (1.0 - uNight));
          c = mix(c, cc * (uNight > 0.5 ? 0.25 : 1.0), cl * 0.75 * smoothstep(0.0, 0.25, y));
          if (uNight > 0.5) { float s = step(0.9975, hash(floor(vDir.xz / (y + 0.2) * 260.0))); c += vec3(s) * (1.0 - cl) * smoothstep(0.05, 0.4, y) * 0.8; }
        }
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.name = 'sky';
  m.renderOrder = -10;
  return m;
}
