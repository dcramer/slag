# Paint the hard hat's brim a darker steel than its dome in pose drawings already given a clean dome (dome.py):
# flat, a pale dome over a brim of the same grey read as grey hair at play size. The brim is the hat's light
# warm grey in the band just under the dome's bottom row.
# Args: drawing.png:dome_bottom_row:dome_x0:dome_x1 …
import sys
from PIL import Image

STEEL = (150, 146, 138)


def hatlike(p):
    return 150 < min(p) and max(p) < 240 and max(p) - min(p) < 40 and p[0] >= p[1] - 2


for a in sys.argv[1:]:
    path, y1, x0, x1 = a.split(':')
    y1, x0, x1 = int(y1), int(x0), int(x1)
    im = Image.open(path).convert('RGB')
    px = im.load()
    d = x1 - x0
    n = 0
    for y in range(y1 - int(d * 0.15), y1 + int(d * 0.2)):
        for x in range(x0 - int(d * 0.4), x1 + int(d * 0.4)):
            if 0 <= x < im.width and 0 <= y < im.height and px[x, y] != (186, 180, 168) and hatlike(px[x, y]):
                px[x, y] = STEEL
                n += 1
    im.save(path)
    print(path, 'brim px', n)
