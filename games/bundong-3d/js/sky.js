import * as THREE from 'three';
import { clamp, smooth, lerp } from './util.js';

// 하늘 돔: 영상처럼 짙은 파란 하늘 + 새털구름(권운), 해·달·별, 구름량은 날씨가 조절
const VERT = `
varying vec3 vDir;
void main() {
  vDir = normalize( position );
  vec4 p = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  gl_Position = p.xyww;
}`;

const FRAG = `
uniform vec3 uSunDir;
uniform vec3 uMoonDir;
uniform float uTime;
uniform float uCloud;      // 0 맑음 ~ 1 잔뜩 흐림
uniform float uStorm;      // 먹구름 어두움
uniform float uFog;        // 안개
uniform vec2 uWind;
uniform float uFlash;      // 번개
uniform vec3 uFogColor;
varying vec3 vDir;

float hash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
float hash3( vec3 p ) { return fract( sin( dot( p, vec3( 127.1, 311.7, 74.7 ) ) ) * 43758.5453 ); }
float noise( vec2 p ) {
  vec2 i = floor( p ), f = fract( p );
  vec2 u = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( hash( i ), hash( i + vec2( 1, 0 ) ), u.x ), mix( hash( i + vec2( 0, 1 ) ), hash( i + vec2( 1, 1 ) ), u.x ), u.y );
}
float fbm( vec2 p ) {
  float s = 0.0, a = 0.5;
  for ( int i = 0; i < 6; i++ ) { s += a * noise( p ); p = p * 2.03 + vec2( 1.7, 9.2 ); a *= 0.5; }
  return s;
}

void main() {
  vec3 d = normalize( vDir );
  float h = d.y;
  float e = uSunDir.y;
  float day = smoothstep( -0.12, 0.22, e );
  float twilight = smoothstep( -0.22, 0.0, e ) * ( 1.0 - smoothstep( 0.0, 0.28, e ) );

  vec3 zenDay = vec3( 0.03, 0.15, 0.62 );
  vec3 horDay = vec3( 0.40, 0.60, 0.88 );
  vec3 zenNight = vec3( 0.006, 0.010, 0.028 );
  vec3 horNight = vec3( 0.03, 0.045, 0.085 );
  vec3 zen = mix( zenNight, zenDay, day );
  vec3 hor = mix( horNight, horDay, day );

  float sunAlign = max( dot( normalize( vec3( d.x, 0.0, d.z ) + 1e-4 ), normalize( vec3( uSunDir.x, 0.0, uSunDir.z ) + 1e-4 ) ), 0.0 );
  vec3 dusk = vec3( 1.0, 0.48, 0.22 );
  hor = mix( hor, dusk, twilight * ( 0.35 + 0.65 * pow( sunAlign, 3.0 ) ) );
  zen = mix( zen, vec3( 0.12, 0.13, 0.32 ), twilight * 0.5 );

  float t = pow( clamp( h, 0.0, 1.0 ), 0.45 );
  vec3 col = mix( hor, zen, t );

  // 흐린 날: 회색으로
  vec3 grey = mix( vec3( 0.02, 0.022, 0.03 ), vec3( 0.52, 0.55, 0.6 ), day ) * ( 1.0 - uStorm * 0.55 );
  col = mix( col, grey, uCloud * 0.85 );

  // 해
  float sd = dot( d, uSunDir );
  float sunVis = ( 1.0 - uCloud * 0.85 ) * smoothstep( -0.05, 0.02, e );
  col += vec3( 1.0, 0.85, 0.6 ) * pow( max( sd, 0.0 ), 8.0 ) * 0.22 * sunVis;
  col += vec3( 1.0, 0.9, 0.75 ) * pow( max( sd, 0.0 ), 120.0 ) * 0.8 * sunVis;
  col += vec3( 30.0, 26.0, 20.0 ) * smoothstep( 0.99955, 0.9997, sd ) * sunVis;

  // 별
  float night = 1.0 - smoothstep( -0.25, 0.02, e );
  if ( h > 0.0 && night > 0.0 ) {
    vec3 sp = d * 420.0;
    vec3 cell = floor( sp );
    float s = hash3( cell );
    if ( s > 0.9965 ) {
      vec3 f = fract( sp ) - 0.5;
      float star = smoothstep( 0.35, 0.0, length( f ) );
      float tw = 0.6 + 0.4 * sin( uTime * 3.0 + s * 300.0 );
      col += vec3( 0.9, 0.95, 1.0 ) * star * tw * night * ( 1.0 - uCloud ) * 2.5 * smoothstep( 0.0, 0.25, h );
    }
  }

  // 달
  float md = dot( d, uMoonDir );
  float moonVis = ( 1.0 - uCloud * 0.9 ) * smoothstep( -0.05, 0.05, uMoonDir.y );
  float disc = smoothstep( 0.99935, 0.9995, md );
  float crater = 0.75 + 0.25 * noise( d.xz * 900.0 );
  col += vec3( 2.2, 2.3, 2.5 ) * disc * crater * moonVis;
  col += vec3( 0.25, 0.3, 0.4 ) * pow( max( md, 0.0 ), 60.0 ) * moonVis * night;

  // 구름: 권운(새털) + 적운(흐림)
  if ( h > 0.0 ) {
    vec2 uv = d.xz / ( h + 0.12 );
    vec2 w = uWind * uTime * 0.004;
    // 영상의 가는 새털구름: 한 방향으로 길게 늘어진 줄무늬
    vec2 cu = vec2( uv.x * 0.7 + uv.y * 0.3, uv.y * 2.2 - uv.x * 0.5 ) * 2.2 + w;
    float ci = fbm( cu * 1.1 );
    float streak = fbm( vec2( cu.x * 0.5, cu.y * 4.0 ) + 3.0 );
    float patchMask = smoothstep( 0.5, 0.7, fbm( uv * 0.35 + 7.0 + w * 0.3 ) );
    float cir = smoothstep( 0.62, 0.86, ci * 0.6 + streak * 0.55 ) * patchMask * ( 0.9 - uCloud * 0.3 );
    // 적운
    vec2 cuu = uv * 0.9 + w * 1.6;
    float cm = fbm( cuu * 1.3 + vec2( 0.0, uTime * 0.002 ) );
    float cum = smoothstep( 0.62 - uCloud * 0.45, 0.85 - uCloud * 0.3, cm );
    float cloud = clamp( max( cir * 0.8, cum ), 0.0, 1.0 ) * smoothstep( 0.0, 0.12, h );

    vec3 lit = mix( vec3( 0.05, 0.055, 0.08 ), vec3( 1.0, 1.0, 1.0 ), day );
    lit = mix( lit, vec3( 1.0, 0.62, 0.42 ), twilight * 0.8 );
    lit += vec3( 0.25, 0.22, 0.15 ) * pow( max( sd, 0.0 ), 6.0 ) * day;
    float thick = cum * ( 0.4 + uCloud * 0.5 ) + uStorm * 0.6;
    vec3 cc = mix( lit, lit * 0.45, thick );
    cc += vec3( 0.9, 0.92, 1.0 ) * uFlash * cum * 3.0;
    col = mix( col, cc, cloud * ( 0.92 ) );
  }

  col += vec3( 0.6, 0.65, 0.8 ) * uFlash * 0.25;

  // 지평선 아래 & 안개
  if ( h < 0.0 ) col = mix( col, uFogColor, smoothstep( 0.0, -0.08, h ) );
  col = mix( col, uFogColor, uFog * ( 1.0 - smoothstep( -0.05, 0.55, h ) ) );
  col = mix( col, uFogColor, smoothstep( 0.12, -0.01, h ) * 0.65 );

  gl_FragColor = vec4( col, 1.0 );
}`;

