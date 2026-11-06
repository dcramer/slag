"""A drawing's two buns pushed up and out, clear of her head: buns.py SRC OUT [--push F] [--up U] [--at X,Y,X,Y] [--v].

Drawn, each bun sits snug on a top corner of her head; traced at play size the notch between bun and crown closes
under the pen and head and buns are one flat-topped block, which blind readers took for a fighter's headband (the
fighter, rounds 3 and 4: docs/characters/fighter.md). A mock with the buns set further up and out, a deep V of
background between each and the crown, read as her. So each bun (a light patch the ink closes in, in the figure's
top third, the two biggest) is lifted out with its ink, the hole it leaves is background, and it goes back F of its
width further out (left one left, right one right) and up. Where it covered hair, the background shows: the notch.
"""
import sys
from collections import deque
from PIL import Image, ImageDraw, ImageFilter

args = sys.argv[1:]
F = 0.22
# How far up, for each unit out: out more than up, so her round crown shows between the buns (level with it, the
# top of her head was a flat line, a headband).
UP = 0.8
if '--up' in args:
    i = args.index('--up')
    UP = float(args[i + 1])
    del args[i : i + 2]
V = '--v' in args
if V:
    args.remove('--v')
if '--push' in args:
    i = args.index('--push')
    F = float(args[i + 1])
    del args[i : i + 2]
# `--at X,Y,X,Y`: the buns are the patches nearest these points (a far bun half behind her head, a boot beside it).
AT = None
if '--at' in args:
    i = args.index('--at')
    v = [int(n) for n in args[i + 1].split(',')]
    AT = list(zip(v[::2], v[1::2]))
    del args[i : i + 2]
SRC, OUT = args
im = Image.open(SRC).convert('RGB')
W, H = im.size
px = im.load()
light = lambda p: min(p) >= 150 and p[2] >= p[0] - 12
hair = lambda p: 38 <= p[0] <= 80 and p[1] < 60
fig = [(x, y) for y in range(0, H, 3) for x in range(0, W, 3) if min(px[x, y]) < 228]
top, low = min(y for _, y in fig), max(y for _, y in fig)
band = top + (low - top) * 0.34
# Light patches closed in (never reaching the border), in the top band, the sock's thin fold lines closed over.
lm = Image.new('L', (W, H), 0)
lp = lm.load()
for y in range(H):
    for x in range(W):
        p = px[x, y]
        if min(p) >= 185 or (p[2] - p[0] >= 15 and min(p) >= 130):
            lp[x, y] = 255
lm = lm.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
lp = lm.load()
seen = bytearray(W * H)
patches = []
for y0 in range(top, int(band)):
    for x0 in range(W):
        i0 = y0 * W + x0
        if seen[i0] or lp[x0, y0] < 128:
            continue
        patch, q, edge = [], deque([(x0, y0)]), False
        seen[i0] = 1
        while q:
            x, y = q.popleft()
            patch.append((x, y))
            if x in (0, W - 1) or y in (0, H - 1):
                edge = True
            for xx, yy in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if 0 <= xx < W and 0 <= yy < H and not seen[yy * W + xx] and lp[xx, yy] >= 128:
                    seen[yy * W + xx] = 1
                    q.append((xx, yy))
        if edge or not (400 if AT else 1500) <= len(patch) <= 9000:
            continue
        xs = [x for x, _ in patch]
        ys = [y for _, y in patch]
        bw, bh = max(xs) - min(xs) + 1, max(ys) - min(ys) + 1
        # A bun is round and set on her hair: a boot kicked up beside her head is long, and far from it.
        near = sum(1 for x in range(max(0, min(xs) - 15), min(W, max(xs) + 16), 3) for y in range(max(0, min(ys) - 15), min(H, max(ys) + 16), 3) if hair(px[x, y]))
        if V:
            print(f'patch at {sum(xs) // len(xs)},{sum(ys) // len(ys)} area {len(patch)} box {bw}x{bh} fill {len(patch) / (bw * bh):.2f} hair {near}')
        if AT is not None:
            cx, cy = sum(xs) / len(xs), sum(ys) / len(ys)
            if any(abs(cx - ax) <= 40 and abs(cy - ay) <= 40 for ax, ay in AT):
                patches.append(patch)
        elif max(bw, bh) <= 1.5 * min(bw, bh) and len(patch) >= 0.4 * bw * bh and near >= 40:
            patches.append(patch)
patches.sort(key=len, reverse=True)
buns = patches[:2]
if len(buns) < 2:
    sys.exit(f'{SRC}: found {len(buns)} buns')
buns.sort(key=lambda p: sum(x for x, _ in p) / len(p))
out = im.copy()
op = out.load()
moves = []
for k, bun in enumerate(buns):
    s = set(bun)
    xs = [x for x, _ in bun]
    ys = [y for _, y in bun]
    w = max(xs) - min(xs) + 1
    # The bun with its ink: grown through dark and antialiased pixels, a pen's width.
    whole = set(s)
    front = list(s)
    for _ in range(int(w * 0.09) + 3):
        nxt = []
        for x, y in front:
            for xx, yy in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if (xx, yy) not in whole and 0 <= xx < W and 0 <= yy < H and max(px[xx, yy]) < 200 and not hair(px[xx, yy]):
                    whole.add((xx, yy))
                    nxt.append((xx, yy))
        front = nxt
    dx = round(w * F) * (-1 if k == 0 else 1)
    dy = -round(w * F * UP)
    moves.append((whole, dx, dy, (sum(xs) / len(xs), sum(ys) / len(ys)), w))
    if V:
        print(f'bun {k} at {sum(xs) // len(xs)},{sum(ys) // len(ys)} width {w} moved {dx},{dy}')
for whole, *_ in moves:
    for p in whole:
        op[p] = (255, 255, 255)
# The sock's frilled cuff round the bun's base, light and broken by its folds, is left out of the bun's patch: it
# goes too (only white and the sock's blue shade, never skin or hair), or it parts the knot from her hair.
for _, _, _, (cx, cy), w in moves:
    rr = w * 0.75
    for y in range(max(0, int(cy - rr)), min(H, int(cy + rr) + 1)):
        for x in range(max(0, int(cx - rr)), min(W, int(cx + rr) + 1)):
            q = px[x, y]
            if (x - cx) ** 2 + (y - cy) ** 2 <= rr * rr and (min(q) >= 185 or (q[2] - q[0] >= 15 and min(q) >= 130)):
                op[x, y] = (255, 255, 255)
# Each bun stays on her head by a knot of hair, from where it sat to where it went: pushed clear, the
# buns floated, and a figure in pieces traces as three.
d = ImageDraw.Draw(out)
wk = max(m[4] for m in moves)
for _, dx, dy, (cx, cy), w in moves:
    n = max(1e-6, (dx * dx + dy * dy) ** 0.5)
    a, b = (cx - dx / n * w * 0.8, cy - dy / n * w * 0.8), (cx + dx, cy + dy)
    d.line([a, b], fill=(52, 37, 34), width=round(wk * 0.18))
for whole, dx, dy, *_ in moves:
    for x, y in whole:
        if 0 <= x + dx < W and 0 <= y + dy < H:
            op[x + dx, y + dy] = px[x, y]
out.save(OUT)
print(SRC, 'buns moved')
