"""The miner's poses cut from his one design: he's a wooden toy, every limb a rigid block on a dowel, so each
pose is the design's own parts turned about their joints (the image allowance ran out after the design).
Args: design.png outdir [debug.png]."""
import math
import sys
from collections import deque
from PIL import Image, ImageChops, ImageDraw

SRC, OUT = sys.argv[1], sys.argv[2]
DEBUG = sys.argv[3] if len(sys.argv) > 3 else None
im = Image.open(SRC).convert('RGB')
W, H = im.size
px = im.load()
INK = (48, 16, 14)

# The figure: everything but the white connected to the border.
bg = bytearray(W * H)
q = deque([(x, 0) for x in range(W)] + [(x, H - 1) for x in range(W)] + [(0, y) for y in range(H)] + [(W - 1, y) for y in range(H)])
while q:
    x, y = q.popleft()
    i = y * W + x
    if bg[i] or min(px[x, y]) < 236:
        continue
    bg[i] = 1
    if x > 0:
        q.append((x - 1, y))
    if x < W - 1:
        q.append((x + 1, y))
    if y > 0:
        q.append((x, y - 1))
    if y < H - 1:
        q.append((x, y + 1))
fig = Image.new('L', (W, H))
fig.putdata([0 if b else 255 for b in bg])


def poly(pts):
    m = Image.new('L', (W, H))
    ImageDraw.Draw(m).polygon(pts, fill=255)
    return m


# The parts, in the design's own coordinates. The near arm (the viewer's left, its shoulder over the torso),
# the far arm with the pickaxe, the two legs under the trousers' waist block, and the core: head, torso, waist.
MASKS = {
    'arm': poly([(286, 436), (430, 444), (452, 498), (378, 580), (318, 712), (240, 718), (192, 694), (186, 640), (250, 520)]),
    'pick': poly([(630, 456), (697, 456), (697, 222), (710, 222), (710, 150), (1000, 150), (1010, 430), (870, 430), (812, 812), (648, 812), (640, 572), (630, 562)]),
    'back': poly([(350, 708), (446, 733), (498, 729), (500, 750), (458, 905), (456, 962), (304, 966), (292, 892), (346, 740)]),
    'front': poly([(498, 729), (614, 709), (652, 838), (704, 902), (694, 966), (526, 970), (500, 752)]),
}
PIVOT = {'arm': (378, 482), 'pick': (642, 506), 'back': (420, 726), 'front': (556, 722)}
FEET = (500, 952)

rgba = im.convert('RGBA')


def layer(src, mask):
    out = src.copy()
    out.putalpha(ImageChops.multiply(fig, mask))
    return out


limbs = Image.new('L', (W, H))
for m in MASKS.values():
    limbs = ImageChops.lighter(limbs, m)

# The core, with the torso's side face painted in where the near arm's shoulder lay over it, and the legs'
# tops carried up behind the waist so a swung leg leaves no gap under it.
core_src = im.copy()
d = ImageDraw.Draw(core_src)
d.polygon([(343, 448), (446, 448), (446, 640), (343, 640)], fill=(31, 142, 41))
d.line([(343, 446), (343, 642)], fill=INK, width=7)
d.line([(446, 450), (446, 642)], fill=INK, width=6)
core_fig = ImageChops.lighter(ImageChops.subtract(fig, limbs), poly([(340, 446), (450, 446), (450, 640), (340, 640)]))
core = core_src.convert('RGBA')
core.putalpha(core_fig)

leg_src = im.copy()
dl = ImageDraw.Draw(leg_src)
dl.polygon([(372, 690), (494, 690), (494, 760), (372, 740)], fill=(40, 23, 58))
dl.polygon([(500, 690), (606, 690), (612, 730), (500, 752)], fill=(57, 62, 138))
pad = Image.new('L', (W, H))
ImageDraw.Draw(pad).polygon([(372, 690), (606, 690), (606, 740), (372, 740)], fill=255)
legs = {
    'back': leg_src.convert('RGBA'),
    'front': leg_src.convert('RGBA'),
}
legs['back'].putalpha(ImageChops.lighter(ImageChops.multiply(fig, MASKS['back']), ImageChops.multiply(pad, poly([(372, 690), (496, 690), (496, 760), (372, 760)]))))
legs['front'].putalpha(ImageChops.lighter(ImageChops.multiply(fig, MASKS['front']), ImageChops.multiply(pad, poly([(500, 690), (608, 690), (608, 760), (500, 760)]))))
parts = {'arm': layer(rgba, MASKS['arm']), 'pick': layer(rgba, MASKS['pick']), **legs}


