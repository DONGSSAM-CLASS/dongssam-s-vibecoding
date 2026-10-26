// Original low-poly characters with an ink outline and procedural animation.
// Outfits follow period descriptions: hanbok and durumagi (1910 Hanseong), padded cotton coats and
// leg wraps (Manchurian settlers and independence fighters), mixed and partial uniforms (1920),
// Chinese-allied kit (1930s), khaki Liberation Army uniforms (1940s). Japanese forces change by era.
import * as THREE from 'three';
import { GeoBuilder } from './geo.js';
import { damp, clamp, lerp } from '../engine/util.js';

const OUTLINE = new THREE.MeshBasicMaterial({ color: '#16120e', side: THREE.BackSide });
OUTLINE.onBeforeCompile = (sh) => {
  sh.vertexShader = 'attribute vec3 smoothNormal; uniform float uOutline;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed += smoothNormal * 0.018;');
};
const BODY_MAT = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
const FLAT_SKIN = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: false });
export const characterMaterials = { BODY_MAT, OUTLINE };
let OUTLINES = true;
export function setOutlines(v) { OUTLINES = v; }

function smoothNormals(geo) {
  const p = geo.attributes.position.array, n = geo.attributes.normal.array;
  const map = new Map(), out = new Float32Array(p.length);
  const key = (i) => `${Math.round(p[i] * 500)},${Math.round(p[i + 1] * 500)},${Math.round(p[i + 2] * 500)}`;
  for (let i = 0; i < p.length; i += 3) { const k = key(i); const a = map.get(k) || [0, 0, 0]; a[0] += n[i]; a[1] += n[i + 1]; a[2] += n[i + 2]; map.set(k, a); }
  for (let i = 0; i < p.length; i += 3) { const a = map.get(key(i)); const l = Math.hypot(a[0], a[1], a[2]) || 1; out[i] = a[0] / l; out[i + 1] = a[1] / l; out[i + 2] = a[2] / l; }
  geo.setAttribute('smoothNormal', new THREE.BufferAttribute(out, 3));
}

