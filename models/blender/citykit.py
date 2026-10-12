# Shared building blocks for the country towns (models/blender/cities.py): every model is a Node, one Blender object
# whose faces carry material slots, filled with boxes, cylinders, lathes, prisms, roofs and window/door facades.
#
# Units are metres. Blender axes: X east, Y north, Z up. The glTF export turns that into the game's axes:
# game x = X, game y = Z, game z = -Y (so a game offset (dx, dz) is Blender (dx, -dz)).
#
# Material names are read by the game (index.html, cityKit): Wall and Roof are white here and tinted per building,
# Window glows at night, Glass and WindowOff stay dark, Glow lights up at night; every other material keeps its colour.
import bpy, bmesh, math, os, base64, random
from mathutils import Vector, Matrix

def V(*a): return Vector(a)
def lerp(a, b, t): return a + (b - a) * t

def lin(h):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in c]

class Mats:
    """one Blender material per name for the whole file"""
    def __init__(self): self.m = {}
    def get(self, name, col='#ffffff', rough=.7, metal=0., emit=None, strength=0., double=False):
        if name in self.m: return self.m[name]
        m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
        b.inputs['Base Color'].default_value = (*lin(col), 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
        if emit: b.inputs['Emission Color'].default_value = (*lin(emit), 1); b.inputs['Emission Strength'].default_value = strength
        m.use_backface_culling = not double
        self.m[name] = m; return m

M = Mats()
# the shared palette (anything a style needs on top is made with M.get by the style)
BASE = {
    'Wall': ('#ffffff', .85), 'Roof': ('#ffffff', .8), 'RoofFlat': ('#8c8a86', .95), 'Window': ('#1c2a38', .12), 'WindowOff': ('#141c26', .12),
    'Glass': ('#24384c', .08), 'Frame': ('#f2efe8', .6), 'Stone': ('#e4dccb', .85), 'Door': ('#4a2e1c', .6), 'Metal': ('#1c1d20', .45),
    'Dark': ('#202022', .8), 'Glow': ('#fff2c8', .4),
}
def mat(name):
    if name not in M.m and name in BASE:
        c, r = BASE[name]
        M.get(name, c, r, metal=.5 if name in ('Metal', 'Glass') else 0, emit='#fff2c8' if name == 'Glow' else None, strength=4 if name == 'Glow' else 0, double=name == 'Metal')
    return M.m[name]

NODES = []
class Node:
    """one exported object; geometry goes into a single bmesh with a material index per face (build_all() makes them)"""
    def __init__(self, name, **props):
        self.name, self.bm, self.mats, self.props, self.built = name, bmesh.new(), [], props, False; NODES.append(self)
    def mi(self, m):
        if m not in self.mats: self.mats.append(m)
        return self.mats.index(m)
    def _own(self, verts, m, smooth=False):
        faces = {f for v in verts for f in v.link_faces}
        k = self.mi(m)
        for f in faces: f.material_index = k; f.smooth = smooth
        return faces
    # ---------------------------------------------------------------- primitives
    def box(self, m, c, s, rz=0.0, ry=0.0, rx=0.0):
        """box centred on c with size s, turned rx/ry/rz (radians) about its centre"""
        vs = bmesh.ops.create_cube(self.bm, size=1)['verts']
        R = Matrix.Rotation(rz, 4, 'Z') @ Matrix.Rotation(ry, 4, 'Y') @ Matrix.Rotation(rx, 4, 'X')
        bmesh.ops.transform(self.bm, matrix=Matrix.Translation(V(*c)) @ R @ Matrix.Diagonal((*s, 1)), verts=vs)
        self._own(vs, m); return vs
    def boxa(self, m, x0, y0, z0, x1, y1, z1):
        return self.box(m, ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), (abs(x1 - x0), abs(y1 - y0), abs(z1 - z0)))
    def cyl(self, m, c, r, h, segs=16, r2=None, caps=True, smooth=True, rx=0.0, ry=0.0, rz=0.0):
        """cylinder/cone standing on c (z from c.z to c.z + h), then turned about c"""
        vs = bmesh.ops.create_cone(self.bm, cap_ends=caps, cap_tris=False, segments=segs, radius1=r, radius2=r if r2 is None else r2, depth=h)['verts']
        bmesh.ops.translate(self.bm, vec=V(0, 0, h / 2), verts=vs)
        R = Matrix.Rotation(rz, 4, 'Z') @ Matrix.Rotation(ry, 4, 'Y') @ Matrix.Rotation(rx, 4, 'X')
        bmesh.ops.transform(self.bm, matrix=Matrix.Translation(V(*c)) @ R, verts=vs)
        fs = self._own(vs, m, smooth)
        if smooth:   # flat caps (the n-gons)
            for f in fs:
                if len(f.verts) > 4: f.smooth = False
        return vs
    def sphere(self, m, c, r, segs=16, rings=10, scale=(1, 1, 1), hemi=False, smooth=True):
        vs = bmesh.ops.create_uvsphere(self.bm, u_segments=segs, v_segments=rings, radius=r)['verts']
        if hemi:
            kill = [v for v in vs if v.co.z < -1e-4]; bmesh.ops.delete(self.bm, geom=kill, context='VERTS'); vs = [v for v in vs if v.is_valid]
        bmesh.ops.transform(self.bm, matrix=Matrix.Translation(V(*c)) @ Matrix.Diagonal((*scale, 1)), verts=vs)
        self._own(vs, m, smooth); return vs
    def ico(self, m, c, r, sub=1, scale=(1, 1, 1), jitter=0.0, rnd=None):
        vs = bmesh.ops.create_icosphere(self.bm, subdivisions=sub, radius=r)['verts']
        if jitter:
            for v in vs: v.co *= 1 + (rnd.random() - .5) * 2 * jitter
        bmesh.ops.transform(self.bm, matrix=Matrix.Translation(V(*c)) @ Matrix.Diagonal((*scale, 1)), verts=vs)
        self._own(vs, m, False); return vs
    def lathe(self, m, prof, segs=24, c=(0, 0, 0), smooth=True, a0=0.0, a1=2 * math.pi, scale=(1, 1)):
        """surface of revolution about the vertical axis through c; prof = [(radius, z), ...] bottom to top"""
        full = abs(a1 - a0 - 2 * math.pi) < 1e-6; n = segs if full else segs + 1
        rings = []
        for r, z in prof:
            if r < 1e-6: rings.append([self.bm.verts.new((c[0], c[1], c[2] + z))]); continue
            rings.append([self.bm.verts.new((c[0] + math.cos(a0 + (a1 - a0) * i / segs) * r * scale[0], c[1] + math.sin(a0 + (a1 - a0) * i / segs) * r * scale[1], c[2] + z)) for i in range(n)])
        fs = []
        for A, B in zip(rings, rings[1:]):
            for i in range(segs):
                j = (i + 1) % n if full else i + 1
                if len(A) == 1 and len(B) == 1: continue
                if len(A) == 1: q = [A[0], B[i], B[j]][::-1]
                elif len(B) == 1: q = [A[i], A[j], B[0]]
                else: q = [A[i], A[j], B[j], B[i]]
                try: fs.append(self.bm.faces.new(q))
                except ValueError: pass
        k = self.mi(m)
        for f in fs: f.material_index = k; f.smooth = smooth
        return fs
    def face(self, m, pts, nrm=None, smooth=False):
        """one polygon; flipped if it does not face nrm"""
        try: f = self.bm.faces.new([self.bm.verts.new(p) for p in pts])
        except ValueError: return None
        f.normal_update()
        if nrm is not None and f.normal.dot(V(*nrm)) < 0: f.normal_flip()
        f.material_index = self.mi(m); f.smooth = smooth; return f
    def prism(self, m, poly, z0, z1, smooth=False):
        """vertical prism from a 2D polygon [(x, y), ...] (counter-clockwise seen from above)"""
        bot = [self.bm.verts.new((x, y, z0)) for x, y in poly]; top = [self.bm.verts.new((x, y, z1)) for x, y in poly]
        fs = [self.bm.faces.new(list(reversed(bot))), self.bm.faces.new(top)]
        for i in range(len(poly)):
            j = (i + 1) % len(poly); fs.append(self.bm.faces.new([bot[i], bot[j], top[j], top[i]]))
        k = self.mi(m)
        for f in fs: f.material_index = k; f.smooth = False
        return fs
    def extrude(self, m, sec, x0, x1, axis='x'):
        """a cross-section [(a, z), ...] (counter-clockwise, a across the axis) pulled along x (or y) from x0 to x1"""
        P = (lambda t, a, z: (t, a, z)) if axis == 'x' else (lambda t, a, z: (-a, t, z))
        A = [self.bm.verts.new(P(x0, a, z)) for a, z in sec]; B = [self.bm.verts.new(P(x1, a, z)) for a, z in sec]
        fs = [self.bm.faces.new(list(reversed(A)) if axis == 'x' else A), self.bm.faces.new(B if axis == 'x' else list(reversed(B)))]
        for i in range(len(sec)):
            j = (i + 1) % len(sec); fs.append(self.bm.faces.new([A[i], A[j], B[j], B[i]] if axis == 'x' else [A[j], A[i], B[i], B[j]]))
        k = self.mi(m)
        for f in fs: f.material_index = k; f.smooth = False
        bmesh.ops.recalc_face_normals(self.bm, faces=fs)
        return fs
    def tube(self, m, path, r, segs=8, smooth=True, r_end=None):
        """a round tube along a 3D path (trunks, rails, cables)"""
        rings = []
        for i, p in enumerate(path):
            p = V(*p); t = (V(*path[min(i + 1, len(path) - 1)]) - V(*path[max(i - 1, 0)])).normalized()
            a = t.orthogonal().normalized(); b = t.cross(a); rr_ = lerp(r, r if r_end is None else r_end, i / (len(path) - 1))
            rings.append([self.bm.verts.new(p + (a * math.cos(2 * math.pi * k / segs) + b * math.sin(2 * math.pi * k / segs)) * rr_) for k in range(segs)])
        fs = []
        for A, B in zip(rings, rings[1:]):
            for k in range(segs): fs.append(self.bm.faces.new([A[k], A[(k + 1) % segs], B[(k + 1) % segs], B[k]]))
        fs.append(self.bm.faces.new(list(reversed(rings[0])))); fs.append(self.bm.faces.new(rings[-1]))
        bmesh.ops.recalc_face_normals(self.bm, faces=fs)
        k = self.mi(m)
        for f in fs: f.material_index = k; f.smooth = smooth
        fs[-1].smooth = fs[-2].smooth = False
        return fs
    def arch(self, m, c, span, rise, depth, thick, segs=10, axis='x', z_spring=None):
        """an arch ring (voussoirs) in the vertical plane along axis, springing at c.z, spanning `span`"""
        r = span / 2; sec_in = [(math.cos(math.pi * i / segs) * r, math.sin(math.pi * i / segs) * rise) for i in range(segs + 1)]
        sec_out = [(math.cos(math.pi * i / segs) * (r + thick), math.sin(math.pi * i / segs) * (rise + thick)) for i in range(segs + 1)]
        fs = []
        for (a0, z0), (a1, z1), (b0, w0), (b1, w1) in zip(sec_in, sec_in[1:], sec_out, sec_out[1:]):
            # one voussoir: a little prism of 4 corners in (u, z), pulled through the depth
            q = [(a0, z0), (b0, w0), (b1, w1), (a1, z1)]
            fs += self.extrude_quad(m, q, c, depth, axis)
        return fs
    def extrude_quad(self, m, q, c, depth, axis):
        cx, cy, cz = c
        if axis == 'x': P = lambda u, z, t: (cx + u, cy + t, cz + z)
        else: P = lambda u, z, t: (cx + t, cy + u, cz + z)
        A = [self.bm.verts.new(P(u, z, -depth / 2)) for u, z in q]; B = [self.bm.verts.new(P(u, z, depth / 2)) for u, z in q]
        fs = [self.bm.faces.new(A), self.bm.faces.new(list(reversed(B)))]
        for i in range(4):
            j = (i + 1) % 4; fs.append(self.bm.faces.new([A[j], A[i], B[i], B[j]]))
        bmesh.ops.recalc_face_normals(self.bm, faces=fs)
        k = self.mi(m)
        for f in fs: f.material_index = k; f.smooth = False
        return fs
    def blob(self, m, parts, res=.6, stiff=2.0):
        """one smooth body from overlapping ellipsoids [((x, y, z), (sx, sy, sz)), ...] (a metaball turned into a mesh)"""
        mb = bpy.data.metaballs.new('blob'); mb.resolution = mb.render_resolution = res
        o = bpy.data.objects.new('blob', mb); bpy.context.scene.collection.objects.link(o)
        for c, (a, b, cc) in parts:
            e = mb.elements.new(); e.type = 'ELLIPSOID'; e.co = c; e.radius = 1.49; e.size_x, e.size_y, e.size_z = a, b, cc; e.stiffness = stiff   # radius 1.49: the surface then sits at the given sizes
        deps = bpy.context.evaluated_depsgraph_get(); me = bpy.data.meshes.new_from_object(o.evaluated_get(deps))
        n0 = len(self.bm.faces); self.bm.from_mesh(me); self.bm.faces.ensure_lookup_table(); k = self.mi(m)
        for f in self.bm.faces[n0:]: f.material_index = k; f.smooth = True
        bpy.data.objects.remove(o); bpy.data.metaballs.remove(mb); bpy.data.meshes.remove(me)
    def mark(self):
        self.bm.verts.ensure_lookup_table(); return len(self.bm.verts)
    def shift(self, k, d):
        """move everything made since mark() k by d"""
        self.bm.verts.ensure_lookup_table(); bmesh.ops.translate(self.bm, vec=V(*d), verts=self.bm.verts[k:])
    # ---------------------------------------------------------------- finish
    def build(self):
        if self.built: return bpy.data.objects[self.name]
        self.built = True; bm = self.bm
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
        for e in bm.edges:   # auto-smooth: sharp where the faces disagree or meet at an angle
            if len(e.link_faces) == 2:
                a, b = e.link_faces
                if a.smooth != b.smooth or a.material_index != b.material_index or e.calc_face_angle(0) > math.radians(40): e.smooth = False
        me = bpy.data.meshes.new(self.name); bm.to_mesh(me); bm.free()
        for n in self.mats: me.materials.append(mat(n) if isinstance(n, str) else n)
        o = bpy.data.objects.new(self.name, me); bpy.context.scene.collection.objects.link(o)
        for k, v in self.props.items(): o[k] = v
        return o

