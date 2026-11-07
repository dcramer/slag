"""The invader's two square eye holes are holes: each drawing's black eye squares (and their ink rim) painted white,
so `map.holes` cuts them through the frame and the level shows through, as through the arcade crab's. Prints each
drawing's eyes as fractions of the figure's box, the left one first, for `eyes.at` and `eyes.pair`.

python3 -I art/sprites/marcher/holes.py IN OUT [IN OUT ...]
"""
import sys
from PIL import Image, ImageDraw, ImageFilter


def holes(src, out):
    im = Image.open(src).convert('RGB')
    w, h = im.size
    px = im.load()
    # The figure's box: everything but the white flooded in from the border.
    bgm = Image.new('L', im.size, 0)
    bp = bgm.load()
    for y in range(h):
        for x in range(w):
            bp[x, y] = 255 if min(px[x, y]) >= 228 else 0
    ImageDraw.floodfill(bgm, (0, 0), 128)
    fig = bgm.point(lambda v: 0 if v == 128 else 255)
    x0, y0, x1, y1 = fig.getbbox()
    # The eye squares are solid ink, far thicker than the outline: an opening drops the line and keeps them.
    dark = Image.new('L', im.size, 0)
    dp = dark.load()
    for y in range(y0, y1):
        for x in range(x0, x1):
            dp[x, y] = 255 if max(px[x, y]) < 70 else 0
    n = max(5, (y1 - y0) // 40) | 1
    dark = dark.filter(ImageFilter.MinFilter(n)).filter(ImageFilter.MaxFilter(n))
    # Their rim of ink too: the game inks a hole round.
    dark = dark.filter(ImageFilter.MaxFilter(max(3, (y1 - y0) // 150) | 1))
    dp = dark.load()
    comps = []
    for y in range(y0, y1):
        for x in range(x0, x1):
            if dp[x, y] == 255:
                c = 10 + len(comps)
                ImageDraw.floodfill(dark, (x, y), c)
                dp = dark.load()
                m = dark.point(lambda v, c=c: 255 if v == c else 0)
                comps.append((m.histogram()[255], c, m.getbbox()))
    comps.sort(reverse=True)
    eyes = comps[:2]
    keep = dark.point(lambda v: 255 if v in {q[1] for q in eyes} else 0)
    im.paste(Image.new('RGB', im.size, (255, 255, 255)), (0, 0), keep)
    im.save(out)
    mid = lambda bb: ((bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2)
    pts = sorted(mid(q[2]) for q in eyes)
    fw, fh = x1 - x0, y1 - y0
    fr = [((x - x0) / fw, (y - y0) / fh) for x, y in pts]
    gap = (pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]) if len(pts) == 2 else (0, 0)
    print(f'{src}: {len(comps)} dark patches; eyes at ' + ' '.join(f'[{a:.3f}, {b:.3f}]' for a, b in fr) + f'; gap {gap[0]:.0f},{gap[1]:.0f} px; box {fw}x{fh}')


args = sys.argv[1:]
for i in range(0, len(args), 2):
    holes(args[i], args[i + 1])
