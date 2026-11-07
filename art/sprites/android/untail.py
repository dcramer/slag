"""The sleep mask's knot tails painted out of a drawing: untail.py IN OUT [--level] [--v].

At play size the two black tails hanging behind her head joined the band into a black mass at the back of the
bob, and the head read blind as a dome helmet with a visor (docs/characters/android.md, Rig). The band across the
hair stays; the knot and the tails behind the bob's back edge go, painted white (background) beyond it and the
bob's own white inside it.

The mask is the biggest thick dark patch in the figure's top half (the ink drawn thick: an opening of the dark
pixels takes the pen away). Its rows are those of its front, the mask over her eyes; the bob's back edge is the
leftmost hair pixel just above them, and everything of the patch behind that edge, or below the band behind the
head's middle, is knot and tail.
"""
import sys
from collections import deque

from PIL import Image, ImageFilter

src, out = sys.argv[1], sys.argv[2]
V = '--v' in sys.argv
# A pose whose tails stream straight back along the band (the fall) has nothing hanging below it to take.
BELOW = '--level' not in sys.argv
im = Image.open(src).convert('RGB')
W, H = im.size
px = im.load()
lum = im.convert('L')
dark = lum.point(lambda v: 255 if v < 70 else 0)
k = max(9, (min(W, H) // 60) | 1)
thick = dark.filter(ImageFilter.MinFilter(k)).filter(ImageFilter.MaxFilter(k))
tp = thick.load()

# The figure's box (anything not near-white).
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

front = max(a for a, b in best)
col = front - max(6, (front - min(a for a, b in best)) // 10)
rows = [b for a, b in best if a == col]
mt, mb = min(rows), max(rows)


def hairy(c):
    r, g, b = c
    return min(c) > 205 and max(c) - min(c) < 30 and min(c) < 248


# The bob's back edge: the leftmost hair pixel in the few rows just above the band.
edge = W
for y in range(max(0, mt - 25), mt - 4):
    for x in range(0, front):
        if hairy(px[x, y]):
            edge = min(edge, x)
            break
mid = (edge + front) / 2
# The bob's bottom behind her face: the first row down from the band with no hair in the back half of the head.
hair_low = mb
while hair_low < H - 1 and any(hairy(px[x, hair_low + 1]) for x in range(edge, int(mid), 2)):
    hair_low += 1
knot = edge + (front - edge) * 0.06
gone = [(a, b) for a, b in best if a < knot or (BELOW and b > mb + 6 and a < mid)]
if V:
    print(f'{src}: mask rows {mt}..{mb} front {front} bob edge {edge} hair to {hair_low}: {len(gone)} px of tail')

mark = Image.new('L', (W, H), 0)
mp = mark.load()
for a, b in gone:
    mp[a, b] = 255
# With the pen round them.
grow = mark.filter(ImageFilter.MaxFilter(k + 6)).load()
HAIR = (239, 235, 225)
for y in range(H):
    for x in range(W):
        if not grow[x, y]:
            continue
        c = px[x, y]
        if min(c) > 200 and not mp[x, y]:
            continue
        inside = x >= edge and y <= hair_low
        if mp[x, y] or (min(c) < 200 and max(c) - min(c) < 40):
            px[x, y] = HAIR if inside else (255, 255, 255)
im.save(out)
