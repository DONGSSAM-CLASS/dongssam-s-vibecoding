import * as THREE from 'three';
import { L, isIndoor } from './layout.js';
import { rayCast } from './collision.js';
import { clamp, rand, rr } from './util.js';

// 악령: 원귀(소복 차림), 도깨비불, 그림자 악령(평소엔 거의 안 보임), 보스 어둑시니
const TYPES = {
  wraith: { name: '원귀', hp: 45, speed: 2.6, dmg: 9, range: 1.7, aggro: 24, radius: 0.5, y: 1.25, atkCd: 1.3 },
  wisp: { name: '도깨비불', hp: 16, speed: 5.2, dmg: 9, range: 0.9, aggro: 30, radius: 0.35, y: 1.6, atkCd: 0.5 },
  shadow: { name: '그림자 악령', hp: 70, speed: 3.3, dmg: 14, range: 1.9, aggro: 28, radius: 0.55, y: 1.15, atkCd: 1.6 },
  boss: { name: '어둑시니', hp: 1100, speed: 2.0, dmg: 16, range: 6, aggro: 999, radius: 2.4, y: 4.2, atkCd: 3 },
};

let geoCache = null;
function geos() {
  if (geoCache) return geoCache;
  // 소복 자락: 아래가 퍼지는 종 모양
  const robePts = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    robePts.push(new THREE.Vector2(0.14 + Math.pow(t, 1.6) * 0.5, 0.6 - t * 1.55));
  }
  const robe = new THREE.LatheGeometry(robePts, 24);
  // 치맛자락 물결
  const p = robe.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y < -0.6) {
      const a = Math.atan2(p.getZ(i), p.getX(i));
      p.setY(i, y + Math.sin(a * 7) * 0.08 * ((-0.6 - y) / 0.35));
    }
  }
  robe.computeVertexNormals();
  const glowC = document.createElement('canvas');
  glowC.width = glowC.height = 64;
  const ctx = glowC.getContext('2d');
  const gr = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gr; ctx.fillRect(0, 0, 64, 64);
  const glow = new THREE.CanvasTexture(glowC);
  geoCache = {
    robe,
    head: new THREE.SphereGeometry(0.15, 16, 12),
    hairCap: new THREE.SphereGeometry(0.165, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.62),
    hairLong: new THREE.PlaneGeometry(0.34, 0.95).translate(0, -0.42, 0),
    eye: new THREE.SphereGeometry(0.022, 8, 6),
    sleeve: new THREE.CylinderGeometry(0.05, 0.11, 0.55, 8).translate(0, -0.27, 0),
    blob: new THREE.IcosahedronGeometry(1, 2),
    glow,
  };
  return geoCache;
}

const _v = new THREE.Vector3(), _d = new THREE.Vector3();

export class Ghost {
  constructor(game, type, pos) {
    this.g = game;
    this.type = type;
    const T = (this.T = TYPES[type]);
    this.maxHp = T.hp * (type === 'boss' ? 1 : 1 + game.relics.owned.size * 0.08);
    this.hp = this.maxHp;
    this.radius = T.radius;
    this.pos = pos.clone();
    this.pos.y = T.y;
    this.vel = new THREE.Vector3();
    this.knockV = new THREE.Vector3();
    this.alive = true;
    this.stunT = 0;
    this.slowT = 0;
    this.slowK = 1;
    this.revealT = 0;
    this.atkT = rr(0.5, 1.5);
    this.rangedT = rr(2, 5);
    this.moanT = rr(2, 8);
    this.wander = pos.clone();
    this.wanderT = 0;
    this.hitFlash = 0;
    this.phase = rand() * 10;
    this.spawnT = 0;
    this.visibleNow = type !== 'shadow';
    this.mesh = this.buildMesh();
    this.mesh.position.copy(this.pos);
    game.scene.add(this.mesh);
    this.bar = this.buildBar();
    if (type === 'boss') {
      this.scaleK = 1;
      this.summonT = 10;
      this.slamT = 6;
      this.mesh.scale.setScalar(0.01);
    }
  }