def turned(img, deg, at):
    """Turns a layer `deg` degrees counter-clockwise on screen about `at` (premultiplied, so no dark fringe)."""
    if not deg:
        return img
    return img.convert('RGBa').rotate(deg, resample=Image.BICUBIC, center=at).convert('RGBA')


def pose(arm=0, pick=0, back=0, front=0, tilt=0, about=FEET, lie=False, lift=(0, 0)):
    """One pose: each limb's swing (degrees, + forward: a leg's foot or an arm's hand toward his front), the
    whole figure tipped `tilt` degrees counter-clockwise (+ leans back) about `about`. `lie`: knocked flat,
    the figure turned whole and set down centred, the way a toppled toy lies."""
    canvas = Image.new('RGBA', (W, H), (255, 255, 255, 0))
    # The far arm with the pickaxe, raised by sliding it up behind the torso (`lift`): turned up, its head
    # went behind the cube and read as a horn on it.
    far = turned(parts['pick'], pick, PIVOT['pick'])
    if lift != (0, 0):
        far = far.transform(far.size, Image.AFFINE, (1, 0, -lift[0], 0, 1, -lift[1]))
    canvas.alpha_composite(far)
    for name, deg in (('back', back), ('front', front)):
        canvas.alpha_composite(turned(parts[name], deg, PIVOT[name]))
    canvas.alpha_composite(core)
    canvas.alpha_composite(turned(parts['arm'], arm, PIVOT['arm']))
    out = Image.new('RGBA', (W, H), (255, 255, 255, 255))
    if lie:
        flat = canvas.convert('RGBa').rotate(tilt, resample=Image.BICUBIC, expand=True).convert('RGBA')
        flat = flat.crop(flat.getbbox())
        k = min(1, 960 / flat.width, 960 / flat.height)
        flat = flat.convert('RGBa').resize((round(flat.width * k), round(flat.height * k)), Image.LANCZOS).convert('RGBA')
        out.alpha_composite(flat, ((W - flat.width) // 2, (H - flat.height) // 2))
    else:
        out.alpha_composite(turned(canvas, tilt, about))
    return out.convert('RGB')


# The arms hang a little back at rest (the near hand behind the hip), the legs mid-stride: the near-left leg
# back, the right one forward. Angles are on top of that.
POSES = {
    'idle2': dict(arm=10, pick=26, back=9, front=-6),
    'walk-1': dict(arm=18, back=-4, front=6),
    'walk-2': dict(arm=-14, pick=4, back=10, front=-6),
    'run-1': dict(arm=40, pick=-8, back=-20, front=22, tilt=-7),
    'run-2': dict(arm=-42, pick=6, back=24, front=-18, tilt=-7),
    'air-1': dict(arm=-60, pick=-8, lift=(6, -90), back=9, front=-5),
    'air-2': dict(arm=-120, pick=18, back=-16, front=16),
    # A raised near arm lies over the cube's side face and reads as a hand on the brow: out behind him instead.
    'wall': dict(arm=-75, pick=-15, back=-6, front=30),
    'cheer': dict(arm=-105, pick=-14, lift=(14, -150), back=8, front=-4),
    'cheer2': dict(arm=-85, pick=12, lift=(0, -50), tilt=8, about=(380, 952)),
    'death': dict(arm=30, pick=-150, back=-6, front=6, tilt=90, about=(512, 512), lie=True),
}

for name, p in POSES.items():
    if len(sys.argv) > 4 and name not in sys.argv[4].split(','):
        continue
    pose(**p).save(f'{OUT}/{name}.png')

if DEBUG:
    dbg = im.copy().convert('RGBA')
    tint = {'arm': (255, 0, 0, 90), 'pick': (0, 0, 255, 90), 'back': (255, 0, 255, 90), 'front': (0, 200, 255, 90)}
    for n, m in MASKS.items():
        t = Image.new('RGBA', (W, H), tint[n])
        dbg.paste(t, mask=ImageChops.multiply(m, Image.new('L', (W, H), 90)))
    dd = ImageDraw.Draw(dbg)
    for x, y in PIVOT.values():
        dd.ellipse([x - 8, y - 8, x + 8, y + 8], fill=(255, 255, 0, 255))
    dbg.convert('RGB').save(DEBUG)