// Outfit presets ---------------------------------------------------------------------------
const SK = ['#e2b991', '#d9ad84', '#c99a71', '#e8c39c'];
export const OUTFITS = {
  // civilians
  hanbok_m: { top: { color: '#e8e2d2', style: 'jeogori' }, bottom: { color: '#e3dccb', style: 'baji' }, coat: '#d9d3c2', hat: 'none', hair: 'topknot', shoes: '#3a3530', legwrap: '#d8d0bd' },
  hanbok_w: { body: 'f', top: { color: '#efe9da', style: 'jeogori' }, bottom: { color: '#3d4a63', style: 'chima' }, hat: 'none', hair: 'bun', shoes: '#3a3530' },
  scholar: { top: { color: '#ece6d6', style: 'jeogori' }, bottom: { color: '#e3dccb', style: 'baji' }, coat: '#e9e4d6', hat: 'gat', hair: 'topknot', shoes: '#2f2a26' },
  student1910: { top: { color: '#2b2f38', style: 'tunic' }, bottom: { color: '#2b2f38', style: 'trousers' }, hat: 'cap', hatColor: '#24272e', hair: 'short', shoes: '#1f1c1a' },
  settler_m: { top: { color: '#c8bfa8', style: 'padded' }, bottom: { color: '#b9b09a', style: 'baji' }, hat: 'towel', hatColor: '#e2dccb', hair: 'short', shoes: '#4a3b2c', legwrap: '#bdb39b' },
  settler_w: { body: 'f', top: { color: '#d8cfba', style: 'padded' }, bottom: { color: '#5c5a52', style: 'chima' }, hat: 'scarf', hatColor: '#e6dfcf', hair: 'bun', shoes: '#4a3b2c' },
  refugee_w: { body: 'f', top: { color: '#a8a08c', style: 'padded' }, bottom: { color: '#4f4d47', style: 'chima' }, hat: 'scarf', hatColor: '#cfc7b4', hair: 'bun', shoes: '#3f3428', pack: 'bundle' },
  refugee_m: { top: { color: '#8f887a', style: 'padded' }, bottom: { color: '#7d776b', style: 'baji' }, hat: 'fur', hatColor: '#5a4a3a', hair: 'short', shoes: '#3f3428', legwrap: '#9a9283', pack: 'jige' },
  child: { scale: 0.68, top: { color: '#c9b48f', style: 'padded' }, bottom: { color: '#8a7f6a', style: 'baji' }, hat: 'none', hair: 'braid', shoes: '#3f3428' },
  // independence army, by period
  trainee1911: { top: { color: '#b3a88f', style: 'jeogori' }, bottom: { color: '#a59a80', style: 'baji' }, hat: 'towel', hatColor: '#ddd5c2', hair: 'short', shoes: '#4a3b2c', legwrap: '#cfc6af', belt: '#5b4632' },
  cadet1919: { top: { color: '#6d6852', style: 'tunic' }, bottom: { color: '#6d6852', style: 'trousers' }, hat: 'cap', hatColor: '#5e5a47', hair: 'short', shoes: '#3a2f25', legwrap: '#7e785f', belt: '#4a3a2a', bandolier: true },
  army1920: { top: { color: '#5f6150', style: 'tunic' }, bottom: { color: '#5a5a4a', style: 'trousers' }, hat: 'cap', hatColor: '#4f5142', hair: 'short', shoes: '#3a2f25', legwrap: '#6f6d5a', belt: '#4a3a2a', bandolier: true, pack: 'roll' },
  army1920b: { top: { color: '#7a6f5a', style: 'padded' }, bottom: { color: '#5d5647', style: 'baji' }, hat: 'fur', hatColor: '#4a3d30', hair: 'short', shoes: '#3a2f25', legwrap: '#857b65', belt: '#4a3a2a', bandolier: true },
  army1920w: { top: { color: '#d9d6cc', style: 'padded' }, bottom: { color: '#6a665a', style: 'baji' }, hat: 'fur', hatColor: '#4a3d30', hair: 'short', shoes: '#3a2f25', legwrap: '#a39d8c', belt: '#4a3a2a', bandolier: true },
  medic1920: { body: 'f', top: { color: '#6a6655', style: 'tunic' }, bottom: { color: '#57554a', style: 'trousers' }, hat: 'scarf', hatColor: '#d8d2c0', hair: 'bun', shoes: '#3a2f25', legwrap: '#77735f', belt: '#4a3a2a', medbag: true, armband: '#f1ece0' },
  liaison_w: { body: 'f', top: { color: '#2f3442', style: 'jeogori' }, bottom: { color: '#2b2f3a', style: 'chima' }, hat: 'scarf', hatColor: '#3a3f4c', hair: 'bun', shoes: '#1f1c1a', satchel: true },
  liaison_m: { top: { color: '#3b3a36', style: 'tunic' }, bottom: { color: '#36352f', style: 'trousers' }, coat: '#45433d', hat: 'fedora', hatColor: '#2c2b28', hair: 'short', shoes: '#1f1c1a', satchel: true },
  army1930: { top: { color: '#57584a', style: 'padded' }, bottom: { color: '#4f5044', style: 'trousers' }, hat: 'fur', hatColor: '#5a4a38', hair: 'short', shoes: '#3a2f25', legwrap: '#66675a', belt: '#4a3a2a', bandolier: true, pack: 'roll' },
  army1933s: { top: { color: '#6a6a52', style: 'tunic' }, bottom: { color: '#5d5d48', style: 'trousers' }, hat: 'cap', hatColor: '#585a45', hair: 'short', shoes: '#3a2f25', legwrap: '#727259', belt: '#4a3a2a', bandolier: true },
  chinese_vol: { top: { color: '#4f5560', style: 'padded' }, bottom: { color: '#454a53', style: 'trousers' }, hat: 'fur', hatColor: '#3c3a36', hair: 'short', shoes: '#2a2724', legwrap: '#585d66', belt: '#3a2f25', bandolier: true },
  chinese_nra: { top: { color: '#5d6b74', style: 'tunic' }, bottom: { color: '#56636b', style: 'trousers' }, hat: 'cap', hatColor: '#55626a', hair: 'short', shoes: '#2a2724', legwrap: '#66727a', belt: '#3a2f25' },
  kvc1938: { top: { color: '#556167', style: 'tunic' }, bottom: { color: '#4f5a5f', style: 'trousers' }, hat: 'cap', hatColor: '#4d585d', hair: 'short', shoes: '#2a2724', legwrap: '#5f6a6f', belt: '#3a2f25', satchel: true },
  kvc1938w: { body: 'f', top: { color: '#556167', style: 'tunic' }, bottom: { color: '#4f5a5f', style: 'trousers' }, hat: 'cap', hatColor: '#4d585d', hair: 'bob', shoes: '#2a2724', legwrap: '#5f6a6f', belt: '#3a2f25', satchel: true },
  kla1940: { top: { color: '#8a7d55', style: 'tunic' }, bottom: { color: '#7f7350', style: 'trousers' }, hat: 'cap', hatColor: '#7d714c', hair: 'short', shoes: '#3a2f25', legwrap: '#8d8260', belt: '#5a4632' },
  kla1940w: { body: 'f', top: { color: '#8a7d55', style: 'tunic' }, bottom: { color: '#7f7350', style: 'trousers' }, hat: 'cap', hatColor: '#7d714c', hair: 'bob', shoes: '#3a2f25', legwrap: '#8d8260', belt: '#5a4632' },
  kla_jungle: { top: { color: '#5d6a45', style: 'tunic' }, bottom: { color: '#57643f', style: 'trousers' }, hat: 'slouch', hatColor: '#5f6a48', hair: 'short', shoes: '#3a2f25', legwrap: '#66704c', belt: '#4a3a2a', satchel: true },
  british_ind: { top: { color: '#5a6844', style: 'tunic' }, bottom: { color: '#55623f', style: 'trousers' }, hat: 'turban', hatColor: '#6a7450', hair: 'short', shoes: '#3a2f25', legwrap: '#66704c', belt: '#4a3a2a', skin: '#a8754e' },
  oss: { top: { color: '#7c7552', style: 'tunic' }, bottom: { color: '#6f6a4c', style: 'trousers' }, hat: 'cap', hatColor: '#6d6a4e', hair: 'short', shoes: '#4a3a2a', belt: '#5a4632', skin: '#e9c7a8' },
  officer_civ: { top: { color: '#2c2d31', style: 'tunic' }, bottom: { color: '#2c2d31', style: 'trousers' }, coat: '#2f3034', hat: 'fedora', hatColor: '#26272a', hair: 'short', shoes: '#151413' },
  conscript_deserter: { top: { color: '#7c7451', style: 'tunic' }, bottom: { color: '#736c4d', style: 'trousers' }, hat: 'none', hair: 'short', shoes: '#3a2f25', legwrap: '#857d5b', belt: '#4a3a2a' },
  // Japanese forces (opponents), by period
  jp_gendarme1910: { top: { color: '#2b2e33', style: 'tunic' }, bottom: { color: '#2b2e33', style: 'trousers' }, hat: 'kepi', hatColor: '#2b2e33', hatBand: '#3d3f45', hair: 'short', shoes: '#151413', belt: '#3a3027', armband: '#c8c2b0', enemy: true },
  jp_police1919: { top: { color: '#23262c', style: 'tunic' }, bottom: { color: '#23262c', style: 'trousers' }, hat: 'kepi', hatColor: '#23262c', hatBand: '#3f4148', hair: 'short', shoes: '#151413', belt: '#3a3027', enemy: true },
  jp_army1920: { top: { color: '#7e7353', style: 'tunic' }, bottom: { color: '#7a6f50', style: 'trousers' }, hat: 'kepi', hatColor: '#7a6f50', hatBand: '#8a3a2c', hair: 'short', shoes: '#3a2f25', legwrap: '#857a58', belt: '#4a3a2a', pack: 'square', enemy: true },
  jp_army1930: { top: { color: '#7a7350', style: 'tunic' }, bottom: { color: '#756e4c', style: 'trousers' }, hat: 'helmet', hatColor: '#5f5c45', hair: 'short', shoes: '#3a2f25', legwrap: '#7f7856', belt: '#4a3a2a', pack: 'square', enemy: true },
  jp_army1940: { top: { color: '#76704e', style: 'tunic' }, bottom: { color: '#706a4a', style: 'trousers' }, hat: 'fieldcap', hatColor: '#6f6a49', hair: 'short', shoes: '#3a2f25', legwrap: '#7a7454', belt: '#4a3a2a', pack: 'square', enemy: true },
  jp_jungle1944: { top: { color: '#6b6a47', style: 'tunic' }, bottom: { color: '#646342', style: 'trousers' }, hat: 'helmet', hatColor: '#55573c', hair: 'short', shoes: '#3a2f25', legwrap: '#6d6c4a', belt: '#4a3a2a', pack: 'square', enemy: true, foliage: true },
  bandit: { top: { color: '#5a5048', style: 'padded' }, bottom: { color: '#4a433c', style: 'trousers' }, hat: 'fur', hatColor: '#3a3028', hair: 'short', shoes: '#2a2420', belt: '#3a3027', enemy: true },
  instructor: { top: { color: '#5f5a46', style: 'tunic' }, bottom: { color: '#5a5543', style: 'trousers' }, hat: 'cap', hatColor: '#4f4b3b', hair: 'short', shoes: '#3a2f25', legwrap: '#6d6852', belt: '#4a3a2a' },
  sovietRA: { top: { color: '#6c6a4f', style: 'tunic' }, bottom: { color: '#5d5b45', style: 'trousers' }, hat: 'budenovka', hatColor: '#5c5a46', hair: 'short', shoes: '#2a2420', belt: '#3a3027', enemy: true },
};

