"""Eye whites in a box inked: whites.py SRC OUT X0 Y0 X1 Y1 — every light patch the figure closes in whose middle is in the box."""
import sys
from collections import deque
from PIL import Image
SRC, OUT = sys.argv[1:3]
X0, Y0, X1, Y1 = map(int, sys.argv[3:7])
im = Image.open(SRC).convert('RGB'); W, H = im.size; px = im.load()
light = lambda p: min(p) >= 200
seen = bytearray(W * H)
for y0 in range(Y0 - 40, Y1 + 40):
    for x0 in range(X0 - 40, X1 + 40):
        if seen[y0 * W + x0] or not light(px[x0, y0]): continue
        patch, q = [], deque([(x0, y0)]); seen[y0 * W + x0] = 1
        while q:
            x, y = q.popleft(); patch.append((x, y))
            for xx, yy in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
                if 0 <= xx < W and 0 <= yy < H and not seen[yy*W+xx] and light(px[xx, yy]):
                    seen[yy*W+xx] = 1; q.append((xx, yy))
        if len(patch) > 3000: continue
        cx = sum(p[0] for p in patch) / len(patch); cy = sum(p[1] for p in patch) / len(patch)
        if X0 <= cx <= X1 and Y0 <= cy <= Y1:
            for p in patch: px[p] = (20, 8, 8)
            print('inked', len(patch), round(cx), round(cy))
im.save(OUT)
