import * as THREE from 'three';
import { mergeParts, propMaterial, geoBox, geoCyl, geoCone, geoSphere, geoTorus, geoIco, rockGeo, glowSprite } from '../core/util3d.js';
import { mulberry32, TAU } from '../core/util.js';

const alloy = () => propMaterial({ metalness: 0.65, roughness: 0.32, glowColor: 0xa27bff, glowPower: 1.8 });
const rockMat = () => propMaterial({ roughness: 0.95, flat: true });
const hullMat = () => propMaterial({ metalness: 0.4, roughness: 0.55, glowColor: 0xffb060, glowPower: 1.2 });

const Y = new THREE.Vector3(0, 1, 0);
// A cylinder limb from point a to point b.
function limb(a, b, r0, r1, color, emissive) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const d = B.clone().sub(A), len = d.length();
  const q = new THREE.Quaternion().setFromUnitVectors(Y, d.clone().normalize());
  const e = new THREE.Euler().setFromQuaternion(q);
  const m = A.clone().add(B).multiplyScalar(0.5);
  return { geo: geoCyl(r1, r0, len, 7), pos: [m.x, m.y, m.z], rot: [e.x, e.y, e.z], color, emissive };
}

function triadSpire(h = 28, base = 9, ringR = 2.6, colors = {}) {
  const c = colors.main ?? 0x6f6a82, g = colors.glow ?? 0xa27bff;
  const parts = [
    { geo: geoCyl(base + 2, base + 3.5, 1.6, 3), pos: [0, 0.8, 0], rot: [0, 0.5, 0], color: 0x4a465a },
    { geo: geoCyl(1.1, 1.6, h, 8), pos: [0, h / 2, 0], color: 0x59556c },
  ];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + 0.5;
    const bx = Math.cos(a) * base, bz = Math.sin(a) * base;
    const tx = Math.cos(a) * ringR, tz = Math.sin(a) * ringR;
    parts.push(limb([bx, 1.2, bz], [tx, h * 0.92, tz], 0.9, 0.35, c));
    parts.push({ geo: geoSphere(0.5, 6, 4), pos: [bx * 0.55 + tx * 0.45, h * 0.46, bz * 0.55 + tz * 0.45], color: g, emissive: true });
  }
  parts.push({ geo: geoTorus(ringR, 0.38, 6, 20), pos: [0, h * 0.92, 0], rot: [Math.PI / 2, 0, 0], color: g, emissive: true });
  parts.push({ geo: geoTorus(1.6, 0.25, 6, 16), pos: [0, h * 0.55, 0], rot: [Math.PI / 2, 0, 0], color: g, emissive: true });
  parts.push({ geo: geoTorus(1.9, 0.25, 6, 16), pos: [0, h * 0.2, 0], rot: [Math.PI / 2, 0, 0], color: g, emissive: true });
  // inscription band: a bright strip at the front
  parts.push({ geo: geoBox(6, 1.4, 0.3), pos: [0, 2.2, base * 0.8 + 0.8], color: 0x3a3650 });
  for (let i = 0; i < 9; i++) parts.push({ geo: geoBox(0.35, 0.8, 0.1), pos: [-2.6 + i * 0.65, 2.2, base * 0.8 + 1], color: g, emissive: true });
  return parts;
}

function rockRing(rng, n, r, h, color, jitter = 0.3, arc = TAU, start = 0) {
  const parts = [];
  for (let i = 0; i < n; i++) {
    const a = start + (i / n) * arc, s = h * (0.7 + rng() * 0.6);
    parts.push({ geo: rockGeo(Math.floor(rng() * 1e6), 1, 1, 0.9, 0.3), pos: [Math.cos(a) * r * (1 + (rng() - 0.5) * jitter), s * 0.3, Math.sin(a) * r * (1 + (rng() - 0.5) * jitter)], scale: [s, s, s], rot: [0, rng() * TAU, 0], color });
  }
  return parts;
}

