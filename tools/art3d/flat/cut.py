"""A sheet of posed figures drawn side by side, cut into one image per figure: `build.ts cut` runs it.

Args: sheet.png out1.png [out2.png ...] [--scale K | --to design.png] [--pad 1.25] [--white 228]

Each figure is what one connected outline closes in: the background is the near-white flooded in from the
sheet's border (`--white`, the same test as rolemap.py), so a white body, a glint or a gap inside a figure stays
part of it. Small pieces (a speck, a detached tag) go with the nearest figure, or are dropped when far from all
of them. Figures that touch are split along the cheapest seam from top to bottom between them, through white
where it can and ink where they meet, never a coloured fill. Figures are ordered left to right; an out named
`skip` drops one. Each keeps its drawn scale, or every one takes the same factor: `--scale K`, or `--to`, the
factor that draws the sheet's figures as big as the design's (by area, the measure `body` sizes poses by), so
the ink is as thick as the design's and `ink` and `fringe` read every drawing alike. Each is pasted centred on a
white square `--pad` times its longer side.
"""
import sys
from collections import deque
from PIL import Image, ImageFilter

args = sys.argv[1:]
opts = {}
pos = []
i = 0
while i < len(args):
    if args[i].startswith('--'):
        opts[args[i][2:]] = args[i + 1]
        i += 2
    else:
        pos.append(args[i])
        i += 1
if len(pos) < 2:
    sys.exit('cut.py sheet.png out1.png [out2.png ...] [--scale K | --to design.png] [--pad 1.25] [--white 228]')
SRC, OUTS = pos[0], pos[1:]
N = len(OUTS)
WHITE = int(opts.get('white', 228))
PAD = float(opts.get('pad', 1.25))


def background(im):
    """The near-white flooded in from the border: 1 where it's background."""
    w, h = im.size
    px = im.load()
    bg = bytearray(w * h)
    q = deque([(x, 0) for x in range(w)] + [(x, h - 1) for x in range(w)] + [(0, y) for y in range(h)] + [(w - 1, y) for y in range(h)])
    while q:
        x, y = q.popleft()
        i = y * w + x
        if bg[i] or min(px[x, y]) < WHITE:
            continue
        bg[i] = 1
        if x > 0: q.append((x - 1, y))
        if x < w - 1: q.append((x + 1, y))
        if y > 0: q.append((x, y - 1))
        if y < h - 1: q.append((x, y + 1))
    return bg


def components(on, w, h):
    """8-connected patches of `on`: a label per pixel (0 none) and each label's pixel list."""
    label = [0] * (w * h)
    comps = {}
    n = 0
    for i0 in range(w * h):
        if not on[i0] or label[i0]:
            continue
        n += 1
        label[i0] = n
        patch = [i0]
        for i in patch:
            x, y = i % w, i // w
            for dy in (-1, 0, 1):
                yy = y + dy
                if yy < 0 or yy >= h:
                    continue
                for dx in (-1, 0, 1):
                    xx = x + dx
                    if xx < 0 or xx >= w:
                        continue
                    j = yy * w + xx
                    if on[j] and not label[j]:
                        label[j] = n
                        patch.append(j)
        comps[n] = patch
    return label, comps