  buildMesh() {
    const G = geos();
    const grp = new THREE.Group();
    this.mats = [];
    const mk = (geo, mat) => { const m = new THREE.Mesh(geo, mat); grp.add(m); this.mats.push(mat); return m; };
    if (this.type === 'wraith' || this.type === 'shadow') {
      const sh = this.type === 'shadow';
      const robeMat = new THREE.MeshStandardMaterial({
        color: sh ? 0x050508 : 0xe8eef6, emissive: sh ? 0x12001c : 0x7e95b8, emissiveIntensity: sh ? 0.5 : 0.35,
        transparent: true, opacity: sh ? 0.05 : 0.78, roughness: 0.9, side: THREE.DoubleSide, depthWrite: false,
      });
      const robe = mk(G.robe, robeMat);
      robe.position.y = -0.05;
      for (const s of [-1, 1]) {
        const sl = mk(G.sleeve, robeMat);
        sl.position.set(s * 0.2, 0.5, 0.05);
        sl.rotation.set(-0.9, 0, s * 0.35);
        sl.userData.arm = s;
      }
      const headMat = new THREE.MeshStandardMaterial({ color: sh ? 0x000000 : 0xdfe6ea, emissive: sh ? 0x000000 : 0x5a6a80, emissiveIntensity: 0.4, transparent: true, opacity: sh ? 0.05 : 0.9, depthWrite: false });
      const head = mk(G.head, headMat);
      head.position.y = 0.78;
      const hairMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.6, transparent: true, opacity: sh ? 0.05 : 0.95, side: THREE.DoubleSide, depthWrite: !sh });
      const cap = mk(G.hairCap, hairMat);
      cap.position.y = 0.8;
      cap.rotation.x = -0.25;
      const hb = mk(G.hairLong, hairMat);
      hb.position.set(0, 0.86, -0.17);
      hb.renderOrder = 1;
      if (!sh) {
        // 얼굴을 가리는 앞머리
        for (const s of [-1, 1]) {
          const hf = mk(G.hairLong, hairMat);
          hf.scale.set(0.45, 0.8, 1);
          hf.position.set(s * 0.085, 0.88, 0.2);
          hf.rotation.y = s * 0.3;
        }
      }
      const eyeMat = new THREE.MeshBasicMaterial({ color: sh ? 0xffd040 : 0xff3020, transparent: true, opacity: 1 });
      for (const s of [-1, 1]) {
        const e = mk(G.eye, eyeMat);
        e.position.set(s * 0.05, 0.8, sh ? 0.135 : 0.215);
      }
      this.eyeMat = eyeMat;
      this.bodyMats = [robeMat, headMat, hairMat];
      this.baseOpacity = [robeMat.opacity, headMat.opacity, hairMat.opacity];
      if (sh) this.baseOpacity = [0.88, 0.95, 0.95];
    } else if (this.type === 'wisp') {
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), new THREE.MeshBasicMaterial({ color: 0xb8fff4 }));
      grp.add(core);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.glow, color: 0x45f0d0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      sp.scale.setScalar(1.3);
      grp.add(sp);
      const sp2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.glow, color: 0x2a80ff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.6 }));
      sp2.scale.setScalar(2.4);
      grp.add(sp2);
      this.sprites = [sp, sp2];
      this.core = core;
    } else if (this.type === 'boss') {
      const dark = new THREE.MeshStandardMaterial({ color: 0x07050c, emissive: 0x3a1066, emissiveIntensity: 0.9, roughness: 1, transparent: true, opacity: 0.94 });
      this.blobs = [];
      for (let i = 0; i < 14; i++) {
        const b = new THREE.Mesh(G.blob, dark);
        const r = i === 0 ? 2.0 : rr(0.7, 1.4);
        b.scale.setScalar(r);
        const a = rand() * Math.PI * 2, e = rr(-0.8, 0.9);
        const d = i === 0 ? 0 : rr(1.0, 2.0);
        b.position.set(Math.cos(a) * Math.cos(e) * d, Math.sin(e) * d, Math.sin(a) * Math.cos(e) * d);
        b.userData.base = b.position.clone();
        b.userData.r = r;
        grp.add(b);
        this.blobs.push(b);
      }
      this.mats.push(dark);
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffe060 });
      const eyeMat2 = new THREE.MeshBasicMaterial({ color: 0xff3a20 });
      this.eyes = [];
      for (let i = 0; i < 22; i++) {
        const e = new THREE.Mesh(G.eye, i % 3 ? eyeMat : eyeMat2);
        const a = rr(-1.3, 1.3), el = rr(-0.6, 0.8);
        const d = 2.05;
        e.position.set(Math.sin(a) * Math.cos(el) * d, Math.sin(el) * d, Math.cos(a) * Math.cos(el) * d);
        e.scale.setScalar(rr(2.5, 6));
        e.scale.y *= 0.55;
        grp.add(e);
        this.eyes.push(e);
      }
      // 촉수 같은 그림자 자락
      this.tendrils = [];
      const tm = new THREE.MeshStandardMaterial({ color: 0x050308, emissive: 0x1a0828, transparent: true, opacity: 0.85 });
      for (let i = 0; i < 8; i++) {
        const t = new THREE.Mesh(new THREE.ConeGeometry(0.35, 4, 6).translate(0, -2, 0), tm);
        const a = (i / 8) * Math.PI * 2;
        t.position.set(Math.cos(a) * 1.4, -1.0, Math.sin(a) * 1.4);
        t.userData.a = a;
        grp.add(t);
        this.tendrils.push(t);
      }
      const l = new THREE.PointLight(0x8a3aff, 30, 25, 2);
      grp.add(l);
      // 어둠 속에서도 형체가 보이도록 보랏빛 기운
      const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.glow, color: 0x7a2ad0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55 }));
      aura.scale.setScalar(11);
      grp.add(aura);
      this.aura = aura;
    }
    if (this.type !== 'wisp' && this.type !== 'boss') {
      grp.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    }
    return grp;
  }

  buildBar() {
    if (this.type === 'boss') return null;
    const bg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x000000, transparent: true, opacity: 0.5, depthTest: true }));
    const fg = new THREE.Sprite(new THREE.SpriteMaterial({ color: this.type === 'shadow' ? 0xc070ff : 0xff6040, depthTest: true }));
    bg.center.set(0, 0.5); fg.center.set(0, 0.5);
    bg.scale.set(0.8, 0.07, 1); fg.scale.set(0.8, 0.05, 1);
    bg.visible = fg.visible = false;
    this.g.scene.add(bg, fg);
    return { bg, fg, show: 0 };
  }

  damage(n, src) {
    if (!this.alive) return;
    let k = 1;
    if (this.type === 'boss') k = 1.4 / this.scaleK;
    // 낮의 햇빛 아래에선 약해짐
    if (this.g.sky.dayFactor > 0.7 && !isIndoor(this.pos.x, this.pos.z) && this.g.weather.cloud < 0.5) k *= 1.2;
    this.hp -= n * k;
    this.hitFlash = 0.15;
    if (this.bar) this.bar.show = 3;
    if (this.type === 'shadow') this.reveal(1.5);
    if (this.hp <= 0) this.die(src);
  }

  knock(dir, f) { if (this.type !== 'boss') this.knockV.addScaledVector(dir, f); }
  stun(t) { if (this.type === 'boss') t *= 0.3; this.stunT = Math.max(this.stunT, t); }
  slowFor(t, k) { this.slowT = Math.max(this.slowT, t); this.slowK = k; }
  reveal(t) { this.revealT = Math.max(this.revealT, t); }

  die() {
    this.alive = false;
    const g = this.g;
    g.fx.purify(this.pos);
    g.audio.at(this.pos.x, this.pos.y, this.pos.z, (d) => g.audio.play('ghostDie', { dest: d }), 6);
    g.audio.play('purify');
    this.dispose();
    g.ghosts.onKilled(this);
  }

  dispose() {
    this.g.scene.remove(this.mesh);
    if (this.bar) this.g.scene.remove(this.bar.bg, this.bar.fg);
  }

  update(dt, t) {
    const g = this.g, P = g.player;
    const T = this.T;
    this.spawnT += dt;
    const playerC = _v.set(P.pos.x, P.pos.y + 1.2, P.pos.z);
    const toP = _d.copy(playerC).sub(this.pos);
    const dist = toP.length();
    toP.normalize();
    let speedK = (g.sky.nightFactor > 0.5 ? 1.2 : 0.9) * (g.relics.timeSlow > 0 ? 0.25 : 1);
    if (this.slowT > 0) { this.slowT -= dt; speedK *= this.slowK; }
    const atkK = g.relics.timeSlow > 0 ? 0.25 : 1;
    this.stunT -= dt;
    this.revealT -= dt;
    this.hitFlash -= dt;
    const repel = P.buffs.juk > 0;

    if (this.type === 'boss') return this.updateBoss(dt, t, dist, toP, speedK, atkK);

    let target = null;
    const aggro = T.aggro * (g.sky.nightFactor > 0.5 ? 1.3 : 1);
    if (!P.dead && dist < aggro && this.spawnT > 1) target = playerC;
    let want = new THREE.Vector3();
    if (this.stunT <= 0) {
      if (target) {
        if (repel && dist < 6) want.copy(toP).multiplyScalar(-T.speed * 0.6);
        else if (dist > T.range * 0.8) want.copy(toP).multiplyScalar(T.speed);
        // 원귀는 옆으로 맴돌기도 함
        if (this.type === 'wraith' && dist < 8) want.add(new THREE.Vector3(-toP.z, 0, toP.x).multiplyScalar(Math.sin(t * 0.7 + this.phase) * 1.2));
      } else {
        this.wanderT -= dt;
        if (this.wanderT <= 0 || this.pos.distanceTo(this.wander) < 1) {
          this.wanderT = rr(3, 7);
          this.wander.set(clamp(this.pos.x + rr(-12, 12), L.bounds.x0, L.bounds.x1), T.y, clamp(this.pos.z + rr(-12, 12), L.bounds.z0, L.bounds.z1));
        }
        want.copy(this.wander).sub(this.pos).setY(0).normalize().multiplyScalar(T.speed * 0.4);
      }
    }
    want.multiplyScalar(speedK);
    this.vel.lerp(want, Math.min(1, dt * 3));
    this.knockV.multiplyScalar(Math.exp(-dt * 4));
    this.pos.addScaledVector(this.vel, dt).addScaledVector(this.knockV, dt);
    // 높이: 떠다님
    const baseY = T.y + Math.sin(t * 1.7 + this.phase) * 0.12 + (this.type === 'wisp' ? Math.sin(t * 3 + this.phase) * 0.4 : 0);
    const targetY = target && this.type === 'wisp' ? playerC.y : baseY + (P.pos.y > 1 && dist < 10 ? P.pos.y * 0.8 : 0);
    this.pos.y += (targetY - this.pos.y) * Math.min(1, dt * 2);
    this.pos.x = clamp(this.pos.x, L.bounds.x0 - 2, L.bounds.x1 + 2);
    this.pos.z = clamp(this.pos.z, L.bounds.z0 - 2, L.bounds.z1 + 2);

    // 공격
    this.atkT -= dt * atkK;
    if (target && this.stunT <= 0 && !repel) {
      if (dist < T.range + 0.4 && this.atkT <= 0) {
        this.atkT = T.atkCd;
        P.damage(T.dmg, this);
        g.audio.at(this.pos.x, this.pos.y, this.pos.z, (d) => g.audio.play('ghostAttack', { dest: d }));
        if (this.type === 'wisp') { this.hp = 0; this.die(); return; }
        this.lunge = 0.3;
      }
      // 원귀의 원한 구슬
      if (this.type === 'wraith') {
        this.rangedT -= dt * atkK;
        if (this.rangedT <= 0 && dist > 5 && dist < 16) {
          this.rangedT = rr(4, 7);
          g.ghosts.shoot(this.pos.clone().add(new THREE.Vector3(0, 0.5, 0)), toP.clone().multiplyScalar(7), 7, 0xb04aff);
        }
      }
      // 그림자 악령: 가끔 뒤로 순간이동
      if (this.type === 'shadow' && dist < 14 && rand() < dt * 0.08) {
        const back = P.forward(new THREE.Vector3()).setY(0).normalize().multiplyScalar(-3);
        this.pos.set(P.pos.x + back.x, T.y, P.pos.z + back.z);
        g.fx.smokePuff(this.pos, 0x111111, 10, 1, 0.5, 1.5, 1.4, 0.6);
      }
    }
    // 신음 소리
    this.moanT -= dt;
    if (this.moanT <= 0) {
      this.moanT = rr(5, 12);
      if (dist < 30) g.audio.ghostMoan(this.pos.x, this.pos.y, this.pos.z, this.type);
    }
    this.updateVisual(dt, t, toP, dist);
  }

  updateVisual(dt, t, toP, dist) {
    const g = this.g, P = g.player;
    const m = this.mesh;
    m.position.copy(this.pos);
    if (this.lunge > 0) { this.lunge -= dt; m.position.addScaledVector(toP, Math.sin(this.lunge / 0.3 * Math.PI) * 0.5); }
    const yaw = Math.atan2(toP.x, toP.z);
    m.rotation.y = yaw;
    m.rotation.z = Math.sin(t * 1.3 + this.phase) * 0.06;
    if (this.stunT > 0) m.rotation.z += Math.sin(t * 20) * 0.08;

    if (this.type === 'wisp') {
      const f = 0.8 + Math.sin(t * 17 + this.phase) * 0.15 + Math.random() * 0.1;
      this.sprites[0].scale.setScalar(1.1 * f);
      this.sprites[1].scale.setScalar(2.2 * f);
      if (Math.random() < 0.5) g.fx.trail(this.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.2, 0, (Math.random() - 0.5) * 0.2)), 0x40e8d0, 0.35, 0.6);
    } else {
      // 팔이 앞으로 뻗음
      for (const c of m.children) if (c.userData.arm) c.rotation.x = -0.9 - (dist < 4 ? 0.5 : 0) + Math.sin(t * 2 + c.userData.arm) * 0.1;
      // 그림자 악령의 가시성
      let vis = 1;
      if (this.type === 'shadow') {
        vis = 0.05;
        if (this.revealT > 0) vis = 1;
        if (g.weather.flash > 0.3) vis = Math.max(vis, 0.9);
        if (P.flashlight && dist < 26) {
          const f = P.forward(new THREE.Vector3());
          if (f.dot(toP.clone().negate()) > 0.9) vis = Math.max(vis, 0.75);
        }
        if (dist < 2.5) vis = Math.max(vis, 0.4);
        this.visibleNow = vis > 0.3;
        if (Math.random() < 0.3) g.fx.smoke.emit(this.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, -0.7 + Math.random(), (Math.random() - 0.5) * 0.6)), new THREE.Vector3(0, 0.4, 0), new THREE.Color(0x0a0a0e), 1.2, 0.5, 1.2, 0.18 * Math.max(0.15, vis), 0, 0.3);
      }
      this.curVis = (this.curVis ?? vis) + (vis - (this.curVis ?? vis)) * Math.min(1, dt * 6);
      this.bodyMats.forEach((mat, i) => {
        mat.opacity = this.baseOpacity[i] * (this.type === 'shadow' ? this.curVis : 1);
        mat.emissive.setHex(this.hitFlash > 0 ? 0xffffff : this.type === 'shadow' ? 0x12001c : 0x7e95b8);
      });
      this.eyeMat.opacity = this.type === 'shadow' ? Math.max(0.35, this.curVis) : 1;
      // 밤엔 더 빛남
      const glow = 0.25 + g.sky.nightFactor * 0.5;
      if (this.type === 'wraith') this.bodyMats[0].emissiveIntensity = this.hitFlash > 0 ? 2 : glow;
    }
    // 체력 막대
    if (this.bar) {
      this.bar.show -= dt;
      const show = this.bar.show > 0 && (this.type !== 'shadow' || this.curVis > 0.3);
      this.bar.bg.visible = this.bar.fg.visible = show;
      if (show) {
        const cam = P.camera;
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
        const top = this.pos.clone().add(new THREE.Vector3(0, this.type === 'wisp' ? 0.6 : 1.25, 0)).addScaledVector(right, -0.4);
        this.bar.bg.position.copy(top);
        this.bar.fg.position.copy(top).addScaledVector(cam.getWorldDirection(new THREE.Vector3()), -0.01);
        this.bar.fg.scale.x = 0.8 * Math.max(0, this.hp / this.maxHp);
      }
    }
  }

  updateBoss(dt, t, dist, toP, speedK, atkK) {
    const g = this.g, P = g.player;
    // 등장 연출
    const appear = Math.min(1, this.spawnT / 3);
    // 어둑시니: 쳐다볼수록 커지고, 내려다보면 작아진다
    const f = P.forward(new THREE.Vector3());
    const look = f.dot(toP.clone().negate());
    if (look > 0.9 && P.pitch > -0.45) this.scaleK = Math.min(2.3, this.scaleK + dt * 0.22);
    else this.scaleK = Math.max(1, this.scaleK - dt * (P.pitch < -0.45 ? 0.5 : 0.12));
    const s = appear * this.scaleK;
    this.mesh.scale.setScalar(Math.max(0.01, s));
    this.radius = this.T.radius * this.scaleK;

    // 이동: 플레이어와 10~16m 거리 유지
    const flat = new THREE.Vector3(toP.x, 0, toP.z).normalize();
    let want = new THREE.Vector3();
    if (this.stunT <= 0 && !P.dead) {
      if (dist > 16) want.copy(flat).multiplyScalar(this.T.speed);
      else if (dist < 9) want.copy(flat).multiplyScalar(-this.T.speed * 0.7);
      want.add(new THREE.Vector3(-flat.z, 0, flat.x).multiplyScalar(Math.sin(t * 0.3) * 1.5));
    }
    want.multiplyScalar(speedK);
    this.vel.lerp(want, Math.min(1, dt * 1.5));
    this.pos.addScaledVector(this.vel, dt);
    this.pos.x = clamp(this.pos.x, L.turf.x0 - 4, L.court.x1);
    this.pos.z = clamp(this.pos.z, L.track.z0, L.track.z1);
    this.pos.y = this.T.y * Math.max(0.6, this.scaleK * 0.8) + Math.sin(t * 0.8) * 0.4;

    if (this.spawnT > 3 && !P.dead) {
      // 어둠 구슬
      this.atkT -= dt * atkK;
      if (this.atkT <= 0) {
        this.atkT = this.hp < this.maxHp * 0.5 ? 2.0 : 3.0;
        for (let i = -1; i <= 1; i++) {
          const dir = toP.clone().negate().negate();
          dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), i * 0.22).normalize();
          g.ghosts.shoot(this.pos.clone().addScaledVector(dir, this.radius), dir.multiplyScalar(9), 9 * this.scaleK, 0x6a1aff, true);
        }
        g.audio.ghostMoan(this.pos.x, this.pos.y, this.pos.z, 'boss');
      }
      // 내려찍기 충격파(점프로 피하기)
      this.slamT -= dt * atkK;
      if (this.slamT <= 0) {
        this.slamT = rr(7, 10);
        const c = new THREE.Vector3(P.pos.x, 0, P.pos.z);
        g.fx.ring(c, 0x8a3aff, 0.5, 3, 0.9);
        g.ui.toast('바닥에 어둠이 모인다 — 점프!', 'warn', 1200);
        setTimeout(() => {
          if (!this.alive) return;
          g.fx.ring(c, 0xb070ff, 0.5, 8, 0.5);
          g.fx.smokePuff(c, 0x150a20, 20, 6, 0.8, 1.5, 2, 0.5);
          g.audio.play('boom');
          g.ui.shake(0.4);
          if (P.pos.distanceTo(c) < 7.5 && P.onGround) P.damage(20 * this.scaleK * 0.8, this);
        }, 1100);
      }
      // 부하 소환
      this.summonT -= dt * atkK;
      if (this.summonT <= 0) {
        this.summonT = this.hp < this.maxHp * 0.5 ? 10 : 15;
        for (let i = 0; i < 2; i++) g.ghosts.spawn(rand() < 0.5 ? 'wisp' : 'shadow', this.pos.clone().add(new THREE.Vector3(rr(-4, 4), 0, rr(-4, 4))));
        g.audio.play('bossRoar');
      }
    }

    // 움직임 연출
    const m = this.mesh;
    m.position.copy(this.pos);
    m.rotation.y = Math.atan2(toP.x, toP.z);
    for (const b of this.blobs) {
      const k = b.userData.r * (1 + Math.sin(t * 1.5 + b.position.x * 3) * 0.06);
      b.scale.setScalar(k);
      b.position.copy(b.userData.base).multiplyScalar(1 + Math.sin(t * 0.9 + b.userData.r) * 0.05);
    }
    for (const tnd of this.tendrils) tnd.rotation.set(Math.sin(t * 1.2 + tnd.userData.a) * 0.4, 0, Math.cos(t * 1.1 + tnd.userData.a) * 0.4);
    for (const e of this.eyes) e.visible = !(Math.sin(t * 2 + e.position.x * 10) > 0.97);
    this.mats[0].emissiveIntensity = this.hitFlash > 0 ? 3 : 0.9;
    if (this.aura) this.aura.material.opacity = 0.4 + Math.sin(t * 2) * 0.15;
    if (Math.random() < 0.6) g.fx.smoke.emit(this.pos.clone().add(new THREE.Vector3(rr(-2, 2) * s, rr(-2, 1) * s, rr(-2, 2) * s)), new THREE.Vector3(0, 0.6, 0), new THREE.Color(0x0a0410), 2.5, 2 * s, 4 * s, 0.4, 0, 0.3);
    g.ui.bossHp(this.hp / this.maxHp, this.scaleK);
  }
}

