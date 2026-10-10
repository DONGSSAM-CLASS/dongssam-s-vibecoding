import * as THREE from 'three';
import { L, inRoundRect } from './layout.js';
import { mulberry32, tfbm, tnoise } from './util.js';

// 모든 텍스처는 캔버스로 직접 그림(외부 이미지 없음)
export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

export function toTex(canvas, { repeat = null, srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = aniso;
  t.needsUpdate = true;
  return t;
}

let noiseCanvasCache = null;
// 타일링 노이즈 패턴(덧칠용)
function noiseCanvas() {
  if (noiseCanvasCache) return noiseCanvasCache;
  const s = 256;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(s, s);
  const rnd = mulberry32(7);
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const n = tfbm(x / 32, y / 32, 8, 4) * 0.6 + rnd() * 0.4;
    const v = Math.floor(n * 255);
    const i = (y * s + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  noiseCanvasCache = c;
  return c;
}

function grain(ctx, w, h, alpha = 0.25, mode = 'overlay', scale = 1) {
  const pat = ctx.createPattern(noiseCanvas(), 'repeat');
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = mode;
  if (scale !== 1) ctx.scale(scale, scale);
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, w / scale, h / scale);
  ctx.restore();
}

// 픽셀 단위 그리기 도우미
function pixels(w, h, fn) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const v = fn(x, y);
    img.data[i] = v[0]; img.data[i + 1] = v[1]; img.data[i + 2] = v[2]; img.data[i + 3] = v[3] === undefined ? 255 : v[3];
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// ---------- 운동장 전체 바닥(하나의 큰 그림) ----------
export function yardTexture(W) {
  const Y = L.yard;
  const wm = Y.x1 - Y.x0, hm = Y.z1 - Y.z0;
  const H = Math.round((W * hm) / wm);
  const s = W / wm;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const X = (x) => (x - Y.x0) * s, Z = (z) => (z - Y.z0) * s;
  const rect = (r, col) => { ctx.fillStyle = col; ctx.fillRect(X(r.x0), Z(r.z0), (r.x1 - r.x0) * s, (r.z1 - r.z0) * s); };
  const rrect = (x0, z0, x1, z1, r) => {
    ctx.beginPath();
    ctx.roundRect(X(x0), Z(z0), (x1 - x0) * s, (z1 - z0) * s, r * s);
  };

  // 바탕: 콘크리트 보도
  ctx.fillStyle = '#8f8b84';
  ctx.fillRect(0, 0, W, H);
  // 남쪽·서쪽 잔디/흙
  ctx.fillStyle = '#556d36';
  ctx.fillRect(0, Z(29), W, H);
  ctx.fillRect(0, 0, X(-49), H);
  // 정원(소나무 아래 흙+잔디)
  rect(L.garden, '#5d6b3a');
  ctx.save();
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 260; i++) {
    const rnd = mulberry32(i + 99);
    ctx.fillStyle = rnd() < 0.5 ? '#6f5a3d' : '#4f6a33';
    ctx.beginPath();
    ctx.ellipse(X(L.garden.x0 + rnd() * 31), Z(L.garden.z0 + rnd() * 66), (1 + rnd() * 3) * s, (0.6 + rnd() * 2) * s, rnd() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // 연못 자리 진흙
  ctx.fillStyle = '#3d3a2c';
  ctx.beginPath();
  ctx.ellipse(X(L.pond.x), Z(L.pond.z), (L.pond.rx + 0.8) * s, (L.pond.rz + 0.8) * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // 정원 산책길(마사토)
  ctx.strokeStyle = '#a99a7e';
  ctx.lineWidth = 1.8 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(X(67), Z(20)); ctx.bezierCurveTo(X(74), Z(10), X(76), Z(2), X(76.5), Z(-8));
  ctx.bezierCurveTo(X(77), Z(-20), X(86), Z(-26), X(92), Z(-38));
  ctx.moveTo(X(76.5), Z(-8)); ctx.bezierCurveTo(X(84), Z(-10), X(91), Z(-6), X(94), Z(4));
  ctx.stroke();

  // 트랙(빨간 우레탄)
  const T = L.track;
  ctx.fillStyle = '#a8453b';
  rrect(T.x0, T.z0, T.x1, T.z1, T.r);
  ctx.fill();
  // 레인 선
  ctx.strokeStyle = 'rgba(245,240,235,0.85)';
  ctx.lineWidth = 0.06 * s;
  for (let k = 1; k <= 4; k++) {
    const o = k * 1.22;
    const t = L.turf;
    rrect(t.x0 - o, t.z0 - o, t.x1 + o, t.z1 + o, Math.max(0.5, T.r - (5 - o)));
    ctx.stroke();
  }
  // 북쪽 직선 주로(100m 레인)
  for (let k = 5; k <= 7; k++) {
    ctx.beginPath();
    ctx.moveTo(X(T.x0 + 8), Z(L.turf.z0 - k * 1.22));
    ctx.lineTo(X(T.x1 - 6), Z(L.turf.z0 - k * 1.22));
    ctx.stroke();
  }
  // 출발선
  ctx.lineWidth = 0.08 * s;
  ctx.beginPath();
  ctx.moveTo(X(-30), Z(T.z0 + 0.2)); ctx.lineTo(X(-30), Z(L.turf.z0 - 0.2));
  ctx.moveTo(X(20), Z(T.z0 + 0.2)); ctx.lineTo(X(20), Z(L.turf.z0 - 0.2));
  ctx.stroke();

  // 인조잔디 + 잔디 깎은 줄무늬
  const t = L.turf;
  for (let i = 0, x = t.x0; x < t.x1; i++, x += 5) {
    ctx.fillStyle = i % 2 ? '#3e8c3a' : '#479a42';
    ctx.fillRect(X(x), Z(t.z0), Math.min(5, t.x1 - x) * s, (t.z1 - t.z0) * s);
  }
  // 경기장 라인
  ctx.strokeStyle = 'rgba(250,250,245,0.92)';
  ctx.lineWidth = 0.12 * s;
  const fx0 = t.x0 + 1.5, fx1 = t.x1 - 1.5, fz0 = t.z0 + 1.5, fz1 = t.z1 - 1.5;
  const mx = (fx0 + fx1) / 2, mz = (fz0 + fz1) / 2;
  ctx.strokeRect(X(fx0), Z(fz0), (fx1 - fx0) * s, (fz1 - fz0) * s);
  ctx.beginPath(); ctx.moveTo(X(mx), Z(fz0)); ctx.lineTo(X(mx), Z(fz1)); ctx.stroke();
  ctx.beginPath(); ctx.arc(X(mx), Z(mz), 7 * s, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(X(mx), Z(mz), 0.2 * s, 0, Math.PI * 2); ctx.fill();
  for (const side of [-1, 1]) {
    const gx = side < 0 ? fx0 : fx1;
    const pb = 13, pw = 30, gb = 4.5, gw = 14;
    ctx.strokeRect(X(side < 0 ? gx : gx - pb), Z(mz - pw / 2), pb * s, pw * s);
    ctx.strokeRect(X(side < 0 ? gx : gx - gb), Z(mz - gw / 2), gb * s, gw * s);
    ctx.beginPath(); ctx.arc(X(gx - side * 9), Z(mz), 0.18 * s, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    ctx.arc(X(gx - side * 9), Z(mz), 7 * s, side < 0 ? -0.93 : Math.PI - 0.93, side < 0 ? 0.93 : Math.PI + 0.93);
    ctx.stroke();
  }
  for (const [cx, cz, a0] of [[fx0, fz0, 0], [fx1, fz0, Math.PI / 2], [fx1, fz1, Math.PI], [fx0, fz1, -Math.PI / 2]]) {
    ctx.beginPath(); ctx.arc(X(cx), Z(cz), 1 * s, a0, a0 + Math.PI / 2); ctx.stroke();
  }

  // 다목적 코트(청록 + 빨간 테두리)
  const C = L.court;
  rect(C, '#b2493f');
  ctx.fillStyle = '#3c9a76';
  ctx.fillRect(X(C.x0 + 1.2), Z(C.z0 + 1.2), (C.x1 - C.x0 - 2.4) * s, (C.z1 - C.z0 - 2.4) * s);
  ctx.fillStyle = '#b2493f';
  ctx.fillRect(X(C.x0 + 1.2), Z(-8), (C.x1 - C.x0 - 2.4) * s, 1.2 * s);
  ctx.strokeStyle = 'rgba(245,245,240,0.8)';
  ctx.lineWidth = 0.08 * s;
  ctx.strokeRect(X(C.x0 + 3), Z(C.z0 + 3), (C.x1 - C.x0 - 6) * s, (-8 - C.z0 - 4) * s);
  ctx.beginPath(); ctx.arc(X((C.x0 + C.x1) / 2), Z(C.z0 + 3), 4 * s, 0, Math.PI); ctx.stroke();
  ctx.strokeRect(X(C.x0 + 3), Z(-5), (C.x1 - C.x0 - 6) * s, (C.z1 - 3 + 5) * s);

  // 스탠드·광장(벽돌색 바탕, 실제 벽돌은 별도 메시)
  rect(L.stands, '#b0574b');
  rect(L.plaza, '#b0574b');
  // 정문 길
  ctx.fillStyle = '#9a958c';
  ctx.fillRect(X(L.gate.x - 4), Z(27), 8 * s, (Y.z1 - 27) * s);

  grain(ctx, W, H, 0.35, 'overlay', Math.max(1, s / 12));
  grain(ctx, W, H, 0.18, 'multiply', Math.max(1, s / 40));
  return c;
}

// 잔디·고무 미세 질감(배수 1.0 기준 0.5 회색)
export function detailTexture() {
  const s = 256;
  const rnd = mulberry32(3);
  return pixels(s, s, (x, y) => {
    const n = tfbm(x / 16, y / 16, 16, 3);
    const f = rnd();
    const v = 128 + (n - 0.5) * 70 + (f - 0.5) * 60;
    return [v, v, v];
  });
}

// ---------- 벽돌 포장 ----------
export function brickPaving(color = [176, 86, 74]) {
  const s = 512;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const b = makeCanvas(s, s);
  const bx = b.getContext('2d');
  ctx.fillStyle = '#8b7f75'; ctx.fillRect(0, 0, s, s);
  bx.fillStyle = '#202020'; bx.fillRect(0, 0, s, s);
  const rnd = mulberry32(11);
  const bw = 64, bh = 32, m = 3;
  for (let row = 0; row < s / bh; row++) {
    const off = (row % 2) * bw / 2;
    for (let col = -1; col < s / bw + 1; col++) {
      const x = col * bw + off, y = row * bh;
      const v = 0.82 + rnd() * 0.3;
      const r = color[0] * v, g = color[1] * (v * 0.95 + rnd() * 0.08), bb = color[2] * v;
      ctx.fillStyle = `rgb(${r | 0},${g | 0},${bb | 0})`;
      ctx.fillRect(x + m, y + m, bw - m * 2, bh - m * 2);
      bx.fillStyle = `rgb(${200 + rnd() * 40 | 0},${200 | 0},200)`;
      bx.fillRect(x + m, y + m, bw - m * 2, bh - m * 2);
    }
  }
  grain(ctx, s, s, 0.4, 'overlay');
  grain(bx, s, s, 0.3, 'overlay');
  return { map: c, bump: b };
}

export function concreteTexture(base = '#a9a59d', size = 512) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = base; ctx.fillRect(0, 0, size, size);
  grain(ctx, size, size, 0.35, 'overlay');
  grain(ctx, size, size, 0.12, 'multiply', 2);
  return c;
}

// ---------- 본관 외벽: 파랑·하양·회색 체크 유리 ----------
const GLASS = ['#3a6cc8', '#4f80d4', '#2f5fb8', '#c8d6ea', '#dfe6ef', '#8f9db3', '#a9b8cf', '#6f91cf'];
export function checkerFacade(wm, floors, fh, seed = 5, lit = false) {
  const pxm = 48;
  const W = Math.round(wm * pxm), H = Math.round(floors * fh * pxm);
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const rnd = mulberry32(seed);
  const lrnd = mulberry32(seed + 1000);
  ctx.fillStyle = lit ? '#000' : '#d9dde3';
  ctx.fillRect(0, 0, W, H);
  const pw = 1.25 * pxm;
  for (let f = 0; f < floors; f++) {
    const y0 = H - (f + 1) * fh * pxm;
    // 층 사이 띠(스팬드럴)
    if (!lit) { ctx.fillStyle = '#e4e6e9'; ctx.fillRect(0, y0 + fh * pxm - 0.45 * pxm, W, 0.45 * pxm); }
    const bandH = (fh - 0.45) * pxm;
    const roomLit = lrnd() < 0.55;
    for (let i = 0, x = 0; x < W; i++, x += pw) {
      // 위·아래 두 칸
      for (let k = 0; k < 2; k++) {
        const hh = k === 0 ? bandH * 0.62 : bandH * 0.38;
        const yy = k === 0 ? y0 : y0 + bandH * 0.62;
        if (lit) {
          if (roomLit && k === 0 && lrnd() < 0.9) {
            ctx.fillStyle = lrnd() < 0.7 ? '#fff4d8' : '#dff0ff';
            ctx.fillRect(x + 3, yy + 3, pw - 6, hh - 6);
          }
          continue;
        }
        const col = GLASS[Math.floor(rnd() * GLASS.length)];
        const g = ctx.createLinearGradient(x, yy, x + pw, yy + hh);
        g.addColorStop(0, col);
        g.addColorStop(1, shade(col, 0.82));
        ctx.fillStyle = g;
        ctx.fillRect(x + 2, yy + 2, pw - 4, hh - 4);
        // 하늘 반사
        ctx.fillStyle = 'rgba(255,255,255,0.10)';
        ctx.fillRect(x + 2, yy + 2, pw - 4, hh * 0.25);
      }
      if (!lit) { ctx.fillStyle = '#f2f3f5'; ctx.fillRect(x - 2, y0, 4, bandH); }
    }
    if (!lit) { ctx.fillStyle = '#f2f3f5'; ctx.fillRect(0, y0 + bandH * 0.62 - 2, W, 4); }
  }
  if (!lit) grain(ctx, W, H, 0.12, 'overlay');
  return c;
}

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) * k, g = ((n >> 8) & 255) * k, b = (n & 255) * k;
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

// 일반 벽 + 창문 격자 (측면·후면·별관 등)
export function windowWall({ wm, hm, fh = 3.6, base = '#c9c9c4', win = '#5a6f86', winW = 1.6, gap = 1.4, sill = 0.9, winH = 1.6, seed = 1, brick = false, lit = false, bottomOffset = 0 }) {
  const pxm = 32;
  const W = Math.max(8, Math.round(wm * pxm)), H = Math.max(8, Math.round(hm * pxm));
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const rnd = mulberry32(seed);
  ctx.fillStyle = lit ? '#000' : base;
  ctx.fillRect(0, 0, W, H);
  if (brick && !lit) {
    const bw = 0.24 * pxm, bh = 0.08 * pxm;
    for (let y = 0, row = 0; y < H; y += bh, row++) {
      for (let x = (row % 2) * bw / 2 - bw; x < W; x += bw) {
        const v = 0.85 + rnd() * 0.25;
        ctx.fillStyle = shade(base, v);
        ctx.fillRect(x + 0.6, y + 0.6, bw - 1.2, bh - 1.2);
      }
    }
  }
  const floors = Math.floor((hm - bottomOffset) / fh);
  for (let f = 0; f < floors; f++) {
    const yb = H - (bottomOffset + f * fh + sill) * pxm;
    const roomLit = rnd() < 0.5;
    for (let x = gap * 0.5; x + winW <= wm; x += winW + gap) {
      const px = x * pxm, py = yb - winH * pxm;
      if (lit) {
        if (roomLit && rnd() < 0.85) {
          ctx.fillStyle = rnd() < 0.6 ? '#ffefc8' : '#e2f1ff';
          ctx.fillRect(px + 2, py + 2, winW * pxm - 4, winH * pxm - 4);
        }
        continue;
      }
      ctx.fillStyle = '#e9e9e6';
      ctx.fillRect(px - 2, py - 2, winW * pxm + 4, winH * pxm + 4);
      const g = ctx.createLinearGradient(px, py, px, py + winH * pxm);
      g.addColorStop(0, shade(win, 1.25));
      g.addColorStop(1, shade(win, 0.75));
      ctx.fillStyle = g;
      ctx.fillRect(px, py, winW * pxm, winH * pxm);
      ctx.fillStyle = '#e9e9e6';
      ctx.fillRect(px + winW * pxm / 2 - 1, py, 2, winH * pxm);
    }
  }
  if (!lit) grain(ctx, W, H, 0.2, 'overlay');
  return c;
}

// 간판 띠: "희망과 감동을 주는 번동중학교"
export function signBand(wm, hm, textX0, textX1) {
  const pxm = 40;
  const W = Math.round(wm * pxm), H = Math.round(hm * pxm);
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#9a6a5e';
  ctx.fillRect(0, 0, W, H);
  const rnd = mulberry32(21);
  const bw = 0.3 * pxm, bh = 0.1 * pxm;
  for (let y = 0, row = 0; y < H; y += bh, row++) {
    for (let x = (row % 2) * bw / 2 - bw; x < W; x += bw) {
      ctx.fillStyle = shade('#9d6b5e', 0.88 + rnd() * 0.22);
      ctx.fillRect(x + 0.7, y + 0.7, bw - 1.4, bh - 1.4);
    }
  }
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(0, 0, W, 0.15 * pxm);
  ctx.fillStyle = '#f3f0e8';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  const text = '희망과 감동을 주는 번동중학교';
  let size = hm * pxm * 0.62;
  ctx.font = `900 ${size}px "Noto Serif KR", "Batang", "Noto Sans KR", serif`;
  const want = (textX1 - textX0) * pxm;
  const m = ctx.measureText(text).width;
  if (m > want) { size *= want / m; ctx.font = `900 ${size}px "Noto Serif KR", "Batang", "Noto Sans KR", serif`; }
  ctx.shadowColor = 'rgba(255,240,220,0.35)';
  ctx.shadowOffsetY = 2;
  ctx.fillText(text, ((textX0 + textX1) / 2) * pxm, H * 0.55);
  grain(ctx, W, H, 0.18, 'overlay');
  return c;
}

// 계단탑: 회색 콘크리트 + 주황/노랑 패널 + 파란 유리 띠
export function towerTexture(wm, hm, lit = false) {
  const pxm = 32;
  const W = Math.round(wm * pxm), H = Math.round(hm * pxm);
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = lit ? '#000' : '#c9c6bf';
  ctx.fillRect(0, 0, W, H);
  if (lit) {
    ctx.fillStyle = '#f5f0e0';
    for (let f=0;f<4;f++) { const yy=H*(.14+f*.19); ctx.fillRect(W*.26,yy+H*.04,W*.23,H*.13); ctx.fillRect(W*.63,yy,W*.2,H*.11); }
    return c;
  }
  // 제공 영상 00:04: 회색 테두리 안의 황토색 세로 띠와 엇갈린 녹색 창.
  ctx.fillStyle='#ad7628'; ctx.fillRect(W*.25,H*.04,W*.59,H*.87);
  ctx.fillStyle='#dc9f3c'; ctx.fillRect(W*.47,H*.12,W*.16,H*.73);
  const glass=ctx.createLinearGradient(0,0,W,H);
  glass.addColorStop(0,'#304d4c'); glass.addColorStop(1,'#62817a');
  for(let f=0;f<4;f++){
    const yy=H*(.14+f*.19);
    ctx.fillStyle=glass;
    ctx.fillRect(W*.26,yy+H*.04,W*.23,H*.13);
    ctx.fillRect(W*.63,yy,W*.2,H*.11);
    ctx.fillStyle='#a9ada8';
    ctx.fillRect(W*.25,yy+H*.165,W*.35,H*.018);
    ctx.fillRect(W*.57,yy+H*.11,W*.28,H*.025);
    ctx.fillStyle='#c5c9c0';
    for(let j=1;j<4;j++)ctx.fillRect(W*.26+j*W*.057,yy+H*.11,1,H*.057);
    ctx.fillRect(W*.26,yy+H*.11,W*.23,2);
  }
  ctx.fillStyle='#a6a7a2';ctx.fillRect(W*.37,H*.88,W*.4,H*.065);
  grain(ctx, W, H, 0.25, 'overlay');
  return c;
}

// 아파트 외벽 (밝은 미색 + 창문 + 발코니)
export function apartmentTexture(lit = false, seed = 1) {
  const W = 512, H = 1024; // 4세대 x 16층 한 타일
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const rnd = mulberry32(seed);
  ctx.fillStyle = lit ? '#000' : '#e7e3da';
  ctx.fillRect(0, 0, W, H);
  const fh = H / 16, uw = W / 4;
  for (let f = 0; f < 16; f++) {
    for (let u = 0; u < 4; u++) {
      const x = u * uw, y = f * fh;
      if (lit) {
        if (rnd() < 0.42) {
          ctx.fillStyle = rnd() < 0.75 ? '#ffdca0' : '#d8ecff';
          ctx.fillRect(x + uw * 0.12, y + fh * 0.22, uw * 0.76, fh * 0.5);
        }
        continue;
      }
      ctx.fillStyle = '#4d5a68';
      ctx.fillRect(x + uw * 0.12, y + fh * 0.22, uw * 0.76, fh * 0.5);
      ctx.fillStyle = 'rgba(200,220,240,0.25)';
      ctx.fillRect(x + uw * 0.12, y + fh * 0.22, uw * 0.76, fh * 0.14);
      ctx.fillStyle = '#f3f1ec';
      ctx.fillRect(x + uw * 0.08, y + fh * 0.7, uw * 0.84, fh * 0.12);
      ctx.fillStyle = '#d2cdc2';
      ctx.fillRect(x + uw * 0.47, y + fh * 0.22, uw * 0.03, fh * 0.5);
    }
  }
  if (!lit) {
    ctx.fillStyle = '#bdb6a8';
    ctx.fillRect(W / 2 - 6, 0, 12, H);
    grain(ctx, W, H, 0.15, 'overlay');
  }
  return c;
}

// ---------- 나무 껍질 ----------
export function barkTexture(base = [128, 74, 52], plates = true) {
  const s = 256;
  return pixels(s, s, (x, y) => {
    const n = tfbm(x / 22, y / 64, 12, 4);
    const crack = tnoise(x / 9, y / 26, 28);
    let v = 0.65 + n * 0.5;
    if (plates && crack < 0.28) v *= 0.45;
    return [base[0] * v, base[1] * v, base[2] * v];
  });
}

// 솔잎 다발(투명 배경)
export function needleTexture() {
  const s = 256;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const rnd = mulberry32(41);
  ctx.lineCap = 'round';
  for (let k = 0; k < 9; k++) {
    const cx = s * (0.2 + rnd() * 0.6), cy = s * (0.25 + rnd() * 0.5);
    for (let i = 0; i < 60; i++) {
      const a = rnd() * Math.PI * 2;
      const len = s * (0.08 + rnd() * 0.12);
      const g = 70 + rnd() * 60;
      ctx.strokeStyle = `rgb(${30 + rnd() * 30 | 0},${g | 0},${30 + rnd() * 25 | 0})`;
      ctx.lineWidth = 1.6 + rnd() * 1.4;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len * 0.75);
      ctx.stroke();
    }
  }
  return c;
}

// 활엽수 잎 뭉치
export function leafTexture(hue = [70, 120, 50], seed = 51, density = 140) {
  const s = 256;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const rnd = mulberry32(seed);
  for (let i = 0; i < density; i++) {
    const r = Math.sqrt(rnd()) * s * 0.44;
    const a = rnd() * Math.PI * 2;
    const x = s / 2 + Math.cos(a) * r, y = s / 2 + Math.sin(a) * r;
    const v = 0.65 + rnd() * 0.55;
    ctx.fillStyle = `rgb(${hue[0] * v | 0},${hue[1] * v | 0},${hue[2] * v | 0})`;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rnd() * Math.PI * 2);
    ctx.beginPath();
    ctx.ellipse(0, 0, 9 + rnd() * 6, 4 + rnd() * 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  return c;
}

// 등나무: 잎 + 늘어진 마른 꼬투리
export function wisteriaTexture() {
  const s = 256;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const rnd = mulberry32(61);
  for (let i = 0; i < 26; i++) {
    const x = rnd() * s, y0 = rnd() * s * 0.3;
    const len = s * (0.3 + rnd() * 0.5);
    ctx.strokeStyle = `rgba(90,75,50,0.9)`;
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x + (rnd() - 0.5) * 12, y0 + len); ctx.stroke();
    for (let k = 0; k < 9; k++) {
      const t = rnd();
      const brown = rnd() < 0.45;
      const v = 0.7 + rnd() * 0.5;
      ctx.fillStyle = brown ? `rgb(${168 * v | 0},${130 * v | 0},${80 * v | 0})` : `rgb(${92 * v | 0},${140 * v | 0},${56 * v | 0})`;
      ctx.save();
      ctx.translate(x + (rnd() - 0.5) * 14, y0 + t * len);
      ctx.rotate((rnd() - 0.5) * 1.2 + Math.PI / 2);
      ctx.beginPath();
      ctx.ellipse(0, 0, brown ? 10 : 8, brown ? 3 : 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  return c;
}

// 철망 울타리(초록, 투명)
export function chainLinkTexture() {
  const s = 128;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  ctx.strokeStyle = '#2f7a46';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = -s; i < s * 2; i += 16) {
    ctx.moveTo(i, 0); ctx.lineTo(i + s, s);
    ctx.moveTo(i, s); ctx.lineTo(i + s, 0);
  }
  ctx.stroke();
  return c;
}

export function woodTexture(base = [150, 104, 64], seed = 71) {
  const s = 256;
  return pixels(s, s, (x, y) => {
    const n = tfbm(x / 128, y / 6, 2, 3);
    const ring = Math.sin((y + n * 40) * 0.35) * 0.5 + 0.5;
    const v = 0.72 + ring * 0.18 + tnoise(x / 4, y / 4, 64) * 0.12;
    return [base[0] * v, base[1] * v, base[2] * v];
  });
}

// 물결 노멀맵
export function waterNormal() {
  const s = 256;
  const h = (x, y) => tfbm(x / 32, y / 32, 8, 4) + tfbm(x / 11 + 3, y / 11, 23, 2) * 0.35;
  return pixels(s, s, (x, y) => {
    const dx = h(x + 1, y) - h(x - 1, y);
    const dy = h(x, y + 1) - h(x, y - 1);
    const nx = -dx * 3, ny = -dy * 3, nz = 1;
    const l = Math.hypot(nx, ny, nz);
    return [(nx / l * 0.5 + 0.5) * 255, (ny / l * 0.5 + 0.5) * 255, (nz / l * 0.5 + 0.5) * 255];
  });
}

// 실내 바닥(연한 비닐 타일)
export function floorTiles() {
  const s = 512;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const rnd = mulberry32(81);
  const t = s / 4;
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const v = 0.93 + rnd() * 0.08;
    ctx.fillStyle = `rgb(${214 * v | 0},${206 * v | 0},${188 * v | 0})`;
    ctx.fillRect(i * t, j * t, t, t);
    ctx.strokeStyle = 'rgba(120,110,95,0.5)';
    ctx.strokeRect(i * t + 0.5, j * t + 0.5, t - 1, t - 1);
  }
  grain(ctx, s, s, 0.2, 'overlay');
  return c;
}

export function blackboardTexture(lines) {
  const W = 1024, H = 384;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#25483a';
  ctx.fillRect(0, 0, W, H);
  grain(ctx, W, H, 0.25, 'overlay');
  ctx.fillStyle = 'rgba(240,240,230,0.85)';
  ctx.font = '600 44px "Noto Sans KR", sans-serif';
  lines.forEach((ln, i) => ctx.fillText(ln, 50, 80 + i * 66));
  ctx.strokeStyle = '#7a5a3a';
  ctx.lineWidth = 16;
  ctx.strokeRect(0, 0, W, H);
  return c;
}

export function bookshelfTexture() {
  const W = 256, H = 256;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const rnd = mulberry32(91);
  ctx.fillStyle = '#5a3d26'; ctx.fillRect(0, 0, W, H);
  for (let r = 0; r < 4; r++) {
    let x = 6;
    while (x < W - 8) {
      const w = 6 + rnd() * 10;
      const h = 40 + rnd() * 18;
      const hue = Math.floor(rnd() * 360);
      ctx.fillStyle = `hsl(${hue},${30 + rnd() * 40}%,${30 + rnd() * 30}%)`;
      ctx.fillRect(x, r * 64 + 62 - h, w, h);
      x += w + 1;
    }
    ctx.fillStyle = '#6e4b2e';
    ctx.fillRect(0, r * 64 + 60, W, 4);
  }
  return c;
}
