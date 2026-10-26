// Restrained particles: muzzle flash, dust/snow puffs at impacts, gun smoke, distant smoke columns,
// falling snow and rain, and footprints. No blood effects anywhere.
import * as THREE from 'three';

const puffTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); return t;
})();

export class Effects {
  constructor(scene, terrain) {
    this.scene = scene; this.terrain = terrain;
    this.sprites = [];
    this.pool = [];
    this.group = new THREE.Group(); scene.add(this.group);
    // footprints ring buffer
    const fpGeo = new THREE.PlaneGeometry(0.16, 0.3); fpGeo.rotateX(-Math.PI / 2);
    this.fpMat = new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.22, depthWrite: false });
    this.fp = new THREE.InstancedMesh(fpGeo, this.fpMat, 500); this.fp.count = 0; this.fp.frustumCulled = false;
    this.fpIndex = 0; this.fpN = 0;
    this.group.add(this.fp);
    this.weather = null;
    this.columns = [];
    this.shake = 0;
  }
  _sprite() {
    let s = this.pool.pop();
    if (!s) { s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false })); this.group.add(s); }
    s.visible = true; return s;
  }
  puff(pos, { color = '#bdb3a3', size = 0.6, life = 0.8, rise = 0.6, n = 4, spread = 0.3, opacity = 0.6 } = {}) {
    for (let i = 0; i < n; i++) {
      const s = this._sprite();
      s.material.color.set(color); s.material.opacity = opacity;
      s.position.set(pos.x + (Math.random() - 0.5) * spread, pos.y + Math.random() * spread * 0.5, pos.z + (Math.random() - 0.5) * spread);
      s.scale.setScalar(size * (0.6 + Math.random() * 0.6));
      this.sprites.push({ s, t: 0, life: life * (0.7 + Math.random() * 0.6), vy: rise * (0.5 + Math.random()), vx: (Math.random() - 0.5) * 0.4, vz: (Math.random() - 0.5) * 0.4, grow: 1.6, o0: opacity });
    }
  }
  impact(pos, surface) {
    const col = { snow: '#f2f4f5', dirt: '#9c8a6e', mud: '#6a5a44', grass: '#8f8a66', stone: '#b0aca4', wood: '#a0805a', leaves: '#9a7a44', road: '#a8957a', water: '#c9d6db' }[surface] || '#9c8a6e';
    this.puff(pos, { color: col, size: 0.45, life: 0.6, rise: 0.4, n: 4, spread: 0.2, opacity: 0.75 });
  }
  muzzle(pos, dir) {
    const flash = this._sprite(); flash.material.color.set('#ffd38a'); flash.material.opacity = 1;
    flash.position.copy(pos); flash.scale.setScalar(0.45);
    this.sprites.push({ s: flash, t: 0, life: 0.06, vy: 0, vx: 0, vz: 0, grow: 0, o0: 1 });
    this.puff({ x: pos.x + dir.x * 0.3, y: pos.y, z: pos.z + dir.z * 0.3 }, { color: '#d9d6cf', size: 0.5, life: 1.4, rise: 0.25, n: 3, spread: 0.15, opacity: 0.35 });
  }
  smokeColumn(x, z, { color = '#55524e', height = 40, rate = 0.15 } = {}) { this.columns.push({ x, z, color, height, rate, acc: 0 }); }
  footprint(x, z, ang, side) {
    const surf = this.terrain.surfaceAt(x, z);
    if (surf !== 'snow' && surf !== 'mud') return;
    const o = new THREE.Object3D();
    const ox = Math.cos(ang) * 0.11 * side, oz = -Math.sin(ang) * 0.11 * side;
    o.position.set(x + ox, this.terrain.heightAt(x + ox, z + oz) + 0.03, z + oz); o.rotation.y = ang; o.updateMatrix();
    this.fp.setMatrixAt(this.fpIndex, o.matrix);
    this.fpIndex = (this.fpIndex + 1) % 500; this.fpN = Math.min(500, this.fpN + 1); this.fp.count = this.fpN;
    this.fp.instanceMatrix.needsUpdate = true;
  }
  trail(points, spacing = 0.7) { // pre-placed tracks (scouting clues)
    for (let i = 0; i < points.length - 1; i++) {
      const [x1, z1] = points[i], [x2, z2] = points[i + 1]; const len = Math.hypot(x2 - x1, z2 - z1), ang = Math.atan2(x2 - x1, z2 - z1);
      for (let d = 0, k = 0; d < len; d += spacing, k++) this.footprint(x1 + (x2 - x1) * d / len, z1 + (z2 - z1) * d / len, ang, k % 2 ? 1 : -1);
    }
  }
  setWeather(kind, camera) {
    if (this.weather) { this.group.remove(this.weather.obj); this.weather = null; }
    if (kind !== 'snow' && kind !== 'rain') return;
    const N = kind === 'snow' ? 1800 : 2600;
    const geo = new THREE.BufferGeometry(); const pos = new Float32Array(N * (kind === 'rain' ? 6 : 3));
    const seeds = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { seeds[i * 3] = (Math.random() - 0.5) * 50; seeds[i * 3 + 1] = Math.random() * 25; seeds[i * 3 + 2] = (Math.random() - 0.5) * 50; }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    let obj;
    if (kind === 'snow') obj = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#ffffff', size: 0.09, transparent: true, opacity: 0.85, depthWrite: false }));
    else obj = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#b9c4cc', transparent: true, opacity: 0.35 }));
    obj.frustumCulled = false; this.group.add(obj);
    this.weather = { kind, obj, seeds, N, camera, t: 0 };
  }
  update(dt, camPos) {
    for (let i = this.sprites.length - 1; i >= 0; i--) {
      const p = this.sprites[i]; p.t += dt;
      const k = p.t / p.life;
      if (k >= 1) { p.s.visible = false; this.pool.push(p.s); this.sprites.splice(i, 1); continue; }
      p.s.position.x += p.vx * dt; p.s.position.y += p.vy * dt; p.s.position.z += p.vz * dt;
      p.s.scale.multiplyScalar(1 + p.grow * dt);
      p.s.material.opacity = p.o0 * (1 - k);
    }
    for (const c of this.columns) {
      c.acc += dt;
      if (c.acc > c.rate) {
        c.acc = 0;
        const y = this.terrain.heightAt(c.x, c.z);
        const s = this._sprite(); s.material.color.set(c.color); s.material.opacity = 0.55;
        s.position.set(c.x + (Math.random() - 0.5) * 2, y + 1, c.z + (Math.random() - 0.5) * 2); s.scale.setScalar(3);
        this.sprites.push({ s, t: 0, life: 9, vy: c.height / 9, vx: 0.8 + Math.random() * 0.4, vz: 0.3, grow: 0.35, o0: 0.5 });
      }
    }
    const w = this.weather;
    if (w && camPos) {
      w.t += dt;
      const pos = w.obj.geometry.attributes.position.array, S = w.seeds;
      for (let i = 0; i < w.N; i++) {
        let x = S[i * 3], y = S[i * 3 + 1], z = S[i * 3 + 2];
        if (w.kind === 'snow') { y -= dt * 1.1; x += Math.sin(w.t * 0.7 + i) * dt * 0.4 + dt * 0.5; }
        else { y -= dt * 18; x += dt * 1.5; }
        if (y < 0) y += 25;
        if (x > 25) x -= 50; if (x < -25) x += 50;
        S[i * 3] = x; S[i * 3 + 1] = y; S[i * 3 + 2] = z;
        const wx = camPos.x + x, wy = camPos.y - 8 + y, wz = camPos.z + z;
        if (w.kind === 'snow') { pos[i * 3] = wx; pos[i * 3 + 1] = wy; pos[i * 3 + 2] = wz; }
        else { pos[i * 6] = wx; pos[i * 6 + 1] = wy; pos[i * 6 + 2] = wz; pos[i * 6 + 3] = wx - 0.05; pos[i * 6 + 4] = wy + 0.6; pos[i * 6 + 5] = wz; }
      }
      w.obj.geometry.attributes.position.needsUpdate = true;
    }
  }
}
