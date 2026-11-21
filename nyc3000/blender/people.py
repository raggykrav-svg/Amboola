"""NYC 3000 people modelled in Blender.

Bodies are metaballs, one family per clothing piece (top, trousers, skin, shoes, hair),
so each piece is one smooth blended surface and the pieces meet in clean seams.
Armour, helmets, visors, caps, bags and umbrellas are hard-surface parts.
Everything is skinned to the game's 17-bone skeleton (bone names match src/people.js),
bound in an A-pose: arms 35 degrees out, legs 6 degrees out. The game sets the same
A-pose on its own bones before binding, then animates them with its walk cycle and IK.
Blender axes: +Y = front (the game's -Z), +Z = up, +X = the character's right.
"""
import math
import random
import bpy
import bmesh
from mathutils import Vector as V, Matrix, Quaternion
from lib import (mat, Builder, finish, bm_box, bm_cyl, bm_sphere, bm_lathe, bm_torus, bm_from_mods, bm_from_object,
                 bake_ao, set_sharp, clamp, lerp, T, tri_count)

K = 0.574  # metaball surface radius per unit of element radius (stiffness 2, threshold 0.6)

# the game skeleton (src/people.js): name, parent, offset in Three.js axes (y up, front -z)
BONES = [
    ('root', -1, (0, 0, 0)), ('hips', 0, (0, 0.95, 0)), ('spine', 1, (0, 0.1, 0)), ('chest', 2, (0, 0.2, 0)),
    ('head', 3, (0, 0.31, 0)),
    ('uaL', 3, (-0.21, 0.22, 0)), ('faL', 5, (0, -0.3, 0)), ('hdL', 6, (0, -0.27, 0)),
    ('uaR', 3, (0.21, 0.22, 0)), ('faR', 8, (0, -0.3, 0)), ('hdR', 9, (0, -0.27, 0)),
    ('thL', 1, (-0.1, -0.02, 0)), ('shL', 11, (0, -0.43, 0)), ('ftL', 12, (0, -0.44, 0)),
    ('thR', 1, (0.1, -0.02, 0)), ('shR', 14, (0, -0.43, 0)), ('ftR', 15, (0, -0.44, 0)),
]
BI = {n: i for i, (n, _, _) in enumerate(BONES)}
REST = {}
for _n, _p, _o in BONES:
    _v = V((_o[0], -_o[2], _o[1]))
    REST[_n] = _v if _p < 0 else REST[BONES[_p][0]] + _v
ARM_A = 0.62  # bind pose: arms out (radians) - keep in sync with src/people.js
LEG_B = 0.10  # bind pose: legs out


def bind_xf(bone):
    """REST pose (arms and legs straight down) -> bind pose, for parts that ride on `bone`."""
    if bone[:2] in ('ua', 'fa', 'hd', 'th', 'sh', 'ft'):
        s = bone[2]
        arm = bone[:2] in ('ua', 'fa', 'hd')
        piv = REST[('ua' if arm else 'th') + s]
        ang = (ARM_A if arm else LEG_B) * (1 if s == 'L' else -1)
        return Matrix.Translation(piv) @ Matrix.Rotation(ang, 4, 'Y') @ Matrix.Translation(-piv)
    return Matrix.Identity(4)


BIND = {n: bind_xf(n) @ REST[n] for n in REST}
TAIL = {'root': V((0, 0, 0.1)), 'hips': V((0, 0, 0.1)), 'spine': V((0, 0, 0.2)), 'chest': V((0, 0, 0.3)), 'head': V((0, 0, 0.25))}


def tail_of(n):
    kids = [c for c, p, _ in BONES if p >= 0 and BONES[p][0] == n]
    if n in TAIL:
        return BIND[n] + TAIL[n]
    if kids:
        return BIND[kids[0]]
    # leaf bones (hands, feet) continue along their limb
    par = BONES[BONES[BI[n]][1]][0]
    d = (BIND[n] - BIND[par]).normalized()
    if n.startswith('ft'):
        d = V((0, 1, -0.2)).normalized()
    return BIND[n] + d * 0.12


# smooth-skin influence capsules (bind pose): bone -> (a, b, radius)
def influence():
    J = BIND
    out = {
        'hips': (V((0, 0, 0.86)), V((0, 0, 1.0)), 0.2),
        'spine': (V((0, 0, 1.05)), V((0, 0, 1.2)), 0.19),
        'chest': (V((0, 0, 1.26)), V((0, 0, 1.5)), 0.2),
        'head': (V((0, 0, 1.6)), V((0, 0, 1.86)), 0.15),
    }
    for s in 'LR':
        out['ua' + s] = (J['ua' + s], J['fa' + s], 0.085)
        out['fa' + s] = (J['fa' + s], J['hd' + s], 0.075)
        out['hd' + s] = (J['hd' + s], J['hd' + s] + (J['hd' + s] - J['fa' + s]).normalized() * 0.11, 0.07)
        out['th' + s] = (J['th' + s], J['sh' + s], 0.11)
        out['sh' + s] = (J['sh' + s], J['ft' + s], 0.085)
        out['ft' + s] = (J['ft' + s], J['ft' + s] + V((0, 0.16, -0.03)), 0.08)
    return out


