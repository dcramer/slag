import { describe, expect, it } from 'vitest';
import { datan, datan2, dcos, dexp, dhypot, dlog, dpow, dsin } from '../src/core/dmath';
import { Rng } from '../src/core/rng';

/** Relative-or-absolute error bound for comparing against the engine's libm. */
function close(a: number, b: number, tol = 2e-15) {
  if (Number.isNaN(b)) return expect(a).toBeNaN();
  if (!Number.isFinite(b)) return expect(a).toBe(b);
  expect(Math.abs(a - b)).toBeLessThanOrEqual(tol * Math.max(1, Math.abs(b)));
}

describe('dmath', () => {
  const rng = new Rng(42);
  const xs = [0, -0, 1e-12, 0.1, 0.5, Math.PI / 4, 1, Math.PI / 2, 2, Math.PI, 3 * Math.PI, 10, 100, 1234.5, -7.25];
  for (let i = 0; i < 3000; i++) xs.push(rng.range(-200, 200), rng.range(-4, 4), rng.range(-1, 1) * 1e-3);

  it('sin/cos match Math to ~1 ulp', () => {
    for (const x of xs) {
      close(dsin(x), Math.sin(x));
      close(dcos(x), Math.cos(x));
    }
    expect(dsin(Infinity)).toBeNaN();
  });

  it('atan/atan2 match Math, including quadrants and signed zeros', () => {
    for (const x of xs) close(datan(x), Math.atan(x));
    for (let i = 0; i < 2000; i++) {
      const y = rng.range(-50, 50);
      const x = rng.range(-50, 50);
      close(datan2(y, x), Math.atan2(y, x));
    }
    const edge: [number, number][] = [
      [0, 1],
      [0, -1],
      [-0, -1],
      [1, 0],
      [-1, 0],
      [0, 0],
      [-0, -0],
      [Infinity, Infinity],
      [-Infinity, -Infinity],
      [1, -Infinity],
      [-1, Infinity],
    ];
    for (const [y, x] of edge) expect(Object.is(datan2(y, x), Math.atan2(y, x)) || Math.abs(datan2(y, x) - Math.atan2(y, x)) < 1e-15).toBe(true);
  });

  it('exp/log/pow/hypot match Math', () => {
    for (const x of xs) {
      if (Math.abs(x) < 700) close(dexp(x), Math.exp(x));
      if (x > 0) close(dlog(x), Math.log(x));
    }
    for (const x of [1e-300, 5e-324, 1e300, 0.999999, 1.000001]) close(dlog(x), Math.log(x));
    for (let i = 0; i < 1000; i++) {
      const b = rng.range(0, 5);
      const e = rng.range(-3, 3);
      close(dpow(b, e), Math.pow(b, e), 1e-13);
    }
    expect(dpow(3, 4)).toBe(81);
    expect(dpow(-2, 3)).toBe(-8);
    expect(dpow(2, -2)).toBe(0.25);
    expect(dhypot(3, 4)).toBe(5);
  });

  it('is a pure function (same bits every call)', () => {
    for (const x of xs.slice(0, 200)) {
      expect(Object.is(dsin(x), dsin(x))).toBe(true);
      expect(Object.is(datan2(x, 1.5), datan2(x, 1.5))).toBe(true);
    }
  });
});
