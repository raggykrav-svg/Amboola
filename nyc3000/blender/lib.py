"""Shared helpers for the NYC 3000 Blender model scripts (Blender 4.5, run headless).

Each model is built from parts appended into one BMesh, with a material per face.
finish() then gives it smooth shading with sharp edges by angle, bakes ambient
occlusion into the vertex colours with BVH ray casts and makes a mesh object.
export() writes the objects (plus marker empties) to a GLB file.
"""
import math
import bpy
import bmesh
from mathutils import Vector as V, Matrix, Euler
from mathutils.bvhtree import BVHTree


def clamp(x, a=0.0, b=1.0):
    return a if x < a else b if x > b else x


def smooth(t):
    t = clamp(t)
    return t * t * (3 - 2 * t)


def lerp(a, b, t):
    return a + (b - a) * t


def lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def rgb(h):
    h = h.lstrip('#')
    return tuple(lin(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4))


def T(loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
    if not hasattr(scale, '__len__'):
        scale = (scale, scale, scale)
    return Matrix.LocRotScale(V(loc), Euler(rot).to_quaternion(), V(scale))


def mono(points):
    """Monotone cubic interpolation through (x, y) points (no overshoot). Returns f(x)."""
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    n = len(points)
    d = [(ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]) for i in range(n - 1)]
    m = [d[0]] + [((d[i - 1] + d[i]) / 2 if d[i - 1] * d[i] > 0 else 0.0) for i in range(1, n - 1)] + [d[-1]]
    for i in range(n - 1):
        if d[i] == 0:
            m[i] = m[i + 1] = 0.0
            continue
        a, b = m[i] / d[i], m[i + 1] / d[i]
        s = a * a + b * b
        if s > 9:
            t = 3 / math.sqrt(s)
            m[i], m[i + 1] = t * a * d[i], t * b * d[i]

    def f(x):
        if x <= xs[0]:
            return ys[0]
        if x >= xs[-1]:
            return ys[-1]
        lo, hi = 0, n - 1
        while hi - lo > 1:
            mid = (lo + hi) // 2
            if xs[mid] <= x:
                lo = mid
            else:
                hi = mid
        i = lo
        h = xs[i + 1] - xs[i]
        t = (x - xs[i]) / h
        t2, t3 = t * t, t * t * t
        return ((2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i]
                + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1])
    return f


# ---------------------------------------------------------------- materials
_MATS = {}


def mat(name, color='#808080', metal=0.0, rough=0.5, emit=None, strength=3.0):
    """Get or create a Principled material. emit = hex colour for lights and neon."""
    if name in _MATS:
        return _MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']
    c = rgb(emit or color)
    p.inputs['Base Color'].default_value = (*c, 1.0)
    p.inputs['Metallic'].default_value = metal
    p.inputs['Roughness'].default_value = rough
    if emit:
        p.inputs['Emission Color'].default_value = (*c, 1.0)
        p.inputs['Emission Strength'].default_value = strength
    _MATS[name] = m
    return m


def clear_scene():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.armatures, bpy.data.metaballs, bpy.data.materials,
                 bpy.data.cameras, bpy.data.lights, bpy.data.curves):
        for d in list(coll):
            coll.remove(d)
    _MATS.clear()


# ---------------------------------------------------------------- primitives (BMesh)
def bm_box(sx, sy, sz, bevel=0.0, seg=2):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=bm.verts)
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=min(bevel, min(sx, sy, sz) * 0.49),
                        segments=seg, profile=0.5, affect='EDGES', clamp_overlap=True)
    return bm


