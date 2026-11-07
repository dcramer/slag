"""Makes the skull bigger about its chin, in a drawing already through sockets.py: everything above the chin, the
skull, the loop and the hood's top behind it, scaled up and laid over the drawing by its own outline. Drawn as the
model draws it the skull was narrower than the hoodie, and at play scale two readers saw a ghost's head on a body.

    python3 -I art/sprites/skeleton/head.py K IMG.png...   (each painted in place; K the scale)

The chin is found from the teeth (sockets.py's placeholder colour): a little under the grin's lowest row, about the
grin's middle. A drawing with no teeth found (the lying death) is left alone.
"""

import sys

from PIL import Image, ImageChops

TEETH = (255, 0, 255)


def figure(im):
    r, g, b = im.split()
    least = ImageChops.darker(ImageChops.darker(r, g), b)
    return least.point(lambda v: 255 if v < 236 else 0)


def scale(src, k):
    im = Image.open(src).convert('RGB')
    w, h = im.size
    px = im.load()
    teeth = [(x, y) for y in range(h) for x in range(w) if px[x, y] == TEETH]
    if not teeth:
        print(src, 'no teeth: left alone')
        return
    ty1 = max(y for _, y in teeth)
    ty0 = min(y for _, y in teeth)
    cx = (min(x for x, _ in teeth) + max(x for x, _ in teeth)) / 2
    chin = round(ty1 + (ty1 - ty0) * 0.6)
    top = im.crop((0, 0, w, chin))
    mask = figure(top)
    big = top.resize((round(w * k), round(chin * k)), Image.NEAREST)
    bmask = mask.resize(big.size, Image.NEAREST)
    ox = round(cx - cx * k)
    oy = chin - big.size[1]
    pad = max(0, 6 - oy)
    if pad:
        grown = Image.new('RGB', (w, h + pad), (255, 255, 255))
        grown.paste(im, (0, pad))
        im, oy, chin = grown, oy + pad, chin + pad
    # What was above the chin goes, so none of the small skull shows round the big one.
    im.paste((255, 255, 255), (0, 0, w, chin), figure(im.crop((0, 0, w, chin))))
    im.paste(big, (ox, oy), bmask)
    im.save(src)
    print(src, 'head', k, 'chin', chin)


if __name__ == '__main__':
    k = float(sys.argv[1])
    for f in sys.argv[2:]:
        scale(f, k)
