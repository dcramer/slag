"""Tints the big eyes' whites a step off white, so `holes` cuts the gap between the legs and never the eyes.

Args: drawing.png [...] (each rewritten in place). Every patch of near-white the figure closes in (not
flooded from the border) whose middle is in the top 45% of the figure is the eyes' white or a pupil's glint:
it is painted (238, 234, 224), under the hole test's 228 and still the kind's `white` family. Patches lower
down (between the legs, inside the cheer's streamer curl) stay white and are cut through.
Unpainted, design.png is r1/worn-2.png; the poses are in sheets/.
"""
import sys
from collections import deque
from PIL import Image

TINT = (238, 234, 224)

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
    cut = top + (low - top) * 0.45
    n = 0
    for y0 in range(h):
        for x0 in range(w):
            i0 = y0 * w + x0
            if seen[i0] or not white(x0, y0):
                continue
            patch = []
            q.append((x0, y0))
            seen[i0] = 1
            while q:
                x, y = q.popleft()
                patch.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    j = ny * w + nx
                    if 0 <= nx < w and 0 <= ny < h and not seen[j] and white(nx, ny):
                        seen[j] = 1
                        q.append((nx, ny))
            if sum(p[1] for p in patch) / len(patch) < cut:
                for x, y in patch:
                    px[x, y] = TINT
                n += 1
    im.save(path)
    print(path, n, 'patches tinted')
