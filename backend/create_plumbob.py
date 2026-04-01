import numpy as np
import trimesh
import math
import os

# Define the dimensions
radius = 0.5
z_top = 1.5
z_bottom = -1.5

# 1. Create the vertices
vertices = [
    [0, 0, z_top],     # Index 0: Top tip
    [0, 0, z_bottom]   # Index 1: Bottom tip
]

# Create the middle hexagonal ring
for i in range(6):
    angle = i * (2 * math.pi / 6)
    x = radius * math.cos(angle)
    y = radius * math.sin(angle)
    vertices.append([x, y, 0])

# 2. Connect vertices to form triangular faces
faces = []

# Top half
for i in range(6):
    current = 2 + i
    next_idx = 2 + ((i + 1) % 6)
    faces.append([0, current, next_idx])

# Bottom half (reversed for correct outward normals)
for i in range(6):
    current = 2 + i
    next_idx = 2 + ((i + 1) % 6)
    faces.append([1, next_idx, current])

# 3. Construct the mesh
mesh = trimesh.Trimesh(vertices=vertices, faces=faces)

# 4. Apply a pure white material
# Setting the emission factor ensures it stays bright white regardless of lighting
material = trimesh.visual.material.PBRMaterial(
    baseColorFactor=[255, 255, 255, 255],
    emissiveFactor=[1.0, 1.0, 1.0] 
)
mesh.visual.material = material

# 5. Export to GLB
output_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'public', 'models', 'plumbob.glb')
mesh.export(output_path)
print(f"Plumbob successfully generated as {output_path}")
