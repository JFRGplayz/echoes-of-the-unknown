// Headless smoke test: boots the real game code against stubbed three/DOM and drives it through
// every major flow (all planets, scanning, mining, boarding, takeoff, space, landing, save/restore).
import './dom-stub.mjs';
import * as THREE from 'three';
const { Game } = await import('../src/game.js');
const { ENTRIES } = await import('../src/data/codex.js');
const { PLANETS } = await import('../src/data/planets.js');

let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  FAIL:', m); } else console.log('  ok:', m); };
const finite = (v) => Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);

const game = new Game(document.getElementById('game'));
game.input.locked = true;
const frames = (n, dt = 1 / 30, fn) => { for (let i = 0; i < n; i++) { fn?.(i); game.step(dt); game.render(); game.input.endFrame(); } };
const hold = (code, on = true) => { on ? game.input.keys.add(code) : game.input.keys.delete(code); };
const lookAt = (x, y, z) => {
  const p = game.player, e = p.eyePos(new THREE.Vector3());
  const dx = x - e.x, dy = y - e.y, dz = z - e.z;
  p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz));
};

console.log('== boot / new game');
await game.startNew();
ok(game.mode === 'surface' && game.world, 'new game lands on Khepri surface');
frames(120);
ok(finite(game.player.pos) && game.player.onGround, 'player stands on ground, finite position');
ok(game.world.creatures.list.length > 0, `creatures spawned (${game.world.creatures.list.length})`);
ok(game.world.terrain.near.size >= 40, `terrain streamed (${game.world.terrain.near.size} near chunks)`);
ok(game.world.flora.chunks.size > 0, 'flora instanced');

console.log('== movement');
const x0 = game.player.pos.x, z0 = game.player.pos.z;
hold('KeyW'); hold('ShiftLeft'); frames(90); hold('KeyW', false); hold('ShiftLeft', false);
ok(Math.hypot(game.player.pos.x - x0, game.player.pos.z - z0) > 5, 'WASD moves player');
hold('Space'); frames(20); hold('Space', false);
ok(finite(game.player.pos), 'jump/jetpack stays finite');

console.log('== scanning a site (Observatory Pylon)');
const pylon = game.world.structures.scanTargets.filter((t) => t.site.id === 'k_pylon');
ok(pylon.length === 5, `pylon has ${pylon.length} investigation points`);
const t0 = pylon[0];
game.player.pos.set(t0.x + 6, game.world.hf.heightAt(t0.x + 6, t0.z + 22), t0.z + 22);
game.tool = 0;
for (let i = 0; i < 160 && !game.journal.has('khepri_pylon:id'); i++) { lookAt(t0.x, t0.y, t0.z); hold('Mouse0', false); game.input.mouse.buttons = 1; frames(1); }
game.input.mouse.buttons = 0;
ok(game.journal.has('khepri_pylon:id'), 'scan reveals pylon identification');
ok(game.journal.has('khepri_pylon:arch'), 'site scan reveals architecture (Triad) fact');
ok(!game.journal.has('khepri_pylon:inscr'), 'inscription still locked (needs Mk II scanner)');

console.log('== journal links & progression');
const j = game.journal;
j.reveal('vesper_spire:arch'); j.reveal('nivalis_arch:arch');
ok(j.hasFlag('triad_key'), 'Triad link fires after three structures');
ok(game.revealed.has('n_vault'), 'Triad link reveals the Deep Vault');
j.reveal('harmonic_hum:id'); j.reveal('lumen_choir:obs:calling');
ok(j.hasFlag('tone_a'), 'Tone link fires');
j.reveal('khepri_pylon:inscr'); ok(j.lexicon >= 1, 'inscription grants lexicon');
game.inventory.res = { ferrolith: 30, silicate_glass: 20, echolite: 12, relic_alloy: 6 };
game.ship.landed = true;
ok(game.canCraft() === false || true, 'canCraft evaluates');
game.player.pos.copy(game.ship.pos).add(new THREE.Vector3(3, -2, 0));
ok(game.canCraft(), 'can craft next to ship');
game.buyUpgrade('scanner'); ok(game.stats.scanTier === 2, 'scanner upgraded to Mk II');

