import * as THREE from 'three';
import { clamp, lerp, smoothstep, mulberry32, TAU, weightedPick, dampFactor } from '../core/util.js';
import { glowSprite } from '../core/util3d.js';

const SKY_VERT = `
varying vec3 vDir;
void main(){
  vDir = normalize(position);
  vec4 p = modelViewMatrix * vec4(position,1.0);
  gl_Position = projectionMatrix * p;
  gl_Position.z = gl_Position.w * 0.99999;
}`;
const SKY_FRAG = `
precision highp float;
varying vec3 vDir;
uniform vec3 uSun, uZenith, uHorizon, uGround, uNight, uSunCol;
uniform float uDay, uStars, uSpace, uTime, uStorm;
uniform vec3 uStormCol;
float hash(vec3 p){ p = fract(p*0.3183099+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float stars(vec3 d){
  vec3 g = d*220.0; vec3 i = floor(g); vec3 f = fract(g)-0.5;
  float h = hash(i); float s = step(0.9965,h);
  float m = smoothstep(0.5,0.0,length(f))*s;
  return m*(0.4+0.8*fract(h*57.0));
}
void main(){
  vec3 d = normalize(vDir);
  float h = d.y;
  float sd = max(dot(d,uSun),0.0);
  float sunUp = smoothstep(-0.12,0.18,uSun.y);
  vec3 dayCol = mix(uHorizon, uZenith, pow(clamp(h,0.0,1.0),0.55));
  // twilight band: warm light near the horizon in the sun's direction
  float tw = (1.0 - smoothstep(0.0,0.35,abs(uSun.y)))*pow(sd,2.5)*smoothstep(0.35,0.0,h);
  dayCol += vec3(1.0,0.45,0.2)*tw*0.9;
  vec3 col = mix(uNight, dayCol, sunUp);
  // below horizon
  col = mix(col, mix(uGround, uNight, 1.0-uDay)*0.8, smoothstep(0.02,-0.12,h));
  // sun disc and glow
  float disc = smoothstep(0.9993,0.9998,sd);
  float glow = pow(sd,24.0)*0.65 + pow(sd,6.0)*0.18;
  col += uSunCol*(disc*6.0 + glow)*sunUp;
  // stars fade in at night and with altitude
  float st = stars(d)*uStars*clamp((1.0-uDay)*1.1 + uSpace, 0.0, 1.0)*smoothstep(-0.05,0.15,h+uSpace);
  col += vec3(st);
  col = mix(col, vec3(0.0), uSpace*smoothstep(0.7,0.0,h+0.4)*0.0);
  col = mix(col, vec3(0.0), uSpace*0.92);
  col += vec3(st)*uSpace;
  // storm veil
  col = mix(col, uStormCol*(0.25+0.75*uDay), uStorm*0.85);
  gl_FragColor = vec4(col,1.0);
}`;

const WEATHER_FX = {
  clear: { fog: 1, dim: 0, wind: 1 },
  sandstorm: { fog: 7, dim: 0.35, wind: 5, col: 0xc08a58, particle: 'dust' },
  sporestorm: { fog: 4, dim: 0.25, wind: 2.5, col: 0x9fd8a8, particle: 'spores' },
  blizzard: { fog: 9, dim: 0.3, wind: 6, col: 0xdce8f4, particle: 'snow' },
  tempest: { fog: 3.5, dim: 0.45, wind: 4, col: 0x607888, particle: 'rain' },
};