# ---------------------------------------------------------------------------------------------------- facades
# A storey's walls are a box W x D x h. Its four sides are numbered 0 (+Y, north), 1 (+X), 2 (-Y), 3 (-X); on a side,
# u runs along the wall (centred), v is the height above the storey floor, w points out of the wall.
def side_frame(W, D, side):
    return [(V(0, D / 2, 0), V(1, 0, 0), V(0, 1, 0)), (V(W / 2, 0, 0), V(0, -1, 0), V(1, 0, 0)),
            (V(0, -D / 2, 0), V(-1, 0, 0), V(0, -1, 0)), (V(-W / 2, 0, 0), V(0, 1, 0), V(-1, 0, 0))][side]

class Face:
    """draw on one side of a storey: P(u, v, w) -> world point"""
    def __init__(self, n, W, D, side, z0):
        self.n, self.z0 = n, z0; self.O, self.T, self.N = side_frame(W, D, side); self.L = W if side % 2 == 0 else D
    def P(self, u, v, w): return self.O + self.T * u + self.N * w + V(0, 0, self.z0 + v)
    def quad(self, m, u0, v0, u1, v1, w, nrm=None):
        return self.n.face(m, [self.P(u0, v0, w), self.P(u1, v0, w), self.P(u1, v1, w), self.P(u0, v1, w)], nrm or self.N)
    def poly(self, m, pts, w, nrm=None): return self.n.face(m, [self.P(u, v, w) for u, v in pts], nrm or self.N)
    def block(self, m, u0, v0, u1, v1, w0, w1):
        c = (self.P((u0 + u1) / 2, (v0 + v1) / 2, (w0 + w1) / 2)); a = math.atan2(self.T.y, self.T.x)
        return self.n.box(m, c, (abs(u1 - u0), abs(w1 - w0), abs(v1 - v0)), rz=a)
    def ring(self, m, inner, outer, w):
        """flat frame between two outlines (same point count, counter-clockwise in u, v)"""
        k = len(inner)
        for i in range(k):
            j = (i + 1) % k; self.n.face(m, [self.P(*inner[i], w), self.P(*inner[j], w), self.P(*outer[j], w), self.P(*outer[i], w)], self.N)
    def reveal(self, m, outline, w0, w1):
        """the inner sides of an opening from depth w0 (the glass) out to w1 (the frame face)"""
        k = len(outline); c = sum((V(u, v, 0) for u, v in outline), V(0, 0, 0)) / k
        for i in range(k):
            j = (i + 1) % k; mid = (V(*outline[i], 0) + V(*outline[j], 0)) / 2; inward = (c - mid)
            self.n.face(m, [self.P(*outline[i], w0), self.P(*outline[j], w0), self.P(*outline[j], w1), self.P(*outline[i], w1)], self.T * inward.x + V(0, 0, inward.y))

