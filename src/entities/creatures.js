import * as THREE from 'three';
import { SPECIES, SPECIES_BY_PLANET } from '../data/species.js';
import { clamp, lerp, mulberry32, rand, TAU, wrapAngle, weightedPick, dampFactor } from '../core/util.js';

const matCache = new Map();
function mats(sp) {
  if (matCache.has(sp.id)) return matCache.get(sp.id);
  const body = new THREE.MeshStandardMaterial({ color: sp.color, roughness: 0.75, metalness: 0.02 });
  const acc = new THREE.MeshStandardMaterial({ color: sp.color2, roughness: 0.6 });
  const glow = new THREE.MeshStandardMaterial({ color: sp.color2, emissive: sp.color2, emissiveIntensity: 1.8, roughness: 0.4 });
  const o = { body, acc, glow };
  for (const m of Object.values(o)) m.userData.shared = true;
  matCache.set(sp.id, o); return o;
}
const M = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = false; return m; };
const sph = (r, ws = 8, hs = 6) => new THREE.SphereGeometry(r, ws, hs);
const cyl = (a, b, h, s = 6) => new THREE.CylinderGeometry(a, b, h, s);
const cone = (r, h, s = 6) => new THREE.ConeGeometry(r, h, s);
const box = (x, y, z) => new THREE.BoxGeometry(x, y, z);

// ---- body builders. Each returns { group, anim(t, speed01, beh) } with the creature's forward axis = +Z.
function addFeatures(sp, g, L, H, mt, back = [0, H * 0.95, 0]) {
  for (const f of sp.feat) {
    if (f === 'sail') {
      const s = M(box(0.06, H * 0.8, L * 0.55), mt.acc, 0, H * 1.25, -L * 0.02); s.rotation.x = 0.1; g.add(s);
      for (let i = 0; i < 4; i++) g.add(M(box(0.08, H * 0.5, 0.05), mt.body, 0, H * 1.2, -L * 0.2 + i * L * 0.14));
    } else if (f === 'horns') {
      const head = g.userData.head;
      if (head) for (const s of [-1, 1]) { const h = M(cone(0.07 * L / 2.5, 0.5 * L / 3, 5), mt.acc, s * 0.13 * H, 0.18 * H, -0.05); h.rotation.set(-0.4, 0, s * -0.35); head.add(h); }
    } else if (f === 'moss') {
      for (let i = 0; i < 9; i++) { const m = M(sph(0.35 + (i % 3) * 0.12, 6, 4), i % 2 ? mt.acc : mt.glow, (Math.random() - 0.5) * L * 0.45, back[1] + 0.2 + Math.random() * 0.4, (Math.random() - 0.5) * L * 0.7); m.scale.y = 0.55; g.add(m); }
    } else if (f === 'glowdots') {
      for (let i = 0; i < 7; i++) g.add(M(sph(0.045 * (L ** 0.5 + 1), 5, 4), mt.glow, (i % 2 ? 1 : -1) * 0.12 * H, back[1] * 0.9, -L * 0.3 + i * L * 0.1));
    } else if (f === 'armor') {
      for (let i = 0; i < 4; i++) { const p = M(box(L * 0.32, 0.07, L * 0.14), mt.acc, 0, back[1] + 0.05, -L * 0.22 + i * L * 0.15); g.add(p); }
    } else if (f === 'spines') {
      for (let i = 0; i < 6; i++) { const s = M(cone(0.03 * L, 0.22 * L, 4), mt.acc, (i % 2 ? 1 : -1) * 0.05, back[1] + 0.1, -L * 0.3 + i * L * 0.12); s.rotation.x = -0.3; g.add(s); }
    } else if (f === 'glowback') {
      const s = M(box(L * 0.55, 0.03, L * 0.12), mt.glow, 0, back[1] + 0.02, 0); g.add(s);
    } else if (f === 'claws') {
      for (const s of [-1, 1]) { const c = M(cone(0.12 * L, 0.3 * L, 5), mt.acc, s * L * 0.38, H * 0.45, L * 0.45); c.rotation.x = Math.PI / 2; c.scale.x = s === 1 ? 1.8 : 1; g.add(c); }
    }
  }
}

