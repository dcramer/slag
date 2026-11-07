"""Paints the hands of every drawing a pale lime, so the role map gives them a role of their own: white gloves.

Args: none (rewrites design.png and flat/*.png in place, beside this file). The image model drew his hands as
peach tin mittens, the muzzle's and belly's own colour; in the clean colour read (2026-11-06) the white gloves
and white shoes are what name the speedster in a colour that isn't his. A patch is a 4-connected run of pixels
nearest a peach family colour, over 300 px, numbered in scan order; HANDS lists each drawing's hand patches
(picked by eye from `list`). The lime is darker than the background's 228, so `holes` never takes a glove.
Run after whites.py and edges.py, once: a painted drawing has no peach hands left to find, and its numbering moves.

  python3 -I gloves.py list drawing.png debug.png   # the patches, numbered, to pick from
  python3 -I gloves.py                              # paint every drawing's HANDS
"""
import os
import sys
from collections import deque
from PIL import Image, ImageDraw

GLOVE = (200, 230, 150)
PEACH = [(246, 161, 105), (248, 167, 113), (235, 159, 109), (226, 181, 151), (203, 168, 146)]
# Every other colour family of the drawings (flat/kinds/hedgehog.ts), so a pixel goes to its nearest.
OTHER = [
    (74, 98, 153), (60, 81, 130), (64, 81, 132), (71, 86, 134), (57, 68, 100), (75, 101, 151), (86, 85, 110), (176, 198, 232), (128, 144, 163),
    (165, 30, 24), (158, 39, 31), (78, 22, 15), (132, 132, 133), (152, 150, 151), (109, 107, 110), (120, 125, 129), (255, 255, 252),
    (218, 210, 198), (238, 234, 224), (50, 30, 27), (34, 11, 10), (51, 42, 47), (37, 28, 31), (75, 51, 48), (88, 140, 68), GLOVE,
]
HANDS = {
    'design': range(6, 20),
    # The second idle (fists on hips) was drawn with lime gloves: `gloves.py flat flat/idle2.png`. The arms-folded
    # one it replaced, sheets/colour/idle2-folded.png, was patches 7 to 14.
    'walk-1': range(6, 20),
    'walk-2': range(6, 20),
    'run-1': (5, 7, 8, 9, 10, 11, 12, 14, 15, 16),
    'run-2': range(6, 18),
    'wall': (5, 7, 8, 9, 10, 11, 13),
    'cheer': (0, 1, 2, 3, 4, 5, 6, 7, 14, 15, 16, 17, 18, 19, 20),
    'cheer2': range(0, 19),
    'death': (4, 7, 9, 10, 11),
}


def patches(im):
    w, h = im.size
    fam = PEACH + OTHER
    pal = [v for c in fam for v in c] + list(fam[-1]) * (256 - len(fam))
    pi = Image.new('P', (1, 1))
    pi.putpalette(pal)
    q = im.quantize(palette=pi, dither=Image.Dither.NONE).load()
    isp = bytearray(w * h)
    for y in range(h):
        for x in range(w):
            isp[y * w + x] = q[x, y] < len(PEACH)
    mark = bytearray(w * h)
    got = []
    for y in range(h):
        for x in range(w):
            i = y * w + x
            if mark[i] or not isp[i]:
                continue
            pts = []
            dq = deque([(x, y)])
            mark[i] = 1
            while dq:
                a, b = dq.popleft()
                pts.append((a, b))
                for c, e in ((a + 1, b), (a - 1, b), (a, b + 1), (a, b - 1)):
                    if 0 <= c < w and 0 <= e < h and not mark[e * w + c] and isp[e * w + c]:
                        mark[e * w + c] = 1
                        dq.append((c, e))
            if len(pts) > 300:
                got.append(pts)
    return got


if len(sys.argv) > 1 and sys.argv[1] == 'flat':
    # A drawing the image model drew with the lime gloves already (sheets/s3R-2.png): its lime, shades and
    # highlights, flattened to GLOVE, or the light highlights trace as white flecks. The green irises are darker.
    for path in sys.argv[2:]:
        im = Image.open(path).convert('RGB')
        px = im.load()
        n = 0
        for y in range(im.height):
            for x in range(im.width):
                r, g, b = px[x, y]
                if g - b > 22 and g >= r and r > 112:
                    px[x, y] = GLOVE
                    n += 1
        im.save(path)
        print(path, n)
elif len(sys.argv) > 1 and sys.argv[1] == 'list':
    im = Image.open(sys.argv[2]).convert('RGB')
    dbg = im.copy()
    d = ImageDraw.Draw(dbg)
    for k, pts in enumerate(patches(im)):
        cx = sum(p[0] for p in pts) // len(pts)
        cy = sum(p[1] for p in pts) // len(pts)
        d.text((cx - 6, cy - 6), str(k), fill=(255, 0, 255))
        print(k, len(pts), cx, cy)
    dbg.save(sys.argv[3])
else:
    here = os.path.dirname(os.path.abspath(__file__))
    for name, ids in HANDS.items():
        path = os.path.join(here, 'design.png' if name == 'design' else f'flat/{name}.png')
        im = Image.open(path).convert('RGB')
        px = im.load()
        n = 0
        for k, pts in enumerate(patches(im)):
            if k in ids:
                n += 1
                for a, b in pts:
                    px[a, b] = GLOVE
        im.save(path)
        print(name, n, 'patches')
