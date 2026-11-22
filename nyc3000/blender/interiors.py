"""NYC 3000 interiors modelled in Blender: a neon corner shop and a flat.

Lighting is baked into the vertex colours (ambient occlusion plus point lights with
ray-traced shadows), so the game draws the rooms unlit and cheap. Markers (empties)
tell the game where the door, the clerk, the counter, the bed, the TV and the loot
are; <room>_col<k> empties are collision boxes (location = centre, scale = half size).
Blender axes: +Y = north (the game's -Z), +Z = up. Both entrances are in the south wall.
"""
import math
import random
import bmesh
from mathutils import Vector as V
from mathutils.bvhtree import BVHTree
from lib import mat, Builder, marker, bm_box, bm_cyl, bm_sphere, bm_lathe, bm_torus, T, hemi_dirs, set_sharp, tri_count
import bpy


def grid(b, origin, u, v, nu, nv, mfn):
    """Subdivided rectangle origin + s*u + t*v (normal = u x v), so baked light varies smoothly."""
    bm = b.bm
    o, u, v = V(origin), V(u), V(v)
    vs = [[None] * (nv + 1) for _ in range(nu + 1)]
    for i in range(nu + 1):
        for j in range(nv + 1):
            vt = bm.verts.new(o + u * (i / nu) + v * (j / nv))
            vt[b.lay_bone] = b.bone
            vs[i][j] = vt
    for i in range(nu):
        for j in range(nv):
            f = bm.faces.new([vs[i][j], vs[i + 1][j], vs[i + 1][j + 1], vs[i][j + 1]])
            f.material_index = b.mi(mfn(i, j))
            f.smooth = False


def bake_light(bm, lights, ambient, ao_dist=0.9, rays=16, floor=0.35):
    """Vertex colour 'Col' = light reaching the vertex (a multiplier for the material colour)."""
    bm.normal_update()
    tree = BVHTree.FromBMesh(bm)
    dirs = hemi_dirs(rays)
    lay = bm.verts.layers.float_color.get('Col') or bm.verts.layers.float_color.new('Col')
    up = V((0, 0, 1))
    for vt in bm.verts:
        n = vt.normal if vt.normal.length > 0.5 else up
        t = n.orthogonal().normalized()
        s = n.cross(t)
        o = vt.co + n * 0.012
        occ = 0.0
        for d in dirs:
            hit = tree.ray_cast(o, t * d.x + s * d.y + n * d.z, ao_dist)
            if hit[0] is not None:
                occ += 1.0 - 0.6 * hit[3] / ao_dist
        k = floor + (1 - floor) * (1 - occ / len(dirs))
        c = [ambient[0] * k, ambient[1] * k, ambient[2] * k]
        for pos, col, power, radius in lights:
            L = V(pos) - o
            dist = L.length
            L /= dist
            ndl = n.dot(L)
            if ndl <= 0:
                continue
            if tree.ray_cast(o, L, dist - 0.08)[0] is not None:
                continue
            a = power * (0.35 + 0.65 * ndl) / (1 + (dist / radius) ** 2)
            c[0] += col[0] * a
            c[1] += col[1] * a
            c[2] += col[2] * a
        vt[lay] = (min(1.0, c[0]), min(1.0, c[1]), min(1.0, c[2]), 1.0)