function buildWalker(sp, mt) {
  const L = sp.len, H = sp.hgt, g = new THREE.Group();
  const legLen = H * 0.62;
  const torso = M(sph(1, 10, 8), mt.body, 0, legLen + H * 0.16, 0); torso.scale.set(H * 0.3, H * 0.26, L * 0.4); g.add(torso);
  const neck = M(cyl(H * 0.08, H * 0.12, H * 0.5, 6), mt.body, 0, legLen + H * 0.4, L * 0.32); neck.rotation.x = 0.7; g.add(neck);
  const head = new THREE.Group(); head.position.set(0, legLen + H * 0.62, L * 0.43); g.add(head); g.userData.head = head;
  const hm = M(sph(H * 0.15, 8, 6), mt.body); hm.scale.z = 1.5; head.add(hm);
  const snout = M(cone(H * 0.07, H * 0.3, 6), mt.acc, 0, -0.02, H * 0.22); snout.rotation.x = Math.PI / 2; head.add(snout);
  for (const s of [-1, 1]) head.add(M(sph(H * 0.025, 4, 3), mt.glow, s * H * 0.09, H * 0.06, H * 0.12));
  const tail = M(cone(H * 0.1, L * 0.45, 5), mt.body, 0, legLen + H * 0.18, -L * 0.52); tail.rotation.x = -Math.PI / 2 - 0.3; g.add(tail);
  const legs = [];
  const n = sp.legs || 4;
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1, row = Math.floor(i / 2) - (n / 4 - 0.5);
    const pivot = new THREE.Group(); pivot.position.set(side * H * 0.22, legLen + H * 0.1, row * L * 0.55 * (n === 4 ? 1 : 0.7)); g.add(pivot);
    const up = M(cyl(H * 0.055, H * 0.04, legLen, 5), mt.body, 0, -legLen / 2, 0); pivot.add(up);
    pivot.add(M(sph(H * 0.06, 4, 3), mt.acc, 0, -legLen, 0.04));
    legs.push({ pivot, phase: (i % 2) * Math.PI + (i > 1 ? Math.PI / 2 : 0) });
  }
  addFeatures(sp, g, L, H, mt, [0, legLen + H * 0.4, 0]);
  const hb = legLen;
  return { group: g, anim(t, sp01, beh, dt, c) {
    const f = 2 + sp01 * 5;
    for (const l of legs) l.pivot.rotation.x = Math.sin(t * f + l.phase) * 0.55 * sp01;
    torso.position.y = hb + H * 0.16 + Math.abs(Math.sin(t * f)) * 0.04 * sp01 - (beh === 'resting' ? legLen * 0.45 : 0);
    const graze = beh === 'grazing' ? 0.9 : 0, call = beh === 'calling' ? -0.4 : 0;
    head.rotation.x = lerp(head.rotation.x, graze + call, 0.08);
    for (const l of legs) if (beh === 'resting') l.pivot.rotation.x = 1.2 * (l.phase > 1 ? -1 : 1) * 0.5;
  } };
}

function buildCrawler(sp, mt) {
  const L = sp.len, H = sp.hgt, g = new THREE.Group();
  const body = M(sph(1, 8, 6), mt.body, 0, H * 0.7, 0); body.scale.set(L * 0.38, H * 0.4, L * 0.5); g.add(body);
  const head = new THREE.Group(); head.position.set(0, H * 0.7, L * 0.45); g.add(head); g.userData.head = head;
  head.add(M(sph(L * 0.15, 6, 5), mt.body));
  for (const s of [-1, 1]) head.add(M(sph(L * 0.03, 4, 3), mt.glow, s * L * 0.08, L * 0.05, L * 0.1));
  const legs = [];
  for (let i = 0; i < 6; i++) {
    const side = i % 2 ? 1 : -1, row = Math.floor(i / 2) - 1;
    const pivot = new THREE.Group(); pivot.position.set(side * L * 0.28, H * 0.6, row * L * 0.28); g.add(pivot);
    const leg = M(cyl(L * 0.025, L * 0.018, L * 0.45, 4), mt.body, side * L * 0.18, -H * 0.1, 0); leg.rotation.z = side * 1.1; pivot.add(leg);
    legs.push({ pivot, phase: (i % 2) * Math.PI + row });
  }
  addFeatures(sp, g, L, H, mt, [0, H * 1.05, 0]);
  return { group: g, anim(t, sp01, beh) {
    const f = 8 + sp01 * 14;
    for (const l of legs) l.pivot.rotation.y = Math.sin(t * f + l.phase) * 0.45 * sp01;
    body.position.y = H * (beh === 'resting' ? 0.45 : 0.7);
  } };
}

