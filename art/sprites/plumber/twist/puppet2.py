"""Slide the round-2 design's cup in along its handle: puppet2.py IN OUT DX DY

The cup and its ferrule are everything left of x 285 between y 80 and 370 (nothing else of him is there); moved
along the handle's own slope, they land back on it, over the stretch they now cover.
"""
import sys
from PIL import Image

src, out, DX, DY = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
im = Image.open(src).convert('RGB')
cup = im.crop((0, 80, 285, 370))
mask = cup.convert('L').point(lambda v: 255 if v < 245 else 0)
im.paste((255, 255, 255), (0, 80, 285, 370))
im.paste(cup, (DX, 80 + DY), mask)
im.save(out)
