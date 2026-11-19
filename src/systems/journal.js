import { ENTRIES, ENTRY_LIST, CATEGORIES } from '../data/codex.js';
import { LINKS, QUESTIONS } from '../data/lore.js';

// The discovery journal: a progressive database of facts with connected-discovery links.
export class Journal {
  constructor(events) {
    this.events = events;
    this.facts = new Set();      // "entry:key"
    this.discovered = new Set(); // entry ids with at least one fact (or 'seen')
    this.seen = new Set();       // entries encountered but not yet scanned
    this.flags = new Set();
    this.links = new Set();
    this.lexicon = 0;
    this.times = {};             // fact id -> timestamp
    this.newFlags = new Set();   // unread entries
  }

  has(factId) { return this.facts.has(factId); }
  hasEntry(id) { return this.discovered.has(id); }
  flag(f) { this.flags.add(f); }
  hasFlag(f) { return this.flags.has(f); }

  markSeen(entryId) {
    if (ENTRIES[entryId] && !this.discovered.has(entryId) && !this.seen.has(entryId)) { this.seen.add(entryId); }
  }

  // Which facts of an entry can a scan reveal right now, and which are blocked and why.
  scanState(entryId, tier, onlyKeys) {
    const e = ENTRIES[entryId];
    const out = { reveal: [], blocked: [], known: [] };
    if (!e) return out;
    for (const f of e.facts) {
      if (f.how !== 'scan' && !(onlyKeys && onlyKeys.includes(f.k))) continue;
      if (onlyKeys && !onlyKeys.includes(f.k)) continue;
      if (this.facts.has(f.id)) { out.known.push(f); continue; }
      if (f.how === 'scan' || onlyKeys) {
        if ((f.tier || 1) > tier) { out.blocked.push({ f, reason: `Needs Scanner Mk ${f.tier}` }); continue; }
        if (f.lex && this.lexicon < f.lex) { out.blocked.push({ f, reason: `Needs Anthelion lexicon ${f.lex} (known: ${this.lexicon})` }); continue; }
        out.reveal.push(f);
      }
    }
    return out;
  }

  reveal(factId, silent = false) {
    if (this.facts.has(factId)) return null;
    const [entryId] = factId.split(':');
    const e = ENTRIES[entryId];
    if (!e) return null;
    const f = e.facts.find((x) => x.id === factId);
    if (!f) return null;
    this.facts.add(factId);
    this.times[factId] = Date.now();
    const newEntry = !this.discovered.has(entryId);
    this.discovered.add(entryId); this.seen.delete(entryId);
    this.newFlags.add(entryId);
    if (f.w) { this.lexicon++; }
    if (!silent) this.events.emit('journal:fact', { fact: f, entry: e, newEntry, lexicon: this.lexicon });
    this.checkLinks();
    this.checkSurveys();
    return f;
  }

  revealMany(list) { const out = []; for (const id of list) { const f = this.reveal(id); if (f) out.push(f); } return out; }

  checkLinks() {
    let changed = true;
    while (changed) {
      changed = false;
      for (const L of LINKS) {
        if (this.links.has(L.id)) continue;
        if (!L.needs.every((n) => this.facts.has(n))) continue;
        this.links.add(L.id); changed = true;
        for (const f of L.flags || []) this.flags.add(f);
        for (const g of L.grant || []) this.reveal(g, true);
        this.events.emit('journal:link', { link: L });
      }
    }
  }

  // A planet "survey" becomes available once enough of the world has been documented.
  checkSurveys() {
    for (const p of ['khepri', 'vesper', 'nivalis', 'pelagos']) {
      const fid = `${p}:survey`;
      if (this.facts.has(fid)) continue;
      const list = ENTRY_LIST.filter((e) => e.planet === p && e.cat !== 'planets' && e.cat !== 'history');
      if (!list.length) continue;
      const got = list.filter((e) => this.discovered.has(e.id)).length;
      if (got / list.length >= 0.7) this.reveal(fid);
    }
  }

  progress(entryId) {
    const e = ENTRIES[entryId];
    if (!e) return { got: 0, total: 0 };
    return { got: e.facts.filter((f) => this.facts.has(f.id)).length, total: e.facts.length };
  }

  planetProgress(p) {
    const list = ENTRY_LIST.filter((e) => e.planet === p && e.cat !== 'planets');
    let got = 0, tot = 0;
    for (const e of list) { const pr = this.progress(e.id); got += pr.got; tot += pr.total; }
    return { got, total: tot, pct: tot ? got / tot : 0 };
  }

  openQuestions() {
    const out = [];
    for (const q of QUESTIONS) {
      const answered = q.answeredBy ? this.facts.has(q.answeredBy) : false;
      out.push({ ...q, answered });
    }
    for (const L of LINKS) if (L.question && this.links.has(L.id)) out.push({ id: 'lq_' + L.id, text: L.question, answered: false, derived: true });
    return out;
  }

  totalProgress() {
    let got = 0, tot = 0;
    for (const e of ENTRY_LIST) { if (e.cat === 'planets' && false) continue; const p = this.progress(e.id); got += p.got; tot += p.total; }
    return { got, total: tot };
  }

  serialize() {
    return { facts: [...this.facts], seen: [...this.seen], flags: [...this.flags], links: [...this.links], lexicon: this.lexicon, discovered: [...this.discovered], times: this.times };
  }
  restore(d) {
    if (!d) return;
    this.facts = new Set(d.facts || []); this.seen = new Set(d.seen || []); this.flags = new Set(d.flags || []);
    this.links = new Set(d.links || []); this.lexicon = d.lexicon || 0; this.discovered = new Set(d.discovered || []); this.times = d.times || {};
  }
}

export { CATEGORIES };