function buildHopper(sp, mt) {
  const L = sp.len, H = sp.hgt, g = new THREE.Group();
  const body = M(sph(1, 8, 6), mt.body, 0, H * 0.55, 0); body.scale.set(H * 0.3, H * 0.35, L * 0.38); g.add(body);
  const head = new THREE.Group(); head.position.set(0, H * 0.78, L * 0.38); g.add(head); g.userData.head = head;
  head.add(M(sph(H * 0.2, 7, 5), mt.body));
  for (const s of [-1, 1]) { const e = M(cone(H * 0.07, H * 0.45, 4), mt.acc, s * H * 0.12, H * 0.3, -0.04); e.rotation.z = s * -0.25; head.add(e); head.add(M(sph(H * 0.04, 4, 3), mt.glow, s * H * 0.12, H * 0.06, H * 0.14)); }
  const legs = [];
  for (const s of [-1, 1]) {
    const p = new THREE.Group(); p.position.set(s * H * 0.22, H * 0.45, -L * 0.2); g.add(p);
    p.add(M(cyl(H * 0.07, H * 0.05, H * 0.5, 5), mt.body, 0, -H * 0.2, 0));
    legs.push(p);
  }
  addFeatures(sp, g, L, H, mt, [0, H * 0.9, 0]);
  return { group: g, anim(t, sp01, beh, dt, c) {
    const hop = sp01 > 0.1 ? Math.abs(Math.sin(t * 6)) : 0;
    g.children[0].position.y = H * 0.55 + hop * 0.5 * H * (sp01 > 0.5 ? 2.2 : 1);
    c.hopY = hop * (sp01 > 0.5 ? 1.6 : 0.4);
    for (const p of legs) p.rotation.x = -hop * 0.9;
    head.rotation.x = beh === 'grazing' ? 0.8 : 0;
  } };
}

function buildFlyer(sp, mt) {
  const L = sp.len, g = new THREE.Group();
  const body = M(sph(1, 8, 6), mt.body); body.scale.set(L * 0.13, L * 0.12, L * 0.3); g.add(body);
  const head = M(sph(L * 0.09, 6, 5), mt.body, 0, L * 0.03, L * 0.3); g.add(head); g.userData.head = head;
  const wings = [];
  for (const s of [-1, 1]) {
    const p = new THREE.Group(); p.position.set(s * L * 0.1, L * 0.05, 0); g.add(p);
    const w = M(box(L * 0.7, 0.012, L * 0.38), mt.acc, s * L * 0.35, 0, 0); p.add(w);
    p.add(M(sph(L * 0.06, 5, 4), mt.glow, s * L * 0.7, 0, 0));
    wings.push({ p, s });
  }
  const tail = M(cone(L * 0.06, L * 0.4, 4), mt.acc, 0, 0, -L * 0.35); tail.rotation.x = -Math.PI / 2; g.add(tail);
  return { group: g, anim(t, sp01, beh, dt, c) {
    const flap = 9 + sp01 * 4 + c.phase;
    for (const w of wings) w.p.rotation.z = w.s * Math.sin(t * flap + c.phase) * 0.8;
    body.position.y = Math.sin(t * flap * 0.5) * 0.03;
    const pulse = beh === 'calling' ? 0.5 + 0.5 * Math.sin(t * 3 + c.pulse) : 0.3;
    mt.glow.emissiveIntensity = 1.0 + (beh === 'calling' ? 2 : 0.4);
  } };
}

function buildFloater(sp, mt) {
  const L = sp.len, g = new THREE.Group();
  const bell = M(new THREE.SphereGeometry(1, 14, 10, 0, TAU, 0, Math.PI * 0.62), new THREE.MeshStandardMaterial({ color: sp.color, roughness: 0.2, transparent: true, opacity: 0.6, emissive: sp.color2, emissiveIntensity: 0.4 }), 0, L * 0.9, 0);
  bell.scale.set(L * 0.32, L * 0.3, L * 0.32); g.add(bell);
  const core = M(sph(L * 0.1, 8, 6), mt.glow, 0, L * 0.8, 0); g.add(core);
  const ten = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU, p = new THREE.Group(); p.position.set(Math.cos(a) * L * 0.22, L * 0.75, Math.sin(a) * L * 0.22); g.add(p);
    p.add(M(cyl(0.012, 0.008, L * 0.8, 4), mt.acc, 0, -L * 0.4, 0));
    p.add(M(sph(0.04, 4, 3), mt.glow, 0, -L * 0.8, 0));
    ten.push({ p, a });
  }
  g.userData.head = bell;
  return { group: g, anim(t, sp01, beh, dt, c) {
    bell.scale.y = L * 0.3 * (1 + Math.sin(t * 1.4 + c.phase) * 0.08);
    for (const x of ten) { x.p.rotation.x = Math.sin(t * 1.1 + x.a) * 0.18; x.p.rotation.z = Math.cos(t * 0.9 + x.a) * 0.18; }
    mt.glow.emissiveIntensity = beh === 'calling' ? 1.2 + 1.6 * (0.5 + 0.5 * Math.sin(t * 4 + c.pulse)) : 1.0;
    c.bob = Math.sin(t * 0.8 + c.phase) * 0.4;
  } };
}

