"""A drawing's eyes recoloured apart from its brows: eyes.py SRC OUT [--r PX] [--at X,Y,…] [--v].

Her eyes are small black ovals drawn touching her frowning brows, so the ink's opening takes eye and brow together
for line and no eyes are found (and the ink's lone-speck rule sees one long scrap, not a round pupil). Every thick
blob of ink in the drawing's top half that skin closes in nearly all round (an eye, never a stretch of outline) is
repainted the eyes' own colour, EYE: the opening with a square of 2r+1 keeps the eye's core and drops the thin brow
and mouth, and the core is grown back inside the ink. The kind's map folds EYE into a role of its own.
"""
import sys
from collections import deque
from PIL import Image, ImageFilter

EYE = (40, 200, 60)
args = sys.argv[1:]
R = 3
V = '--v' in args
if V:
    args.remove('--v')
# `--at X,Y,X,Y…`: take only the blobs within 12 px of these points, set in skin or not (a pose whose eye touches
# the cheek's line, or whose whites were inked first).
AT = None
if '--at' in args:
    i = args.index('--at')
    v = [int(n) for n in args[i + 1].split(',')]
    AT = list(zip(v[::2], v[1::2]))
    del args[i : i + 2]
if '--r' in args:
    i = args.index('--r')
    R = int(args[i + 1])
    del args[i : i + 2]
SRC, OUT = args
im = Image.open(SRC).convert('RGB')
W, H = im.size
px = im.load()
dark = lambda p: max(p) < 90
skin = lambda p: p[0] > 200 and p[1] > 140 and p[0] - p[2] > 45
# The figure's top: the first row with ink.
top = next(y for y in range(H) if any(dark(px[x, y]) for x in range(0, W, 2)))
low = max(y for y in range(0, H, 4) if any(min(px[x, y]) < 200 for x in range(0, W, 4)))
y1 = top + (low - top) * 0.55
mask = Image.new('L', (W, H), 0)
mp = mask.load()
for y in range(top, int(y1)):
    for x in range(W):
        if dark(px[x, y]):
            mp[x, y] = 255
core = mask.filter(ImageFilter.MinFilter(2 * R + 1)).filter(ImageFilter.MaxFilter(2 * R + 1))
cp = core.load()
seen = bytearray(W * H)
n = 0
for y0 in range(top, int(y1)):
    for x0 in range(W):
        if cp[x0, y0] < 128 or seen[y0 * W + x0]:
            continue
        patch, q = [], deque([(x0, y0)])
        seen[y0 * W + x0] = 1
        while q:
            x, y = q.popleft()
            patch.append((x, y))
            for xx, yy in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if 0 <= xx < W and 0 <= yy < H and not seen[yy * W + xx] and cp[xx, yy] >= 128:
                    seen[yy * W + xx] = 1
                    q.append((xx, yy))
        # The ring a few px outside the blob: an eye is set in skin.
        ps = set(patch)
        ring = {(x + dx, y + dy) for x, y in patch for dx, dy in ((-R - 3, 0), (R + 3, 0), (0, -R - 3), (0, R + 3)) if (x + dx, y + dy) not in ps}
        ring = [p for p in ring if 0 <= p[0] < W and 0 <= p[1] < H and not dark(px[p])]
        sk = sum(1 for p in ring if skin(px[p])) / max(1, len(ring))
        xs, ys = [p[0] for p in patch], [p[1] for p in patch]
        bw, bh = max(xs) - min(xs) + 1, max(ys) - min(ys) + 1
        if V:
            print('candidate', sum(xs) // len(xs), sum(ys) // len(ys), len(patch), f'{sk:.2f}', bw, bh)
        cx, cy = sum(xs) / len(xs), sum(ys) / len(ys)
        if AT is not None:
            if not any(abs(cx - ax) <= 12 and abs(cy - ay) <= 12 for ax, ay in AT):
                continue
        elif sk < 0.4 or len(patch) < 100 or len(patch) > 1500 or max(bw, bh) > 3 * min(bw, bh):
            continue
        # Grown back inside the ink, a step at a time, so the whole oval is the eye.
        grow = ps
        for _ in range(2):
            grow = grow | {(x + dx, y + dy) for x, y in grow for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)) if 0 <= x + dx < W and 0 <= y + dy < H and dark(px[x + dx, y + dy])}
        for p in grow:
            px[p] = EYE
        n += 1
        print(f'eye at {sum(xs) // len(xs)},{sum(ys) // len(ys)} area {len(patch)} skin {sk:.2f}')
im.save(OUT)
print(SRC, 'eyes', n)
