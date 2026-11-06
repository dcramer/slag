"""Tints the face's whites a step off white, so `holes` cuts the wind-up key's two holes (and the gaps between the
legs) and never the eyes or the grin's teeth.

Args: drawing.png [...] (each rewritten in place). Every patch of near-white the figure closes in (not flooded
from the border) is left white, to be cut through, if the ring just outside it is mostly the key's grey or its
middle is in the lower half of the figure; any other (an eye white, a glint, the teeth) is painted
(238, 234, 224), under the hole test's 228 and still the kind's `white` family.
Unpainted, design.png is tin/long-1.png; the poses are cut from sheets/.
"""
import sys
from collections import deque
from PIL import Image

TINT = (238, 234, 224)


def grey(c):
    return 90 < min(c) and max(c) < 215 and max(c) - min(c) < 22


for path in sys.argv[1:]:
    im = Image.open(path).convert('RGB')
    w, h = im.size
    px = im.load()
    white = lambda x, y: min(px[x, y]) >= 228
    seen = bytearray(w * h)
    q = deque()
    for x in range(w):
        q.extend([(x, 0), (x, h - 1)])
    for y in range(h):
        q.extend([(0, y), (w - 1, y)])
    while q:
        x, y = q.popleft()
        i = y * w + x
        if seen[i] or not white(x, y):
            continue
        seen[i] = 1
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx]:
                q.append((nx, ny))
    ys = [y for y in range(h) for x in range(0, w, 4) if not seen[y * w + x] and not white(x, y)]
    top, low = min(ys), max(ys)
    mid = top + (low - top) * 0.5
    done = bytearray(w * h)
    kept = tinted = 0
    for y0 in range(h):
        for x0 in range(w):
            i0 = y0 * w + x0
            if seen[i0] or done[i0] or not white(x0, y0):
                continue
            patch = []
            q = deque([(x0, y0)])
            done[i0] = 1
            while q:
                x, y = q.popleft()
                patch.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    j = ny * w + nx
                    if 0 <= nx < w and 0 <= ny < h and not done[j] and not seen[j] and white(nx, ny):
                        done[j] = 1
                        q.append((nx, ny))
            cy = sum(p[1] for p in patch) / len(patch)
            pset = set(patch)
            # The ring 14 to 30 px outside the patch, sampled along its edge.
            g = n = 0
            for x, y in patch[:: max(1, len(patch) // 400)]:
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
                    for r in (14, 22, 30):
                        X, Y = x + dx * r, y + dy * r
                        if 0 <= X < w and 0 <= Y < h and (X, Y) not in pset and not white(X, Y):
                            n += 1
                            g += grey(px[X, Y])
            if (n and g / n > 0.45) or cy > mid:
                kept += 1
                continue
            tinted += 1
            for x, y in patch:
                px[x, y] = TINT
    im.save(path)
    print(path, 'kept', kept, 'tinted', tinted)
