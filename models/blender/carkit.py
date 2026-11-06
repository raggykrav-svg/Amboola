# Amboola car kit: the Blender (bpy) building blocks every car model is made from.
#
# A car is built in a fresh scene, in metres, with the front at +X, the left side at +Y and the ground at Z=0:
#   body   a loft of cross-section "stations" (a low-poly cage) smoothed with Catmull-Clark subdivision,
#          wheel wells (and open cockpits) cut with booleans
#   decals glass, vents, intakes, lights, trims: patches ray-cast onto the body surface, lifted a few mm
#   parts  wings, swan necks, mirrors, exhausts, seats ... small meshes, all joined into one "Body" object
#   wheels Wheel_FL/FR/RL/RR (origin at the hub) and Caliper_* (do not spin)
# export() turns the car to face glTF +Z, writes a Draco .glb and the same bytes as a .glb.js <script>.
# Material names are the contract with the game (index.html buildModelCar swaps them for its own materials).
import bpy, bmesh, math, os, base64
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

def V(*a): return Vector(a)
def lerp(a, b, t): return a + (b - a) * t
def pl(pts, x):
    """piecewise-linear curve through (x, value) points, any x order, clamped at the ends"""
    pts = sorted(pts)
    if x <= pts[0][0]: return pts[0][1]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if x <= x1: return lerp(y0, y1, (x - x0) / (x1 - x0))
    return pts[-1][1]
def srgb(h):
    """'#rrggbb' -> linear RGB tuple"""
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c)
def disc_map(u, v):  # unit square -> unit disc with a clean quad grid (no pole)
    x, y = u * 2 - 1, v * 2 - 1
    return x * math.sqrt(1 - y * y / 2), y * math.sqrt(1 - x * x / 2)
def side(s): return 'left' if s > 0 else 'right'   # +Y is the car's left
def clamp01(x): return 0.0 if x < 0 else 1.0 if x > 1 else x
def both(fn): fn(1); fn(-1)

COLS = 'x zb w zs wb zbl wg zg wr zr zt'.split()
def stations(rows, ys=1.0, dz=0.0):
    """rows of (x, zb, w, zs, wb, zbl, wg, zg, wr, zr, zt) - one half cross-section each, bottom-centre to top-centre:
    zb bottom | w,zs widest point | wb,zbl beltline | wg,zg fender crown or window base | wr,zr hood valley or roof edge
    | zt centre top. ys scales every width, dz lifts every height."""
    out = []
    for r in rows:
        s = dict(zip(COLS, r))
        for k in ('w', 'wb', 'wg', 'wr'): s[k] *= ys
        for k in ('zb', 'zs', 'zbl', 'zg', 'zr', 'zt'): s[k] += dz
        out.append(s)
    return out
def edit(rows, x, **kw):
    """copy of a station table with the station at `x` changed, e.g. edit(T, -2.30, zt=1.0)"""
    out = []
    for r in rows:
        r = list(r)
        if abs(r[0] - x) < 1e-6:
            for k, v in kw.items(): r[COLS.index(k)] = v
        out.append(tuple(r))
    return out

VIEWS = {'front34': (5.4, -4.3, 1.45), 'rear34': (-5.2, -4.5, 2.0), 'side': (0.05, -8.4, 0.95), 'nose': (3.6, -2.3, 1.05), 'tail': (-3.5, -2.4, 1.25),
         'top': (0.3, -3.2, 7.6), 'front': (8.2, 0.0, 1.15), 'rear': (-8.2, 0.0, 1.5)}

# every real car's wheel design, as near as the kit's styles get (see Car.wheels); anything not listed: straight spokes
WHEEL_STYLE = {
    '918': 'y', 'taycangt': 'turbine', 'cayennegt': 'y', 'cayenneeh': 'y', 'macanev': 'turbine',
    'revuelto': 'turbine', 'svj': 'y', 'temerario': 'turbine', 'urusp': 'y',
    'sf90': 'y', '812c': 'y', '12cil': 'turbine', '296gtb': 'y', 'f8': 'y', 'purosangue': 'turbine',
    'w1': 'turbine', '750s': 'turbine', 'artura': 'y', 'gts': 'turbine', 'p1': 'y',
    'tourbillon': 'turbine', 'chironss': 'turbine', 'chironps': 'y', 'divo': 'y', 'bolide': 'disc',
    'roadster2': 'turbine', 'modelsplaid': 'turbine', 'model3p': 'turbine', 'modelxplaid': 'turbine', 'modelyp': 'turbine',
    'cyberbeast': 'disc', 'cybercab': 'disc',
    'jesko': 'y', 'jeskoattack': 'y', 'regera': 'turbine', 'gemera': 'turbine', 'cc850': 'dial',
    'grsupra': 'y', 'lc300': 'y', 'grgt': 'turbine',
    'm2': 'y', 'm4csl': 'y', 'm5': 'y', 'xm': 'turbine', 'r8': 'y', 'rs6': 'y', 'rsetrongt': 'turbine', 'rsq8': 'y', 'devel16': 'mesh',
    'amggt': 'y', 'amgone': 'disc', 'c63': 'y', 'spectre': 'turbine', 'phantom': 'mesh',
    'corvette': 'y', 'nsx': 'y', 'utopia': 'turbine',
    # the classics (classics.py): Borrani / Dunlop wire wheels, the 2000GT's magnesium wheels, the 300 SL's hubcaps,
    # the 911's forged five-leaf wheels
    'etype': 'wire', 'gto': 'wire', 'tgt': 'mag', 'sl300': 'hubcap', 'rs27': 'leaf',
}