class Frame3(Face):
    """a Face on any vertical plane: origin O, along-wall T, outward N (all horizontal), floor height z0"""
    def __init__(self, n, O, T, N, z0=0.0, L=0.0):
        self.n, self.O, self.T, self.N, self.z0, self.L = n, V(*O), V(*T).normalized(), V(*N).normalized(), z0, L

def arch_wall(F, m, u0, u1, vs, vt, w0, w1, segs=8, soffit=None):
    """wall from u0 to u1 between depths w0 (inside) and w1 (outside) with a round arch springing at vs, wall top vt"""
    r, c = (u1 - u0) / 2, (u0 + u1) / 2
    arc = [(c + math.cos(math.pi - math.pi * i / segs) * r, vs + math.sin(math.pi - math.pi * i / segs) * r) for i in range(segs + 1)]   # u0 side -> u1 side
    poly = [(u1, vs), (u1, vt), (u0, vt), (u0, vs)] + arc[1:-1]
    F.poly(m, poly, w1, F.N); F.poly(m, poly, w0, -F.N)
    for (a0, b0), (a1, b1) in zip(arc, arc[1:]):   # the underside of the arch
        mid = ((a0 + a1) / 2 - c, (b0 + b1) / 2 - vs)
        F.n.face(soffit or m, [F.P(a0, b0, w0), F.P(a1, b1, w0), F.P(a1, b1, w1), F.P(a0, b0, w1)], F.T * -mid[0] + V(0, 0, -mid[1]))

