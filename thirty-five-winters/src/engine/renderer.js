// WebGL renderer + a single full-screen grading pass that gives every chapter its archival-print look:
// per-chapter lift/gamma/gain, warm/cool split toning, paper fibre grain, vignette, injury desaturation,
// binocular mask and fades. No blood-red overlays: injury is shown as colour draining from the frame.
import * as THREE from 'three';

const VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const FRAG = `
precision highp float;
uniform sampler2D tDiffuse; uniform float uTime; uniform vec2 uRes;
uniform vec3 uLift; uniform vec3 uGamma; uniform vec3 uGain; uniform float uSat; uniform vec3 uShadowTint; uniform vec3 uHighTint;
uniform float uGrain; uniform float uVignette; uniform float uInjury; uniform float uBino; uniform float uFade; uniform float uFlash;
uniform float uCB; // colour-blind safe remap strength (deutan/protan simulation correction approximation)
varying vec2 vUv;
uniform float uExposure;
vec3 RRTAndODTFit(vec3 v){ vec3 a = v*(v+0.0245786)-0.000090537; vec3 b = v*(0.983729*v+0.4329510)+0.238081; return a/b; }
vec3 aces(vec3 color){
  const mat3 I = mat3(vec3(0.59719,0.07600,0.02840), vec3(0.35458,0.90834,0.13383), vec3(0.04823,0.01566,0.83777));
  const mat3 O = mat3(vec3(1.60475,-0.10208,-0.00327), vec3(-0.53108,1.10813,-0.07276), vec3(-0.07367,-0.00605,1.07602));
  color *= uExposure / 0.6; color = I * color; color = RRTAndODTFit(color); color = O * color; return clamp(color, 0.0, 1.0); }
vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
void main(){
  vec3 c = toSRGB(aces(texture2D(tDiffuse, vUv).rgb));
  // grade
  c = max(vec3(0.0), c * uGain + uLift * (1.0 - c));
  c = pow(c, 1.0 / uGamma);
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(l), c, uSat * (1.0 - uInjury * 0.75));
  c += mix(uShadowTint, uHighTint, smoothstep(0.15, 0.8, l)) * 0.6;
  // paper fibres + grain
  vec2 px = vUv * uRes;
  float fib = vnoise(px * vec2(0.02, 0.35)) * 0.5 + vnoise(px * vec2(0.3, 0.015)) * 0.5;
  float g = hash(px + fract(uTime) * 91.0) - 0.5;
  c += (g * 0.06 + (fib - 0.5) * 0.035) * uGrain;
  // vignette
  vec2 d = vUv - 0.5; d.x *= uRes.x / uRes.y;
  float v = smoothstep(0.95, 0.25, length(d));
  c *= mix(1.0, v, uVignette + uInjury * 0.45);
  // binocular mask (two overlapping circles)
  if (uBino > 0.0) {
    vec2 q = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
    float m = min(length(q - vec2(-0.22, 0.0)), length(q - vec2(0.22, 0.0)));
    float mask = smoothstep(0.47, 0.43, m);
    c = mix(c, c * mask, uBino);
    c += vec3(0.0, 0.01, 0.02) * mask * uBino;
  }
  c += uFlash;
  c *= 1.0 - uFade;
  gl_FragColor = vec4(c, 1.0);
}`;

