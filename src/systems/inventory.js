import { UPGRADES, baseStats, RES_NAMES } from '../data/upgrades.js';

// Resources, samples and upgrade ownership.
export class Inventory {
  constructor(events, journal) {
    this.events = events; this.journal = journal;
    this.res = {}; this.samples = new Set(); this.owned = {};
    for (const g of UPGRADES) this.owned[g.id] = 0;
    this.storageBonus = 0;
    this.stats = baseStats();
    this.recompute();
  }

  recompute() {
    const s = baseStats();
    for (const g of UPGRADES) for (let i = 0; i <= this.owned[g.id]; i++) Object.assign(s, g.levels[i].stats);
    this.stats = s;
    return s;
  }

  get capacity() { return this.stats.cargo + this.storageBonus; }
  get used() { let n = 0; for (const v of Object.values(this.res)) n += v; return n; }
  count(res) { return this.res[res] || 0; }

  add(res, n = 1) {
    const room = Math.max(0, this.capacity - this.used);
    const add = Math.min(room, n);
    if (add > 0) { this.res[res] = (this.res[res] || 0) + add; this.events.emit('inventory:change', { res, n: add }); }
    return add;
  }
  has(cost) { for (const [r, n] of Object.entries(cost)) if (this.count(r) < n) return false; return true; }
  spend(cost) { if (!this.has(cost)) return false; for (const [r, n] of Object.entries(cost)) { this.res[r] -= n; if (this.res[r] <= 0) delete this.res[r]; } this.events.emit('inventory:change', {}); return true; }

  addSample(entry) { if (this.samples.has(entry)) return false; this.samples.add(entry); this.events.emit('inventory:sample', { entry }); return true; }

  reqMet(req) {
    if (!req) return true;
    if (req.fact && !this.journal.has(req.fact)) return false;
    if (req.flag && !this.journal.hasFlag(req.flag)) return false;
    return true;
  }
  reqText(req) {
    if (!req) return '';
    if (req.fact) return `Requires research: ${req.fact.split(':')[0].replace(/_/g, ' ')} (${req.fact.split(':').slice(1).join(' ')})`;
    if (req.flag) return 'Requires a connected discovery';
    return '';
  }

  nextLevel(groupId) { const g = UPGRADES.find((x) => x.id === groupId); const n = this.owned[groupId] + 1; return n < g.levels.length ? { group: g, index: n, level: g.levels[n] } : null; }

  canBuy(groupId) {
    const nx = this.nextLevel(groupId);
    if (!nx) return { ok: false, reason: 'Max level' };
    if (!this.reqMet(nx.level.req)) return { ok: false, reason: this.reqText(nx.level.req) };
    if (!this.has(nx.level.cost)) return { ok: false, reason: 'Missing resources' };
    return { ok: true };
  }
  buy(groupId) {
    const c = this.canBuy(groupId);
    if (!c.ok) return c;
    const nx = this.nextLevel(groupId);
    this.spend(nx.level.cost); this.owned[groupId] = nx.index; this.recompute();
    this.events.emit('upgrade:bought', { group: nx.group, level: nx.level });
    return { ok: true };
  }

  serialize() { return { res: this.res, samples: [...this.samples], owned: this.owned }; }
  restore(d) {
    if (!d) return;
    this.res = d.res || {}; this.samples = new Set(d.samples || []);
    for (const k of Object.keys(this.owned)) this.owned[k] = (d.owned && d.owned[k]) || 0;
    this.recompute();
  }
}

export { RES_NAMES };
