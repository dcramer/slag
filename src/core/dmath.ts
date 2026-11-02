/**
 * Deterministic transcendental math for the simulation and the generators.
 *
 * `Math.sin`, `cos`, `atan2`, `exp`, `log`, `pow`, `hypot`… are
 * "implementation-approximated" in the ECMAScript spec: V8, SpiderMonkey and
 * JavaScriptCore may return different last bits for the same input, which is
 * enough to desync a lockstep match after a few hundred frames. Everything
 * here is built only from IEEE-754 `+ - * /`, `Math.sqrt` (correctly rounded
 * by spec), `Math.floor/round/abs` and exact bit manipulation, so the result
 * is bit-identical on every engine.
 *
 * The algorithms are ports of fdlibm (Sun's freely distributable libm, the
 * reference most engines started from), accurate to ~1 ulp.
 *
 * tests/dmath.test.ts checks accuracy against Math.*. Lint keeps the native
 * versions out of src/sim, src/gen and src/game, and tests/determinism-ban.test.ts
 * does the same for the ** operator, which lint can't see.
 */

const F64 = new Float64Array(1);
const U32 = new Uint32Array(F64.buffer);
// Endianness of the host's typed arrays (every browser is little-endian, but don't assume).
const HI = (() => {
  F64[0] = 1;
  return U32[1] === 0x3ff00000 ? 1 : 0;
})();
const LO = 1 - HI;

function highWord(x: number): number {
  F64[0] = x;
  return U32[HI] | 0;
}

function withHighWord(x: number, hi: number): number {
  F64[0] = x;
  U32[HI] = hi >>> 0;
  return F64[0];
}

/** 2^k, exact, for integer k in [-1074, 1023]. */
function pow2(k: number): number {
  if (k > 1023) return Infinity;
  if (k < -1074) return 0;
  if (k >= -1022) {
    F64[0] = 0;
    U32[HI] = ((k + 1023) << 20) >>> 0;
    U32[LO] = 0;
    return F64[0];
  }
  // Subnormal: scale in two exact steps.
  return pow2(k + 60) * pow2(-60);
}

// ------------------------------------------------------------------ sin / cos

const S1 = -1.66666666666666324348e-1;
const S2 = 8.33333333332248946124e-3;
const S3 = -1.98412698298579493134e-4;
const S4 = 2.75573137070700676789e-6;
const S5 = -2.50507602534068634195e-8;
const S6 = 1.58969099521155010221e-10;

/** sin on [-π/4, π/4]; y is the tail of the reduced argument. */
function kSin(x: number, y: number): number {
  const z = x * x;
  const v = z * x;
  const r = S2 + z * (S3 + z * (S4 + z * (S5 + z * S6)));
  return x - (z * (0.5 * y - v * r) - y - v * S1);
}

const C1 = 4.16666666666666019037e-2;
const C2 = -1.38888888888741095749e-3;
const C3 = 2.48015872894767294178e-5;
const C4 = -2.75573143513906633035e-7;
const C5 = 2.0875723212981748279e-9;
const C6 = -1.13596475577881948265e-11;

/** cos on [-π/4, π/4]. */
function kCos(x: number, y: number): number {
  const z = x * x;
  const w = z * z;
  const r = z * (C1 + z * (C2 + z * C3)) + w * w * (C4 + z * (C5 + z * C6));
  const hz = 0.5 * z;
  const one = 1 - hz;
  return one + (1 - one - hz + (z * r - x * y));
}

const INV_PIO2 = 6.36619772367581382433e-1;
const PIO2_1 = 1.57079632673412561417; // first 33 bits of π/2
const PIO2_2 = 6.0771005063039659766e-11; // next 33 bits
const PIO2_2T = 2.02226624879595063154e-21; // π/2 - (PIO2_1 + PIO2_2)

let redHi = 0;
let redLo = 0;
/** Cody–Waite reduction: x = n·π/2 + (redHi + redLo). Exact for |x| < ~8e5. */
function reduce(x: number): number {
  const n = Math.round(x * INV_PIO2);
  const r0 = x - n * PIO2_1;
  let w = n * PIO2_2;
  const r = r0 - w;
  w = n * PIO2_2T - (r0 - r - w);
  redHi = r - w;
  redLo = r - redHi - w;
  return n;
}

