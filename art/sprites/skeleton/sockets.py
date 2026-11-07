"""Fills the skull's eye sockets solid: the pupil in each (a bone pinprick, a cyan glow round a dot) painted black,
so each socket traces as one dark speck the face kit finds and paints over with its own `socket` eye. Then paints
the teeth under them one flat placeholder colour (TEETH), the `teeth` role: drawn in bone, the grin traced into
the skull and was gone at play scale, and with a role of their own the row of teeth is a white band in a pen.

    python3 -I art/sprites/skeleton/sockets.py IMG.png...   (each painted in place)

A socket is a small round patch of black standing apart from the outline, with one or two patches closed in by it
(the pupil, or the glow's ring round its dot). The grin is closed in by ink too, but as a row of teeth, many patches
in a wide box, so it's left alone, and so is the outline, whose box is the figure's.
"""

import sys
from collections import deque

from PIL import Image


def dark(c):
    return max(c) < 90


def comps(w, h, inside):
    """Connected patches of the pixels `inside` says, each a list of (x, y)."""
    seen = bytearray(w * h)
    out = []
    for y0 in range(h):
        for x0 in range(w):
            if seen[y0 * w + x0] or not inside(x0, y0):
                continue
            seen[y0 * w + x0] = 1
            comp, q = [], deque([(x0, y0)])
            while q:
                x, y = q.popleft()
                comp.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and inside(nx, ny):
                        seen[ny * w + nx] = 1
                        q.append((nx, ny))
            out.append(comp)
    return out


def fill(src):
    im = Image.open(src).convert('RGB')
    W, H = im.size
    px = im.load()
    filled = 0
    for comp in comps(W, H, lambda x, y: dark(px[x, y])):
        if len(comp) < W * H * 0.0003:
            continue
        xs = [p[0] for p in comp]
        ys = [p[1] for p in comp]
        x0, y0, x1, y1 = min(xs) - 1, min(ys) - 1, max(xs) + 2, max(ys) + 2
        bw, bh = x1 - x0, y1 - y0
        # A socket is a solid patch: a hand's fingers or the loop's ring close in patches too, but are thin.
        if bw > W * 0.12 or bh > H * 0.12 or not 0.5 < bh / bw < 2 or len(comp) / (bw * bh) < 0.45:
            continue
        mine = set(comp)
        # What the patch closes in: everything in its box the box's border can't reach round it.
        holes = [
            c
            for c in comps(bw, bh, lambda x, y: (x + x0, y + y0) not in mine)
            if not any(x == 0 or y == 0 or x == bw - 1 or y == bh - 1 for x, y in c)
        ]
        if not holes or len(holes) > 2:
            continue
        # The background in the hanging loop's eye, closed in by its ink, stays.
        if all(sum(min(px[x + x0, y + y0]) >= 238 for x, y in c) > len(c) * 0.5 for c in holes):
            continue
        for c in holes:
            for x, y in c:
                px[x + x0, y + y0] = (1, 1, 2)
        filled += 1
    teeth = grin(px, W, H)
    gloss(px, W, H)
    im.save(src)
    print(src, 'filled', filled, 'teeth', teeth)


TEETH = (255, 0, 255)
NOSE = (0, 200, 0)


def nose(px, W, H, sockets):
    """The nose's dark triangle, point up, between and under the sockets, in its own colour. The drawn one is ink,
    often run into a socket or the seam, so the face kit took it for a speck of the drawn face and painted it out;
    with no nose the skull read as a ghost. So it's painted afresh where the drawing has it."""
    from PIL import Image, ImageDraw

    (_, ax0, ay0, ax1, ay1), (_, bx0, by0, bx1, by1) = sorted(sockets, key=lambda s: s[1])
    sh = max(ay1 - ay0, by1 - by0)
    cx = (ax1 + bx0) / 2
    top = (ay0 + ay1 + by0 + by1) / 4 + sh * 0.12
    bot = top + sh * 0.36
    hw = sh * 0.15
    m = Image.new('L', (W, H), 0)
    ImageDraw.Draw(m).polygon([(cx, top), (cx + hw, bot), (cx - hw, bot)], fill=255)
    mm = m.load()
    inside = lambda x, y, b: b[1] <= x <= b[3] and b[2] <= y <= b[4]
    for y in range(int(top), int(bot) + 1):
        for x in range(int(cx - hw), int(cx + hw) + 1):
            if mm[x, y] and px[x, y] not in (TEETH, LIP) and not (dark(px[x, y]) and (inside(x, y, sockets[0]) or inside(x, y, sockets[1]))):
                px[x, y] = NOSE


