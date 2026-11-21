"""NYC 3000 landmark towers and rooftop props modelled in Blender.

Tower facades are UV-mapped for the game's window textures (one window cell = 4 m;
the texture covers 32 m across and 64 m up), so they light up like the rest of the city.
Materials named win* become window facades, emissive materials become neon trims and
the rest become solid detail. Collision boxes are exported as empties named
<tower>_col<k>: location = box centre, scale = half size.
Blender axes: +Z up; the game turns +Y into -Z.
"""
import math
import bmesh
from mathutils import Vector as V, Matrix
from lib import (mat, Builder, finish, marker, bm_box, bm_cyl, bm_lathe, bm_torus, bm_sphere, bm_from_mods, T, lerp,
                 tri_count)


def pal():
    return dict(
        win=mat('win', '#ffffff', 0.0, 0.6),
        metal=mat('b_metal', '#30364a', 0.6, 0.4),
        dark=mat('b_dark', '#1a1d28', 0.4, 0.5),
        stone=mat('b_stone', '#565866', 0.1, 0.7),
        gold=mat('b_gold', '#c9a45a', 0.8, 0.3),
        silver=mat('b_silver', '#aab2c4', 0.9, 0.2),
        glass=mat('b_glass', '#14304a', 0.8, 0.1),
        tc=mat('n_tc', emit='#29f3ff'),  # neon recoloured per building in the game
        ngold=mat('n_gold', emit='#ffd27a'),
        nwhite=mat('n_white', emit='#e8f6ff'),
        nred=mat('n_red', emit='#ff1030'),
        npink=mat('n_pink', emit='#ff2bd6'),
        ncyan=mat('n_cyan', emit='#29f3ff'),
        wood=mat('b_wood', '#5a4434', 0.0, 0.85),
        iron=mat('b_iron', '#26211e', 0.5, 0.5),
        roofw=mat('b_roofwood', '#3a2c22', 0.0, 0.85),
        acbox=mat('b_acbox', '#4a505c', 0.5, 0.45),
    )


# ------------------------------------------------------------------ plan shapes (CCW)
def rrect(w, d, r, cs=3):
    hw, hd = w / 2, d / 2
    r = min(r, hw, hd)
    pts = []
    for cx, cy, a0 in ((hw - r, hd - r, 0), (-hw + r, hd - r, 90), (-hw + r, -hd + r, 180), (hw - r, -hd + r, 270)):
        if r <= 1e-6:
            pts.append((cx, cy))
            continue
        for k in range(cs + 1):
            a = math.radians(a0 + 90 * k / cs)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def chamfer(w, d, c):
    return rrect(w, d, c, 1)


def circle(R, n):
    return [(R * math.cos(2 * math.pi * k / n), R * math.sin(2 * math.pi * k / n)) for k in range(n)]


def xform(pts, s=1.0, rot=0.0):
    c, sn = math.cos(rot), math.sin(rot)
    return [(s * (x * c - y * sn), s * (x * sn + y * c)) for x, y in pts]


def facade(b, uvl, rings2d, zs, m, cap=True, cap_m=None):
    """Window facade through horizontal rings; u = arc length / 32 m, v = height / 64 m. Roof caps get the dark texel."""
    rings = [[(x, y, z) for x, y in r] for r, z in zip(rings2d, zs)]
    faces, caps = b.loft(rings, lambda i, j, f: m, closed=True, cap1=cap, cap_m=cap_m or m)
    rows = b.last_rows
    n = len(rings2d[0])
    cum = []
    for r in rings2d:
        c = [0.0]
        for k in range(1, n + 1):
            a, bb = r[k - 1], r[k % n]
            c.append(c[-1] + math.hypot(bb[0] - a[0], bb[1] - a[1]))
        cum.append(c)
    idx = {}
    for i, row in enumerate(rows):
        for k, v in enumerate(row):
            idx[v] = (i, k)
    for f, i, j in faces:
        for lp in f.loops:
            ii, k = idx[lp.vert]
            kk = n if (k == 0 and j == n - 1) else k
            lp[uvl].uv = (cum[ii][kk] / 32.0, zs[ii] / 64.0)
    for t in caps:
        for lp in t.loops:
            lp[uvl].uv = (0.004, 0.004)
    return faces


