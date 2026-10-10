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
      let gltf;
      const clips = [];
      if (m.walk) {
        try {
          const walking = await loader.loadAsync('assets/players/' + m.walk);
          if (walking.animations.length) {
            // 동작이 만들어진 뼈대를 함께 사용해 이름·바인딩 불일치를 방지
            gltf = walking;
            clips.length = 0;
            clips.push(...walking.animations.map((c) => { c.name = 'walk'; return c; }));
          }
        } catch (e) { console.warn('학생 걷기 불러오기 실패', g, e); }
      }
      if (!gltf) {
        gltf = await loader.loadAsync('assets/players/' + m.model);
        clips.push(...gltf.animations);
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
      // 사진 질감은 유지하되 교복·피부가 금속처럼 반짝이는 현상을 보정
      o.material = o.material.clone();
      o.material.metalness = 0;
      o.material.metalnessMap = null;
      o.material.roughnessMap = null;
      o.material.roughness = 0.85;
      if (o.material.normalScale) o.material.normalScale.setScalar(0.35);
      // Meshy의 잘게 나뉜 UV에서 밉맵이 빈 흰 영역을 섞는 현상을 방지
      for (const texture of [o.material.map, o.material.normalMap]) {
        if (!texture) continue;
        texture.minFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
        texture.needsUpdate = true;
      }
      o.castShadow = true;
      o.receiveShadow = true;
      o.frustumCulled = false;
    }
  });
  // 애니메이션 대상과 크기·방향 보정 그룹을 분리
  const pivot = new THREE.Group();
  pivot.add(inner);
  pivot.rotation.y = src.rotY;
  pivot.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(pivot);
  const h = box.max.y - box.min.y || 1;
  const s = src.height / h;
  pivot.scale.setScalar(s);
  pivot.position.set(-(box.min.x + box.max.x) * 0.5 * s, -box.min.y * s, -(box.min.z + box.max.z) * 0.5 * s);
  const root = new THREE.Group();
  root.add(pivot);
  const mixer = new THREE.AnimationMixer(inner);
  const standingLegs = [];
  inner.traverse((o) => {
    if (o.isBone && /^(Hips|(?:Left|Right)(?:UpLeg|Leg|Foot|ToeBase))$/.test(o.name)) {
      standingLegs.push({ bone: o, position: o.position.clone(), quaternion: o.quaternion.clone() });
    }
  });
  const walkClip = src.clips.find((c) => /walk/i.test(c.name)) || src.clips[0];
  const walk = walkClip ? mixer.clipAction(walkClip) : null;
  if (walk) {
    // 걷기 첫 자세를 정지 자세로 사용. stop()은 원래 T 자세를 복원함
    walk.play();
    walk.paused = true;
    mixer.update(0);
  }
  root.userData.meshy = { mixer, walk, standingLegs };
  animateMeshyStudent(root, 0, 0);
  return root;
}

// 걷기 동작 재생(amt 0이면 멈춰 서 있음)
export function animateMeshyStudent(root, dt, amt) {
  const m = root.userData.meshy;
  if (!m) return;
  if (m.walk) {
    if (amt > 0.05) {
      m.walk.paused = false;
      m.walk.timeScale = Math.max(0.15, amt / 0.9);
    } else {
      m.walk.paused = true;
      m.walk.time = 0;
    }
  }
  m.mixer.update(dt);
  if (amt <= 0.05) {
    // 멈출 때는 팔을 내려놓은 동작을 유지하고 다리·골반만 기본 기립 자세로 복원
    for (const pose of m.standingLegs) {
      pose.bone.position.copy(pose.position);
      pose.bone.quaternion.copy(pose.quaternion);
    }
  }
}
