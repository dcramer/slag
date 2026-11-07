"""Every drawing's helmet redrawn as a hard pyramid: straight edges, a flat base, two flat faces split by a ridge.

python3 -I art/sprites/pyramid/cowl.py 1.35 1.2 art/sprites/pyramid/cone-flat art/sprites/pyramid/flat idle idle2 walk-1 walk-2 run-1 run-2 air-1 air-2 wall cheer cheer2 death
(`idle` is SRC/design.png, written to OUT/../design.png; cone-flat/ holds the drawings as the image model drew them,
after helmet.py.)

The drawn cowl traced at play size as a soft narrow cone, and the clean colour readers (2026-11-06) took it for a
hood ("unsure: grey pointed hood over a purple body"). A pyramid is a geometric shape, so it is redrawn as one: the drawing's helmet is
found by colour (helmet.py's rust and the ink round it), its apex is the point farthest from the body, its base the
far edge across the apex's axis; the new pyramid stands on that same base line, centred on it, KH times as tall and KW
times as wide, its apex square over the base's middle, a lit near face and a shaded far face meeting at a ridge.
"""
import math
import sys
from collections import deque
from PIL import Image, ImageDraw, ImageFilter

KH, KW = float(sys.argv[1]), float(sys.argv[2])
SRC, OUT = sys.argv[3], sys.argv[4]
NAMES = sys.argv[5:]
LIT = (172, 98, 60)
SHADE = (112, 58, 38)
BAND = (92, 48, 32)
INK = (36, 19, 26)
RIDGE = 0.36  # the ridge's foot, a fraction of the base from its back corner
SS = 4


def is_rust(p):
    r, g, b = p
    return r > 60 and r - b > 45 and r - g > 30 and g < 140


def is_ink(p):
    return max(p) < 90


def helmet(im):
    w, h = im.size
    px = im.load()
    rust = Image.new('L', (w, h), 0)
    rp = rust.load()
    for y in range(h):
        for x in range(w):
            if is_rust(px[x, y]):
                rp[x, y] = 255
    seen = bytearray(w * h)
    best = []
    for y0 in range(h):
        for x0 in range(w):
            if rp[x0, y0] and not seen[y0 * w + x0]:
                comp = []
                q = deque([(x0, y0)])
                seen[y0 * w + x0] = 1
                while q:
                    x, y = q.popleft()
                    comp.append((x, y))
                    for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                        if 0 <= nx < w and 0 <= ny < h and rp[nx, ny] and not seen[ny * w + nx]:
                            seen[ny * w + nx] = 1
                            q.append((nx, ny))
                if len(comp) > len(best):
                    best = comp
    core = Image.new('L', (w, h), 0)
    cp = core.load()
    for x, y in best:
        cp[x, y] = 255
    core = core.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.MinFilter(9))
    reach = core.filter(ImageFilter.MaxFilter(15))
    rp2 = reach.load()
    cp = core.load()
    mask = Image.new('L', (w, h), 0)
    mp = mask.load()
    for y in range(h):
        for x in range(w):
            if cp[x, y] or (rp2[x, y] and (is_ink(px[x, y]) or is_rust(px[x, y]))):
                mp[x, y] = 255
    return mask, best


