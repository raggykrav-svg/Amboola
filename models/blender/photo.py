"""HD photo studio: beautiful 1920x1080 Cycles pictures of any Amboola car.

    blender -b --factory-startup --python models/blender/<script>.py -- --car gt3rs,918 --photo DIR \
        [--looks studio,sunset,neon] [--views front34,rear34,side,low] [--samples 128] [--size 1920x1080]

carkit.main() calls shoot() once the car script has built the car (a --photo run never exports the model). Every game
material gets a proper Cycles shader: metallic paint with tiny flakes under a mirror clear coat, see-through window
glass, carbon weave, rubber, polished rims and lit lamps. The front wheels are turned towards the camera, the plates
get their Japanese number (the same one the game paints), and the car is photographed on one of three sets:

    studio  a dark photo studio: a big soft light overhead, long strip lights that draw lines down the flanks, coloured
            rim lights and a glowing backdrop behind the car, on a glossy floor
    sunset  golden hour on an empty desert road: a low sun, a hazy sky, mountains far away, a damp road with puddles
    neon    a wet street at night with pink and blue neon tubes reflecting in the paint and the puddles

The camera is framed from the car's real shape (it fits the outline, not the bounding box) with a little depth of
field, and the picture gets a soft glow on the lights, a hint of lens fringing and a vignette.
"""
import bpy, bmesh, math, os
import numpy as np
from mathutils import Vector, Matrix

# az: the camera's angle round the car from straight ahead (+ = the car's right side), h: camera height (m), lens (mm)
VIEWS = {'front34': dict(az=38, h=1.0, lens=70), 'rear34': dict(az=145, h=1.15, lens=70), 'side': dict(az=90, h=0.85, lens=85),
         'low': dict(az=28, h=0.42, lens=40), 'front': dict(az=0, h=0.9, lens=85), 'top': dict(az=60, h=5.5, lens=70)}
LOOKS = ('studio', 'sunset', 'neon')


# ------------------------------------------------------------------ shader helpers
def _tree(m):
    m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    o = nt.nodes.new('ShaderNodeOutputMaterial'); return nt, o
def _bsdf(nt, **kw):
    b = nt.nodes.new('ShaderNodeBsdfPrincipled')
    for k, v in kw.items(): b.inputs[k].default_value = v
    return b
def _old(m, name, d):
    """an input's value on the car script's own Principled BSDF (read before the material is rebuilt)"""
    try: return tuple(m.node_tree.nodes['Principled BSDF'].inputs[name].default_value)
    except (KeyError, TypeError, AttributeError):
        try: return m.node_tree.nodes['Principled BSDF'].inputs[name].default_value
        except (KeyError, AttributeError): return d
def _coords(nt, scale):
    tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (scale,) * 3
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector']); return mp.outputs['Vector']
def _flakes(nt, b, scale=1800, amt=0.18):
    """metallic flakes: each tiny Voronoi cell tilts the base coat's normal a little (the clear coat stays smooth)"""
    vo = nt.nodes.new('ShaderNodeTexVoronoi'); nt.links.new(_coords(nt, scale), vo.inputs['Vector'])
    sub = nt.nodes.new('ShaderNodeVectorMath'); sub.operation = 'SUBTRACT'; sub.inputs[1].default_value = (.5, .5, .5)
    nt.links.new(vo.outputs['Color'], sub.inputs[0])
    sc = nt.nodes.new('ShaderNodeVectorMath'); sc.operation = 'SCALE'; sc.inputs['Scale'].default_value = amt; nt.links.new(sub.outputs[0], sc.inputs[0])
    geo = nt.nodes.new('ShaderNodeNewGeometry'); add = nt.nodes.new('ShaderNodeVectorMath'); add.operation = 'ADD'
    nt.links.new(geo.outputs['Normal'], add.inputs[0]); nt.links.new(sc.outputs[0], add.inputs[1])
    nrm = nt.nodes.new('ShaderNodeVectorMath'); nrm.operation = 'NORMALIZE'; nt.links.new(add.outputs[0], nrm.inputs[0])
    nt.links.new(nrm.outputs[0], b.inputs['Normal'])
def _noise(nt, scale, detail=6, rough=0.6, coords=None):
    n = nt.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = scale; n.inputs['Detail'].default_value = detail
    n.inputs['Roughness'].default_value = rough
    if coords is not None: nt.links.new(coords, n.inputs['Vector'])
    return n
def _ramp(nt, src, stops):
    r = nt.nodes.new('ShaderNodeValToRGB'); E = r.color_ramp.elements
    E[0].position, E[0].color = stops[0][0], (*stops[0][1], 1); E[1].position, E[1].color = stops[-1][0], (*stops[-1][1], 1)
    for p, c in stops[1:-1]: e = E.new(p); e.color = (*c, 1)
    nt.links.new(src, r.inputs['Fac']); return r
def _bump(nt, b, height, strength, dist=0.002):
    bu = nt.nodes.new('ShaderNodeBump'); bu.inputs['Strength'].default_value = strength; bu.inputs['Distance'].default_value = dist
    nt.links.new(height, bu.inputs['Height']); nt.links.new(bu.outputs['Normal'], b.inputs['Normal'])

