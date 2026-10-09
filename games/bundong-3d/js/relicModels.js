import * as THREE from 'three';
import { makeCanvas, toTex } from './textures.js';
import { mulberry32, tfbm } from './util.js';

// 실제 유물의 생김새를 참고해 절차적으로 만든 3D 모델
// (assets/relics/manifest.json 에 GLB가 등록되면 그 모델로 교체됨 — Meshy AI 등으로 만든 모델용)

const gold = () => new THREE.MeshStandardMaterial({ color: 0xd2a94e, metalness: 1, roughness: 0.3 });

// ---------- 사인참사검 ----------
function swordBladeTexture() {
  const W = 128, H = 1024;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, '#8e959c'); g.addColorStop(0.5, '#e4e8ec'); g.addColorStop(1, '#8e959c');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // 금 상감 별자리(북두칠성 등 28수) — 점과 선
  const rnd = mulberry32(4);
  ctx.strokeStyle = '#e2b84a'; ctx.fillStyle = '#f2cf6a'; ctx.lineWidth = 2.2;
  let y = 60;
  while (y < H * 0.62) {
    const n = 3 + Math.floor(rnd() * 5);
    const pts = [];
    for (let i = 0; i < n; i++) pts.push([W * (0.3 + rnd() * 0.4), y + i * (10 + rnd() * 14)]);
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
    pts.forEach((p) => { ctx.beginPath(); ctx.arc(p[0], p[1], 4, 0, Math.PI * 2); ctx.fill(); });
    y += n * 18 + 30;
  }
  // 주문 글자(세로)
  ctx.font = '900 28px "Noto Serif KR", serif';
  ctx.textAlign = 'center';
  const txt = '四寅斬邪乾降精坤援靈';
  for (let i = 0; i < txt.length; i++) ctx.fillText(txt[i], W / 2, H * 0.66 + i * 34);
  return c;
}

export function buildSword() {
  const grp = new THREE.Group();
  const L = 0.82, w = 0.034, t = 0.009;
  // 마름모 단면 칼날
  const rings = [[0, 1], [L - 0.07, 1], [L - 0.025, 0.45]];
  const pos = [], uv = [];
  const ring = (y, s) => [[w / 2 * s, y, 0], [0, y, t / 2 * s], [-w / 2 * s, y, 0], [0, y, -t / 2 * s]];
  const tip = [0, L, 0];
  const pushTri = (a, b, c, ua, ub, uc) => { pos.push(...a, ...b, ...c); uv.push(...ua, ...ub, ...uc); };
  for (let r = 0; r < rings.length - 1; r++) {
    const A = ring(rings[r][0], rings[r][1]), B = ring(rings[r + 1][0], rings[r + 1][1]);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      const u0 = i / 4, u1 = (i + 1) / 4, v0 = rings[r][0] / L, v1 = rings[r + 1][0] / L;
      pushTri(A[i], B[i], B[j], [u0, v0], [u0, v1], [u1, v1]);
      pushTri(A[i], B[j], A[j], [u0, v0], [u1, v1], [u1, v0]);
    }
  }
  const last = ring(rings[2][0], rings[2][1]);
  for (let i = 0; i < 4; i++) pushTri(last[i], tip, last[(i + 1) % 4], [i / 4, 0.97], [i / 4 + 0.125, 1], [(i + 1) / 4, 0.97]);
  const bg = new THREE.BufferGeometry();
  bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  bg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  bg.computeVertexNormals();
  const bladeTex = toTex(swordBladeTexture());
  const bladeMat = new THREE.MeshStandardMaterial({ map: bladeTex, metalness: 0.9, roughness: 0.32, color: 0xe8e2d8, emissive: 0xffd27a, emissiveMap: bladeTex, emissiveIntensity: 0 });
  const blade = new THREE.Mesh(bg, bladeMat);
  grp.add(blade);
  grp.userData.glowMat = bladeMat;
  // 코등이
  const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.012, 20), gold());
  guard.scale.set(1.25, 1, 0.8);
  grp.add(guard);
  // 손잡이(감은 끈)
  const hc = makeCanvas(64, 256);
  const hx = hc.getContext('2d');
  hx.fillStyle = '#2a1712'; hx.fillRect(0, 0, 64, 256);
  hx.strokeStyle = '#6b3a22'; hx.lineWidth = 5;
  for (let y = -64; y < 320; y += 18) { hx.beginPath(); hx.moveTo(0, y); hx.lineTo(64, y + 32); hx.moveTo(64, y); hx.lineTo(0, y + 32); hx.stroke(); }
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.017, 0.19, 12), new THREE.MeshStandardMaterial({ map: toTex(hc), roughness: 0.8 }));
  handle.position.y = -0.1;
  grp.add(handle);
  for (const y of [-0.01, -0.19]) {
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.02, 12), gold());
    f.position.y = y;
    grp.add(f);
  }
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 8), gold());
  pommel.position.y = -0.21;
  pommel.scale.y = 0.6;
  grp.add(pommel);
  // 술(장식 끈)
  const tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.012, 0.09, 6), new THREE.MeshStandardMaterial({ color: 0xa61e2a, roughness: 0.9 }));
  tassel.position.set(0, -0.26, 0);
  grp.add(tassel);
  return grp;
}

