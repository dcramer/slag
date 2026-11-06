"""Lengthen the design's plunger handle: move the cup further out behind the head and bridge the gap with copies
of the handle. puppet.py IN OUT DX DY

The cup and the handle stub are everything left of x 340 above y 450 (nothing else of him is there); the bridge
is the handle's piece just left of the ear, x 336..366, repeated along the move.
"""
import sys
from PIL import Image

src, out, DX, DY = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
PAD = 200
im = Image.open(src).convert('RGB')
W, H = im.size
canvas = Image.new('RGB', (W + PAD, H), (255, 255, 255))
canvas.paste(im, (PAD, 0))


def mask_of(tile):
    return tile.convert('L').point(lambda v: 255 if v < 245 else 0)


cup = im.crop((0, 0, 340, 450))
piece = im.crop((336, 320, 366, 420))
# Whiten the old cup.
canvas.paste((255, 255, 255), (PAD, 0, PAD + 340, 450))
# The bridge first, so the cup's own outline lies over its ends.
steps = max(1, round(abs(DX) / 26))
for k in range(steps + 1):
    t = k / steps
    x = PAD + 336 + round(DX * t)
    y = 320 + round(DY * t)
    canvas.paste(piece, (x, y), mask_of(piece))
canvas.paste(cup, (PAD + DX, DY), mask_of(cup))
canvas.save(out)
