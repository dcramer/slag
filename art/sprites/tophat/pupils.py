"""Paints a drawing's two pupils bigger, so the build finds them as eyes.

Args: drawing.png X1,Y1 X2,Y2 R (rewritten in place). The image model draws the far pupil (or both, wide-eyed) as a sliver in a
big white, thinner than the map's ink filter, so they were taken for line and the pose traced with no face. Each
pupil is a disc of R image px at the given point, in the pupil's own darkest colour found within R of it. Run it once
on a fresh cut; the calls are in design.prompt.txt.
"""
import sys
from PIL import Image

path, a, b, r = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
im = Image.open(path).convert('RGB')
px = im.load()
for at in (a, b):
    cx, cy = map(int, at.split(','))
    dark = min((px[cx + dx, cy + dy] for dx in range(-r, r + 1) for dy in range(-r, r + 1)), key=sum)
    for dx in range(-r, r + 1):
        for dy in range(-r, r + 1):
            if dx * dx + dy * dy <= r * r:
                px[cx + dx, cy + dy] = dark
    print(path, 'pupil at', cx, cy, 'r', r, dark)
im.save(path)
