# Fills the wear edit's V notch in the crown (at play size the cube read as two ears) back into a flat-topped cube.
import sys
from PIL import Image, ImageDraw

src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
d = ImageDraw.Draw(im)
INK = (48, 16, 14)
SIDE_HAIR, TOP_HAIR = (60, 39, 22), (76, 50, 30)
SIDE_SKIN, FACE_SKIN = (201, 128, 85), (233, 174, 118)
E = 452  # the cube's near vertical edge


def top(x):
    return 113 + (105 - 113) * (x - 378) / (522 - 378)


def bot(x):
    return 207 + (196 - 207) * (x - 360) / (522 - 360)


# skin under the new hairline, down past the notch's floor
d.polygon([(360, bot(360)), (E, bot(E)), (E, 240), (360, 240)], fill=SIDE_SKIN)
d.polygon([(E, bot(E)), (526, bot(522) - 1), (526, 240), (E, 240)], fill=FACE_SKIN)
# hair over the notch
d.polygon([(372, top(372)), (E, top(E)), (E, bot(E)), (360, bot(360)), (360, 150)], fill=SIDE_HAIR)
d.polygon([(E, top(E)), (526, top(526)), (526, bot(526)), (E, bot(E))], fill=TOP_HAIR)
# ink: crown, hairline, the near edge
d.line([(372, top(372) + 1), (528, top(528))], fill=INK, width=8)
d.line([(356, bot(356)), (528, bot(528))], fill=INK, width=7)
d.line([(E, top(E)), (E, 268)], fill=INK, width=6)
im.save(out)
