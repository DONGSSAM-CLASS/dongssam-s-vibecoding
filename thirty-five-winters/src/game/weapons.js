// Period small arms (behavioural stats, not ballistic simulation). Names are generic where sources
// do not pin down exact models for a unit; the archive explains what is and isn't known.
export const WEAPONS = {
  none: { id: 'none', mag: 0 },
  rifle_old: {
    id: 'rifle_old', model: 'rifle_old', kind: 'rifle', mag: 1, cycle: 0.4, reload: 1.7, spread: 0.012, hip: 0.06, range: 300, sound: 'rifle',
    name: { en: 'Old single-shot rifle', ko: '구식 단발 소총' },
    note: { en: 'Training schools in West Gando had few, often outdated firearms; drill also used wooden rifles.', ko: '서간도의 교육 기관은 총기가 적고 낡은 것이 많았으며, 목총으로도 훈련했다.' },
  },
  rifle_mosin: {
    id: 'rifle_mosin', model: 'rifle', kind: 'rifle', mag: 5, cycle: 1.1, reload: 2.6, spread: 0.0065, hip: 0.05, range: 450, sound: 'rifle',
    name: { en: 'Russian M1891-type bolt-action rifle', ko: '러시아제 M1891계 볼트액션 소총' },
    note: { en: 'In 1920 independence army units in Gando bought arms through Russian and Czech channels; many rifles were Russian-made.', ko: '1920년 간도의 독립군은 러시아·체코 군단 경로 등으로 무기를 사들였고, 러시아제 소총이 많았다.' },
  },
  rifle_mauser: {
    id: 'rifle_mauser', model: 'rifle', kind: 'rifle', mag: 5, cycle: 1.05, reload: 2.5, spread: 0.0065, hip: 0.05, range: 450, sound: 'rifle',
    name: { en: 'Mauser-pattern bolt-action rifle', ko: '마우저 계열 볼트액션 소총' },
    note: { en: 'Korean–Chinese allied units in the 1930s used mixed rifles, many of them Mauser-pattern Chinese arms.', ko: '1930년대 한중 연합 부대는 중국제 마우저 계열 등 여러 소총을 섞어 썼다.' },
  },
  rifle_jp: {
    id: 'rifle_jp', model: 'rifle_jp', kind: 'rifle', mag: 5, cycle: 1.0, reload: 2.4, spread: 0.006, hip: 0.05, range: 450, sound: 'rifle',
    name: { en: 'Japanese Arisaka-type rifle', ko: '일본군 아리사카계 소총' },
  },
  rifle_lee: {
    id: 'rifle_lee', model: 'rifle', kind: 'rifle', mag: 10, cycle: 0.85, reload: 3.0, spread: 0.006, hip: 0.05, range: 450, sound: 'rifle',
    name: { en: 'British Lee–Enfield rifle', ko: '영국군 리-엔필드 소총' },
    note: { en: 'Issued here because the unit worked with British forces; the exact weapons of each member are not recorded in the game\'s sources.', ko: '영국군과 함께 활동했기에 쓰인 무기로 설정했다. 대원 각자의 정확한 무기는 게임이 참고한 자료에 나오지 않는다.' },
  },
  carbine: {
    id: 'carbine', model: 'carbine', kind: 'carbine', mag: 15, cycle: 0.28, reload: 2.0, spread: 0.009, hip: 0.05, range: 250, sound: 'carbine',
    name: { en: 'US M1 carbine (OSS training)', ko: '미군 M1 카빈 (OSS 훈련)' },
    note: { en: 'Used here only for the 1945 OSS joint-training scene.', ko: '1945년 OSS 합동 훈련 장면에서만 사용한다.' },
  },
  drill: { id: 'drill', model: 'drill', kind: 'drill', mag: 0, name: { en: 'Wooden drill rifle', ko: '목총' } },
};

export const DIFFICULTY = {
  story: { detect: 0.6, enemyAcc: 0.45, dmgTaken: 0.5, bleed: 1.7, bandages: 2, label: { en: 'Story', ko: '이야기' } },
  standard: { detect: 1, enemyAcc: 1, dmgTaken: 1, bleed: 1, bandages: 0, label: { en: 'Standard', ko: '보통' } },
  hard: { detect: 1.3, enemyAcc: 1.3, dmgTaken: 1.4, bleed: 0.75, bandages: -1, label: { en: 'Hard', ko: '어려움' } },
};
