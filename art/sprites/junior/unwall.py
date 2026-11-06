"""Whitens the wall line the image model drew beside the wall slide (README → 3. Poses, a drawn wall line).

Args: sheet.png out.png. A column dark for 40% of the way down or more is the wall; only its dark pixels, and those of
its neighbours within 3 px, go white, so the skates braced on it keep their fills.
"""
import sys
from PIL import Image

im = Image.open(sys.argv[1]).convert('RGB')
w, h = im.size
px = im.load()
dark = lambda x, y: max(px[x, y]) < 110
cols = [x for x in range(w) if sum(dark(x, y) for y in range(h)) > h * 0.4]
for x0 in cols:
    for x in range(max(0, x0 - 3), min(w, x0 + 4)):
        for y in range(h):
            if min(px[x, y]) < 200 and max(px[x, y]) - min(px[x, y]) < 40:
                px[x, y] = (255, 255, 255)
im.save(sys.argv[2])
print('wall columns', cols)
