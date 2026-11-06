"""Stretch the spike on the warrior's pot: at play size the drawn spike is a pixel and the pot reads as a cap.

The pot is the iron-coloured region; its spike is what a morphological opening of pot + ink takes away above it.
The new spike is a triangle on the old one's base, `--k` times as long along the same axis, inked like the
drawing (iron fill, dark outline).

usage: spike.py in.png out.png [--k 2.4] [--wide 1.2] [--angle DEG [--tipx X --tipy Y]]
"""
import sys
import math
from PIL import Image, ImageDraw, ImageFilter

args = sys.argv[1:]
opts = {}
pos = []
i = 0
while i < len(args):
    if args[i].startswith('--'):
        opts[args[i][2:]] = float(args[i + 1])
        i += 2
    else:
        pos.append(args[i])
        i += 1
src, out = pos
K = opts.get('k', 2.4)
WIDE = opts.get('wide', 1.2)
IRON = (140, 145, 147)
INK = (51, 20, 21)

im = Image.open(src).convert('RGB')
w, h = im.size
px = im.load()


def is_iron(p):
    r, g, b = p
    return 115 <= r <= 165 and abs(r - g) < 14 and abs(g - b) < 14


def is_ink(p):
    return max(p) < 90


iron = Image.new('L', (w, h), 0)
ip = iron.load()
for y in range(h):
    for x in range(w):
        if is_iron(px[x, y]):
            ip[x, y] = 255
# The pot and its ink outline: iron grown a little.
pot = iron.filter(ImageFilter.MaxFilter(9))
potp = pot.load()
both = Image.new('L', (w, h), 0)
bp = both.load()
for y in range(h):
    for x in range(w):
        if potp[x, y] and (ip[x, y] or is_ink(px[x, y])):
            bp[x, y] = 255
opened = both.filter(ImageFilter.MinFilter(31)).filter(ImageFilter.MaxFilter(31))
op = opened.load()
spike = [(x, y) for y in range(h) for x in range(w) if bp[x, y] and not op[x, y]]
body = [(x, y) for y in range(h) for x in range(w) if op[x, y]]
if not spike or not body:
    sys.exit(f'{src}: no spike found')
cx = sum(x for x, _ in body) / len(body)
cy = sum(y for _, y in body) / len(body)
# The spike is the thin part farthest from the pot's centre, pointing up (the loop handles stick out sideways).
up = [p for p in spike if (cy - p[1]) > 0.65 * math.hypot(p[0] - cx, p[1] - cy)]
if not up:
    sys.exit(f'{src}: no upward spike')
far = max(up, key=lambda p: (p[0] - cx) ** 2 + (p[1] - cy) ** 2)
dist = lambda p: math.hypot(p[0] - cx, p[1] - cy)
dmax = dist(far)
ux, uy = (far[0] - cx) / dmax, (far[1] - cy) / dmax
if 'angle' in opts:
    # A tilted head: the spike's own axis, given in degrees from straight up (negative leans left); its base is
    # where that axis, walked back from the tip, meets the opened pot.
    if 'tipx' in opts:
        far = (opts['tipx'], opts['tipy'])
    a = math.radians(opts['angle'])
    ux, uy = math.sin(a), -math.cos(a)
    t = 0.0
    while True:
        x, y = int(far[0] - ux * t), int(far[1] - uy * t)
        if not (0 <= x < w and 0 <= y < h) or op[x, y] or t > 400:
            break
        t += 1
    bx, by = far[0] - ux * t, far[1] - uy * t
else:
    # The base: where the axis from the centre leaves the opened pot.
    t = 0.0
    while True:
        x, y = int(cx + ux * t), int(cy + uy * t)
        if not (0 <= x < w and 0 <= y < h) or not op[x, y]:
            break
        t += 1
    bx, by = cx + ux * t, cy + uy * t
length = math.hypot(far[0] - bx, far[1] - by)
# The spike's width at its base, across the axis.
nx, ny = -uy, ux
half = 0
for s in range(1, 60):
    ok = False
    for sgn in (1, -1):
        x, y = int(bx + ux * 4 + nx * s * sgn), int(by + uy * 4 + ny * s * sgn)
        if 0 <= x < w and 0 <= y < h and bp[x, y]:
            ok = True
    if not ok:
        break
    half = s
half = min(max(half, 10), 18) * WIDE
L = max(length, 20) * K
tip = (bx + ux * L, by + uy * L)
b1 = (bx + nx * half - ux * 6, by + ny * half - uy * 6)
b2 = (bx - nx * half - ux * 6, by - ny * half - uy * 6)
d = ImageDraw.Draw(im)
d.polygon([b1, tip, b2], fill=INK)
ink = 7
inner_tip = (tip[0] - ux * ink * 2.2, tip[1] - uy * ink * 2.2)
i1 = (b1[0] - nx * ink, b1[1] - ny * ink)
i2 = (b2[0] + nx * ink, b2[1] + ny * ink)
d.polygon([i1, inner_tip, i2], fill=IRON)
im.save(out)
print(f'{src}: spike base {bx:.0f},{by:.0f} length {length:.0f} -> {L:.0f}, half {half:.0f}')
