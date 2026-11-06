"""Tint the cup's white (closed in by the outline) a step under the tracer's near-white, so `holes` cuts only
the true gaps (the handle's eye, between the limbs). Every enclosed white patch over 300 px² is tinted, except
those whose bbox centre falls in one of that drawing's keep boxes (fractions of the figure's box).

python3 -I tint.py SRC_DIR OUT_DIR DBG_DIR KEEP.json
"""
import json
import os
import sys
from collections import deque
from PIL import Image, ImageDraw

src_dir, out_dir, dbg_dir, keep_path = sys.argv[1:5]
table = json.load(open(keep_path))


def tint(name, keeps):
    im = Image.open(os.path.join(src_dir, name + '.png')).convert('RGB')
    W, H = im.size
    px = im.load()
    white = bytearray(W * H)
    for y in range(H):
        for x in range(W):
            if min(px[x, y]) >= 228:
                white[y * W + x] = 1
    lab = [0] * (W * H)
    comps = []
    n = 0
    for start in range(W * H):
        if white[start] and not lab[start]:
            n += 1
            lab[start] = n
            q = deque([start])
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
            comps.append((cells, border))
    fx0, fy0, fx1, fy1 = W, H, 0, 0
    for i in range(W * H):
        if not white[i]:
            x, y = i % W, i // W
            fx0, fy0, fx1, fy1 = min(fx0, x), min(fy0, y), max(fx1, x), max(fy1, y)
    fw, fh = fx1 - fx0 + 1, fy1 - fy0 + 1
    out = im.copy()
    op = out.load()
    dimg = im.copy()
    d = ImageDraw.Draw(dimg)
    for cells, border in comps:
        if border or len(cells) < 300:
            continue
        xs = [i % W for i in cells]
        ys = [i // W for i in cells]
        cx = ((min(xs) + max(xs)) / 2 - fx0) / fw
        cy = ((min(ys) + max(ys)) / 2 - fy0) / fh
        kept = any(k[0] <= cx <= k[2] and k[1] <= cy <= k[3] for k in keeps)
        print(f'  {name} {len(cells):6d} at {cx:.2f},{cy:.2f} {"keep" if kept else "tint"}')
        if not kept:
            for i in cells:
                op[i % W, i // W] = (238, 236, 226)
        d.rectangle((min(xs), min(ys), max(xs), max(ys)), outline=(200, 0, 200) if kept else (0, 160, 0), width=3)
        d.text((min(xs) + 4, min(ys) + 4), f'{cx:.2f},{cy:.2f}', fill=(0, 0, 255))
    # a kept patch is shown magenta; tinted ones are filled grey in the debug view
    for cells, border in comps:
        pass
    dv = out.copy()
    dvp = dv.load()
    for y in range(H):
        for x in range(W):
            if op[x, y] == (238, 236, 226):
                dvp[x, y] = (150, 200, 150)
    dv = Image.blend(dv, dimg, 0.5)
    out.save(os.path.join(out_dir, name + '.png'))
    dv.save(os.path.join(dbg_dir, name + '.png'))


for name, keeps in table.items():
    tint(name, keeps)
    print(name)
