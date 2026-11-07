"""The sim's diamond, drawn once: gem.py OUT [--h PX].

The image model's diamond comes back a little different in every drawing, and its tape strip, laid across the middle,
hid the two side points that make it a diamond and not a lozenge. So it is drawn here, in the drawings' own style:
a long double point, its two side points well clear, the near facets lit and the far ones in the mid green, a ridge
down its middle, an ink line in a dark green, and a short strip of grey tape over a crack in its upper far facet, clear
of the points. `float.py` hangs it over her head in every drawing.
"""
import sys
from PIL import Image, ImageDraw

args = sys.argv[1:]
H = 220
if '--h' in args:
    i = args.index('--h')
    H = int(args[i + 1])
    del args[i : i + 2]
(OUT,) = args

S = 4  # supersampled
h = H * S
w = round(h * 0.58)
m = 10 * S
img = Image.new('RGB', (w + 2 * m, h + 2 * m), 'white')
d = ImageDraw.Draw(img)
LIT = (158, 232, 122)
MID = (70, 200, 74)
SHADE = (52, 160, 62)
INK = (24, 96, 40)
TAPE = (154, 156, 152)
TAPE_INK = (90, 92, 90)
mid = 0.5
T = (m + w / 2, m)
B = (m + w / 2, m + h)
L = (m, m + h * mid)
R = (m + w, m + h * mid)
C = (m + w * 0.5, m + h * mid)
# Ink first, the whole outline thick; the facets inset over it.
lw = 7 * S
d.polygon([T, R, B, L], fill=INK)


def inset(pts, k):
    cx = sum(p[0] for p in pts) / len(pts)
    cy = sum(p[1] for p in pts) / len(pts)
    return [(cx + (x - cx) * k, cy + (y - cy) * k) for x, y in pts]


body = inset([T, R, B, L], 1 - lw / (w * 0.55))
t, r, b, l = body
c = (t[0], l[1])
d.polygon([t, c, l], fill=LIT)
d.polygon([t, r, c], fill=MID)
d.polygon([l, c, b], fill=MID)
d.polygon([c, r, b], fill=SHADE)
# The ridge down the middle and across, thin ink.
d.line([t, c, b], fill=INK, width=round(2.5 * S))
d.line([l, c, r], fill=INK, width=round(2.5 * S))
# The crack under the tape, and the tape: a short strip across the upper far facet, its ends cut ragged.
ax, ay = t[0] + (c[0] - t[0]) * 0.5, t[1] + (c[1] - t[1]) * 0.85
bx, by = t[0] + (r[0] - t[0]) * 0.55, t[1] + (r[1] - t[1]) * 0.4
tw = 17 * S
dx, dy = bx - ax, by - ay
n = (dx * dx + dy * dy) ** 0.5
ux, uy = -dy / n * tw / 2, dx / n * tw / 2
strip = [(ax + ux, ay + uy), (bx + ux, by + uy), (bx - ux, by - uy), (ax - ux, ay - uy)]
d.polygon(inset(strip, 1.18), fill=TAPE_INK)
d.polygon(strip, fill=TAPE)
img = img.resize((img.size[0] // S, img.size[1] // S), Image.LANCZOS)
img.save(OUT)