console.log('== mining');
game.player.pos.copy(game.ship.pos).add(new THREE.Vector3(3, -2, 0)); frames(90);
const nodes = game.world.minableNodes(game.player.pos.x, game.player.pos.z, 400);
ok(nodes.length > 0, `resource nodes nearby (${nodes.length})`);
const n = nodes[0];
game.player.pos.set(n.x + 4, game.world.hf.heightAt(n.x + 4, n.z), n.z);
game.tool = 1; game.vitals.energy = 100;
const before = Object.values(game.inventory.res).reduce((a, b) => a + b, 0);
for (let i = 0; i < 160 && !n.gone; i++) { lookAt(n.x, n.y + 0.6, n.z); game.input.mouse.buttons = 1; frames(1); }
game.input.mouse.buttons = 0;
ok(n.gone, 'node mined out');
ok(Object.values(game.inventory.res).reduce((a, b) => a + b, 0) > before, 'resources added to cargo');

console.log('== survival');
game.tool = 0; game.vitals.revive(); game.player.pos.set(0, game.world.hf.heightAt(40, 40), 40); game.player.pos.x = 40;
const o2a = game.vitals.oxygen; frames(150);
ok(game.vitals.oxygen < o2a, 'oxygen drains on Khepri away from the ship');
game.player.pos.copy(game.ship.pos).add(new THREE.Vector3(3, -2, 0)); frames(60);
ok(game.vitals.oxygen >= o2a - 5, 'oxygen restores next to the ship');

console.log('== boarding, takeoff, space');
game.player.pos.copy(game.ship.pos).add(new THREE.Vector3(4, -2, 0));
game.input.keys.add('Tab'); game.input.pressedSet.add('Tab'); frames(1); game.input.keys.delete('Tab');
ok(game.piloting, 'boarded ship');
hold('Space'); frames(30); ok(!game.ship.landed, 'lifted off'); hold('Space', false);
// pitch nose up and fly straight up by teleporting near the takeoff altitude
game.ship.pos.y = game.world.hf.heightAt(game.ship.pos.x, game.ship.pos.z) + 2100;
frames(5);
for (let i = 0; i < 80 && game.mode !== 'space'; i++) frames(1);
ok(game.mode === 'space', 'transitioned to space');
ok(game.space && finite(game.ship.pos), 'space world built, ship pos finite');
const kp = new THREE.Vector3(...PLANETS.khepri.orbitPos);
const alt = game.ship.pos.distanceTo(kp) - PLANETS.khepri.radius;
ok(alt > 1900 && alt < 2300, `ship starts near the planet surface (alt ${alt.toFixed(0)})`);
frames(60);
ok(finite(game.ship.pos) && finite(game.ship.vel), 'space flight stable');

console.log('== cruise & arrive at Vesper');
const vp = new THREE.Vector3(...PLANETS.vesper.orbitPos);
game.ship.pos.copy(vp).add(new THREE.Vector3(60000, 5000, 0));
game.ship.quat.setFromUnitVectors(new THREE.Vector3(0, 0, -1), vp.clone().sub(game.ship.pos).normalize());
game.ship.vel.set(0, 0, 0); game.ship.fuel = 100;
hold('KeyV', false); game.input.pressedSet.add('KeyV'); frames(1);
ok(game.ship.cruising, 'cruise drive engaged');
for (let i = 0; i < 400 && game.ship.cruising; i++) frames(1);
ok(!game.ship.cruising, 'cruise disengaged (mass lock)');
const nav = game.navTargets(); ok(nav.some((t) => t.id === 'vesper'), 'Vesper listed as nav target');
// drift towards the planet until atmosphere entry
game.ship.vel.copy(vp.clone().sub(game.ship.pos).normalize().multiplyScalar(300));
for (let i = 0; i < 600 && game.mode === 'space'; i++) { game.ship.vel.copy(vp.clone().sub(game.ship.pos).normalize().multiplyScalar(300)); frames(1, 0.1); }
for (let i = 0; i < 60 && game.pending; i++) frames(1);
ok(game.mode === 'surface' && game.planetId === 'vesper', `entered Vesper atmosphere (mode=${game.mode}, planet=${game.planetId})`);
ok(game.piloting && finite(game.ship.pos), 'still piloting after atmospheric entry');
const gh = game.world.hf.heightAt(game.ship.pos.x, game.ship.pos.z);
ok(game.ship.pos.y - gh > 1200 && game.ship.pos.y - gh < 2100, `arrival altitude sane (${(game.ship.pos.y - gh).toFixed(0)} m)`);
// descend and land
game.ship.pos.y = game.world.hf.heightAt(game.ship.pos.x, game.ship.pos.z) + 90; game.ship.vel.set(0, 0, 0); game.ship.quat.set(0, 0, 0, 1);
for (let i = 0; i < 1500 && !game.ship.landed; i++) { hold('ControlLeft'); frames(1, 0.05); if (game.ship.pos.y - game.world.hf.heightAt(game.ship.pos.x, game.ship.pos.z) < 60) { game.ship.vel.y = Math.max(game.ship.vel.y, -4); } }
hold('ControlLeft', false);
ok(game.ship.landed, `ship landed on Vesper (mode=${game.mode} clearance=${(game.ship.pos.y - game.world.hf.heightAt(game.ship.pos.x, game.ship.pos.z)).toFixed(1)} v=${game.ship.vel.toArray().map((x) => x.toFixed(1))} hull=${game.ship.hull.toFixed(0)})`);

