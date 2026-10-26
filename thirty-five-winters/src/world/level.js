// Builds a playable space from a mission's environment spec: terrain, sky, light, fog, weather, props.
import * as THREE from 'three';
import { Terrain, buildBackdrop, buildSky } from './terrain.js';
import { Kit, windUniforms } from './props.js';
import { Effects } from './effects.js';
import { CollisionWorld } from '../game/collision.js';

const TIMES = {
  day: { sun: '#fff1d6', sunI: 2.6, sunDir: [0.45, 0.75, 0.3], hemiSky: '#c9d8e6', hemiGround: '#6b5f4a', hemiI: 1.05, fog: '#b9c3c6', fogDensity: 0.0042, sky: { top: '#6f93b8', horizon: '#cfd8da' } },
  overcast: { sun: '#e8ebee', sunI: 1.2, sunDir: [0.3, 0.8, 0.4], hemiSky: '#c4cbd0', hemiGround: '#5f5a50', hemiI: 1.35, fog: '#aeb5b8', fogDensity: 0.0075, sky: { top: '#8c979f', horizon: '#c0c6c8', clouds: 0.9 } },
  dusk: { sun: '#ffb27a', sunI: 2.0, sunDir: [-0.7, 0.22, 0.4], hemiSky: '#c9a9a0', hemiGround: '#4e4038', hemiI: 0.8, fog: '#c29a84', fogDensity: 0.005, sky: { top: '#59628a', horizon: '#e7a77d', sunColor: '#ffb070' } },
  dawn: { sun: '#ffd2a8', sunI: 1.8, sunDir: [0.75, 0.2, -0.3], hemiSky: '#c5b9c6', hemiGround: '#4f463f', hemiI: 0.85, fog: '#cbb7b0', fogDensity: 0.0055, sky: { top: '#6c7a9e', horizon: '#efc7a8', sunColor: '#ffd0a0' } },
  night: { sun: '#9fb4d9', sunI: 0.55, sunDir: [-0.3, 0.6, -0.5], hemiSky: '#3a4a66', hemiGround: '#1a1a20', hemiI: 0.55, fog: '#1d2533', fogDensity: 0.012, sky: { top: '#0b1424', horizon: '#26324a', night: true, sunColor: '#dfe8ff' } },
};

export class Level {
  constructor(env, { quality = 'high' } = {}) {
    this.env = env;
    const scene = this.scene = new THREE.Scene();
    const time = { ...TIMES[env.time || 'day'], ...(env.light || {}) };
    this.time = time;
    this.terrain = new Terrain({ ...env.terrain, biome: env.biome });
    this.world = new CollisionWorld(this.terrain);
    const tmesh = this.terrain.buildMesh(); scene.add(tmesh);
    const water = this.terrain.buildWater(); if (water) scene.add(water);
    const fogCol = new THREE.Color(env.fogColor || time.fog);
    scene.fog = new THREE.FogExp2(fogCol, (env.fogDensity ?? time.fogDensity) * (env.weather === 'fog' ? 2.2 : env.weather === 'snow' ? 1.4 : env.weather === 'rain' ? 1.5 : 1));
    scene.background = fogCol;
    const skyCfg = { ...time.sky, ...(env.sky || {}), sunDir: time.sunDir };
    if (env.weather === 'snow' || env.weather === 'rain' || env.weather === 'fog') skyCfg.clouds = 1;
    this.sky = buildSky(skyCfg); scene.add(this.sky);
    const snowAmt = this.terrain.biome.snow || 0;
    scene.add(buildBackdrop({ ...env.terrain, fogColor: env.fogColor || time.fog }, env.backdropColor || '#5a6168', snowAmt));
    // light
    this.hemi = new THREE.HemisphereLight(time.hemiSky, time.hemiGround, time.hemiI); scene.add(this.hemi);
    const sun = this.sun = new THREE.DirectionalLight(time.sun, time.sunI * (env.weather === 'snow' || env.weather === 'rain' ? 0.55 : 1));
    sun.castShadow = quality !== 'low';
    const sm = quality === 'high' ? 2048 : 1024;
    sun.shadow.mapSize.set(sm, sm);
    const sc = sun.shadow.camera; sc.left = -45; sc.right = 45; sc.top = 45; sc.bottom = -45; sc.near = 1; sc.far = 260;
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
    this.sunDir = new THREE.Vector3(...time.sunDir).normalize();
    scene.add(sun); scene.add(sun.target);
    // props
    this.kit = new Kit(scene, this.world, this.terrain, { season: env.season, region: env.region, seed: env.terrain.seed || 4 });
    this.effects = new Effects(scene, this.terrain);
    this.markers = {};
    // dynamic point lights (pooled: only the nearest few are active)
    this.pointLights = [];
    for (let i = 0; i < 6; i++) { const l = new THREE.PointLight('#ffb070', 0, 12, 1.6); scene.add(l); this.pointLights.push(l); }
    windUniforms.uWind.value = env.wind ?? 1;
  }
  build(ctx) {
    this.env.build?.(this.kit, { ...ctx, level: this, terrain: this.terrain, effects: this.effects });
    this.kit.finalize();
    this.lightSources = this.kit.lights;
  }
  update(dt, t, focus) {
    windUniforms.uTime.value = t;
    this.kit.update(t);
    if (focus) {
      // shadow frustum follows the player
      this.sun.position.set(focus.x + this.sunDir.x * 120, focus.y + this.sunDir.y * 120, focus.z + this.sunDir.z * 120);
      this.sun.target.position.set(focus.x, focus.y, focus.z);
      this.sky.position.set(focus.x, 0, focus.z);
      if (this.sky.material.uniforms) this.sky.material.uniforms.uTime.value = t;
      // nearest light sources get the pooled point lights
      const src = this.lightSources || [];
      if (src.length) {
        const sorted = src.map((s) => [Math.hypot(s.x - focus.x, s.z - focus.z), s]).sort((a, b) => a[0] - b[0]);
        this.pointLights.forEach((l, i) => {
          const e = sorted[i];
          if (!e || e[0] > 60) { l.intensity = 0; return; }
          const s = e[1];
          l.position.set(s.x, s.y, s.z); l.color.set(s.color); l.distance = s.dist;
          l.intensity = s.intensity * 6 * (s.flicker ? 0.85 + Math.sin(t * 17 + i) * 0.08 + Math.sin(t * 7.3) * 0.07 : 1);
        });
      }
    }
  }
}
