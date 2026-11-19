import { mulberry32 } from './util.js';

const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;
const GX = [1, -1, 1, -1, 1, -1, 0, 0];
const GY = [1, 1, -1, -1, 0, 0, 1, -1];

// Seeded 2D simplex noise with fbm / ridged helpers.
export class Noise {
  constructor(seed = 1) {
    const r = mulberry32(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      const t = p[i]; p[i] = p[j]; p[j] = t;
    }
    this.perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }

  simplex(xin, yin) {
    const perm = this.perm;
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s), j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t), y0 = yin - (j - t);
    const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let n0 = 0, n1 = 0, n2 = 0;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) { const g = perm[ii + perm[jj]] & 7; t0 *= t0; n0 = t0 * t0 * (GX[g] * x0 + GY[g] * y0); }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) { const g = perm[ii + i1 + perm[jj + j1]] & 7; t1 *= t1; n1 = t1 * t1 * (GX[g] * x1 + GY[g] * y1); }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) { const g = perm[ii + 1 + perm[jj + 1]] & 7; t2 *= t2; n2 = t2 * t2 * (GX[g] * x2 + GY[g] * y2); }
    return 70 * (n0 + n1 + n2);
  }

  // Result roughly in [-1, 1]
  fbm(x, y, oct = 5, lac = 2, gain = 0.5) {
    let a = 1, f = 1, sum = 0, norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += a * this.simplex(x * f, y * f);
      norm += a; a *= gain; f *= lac;
    }
    return sum / norm;
  }

  // Result roughly in [0, 1], sharp crests
  ridged(x, y, oct = 5, lac = 2, gain = 0.5) {
    let a = 1, f = 1, sum = 0, norm = 0;
    for (let i = 0; i < oct; i++) {
      const n = 1 - Math.abs(this.simplex(x * f, y * f));
      sum += a * n * n; norm += a; a *= gain; f *= lac;
    }
    return sum / norm;
  }
}
