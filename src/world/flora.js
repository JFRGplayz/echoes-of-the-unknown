import * as THREE from 'three';
import { mulberry32, hash2, clamp, rand, TAU } from '../core/util.js';
import { mergeParts, propMaterial, geoCyl, geoCone, geoSphere, geoBox, geoIco, rockGeo } from '../core/util3d.js';
import { CHUNK_SIZE } from './terrain.js';

// Each prop def: build() -> merged geometry, plus placement rules.
// density = instances per 100 m^2 (before quality scaling). scan = journal entry id (null = scenery).
const defs = {
  khepri: [
    { id: 'stone_moss', scan: 'stone_moss', density: 0.9, scale: [0.8, 1.8], hMin: 20, slopeMax: 0.8, build: () => cushion(0x8a8a60, 0xc8b878) },
    { id: 'glass_reed', scan: 'glass_reed', density: 0.45, scale: [0.8, 1.6], hMin: -50, slopeMax: 0.6, build: () => reeds(0xcfe9e4), clusters: true, glow: 0.2 },
    { id: 'hollow_barrel', scan: 'hollow_barrel', density: 0.12, scale: [0.8, 1.8], hMin: 20, slopeMax: 0.6, build: () => barrel(0x6a7a44) },
    { id: 'rock', scan: null, density: 0.5, scale: [0.6, 3.2], hMin: -90, slopeMax: 9, build: (i) => rockGeoMerged(i, 0x7a5040), cast: true, collide: true },
    { id: 'boulder', scan: null, density: 0.04, scale: [4, 9], hMin: -90, slopeMax: 9, build: (i) => rockGeoMerged(i + 40, 0x5a3a2e), cast: true, collide: true },
  ],
  vesper: [
    { id: 'sporetree', scan: 'sporetree', density: 0.16, scale: [0.9, 1.7], hMin: 8, slopeMax: 0.8, build: () => sporeTree(), cast: true, glow: 0.8, collide: true },
    { id: 'lantern_fern', scan: 'lantern_fern', density: 1.2, scale: [0.8, 1.7], hMin: 8, slopeMax: 1, build: () => fern(0x3fae6a, 0x9fffd0), glow: 0.5 },
    { id: 'glow_bulb', scan: 'glow_bulb', density: 0.7, scale: [0.7, 1.5], hMin: 8, slopeMax: 1, build: () => bulb(0x4040a0, 0x6affea), glow: 1.4, clusters: true },
    { id: 'rock', scan: null, density: 0.25, scale: [0.5, 2.4], hMin: 4, slopeMax: 9, build: (i) => rockGeoMerged(i, 0x5a5048), cast: true, collide: true },
  ],
  nivalis: [
    { id: 'frost_spike', scan: 'frost_spike', density: 0.3, scale: [0.8, 2.2], hMin: -50, slopeMax: 1, build: () => crystals(0xcfeeff), glow: 0.35, clusters: true },
    { id: 'cryo_lichen', scan: 'cryo_lichen', density: 0.8, scale: [1, 2.8], hMin: -50, slopeMax: 0.9, build: () => cushion(0x6a5aa8, 0x9a8ae0, true), glow: 0.4 },
    { id: 'hoar_shrub', scan: 'hoar_shrub', density: 0.2, scale: [0.8, 1.6], hMin: -50, slopeMax: 0.7, build: () => shrub(0xe4eef8) },
    { id: 'rock', scan: null, density: 0.35, scale: [0.6, 3], hMin: -90, slopeMax: 9, build: (i) => rockGeoMerged(i, 0x4a5568), cast: true, collide: true },
    { id: 'iceblock', scan: null, density: 0.05, scale: [3, 8], hMin: -90, slopeMax: 9, build: (i) => rockGeoMerged(i + 10, 0xbfe0ff, 0.55), cast: true, collide: true },
  ],
  pelagos: [
    { id: 'wave_palm', scan: 'wave_palm', density: 0.22, scale: [0.9, 1.5], hMin: 2, hMax: 70, slopeMax: 0.8, build: () => palm(), cast: true, collide: true },
    { id: 'kelp', scan: 'kelp', density: 0.9, scale: [1, 2.4], hMax: -2, hMin: -85, slopeMax: 0.8, build: () => kelp(), glow: 0.1, clusters: true },
    { id: 'coral_fan', scan: 'coral_fan', density: 0.55, scale: [0.8, 1.8], hMax: -2, hMin: -85, slopeMax: 1.2, build: () => coral(), clusters: true },
    { id: 'rock', scan: null, density: 0.3, scale: [0.6, 3], hMin: -200, slopeMax: 9, build: (i) => rockGeoMerged(i, 0x575a62), cast: true, collide: true },
  ],
};

