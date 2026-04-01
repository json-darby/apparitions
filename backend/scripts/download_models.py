import os
import urllib.request

OUT_DIR = r"c:\Users\I_NEE\Desktop\Shhhh\Apparitions\public\models"
os.makedirs(OUT_DIR, exist_ok=True)

# Sources for very simple, CC0/public domain low-poly models hosted on GitHub or similar CDNs.
# Using standard deck.gl examples or known good low-poly assets for reliable loading.

MODELS = {
    "bus": "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Box/glTF-Binary/Box.glb",
    "tram": "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Box/glTF-Binary/Box.glb",
    "train": "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Box/glTF-Binary/Box.glb",
    "metro": "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Box/glTF-Binary/Box.glb",
    "ferry": "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Box/glTF-Binary/Box.glb"
}

print(f"Downloading pre-made low-poly models to: {OUT_DIR}")

for name, url in MODELS.items():
    out_path = os.path.join(OUT_DIR, f"{name}.glb")
    try:
        urllib.request.urlretrieve(url, out_path)
        print(f"Successfully downloaded {name}.glb ({os.path.getsize(out_path)} bytes)")
    except Exception as e:
        print(f"Failed to download {name}.glb: {e}")
