// A small stand-in for three.js used ONLY by the headless smoke tests (no GPU, no network).
// Math classes are real; geometry/material/renderer are structural fakes.
export const ACESFilmicToneMapping = 4, AdditiveBlending = 2, BackSide = 1, DoubleSide = 2, FrontSide = 0, NoColorSpace = '', PCFSoftShadowMap = 2, RepeatWrapping = 1000, SRGBColorSpace = 'srgb';

export class Vector2 { constructor(x = 0, y = 0) { this.x = x; this.y = y; } set(x, y) { this.x = x; this.y = y; return this; } }

export class Vector3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  setScalar(s) { return this.set(s, s, s); }
  copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
  clone() { return new Vector3(this.x, this.y, this.z); }
  add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
  addScaledVector(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; }
  multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
  divideScalar(s) { return this.multiplyScalar(1 / s); }
  negate() { this.x = -this.x; this.y = -this.y; this.z = -this.z; return this; }
  dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; }
  cross(v) { const { x, y, z } = this; this.x = y * v.z - z * v.y; this.y = z * v.x - x * v.z; this.z = x * v.y - y * v.x; return this; }
  lengthSq() { return this.x * this.x + this.y * this.y + this.z * this.z; }
  length() { return Math.sqrt(this.lengthSq()); }
  normalize() { return this.divideScalar(this.length() || 1); }
  setLength(l) { return this.normalize().multiplyScalar(l); }
  distanceTo(v) { return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z); }
  lerp(v, t) { this.x += (v.x - this.x) * t; this.y += (v.y - this.y) * t; this.z += (v.z - this.z) * t; return this; }
  toArray() { return [this.x, this.y, this.z]; }
  fromArray(a) { this.x = a[0]; this.y = a[1]; this.z = a[2]; return this; }
  fromBufferAttribute(a, i) { return this.set(a.getX(i), a.getY(i), a.getZ(i)); }
  applyMatrix4(m) { const e = m.elements, { x, y, z } = this; const w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]); this.x = (e[0] * x + e[4] * y + e[8] * z + e[12]) * w; this.y = (e[1] * x + e[5] * y + e[9] * z + e[13]) * w; this.z = (e[2] * x + e[6] * y + e[10] * z + e[14]) * w; return this; }
  applyMatrix3(m) { const e = m.elements, { x, y, z } = this; this.x = e[0] * x + e[3] * y + e[6] * z; this.y = e[1] * x + e[4] * y + e[7] * z; this.z = e[2] * x + e[5] * y + e[8] * z; return this; }
  applyQuaternion(q) {
    const { x, y, z } = this, qx = q.x, qy = q.y, qz = q.z, qw = q.w;
    const ix = qw * x + qy * z - qz * y, iy = qw * y + qz * x - qx * z, iz = qw * z + qx * y - qy * x, iw = -qx * x - qy * y - qz * z;
    this.x = ix * qw + iw * -qx + iy * -qz - iz * -qy; this.y = iy * qw + iw * -qy + iz * -qx - ix * -qz; this.z = iz * qw + iw * -qz + ix * -qy - iy * -qx; return this;
  }
  project(cam) { // crude perspective for tests
    this.applyMatrix4(cam.matrixWorldInverse || new Matrix4()); const z = this.z || -1; this.x = this.x / -z; this.y = this.y / -z; return this;
  }
}

export class Euler { constructor(x = 0, y = 0, z = 0, order = 'XYZ') { this.x = x; this.y = y; this.z = z; this.order = order; } set(x, y, z, o) { this.x = x; this.y = y; this.z = z; if (o) this.order = o; this._cb?.(); return this; }
  setFromQuaternion(q) { // YXZ-agnostic approximation sufficient for tests
    const m = new Matrix4().makeRotationFromQuaternion(q), e = m.elements;
    this.y = Math.asin(Math.max(-1, Math.min(1, e[8]))); this.x = Math.atan2(-e[9], e[10]); this.z = Math.atan2(-e[4], e[0]); return this; } }

