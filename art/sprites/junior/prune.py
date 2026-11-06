"""Takes the two side antennae off Junior's drawings, keeping the one that rises from his cap (the reference's big zigzag).

Args: drawing.png [...] (each rewritten in place, after prep.py). Three steel antennae spread round his head read in
black as spiky hair or an imp's horns (round 3), and in colour as bones or twigs; the reference's side ones are small.
The steel patches above the figure's middle (the wheels are below it) are grouped into antennae, pieces within GAP px
of each other being one (the ink breaks a zigzag into several); the antenna reaching highest stays, and every grey
or ink pixel within REACH of the others goes white.
"""
import sys
from collections import deque
from PIL import Image

STEEL = (163, 166, 183)
GAP = 16
REACH = 7


def steel(p):
    return max(abs(p[i] - STEEL[i]) for i in range(3)) <= 28 and p[2] > p[0]


def patches(px, w, h, test):
    seen = bytearray(w * h)
    out = []
    for y0 in range(h):
        for x0 in range(w):
            if seen[y0 * w + x0] or not test(px[x0, y0]):
                continue
            comp, q = [], deque([(x0, y0)])
            seen[y0 * w + x0] = 1
            while q:
                x, y = q.popleft()
                comp.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and test(px[nx, ny]):
                        seen[ny * w + nx] = 1
                        q.append((nx, ny))
            out.append(comp)
    return out


def close(a, b):
    """Whether two pieces come within GAP px of each other (checked on every fourth pixel of each)."""
    return any(abs(x - u) <= GAP and abs(y - v) <= GAP for x, y in a[::4] for u, v in b[::4])


for path in sys.argv[1:]:
    im = Image.open(path).convert('RGB')
    w, h = im.size
    px = im.load()
    fig = [y for y in range(0, h, 2) for x in range(0, w, 2) if min(px[x, y]) < 228]
    top, low = min(fig), max(fig)
    pieces = [c for c in patches(px, w, h, steel) if len(c) > 20 and sum(y for _, y in c) / len(c) < top + (low - top) * 0.5]
    groups = []
    for c in pieces:
        hit = [g for g in groups if any(close(c, d) for d in g)]
        merged = [c] + [d for g in hit for d in g]
        groups = [g for g in groups if g not in hit] + [merged]
    if len(groups) < 2:
        print(path, len(groups), 'antennae, left alone')
        continue
    keep = min(groups, key=lambda g: min(y for c in g for _, y in c))
    gone = [p for g in groups if g is not keep for c in g for p in c]
    kept = set(p for c in keep for p in c)
    # Grey and ink: low in saturation, and not the background.
    neutral = lambda p: max(p) - min(p) < 45 and min(p) < 240
    wipe = set()
    for x, y in gone:
        for dx in range(-REACH, REACH + 1):
            for dy in range(-REACH, REACH + 1):
                q = (x + dx, y + dy)
                if 0 <= q[0] < w and 0 <= q[1] < h and q not in kept and neutral(px[q]):
                    wipe.add(q)
    for q in wipe:
        px[q] = (255, 255, 255)
    im.save(path)
    print(path, len(groups), 'antennae, kept the top one')
