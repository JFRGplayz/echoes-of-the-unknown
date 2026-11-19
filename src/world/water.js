import * as THREE from 'three';
import { canvasTex } from '../core/util3d.js';
import { mulberry32 } from '../core/util.js';

// Large animated water plane that follows the camera. Underwater tint is handled by Game via fog swap.
export class Water {
  constructor(scene, level, planet) {
    this.level = level; this.scene = scene;
    const rng = mulberry32(42);
    this.normalMap = canvasTex(256, 256, (ctx, w, h) => {
      ctx.fillStyle = 'rgb(128,128,255)'; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 700; i++) {
        const x = rng() * w, y = rng() * h, r = 3 + rng() * 12;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        const dx = Math.floor(100 + rng() * 56), dy = Math.floor(100 + rng() * 56);
        g.addColorStop(0, `rgba(${dx},${dy},255,0.55)`); g.addColorStop(1, 'rgba(128,128,255,0)');
        ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
    });
    this.normalMap.colorSpace = THREE.NoColorSpace;
    this.normalMap.repeat.set(220, 220);
    const col = planet.id === 'pelagos' ? 0x1b6a8a : 0x2a6a68;
    this.mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.08, metalness: 0.15, transparent: true, opacity: 0.78, normalMap: this.normalMap, normalScale: new THREE.Vector2(0.55, 0.55), depthWrite: false });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000, 1, 1), this.mat);
    this.mesh.rotation.x = -Math.PI / 2; this.mesh.position.y = level; this.mesh.receiveShadow = false; this.mesh.renderOrder = 2;
    scene.add(this.mesh);
    this.t = 0;
  }
  update(dt, camPos, stormI = 0) {
    this.t += dt;
    this.mesh.position.x = camPos.x; this.mesh.position.z = camPos.z;
    // keep texture anchored in world space by offsetting by camera movement
    const k = 220 / 9000;
    this.normalMap.offset.set((camPos.x * k + this.t * 0.0035 * (1 + stormI * 3)) % 1, (-camPos.z * k + this.t * 0.0022) % 1);
    this.mat.normalScale.set(0.45 + stormI * 0.9, 0.45 + stormI * 0.9);
    // surface height with gentle swell (for buoyancy/ship wakes)
  }
  surfaceAt(x, z) { return this.level + Math.sin(x * 0.05 + this.t * 0.8) * 0.12 + Math.cos(z * 0.07 + this.t * 0.6) * 0.1; }
  dispose() { this.scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mat.dispose(); this.normalMap.dispose(); }
}
