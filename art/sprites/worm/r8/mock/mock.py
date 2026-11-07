"""Mock the worm's redraw on a shipped drawing, pure PIL.

python3 -I mock.py IN OUT [--head S] [--gun G] [--pads] [--debug DBG.png]

--head S  magnifies the head (eyes, face, snout) S times about the eyes, the neck flaring into it.
--gun G   scales the dryer G times about its middle.
--pads    repaints the round shoulder pads a light blue (a pad role), so they stay their own shapes.
"""
import sys
from collections import deque
from PIL import Image

FAM = {
    'suit': [(88, 138, 175), (84, 132, 174), (90, 138, 174), (100, 139, 172), (85, 132, 169), (47, 92, 133), (55, 93, 127)],
    'glove': [(62, 91, 114), (64, 88, 112), (60, 84, 108), (43, 61, 83), (39, 48, 70), (36, 54, 78), (81, 95, 115), (65, 66, 84)],
    'patch': [(150, 186, 204), (168, 187, 203)],
    'grey': [(144, 138, 132), (134, 123, 137), (110, 104, 100)],
    'pink': [(244, 157, 161), (240, 150, 156), (172, 149, 157), (200, 110, 120)],
    'eye': [(220, 222, 240), (230, 202, 214)],
    'dark': [(32, 13, 33), (20, 11, 31), (32, 21, 41), (19, 2, 16)],
    'white': [(255, 255, 255), (246, 246, 246)],
}
PAD = (196, 226, 240)

args = sys.argv[1:]
src, dst = args[0], args[1]
opt = {}
i = 2
while i < len(args):
    k = args[i][2:]
    if k == 'pads':
        opt[k] = True
        i += 1
    else:
        opt[k] = args[i + 1]
        i += 2

im = Image.open(src).convert('RGB')
W, H = im.size
px = im.load()
cache = {}


def role(c):
    r = cache.get(c)
    if r is None:
        best = 1 << 30
        for n, cols in FAM.items():
            for f in cols:
                d = (c[0] - f[0]) ** 2 + (c[1] - f[1]) ** 2 + (c[2] - f[2]) ** 2
                if d < best:
                    best, r = d, n
        cache[c] = r
    return r


R = [[role(px[x, y]) for x in range(W)] for y in range(H)]


def comps(ok, minarea=50):
    seen = [[False] * W for _ in range(H)]
    out = []
    for y in range(H):
        row = R[y]
        for x in range(W):
            if seen[y][x] or not ok(row[x]):
                continue
            q = deque([(x, y)])
            seen[y][x] = True
            pts = []
            while q:
                cx, cy = q.popleft()
                pts.append((cx, cy))
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < W and 0 <= ny < H and not seen[ny][nx] and ok(R[ny][nx]):
                        seen[ny][nx] = True
                        q.append((nx, ny))
            if len(pts) >= minarea:
                out.append(pts)
    return out


def stats(pts):
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    return dict(n=len(pts), cx=sum(xs) / len(pts), cy=sum(ys) / len(pts), x0=x0, x1=x1, y0=y0, y1=y1, w=x1 - x0 + 1, h=y1 - y0 + 1)


fig = [(x, y) for y in range(H) for x in range(W) if R[y][x] != 'white']
F = stats(fig)
print(f'figure {F["x0"]},{F["y0"]}..{F["x1"]},{F["y1"]} area {F["n"]}')

near_cache = {}


def near(x, y, roles, d=6):
    for yy in range(max(0, y - d), min(H, y + d + 1)):
        row = R[yy]
        for xx in range(max(0, x - d), min(W, x + d + 1)):
            if row[xx] in roles:
                return True
    return False


orig = im.copy()
opx = orig.load()

# The pads first, on the original roles.
if opt.get('pads'):
    cs = comps(lambda r: r in ('suit', 'patch'), 400)
    top = min(stats(c)['y0'] for c in cs if stats(c)['n'] > 2000)
    eyes = comps(lambda r: r == 'eye', 30)
    ey = min(stats(e)['cy'] for e in eyes) if eyes else F['y0']
    for c in cs:
        s = stats(c)
        fill = s['n'] / (s['w'] * s['h'])
        asp = s['w'] / s['h']
        frac = s['n'] / F['n']
        tag = ''
        if 0.4 < fill and 0.6 < asp < 1.7 and 0.008 < frac < 0.08 and s['y0'] - top < 0.06 * F['h']:
            tag = ' PAD'
            for x, y in c:
                px[x, y] = PAD
        print(f'  suit comp n={s["n"]} frac={frac:.3f} fill={fill:.2f} asp={asp:.2f} y={s["cy"]:.0f} x={s["cx"]:.0f}{tag}')

