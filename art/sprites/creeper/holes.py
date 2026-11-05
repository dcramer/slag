"""The creeper's face is four holes cut through the box: each pose drawing's black face holes painted white, so
`map.holes` cuts them through the frame and the level shows (the read: in black, his outline alone is a post).
Prints each drawing's eyes as fractions of the figure's box, for `eyes.at` and `eyes.pair`.

python3 -I art/sprites/creeper/holes.py IN OUT [IN OUT ...]
"""
import sys
from PIL import Image, ImageDraw, ImageFilter

# The face cut through the box, in units of the eyes' spacing from the near eye's middle: two square eyes and a
# stepped frown under the gap between them (its middle block and its two legs one hole), each a hair apart.
E = 0.05
FACE = [
    (-0.25 + E, -0.25 + E, 0.25 - E, 0.25 - E),
    (0.75 + E, -0.25 + E, 1.25 - E, 0.25 - E),
    (0.25, 0.25 + E, 0.75, 1.0),
    (0.0, 0.5, 0.25, 1.25),
    (0.75, 0.5, 1.0, 1.25),
]
GLYPH = 1.2


def holes(src, out):
    im = Image.open(src).convert('RGB')
    w, h = im.size
    px = im.load()
    # What the model draws beside him and the tracer would keep: grey motion lines, a wall line, the death's smoke.
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            if max(r, g, b) - min(r, g, b) < 18 and 60 < (r + g + b) / 3 < 236:
                px[x, y] = (255, 255, 255)
    # Then only the figure: the biggest patch that isn't the background.
    solid = Image.new('L', im.size, 0)
    sp = solid.load()
    for y in range(h):
        for x in range(w):
            sp[x, y] = 255 if min(px[x, y]) < 228 else 0
    best, mark = 0, 0
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            if sp[x, y] == 255 and mark < 250:
                mark += 1
                ImageDraw.floodfill(solid, (x, y), 255 - mark)
                sp = solid.load()
    sizes = solid.histogram()
    keep_v = max(range(1, 255), key=lambda v: sizes[v])
    # A dark stray goes (a wall line, a motion line in ink); a coloured one stays (the flame, apart from its wick).
    tone = {}
    for y in range(h):
        for x in range(w):
            v = sp[x, y]
            if 0 < v < 255 and v != keep_v:
                t = tone.setdefault(v, [0, 0])
                t[0] += max(px[x, y])
                t[1] += 1
    drop = {v for v, (a, n) in tone.items() if a / n < 150}
    for y in range(h):
        for x in range(w):
            if sp[x, y] in drop:
                px[x, y] = (255, 255, 255)
    # The figure's box: everything but the white flooded in from the border.
    bgm = Image.new('L', im.size, 0)
    bp = bgm.load()
    for y in range(h):
        for x in range(w):
            bp[x, y] = 255 if min(px[x, y]) >= 228 else 0
    ImageDraw.floodfill(bgm, (0, 0), 128)
    fig = bgm.point(lambda v: 0 if v == 128 else 255)
    x0, y0, x1, y1 = fig.getbbox()
    # The holes' black is darker than the ink's dark green, and thicker: an opening drops the ink's thin dark.
    dark = Image.new('L', im.size, 0)
    dp = dark.load()
    for y in range(y0, y1):
        for x in range(x0, x1):
            r, g, b = px[x, y]
            dp[x, y] = 255 if max(r, g, b) < 48 else 0
    n = max(3, (y1 - y0) // 120) | 1
    dark = dark.filter(ImageFilter.MinFilter(n)).filter(ImageFilter.MaxFilter(n))
    # Its rim of ink too: the game inks a hole round.
    grow = max(3, (y1 - y0) // 200) | 1
    dark = dark.filter(ImageFilter.MaxFilter(grow))
    # Each patch, biggest first: the eyes are the two highest side by side, the frown under them.
    dp = dark.load()
    comps = []
    for y in range(y0, y1):
        for x in range(x0, x1):
            if dp[x, y] == 255:
                c = 10 + len(comps)
                ImageDraw.floodfill(dark, (x, y), c)
                dp = dark.load()
                bb = dark.point(lambda v, c=c: 255 if v == c else 0).getbbox()
                area = sum(1 for yy in range(bb[1], bb[3]) for xx in range(bb[0], bb[2]) if dp[xx, yy] == c)
                comps.append((area, c, bb))
    comps = [q for q in comps if q[0] > (y1 - y0) ** 2 / 4000]
    keep = dark.point(lambda v: 255 if v in {q[1] for q in comps} else 0)
    mid = lambda bb: ((bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2)
    eyes = []
    if len(comps) == 3:
        # The drawn face is too small to survive play size (two pixel specks), so a bolder one is cut where it was:
        # the same four holes, two square eyes and the stepped frown, on the head's turn (an affine through the
        # drawn eyes and frown), GLYPH times bigger.
        by_y = sorted(comps, key=lambda q: mid(q[2])[1])
        (l, r), m = sorted((mid(q[2]) for q in by_y[:2])), mid(by_y[2][2])
        # Canonical: left eye (0, 0), right eye (1, 0), the frown's middle (0.5, 0.75).
        ax, ay = r[0] - l[0], r[1] - l[1]
        bx, by = (m[0] - l[0] - 0.5 * ax) / 0.75, (m[1] - l[1] - 0.5 * ay) / 0.75
        at = lambda u, v: (l[0] + u * ax + v * bx, l[1] + u * ay + v * by)
        c = (0.5, 0.5)
        g = lambda u, v: at(c[0] + (u - c[0]) * GLYPH, c[1] + (v - c[1]) * GLYPH)
        d = ImageDraw.Draw(keep)
        for u0, v0, u1, v1 in FACE:
            d.polygon([g(u0, v0), g(u1, v0), g(u1, v1), g(u0, v1)], fill=255)
        eyes = [g(0, 0), g(1, 0)]
    white = Image.new('RGB', im.size, (255, 255, 255))
    im.paste(white, (0, 0), keep)
    im.save(out)
    fw, fh = x1 - x0, y1 - y0
    fr = [((x - x0) / fw, (y - y0) / fh) for x, y in eyes]
    print(f'{src}: {len(comps)} holes; eyes at ' + ' '.join(f'[{a:.3f}, {b:.3f}]' for a, b in fr) + f'; box {fw}x{fh}')

args = sys.argv[1:]
for i in range(0, len(args), 2):
    holes(args[i], args[i + 1])