def upgrade_materials(lamps=6.0):
    """swap every game material for a photographic one (looked up by the names the game also relies on)"""
    for m in list(bpy.data.materials):
        name = m.name.split('.')[0]
        if not m.use_nodes or 'Principled BSDF' not in m.node_tree.nodes: continue
        col = _old(m, 'Base Color', (0.5, 0.5, 0.5, 1))[:3]; metal = _old(m, 'Metallic', 0.0)
        if name in ('Paint', 'Livery', 'Stripe', 'AmbAccent'):
            nt, o = _tree(m)
            b = _bsdf(nt, **{'Base Color': (*col, 1), 'Metallic': max(metal, 0.5), 'Roughness': 0.34, 'Coat Weight': 1.0,
                             'Coat Roughness': 0.012, 'Coat IOR': 1.52, 'Specular IOR Level': 0.5})
            _flakes(nt, b); nt.links.new(b.outputs[0], o.inputs['Surface'])
        elif name == 'GlassClear':
            # thin car glass: mostly see-through (a cool grey tint), turning into a mirror at grazing angles
            nt, o = _tree(m)
            tr = nt.nodes.new('ShaderNodeBsdfTransparent'); tr.inputs['Color'].default_value = (0.5, 0.56, 0.6, 1)
            gl = nt.nodes.new('ShaderNodeBsdfGlossy'); gl.inputs['Roughness'].default_value = 0.0
            lw = nt.nodes.new('ShaderNodeLayerWeight'); lw.inputs['Blend'].default_value = 0.12
            mr = nt.nodes.new('ShaderNodeMapRange'); mr.inputs['To Min'].default_value = 0.07; mr.inputs['To Max'].default_value = 1.0
            nt.links.new(lw.outputs['Fresnel'], mr.inputs['Value'])
            mx = nt.nodes.new('ShaderNodeMixShader'); nt.links.new(mr.outputs[0], mx.inputs['Fac'])
            nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(gl.outputs[0], mx.inputs[2]); nt.links.new(mx.outputs[0], o.inputs['Surface'])
        elif name in ('Glass', 'GaugeGlass'):
            nt, o = _tree(m); b = _bsdf(nt, **{'Base Color': (0.004, 0.005, 0.006, 1), 'Roughness': 0.02, 'Coat Weight': 1.0, 'Coat Roughness': 0.0})
            nt.links.new(b.outputs[0], o.inputs['Surface'])
        elif name == 'Headlight':
            nt, o = _tree(m); b = _bsdf(nt, **{'Base Color': (0.9, 0.92, 0.95, 1), 'Roughness': 0.05, 'Coat Weight': 1.0,
                                               'Emission Color': (1, 0.96, 0.9, 1), 'Emission Strength': lamps})
            nt.links.new(b.outputs[0], o.inputs['Surface'])
        elif name == 'Taillight':
            nt, o = _tree(m); b = _bsdf(nt, **{'Base Color': (0.3, 0.0, 0.0, 1), 'Roughness': 0.1, 'Coat Weight': 1.0,
                                               'Emission Color': (1, 0.02, 0.01, 1), 'Emission Strength': lamps * 1.4})
            nt.links.new(b.outputs[0], o.inputs['Surface'])
        elif name in ('Tire', 'Pirelli'):
            nt, o = _tree(m); b = _bsdf(nt, **{'Base Color': (0.016, 0.016, 0.017, 1), 'Roughness': 0.62, 'Specular IOR Level': 0.35})
            _bump(nt, b, _noise(nt, 900, 2, 0.5, _coords(nt, 1)).outputs['Fac'], 0.15, 0.0005); nt.links.new(b.outputs[0], o.inputs['Surface'])
        elif name == 'TireLetter':
            nt, o = _tree(m); b = _bsdf(nt, **{'Base Color': (0.5, 0.5, 0.52, 1), 'Roughness': 0.55})
            nt.links.new(b.outputs[0], o.inputs['Surface'])
        elif name in ('Rim', 'RimBlack'):
            nt, o = _tree(m); bright = max(col) > 0.25
            b = _bsdf(nt, **{'Base Color': (*col, 1), 'Metallic': 1.0 if bright else 0.6, 'Roughness': 0.16 if bright else 0.22, 'Coat Weight': 0.0 if bright else 1.0,
                             'Coat Roughness': 0.03, 'Anisotropic': 0.3 if bright else 0.0})
            nt.links.new(b.outputs[0], o.inputs['Surface'])
        elif name in ('RimLip', 'Chrome', 'Alu', 'Logo'):
            nt, o = _tree(m); b = _bsdf(nt, **{'Base Color': (0.93, 0.93, 0.95, 1), 'Metallic': 1.0, 'Roughness': 0.04 if name != 'Alu' else 0.22})
            nt.links.new(b.outputs[0], o.inputs['Surface'])
        elif name in ('Disc', 'Titanium'):
            nt, o = _tree(m)
            b = _bsdf(nt, **{'Base Color': (0.42, 0.42, 0.43, 1) if name == 'Disc' else (0.55, 0.49, 0.43, 1), 'Metallic': 1.0, 'Roughness': 0.28, 'Anisotropic': 0.7})
            nt.links.new(b.outputs[0], o.inputs['Surface'])
        elif name == 'Caliper':
            nt, o = _tree(m); b = _bsdf(nt, **{'Base Color': (*col, 1), 'Roughness': 0.3, 'Coat Weight': 1.0, 'Coat Roughness': 0.05})
            nt.links.new(b.outputs[0], o.inputs['Surface'])
        elif name == 'Carbon':
            # a 2x2 twill: a checker in the object's own space, the two thread directions catching the light differently
            nt, o = _tree(m); ck = nt.nodes.new('ShaderNodeTexChecker'); ck.inputs['Scale'].default_value = 1.0
            nt.links.new(_coords(nt, 90), ck.inputs['Vector'])
            ck.inputs['Color1'].default_value = (0.010, 0.010, 0.012, 1); ck.inputs['Color2'].default_value = (0.04, 0.042, 0.047, 1)
            b = _bsdf(nt, **{'Roughness': 0.32, 'Anisotropic': 0.8, 'Coat Weight': 1.0, 'Coat Roughness': 0.01})
            nt.links.new(ck.outputs['Color'], b.inputs['Base Color']); nt.links.new(ck.outputs['Fac'], b.inputs['Anisotropic Rotation'])
            nt.links.new(b.outputs[0], o.inputs['Surface'])
        elif name in ('GlossBlack', 'PianoBlack'):
            nt, o = _tree(m); b = _bsdf(nt, **{'Base Color': (0.004, 0.004, 0.005, 1), 'Roughness': 0.08, 'Coat Weight': 1.0, 'Coat Roughness': 0.0})
            nt.links.new(b.outputs[0], o.inputs['Surface'])
        elif name == 'Plate':
            nt, o = _tree(m); b = _bsdf(nt, **{'Base Color': (0.86, 0.87, 0.84, 1), 'Roughness': 0.35, 'Coat Weight': 0.5})
            nt.links.new(b.outputs[0], o.inputs['Surface'])
        elif name in ('Screen',):
            b = m.node_tree.nodes['Principled BSDF']; b.inputs['Emission Strength'].default_value = 3.0
        elif name in ('Leather', 'Nappa', 'Alcantara'):
            b = m.node_tree.nodes['Principled BSDF']; b.inputs['Sheen Weight'].default_value = 0.4


