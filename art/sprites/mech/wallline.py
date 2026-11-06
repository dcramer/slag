"""The drawn wall line beside the wall slide taken out of a pose sheet before it is cut (tools/art3d/README.md → 3. Poses).

python3 -I art/sprites/bear/wallline.py SHEET OUT X0 X1 [Y0 Y1]

The line is a thin dark column from X0 to X1, the figure braced on it from the left. Everything from X0 to X1 goes
white, the fingertips and boot toes drawn over it with it, so the figure ends flat where the wall was (the tracer's pen
closes the cut edge).
"""
import sys
from PIL import Image

src, out, x0, x1 = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
im = Image.open(src).convert('RGB')
w, h = im.size
y0, y1 = (int(sys.argv[5]), int(sys.argv[6])) if len(sys.argv) > 6 else (0, h)
im.paste((255, 255, 255), (x0, y0, x1 + 1, y1))
im.save(out)
