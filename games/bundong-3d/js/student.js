import * as THREE from 'three';

// 교복 입은 학생(남/여). 캐릭터 선택 미리보기와 1인칭 그림자에 사용
const NAVY = 0x1e2a45, SKIN = 0xe9c3a3, SHIRT = 0xf4f4f0, HAIR = 0x1a1412;

export function buildStudent(gender) {
  const g = new THREE.Group();
  const navy = new THREE.MeshStandardMaterial({ color: NAVY, roughness: 0.7 });
  const skin = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.6 });
  const shirt = new THREE.MeshStandardMaterial({ color: SHIRT, roughness: 0.7 });
  const hair = new THREE.MeshStandardMaterial({ color: HAIR, roughness: 0.5 });
  const shoe = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 });
  const grey = new THREE.MeshStandardMaterial({ color: 0x4a4f5c, roughness: 0.8 });
  const plaid = new THREE.MeshStandardMaterial({ color: 0x31405e, roughness: 0.8 });
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
    m.castShadow = true;
    g.add(m);
    return m;
  };
  const female = gender === 'female';
  // 다리
  if (female) {
    add(new THREE.CylinderGeometry(0.17, 0.27, 0.42, 14), plaid, 0, 0.86, 0);
    for (const s of [-1, 1]) {
      add(new THREE.CylinderGeometry(0.052, 0.045, 0.62, 8), skin, s * 0.09, 0.36, 0);
      add(new THREE.BoxGeometry(0.1, 0.06, 0.22), shoe, s * 0.09, 0.03, 0.03);
    }
  } else {
    for (const s of [-1, 1]) {
      add(new THREE.CylinderGeometry(0.075, 0.065, 0.86, 8), grey, s * 0.1, 0.47, 0);
      add(new THREE.BoxGeometry(0.11, 0.07, 0.25), shoe, s * 0.1, 0.035, 0.03);
    }
  }
  // 몸통(블레이저)
  add(new THREE.CylinderGeometry(0.2, 0.18, 0.56, 12), navy, 0, 1.33, 0);
  add(new THREE.BoxGeometry(0.1, 0.3, 0.02), shirt, 0, 1.45, 0.17);
  if (female) add(new THREE.BoxGeometry(0.12, 0.06, 0.03), new THREE.MeshStandardMaterial({ color: 0xa8243a }), 0, 1.56, 0.19);
  else add(new THREE.BoxGeometry(0.05, 0.26, 0.02), new THREE.MeshStandardMaterial({ color: 0x8c1d2c }), 0, 1.44, 0.185);
  // 팔
  for (const s of [-1, 1]) {
    add(new THREE.CylinderGeometry(0.06, 0.055, 0.56, 8), navy, s * 0.26, 1.3, 0, 0, 0, s * 0.08);
    add(new THREE.SphereGeometry(0.05, 8, 6), skin, s * 0.285, 0.99, 0);
  }
  // 머리
  add(new THREE.CylinderGeometry(0.05, 0.06, 0.08, 8), skin, 0, 1.64, 0);
  const head = add(new THREE.SphereGeometry(0.12, 16, 12), skin, 0, 1.78, 0);
  head.scale.set(1, 1.1, 1);
  if (female) {
    add(new THREE.SphereGeometry(0.13, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.6), hair, 0, 1.8, -0.01);
    add(new THREE.BoxGeometry(0.27, 0.36, 0.1), hair, 0, 1.64, -0.08);
  } else {
    add(new THREE.SphereGeometry(0.126, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), hair, 0, 1.8, -0.005);
  }
  // 눈
  const eye = new THREE.MeshStandardMaterial({ color: 0x111111 });
  for (const s of [-1, 1]) add(new THREE.SphereGeometry(0.014, 6, 4), eye, s * 0.045, 1.79, 0.11);
  return g;
}

// 1인칭 팔(시점 모델)
export function buildArms(gender) {
  const g = new THREE.Group();
  const navy = new THREE.MeshStandardMaterial({ color: NAVY, roughness: 0.75 });
  const skin = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.55 });
  const shirt = new THREE.MeshStandardMaterial({ color: SHIRT, roughness: 0.7 });
  const mkArm = (side) => {
    const arm = new THREE.Group();
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.058, 0.34, 12), navy);
    sleeve.rotation.x = Math.PI / 2;
    sleeve.position.z = 0.19;
    arm.add(sleeve);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.05, 0.04, 12), shirt);
    cuff.rotation.x = Math.PI / 2;
    cuff.position.z = 0.0;
    arm.add(cuff);
    if (gender === 'female' && side > 0) {
      const tie = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 6, 14), new THREE.MeshStandardMaterial({ color: 0xc23a52, roughness: 0.8 }));
      tie.position.z = -0.03;
      arm.add(tie);
    }
    if (gender === 'male') {
      for (const k of [0.05, 0.08]) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 4), new THREE.MeshStandardMaterial({ color: 0xd4b25a, metalness: 0.8, roughness: 0.3 }));
        b.position.set(side * 0.045, -0.03, k);
        arm.add(b);
      }
    }
    const hand = new THREE.Group();
    hand.position.z = -0.07;
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.035, 0.09), skin);
    hand.add(palm);
    for (let i = 0; i < 4; i++) {
      const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.009, 0.045, 3, 6), skin);
      f.rotation.x = Math.PI / 2 + 0.9;
      f.position.set(-0.027 + i * 0.018, -0.02, -0.055);
      hand.add(f);
    }
    const th = new THREE.Mesh(new THREE.CapsuleGeometry(0.01, 0.04, 3, 6), skin);
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

// 기본 초상화(사진이 없을 때) — SVG 그림
export function defaultPortrait(gender) {
  const f = gender === 'female';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a6cc8"/><stop offset="1" stop-color="#9cc4ee"/></linearGradient></defs>
  <rect width="300" height="400" fill="url(#bg)"/>
  <rect y="300" width="300" height="100" fill="#3f8c3a"/>
  <path d="M60 400 Q70 290 150 280 Q230 290 240 400Z" fill="#1e2a45"/>
  <path d="M130 285 L150 330 L170 285Z" fill="#f4f4f0"/>
  ${f ? '<path d="M138 300 L162 300 L150 316Z" fill="#a8243a"/>' : '<path d="M146 300 L154 300 L156 345 L150 352 L144 345Z" fill="#8c1d2c"/>'}
  <rect x="135" y="240" width="30" height="45" fill="#e9c3a3"/>
  ${f ? '<path d="M88 180 Q90 95 150 92 Q210 95 212 180 L215 290 L85 290Z" fill="#1a1412"/>' : ''}
  <ellipse cx="150" cy="185" rx="55" ry="66" fill="#e9c3a3"/>
  ${f ? '<path d="M95 170 Q100 110 150 108 Q200 110 205 170 Q180 135 150 138 Q115 135 95 170Z" fill="#1a1412"/>' : '<path d="M94 175 Q92 112 150 108 Q208 112 206 175 Q196 140 150 140 Q104 140 94 175Z" fill="#1a1412"/>'}
  <circle cx="128" cy="188" r="6" fill="#222"/><circle cx="172" cy="188" r="6" fill="#222"/>
  <path d="M135 222 Q150 232 165 222" stroke="#a5534a" stroke-width="4" fill="none" stroke-linecap="round"/>
  <text x="150" y="385" font-size="22" text-anchor="middle" fill="#fff" font-family="sans-serif" font-weight="700">${f ? '여학생' : '남학생'}</text>
  </svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
