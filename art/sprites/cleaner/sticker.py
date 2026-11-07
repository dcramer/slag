# The price sticker made one clean white label with three bold bars: traced as drawn, its thin barcode bars and grey
# peeled-up underside ran together into a dark grey blot on the skull, which read as a bruise or a third eye at play
# scale. The head is the biggest patch of skin, and the sticker the biggest hole in it (the eyes and the mouth are
# small ones): everything inside the hole's hull goes white, its grey peeled corner just outside too, and three bars
# are drawn back across it, far enough apart that the tracer keeps the white between them. A sticker drawn over the
# head's own outline (peeling off it, or fallen off on the death) leaves no hole, and the drawing is left as it is.
# The label is a step off white, like the shirt, so the build's `holes` doesn't take it for background and cut it out.
# With `ink`, the drawing's warm brown line (the head's outline, the eyes) is made the ink: cheer2's outline closed into
# one ring of the eyes' role there, which traced as a fill over the whole head and drew it black.
# Usage: python3 -I sticker.py drawn/NAME.png flat/NAME.png [ink]
import sys
from collections import deque
from PIL import Image, ImageDraw, ImageFilter

src, out = sys.argv[1], sys.argv[2]
INK = len(sys.argv) > 3 and sys.argv[3] == 'ink'
im = Image.open(src).convert('RGB')
W, H = im.size
px = im.load()


def finish():
    if INK:
        for y in range(H):
            for x in range(W):
                r, g, b = px[x, y]
                if abs(r - 54) < 22 and abs(g - 41) < 18 and abs(b - 40) < 18:
                    px[x, y] = (16, 14, 26)
    im.save(out)
    sys.exit(0)


def skin(p):
    r, g, b = p
    return r > 195 and 140 < g < 225 and 110 < b < 200 and r - b > 30


def comps(on):
    """The 4-connected components of the pixels `on` marks, biggest first."""
    seen = bytearray(W * H)
    found = []
    for i in range(W * H):
        if seen[i] or not on[i]:
            continue
        comp = []
        q = deque([i])
        seen[i] = 1
        while q:
            j = q.popleft()
            comp.append(j)
            x, y = j % W, j // W
            for k, ok in ((j + 1, x + 1 < W), (j - 1, x > 0), (j + W, y + 1 < H), (j - W, y > 0)):
                if ok and not seen[k] and on[k]:
                    seen[k] = 1
                    q.append(k)
        found.append(comp)
    return sorted(found, key=len, reverse=True)


data = list(im.getdata())
head = bytearray(W * H)
for j in comps([skin(p) for p in data])[0]:
    head[j] = 1
# Everything not head that the border reaches; what's left is a hole in the head.
outside = bytearray(W * H)
q = deque([i for i in range(W)] + [(H - 1) * W + i for i in range(W)] + [y * W for y in range(H)] + [y * W + W - 1 for y in range(H)])
while q:
    j = q.popleft()
    if outside[j] or head[j]:
        continue
    outside[j] = 1
    x, y = j % W, j // W
    for k, ok in ((j + 1, x + 1 < W), (j - 1, x > 0), (j + W, y + 1 < H), (j - W, y > 0)):
        if ok:
            q.append(k)
holes = comps([not outside[i] and not head[i] for i in range(W * H)])
if not holes or len(holes[0]) < 1500:
    print(f'{src}: no sticker found')
    finish()
mask = Image.new('L', (W, H), 0)
mpx = mask.load()
for j in holes[0]:
    mpx[j % W, j // W] = 255
mask = mask.filter(ImageFilter.MaxFilter(3))
mpx = mask.load()
reach = mask.filter(ImageFilter.MaxFilter(31)).load()
# Inside the label's own ink rim, its drawn bars go too.
core = mask.filter(ImageFilter.MinFilter(11)).load()
n = 0
for y in range(H):
    for x in range(W):
        p = px[x, y]
        if skin(p):
            continue
        grey = max(p) - min(p) < 28 and 70 < max(p) < 235
        inside = core[x, y] or (mpx[x, y] and max(p) > 60)
        if inside or (reach[x, y] and grey):
            px[x, y] = (244, 244, 238)
            n += 1
inner = mask.filter(ImageFilter.MinFilter(17))
box = inner.getbbox()
if box:
    bx0, by0, bx1, by1 = box
    bars = Image.new('L', (W, H), 0)
    bd = ImageDraw.Draw(bars)
    bw = bx1 - bx0
    for f in (0.18, 0.44, 0.7):
        bd.rectangle((bx0 + bw * f, by0, bx0 + bw * (f + 0.13), by1), fill=255)
    bpx = bars.load()
    ipx = inner.load()
    for y in range(by0, by1 + 1):
        for x in range(bx0, bx1 + 1):
            if bpx[x, y] and ipx[x, y]:
                px[x, y] = (16, 14, 26)
print(f'{src}: sticker {len(holes[0])} px, {n} px whitened')
finish()
