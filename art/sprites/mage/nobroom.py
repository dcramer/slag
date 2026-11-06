# The knockout's dropped broom whitened out of flat/death.png: lying apart below him, it reached past the cast's box
# on the left and its tape's tail took the pen under the floor. Each figure piece that holds the point given goes.
# python3 -I art/sprites/mage/nobroom.py art/sprites/mage/flat/death.png X Y
import sys
from collections import deque
from PIL import Image

src, x0, y0 = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
im = Image.open(src).convert('RGB')
px = im.load()
W, H = im.size
fig = lambda x, y: min(px[x, y]) < 228
seen = set([(x0, y0)])
q = deque([(x0, y0)])
assert fig(x0, y0), 'the point is background'
while q:
    x, y = q.popleft()
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        n = (x + dx, y + dy)
        if 0 <= n[0] < W and 0 <= n[1] < H and n not in seen and fig(*n):
            seen.add(n)
            q.append(n)
# The antialiased rim round it goes with it.
for x, y in list(seen):
    for dx in (-2, -1, 0, 1, 2):
        for dy in (-2, -1, 0, 1, 2):
            if 0 <= x + dx < W and 0 <= y + dy < H:
                seen.add((x + dx, y + dy))
for x, y in seen:
    px[x, y] = (255, 255, 255)
print('whitened', len(seen))
im.save(src)
