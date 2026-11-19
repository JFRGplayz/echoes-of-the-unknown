import * as THREE from 'three';
import { OUTPOSTS } from '../data/upgrades.js';
import { mergeParts, propMaterial, geoBox, geoCyl, geoCone, geoSphere, geoTorus } from '../core/util3d.js';

const mat = () => propMaterial({ metalness: 0.4, roughness: 0.5, glowColor: 0x66ffcc, glowPower: 1.5 });

function buildOutpost(type) {
  const parts = [];
  switch (type) {
    case 'lab':
      parts.push({ geo: geoCyl(3.2, 3.5, 3, 10), pos: [0, 1.5, 0], color: 0xd8dce4 }, { geo: geoSphere(3.2, 10, 6), pos: [0, 3, 0], scale: [1, 0.6, 1], color: 0xbfc4d0 },
        { geo: geoBox(1.4, 2.2, 0.2), pos: [0, 1.1, 3.4], color: 0x2a3a4e }, { geo: geoBox(1.6, 0.2, 0.1), pos: [0, 2.1, 3.45], color: 0x66ffcc, emissive: true },
        { geo: geoCyl(0.08, 0.08, 4, 5), pos: [2.4, 5, 0], color: 0x888888 }, { geo: geoTorus(0.6, 0.05, 4, 12), pos: [2.4, 6.8, 0], rot: [0.5, 0, 0], color: 0xdddddd });
      break;
    case 'platform':
      for (const [x, z] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) parts.push({ geo: geoCyl(0.15, 0.2, 6, 5), pos: [x, 3, z], color: 0x9a9ea8 });
      parts.push({ geo: geoBox(4.4, 0.3, 4.4), pos: [0, 6, 0], color: 0xb4b8c2 }, { geo: geoBox(0.8, 0.8, 0.8), pos: [0, 6.7, 0], color: 0x2a3a4e }, { geo: geoSphere(0.5, 8, 6), pos: [0, 7.4, 0], color: 0x66ffcc, emissive: true });
      break;
    case 'extractor':
      parts.push({ geo: geoCyl(1.2, 1.6, 2.2, 8), pos: [0, 1.1, 0], color: 0x8a8f9a }, { geo: geoBox(0.5, 3.2, 0.5), pos: [0, 3.4, 0], color: 0x707580 },
        { geo: geoBox(2.4, 0.3, 0.4), pos: [0, 5, 0], color: 0x707580 }, { geo: geoSphere(0.4, 6, 5), pos: [0, 2.3, 1.5], color: 0xffb040, emissive: true });
      break;
    case 'storage':
      parts.push({ geo: geoBox(3, 2.2, 2), pos: [0, 1.1, 0], color: 0x9aa0ac }, { geo: geoBox(3.1, 0.15, 2.1), pos: [0, 2.25, 0], color: 0x707580 }, { geo: geoBox(0.6, 0.3, 0.05), pos: [0, 1.5, 1.03], color: 0x66ffcc, emissive: true });
      break;
    default: // monitor
      parts.push({ geo: geoCyl(0.2, 0.3, 3, 6), pos: [0, 1.5, 0], color: 0xb0b4be }, { geo: geoSphere(0.7, 8, 6), pos: [0, 3.3, 0], color: 0xd0d4de },
        { geo: geoBox(1.4, 0.05, 1.4), pos: [0, 3.95, 0], rot: [0.35, 0, 0], color: 0x2a3a6a }, { geo: geoSphere(0.18, 6, 5), pos: [0, 3.3, 0.7], color: 0x66ffcc, emissive: true });
  }
  const m = new THREE.Mesh(mergeParts(parts), mat()); m.castShadow = true; m.receiveShadow = true;
  const g = new THREE.Group(); g.add(m);
  return g;
}

export class Outposts {
  constructor(game) {
    this.game = game; this.list = []; // {type,x,z,y,planet,group,stock,t}
    this.ghost = null; this.placing = null;
    this.group = new THREE.Group();
  }

  attach(scene, planetId) { this.scene = scene; this.planet = planetId; scene.add(this.group); }
  detach() { if (this.scene) this.scene.remove(this.group); }