INF = influence()


def seg_dist(p, a, b):
    ab = b - a
    t = clamp((p - a).dot(ab) / max(ab.length_squared, 1e-9))
    return (p - (a + ab * t)).length


def smooth_weights(p, sharp=2.2):
    ws = []
    for bn, (a, b, r) in INF.items():
        u = seg_dist(p, a, b) / r
        ws.append((math.exp(-(u * sharp) ** 2), bn))
    ws.sort(reverse=True)
    ws = ws[:3]
    tot = sum(w for w, _ in ws)
    if tot < 1e-12:
        return [(1.0, ws[0][1])]
    ws = [(w / tot, bn) for w, bn in ws if w / tot > 0.03]
    tot = sum(w for w, _ in ws)
    return [(w / tot, bn) for w, bn in ws]


# ------------------------------------------------------------------ metaball pieces
class Blob:
    """One metaball family = one smooth clothing piece. Coordinates are REST pose; each
    element rides on a bone and is moved into the bind pose with bind_xf()."""
    count = 0

    def __init__(self, m, target, res=0.018):
        Blob.count += 1
        name = 'blob%03d' % Blob.count
        self.mb = bpy.data.metaballs.new(name)
        self.mb.resolution = res
        self.mb.threshold = 0.6
        self.ob = bpy.data.objects.new(name, self.mb)
        bpy.context.scene.collection.objects.link(self.ob)
        self.m = m
        self.target = target

    def ell(self, bone, c, half, neg=False, rot=None):
        X = bind_xf(bone)
        mx = max(half)
        e = self.mb.elements.new()
        e.type = 'ELLIPSOID'
        e.co = X @ V(c)
        e.radius = mx / K
        e.size_x, e.size_y, e.size_z = (half[0] / mx, half[1] / mx, half[2] / mx)
        q = X.to_quaternion()
        if rot is not None:
            q = q @ rot
        e.rotation = q
        e.use_negative = neg
        return self

    def cap(self, bone, p0, p1, r):
        X = bind_xf(bone)
        a, b = X @ V(p0), X @ V(p1)
        d = b - a
        e = self.mb.elements.new()
        e.type = 'CAPSULE'
        e.co = (a + b) / 2
        e.radius = r / K
        e.size_x = max(d.length / 2, 1e-4)
        e.rotation = V((1, 0, 0)).rotation_difference(d.normalized())
        return self

    def mesh(self, lod):
        bm = bm_from_object(self.ob, remove=False)
        tris = sum(len(f.verts) - 2 for f in bm.faces)
        target = self.target * (0.3 if lod else 1.0)
        if tris > target * 1.05:
            out = bm_from_mods(bm, [('DECIMATE', {'ratio': clamp(target / tris, 0.01, 1.0)})])
            bm.free()
            bm = out
        return bm


def rigid(b, bone, src, m, matrix=None):
    """A hard-surface part riding 100% on `bone`, modelled in REST coordinates."""
    b.bone = BI[bone]
    return b.add(src, m, bind_xf(bone) @ (matrix if matrix is not None else Matrix.Identity(4)))


def shell(profile, arc, seg, thick, scale_y=1.0, center=(0, 0, 0)):
    """Curved armour plate: a partial lathe around the vertical axis, given thickness."""
    bm = bm_lathe(profile, seg, arc=arc)
    out = bm_from_mods(bm, [('SOLIDIFY', {'thickness': thick, 'offset': 1.0, 'use_even_offset': True})])
    bm.free()
    out.transform(Matrix.Translation(V(center)) @ Matrix.Diagonal((1, scale_y, 1, 1)))
    return out


def deg(a):
    return math.radians(a)


FRONT = math.pi / 2  # lathe angle that faces the front (+Y)