def tube(b, path, r, m, sides=4):
    """Thin square tube through points (mostly vertical paths), for neon lines."""
    sq = [(r * math.cos(math.pi / 4 + k * math.pi / 2 * 4 / sides), r * math.sin(math.pi / 4 + k * math.pi / 2 * 4 / sides)) for k in range(sides)]
    rings = [[(px + dx, py + dy, pz) for dx, dy in sq] for px, py, pz in path]
    b.loft(rings, lambda i, j, f: m, closed=True, cap0=True, cap1=True, cap_m=m)


def ring_line(b, pts, z, r, m):
    """Neon line around a plan outline at height z."""
    n = len(pts)
    for k in range(n):
        a, c = V((*pts[k], z)), V((*pts[(k + 1) % n], z))
        d = c - a
        if d.length < 0.05:
            continue
        b.add(bm_box(d.length + r * 2, r * 2, r * 2), m, T((a + c) / 2, (0, 0, math.atan2(d.y, d.x))))


def edge_lines(b, pts, z0, z1, r, m, every=1):
    for k in range(0, len(pts), every):
        x, y = pts[k]
        b.box(r * 2, r * 2, z1 - z0, m, (x, y, (z0 + z1) / 2))


def cols_markers(name, cols):
    for k, (x, y, z, hx, hy, hz) in enumerate(cols):
        marker(f'{name}_col{k}', (x, y, z), (hx, hy, hz))


# ------------------------------------------------------------------ towers
def tower_spire(P):
    """Art-deco tower with a stepped sunburst crown and a needle spire (fits 25 m lots)."""
    b = Builder()
    uvl = b.bm.loops.layers.uv.verify()
    cols = []
    z0 = 0.0
    for w, z1, c in ((24, 150, 2.6), (20.5, 166, 2.2), (17, 178, 1.9)):
        pts = chamfer(w, w, c)
        facade(b, uvl, [pts, pts], [z0, z1], P['win'])
        ring_line(b, chamfer(w + 0.5, w + 0.5, c), z1 - 0.4, 0.22, P['ngold'])
        edge_lines(b, chamfer(w + 0.35, w + 0.35, c), z0 + (6 if z0 == 0 else 0.5), z1 - 0.6, 0.16, P['tc'], every=2)
        cols.append((0, 0, (z0 + z1) / 2, w / 2, w / 2, (z1 - z0) / 2))
        z0 = z1
    crown_base = z0
    for w, h in ((14.5, 9.5), (11.5, 8.0), (8.5, 7.0)):
        z1 = z0 + h
        pts = chamfer(w, w, w * 0.14)
        facade(b, uvl, [pts, pts], [z0, z1], P['silver'])
        # sunburst rays on each face
        for q in range(4):
            R = Matrix.Rotation(q * math.pi / 2, 4, 'Z')
            for k in range(-2, 3):
                ang = k * 0.42
                L = h * (0.85 if k == 0 else 0.72)
                base = V((w / 2 + 0.06, 0, z0 + 0.6))
                mid = base + V((0, math.sin(ang) * L / 2, math.cos(ang) * L / 2))
                b.add(bm_box(0.14, 0.32, L), P['ngold'], R @ Matrix.Translation(mid) @ Matrix.Rotation(-ang, 4, 'X'))
        ring_line(b, chamfer(w + 0.4, w + 0.4, w * 0.14), z1 - 0.2, 0.15, P['ngold'])
        z0 = z1
    cols.append((0, 0, (crown_base + z0) / 2, 7.2, 7.2, (z0 - crown_base) / 2))
    b.cyl(2.4, 0.1, 44, P['silver'], (0, 0, z0 + 22), seg=8)
    for f in (0.22, 0.45, 0.66):
        b.torus(2.4 * (1 - f) + 0.12, 0.11, P['ngold'], (0, 0, z0 + 44 * f), seg=12, rseg=3)
    b.sphere(0.6, P['nred'], (0, 0, z0 + 44.3), u=8, v=6)
    return b, cols


