import * as THREE from 'three';
import { L } from './layout.js';
import { addBox } from './collision.js';
import { StaticBatch, nightGlow, wettable, scaleBoxUV } from './materials.js';
import * as TX from './textures.js';
import { mulberry32 } from './util.js';

// 본관(영상 속 파란 체크 유리 외벽 + "희망과 감동을 주는 번동중학교" 간판), 계단탑, 별관, 동관
// 1층은 실제로 들어가서 돌아다닐 수 있음
export function buildSchool(scene) {
  const group = new THREE.Group();
  group.name = 'school';
  scene.add(group);
  const batch = new StaticBatch();
  const M = L.main;
  const rnd = mulberry32(77);

  const box = (mat, x0, x1, y0, y1, z0, z1, collide = true, uv = null, cast = true) => {
    const sx = x1 - x0, sy = y1 - y0, sz = z1 - z0;
    const geo = new THREE.BoxGeometry(sx, sy, sz);
    if (uv) uv(geo, sx, sy, sz);
    batch.add(geo, mat, new THREE.Matrix4().makeTranslation((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), cast, true);
    if (collide) addBox(x0, x1, z0, z1, y0, y1, 'bldg');
  };
  const tiled = (s) => (geo, sx, sy, sz) => scaleBoxUV(geo, sx, sy, sz, s);
  // u는 길이 비례, v는 높이 전체 0~1
  const wallUV = (uLen) => (geo, sx, sy, sz) => {
    const uv = geo.attributes.uv;
    const dims = [sz, sz, sx, sx, sx, sx];
    for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
      const idx = f * 4 + i;
      uv.setX(idx, uv.getX(idx) * dims[f] / uLen);
    }
  };

  // ---------- 재질 ----------
  const fh = M.fh;
  const upperH = fh * (M.floors - 1);
  const concrete = wettable(new THREE.MeshStandardMaterial({ map: TX.toTex(TX.concreteTexture('#c4c1ba'), { repeat: [1, 1] }), roughness: 0.85 }), 0.4, 0.15);
  const darkConc = new THREE.MeshStandardMaterial({ map: TX.toTex(TX.concreteTexture('#7f7c77'), { repeat: [1, 1] }), roughness: 0.9 });
  const white = new THREE.MeshStandardMaterial({ color: 0xeeeeea, roughness: 0.6 });
  const mullion = new THREE.MeshStandardMaterial({ color: 0xe9ebee, roughness: 0.4, metalness: 0.4 });

  // 오른쪽 체크 유리 외벽 (x 10~30, 2~4층)
  const chkW = M.x1 - 10;
  const chk = new THREE.MeshStandardMaterial({
    map: TX.toTex(TX.checkerFacade(chkW, M.floors - 1, fh, 5)),
    emissiveMap: TX.toTex(TX.checkerFacade(chkW, M.floors - 1, fh, 5, true)),
    emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.18, metalness: 0.35,
  });
  nightGlow(chk, 1.4);
  // 왼쪽 연청회색 외벽 (x -35~-2)
  const leftW = -2 - M.x0;
  const leftFacade = new THREE.MeshStandardMaterial({
    map: TX.toTex(TX.windowWall({ wm: leftW, hm: upperH, fh, base: '#b9c4d3', win: '#4f74b4', winW: 2.4, gap: 1.2, sill: 1.0, winH: 1.7, seed: 3 })),
    emissiveMap: TX.toTex(TX.windowWall({ wm: leftW, hm: upperH, fh, winW: 2.4, gap: 1.2, sill: 1.0, winH: 1.7, seed: 3, lit: true })),
    emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.6,
  });
  nightGlow(leftFacade, 1.2);
  const sideFacade = (wm, hm, seed, base = '#c3c2bd') => nightGlow(new THREE.MeshStandardMaterial({
    map: TX.toTex(TX.windowWall({ wm, hm, fh, base, win: '#55697f', seed })),
    emissiveMap: TX.toTex(TX.windowWall({ wm, hm, fh, seed, lit: true })),
    emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.75,
  }), 1.0);

  // ---------- 본관 2~4층 덩어리 ----------
  const y1 = fh, y4 = fh * M.floors;
  // 정면 재질만 다르게: [+x, -x, +y, -y, +z(남), -z(북)]
  const backMat = sideFacade(M.x1 - M.x0, upperH, 11);
  const endMat = sideFacade(M.z1 - M.z0, upperH, 12);
  {
    // 체크 유리 블록
    const g = new THREE.BoxGeometry(chkW, upperH, M.z1 - M.z0);
    const mesh = new THREE.Mesh(g, [endMat, endMat, concrete, concrete, chk, backMat]);
    mesh.position.set((10 + M.x1) / 2, y1 + upperH / 2, (M.z0 + M.z1) / 2);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
    const g2 = new THREE.BoxGeometry(leftW, upperH, M.z1 - M.z0);
    const mesh2 = new THREE.Mesh(g2, [endMat, endMat, concrete, concrete, leftFacade, backMat]);
    mesh2.position.set((M.x0 - 2) / 2, y1 + upperH / 2, (M.z0 + M.z1) / 2);
    mesh2.castShadow = mesh2.receiveShadow = true;
    group.add(mesh2);
    // 현관 위(가운데) 블록
    const mid = new THREE.Mesh(new THREE.BoxGeometry(12, upperH, M.z1 - M.z0), [concrete, concrete, concrete, concrete, chk, backMat]);
    mid.position.set(4, y1 + upperH / 2, (M.z0 + M.z1) / 2);
    mid.castShadow = mid.receiveShadow = true;
    group.add(mid);
    addBox(M.x0, M.x1, M.z0, M.z1, y1, y4 + 6, 'bldg');
  }

  // 층 사이 흰 띠(외벽 앞)
  for (let f = 1; f < M.floors; f++) {
    box(white, M.x0 - 0.05, -2, f * fh - 0.18, f * fh + 0.12, M.z1, M.z1 + 0.18, false);
  }

  // ---------- 간판 띠 ----------
  const signH = 2.0;
  const signMat = new THREE.MeshStandardMaterial({ map: TX.toTex(TX.signBand(M.x1 - M.x0 + 0.6, signH, -6 - M.x0, 26.5 - M.x0), { aniso: 16 }), roughness: 0.8 });
  const brickBand = new THREE.MeshStandardMaterial({ color: 0x956b5f, roughness: 0.85 });
  {
    const g = new THREE.BoxGeometry(M.x1 - M.x0 + 0.6, signH, M.z1 - M.z0 + 0.6);
    const mesh = new THREE.Mesh(g, [brickBand, brickBand, concrete, brickBand, signMat, brickBand]);
    mesh.position.set((M.x0 + M.x1) / 2, y4 + signH / 2, (M.z0 + M.z1) / 2);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }
  const topY = y4 + signH;

  // ---------- 꼭대기 강당(체육관) 층: 은회색 + 가로 띠창 + 둥근 지붕 ----------
  const gymMat = nightGlow(new THREE.MeshStandardMaterial({
    map: TX.toTex(TX.windowWall({ wm: 57, hm: 3.6, fh: 3.6, base: '#c9d1dc', win: '#7f9cc4', winW: 3.2, gap: 0.6, sill: 1.6, winH: 1.3, seed: 9 })),
    emissiveMap: TX.toTex(TX.windowWall({ wm: 57, hm: 3.6, fh: 3.6, winW: 3.2, gap: 0.6, sill: 1.6, winH: 1.3, seed: 9, lit: true })),
    emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.5, metalness: 0.2,
  }), 0.8);
  const gx0 = M.x0 + 1, gx1 = 22, gz0 = M.z0 + 1, gz1 = M.z1 - 3;
  box(gymMat, gx0, gx1, topY, topY + 3.6, gz0, gz1, false, wallUV(57));
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xc8ced6, roughness: 0.35, metalness: 0.6 });
  {
    const span = gz1 - gz0;
    const r = span / 2 / Math.sin(0.55);
    const g = new THREE.CylinderGeometry(r, r, gx1 - gx0 + 0.6, 40, 1, true, Math.PI / 2 - 0.55, 1.1);
    g.rotateZ(Math.PI / 2);
    const m = new THREE.Mesh(g, roofMat);
    roofMat.side = THREE.DoubleSide;
    m.position.set((gx0 + gx1) / 2, topY + 3.6 - r * Math.cos(0.55), (gz0 + gz1) / 2);
    m.castShadow = true;
    group.add(m);
    // 둥근 지붕 양 끝 막기(활꼴)
    const sh = new THREE.Shape();
    const steps = 20;
    for (let i = 0; i <= steps; i++) {
      const a = -0.55 + (1.1 * i) / steps;
      const z = r * Math.sin(a), y = r * Math.cos(a) - r * Math.cos(0.55);
      if (i === 0) sh.moveTo(z, y); else sh.lineTo(z, y);
    }
    sh.closePath();
    for (const ex of [gx0 - 0.3, gx1 + 0.3]) {
      const cap = new THREE.Mesh(new THREE.ShapeGeometry(sh).rotateY(Math.PI / 2), gymMat);
      cap.material = new THREE.MeshStandardMaterial({ color: 0xc9d1dc, roughness: 0.6, side: THREE.DoubleSide });
      cap.position.set(ex, topY + 3.6, (gz0 + gz1) / 2);
      group.add(cap);
    }
    // 옥상 기계실(영상 위쪽 작은 상자)
    box(white, 16, 21, topY + 3.6, topY + 6.4, -50, -45, false);
  }
  // 간판 위 낮은 난간
  box(concrete, 22, M.x1 + 0.3, topY, topY + 1.0, M.z1 - 0.2, M.z1 + 0.3, false);

  // ---------- 중앙현관 블록(앞으로 튀어나온 회색 콘크리트 + 초록 유리 세로창) ----------
  const E = L.entrance;
  const entTexC = TX.makeCanvas(256, 512);
  {
    const c = entTexC.getContext('2d');
    c.fillStyle = '#b3afa8'; c.fillRect(0, 0, 256, 512);
    const g = c.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#5e8f78'); g.addColorStop(1, '#2f5c4a');
    c.fillStyle = g; c.fillRect(64, 20, 128, 470);
    c.fillStyle = '#d8dbd6';
    for (let y = 20; y < 490; y += 39) c.fillRect(64, y, 128, 3);
    for (let x = 64; x <= 192; x += 32) c.fillRect(x - 1, 20, 3, 470);
  }
  const entMat = new THREE.MeshStandardMaterial({ map: TX.toTex(entTexC), roughness: 0.4, metalness: 0.2 });
  {
    const g = new THREE.BoxGeometry(E.x1 - E.x0, upperH + signH, E.z1 - E.z0);
    const mesh = new THREE.Mesh(g, [concrete, concrete, concrete, concrete, entMat, concrete]);
    mesh.position.set((E.x0 + E.x1) / 2, y1 + (upperH + signH) / 2, (E.z0 + E.z1) / 2);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
    addBox(E.x0, E.x1, E.z0, E.z1, y1, y4 + signH, 'bldg');
  }
  // 현관 차양
  box(concrete, E.x0 - 0.3, E.x1 + 0.3, y1 - 0.35, y1, E.z1, E.z1 + 1.6, false);

  // ---------- 1층 외벽 ----------
  const glass = new THREE.MeshStandardMaterial({ color: 0x8fb3cf, roughness: 0.05, metalness: 0.6, transparent: true, opacity: 0.28, depthWrite: false, envMapIntensity: 1.6 });
  const groundWallH = fh;
  const winBottom = 0.9, winTop = 3.0;
  const glassFront = (x0, x1, z, thick = 0.25) => {
    // 낮은 벽 + 유리 + 위 인방
    box(darkConc, x0, x1, 0, winBottom, z - thick, z, true, tiled(2));
    box(concrete, x0, x1, winTop, groundWallH, z - thick, z, false, tiled(2));
    const g = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, winTop - winBottom), glass);
    g.position.set((x0 + x1) / 2, (winBottom + winTop) / 2, z - thick / 2);
    g.renderOrder = 2;
    group.add(g);
    addBox(x0, x1, z - thick, z, 0, groundWallH, 'glass');
    for (let x = x0; x <= x1 + 0.01; x += 1.6) box(mullion, x - 0.04, x + 0.04, winBottom, winTop, z - thick, z, false, null, false);
    box(mullion, x0, x1, (winBottom + winTop) / 2 - 0.03, (winBottom + winTop) / 2 + 0.03, z - thick, z, false, null, false);
  };
  glassFront(M.x0, E.x0, M.z1);
  glassFront(E.x1, M.x1, M.z1);
  // 현관 정면(문 자리 x 2~6 비움)
  glassFront(E.x0, 2, E.z1);
  glassFront(6, E.x1, E.z1);
  box(concrete, 2, 6, 3.0, fh, E.z1 - 0.25, E.z1, false);
  // 현관 옆벽
  box(concrete, E.x0 - 0.25, E.x0, 0, fh, E.z0, E.z1, true, tiled(2));
  box(concrete, E.x1, E.x1 + 0.25, 0, fh, E.z0, E.z1, true, tiled(2));
  // 서·북·동 1층 외벽
  const g1 = sideFacade(M.z1 - M.z0, fh, 21);
  box(g1, M.x0 - 0.3, M.x0, 0, fh, M.z0, M.z1, true, wallUV(M.z1 - M.z0));
  box(g1, M.x1, M.x1 + 0.05, 0, fh, M.z0, M.z1, true, wallUV(M.z1 - M.z0));
  const g2 = sideFacade(M.x1 - M.x0, fh, 22);
  box(g2, M.x0, M.x1, 0, fh, M.z0 - 0.3, M.z0, true, wallUV(M.x1 - M.x0));

  // ---------- 계단탑(주황·노랑 패널) ----------
  const Tw = L.tower;
  const towerH = 22;
  const twMat = nightGlow(new THREE.MeshStandardMaterial({
    map: TX.toTex(TX.towerTexture(Tw.x1 - Tw.x0, towerH)),
    emissiveMap: TX.toTex(TX.towerTexture(Tw.x1 - Tw.x0, towerH, true)),
    emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.6,
  }), 1.0);
  {
    const g = new THREE.BoxGeometry(Tw.x1 - Tw.x0, towerH, Tw.z1 - Tw.z0);
    const mesh = new THREE.Mesh(g, [concrete, concrete, concrete, concrete, twMat, concrete]);
    mesh.position.set((Tw.x0 + Tw.x1) / 2, towerH / 2, (Tw.z0 + Tw.z1) / 2);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
    addBox(Tw.x0, Tw.x1, Tw.z0, Tw.z1, 0, towerH, 'bldg');
    // 계단탑 입구(닫힌 문)
    box(new THREE.MeshStandardMaterial({ color: 0x3d4a57, roughness: 0.4, metalness: 0.5 }), Tw.x0 + 3.6, Tw.x0 + 5.4, 0, 2.4, Tw.z1, Tw.z1 + 0.06, false);
    box(white, Tw.x0 + 0.2, Tw.x0 + 1.8, 2.0, 2.3, Tw.z1, Tw.z1 + 0.3, false);
  }

  // ---------- 별관(짙은 갈색 벽돌) ----------
  const A = L.annex;
  const annexMat = nightGlow(new THREE.MeshStandardMaterial({
    map: TX.toTex(TX.windowWall({ wm: A.x1 - A.x0, hm: 16, fh: 3.6, base: '#6e4535', brick: true, win: '#4a5a6a', winW: 1.4, gap: 1.6, seed: 31 })),
    emissiveMap: TX.toTex(TX.windowWall({ wm: A.x1 - A.x0, hm: 16, fh: 3.6, winW: 1.4, gap: 1.6, seed: 31, lit: true })),
    emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.85,
  }), 1.0);
  box(annexMat, A.x0, A.x1, 0, 16, A.z0, A.z1, true, wallUV(A.x1 - A.x0));

  // ---------- 동관(베이지) + 태양광 차양 ----------
  const Eb = L.east;
  const eastMat = nightGlow(new THREE.MeshStandardMaterial({
    map: TX.toTex(TX.windowWall({ wm: Eb.x1 - Eb.x0, hm: 14, fh: 3.5, base: '#a89d91', win: '#3f4a55', winW: 1.8, gap: 1.3, seed: 41 })),
    emissiveMap: TX.toTex(TX.windowWall({ wm: Eb.x1 - Eb.x0, hm: 14, fh: 3.5, winW: 1.8, gap: 1.3, seed: 41, lit: true })),
    emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.85,
  }), 1.0);
  box(eastMat, Eb.x0, Eb.x1, 0, 14, Eb.z0, Eb.z1, true, wallUV(Eb.x1 - Eb.x0));
  box(white, Eb.x0 - 0.2, Eb.x1 + 0.2, 14, 14.8, Eb.z0 - 0.2, Eb.z1 + 0.2, false);
  // 동관 앞 계단과 출입구
  for (let i = 0; i < 4; i++) box(concrete, 52, 56, 0, (i + 1) * 0.3, Eb.z1 + 3 - i * 0.6, Eb.z1 + 3.6 - i * 0.6 + 0.0);
  box(concrete, 50, 58, 0, 1.2, Eb.z1, Eb.z1 + 1.2);
  // 태양광 패널 차양(영상: 스탠드 북쪽 끝)
  const panelMat = new THREE.MeshStandardMaterial({ color: 0x2a3f6a, roughness: 0.2, metalness: 0.6 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x8b9095, roughness: 0.4, metalness: 0.7 });
  for (const [x, z] of [[53, -36], [59, -36], [53, -31], [59, -31]]) {
    batch.add(new THREE.CylinderGeometry(0.08, 0.08, 3.6, 8), steel, new THREE.Matrix4().makeTranslation(x, 1.8, z));
    addBox(x - 0.1, x + 0.1, z - 0.1, z + 0.1, 0, 3.6);
  }
  {
    const g = new THREE.BoxGeometry(8.4, 0.08, 6.4);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(56, 3.8, -33.5), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.18, 0, 0)), new THREE.Vector3(1, 1, 1));
    batch.add(g, panelMat, m);
    for (let i = 0; i < 5; i++) batch.add(new THREE.BoxGeometry(8.4, 0.02, 0.04), steel, new THREE.Matrix4().compose(new THREE.Vector3(56, 3.86, -36.3 + i * 1.4), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.18, 0, 0)), new THREE.Vector3(1, 1, 1)));
  }

  // ---------- 실내 ----------
  const interior = buildInterior(group, batch, rnd);

  batch.build(group);
  return { group, interior };
}

