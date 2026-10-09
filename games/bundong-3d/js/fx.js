import * as THREE from 'three';

// 파티클(정화의 빛, 연기, 불꽃, 비 튀김)과 일시적 효과(베기 궤적, 충격파, 섬광)
const PVERT = `
attribute float size;
attribute float alpha;
attribute vec3 pcolor;
varying float vAlpha;
varying vec3 vColor;
uniform float uScale;
void main() {
  vAlpha = alpha;
  vColor = pcolor;
  vec4 mv = modelViewMatrix * vec4( position, 1.0 );
  gl_PointSize = size * uScale / max( 0.1, -mv.z );
  gl_Position = projectionMatrix * mv;
}`;
const PFRAG = `
varying float vAlpha;
varying vec3 vColor;
uniform float uSoft;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length( c );
  float a = smoothstep( 0.5, uSoft, d ) * vAlpha;
  if ( a < 0.004 ) discard;
  gl_FragColor = vec4( vColor, a );
}`;

class ParticlePool {
  constructor(n, blending, soft) {
    this.n = n;
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 3);
    this.col = new Float32Array(n * 3);
    this.size = new Float32Array(n);
    this.alpha = new Float32Array(n);
    this.vel = new Float32Array(n * 3);
    this.life = new Float32Array(n);
    this.max = new Float32Array(n);
    this.s0 = new Float32Array(n);
    this.s1 = new Float32Array(n);
    this.a0 = new Float32Array(n);
    this.grav = new Float32Array(n);
    this.drag = new Float32Array(n);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('pcolor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: PVERT, fragmentShader: PFRAG,
      uniforms: { uScale: { value: 600 }, uSoft: { value: soft } },
      transparent: true, depthWrite: false, blending,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.cursor = 0;
    this.active = 0;
  }
  emit(p, v, color, life, s0, s1, a0 = 1, grav = 0, drag = 0) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.n;
    this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
    this.vel[i * 3] = v.x; this.vel[i * 3 + 1] = v.y; this.vel[i * 3 + 2] = v.z;
    this.col[i * 3] = color.r; this.col[i * 3 + 1] = color.g; this.col[i * 3 + 2] = color.b;
    this.life[i] = life; this.max[i] = life;
    this.s0[i] = s0; this.s1[i] = s1; this.a0[i] = a0;
    this.grav[i] = grav; this.drag[i] = drag;
  }
  update(dt) {
    const { pos, vel, life, max, size, alpha } = this;
    for (let i = 0; i < this.n; i++) {
      if (life[i] <= 0) { alpha[i] = 0; continue; }
      life[i] -= dt;
      const t = 1 - life[i] / max[i];
      const k = Math.exp(-this.drag[i] * dt);
      vel[i * 3] *= k; vel[i * 3 + 1] = vel[i * 3 + 1] * k - this.grav[i] * dt; vel[i * 3 + 2] *= k;
      pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * t;
      alpha[i] = this.a0[i] * (t < 0.1 ? t / 0.1 : 1 - (t - 0.1) / 0.9);
    }
    for (const a of ['position', 'pcolor', 'size', 'alpha']) this.geo.attributes[a].needsUpdate = true;
  }
}

const _v = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color();

