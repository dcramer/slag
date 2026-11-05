"""Readies a worm drawing for the build, in place: `python3 -I prep.py drawing.png…` (after `build.ts cut`).

1. The cord. The hair dryer's cord trails off the figure along the floor as a thin ink line. Kept, the tracer made
   it a long dark loop on the floor that read as a tail and spread the figure past the cast's box; drawn as line,
   it took every outline with it. So the figure is opened with a disc wider than the cord (erode, then dilate), its
   biggest piece kept, and only what lies within a few px of that piece is left: the cord goes, a short stub at
   the handle stays, and every edge of the figure comes back as drawn.
2. The whites. Everything white the figure closes in is the background to rolemap.py's `holes`, so the eyes'
   whites and the teeth would be cut through the frame like the gap between an arm and the body. Each closed-in
   white patch high on the figure (the head) is repainted the eye white `EYE`, under rolemap's 228; the white gaps
   lower down are left to be holes.

The figure is everything the near-white background (flooded from the border, rolemap.py's test) doesn't reach.
"""
import sys
from collections import deque
from PIL import Image, ImageFilter

OPEN = 25  # px: wider than the cord (about 10 at the design's size), narrower than an arm
KEEP = 14  # px: how far past the opened figure the drawing is kept
EYE = (220, 222, 240)
HEAD = 0.36  # the top of the figure, as a fraction of its height, where a closed-in white is an eye or a tooth


def flood(w, h, ok, seeds):
    seen = bytearray(w * h)
    q = deque(seeds)
    out = []
    while q:
        x, y = q.popleft()
        i = y * w + x
        if seen[i] or not ok(x, y):
            continue
        seen[i] = 1
        out.append((x, y))
        if x > 0: q.append((x - 1, y))
        if x < w - 1: q.append((x + 1, y))
        if y > 0: q.append((x, y - 1))
        if y < h - 1: q.append((x, y + 1))
    return seen, out


def background(im):
    w, h = im.size
    px = im.load()
    border = [(x, 0) for x in range(w)] + [(x, h - 1) for x in range(w)] + [(0, y) for y in range(h)] + [(w - 1, y) for y in range(h)]
    return flood(w, h, lambda x, y: min(px[x, y]) >= 228, border)[0]


def components(w, h, on):
    seen = bytearray(w * h)
    for sy in range(h):
        for sx in range(w):
            if not on(sx, sy) or seen[sy * w + sx]:
                continue
            comp = []
            q = deque([(sx, sy)])
            seen[sy * w + sx] = 1
            while q:
                x, y = q.popleft()
                comp.append((x, y))
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if 0 <= nx < w and 0 <= ny < h and on(nx, ny) and not seen[ny * w + nx]:
                        seen[ny * w + nx] = 1
                        q.append((nx, ny))
            yield comp


def decord(im):
    w, h = im.size
    bg = background(im)
    fig = Image.new('L', im.size, 0)
    fig.putdata([0 if b else 255 for b in bg])
    opened = fig.filter(ImageFilter.MinFilter(OPEN)).filter(ImageFilter.MaxFilter(OPEN))
    o = opened.load()
    best = max(components(w, h, lambda x, y: o[x, y] > 0), key=len, default=[])
    body = Image.new('L', im.size, 0)
    b = body.load()
    for x, y in best:
        b[x, y] = 255
    keep = body.filter(ImageFilter.MaxFilter(2 * KEEP + 1)).load()
    px = im.load()
    gone = 0
    for y in range(h):
        for x in range(w):
            if not bg[y * w + x] and not keep[x, y]:
                px[x, y] = (255, 255, 255)
                gone += 1
    return gone


def whites(im):
    w, h = im.size
    px = im.load()
    bg = background(im)
    rows = [y for y in range(h) if any(not bg[y * w + x] for x in range(w))]
    top, bottom = rows[0], rows[-1]
    head = top + HEAD * (bottom - top)
    eyes = 0
    for comp in components(w, h, lambda x, y: not bg[y * w + x] and min(px[x, y]) >= 228):
        if sum(y for _, y in comp) / len(comp) >= head:
            continue
        for x, y in comp:
            px[x, y] = EYE
        eyes += 1
    return eyes


for path in sys.argv[1:]:
    im = Image.open(path).convert('RGB')
    gone = decord(im)
    eyes = whites(im)
    im.save(path)
    print(path, 'cord px', gone, 'eye whites', eyes)