function buildSwimmer(sp, mt) {
  const L = sp.len, H = sp.hgt, g = new THREE.Group();
  if (sp.shape === 'fish') {
    const body = M(sph(1, 8, 6), mt.body); body.scale.set(L * 0.12, L * 0.18, L * 0.38); g.add(body);
    const tail = new THREE.Group(); tail.position.z = -L * 0.35; g.add(tail);
    const tf = M(cone(L * 0.16, L * 0.3, 4), mt.acc, 0, 0, -L * 0.12); tf.rotation.x = -Math.PI / 2; tf.scale.x = 0.2; tail.add(tf);
    const fin = M(cone(L * 0.08, L * 0.2, 4), mt.acc, 0, L * 0.17, 0); g.add(fin);
    return { group: g, anim(t, sp01, beh, dt, c) { tail.rotation.y = Math.sin(t * (8 + sp01 * 8) + c.phase) * 0.6; } };
  }
  if (sp.shape === 'ray') {
    const body = M(sph(1, 10, 6), mt.body); body.scale.set(L * 0.1, L * 0.05, L * 0.2); g.add(body);
    const wings = [];
    for (const s of [-1, 1]) {
      const p = new THREE.Group(); g.add(p);
      const w = M(box(L * 0.5, 0.03 * L, L * 0.34), mt.body, s * L * 0.25, 0, 0); w.scale.set(1, 1, 1); p.add(w);
      const patch = M(box(L * 0.3, 0.035 * L, L * 0.14), mt.glow, s * L * 0.28, -0.002 * L, 0); p.add(patch);
      wings.push({ p, s });
    }
    const tail = M(cyl(0.01 * L, 0.03 * L, L * 0.9, 4), mt.acc, 0, 0, -L * 0.6); tail.rotation.x = Math.PI / 2; g.add(tail);
    g.userData.head = body;
    return { group: g, anim(t, sp01, beh, dt, c) {
      for (const w of wings) w.p.rotation.z = w.s * Math.sin(t * (1.5 + sp01) + c.phase) * 0.45;
      mt.glow.emissiveIntensity = beh === 'calling' ? 1 + 2 * (0.5 + 0.5 * Math.sin(t * 2 + c.pulse)) : 1;
    } };
  }
  if (sp.shape === 'gulper') {
    const head = M(sph(1, 12, 8), mt.body); head.scale.set(H * 0.5, H * 0.5, L * 0.28); head.position.z = L * 0.15; g.add(head);
    const jaw = new THREE.Group(); jaw.position.set(0, -H * 0.1, L * 0.3); g.add(jaw);
    const jm = M(box(H * 0.8, H * 0.12, L * 0.28), mt.body, 0, -H * 0.2, -L * 0.12); jaw.add(jm);
    for (let i = 0; i < 8; i++) { const t = M(cone(0.04, 0.22, 4), mt.acc, (i - 3.5) * H * 0.1, -H * 0.1, -L * 0.04 - (i % 2) * 0.03); t.rotation.x = Math.PI; jaw.add(t); }
    const body = M(cone(H * 0.4, L * 0.7, 6), mt.body, 0, 0, -L * 0.25); body.rotation.x = -Math.PI / 2; g.add(body);
    const stalk = M(cyl(0.03, 0.02, H * 1.1, 4), mt.acc, 0, H * 0.75, L * 0.25); stalk.rotation.x = 0.6; g.add(stalk);
    const lure = M(sph(H * 0.1, 8, 6), mt.glow, 0, H * 1.2, L * 0.45); g.add(lure);
    const light = new THREE.PointLight(sp.color2, 1.2, 30, 2); lure.add(light);
    for (const s of [-1, 1]) g.add(M(sph(H * 0.05, 5, 4), mt.glow, s * H * 0.35, H * 0.12, L * 0.38));
    g.userData.head = head;
    return { group: g, anim(t, sp01, beh, dt, c) {
      jaw.rotation.x = (beh === 'hunting' && sp01 > 0.6) ? 0.5 + Math.sin(t * 6) * 0.2 : 0.05;
      body.rotation.z = Math.sin(t * 2 + c.phase) * 0.08;
      lure.scale.setScalar(0.8 + 0.4 * Math.sin(t * 5)); light.intensity = beh === 'resting' ? 0.3 : 1.4;
    } };
  }
  // leviathan
  const segs = [];
  const N = 9;
  for (let i = 0; i < N; i++) {
    const k = i / (N - 1), r = H * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, k * 0.9 + 0.08)));
    const p = new THREE.Group(); p.position.z = L * (0.5 - k); g.add(p);
    const s = M(sph(1, 12, 8), mt.body); s.scale.set(r, r * 0.9, L / N * 0.9); p.add(s);
    const ring = M(new THREE.TorusGeometry(r * 0.98, r * 0.05, 5, 20), mt.glow); ring.scale.z = 1; p.add(ring);
    segs.push({ p, k });
  }
  const fluke = new THREE.Group(); fluke.position.z = -L * 0.52; g.add(fluke);
  for (const s of [-1, 1]) { const f = M(cone(H * 0.5, H * 1.8, 4), mt.body, s * H * 0.8, 0, 0); f.rotation.z = -s * Math.PI / 2; f.scale.z = 0.3; fluke.add(f); }
  for (const s of [-1, 1]) { const fn = M(cone(H * 0.22, H * 1.6, 4), mt.body, s * H * 0.65, -H * 0.3, L * 0.2); fn.rotation.z = -s * 1.2; g.add(fn); }
  g.userData.head = segs[0].p;
  return { group: g, anim(t, sp01, beh, dt, c) {
    for (const s of segs) { s.p.position.x = Math.sin(t * 0.7 - s.k * 3 + c.phase) * H * 0.35 * s.k; s.p.position.y = Math.cos(t * 0.5 - s.k * 2) * H * 0.12 * s.k; }
    fluke.rotation.x = Math.sin(t * 0.7 + c.phase) * 0.35; fluke.position.x = segs[N - 1].p.position.x; fluke.position.y = segs[N - 1].p.position.y;
    mt.glow.emissiveIntensity = beh === 'calling' ? 1.2 + 2.2 * (0.5 + 0.5 * Math.sin(t * 1.3 + c.pulse)) : 1.1;
  } };
}