const WEAPONS = {
  rifle_old: { len: 1.28, stock: '#6b4a2f', metal: '#3a3a3a' },  // Murata-type single-shot / old repeaters
  rifle: { len: 1.3, stock: '#6e4c30', metal: '#2f3133' },       // Mosin-Nagant type (1920) / Mauser types
  rifle_jp: { len: 1.27, stock: '#7a5636', metal: '#2f3133' },    // Arisaka type
  carbine: { len: 0.9, stock: '#6a4a30', metal: '#2a2c2e' },      // M1 carbine (OSS training, 1945)
  pistol: { len: 0.25, stock: '#3a3a3a', metal: '#2a2a2a' },
  drill: { len: 1.2, stock: '#8a6a45', metal: '#8a6a45' },        // wooden training rifle
};

function rifleGeo(kind) {
  const w = WEAPONS[kind] || WEAPONS.rifle, B = new GeoBuilder();
  if (kind === 'pistol') { B.box(0.035, 0.12, 0.05, w.stock, 0, -0.04, 0); B.box(0.03, 0.035, 0.18, w.metal, 0, 0.03, 0.06); return B.build(); }
  const L = w.len;
  B.box(0.045, 0.09, L * 0.62, w.stock, 0, -0.01, -L * 0.12);                 // stock + forend
  B.box(0.04, 0.13, 0.22, w.stock, 0, -0.06, -L * 0.42, 0.18, 0, 0);          // butt
  B.cyl(0.011, 0.013, L * 0.55, 5, w.metal, 0, 0.035, L * 0.22, Math.PI / 2, 0, 0); // barrel
  B.box(0.03, 0.035, 0.18, w.metal, 0, 0.045, -0.02);                          // receiver
  if (kind !== 'drill' && kind !== 'carbine') B.cyl(0.006, 0.006, 0.06, 4, w.metal, 0.035, 0.05, 0.0, 0, 0, Math.PI / 2); // bolt handle
  if (kind === 'carbine') B.box(0.03, 0.08, 0.06, w.metal, 0, -0.06, 0.05);    // magazine
  B.box(0.012, 0.015, 0.012, w.metal, 0, 0.055, L * 0.48);                     // front sight
  return B.build();
}

