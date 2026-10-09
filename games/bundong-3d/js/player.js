import * as THREE from 'three';
import { L, surfaceAt, isIndoor, inPond } from './layout.js';
import { resolve, groundAt, ceilingAt } from './collision.js';
import { input, down, hit } from './input.js';
import { settings } from './settings.js';
import { buildArms, buildStudent, animateStudent } from './student.js';
import { clamp, damp, lerp } from './util.js';

// 1인칭 플레이어: 이동·점프·앉기·달리기, 체력/기력, 시점 모델(팔+유물)
export class Player {
  constructor(game) {
    this.g = game;
    this.pos = new THREE.Vector3(L.spawn.x, 0, L.spawn.z);
    this.vel = new THREE.Vector3();
    this.yaw = L.spawn.yaw;
    this.pitch = -0.02;
    this.onGround = true;
    this.radius = 0.32;
    this.height = 1.72;
    this.eye = 1.6;
    this.crouch = 0;
    this.maxHp = 100;
    this.hp = 100;
    this.stamina = 100;
    this.shield = 0;
    this.shieldTime = 0;
    this.buffs = {}; // 이름 -> 남은 시간
    this.dead = false;
    this.stepDist = 0;
    this.bob = 0;
    this.bobAmt = 0;
    this.roll = 0;
    this.landKick = 0;
    this.hurtTime = 0;
    this.gender = 'male';
    this.name = '학생';
    this.flashlight = false;
    this.indoor = false;
    this.surface = 'track';

    // 카메라
    this.camera = new THREE.PerspectiveCamera(settings.fov, innerWidth / innerHeight, 0.05, 1600);
    this.camera.rotation.order = 'YXZ';

    // 시점 모델용 장면
    this.vmScene = new THREE.Scene();
    this.vmCamera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.01, 10);
    this.vmHemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    this.vmDir = new THREE.DirectionalLight(0xffffff, 2);
    this.vmDir.position.set(1, 2, 1);
    this.vmScene.add(this.vmHemi, this.vmDir, this.vmDir.target);
    this.vmRoot = new THREE.Group();
    this.vmScene.add(this.vmRoot);
    this.arms = null;
    this.held = null;
    this.anim = { name: null, t: 0, dur: 0 };
    this.sway = new THREE.Vector2();

    // 손전등
    this.flash = new THREE.SpotLight(0xfff1d8, 0, 32, 0.42, 0.45, 1.6);
    this.flash.castShadow = false;
    game.scene.add(this.flash, this.flash.target);

