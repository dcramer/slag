"""The cardboard drone squared and set floating: box.py IN OUT [--v].

Drawn in three-quarter with its lid, tape, dent and string, the box traced at play size as a sack with a pointed top,
and hung off its stick it read as a bundle on a stick, not a drone. Its cardboard is the biggest thick patch of brown
in the drawing; it becomes one upright square over the same box, cardboard inside a pen of ink, and the stick (every
other brown) and the string over the box go, so it floats beside her shoulder.
"""
import sys
from collections import deque

from PIL import Image, ImageDraw, ImageFilter

src, out = sys.argv[1], sys.argv[2]
V = '--v' in sys.argv
im = Image.open(src).convert('RGB')
W, H = im.size
px = im.load()


def brown(c):
    r, g, b = c
    # The cardboard, and the stick's darker wood, which a skin shade's warmth would pass if it weren't kept under 170.
    return (r > 110 and r - b > 50 and g - b > 20 and r - g > 20 and r < 215) or (90 < r < 170 and r - b > 40 and g - b > 10 and r - g > 20)


mask = Image.new('L', (W, H), 0)
mp = mask.load()
for y in range(H):
    for x in range(W):
        if brown(px[x, y]):
            mp[x, y] = 255
k = max(7, (min(W, H) // 90) | 1)
tp = mask.filter(ImageFilter.MinFilter(k)).filter(ImageFilter.MaxFilter(k)).load()
seen = set()
best = []
for y in range(0, H, 3):
    for x in range(0, W, 3):
        if tp[x, y] and (x, y) not in seen:
            comp = []
            q = deque([(x, y)])
            seen.add((x, y))
            while q:
                a, b = q.popleft()
                comp.append((a, b))
                for na, nb in ((a + 1, b), (a - 1, b), (a, b + 1), (a, b - 1)):
                    if 0 <= na < W and 0 <= nb < H and tp[na, nb] and (na, nb) not in seen:
                        seen.add((na, nb))
                        q.append((na, nb))
            if len(comp) > len(best):
                best = comp
if not best:
    sys.exit(f'{src}: no box found')
# The whole box, its lid and side faces too: every brown pixel near the biggest face.
bx0, bx1 = min(a for a, b in best), max(a for a, b in best)
by0, by1 = min(b for a, b in best), max(b for a, b in best)
reach = (bx1 - bx0) * 0.8
near = lambda x, y: bx0 - reach <= x <= bx1 + reach and by0 - reach <= y <= by1 + reach
# Thick brown only: the stick is thin, and the opening takes it out.
whole = [(x, y) for y in range(H) for x in range(W) if tp[x, y] and near(x, y)]
x0, x1 = min(a for a, b in whole), max(a for a, b in whole)
y0, y1 = min(b for a, b in whole), max(b for a, b in whole)
cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
s = max(x1 - x0, y1 - y0) / 2
# Away from her by a third of its size, toward whichever side of the figure it hangs on: drawn hard by her shoulder,
# it joined her head at play size.
fig = [x for y in range(0, H, 4) for x in range(0, W, 4) if min(px[x, y]) < 200]
away = 1 if cx > (min(fig) + max(fig)) / 2 else -1
cx += away * s * 0.35
pen = max(4, round(s * 0.1))
# The stick, and the pen round it, painted out: thin brown away from the box, and the ink along it. The bob's
# white and greys beside it stay.
stick = Image.new('L', (W, H), 0)
sp = stick.load()
for y in range(H):
    for x in range(W):
        if mp[x, y] and not (x0 - 2 <= x <= x1 + 2 and y0 - 2 <= y <= y1 + 2):
            sp[x, y] = 255
grown = stick.filter(ImageFilter.MaxFilter(k + 8)).load()
for y in range(H):
    for x in range(W):
        if grown[x, y]:
            c = px[x, y]
            if mp[x, y] or (max(c) - min(c) < 40 and min(c) < 170):
                px[x, y] = (255, 255, 255)
# The string: the thin ink in the box's columns between it and the stick's tip above.
for y in range(max(0, int(y0 - (y1 - y0) * 1.6)), y0 + 4):
    for x in range(int(cx - s * 0.6), int(cx + s * 0.6)):
        c = px[x, y]
        # Only a thin line in the open: white a few px to each side (a hand or a hilt over the box isn't).
        if max(c) - min(c) < 40 and min(c) < 200 and min(px[x - 7, y]) > 235 and min(px[x + 7, y]) > 235:
            px[x, y] = (255, 255, 255)
# The old box, white, so none of its lid or sides shows beside the square: its cardboard and the pen along it, not a
# hand or a hilt that reaches into its box.
near_box = mask.filter(ImageFilter.MaxFilter(17)).load()
for y in range(max(0, y0 - 6), min(H, y1 + 7)):
    for x in range(max(0, x0 - 6), min(W, x1 + 7)):
        c = px[x, y]
        if mp[x, y] or (near_box[x, y] and max(c) < 150 and max(c) - min(c) < 40):
            px[x, y] = (255, 255, 255)
d = ImageDraw.Draw(im)
d.rectangle((cx - s, cy - s, cx + s, cy + s), fill=(192, 150, 102), outline=(37, 34, 42), width=pen)
if V:
    print(f'{src}: box {x0},{y0}..{x1},{y1} -> square {2 * s:.0f} px')
im.save(out)
