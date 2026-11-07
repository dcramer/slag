"""nowall.py IN OUT: whiten a drawn wall line: the low-chroma darks of the columns dark most of the way down a tall run."""
import sys
from PIL import Image

im = Image.open(sys.argv[1]).convert('RGB')
w, h = im.size
px = im.load()


def dark(c):
    return max(c) < 110 and max(c) - min(c) < 40


walls = []
for x in range(w):
    n = sum(1 for y in range(h) if dark(px[x, y]))
    if n > 0.3 * h:
        walls.append(x)
print('wall columns', walls)
gone = 0
for x in walls:
    for xx in range(max(0, x - 3), min(w, x + 4)):
        for y in range(h):
            c = px[xx, y]
            if max(c) < 215 and max(c) - min(c) < 30:
                gone += 1
                px[xx, y] = (255, 255, 255)
print('whitened', gone)
im.save(sys.argv[2])