// Resource node defs per planet: [resource, density/100m2, filter]
const nodeDefs = {
  khepri: [['ferrolith', 0.035, (h) => h > 20], ['silicate_glass', 0.012, (h) => h > 20], ['echolite', 0.004, (h) => h > 40]],
  vesper: [['biogel', 0.04, (h) => h > 8], ['ferrolith', 0.012, (h) => h > 8]],
  nivalis: [['cryo_salt', 0.03, () => true], ['deuterium_ice', 0.02, () => true], ['ferrolith', 0.008, () => true]],
  pelagos: [['aqua_pearl', 0.03, (h) => h < -5 && h > -90], ['ferrolith', 0.02, (h) => h > 1], ['deuterium_ice', 0.01, (h) => h < -5 && h > -60]],
};

// ----------------------------------------------------------------- builders
function cushion(c1, c2, flat) {
  const parts = [];
  for (let i = 0; i < 5; i++) {
    const a = i * 1.26, r = i ? 0.34 : 0;
    parts.push({ geo: geoSphere(0.28 + (i % 2) * 0.08, 7, 5), pos: [Math.cos(a) * r, 0.07, Math.sin(a) * r], scale: [1, 0.4, 1], color: i % 2 ? c1 : c2 });
  }
  return mergeParts(parts);
}
function reeds(c) {
  const parts = [];
  for (let i = 0; i < 7; i++) {
    const a = i * 0.9, r = 0.1 + (i % 3) * 0.12, h = 1.2 + (i % 4) * 0.45;
    parts.push({ geo: geoCone(0.05, h, 5), pos: [Math.cos(a) * r, h / 2, Math.sin(a) * r], rot: [(Math.sin(a) * 0.15), 0, (Math.cos(a) * 0.15)], color: c, emissive: i % 3 === 0 });
  }
  return mergeParts(parts);
}
function barrel(c) {
  const parts = [{ geo: geoSphere(0.5, 8, 6), pos: [0, 0.42, 0], scale: [1, 0.9, 1], color: c }];
  for (let i = 0; i < 6; i++) { const a = i * 1.047; parts.push({ geo: geoBox(0.06, 0.8, 0.14), pos: [Math.cos(a) * 0.47, 0.42, Math.sin(a) * 0.47], rot: [0, -a, 0], color: 0x4a5a30 }); }
  return mergeParts(parts);
}
function rockGeoMerged(seed, color, shine) {
  return mergeParts([{ geo: rockGeo(seed * 7919 + 13, 1, 1, 0.7, 0.32), pos: [0, 0.3, 0], color }]);
}
function sporeTree() {
  const parts = [
    { geo: geoCyl(0.35, 0.65, 7, 6), pos: [0, 3.5, 0], color: 0x4a3a30 },
    { geo: geoCyl(0.2, 0.35, 3, 5), pos: [1.2, 6.2, 0], rot: [0, 0, -0.7], color: 0x4a3a30 },
    { geo: geoCyl(0.2, 0.35, 3, 5), pos: [-1.1, 6.6, 0.4], rot: [0.3, 0, 0.7], color: 0x4a3a30 },
  ];
  const cols = [0x2f8a5c, 0x3aa070, 0x2a7a6a];
  [[0, 8.4, 0, 3.2], [2.2, 7.3, 0.4, 2.3], [-2.1, 7.7, 0.7, 2.4], [0.3, 9.3, -1.2, 2.2]].forEach((b, i) =>
    parts.push({ geo: geoIco(b[3], 1), pos: [b[0], b[1], b[2]], scale: [1, 0.62, 1], color: cols[i % 3] }));
  for (let i = 0; i < 7; i++) parts.push({ geo: geoSphere(0.2, 5, 4), pos: [Math.cos(i * 0.9) * 2.4, 6.4 + (i % 3) * 0.5, Math.sin(i * 0.9) * 2.4], color: 0x6affea, emissive: true });
  return mergeParts(parts);
}
function fern(c1, c2) {
  const parts = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU;
    parts.push({ geo: geoBox(0.22, 0.04, 1.3), pos: [Math.cos(a) * 0.55, 0.55, Math.sin(a) * 0.55], rot: [0.5 * Math.sin(a), -a + Math.PI / 2, -0.5 * Math.cos(a)], color: c1 });
    parts.push({ geo: geoSphere(0.06, 4, 3), pos: [Math.cos(a) * 1.15, 0.9, Math.sin(a) * 1.15], color: c2, emissive: true });
  }
  return mergeParts(parts);
}
function bulb(c1, c2) {
  const parts = [];
  for (let i = 0; i < 3; i++) {
    const h = 0.5 + i * 0.28, a = i * 2.1, r = i * 0.18;
    parts.push({ geo: geoCyl(0.03, 0.05, h, 4), pos: [Math.cos(a) * r, h / 2, Math.sin(a) * r], color: c1 });
    parts.push({ geo: geoSphere(0.15 + i * 0.04, 6, 5), pos: [Math.cos(a) * r, h + 0.1, Math.sin(a) * r], color: c2, emissive: true });
  }
  return mergeParts(parts);
}
function crystals(c) {
  const parts = [];
  for (let i = 0; i < 5; i++) {
    const a = i * 1.3, h = 0.9 + (i % 3) * 0.7;
    parts.push({ geo: geoCone(0.2 + (i % 2) * 0.08, h, 5), pos: [Math.cos(a) * i * 0.12, h / 2, Math.sin(a) * i * 0.12], rot: [Math.sin(a) * 0.25, 0, Math.cos(a) * 0.25], color: c, emissive: i % 2 === 0 });
  }
  return mergeParts(parts);
}
function shrub(c) {
  const parts = [];
  for (let i = 0; i < 9; i++) {
    const a = i * 0.7, h = 0.8 + (i % 3) * 0.3;
    parts.push({ geo: geoCyl(0.015, 0.04, h, 4), pos: [Math.cos(a) * 0.18, h / 2, Math.sin(a) * 0.18], rot: [Math.sin(a) * 0.5, 0, Math.cos(a) * 0.5], color: c });
  }
  return mergeParts(parts);
}
function palm() {
  const parts = [{ geo: geoCyl(0.18, 0.3, 6, 6), pos: [0.5, 3, 0], rot: [0, 0, -0.18], color: 0x8a6a48 }];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU;
    parts.push({ geo: geoBox(0.3, 0.04, 2.6), pos: [1 + Math.cos(a) * 1.1, 5.9, Math.sin(a) * 1.1], rot: [0.55 * Math.sin(a), -a + Math.PI / 2, -0.55 * Math.cos(a)], color: i % 2 ? 0x3f8f58 : 0x4fa36a });
  }
  parts.push({ geo: geoSphere(0.22, 5, 4), pos: [1, 5.6, 0.2], color: 0x7a5a30 });
  return mergeParts(parts);
}
function kelp() {
  const parts = [];
  for (let i = 0; i < 4; i++) {
    const h = 5 + i * 1.6, a = i * 1.7;
    parts.push({ geo: geoBox(0.35, h, 0.04), pos: [Math.cos(a) * 0.5, h / 2, Math.sin(a) * 0.5], rot: [0, a, Math.sin(a) * 0.08], color: 0x3a7a3a, emissive: i === 2 });
  }
  return mergeParts(parts);
}
function coral() {
  const parts = [];
  for (let i = 0; i < 4; i++) {
    const a = (i - 1.5) * 0.35;
    parts.push({ geo: geoCone(0.55, 0.9, 6), pos: [Math.sin(a) * 0.5, 0.5, 0], rot: [0, 0, -a], scale: [1, 1, 0.25], color: [0xb060d0, 0xe08040, 0xe0e0e0, 0xd05080][i] });
  }
  return mergeParts(parts);
}