// ---------- 다뉴세문경 ----------
function mirrorTexture() {
  const S = 1024;
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#566a4c'; ctx.fillRect(0, 0, S, S);
  const cx = S / 2, cy = S / 2;
  ctx.strokeStyle = '#2f3a28';
  // 동심원 구획
  const zones = [0.1, 0.22, 0.36, 0.46, 0.49];
  ctx.lineWidth = 3;
  for (const z of zones) { ctx.beginPath(); ctx.arc(cx, cy, z * S, 0, Math.PI * 2); ctx.stroke(); }
  // 각 구획의 아주 가는 빗금 삼각 무늬(1만 3천여 개의 선)
  ctx.lineWidth = 1.1;
  for (let zi = 0; zi < zones.length - 1; zi++) {
    const r0 = zones[zi] * S, r1 = zones[zi + 1] * S;
    const n = 24 + zi * 16;
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2;
      const am = (a0 + a1) / 2;
      const up = k % 2 === 0;
      const P = (a, r) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
      const A = P(a0, up ? r0 : r1), B = P(a1, up ? r0 : r1), C = P(am, up ? r1 : r0);
      for (let s = 0; s <= 1; s += 0.08) {
        const x0 = A[0] + (C[0] - A[0]) * s, y0 = A[1] + (C[1] - A[1]) * s;
        const x1 = B[0] + (C[0] - B[0]) * s, y1 = B[1] + (C[1] - B[1]) * s;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      }
    }
  }
  // 바깥 동심원 장식(작은 원들)
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + 0.2;
    for (let r = 8; r < 42; r += 6) { ctx.beginPath(); ctx.arc(cx + Math.cos(a) * S * 0.29, cy + Math.sin(a) * S * 0.29, r, 0, Math.PI * 2); ctx.stroke(); }
  }
  // 녹(초록 녹청)
  const img = ctx.getImageData(0, 0, S, S);
  for (let y = 0; y < S; y += 1) for (let x = 0; x < S; x += 1) {
    const n = tfbm(x / 90, y / 90, 12, 3);
    const i = (y * S + x) * 4;
    if (n > 0.58) { img.data[i] = img.data[i] * 0.7 + 40; img.data[i + 1] = img.data[i + 1] * 0.7 + 70; img.data[i + 2] = img.data[i + 2] * 0.7 + 50; }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export function buildMirror() {
  const grp = new THREE.Group();
  const R = 0.106;
  const tex = toTex(mirrorTexture());
  const back = new THREE.MeshStandardMaterial({ map: tex, bumpMap: tex, bumpScale: 1.2, metalness: 0.75, roughness: 0.5 });
  const front = new THREE.MeshStandardMaterial({ color: 0x9a8f6a, metalness: 1, roughness: 0.12 });
  const rim = new THREE.MeshStandardMaterial({ color: 0x6c7656, metalness: 0.8, roughness: 0.45 });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.008, 64), [rim, back, front]);
  disc.rotation.x = Math.PI / 2;
  grp.add(disc);
  const torus = new THREE.Mesh(new THREE.TorusGeometry(R, 0.006, 8, 64), rim);
  torus.position.z = 0.002;
  grp.add(torus);
  // 꼭지 두 개(다뉴)
  for (const s of [-1, 1]) {
    const k = new THREE.Mesh(new THREE.TorusGeometry(0.011, 0.004, 8, 16, Math.PI), rim);
    k.position.set(s * 0.018, -0.005, 0.005);
    k.rotation.set(0, Math.PI / 2, 0);
    k.rotateZ(0);
    grp.add(k);
  }
  grp.userData.front = front;
  return grp;
}

