# Smooth the dented hard hat back into a clean dome in pose drawings: in a fresh read the dent's notch in the
# dome's side made the hat read as a cap (the undented edit read as the engineer twice, the dented one as the
# plumber twice). Finds the dome (flooded from its top through the hat's light greys, ink as the wall), and
# paints a half-ellipse dome over its box: hat grey inside, an ink rim, background where the old dome stuck out.
# Args: drawing.png… — writes each in place.
import sys
from PIL import Image

FILL = (186, 180, 168)
INK = (30, 10, 6)


def light(p):
    return 150 < min(p) and max(p) < 240 and max(p) - min(p) < 40


def bg(p):
    return min(p) > 232


def dome(path, rim=None):
    im = Image.open(path).convert('RGB')
    W, H = im.size
    px = im.load()
    top = next(y for y in range(H) if any(not bg(px[x, y]) for x in range(0, W, 2)))
    seed = None
    for y in range(top + 25, H):
        xs = [x for x in range(W) if light(px[x, y])]
        if len(xs) > 40:
            seed = (xs[len(xs) // 2], y)
            if light(px[seed[0], seed[1]]):
                break
    seen = {seed}
    stack = [seed]
    while stack:
        x, y = stack.pop()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if (nx, ny) not in seen and 0 <= nx < W and 0 <= ny < H and light(px[nx, ny]):
                seen.add((nx, ny))
                stack.append((nx, ny))
    y1 = rim or max(p[1] for p in seen)
    # The whole dome's width: the hat is all there is of the figure above its rim.
    rows = range(top, top + int((y1 - top) * 0.8))
    x0 = min(next(x for x in range(W) if not bg(px[x, y])) for y in rows if any(not bg(px[x, y]) for x in range(W)))
    x1 = max(next(x for x in range(W - 1, -1, -1) if not bg(px[x, y])) for y in rows if any(not bg(px[x, y]) for x in range(W)))
    y0 = top
    cx, ax = (x0 + x1) / 2, (x1 - x0) / 2
    ay = y1 - y0
    pen = max(5, ax * 0.07)
    n = 0
    for y in range(y0 - 2, y1 + 1):
        for x in range(int(cx - ax - 6), int(cx + ax + 7)):
            if not (0 <= x < W and 0 <= y < H):
                continue
            u, v = (x - cx) / ax, (y - y1) / ay
            r = u * u + v * v
            if r <= 1:
                inner = ((x - cx) / (ax - pen)) ** 2 + ((y - y1) / (ay - pen)) ** 2 <= 1
                px[x, y] = FILL if inner else INK
                n += 1
            elif y < top + (y1 - top) * 0.8:
                px[x, y] = (255, 255, 255)
    im.save(path)
    print(path, 'dome', (x0, y0, x1, y1), 'painted', n)


for a in sys.argv[1:]:
    p, _, r = a.partition(':')
    dome(p, int(r) if r else None)