function buildBody(sp) {
  const mt = mats(sp);
  switch (sp.arch) {
    case 'walker': return buildWalker(sp, mt);
    case 'crawler': return buildCrawler(sp, mt);
    case 'hopper': return buildHopper(sp, mt);
    case 'flyer': return buildFlyer(sp, mt);
    case 'floater': return buildFloater(sp, mt);
    case 'swimmer': return buildSwimmer(sp, mt);
    default: return buildWalker(sp, mt);
  }
}

// ---------------------------------------------------------------------------------------------
let UID = 1;
export class CreatureManager {
  constructor(scene, hf, flora, structures, atmos, quality, events) {
    this.scene = scene; this.hf = hf; this.atmos = atmos; this.events = events; this.q = quality;
    this.structures = structures;
    this.planet = hf.p.id;
    this.species = SPECIES_BY_PLANET[this.planet] || [];
    this.list = [];
    this.group = new THREE.Group(); scene.add(this.group);
    this.rng = mulberry32(hf.p.seed + Math.floor(performance.now()) % 997);
    this.spawnCool = 0;
    this.wl = hf.waterLevel;
    this.maxCount = quality.creatures;
    this.padPos = hf.sites.find((s) => s.type === 'pad');
    this.hostileOn = true;
  }

  siteAnchor(sp) {
    if (!sp.anchor) return null;
    return this.hf.sites.find((s) => s.id === sp.anchor.site) || null;
  }

  // Choose a spawn position for a species near the player.
  pickSpawn(sp, px, pz) {
    for (let tries = 0; tries < 12; tries++) {
      let x, z;
      const anchor = this.siteAnchor(sp);
      if (anchor) {
        const a = this.rng() * TAU, d = Math.sqrt(this.rng()) * sp.anchor.radius;
        x = anchor.x + Math.cos(a) * d; z = anchor.z + Math.sin(a) * d;
        // anchored species only exist near their anchor
        if (Math.hypot(x - px, z - pz) > 420 && !sp.colossal) continue;
      } else {
        const a = this.rng() * TAU, d = 90 + this.rng() * 230;
        x = px + Math.cos(a) * d; z = pz + Math.sin(a) * d;
      }
      const h = this.hf.heightAt(x, z);
      const water = this.wl !== null && h < this.wl;
      if (sp.habitat === 'land') { if (water || h < sp.hMin || h > sp.hMax) continue; if (this.hf.slopeAt(x, z, 2) > 0.75) continue; }
      else if (sp.habitat === 'water') {
        if (!water) continue;
        const depth = this.wl - h; if (depth < sp.hMin + 2) continue;
      }
      if (sp.aggro && this.padPos && Math.hypot(x - this.padPos.x, z - this.padPos.z) < 140) continue;
      if (Math.hypot(x - px, z - pz) < 70 && !anchor) continue;
      return { x, z, h, water };
    }
    return null;
  }

  makeCreature(sp, x, z, leader = null) {
    const { group, anim } = buildBody(sp);
    const mt = group;
    const c = {
      id: UID++, sp, group, anim, leader, x, z, y: 0, heading: this.rng() * TAU, speed: 0, targetSpeed: 0,
      behavior: sp.behaviors[0], behTimer: 2 + this.rng() * 6, phase: this.rng() * TAU, pulse: this.rng() * TAU,
      hopY: 0, bob: 0, target: null, wander: { x, z, t: 0 }, alive: true, cooldown: 0, atkCool: 0, scale: 0.85 + this.rng() * 0.3,
      depthPref: 0, dead: 0,
    };
    if (sp.colossal) c.scale = 1;
    group.scale.setScalar(c.scale);
    if (sp.arch === 'swimmer') {
      const lo = sp.hMin, hi = sp.hMax;
      c.depthPref = lo + (hi - lo) * (0.25 + this.rng() * 0.5);
    }
    if (sp.arch === 'flyer') c.alt = 6 + this.rng() * 10;
    if (sp.arch === 'floater') c.alt = 5 + this.rng() * 8;
    this.place(c);
    this.group.add(group);
    this.list.push(c);
    return c;
  }

