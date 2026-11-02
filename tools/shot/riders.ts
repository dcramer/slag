/** Parts riding movers (src/sim/props/ride.ts): the place ghost sticking to a mover, then a race at three moments of the ride. */
import { open, page, seed, sheet, snap, step, type Scenarios } from './ctx';

/** Pin the camera on a world point (or hand it back with null): stepped frames otherwise reframe it. */
async function closeUp(at: { x: number; y: number } | null, zoom = 2.6) {
  await page.evaluate(
    ([p, z]) => {
      const r = (window as any).slagDebug.renderer;
      r.__updateCamera ??= r.updateCamera;
      if (!p) {
        r.updateCamera = r.__updateCamera;
        return;
      }
      r.updateCamera = () => {};
      r.cam.snap({ cx: p.x, cy: p.y, zoom: z });
      r.cam.shake = 0;
    },
    [at, zoom] as const,
  );
}

const topOf = (uid: number, part = 0) =>
  page.evaluate(([u, n]) => (window as any).slagDebug.topOf(u, n), [uid, part] as const) as Promise<{ x: number; y: number }>;

export const shots: Scenarios = {
  /** `pnpm shot riders --seed S`: a lift and a cog wheel with blocks and coats stuck on. */
  async riders() {
    await open(`seed=${seed}&players=1`);
    await step(5);
    const uids: number[] = await page.evaluate(() => (window as any).slagDebug.riders());
    if (uids.length < 6) throw new Error(`no room for a lift and a wheel on seed ${seed}: try another`);
    const [lift, , , wheel, wheelBlock] = uids;
    // Into place holding a slime coat: once the wipe is over, aim it at the block riding the wheel (a chain), then hold a block against the lift's side.
    await page.evaluate(() => {
      const d = (window as any).slagDebug;
      const m = d.match;
      const p = m.players[0];
      p.claim = 0;
      m.crate[0].claimedBy = p.slot;
      m.crate[0].def = d.still('slimecoat', 3);
    });
    await step(150);
    // The phase wipe runs on wall-clock time, not sim frames: let it finish.
    await page.waitForTimeout(800);
    /** Aim at part `uid` frame by frame until the ghost sticks to `want` (the frame the page booted on decides where everything is). */
    const aim = async (uid: number, dx: number, dy: number, want: number) => {
      for (let tries = 0; tries < 240; tries++) {
        await page.evaluate(
          ([u, x, y]) => {
            const d = (window as any).slagDebug;
            const at = d.topOf(u);
            d.match.players[0].cursor = { x: at.x + x, y: at.y + y };
          },
          [uid, dx, dy] as const,
        );
        await step(1);
        const g = await page.evaluate(() => {
          const m = (window as any).slagDebug.match;
          const gh = m.ghostOrigin(m.players[0]);
          return gh && { ok: gh.ok, rides: gh.ride?.uid ?? null, chain: gh.ride?.parent.ride?.uid ?? null };
        });
        if (g?.ok && g.rides === want) return console.log(`ghost after ${tries + 1} frames: ${JSON.stringify(g)}`);
      }
      throw new Error(`the ghost never stuck to ${want}`);
    };
    const still = () => page.evaluate(() => (window as any).slagDebug.render());
    // A slime coat on the block riding the wheel: a chain.
    await aim(wheelBlock, 0, 8, wheelBlock);
    await snap(`riders-${seed}-place-coat`);
    await closeUp(await topOf(wheel));
    await still();
    const files = [await snap(`riders-${seed}-place-coat-close`)];
    await closeUp(null);
    await page.evaluate(() => {
      const d = (window as any).slagDebug;
      d.match.crate[0].def = d.still('platform', 2);
    });
    // A block against the lift's side.
    await aim(lift, -24, 8, lift);
    await closeUp(await topOf(lift));
    await still();
    files.push(await snap(`riders-${seed}-place-block-close`));
    await closeUp(null);
    // The race: the same riders at three points of their movers' cycles, whole and close up.
    await page.evaluate(() => (window as any).slagDebug.match.startRun());
    for (const n of [70, 45, 45]) {
      await step(n);
      const f = await page.evaluate(() => (window as any).slagDebug.match.run.frame);
      await snap(`riders-${seed}-race-${f}`);
      for (const [name, uid] of [
        ['lift', lift],
        ['wheel', wheel],
      ] as const) {
        await closeUp(await topOf(uid));
        await page.evaluate(() => (window as any).slagDebug.render());
        files.push(await snap(`riders-${seed}-race-${f}-${name}`));
      }
      await closeUp(null);
    }
    await sheet(`riders-${seed}`, files, 2);
  },
};
