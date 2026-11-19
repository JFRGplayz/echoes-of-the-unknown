import { CATEGORIES, ENTRY_LIST, ENTRIES, entryHowText } from '../data/codex.js';
import { UPGRADES, OUTPOSTS, RES_NAMES, RES_COLORS } from '../data/upgrades.js';
import { ORRIN } from '../data/lore.js';
import { PLANETS, PLANET_ORDER } from '../data/planets.js';
import { Settings, QUALITY } from '../core/save.js';
import { fmtDist, clamp } from '../core/util.js';

const $ = (id) => document.getElementById(id);
function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v; else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
}
const costHtml = (cost, inv) => Object.entries(cost).map(([r, n]) => `<span class="${inv.count(r) >= n ? 'ok' : 'no'}">${n} ${RES_NAMES[r]}</span>`).join(' · ') || '<span class="ok">Free</span>';

export class UI {
  constructor(game) {
    this.game = game;
    this.el = { hud: $('hud'), panels: $('panels'), dialog: $('dialog'), prompt: $('prompt'), toasts: $('toasts'), crosshair: $('crosshair'), menu: $('menu') };
    this.panel = null; this.tab = {}; this.sel = {};
    this.markers = $('markers'); this.mctx = this.markers.getContext('2d');
    this.toolsEl = $('tools'); this._tools = '';
    this.lastPrompt = null;
    this.mapState = { zoom: 1, cx: 0, cz: 0 };
    const rs = () => { this.markers.width = innerWidth; this.markers.height = innerHeight; };
    addEventListener('resize', rs); rs();
    this.buildCompass();
  }

  // ------------------------------------------------------------------ HUD
  buildCompass() {
    const strip = $('compass-strip'); this.compassStrip = strip;
    const names = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
    for (let rep = -1; rep <= 1; rep++) for (let i = 0; i < 36; i++) {
      const deg = i * 10, nm = names[deg];
      const s = h('span', { class: nm && deg % 90 === 0 ? 'card' : '' }, nm || (deg % 30 === 0 ? String(deg) : '·'));
      s.dataset.deg = deg + rep * 360; strip.append(s);
    }
  }
  setCompass(headingDeg, info = '') {
    const px = 420 / 2, scale = 2.2; // px per degree
    for (const s of this.compassStrip.children) s.style.left = (px + (+s.dataset.deg - headingDeg) * scale) + 'px';
    $('compass-info').textContent = info;
  }
  show(on) { this.el.hud.classList.toggle('hidden', !on); }
  toast(msg, kind = '', sub = '') {
    const t = h('div', { class: 'toast ' + kind }, msg, sub ? h('small', {}, sub) : null);
    this.el.toasts.append(t);
    while (this.el.toasts.children.length > 5) this.el.toasts.firstChild.remove();
    setTimeout(() => t.remove(), kind === 'link' ? 7000 : 4200);
  }
  banner(title, sub = '') {
    const b = $('banner'); $('banner-title').textContent = title; $('banner-sub').textContent = sub;
    b.classList.remove('hidden'); b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
    clearTimeout(this._bt); this._bt = setTimeout(() => b.classList.add('hidden'), 4600);
  }
  prompt(html) {
    if (html === this.lastPrompt) return; this.lastPrompt = html;
    if (!html) this.el.prompt.classList.add('hidden'); else { this.el.prompt.innerHTML = html; this.el.prompt.classList.remove('hidden'); }
  }
  setVitals(v, maxO2, maxEn, tempC, status, tempState) {
    $('b-health').style.width = clamp(v.health, 0, 100) + '%';
    $('b-o2').style.width = clamp(v.oxygen / maxO2 * 100, 0, 100) + '%';
    $('b-energy').style.width = clamp(v.energy / maxEn * 100, 0, 100) + '%';
    $('b-health').classList.toggle('low', v.health < 30); $('b-o2').classList.toggle('low', v.oxygen < maxO2 * 0.2);
    const t = $('temp'); t.textContent = `${Math.round(tempC)}°C`; t.className = tempState.endsWith('warn') ? 'warn' : (tempState === 'cold' || tempState === 'hot') ? 'bad' : '';
    $('status').innerHTML = status.map((s) => `<span class="${['FREEZING', 'OVERHEATING', 'SUFFOCATING', 'CRUSH DEPTH', 'RADIATION', 'TOXIC AIR'].includes(s) ? 'bad' : ''}">${s}</span>`).join(' · ');
  }
  hurt(a) { $('vignette').style.opacity = clamp(a, 0, 1); }
  underwater(on) { $('underwater').classList.toggle('hidden', !on); }
  fade(alpha, color = '#fff', ms = 600) { const f = $('fade'); f.style.transition = `opacity ${ms}ms`; f.style.background = color; f.style.opacity = alpha; }
  loc(html) { $('loc').innerHTML = html; }
  setTools(list, sel) {
    const key = JSON.stringify([list, sel]); if (key === this._tools) return; this._tools = key;
    this.toolsEl.innerHTML = '';
    list.forEach((t, i) => this.toolsEl.append(h('div', { class: 'tool' + (i === sel ? ' sel' : '') + (t.off ? ' off' : '') }, h('span', { class: 'k' }, String(i + 1)), t.name)));
  }
  setScan(s, hint = '') {
    const box = $('scanbox'), cross = this.el.crosshair;
    if (!s || !s.target) { box.classList.add('hidden'); cross.classList.remove('lock'); return; }
    box.classList.remove('hidden'); cross.classList.add('lock');
    $('scan-label').textContent = s.label; $('scan-fill').style.width = Math.round(s.progress * 100) + '%';
    $('scan-hint').textContent = s.msg || hint || (s.dist ? fmtDist(s.dist) : '');
  }
  setShipHud(main, sub) { $('shiphud').classList.remove('hidden'); $('ship-main').textContent = main; $('ship-sub').innerHTML = sub; }
  hideShipHud() { $('shiphud').classList.add('hidden'); }

