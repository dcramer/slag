"""Makes Junior's drawings ready to trace: the whites he is drawn with apart from the background's, the eye whole, the
grin bold.

Args: in.png out.png [in.png out.png ...]. The image model draws his whites (the eye, the teeth, the socks, the
phone's screen) a bluish off-white, (237, 243, 243), and the background pure white. Both pass the hole test (228),
so `holes` would cut his eye, his grin and his socks through the frame along with the gaps between his legs and
his arm. Every patch the figure closes in that is mostly the drawn off-white is tinted under 228, to WHITE (still
`white`); pure white patches are background closed in, and stay to be cut.

The eye's white is the biggest such patch in the top half, if it's big enough to be one. It and everything inside its
outline (the pupil, pressed to the rim or not, and its glint) go to EYE, the map's `eyewhite`: the face kit finds the
eye as that one speck and paints it over, so no dark speck has to be painted over in the face and the grin keeps its ink.
The teeth under it get a bolder ink round them (GRIN px), so the grin traces as a dark-rimmed mouth: drawn in the pen's
thin line, its outline went at play size and a reader comparing it with the reference saw no mouth.
Sources are in drawn/, what's traced in flat/ and design.png.
"""
import sys
from collections import deque
from PIL import Image

EYE = (200, 230, 250)
WHITE = (224, 230, 230)
INK = (31, 24, 42)
# Image px: the eye's white is 5,700 to 9,300 in the drawings (each cut to the design's size, `cut --design`), the
# next biggest white in the top half (the phone's screen, a row of teeth) under 2,100. A drawing whose eye is shut has none.
EYE_LEAST = 3500
# Image px of ink round the teeth: past `map.ink` (9) with the drawn line, so it stays a fill.
GRIN = 7


def patches(px, w, h, white):
    """Every 4-connected patch of `white` pixels, and whether it touches the border."""
    seen = bytearray(w * h)
    out = []
    for y0 in range(h):
        for x0 in range(w):
            if seen[y0 * w + x0] or not white(x0, y0):
                continue
            patch, edge, q = [], False, deque([(x0, y0)])
            seen[y0 * w + x0] = 1
            while q:
                x, y = q.popleft()
                patch.append((x, y))
                if x in (0, w - 1) or y in (0, h - 1):
                    edge = True
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and white(nx, ny):
                        seen[ny * w + nx] = 1
                        q.append((nx, ny))
            out.append((patch, edge))
    return out


def hull(points):
    """The convex hull of points, counter-clockwise (monotone chain)."""
    pts = sorted(set(points))
    cross = lambda o, a, b: (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, hi = [], []
    for p in pts:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], p) <= 0:
            lo.pop()
        lo.append(p)
    for p in reversed(pts):
        while len(hi) >= 2 and cross(hi[-2], hi[-1], p) <= 0:
            hi.pop()
        hi.append(p)
    return lo[:-1] + hi[:-1]


def within(poly, x, y):
    """Whether (x, y) is inside a counter-clockwise convex polygon."""
    n = len(poly)
    return all((poly[(i + 1) % n][0] - poly[i][0]) * (y - poly[i][1]) - (poly[(i + 1) % n][1] - poly[i][1]) * (x - poly[i][0]) >= 0 for i in range(n))


args = sys.argv[1:]
for src, dst in zip(args[::2], args[1::2]):
    im = Image.open(src).convert('RGB')
    w, h = im.size
    px = im.load()
    ps = patches(px, w, h, lambda x, y: min(px[x, y]) >= 228)
    fig = [y for y in range(0, h, 2) for x in range(0, w, 2) if min(px[x, y]) < 228]
    top, low = min(fig), max(fig)
    drawn = []
    for patch, edge in ps:
        if edge or len(patch) < 6:
            continue
        mean = [sum(px[x, y][c] for x, y in patch) / len(patch) for c in range(3)]
        # The drawn off-white is bluish and under 248 in red; the background is white.
        if mean[0] < 246:
            drawn.append(patch)
    high = [p for p in drawn if sum(y for _, y in p) / len(p) < top + (low - top) * 0.5]
    eye = max(high, key=len) if high else None
    if eye and len(eye) < EYE_LEAST:
        eye = None
    for p in drawn:
        for x, y in p:
            px[x, y] = WHITE
    teeth = []
    if eye:
        xs = [x for x, _ in eye]
        ys = [y for _, y in eye]
        ew, eh = max(xs) - min(xs), max(ys) - min(ys)
        ecx, ecy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
        shape = hull(eye)
        for x in range(min(xs), max(xs) + 1):
            for y in range(min(ys), max(ys) + 1):
                if within(shape, x, y):
                    px[x, y] = EYE
        # The teeth: the whites just under the eye and across it (the phone's screen is off to the side).
        for p in drawn:
            if p is eye:
                continue
            cx = sum(x for x, _ in p) / len(p)
            cy = sum(y for _, y in p) / len(p)
            if ecy + eh * 0.4 < cy < ecy + eh * 1.6 and abs(cx - ecx) < ew * 1.1:
                teeth.extend(p)
    if teeth:
        s = set(teeth)
        for x, y in teeth:
            for dx in range(-GRIN, GRIN + 1):
                for dy in range(-GRIN, GRIN + 1):
                    q = (x + dx, y + dy)
                    if dx * dx + dy * dy <= GRIN * GRIN and q not in s and 0 <= q[0] < w and 0 <= q[1] < h and min(px[q]) < 228 and px[q] != EYE:
                        px[q] = INK
    im.save(dst)
    print(dst, len(drawn), 'drawn whites', 'eye' if eye else 'no eye', len(teeth), 'teeth px')