// ---------------- 본관 1층 실내 ----------------
function buildInterior(group, batch, rnd) {
  const M = L.main, I = L.inside, C = I.corridor;
  const ceil = I.ceiling;
  const anchors = { lights: [], doors: [], lockers: [], desks: [], shelves: [], cases: [], boards: [], cabinets: [] };

  // 재질
  const floorTex = TX.toTex(TX.floorTiles(), { repeat: [1, 1] });
  const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.35, metalness: 0.05 });
  const wallC = TX.makeCanvas(256, 256);
  {
    const c = wallC.getContext('2d');
    c.fillStyle = '#ece5d3'; c.fillRect(0, 0, 256, 256);
    c.fillStyle = '#9db3a2'; c.fillRect(0, 256 - 256 / 3.6, 256, 256 / 3.6);
    c.fillStyle = '#6f8a78'; c.fillRect(0, 256 - 256 / 3.6 - 4, 256, 4);
  }
  const wallMat = new THREE.MeshStandardMaterial({ map: TX.toTex(wallC, { repeat: [1, 1] }), roughness: 0.85 });
  const ceilMat = new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 0.9 });
  const lightPanel = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf4f8ff, emissiveIntensity: 1.6 });
  lightPanel.userData.indoor = true;
  const deskWood = new THREE.MeshStandardMaterial({ map: TX.toTex(TX.woodTexture([196, 160, 112]), { repeat: [1, 1] }), roughness: 0.55 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x6c7176, roughness: 0.45, metalness: 0.7 });
  const chairMat = new THREE.MeshStandardMaterial({ color: 0x3a5f8f, roughness: 0.6 });
  const darkTop = new THREE.MeshStandardMaterial({ color: 0x1d1f22, roughness: 0.3 });
  const lockerMat = new THREE.MeshStandardMaterial({ color: 0x8aa6c1, roughness: 0.45, metalness: 0.4 });

  const wall = (x0, x1, z0, z1, collide = true) => {
    const sx = x1 - x0, sz = z1 - z0;
    const geo = new THREE.BoxGeometry(sx, ceil, sz);
    const uv = geo.attributes.uv;
    const dims = [sz, sz, sx, sx, sx, sx];
    for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) uv.setX(f * 4 + i, uv.getX(f * 4 + i) * dims[f] / 4);
    batch.add(geo, wallMat, new THREE.Matrix4().makeTranslation((x0 + x1) / 2, ceil / 2, (z0 + z1) / 2), false, true);
    if (collide) addBox(x0, x1, z0, z1, 0, ceil, 'wall');
  };

  // 바닥·천장
  const fx0 = M.x0, fx1 = M.x1;
  {
    const floorPlane = (x0, x1, z0, z1) => {
      const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2);
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (x1 - x0) / 2.4, uv.getY(i) * (z1 - z0) / 2.4);
      batch.add(g, floorMat, new THREE.Matrix4().makeTranslation((x0 + x1) / 2, 0.015, (z0 + z1) / 2), false, true);
    };
    floorPlane(M.x0, M.x1, M.z0, M.z1);
    floorPlane(L.entrance.x0, L.entrance.x1, L.entrance.z0, L.entrance.z1);
    const c = new THREE.PlaneGeometry(fx1 - fx0, M.z1 - M.z0).rotateX(Math.PI / 2);
    batch.add(c, ceilMat, new THREE.Matrix4().makeTranslation((fx0 + fx1) / 2, ceil, (M.z0 + M.z1) / 2), false, false);
    const c2 = new THREE.PlaneGeometry(L.entrance.x1 - L.entrance.x0, L.entrance.z1 - L.entrance.z0).rotateX(Math.PI / 2);
    batch.add(c2, ceilMat, new THREE.Matrix4().makeTranslation((L.entrance.x0 + L.entrance.x1) / 2, ceil, (L.entrance.z0 + L.entrance.z1) / 2), false, false);
    // 천장 위를 막아 그림자가 새지 않게
    batch.add(new THREE.BoxGeometry(fx1 - fx0, 0.15, M.z1 - M.z0), ceilMat, new THREE.Matrix4().makeTranslation((fx0 + fx1) / 2, ceil + 0.1, (M.z0 + M.z1) / 2), true, false);
  }

  // 복도-교실 사이 벽 (문 자리 비움)
  const wz0 = C.z0 - 0.2, wz1 = C.z0;
  const doorW = 1.5;
  let x = M.x0;
  for (const r of I.rooms) {
    if (r.id === 'lobby') {
      wall(x, r.x0, wz0, wz1);
      x = r.x1;
      continue;
    }
    if (r.door != null) {
      wall(x, r.door - doorW / 2, wz0, wz1);
      // 문 위 벽
      const sx = doorW;
      batch.add(new THREE.BoxGeometry(sx, ceil - 2.3, 0.2), wallMat, new THREE.Matrix4().makeTranslation(r.door, 2.3 + (ceil - 2.3) / 2, (wz0 + wz1) / 2), false, true);
      anchors.doors.push({ room: r, x: r.door, z: (wz0 + wz1) / 2, w: doorW, locked: !!r.locked });
      x = r.door + doorW / 2;
    }
  }
  wall(x, M.x1, wz0, wz1);
  // 교실 사이 칸막이
  for (const r of I.rooms) {
    if (r.x0 <= M.x0 + 0.1) continue;
    if (r.id === 'lobby' || I.rooms[I.rooms.indexOf(r) - 1]?.id === 'lobby') {
      // 로비 양옆 벽: 복도 쪽은 열림
      wall(r.x0 - 0.1, r.x0 + 0.1, M.z0, wz0);
    } else {
      wall(r.x0 - 0.1, r.x0 + 0.1, M.z0, wz0);
    }
  }

  // 천장 조명 패널
  const addLight = (lx, lz, room) => {
    batch.add(new THREE.BoxGeometry(1.2, 0.05, 0.3), lightPanel, new THREE.Matrix4().makeTranslation(lx, ceil - 0.03, lz), false, false);
    anchors.lights.push({ x: lx, y: ceil - 0.25, z: lz, room });
  };
  for (let lx = M.x0 + 3; lx < M.x1; lx += 6) addLight(lx, (C.z0 + C.z1) / 2, 'corridor');
  for (const r of I.rooms) {
    const cx = (r.x0 + r.x1) / 2, cz = (M.z0 + C.z0) / 2;
    addLight(cx - 2, cz - 2.2, r.id); addLight(cx + 2, cz - 2.2, r.id);
    addLight(cx - 2, cz + 2.2, r.id); addLight(cx + 2, cz + 2.2, r.id);
  }

  // 복도 사물함(신발장/개인 사물함)
  const lockerRuns = [[-34.5, -25.2], [-22.6, -15.2], [-12.6, -5.2], [13.2, 19.6], [23.2, 29.6]];
  for (const [a, b] of lockerRuns) {
    for (let lx = a; lx + 0.6 <= b; lx += 0.62) {
      batch.box(lockerMat, lx + 0.3, 0.9, C.z0 + 0.25, 0.6, 1.8, 0.45);
      batch.box(metal, lx + 0.5, 1.0, C.z0 + 0.48, 0.03, 0.15, 0.02, 0, false, false);
      anchors.lockers.push({ x: lx + 0.3, z: C.z0 + 0.25 });
    }
    addBox(a, b, C.z0, C.z0 + 0.5, 0, 1.8);
  }

  // 교실 꾸미기
  for (const r of I.rooms) {
    const rz0 = M.z0 + 0.2, rz1 = wz0;
    const cx = (r.x0 + r.x1) / 2, cz = (rz0 + rz1) / 2;
    if (r.id === 'c11' || r.id === 'c12') {
      // 칠판(서쪽 벽)
      const lines = r.id === 'c11'
        ? ['10월 9일  한글날', '오늘의 할 일: 학교에 숨은 유물 7점 찾기', '※ 해가 지면 운동장에 나가지 말 것']
        : ['악령 출몰 주의!!', '팥·쑥은 악귀를 쫓는다 (동지 팥죽)', '역사교실 열쇠: 분실물 가방 확인']
      ;
      const bb = new THREE.MeshStandardMaterial({ map: TX.toTex(TX.blackboardTexture(lines)), roughness: 0.9 });
      const g = new THREE.PlaneGeometry(5.2, 1.4).rotateY(Math.PI / 2);
      batch.add(g, bb, new THREE.Matrix4().makeTranslation(r.x0 + 0.13, 1.7, cz), false, false);
      // 교탁
      batch.box(deskWood, r.x0 + 1.6, 0.5, cz, 0.6, 1.0, 1.2);
      addBox(r.x0 + 1.3, r.x0 + 1.9, cz - 0.6, cz + 0.6, 0, 1.0);
      // 책상 4x5
      for (let i = 0; i < 4; i++) for (let j = 0; j < 5; j++) {
        const dx = r.x0 + 3.4 + i * 1.6, dz = rz0 + 1.3 + j * 1.6;
        if (dz > rz1 - 1) continue;
        buildDesk(batch, deskWood, metal, chairMat, dx, dz);
        anchors.desks.push({ x: dx, z: dz, room: r.id });
      }
      // 뒤쪽 사물함
      batch.box(lockerMat, r.x1 - 0.35, 0.55, cz, 0.5, 1.1, 6);
      addBox(r.x1 - 0.6, r.x1 - 0.1, cz - 3, cz + 3, 0, 1.1);
    } else if (r.id === 'science') {
      for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) {
        const bx = r.x0 + 4 + i * 5, bz = rz0 + 2 + j * 3;
        batch.box(darkTop, bx, 0.9, bz, 3, 0.06, 1.3);
        batch.box(new THREE.MeshStandardMaterial({ color: 0xd8d4c8, roughness: 0.7 }), bx, 0.43, bz, 2.9, 0.86, 1.2);
        addBox(bx - 1.5, bx + 1.5, bz - 0.65, bz + 0.65, 0, 0.93);
        // 수도꼭지
        batch.box(metal, bx + 1.1, 1.05, bz, 0.05, 0.25, 0.05);
      }
      const bb = new THREE.MeshStandardMaterial({ map: TX.toTex(TX.blackboardTexture(['과학실 안전 수칙', '1. 불꽃·화약은 선생님 허락 후에', '2. 신기전 모형 만지지 말 것!'])), roughness: 0.9 });
      batch.add(new THREE.PlaneGeometry(5.2, 1.4).rotateY(Math.PI / 2), bb, new THREE.Matrix4().makeTranslation(r.x0 + 0.33, 1.7, cz), false, false);
      // 약품장
      batch.box(new THREE.MeshStandardMaterial({ color: 0xcfcab9, roughness: 0.6 }), r.x1 - 1.2, 1.0, rz0 + 0.4, 2.0, 2.0, 0.6);
      addBox(r.x1 - 2.2, r.x1 - 0.2, rz0, rz0 + 0.7, 0, 2.0);
      anchors.cabinets.push({ x: r.x1 - 1.2, z: rz0 + 0.95, room: r.id });
    } else if (r.id === 'library') {
      const shelfMat = new THREE.MeshStandardMaterial({ map: TX.toTex(TX.bookshelfTexture()), roughness: 0.8 });
      for (let i = 0; i < 3; i++) {
        const sz = rz0 + 1.2 + i * 2.6;
        const g = new THREE.BoxGeometry(6, 2.1, 0.5);
        scaleBoxUV(g, 6, 2.1, 0.5, 2.1);
        batch.add(g, shelfMat, new THREE.Matrix4().makeTranslation(cx + 0.5, 1.05, sz));
        addBox(cx - 2.5, cx + 3.5, sz - 0.25, sz + 0.25, 0, 2.1);
        anchors.shelves.push({ x: cx + 0.5, z: sz });
      }
      batch.box(deskWood, cx, 0.74, rz1 - 1.6, 4, 0.06, 1.2);
      batch.box(metal, cx, 0.37, rz1 - 1.6, 3.8, 0.7, 0.05);
      addBox(cx - 2, cx + 2, rz1 - 2.2, rz1 - 1.0, 0, 0.77);
    } else if (r.id === 'history') {
      const glassM = new THREE.MeshStandardMaterial({ color: 0xcfe3f0, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.22, depthWrite: false });
      const baseM = new THREE.MeshStandardMaterial({ color: 0x3a2a1e, roughness: 0.6 });
      const caseAt = (x, z, w = 1.2, d = 0.8) => {
        batch.box(baseM, x, 0.45, z, w, 0.9, d);
        const g = new THREE.Mesh(new THREE.BoxGeometry(w, 0.7, d), glassM);
        g.position.set(x, 1.25, z);
        g.renderOrder = 2;
        group.add(g);
        addBox(x - w / 2, x + w / 2, z - d / 2, z + d / 2, 0, 1.6);
        anchors.cases.push({ x, z, top: 0.9 });
      };
      caseAt(cx, cz, 1.4, 1.0);
      caseAt(r.x0 + 1.2, rz0 + 1.2); caseAt(r.x0 + 1.2, rz0 + 3.6); caseAt(r.x1 - 1.2, rz0 + 1.2); caseAt(r.x1 - 1.2, rz0 + 3.6);
      const bb = new THREE.MeshStandardMaterial({ map: TX.toTex(TX.blackboardTexture(['우리 역사 유물 특별전', '사인참사검 · 백제 금동대향로 · 다뉴세문경', '앙부일구 · 신기전 · 비격진천뢰 · 곡옥'])), roughness: 0.9 });
      batch.add(new THREE.PlaneGeometry(5.2, 1.4).rotateY(Math.PI / 2), bb, new THREE.Matrix4().makeTranslation(r.x0 + 0.13, 1.7, cz), false, false);
    } else if (r.id === 'lobby') {
      // 장식 계단(2층 통제)
      const stairMat = new THREE.MeshStandardMaterial({ color: 0xb7b1a5, roughness: 0.6 });
      for (let i = 0; i < 6; i++) {
        batch.box(stairMat, r.x0 + 2.5, 0.09 * (i + 1), M.z0 + 6.5 - i * 0.3, 3.6, 0.18 * (i + 1), 0.3);
      }
      addBox(r.x0 + 0.6, r.x0 + 4.4, M.z0 + 4.8, M.z0 + 6.8, 0, 1.2);
      // 출입 통제 띠
      batch.box(new THREE.MeshStandardMaterial({ color: 0xe8c23a, emissive: 0x221a00 }), r.x0 + 2.5, 0.9, M.z0 + 7.1, 3.8, 0.08, 0.04);
      // 학교 상징 액자
      const emC = TX.makeCanvas(512, 256);
      const c = emC.getContext('2d');
      c.fillStyle = '#20324f'; c.fillRect(0, 0, 512, 256);
      c.fillStyle = '#e8c478';
      c.font = '900 64px "Noto Serif KR", serif'; c.textAlign = 'center';
      c.fillText('번동중학교', 256, 120);
      c.font = '600 30px "Noto Sans KR", sans-serif';
      c.fillText('희망과 감동을 주는 학교', 256, 185);
      batch.add(new THREE.PlaneGeometry(3, 1.5), new THREE.MeshStandardMaterial({ map: TX.toTex(emC), roughness: 0.6 }), new THREE.Matrix4().makeTranslation(cx + 1.5, 2.2, M.z0 + 0.32), false, false);
      // 게시판 (서쪽 벽면, 로비 쪽)
      anchors.boards.push({ x: r.x0 + 0.2, z: -40.5, ry: Math.PI / 2, id: 'lobbyBoard' });
      // 트로피 진열장
      batch.box(new THREE.MeshStandardMaterial({ color: 0x5b3d26, roughness: 0.6 }), r.x1 - 0.5, 1.0, M.z0 + 3, 0.8, 2.0, 3);
      addBox(r.x1 - 0.9, r.x1 - 0.1, M.z0 + 1.5, M.z0 + 4.5, 0, 2.0);
    }
  }

  return anchors;
}

function buildDesk(batch, wood, metal, chair, x, z) {
  batch.box(wood, x, 0.72, z, 0.65, 0.04, 0.48);
  for (const [dx, dz] of [[-0.29, -0.2], [0.29, -0.2], [-0.29, 0.2], [0.29, 0.2]]) batch.box(metal, x + dx, 0.36, z + dz, 0.03, 0.72, 0.03, 0, false, false);
  batch.box(metal, x, 0.62, z, 0.6, 0.12, 0.42, 0, false, false);
  // 의자(책상 동쪽, 칠판을 바라봄)
  const cx = x + 0.55;
  batch.box(chair, cx, 0.44, z, 0.4, 0.04, 0.4);
  batch.box(chair, cx + 0.2, 0.72, z, 0.04, 0.4, 0.38);
  batch.box(metal, cx, 0.22, z, 0.36, 0.44, 0.03, 0, false, false);
  addBox(x - 0.33, x + 0.33, z - 0.25, z + 0.25, 0, 0.76);
  addBox(cx - 0.2, cx + 0.22, z - 0.2, z + 0.2, 0, 0.47);
}
