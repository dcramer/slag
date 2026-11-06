"""The idle drawing's cheese slicer shortened: everything past a cut across it slid back up its own line.

python3 -I art/sprites/pyramid/handle.py SRC OUT [PX PY DX DY SHIFT]

Drawn from the wedge edit, the paddle trailed so far behind him that the design (the idle) reached past the cast's
box behind the hitbox, and the whole kind would have had to shrink under 19 px to fit: so the paddle slid 60 px up
its own handle toward the fist (`handle.py drafts/wedge-2.png …`, the defaults). The pyramid's design (drafts/e2-2.png)
reached a world px past it too, and its blade is cut across its middle instead (300 820 -0.845 0.535 50): the blade is a
straight strip, so its two halves overlap along their own edges and it stays one blade, a little shorter. Everything
on the far side of the cut at P, square to the blade (D points along it, away from the fist), moves along the
blade's own line; its end lands about half a world px off the floor.
"""
import sys
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
args = [float(a) for a in sys.argv[3:]]
im = Image.open(src).convert('RGB')
w, h = im.size
px = im.load()
P = (args[0], args[1]) if args else (335, 715)
D = (args[2], args[3]) if args else (-0.85, 0.53)
SHIFT = args[4] if args else 60
DX, DY = round(-D[0] * SHIFT), round(-D[1] * SHIFT)
moved = {}
for y in range(h):
    for x in range(w):
        p = px[x, y]
        if min(p) < 228 and (x - P[0]) * D[0] + (y - P[1]) * D[1] > 0:
            moved[(x, y)] = p
            px[x, y] = (255, 255, 255)
for (x, y), p in moved.items():
    nx, ny = x + DX, y + DY
    if 0 <= nx < w and 0 <= ny < h:
        q = px[nx, ny]
        # Keep whichever is darker where the slid part lands on what was left in place: the ink wins.
        if sum(p) < sum(q) or min(q) >= 228:
            px[nx, ny] = p
im.save(out)
