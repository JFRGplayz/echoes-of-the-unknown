import * as THREE from 'three';
import { PLANETS } from '../data/planets.js';

// Conversion between a planet's flat local surface frame (x east, y up, z south, metres) and the
// system-wide space frame. The surface map wraps the planet: lon = x / R, lat = -z / R.
const _e = new THREE.Vector3(), _u = new THREE.Vector3(), _s = new THREE.Vector3(), _m = new THREE.Matrix4();

export function surfaceBasis(planetId, x, z, outMat = _m) {
  const R = PLANETS[planetId].radius;
  const lon = x / R, lat = -z / R;
  const cl = Math.cos(lat), sl = Math.sin(lat), co = Math.cos(lon), so = Math.sin(lon);
  _u.set(cl * so, sl, cl * co);
  _e.set(co, 0, -so);
  const n = new THREE.Vector3(-sl * so, cl, -sl * co);
  _s.copy(n).negate();
  outMat.makeBasis(_e, _u, _s);
  return { up: _u.clone(), east: _e.clone(), south: _s.clone(), matrix: outMat.clone() };
}

export function surfaceToSpace(planetId, x, y, z, groundH, quat, vel) {
  const P = PLANETS[planetId], R = P.radius;
  const b = surfaceBasis(planetId, x, z);
  const alt = Math.max(0, y - groundH);
  const pos = new THREE.Vector3(...P.orbitPos).addScaledVector(b.up, R + alt);
  const q = new THREE.Quaternion().setFromRotationMatrix(b.matrix).multiply(quat);
  const v = vel.clone().applyMatrix4(new THREE.Matrix4().extractRotation(b.matrix));
  return { pos, quat: q, vel: v };
}

export function spaceToSurface(planetId, pos, quat, vel) {
  const P = PLANETS[planetId], R = P.radius;
  const rel = pos.clone().sub(new THREE.Vector3(...P.orbitPos));
  const dist = rel.length();
  const up = rel.clone().divideScalar(dist);
  const lat = Math.asin(Math.max(-1, Math.min(1, up.y)));
  const lon = Math.atan2(up.x, up.z);
  const x = lon * R, z = -lat * R;
  const b = surfaceBasis(planetId, x, z);
  const inv = new THREE.Matrix4().extractRotation(b.matrix).invert();
  const qb = new THREE.Quaternion().setFromRotationMatrix(b.matrix).invert();
  const q = qb.multiply(quat);
  const v = vel.clone().applyMatrix4(inv);
  return { x, z, alt: dist - R, quat: q, vel: v };
}

// Direction (unit) from planet centre to the survey landing zone (x=0, z=0).
export function landingZoneDir(planetId) { return surfaceBasis(planetId, 0, 0).up; }