// ---------- 백제 금동대향로 ----------
export function buildCenser() {
  const grp = new THREE.Group();
  const gm = new THREE.MeshStandardMaterial({ color: 0xc9a14a, metalness: 1, roughness: 0.34 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x8d6d2c, metalness: 1, roughness: 0.5 });
  // 받침: 용(몸을 틀고 머리를 들어 연꽃 줄기를 문 모습)
  const dragon = new THREE.Mesh(new THREE.TorusKnotGeometry(0.06, 0.014, 96, 10, 2, 5), dark);
  dragon.scale.set(1, 0.45, 1);
  dragon.position.y = 0.03;
  grp.add(dragon);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.08, 10), dark);
  neck.position.set(0, 0.09, 0);
  grp.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 8), dark);
  head.position.set(0, 0.135, 0.008);
  head.scale.set(1, 0.8, 1.4);
  grp.add(head);
  // 몸체: 연꽃 봉오리 모양 그릇 + 꽃잎 세 줄
  const bodyPts = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12; bodyPts.push(new THREE.Vector2(0.015 + Math.sin(t * Math.PI * 0.5) * 0.075, 0.14 + t * 0.09)); }
  const body = new THREE.Mesh(new THREE.LatheGeometry(bodyPts, 40), gm);
  grp.add(body);
  for (let row = 0; row < 3; row++) {
    const n = 8 + row * 2;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + row * 0.2;
      const r = 0.035 + row * 0.022, y = 0.155 + row * 0.024;
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), gm);
      p.scale.set(0.9, 1.4, 0.35);
      p.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      p.lookAt(Math.cos(a) * r * 3, y + 0.03, Math.sin(a) * r * 3);
      grp.add(p);
    }
  }
  // 뚜껑: 겹겹의 산봉우리(약 74개 봉우리)
  const lidPts = [];
  for (let i = 0; i <= 14; i++) { const t = i / 14; lidPts.push(new THREE.Vector2(Math.cos(t * Math.PI * 0.5) * 0.088 + 0.002, 0.23 + Math.sin(t * Math.PI * 0.5) * 0.12)); }
  const lid = new THREE.Mesh(new THREE.LatheGeometry(lidPts, 40), gm);
  grp.add(lid);
  const rnd = mulberry32(287);
  let peaks = 0;
  for (let row = 0; row < 6; row++) {
    const t = 0.08 + row * 0.15;
    const ang = t * Math.PI * 0.5;
    const r = Math.cos(ang) * 0.088, y = 0.23 + Math.sin(ang) * 0.12;
    const n = Math.max(4, Math.round(16 - row * 2.2));
    for (let k = 0; k < n && peaks < 74; k++, peaks++) {
      const a = (k / n) * Math.PI * 2 + row * 0.37 + rnd() * 0.2;
      const h = 0.026 + rnd() * 0.014;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.014 + rnd() * 0.004, h, 6), rnd() < 0.2 ? dark : gm);
      cone.position.set(Math.cos(a) * r, y + h * 0.3, Math.sin(a) * r);
      cone.lookAt(Math.cos(a) * r * 1.6, y + 0.12, Math.sin(a) * r * 1.6);
      cone.rotateX(Math.PI / 2);
      grp.add(cone);
    }
  }
  // 다섯 악사(작은 인물)
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.005, 0.01, 3, 6), dark);
    m.position.set(Math.cos(a) * 0.035, 0.345, Math.sin(a) * 0.035);
    grp.add(m);
  }
  // 봉황(꼭대기)
  const ph = new THREE.Group();
  ph.position.y = 0.36;
  const pb = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 8), gm);
  pb.scale.set(0.8, 1, 1.3);
  pb.position.y = 0.02;
  ph.add(pb);
  const pn = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.008, 0.04, 8), gm);
  pn.position.set(0, 0.05, 0.015); pn.rotation.x = 0.4;
  ph.add(pn);
  const phd = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 6), gm);
  phd.position.set(0, 0.072, 0.024);
  ph.add(phd);
  for (const s of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 6), gm);
    wing.scale.set(0.25, 0.7, 1);
    wing.position.set(s * 0.02, 0.035, -0.005);
    wing.rotation.set(-0.5, 0, s * 0.5);
    ph.add(wing);
  }
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.06, 8, 1, true), gm);
  tail.position.set(0, 0.04, -0.035); tail.rotation.x = -2.3;
  ph.add(tail);
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), gm);
  orb.position.y = 0.0;
  ph.add(orb);
  grp.add(ph);
  return grp;
}