def outline(u0, v0, u1, v1, arch=0.0, segs=6):
    """rectangle (or round-topped when arch > 0: the top is a half ellipse of that rise) counter-clockwise in (u, v)"""
    if not arch: return [(u0, v0), (u1, v0), (u1, v1), (u0, v1)]
    c, r = (u0 + u1) / 2, (u1 - u0) / 2
    return [(u0, v0), (u1, v0)] + [(c + math.cos(math.pi * i / segs) * r, v1 - arch + math.sin(math.pi * i / segs) * arch) for i in range(segs + 1)]

def grow(pts, d, arch=0.0):
    us = [p[0] for p in pts]; vs = [p[1] for p in pts]; u0, u1, v0, v1 = min(us), max(us), min(vs), max(vs)
    if not arch: return outline(u0 - d, v0 - d, u1 + d, v1 + d)
    return outline(u0 - d, v0 - d, u1 + d, v1 + d, arch + d, len(pts) - 3)

def window(F, u, v0, ww, wh, S, rnd):
    """one window on face F centred at u, bottom at v0. S: style dict (see WINDOW below)"""
    a = S.get('arch', 0.0) * ww; inner = outline(u - ww / 2, v0, u + ww / 2, v0 + wh, a)
    glass = 'Window' if rnd.random() < S.get('lit', .55) else 'WindowOff'
    if S.get('glass'): glass = S['glass']
    gw, fo, fw = .02, S.get('fo', .07), S.get('fw', .12)
    if S.get('lite'):   # far-away version: just the glass, a little proud of the wall
        F.poly(glass, grow(inner, fw * .5, a), .04); return
    F.poly(glass, inner, gw)
    if S.get('frame'):
        F.ring(S['frame'], inner, grow(inner, fw, a), fo); F.reveal(S.get('reveal', S['frame']), inner, gw, fo)
    if S.get('bars'):   # sash bars: a cross of thin strips just in front of the glass
        F.quad(S['bars'], u - .03, v0, u + .03, v0 + wh - a, gw + .015)
        F.quad(S['bars'], u - ww / 2, v0 + wh * .52 - .03, u + ww / 2, v0 + wh * .52 + .03, gw + .015)
    if S.get('sill'):   # top and front only
        u0_, u1_, z0_, z1_ = u - ww / 2 - fw - .08, u + ww / 2 + fw + .08, v0 - fw - .1, v0 - fw + .02
        F.n.face(S['sill'], [F.P(u0_, z1_, 0), F.P(u1_, z1_, 0), F.P(u1_, z1_, .2), F.P(u0_, z1_, .2)], V(0, 0, 1)); F.quad(S['sill'], u0_, z0_, u1_, z1_, .2)
    if S.get('shutters'):
        sw = ww / 2 + .02
        for s in (-1, 1): F.quad(S['shutters'], u + s * (ww / 2 + fw + .02), v0 - .02, u + s * (ww / 2 + fw + .02 + sw), v0 + wh - a + .02, .05)
    if S.get('hood'):
        top = v0 + wh + fw; u0_, u1_ = u - ww / 2 - fw - .12, u + ww / 2 + fw + .12
        F.quad(S['hood'], u0_, top, u1_, top + .16, .24); F.n.face(S['hood'], [F.P(u0_, top + .16, 0), F.P(u1_, top + .16, 0), F.P(u1_, top + .16, .24), F.P(u0_, top + .16, .24)], V(0, 0, 1))
        F.n.face(S['hood'], [F.P(u0_, top, 0), F.P(u1_, top, 0), F.P(u1_, top, .24), F.P(u0_, top, .24)], V(0, 0, -1))
        if S.get('ped'):
            F.poly(S['hood'], [(u - ww / 2 - fw - .1, top + .16), (u + ww / 2 + fw + .1, top + .16), (u, top + .55)], .2)
    if S.get('rail'):   # a little balcony or a railing across the lower window
        d = S.get('bal', .0)
        if d:
            F.block(S.get('slab', 'Stone'), u - ww / 2 - .45, v0 - .18, u + ww / 2 + .45, v0, 0, d)
            F.quad(S['rail'], u - ww / 2 - .45, v0, u + ww / 2 + .45, v0 + 1.0, d - .03)
            for s in (-1, 1): F.n.face(S['rail'], [F.P(u + s * (ww / 2 + .45), v0, 0), F.P(u + s * (ww / 2 + .45), v0, d - .03), F.P(u + s * (ww / 2 + .45), v0 + 1, d - .03), F.P(u + s * (ww / 2 + .45), v0 + 1, 0)], F.T * s)
        else: F.quad(S['rail'], u - ww / 2 - .05, v0, u + ww / 2 + .05, v0 + .9, .1)