  drawMarkers(list) {
    const c = this.mctx, w = this.markers.width, hgt = this.markers.height;
    c.clearRect(0, 0, w, hgt);
    c.font = '12px "Segoe UI", sans-serif'; c.textAlign = 'center';
    for (const m of list) {
      const col = m.color || '#7fe8e0';
      let x = m.x, y = m.y;
      if (!m.on) { // clamp to screen edge with an arrow
        const cx = w / 2, cy = hgt / 2, dx = x - cx, dy = y - cy, a = Math.atan2(dy, dx);
        const mx = w / 2 - 40, my = hgt / 2 - 60, k = Math.min(Math.abs(mx / (dx || 1e-6)), Math.abs(my / (dy || 1e-6)));
        x = cx + dx * k; y = cy + dy * k;
        c.save(); c.translate(x, y); c.rotate(a); c.fillStyle = col; c.globalAlpha = 0.8; c.beginPath(); c.moveTo(10, 0); c.lineTo(-6, 6); c.lineTo(-6, -6); c.fill(); c.restore();
        c.globalAlpha = 0.9; c.fillStyle = col; c.fillText(m.label.slice(0, 18), x, y + (y > hgt / 2 ? -14 : 22)); c.globalAlpha = 1; continue;
      }
      c.strokeStyle = col; c.fillStyle = col; c.globalAlpha = 0.9; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(x, y - 9); c.lineTo(x + 9, y); c.lineTo(x, y + 9); c.lineTo(x - 9, y); c.closePath(); c.stroke();
      c.fillText(m.label, x, y - 16); c.globalAlpha = 0.65; c.fillText(m.dist, x, y + 24); c.globalAlpha = 1;
    }
  }

