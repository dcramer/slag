"""The roast leg turned level: the image model drew it standing up out of his fist every time it was asked to hold it
out level (drawn/r4-level-*.png), and standing up it is the penguin king's raised hammer. This turns the meat a
quarter turn clockwise about the top of his fist, so it points forward, drops the bone end under the fist, and puts
the fist back over the meat's root. The canvas grows to the right for it.

    python3 -I art/sprites/warrior/level.py IN OUT X0 Y0 X1 Y1 PX PY BX0 BY0 BX1 BY1 FX0 FY0 FX1 FY1

Boxes are fractions of the image: the meat (X0..Y1), the pivot (PX, PY), the bone end to whiten (BX0..BY1) and the
fist to put back on top (FX0..FY1).
"""

import sys

from PIL import Image

src, out = sys.argv[1], sys.argv[2]
v = [float(a) for a in sys.argv[3:]]
im = Image.open(src).convert('RGB')
w, h = im.size
x0, y0, x1, y1 = int(v[0] * w), int(v[1] * h), int(v[2] * w), int(v[3] * h)
px, py = v[4] * w, v[5] * h
bx0, by0, bx1, by1 = int(v[6] * w), int(v[7] * h), int(v[8] * w), int(v[9] * h)
fx0, fy0, fx1, fy1 = int(v[10] * w), int(v[11] * h), int(v[12] * w), int(v[13] * h)

PAD = 220
WHITE = 235
canvas = Image.new('RGB', (w + PAD, h), (255, 255, 255))
canvas.paste(im, (0, 0))

meat = im.crop((x0, y0, x1, y1))
mask = Image.new('L', meat.size, 0)
mp, mt = mask.load(), meat.load()
for y in range(meat.height):
    for x in range(meat.width):
        if min(mt[x, y]) < WHITE:
            mp[x, y] = 255
# Whiten where the meat and the bone end were: the whole box, its antialiased rim included.
cp = canvas.load()
for y in range(y0, y1):
    for x in range(x0, x1):
        cp[x, y] = (255, 255, 255)
for y in range(by0, by1):
    for x in range(bx0, bx1):
        cp[x, y] = (255, 255, 255)
# A quarter turn clockwise (screen y down): the crop's bottom-left corner lands at the new top-left.
turned = meat.rotate(-90, expand=True)
tmask = mask.rotate(-90, expand=True)
canvas.paste(turned, (round(px - (y1 - py)), round(py + (x0 - px))), tmask)
# The fist back on top of the meat's root.
fist = im.crop((fx0, fy0, fx1, fy1))
fmask = Image.new('L', fist.size, 0)
fp, ft = fmask.load(), fist.load()
for y in range(fist.height):
    for x in range(fist.width):
        if min(ft[x, y]) < WHITE:
            fp[x, y] = 255
canvas.paste(fist, (fx0, fy0), fmask)
canvas.save(out)
