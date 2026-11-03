/**
 * A Canvas2D context that draws nothing: every method is a no-op and text measures 6 px a character, so
 * code that lays out and draws (the menus, src/ui/kit) runs in tests with no DOM.
 */
export function mockCtx(): CanvasRenderingContext2D {
  const t: Record<string, unknown> = {
    measureText: (s: string) => ({ width: s.length * 6 }),
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
  };
  return new Proxy(t, {
    get: (o, k) => (k in o ? o[k as string] : () => {}),
    set: (o, k, v) => {
      o[k as string] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

/** Path2D for Node: the kit cuts clip paths with it. */
export class MockPath {
  moveTo() {}
  lineTo() {}
  closePath() {}
}
