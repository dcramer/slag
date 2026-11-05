"""The limbless hero's drawings with his floating pieces pushed clear: spread.py SRC OUT [--gap PX].

He has no arms or legs, and the white round each glove and shoe is the read. The image model draws them about a
world px off the body, which the cast's pen closes at play size. Each piece that floats free (a patch of the
drawing apart from the biggest, the head and body) is slid straight out (a shoe under the body down, a glove beside it sideways) until there are
`--gap` image px of background between it and the body (and half that between it and every piece already
placed), whole, ink and all. A piece the drawing joined to the body stays where it is. The sources are in
`drawn/`; `build.ts` reads the spread ones (`design.png` and `flat/`).
"""
import sys
from collections import deque
from PIL import Image, ImageFilter

args = sys.argv[1:]
GAP = 90
if '--gap' in args:
    i = args.index('--gap')
    GAP = int(args[i + 1])
    del args[i : i + 2]
SRC, OUT = args
WHITE = 228

im = Image.open(SRC).convert('RGB')
# Room to slide into: a margin all round, so a piece never leaves the picture.
M = GAP * 2
big = Image.new('RGB', (im.size[0] + 2 * M, im.size[1] + 2 * M), 'white')
big.paste(im, (M, M))
im = big
W, H = im.size
px = im.load()

bg = bytearray(W * H)
q = deque([(x, 0) for x in range(W)] + [(x, H - 1) for x in range(W)] + [(0, y) for y in range(H)] + [(W - 1, y) for y in range(H)])
while q:
    x, y = q.popleft()
    i = y * W + x
    if bg[i] or min(px[x, y]) < WHITE:
        continue
    bg[i] = 1
    if x > 0: q.append((x - 1, y))
    if x < W - 1: q.append((x + 1, y))
    if y > 0: q.append((x, y - 1))
    if y < H - 1: q.append((x, y + 1))

# Pieces the drawing set touching the body (a glove against its side, by a pixel of antialiased ink) are parted
# along the thin neck between them: the figure is shrunk by NECK px, its patches labelled, and each pixel of the
# figure handed back to the patch it is nearest, so a touch splits and a glove drawn over the body doesn't.
NECK = 9
fg = Image.new('L', (W, H))
fg.putdata([0 if b else 255 for b in bg])
core = fg.filter(ImageFilter.MinFilter(2 * NECK + 1)).load()
label = [0] * (W * H)
comps = []
for i0 in range(W * H):
    if label[i0] or not core[i0 % W, i0 // W]:
        continue
    n = len(comps) + 1
    label[i0] = n
    patch = [i0]
    for i in patch:
        x, y = i % W, i // W
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                xx, yy = x + dx, y + dy
                if 0 <= xx < W and 0 <= yy < H:
                    j = yy * W + xx
                    if not label[j] and core[xx, yy]:
                        label[j] = n
                        patch.append(j)
    comps.append(patch)
# Grow each patch back over the figure, nearest first.
front = deque(i for p in comps for i in p)
while front:
    i = front.popleft()
    x, y = i % W, i // W
    for j in (i - 1 if x > 0 else -1, i + 1 if x < W - 1 else -1, i - W if y > 0 else -1, i + W if y < H - 1 else -1):
        if j >= 0 and not bg[j] and not label[j]:
            label[j] = label[i]
            comps[label[i] - 1].append(j)
            front.append(j)
# Specks the shrink took whole (a glint off the ink) go with whatever patch they touch, or stay on the body.
comps.sort(key=len, reverse=True)
body = comps[0]
pieces = [p for p in comps[1:] if len(p) > len(body) * 0.01]
body = body + [i for p in comps[1:] if len(p) <= len(body) * 0.01 for i in p]
body += [i for i in range(W * H) if not bg[i] and not label[i]]


def mask_of(pts, dx=0, dy=0):
    m = Image.new('L', (W, H))
    m.putdata([0] * (W * H))
    mp = m.load()
    for i in pts:
        x, y = i % W + dx, i // W + dy
        if 0 <= x < W and 0 <= y < H:
            mp[x, y] = 255
    return m


def grown(m, r):
    # A square grown by r px: MaxFilter needs an odd size, run in passes of at most 25 px.
    while r > 0:
        s = min(r, 12)
        m = m.filter(ImageFilter.MaxFilter(2 * s + 1))
        r -= s
    return m


def mid(pts):
    return sum(i % W for i in pts) / len(pts), sum(i // W for i in pts) / len(pts)


bx, by = mid(body)
body_low = max(i // W for i in body)
keep_out = grown(mask_of(body), GAP)
out = Image.new('RGB', (W, H), 'white')
op = out.load()
for i in body:
    op[i % W, i // W] = px[i % W, i // W]
def clear(p, vx, vy, placed):
    """How far piece p slides along (vx, vy) before it is GAP clear of the body and clear of every placed piece."""
    kp = keep_out.load()
    sample = p[:: max(1, len(p) // 4000)]
    step = 0
    while step <= GAP * 2:
        dx, dy = round(vx * step), round(vy * step)
        if not any(kp[i % W + dx, i // W + dy] for i in sample) and not any(any(o.load()[i % W + dx, i // W + dy] for i in sample) for o in placed):
            break
        step += 4
    return step


def put(p, dx, dy, placed):
    for i in p:
        x, y = i % W, i // W
        op[x + dx, y + dy] = px[x, y]
    placed.append(grown(mask_of(p, dx, dy), GAP // 2))
    print(f'  piece {len(p)} px moved {dx},{dy}')


# Straight out along one axis: the shoes under the body drop together, by what the one nearest it needs, so they
# keep their footing on one floor; a glove beside the body slides out sideways. The pieces keep the places the
# drawing gave them, and only the gaps grow.
shoes = [p for p in pieces if mid(p)[1] > body_low]
gloves = [p for p in pieces if mid(p)[1] <= body_low]
placed = []
drop = max([clear(p, 0, 1, []) for p in shoes], default=0)
for p in shoes:
    put(p, 0, drop, placed)
for p in sorted(gloves, key=len, reverse=True):
    vx = 1 if mid(p)[0] > bx else -1
    put(p, vx * clear(p, vx, 0, placed), 0, placed)
# Crop to the drawing with the cutter's padding back round it.
xs = [x for x in range(W) for y in range(0, H, 4) if min(op[x, y]) < WHITE]
ys = [y for y in range(H) for x in range(0, W, 4) if min(op[x, y]) < WHITE]
x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
fig = out.crop((x0, y0, x1 + 1, y1 + 1))
side = int(max(fig.size) * 1.25)
sq = Image.new('RGB', (side, side), 'white')
sq.paste(fig, ((side - fig.size[0]) // 2, (side - fig.size[1]) // 2))
sq.save(OUT)
print(OUT, len(pieces), 'pieces')