def bm_cyl(r1, r2, depth, seg=12, caps=True):
    """Cylinder / cone along Z, centred on the origin."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=caps, cap_tris=False, segments=seg, radius1=r1, radius2=r2, depth=depth)
    return bm


def bm_sphere(r, u=12, v=8):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=u, v_segments=v, radius=r)
    return bm


def bm_lathe(profile, seg=16, cap0=False, cap1=False, arc=None):
    """Revolve profile [(radius, z), ...] around Z. arc=(a0, a1) for a partial revolve."""
    bm = bmesh.new()
    full = arc is None
    a0, a1 = (0.0, 2 * math.pi) if full else arc
    cols = seg if full else seg + 1
    rows = []
    for k in range(cols):
        a = a0 + (a1 - a0) * k / seg
        ca, sa = math.cos(a), math.sin(a)
        rows.append([bm.verts.new((r * ca, r * sa, z)) for r, z in profile])
    for k in range(seg):
        k2 = (k + 1) % cols
        for i in range(len(profile) - 1):
            q = [rows[k][i], rows[k][i + 1], rows[k2][i + 1], rows[k2][i]]
            try:
                bm.faces.new(q)
            except ValueError:
                pass
    for cap, i in ((cap0, 0), (cap1, len(profile) - 1)):
        if cap and full and profile[i][0] > 1e-6:
            try:
                bm.faces.new([rows[k][i] for k in range(cols)])
            except ValueError:
                pass
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    fix_normals(bm)
    return bm


def bm_torus(R, r, seg=24, rseg=6):
    prof = [(R + r * math.cos(2 * math.pi * k / rseg), r * math.sin(2 * math.pi * k / rseg)) for k in range(rseg + 1)]
    bm = bm_lathe(prof, seg)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    return bm


def bm_from_mods(bm, mods):
    """Run Blender modifiers over a BMesh: mods = [(type, {prop: value}), ...]. Returns a new BMesh."""
    me = bpy.data.meshes.new('tmp')
    bm.to_mesh(me)
    ob = bpy.data.objects.new('tmp', me)
    bpy.context.scene.collection.objects.link(ob)
    for i, (kind, props) in enumerate(mods):
        md = ob.modifiers.new('m%d' % i, kind)
        for k, v in props.items():
            setattr(md, k, v)
    dg = bpy.context.evaluated_depsgraph_get()
    me2 = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    out = bmesh.new()
    out.from_mesh(me2)
    bpy.data.objects.remove(ob, do_unlink=True)
    bpy.data.meshes.remove(me)
    bpy.data.meshes.remove(me2)
    return out


def bm_from_object(ob, remove=True):
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    out = bmesh.new()
    out.from_mesh(me)
    out.transform(ob.matrix_world)
    bpy.data.meshes.remove(me)
    if remove:
        data = ob.data
        bpy.data.objects.remove(ob, do_unlink=True)
        try:
            if data is not None and data.users == 0:
                if isinstance(data, bpy.types.MetaBall):
                    bpy.data.metaballs.remove(data)
                elif isinstance(data, bpy.types.Mesh):
                    bpy.data.meshes.remove(data)
        except ReferenceError:
            pass
    return out


def fix_normals(bm):
    """Point every closed island's faces outwards."""
    if bm.faces:
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))