def door(F, u, ww, wh, S, mat_door='Door'):
    a = S.get('door_arch', 0.0) * ww; inner = outline(u - ww / 2, 0, u + ww / 2, wh, a)
    F.poly(mat_door, inner, .02)
    if S.get('frame'): F.ring(S['frame'], inner, grow(inner, S.get('fw', .12) + .04, a), S.get('fo', .07) + .02); F.reveal(S['frame'], inner, .02, S.get('fo', .07) + .02)
    if S.get('step'): F.block(S['step'], u - ww / 2 - .3, -.02, u + ww / 2 + .3, .16, 0, .5)

def storey(n, W, D, z0, h, S, rnd, sides=(0, 1, 2, 3), wall='Wall', windows=True):
    """the wall box of one storey plus its windows on every side"""
    n.box(wall, (0, 0, z0 + h / 2), (W, D, h))
    if not windows: return
    sp, ww, wh, v0 = S['spacing'], S['ww'], S['wh'], S['v0']
    for side in sides:
        F = Face(n, W, D, side, z0); L = F.L - 2 * S.get('margin', 1.2); k = max(1, int(L / sp + .5))
        for i in range(k): window(F, -L / 2 + (i + .5) * L / k, v0, ww, wh, S, rnd)

def band(n, m, W, D, z, h, out):
    """a cornice or string course right round the building"""
    n.box(m, (0, 0, z + h / 2), (W + 2 * out, D + 2 * out, h))

def corners(n, m, W, D, z0, z1, w=.6, out=.08):
    for sx in (-1, 1):
        for sy in (-1, 1): n.box(m, (sx * (W / 2 - w / 2 + out), sy * (D / 2 - w / 2 + out), (z0 + z1) / 2), (w, w, z1 - z0))