def tower_twist(P):
    """Glass tower twisting 90 degrees on the way up, with neon helix corners (fits 25 m lots)."""
    b = Builder()
    uvl = b.bm.loops.layers.uv.verify()
    H, n = 204.0, 34
    base = rrect(24, 24, 5, 3)
    rings, zs = [], []
    for k in range(n + 1):
        t = k / n
        rings.append(xform(base, lerp(1.0, 0.8, t), math.radians(90) * t))
        zs.append(H * t)
    facade(b, uvl, rings, zs, P['win'])
    for c in range(4):
        path = []
        for ring, z in zip(rings, zs):
            p = (V((*ring[4 * c + 1], 0)) + V((*ring[4 * c + 2], 0))) / 2
            p += p.normalized() * 0.3
            path.append((p.x, p.y, max(6.0, z)))
        tube(b, path, 0.2, P['tc'])
    for z in range(40, int(H), 40):
        k = round(z / H * n)
        ring_line(b, xform(rrect(24.6, 24.6, 5.3, 3), lerp(1.0, 0.8, z / H), math.radians(90) * z / H), z, 0.18, P['tc'])
    top = xform(rrect(24, 24, 5, 3), 0.8, math.radians(90))
    facade(b, uvl, [xform(top, 0.92), xform(top, 0.5)], [H, H + 8], P['glass'], cap_m=P['dark'])
    b.cyl(0.5, 0.15, 34, P['metal'], (0, 0, H + 8 + 17), seg=6)
    b.sphere(0.6, P['nred'], (0, 0, H + 8 + 34.3), u=8, v=6)
    cols = [(0, 0, 8, 12, 12, 8), (0, 0, (16 + H) / 2, 9.4, 9.4, (H - 16) / 2), (0, 0, H + 4, 6.5, 6.5, 4)]
    return b, cols


def tower_halo(P):
    """Round tower with neon bands, a crown of fins and a floating halo ring (fits 25 m lots)."""
    b = Builder()
    uvl = b.bm.loops.layers.uv.verify()
    H, n = 190.0, 28
    zs = [0, 30, 60, 90, 120, 150, 175, 190]
    R = lambda z: lerp(12.3, 9.6, (z / H) ** 1.6)
    facade(b, uvl, [circle(R(z), n) for z in zs], zs, P['win'], cap_m=P['dark'])
    for z in (30, 60, 90, 120, 150, 175):
        b.torus(R(z) + 0.3, 0.26, P['tc'], (0, 0, z), seg=40, rseg=4)
    for k in range(12):
        a = k * math.pi / 6
        r = R(H) - 0.4
        b.add(bm_box(4.2, 0.35, 16), P['silver'], T((math.cos(a) * r, math.sin(a) * r, H + 6), (0, 0, a)) @ T((0.6, 0, 0), (0, -0.18, 0)))
        b.add(bm_box(0.2, 0.37, 14), P['tc'], T((math.cos(a) * (r + 2.6), math.sin(a) * (r + 2.6), H + 6.5), (0, 0, a)) @ T((0, 0, 0), (0, -0.18, 0)))
    b.lathe([(9.4, H), (8.6, H + 4), (6.0, H + 8), (2.5, H + 10.5), (0.0, H + 11)], P['glass'], seg=n)
    b.torus(15.0, 0.75, P['ncyan'], (0, 0, H + 20), seg=56, rseg=6)
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2
        p0 = V((math.cos(a) * 7.5, math.sin(a) * 7.5, H + 9))
        p1 = V((math.cos(a) * 15.0, math.sin(a) * 15.0, H + 20))
        d = p1 - p0
        b.add(bm_box(0.35, 0.35, d.length), P['metal'], Matrix.Translation((p0 + p1) / 2) @ V((0, 0, 1)).rotation_difference(d.normalized()).to_matrix().to_4x4())
    b.cyl(0.4, 0.1, 22, P['metal'], (0, 0, H + 22), seg=6)
    b.sphere(0.5, P['nred'], (0, 0, H + 33.2), u=8, v=6)
    cols = [(0, 0, H / 2, 8.6, 8.6, H / 2), (0, 0, H + 5, 7, 7, 5)]
    return b, cols


