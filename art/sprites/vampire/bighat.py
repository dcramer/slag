"""bighat.py SRC OUT [SX SY]: the drawing with her hat drawn bigger about its own centre.

The hat is its cream, the dark band and the ink round them: every cream pixel, and every dark pixel within reach of
one (so the brim's outline and the band come with it, the hair under the brim mostly not). It is lifted out, the
hole painted white, and pasted back scaled, behind the claws (a nail-coloured pixel keeps its place)."""
import sys
from PIL import Image, ImageChops, ImageFilter

src, out = sys.argv[1], sys.argv[2]
SX = float(sys.argv[3]) if len(sys.argv) > 3 else 1.3
SY = float(sys.argv[4]) if len(sys.argv) > 4 else 1.15
REACH = 17
AX = float(sys.argv[5]) if len(sys.argv) > 5 else -1
DX = float(sys.argv[6]) if len(sys.argv) > 6 else 0

im = Image.open(src).convert('RGB')
W, H = im.size
px = im.load()


def cream(c):
    r, g, b = c
    return 200 <= r <= 245 and 190 <= g <= 236 and 165 <= b <= 222 and r - b >= 14 and r - g <= 18


def nail(c):
    r, g, b = c
    return b >= r and b - g >= 8 and r >= 100


def dark(c):
    return max(c) < 150


cm = Image.new('L', im.size, 0)
cp = cm.load()
for y in range(H):
    for x in range(W):
        if cream(px[x, y]):
            cp[x, y] = 255
# Drop specks of cream (a pearl's shade): keep only what a 5 px opening leaves, then grow it back.
cm = cm.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(5))
near = cm.filter(ImageFilter.MaxFilter(2 * REACH + 1)).load()
cp = cm.load()
mask = Image.new('L', im.size, 0)
mp = mask.load()
xs, ys, n = 0, 0, 0
for y in range(H):
    for x in range(W):
        c = px[x, y]
        if cp[x, y] or (near[x, y] and (dark(c) or (min(c) < 250 and not nail(c) and max(c) - min(c) < 28 and min(c) > 150))):
            mp[x, y] = 255
        if cp[x, y]:
            xs += x
            ys += y
            n += 1
cx, cy = xs / n, ys / n
if AX >= 0:
    bx0, _, bx1, _ = cm.getbbox()
    cx = bx0 + AX * (bx1 - bx0)
# Smooth the mask's edge a little so the antialiased rim comes too.
mask = mask.filter(ImageFilter.MaxFilter(3))
hat = im.copy()
hat.putalpha(mask)
# Behind the claws.
keep = Image.new('L', im.size, 0)
kp = keep.load()
for y in range(H):
    for x in range(W):
        if nail(px[x, y]):
            kp[x, y] = 255
keep = keep.filter(ImageFilter.MaxFilter(13))
# Lift it out, leaving the claws.
white = Image.new('RGB', im.size, 'white')
base = Image.composite(white, im, ImageChops.subtract(mask, keep))
# Scale about the cream's centre.
big = hat.transform(im.size, Image.AFFINE, (1 / SX, 0, cx - (cx + DX) / SX, 0, 1 / SY, cy - cy / SY), resample=Image.BICUBIC)
a = ImageChops.subtract(big.getchannel('A'), keep)
base.paste(big.convert('RGB'), (0, 0), a)
# Drop the specks left of the old brim's tips: any piece of figure under SPECK px, flooded from each.
SPECK = 600
bp = base.load()
seen = bytearray(W * H)
for y0 in range(H):
    for x0 in range(W):
        i0 = y0 * W + x0
        if seen[i0] or min(bp[x0, y0]) >= 228:
            continue
        stack, comp = [(x0, y0)], []
        seen[i0] = 1
        while stack:
            x, y = stack.pop()
            comp.append((x, y))
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < W and 0 <= ny < H and not seen[ny * W + nx] and min(bp[nx, ny]) < 228:
                    seen[ny * W + nx] = 1
                    stack.append((nx, ny))
        if len(comp) <= SPECK:
            for x, y in comp:
                bp[x, y] = (255, 255, 255)
base.save(out)
print(out, round(cx), round(cy))
