// Pure-math terrain (no three.js): height, slope, water and site flattening per planet.
import { Noise } from '../core/noise.js';
import { clamp, lerp, smoothstep } from '../core/util.js';
import { PLANETS } from '../data/planets.js';
import { SITES } from '../data/lore.js';

export class Heightfield {
  constructor(planetId) {
    this.id = planetId;
    this.p = PLANETS[planetId];
    this.n = new Noise(this.p.seed);
    this.n2 = new Noise(this.p.seed + 77);
    this.waterLevel = this.p.waterLevel;
    this.sites = SITES[planetId] || [];
    // flatten targets: raw height sampled at each site centre
    this.flat = [];
    for (const s of this.sites) {
      if (s.noFlatten || s.type.startsWith('geo_') || s.type === 'static') continue;
      const raw = this.raw(s.x, s.z);
      const h = s.h !== undefined ? s.h : (s.type === 'pad' ? Math.max(raw, (this.waterLevel ?? -1e9) + 3) : raw);
      this.flat.push({ x: s.x, z: s.z, r: s.r * (s.type === 'pad' ? 1 : 0.9), h });
      s.y = h;
    }
    for (const s of this.sites) if (s.y === undefined) s.y = this.heightAt(s.x, s.z);
  }

  raw(x, z) {
    const n = this.n, n2 = this.n2;
    switch (this.p.terrainType) {
      case 'canyon': {
        let base = 60 + n.fbm(x / 1400, z / 1400, 4) * 45 + n.fbm(x / 260, z / 260, 3) * 7;
        // river-cut canyons: narrow valleys where a low-frequency noise crosses zero
        const c = Math.abs(n2.fbm(x / 1700 + 11, z / 1700 - 5, 3));
        const cut = 1 - smoothstep(0.0, 0.11, c);
        base -= cut * (70 + n.simplex(x / 90, z / 90) * 8);
        // strata terracing
        const t = base / 9;
        base = (Math.floor(t) + smoothstep(0.35, 0.65, t - Math.floor(t))) * 9;
        base += n2.ridged(x / 420, z / 420, 3) * 14;
        return base;
      }
      case 'jungle': {
        let h = 26 + n.fbm(x / 900, z / 900, 5) * 42 + n.fbm(x / 140, z / 140, 3) * 5;
        const r = Math.abs(n2.fbm(x / 1300 + 3, z / 1300 + 9, 3));
        h -= (1 - smoothstep(0.0, 0.07, r)) * 28;
        return h;
      }
      case 'glacier': {
        let h = 40 + n.fbm(x / 1100, z / 1100, 5) * 38 + n2.ridged(x / 700, z / 700, 4) * 26;
        h += n.fbm(x / 70, z / 70, 3) * 2.5;
        return h;
      }
      case 'archipelago': {
        let h = -62 + n.fbm(x / 600, z / 600, 4) * 16;
        for (const i of this.p.islands) {
          const d = Math.hypot(x - i.x, z - i.z) / i.r;
          h += (i.h + 62) * Math.exp(-d * d * 1.6) * (0.85 + 0.15 * n2.fbm(x / 90, z / 90, 2));
        }
        // a few more small islets from noise
        const ni = n2.fbm(x / 800 + 40, z / 800 - 20, 3);
        h += Math.max(0, ni - 0.35) * 260;
        const t = this.p.trench;
        const dt = Math.hypot(x - t.x, z - t.z) / t.r;
        h -= t.depth * Math.exp(-dt * dt * 1.3);
        return h;
      }
      default: return 0;
    }
  }

  heightAt(x, z) {
    let h = this.raw(x, z);
    for (const f of this.flat) {
      const d = Math.hypot(x - f.x, z - f.z);
      if (d < f.r + 55) {
        const w = 1 - smoothstep(f.r, f.r + 55, d);
        h = lerp(h, f.h, w);
      }
    }
    return h;
  }

  slopeAt(x, z, e = 2) {
    const dx = this.heightAt(x + e, z) - this.heightAt(x - e, z);
    const dz = this.heightAt(x, z + e) - this.heightAt(x, z - e);
    return Math.hypot(dx, dz) / (2 * e); // rise/run
  }

  normalAt(x, z, out = [0, 1, 0], e = 1.5) {
    const dx = this.heightAt(x + e, z) - this.heightAt(x - e, z);
    const dz = this.heightAt(x, z + e) - this.heightAt(x, z - e);
    const l = Math.hypot(dx, 2 * e, dz);
    out[0] = -dx / l; out[1] = (2 * e) / l; out[2] = -dz / l;
    return out;
  }

  isWater(x, z) { return this.waterLevel !== null && this.heightAt(x, z) < this.waterLevel; }
  depthAt(x, z) { return this.waterLevel === null ? 0 : Math.max(0, this.waterLevel - this.heightAt(x, z)); }

  // Nearest radiation / hazard intensity (0..1) at a position, from sites with `rad`.
  radiationAt(x, z, revealedHidden = true) {
    let r = 0;
    for (const s of this.sites) {
      if (!s.rad) continue;
      const d = Math.hypot(x - s.x, z - s.z);
      const range = s.r * 2.6;
      if (d < range) r = Math.max(r, s.rad * (1 - d / range));
    }
    return clamp(r, 0, 1);
  }
}