class Car:
    def __init__(self, key, paint='#f2c20f', rim='#1b1b1d', caliper='#e3c11b', metal=0.15):
        self.lamp_scale = 1.0
        bpy.ops.wm.read_factory_settings(use_empty=True)
        self.key, self.scene, self.parts, self.bvh, self.body, self.lift = key, bpy.context.scene, [], None, None, 0.0
        mat = self.material
        self.M = {
            'Paint': mat('Paint', srgb(paint), metal=metal, rough=0.3, coat=1.0),
            'Glass': mat('Glass', (0.01, 0.012, 0.015), rough=0.04, coat=1.0),
            'Black': mat('Black', (0.012, 0.012, 0.013), rough=0.55),
            'Gloss': mat('GlossBlack', (0.008, 0.008, 0.009), rough=0.12, coat=1.0),
            'Carbon': mat('Carbon', (0.022, 0.023, 0.026), rough=0.4, coat=0.5),
            'Chrome': mat('Chrome', (0.85, 0.86, 0.88), metal=1.0, rough=0.12),
            'Titanium': mat('Titanium', (0.45, 0.42, 0.40), metal=1.0, rough=0.3),
            'Headlight': mat('Headlight', (0.9, 0.92, 0.95), rough=0.05, emit=(1, 0.97, 0.92), strength=2.0),
            'Taillight': mat('Taillight', (0.35, 0.0, 0.0), rough=0.15, emit=(1, 0.02, 0.01), strength=3.0),
            'Tire': mat('Tire', (0.025, 0.025, 0.027), rough=0.9),
            'Rim': mat('Rim', srgb(rim), metal=0.9, rough=0.35),
            'RimLip': mat('RimLip', (0.7, 0.71, 0.73), metal=1.0, rough=0.2),
            'Disc': mat('Disc', (0.18, 0.18, 0.19), metal=0.9, rough=0.45),
            'Caliper': mat('Caliper', srgb(caliper), metal=0.1, rough=0.35, coat=0.6),
            'Accent': mat('Accent', (0.8, 0.02, 0.02), rough=0.35, coat=0.5),     # tow hooks, badges (red)
            'TireLetter': mat('TireLetter', (0.2, 0.2, 0.21), rough=0.8),       # raised sidewall lettering
            'Logo': mat('Logo', (0.85, 0.85, 0.86), rough=0.3),                  # caliper logo
            # the see-through cabin (open_cabin): clear tinted glass, the lining, seats, dashboard and its screens
            'GlassClear': mat('GlassClear', (0.012, 0.016, 0.02), rough=0.03, coat=1.0, alpha=0.4),
            'Cabin': mat('Cabin', (0.03, 0.031, 0.034), rough=0.9),
            'Leather': mat('Leather', (0.016, 0.016, 0.018), rough=0.45, coat=0.3),
            'Alcantara': mat('Alcantara', (0.05, 0.05, 0.055), rough=0.95),
            'Dash': mat('Dash', (0.012, 0.012, 0.014), rough=0.6),
            'Screen': mat('Screen', (0.01, 0.04, 0.1), rough=0.1, emit=(0.15, 0.55, 1.0), strength=0.5),
            'Plate': mat('Plate', (0.86, 0.87, 0.84), rough=0.4),                 # Japanese number plates (the game paints the number on)
            # real lamps and openings (pocket()): a clear or red glass cover flush with the body, a chrome or dark back
            # behind it, LED light guides that are always lit (DRL), projector lenses, the mesh in a grille, deep black
            'LensClear': mat('LensClear', (0.95, 0.96, 0.97), rough=0.02, coat=1.0, alpha=0.12, transmission=1.0),
            'LensRed': mat('LensRed', (0.5, 0.0, 0.01), rough=0.04, coat=1.0, alpha=0.55, transmission=0.7),
            'LampBack': mat('LampBack', (0.78, 0.80, 0.83), metal=0.85, rough=0.30),   # a silver reflector (reads as a lamp even in a dark studio)
            'TailBack': mat('TailBack', (0.10, 0.0, 0.004), metal=0.5, rough=0.3),
            'DRL': mat('DRL', (0.95, 0.97, 1.0), rough=0.1, emit=(0.92, 0.96, 1.0), strength=6.0),
            'LensGlass': mat('LensGlass', (0.01, 0.012, 0.016), metal=0.3, rough=0.03, coat=1.0),
            'Grille': mat('Grille', (0.012, 0.012, 0.013), metal=0.15, rough=0.6),   # dark mesh: no studio-light sheen in photos
            'Pocket': mat('Pocket', (0.004, 0.004, 0.005), rough=0.85),
            'Cutter': mat('Cutter', (1, 0, 1)),                                   # window cutters' walls, deleted again
        }

    # ------------------------------------------------------------ plumbing
    def material(self, name, color, metal=0.0, rough=0.5, coat=0.0, emit=None, strength=0.0, alpha=1.0, transmission=0.0):
        m = bpy.data.materials.new(name); m.use_nodes = True
        b = m.node_tree.nodes['Principled BSDF']
        if alpha < 1 and not transmission: b.inputs['Alpha'].default_value = alpha
        if transmission: b.inputs['Transmission Weight'].default_value = transmission   # (Cycles photos: real glass; the game uses its own lens)
        b.inputs['Base Color'].default_value = (*color, 1)
        b.inputs['Metallic'].default_value = metal
        b.inputs['Roughness'].default_value = rough
        if coat: b.inputs['Coat Weight'].default_value = coat; b.inputs['Coat Roughness'].default_value = 0.03
        if emit: b.inputs['Emission Color'].default_value = (*emit, 1); b.inputs['Emission Strength'].default_value = strength
        return m
    def link(self, obj):
        self.scene.collection.objects.link(obj); return obj
    def mesh(self, name, bm, mat=None, smooth=True, part=False):
        me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
        if mat is not None: me.materials.append(self.M[mat] if isinstance(mat, str) else mat)
        for p in me.polygons: p.use_smooth = smooth
        o = self.link(bpy.data.objects.new(name, me))
        if part: self.parts.append(o)
        return o
    @staticmethod
    def activate(obj):
        for o in bpy.context.selected_objects: o.select_set(False)
        bpy.context.view_layer.objects.active = obj; obj.select_set(True)
    def apply(self, obj):
        self.activate(obj)
        for mod in list(obj.modifiers): bpy.ops.object.modifier_apply(modifier=mod.name)
    def hit(self, origin, direction):
        h = self.bvh.ray_cast(Vector(origin), Vector(direction).normalized(), 20)
        return h[0], h[1]

    # ------------------------------------------------------------ body
    def loft(self, st, crease_front=0.3, crease_rear=0.75, crease_lines=0.35, crisp_front=0.7, crisp=0.3, crease_all=None, levels=3):
        """the main shell from a station table (see stations()); creases keep nose/tail faces, sill and beltline crisp"""
        def half(s):
            # a flat floor out to a tight sill corner, then a near-upright door skin to the widest point (a real car's
            # section; the old rounder one made every car a bar of soap)
            return [(0, s['zb']), (s['w'] * .84, s['zb']), (s['w'] * .95, lerp(s['zb'], s['zs'], .10)), (s['w'] * .992, lerp(s['zb'], s['zs'], .55)),
                    (s['w'], s['zs']), (s['wb'], s['zbl']), (s['wg'], s['zg']), (s['wr'], s['zr']), (0, s['zt'])]
        def loop(s):
            h = half(s)
            return [V(s['x'], y, z) for y, z in h] + [V(s['x'], -y, z) for y, z in reversed(h[1:-1])]
        bm = bmesh.new()
        rings = [[bm.verts.new(p) for p in loop(s)] for s in st]
        n = len(rings[0])
        for a, b in zip(rings, rings[1:]):
            for j in range(n): bm.faces.new((a[j], a[(j + 1) % n], b[(j + 1) % n], b[j]))
        bm.faces.new(rings[0]); bm.faces.new(list(reversed(rings[-1])))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        if max(bm.faces, key=lambda f: f.calc_center_median().z).normal.z < 0:   # make sure the shell faces outward
            bmesh.ops.reverse_faces(bm, faces=bm.faces)
        cr = bm.edges.layers.float.new('crease_edge')
        # the nose is as crisp as the car asks (a wedge supercar's blade, or by default a rounded nose: a real bonnet
        # flows down into the bumper) and the tail panel is always crisp
        crease_rear = max(crease_rear, 0.8)
        for r, c in ((rings[0], crease_front), (rings[-1], crease_rear)):
            for j in range(n): bm.edges.get((r[j], r[(j + 1) % n]))[cr] = c
        for a, b in zip(rings, rings[1:]):
            for j in (2, 5, n - 2, n - 5): bm.edges.get((a[j], b[j]))[cr] = crease_lines
            if a[0].co.x > crisp_front:                 # front lid shut line + fender crowns
                for j in (6, 7, n - 6, n - 7): bm.edges.get((a[j], b[j]))[cr] = crisp
        for a, b in zip(rings, rings[1:]):              # a crisp shoulder and beltline the whole length of the car
            for j in (5, 6, n - 5, n - 6):
                e = bm.edges.get((a[j], b[j])); e[cr] = max(e[cr], 0.72)
            for j in (4, n - 4):                        # and a soft character line along the widest point of the doors
                e = bm.edges.get((a[j], b[j])); e[cr] = max(e[cr], 0.3)
        if crease_all is not None:                      # flat-panel bodies (Cybertruck): every edge stays sharp
            for e in bm.edges: e[cr] = crease_all
        body = self.mesh('Body', bm, 'Paint')
        for k in ['Glass', 'Black', 'Gloss', 'Carbon', 'Chrome', 'Headlight', 'Taillight', 'Titanium']:
            body.data.materials.append(self.M[k])
        sub = body.modifiers.new('Subsurf', 'SUBSURF'); sub.levels = sub.render_levels = levels
        self.apply(body); self.body = body
        return body

    def subtract(self, bm, solver='EXACT', mat='Black', **flags):
        """boolean-cut a closed bmesh from the body; the cut walls get the cutter's material (black)"""
        cut = self.mesh('cut', bm, mat, smooth=False)
        mod = self.body.modifiers.new('cut', 'BOOLEAN'); mod.operation = 'DIFFERENCE'; mod.object = cut; mod.solver = solver; mod.material_mode = 'TRANSFER'
        for k, v in flags.items(): setattr(mod, k, v)
        self.apply(self.body); bpy.data.objects.remove(cut)

    def sculpt(self, wheels):
        """shape the smooth shell before the wheel wells are cut: muscular fender flares that swell out round every
        wheel (so the doors between them read as a waist), a crisper shoulder, and a tail that tapers in plan view.
        Strength from self.flare_amt (default 0.045 m); 0 turns it off."""
        amt = getattr(self, 'flare_amt', 0.045)
        if not amt: return
        me = self.body.data; vs = me.vertices
        if max(v.co.x for v in vs) - min(v.co.x for v in vs) > 5.6: amt *= 0.4   # buses and trucks: only a hint
        W = max(abs(v.co.y) for v in vs); xs = [v.co.x for v in vs]; xmin, xmax = min(xs), max(xs)
        for wd in wheels.values():
            ra = wd['r'] + wd.get('gap', 0.055); cz = wd.get('cz', wd['r'] + .01)
            for v in vs:
                ay = abs(v.co.y)
                if ay < W * 0.55: continue
                dx, dz = v.co.x - wd['x'], v.co.z - cz; d = math.hypot(dx, dz)
                if d > ra * 2.0 or v.co.z < cz - ra * 0.2 or v.co.z > cz + ra * 1.75: continue
                t = clamp01((ra * 2.0 - d) / (ra * 0.95))            # full strength out to ~1.05 r, gone by 2 r
                t = t * t * (3 - 2 * t)
                side_w = clamp01((ay - W * 0.55) / (W * 0.25))        # only the outer skin, not the bonnet
                v.co.y += math.copysign(amt * t * side_w, v.co.y)
                v.co.z += amt * 0.25 * t * side_w * max(0.0, -dx / ra * 0.0 + (1 if dz > 0 else 0))   # crown lifts a touch
        # a sculpted bonnet: between the front wheels the middle of the lid sits lower than the fender crowns
        F = wheels.get('F'); nx = max(xs)
        if F:
            x0, x1 = F['x'] - 0.7, nx - 0.12
            ztop = {}
            for v in vs:
                if x0 < v.co.x < x1 and abs(v.co.y) < W * 0.62: ztop[round(v.co.x, 2)] = max(ztop.get(round(v.co.x, 2), -9), v.co.z)
            for v in vs:
                if not (x0 < v.co.x < x1): continue
                q = abs(v.co.y) / (W * 0.62)
                if q >= 1: continue
                zt_ = ztop.get(round(v.co.x, 2))
                if zt_ is None or v.co.z < zt_ - 0.12: continue           # only the top skin
                fx = min(clamp01((v.co.x - x0) / 0.35), clamp01((x1 - v.co.x) / 0.3))
                v.co.z -= amt * 0.55 * fx * (1 - q * q) ** 2
        # undercut ends: below the bumper line the nose and the tail are pulled in, so they read as a sharp prow and
        # a diffuser kick instead of the rounded ends of a bar of soap
        zs_ = [v.co.z for v in vs]; zmin = min(zs_); H = max(zs_) - zmin
        for v in vs:
            lo = clamp01((zmin + H * 0.30 - v.co.z) / (H * 0.25))
            if not lo: continue
            f = clamp01((v.co.x - (xmax - (xmax - xmin) * 0.09)) / ((xmax - xmin) * 0.09))
            r_ = clamp01(((xmin + (xmax - xmin) * 0.10) - v.co.x) / ((xmax - xmin) * 0.10))
            v.co.x -= 0.06 * f * f * lo; v.co.x += 0.08 * r_ * r_ * lo
        # tail taper: the last 12 % of the car narrows a little in plan view so the back is not a box
        L = xmax - xmin
        for v in vs:
            u = (xmin + L * 0.12 - v.co.x) / (L * 0.12)
            if u > 0: v.co.y *= 1 - 0.035 * min(u, 1) ** 2
        me.update()

    def arches(self, wheels, gap=0.055, depth=0.32):
        """wheel wells: one boolean cylinder per wheel. wheels = dict(F=dict(x, r, w, y, rim[, cz, gap]), R=...)"""
        self.wheel_spec = wheels
        self.sculpt(wheels)
        for wd in wheels.values():
            for s in (1, -1):
                bm = bmesh.new(); r = wd['r'] + wd.get('gap', gap)
                bmesh.ops.create_cone(bm, cap_ends=True, segments=64, radius1=r, radius2=r, depth=0.9)
                bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, 'X'))
                bmesh.ops.translate(bm, verts=bm.verts, vec=(wd['x'], s * (wd['y'] + depth), wd.get('cz', wd['r'] + .01)))
                self.subtract(bm)
        for p in self.body.data.polygons: p.use_smooth = True

    def cut_box(self, center, size, round_=0.0):
        """open a cockpit / recess: boolean-subtract a (optionally rounded) box"""
        self.open_top = True
        bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
        bmesh.ops.scale(bm, verts=bm.verts, vec=size); bmesh.ops.translate(bm, verts=bm.verts, vec=center)
        if round_:
            bmesh.ops.bevel(bm, geom=list(bm.edges), offset=round_, segments=4, affect='EDGES')
        self.subtract(bm)

    def surface(self):
        """freeze the body shape for ray-casting decals onto it"""
        deps = bpy.context.evaluated_depsgraph_get()
        self.bvh = BVHTree.FromObject(self.body, deps)

    # ------------------------------------------------------------ decals
    def project(self, name, mat, fn, nu, nv, off=.004):
        """fn(u, v) -> (ray origin, ray direction) for u, v in [0, 1]. Builds a quad patch on the first surface hit,
        lifted `off` metres along the surface normal and wound so its faces point the same way as the body."""
        bm = bmesh.new(); grid = []; nsum = Vector()
        for i in range(nu + 1):
            row = []
            for j in range(nv + 1):
                o, d = fn(i / nu, j / nv)
                p, nrm = self.hit(o, d)
                if p is None: row.append(None); continue
                row.append(bm.verts.new(p + nrm * off)); nsum += nrm
            grid.append(row)
        for i in range(nu):
            for j in range(nv):
                q = [grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]]
                if all(q):
                    try: bm.faces.new(q)
                    except ValueError: pass
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
        bmesh.ops.dissolve_degenerate(bm, dist=1e-5, edges=bm.edges)
        bm.normal_update()
        if sum((f.normal.dot(nsum) for f in bm.faces), 0) < 0: bmesh.ops.reverse_faces(bm, faces=bm.faces)
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
        return self._dress(self.mesh(name, bm, mat, part=True), name, mat)
    # names of decals that are openings: intakes, grilles and mouths get a pocket with a mesh set into it; gills, vents,
    # louvres, scoops, ducts and curtains become plain slots
    MESHED = ('grille', 'intake', 'mouth', 'rearbg', 'nostril', 'kidney', 'singleframe', 'pantheon')
    SLOTS = ('gill', 'vent', 'louvre', 'scoop', 'curtain', 'duct')
    def _dress(self, o, name, mat):
        """every car gets real openings and lamps, whatever its script asks for: a dark intake decal becomes a recess with a
        grille mesh inside, a slot becomes a recess, and a plain lamp decal becomes a glass cover over a recessed lamp"""
        if getattr(self, 'lite', False) or self.body is None or name.startswith('li_'): return o
        mname = mat if isinstance(mat, str) else getattr(mat, 'name', '')
        low = name.lower()
        if mname in ('Gloss', 'Black', 'Carbon') and any(k in low for k in self.MESHED + self.SLOTS):
            slot = any(k in low for k in self.SLOTS) and not any(k in low for k in self.MESHED)
            area = sum(p.area for p in o.data.polygons)
            if area < 4e-4: return o
            depth = min(0.10, max(0.03, math.sqrt(area) * 0.35))
            N = self.pocket(o, depth=depth, border=min(0.012, math.sqrt(area) * 0.12), mat='Pocket', wall='Pocket')
            if N is None: return o
            self.rim(o, min(0.012, math.sqrt(area) * 0.1), 'Gloss')
            if slot:   # just the slot: the decal goes
                self.parts.remove(o); bpy.data.objects.remove(o); return None
            o.data.materials.clear(); o.data.materials.append(self.M['Grille'])   # the mesh, set back into the opening
            for v in o.data.vertices: v.co -= o.matrix_world.inverted().to_3x3() @ (N * depth * 0.32)
            return o
        if mname in ('Headlight', 'Taillight') and len(o.data.polygons) >= 2:
            red = mname == 'Taillight'
            N = self.lamp_cover(o, 'LensRed' if red else 'LensClear', depth=0.022 if red else 0.03, back='TailBack' if red else 'LampBack')
            if N is not None and not red:   # a big white decal is a reflector behind the glass; it glows at night
                o.data.materials.clear(); o.data.materials.append(self.M['Headlight'])
        return o
    def rim(self, patch, width=0.008, mat='Gloss'):
        """a thin trim band round a decal's outline, at the surface: the black surround of an intake or a lamp, which also
        hides the stepped edge of the pocket behind it (the skin only moves vertex by vertex)"""
        bm = bmesh.new(); bm.from_mesh(patch.data); bm.transform(patch.matrix_world)
        if all(any(v.is_boundary for v in f.verts) for f in bm.faces):   # a thin slot: split it so it keeps an open middle
            bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=2, use_grid_fill=True)
        ring = self.frame_ring(bm, width)
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if f not in ring], context='FACES')
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
        if not bm.faces: bm.free(); return None
        bm.normal_update()
        for v in bm.verts: v.co += v.normal * 0.0015
        return self.mesh('li_rim', bm, mat, smooth=False, part=True)
    def pocket(self, patch, depth=0.05, border=0.01, mat='Pocket', wall='Pocket'):
        """a recess `depth` deep behind a decal patch, for a lamp or an opening: the patch thickened into a block and cut
        out of the body with an exact boolean, so its edge is as crisp as the decal's outline; the floor gets `mat` and
        the walls `wall`. If the cut goes wrong (the body changes size) it is undone and the skin is pushed back
        instead (_pocket_move). Returns the patch's mean normal (None if nothing changed)."""
        if getattr(self, 'lite', False) or self.body is None: return None
        bm = bmesh.new(); bm.from_mesh(patch.data); bm.transform(patch.matrix_world); bm.normal_update()
        nsum = sum((f.normal * f.calc_area() for f in bm.faces), Vector())
        if not bm.faces or nsum.length < 1e-9: bm.free(); return None
        N = nsum.normalized(); out = 0.012
        def reach(p, n):   # how far in from p the shell's far side is (the block stops short of it)
            h = self.bvh.ray_cast(p - n * 0.02, -n, 3.0) if self.bvh else (None,)
            return (h[0] - p).length if h[0] is not None else 3.0
        blk = self.block(bm, out=out, depth=depth + out, reach=reach)
        cut = self.mesh('cut', blk, None, smooth=False)
        cut.data.materials.append(self.M[mat]); cut.data.materials.append(self.M[wall])
        for p in cut.data.polygons: p.material_index = 0 if p.normal.dot(N) < -0.5 else 1
        me = self.body.data; before = me.copy(); nv0 = len(me.vertices)
        bb0 = [min(v.co[i] for v in me.vertices) for i in range(3)] + [max(v.co[i] for v in me.vertices) for i in range(3)]
        mod = self.body.modifiers.new('pocket', 'BOOLEAN'); mod.operation = 'DIFFERENCE'; mod.object = cut; mod.solver = 'EXACT'; mod.material_mode = 'TRANSFER'
        try: self.apply(self.body); ok = True
        except Exception: ok = False
        bpy.data.objects.remove(cut)
        me = self.body.data
        if ok:
            bb1 = [min(v.co[i] for v in me.vertices) for i in range(3)] + [max(v.co[i] for v in me.vertices) for i in range(3)]
            ok = len(me.vertices) > nv0 * 0.9 and max(abs(a - b) for a, b in zip(bb0, bb1)) < 0.02 and len(me.vertices) != nv0
        if not ok:   # put the body back and push the skin instead
            for m_ in list(self.body.modifiers): self.body.modifiers.remove(m_)
            old = self.body.data; self.body.data = before; bpy.data.meshes.remove(old)
            return self._pocket_move(patch, depth, border, mat, wall)
        bpy.data.meshes.remove(before)
        for p in me.polygons: p.use_smooth = True
        self.surface()
        return N
    def _pocket_move(self, patch, depth=0.05, border=0.01, mat='Pocket', wall='Pocket'):
        """the fallback recess: skin under the patch moves straight back along the patch's mean normal; within `border`
        of its edge it moves part of the way. Faces wholly inside get `mat`, the walls `wall`."""
        if getattr(self, 'lite', False) or self.body is None: return None
        me = self.body.data; Mw = patch.matrix_world
        bm = bmesh.new(); bm.from_mesh(patch.data); bm.transform(Mw); bmesh.ops.triangulate(bm, faces=bm.faces); bm.normal_update()
        nsum = sum((f.normal * f.calc_area() for f in bm.faces), Vector())
        if not bm.faces or nsum.length < 1e-9: bm.free(); return None
        N = nsum.normalized()
        edges = [(e.verts[0].co.copy(), e.verts[1].co.copy()) for e in bm.edges if len(e.link_faces) == 1]
        pts = [v.co.copy() for v in bm.verts]; tree = BVHTree.FromBMesh(bm); bm.free()
        pad = 0.03
        lo = Vector((min(p.x for p in pts) - pad, min(p.y for p in pts) - pad, min(p.z for p in pts) - pad))
        hi = Vector((max(p.x for p in pts) + pad, max(p.y for p in pts) + pad, max(p.z for p in pts) + pad))
        def seg_d(p, a, b):
            ab = b - a; t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared, 1e-12))); return (a + ab * t - p).length
        w = {}
        for v in me.vertices:
            co = v.co
            if not (lo.x <= co.x <= hi.x and lo.y <= co.y <= hi.y and lo.z <= co.z <= hi.z): continue
            if v.normal.dot(N) < 0.25: continue                       # only the skin that faces the way the patch does
            h = tree.ray_cast(co - N * 0.006, N, 0.045)
            if h[0] is None: continue
            t = clamp01(min(seg_d(h[0], a, b) for a, b in edges) / max(border, 1e-4)); w[v.index] = t * t * (3 - 2 * t)
        if len(w) < 3: return None
        for i, t in w.items(): me.vertices[i].co -= N * depth * t
        names = [m.name for m in me.materials]
        def slot(m):
            mm = self.M[m]
            if mm.name not in names: me.materials.append(mm); names.append(mm.name)
            return names.index(mm.name)
        si, sw = slot(mat), slot(wall)
        for p in me.polygons:
            ts = [w.get(i, -1.0) for i in p.vertices]
            if min(ts) < 0: continue
            p.material_index = si if min(ts) > 0.97 else sw
        me.update(); self.surface()
        return N
    def lamp_cover(self, patch, lens='LensClear', depth=0.03, back='LampBack', shrink=0.88):
        """a lamp from a plain decal: a glass cover where the decal was, the body recessed behind it, and the decal itself
        moved down into the recess (a little smaller, so a dark rim of the lamp's back shows round it)"""
        cover = patch.copy(); cover.data = patch.data.copy(); self.link(cover); self.parts.append(cover)
        cover.name = 'li_lens'; cover.data.materials.clear(); cover.data.materials.append(self.M[lens])
        N = self.pocket(patch, depth=depth, border=min(0.01, depth * 0.4), mat=back, wall='Gloss')
        if N is None: return None
        self.rim(patch, min(0.008, depth * 0.3), 'Gloss')
        Minv = patch.matrix_world.inverted().to_3x3(); vs = patch.data.vertices
        if len(vs):
            c = sum((v.co for v in vs), Vector()) / len(vs)
            for v in vs: v.co = c + (v.co - c) * shrink - Minv @ (N * depth * 0.7)
        for v in cover.data.vertices: v.co += Minv @ (N * 0.002)
        return N
    VIEW = {'front': lambda a, b: (V(6, a, b), V(-1, 0, 0)), 'rear': lambda a, b: (V(-6, a, b), V(1, 0, 0)),
            'top': lambda a, b: (V(a, b, 5), V(0, 0, -1)), 'left': lambda a, b: (V(a, 5, b), V(0, -1, 0)),
            'right': lambda a, b: (V(a, -5, b), V(0, 1, 0))}
    def decal(self, name, mat, view, u0, u1, v0, v1, nu=12, nv=4, off=.004):
        """axis-aligned patch: (u, v) span the rectangle seen from `view` (front/rear: y,z  top: x,y  left/right: x,z)"""
        return self.project(name, mat, lambda u, v: self.VIEW[view](lerp(u0, u1, u), lerp(v0, v1, v)), nu, nv, off)
    def slanted(self, name, mat, s, x0, x1, z0, z1, lean=0.0, nu=4, nv=6, off=.004):
        """side patch (left s=1 / right s=-1) whose rear edge leans back by `lean` metres from bottom to top"""
        return self.project(name, mat, lambda u, v: self.VIEW[side(s)](lerp(x0, x1, u) - v * lean, lerp(z0, z1, v)), nu, nv, off)
    def fan(self, name, mat, ox, z0, z1, a0, a1, nu=40, nv=3, off=.004, rear=True):
        """band wrapped round the nose/tail: rays fanned in plan view from (ox, 0) inside the car, angles in radians
        from straight back (rear=True) or straight ahead"""
        sx = -1 if rear else 1
        return self.project(name, mat, lambda u, v: (V(ox, 0, lerp(z0, z1, v)), V(sx * math.cos(lerp(a0, a1, u)), math.sin(lerp(a0, a1, u)), 0)), nu, nv, off)
    def basis(self, facing):
        f = Vector(facing).normalized(); e1 = V(0, 0, 1).cross(f).normalized(); return f, e1, f.cross(e1)
    def oval(self, name, mat, centre, facing, rx, ry, off, n=10, ring=None):
        """oval patch projected along -facing; ring=(inner scale) makes an annulus instead"""
        f, e1, e2 = self.basis(facing); c = Vector(centre)
        if ring:
            fn = lambda u, v: (c + f * 1.5 + (e1 * rx * math.cos(u * 2 * math.pi) + e2 * ry * math.sin(u * 2 * math.pi)) * lerp(ring, 1, v), -f)
            return self.project(name, mat, fn, 48, 2, off)
        def fn(u, v):
            x, y = disc_map(u, v); return c + f * 1.5 + e1 * rx * x + e2 * ry * y, -f
        return self.project(name, mat, fn, n, n, off)
    def rect(self, name, mat, centre, facing, w, h, off, nu=8, nv=4, slant=0.0, taper=0.0):
        """rectangle projected along -facing; slant shears the top sideways, taper narrows the top"""
        f, e1, e2 = self.basis(facing); c = Vector(centre)
        def fn(u, v):
            x = (u - .5) * w * (1 - taper * v) + slant * (v - .5); y = (v - .5) * h
            return c + f * 1.5 + e1 * x + e2 * y, -f
        return self.project(name, mat, fn, nu, nv, off)

    # ------------------------------------------------------------ glass
    def windscreen(self, base_x, top_x, base_z, slope, hw_base, hw_top, sweep=0.20, trim=0.035, n=(20, 10)):
        """raked windscreen; its outline is swept back towards the A-pillars by `sweep` metres"""
        N = V(slope, 0, 1).normalized()
        def ws(u, v, grow=0.0):
            y = lerp(-1, 1, u) * lerp(hw_base + grow, hw_top + grow, v)
            x = lerp(base_x + grow * .6, top_x - grow * .6, v) - sweep * (y / hw_base) ** 2 * (1 - v * .6)
            return V(x, y, base_z + (base_x - x) * slope) + N * 2, -N
        if trim: self.project('ws_trim', 'Gloss', lambda u, v: ws(u, v, trim), *n, off=.003)['grow'] = trim
        self.project('windscreen', 'Glass', ws, *n, off=.005)
    def rear_window(self, x_bot, x_top, z_bot, slope, hw_bot, hw_top, bulge=0.06, trim=0.03, n=(16, 8)):
        N = V(-slope, 0, 1).normalized()
        def rw(u, v, grow=0.0):
            y = lerp(-1, 1, u) * lerp(hw_bot + grow, hw_top + grow, v)
            x = lerp(x_bot - grow * .5, x_top + grow * .5, v) + bulge * (y / max(hw_bot, hw_top)) ** 2
            return V(x, y, z_bot + (x - x_bot) * slope) + N * 2, -N
        if trim: self.project('rw_trim', 'Gloss', lambda u, v: rw(u, v, trim), *n, off=.003)['grow'] = trim
        self.project('rearwindow', 'Glass', rw, *n, off=.005)
    def side_glass(self, top, bot, pillars=(), trim=0.022, pillar_w=0.025, frame='Gloss', nu=40):
        """side windows between a top and bottom outline [(x, z), ...]; `pillars` are x positions of black dividers"""
        x0, x1 = max(p[0] for p in bot + top), min(p[0] for p in bot + top)
        if self.bvh is not None:
            # the glass stops where the body turns over into the roof: seen from the side, a window drawn higher lands
            # on the roof skin, and cutting the cabin open would then take the roof away too
            def steep(x, z):
                p, n = self.hit((x, 5, z), (0, -1, 0))
                return p is None or abs(n.y) > 0.42
            top2 = []
            for i in range(25):
                x = lerp(x0, x1, i / 24); z, zb = pl(top, x), pl(bot, x)
                while z > zb + 0.04 and not steep(x, z): z -= 0.008
                top2.append((x, max(z, zb + 0.012)))
            top = top2
        def dlo(s, grow=0.0):
            def fn(u, v):
                x = lerp(x0 + grow * 1.6, x1 - grow * 1.8, u)
                zb, zt = pl(bot, x) - grow, pl(top, x) + grow
                return self.VIEW[side(s)](x, lerp(zb, max(zt, zb + .012), v))
            return fn
        for s in (1, -1):
            if trim: self.project('dlo_trim', frame, dlo(s, trim), nu, 8, off=.003)['grow'] = trim
            self.project('sideglass', 'Glass', dlo(s), nu, 8, off=.005)
            for px in pillars:
                self.decal('pillar', frame, side(s), px - pillar_w / 2, px + pillar_w / 2, pl(bot, px) - .01, pl(top, px) + .01, 1, 8, off=.007)

    # ------------------------------------------------------------ lights
    def headlight_911(self, c, f, rx=0.112, ry=0.090, ring=1.14, bowl='Chrome', drl=(0.23, 0.22, 0.63), dome=0.0):
        """992-style: an oval glass cover in a gloss-black surround over a recessed bowl (chrome, or dark like the 992's),
        a chrome-ringed projector in the middle and the 4-point LED signature (drl = dot width, dot height and distance
        from the middle, as fractions of rx/ry). Projected along -f, so a lamp facing forward onto a sloping fender is
        round from the front and a long teardrop from the side, like the real thing. dome>0 bulges the glass out of the
        fender by that much at its middle (the 911's frog eyes)."""
        rx, ry = rx * self.lamp_scale, ry * self.lamp_scale
        for s in (1, -1):
            cs, fs = V(c[0], s * c[1], c[2]), V(f[0], s * f[1], f[2])
            fn, e1, e2 = self.basis(fs)
            self.oval('headlight_ring', 'Gloss', cs, fs, rx * ring, ry * ring, .004, ring=0.80)
            lens = self.oval('li_lens', 'LensClear', cs, fs, rx, ry, .006, n=14 if dome else 10)
            if self.pocket(lens, depth=0.05, border=0.012, mat='LampBack' if bowl == 'Chrome' else 'Gloss', wall='Gloss') is None:
                lens.data.materials.clear(); lens.data.materials.append(self.M[bowl])   # (no room for a recess: the old flat lamp)
            self.oval('li_projring', 'Chrome', cs, fs, rx * .40, ry * .41, .006, ring=0.68)
            self.oval('li_projector', 'LensGlass', cs, fs, rx * .29, ry * .30, .008, n=6)
            self.oval('li_core', 'Headlight', cs, fs, rx * .11, ry * .11, .011, n=4)
            for k in range(4):
                a = k * math.pi / 2 + math.pi / 4
                self.oval('li_drl', 'DRL', cs + (e1 * math.cos(a) * rx + e2 * math.sin(a) * ry) * drl[2], fs, rx * drl[0], ry * drl[1], .010, n=4)
            if dome:   # the glass bulges out of the fender (the lamp inside stays where it is)
                for v in lens.data.vertices:
                    d = v.co - cs; x, y = d.dot(e1) / rx, d.dot(e2) / ry
                    v.co += fn * dome * max(0.0, 1 - x * x - y * y)
    def _lamp_unit(self, cs, fs, w, h, sl, taper, inner, depth=0.045, ring=(1.12, 1.2)):
        """one recessed headlight: a gloss-black surround, a clear glass cover, the body pushed back behind it (a chrome
        back) and `inner(at, fs)` placing what sits inside (at(px, py) maps -0.5..0.5 across and up the lamp)"""
        self.rect('headlight_ring', 'Gloss', cs, fs, w * ring[0], h * ring[1], .004, 12, 5, slant=sl, taper=taper)
        lens = self.rect('li_lens', 'LensClear', cs, fs, w, h, .006, 12, 5, slant=sl, taper=taper)
        if self.pocket(lens, depth=depth, border=min(0.012, h * 0.18), mat='LampBack', wall='Gloss') is None:
            lens.data.materials.clear(); lens.data.materials.append(self.M['Chrome'])
        _, e1, e2 = self.basis(fs)
        inner(lambda px, py: cs + e1 * (px * w * (1 - taper * (py + .5)) + sl * py) + e2 * py * h, fs, e1, e2)
    def _projector(self, c, fs, r):
        """a projector module: chrome ring, dark glass lens, the bulb's glow (the 'Headlight' material: lit at night)"""
        self.oval('li_projring', 'Chrome', c, fs, r * 1.25, r * 1.25, .006, ring=.72)
        self.oval('li_projector', 'LensGlass', c, fs, r, r, .008, n=5)
        self.oval('li_core', 'Headlight', c, fs, r * .42, r * .42, .011, n=4)
    def headlight_quad(self, c, f, w, h, slant=0.0, taper=0.0, dots=4):
        """Taycan / Cayenne style: a recessed lamp behind glass with four LED points in a 2x2 grid; dots='row': a slim
        LED light guide along the lamp and two projectors (most modern cars)"""
        w, h = w * self.lamp_scale, h * self.lamp_scale
        for s in (1, -1):
            cs, fs = V(c[0], s * c[1], c[2]), V(f[0], s * f[1], f[2]); sl = s * slant
            def inner(at, fs, e1, e2):
                if dots == 4:
                    for px, py in ((-.25, .22), (.25, .22), (-.25, -.22), (.25, -.22)):
                        self.oval('li_drl', 'DRL', at(px, py), fs, w * .11, h * .14, .010, n=4)
                    self._projector(at(0, 0), fs, min(w, h) * .16)
                else:
                    self.rect('li_drl', 'DRL', at(0, .30), fs, w * .9, max(0.008, h * .14), .010, 12, 1, slant=sl, taper=taper * .5)
                    for px in (-.24, .12):
                        self._projector(at(s * px, -.08), fs, min(h * .26, w * .12))
            self._lamp_unit(cs, fs, w, h, sl, taper, inner, depth=min(0.05, max(0.03, h * 0.45)))
    def lamp(self, c, f, w, h, style='quad', slant=0.0, taper=0.0, mirror=True):
        """a detailed recessed headlight on both sides: gloss-black surround, glass cover, chrome back, then per style
        'quad'   Porsche 4-point LED signature (four bright pads in a 2x2 grid) round a projector
        'tesla'  slim lamp: LED eyebrow along the top edge + two projector lenses
        'strip'  one long LED light guide (split-light upper unit)"""
        w, h = w * self.lamp_scale, h * self.lamp_scale
        for s in ((1, -1) if mirror else (1,)):
            cs, fs = V(c[0], s * c[1], c[2]), V(f[0], s * f[1], f[2]); sl = s * slant
            def inner(at, fs, e1, e2):
                if style == 'strip':
                    self.rect('li_drl', 'DRL', at(0, 0), fs, w * .96, h * .38, .010, 12, 2, slant=sl, taper=taper); return
                if style == 'quad':
                    for px, py in ((-.2, .2), (.2, .2), (-.2, -.2), (.2, -.2)):
                        self.rect('li_drl', 'DRL', at(px, py), fs, w * .2, h * .2, .010, 3, 3)
                    self._projector(at(0, 0), fs, min(w, h) * .14)
                else:   # tesla
                    self.rect('li_drl', 'DRL', at(0, .36), fs, w * .92, h * .12, .010, 10, 1, slant=sl * .3, taper=taper)
                    for px in (-.22, .18):
                        self._projector(at(px, -.12), fs, h * .24)
            self._lamp_unit(cs, fs, w, h, sl, taper, inner, depth=min(0.05, max(0.025, h * 0.5)), ring=(1.1, 1.28))
    def curtain(self, c, f, w, h, slant=0.0, mat='Gloss'):
        """vertical air-curtain intake at the bumper corners (both sides): a real slot (see _dress)"""
        for s in (1, -1):
            self.rect('curtain', mat, V(c[0], s * c[1], c[2]), V(f[0], s * f[1], f[2]), w, h, .005, 3, 8, slant=s * slant)
    def drl_strip(self, c, f, w, h, slant=0.0):
        """a slim LED light guide in a gloss-black slot (always lit)"""
        w, h = w * self.lamp_scale, h * self.lamp_scale
        for s in (1, -1):
            cs, fs = V(c[0], s * c[1], c[2]), V(f[0], s * f[1], f[2])
            self.rect('drl_slot', 'Gloss', cs, fs, w * 1.06, h * 1.8, .004, slant=s * slant, nu=6, nv=2)
            self.rect('li_drl', 'DRL', cs, fs, w, h, .007, slant=s * slant, nu=6, nv=2)
    def light_bar(self, ox, z0, z1, ang, bg=0.02, bar_ang=None, frac=0.45):
        """full-width rear light bar fanned round the tail corners: a gloss-black band, a dark red recessed strip, a thin
        bright LED line inside it and a red glass cover over it"""
        self.fan('taillight_bg', 'Gloss', ox, z0 - bg, z1 + bg, -ang * 1.02, ang * 1.02, 60, 3, off=.003)
        zc = (z0 + z1) / 2; hz = (z1 - z0) * frac / 2; A = bar_ang or ang
        lens = self.fan('li_lens', 'LensRed', ox, zc - hz * 1.6, zc + hz * 1.6, -A, A, 60, 3, off=.006)
        self.pocket(lens, depth=0.018, border=min(0.008, hz), mat='TailBack', wall='Gloss')
        self.fan('li_led', 'Taillight', ox, zc - hz * .55, zc + hz * .55, -A * .995, A * .995, 60, 2, off=.004)
    def tail_clusters(self, ox, z0, z1, a0, a1):
        """rear lamps at the corners: a red glass cover over a recessed dark-red lamp with LED bars inside. The lamps are
        fanned from (ox, 0) at angles a0..a1; when that puts them in the middle of the tail (angles worked out for an
        older body), they are turned out to the corners, where a real car has them. Returns the angles used."""
        a0, a1 = self._corner_fan(ox, (z0 + z1) / 2, a0, a1)
        for s in (1, -1):
            lens = self.fan('li_lens', 'LensRed', ox, z0, z1, s * a0, s * a1, 12, 4, off=.006)
            if self.pocket(lens, depth=0.03, border=min(0.01, (z1 - z0) * .2), mat='TailBack', wall='Gloss') is None:
                lens.data.materials.clear(); lens.data.materials.append(self.M['Taillight']); continue
            self.rim(lens, min(0.008, (z1 - z0) * .15), 'Gloss')
            m = (z1 - z0)
            for f0, f1 in ((.18, .34), (.62, .78)):   # two LED bars across the lamp
                self.fan('li_led', 'Taillight', ox, z0 + m * f0, z0 + m * f1, s * (a0 + (a1 - a0) * .06), s * (a1 - (a1 - a0) * .06), 10, 1, off=.005)
        return a0, a1
    def _corner_fan(self, ox, z, a0, a1, wide=0.30):
        """the fan angles a0..a1 from (ox, 0, z) moved out to the tail's corner if their outer edge falls short of 72% of
        the body's half width there: the outer edge goes to where the tail turns into the side (so the lamp wraps
        round a little, like a real one) and the lamp keeps its width, at least `wide` m"""
        def at(a):
            p, n = self.hit(V(ox, 0, z), V(-math.cos(a), math.sin(a), 0))
            return (abs(p.y), n) if p is not None else (None, None)
        y1, _ = at(a1); y0, _ = at(a0)
        xs = [self.hit(V(ox - d, 6, z), V(0, -1, 0))[0] for d in (0.05, 0.15, 0.25)]
        W = max((abs(p.y) for p in xs if p is not None), default=None)
        if W is None or y1 is None or y1 >= 0.72 * W: return a0, a1
        a, ya = a1, y1
        while a < 1.5:
            y, n = at(a + 0.015)
            if y is None: break                                  # (a fan from outside the body can run off it)
            a, ya = a + 0.015, y
            if abs(n.y) > 0.7 or y > 0.985 * W: break
        width = max(wide, (y1 - y0) if y0 is not None else wide)
        b = a
        while b > 0.02:
            y, _ = at(b)
            if y is None or y <= ya - width: break
            b -= 0.015
        return b, a

    # ------------------------------------------------------------ parts
    def box(self, name, mat, center, size, rot=(0, 0, 0), bevel=0.0, sub=0, smooth=False):
        bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
        bmesh.ops.scale(bm, verts=bm.verts, vec=size)
        for ax, a in zip('XYZ', rot):
            if a: bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(a, 3, ax))
        bmesh.ops.translate(bm, verts=bm.verts, vec=center)
        o = self.mesh(name, bm, mat, smooth=smooth or bool(sub))
        if bevel: m = o.modifiers.new('bev', 'BEVEL'); m.width = bevel; m.segments = 3
        if sub: m = o.modifiers.new('sub', 'SUBSURF'); m.levels = sub
        if bevel or sub: self.apply(o)
        self.parts.append(o); return o
    def cylinder(self, name, mat, center, r, depth, axis='X', segs=24, caps=True, r2=None):
        bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=caps, segments=segs, radius1=r, radius2=r2 if r2 is not None else r, depth=depth)
        if axis == 'X': bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(-math.pi / 2, 3, 'Y'))
        if axis == 'Y': bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, 'X'))
        bmesh.ops.translate(bm, verts=bm.verts, vec=center)
        return self.mesh(name, bm, mat, part=True)
    def mirrors(self, x, y, z, size=(0.15, 0.20, 0.095), stalk=0.11, mat='Paint'):
        """door mirrors: a housing of rounded-rectangle sections (flat at the back where the chrome glass sits, a smooth
        dome in front) on a slim black arm that reaches in and down to a base on the door"""
        d, w, h = size; segs = 24
        def rr(a, sw, sh):   # a point on a rounded rectangle (superellipse) of half sizes sw, sh
            ca, sa = math.cos(a), math.sin(a)
            return math.copysign(abs(ca) ** 0.55, ca) * sw, math.copysign(abs(sa) ** 0.55, sa) * sh
        for s in (1, -1):
            bm = bmesh.new(); rings = []; xb = x - d / 2
            for t, kw, kh in ((0, 1, 1), (0.015, 1, 1), (0.3, .98, .97), (0.6, .9, .86), (0.85, .68, .64), (1, .3, .3)):
                rings.append([bm.verts.new((xb + t * d, s * y + dy, z + dz)) for dy, dz in [rr(2 * math.pi * i / segs, w / 2 * kw, h / 2 * kh) for i in range(segs)]])
            for a_, b_ in zip(rings, rings[1:]):
                for i in range(segs): bm.faces.new((a_[i], a_[(i + 1) % segs], b_[(i + 1) % segs], b_[i]))
            bm.faces.new(list(reversed(rings[0]))); bm.faces.new(rings[-1])
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
            o = self.mesh('mirror', bm, mat); m = o.modifiers.new('sub', 'SUBSURF'); m.levels = 2; self.apply(o); self.parts.append(o)
            g = bmesh.new()
            f = g.faces.new([g.verts.new((xb - 0.004, s * y + dy, z + dz)) for dy, dz in [rr(2 * math.pi * i / segs, w / 2 * .84, h / 2 * .78) for i in range(segs)]])
            f.normal_update()
            if f.normal.x > 0: f.normal_flip()
            self.mesh('mirrorglass', g, 'Chrome', part=True)
            # the arm, from under the housing to the door just below the window line
            a = Vector((x + d * 0.1, s * (y - w * 0.3), z - h * 0.2))
            hp, hn = self.hit((x + d * 0.1, s * y, z - h / 2 - 0.035), (0, -s, 0))
            if hp is None or abs(hp.y - a.y) > 0.4:
                self.box('mirrorstalk', 'Gloss', (x, s * (y - w / 2 - stalk / 2 + .02), z - .04), (0.05, stalk, 0.025)); continue
            b = hp + hn * 0.006
            self.slab('mirrorarm', 'Gloss', (a + b) / 2, b - a, (1, 0, 0), (b - a).length / 2 + 0.01, 0.022, 0.011, bevel=0.005)
            self.slab('mirrorbase', 'Gloss', hp + hn * 0.007, (1, 0, 0), hn, 0.055, 0.032, 0.007, bevel=0.004)
    def exhaust(self, y, z, r=0.048, shape='round', w=None, h=None, depth=0.16, mat='Titanium', mirror=True):
        """tailpipe pushed through the rear bumper: round tube or a rounded rectangle (w x h)"""
        for s in ((1, -1) if mirror and y else (1,)):
            p, _ = self.hit((-6, s * y, z), (1, 0, 0))
            px = (p.x if p else -2.3) + .02
            if shape == 'round':
                self.cylinder('exhaust', mat, (px, s * y, z), r, depth, caps=False)
                self.cylinder('exhaustin', 'Black', (px + .01, s * y, z), r * .9, depth * .9)
            else:   # flush rounded-rectangle tip
                self.box('exhaust', mat, (px + .03, s * y, z), (0.10, w, h), bevel=min(w, h) * .3)
                self.box('exhaustin', 'Black', (px - .022, s * y, z), (0.01, w * .80, h * .66))

    def airfoil(self, chord, thick, camber=-0.05, n=14):
        up, lo = [], []
        for i in range(n + 1):
            t = (1 - math.cos(math.pi * i / n)) / 2
            yt = 5 * thick * (0.2969 * math.sqrt(t) - 0.126 * t - 0.3516 * t ** 2 + 0.2843 * t ** 3 - 0.1036 * t ** 4)
            cb = camber * 4 * t * (1 - t)                        # negative camber = upside-down airfoil = downforce
            up.append((t, cb + yt)); lo.append((t, cb - yt))
        pts = up + list(reversed(lo[1:-1]))
        return [(-t * chord, z * chord) for t, z in pts]           # leading edge at local x=0, chord runs towards -x
    def wing(self, le_x, le_z, chord, span, aoa=-7, thick=0.13, mat='Carbon', camber=-0.05, name='wing'):
        prof = self.airfoil(chord, thick, camber); ca, sa = math.cos(math.radians(aoa)), math.sin(math.radians(aoa))
        prof = [(le_x + x * ca - z * sa, le_z + x * sa + z * ca) for x, z in prof]
        bm = bmesh.new()
        a = [bm.verts.new((x, -span / 2, z)) for x, z in prof]; b = [bm.verts.new((x, span / 2, z)) for x, z in prof]
        k = len(prof)
        for i in range(k): bm.faces.new((a[i], a[(i + 1) % k], b[(i + 1) % k], b[i]))
        bm.faces.new(a); bm.faces.new(list(reversed(b)))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        return self.mesh(name, bm, mat, part=True)
    def plate(self, name, mat, pts, y, t=0.015):
        """flat plate in the XZ plane at lateral position y (end plates, fins)"""
        for s in (1, -1):
            bm = bmesh.new()
            a = [bm.verts.new((x, s * y, z)) for x, z in pts]; b = [bm.verts.new((x, s * (y + t), z)) for x, z in pts]
            k = len(pts)
            for i in range(k): bm.faces.new((a[i], a[(i + 1) % k], b[(i + 1) % k], b[i]))
            bm.faces.new(a); bm.faces.new(list(reversed(b)))
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
            self.mesh(name, bm, mat, smooth=False, part=True)
    def blade(self, name, mat, ctrl, y, w0=0.085, w1=0.055, t=0.022):
        """flat strut swept along a Catmull-Rom path in the XZ plane (swan necks, wing uprights)"""
        ctrl = [Vector(c) for c in ctrl]; path = []
        for i in range(len(ctrl) - 1):
            p0, p1, p2, p3 = ctrl[max(i - 1, 0)], ctrl[i], ctrl[i + 1], ctrl[min(i + 2, len(ctrl) - 1)]
            for k in range(8):
                tt = k / 8
                path.append(0.5 * ((2 * p1) + (-p0 + p2) * tt + (2 * p0 - 5 * p1 + 4 * p2 - p3) * tt * tt + (-p0 + 3 * p1 - 3 * p2 + p3) * tt ** 3))
        path.append(ctrl[-1])
        for s in (1, -1):
            bm = bmesh.new(); secs = []
            for i, p in enumerate(path):
                tg = (path[min(i + 1, len(path) - 1)] - path[max(i - 1, 0)]).normalized()
                nn = V(-tg.z, 0, tg.x); w = lerp(w0, w1, i / (len(path) - 1)) / 2
                secs.append([bm.verts.new(p + nn * a + V(0, s * y + b, 0)) for a, b in ((-w, -t / 2), (w, -t / 2), (w, t / 2), (-w, t / 2))])
            for a, b in zip(secs, secs[1:]):
                for j in range(4): bm.faces.new((a[j], a[(j + 1) % 4], b[(j + 1) % 4], b[j]))
            bm.faces.new(secs[0]); bm.faces.new(list(reversed(secs[-1])))
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
            self.mesh(name, bm, mat, smooth=False, part=True)
    def deck_z(self, x, y=0.0):
        p, _ = self.hit((x, y, 5), (0, 0, -1)); return p.z if p else 1.0
    def swan_wing(self, le_x, le_z, chord, span, neck_x, neck_y, aoa=-7, flap=None, endplate=None, mat='Carbon'):
        """wing hung from swan necks (struts that rise from the deck and grab the wing from above)"""
        self.wing(le_x, le_z, chord, span, aoa, mat=mat)
        if flap: self.wing(flap[0], flap[1], flap[2], span, flap[3], thick=0.10, mat=mat, name='flap')   # flap = (le_x, le_z, chord, aoa)
        if endplate: self.plate('endplate', mat, endplate, span / 2 + .005)
        top = le_z + 0.06
        dz = self.deck_z(neck_x, neck_y)
        self.blade('neck', mat, [(neck_x, 0, dz - .03), (neck_x + .04, 0, lerp(dz, top, .53)), (neck_x, 0, top + .04),
                                 (neck_x - .12, 0, top + .07), (neck_x - .21, 0, top)], neck_y)
    def post_wing(self, le_x, le_z, chord, span, post_x, post_y, aoa=-6, endplate=None, mat='Carbon', post_mat=None, thick=0.13):
        """wing on conventional uprights standing on the deck"""
        self.wing(le_x, le_z, chord, span, aoa, thick=thick, mat=mat)
        if endplate: self.plate('endplate', mat, endplate, span / 2 + .005)
        dz = self.deck_z(post_x, post_y)
        self.blade('upright', post_mat or mat, [(post_x, 0, dz - .03), (post_x - .03, 0, (dz + le_z) / 2), (post_x - .06, 0, le_z + .01)], post_y, 0.16, 0.12, 0.02)

    def naca(self, x0, x1, y, w0, w1, mat='Gloss'):
        """NACA duct on a hood/deck seen from above: narrow lip at x0 widening to w1 at x1 (both sides of y=0 if y)"""
        for s in ((1, -1) if y else (1,)):
            self.project('naca', mat, lambda u, v: self.VIEW['top'](lerp(x0, x1, v), s * y + (u - .5) * lerp(w0, w1, v ** 1.6)), 4, 8)
    def arch_trim(self, width=0.065, mat='Black', a0=-0.25, a1=math.pi + 0.25):
        """cladding round each wheel arch (Dakar, SUVs): a band just outside the wheel-well edge on the body side"""
        for wd in self.wheel_spec.values():
            r = wd['r'] + wd.get('gap', .055); cz = wd.get('cz', wd['r'] + .01)
            for s in (1, -1):
                self.project('archtrim', mat, lambda u, v: self.VIEW[side(s)](wd['x'] + math.cos(lerp(a0, a1, u)) * (r + v * width),
                                                                            cz + math.sin(lerp(a0, a1, u)) * (r + v * width)), 32, 2, off=.006)
    def spoiler(self, le_x, le_z, chord, span, aoa=-4, mat='Paint', strut_y=0.35, strut_mat='Gloss', thick=0.10):
        """deployable spoiler blade lifted on two short struts (Turbo, Touring, Taycan)"""
        self.wing(le_x, le_z, chord, span, aoa, thick=thick, mat=mat, camber=-0.02, name='spoiler')
        for s in (1, -1):
            dz = self.deck_z(le_x - chord * .45, s * strut_y)
            self.box('strut', strut_mat, (le_x - chord * .45, s * strut_y, (dz + le_z) / 2), (0.08, 0.025, max(le_z - dz + .02, .02)))
    def roof_rack(self, x0, x1, hw, z, lights=2):
        """tubular roof basket with spot lights (911 Dakar)"""
        t = 0.025
        for s in (1, -1): self.box('rack', 'Black', ((x0 + x1) / 2, s * hw, z), (x1 - x0, t, t))
        for x in (x0, lerp(x0, x1, .33), lerp(x0, x1, .66), x1): self.box('rack', 'Black', (x, 0, z), (t, hw * 2, t))
        for x in (x0 + .05, x1 - .05):
            for s in (1, -1):
                dz = self.deck_z(x, s * hw * .9); self.box('rackleg', 'Black', (x, s * hw * .9, (dz + z) / 2), (0.03, 0.03, z - dz))
        for i in range(lights):
            y = lerp(-hw * .55, hw * .55, i / max(lights - 1, 1))
            self.cylinder('spot', 'Black', (x1 + .05, y, z + .06), 0.085, 0.07)
            self.cylinder('spotlens', 'Headlight', (x1 + .086, y, z + .06), 0.072, 0.004)

    def pod(self, name, mat, pts, segs=16, sub=2, mirror=True, flat=0.0):
        """streamlined body of elliptical sections [(x, y, z, ry, rz), ...] (humps, buttresses, mirror pods);
        flat>0 squashes the lower half so it sits on the deck"""
        for s in ((1, -1) if mirror else (1,)):
            bm = bmesh.new(); rings = []
            for x, y, z, ry, rz in pts:
                ring = []
                for i in range(segs):
                    a = 2 * math.pi * i / segs; cz = math.sin(a) * rz
                    if cz < 0: cz *= (1 - flat)
                    ring.append(bm.verts.new((x, s * y + math.cos(a) * ry, z + cz)))
                rings.append(ring)
            for a, b in zip(rings, rings[1:]):
                for i in range(segs): bm.faces.new((a[i], a[(i + 1) % segs], b[(i + 1) % segs], b[i]))
            bm.faces.new(rings[0]); bm.faces.new(list(reversed(rings[-1])))
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
            o = self.mesh(name, bm, mat)
            if sub: m = o.modifiers.new('sub', 'SUBSURF'); m.levels = sub; self.apply(o)
            self.parts.append(o)
    def panel(self, name, mat, fn, nu, nv, thick=0.008):
        """free-standing curved sheet from a parametric surface fn(u, v) -> Vector (open-top windscreens)"""
        bm = bmesh.new()
        grid = [[bm.verts.new(fn(i / nu, j / nv)) for j in range(nv + 1)] for i in range(nu + 1)]
        for i in range(nu):
            for j in range(nv): bm.faces.new((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]))
        if thick:
            r = bmesh.ops.solidify(bm, geom=list(bm.faces), thickness=thick)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        return self.mesh(name, bm, mat, part=True)

    # ------------------------------------------------------------ cabin
    def interior(self, x, w, z, l=1.5, h=0.36, seats_x=-0.55, seat_y=0.36, seat_z=0.86, open_top=False, wheel_x=None):
        """dark cabin tub + bucket seats so the car never looks hollow through the glass (or the open roof)"""
        self.box('cabin', 'Black', (x, 0, z), (l, w, h))
        for s in (1, -1):
            self.box('seat', 'Black', (seats_x, s * seat_y, seat_z), (0.12, 0.48, 0.50), rot=(0, math.radians(-14), 0), bevel=.03)
            self.box('cushion', 'Black', (seats_x + .25, s * seat_y, seat_z - .22), (0.45, 0.48, 0.10), bevel=.03)
        if open_top:
            self.box('dash', 'Black', ((wheel_x or x + l / 2) + .12, 0, z + h / 2 + .06), (0.30, w * .98, 0.16), bevel=.03)
            wx = wheel_x or x + l / 2 - .1
            bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=False, segments=24, radius1=.18, radius2=.18, depth=.03)
            bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(-62), 3, 'Y'))
            bmesh.ops.translate(bm, verts=bm.verts, vec=(wx, seat_y, z + h / 2 + .14))
            self.mesh('steering', bm, 'Black', part=True)

    # ------------------------------------------------------------ wheels
    def lathe(self, profile, segments, mat, name, core=None):
        """profile (radius, y) spun round the lateral Y axis; faces point away from the ring of radius `core`
        (a tyre's carcass), or towards the axle when core is None (a rim barrel seen through the spokes)"""
        bm = bmesh.new()
        vs = [bm.verts.new((r, y, 0)) for r, y in profile]
        es = [bm.edges.new((a, b)) for a, b in zip(vs, vs[1:])]
        bmesh.ops.spin(bm, geom=vs + es, cent=(0, 0, 0), axis=(0, 1, 0), angle=2 * math.pi, steps=segments, use_merge=True)
        bm.normal_update()
        for f in bm.faces:
            c = f.calc_center_median(); r = math.hypot(c.x, c.z) or 1
            out = Vector((-c.x, 0, -c.z)) if core is None else c - Vector((c.x / r * core, 0, c.z / r * core))
            if f.normal.dot(out) < 0: f.normal_flip()
        return self.mesh(name, bm, mat)
    def wheels(self, spokes=10, pairs=False, spoke_w=(0.022, 0.014), nut='centrelock', offroad=False, caliper=(0.22, 0.075, 0.09), style=None):
        """four wheels from self.wheel_spec (set by arches): tyre, barrel, lip, spokes, hub, nut, disc; plus calipers.
        style: 'straight' spokes (or pairs), 'y' (each spoke forks towards the rim), 'turbine' (swept blades), 'mesh'
        (a cross-spoke lattice), 'disc' (an aero cover with ribs) or 'dial' (a dish with six round holes); by default
        the car's real design from WHEEL_STYLE"""
        style = style or WHEEL_STYLE.get(self.key, 'straight')
        for key, wd in self.wheel_spec.items():
            for s in (1, -1): self._wheel(key, wd, s, spokes, pairs, spoke_w, nut, offroad, caliper, style)
    def _spoke(self, out, a, r0, r1, w0, w1, y0, y1, a1=None, sweep=False, n=1, face=True):
        """one spoke: a box strip of n segments from radius r0 at angle a (depth y0) to radius r1 at angle a1 (depth y1;
        a concave wheel has the hub deeper), straight or swept (the angle grows with the square of the radius), with a
        diamond-cut strip down its outer face"""
        a1 = a if a1 is None else a1
        ang = lambda t: lerp(a, a1, t * t if sweep else t)
        bm = bmesh.new(); rows = []
        for i in range(n + 1):
            t = i / n; r, w, yy = lerp(r0, r1, t), lerp(w0, w1, t), lerp(y0, y1, t); M = Matrix.Rotation(ang(t), 3, 'Y')
            rows.append([bm.verts.new(M @ Vector((r, yy + out * dz, ww))) for dz in (-.012, .012) for ww in (-w, w)])
        for A, B in zip(rows, rows[1:]):
            for i, j in ((0, 1), (1, 3), (3, 2), (2, 0)): bm.faces.new((A[i], A[j], B[j], B[i]))
        bm.faces.new((rows[0][0], rows[0][2], rows[0][3], rows[0][1])); bm.faces.new((rows[-1][0], rows[-1][1], rows[-1][3], rows[-1][2]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        objs = [self.mesh('spoke', bm, 'Rim', smooth=False)]
        if face and not getattr(self, 'lite', False):
            bm = bmesh.new(); prev = None
            for i in range(n + 1):
                t = i / n; M = Matrix.Rotation(ang(t), 3, 'Y')
                r, w, yy = lerp(r0 + .012, r1 - .012, t), lerp(w0, w1, t) * .42, lerp(y0, y1, t) + out * .0135
                cur = [bm.verts.new(M @ Vector((r, yy, -w))), bm.verts.new(M @ Vector((r, yy, w)))]
                if prev:
                    f = bm.faces.new((prev[0], cur[0], cur[1], prev[1])); f.normal_update()
                    if f.normal.y * out < 0: f.normal_flip()
                prev = cur
            objs.append(self.mesh('spokeface', bm, 'RimLip', smooth=False))
        return objs
    def _wheel(self, key, wd, s, spokes, pairs, spoke_w, nut, offroad, caliper, style='straight'):
        R, W, RR = wd['r'], wd['w'], wd['rim']; h = W / 2; out = s
        objs = []
        if offroad:   # all-terrain: tall rounded sidewall, deep blocks
            prof = [(RR + .005, -h + .02), (RR + .03, -h), (R - .06, -h - .01), (R - .02, -h + .02), (R - .025, -h + .06), (R - .025, h - .06), (R - .02, h - .02), (R - .06, h + .01), (RR + .03, h), (RR + .005, h - .02)]
        else:
            prof = [(RR + .005, -h + .02), (RR + .03, -h), (R - .035, -h + .002), (R - .008, -h + .022), (R, -h + .05)]
            for g in (() if getattr(self, 'lite', False) else (-0.3, 0, 0.3)):   # tread grooves (not on lite traffic cars)
                prof += [(R, g * W - .018), (R - .008, g * W - .012), (R - .008, g * W + .012), (R, g * W + .018)]
            prof += [(R, h - .05), (R - .008, h - .022), (R - .035, h - .002), (RR + .03, h), (RR + .005, h - .02)]
        prof.sort(key=lambda p: p[1])
        lite = getattr(self, 'lite', False); segs = 24 if lite else 48
        objs.append(self.lathe(prof, 28 if lite else 72, 'Tire', 'tire', core=(R + RR) / 2))
        rl = (R + RR) / 2 + .008   # raised sidewall lettering: two "words" of grey blocks on the outer sidewall
        for wa in (() if lite else (0, math.pi)):
            for k in range(7):
                a = wa + (k - 3) * 0.075; bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
                bmesh.ops.scale(bm, verts=bm.verts, vec=(0.03 if k % 3 else 0.022, 0.006, min(0.022, (R - RR) * .3)))
                bmesh.ops.translate(bm, verts=bm.verts, vec=(0, out * (h + .001), rl)); bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(a, 3, 'Y'))
                objs.append(self.mesh('letter', bm, 'TireLetter', smooth=False))
        if offroad:   # staggered tread blocks
            for k in range(40):
                a = k * 2 * math.pi / 40
                for row, (yc, bw) in enumerate(((-h * .5, h * .55), (h * .5, h * .55))):
                    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
                    bmesh.ops.scale(bm, verts=bm.verts, vec=(0.045, bw, 0.03))
                    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, yc + (0.02 if k % 2 else -0.02), R - .02))
                    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(a + row * math.pi / 40, 3, 'Y'))
                    objs.append(self.mesh('block', bm, 'Tire', smooth=False))
        objs.append(self.lathe([(RR - .012, -h + .02), (RR - .012, h - .02)], segs, 'Rim', 'barrel'))
        bm = bmesh.new(); bmesh.ops.create_cone(bm, segments=segs, radius1=RR + .008, radius2=RR + .008, depth=.016, cap_ends=False)
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, 'X'))
        bmesh.ops.translate(bm, verts=bm.verts, vec=(0, out * (h - .02), 0)); objs.append(self.mesh('lip', bm, 'RimLip'))
        r0, r1, w0, w1 = 0.065, RR - .004, spoke_w[0], spoke_w[1]
        y_in, y_out = out * (h - .075), out * (h - .028)   # concave: the hub sits deeper than the rim edge
        lite = getattr(self, 'lite', False)
        if style == 'y':            # Y spokes: a trunk that forks halfway out (5 for a 10-spoke car)
            n = spokes // 2 if spokes >= 8 else spokes; d = 0.34 * math.pi / n
            rm, ym = lerp(r0, r1, .45), lerp(y_in, y_out, .45)
            for k in range(n):
                a = k * 2 * math.pi / n
                objs += self._spoke(out, a, r0, rm, w0 * 1.15, w0, y_in, ym, face=not lite)
                for e in (-d, d): objs += self._spoke(out, a, rm - .012, r1, w0 * .62, w1 * .8, ym, y_out, a1=a + e, n=4, face=not lite)
        elif style in ('turbine', 'mesh'):   # swept blades (or two crossing sets of them: a lattice)
            n = max(spokes * (2 if pairs else 1), 8) if style == 'turbine' else max(spokes, 10)
            for k in range(n):
                a = k * 2 * math.pi / n
                for tw in ((0.62,) if style == 'turbine' else (0.42, -0.42)):
                    objs += self._spoke(out, a, r0, r1, w0 * (1 if style == 'turbine' else .62), w1 * (1.1 if style == 'turbine' else .62),
                                        y_in, y_out, a1=a + tw * out, sweep=True, n=6, face=style == 'turbine' and not lite)
        elif style == 'disc':       # aero cover: a shallow dish over the spokes with raised ribs
            objs.append(self.lathe([(0.07, y_in + out * .004), (RR - .012, y_out - out * .004)], segs, 'Rim', 'aerodisc'))
            for k in range(max(spokes, 5)):
                a = k * 2 * math.pi / max(spokes, 5)
                objs += self._spoke(out, a, r0 + .02, r1 - .01, w0 * .7, w1 * .9, y_in + out * .006, y_out + out * .004, face=not lite)
        elif style == 'dial':       # Koenigsegg CC850 'phone dial': a flat dish with six big round holes
            ym = out * (h - .035)
            objs.append(self.lathe([(0.07, ym), (RR - .012, ym)], segs, 'Rim', 'aerodisc'))
            for k in range(6):
                bm = bmesh.new(); bmesh.ops.create_circle(bm, cap_ends=True, segments=20, radius=RR * .2)
                bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(-out * math.pi / 2, 3, 'X'))
                bmesh.ops.translate(bm, verts=bm.verts, vec=(RR * .56, ym + out * .003, 0))
                bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(k * math.pi / 3, 3, 'Y'))
                objs.append(self.mesh('dialhole', bm, 'Black', smooth=False))
        elif style == 'wire':       # a wire wheel: three rows of thin laced spokes from a long hub to the rim
            yo, yc_, yi = out * (h - .005), out * (h - .09), out * (h - .16)   # the hub's outer and inner flanges, the rim's middle
            n = 24 if lite else 36
            for k in range(n):
                a = k * 2 * math.pi / n; t = .30 if k % 2 else -.30
                objs += self._spoke(out, a, .052, RR - .012, .0032, .0028, yo if k % 3 else yi, yc_ + out * (.03 if k % 2 else -.03),
                                    a1=a + t, n=1, face=False)
            objs.append(self.lathe([(.05, yi), (.058, yi + out * .03), (.045, yo - out * .02), (.05, yo)], segs, 'Chrome', 'wirehub'))
            objs.append(self.lathe([(RR - .016, out * (h - .05)), (RR - .016, out * (h - .13))], segs, 'RimLip', 'wirewell'))
        elif style == 'mag':        # Toyota 2000GT: a magnesium dish with sixteen radial slots and a knock-off spinner
            ym = out * (h - .045)
            objs.append(self.lathe([(.07, out * (h - .02)), (RR * .55, ym), (RR - .012, ym + out * .004)], segs, 'Rim', 'magdish'))
            for k in range(16):
                a = k * 2 * math.pi / 16
                bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
                bmesh.ops.scale(bm, verts=bm.verts, vec=(RR * .36, .006, .011))
                bmesh.ops.translate(bm, verts=bm.verts, vec=(RR * .70, ym + out * .004, 0))
                bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(a, 3, 'Y'))
                objs.append(self.mesh('magslot', bm, 'Black', smooth=False))
        elif style == 'hubcap':     # Mercedes 300 SL: a painted steel wheel, a chrome trim ring and a big domed chrome hubcap
            ym = out * (h - .05)
            objs.append(self.lathe([(.06, ym), (RR - .012, ym + out * .004)], segs, 'Rim', 'steelwheel'))
            objs.append(self.lathe([(RR * .66, ym + out * .012), (RR * .80, ym + out * .016), (RR - .012, ym + out * .01)], segs, 'Chrome', 'trimring'))
            objs.append(self.lathe([(.0, out * (h + .045)), (RR * .22, out * (h + .036)), (RR * .40, out * (h + .015)), (RR * .52, ym + out * .006)],
                                   segs, 'Chrome', 'hubcap'))
        elif style == 'leaf':       # Porsche Fuchs: five broad forged leaves, wider at the rim, round a flat centre
            for k in range(5):
                a = k * 2 * math.pi / 5
                for d in (-1, 1):
                    objs += self._spoke(out, a + d * .13, r0, r1, .022, .040, y_in, y_out, a1=a + d * .21, n=4, face=not lite)
            objs.append(self.lathe([(.0, out * (h - .055)), (.085, out * (h - .062))], segs, 'Rim', 'leafcentre'))
        else:                       # straight spokes, single or in pairs
            for k in range(spokes):
                a = k * 2 * math.pi / spokes
                for a_ in ([a - .11, a + .11] if pairs else [a]):
                    objs += self._spoke(out, a_, r0, r1, w0, w1, y_in, y_out, face=not lite)
        bm = bmesh.new(); bmesh.ops.create_cone(bm, segments=24, radius1=.075, radius2=.06, depth=.05, cap_ends=True)
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(-out * math.pi / 2, 3, 'X'))
        bmesh.ops.translate(bm, verts=bm.verts, vec=(0, out * (h - .07), 0)); objs.append(self.mesh('hub', bm, 'Rim'))
        if nut == 'spinner' or style in ('wire', 'mag'):   # a knock-off spinner: a chrome hub nut with two (wire: three) ears
            yo_ = out * (h + (.035 if style == 'wire' else .01))
            bm = bmesh.new(); bmesh.ops.create_cone(bm, segments=12, radius1=.046, radius2=.036, depth=.045, cap_ends=True)
            bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(-out * math.pi / 2, 3, 'X'))
            bmesh.ops.translate(bm, verts=bm.verts, vec=(0, yo_, 0)); objs.append(self.mesh('spinner', bm, 'Chrome'))
            for e in range(3 if style == 'wire' else 2):
                bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
                bmesh.ops.scale(bm, verts=bm.verts, vec=(.075, .028, .016))
                bmesh.ops.translate(bm, verts=bm.verts, vec=(.068, yo_ + out * .004, 0))
                bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(e * 2 * math.pi / (3 if style == 'wire' else 2) + .3, 3, 'Y'))
                objs.append(self.mesh('spinear', bm, 'Chrome', smooth=False))
        elif style == 'hubcap': pass
        elif nut == 'centrelock':
            bm = bmesh.new(); bmesh.ops.create_cone(bm, segments=6, radius1=.042, radius2=.036, depth=.05, cap_ends=True)
            bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(-out * math.pi / 2, 3, 'X'))
            bmesh.ops.translate(bm, verts=bm.verts, vec=(0, out * (h - .035), 0)); objs.append(self.mesh('nut', bm, 'Chrome', smooth=False))
        else:   # five wheel bolts round a small centre cap
            for k in range(5):
                a = k * 2 * math.pi / 5
                bm = bmesh.new(); bmesh.ops.create_cone(bm, segments=8, radius1=.012, radius2=.012, depth=.03, cap_ends=True)
                bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, 'X'))
                bmesh.ops.translate(bm, verts=bm.verts, vec=(math.cos(a) * .045, out * (h - .05), math.sin(a) * .045)); objs.append(self.mesh('bolt', bm, 'Chrome', smooth=False))
            bm = bmesh.new(); bmesh.ops.create_cone(bm, segments=16, radius1=.03, radius2=.03, depth=.02, cap_ends=True)
            bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, 'X'))
            bmesh.ops.translate(bm, verts=bm.verts, vec=(0, out * (h - .045), 0)); objs.append(self.mesh('cap', bm, 'Chrome'))
        bm = bmesh.new(); bmesh.ops.create_cone(bm, segments=segs, radius1=RR - .055, radius2=RR - .055, depth=.034, cap_ends=True)
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, 'X'))
        bmesh.ops.translate(bm, verts=bm.verts, vec=(0, out * (h - .13), 0)); objs.append(self.mesh('disc', bm, 'Disc'))
        bm = bmesh.new()   # cross-drilled holes in three staggered rings
        for ring, rr_ in enumerate((RR - .075, RR - .095, RR - .115)):
            for k in range(12):
                a = (k + ring / 3) * 2 * math.pi / 12
                g = bmesh.ops.create_cone(bm, segments=6, radius1=.0065, radius2=.0065, depth=.04, cap_ends=True)['verts']
                bmesh.ops.rotate(bm, verts=g, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, 'X'))
                bmesh.ops.translate(bm, verts=g, vec=(math.cos(a) * rr_, out * (h - .13), math.sin(a) * rr_))
        if RR - .115 > .09 and not lite and not getattr(self, 'classic', False): objs.append(self.mesh('drill', bm, 'Black', smooth=False))
        else: bm.free()
        self.activate(objs[0])
        for o in objs: o.select_set(True)
        bpy.ops.object.join(); wheel = bpy.context.object
        tag = f'{key}{"L" if s > 0 else "R"}'
        wheel.name = f'Wheel_{tag}'; wheel.location = (wd['x'], s * wd['y'], R)
        m = Matrix.Rotation((-1 if key == 'F' else 1) * math.radians(35), 3, 'Y')   # front calipers behind the axle, rear ahead
        def arc(r0, r1, y0, y1, span, steps=10):   # a block bent round the disc
            bm = bmesh.new(); rows = []
            for i in range(steps + 1):
                ph = (i / steps - .5) * span; sx, cz = math.sin(ph), math.cos(ph)
                rows.append([bm.verts.new((r * sx, y, r * cz)) for r, y in ((r0, y0), (r1, y0), (r1, y1), (r0, y1))])
            for a_, b_ in zip(rows, rows[1:]):
                for j in range(4): bm.faces.new((a_[j], a_[(j + 1) % 4], b_[(j + 1) % 4], b_[j]))
            bm.faces.new(rows[0]); bm.faces.new(list(reversed(rows[-1]))); bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
            bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=m); return bm
        if lite: self.activate(wheel); bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35)); return   # no calipers on traffic
        cw, ct, cr = caliper; rc_ = RR - .085; span = cw / rc_; yc = out * (h - .10)
        cal = self.mesh(f'Caliper_{tag}', arc(rc_ - cr / 2, rc_ + cr / 2, yc - ct / 2, yc + ct / 2, span), 'Caliper')
        cm = cal.modifiers.new('bev', 'BEVEL'); cm.width = .012; cm.segments = 2; self.apply(cal)
        logo = self.mesh('caliperlogo', arc(rc_ - cr * .18, rc_ + cr * .18, yc + out * (ct / 2 + .001), yc + out * (ct / 2 + .003), span * .55, 6), 'Logo')
        self.activate(cal); logo.select_set(True); bpy.ops.object.join(); cal = bpy.context.object; cal.name = f'Caliper_{tag}'
        cal.location = wheel.location.copy()
        self.activate(wheel); bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35))

    # ------------------------------------------------------------ finishing touches (every car, automatically)
    def slab(self, name, mat, c, u, n, lu, lt, ln, bevel=0.0):
        """a small flat block centred on c: long axis u (half-length lu), thickness along n (ln), width across (lt)"""
        u = Vector(u); n = Vector(n).normalized(); u = (u - n * u.dot(n)).normalized(); t = n.cross(u)
        bm = bmesh.new(); c = Vector(c)
        vs = [bm.verts.new(c + u * a * lu + t * b * lt + n * d * ln) for d in (-1, 1) for a, b in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
        for ids in [[0, 1, 2, 3], [7, 6, 5, 4], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]]: bm.faces.new([vs[i] for i in ids])
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        o = self.mesh(name, bm, mat, smooth=False)
        if bevel: m = o.modifiers.new('bev', 'BEVEL'); m.width = bevel; m.segments = 2; self.apply(o)
        self.parts.append(o); return o

    def details(self):
        """finishing touches added to every car by join(): windscreen wipers, door handles, a gloss-black sill, front
        and rear badges and a shark-fin antenna. Each is skipped when the car already has its own version (or no
        windscreen / door line / roof to put it on)."""
        names = {o.name.split('.')[0] for o in self.parts}
        objs = lambda key: [o for o in self.parts if o.name.split('.')[0] == key]
        F, R = self.wheel_spec['F'], self.wheel_spec['R']; xm = (F['x'] + R['x']) / 2
        p, _ = self.hit((xm, 0, -3), (0, 0, 1)); zb = p.z if p else 0.2
        # windscreen wipers: two black blades parked along the bottom edge of the glass
        if 'wiper' not in names:
            for ws in objs('windscreen')[:1]:
                vs = [ws.matrix_world @ v.co for v in ws.data.vertices]
                if len(vs) < 8: break
                z0 = min(v.z for v in vs); bot = [v for v in vs if v.z < z0 + 0.025]
                ymin, ymax = min(v.y for v in bot), max(v.y for v in bot); hw = (ymax - ymin) / 2
                nrm = sum((ws.matrix_world.to_3x3() @ pl_.normal for pl_ in ws.data.polygons), Vector()).normalized()
                up = (Vector((-1, 0, 0)) - nrm * Vector((-1, 0, 0)).dot(nrm)).normalized()   # up the glass, towards the roof
                for yc, L in ((ymin + hw * .55, hw * .42), (ymin + hw * 1.45, hw * .42)):
                    near = min(bot, key=lambda v: abs(v.y - yc)); c = Vector((near.x, yc, near.z)) + up * 0.05 + nrm * 0.012
                    self.slab('wiper', 'Black', c, (0, 1, 0), nrm, L, 0.009, 0.006)
                    self.slab('wiperarm', 'Black', c + Vector((0, L * .55, 0)) - up * 0.02, up, nrm, 0.035, 0.008, 0.008)
        # door handles: just ahead of each door's rear shut line, under the window
        if 'handle' not in names:
            for dl in objs('doorline'):
                vs = [dl.matrix_world @ v.co for v in dl.data.vertices]
                if not vs: continue
                xd = sum(v.x for v in vs) / len(vs); s = 1 if sum(v.y for v in vs) > 0 else -1; z1 = max(v.z for v in vs)
                if z1 - min(v.z for v in vs) < 0.25: continue
                hx = xd + 0.17 if xd < xm + 0.15 else xd - 0.85
                if not (R['x'] + R['r'] < hx < F['x'] - F['r']): continue
                hp, hn = self.hit((hx, s * 5, z1 - 0.11), (0, -s, 0))
                if hp is None: continue
                self.slab('handle', 'Chrome', hp + hn * 0.012, (1, 0, 0), hn, 0.075, 0.016, 0.009, bevel=0.006)
                self.slab('handlecup', 'Gloss', hp + hn * 0.004, (1, 0, 0), hn, 0.085, 0.024, 0.003)
        # a gloss-black sill between the wheel arches
        old = getattr(self, 'classic', False)   # a classic car (classics.py): none of the modern aero, sill or antenna
        if not old and not names & {'skirt', 'sill', 'archtrim'}:
            x0, x1 = R['x'] + R['r'] + 0.13, F['x'] - F['r'] - 0.13
            if x1 - x0 > 0.6:
                for s in (1, -1): self.decal('sill', 'Gloss', side(s), x0, x1, zb + 0.015, zb + 0.085, 24, 2, off=.005)
        # badges: a small chrome oval with a red centre on the nose and on the tail
        if not names & {'badge', 'horse', 'horseshoe'}:
            hits = [(self.hit((8, 0, z), (-1, 0, 0)), z) for z in [0.25 + i * .025 for i in range(30)]]
            hits = [(h[0], h[1], z) for h, z in hits if h[0] is not None]
            if hits:
                hp, hn, z = max(hits, key=lambda q: q[0].x)
                bz = z + 0.06; bp, bn = self.hit((8, 0, bz), (-1, 0, 0))
                if bp is not None:
                    self.oval('badge', 'Chrome', bp, bn, 0.055, 0.034, .008, n=6); self.oval('badge', 'Accent', bp, bn, 0.036, 0.019, .011, n=4)
            hits = [(self.hit((-8, 0, z), (1, 0, 0)), z) for z in [0.5 + i * .025 for i in range(24)]]
            hits = [(h[0], h[1], z) for h, z in hits if h[0] is not None and h[1].x < -0.5]
            if hits:
                bp, bn, z = min(hits, key=lambda q: q[1].x)
                self.oval('badge', 'Chrome', bp, bn, 0.05, 0.03, .008, n=6); self.oval('badge', 'Accent', bp, bn, 0.032, 0.017, .011, n=4)
        # bonnet shut lines: a thin black U round the front lid, from the windscreen base to the nose
        if not names & {'hoodline', 'lidline', 'frunkline'}:
            for ws in objs('windscreen')[:1]:
                vs = [ws.matrix_world @ v.co for v in ws.data.vertices]
                if not vs: break
                x0 = max(v.x for v in vs) + 0.06
                nose = [self.hit((8, 0, z), (-1, 0, 0))[0] for z in [0.35 + i * 0.05 for i in range(10)]]
                nose = [p_.x for p_ in nose if p_ is not None]
                if not nose: break
                x1 = max(nose) - 0.32
                if x1 - x0 < 0.5: break
                xm_ = (x0 + x1) / 2; zt_ = self.deck_z(xm_)
                wp = self.hit((xm_, 5, zt_ - 0.12), (0, -1, 0))[0]
                yh = (wp.y if wp is not None else 0.9) * 0.6
                for s_ in (1, -1): self.decal('hoodline', 'Black', 'top', x0, x1, s_ * yh - .004, s_ * yh + .004, 20, 1, off=.004)
                self.decal('hoodline', 'Black', 'top', x0 - .004, x0 + .004, -yh, yh, 1, 16, off=.004)
        # honeycomb mesh over the black grilles and intakes: rows of small raised diamonds, every other row offset
        mesh_keys = ('grille', 'intake', 'mouth', 'lowgrille', 'hexmouth', 'agrille', 'cintake', 'quarterintake', 'snorkelmouth')
        for g in [o for o in self.parts if not getattr(self, 'lite', False) and o.name.split('.')[0] in mesh_keys and o.data.materials and o.data.materials[0].name in ('Black', 'GlossBlack', 'Carbon')]:
            bm = bmesh.new(); M = g.matrix_world; N3 = M.to_3x3()
            for f in g.data.polygons:
                q = [M @ g.data.vertices[i].co for i in f.vertices]
                if len(q) != 4: continue
                nrm = (N3 @ f.normal).normalized(); a_, b_ = q[1] - q[0], q[3] - q[0]
                na, nb = max(1, int(a_.length / 0.032)), max(1, int(b_.length / 0.028))
                for i in range(na):
                    for j in range(nb):
                        u, v = (i + .5 + (.5 if j % 2 else 0)) / na, (j + .5) / nb
                        if u > 1: continue
                        c = q[0].lerp(q[1], u).lerp(q[3].lerp(q[2], u), v) + nrm * 0.004
                        e1 = a_.normalized() * 0.009; e2 = b_.normalized() * 0.007
                        vs = [bm.verts.new(c + e1), bm.verts.new(c + e2), bm.verts.new(c - e1), bm.verts.new(c - e2)]
                        ff = bm.faces.new(vs); ff.normal_update()
                        if ff.normal.dot(nrm) < 0: ff.normal_flip()
            if bm.faces: self.parts.append(self.mesh('grillemesh', bm, 'Gloss', smooth=False))
            else: bm.free()
        # a front splitter lip and rear diffuser fins sit the car down on the road
        lowc = lambda x0, x1: [(x, self.hit((x, 0, -3), (0, 0, 1))[0]) for x in [x0 + i * (x1 - x0) / 20 for i in range(21)]]
        if not old and not names & {'splitter', 'lip'}:
            # the lowest point of the nose: scan up from the floor until the ray hits near the front of the car
            prow = [(z, self.hit((8, 0, z), (-1, 0, 0))[0]) for z in [zb + i * 0.01 for i in range(60)]]
            prow = [(z, p_) for z, p_ in prow if p_ is not None]
            if prow:
                xf = max(p_.x for _, p_ in prow); zl, pl_ = next((z, p_) for z, p_ in prow if p_.x > xf - 0.12)
                wy = self.hit((pl_.x - 0.2, 5, zl + 0.03), (0, -1, 0))[0]
                hw = (wy.y if wy is not None else 0.8) * 0.85
                self.box('splitter', 'Carbon', (pl_.x - 0.04, 0, zl - 0.004), (0.14, hw * 2, 0.02), bevel=0.006)
        if not old and not names & {'difffin'}:
            ps = [self.hit((-8, 0, zb + dz), (1, 0, 0))[0] for dz in (0.04, 0.08)]
            ps = [p_ for p_ in ps if p_ is not None]
            if ps:
                rx = max(p_.x for p_ in ps); wy = self.hit((rx + 0.25, 5, zb + 0.08), (0, -1, 0))[0]
                hw = (wy.y if wy is not None else 0.8) * 0.7
                if 'diffuser' not in names: self.box('diffuser', 'Gloss', (rx + 0.08, 0, zb + 0.03), (0.22, hw * 2, 0.025))
                for f_ in (-0.62, -0.22, 0.22, 0.62):
                    self.box('difffin', 'Gloss', (rx + 0.06, f_ * hw, zb + 0.07), (0.24, 0.012, 0.11))
        # shark-fin antenna at the back of the roof (not on open cars or cars with roof racks)
        if not old and not getattr(self, 'open_top', False) and not names & {'rack', 'fin', 'antenna'}:
            xs = [R['x'] - 0.6 + i * 0.05 for i in range(int((F['x'] - R['x'] + 0.6) / 0.05))]
            top = [(x, self.hit((x, 0, 6), (0, 0, -1))[0]) for x in xs]; top = [(x, p.z) for x, p in top if p is not None]
            if top:
                zt = max(z for _, z in top); xt = [x for x, z in top if z > zt - 0.03]
                if zt > 0.95:
                    xr = min(xt); xf = xr + 0.16; pz = self.hit((xf, 0, 6), (0, 0, -1))[0]
                    if pz is not None and pz.z > zt - 0.06:
                        z = pz.z
                        self.pod('antenna', 'Black', [(xf + .07, 0, z + .004, .006, .006), (xf + .02, 0, z + .018, .02, .024), (xf - .05, 0, z + .03, .026, .045),
                                                      (xf - .1, 0, z + .02, .026, .03), (xf - .13, 0, z + .004, .01, .008)], segs=10, sub=1, mirror=False, flat=.7)

    def number_plates(self):
        """Japanese number plates (330 x 165 mm) on the nose and the tail: each goes on the flattest upright patch of
        bumper near the usual height that no lamp, badge or tailpipe covers. The game paints the number on."""
        if getattr(self, 'lite', False) or 'plate' in {o.name.split('.')[0] for o in self.parts}: return
        F, R = self.wheel_spec['F'], self.wheel_spec['R']; xm = (F['x'] + R['x']) / 2
        p, _ = self.hit((xm, 0, -3), (0, 0, 1)); zb = p.z if p else 0.2
        busy = [o.matrix_world @ v.co for o in self.parts if o.name.split('.')[0] in ('badge', 'exhaust', 'tailpipe', 'hitch', 'towhook', 'horseshoe')
                or (o.data.materials and o.data.materials[0].name in ('Headlight', 'Taillight', 'Titanium')) for v in o.data.vertices]
        # a plate goes on solid bumper: first try to keep it off the openings (the mesh set back in a grille or intake,
        # and the trim round them and the lamps), so it isn't sunk into a hole; only if there's no room, anywhere
        holes = busy + [o.matrix_world @ v.co for o in self.parts if o.name.split('.')[0] == 'li_rim'
                        or (o.data.materials and o.data.materials[0].name == 'Grille') for v in o.data.vertices]
        for sx, z0, z1, zp in ((1, 0.12, 0.6, 0.30), (-1, 0.2, 0.8, 0.42)):
            best = self._plate_spot(sx, zb, z0, z1, zp, holes) or self._plate_spot(sx, zb, z0, z1, zp, busy)
            if best is None: continue
            _, c, n = best
            self.slab('plateframe', 'Gloss', c - n * 0.004, (0, 1, 0), n, 0.176, 0.093, 0.004)
            self.slab('plate', 'Plate', c, (0, 1, 0), n, 0.165, 0.0825, 0.003)
    def _plate_spot(self, sx, zb, z0, z1, zp, busy):
        """the flattest upright 330 x 165 mm patch on the nose (sx=1) or the tail (-1) between zb+z0 and zb+z1 that no
        `busy` point covers, nearest the usual height zb+zp: (z, centre, normal) or None"""
        best = None
        for i in range(int((z1 - z0) / 0.02) + 1):
            z = zb + z0 + i * 0.02
            hits = [self.hit((sx * 9, y, z + dz), (-sx, 0, 0)) for y in (-0.165, 0, 0.165) for dz in (-0.0825, 0.0825)]
            if any(h[0] is None or h[1].x * sx < 0.6 for h in hits): continue
            xs = [h[0].x for h in hits]
            if max(xs) - min(xs) > 0.06: continue
            c = sum((h[0] for h in hits), Vector()) / 6; n = sum((h[1] for h in hits), Vector()); n.y = 0; n.normalize()
            c = Vector((max(xs) if sx > 0 else min(xs), 0, c.z)) + n * 0.008
            up = n.cross(Vector((0, 1, 0)))
            if any(abs((v - c).y) < 0.2 and abs((v - c).dot(up)) < 0.11 and abs((v - c).dot(n)) < 0.1 for v in busy): continue
            if best is None or abs(z - zb - zp) < abs(best[0] - zb - zp): best = (z, c, n)
        return best

    # ------------------------------------------------------------ see-through cabin
    FRIT = {'windscreen': 0.045, 'rearwindow': 0.04, 'rearwin': 0.04, 'roof': 0.03, 'roofglass': 0.03}
    @staticmethod
    def frame_ring(bm, width):
        """a projected patch is a grid; its outer ring of cells becomes a band `width` wide: every vertex one edge in
        from the outline slides out along that edge (a corner along both). Returns the ring's faces."""
        bnd = {v for v in bm.verts if v.is_boundary}
        ring = {f for v in bnd for f in v.link_faces}
        moves = {}
        for v in bm.verts:
            if v in bnd: continue
            d = Vector()
            for e in v.link_edges:
                w = e.other_vert(v); L = (w.co - v.co).length
                if w in bnd and L > width: d += (w.co - v.co) * (1 - width / L)
            if d.length: moves[v] = d
        for v, d in moves.items(): v.co += d
        return ring
    @staticmethod
    def block(bm, out=0.03, depth=0.26, reach=None):
        """thicken an open patch into a closed block: lifted `out` along its normals, `depth` deep. reach(p, n) gives how
        far in from p along -n the shell's other side is; the block stops short of it, so it never cuts that side too"""
        bm.normal_update(); nrm = {v: v.normal.copy() for v in bm.verts}
        rim = [e for e in bm.edges if e.is_boundary]
        deep = {v: depth - out if reach is None else max(0.02, min(depth - out, reach(v.co, n) - 0.025)) for v, n in nrm.items()}
        for v, n in nrm.items(): v.co += n * out
        inn = {v: bm.verts.new(v.co - n * (out + deep[v])) for v, n in nrm.items()}
        for f in list(bm.faces): bm.faces.new([inn[v] for v in reversed(f.verts)])
        for e in rim:
            a, b = e.verts; bm.faces.new((a, b, inn[b], inn[a]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.normal_update()
        if sum(f.calc_center_median().dot(f.normal) * f.calc_area() for f in bm.faces) < 0:   # inside out (negative volume)
            bmesh.ops.reverse_faces(bm, faces=bm.faces)
        return bm
    def torus(self, name, mat, c, axis, R, r, nu=28, nv=8):
        axis = Vector(axis).normalized(); e1 = axis.orthogonal().normalized(); e2 = axis.cross(e1); c = Vector(c)
        bm = bmesh.new(); rows = []
        for i in range(nu):
            d = e1 * math.cos(2 * math.pi * i / nu) + e2 * math.sin(2 * math.pi * i / nu)
            rows.append([bm.verts.new(c + d * (R + r * math.cos(b)) + axis * r * math.sin(b)) for b in [2 * math.pi * j / nv for j in range(nv)]])
        for i in range(nu):
            a, b = rows[i], rows[(i + 1) % nu]
            for j in range(nv): bm.faces.new((a[j], b[j], b[(j + 1) % nv], a[(j + 1) % nv]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        return self.mesh(name, bm, mat, part=True)
    def seat(self, xh, y, zh, w, top, rake=18, bench=False):
        """a seat whose hip point is (xh, y, zh): cushion, raked backrest up to z=top, side bolsters, a suede
        centre panel and a headrest (one per sitter; a bench is two seats wide)"""
        a = math.radians(rake); up = Vector((-math.sin(a), 0, math.cos(a))); fwd = Vector((math.cos(a), 0, math.sin(a)))
        rot = (0, -a, 0); base = Vector((xh - 0.12, y, zh - 0.05))
        L = max(0.3, (top - 0.16 - base.z) / math.cos(a))
        self.box('cushion', 'Leather', (xh + 0.15, y, zh - 0.07), (0.50, w, 0.11), rot=(0, math.radians(-6), 0), bevel=0.025)
        self.box('seat', 'Leather', base + up * L / 2, (0.11, w, L), rot=rot, bevel=0.03)
        heads = (-w / 4, w / 4) if bench else (0,)
        for dy in heads:
            hp = base + up * (L + 0.1) + Vector((0, dy, 0))
            self.box('headrest', 'Leather', hp, (0.10, min(0.28, w * 0.55), 0.16), rot=rot, bevel=0.03)
            self.box('seatinsert', 'Alcantara', base + up * L * 0.48 + fwd * 0.06 + Vector((0, dy, 0)), (0.02, min(0.22, w * 0.42), L * 0.7), rot=rot)
        if not bench:
            for s in (1, -1):
                self.box('bolster', 'Leather', base + up * L * 0.36 + fwd * 0.05 + Vector((0, s * (w / 2 - 0.045), 0)), (0.13, 0.08, L * 0.62), rot=rot, bevel=0.025)
                self.box('bolster', 'Leather', (xh + 0.15, y + s * (w / 2 - 0.045), zh - 0.02), (0.44, 0.08, 0.07), bevel=0.025)

    def open_cabin(self):
        """Forza-style glass: every window becomes clear tinted glass with a black frit band round its edge, the body
        skin behind it is cut away, the inside of the shell gets a dark lining and the cabin gets seats, a dashboard
        with screens, a steering wheel (the driver sits on the right, -Y) and a centre console. Traffic (lite) and
        open-top cars keep their dark glass."""
        if getattr(self, 'lite', False) or getattr(self, 'open_top', False): return
        G = self.M['Glass']; cut = []
        glass = [o for o in self.parts if o.data.materials and o.data.materials[0] == G]
        trees = {o: BVHTree.FromPolygons([o.matrix_world @ v.co for v in o.data.vertices], [p.vertices[:] for p in o.data.polygons]) for o in glass}
        for o in glass:
            bm = bmesh.new(); bm.from_mesh(o.data)
            if not any(v.is_boundary for v in bm.verts): bm.free(); continue        # a closed glass pod stays dark
            frit = self.FRIT.get(o.name.split('.')[0], 0.02); bm.faces.index_update()
            # where two windows meet with no body between (windscreen and door glass at the A-pillar), the cells within
            # 5 cm of the other window stay black: a gloss-black pillar instead of a see-through corner
            others = [t for q, t in trees.items() if q is not o]
            pillar = {f.index for f in bm.faces if any(t.find_nearest(o.matrix_world @ f.calc_center_median(), 0.05)[0] is not None for t in others)}
            # glass that wraps round a corner (a windscreen swept back over the A-pillars) stays black there too
            bm.normal_update(); nm = sum((f.normal * f.calc_area() for f in bm.faces), Vector()).normalized()
            pillar |= {f.index for f in bm.faces if f.normal.dot(nm) < 0.72}
            ck = bm.copy(); ck.faces.index_update(); ring = self.frame_ring(bm, frit) | {f for f in bm.faces if f.index in pillar}
            if sum(f.calc_area() for f in bm.faces if f not in ring) < 0.02: bm.free(); ck.free(); continue
            for f in bm.faces: f.material_index = 1 if f in ring else 0
            bm.to_mesh(o.data); bm.free()
            o.data.materials.clear(); o.data.materials.append(self.M['GlassClear']); o.data.materials.append(self.M['Gloss'])
            ring = self.frame_ring(ck, max(0.006, frit - 0.012)) | {f for f in ck.faces if f.index in pillar}   # the hole reaches a centimetre under the frit
            bmesh.ops.delete(ck, geom=list(ring), context='FACES')
            bmesh.ops.delete(ck, geom=[v for v in ck.verts if not v.link_faces], context='VERTS')
            cut.append((o, ck))
        if not cut: return
        # ---- measure the cabin from the glass and from rays fired inside the shell (they hit the skin from behind)
        F, Rw = self.wheel_spec['F'], self.wheel_spec['R']; xm = (F['x'] + Rw['x']) / 2
        gv = [o.matrix_world @ v.co for o, _ in cut for v in o.data.vertices]
        ws = next((o for o, _ in cut if o.name.startswith('windscreen')), None)
        wv = [ws.matrix_world @ v.co for v in ws.data.vertices] if ws else [v for v in gv if v.x > xm] or gv
        x_base, z_base, top_x = max(v.x for v in wv), min(v.z for v in wv), min(v.x for v in wv)
        sv = [o.matrix_world @ v.co for o, _ in cut if not o.name.startswith(('windscreen', 'rear', 'roof')) for v in o.data.vertices]
        x_back = min(v.x for v in (sv or gv))
        def ray(x, y, z, d):
            p = self.hit((x, y, z), d)[0]; return p
        def half(x, z):
            ps = [ray(x, 0, z, (0, s, 0)) for s in (1, -1)]
            return min(abs(p.y) for p in ps) - 0.03 if all(ps) else 0.6
        ex = min(top_x - 0.28, x_base - 1.0)
        p = ray(ex, 0, z_base, (0, 0, 1)); zr = p.z if p else max(v.z for v in gv)
        p = ray(ex, 0.3, z_base, (0, 0, -1)); zf = (p.z if p else z_base - 0.6) + 0.06
        hip = max(zf + 0.10, min(zr - 0.91, zf + 0.45)); eye = min(hip + 0.74, zr - 0.15); xh = ex + 0.25
        hw = half(xh, hip + 0.3); sy = max(0.26, min(0.42, hw * 0.5)); sw = max(0.36, min(0.52, hw - 0.12))
        # ---- cut the windows out of the skin. A boolean can go wrong on an awkward shell (it once ate most of a
        # body): if the skin loses far more, or far less, than the window's area, the skin is put back and that
        # window stays dark glass
        def skin():
            me = self.body.data; ci = {i for i, m in enumerate(me.materials) if m == self.M['Cutter']}
            return sum(p.area for p in me.polygons if p.material_index not in ci)
        def reach(p, n):     # from a point on the glass, in along -n: how far to the shell's far side
            q = self.hit(p - n * 0.02, -n)[0]
            return (q - p).length if q is not None else 1.0
        for o, ck in cut:
            hole = sum(f.calc_area() for f in ck.faces); a0 = skin(); keep = self.body.data.copy()
            # a shallower cutter when a deep one folds over itself, then the boolean's slower, more forgiving modes
            for depth, solver, flags in ((0.26, 'EXACT', {}), (0.1, 'EXACT', {}), (0.1, 'EXACT', {'use_self': True}),
                                         (0.1, 'EXACT', {'use_hole_tolerant': True}), (0.1, 'FAST', {})):
                self.subtract(self.block(ck.copy(), depth=depth, reach=reach), solver, 'Cutter', **flags)
                lost = a0 - skin()
                if hole * 0.3 < lost < hole * 1.5 + 0.03: break
                print(f'open_cabin: cutting {o.name} ({depth:.2f} m, {solver} {list(flags)}) took {lost:.2f} m2 for a {hole:.2f} m2 window', flush=True)
                bad = self.body.data; self.body.data = keep.copy(); bpy.data.meshes.remove(bad)
            else:
                o.data.materials.clear(); o.data.materials.append(G)
                for p in o.data.polygons: p.material_index = 0
                print(f'open_cabin: {o.name} stays dark', flush=True)
            bpy.data.meshes.remove(keep); ck.free()
        # the cutters' walls go, and so does any skin still lying right under clear glass (a shell folded over on
        # itself keeps a second layer the boolean doesn't see as inside)
        vs, fs = [], []
        for o in [o for o, _ in cut if o.data.materials[0] == self.M['GlassClear']]:
            n0 = len(vs); vs += [o.matrix_world @ v.co for v in o.data.vertices]
            fs += [[n0 + i for i in p.vertices] for p in o.data.polygons if p.material_index == 0]
        clear = BVHTree.FromPolygons(vs, fs) if fs else None
        def under(f):
            c = f.calc_center_median()
            return clear is not None and any(clear.ray_cast(c, d, 0.03)[0] is not None for d in (f.normal, -f.normal))
        me = self.body.data; ci = [i for i, m in enumerate(me.materials) if m == self.M['Cutter']]
        bm = bmesh.new(); bm.from_mesh(me); bm.normal_update()
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index in ci or under(f)], context='FACES')
        bm.to_mesh(me); bm.free()
        # ---- the black trims round the glass become thin rings that tuck under the frit
        for o in [o for o in self.parts if 'grow' in o]:
            bm = bmesh.new(); bm.from_mesh(o.data); ring = self.frame_ring(bm, o['grow'] + 0.012)
            bmesh.ops.delete(bm, geom=[f for f in bm.faces if f not in ring], context='FACES')
            bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
            bm.to_mesh(o.data); bm.free()
        # ---- a dark lining: the shell round the cabin copied 2 cm inwards and turned inside out (from outside it is
        # back-facing, so it never shows; through the glass it is the headlining, door cards and floor)
        gx0, gx1 = min(v.x for v in gv) - 0.45, max(v.x for v in gv) + 0.45
        p = ray(xm, 0, -3, (0, 0, 1)); zb = p.z if p else 0.2
        bm = bmesh.new(); bm.from_mesh(me)
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if not (gx0 < f.calc_center_median().x < gx1 and f.calc_center_median().z > zb + 0.02)], context='FACES')
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
        bm.normal_update()
        for v in bm.verts: v.co -= v.normal * 0.02
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
        for f in bm.faces: f.material_index = 0; f.smooth = True
        lining = self.mesh('lining', bm, 'Cabin')
        m = lining.modifiers.new('dec', 'DECIMATE'); m.ratio = 0.3; self.apply(lining); self.parts.append(lining)
        # ---- the old closed black tub goes; seats, dash, wheel and console are built to fit the measured cabin
        for o in [o for o in self.parts if o.name.split('.')[0] in ('cabin', 'seat', 'cushion')]:
            self.parts.remove(o); bpy.data.objects.remove(o)
        top = min(eye + 0.08, zr - 0.06)
        for s in (1, -1): self.seat(xh, s * sy, hip, sw, top)
        rx, n = xh - 0.85, 0
        driverless = getattr(self, 'no_wheel', False)        # a robotaxi: no wheel, no dials, no gear lever
        while not getattr(self, 'two_seats', False) and rx - 0.3 > x_back + 0.05 and n < 10:   # back seats while the side glass goes on (rows of them in a bus)
            p = ray(rx, 0, hip, (0, 0, 1)); zr2 = p.z if p else zr
            rh = half(rx, hip + 0.3)
            if zr2 - hip < 0.7 or rh < 0.45: break
            top2 = min(hip + 0.03 + 0.74, zr2 - 0.08)
            if rh > 1.05:      # a bus: a pair of seats each side of the aisle
                for s in (1, -1): self.seat(rx, s * (rh - 0.5), hip + 0.03, 0.9, top2, rake=14, bench=True)
            else: self.seat(rx, 0, hip + 0.03, min(rh * 2 - 0.08, 1.4), top2, rake=14, bench=True)
            rx -= 0.85; n += 1
        # the dashboard runs from just ahead of the wheel to under the windscreen
        has_screen = any(o.name.split('.')[0] == 'screen' for o in self.parts)
        wx = xh + 0.48; xd0, xd1 = wx + 0.10, max(x_base - 0.03, wx + 0.22)
        zt = z_base - 0.03; zd = max(hip + 0.18, zt - 0.32)
        dh = min(half(x, z) for x in (xd0, (xd0 + xd1) / 2, xd1 - 0.02) for z in (zt - 0.02, zd + 0.03))   # the body narrows ahead
        self.box('dash', 'Dash', ((xd0 + xd1) / 2, 0, (zt + zd) / 2), (xd1 - xd0, dh * 2, zt - zd), bevel=0.03)
        wz = min(hip + 0.36, zt - 0.05); axis = Vector((math.cos(math.radians(24)), 0, -math.sin(math.radians(24))))
        gap = ray(xd0 + 0.06, -sy, zt, (0, 0, 1)); gap = gap.z - zt if gap else 1
        if driverless: pass
        elif gap > 0.08:   # the dials' hood in front of the driver, when the glass leaves room for it
            self.box('binnacle', 'Dash', (xd0 + 0.07, -sy, zt + 0.03), (0.15, 0.36, 0.07), bevel=0.02)
            self.slab('screen', 'Screen', (xd0 - 0.004, -sy, zt + 0.01), (0, 1, 0), (-1, 0, 0.25), 0.14, 0.04, 0.003)
        else:
            self.slab('screen', 'Screen', (xd0 - 0.004, -sy, zt - 0.06), (0, 1, 0), (-1, 0, 0.25), 0.14, 0.04, 0.003)
        if not has_screen:   # the middle screen (one big one in a robotaxi)
            self.slab('screen', 'Screen', (xd0 - 0.01, 0, zt - 0.07), (0, 1, 0), (-1, 0, 0.3), *((0.24, 0.1, 0.004) if driverless else (0.12, 0.07, 0.004)))
        for s in (1, -1): self.slab('vent', 'Gloss', (xd0 - 0.004, s * dh * 0.72, zt - 0.08), (0, 1, 0), (-1, 0, 0), 0.06, 0.025, 0.006)
        # the wheel, raked towards the driver, on its column
        if not driverless:
            c = Vector((wx, -sy, wz)); upw = (Vector((0, 0, 1)) - axis * axis.z).normalized(); acr = axis.cross(upw)
            self.torus('steering', 'Leather', c, axis, 0.175, 0.017)
            for d in (acr, -acr, -upw): self.slab('spoke', 'Dash', c + d * 0.09, d, axis, 0.085, 0.022, 0.008)
            self.slab('hub', 'Dash', c + axis * 0.012, acr, axis, 0.05, 0.05, 0.025, bevel=0.01)
            self.box('column', 'Dash', c + axis * 0.16, (0.24, 0.06, 0.06), rot=(0, math.radians(24), 0))
        # centre console and gear selector between the seats
        self.box('console', 'Dash', ((xh - 0.1 + xd0) / 2, 0, (zf + hip + 0.08) / 2), (xd0 - xh + 0.1, 0.2, hip + 0.08 - zf), bevel=0.02)
        if not driverless: self.box('lever', 'Chrome', (xh + 0.32, 0, hip + 0.13), (0.03, 0.03, 0.1), bevel=0.01)

    # ------------------------------------------------------------ finish
    def join(self, lift=0.0):
        """merge every part into the Body object; `lift` raises the whole body (Dakar) - wheels are placed after"""
        if self.bvh is not None and getattr(self, 'wheel_spec', None) and not getattr(self, 'no_details', False): self.details()
        if self.bvh is not None and getattr(self, 'wheel_spec', None): self.number_plates(); self.open_cabin()
        self.activate(self.body)
        for o in self.parts: o.select_set(True)
        bpy.ops.object.join()
        self.body = bpy.context.object; self.body.name = 'Body'
        if lift: self.body.location.z += lift
        self.activate(self.body); bpy.ops.object.shade_smooth_by_angle(angle=math.radians(40))
        self.parts = []

    def renders(self, folder, views, samples=48, size=(1280, 720), sheet=None):
        """Cycles studio renders; sheet=path also tiles them into one contact sheet (3 per row)"""
        scene = self.scene; os.makedirs(folder, exist_ok=True)
        scene.render.engine = 'CYCLES'; scene.cycles.samples = samples; scene.cycles.use_denoising = True
        scene.render.resolution_x, scene.render.resolution_y = size
        scene.view_settings.view_transform = 'AgX'; scene.view_settings.look = 'AgX - Punchy'
        world = bpy.data.worlds.new('w'); scene.world = world; world.use_nodes = True
        bg = world.node_tree.nodes['Background']; sky = world.node_tree.nodes.new('ShaderNodeTexSky')
        sky.sky_type = 'NISHITA'; sky.sun_elevation = math.radians(12); sky.sun_rotation = math.radians(200); sky.sun_intensity = 0.2
        world.node_tree.links.new(sky.outputs[0], bg.inputs[0]); bg.inputs[1].default_value = 0.06
        bm = bmesh.new(); bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=40)
        floor = self.mesh('floor', bm, self.material('Floor', (0.025, 0.026, 0.028), rough=0.22))
        body = bpy.data.objects['Body']; extra = [floor]
        for loc, sx, sy, power in (((0, 0, 4.5), 6, 3, 1400), ((1.5, -5, 1.6), 7, 0.4, 500), ((-1.5, 5, 1.6), 7, 0.4, 300), ((-6, -1, 2.2), 0.5, 3, 250), ((6, 1.5, 2), 0.5, 3, 200)):
            ld = bpy.data.lights.new('l', 'AREA'); ld.shape = 'RECTANGLE'; ld.size, ld.size_y = sx, sy; ld.energy = power
            L = self.link(bpy.data.objects.new('l', ld)); L.location = loc; extra.append(L)
            L.constraints.new('TRACK_TO').target = body
        top = max((body.matrix_world @ Vector(c)).z for c in body.bound_box)
        cam = self.link(bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))); scene.camera = cam; cam.data.lens = 50
        tgt = self.link(bpy.data.objects.new('tgt', None)); tgt.location = (0, 0, 0.6 + max(0, top - 1.35) * .5)
        cam.constraints.new('TRACK_TO').target = tgt; extra += [cam, tgt]
        scale = 1 + max(0, top - 1.35) * .35            # step back a little for tall SUVs
        paths = []
        for name in views:
            cam.location = Vector(VIEWS[name]) * scale; scene.render.filepath = os.path.join(folder, f'{self.key}-{name}.png')
            bpy.ops.render.render(write_still=True); paths.append(scene.render.filepath); print('rendered', self.key, name, flush=True)
        for o in extra: bpy.data.objects.remove(o)
        if sheet: self.tile(paths, sheet, size)
    @staticmethod
    def tile(paths, out, size, cols=3):
        import numpy as np
        w, h = size; rows = (len(paths) + cols - 1) // cols
        canvas = np.zeros((rows * h, cols * w, 4), dtype=np.float32); canvas[..., 3] = 1
        for i, p in enumerate(paths):
            img = bpy.data.images.load(p); px = np.empty(w * h * 4, dtype=np.float32); img.pixels.foreach_get(px)
            r, c = divmod(i, cols); y0 = (rows - 1 - r) * h          # Blender images start bottom-left
            canvas[y0:y0 + h, c * w:(c + 1) * w] = px.reshape(h, w, 4); bpy.data.images.remove(img)
        out_img = bpy.data.images.new('sheet', cols * w, rows * h); out_img.pixels.foreach_set(canvas.ravel())
        out_img.filepath_raw = out; out_img.file_format = 'PNG'; out_img.save(); print('sheet', out, flush=True)

    def bake_ao(self, samples=128, dist=0.7):
        """ambient occlusion baked into every mesh (see bake_ao_scene)"""
        bake_ao_scene(self.scene, samples, dist)

    def export(self, glb):
        """turn the car to face glTF +Z and write <glb> (Draco) + <glb>.js (base64, loadable from file://)"""
        scene = self.scene
        for o in list(scene.objects):
            if o.type != 'MESH': bpy.data.objects.remove(o)
        R = Matrix.Rotation(-math.pi / 2, 4, 'Z')
        for o in scene.objects: o.matrix_world = R @ o.matrix_world
        for o in scene.objects: self.activate(o); bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        for o in scene.objects: o.select_set(True)
        tris = sum(len(p.vertices) - 2 for o in scene.objects for p in o.data.polygons)
        write_glb(glb, f"// Generated by models/blender/{getattr(self, 'script', 'porsches.py')} from {os.path.basename(glb)} - do not edit.\n")
        print(f'exported {glb}: {os.path.getsize(glb) / 1e6:.2f} MB, {tris} triangles', flush=True)


