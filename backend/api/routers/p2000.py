import httpx
import re
import time
from datetime import datetime, timedelta
import os
import json
import hashlib
import traceback
from fastapi import APIRouter
from bs4 import BeautifulSoup

router = APIRouter()
radar_cache = {"timestamp": 0, "incidents": []}

QUEUE_FILE = "active_intercepts.json"

def read_queue() -> list:
    """Reads the current active array of incidents from the JSON file."""
    try:
        if not os.path.exists(QUEUE_FILE):
            return []
        with open(QUEUE_FILE, "r", encoding="utf-8") as file:
            return json.load(file)
    except Exception as e:
        print(f"Failed to read queue: {e}")
        return []

def write_queue(incidents: list):
    """Writes the array of incidents directly to the JSON file."""
    try:
        with open(QUEUE_FILE, "w", encoding="utf-8") as file:
            json.dump(incidents, file, indent=2)
    except Exception as e:
        print(f"Failed to write queue: {e}")

def is_already_queued(incident_id: str, history=None) -> bool:
    """Checks if the incident ID is already in the active queue."""
    q = history if history is not None else read_queue()
    for inc in q:
        if inc.get("id") == incident_id:
            return True
    return False

def parse_agency_and_color(text_lower: str):
    """Maps the Dutch keywords to their respective agencies and RGB colours."""
    if "politie" in text_lower or "pd" in text_lower:
        return "POLICE", [220, 38, 38, 255]
    elif "ambu" in text_lower:
        return "AMBULANCE", [59, 130, 246, 255]
    elif "brandweer" in text_lower:
        return "FIRE", [234, 88, 12, 255]
    elif "lifeliner" in text_lower or "traumaheli" in text_lower:
        return "TRAUMA", [234, 179, 8, 255]
    return None, [100, 100, 100, 255]

async def geocode_address(address_text: str) -> dict:
    """Geocode an address using the PDOK Locatieserver API. Uses proper params encoding."""
    url = "https://api.pdok.nl/bzk/locatieserver/search/v3_1/free"
    # Append ', Nederland' to improve PDOK results
    query = f"{address_text}, Nederland"
    params = {"q": query, "rows": 1}
    # print(f"[P2000] Geocoding request to PDOK: {address_text}")
    async with httpx.AsyncClient(verify=False) as client:
        try:
            response = await client.get(url, params=params, timeout=10.0)
            if response.status_code == 200:
                docs = response.json().get("response", {}).get("docs", [])
                if docs:
                    # centroide_ll is typically "POINT(lon lat)"
                    coords = re.findall(r"[-+]?\d*\.\d+|\d+", docs[0].get("centroide_ll", ""))
                    if len(coords) == 2:
                        return {"lon": float(coords[0]), "lat": float(coords[1])}
                else:
                    print(f"[P2000] PDOK: No results for '{address_text}'")
            else:
                print(f"[P2000] PDOK Error {response.status_code} for '{address_text}'")
        except Exception as e:
            print(f"[P2000] Geocoding exception: {e}")
    return None

def clean_alert_text(raw_text: str) -> str:
    """Clean alert text by removing ride numbers, capcodes, timestamps and dates."""
    # Remove ride numbers (e.g., "Rit 12345")
    text = re.sub(r'\bRit\s+\d+\b', '', raw_text, flags=re.IGNORECASE)
    # Remove standalone 5+ digit numbers (capcodes)
    text = re.sub(r'\b\d{5,}\b', '', text)
    # Remove priority prefixes (A1, A2, B1, etc.)
    text = re.sub(r'\b[AB][12]\b', '', text, flags=re.IGNORECASE)
    # Remove "Prio 1" or "Prio 2"
    text = re.sub(r'\bPrio\s+[12]\b', '', text, flags=re.IGNORECASE)
    # Remove timestamps (HH:mm:ss or HH:mm)
    text = re.sub(r'\b\d{1,2}:\d{2}(:\d{2})?\b', '', text)
    # Remove dates (DD-MM-YYYY)
    text = re.sub(r'\b\d{2}-\d{2}-\d{4}\b', '', text)
    # Clean up extra whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    return text

