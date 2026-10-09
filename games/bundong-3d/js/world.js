import * as THREE from 'three';
import { L, inPond } from './layout.js';
import { addBox, addBoxC, addCyl } from './collision.js';
import { StaticBatch, U, wettable, nightGlow, scaleBoxUV } from './materials.js';
import * as TX from './textures.js';
import { mulberry32 } from './util.js';

// 바깥 환경: 바닥, 트랙, 코트, 골대, 울타리, 스탠드·등나무 쉼터 구조, 광장, 연못, 바위, 가로등, 아파트
export function buildWorld(scene, q) {
  const group = new THREE.Group();
  group.name = 'world';
  scene.add(group);
  const batch = new StaticBatch();
  const rnd = mulberry32(1234);

  // ---------- 바닥 ----------
  const Y = L.yard;
  const yardTex = TX.toTex(TX.yardTexture(q.yardTex), { aniso: 16 });
  const detail = TX.toTex(TX.detailTexture(), { srgb: false, repeat: [1, 1] });
  const yardMat = wettable(new THREE.MeshStandardMaterial({ map: yardTex, roughness: 0.92, metalness: 0 }), 0.55, 0.25);
  yardMat.onBeforeCompile = (s) => {
    s.uniforms.uDetail = { value: detail };
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uDetail;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec2 wuv = vMapUv * vec2( ${(Y.x1 - Y.x0).toFixed(1)}, ${(Y.z1 - Y.z0).toFixed(1)} );
        float dt1 = texture2D( uDetail, wuv * 1.3 ).r;
        float dt2 = texture2D( uDetail, wuv * 0.17 ).r;
        diffuseColor.rgb *= ( 0.55 + dt1 * 0.9 ) * ( 0.8 + dt2 * 0.4 );`);
  };
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(Y.x1 - Y.x0, Y.z1 - Y.z0).rotateX(-Math.PI / 2), yardMat);
  ground.position.set((Y.x0 + Y.x1) / 2, 0, (Y.z0 + Y.z1) / 2);
  ground.receiveShadow = true;
  group.add(ground);

  // 학교 바깥 넓은 땅(동네)
  const outerMat = new THREE.MeshStandardMaterial({ color: 0x5f6150, roughness: 1 });
  const outer = new THREE.Mesh(new THREE.RingGeometry(80, 700, 48, 1).rotateX(-Math.PI / 2), outerMat);
  outer.position.set(20, -0.05, -8);
  outer.receiveShadow = true;
  group.add(outer);
  // 바닥 틈 메우기
  const under = new THREE.Mesh(new THREE.PlaneGeometry(260, 220).rotateX(-Math.PI / 2), outerMat);
  under.position.set(20, -0.08, -8);
  group.add(under);

  // ---------- 재질 ----------
  const brick = TX.brickPaving();
  const brickMap = TX.toTex(brick.map, { repeat: [1, 1] });
  const brickBump = TX.toTex(brick.bump, { repeat: [1, 1], srgb: false });
  const brickMat = wettable(new THREE.MeshStandardMaterial({ map: brickMap, bumpMap: brickBump, bumpScale: 1.5, roughness: 0.85 }));
  const whiteConc = wettable(new THREE.MeshStandardMaterial({ map: TX.toTex(TX.concreteTexture('#dedbd4'), { repeat: [1, 1] }), roughness: 0.8 }));
  const greyConc = wettable(new THREE.MeshStandardMaterial({ map: TX.toTex(TX.concreteTexture('#9c9890'), { repeat: [1, 1] }), roughness: 0.9 }));
  const steel = new THREE.MeshStandardMaterial({ color: 0x5b6266, roughness: 0.45, metalness: 0.75 });
  const whiteSteel = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.35, metalness: 0.3 });
  const greenSteel = new THREE.MeshStandardMaterial({ color: 0x2f7347, roughness: 0.5, metalness: 0.4 });
  const wood = new THREE.MeshStandardMaterial({ map: TX.toTex(TX.woodTexture([128, 86, 52]), { repeat: [1, 1] }), roughness: 0.8 });
  const fenceMap = TX.toTex(TX.chainLinkTexture(), { repeat: [1, 1] });

  // ---------- 운동장 경계석 ----------
  const T = L.track;
  batch.box(whiteConc, (T.x0 + T.x1) / 2, 0.06, T.z0 - 0.15, T.x1 - T.x0, 0.12, 0.3, 0, false, true, 1);

  // ---------- 축구 골대 ----------
  const t = L.turf;
  const mz = (t.z0 + t.z1) / 2;
  for (const side of [-1, 1]) {
    const gx = side < 0 ? t.x0 + 1.5 : t.x1 - 1.5;
    buildGoal(group, batch, whiteSteel, gx, mz, side);
  }

  // ---------- 서쪽 초록 철망 울타리(영상 왼쪽) ----------
  const fenceMat = new THREE.MeshStandardMaterial({ map: fenceMap, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.3, color: 0xffffff });
  const fence = (x0, z0, x1, z1, h) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const geo = new THREE.PlaneGeometry(len, h);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len / 0.8, uv.getY(i) * h / 0.8);
    const m = new THREE.Mesh(geo, fenceMat);
    m.position.set((x0 + x1) / 2, h / 2, (z0 + z1) / 2);
    m.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    m.castShadow = true;
    group.add(m);
    const n = Math.ceil(len / 3);
    for (let i = 0; i <= n; i++) {
      const px = x0 + (x1 - x0) * i / n, pz = z0 + (z1 - z0) * i / n;
      batch.add(new THREE.CylinderGeometry(0.05, 0.05, h, 6), greenSteel, new THREE.Matrix4().makeTranslation(px, h / 2, pz));
    }
    batch.add(new THREE.CylinderGeometry(0.04, 0.04, len, 5).rotateZ(Math.PI / 2).rotateY(-Math.atan2(z1 - z0, x1 - x0)),
      greenSteel, new THREE.Matrix4().makeTranslation((x0 + x1) / 2, h, (z0 + z1) / 2));
    const dx = x1 - x0, dz = z1 - z0;
    if (Math.abs(dx) > Math.abs(dz)) addBox(x0, x1, z0 - 0.1, z1 + 0.1, 0, h, 'fence');
    else addBox(x0 - 0.1, x1 + 0.1, z0, z1, 0, h, 'fence');
  };
  fence(-50, -38, -50, 30, 5);
  fence(-50, 30, -20, 30, 2.2);
  fence(-50, -38, -36, -38, 5);

  // ---------- 다목적 코트 농구대 ----------
  for (const z of [L.court.z0 + 1.6]) {
    const x = (L.court.x0 + L.court.x1) / 2;
    const dir = z < 0 ? 1 : -1;
    batch.add(new THREE.CylinderGeometry(0.1, 0.1, 3.4, 8), steel, new THREE.Matrix4().makeTranslation(x, 1.7, z));
    batch.box(whiteSteel, x, 3.3, z + dir * 0.9, 1.8, 1.05, 0.06);
    batch.add(new THREE.TorusGeometry(0.23, 0.02, 6, 16).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xe0582a }), new THREE.Matrix4().makeTranslation(x, 3.0, z + dir * 1.2));
    addCyl(x, z, 0.15, 0, 3.4);
  }

  // ---------- 등나무 쉼터 스탠드(계단식 좌석) ----------
  const S = L.stands;
  const stepD = (S.x1 - S.x0 - 3) / S.steps;
  for (let i = 0; i < S.steps; i++) {
    const x0 = S.x0 + 0.5 + i * stepD;
    const h = (i + 1) * S.rise;
    const len = S.z1 - S.z0;
    // 윗면 벽돌, 앞면 흰 콘크리트
    const top = new THREE.BoxGeometry(stepD, 0.06, len);
    scaleBoxUV(top, stepD, 0.06, len, 2);
    batch.add(top, brickMat, new THREE.Matrix4().makeTranslation(x0 + stepD / 2 + 0.0, h - 0.03, (S.z0 + S.z1) / 2));
    const riser = new THREE.BoxGeometry(stepD, h - 0.06, len);
    scaleBoxUV(riser, stepD, h, len, 2);
    batch.add(riser, whiteConc, new THREE.Matrix4().makeTranslation(x0 + stepD / 2, (h - 0.06) / 2, (S.z0 + S.z1) / 2));
    addBox(x0, x0 + stepD, S.z0, S.z1, 0, h, 'stand');
  }
  // 맨 위 단(산책로)
  const topH = S.steps * S.rise;
  const tx0 = S.x0 + 0.5 + S.steps * stepD;
  batch.box(brickMat, (tx0 + S.x1) / 2, topH - 0.03, (S.z0 + S.z1) / 2, S.x1 - tx0, 0.06, S.z1 - S.z0, 0, false, true, 2);
  batch.box(whiteConc, (tx0 + S.x1) / 2, (topH - 0.06) / 2, (S.z0 + S.z1) / 2, S.x1 - tx0, topH - 0.06, S.z1 - S.z0, 0, true, true, 2);
  addBox(tx0, S.x1, S.z0, S.z1, 0, topH, 'stand');
  // 남·북 끝 흰 옆벽(영상 오른쪽 아래의 흰 벽)
  for (const z of [S.z0 - 0.15, S.z1 + 0.15]) {
    batch.box(whiteConc, (S.x0 + S.x1) / 2 + 0.5, topH / 2 + 0.25, z, S.x1 - S.x0 - 1, topH + 0.5, 0.3, 0, true, true, 2);
    addBox(S.x0 + 1, S.x1, z - 0.15, z + 0.15, 0, topH + 0.5);
  }
  // 위 단에서 정원 쪽으로 내려가는 계단(남쪽 끝)
  for (let i = 0; i < 5; i++) {
    const h = topH - (i + 1) * S.rise;
    if (h <= 0.05) break;
    const x0 = S.x1 + i * 0.5;
    batch.box(whiteConc, x0 + 0.25, h / 2, S.z1 - 2.5, 0.5, h, 4.4);
    addBox(x0, x0 + 0.5, S.z1 - 4.7, S.z1 - 0.3, 0, h);
  }
  // 정원 쪽 뒷벽
  batch.box(whiteConc, S.x1 + 0.15, topH / 2, (S.z0 + S.z1) / 2 - 2.6, 0.3, topH, S.z1 - S.z0 - 5.2);
  addBox(S.x1, S.x1 + 0.3, S.z0, S.z1 - 4.8, 0, topH);

  // 등나무 퍼걸러(철골)
  const pz0 = S.z0 + 1, pz1 = S.z1 - 1;
  const pxA = S.x0 + 1.4, pxB = S.x1 - 1.2;
  const roofA = 4.2, roofB = topH + 3.0;
  for (let z = pz0; z <= pz1 + 0.01; z += 4.2) {
    const hA = roofA, hB = roofB;
    batch.add(new THREE.CylinderGeometry(0.07, 0.08, hA, 8), steel, new THREE.Matrix4().makeTranslation(pxA, hA / 2, z));
    const baseB = topH;
    batch.add(new THREE.CylinderGeometry(0.07, 0.08, hB - baseB, 8), steel, new THREE.Matrix4().makeTranslation(pxB, baseB + (hB - baseB) / 2, z));
    addCyl(pxA, z, 0.1, 0, hA);
    addCyl(pxB, z, 0.1, baseB, hB);
    // 가로보(기울어진)
    const len = Math.hypot(pxB - pxA, hB - hA);
    const beam = new THREE.BoxGeometry(len + 0.6, 0.12, 0.1);
    const m = new THREE.Matrix4().compose(new THREE.Vector3((pxA + pxB) / 2, (hA + hB) / 2 + 0.06, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.atan2(hB - hA, pxB - pxA))), new THREE.Vector3(1, 1, 1));
    batch.add(beam, steel, m);
  }
  // 세로 도리
  for (let k = 0; k <= 6; k++) {
    const f = k / 6;
    const x = pxA - 0.3 + (pxB - pxA + 0.6) * f;
    const y = roofA + (roofB - roofA) * f + 0.18;
    batch.add(new THREE.BoxGeometry(0.06, 0.08, pz1 - pz0 + 0.6), steel, new THREE.Matrix4().makeTranslation(x, y, (pz0 + pz1) / 2));
  }
  const pergola = { x0: pxA, x1: pxB, z0: pz0, z1: pz1, yA: roofA, yB: roofB };

  // 맨 위 단 벤치/테이블(영상의 피크닉 테이블)
  for (const z of [-16.5, -8.1, 4.5]) {
    buildPicnicTable(batch, wood, steel, (tx0 + S.x1) / 2, topH, z);
  }

  // ---------- 벽돌 광장 ----------
  const P = L.plaza;
  batch.box(brickMat, (P.x0 + P.x1) / 2, 0.02, (P.z0 + P.z1) / 2, P.x1 - P.x0, 0.04, P.z1 - P.z0, 0, false, true, 2);
  // 광장 둘레 흰 낮은 벽 + 나무 울타리(영상 오른쪽)
  batch.box(whiteConc, (L.garden.x0 + L.garden.x1) / 2 + 2, 0.35, P.z0 - 0.2, L.garden.x1 - L.garden.x0 - 4, 0.7, 0.4, 0, true, true, 2);
  addBox(L.garden.x0 + 6, L.garden.x1 - 2, P.z0 - 0.4, P.z0, 0, 0.7);
  woodFence(batch, wood, L.garden.x0 + 6, P.z0 - 0.2, L.garden.x1 - 2, P.z0 - 0.2, 0.7);
  woodFence(batch, wood, L.garden.x1, L.garden.z0, L.garden.x1, P.z1, 0);
  addBox(L.garden.x1, L.garden.x1 + 0.3, L.garden.z0, P.z1, 0, 1.4);

  // ---------- 연못 + 바위 ----------
  const pond = buildPond(group, batch, rnd);

  // ---------- 바위·정원석 ----------
  const rockMat = wettable(new THREE.MeshStandardMaterial({ color: 0x8a867e, roughness: 0.85, flatShading: false }), 0.5, 0.3);
  const rocks = [];
  const placeRock = (x, z, s) => {
    const g = rockGeometry(rnd, s);
    batch.add(g, rockMat, new THREE.Matrix4().makeTranslation(x, s * 0.25, z));
    addCyl(x, z, s * 0.85, 0, s * 0.9);
    rocks.push({ x, z, s });
  };
  const p = L.pond;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + rnd() * 0.2;
    placeRock(p.x + Math.cos(a) * (p.rx + 0.6), p.z + Math.sin(a) * (p.rz + 0.6), 0.5 + rnd() * 0.5);
  }
  for (const [x, z, s] of [[72, -14, 1.2], [90, 14, 1.4], [79, -30, 1.1], [94, -20, 1.0], [70, 6, 0.9], [88, -36, 1.3], [-46, 33, 1.2], [36, 34, 1.0], [6, 36, 0.8]]) placeRock(x, z, s);

  // ---------- 가로등 ----------
  const lampMat = nightGlow(new THREE.MeshStandardMaterial({ color: 0xfff2d0, emissive: 0xffd9a0, emissiveIntensity: 0 }), 6);
  const lampSpots = [[-47, -33], [-10, -33], [26, -33], [56.5, -12], [56.5, 18], [-30, 29], [14, 29], [76, 30], [90, -12]];
  const lamps = [];
  for (const [x, z] of lampSpots) {
    batch.add(new THREE.CylinderGeometry(0.07, 0.11, 6, 8), steel, new THREE.Matrix4().makeTranslation(x, 3, z));
    batch.box(steel, x, 6.05, z, 0.9, 0.12, 0.35);
    batch.box(lampMat, x, 5.95, z, 0.75, 0.06, 0.28, 0, false, false);
    addCyl(x, z, 0.12, 0, 6);
    lamps.push(new THREE.Vector3(x, 5.8, z));
  }

  // ---------- 아파트(배경, 영상처럼 학교를 둘러쌈) ----------
  buildApartments(group, rnd);

  // ---------- 학교 담장(남쪽) + 정문 ----------
  const wallMat = wettable(new THREE.MeshStandardMaterial({ map: TX.toTex(TX.windowWall({ wm: 8, hm: 2, base: '#a0786a', brick: true, winW: 0, gap: 100 }), { repeat: [1, 1] }), roughness: 0.9 }));
  const G = L.gate;
  const sw = (x0, x1) => {
    const len = x1 - x0;
    const geo = new THREE.BoxGeometry(len, 1.8, 0.35);
    scaleBoxUV(geo, len, 1.8, 0.35, 8);
    batch.add(geo, wallMat, new THREE.Matrix4().makeTranslation((x0 + x1) / 2, 0.9, G.z + 0.3));
    addBox(x0, x1, G.z + 0.1, G.z + 0.5, 0, 1.8);
  };
  sw(-58, G.x - 4);
  sw(G.x + 4, 97);
  for (const gx of [G.x - 4.3, G.x + 4.3]) {
    batch.box(whiteConc, gx, 1.5, G.z + 0.3, 0.7, 3, 0.7);
    addBoxC(gx, G.z + 0.3, 0.7, 0.7, 0, 3);
  }
  // 정문 철문(닫힘)
  for (let i = 0; i < 16; i++) batch.add(new THREE.CylinderGeometry(0.02, 0.02, 1.6, 5), steel, new THREE.Matrix4().makeTranslation(G.x - 3.8 + i * 0.5, 0.85, G.z + 0.3));
  batch.box(steel, G.x, 1.6, G.z + 0.3, 7.6, 0.08, 0.08);
  batch.box(steel, G.x, 0.15, G.z + 0.3, 7.6, 0.08, 0.08);
  addBox(G.x - 4, G.x + 4, G.z + 0.1, G.z + 0.5, 0, 2);
  // 북쪽·동쪽 경계
  addBox(-60, 100, -62, -60.5, 0, 6);
  addBox(97.5, 98, -62, 50, 0, 6);
  addBox(-50.5, -50, -62, 50, 0, 6);

  // 정문 화단 해시계 받침돌
  const pedestal = { x: 14, z: 37 };
  batch.add(new THREE.CylinderGeometry(0.55, 0.7, 1.0, 8), new THREE.MeshStandardMaterial({ color: 0xbdb5a5, roughness: 0.7 }), new THREE.Matrix4().makeTranslation(pedestal.x, 0.5, pedestal.z));
  addCyl(pedestal.x, pedestal.z, 0.7, 0, 1.0);
  // 화단 테두리
  batch.box(greyConc, pedestal.x, 0.15, pedestal.z, 6, 0.3, 0.25);

  batch.build(group);

  return { group, lamps, pergola, pond, rocks, pedestal, mats: { brickMat, whiteConc, greyConc, steel, wood, rockMat } };
}

function buildGoal(group, batch, mat, gx, mz, side) {
  const w = 7.32 * 0.7, h = 2.2, d = 1.6;
  const bx = side < 0 ? gx - d : gx + d;
  const r = 0.06;
  const m4 = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
  batch.add(new THREE.CylinderGeometry(r, r, h, 8), mat, m4(gx, h / 2, mz - w / 2));
  batch.add(new THREE.CylinderGeometry(r, r, h, 8), mat, m4(gx, h / 2, mz + w / 2));
  batch.add(new THREE.CylinderGeometry(r, r, w, 8).rotateX(Math.PI / 2), mat, m4(gx, h, mz));
  batch.add(new THREE.CylinderGeometry(r * 0.7, r * 0.7, w, 6).rotateX(Math.PI / 2), mat, m4(bx, 0.05, mz));
  for (const zz of [mz - w / 2, mz + w / 2]) {
    const len = Math.hypot(d, h);
    const geo = new THREE.CylinderGeometry(r * 0.7, r * 0.7, len, 6);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(bx - gx, -h, 0).normalize());
    batch.add(geo, mat, new THREE.Matrix4().compose(new THREE.Vector3((gx + bx) / 2, h / 2, zz), q, new THREE.Vector3(1, 1, 1)));
  }
  // 그물
  const net = TX.makeCanvas(64, 64);
  const c = net.getContext('2d');
  c.strokeStyle = '#fafafa'; c.lineWidth = 2;
  for (let i = 0; i <= 64; i += 8) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 64); c.moveTo(0, i); c.lineTo(64, i); c.stroke(); }
  const nt = TX.toTex(net, { repeat: [1, 1] });
  const netMat = new THREE.MeshStandardMaterial({ map: nt, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.9 });
  const slope = Math.hypot(d, h);
  {
    const g = new THREE.BufferGeometry();
    const z0 = mz - w / 2, z1 = mz + w / 2;
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([gx, h, z0, gx, h, z1, bx, 0, z0, bx, 0, z1]), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, slope / 0.2, w / 0.2, slope / 0.2, 0, 0, w / 0.2, 0]), 2));
    g.setIndex([0, 2, 1, 1, 2, 3]);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, netMat);
    m.castShadow = true;
    group.add(m);
  }
  for (const zz of [mz - w / 2, mz + w / 2]) {
    const g = new THREE.BufferGeometry();
    const v = new Float32Array([gx, 0, zz, gx, h, zz, bx, 0, zz]);
    g.setAttribute('position', new THREE.BufferAttribute(v, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 0, h / 0.2, d / 0.2, 0]), 2));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, netMat);
    group.add(m);
  }
  addCyl(gx, mz - w / 2, 0.1, 0, h);
  addCyl(gx, mz + w / 2, 0.1, 0, h);
  addBox(Math.min(gx, bx), Math.max(gx, bx), mz - w / 2 - 0.05, mz - w / 2 + 0.05, 0, h);
  addBox(Math.min(gx, bx), Math.max(gx, bx), mz + w / 2 - 0.05, mz + w / 2 + 0.05, 0, h);
  addBox(bx - 0.05, bx + 0.05, mz - w / 2, mz + w / 2, 0, h * 0.6);
}

function buildPicnicTable(batch, wood, steel, x, y, z) {
  batch.box(wood, x, y + 0.75, z, 0.9, 0.06, 1.9);
  for (const dx of [-0.75, 0.75]) batch.box(wood, x + dx, y + 0.45, z, 0.32, 0.05, 1.9);
  for (const dz of [-0.75, 0.75]) {
    batch.box(steel, x, y + 0.37, z + dz, 1.8, 0.05, 0.06);
    batch.box(steel, x, y + 0.37, z + dz, 0.06, 0.75, 0.06);
  }
  addBox(x - 0.45, x + 0.45, z - 0.95, z + 0.95, y, y + 0.78);
  for (const dx of [-0.75, 0.75]) addBox(x + dx - 0.16, x + dx + 0.16, z - 0.95, z + 0.95, y, y + 0.47);
}

function woodFence(batch, wood, x0, z0, x1, z1, y) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const ang = -Math.atan2(z1 - z0, x1 - x0);
  const n = Math.floor(len / 0.18);
  for (let i = 0; i < n; i++) {
    const f = (i + 0.5) / n;
    const h = 0.75 + (i % 2) * 0.05;
    batch.add(new THREE.BoxGeometry(0.1, h, 0.03).rotateY(ang), wood,
      new THREE.Matrix4().makeTranslation(x0 + (x1 - x0) * f, y + h / 2, z0 + (z1 - z0) * f), true, true);
  }
  for (const hy of [0.25, 0.6]) {
    batch.add(new THREE.BoxGeometry(len, 0.06, 0.04).rotateY(ang), wood,
      new THREE.Matrix4().makeTranslation((x0 + x1) / 2, y + hy, (z0 + z1) / 2 - 0.04));
  }
}

export function rockGeometry(rnd, s) {
  const g = new THREE.IcosahedronGeometry(s, 2);
  const p = g.attributes.position;
  const sx = 0.8 + rnd() * 0.6, sz = 0.8 + rnd() * 0.6;
  const o = rnd() * 10;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = Math.sin(x * 3.1 + o) * Math.cos(z * 2.7 + o) * 0.18 + Math.sin(y * 5.3 + o) * 0.08;
    const k = 1 + n;
    y = y * 0.62 * k;
    if (y < -s * 0.2) y = -s * 0.2;
    p.setXYZ(i, x * sx * k, y, z * sz * k);
  }
  g.computeVertexNormals();
  return g;
}

function buildPond(group, batch, rnd) {
  const p = L.pond;
  // 물: 하늘을 비추는 잔물결
  const nTex = TX.toTex(TX.waterNormal(), { srgb: false, repeat: [3, 3] });
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x1d3b38, roughness: 0.06, metalness: 0.0, normalMap: nTex, normalScale: new THREE.Vector2(0.35, 0.35),
    transparent: true, opacity: 0.88, envMapIntensity: 1.4, clearcoat: 0.3,
  });
  const geo = new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2);
  geo.scale(p.rx + 0.3, 1, p.rz + 0.3);
  const water = new THREE.Mesh(geo, mat);
  water.position.set(p.x, -0.12, p.z);
  water.receiveShadow = true;
  group.add(water);
  const bed = new THREE.Mesh(geo.clone(), new THREE.MeshStandardMaterial({ color: 0x241f17, roughness: 1 }));
  bed.position.set(p.x, -0.6, p.z);
  group.add(bed);
  // 수련 잎
  const lily = new THREE.MeshStandardMaterial({ color: 0x3f7a35, roughness: 0.6, side: THREE.DoubleSide });
  for (let i = 0; i < 9; i++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 0.75;
    const g = new THREE.CircleGeometry(0.3 + rnd() * 0.2, 12, 0.3, Math.PI * 2 - 0.6).rotateX(-Math.PI / 2);
    batch.add(g, lily, new THREE.Matrix4().makeTranslation(p.x + Math.cos(a) * p.rx * r, -0.1, p.z + Math.sin(a) * p.rz * r), false, true);
  }
  return {
    water, mat,
    update(dt) {
      nTex.offset.x += dt * 0.012 * (0.5 + U.uWind.value);
      nTex.offset.y += dt * 0.008;
    },
  };
}

function buildApartments(group, rnd) {
  const day = TX.toTex(TX.apartmentTexture(false, 1));
  const lit = TX.toTex(TX.apartmentTexture(true, 2));
  const mat = nightGlow(new THREE.MeshStandardMaterial({ map: day, emissiveMap: lit, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.8 }), 1.2);
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xb9b3a6, roughness: 0.9 });
  const accent = new THREE.MeshStandardMaterial({ color: 0x9a6458, roughness: 0.8 });
  const batch = new StaticBatch();
  // 영상: 서쪽(운동장 너머) 고층, 북동쪽(별관 뒤) 고층 다수
  const list = [
    [-105, -10, 26, 14, 0.1, 24], [-110, 30, 24, 14, -0.2, 20], [-95, -60, 24, 14, 0.3, 22],
    [-60, -105, 30, 14, 0, 18], [10, -110, 28, 14, 0.05, 16],
    [60, -100, 22, 14, 0, 25], [95, -85, 26, 14, 0.4, 23], [120, -40, 24, 14, 1.2, 21],
    [135, 20, 26, 14, 1.4, 18], [40, 105, 30, 14, 0, 15], [-40, 100, 30, 14, 0.1, 17],
  ];
  for (const [x, z, w, d, ry, floors] of list) {
    const h = floors * 2.8;
    const geo = new THREE.BoxGeometry(w, h, d);
    const uv = geo.attributes.uv;
    // 한 타일 = 4세대 x 16층
    for (let i = 0; i < uv.count; i++) {
      const f = Math.floor(i / 4);
      const span = f < 2 ? d : w;
      uv.setXY(i, uv.getX(i) * span / 14, uv.getY(i) * floors / 16);
    }
    batch.add(geo, mat, new THREE.Matrix4().compose(new THREE.Vector3(x, h / 2, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(1, 1, 1)), true, true);
    batch.add(new THREE.BoxGeometry(w * 0.3, 4, d * 0.6), roofMat, new THREE.Matrix4().compose(new THREE.Vector3(x, h + 2, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(1, 1, 1)));
    if (rnd() < 0.5) batch.add(new THREE.BoxGeometry(2.2, h * 0.5, d + 0.2), accent, new THREE.Matrix4().compose(new THREE.Vector3(x, h * 0.75, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(1, 1, 1)));
  }
  // 낮은 상가·주택
  const lowMat = new THREE.MeshStandardMaterial({ color: 0xb8aa98, roughness: 0.9 });
  for (let i = 0; i < 40; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 120 + rnd() * 90;
    const x = 20 + Math.cos(a) * r, z = -8 + Math.sin(a) * r * 0.8;
    const h = 6 + rnd() * 10;
    batch.add(new THREE.BoxGeometry(10 + rnd() * 10, h, 10 + rnd() * 8), lowMat, new THREE.Matrix4().makeTranslation(x, h / 2, z), false, false);
  }
  batch.build(group);
}

export { inPond };
