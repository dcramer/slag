"""Illustration -> role map at the tracer's resolution, for convert.ts: flat colours become roles, the ink
line is dropped (split between the regions either side of it), thick black stays a fill, and the lines
inside one colour are kept as strokes. Args: design.png out.json debug.png [height opening res]."""
import json, sys
from collections import deque
from PIL import Image, ImageFilter

SRC, OUT, DEBUG = sys.argv[1], sys.argv[2], sys.argv[3]
# The scale: `h21` sets the figure 21 world px from soles to ear tips (the design at rest), `a210` sets
# its body (every role but the tail) to 210 world px square, so every pose of a kind comes out the same size.
SIZE = sys.argv[4] if len(sys.argv) > 4 else 'h21'
R = int(sys.argv[6]) if len(sys.argv) > 6 else 12  # px per world px the map is traced at
BOX = dict(x0=-20, x1=20, y0=-3, y1=33)

ROLES = ['fur', 'dark', 'cheek', 'tin', 'plug']
# Colour families as sampled from the design: (role, rgb). Shades fold into their role.
FAMILIES = [
    ('fur', (240, 196, 40)), ('fur', (186, 124, 30)), ('fur', (222, 170, 30)),
    ('tin', (170, 186, 188)), ('tin', (126, 140, 142)), ('tin', (192, 192, 196)),
    ('cheek', (216, 76, 54)),
    ('plug', (236, 230, 218)),
    ('dark', (30, 20, 16)),
]

im = Image.open(SRC).convert('RGB')
w, h = im.size
px = im.load()

# Background: flood near-white from the border.
bg = bytearray(w * h)
q = deque([(x, 0) for x in range(w)] + [(x, h - 1) for x in range(w)] + [(0, y) for y in range(h)] + [(w - 1, y) for y in range(h)])
while q:
    x, y = q.popleft()
    i = y * w + x
    if bg[i] or min(px[x, y]) < 228:
        continue
    bg[i] = 1
    if x > 0: q.append((x - 1, y))
    if x < w - 1: q.append((x + 1, y))
    if y > 0: q.append((x, y - 1))
    if y < h - 1: q.append((x, y + 1))

def nearest(c):
    return min(FAMILIES, key=lambda f: sum((a - b) ** 2 for a, b in zip(c, f[1])))[0]

role = [-1] * (w * h)
for y in range(h):
    for x in range(w):
        i = y * w + x
        if not bg[i]:
            role[i] = ROLES.index(nearest(px[x, y]))

# Thick black is a fill (ear tips, cord, eyes); thin black is the ink line. An opening keeps only the thick.
D = ROLES.index('dark')
dark = Image.new('L', (w, h))
dark.putdata([255 if r == D else 0 for r in role])
OPEN = int(sys.argv[5]) if len(sys.argv) > 5 else 9
fill = dark.filter(ImageFilter.MinFilter(OPEN)).filter(ImageFilter.MaxFilter(OPEN))
fd = fill.load()
LINE = -2
for y in range(h):
    for x in range(w):
        i = y * w + x
        if role[i] == D and not fd[x, y]:
            role[i] = LINE
# Thin grey is the line's antialiased edge, not tin: tin is only where it's thick (the tail, the tape, the bolt).
T = ROLES.index('tin')
tin = Image.new('L', (w, h))
tin.putdata([255 if r == T else 0 for r in role])
tfill = tin.filter(ImageFilter.MinFilter(7)).filter(ImageFilter.MaxFilter(7)).load()
for y in range(h):
    for x in range(w):
        i = y * w + x
        if role[i] == T and not tfill[x, y]:
            role[i] = LINE

# The illustration's interior lines (an arm over the body, the mouth, the gap between the legs): line pixels
# with one role all round them and no background near. They become pen strokes; a line between two roles
# needs none, since the parts' own outlines ink it.
RAD = 5
interior = bytearray(w * h)
for i in range(w * h):
    if role[i] != LINE:
        continue
    x, y = i % w, i // w
    seen = set()
    ok = True
    for dy in range(-RAD, RAD + 1):
        yy = y + dy
        if yy < 0 or yy >= h:
            ok = False
            break
        row = yy * w
        for dx in range(-RAD, RAD + 1):
            xx = x + dx
            if xx < 0 or xx >= w or bg[row + xx]:
                ok = False
                break
            r = role[row + xx]
            if r >= 0:
                seen.add(r)
        if not ok:
            break
    if ok and len(seen) == 1:
        interior[i] = seen.pop() + 1