@router.get("/radar")
async def get_emergency_radar():
    """
    Scrape P2000 emergency alerts from www.p2000.net.
    Filters out alerts older than 10 minutes from current system time.
    Returns JSON payload with geocoded incidents and explicit isPrio1 flags.
    """
    current_time = time.time()
    
    # 5 second cache for high reactivity
    if current_time - radar_cache["timestamp"] < 5:
        return {"incidents": radar_cache["incidents"]}

    incidents = []
    now = datetime.now()
    
    try:
        category_counts = {"POLICE": 0, "AMBULANCE": 0, "FIRE": 0, "TRAUMA": 0}
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7"
        }
        async with httpx.AsyncClient(verify=False, follow_redirects=True, timeout=30.0) as client:
            res = await client.get("https://www.p2000.net/", headers=headers)
            print(f"[P2000] Response Status: {res.status_code}, Length: {len(res.text)}")
            res.raise_for_status()
            
            soup = BeautifulSoup(res.text, 'html.parser')
            
            # Handle multiple potential site layouts (A/B testing or environment-specific)
            # Layout A: div.flex.items-start.p-4
            # Layout B: div.message-item or div.message-card
            selectors = [
                ('div', {'class': lambda c: c and 'flex' in c and 'items-start' in c and 'p-4' in c}),
                ('div', {'class': 'message-item'}),
                ('div', {'class': 'message-card'})
            ]
            
            alert_containers = []
            for tag, attrs in selectors:
                found = soup.find_all(tag, **attrs)
                if found:
                    alert_containers.extend(found)
            
            print(f"[P2000] Found {len(alert_containers)} potential alert containers.")
            
            for container in alert_containers:
                title_elem = container.find('h3')
                body_elem = container.find('p')
                time_span = container.find('span', attrs={"title": True}) # Absolute time is in title attr (Layout A)
                
                if not title_elem:
                    continue
                    
                title_text = title_elem.get_text(strip=True)
                body_text = body_elem.get_text(strip=True) if body_elem else ""
                
                # Use absolute all text from container to catch agency/service spans
                raw_text = container.get_text(separator=" ", strip=True)
                
                # Extract time
                extracted_time = None
                
                # Try Layout A: Title attribute (e.g. "08-03-2026 21:45:28")
                if time_span:
                    time_str = time_span['title']
                    try:
                        extracted_time = datetime.strptime(time_str, "%d-%m-%Y %H:%M:%S")
                    except:
                        pass
                
                # Try Layout B or Fallback: Regex in text
                if not extracted_time:
                    # Look for HH:mm:ss or HH:mm
                    time_match = re.search(r'\b([0-2]?[0-9]):([0-5][0-9])(?::([0-5][0-9]))?\b', container.get_text())
                    if time_match:
                        hour, minute = int(time_match.group(1)), int(time_match.group(2))
                        second = int(time_match.group(3)) if time_match.group(3) else 0
                        extracted_time = now.replace(hour=hour, minute=minute, second=second, microsecond=0)
                
                if not extracted_time:
                    continue

                # Timezone and rollover handling
                diff_seconds = (extracted_time - now).total_seconds()
                if diff_seconds > 1800:
                    offset_hours = round(diff_seconds / 3600)
                    extracted_time -= timedelta(hours=offset_hours)
                
                if (extracted_time - now).total_seconds() > 3600:
                    extracted_time = extracted_time - timedelta(days=1)
                elif (now - extracted_time).total_seconds() < -60:
                     extracted_time = now
                
                age_delta = now - extracted_time
                if age_delta > timedelta(minutes=5): # Strict 5-minute window for queue ingestion
                    continue
                
                text_lower = raw_text.lower()
                agency, color = parse_agency_and_color(text_lower)
                if not agency:
                    continue
                
                # Priority 1 detection
                prio_keywords = ["a1", "p1", "prio 1", "prio1", "spoed", "noodgeval", "urgent", "urgente", "levensgevaar"]
                is_prio_1 = any(k in text_lower for k in prio_keywords)
                
                cleaned_text = clean_alert_text(raw_text)
                alert_timestamp = extracted_time.timestamp()
                id_basis = (cleaned_text + str(int(alert_timestamp))).encode('utf-8')
                incident_id = hashlib.md5(id_basis).hexdigest()
                
                # Check for agency in the combined text
                agency, color = parse_agency_and_color(text_lower)
                if not agency:
                    continue
                
                # Only process geocoding and queueing for Priority 1 alerts
                if is_prio_1:
                    # Clean address guess: remove time/date/prio from end
                    words = cleaned_text.split()
                    addr_words = [w for w in words if w.upper() not in ["PRIO", "1", "2", "3"]]
                    address_guess = " ".join(addr_words[-5:]) if addr_words else "Amsterdam"
                    
                    coords = await geocode_address(address_guess)
                    
                    if coords:
                        inc_obj = {
                            "id": incident_id,
                            "text": cleaned_text,
                            "rawText": raw_text,
                            "agency": agency,
                            "color": color,
                            "isPrio1": is_prio_1,
                            "longitude": coords["lon"],
                            "latitude": coords["lat"],
                            "timestamp": alert_timestamp,
                            "ageMinutes": age_delta.total_seconds() / 60
                        }
                        
                        current_queue = read_queue()
                        if not is_already_queued(incident_id, current_queue):
                            current_queue.append(inc_obj)
                            write_queue(current_queue)
                        
                        # Only count geocoded Prio 1s
                        if agency in category_counts:
                            category_counts[agency] += 1
                        
                        incidents.append(inc_obj)
                    
        radar_cache["incidents"] = incidents
        radar_cache["timestamp"] = current_time
        
        # Print API-like summary to terminal
        print(f"\n[P2000 SCRAPER] Webscraping completed at {datetime.now().strftime('%H:%M:%S')}")
        print(f"  --> POLICE:    {category_counts.get('POLICE', 0)}")
        print(f"  --> AMBULANCE: {category_counts.get('AMBULANCE', 0)}")
        print(f"  --> FIRE:      {category_counts.get('FIRE', 0)}")
        print(f"  --> TRAUMA:    {category_counts.get('TRAUMA', 0)}")
        print(f"  --> GEOCODED:  {len(incidents)}\n")
        
        return {"incidents": incidents}
        
    except Exception as e:
        print(f"[P2000] Scraper Error: {e}")
        traceback.print_exc()
        return {"incidents": radar_cache["incidents"]}

@router.get("/queue")
async def get_active_queue():
    """Returns the current queue of active incidents directly from the JSON file."""
    # First, trigger a scrape to ensure the file acts as a source of truth
    await get_emergency_radar()
    queue = read_queue()
    # Sort with Prio 1 at the top, and then chronologically
    queue.sort(key=lambda x: (not x.get("isPrio1", False), x.get("timestamp", 0)))
    return {"queue": queue}

@router.delete("/queue/{incident_id}")
async def delete_queued_incident(incident_id: str):
    """Removes a specific incident from the JSON file queue."""
    queue = read_queue()
    initial_length = len(queue)
    queue = [inc for inc in queue if inc.get("id") != incident_id]
    
    if len(queue) < initial_length:
        write_queue(queue)
        print(f"[P2000] Deleted incident {incident_id} from queue.")
        return {"status": "success", "deleted": True}
    return {"status": "not_found", "deleted": False}

@router.delete("/queue")
async def clear_queue():
    """Clears the entire JSON file queue (used on app close/unmount)."""
    write_queue([])
    print("[P2000] Cleared all incidents from queue.")
    return {"status": "success", "cleared": True}
