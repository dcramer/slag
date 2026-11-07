"""Makes every drawing ready to trace, from the drawings as cut (drawn/) into flat/ and design.png:

    python3 -I art/sprites/skeleton/prep.py

1. air-1's wink opened: a socket painted over the shut near eye, so the face kit finds both (the hop drew a wink).
2. The sockets filled solid, the teeth and the nose given colours of their own and the skull's gloss painted bone
   (sockets.py).
3. The crown redrawn round, the hanging loop gone (dome.py): drawn on the model's cone, the skull read as a ghost's,
   an onion and an egg.
4. The skull HEAD times bigger about its chin (head.py).
"""

import os
import shutil
import sys

from PIL import Image, ImageDraw

here = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, here)
from dome import dome  # noqa: E402
from sockets import fill  # noqa: E402
from head import scale  # noqa: E402

POSES = ['idle2', 'walk-1', 'walk-2', 'run-1', 'run-2', 'air-1', 'air-2', 'wall', 'cheer', 'cheer2', 'death']
HEAD = 1.1

for name in POSES + ['design']:
    src = os.path.join(here, 'drawn', name + '.png')
    out = os.path.join(here, 'design.png' if name == 'design' else os.path.join('flat', name + '.png'))
    shutil.copy(src, out)
    if name == 'air-1':
        im = Image.open(out).convert('RGB')
        ImageDraw.Draw(im).ellipse((580, 333, 676, 410), fill=(1, 1, 2))
        im.save(out)
    fill(out)
    dome(out)
    scale(out, HEAD)