# The line goes to whichever region reaches it first: a multi-source flood, so it splits down its middle.
q = deque(i for i in range(w * h) if role[i] >= 0)
while q:
    i = q.popleft()
    x, y = i % w, i // w
    for j in ((i - 1) if x > 0 else -1, (i + 1) if x < w - 1 else -1, i - w if y > 0 else -1, i + w if y < h - 1 else -1):
        if j >= 0 and role[j] == LINE:
            role[j] = role[i]
            q.append(j)

# The figure's box, feet at the origin, x centred on the body over the feet (not the tail).
ys = [i // w for i in range(w * h) if role[i] >= 0]
top = min(ys)
# The soles: the lowest fur, so a tail or a cord hanging lower doesn't lift the figure off its feet.
bottom = max(i // w for i in range(w * h) if role[i] == ROLES.index('fur'))
F = ROLES.index('fur')
low = [i % w for i in range(w * h) if role[i] == F and i // w > bottom - (bottom - top) * 0.25]
cx = (min(low) + max(low)) / 2
T = ROLES.index('tin')
body = sum(1 for r in role if r >= 0 and r != T)
# World px per image px.
k = float(SIZE[1:]) / (bottom - top + 1) if SIZE[0] == 'h' else (float(SIZE[1:]) / body) ** 0.5
print('body', round(body * k * k, 1), 'height', round((bottom - top + 1) * k, 2))

W, H = (BOX['x1'] - BOX['x0']) * R, (BOX['y1'] - BOX['y0']) * R
out = [-1] * (W * H)
# Majority of the source pixels under each output pixel.
for oy in range(H):
    wy = oy / R - BOX['y1'] + 0.5 / R  # world y (feet 0, up negative)
    sy0 = bottom + 1 + (wy - 0.5 / R) / k
    for ox in range(W):
        wx = ox / R + BOX['x0'] + 0.5 / R
        sx0 = cx + (wx - 0.5 / R) / k
        votes = {}
        n = max(1, round(1 / R / k))
        for dy in range(n):
            for dx in range(n):
                sx, sy = int(sx0 + dx), int(sy0 + dy)
                if 0 <= sx < w and 0 <= sy < h:
                    r = role[sy * w + sx]
                    votes[r] = votes.get(r, 0) + 1
        if votes:
            best = max(votes, key=votes.get)
            # Empty only where most of the cell is.
            out[oy * W + ox] = best
# Thin the interior lines to their centres (Zhang-Suen), then walk them into polylines in world px.
xs = [i % w for i in range(w * h) if interior[i]]
lines = []
if xs:
    ys2 = [i // w for i in range(w * h) if interior[i]]
    bx0, bx1, by0, by1 = min(xs) - 1, max(xs) + 2, min(ys2) - 1, max(ys2) + 2
    bw, bh = bx1 - bx0, by1 - by0
    m = bytearray(bw * bh)
    for y in range(by0, by1):
        for x in range(bx0, bx1):
            if interior[y * w + x]:
                m[(y - by0) * bw + (x - bx0)] = 1
    def nb(i):
        x, y = i % bw, i // bw
        return [m[i - bw], m[i - bw + 1], m[i + 1], m[i + bw + 1], m[i + bw], m[i + bw - 1], m[i - 1], m[i - bw - 1]]
    changed = True
    while changed:
        changed = False
        for step in (0, 1):
            kill = []
            for i in range(bw + 1, bw * (bh - 1) - 1):
                if not m[i] or i % bw in (0, bw - 1):
                    continue
                p = nb(i)
                b = sum(p)
                if b < 2 or b > 6:
                    continue
                a = sum(1 for j in range(8) if p[j] == 0 and p[(j + 1) % 8] == 1)
                if a != 1:
                    continue
                if step == 0 and (p[0] * p[2] * p[4] or p[2] * p[4] * p[6]):
                    continue
                if step == 1 and (p[0] * p[2] * p[6] or p[0] * p[4] * p[6]):
                    continue
                kill.append(i)
            for i in kill:
                m[i] = 0
            changed = changed or bool(kill)
    OFF = [-bw, -bw + 1, 1, bw + 1, bw, bw - 1, -1, -bw - 1]
    deg = lambda i: sum(1 for o in OFF if m[i + o])
    # Walk the centrelines into long strokes: from each end, step to the unvisited neighbour that best
    # carries on the way it was going, straight through the little junctions thinning leaves.
    seen_c = set()
    def walk(i):
        pts = [i]
        seen_c.add(i)
        d = None
        while True:
            cands = [o for o in OFF if m[i + o] and (i + o) not in seen_c]
            if not cands:
                break
            if d is None:
                o = cands[0]
            else:
                vx, vy = d
                o = max(cands, key=lambda o: ((((o + bw + 1) % bw) - 1) * vx + (((o + bw + 1) // bw) - 1) * vy) / (((((o + bw + 1) % bw) - 1) ** 2 + (((o + bw + 1) // bw) - 1) ** 2) ** 0.5))
            ox, oy = ((o + bw + 1) % bw) - 1, ((o + bw + 1) // bw) - 1
            d = (ox, oy) if d is None else (d[0] * 0.6 + ox * 0.4, d[1] * 0.6 + oy * 0.4)
            i += o
            seen_c.add(i)
            pts.append(i)
        return pts
    cells = [i for i in range(len(m)) if m[i]]
    for i in sorted(cells, key=deg):
        if i not in seen_c:
            lines.append(walk(i))
    def world(i):
        x, y = i % bw + bx0, i // bw + by0
        return ((x - cx) * k, (y - (bottom + 1)) * k)
    def rdp(pts, eps):
        if len(pts) < 3:
            return pts
        (ax, ay), (bx_, by_) = pts[0], pts[-1]
        dx, dy = bx_ - ax, by_ - ay
        L = (dx * dx + dy * dy) ** 0.5 or 1e-9
        far, fi = 0, 0
        for j in range(1, len(pts) - 1):
            d = abs((pts[j][0] - ax) * dy - (pts[j][1] - ay) * dx) / L
            if d > far:
                far, fi = d, j
        if far <= eps:
            return [pts[0], pts[-1]]
        return rdp(pts[: fi + 1], eps)[:-1] + rdp(pts[fi:], eps)
    out_lines = []
    for ln in lines:
        pts = [world(i) for i in ln]
        length = sum(((pts[j + 1][0] - pts[j][0]) ** 2 + (pts[j + 1][1] - pts[j][1]) ** 2) ** 0.5 for j in range(len(pts) - 1))
        if length < 1.4:
            continue
        under = [interior[(i // bw + by0) * w + (i % bw + bx0)] - 1 for i in ln]
        r = max(set(under), key=under.count)
        out_lines.append({'role': r, 'pts': [round(v, 3) for p in rdp(pts, 0.12) for v in p]})
    lines = out_lines
print('lines', len(lines))
json.dump({'W': W, 'H': H, 'R': R, 'roles': ROLES, 'role': out, 'height': round((bottom - top + 1) * k, 2), 'lines': lines}, open(OUT, 'w'))

PAL = {-1: (240, 236, 228), 0: (240, 196, 40), 1: (30, 20, 16), 2: (216, 76, 54), 3: (170, 186, 188), 4: (236, 230, 218)}
dbg = Image.new('RGB', (W, H))
dbg.putdata([PAL[v] for v in out])
dbg = dbg.resize((W * 3, H * 3), Image.NEAREST)
from PIL import ImageDraw
dd = ImageDraw.Draw(dbg)
for ln in lines:
    ln = ln['pts']
    pts = [((ln[j] - BOX['x0']) * R * 3, (ln[j + 1] + BOX['y1']) * R * 3) for j in range(0, len(ln), 2)]
    dd.line(pts, fill=(200, 0, 160), width=3)
dbg.save(DEBUG)
print(OUT, W, H, 'k', k)
