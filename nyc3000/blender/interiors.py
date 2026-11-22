"""NYC 3000 interiors modelled in Blender: six kinds of shop and four kinds of flat.

Shops: corner mart, ramen bar, diner, cyber bar, bank (with a vault) and arcade.
Flats: studio, penthouse (glass walls and a hot tub), gamer den and brick loft.

Lighting is baked into the vertex colours (ambient occlusion plus point lights with
ray-traced shadows), so the game draws the rooms unlit and cheap. Each room is an
object named room_<kind>_<type> with markers (empties) named room_<kind>_<type>__<key>:
spawn, exit, clerk, counter, cash, sign, bed, tv, view<n>, loot<n> and col<n>
(collision boxes: location = centre, scale = half size). Marker custom properties
carry facing (yaw for people, rot for signs and screens) and sizes.
Blender axes: +Y = north (the game's -Z), +Z = up. Every entrance is in the south wall.
"""
import math
import random
import bmesh
import bpy
from mathutils import Vector as V
from mathutils.bvhtree import BVHTree
from lib import mat, Builder, marker, bm_box, bm_cyl, bm_sphere, bm_lathe, bm_torus, bm_from_mods, T, hemi_dirs, set_sharp, tri_count


def grid(b, origin, u, v, nu, nv, mfn, skip=None):
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
            if skip and skip(i, j):
                continue
            f = bm.faces.new([vs[i][j], vs[i + 1][j], vs[i + 1][j + 1], vs[i][j + 1]])
            f.material_index = b.mi(mfn(i, j))
            f.smooth = False


def bake_light(bm, lights, ambient, ao_dist=0.9, rays=14, floor=0.35):
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


