"""A design's colours, for a flat kind's `map.families` (tools/art3d/flat/kinds/<kind>.ts): the figure's pixels (the
white ground left out) cut to 28 colours, most used first, printed as `[r, g, b]` with their counts and drawn
as a swatch sheet beside the design, to name each one's role by eye. Shades included: each folds into its role.
Args: design.png sheet.png"""
import sys
from PIL import Image, ImageDraw

SRC, OUT = sys.argv[1], sys.argv[2]
im = Image.open(SRC).convert('RGB')
px = [p for p in im.getdata() if min(p) < 235]
flat = Image.new('RGB', (len(px), 1))
flat.putdata(px)
q = flat.quantize(colors=28, method=Image.Quantize.MEDIANCUT)
pal = q.getpalette()
cs = sorted(q.getcolors(), reverse=True)
sheet = Image.new('RGB', (1500, 270), (255, 255, 255))
d = ImageDraw.Draw(sheet)
thumb = im.copy()
thumb.thumbnail((260, 260))
sheet.paste(thumb, (0, 5))
for j, (n, i) in enumerate(cs):
    c = tuple(pal[i * 3:i * 3 + 3])
    print(f'[{c[0]}, {c[1]}, {c[2]}]  {n}')
    x, y = 270 + (j % 7) * 175, 5 + (j // 7) * 64
    d.rectangle([x, y, x + 40, y + 40], fill=c)
    d.text((x + 44, y + 4), str(list(c)), fill=(0, 0, 0))
    d.text((x + 44, y + 20), str(n), fill=(90, 90, 90))
sheet.save(OUT)
print(OUT)
