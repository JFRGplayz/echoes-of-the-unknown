import * as THREE from 'three';
import { clamp, smoothstep, hash2 } from '../core/util.js';
import { detailTexture } from '../core/util3d.js';

const NEAR = 128, NEAR_RES = 32;   // 4 m grid
const FAR = 512, FAR_RES = 32;     // 16 m grid

// Streams terrain chunks around a focus point in two LOD rings.
export class TerrainStreamer {
  constructor(scene, hf, quality) {
    this.scene = scene; this.hf = hf; this.p = hf.p; this.q = quality;
    this.near = new Map(); this.far = new Map();
    this.nearRadius = 3; this.farRadius = quality.farTerrain ? 4 : 2;
    this.group = new THREE.Group(); scene.add(this.group);
    this.detail = detailTexture(this.p.seed);
    this.detail.repeat.set(1, 1);
    this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, map: this.detail });
    this.mat.userData.shared = true;
    const pal = this.p.palette;
    this.cLow = new THREE.Color(pal.low); this.cMid = new THREE.Color(pal.mid); this.cHigh = new THREE.Color(pal.high); this.cRock = new THREE.Color(pal.rock);
    this.onChunkAdd = null; this.onChunkRemove = null;
    this.queue = [];
    this._last = '';
  }

  colorAt(h, slope, x, z, out) {
    const pal = this.p.palette, tt = this.p.terrainType;
    const c = out;
    const lowC = this.cLow, midC = this.cMid, highC = this.cHigh, rockC = this.cRock;
    const n = this.hf.n.fbm(x / 35, z / 35, 2) * 0.5 + 0.5;
    const wl = this.p.waterLevel;
    let t;
    if (tt === 'archipelago') {
      // seabed -> sand -> grass
      if (h < -2) c.copy(lowC).multiplyScalar(0.55 + 0.45 * smoothstep(-120, -2, h));
      else { t = smoothstep(2, 14, h); c.copy(midC).lerp(highC, t); }
    } else if (tt === 'jungle') {
      t = smoothstep(wl - 4, wl + 40, h);
      c.copy(lowC).lerp(midC, t).lerp(highC, smoothstep(55, 75, h + n * 8));
      if (h < wl + 1.2) c.copy(rockC).multiplyScalar(0.8);
    } else if (tt === 'glacier') {
      t = smoothstep(25, 80, h + n * 8);
      c.copy(lowC).lerp(midC, t).lerp(highC, smoothstep(0.5, 1, t));
    } else { // canyon strata banding
      const band = 0.5 + 0.5 * Math.sin(h * 0.55 + n * 1.6);
      t = smoothstep(0, 100, h);
      c.copy(lowC).lerp(midC, t).lerp(highC, band * 0.55 * t + (n - 0.5) * 0.2);
    }
    const rock = smoothstep(0.55, 1.15, slope);
    c.lerp(rockC, rock * (tt === 'glacier' ? 0.7 : 0.9));
    const v = 0.9 + 0.2 * n;
    c.multiplyScalar(v);
    return c;
  }

  buildChunk(cx, cz, size, res, yOffset = 0) {
    const hf = this.hf, step = size / res, x0 = cx * size, z0 = cz * size;
    const n = (res + 1) * (res + 1);
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    const c = new THREE.Color();
    const nn = [0, 1, 0];
    let k = 0;
    for (let j = 0; j <= res; j++) for (let i = 0; i <= res; i++, k++) {
      const wx = x0 + i * step, wz = z0 + j * step;
      const h = hf.heightAt(wx, wz);
      hf.normalAt(wx, wz, nn, step * 0.75);
      pos[k * 3] = wx; pos[k * 3 + 1] = h + yOffset; pos[k * 3 + 2] = wz;
      nor[k * 3] = nn[0]; nor[k * 3 + 1] = nn[1]; nor[k * 3 + 2] = nn[2];
      this.colorAt(h, Math.sqrt(Math.max(0, 1 - nn[1] * nn[1])) / Math.max(0.05, nn[1]), wx, wz, c);
      col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
      uv[k * 2] = wx / 9; uv[k * 2 + 1] = wz / 9;
    }
    const idx = new Uint32Array(res * res * 6);
    let t = 0;
    for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) {
      const a = j * (res + 1) + i, b = a + 1, d = a + res + 1, e = d + 1;
      idx[t++] = a; idx[t++] = d; idx[t++] = b; idx[t++] = b; idx[t++] = d; idx[t++] = e;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, this.mat);
    m.receiveShadow = true; m.castShadow = false;
    return m;
  }

  _insideNear(cx, cz, fx, fz) {
    // far chunk is redundant if the whole chunk lies inside the near ring
    const half = (this.nearRadius + 0.5) * NEAR;
    const x0 = cx * FAR, z0 = cz * FAR;
    const ncx = Math.floor(fx / NEAR) * NEAR + NEAR / 2, ncz = Math.floor(fz / NEAR) * NEAR + NEAR / 2;
    return x0 >= ncx - half && x0 + FAR <= ncx + half && z0 >= ncz - half && z0 + FAR <= ncz + half;
  }

  update(fx, fz, budget = 2) {
    const ncx = Math.floor(fx / NEAR), ncz = Math.floor(fz / NEAR);
    const fcx = Math.floor(fx / FAR), fcz = Math.floor(fz / FAR);
    const key = `${ncx},${ncz}`;
    if (key !== this._last) {
      this._last = key;
      this.queue.length = 0;
      const want = new Set();
      for (let j = -this.nearRadius; j <= this.nearRadius; j++) for (let i = -this.nearRadius; i <= this.nearRadius; i++) {
        const cx = ncx + i, cz = ncz + j, k = `${cx},${cz}`; want.add(k);
        if (!this.near.has(k)) this.queue.push({ t: 'n', cx, cz, k, d: i * i + j * j });
      }
      for (const [k, ch] of this.near) if (!want.has(k)) {
        this.group.remove(ch.mesh); ch.mesh.geometry.dispose(); this.near.delete(k); this.onChunkRemove?.(ch);
      }
      const fwant = new Set();
      for (let j = -this.farRadius; j <= this.farRadius; j++) for (let i = -this.farRadius; i <= this.farRadius; i++) {
        const cx = fcx + i, cz = fcz + j, k = `${cx},${cz}`;
        if (this._insideNear(cx, cz, fx, fz)) continue;
        fwant.add(k);
        if (!this.far.has(k)) this.queue.push({ t: 'f', cx, cz, k, d: 1000 + i * i + j * j });
      }
      for (const [k, ch] of this.far) if (!fwant.has(k)) { this.group.remove(ch.mesh); ch.mesh.geometry.dispose(); this.far.delete(k); }
      this.queue.sort((a, b) => b.d - a.d);
    }
    for (let n = 0; n < budget && this.queue.length; n++) {
      const job = this.queue.pop();
      if (job.t === 'n') {
        if (this.near.has(job.k)) continue;
        const mesh = this.buildChunk(job.cx, job.cz, NEAR, NEAR_RES);
        this.group.add(mesh);
        const ch = { cx: job.cx, cz: job.cz, mesh, size: NEAR, key: job.k };
        this.near.set(job.k, ch);
        this.onChunkAdd?.(ch);
      } else {
        if (this.far.has(job.k)) continue;
        const mesh = this.buildChunk(job.cx, job.cz, FAR, FAR_RES, -2.5);
        this.group.add(mesh);
        this.far.set(job.k, { cx: job.cx, cz: job.cz, mesh });
      }
    }
  }

  // Build everything near the focus immediately (used on arrival so the player never sees a void).
  prime(fx, fz) {
    this._last = '';
    this.update(fx, fz, 0);
    let guard = 0;
    while (this.queue.length && guard++ < 400) {
      const before = this.queue.length;
      this.update(fx, fz, 8);
      if (this.queue.length === before) break;
    }
  }

  dispose() {
    for (const ch of this.near.values()) { ch.mesh.geometry.dispose(); }
    for (const ch of this.far.values()) { ch.mesh.geometry.dispose(); }
    this.scene.remove(this.group);
    this.detail.dispose(); this.mat.dispose();
  }
}

export const CHUNK_SIZE = NEAR;