export class Ghosts {
  constructor(game) {
    this.g = game;
    this.list = [];
    this.orbs = [];
    this.spawnT = 3;
    this.enabled = false;
    this.boss = null;
    this.orbGeo = new THREE.SphereGeometry(0.22, 12, 8);
  }

  spawn(type, pos) {
    const gh = new Ghost(this.g, type, pos);
    this.list.push(gh);
    this.g.fx.smokePuff(gh.pos, type === 'wisp' ? 0x2a6a70 : 0x1a1420, 8, 1, 0.5, 1.5, 1.4, 0.5);
    return gh;
  }

  spawnBoss() {
    const c = L.sealStone;
    this.boss = this.spawn('boss', new THREE.Vector3(c.x, 0, c.z));
    this.g.audio.play('bossRoar');
    return this.boss;
  }

  maxAlive() {
    const g = this.g;
    const w = g.weather;
    let n = 2 + g.relics.owned.size * 0.7;
    n += g.sky.nightFactor * 5;
    n += w.fog * 2 + w.storm * 2;
    if (this.boss && this.boss.alive) n = 4;
    return Math.min(14, Math.floor(n));
  }

  pickSpawnPos() {
    const P = this.g.player;
    for (let i = 0; i < 20; i++) {
      const a = rand() * Math.PI * 2, r = rr(18, 40);
      const x = P.pos.x + Math.cos(a) * r, z = P.pos.z + Math.sin(a) * r;
      const B = L.bounds;
      if (x < B.x0 || x > B.x1 || z < B.z0 || z > B.z1) continue;
      if (!P.indoor && isIndoor(x, z)) continue;
      return new THREE.Vector3(x, 0, z);
    }
    return null;
  }