def run(name):
    src = f'{SRC}/design.png' if name == 'idle' else f'{SRC}/{name}.png'
    out = f'{OUT}/../design.png' if name == 'idle' else f'{OUT}/{name}.png'
    im = Image.open(src).convert('RGB')
    w, h = im.size
    px = im.load()
    mask, core = helmet(im)
    mp = mask.load()
    body = [(x, y) for y in range(0, h, 3) for x in range(0, w, 3) if min(px[x, y]) < 228 and not mp[x, y]]
    bx = sum(p[0] for p in body) / len(body)
    by = sum(p[1] for p in body) / len(body)
    pts = core[::3]
    A = max(pts, key=lambda p: (p[0] - bx) ** 2 + (p[1] - by) ** 2)
    cx = sum(p[0] for p in pts) / len(pts)
    cy = sum(p[1] for p in pts) / len(pts)
    ux, uy = A[0] - cx, A[1] - cy
    n = math.hypot(ux, uy)
    ux, uy = ux / n, uy / n
    vx, vy = -uy, ux  # across the axis
    ss = sorted(((A[0] - p[0]) * ux + (A[1] - p[1]) * uy) for p in pts)
    D = ss[int(len(ss) * 0.995)]
    deep = [p for p in pts if ((A[0] - p[0]) * ux + (A[1] - p[1]) * uy) > 0.75 * D]
    ts = sorted(((p[0] - A[0]) * vx + (p[1] - A[1]) * vy) for p in deep)
    tmin, tmax = ts[int(len(ts) * 0.01)], ts[int(len(ts) * 0.99)]
    tm = (tmin + tmax) / 2
    half = (tmax - tmin) / 2 * KW
    # The base's middle, and the new apex square over it, KH times as far.
    Mx, My = A[0] - D * ux + tm * vx, A[1] - D * uy + tm * vy
    Ax, Ay = Mx + KH * D * ux, My + KH * D * uy
    # The back corner is the one further from the body's front: in a facing-right pose, the left.
    c1 = (Mx - half * vx, My - half * vy)
    c2 = (Mx + half * vx, My + half * vy)
    back, front = (c1, c2) if c1[0] < c2[0] or (abs(c1[0] - c2[0]) < 1 and c1[1] > c2[1]) else (c2, c1)
    dip = 0.035 * KH * D  # the ridge's foot sits a little lower: a pyramid seen from just above its base
    Fx = back[0] + RIDGE * (front[0] - back[0]) - dip * ux
    Fy = back[1] + RIDGE * (front[1] - back[1]) - dip * uy
    ink = max(5, round(0.016 * KH * D))

    # Room for the bigger helmet.
    xs = [Ax, back[0], front[0]]
    ys = [Ay, back[1], front[1]]
    left, top = max(0, -math.floor(min(xs)) + ink * 2), max(0, -math.floor(min(ys)) + ink * 2)
    right, bottom = max(0, math.ceil(max(xs)) + ink * 2 - w), max(0, math.ceil(max(ys)) + ink * 2 - h)
    W, H = w + left + right, h + top + bottom
    canvas = Image.new('RGB', (W, H), 'white')
    canvas.paste(im, (left, top))
    cpx = canvas.load()
    # The old helmet goes, above its base line only (the shoulders' ink under the ledge stays).
    for y in range(h):
        for x in range(w):
            if mp[x, y] and ((A[0] - x) * ux + (A[1] - y) * uy) < D - ink:
                cpx[x + left, y + top] = (255, 255, 255)

    def S(p):
        return ((p[0] + left) * SS, (p[1] + top) * SS)

    big = Image.new('RGB', (W * SS, H * SS), 'white')
    alpha = Image.new('L', (W * SS, H * SS), 0)
    d = ImageDraw.Draw(big)
    a = ImageDraw.Draw(alpha)
    tri = [S((Ax, Ay)), S(back), S((Fx, Fy)), S(front)]
    d.polygon([S((Ax, Ay)), S(back), S((Fx, Fy))], fill=SHADE)
    d.polygon([S((Ax, Ay)), S((Fx, Fy)), S(front)], fill=LIT)
    L = ink * SS
    for p, q in ((tri[0], tri[1]), (tri[1], tri[2]), (tri[2], tri[3]), (tri[3], tri[0])):
        d.line([p, q], fill=INK, width=L)
        a.line([p, q], fill=255, width=L)
    d.line([tri[0], tri[2]], fill=INK, width=round(L * 0.7))
    for p in tri:
        d.ellipse([p[0] - L / 2, p[1] - L / 2, p[0] + L / 2, p[1] + L / 2], fill=INK)
        a.ellipse([p[0] - L / 2, p[1] - L / 2, p[0] + L / 2, p[1] + L / 2], fill=255)
    a.polygon(tri, fill=255)
    big = big.resize((W, H), Image.LANCZOS)
    alpha = alpha.resize((W, H), Image.LANCZOS)
    canvas.paste(big, (0, 0), alpha)
    canvas.save(out)
    print(name, 'apex', (round(Ax), round(Ay)), 'D', round(D), 'half', round(half), 'pad', (left, top, right, bottom))


for nm in NAMES:
    run(nm)