  clearMeshes() { for (const o of this.list) { if (o.group) this.group.remove(o.group); o.group = null; } }
  materialise(planetId, hf) {
    this.clearMeshes();
    for (const o of this.list) {
      if (o.planet !== planetId) continue;
      o.group = buildOutpost(o.type); o.y = hf.heightAt(o.x, o.z);
      o.group.position.set(o.x, o.y, o.z); o.group.rotation.y = o.rot || 0; this.group.add(o.group);
    }
    this.recount();
  }

  recount() {
    const n = this.list.filter((o) => o.type === 'storage').length;
    this.game.inventory.storageBonus = Math.min(3, n) * 40;
  }

  startPlacing(type) {
    this.cancelPlacing();
    const def = OUTPOSTS.find((o) => o.id === type); if (!def) return false;
    if (!this.game.inventory.has(def.cost)) { this.game.ui.toast('Missing resources for ' + def.name, 'warn'); return false; }
    this.placing = type; this.ghost = buildOutpost(type);
    this.ghost.traverse((n) => { if (n.material) { n.material = n.material.clone(); n.material.transparent = true; n.material.opacity = 0.5; } });
    this.group.add(this.ghost);
    return true;
  }
  cancelPlacing() { if (this.ghost) { this.group.remove(this.ghost); this.ghost = null; } this.placing = null; }

  updateGhost(player, hf, yaw) {
    if (!this.ghost) return;
    const d = 6;
    const x = player.pos.x - Math.sin(yaw) * d, z = player.pos.z - Math.cos(yaw) * d;
    const y = hf.heightAt(x, z), slope = hf.slopeAt(x, z, 2);
    this.ghost.position.set(x, y, z); this.ghost.rotation.y = yaw;
    this.ghostOK = slope < 0.35 && !(hf.waterLevel !== null && y < hf.waterLevel);
    this.ghost.traverse((n) => { if (n.material?.color) n.material.color.set(this.ghostOK ? 0xaaffdd : 0xff8080); });
  }

  place() {
    if (!this.ghost || !this.ghostOK) { this.game.ui.toast('Cannot build here', 'warn'); return false; }
    const def = OUTPOSTS.find((o) => o.id === this.placing);
    if (!this.game.inventory.spend(def.cost)) return false;
    const o = { type: this.placing, x: this.ghost.position.x, z: this.ghost.position.z, rot: this.ghost.rotation.y, planet: this.planet, stock: 0, t: 0 };
    o.group = buildOutpost(o.type); o.group.position.copy(this.ghost.position); o.group.rotation.y = o.rot; o.y = this.ghost.position.y;
    this.group.add(o.group); this.list.push(o);
    this.cancelPlacing(); this.recount();
    this.game.events.emit('outpost:built', { outpost: o, def });
    return true;
  }

  here(planetId, x, z, r) { return this.list.filter((o) => o.planet === planetId && Math.hypot(o.x - x, o.z - z) < r); }
  nearest(planetId, x, z, type, r = 12) {
    let best = null, bd = r;
    for (const o of this.list) { if (o.planet !== planetId || (type && o.type !== type)) continue; const d = Math.hypot(o.x - x, o.z - z); if (d < bd) { bd = d; best = o; } }
    return best;
  }

  update(dt, planetId, hf, resHint) {
    for (const o of this.list) {
      if (o.type !== 'extractor' || o.planet !== planetId) continue;
      o.t += dt;
      if (o.t >= 45 && o.stock < 20) { o.t = 0; o.stock++; }
    }
  }

  // Which resource an extractor yields: the most common local node type for the planet.
  yieldRes(planetId) { return { khepri: 'ferrolith', vesper: 'biogel', nivalis: 'cryo_salt', pelagos: 'ferrolith' }[planetId] || 'ferrolith'; }

  // scan range bonus near observation platforms
  scanBonus(planetId, x, z) { return this.here(planetId, x, z, 30).some((o) => o.type === 'platform') ? 30 : 0; }

  serialize() { return this.list.map((o) => ({ type: o.type, x: o.x, z: o.z, rot: o.rot, planet: o.planet, stock: o.stock, t: o.t })); }
  restore(d) { this.list = (d || []).map((o) => ({ ...o, group: null })); }
}
