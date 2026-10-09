// 설정: 브라우저에 보관(실패해도 기본값으로 동작)
const DEFAULTS = {
  sens: 1.0,
  fov: 75,
  volume: 0.8,
  quality: 'medium',
  dayLength: 720,
  weather: 'auto',
  invert: false,
};

const KEY = 'bundong3d.settings';

export const settings = { ...DEFAULTS };

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) Object.assign(settings, JSON.parse(raw));
  } catch (e) { /* 저장소 사용 불가 */ }
  const q = new URLSearchParams(location.search).get('quality');
  if (q) settings.quality = q;
  return settings;
}

export function saveSettings() {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) { /* 무시 */ }
}

export const QUALITY = {
  low: { pixelRatio: 1, shadowMap: 1024, bloom: false, grass: 6000, yardTex: 2048, shadowRange: 45 },
  medium: { pixelRatio: 1.25, shadowMap: 2048, bloom: true, grass: 16000, yardTex: 4096, shadowRange: 55 },
  high: { pixelRatio: 2, shadowMap: 4096, bloom: true, grass: 30000, yardTex: 4096, shadowRange: 65 },
};