def gloss(px, W, H):
    """The skull's white gloss painted bone: lighter than the background's cut-off, it was cut through as a hole."""

    def bone(c):
        return c[0] > 195 and 6 <= c[0] - c[2] <= 45

    for c in comps(W, H, lambda x, y: min(px[x, y]) >= 238):
        if any(x == 0 or y == 0 or x == W - 1 or y == H - 1 for x, y in c):
            continue
        mine = set(c)
        rim = [(nx, ny) for x, y in c for nx, ny in ((x + 2, y), (x - 2, y), (x, y + 2), (x, y - 2)) if (nx, ny) not in mine and 0 <= nx < W and 0 <= ny < H]
        if rim and sum(bone(px[p]) for p in rim) / len(rim) > 0.6:
            for p in c:
                px[p] = (232, 226, 206)


def find(px, W, H):
    """The two sockets, biggest first, as (area, x0, y0, x1, y1): the two biggest solid round patches of black."""
    sockets = []
    for comp in comps(W, H, lambda x, y: dark(px[x, y])):
        if len(comp) < W * H * 0.0006:
            continue
        xs = [p[0] for p in comp]
        ys = [p[1] for p in comp]
        bw, bh = max(xs) - min(xs) + 1, max(ys) - min(ys) + 1
        if bw > W * 0.12 or bh > H * 0.12 or not 0.4 < bh / bw < 2.5 or len(comp) / (bw * bh) < 0.5:
            continue
        sockets.append((len(comp), min(xs), min(ys), max(xs), max(ys)))
    return sorted(sockets, reverse=True)[:2]


def grin(px, W, H):
    """The teeth: light patches closed in by ink just under the two sockets."""
    sockets = find(px, W, H)
    if len(sockets) < 2:
        return 0
    x0 = min(s[1] for s in sockets)
    x1 = max(s[3] for s in sockets)
    y1 = max(s[4] for s in sockets)
    sh = max(s[4] - s[2] for s in sockets)
    if abs(sockets[0][2] - sockets[1][2]) > (x1 - x0) * 0.6:
        return 0  # a skull lying on its side: no grin under the sockets
    span = x1 - x0
    bx0, by0 = max(0, int(x0 - span * 0.35)), int(y1 - sh * 0.1)
    bx1, by1 = min(W, int(x1 + span * 0.35)), min(H, int(y1 + sh * 2.2))
    bw, bh = bx1 - bx0, by1 - by0
    n = 0
    for c in comps(bw, bh, lambda x, y: not dark(px[x + bx0, y + by0])):
        if any(x == 0 or y == 0 or x == bw - 1 or y == bh - 1 for x, y in c) or len(c) < 20:
            continue
        cols = [px[x + bx0, y + by0] for x, y in c]
        bright = sum(max(k) for k in cols) / len(cols)
        if bright < 215:
            continue
        for x, y in c:
            px[x + bx0, y + by0] = TEETH
        n += 1
    lips(px, W, H, sh)
    nose(px, W, H, sockets)
    return n


LIP = (0, 255, 255)


def lips(px, W, H, sh):
    """A dark rim round the teeth, its own colour: the drawn grin's line is thin ink, which the tracer drops, and the
    teeth alone traced as a white blob with no grin to it."""
    teeth = {(x, y) for y in range(H) for x in range(W) if px[x, y] == TEETH}
    # The ink between the teeth joins them into one band first: left as ink it went into the rim, and the teeth were
    # islands in a dark blob that the tracer ate.
    k = max(2, round(sh * 0.07))
    disc = [(dx, dy) for dx in range(-k, k + 1) for dy in range(-k, k + 1) if dx * dx + dy * dy <= k * k]
    grown = {(x + dx, y + dy) for x, y in teeth for dx, dy in disc}
    closed = {q for q in grown if all((q[0] + dx, q[1] + dy) in grown for dx, dy in disc)}
    for q in closed - teeth:
        if 0 <= q[0] < W and 0 <= q[1] < H and dark(px[q]):
            px[q] = TEETH
            teeth.add(q)
    r = max(3, round(sh * 0.12))
    ring = set()
    for x, y in teeth:
        for dx in range(-r, r + 1):
            for dy in range(-r, r + 1):
                q = (x + dx, y + dy)
                if q in teeth or q in ring or not (0 <= q[0] < W and 0 <= q[1] < H) or dx * dx + dy * dy > r * r:
                    continue
                c = px[q]
                # Over the skull's bone and the ink round the teeth; never over the background or the fur.
                if min(c) < 236 and (dark(c) or c[0] - c[2] >= 6):
                    ring.add(q)
    for q in ring:
        px[q] = LIP


if __name__ == '__main__':
    for f in sys.argv[1:]:
        fill(f)
