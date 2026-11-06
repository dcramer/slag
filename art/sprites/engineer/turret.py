# The turret's red pieces of a pose drawing (it is drawn in the shirt's red, split by ink), listed with their area,
# centre and box (`python3 -I turret.py drawing.png`). With `paint` and component ids, recolours
# those components (and the red inside their joint box) to the turret's own colour, in place.
import sys, colorsys
from PIL import Image

path = sys.argv[1]
im = Image.open(path).convert('RGB')
W, H = im.size
px = im.load()


def red(p):
    h, s, v = colorsys.rgb_to_hsv(p[0] / 255, p[1] / 255, p[2] / 255)
    return (h > 0.94 or h < 0.06) and s > 0.5 and 0.25 < v < 0.62


seen = bytearray(W * H)
comps = []
for y0 in range(H):
    for x0 in range(W):
        if seen[y0 * W + x0] or not red(px[x0, y0]):
            continue
        stack = [(x0, y0)]
        seen[y0 * W + x0] = 1
        pts = []
        while stack:
            x, y = stack.pop()
            pts.append((x, y))
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < W and 0 <= ny < H and not seen[ny * W + nx] and red(px[nx, ny]):
                    seen[ny * W + nx] = 1
                    stack.append((nx, ny))
        if len(pts) > 600:
            xs = [p[0] for p in pts]
            ys = [p[1] for p in pts]
            comps.append((len(pts), sum(xs) // len(xs), sum(ys) // len(ys), min(xs), min(ys), max(xs), max(ys), pts))
comps.sort(key=lambda c: -c[0])
if len(sys.argv) > 2 and sys.argv[2] == 'paint':
    ids = [int(a) for a in sys.argv[3:]]
    pick = [comps[i] for i in ids]
    x0 = min(c[3] for c in pick) - 6
    y0 = min(c[4] for c in pick) - 6
    x1 = max(c[5] for c in pick) + 6
    y1 = max(c[6] for c in pick) + 6
    n = 0
    for y in range(max(0, y0), min(H, y1 + 1)):
        for x in range(max(0, x0), min(W, x1 + 1)):
            p = px[x, y]
            if red(p) or (p[0] > 60 and p[0] > p[1] * 1.8 and p[0] > p[2] * 1.8 and max(p) < 170):
                h, s, v = colorsys.rgb_to_hsv(p[0] / 255, p[1] / 255, p[2] / 255)
                # The turret's own hue, a violet far from the shirt's red, keeping each pixel's value.
                r, g, b = colorsys.hsv_to_rgb(0.8, min(1, s), v)
                px[x, y] = (int(r * 255), int(g * 255), int(b * 255))
                n += 1
    im.save(path)
    print('painted', n, 'in', (x0, y0, x1, y1))
else:
    for i, c in enumerate(comps[:14]):
        print(i, 'area', c[0], 'centre', c[1:3], 'box', c[3:7])
