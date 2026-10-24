# The Formula 1 car: one open-wheel model the game paints in every team's colours.
#
#   blender -b --factory-startup --python models/blender/f1.py -- --car f1
#
# A 2024-style car: 5.6 m long, 2.0 m wide, a 3.6 m wheelbase on 18-inch wheels with covers. A narrow nose and
# tub, the driver's helmet in the cockpit under the titanium halo, the airbox over his head and the shark fin
# behind it, sculpted sidepods, a flat floor and diffuser, a three-element front wing and the rear wing with its
# DRS flap and beam wing, push-rod suspension and the red rain light. 'Paint' is the team's main colour and
# 'Livery' its second colour (the game sets both per car).
import sys, os, math
import bmesh
from mathutils import Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from carkit import Car, V, lerp, srgb, main

# monocoque + engine cover: (x, half width, bottom, top); rounded-box sections
TUB = [(2.86, .05, .17, .24), (2.62, .09, .16, .31), (2.25, .13, .15, .41), (1.95, .16, .13, .49), (1.45, .23, .10, .59),
       (1.00, .30, .07, .63), (0.55, .35, .06, .62), (0.10, .37, .06, .70), (-0.15, .35, .07, .99), (-0.45, .32, .07, .92),
       (-0.90, .26, .09, .76), (-1.35, .18, .12, .62), (-1.75, .11, .16, .50), (-2.05, .07, .22, .42)]
WT = dict(F=dict(x=1.95, r=0.36, w=0.305, y=0.80, rim=0.23), R=dict(x=-1.65, r=0.36, w=0.405, y=0.78, rim=0.23))

def section(x, hw, zb, zt, n=24, p=2.6, yc=0.0):
    zc, hz = (zb + zt) / 2, (zt - zb) / 2
    out = []
    for i in range(n):
        a = 2 * math.pi * i / n; c, s = math.cos(a), math.sin(a)
        out.append(V(x, yc + hw * math.copysign(abs(c) ** (2 / p), c), zc + hz * math.copysign(abs(s) ** (2 / p), s)))
    return out

