import * as THREE from 'three';
import { L, inPond, inRoundRect } from './layout.js';
import { addCyl } from './collision.js';
import { StaticBatch, foliageMaterial, windify, addSway, applyFoliageDepth } from './materials.js';
import * as TX from './textures.js';
import { mulberry32 } from './util.js';

// 굵기가 줄어드는 관(나무 줄기·가지)
function taperedTube(curve, segs, radial, r0, r1) {
  const frames = curve.computeFrenetFrames(segs, false);
  const pos = [], nor = [], uv = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const p = curve.getPointAt(t);
    const r = r0 + (r1 - r0) * t;
    const N = frames.normals[i], B = frames.binormals[i];
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const n = new THREE.Vector3().addScaledVector(N, Math.cos(a)).addScaledVector(B, Math.sin(a)).normalize();
      pos.push(p.x + n.x * r, p.y + n.y * r, p.z + n.z * r);
      nor.push(n.x, n.y, n.z);
      uv.push(j / radial * 2, t * curve.getLength() / 1.5);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

// 잎 카드(평면) 하나: 중심, 크기, 회전
function card(size, rx, ry, rz) {
  const g = new THREE.PlaneGeometry(size, size);
  g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz);
  return g;
}

export function buildVegetation(scene, q) {
  const group = new THREE.Group();
  group.name = 'vegetation';
  scene.add(group);
  const rnd = mulberry32(555);
  const batch = new StaticBatch();

  const pineBark = new THREE.MeshStandardMaterial({ map: TX.toTex(TX.barkTexture([150, 82, 58]), { repeat: [1, 1] }), roughness: 0.95 });
  const greyBark = new THREE.MeshStandardMaterial({ map: TX.toTex(TX.barkTexture([110, 100, 88], false), { repeat: [1, 1] }), roughness: 0.95 });
  const needleMat = foliageMaterial(TX.toTex(TX.needleTexture()), 0xd8e8d0);
  const leafMat = foliageMaterial(TX.toTex(TX.leafTexture([78, 128, 52], 51, 170)), 0xffffff);
  const leafMat2 = foliageMaterial(TX.toTex(TX.leafTexture([96, 136, 48], 52, 170)), 0xffffff);
  const autumnMat = foliageMaterial(TX.toTex(TX.leafTexture([168, 140, 52], 53, 150)), 0xffffff);
  const wisMat = foliageMaterial(TX.toTex(TX.wisteriaTexture()), 0xffffff);

  const swayAll = (g, k) => addSway(g, (x, y) => k * (0.4 + Math.max(0, y) * 0.06));

  // ---------- 소나무(영상 오른쪽의 구불구불한 한국 소나무) ----------
  const pine = (x, z, h, lean) => {
    const pts = [];
    let px = x, pz = z, ang = rnd() * Math.PI * 2;
    for (let i = 0; i <= 5; i++) {
      const t = i / 5;
      pts.push(new THREE.Vector3(px, t * h, pz));
      ang += (rnd() - 0.5) * 1.4;
      const off = lean * (0.3 + rnd() * 0.6);
      px += Math.cos(ang) * off; pz += Math.sin(ang) * off;
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const r0 = 0.18 + h * 0.022;
    batch.add(taperedTube(curve, 12, 8, r0, r0 * 0.25), pineBark, null, true, true);
    addCyl(x, z, r0 + 0.1, 0, h);
    // 가지와 잎 뭉치(납작한 층)
    const nb = 5 + Math.floor(rnd() * 4);
    for (let b = 0; b < nb; b++) {
      const t = 0.42 + (b / nb) * 0.55;
      const base = curve.getPointAt(t);
      const a = rnd() * Math.PI * 2;
      const len = (1.6 + rnd() * 2.4) * (1.1 - t * 0.5);
      const end = base.clone().add(new THREE.Vector3(Math.cos(a) * len, 0.3 + rnd() * 0.9, Math.sin(a) * len));
      const mid = base.clone().lerp(end, 0.5).add(new THREE.Vector3(0, -0.25, 0));
      batch.add(taperedTube(new THREE.CatmullRomCurve3([base, mid, end]), 5, 5, r0 * 0.35, 0.04), pineBark, null, true, false);
      const pads = 2 + Math.floor(rnd() * 3);
      for (let k = 0; k < pads; k++) {
        const pp = end.clone().add(new THREE.Vector3((rnd() - 0.5) * 1.6, (rnd() - 0.3) * 0.5, (rnd() - 0.5) * 1.6));
        const s = 1.6 + rnd() * 1.4;
        for (let c = 0; c < 3; c++) {
          const g = card(s, -Math.PI / 2 + (rnd() - 0.5) * 0.7, rnd() * Math.PI, (rnd() - 0.5) * 0.5);
          g.scale(1, 0.55 + c * 0.2, 1);
          swayAll(g, 0.8);
          batch.add(g, needleMat, new THREE.Matrix4().makeTranslation(pp.x, pp.y + c * 0.12, pp.z), true, true);
        }
        // 세로 카드로 부피감
        const g2 = card(s * 0.9, 0, rnd() * Math.PI, 0);
        g2.scale(1, 0.5, 1);
        swayAll(g2, 0.8);
        batch.add(g2, needleMat, new THREE.Matrix4().makeTranslation(pp.x, pp.y, pp.z), true, true);
      }
    }
    // 꼭대기
    const top = curve.getPointAt(1);
    for (let c = 0; c < 4; c++) {
      const g = card(2.2 + rnd(), -Math.PI / 2 + (rnd() - 0.5) * 0.9, rnd() * Math.PI, 0);
      swayAll(g, 0.9);
      batch.add(g, needleMat, new THREE.Matrix4().makeTranslation(top.x + (rnd() - 0.5), top.y + c * 0.2, top.z + (rnd() - 0.5)), true, true);
    }
  };
  const pines = [[69, -2, 9], [71, 12, 8], [74, -22, 11], [80, -14, 10], [88, 10, 9], [92, -6, 12], [86, -26, 9], [94, -34, 10], [78, 16, 8.5], [70, -36, 10], [83, -40, 9], [95, 18, 8], [68, -16, 7.5], [90, 30, 6.5], [72, 38, 7]];
  for (const [x, z, h] of pines) pine(x, z, h, 0.7 + rnd() * 0.5);

  // ---------- 활엽수(느티나무·은행나무): 운동장 둘레 ----------
  const broad = (x, z, h, mat, autumn = false) => {
    const pts = [new THREE.Vector3(x, 0, z), new THREE.Vector3(x + (rnd() - 0.5) * 0.4, h * 0.4, z + (rnd() - 0.5) * 0.4), new THREE.Vector3(x + (rnd() - 0.5) * 0.6, h * 0.65, z + (rnd() - 0.5) * 0.6)];
    const curve = new THREE.CatmullRomCurve3(pts);
    const r0 = 0.14 + h * 0.018;
    batch.add(taperedTube(curve, 6, 7, r0, r0 * 0.4), greyBark, null, true, true);
    addCyl(x, z, r0 + 0.08, 0, h);
    for (let b = 0; b < 4; b++) {
      const base = curve.getPointAt(0.6 + rnd() * 0.4);
      const a = rnd() * Math.PI * 2;
      const end = base.clone().add(new THREE.Vector3(Math.cos(a) * h * 0.22, h * 0.25, Math.sin(a) * h * 0.22));
      batch.add(taperedTube(new THREE.CatmullRomCurve3([base, base.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 0.2, 0)), end]), 4, 5, r0 * 0.4, 0.03), greyBark, null, true, false);
    }
    const cy = h * 0.68, rx = h * 0.32, ry = h * 0.36;
    const n = 26 + Math.floor(h * 2);
    for (let i = 0; i < n; i++) {
      const u = rnd() * Math.PI * 2, v = Math.acos(2 * rnd() - 1);
      const rr = 0.55 + rnd() * 0.45;
      const px = x + Math.sin(v) * Math.cos(u) * rx * rr, py = cy + Math.cos(v) * ry * rr, pz = z + Math.sin(v) * Math.sin(u) * rx * rr;
      const g = card(h * 0.22 + rnd() * 1.2, rnd() * Math.PI, rnd() * Math.PI, rnd() * Math.PI);
      addSway(g, () => 0.9);
      batch.add(g, autumn && rnd() < 0.5 ? autumnMat : mat, new THREE.Matrix4().makeTranslation(px, py, pz), true, true);
    }
  };
  // 서쪽 울타리 뒤 나무 줄(영상 1프레임)
  for (let z = -34; z <= 26; z += 5.5) broad(-53 + (rnd() - 0.5) * 2, z + rnd() * 2, 8 + rnd() * 4, rnd() < 0.5 ? leafMat : leafMat2);
  // 운동장 서쪽 끝 안쪽 나무
  for (let z = -18; z <= 18; z += 9) broad(-48.3, z, 7 + rnd() * 2, leafMat2);
  // 남쪽 화단 가로수
  for (let x = -44; x <= 50; x += 8) broad(x + rnd() * 2, 34 + rnd() * 6, 7 + rnd() * 3, rnd() < 0.6 ? leafMat : leafMat2, rnd() < 0.3);
  // 본관 앞 화단(작은 나무)
  for (const x of [-30, -18, 16, 24]) broad(x, -36.2, 5 + rnd() * 1.5, leafMat);
  // 정원 뒤쪽 활엽수
  for (const [x, z] of [[96, -42], [80, -44], [66, 27], [95, 40], [60, 42]]) broad(x, z, 8 + rnd() * 3, leafMat2, true);

  // ---------- 등나무(퍼걸러 지붕을 덮음) ----------
  const S = L.stands;
  const pxA = S.x0 + 1.4, pxB = S.x1 - 1.2;
  const yA = 4.2 + 0.25, yB = S.steps * S.rise + 3.0 + 0.25;
  for (let z = S.z0 + 0.5; z < S.z1 - 0.5; z += 0.9) {
    for (let k = 0; k < 6; k++) {
      const f = (k + rnd()) / 6;
      const x = pxA - 0.6 + (pxB - pxA + 1.2) * f;
      const y = yA + (yB - yA) * f + rnd() * 0.3;
      const g = card(1.8 + rnd() * 0.8, -Math.PI / 2 + (rnd() - 0.5) * 0.6, rnd() * Math.PI, 0);
      addSway(g, () => 0.6);
      batch.add(g, rnd() < 0.7 ? leafMat2 : leafMat, new THREE.Matrix4().makeTranslation(x, y, z + (rnd() - 0.5) * 0.6), true, true);
    }
    // 늘어진 줄기와 꼬투리(영상에서 갈색으로 늘어진 부분)
    if (rnd() < 0.85) {
      const f = rnd() < 0.6 ? rnd() * 0.25 : rnd();
      const x = pxA - 0.4 + (pxB - pxA) * f;
      const y = yA + (yB - yA) * f;
      const g = new THREE.PlaneGeometry(1.4, 1.6 + rnd() * 1.0);
      g.translate(0, -0.8, 0);
      g.rotateY(Math.PI / 2 + (rnd() - 0.5) * 0.8);
      addSway(g, (px, py) => 0.5 + Math.max(0, -py) * 0.9);
      batch.add(g, wisMat, new THREE.Matrix4().makeTranslation(x, y, z), true, true);
    }
  }
  // 등나무 굵은 줄기(기둥 감고 올라감)
  for (let z = S.z0 + 3; z < S.z1; z += 8.4) {
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      pts.push(new THREE.Vector3(pxA + Math.cos(t * 7) * 0.1, t * 4.3, z + 0.15 + Math.sin(t * 7) * 0.1));
    }
    batch.add(taperedTube(new THREE.CatmullRomCurve3(pts), 24, 5, 0.07, 0.04), pineBark, null, true, false);
  }

  // ---------- 낮은 관목(회양목 생울타리) ----------
  const hedge = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.ceil(len / 0.7);
    for (let i = 0; i < n; i++) {
      const f = (i + 0.5) / n;
      const x = x0 + (x1 - x0) * f, z = z0 + (z1 - z0) * f;
      for (let c = 0; c < 3; c++) {
        const g = card(1.1, rnd() * Math.PI, rnd() * Math.PI, rnd() * Math.PI);
        addSway(g, () => 0.15);
        batch.add(g, leafMat, new THREE.Matrix4().makeTranslation(x, 0.45 + rnd() * 0.25, z), true, true);
      }
    }
  };
  hedge(-34, -36.6, -3, -36.6);
  hedge(11, -36.6, 29, -36.6);
  hedge(66.6, 24, 66.6, 43);
  hedge(-48, 31, 6, 31);
  hedge(14, 31, 56, 31);

  batch.build(group);

  // ---------- 풀(인스턴스, 바람에 흔들림) ----------
  const grass = buildGrass(q.grass, rnd);
  group.add(grass);
  const flowers = buildFlowers(rnd);
  group.add(flowers);

  return { group };
}

