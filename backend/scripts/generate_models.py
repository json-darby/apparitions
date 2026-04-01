import trimesh
import numpy as np
import os

OUT_DIR = r"c:\Users\I_NEE\Desktop\Shhhh\Apparitions\public\models"
os.makedirs(OUT_DIR, exist_ok=True)

# GHOST_COLORS from the frontend (RGBA 0-255) -- baked into vertex colours
COLORS = {
    'tram':  [230, 230, 245, 255],   # Soft Pearl
    'bus':   [255, 120, 100, 200],   # Warm Coral
    'train': [255, 200,  50, 255],   # Amber Gold
    'metro': [100, 200, 255, 255],   # Spectral Cyan
    'ferry': [ 80, 240, 160, 200],   # Soft Jade
}

def colorize(mesh, rgba):
    """Bake a flat RGBA colour into every vertex of the mesh."""
    mesh.visual = trimesh.visual.ColorVisuals(
        mesh=mesh,
        vertex_colors=np.tile(rgba, (len(mesh.vertices), 1)).astype(np.uint8)
    )
    return mesh

# All models target roughly 12-15m length and 2.5-3m width for consistent map scale

def make_bus():
    """Compact city bus — 10m long, 2.5m wide"""
    body = trimesh.creation.box(extents=(2.5, 3.0, 10.0))
    body.apply_translation((0, 1.5, 0))
    wheels = []
    for x in [-1.0, 1.0]:
        for z in [-3.0, 3.0]:
            w = trimesh.creation.cylinder(radius=0.5, height=0.4)
            w.apply_transform(trimesh.transformations.rotation_matrix(np.pi/2, [0,0,1]))
            w.apply_translation((x, 0.5, z))
            wheels.append(w)
    return trimesh.util.concatenate([body] + wheels)

def make_tram():
    """Articulated tram — two 6m cars = ~13m total, 2.6m wide"""
    car1 = trimesh.creation.box(extents=(2.6, 3.2, 6.0))
    car1.apply_translation((0, 1.6, -3.5))
    car2 = trimesh.creation.box(extents=(2.6, 3.2, 6.0))
    car2.apply_translation((0, 1.6, 3.5))
    pantograph = trimesh.creation.box(extents=(0.3, 1.2, 0.3))
    pantograph.apply_translation((0, 3.8, 0))
    return trimesh.util.concatenate([car1, car2, pantograph])

def make_train():
    """Train carriage — 14m long, 3m wide (same visual scale as tram)"""
    body = trimesh.creation.box(extents=(3.0, 3.5, 14.0))
    body.apply_translation((0, 1.75, 0))
    nose = trimesh.creation.box(extents=(2.6, 2.8, 2.0))
    nose.apply_translation((0, 1.4, -8.0))
    return trimesh.util.concatenate([body, nose])

def make_metro():
    """Metro car — 13m long, 3m wide"""
    body = trimesh.creation.box(extents=(3.0, 3.2, 13.0))
    body.apply_translation((0, 1.6, 0))
    return body

def make_ferry():
    """Ferry — 14m long, 5m wide (wider but similar length)"""
    hull = trimesh.creation.box(extents=(5.0, 2.0, 14.0))
    hull.apply_translation((0, 1.0, 0))
    deck = trimesh.creation.box(extents=(4.0, 1.5, 10.0))
    deck.apply_translation((0, 2.75, -0.5))
    cabin = trimesh.creation.box(extents=(3.0, 1.5, 3.0))
    cabin.apply_translation((0, 4.0, 3.0))
    return trimesh.util.concatenate([hull, deck, cabin])

generators = {
    "bus": make_bus,
    "tram": make_tram,
    "train": make_train,
    "metro": make_metro,
    "ferry": make_ferry,
}

for name, gen_fn in generators.items():
    mesh = gen_fn()
    colorize(mesh, COLORS[name])
    glb_path = os.path.join(OUT_DIR, f"{name}.glb")
    mesh.export(glb_path)
    size = os.path.getsize(glb_path)
    print(f"OK  {name}.glb  ({len(mesh.faces)} faces, {size} bytes)")

print("\nAll models exported (normalised sizes)")