# ------------------------------------------------------------------ body
def body(spec, lod):
    """Smooth body pieces for a spec. Returns a list of Blobs."""
    f = spec.get('female', False)
    sw = 0.92 if f else 1.0      # shoulder width factor
    hip = 1.06 if f else 1.0
    top = Blob(spec['top_m'], 900)
    # chest, belly, shoulders
    top.ell('chest', (0, 0, 1.33), (0.185 * sw, 0.125, 0.165))
    top.ell('spine', (0, 0, 1.13), (0.158 * (0.94 if f else 1), 0.112, 0.13))
    top.cap('chest', (-0.17 * sw, 0, 1.43), (0.17 * sw, 0, 1.43), 0.074)
    if f:
        top.ell('chest', (-0.07, 0.07, 1.31), (0.075, 0.07, 0.07))
        top.ell('chest', (0.07, 0.07, 1.31), (0.075, 0.07, 0.07))
    if spec.get('bulky'):
        top.ell('chest', (0, 0, 1.3), (0.2, 0.14, 0.19))
    long_top = spec.get('long_top', False)
    if long_top:  # coat: hangs over the hips
        top.ell('hips', (0, 0, 0.93), (0.19 * hip, 0.13, 0.16))
    else:
        top.ell('spine', (0, 0, 1.01), (0.155 * hip, 0.108, 0.07))
    sleeves = spec.get('sleeves', 'long')
    skin = Blob(spec['skin_m'], 700)
    for s in 'LR':
        sx = -1 if s == 'L' else 1
        sh, el, wr = REST['ua' + s], REST['fa' + s], REST['hd' + s]
        top.ell('ua' + s, sh + V((0, 0, -0.01)), (0.075, 0.072, 0.075))  # deltoid
        if sleeves in ('long', 'short'):
            end = el if sleeves == 'long' else sh.lerp(el, 0.55)
            top.cap('ua' + s, sh + V((0, 0, -0.03)), end, 0.06)
            if sleeves == 'long':
                top.cap('fa' + s, el, wr + V((0, 0, 0.03)), 0.052)
                top.ell('fa' + s, el, (0.058, 0.058, 0.05))
            else:
                skin.cap('ua' + s, sh.lerp(el, 0.4), el, 0.05)
                skin.cap('fa' + s, el, wr + V((0, 0, 0.02)), 0.044)
        else:  # vest
            skin.cap('ua' + s, sh + V((0, 0, -0.04)), el, 0.052)
            skin.cap('fa' + s, el, wr + V((0, 0, 0.02)), 0.044)
        # hands (mittens with a thumb)
        hand = Blob(spec['hand_m'], 140) if spec.get('gloves') else skin
        hand.ell('hd' + s, wr + V((0, 0.0, -0.065)), (0.036, 0.055, 0.075))
        hand.ell('hd' + s, wr + V((-sx * 0.0, 0.045, -0.05)), (0.02, 0.022, 0.04))
        if hand is not skin:
            skin_holder = hand
            spec.setdefault('_extra', []).append(skin_holder)
    # neck and head (a helmet hides the head; the suit covers the neck)
    (top if spec.get('helmet') else skin).cap('chest', (0, 0, 1.48), (0, 0.005, 1.62), 0.052)
    if not spec.get('helmet'):
        skin.ell('head', (0, 0.006, 1.715), (0.098, 0.112, 0.122))
        skin.ell('head', (0, 0.07, 1.665), (0.07, 0.06, 0.06))   # jaw
        skin.ell('head', (0, 0.118, 1.71), (0.016, 0.03, 0.026))  # nose
        for s in (-1, 1):
            skin.ell('head', (s * 0.098, 0.0, 1.71), (0.012, 0.022, 0.03))  # ears
    # trousers / skirt
    legs = spec.get('legs', 'long')
    pants = Blob(spec['pants_m'], 700)
    pants.ell('hips', (0, 0, 0.94), (0.16 * hip, 0.108, 0.1))
    for s in 'LR':
        th, kn, an = REST['th' + s], REST['sh' + s], REST['ft' + s]
        if legs == 'skirt':
            skin.cap('th' + s, th.lerp(kn, 0.45), kn, 0.062)
            skin.cap('sh' + s, kn, an + V((0, 0, 0.05)), 0.05)
            skin.ell('sh' + s, kn.lerp(an, 0.3) + V((0, -0.015, 0)), (0.052, 0.058, 0.1))
        elif legs == 'shorts':
            pants.cap('th' + s, th + V((0, 0, -0.04)), th.lerp(kn, 0.62), 0.085)
            skin.cap('th' + s, th.lerp(kn, 0.5), kn, 0.065)
            skin.cap('sh' + s, kn, an + V((0, 0, 0.05)), 0.052)
            skin.ell('sh' + s, kn.lerp(an, 0.3) + V((0, -0.015, 0)), (0.054, 0.06, 0.1))
        else:
            pants.cap('th' + s, th + V((0, 0, -0.04)), kn, 0.082)
            pants.ell('th' + s, th.lerp(kn, 0.35) + V((0, 0, 0)), (0.088, 0.09, 0.14))
            pants.cap('sh' + s, kn, an + V((0, 0, 0.06)), 0.058)
            pants.ell('sh' + s, kn.lerp(an, 0.3) + V((0, -0.015, 0)), (0.058, 0.064, 0.11))
    out = [top, skin, pants]
    if legs == 'skirt':
        sk = Blob(spec['pants_m'], 300)
        sk.ell('hips', (0, 0, 0.86), (0.2, 0.15, 0.15))
        sk.ell('hips', (0, 0, 0.76), (0.215, 0.17, 0.08))
        out.append(sk)
    # shoes / boots
    shoes = Blob(spec['shoe_m'], 260)
    boots = spec.get('boots', False)
    for s in 'LR':
        an = REST['ft' + s]
        shoes.ell('ft' + s, an + V((0, 0.045, -0.015)), (0.058, 0.125, 0.055))
        if boots:
            shoes.cap('sh' + s, an + V((0, 0, 0.0)), an + V((0, 0, 0.17)), 0.062)
    out.append(shoes)
    out += spec.get('_extra', [])
    # hair
    hair = spec.get('hair')
    if hair:
        hb = Blob(spec['hair_m'], 380)
        H = REST['head']
        if hair != 'buzz':
            hb.ell('head', H + V((0, -0.012, 0.165)), (0.104, 0.118, 0.085))
            hb.ell('head', H + V((0, -0.04, 0.13)), (0.105, 0.1, 0.09))
        else:
            hb.ell('head', H + V((0, -0.01, 0.17)), (0.1, 0.113, 0.07))
        if hair == 'long':
            hb.cap('head', H + V((0, -0.07, 0.15)), H + V((0, -0.08, -0.12)), 0.07)
            for sx in (-1, 1):
                hb.cap('head', H + V((sx * 0.085, -0.01, 0.15)), H + V((sx * 0.09, -0.02, 0.0)), 0.035)
        elif hair == 'ponytail':
            hb.ell('head', H + V((0, -0.13, 0.15)), (0.04, 0.05, 0.045))
            hb.cap('head', H + V((0, -0.15, 0.12)), H + V((0, -0.16, -0.06)), 0.035)
        elif hair == 'bun':
            hb.ell('head', H + V((0, -0.08, 0.26)), (0.055, 0.055, 0.05))
        elif hair == 'afro':
            hb.ell('head', H + V((0, -0.02, 0.19)), (0.15, 0.15, 0.13))
        out.append(hb)
    if spec.get('mohawk'):
        mh = Blob(spec['neon_m'], 160)
        H = REST['head']
        for k in range(5):
            t = k / 4
            mh.ell('head', H + V((0, lerp(0.07, -0.11, t), 0.24 - 0.06 * (2 * t - 1) ** 2)), (0.018, 0.04, 0.05))
        out.append(mh)
    if spec.get('hood'):
        hd = Blob(spec['top_m'], 420)
        H = REST['head']
        hd.ell('head', H + V((0, -0.025, 0.155)), (0.135, 0.148, 0.16))
        hd.cap('chest', H + V((0, -0.07, 0.05)), REST['chest'] + V((0, -0.08, 0.2)), 0.09)
        hd.ell('head', H + V((0, 0.13, 0.15)), (0.11, 0.1, 0.13), neg=True)
        out.append(hd)
    return out