function grassOK(x, z) {
  if (inPond(x, z)) return false;
  const G = L.garden;
  if (x > G.x0 + 0.5 && x < G.x1 - 0.3 && z > G.z0 && z < G.z1) return true;
  if (z > 29.5 && z < 44.5 && x > -49 && x < 56 && Math.abs(x - L.gate.x) > 4.5) return true;
  if (x < -49.8 && x > -58) return true;
  return false;
}

function buildGrass(count, rnd) {
  // 풀잎 하나: 3단 삼각띠
  const g = new THREE.BufferGeometry();
  const w = 0.045, h = 0.42;
  const pos = [-w, 0, 0, w, 0, 0, -w * 0.7, h * 0.45, 0.02, w * 0.7, h * 0.45, 0.02, 0, h, 0.07];
  const col = [];
  const sway = [0, 0, 0.45, 0.45, 1];
  for (let i = 0; i < 5; i++) {
    const t = pos[i * 3 + 1] / h;
    col.push(0.16 + t * 0.2, 0.27 + t * 0.32, 0.09 + t * 0.08);
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('sway', new THREE.Float32BufferAttribute(sway.map((s) => s * 2.2), 1));
  g.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4]);
  g.computeVertexNormals();
  const norm = g.attributes.normal;
  for (let i = 0; i < norm.count; i++) norm.setXYZ(i, 0, 1, 0.2);
  const mat = windify(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.9 }));
  const mesh = new THREE.InstancedMesh(g, mat, count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const c = new THREE.Color();
  let n = 0, tries = 0;
  while (n < count && tries < count * 8) {
    tries++;
    // 정원과 남쪽 화단에 집중
    const area = rnd();
    let x, z;
    if (area < 0.6) { x = L.garden.x0 + rnd() * (L.garden.x1 - L.garden.x0); z = L.garden.z0 + rnd() * (L.garden.z1 - L.garden.z0); }
    else if (area < 0.92) { x = -49 + rnd() * 105; z = 29.5 + rnd() * 15; }
    else { x = -58 + rnd() * 8; z = -38 + rnd() * 68; }
    if (!grassOK(x, z)) continue;
    // 산책길 피하기(대략)
    p.set(x, 0, z);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * Math.PI * 2);
    const k = 0.6 + rnd() * 0.9;
    s.set(k, k * (0.7 + rnd() * 0.8), k);
    m.compose(p, q, s);
    mesh.setMatrixAt(n, m);
    c.setHSL(0.22 + rnd() * 0.08, 0.45 + rnd() * 0.2, 0.75 + rnd() * 0.35);
    mesh.setColorAt(n, c);
    n++;
  }
  mesh.count = n;
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.frustumCulled = false;
  return mesh;
}

