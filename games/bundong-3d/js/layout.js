// 번동중학교 배치도 (단위: m, x=동쪽, z=남쪽, y=위)
// 참고 영상: 운동장 동쪽 끝에서 서쪽(운동장)→북쪽(본관)→동쪽(계단탑·별관·등나무 쉼터)→남동쪽(소나무 정원)으로 둘러봄
export const L = {
  bounds: { x0: -49, x1: 97, z0: -60, z1: 45 },
  yard: { x0: -60, x1: 100, z0: -66, z1: 50 },
  turf: { x0: -42, x1: 28, z0: -22, z1: 22 },
  track: { x0: -47, x1: 33, z0: -31, z1: 27, r: 9 },
  walk: { x0: -50, x1: 57, z0: -38, z1: -31 },
  court: { x0: 34, x1: 56, z0: -35, z1: 22 },
  main: { x0: -35, x1: 30, z0: -53, z1: -38, floors: 4, fh: 3.8 },
  entrance: { x0: -2, x1: 10, z0: -38, z1: -34 },
  tower: { x0: 30, x1: 36, z0: -52, z1: -37 },
  annex: { x0: 36, x1: 46, z0: -58, z1: -40 },
  east: { x0: 46, x1: 74, z0: -62, z1: -44 },
  stands: { x0: 57, x1: 66, z0: -28, z1: 22, steps: 5, rise: 0.42 },
  plaza: { x0: 57, x1: 97, z0: 22, z1: 44 },
  garden: { x0: 66, x1: 97, z0: -44, z1: 22 },
  pond: { x: 84, z: -2, rx: 6.5, rz: 4.6 },
  south: { x0: -58, x1: 57, z0: 30, z1: 46 },
  gate: { x: 10, z: 45 },
  sealStone: { x: -7, z: 0 },
  spawn: { x: 38, z: 23, yaw: Math.PI / 2 - 0.25 },
  respawn: { x: 4, z: -32, yaw: 0 },
  // 실내(본관 1층)
  inside: {
    corridor: { z0: -42.4, z1: -38.3 },
    rooms: [
      { id: 'science', name: '과학실', x0: -35, x1: -22, door: -24 },
      { id: 'c11', name: '1학년 1반', x0: -22, x1: -12, door: -14 },
      { id: 'c12', name: '1학년 2반', x0: -12, x1: -2, door: -4 },
      { id: 'lobby', name: '중앙현관', x0: -2, x1: 10, door: null },
      { id: 'library', name: '도서실', x0: 10, x1: 20, door: 12 },
      { id: 'history', name: '역사교실', x0: 20, x1: 30, door: 22, locked: true },
    ],
    ceiling: 3.6,
  },
};

const inRect = (x, z, r) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;

export function inRoundRect(x, z, r) {
  if (!inRect(x, z, r)) return false;
  const cx = Math.min(Math.max(x, r.x0 + r.r), r.x1 - r.r);
  const cz = Math.min(Math.max(z, r.z0 + r.r), r.z1 - r.r);
  return (x - cx) ** 2 + (z - cz) ** 2 <= r.r * r.r;
}

export function isIndoor(x, z) {
  const m = L.main;
  return (x > m.x0 + 0.3 && x < m.x1 - 0.3 && z > m.z0 + 0.3 && z < m.z1 - 0.2) || inRect(x, z, L.entrance);
}

export function inPond(x, z) {
  const p = L.pond;
  return ((x - p.x) / p.rx) ** 2 + ((z - p.z) / p.rz) ** 2 < 1;
}

// 발소리용 바닥 재질
export function surfaceAt(x, z) {
  if (isIndoor(x, z)) return 'tile';
  if (inPond(x, z)) return 'water';
  if (inRect(x, z, L.turf)) return 'turf';
  if (inRoundRect(x, z, L.track)) return 'track';
  if (inRect(x, z, L.court)) return 'court';
  if (inRect(x, z, L.stands)) return 'brick';
  if (inRect(x, z, L.plaza)) return 'brick';
  if (inRect(x, z, L.garden)) return 'grass';
  if (inRect(x, z, L.walk)) return 'concrete';
  if (z > L.track.z1 + 1) return 'grass';
  return 'concrete';
}

export function placeName(x, z) {
  if (isIndoor(x, z)) {
    for (const r of L.inside.rooms) if (x >= r.x0 && x < r.x1 && z < L.inside.corridor.z0) return r.name;
    return '본관 1층 복도';
  }
  if (inRect(x, z, L.turf)) return '운동장';
  if (inRoundRect(x, z, L.track)) return '트랙';
  if (inRect(x, z, L.court)) return '다목적 코트';
  if (inRect(x, z, L.stands)) return '등나무 쉼터';
  if (inRect(x, z, L.garden)) return '소나무 정원';
  if (inRect(x, z, L.plaza)) return '벽돌 광장';
  if (z > 28) return '정문 화단';
  return '본관 앞';
}
