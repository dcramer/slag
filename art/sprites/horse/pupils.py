"""pupils.py IMG [IMG ...]: inks each drawing's near pupil over as a solid disc, in place.

Drawn, a pupil is a small dot in a big white, thinner than the role map's ink threshold, so it is taken for the
line and the face kit finds no eye. An eye white is a round pale patch the figure closes in (the background
touches the border and is not one) with a dark hole in it, the pupil; the muzzle is pale too, with a nostril for a
hole, but not round. The biggest round one is the near eye, and its pupil is inked over as a disc D px across at
the hole's centre. `IMG@X,Y` inks it at X,Y instead, for a pupil under a lid (the smug idle, the bucking grin)."""
import sys
from collections import deque
from PIL import Image, ImageDraw

D = 26


def comps(mask, w, h):
    seen = bytearray(w * h)
    for i0 in range(w * h):
        if not mask[i0] or seen[i0]:
            continue
        q = deque([i0])
        seen[i0] = 1
        out = []
        while q:
            i = q.popleft()
            out.append(i)
            x, y = i % w, i // w
            for j in (i - 1 if x else -1, i + 1 if x < w - 1 else -1, i - w if y else -1, i + w if y < h - 1 else -1):
                if j >= 0 and mask[j] and not seen[j]:
                    seen[j] = 1
                    q.append(j)
        yield out


for arg in sys.argv[1:]:
    path, _, at = arg.partition('@')
    im = Image.open(path).convert('RGB')
    if at:
        hx, hy = map(float, at.split(','))
        ImageDraw.Draw(im).ellipse((hx - D / 2, hy - D / 2, hx + D / 2, hy + D / 2), fill=(29, 8, 8))
        im.save(path)
        print(path.split('/')[-1], 'pupil at', at)
        continue
    w, h = im.size
    px = im.load()
    white = bytearray(1 if (lambda p: p[0] > 225 and p[1] > 200 and p[2] > 160)(px[i % w, i // w]) else 0 for i in range(w * h))
    best = None
    for c in comps(white, w, h):
        xs = [i % w for i in c]
        ys = [i // w for i in c]
        x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
        if x0 == 0 or y0 == 0 or x1 == w - 1 or y1 == h - 1 or len(c) < 300:
            continue
        # The hole: pixels in the white's box, not white, that the white closes in on every side along their row and column.
        cs = set(c)
        hole = []
        for y in range(y0, y1 + 1):
            row = [x for x in range(x0, x1 + 1) if y * w + x in cs]
            if len(row) < 2:
                continue
            for x in range(row[0], row[-1] + 1):
                i = y * w + x
                if i not in cs and sum(px[x, y]) < 330:
                    col = [yy for yy in range(y0, y1 + 1) if yy * w + x in cs]
                    if col and col[0] < y < col[-1]:
                        hole.append((x, y))
        if len(hole) < 30:
            continue
        bw, bh = x1 - x0 + 1, y1 - y0 + 1
        if not 0.7 < bw / bh < 1.45 or (len(c) + len(hole)) / (bw * bh) < 0.68:
            continue
        if best is None or len(c) > best[0]:
            hx = sum(p[0] for p in hole) / len(hole)
            hy = sum(p[1] for p in hole) / len(hole)
            best = (len(c), hx, hy)
    if best is None:
        print(path.split('/')[-1], 'no eye found')
        continue
    _, hx, hy = best
    ImageDraw.Draw(im).ellipse((hx - D / 2, hy - D / 2, hx + D / 2, hy + D / 2), fill=(29, 8, 8))
    im.save(path)
    print(path.split('/')[-1], 'pupil at', round(hx), round(hy))