# ------------------------------------------------------------------ hard-surface parts
def face(b, spec, P):
    H = REST['head']
    if spec.get('helmet'):
        return
    b.bone = BI['head']
    if spec.get('visor'):
        band = bm_lathe([(0.112, H.z + 0.137), (0.116, H.z + 0.165)], 14, arc=(FRONT - deg(70), FRONT + deg(70)))
        rigid(b, 'head', band, spec['neon_m'], T((0, 0.004, 0)))
    else:
        for sx in (-1, 1):
            rigid(b, 'head', bm_sphere(0.017, 8, 6), P['eye'], T((sx * 0.037, 0.105, H.z + 0.155), (0, 0, 0), (1, 0.5, 0.8)))
            rigid(b, 'head', bm_box(0.04, 0.012, 0.008), spec['hair_m'] or P['eye'],
                  T((sx * 0.037, 0.108, H.z + 0.185), (0, 0, -sx * 0.12)))
        rigid(b, 'head', bm_box(0.045, 0.01, 0.008), P['mouth'], T((0, 0.108, H.z + 0.098)))


def headwear(b, spec, P):
    H = REST['head']
    hw = spec.get('hat')
    if hw == 'cap':
        rigid(b, 'head', bm_sphere(0.122, 14, 8), spec['hat_m'], T((0, -0.008, H.z + 0.175), (0, 0, 0), (0.95, 1.02, 0.72)))
        rigid(b, 'head', bm_box(0.17, 0.12, 0.012, 0.004), spec['hat_m'], T((0, 0.135, H.z + 0.19), (0.18, 0, 0)))
        rigid(b, 'head', bm_box(0.16, 0.012, 0.012), spec['neon_m'], T((0, 0.19, H.z + 0.18), (0.18, 0, 0)))
    elif hw == 'beanie':
        rigid(b, 'head', bm_sphere(0.124, 14, 8), spec['hat_m'], T((0, -0.01, H.z + 0.18), (0, 0, 0), (0.92, 1.0, 0.85)))
        rigid(b, 'head', bm_torus(0.108, 0.018, 16, 5), spec['hat_m'], T((0, -0.008, H.z + 0.13), (0.12, 0, 0), (1, 1.07, 1)))
    elif hw == 'phones':
        for sx in (-1, 1):
            rigid(b, 'head', bm_cyl(0.045, 0.045, 0.04, 12), P['dark'], T((sx * 0.105, -0.005, H.z + 0.15), (0, math.pi / 2, 0)))
            rigid(b, 'head', bm_torus(0.04, 0.008, 14, 4), spec['neon_m'], T((sx * 0.127, -0.005, H.z + 0.15), (0, math.pi / 2, 0)))
        band = bm_torus(0.118, 0.012, 20, 4)
        rigid(b, 'head', band, P['dark'], T((0, -0.005, H.z + 0.15), (0, math.pi / 2, 0), (1, 1, 1)))


