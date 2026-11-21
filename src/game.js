import * as THREE from 'three';
import { Input } from './core/input.js';
import { EventBus } from './core/events.js';
import { Save, Settings, QUALITY } from './core/save.js';
import { clamp, lerp, smoothstep, fmtDist, TAU, wrapAngle } from './core/util.js';
import { PLANETS, PLANET_ORDER, SYSTEM } from './data/planets.js';
import { ENTRIES } from './data/codex.js';
import { LINKS, SITES, QUESTIONS } from './data/lore.js';
import { RES_NAMES, UPGRADES, OUTPOSTS } from './data/upgrades.js';
import { Journal } from './systems/journal.js';
import { Inventory } from './systems/inventory.js';
import { Vitals } from './systems/survival.js';
import { Scanner } from './systems/scanner.js';
import { Outposts } from './systems/outposts.js';
import { AudioSystem } from './systems/audio.js';
import { PlanetWorld } from './world/planet.js';
import { SpaceWorld } from './world/space.js';
import { surfaceToSpace, spaceToSurface, landingZoneDir } from './world/frames.js';
import { Player } from './entities/player.js';
import { Ship, SHIP_CLEARANCE } from './entities/ship.js';
import { UI } from './ui/ui.js';

const FWD = new THREE.Vector3(0, 0, -1);
const TAKEOFF_ALT = 2000, LAND_ALT = 1800;
const ENDING_TEXT = `The Core finishes its message, and begins again.

The Anthelion did not vanish. They listened for so long that they became the listening: their song lives in the crystal, in the birds of Vesper, in the singers of the deep. Every structure you found was an ear turned toward the dark.

Now the Core waits for an answer. Beyond the ring, along the bearing carved into its chart, there is a door in the sky.

The universe is waiting to be understood.

— The survey continues. You are free to keep exploring. —`;

