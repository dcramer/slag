"""Paints the sneak's drawings, in place: the eye slot (drawn white round two pupils) becomes a dark gap (SLOT)
with two eye whites (EYEW) at fixed places across it, and, with --alert, a red "!" pops up over the box's front
(white rows added on top for it). Run once on the drawings as Tripo drew them:
  python3 -I paint.py idle2.png --alert; python3 -I paint.py air-1.png --alert --tall=0.33
  python3 -I paint.py ../design.png walk-1.png walk-2.png run-1.png run-2.png air-2.png wall.png cheer.png"""
import sys
from collections import deque
from PIL import Image, ImageDraw

SLOT = (0, 0, 255)
EYEW = (255, 0, 255)
ALERT = (220, 40, 40)
INK = (24, 23, 29)

args = sys.argv[1:]
alert = '--alert' in args
noslot = '--noslot' in args
paths = [a for a in args if not a.startswith('--')]
TALL = next((float(a[7:]) for a in args if a.startswith('--tall=')), 0.4)


def white(c):
    return min(c) >= 228


def boxlike(c):
    r, g, b = c
    return 120 <= r <= 215 and r - b >= 55 and r > g > b


def label(W, H, ok):
    """Components of pixels where ok(i) holds, 4-connected: list of index lists."""
    seen = bytearray(W * H)
    comps = []
    for i in range(W * H):
        if seen[i] or not ok(i):
            continue
        q = deque([i])
        seen[i] = 1
        comp = []
        while q:
            j = q.popleft()
            comp.append(j)
            x, y = j % W, j // W
            for k in (j - 1 if x > 0 else -1, j + 1 if x < W - 1 else -1, j - W, j + W):
                if 0 <= k < W * H and not seen[k] and ok(k):
                    seen[k] = 1
                    q.append(k)
        comps.append(comp)
    return comps


def bbox(comp, W):
    xs = [j % W for j in comp]
    ys = [j // W for j in comp]
    return min(xs), min(ys), max(xs), max(ys)


for path in paths:
    im = Image.open(path).convert('RGB')
    W, H = im.size
    px = list(im.getdata())
    wh = [white(c) for c in px]
    # The background: white reachable from the border.
    bg = bytearray(W * H)
    q = deque(i for i in list(range(W)) + list(range(W * (H - 1), W * H)) + list(range(0, W * H, W)) + list(range(W - 1, W * H, W)) if wh[i])
    for i in q:
        bg[i] = 1
    while q:
        j = q.popleft()
        x = j % W
        for k in (j - 1 if x > 0 else -1, j + 1 if x < W - 1 else -1, j - W, j + W):
            if 0 <= k < W * H and not bg[k] and wh[k]:
                bg[k] = 1
                q.append(k)
    fig = [i for i in range(W * H) if not bg[i]]
    fx0, fy0, fx1, fy1 = bbox(fig, W)
    box = max(label(W, H, lambda i: not bg[i] and boxlike(px[i])), key=len)
    bx0, by0, bx1, by1 = bbox(box, W)
    if alert:
        # Room above for the mark: white rows on top, everything found so far shifted down.
        add = max(0, int((by1 - by0) * 0.72 + 40 - by0))
        if add:
            big = Image.new('RGB', (W, H + add), (255, 255, 255))
            big.paste(im, (0, add))
            im = big
            H += add
            px = [(255, 255, 255)] * (W * add) + px
            wh = [True] * (W * add) + wh
            bg = bytearray([1] * (W * add)) + bg
            fy0, fy1, by0, by1 = fy0 + add, fy1 + add, by0 + add, by1 + add
    out = im.copy()
    d = ImageDraw.Draw(out)
    o = out.load()
    if not noslot:
        enclosed = label(W, H, lambda i: wh[i] and not bg[i])
        cands = []
        for c in enclosed:
            x0, y0, x1, y1 = bbox(c, W)
            cx = (x0 + x1) / 2
            if len(c) > 200 and y1 < fy0 + (fy1 - fy0) * 0.6 and cx > (bx0 + bx1) / 2 and (x1 - x0) > 1.6 * (y1 - y0):
                cands.append((len(c), c))
        if not cands:
            print(path, 'no slot')
        else:
            slot = max(cands)[1]
            x0, y0, x1, y1 = bbox(slot, W)
            inslot = set(slot)
            # Pupils: dark pieces inside the slot's box, clear of its ends.
            m = max(3, (y1 - y0) // 6)
            dark = label(W, H, lambda i: sum(px[i]) < 330 and x0 + m < i % W < x1 - m and y0 < i // W < y1)
            pupils = sorted((p for p in dark if len(p) > 20), key=len, reverse=True)[:2]
            # Paint the slot, its pupils and its antialiased rim (greys, not the box's brown) dark.
            paint = set(slot)
            for p in pupils:
                paint.update(p)
            rim = set()
            for j in paint:
                x, y = j % W, j // W
                for dy in range(-3, 4):
                    for dx in range(-3, 4):
                        k = (y + dy) * W + x + dx
                        if 0 <= k < W * H and k not in paint and not bg[k] and not boxlike(px[k]):
                            r, g, b = px[k]
                            if abs(r - b) < 45:
                                rim.add(k)
            for j in paint | rim:
                o[j % W, j // W] = SLOT
            h = y1 - y0
            # Two eye whites at fixed places across the slot, so the face kit finds the same pair in every pose.
            cy = (y0 + y1) / 2
            r = h * 0.26
            for f in (0.42, 0.72):
                cx = x0 + (x1 - x0) * f
                d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=EYEW)
            print(path.rsplit('/', 1)[-1], 'slot', (x0, y0, x1, y1), 'pupils', len(pupils))
    if alert:
        bh = by1 - by0
        cx = bx0 + (bx1 - bx0) * 0.7
        tall = bh * TALL
        bot = by0 - bh * TALL * 0.22
        top = bot - tall
        wt, wb = bh * 0.1, bh * 0.06
        lw = max(3, round(bh * 0.025))
        bar_bot = top + tall * 0.66
        bar = [(cx - wt, top), (cx + wt, top), (cx + wb, bar_bot), (cx - wb, bar_bot)]
        d.polygon(bar, fill=ALERT, outline=INK, width=lw)
        dr = bh * 0.075
        dy = bot - dr
        d.ellipse([cx - dr, dy - dr, cx + dr, dy + dr], fill=ALERT, outline=INK, width=lw)
        print(path.rsplit('/', 1)[-1], 'alert at', round(cx), round(top), round(bot))
    out.save(path)
