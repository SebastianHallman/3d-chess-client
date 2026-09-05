"""Run with Blender --background --python scripts/export-piece-set.py -- SOURCE_DIR."""
import bpy
import sys
from pathlib import Path
from mathutils import Vector

source = Path(sys.argv[sys.argv.index('--') + 1])
target = Path(__file__).resolve().parents[1] / 'public/chess-piece-models/d1sabl3d'
target.mkdir(parents=True, exist_ok=True)
names = {'Bonde': 'pawn', 'Torn': 'rook', 'Springare': 'knight',
         'Lopare': 'bishop', 'Dam': 'queen', 'Kung': 'king'}
for original, filename in names.items():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    bpy.ops.wm.stl_import(filepath=str(source / (original + '.stl')))
    obj = bpy.context.object
    bounds = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    center_x = (min(v.x for v in bounds) + max(v.x for v in bounds)) / 2
    center_y = (min(v.y for v in bounds) + max(v.y for v in bounds)) / 2
    floor = min(v.z for v in bounds)
    for vertex in obj.data.vertices:
        vertex.co -= Vector((center_x, center_y, floor))
        vertex.co /= 57
    modifier = obj.modifiers.new('Web detail', 'DECIMATE')
    modifier.ratio = min(1, 12000 / len(obj.data.polygons))
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    obj.name = filename
    bpy.ops.export_scene.gltf(filepath=str(target / (filename + '.glb')),
                              export_format='GLB', use_selection=True,
                              export_yup=True, export_materials='NONE')
    print(f'{filename}: {len(obj.data.polygons)} triangles')