export class Quaternion {
  constructor(x = 0, y = 0, z = 0, w = 1) { this.x = x; this.y = y; this.z = z; this.w = w; }
  set(x, y, z, w) { this.x = x; this.y = y; this.z = z; this.w = w; return this; }
  copy(q) { this.x = q.x; this.y = q.y; this.z = q.z; this.w = q.w; return this; }
  clone() { return new Quaternion(this.x, this.y, this.z, this.w); }
  toArray() { return [this.x, this.y, this.z, this.w]; }
  fromArray(a) { return this.set(a[0], a[1], a[2], a[3]); }
  normalize() { const l = Math.hypot(this.x, this.y, this.z, this.w) || 1; this.x /= l; this.y /= l; this.z /= l; this.w /= l; return this; }
  invert() { this.x = -this.x; this.y = -this.y; this.z = -this.z; return this; }
  multiply(q) { return this.multiplyQuaternions(this, q); }
  premultiply(q) { return this.multiplyQuaternions(q, this); }
  multiplyQuaternions(a, b) {
    const qax = a.x, qay = a.y, qaz = a.z, qaw = a.w, qbx = b.x, qby = b.y, qbz = b.z, qbw = b.w;
    this.x = qax * qbw + qaw * qbx + qay * qbz - qaz * qby; this.y = qay * qbw + qaw * qby + qaz * qbx - qax * qbz;
    this.z = qaz * qbw + qaw * qbz + qax * qby - qay * qbx; this.w = qaw * qbw - qax * qbx - qay * qby - qaz * qbz; return this;
  }
  setFromAxisAngle(a, ang) { const s = Math.sin(ang / 2); this.x = a.x * s; this.y = a.y * s; this.z = a.z * s; this.w = Math.cos(ang / 2); return this; }
  setFromEuler(e) {
    const c1 = Math.cos(e.x / 2), c2 = Math.cos(e.y / 2), c3 = Math.cos(e.z / 2), s1 = Math.sin(e.x / 2), s2 = Math.sin(e.y / 2), s3 = Math.sin(e.z / 2);
    if (e.order === 'YXZ') { this.x = s1 * c2 * c3 + c1 * s2 * s3; this.y = c1 * s2 * c3 - s1 * c2 * s3; this.z = c1 * c2 * s3 - s1 * s2 * c3; this.w = c1 * c2 * c3 + s1 * s2 * s3; }
    else { this.x = s1 * c2 * c3 + c1 * s2 * s3; this.y = c1 * s2 * c3 - s1 * c2 * s3; this.z = c1 * c2 * s3 + s1 * s2 * c3; this.w = c1 * c2 * c3 - s1 * s2 * s3; }
    return this;
  }
  setFromUnitVectors(a, b) {
    let r = a.dot(b) + 1;
    if (r < 1e-6) { r = 0; if (Math.abs(a.x) > Math.abs(a.z)) this.set(-a.y, a.x, 0, r); else this.set(0, -a.z, a.y, r); }
    else this.set(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x, r);
    return this.normalize();
  }
  setFromRotationMatrix(m) {
    const e = m.elements, m11 = e[0], m12 = e[4], m13 = e[8], m21 = e[1], m22 = e[5], m23 = e[9], m31 = e[2], m32 = e[6], m33 = e[10], tr = m11 + m22 + m33;
    if (tr > 0) { const s = 0.5 / Math.sqrt(tr + 1); this.w = 0.25 / s; this.x = (m32 - m23) * s; this.y = (m13 - m31) * s; this.z = (m21 - m12) * s; }
    else if (m11 > m22 && m11 > m33) { const s = 2 * Math.sqrt(1 + m11 - m22 - m33); this.w = (m32 - m23) / s; this.x = 0.25 * s; this.y = (m12 + m21) / s; this.z = (m13 + m31) / s; }
    else if (m22 > m33) { const s = 2 * Math.sqrt(1 + m22 - m11 - m33); this.w = (m13 - m31) / s; this.x = (m12 + m21) / s; this.y = 0.25 * s; this.z = (m23 + m32) / s; }
    else { const s = 2 * Math.sqrt(1 + m33 - m11 - m22); this.w = (m21 - m12) / s; this.x = (m13 + m31) / s; this.y = (m23 + m32) / s; this.z = 0.25 * s; }
    return this;
  }
  slerp(qb, t) { if (t === 0) return this; if (t === 1) return this.copy(qb);
    let cos = this.x * qb.x + this.y * qb.y + this.z * qb.z + this.w * qb.w; let bx = qb.x, by = qb.y, bz = qb.z, bw = qb.w;
    if (cos < 0) { cos = -cos; bx = -bx; by = -by; bz = -bz; bw = -bw; }
    if (cos > 0.9995) { this.x += t * (bx - this.x); this.y += t * (by - this.y); this.z += t * (bz - this.z); this.w += t * (bw - this.w); return this.normalize(); }
    const th = Math.acos(cos), s = Math.sin(th), a = Math.sin((1 - t) * th) / s, b = Math.sin(t * th) / s;
    this.x = this.x * a + bx * b; this.y = this.y * a + by * b; this.z = this.z * a + bz * b; this.w = this.w * a + bw * b; return this; }
}