def accessories(b, spec, P):
    C = REST['chest']
    acc = spec.get('acc')
    if acc == 'pack':
        rigid(b, 'chest', bm_box(0.28, 0.13, 0.34, 0.04), spec['pack_m'], T((0, -0.19, C.z + 0.05)))
        rigid(b, 'chest', bm_box(0.2, 0.02, 0.02), spec['neon_m'], T((0, -0.258, C.z + 0.14)))
        for sx in (-1, 1):
            rigid(b, 'chest', bm_box(0.04, 0.03, 0.3), P['dark'], T((sx * 0.1, 0.0, C.z + 0.1), (0.25, 0, 0)))
    elif acc == 'bag':
        rigid(b, 'hips', bm_box(0.22, 0.08, 0.17, 0.03), spec['pack_m'], T((0.21, 0.05, 0.98)))
        strap = bm_box(0.04, 0.02, 0.78)
        rigid(b, 'chest', strap, P['dark'], T((0.0, 0.135, 1.22), (0, 0.72, 0)))
        rigid(b, 'chest', bm_box(0.04, 0.02, 0.6), P['dark'], T((0.0, -0.135, 1.22), (0, 0.72, 0)))
    if spec.get('collar_neon'):
        # neon trim down the jacket front and round the hem
        rigid(b, 'chest', bm_box(0.016, 0.014, 0.3), spec['neon_m'], T((-0.045, 0.128, C.z + 0.02), (-0.08, 0, 0)))
        rigid(b, 'chest', bm_box(0.016, 0.014, 0.3), spec['neon_m'], T((0.045, 0.128, C.z + 0.02), (-0.08, 0, 0)))
        rigid(b, 'spine', bm_torus(0.162, 0.008, 24, 3), spec['neon_m'], T((0, 0, 1.0), (0, 0, 0), (1, 0.7, 1)))
    if spec.get('soles_neon'):
        for s in 'LR':
            an = REST['ft' + s]
            rigid(b, 'ft' + s, bm_box(0.11, 0.24, 0.016), spec['neon_m'], T(an + V((0, 0.045, -0.058))))
    if spec.get('cuffs'):
        for s in 'LR':
            wr = REST['hd' + s]
            rigid(b, 'fa' + s, bm_torus(0.05, 0.008, 14, 3), spec['neon_m'], T(wr + V((0, 0, 0.045))))


def umbrella(spec, P, lod):
    """Separate builder (own AO): an umbrella in the left hand, upright in the hand's rest frame."""
    u = Builder()
    u.bone = BI['hdL']
    X = bind_xf('hdL')
    h = REST['hdL']
    u.add(bm_cyl(0.011, 0.011, 1.0, 6), P['dark'], X @ T(h + V((0, 0, 0.42))))
    seg = 16 if lod == 0 else 8
    canopy = [(0.0, 0.0), (0.2, -0.04), (0.42, -0.13), (0.6, -0.27)]
    u.add(bm_from_mods(bm_lathe(canopy, seg), [('SOLIDIFY', {'thickness': 0.012})]), spec['umb_m'], X @ T(h + V((0, 0, 1.12))))
    u.add(bm_torus(0.6, 0.012, seg + 4, 3), spec['neon2_m'], X @ T(h + V((0, 0, 1.12 - 0.27))))
    u.add(bm_sphere(0.025, 6, 4), spec['neon2_m'], X @ T(h + V((0, 0, 1.14))))
    u.add(bm_cyl(0.02, 0.02, 0.1, 6), P['dark'], X @ T(h + V((0, 0, -0.02))))
    return u