/** Deterministic sine. */
export function dsin(x: number): number {
  if (!Number.isFinite(x)) return NaN;
  if (Math.abs(x) <= 0.7853981633974483) return Math.abs(x) < 7.450580596923828e-9 ? x : kSin(x, 0);
  const n = reduce(x) & 3;
  if (n === 0) return kSin(redHi, redLo);
  if (n === 1) return kCos(redHi, redLo);
  if (n === 2) return -kSin(redHi, redLo);
  return -kCos(redHi, redLo);
}

/** Deterministic cosine. */
export function dcos(x: number): number {
  if (!Number.isFinite(x)) return NaN;
  if (Math.abs(x) <= 0.7853981633974483) return kCos(x, 0);
  const n = reduce(x) & 3;
  if (n === 0) return kCos(redHi, redLo);
  if (n === 1) return -kSin(redHi, redLo);
  if (n === 2) return -kCos(redHi, redLo);
  return kSin(redHi, redLo);
}

// ------------------------------------------------------------------ atan / atan2

const ATAN_HI = [4.63647609000806093515e-1, 7.85398163397448278999e-1, 9.82793723247329054082e-1, 1.570796326794896558];
const ATAN_LO = [2.26987774529616870924e-17, 3.06161699786838301793e-17, 1.39033110312309984516e-17, 6.12323399573676603587e-17];
const AT = [
  3.33333333333329318027e-1, -1.99999999998764832476e-1, 1.42857142725034663711e-1, -1.1111110405462355788e-1, 9.09088713343650656196e-2,
  -7.69187620504482999495e-2, 6.66107313738753120669e-2, -5.83357013379057348645e-2, 4.97687799461593236017e-2, -3.6531572744216915527e-2,
  1.62858201153657823623e-2,
];

/** Deterministic arctangent. */
export function datan(x: number): number {
  if (Number.isNaN(x)) return NaN;
  const neg = x < 0;
  let a = Math.abs(x);
  if (a >= 7.378697629483821e19) return neg ? -(ATAN_HI[3] + ATAN_LO[3]) : ATAN_HI[3] + ATAN_LO[3];
  let id = -1;
  if (a < 0.4375) {
    if (a < 3.725290298461914e-9) return x;
  } else if (a < 1.1875) {
    if (a < 0.6875) {
      id = 0;
      a = (2 * a - 1) / (2 + a);
    } else {
      id = 1;
      a = (a - 1) / (a + 1);
    }
  } else if (a < 2.4375) {
    id = 2;
    a = (a - 1.5) / (1 + 1.5 * a);
  } else {
    id = 3;
    a = -1 / a;
  }
  const z = a * a;
  const w = z * z;
  const s1 = z * (AT[0] + w * (AT[2] + w * (AT[4] + w * (AT[6] + w * (AT[8] + w * AT[10])))));
  const s2 = w * (AT[1] + w * (AT[3] + w * (AT[5] + w * (AT[7] + w * AT[9]))));
  if (id < 0) {
    const r = a - a * (s1 + s2);
    return neg ? -r : r;
  }
  const r = ATAN_HI[id] - (a * (s1 + s2) - ATAN_LO[id] - a);
  return neg ? -r : r;
}

const PI = Math.PI;
const PI_LO = 1.2246467991473532e-16;

/** Deterministic atan2(y, x), same quadrant/sign conventions as Math.atan2. */
export function datan2(y: number, x: number): number {
  if (Number.isNaN(x) || Number.isNaN(y)) return NaN;
  const yNeg = y < 0 || Object.is(y, -0);
  const xNeg = x < 0 || Object.is(x, -0);
  if (y === 0) return xNeg ? (yNeg ? -PI : PI) : y;
  if (x === 0) return yNeg ? -PI / 2 : PI / 2;
  if (!Number.isFinite(x)) {
    if (!Number.isFinite(y)) {
      const r = xNeg ? (3 * PI) / 4 : PI / 4;
      return yNeg ? -r : r;
    }
    return xNeg ? (yNeg ? -PI : PI) : yNeg ? -0 : 0;
  }
  if (!Number.isFinite(y)) return yNeg ? -PI / 2 : PI / 2;
  const z = datan(Math.abs(y / x));
  if (!xNeg) return yNeg ? -z : z;
  const r = PI - (z - PI_LO);
  return yNeg ? -r : r;
}

/** Deterministic hypot (no overflow protection: sim magnitudes are small). */
export function dhypot(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}

// ------------------------------------------------------------------ exp / log / pow

