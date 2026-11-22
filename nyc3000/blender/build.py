"""Build the NYC 3000 models in Blender and export them as GLB files into public/models/.

    blender -b --factory-startup -P blender/build.py -- [cars|people|buildings|all] [--preview DIR]
"""
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import lib  # noqa: E402

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
preview = None
if '--preview' in args:
    preview = args[args.index('--preview') + 1]
    os.makedirs(preview, exist_ok=True)
what = [a for a in args if not a.startswith('--') and a != preview] or ['all']
OUT = os.path.normpath(os.path.join(HERE, '..', 'public', 'models'))
os.makedirs(OUT, exist_ok=True)


def run(name, module):
    t = time.time()
    lib.clear_scene()
    objs = module.build_all()
    markers = [o for o in lib.bpy.context.scene.objects if o.type == 'EMPTY']
    path = os.path.join(OUT, name + '.glb')
    lib.export(path, objs + markers)
    print(f'{name}: {len(objs)} meshes, {len(markers)} markers -> {path} '
          f'({os.path.getsize(path) // 1024} KB, {time.time() - t:.1f}s)')
    if preview and hasattr(module, 'previews'):
        module.previews(objs, preview)


if 'cars' in what or 'all' in what:
    import cars
    run('cars', cars)

if 'people' in what or 'all' in what:
    import people
    run('people', people)

if 'buildings' in what or 'all' in what:
    import buildings
    run('buildings', buildings)

if 'interiors' in what or 'all' in what:
    import interiors
    run('interiors', interiors)