def box(patch, w):
    xs = [i % w for i in patch]
    ys = [i // w for i in patch]
    return min(xs), min(ys), max(xs), max(ys)


def gap(a, b):
    """How far apart two boxes are (0 when they overlap)."""
    return max(0, max(a[0], b[0]) - min(a[2], b[2]), max(a[1], b[1]) - min(a[3], b[3]))


im = Image.open(SRC).convert('RGB')
W, H = im.size
px = im.load()
bg = background(im)
_, comps = components([0 if b else 1 for b in bg], W, H)
figs = sorted(comps.values(), key=len, reverse=True)
big = [p for p in figs if len(p) >= len(figs[0]) * 0.1]
small = [p for p in figs if len(p) < len(figs[0]) * 0.1]


def split(patch):
    """A patch holding two touching figures, cut in two along the cheapest seam through its middle."""
    mine = set(patch)
    x0, y0, x1, y1 = box(patch, W)
    lo, hi = x0 + (x1 - x0) // 5, x1 - (x1 - x0) // 5
    mid = (x0 + x1) / 2

    def cost(x, y):
        if y * W + x not in mine:
            return 0
        return 1 if sum(px[x, y]) < 260 else 60

    xs = range(lo, hi + 1)
    acc = {x: cost(x, y0) + abs(x - mid) * 1e-4 for x in xs}
    back = []
    for y in range(y0 + 1, y1 + 1):
        nxt, b = {}, {}
        for x in xs:
            best = min((acc[x2], x2) for x2 in (x - 1, x, x + 1) if lo <= x2 <= hi)
            nxt[x] = best[0] + cost(x, y)
            b[x] = best[1]
        back.append(b)
        acc = nxt
    x = min(xs, key=lambda x: acc[x])
    seam = [x]
    for b in reversed(back):
        x = b[x]
        seam.append(x)
    seam = seam[::-1]
    left = [i for i in patch if i % W < seam[i // W - y0]]
    right = [i for i in patch if i % W >= seam[i // W - y0]]
    print(f'  split a patch {x1 - x0 + 1} px wide at x {seam[0]}..{seam[-1]}, through {int(acc[seam[-1]]) // 60} px of fill')
    return [left, right]


# Touching figures: split the widest patch until there are as many as asked for.
while len(big) < N:
    widest = max(big, key=lambda p: box(p, W)[2] - box(p, W)[0])
    big.remove(widest)
    big += split(widest)
# More than asked for (a big prop drawn apart): the smallest goes with its nearest figure.
while len(big) > N:
    big.sort(key=len)
    p = big.pop(0)
    near = min(big, key=lambda q: gap(box(p, W), box(q, W)))
    near += p
boxes = [box(p, W) for p in big]
# Specks and scraps go with the nearest figure if they're close to it; stray marks far from all are dropped.
for p in small:
    b = box(p, W)
    k = min(range(N), key=lambda j: gap(b, boxes[j]))
    if gap(b, boxes[k]) <= H * 0.04:
        big[k] += p
order = sorted(range(N), key=lambda j: (box(big[j], W)[0] + box(big[j], W)[2]))
big = [big[j] for j in order]


def area_of(path):
    """A figure's drawn area: everything the border's white doesn't reach."""
    d = Image.open(path).convert('RGB')
    return d.size[0] * d.size[1] - sum(background(d))


scale = float(opts.get('scale', 1))
if 'to' in opts:
    areas = sorted(len(p) for p in big)
    scale = (area_of(opts['to']) / areas[len(areas) // 2]) ** 0.5
    print(f'scale {scale:.3f} to {opts["to"]}')

owner = [0] * (W * H)
for k, p in enumerate(big):
    for i in p:
        owner[i] = k + 1
for k, (p, out) in enumerate(zip(big, OUTS)):
    if out == 'skip':
        continue
    x0, y0, x1, y1 = box(p, W)
    m = 4
    x0, y0, x1, y1 = max(0, x0 - m), max(0, y0 - m), min(W - 1, x1 + m), min(H - 1, y1 + m)
    fw, fh = x1 - x0 + 1, y1 - y0 + 1
    # The figure's own pixels, grown two pixels into the background for its antialiased rim, never into another's.
    mask = Image.new('L', (fw, fh))
    mask.putdata([255 if owner[(y0 + y) * W + x0 + x] == k + 1 else 0 for y in range(fh) for x in range(fw)])
    grown = mask.filter(ImageFilter.MaxFilter(5)).load()
    fig = Image.new('RGB', (fw, fh), 'white')
    fp = fig.load()
    for y in range(fh):
        for x in range(fw):
            o = owner[(y0 + y) * W + x0 + x]
            if o == k + 1 or (grown[x, y] and o == 0):
                fp[x, y] = px[x0 + x, y0 + y]
    if scale != 1:
        fig = fig.resize((max(1, round(fw * scale)), max(1, round(fh * scale))), Image.LANCZOS)
    side = int(max(fig.size) * PAD)
    sq = Image.new('RGB', (side, side), 'white')
    sq.paste(fig, ((side - fig.size[0]) // 2, (side - fig.size[1]) // 2))
    sq.save(out)
    print(out, fig.size, side)