  shoot(pos, vel, dmg, color, big = false) {
    const m = new THREE.Mesh(this.orbGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }));
    m.position.copy(pos);
    if (big) m.scale.setScalar(1.8);
    this.g.scene.add(m);
    this.orbs.push({ m, vel, dmg, life: 5, color });
  }

  onKilled(gh) {
    const g = this.g;
    g.stats.purified++;
    if (gh.type === 'boss') { g.onBossDefeated(); return; }
    // 정화된 자리에서 물건을 줍기도 함
    const r = rand();
    if (r < 0.22) g.inventory.add('pat', 1, '악령이 사라진 자리에서 팥 한 줌을 주웠다');
    else if (r < 0.34) g.inventory.add('ssuk', 1, '정화된 자리에 쑥이 돋아났다');
    g.quest.onPurify(gh);
  }

  update(dt, t) {
    const g = this.g;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const gh = this.list[i];
      if (gh.alive) gh.update(dt, t);
      if (!gh.alive) this.list.splice(i, 1);
    }
    // 원한 구슬
    const P = g.player;
    const pc = new THREE.Vector3(P.pos.x, P.pos.y + 1.1, P.pos.z);
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const o = this.orbs[i];
      const slow = g.relics.timeSlow > 0 ? 0.25 : 1;
      o.life -= dt;
      // 살짝 유도
      const want = pc.clone().sub(o.m.position).normalize().multiplyScalar(o.vel.length());
      o.vel.lerp(want, dt * 0.6);
      o.m.position.addScaledVector(o.vel, dt * slow);
      if (Math.random() < 0.7) g.fx.trail(o.m.position, o.color, 0.4, 0.4);
      let dead = o.life <= 0 || o.m.position.y < 0.1;
      if (o.m.position.distanceTo(pc) < 0.7 * o.m.scale.x) {
        P.damage(o.dmg, 'orb');
        dead = true;
      }
      const l = o.vel.length();
      if (!dead && rayCast(o.m.position.x, o.m.position.y, o.m.position.z, o.vel.x / l, o.vel.y / l, o.vel.z / l, 0.3) < 0.3) dead = true;
      if (dead) {
        g.fx.burst(o.m.position, o.color, 10, 2, 0.4, 0.2);
        g.scene.remove(o.m);
        o.m.material.dispose();
        this.orbs.splice(i, 1);
      }
    }
    // 생성
    if (!this.enabled || P.dead) return;
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = rr(3, 7) * (g.sky.nightFactor > 0.5 ? 0.6 : 1);
      const alive = this.list.filter((x) => x.type !== 'boss').length;
      if (alive < this.maxAlive()) {
        const p = this.pickSpawnPos();
        if (p) {
          const night = g.sky.nightFactor;
          const r = rand();
          const canShadow = g.relics.owned.size >= 3;
          let type = 'wraith';
          if (r < 0.2 + night * 0.15) type = 'wisp';
          else if (canShadow && r > 0.78 - night * 0.1) type = 'shadow';
          this.spawn(type, p);
        }
      }
    }
  }

  clear() {
    for (const gh of this.list) gh.dispose();
    this.list.length = 0;
    for (const o of this.orbs) this.g.scene.remove(o.m);
    this.orbs.length = 0;
    this.boss = null;
  }
}