// ----------------------------------------------------------------- flora system
export class FloraSystem {
  constructor(hf, group, quality) {
    this.hf = hf; this.group = group; this.q = quality; this.planet = hf.p.id;
    this.defs = defs[this.planet] || [];
    this.chunks = new Map(); // key -> { meshes, targets[], nodes[] }
    this.depleted = new Set();
    this.mats = {};
    this.geos = {};
    this.defs.forEach((d, i) => {
      this.geos[d.id] = d.build(i);
      this.mats[d.id] = propMaterial({ glowColor: this.planet === 'vesper' ? 0x6affea : (this.planet === 'nivalis' ? 0x9ad0ff : 0xffffff), glowPower: d.glow ?? 0, flat: d.id.includes('rock') || d.id === 'boulder' || d.id === 'iceblock' });
    });
    this.nodeGeos = {};
    this.nodeMat = propMaterial({ roughness: 0.4, metalness: 0.2, glowPower: 1.1, glowColor: 0xffffff });
    this.colliders = new Map(); // chunk key -> [{x,z,r}]
  }

  nodeGeo(res) {
    if (this.nodeGeos[res]) return this.nodeGeos[res];
    const colors = { ferrolith: 0xb0623a, silicate_glass: 0xbfe6e0, echolite: 0xa27bff, biogel: 0x7ae08a, cryo_salt: 0x9ad8ff, deuterium_ice: 0xdff6ff, aqua_pearl: 0xf0e6ff };
    const c = colors[res] || 0xffffff;
    const parts = [{ geo: rockGeo(res.length * 31, 0.6, 1, 0.6, 0.25), pos: [0, 0.2, 0], color: 0x4a4038 }];
    for (let i = 0; i < 5; i++) {
      const a = i * 1.25;
      parts.push({ geo: geoCone(0.17, 0.7 + (i % 3) * 0.3, 5), pos: [Math.cos(a) * 0.3, 0.55, Math.sin(a) * 0.3], rot: [Math.sin(a) * 0.35, 0, Math.cos(a) * 0.35], color: c, emissive: res === 'echolite' || res === 'biogel' || res === 'aqua_pearl' });
    }
    return (this.nodeGeos[res] = mergeParts(parts));
  }