  // ------------------------------------------------------------------ dialog
  dialog(title, body) {
    $('dialog-title').textContent = title; $('dialog-body').textContent = body;
    $('dialog').classList.remove('hidden'); this.dialogOpen = true;
    this.releaseMouse();
  }
  releaseMouse() { if (this.game.input.locked) { this.game.expectUnlock = true; this.game.input.unlock(); } }
  closeDialog() { $('dialog').classList.add('hidden'); this.dialogOpen = false; }

  // ------------------------------------------------------------------ panels
  get isOpen() { return !!this.panel || this.dialogOpen; }
  closePanel() {
    if (this.dialogOpen) { this.closeDialog(); return true; }
    if (!this.panel) return false;
    this.panel = null; this.el.panels.classList.add('hidden'); this.el.panels.innerHTML = '';
    this.game.onPanelClosed?.();
    return true;
  }
  open(name, opts = {}) {
    this.panel = name; this.opts = opts;
    this.el.panels.classList.remove('hidden');
    this.releaseMouse();
    this.render();
  }
  render() {
    if (!this.panel) return;
    const fn = { journal: this.renderJournal, map: this.renderMap, equip: this.renderEquip, research: this.renderResearch, trade: this.renderTrade, build: this.renderBuild, pause: this.renderPause }[this.panel];
    this.el.panels.innerHTML = '';
    const p = fn.call(this); this.el.panels.append(p);
  }
  head(title, hint = '', tabs = null, key = '') {
    const hd = h('header', {}, h('h2', {}, title));
    if (tabs) { const t = h('div', { class: 'tabs' }); tabs.forEach(([id, label]) => t.append(h('button', { class: 'tab' + ((this.tab[key] || tabs[0][0]) === id ? ' sel' : ''), onclick: () => { this.tab[key] = id; this.render(); } }, label))); hd.append(t); }
    hd.append(h('div', { class: 'spacer' }), h('div', { class: 'hint' }, hint), h('button', { class: 'btn', onclick: () => this.closePanel() }, 'Close'));
    return hd;
  }