// ---------- 곡옥(신라 금관의 굽은 옥) ----------
export function buildJade() {
  const grp = new THREE.Group();
  const jade = new THREE.MeshPhysicalMaterial({ color: 0x2f9e6a, roughness: 0.12, metalness: 0, transmission: 0.35, thickness: 0.03, ior: 1.6, clearcoat: 1, clearcoatRoughness: 0.05, emissive: 0x1f7a4a, emissiveIntensity: 0.15 });
  // 머리(둥근 부분)에서 꼬리로 가늘어지는 'C' 모양
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.02, 0), new THREE.Vector3(0.018, 0.012, 0), new THREE.Vector3(0.022, -0.008, 0),
    new THREE.Vector3(0.012, -0.026, 0), new THREE.Vector3(-0.008, -0.034, 0), new THREE.Vector3(-0.022, -0.03, 0),
  ]);
  const segs = 40, radial = 16;
  const frames = curve.computeFrenetFrames(segs, false);
  const pos = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const p = curve.getPointAt(t);
    const r = 0.017 * (1 - t * 0.72) * (t < 0.08 ? Math.sqrt(t / 0.08) * 0.3 + 0.7 : 1);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const n = new THREE.Vector3().addScaledVector(frames.normals[i], Math.cos(a)).addScaledVector(frames.binormals[i], Math.sin(a) * 0.8);
      pos.push(p.x + n.x * r, p.y + n.y * r, p.z + n.z * r);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  grp.add(new THREE.Mesh(g, jade));
  const headBall = new THREE.Mesh(new THREE.SphereGeometry(0.0175, 20, 14), jade);
  headBall.position.set(0, 0.02, 0);
  headBall.scale.set(1, 1, 0.8);
  grp.add(headBall);
  // 금모(머리에 씌운 금 장식)
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.0185, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.42), gold());
  cap.position.set(0, 0.021, 0);
  cap.rotation.z = 0.5;
  grp.add(cap);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.006, 0.0015, 6, 12), gold());
  ring.position.set(-0.008, 0.04, 0);
  grp.add(ring);
  grp.userData.jade = jade;
  return grp;
}

// ---------- 비격진천뢰 ----------
export function buildBomb() {
  const grp = new THREE.Group();
  const c = makeCanvas(256, 128);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(256, 128);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 256; x++) {
    const n = tfbm(x / 20, y / 20, 13, 4);
    const i = (y * 256 + x) * 4;
    const rust = n > 0.55 ? (n - 0.55) * 3 : 0;
    img.data[i] = 58 + rust * 90; img.data[i + 1] = 54 + rust * 40; img.data[i + 2] = 50 + rust * 10; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const iron = new THREE.MeshStandardMaterial({ map: toTex(c), metalness: 0.65, roughness: 0.65 });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.1, 32, 20), iron);
  grp.add(ball);
  const seam = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.006, 6, 40), iron);
  seam.rotation.x = Math.PI / 2;
  grp.add(seam);
  const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.02, 12), iron);
  hole.position.y = 0.098;
  grp.add(hole);
  const fuse = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.1, 0), new THREE.Vector3(0.01, 0.13, 0), new THREE.Vector3(0.03, 0.15, 0.01)]), 8, 0.004, 6), new THREE.MeshStandardMaterial({ color: 0x7a5a32, roughness: 0.9 }));
  grp.add(fuse);
  grp.userData.fuseTip = new THREE.Vector3(0.03, 0.15, 0.01);
  return grp;
}