def sloft(k, name, rows, mat, levels=2, body=False):
    """a smooth shell through rounded-box sections"""
    bm = bmesh.new(); rings = [[bm.verts.new(p) for p in section(*r)] for r in rows]; n = len(rings[0])
    for a, b in zip(rings, rings[1:]):
        for j in range(n): bm.faces.new((a[j], a[(j + 1) % n], b[(j + 1) % n], b[j]))
    bm.faces.new(rings[0]); bm.faces.new(list(reversed(rings[-1])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = k.mesh(name, bm, mat, part=not body)
    if body:
        for m in ['Livery', 'Black', 'Carbon', 'Titanium', 'Taillight']: o.data.materials.append(k.M[m])
    sub = o.modifiers.new('sub', 'SUBSURF'); sub.levels = levels; k.apply(o)
    return o

def tube(k, name, mat, pts, r=0.02, segs=10, steps=6):
    """a round tube swept along a Catmull-Rom path (the halo, suspension arms)"""
    P = [Vector(p) for p in pts]; path = []
    for i in range(len(P) - 1):
        p0, p1, p2, p3 = P[max(i - 1, 0)], P[i], P[i + 1], P[min(i + 2, len(P) - 1)]
        for s in range(steps):
            t = s / steps
            path.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    path.append(P[-1])
    bm = bmesh.new(); rings = []
    for i, p in enumerate(path):
        tg = (path[min(i + 1, len(path) - 1)] - path[max(i - 1, 0)]).normalized()
        a = tg.cross(V(0, 0, 1)); a = a.normalized() if a.length > 1e-4 else V(0, 1, 0); b = tg.cross(a).normalized()
        rings.append([bm.verts.new(p + (a * math.cos(2 * math.pi * j / segs) + b * math.sin(2 * math.pi * j / segs)) * r) for j in range(segs)])
    for a_, b_ in zip(rings, rings[1:]):
        for j in range(segs): bm.faces.new((a_[j], a_[(j + 1) % segs], b_[(j + 1) % segs], b_[j]))
    bm.faces.new(rings[0]); bm.faces.new(list(reversed(rings[-1])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return k.mesh(name, bm, mat, part=True)

def slab(k, name, mat, outline, z0, z1):
    """a flat plate from a plan outline [(x, y)...] between heights z0 and z1 (the floor)"""
    bm = bmesh.new(); lo = [bm.verts.new((x, y, z0)) for x, y in outline]; hi = [bm.verts.new((x, y, z1)) for x, y in outline]; n = len(lo)
    for i in range(n): bm.faces.new((lo[i], lo[(i + 1) % n], hi[(i + 1) % n], hi[i]))
    bm.faces.new(list(reversed(lo))); bm.faces.new(hi)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return k.mesh(name, bm, mat, smooth=False, part=True)

def f1(k):
    k.M['Livery'] = k.material('Livery', srgb('#ffffff'), rough=0.3, coat=1.0)
    k.M['Helmet'] = k.material('Helmet', srgb('#ffd21f'), rough=0.2, coat=1.0)
    k.M['Pirelli'] = k.material('Pirelli', srgb('#ffd21f'), rough=0.6)
    k.body = sloft(k, 'Body', TUB, 'Paint', body=True)
    # livery on the tub: a stripe down the nose and the engine cover, the cockpit opening, the black nose tip
    k.surface()
    k.decal('nosestripe', 'Livery', 'top', 1.05, 2.80, -.055, .055, 24, 2, off=.004)
    k.decal('coverstripe', 'Livery', 'top', -1.95, -0.30, -.05, .05, 20, 2, off=.004)
    k.decal('cockpit', 'Black', 'top', 0.22, 0.98, -.23, .23, 14, 8, off=.006)
    k.decal('nosetip', 'Carbon', 'front', -.06, .06, .16, .25, 4, 4, off=.004)
    k.decal('airbox', 'Black', 'front', -.11, .11, .84, .97, 6, 6, off=.006)
    for s in (1, -1): k.decal('tubside', 'Livery', 'left' if s > 0 else 'right', 0.95, 1.85, .30, .40, 16, 2, off=.004)
    k.bvh = None   # (no road-car details: no number plates, no badges)
    # sculpted sidepods with black inlets, and a livery flash along them
    k.pod('sidepod', 'Paint', [(0.96, .52, .34, .09, .15), (0.82, .55, .33, .21, .19), (0.40, .55, .32, .24, .21), (-0.10, .50, .30, .22, .19),
                                (-0.60, .42, .27, .17, .15), (-1.05, .32, .24, .11, .11), (-1.38, .24, .22, .05, .05)], segs=20, sub=2, flat=.5)
    k.pod('inlet', 'Black', [(0.985, .52, .36, .07, .10), (0.93, .53, .36, .085, .12)], segs=16, sub=1)
    k.pod('podflash', 'Livery', [(0.70, .555, .43, .19, .03), (0.10, .52, .41, .20, .03), (-0.70, .42, .36, .14, .025)], segs=12, sub=1)
    # the floor (wider between the wheels) with its edge, and the diffuser rising at the back
    slab(k, 'floor', 'Carbon', [(1.35, .32), (1.15, .60), (-1.25, .62), (-1.50, .48), (-1.95, .48), (-1.95, -.48), (-1.50, -.48), (-1.25, -.62), (1.15, -.60), (1.35, -.32)], .035, .06)
    k.panel('diffuser', 'Carbon', lambda u, v: V(lerp(-1.50, -2.02, u), lerp(-.48, .48, v), lerp(.06, .30, u ** 1.4)), 8, 6, thick=.012)
    for y in (-.47, -.16, .16, .47): k.box('strake', 'Carbon', (-1.78, y, .14), (.48, .012, .16), rot=(0, math.radians(18), 0))
    # the front wing: three elements between big end plates, held by two pylons under the nose
    k.wing(2.92, .085, .30, 1.96, aoa=-2, thick=.10, name='fwing')
    k.wing(2.66, .15, .20, 1.90, aoa=-16, thick=.10, mat='Livery', name='fflap')
    k.wing(2.50, .21, .15, 1.86, aoa=-30, thick=.10, name='fflap2')
    k.plate('fendplate', 'Carbon', [(2.94, .05), (2.36, .05), (2.34, .30), (2.58, .33), (2.94, .17)], .985, t=.016)
    for s in (1, -1): k.box('pylon', 'Carbon', (2.60, s * .07, .16), (.16, .02, .12))
    # the rear wing: main plane + DRS flap between tall end plates on a swan-neck pylon, and the beam wing below
    k.wing(-2.12, .80, .30, 1.00, aoa=-8, thick=.12, name='rwing')
    k.wing(-2.36, .88, .20, 1.00, aoa=-26, thick=.10, mat='Livery', name='drs')
    k.wing(-2.04, .44, .22, .84, aoa=-10, thick=.12, name='beamwing')
    k.plate('rendplate', 'Paint', [(-2.02, .38), (-2.64, .40), (-2.66, 1.02), (-2.10, 1.02), (-2.00, .72)], .50, t=.018)
    k.blade('pylon', 'Carbon', [(-1.90, 0, .44), (-2.10, 0, .62), (-2.28, 0, .86)], .03, w0=.07, w1=.05, t=.02)
    k.box('rainlight', 'Taillight', (-2.08, 0, .34), (.05, .12, .06), bevel=.01)
    for s in (1, -1): k.box('eplight', 'Taillight', (-2.64, s * .515, .74), (.02, .012, .14))
    # the shark fin on the engine cover and the T-camera on the airbox
    k.plate('sharkfin', 'Paint', [(-0.38, .96), (-1.92, .52), (-1.98, .62), (-0.60, 1.02)], 0.0, t=.012)
    k.box('tcam', 'Livery', (-0.10, 0, 1.0), (.16, .04, .05), bevel=.01)
    # the halo: a titanium hoop round the cockpit on a centre pillar
    for s in (1, -1):
        tube(k, 'halo', 'Titanium', [(1.06, 0, .62), (0.94, 0, .79), (0.80, 0, .855), (0.62, s * .20, .86), (0.36, s * .29, .845), (0.12, s * .30, .80), (0.00, s * .30, .72), (-0.04, s * .31, .66)], r=.034)
    # the driver: a helmet with a dark visor sitting low in the cockpit, the steering wheel in front of him
    k.pod('helmet', 'Helmet', [(0.46, 0, .70, .02, .02), (0.42, 0, .71, .11, .11), (0.30, 0, .72, .14, .14), (0.18, 0, .71, .12, .12), (0.12, 0, .70, .02, .02)], segs=20, sub=1, mirror=False)
    k.pod('visor', 'Glass', [(0.445, 0, .735, .02, .02), (0.42, 0, .735, .09, .035), (0.36, 0, .74, .115, .04), (0.33, 0, .74, .02, .02)], segs=16, sub=1, mirror=False)
    k.box('wheel', 'Carbon', (0.62, 0, .64), (.04, .26, .12), bevel=.01)
    # mirrors on stalks from the sidepods
    for s in (1, -1):
        k.box('mirror', 'Paint', (0.64, s * .56, .70), (.07, .15, .07), bevel=.015)
        k.box('mirrorglass', 'Chrome', (0.605, s * .56, .70), (.005, .13, .055))
        tube(k, 'stalk', 'Carbon', [(0.66, s * .42, .52), (0.65, s * .50, .62), (0.64, s * .53, .67)], r=.012)
    # push-rod suspension: upper and lower wishbones and the push rod to every wheel
    for key, wd in WT.items():
        x, y = wd['x'], wd['y'] - wd['w'] / 2 - .02
        for s in (1, -1):
            for a, b, z0, z1 in ((.22, -.22, .47, .50), (.24, -.26, .20, .22)):
                for dx in (a, b): tube(k, 'arm', 'Carbon', [(x + dx, s * .17, z0), (x, s * y, z1)], r=.016, steps=1)
            tube(k, 'pushrod', 'Carbon', [(x, s * (y - .02), .24), (x - .12, s * .21, .52)], r=.018, steps=1)
            tube(k, 'track', 'Carbon', [(x - .10, s * .16, .34), (x - .06, s * y, .36)], r=.014, steps=1)
    k.join()
    # 18-inch wheels with flat covers and the Pirelli stripe on the sidewalls
    k.wheel_spec = WT
    k.wheels(spokes=0, nut='centrelock')
    import bpy
    for o in list(bpy.data.objects):
        if not o.name.startswith('Wheel_'): continue
        wd = WT[o.name[6]]; s = 1 if o.name.endswith('L') else -1; h = wd['w'] / 2
        extra = []
        bm = bmesh.new(); bmesh.ops.create_cone(bm, segments=40, radius1=wd['rim'] - .01, radius2=wd['rim'] - .01, depth=.012, cap_ends=True)
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=__import__('mathutils').Matrix.Rotation(math.pi / 2, 3, 'X'))
        bmesh.ops.translate(bm, verts=bm.verts, vec=o.location + V(0, s * (h - .025), 0)); extra.append(k.mesh('cover', bm, 'Carbon'))
        r0, r1 = wd['rim'] + .045, wd['rim'] + .062
        bm = bmesh.new(); ring = []
        for j in range(48):
            a = 2 * math.pi * j / 48; ring.append([bm.verts.new(o.location + V(math.cos(a) * r, s * (h + .002), math.sin(a) * r)) for r in (r0, r1)])
        for j in range(48):
            a_, b_ = ring[j], ring[(j + 1) % 48]; bm.faces.new((a_[0], b_[0], b_[1], a_[1]))
        bm.normal_update()
        if s < 0: bmesh.ops.reverse_faces(bm, faces=bm.faces)
        extra.append(k.mesh('pirelli', bm, 'Pirelli', smooth=False))
        k.activate(o)
        for e in extra: e.select_set(True)
        bpy.ops.object.join()

CARS = {'f1': (f1, '#d40000', '#1b1b1d', '#1b1b1d')}
if __name__ == '__main__': main(CARS, 'f1.py')
