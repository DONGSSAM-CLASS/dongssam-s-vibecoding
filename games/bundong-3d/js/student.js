import * as THREE from 'three';
import { PHOTOS } from './photos.js';

// 번동중 교복을 입은 학생(선생님이 주신 사진 기준)
//  남학생: 남색 V넥 니트 조끼(회색 줄), 흰 긴소매 셔츠, 회색 바지, 검정 운동화
//  여학생: 남색 V넥 니트 조끼, 흰 셔츠(소매를 접어 체크 안감이 보임), 빨강·남색 체크 치마, 흰 양말, 검정 로퍼
// 1인칭 그림자·내려다본 다리, 친구 NPC, 1인칭 팔에 쓰임

const C = {
  male: { skin: 0xe0b19c, hair: 0x2a2423, vest: 0x262940, pants: 0x6b6a70, shoe: 0x2b2a2e, height: 1.72 },
  female: { skin: 0xdcae9c, hair: 0x1c1718, vest: 0x181a2c, shoe: 0x1e1d22, sock: 0xf1f0f4, height: 1.64 },
};
const SHIRT = 0xf6f5f8;

const texCache = {};
function canvasTex(key, w, h, draw, repeat) {
  if (texCache[key]) return texCache[key];
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  texCache[key] = t;
  return t;
}

// 빨강·남색 타탄 체크(치마, 접은 소매 안감)
function tartan() {
  return canvasTex('tartan', 256, 256, (x, w, h) => {
    x.fillStyle = '#9b1f2a'; x.fillRect(0, 0, w, h);
    const band = (pos, size, col, a) => {
      x.globalAlpha = a; x.fillStyle = col;
      x.fillRect(pos, 0, size, h); x.fillRect(0, pos, w, size);
    };
    band(0, 64, '#1d2a55', 0.85); band(128, 64, '#1d2a55', 0.85);
    band(80, 10, '#0d1530', 0.9); band(208, 10, '#0d1530', 0.9);
    band(100, 3, '#e8e2d8', 0.8); band(228, 3, '#e8e2d8', 0.8);
    band(40, 4, '#c8323e', 0.9); band(168, 4, '#c8323e', 0.9);
    x.globalAlpha = 0.18;
    for (let i = 0; i < h; i += 3) { x.fillStyle = i % 6 ? '#000' : '#fff'; x.fillRect(0, i, w, 1); }
    x.globalAlpha = 1;
  }, [3, 2]);
}

// 남색 니트 조끼: 골지 무늬, V넥(안쪽 흰 셔츠), 회색 줄(남학생), 명찰·교표
function vestTexture(gender, name) {
  const key = 'vest_' + gender + '_' + name;
  return canvasTex(key, 512, 256, (x, w, h) => {
    const col = gender === 'female' ? '#181a2c' : '#262940';
    x.fillStyle = col; x.fillRect(0, 0, w, h);
    // 니트 골
    x.globalAlpha = 0.25;
    for (let i = 0; i < w; i += 4) { x.fillStyle = (i / 4) % 2 ? '#000' : '#4a4e70'; x.fillRect(i, 0, 2, h); }
    x.globalAlpha = 1;
    // 아랫단 고무뜨개
    x.fillStyle = 'rgba(0,0,0,0.25)';
    for (let i = 0; i < w; i += 6) x.fillRect(i, h - 26, 3, 26);
    // 앞판 가운데(u=0.5)에 V넥: 위쪽이 텍스처 위(v=1)
    const cx = w * 0.5, top = 0, depth = h * 0.5, half = w * 0.085;
    x.fillStyle = '#f2f1f5';
    x.beginPath(); x.moveTo(cx - half, top); x.lineTo(cx + half, top); x.lineTo(cx, depth); x.closePath(); x.fill();
    // 셔츠 단추 자리
    x.fillStyle = '#d8d7de'; x.fillRect(cx - 1, top, 2, depth - 10);
    // V넥 테두리(남학생은 회색 두 줄)
    const edge = (off, color, wid) => {
      x.strokeStyle = color; x.lineWidth = wid;
      x.beginPath(); x.moveTo(cx - half - off, top); x.lineTo(cx, depth + off * 1.6); x.lineTo(cx + half + off, top); x.stroke();
    };
    edge(5, col, 9);
    if (gender === 'male') { edge(9, '#9b9ca6', 3); edge(14, '#9b9ca6', 3); }
    // 명찰(초록) + 교표 — 학생 왼쪽 가슴(텍스처에선 앞판 오른쪽)
    const tx = cx + w * 0.06, ty = h * 0.32;
    x.fillStyle = '#0f7a3c'; x.fillRect(tx, ty, 62, 20);
    x.strokeStyle = '#e9f4ec'; x.lineWidth = 1.5; x.strokeRect(tx + 2, ty + 2, 58, 16);
    x.fillStyle = '#fff'; x.font = '700 13px "Noto Sans KR", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText((name || '김번동').slice(0, 4), tx + 31, ty + 11);
    x.fillStyle = '#1d3f8f'; x.beginPath(); x.arc(tx + 31, ty + 44, 14, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#fff'; x.beginPath(); x.arc(tx + 31, ty + 44, 9, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#3aa05a'; x.beginPath(); x.ellipse(tx + 31, ty + 43, 6, 3, -0.5, 0, Math.PI * 2); x.fill();
  });
}

function trouserTex() {
  return canvasTex('trouser', 128, 128, (x, w, h) => {
    x.fillStyle = '#6b6a70'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 1500; i++) { x.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'; x.fillRect(Math.random() * w, Math.random() * h, 2, 1); }
    // 다림 주름(앞쪽 u=0.5)
    x.fillStyle = 'rgba(255,255,255,0.12)'; x.fillRect(w * 0.5 - 1, 0, 2, h);
  }, [1, 1]);
}

const mat = (color, rough = 0.7, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });

