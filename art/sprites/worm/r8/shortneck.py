"""shortneck.py IN OUT CUT: the knockout's limp neck shortened by CUT px, so the head lies inside the cast's box.

The neck's columns are the ones whose figure pixels span the least height left of the suit; CUT of them are taken
out of the middle of that run and everything left of it slid right.
"""
import sys
from PIL import Image

im = Image.open(sys.argv[1]).convert('RGB')
cut = int(sys.argv[2])
w, h = im.size
px = im.load()


def fig(c):
    return min(c) < 228


span = []
for x in range(w):
    ys = [y for y in range(h) if fig(px[x, y])]
    span.append((max(ys) - min(ys) + 1) if ys else 0)
xs = [x for x in range(w) if span[x]]
x0, x1 = xs[0], xs[-1]
# The neck: the run of thin columns between the head (the left end) and the suit.
thin = [x for x in range(x0, x0 + (x1 - x0) // 2) if 0 < span[x] < 0.35 * max(span)]
# the longest consecutive run
runs, cur = [], [thin[0]]
for x in thin[1:]:
    if x == cur[-1] + 1:
        cur.append(x)
    else:
        runs.append(cur)
        cur = [x]
runs.append(cur)
run = max(runs, key=len)
print('neck columns', run[0], run[-1], 'figure', x0, x1)
mid = (run[0] + run[-1]) // 2
a, b = mid - cut // 2, mid + cut - cut // 2
a = max(a, run[0] + 4)
b = min(b, run[-1] - 4)
out = Image.new('RGB', (w, h), (255, 255, 255))
o = out.load()
shift = b - a
for y in range(h):
    for x in range(w):
        if x >= b:
            o[x, y] = px[x, y]
        elif x < a and x + shift < w:
            o[x + shift, y] = px[x, y]
print('cut', a, b)
out.save(sys.argv[3] if len(sys.argv) > 3 else sys.argv[1])
