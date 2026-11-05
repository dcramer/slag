"""Tints the white hair a step off white, so `holes` cuts the gaps the figure closes in and never his hair.

Args: drawing.png [...] (each rewritten in place). The image model draws the hair about (242, 242, 240) and the
background pure white, so every near-white patch the figure closes in (not flooded from the border) whose mean
is under 250 is hair: it is painted 20 a channel darker, its shades with it, under the hole test's
228 (the hair's families include the tinted colours), while the gaps (between an arm and
the coat, under a hilt) average 254 and stay white, to be cut through.
Unpainted, design.png is drafts/straight-1.png; the poses are cut from sheets/ by `build.ts cut slayer … --design`
(design.prompt.txt). Run it once on a fresh cut.
"""
import sys
from collections import deque
from PIL import Image

DROP = 20
# The hair's patches are 200 image px and up; the bottle cap's wolf and the broken spoke, white too, are under 150.
MIN = 150

for path in sys.argv[1:]:
    im = Image.open(path).convert('RGB')
    w, h = im.size
    px = im.load()
    white = lambda x, y: min(px[x, y]) >= 228
    seen = bytearray(w * h)
    q = deque()
    for x in range(w):
        q.extend([(x, 0), (x, h - 1)])
    for y in range(h):
        q.extend([(0, y), (w - 1, y)])
    while q:
        x, y = q.popleft()
        i = y * w + x
        if seen[i] or not white(x, y):
            continue
        seen[i] = 1
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx]:
                q.append((nx, ny))
    n = 0
    tinted = []
    for y0 in range(h):
        for x0 in range(w):
            i0 = y0 * w + x0
            if seen[i0] or not white(x0, y0):
                continue
            patch = []
            q.append((x0, y0))
            seen[i0] = 1
            while q:
                x, y = q.popleft()
                patch.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    j = ny * w + nx
                    if 0 <= nx < w and 0 <= ny < h and not seen[j] and white(nx, ny):
                        seen[j] = 1
                        q.append((nx, ny))
            mean = sum(sum(px[x, y]) for x, y in patch) / (3 * len(patch))
            if mean < 250 and len(patch) >= MIN:
                for x, y in patch:
                    r, g, b = px[x, y]
                    px[x, y] = (r - DROP, g - DROP, b - DROP)
                tinted += patch
                n += 1
    # The hair's cel shade is the steel's blue-grey in the drawing, so it traced as steel: every neutral grey joined
    # to the tinted hair without crossing ink is painted the hair's tint. The steel and the bottle cap are inked off.
    # Run it once on a fresh cut: a second run takes the first's tint for drawn hair.
    grey = lambda p: min(p) >= 140 and max(p) - min(p) <= 18 and min(p) < 200
    seen = bytearray(w * h)
    q.extend(tinted)
    for x, y in q:
        seen[y * w + x] = 1
    shade = 0
    while q:
        x, y = q.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            j = ny * w + nx
            if 0 <= nx < w and 0 <= ny < h and not seen[j] and grey(px[nx, ny]):
                seen[j] = 1
                px[nx, ny] = (222, 222, 221)
                shade += 1
                q.append((nx, ny))
    im.save(path)
    print(path, n, 'patches tinted,', shade, 'shade px')