  // ---------------- Journal
  renderJournal() {
    const j = this.game.journal, tab = this.tab.journal || 'db';
    const p = h('div', { class: 'panel' });
    const tp = j.totalProgress();
    p.append(this.head('Discovery Journal', `Anthelion lexicon: ${j.lexicon} · Documented ${Math.round(tp.got / tp.total * 100)}%`, [['db', 'Database'], ['links', 'Connections'], ['q', 'Questions']], 'journal'));
    const body = h('div', { class: 'body' }); p.append(body);
    if (tab === 'links') {
      const col = h('div', { class: 'col', style: 'flex:1' });
      const { LINKS } = this.game.data;
      const found = LINKS.filter((l) => j.links.has(l.id));
      col.append(h('div', { class: 'h3' }, `Connected discoveries (${found.length}/${LINKS.length})`));
      for (const l of found) col.append(h('div', { class: 'link-card' }, h('h4', {}, l.name), l.text));
      if (!found.length) col.append(h('div', { class: 'fact locked' }, 'No connections yet. Compare discoveries across worlds: shared patterns, tones and materials may point to something larger.'));
      body.append(col); return p;
    }
    if (tab === 'q') {
      const col = h('div', { class: 'col', style: 'flex:1' });
      col.append(h('div', { class: 'h3' }, 'Unanswered questions'));
      for (const q of j.openQuestions()) col.append(h('div', { class: 'q' + (q.answered ? ' done' : '') }, (q.answered ? '✓ ' : '? ') + q.text));
      body.append(col); return p;
    }
    // database
    const cats = h('div', { class: 'col', style: 'width:230px' });
    const selCat = this.sel.cat || CATEGORIES[0].id;
    for (const c of CATEGORIES) {
      if (c.id === 'questions') continue;
      const list = ENTRY_LIST.filter((e) => e.cat === c.id), got = list.filter((e) => j.hasEntry(e.id)).length;
      cats.append(h('div', { class: 'item' + (selCat === c.id ? ' sel' : ''), onclick: () => { this.sel.cat = c.id; this.sel.entry = null; this.render(); } }, h('span', {}, c.name), h('span', { class: 'n' }, `${got}/${list.length}`)));
    }
    cats.append(h('div', { class: 'h3' }, 'World survey'));
    for (const id of PLANET_ORDER) { const pr = j.planetProgress(id); cats.append(h('div', { class: 'n', style: 'font-size:12px;color:#9ab;margin-bottom:4px' }, PLANETS[id].name, h('div', { class: 'progress' }, h('div', { style: `width:${Math.round(pr.pct * 100)}%` })))); }
    const list = h('div', { class: 'col', style: 'width:290px' });
    const entries = ENTRY_LIST.filter((e) => e.cat === selCat);
    const selEntry = this.sel.entry && ENTRIES[this.sel.entry]?.cat === selCat ? this.sel.entry : null;
    for (const e of entries) {
      const known = j.hasEntry(e.id), seen = j.seen.has(e.id), pr = j.progress(e.id);
      list.append(h('div', { class: 'item' + (selEntry === e.id ? ' sel' : '') + (j.newFlags.has(e.id) ? ' new' : ''), onclick: () => { this.sel.entry = e.id; j.newFlags.delete(e.id); this.render(); } },
        h('span', {}, known ? e.name : seen ? '??? (seen)' : '???'), h('span', { class: 'n' }, known ? `${pr.got}/${pr.total}` : '')));
    }
    const det = h('div', { class: 'col', style: 'flex:1' });
    if (selEntry && (j.hasEntry(selEntry))) {
      const e = ENTRIES[selEntry];
      det.append(h('div', { class: 'entry-meta' }, `${CATEGORIES.find((c) => c.id === e.cat).name}${e.planet && e.planet !== 'all' ? ' · ' + (PLANETS[e.planet]?.name || e.planet) : ''}`), h('h3', { class: 'entry-title' }, e.name));
      det.append(h('div', { class: 'progress' }, h('div', { style: `width:${j.progress(e.id).got / j.progress(e.id).total * 100}%` })));
      for (const f of e.facts) {
        if (j.has(f.id)) det.append(h('div', { class: 'fact' }, h('span', { class: 'tag' }, f.how === 'obs' ? 'observed' : f.how === 'lab' ? 'lab' : f.how === 'log' ? 'record' : f.how === 'dig' ? 'excavated' : 'scan'), f.text));
        else det.append(h('div', { class: 'fact locked' }, h('span', { class: 'tag' }, 'unknown'), `Undiscovered — ${entryHowText(f)}.`));
      }
    } else det.append(h('div', { class: 'fact locked' }, selEntry ? 'Not yet discovered. Scan it in the field.' : 'Select an entry. Entries fill in progressively as you scan, observe, sample and research.'));
    body.append(cats, list, det);
    return p;
  }