def tower_stepped(P):
    """Wide setback skyscraper with a mooring mast (fits 54 m lots)."""
    b = Builder()
    uvl = b.bm.loops.layers.uv.verify()
    cols = []
    z0 = 0.0
    for w, z1 in ((50, 26), (40, 72), (31, 140), (23, 184), (15, 200)):
        pts = chamfer(w, w, 0.8)
        facade(b, uvl, [pts, pts], [z0, z1], P['win'])
        ring_line(b, chamfer(w + 0.6, w + 0.6, 0.8), z1 + 0.25, 0.3, P['stone'])
        ring_line(b, chamfer(w + 0.7, w + 0.7, 0.8), z1 - 0.6, 0.16, P['tc'])
        # vertical piers
        for q in range(4):
            Rq = Matrix.Rotation(q * math.pi / 2, 4, 'Z')
            for k in range(-2, 3):
                x = k * w / 6
                b.add(bm_box(0.6, 0.5, z1 - z0 - 1.2), P['stone'], Rq @ T((x, w / 2 + 0.2, (z0 + z1) / 2 - 0.3)))
        cols.append((0, 0, (z0 + z1) / 2, w / 2, w / 2, (z1 - z0) / 2))
        z0 = z1
    b.lathe([(6.5, z0), (5.6, z0 + 6), (4.2, z0 + 18), (3.2, z0 + 30), (1.2, z0 + 34), (0.0, z0 + 35)], P['silver'], seg=12)
    for k in range(5):
        z = z0 + 4 + k * 6
        r = lerp(6.0, 3.3, k / 4)
        b.torus(r + 0.2, 0.18, P['tc'], (0, 0, z), seg=20, rseg=3)
    b.cyl(0.6, 0.1, 30, P['metal'], (0, 0, z0 + 35 + 15), seg=6)
    b.sphere(0.6, P['nred'], (0, 0, z0 + 65.3), u=8, v=6)
    cols.append((0, 0, z0 + 12, 5.5, 5.5, 12))
    return b, cols


def tower_pyramid(P):
    """Square tower with a glowing glass pyramid top (fits 25 m lots)."""
    b = Builder()
    uvl = b.bm.loops.layers.uv.verify()
    H = 168.0
    pts = chamfer(24, 24, 1.2)
    facade(b, uvl, [pts, pts], [0, H], P['win'])
    for k in range(4):
        x = (1 if k in (0, 3) else -1) * 12.25
        y = (1 if k < 2 else -1) * 12.25
        b.box(0.5, 0.5, H - 6, P['tc'], (x, y, (H + 6) / 2))
    ring_line(b, chamfer(24.8, 24.8, 1.2), H - 0.4, 0.3, P['tc'])
    ring_line(b, chamfer(24.6, 24.6, 1.2), 6.0, 0.25, P['tc'])
    apex = V((0, 0, H + 36))
    sq = [V((12, 12, H)), V((-12, 12, H)), V((-12, -12, H)), V((12, -12, H))]
    bm = bmesh.new()
    vs = [bm.verts.new(p) for p in sq] + [bm.verts.new(apex)]
    for k in range(4):
        bm.faces.new([vs[k], vs[(k + 1) % 4], vs[4]])
    bm.faces.new(vs[:4][::-1])
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    b.add(bm, P['glass'])
    for p in sq:
        d = apex - p
        b.add(bm_box(0.45, 0.45, d.length), P['tc'], Matrix.Translation((p + apex) / 2) @ V((0, 0, 1)).rotation_difference(d.normalized()).to_matrix().to_4x4())
    for f in (0.33, 0.66):
        ring_line(b, chamfer(24 * (1 - f) + 0.6, 24 * (1 - f) + 0.6, 0.3), H + 36 * f, 0.2, P['nwhite'])
    b.sphere(0.9, P['nred'], (0, 0, H + 36.6), u=8, v=6)
    cols = [(0, 0, H / 2, 12, 12, H / 2), (0, 0, H + 9, 8, 8, 9)]
    return b, cols