# ---------------------------------------------------------------- the builder
class Builder:
    """Collects parts into one BMesh. Each vertex records the bone index active when it was added."""

    def __init__(self):
        self.bm = bmesh.new()
        self.mats = []
        self.lay_bone = self.bm.verts.layers.int.new('bone')
        self.bone = 0

    def mi(self, m):
        try:
            return self.mats.index(m)
        except ValueError:
            self.mats.append(m)
            return len(self.mats) - 1

    def add(self, src, m=None, matrix=None, mats=None, free=True):
        """Append the faces of BMesh `src` with one material m (or mats[src material_index])."""
        mx = matrix if matrix is not None else Matrix.Identity(4)
        flip = mx.to_3x3().determinant() < 0
        vmap = {}
        for v in src.verts:
            nv = self.bm.verts.new(mx @ v.co)
            nv[self.lay_bone] = self.bone
            vmap[v] = nv
        out = []
        for f in src.faces:
            vs = [vmap[v] for v in f.verts]
            if flip:
                vs.reverse()
            try:
                nf = self.bm.faces.new(vs)
            except ValueError:
                continue
            mm = m if m is not None else mats[min(f.material_index, len(mats) - 1)]
            nf.material_index = self.mi(mm)
            nf.smooth = True
            out.append(nf)
        if free:
            src.free()
        return out

    # convenience wrappers: (size..., material, location, rotation)
    def box(self, sx, sy, sz, m, loc=(0, 0, 0), rot=(0, 0, 0), bevel=0.0, seg=2):
        return self.add(bm_box(sx, sy, sz, bevel, seg), m, T(loc, rot))

    def cyl(self, r1, r2, depth, m, loc=(0, 0, 0), rot=(0, 0, 0), seg=12, caps=True, scale=(1, 1, 1)):
        return self.add(bm_cyl(r1, r2, depth, seg, caps), m, T(loc, rot, scale))

    def sphere(self, r, m, loc=(0, 0, 0), scale=(1, 1, 1), u=12, v=8, rot=(0, 0, 0)):
        return self.add(bm_sphere(r, u, v), m, T(loc, rot, scale))

    def lathe(self, profile, m, loc=(0, 0, 0), rot=(0, 0, 0), seg=16, cap0=False, cap1=False, scale=(1, 1, 1)):
        return self.add(bm_lathe(profile, seg, cap0, cap1), m, T(loc, rot, scale))

    def torus(self, R, r, m, loc=(0, 0, 0), rot=(0, 0, 0), seg=24, rseg=6, scale=(1, 1, 1)):
        return self.add(bm_torus(R, r, seg, rseg), m, T(loc, rot, scale))

    def loft(self, rings, mat_fn, closed=True, cap0=False, cap1=False, cap_m=None):
        """Skin a surface through rings (lists of points with equal length).
        mat_fn(i, j, face) -> material, with i = ring step and j = segment around."""
        bm = self.bm
        rows = []
        for ring in rings:
            row = []
            for p in ring:
                v = bm.verts.new(p)
                v[self.lay_bone] = self.bone
                row.append(v)
            rows.append(row)
        n = len(rings[0])
        segs = n if closed else n - 1
        self.last_rows = rows
        faces = []
        for i in range(len(rings) - 1):
            for j in range(segs):
                j2 = (j + 1) % n
                try:
                    f = bm.faces.new([rows[i][j], rows[i][j2], rows[i + 1][j2], rows[i + 1][j]])
                except ValueError:
                    continue
                f.smooth = True
                faces.append((f, i, j))
        # orient outwards: compare with the ring centroids
        cents = [sum((V(p) for p in ring), V()) / len(ring) for ring in rings]
        score = 0.0
        for f, i, j in faces:
            f.normal_update()
            c = (cents[i] + cents[i + 1]) * 0.5
            score += f.normal.dot(f.calc_center_median() - c) * f.calc_area()
        if score < 0:
            bmesh.ops.reverse_faces(bm, faces=[f for f, _, _ in faces])
        for f, i, j in faces:
            f.normal_update()
            f.material_index = self.mi(mat_fn(i, j, f))
        caps = []
        for do, k, nb in ((cap0, 0, 1), (cap1, len(rings) - 1, len(rings) - 2)):
            if not do:
                continue
            ctr = bm.verts.new(cents[k])
            ctr[self.lay_bone] = self.bone
            out_dir = cents[k] - cents[nb]
            tris = []
            for j in range(n):
                j2 = (j + 1) % n
                try:
                    t = bm.faces.new([ctr, rows[k][j], rows[k][j2]])
                except ValueError:
                    continue
                t.normal_update()
                tris.append(t)
            if tris and sum(t.normal.dot(out_dir) for t in tris) < 0:
                bmesh.ops.reverse_faces(bm, faces=tris)
            for t in tris:
                t.normal_update()
                t.smooth = True
                t.material_index = self.mi(cap_m or mat_fn(k, 0, t))
            caps += tris
        return faces, caps


# ---------------------------------------------------------------- finishing
def hemi_dirs(n=48):
    """Cosine-weighted hemisphere directions around +Z (Fibonacci spiral)."""
    ga = math.pi * (3 - math.sqrt(5))
    out = []
    for k in range(n):
        u = (k + 0.5) / n
        r = math.sqrt(u)
        out.append(V((r * math.cos(k * ga), r * math.sin(k * ga), math.sqrt(max(0.0, 1 - u)))))
    return out


def bake_ao(bm, dist=0.6, rays=40, ground=None, floor=0.25, gamma=1.0, extra=None):
    """Per-vertex ambient occlusion into the float colour layer 'Col'.
    ground = z of an occluding floor plane (None = no floor). extra = list of extra BMesh occluders."""
    bm.normal_update()
    trees = [BVHTree.FromBMesh(bm)]
    if ground is not None:
        g = bmesh.new()
        S = 200
        g.faces.new([g.verts.new(c) for c in ((-S, -S, ground), (S, -S, ground), (S, S, ground), (-S, S, ground))])
        trees.append(BVHTree.FromBMesh(g))
        g.free()
    for e in extra or []:
        trees.append(BVHTree.FromBMesh(e))
    dirs = hemi_dirs(rays)
    lay = bm.verts.layers.float_color.get('Col') or bm.verts.layers.float_color.new('Col')
    up = V((0, 0, 1))
    for v in bm.verts:
        n = v.normal
        if n.length < 0.5:
            n = up
        t = n.orthogonal().normalized()
        s = n.cross(t)
        o = v.co + n * 0.004
        occ = 0.0
        for d in dirs:
            w = t * d.x + s * d.y + n * d.z
            best = None
            for tr in trees:
                hit = tr.ray_cast(o, w, dist)
                if hit[0] is not None and (best is None or hit[3] < best):
                    best = hit[3]
            if best is not None:
                occ += 1.0 - 0.6 * (best / dist)
        a = clamp(1.0 - occ / len(dirs)) ** gamma
        a = floor + (1 - floor) * a
        v[lay] = (a, a, a, 1.0)


