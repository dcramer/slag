"""The wall line a wall-slide drawing comes with, whitened before the sheet is cut: wall.py SHEET OUT [--x X].

The image model draws the wall the figure slides on as a thin dark column, and traced it becomes part of the
figure (four kinds wrote this by hand: the slime, the bomber, Junior, the worm). Without `--x` the line is the
thin dark column running most of the sheet's height. In each row its dark run goes white where background lies
beside it, above and below the figure and where the body bulges away from the wall; where the body's own outline
runs into it, it stays, and the body ends flat against the wall. The body's side is the one with more ink beside
the line.
"""
import sys

from PIL import Image

args = sys.argv[1:]
X = None
if '--x' in args:
    i = args.index('--x')
    X = int(args[i + 1])
    del args[i : i + 2]
src, out = args
im = Image.open(src).convert('RGB')
w, h = im.size
px = im.load()


def dark(p):
    return max(p) < 150


def light(p):
    return min(p) >= 228


def find():
    """The column darkest over the most rows, where the dark run there is thin (a line, not a body)."""
    best, at = 0, None
    for x in range(w):
        n = 0
        for y in range(h):
            if dark(px[x, y]) and not (x > 6 and x < w - 7 and dark(px[x - 6, y]) and dark(px[x + 6, y])):
                n += 1
        if n > best:
            best, at = n, x
    return at if best >= h * 0.4 else None


def whiten(X):
    # The body's side of the wall: the side with more ink near it. Only that side decides; the far side is always background.
    near = lambda lo, hi: sum(1 for y in range(h) for x in range(max(0, lo), min(w, hi)) if dark(px[x, y]))
    body = 1 if near(X + 3, X + 40) >= near(X - 40, X - 2) else -1
    for y in range(h):
        if not dark(px[X, y]):
            continue
        a = X
        while a > 0 and dark(px[a - 1, y]):
            a -= 1
        b = X
        while b < w - 1 and dark(px[b + 1, y]):
            b += 1
        if b - a > 12:
            continue
        at = lambda i: px[i, y] if 0 <= i < w else (255, 255, 255)
        n1, n2 = (at(b + 1), at(b + 2)) if body > 0 else (at(a - 1), at(a - 2))
        if light(n1) or (not dark(n1) and light(n2)):
            for i in range(a - 1, b + 2):
                if 0 <= i < w:
                    px[i, y] = (255, 255, 255)


# A wall is often drawn as two or three parallel lines: take them one at a time until none is left.
if X is not None:
    whiten(X)
    print(f'wall line at x={X}')
else:
    for _ in range(4):
        X = find()
        if X is None:
            break
        whiten(X)
        print(f'wall line at x={X}')
    else:
        sys.exit('more than four wall lines; pass --x')
im.save(out)