def armour(b, spec, P, lod):
    """Soldier and cyber-cop hard-surface kit."""
    cop = spec.get('cop', False)
    A, G, D = spec['armor_m'], spec['neon_m'], P['dark']
    seg = 14 if lod == 0 else 7
    C, S = REST['chest'], REST['spine']
    # chest + back plates, ab plate
    rigid(b, 'chest', shell([(0.18, C.z - 0.06), (0.205, C.z - 0.01), (0.215, C.z + 0.1), (0.2, C.z + 0.2), (0.14, C.z + 0.25)],
                            (FRONT - deg(68), FRONT + deg(68)), seg, 0.022, 0.72), A)
    rigid(b, 'chest', shell([(0.17, C.z - 0.04), (0.2, C.z + 0.04), (0.205, C.z + 0.16), (0.16, C.z + 0.24)],
                            (FRONT + deg(110), FRONT + deg(250)), seg, 0.022, 0.75), A)
    rigid(b, 'spine', shell([(0.16, S.z - 0.03), (0.172, S.z + 0.04), (0.17, S.z + 0.15)],
                            (FRONT - deg(55), FRONT + deg(55)), seg, 0.018, 0.74), A)
    for sx in (-1, 1):
        rigid(b, 'chest', bm_box(0.022, 0.014, 0.17), G, T((sx * 0.085, 0.165, C.z + 0.08), (-0.18, 0, 0)))
    rigid(b, 'chest', bm_box(0.12, 0.014, 0.02), spec['neon2_m'], T((0, 0.158, C.z - 0.02)))
    # shoulder pads
    for s in 'LR':
        sx = -1 if s == 'L' else 1
        sh = REST['ua' + s]
        pad = bm_lathe([(0.0, 0.11), (0.06, 0.098), (0.1, 0.055), (0.118, 0.0), (0.118, -0.04)], seg)
        rigid(b, 'ua' + s, pad, A, T(sh + V((sx * 0.02, 0, -0.01)), (0, sx * 0.35, 0), (1, 0.95, 1)))
        rigid(b, 'ua' + s, bm_box(0.16, 0.014, 0.022), G, T(sh + V((sx * 0.065, 0.1, -0.03)), (0, sx * 0.35, 0)))
        # forearm guard, glove cuff
        el, wr = REST['fa' + s], REST['hd' + s]
        g = shell([(0.06, wr.z + 0.03), (0.068, wr.z + 0.12), (0.066, el.z - 0.04)], (FRONT - deg(80), FRONT + deg(110)), seg, 0.012)
        rigid(b, 'fa' + s, g, A, T((wr.x, 0, 0)))
        rigid(b, 'fa' + s, bm_torus(0.063, 0.009, 14, 3), G, T(wr + V((0, 0, 0.09))))
        # thigh plate, knee pad, shin guard
        th, kn, an = REST['th' + s], REST['sh' + s], REST['ft' + s]
        rigid(b, 'th' + s, shell([(0.088, kn.z + 0.1), (0.096, kn.z + 0.22), (0.09, th.z - 0.1)], (FRONT - deg(70), FRONT + deg(70)), seg, 0.016),
              A, T((th.x, 0, 0)))
        rigid(b, 'sh' + s, bm_sphere(0.068, 10, 7), A, T(kn + V((0, 0.045, 0.0)), (0, 0, 0), (1, 0.75, 1.05)))
        rigid(b, 'sh' + s, shell([(0.064, an.z + 0.12), (0.07, an.z + 0.25), (0.066, kn.z - 0.08)], (FRONT - deg(65), FRONT + deg(65)), seg, 0.014),
              A, T((kn.x, 0, 0)))
        rigid(b, 'sh' + s, bm_box(0.018, 0.012, 0.15), G, T(kn.lerp(an, 0.45) + V((0, 0.075, 0))))
    # belt + pouches
    rigid(b, 'hips', bm_torus(0.165, 0.028, 22 if lod == 0 else 10, 4), D, T((0, 0, 1.0), (0, 0, 0), (1, 0.7, 0.9)))
    rigid(b, 'hips', bm_box(0.08, 0.02, 0.045), G, T((0, 0.122, 1.0)))
    for sx in (-1, 1):
        rigid(b, 'hips', bm_box(0.1, 0.07, 0.11, 0.02), D, T((sx * 0.15, 0.055, 0.96), (0, 0, sx * 0.5)))
    # helmet
    H = REST['head']
    rigid(b, 'head', bm_sphere(0.138, 16 if lod == 0 else 9, 10 if lod == 0 else 6), A, T(H + V((0, 0.0, 0.16)), (0, 0, 0), (1.0, 1.08, 1.06)))
    rigid(b, 'head', bm_lathe([(0.128, H.z + 0.08), (0.14, H.z + 0.12), (0.142, H.z + 0.19), (0.132, H.z + 0.215)], seg,
                              arc=(FRONT - deg(62), FRONT + deg(62))), D, T((0, 0.012, 0)))
    rigid(b, 'head', bm_lathe([(0.143, H.z + 0.138), (0.146, H.z + 0.172)], seg, arc=(FRONT - deg(58), FRONT + deg(58))),
          spec['visor_m'], T((0, 0.016, 0)))
    rigid(b, 'head', bm_box(0.035, 0.26, 0.05, 0.01), A, T(H + V((0, 0.0, 0.3))))
    for sx in (-1, 1):
        rigid(b, 'head', bm_cyl(0.05, 0.05, 0.05, 12), D, T(H + V((sx * 0.135, 0.0, 0.15)), (0, math.pi / 2, 0)))
        if not cop:
            rigid(b, 'head', bm_cyl(0.02, 0.02, 0.012, 8), G, T(H + V((sx * 0.162, 0.0, 0.15)), (0, math.pi / 2, 0)))
    if not cop:
        # power pack with an antenna
        rigid(b, 'chest', bm_box(0.32, 0.16, 0.4, 0.04), spec['pack_m'], T((0, -0.215, C.z + 0.06)))
        for zz in (C.z + 0.14, C.z + 0.06):
            rigid(b, 'chest', bm_box(0.24, 0.012, 0.022), G, T((0, -0.298, zz)))
        rigid(b, 'chest', bm_cyl(0.008, 0.008, 0.32, 5), D, T((0.12, -0.24, C.z + 0.42)))
        rigid(b, 'chest', bm_sphere(0.022, 8, 6), spec['neon2_m'], T((0.12, -0.24, C.z + 0.58)))
    else:
        rigid(b, 'chest', bm_box(0.08, 0.02, 0.09, 0.01), P['gold'], T((-0.1, 0.165, C.z + 0.13), (-0.15, 0, 0)))
        rigid(b, 'chest', bm_box(0.22, 0.12, 0.26, 0.03), spec['pack_m'], T((0, -0.19, C.z + 0.02)))
        for sx, m in ((-1, P['siren_b']), (1, P['siren_r'])):
            rigid(b, 'ua' + ('L' if sx < 0 else 'R'), bm_sphere(0.026, 8, 6), m, T(REST['ua' + ('L' if sx < 0 else 'R')] + V((sx * 0.06, 0.03, 0.1))))