def set_sharp(bm, angle=48):
    bm.normal_update()
    th = math.radians(angle)
    for e in bm.edges:
        lf = e.link_faces
        e.smooth = len(lf) == 2 and lf[0].normal.angle(lf[1].normal, 0.0) < th


def finish(b, name, sharp=48, ao=None, link=True):
    """Turn a Builder into a mesh object: sharp edges by angle, baked AO, materials."""
    bm = b.bm
    set_sharp(bm, sharp)
    if ao is not None:
        bake_ao(bm, **ao)
    else:
        lay = bm.verts.layers.float_color.new('Col')
        for v in bm.verts:
            v[lay] = (1, 1, 1, 1)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in b.mats:
        me.materials.append(m)
    if 'Col' in me.color_attributes:
        me.color_attributes.active_color = me.color_attributes['Col']
    ob = bpy.data.objects.new(name, me)
    if link:
        bpy.context.scene.collection.objects.link(ob)
    return ob


def marker(name, loc, scale=(1, 1, 1), props=None):
    ob = bpy.data.objects.new(name, None)
    ob.location = loc
    ob.scale = scale
    for k, v in (props or {}).items():
        ob[k] = v
    bpy.context.scene.collection.objects.link(ob)
    return ob


def tri_count(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)


def export(path, objs):
    for o in bpy.context.scene.objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
        export_texcoords=True, export_normals=True, export_vertex_color='ACTIVE', export_all_vertex_colors=False,
        export_materials='EXPORT', export_image_format='NONE', export_skins=True, export_def_bones=False,
        export_rest_position_armature=True, export_animations=False, export_morph=False, export_extras=True,
        export_attributes=False)


# ---------------------------------------------------------------- preview renders (Cycles)
def render(objs, path, cam=(6, -7, 3.2), target=(0, 0, 0.8), lens=45, res=(720, 440), samples=24,
           sky='#2a2d48', sun_dir=(0.9, 0.3, 0.6), floor=True):
    sc = bpy.context.scene
    keep = set(objs)
    for o in sc.objects:
        o.hide_render = (o.type in ('MESH', 'META') and o not in keep)
    camd = bpy.data.cameras.get('pcam') or bpy.data.cameras.new('pcam')
    camd.lens = lens
    camd.clip_end = 5000
    cam_ob = bpy.data.objects.get('pcam') or bpy.data.objects.new('pcam', camd)
    if cam_ob.name not in sc.collection.objects:
        sc.collection.objects.link(cam_ob)
    cam_ob.location = cam
    cam_ob.rotation_euler = (V(target) - V(cam)).to_track_quat('-Z', 'Y').to_euler()
    sc.camera = cam_ob
    sun = bpy.data.objects.get('psun')
    if not sun:
        ld = bpy.data.lights.new('psun', 'SUN')
        ld.energy = 3.0
        ld.angle = 0.2
        sun = bpy.data.objects.new('psun', ld)
        sc.collection.objects.link(sun)
    sun.rotation_euler = V(sun_dir).to_track_quat('Z', 'Y').to_euler()
    if floor and not bpy.data.objects.get('pfloor'):
        me = bpy.data.meshes.new('pfloor')
        S = 400
        me.from_pydata([(-S, -S, 0), (S, -S, 0), (S, S, 0), (-S, S, 0)], [], [(0, 1, 2, 3)])
        fl = bpy.data.objects.new('pfloor', me)
        fl.data.materials.append(mat('_floor', '#3a3c48', 0.2, 0.6))
        sc.collection.objects.link(fl)
    if bpy.data.objects.get('pfloor'):
        bpy.data.objects['pfloor'].hide_render = not floor
    w = sc.world or bpy.data.worlds.new('w')
    sc.world = w
    w.use_nodes = True
    w.node_tree.nodes['Background'].inputs['Color'].default_value = (*rgb(sky), 1)
    w.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.0
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.resolution_percentage = 100
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