    // 내 몸(그림자 + 내려다보면 보이는 다리)
    this.body = null;
  }

  setGender(gender) {
    this.gender = gender;
    if (this.arms) this.vmRoot.remove(this.arms);
    this.arms = buildArms(gender);
    this.vmRoot.add(this.arms);
    if (this.body) this.g.scene.remove(this.body);
    this.body = buildStudent(gender, { name: this.name });
    // 머리·팔은 그림자에만, 몸통·다리는 내려다보면 보이도록(카메라 층 0 + 그림자 층 1)
    const hidden = new Set([...this.body.userData.parts.head, ...this.body.userData.parts.arms]);
    this.body.traverse((o) => {
      o.layers.set(1);
      if (o.isMesh && !hidden.has(o)) o.layers.enable(0);
    });
    this.g.scene.add(this.body);
    if (this.held) this.hold(this.held);
  }

  // 오른손에 들 물건(Object3D)
  hold(obj) {
    const hand = this.arms.userData.right.userData.hand;
    if (this.held && this.held.parent) this.held.parent.remove(this.held);
    this.held = obj;
    if (obj) hand.add(obj);
  }

  playAnim(name, dur) { this.anim = { name, t: 0, dur }; }

  get eyePos() { return new THREE.Vector3(this.pos.x, this.pos.y + this.eye - this.crouch * 0.55, this.pos.z); }

  forward(out = new THREE.Vector3()) {
    return out.set(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
  }

  damage(n, src) {
    if (this.dead || this.g.godMode) return;
    if (this.buffs.juk) n *= 0.5;
    if (this.shield > 0) {
      const a = Math.min(this.shield, n);
      this.shield -= a; n -= a;
      this.g.audio.play('shieldHit');
    }
    if (n <= 0) return;
    this.hp -= n;
    this.hurtTime = 0.4;
    this.g.ui.hurt(n, src);
    this.g.audio.play('hurt');
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.g.onPlayerDeath();
    }
  }

  heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }

  respawn() {
    const r = L.respawn;
    this.pos.set(r.x, 0, r.z);
    this.vel.set(0, 0, 0);
    this.yaw = r.yaw; this.pitch = 0;
    this.hp = Math.round(this.maxHp * 0.7);
    this.dead = false;
  }

  update(dt, active) {
    const cam = this.camera;
    if (active) {
      const s = 0.0022 * settings.sens;
      this.yaw -= input.mouse.dx * s;
      this.pitch -= input.mouse.dy * s * (settings.invert ? -1 : 1);
      this.pitch = clamp(this.pitch, -1.5, 1.5);
    }
    
    // 이동 입력
    let fx = 0, fz = 0;
    if (active) {
      if (down('KeyW') || down('ArrowUp')) fz -= 1;
      if (down('KeyS') || down('ArrowDown')) fz += 1;
      if (down('KeyA') || down('ArrowLeft')) fx -= 1;
      if (down('KeyD') || down('ArrowRight')) fx += 1;
    }
    const crouching = active && (down('ControlLeft') || down('KeyC'));
    this.crouch = damp(this.crouch, crouching ? 1 : 0, 12, dt);
    const moving = fx !== 0 || fz !== 0;
    let sprint = active && (down('ShiftLeft') || down('ShiftRight')) && moving && !crouching && fz <= 0;
    if (sprint && this.stamina <= 0) sprint = false;
    if (this.stamina < 5 && !this.exhausted) this.exhausted = true;
    if (this.exhausted && this.stamina > 30) this.exhausted = false;
    if (this.exhausted) sprint = false;
    this.sprinting = sprint;
    this.stamina = clamp(this.stamina + (sprint ? -16 : 12) * dt, 0, 100);

    this.surface = surfaceAt(this.pos.x, this.pos.z);
    const water = inPond(this.pos.x, this.pos.z);
    let speed = crouching ? 1.8 : sprint ? 6.4 : 3.7;
    if (water) speed *= 0.5;
    if (this.buffs.slowed) speed *= 0.6;

    const len = Math.hypot(fx, fz) || 1;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const wx = ((fx * cos + fz * sin) / len) * speed;
    const wz = ((-fx * sin + fz * cos) / len) * speed;
    const accel = this.onGround ? 14 : 3;
    this.vel.x = damp(this.vel.x, moving ? wx : 0, accel, dt);
    this.vel.z = damp(this.vel.z, moving ? wz : 0, accel, dt);

    if (active && hit('Space') && this.onGround && !crouching) {
      this.vel.y = 6.2;
      this.onGround = false;
      this.g.audio.play('jump');
    }
    this.vel.y -= 20 * dt;

    // 수평 이동 + 충돌
    const prevY = this.pos.y;
    const h = this.height - this.crouch * 0.6;
    const nx = this.pos.x + this.vel.x * dt;
    const nz = this.pos.z + this.vel.z * dt;
    const p2 = { x: nx, z: nz };
    resolve(p2, this.radius, this.pos.y, h);
    const B = L.bounds;
    p2.x = clamp(p2.x, B.x0, B.x1);
    p2.z = clamp(p2.z, B.z0, B.z1);
    const movedDist = Math.hypot(p2.x - this.pos.x, p2.z - this.pos.z);
    this.pos.x = p2.x; this.pos.z = p2.z;

    // 수직
    this.pos.y += this.vel.y * dt;
    const gnd = groundAt(this.pos.x, this.pos.z, Math.max(prevY, this.pos.y), this.radius);
    const ceil = ceilingAt(this.pos.x, this.pos.z, this.pos.y + h);
    if (this.pos.y + h > ceil) { this.pos.y = ceil - h; if (this.vel.y > 0) this.vel.y = 0; }
    const wasGround = this.onGround;
    if (this.pos.y <= gnd) {
      if (!wasGround && this.vel.y < -6) { this.landKick = Math.min(0.12, -this.vel.y * 0.01); this.g.audio.footstep(this.surface, 1.4); }
      // 계단은 부드럽게 올라감
      this.pos.y = gnd > prevY + 0.05 ? lerp(prevY, gnd, 0.5) + 0.0 : gnd;
      if (gnd - this.pos.y < 0.02) this.pos.y = gnd;
      this.vel.y = 0;
      this.onGround = true;
    } else if (this.pos.y - gnd > 0.06) {
      this.onGround = false;
    }

    // 발소리
    if (this.onGround && movedDist > 0.0005) {
      this.stepDist += movedDist;
      const stride = sprint ? 2.5 : crouching ? 1.3 : 1.9;
      if (this.stepDist > stride) {
        this.stepDist = 0;
        this.g.audio.footstep(water ? 'water' : this.surface, sprint ? 1.2 : crouching ? 0.45 : 0.85);
      }
    }
    const hspeed = Math.hypot(this.vel.x, this.vel.z);
    this.bob += dt * hspeed * (sprint ? 2.0 : 2.4);
    this.bobAmt = damp(this.bobAmt, this.onGround ? Math.min(1, hspeed / 4) : 0, 8, dt);
    this.landKick = damp(this.landKick, 0, 8, dt);
    this.indoor = isIndoor(this.pos.x, this.pos.z);

    // 버프 시간
    for (const k of Object.keys(this.buffs)) {
      this.buffs[k] -= dt;
      if (this.buffs[k] <= 0) delete this.buffs[k];
    }
    if (this.shieldTime > 0) { this.shieldTime -= dt; if (this.shieldTime <= 0) this.shield = 0; }
    this.hurtTime = Math.max(0, this.hurtTime - dt);

    // 카메라
    const bobY = Math.sin(this.bob * 2) * 0.035 * this.bobAmt;
    const bobX = Math.cos(this.bob) * 0.025 * this.bobAmt;
    this.roll = damp(this.roll, -fx * 0.012 * (moving ? 1 : 0), 6, dt);
    cam.position.set(this.pos.x + bobX * Math.cos(this.yaw), this.pos.y + this.eye - this.crouch * 0.55 + bobY - this.landKick, this.pos.z - bobX * Math.sin(this.yaw));
    cam.rotation.set(this.pitch, this.yaw, this.roll + (this.hurtTime > 0 ? Math.sin(this.hurtTime * 50) * 0.01 : 0));
    const fovTarget = settings.fov + (sprint ? 6 : 0);
    if (Math.abs(cam.fov - fovTarget) > 0.05) { cam.fov = damp(cam.fov, fovTarget, 6, dt); cam.updateProjectionMatrix(); }

    // 그림자용 몸
    if (this.body) {
      // 카메라가 몸 안쪽에 들어가지 않게 살짝 뒤로
      this.body.position.set(this.pos.x + Math.sin(this.yaw) * 0.12, this.pos.y, this.pos.z + Math.cos(this.yaw) * 0.12);
      this.body.rotation.y = this.yaw + Math.PI;
      animateStudent(this.body, this.bob, this.onGround ? this.bobAmt : 0.3, this.crouch);
    }

    // 손전등
    if (active && hit('KeyF')) {
      this.flashlight = !this.flashlight;
      this.g.audio.play('click');
    }
    const f = this.forward();
    this.flash.intensity = this.flashlight ? 60 : 0;
    this.flash.position.copy(cam.position).addScaledVector(f, 0.2).add(new THREE.Vector3(0, -0.15, 0));
    this.flash.target.position.copy(cam.position).addScaledVector(f, 10);

    this.updateViewModel(dt, active ? input.mouse.dx : 0, active ? input.mouse.dy : 0);
  }

  updateViewModel(dt, mdx, mdy) {
    if (!this.arms) return;
    this.vmCamera.aspect = this.camera.aspect;
    this.vmCamera.updateProjectionMatrix();
    // 무기 흔들림(관성)
    this.sway.x = damp(this.sway.x, clamp(-mdx * 0.0012, -0.06, 0.06), 10, dt);
    this.sway.y = damp(this.sway.y, clamp(mdy * 0.0012, -0.06, 0.06), 10, dt);
    const R = this.arms.userData.right, Lh = this.arms.userData.left;
    const bx = Math.cos(this.bob) * 0.012 * this.bobAmt;
    const by = Math.abs(Math.sin(this.bob)) * 0.014 * this.bobAmt;
    const breathe = Math.sin(performance.now() * 0.0016) * 0.004;
    const sprintTilt = this.sprinting ? 1 : 0;
    this._sprintK = damp(this._sprintK || 0, sprintTilt, 8, dt);
    const sk = this._sprintK;
    // 기본 자세
    let rx = 0.12 + sk * 0.5, ry = 0.12 + sk * 0.3, rz = 0;
    let px = 0.19 + this.sway.x + bx, py = -0.16 + this.sway.y - by + breathe - sk * 0.05, pz = -0.42;
    // 동작
    const a = this.anim;
    if (a.name) {
      a.t += dt;
      const t = clamp(a.t / a.dur, 0, 1);
      const e = Math.sin(t * Math.PI);
      switch (a.name) {
        case 'slash': {
          // 오른쪽 위 → 왼쪽 아래로 베기
          const s = t < 0.25 ? t / 0.25 : 1 - (t - 0.25) / 0.75;
          const sweep = t < 0.25 ? -t / 0.25 : -1 + ((t - 0.25) / 0.75) * 2.0;
          rx += -0.9 * s + 0.3 * (t > 0.25 ? e : 0);
          ry += sweep * 0.9;
          rz += sweep * -0.8;
          px += sweep * -0.12; py += s * 0.08;
          break;
        }
        case 'wave': rx -= e * 1.1; ry -= e * 0.3; pz -= e * 0.1; py += e * 0.1; break;
        case 'raise': rx -= e * 0.6; py += e * 0.12; pz -= e * 0.12; px -= e * 0.1; break;
        case 'throw': {
          const back = t < 0.35 ? t / 0.35 : 0;
          const fwd = t >= 0.35 ? Math.sin(((t - 0.35) / 0.65) * Math.PI) : 0;
          rx += back * -1.2 + fwd * 0.9; py += back * 0.12 - fwd * 0.05; pz += back * 0.12 - fwd * 0.2;
          break;
        }
        case 'gather': rx += e * 0.9; py -= e * 0.2; pz -= e * 0.15; break;
        case 'equip': py -= (1 - t) * 0.3; rx += (1 - t) * 0.6; break;
        case 'eat': rx -= e * 0.8; py += e * 0.1; px -= e * 0.15; break;
      }
      if (a.t >= a.dur) a.name = null;
    }
    R.position.set(px, py, pz);
    R.rotation.set(rx, ry, rz);
    Lh.position.set(-0.3 - this.sway.x * 0.5 - bx, -0.3 + this.sway.y - by + breathe - sk * 0.08, -0.4);
    Lh.rotation.set(0.25 + sk * 0.6, -0.2, 0);
    // 빛 동기화
    this.vmScene.environment = this.g.scene.environment;
    this.vmScene.environmentIntensity = this.g.scene.environmentIntensity;
    this.vmHemi.color.copy(this.g.sky.hemi.color);
    this.vmHemi.groundColor.copy(this.g.sky.hemi.groundColor);
    this.vmHemi.intensity = this.g.sky.hemi.intensity * (this.indoor ? 1.2 : 1) + (this.flashlight ? 0.6 : 0) + (this.indoor ? 0.6 : 0);
    this.vmDir.color.copy(this.g.sky.sun.color);
    this.vmDir.intensity = this.indoor ? 0.6 : this.g.sky.sun.intensity * 0.8;
    const sd = this.g.sky.sun.position.clone().sub(this.g.sky.sun.target.position).normalize();
    sd.applyQuaternion(this.camera.quaternion.clone().invert());
    this.vmDir.position.copy(sd);
  }
}
