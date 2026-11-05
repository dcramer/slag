"""cut.py SHEET N SCALE OUT1 [OUT2 ...]: cuts N figures drawn side by side apart, each scaled by SCALE (the
design's height over a standing figure's, so its ink is as thick as the design's) onto its own white square (OUT
'skip' drops one). After art/sprites/robot/cut.py. Between two figures it cuts along a seam from top to bottom that
runs through white where it can and through ink where they touch (a barrel's tip against the next one's ear disc),
never through a coloured fill."""
import sys
from PIL import Image, ImageFilter

src, n, scale, outs = sys.argv[1], int(sys.argv[2]), float(sys.argv[3]), sys.argv[4:]
im = Image.open(src).convert('RGB')
W, H = im.size
px = im.load()


def cost(x, y):
    p = px[x, y]
    s = sum(p)
    if s >= 700:
        return 0
    if s < 260:
        return 1
    return 60


def seam(c, w):
    """The cheapest top-to-bottom path in columns c-w..c+w, moving at most one column a row."""
    lo, hi = max(1, c - w), min(W - 2, c + w)
    xs = range(lo, hi + 1)
    acc = {x: cost(x, 0) + abs(x - c) * 0.001 for x in xs}
    back = []
    for y in range(1, H):
        nxt, b = {}, {}
        for x in xs:
            best = min((acc[x2], x2) for x2 in (x - 1, x, x + 1) if lo <= x2 <= hi)
            nxt[x] = best[0] + cost(x, y)
            b[x] = best[1]
        back.append(b)
        acc = nxt
    x = min(xs, key=lambda x: acc[x])
    path = [x]
    for b in reversed(back):
        x = b[x]
        path.append(x)
    return path[::-1]


seams = [[0] * H] + [seam(i * W // n, W // 9) for i in range(1, n)] + [[W] * H]
for i, out in enumerate(outs):
    if out == 'skip':
        continue
    part = Image.new('RGB', (W, H), 'white')
    pp = part.load()
    for y in range(H):
        for x in range(seams[i][y], seams[i + 1][y]):
            pp[x, y] = px[x, y]
    # The box of the figure, not of the antialiased specks the seam leaves beside it.
    mask = part.convert('L').point(lambda v: 255 if v < 235 else 0).filter(ImageFilter.MinFilter(5))
    x0, y0, x1, y1 = mask.getbbox()
    x0, y0, x1, y1 = max(0, x0 - 3), max(0, y0 - 3), min(W, x1 + 3), min(H, y1 + 3)
    fig = part.crop((x0, y0, x1, y1))
    fig = fig.resize((round(fig.width * scale), round(fig.height * scale)), Image.LANCZOS)
    side = int(max(fig.width, fig.height) * 1.25)
    sq = Image.new('RGB', (side, side), 'white')
    sq.paste(fig, ((side - fig.width) // 2, (side - fig.height) // 2))
    sq.save(out)
    print(out.split('/')[-1], fig.size, side)
