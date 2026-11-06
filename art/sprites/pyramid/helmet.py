"""Every drawing's helmet made bigger: the rust wedge and its outline scaled up about where it meets the body.

python3 -I art/sprites/pyramid/helmet.py SCALE drawn/ flat/ idle idle2 walk-1 ...   (`idle` is drawn/design.png, written to design.png)

The image model drew the cowl about head-sized, and at play scale two blind rounds read it as a hat or a hood ("Black
Mage: a tall pointed wizard hat and a robe"; "a hooded figure with a long nose or beak"): the read needs a triangle
that is most of him. The helmet is the rust (and the ink within reach of it, its outline and rivets), found by colour;
it is scaled about its pixel nearest the body's middle, so it grows up and out from his shoulders and the bigger one
covers the old, and pasted over the drawing.
"""
import sys
from collections import deque
from PIL import Image, ImageFilter

K = float(sys.argv[1])
SRC, OUT = sys.argv[2], sys.argv[3]
NAMES = sys.argv[4:]


def is_rust(p):
    r, g, b = p
    return r > 60 and r - b > 45 and r - g > 30 and g < 140


def is_ink(p):
    return max(p) < 90


def helmet(im):
    w, h = im.size
    px = im.load()
    rust = Image.new('L', (w, h), 0)
    rp = rust.load()
    for y in range(h):
        for x in range(w):
            if is_rust(px[x, y]):
                rp[x, y] = 255
    # The biggest patch of rust is the cowl (the pig's pink and the boots' brown are not rust).
    seen = bytearray(w * h)
    best = []
    for y0 in range(h):
        for x0 in range(w):
            if rp[x0, y0] and not seen[y0 * w + x0]:
                comp = []
                q = deque([(x0, y0)])
                seen[y0 * w + x0] = 1
                while q:
                    x, y = q.popleft()
                    comp.append((x, y))
                    for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                        if 0 <= nx < w and 0 <= ny < h and rp[nx, ny] and not seen[ny * w + nx]:
                            seen[ny * w + nx] = 1
                            q.append((nx, ny))
                if len(comp) > len(best):
                    best = comp
    core = Image.new('L', (w, h), 0)
    cp = core.load()
    for x, y in best:
        cp[x, y] = 255
    # Close the rivets and blotches inside it, then take the ink round it: its outline.
    core = core.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.MinFilter(9))
    reach = core.filter(ImageFilter.MaxFilter(15))
    rp2 = reach.load()
    cp = core.load()
    mask = Image.new('L', (w, h), 0)
    mp = mask.load()
    for y in range(h):
        for x in range(w):
            if cp[x, y] or (rp2[x, y] and (is_ink(px[x, y]) or is_rust(px[x, y]))):
                mp[x, y] = 255
    return mask


for name in NAMES:
    src = f'{SRC}/design.png' if name == 'idle' else f'{SRC}/{name}.png'
    out = f'{OUT}/../design.png' if name == 'idle' else f'{OUT}/{name}.png'
    im = Image.open(src).convert('RGB')
    w, h = im.size
    px = im.load()
    mask = helmet(im)
    mp = mask.load()
    hx = [(x, y) for y in range(h) for x in range(w) if mp[x, y]]
    body = [(x, y) for y in range(0, h, 2) for x in range(0, w, 2) if min(px[x, y]) < 228 and not mp[x, y]]
    bx = sum(p[0] for p in body) / len(body)
    by = sum(p[1] for p in body) / len(body)
    ax, ay = min(hx, key=lambda p: (p[0] - bx) ** 2 + (p[1] - by) ** 2)
    bb = mask.getbbox()
    piece = im.crop(bb)
    pm = mask.crop(bb)
    nw, nh = round(piece.size[0] * K), round(piece.size[1] * K)
    piece = piece.resize((nw, nh), Image.LANCZOS)
    pm = pm.resize((nw, nh), Image.LANCZOS).point(lambda v: 255 if v > 128 else 0)
    # Where the anchor lands stays put.
    ox = round(ax - (ax - bb[0]) * K)
    oy = round(ay - (ay - bb[1]) * K)
    # Room for the bigger helmet: pad the canvas white if it reaches past the edge.
    left, top = max(0, -ox), max(0, -oy)
    right, bottom = max(0, ox + nw - w), max(0, oy + nh - h)
    canvas = Image.new('RGB', (w + left + right, h + top + bottom), 'white')
    canvas.paste(im, (left, top))
    canvas.paste(piece, (ox + left, oy + top), pm)
    canvas.save(out)
    print(name, 'anchor', ax, ay, 'grew', bb, '->', (ox, oy, ox + nw, oy + nh), 'pad', (left, top, right, bottom))