export class FX {
  constructor(scene) {
    this.scene = scene;
    this.glow = new ParticlePool(4000, THREE.AdditiveBlending, 0.0);
    this.smoke = new ParticlePool(1500, THREE.NormalBlending, 0.1);
    scene.add(this.glow.points, this.smoke.points);
    this.items = [];
    // 섬광용 점광원 풀
    this.lights = [];
    for (let i = 0; i < 3; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 14, 2);
      scene.add(l);
      this.lights.push({ l, t: 0, max: 0, peak: 0 });
    }
    this.slashTex = this.makeSlashTex();
  }

  makeSlashTex() {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 256, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.7, 'rgba(255,240,200,0.6)');
    g.addColorStop(1, 'rgba(255,255,255,1)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 64);
    const g2 = ctx.createLinearGradient(0, 0, 0, 64);
    g2.addColorStop(0, 'rgba(0,0,0,1)'); g2.addColorStop(0.5, 'rgba(0,0,0,0)'); g2.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, 256, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  setScale(h) { this.glow.mat.uniforms.uScale.value = this.smoke.mat.uniforms.uScale.value = h * 0.9; }

  flash(pos, color, peak = 30, dur = 0.3, dist = 14) {
    let best = this.lights[0];
    for (const e of this.lights) if (e.t <= 0) { best = e; break; }
    best.l.position.copy(pos);
    best.l.color.set(color);
    best.l.distance = dist;
    best.t = best.max = dur;
    best.peak = peak;
  }

  burst(pos, color, n = 30, speed = 4, life = 0.8, size = 0.25, grav = -0.5) {
    _c.set(color);
    for (let i = 0; i < n; i++) {
      _v.set(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.3 + Math.random() * 0.7));
      this.glow.emit(pos, _v, _c, life * (0.6 + Math.random() * 0.6), size, size * 0.2, 1, grav, 2);
    }
  }

  // 정화: 금빛 입자가 하늘로
  purify(pos) {
    _c.set(0xffd98a);
    for (let i = 0; i < 60; i++) {
      _p.copy(pos).add(_v.set((Math.random() - 0.5) * 1.2, Math.random() * 1.8, (Math.random() - 0.5) * 1.2));
      this.glow.emit(_p, _v.set((Math.random() - 0.5) * 0.6, 1.5 + Math.random() * 2.5, (Math.random() - 0.5) * 0.6), _c, 1.6 + Math.random(), 0.22, 0.05, 1, -0.3, 0.5);
    }
    _c.set(0xbfe8ff);
    for (let i = 0; i < 25; i++) this.glow.emit(pos, _v.set(Math.random() - 0.5, Math.random(), Math.random() - 0.5).multiplyScalar(4), _c, 0.6, 0.35, 0.05, 1, 0, 3);
    this.flash(pos, 0xffe2a0, 25, 0.5);
  }

  smokePuff(pos, color, n = 10, spread = 1, rise = 0.6, life = 3, size = 1.6, alpha = 0.35) {
    _c.set(color);
    for (let i = 0; i < n; i++) {
      _p.copy(pos).add(_v.set((Math.random() - 0.5) * spread, Math.random() * 0.3, (Math.random() - 0.5) * spread));
      this.smoke.emit(_p, _v.set((Math.random() - 0.5) * 0.4, rise * (0.5 + Math.random()), (Math.random() - 0.5) * 0.4), _c, life * (0.7 + Math.random() * 0.5), size * 0.5, size * 1.6, alpha, 0, 0.3);
    }
  }

  trail(pos, color, size = 0.2, life = 0.4) {
    _c.set(color);
    this.glow.emit(pos, _v.set((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3), _c, life, size, 0.02, 1, 0, 1);
  }

  // 베기 궤적(호 모양 띠)
  slash(origin, yaw, pitch, color = 0xfff0c0, radius = 2.2, arc = 2.0) {
    const geo = new THREE.RingGeometry(radius * 0.55, radius, 32, 1, -arc / 2, arc);
    const uv = geo.attributes.uv;
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const a = Math.atan2(p.getY(i), p.getX(i));
      const r = Math.hypot(p.getX(i), p.getY(i));
      uv.setXY(i, (a + arc / 2) / arc, (r - radius * 0.55) / (radius * 0.45));
    }
    const mat = new THREE.MeshBasicMaterial({ map: this.slashTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, opacity: 1 });
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(origin);
    m.rotation.order = 'YXZ';
    m.rotation.set(-Math.PI / 2 + pitch * 0.8, yaw, 0);
    m.rotateZ(Math.PI / 2 + 0.35);
    this.scene.add(m);
    this.items.push({ obj: m, t: 0, dur: 0.28, kind: 'fade', spin: -6 });
  }

  ring(pos, color, r0 = 0.5, r1 = 6, dur = 0.6, y = 0.1) {
    const geo = new THREE.RingGeometry(0.85, 1, 48).rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(pos.x, pos.y + y, pos.z);
    this.scene.add(m);
    this.items.push({ obj: m, t: 0, dur, kind: 'ring', r0, r1 });
  }

  sphere(pos, color, r0, r1, dur) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.6 }));
    m.position.copy(pos);
    this.scene.add(m);
    this.items.push({ obj: m, t: 0, dur, kind: 'ring', r0, r1 });
  }

  // 화면 공간 빛(거울 섬광) — 원뿔 메시
  cone(pos, dir, color, len = 18, angle = 0.35, dur = 0.5) {
    const geo = new THREE.ConeGeometry(Math.tan(angle) * len, len, 32, 1, true);
    geo.translate(0, -len / 2, 0);
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.position.copy(pos);
    m.lookAt(pos.clone().sub(dir));
    this.scene.add(m);
    this.items.push({ obj: m, t: 0, dur, kind: 'fade' });
  }

  update(dt) {
    this.glow.update(dt);
    this.smoke.update(dt);
    for (const e of this.lights) {
      if (e.t > 0) { e.t -= dt; e.l.intensity = e.peak * Math.max(0, e.t / e.max); } else e.l.intensity = 0;
    }
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.t += dt;
      const k = it.t / it.dur;
      if (it.kind === 'fade') {
        it.obj.material.opacity = Math.max(0, 1 - k) * (it.obj.material.userData.base || 1);
        if (it.spin) it.obj.rotateZ(it.spin * dt * 0.2);
      } else if (it.kind === 'ring') {
        const r = it.r0 + (it.r1 - it.r0) * (1 - Math.pow(1 - Math.min(k, 1), 2));
        it.obj.scale.set(r, it.obj.geometry.type === 'SphereGeometry' ? r : 1, r);
        it.obj.material.opacity = Math.max(0, 1 - k) * 0.8;
      }
      if (k >= 1) {
        this.scene.remove(it.obj);
        it.obj.geometry.dispose();
        it.obj.material.dispose();
        this.items.splice(i, 1);
      }
    }
  }
}