  surfaceHeight(c) { return this.hf.heightAt(c.x, c.z); }

  place(c) {
    const h = this.surfaceHeight(c), sp = c.sp;
    if (sp.arch === 'swimmer') {
      const floor = h, top = this.wl - 0.8;
      let y = this.wl - c.depthPref;
      y = clamp(y, floor + 1 + sp.hgt, top);
      if (sp.shape === 'gulper') y = clamp(y, floor + 1.5, top);
      c.y = lerp(c.y || y, y, 0.05) || y;
      if (!c.y) c.y = y;
    } else if (sp.arch === 'flyer' || sp.arch === 'floater') {
      const base = Math.max(h, this.wl ?? -1e9);
      const want = base + c.alt + (c.bob || 0);
      c.y = c.y ? lerp(c.y, want, 0.04) : want;
    } else {
      c.y = h + (c.hopY || 0);
    }
  }

  spawnHerd(sp, ps) {
    const n = Math.round(rand(this.rng, sp.herd[0], sp.herd[1]));
    let lead = null;
    for (let i = 0; i < n; i++) {
      const a = this.rng() * TAU, d = i ? 2 + this.rng() * 10 : 0;
      const x = ps.x + Math.cos(a) * d, z = ps.z + Math.sin(a) * d;
      const h = this.hf.heightAt(x, z), water = this.wl !== null && h < this.wl;
      if (sp.habitat === 'land' && water) continue;
      if (sp.habitat === 'water' && !water) continue;
      const c = this.makeCreature(sp, x, z, lead);
      if (!lead) lead = c;
    }
  }

  count(sp) { let n = 0; for (const c of this.list) if (c.sp === sp) n++; return n; }

  update(dt, ctx) {
    const { px, pz, py, inShip, dayFactor, time } = ctx;
    const t = time;
    // --- spawning/despawning
    this.spawnCool -= dt;
    if (this.spawnCool <= 0 && this.list.length < this.maxCount) {
      this.spawnCool = 0.25;
      const sp = weightedPick(this.rng, this.species, (s) => (s.freq || 0.0001) * (1 - this.count(s) / 12) + (s.anchor ? 0.5 : 0));
      if (sp && this.count(sp) < (sp.anchor ? 2 : 14) && !(sp.colossal && this.count(sp) >= 1)) {
        const ps = this.pickSpawn(sp, px, pz);
        if (ps) this.spawnHerd(sp, ps);
      }
    }
    for (let i = this.list.length - 1; i >= 0; i--) {
      const c = this.list[i];
      const far = Math.hypot(c.x - px, c.z - pz);
      if (!c.alive || (far > 520 && !c.sp.anchor) || (c.sp.anchor && far > 1500)) {
        this.group.remove(c.group);
        this.list.splice(i, 1);
        for (const o of this.list) if (o.leader === c) o.leader = null;
      }
    }
    for (const c of this.list) this.think(c, dt, ctx);
  }