# ------------------------------------------------------------------ the car
def car_objects():
    return [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.name.split('.')[0].startswith(('Body', 'Wheel_', 'Caliper_'))]

def steer(angle):
    """turn the front wheels (and their calipers) about their hubs; + = towards the car's left"""
    for o in bpy.context.scene.objects:
        if o.name.split('.')[0] in ('Wheel_FL', 'Wheel_FR', 'Caliper_FL', 'Caliper_FR'):
            c = o.matrix_world.translation.copy()
            o.matrix_world = Matrix.Translation(c) @ Matrix.Rotation(angle, 4, 'Z') @ Matrix.Translation(-c) @ o.matrix_world

def car_points(n=60000):
    """a sample of the car's vertices in world space (for framing)"""
    pts = []
    for o in car_objects():
        me = o.data; k = len(me.vertices)
        if not k: continue
        co = np.empty(k * 3, dtype=np.float32); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
        M = np.array(o.matrix_world, dtype=np.float32); co = co @ M[:3, :3].T + M[:3, 3]
        pts.append(co[::max(1, k // n)])
    return np.concatenate(pts)

def plate_number(cid):
    """the game's plateNumber(id), so the photo shows the same plate as the garage"""
    h = 7
    for ch in cid: h = (h * 31 + ord(ch)) & 0xffffffff
    d = str(1 + h % 9999)
    return (['品川', '練馬', '足立', '横浜', '湘南', '多摩', '富士山', '世田谷'][h % 8], ['300', '330', '500', '531'][(h >> 4) % 4],
            'さすせそたちつてとなにぬねのはひふほまみむめもやゆよらりるれろ'[(h >> 8) % 31],
            d[:2] + '-' + d[2:] if len(d) == 4 else '・' * (4 - len(d)) + d)

def paint_plates(cid):
    """green Japanese plate lettering on the outer face of every Plate slab"""
    body = next((o for o in car_objects() if o.name.startswith('Body')), None)
    if body is None: return
    slots = [i for i, s in enumerate(body.material_slots) if s.material and s.material.name.split('.')[0] == 'Plate']
    if not slots: return
    try: font = bpy.data.fonts.load(os.path.join(bpy.utils.resource_path('LOCAL'), 'datafiles', 'fonts', 'Noto Sans CJK Regular.woff2'))   # Blender's own CJK font
    except Exception: font = None
    green = bpy.data.materials.new('PlateInk'); green.use_nodes = True
    g = green.node_tree.nodes['Principled BSDF']; g.inputs['Base Color'].default_value = (0.004, 0.09, 0.025, 1); g.inputs['Roughness'].default_value = 0.4
    town, cls, kana, num = plate_number(cid)
    M = body.matrix_world; N3 = M.to_3x3().inverted().transposed(); xc = sum((M @ Vector(c)).x for c in body.bound_box) / 8
    for p in body.data.polygons:
        if p.material_index not in slots or not (0.03 < p.area < 0.09): continue
        n = (N3 @ p.normal).normalized(); c = M @ p.center
        if abs(n.x) < 0.5 or (n.x > 0) != (c.x > xc): continue        # the outer face only (front plate faces +X)
        up = (Vector((0, 0, 1)) - n * n.z).normalized(); right = up.cross(n)
        frame = Matrix((right, up, n)).transposed().to_4x4(); frame.translation = c + n * 0.0007
        def text(s, x, y, w, h):
            """lettering centred at (x, y) on the plate, stretched to fill a w x h box (measured, so any font fits)"""
            cu = bpy.data.curves.new('plate', 'FONT'); cu.body = s; cu.size = 0.1; cu.align_x = 'CENTER'; cu.align_y = 'CENTER'
            if font: cu.font = font
            cu.materials.append(green); ob = bpy.data.objects.new('PlateText', cu); bpy.context.scene.collection.objects.link(ob)
            bpy.context.view_layer.update(); dw, dh = max(ob.dimensions.x, 1e-4), max(ob.dimensions.y, 1e-4)
            ob.matrix_world = frame @ Matrix.Translation((x, y, 0)) @ Matrix.Diagonal((w / dw, h / dh, 1, 1))
        text(f'{town} {cls}', 0, 0.042, 0.03 * (len(town) + 0.6 * len(cls) + 0.3), 0.03)
        text(kana, -0.122, -0.034, 0.034, 0.036)
        text(num, 0.026, -0.03, 0.235 if len(num) == 5 else 0.2, 0.074)
        bm = bmesh.new()                                                  # the green border
        o_ = [bm.verts.new((sx * .158, sy * .076, 0)) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
        i_ = [bm.verts.new((sx * .152, sy * .070, 0)) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
        for k in range(4): bm.faces.new((o_[k], o_[(k + 1) % 4], i_[(k + 1) % 4], i_[k]))
        me = bpy.data.meshes.new('PlateRim'); bm.to_mesh(me); bm.free(); me.materials.append(green)
        ob = bpy.data.objects.new('PlateRim', me); bpy.context.scene.collection.objects.link(ob); ob.matrix_world = frame


# ------------------------------------------------------------------ the sets
def _obj(name, bm, mat):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(mat)
    for p in me.polygons: p.use_smooth = True
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o); return o
def _light(kind, loc, energy, color=(1, 1, 1), size=(1, 1), aim=None, spot=None, camera=False, spread=180):
    ld = bpy.data.lights.new('photo', kind); ld.energy = energy; ld.color = color
    if kind == 'AREA': ld.shape = 'RECTANGLE'; ld.size, ld.size_y = size; ld.spread = math.radians(spread)   # spread < 180: a softbox with a grid
    if kind == 'SPOT': ld.spot_size = math.radians(spot or 40); ld.spot_blend = 0.8; ld.shadow_soft_size = size[0]
    if kind == 'SUN': ld.angle = math.radians(size[0])
    o = bpy.data.objects.new('photo', ld); bpy.context.scene.collection.objects.link(o); o.location = loc
    o.visible_camera = camera
    if aim is not None:
        d = Vector(aim) - Vector(loc); o.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    return o
def _mat(name, col, rough=0.5, metal=0.0, emit=None, strength=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*col, 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if emit: b.inputs['Emission Color'].default_value = (*emit, 1); b.inputs['Emission Strength'].default_value = strength
    return m
def _world(color=None, strength=1.0):
    w = bpy.data.worlds.new('photo'); bpy.context.scene.world = w; w.use_nodes = True
    bg = w.node_tree.nodes['Background']; bg.inputs[1].default_value = strength
    if color: bg.inputs[0].default_value = (*color, 1)
    return w, bg

def wet_ground(name, base, dry_rough, puddles, scale=1.0):
    """asphalt: grainy, slightly lumpy, with mirror-smooth puddles where the noise peaks (puddles: 0 a few, 1 lots, -1 none)"""
    m = bpy.data.materials.new(name); nt, o = _tree(m); co = _coords(nt, scale)
    b = _bsdf(nt, **{'Specular IOR Level': 0.5})
    grain = _noise(nt, 260, 4, 0.7, co); big = _noise(nt, 0.35, 5, 0.55, co)
    col = _ramp(nt, grain.outputs['Fac'], [(0.3, tuple(c * 0.6 for c in base)), (0.7, tuple(min(1, c * 1.5) for c in base))])
    wet = _ramp(nt, big.outputs['Fac'], [(0.6 - puddles * 0.22, (0, 0, 0)), (0.62 - puddles * 0.22, (1, 1, 1))])   # 1 = puddle
    rough = nt.nodes.new('ShaderNodeMapRange'); rough.inputs['To Min'].default_value = dry_rough; rough.inputs['To Max'].default_value = 0.02
    nt.links.new(wet.outputs['Color'], rough.inputs['Value'])
    dark = nt.nodes.new('ShaderNodeMixRGB'); dark.blend_type = 'MULTIPLY'; dark.inputs['Fac'].default_value = 1.0   # puddles are darker
    wd = _ramp(nt, wet.outputs['Color'], [(0, (1, 1, 1)), (1, (0.45, 0.45, 0.45))])
    nt.links.new(col.outputs['Color'], dark.inputs[1]); nt.links.new(wd.outputs['Color'], dark.inputs[2])
    nt.links.new(dark.outputs[0], b.inputs['Base Color']); nt.links.new(rough.outputs[0], b.inputs['Roughness'])
    inv = _ramp(nt, wet.outputs['Color'], [(0, (1, 1, 1)), (1, (0, 0, 0))])                 # no grain bump in the puddles
    hb = nt.nodes.new('ShaderNodeMath'); hb.operation = 'MULTIPLY'; nt.links.new(grain.outputs['Fac'], hb.inputs[0]); nt.links.new(inv.outputs['Color'], hb.inputs[1])
    _bump(nt, b, hb.outputs[0], 0.25, 0.003); nt.links.new(b.outputs[0], o.inputs['Surface'])
    return m

def set_studio(cam_dir, size, g0):
    L, W = size
    _world((0.0008, 0.0009, 0.0011))
    # a curved backdrop (cyclorama) behind the car as the camera sees it, lit into a soft glow
    f = Vector((-cam_dir.x, -cam_dir.y, 0)).normalized(); s = Vector((-f.y, f.x, 0)); back = 9.0; R = 4.0
    bm = bmesh.new(); prof = [(-30, 0)] + [(back - R + R * math.sin(a * math.pi / 32), R - R * math.cos(a * math.pi / 32)) for a in range(17)] + [(back, 14)]
    rows = [[bm.verts.new(s * u + f * d + Vector((0, 0, g0 + z))) for d, z in prof] for u in (-40, 40)]
    for i in range(len(prof) - 1): bm.faces.new((rows[0][i], rows[0][i + 1], rows[1][i + 1], rows[1][i]))
    floor = bpy.data.materials.new('StudioFloor'); nt, o = _tree(floor); co = _coords(nt, 1)
    b = _bsdf(nt, **{'Base Color': (0.02, 0.021, 0.023, 1), 'Specular IOR Level': 0.5})
    r = _ramp(nt, _noise(nt, 0.8, 3, 0.5, co).outputs['Fac'], [(0.3, (0.26, 0.26, 0.26)), (0.7, (0.36, 0.36, 0.36))])
    nt.links.new(r.outputs['Color'], b.inputs['Roughness']); nt.links.new(b.outputs[0], o.inputs['Surface'])
    _obj('cyc', bm, floor)
    top = 4.6
    _light('AREA', (0, 0, g0 + top), 2000, (1, 0.985, 0.97), (L + 2.5, W + 1.4), aim=(0, 0, g0), spread=100)                       # the big softbox
    for side in (1, -1):                                                                                                  # strip lights along both flanks
        _light('AREA', (0, side * (W / 2 + 2.2), g0 + 3.0), 650, (1, 1, 1), (L + 3, 0.25), aim=(0, 0, g0 + 0.6), spread=45)
    c = Vector((0, 0, g0 + 0.7))
    _light('AREA', c + f * 5 + s * 4 + Vector((0, 0, 1.2)), 900, (0.55, 0.72, 1.0), (1.2, 2.4), aim=c)                 # cool rim
    _light('AREA', c + f * 5 - s * 4 + Vector((0, 0, 1.0)), 700, (1.0, 0.62, 0.32), (1.2, 2.4), aim=c)                 # warm rim
    _light('SPOT', c + f * 3 + Vector((0, 0, 3)), 9000, (1.0, 0.86, 0.72), (1, 1), aim=c + f * (back + 0.5) + Vector((0, 0, 1.2)), spot=55)   # backdrop glow
    _light('AREA', c - f * 7 + Vector((0, 0, 0.4)), 120, (1, 1, 1), (6, 1.0), aim=c)                                    # a soft fill from the camera side

def set_sunset(cam_dir, size, g0):
    sun_el, sun_az = math.radians(3.5), math.atan2(-cam_dir.y, -cam_dir.x) + math.radians(9)   # low, just behind the car's tail: in the picture   # low, behind the car and to one side
    sd = Vector((math.cos(sun_az) * math.cos(sun_el), math.sin(sun_az) * math.cos(sun_el), math.sin(sun_el)))
    # a painted golden-hour sky: deep blue overhead, peach, then orange and gold at the horizon, and a glow round the sun
    w, bg = _world(strength=1.0); nt = w.node_tree
    tc = nt.nodes.new('ShaderNodeTexCoord'); sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(tc.outputs['Generated'], sep.inputs[0])
    sky = _ramp(nt, sep.outputs['Z'], [(0.0, (0.35, 0.1, 0.03)), (0.015, (0.8, 0.26, 0.05)), (0.05, (0.62, 0.2, 0.1)), (0.12, (0.3, 0.12, 0.2)),
                                       (0.25, (0.07, 0.07, 0.2)), (1.0, (0.015, 0.03, 0.1))])
    dot = nt.nodes.new('ShaderNodeVectorMath'); dot.operation = 'DOT_PRODUCT'; dot.inputs[1].default_value = sd; nt.links.new(tc.outputs['Generated'], dot.inputs[0])
    glow = nt.nodes.new('ShaderNodeMath'); glow.operation = 'POWER'; glow.inputs[1].default_value = 60; nt.links.new(dot.outputs['Value'], glow.inputs[0])
    disc = nt.nodes.new('ShaderNodeMath'); disc.operation = 'GREATER_THAN'; disc.inputs[1].default_value = math.cos(math.radians(0.9)); nt.links.new(dot.outputs['Value'], disc.inputs[0])
    wide = nt.nodes.new('ShaderNodeMath'); wide.operation = 'POWER'; wide.inputs[1].default_value = 6; nt.links.new(dot.outputs['Value'], wide.inputs[0])
    sun = nt.nodes.new('ShaderNodeMath'); sun.operation = 'MULTIPLY_ADD'; sun.inputs[1].default_value = 6.0; nt.links.new(glow.outputs[0], sun.inputs[0])
    nt.links.new(disc.outputs[0], sun.inputs[2])
    sun2 = nt.nodes.new('ShaderNodeMath'); sun2.operation = 'MULTIPLY_ADD'; sun2.inputs[1].default_value = 0.8; nt.links.new(wide.outputs[0], sun2.inputs[0]); nt.links.new(sun.outputs[0], sun2.inputs[2])
    tint = nt.nodes.new('ShaderNodeMixRGB'); tint.blend_type = 'MULTIPLY'; tint.inputs['Fac'].default_value = 1.0; tint.inputs[1].default_value = (1.0, 0.5, 0.2, 1)
    nt.links.new(sun2.outputs[0], tint.inputs[2])
    add = nt.nodes.new('ShaderNodeMixRGB'); add.blend_type = 'ADD'; add.inputs['Fac'].default_value = 1.0
    nt.links.new(sky.outputs['Color'], add.inputs[1]); nt.links.new(tint.outputs[0], add.inputs[2]); nt.links.new(add.outputs[0], bg.inputs[0])
    _light('SUN', sd * 10, 5.0, (1.0, 0.6, 0.32), (0.6,), aim=(0, 0, 0))
    c = Vector((0, 0, g0 + 0.7)); _light('AREA', c + cam_dir * 9 + Vector((0, 0, 2.5)), 900, (1.0, 0.78, 0.6), (8, 4), aim=c)   # sky light on the near side
    # the road along the car, its markings, and the desert either side
    bm = bmesh.new(); bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=1500); _obj('ground', bm, wet_ground('Desert', (0.30, 0.20, 0.13), 0.9, -1.0, 0.5)).location.z = g0 - 0.01
    bm = bmesh.new(); bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=1)
    road = _obj('road', bm, wet_ground('Road', (0.06, 0.06, 0.065), 0.6, 0.1)); road.scale = (1500, 4.2, 1); road.location = (0, -1.6, g0 + 0.002)
    paint = _mat('Line', (0.85, 0.84, 0.78), 0.45)
    for y in (2.45, -5.65):
        bm = bmesh.new(); bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=1); o = _obj('edge', bm, paint); o.scale = (1500, 0.075, 1); o.location = (0, y, g0 + 0.004)
    for x in range(-200, 200, 12):
        bm = bmesh.new(); bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=1); o = _obj('dash', bm, paint); o.scale = (1.5, 0.06, 1); o.location = (x, -1.6, g0 + 0.004)
    # far-off mountains in the haze: two rings of ragged peaks, flat-lit in the colour of the air (the far ones paler)
    for r0, top, col, k in ((5200, 150, (0.62, 0.24, 0.16), 1.9), (3000, 75, (0.22, 0.09, 0.13), 4.3)):
        bm = bmesh.new(); ring = []
        for i in range(721):
            a = i / 720 * 2 * math.pi; r = r0 + 300 * math.sin(a * 3.0 + k)
            hgt = top * (0.25 + 0.75 * abs(math.sin(a * 5.3 + k)) * abs(math.sin(a * 2.1 + 1 + k))) + top * 0.12 * math.sin(a * 41 + k) + top * 0.05 * math.sin(a * 113)
            ring.append((bm.verts.new((math.cos(a) * r, math.sin(a) * r, g0 - 5)), bm.verts.new((math.cos(a) * r, math.sin(a) * r, g0 + hgt))))
        for i in range(720): bm.faces.new((ring[i][0], ring[i + 1][0], ring[i + 1][1], ring[i][1]))
        _obj('mountains', bm, _mat('Haze', (0.0, 0.0, 0.0), 1.0, emit=col, strength=1.0))


def set_neon(cam_dir, size, g0):
    L, W = size
    _world((0.0012, 0.0016, 0.004))
    bm = bmesh.new(); bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=60); _obj('street', bm, wet_ground('WetStreet', (0.03, 0.03, 0.035), 0.4, 0.75, 1.0)).location.z = g0
    f = Vector((-cam_dir.x, -cam_dir.y, 0)).normalized(); s = Vector((-f.y, f.x, 0)); c = Vector((0, 0, g0))
    # a dark wall behind with neon tubes on it, and two tubes standing either side
    bm = bmesh.new(); wc = c + f * 7.5
    vs = [bm.verts.new(wc + s * u + Vector((0, 0, z))) for u, z in ((-25, 0), (25, 0), (25, 12), (-25, 12))]; bm.faces.new(vs)
    _obj('wall', bm, _mat('Concrete', (0.035, 0.035, 0.04), 0.7))
    pink, blue = (1.0, 0.08, 0.55), (0.08, 0.6, 1.0)
    def tube(a, b, col, strength=28, r=0.035):
        a, b = Vector(a), Vector(b); d = b - a
        bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=r, radius2=r, depth=d.length)
        o = _obj('neon', bm, _mat('Neon', (0, 0, 0), 0.5, emit=col, strength=strength))
        o.matrix_world = Matrix.Translation((a + b) / 2) @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4()
    wf = wc - f * 0.08
    for k, (u0, u1, z, col) in enumerate(((-9, -1.5, 3.3, pink), (1.5, 9, 3.3, blue), (-6, 6, 4.2, pink), (-4, 4, 0.5, blue))):
        tube(wf + s * u0 + Vector((0, 0, z)), wf + s * u1 + Vector((0, 0, z)), col)
    for u, col in ((-7.5, blue), (7.5, pink)):
        tube(wf + s * u + Vector((0, 0, 0.6)), wf + s * u + Vector((0, 0, 3.8)), col)
    for side, col in ((1, pink), (-1, blue)):                                                         # tubes at the car's sides
        p = c + s * side * (L / 2 + 2.6) + f * 1.0
        tube(p + Vector((0, 0, 0.2)), p + Vector((0, 0, 2.6)), col, 40, 0.04)
        _light('AREA', p + Vector((0, 0, 1.4)), 250 if col == pink else 650, col, (0.4, 2.6), aim=c + Vector((0, 0, 0.6)))
    _light('AREA', (0, 0, g0 + 5), 1100, (0.75, 0.85, 1.0), (L + 2, W + 1), aim=(0, 0, g0))           # a cool overhead light to shape the roof
    _light('AREA', c + f * 6 + Vector((0, 0, 2.5)), 350, pink, (6, 1.5), aim=c + Vector((0, 0, 0.8)))  # the wall's glow on the car's back
    _light('AREA', c - f * 6 + s * 3 + Vector((0, 0, 3.0)), 500, (0.55, 0.8, 1.0), (7, 0.6), aim=c, spread=60)   # a long cool strip high on the camera side: a reflection line down the flank


