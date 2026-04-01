import base64
import os

OUT_DIR = r"c:\Users\I_NEE\Desktop\Shhhh\Apparitions\public\models"
TS_FILE = r"c:\Users\I_NEE\Desktop\Shhhh\Apparitions\components\modelsData.ts"

content = "export const MODEL_MAP: Record<string, string> = {\n"
for name in ["tram", "bus", "train", "metro", "ferry"]:
    path = os.path.join(OUT_DIR, f"{name}.glb")
    if os.path.exists(path):
        with open(path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode('utf-8')
            content += f"    '{name.upper()}': 'data:application/octet-stream;base64,{b64}',\n"
    else:
        print(f"Missing {path}")

content += "};\n"

with open(TS_FILE, "w") as f:
    f.write(content)
print("Finished writing components/modelsData.ts")