// ---------- 신기전 ----------
export function buildRocket(scale = 1) {
  const grp = new THREE.Group();
  const bamboo = new THREE.MeshStandardMaterial({ color: 0xb59a5c, roughness: 0.7 });
  const paper = new THREE.MeshStandardMaterial({ color: 0xd8cdb0, roughness: 0.9 });
  const cord = new THREE.MeshStandardMaterial({ color: 0x8a2a20, roughness: 0.8 });
  const L = 1.0 * scale;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.006 * scale, 0.006 * scale, L, 6), bamboo);
  shaft.position.y = L / 2;
  grp.add(shaft);
  // 대나무 마디
  for (let y = 0.12; y < 0.85; y += 0.18) {
    const n = new THREE.Mesh(new THREE.CylinderGeometry(0.0075 * scale, 0.0075 * scale, 0.006 * scale, 6), bamboo);
    n.position.y = y * L;
    grp.add(n);
  }
  // 약통(종이 화약통)
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.016 * scale, 0.016 * scale, 0.16 * scale, 12), paper);
  tube.position.set(0.018 * scale, L * 0.78, 0);
  grp.add(tube);
  for (const y of [0.72, 0.84]) {
    const b = new THREE.Mesh(new THREE.TorusGeometry(0.017 * scale, 0.002 * scale, 4, 12), cord);
    b.position.set(0.018 * scale, L * y, 0);
    b.rotation.x = Math.PI / 2;
    grp.add(b);
  }
  // 촉
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.009 * scale, 0.05 * scale, 6), new THREE.MeshStandardMaterial({ color: 0x4a4a4a, metalness: 0.8, roughness: 0.4 }));
  head.position.y = L + 0.025 * scale;
  grp.add(head);
  // 깃
  for (let k = 0; k < 3; k++) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(0.03 * scale, 0.1 * scale), new THREE.MeshStandardMaterial({ color: 0xe8e2d0, side: THREE.DoubleSide, roughness: 0.9 }));
    f.position.set(Math.cos(k * 2.09) * 0.015 * scale, 0.07 * scale, Math.sin(k * 2.09) * 0.015 * scale);
    f.rotation.y = -k * 2.09;
    grp.add(f);
  }
  return grp;
}

// ---------- 앙부일구 ----------
function sundialTexture() {
  const S = 512;
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#3b3326'; ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = '#e6d9a8'; ctx.lineWidth = 2;
  // 절기선(가로 13줄)과 시각선(세로)
  for (let i = 0; i < 13; i++) { const y = S * (0.25 + i * 0.035); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(S, y); ctx.stroke(); }
  for (let i = 0; i <= 28; i++) { const x = (i / 28) * S; ctx.beginPath(); ctx.moveTo(x, S * 0.25); ctx.lineTo(x, S * 0.67); ctx.stroke(); }
  ctx.fillStyle = '#e6d9a8';
  ctx.font = '700 22px "Noto Serif KR", serif';
  const sh = '卯辰巳午未申酉';
  for (let i = 0; i < sh.length; i++) ctx.fillText(sh[i], (i / sh.length) * S + 26, S * 0.22);
  return c;
}

export function buildSundial() {
  const grp = new THREE.Group();
  const bronze = new THREE.MeshStandardMaterial({ color: 0x5a4a32, metalness: 0.85, roughness: 0.42 });
  const inner = new THREE.MeshStandardMaterial({ map: toTex(sundialTexture()), metalness: 0.5, roughness: 0.5, side: THREE.BackSide });
  const R = 0.12;
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(R, 40, 20, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), bronze);
  grp.add(bowl);
  const bowlIn = new THREE.Mesh(new THREE.SphereGeometry(R * 0.97, 40, 20, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), inner);
  grp.add(bowlIn);
  const rim = new THREE.Mesh(new THREE.RingGeometry(R * 0.97, R * 1.18, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x6a5838, metalness: 0.85, roughness: 0.35, side: THREE.DoubleSide }));
  grp.add(rim);
  // 다리 4개(용 다리 모양)
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    const leg = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(a) * R * 0.75, -R * 0.55, Math.sin(a) * R * 0.75),
      new THREE.Vector3(Math.cos(a) * R * 1.05, -R * 0.9, Math.sin(a) * R * 1.05),
      new THREE.Vector3(Math.cos(a) * R * 1.0, -R * 1.25, Math.sin(a) * R * 1.0)]), 8, 0.009, 6), bronze);
    grp.add(leg);
  }
  // 십자 받침
  for (const r of [0, Math.PI / 2]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(R * 2.2, 0.012, 0.02), bronze);
    bar.position.y = -R * 1.25;
    bar.rotation.y = r + Math.PI / 4;
    grp.add(bar);
  }
  // 영침(그림자 바늘): 북극을 향해 기울어짐(서울 위도 약 37.5°)
  const gn = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, R * 1.05, 6), new THREE.MeshStandardMaterial({ color: 0xd8c27a, metalness: 1, roughness: 0.25 }));
  gn.position.set(0, -R * 0.16, -R * 0.42);
  gn.rotation.x = -(Math.PI / 2 - 0.65);
  grp.add(gn);
  return grp;
}

export const BUILDERS = {
  sword: buildSword, mirror: buildMirror, censer: buildCenser, jade: buildJade,
  bomb: buildBomb, rocket: () => buildRocket(1), sundial: buildSundial,
};
