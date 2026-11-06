"""The design with bigger gloves held further apart, as the reference for its redraw: regloves.py SRC OUT.

Two blind reads named him from the gloves at low: the upper glove sat a hair from his nose, so the pen joined it to his
head, and both were his head's size. Here each glove is scaled up 1.25 about its cuff, the upper one pushed out ahead of
his face on a longer forearm and the lower one dropped to his belly on a new forearm, with background between them, the
face and the body. The image model redraws it clean (design.prompt.txt), so the seams here never ship.
"""
import sys
from PIL import Image, ImageDraw

SRC, OUT = sys.argv[1:3]
im = Image.open(SRC).convert('RGB')
W, H = im.size
S = 1.25
SKIN = (227, 167, 115)
INK = (19, 16, 28)
TAPE = (157, 157, 149)


def layer(box, keep):
    """The non-white pixels of a box, as an RGBA layer, those `keep` refuses left out."""
    x0, y0, x1, y1 = box
    out = Image.new('RGBA', (x1 - x0, y1 - y0), (0, 0, 0, 0))
    px, op = im.load(), out.load()
    for y in range(y0, y1):
        for x in range(x0, x1):
            p = px[x, y]
            if min(p) < 235 and keep(x, y, p):
                op[x - x0, y - y0] = p + (255,)
    return out


cloth = lambda p: max(p) < 70 and abs(p[0] - p[1]) < 10 and abs(p[1] - p[2]) < 12
upper_box = (575, 222, 830, 425)
lower_box = (548, 462, 826, 690)
upper = layer(upper_box, lambda x, y, p: not (x < 615 and y < 300 and p[1] > p[0] + 20))  # the loop beside his brow goes
lower = layer(lower_box, lambda x, y, p: not (x < 600 and y > 575 and cloth(p)))

# Take both off: everything in their boxes but his face, chest and shorts.
d = ImageDraw.Draw(im)
px = im.load()
for x0, y0, x1, y1 in (upper_box, (548, 462, 826, 800)):
    for y in range(y0, y1):
        for x in range(x0, x1):
            p = px[x, y]
            face = x < 590 and y < 430 and p[0] > 200 and p[1] > 140
            if not face and not (x < 590 and cloth(p) and y > 470):
                px[x, y] = (255, 255, 255)


def arm(a, b, w=44):
    d.line([a, b], fill=INK, width=w + 12)
    d.line([a, b], fill=SKIN, width=w)


def paste(lay, box, anchor, to):
    """Scaled S about `anchor` (image px), moved so the anchor lands on `to`."""
    lw, lh = lay.size
    big = lay.resize((round(lw * S), round(lh * S)), Image.LANCZOS)
    ax, ay = anchor
    ox = to[0] - round((ax - box[0]) * S)
    oy = to[1] - round((ay - box[1]) * S)
    im.paste(big, (ox, oy), big)


# The upper forearm on out to its cuff, ahead of his face; the lower one from his elbow down to its cuff by his belly.
arm((560, 322), (650, 322))
arm((505, 560), (640, 700))
paste(upper, upper_box, (580, 320), (640, 318))
paste(lower, lower_box, (556, 570), (630, 700))
# The tape round the lower wrist, where the new forearm meets the cuff.
d.line([(612, 668), (642, 718)], fill=INK, width=30)
d.line([(612, 668), (642, 718)], fill=TAPE, width=20)
im.save(OUT)