function shade(hex, k) { const c = new THREE.Color(hex); c.multiplyScalar(k); return '#' + c.getHexString(); }
function limb(B, len, r0, r1, color, seg = 6) { B.cyl(r1, r0, len, seg, color, 0, -len / 2, 0); }

export class Character {
  constructor(outfitKey, opts = {}) {
    const o = typeof outfitKey === 'string' ? (OUTFITS[outfitKey] || OUTFITS.settler_m) : outfitKey;
    this.outfit = o;
    this.female = o.body === 'f';
    this.scale = (o.scale || 1) * (opts.scale || 1) * (this.female ? 0.95 : 1);
    this.skin = o.skin || opts.skin || SK[(opts.seed || 0) % SK.length];
    this.weaponKind = opts.weapon ?? 'none';
    this.root = new THREE.Group();
    this.body = new THREE.Group(); this.root.add(this.body); // body pivot used for falling
    this.root.scale.setScalar(this.scale);
    this.meshes = [];
    this._build(o);
    this.phase = Math.random() * 6;
    this.p = { hipY: 0.95, lean: 0, crouch: 0, aim: 0, carry: 0, kneel: 0, down: 0, armSwing: 0, legAmp: 0, reload: 0, recoil: 0, melee: 0, wave: 0, treat: 0, flinch: 0, sit: 0, cover: 0, signal: 0 };
    this.stepCb = null;
    this.lastStepSide = 0;
    this.headYaw = 0;
    this.aimPitch = 0;
    this.weaponMode = this.weaponKind === 'none' ? 'none' : 'slung';
    this._placeWeapon();
  }

  _mesh(B, parent, name) {
    const geo = B.build();
    const m = new THREE.Mesh(geo, BODY_MAT); m.castShadow = true; m.receiveShadow = false; m.name = name;
    parent.add(m);
    if (OUTLINES) { smoothNormals(geo); const ol = new THREE.Mesh(geo, OUTLINE); ol.name = name + '_ol'; parent.add(ol); this.meshes.push(ol); }
    this.meshes.push(m);
    return m;
  }
  _pivot(parent, x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }

  _build(o) {
    const F = this.female;
    const topC = o.top.color, botC = o.bottom.color, skin = this.skin;
    const hipW = F ? 0.12 : 0.11;
    this.hips = this._pivot(this.body, 0, 0.95, 0);
    // pelvis
    let B = new GeoBuilder();
    B.box(0.32, 0.18, 0.2, o.bottom.style === 'chima' ? botC : botC, 0, -0.02, 0);
    if (o.belt) B.box(0.34, 0.05, 0.22, o.belt, 0, 0.08, 0);
    if (o.coat) { B.cyl(0.2, 0.28, 0.55, 7, o.coat, 0, -0.3, 0); } // durumagi / long coat skirt
    if (o.bottom.style === 'chima') B.cyl(0.17, 0.33, 0.85, 8, botC, 0, -0.42, 0);
    if (o.top.style === 'padded' || o.top.style === 'tunic') B.cyl(0.19, 0.21, 0.2, 7, topC, 0, 0.0, 0); // jacket hem
    this._mesh(B, this.hips, 'pelvis');
    // legs
    this.legs = [];
    for (const s of [-1, 1]) {
      const thigh = this._pivot(this.hips, s * hipW, -0.04, 0);
      B = new GeoBuilder();
      const baggy = o.bottom.style === 'baji';
      limb(B, 0.45, baggy ? 0.1 : 0.075, baggy ? 0.085 : 0.065, botC);
      this._mesh(B, thigh, 'thigh');
      const shin = this._pivot(thigh, 0, -0.45, 0);
      B = new GeoBuilder();
      limb(B, 0.43, 0.06, 0.05, o.legwrap || botC);
      if (o.legwrap) for (let i = 0; i < 3; i++) B.box(0.118, 0.01, 0.118, shade(o.legwrap, 0.88), 0, -0.1 - i * 0.1, 0, 0, 0, 0.18);
      B.box(0.1, 0.07, 0.22, o.shoes || '#333', 0, -0.44, 0.04);
      this._mesh(B, shin, 'shin');
      if (o.bottom.style === 'chima') { thigh.visible = true; }
      this.legs.push({ thigh, shin, side: s });
    }
    // spine / chest
    this.spine = this._pivot(this.hips, 0, 0.08, 0);
    this.chest = this._pivot(this.spine, 0, 0.2, 0);
    B = new GeoBuilder();
    const chestW = F ? 0.32 : 0.36;
    B.cyl(chestW / 2 + 0.02, chestW / 2 - 0.01, 0.42, 7, topC, 0, 0.08, 0);
    B.box(chestW + 0.04, 0.12, 0.22, topC, 0, 0.25, 0); // shoulders
    if (o.top.style === 'jeogori') { B.box(0.05, 0.3, 0.02, '#ffffff', 0.05, 0.12, 0.17, 0, 0, 0.5); B.box(0.08, 0.03, 0.02, '#8a3a3a', 0.06, 0.05, 0.18); } // collar band & goreum
    if (o.top.style === 'tunic') { for (let i = 0; i < 4; i++) B.box(0.025, 0.025, 0.02, '#c9b98a', 0, 0.26 - i * 0.09, 0.19); B.box(0.18, 0.06, 0.2, topC, 0, 0.32, 0.02); }
    if (o.top.style === 'padded') { for (let i = 0; i < 3; i++) B.box(chestW + 0.05, 0.02, 0.23, shade(topC, 0.85), 0, -0.05 + i * 0.12, 0); }
    if (o.coat) B.cyl(chestW / 2 + 0.04, chestW / 2 + 0.03, 0.4, 7, o.coat, 0, 0.08, 0);
    if (o.bandolier) B.box(0.06, 0.55, 0.24, '#5a4a32', 0, 0.1, 0.0, 0, 0, 0.75);
    if (o.satchel) { B.box(0.04, 0.6, 0.23, '#5a4a32', 0, 0.12, 0, 0, 0, -0.7); B.box(0.24, 0.2, 0.08, '#6b5538', -0.22, -0.18, 0.12); }
    if (o.medbag) { B.box(0.04, 0.6, 0.23, '#5a4a32', 0, 0.12, 0, 0, 0, 0.7); B.box(0.26, 0.22, 0.1, '#d9d3c2', 0.22, -0.18, 0.1); B.box(0.12, 0.03, 0.11, '#9a2d2d', 0.22, -0.16, 0.15); B.box(0.03, 0.12, 0.11, '#9a2d2d', 0.22, -0.16, 0.15); }
    if (o.pack === 'roll') B.cyl(0.08, 0.08, 0.5, 6, '#7a7058', 0, 0.3, -0.18, 0, 0, Math.PI / 2);
    if (o.pack === 'square') B.box(0.3, 0.3, 0.14, '#6a5e42', 0, 0.12, -0.2);
    if (o.pack === 'bundle') B.sphere(0.2, 7, 5, '#a89a7a', 0, 0.15, -0.22, 1.2, 1, 0.8);
    if (o.pack === 'jige') { B.box(0.04, 0.9, 0.04, '#6b5539', -0.15, 0.1, -0.22); B.box(0.04, 0.9, 0.04, '#6b5539', 0.15, 0.1, -0.22); B.box(0.35, 0.35, 0.25, '#9a8a6a', 0, 0.3, -0.33); }
    if (F && o.top.style !== 'padded') B.box(0.26, 0.08, 0.06, topC, 0, 0.12, 0.15);
    this._mesh(B, this.chest, 'chest');
    // neck/head
    this.neck = this._pivot(this.chest, 0, 0.33, 0);
    this.head = this._pivot(this.neck, 0, 0.06, 0);
    B = new GeoBuilder();
    B.cyl(0.05, 0.055, 0.08, 6, skin, 0, -0.02, 0);
    B.ico(0.115, 1, skin, 0, 0.13, 0.0, 0.92, 1.08, 1.0);
    B.box(0.022, 0.012, 0.01, '#1c1612', -0.04, 0.15, 0.105); B.box(0.022, 0.012, 0.01, '#1c1612', 0.04, 0.15, 0.105); // eyes
    B.box(0.035, 0.008, 0.01, '#3a2a1e', -0.04, 0.175, 0.103); B.box(0.035, 0.008, 0.01, '#3a2a1e', 0.04, 0.175, 0.103); // brows
    B.box(0.02, 0.035, 0.02, skin, 0, 0.12, 0.115); // nose
    const hair = '#1d1915';
    if (o.hair === 'topknot') { B.ico(0.118, 1, hair, 0, 0.17, -0.01, 0.95, 0.7, 1.0); B.sphere(0.04, 6, 4, hair, 0, 0.27, -0.01); }
    else if (o.hair === 'bun') { B.ico(0.12, 1, hair, 0, 0.165, -0.015, 0.97, 0.75, 1.02); B.sphere(0.055, 6, 5, hair, 0, 0.12, -0.13); }
    else if (o.hair === 'braid') { B.ico(0.118, 1, hair, 0, 0.17, -0.01, 0.95, 0.72, 1.0); B.box(0.04, 0.3, 0.04, hair, 0, -0.03, -0.12); }
    else if (o.hair === 'bob') { B.ico(0.125, 1, hair, 0, 0.15, -0.015, 1.0, 0.85, 1.04); }
    else B.ico(0.118, 1, hair, 0, 0.175, -0.012, 0.95, 0.66, 0.98);
    const hc = o.hatColor || '#2a2622';
    switch (o.hat) {
      case 'gat': B.cyl(0.24, 0.24, 0.012, 14, '#15120f', 0, 0.24, 0); B.cyl(0.075, 0.09, 0.14, 10, '#15120f', 0, 0.31, 0); break;
      case 'cap': B.cyl(0.12, 0.125, 0.07, 10, hc, 0, 0.25, 0); B.box(0.16, 0.012, 0.07, '#1d1b18', 0, 0.22, 0.11); break;
      case 'kepi': B.cyl(0.12, 0.122, 0.1, 10, hc, 0, 0.26, 0); B.cyl(0.123, 0.123, 0.03, 10, o.hatBand || hc, 0, 0.23, 0); B.box(0.15, 0.012, 0.07, '#141210', 0, 0.21, 0.11); break;
      case 'fieldcap': B.cyl(0.12, 0.125, 0.08, 10, hc, 0, 0.25, 0); B.box(0.15, 0.012, 0.06, hc, 0, 0.22, 0.11); B.box(0.2, 0.1, 0.02, hc, 0, 0.12, -0.11); break;
      case 'helmet': B.sphere(0.14, 10, 6, hc, 0, 0.2, 0, 1, 0.8, 1.05); B.cyl(0.15, 0.15, 0.015, 12, hc, 0, 0.18, 0); if (o.foliage) for (let i = 0; i < 5; i++) B.box(0.03, 0.12, 0.08, '#4d6a2c', Math.cos(i * 1.3) * 0.12, 0.28, Math.sin(i * 1.3) * 0.12, 0.3, i, 0); break;
      case 'fur': B.cyl(0.13, 0.135, 0.12, 9, hc, 0, 0.24, 0); B.box(0.06, 0.12, 0.1, hc, -0.13, 0.13, 0); B.box(0.06, 0.12, 0.1, hc, 0.13, 0.13, 0); break;
      case 'towel': B.cyl(0.125, 0.127, 0.05, 10, hc, 0, 0.2, 0); break; // white headband (tti)
      case 'scarf': B.ico(0.13, 1, hc, 0, 0.16, -0.01, 1.0, 0.85, 1.05); B.box(0.12, 0.12, 0.04, hc, 0, 0.05, -0.1); break;
      case 'fedora': B.cyl(0.18, 0.18, 0.012, 12, hc, 0, 0.22, 0); B.cyl(0.1, 0.115, 0.11, 10, hc, 0, 0.28, 0); break;
      case 'slouch': B.cyl(0.22, 0.22, 0.012, 12, hc, 0, 0.22, 0, 0, 0, 0.12); B.cyl(0.1, 0.12, 0.1, 10, hc, 0, 0.27, 0); break;
      case 'turban': B.ico(0.14, 1, hc, 0, 0.21, 0, 1.0, 0.75, 1.05); break;
      case 'budenovka': B.cone(0.13, 0.2, 9, hc, 0, 0.3, 0); B.box(0.2, 0.1, 0.03, hc, 0, 0.13, -0.11); break;
      default: break;
    }
    this._mesh(B, this.head, 'head');
    // arms
    this.arms = [];
    for (const s of [-1, 1]) {
      const sh = this._pivot(this.chest, s * (chestW / 2 + 0.03), 0.25, 0);
      B = new GeoBuilder();
      const sleeve = o.coat || topC;
      limb(B, 0.29, 0.06, 0.05, sleeve);
      if (o.armband && s < 0) B.cyl(0.062, 0.062, 0.06, 6, o.armband, 0, -0.1, 0);
      this._mesh(B, sh, 'upperarm');
      const fore = this._pivot(sh, 0, -0.29, 0);
      B = new GeoBuilder();
      limb(B, 0.26, 0.048, 0.042, sleeve);
      B.box(0.06, 0.085, 0.045, skin, 0, -0.3, 0.0);
      this._mesh(B, fore, 'forearm');
      const hand = this._pivot(fore, 0, -0.31, 0);
      this.arms.push({ sh, fore, hand, side: s });
    }
    // weapon
    if (this.weaponKind !== 'none') {
      this.weapon = new THREE.Group();
      const g = rifleGeo(this.weaponKind);
      const m = new THREE.Mesh(g, BODY_MAT); m.castShadow = true; this.weapon.add(m);
      if (OUTLINES) { smoothNormals(g); this.weapon.add(new THREE.Mesh(g, OUTLINE)); }
      this.muzzle = new THREE.Object3D(); this.muzzle.position.set(0, 0.035, (WEAPONS[this.weaponKind]?.len || 1) * 0.5); this.weapon.add(this.muzzle);
      this.chest.add(this.weapon);
    }
    // carried item slot (documents bundle, supply sack, crate)
    this.carrySlot = this._pivot(this.chest, 0, 0.1, -0.25);
  }

