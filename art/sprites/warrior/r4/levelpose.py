"""A pose drawing's roast leg turned level, pointing forward. The image model draws the drumstick standing up out of
his fist whatever the prompt says, and raised or upright it reads as the penguin king's hammer (the blind reads).
This finds the stick (the meat and its bone, by colour), turns it about the fist to point straight right, and puts
the fist back over it. Drawings already level are left alone.

    python3 -I art/sprites/warrior/levelpose.py IN OUT [ANGLE]

ANGLE is the target in degrees, screen space (0 points right, the default; negative tips the meat up).
"""

import math
import sys
from collections import deque

from PIL import Image

MEAT = [(172, 92, 46), (140, 64, 30), (188, 114, 71), (160, 80, 40)]
BONE = [(232, 214, 186), (240, 226, 200)]
SKIN = [(239, 187, 139), (206, 140, 100), (237, 201, 168)]


def near(p, cols, d):
    return any(sum((p[i] - c[i]) ** 2 for i in range(3)) < d * d for c in cols)


def components(mask, w, h):
    seen = bytearray(w * h)
    out = []
    for i in range(w * h):
        if mask[i] and not seen[i]:
            q = deque([i])
            seen[i] = 1
            comp = []
            while q:
                j = q.popleft()
                comp.append(j)
                x, y = j % w, j // w
                for k in (j - 1 if x else -1, j + 1 if x < w - 1 else -1, j - w if y else -1, j + w if y < h - 1 else -1):
                    if k >= 0 and mask[k] and not seen[k]:
                        seen[k] = 1
                        q.append(k)
            out.append(comp)
    return out


src, out = sys.argv[1], sys.argv[2]
target = math.radians(float(sys.argv[3])) if len(sys.argv) > 3 else 0.0
im = Image.open(src).convert('RGB')
w, h = im.size
px = im.load()
meat = bytearray(w * h)
bone = bytearray(w * h)
skin = bytearray(w * h)
for y in range(h):
    for x in range(w):
        p = px[x, y]
        if near(p, MEAT, 22):
            meat[y * w + x] = 1
        elif near(p, BONE, 20):
            bone[y * w + x] = 1
        elif near(p, SKIN, 22):
            skin[y * w + x] = 1
# The drumstick's meat: the biggest meat-coloured patch (the boots and scabbard are leather, a step off it).
comps = sorted(components(meat, w, h), key=len, reverse=True)
stick = comps[0]
mx = sum(j % w for j in stick) / len(stick)
my = sum(j // w for j in stick) / len(stick)
# The bone: the biggest bone patch near the meat.
bcomps = [c for c in components(bone, w, h) if min(math.hypot(j % w - mx, j // w - my) for j in c[:: max(1, len(c) // 50)]) < 260]
bonec = max(bcomps, key=len) if bcomps else []
bx = sum(j % w for j in bonec) / len(bonec) if bonec else mx
by = sum(j // w for j in bonec) / len(bonec) if bonec else my
# The fist is between the meat and the bone: the skin there, nearest the meat's root.
mr = min(stick, key=lambda j: math.hypot(j % w - bx, j // w - by))
rx, ry = mr % w, mr // w
fist = [j for j in range(w * h) if skin[j] and math.hypot(j % w - rx, j // w - ry) < 70]
fx = sum(j % w for j in fist) / len(fist) if fist else rx
fy = sum(j // w for j in fist) / len(fist) if fist else ry
now = math.atan2(my - fy, mx - fx)
turn = target - now
if abs(math.degrees(turn)) < 12:
    im.save(out)
    print(f'{src}: already level ({math.degrees(now):.0f} deg)')
    sys.exit(0)
# The stick with its ink: meat and bone, grown a ring of 14 px to take the outline round them.
keep = bytearray(w * h)
for j in stick + bonec:
    keep[j] = 1
R = 14
grown = bytearray(w * h)
for j in range(w * h):
    if keep[j]:
        x, y = j % w, j // w
        for dy in range(-R, R + 1, 2):
            for dx in range(-R, R + 1, 2):
                xx, yy = x + dx, y + dy
                if 0 <= xx < w and 0 <= yy < h:
                    grown[yy * w + xx] = 1
canvas = im.copy()
cp = canvas.load()
moved = []
for j in range(w * h):
    if grown[j] and math.hypot(j % w - fx, j // w - fy) > 40:
        p = px[j % w, j // w]
        # The ring round the stick goes white whole, its antialiased edge too; only what is drawn there moves.
        if skin[j]:
            continue
        if min(p) < 235:
            moved.append((j % w, j // w, p))
        cp[j % w, j // w] = (255, 255, 255)
c, s = math.cos(turn), math.sin(turn)
# Grow the canvas if the turned stick reaches past it.
ends = [(fx + (x - fx) * c - (y - fy) * s, fy + (x - fx) * s + (y - fy) * c) for x, y, _ in moved]
padr = max(0, int(max(e[0] for e in ends)) + 4 - w)
padt = max(0, -int(min(e[1] for e in ends)) + 4)
big = Image.new('RGB', (w + padr, h + padt), (255, 255, 255))
big.paste(canvas, (0, padt))
bp = big.load()
for (x, y, col), (ex, ey) in zip(moved, ends):
    for ox in (0, 1):
        for oy in (0, 1):
            xx, yy = int(ex) + ox, int(ey) + oy + padt
            if 0 <= xx < big.width and 0 <= yy < big.height:
                bp[xx, yy] = col
# The fist back on top.
for j in fist:
    x, y = j % w, j // w
    bp[x, y + padt] = px[x, y]
for y in range(max(0, int(fy) - 60), min(h, int(fy) + 60)):
    for x in range(max(0, int(fx) - 60), min(w, int(fx) + 60)):
        if math.hypot(x - fx, y - fy) < 40:
            bp[x, y + padt] = px[x, y]
big.save(out)
print(f'{src}: turned {math.degrees(turn):.0f} deg about the fist at {fx:.0f},{fy:.0f}')
