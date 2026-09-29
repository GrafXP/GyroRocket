// Sines, cosines and distances for the sim, the same to the last bit on every
// phone and in node. JavaScript leaves Math.sin, Math.cos, Math.hypot and the like
// to each engine, and they differ in the last digits, which is enough for a
// replayed run to drift off its course. These use only + − × ÷ and Math.sqrt,
// which are exact (correctly rounded) everywhere. The sine and cosine are
// fdlibm's, as in musl, and within a unit in the last place of the true values.

// π/2 in three parts, the first two short enough that n × part is exact, for
// taking whole quarter turns off an angle.
const INV_PIO2 = 6.36619772367581382433e-1;
const PIO2_1 = 1.57079632673412561417e0;
const PIO2_2 = 6.07710050630396597660e-11;
const PIO2_2T = 2.02226624879595063154e-21;
const PIO4 = 7.85398163397448278999e-1;

const S1 = -1.66666666666666324348e-1;
const S2 = 8.33333333332248946124e-3;
const S3 = -1.98412698298579493134e-4;
const S4 = 2.75573137070700676789e-6;
const S5 = -2.50507602534068634195e-8;
const S6 = 1.58969099521155010221e-10;

const C1 = 4.16666666666666019037e-2;
const C2 = -1.38888888888741095749e-3;
const C3 = 2.48015872894767294178e-5;
const C4 = -2.75573143513906633035e-7;
const C5 = 2.08757232129817482790e-9;
const C6 = -1.13596475577881948265e-11;

// sin(x + y) and cos(x + y) for |x| ≤ π/4, y being the tail of x beyond its precision.
function kernelSin(x, y) {
  const z = x * x;
  const w = z * z;
  const r = S2 + z * (S3 + z * S4) + z * w * (S5 + z * S6);
  const v = z * x;
  return x - ((z * (0.5 * y - v * r) - y) - v * S1);
}

function kernelCos(x, y) {
  const z = x * x;
  const w = z * z;
  const r = z * (C1 + z * (C2 + z * C3)) + w * w * (C4 + z * (C5 + z * C6));
  const hz = 0.5 * z;
  const one = 1 - hz;
  return one + ((1 - one - hz) + (z * r - x * y));
}

// x less its nearest whole number of quarter turns, n: [n, head, tail]. Good to
// about 118 bits for the angles the sim meets (well under a million radians).
const reduced = [0, 0, 0];
function reduce(x) {
  const n = Math.round(x * INV_PIO2);
  const t = x - n * PIO2_1;
  let w = n * PIO2_2;
  const r = t - w;
  w = n * PIO2_2T - (t - r - w);
  const head = r - w;
  reduced[0] = n;
  reduced[1] = head;
  reduced[2] = r - head - w;
  return reduced;
}

export function sin(x) {
  if (Math.abs(x) <= PIO4) return kernelSin(x, 0);
  if (!Number.isFinite(x)) return NaN;
  const [n, y0, y1] = reduce(x);
  switch (n & 3) {
    case 0:
      return kernelSin(y0, y1);
    case 1:
      return kernelCos(y0, y1);
    case 2:
      return -kernelSin(y0, y1);
    default:
      return -kernelCos(y0, y1);
  }
}

export function cos(x) {
  if (Math.abs(x) <= PIO4) return kernelCos(x, 0);
  if (!Number.isFinite(x)) return NaN;
  const [n, y0, y1] = reduce(x);
  switch (n & 3) {
    case 0:
      return kernelCos(y0, y1);
    case 1:
      return -kernelSin(y0, y1);
    case 2:
      return -kernelCos(y0, y1);
    default:
      return kernelSin(y0, y1);
  }
}

// The length of (x, y). Math.hypot takes more care with huge and tiny numbers,
// which the sim never has, and isn't the same everywhere.
export const hypot = (x, y) => Math.sqrt(x * x + y * y);
