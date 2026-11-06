"""Paints the quills' pale folded tin edge a clear light blue, so the role map tells it from the eye whites and teeth.

Args: drawing.png [...] (each rewritten in place). The image model draws the folded edge in the same pale
off-white as the eyes. Every patch of pale near-neutral (least channel over 170, chroma under 40, not the
background) whose ring just outside it (less the ink) is mostly the quills' blue, with no green iris in or by its box, is the edge:
it is painted EDGE. An eye white (with its iris in its box) and the teeth (ringed by peach and ink) stay.
Run after whites.py. Unpainted, design.png is tin/fatworn-1.png; the poses are cut from sheets/.
"""
import sys
from collections import deque
from PIL import Image

EDGE = (176, 198, 232)


def pale(c):
    return min(c) > 170 and max(c) - min(c) < 40 and min(c) < 236


def bluish(c):
    r, g, b = c
    return b - r > 35 and b < 200


def green(c):
    r, g, b = c
    return g - r > 25 and g - b > 15


for path in sys.argv[1:]:
    im = Image.open(path).convert('RGB')
    w, h = im.size
    px = im.load()
    done = bytearray(w * h)
    painted = 0
    for y0 in range(h):
        for x0 in range(w):
            i0 = y0 * w + x0
            if done[i0] or not pale(px[x0, y0]):
                continue
            patch = []
            q = deque([(x0, y0)])
            done[i0] = 1
            while q:
                x, y = q.popleft()
                patch.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    j = ny * w + nx
                    if 0 <= nx < w and 0 <= ny < h and not done[j] and pale(px[nx, ny]):
                        done[j] = 1
                        q.append((nx, ny))
            if len(patch) < 30:
                continue
            xs = [p[0] for p in patch]
            ys = [p[1] for p in patch]
            bx0, bx1, by0, by1 = min(xs), max(xs), min(ys), max(ys)
            # An eye white has its iris in or by its box.
            if any(green(px[x, y]) for y in range(max(0, by0 - 30), min(h, by1 + 31), 2) for x in range(max(0, bx0 - 30), min(w, bx1 + 31), 2)):
                continue
            pset = set(patch)
            b = n = 0
            for x, y in patch[:: max(1, len(patch) // 300)]:
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    for r in (8, 14, 22):
                        X, Y = x + dx * r, y + dy * r
                        if 0 <= X < w and 0 <= Y < h and (X, Y) not in pset and min(px[X, Y]) < 236 and max(px[X, Y]) > 90:
                            n += 1
                            b += bluish(px[X, Y])
            if n and b / n > 0.5:
                painted += 1
                for x, y in patch:
                    px[x, y] = EDGE
    im.save(path)
    print(path, 'edges', painted)