  addChunk(ch) {
    const { cx, cz, size, key } = ch;
    const hf = this.hf, x0 = cx * size, z0 = cz * size;
    const cell = 8, N = size / cell;
    const seed = hf.p.seed;
    const out = { meshes: [], targets: [], nodes: [], key };
    const colliders = [];
    const dummy = new THREE.Object3D();
    for (let di = 0; di < this.defs.length; di++) {
      const d = this.defs[di];
      const mats = [];
      const dens = d.density * this.q.flora * (cell * cell) / 100;
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const rng = mulberry32(hash2(cx * N + i, cz * N + j, seed + di * 131));
        let count = Math.floor(dens) + (rng() < dens % 1 ? 1 : 0);
        if (d.clusters && rng() < 0.5) count = 0; else if (d.clusters) count *= 3;
        for (let k = 0; k < count; k++) {
          const x = x0 + (i + rng()) * cell, z = z0 + (j + rng()) * cell;
          const h = hf.heightAt(x, z);
          if (d.hMin !== undefined && h < d.hMin) { rng(); rng(); continue; }
          if (d.hMax !== undefined && h > d.hMax) { rng(); rng(); continue; }
          const sl = hf.slopeAt(x, z, 1.5);
          if (sl > d.slopeMax) { rng(); rng(); continue; }
          if (this._nearSite(x, z)) { rng(); rng(); continue; }
          const s = rand(rng, d.scale[0], d.scale[1]), rot = rng() * TAU;
          dummy.position.set(x, h - 0.05, z);
          dummy.rotation.set(0, rot, 0);
          dummy.scale.set(s, s * (0.85 + rng() * 0.3), s);
          dummy.updateMatrix();
          mats.push(dummy.matrix.clone());
          if (d.scan) out.targets.push({ x, y: h + 0.6 * s, z, r: 0.9 * s, entry: d.scan, kind: 'flora', id: `${d.id}@${key}:${mats.length}` });
          if (d.collide && s > 1.4) colliders.push({ x, z, r: 0.55 * s });
        }
      }
      if (!mats.length) continue;
      const im = new THREE.InstancedMesh(this.geos[d.id], this.mats[d.id], mats.length);
      mats.forEach((m, n) => im.setMatrixAt(n, m));
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = !!d.cast && this.q.shadow; im.receiveShadow = true;
      im.frustumCulled = true;
      im.computeBoundingSphere?.();
      this.group.add(im); out.meshes.push(im);
    }
    // resource nodes
    const nd = nodeDefs[this.planet] || [];
    const byRes = {};
    for (let ni = 0; ni < nd.length; ni++) {
      const [res, dens100, filter] = nd[ni];
      const dens = dens100 * (size * size) / 100;
      const rng = mulberry32(hash2(cx, cz, seed + 9000 + ni * 17));
      const count = Math.floor(dens) + (rng() < dens % 1 ? 1 : 0);
      for (let k = 0; k < count; k++) {
        const x = x0 + rng() * size, z = z0 + rng() * size;
        const h = hf.heightAt(x, z);
        if (!filter(h) || hf.slopeAt(x, z, 1.5) > 1.1 || this._nearSite(x, z)) continue;
        const nodeId = `${key}:${res}:${k}`;
        if (this.depleted.has(nodeId)) continue;
        (byRes[res] ||= []).push({ x, y: h, z, nodeId, res, rot: rng() * TAU, s: 0.9 + rng() * 0.8 });
      }
    }
    for (const [res, list] of Object.entries(byRes)) {
      const im = new THREE.InstancedMesh(this.nodeGeo(res), this.nodeMat, list.length);
      list.forEach((n, i) => {
        dummy.position.set(n.x, n.y - 0.05, n.z); dummy.rotation.set(0, n.rot, 0); dummy.scale.setScalar(n.s); dummy.updateMatrix();
        im.setMatrixAt(i, dummy.matrix); n.index = i; n.mesh = im;
      });
      im.instanceMatrix.needsUpdate = true; im.castShadow = false;
      this.group.add(im); out.meshes.push(im);
      for (const n of list) { n.hp = 1; out.nodes.push(n); }
    }
    this.chunks.set(key, out);
    this.colliders.set(key, colliders);
  }

  removeChunk(ch) {
    const c = this.chunks.get(ch.key);
    if (!c) return;
    for (const m of c.meshes) { this.group.remove(m); m.dispose?.(); }
    this.chunks.delete(ch.key); this.colliders.delete(ch.key);
  }

  _nearSite(x, z) {
    for (const s of this.hf.sites) {
      const d = Math.hypot(x - s.x, z - s.z);
      if (d < (s.type === 'pad' ? s.r + 4 : s.r * 0.9)) return true;
    }
    return false;
  }

  // Removes a depleted node from rendering (scale to zero).
  depleteNode(node) {
    this.depleted.add(node.nodeId);
    const m = new THREE.Matrix4().makeScale(0, 0, 0);
    node.mesh.setMatrixAt(node.index, m); node.mesh.instanceMatrix.needsUpdate = true;
    node.gone = true;
  }

  nearbyTargets(x, z, range) {
    const out = [];
    for (const c of this.chunks.values()) {
      for (const t of c.targets) { if (Math.abs(t.x - x) < range && Math.abs(t.z - z) < range) out.push(t); }
    }
    return out;
  }
  nearbyNodes(x, z, range) {
    const out = [];
    for (const c of this.chunks.values()) for (const n of c.nodes) {
      if (!n.gone && Math.abs(n.x - x) < range && Math.abs(n.z - z) < range) out.push(n);
    }
    return out;
  }

  // Circle-vs-collider push-out for the player; returns [dx,dz].
  pushOut(x, z, pr = 0.45) {
    let dx = 0, dz = 0;
    const ck = Math.floor(x / CHUNK_SIZE), cj = Math.floor(z / CHUNK_SIZE);
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const list = this.colliders.get(`${ck + i},${cj + j}`);
      if (!list) continue;
      for (const c of list) {
        const ox = x - c.x, oz = z - c.z, d = Math.hypot(ox, oz), min = c.r + pr;
        if (d < min && d > 1e-4) { dx += (ox / d) * (min - d); dz += (oz / d) * (min - d); }
      }
    }
    return [dx, dz];
  }

  dispose() { for (const c of this.chunks.values()) for (const m of c.meshes) { this.group.remove(m); m.dispose?.(); } this.chunks.clear(); }
}
