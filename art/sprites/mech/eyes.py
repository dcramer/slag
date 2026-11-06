"""The fall's wide eyes (white rings round a dot) repainted as her other poses' black dots, so the face kit finds them.

python3 -I art/sprites/mech/eyes.py art/sprites/mech/drawn/air-2.png art/sprites/mech/flat/air-2.png

Drawn wide, each eye was a white with a pupil too small to be a speck, and the kit found no face on the fall. Each eye's
white and its ring are painted over in her skin, and a black oval the size of her idle's eyes goes where the pupil was.
"""
import sys
from PIL import Image, ImageDraw

SKIN = (245, 199, 165)
INK = (14, 8, 19)
# centre x, centre y, skin radius: measured on drawn/air-2.png.
EYES = [(429, 251, 23), (483, 234, 20)]

src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
d = ImageDraw.Draw(im)
for x, y, r in EYES:
    d.ellipse((x - r, y - r, x + r, y + r), fill=SKIN)
    d.ellipse((x - 6, y - 9, x + 6, y + 9), fill=INK)
im.save(out)