def room_shell(b, W, D, H, floor_m, wall_lo, wall_hi, ceil_m, cell=0.5, split=1.1, skip_east=False):
    nx, ny, nz = round(W / cell), round(D / cell), round(H / cell)
    grid(b, (-W / 2, -D / 2, 0), (W, 0, 0), (0, D, 0), nx, ny, floor_m)
    grid(b, (-W / 2, -D / 2, H), (0, D, 0), (W, 0, 0), max(1, ny // 2), max(1, nx // 2), lambda i, j: ceil_m)
    wm = lambda i, j, n_up: (wall_lo if (j + 0.5) * H / n_up < split else wall_hi)
    grid(b, (-W / 2, D / 2, 0), (W, 0, 0), (0, 0, H), nx, nz, lambda i, j: wm(i, j, nz))           # north
    grid(b, (-W / 2, -D / 2, 0), (0, 0, H), (W, 0, 0), nz, nx, lambda i, j: wm(j, i, nz))          # south
    grid(b, (-W / 2, -D / 2, 0), (0, D, 0), (0, 0, H), ny, nz, lambda i, j: wm(i, j, nz))          # west
    if not skip_east:
        grid(b, (W / 2, -D / 2, 0), (0, 0, H), (0, D, 0), nz, ny, lambda i, j: wm(j, i, nz))       # east


def wall_cols(name, W, D, H, k0=0):
    cols = [(-W / 2 - 0.1, 0, H / 2, 0.1, D / 2 + 0.2, H / 2), (W / 2 + 0.1, 0, H / 2, 0.1, D / 2 + 0.2, H / 2),
            (0, D / 2 + 0.1, H / 2, W / 2 + 0.2, 0.1, H / 2), (0, -D / 2 - 0.1, H / 2, W / 2 + 0.2, 0.1, H / 2),
            (0, 0, H + 0.1, W / 2 + 0.2, D / 2 + 0.2, 0.1)]
    return cols


def neon_line(b, p0, p1, r, m):
    a, c = V(p0), V(p1)
    d = c - a
    b.add(bm_box(r * 2, r * 2, d.length), m,
          T((a + c) / 2) @ V((0, 0, 1)).rotation_difference(d.normalized()).to_matrix().to_4x4())


def door_inside(b, P, x, y, frame_m, leaf_m, W=1.7):
    """The entrance as seen from inside (south wall at y)."""
    b.box(W, 0.08, 2.6, leaf_m, (x, y + 0.04, 1.3))
    for s in (-1, 1):
        b.box(0.12, 0.12, 2.66, frame_m, (x + s * (W / 2 + 0.06), y + 0.06, 1.33))
    b.box(W + 0.24, 0.12, 0.12, frame_m, (x, y + 0.06, 2.66))
    b.box(0.6, 0.06, 0.2, P['exit'], (x, y + 0.06, 3.0))
    b.box(1.4, 0.9, 0.02, P['mat_rug'], (x, y + 0.6, 0.01))


# ------------------------------------------------------------------ the shop
def shop(P):
    rnd = random.Random(7)
    b = Builder()
    W, D, H = 9.0, 8.0, 3.4
    room_shell(b, W, D, H, lambda i, j: P['tile_a'] if (i + j) % 2 else P['tile_b'], P['wall_lo'], P['wall_hi'], P['ceil'])
    lights = []
    # ceiling light strips
    for y in (-2.4, 0.2, 2.6):
        b.box(7.6, 0.36, 0.06, P['lamp'], (0, y, H - 0.04))
        for x in (-3.0, -1.0, 1.0, 3.0):
            lights.append(((x, y, H - 0.3), (1.0, 1.0, 1.05), 0.34, 3.2))
    # neon stripe round the walls
    for (p0, p1) in (((-W / 2 + 0.03, -D / 2, 2.75), (-W / 2 + 0.03, D / 2, 2.75)), ((W / 2 - 0.03, -D / 2, 2.75), (W / 2 - 0.03, D / 2, 2.75)),
                     ((-W / 2, D / 2 - 0.03, 2.75), (W / 2, D / 2 - 0.03, 2.75))):
        neon_line(b, p0, p1, 0.025, P['neon_pink'])
    # counter with the register (east side), the clerk stands behind it
    b.box(0.7, 3.8, 1.0, P['counter'], (2.65, -1.3, 0.5))
    b.box(0.82, 3.9, 0.05, P['counter_top'], (2.62, -1.3, 1.02))
    neon_line(b, (2.28, -3.2, 0.12), (2.28, 0.6, 0.12), 0.02, P['neon_cyan'])
    b.box(0.42, 0.38, 0.12, P['dark'], (2.65, -1.1, 1.1))
    b.box(0.08, 0.34, 0.24, P['screen_green'], (2.48, -1.1, 1.28), (0, -0.35, 0))
    b.box(0.3, 0.3, 0.06, P['dark'], (2.62, -2.2, 1.08))
    for k in range(6):  # snack rack on the counter
        b.box(0.12, 0.08, 0.16, P['prod'][k % len(P['prod'])], (2.5 + (k % 2) * 0.14, -2.6 + (k // 2) * 0.1, 1.13))
    # slushie machine
    b.box(0.5, 0.55, 0.32, P['dark'], (2.65, 0.15, 1.2))
    for k, m in enumerate((P['neon_cyan'], P['neon_pink'])):
        b.cyl(0.11, 0.11, 0.38, m, (2.65, 0.0 + k * 0.28, 1.55), seg=10)
    # half door that closes the counter
    b.box(1.1, 0.08, 0.95, P['counter'], (3.55, 0.65, 0.48))
    # shelves behind the counter (east wall)
    b.box(0.4, 3.8, 0.06, P['shelf'], (4.25, -1.3, 1.2))
    b.box(0.4, 3.8, 0.06, P['shelf'], (4.25, -1.3, 1.65))
    b.box(0.4, 3.8, 0.06, P['shelf'], (4.25, -1.3, 2.1))
    b.box(0.08, 3.8, 1.4, P['dark'], (4.46, -1.3, 1.6))
    for z in (1.23, 1.68, 2.13):
        y = -3.1
        while y < 0.5:
            w = rnd.uniform(0.1, 0.18)
            h = rnd.uniform(0.18, 0.34)
            b.box(0.22, w, h, rnd.choice(P['prod']), (4.22, y + w / 2, z + h / 2))
            y += w + 0.02
    lights.append(((3.6, -1.3, 2.4), (1.0, 0.95, 0.85), 0.25, 1.6))
    # aisles: two double-sided shelving units with products
    for ax in (-0.6, -2.7):
        b.box(0.12, 3.8, 1.75, P['shelf_back'], (ax, 0.1, 0.875))
        b.box(0.7, 3.8, 0.12, P['shelf'], (ax, 0.1, 0.06))
        b.box(0.7, 0.06, 1.8, P['shelf'], (ax, -1.8, 0.9))
        b.box(0.7, 0.06, 1.8, P['shelf'], (ax, 2.0, 0.9))
        for z in (0.12, 0.55, 0.98, 1.41):
            b.box(0.68, 3.8, 0.04, P['shelf'], (ax, 0.1, z))
            for side in (-1, 1):
                y = -1.7
                while y < 1.9:
                    w = rnd.uniform(0.14, 0.3)
                    h = rnd.uniform(0.18, 0.36)
                    m = rnd.choice(P['prod'])
                    if rnd.random() < 0.3:
                        b.cyl(w * 0.35, w * 0.35, h, m, (ax + side * 0.22, y + w / 2, z + 0.02 + h / 2), seg=8)
                    else:
                        b.box(0.22, w, h, m, (ax + side * 0.21, y + w / 2, z + 0.02 + h / 2))
                    y += w + 0.03
        b.box(0.04, 3.7, 0.08, P['neon_green'], (ax, 0.1, 1.86))
    # fridges along the north wall
    for k in range(5):
        x = -4.0 + k * 1.0
        b.box(0.98, 0.7, 2.15, P['dark'], (x, 3.62, 1.075))
        b.box(0.86, 0.04, 1.75, P['fridge_light'], (x, 3.92, 1.15))
        for z in (0.45, 0.9, 1.35, 1.8):
            b.box(0.86, 0.5, 0.03, P['shelf'], (x, 3.66, z))
            for q in range(5):
                m = P['bottle'][(k * 5 + q + int(z * 10)) % len(P['bottle'])]
                b.cyl(0.05, 0.05, 0.3, m, (x - 0.32 + q * 0.16, 3.6, z + 0.17), seg=8)
        b.box(0.04, 0.06, 1.95, P['chrome'], (x - 0.47, 3.26, 1.12))
        b.box(0.98, 0.06, 0.04, P['chrome'], (x, 3.26, 2.08))
        b.box(0.92, 0.05, 0.12, P['neon_blue'], (x, 3.27, 2.2))
        lights.append(((x, 3.0, 1.2), (0.7, 0.9, 1.0), 0.16, 1.4))
    # arcade cabinet (north-east corner)
    b.box(0.8, 0.8, 1.85, P['arcade'], (3.6, 3.3, 0.925))
    b.box(0.62, 0.06, 0.48, P['screen_purple'], (3.6, 2.88, 1.35), (0.25, 0, 0))
    b.box(0.8, 0.1, 0.22, P['neon_pink'], (3.6, 2.9, 1.78))
    b.box(0.7, 0.35, 0.08, P['dark'], (3.6, 2.82, 1.0), (0.4, 0, 0))
    lights.append(((3.6, 2.4, 1.4), (0.7, 0.4, 1.0), 0.2, 1.3))
    # ATM by the door (west wall)
    b.box(0.55, 0.6, 1.6, P['atm'], (-4.18, -3.0, 0.8))
    b.box(0.06, 0.4, 0.3, P['screen_cyan'], (-3.89, -3.0, 1.25))
    b.box(0.2, 0.3, 0.06, P['dark'], (-3.86, -3.0, 0.98), (0, 0.5, 0))
    # posters and a plant
    for k, m in enumerate((P['poster_a'], P['poster_b'], P['poster_c'])):
        b.box(0.04, 0.9, 1.2, m, (-4.47, -1.2 + k * 1.4, 1.9))
    b.cyl(0.22, 0.18, 0.45, P['dark'], (-4.0, 3.0, 0.225), seg=10)
    for k in range(5):
        a = k * 1.26
        b.sphere(0.24, P['leaf'], (-4.0 + math.cos(a) * 0.12, 3.0 + math.sin(a) * 0.12, 0.7 + k * 0.08), (1, 1, 1.3), u=8, v=6)
    # security camera with a red light
    b.box(0.2, 0.32, 0.14, P['dark'], (4.2, -3.7, 3.2), (0.3, 0, 0.7))
    b.sphere(0.03, P['led_red'], (4.1, -3.55, 3.15), u=6, v=4)
    # the entrance
    door_inside(b, P, 0.0, -D / 2, P['neon_green'], P['door_glass'])
    lights.append(((0, -3.3, 2.4), (0.6, 1.0, 0.75), 0.18, 1.5))
    bake_light(b.bm, lights, (0.2, 0.18, 0.25))
    set_sharp(b.bm, 50)
    ob = finish_room(b, 'room_shop')
    cols = wall_cols('room_shop', W, D, H) + [
        (2.65, -1.3, 0.55, 0.36, 1.95, 0.55), (3.55, 0.65, 0.5, 0.56, 0.1, 0.5), (4.25, -1.3, 1.2, 0.22, 1.95, 1.2),
        (-0.6, 0.1, 0.9, 0.36, 1.95, 0.9), (-2.7, 0.1, 0.9, 0.36, 1.95, 0.9), (-1.9, 3.62, 1.1, 2.5, 0.38, 1.1),
        (3.6, 3.3, 0.93, 0.42, 0.42, 0.93), (-4.18, -3.0, 0.8, 0.3, 0.32, 0.8), (-4.0, 3.0, 0.5, 0.3, 0.3, 0.5)]
    for k, c in enumerate(cols):
        marker(f'room_shop_col{k}', c[:3], c[3:])
    marker('room_shop_spawn', (0, -3.0, 0))
    marker('room_shop_exit', (0, -3.75, 0))
    marker('room_shop_clerk', (3.55, -1.1, 0))
    marker('room_shop_counter', (1.75, -1.1, 0))
    marker('room_shop_cash', (2.52, -0.55, 1.08))
    marker('room_shop_sign', (4.4, -1.3, 2.72))
    return ob


# ------------------------------------------------------------------ the flat
def flat(P):
    rnd = random.Random(11)
    b = Builder()
    W, D, H = 10.0, 9.0, 3.2
    wood = (P['wood_a'], P['wood_b'], P['wood_c'])
    room_shell(b, W, D, H, lambda i, j: wood[(j * 7 + (i // 6) * 3) % 3], P['fwall_lo'], P['fwall_hi'], P['fceil'],
               split=0.25, skip_east=True)
    # east wall with a big window (y 0.4 .. 3.8, z 0.9 .. 2.7)
    ex = W / 2
    wl = P['fwall_hi']
    grid(b, (ex, -D / 2, 0), (0, 0, 0.9), (0, D, 0), 2, 18, lambda i, j: wl)
    grid(b, (ex, -D / 2, 2.7), (0, 0, H - 2.7), (0, D, 0), 1, 18, lambda i, j: wl)
    grid(b, (ex, -D / 2, 0.9), (0, 0, 1.8), (0, 4.9, 0), 4, 10, lambda i, j: wl)
    grid(b, (ex, 3.8, 0.9), (0, 0, 1.8), (0, 0.7, 0), 4, 2, lambda i, j: wl)
    for (p, s) in (((ex, 2.1, 0.88), (0.25, 3.5, 0.08)), ((ex, 2.1, 2.72), (0.2, 3.5, 0.08)), ((ex, 0.38, 1.8), (0.2, 0.08, 1.9)),
                   ((ex, 3.82, 1.8), (0.2, 0.08, 1.9)), ((ex, 2.1, 1.8), (0.12, 0.06, 1.8))):
        b.box(*s, P['frame'], p)
    lights = [((ex + 2.0, 2.1, 2.2), (0.45, 0.55, 1.0), 0.45, 3.0)]  # moonlight through the window
    # ceiling lamp + neon coves
    b.cyl(0.45, 0.45, 0.06, P['lamp_warm'], (0.6, 0.2, H - 0.03), seg=20)
    lights.append(((0.6, 0.2, H - 0.35), (1.0, 0.86, 0.7), 0.55, 3.4))
    for (p0, p1) in (((-W / 2 + 0.05, -D / 2, H - 0.12), (-W / 2 + 0.05, D / 2, H - 0.12)),
                     ((-W / 2, D / 2 - 0.05, H - 0.12), (W / 2, D / 2 - 0.05, H - 0.12))):
        neon_line(b, p0, p1, 0.025, P['neon_purple'])
    for y in (-3.0, 0.0, 3.0):
        lights.append(((-W / 2 + 0.4, y, H - 0.3), (0.8, 0.4, 1.0), 0.1, 1.8))
    # kitchen along the west wall
    b.box(0.65, 3.8, 0.9, P['cabinet'], (-4.65, 0.7, 0.45))
    b.box(0.7, 3.85, 0.05, P['worktop'], (-4.63, 0.7, 0.92))
    b.box(0.4, 3.8, 0.7, P['cabinet'], (-4.78, 0.7, 2.0))
    b.box(0.42, 0.6, 0.04, P['dark'], (-4.6, -0.6, 0.95))
    for k in range(2):
        b.torus(0.12, 0.012, P['burner'], (-4.62, 0.45 + k * 0.35, 0.96), seg=14, rseg=3)
    b.box(0.8, 0.8, 2.0, P['fridge'], (-4.55, 3.4, 1.0))
    b.box(0.04, 0.3, 0.18, P['screen_cyan'], (-4.14, 3.4, 1.4))
    neon_line(b, (-4.3, -1.2, 1.6), (-4.3, 2.6, 1.6), 0.015, P['neon_cyan'])
    lights.append(((-4.0, 0.7, 2.3), (1.0, 0.9, 0.75), 0.3, 1.8))
    # island with stools
    b.box(0.9, 1.8, 0.92, P['cabinet'], (-2.9, 0.9, 0.46))
    b.box(1.0, 1.9, 0.05, P['worktop'], (-2.9, 0.9, 0.94))
    for y in (0.4, 1.4):
        b.cyl(0.2, 0.2, 0.06, P['stool'], (-2.1, y, 0.72), seg=12)
        b.cyl(0.04, 0.04, 0.7, P['dark'], (-2.1, y, 0.36), seg=6)
    # living room: sofa facing the TV on the north wall
    sx, sy = 0.8, -0.4
    b.box(2.6, 0.95, 0.42, P['sofa'], (sx, sy, 0.21), bevel=0.05)
    b.box(2.6, 0.25, 0.55, P['sofa'], (sx, sy - 0.48, 0.6), bevel=0.06)
    for s in (-1, 1):
        b.box(0.25, 0.95, 0.62, P['sofa'], (sx + s * 1.3, sy, 0.31), bevel=0.05)
    for k, m in enumerate((P['pillow_a'], P['pillow_b'], P['pillow_a'])):
        b.box(0.5, 0.18, 0.4, m, (sx - 0.8 + k * 0.8, sy - 0.28, 0.6), (0.2, 0, 0), bevel=0.06)
    b.box(3.2, 2.4, 0.02, P['rug'], (sx, 1.0, 0.012))
    b.box(3.0, 2.2, 0.022, P['rug_in'], (sx, 1.0, 0.014))
    b.box(1.3, 0.65, 0.06, P['glass_top'], (sx, 1.25, 0.42))
    b.box(1.2, 0.55, 0.36, P['dark'], (sx, 1.25, 0.2))
    neon_line(b, (sx - 0.66, 0.92, 0.45), (sx + 0.66, 0.92, 0.45), 0.012, P['neon_pink'])
    # TV wall
    b.box(2.3, 0.06, 1.3, P['dark'], (sx, D / 2 - 0.06, 1.55))
    b.box(2.15, 0.02, 1.18, P['tv'], (sx, D / 2 - 0.1, 1.55))
    b.box(2.0, 0.45, 0.45, P['cabinet'], (sx, D / 2 - 0.25, 0.225))
    neon_line(b, (sx - 1.0, D / 2 - 0.47, 0.05), (sx + 1.0, D / 2 - 0.47, 0.05), 0.012, P['neon_cyan'])
    lights.append(((sx, D / 2 - 0.8, 1.5), (0.4, 0.6, 1.0), 0.3, 2.2))
    # bed (head against the east wall) with a nightstand and a lamp
    b.box(2.2, 1.8, 0.35, P['bed_frame'], (3.85, -2.55, 0.175))
    b.box(2.1, 1.7, 0.2, P['mattress'], (3.85, -2.55, 0.45), bevel=0.05)
    b.box(1.3, 1.74, 0.08, P['blanket'], (3.3, -2.55, 0.58), bevel=0.03)
    for y in (-3.0, -2.1):
        b.box(0.4, 0.6, 0.16, P['mattress'], (4.6, y, 0.62), bevel=0.06)
    b.box(0.12, 1.9, 1.0, P['bed_frame'], (4.92, -2.55, 0.65))
    b.box(0.5, 0.5, 0.55, P['cabinet'], (4.65, -1.25, 0.275))
    b.cyl(0.05, 0.08, 0.3, P['dark'], (4.65, -1.25, 0.7), seg=8)
    b.sphere(0.14, P['lamp_warm'], (4.65, -1.25, 0.92), u=10, v=6)
    lights.append(((4.3, -1.3, 1.0), (1.0, 0.75, 0.45), 0.3, 1.6))
    # gaming desk (north-east corner)
    b.box(1.7, 0.75, 0.05, P['desk'], (3.6, 3.95, 0.76))
    for s in (-1, 1):
        b.box(0.06, 0.7, 0.76, P['dark'], (3.6 + s * 0.8, 3.95, 0.38))
    for k, m in enumerate((P['screen_cyan'], P['screen_pink'])):
        b.box(0.62, 0.04, 0.38, P['dark'], (3.25 + k * 0.7, 4.22, 1.1), (0, 0, (k - 0.5) * 0.3))
        b.box(0.56, 0.02, 0.32, m, (3.25 + k * 0.7, 4.19, 1.1), (0, 0, (k - 0.5) * 0.3))
    neon_line(b, (2.8, 3.6, 0.72), (4.4, 3.6, 0.72), 0.012, P['neon_purple'])
    b.cyl(0.28, 0.28, 0.08, P['chair'], (3.6, 3.2, 0.48), seg=12)
    b.box(0.5, 0.08, 0.6, P['chair'], (3.6, 2.92, 0.82))
    lights.append(((3.6, 3.4, 1.2), (0.6, 0.6, 1.0), 0.25, 1.5))
    # plants and a bookshelf by the door
    for (px, py) in ((-4.4, -3.9), (2.0, 4.1)):
        b.cyl(0.2, 0.16, 0.42, P['pot'], (px, py, 0.21), seg=10)
        for k in range(5):
            a = k * 1.26
            b.sphere(0.22, P['leaf'], (px + math.cos(a) * 0.1, py + math.sin(a) * 0.1, 0.62 + k * 0.08), (1, 1, 1.3), u=8, v=6)
    b.box(0.35, 1.2, 1.9, P['cabinet'], (-4.8, -2.6, 0.95))
    for z in (0.5, 0.95, 1.4):
        x0 = -3.2
        y = -3.1
        while y < -2.1:
            w = rnd.uniform(0.04, 0.09)
            b.box(0.25, w, rnd.uniform(0.25, 0.36), rnd.choice(P['prod']), (-4.75, y + w / 2, z + 0.16))
            y += w + 0.01
        _ = x0
    # the entrance (south wall, x = -3.3)
    door_inside(b, P, -3.3, -D / 2, P['neon_warm'], P['door_metal'])
    lights.append(((-3.3, -3.6, 2.6), (1.0, 0.85, 0.65), 0.25, 1.8))
    bake_light(b.bm, lights, (0.2, 0.17, 0.24))
    set_sharp(b.bm, 50)
    ob = finish_room(b, 'room_flat')
    cols = wall_cols('room_flat', W, D, H) + [
        (-4.65, 0.7, 0.5, 0.36, 1.95, 0.5), (-4.55, 3.4, 1.0, 0.42, 0.42, 1.0), (-2.9, 0.9, 0.5, 0.48, 0.95, 0.5),
        (sx, sy - 0.1, 0.4, 1.45, 0.58, 0.4), (sx, 1.25, 0.22, 0.65, 0.33, 0.22), (sx, D / 2 - 0.25, 0.25, 1.0, 0.25, 0.25),
        (3.85, -2.55, 0.35, 1.1, 0.92, 0.35), (4.65, -1.25, 0.3, 0.27, 0.27, 0.3), (3.6, 3.95, 0.4, 0.85, 0.38, 0.4),
        (-4.8, -2.6, 0.95, 0.2, 0.62, 0.95)]
    for k, c in enumerate(cols):
        marker(f'room_flat_col{k}', c[:3], c[3:])
    marker('room_flat_spawn', (-3.3, -3.4, 0))
    marker('room_flat_exit', (-3.3, -3.75, 0))
    marker('room_flat_bed', (2.75, -2.4, 0))
    marker('room_flat_tv', (sx, D / 2 - 0.115, 1.55), props={'w': 2.12, 'h': 1.15})
    marker('room_flat_view', (W / 2, 2.1, 1.8))
    for k, p in enumerate(((sx, 1.25, 0.45), (-4.6, 1.8, 0.95), (3.9, 3.85, 0.79), (-2.9, 1.4, 0.97))):
        marker(f'room_flat_loot{k}', p)
    return ob


def finish_room(b, name):
    me = bpy.data.meshes.new(name)
    b.bm.to_mesh(me)
    b.bm.free()
    for m in b.mats:
        me.materials.append(m)
    me.color_attributes.active_color = me.color_attributes['Col']
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def pal():
    prod = ['#e23a4a', '#2a8ae0', '#f2c21a', '#3ac05a', '#ff7a2a', '#9a4ae0', '#e8e8ee', '#2ad0c0', '#ff4ab0', '#5a6070']
    bottle = ['#ff3a6a', '#3ad0ff', '#ffd23a', '#7aff5a', '#b06aff', '#ff8a3a']
    return dict(
        tile_a=mat('tile_a', '#c9ccd8', 0.1, 0.4), tile_b=mat('tile_b', '#3a3d4c', 0.1, 0.4),
        wall_lo=mat('wall_lo', '#4a3760', 0.1, 0.6), wall_hi=mat('wall_hi', '#d9d4e4', 0.0, 0.7), ceil=mat('ceil', '#2a2c36', 0.0, 0.8),
        lamp=mat('lamp', emit='#f2f6ff', strength=4), exit=mat('exit_sign', emit='#3aff9a'), mat_rug=mat('door_mat', '#1a1c24', 0, 0.9),
        neon_pink=mat('neon_pink', emit='#ff2bd6'), neon_cyan=mat('neon_cyan', emit='#29f3ff'), neon_green=mat('neon_green', emit='#3aff9a'),
        neon_blue=mat('neon_blue', emit='#4aa0ff'), neon_purple=mat('neon_purple', emit='#8a4dff'), neon_warm=mat('neon_warm', emit='#ffc46a'),
        counter=mat('counter', '#1d2130', 0.3, 0.5), counter_top=mat('counter_top', '#c9ccd8', 0.6, 0.25), dark=mat('dark', '#16171d', 0.3, 0.6),
        screen_green=mat('screen_green', emit='#3aff9a'), screen_purple=mat('screen_purple', emit='#a06aff'), screen_cyan=mat('screen_cyan', emit='#29f3ff'),
        screen_pink=mat('screen_pink', emit='#ff2bd6'), shelf=mat('shelf', '#8a90a0', 0.6, 0.35), shelf_back=mat('shelf_back', '#2a2e3a', 0.2, 0.6),
        fridge_light=mat('fridge_light', emit='#cdeeff', strength=2), chrome=mat('chrome', '#c9d2df', 1.0, 0.15),
        arcade=mat('arcade', '#2a1040', 0.3, 0.5), atm=mat('atm', '#30364a', 0.5, 0.4),
        poster_a=mat('poster_a', emit='#ff2bd6', strength=1.2), poster_b=mat('poster_b', emit='#ffa43a', strength=1.2), poster_c=mat('poster_c', emit='#29f3ff', strength=1.2),
        leaf=mat('leaf', '#2f8a4a', 0.0, 0.7), led_red=mat('led_red', emit='#ff1030'), door_glass=mat('door_glass', '#1c5a52', 0.6, 0.2),
        door_metal=mat('door_metal', '#30364a', 0.6, 0.4),
        prod=[mat(f'prod{k}', c, 0.2, 0.5) for k, c in enumerate(prod)], bottle=[mat(f'bottle{k}', c, 0.3, 0.3) for k, c in enumerate(bottle)],
        wood_a=mat('wood_a', '#7a5438', 0.0, 0.6), wood_b=mat('wood_b', '#6a4a32', 0.0, 0.6), wood_c=mat('wood_c', '#845c3e', 0.0, 0.6),
        fwall_lo=mat('fwall_lo', '#e6e2ea', 0.0, 0.7), fwall_hi=mat('fwall_hi', '#c9cddc', 0.0, 0.7), fceil=mat('fceil', '#e2e3ea', 0.0, 0.8),
        frame=mat('window_frame', '#1a1c24', 0.5, 0.4), lamp_warm=mat('lamp_warm', emit='#ffd9a0', strength=3),
        cabinet=mat('cabinet', '#2c3140', 0.3, 0.5), worktop=mat('worktop', '#e8e8ee', 0.4, 0.3), burner=mat('burner', emit='#ff6a1a'),
        fridge=mat('fridge', '#d0d4de', 0.6, 0.3), stool=mat('stool', '#ff2bd6', 0.3, 0.4), sofa=mat('sofa', '#4a3a8a', 0.0, 0.8),
        pillow_a=mat('pillow_a', '#ff4ab0', 0.0, 0.8), pillow_b=mat('pillow_b', '#29c3d6', 0.0, 0.8), rug=mat('rug', '#8a4dff', 0.0, 0.9),
        rug_in=mat('rug_in', '#2a2040', 0.0, 0.9), glass_top=mat('glass_top', '#101826', 0.8, 0.1), tv=mat('tv', emit='#1a3a8a', strength=1.5),
        bed_frame=mat('bed_frame', '#2a2a35', 0.3, 0.5), mattress=mat('mattress', '#e8e8f0', 0.0, 0.8), blanket=mat('blanket', '#2a6a8a', 0.0, 0.8),
        desk=mat('desk', '#1a1c24', 0.4, 0.4), chair=mat('chair', '#c01848', 0.2, 0.5), pot=mat('pot', '#d9d4e4', 0.1, 0.6),
    )


def build_all():
    P = pal()
    objs = [shop(P), flat(P)]
    for ob in objs:
        print(f'  {ob.name}: {tri_count(ob)} triangles')
    return objs


def previews(objs, out):
    import os
    from lib import render
    shop_ob = [o for o in objs if o.name == 'room_shop']
    flat_ob = [o for o in objs if o.name == 'room_flat']
    # look in through the missing ceiling: hide the ceiling by rendering from inside, high up
    render(shop_ob, os.path.join(out, 'room_shop.png'), cam=(-3.8, -3.6, 2.6), target=(1.5, 1.5, 1.0), lens=18, res=(960, 560), floor=False)
    render(flat_ob, os.path.join(out, 'room_flat.png'), cam=(-4.2, -3.9, 2.4), target=(2.0, 1.5, 0.9), lens=18, res=(960, 560), floor=False)
