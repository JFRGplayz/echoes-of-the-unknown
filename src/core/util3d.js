import * as THREE from 'three';
import { mulberry32 } from './util.js';

// Merge a list of {geo, pos, rot, scale, color, emissive?} parts into one vertex-coloured BufferGeometry.
// Emissive parts are flagged in a per-vertex `glow` attribute (0..1) so one material can render both.
export function mergeParts(parts) {
  let vCount = 0, iCount = 0;
  const prepared = parts.map((p) => {
    const g = p.geo.index ? p.geo : p.geo; // keep indexed or not
    vCount += g.attributes.position.count;
    iCount += g.index ? g.index.count : g.attributes.position.count;
    return { ...p, g };
  });
  const pos = new Float32Array(vCount * 3), nor = new Float32Array(vCount * 3);
  const col = new Float32Array(vCount * 3), glow = new Float32Array(vCount);
  const idx = new Uint32Array(iCount);
  let vo = 0, io = 0;
  const m = new THREE.Matrix4(), nm = new THREE.Matrix3(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const v = new THREE.Vector3(), c = new THREE.Color();
  for (const p of prepared) {
    const g = p.g;
    const P = p.pos || [0, 0, 0], R = p.rot || [0, 0, 0], S = p.scale || [1, 1, 1];
    q.setFromEuler(e.set(R[0], R[1], R[2]));
    m.compose(new THREE.Vector3(P[0], P[1], P[2]), q, new THREE.Vector3(S[0], S[1], S[2]));
    nm.getNormalMatrix(m);
    c.set(p.color ?? 0xffffff);
    const gp = g.attributes.position, gn = g.attributes.normal;
    const n = gp.count;
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(gp, i).applyMatrix4(m);
      pos[(vo + i) * 3] = v.x; pos[(vo + i) * 3 + 1] = v.y; pos[(vo + i) * 3 + 2] = v.z;
      if (gn) {
        v.fromBufferAttribute(gn, i).applyMatrix3(nm).normalize();
        nor[(vo + i) * 3] = v.x; nor[(vo + i) * 3 + 1] = v.y; nor[(vo + i) * 3 + 2] = v.z;
      }
      // slight per-vertex shade variation keeps flat-coloured props from looking plastic
      const sh = 0.9 + 0.2 * ((Math.sin(i * 12.9898 + vo) * 43758.5453) % 1 + 1) % 1;
      col[(vo + i) * 3] = c.r * sh; col[(vo + i) * 3 + 1] = c.g * sh; col[(vo + i) * 3 + 2] = c.b * sh;
      glow[vo + i] = p.emissive ? 1 : 0;
    }
    if (g.index) { for (let i = 0; i < g.index.count; i++) idx[io + i] = g.index.getX(i) + vo; io += g.index.count; }
    else { for (let i = 0; i < n; i++) idx[io + i] = vo + i; io += n; }
    vo += n;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setAttribute('glow', new THREE.BufferAttribute(glow, 1));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  return out;
}

// Standard material for merged props; glow attribute drives emissive strength.
export function propMaterial(opts = {}) {
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: opts.roughness ?? 0.85, metalness: opts.metalness ?? 0.05,
    flatShading: opts.flat ?? false, side: opts.side ?? THREE.FrontSide,
    transparent: !!opts.transparent, opacity: opts.opacity ?? 1,
  });
  mat.userData.glowColor = { value: new THREE.Color(opts.glowColor ?? 0xffffff) };
  mat.userData.glowPower = { value: opts.glowPower ?? 1.5 };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uGlowColor = mat.userData.glowColor;
    sh.uniforms.uGlowPower = mat.userData.glowPower;
    sh.vertexShader = 'attribute float glow;\nvarying float vGlow;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vGlow = glow;');
    sh.fragmentShader = 'varying float vGlow;\nuniform vec3 uGlowColor;\nuniform float uGlowPower;\n' + sh.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n totalEmissiveRadiance += vGlow * vColor.rgb * uGlowColor * uGlowPower;');
  };
  return mat;
}

export const geoBox = (w, h, d) => new THREE.BoxGeometry(w, h, d);
export const geoCyl = (rt, rb, h, seg = 8) => new THREE.CylinderGeometry(rt, rb, h, seg);
export const geoCone = (r, h, seg = 8) => new THREE.ConeGeometry(r, h, seg);
export const geoSphere = (r, ws = 8, hs = 6) => new THREE.SphereGeometry(r, ws, hs);
export const geoTorus = (r, t, rs = 8, ts = 24) => new THREE.TorusGeometry(r, t, rs, ts);
export const geoIco = (r, d = 1) => new THREE.IcosahedronGeometry(r, d);

// Bumpy rock built from an icosahedron with seeded vertex noise.
export function rockGeo(seed, r = 1, detail = 1, squash = 0.75, rough = 0.35) {
  const g = new THREE.IcosahedronGeometry(r, detail);
  const rng = mulberry32(seed);
  const p = g.attributes.position;
  const map = new Map();
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    if (!map.has(key)) map.set(key, 1 + (rng() - 0.5) * rough * 2);
    const k = map.get(key);
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * squash, p.getZ(i) * k);
  }
  g.computeVertexNormals();
  return g;
}

export function canvasTex(w, h, draw, repeat = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d'); draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Greyscale noise texture used to break up flat terrain colour.
export function detailTexture(seed = 5) {
  const rng = mulberry32(seed);
  return canvasTex(256, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      const v = 190 + Math.floor(rng() * 65);
      img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    // soft blotches
    for (let i = 0; i < 90; i++) {
      const x = rng() * w, y = rng() * h, r = 6 + rng() * 22;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const d = rng() < 0.5 ? '0,0,0' : '255,255,255';
      g.addColorStop(0, `rgba(${d},0.16)`); g.addColorStop(1, `rgba(${d},0)`);
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  });
}

export function disposeObject(o) {
  o.traverse?.((n) => {
    if (n.geometry) n.geometry.dispose();
    if (n.material) { (Array.isArray(n.material) ? n.material : [n.material]).forEach((m) => { if (!m.userData?.shared) m.dispose(); }); }
  });
}

export function glowSprite(color, size = 1, opacity = 1) {
  const tex = glowSprite.tex || (glowSprite.tex = canvasTex(64, 64, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }, false));
  const m = new THREE.SpriteMaterial({ map: tex, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  m.userData.shared = false;
  const s = new THREE.Sprite(m); s.scale.set(size, size, 1);
  return s;
}
