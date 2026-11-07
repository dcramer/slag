"""Bedhead: a loose lock sticking up out of the crown of the bob: bedhead.py IN OUT [--v].

Round and smooth, the white bob over the blindfold read blind as a round white helmet over a visor, four rounds
running (docs/characters/android.md, Rig): a helmet is smooth, hair isn't. She sleeps in a satin mask, so she wakes
with her hair up: one tapered lock off the crown curling back, white inside the drawing's pen (two read as horns).
"""
import math
import sys

from PIL import Image, ImageDraw

src, out = sys.argv[1], sys.argv[2]
V = '--v' in sys.argv
im = Image.open(src).convert('RGB')
W, H = im.size
px = im.load()
HAIR = (239, 235, 225)
INK = (37, 34, 42)


def hairy(c):
    return min(c) > 205 and max(c) - min(c) < 30 and min(c) < 248


# The crown: the topmost row with a good run of hair (a blade held up over her has a few light pixels), and the
# bob's width under it.
top = next(y for y in range(H) if sum(hairy(px[x, y]) for x in range(0, W, 2)) > 30)
# The bob's width a third of the way down the head, about where it's widest above the band.
row = top + 110
xs = [x for x in range(W) if hairy(px[x, row])]
left, right = min(xs), max(xs)
w = right - left
cx = (left + right) / 2


def lock(bx, by, ang, length, base):
    """A tapered lock from (bx, by) on the crown, leaning by `ang` (radians from straight up, minus is back)."""
    pts = []
    n = 8
    for i in range(n + 1):
        t = i / n
        # It curls a little further back along its length.
        a = ang - 0.5 * t * t
        x = bx + math.sin(a) * length * t
        y = by - math.cos(a) * length * t
        half = base / 2 * (1 - t) ** 0.8
        nx, ny = math.cos(a), math.sin(a)
        pts.append(((x - nx * half, y - ny * half), (x + nx * half, y + ny * half)))
    return [p[0] for p in pts] + [p[1] for p in reversed(pts)]


d = ImageDraw.Draw(im)
pen = max(5, round(w * 0.022))
for bx, ang, length, base in ((cx - w * 0.04, -0.35, w * 0.36, w * 0.22),):
    poly = lock(bx, top + w * 0.06, ang, length, base)
    d.polygon(poly, fill=HAIR, outline=INK, width=pen)
    # Its root runs into the bob with no pen across it.
    d.ellipse((bx - base * 0.42, top + w * 0.02, bx + base * 0.42, top + w * 0.12), fill=HAIR)
if V:
    print(f'{src}: crown at {top}, bob {left}..{right}')
im.save(out)
