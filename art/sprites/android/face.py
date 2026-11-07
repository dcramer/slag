"""Her face out from under the bob: face.py IN OUT [--v].

Six blind reads saw the bob over the blindfold as a round white helmet with a visor (docs/characters/android.md,
Rig): a helmet has no face under it. So the bob is cut off at her jaw, with background under it beside her neck,
her mouth is painted in red lips (a face mark, like the zapmouse's cheeks), and two loose strands break the dome's
back. Runs after thin.py, on the narrowed mask, whose rows set the jaw: the mask was about as tall as the face from it
to the jaw.
"""
import math
import sys
from collections import deque

from PIL import Image, ImageDraw, ImageFilter

src, out = sys.argv[1], sys.argv[2]
V = '--v' in sys.argv
im = Image.open(src).convert('RGB')
W, H = im.size
px = im.load()
dark = im.convert('L').point(lambda v: 255 if v < 70 else 0)
k = max(9, (min(W, H) // 60) | 1)
tp = dark.filter(ImageFilter.MinFilter(k)).filter(ImageFilter.MaxFilter(k)).load()
ys = [y for y in range(0, H, 2) for x in range(0, W, 4) if min(px[x, y]) < 240]
top, low = min(ys), max(ys)
seen = set()
best = []
for y in range(top, top + (low - top) // 2, 3):
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
front = max(a for a, b in best)
back = min(a for a, b in best)
col = front - max(6, (front - back) // 10)
rows = [b for a, b in best if a == col]
mt, mb = min(rows), max(rows)
h = mb - mt
wide = front - back


def hairy(c):
    return min(c) > 150 and max(c) - min(c) < 30 and min(c) < 250


def skin(c):
    r, g, b = c
    return r > 185 and r - b > 35 and g > 130


jaw = mb + 2.2 * h
cut = jaw - 0.2 * h
# The bob below the jaw, its pen with it: background now, so it ends at her jaw with the neck clear beside it.
# The cut rises toward the back: its tips curl in under her jaw at the front.
for y in range(int(cut - 0.5 * h), min(H, int(jaw + 2.6 * h))):
    for x in range(max(0, back - 40), min(W, front + 40)):
        if y < cut - 0.5 * h * (front - x) / wide:
            continue
        c = px[x, y]
        if hairy(c) or (max(c) < 110 and max(c) - min(c) < 40 and not any(skin(px[min(W - 1, x + d), y]) and skin(px[max(0, x - d), y]) for d in (6,))):
            px[x, y] = (255, 255, 255)
# The tips curl in: round the cut's ends with a soft notch of background.
d = ImageDraw.Draw(im)
# Red lips where her drawn mouth is: the dark speck in her skin between the mask and the jaw, toward the front.
spots = [
    (x, y)
    for y in range(int(mb + 0.5 * h), int(jaw))
    for x in range(int(front - 0.55 * wide), front)
    if max(px[x, y]) < 120 and sum(skin(px[x + dx, y + dy]) for dx, dy in ((0, -8), (0, 8), (-8, 0), (8, 0))) >= 2
]
if spots:
    mx = sum(a for a, b in spots) / len(spots)
    my = sum(b for a, b in spots) / len(spots)
else:
    mx, my = front - 0.3 * wide, mb + 1.1 * h
rx, ry = wide * 0.12, wide * 0.06
d.ellipse((mx - rx, my - ry, mx + rx, my + ry), fill=(200, 70, 90), outline=(37, 34, 42), width=max(3, round(rx * 0.18)))
# Two loose strands off the back of the dome, from its outline up and out.
crown = next(y for y in range(H) if sum(hairy(px[x, y]) for x in range(0, W, 2)) > 30)
for u, ang, length in ((0.25, -1.2, 0.2), (0.55, -0.9, 0.16)):
    by = crown + (mt - crown) * u
    bx = next(x for x in range(W) if hairy(px[x, int(by)]))
    pts = []
    for j in range(9):
        t = j / 8
        a = ang - 0.6 * t
        pts.append((bx + 6 + math.sin(a) * wide * length * t, by - math.cos(a) * wide * length * t))
    for w, colour in ((max(11, round(wide * 0.075)), (37, 34, 42)), (max(6, round(wide * 0.045)), (239, 235, 225))):
        for a, b in zip(pts, pts[1:]):
            d.line((a, b), fill=colour, width=w)
            d.ellipse((b[0] - w / 2, b[1] - w / 2, b[0] + w / 2, b[1] + w / 2), fill=colour)
if V:
    print(f'{src}: mask {mt}..{mb} front {front} jaw {jaw:.0f} mouth {mx:.0f},{my:.0f} ({len(spots)} px)')
im.save(out)