export class Game {
  constructor(canvas) {
    window._game = this; //dev hacks
    this.canvas = canvas;
    this.settings = Settings.load();
    this.quality = QUALITY[this.settings.quality] || QUALITY.medium;
    this.events = new EventBus();
    this.input = new Input(canvas);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: this.settings.quality !== 'low', powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, this.quality.pixelRatio));
    this.renderer.setSize(innerWidth, innerHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = this.quality.shadow; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.camera = new THREE.PerspectiveCamera(this.settings.fov, innerWidth / innerHeight, 0.1, 3800);
    this.camera.rotation.order = 'YXZ';
    this.ui = new UI(this);
    this.audio = new AudioSystem(this.settings);
    this.journal = new Journal(this.events);
    this.inventory = new Inventory(this.events, this.journal);
    this.vitals = new Vitals(this);
    this.scanner = new Scanner(this);
    this.outposts = new Outposts(this);
    this.player = new Player(this);
    this.ship = new Ship(this);
    this.space = null; this.world = null;
    this.data = { LINKS };
    this.mode = 'menu'; this.piloting = false; this.playing = false;
    this.planetId = 'khepri'; this.planetDef = PLANETS.khepri;
    this.tool = 0; this.flash = false; this.time = 0; this.playTime = 0; this.autosaveT = 60;
    this.discovered = new Set(['k_pad', 'v_pad', 'n_pad', 'p_pad']); this.revealed = new Set(); this.knownSpace = new Set(['khepri', 'vesper', 'nivalis', 'pelagos', 'calloway', 'tessera']);
    this.depleted = {}; this.digsDone = new Set(); this.planetTimes = {};
    this.waypoint = null; this.navId = null; this.pending = null; this.shake = 0; this.mining = null; this.digging = null; this.ending = false;
    this._dir = new THREE.Vector3(); this._o = new THREE.Vector3(); this._tmp = new THREE.Vector3();
    this.beam = null; this.spot = null;
    this.setupEvents();
    this.setupInput();
    addEventListener('resize', () => this.resize());
  }

  get stats() { return this.inventory.stats; }
  toast(m, k, s) { this.ui.toast(m, k, s); }

  resize() {
    this.renderer.setSize(innerWidth, innerHeight, false);
    this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix();
  }
  applySettings() {
    this.audio.setVolume(this.settings.volume); this.audio.setMusic(this.settings.music);
    this.camera.fov = this.settings.fov; this.camera.updateProjectionMatrix();
  }

  // ------------------------------------------------------------------ events
  setupEvents() {
    const E = this.events, A = this.audio;
    E.on('player:damage', ({ amount, kind }) => this.vitals.damage(amount, kind));
    E.on('player:hurt', () => { A.hurt(); this.shake = Math.min(1, this.shake + 0.4); });
    E.on('ship:damage', ({ amount }) => { this.ship.damage(amount); A.hurt(); this.shake = Math.min(1.2, this.shake + amount / 25); });
    E.on('ship:hit', () => { if (this.ship.hull <= 0) this.shipDestroyed(); else if (this.ship.hull < 30) this.toast('Hull critical', 'bad'); });
    E.on('player:died', () => this.playerDied());
    E.on('player:step', ({ sprint }) => A.footstep(sprint));
    E.on('player:jump', () => A.jump());
    E.on('player:land', ({ speed }) => A.land(speed));
    E.on('creature:call', ({ sp, x, y, z }) => A.creature(sp, x, z, y));
    E.on('weather:thunder', () => A.thunder());
    E.on('raider:fire', () => A.fire());
    E.on('ship:landed', ({ water }) => { this.toast(water ? 'Landed on water' : 'Landed', ''); this.autosave(); });
    E.on('ship:liftoff', () => this.toast('Lift-off'));
    E.on('ship:cruise', (on) => this.toast(on ? 'Cruise drive engaged' : 'Cruise drive disengaged'));
    E.on('ship:align-done', (ok) => { if (ok) this.toast('Aligned with nav target'); });
    E.on('outpost:built', ({ def }) => { A.build(); this.toast(`${def.name} constructed`, 'good'); });
    E.on('upgrade:bought', ({ level }) => { A.build(); this.toast(`Crafted: ${level.name}`, 'good'); this.applyStatsToShip(); });
    E.on('inventory:sample', ({ entry }) => this.toast(`Sample collected: ${this.journal.hasEntry(entry) ? ENTRIES[entry].name : 'unidentified'}`, 'good'));
    E.on('journal:fact', ({ fact, entry, newEntry }) => {
      if (newEntry) { A.discover(); this.ui.banner(entry.name, `New discovery · ${entry.cat === 'species' ? 'species' : entry.cat}`); }
      const lab = { scan: 'Scan', obs: 'Observation', lab: 'Lab result', log: 'Record', dig: 'Excavation', orbit: 'Orbital survey', land: 'Surface survey', link: 'Survey' }[fact.how] || 'Finding';
      this.toast(`${entry.name} — ${lab}`, 'good', fact.text.length > 110 ? fact.text.slice(0, 108) + '…' : fact.text);
      if (fact.w) this.toast('Anthelion lexicon expanded', 'link', `Words known: ${this.journal.lexicon}`);
    });
    E.on('journal:link', ({ link }) => {
      A.link(); this.toast(`Connection: ${link.name}`, 'link', link.text.slice(0, 140) + (link.text.length > 140 ? '…' : ''));
      for (const id of link.reveal || []) { this.revealed.add(id); this.toast('A new location has been charted', 'link'); }
      if (link.id === 'triad') this.knownSpace.add('orbital_ring');
    });
    E.on('scan:complete', ({ target, facts }) => {
      if (target.entry === 'echo_core' && this.journal.has('echo_core:ask') && !this.ending) this.ending = true, setTimeout(() => { this.autosave(); this.ui.dialog('THE ECHO CORE', ENDING_TEXT); }, 2500);
      if (target.kind === 'structure' && target.body?.id === 'orbital_ring') this.knownSpace.add('orbital_ring');
    });
  }

  applyStatsToShip() {
    const s = this.stats;
    this.ship.fuel = Math.min(this.ship.fuel, s.fuelMax); this.ship.hull = Math.min(this.ship.hull, s.hullMax);
  }

  // ------------------------------------------------------------------ input
  setupInput() {
    const inp = this.input;
    this.canvas.addEventListener('click', () => {
      this.audio.init();
      if (this.playing && !this.ui.isOpen && !inp.locked) inp.lock();
    });
    inp.onLockChange = (locked) => {
      if (!locked && this.playing && !this.ui.isOpen && !this.expectUnlock && !this.pending) { this.ui.open('pause'); }
      this.expectUnlock = false;
    };
    addEventListener('keydown', (e) => {
      if (!this.playing) return;
      if (e.code === 'Escape') {
        if (this.ui.isOpen) { this.ui.closePanel(); e.preventDefault(); }
        return;
      }
      if (e.repeat) return;
      const panels = { KeyJ: 'journal', KeyM: 'map', KeyI: 'equip' };
      if (panels[e.code] && !this.ui.dialogOpen) {
        if (this.ui.panel === panels[e.code]) { this.ui.closePanel(); return; }
        if (!this.ui.isOpen) { this.ui.open(panels[e.code]); }
        else this.ui.open(panels[e.code]);
        e.preventDefault();
      }
    });
  }

  onPanelClosed() { if (this.playing) this.input.lock(); }

  // ------------------------------------------------------------------ lifecycle
  async startNew() {
    await Save.clear();
    this.resetState();
    this.ui.showMenu(false); this.ui.loading('Landing on Khepri');
    await new Promise((r) => setTimeout(r, 50));
    this.audio.init();
    this.enterSurface('khepri', { fresh: true });
    this.beginPlay();
    this.ui.banner('KHEPRI', 'Arid canyon world · Survey Station Kestrel-7 has gone silent');
    setTimeout(() => this.toast('Press 1 for the scanner, then hold left mouse on anything unfamiliar', '', 'Move: WASD · Sprint: Shift · Jetpack: hold Space'), 1500);
    setTimeout(() => this.toast('Your journal (J) records what you learn', ''), 7500);
  }

  async continueGame() {
    const d = await Save.load();
    if (!d) return this.startNew();
    this.resetState();
    this.ui.showMenu(false); this.ui.loading('Restoring survey');
    await new Promise((r) => setTimeout(r, 50));
    this.audio.init();
    this.restore(d);
    this.beginPlay();
    this.toast('Survey restored', 'good');
  }

  resetState() {
    this.journal.restore({}); this.inventory.restore({}); this.inventory.owned = Object.fromEntries(UPGRADES.map((u) => [u.id, 0])); this.inventory.recompute();
    this.vitals = new Vitals(this); this.outposts.restore([]);
    this.discovered = new Set(['k_pad', 'v_pad', 'n_pad', 'p_pad']); this.revealed = new Set(); this.knownSpace = new Set(['khepri', 'vesper', 'nivalis', 'pelagos', 'calloway', 'tessera']);
    this.depleted = {}; this.digsDone = new Set(); this.planetTimes = {}; this.waypoint = null; this.navId = null; this.ending = false;
    this.ship.fuel = this.stats.fuelMax; this.ship.hull = this.stats.hullMax; this.ship.cruising = false; this.ship.vel.set(0, 0, 0);
    this.vitals.refill(true);
    if (this.world) { this.world.dispose(); this.world = null; }
  }

  beginPlay() {
    this.playing = true; this.ui.loading(null); this.ui.show(true);
    this.applySettings(); this.audio.boot();
    this.lastT = performance.now();
    if (!this._started) { this._started = true; requestAnimationFrame((t) => this.frame(t)); }
  }

  quitToMenu() {
    this.save(false);
    this.ui.closePanel(); this.playing = false; this.input.unlock();
    this.ui.show(false); this.ui.showMenu(true);
    this.setMenu();
  }
  async setMenu() { this.ui.buildMenu(await Save.exists(), { continue: () => this.continueGame(), newGame: () => this.startNew() }); }

  // ------------------------------------------------------------------ transitions
  enterSurface(planetId, opts = {}) {
    // dispose of the previous planet world
    if (this.world) { this.world.dispose(); this.outposts.detach(); }
    this.mode = 'surface'; this.planetId = planetId; this.planetDef = PLANETS[planetId];
    const w = this.world = new PlanetWorld(this, planetId);
    w.scene.add(this.camera); w.scene.add(this.ship.mesh);
    this.outposts.attach(w.scene, planetId); this.outposts.materialise(planetId, w.hf);
    if (this.planetTimes[planetId]) w.atmos.restore(this.planetTimes[planetId]);
    for (const id of this.depleted[planetId] || []) w.flora.depleted.add(id);
    for (const dg of w.structures.digs) if (this.digsDone.has(dg.id)) { dg.done = true; dg.mound.visible = false; dg.ping.visible = false; }
    if (this.journal.hasFlag('vault_open')) w.structures.setVaultOpen(true);
    this.attachFlash();
    this.beam = this.makeBeam(); w.scene.add(this.beam);
    const ship = this.ship;
    ship.frame = 'surface';
    if (opts.fresh) {
      const pad = w.pad;
      ship.pos.set(pad.x, pad.y + SHIP_CLEARANCE, pad.z + 2); ship.quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0); ship.vel.set(0, 0, 0); ship.landed = true;
      this.piloting = false;
      this.player.pos.set(pad.x + 9, pad.y, pad.z + 6); this.player.yaw = Math.PI * 0.75; this.player.pitch = 0; this.player.vel.set(0, 0, 0);
    } else if (opts.fromSpace) {
      const c = opts.fromSpace;
      const gh = w.hf.heightAt(c.x, c.z);
      ship.pos.set(c.x, gh + c.alt, c.z); ship.quat.copy(c.quat); ship.vel.copy(c.vel); ship.landed = false; ship.cruising = false;
      if (ship.vel.length() > 160 * this.stats.shipSpeed) ship.vel.setLength(160 * this.stats.shipSpeed);
      this.piloting = true;
    }
    this.focusPoint(this._o);
    w.prime(this._o.x, this._o.z);
    this.journal.reveal(`${planetId}:atmos`, false);
    this.ui.banner(this.planetDef.name.toUpperCase(), this.planetDef.tagline);
    this.audio.setEnv({ planet: planetId, space: false });
    this.updateCameraSurface();
  }

  focusPoint(out) { if (this.piloting) out.copy(this.ship.pos); else out.copy(this.player.pos); return out; }

  makeBeam() {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 6), new THREE.MeshBasicMaterial({ color: 0xff6a3a, transparent: true, opacity: 0.9, fog: false }));
    m.visible = false; m.frustumCulled = false; return m;
  }
  attachFlash() {
    if (!this.spot) {
      this.spot = new THREE.SpotLight(0xfff4e0, 0, 70, 0.5, 0.6, 1.3); this.spot.position.set(0.15, -0.1, 0); this.spot.target.position.set(0, 0, -5);
      this.camera.add(this.spot, this.spot.target);
    }
  }

  enterSpace(fromPlanet, c) {
    this.mode = 'space'; this.piloting = true;
    if (!this.space) this.space = new SpaceWorld(this);
    if (this.world) { this.planetTimes[this.planetId] = this.world.atmos.serialize(); this.depleted[this.planetId] = [...this.world.flora.depleted]; this.world.dispose(); this.world = null; this.outposts.detach(); }
    const sp = this.space;
    sp.scene.add(this.camera); this.ship.frame = 'space';
    if (c) { this.ship.pos.copy(c.pos); this.ship.quat.copy(c.quat); this.ship.vel.copy(c.vel); }
    this.ship.landed = false;
    this.audio.setEnv({ space: true });
    this.camera.position.set(0, 0, 0);
    this.ui.banner('ORBIT', `${PLANETS[fromPlanet]?.name || ''} · deep space`);
    this.toast('Cruise drive: V · Align to target: G · Cycle targets: N', '');
  }

  // fade out, run fn at full fade, fade in
  transition(fn, color = '#fff', ms = 600) {
    if (this.pending) return;
    this.ui.fade(1, color, ms);
    this.pending = { t: ms / 1000 + 0.05, fn };
  }

  toSpace() {
    const s = this.ship, hf = this.world.hf;
    const gh = hf.heightAt(s.pos.x, s.pos.z);
    this.transition(() => {
      const c = surfaceToSpace(this.planetId, s.pos.x, s.pos.y, s.pos.z, gh, s.quat, s.vel);
      c.pos.addScaledVector(c.pos.clone().sub(new THREE.Vector3(...PLANETS[this.planetId].orbitPos)).normalize(), 0);
      const from = this.planetId;
      this.enterSpace(from, c);
    });
  }

  toSurface(body) {
    const s = this.ship;
    this.transition(() => {
      const c = spaceToSurface(body.id, s.pos, s.quat, s.vel);
      this.enterSurface(body.id, { fromSpace: { x: c.x, z: c.z, alt: Math.max(LAND_ALT - 100, Math.min(c.alt, LAND_ALT)), quat: c.quat, vel: c.vel } });
    });
  }

  // ------------------------------------------------------------------ main loop
  frame(now) {
    requestAnimationFrame((t) => this.frame(t));
    let dt = Math.min(0.05, (now - this.lastT) / 1000); this.lastT = now;
    if (!this.playing) { this.input.endFrame(); return; }
    try {
      this.step(dt);
      this.render();
    } catch (e) {
      console.error(e);
      const f = document.getElementById('fatal'); f.classList.remove('hidden'); f.textContent = 'Runtime error:\n' + (e.stack || e);
      this.playing = false;
    }
    this.input.endFrame();
  }

  step(dt) {
    const inp = this.input;
    if (this.pending) {
      this.pending.t -= dt;
      if (this.pending.t <= 0) { const fn = this.pending.fn; this.pending = null; fn(); this.ui.fade(0, '#fff', 800); }
    }
    if (this.ui.isOpen) return;
    if (inp.pressed('Escape')) { this.ui.open('pause'); return; }
    this.time += dt; this.playTime += dt;
    this.autosaveT -= dt; if (this.autosaveT <= 0) { this.autosaveT = 90; this.autosave(); }
    this.shake = Math.max(0, this.shake - dt * 2);
    if (this.mode === 'surface') this.stepSurface(dt); else if (this.mode === 'space') this.stepSpace(dt);
    this.audio.update(dt);
    this.ui.hurt(this.vitals.hurtFlash * 0.9 + (this.piloting && this.ship.hull < 25 ? 0.15 * (0.5 + 0.5 * Math.sin(this.time * 6)) : 0));
  }

  // ------------------------------------------------------------------ surface
  stepSurface(dt) {
    const w = this.world, inp = this.input, p = this.player, ship = this.ship, hf = w.hf;
    const gravity = this.planetDef.g;
    const canAct = this.input.locked && !this.pending;
    const piloting = this.piloting;

    // ---- boarding / exiting
    if (inp.pressed('Tab')) {
      if (piloting) { if (ship.landed) this.exitShip(); else this.toast('Land before leaving the cockpit', 'warn'); }
      else if (this.nearShip(9)) this.boardShip();
    }

    const focus = this._o; this.focusPoint(focus);
    const ctxSurface = { camPos: this.camera.position, focus, inShip: this.piloting, hostile: true, loud: p.sprinting || p.jetting, timeScale: 1 };
    w.update(dt, ctxSurface);
    this.outposts.update(dt, this.planetId, hf);

    if (this.piloting) {
      const env = { gravity, hf, groundH: (x, z) => hf.heightAt(x, z), groundNormal: (x, z) => hf.normalAt(x, z), waterLevel: hf.waterLevel, waterSurface: w.water ? (x, z) => w.water.surfaceAt(x, z) : null, autoLevel: true };
      ship.update(dt, inp, env);
      const alt = ship.pos.y - hf.heightAt(ship.pos.x, ship.pos.z);
      w.atmos.setSpace(smoothstep(900, TAKEOFF_ALT, alt));
      if (alt > TAKEOFF_ALT && !this.pending) this.toSpace();
      this.updateCameraSurface();
      this.shipScanSurface(dt);
      this.updateShipHudSurface(alt);
      this.audio.setEnv({ inShip: true, thrust: ship.thrustLevel, cruise: false, underwater: false, planet: this.planetId });
    } else {
      p.update(dt, inp, { gravity, hf, pushOut: (x, z) => w.pushOut(x, z) }, canAct);
      this.updateCameraSurface();
      this.footTools(dt, canAct);
      this.ui.hideShipHud();
      this.audio.setEnv({ inShip: false, thrust: 0, cruise: false, underwater: p.underwater, planet: this.planetId });
    }
    // ship follows its physics when it is landed/parked; mesh visible only when we are outside
    ship.mesh.visible = !this.piloting;
    ship.mesh.position.copy(ship.pos); ship.mesh.quaternion.copy(ship.quat);
    if (!this.piloting && ship.landed) { ship.pos.y += (hf.heightAt(ship.pos.x, ship.pos.z) + SHIP_CLEARANCE - ship.pos.y) * 0.1; }

    // ---- vitals & environment
    const fp = this.piloting ? ship.pos : p.pos;
    const safe = this.isSafeZone(fp.x, fp.z);
    const atm = w.atmos;
    this.vitals.update(dt, {
      planet: this.planetDef, ambientTemp: atm.ambientTemp(), rad: hf.radiationAt(fp.x, fp.z), weather: atm.weather, underwater: !this.piloting && p.underwater, depth: this.piloting ? 0 : p.depth,
      sheltered: w.sheltered(fp.x, fp.z), safe, inShip: this.piloting, dayFactor: atm.dayFactor, outdoors: !w.sheltered(fp.x, fp.z), sprinting: p.sprinting,
    });
    // underwater look
    const under = w.water && this.camera.position.y < hf.waterLevel;
    this.ui.underwater(!!under);
    if (under) { const sc = w.scene; sc.fog.color.set(0x0c3a52).multiplyScalar(0.35 + 0.65 * atm.dayFactor); sc.fog.density = 0.028; }
    this.audio.setEnv({ wind: atm.windSpeed, storm: atm.storm, day: atm.dayFactor, rad: hf.radiationAt(fp.x, fp.z) * (1 - this.stats.radShield) });
    this.audio.setListener(this.camera.position.x, this.camera.position.z, this.piloting ? 0 : p.yaw);
    this.surfaceInteractions(dt);
    this.updateHudSurface();
    this.updateSiteDiscovery(fp);
  }

  nearShip(r) { return !this.piloting && this.ship.landed && this.ship.pos.distanceTo(this.player.pos) < r + 2; }
  isSafeZone(x, z) {
    const s = this.ship;
    if (s.landed && Math.hypot(x - s.pos.x, z - s.pos.z) < 8) return true;
    const lab = this.outposts.nearest(this.planetId, x, z, 'lab', 8) || this.outposts.nearest(this.planetId, x, z, 'monitor', 6);
    if (lab) return true;
    const st = this.world?.hf.sites.find((q) => q.type === 'station');
    return !!(st && Math.hypot(x - st.x, z - st.z) < 12);
  }
  interactTarget() { return this.nearShip(9) ? 'ship' : null; }

  boardShip() { this.piloting = true; this.input.mouse.dx = 0; this.input.mouse.dy = 0; this.audio.click(); this.toast('Cockpit: WASD thrust · Space/Ctrl up/down · mouse steer · Tab exit', ''); this.camera.add(this.ship.cockpit); this.scanner.target = null; this.mining = null; this.beam.visible = false; }
  exitShip() {
    this.piloting = false; this.camera.remove(this.ship.cockpit);
    const s = this.ship, p = this.player;
    const side = new THREE.Vector3(1, 0, 0).applyQuaternion(s.quat); side.y = 0; side.normalize();
    p.pos.set(s.pos.x + side.x * 5, 0, s.pos.z + side.z * 5); p.pos.y = this.world.hf.heightAt(p.pos.x, p.pos.z);
    const f = FWD.clone().applyQuaternion(s.quat); p.yaw = Math.atan2(-f.x, -f.z); p.pitch = 0; p.vel.set(0, 0, 0);
  }

  updateCameraSurface() {
    const cam = this.camera;
    if (this.piloting) {
      const off = new THREE.Vector3(0, 0.55, -1.2).applyQuaternion(this.ship.quat);
      cam.position.copy(this.ship.pos).add(off); cam.quaternion.copy(this.ship.quat);
      if (!this.ship.cockpit.parent) cam.add(this.ship.cockpit);
    } else {
      this.player.eyePos(cam.position); cam.rotation.set(this.player.pitch, this.player.yaw, 0, 'YXZ');
      if (this.ship.cockpit.parent) cam.remove(this.ship.cockpit);
    }
    if (this.shake > 0) { cam.position.x += (Math.random() - 0.5) * this.shake * 0.08; cam.position.y += (Math.random() - 0.5) * this.shake * 0.08; }
  }

  // ---------------- foot tools
  toolList() {
    return [{ name: 'Scanner' }, { name: 'Mining' }, { name: 'Excavator', off: this.stats.excavator < 1 }, { name: this.outposts.placing ? 'Build (click)' : 'Outpost', off: false }];
  }
  footTools(dt, canAct) {
    const inp = this.input, cam = this.camera, w = this.world, p = this.player;
    for (let i = 0; i < 4; i++) if (inp.pressed('Digit' + (i + 1))) { if (i === 3) { this.ui.open('build'); } else if (i === 2 && this.stats.excavator < 1) this.toast('Excavator not built. Craft it at your ship (I).', 'warn'); else this.tool = i; if (i !== 3) { this.outposts.cancelPlacing(); } }
    if (inp.pressed('KeyF')) { this.flash = !this.flash; this.audio.click(); }
    this.spot.intensity = this.flash ? 3 : 0;
    if (inp.pressed('KeyB')) { this.ui.open('build'); }
    this.ui.setTools(this.toolList(), this.outposts.placing ? 3 : this.tool);

    const dir = this._dir.set(0, 0, -1).applyQuaternion(cam.quaternion);
    const origin = cam.position;
    const hold = canAct && inp.mouseDown(0);
    let scanning = false, mining = false;
    this.beam.visible = false;

    if (this.outposts.placing) {
      this.outposts.updateGhost(p, w.hf, p.yaw);
      if (canAct && inp.mouseClicked(0)) this.outposts.place();
      if (inp.pressed('KeyX') || inp.mouseClicked(2)) this.outposts.cancelPlacing();
      this.ui.setScan(null);
      this.ui.prompt(`<b>LMB</b> place · <b>X</b> cancel · ${this.outposts.ghostOK ? 'site OK' : 'unsuitable ground'}`);
      this.audio.scanLoop(false); this.audio.mineLoop(false); return;
    }
    const range = this.stats.scanRange + this.outposts.scanBonus(this.planetId, p.pos.x, p.pos.z);
    if (this.tool === 0) {
      const targets = w.scanTargets(p.pos.x, p.pos.z, range + 5);
      const st = this.scanner.update(dt, hold && this.vitals.hasEnergy(1), origin, dir, targets, range, this.stats.scanTier, 'foot');
      this.ui.setScan(st, st.target ? '' : '');
      scanning = st.active;
      this.lastScanStatus = st;
      if (canAct && inp.pressed('KeyR') && st.target) this.takeSample(st.target);
    } else if (this.tool === 1) {
      this.ui.setScan(null); this.scanner.target = null;
      mining = this.mineStep(dt, hold, origin, dir);
    } else if (this.tool === 2) {
      this.ui.setScan(null); this.scanner.target = null;
      mining = this.digStep(dt, hold, origin, dir);
    }
    this.audio.scanLoop(scanning, this.scanner.progress); this.audio.mineLoop(mining);
    this.ui.el.crosshair.classList.toggle('hostile', !!w.creatures.nearestThreat(p.pos.x, p.pos.z) && w.creatures.nearestThreat(p.pos.x, p.pos.z).d < 30);
  }

  takeSample(t) {
    if (t.kind === 'site' || t.kind === 'planet' || t.kind === 'structure') return this.toast('Cannot sample that', 'warn');
    const e = ENTRIES[t.entry]; if (!e || !e.facts.some((f) => f.how === 'lab')) return this.toast('Nothing to sample', 'warn');
    if (this.scanner.dist > 12) return this.toast('Move closer to take a sample', 'warn');
    if (!this.inventory.addSample(t.entry)) this.toast('Already sampled', '');
  }

  mineStep(dt, hold, origin, dir) {
    const w = this.world, p = this.player;
    const nodes = w.minableNodes(p.pos.x, p.pos.z, 22).map((n) => ({ x: n.x, y: n.y + 0.6, z: n.z, r: 1.1, node: n, id: n.nodeId }));
    const hit = this.scanner.pick(origin, dir, nodes, 20, 'foot');
    if (!hit) { this.ui.prompt(null); this.mining = null; return false; }
    const n = hit.t.node;
    this.ui.setScan({ target: hit.t, label: `${RES_NAMES[n.res]} deposit`, progress: this.mining && this.mining.node === n ? this.mining.p : 0, dist: hit.dist, msg: '' });
    if (!hold || !this.vitals.hasEnergy(1)) { if (this.mining) this.mining.p = Math.max(0, this.mining.p - dt); return false; }
    if (!this.mining || this.mining.node !== n) this.mining = { node: n, p: 0 };
    this.vitals.useEnergy(5.5 * dt);
    this.mining.p += dt * this.stats.mineRate / 2.2;
    // beam
    const from = this._tmp.copy(origin).add(new THREE.Vector3(0.22, -0.2, -0.4).applyQuaternion(this.camera.quaternion));
    const to = new THREE.Vector3(n.x, n.y + 0.6, n.z);
    const mid = from.clone().add(to).multiplyScalar(0.5), len = from.distanceTo(to);
    this.beam.position.copy(mid); this.beam.scale.set(1 + Math.random() * 0.8, len, 1 + Math.random() * 0.8);
    this.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize()); this.beam.visible = true;
    if (this.mining.p >= 1) {
      const amt = 2 + Math.floor(Math.random() * 3) + (n.res === 'echolite' ? 0 : 1);
      const got = this.inventory.add(n.res, amt);
      this.world.depleteNode(n);
      this.depleted[this.planetId] = [...w.flora.depleted];
      this.inventory.addSample(n.res);
      this.audio.pickup();
      this.toast(got > 0 ? `+${got} ${RES_NAMES[n.res]}` : 'Cargo full', got > 0 ? 'good' : 'warn', got < amt && got > 0 ? 'Cargo full: some material lost' : '');
      this.mining = null;
    }
    return true;
  }

  digStep(dt, hold, origin, dir) {
    const w = this.world; if (this.stats.excavator < 1) return false;
    const digs = w.structures.digs.filter((d) => !d.done).map((d) => ({ x: d.x, y: d.y + 0.4, z: d.z, r: 2, dig: d, id: d.id }));
    const hit = this.scanner.pick(origin, dir, digs, 9, 'foot');
    if (!hit) { this.ui.setScan(null); return false; }
    const d = hit.t.dig;
    this.ui.setScan({ target: hit.t, label: 'Buried object', progress: d.progress, dist: hit.dist, msg: hold ? 'Excavating…' : 'Hold to excavate' });
    if (!hold || !this.vitals.hasEnergy(1)) return false;
    this.vitals.useEnergy(4 * dt); d.progress += dt / 3.2;
    if (d.progress >= 1) {
      d.done = true; d.mound.visible = false; d.ping.visible = false; this.digsDone.add(d.id);
      this.journal.reveal(`${d.frag}:dig`); this.audio.discover(); this.autosave();
    }
    return true;
  }

  // ---------------- on-foot interactions (E)
  surfaceInteractions(dt) {
    if (this.piloting) { this.interactionPromptCockpit(); return; }
    const inp = this.input, p = this.player, w = this.world, st = w.structures;
    let prompt = null, action = null;
    if (this.nearShip(9)) { prompt = '<b>E</b> / <b>Tab</b> Board ship · <b>T</b> Ship lab'; action = () => this.boardShip(); if (inp.pressed('KeyT')) { this.ui.open('research'); } }
    // logs
    for (const l of st.logs) {
      if (Math.hypot(l.x - p.pos.x, l.z - p.pos.z) < 3.2 && Math.abs(l.y - p.pos.y) < 4) {
        prompt = '<b>E</b> Read recorded log'; action = () => { this.readLog(l); }; break;
      }
    }
    // vault door
    const v = st.vaultDoorSite;
    if (v && Math.hypot(p.pos.x - v.x, p.pos.z - (v.z + 14)) < 9 && !this.journal.hasFlag('vault_open')) { prompt = '<b>E</b> Examine the sealed door'; action = () => this.vaultDoor(); }
    // outposts
    const lab = this.outposts.nearest(this.planetId, p.pos.x, p.pos.z, 'lab', 6);
    if (lab) { prompt = '<b>E</b> Use research station'; action = () => { this.ui.open('research'); }; }
    const ex = this.outposts.nearest(this.planetId, p.pos.x, p.pos.z, 'extractor', 6);
    if (ex) { prompt = ex.stock > 0 ? `<b>E</b> Collect extractor output (${ex.stock})` : 'Extractor: working…'; if (ex.stock > 0) action = () => { const got = this.inventory.add(this.outposts.yieldRes(this.planetId), ex.stock); ex.stock -= got; this.toast(`+${got} ${RES_NAMES[this.outposts.yieldRes(this.planetId)]}`, 'good'); }; }
    const mon = this.outposts.nearest(this.planetId, p.pos.x, p.pos.z, 'monitor', 6);
    if (mon) { const a = w.atmos; prompt = `Monitoring station — ${Math.round(a.ambientTemp())}°C · weather: ${a.weather.type === 'clear' ? 'clear' : a.weather.type} · next change ~${Math.max(1, Math.round(a.weather.next / 60))} min`; }
    if (!this.outposts.placing) this.ui.prompt(this.scanner.target && this.tool === 0 ? (this.lastScanStatus?.target ? null : prompt) : prompt);
    if (action && inp.pressed('KeyE') && this.input.locked) action();
    if (inp.pressed('KeyT') && lab) { this.ui.open('research'); }
  }

  interactionPromptCockpit() {
    const ship = this.ship;
    const bits = [];
    if (ship.landed) bits.push('<b>Tab</b> Exit ship', '<b>T</b> Ship lab', '<b>Space</b> Lift off');
    this.ui.prompt(bits.join(' · ') || null);
    if (this.input.pressed('KeyT') && (ship.landed || this.mode === 'space')) { this.ui.open('research'); }
  }

  readLog(l) {
    const id = l.id; const e = ENTRIES[id];
    this.journal.reveal(`${id}:log`); this.audio.click();
    this.ui.dialog(e.name.toUpperCase(), e.facts[0].text);
  }

  vaultDoor() {
    const j = this.journal;
    const pattern = j.hasFlag('triad_key'), tA = j.hasFlag('tone_a'), tB = j.hasFlag('tone_b'), res = j.hasFlag('resonance') && this.stats.tuner >= 1;
    const mark = (b) => (b ? '[✓]' : '[ ]');
    if (pattern && tA && tB && res) {
      j.flag('vault_open'); this.world.structures.setVaultOpen(true); this.audio.door();
      this.ui.dialog('THE DEEP VAULT', 'You raise the Resonance Tuner. The three sockets answer, one by one: the Triad, the high song of Vesper, the deep song of Pelagos.\n\nThe door shudders, and begins to rise.'); this.autosave();
    } else {
      this.ui.dialog('SEALED DOOR', `A smooth door, three sockets in a triangle. It does not open to force.\n\n${mark(pattern)} Pattern — the Triad geometry (compare structures across worlds)\n${mark(tA && tB)} Tone — both halves of the song (Khepri/Vesper and the deep register of Pelagos)\n${mark(res)} Resonance — a Resonance Tuner, built from echolite and relic alloy (Equipment)`);
    }
  }

  updateSiteDiscovery(fp) {
    for (const s of this.world.hf.sites) {
      if (this.discovered.has(s.id)) continue;
      if (Math.hypot(fp.x - s.x, fp.z - s.z) < s.r * 1.6 + 20) {
        this.discovered.add(s.id);
        if (s.label) this.ui.banner(s.label, s.type === 'pad' ? '' : 'Location discovered');
      }
    }
  }

  // ---------------- ship scanning on the surface
  shipScanSurface(dt) {
    const w = this.world, cam = this.camera, s = this.ship;
    const dir = this._dir.set(0, 0, -1).applyQuaternion(cam.quaternion);
    const targets = w.scanTargets(s.pos.x, s.pos.z, 330, false).filter((t) => t.kind === 'site' || t.kind === 'creature');
    const st = this.scanner.update(dt, this.input.locked && this.input.mouseDown(0), cam.position, dir, targets, 300, this.stats.scanTier, 'ship');
    this.ui.setScan(st); this.audio.scanLoop(st.active, this.scanner.progress); this.audio.mineLoop(false);
    this.ui.setTools([{ name: 'Ship scan' }], 0);
  }

  updateShipHudSurface(alt) {
    const s = this.ship;
    this.ui.setShipHud(`${Math.round(s.vel.length())} m/s`, `ALT ${Math.round(alt)} m\nFUEL ${Math.round(s.fuel)}/${this.stats.fuelMax}   HULL ${Math.round(s.hull)}%\n${s.assist ? 'ASSIST' : '<span class="warn">MANUAL</span>'}${s.landed ? ' · LANDED' : ''}\nAscend above ${TAKEOFF_ALT} m for orbit`);
    s.drawCockpit(0.016, { speed: s.vel.length(), alt: Math.round(alt) + ' m', fuel: s.fuel / this.stats.fuelMax * 100, hull: s.hull / this.stats.hullMax * 100, assist: s.assist, cruise: false, boost: s.boosting, mode: 'ATMOSPHERE', thrust: s.thrustLevel, frame: this.planetDef.name, navName: this.waypoint ? this.waypoint.name : 'No waypoint', navDist: this.waypoint ? fmtDist(Math.hypot(this.waypoint.x - s.pos.x, this.waypoint.z - s.pos.z)) : '', hostile: false });
  }

  // ---------------- HUD (surface)
  updateHudSurface() {
    const cam = this.camera, w = this.world, p = this.player, s = this.ship;
    const dir = this._tmp.set(0, 0, -1).applyQuaternion(cam.quaternion);
    const heading = ((Math.atan2(dir.x, -dir.z) * 180 / Math.PI) + 360) % 360;
    let info = '';
    if (this.waypoint) { const fp = this.piloting ? s.pos : p.pos; info = `▸ ${this.waypoint.name}  ${fmtDist(Math.hypot(this.waypoint.x - fp.x, this.waypoint.z - fp.z))}`; }
    this.ui.setCompass(heading, info);
    const a = w.atmos, hour = Math.floor(a.time * 24), min = Math.floor((a.time * 24 - hour) * 60);
    const wx = a.weather.type !== 'clear' && a.weather.intensity > 0.2 ? ` · <b>${a.weather.type}</b>` : '';
    this.ui.loc(`<b>${this.planetDef.name}</b> · ${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}${wx}`);
    this.ui.setVitals(this.vitals, this.stats.o2Max, this.stats.energyMax, this.vitals.ambient, this.vitals.status, this.vitals.hazards.tempState);
    // markers
    const marks = [];
    const fp = this.piloting ? s.pos : p.pos;
    const add = (pos, label, color, always = true) => {
      const d = Math.hypot(pos.x - fp.x, pos.z - fp.z); if (!always && d > 900) return;
      const m = this.project(new THREE.Vector3(pos.x, pos.y ?? 0, pos.z)); marks.push({ ...m, label, dist: fmtDist(Math.hypot(d, (pos.y ?? fp.y) - fp.y)), color });
    };
    if (this.waypoint) add({ x: this.waypoint.x, y: this.waypoint.y ?? w.hf.heightAt(this.waypoint.x, this.waypoint.z) + 4, z: this.waypoint.z }, this.waypoint.name, '#ffd35a');
    if (!this.piloting && s.landed && s.pos.distanceTo(p.pos) > 25) add({ x: s.pos.x, y: s.pos.y + 4, z: s.pos.z }, 'Ship', '#7fe8e0');
    for (const site of w.hf.sites) {
      if (site.type === 'pad' || !this.discovered.has(site.id)) continue;
      add({ x: site.x, y: site.y + 8, z: site.z }, site.label, '#a8b8c8', false);
    }
    this.ui.drawMarkers(marks.filter((m) => m.on || this.waypoint));
  }

  project(v) {
    const p = v.clone(); const cam = this.camera;
    p.project(cam);
    const behind = (() => { const d = v.clone().sub(cam.position); return d.dot(this._tmp.set(0, 0, -1).applyQuaternion(cam.quaternion)) < 0; })();
    let x = (p.x * 0.5 + 0.5) * innerWidth, y = (-p.y * 0.5 + 0.5) * innerHeight;
    if (behind) { x = innerWidth - x; y = innerHeight - y; }
    return { x, y, on: !behind && p.x > -1 && p.x < 1 && p.y > -1 && p.y < 1 };
  }

  // ------------------------------------------------------------------ space
  stepSpace(dt) {
    const sp = this.space, ship = this.ship, inp = this.input, cam = this.camera;
    sp.update(dt, ship.pos, ship.vel, this);
    ship.update(dt, inp, { gravity: 0 });
    // asteroid collisions
    const hit = sp.asteroidCollision(ship.pos, 9);
    if (hit) {
      const n = ship.pos.clone().sub(hit.a.pos).normalize();
      ship.pos.addScaledVector(n, hit.depth + 0.5);
      const vn = ship.vel.dot(n);
      if (vn < 0) { ship.vel.addScaledVector(n, -vn * 1.4); const dmg = Math.max(0, -vn - 25) * 0.35; if (dmg > 0.5) this.events.emit('ship:damage', { amount: dmg, kind: 'asteroid' }); }
      if (ship.cruising) ship.toggleCruise(true);
    }
    // collision with planets / star
    const { body, alt } = sp.nearestPlanet(ship.pos);
    if (alt < LAND_ALT && body && !this.pending) {
      const radial = ship.pos.clone().sub(body.pos).normalize();
      if (ship.vel.dot(radial) < 6 || alt < 200) this.toSurface(body);
    }
    if (ship.cruising && alt < 14000) ship.toggleCruise(true);
    const star = sp.byId.star; if (ship.pos.distanceTo(star.pos) < star.radius * 1.15) this.events.emit('ship:damage', { amount: 40 * dt, kind: 'heat' });
    // reveal bodies by proximity
    for (const b of sp.bodies) if (b.type !== 'star' && !this.knownSpace.has(b.id) && b.pos.distanceTo(ship.pos) < Math.max(100000, b.radius * 6) && b.id !== 'asteroids') { this.knownSpace.add(b.id); this.toast(`Contact: ${b.name}`, 'link'); }
    // camera
    cam.position.set(0, 0, 0); cam.quaternion.copy(ship.quat);
    if (!ship.cockpit.parent) cam.add(ship.cockpit);
    if (this.shake > 0) { cam.position.x += (Math.random() - 0.5) * this.shake * 0.1; cam.position.y += (Math.random() - 0.5) * this.shake * 0.1; }
    // scanning
    const dir = this._dir.set(0, 0, -1).applyQuaternion(ship.quat);
    const tier = this.stats.shipScanRange > 10000 ? 2 : 1;
    const targets = sp.targets(ship.pos, this.stats.shipScanRange);
    const st = this.scanner.update(dt, inp.locked && inp.mouseDown(0), ship.pos, dir, targets, this.stats.shipScanRange, tier, 'ship');
    this.ui.setScan(st); this.audio.scanLoop(st.active, this.scanner.progress);
    // nav / interactions
    this.navUpdate(dt);
    this.spaceInteractions();
    this.updateHudSpace(alt, body);
    this.audio.setEnv({ inShip: true, thrust: ship.thrustLevel, cruise: ship.cruising, underwater: false, space: true, rad: 0 });
    this.vitals.update(dt, { planet: this.planetDef, ambientTemp: 20, rad: 0, weather: null, underwater: false, depth: 0, sheltered: false, safe: true, inShip: true, dayFactor: 1, outdoors: false });
    this.ui.setTools([{ name: 'Ship scan' }], 0);
    if (this.world) { this.world.dispose(); this.world = null; }
  }

  navTargets() {
    const sp = this.space, ship = this.ship, out = [];
    for (const b of sp.bodies) {
      if (b.type === 'star' || b.id === 'asteroids' && !this.knownSpace.has('calloway')) continue;
      if (!this.knownSpace.has(b.id) && b.id !== 'asteroids') continue;
      let name = b.name;
      if (b.id === 'calloway' && b.dist > 3000 && !this.journal.hasEntry('calloway_wreck')) name = 'Distress Signal';
      if (b.id === 'tessera' && !this.journal.hasEntry('tessera_market')) name = 'Orrin Beacon';
      if (b.id === 'asteroids') continue;
      out.push({ id: b.id, name, pos: b.pos, radius: b.radius });
    }
    const { body, alt } = sp.nearestPlanet(ship.pos);
    if (body && alt < 120000) { const d = landingZoneDir(body.id); out.push({ id: 'lz:' + body.id, name: `${body.name} Landing Zone`, pos: body.pos.clone().addScaledVector(d, body.radius), radius: 100 }); }
    return out;
  }

  navUpdate(dt) {
    const ship = this.ship, list = this.navTargets();
    if (this.input.pressed('KeyN') && list.length) {
      list.sort((a, b) => a.pos.distanceTo(ship.pos) - b.pos.distanceTo(ship.pos));
      const i = list.findIndex((t) => t.id === this.navId);
      this.navId = list[(i + 1) % list.length].id; this.toast(`Nav target: ${list[(i + 1) % list.length].name}`);
    }
    this.navCur = list.find((t) => t.id === this.navId) || null;
    if (this.input.pressed('KeyG')) {
      if (this.stats.autopilot < 1) this.toast('Auto-align needs Navigation Computer Mk II', 'warn');
      else if (!this.navCur) this.toast('No nav target (N)', 'warn');
      else { const id = this.navId; ship.autoAlign = () => { const t = this.navTargets().find((x) => x.id === id); return t ? t.pos.clone().sub(ship.pos).normalize() : null; }; this.toast('Aligning…'); }
    }
  }

  spaceInteractions() {
    const sp = this.space, ship = this.ship, inp = this.input;
    let prompt = null;
    const t = sp.byId.tessera, c = sp.byId.calloway;
    if (t.pos.distanceTo(ship.pos) < t.comm) { prompt = '<b>E</b> Open comm link — Tessera Market'; if (inp.pressed('KeyE')) { this.journal.reveal('tessera_market:id'); this.ui.open('trade'); } }
    else if (c.pos.distanceTo(ship.pos) < 500) {
      prompt = '<b>E</b> Download flight recorder';
      if (inp.pressed('KeyE')) { const l = this.journal.hasEntry('calloway_log_1') ? 'calloway_log_2' : 'calloway_log_1'; this.journal.reveal(`${l}:log`); const e = ENTRIES[l]; this.ui.dialog(e.name.toUpperCase(), e.facts[0].text); if (l === 'calloway_log_2') this.knownSpace.add('orbital_ring'); }
    }
    for (const r of sp.raiders) if (r.alerted && !this._warned) { this._warned = true; this.toast('Kharn raiders — hostile. Break contact!', 'bad'); }
    if (!sp.raiders.some((r) => r.alerted)) this._warned = false;
    this.ui.prompt(prompt);
  }

  updateHudSpace(alt, body) {
    const ship = this.ship, sp = this.space, cam = this.camera;
    const dir = this._tmp.set(0, 0, -1).applyQuaternion(ship.quat);
    const heading = ((Math.atan2(dir.x, -dir.z) * 180 / Math.PI) + 360) % 360;
    this.ui.setCompass(heading, this.navCur ? `▸ ${this.navCur.name}  ${fmtDist(this.navCur.pos.distanceTo(ship.pos))}` : 'No nav target (N)');
    const speed = ship.vel.length();
    const spTxt = speed > 2000 ? `${(speed / 1000).toFixed(1)} km/s` : `${Math.round(speed)} m/s`;
    const hostile = sp.raiders.some((r) => r.alerted);
    this.ui.setShipHud(spTxt, `FUEL ${Math.round(ship.fuel)}/${this.stats.fuelMax}   HULL ${Math.round(ship.hull)}%\n${ship.assist ? 'ASSIST' : '<span class="warn">MANUAL</span>'} ${ship.cruising ? '· <span class="warn">CRUISE</span>' : ''} ${ship.boosting ? '· BOOST' : ''}\n${body ? body.name + ' alt ' + fmtDist(alt) : ''}${hostile ? '\n<span class="warn">! HOSTILE CONTACTS</span>' : ''}`);
    const nd = this.navCur ? fmtDist(this.navCur.pos.distanceTo(ship.pos)) : '';
    ship.drawCockpit(0.016, { speed, alt: body ? fmtDist(alt) : '--', fuel: ship.fuel / this.stats.fuelMax * 100, hull: ship.hull / this.stats.hullMax * 100, assist: ship.assist, cruise: ship.cruising, boost: ship.boosting, mode: ship.cruising ? 'CRUISE' : 'SPACE', thrust: ship.thrustLevel, frame: 'deep space', navName: this.navCur ? this.navCur.name : 'No target', navDist: nd, hostile });
    this.ui.setVitals(this.vitals, this.stats.o2Max, this.stats.energyMax, 20, [], 'ok');
    this.ui.loc('<b>Deep space</b> · Aurelia system');
    // markers
    const marks = [];
    for (const t of this.navTargets()) {
      const rel = t.pos.clone().sub(ship.pos); const d = rel.length();
      const m = this.project(rel.clone().add(cam.position)); // camera sits at the origin in the space scene
      const isNav = t.id === this.navId; if (!isNav && d > 600000) continue;
      marks.push({ ...m, label: t.name, dist: fmtDist(d), color: isNav ? '#ffd35a' : '#7fa8b8' });
    }
    this.ui.drawMarkers(marks);
  }

  // ------------------------------------------------------------------ render
  render() {
    const r = this.renderer;
    if (this.mode === 'surface' && this.world) { r.autoClear = true; this.camera.near = 0.1; this.camera.far = 3800; this.camera.updateProjectionMatrix(); r.render(this.world.scene, this.camera); }
    else if (this.mode === 'space' && this.space) {
      const sp = this.space, cam = this.camera;
      r.autoClear = false; r.clear();
      sp.setPass('far'); cam.near = 100; cam.far = 6e6; cam.updateProjectionMatrix(); r.render(sp.scene, cam);
      r.clearDepth();
      sp.setPass('near'); cam.near = 0.2; cam.far = 70000; cam.updateProjectionMatrix(); r.render(sp.scene, cam);
    }
  }

  // ------------------------------------------------------------------ actions used by UI
  canCraft() {
    if (this.piloting) return this.ship.landed || this.mode === 'space';
    if (this.mode !== 'surface') return false;
    const p = this.player.pos;
    return this.nearShip(15) || !!this.outposts.nearest(this.planetId, p.x, p.z, 'lab', 12);
  }
  buyUpgrade(id) {
    if (!this.canCraft()) return this.toast('Return to your ship or a research station to craft', 'warn');
    const r = this.inventory.buy(id); if (!r.ok) this.toast(r.reason || 'Cannot craft', 'warn');
  }
  analyse(id) {
    const f = ENTRIES[id]?.facts.find((x) => x.how === 'lab'); if (!f) return;
    this.journal.reveal(f.id); this.audio.scanDone();
  }
  refine() { if (this.inventory.spend({ deuterium_ice: 2 })) { this.ship.fuel = Math.min(this.stats.fuelMax, this.ship.fuel + 30); this.toast('+30 fuel', 'good'); this.audio.build(); } }
  repairHull() { if (this.inventory.spend({ ferrolith: 3 })) { this.ship.hull = Math.min(this.stats.hullMax, this.ship.hull + 25); this.toast('Hull repaired', 'good'); this.audio.build(); } }
  trade(o) {
    const inv = this.inventory;
    if (!inv.spend(o.give)) return;
    if (o.get.fuel) this.ship.fuel = Math.min(this.stats.fuelMax, this.ship.fuel + o.get.fuel * this.stats.fuelMax / 100);
    if (o.get.repair) this.ship.hull = Math.min(this.stats.hullMax, this.ship.hull + o.get.repair);
    for (const [r, n] of Object.entries(o.get.res || {})) inv.add(r, n);
    this.audio.pickup(); this.toast('Trade complete', 'good');
  }
  orrinTopic(t) {
    for (const g of t.grant || []) this.journal.reveal(g, false);
    if (t.reveal) { this.knownSpace.add(t.reveal); this.toast('Orrin chart updated', 'link'); }
  }
  startBuild(type) { if (this.mode !== 'surface' || this.piloting) return this.toast('Build outposts on foot', 'warn'); if (this.outposts.startPlacing(type)) { this.expectUnlock = false; this.input.lock(); } }

  mapClick(x, y, ms) {
    const cv = this.ui.mapCanvas; const W = cv.width, H = cv.height;
    if (this.mode === 'space') {
      const k = 0.0009 * ms.zoom; let best = null, bd = 28;
      for (const t of this.navTargets()) { const px = W / 2 + t.pos.x * k, py = H / 2 + t.pos.z * k; const d = Math.hypot(px - x, py - y); if (d < bd) { bd = d; best = t; } }
      if (best) { this.navId = best.id; this.toast(`Nav target: ${best.name}`); }
      return;
    }
    const k = 0.14 * ms.zoom, fp = this.piloting ? this.ship.pos : this.player.pos;
    let best = null, bd = 18;
    for (const s of this.mapSites()) { const px = W / 2 + (s.x - fp.x) * k, py = H / 2 + (s.z - fp.z) * k; const d = Math.hypot(px - x, py - y); if (d < bd) { bd = d; best = s; } }
    if (best) { this.waypoint = { x: best.x, z: best.z, name: best.label, y: best.y }; this.toast(`Waypoint: ${best.label}`); }
    else { const wx = fp.x + (x - W / 2) / k, wz = fp.z + (y - H / 2) / k; this.waypoint = { x: wx, z: wz, name: 'Waypoint' }; this.toast('Waypoint set'); }
  }

  mapSites() {
    const out = [], orbit = this.journal.has(`${this.planetId}:orbit`);
    for (const s of this.world?.hf.sites || []) {
      const disc = this.discovered.has(s.id), rev = this.revealed.has(s.id);
      if (disc || rev) out.push({ ...s, known: true });
      else if (s.hint && orbit) out.push({ ...s, label: 'Unidentified signal', known: false });
    }
    return out;
  }

  drawMap(cv, ms) {
    const c = cv.getContext('2d'), W = cv.width, H = cv.height;
    c.fillStyle = '#04080c'; c.fillRect(0, 0, W, H);
    if (this.mode === 'space') return this.drawSpaceMap(c, W, H, ms);
    const w = this.world; if (!w) return;
    const fp = this.piloting ? this.ship.pos : this.player.pos, k = 0.14 * ms.zoom;
    const cell = 10, img = c.createImageData(W, H);
    const col = new THREE.Color(), wl = w.hf.waterLevel;
    for (let gy = 0; gy < H; gy += cell) for (let gx = 0; gx < W; gx += cell) {
      const wx = fp.x + (gx + cell / 2 - W / 2) / k, wz = fp.z + (gy + cell / 2 - H / 2) / k;
      const h = w.hf.heightAt(wx, wz); let r, g, b;
      if (wl !== null && h < wl) { const d = Math.min(1, (wl - h) / 90); r = 20 - 12 * d; g = 70 - 40 * d; b = 110 - 50 * d; }
      else { const t = clamp((h + 20) / 140, 0, 1); const pc = col.set(this.planetDef.palette.mid).lerp(col.clone().set(this.planetDef.palette.high), t).multiplyScalar(0.35 + 0.35 * t); r = pc.r * 255; g = pc.g * 255; b = pc.b * 255; }
      for (let y = 0; y < cell && gy + y < H; y++) for (let x = 0; x < cell && gx + x < W; x++) { const i = ((gy + y) * W + gx + x) * 4; img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255; }
    }
    c.putImageData(img, 0, 0);
    c.strokeStyle = 'rgba(127,232,224,0.12)'; c.lineWidth = 1;
    for (let r = 500; r < 6000; r += 500) { c.beginPath(); c.arc(W / 2, H / 2, r * k, 0, TAU); c.stroke(); }
    c.font = '12px sans-serif'; c.textAlign = 'center';
    const diamond = (x, y, col2, lab) => { c.strokeStyle = col2; c.fillStyle = col2; c.beginPath(); c.moveTo(x, y - 7); c.lineTo(x + 7, y); c.lineTo(x, y + 7); c.lineTo(x - 7, y); c.closePath(); c.stroke(); if (lab) c.fillText(lab, x, y - 12); };
    for (const s of this.mapSites()) { const x = W / 2 + (s.x - fp.x) * k, y = H / 2 + (s.z - fp.z) * k; diamond(x, y, s.known ? '#7fe8e0' : '#ffb04a', s.known ? s.label : '?'); }
    for (const o of this.outposts.list) if (o.planet === this.planetId) { const x = W / 2 + (o.x - fp.x) * k, y = H / 2 + (o.z - fp.z) * k; c.fillStyle = '#7aff9a'; c.fillRect(x - 4, y - 4, 8, 8); c.fillText(o.type, x, y - 8); }
    const s = this.ship; { const x = W / 2 + (s.pos.x - fp.x) * k, y = H / 2 + (s.pos.z - fp.z) * k; c.fillStyle = '#fff'; c.fillText('▲ ship', x, y - 6); }
    if (this.waypoint) { const x = W / 2 + (this.waypoint.x - fp.x) * k, y = H / 2 + (this.waypoint.z - fp.z) * k; c.strokeStyle = '#ffd35a'; c.beginPath(); c.arc(x, y, 8, 0, TAU); c.stroke(); c.fillStyle = '#ffd35a'; c.fillText(this.waypoint.name, x, y - 12); }
    // player
    const yaw = this.piloting ? 0 : this.player.yaw;
    c.save(); c.translate(W / 2, H / 2); c.rotate(-yaw); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(0, -9); c.lineTo(6, 7); c.lineTo(-6, 7); c.closePath(); c.fill(); c.restore();
    c.fillStyle = '#7fa8b8'; c.textAlign = 'left'; c.fillText('N ↑   ring spacing 500 m', 12, H - 12);
  }

  drawSpaceMap(c, W, H, ms) {
    const k = 0.0009 * ms.zoom, sp = this.space;
    c.strokeStyle = 'rgba(127,232,224,0.1)'; for (let r = 100000; r < 700000; r += 100000) { c.beginPath(); c.arc(W / 2, H / 2, r * k, 0, TAU); c.stroke(); }
    c.fillStyle = '#ffd890'; c.beginPath(); c.arc(W / 2, H / 2, 6, 0, TAU); c.fill(); c.font = '12px sans-serif'; c.textAlign = 'center'; c.fillText('Aurelia', W / 2, H / 2 - 12);
    for (const t of this.navTargets()) {
      if (t.id.startsWith('lz:')) continue;
      const x = W / 2 + t.pos.x * k, y = H / 2 + t.pos.z * k, nav = t.id === this.navId;
      c.fillStyle = nav ? '#ffd35a' : '#7fe8e0'; c.beginPath(); c.arc(x, y, nav ? 7 : 5, 0, TAU); c.fill(); c.fillText(t.name, x, y - 11);
    }
    const sx = W / 2 + this.ship.pos.x * k, sy = H / 2 + this.ship.pos.z * k; c.fillStyle = '#fff'; c.fillText('▲ you', sx, sy - 8);
    c.fillStyle = '#7fa8b8'; c.textAlign = 'left'; c.fillText('Top-down · rings every 100 000 m', 12, H - 12);
  }

  // ------------------------------------------------------------------ death / respawn
  playerDied() {
    this.mining = null;
    this.ui.fade(1, '#300', 900); this.ui.banner('SUIT FAILURE', 'Emergency recall');
    setTimeout(() => {
      // lose a portion of carried material
      for (const [r, n] of Object.entries({ ...this.inventory.res })) { const loss = Math.floor(n * 0.15); if (loss) this.inventory.res[r] -= loss; }
      this.vitals.revive();
      const s = this.ship, p = this.player;
      if (this.mode === 'surface' && this.world) { this.piloting = false; const side = new THREE.Vector3(1, 0, 0).applyQuaternion(s.quat); p.pos.set(s.pos.x + side.x * 5, 0, s.pos.z + side.z * 5); p.pos.y = this.world.hf.heightAt(p.pos.x, p.pos.z); p.vel.set(0, 0, 0); if (!s.landed) { s.landed = true; s.vel.set(0, 0, 0); } }
      this.ui.fade(0, '#300', 900); this.toast('Recovered by ship drones. Some materials were lost.', 'warn');
    }, 1800);
  }

  shipDestroyed() {
    if (this.pending) return;
    this.toast('Hull breach: emergency evacuation', 'bad');
    this.transition(() => {
      for (const [r, n] of Object.entries({ ...this.inventory.res })) { const loss = Math.floor(n * 0.25); if (loss) this.inventory.res[r] -= loss; }
      const target = this.mode === 'space' ? this.space.nearestPlanet(this.ship.pos).body.id : this.planetId;
      this.ship.hull = this.stats.hullMax * 0.5; this.ship.fuel = this.stats.fuelMax * 0.4; this.ship.cruising = false; this.ship.vel.set(0, 0, 0);
      this.mode = 'surface'; this.enterSurface(target, { fresh: true });
      this.ship.assist = true;
      this.ui.banner('SHIP RECOVERED', 'Towed back to the landing zone'); this.autosave();
    }, '#600', 900);
  }

  // ------------------------------------------------------------------ persistence
  serialize() {
    const s = this.ship, p = this.player;
    if (this.world) { this.planetTimes[this.planetId] = this.world.atmos.serialize(); this.depleted[this.planetId] = [...this.world.flora.depleted]; }
    return {
      mode: this.mode, planet: this.planetId, piloting: this.piloting,
      player: { pos: p.pos.toArray(), yaw: p.yaw, pitch: p.pitch },
      ship: { pos: s.pos.toArray(), quat: s.quat.toArray(), vel: s.vel.toArray(), landed: s.landed, fuel: s.fuel, hull: s.hull, assist: s.assist },
      journal: this.journal.serialize(), inventory: this.inventory.serialize(), vitals: this.vitals.serialize(), outposts: this.outposts.serialize(),
      discovered: [...this.discovered], revealed: [...this.revealed], known: [...this.knownSpace], depleted: this.depleted, digs: [...this.digsDone],
      times: this.planetTimes, waypoint: this.waypoint, navId: this.navId, playTime: this.playTime, ending: this.ending,
    };
  }
  async save(notify = false) { const ok = await Save.write(this.serialize()); if (notify) this.toast(ok ? 'Game saved' : 'Save failed (storage unavailable)', ok ? 'good' : 'bad'); return ok; }
  autosave() { if (this.playing && !this.vitals.dead) this.save(false); }

  restore(d) {
    this.journal.restore(d.journal); this.inventory.restore(d.inventory); this.vitals.restore(d.vitals); this.outposts.restore(d.outposts);
    this.discovered = new Set(d.discovered || []); this.revealed = new Set(d.revealed || []); this.knownSpace = new Set(d.known || [...this.knownSpace]);
    this.depleted = d.depleted || {}; this.digsDone = new Set(d.digs || []); this.planetTimes = d.times || {}; this.waypoint = d.waypoint || null; this.navId = d.navId || null;
    this.playTime = d.playTime || 0; this.ending = !!d.ending;
    const s = this.ship; s.fuel = d.ship.fuel; s.hull = d.ship.hull; s.assist = d.ship.assist !== false;
    if (d.mode === 'space') {
      this.piloting = true;
      s.pos.fromArray(d.ship.pos); s.quat.fromArray(d.ship.quat); s.vel.fromArray(d.ship.vel);
      this.enterSpace(d.planet, { pos: s.pos.clone(), quat: s.quat.clone(), vel: s.vel.clone() });
    } else {
      this.enterSurface(d.planet, {});
      s.pos.fromArray(d.ship.pos); s.quat.fromArray(d.ship.quat); s.vel.fromArray(d.ship.vel); s.landed = d.ship.landed; s.frame = 'surface';
      const p = this.player; p.pos.fromArray(d.player.pos); p.yaw = d.player.yaw; p.pitch = d.player.pitch; p.vel.set(0, 0, 0);
      this.piloting = !!d.piloting; if (this.piloting) this.camera.add(this.ship.cockpit);
      this.focusPoint(this._o); this.world.prime(this._o.x, this._o.z);
    }
    this.applyStatsToShip();
  }
}
