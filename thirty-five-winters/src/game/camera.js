// Over-the-shoulder camera with terrain/obstacle pull-in, aim and binocular zoom, and scalable shake.
import * as THREE from 'three';
import { clamp, damp } from '../engine/util.js';

export class CameraRig {
  constructor(camera, game) {
    this.cam = camera; this.game = game;
    this.yaw = 0; this.pitch = -0.12;
    this.dist = 4.4; this.fov = 58;
    this.pos = new THREE.Vector3();
    this.shakeAmt = 0; this.shakeT = 0;
    this.kick = 0;
    this.fwd = new THREE.Vector3(0, 0, 1);
    this.forward = this.fwd;
    this.shoulder = 1;
    this.initialized = false;
  }
  snapBehind(a) { this.yaw = a.facing; this.pitch = -0.12; this.initialized = false; }
  shake(a) { this.shakeAmt = Math.min(1.2, this.shakeAmt + a); }
  update(dt, look, target, { aim = false, bino = false, slow = 1, sens = 1 } = {}) {
    const g = this.game;
    const k = 0.0024 * sens * slow * (bino ? 0.28 : aim ? 0.55 : 1);
    this.yaw -= look[0] * k; this.pitch -= look[1] * k;
    this.pitch = clamp(this.pitch, -1.05, 0.8);
    this.pitch += this.kick; this.kick = damp(this.kick, 0, 18, dt);
    const crouchK = target.crouch ? 0.72 : 1;
    const down = target.state === 'wounded';
    const pivot = new THREE.Vector3(target.x, target.y + (down ? 0.6 : 1.45 * crouchK) * target.model.scale, target.z);
    const want = bino ? 0.05 : aim ? 1.9 : target.carrying ? 4.9 : down ? 3.2 : 4.3;
    this.dist = damp(this.dist, want, aim || bino ? 14 : 7, dt);
    this.fov = damp(this.fov, bino ? 16 : aim ? 44 : 58, 12, dt);
    const sw = target.swayX || 0, sh = target.swayY || 0;
    const yaw = this.yaw + (aim ? sw : 0), pitch = this.pitch + (aim ? sh : 0);
    const fwd = this.fwd.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    const right = new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw));
    const off = bino ? 0 : (aim ? 0.62 : 0.55) * this.shoulder;
    const desired = pivot.clone().addScaledVector(fwd, -this.dist).addScaledVector(right, off).add(new THREE.Vector3(0, bino ? 0.1 : 0.22, 0));
    // pull in against terrain and solid scenery
    const T = g.terrain;
    let tHit = 1;
    const steps = 10;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps; const p = pivot.clone().lerp(desired, t);
      if (T.heightAt(p.x, p.z) > p.y - 0.25) { tHit = Math.min(tHit, (i - 1) / steps); break; }
    }
    const seg = g.world.segment(pivot.x, pivot.y, pivot.z, desired.x, desired.y, desired.z, 'sight');
    if (seg.shape && seg.shape.h > 1.2) tHit = Math.min(tHit, Math.max(0.05, seg.t - 0.08));
    const final = pivot.clone().lerp(desired, tHit);
    final.y = Math.max(final.y, T.heightAt(final.x, final.z) + 0.3);
    if (!this.initialized) { this.pos.copy(final); this.initialized = true; }
    else this.pos.lerp(final, 1 - Math.exp(-(aim ? 30 : 18) * dt));
    // shake (scaled by accessibility slider)
    this.shakeT += dt;
    const s = this.shakeAmt * (g.settings.shake ?? 1);
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 2.2);
    const sx = (Math.sin(this.shakeT * 37) + Math.sin(this.shakeT * 23) * 0.5) * 0.04 * s, sy = (Math.cos(this.shakeT * 31) + Math.sin(this.shakeT * 19) * 0.5) * 0.04 * s;
    this.cam.position.copy(this.pos);
    this.cam.position.x += sx; this.cam.position.y += sy;
    this.cam.fov = this.fov; this.cam.updateProjectionMatrix();
    this.cam.lookAt(this.cam.position.clone().addScaledVector(fwd, 50));
    this.forward = fwd;
  }
  // Ray through the crosshair: returns hit point (terrain / world / actors) up to range
  aimPoint(range = 600) {
    const g = this.game, o = this.cam.position, d = this.forward;
    const hit = g.trace(o.x, o.y, o.z, d.x, d.y, d.z, range, { includeEnemies: true, skipNear: this.dist + 0.6 });
    return hit;
  }
  recoil(a) { this.kick += a; }
}
