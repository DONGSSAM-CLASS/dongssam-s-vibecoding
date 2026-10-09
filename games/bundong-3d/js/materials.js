import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// 전역 셰이더 값(바람·시간)
export const U = {
  uTime: { value: 0 },
  uWind: { value: 0.4 },
  uWet: { value: 0 },
};

// ---- 바람에 흔들리는 식물 셰이더 패치 ----
const WIND_PARS = `
uniform float uTime;
uniform float uWind;
attribute float sway;
`;
const WIND_VERT = `
vec3 transformed = vec3( position );
#ifdef USE_INSTANCING
  vec4 wp0 = modelMatrix * instanceMatrix * vec4( position, 1.0 );
#else
  vec4 wp0 = modelMatrix * vec4( position, 1.0 );
#endif
float ph = uTime * 1.6 + wp0.x * 0.31 + wp0.z * 0.23;
float gust = 0.65 + 0.35 * sin( uTime * 0.37 + wp0.x * 0.02 );
float sw = sway * uWind * gust;
transformed.x += ( sin( ph ) * 0.6 + sin( ph * 2.7 ) * 0.22 ) * sw * 0.22;
transformed.z += ( cos( ph * 0.83 ) * 0.5 + sin( ph * 3.1 ) * 0.15 ) * sw * 0.16;
transformed.y -= abs( sin( ph ) ) * sw * 0.03;
`;

function windPatch(shader) {
  shader.uniforms.uTime = U.uTime;
  shader.uniforms.uWind = U.uWind;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\n' + WIND_PARS)
    .replace('#include <begin_vertex>', WIND_VERT);
}

export function windify(mat) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (s, r) => { if (prev) prev(s, r); windPatch(s); };
  mat.customProgramCacheKey = () => 'wind' + (mat.alphaTest > 0 ? 'a' : '');
  return mat;
}

export function foliageMaterial(map, color = 0xffffff, opts = {}) {
  const mat = windify(new THREE.MeshStandardMaterial({
    map, color, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85, metalness: 0,
    ...opts,
  }));
  const depth = windify(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.45, side: THREE.DoubleSide }));
  mat.userData.depth = depth;
  return mat;
}

export function applyFoliageDepth(mesh) {
  if (mesh.material.userData.depth) mesh.customDepthMaterial = mesh.material.userData.depth;
}

// ---- 비 온 뒤 젖은 표면 ----
const wetList = [];
export function wettable(mat, amount = 0.6, darken = 0.22) {
  wetList.push({ mat, r: mat.roughness, c: mat.color.clone(), amount, darken });
  return mat;
}
export function updateWet(w) {
  U.uWet.value = w;
  for (const e of wetList) {
    e.mat.roughness = e.r * (1 - w * e.amount);
    e.mat.color.copy(e.c).multiplyScalar(1 - w * e.darken);
  }
}

// ---- 밤에 켜지는 발광(창문 등) ----
const nightList = [];
export function nightGlow(mat, k = 1) {
  nightList.push({ mat, k });
  return mat;
}
export function updateNightGlow(n, flicker = 1) {
  for (const e of nightList) e.mat.emissiveIntensity = n * e.k * flicker;
}

// ---- 정적 메시 합치기(그리기 호출 줄이기) ----
export class StaticBatch {
  constructor() { this.groups = new Map(); }
  add(geo, mat, matrix, cast = true, receive = true) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const name of Object.keys(g.attributes)) {
      if (!['position', 'normal', 'uv', 'color', 'sway'].includes(name)) g.deleteAttribute(name);
    }
    if (!g.attributes.uv) {
      g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    }
    if (matrix) g.applyMatrix4(matrix);
    const k = mat.uuid + (cast ? 'c' : '') + (receive ? 'r' : '');
    let e = this.groups.get(k);
    if (!e) this.groups.set(k, (e = { mat, cast, receive, geos: [] }));
    e.geos.push(g);
  }
  // 상자 하나 추가 (중심, 크기)
  box(mat, cx, cy, cz, sx, sy, sz, ry = 0, cast = true, receive = true, uvScale = null) {
    const geo = new THREE.BoxGeometry(sx, sy, sz);
    if (uvScale) scaleBoxUV(geo, sx, sy, sz, uvScale);
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(cx, cy, cz),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry),
      new THREE.Vector3(1, 1, 1));
    this.add(geo, mat, m, cast, receive);
  }
  build(parent) {
    for (const e of this.groups.values()) {
      const attrsets = new Set(e.geos.map((g) => Object.keys(g.attributes).sort().join(',')));
      let list = e.geos;
      if (attrsets.size > 1) {
        // 속성이 다르면 공통 속성만 남김
        const common = ['position', 'normal', 'uv'];
        list = e.geos.map((g) => { for (const n of Object.keys(g.attributes)) if (!common.includes(n)) g.deleteAttribute(n); return g; });
      }
      const merged = mergeGeometries(list, false);
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, e.mat);
      mesh.castShadow = e.cast;
      mesh.receiveShadow = e.receive;
      mesh.matrixAutoUpdate = false;
      applyFoliageDepth(mesh);
      parent.add(mesh);
    }
    this.groups.clear();
  }
}

// 상자 UV를 실제 크기(m)에 비례하도록 (타일 텍스처용)
export function scaleBoxUV(geo, sx, sy, sz, s) {
  const uv = geo.attributes.uv;
  // BoxGeometry 면 순서: +x, -x, +y, -y, +z, -z (면당 4정점)
  const dims = [[sz, sy], [sz, sy], [sx, sz], [sx, sz], [sx, sy], [sx, sy]];
  for (let f = 0; f < 6; f++) {
    for (let i = 0; i < 4; i++) {
      const idx = f * 4 + i;
      uv.setXY(idx, uv.getX(idx) * dims[f][0] / s, uv.getY(idx) * dims[f][1] / s);
    }
  }
  uv.needsUpdate = true;
  return geo;
}

export function addSway(geo, fn) {
  const p = geo.attributes.position;
  const a = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) a[i] = fn(p.getX(i), p.getY(i), p.getZ(i));
  geo.setAttribute('sway', new THREE.BufferAttribute(a, 1));
  return geo;
}
