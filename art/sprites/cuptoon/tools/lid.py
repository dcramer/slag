"""Paint the takeaway cup's lid a plastic grey in every drawing, so it is a shape of its own at play scale and
not white rings on the white cup. The lid is every white patch closed in by the outline above the cup's front
(the biggest patch), wider than the straw, and the greys of its cel shade there; on the lying death, left of it.

python3 -I lid.py RAW_DIR TINTED_DIR OUT_DIR DBG_DIR name[:left] ...
"""
import os
import sys
from collections import deque
from PIL import Image

raw_dir, tin_dir, out_dir, dbg_dir = sys.argv[1:5]
LID = (86, 84, 92)


def comps_of(im, light=False):
    W, H = im.size
    px = im.load()
    white = bytearray(W * H)
    for y in range(H):
        for x in range(W):
            p = px[x, y]
            if (min(p) >= 215 and max(p) - min(p) <= 30) if light else min(p) >= 228:
                white[y * W + x] = 1
    lab = [0] * (W * H)
    out = []
    n = 0
    for s in range(W * H):
        if white[s] and not lab[s]:
            n += 1
            lab[s] = n
            q = deque([s])
            cells = []
            border = False
            while q:
                i = q.popleft()
                cells.append(i)
                x, y = i % W, i // W
                if x == 0 or y == 0 or x == W - 1 or y == H - 1:
                    border = True
                for j in (i + 1 if x < W - 1 else -1, i - 1 if x > 0 else -1, i + W if y < H - 1 else -1, i - W if y > 0 else -1):
                    if j >= 0 and white[j] and not lab[j]:
                        lab[j] = n
                        q.append(j)
            if not border:
                xs = [c % W for c in cells]
                ys = [c // W for c in cells]
                out.append((cells, min(xs), min(ys), max(xs), max(ys)))
    return out


for arg in sys.argv[5:]:
    name, _, mode = arg.partition(':')
    raw = Image.open(os.path.join(raw_dir, name + '.png')).convert('RGB')
    im = Image.open(os.path.join(tin_dir, name + '.png')).convert('RGB')
    W, H = im.size
    px = im.load()
    comps = comps_of(raw)
    cup = max(comps_of(raw, True), key=lambda c: len(c[0]))
    _, cx0, cy0, cx1, cy1 = cup
    cw = cx1 - cx0
    lid = []
    for c in comps:
        cells, x0, y0, x1, y1 = c
        if c is cup or len(cells) < 1200:
            continue
        if mode == 'left':
            ok = x1 <= cx0 + 0.06 * cw and y0 >= cy0 - 0.4 * (cy1 - cy0) and y1 <= cy1 + 0.4 * (cy1 - cy0)
            ok = ok and (y1 - y0) > 0.25 * (cy1 - cy0)
        else:
            ok = y1 <= cy0 + 0.15 * (cy1 - cy0) and x0 >= cx0 - 0.3 * cw and x1 <= cx1 + 0.3 * cw and (x1 - x0) > 0.25 * cw
        if ok:
            lid.append(c)
    if not lid:
        print(name, 'no lid found')
        continue
    lx0 = min(c[1] for c in lid)
    ly0 = min(c[2] for c in lid)
    lx1 = max(c[3] for c in lid)
    ly1 = max(c[4] for c in lid)
    for c in lid:
        for i in c[0]:
            px[i % W, i // W] = LID
    # the lid's cel shade: the neutral greys inside the lid's box, outside the cup's front
    n = 0
    for y in range(ly0, ly1 + 1):
        for x in range(lx0, lx1 + 1):
            r, g, b = px[x, y]
            if (r, g, b) == LID:
                continue
            inside_cup = cx0 <= x <= cx1 and cy0 <= y <= cy1 and (mode != 'left' and y >= cy0 + 4 or mode == 'left' and x >= cx0 + 4)
            if not inside_cup and 140 <= min(r, g, b) < 228 and max(r, g, b) - min(r, g, b) < 18:
                px[x, y] = LID
                n += 1
    im.save(os.path.join(out_dir, name + '.png'))
    im.crop((lx0 - 60, ly0 - 60, lx1 + 60, ly1 + 160)).save(os.path.join(dbg_dir, 'lid-' + name + '.png'))
    print(name, len(lid), 'patches', n, 'shade px')
