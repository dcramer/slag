"""Whitens a drawn wall line out of a sheet before cutting (README → 3. Poses): every dark pixel (max channel
under 120) in the given columns, and the antialiased grey beside it. The figure's own ink where it touches the
wall goes too; the pen redraws its outline.

Args: sheet.png out.png x0 x1 top (image px: the wall's columns, and the row above which nothing of the figure
reaches them, so everything there goes). sheets/D-2.png → drawn/D-2.png with 668 702 925.
"""
import sys
from PIL import Image

src, out, x0, x1, top = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5])
im = Image.open(src).convert('RGB')
px = im.load()
w, h = im.size
bg = px[5, 5]
for x in range(x0, x1 + 1):
    for y in range(h):
        r, g, b = px[x, y]
        # The wall's ink and its fringe: dark or a neutral grey, never a fill's colour (the mitt's grey is lighter).
        if y < top or max(r, g, b) < 120 or (max(r, g, b) - min(r, g, b) < 14 and max(r, g, b) < 190):
            px[x, y] = bg
im.save(out)