def shopfront(F, u, w, h, S, awning=None, sign=None):
    """a shop: a big glass front in a dark frame, a coloured sign band and a sloping awning"""
    F.quad('Window', u - w / 2, .3, u + w / 2, h, .03)
    F.ring(S.get('shopframe', 'Metal'), outline(u - w / 2, .3, u + w / 2, h), outline(u - w / 2 - .15, 0, u + w / 2 + .15, h + .15), .1)
    F.quad(S.get('shopframe', 'Metal'), u - .04, .3, u + .04, h, .06)
    if sign: F.block(sign, u - w / 2 - .15, h + .2, u + w / 2 + .15, h + .75, 0, .12)
    if awning:
        top, out = h + .15, 1.5
        F.n.face(awning, [F.P(u - w / 2 - .1, top, .05), F.P(u + w / 2 + .1, top, .05), F.P(u + w / 2 + .1, top - .7, out), F.P(u - w / 2 - .1, top - .7, out)], F.N + V(0, 0, 1))
        F.quad(awning, u - w / 2 - .1, top - 1.0, u + w / 2 + .1, top - .7, out)

# ---------------------------------------------------------------------------------------------------- roofs
def gable(n, W, D, z, rise, o=.6, m='Roof', ends='Wall', t=.22, ridge='x', at=None):
    """pitched roof, ridge along x (or y): two slabs with eaves `o` and triangular wall ends (centred on `at`)"""
    if at: k = n.mark(); gable(n, W, D, z, rise, o, m, ends, t, ridge); n.shift(k, (*at, 0)); return
    L, S = (W, D) if ridge == 'x' else (D, W)
    sec = [(-S / 2 - o, z - o * rise / (S / 2)), (-S / 2 - o, z - o * rise / (S / 2) + t), (0, z + rise + t), (S / 2 + o, z - o * rise / (S / 2) + t), (S / 2 + o, z - o * rise / (S / 2)), (0, z + rise)]
    n.extrude(m, sec, -L / 2 - o * .6, L / 2 + o * .6, ridge)
    for s in (-1, 1):   # gable end walls
        tri = [(-S / 2, z), (S / 2, z), (0, z + rise)]
        pts = [((s * L / 2, a, b) if ridge == 'x' else (-a, s * L / 2, b)) for a, b in tri]
        n.face(ends, pts, (s, 0, 0) if ridge == 'x' else (0, s, 0))

def hip(n, W, D, z, rise, o=.6, m='Roof', t=.22, at=None):
    """hipped roof: four slopes, ridge along the longer side; eaves overhang `o` (centred on `at`)"""
    if at: k = n.mark(); hip(n, W, D, z, rise, o, m, t); n.shift(k, (*at, 0)); return
    w2, d2 = W / 2 + o, D / 2 + o; drop = o * rise / (min(W, D) / 2)
    if W >= D: r0, r1 = (-(W - D) / 2, 0), ((W - D) / 2, 0)
    else: r0, r1 = (0, -(D - W) / 2), (0, (D - W) / 2)
    for zz, top in ((z - drop + t, True), (z - drop, False)):
        h = rise + drop
        c = [V(-w2, -d2, zz), V(w2, -d2, zz), V(w2, d2, zz), V(-w2, d2, zz)]; a, b = V(*r0, zz + h), V(*r1, zz + h)
        if not top: n.face(m, c, (0, 0, -1)); continue
        if W >= D: faces = [[c[0], c[1], b, a], [c[1], c[2], b], [c[2], c[3], a, b], [c[3], c[0], a]]
        else: faces = [[c[0], c[1], a], [c[1], c[2], b, a], [c[2], c[3], b], [c[3], c[0], a, b]]
        cen = V(0, 0, zz)
        for f in faces:
            mid = sum(f, V(0, 0, 0)) / len(f); n.face(m, f, (mid - cen + V(0, 0, 1)))
        for i in range(4):   # the eave edge
            j = (i + 1) % 4; mid = (c[i] + c[j]) / 2; n.face(m, [c[i], c[j], c[j] - V(0, 0, t), c[i] - V(0, 0, t)], (mid.x, mid.y, 0))

