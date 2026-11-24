# Pack built.pkl into the Sumer binary city file (gzip).
import pickle, sys, struct, json, gzip, math, collections
import numpy as np
import shapely
from shapely.geometry import Polygon, box, LineString, Point
from shapely.geometry.polygon import orient
from shapely.strtree import STRtree

d = pickle.load(open(sys.argv[1], 'rb'))
OUT = sys.argv[2]
J = d['out_json']
G = J['grid']; X0, Z0, CS, NX, NZ = G['x0'], G['z0'], G['cs'], G['nx'], G['nz']
CLS = J['cls']; CID = {c: i for i, c in enumerate(CLS)}

strings = ['']; sidx = {'': 0}
def S(s):
    s = s or ''
    if s not in sidx:
        sidx[s] = len(strings); strings.append(s)
    return sidx[s]

def chunk_of(x, z):
    ix = int((x - X0) // CS); iz = int((z - Z0) // CS)
    if 0 <= ix < NX and 0 <= iz < NZ: return iz * NX + ix
    return -1
def corigin(ci):
    return X0 + (ci % NX) * CS, Z0 + (ci // NX) * CS

def q(v):
    r = int(round(v * 10))
    if r < -32768 or r > 32767: raise ValueError('coord overflow %r' % v)
    return r

def rings_of(p, tol):
    p = orient(p.simplify(tol, preserve_topology=True), sign=1.0)
    if p.is_empty or p.geom_type != 'Polygon': return None
    rs = [list(p.exterior.coords)[:-1]] + [list(h.coords)[:-1] for h in p.interiors]
    rs = [r for r in rs if len(r) >= 3]
    if not rs or len(rs[0]) < 3: return None
    if len(rs) > 255: rs = rs[:255]
    return rs


def dpack(rs, ox, oz):
    # rings/lines: first point absolute (dm, chunk-relative), then deltas
    out = []
    for r in rs:
        px = pz = 0
        for k, (x, z) in enumerate(r):
            X, Z = q(x - ox), q(z - oz)
            if k == 0: out += [X, Z]
            else: out += [X - px, Z - pz]
            px, pz = X, Z
    return struct.pack('<%dh' % len(out), *out)

blob = collections.defaultdict(bytearray)
counts = collections.Counter()
# ---------------- buildings
per_chunk_b = collections.defaultdict(list)
for b in d['bout']:
    c = b['p'].centroid
    ci = chunk_of(c.x, c.y)
    if ci < 0: continue
    per_chunk_b[ci].append(b)
per_chunk_g = d['chunk_ground']
per_chunk_t = collections.defaultdict(list)
for x, z, ty, s in d['trees']:
    ci = chunk_of(x, z)
    if ci >= 0: per_chunk_t[ci].append((x, z, ty, s))
per_chunk_p = collections.defaultdict(list)
for x, z, ty in d['points']:
    ci = chunk_of(x, z)
    if ci >= 0: per_chunk_p[ci].append((x, z, ty))
# roads & paths clipped per chunk
per_chunk_r = collections.defaultdict(list)
def clip_lines(items, kind):
    geoms = [it['line'] for it in items]
    tr = STRtree(geoms)
    for ci in range(NX * NZ):
        ox, oz = corigin(ci)
        cb = box(ox, oz, ox + CS, oz + CS)
        for i in tr.query(cb, predicate='intersects'):
            it = items[i]
            g = it['line'].intersection(cb)
            parts = [g] if g.geom_type == 'LineString' else [x for x in getattr(g, 'geoms', []) if x.geom_type == 'LineString']
            for ln in parts:
                if ln.length < 0.5: continue
                per_chunk_r[ci].append((kind, it, ln))
clip_lines(d['roads'], 0)
clip_lines(d['paths'], 1)

for ci in range(NX * NZ):
    ox, oz = corigin(ci)
    buf = bytearray()
    # buildings
    bl = []
    for b in per_chunk_b.get(ci, []):
        rs = rings_of(b['p'], 0.2)
        if not rs: continue
        try:
            packed = dpack(rs, ox, oz)
        except (ValueError, struct.error):
            continue
        rec = struct.pack('<BBBBBBHHHB', b['style'], b['roof'], b['wall'], b['roofc'], b['flags'], min(255, b['lv']),
                          min(65535, int(round(b['H'] * 10))), min(65535, int(round(b['minH'] * 10))), S(b['name']), len(rs))
        rec += struct.pack('<%dH' % len(rs), *[len(r) for r in rs])
        rec += packed
        bl.append(rec)
    buf += struct.pack('<H', len(bl)); counts['b'] += len(bl)
    for r in bl: buf += r
    # ground polygons
    gl = []
    for c, p in per_chunk_g.get(ci, []):
        rs = rings_of(p, 0.25 if c not in ('LAND',) else 0.5)
        if not rs: continue
        rec = struct.pack('<BB', CID[c], len(rs)) + struct.pack('<%dH' % len(rs), *[len(r) for r in rs]) + dpack(rs, ox, oz)
        gl.append(rec)
    buf += struct.pack('<H', len(gl)); counts['g'] += len(gl)
    for r in gl: buf += r
    # trees
    tl = per_chunk_t.get(ci, [])
    buf += struct.pack('<H', len(tl)); counts['t'] += len(tl)
    for x, z, ty, s in tl:
        buf += struct.pack('<hhBB', q(x - ox), q(z - oz), ty, max(1, min(255, int(round(s * 100)))))
    # roads + paths
    rl = per_chunk_r.get(ci, [])
    buf += struct.pack('<H', len(rl)); counts['r'] += len(rl)
    for kind, it, ln in rl:
        pts = list(ln.simplify(0.3).coords)
        cid = it['cls']
        fl = (1 if it.get('oneway') else 0) | (2 if it.get('bridge') else 0) | (4 if kind == 1 else 0)
        mat = CID.get(it.get('mat', 'ASPHALT'), CID['ASPHALT']) if kind == 1 else CID['ASPHALT']
        if kind == 1 and it.get('mat') == 'CROSSING': fl |= 8
        buf += struct.pack('<BBBBBHH', cid, fl, max(1, min(255, int(round(it['w'] * 4)))), max(0, min(255, int(round(it.get('sw', 0) * 4)))), mat, S(it['name']), len(pts))
        buf += dpack([pts], ox, oz)
    # points
    pl = per_chunk_p.get(ci, [])
    buf += struct.pack('<H', len(pl)); counts['p'] += len(pl)
    for x, z, ty in pl:
        buf += struct.pack('<hhB', q(x - ox), q(z - oz), ty)
    blob[ci] = buf
print('counts', dict(counts))

# ---------------- shore distance grid (for shallow water colour)
GX0, GZ0, GR = -12000, -12000, 40.0
GW, GH = 640, 480  # covers x -12000..13600, z -12000..7200
LAND = d['LAND']
from shapely.ops import unary_union
coast = d['COAST']
# use simplified island coastline (far) + local coastline
far = d['FAR']
ISL = d['ISLAND']
coast_all = unary_union([coast, ISL.boundary])
xs = GX0 + (np.arange(GW) + 0.5) * GR
zs = GZ0 + (np.arange(GH) + 0.5) * GR
XX, ZZ = np.meshgrid(xs, zs)
pts = shapely.points(XX.ravel(), ZZ.ravel())
dist = shapely.distance(pts, coast_all)
shapely.prepare(ISL)
LANDALL = unary_union([ISL, LAND]); shapely.prepare(LANDALL)
landm = shapely.contains(LANDALL, pts)
dsea = np.where(landm, 0, np.clip(dist / 4.0, 0, 255)).astype(np.uint8)
dland = np.where(landm, np.clip(dist / 4.0, 1, 255), 0).astype(np.uint8)
shore = np.stack([dsea, dland], axis=-1).reshape(GH, GW, 2).tobytes()   # RG: metres/4 to the coast (sea side, land side)
print('shore grid', GW, GH)

# far land polygons (outside play area) at coarse resolution
farp = []
for p in (far.geoms if hasattr(far, 'geoms') else [far]):
    if p.geom_type != 'Polygon' or p.area < 2e4: continue
    p = orient(p.simplify(40), sign=1.0)
    farp.append([[[round(x), round(z)] for x, z in list(p.exterior.coords)[:-1]]] + [[[round(x), round(z)] for x, z in list(h.coords)[:-1]] for h in p.interiors])

J2 = dict(J)
J2['strings'] = strings
J2['far'] = farp
J2['shore'] = dict(x0=GX0, z0=GZ0, res=GR, w=GW, h=GH)
J2['landmarks'] = json.load(open(sys.argv[3])) if len(sys.argv) > 3 else []
J2['attribution'] = 'Map data (c) OpenStreetMap contributors, ODbL'
hj = json.dumps(J2, separators=(',', ':'), ensure_ascii=False).encode('utf8')
out = bytearray(b'SUMR') + struct.pack('<II', 1, len(hj)) + hj
while len(out) % 4: out += b' '
table_off = len(out)
out += bytes(8 * NX * NZ)
for ci in range(NX * NZ):
    b = blob.get(ci, b'')
    struct.pack_into('<II', out, table_off + 8 * ci, len(out), len(b))
    out += b
while len(out) % 4: out += b'\0'
shore_off = len(out)
out += shore
# patch shore offset: append small trailer with offsets
out += struct.pack('<II', table_off, shore_off) + b'SEND'
raw = bytes(out)
gz = gzip.compress(raw, compresslevel=9)
open(OUT, 'wb').write(gz)
print('raw MB %.2f  gz MB %.2f  strings %d far polys %d' % (len(raw) / 1e6, len(gz) / 1e6, len(strings), len(farp)))
