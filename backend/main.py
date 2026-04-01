import os
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), 'libs'))
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
from pydantic import BaseModel
from dotenv import load_dotenv
import edge_tts
import httpx
from google.transit import gtfs_realtime_pb2
import json
import csv
import io
import zipfile
import asyncio
from contextlib import asynccontextmanager
import argostranslate.translate
import wikipediaapi
import difflib

wiki_en = wikipediaapi.Wikipedia(user_agent='Apparitions/1.0 (contact@apparitions.nl)', language='en')
wiki_nl = wikipediaapi.Wikipedia(user_agent='Apparitions/1.0 (contact@apparitions.nl)', language='nl')

load_dotenv(dotenv_path="../.env.local")
from api.routers import pdok, p2000
from apparition_engine import ApparitionEngine
from whisper_system import get_whisper_suggestions
from prompts import BASE_SYSTEM_INSTRUCTION, SCENARIOS

# Initialise the engine once when the server boots
apparition_engine = ApparitionEngine(update_storage=False)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load the GTFS route map in the background on server start."""
    asyncio.create_task(load_route_map())
    yield
    # No cleanup necessary on shutdown for now

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(pdok.router, prefix="/api/pdok", tags=["pdok"])
app.include_router(p2000.router, prefix="/api/p2000", tags=["p2000"])

api_key = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=api_key)

# GTFS route type mapping (cached at startup)
# Key: route_id -> Value: { type: int, name: str }
# Types: 0=Tram, 1=Metro, 2=Train, 3=Bus, 4=Ferry
ROUTE_MAP: dict = {}
ROUTE_TYPE_LABELS = {0: 'TRAM', 1: 'METRO', 2: 'TRAIN', 3: 'BUS', 4: 'FERRY'}

# Known Dutch operator prefixes for fallback classification
OPERATOR_TYPES = {
    'GVB': 'TRAM',    # Amsterdam (trams, metros, buses, ferries)
    'RET': 'TRAM',    # Rotterdam (trams, metros, buses)
    'HTM': 'TRAM',    # The Hague (trams, buses)
    'NS': 'TRAIN',    # Dutch Railways
    'ARR': 'BUS',     # Arriva
    'EBS': 'BUS',     # EBS
    'CXX': 'BUS',     # Connexxion
    'QBUZZ': 'BUS',   # Qbuzz
}

async def load_route_map():
    """Download and cache the GTFS routes.txt for transport type classification."""
    global ROUTE_MAP
    try:
        async with httpx.AsyncClient(verify=False, follow_redirects=True) as http_client:
            r = await http_client.get(
                'https://gtfs.ovapi.nl/nl/gtfs-nl.zip',
                timeout=60.0
            )
            if r.status_code == 200:
                with zipfile.ZipFile(io.BytesIO(r.content)) as z:
                    with z.open('routes.txt') as f:
                        content = f.read().decode('utf-8-sig')
                        reader = csv.DictReader(io.StringIO(content))
                        for row in reader:
                            rid = row.get('route_id', '')
                            rtype = int(row.get('route_type', 3))
                            rname = row.get('route_short_name', '')
                            ROUTE_MAP[rid] = {
                                'type': ROUTE_TYPE_LABELS.get(rtype, 'BUS'),
                                'name': rname
                            }
                print(f"[GTFS] Loaded {len(ROUTE_MAP)} routes from gtfs-nl.zip")
            else:
                print(f"[GTFS] gtfs-nl.zip returned {r.status_code}, using fallback classification")
    except Exception as e:
        print(f"[GTFS] Failed to load routes.txt from zip: {e}, using fallback classification")


class TTSRequest(BaseModel):
    text: str

@app.post("/api/tts")
async def generate_tts(request: TTSRequest):
    try:
        voice = "nl-NL-FennaNeural"
        communicate = edge_tts.Communicate(request.text, voice, rate="-10%")
        
        audio_data = b""
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_data += chunk["data"]
                
        return Response(content=audio_data, media_type="audio/mpeg")
    except Exception as e:
        print(f"TTS Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class TranslateRequest(BaseModel):
    text: str

@app.post("/api/translate")
async def translate_text(request: TranslateRequest):
    try:
        translatedText = argostranslate.translate.translate(request.text, 'nl', 'en')
        return {"translatedText": translatedText}
    except Exception as e:
        print(f"Translation Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class LessonRequest(BaseModel):
    user_request: str
    context: str = "None"

@app.post("/api/lesson")
async def get_lesson(request: LessonRequest):
    """
    Endpoint for the frontend to request a lesson.
    The engine decides if it's a static pull or a dynamic generation.
    """
    try:
        lesson = apparition_engine.process_user_request(
            request.user_request, 
            request.context
        )
        return lesson
    except Exception as e:
        print(f"Lesson Generation Error: {e}")
        raise HTTPException(status_code=500, detail="The Apparitions failed to conjure a lesson.")

class WhisperRequest(BaseModel):
    bot_transcript: str
    model: int = 2
    scenario: str = "START_INTRO"

@app.post("/api/whisper/suggestions")
async def fetch_whisper_suggestions(request: WhisperRequest):
    try:
        suggestions = get_whisper_suggestions(request.bot_transcript, request.model, request.scenario)
        return {"suggestions": suggestions}
    except Exception as e:
        print(f"Whisper Generation Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate whisper suggestions.")

@app.get("/api/index")
async def get_lesson_index():
    """Returns the list of all available static lessons."""
    try:
        return apparition_engine.get_index()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/transit")
async def get_live_transit(bbox: str = None):
    """
    Fetch real-time Dutch public transport vehicle positions.
    Optional bbox parameter: "min_lat,min_lon,max_lat,max_lon"
    Caches the response for 30 seconds to avoid upstream 429 rate limits.
    Computes heading from successive positions when bearing is unavailable.
    """
    import time as _time
    import math
    
    # Initialise the position history for heading computation
    if not hasattr(app.state, 'prev_positions'):
        app.state.prev_positions = {}

    # Check in-memory cache first (30s TTL)
    raw_feed_content = None
    if hasattr(app.state, 'transit_cache') and app.state.transit_cache:
        cache = app.state.transit_cache
        if _time.time() - cache['timestamp'] < 30:
            raw_feed_content = cache['data']

    try:
        if not raw_feed_content:
            async with httpx.AsyncClient(verify=False) as http_client:
                response = await http_client.get(
                    'https://gtfs.ovapi.nl/nl/vehiclePositions.pb',
                    timeout=15.0
                )
                response.raise_for_status()
                raw_feed_content = response.content
                
                # Cache the raw protobuf content
                app.state.transit_cache = {
                    'data': raw_feed_content,
                    'timestamp': _time.time()
                }

        feed = gtfs_realtime_pb2.FeedMessage()
        feed.ParseFromString(raw_feed_content)

        # Parse Bounding Box if provided
        bounds = None
        if bbox:
            try:
                # Format: "min_lat,min_lon,max_lat,max_lon"
                parts = [float(p.strip()) for p in bbox.split(',')]
                if len(parts) == 4:
                    bounds = {
                        'min_lat': parts[0],
                        'min_lon': parts[1],
                        'max_lat': parts[2],
                        'max_lon': parts[3]
                    }
            except ValueError:
                print(f"[GTFS] Invalid bbox format: {bbox}")

        vehicles = {}
        for entity in feed.entity:
            if entity.HasField('vehicle'):
                vp = entity.vehicle
                if vp.HasField('position'):
                    lat = vp.position.latitude
                    lon = vp.position.longitude
                    bearing = vp.position.bearing if vp.position.HasField('bearing') else 0.0

                    # Apply spatial filtering if bounds are set
                    if bounds:
                        if not (bounds['min_lat'] <= lat <= bounds['max_lat'] and 
                                bounds['min_lon'] <= lon <= bounds['max_lon']):
                            continue

                    vid = vp.vehicle.id if vp.HasField('vehicle') and vp.vehicle.id else entity.id
                    route_id = vp.trip.route_id if vp.HasField('trip') else ''
                    direction_id = vp.trip.direction_id if vp.HasField('trip') and vp.trip.HasField('direction_id') else 0
                    label = vp.vehicle.label if vp.HasField('vehicle') else ''
                    
                    route_info = ROUTE_MAP.get(route_id)
                    if route_info:
                        vtype = route_info['type']
                        vname = route_info['name']
                    else:
                        # NEW SMART LOGIC
                        parts = entity.id.split(':')
                        operator = parts[1] if len(parts) > 1 else ''
                        
                        # Use parts[2] as the line identifier if available, or fallback to route_id/label
                        identifier = parts[2].upper() if len(parts) > 2 else str(route_id or label).upper()
                        vtype = 'BUS' # Safe default
                        vname = identifier if len(parts) > 2 else (route_id or label)
                        
                        if operator == 'NS':
                            vtype = 'TRAIN'
                        elif operator in ['GVB', 'RET', 'HTM']:
                            if identifier.startswith('M') or identifier in ['50', '51', '52', '53', '54', 'A', 'B', 'C', 'D', 'E']:
                                vtype = 'METRO'
                            elif identifier.startswith('F') or 'VEER' in identifier:
                                vtype = 'FERRY'
                            elif identifier.isdigit() and int(identifier) <= 34:
                                vtype = 'TRAM'
                            else:
                                vtype = 'BUS'
                        else:
                            vtype = OPERATOR_TYPES.get(operator, 'BUS')

                    # Compute heading from successive positions when bearing is 0
                    heading = bearing
                    if heading == 0.0 and vid in app.state.prev_positions:
                        prev = app.state.prev_positions[vid]
                        dlat = lat - prev['lat']
                        dlon = lon - prev['lon']
                        if abs(dlat) > 1e-6 or abs(dlon) > 1e-6:
                            # atan2 gives angle from north (positive = clockwise)
                            heading = math.degrees(math.atan2(dlon, dlat)) % 360

                    # Store current position for next computation
                    app.state.prev_positions[vid] = {'lat': lat, 'lon': lon}
                    
                    vehicles[vid] = {
                        'latitude': lat,
                        'longitude': lon,
                        'vehiclenumber': vid,
                        'linename': vname,
                        'heading': heading,
                        'direction_id': direction_id,
                        'type': vtype,
                        'dataownercode': label,
                    }

        result_json = json.dumps(vehicles)
        return Response(content=result_json, media_type="application/json")

    except httpx.RequestError as e:
        print(f"Proxy fetch error: {e}")
        raise HTTPException(status_code=502, detail="Upstream GTFS server is unresponsive.")
    except Exception as e:
        print(f"Proxy internal error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/crowds")
async def get_live_crowds(bbox: str):
    import time as _time
    import urllib.parse
    
    cache_key = f"crowd_cache_{bbox}"
    
    # Check in-memory cache first (60s TTL)
    if not hasattr(app.state, 'crowd_cache'):
        app.state.crowd_cache = {}
        
    cache = app.state.crowd_cache.get(cache_key)
    if cache and _time.time() - cache['timestamp'] < 60:
        return Response(content=cache['data'], media_type="application/json")

    query = f"""
        [out:json][timeout:25];
        (
            way["highway"="footway"]({bbox});
            way["highway"="pedestrian"]({bbox});
            way["highway"="path"]({bbox});
            way["highway"="steps"]({bbox});
        );
        out geom;
    """
    
    try:
        async with httpx.AsyncClient(verify=False) as http_client:
            response = await http_client.get(
                f'https://overpass-api.de/api/interpreter?data={urllib.parse.quote(query)}',
                timeout=30.0
            )
            response.raise_for_status()
            
            # Cache the raw JSON content
            app.state.crowd_cache[cache_key] = {
                'data': response.content,
                'timestamp': _time.time()
            }
            
            return Response(content=response.content, media_type="application/json")

    except httpx.HTTPStatusError as e:
        print(f"Crowd proxy upstream error {e.response.status_code}: {e.response.text}")
        raise HTTPException(status_code=502, detail="Upstream Overpass server returned an error.")
    except httpx.RequestError as e:
        print(f"Crowd proxy fetch error: {e}")
        raise HTTPException(status_code=502, detail="Upstream Overpass server is unresponsive.")
    except Exception as e:
        print(f"Crowd proxy internal error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/wikipedia/{structure_name}")
async def get_wikipedia_info(structure_name: str, city: str = None, lat: float = None, lon: float = None,
                             wikidata: str = None, wikipedia_title: str = None):
    """
    Fetch Wikipedia summary and thumbnail for a given structure name.
    Retrieves English text by default, resolving from Dutch if necessary.
    Uses structural heuristics to avoid generic disambiguation pages.
    """
    try:
        page = None
        lang_fetched = 'en'
        
        # Helper to determine if an article is valid or just a disambiguation
        def is_valid_article(p):
            if not p.exists(): return False
            summary = p.summary.lower()
            title = p.title.lower()
            return not (
                "may refer to:" in summary or 
                "kan verwijzen naar:" in summary or
                "disambiguation" in title or
                "doorverwijspagina" in title or 
                "meerdere betekenissen" in summary
            )

        # 1. Direct Tag Lock
        if wikipedia_title:
            p_en = wiki_en.page(wikipedia_title)
            if is_valid_article(p_en):
                page = p_en
            else:
                p_nl = wiki_nl.page(wikipedia_title)
                if is_valid_article(p_nl):
                    if 'en' in p_nl.langlinks:
                        p_en_link = wiki_en.page(p_nl.langlinks['en'].title)
                        if is_valid_article(p_en_link):
                            page = p_en_link
                        else:
                            page = p_nl
                            lang_fetched = 'nl'
                    else:
                        page = p_nl
                        lang_fetched = 'nl'
                        
        if not page and wikidata:
            try:
                async with httpx.AsyncClient() as http_client:
                    wd_url = f"https://www.wikidata.org/w/api.php?action=wbgetentities&ids={wikidata}&props=sitelinks&format=json"
                    res = await http_client.get(wd_url, headers={"User-Agent": "Apparitions/1.0 (contact@apparitions.nl)"})
                    data = res.json()
                    sitelinks = data.get('entities', {}).get(wikidata, {}).get('sitelinks', {})
                    if 'enwiki' in sitelinks:
                        p_en = wiki_en.page(sitelinks['enwiki']['title'])
                        if is_valid_article(p_en):
                            page = p_en
                    elif 'nlwiki' in sitelinks:
                        p_nl = wiki_nl.page(sitelinks['nlwiki']['title'])
                        if is_valid_article(p_nl):
                            if 'en' in p_nl.langlinks:
                                p_link = wiki_en.page(p_nl.langlinks['en'].title)
                                if is_valid_article(p_link):
                                    page = p_link
                                else:
                                    page = p_nl
                                    lang_fetched = 'nl'
                            else:
                                page = p_nl
                                lang_fetched = 'nl'
            except Exception as e:
                print(f"[WIKI] Wikidata wbgetentities error: {e}")

        # 2. Progressive GeoSearch
        if not page and lat is not None and lon is not None:
            name_lower = structure_name.lower()
            try:
                async with httpx.AsyncClient() as http_client:
                    for radius in [100, 300, 1000]:
                        if page: break
                        
                        # 2a. Wikidata GeoSearch
                        try:
                            wd_geo = f"https://www.wikidata.org/w/api.php?action=query&list=geosearch&gscoord={lat}|{lon}&gsradius={radius}&gslimit=5&format=json"
                            res = await http_client.get(wd_geo, headers={"User-Agent": "Apparitions/1.0 (contact@apparitions.nl)"})
                            wd_data = res.json()
                            wd_pages = wd_data.get("query", {}).get("geosearch", [])
                            for gp in wd_pages:
                                if page: break
                                qid = gp['title']
                                q_url = f"https://www.wikidata.org/w/api.php?action=wbgetentities&ids={qid}&props=sitelinks&format=json"
                                q_res = await http_client.get(q_url, headers={"User-Agent": "Apparitions/1.0 (contact@apparitions.nl)"})
                                q_data = q_res.json()
                                sitelinks = q_data.get('entities', {}).get(qid, {}).get('sitelinks', {})
                                
                                potential_title = None
                                if 'enwiki' in sitelinks:
                                    potential_title = sitelinks['enwiki']['title']
                                elif 'nlwiki' in sitelinks:
                                    potential_title = sitelinks['nlwiki']['title']
                                    
                                if potential_title:
                                    ratio = difflib.SequenceMatcher(None, name_lower, potential_title.lower()).ratio()
                                    if ratio > 0.5 or potential_title.lower() in name_lower or name_lower in potential_title.lower():
                                        wiki_obj = wiki_en if 'enwiki' in sitelinks else wiki_nl
                                        p = wiki_obj.page(potential_title)
                                        if is_valid_article(p):
                                            if wiki_obj == wiki_nl and 'en' in p.langlinks:
                                                p_link = wiki_en.page(p.langlinks['en'].title)
                                                if is_valid_article(p_link):
                                                    page = p_link
                                                else:
                                                    page = p
                                                    lang_fetched = 'nl'
                                            else:
                                                page = p
                                                lang_fetched = 'en' if wiki_obj == wiki_en else 'nl'
                        except Exception as e:
                            print(f"[WIKI] Wikidata geosearch error: {e}")

                        # 2b. MediaWiki GeoSearch
                        if not page:
                            for g_lang in ['en', 'nl']:
                                if page: break
                                geo_url = f"https://{g_lang}.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord={lat}|{lon}&gsradius={radius}&gslimit=5&format=json"
                                res = await http_client.get(geo_url, headers={"User-Agent": "Apparitions/1.0 (contact@apparitions.nl)"})
                                geo_data = res.json()
                                geo_pages = geo_data.get("query", {}).get("geosearch", [])
                                
                                for gp in geo_pages:
                                    title_lower = gp["title"].lower()
                                    ratio = difflib.SequenceMatcher(None, name_lower, title_lower).ratio()
                                    if ratio > 0.5 or title_lower in name_lower or name_lower in title_lower:
                                        p = (wiki_en if g_lang == 'en' else wiki_nl).page(gp["title"])
                                        if is_valid_article(p):
                                            if g_lang == 'nl' and 'en' in p.langlinks:
                                                p_link = wiki_en.page(p.langlinks['en'].title)
                                                if is_valid_article(p_link):
                                                    page = p_link
                                                else:
                                                    page = p
                                                    lang_fetched = 'nl'
                                            else:
                                                page = p
                                                lang_fetched = g_lang
                                            break
            except Exception as e:
                print(f"[WIKI] Geosearch error: {e}")

        # 3. Final Permutation Fallback
        if not page:
            candidates = []
            c = city.title() if city else ""
            if c:
                candidates.extend([
                    f"{structure_name} ({c})",
                    f"{structure_name}, {c}",
                    f"{structure_name} {c}"
                ])
            candidates.append(structure_name)
            
            for cand in candidates:
                if page: break
                p_en = wiki_en.page(cand)
                if is_valid_article(p_en):
                    if c and c.lower() not in p_en.text.lower() and c.lower() not in p_en.title.lower():
                        continue
                    page = p_en
                    break
                    
            if not page:
                for cand in candidates:
                    p_nl = wiki_nl.page(cand)
                    if is_valid_article(p_nl):
                        if c and c.lower() not in p_nl.text.lower() and c.lower() not in p_nl.title.lower():
                            continue
                        if 'en' in p_nl.langlinks:
                            p_link = wiki_en.page(p_nl.langlinks['en'].title)
                            if is_valid_article(p_link):
                                page = p_link
                                lang_fetched = 'en'
                                break
                        page = p_nl
                        lang_fetched = 'nl'
                        break

        if not page:
            raise HTTPException(status_code=404, detail="Wikipedia page not found")
            
        # Fetch thumbnail via MediaWiki API since wikipediaapi focuses on text
        thumbnail_source = None
        try:
            async with httpx.AsyncClient() as http_client:
                res = await http_client.get(
                    f"https://{lang_fetched}.wikipedia.org/w/api.php?action=query&titles={page.title}&prop=pageimages&format=json&pithumbsize=600",
                    headers={"User-Agent": "Apparitions/1.0 (contact@apparitions.nl)"}
                )
                data = res.json()
                pages = data.get("query", {}).get("pages", {})
                for page_id, pdata in pages.items():
                    if "thumbnail" in pdata:
                        thumbnail_source = pdata["thumbnail"]["source"]
                        break
        except Exception as e:
            print(f"[WIKI] Thumbnail fetch error: {e}")

        extract = page.summary
        
        # Translate to English if we only found a Dutch article
        if lang_fetched == 'nl':
            try:
                extract = argostranslate.translate.translate(extract, 'nl', 'en')
            except Exception as e:
                print(f"[WIKI] Translate error: {e}")

        return {
            "title": page.title,
            "extract": extract,
            "url": page.fullurl,
            "thumbnail": {"source": thumbnail_source} if thumbnail_source else None
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Wikipedia API error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch Wikipedia data")


evaluate_speech_tool = types.Tool(
    function_declarations=[
        types.FunctionDeclaration(
            name="evaluateUserSpeech",
            description="Analyzes the user's last Dutch input and determines if it was accurate.",
            parameters=types.Schema(
                type="OBJECT",
                properties={
                    "isUserCorrect": types.Schema(
                        type="BOOLEAN",
                        description="True if the user's last Dutch input was reasonably accurate for their level."
                    )
                },
                required=["isUserCorrect"]
            )
        )
    ]
)

def get_live_config(scenario: str) -> dict:
    voice_name = 'Charon'
    if scenario == 'START_INTRO': voice_name = 'Kore'
    if scenario == 'START_COFFEE': voice_name = 'Erinome'  #Zephr
    if scenario == 'START_FREESPEECH': voice_name = 'Puck'
    if scenario == 'START_COMPREHENSION': voice_name = 'Charon'

    return {
        "response_modalities": ["AUDIO"],
        "speech_config": {
            "voice_config": {
                "prebuilt_voice_config": {
                    "voice_name": voice_name
                }
            }
        },
        "output_audio_transcription": {},
        "input_audio_transcription": {},
        "tools": [evaluate_speech_tool],
        "system_instruction": BASE_SYSTEM_INSTRUCTION + f"\n\nSCENARIO CONTEXT: {SCENARIOS.get(scenario, '')}\nCURRENT SCENARIO: {scenario}. VOICE: {voice_name}. ENSURE YOU CALL evaluateUserSpeech AFTER EVERY TURN."
    }

@app.websocket("/ws")
async def handle_gemini(ws: WebSocket):
    await ws.accept()
    
    try:
        setup_msg = await ws.receive_json()
        if setup_msg.get("type") != "setup":
            await ws.close()
            return

        scenario = setup_msg.get("scenario", "START_INTRO")
        # model = "gemini-2.5-flash-native-audio-preview-12-2025"
        model = "gemini-3.1-flash-live-preview"

        # Debounce: React StrictMode double-mounts and immediately
        # unmounts the first instance. Wait briefly so the phantom
        # connection closes before we spend API quota on Gemini.
        await asyncio.sleep(0.3)
        try:
            # Check if the WebSocket is still alive after debounce
            await ws.send_json({"status": "connecting"})
        except Exception:
            print(f"[WS] Phantom StrictMode connection skipped for {scenario}")
            return

        max_retries = 3
        for attempt in range(1, max_retries + 1):
            try:
                live_config = get_live_config(scenario)

                async with client.aio.live.connect(model=model, config=live_config) as session:
                    print(f"Connected to Gemini for scenario {scenario} (attempt {attempt})")

                    # Trigger the AI greeting
                    start_text = f"Begin nu: {scenario}."
                    await session.send_realtime_input(text=start_text)

                    async def react_to_gemini():
                        try:
                            while True:
                                msg = await ws.receive_json()
                                msg_type = msg.get("type", "")
                                
                                if msg_type == "realtime_input":
                                    input_obj = msg.get("input", {})
                                    
                                    if "text" in input_obj:
                                        await session.send_realtime_input(
                                            text=input_obj["text"]
                                        )
                                        
                                    if "audio" in input_obj:
                                        audio = input_obj["audio"]
                                        import base64
                                        chunk = base64.b64decode(audio["data"])
                                        await session.send_realtime_input(
                                            audio=types.Blob(mime_type=audio["mimeType"], data=chunk)
                                        )

                                elif msg_type == "tool_response":
                                    resps = msg.get("resp", [])
                                    responses_converted = []
                                    for r in resps:
                                        responses_converted.append(types.FunctionResponse(
                                            name=r.get("name", ""),
                                            id=r.get("id", ""),
                                            response=r.get("response", {})
                                        ))
                                    await session.send_tool_response(function_responses=responses_converted)
                                        
                        except WebSocketDisconnect:
                            pass
                        except Exception as e:
                            print(f"Error reading from React: {e}")

                    async def gemini_to_react():
                        import base64
                        try:
                            while True:
                                turn = session.receive()
                                bot_message = ""
                                async for response in turn:
                                    try:
                                        # Log significant events
                                        if response.tool_call:
                                            fn_names = [fc.name for fc in response.tool_call.function_calls] if response.tool_call.function_calls else []
                                            print(f"[Gemini] ToolCall: {fn_names}")
                                        if response.server_content:
                                            if response.server_content.output_transcription:
                                                bot_message += response.server_content.output_transcription.text
                                            if response.server_content.input_transcription:
                                                print(f"[Gemini] User said: {response.server_content.input_transcription.text}")
                                            if response.server_content.interrupted:
                                                print("[Gemini] Interrupted")

                                        data = response.model_dump(by_alias=True, exclude_none=True)
                                        sc = data.get("serverContent") or {}
                                        mt = sc.get("modelTurn") or {}
                                        for part in mt.get("parts") or []:
                                            idata = part.get("inlineData") or {}
                                            if "data" in idata and isinstance(idata["data"], bytes):
                                                idata["data"] = base64.b64encode(idata["data"]).decode("utf-8")
                                        await ws.send_json(data)
                                    except Exception as e:
                                        print(f"Error processing Gemini message: {e}")
                                        import traceback
                                        traceback.print_exc()
                                        
                                if bot_message.strip():
                                    print(f"[Gemini] Bot said: {bot_message.strip()}")
                                print("[Gemini] Turn complete — waiting for next turn")
                        except asyncio.CancelledError:
                            pass
                        except Exception as e:
                            print(f"Error reading from Gemini: {e}")
                            raise  # Re-raise so the retry loop can catch it

                    task1 = asyncio.create_task(react_to_gemini())
                    task2 = asyncio.create_task(gemini_to_react())
                    done, pending = await asyncio.wait([task1, task2], return_when=asyncio.FIRST_COMPLETED)
                    for t in pending:
                        t.cancel()

                    # Check if gemini_to_react failed with a retryable error
                    for t in done:
                        if t.exception():
                            raise t.exception()

                # If we get here cleanly (user disconnected), don't retry
                break

            except (WebSocketDisconnect, asyncio.CancelledError):
                break  # User disconnected, no retry
            except Exception as e:
                error_str = str(e)
                is_retryable = "1008" in error_str or "1011" in error_str
                
                if is_retryable and attempt < max_retries:
                    backoff = attempt * 1.0  # 1s, 2s, 3s
                    print(f"[Gemini] Retryable error (attempt {attempt}/{max_retries}), retrying in {backoff}s: {error_str[:100]}")
                    try:
                        await ws.send_json({"status": "reconnecting", "attempt": attempt})
                    except Exception:
                        break  # Frontend disconnected
                    await asyncio.sleep(backoff)
                else:
                    print(f"[Gemini] Unrecoverable error: {error_str[:200]}")
                    try:
                        await ws.send_json({"error": f"Gemini connection failed: {error_str[:100]}"})
                    except Exception:
                        pass
                    break

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"WebSocket Error: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8080)

'''
Female Voices:
    Aoede: Breezy, warm, and highly conversational.
    Zephyr: Bright, energetic, and perky (mid-range).
    Kore: Firm, youthful, and engaging (mid-to-high pitch).
    Despina: Smooth, inviting, and trustworthy (mid-range).
    Callirrhoe: Easy-going, confident, and articulate (mid-range).
    Laomedeia: Upbeat, intelligent, and friendly (mid-range).
    Pulcherrima: Forward, very upbeat, and youthful (mid-to-high pitch).
    Vindemiatrix: Gentle, mature, calm, and composed (mid-to-low pitch).
    Achird: Friendly, approachable, and slightly inquisitive.
    Autonoe: Bright and clear.
    Erinome: Clear and articulate.
    Leda: Youthful and energetic.
    Sulafat: Warm and persuasive.

Male Voices:
    Charon: Informative, smooth, and assured (mid-to-low pitch).
    Puck: Upbeat, casual, and direct (mid-range).
    Fenrir: Excitable, friendly, and enthusiastic.
    Iapetus: Clear, informal, and highly relatable (mid-pitch).
    Enceladus: Breathy, energetic, and expressive (mid-range).
    Schedar: Even, down-to-earth, and approachable (mid-pitch).
    Sadachbia: Lively, laid-back, with a slight rasp (deeper pitch).
    Zubenelgenubi: Casual, but very deep, resonant, and authoritative.
    Orus: Firm and structured.
    Umbriel: Easy-going and relaxed.
    Algieba: Smooth and polished.
    Algenib: Gravelly and textured.
    Achernar: Soft and measured.
    Gacrux: Mature and grounded.
    Sadaltager: Knowledgeable and instructional.
    Rasalgethi: Informative and clear.
    Alnilam: Firm and direct.
'''