# ------------------------------------------------------------------ camera, render, lens
def frame_camera(scene, pts, az, h, lens, g0, fill=0.76):
    """put the camera at angle az round the car, height h, and back it off until the car's real outline fills `fill`
    of the frame width (or 62% of its height); centre it with lens shift, a little low in the frame"""
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); scene.collection.objects.link(cam); scene.camera = cam
    cam.data.lens = lens; cam.data.sensor_width = 36; cam.data.clip_start = 0.05; cam.data.clip_end = 20000
    rx, ry = scene.render.resolution_x, scene.render.resolution_y; tw = 18 / lens; th = tw * ry / rx
    lo, hi = pts.min(0), pts.max(0); ctr = Vector(((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, g0 + (hi[2] - g0) * 0.42))
    d0 = Vector((math.cos(math.radians(az)), -math.sin(math.radians(az)), 0))

    def place(d):
        pos = ctr + d0 * d; pos.z = g0 + h
        fwd = (ctr - pos).normalized(); right = fwd.cross(Vector((0, 0, 1))).normalized(); up = right.cross(fwd)
        rel = pts - np.array(pos); z = rel @ np.array(fwd)
        return pos, fwd, right, up, (rel @ np.array(right)) / z / tw, (rel @ np.array(up)) / z / th, z
    a, b = 1.5, 60.0
    for _ in range(40):
        d = (a + b) / 2; *_, nx, ny, _z = place(d)
        if (nx.max() - nx.min()) / 2 <= fill and (ny.max() - ny.min()) / 2 <= 0.62: b = d
        else: a = d
    pos, fwd, right, up, nx, ny, z = place(b)
    cam.matrix_world = Matrix.Translation(pos) @ Matrix((right, up, -fwd)).transposed().to_4x4()
    cam.data.shift_x = (nx.max() + nx.min()) / 4
    cam.data.shift_y = ((ny.max() + ny.min()) / 2 + 0.10) / (2 * rx / ry)
    cam.data.dof.use_dof = True; cam.data.dof.aperture_fstop = 5.6
    cam.data.dof.focus_distance = float(np.percentile(z, 20))                 # the near half of the car stays pin-sharp
    return cam

def setup_render(scene, samples, size):
    r = scene.render; r.engine = 'CYCLES'; r.resolution_x, r.resolution_y = size; r.resolution_percentage = 100
    c = scene.cycles; c.samples = samples; c.use_adaptive_sampling = True; c.adaptive_threshold = 0.025
    c.use_denoising = True; c.denoiser = 'OPENIMAGEDENOISE'; c.denoising_input_passes = 'RGB_ALBEDO_NORMAL'
    c.max_bounces = 12; c.diffuse_bounces = 2; c.glossy_bounces = 4; c.transmission_bounces = 4; c.transparent_max_bounces = 16
    c.sample_clamp_indirect = 6.0; c.blur_glossy = 0.6; c.caustics_reflective = False; c.caustics_refractive = False
    scene.view_settings.view_transform = 'AgX'; scene.view_settings.look = 'AgX - Punchy'; scene.view_settings.exposure = 0.0
    r.image_settings.file_format = 'PNG'; r.image_settings.color_depth = '8'
    # lens work: glow round the lamps and highlights, a touch of colour fringing at the edges, a soft vignette
    scene.use_nodes = True; nt = scene.node_tree; nt.nodes.clear()
    rl = nt.nodes.new('CompositorNodeRLayers'); out = nt.nodes.new('CompositorNodeComposite')
    gl = nt.nodes.new('CompositorNodeGlare'); gl.glare_type = 'FOG_GLOW'; gl.quality = 'HIGH'; gl.threshold = 1.2; gl.size = 8; gl.mix = -0.72
    ld = nt.nodes.new('CompositorNodeLensdist'); ld.use_fit = True; ld.inputs['Dispersion'].default_value = 0.012
    em = nt.nodes.new('CompositorNodeEllipseMask'); em.width = 0.95; em.height = 0.92
    bl = nt.nodes.new('CompositorNodeBlur'); bl.filter_type = 'FAST_GAUSS'; bl.use_relative = True; bl.factor_x = bl.factor_y = 0.25; bl.size_x = bl.size_y = 400
    mr = nt.nodes.new('CompositorNodeMapRange'); mr.inputs['To Min'].default_value = 0.62; mr.inputs['To Max'].default_value = 1.0
    mx = nt.nodes.new('CompositorNodeMixRGB'); mx.blend_type = 'MULTIPLY'; mx.inputs['Fac'].default_value = 1.0
    L = nt.links.new
    L(rl.outputs['Image'], gl.inputs['Image']); L(gl.outputs['Image'], ld.inputs['Image']); L(ld.outputs['Image'], mx.inputs[1])
    L(em.outputs['Mask'], bl.inputs['Image']); L(bl.outputs['Image'], mr.inputs['Value']); L(mr.outputs['Value'], mx.inputs[2])
    L(mx.outputs['Image'], out.inputs['Image'])

def clear_set():
    for o in list(bpy.context.scene.objects):
        if o.type in ('LIGHT', 'CAMERA') or o.name.split('.')[0] in ('cyc', 'ground', 'road', 'edge', 'dash', 'mountains', 'street', 'wall', 'neon', 'floor'):
            bpy.data.objects.remove(o)

def shoot(k, folder, looks=('studio',), views=('front34',), samples=128, size=(1920, 1080)):
    """photograph the car the script just built: one picture per look x view, saved as <folder>/<id>-<look>-<view>.png"""
    scene = bpy.context.scene; os.makedirs(folder, exist_ok=True)
    for o in list(scene.objects):                                         # carkit's own preview set, if any
        if o.type in ('LIGHT', 'CAMERA') or o.name.split('.')[0] in ('floor', 'cam', 'tgt', 'l'): bpy.data.objects.remove(o)
    paint = bpy.data.materials.get('Paint'); col = _old(paint, 'Base Color', (0.3, 0.3, 0.3, 1))[:3] if paint else (0.3, 0.3, 0.3)
    bright = max(0.0, 0.2126 * col[0] + 0.7152 * col[1] + 0.0722 * col[2] - 0.35)   # white and silver cars get a little less exposure
    upgrade_materials(); paint_plates(k.key); setup_render(scene, samples, size)
    pts = car_points(); g0 = float(pts[:, 2].min()); lo, hi = pts.min(0), pts.max(0); dims = (float(hi[0] - lo[0]), float(hi[1] - lo[1]))
    out = []
    for view in views:
        V = VIEWS[view]; turn = math.radians(16 if V['az'] < 90 else -10 if V['az'] > 90 else 0)
        steer(turn)                                                       # front wheels towards a front camera (away for a rear one)
        for look in looks:
            clear_set()
            cam = frame_camera(scene, car_points(), V['az'], V['h'], V['lens'], g0)
            d = (cam.matrix_world.translation - Vector((0, 0, cam.matrix_world.translation.z))).normalized()
            {'studio': set_studio, 'sunset': set_sunset, 'neon': set_neon}[look](d, dims, g0)
            scene.view_settings.exposure = {'studio': -0.35, 'sunset': 0.25, 'neon': 0.0}[look] - bright * 1.2
            scene.render.filepath = os.path.join(folder, f'{k.key}-{look}-{view}.png')
            bpy.ops.render.render(write_still=True); out.append(scene.render.filepath); print('photo', scene.render.filepath, flush=True)
        steer(-turn)
    return out
