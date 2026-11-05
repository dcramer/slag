# Whiten a drawn wall line: columns dark most of the way down. Where the figure touches the line (the pixel just left
# of it is figure), the line stays as the figure's own edge, so a white boot keeps its outline.
import sys
from PIL import Image
src, out = sys.argv[1:3]
im = Image.open(src).convert('RGB'); px = im.load(); W, H = im.size
cols = [x for x in range(W) if sum(1 for y in range(H) if max(px[x, y]) < 110) > 0.45 * H]
lo, hi = min(cols) - 3, max(cols) + 3
for y in range(H):
    touch = any(min(px[lo - k, y]) < 228 for k in range(1, 4))
    for x in range(lo, hi + 1):
        if touch and x <= max(cols): continue
        px[x, y] = (255, 255, 255)
print('columns', cols)
im.save(out)
