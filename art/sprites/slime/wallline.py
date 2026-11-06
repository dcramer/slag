"""The drawn wall line beside the wall slide taken out of a pose sheet before it is cut (tools/art3d/README.md → 3. Poses).

python3 -I art/sprites/slime/wallline.py SHEET OUT X

The line is a thin dark column through X. In each row, the dark run through X goes white where background lies on
its left: above and below the figure, and where the body bulges away from the wall. Where the body's own outline
runs into it, it stays, and the body ends flat against the wall.
"""
import sys

from PIL import Image

src, out, x = sys.argv[1], sys.argv[2], int(sys.argv[3])
im = Image.open(src).convert('RGB')
w, h = im.size
px = im.load()


def dark(p):
    return max(p) < 150


def light(p):
    return min(p) >= 228


for y in range(h):
    if not dark(px[x, y]):
        continue
    a = x
    while a > 0 and dark(px[a - 1, y]):
        a -= 1
    b = x
    while b < w - 1 and dark(px[b + 1, y]):
        b += 1
    if b - a > 12:
        continue
    left = px[a - 1, y] if a > 0 else (255, 255, 255)
    left2 = px[a - 2, y] if a > 1 else (255, 255, 255)
    if light(left) or (not dark(left) and light(left2)):
        for i in range(a - 1, b + 2):
            if 0 <= i < w:
                px[i, y] = (255, 255, 255)
im.save(out)
