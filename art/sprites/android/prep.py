"""Every drawing in drawn/ made ready to trace, into flat/ (and design.png): prep.py.

1. untail.py paints out the sleep mask's knot tails (not the knocked-out pose, lying, where they don't read; the
   fall's stream straight back along the band, `--level`);
2. thin.py narrows the mask to a blindfold's strip;
3. box.py squares the cardboard drone and floats it clear of her, its stick and string gone.
Each read blind, before, as a round white helmet with a dark visor (docs/characters/android.md, Rig). bedhead.py, a
lock stood up off the crown, is kept but not run: with it she read as a white pointed hood.
"""
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
TMP = HERE.parents[2] / '.cache' / 'android-prep'
POSES = ['design', 'idle2', 'walk-1', 'walk-2', 'run-1', 'run-2', 'air-1', 'air-2', 'wall', 'cheer', 'cheer2', 'death']
TMP.mkdir(parents=True, exist_ok=True)


def run(script, *args):
    out = subprocess.run([sys.executable, '-I', str(HERE / script), *args], capture_output=True, text=True)
    sys.stdout.write(out.stdout)
    if out.returncode:
        sys.exit(f'{script} {args}: {out.stderr or out.stdout}')


for pose in POSES:
    src = HERE / 'drawn' / f'{pose}.png'
    a, b = TMP / f'{pose}-a.png', TMP / f'{pose}-b.png'
    if pose == 'death':
        shutil.copy(src, b)
    else:
        run('untail.py', str(src), str(a), *(['--level'] if pose == 'air-2' else []))
        run('thin.py', str(a), str(b), '0.5')
    dest = HERE / 'design.png' if pose == 'design' else HERE / 'flat' / f'{pose}.png'
    run('box.py', str(b), str(dest))
    print(pose)
