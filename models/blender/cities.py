# The towns of AMBOOLA's countries, built in Blender by script with citykit.py:
#
#   blender -b --factory-startup --python models/blender/cities.py -- --city paris|all [--render DIR]
#
# Each country writes models/city_<id>.glb(.js) holding
#   G<k>, U<k>, B<k>, R<k>   building family k: ground storey, upper storey, balcony storey (optional), roof.
#                            The game stacks them (G, then U/B storeys, then R) on every house plot of the town and
#                            scales them to the plot's footprint. Custom props W, D, H (storey height) travel as extras.
#   T_<kind>                 street trees (palm, round, cypress, fir)
#   L_<name>                 landmarks, modelled round their anchor point in the game
#   P_<name>                 small props the game places many times (café tables, phone boxes, buses)
# Blender X is the game's x and Blender Y is the game's -z.
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from citykit import (Node, M, V, lerp, Face, storey, band, corners, window, door, outline, grow, gable, hip, mansard, flat_roof,
                     chimney, tree_palm, tree_round, tree_cypress, tree_fir, export, reset, render, build_all)

HERE = os.path.dirname(os.path.abspath(__file__))

# ==================================================================================================== driver
CITIES = ['cyprus', 'italy', 'dubai', 'paris', 'newyork', 'alps', 'london', 'egypt']

def demo(cid, out):
    """a test street: a few stacked buildings, the trees and every landmark, rendered from above"""
    import bpy
    objs = {o.name: o for o in bpy.context.scene.objects}
    fam = sorted({n[1:] for n in objs if n[0] == 'G' and n[1:].isdigit()})
    made = []
    def put(name, x, y, z=0, rz=0):
        o = objs[name].copy(); bpy.context.scene.collection.objects.link(o); o.location = (x, y, z); o.rotation_euler = (0, 0, rz); made.append(o); return o
    for i, k in enumerate(fam * 2):
        G, U = objs[f'G{k}'], objs[f'U{k}']; x = -60 + i * 32; z = G['H']; floors = 3 + i % 3
        put(f'G{k}', x, 0)
        for f in range(floors):
            put(f'B{k}' if f'B{k}' in objs and f in (1, floors - 1) else f'U{k}', x, 0, z); z += U['H']
        put(f'R{k}', x, 0, z)
    for i, t in enumerate(n for n in objs if n.startswith('T_')): put(t, -60 + i * 8, -22)
    lm = [n for n in objs if n.startswith('L_') or n.startswith('P_')]
    x, top = 0.0, 10.0
    for name in lm:   # landmarks side by side, spaced by their size
        d = objs[name].dimensions; x += d.x / 2 + 15; put(name, x, 150); x += d.x / 2 + 15; top = max(top, d.z)
    for o in made[-len(lm):] if lm else []: o.location.x -= x / 2
    for o in objs.values(): o.hide_render = True
    render(os.path.join(out, f'{cid}-street.png'), {}, cam=(40, -95, 45), look=(0, 10, 12), lens=30)
    dist = max(x, top * 1.6) * .75
    render(os.path.join(out, f'{cid}-landmarks.png'), {}, cam=(0, 150 - dist, top * .45 + dist * .25), look=(0, 150, top * .35), lens=32)
    for o in made: bpy.data.objects.remove(o)
    for o in objs.values(): o.hide_render = False

if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    which = argv[argv.index('--city') + 1] if '--city' in argv else 'all'
    import importlib
    for cid in (CITIES if which == 'all' else which.split(',')):
        if not os.path.exists(os.path.join(HERE, f'city_{cid}.py')): print(f'skip {cid}: no city_{cid}.py'); continue
        reset(); importlib.import_module(f'city_{cid}').build(); build_all()
        if '--render' in argv: demo(cid, argv[argv.index('--render') + 1])
        export(os.path.join(HERE, '..', f'city_{cid}.glb'), f'city_{cid}', 'cities.py')