if 'head' in opt:
    S = float(opt['head'])
    eyes = [stats(e) for e in comps(lambda r: r == 'eye', 150)]
    eyes.sort(key=lambda s: s['cy'])
    top = [e for e in eyes if e['cy'] - eyes[0]['cy'] < eyes[0]['h'] * 0.6][:2]
    ex0 = min(e['x0'] for e in top)
    ex1 = max(e['x1'] for e in top)
    ey0 = min(e['y0'] for e in top)
    ey1 = max(e['y1'] for e in top)
    ew = max(ex1 - ex0, ey1 - ey0)
    cx, cy = (ex0 + ex1) / 2, (ey0 + ey1) / 2 + ew * 0.25
    R0 = ew * float(opt.get('core', 0.9))  # the head's core, magnified whole
    R1 = R0 * S + ew * float(opt.get('flare', 1.3))  # back to the original here
    print(f'head eyes {ex0},{ey0}..{ex1},{ey1} centre {cx:.0f},{cy:.0f} R0 {R0:.0f} R1 {R1:.0f}')
    headish = {'pink', 'eye', 'dark'}

    def ishead(x, y):
        r = R[y][x]
        if r in ('pink', 'eye'):
            return True
        if r == 'dark':
            return near(x, y, ('pink', 'eye'), 9)
        if r == 'white':
            # glints inside the eyes
            return near(x, y, ('eye',), 2) and near(x, y, ('dark',), 4)
        return False

    head = []
    ring = []
    for y in range(max(0, int(cy - R0)), min(H, int(cy + R0) + 1)):
        for x in range(max(0, int(cx - R0)), min(W, int(cx + R0) + 1)):
            d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            if d <= R0 and ishead(x, y):
                head.append((x, y))
                if d > R0 - 12 and R[y][x] == 'pink':
                    ring.append((x, y))
    # The neck crosses the circle's edge: the biggest run of pink on the ring, its middle the pivot.
    if ring:
        # cluster ring pixels by angle, take the cluster with the most
        import math
        angs = sorted(((math.atan2(y - cy, x - cx), x, y) for x, y in ring))
        groups = [[angs[0]]]
        for t in angs[1:]:
            if t[0] - groups[-1][-1][0] < 0.12:
                groups[-1].append(t)
            else:
                groups.append([t])
        if len(groups) > 1 and angs[0][0] + 2 * math.pi - angs[-1][0] < 0.12:
            groups[0] = groups[-1] + groups[0]
            groups.pop()
        gbest = max(groups, key=len)
        pxv = sum(t[1] for t in gbest) / len(gbest)
        pyv = sum(t[2] for t in gbest) / len(gbest)
    else:
        pxv, pyv = cx, cy + R0
    print(f'head pivot {pxv:.0f},{pyv:.0f} pixels {len(head)}')
    hs = set(head)
    hx0 = min(p[0] for p in head)
    hx1 = max(p[0] for p in head)
    hy0 = min(p[1] for p in head)
    hy1 = max(p[1] for p in head)
    for ty in range(int(pyv + (hy0 - pyv) * S) - 2, int(pyv + (hy1 - pyv) * S) + 3):
        for tx in range(int(pxv + (hx0 - pxv) * S) - 2, int(pxv + (hx1 - pxv) * S) + 3):
            sx, sy = int(round(pxv + (tx - pxv) / S)), int(round(pyv + (ty - pyv) / S))
            if (sx, sy) in hs and 0 <= tx < W and 0 <= ty < H:
                px[tx, ty] = opx[sx, sy]

if 'gun' in opt:
    G = float(opt['gun'])
    gs = [stats(c) for c in comps(lambda r: r == 'grey', 200)]
    gs.sort(key=lambda s: -s['n'])
    g = gs[0]
    gx, gy = g['cx'], g['cy']
    gun = set()
    for c in comps(lambda r: r == 'grey', 30):
        s = stats(c)
        if abs(s['cx'] - gx) < g['w'] * 1.2 and abs(s['cy'] - gy) < g['h'] * 1.2:
            gun.update(c)
    for y in range(g['y0'] - 12, g['y1'] + 13):
        for x in range(g['x0'] - 12, g['x1'] + 13):
            if 0 <= x < W and 0 <= y < H and R[y][x] == 'dark' and near(x, y, ('grey',), 10):
                gun.add((x, y))
    G0 = stats(list(gun))
    left = G0['cx'] < F['cx'] - F['w'] * 0.1
    gx = G0['x1'] - 0.25 * G0['w'] if left else G0['x0'] + 0.25 * G0['w']
    gy = G0['y1'] - 0.2 * G0['h']
    cur = im.load()
    snap = im.copy().load()
    lo_x, hi_x = gx + (G0['x0'] - gx) * G - 2, gx + (G0['x1'] - gx) * G + 2
    lo_y, hi_y = gy + (G0['y0'] - gy) * G - 2, gy + (G0['y1'] - gy) * G + 2
    for ty in range(int(lo_y), int(hi_y) + 1):
        for tx in range(int(lo_x), int(hi_x) + 1):
            sx, sy = int(round(gx + (tx - gx) / G)), int(round(gy + (ty - gy) / G))
            if (sx, sy) in gun and 0 <= tx < W and 0 <= ty < H:
                cur[tx, ty] = snap[sx, sy]

# Pad the canvas if the figure now touches its edge.
im.save(dst)