  think(c, dt, ctx) {
    const sp = c.sp, { px, pz, py, inShip, dayFactor, time } = ctx;
    const dPlayer = Math.hypot(c.x - px, c.z - pz);
    c.behTimer -= dt; c.atkCool -= dt;
    const nocturnal = sp.nocturnal;
    let behavior = c.behavior;
    let desired = null; // {x,z,speed}

    // threats
    let fleeFrom = null;
    if (sp.fleeDist > 0 && !sp.aggro && !inShip && dPlayer < sp.fleeDist * (ctx.playerLoud ? 1.4 : 1) && !(sp.arch === 'floater')) fleeFrom = { x: px, z: pz };
    for (const o of this.list) {
      if (o === c || !o.sp.prey || !o.sp.prey.includes(sp.id)) continue;
      const d = Math.hypot(o.x - c.x, o.z - c.z);
      if (d < 32 && o.behavior === 'hunting') { fleeFrom = { x: o.x, z: o.z }; break; }
    }

    if (fleeFrom) { behavior = 'fleeing'; c.behTimer = Math.max(c.behTimer, 3); }
    else if (sp.prey || sp.aggro) {
      // predators: hunt prey or the player
      let tgt = null, best = 1e9;
      if (sp.aggro && ctx.hostile && !inShip && dPlayer < 55 && (!nocturnal || true)) { tgt = { x: px, z: pz, player: true }; best = dPlayer; }
      if (!tgt && sp.prey) {
        for (const o of this.list) {
          if (o === c || !sp.prey.includes(o.sp.id) || !o.alive) continue;
          const d = Math.hypot(o.x - c.x, o.z - c.z);
          if (d < 90 && d < best) { best = d; tgt = o; }
        }
      }
      if (tgt && c.cooldown <= 0) { behavior = 'hunting'; c.target = tgt; c.behTimer = Math.max(c.behTimer, 1); }
      else if (behavior === 'hunting') { behavior = 'resting'; c.behTimer = 6 + this.rng() * 10; c.target = null; }
    } else if (c.behTimer <= 0 || behavior === 'fleeing') {
      // pick a new ambient behaviour
      const opts = sp.behaviors.filter((b) => b !== 'fleeing' && b !== 'hunting');
      if (behavior === 'fleeing') c.behTimer = 0;
      behavior = opts[Math.floor(this.rng() * opts.length)] || 'grazing';
      c.behTimer = 8 + this.rng() * 18;
    }
    if (c.behTimer <= 0 && behavior !== 'hunting') {
      const opts = sp.behaviors.filter((b) => b !== 'fleeing' && b !== 'hunting');
      behavior = opts[Math.floor(this.rng() * opts.length)] || 'grazing';
      c.behTimer = 8 + this.rng() * 18;
      if (sp.nocturnal && dayFactor > 0.5 && opts.includes('resting')) behavior = 'resting';
      if (sp.anchor && sp.id === 'lumen_choir' && dayFactor < 0.4) behavior = 'calling';
    }
    if (c.cooldown > 0) c.cooldown -= dt;
    if (sp.nocturnal && dayFactor > 0.6 && !fleeFrom && behavior !== 'hunting' && sp.behaviors.includes('resting')) behavior = 'resting';
    if (behavior !== c.behavior) {
      c.behavior = behavior;
      if (behavior === 'calling') this.events.emit('creature:call', { sp, x: c.x, y: c.y, z: c.z, id: c.id });
    }

    // movement
    const wanderSpeed = sp.speed, runSpeed = sp.run;
    let speed = 0, tx = null, tz = null;
    switch (behavior) {
      case 'fleeing': {
        const a = Math.atan2(c.z - fleeFrom.z, c.x - fleeFrom.x);
        tx = c.x + Math.cos(a) * 30; tz = c.z + Math.sin(a) * 30; speed = runSpeed; break;
      }
      case 'hunting': {
        const t = c.target;
        if (!t || (t.alive === false)) { c.target = null; c.behTimer = 0; break; }
        const tx0 = t.player ? px : t.x, tz0 = t.player ? pz : t.z;
        const d = Math.hypot(tx0 - c.x, tz0 - c.z);
        tx = tx0; tz = tz0;
        speed = d > 22 ? wanderSpeed * 1.3 : runSpeed;       // stalk, then sprint
        if (d < (t.player ? 3.4 : 2.5)) {
          if (t.player) { if (c.atkCool <= 0) { c.atkCool = 1.3; this.events.emit('player:damage', { amount: 11, kind: 'attack', from: sp.id }); } }
          else if (t.alive) { t.alive = false; c.behTimer = 0; c.cooldown = 40; c.target = null; this.events.emit('creature:kill', { sp, prey: t.sp }); }
          speed = 0;
        }
        if (t.player && d > 70) { c.target = null; c.behTimer = 0; c.cooldown = 6; }
        break;
      }
      case 'herding': {
        const L = c.leader && c.leader.alive ? c.leader : null;
        if (L) { const d = Math.hypot(L.x - c.x, L.z - c.z); tx = L.x + Math.cos(c.phase) * 6; tz = L.z + Math.sin(c.phase) * 6; speed = d > 12 ? wanderSpeed * 1.4 : d > 5 ? wanderSpeed : 0.2; }
        else this.wanderGoal(c, dt, 40);
        if (!L) { tx = c.wander.x; tz = c.wander.z; speed = wanderSpeed; }
        break;
      }
      case 'grazing': {
        const L = c.leader && c.leader.alive ? c.leader : null;
        if (L && Math.hypot(L.x - c.x, L.z - c.z) > 14) { tx = L.x; tz = L.z; speed = wanderSpeed; }
        else { this.wanderGoal(c, dt, 14); tx = c.wander.x; tz = c.wander.z; speed = wanderSpeed * 0.35; }
        break;
      }
      case 'resting':
        if ((sp.prey || sp.aggro) && Math.sin(c.phase + time * 0.08) > 0.2) { this.wanderGoal(c, dt, 60); tx = c.wander.x; tz = c.wander.z; speed = wanderSpeed * 0.8; }
        else speed = 0;
        break;
      case 'calling': speed = 0; break;
      default: speed = 0;
    }
    if (sp.arch === 'flyer' || sp.arch === 'floater') {
      // flyers prefer circling their leader/anchor
      if (behavior !== 'fleeing' && speed === 0 && sp.arch === 'flyer') { this.wanderGoal(c, dt, 60); tx = c.wander.x; tz = c.wander.z; speed = wanderSpeed * 0.7; }
      if (sp.arch === 'floater' && behavior !== 'fleeing' && speed === 0) { this.wanderGoal(c, dt, 40); tx = c.wander.x; tz = c.wander.z; speed = wanderSpeed * 0.5; }
    }
    if (sp.arch === 'swimmer' && behavior !== 'hunting' && behavior !== 'fleeing' && behavior !== 'resting' && speed === 0) {
      this.wanderGoal(c, dt, sp.colossal ? 160 : 50); tx = c.wander.x; tz = c.wander.z; speed = wanderSpeed * 0.8;
    }
    if (sp.anchor) {
      const an = this.siteAnchor(sp);
      if (an) {
        const dA = Math.hypot(c.x - an.x, c.z - an.z);
        if (dA > sp.anchor.radius) { tx = an.x; tz = an.z; speed = Math.max(speed, wanderSpeed); }
        if (sp.id === 'lumen_choir' && dayFactor < 0.4 && behavior !== 'fleeing') { tx = an.x + Math.cos(c.phase + time * 0.3) * 20; tz = an.z + Math.sin(c.phase + time * 0.3) * 20; speed = wanderSpeed * 0.6; }
      }
    }

    // steering
    if (tx !== null) {
      const want = Math.atan2(tx - c.x, tz - c.z);
      const da = wrapAngle(want - c.heading);
      c.heading += clamp(da, -dt * (sp.arch === 'swimmer' && sp.colossal ? 0.35 : 2.2), dt * (sp.arch === 'swimmer' && sp.colossal ? 0.35 : 2.2));
    }
    c.targetSpeed = speed;
    c.speed += (c.targetSpeed - c.speed) * dampFactor(2.5, dt);
    const nx = c.x + Math.sin(c.heading) * c.speed * dt, nz = c.z + Math.cos(c.heading) * c.speed * dt;
    // terrain constraints
    const nh = this.hf.heightAt(nx, nz), water = this.wl !== null && nh < this.wl;
    let ok = true;
    if (sp.habitat === 'land') ok = !water && Math.abs(nh - this.surfaceHeight(c)) < 1.2 * Math.max(0.2, c.speed * dt + 0.4);
    else if (sp.habitat === 'water') ok = water && (this.wl - nh) > sp.hMin * 0.5;
    if (ok) { c.x = nx; c.z = nz; } else { c.heading += Math.PI * 0.6 * (this.rng() < 0.5 ? 1 : -1); c.speed *= 0.5; c.wander.t = 0; }
    this.place(c);
    // visual
    c.group.position.set(c.x, c.y, c.z);
    c.group.rotation.y = c.heading;
    if (sp.arch === 'walker' || sp.arch === 'crawler' || sp.arch === 'hopper') {
      const n = this.hf.normalAt(c.x, c.z, [0, 1, 0], 2);
      c.group.rotation.x = lerp(c.group.rotation.x, Math.atan2(-n[2], n[1]) * 0.6, 0.1) * 0 + 0;
    }
    const s01 = clamp(c.speed / Math.max(0.5, sp.run * 0.7), 0, 1);
    c.anim(performance.now() * 0.001 + c.phase, s01, c.behavior, dt, c);
    if (c.behavior === 'calling' && (c.callT = (c.callT || 0) - dt) <= 0) {
      c.callT = 6 + this.rng() * 8;
      this.events.emit('creature:call', { sp, x: c.x, y: c.y, z: c.z, id: c.id });
    }
  }