const LN2_HI = 6.9314718036912381649e-1;
const LN2_LO = 1.90821492927058770002e-10;
const INV_LN2 = Math.LOG2E;
const P1 = 1.66666666666666019037e-1;
const P2 = -2.77777777770155933842e-3;
const P3 = 6.61375632143793436117e-5;
const P4 = -1.6533902205465251539e-6;
const P5 = 4.13813679705723846039e-8;

/** Deterministic e^x. */
export function dexp(x: number): number {
  if (Number.isNaN(x)) return NaN;
  if (x > 7.09782712893383973096e2) return Infinity;
  if (x < -7.4513321910194110842e2) return 0;
  const ax = Math.abs(x);
  let hi = 0;
  let lo = 0;
  let k = 0;
  if (ax > 3.4657359027997264e-1) {
    k = ax < 1.0397207708399179 ? (x < 0 ? -1 : 1) : Math.trunc(INV_LN2 * x + (x < 0 ? -0.5 : 0.5));
    hi = x - k * LN2_HI;
    lo = k * LN2_LO;
    x = hi - lo;
  } else if (ax < 3.725290298461914e-9) {
    return 1 + x;
  }
  const t = x * x;
  const c = x - t * (P1 + t * (P2 + t * (P3 + t * (P4 + t * P5))));
  if (k === 0) return 1 - ((x * c) / (c - 2) - x);
  const y = 1 - (lo - (x * c) / (2 - c) - hi);
  return k >= -1021 ? y * pow2(k) : y * pow2(k + 1000) * pow2(-1000);
}

const LG1 = 6.66666666666673513e-1;
const LG2 = 3.999999999940941908e-1;
const LG3 = 2.857142874366239149e-1;
const LG4 = 2.222219843214978396e-1;
const LG5 = 1.818357216161805012e-1;
const LG6 = 1.531383769920937332e-1;
const LG7 = 1.479819860511658591e-1;

/** Deterministic natural log. */
export function dlog(x: number): number {
  if (Number.isNaN(x) || x < 0) return NaN;
  if (x === 0) return -Infinity;
  if (x === Infinity) return Infinity;
  let k = 0;
  let hx = highWord(x);
  if (hx < 0x00100000) {
    k -= 54;
    x *= 1.8014398509481984e16;
    hx = highWord(x);
  }
  k += (hx >> 20) - 1023;
  hx &= 0x000fffff;
  const i0 = (hx + 0x95f64) & 0x100000;
  x = withHighWord(x, hx | (i0 ^ 0x3ff00000));
  k += i0 >> 20;
  const f = x - 1;
  const dk = k;
  if ((0x000fffff & (2 + hx)) < 3) {
    if (f === 0) return k === 0 ? 0 : dk * LN2_HI + dk * LN2_LO;
    const R = f * f * (0.5 - 0.3333333333333333 * f);
    return k === 0 ? f - R : dk * LN2_HI - (R - dk * LN2_LO - f);
  }
  const s = f / (2 + f);
  const z = s * s;
  const w = z * z;
  const t1 = w * (LG2 + w * (LG4 + w * LG6));
  const t2 = z * (LG1 + w * (LG3 + w * (LG5 + w * LG7)));
  const i = (hx - 0x6147a) | (0x6b851 - hx);
  const R = t2 + t1;
  if (i > 0) {
    const hfsq = 0.5 * f * f;
    return k === 0 ? f - (hfsq - s * (hfsq + R)) : dk * LN2_HI - (hfsq - (s * (hfsq + R) + dk * LN2_LO) - f);
  }
  return k === 0 ? f - s * (f - R) : dk * LN2_HI - (s * (f - R) - dk * LN2_LO - f);
}

/**
 * Deterministic x^y. Small integer exponents use exact-order repeated
 * multiplication; everything else is exp(y·log x) (~1e-14 relative error,
 * plenty for generator weights and easing curves).
 */
export function dpow(x: number, y: number): number {
  if (y === 0) return 1;
  if (Number.isNaN(x) || Number.isNaN(y)) return NaN;
  if (Number.isInteger(y) && Math.abs(y) <= 64) {
    let n = Math.abs(y);
    let base = x;
    let r = 1;
    while (n > 0) {
      if (n & 1) r *= base;
      base *= base;
      n >>= 1;
    }
    return y < 0 ? 1 / r : r;
  }
  if (x === 0) return y > 0 ? 0 : Infinity;
  if (x < 0) return NaN; // non-integer power of a negative number
  return dexp(y * dlog(x));
}

/** x², spelled out (the `**` operator is Math.pow under the hood). */
export function sq(x: number): number {
  return x * x;
}
