"""Makes the drawings in drawn/ ready in flat/ (and design.png): each eye repainted the `eye` role's own colour by
eyes.py (the fighter's, its colour a green no blend of her pink and the ink can reach: the fighter's dark plum was
the blend along every trouser edge). Her eye is a small dark oval narrower than the map's ink, so the opening took it
for line and most poses lost their face; painted apart, the map keeps it (`min.eye`). Run from the repo root:
python3 -I art/sprites/genie/prep.py"""
import subprocess
import sys
from pathlib import Path

ART = Path('art/sprites/genie')
EYES = 'art/sprites/genie/eyes.py'
# Poses whose eye the blob test misses get the eye's place by hand (`--at`, image px of the drawn/ file).
AT = {'walk-2': '741,302', 'air-2': '552,665,595,662'}
# The fall's wide eyes are small pupils in whites, too small for the usual opening.
R = {'air-2': '1'}
# Poses with shut eyes: nothing to repaint.
SHUT = {'cheer', 'death'}

for src in sorted((ART / 'drawn').glob('*.png')):
    name = src.stem
    out = ART / 'design.png' if name == 'design' else ART / 'flat' / src.name
    if name in SHUT:
        out.write_bytes(src.read_bytes())
        continue
    cmd = [sys.executable, '-I', EYES, str(src), str(out)] + (['--at', AT[name]] if name in AT else []) + (['--r', R[name]] if name in R else [])
    print(name, subprocess.run(cmd, capture_output=True, text=True).stdout.strip())
