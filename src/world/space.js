import * as THREE from 'three';
import { PLANETS, PLANET_ORDER, SYSTEM } from '../data/planets.js';
import { Noise } from '../core/noise.js';
import { canvasTex, glowSprite, mergeParts, propMaterial, geoBox, geoCyl, geoCone, geoSphere, geoTorus, rockGeo } from '../core/util3d.js';
import { mulberry32, TAU, clamp, smoothstep } from '../core/util.js';
import { landingZoneDir } from './frames.js';

const NEAR_LIMIT = 30000;

function planetTexture(def) {
  const n = new Noise(def.seed);
  const W = 512, H = 256;
  const pal = def.palette;
  const c = [new THREE.Color(pal.low), new THREE.Color(pal.mid), new THREE.Color(pal.high), new THREE.Color(pal.rock)];
  const tmp = new THREE.Color();
  return canvasTex(W, H, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const lat = (y / h - 0.5) * Math.PI;
      for (let x = 0; x < w; x++) {
        const lon = (x / w) * TAU;
        const px = Math.cos(lat) * Math.cos(lon) * 3, py = Math.sin(lat) * 3, pz = Math.cos(lat) * Math.sin(lon) * 3;
        const e = n.fbm(px * 1.2 + pz * 0.7, py * 1.2 - pz * 0.5, 5) * 0.5 + 0.5;
        const e2 = n.fbm(py * 2.1 + 5, px * 2.1 - pz, 3) * 0.5 + 0.5;
        if (def.id === 'pelagos') {
          if (e < 0.62) tmp.copy(c[0]).lerp(new THREE.Color(0x2d86b8), smoothstep(0.35, 0.6, e)); else tmp.copy(c[1]).lerp(c[2], smoothstep(0.62, 0.8, e));
        } else if (def.id === 'nivalis') {
          tmp.copy(c[1]).lerp(c[0], e2 * 0.6).lerp(c[2], smoothstep(0.5, 0.8, e)); if (Math.abs(lat) > 1.15) tmp.lerp(c[2], 0.7);
        } else if (def.id === 'vesper') {
          tmp.copy(c[0]).lerp(c[1], smoothstep(0.3, 0.6, e)).lerp(c[2], smoothstep(0.6, 0.85, e2)); if (e < 0.38) tmp.set(0x1a5a7a);
        } else {
          tmp.copy(c[0]).lerp(c[1], smoothstep(0.35, 0.6, e)).lerp(c[2], smoothstep(0.55, 0.9, e2)); tmp.multiplyScalar(0.85 + 0.3 * Math.sin(lat * 18 + e * 3) * def.space.bands + 0.15);
        }
        const k = (y * w + x) * 4;
        img.data[k] = tmp.r * 255; img.data[k + 1] = tmp.g * 255; img.data[k + 2] = tmp.b * 255; img.data[k + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
}
function cloudTexture(def) {
  const n = new Noise(def.seed + 9);
  const W = 256, H = 128;
  return canvasTex(W, H, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const lat = (y / h - 0.5) * Math.PI;
      for (let x = 0; x < w; x++) {
        const lon = (x / w) * TAU;
        const px = Math.cos(lat) * Math.cos(lon) * 3, py = Math.sin(lat) * 3, pz = Math.cos(lat) * Math.sin(lon) * 3;
        const v = Math.max(0, n.fbm(px * 1.6 + pz, py * 1.6 - px, 4) * 0.5 + 0.5 - 0.42) * 2.6;
        const k = (y * w + x) * 4; img.data[k] = img.data[k + 1] = img.data[k + 2] = 255; img.data[k + 3] = Math.min(255, v * 255 * def.space.bands * 0 + v * 255 * (def.id === 'khepri' ? 0.35 : 0.85));
      }
    }
    ctx.putImageData(img, 0, 0);
  });
}

const ATMO_VERT = `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`;
const ATMO_FRAG = `varying vec3 vN; varying vec3 vV; uniform vec3 uCol; uniform vec3 uSunDir; uniform float uStr;
void main(){ float f = pow(1.0 - max(dot(normalize(vN), normalize(vV)), 0.0), 3.0); float lit = clamp(dot(normalize(vN), uSunDir)*0.8+0.35, 0.0, 1.0); gl_FragColor = vec4(uCol, f*uStr*lit); }`;

export class SpaceWorld {
  constructor(game) {
    this.game = game;
    this.scene = new THREE.Scene();
    this.near = new THREE.Group(); this.far = new THREE.Group();
    this.scene.add(this.far, this.near);
    this.bodies = []; // {id,type,name,pos:Vector3,radius,obj,pass}
    this.byId = {};
    this.projectiles = [];
    this.raiders = [];
    this.time = 0;
    this.buildStars();
    this.buildStar();
    for (const id of PLANET_ORDER) this.buildPlanet(PLANETS[id]);
    this.buildAsteroidsAndWreck();
    this.buildRing();
    this.buildMarket();
    this.buildNebula();
    this.sunLight = new THREE.PointLight(0xfff0d8, 2.6, 0, 0); this.scene.add(this.sunLight);
    this.ambient = new THREE.AmbientLight(0x202838, 0.5); this.scene.add(this.ambient);
  }

  reg(b) { this.bodies.push(b); this.byId[b.id] = b; return b; }

  buildStars() {
    const rng = mulberry32(5);
    const n = 3200, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = rng() * 2 - 1, a = rng() * TAU, r = Math.sqrt(1 - u * u);
      const R = 3.5e6;
      pos[i * 3] = Math.cos(a) * r * R; pos[i * 3 + 1] = u * R; pos[i * 3 + 2] = Math.sin(a) * r * R;
      const b = 0.4 + rng() * 0.6, tint = rng();
      col[i * 3] = b * (tint < 0.3 ? 1 : 0.85); col[i * 3 + 1] = b * 0.9; col[i * 3 + 2] = b * (tint > 0.7 ? 1 : 0.9);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.stars = new THREE.Points(g, new THREE.PointsMaterial({ size: 20000, sizeAttenuation: true, vertexColors: true, fog: false, depthWrite: false, transparent: true }));
    this.stars.frustumCulled = false;
    this.far.add(this.stars);
    // faint milky band
    const band = new THREE.Mesh(new THREE.SphereGeometry(3.4e6, 24, 12), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, transparent: true, fog: false,
      vertexShader: 'varying vec3 v; void main(){ v = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'varying vec3 v; void main(){ float b = exp(-pow(dot(v, normalize(vec3(0.3,0.9,0.2)))*3.2, 2.0)); float n = 0.5+0.5*sin(v.x*18.0+sin(v.z*11.0)*2.0)*sin(v.y*14.0+v.x*5.0); gl_FragColor = vec4(vec3(0.28,0.3,0.5)*b*(0.35+0.5*n), b*0.5); }',
    }));
    band.frustumCulled = false; this.far.add(band); this.band = band;
  }

  buildStar() {
    const r = SYSTEM.star.radius;
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.SphereGeometry(r, 40, 24), new THREE.MeshBasicMaterial({ color: SYSTEM.star.color, fog: false })));
    const glow = glowSprite(SYSTEM.star.glow, r * 7, 0.9); g.add(glow);
    const glow2 = glowSprite(0xffffff, r * 3.2, 0.7); g.add(glow2);
    this.far.add(g);
    this.reg({ id: 'star', type: 'star', name: 'Aurelia (star)', pos: new THREE.Vector3(0, 0, 0), radius: r, obj: g, alwaysFar: true });
  }

  buildPlanet(def) {
    const R = def.radius, g = new THREE.Group();
    const tex = planetTexture(def);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(R, 64, 40), mat); g.add(body);
    const clouds = new THREE.Mesh(new THREE.SphereGeometry(R * 1.012, 48, 30), new THREE.MeshStandardMaterial({ map: cloudTexture(def), transparent: true, color: def.space.cloud, roughness: 1, depthWrite: false }));
    g.add(clouds);
    const atmoMat = new THREE.ShaderMaterial({
      vertexShader: ATMO_VERT, fragmentShader: ATMO_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
      uniforms: { uCol: { value: new THREE.Color(def.space.atmo) }, uSunDir: { value: new THREE.Vector3(1, 0, 0) }, uStr: { value: 1.6 } },
    });
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.07, 48, 30), atmoMat); g.add(atmo);
    // a small moon
    const moon = new THREE.Mesh(new THREE.SphereGeometry(R * 0.22, 24, 16), new THREE.MeshStandardMaterial({ color: 0x9a9690, roughness: 1 }));
    const moonPos = new THREE.Vector3(R * 3.2, R * 0.6, -R * 1.6); moon.position.copy(moonPos); g.add(moon);
    this.near.add(g);
    const b = this.reg({ id: def.id, type: 'planet', name: def.name, def, pos: new THREE.Vector3(...def.orbitPos), radius: R, obj: g, clouds, atmoMat, hasAtmo: true, scanR: R * 6 });
    return b;
  }

  buildRing() {
    const n = PLANETS.nivalis, R = n.radius * 1.95;
    const g = new THREE.Group();
    const mat = propMaterial({ metalness: 0.7, roughness: 0.3, glowColor: 0xa27bff, glowPower: 1.6 });
    const segs = [];
    for (let k = 0; k < 3; k++) {
      const tor = new THREE.TorusGeometry(R, 140, 8, 96, Math.PI * 2 / 3 - 0.18);
      tor.applyMatrix4(new THREE.Matrix4().makeRotationZ((k / 3) * TAU));
      segs.push({ geo: tor, color: 0x6f6a82 });
    }
    for (let k = 0; k < 3; k++) { const a = (k / 3) * TAU + Math.PI / 3 - 0.0; segs.push({ geo: geoSphere(420, 12, 8), pos: [Math.cos(a) * R, Math.sin(a) * R, 0], color: 0xa27bff, emissive: true }); }
    segs.push({ geo: new THREE.TorusGeometry(R * 0.985, 28, 6, 96), color: 0xa27bff, emissive: true });
    const mesh = new THREE.Mesh(mergeParts(segs), mat);
    g.add(mesh);
    g.rotation.set(1.1, 0.3, 0.2);
    this.near.add(g);
    this.reg({ id: 'orbital_ring', type: 'structure', name: 'Anthelion Ring', pos: new THREE.Vector3(...n.orbitPos), radius: R + 400, ringR: R, obj: g, scan: { entry: 'orbital_ring', keys: ['id', 'arch', 'inscr'] }, scanR: R * 1.3, spin: 0.01, hint: true });
  }

  buildAsteroidsAndWreck() {
    const center = new THREE.Vector3(-170000, 6000, 150000);
    const rng = mulberry32(77);
    const N = 360;
    this.asteroids = [];
    const geos = [rockGeo(1, 1, 1, 0.8, 0.4), rockGeo(2, 1, 1, 0.9, 0.35), rockGeo(3, 1, 2, 0.7, 0.3)];
    const mat = new THREE.MeshStandardMaterial({ color: 0x8a8278, roughness: 1, flatShading: true });
    const ims = geos.map((g) => new THREE.InstancedMesh(g, mat, Math.ceil(N / 3) + 1));
    const counts = [0, 0, 0];
    const d = new THREE.Object3D();
    for (let i = 0; i < N; i++) {
      const a = rng() * TAU, r = Math.pow(rng(), 0.6) * 6500, y = (rng() - 0.5) * 1600 * (1 - r / 7000);
      const s = 20 + Math.pow(rng(), 3) * 260;
      const p = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r).add(center);
      if (p.distanceTo(center) < 450) continue; // clear space around the wreck
      const k = i % 3; d.position.copy(p); d.rotation.set(rng() * 6, rng() * 6, rng() * 6); d.scale.set(s, s * (0.6 + rng() * 0.5), s * (0.8 + rng() * 0.4)); d.updateMatrix();
      ims[k].setMatrixAt(counts[k]++, d.matrix);
      this.asteroids.push({ pos: p, r: s * 0.85 });
    }
    ims.forEach((im, k) => { im.count = counts[k]; im.instanceMatrix.needsUpdate = true; im.frustumCulled = false; this.near.add(im); });
    this.asteroidIM = ims;
    this.asteroidCenter = center;
    // field marker registered as a body so near/far logic can show it on nav
    this.reg({ id: 'asteroids', type: 'field', name: 'Asteroid Field', pos: center.clone(), radius: 7000, obj: new THREE.Group(), noRender: true, nav: true });

    // wreck of RV Calloway
    const wreckPos = center.clone().add(new THREE.Vector3(120, 30, 60));
    const wg = new THREE.Group();
    const parts = [
      { geo: geoCyl(26, 30, 190, 10), pos: [0, 0, 0], rot: [Math.PI / 2, 0, 0], color: 0xa8a8b0 },
      { geo: geoCone(26, 50, 10), pos: [0, 0, 118], rot: [Math.PI / 2, 0, 0], color: 0x888894 },
      { geo: geoBox(120, 4, 36), pos: [70, 10, -40], rot: [0.3, 0.2, 0.5], color: 0x7a7a86 },
      { geo: geoBox(90, 4, 36), pos: [-60, -8, -30], rot: [-0.2, 0.1, -0.4], color: 0x7a7a86 },
      { geo: geoBox(26, 12, 40), pos: [30, 20, 60], rot: [0.4, 0.3, 0.1], color: 0x5a5a66 },
      { geo: geoCyl(18, 20, 80, 8), pos: [0, 0, -120], rot: [Math.PI / 2 + 0.15, 0, 0.1], color: 0x6a6a76 },
      { geo: geoBox(6, 6, 6), pos: [0, 10, 40], color: 0xff6a30, emissive: true },
    ];
    for (let i = 0; i < 24; i++) parts.push({ geo: geoBox(6 + rng() * 14, 2, 6 + rng() * 14), pos: [(rng() - 0.5) * 300, (rng() - 0.5) * 120, (rng() - 0.5) * 300], rot: [rng() * 6, rng() * 6, rng() * 6], color: 0x80808a });
    wg.add(new THREE.Mesh(mergeParts(parts), propMaterial({ metalness: 0.5, roughness: 0.6, glowColor: 0xff6a30, glowPower: 1.2 })));
    wg.rotation.set(0.4, 1.1, 0.2); wg.position.copy(wreckPos);
    this.near.add(wg);
    this.reg({ id: 'calloway', type: 'structure', name: 'RV Calloway (wreck)', pos: wreckPos, radius: 160, obj: wg, scan: { entry: 'calloway_wreck', keys: ['id'] }, scanR: 400, logs: ['calloway_log_1', 'calloway_log_2'] });

    // Kharn raiders patrolling the wreck
    for (let i = 0; i < 2; i++) {
      const rg = new THREE.Group();
      const hull = new THREE.Mesh(mergeParts([
        { geo: geoCone(10, 48, 5), rot: [Math.PI / 2, 0, 0], color: 0x3a2f2a },
        { geo: geoBox(46, 1.6, 14), pos: [0, 0, -8], color: 0x4a3a32 },
        { geo: geoBox(3, 10, 14), pos: [0, 5, -10], color: 0x4a3a32 },
        { geo: geoSphere(2.2, 6, 5), pos: [0, 0, -20], color: 0xff5a2a, emissive: true },
        { geo: geoSphere(1.4, 6, 5), pos: [-20, 0, -4], color: 0xff5a2a, emissive: true },
        { geo: geoSphere(1.4, 6, 5), pos: [20, 0, -4], color: 0xff5a2a, emissive: true },
      ]), propMaterial({ metalness: 0.5, roughness: 0.5, glowColor: 0xff5a2a, glowPower: 1.8 }));
      rg.add(hull); const l = glowSprite(0xff5a2a, 120, 0.7); l.position.z = -22; rg.add(l);
      this.near.add(rg);
      this.raiders.push({ obj: rg, pos: wreckPos.clone().add(new THREE.Vector3(Math.cos(i * 3) * 700, 150 * i, Math.sin(i * 3) * 700)), phase: i * 3.1, cool: 3 + i * 2, hp: 1, alerted: false });
    }
    this.wreckPos = wreckPos;
  }

  buildMarket() {
    const v = PLANETS.vesper;
    const pos = new THREE.Vector3(...v.orbitPos).add(new THREE.Vector3(v.radius * 2.6, v.radius * 0.8, v.radius * 0.5));
    const g = new THREE.Group();
    const amber = propMaterial({ metalness: 0.4, roughness: 0.5, glowColor: 0xffc060, glowPower: 1.7 });
    const parts = [
      { geo: geoTorus(220, 16, 8, 40), rot: [Math.PI / 2, 0, 0], color: 0xb89060 },
      { geo: geoSphere(70, 14, 10), color: 0xd0a870 },
      { geo: geoCyl(14, 14, 520, 8), color: 0x9a7e56 },
      { geo: geoCyl(14, 14, 440, 8), rot: [0, 0, Math.PI / 2], color: 0x9a7e56 },
    ];
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; parts.push({ geo: geoSphere(14, 6, 5), pos: [Math.cos(a) * 220, 0, Math.sin(a) * 220], color: 0xffc060, emissive: true }); }
    for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU; parts.push({ geo: geoBox(60, 30, 60), pos: [Math.cos(a) * 130, 0, Math.sin(a) * 130], color: 0xc8a46c }); parts.push({ geo: geoSphere(8, 6, 4), pos: [Math.cos(a) * 130, 20, Math.sin(a) * 130], color: 0xffd890, emissive: true }); }
    const ring = new THREE.Mesh(mergeParts(parts), amber); g.add(ring);
    g.add(glowSprite(0xffc060, 900, 0.6));
    this.near.add(g);
    this.reg({ id: 'tessera', type: 'station', name: 'Tessera Market (Orrin)', pos, radius: 300, obj: g, spinObj: ring, scan: { entry: 'tessera_market', keys: ['id'] }, scanR: 1500, comm: 3500 });
  }

  buildNebula() {
    const pos = new THREE.Vector3(210000, -24000, -250000);
    const g = new THREE.Group();
    const rng = mulberry32(11);
    for (let i = 0; i < 40; i++) {
      const s = glowSprite([0x8a3aa8, 0x3a6ad0, 0xd04a8a][i % 3], 12000 + rng() * 22000, 0.18);
      s.position.set((rng() - 0.5) * 36000, (rng() - 0.5) * 14000, (rng() - 0.5) * 36000); g.add(s);
    }
    this.far.add(g);
    this.reg({ id: 'nebula', type: 'anomaly', name: 'Cradle Nebula', pos, radius: 22000, obj: g, scan: { entry: 'ion_nebula', keys: ['id', 'deep'] }, scanR: 60000, alwaysFar: true });
  }

  nearestPlanet(p) {
    let best = null, bd = 1e12;
    for (const b of this.bodies) if (b.type === 'planet') { const d = b.pos.distanceTo(p) - b.radius; if (d < bd) { bd = d; best = b; } }
    return { body: best, alt: bd };
  }

  // Scan targets for the ship scanner: positioned in system coords.
  targets(shipPos, range) {
    const out = [];
    for (const b of this.bodies) {
      if (b.type === 'planet') { out.push({ kind: 'planet', entry: b.id, keys: ['orbit'], pos: b.pos.clone(), r: b.radius, id: 'p:' + b.id, body: b }); continue; }
      if (b.scan) out.push({ kind: 'structure', entry: b.scan.entry, keys: b.scan.keys, pos: b.pos.clone(), r: b.scanR || b.radius, id: 'b:' + b.id, body: b });
    }
    return out;
  }

  update(dt, shipPos, shipVel, game) {
    this.time += dt;
    const st = this.byId.star.pos;
    for (const b of this.bodies) {
      if (b.noRender) continue;
      const rel = b.pos.clone().sub(shipPos);
      b.obj.position.copy(rel);
      const d = rel.length() - b.radius;
      b.dist = d;
      const near = !b.alwaysFar && d < NEAR_LIMIT;
      b.pass = near ? 'near' : 'far';
      // reparent between groups
      const want = near ? this.near : this.far;
      if (b.obj.parent !== want) { b.obj.parent?.remove(b.obj); want.add(b.obj); }
      if (b.type === 'planet') {
        b.clouds.rotation.y += dt * 0.004;
        const sunDir = st.clone().sub(b.pos).normalize();
        b.atmoMat.uniforms.uSunDir.value.copy(sunDir);
      }
      if (b.spin) b.obj.rotation.y += dt * b.spin;
      if (b.spinObj) b.spinObj.rotation.y += dt * 0.05;
    }
    // asteroid instances are in system coords: shift the instanced meshes by -shipPos
    for (const im of this.asteroidIM) im.position.copy(shipPos).negate();
    this.stars.position.set(0, 0, 0);
    this.sunLight.position.copy(st).sub(shipPos);
    this.sunLight.intensity = 2.8;
    // raiders
    for (const r of this.raiders) {
      r.phase += dt * 0.05;
      const c = this.wreckPos;
      r.pos.set(c.x + Math.cos(r.phase * 4) * 700, c.y + 120 + Math.sin(r.phase * 3) * 100, c.z + Math.sin(r.phase * 4) * 700);
      r.obj.position.copy(r.pos).sub(shipPos);
      const toPlayer = shipPos.clone().sub(r.pos); const dist = toPlayer.length();
      r.obj.lookAt(r.obj.position.clone().add(toPlayer.normalize().multiplyScalar(1)));
      r.alerted = dist < 2600;
      r.dist = dist;
      if (r.alerted && !game.ship.cruising) {
        r.cool -= dt;
        if (r.cool <= 0) { r.cool = 1.6 + Math.random(); this.fire(r, shipPos, shipVel); }
      }
    }
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.pos.addScaledVector(p.vel, dt); p.life -= dt;
      p.mesh.position.copy(p.pos).sub(shipPos);
      if (p.pos.distanceTo(shipPos) < 14) { game.events.emit('ship:damage', { amount: 7, kind: 'raider' }); p.life = 0; }
      if (p.life <= 0) { this.near.remove(p.mesh); p.mesh.geometry.dispose(); p.mesh.material.dispose(); this.projectiles.splice(i, 1); }
    }
  }

  fire(r, shipPos, shipVel) {
    const lead = shipPos.clone().addScaledVector(shipVel, 0.8);
    const dir = lead.sub(r.pos).normalize();
    const miss = new THREE.Vector3((Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5)).multiplyScalar(0.05);
    dir.add(miss).normalize();
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 40, 5), new THREE.MeshBasicMaterial({ color: 0xff5a2a, fog: false }));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    this.near.add(mesh);
    this.projectiles.push({ pos: r.pos.clone(), vel: dir.multiplyScalar(1500), life: 3.2, mesh });
    this.game.events.emit('raider:fire', { pos: r.pos });
  }

  asteroidCollision(shipPos, radius = 8) {
    if (shipPos.distanceTo(this.asteroidCenter) > 8200) return null;
    for (const a of this.asteroids) {
      const d = a.pos.distanceTo(shipPos);
      if (d < a.r + radius) return { a, d, depth: a.r + radius - d };
    }
    return null;
  }

  // Prepare visibility for a given render pass: 'far' | 'near'
  setPass(pass) {
    this.far.visible = pass === 'far'; this.near.visible = pass === 'near';
    this.stars.visible = pass === 'far'; this.band.visible = pass === 'far';
    this.band.position.set(0, 0, 0);
  }

  // Dim star-lit planets handled by light; space atmosphere haze handled by Game.
  dispose() { /* single instance for the session */ }
}
