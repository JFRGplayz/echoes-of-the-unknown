import * as THREE from 'three';
import { clamp, lerp, dampFactor } from '../core/util.js';
import { mergeParts, propMaterial, geoBox, geoCyl, geoCone, geoSphere, geoTorus } from '../core/util3d.js';
import { fmtDist } from '../core/util.js';

const FWD = new THREE.Vector3(0, 0, -1), UP = new THREE.Vector3(0, 1, 0), RIGHT = new THREE.Vector3(1, 0, 0);
export const SHIP_CLEARANCE = 2.1;     // origin height above ground when landed
const SHIP_RADIUS = 7;

export function buildShipMesh() {
  const g = new THREE.Group();
  const hull = mergeParts([
    { geo: geoCyl(0.9, 1.7, 9, 10), pos: [0, 0, 0], rot: [Math.PI / 2, 0, 0], color: 0xc9ccd4 },
    { geo: geoCone(0.9, 3.4, 10), pos: [0, -0.1, -6.1], rot: [-Math.PI / 2, 0, 0], color: 0xb4b8c2 },
    { geo: geoBox(1.5, 0.5, 2.8), pos: [0, 0.95, -1.3], rot: [0.25, 0, 0], color: 0x2a3a4e },
    { geo: geoBox(11, 0.18, 3.2), pos: [0, -0.1, 1.5], color: 0x9a9eaa },
    { geo: geoBox(0.2, 1.7, 1.8), pos: [-4.8, 0.7, 2.6], color: 0xe0623a }, { geo: geoBox(0.2, 1.7, 1.8), pos: [4.8, 0.7, 2.6], color: 0xe0623a },
    { geo: geoCyl(0.55, 0.65, 3.4, 8), pos: [-2.6, -0.1, 3.3], rot: [Math.PI / 2, 0, 0], color: 0x707480 },
    { geo: geoCyl(0.55, 0.65, 3.4, 8), pos: [2.6, -0.1, 3.3], rot: [Math.PI / 2, 0, 0], color: 0x707480 },
    { geo: geoCyl(0.42, 0.42, 0.3, 8), pos: [-2.6, -0.1, 5.1], rot: [Math.PI / 2, 0, 0], color: 0x66ccff, emissive: true },
    { geo: geoCyl(0.42, 0.42, 0.3, 8), pos: [2.6, -0.1, 5.1], rot: [Math.PI / 2, 0, 0], color: 0x66ccff, emissive: true },
    { geo: geoBox(0.25, 1.4, 0.25), pos: [0, -1.1, -3.4], color: 0x555a66 }, { geo: geoBox(0.25, 1.4, 0.25), pos: [-3.2, -1.1, 3], color: 0x555a66 }, { geo: geoBox(0.25, 1.4, 0.25), pos: [3.2, -1.1, 3], color: 0x555a66 },
    { geo: geoBox(0.9, 0.12, 0.9), pos: [0, -1.8, -3.4], color: 0x444a54 }, { geo: geoBox(0.9, 0.12, 0.9), pos: [-3.2, -1.8, 3], color: 0x444a54 }, { geo: geoBox(0.9, 0.12, 0.9), pos: [3.2, -1.8, 3], color: 0x444a54 },
    { geo: geoBox(1.3, 0.05, 0.5), pos: [0, 0.3, 0.2], color: 0xffb040, emissive: true },
  ]);
  const mesh = new THREE.Mesh(hull, propMaterial({ metalness: 0.5, roughness: 0.4, glowColor: 0xffffff, glowPower: 1.4 }));
  mesh.castShadow = true; mesh.receiveShadow = true;
  g.add(mesh);
  // ship canopy glass
  g.userData.mesh = mesh;
  return g;
}

function makePanel(w, h, px = 256) {
  const c = document.createElement('canvas'); c.width = px; c.height = Math.round(px * h / w);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, fog: false }));
  return { mesh, c, ctx: c.getContext('2d'), tex };
}