export class Matrix3 { constructor() { this.elements = [1, 0, 0, 0, 1, 0, 0, 0, 1]; }
  getNormalMatrix(m4) { const e = m4.elements; this.elements = [e[0], e[1], e[2], e[4], e[5], e[6], e[8], e[9], e[10]]; return this; } }

export class Matrix4 {
  constructor() { this.elements = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; }
  identity() { this.elements = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; return this; }
  clone() { const m = new Matrix4(); m.elements = this.elements.slice(); return m; }
  copy(m) { this.elements = m.elements.slice(); return this; }
  makeBasis(x, y, z) { this.elements = [x.x, x.y, x.z, 0, y.x, y.y, y.z, 0, z.x, z.y, z.z, 0, 0, 0, 0, 1]; return this; }
  makeScale(x, y, z) { this.identity(); this.elements[0] = x; this.elements[5] = y; this.elements[10] = z; return this; }
  makeRotationY(t) { const c = Math.cos(t), s = Math.sin(t); this.elements = [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]; return this; }
  makeRotationZ(t) { const c = Math.cos(t), s = Math.sin(t); this.elements = [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; return this; }
  makeRotationFromQuaternion(q) { return this.compose(new Vector3(), q, new Vector3(1, 1, 1)); }
  extractRotation(m) { const e = m.elements; this.elements = [e[0], e[1], e[2], 0, e[4], e[5], e[6], 0, e[8], e[9], e[10], 0, 0, 0, 0, 1]; return this; }
  compose(p, q, s) {
    const { x, y, z, w } = q, x2 = x + x, y2 = y + y, z2 = z + z, xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
    this.elements = [(1 - (yy + zz)) * s.x, (xy + wz) * s.x, (xz - wy) * s.x, 0, (xy - wz) * s.y, (1 - (xx + zz)) * s.y, (yz + wx) * s.y, 0, (xz + wy) * s.z, (yz - wx) * s.z, (1 - (xx + yy)) * s.z, 0, p.x, p.y, p.z, 1]; return this;
  }
  invert() { // valid for rotation(+translation) matrices
    const e = this.elements, r = [e[0], e[4], e[8], 0, e[1], e[5], e[9], 0, e[2], e[6], e[10], 0, 0, 0, 0, 1];
    r[12] = -(r[0] * e[12] + r[4] * e[13] + r[8] * e[14]); r[13] = -(r[1] * e[12] + r[5] * e[13] + r[9] * e[14]); r[14] = -(r[2] * e[12] + r[6] * e[13] + r[10] * e[14]); this.elements = r; return this; }
  setPosition() { return this; }
}

export class Color { constructor(r = 1, g, b) { this.set(r, g, b); }
  set(r, g, b) { if (r && r.isColor) return this.copy(r); if (g !== undefined) { this.r = r; this.g = g; this.b = b; } else { const h = +r || 0; this.r = ((h >> 16) & 255) / 255; this.g = ((h >> 8) & 255) / 255; this.b = (h & 255) / 255; } this.isColor = true; return this; }
  copy(c) { this.r = c.r; this.g = c.g; this.b = c.b; this.isColor = true; return this; }
  clone() { return new Color(this.r, this.g, this.b); }
  lerp(c, t) { this.r += (c.r - this.r) * t; this.g += (c.g - this.g) * t; this.b += (c.b - this.b) * t; return this; }
  multiplyScalar(s) { this.r *= s; this.g *= s; this.b *= s; return this; } }

class Attr { constructor(array, itemSize) { this.array = array; this.itemSize = itemSize; this.count = array.length / itemSize; }
  getX(i) { return this.array[i * this.itemSize]; } getY(i) { return this.array[i * this.itemSize + 1]; } getZ(i) { return this.array[i * this.itemSize + 2]; }
  setXYZ(i, x, y, z) { const o = i * this.itemSize; this.array[o] = x; this.array[o + 1] = y; this.array[o + 2] = z; } }
export class BufferAttribute extends Attr { constructor(a, s) { super(a, s); this.needsUpdate = false; } }
export class BufferGeometry {
  constructor() { this.attributes = {}; this.index = null; }
  setAttribute(n, a) { this.attributes[n] = a; return this; } setIndex(a) { this.index = a; return this; }
  computeBoundingSphere() {} computeVertexNormals() {} dispose() {}
  applyMatrix4(m) { const p = this.attributes.position, v = new Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(m); p.setXYZ(i, v.x, v.y, v.z); } return this; }
}
function blob(n = 24) { // a closed-ish fake mesh with n verts
  const g = new BufferGeometry(), pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), idx = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pos[i * 3] = Math.cos(a); pos[i * 3 + 1] = (i % 3) - 1; pos[i * 3 + 2] = Math.sin(a); nor[i * 3 + 1] = 1; if (i > 1) idx.push(0, i - 1, i); }
  g.setAttribute('position', new Attr(pos, 3)); g.setAttribute('normal', new Attr(nor, 3)); g.setIndex(new Attr(Uint32Array.from(idx), 1)); return g;
}
const geo = (n) => class extends BufferGeometry { constructor() { super(); const b = blob(n); this.attributes = b.attributes; this.index = b.index; } };
export const BoxGeometry = geo(24), ConeGeometry = geo(18), CylinderGeometry = geo(24), IcosahedronGeometry = geo(42), PlaneGeometry = geo(12), SphereGeometry = geo(40), TorusGeometry = geo(48);

