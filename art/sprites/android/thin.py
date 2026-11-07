"""The sleep mask narrowed to a blindfold's strip: thin.py IN OUT [KEEP] [--v].

Drawn as wide as the image model gives it, the mask covered her face from the fringe down to the nose, and at play
size the bob over it read blind as a round white helmet over a dark visor (docs/characters/android.md, Rig). Each
column of the mask keeps the middle KEEP of its height (default 0.55); what's taken off its top becomes the fringe's
white, and off its bottom whatever was under it there (her skin, or the bob behind her face).

The mask is the biggest thick dark patch in the figure's top half, as in untail.py, which runs first.
"""
import sys
from collections import deque

from PIL import Image, ImageFilter

args = [a for a in sys.argv[1:] if not a.startswith('--')]
src, out = args[0], args[1]
KEEP = float(args[2]) if len(args) > 2 else 0.55
V = '--v' in sys.argv
im = Image.open(src).convert('RGB')
W, H = im.size
px = im.load()
dark = im.convert('L').point(lambda v: 255 if v < 70 else 0)
k = max(9, (min(W, H) // 60) | 1)
tp = dark.filter(ImageFilter.MinFilter(k)).filter(ImageFilter.MaxFilter(k)).load()
ys = [y for y in range(0, H, 2) for x in range(0, W, 4) if min(px[x, y]) < 240]
top, low = min(ys), max(ys)
seen = set()
best = []
for y in range(top, top + (low - top) // 2, 3):
    for x in range(0, W, 3):
        if tp[x, y] and (x, y) not in seen:
            comp = []
            q = deque([(x, y)])
            seen.add((x, y))
            while q:
                a, b = q.popleft()
                comp.append((a, b))
                for na, nb in ((a + 1, b), (a - 1, b), (a, b + 1), (a, b - 1)):
                    if 0 <= na < W and 0 <= nb < H and tp[na, nb] and (na, nb) not in seen:
                        seen.add((na, nb))
                        q.append((na, nb))
            if len(comp) > len(best):
                best = comp
if not best:
    sys.exit(f'{src}: no mask found')

HAIR = (239, 235, 225)
SKIN = (242, 212, 189)
cols = {}
for a, b in best:
    lo, hi = cols.get(a, (b, b))
    cols[a] = (min(lo, b), max(hi, b))


def under(x, y):
    """The colour a strip taken off the mask's bottom becomes: what lies just under it, skin or hair."""
    for d in range(4, 30):
        if y + d >= H:
            break
        c = px[x, y + d]
        if min(c) > 150 and max(c) - min(c) < 30:
            return HAIR
        if c[0] > 200 and c[0] - c[2] > 30:
            return SKIN
    return SKIN


n = 0
for x, (lo, hi) in cols.items():
    h = hi - lo
    cut = int(h * (1 - KEEP) / 2)
    # Past the mask's own outline, so the band keeps a clean edge of ink pixels where it's drawn.
    below = under(x, hi)
    for y in range(lo - 3, lo + cut):
        if max(px[x, y]) < 120:
            px[x, y] = HAIR
            n += 1
    for y in range(hi - cut, hi + 4):
        if max(px[x, y]) < 120:
            px[x, y] = below
            n += 1
if V:
    print(f'{src}: {len(cols)} columns, {n} px repainted')
im.save(out)
