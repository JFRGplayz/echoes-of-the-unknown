import * as THREE from 'three';
import { PLANETS } from '../data/planets.js';
import { Heightfield } from './heightfield.js';
import { TerrainStreamer } from './terrain.js';
import { FloraSystem } from './flora.js';
import { Structures } from './structures.js';
import { Atmosphere } from './sky.js';
import { Water } from './water.js';
import { CreatureManager } from '../entities/creatures.js';

// Everything that exists on a planet's surface: terrain streaming, props, structures, sky, creatures.
export class PlanetWorld {
  constructor(game, planetId) {
    this.game = game; this.id = planetId; this.p = PLANETS[planetId];
    this.q = game.quality;
    this.scene = new THREE.Scene();
    this.hf = new Heightfield(planetId);
    this.atmos = new Atmosphere(this.scene, this.p, this.q, this.p.seed);
    this.terrain = new TerrainStreamer(this.scene, this.hf, this.q);
    this.floraGroup = new THREE.Group(); this.scene.add(this.floraGroup);
    this.flora = new FloraSystem(this.hf, this.floraGroup, this.q);
    this.structures = new Structures(this.scene, this.hf, this.flora, this.q);
    this.terrain.onChunkAdd = (ch) => this.flora.addChunk(ch);
    this.terrain.onChunkRemove = (ch) => this.flora.removeChunk(ch);
    this.water = this.p.waterLevel !== null ? new Water(this.scene, this.p.waterLevel, this.p) : null;
    this.creatures = new CreatureManager(this.scene, this.hf, this.flora, this.structures, this.atmos, this.q, game.events);
    this.pad = this.hf.sites.find((s) => s.type === 'pad');
    this.time = 0;
    this.digged = new Set();
    this.atmos.onThunder = () => game.events.emit('weather:thunder');
  }

  prime(x, z) { this.terrain.prime(x, z); }

  update(dt, ctx) {
    this.time += dt;
    const cam = ctx.camPos;
    this.atmos.update(dt, cam, ctx.focus, ctx.timeScale || 1);
    this.terrain.update(ctx.focus.x, ctx.focus.z, 1);
    this.water?.update(dt, cam, this.atmos.storm);
    this.structures.update(this.time, dt, this.atmos.dayFactor);
    this.creatures.update(dt, { px: ctx.focus.x, pz: ctx.focus.z, py: ctx.focus.y, inShip: ctx.inShip, dayFactor: this.atmos.dayFactor, time: this.time, hostile: ctx.hostile, playerLoud: ctx.loud });
  }

  // All scan targets near a point.
  scanTargets(x, z, range, includeNodes = true) {
    const out = [];
    for (const t of this.flora.nearbyTargets(x, z, range)) out.push(t);
    for (const t of this.structures.scanTargets) if (Math.abs(t.x - x) < range + t.r && Math.abs(t.z - z) < range + t.r) out.push(t);
    for (const t of this.creatures.targets(x, z, range)) out.push(t);
    if (includeNodes) {
      for (const n of this.flora.nearbyNodes(x, z, range)) out.push({ kind: 'node', entry: n.res, x: n.x, y: n.y + 0.6, z: n.z, r: 0.9, node: n, id: 'n:' + n.nodeId });
      for (const n of this.structures.siteNodes) if (!n.gone && Math.abs(n.x - x) < range && Math.abs(n.z - z) < range) out.push({ kind: 'node', entry: n.res, x: n.x, y: n.y + 0.6, z: n.z, r: 0.9, node: n, id: 'n:' + n.nodeId });
    }
    return out;
  }

  minableNodes(x, z, range) {
    const out = this.flora.nearbyNodes(x, z, range);
    for (const n of this.structures.siteNodes) if (!n.gone && Math.abs(n.x - x) < range && Math.abs(n.z - z) < range) out.push(n);
    return out;
  }

  depleteNode(n) {
    n.gone = true;
    if (n.single) n.single.visible = false;
    else this.flora.depleteNode(n);
    if (n.single) this.flora.depleted.add(n.nodeId);
  }

  pushOut(x, z, pr = 0.45) {
    let [dx, dz] = this.flora.pushOut(x, z, pr);
    for (const c of this.structures.colliders) {
      const ox = x + dx - c.x, oz = z + dz - c.z, d = Math.hypot(ox, oz), min = c.r + pr;
      if (d < min && d > 1e-4) { dx += (ox / d) * (min - d); dz += (oz / d) * (min - d); }
    }
    return [dx, dz];
  }

  siteAt(x, z) {
    let best = null, bd = 1e9;
    for (const s of this.hf.sites) { const d = Math.hypot(x - s.x, z - s.z); if (d < s.r && d < bd) { bd = d; best = s; } }
    return best;
  }

  sheltered(x, z) {
    for (const s of this.hf.sites) if (s.shelter && Math.hypot(x - s.x, z - s.z) < s.r * 0.42) return true;
    return false;
  }

  dispose() {
    this.creatures.dispose(); this.flora.dispose(); this.structures.dispose(); this.terrain.dispose(); this.atmos.dispose(); this.water?.dispose();
    this.scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  }
}