  setWeapon(kind) {
    if (this.weapon) { this.chest.remove(this.weapon); this.weapon = null; }
    this.weaponKind = kind;
    if (kind && kind !== 'none') {
      this.weapon = new THREE.Group();
      const g = rifleGeo(kind); const m = new THREE.Mesh(g, BODY_MAT); m.castShadow = true; this.weapon.add(m);
      if (OUTLINES) { smoothNormals(g); this.weapon.add(new THREE.Mesh(g, OUTLINE)); }
      this.muzzle = new THREE.Object3D(); this.muzzle.position.set(0, 0.035, (WEAPONS[kind]?.len || 1) * 0.5); this.weapon.add(this.muzzle);
      this.chest.add(this.weapon);
      this.weaponMode = 'slung';
    } else this.weaponMode = 'none';
    this._placeWeapon();
  }
  setWeaponMode(mode) { if (this.weapon && mode !== this.weaponMode) { this.weaponMode = mode; this._placeWeapon(); } }
  _placeWeapon() {
    if (!this.weapon) return;
    const w = this.weapon;
    if (this.weaponMode === 'slung') { w.position.set(0.05, 0.1, -0.17); w.rotation.set(-Math.PI / 2 + 0.25, 0, 0.6); }
    else { w.position.set(0.08, 0.04, 0.22); w.rotation.set(0.35, -0.12, 0); }
  }
  setCarryItem(kind) {
    while (this.carrySlot.children.length) this.carrySlot.remove(this.carrySlot.children[0]);
    if (!kind) return;
    const B = new GeoBuilder();
    if (kind === 'sack') B.sphere(0.22, 7, 5, '#b5a67e', 0, 0.05, -0.05, 1.2, 0.9, 0.85);
    else if (kind === 'crate') B.box(0.5, 0.35, 0.35, '#7d6243', 0, 0.1, -0.05);
    else if (kind === 'docs') B.box(0.22, 0.05, 0.3, '#d6c9a6', 0.15, -0.15, 0.32);
    else if (kind === 'ammo') B.box(0.4, 0.25, 0.25, '#5d5a3c', 0, 0.05, -0.05);
    else if (kind === 'radio') B.box(0.38, 0.4, 0.22, '#4a4f3c', 0, 0.05, -0.05);
    const m = new THREE.Mesh(B.build(), BODY_MAT); m.castShadow = true; this.carrySlot.add(m);
  }
  muzzleWorld(v = new THREE.Vector3()) {
    if (this.muzzle) return this.muzzle.getWorldPosition(v);
    return this.chest.getWorldPosition(v);
  }

