import os
import httpx
from fastapi import APIRouter, Response

router = APIRouter()

CACHE_DIR = os.path.join(os.path.dirname(__file__), "..", "..", ".cache", "pdok_tiles")
os.makedirs(CACHE_DIR, exist_ok=True)

@router.get("/tiles/{z}/{x}/{y}")
async def get_pdok_tile(z: str, x: str, y: str):
    """Proxy and cache PDOK 3D Kadaster tiles."""
    cache_file = os.path.join(CACHE_DIR, f"{z}_{x}_{y}.pbf")
    
    # Check if we have it locally
    if os.path.exists(cache_file):
        with open(cache_file, "rb") as f:
            content = f.read()
        return Response(content=content, media_type="application/x-protobuf")

    # If not, fetch from PDOK
    url = f"https://service.pdok.nl/kadaster/3d-basisvoorziening/wmts/v1_0/buildings/EPSG:3857/{z}/{x}/{y}.pbf"
    
    async with httpx.AsyncClient() as client:
        response = await client.get(url)
        
        if response.status_code == 200:
            content = response.content
            # Save to cache
            with open(cache_file, "wb") as f:
                f.write(content)
            return Response(content=content, media_type="application/x-protobuf", headers={
                "Access-Control-Allow-Origin": "*"
            })
        else:
            return Response(status_code=response.status_code, content=response.text)