export class Ship {
  constructor(game) {
    this.game = game;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.quat = new THREE.Quaternion();
    this.av = new THREE.Vector3();
    this.landed = true; this.cruising = false; this.cruiseSpeed = 0; this.assist = true; this.boosting = false;
    this.fuel = 100; this.hull = 100; this.frame = 'surface';
    this.throttle = 0; this.autoAlign = null; this.alignVec = null;
    this.thrustLevel = 0; this.massLock = false; this.crashT = 0; this.lastImpact = 0;
    this.cockpit = this.buildCockpit();
    this.mesh = buildShipMesh();
    this._pt = 0;
  }

  get stats() { return this.game.stats; }

  buildCockpit() {
    const g = new THREE.Group();
    const dark = new THREE.MeshBasicMaterial({ color: 0x10131a, fog: false });
    const mid = new THREE.MeshBasicMaterial({ color: 0x1b2029, fog: false });
    const accent = new THREE.MeshBasicMaterial({ color: 0x2c8ca8, fog: false });
    const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); g.add(m); return m; };
    add(new THREE.BoxGeometry(2.4, 0.6, 1.0), dark, 0, -0.62, -0.85, -0.35);             // dashboard
    add(new THREE.BoxGeometry(2.4, 0.04, 0.05), accent, 0, -0.385, -0.76);              // accent strip
    add(new THREE.BoxGeometry(0.18, 1.8, 0.2), mid, -1.15, 0.0, -0.8, 0, 0, -0.32);     // left pillar
    add(new THREE.BoxGeometry(0.18, 1.8, 0.2), mid, 1.15, 0.0, -0.8, 0, 0, 0.32);       // right pillar
    add(new THREE.BoxGeometry(2.6, 0.18, 0.5), dark, 0, 0.72, -0.8, 0.25);               // top frame
    add(new THREE.BoxGeometry(0.1, 0.9, 0.12), mid, 0, 0.3, -0.85, 0.1);                 // centre strut (thin)
    add(new THREE.BoxGeometry(1.8, 0.7, 0.5), dark, -1.35, -0.5, -0.1, 0, 0.6);          // side consoles
    add(new THREE.BoxGeometry(1.8, 0.7, 0.5), dark, 1.35, -0.5, -0.1, 0, -0.6);
    // panels
    this.pC = makePanel(0.82, 0.36, 512); this.pC.mesh.position.set(0, -0.35, -0.83); this.pC.mesh.rotation.x = -0.9; g.add(this.pC.mesh);
    this.pL = makePanel(0.5, 0.3, 256); this.pL.mesh.position.set(-0.7, -0.38, -0.75); this.pL.mesh.rotation.set(-0.9, 0.35, 0); g.add(this.pL.mesh);
    this.pR = makePanel(0.5, 0.3, 256); this.pR.mesh.position.set(0.7, -0.38, -0.75); this.pR.mesh.rotation.set(-0.9, -0.35, 0); g.add(this.pR.mesh);
    // flight stick
    const stick = add(new THREE.CylinderGeometry(0.02, 0.03, 0.25, 6), mid, 0.28, -0.44, -0.55); this.stick = stick;
    g.userData.stick = stick;
    return g;
  }

  setFuelHull(fuel, hull) { if (fuel !== undefined) this.fuel = fuel; if (hull !== undefined) this.hull = hull; }

  // Called each frame while the player pilots the ship.
  update(dt, input, env) {
    const st = this.stats, inAtmo = this.frame === 'surface';
    const q = this.quat;
    // ------- rotation (mouse + roll)
    const sens = (this.game.settings.sensitivity || 1) * 0.0021;
    const inv = this.game.settings.invertY ? -1 : 1;
    const locked = input.locked;
    let yawT = locked ? -input.mouse.dx * sens / Math.max(dt, 1 / 120) : 0;
    let pitchT = locked ? -input.mouse.dy * sens * inv / Math.max(dt, 1 / 120) : 0;
    let rollT = ((input.down('KeyQ') ? 1 : 0) - (input.down('KeyE') ? 1 : 0)) * 1.4;
    const lim = this.cruising ? 0.5 : 2.4;
    yawT = clamp(yawT, -lim, lim); pitchT = clamp(pitchT, -lim, lim);
    this.av.x = lerp(this.av.x, pitchT, dampFactor(14, dt)); this.av.y = lerp(this.av.y, yawT, dampFactor(14, dt)); this.av.z = lerp(this.av.z, rollT, dampFactor(6, dt));
    if (this.landed) { this.av.set(0, this.av.y * 0.4, 0); this.av.x = 0; }
    if (this.autoAlign) {
      const want = this.autoAlign();
      if (want) {
        const fw = FWD.clone().applyQuaternion(q);
        const qa = new THREE.Quaternion().setFromUnitVectors(fw, want);
        const ang = 2 * Math.acos(clamp(qa.w, -1, 1));
        if (ang < 0.01 || Math.abs(yawT) > 0.6 || Math.abs(pitchT) > 0.6) { this.autoAlign = null; this.game.events.emit('ship:align-done', ang < 0.02); }
        else { qa.slerp(new THREE.Quaternion(), 1 - Math.min(1, 1.3 * dt / ang)); q.premultiply(qa).normalize(); }
      }
    }
    const dq = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.av.x * dt, this.av.y * dt, this.av.z * dt, 'YXZ'));
    q.multiply(dq).normalize();

    // ------- thrust inputs
    const ix = (input.down('KeyD') ? 1 : 0) - (input.down('KeyA') ? 1 : 0);
    const iy = (input.down('Space') ? 1 : 0) - (input.down('ControlLeft') || input.down('KeyC') ? 1 : 0);
    const iz = (input.down('KeyW') ? 1 : 0) - (input.down('KeyS') ? 1 : 0);
    const wantBoost = input.down('ShiftLeft') && this.fuel > 0.5 && (iz > 0 || this.cruising === false);
    this.boosting = wantBoost && iz > 0;
    const mult = (this.boosting ? 3 : 1) * st.shipSpeed;
    const aBase = inAtmo ? 26 : 34;
    if (input.pressed('KeyZ')) { this.assist = !this.assist; this.game.ui.toast(`Flight assist ${this.assist ? 'ON' : 'OFF'}`); }
    if (input.pressed('KeyV') && !inAtmo) this.toggleCruise();

    const local = new THREE.Vector3(ix * 0.65, iy * 0.65, -iz);
    if (this.cruising) local.set(0, 0, 0);
    const world = local.clone().applyQuaternion(q);
    const acc = world.multiplyScalar(aBase * mult);

    const g = inAtmo ? env.gravity : 0;
    if (this.landed) {
      if (iz > 0 || iy > 0) { this.landed = false; this.vel.y += 1.5; this.game.events.emit('ship:liftoff'); }
      else { this.vel.set(0, 0, 0); this.thrustLevel = 0; this.afterMove(dt, env); return; }
    }

    // gravity & hover
    if (inAtmo) {
      if (this.assist) { /* hover assist cancels gravity */ } else acc.y -= g;
    }
    this.vel.addScaledVector(acc, dt);

    // damping (flight assist) per local axis
    if (this.assist && !this.cruising) {
      const inv = q.clone().invert();
      const vl = this.vel.clone().applyQuaternion(inv);
      if (!ix) vl.x *= Math.exp(-1.8 * dt);
      if (!iy) vl.y *= Math.exp(-(inAtmo ? 2.4 : 1.8) * dt);
      if (!iz) vl.z *= Math.exp(-1.3 * dt);
      this.vel.copy(vl.applyQuaternion(q));
    }
    if (inAtmo) this.vel.multiplyScalar(Math.exp(-0.1 * dt));
    // speed limit
    if (!this.cruising) {
      const vmax = (inAtmo ? 200 : 520) * st.shipSpeed * (this.boosting ? 2.8 : 1);
      const sp = this.vel.length();
      if (sp > vmax) this.vel.multiplyScalar(lerp(1, vmax / sp, dampFactor(4, dt)));
    }

    // cruise
    if (this.cruising) {
      if (this.massLockCheck() || this.fuel <= 0) this.toggleCruise(true);
      else {
        this.cruiseSpeed = lerp(this.cruiseSpeed, st.cruise, dampFactor(0.55, dt));
        const fw = FWD.clone().applyQuaternion(q);
        this.vel.copy(fw.multiplyScalar(this.cruiseSpeed));
        this.fuel -= 1.1 * dt;
      }
    }
    if (this.boosting) this.fuel -= 2.2 * dt;
    this.fuel = clamp(this.fuel, 0, st.fuelMax);
    this.thrustLevel = clamp(Math.abs(iz) + Math.abs(ix) * 0.4 + Math.abs(iy) * 0.4 + (this.boosting ? 1 : 0) + (this.cruising ? 1.5 : 0), 0, 3);

    this.pos.addScaledVector(this.vel, dt);
    this.afterMove(dt, env);
  }

  massLockCheck() {
    const space = this.game.space;
    if (!space) return false;
    const { alt } = space.nearestPlanet(this.pos);
    if (alt < 14000) return true;
    for (const b of space.bodies) if (b.type === 'structure' || b.type === 'station' || b.type === 'field') if (b.pos.distanceTo(this.pos) < (b.radius + 3000)) return true;
    return false;
  }

  toggleCruise(forceOff = false) {
    if (this.cruising || forceOff) {
      this.cruising = false;
      const sp = Math.min(this.vel.length(), 500 * this.stats.shipSpeed);
      if (this.vel.lengthSq() > 0) this.vel.setLength(sp);
      if (forceOff && this.massLockCheck()) this.game.ui.toast('Cruise interrupted: mass lock', 'warn');
      this.game.events.emit('ship:cruise', false);
    } else {
      if (this.frame !== 'space') return;
      if (this.fuel < 5) { this.game.ui.toast('Insufficient fuel for cruise', 'warn'); return; }
      if (this.massLockCheck()) { this.game.ui.toast('Cruise unavailable: mass lock', 'warn'); return; }
      this.cruising = true; this.cruiseSpeed = Math.max(this.vel.length(), 400);
      this.game.events.emit('ship:cruise', true);
    }
  }

  // Ground contact (surface frame) and collisions.
  afterMove(dt, env) {
    if (this.frame === 'surface' && env.groundH) {
      let gh = env.groundH(this.pos.x, this.pos.z);
      const wl = env.waterLevel;
      let onWater = false;
      if (wl !== null && wl !== undefined && gh < wl) { gh = env.waterSurface ? env.waterSurface(this.pos.x, this.pos.z) : wl; onWater = true; }
      const clearance = this.pos.y - gh;
      if (clearance < SHIP_CLEARANCE && !this.landed) {
        const vy = this.vel.y, speed = this.vel.length();
        const upright = UP.clone().applyQuaternion(this.quat).y;
        if (vy < -16 || speed > 34 || upright < 0.55) {
          const dmg = Math.max(4, (Math.max(-vy, speed * 0.5) - 14) * 3.2);
          this.game.events.emit('ship:damage', { amount: dmg, kind: 'crash' });
          this.pos.y = gh + SHIP_CLEARANCE; this.vel.y = Math.abs(vy) * 0.25; this.vel.x *= 0.5; this.vel.z *= 0.5;
        } else if (vy < 0 || speed < 6) {
          if (speed < 16 && upright > 0.7) {
            this.landed = true; this.vel.set(0, 0, 0); this.pos.y = gh + SHIP_CLEARANCE;
            this.game.events.emit('ship:landed', { water: onWater });
          } else { this.pos.y = gh + SHIP_CLEARANCE; if (this.vel.y < 0) this.vel.y = 0; }
        }
      }
      if (this.landed) {
        // settle onto the terrain: align up-vector with ground normal, keep yaw
        this.pos.y += (gh + SHIP_CLEARANCE - this.pos.y) * Math.min(1, dt * 6);
        if (env.groundNormal && !onWater) {
          const n = env.groundNormal(this.pos.x, this.pos.z);
          const nv = new THREE.Vector3(n[0], n[1], n[2]);
          const up = UP.clone().applyQuaternion(this.quat);
          const qa = new THREE.Quaternion().setFromUnitVectors(up, nv);
          qa.slerp(new THREE.Quaternion(), 1 - Math.min(1, dt * 2));
          this.quat.premultiply(qa).normalize();
        }
      }
      // keep level when assist is on and no roll input
      if (!this.landed && this.assist && env.autoLevel) {
        const up = UP.clone().applyQuaternion(this.quat);
        const fw = FWD.clone().applyQuaternion(this.quat);
        // roll back to horizon
        const right = RIGHT.clone().applyQuaternion(this.quat);
        const roll = Math.asin(clamp(right.y, -1, 1));
        const k = dampFactor(1.2, dt) * (Math.abs(this.av.z) < 0.05 ? 1 : 0);
        const dq = new THREE.Quaternion().setFromAxisAngle(fw, roll * k);
        this.quat.premultiply(dq).normalize();
      }
    }
  }

  damage(amount) {
    this.hull = Math.max(0, this.hull - amount);
    this.game.events.emit('ship:hit', amount);
  }

  // Dashboard displays (throttled).
  drawCockpit(dt, info) {
    this._pt -= dt; if (this._pt > 0) return; this._pt = 0.12;
    const draw = (p, fn) => { const ctx = p.ctx, w = p.c.width, h = p.c.height; ctx.fillStyle = '#04090e'; ctx.fillRect(0, 0, w, h); fn(ctx, w, h); p.tex.needsUpdate = true; };
    const col = '#7fe8e0', dim = '#2a6a72', warn = '#ff8a40';
    draw(this.pC, (c, w, h) => {
      c.fillStyle = col; c.font = 'bold 54px monospace'; c.textAlign = 'center';
      c.fillText(Math.round(info.speed) + ' m/s', w / 2, 72);
      c.font = '28px monospace'; c.fillStyle = dim;
      c.fillText(info.mode, w / 2, 112);
      c.font = '34px monospace'; c.fillStyle = col; c.textAlign = 'left';
      c.fillText('ALT ' + info.alt, 22, 168); c.fillText('FUEL ' + Math.round(info.fuel) + '%', 22, 212);
      c.textAlign = 'right'; c.fillText(info.assist ? 'ASSIST' : 'MANUAL', w - 22, 168);
      c.fillStyle = info.cruise ? warn : dim; c.fillText(info.cruise ? 'CRUISE' : (info.boost ? 'BOOST' : 'IDLE'), w - 22, 212);
    });
    draw(this.pL, (c, w, h) => {
      c.fillStyle = col; c.font = 'bold 26px monospace'; c.textAlign = 'left'; c.fillText('HULL', 14, 34);
      c.fillStyle = '#12303a'; c.fillRect(14, 44, w - 28, 24); c.fillStyle = info.hull < 30 ? warn : col; c.fillRect(14, 44, (w - 28) * info.hull / 100, 24);
      c.fillStyle = col; c.fillText('THRUST', 14, 106); c.fillStyle = '#12303a'; c.fillRect(14, 116, w - 28, 24); c.fillStyle = col; c.fillRect(14, 116, (w - 28) * clamp(info.thrust / 2, 0, 1), 24);
      c.font = '22px monospace'; c.fillStyle = dim; c.fillText(info.frame.toUpperCase(), 14, 178);
    });
    draw(this.pR, (c, w, h) => {
      c.fillStyle = col; c.font = 'bold 24px monospace'; c.textAlign = 'left'; c.fillText('NAV', 14, 32);
      c.font = '22px monospace'; c.fillStyle = col;
      c.fillText(info.navName.slice(0, 16), 14, 70); c.fillStyle = dim; c.fillText(info.navDist, 14, 100);
      c.fillStyle = info.hostile ? warn : dim; c.fillText(info.hostile ? '! HOSTILES' : 'NO CONTACTS', 14, 150);
    });
  }
}
