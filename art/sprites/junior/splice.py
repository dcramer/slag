"""The design: big-1's pincer claw, phone and wheels, with big-2's antennae (two big zigzags each, clear of the cap).

Args: big-1.png big-2.png out.png. The two edits of drawn/design.png line up pixel for pixel but for what each changed,
so every pixel of the top that differs (the antennae, drawn or not) is taken from big-2, except round the phone.
"""
import sys
from PIL import Image

a = Image.open(sys.argv[1]).convert('RGB')
b = Image.open(sys.argv[2]).convert('RGB')
pa, pb = a.load(), b.load()
w, h = a.size
for y in range(0, 450):
    for x in range(w):
        if 640 <= x <= 860 and y >= 300:
            continue
        if max(abs(pa[x, y][i] - pb[x, y][i]) for i in range(3)) > 40:
            pa[x, y] = pb[x, y]
a.save(sys.argv[3])
