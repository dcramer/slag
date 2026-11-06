"""Fills a drawing's wide-open eye whites with ink, so the face kit finds two eyes where the drawing drew inked
whites with pinprick pupils (the map took the pupils for line and found no eyes). An eye white is a patch of
near-white wholly inside the face's box X0,Y0,X1,Y1 (drawing pixels), at least MIN pixels.

python3 -I eyes.py SRC OUT X0 Y0 X1 Y1 [MIN]
"""
import sys
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
x0, y0, x1, y1 = (int(v) for v in sys.argv[3:7])
lo = int(sys.argv[7]) if len(sys.argv) > 7 else 100
im = Image.open(src).convert('RGB')
px = im.load()
seen = set()
filled = 0
for y in range(y0, y1):
    for x in range(x0, x1):
        if (x, y) in seen or min(px[x, y]) <= 215:
            continue
        stack, comp, inside = [(x, y)], [], True
        seen.add((x, y))
        while stack:
            cx, cy = stack.pop()
            comp.append((cx, cy))
            for n in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                if not (x0 <= n[0] < x1 and y0 <= n[1] < y1):
                    inside = False
                    continue
                if n not in seen and min(px[n]) > 215:
                    seen.add(n)
                    stack.append(n)
        if inside and len(comp) >= lo:
            for p in comp:
                px[p] = (40, 12, 29)
            filled += 1
            print('eye', len(comp), min(p[0] for p in comp), min(p[1] for p in comp))
im.save(out)
print('filled', filled)
