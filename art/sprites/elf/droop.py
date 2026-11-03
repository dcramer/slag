import json, struct, sys, math
# droop.py IN OUT ANGLE Z0 PY YMIN: bends the cap's tail (vertices behind z0 and above ymin, fractions of the
# bind bounds) down about the x axis through (PY, Z0), more the further back, so its tip droops by ANGLE degrees.
src, out = sys.argv[1], sys.argv[2]
A, Z0, PY, YMIN = (float(v) for v in sys.argv[3:7])
EXP = float(sys.argv[7]) if len(sys.argv) > 7 else 2.0
b = bytearray(open(src, 'rb').read())
L = struct.unpack('<I', b[12:16])[0]
j = json.loads(b[20:20 + L])
bo = 20 + L + 8
acc, bv = j['accessors'], j['bufferViews']
p = j['meshes'][0]['primitives'][0]
def view(ai):
    a = acc[ai]; v = bv[a['bufferView']]
    return a, bo + v.get('byteOffset', 0) + a.get('byteOffset', 0), v.get('byteStride', 12)
a, off, st = view(p['attributes']['POSITION'])
P = [list(struct.unpack_from('<3f', b, off + i * st)) for i in range(a['count'])]
mn = [min(q[k] for q in P) for k in range(3)]
mx = [max(q[k] for q in P) for k in range(3)]
z0 = mn[2] + Z0 * (mx[2] - mn[2])
py = mn[1] + PY * (mx[1] - mn[1])
ymin = mn[1] + YMIN * (mx[1] - mn[1])
span = z0 - mn[2]
na = p['attributes'].get('NORMAL')
N = None
if na is not None:
    an, noff, nst = view(na)
    N = [list(struct.unpack_from('<3f', b, noff + i * nst)) for i in range(an['count'])]
moved = 0
for i, q in enumerate(P):
    if q[2] >= z0 or q[1] <= ymin:
        continue
    t = min(1.0, (z0 - q[2]) / span)
    # Eased in, so the bend starts gently at the crown and the tip carries the droop.
    th = math.radians(-A) * t ** EXP
    c, s = math.cos(th), math.sin(th)
    y, z = q[1] - py, q[2] - z0
    q[1], q[2] = py + y * c - z * s, z0 + y * s + z * c
    struct.pack_into('<3f', b, off + i * st, *q)
    if N:
        n = N[i]
        n[1], n[2] = n[1] * c - n[2] * s, n[1] * s + n[2] * c
        struct.pack_into('<3f', b, noff + i * nst, *n)
    moved += 1
# The accessor's bounds must still hold every vertex.
a['min'] = [min(q[k] for q in P) for k in range(3)]
a['max'] = [max(q[k] for q in P) for k in range(3)]
js = json.dumps(j, separators=(',', ':')).encode()
js += b' ' * ((4 - len(js) % 4) % 4)
rest = b[20 + L:]
outb = bytearray(b[:12]) + struct.pack('<I', len(js)) + b[16:20] + js + rest
struct.pack_into('<I', outb, 8, len(outb))
open(out, 'wb').write(outb)
print('moved', moved)
