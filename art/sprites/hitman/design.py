# design.png from the picks: the wear edit drafts/worn-1.png (the sticker peeling on his skull, the torn hem), with the tie put back
# from the design drafts/design-3b.png and hung crooked off its knot. The edits swung the clip-on tie right off his shirt, across the
# jacket or out past it, and a design read in an orange suit lost the suit and tie (low, Eggman); down the white V,
# it read as the hitman at medium. Usage: design.py drafts/design-3b.png drafts/worn-1.png design.png [degrees]
import sys
from PIL import Image

d3, w3, out = sys.argv[1], sys.argv[2], sys.argv[3]
deg = float(sys.argv[4]) if len(sys.argv) > 4 else 12
base = Image.open(w3).convert('RGB')
orig = Image.open(d3).convert('RGB')
base.paste(orig.crop((520, 420, 830, 660)), (520, 420))
px = base.load()
W, H = base.size
KNOT = (568, 458)  # the blade hangs from here


def red(p):
    return p[0] > 90 and p[0] > p[1] * 1.8


blade = set()
for y in range(KNOT[1], 640):
    for x in range(530, 620):
        if red(px[x, y]):
            blade.add((x, y))
# Its outline: the dark ring round the red, within a few px.
ring = set()
for (x, y) in blade:
    for dx in range(-7, 8):
        for dy in range(-7, 8):
            q = (x + dx, y + dy)
            if q not in blade and q[1] >= KNOT[1] and max(px[q]) < 150 and not red(px[q]):
                ring.add(q)
layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
lpx = layer.load()
for q in blade | ring:
    lpx[q] = px[q] + (255,)
    px[q] = (246, 246, 242)
layer = layer.rotate(deg, resample=Image.NEAREST, center=KNOT)
base.paste(layer, (0, 0), layer)
base.save(out)
# The edit's background is an off-white with a faint grain: flood it to white from the border, so it never traces.
from collections import deque

px = base.load()
seen = bytearray(W * H)
q = deque([(x, y) for x in range(W) for y in (0, H - 1)] + [(x, y) for y in range(H) for x in (0, W - 1)])
while q:
    x, y = q.popleft()
    if x < 0 or y < 0 or x >= W or y >= H or seen[y * W + x] or min(px[x, y]) < 215:
        continue
    seen[y * W + x] = 1
    px[x, y] = (255, 255, 255)
    q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
base.save(out)
