"""Moves the mask's front eye hole back from its outline in a drawing, so the build finds it.

Args: drawing.png SHIFT (rewritten in place). Leaning into a run, the image model sets the near eye hole hard against
the mask's front edge, and the build takes a dark speck that close to the outline for a scrap of the ink, so the pose
traced with no face. The eye hole is the right-most blob of near-black (every channel under 40) in the top 60% of
the figure between two lighter columns; it is moved SHIFT image px to the left, and where it was is painted the mask's
white, sampled just left of it. Run it once on a fresh cut (run-2: 12).
"""
import sys
from collections import deque
from PIL import Image

path, shift = sys.argv[1], int(sys.argv[2])
im = Image.open(path).convert('RGB')
w, h = im.size
px = im.load()
black = lambda p: max(p) < 40
fig = [y for y in range(h) for x in range(0, w, 6) if min(px[x, y]) < 228]
top, low = min(fig), max(fig)
cut = top + (low - top) * 0.6
seen = bytearray(w * h)
blobs = []
for y0 in range(top, int(cut)):
    for x0 in range(w):
        if seen[y0 * w + x0] or not black(px[x0, y0]):
            continue
        blob = []
        q = deque([(x0, y0)])
        seen[y0 * w + x0] = 1
        while q:
            x, y = q.popleft()
            blob.append((x, y))
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                j = ny * w + nx
                if 0 <= nx < w and 0 <= ny < h and not seen[j] and black(px[nx, ny]):
                    seen[j] = 1
                    q.append((nx, ny))
        if 400 < len(blob) < 20000:
            blobs.append(blob)
# The eye holes are the solid round blobs; the outline is a long thin one, far bigger in extent than in area.
def solid(b):
    xs = [x for x, _ in b]
    ys = [y for _, y in b]
    return len(b) > 0.5 * (max(xs) - min(xs) + 1) * (max(ys) - min(ys) + 1)
eye = max((b for b in blobs if solid(b)), key=lambda b: sum(x for x, _ in b) / len(b))
xs = [x for x, _ in eye]
ys = [y for _, y in eye]
cy = (min(ys) + max(ys)) // 2
mask = px[min(xs) - 6, cy]
src = {p: px[p] for p in eye}
for p in eye:
    px[p] = mask
moved = {(x - shift, y) for x, y in eye}
# The hole's antialiased rim, lighter than the blob, goes with it.
for x, y in eye:
    for dx in range(-3, 4):
        for dy in range(-3, 4):
            p = (x + dx, y + dy)
            if p not in moved and p not in src and min(px[p]) < 200 and max(px[p]) - min(px[p]) < 40:
                px[p] = mask
for (x, y), c in src.items():
    px[x - shift, y] = c
im.save(path)
print(path, 'eye of', len(eye), 'px at', min(xs), '-', max(xs), 'moved', shift, 'mask', mask)
