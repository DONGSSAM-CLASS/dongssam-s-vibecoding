import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

// Meshy AI 등으로 만든 학생 3D 모델(GLB) 불러오기
// assets/players/models.json 예:
//   { "male": { "model": "male.glb", "walk": "male_walk.glb", "height": 1.72, "rotY": 0 } }
// 목록이 없거나 불러오기에 실패하면 코드로 만든 학생 모델을 그대로 씀
export async function loadStudentModels() {
  const out = {};
  if (location.protocol === 'file:') return out;
  let man;
  try {
    const res = await fetch('assets/players/models.json', { cache: 'no-store' });
    if (!res.ok) return out;
    man = await res.json();
  } catch (e) { return out; }
  const loader = new GLTFLoader();
  for (const g of ['male', 'female']) {
    const m = man[g];
    if (!m || !m.model) continue;
    try {
      const gltf = await loader.loadAsync('assets/players/' + m.model);
      const clips = [...gltf.animations];
      if (m.walk) {
        try { clips.push(...(await loader.loadAsync('assets/players/' + m.walk)).animations.map((c) => { c.name = 'walk'; return c; })); } catch (e) { /* 걷기 없음 */ }
      }
      out[g] = { scene: gltf.scene, clips, height: m.height || (g === 'male' ? 1.72 : 1.64), rotY: m.rotY || 0 };
    } catch (e) { console.warn('학생 모델 불러오기 실패', g, e); }
  }
  return out;
}

// 키를 맞추고 발을 땅에 붙인 복제본 + 애니메이션 믹서
export function instanceStudent(src) {
  const inner = SkeletonUtils.clone(src.scene);
  inner.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      o.frustumCulled = false;
    }
  });
  inner.rotation.y = src.rotY;
  inner.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(inner);
  const h = box.max.y - box.min.y || 1;
  const s = src.height / h;
  inner.scale.multiplyScalar(s);
  inner.position.y = -box.min.y * s;
  const root = new THREE.Group();
  root.add(inner);
  const mixer = new THREE.AnimationMixer(inner);
  const walkClip = src.clips.find((c) => /walk/i.test(c.name)) || src.clips[0];
  const walk = walkClip ? mixer.clipAction(walkClip) : null;
  root.userData.meshy = { mixer, walk };
  return root;
}

// 걷기 동작 재생(amt 0이면 멈춰 서 있음)
export function animateMeshyStudent(root, dt, amt) {
  const m = root.userData.meshy;
  if (!m) return;
  if (m.walk) {
    if (amt > 0.05) {
      if (!m.walk.isRunning()) m.walk.play();
      m.walk.timeScale = 0.6 + amt * 0.8;
    } else if (m.walk.isRunning()) m.walk.stop();
  }
  m.mixer.update(dt);
}
