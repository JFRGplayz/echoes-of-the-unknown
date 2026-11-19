import * as THREE from 'three';
import { clamp, lerp, dampFactor } from '../core/util.js';

const EYE = 1.72;

// First-person on-foot controller: walking, sprint, jetpack, swimming, collisions.
export class Player {
  constructor(game) {
    this.game = game;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.onGround = false; this.inWater = false; this.underwater = false; this.depth = 0; this.headDepth = 0;
    this.jetting = false; this.sprinting = false; this.stepT = 0; this.bob = 0;
    this.fallSpeed = 0; this.sheltered = false;
    this.moving = false; this.speed = 0;
  }

  get eyeHeight() { return EYE; }
  eyePos(out = new THREE.Vector3()) { return out.set(this.pos.x, this.pos.y + EYE + Math.sin(this.bob) * 0.035 * (this.onGround ? this.speed / 5 : 0), this.pos.z); }

  update(dt, input, env, canAct = true) {
    const g = env.gravity, st = this.game.stats;
    // look
    if (input.locked && canAct) {
      const sens = 0.0022 * (this.game.settings.sensitivity || 1);
      this.yaw -= input.mouse.dx * sens;
      this.pitch -= input.mouse.dy * sens * (this.game.settings.invertY ? -1 : 1);
      this.pitch = clamp(this.pitch, -1.5, 1.5);
    }
    const hf = env.hf;
    const ground = hf.heightAt(this.pos.x, this.pos.z);
    const wl = hf.waterLevel;
    const feetDepth = wl !== null ? wl - this.pos.y : -1;
    const headDepth = wl !== null ? wl - (this.pos.y + EYE) : -1;
    this.inWater = feetDepth > 0.5 && ground < wl - 0.3;
    this.underwater = headDepth > 0;
    this.headDepth = Math.max(0, headDepth);
    this.depth = Math.max(0, feetDepth);

    // wish direction
    let fx = (input.down('KeyW') ? 1 : 0) - (input.down('KeyS') ? 1 : 0);
    let sx = (input.down('KeyD') ? 1 : 0) - (input.down('KeyA') ? 1 : 0);
    if (!canAct) { fx = 0; sx = 0; }
    const sinY = Math.sin(this.yaw), cosY = Math.cos(this.yaw);
    // forward in world = (-sin, -cos) with yaw about Y; right = (cos, -sin)
    let wx = -sinY * fx + cosY * sx, wz = -cosY * fx - sinY * sx;
    const wl2 = Math.hypot(wx, wz); if (wl2 > 1) { wx /= wl2; wz /= wl2; }
    this.moving = wl2 > 0.01;
    const energy = this.game.vitals.energy;
    this.sprinting = input.down('ShiftLeft') && this.moving && fx > 0 && !this.inWater && canAct;
    const jetMul = st.jet;

    if (this.inWater && this.depth > 1.2) {
      // swimming: full 3D movement
      const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
      const f3x = -sinY * cp, f3y = sp, f3z = -cosY * cp;
      let tx = f3x * fx + cosY * sx, ty = f3y * fx, tz = f3z * fx - sinY * sx;
      if (canAct) { ty += (input.down('Space') ? 1 : 0) - (input.down('ControlLeft') || input.down('KeyC') ? 1 : 0); }
      const sw = this.sprinting ? 4.6 : 3.2;
      const acc = Math.min(1, dampFactor(4, dt));
      this.vel.x = lerp(this.vel.x, tx * sw, acc); this.vel.y = lerp(this.vel.y, ty * sw + (Math.abs(ty) < 0.05 ? -0.15 : 0), acc); this.vel.z = lerp(this.vel.z, tz * sw, acc);
      // surface: can't leave the water upward by swimming
      if (this.pos.y + 1.3 > wl && this.vel.y > 0) { this.vel.y = Math.min(this.vel.y, Math.max(0, (wl - (this.pos.y + 1.3)) * 3)); }
      this.onGround = false; this.jetting = false;
    } else {
      const speed = this.sprinting ? 8.2 : 4.6;
      const target = new THREE.Vector3(wx * speed * (this.inWater ? 0.55 : 1), 0, wz * speed * (this.inWater ? 0.55 : 1));
      const acc = this.onGround ? dampFactor(10, dt) : dampFactor(1.6, dt);
      this.vel.x = lerp(this.vel.x, target.x, acc); this.vel.z = lerp(this.vel.z, target.z, acc);
      // jump / jetpack
      this.jetting = false;
      if (canAct && input.down('Space')) {
        if (this.onGround && !this.jumpHeld) { this.vel.y = 4.3 + (jetMul - 1) * 0.5; this.onGround = false; this.game.events.emit('player:jump'); }
        else if (!this.onGround && energy > 0.5 && this.vel.y < 9 * jetMul) {
          this.vel.y += (13 + 8 * jetMul) * dt; this.jetting = true;
          this.game.vitals.useEnergy(15 * dt);
          this.vel.x += wx * 6 * jetMul * dt; this.vel.z += wz * 6 * jetMul * dt;
        }
      }
      this.jumpHeld = input.down('Space');
      this.vel.y -= g * dt * (this.inWater ? 0.35 : 1);
      if (this.inWater) { this.vel.y *= Math.exp(-1.5 * dt); }
    }

    // integrate with step/cliff handling
    const nx = this.pos.x + this.vel.x * dt, nz = this.pos.z + this.vel.z * dt;
    const nGround = hf.heightAt(nx, nz);
    const stepLimit = this.onGround || this.pos.y - ground < 0.4 ? 1.05 : 0.2;
    if (nGround - this.pos.y > stepLimit && this.pos.y - ground < 0.8) {
      // blocked by a steep rise; slide along it
      const gx = hf.heightAt(this.pos.x + this.vel.x * dt, this.pos.z), gz = hf.heightAt(this.pos.x, this.pos.z + this.vel.z * dt);
      if (gx - this.pos.y <= stepLimit) this.pos.x = nx; else this.vel.x = 0;
      if (gz - this.pos.y <= stepLimit) this.pos.z = nz; else this.vel.z = 0;
    } else { this.pos.x = nx; this.pos.z = nz; }
    // obstacle push-out
    const push = env.pushOut(this.pos.x, this.pos.z);
    this.pos.x += push[0]; this.pos.z += push[1];
    this.pos.y += this.vel.y * dt;

    const gh = hf.heightAt(this.pos.x, this.pos.z);
    this.fallSpeed = Math.max(this.fallSpeed, -this.vel.y);
    if (this.pos.y <= gh) {
      if (!this.onGround && this.fallSpeed > 13 && !this.inWater) {
        this.game.events.emit('player:damage', { amount: (this.fallSpeed - 13) * 4.5, kind: 'fall' });
      }
      if (!this.onGround && this.fallSpeed > 3) this.game.events.emit('player:land', { speed: this.fallSpeed });
      this.pos.y = gh; if (this.vel.y < 0) this.vel.y = 0; this.onGround = true; this.fallSpeed = 0;
    } else if (this.pos.y - gh > 0.15) { this.onGround = false; if (this.vel.y > 0) this.fallSpeed = 0; }
    else if (this.vel.y <= 0) { this.onGround = true; this.pos.y = gh; }
    if (!this.onGround && this.vel.y > 0) this.fallSpeed = 0;
    // floor in deep water can't be passed
    this.speed = Math.hypot(this.vel.x, this.vel.z);
    // footsteps
    if (this.onGround && this.moving && !this.inWater) {
      this.bob += dt * (this.sprinting ? 11 : 8);
      this.stepT -= dt * (this.sprinting ? 2.6 : 1.9) * 1.0;
      if (this.stepT <= 0) { this.stepT = 1; this.game.events.emit('player:step', { sprint: this.sprinting }); }
    }
  }
}
