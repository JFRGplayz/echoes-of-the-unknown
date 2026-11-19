import * as THREE from 'three';
import { ENTRIES } from '../data/codex.js';

const KIND_LABEL = {
  creature: 'UNKNOWN ORGANISM', flora: 'UNKNOWN PLANT', node: 'UNKNOWN DEPOSIT', site: 'UNKNOWN STRUCTURE',
  planet: 'UNSURVEYED WORLD', structure: 'UNKNOWN OBJECT', anomaly: 'ANOMALY',
};

// Aim-based scanner. Collects candidate targets, picks the one nearest the crosshair, and
// reveals journal facts while the trigger is held. Holding on a creature after the scan completes
// "observes" it: each behaviour the animal shows is recorded.
export class Scanner {
  constructor(game) {
    this.game = game;
    this.target = null; this.progress = 0; this.observeT = 0;
    this.lastFacts = [];
    this.active = false;
    this.range = 40;
    this._v = new THREE.Vector3(); this._d = new THREE.Vector3(); this._c = new THREE.Vector3();
    this.msg = '';
  }

  // origin/dir are THREE.Vector3 in the same space as target positions. `mode` 'foot' | 'ship'.
  pick(origin, dir, targets, range, mode) {
    let best = null, bestScore = 1e9;
    const v = this._v;
    for (const t of targets) {
      if (t.needsFlag && !this.game.journal.hasFlag(t.needsFlag)) continue;
      const px = t.pos ? t.pos.x : t.x, py = t.pos ? t.pos.y : t.y, pz = t.pos ? t.pos.z : t.z;
      v.set(px - origin.x, py - origin.y, pz - origin.z);
      const dist = v.length();
      const eff = mode === 'ship' ? range + (t.r || 0) : range;
      if (dist > eff) continue;
      const along = v.dot(dir);
      if (along <= 0) continue;
      // perpendicular distance to the ray vs. the target's radius
      const perp = Math.sqrt(Math.max(0, dist * dist - along * along));
      const ang = Math.atan2(Math.max(0, perp - (t.r || 0.5)), along);
      if (ang > (mode === 'ship' ? 0.09 : 0.07)) continue;
      // when several targets overlap the crosshair, prefer the smaller (more specific) one
      const score = ang * 10 + (perp / ((t.r || 0.5) + 0.5)) * 0.05 + dist * 0.0005;
      if (score < bestScore) { bestScore = score; best = { t, dist }; }
    }
    return best;
  }

  label(t) {
    const j = this.game.journal;
    const e = ENTRIES[t.entry];
    if (!e) return KIND_LABEL[t.kind] || 'UNKNOWN';
    const known = j.hasEntry(t.entry);
    if (t.kind === 'site' && t.label && known) return `${e.name} — ${t.label}`;
    if (known) return e.name;
    // partially-known planets show their name
    if (t.kind === 'planet') return e.name.toUpperCase();
    return KIND_LABEL[t.kind] || 'UNKNOWN';
  }

  // Returns the status object used by the HUD.
  update(dt, held, origin, dir, targets, range, tier, mode) {
    const g = this.game, j = g.journal;
    const hit = this.pick(origin, dir, targets, range, mode);
    const prev = this.target;
    this.target = hit ? hit.t : null;
    this.dist = hit ? hit.dist : 0;
    if (!this.target || (prev && prev.id !== this.target.id)) { this.progress = 0; this.observeT = 0; this.lastObs = null; }
    this.active = false; this.msg = '';
    if (!this.target) return this.status();
    const t = this.target;
    j.markSeen(t.entry);

    const keys = t.keys;
    const st = j.scanState(t.entry, tier, keys);
    const done = st.reveal.length === 0;
    this.blocked = st.blocked;
    if (held) {
      if (!g.vitals.hasEnergy(1) && mode === 'foot') { this.msg = 'Scanner: no energy'; return this.status(); }
      this.active = true;
      if (mode === 'foot') g.vitals.useEnergy(3.2 * dt);
      if (!done) {
        this.progress += dt / (t.kind === 'creature' ? 1.6 : t.kind === 'site' ? 1.3 : 0.9);
        if (this.progress >= 1) { this.progress = 0; this.complete(t, st); }
      } else if (t.kind === 'creature') {
        // observation mode
        this.observeBehavior(t, dt);
      } else if (st.blocked.length) this.msg = st.blocked[0].reason;
      else this.msg = 'Fully documented';
    } else {
      this.progress = Math.max(0, this.progress - dt * 1.5);
    }
    return this.status();
  }

  observeBehavior(t, dt) {
    const c = t.creature, e = ENTRIES[t.entry];
    if (!c || !e) return;
    const b = c.behavior;
    const fact = e.facts.find((f) => f.how === 'obs' && f.b === b);
    if (!fact) { this.msg = `Observing: ${b}`; this.observeT = 0; return; }
    if (this.game.journal.has(fact.id)) { this.msg = `Observed: ${b} (logged)`; return; }
    if (this.lastObs !== b) { this.lastObs = b; this.observeT = 0; }
    this.observeT += dt;
    this.msg = `Observing: ${b}…`;
    this.progress = Math.min(1, this.observeT / 3);
    if (this.observeT >= 3) { this.observeT = 0; this.progress = 0; this.game.journal.reveal(fact.id); this.game.audio?.scanDone(); }
  }

  complete(t, st) {
    const j = this.game.journal;
    const revealed = [];
    for (const f of st.reveal) { const r = j.reveal(f.id); if (r) revealed.push(r); }
    this.lastFacts = revealed;
    this.game.audio?.scanDone();
    // site scans of "flag" entries
    this.game.events.emit('scan:complete', { target: t, facts: revealed });
  }

  status() {
    const t = this.target;
    return { target: t, label: t ? this.label(t) : '', progress: this.progress, active: this.active, dist: this.dist, msg: this.msg, blocked: this.blocked || [] };
  }
}