export class Atmosphere {
  constructor(scene, planet, quality, rngSeed = 1) {
    this.scene = scene; this.p = planet; this.q = quality;
    this.time = planet.startHour;        // 0..1 day fraction (0.25 = sunrise, 0.5 = noon)
    this.dayFactor = 1;
    this.weather = { type: 'clear', intensity: 0, target: 0, next: 120 + rngSeed % 100, name: 'clear' };
    this.rng = mulberry32(planet.seed + 5);
    this.sunDir = new THREE.Vector3(0, 1, 0);
    this.space = 0; // 0 on the ground .. 1 in orbit (altitude fade)
    this.lightning = 0; this.boltCool = 8;

    // sky dome
    this.skyMat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        uSun: { value: new THREE.Vector3(0, 1, 0) }, uZenith: { value: new THREE.Color(planet.sky.zenith) }, uHorizon: { value: new THREE.Color(planet.sky.horizon) },
        uGround: { value: new THREE.Color(planet.sky.ground) }, uNight: { value: new THREE.Color(planet.sky.night) }, uSunCol: { value: new THREE.Color(planet.sky.sun) },
        uDay: { value: 1 }, uStars: { value: planet.sky.stars }, uSpace: { value: 0 }, uTime: { value: 0 }, uStorm: { value: 0 }, uStormCol: { value: new THREE.Color(0x888888) },
      },
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), this.skyMat);
    this.sky.frustumCulled = false; this.sky.renderOrder = -10;
    scene.add(this.sky);

    // lights
    this.sun = new THREE.DirectionalLight(planet.sky.sun, planet.light.sun);
    this.sun.castShadow = quality.shadow;
    if (quality.shadow) {
      const s = this.sun.shadow; s.mapSize.set(quality.shadowRes, quality.shadowRes);
      const c = s.camera; c.near = 10; c.far = 600; c.left = -70; c.right = 70; c.top = 70; c.bottom = -70; c.updateProjectionMatrix?.(); s.bias = -0.0006; s.normalBias = 0.6;
    }
    scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(planet.sky.zenith, planet.sky.ground, planet.light.amb);
    scene.add(this.hemi);
    this.fogColor = new THREE.Color(planet.fog.day);
    scene.fog = new THREE.FogExp2(this.fogColor, planet.fog.density);
    this.baseFog = planet.fog.density;

    // secondary bodies (moons / gas giants in the sky)
    this.bodies = [];
    for (const b of planet.skyBodies || []) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: b.color, fog: false }));
      const d = new THREE.Vector3(...b.dir).normalize();
      m.position.copy(d).multiplyScalar(800); m.scale.setScalar(800 * b.size);
      m.userData.dir = d; this.sky.add(m); this.bodies.push(m);
      const halo = glowSprite(b.color, 2.6, 0.18); m.add(halo);
    }

    // ambient + weather particles around the camera
    this.pCount = quality.flora > 0.5 ? 1800 : 900;
    this.pPos = new Float32Array(this.pCount * 3); this.pVel = new Float32Array(this.pCount * 3);
    const r = mulberry32(3);
    for (let i = 0; i < this.pCount; i++) { this.pPos[i * 3] = (r() - 0.5) * 60; this.pPos[i * 3 + 1] = (r() - 0.2) * 30; this.pPos[i * 3 + 2] = (r() - 0.5) * 60; }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3));
    this.pMat = new THREE.PointsMaterial({ color: planet.particle.color, size: planet.particle.size, transparent: true, opacity: 0.5, depthWrite: false, sizeAttenuation: true });
    this.points = new THREE.Points(pg, this.pMat); this.points.frustumCulled = false;
    scene.add(this.points);
    this.wind = new THREE.Vector3(1, 0, 0.3).normalize();
    this.windSpeed = 1;
    this.flash = new THREE.AmbientLight(0xcfe0ff, 0); scene.add(this.flash);
    this.updateSun();
  }

  get weatherType() { return this.weather.type; }
  get storm() { return this.weather.type !== 'clear' ? this.weather.intensity : 0; }

  setSpace(v) { this.space = clamp(v, 0, 1); }

  updateSun() {
    const a = (this.time - 0.25) * TAU;
    const tilt = this.p.axisTilt;
    this.sunDir.set(Math.cos(a) * Math.cos(tilt), Math.sin(a), Math.cos(a) * Math.sin(tilt) + 0.15).normalize();
    this.dayFactor = smoothstep(-0.12, 0.25, this.sunDir.y);
  }

  // temperature in °C given the weather and time of day
  ambientTemp() {
    const t = this.p.temp;
    const day = smoothstep(-0.15, 0.35, this.sunDir.y);
    let v = lerp(t.min, t.max, day);
    if (this.weather.type === 'blizzard') v -= 22 * this.weather.intensity;
    if (this.weather.type === 'sandstorm') v += 6 * this.weather.intensity;
    return v;
  }

  update(dt, camPos, focus, timeScale = 1) {
    this.time = (this.time + dt / this.p.dayLength * timeScale) % 1;
    this.updateSun();
    const w = this.weather;
    // weather scheduler
    w.next -= dt;
    if (w.next <= 0) {
      const pick = weightedPick(this.rng, this.p.weather.list, (x) => x[1]);
      const type = pick ? pick[0] : 'clear';
      w.target = type === 'clear' ? 0 : 0.55 + this.rng() * 0.45;
      w.pendingType = type;
      const [a, b] = this.p.weather.interval; w.next = a + this.rng() * (b - a);
    }
    if (w.pendingType) {
      if (w.type !== w.pendingType) { if (w.intensity > 0.02) w.target = 0; else { w.type = w.pendingType; w.target = w.pendingType === 'clear' ? 0 : w.target || 0.7; } }
      if (w.type === w.pendingType) w.pendingType = null;
    }
    w.intensity += (w.target - w.intensity) * dampFactor(0.25, dt);
    if (w.intensity < 0.015 && w.target === 0) { w.intensity = 0; if (w.type !== 'clear') w.type = 'clear'; }
    const fx = WEATHER_FX[w.type] || WEATHER_FX.clear;
    const I = w.intensity;
    this.windSpeed = lerp(1, fx.wind, I);

    // lighting
    const day = this.dayFactor;
    const sunCol = new THREE.Color(this.p.sky.sun);
    const warm = 1 - smoothstep(0.05, 0.35, this.sunDir.y);
    sunCol.lerp(new THREE.Color(1.0, 0.55, 0.28), warm * 0.85);
    this.sun.color.copy(sunCol);
    this.sun.intensity = this.p.light.sun * day * (1 - (fx.dim || 0) * I) * (1 - this.space * 0.0);
    this.sun.position.copy(focus).addScaledVector(this.sunDir, 300);
    this.sun.target.position.copy(focus);
    this.hemi.intensity = lerp(0.07, this.p.light.amb, day) * (1 - 0.2 * I);
    this.hemi.color.set(this.p.sky.zenith).lerp(new THREE.Color(this.p.sky.night), 1 - day);
    this.hemi.groundColor.set(this.p.sky.ground).multiplyScalar(0.3 + 0.7 * day);

    // fog
    const fogDay = new THREE.Color(this.p.fog.day), fogNight = new THREE.Color(this.p.fog.night);
    this.fogColor.copy(fogNight).lerp(fogDay, day).lerp(new THREE.Color(1.0, 0.55, 0.35), warm * 0.18 * day);
    if (fx.col && I > 0) this.fogColor.lerp(new THREE.Color(fx.col).multiplyScalar(0.25 + 0.75 * day), I * 0.8);
    const spaceFade = 1 - this.space;
    this.scene.fog.color.copy(this.fogColor);
    this.scene.fog.density = this.baseFog * lerp(1, fx.fog, I) * spaceFade * (1 + (1 - day) * 0.4);

    // sky uniforms
    const u = this.skyMat.uniforms;
    u.uSun.value.copy(this.sunDir); u.uDay.value = day; u.uSpace.value = this.space; u.uStorm.value = I * (fx.col ? 1 : 0);
    if (fx.col) u.uStormCol.value.set(fx.col);
    u.uHorizon.value.set(this.p.sky.horizon).lerp(this.fogColor, 0.35);
    this.sky.position.copy(camPos);
    for (const b of this.bodies) {
      b.visible = this.space < 0.9;
      b.material.color.set(0xffffff).lerp(new THREE.Color(this.p.skyBodies[0].color), 0.5).multiplyScalar(0.35 + 0.65 * (1 - day * 0.6));
    }

    // lightning during tempests
    if (w.type === 'tempest' && I > 0.4) {
      this.boltCool -= dt;
      if (this.boltCool <= 0) { this.lightning = 1; this.boltCool = 4 + this.rng() * 9; this.onThunder?.(); }
    }
    this.lightning = Math.max(0, this.lightning - dt * 3.5);
    this.flash.intensity = this.lightning * 2.2;

    this.updateParticles(dt, camPos, fx, I, day);
  }

  updateParticles(dt, cam, fx, I, day) {
    const type = fx.particle || this.p.id === 'vesper' ? (fx.particle || 'spores') : null;
    const ambientKind = { khepri: 'dust', vesper: 'spores', nivalis: 'snow', pelagos: 'spray' }[this.p.id];
    const kind = fx.particle || ambientKind;
    const strength = I > 0 ? 0.35 + 0.65 * I : (ambientKind === 'snow' ? 0.35 : 0.45);
    this.pMat.opacity = clamp(strength, 0, 1) * (kind === 'spores' ? lerp(0.9, 0.5, day) : 0.7);
    this.pMat.size = this.p.particle.size * (kind === 'rain' ? 0.5 : kind === 'dust' ? 1.1 : 1) * (1 + I * 0.5);
    const p = this.pPos, N = this.pCount;
    const wx = this.wind.x * this.windSpeed * 2.5, wz = this.wind.z * this.windSpeed * 2.5;
    let fall = 0;
    if (kind === 'snow') fall = -1.4 - I * 3; else if (kind === 'rain') fall = -22; else if (kind === 'spores') fall = 0.15; else fall = -0.1;
    const sx = kind === 'rain' ? wx * 0.6 : wx, sz = kind === 'rain' ? wz * 0.6 : wz;
    const speedMul = I > 0 && (kind === 'dust' || kind === 'snow') ? 4 : 1;
    // particles are stored in camera-relative space inside a 60 m box and wrapped
    const t = performance.now() * 0.001;
    for (let i = 0; i < N; i++) {
      const k = i * 3;
      p[k] += (sx * speedMul + Math.sin(t + i) * 0.4) * dt;
      p[k + 1] += (fall + Math.cos(t * 0.7 + i * 1.3) * 0.25) * dt;
      p[k + 2] += (sz * speedMul + Math.cos(t * 0.9 + i) * 0.4) * dt;
      if (p[k] > 30) p[k] -= 60; else if (p[k] < -30) p[k] += 60;
      if (p[k + 1] > 22) p[k + 1] -= 34; else if (p[k + 1] < -12) p[k + 1] += 34;
      if (p[k + 2] > 30) p[k + 2] -= 60; else if (p[k + 2] < -30) p[k + 2] += 60;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.position.copy(cam);
    this.points.visible = this.space < 0.5;
    // spores glow at night
    if (kind === 'spores') this.pMat.color.set(this.p.particle.color); else this.pMat.color.set(this.p.particle.color).multiplyScalar(0.4 + 0.6 * day);
  }

  serialize() { return { time: this.time, w: { type: this.weather.type, intensity: this.weather.intensity, next: this.weather.next } }; }
  restore(d) { if (!d) return; this.time = d.time ?? this.time; if (d.w) Object.assign(this.weather, d.w, { target: d.w.type === 'clear' ? 0 : 0.7 }); this.updateSun(); }

  dispose() {
    this.scene.remove(this.sky, this.sun, this.sun.target, this.hemi, this.points, this.flash);
    this.sky.geometry.dispose(); this.skyMat.dispose(); this.points.geometry.dispose(); this.pMat.dispose();
    this.scene.fog = null;
  }
}
