"""The fall's alarmed eyes are white rings round small pupils: the whites, closed in by the outline, would be cut
through as holes, and the pupils are too small to find. Each white is painted fur and its pupil a solid dark disc,
so the face kit finds the eyes and draws its own. Source in drawn/, result in flat/.

Usage: python3 -I art/sprites/rapper/eyes.py drawn/air-2.png flat/air-2.png X,Y,PX,PY ...  (seed in the white, pupil centre)
"""
import sys
from collections import deque
from PIL import Image, ImageDraw

src, out, eyes = sys.argv[1], sys.argv[2], sys.argv[3:]
im = Image.open(src).convert('RGB')
px = im.load()
w, h = im.size
FUR = (238, 204, 139)
for e in eyes:
    x0, y0, cx, cy = (int(v) for v in e.split(','))
    q = deque([(x0, y0)])
    seen = set()
    while q:
        x, y = q.popleft()
        if (x, y) in seen or not (0 <= x < w and 0 <= y < h) or min(px[x, y]) < 200:
            continue
        seen.add((x, y))
        px[x, y] = FUR
        q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    ImageDraw.Draw(im).ellipse((cx - 15, cy - 19, cx + 15, cy + 19), fill=(0, 0, 0))
im.save(out)
