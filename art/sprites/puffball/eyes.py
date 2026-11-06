"""Marks each googly eye's middle for the eye finder: eyes.py SRC OUT.

The drawings' loose pupils sit at two heights (one rolled down, one up), and the finder pairs two dark specks
only if they're level. The face kit draws its own googly eyes and rolls their pupils itself, so each drawn
pupil is painted out of its white disc and a dark dot set in the disc's middle instead. A disc is a pale patch
closed in by ink, not on the border, in the figure's top two thirds.

The knocked-out drawing (shut discs) was painted by hand instead: each disc a white of its own (the map's `white`)
with a thick ink cross, since a googly eye can't shut and the kit draws no face on a death.
"""

import sys
from collections import deque

from PIL import Image, ImageDraw

src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
W, H = im.size
px = im.load()


def pale(p):
    return min(p) > 185 and max(p) - min(p) < 42 and min(p) < 250


def bg(p):
    return min(p) >= 250


# the figure's box
ys = [y for y in range(H) if any(not bg(px[x, y]) for x in range(0, W, 3))]
top, low = ys[0], ys[-1]
seen = bytearray(W * H)
blobs = []
for y0 in range(top, top + (low - top) * 2 // 3):
    for x0 in range(W):
        if seen[y0 * W + x0] or not pale(px[x0, y0]):
            continue
        q = deque([(x0, y0)])
        seen[y0 * W + x0] = 1
        pts = []
        while q:
            x, y = q.popleft()
            pts.append((x, y))
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < W and 0 <= ny < H and not seen[ny * W + nx] and (pale(px[nx, ny]) or bg(px[nx, ny])):
                    seen[ny * W + nx] = 1
                    q.append((nx, ny))
        # a patch that reaches the border is the background
        if any(x in (0, W - 1) or y in (0, H - 1) for x, y in pts):
            continue
        if len(pts) > 800:
            blobs.append(pts)
blobs.sort(key=len, reverse=True)
d = ImageDraw.Draw(im)
# `level`: the dots set at the discs' mean height, for a head tipped back (idle2's), which the finder can't pair.
level = len(sys.argv) > 3 and sys.argv[3] == 'level'
mid_y = sum((min(p[1] for p in b) + max(p[1] for p in b)) / 2 for b in blobs[:2]) / 2
for pts in blobs[:2]:
    xs = [p[0] for p in pts]
    ys2 = [p[1] for p in pts]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys2), max(ys2)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    rx, ry = (x1 - x0) / 2, (y1 - y0) / 2
    d.ellipse((cx - rx + 4, cy - ry + 4, cx + rx - 4, cy + ry - 4), fill=(224, 207, 209))
    r = 0.36 * (rx + ry) / 2
    dy = mid_y if level else cy
    d.ellipse((cx - r, dy - r, cx + r, dy + r), fill=(52, 13, 32))
    print(f'{src}: disc at {cx:.0f},{cy:.0f} r {rx:.0f}x{ry:.0f}')
im.save(out)