export class Structures {
  constructor(scene, hf, flora, quality) {
    this.scene = scene; this.hf = hf; this.flora = flora; this.q = quality;
    this.group = new THREE.Group(); scene.add(this.group);
    this.sites = new Map();
    this.colliders = []; // {x,z,r,y0,y1}
    this.scanTargets = []; this.logs = []; this.digs = []; this.siteNodes = [];
    this.animated = [];
    this.alloyMat = alloy(); this.rockMat = rockMat(); this.hullMat = hullMat();
    this.vaultDoor = null;
    for (const s of hf.sites) this.build(s);
  }

  add(group, site, parts, mat, cast = true) {
    const m = new THREE.Mesh(mergeParts(parts), mat);
    m.castShadow = cast && this.q.shadow; m.receiveShadow = true;
    group.add(m); return m;
  }

  build(s) {
    const g = new THREE.Group();
    g.position.set(s.x, s.y, s.z);
    const rng = mulberry32(s.x * 7 + s.z * 13 + 1);
    const T = s.type;
    const A = this.alloyMat, R = this.rockMat, H = this.hullMat;
    const col = (r) => this.colliders.push({ x: s.x, z: s.z, r, id: s.id });
    const light = (color, intensity, dist, pos) => {
      const l = new THREE.PointLight(color, intensity, dist, 1.6); l.position.set(...pos); g.add(l); return l;
    };

    switch (T) {
      case 'pad': {
        const parts = [{ geo: geoCyl(14, 14.6, 0.5, 24), pos: [0, 0.1, 0], color: 0x3a3d48 }, { geo: geoTorus(11.5, 0.18, 4, 32), pos: [0, 0.4, 0], rot: [Math.PI / 2, 0, 0], color: 0xffc060, emissive: true }];
        for (let i = 0; i < 8; i++) parts.push({ geo: geoBox(0.5, 0.3, 0.5), pos: [Math.cos(i * 0.785) * 13, 0.45, Math.sin(i * 0.785) * 13], color: 0x66ffcc, emissive: true });
        this.add(g, s, parts, H, false);
        break;
      }
      case 'station': {
        const parts = [];
        [[-9, 0, 0, 0], [0, 0, 0, 0], [9, 0, 0, 0]].forEach(([x], i) => {
          parts.push({ geo: geoCyl(3, 3, 8, 10), pos: [x, 3, 0], rot: [0, 0, Math.PI / 2], color: i === 1 ? 0xc8c0b0 : 0xb0a898 });
          parts.push({ geo: geoSphere(3, 10, 6), pos: [x + (i === 1 ? 4 : 4), 3, 0], scale: [0.5, 1, 1], color: 0xa89f90 });
          parts.push({ geo: geoBox(1.4, 0.2, 1), pos: [x, 3, 3.1], color: 0x66ccff, emissive: true });
        });
        parts.push(limb([-16, 0, -4], [-16, 14, -4], 0.25, 0.12, 0x888888));
        parts.push({ geo: geoTorus(1.2, 0.08, 4, 12), pos: [-16, 13, -4], rot: [0.3, 0.6, 0], color: 0xbbbbbb });
        // dust drift on the leeward side and a toppled crate stack
        parts.push({ geo: geoBox(1.5, 1, 1.5), pos: [4, 0.5, 8], rot: [0, 0.4, 0], color: 0x6a5a40 }, { geo: geoBox(1.2, 0.9, 1.2), pos: [5.4, 0.45, 8.6], rot: [0, 0.1, 0.2], color: 0x6a4a30 });
        this.add(g, s, parts, H);
        light(0xffe0a0, 0.6, 40, [0, 5, 6]);
        col(4);
        break;
      }
      case 'wreck': {
        const parts = [
          { geo: geoCone(2.2, 6, 8), pos: [0, 2.4, 0], rot: [0.9, 0, 0.2], color: 0xb8b0a0 },
          { geo: geoCyl(2.2, 2.6, 3, 8), pos: [0, 4.4, -2.6], rot: [0.9, 0, 0.2], color: 0xa8a090 },
          { geo: geoBox(5, 0.2, 2), pos: [3.8, 2, -1], rot: [0.2, 0.3, -0.5], color: 0x7a7a80 },
          { geo: geoBox(4, 0.2, 2), pos: [-3.6, 1, 1], rot: [0.1, -0.3, 0.3], color: 0x7a7a80 },
          { geo: geoBox(1.4, 0.15, 1), pos: [0, 1, 2.8], color: 0xff6a30, emissive: true },
        ];
        for (let i = 0; i < 6; i++) parts.push({ geo: geoBox(0.4 + rng(), 0.12, 0.4 + rng()), pos: [(rng() - 0.5) * 14, 0.1, (rng() - 0.5) * 14], rot: [0, rng() * 3, 0], color: 0x8a8a8a });
        this.add(g, s, parts, H);
        col(3.5);
        break;
      }
      case 'pylon': {
        this.add(g, s, triadSpire(30, 9, 2.7), A);
        light(0xa27bff, 1.2, 70, [0, 6, 0]);
        col(10);
        this.pulse(g, 0xa27bff, [0, 28, 0], 4);
        // a smaller emitter machine beside the pylon (the Resonance Node)
        const mp = [{ geo: geoBox(3, 2.2, 2.4), pos: [-8, 1.1, 6], color: 0x4a465a }, { geo: geoSphere(0.9, 8, 6), pos: [-8, 2.9, 6], color: 0xa27bff, emissive: true }];
        this.add(g, s, mp, A);
        break;
      }
      case 'spire': {
        const parts = triadSpire(26, 8, 2.4, { main: 0x4a5a4a, glow: 0x6affea });
        for (let i = 0; i < 12; i++) { // roots and moss
          const a = rng() * TAU, r = 3 + rng() * 8;
          parts.push(limb([Math.cos(a) * r, 0, Math.sin(a) * r], [Math.cos(a) * (r * 0.4), 4 + rng() * 10, Math.sin(a) * (r * 0.4)], 0.5, 0.15, 0x4a3a30));
        }
        for (let i = 0; i < 8; i++) parts.push({ geo: geoIco(1.8 + rng() * 1.4, 1), pos: [(rng() - 0.5) * 14, 2 + rng() * 10, (rng() - 0.5) * 14], scale: [1, 0.55, 1], color: 0x2f8a5c });
        this.add(g, s, parts, A);
        light(0x6affea, 0.9, 50, [0, 5, 0]);
        col(9);
        break;
      }
      case 'arch': {
        const parts = [];
        for (let k = 0; k < 3; k++) {
          const rotY = (k / 3) * Math.PI;
          // half-torus spans meeting at the apex
          const tor = new THREE.TorusGeometry(24, 1.6, 8, 28, Math.PI);
          const m = new THREE.Matrix4().makeRotationY(rotY);
          tor.applyMatrix4(m);
          parts.push({ geo: tor, pos: [0, -4, 0], color: 0x6f6a82 });
        }
        parts.push({ geo: geoSphere(3.4, 12, 8), pos: [0, 20.5, 0], color: 0xa27bff, emissive: true });
        parts.push({ geo: geoBox(7, 1.6, 0.4), pos: [0, 2.2, 10], color: 0x3a3650 });
        for (let i = 0; i < 10; i++) parts.push({ geo: geoBox(0.36, 0.9, 0.1), pos: [-3 + i * 0.66, 2.2, 10.3], color: 0xa27bff, emissive: true });
        parts.push({ geo: geoSphere(1.2, 8, 6), pos: [0, 1.4, -5], color: 0xa27bff, emissive: true });
        this.add(g, s, parts, A);
        light(0x9ad0ff, 1.6, 90, [0, 12, 0]);
        this.pulse(g, 0x9ad0ff, [0, 21, 0], 7, 41);
        col(6);
        // ice drift around the base
        this.add(g, s, rockRing(rng, 14, 28, 5, 0xe0efff, 0.3), this.rockMat);
        break;
      }
      case 'cavern': case 'icecave': {
        const ice = T === 'icecave';
        const c = ice ? 0xb8d8f0 : 0x7a4a38;
        const parts = rockRing(rng, 16, 22, 9, c, 0.15, Math.PI * 1.55, Math.PI * 0.72 + 0.25); // open toward +z
        parts.push(...rockRing(rng, 8, 16, 11, c, 0.2, Math.PI * 1.4, Math.PI * 0.8 + 0.3));
        // roof slabs
        for (let i = 0; i < 9; i++) {
          const a = Math.PI * 1.0 + (i / 9) * Math.PI * 1.0 - 0.2;
          parts.push({ geo: rockGeo(i * 31 + 7, 1, 1, 0.45, 0.25), pos: [Math.cos(a) * 9, 10.5 + rng() * 2, Math.sin(a) * 9 - 6], scale: [10, 5, 10], color: c });
        }
        parts.push({ geo: rockGeo(991, 1, 1, 0.5, 0.2), pos: [0, 11.5, -12], scale: [14, 5, 12], color: c });
        const mat = ice ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.18, metalness: 0.1, flatShading: true }) : R;
        this.add(g, s, parts, mat);
        // crystals
        const cr = [];
        for (let i = 0; i < 22; i++) {
          const a = rng() * TAU, r = 3 + rng() * 11, h = 1 + rng() * 3.5;
          cr.push({ geo: geoCone(0.35 + rng() * 0.3, h, 5), pos: [Math.cos(a) * r, h / 2, Math.sin(a) * r - 7], rot: [(rng() - 0.5) * 0.5, 0, (rng() - 0.5) * 0.5], color: ice ? 0x9ad8ff : 0xa27bff, emissive: true });
        }
        this.add(g, s, cr, A, false);
        light(ice ? 0x7fd8ff : 0xa27bff, 1.5, 36, [0, 4, -8]);
        light(ice ? 0x9ad8ff : 0xc09bff, 0.8, 30, [0, 3, 6]);
        col(0.01);
        this.colliders.pop();
        break;
      }
      case 'vault': {
        // Dome with a facade wall at the front. The door gap is 10 m wide; the door slides up when opened.
        const dome = [
          { geo: geoSphere(30, 24, 12), pos: [0, -1, -22], scale: [1, 0.62, 1], color: 0x3a3650 },
          { geo: geoBox(7, 20, 4), pos: [-8.5, 10, 8.5], color: 0x4a465a },
          { geo: geoBox(7, 20, 4), pos: [8.5, 10, 8.5], color: 0x4a465a },
          { geo: geoBox(26, 6, 4), pos: [0, 17, 8.5], color: 0x4a465a },
          { geo: geoTorus(6.2, 0.45, 6, 24, Math.PI), pos: [0, 12.2, 10.6], color: 0xa27bff, emissive: true },
        ];
        for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU + Math.PI / 2; dome.push({ geo: geoSphere(0.9, 8, 6), pos: [Math.cos(a) * 2.4, 15.5 + Math.sin(a) * 1.2, 10.8], color: 0xa27bff, emissive: true }); }
        const domeMat = propMaterial({ metalness: 0.65, roughness: 0.32, glowColor: 0xa27bff, glowPower: 1.8, side: THREE.DoubleSide });
        this.add(g, s, dome, domeMat);
        const doorGeo = mergeParts([{ geo: geoBox(10, 12, 1.4), pos: [0, 6, 0], color: 0x5a5670 }, { geo: geoBox(1, 9, 0.2), pos: [0, 6, 0.8], color: 0xa27bff, emissive: true }]);
        const door = new THREE.Mesh(doorGeo, A); door.position.set(0, 0, 8.5); g.add(door); this.vaultDoor = door;
        this.vaultDoorSite = s;
        // interior core and floor glow
        const core = new THREE.Mesh(mergeParts([{ geo: geoSphere(3, 16, 12), pos: [0, 5, 0], color: 0xa27bff, emissive: true }, { geo: geoTorus(4.6, 0.25, 6, 28), pos: [0, 5, 0], color: 0xbfa6ff, emissive: true }]), A);
        core.position.set(0, 1, -30); g.add(core); this.animated.push((t) => { core.rotation.y = t * 0.4; });
        const vl = new THREE.PointLight(0xa27bff, 0, 70, 1.4); vl.position.set(0, 8, -24); g.add(vl); this.vaultLight = vl;
        // wall colliders around the dome (the door arc stays open, the door itself is a separate blocker)
        for (let i = 0; i < 22; i++) {
          const a = (i / 22) * TAU; const cx = Math.sin(a) * 29.5, cz = -22 + Math.cos(a) * 29.5;
          if (cz > -4 && Math.abs(cx) < 9) continue;
          this.colliders.push({ x: s.x + cx, z: s.z + cz, r: 4.2, id: s.id + ':wall' });
        }
        this.colliders.push({ x: s.x - 8.5, z: s.z + 8.5, r: 3.6, id: s.id + ':jamb' }, { x: s.x + 8.5, z: s.z + 8.5, r: 3.6, id: s.id + ':jamb' });
        this.vaultBlock = { x: s.x, z: s.z + 8.5, r: 5.2, id: s.id + ':door' };
        this.colliders.push(this.vaultBlock);
        break;
      }
      case 'ring': {
        const parts = [];
        for (let i = 0; i < 18; i++) {
          const a = (i / 18) * TAU, r = 30;
          const h = 14 + (i % 3) * 5;
          parts.push({ geo: geoCyl(1.1, 1.5, h, 8), pos: [Math.cos(a) * r, h / 2, Math.sin(a) * r], color: 0x4f6a78 });
          parts.push({ geo: geoSphere(0.7, 6, 4), pos: [Math.cos(a) * r, h + 0.5, Math.sin(a) * r], color: 0x7fe8e0, emissive: true });
        }
        parts.push({ geo: geoSphere(14, 16, 8, 0, TAU, 0, Math.PI / 2), pos: [0, 0, 0], color: 0x3f5a6a });
        parts.push({ geo: geoTorus(30, 0.6, 6, 40), pos: [0, 15, 0], rot: [Math.PI / 2, 0, 0], color: 0x7fe8e0, emissive: true });
        parts.push({ geo: geoBox(7, 1.4, 0.3), pos: [0, 2.2, 14.4], color: 0x2a4a56 });
        for (let i = 0; i < 9; i++) parts.push({ geo: geoBox(0.35, 0.8, 0.1), pos: [-2.6 + i * 0.65, 2.2, 14.7], color: 0x7fe8e0, emissive: true });
        parts.push({ geo: geoSphere(1.6, 10, 8), pos: [0, 1.6, -6], color: 0x7fe8e0, emissive: true });
        this.add(g, s, parts, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.4 }));
        light(0x7fe8e0, 2.2, 70, [0, 8, 0]);
        break;
      }
      case 'grove': {
        const parts = [];
        for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU; parts.push({ geo: geoCyl(0.7, 1, 2.2 + (i % 3), 6), pos: [Math.cos(a) * 12, 1, Math.sin(a) * 12], color: 0x6a6258 }); }
        parts.push({ geo: geoSphere(1.2, 8, 6), pos: [0, 1.4, 0], color: 0x6affea, emissive: true });
        this.add(g, s, parts, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
        const l = light(0x6affea, 1.2, 60, [0, 4, 0]);
        this.animated.push((t, dayFactor) => { l.intensity = 0.4 + 1.6 * (0.5 + 0.5 * Math.sin(t * 0.7)) * (1 - dayFactor * 0.6); });
        break;
      }
      case 'static': {
        const curtains = [];
        const mat = new THREE.MeshBasicMaterial({ color: 0x7fd8ff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false, fog: false });
        for (let i = 0; i < 5; i++) {
          const m = new THREE.Mesh(new THREE.PlaneGeometry(60, 40, 8, 1), mat);
          m.position.set((i - 2) * 22, 34, (rng() - 0.5) * 30); m.rotation.y = (rng() - 0.5) * 1.2; g.add(m); curtains.push(m);
        }
        this.animated.push((t) => curtains.forEach((m, i) => { m.position.y = 34 + Math.sin(t * 0.5 + i) * 3; m.scale.x = 1 + 0.15 * Math.sin(t * 0.3 + i * 2); }));
        break;
      }
      case 'geo_fulgurite': {
        const parts = [];
        for (let i = 0; i < 18; i++) {
          const a = rng() * TAU, r = rng() * 14, h = 2 + rng() * 6;
          parts.push({ geo: geoCone(0.35 + rng() * 0.4, h, 5), pos: [Math.cos(a) * r, h / 2, Math.sin(a) * r], rot: [(rng() - 0.5) * 0.6, 0, (rng() - 0.5) * 0.6], color: 0xcfe0d8, emissive: rng() < 0.2 });
        }
        this.add(g, s, parts, propMaterial({ roughness: 0.15, metalness: 0.1, glowColor: 0xffe0a0, glowPower: 0.5 }));
        break;
      }
      case 'geo_canyon': {
        const parts = rockRing(rng, 6, 6, 2, 0x8a5538);
        parts.push({ geo: limb([0, 0, 0], [0, 4, 0], 0.08, 0.08, 0xdddddd).geo, pos: [0, 2, 0], color: 0xdddddd }, { geo: geoBox(1.2, 0.8, 0.05), pos: [0.6, 3.6, 0], color: 0xffb040, emissive: true });
        this.add(g, s, parts, R);
        break;
      }
      case 'geo_sinkhole': {
        const parts = [{ geo: geoCyl(11, 11.5, 0.2, 20), pos: [0, 0.08, 0], color: 0x07090a }, ...rockRing(rng, 18, 12.5, 2.4, 0x4a4438, 0.15)];
        for (let i = 0; i < 16; i++) { const a = rng() * TAU, r = 5 + rng() * 6; parts.push({ geo: geoSphere(0.35, 5, 4), pos: [Math.cos(a) * r, 0.3, Math.sin(a) * r], color: 0x6affea, emissive: true }); }
        this.add(g, s, parts, propMaterial({ roughness: 0.9, glowColor: 0x6affea, glowPower: 1.6, flat: true }));
        light(0x6affea, 1.2, 30, [0, 1, 0]);
        break;
      }
      case 'geo_ridge': {
        const parts = [];
        for (let i = 0; i < 12; i++) { const h = 6 + rng() * 10; parts.push({ geo: geoCone(2 + rng() * 2, h, 4), pos: [(i - 6) * 3.2 + rng(), h / 2 - 1, (rng() - 0.5) * 4], rot: [0, rng() * 3, (rng() - 0.5) * 0.3], color: 0xcfe8ff }); }
        this.add(g, s, parts, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.2, flatShading: true }));
        break;
      }
      case 'geo_vent': {
        const parts = [];
        for (let i = 0; i < 4; i++) { const h = 6 + i * 2.2, a = i * 1.6; parts.push({ geo: geoCyl(0.5, 1.7, h, 7), pos: [Math.cos(a) * 3, h / 2, Math.sin(a) * 3], color: 0x2a2428 }); parts.push({ geo: geoSphere(0.6, 6, 4), pos: [Math.cos(a) * 3, h + 0.3, Math.sin(a) * 3], color: 0xff7a40, emissive: true }); }
        this.add(g, s, parts, propMaterial({ roughness: 0.9, glowColor: 0xff7a40, glowPower: 1.8 }));
        light(0xff7a40, 1.5, 24, [0, 6, 0]);
        break;
      }
      case 'geo_seamount': {
        const parts = rockRing(rng, 8, 8, 3, 0x5a5a60);
        this.add(g, s, parts, R);
        break;
      }
      default: break;
    }
    this.group.add(g);
    this.sites.set(s.id, { site: s, group: g });

    // investigation points
    (s.scans || []).forEach((sc, i) => {
      this.scanTargets.push({ id: `${s.id}:${i}`, kind: 'site', entry: sc.entry, keys: sc.keys, label: sc.label, needsFlag: sc.needsFlag, site: s,
        x: s.x + sc.off[0], y: s.y + sc.off[1], z: s.z + sc.off[2], r: sc.r });
    });
    (s.logs || []).forEach((l) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.35), new THREE.MeshStandardMaterial({ color: 0x66ccff, emissive: 0x66ccff, emissiveIntensity: 1.6 }));
      mesh.position.set(l.off[0], l.off[1], l.off[2]); g.add(mesh);
      this.logs.push({ id: l.id, x: s.x + l.off[0], y: s.y + l.off[1], z: s.z + l.off[2], mesh, site: s });
    });
    (s.digs || []).forEach((d) => {
      const mound = new THREE.Mesh(new THREE.ConeGeometry(1.4, 0.6, 7), new THREE.MeshStandardMaterial({ color: 0x8a7a60, roughness: 1, flatShading: true }));
      mound.position.set(d.off[0], 0.2, d.off[2]);
      const ping = glowSprite(0xffd070, 2.2, 0.8); ping.position.set(d.off[0], 1.4, d.off[2]);
      g.add(mound, ping);
      this.digs.push({ id: d.id, frag: d.frag, x: s.x + d.off[0], y: s.y, z: s.z + d.off[2], mound, ping, site: s, progress: 0, done: false });
    });
    (s.nodes || []).forEach((n, i) => {
      const geo = this.flora.nodeGeo(n.res);
      const mesh = new THREE.Mesh(geo, this.flora.nodeMat); mesh.position.set(n.off[0], n.off[1] - 0.3, n.off[2]); mesh.scale.setScalar(1.2);
      g.add(mesh);
      this.siteNodes.push({ x: s.x + n.off[0], y: s.y + n.off[1], z: s.z + n.off[2], res: n.res, nodeId: `site:${s.id}:${i}`, single: mesh, hp: 1 });
    });
  }

  pulse(g, color, pos, size, period = 5) {
    const sp = glowSprite(color, size, 0.8); sp.position.set(...pos); g.add(sp);
    this.animated.push((t) => { const k = 0.6 + 0.4 * Math.sin(t * (TAU / period)); sp.material.opacity = 0.35 + 0.55 * k; sp.scale.setScalar(size * (0.8 + 0.4 * k)); });
  }

  setVaultOpen(open) {
    this._vaultOpen = open;
    if (this.vaultBlock) { const i = this.colliders.indexOf(this.vaultBlock); if (open && i >= 0) this.colliders.splice(i, 1); else if (!open && i < 0) this.colliders.push(this.vaultBlock); }
    if (this.vaultLight) this.vaultLight.intensity = open ? 2.2 : 0;
  }

  update(t, dt, dayFactor) {
    for (const f of this.animated) f(t, dayFactor);
    if (this.vaultDoor) {
      const target = this._vaultOpen ? 12.5 : 0;
      this.vaultDoor.position.y += (target - this.vaultDoor.position.y) * Math.min(1, dt * 1.6);
    }
  }

  dispose() { this.scene.remove(this.group); }
}
