"""Every drawing in drawn/ made ready to trace, into flat/ (and design.png): prep.py [--v].

1. whites.py inks the fall's eye whites (her other drawings' eyes are dark ovals), in a box round them;
2. buns.py pushes both buns up and out, clear of her head (not the knocked-out pose, lying, where they don't read);
3. eyes.py repaints the eyes apart from the brows they touch.
Each pose's hints (image px of drawn/<pose>.png) are below: the buns' and eyes' middles where finding them by
shape picks a boot, the far bun half behind her head, or her open mouth.
"""
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
TMP = HERE.parents[2] / '.cache' / 'fighter-prep'
PUSH = '0.28'
UP = '0.3'
# pose: (bun hints or None, eye hints or None, eye-white box or None)
POSES = {
    'design': (None, '534,208,576,208', None),
    'idle2': ('536,163,721,168', None, None),
    'walk-1': (None, None, None),
    'walk-2': (None, None, None),
    'run-1': ('702,159,837,139', '796,262,837,270', None),
    'run-2': ('717,225,842,200', None, None),
    'air-1': (None, None, None),
    'air-2': ('404,213,579,173', '500,280,565,275', '480,260,585,300'),
    'wall': ('518,167,703,147', None, None),
    'cheer': (None, '607,389,560,395', None),
    'cheer2': ('565,203,775,173', 'none', None),
    'death': ('none', 'none', None),
}
V = ['--v'] if '--v' in sys.argv else []
TMP.mkdir(parents=True, exist_ok=True)


def run(script, *args):
    out = subprocess.run([sys.executable, '-I', str(HERE / script), *args], capture_output=True, text=True)
    sys.stdout.write(out.stdout)
    if out.returncode:
        sys.exit(f'{script} {args}: {out.stderr or out.stdout}')


for pose, (buns, eyes, whites) in POSES.items():
    src = HERE / 'drawn' / f'{pose}.png'
    dst = HERE / ('design.png' if pose == 'design' else f'flat/{pose}.png')
    cur = src
    if whites:
        nxt = TMP / f'{pose}-whites.png'
        run('whites.py', str(cur), str(nxt), *whites.split(','))
        cur = nxt
    if buns != 'none':
        nxt = TMP / f'{pose}-buns.png'
        run('buns.py', str(cur), str(nxt), '--push', PUSH, '--up', UP, *(['--at', buns] if buns else []), *V)
        cur = nxt
    if eyes != 'none':
        run('eyes.py', str(cur), str(dst), *(['--at', eyes] if eyes else []), *V)
    else:
        dst.write_bytes(cur.read_bytes())
print('ready')