def tower_blade(P):
    """Slab tower 20 x 44 with a sloped crown and vertical fins (fits half-block lots)."""
    b = Builder()
    uvl = b.bm.loops.layers.uv.verify()
    W, D, H, H2 = 20.0, 44.0, 168.0, 196.0
    pts = chamfer(W, D, 1.0)
    facade(b, uvl, [pts, pts], [0, H], P['win'], cap=False)
    # sloped glass crown (wedge)
    bm = bmesh.new()
    corners = [(W / 2, -D / 2), (W / 2, D / 2), (-W / 2, D / 2), (-W / 2, -D / 2)]
    zt = lambda y: lerp(H + 2, H2, (y + D / 2) / D)
    bot = [bm.verts.new((x, y, H)) for x, y in corners]
    top = [bm.verts.new((x, y, zt(y))) for x, y in corners]
    for k in range(4):
        bm.faces.new([bot[k], bot[(k + 1) % 4], top[(k + 1) % 4], top[k]])
    bm.faces.new(top)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    b.add(bm, P['glass'])
    for x in (-W / 2 - 0.2, W / 2 + 0.2):
        a, c = V((x, -D / 2, zt(-D / 2))), V((x, D / 2, zt(D / 2)))
        d = c - a
        b.add(bm_box(0.4, d.length, 0.4), P['tc'], T((a + c) / 2, (math.atan2(d.z, d.y), 0, 0)))
    for sx in (-1, 1):
        for k in range(11):
            y = -D / 2 + 2 + k * 4
            b.box(0.9, 0.35, H - 8, P['metal'], (sx * (W / 2 + 0.4), y, (H + 8) / 2))
    for sy in (-1, 1):
        for k in range(5):
            x = -W / 2 + 2 + k * 4
            b.box(0.35, 0.9, H - 8, P['metal'], (x, sy * (D / 2 + 0.4), (H + 8) / 2))
    ring_line(b, chamfer(W + 1.2, D + 1.2, 1.0), 8.0, 0.25, P['tc'])
    cols = [(0, 0, H / 2, W / 2, D / 2, H / 2), (0, 0, (H + H2) / 2 - 4, W / 2, D / 2, (H2 - H) / 2)]
    return b, cols


TOWERS = [('twr_spire', tower_spire), ('twr_twist', tower_twist), ('twr_halo', tower_halo),
          ('twr_stepped', tower_stepped), ('twr_pyramid', tower_pyramid), ('twr_blade', tower_blade)]


# ------------------------------------------------------------------ rooftop props
def water_tower(P, neon=False):
    b = Builder()
    for sx in (-1, 1):
        for sy in (-1, 1):
            b.box(0.22, 0.22, 3.5, P['iron'], (sx * 1.15, sy * 1.15, 1.75))
    for q in range(4):
        R = Matrix.Rotation(q * math.pi / 2, 4, 'Z')
        for s in (-1, 1):
            b.add(bm_box(0.08, 2.9, 0.08), P['iron'], R @ T((1.15, 0, 1.75), (s * 0.82, 0, 0)))
        b.add(bm_box(0.12, 2.5, 0.12), P['iron'], R @ T((1.15, 0, 3.3)))
    b.cyl(1.8, 1.8, 0.16, P['iron'], (0, 0, 3.55), seg=12)
    staves = [(1.56, 3.62), (1.62, 4.3), (1.64, 5.0), (1.62, 5.7), (1.56, 6.4)]
    b.lathe(staves, P['wood'], seg=14)
    for z in (3.95, 5.0, 6.05):
        b.torus(1.64 if z == 5.0 else 1.62, 0.045, P['npink'] if (neon and z == 5.0) else P['iron'], (0, 0, z), seg=14, rseg=3)
    b.lathe([(1.78, 6.36), (1.0, 6.95), (0.2, 7.5), (0.0, 7.56)], P['roofw'], seg=14)
    b.cyl(0.07, 0.07, 0.5, P['iron'], (0, 0, 7.8), seg=6)
    b.sphere(0.12, P['iron'], (0, 0, 8.08), u=8, v=6)
    for s in (-1, 1):
        b.box(0.05, 0.05, 6.4, P['iron'], (1.72, s * 0.22, 3.2))
    for k in range(8):
        b.box(0.05, 0.44, 0.05, P['iron'], (1.72, 0, 0.4 + k * 0.8))
    if neon:
        b.box(0.08, 1.4, 0.5, P['ncyan'], (1.66, 0, 4.6), (0, 0, 0))
    return finish(b, 'prop_watertower' + ('_neon' if neon else ''), sharp=50,
                  ao=dict(dist=0.9, rays=24, ground=0.0, floor=0.35))


