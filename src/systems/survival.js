import { clamp } from '../core/util.js';

// Suit vitals and environmental hazards. Intentionally simple and legible:
//   oxygen (breathing), energy (tools/jetpack), health (suit/body integrity), plus hazard readouts.
export class Vitals {
  constructor(game) {
    this.game = game;
    this.health = 100; this.oxygen = 100; this.energy = 100;
    this.hazards = { temp: 0, tempState: 'ok', rad: 0, toxic: 0, pressure: 0, o2: 0 };
    this.ambient = 20; this.status = [];
    this.dead = false; this.hurtFlash = 0; this.invuln = 0;
  }

  get maxO2() { return this.game.stats.o2Max; }
  get maxEnergy() { return this.game.stats.energyMax; }
  useEnergy(n) { this.energy = Math.max(0, this.energy - n); }
  hasEnergy(n = 0.1) { return this.energy > n; }

  damage(amount, kind) {
    if (this.dead || this.invuln > 0 || amount <= 0) return;
    this.health = Math.max(0, this.health - amount);
    this.hurtFlash = Math.min(1, this.hurtFlash + Math.min(0.6, amount / 30));
    this.game.events.emit('player:hurt', { amount, kind });
    if (this.health <= 0 && !this.dead) { this.dead = true; this.game.events.emit('player:died', { kind }); }
  }

  refill(full = true) { this.oxygen = this.maxO2; this.energy = this.maxEnergy; if (full) this.health = 100; }
  revive() { this.dead = false; this.health = 100; this.oxygen = this.maxO2; this.energy = this.maxEnergy; this.invuln = 3; }

  // env: { planet, ambientTemp, rad, weather:{type,intensity}, underwater, headDepth, depth, sheltered, safe, inShip, dayFactor, outdoors }
  update(dt, env) {
    if (this.dead) return;
    const st = this.game.stats, p = env.planet;
    this.invuln = Math.max(0, this.invuln - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 1.6);
    const status = [];
    let dmg = 0;
    const H = this.hazards;

    // ---- oxygen
    const maxO2 = st.o2Max;
    this.oxygen = Math.min(this.oxygen, maxO2);
    if (env.safe || env.inShip) {
      this.oxygen = Math.min(maxO2, this.oxygen + 25 * dt); this.energy = Math.min(st.energyMax, this.energy + 20 * dt);
      H.o2 = 0;
    } else if (env.underwater) {
      this.oxygen -= 1.25 * dt; H.o2 = 1.25;
      status.push('UNDERWATER');
    } else if (!p.breathable) {
      this.oxygen -= p.o2Drain * (env.sprinting ? 1.5 : 1) * dt; H.o2 = p.o2Drain;
    } else {
      this.oxygen = Math.min(maxO2, this.oxygen + 8 * dt); H.o2 = 0;
    }
    if (this.oxygen <= 0) { this.oxygen = 0; dmg += 5 * dt; status.push('SUFFOCATING'); }
    else if (this.oxygen < maxO2 * 0.2) status.push('LOW OXYGEN');

    // ---- temperature
    let T = env.ambientTemp;
    if (env.sheltered) T = T * 0.35 + 12 * 0.65;
    if (env.underwater) T = Math.max(T * 0.2 + 8, 8);
    this.ambient = T;
    H.temp = T;
    if (!env.inShip && !env.safe) {
      if (T < st.thermMin) { const d = st.thermMin - T; dmg += Math.min(6, 0.35 + d * 0.09) * dt; status.push('FREEZING'); H.tempState = 'cold'; }
      else if (T > st.thermMax) { const d = T - st.thermMax; dmg += Math.min(6, 0.35 + d * 0.09) * dt; status.push('OVERHEATING'); H.tempState = 'hot'; }
      else if (T < st.thermMin + 8) { status.push('COLD'); H.tempState = 'cold-warn'; }
      else if (T > st.thermMax - 8) { status.push('HOT'); H.tempState = 'hot-warn'; }
      else H.tempState = 'ok';
    } else H.tempState = 'ok';

    // ---- radiation
    H.rad = env.rad || 0;
    if (!env.inShip && H.rad > 0.04) {
      const eff = H.rad * (1 - st.radShield);
      if (eff > 0.03) { dmg += eff * 6.5 * dt; status.push('RADIATION'); }
    }

    // ---- atmospheric toxins (storms)
    H.toxic = 0;
    const w = env.weather;
    if (w && w.intensity > 0.2 && !env.inShip && !env.safe && !env.sheltered && !env.underwater) {
      if (w.type === 'sporestorm') H.toxic = st.filter >= 1 ? 0 : w.intensity;
      else if (w.type === 'sandstorm') H.toxic = st.filter >= 1 ? 0 : w.intensity * 0.6;
      else if (w.type === 'blizzard') H.toxic = 0;
      if (H.toxic > 0) { dmg += H.toxic * 2.2 * dt; status.push('TOXIC AIR'); }
      if (w.type === 'sporestorm' && st.filter < 2 && st.filter >= 1) status.push('FILTER STRAINED');
    }

    // ---- pressure
    H.pressure = 0;
    if (env.depth > 0 && !env.inShip) {
      const ratio = env.depth / st.depthMax;
      H.pressure = ratio;
      if (ratio > 1) { dmg += Math.min(14, (env.depth - st.depthMax) * 0.18 + 1.5) * dt; status.push('CRUSH DEPTH'); }
      else if (ratio > 0.82) status.push('PRESSURE');
    }

    // ---- energy regen (solar + shelter)
    if (!env.safe && !env.inShip) {
      const solar = env.outdoors ? (0.25 + 1.4 * env.dayFactor) : 0.1;
      this.energy = Math.min(st.energyMax, this.energy + solar * dt);
    }
    this.energy = clamp(this.energy, 0, st.energyMax);

    // ---- health
    if (dmg > 0) this.damage(dmg, status[status.length - 1] || 'hazard');
    else if (this.health < 100) this.health = Math.min(100, this.health + (env.safe || env.inShip ? 6 : 0.7) * dt);
    this.status = status;
  }

  serialize() { return { health: this.health, oxygen: this.oxygen, energy: this.energy }; }
  restore(d) { if (!d) return; this.health = d.health ?? 100; this.oxygen = d.oxygen ?? 100; this.energy = d.energy ?? 100; this.dead = false; }
}