def bake_ao_scene(scene, samples=128, dist=0.7):
    """ambient occlusion baked into a '_AO' point attribute on every mesh (1 = open sky, 0 = tucked away): the game
    multiplies the sky light and the reflections by it, so wheel wells, vents, shut lines, the cabin seen through the
    glass and the sills over the road sit in shade like on a real car. The body is baked with its wheels and a road
    under it; the wheels and calipers only with the wheels, because the wheels spin (a dark patch from the arch would
    turn round with them) and the calipers keep their colour. Cycles on the CPU, then 3 rounds of smoothing over each
    mesh (the samples' noise) and 32 shades: about 10 s a car, and 5 bits a point in Draco"""
    import numpy as np
    meshes = [o for o in scene.objects if o.type == 'MESH']
    if not meshes: return
    wheels = [o for o in meshes if o.name.startswith('Wheel_')]; cal = [o for o in meshes if o.name.startswith('Caliper_')]
    rest = [o for o in meshes if o not in wheels and o not in cal]
    scene.render.engine = 'CYCLES'; scene.cycles.device = 'CPU'; scene.cycles.samples = samples
    scene.world = scene.world or bpy.data.worlds.new('ao'); scene.world.light_settings.distance = dist
    pts = [o.matrix_world @ Vector(c) for o in (wheels or meshes) for c in o.bound_box]
    ground_z = min(p.z for p in pts)
    bm = bmesh.new(); bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=12)
    me = bpy.data.meshes.new('ao_road'); bm.to_mesh(me); bm.free()
    road = bpy.data.objects.new('ao_road', me); scene.collection.objects.link(road); road.location.z = ground_z - 0.005
    for o in meshes:
        ca = o.data.color_attributes
        a = ca.get('AO') or ca.new('AO', 'FLOAT_COLOR', 'POINT'); ca.active_color = a
    def bake(receivers, hidden):
        for o in hidden: o.hide_render = True
        bpy.ops.object.select_all(action='DESELECT')
        for o in receivers: o.select_set(True)
        bpy.context.view_layer.objects.active = receivers[0]
        bpy.ops.object.bake(type='AO', target='VERTEX_COLORS')
        for o in hidden: o.hide_render = False
    if rest: bake(rest, [])                                       # the body: shaded by its wheels and the road too
    if wheels or cal: bake(wheels + cal, rest + [road])           # wheels and calipers: only the wheels themselves
    bpy.data.objects.remove(road); bpy.data.meshes.remove(me)
    for o in meshes:                                              # smooth the noise over each mesh, then one number a point
        me = o.data; a = me.color_attributes['AO']; n = len(me.vertices)
        c = np.empty(n * 4, dtype=np.float32); a.data.foreach_get('color', c); v = c.reshape(-1, 4)[:, 0].copy()
        e = np.empty(len(me.edges) * 2, dtype=np.int64); me.edges.foreach_get('vertices', e); e = e.reshape(-1, 2)
        if len(e):
            deg = np.bincount(e.ravel(), minlength=n).astype(np.float32); deg[deg == 0] = 1
            for _ in range(3):
                s = np.zeros(n, dtype=np.float32); np.add.at(s, e[:, 0], v[e[:, 1]]); np.add.at(s, e[:, 1], v[e[:, 0]])
                v = 0.5 * v + 0.5 * s / deg
        v = np.round(np.clip(v, 0, 1) * 31) / 31
        me.color_attributes.remove(a)
        old = me.attributes.get('_AO')
        if old: me.attributes.remove(old)
        me.attributes.new('_AO', 'FLOAT', 'POINT').data.foreach_set('value', v.astype(np.float32))
    print(f'baked AO on {len(meshes)} meshes', flush=True)