export const GRADES = {
  neutral: { lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1], sat: 1, sh: [0, 0, 0], hi: [0, 0, 0] },
  sepia1910: { lift: [0.04, 0.025, 0.0], gamma: [1.02, 1.0, 0.95], gain: [1.02, 0.98, 0.9], sat: 0.62, sh: [0.012, 0.004, -0.01], hi: [0.02, 0.012, -0.006] },
  spring: { lift: [0.01, 0.015, 0.0], gamma: [1, 1.02, 0.98], gain: [1.02, 1.02, 0.96], sat: 0.86, sh: [0.0, 0.004, 0.01], hi: [0.015, 0.01, 0] },
  night: { lift: [0.0, 0.01, 0.03], gamma: [0.95, 1.0, 1.08], gain: [0.86, 0.95, 1.1], sat: 0.6, sh: [-0.01, 0.0, 0.025], hi: [0.0, 0.006, 0.02] },
  summer: { lift: [0.0, 0.01, 0.0], gamma: [1.0, 1.03, 1.0], gain: [1.0, 1.02, 0.95], sat: 0.92, sh: [0.0, 0.006, 0.006], hi: [0.02, 0.014, 0.0] },
  autumn: { lift: [0.015, 0.008, 0.0], gamma: [1.02, 1.0, 0.97], gain: [1.03, 0.99, 0.92], sat: 0.85, sh: [0.0, 0.0, 0.015], hi: [0.03, 0.012, -0.01] },
  winter: { lift: [0.01, 0.02, 0.035], gamma: [0.97, 1.0, 1.05], gain: [0.95, 0.99, 1.06], sat: 0.55, sh: [-0.006, 0.0, 0.02], hi: [0.01, 0.01, 0.015] },
  monsoon: { lift: [0.0, 0.02, 0.015], gamma: [1.0, 1.05, 1.0], gain: [0.94, 1.0, 0.95], sat: 0.8, sh: [0.0, 0.01, 0.01], hi: [0.01, 0.015, 0.0] },
  dusk: { lift: [0.03, 0.01, 0.02], gamma: [1.05, 1.0, 0.98], gain: [1.08, 0.95, 0.88], sat: 0.85, sh: [0.0, -0.004, 0.02], hi: [0.035, 0.012, -0.01] },
  fog: { lift: [0.04, 0.04, 0.045], gamma: [1, 1, 1.02], gain: [0.95, 0.96, 0.98], sat: 0.6, sh: [0, 0.004, 0.01], hi: [0.01, 0.01, 0.01] },
  dawn1945: { lift: [0.02, 0.015, 0.0], gamma: [1.04, 1.02, 0.97], gain: [1.06, 1.02, 0.94], sat: 0.95, sh: [0.0, 0.0, 0.02], hi: [0.03, 0.018, 0.0] },
};

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const mobile = matchMedia('(pointer: coarse)').matches;
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.toneMapping = THREE.ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 1.0;
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.PCFSoftShadowMap;
    this.quality = mobile ? 'low' : 'high';
    this.rt = new THREE.WebGLRenderTarget(4, 4, { samples: mobile ? 0 : 4, type: THREE.HalfFloatType });
    this.rt.texture.colorSpace = THREE.LinearSRGBColorSpace;
    this.uniforms = {
      tDiffuse: { value: this.rt.texture }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) },
      uLift: { value: new THREE.Vector3() }, uGamma: { value: new THREE.Vector3(1, 1, 1) }, uGain: { value: new THREE.Vector3(1, 1, 1) },
      uSat: { value: 1 }, uShadowTint: { value: new THREE.Vector3() }, uHighTint: { value: new THREE.Vector3() },
      uGrain: { value: 1 }, uVignette: { value: 0.35 }, uInjury: { value: 0 }, uBino: { value: 0 }, uFade: { value: 0 }, uFlash: { value: 0 }, uCB: { value: 0 }, uExposure: { value: 1 },
    };
    this.post = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms, depthTest: false, depthWrite: false, toneMapped: false }));
    this.postScene = new THREE.Scene(); this.postScene.add(this.post);
    this.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.target = { ...GRADES.neutral };
    this.setGrade('neutral', true);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.gl.info.autoReset = false;
  }
  get pixelRatio() {
    const dpr = window.devicePixelRatio || 1;
    return { low: Math.min(dpr, 1) * 0.75, medium: Math.min(dpr, 1.25), high: Math.min(dpr, 2) }[this.quality];
  }
  setQuality(q) {
    this.quality = q;
    this.gl.shadowMap.enabled = q !== 'low';
    this.resize();
  }
  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.gl.setPixelRatio(this.pixelRatio);
    this.gl.setSize(w, h, false);
    const pr = this.gl.getPixelRatio();
    this.rt.setSize(Math.floor(w * pr), Math.floor(h * pr));
    this.uniforms.uRes.value.set(w * pr, h * pr);
    this.onResize?.(w, h);
  }
  setGrade(name, instant = false) {
    const g = GRADES[name] || GRADES.neutral;
    this.target = g;
    if (instant) this._applyGrade(1);
  }
  _applyGrade(k) {
    const u = this.uniforms, g = this.target;
    const mix = (vec, arr) => vec.set(vec.x + (arr[0] - vec.x) * k, vec.y + (arr[1] - vec.y) * k, vec.z + (arr[2] - vec.z) * k);
    mix(u.uLift.value, g.lift); mix(u.uGamma.value, g.gamma); mix(u.uGain.value, g.gain);
    mix(u.uShadowTint.value, g.sh); mix(u.uHighTint.value, g.hi);
    u.uSat.value += (g.sat - u.uSat.value) * k;
  }
  render(scene, camera, dt) {
    this.uniforms.uTime.value += dt;
    this._applyGrade(Math.min(1, dt * 2));
    this.gl.info.reset();
    this.gl.setRenderTarget(this.rt);
    this.gl.render(scene, camera);
    this.gl.setRenderTarget(null);
    this.gl.render(this.postScene, this.postCam);
  }
}
