"""Rounds the skull's crown, in a drawing already through sockets.py, and drops the hanging loop the model drew on it.

    python3 -I art/sprites/skeleton/dome.py IMG.png...   (each painted in place)

The model draws the loop on a cone that rises out of the crown, and at play scale three rounds of blind readers saw
the skull as a ghost's head and an onion (round 3: "Siegward, the onion knight ... onion-shaped helmet"). So the
crown above the sockets is redrawn as the top of an ellipse as wide as the skull there, inked, with the moulding
seam over it. `RING` puts the loop back as a ring on a short neck: read that way too, it was "a white round head with
an antenna", so it's off.
"""

import os
import sys

from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sockets import dark, find  # noqa: E402

INK = (24, 12, 24)
BONE = (232, 226, 206)
# The ring on the crown, drawn or not.
RING = False


def edge(px, W, x, y, step):
    """From inside the skull at (x, y), out to its outline: the last pixel before the background."""
    while 0 < x < W - 1 and min(px[x, y]) < 236:
        x += step
    return x


def dome(src):
    im = Image.open(src).convert('RGB')
    W, H = im.size
    px = im.load()
    sockets = find(px, W, H)
    if len(sockets) < 2:
        print(src, 'no sockets: left alone')
        return
    (_, ax0, ay0, ax1, ay1), (_, bx0, by0, bx1, by1) = sorted(sockets, key=lambda s: s[1])
    if abs(ay0 - by0) > (bx1 - ax0) * 0.6:
        print(src, 'lying: left alone')
        return
    sh = max(ay1 - ay0, by1 - by0)
    yw = round(min(ay0, by0) - sh * 0.15)
    x0 = edge(px, W, ax0 - 3, yw, -1)
    x1 = edge(px, W, bx1 + 3, yw, 1)
    a = (x1 - x0) / 2
    cx = (x0 + x1) / 2
    b = a * 0.95
    t = max(6, round(a * 0.07))
    need = round(a * 0.3 * 2.6 + b + t * 3) - yw
    if RING and need > 0:
        # Room above the drawing for the ring.
        grown = Image.new('RGB', (W, H + need), (255, 255, 255))
        grown.paste(im, (0, need))
        im, yw = grown, yw + need
    d = ImageDraw.Draw(im)
    # Clear above that row over the skull's width, then draw the dome: ink, then bone inside it.
    d.rectangle((x0 - t * 3, 0, x1 + t * 3, yw), fill=(255, 255, 255))
    d.pieslice((cx - a, yw - b - t, cx + a, yw + b + t), 180, 360, fill=INK)
    d.pieslice((cx - a + t, yw - b, cx + a - t, yw + b), 180, 360, fill=BONE)
    # The moulding seam over the crown, from the loop down toward the back.
    d.arc((cx - a * 0.55, yw - b, cx + a * 0.55, yw + b), 200, 270, fill=INK, width=max(3, t // 2))
    if not RING:
        im.save(src)
        print(src, 'dome', round(cx), yw, round(a), 'no ring')
        return
    # The loop: a ring on a short narrow neck above the crown, its eye open, so the outline pinches in under it
    # and the dome stays round (a small ring sat on the crown traced into a point, and the head read as an egg).
    r = a * 0.3
    nw = r * 0.4
    ry = yw - b - t - r * 0.55 - r
    d.rectangle((cx - nw - t, ry, cx + nw + t, yw - b + t), fill=INK)
    d.ellipse((cx - r - t, ry - r - t, cx + r + t, ry + r + t), fill=INK)
    d.rectangle((cx - nw, ry, cx + nw, yw - b + t * 2), fill=BONE)
    d.ellipse((cx - r, ry - r, cx + r, ry + r), fill=BONE)
    e = r * 0.5
    d.ellipse((cx - e - t * 0.5, ry - e - t * 0.5, cx + e + t * 0.5, ry + e + t * 0.5), fill=INK)
    d.ellipse((cx - e, ry - e, cx + e, ry + e), fill=(255, 255, 255))
    im.save(src)
    print(src, 'dome', round(cx), yw, round(a))


if __name__ == '__main__':
    for f in sys.argv[1:]:
        dome(f)