// 코스모스(10월의 학교 화단)
function buildFlowers(rnd) {
  const g = new THREE.BufferGeometry();
  const petals = 8, pos = [], idx = [], col = [], sw = [];
  pos.push(0, 0, 0); col.push(1, 0.85, 0.3); sw.push(1);
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2;
    const a2 = a + 0.25, a1 = a - 0.25;
    pos.push(Math.cos(a1) * 0.03, 0, Math.sin(a1) * 0.03, Math.cos(a) * 0.09, 0.005, Math.sin(a) * 0.09, Math.cos(a2) * 0.03, 0, Math.sin(a2) * 0.03);
    for (let k = 0; k < 3; k++) { col.push(1, 1, 1); sw.push(1); }
    const b = 1 + i * 3;
    idx.push(0, b, b + 1, 0, b + 1, b + 2);
  }
  // 줄기
  const sb = pos.length / 3;
  pos.push(-0.006, -0.7, 0, 0.006, -0.7, 0, 0, 0, 0);
  col.push(0.25, 0.45, 0.2, 0.25, 0.45, 0.2, 0.25, 0.45, 0.2);
  sw.push(0, 0, 1);
  idx.push(sb, sb + 1, sb + 2);
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('sway', new THREE.Float32BufferAttribute(sw.map((s) => s * 1.6), 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  const mat = windify(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.7 }));
  const N = 900;
  const mesh = new THREE.InstancedMesh(g, mat, N);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
  const pal = [new THREE.Color(0xf07bb0), new THREE.Color(0xffffff), new THREE.Color(0xd9468a), new THREE.Color(0xf5a8cc)];
  let n = 0;
  const beds = [[-46, 30.5, 50, 2.0], [14, 34.5, 8, 4], [66.4, 23, 1.2, 20], [-30, -37.4, 26, 0.9]];
  for (const [bx, bz, bw, bd] of beds) {
    const cnt = Math.floor((N / beds.length));
    for (let i = 0; i < cnt && n < N; i++) {
      const x = bx + rnd() * bw, z = bz + rnd() * bd;
      if (Math.abs(x - 14) < 1 && Math.abs(z - 37) < 1) continue;
      p.set(x, 0.55 + rnd() * 0.5, z);
      q.setFromEuler(new THREE.Euler((rnd() - 0.5) * 0.5, rnd() * 6, (rnd() - 0.5) * 0.5));
      m.compose(p, q, s);
      mesh.setMatrixAt(n, m);
      mesh.setColorAt(n, pal[Math.floor(rnd() * pal.length)]);
      n++;
    }
  }
  mesh.count = n;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  void applyFoliageDepth; void inRoundRect;
  return mesh;
}