class Room:
    """A room seen from inside, its furniture, lights, markers and collision boxes."""

    def __init__(self, name, W, D, H):
        self.name, self.W, self.D, self.H = name, W, D, H
        self.b = Builder()
        self.lights, self.marks, self.cols, self.props = [], {}, [], {}

    # --- shell
    def floor(self, mfn, cell=0.5):
        W, D = self.W, self.D
        nx, ny = round(W / cell), round(D / cell)
        grid(self.b, (-W / 2, -D / 2, 0), (W, 0, 0), (0, D, 0), nx, ny,
             lambda i, j: mfn(-W / 2 + (i + 0.5) * W / nx, -D / 2 + (j + 0.5) * D / ny))

    def ceiling(self, m, cell=1.0):
        W, D, H = self.W, self.D, self.H
        grid(self.b, (-W / 2, -D / 2, H), (0, D, 0), (W, 0, 0), max(1, round(D / cell)), max(1, round(W / cell)), lambda i, j: m)

    def wall(self, side, mfn, cell=0.5, holes=()):
        """mfn(h, z) -> material, h = position along the wall (x for N/S, y for E/W). holes = [(h0, h1, z0, z1)]."""
        W, D, H = self.W, self.D, self.H
        L = W if side in 'NS' else D
        nh, nv = max(1, round(L / cell)), max(1, round(H / cell))
        info = lambda ih, iv: (-L / 2 + (ih + 0.5) * L / nh, (iv + 0.5) * H / nv)
        inhole = lambda h, z: any(a <= h <= b2 and c <= z <= d for (a, b2, c, d) in holes)
        if side == 'N':
            grid(self.b, (-W / 2, D / 2, 0), (W, 0, 0), (0, 0, H), nh, nv, lambda i, j: mfn(*info(i, j)), lambda i, j: inhole(*info(i, j)))
        elif side == 'S':
            grid(self.b, (-W / 2, -D / 2, 0), (0, 0, H), (W, 0, 0), nv, nh, lambda i, j: mfn(*info(j, i)), lambda i, j: inhole(*info(j, i)))
        elif side == 'W':
            grid(self.b, (-W / 2, -D / 2, 0), (0, D, 0), (0, 0, H), nh, nv, lambda i, j: mfn(*info(i, j)), lambda i, j: inhole(*info(i, j)))
        else:
            grid(self.b, (W / 2, -D / 2, 0), (0, 0, H), (0, D, 0), nv, nh, lambda i, j: mfn(*info(j, i)), lambda i, j: inhole(*info(j, i)))

    def walls(self, mfn, cell=0.5, holes=None):
        for side in 'NSWE':
            self.wall(side, mfn, cell, (holes or {}).get(side, ()))

    # --- parts
    def box(self, *a, **k):
        return self.b.box(*a, **k)

    def cyl(self, *a, **k):
        return self.b.cyl(*a, **k)

    def sphere(self, *a, **k):
        return self.b.sphere(*a, **k)

    def torus(self, *a, **k):
        return self.b.torus(*a, **k)

    def lathe(self, *a, **k):
        return self.b.lathe(*a, **k)

    def line(self, p0, p1, r, m):
        a, c = V(p0), V(p1)
        d = c - a
        self.b.add(bm_box(r * 2, r * 2, d.length), m,
                   T((a + c) / 2) @ V((0, 0, 1)).rotation_difference(d.normalized()).to_matrix().to_4x4())

    def light(self, pos, col, power, radius):
        self.lights.append((pos, col, power, radius))

    def col(self, x0, x1, y0, y1, z0=0.0, z1=None, low=False):
        z1 = self.H if z1 is None else z1
        self.cols.append(((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, abs(x1 - x0) / 2, abs(y1 - y0) / 2, abs(z1 - z0) / 2, low))

    def mark(self, key, pos, **props):
        self.marks[key] = (pos, props)

    @staticmethod
    def facing(fx, fy):
        """Game yaw for a person / rotation for a plane that faces Blender direction (fx, fy)."""
        return dict(yaw=math.atan2(-fx, fy), rot=math.atan2(fx, -fy))

    def door(self, x, P, frame_m, leaf_m, W=1.7):
        """The entrance in the south wall, seen from inside, plus the spawn and exit markers."""
        y = -self.D / 2
        self.box(W, 0.08, 2.6, leaf_m, (x, y + 0.04, 1.3))
        for s in (-1, 1):
            self.box(0.12, 0.12, 2.66, frame_m, (x + s * (W / 2 + 0.06), y + 0.06, 1.33))
        self.box(W + 0.24, 0.12, 0.12, frame_m, (x, y + 0.06, 2.66))
        self.box(0.6, 0.06, 0.2, P['exit'], (x, y + 0.06, 3.0))
        self.box(1.4, 0.9, 0.02, P['door_mat'], (x, y + 0.6, 0.012))
        self.mark('spawn', (x, y + 0.9, 0))
        self.mark('exit', (x, y + 0.4, 0))
        self.light((x, y + 0.7, 2.4), (1.0, 0.9, 0.75), 0.18, 1.5)

    def plant(self, P, x, y, s=1.0, pot=None):
        self.cyl(0.22 * s, 0.17 * s, 0.45 * s, pot or P['pot'], (x, y, 0.225 * s), seg=10)
        for k in range(5):
            a = k * 1.26
            self.sphere(0.24 * s, P['leaf'], (x + math.cos(a) * 0.12 * s, y + math.sin(a) * 0.12 * s, (0.7 + k * 0.08) * s), (1, 1, 1.3), u=8, v=6)
        self.col(x - 0.3 * s, x + 0.3 * s, y - 0.3 * s, y + 0.3 * s, 0, 1.0 * s)

    def stool(self, m, x, y, h=0.72):
        self.cyl(0.2, 0.2, 0.06, m, (x, y, h), seg=12)
        self.cyl(0.035, 0.035, h, self.P['chrome'], (x, y, h / 2), seg=6)
        self.cyl(0.18, 0.2, 0.03, self.P['chrome'], (x, y, 0.015), seg=10)

    def products(self, rnd, mats, x, y0, y1, z, depth=0.22, side=0.0, cyl_chance=0.3):
        y = y0
        while y < y1:
            w = rnd.uniform(0.12, 0.28)
            h = rnd.uniform(0.18, 0.34)
            m = rnd.choice(mats)
            if rnd.random() < cyl_chance:
                self.cyl(w * 0.35, w * 0.35, h, m, (x + side, y + w / 2, z + h / 2), seg=8)
            else:
                self.box(depth, w, h, m, (x + side, y + w / 2, z + h / 2))
            y += w + 0.03

    # --- finishing
    def finish(self, ambient):
        W, D, H = self.W, self.D, self.H
        bake_light(self.b.bm, self.lights, ambient)
        set_sharp(self.b.bm, 50)
        me = bpy.data.meshes.new(self.name)
        self.b.bm.to_mesh(me)
        self.b.bm.free()
        for m in self.b.mats:
            me.materials.append(m)
        me.color_attributes.active_color = me.color_attributes['Col']
        ob = bpy.data.objects.new(self.name, me)
        bpy.context.scene.collection.objects.link(ob)
        for k, v in self.props.items():
            ob[k] = v
        walls = [(-W / 2 - 0.1, 0, H / 2, 0.1, D / 2 + 0.2, H / 2, False), (W / 2 + 0.1, 0, H / 2, 0.1, D / 2 + 0.2, H / 2, False),
                 (0, D / 2 + 0.1, H / 2, W / 2 + 0.2, 0.1, H / 2, False), (0, -D / 2 - 0.1, H / 2, W / 2 + 0.2, 0.1, H / 2, False),
                 (0, 0, H + 0.1, W / 2 + 0.2, D / 2 + 0.2, 0.1, False)]
        for k, (x, y, z, hx, hy, hz, low) in enumerate(walls + self.cols):
            marker(f'{self.name}__col{k}', (x, y, z), (hx, hy, hz), {'low': 1} if low else None)
        for key, (pos, props) in self.marks.items():
            marker(f'{self.name}__{key}', pos, props=props)
        return ob


# ================================================================== SHOPS
def counter_shop(r, P, x0, x1, y0, y1, h, body_m, top_m, glow_m):
    """A counter block with a top slab and a neon kick strip on the customer (west or south) side."""
    r.box(x1 - x0, y1 - y0, h, body_m, ((x0 + x1) / 2, (y0 + y1) / 2, h / 2))
    r.box(x1 - x0 + 0.1, y1 - y0 + 0.1, 0.05, top_m, ((x0 + x1) / 2, (y0 + y1) / 2, h + 0.025))
    r.col(x0, x1, y0, y1, 0, h + 0.05)


def shop_mart(P):
    rnd = random.Random(7)
    r = Room('room_shop_mart', 9.0, 8.0, 3.4)
    r.P = P
    W, D, H = r.W, r.D, r.H
    r.floor(lambda x, y: P['tile_a'] if (int((x + 10) * 2) + int((y + 10) * 2)) % 2 else P['tile_b'])
    r.walls(lambda h, z: P['wall_lo'] if z < 1.1 else P['wall_hi'])
    r.ceiling(P['ceil'])
    for y in (-2.4, 0.2, 2.6):
        r.box(7.6, 0.36, 0.06, P['lamp'], (0, y, H - 0.04))
        for x in (-3.0, -1.0, 1.0, 3.0):
            r.light((x, y, H - 0.3), (1.0, 1.0, 1.05), 0.34, 3.2)
    for (p0, p1) in (((-W / 2 + 0.03, -D / 2, 2.75), (-W / 2 + 0.03, D / 2, 2.75)), ((W / 2 - 0.03, -D / 2, 2.75), (W / 2 - 0.03, D / 2, 2.75)),
                     ((-W / 2, D / 2 - 0.03, 2.75), (W / 2, D / 2 - 0.03, 2.75))):
        r.line(p0, p1, 0.025, P['neon_pink'])
    counter_shop(r, P, 2.3, 3.0, -3.2, 0.6, 1.0, P['counter'], P['counter_top'], P['neon_cyan'])
    r.line((2.28, -3.2, 0.12), (2.28, 0.6, 0.12), 0.02, P['neon_cyan'])
    r.box(0.42, 0.38, 0.12, P['dark'], (2.65, -1.1, 1.1))
    r.box(0.08, 0.34, 0.24, P['screen_green'], (2.48, -1.1, 1.28), (0, -0.35, 0))
    for k in range(6):
        r.box(0.12, 0.08, 0.16, P['prod'][k % len(P['prod'])], (2.5 + (k % 2) * 0.14, -2.6 + (k // 2) * 0.1, 1.13))
    r.box(0.5, 0.55, 0.32, P['dark'], (2.65, 0.15, 1.2))
    for k, m in enumerate((P['neon_cyan'], P['neon_pink'])):
        r.cyl(0.11, 0.11, 0.38, m, (2.65, 0.0 + k * 0.28, 1.55), seg=10)
    r.box(1.1, 0.08, 0.95, P['counter'], (3.55, 0.65, 0.48))
    r.col(3.0, 4.1, 0.57, 0.73, 0, 1.0)
    for z in (1.2, 1.65, 2.1):
        r.box(0.4, 3.8, 0.06, P['shelf'], (4.25, -1.3, z))
        r.products(rnd, P['prod'], 4.22, -3.1, 0.5, z + 0.03, cyl_chance=0)
    r.box(0.08, 3.8, 1.4, P['dark'], (4.46, -1.3, 1.6))
    r.col(4.05, 4.5, -3.2, 0.6, 0, 2.4)
    r.light((3.6, -1.3, 2.4), (1.0, 0.95, 0.85), 0.25, 1.6)
    for ax in (-0.6, -2.7):
        r.box(0.12, 3.8, 1.75, P['shelf_back'], (ax, 0.1, 0.875))
        r.box(0.7, 3.8, 0.12, P['shelf'], (ax, 0.1, 0.06))
        for yy in (-1.8, 2.0):
            r.box(0.7, 0.06, 1.8, P['shelf'], (ax, yy, 0.9))
        for z in (0.12, 0.55, 0.98, 1.41):
            r.box(0.68, 3.8, 0.04, P['shelf'], (ax, 0.1, z))
            for side in (-0.21, 0.21):
                r.products(rnd, P['prod'], ax, -1.7, 1.9, z + 0.02, side=side)
        r.box(0.04, 3.7, 0.08, P['neon_green'], (ax, 0.1, 1.86))
        r.col(ax - 0.36, ax + 0.36, -1.85, 2.05, 0, 1.8)
    for k in range(5):
        x = -4.0 + k * 1.0
        r.box(0.98, 0.7, 2.15, P['dark'], (x, 3.62, 1.075))
        r.box(0.86, 0.04, 1.75, P['fridge_light'], (x, 3.92, 1.15))
        for z in (0.45, 0.9, 1.35, 1.8):
            r.box(0.86, 0.5, 0.03, P['shelf'], (x, 3.66, z))
            for q in range(5):
                r.cyl(0.05, 0.05, 0.3, P['bottle'][(k * 5 + q + int(z * 10)) % len(P['bottle'])], (x - 0.32 + q * 0.16, 3.6, z + 0.17), seg=8)
        r.box(0.04, 0.06, 1.95, P['chrome'], (x - 0.47, 3.26, 1.12))
        r.box(0.98, 0.06, 0.04, P['chrome'], (x, 3.26, 2.08))
        r.box(0.92, 0.05, 0.12, P['neon_blue'], (x, 3.27, 2.2))
        r.light((x, 3.0, 1.2), (0.7, 0.9, 1.0), 0.16, 1.4)
    r.col(-4.55, 0.55, 3.25, 4.0, 0, 2.2)
    r.box(0.8, 0.8, 1.85, P['arcade'], (3.6, 3.3, 0.925))
    r.box(0.62, 0.06, 0.48, P['screen_purple'], (3.6, 2.88, 1.35), (0.25, 0, 0))
    r.box(0.8, 0.1, 0.22, P['neon_pink'], (3.6, 2.9, 1.78))
    r.col(3.2, 4.0, 2.88, 3.72, 0, 1.9)
    r.light((3.6, 2.4, 1.4), (0.7, 0.4, 1.0), 0.2, 1.3)
    r.box(0.55, 0.6, 1.6, P['atm'], (-4.18, -3.0, 0.8))
    r.box(0.06, 0.4, 0.3, P['screen_cyan'], (-3.89, -3.0, 1.25))
    r.col(-4.5, -3.88, -3.32, -2.68, 0, 1.6)
    for k, m in enumerate((P['poster_a'], P['poster_b'], P['poster_c'])):
        r.box(0.04, 0.9, 1.2, m, (-4.47, -1.2 + k * 1.4, 1.9))
    r.plant(P, -4.0, 3.0)
    r.box(0.2, 0.32, 0.14, P['dark'], (4.2, -3.7, 3.2), (0.3, 0, 0.7))
    r.sphere(0.03, P['led_red'], (4.1, -3.55, 3.15), u=6, v=4)
    r.door(0.0, P, P['neon_green'], P['door_glass'])
    r.mark('clerk', (3.55, -1.1, 0), **Room.facing(-1, 0))
    r.mark('counter', (1.75, -1.1, 0))
    r.mark('cash', (2.52, -0.55, 1.08))
    r.mark('sign', (4.4, -1.3, 2.72), w=2.5, h=0.62, **Room.facing(-1, 0))
    r.props = dict(payout_min=150, payout_max=500, stars=2, sells=1)
    return r.finish((0.2, 0.18, 0.25))


def shop_ramen(P):
    rnd = random.Random(21)
    r = Room('room_shop_ramen', 10.0, 7.0, 3.3)
    r.P = P
    W, D, H = r.W, r.D, r.H
    dw = (P['wood_d1'], P['wood_d2'], P['wood_d3'])
    r.floor(lambda x, y: dw[(int((y + 10) * 4) * 7 + int((x + 10) / 1.5)) % 3])
    r.walls(lambda h, z: P['dark_wood'] if z < 1.1 else (P['red_band'] if 2.25 < z < 2.5 else P['cream']))
    r.ceiling(P['ceil_wood'])
    # bar counter with stools
    counter_shop(r, P, -4.0, 3.2, 0.3, 0.9, 1.05, P['dark_wood'], P['light_wood'], None)
    r.line((-4.0, 0.27, 0.95), (3.2, 0.27, 0.95), 0.02, P['neon_orange'])
    for k in range(7):
        r.stool(P['red_seat'], -3.5 + k * 1.0, -0.25)
    r.sphere(0.09, P['white_ceramic'], (2.6, 0.55, 1.18), (1, 1, 1.1), u=10, v=8)  # lucky cat
    r.sphere(0.07, P['white_ceramic'], (2.6, 0.55, 1.33), u=10, v=8)
    r.box(0.03, 0.03, 0.12, P['white_ceramic'], (2.68, 0.52, 1.4), (0, 0.3, 0))
    r.cyl(0.035, 0.035, 0.01, P['gold_m'], (2.6, 0.47, 1.18), (math.pi / 2, 0, 0), seg=10)
    for k in range(5):  # bowls and chopsticks on the counter
        x = -3.4 + k * 1.4
        r.lathe([(0.0, 0.0), (0.09, 0.0), (0.13, 0.07), (0.14, 0.09)], P['white_ceramic'], (x, 0.55, 1.08), seg=12)
        r.box(0.02, 0.22, 0.01, P['light_wood'], (x + 0.18, 0.55, 1.09))
    # kitchen along the north wall
    r.box(9.2, 0.8, 0.95, P['steel'], (0, 3.0, 0.475))
    r.col(-4.6, 4.6, 2.6, 3.5, 0, 1.0)
    for k, x in enumerate((-2.6, -1.5, -0.4)):
        r.torus(0.22, 0.025, P['burner'], (x, 3.0, 0.97), seg=16, rseg=3)
        r.lathe([(0.0, 0.0), (0.3, 0.0), (0.31, 0.45), (0.33, 0.47)], P['steel_dark'], (x, 3.0, 0.98), seg=16)
        for q in range(2):
            r.sphere(0.16 + q * 0.04, P['steam'], (x + (q - 0.5) * 0.12, 3.0, 1.6 + q * 0.28), (1, 1, 0.8), u=8, v=6)
        r.light((x, 2.6, 1.3), (1.0, 0.55, 0.25), 0.18, 1.2)
    for x in (1.0, 1.6, 2.2, 2.8):
        r.lathe([(0.0, 0.0), (0.1, 0.0), (0.15, 0.08)], P['white_ceramic'], (x, 2.9, 0.96), seg=12)
    r.box(0.9, 0.8, 2.0, P['steel'], (4.15, 3.0, 1.0))
    r.col(3.7, 4.6, 2.6, 3.4, 0, 2.0)
    for k in range(5):
        r.box(0.04, 0.02, 0.4, P['steel_dark'], (-3.6 + k * 0.25, 3.42, 1.6))
    # menu boards and hanging lanterns
    for k, m in enumerate((P['menu_yellow'], P['menu_white'], P['menu_yellow'], P['menu_red'])):
        r.box(1.2, 0.04, 0.6, m, (-3.0 + k * 1.6, D / 2 - 0.04, 2.0))
    r.light((0, 2.4, 2.2), (1.0, 0.85, 0.6), 0.25, 2.5)
    for k in range(5):
        x = -3.4 + k * 1.55
        r.line((x, 0.6, H), (x, 0.6, 2.75), 0.008, P['dark'])
        r.sphere(0.2, P['lantern'], (x, 0.6, 2.55), (1, 1, 1.25), u=12, v=8)
        r.cyl(0.12, 0.12, 0.05, P['dark'], (x, 0.6, 2.82), seg=10)
        r.cyl(0.12, 0.12, 0.05, P['dark'], (x, 0.6, 2.29), seg=10)
        r.light((x, 0.3, 2.3), (1.0, 0.45, 0.25), 0.36, 2.2)
    # small tables by the window side, a bamboo plant
    for tx in (1.4, 3.6):
        r.box(0.8, 0.8, 0.05, P['light_wood'], (tx, -2.2, 0.74))
        r.cyl(0.05, 0.05, 0.72, P['dark'], (tx, -2.2, 0.36), seg=6)
        for s in (-1, 1):
            r.stool(P['red_seat'], tx + s * 0.75, -2.2, 0.48)
        r.col(tx - 0.45, tx + 0.45, -2.65, -1.75, 0, 0.8)
        r.light((tx, -2.2, 2.6), (1.0, 0.75, 0.5), 0.2, 1.6)
    r.cyl(0.25, 0.2, 0.5, P['dark_wood'], (-4.3, -2.9, 0.25), seg=10)
    for k in range(5):
        r.cyl(0.03, 0.03, 1.6 + k * 0.2, P['bamboo'], (-4.3 + (k % 3 - 1) * 0.08, -2.9 + (k // 3 - 0.5) * 0.1, 0.8 + k * 0.1), seg=6)
    r.col(-4.6, -4.0, -3.2, -2.6, 0, 1.6)
    r.door(-2.5, P, P['neon_orange'], P['door_glass'])
    for k in range(3):  # noren curtain over the door
        r.box(0.5, 0.03, 0.55, P['noren'], (-3.1 + k * 0.6, -D / 2 + 0.1, 2.3))
    r.mark('clerk', (0.3, 1.7, 0), **Room.facing(0, -1))
    r.mark('counter', (0.3, -0.5, 0))
    r.mark('cash', (0.3, 0.6, 1.12))
    r.mark('sign', (0.3, D / 2 - 0.03, 2.82), w=2.6, h=0.6, **Room.facing(0, -1))
    r.props = dict(payout_min=100, payout_max=350, stars=2, sells=1)
    return r.finish((0.22, 0.17, 0.16))


def shop_diner(P):
    r = Room('room_shop_diner', 10.0, 8.0, 3.4)
    r.P = P
    W, D, H = r.W, r.D, r.H
    r.floor(lambda x, y: P['diner_red'] if (int((x + 10) * 2) + int((y + 10) * 2)) % 2 else P['diner_cream'])
    r.walls(lambda h, z: P['teal'] if z < 1.1 else (P['chrome'] if z < 1.25 else P['cream']))
    r.ceiling(P['ceil'])
    # booths along the west wall
    for by in (-2.0, 0.4, 2.8):
        r.box(1.3, 0.75, 0.05, P['counter_top'], (-4.2, by, 0.76))
        r.cyl(0.07, 0.07, 0.74, P['chrome'], (-4.2, by, 0.37), seg=8)
        for s in (-1, 1):
            r.box(1.3, 0.5, 0.45, P['red_seat'], (-4.2, by + s * 0.75, 0.225), bevel=0.05)
            r.box(1.3, 0.18, 0.6, P['red_seat'], (-4.2, by + s * 1.0, 0.75), bevel=0.05)
        r.sphere(0.18, P['lamp_warm'], (-4.2, by, 2.7), (1, 1, 0.7), u=10, v=6)
        r.line((-4.2, by, H), (-4.2, by, 2.8), 0.01, P['dark'])
        r.light((-4.2, by, 2.4), (1.0, 0.8, 0.55), 0.35, 1.8)
        r.col(-4.95, -3.45, by - 1.15, by + 1.15, 0, 1.1)
        for k in range(2):  # plates and a drink
            r.cyl(0.13, 0.13, 0.02, P['white_ceramic'], (-4.45 + k * 0.5, by + (k - 0.5) * 0.25, 0.8), seg=12)
        r.cyl(0.04, 0.04, 0.16, P['bottle'][int(by + 3) % len(P['bottle'])], (-3.85, by + 0.2, 0.86), seg=8)
    # serving counter (east) with the kitchen line behind it
    counter_shop(r, P, 2.4, 3.1, -2.8, 1.8, 1.05, P['red_seat'], P['counter_top'], None)
    r.line((2.38, -2.8, 0.15), (2.38, 1.8, 0.15), 0.02, P['neon_pink'])
    r.line((2.38, -2.8, 0.98), (2.38, 1.8, 0.98), 0.015, P['chrome'])
    r.box(0.42, 0.38, 0.12, P['dark'], (2.75, -0.5, 1.13))
    r.box(0.08, 0.34, 0.24, P['screen_green'], (2.58, -0.5, 1.31), (0, -0.35, 0))
    for k in range(3):  # heat lamps over the pass
        y = -2.0 + k * 1.4
        r.cyl(0.14, 0.08, 0.2, P['steel_dark'], (2.75, y, 2.1), seg=10)
        r.cyl(0.12, 0.12, 0.02, P['burner'], (2.75, y, 1.99), seg=10)
        r.line((2.75, y, H), (2.75, y, 2.2), 0.008, P['dark'])
        r.light((2.75, y, 1.8), (1.0, 0.55, 0.25), 0.22, 1.2)
    r.box(0.9, 7.0, 0.95, P['steel'], (4.5, 0.2, 0.475))
    r.col(4.05, 5.0, -3.3, 3.7, 0, 1.0)
    r.lathe([(0.0, 0.0), (0.75, 0.0), (0.72, 0.45), (0.5, 0.8), (0.0, 0.95)], P['brick_oven'], (4.4, 2.6, 0.95), seg=16)
    r.box(0.06, 0.55, 0.35, P['burner'], (3.68, 2.6, 1.15))
    r.light((3.4, 2.6, 1.2), (1.0, 0.45, 0.15), 0.3, 1.4)
    r.box(0.6, 0.8, 0.45, P['dark'], (4.5, -2.4, 1.18))
    for k in range(4):
        r.box(0.04, 0.12, 0.12, (P['neon_cyan'], P['neon_pink'], P['neon_orange'], P['neon_green'])[k], (4.18, -2.7 + k * 0.2, 1.25))
    for k, m in enumerate((P['menu_yellow'], P['menu_red'], P['menu_white'])):
        r.box(0.04, 1.3, 0.75, m, (W / 2 - 0.04, -1.9 + k * 1.45, 2.15))
    r.light((3.8, -0.5, 2.3), (1.0, 0.9, 0.75), 0.25, 2.4)
    # jukebox and ceiling lights
    r.box(0.9, 0.6, 1.3, P['jukebox'], (-1.6, 3.65, 0.65), bevel=0.05)
    r.cyl(0.45, 0.45, 0.6, P['jukebox'], (-1.6, 3.65, 1.3), (math.pi / 2, 0, 0), seg=16)
    r.torus(0.42, 0.04, P['neon_orange'], (-1.6, 3.34, 1.3), (math.pi / 2, 0, 0), seg=20, rseg=4)
    r.box(0.7, 0.05, 0.5, P['neon_cyan'], (-1.6, 3.34, 0.75))
    r.col(-2.1, -1.1, 3.3, 4.0, 0, 1.8)
    r.light((-1.6, 3.0, 1.2), (0.9, 0.6, 0.9), 0.25, 1.4)
    for y in (-2.0, 1.0):
        r.box(3.0, 0.3, 0.05, P['lamp'], (0.0, y, H - 0.03))
        for x in (-1.0, 1.0):
            r.light((x, y, H - 0.3), (1.0, 0.97, 0.9), 0.3, 3.0)
    r.line((-W / 2, D / 2 - 0.03, 2.9), (W / 2, D / 2 - 0.03, 2.9), 0.025, P['neon_pink'])
    r.door(0.0, P, P['neon_pink'], P['door_glass'])
    r.mark('clerk', (3.7, -0.5, 0), **Room.facing(-1, 0))
    r.mark('counter', (1.85, -0.5, 0))
    r.mark('cash', (2.75, -0.1, 1.12))
    r.mark('sign', (W / 2 - 0.03, -0.45, 2.95), w=2.4, h=0.56, **Room.facing(-1, 0))
    r.props = dict(payout_min=150, payout_max=400, stars=2, sells=1)
    return r.finish((0.22, 0.2, 0.22))


def shop_bar(P):
    rnd = random.Random(5)
    r = Room('room_shop_bar', 11.0, 9.0, 3.6)
    r.P = P
    W, D, H = r.W, r.D, r.H
    dance = (P['dance_pink'], P['dance_cyan'], P['dance_purple'], P['club_floor'])

    def fl(x, y):
        if -4.9 < x < -0.6 and -3.4 < y < 1.0:
            return dance[(int((x + 10) * 2) + 3 * int((y + 10) * 2)) % 4]
        return P['club_floor']
    r.floor(fl)
    r.walls(lambda h, z: P['club_wall'])
    r.ceiling(P['club_ceil'])
    for z in (0.35, 3.3):
        for (p0, p1) in (((-W / 2 + 0.03, -D / 2, z), (-W / 2 + 0.03, D / 2, z)), ((W / 2 - 0.03, -D / 2, z), (W / 2 - 0.03, D / 2, z))):
            r.line(p0, p1, 0.02, P['neon_purple'] if z > 1 else P['neon_cyan'])
    for x, y, c in ((-3.5, -2.4, (1.0, 0.2, 0.8)), (-1.6, -0.2, (0.2, 0.9, 1.0)), (-3.4, 0.4, (0.6, 0.3, 1.0))):
        r.light((x, y, 0.5), c, 0.35, 1.6)
    # bar counter + back bar along the north wall
    counter_shop(r, P, -1.6, 4.6, 2.2, 2.95, 1.1, P['bar_front'], P['glossy_black'], None)
    r.line((-1.6, 2.17, 0.95), (4.6, 2.17, 0.95), 0.025, P['neon_cyan'])
    r.line((-1.6, 2.17, 0.1), (4.6, 2.17, 0.1), 0.02, P['neon_pink'])
    r.box(6.2, 0.1, 1.6, P['backbar'], (1.5, D / 2 - 0.08, 1.9))
    for z in (1.25, 1.75, 2.25):
        r.box(6.2, 0.35, 0.04, P['glass_shelf'], (1.5, D / 2 - 0.25, z))
        x = -1.5
        while x < 4.5:
            h = rnd.uniform(0.25, 0.38)
            r.cyl(0.045, 0.045, h, rnd.choice(P['bottle']), (x, D / 2 - 0.25, z + 0.02 + h / 2), seg=8)
            x += rnd.uniform(0.14, 0.24)
    r.col(-1.7, 4.7, D / 2 - 0.45, D / 2, 0, 2.7)
    r.light((1.5, 3.4, 1.8), (0.9, 0.4, 1.0), 0.4, 2.6)
    for k in range(6):
        r.stool(P['red_seat'], -1.0 + k * 1.0, 1.7, 0.78)
    # DJ booth on a platform (west)
    r.box(1.9, 2.8, 0.4, P['glossy_black'], (-4.5, 3.0, 0.2))
    r.col(-5.5, -3.55, 1.6, 4.4, 0, 0.4, low=True)
    r.line((-3.55, 1.6, 0.42), (-3.55, 4.4, 0.42), 0.02, P['neon_cyan'])
    r.box(0.7, 1.6, 0.95, P['glossy_black'], (-4.1, 3.0, 0.88))
    r.box(0.05, 1.5, 0.5, P['dj_glow'], (-3.74, 3.0, 0.85))
    for k in range(2):
        r.cyl(0.18, 0.18, 0.03, P['dark'], (-4.15, 2.6 + k * 0.8, 1.37), seg=14)
        r.torus(0.15, 0.01, P['neon_pink'], (-4.15, 2.6 + k * 0.8, 1.39), seg=14, rseg=3)
    r.col(-4.45, -3.75, 2.2, 3.8, 0, 1.4)
    for sy in (1.75, 4.25):
        r.box(0.7, 0.6, 1.9, P['glossy_black'], (-5.0, sy, 0.95 + 0.4))
        r.cyl(0.18, 0.18, 0.02, P['dark'], (-4.64, sy, 1.6), (0, math.pi / 2, 0), seg=12)
        r.cyl(0.25, 0.25, 0.02, P['dark'], (-4.64, sy, 1.0), (0, math.pi / 2, 0), seg=12)
    r.light((-3.4, 3.0, 1.6), (0.2, 0.9, 1.0), 0.3, 1.8)
    # lounge (east): sofas and low tables
    for ly in (-2.6, 0.2):
        r.box(0.9, 2.2, 0.42, P['velvet'], (W / 2 - 0.5, ly, 0.21), bevel=0.05)
        r.box(0.25, 2.2, 0.6, P['velvet'], (W / 2 - 0.15, ly, 0.6), bevel=0.06)
        r.box(0.9, 1.0, 0.35, P['glossy_black'], (W / 2 - 1.6, ly, 0.175))
        r.line((W / 2 - 2.05, ly - 0.5, 0.36), (W / 2 - 2.05, ly + 0.5, 0.36), 0.012, P['neon_pink'])
        r.cyl(0.04, 0.04, 0.14, P['bottle'][int(ly + 5) % len(P['bottle'])], (W / 2 - 1.6, ly + 0.2, 0.42), seg=8)
        r.col(W / 2 - 2.05, W / 2, ly - 1.1, ly + 1.1, 0, 0.8)
        r.light((W / 2 - 1.2, ly, 1.6), (1.0, 0.5, 0.7), 0.2, 1.6)
    # disco ball and lasers
    r.line((-2.7, -1.2, H), (-2.7, -1.2, 3.1), 0.01, P['dark'])
    r.sphere(0.3, P['disco'], (-2.7, -1.2, 2.8), u=12, v=8)
    for k in range(6):
        a = k * math.pi / 3
        r.line((-2.7, -1.2, 2.8), (-2.7 + math.cos(a) * 3.0, -1.2 + math.sin(a) * 2.4, 0.05), 0.008,
               (P['neon_pink'], P['neon_cyan'], P['neon_green'])[k % 3])
    r.light((-2.7, -1.2, 2.4), (0.9, 0.9, 1.0), 0.3, 2.0)
    r.door(3.5, P, P['neon_purple'], P['door_glass'])
    r.mark('clerk', (1.5, 3.6, 0), **Room.facing(0, -1))
    r.mark('counter', (1.5, 1.35, 0))
    r.mark('cash', (1.5, 2.6, 1.17))
    r.mark('sign', (1.5, D / 2 - 0.03, 3.15), w=2.8, h=0.6, **Room.facing(0, -1))
    r.props = dict(payout_min=200, payout_max=600, stars=2, sells=1)
    return r.finish((0.16, 0.12, 0.22))


def shop_bank(P):
    r = Room('room_shop_bank', 12.0, 10.0, 4.2)
    r.P = P
    W, D, H = r.W, r.D, r.H

    def fl(x, y):
        if -1.0 < x < 1.0 and y < 0.9:
            return P['carpet_gold'] if abs(x) > 0.85 else P['carpet_navy']
        return P['marble_a'] if (int((x + 10)) + int((y + 10))) % 2 else P['marble_b']
    r.floor(fl)
    r.walls(lambda h, z: P['navy'] if z < 1.2 else (P['gold_m'] if 3.4 < z < 3.55 else P['marble_wall']))
    r.ceiling(P['marble_wall'])
    # pillars
    for x in (-3.6, 3.6):
        for y in (-2.6, 0.2):
            r.cyl(0.36, 0.36, H, P['marble_a'], (x, y, H / 2), seg=16)
            for z in (0.12, H - 0.12):
                r.cyl(0.46, 0.46, 0.24, P['gold_m'], (x, y, z), seg=16)
            r.col(x - 0.42, x + 0.42, y - 0.42, y + 0.42)
    # teller counter with glass and three windows
    counter_shop(r, P, -5.0, 5.0, 1.4, 2.2, 1.15, P['dark_wood'], P['marble_a'], None)
    r.line((-5.0, 1.37, 0.12), (5.0, 1.37, 0.12), 0.02, P['neon_gold'])
    for k in range(10):
        x0 = -5.0 + k * 1.0
        if k in (1, 5, 8):  # windows at x = -3.5, 0.5, 3.5: glass above a slot
            r.box(1.0, 0.04, 1.0, P['glass_blue'], (x0 + 0.5, 1.8, 2.4))
            r.box(1.0, 0.06, 0.06, P['gold_m'], (x0 + 0.5, 1.8, 1.9))
        else:
            r.box(1.0, 0.04, 1.45, P['glass_blue'], (x0 + 0.5, 1.8, 1.9))
        r.box(0.05, 0.08, 1.5, P['gold_m'], (x0, 1.8, 1.9))
    r.box(10.0, 0.1, 0.1, P['gold_m'], (0, 1.8, 2.92))
    r.col(-5.0, 5.0, 1.75, 1.85, 1.15, 2.95)
    for x in (-3.5, 0.5, 3.5):
        r.lathe([(0.0, 0.18), (0.12, 0.16), (0.16, 0.08)], P['lamp_green'], (x - 0.35, 2.0, 1.17), seg=12)
        r.light((x - 0.35, 1.6, 1.5), (0.4, 1.0, 0.5), 0.15, 1.0)
    # the vault (north wall) and deposit boxes
    vy = D / 2 - 0.15
    r.lathe([(0.0, 0.32), (1.45, 0.32), (1.5, 0.0)], P['steel'], (0, vy, 1.65), (math.pi / 2, 0, 0), seg=28)
    r.torus(1.5, 0.08, P['gold_m'], (0, vy - 0.3, 1.65), (math.pi / 2, 0, 0), seg=28, rseg=6)
    r.torus(0.5, 0.05, P['steel_dark'], (0, vy - 0.36, 1.65), (math.pi / 2, 0, 0), seg=20, rseg=4)
    for k in range(3):
        a = k * math.pi / 3
        r.box(1.1, 0.06, 0.08, P['steel_dark'], (0, vy - 0.4, 1.65), (0, a, 0))
    r.sphere(0.08, P['led_red'], (0, vy - 0.42, 1.65), u=8, v=6)
    r.light((0, 3.4, 2.0), (1.0, 0.3, 0.3), 0.12, 1.2)
    for s in (-1, 1):
        for i in range(5):
            for j in range(4):
                x = s * (2.2 + i * 0.5)
                r.box(0.46, 0.06, 0.34, P['steel'], (x, D / 2 - 0.05, 0.9 + j * 0.42))
                r.box(0.06, 0.02, 0.04, P['gold_m'], (x, D / 2 - 0.09, 0.9 + j * 0.42))
    r.col(-1.6, 1.6, D / 2 - 0.5, D / 2, 0, 3.3)
    # lobby: benches, rope posts, ATMs, plants, a holo logo
    for s in (-1, 1):
        r.box(0.6, 2.2, 0.45, P['dark_wood'], (s * 5.5, -2.0, 0.225), bevel=0.04)
        r.col(s * 5.5 - 0.3, s * 5.5 + 0.3, -3.1, -0.9, 0, 0.5)
    for s in (-1, 1):  # a queue lane of rope posts up to the middle window
        for k in range(4):
            y = -2.2 + k * 0.85
            r.cyl(0.05, 0.05, 1.0, P['gold_m'], (0.5 + s * 1.3, y, 0.5), seg=8)
            r.sphere(0.07, P['gold_m'], (0.5 + s * 1.3, y, 1.02), u=8, v=6)
            if k < 3:
                r.cyl(0.025, 0.025, 0.85, P['rope'], (0.5 + s * 1.3, y + 0.425, 0.88), (math.pi / 2, 0, 0), seg=6)
    for k in range(3):
        y = -3.8 + k * 1.1
        r.box(0.55, 0.8, 1.7, P['atm'], (-5.7, y, 0.85))
        r.box(0.06, 0.45, 0.32, P['screen_cyan'], (-5.41, y, 1.3))
        r.col(-6.0, -5.4, y - 0.42, y + 0.42, 0, 1.7)
    r.plant(P, 5.3, -4.3, 1.3, P['gold_m'])
    r.plant(P, -5.3, 3.9, 1.3, P['gold_m'])
    r.torus(1.1, 0.06, P['neon_cyan'], (0, -1.5, 3.4), seg=32, rseg=4)
    r.torus(0.8, 0.04, P['neon_gold'], (0, -1.5, 3.4), seg=28, rseg=4)
    r.line((0, -1.5, H), (0, -1.5, 3.45), 0.01, P['dark'])
    for x, y in ((-3.0, -2.0), (3.0, -2.0), (0.0, 0.0), (0, 3.2)):
        r.cyl(0.5, 0.5, 0.06, P['lamp'], (x, y, H - 0.03), seg=16)
        r.light((x, y, H - 0.4), (1.0, 0.92, 0.8), 0.4, 3.0)
    r.door(0.0, P, P['neon_gold'], P['door_glass'])
    r.mark('clerk', (0.5, 2.9, 0), **Room.facing(0, -1))
    r.mark('counter', (0.5, 0.95, 0))
    r.mark('cash', (0.5, 1.6, 1.22))
    r.mark('sign', (0, D / 2 - 0.03, 3.75), w=3.0, h=0.62, **Room.facing(0, -1))
    r.props = dict(payout_min=700, payout_max=1500, stars=3, sells=0, teller=1)
    return r.finish((0.24, 0.22, 0.26))


def shop_arcade(P):
    rnd = random.Random(9)
    r = Room('room_shop_arcade', 10.0, 8.0, 3.3)
    r.P = P
    W, D, H = r.W, r.D, r.H
    confetti = (P['carpet_a'], P['carpet_b'], P['carpet_c'])
    r.floor(lambda x, y: confetti[(int((x + 10) * 2) * 7 + int((y + 10) * 2) * 13) % 11 % 3] if (int((x + 10) * 2) * 3 + int((y + 10) * 2) * 5) % 4 == 0 else P['carpet_dark'])
    r.walls(lambda h, z: P['arcade_wall'])
    r.ceiling(P['club_ceil'])
    for z, m in ((0.6, P['neon_cyan']), (2.6, P['neon_pink'])):
        for (p0, p1) in (((-W / 2 + 0.03, -D / 2, z), (-W / 2 + 0.03, D / 2, z)), ((-W / 2, D / 2 - 0.03, z), (W / 2, D / 2 - 0.03, z))):
            r.line(p0, p1, 0.02, m)
    screens = (P['screen_cyan'], P['screen_pink'], P['screen_purple'], P['screen_green'], P['menu_yellow'])

    def cabinet(x, y, face, k):
        # face = +1: screen looks east, -1: west
        r.box(0.75, 0.75, 1.85, P['arcade'], (x, y, 0.925))
        r.box(0.06, 0.6, 0.45, screens[k % len(screens)], (x + face * 0.36, y, 1.35), (0, face * -0.25, 0))
        r.box(0.08, 0.72, 0.2, screens[(k + 2) % len(screens)], (x + face * 0.35, y, 1.75))
        r.box(0.35, 0.7, 0.08, P['dark'], (x + face * 0.45, y, 1.0), (0, face * 0.4, 0))
        for q in range(2):
            r.sphere(0.035, (P['neon_pink'], P['neon_cyan'])[q], (x + face * 0.5, y - 0.15 + q * 0.3, 1.06), u=6, v=4)
        r.light((x + face * 0.9, y, 1.3), (0.6, 0.5, 1.0), 0.12, 1.0)
    k = 0
    for y in (-2.4, -1.45, -0.5, 0.45, 1.4):
        cabinet(-0.45, y, -1, k)
        cabinet(0.45, y, 1, k + 1)
        k += 2
    r.col(-0.85, 0.85, -2.8, 1.8, 0, 1.9)
    for y in (-0.4, 0.55, 1.5, 2.45):
        cabinet(-4.55, y, 1, k)
        k += 1
    r.col(-4.95, -4.15, -0.8, 2.85, 0, 1.9)
    # claw machine, air hockey
    r.box(1.0, 1.0, 0.9, P['arcade'], (-4.3, -2.6, 0.45))
    for sx in (-1, 1):
        for sy in (-1, 1):
            r.box(0.05, 0.05, 1.0, P['chrome'], (-4.3 + sx * 0.48, -2.6 + sy * 0.48, 1.4))
    r.box(1.0, 1.0, 0.12, P['neon_pink'], (-4.3, -2.6, 1.95))
    for q in range(8):
        r.sphere(0.1, rnd.choice(P['prod']), (-4.3 + rnd.uniform(-0.35, 0.35), -2.6 + rnd.uniform(-0.35, 0.35), 0.98 + rnd.uniform(0, 0.1)), u=8, v=6)
    r.box(0.06, 0.06, 0.3, P['chrome'], (-4.3, -2.6, 1.75))
    r.col(-4.85, -3.75, -3.15, -2.05, 0, 2.0)
    r.light((-4.3, -2.6, 1.5), (1.0, 0.4, 0.9), 0.2, 1.2)
    r.box(1.2, 2.0, 0.8, P['arcade'], (2.4, -2.2, 0.4))
    r.box(1.1, 1.9, 0.04, P['screen_cyan'], (2.4, -2.2, 0.82))
    r.box(0.04, 1.9, 0.08, P['neon_pink'], (2.4, -2.2, 0.85))
    r.col(1.75, 3.05, -3.25, -1.15, 0, 0.9)
    r.light((2.4, -2.2, 1.4), (0.3, 0.9, 1.0), 0.25, 1.4)
    # prize counter (east) and prize shelves
    counter_shop(r, P, 3.3, 4.0, -0.6, 3.0, 1.0, P['arcade'], P['glass_top'], None)
    r.line((3.28, -0.6, 0.12), (3.28, 3.0, 0.12), 0.02, P['neon_cyan'])
    for q in range(10):
        r.sphere(0.09, rnd.choice(P['prod']), (3.65, -0.4 + q * 0.33, 1.12), u=8, v=6)
    for z in (1.2, 1.7, 2.2):
        r.box(0.4, 3.6, 0.05, P['shelf'], (W / 2 - 0.22, 1.2, z))
        for q in range(12):
            r.sphere(rnd.uniform(0.1, 0.16), rnd.choice(P['prod']), (W / 2 - 0.25, -0.5 + q * 0.3, z + 0.15), u=8, v=6)
    r.col(W / 2 - 0.45, W / 2, -0.6, 3.0, 0, 2.5)
    r.light((4.2, 1.2, 2.2), (1.0, 0.9, 0.8), 0.3, 1.8)
    for x, y in ((-2.5, -1.0), (2.0, 1.0), (-2.5, 2.5)):
        r.cyl(0.35, 0.35, 0.05, P['lamp'], (x, y, H - 0.03), seg=12)
        r.light((x, y, H - 0.4), (0.85, 0.8, 1.0), 0.22, 2.4)
    r.door(-2.5, P, P['neon_cyan'], P['door_glass'])
    r.mark('clerk', (4.5, 1.2, 0), **Room.facing(-1, 0))
    r.mark('counter', (2.75, 1.2, 0))
    r.mark('cash', (3.65, 1.6, 1.1))
    r.mark('sign', (W / 2 - 0.03, 1.2, 2.85), w=2.6, h=0.56, **Room.facing(-1, 0))
    r.props = dict(payout_min=150, payout_max=450, stars=2, sells=1)
    return r.finish((0.16, 0.13, 0.22))


# ================================================================== FLATS
def flat_studio(P):
    rnd = random.Random(11)
    r = Room('room_flat_studio', 10.0, 9.0, 3.2)
    r.P = P
    W, D, H = r.W, r.D, r.H
    wood = (P['wood_a'], P['wood_b'], P['wood_c'])
    r.floor(lambda x, y: wood[(int((y + 10) * 4) * 7 + int((x + 10) / 3)) % 3])
    r.walls(lambda h, z: P['fwall_lo'] if z < 0.25 else P['fwall_hi'], holes={'E': [(0.5, 3.5, 1.0, 2.75)]})
    r.ceiling(P['fceil'])
    ex = W / 2
    for (p, s) in (((ex, 2.0, 0.98), (0.25, 3.1, 0.08)), ((ex, 2.0, 2.77), (0.2, 3.1, 0.08)), ((ex, 0.48, 1.88), (0.2, 0.08, 1.85)),
                   ((ex, 3.52, 1.88), (0.2, 0.08, 1.85)), ((ex, 2.0, 1.88), (0.12, 0.06, 1.8))):
        r.box(*s, P['frame'], p)
    r.light((ex + 2.0, 2.0, 2.2), (0.45, 0.55, 1.0), 0.45, 3.0)
    r.mark('view0', (ex, 2.0, 1.85), dir='E')
    r.cyl(0.45, 0.45, 0.06, P['lamp_warm'], (0.6, 0.2, H - 0.03), seg=20)
    r.light((0.6, 0.2, H - 0.35), (1.0, 0.86, 0.7), 0.55, 3.4)
    for (p0, p1) in (((-W / 2 + 0.05, -D / 2, H - 0.12), (-W / 2 + 0.05, D / 2, H - 0.12)), ((-W / 2, D / 2 - 0.05, H - 0.12), (W / 2, D / 2 - 0.05, H - 0.12))):
        r.line(p0, p1, 0.025, P['neon_purple'])
    for y in (-3.0, 0.0, 3.0):
        r.light((-W / 2 + 0.4, y, H - 0.3), (0.8, 0.4, 1.0), 0.1, 1.8)
    # kitchen along the west wall + island
    r.box(0.65, 3.8, 0.9, P['cabinet'], (-4.65, 0.7, 0.45))
    r.box(0.7, 3.85, 0.05, P['worktop'], (-4.63, 0.7, 0.92))
    r.box(0.4, 3.8, 0.7, P['cabinet'], (-4.78, 0.7, 2.0))
    for k in range(2):
        r.torus(0.12, 0.012, P['burner'], (-4.62, 0.45 + k * 0.35, 0.96), seg=14, rseg=3)
    r.box(0.8, 0.8, 2.0, P['fridge'], (-4.55, 3.4, 1.0))
    r.box(0.04, 0.3, 0.18, P['screen_cyan'], (-4.14, 3.4, 1.4))
    r.line((-4.3, -1.2, 1.6), (-4.3, 2.6, 1.6), 0.015, P['neon_cyan'])
    r.light((-4.0, 0.7, 2.3), (1.0, 0.9, 0.75), 0.3, 1.8)
    r.col(-5.0, -4.3, -1.2, 2.6, 0, 1.0)
    r.col(-4.95, -4.15, 3.0, 3.8, 0, 2.0)
    r.box(0.9, 1.8, 0.92, P['cabinet'], (-2.9, 0.9, 0.46))
    r.box(1.0, 1.9, 0.05, P['worktop'], (-2.9, 0.9, 0.94))
    for y in (0.4, 1.4):
        r.stool(P['stool'], -2.1, y)
    r.col(-3.4, -2.4, -0.05, 1.85, 0, 1.0)
    # sofa, rug, coffee table, TV
    sx, sy = 0.8, -0.4
    r.box(2.6, 0.95, 0.42, P['sofa'], (sx, sy, 0.21), bevel=0.05)
    r.box(2.6, 0.25, 0.55, P['sofa'], (sx, sy - 0.48, 0.6), bevel=0.06)
    for s in (-1, 1):
        r.box(0.25, 0.95, 0.62, P['sofa'], (sx + s * 1.3, sy, 0.31), bevel=0.05)
    for k, m in enumerate((P['pillow_a'], P['pillow_b'], P['pillow_a'])):
        r.box(0.5, 0.18, 0.4, m, (sx - 0.8 + k * 0.8, sy - 0.28, 0.6), (0.2, 0, 0), bevel=0.06)
    r.col(sx - 1.45, sx + 1.45, sy - 0.65, sy + 0.5, 0, 0.8)
    r.box(3.2, 2.4, 0.02, P['rug'], (sx, 1.0, 0.012))
    r.box(3.0, 2.2, 0.022, P['rug_in'], (sx, 1.0, 0.014))
    r.box(1.3, 0.65, 0.06, P['glass_top'], (sx, 1.25, 0.42))
    r.box(1.2, 0.55, 0.36, P['dark'], (sx, 1.25, 0.2))
    r.line((sx - 0.66, 0.92, 0.45), (sx + 0.66, 0.92, 0.45), 0.012, P['neon_pink'])
    r.col(sx - 0.65, sx + 0.65, 0.92, 1.58, 0, 0.45)
    r.box(2.3, 0.06, 1.3, P['dark'], (sx, D / 2 - 0.06, 1.55))
    r.box(2.0, 0.45, 0.45, P['cabinet'], (sx, D / 2 - 0.25, 0.225))
    r.line((sx - 1.0, D / 2 - 0.47, 0.05), (sx + 1.0, D / 2 - 0.47, 0.05), 0.012, P['neon_cyan'])
    r.light((sx, D / 2 - 0.8, 1.5), (0.4, 0.6, 1.0), 0.3, 2.2)
    r.col(sx - 1.0, sx + 1.0, D / 2 - 0.5, D / 2, 0, 0.5)
    r.mark('tv', (sx, D / 2 - 0.11, 1.55), w=2.12, h=1.15, **Room.facing(0, -1))
    # bed, nightstand, lamp
    r.box(2.2, 1.8, 0.35, P['bed_frame'], (3.85, -2.55, 0.175))
    r.box(2.1, 1.7, 0.2, P['mattress'], (3.85, -2.55, 0.45), bevel=0.05)
    r.box(1.3, 1.74, 0.08, P['blanket'], (3.3, -2.55, 0.58), bevel=0.03)
    for y in (-3.0, -2.1):
        r.box(0.4, 0.6, 0.16, P['mattress'], (4.6, y, 0.62), bevel=0.06)
    r.box(0.12, 1.9, 1.0, P['bed_frame'], (4.92, -2.55, 0.65))
    r.col(2.75, 5.0, -3.47, -1.63, 0, 0.7)
    r.box(0.5, 0.5, 0.55, P['cabinet'], (4.65, -1.25, 0.275))
    r.cyl(0.05, 0.08, 0.3, P['dark'], (4.65, -1.25, 0.7), seg=8)
    r.sphere(0.14, P['lamp_warm'], (4.65, -1.25, 0.92), u=10, v=6)
    r.light((4.3, -1.3, 1.0), (1.0, 0.75, 0.45), 0.3, 1.6)
    r.col(4.4, 4.9, -1.5, -1.0, 0, 0.6)
    r.mark('bed', (2.4, -2.4, 0))
    # gaming desk, plants, bookshelf
    r.box(1.7, 0.75, 0.05, P['desk'], (3.6, 3.95, 0.76))
    for s in (-1, 1):
        r.box(0.06, 0.7, 0.76, P['dark'], (3.6 + s * 0.8, 3.95, 0.38))
    for k, m in enumerate((P['screen_cyan'], P['screen_pink'])):
        r.box(0.56, 0.02, 0.32, m, (3.25 + k * 0.7, 4.19, 1.1), (0, 0, (k - 0.5) * 0.3))
    r.line((2.8, 3.6, 0.72), (4.4, 3.6, 0.72), 0.012, P['neon_purple'])
    r.cyl(0.28, 0.28, 0.08, P['chair'], (3.6, 3.2, 0.48), seg=12)
    r.box(0.5, 0.08, 0.6, P['chair'], (3.6, 2.92, 0.82))
    r.light((3.6, 3.4, 1.2), (0.6, 0.6, 1.0), 0.25, 1.5)
    r.col(2.75, 4.45, 3.55, 4.35, 0, 0.8)
    r.plant(P, -4.4, -3.9)
    r.plant(P, 2.0, 4.1)
    r.box(0.35, 1.2, 1.9, P['cabinet'], (-4.8, -2.6, 0.95))
    for z in (0.5, 0.95, 1.4):
        y = -3.1
        while y < -2.1:
            w = rnd.uniform(0.04, 0.09)
            r.box(0.25, w, rnd.uniform(0.25, 0.36), rnd.choice(P['prod']), (-4.75, y + w / 2, z + 0.16))
            y += w + 0.01
    r.col(-5.0, -4.6, -3.2, -2.0, 0, 1.9)
    r.door(-3.3, P, P['neon_warm'], P['door_metal'])
    for k, p in enumerate(((sx, 1.25, 0.45), (-4.6, 1.8, 0.95), (3.9, 3.85, 0.79), (-2.9, 1.4, 0.97))):
        r.mark(f'loot{k}', p)
    return r.finish((0.2, 0.17, 0.24))


def flat_penthouse(P):
    r = Room('room_flat_penthouse', 12.0, 10.0, 3.8)
    r.P = P
    W, D, H = r.W, r.D, r.H
    r.floor(lambda x, y: P['marble_a'] if (int(x + 10) + int(y + 10)) % 2 else P['marble_white'])
    holes = {'E': [(-4.0, 4.0, 0.25, 3.5)], 'N': [(-5.0, 5.0, 0.25, 3.5)]}
    r.walls(lambda h, z: P['gold_m'] if 3.5 < z < 3.6 else P['white_wall'], holes=holes)
    r.ceiling(P['white_wall'])
    for k in range(5):  # mullions
        r.box(0.12, 0.12, 3.3, P['frame'], (W / 2, -4.0 + k * 2.0, 1.88))
    for k in range(6):
        r.box(0.12, 0.12, 3.3, P['frame'], (-5.0 + k * 2.0, D / 2, 1.88))
    for (p, s) in (((W / 2, 0, 0.47), (0.2, 8.1, 0.12)), ((W / 2, 0, 3.33), (0.2, 8.1, 0.12)),
                   ((0, D / 2, 0.47), (10.1, 0.2, 0.12)), ((0, D / 2, 3.33), (10.1, 0.2, 0.12))):
        r.box(*s, P['frame'], p)
    r.mark('view0', (W / 2, 0, 1.8), dir='E')
    r.mark('view1', (0, D / 2, 1.8), dir='N')
    r.light((W / 2 + 3.0, 0, 2.6), (0.45, 0.55, 1.0), 0.5, 4.0)
    r.light((0, D / 2 + 3.0, 2.6), (0.5, 0.5, 1.0), 0.5, 4.0)
    # sectional sofa facing the north view, rug, glass table, chandelier
    r.box(4.0, 1.0, 0.42, P['white_sofa'], (0.0, 0.6, 0.21), bevel=0.06)
    r.box(4.0, 0.28, 0.5, P['white_sofa'], (0.0, 0.08, 0.62), bevel=0.08)
    r.box(1.0, 2.2, 0.42, P['white_sofa'], (-2.5, 1.2, 0.21), bevel=0.06)
    r.box(0.28, 2.2, 0.5, P['white_sofa'], (-2.88, 1.2, 0.62), bevel=0.08)
    for k, m in enumerate((P['pillow_gold'], P['pillow_b'], P['pillow_gold'])):
        r.box(0.5, 0.2, 0.42, m, (-1.2 + k * 1.2, 0.3, 0.62), (0.2, 0, 0), bevel=0.06)
    r.col(-3.05, 2.05, -0.05, 1.15, 0, 0.8)
    r.col(-3.05, -2.0, 1.1, 2.35, 0, 0.8)
    r.box(4.4, 3.2, 0.02, P['rug_white'], (0.0, 2.2, 0.012))
    r.box(1.6, 0.9, 0.05, P['glass_top'], (0.0, 2.2, 0.4))
    r.box(0.08, 0.08, 0.38, P['gold_m'], (-0.7, 2.2, 0.19))
    r.box(0.08, 0.08, 0.38, P['gold_m'], (0.7, 2.2, 0.19))
    r.col(-0.8, 0.8, 1.75, 2.65, 0, 0.45)
    for k in range(9):
        a = k * 0.7
        r.sphere(0.07, P['lamp_warm'], (math.cos(a) * 0.4, 2.2 + math.sin(a) * 0.4, 3.0 - (k % 3) * 0.15), u=6, v=4)
        r.line((math.cos(a) * 0.4, 2.2 + math.sin(a) * 0.4, H), (math.cos(a) * 0.4, 2.2 + math.sin(a) * 0.4, 3.05 - (k % 3) * 0.15), 0.006, P['gold_m'])
    r.light((0, 2.2, 2.6), (1.0, 0.85, 0.65), 0.5, 3.5)
    # hot tub (north-east corner)
    r.box(2.2, 2.2, 0.6, P['stone_dark'], (4.6, 3.6, 0.3))
    r.box(1.9, 1.9, 0.02, P['tub_water'], (4.6, 3.6, 0.56))
    r.box(0.6, 0.4, 0.25, P['stone_dark'], (3.2, 3.0, 0.125))
    r.col(3.5, 5.75, 2.5, 4.75, 0, 0.62)
    r.light((4.6, 3.6, 1.0), (0.3, 0.9, 1.0), 0.45, 2.0)
    # bar along the west wall
    r.box(0.7, 3.6, 1.05, P['gold_front'], (-5.3, 0.2, 0.525))
    r.box(0.8, 3.7, 0.05, P['marble_a'], (-5.28, 0.2, 1.07))
    r.box(0.08, 3.6, 1.4, P['backbar'], (-5.95, 0.2, 2.1))
    for z in (1.6, 2.1, 2.6):
        r.box(0.3, 3.4, 0.03, P['glass_shelf'], (-5.8, 0.2, z))
        for q in range(9):
            r.cyl(0.04, 0.04, 0.3, P['bottle'][q % len(P['bottle'])], (-5.8, -1.3 + q * 0.38, z + 0.17), seg=8)
    for k in range(3):
        r.stool(P['white_sofa'], -4.5, -0.9 + k * 1.1, 0.78)
    r.col(-6.0, -4.95, -1.6, 2.0, 0, 1.1)
    r.light((-5.0, 0.2, 2.4), (1.0, 0.8, 0.55), 0.35, 2.0)
    # bed on a platform (south-east), grand piano, sculpture, TV wall
    r.box(2.6, 2.6, 0.25, P['dark_wood'], (4.3, -3.6, 0.125))
    r.box(2.0, 2.2, 0.22, P['mattress'], (4.3, -3.75, 0.36), bevel=0.05)
    r.box(2.04, 1.3, 0.08, P['blanket_grey'], (4.3, -3.2, 0.5), bevel=0.03)
    for x in (3.8, 4.8):
        r.box(0.7, 0.4, 0.16, P['mattress'], (x, -4.55, 0.55), bevel=0.06)
    r.box(2.6, 0.12, 1.0, P['dark_wood'], (4.3, -4.92, 0.6))
    r.col(3.0, 5.6, -4.95, -2.3, 0, 0.6)
    r.mark('bed', (2.6, -3.6, 0))
    r.box(1.5, 1.8, 0.35, P['piano'], (-3.6, 3.6, 0.85))
    r.box(1.5, 1.6, 0.04, P['piano'], (-3.6, 3.75, 1.35), (0.45, 0, 0))
    r.box(1.4, 0.18, 0.06, P['mattress'], (-3.6, 2.68, 0.9))
    for x in (-4.2, -3.0):
        r.cyl(0.05, 0.05, 0.7, P['piano'], (x, 3.0, 0.35), seg=6)
    r.cyl(0.05, 0.05, 0.7, P['piano'], (-3.6, 4.3, 0.35), seg=6)
    r.col(-4.4, -2.8, 2.6, 4.55, 0, 1.1)
    r.cyl(0.3, 0.3, 0.9, P['marble_a'], (-2.6, -3.9, 0.45), seg=12)
    r.torus(0.32, 0.08, P['gold_m'], (-2.6, -3.9, 1.3), (0.6, 0.3, 0), seg=20, rseg=6)
    r.sphere(0.12, P['gold_m'], (-2.6, -3.9, 1.15), u=10, v=8)
    r.col(-2.95, -2.25, -4.25, -3.55, 0, 1.5)
    r.box(2.8, 0.08, 1.5, P['dark'], (0.8, -D / 2 + 0.06, 1.8))
    r.box(2.6, 0.4, 0.4, P['white_sofa'], (0.8, -D / 2 + 0.25, 0.2))
    r.col(-0.5, 2.1, -D / 2, -D / 2 + 0.45, 0, 0.4)
    r.mark('tv', (0.8, -D / 2 + 0.11, 1.8), w=2.6, h=1.38, **Room.facing(0, 1))
    r.light((0.8, -D / 2 + 1.0, 1.8), (0.4, 0.6, 1.0), 0.25, 2.0)
    r.plant(P, -5.4, 4.4, 1.4, P['gold_m'])
    r.plant(P, 5.4, -1.6, 1.4, P['gold_m'])
    for x, y in ((-3.0, -2.0), (2.5, -2.0), (2.5, 1.0)):
        r.box(1.6, 0.16, 0.04, P['lamp'], (x, y, H - 0.02))
        r.light((x, y, H - 0.4), (1.0, 0.95, 0.88), 0.3, 3.0)
    r.door(-4.5, P, P['neon_gold'], P['door_metal'])
    for k, p in enumerate(((0.2, 2.2, 0.43), (-5.2, 0.9, 1.1), (-3.3, 3.2, 1.03), (5.3, -2.9, 0.3))):
        r.mark(f'loot{k}', p)
    return r.finish((0.26, 0.25, 0.3))


def flat_gamer(P):
    rnd = random.Random(31)
    r = Room('room_flat_gamer', 9.0, 8.0, 3.0)
    r.P = P
    W, D, H = r.W, r.D, r.H
    r.floor(lambda x, y: P['carpet_grey'])
    r.walls(lambda h, z: P['gamer_wall'])
    r.ceiling(P['club_ceil'])
    leds = (P['neon_cyan'], P['neon_pink'], P['neon_green'], P['neon_purple'])
    edges = (((-W / 2 + 0.04, -D / 2, H - 0.06), (-W / 2 + 0.04, D / 2, H - 0.06)), ((W / 2 - 0.04, -D / 2, H - 0.06), (W / 2 - 0.04, D / 2, H - 0.06)),
             ((-W / 2, D / 2 - 0.04, H - 0.06), (W / 2, D / 2 - 0.04, H - 0.06)), ((-W / 2, -D / 2 + 0.04, H - 0.06), (W / 2, -D / 2 + 0.04, H - 0.06)))
    for k, (p0, p1) in enumerate(edges):
        r.line(p0, p1, 0.025, leds[k])
    for x, y, c in ((-4.0, 0, (0.2, 0.9, 1.0)), (4.0, 0, (1.0, 0.2, 0.8)), (0, 3.6, (0.3, 1.0, 0.5)), (0, -3.6, (0.6, 0.3, 1.0))):
        r.light((x, y, H - 0.4), c, 0.2, 2.5)
    # big neon rug and VR ring
    r.box(3.4, 2.6, 0.02, P['rug_in'], (0.3, -0.6, 0.012))
    for (p0, p1) in (((-1.4, -1.9, 0.03), (2.0, -1.9, 0.03)), ((-1.4, 0.7, 0.03), (2.0, 0.7, 0.03)), ((-1.4, -1.9, 0.03), (-1.4, 0.7, 0.03)), ((2.0, -1.9, 0.03), (2.0, 0.7, 0.03))):
        r.line(p0, p1, 0.015, P['neon_purple'])
    r.torus(0.7, 0.03, P['neon_cyan'], (0.3, -0.6, 0.04), seg=28, rseg=3)
    # gaming desk with three monitors and a glowing PC
    r.box(3.2, 0.8, 0.05, P['desk'], (0.9, 3.5, 0.76))
    for x in (-0.6, 2.4):
        r.box(0.06, 0.75, 0.76, P['dark'], (x, 3.5, 0.38))
    for k, m in enumerate((P['screen_cyan'], P['screen_pink'], P['screen_green'])):
        a = (k - 1) * 0.35
        x = 0.9 + (k - 1) * 0.75
        r.box(0.7, 0.04, 0.42, P['dark'], (x, 3.72 - abs(k - 1) * 0.12, 1.15), (0, 0, a))
        r.box(0.64, 0.02, 0.36, m, (x, 3.69 - abs(k - 1) * 0.12, 1.15), (0, 0, a))
    r.box(0.9, 0.25, 0.03, P['neon_pink'], (0.9, 3.25, 0.8))
    r.box(0.25, 0.55, 0.55, P['dark'], (2.15, 3.55, 1.06))
    r.box(0.02, 0.5, 0.5, P['rgb_panel'], (2.02, 3.55, 1.06))
    r.light((0.9, 3.0, 1.2), (0.5, 0.7, 1.0), 0.35, 1.8)
    r.col(-0.65, 2.45, 3.1, 3.95, 0, 0.8)
    r.cyl(0.3, 0.3, 0.1, P['chair'], (0.9, 2.6, 0.5), seg=12)
    r.box(0.55, 0.1, 0.8, P['chair'], (0.9, 2.3, 0.95), bevel=0.04)
    r.box(0.52, 0.12, 0.25, P['dark'], (0.9, 2.33, 0.75))
    # bed with neon underglow (east)
    r.box(1.3, 2.2, 0.35, P['dark'], (W / 2 - 0.75, -2.6, 0.175))
    r.box(1.2, 2.1, 0.2, P['mattress'], (W / 2 - 0.75, -2.6, 0.45), bevel=0.05)
    r.box(1.24, 1.3, 0.1, P['blanket_game'], (W / 2 - 0.75, -2.2, 0.58), bevel=0.04)
    r.box(0.6, 0.38, 0.16, P['mattress'], (W / 2 - 0.75, -3.45, 0.62), bevel=0.06)
    r.line((W / 2 - 1.42, -3.7, 0.02), (W / 2 - 1.42, -1.5, 0.02), 0.02, P['neon_purple'])
    r.col(W / 2 - 1.45, W / 2, -3.75, -1.45, 0, 0.7)
    r.light((W / 2 - 1.6, -2.6, 0.3), (0.7, 0.3, 1.0), 0.3, 1.4)
    r.mark('bed', (W / 2 - 2.2, -2.4, 0))
    # bean bags, TV with a console (west), pizza boxes, mini fridge, shelves with figures
    for x, y, m in ((-2.4, 0.6, P['beanbag_a']), (-1.3, 1.4, P['beanbag_b'])):
        r.sphere(0.45, m, (x, y, 0.3), (1.1, 1.1, 0.7), u=12, v=8)
        r.col(x - 0.45, x + 0.45, y - 0.45, y + 0.45, 0, 0.6)
    r.box(0.45, 2.2, 0.45, P['cabinet'], (-W / 2 + 0.25, 0.6, 0.225))
    r.box(0.06, 2.2, 1.25, P['dark'], (-W / 2 + 0.05, 0.6, 1.35))
    r.box(0.3, 0.4, 0.08, P['mattress'], (-W / 2 + 0.3, 0.2, 0.49))
    r.box(0.02, 0.3, 0.02, P['neon_cyan'], (-W / 2 + 0.46, 0.2, 0.5))
    r.col(-W / 2, -W / 2 + 0.5, -0.5, 1.7, 0, 0.5)
    r.mark('tv', (-W / 2 + 0.09, 0.6, 1.35), w=2.1, h=1.16, **Room.facing(1, 0))
    r.light((-3.6, 0.6, 1.4), (0.4, 0.6, 1.0), 0.3, 2.0)
    for k in range(3):
        r.box(0.45, 0.45, 0.04, P['pizza_box'], (2.6 + k * 0.03, -0.6, 0.02 + k * 0.045), (0, 0, k * 0.2))
    for k in range(4):
        r.cyl(0.035, 0.035, 0.12, P['bottle'][k % len(P['bottle'])], (2.2 + k * 0.15, 0.1, 0.06), seg=8)
    r.box(0.6, 0.6, 0.85, P['dark'], (3.9, 3.6, 0.425))
    r.box(0.02, 0.5, 0.7, P['fridge_light'], (3.59, 3.6, 0.43))
    r.col(3.55, 4.25, 3.25, 3.95, 0, 0.9)
    for z in (1.4, 1.9):
        r.box(2.4, 0.3, 0.04, P['shelf'], (-1.8, -D / 2 + 0.17, z))
        for q in range(8):
            m = rnd.choice(P['prod'])
            if q % 2:
                r.sphere(0.07, m, (-2.8 + q * 0.28, -D / 2 + 0.17, z + 0.1), u=8, v=6)
            else:
                r.box(0.1, 0.1, 0.2, m, (-2.8 + q * 0.28, -D / 2 + 0.17, z + 0.12))
    for k, (side, h0, m) in enumerate((('W', -2.5, P['poster_a']), ('E', 1.5, P['poster_c']), ('S', 1.5, P['poster_b']))):
        if side == 'W':
            r.box(0.04, 0.8, 1.1, m, (-W / 2 + 0.03, h0, 1.8))
        elif side == 'E':
            r.box(0.04, 0.8, 1.1, m, (W / 2 - 0.03, h0, 1.8))
        else:
            r.box(0.8, 0.04, 1.1, m, (h0, -D / 2 + 0.03, 1.8))
    r.door(-3.0, P, P['neon_green'], P['door_metal'])
    for k, p in enumerate(((0.3, 3.4, 0.8), (-W / 2 + 0.3, 1.2, 0.5), (3.9, 3.6, 0.9), (2.6, -0.6, 0.2))):
        r.mark(f'loot{k}', p)
    return r.finish((0.14, 0.13, 0.22))


def flat_loft(P):
    r = Room('room_flat_loft', 11.0, 9.0, 4.2)
    r.P = P
    W, D, H = r.W, r.D, r.H
    r.floor(lambda x, y: P['concrete_a'] if (int((x + 10) / 1.5) + int((y + 10) / 1.5)) % 2 else P['concrete_b'])
    bricks = (P['brick_a'], P['brick_b'], P['brick_c'])

    def wallmat(h, z):
        row = int(z / 0.25)
        col = int((h + 20 + (row % 2) * 0.25) / 0.5)
        return bricks[(row * 7 + col * 3) % 3]
    r.wall('W', wallmat, 0.25)
    r.wall('N', wallmat, 0.25)
    r.wall('S', lambda h, z: P['white_brick'] if int(z / 0.25) % 2 else P['white_brick2'], 0.25)
    r.wall('E', lambda h, z: P['white_brick'], 0.5, holes=[(-3.0, 3.0, 1.0, 3.75)])
    r.ceiling(P['loft_ceil'])
    # factory window grid
    for k in range(9):
        r.box(0.1, 0.08, 2.8, P['frame'], (W / 2, -3.0 + k * 0.75, 2.375))
    for k in range(5):
        r.box(0.1, 6.1, 0.08, P['frame'], (W / 2, 0, 1.0 + k * 0.6875))
    r.mark('view0', (W / 2, 0, 2.3), dir='E')
    r.light((W / 2 + 2.5, 0, 2.8), (0.45, 0.55, 1.0), 0.55, 3.5)
    # pipes and beams
    for y in (-2.5, 1.5):
        r.cyl(0.08, 0.08, W, P['pipe'], (0, y, H - 0.25), (0, math.pi / 2, 0), seg=10)
    for x in (-3.0, 0.5, 4.0):
        r.box(0.25, D, 0.35, P['beam'], (x, 0, H - 0.18))
    # Edison bulbs
    for x, y in ((-2.0, 0.6), (-0.6, 1.4), (0.8, 0.4), (2.2, 1.2), (-3.6, -2.4)):
        r.line((x, y, H), (x, y, 2.6), 0.006, P['dark'])
        r.sphere(0.07, P['lamp_warm'], (x, y, 2.55), (1, 1, 1.3), u=8, v=6)
        r.light((x, y, 2.3), (1.0, 0.72, 0.4), 0.3, 2.2)
    # leather sofa, rug, coffee table, record player
    sx, sy = -0.6, -0.4
    r.box(2.8, 1.0, 0.45, P['leather'], (sx, sy, 0.225), bevel=0.07)
    r.box(2.8, 0.28, 0.5, P['leather'], (sx, sy - 0.5, 0.65), bevel=0.08)
    for s in (-1, 1):
        r.cyl(0.22, 0.22, 1.0, P['leather'], (sx + s * 1.45, sy, 0.48), (math.pi / 2, 0, 0), seg=12)
    r.col(sx - 1.7, sx + 1.7, sy - 0.65, sy + 0.5, 0, 0.8)
    r.box(3.4, 2.4, 0.02, P['rug_kilim'], (sx, 1.2, 0.012))
    r.box(3.0, 2.0, 0.022, P['rug_kilim2'], (sx, 1.2, 0.014))
    r.box(1.4, 0.7, 0.08, P['light_wood'], (sx, 1.3, 0.42))
    for dx in (-0.6, 0.6):
        for dy in (-0.28, 0.28):
            r.box(0.06, 0.06, 0.4, P['frame'], (sx + dx, 1.3 + dy, 0.2))
    r.col(sx - 0.7, sx + 0.7, 0.95, 1.65, 0, 0.45)
    r.box(1.6, 0.5, 0.6, P['light_wood'], (-4.9, 2.6, 0.3))
    r.cyl(0.2, 0.2, 0.03, P['dark'], (-4.9, 2.4, 0.63), seg=16)
    r.box(0.4, 0.4, 0.1, P['light_wood'], (-4.9, 2.5, 0.65))
    for y in (1.6, 3.6):
        r.box(0.4, 0.4, 0.9, P['dark'], (-5.2, y, 0.45))
        r.cyl(0.12, 0.12, 0.02, P['steel_dark'], (-4.99, y, 0.6), (0, math.pi / 2, 0), seg=12)
    r.col(-5.5, -4.1, 1.35, 3.85, 0, 0.9)
    r.plant(P, -5.0, -3.7, 1.6)
    # bike on the west wall
    for y in (-1.6, -0.6):
        r.torus(0.33, 0.025, P['dark'], (-W / 2 + 0.12, y, 1.9), (0, math.pi / 2, 0), seg=20, rseg=4)
    r.line((-W / 2 + 0.12, -1.6, 1.9), (-W / 2 + 0.12, -1.1, 2.15), 0.02, P['red_seat'])
    r.line((-W / 2 + 0.12, -1.1, 2.15), (-W / 2 + 0.12, -0.6, 1.9), 0.02, P['red_seat'])
    r.line((-W / 2 + 0.12, -1.1, 2.15), (-W / 2 + 0.12, -1.6, 1.9), 0.02, P['red_seat'])
    # kitchen: steel island + open shelves on the brick
    r.box(2.4, 1.0, 0.92, P['steel'], (1.8, 2.8, 0.46))
    r.box(2.5, 1.1, 0.05, P['butcher_block'], (1.8, 2.8, 0.945))
    for x in (1.2, 2.4):
        r.stool(P['leather'], x, 1.95)
    r.col(0.55, 3.05, 2.25, 3.35, 0, 1.0)
    for z in (1.6, 2.2):
        r.box(3.0, 0.3, 0.05, P['light_wood'], (1.8, D / 2 - 0.16, z))
        for q in range(8):
            r.cyl(0.07, 0.07, 0.2, P['bottle'][q % len(P['bottle'])], (0.6 + q * 0.34, D / 2 - 0.16, z + 0.12), seg=8)
    r.box(2.6, 0.6, 0.9, P['steel'], (1.8, D / 2 - 0.3, 0.45))
    r.col(0.5, 3.1, D / 2 - 0.6, D / 2, 0, 0.95)
    # bed behind a folding screen (north-east corner)
    r.box(1.9, 2.2, 0.3, P['frame'], (W / 2 - 1.15, 2.9, 0.15))
    r.box(1.8, 2.1, 0.2, P['mattress'], (W / 2 - 1.15, 2.9, 0.4), bevel=0.05)
    r.box(1.84, 1.2, 0.08, P['blanket_grey'], (W / 2 - 1.15, 2.4, 0.52), bevel=0.03)
    for x in (W / 2 - 1.6, W / 2 - 0.7):
        r.box(0.6, 0.35, 0.15, P['mattress'], (x, 3.8, 0.56), bevel=0.06)
    r.col(W / 2 - 2.1, W / 2, 1.8, 4.0, 0, 0.6)
    for k in range(3):
        r.box(0.7, 0.04, 1.8, P['screen_paper'], (W / 2 - 2.6 + k * 0.62, 1.4 + (k % 2) * 0.12, 0.95), (0, 0, (k % 2 - 0.5) * 0.4))
    r.col(W / 2 - 2.95, W / 2 - 0.85, 1.3, 1.6, 0, 1.9)
    r.mark('bed', (W / 2 - 2.4, 2.2, 0))
    # projector screen on the south wall
    r.box(3.0, 0.04, 1.7, P['mattress'], (0.9, -D / 2 + 0.05, 2.2))
    r.box(0.4, 0.4, 0.2, P['dark'], (0.9, 1.0, H - 0.45))
    r.mark('tv', (0.9, -D / 2 + 0.08, 2.2), w=2.9, h=1.6, **Room.facing(0, 1))
    r.light((0.9, -D / 2 + 1.2, 2.2), (0.5, 0.6, 1.0), 0.25, 2.2)
    r.door(-3.5, P, P['neon_warm'], P['door_metal'])
    for k, p in enumerate(((sx, 1.3, 0.47), (1.8, 2.8, 0.98), (-4.9, 2.8, 0.62), (-5.2, 1.6, 0.92))):
        r.mark(f'loot{k}', p)
    return r.finish((0.2, 0.18, 0.2))


def pal():
    prod = ['#e23a4a', '#2a8ae0', '#f2c21a', '#3ac05a', '#ff7a2a', '#9a4ae0', '#e8e8ee', '#2ad0c0', '#ff4ab0', '#5a6070']
    bottle = ['#ff3a6a', '#3ad0ff', '#ffd23a', '#7aff5a', '#b06aff', '#ff8a3a']
    return dict(
        tile_a=mat('tile_a', '#c9ccd8', 0.1, 0.4), tile_b=mat('tile_b', '#3a3d4c', 0.1, 0.4),
        wall_lo=mat('wall_lo', '#4a3760', 0.1, 0.6), wall_hi=mat('wall_hi', '#d9d4e4', 0.0, 0.7), ceil=mat('ceil', '#2a2c36', 0.0, 0.8),
        lamp=mat('lamp', emit='#f2f6ff', strength=4), exit=mat('exit_sign', emit='#3aff9a'), door_mat=mat('door_mat', '#1a1c24', 0, 0.9),
        neon_pink=mat('neon_pink', emit='#ff2bd6'), neon_cyan=mat('neon_cyan', emit='#29f3ff'), neon_green=mat('neon_green', emit='#3aff9a'),
        neon_blue=mat('neon_blue', emit='#4aa0ff'), neon_purple=mat('neon_purple', emit='#8a4dff'), neon_warm=mat('neon_warm', emit='#ffc46a'),
        neon_orange=mat('neon_orange', emit='#ff7a2a'), neon_gold=mat('neon_gold', emit='#ffd27a'),
        counter=mat('counter', '#1d2130', 0.3, 0.5), counter_top=mat('counter_top', '#c9ccd8', 0.6, 0.25), dark=mat('dark', '#16171d', 0.3, 0.6),
        screen_green=mat('screen_green', emit='#3aff9a'), screen_purple=mat('screen_purple', emit='#a06aff'), screen_cyan=mat('screen_cyan', emit='#29f3ff'),
        screen_pink=mat('screen_pink', emit='#ff2bd6'), shelf=mat('shelf', '#8a90a0', 0.6, 0.35), shelf_back=mat('shelf_back', '#2a2e3a', 0.2, 0.6),
        fridge_light=mat('fridge_light', emit='#cdeeff', strength=2), chrome=mat('chrome', '#c9d2df', 1.0, 0.15),
        arcade=mat('arcade', '#2a1040', 0.3, 0.5), atm=mat('atm', '#30364a', 0.5, 0.4),
        poster_a=mat('poster_a', emit='#ff2bd6', strength=1.2), poster_b=mat('poster_b', emit='#ffa43a', strength=1.2), poster_c=mat('poster_c', emit='#29f3ff', strength=1.2),
        leaf=mat('leaf', '#2f8a4a', 0.0, 0.7), led_red=mat('led_red', emit='#ff1030'), door_glass=mat('door_glass', '#1c5a52', 0.6, 0.2),
        door_metal=mat('door_metal', '#30364a', 0.6, 0.4), pot=mat('pot', '#d9d4e4', 0.1, 0.6),
        prod=[mat(f'prod{k}', c, 0.2, 0.5) for k, c in enumerate(prod)], bottle=[mat(f'bottle{k}', c, 0.3, 0.3) for k, c in enumerate(bottle)],
        # ramen bar
        wood_d1=mat('wood_d1', '#4a3020', 0, 0.6), wood_d2=mat('wood_d2', '#3e281a', 0, 0.6), wood_d3=mat('wood_d3', '#563824', 0, 0.6),
        dark_wood=mat('dark_wood', '#3a2418', 0.1, 0.5), cream=mat('cream', '#e8dcc0', 0, 0.7), red_band=mat('red_band', '#a8202a', 0.1, 0.5),
        ceil_wood=mat('ceil_wood', '#2a1c14', 0, 0.8), light_wood=mat('light_wood', '#c8a070', 0.1, 0.5), red_seat=mat('red_seat', '#c0283a', 0.2, 0.5),
        white_ceramic=mat('white_ceramic', '#f0f0f4', 0.1, 0.3), gold_m=mat('gold_m', '#d8b060', 0.9, 0.25), steel=mat('steel', '#9aa2b0', 0.8, 0.3),
        steel_dark=mat('steel_dark', '#4a505c', 0.8, 0.35), burner=mat('burner', emit='#ff6a1a'), steam=mat('steam', '#d8dde6', 0, 1.0),
        menu_yellow=mat('menu_yellow', emit='#ffd27a', strength=1.5), menu_white=mat('menu_white', emit='#f2f2f2', strength=1.3),
        menu_red=mat('menu_red', emit='#ff5a4a', strength=1.5), lantern=mat('lantern', emit='#ff5a2a', strength=2.5), noren=mat('noren', '#1d2a5a', 0, 0.8),
        bamboo=mat('bamboo', '#7aa040', 0, 0.6),
        # diner
        diner_red=mat('diner_red', '#8a1c2a', 0.1, 0.4), diner_cream=mat('diner_cream', '#d8ccb4', 0.1, 0.4), teal=mat('teal', '#1d5f66', 0.1, 0.5),
        brick_oven=mat('brick_oven', '#6a3a2a', 0, 0.8), jukebox=mat('jukebox', '#5a1a3a', 0.4, 0.4), lamp_warm=mat('lamp_warm', emit='#ffd9a0', strength=3),
        # bar / club
        club_floor=mat('club_floor', '#141420', 0.3, 0.4), club_wall=mat('club_wall', '#1e1430', 0.1, 0.6), club_ceil=mat('club_ceil', '#0e0c16', 0, 0.8),
        dance_pink=mat('dance_pink', emit='#8a1a78', strength=1.2), dance_cyan=mat('dance_cyan', emit='#1a6a7a', strength=1.2),
        dance_purple=mat('dance_purple', emit='#4a2a8a', strength=1.2), bar_front=mat('bar_front', '#24183a', 0.4, 0.4),
        glossy_black=mat('glossy_black', '#0c0c12', 0.6, 0.15), backbar=mat('backbar', emit='#b04aff', strength=1.4),
        glass_shelf=mat('glass_shelf', '#a0c8e0', 0.5, 0.1), dj_glow=mat('dj_glow', emit='#29f3ff', strength=1.5), velvet=mat('velvet', '#6a1a4a', 0, 0.8),
        disco=mat('disco', emit='#f0f0ff', strength=2),
        # bank
        marble_a=mat('marble_a', '#d9d9e2', 0.2, 0.25), marble_b=mat('marble_b', '#b9bac8', 0.2, 0.25), marble_wall=mat('marble_wall', '#cfd0da', 0.1, 0.4),
        navy=mat('navy', '#1a2240', 0.2, 0.5), carpet_navy=mat('carpet_navy', '#1a2a5a', 0, 0.9), carpet_gold=mat('carpet_gold', '#c8a040', 0.3, 0.5),
        glass_blue=mat('glass_blue', '#2a4a6a', 0.6, 0.1), lamp_green=mat('lamp_green', emit='#3aff7a', strength=1.5), rope=mat('rope', '#a01020', 0, 0.7),
        # arcade
        carpet_dark=mat('carpet_dark', '#1a1028', 0, 0.9), carpet_a=mat('carpet_a', '#6a2a9a', 0, 0.9), carpet_b=mat('carpet_b', '#1a7a8a', 0, 0.9),
        carpet_c=mat('carpet_c', '#9a7a1a', 0, 0.9), arcade_wall=mat('arcade_wall', '#160f24', 0.1, 0.6), glass_top=mat('glass_top', '#101826', 0.8, 0.1),
        # flats
        wood_a=mat('wood_a', '#7a5438', 0.0, 0.6), wood_b=mat('wood_b', '#6a4a32', 0.0, 0.6), wood_c=mat('wood_c', '#845c3e', 0.0, 0.6),
        fwall_lo=mat('fwall_lo', '#e6e2ea', 0.0, 0.7), fwall_hi=mat('fwall_hi', '#c9cddc', 0.0, 0.7), fceil=mat('fceil', '#e2e3ea', 0.0, 0.8),
        frame=mat('window_frame', '#1a1c24', 0.5, 0.4), cabinet=mat('cabinet', '#2c3140', 0.3, 0.5), worktop=mat('worktop', '#e8e8ee', 0.4, 0.3),
        fridge=mat('fridge', '#d0d4de', 0.6, 0.3), stool=mat('stool', '#ff2bd6', 0.3, 0.4), sofa=mat('sofa', '#4a3a8a', 0.0, 0.8),
        pillow_a=mat('pillow_a', '#ff4ab0', 0.0, 0.8), pillow_b=mat('pillow_b', '#29c3d6', 0.0, 0.8), rug=mat('rug', '#8a4dff', 0.0, 0.9),
        rug_in=mat('rug_in', '#2a2040', 0.0, 0.9), bed_frame=mat('bed_frame', '#2a2a35', 0.3, 0.5),
        mattress=mat('mattress', '#e8e8f0', 0.0, 0.8), blanket=mat('blanket', '#2a6a8a', 0.0, 0.8), desk=mat('desk', '#1a1c24', 0.4, 0.4),
        chair=mat('chair', '#c01848', 0.2, 0.5),
        marble_white=mat('marble_white', '#eef0f6', 0.2, 0.2), white_wall=mat('white_wall', '#ecebf2', 0.0, 0.6), white_sofa=mat('white_sofa', '#f0eee8', 0, 0.8),
        pillow_gold=mat('pillow_gold', '#d8b060', 0.3, 0.5), rug_white=mat('rug_white', '#d0d0d8', 0, 0.95), stone_dark=mat('stone_dark', '#3a3c44', 0.2, 0.5),
        tub_water=mat('tub_water', emit='#3ad8ff', strength=1.6), gold_front=mat('gold_front', '#b08a40', 0.8, 0.3),
        blanket_grey=mat('blanket_grey', '#8a8e9a', 0, 0.85), piano=mat('piano', '#0a0a0e', 0.5, 0.1),
        carpet_grey=mat('carpet_grey', '#24252e', 0, 0.95), gamer_wall=mat('gamer_wall', '#141a2e', 0.1, 0.6), rgb_panel=mat('rgb_panel', emit='#ff4ab0', strength=1.5),
        blanket_game=mat('blanket_game', '#1a3a7a', 0, 0.85), beanbag_a=mat('beanbag_a', '#e86a1a', 0, 0.85), beanbag_b=mat('beanbag_b', '#1aa8a0', 0, 0.85),
        pizza_box=mat('pizza_box', '#c8a878', 0, 0.9),
        concrete_a=mat('concrete_a', '#7a7c84', 0.1, 0.5), concrete_b=mat('concrete_b', '#6e7078', 0.1, 0.5),
        brick_a=mat('brick_a', '#7a3a2a', 0, 0.8), brick_b=mat('brick_b', '#8a4430', 0, 0.8), brick_c=mat('brick_c', '#6a3022', 0, 0.8),
        white_brick=mat('white_brick', '#d8d6d0', 0, 0.8), white_brick2=mat('white_brick2', '#cac8c2', 0, 0.8), loft_ceil=mat('loft_ceil', '#3a3c44', 0.1, 0.7),
        pipe=mat('pipe', '#8a6a4a', 0.8, 0.4), beam=mat('beam', '#2a2c32', 0.6, 0.5), leather=mat('leather', '#6a3a1e', 0.1, 0.45),
        rug_kilim=mat('rug_kilim', '#8a2a2a', 0, 0.9), rug_kilim2=mat('rug_kilim2', '#2a4a6a', 0, 0.9), butcher_block=mat('butcher_block', '#b08050', 0, 0.6),
        screen_paper=mat('screen_paper', '#e8dcc0', 0, 0.8),
    )


ROOMS = [shop_mart, shop_ramen, shop_diner, shop_bar, shop_bank, shop_arcade, flat_studio, flat_penthouse, flat_gamer, flat_loft]


def build_all():
    P = pal()
    objs = []
    for fn in ROOMS:
        ob = fn(P)
        print(f'  {ob.name}: {tri_count(ob)} triangles')
        objs.append(ob)
    return objs


def previews(objs, out):
    import os
    from lib import render
    views = {
        'room_shop_mart': ((-3.8, -3.6, 2.6), (1.5, 1.5, 1.0)), 'room_shop_ramen': ((-4.4, -3.0, 2.3), (1.0, 1.8, 1.1)),
        'room_shop_diner': ((-1.0, -3.6, 2.5), (1.0, 2.0, 0.9)), 'room_shop_bar': ((4.8, -4.0, 2.7), (-1.5, 1.5, 0.9)),
        'room_shop_bank': ((-5.0, -4.5, 3.0), (1.0, 3.0, 1.4)), 'room_shop_arcade': ((-4.4, -3.6, 2.4), (2.0, 1.5, 1.0)),
        'room_flat_studio': ((-4.2, -3.9, 2.4), (2.0, 1.5, 0.9)), 'room_flat_penthouse': ((-5.2, -4.4, 2.8), (2.0, 2.0, 1.0)),
        'room_flat_gamer': ((-3.8, -3.6, 2.3), (1.5, 1.5, 0.9)), 'room_flat_loft': ((-4.8, -3.9, 3.2), (2.5, 2.0, 1.2)),
    }
    for ob in objs:
        cam, tgt = views.get(ob.name, ((-3, -3, 2.4), (1, 1, 1)))
        render([ob], os.path.join(out, ob.name + '.png'), cam=cam, target=tgt, lens=17, res=(720, 420), samples=20, floor=False)
