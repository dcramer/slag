"""A drawing's eye whites inked: ink-eyes.py SRC OUT [--max PX].

Her design's eyes are dark ovals with no whites, the kit's `dot`. A drawing that gives her eye whites (the fall's wide
eyes) traces their thin pupils as line and the whites as skin, and no eyes are found. Every patch of white the figure
closes in, no bigger than `--max` image px (an eye, not a gap under an arm), is filled with the eyes' own near-black.
"""
import sys
from collections import deque
from PIL import Image

args = sys.argv[1:]
MAX = 1500
if '--max' in args:
    i = args.index('--max')
    MAX = int(args[i + 1])
    del args[i : i + 2]
SRC, OUT = args
im = Image.open(SRC).convert('RGB')
W, H = im.size
px = im.load()
light = lambda p: min(p) >= 200
seen = bytearray(W * H)
for i0 in range(W * H):
    x0, y0 = i0 % W, i0 // W
    if seen[i0] or not light(px[x0, y0]):
        continue
    patch, q, edge = [], deque([i0]), False
    seen[i0] = 1
    while q:
        i = q.popleft()
        patch.append(i)
        x, y = i % W, i // W
        if x in (0, W - 1) or y in (0, H - 1):
            edge = True
        for j in (i - 1 if x > 0 else -1, i + 1 if x < W - 1 else -1, i - W if y > 0 else -1, i + W if y < H - 1 else -1):
            if j >= 0 and not seen[j] and light(px[j % W, j // W]):
                seen[j] = 1
                q.append(j)
    if not edge and len(patch) <= MAX:
        for i in patch:
            px[i % W, i // W] = (50, 30, 38)
        print(f'inked {len(patch)} px at {patch[0] % W},{patch[0] // W}')
im.save(OUT)