# ------------------------------------------------------------------ specs
def palette():
    return dict(
        eye=mat('p_eye', '#0c0d12', 0.2, 0.3), mouth=mat('p_mouth', '#5a2a2a', 0.0, 0.7),
        dark=mat('p_dark', '#16171d', 0.3, 0.6), gold=mat('p_gold', emit='#ffd23a', strength=1.5),
        siren_r=mat('p_siren_r', emit='#ff1030'), siren_b=mat('p_siren_b', emit='#2060ff'),
    )


SKIN = ['#f1c7a5', '#e0ac85', '#c48a62', '#a06a45', '#7a4c30', '#5a3624']
HAIR = ['#15110f', '#2e1d12', '#5b3a22', '#b98a48', '#d9d9df', '#e23a9c', '#2ab8ff', '#7a3bff']
TOP = ['#2a2f45', '#5a1d3a', '#1d4a5a', '#3b3b42', '#4a2a8a', '#9a2b30', '#16695a', '#b8862a', '#d9d9e2', '#1f1f24']
PANTS = ['#1b1d26', '#25252e', '#343a52', '#3e3226', '#121214', '#3a2a3e', '#2a3a5a']
NEON = ['#ff2bd6', '#29f3ff', '#ffa43a', '#3aff9a', '#8a4dff', '#ff3a4a']
SHOES = ['#121214', '#2a1c14', '#e8e8ee', '#3a3a44', '#7a1d2a']


def ped_spec(i):
    r = random.Random(1000 + i * 7919)
    n = i % 6
    f = r.random() < 0.5
    sk = r.choice(SKIN)
    spec = dict(female=f)
    spec['skin_m'] = mat(f'ped{i}_skin', sk, 0.0, 0.6)
    spec['hand_m'] = spec['skin_m']
    neon = r.choice(NEON)
    spec['neon_m'] = mat(f'ped{i}_neon', emit=neon)
    spec['neon2_m'] = mat(f'ped{i}_neon2', emit=r.choice(NEON))
    style = ['jacket', 'hoodie', 'tee', 'coat', 'jacket', 'vest'][n]
    spec['top_m'] = mat(f'ped{i}_top', r.choice(TOP), 0.1 if style != 'jacket' else 0.35, 0.75 if style != 'jacket' else 0.4)
    spec['pants_m'] = mat(f'ped{i}_pants', r.choice(PANTS), 0.05, 0.8)
    spec['shoe_m'] = mat(f'ped{i}_shoe', r.choice(SHOES), 0.2, 0.5)
    spec['hair_m'] = mat(f'ped{i}_hair', r.choice(HAIR), 0.1, 0.6)
    spec['hat_m'] = mat(f'ped{i}_hat', r.choice(['#c0393b', '#222228', '#1d4a5a', '#e8e8ee', '#4a2a8a']), 0.1, 0.6)
    spec['pack_m'] = mat(f'ped{i}_pack', r.choice(['#222228', '#3a3f55', '#5a1d3a', '#2a4a3a']), 0.2, 0.6)
    spec['umb_m'] = mat(f'ped{i}_umb', r.choice(['#14141c', '#20202c', '#2a1030']), 0.3, 0.4)
    spec['sleeves'] = {'tee': 'short', 'vest': 'none'}.get(style, 'long')
    spec['long_top'] = style == 'coat'
    spec['collar_neon'] = style in ('jacket', 'coat')
    spec['legs'] = 'skirt' if (f and r.random() < 0.35) else ('shorts' if r.random() < 0.18 else 'long')
    spec['boots'] = r.random() < 0.4
    spec['soles_neon'] = r.random() < 0.4
    spec['cuffs'] = style == 'hoodie' or r.random() < 0.25
    spec['hood'] = style == 'hoodie' and r.random() < 0.6
    hair = r.choice(['short', 'long', 'ponytail', 'bun', 'buzz', 'afro']) if not f else r.choice(['long', 'ponytail', 'bun', 'short', 'afro'])
    spec['hair'] = None if spec['hood'] else hair
    spec['mohawk'] = (not spec['hood']) and hair == 'buzz' and r.random() < 0.6
    if spec['mohawk']:
        spec['hair'] = None
    hat = r.choice([None, None, 'cap', 'beanie', 'phones'])
    if spec['hood'] or spec['mohawk'] or hair in ('afro', 'bun'):
        hat = None if hat != 'phones' or spec['hood'] else 'phones'
    spec['hat'] = hat
    spec['visor'] = r.random() < 0.3
    acc = r.choice([None, 'pack', 'bag', 'umbrella', 'umbrella'])
    spec['acc'] = acc if acc != 'umbrella' else None
    spec['umbrella'] = acc == 'umbrella'
    spec['scale'] = (0.95 + r.random() * 0.05) if f else (0.98 + r.random() * 0.07)
    return spec