// 모든 부위는 관절(그룹) 아래 달아서 걷기 동작을 줌
export function buildStudent(gender, opts = {}) {
  const P = C[gender] || C.male;
  const female = gender === 'female';
  const k = P.height / 1.72; // 키 비율
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.scale.setScalar(k);
  root.add(body);
  const skin = mat(P.skin, 0.55);
  const shirt = mat(SHIRT, 0.75);
  const hairM = mat(P.hair, 0.45, { side: THREE.DoubleSide });
  const shoeM = mat(P.shoe, 0.35);
  const parts = { head: [], arms: [] }; // head: 1인칭 카메라에서 숨길 윗몸(머리·조끼·어깨)
  const mesh = (geo, m, parent, x = 0, y = 0, z = 0, tag) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    o.castShadow = true;
    o.receiveShadow = true;
    parent.add(o);
    if (tag) parts[tag].push(o);
    return o;
  };

  // ---- 다리 ----
  const hipY = 0.93;
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(s * 0.095, hipY, 0);
    body.add(hip);
    const knee = new THREE.Group();
    knee.position.y = -0.45;
    hip.add(knee);
    if (female) {
      mesh(new THREE.CapsuleGeometry(0.066, 0.34, 4, 12), skin, hip, 0, -0.22, 0);
      mesh(new THREE.CapsuleGeometry(0.052, 0.34, 4, 12), skin, knee, 0, -0.2, -0.005);
      // 흰 양말(종아리 중간까지)
      mesh(new THREE.CylinderGeometry(0.052, 0.046, 0.2, 14), mat(P.sock, 0.9), knee, 0, -0.33, -0.005);
      // 검정 로퍼
      const shoe = mesh(new THREE.BoxGeometry(0.09, 0.07, 0.24), shoeM, knee, 0, -0.44, 0.04);
      shoe.geometry.translate(0, 0, 0);
      mesh(new THREE.BoxGeometry(0.07, 0.012, 0.05), mat(0x111111, 0.3), knee, 0, -0.4, 0.12);
    } else {
      const tm = new THREE.MeshStandardMaterial({ map: trouserTex(), roughness: 0.85 });
      mesh(new THREE.CylinderGeometry(0.085, 0.07, 0.48, 16), tm, hip, 0, -0.22, 0);
      mesh(new THREE.CylinderGeometry(0.07, 0.066, 0.46, 16), tm, knee, 0, -0.22, 0);
      // 검정 운동화(흰 밑창 끈)
      mesh(new THREE.BoxGeometry(0.1, 0.075, 0.27), shoeM, knee, 0, -0.44, 0.045);
      mesh(new THREE.BoxGeometry(0.105, 0.025, 0.28), mat(0x3a383c, 0.6), knee, 0, -0.475, 0.045);
    }
    legs.push({ hip, knee });
  }

  // ---- 허리·몸통 ----
  const torso = new THREE.Group();
  torso.position.y = hipY;
  body.add(torso);
  if (female) {
    // 주름 체크 치마
    const sk = new THREE.CylinderGeometry(0.175, 0.255, 0.4, 32, 1, true);
    const p = sk.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const a = Math.atan2(p.getZ(i), p.getX(i));
      const f = 1 + Math.max(0, Math.sin(a * 16)) * 0.035 * ((0.2 - p.getY(i)) / 0.4);
      p.setX(i, p.getX(i) * f); p.setZ(i, p.getZ(i) * f);
    }
    sk.computeVertexNormals();
    const skirt = mesh(sk, new THREE.MeshStandardMaterial({ map: tartan(), roughness: 0.8, side: THREE.DoubleSide }), torso, 0, -0.1, 0);
    skirt.scale.z = 0.8;
    mesh(new THREE.CylinderGeometry(0.16, 0.175, 0.06, 24), mat(0x2a1d2a, 0.8), torso, 0, 0.1, 0, 'head').scale.z = 0.8;
  } else {
    const tm = new THREE.MeshStandardMaterial({ map: trouserTex(), roughness: 0.85 });
    const pelvis = mesh(new THREE.CylinderGeometry(0.165, 0.18, 0.2, 20, 1, true), tm, torso, 0, 0.0, 0);
    pelvis.scale.z = 0.72;
    mesh(new THREE.CylinderGeometry(0.168, 0.168, 0.035, 20), mat(0x1c1c1e, 0.4), torso, 0, 0.1, 0, 'head').scale.z = 0.73;
  }
  // 셔츠 아랫단 살짝
  const shirtHem = mesh(new THREE.CylinderGeometry(0.165, 0.168, 0.05, 24), shirt, torso, 0, 0.13, 0, 'head');
  shirtHem.scale.z = 0.72;
  // 니트 조끼(가슴은 넓고 허리는 좁게)
  const vestGeo = new THREE.CylinderGeometry(0.19, 0.165, 0.44, 32, 4, false, Math.PI, Math.PI * 2);
  const vp = vestGeo.attributes.position;
  for (let i = 0; i < vp.count; i++) {
    const y = vp.getY(i);
    const chest = y > 0.05 ? 1 + Math.sin(((y - 0.05) / 0.17) * Math.PI * 0.5) * 0.05 : 1;
    vp.setX(i, vp.getX(i) * chest);
  }
  vestGeo.computeVertexNormals();
  const vest = mesh(vestGeo, new THREE.MeshStandardMaterial({ map: vestTexture(gender, opts.name), roughness: 0.92 }), torso, 0, 0.37, 0, 'head');
  vest.scale.z = 0.68;
  // 어깨(셔츠)
  const sh = mesh(new THREE.SphereGeometry(0.2, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), shirt, torso, 0, 0.58, 0, 'head');
  sh.scale.set(1.08, 0.38, 0.66);
  // 셔츠 깃
  for (const s of [-1, 1]) {
    const col = mesh(new THREE.BoxGeometry(0.075, 0.012, 0.06), shirt, torso, s * 0.04, 0.62, 0.075, 'head');
    col.rotation.set(-0.5, s * 0.5, s * 0.35);
  }

  // ---- 팔(흰 셔츠 소매) ----
  const arms = [];
  for (const s of [-1, 1]) {
    const sh2 = new THREE.Group();
    sh2.position.set(s * 0.215, 0.58, 0);
    torso.add(sh2);
    const elbow = new THREE.Group();
    elbow.position.y = -0.29;
    sh2.add(elbow);
    mesh(new THREE.CapsuleGeometry(0.052, 0.21, 4, 12), shirt, sh2, 0, -0.14, 0, 'arms');
    if (female) {
      // 접어 올린 소매: 체크 안감 띠 + 맨팔
      mesh(new THREE.CylinderGeometry(0.056, 0.058, 0.06, 14), new THREE.MeshStandardMaterial({ map: tartan(), roughness: 0.8 }), elbow, 0, -0.04, 0, 'arms');
      mesh(new THREE.CapsuleGeometry(0.038, 0.17, 4, 10), skin, elbow, 0, -0.15, 0, 'arms');
      if (s < 0) for (const dy of [-0.235, -0.25]) {
        const b = mesh(new THREE.TorusGeometry(0.036, 0.0025, 4, 16), mat(0xd9d4cf, 0.25, { metalness: 0.8 }), elbow, 0, dy, 0, 'arms');
        b.rotation.x = Math.PI / 2;
      }
    } else {
      mesh(new THREE.CapsuleGeometry(0.046, 0.2, 4, 12), shirt, elbow, 0, -0.13, 0, 'arms');
    }
    const hand = mesh(new THREE.SphereGeometry(0.045, 12, 8), skin, elbow, 0, -0.29, 0.005, 'arms');
    hand.scale.set(0.75, 1.25, 0.55);
    sh2.rotation.z = s * 0.06;
    arms.push({ sh: sh2, elbow });
  }

  // ---- 목·머리 ----
  const neck = mesh(new THREE.CylinderGeometry(0.048, 0.055, 0.1, 12), skin, torso, 0, 0.66, 0.0, 'head');
  void neck;
  const headG = new THREE.Group();
  headG.position.y = 0.8;
  torso.add(headG);
  const head = mesh(new THREE.SphereGeometry(0.1, 24, 18), skin, headG, 0, 0, 0.005, 'head');
  head.scale.set(0.92, 1.16, 1.0);
  const chin = mesh(new THREE.SphereGeometry(0.06, 16, 10), skin, headG, 0, -0.07, 0.03, 'head');
  chin.scale.set(1.0, 0.8, 1.0);
  for (const s of [-1, 1]) {
    mesh(new THREE.SphereGeometry(0.018, 8, 6), skin, headG, s * 0.093, 0.0, 0.0, 'head').scale.set(0.5, 1, 0.8);
    const eye = mesh(new THREE.SphereGeometry(0.011, 10, 8), mat(0x161112, 0.2), headG, s * 0.037, 0.012, 0.094, 'head');
    eye.scale.set(1.2, 0.7, 0.6);
    mesh(new THREE.BoxGeometry(0.03, 0.006, 0.008), mat(P.hair, 0.6), headG, s * 0.037, 0.04, 0.097, 'head').rotation.z = s * -0.08;
  }
  mesh(new THREE.BoxGeometry(0.03, 0.006, 0.006), mat(0xb0605a, 0.5), headG, 0, -0.058, 0.095, 'head');
  // 머리카락
  const cap = mesh(new THREE.SphereGeometry(0.108, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), hairM, headG, 0, 0.012, -0.003, 'head');
  cap.scale.set(0.98, 1.18, 1.06);
  if (female) {
    // 어깨까지 내려오는 생머리 + 가운데 가르마
    const long = new THREE.CylinderGeometry(0.105, 0.13, 0.32, 24, 1, true, Math.PI * 0.62, Math.PI * 1.76);
    mesh(long, hairM, headG, 0, -0.12, -0.005, 'head').scale.z = 0.95;
    for (const s of [-1, 1]) {
      const side = mesh(new THREE.BoxGeometry(0.03, 0.27, 0.07), hairM, headG, s * 0.098, -0.09, 0.045, 'head');
      side.rotation.z = s * 0.06;
    }
  } else {
    // 짧은 머리 + 앞머리
    const fringe = mesh(new THREE.SphereGeometry(0.106, 20, 8, -Math.PI * 0.35, Math.PI * 0.7, Math.PI * 0.25, Math.PI * 0.22), hairM, headG, 0, 0.012, 0.012, 'head');
    fringe.scale.set(1.0, 1.18, 1.05);
    for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(0.02, 0.07, 0.06), hairM, headG, s * 0.098, 0.03, 0.0, 'head');
  }

  root.userData = { legs, arms, torso, headG, parts, female };
  return root;
}