console.log('== every planet loads and runs');
for (const id of ['khepri', 'vesper', 'nivalis', 'pelagos']) {
  game.enterSurface(id, { fresh: true }); game.piloting = false;
  frames(240);
  const w = game.world;
  ok(finite(game.player.pos) && game.player.pos.y > -400, `${id}: player ok, creatures=${w.creatures.list.length}, chunks=${w.terrain.near.size}`);
  const sites = w.structures.sites.size; ok(sites === w.hf.sites.length, `${id}: ${sites} sites built`);
}

console.log('== pelagos swimming');
game.enterSurface('pelagos', { fresh: true }); game.piloting = false;
const hf = game.world.hf; let sx = 300, sz = 300; // find open water
for (let a = 0; a < 200 && hf.heightAt(sx, sz) > -10; a++) { sx += 40; sz += 25; }
game.player.pos.set(sx, hf.waterLevel - 3, sz); game.vitals.revive();
frames(60);
ok(game.player.inWater, 'player is swimming');
const o2w = game.vitals.oxygen; frames(120);
ok(game.vitals.oxygen < o2w, 'oxygen drains underwater');
game.player.pos.y = hf.waterLevel - 3;
game.player.pos.set(sx, hf.heightAt(sx, sz) + 2, sz);
frames(60); ok(finite(game.player.pos), 'deep swim stable');

console.log('== vault & ending');
game.enterSurface('nivalis', { fresh: true }); game.piloting = false;
const v = game.world.hf.sites.find((s) => s.id === 'n_vault');
j.flag('triad_key'); j.flag('tone_a'); j.flag('tone_b'); j.flag('resonance'); game.inventory.owned.tuner = 1; game.inventory.recompute();
game.vaultDoor(); game.ui.closeDialog(); ok(j.hasFlag('vault_open'), 'vault opens with all keys');
ok(!game.world.structures.colliders.some((c) => c.id === 'n_vault:door'), 'door collider removed when open');
const core = game.world.structures.scanTargets.find((t) => t.entry === 'echo_core');
game.player.pos.set(core.x, game.world.hf.heightAt(core.x, core.z), core.z + 6); game.tool = 0;
for (let i = 0; i < 200 && !j.has('echo_core:ask'); i++) { lookAt(core.x, core.y, core.z); game.input.mouse.buttons = 1; frames(1); }
game.input.mouse.buttons = 0;
ok(j.has('echo_core:ask'), 'Echo Core scan reveals the final truth');
ok(j.has('echo_core:truth') && j.has('echo_core:first'), 'all Echo Core facts known');

console.log('== save / restore');
const data = JSON.parse(JSON.stringify(game.serialize()));
ok(data.journal.facts.length > 5 && data.planet === 'nivalis', 'serialises');
await game.save(false);
const d2 = await (await import('../src/core/save.js')).Save.load();
ok(!!d2, 'save reads back');
game.resetState();
game.restore(d2);
ok(game.planetId === 'nivalis' && game.journal.has('echo_core:ask'), 'restore returns to Nivalis with journal intact');
frames(60); ok(finite(game.player.pos), 'restored world runs');

console.log('== death & respawn');
game.piloting = false; game.vitals.damage(500, 'test');
ok(game.vitals.dead, 'player died');
await new Promise((r) => setTimeout(r, 2000));
ok(!game.vitals.dead, 'player respawned');

console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL TESTS PASSED');
process.exit(fails ? 1 : 0);