  wanderGoal(c, dt, radius) {
    c.wander.t -= dt;
    if (c.wander.t <= 0 || Math.hypot(c.wander.x - c.x, c.wander.z - c.z) < 2) {
      const a = this.rng() * TAU, d = radius * (0.3 + this.rng() * 0.7);
      c.wander.x = c.x + Math.cos(a) * d; c.wander.z = c.z + Math.sin(a) * d; c.wander.t = 6 + this.rng() * 8;
    }
  }

  // Scan targets for the scanner.
  targets(px, pz, range) {
    const out = [];
    for (const c of this.list) {
      if (!c.alive) continue;
      if (Math.abs(c.x - px) > range || Math.abs(c.z - pz) > range) continue;
      out.push({ kind: 'creature', entry: c.sp.id, x: c.x, y: c.y + c.sp.hgt * 0.5 * c.scale, z: c.z, r: Math.max(0.6, c.sp.len * 0.35 * c.scale), creature: c, id: 'c' + c.id });
    }
    return out;
  }

  // Closest dangerous creature (for HUD warning)
  nearestThreat(px, pz) {
    let best = null, bd = 1e9;
    for (const c of this.list) if (c.sp.aggro && c.alive) { const d = Math.hypot(c.x - px, c.z - pz); if (d < bd) { bd = d; best = c; } }
    return best ? { c: best, d: bd } : null;
  }

  dispose() { this.scene.remove(this.group); this.list.length = 0; }
}
