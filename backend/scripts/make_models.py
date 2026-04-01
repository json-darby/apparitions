import trimesh
import os

OUT_DIR = r"c:\Users\I_NEE\Desktop\Shhhh\Apparitions\public\models"
os.makedirs(OUT_DIR, exist_ok=True)

# Define our brutalist monolith sizes (width, height, length)
# By default in deck.gl ScenegraphLayer: 
# Y is up (height), X is right (width), Z is forward/back (length)
# But we'll just make boxes and orient them according to deck.gl orientation.
# A box in trimesh is created via extents = [x, y, z].
# Deck.gl models usually face "up" (+Y) or "forward" (+Z) depending on format, 
# for GLTF it's usually -Z forward, +Y up. 

models = {
    # Trams are long, relatively thin
    "tram": [2.6, 3.2, 12.0],
    # Buses are shorter than trams, slightly wider
    "bus": [3.0, 3.5, 9.0],
    # Trains are very long chunks
    "train": [3.5, 4.0, 25.0],
    # Metros are slightly shorter than trains
    "metro": [3.5, 4.0, 18.0],
    # Ferries are wide and flat-ish
    "ferry": [10.0, 5.0, 20.0]
}

# Add a slight "nose" to show direction (a tiny separate block at the front)
# so the monolith has an obvious forward direction for testing.
for name, extents in models.items():
    main_body = trimesh.creation.box(extents=extents)
    
    # Push the main body up so its bottom is at Y=0
    main_body.apply_translation([0, extents[1]/2, 0])
    
    # Create a small "cockpit" or "nose" block at the front (-Z)
    nose = trimesh.creation.box(extents=[extents[0]*0.8, extents[1]*1.1, extents[2]*0.1])
    # Place nose at the front edge (-Z), slightly elevated
    nose.apply_translation([0, extents[1]/2, -extents[2]/2])
    
    # Combine
    mesh = trimesh.util.concatenate([main_body, nose])
    
    # Color them stark white (Deck.gl will tint this if we use getColor)
    mesh.visual.vertex_colors = [255, 255, 255, 255]

    scene = trimesh.Scene(mesh)
    out_path = os.path.join(OUT_DIR, f"{name}.glb")
    scene.export(out_path)
    print(f"Exported {out_path}")