def mansard(n, W, D, z, h1, in1, h2, m1='Roof', m2='Roof', dormers=None):
    """Paris roof: steep lower slopes rising h1 while stepping in by in1, then a low hip on top"""
    c0 = [V(-W / 2, -D / 2, z), V(W / 2, -D / 2, z), V(W / 2, D / 2, z), V(-W / 2, D / 2, z)]
    c1 = [V(-W / 2 + in1, -D / 2 + in1, z + h1), V(W / 2 - in1, -D / 2 + in1, z + h1), V(W / 2 - in1, D / 2 - in1, z + h1), V(-W / 2 + in1, D / 2 - in1, z + h1)]
    for i in range(4):
        j = (i + 1) % 4; mid = (c0[i] + c0[j]) / 2; n.face(m1, [c0[i], c0[j], c1[j], c1[i]], (mid.x, mid.y, .3))
    hip(n, W - 2 * in1, D - 2 * in1, z + h1, h2, o=.15, m=m2, t=.12)
    if dormers:   # little windows standing out of the lower slopes
        sp, dw, dh, S, rnd = dormers
        for side in range(4):
            O, T, N = side_frame(W, D, side); L = (W if side % 2 == 0 else D) - 2 * in1 - 1.0; k = max(1, int(L / sp + .5))
            for i in range(k):
                u = -L / 2 + (i + .5) * L / k; base = O + T * u + N * (-in1 * .45) + V(0, 0, z + h1 * .3)
                a = math.atan2(T.y, T.x)
                n.box('Frame', base + N * .25 + V(0, 0, dh / 2), (dw + .3, 1.2, dh), rz=a)
                F = Face(n, 1, 1, 0, 0); F.O, F.T, F.N, F.z0 = base + N * .85, T, N, 0
                F.quad('Window' if rnd.random() < .5 else 'WindowOff', -dw / 2, .15, dw / 2, dh - .25, .01)
                cap = [base + N * .9 + T * (-dw / 2 - .25) + V(0, 0, dh), base + N * .9 + T * (dw / 2 + .25) + V(0, 0, dh), base + N * .9 + V(0, 0, dh + .5)]
                n.face('Frame', cap, N); n.face(m2, [cap[0], cap[2], cap[2] - N * 1.2, cap[0] - N * 1.2], -T + V(0, 0, 1)); n.face(m2, [cap[2], cap[1], cap[1] - N * 1.2, cap[2] - N * 1.2], T + V(0, 0, 1))

def flat_roof(n, W, D, z, par=.9, m='Wall', top='RoofFlat', coping='Stone'):
    n.box(top, (0, 0, z + .05), (W - .2, D - .2, .1))
    for s in (-1, 1):
        n.box(m, (0, s * (D / 2 - .15), z + par / 2), (W, .3, par)); n.box(m, (s * (W / 2 - .15), 0, z + par / 2), (.3, D - .6, par))
    if coping:
        for s in (-1, 1):
            n.box(coping, (0, s * (D / 2 - .15), z + par + .05), (W + .1, .42, .1)); n.box(coping, (s * (W / 2 - .15), 0, z + par + .05), (.42, D - .3, .1))

def chimney(n, x, y, z, w=.7, d=.9, h=2.0, m='Brick', pots=2, pot='Pot'):
    n.box(m, (x, y, z + h / 2), (w, d, h)); n.box('Stone', (x, y, z + h + .06), (w + .12, d + .12, .12))
    for k in range(pots): n.cyl(pot, (x, y - d / 2 + (k + .5) * d / pots, z + h + .12), .11, .45, segs=6, caps=False)

# ---------------------------------------------------------------------------------------------------- trees
def tree_palm(n, h=9.0, lean=1.2, fronds=9, rnd=None):
    rnd = rnd or random.Random(3)
    path = [(lean * (t / 6) ** 2, 0, h * t / 6) for t in range(7)]
    n.tube('Trunk', path, .28, segs=6, r_end=.2)
    top = V(*path[-1])
    for k in range(fronds):
        a = 2 * math.pi * k / fronds + rnd.random() * .3; d = V(math.cos(a), math.sin(a), 0); side = V(-d.y, d.x, 0)
        L = 4.2 + rnd.random() * .8; pts = []
        for i in range(5):   # the rib droops as it goes out
            t = i / 4; pts.append(top + d * L * t + V(0, 0, .9 * math.sin(t * 2.2) - 1.6 * t * t))
        for i in range(4):
            w0, w1 = .9 * math.sin(math.pi * (i / 4) * .9 + .15), .9 * math.sin(math.pi * ((i + 1) / 4) * .9 + .15)
            for s in (-1, 1):   # leaflets: a zig-zag fan either side of the rib
                n.face('Leaf', [pts[i], pts[i + 1], pts[i + 1] + side * s * w1 + V(0, 0, -.35), pts[i] + side * s * w0 + V(0, 0, -.25)], V(0, 0, 1))
    n.sphere('Trunk', (top.x, 0, top.z - .2), .45, segs=6, rings=4)
    for k in range(3): n.sphere('Coconut', (top.x + math.cos(k * 2.1) * .35, math.sin(k * 2.1) * .35, top.z - .55), .17, segs=5, rings=3)

def tree_round(n, h=7.0, r=3.0, rnd=None, leaf='Leaves'):
    rnd = rnd or random.Random(5)
    n.tube('Bark', [(0, 0, 0), (.1, 0, h * .3), (0, .1, h * .55)], .32, segs=7, r_end=.18)
    for a in (0, 2.1, 4.2): n.tube('Bark', [(0, .1, h * .45), (math.cos(a) * r * .45, math.sin(a) * r * .45, h * .62)], .14, segs=5, r_end=.07)
    blobs = [(0, 0, h * .72, r)] + [(math.cos(a) * r * .55, math.sin(a) * r * .55, h * .62 + rnd.random() * .8, r * .7) for a in (0.3, 1.9, 3.4, 4.9)] + [(0, 0, h * .9, r * .65)]
    for x, y, z, rr_ in blobs: n.ico(leaf, (x, y, z), rr_, sub=1, scale=(1, 1, .82), jitter=.18, rnd=rnd)