def soldier_spec(cop):
    p = 'cop' if cop else 'soldier'
    return dict(
        cop=cop, helmet=True, bulky=True, gloves=True, boots=True, sleeves='long', legs='long',
        top_m=mat(f'{p}_under', '#16203f' if cop else '#2b3244', 0.3, 0.6),
        pants_m=mat(f'{p}_pants', '#16203f' if cop else '#2b3244', 0.3, 0.6),
        skin_m=mat(f'{p}_skin', '#c48a62', 0.0, 0.6),
        hand_m=mat(f'{p}_glove', '#1a1d26', 0.3, 0.5),
        shoe_m=mat(f'{p}_boot', '#15171d', 0.3, 0.5),
        armor_m=mat(f'{p}_armor', '#2a4ab0' if cop else '#7f8ca8', 0.55, 0.35),
        pack_m=mat(f'{p}_pack', '#1c2a55' if cop else '#323a4c', 0.4, 0.5),
        neon_m=mat(f'{p}_neon', emit='#ff2a3c' if cop else '#29f3ff'),
        neon2_m=mat(f'{p}_neon2', emit='#4aa0ff' if cop else '#ff2bd6'),
        visor_m=mat(f'{p}_visor', emit='#ff2a3c' if cop else '#29f3ff'),
        hair=None, scale=1.02 if cop else 1.0,
    )


# ------------------------------------------------------------------ assembly
def make_rig():
    arm = bpy.data.armatures.new('rig')
    ob = bpy.data.objects.new('rig', arm)
    bpy.context.scene.collection.objects.link(ob)
    for o in bpy.context.scene.objects:
        o.select_set(False)
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    eb = {}
    for n, p, _ in BONES:
        e = arm.edit_bones.new(n)
        e.head = BIND[n]
        e.tail = tail_of(n)
        if p >= 0:
            e.parent = eb[BONES[p][0]]
        eb[n] = e
    bpy.ops.object.mode_set(mode='OBJECT')
    return ob


def person(name, spec, rig, lod):
    P = palette()
    spec = dict(spec)
    b = Builder()
    blobs = body(spec, lod)
    for bl in blobs:
        bm = bl.mesh(lod)
        b.bone = -1
        b.add(bm, bl.m)
    for bl in blobs:
        bpy.data.objects.remove(bl.ob, do_unlink=True)
        bpy.data.metaballs.remove(bl.mb)
    if spec.get('helmet'):
        armour(b, spec, P, lod)
    face(b, spec, P)
    headwear(b, spec, P)
    accessories(b, spec, P)
    # skin weights: rigid parts follow their bone, smooth pieces blend by distance to the bones
    bm = b.bm
    dl = bm.verts.layers.deform.verify()
    for v in bm.verts:
        bi = v[b.lay_bone]
        if bi >= 0:
            v[dl][bi] = 1.0
        else:
            for w, bn in smooth_weights(v.co):
                v[dl][BI[bn]] = w
    bake_ao(bm, dist=0.14, rays=32 if lod == 0 else 16, floor=0.42)
    if spec.get('umbrella'):
        u = umbrella(spec, P, lod)
        bake_ao(u.bm, dist=0.2, rays=16, floor=0.5)
        set_sharp(u.bm, 55)
        udl = u.bm.verts.layers.deform.verify()
        ucol = u.bm.verts.layers.float_color.get('Col')
        col = bm.verts.layers.float_color.get('Col')
        vmap = {}
        for v in u.bm.verts:
            nv = bm.verts.new(v.co)
            nv[dl][BI['hdL']] = 1.0
            nv[col] = v[ucol]
            vmap[v] = nv
        for f in u.bm.faces:
            try:
                nf = bm.faces.new([vmap[v] for v in f.verts])
            except ValueError:
                continue
            nf.material_index = b.mi(u.mats[f.material_index])
            nf.smooth = True
        _ = udl
        u.bm.free()
    set_sharp(bm, 55)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in b.mats:
        me.materials.append(m)
    me.color_attributes.active_color = me.color_attributes['Col']
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    for n, _, _ in BONES:
        ob.vertex_groups.new(name=n)
    ob.parent = rig
    md = ob.modifiers.new('rig', 'ARMATURE')
    md.object = rig
    ob['scale'] = spec.get('scale', 1.0)
    ob['umbrella'] = 1 if spec.get('umbrella') else 0
    return ob


N_PEDS = 12


def build_all(lods=(0, 1)):
    rig = make_rig()
    objs = [rig]
    specs = [('soldier', soldier_spec(False)), ('cop', soldier_spec(True))] + [(f'ped{i}', ped_spec(i)) for i in range(N_PEDS)]
    for name, spec in specs:
        for lod in lods:
            ob = person('p_' + name + ('_lod1' if lod else ''), spec, rig, lod)
            print(f'  {ob.name}: {tri_count(ob)} triangles')
            objs.append(ob)
    return objs


def previews(objs, out):
    import os
    from lib import render
    people = [o for o in objs if o.type == 'MESH' and not o.name.endswith('_lod1')]
    # line them up for one group shot (A-pose)
    for i, o in enumerate(people):
        o.location = ((i - len(people) / 2) * 1.25, 0, 0)
    render(people, os.path.join(out, 'people_all.png'), cam=(0, 13.5, 1.6), target=(0, 0, 1.0), lens=38, res=(1400, 520))
    for o in people[:4]:
        x = o.location.x
        render([o], os.path.join(out, f'person_{o.name}.png'), cam=(x + 1.3, 2.6, 1.55), target=(x, 0, 1.05), lens=50, res=(420, 520))
    for o in people:
        o.location = (0, 0, 0)