def write_glb(glb, header):
    """the selected objects as <glb> (Draco; the baked '_AO' goes along) + <glb>.js (base64, loadable from file://)"""
    os.makedirs(os.path.dirname(os.path.abspath(glb)), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=os.path.abspath(glb), export_format='GLB', export_apply=True, export_yup=True,
                              export_texcoords=False, export_normals=True, export_materials='EXPORT', use_selection=True,
                              export_vertex_color='NONE', export_attributes=True,
                              export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
                              export_draco_position_quantization=14, export_draco_normal_quantization=10, export_draco_generic_quantization=5)
    with open(glb, 'rb') as f: b64 = base64.b64encode(f.read()).decode()
    key = os.path.basename(glb)[:-4]
    with open(glb + '.js', 'w') as f:
        f.write(header + f"(window.AMBOOLA_MODELS = window.AMBOOLA_MODELS || {{}})['{key}'] = '{b64}';\n")


def main(cars, script):
    """shared command line: -- --car id[,id]|all [--renders DIR --samples N --views a,b --sheet] [--blend F] [--no-export] [--no-ao]
    [--photo DIR --looks studio,sunset,neon --views front34,... --samples N --size WxH --paint HEX --key ID --livery HEX --helmet HEX]
    (HD photos, see photo.py; no export)
    cars = {id: (builder, preview paint, rim, caliper)}"""
    import sys
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    arg = lambda n, d=None: argv[argv.index(n) + 1] if n in argv else d
    ids = list(cars) if arg('--car', 'all') == 'all' else arg('--car').split(',')
    repo = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    for cid in ids:
        fn, paint, rim, cal = cars[cid]
        if arg('--paint'): paint = arg('--paint')            # e.g. the game's default colour for the photo
        k = Car(cid, paint, rim, cal); k.script = script
        k.lamp_scale = getattr(sys.modules.get('__main__'), 'LAMP_SCALE', 1.0)   # a script whose lamps were drawn too small
        fn(k)
        if arg('--renders'):
            views = arg('--views', 'front34,rear34,side,front,rear,top').split(',')
            sheet = '--sheet' in argv
            k.renders(arg('--renders'), views, int(arg('--samples', '48')), (640, 360) if sheet else (1280, 720),
                      sheet=os.path.join(arg('--renders'), f'{cid}-sheet.png') if sheet else None)
        if arg('--photo'):
            import photo
            k.key = arg('--key', cid)                             # a special edition / F1 team photographed on its base model
            photo.shoot(k, arg('--photo'), arg('--looks', 'studio').split(','), arg('--views', 'front34').split(','),
                        int(arg('--samples', '128')), tuple(int(v) for v in arg('--size', '1920x1080').split('x')),
                        {n: arg('--' + n.lower()) for n in ('Livery', 'Helmet') if arg('--' + n.lower())})
            continue
        if arg('--blend'): bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(arg('--blend')))
        if '--no-export' not in argv:
            if '--no-ao' not in argv and not getattr(k, 'lite', False): k.bake_ao()   # (traffic models stay without: they are merged per material)
            k.export(os.path.join(repo, 'models', f'{cid}.glb'))