// 걷기 동작: phase(걸음 진행), amt(0~1 걷는 세기)
export function animateStudent(model, phase, amt, crouch = 0) {
  const u = model.userData;
  if (!u.legs) return;
  const sw = Math.sin(phase) * 0.55 * amt;
  u.legs[0].hip.rotation.x = sw - crouch * 0.9;
  u.legs[1].hip.rotation.x = -sw - crouch * 0.9;
  u.legs[0].knee.rotation.x = Math.max(0, -Math.sin(phase - 0.6)) * 0.7 * amt + crouch * 1.5;
  u.legs[1].knee.rotation.x = Math.max(0, Math.sin(phase - 0.6)) * 0.7 * amt + crouch * 1.5;
  u.arms[0].sh.rotation.x = -sw * 0.6;
  u.arms[1].sh.rotation.x = sw * 0.6;
  u.arms[0].elbow.rotation.x = -0.15 - amt * 0.2;
  u.arms[1].elbow.rotation.x = -0.15 - amt * 0.2;
  u.torso.position.y = 0.93 - Math.abs(Math.cos(phase)) * 0.025 * amt - crouch * 0.35;
  u.torso.rotation.x = crouch * 0.25;
}

// 1인칭 팔(시점 모델): 흰 셔츠 소매. 여학생은 소매를 접어 체크 안감과 팔목 팔찌가 보임
export function buildArms(gender) {
  const P = C[gender] || C.male;
  const female = gender === 'female';
  const g = new THREE.Group();
  const skin = mat(P.skin, 0.5);
  const shirt = mat(SHIRT, 0.72);
  const mkArm = (side) => {
    const arm = new THREE.Group();
    const along = (geo) => { geo.rotateX(Math.PI / 2); return geo; };
    if (female) {
      // 맨팔(손목~접힌 소매) + 체크 안감 띠 + 흰 소매
      const fore = new THREE.Mesh(along(new THREE.CylinderGeometry(0.034, 0.042, 0.2, 14)), skin);
      fore.position.z = 0.1;
      arm.add(fore);
      const cuff = new THREE.Mesh(along(new THREE.CylinderGeometry(0.056, 0.054, 0.055, 16)), new THREE.MeshStandardMaterial({ map: tartan(), roughness: 0.8 }));
      cuff.position.z = 0.225;
      arm.add(cuff);
      const sleeve = new THREE.Mesh(along(new THREE.CylinderGeometry(0.056, 0.06, 0.14, 16)), shirt);
      sleeve.position.z = 0.32;
      arm.add(sleeve);
      if (side < 0) for (const z of [0.02, 0.035]) {
        const b = new THREE.Mesh(new THREE.TorusGeometry(0.037, 0.0022, 6, 20), mat(0xdedad5, 0.2, { metalness: 0.9 }));
        b.position.z = z;
        arm.add(b);
      }
    } else {
      const sleeve = new THREE.Mesh(along(new THREE.CylinderGeometry(0.048, 0.056, 0.32, 16)), shirt);
      sleeve.position.z = 0.19;
      arm.add(sleeve);
      const cuff = new THREE.Mesh(along(new THREE.CylinderGeometry(0.046, 0.047, 0.05, 16)), shirt);
      cuff.position.z = 0.01;
      arm.add(cuff);
      const button = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 4), mat(0xe8e8ea, 0.3));
      button.position.set(side * 0.045, -0.01, 0.015);
      arm.add(button);
      // 셔츠 주름
      for (const z of [0.12, 0.2, 0.27]) {
        const r = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.004, 4, 16), shirt);
        r.position.z = z;
        arm.add(r);
      }
    }
    const hand = new THREE.Group();
    hand.position.z = -0.07;
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.032, 0.088), skin);
    hand.add(palm);
    const back = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), skin);
    back.scale.set(0.95, 0.4, 1.15);
    back.position.y = 0.005;
    hand.add(back);
    const wrist = new THREE.Mesh(along(new THREE.CylinderGeometry(0.03, 0.034, 0.06, 12)), skin);
    wrist.position.z = 0.05;
    hand.add(wrist);
    for (let i = 0; i < 4; i++) {
      const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.0085, 0.042 - Math.abs(i - 1.5) * 0.004, 3, 8), skin);
      f.rotation.x = Math.PI / 2 + 0.9;
      f.position.set(-0.026 + i * 0.0175, -0.02, -0.054);
      hand.add(f);
    }
    const th = new THREE.Mesh(new THREE.CapsuleGeometry(0.0095, 0.038, 3, 8), skin);
    th.position.set(-side * 0.04, 0.0, -0.03);
    th.rotation.set(Math.PI / 2, 0, side * 0.7);
    hand.add(th);
    arm.add(hand);
    arm.userData.hand = hand;
    return arm;
  };
  const right = mkArm(1);
  right.position.set(0.19, -0.16, -0.42);
  right.rotation.set(0.1, 0.1, 0);
  const left = mkArm(-1);
  left.position.set(-0.3, -0.3, -0.4);
  left.rotation.set(0.25, -0.2, 0);
  g.add(right, left);
  g.userData.right = right;
  g.userData.left = left;
  return g;
}

// 기본 초상화: 선생님이 주신 학생 사진
export function defaultPortrait(gender, kind = 'face') {
  const p = PHOTOS[gender] || PHOTOS.male;
  return p[kind];
}