  // ---------------- Map
  renderMap() {
    const g = this.game, p = h('div', { class: 'panel' });
    const space = g.mode === 'space';
    p.append(this.head(space ? 'System Chart' : `${g.planetDef?.name || ''} — Survey Map`, space ? 'Click a body to set a nav target' : 'Click a location to set a waypoint · scroll to zoom'));
    const wrap = h('div', { class: 'body', style: 'align-items:center;justify-content:center;padding:10px' });
    const cv = h('canvas', { class: 'map', width: 980, height: 560 }); wrap.append(cv); p.append(wrap);
    this.mapCanvas = cv; this.drawMap();
    cv.addEventListener('click', (e) => { const r = cv.getBoundingClientRect(); g.mapClick((e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height, this.mapState); this.drawMap(); });
    cv.addEventListener('wheel', (e) => { this.mapState.zoom = clamp(this.mapState.zoom * (e.deltaY < 0 ? 1.2 : 0.83), 0.3, 6); this.drawMap(); e.preventDefault(); }, { passive: false });
    return p;
  }
  drawMap() { if (this.mapCanvas && this.panel === 'map') this.game.drawMap(this.mapCanvas, this.mapState); }

  // ---------------- Equipment
  renderEquip() {
    const g = this.game, inv = g.inventory, p = h('div', { class: 'panel' });
    const can = g.canCraft();
    p.append(this.head('Equipment & Cargo', can ? 'Workshop available' : 'Upgrades require the ship or a research station', [['suit', 'Suit'], ['ship', 'Ship'], ['cargo', 'Cargo']], 'equip'));
    const tab = this.tab.equip || 'suit';
    const body = h('div', { class: 'body' }); p.append(body);
    const col = h('div', { class: 'col', style: 'flex:1' }); body.append(col);
    if (tab === 'cargo') {
      col.append(h('div', { class: 'h3' }, `Cargo ${inv.used}/${inv.capacity}`));
      for (const [r, n] of Object.entries(inv.res)) col.append(h('div', { class: 'item', style: 'cursor:default' }, h('span', { html: `<span style="color:#${RES_COLORS[r].toString(16).padStart(6, '0')}">◆</span> ${RES_NAMES[r]}` }), h('span', { class: 'n' }, n)));
      if (!Object.keys(inv.res).length) col.append(h('div', { class: 'fact locked' }, 'Cargo hold is empty. Use the Mining Laser (2) on mineral deposits.'));
      col.append(h('div', { class: 'h3' }, `Samples held (${inv.samples.size})`));
      for (const s of inv.samples) col.append(h('div', { class: 'q' }, '• ' + (ENTRIES[s]?.name || s)));
      return p;
    }
    const kind = tab === 'ship' ? 'ship' : 'equip';
    for (const grp of UPGRADES.filter((u) => u.kind === kind)) {
      const cur = grp.levels[inv.owned[grp.id]], nx = inv.nextLevel(grp.id);
      const card = h('div', { class: 'up' }, h('div', { class: 'nm' }, h('span', {}, `${grp.name}: ${cur.name}`), nx ? h('button', { class: 'btn' + (inv.canBuy(grp.id).ok && can ? ' primary' : ' dis'), onclick: () => { g.buyUpgrade(grp.id); this.render(); } }, 'Craft') : h('span', { class: 'n' }, 'MAX')));
      if (nx) {
        card.append(h('div', { class: 'ds' }, `Next: ${nx.level.name} — ${nx.level.desc}`));
        card.append(h('div', { class: 'cost', html: costHtml(nx.level.cost, inv) }));
        if (nx.level.req && !inv.reqMet(nx.level.req)) card.append(h('div', { class: 'ds', style: 'color:#ff9a4a' }, inv.reqText(nx.level.req)));
      } else card.append(h('div', { class: 'ds' }, cur.desc));
      col.append(card);
    }
    return p;
  }

  // ---------------- Research
  renderResearch() {
    const g = this.game, inv = g.inventory, j = g.journal, p = h('div', { class: 'panel' });
    p.append(this.head('Research Station', 'Analyse samples to reveal laboratory findings'));
    const body = h('div', { class: 'body' }); p.append(body);
    const col = h('div', { class: 'col', style: 'flex:1.3' }), col2 = h('div', { class: 'col', style: 'flex:1' });
    col.append(h('div', { class: 'h3' }, 'Samples'));
    const mins = Object.keys(inv.res).filter((r) => ENTRIES[r]);
    const all = new Set([...inv.samples, ...mins]);
    let any = false;
    for (const id of all) {
      const e = ENTRIES[id]; if (!e) continue;
      const f = e.facts.find((x) => x.how === 'lab'); if (!f) continue;
      const done = j.has(f.id); any = true;
      col.append(h('div', { class: 'up' }, h('div', { class: 'nm' }, h('span', {}, e.name), done ? h('span', { class: 'n' }, 'Analysed') : h('button', { class: 'btn primary', onclick: () => { g.analyse(id); this.render(); } }, 'Analyse')), h('div', { class: 'ds' }, done ? f.text : 'Unanalysed')));
    }
    if (!any) col.append(h('div', { class: 'fact locked' }, 'No samples. Press R while scanning an organism, plant or deposit to collect a sample; mined minerals count automatically.'));
    col2.append(h('div', { class: 'h3' }, 'Workshop'));
    const mk = (title, desc, cost, fn, ok) => col2.append(h('div', { class: 'up' }, h('div', { class: 'nm' }, h('span', {}, title), h('button', { class: 'btn' + (ok ? ' primary' : ' dis'), onclick: () => { fn(); this.render(); } }, 'Make')), h('div', { class: 'ds' }, desc), h('div', { class: 'cost', html: costHtml(cost, inv) })));
    mk('Refine Fuel', '+30 fuel', { deuterium_ice: 2 }, () => g.refine(), inv.has({ deuterium_ice: 2 }));
    mk('Hull Patch', '+25 hull integrity', { ferrolith: 3 }, () => g.repairHull(), inv.has({ ferrolith: 3 }));
    col2.append(h('div', { class: 'h3' }, 'Suit'));
    col2.append(h('button', { class: 'btn primary', onclick: () => { g.vitals.refill(true); this.toast('Suit restored', 'good'); } }, 'Restore suit'));
    body.append(col, col2);
    return p;
  }

  // ---------------- Trade (Orrin)
  renderTrade() {
    const g = this.game, inv = g.inventory, p = h('div', { class: 'panel' });
    p.append(this.head('Tessera Market — The Orrin', 'Comm link open'));
    const body = h('div', { class: 'body' }); p.append(body);
    const col = h('div', { class: 'col', style: 'flex:1' }), col2 = h('div', { class: 'col', style: 'flex:1' });
    col.append(h('div', { class: 'h3' }, 'Conversation'), h('div', { class: 'fact' }, this.sel.orrin || ORRIN.greeting));
    for (const t of ORRIN.topics) col.append(h('div', { class: 'item', onclick: () => { this.sel.orrin = t.text; g.orrinTopic(t); this.render(); } }, t.label));
    col2.append(h('div', { class: 'h3' }, 'Trades'));
    for (const o of ORRIN.offers) {
      const ok = inv.has(o.give);
      col2.append(h('div', { class: 'up' }, h('div', { class: 'nm' }, h('span', {}, o.label), h('button', { class: 'btn' + (ok ? ' primary' : ' dis'), onclick: () => { g.trade(o); this.render(); } }, 'Trade')), h('div', { class: 'cost', html: costHtml(o.give, inv) })));
    }
    body.append(col, col2);
    return p;
  }

  // ---------------- Build
  renderBuild() {
    const g = this.game, inv = g.inventory, p = h('div', { class: 'panel' });
    p.append(this.head('Outpost Modules', 'Select a module, then place it with left-click'));
    const col = h('div', { class: 'col', style: 'flex:1' });
    for (const o of OUTPOSTS) {
      const ok = inv.has(o.cost);
      col.append(h('div', { class: 'up' }, h('div', { class: 'nm' }, h('span', {}, o.name), h('button', { class: 'btn' + (ok ? ' primary' : ' dis'), onclick: () => { this.closePanel(); g.startBuild(o.id); } }, 'Place')), h('div', { class: 'ds' }, o.desc), h('div', { class: 'cost', html: costHtml(o.cost, inv) })));
    }
    p.append(h('div', { class: 'body' }, col));
    return p;
  }

  // ---------------- Pause
  renderPause() {
    const g = this.game, S = Settings.values, p = h('div', { class: 'panel', style: 'height:auto;max-height:90vh' });
    p.append(this.head('Paused', 'Esc to resume'));
    const body = h('div', { class: 'body' }); p.append(body);
    const l = h('div', { class: 'col', style: 'flex:1' }), r = h('div', { class: 'col', style: 'flex:1' });
    const slider = (label, key, min, max, step, fmt = (v) => v) => {
      const val = h('span', { class: 'n' }, fmt(S[key]));
      return h('div', { class: 'setrow' }, h('span', {}, label), h('span', {}, h('input', { type: 'range', min, max, step, value: S[key], oninput: (e) => { S[key] = +e.target.value; val.textContent = fmt(S[key]); Settings.save(); g.applySettings(); } }), ' ', val));
    };
    l.append(h('div', { class: 'h3' }, 'Game'));
    for (const [label, fn, primary] of [['Resume', () => this.closePanel(), true], ['Save game', () => { g.save(true); }], ['Quit to menu', () => { g.quitToMenu(); }]])
      l.append(h('div', { style: 'margin-bottom:8px' }, h('button', { class: 'btn' + (primary ? ' primary' : ''), style: 'width:220px', onclick: fn }, label)));
    l.append(h('div', { class: 'h3' }, 'Settings'),
      h('div', { class: 'setrow' }, h('span', {}, 'Graphics'), h('select', { onchange: (e) => { S.quality = e.target.value; Settings.save(); g.toast('Quality applies on next planet landing / reload'); } }, ...['low', 'medium', 'high'].map((q) => h('option', { value: q, selected: S.quality === q ? 'selected' : null }, q)))),
      slider('Volume', 'volume', 0, 1, 0.05, (v) => Math.round(v * 100) + '%'), slider('Music', 'music', 0, 1, 0.05, (v) => Math.round(v * 100) + '%'),
      slider('Mouse sensitivity', 'sensitivity', 0.2, 3, 0.1, (v) => (+v).toFixed(1)), slider('Field of view', 'fov', 60, 100, 1),
      h('div', { class: 'setrow' }, h('span', {}, 'Invert Y'), h('input', { type: 'checkbox', checked: S.invertY ? 'checked' : null, onchange: (e) => { S.invertY = e.target.checked; Settings.save(); } })));
    const keys = [['WASD', 'Move / thrust'], ['Mouse', 'Look / steer'], ['Shift', 'Sprint / boost'], ['Space', 'Jump · jetpack / ship up'], ['Ctrl', 'Ship down / swim down'], ['1-4', 'Tools'], ['LMB', 'Use tool (hold to scan / mine)'],
      ['R', 'Take sample'], ['E', 'Interact / board / read'], ['F', 'Flashlight'], ['J', 'Journal'], ['M', 'Map'], ['I', 'Equipment'], ['B', 'Build outpost'], ['Q / E', 'Ship roll'], ['Z', 'Flight assist'], ['V', 'Cruise drive (space)'], ['G', 'Align to nav target'], ['N', 'Cycle nav target'], ['Tab', 'Exit / enter ship']];
    r.append(h('div', { class: 'h3' }, 'Controls'), h('table', { class: 'keys' }, ...keys.map(([k, v]) => h('tr', {}, h('td', { class: 'kbd' }, k), h('td', {}, v)))));
    body.append(l, r);
    return p;
  }

  // ------------------------------------------------------------------ menu
  buildMenu(hasSave, handlers) {
    const mb = $('menu-buttons'); mb.innerHTML = '';
    if (hasSave) mb.append(h('button', { class: 'btn primary', onclick: handlers.continue }, 'Continue'));
    mb.append(h('button', { class: 'btn' + (hasSave ? '' : ' primary'), onclick: handlers.newGame }, 'New game'));
    $('menu-note').innerHTML = 'Click inside the game to capture the mouse. Press <b>Esc</b> to pause.<br>Best experienced with headphones. Progress is saved locally in your browser.';
  }
  showMenu(on) { this.el.menu.classList.toggle('hidden', !on); }
  loading(text) { const l = $('loading'); if (text) { $('loading-text').textContent = text; l.classList.remove('hidden'); } else l.classList.add('hidden'); }
}