def tree_cypress(n, h=11.0, rnd=None):
    rnd = rnd or random.Random(7)
    n.cyl('Bark', (0, 0, 0), .2, 1.2, segs=6)
    n.lathe('Cypress', [(0, .8), (.95, 1.6), (1.15, 3.5), (1.05, 6.5), (.7, 9.0), (.3, h - .4), (0, h)], segs=9, smooth=False)

def tree_fir(n, h=10.0, snow=False, rnd=None):
    n.cyl('Bark', (0, 0, 0), .25, 2.0, segs=6)
    tiers = [(2.6, 1.4, 4.2), (2.1, 3.6, 3.7), (1.6, 5.6, 3.1), (1.05, 7.4, 2.6)]
    for k, (r, z0, hh) in enumerate(tiers):
        ring = [(r * (1.0 if i % 2 == 0 else .72), 0) for i in range(12)]
        vs = bmesh.ops.create_cone(n.bm, cap_ends=True, cap_tris=False, segments=12, radius1=r, radius2=0, depth=hh)['verts']
        for v in vs:   # jagged skirt: every other rim point pulled in
            if abs(v.co.z + hh / 2) < 1e-4 and v.co.length > 1e-3:
                i = round(math.atan2(v.co.y, v.co.x) / (2 * math.pi / 12)); v.co.xy *= 1.0 if i % 2 == 0 else .72; v.co.z -= .25 if i % 2 == 0 else 0
        bmesh.ops.rotate(n.bm, verts=vs, cent=(0, 0, 0), matrix=Matrix.Rotation(k * .4, 3, 'Z'))
        bmesh.ops.translate(n.bm, verts=vs, vec=V(0, 0, z0 + hh / 2))
        n._own(vs, 'Fir')
        if snow: n.cyl('Snow', (0, 0, z0 + hh * .45), r * .5, hh * .5, segs=8, r2=0.02, smooth=False)

# ---------------------------------------------------------------------------------------------------- export
def export(path, key, script):
    bpy.ops.object.select_all(action='DESELECT')
    for o in bpy.context.scene.objects: o.select_set(o.type == 'MESH')
    bpy.ops.export_scene.gltf(filepath=os.path.abspath(path), export_format='GLB', export_yup=True, export_texcoords=False, export_normals=True,
                              export_materials='EXPORT', export_extras=True, use_selection=True, export_apply=True,
                              export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
                              export_draco_position_quantization=14, export_draco_normal_quantization=10)
    with open(path, 'rb') as f: b64 = base64.b64encode(f.read()).decode()
    with open(path + '.js', 'w') as f:
        f.write(f"// Generated by models/blender/{script} from {os.path.basename(path)} - do not edit.\n"
                f"(window.AMBOOLA_MODELS = window.AMBOOLA_MODELS || {{}})['{key}'] = '{b64}';\n")
    tris = sum(len(p.vertices) - 2 for o in bpy.context.scene.objects if o.type == 'MESH' for p in o.data.polygons)
    print(f'exported {path}: {os.path.getsize(path) / 1e6:.2f} MB, {tris} triangles', flush=True)

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True); M.m.clear(); NODES.clear()

def build_all():
    for n in NODES: n.build()

def render(path, objs_at, cam, look, size=(1280, 720), samples=16, lens=35, sun=(50, -40)):
    """lay out objects (name -> (x, y, rotz)) and render one Cycles still"""
    scn = bpy.context.scene
    for name, (x, y, rz) in objs_at.items():
        o = bpy.data.objects.get(name)
        if o: o.location = (x, y, 0); o.rotation_euler = (0, 0, rz)
    scn.render.engine = 'CYCLES'; scn.cycles.samples = samples; scn.render.resolution_x, scn.render.resolution_y = size
    bpy.ops.object.camera_add(location=cam); c = bpy.context.active_object; scn.camera = c; c.data.lens = lens; c.data.clip_end = 5000
    c.rotation_euler = (V(*look) - V(*cam)).to_track_quat('-Z', 'Y').to_euler()
    bpy.ops.object.light_add(type='SUN', rotation=(math.radians(sun[0]), 0, math.radians(sun[1]))); bpy.context.active_object.data.energy = 4
    w = bpy.data.worlds.new('w'); scn.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (.62, .72, .85, 1); w.node_tree.nodes['Background'].inputs[1].default_value = .8
    bpy.ops.mesh.primitive_plane_add(size=4000); g = bpy.context.active_object; g.data.materials.append(M.get('Ground', '#7f8a6a', 1))
    scn.render.filepath = os.path.abspath(path); bpy.ops.render.render(write_still=True)
    for o in [c, g] + [o for o in scn.objects if o.type == 'LIGHT']: bpy.data.objects.remove(o)
    for name in objs_at:
        o = bpy.data.objects.get(name)
        if o: o.location = (0, 0, 0); o.rotation_euler = (0, 0, 0)
