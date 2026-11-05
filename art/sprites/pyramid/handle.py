"""The idle drawing's cheese slicer, its handle shortened: the paddle slid up its own handle toward the fist.

python3 -I art/sprites/pyramid/handle.py drafts/wedge-2.png design.png

Drawn from the wedge edit, the paddle trailed so far behind him that the design (the idle) reached past the cast's
box behind the hitbox, and the whole kind would have had to shrink under 19 px to fit. Everything on the paddle's
side of a cut across the handle's neck moves along the handle's own line, so the handle stays straight; the paddle
ends about a world px off the floor.
"""
import sys
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
w, h = im.size
px = im.load()
# The cut: a line across the handle's neck at P, square to the handle (D points along it to the paddle).
P = (335, 715)
D = (-0.85, 0.53)
SHIFT = 60
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
        # Keep whichever is darker where the slid neck lands on the handle left in place: the ink wins.
        if sum(p) < sum(q) or min(q) >= 228:
            px[nx, ny] = p
im.save(out)