  // s: {speed, crouch, aim, carry, down, kneel, treat, reload, recoil, melee, wave, sit, cover, signal, flinch, pitch, headYaw, ground (dy slope)}
  update(dt, s) {
    const p = this.p, sp = s.speed || 0;
    const tgt = (k, v, rate = 10) => (p[k] = damp(p[k], v, rate, dt));
    tgt('crouch', s.crouch ? 1 : 0, 9); tgt('aim', s.aim ? 1 : 0, 14); tgt('carry', s.carry ? 1 : 0, 8);
    tgt('down', s.down ? 1 : 0, s.down ? 5 : 3); tgt('kneel', s.kneel || s.treat ? 1 : 0, 8); tgt('treat', s.treat ? 1 : 0, 8);
    tgt('sit', s.sit ? 1 : 0, 6); tgt('wave', s.wave ? 1 : 0, 6); tgt('cover', s.cover ? 1 : 0, 8); tgt('signal', s.signal ? 1 : 0, 10);
    tgt('reload', s.reload ? 1 : 0, 10); tgt('melee', s.melee ? 1 : 0, 22);
    p.recoil = Math.max(0, p.recoil - dt * 6); if (s.recoil) p.recoil = 1;
    p.flinch = Math.max(0, p.flinch - dt * 4); if (s.flinch) p.flinch = 1;
    // gait
    const moving = sp > 0.15 && p.down < 0.5;
    const freq = sp < 2.2 ? 1.75 + sp * 0.35 : 2.4 + (sp - 2.2) * 0.22;
    if (moving) this.phase += dt * freq * Math.PI * (1 - p.crouch * 0.2);
    tgt('legAmp', moving ? clamp(0.25 + sp * 0.12, 0, 0.75) * (1 - p.crouch * 0.35) : 0, 8);
    const ph = this.phase, A = p.legAmp;
    // footstep callback at contact
    const side = Math.sin(ph) > 0 ? 1 : -1;
    if (moving && side !== this.lastStepSide) { this.lastStepSide = side; this.stepCb?.(side); }
    const run = clamp((sp - 2.6) / 2.5, 0, 1);
    // hips
    const bob = moving ? Math.abs(Math.cos(ph)) * 0.035 * (1 + run) : Math.sin(performance.now() / 900) * 0.006;
    let hipY = 0.95 - p.crouch * 0.33 - p.kneel * 0.42 - p.sit * 0.5 + bob;
    this.hips.position.y = hipY;
    this.hips.position.z = -p.kneel * 0.05;
    this.hips.rotation.y = moving ? Math.sin(ph) * 0.08 : 0;
    // legs
    for (const L of this.legs) {
      const lp = ph + (L.side > 0 ? 0 : Math.PI);
      let th = -Math.sin(lp) * A, kn = Math.max(0, Math.sin(lp - 1.2)) * A * 1.6 + 0.05;
      th += -p.crouch * 1.0; kn += p.crouch * 1.55;
      if (p.kneel > 0.01) { // one knee down
        const kth = L.side > 0 ? -1.45 : -0.25, kkn = L.side > 0 ? 1.45 : 1.9;
        th = lerp(th, kth, p.kneel); kn = lerp(kn, kkn, p.kneel);
      }
      if (p.sit > 0.01) { th = lerp(th, -1.5, p.sit); kn = lerp(kn, 1.5, p.sit); }
      L.thigh.rotation.x = th; L.shin.rotation.x = kn;
      L.thigh.rotation.z = L.side * 0.03;
    }
    // torso
    const lean = clamp(sp * 0.035, 0, 0.25) + p.crouch * 0.35 + p.carry * 0.25 + p.treat * 0.45 - p.aim * 0.05 + p.flinch * -0.2;
    this.spine.rotation.x = lean;
    this.spine.rotation.y = moving ? -Math.sin(ph) * 0.1 * (1 - p.aim) : 0;
    this.spine.rotation.z = Math.sin(performance.now() / 1300) * 0.01;
    this.chest.rotation.x = -p.aim * (this.aimPitch * 0.8) - p.recoil * 0.06;
    this.chest.rotation.y = p.aim * 0.35 + p.melee * -0.6;
    this.neck.rotation.x = -lean * 0.6 + p.aim * this.aimPitch * 0.3 - p.treat * -0.2;
    this.neck.rotation.y = clamp(this.headYaw - p.aim * 0.35, -1.1, 1.1);
    // arms
    const armed = this.weaponMode === 'ready';
    for (const a of this.arms) {
      const swing = moving ? Math.sin(ph + (a.side > 0 ? Math.PI : 0)) * A * 0.9 : 0;
      let ux = swing, uz = a.side * 0.08, fx = -0.25 - Math.max(0, -swing) * 0.4, uy = 0;
      if (armed) {
        const R = a.side > 0;
        // low ready
        ux = R ? -0.55 : -0.95; uz = R ? 0.25 : -0.45; uy = R ? 0 : 0.2; fx = R ? -1.15 : -0.85;
        // aim (shoulder mount)
        ux = lerp(ux, R ? -1.25 : -1.45, p.aim); uz = lerp(uz, R ? 0.55 : -0.25, p.aim); fx = lerp(fx, R ? -1.4 : -0.35, p.aim);
        if (p.reload > 0.01 && !R) { ux = lerp(ux, -0.6, p.reload); fx = lerp(fx, -1.9 + Math.sin(performance.now() / 90) * 0.15, p.reload); uz = lerp(uz, -0.1, p.reload); }
      }
      if (p.carry > 0.01) { ux = lerp(ux, a.side > 0 ? -2.6 : -0.7, p.carry); fx = lerp(fx, a.side > 0 ? -1.0 : -1.6, p.carry); uz = lerp(uz, a.side * 0.15, p.carry); }
      if (p.treat > 0.01) { ux = lerp(ux, -1.0 + Math.sin(performance.now() / 160 + a.side) * 0.15, p.treat); fx = lerp(fx, -1.2, p.treat); uz = lerp(uz, -a.side * 0.2, p.treat); }
      if (p.wave > 0.01 && a.side > 0) { ux = lerp(ux, -2.7, p.wave); fx = lerp(fx, -0.3 + Math.sin(performance.now() / 150) * 0.4, p.wave); uz = lerp(uz, 0.3, p.wave); }
      if (p.signal > 0.01 && a.side > 0) { ux = lerp(ux, -2.9, p.signal); fx = lerp(fx, -0.1, p.signal); }
      if (p.melee > 0.01) { const R = a.side > 0; ux = lerp(ux, R ? -1.9 : -1.6, p.melee); fx = lerp(fx, -0.4, p.melee); }
      a.sh.rotation.set(ux, uy, uz);
      a.fore.rotation.x = fx;
    }
    // rifle follows aim pitch
    if (this.weapon && armed) {
      this.weapon.position.set(lerp(0.08, 0.16, p.aim), lerp(0.04, 0.2, p.aim) - p.recoil * 0.02, lerp(0.22, 0.26, p.aim) - p.recoil * 0.05);
      this.weapon.rotation.set(lerp(0.35, 0.0, p.aim) - p.recoil * 0.12 + p.reload * 0.5 - p.melee * 0.8, lerp(-0.12, -0.35, p.aim) + p.melee * 0.6, p.reload * 0.4);
    }
    // falling / lying down (wounded or incapacitated)
    if (p.down > 0.001) {
      this.body.rotation.x = -p.down * 1.45;
      this.body.position.y = p.down * 0.16;
      this.body.position.z = p.down * 0.45;
      this.hips.position.y = lerp(this.hips.position.y, 0.6, p.down);
      for (const L of this.legs) { L.thigh.rotation.x = lerp(L.thigh.rotation.x, L.side * 0.15, p.down); L.shin.rotation.x = lerp(L.shin.rotation.x, 0.3 + (L.side > 0 ? 0.5 : 0), p.down); }
      for (const a of this.arms) { a.sh.rotation.x = lerp(a.sh.rotation.x, a.side > 0 ? -0.3 : -2.4, p.down); a.sh.rotation.z = lerp(a.sh.rotation.z, a.side * 0.5, p.down); }
      this.spine.rotation.x = lerp(this.spine.rotation.x, 0, p.down);
    } else { this.body.rotation.x = 0; this.body.position.set(0, 0, 0); }
  }

  dispose() { this.root.removeFromParent(); }
}

// Carried-on-shoulder transform helper: place `c` (Character) over `carrier` shoulder.
const _v = new THREE.Vector3(), _q2 = new THREE.Quaternion();
export function attachCarried(c, carrier) {
  carrier.chest.getWorldPosition(_v);
  carrier.root.getWorldQuaternion(_q2);
  c.root.position.copy(_v).add(new THREE.Vector3(0, 0.1, 0));
  c.root.quaternion.copy(_q2).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, Math.PI / 2 - 0.15)));
  c.root.translateY(-0.85);
}