export class Sky {
  constructor(renderer, scene) {
    this.renderer = renderer;
    this.scene = scene;
    this.hours = 8.33;
    this.dayLength = 720;
    this.uniforms = {
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uMoonDir: { value: new THREE.Vector3(0, -1, 0) },
      uTime: { value: 0 },
      uCloud: { value: 0.0 },
      uStorm: { value: 0 },
      uFog: { value: 0 },
      uWind: { value: new THREE.Vector2(1, 0.3) },
      uFlash: { value: 0 },
      uFogColor: { value: new THREE.Color(0x9cc0e8) },
    };
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), this.material);
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -10;
    scene.add(this.dome);

    // 햇빛/달빛(하나의 방향광, 그림자)
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;
    scene.add(this.sun);
    scene.add(this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x5a5040, 1.0);
    scene.add(this.hemi);

    this.fog = new THREE.FogExp2(0x9cc0e8, 0.004);
    scene.fog = this.fog;

    // 환경맵(금속 유물 반사용)
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envScene = new THREE.Scene();
    this.envDome = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), this.material);
    this.envScene.add(this.envDome);
    this.envGround = new THREE.Mesh(new THREE.CircleGeometry(49, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x3a3a30 }));
    this.envGround.position.y = -2;
    this.envScene.add(this.envGround);
    this.envRT = null;
    this.envTimer = 0;

    this.dayFactor = 1;
    this.nightFactor = 0;
    this.sunElev = 0.4;
    this.weather = { cloud: 0, storm: 0, fog: 0, flash: 0, rain: 0 };
    this.shadowRange = 55;
    this._sunCol = new THREE.Color();
  }

  setShadow(mapSize, range) {
    this.shadowRange = range;
    const s = this.sun.shadow;
    s.mapSize.set(mapSize, mapSize);
    if (s.map) { s.map.dispose(); s.map = null; }
    const c = s.camera;
    c.left = -range; c.right = range; c.top = range; c.bottom = -range;
    c.near = 1; c.far = 400;
    c.updateProjectionMatrix();
  }

  sunDirAt(h) {
    const a = ((h - 6.3) / (18.1 - 6.3)) * Math.PI;
    const maxEl = (46 * Math.PI) / 180;
    return new THREE.Vector3(Math.cos(a), Math.sin(a) * Math.sin(maxEl), Math.sin(a) * Math.cos(maxEl) * 0.9).normalize();
  }

  update(dt, focus, timeScale = 1) {
    this.hours = (this.hours + (dt * 24 * timeScale) / this.dayLength) % 24;
    const u = this.uniforms;
    u.uTime.value += dt;
    const sd = this.sunDirAt(this.hours);
    u.uSunDir.value.copy(sd);
    const md = this.sunDirAt(this.hours + 12.2);
    md.x *= -0.6; md.y = Math.abs(md.y) * (sd.y < 0.05 ? 1 : -1) + 0.0;
    u.uMoonDir.value.copy(md.normalize());
    const w = this.weather;
    u.uCloud.value = w.cloud;
    u.uStorm.value = w.storm;
    u.uFog.value = w.fog;
    u.uFlash.value = w.flash;

    const e = sd.y;
    this.sunElev = e;
    const day = smooth(-0.1, 0.2, e);
    this.dayFactor = day;
    this.nightFactor = 1 - smooth(-0.15, 0.08, e);

    // 방향광: 낮엔 해, 밤엔 달
    const useMoon = e < 0.0;
    const dir = useMoon ? u.uMoonDir.value : sd;
    const lightDir = dir.clone();
    if (lightDir.y < 0.12) lightDir.y = 0.12;
    lightDir.normalize();
    this.sun.position.copy(focus).addScaledVector(lightDir, 150);
    this.sun.target.position.copy(focus);
    // 그림자 떨림 방지: 텍셀 단위 스냅
    const texel = (this.shadowRange * 2) / this.sun.shadow.mapSize.x;
    this.sun.target.position.x = Math.round(focus.x / texel) * texel;
    this.sun.target.position.z = Math.round(focus.z / texel) * texel;
    this.sun.position.copy(this.sun.target.position).addScaledVector(lightDir, 150);

    const cloudDim = 1 - w.cloud * 0.78 - w.fog * 0.3;
    if (!useMoon) {
      const warm = 1 - smooth(0.05, 0.45, e);
      this._sunCol.setRGB(1.0, lerp(0.96, 0.66, warm), lerp(0.9, 0.42, warm));
      this.sun.color.copy(this._sunCol);
      this.sun.intensity = 3.4 * smooth(-0.02, 0.12, e) * cloudDim;
    } else {
      this.sun.color.setRGB(0.62, 0.72, 1.0);
      this.sun.intensity = 0.28 * smooth(0.0, 0.2, md.y) * (1 - w.cloud * 0.85);
    }
    this.sun.castShadow = this.sun.intensity > 0.05;

    // 하늘빛/지면 반사광
    const skyDay = new THREE.Color(0x9fc4f2), skyNight = new THREE.Color(0x26324a), skyGrey = new THREE.Color(0x9aa2ae);
    const sky = skyNight.clone().lerp(skyDay, day).lerp(skyGrey.clone().multiplyScalar(0.3 + day * 0.7), w.cloud * 0.7);
    this.hemi.color.copy(sky);
    this.hemi.groundColor.setRGB(0.36 * (0.15 + day * 0.85), 0.32 * (0.15 + day * 0.85), 0.25 * (0.15 + day * 0.85));
    this.hemi.intensity = lerp(0.1, 1.05, day) * (1 - w.storm * 0.35) + w.flash * 6;

    // 안개 색 = 지평선 색
    const fogDay = new THREE.Color(0xa9c6e6), fogNight = new THREE.Color(0x0b1220), fogDusk = new THREE.Color(0xd99a70);
    const twilight = smooth(-0.22, 0.0, e) * (1 - smooth(0.0, 0.28, e));
    const fc = fogNight.clone().lerp(fogDay, day).lerp(fogDusk, twilight * 0.55);
    fc.lerp(new THREE.Color(0x8d939b).multiplyScalar(0.12 + day * 0.88), Math.max(w.cloud * 0.8, w.fog));
    if (w.flash > 0) fc.lerp(new THREE.Color(0xc8d0ff), w.flash * 0.5);
    this.fog.color.copy(fc);
    u.uFogColor.value.copy(fc);
    this.fog.density = 0.0035 + w.fog * 0.045 + w.rain * 0.006 + this.nightFactor * 0.004;

    this.dome.position.copy(focus);

    // 환경맵 주기적 갱신
    this.envTimer -= dt;
    if (this.envTimer <= 0) {
      this.envTimer = 2.5;
      this.updateEnv();
    }
  }

  updateEnv() {
    const g = 0.1 + this.dayFactor * 0.6;
    this.envGround.material.color.setRGB(0.32 * g, 0.3 * g, 0.24 * g);
    const rt = this.pmrem.fromScene(this.envScene, 0.02, 0.1, 100);
    if (this.envRT) this.envRT.dispose();
    this.envRT = rt;
    this.scene.environment = rt.texture;
    this.scene.environmentIntensity = 0.08 + this.dayFactor * 0.92;
  }
}
