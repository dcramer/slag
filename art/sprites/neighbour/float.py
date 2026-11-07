"""The sim's drawings with her diamond hung clear: float.py [NAME…], reading `floats.txt` beside it.

The green diamond floating over her head is the read, and only while background shows under it. The image model
draws it a few px above the hair, which the cast's pen closes at play size, and a little different in every pose
(and the sheet cutter drops it as a stray when it floats too far). So each drawing's own diamond (every patch apart
from her that is mostly green) is painted out, and one diamond, drawn once (`gem.py` → `diamond.png`), is hung back
over her head: its lowest point `gap` image px above the highest point of her under it, centred on her hair's crown
plus `dx`, tipped `tilt` degrees (the twist: it hangs crooked), `scale` times its size. The same diamond in every
pose and never closer than the gap, so it bobs only where the pose puts it.

`floats.txt` has one line a drawing: `NAME gap tilt dx`, after a `scale K` line. `drawn/NAME.png` (the drawing as
cut) becomes `flat/NAME.png`, and `drawn/design.png` becomes `design.png`. With NAMEs, only those.
"""
import sys
from collections import deque
from pathlib import Path
from PIL import Image, ImageChops

HERE = Path(__file__).resolve().parent
WHITE = 228


def green(p):
    r, g, b = p
    return g > r + 35 and g > b + 25


def dark(p):
    return max(p) < 80


def float_one(src, out, gap, tilt, dx, scale):
    im = Image.open(src).convert('RGB')
    W, H = im.size
    px = im.load()
    # The background: what's lighter than WHITE, flooded in from the border, painted white so the faint rim of a
    # diamond painted out leaves no ghost.
    bg = bytearray(W * H)
    q = deque([(x, 0) for x in range(W)] + [(x, H - 1) for x in range(W)] + [(0, y) for y in range(H)] + [(W - 1, y) for y in range(H)])
    while q:
        x, y = q.popleft()
        i = y * W + x
        if bg[i] or min(px[x, y]) < WHITE:
            continue
        bg[i] = 1
        px[x, y] = (255, 255, 255)
        if x > 0: q.append((x - 1, y))
        if x < W - 1: q.append((x + 1, y))
        if y > 0: q.append((x, y - 1))
        if y < H - 1: q.append((x, y + 1))
    # The figure's patches, 8-connected.
    label = [0] * (W * H)
    comps = []
    for i0 in range(W * H):
        if bg[i0] or label[i0]:
            continue
        label[i0] = len(comps) + 1
        patch = [i0]
        for i in patch:
            x, y = i % W, i // W
            for ddy in (-1, 0, 1):
                for ddx in (-1, 0, 1):
                    xx, yy = x + ddx, y + ddy
                    if 0 <= xx < W and 0 <= yy < H:
                        j = yy * W + xx
                        if not bg[j] and not label[j]:
                            label[j] = label[i0]
                            patch.append(j)
        comps.append(patch)
    body = max(comps, key=len)
    joined = sum(green(px[i % W, i // W]) for i in body)
    if joined > 200:
        sys.exit(f'{src}: {joined} green px in her own outline: the drawing joined the diamond to her; paint it apart first')
    # Paint out the drawing's diamond, and every speck too small to be anything but its crumbs.
    for c in comps:
        if c is not body and (len(c) < 40 or sum(green(px[i % W, i // W]) for i in c) > 0.25 * len(c)):
            for i in c:
                px[i % W, i // W] = (255, 255, 255)
    # Her hair's crown: the topmost dark pixels of her, and where across they are.
    hair = [i for i in body if dark(px[i % W, i // W])]
    top = min(i // W for i in hair)
    crown = [i % W for i in hair if i // W < top + 40]
    cx = (min(crown) + max(crown)) / 2 + dx
    d = Image.open(HERE / 'diamond.png').convert('RGB')
    d = d.resize((round(d.size[0] * scale), round(d.size[1] * scale)), Image.LANCZOS)
    d = d.rotate(tilt, resample=Image.BICUBIC, expand=True, fillcolor=(255, 255, 255))
    dp = d.load()
    dw, dh = d.size
    low = max(y for y in range(dh) for x in range(dw) if min(dp[x, y]) < WHITE)
    x0 = round(cx - dw / 2)
    # The gap is from the highest point of her under the diamond, a raised hand included.
    under = [i // W for i in body if x0 <= i % W < x0 + dw]
    y0 = round(min(under) - gap - low)
    # Room above and to the sides, so the diamond never leaves the picture.
    pt, pl, pr = max(0, 8 - y0), max(0, 8 - x0), max(0, x0 + dw + 8 - W)
    if pt or pl or pr:
        big = Image.new('RGB', (W + pl + pr, H + pt), 'white')
        big.paste(im, (pl, pt))
        im = big
        x0 += pl
        y0 += pt
    patch = im.crop((x0, y0, x0 + dw, y0 + dh))
    im.paste(ImageChops.darker(patch, d), (x0, y0))
    im.save(out)
    print(f'{out}: diamond bottom {y0 + low}, {gap:.0f} px over her, tilt {tilt:.0f}, dx {dx:.0f}')


only = set(sys.argv[1:])
scale = 1.0
for line in (HERE / 'floats.txt').read_text().splitlines():
    f = line.split('#')[0].split()
    if not f:
        continue
    if f[0] == 'scale':
        scale = float(f[1])
        continue
    name, gap, tilt, dx = f[0], *map(float, f[1:4])
    if only and name not in only:
        continue
    out = HERE / 'design.png' if name == 'design' else HERE / 'flat' / f'{name}.png'
    float_one(HERE / 'drawn' / f'{name}.png', out, gap, tilt, dx, scale)