def ac_unit(P):
    b = Builder()
    b.box(2.4, 1.8, 1.2, P['acbox'], (0, 0, 0.6), bevel=0.06, seg=1)
    for sx in (-1, 1):
        for k in range(3):
            b.box(0.04, 1.5, 0.07, P['dark'], (sx * 1.205, 0, 0.3 + k * 0.28))
    b.cyl(0.62, 0.62, 0.06, P['dark'], (0.45, 0, 1.2), seg=12)
    b.torus(0.62, 0.035, P['metal'], (0.45, 0, 1.26), seg=12, rseg=3)
    for k in range(4):
        b.add(bm_box(1.05, 0.16, 0.025), P['metal'], T((0.45, 0, 1.24), (0.25, 0, k * math.pi / 4)))
    b.cyl(0.09, 0.09, 0.08, P['metal'], (0.45, 0, 1.27), seg=6)
    b.box(0.6, 0.9, 0.12, P['dark'], (-0.65, 0, 1.24))
    return finish(b, 'prop_ac', sharp=50, ao=dict(dist=0.6, rays=24, ground=0.0, floor=0.35))


def dish(P):
    b = Builder()
    b.cyl(0.08, 0.1, 1.2, P['metal'], (0, 0, 0.6), seg=8)
    b.box(0.5, 0.5, 0.1, P['dark'], (0, 0, 0.05))
    prof = [(0.0, 0.0), (0.35, 0.03), (0.7, 0.12), (0.95, 0.24)]
    d = bm_from_mods(bm_lathe(prof, 12), [('SOLIDIFY', {'thickness': 0.03})])
    M = T((0, 0.1, 1.35), (-0.75, 0, 0))
    b.add(d, P['silver'], M)
    b.add(bm_box(0.04, 0.04, 0.85), P['metal'], M @ T((0, 0, 0.45)))
    b.add(bm_box(0.12, 0.12, 0.16), P['dark'], M @ T((0, 0, 0.88)))
    b.add(bm_sphere(0.04, 6, 4), P['nred'], M @ T((0, 0, 0.98)))
    return finish(b, 'prop_dish', sharp=50, ao=dict(dist=0.5, rays=20, ground=0.0, floor=0.4))


def build_all():
    P = pal()
    objs = []
    for name, fn in TOWERS:
        b, cols = fn(P)
        ob = finish(b, name, sharp=40, ao=None)
        cols_markers(name, cols)
        print(f'  {name}: {tri_count(ob)} triangles')
        objs.append(ob)
    for ob in (water_tower(P), water_tower(P, neon=True), ac_unit(P), dish(P)):
        print(f'  {ob.name}: {tri_count(ob)} triangles')
        objs.append(ob)
    return objs


def previews(objs, out):
    import os
    from lib import render
    towers = [o for o in objs if o.name.startswith('twr_')]
    for i, o in enumerate(towers):
        o.location = ((i - 2.5) * 70, 0, 0)
    render(towers, os.path.join(out, 'towers.png'), cam=(0, -420, 170), target=(0, 0, 120), lens=33, res=(1400, 620),
           sky='#14162a', sun_dir=(0.4, -0.6, 0.7))
    for o in towers:
        o.location = (0, 0, 0)
    props = [o for o in objs if o.name.startswith('prop_')]
    for i, o in enumerate(props):
        o.location = ((i - 1.5) * 5, 0, 0)
    render(props, os.path.join(out, 'props.png'), cam=(4, -16, 7), target=(0, 0, 3), lens=40, res=(1000, 520))
    for o in props:
        o.location = (0, 0, 0)