class Mat { constructor(o = {}) { Object.assign(this, o); this.userData = {}; if (o.color !== undefined) this.color = new Color(o.color); } dispose() {} clone() { return Object.assign(new this.constructor(), this); } }
export class MeshBasicMaterial extends Mat {} export class MeshStandardMaterial extends Mat { constructor(o) { super(o); this.color = new Color(o?.color ?? 0xffffff); this.normalScale = new Vector2(1, 1); } }
export class PointsMaterial extends Mat { constructor(o) { super(o); this.color = new Color(o?.color ?? 0xffffff); } } export class ShaderMaterial extends Mat {} export class SpriteMaterial extends Mat {}
export class Texture { constructor() { this.repeat = new Vector2(1, 1); this.offset = new Vector2(); } dispose() {} } export class CanvasTexture extends Texture {}
export class FogExp2 { constructor(c, d) { this.color = new Color(c); this.density = d; } }

export class Object3D {
  constructor() { this.children = []; this.parent = null; this.position = new Vector3(); this.rotation = new Euler(); this.quaternion = new Quaternion(); this.rotation._cb = () => this.quaternion.setFromEuler(this.rotation); this.scale = new Vector3(1, 1, 1); this.visible = true; this.userData = {}; this.matrix = new Matrix4(); this.matrixWorld = new Matrix4(); }
  add(...o) { for (const c of o) { if (c.parent) c.parent.remove(c); c.parent = this; this.children.push(c); } return this; }
  remove(...o) { for (const c of o) { const i = this.children.indexOf(c); if (i >= 0) { this.children.splice(i, 1); c.parent = null; } } return this; }
  traverse(f) { f(this); for (const c of this.children) c.traverse(f); }
  updateMatrix() { this.rotationQ(); this.matrix.compose(this.position, this.quaternion, this.scale); }
  rotationQ() { if (this.rotation) this.quaternion.setFromEuler(this.rotation); }
  lookAt() {} updateMatrixWorld() {}
}
export class Group extends Object3D {} export class Scene extends Object3D { constructor() { super(); this.fog = null; } }
export class Mesh extends Object3D { constructor(g, m) { super(); this.geometry = g; this.material = m; } }
export class InstancedMesh extends Mesh { constructor(g, m, n) { super(g, m); this.count = n; this.instanceMatrix = { needsUpdate: false }; this.mats = []; } setMatrixAt(i, m) { this.mats[i] = m; } computeBoundingSphere() {} dispose() {} }
export class Points extends Mesh {} export class Sprite extends Object3D { constructor(m) { super(); this.material = m; } }
export class Light extends Object3D { constructor(c, i) { super(); this.color = new Color(c); this.intensity = i; this.shadow = { mapSize: new Vector2(), camera: {}, }; } }
export class AmbientLight extends Light {} export class HemisphereLight extends Light { constructor(a, b, i) { super(a, i); this.groundColor = new Color(b); } }
export class DirectionalLight extends Light { constructor(c, i) { super(c, i); this.target = new Object3D(); } }
export class PointLight extends Light {} export class SpotLight extends Light { constructor(...a) { super(a[0], a[1]); this.target = new Object3D(); } }
export class PerspectiveCamera extends Object3D { constructor(fov, aspect, near, far) { super(); this.fov = fov; this.aspect = aspect; this.near = near; this.far = far; this.matrixWorldInverse = new Matrix4(); } updateProjectionMatrix() {} }
export class WebGLRenderer { constructor() { this.shadowMap = {}; this.calls = 0; } setPixelRatio() {} setSize() {} render() { this.calls++; } clear() {} clearDepth() {} }
