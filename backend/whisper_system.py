import os
import json
from google import genai
from google.genai import types
from prompts import SCENARIOS

def get_whisper_suggestions(bot_transcript: str, model: int = 2, scenario: str = "START_INTRO") -> list:
    """
    Main entry point for generating Whisper suggestions.
    model = 1 (Google)
    model = 2 (Mistral)
    model = 3 (Groq)
    """
    if not bot_transcript or not bot_transcript.strip():
        return []
        
    if model == 1:
        return _google_whisper(bot_transcript, scenario)
    elif model == 2:
        return _mistral_whisper(bot_transcript, scenario)
    elif model == 3:
        return _groq_whisper(bot_transcript, scenario)
    else:
        return []

'''
  ________                     .__          
 /  _____/  ____   ____   ____ |  |   ____  
/   \  ___ /  _ \ /  _ \ / ___\|  | _/ __ \ 
\    \_\  (  <_> |  <_> ) /_/  >  |_\  ___/ 
 \______  /\____/ \____/\___  /|____/\___  >
        \/             /_____/           \/ 
'''
def _google_whisper(bot_transcript: str, scenario: str) -> list:
    api_key = os.getenv("WHISPER_SYSTEM_GEMINI")
    if not api_key:
        print("Warning: WHISPER_SYSTEM_GEMINI not set")
        return []
        
    client = genai.Client(api_key=api_key)
    scenario_context = SCENARIOS.get(scenario, "")
    
    prompt = f"""You are generating reply suggestions for the human player in a Dutch learning game.
    The human player is talking to an AI bot.
    AI Bot Persona: {scenario_context}

    The AI Bot just said: "{bot_transcript}"

    Suggest 3 short, natural replies in Dutch that the HUMAN PLAYER could say next to the AI Bot.
    
    CRITICAL REQUIREMENTS:
    - The suggestions MUST range from CEFR Level A1 (Beginner) to A2 (Elementary). Keep vocabulary relatively simple but offer a mix of very basic and slightly more advanced conversational replies.
    - Provide a variety of options (e.g., one short statement, one question, etc.).

    Return ONLY a JSON array of objects with exactly two properties: "dutch" (the suggestion translated to Dutch) and "english" (the suggestion in English). Never include markdown formatting or reasoning. Example:
    [{{"dutch": "Hoi", "english": "Hi"}}, ...]"""

    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.7,
            )
        )
        
        text = response.text or "[]"
        if text.startswith("```json"):
            text = text[7:-3].strip()
        elif text.startswith("```"):
            text = text[3:-3].strip()
            
        suggestions = json.loads(text)
        return suggestions[:3]
    except Exception as e:
        print(f"Google Whisper Error: {e}")
        return []

'''
   _____  .__          __                .__   
  /     \ |__| _______/  |_____________  |  |  
 /  \ /  \|  |/  ___/\   __\_  __ \__  \ |  |  
/    Y    \  |\___ \  |  |  |  | \// __ \|  |__
\____|__  /__/____  > |__|  |__|  (____  /____/
        \/        \/                   \/
'''
def _mistral_whisper(bot_transcript: str, scenario: str) -> list:
    from mistralai import Mistral
    
    api_key = os.getenv("WHISPER_SYSTEM_MISTRAL")
    if not api_key:
        print("Warning: WHISPER_SYSTEM_MISTRAL not set")
        return []
        
    client = Mistral(api_key=api_key)
    scenario_context = SCENARIOS.get(scenario, "")
    
    prompt = f"""You are generating reply suggestions for the human player in a Dutch learning game.
    The human player is talking to an AI bot.
    AI Bot Persona: {scenario_context}

    The AI Bot just said: "{bot_transcript}"

    Suggest 3 short, natural replies in Dutch that the HUMAN PLAYER could say next to the AI Bot.
    
    CRITICAL REQUIREMENTS:
    - The suggestions MUST range from CEFR Level A1 (Beginner) to A2 (Elementary). Keep vocabulary relatively simple but offer a mix of very basic and slightly more advanced conversational replies.
    - Provide a variety of options (e.g., one short statement, one question, etc.).

    Return a JSON object with a single key "suggestions" that contains an array of exactly three objects. Each object must have exactly two properties: "dutch" (the suggestion translated to Dutch) and "english" (the suggestion in English). Example:
    {{"suggestions": [{{"dutch": "Hoi", "english": "Hi"}}]}}"""
    
    try:
        response = client.chat.complete(
            model="mistral-large-latest",
            messages=[
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"}
        )
        
        raw_output = response.choices[0].message.content
        
        if raw_output.startswith("```json"):
            raw_output = raw_output[7:-3].strip()
        elif raw_output.startswith("```"):
            raw_output = raw_output[3:-3].strip()
            
        data = json.loads(raw_output)
        suggestions = data.get("suggestions", [])
        
        return suggestions[:3]
        
    except Exception as e:
        print(f"Mistral Whisper Error: {e}")
        return []

'''
  ________                     
 /  _____/______  ____   ______
/   \  __\_  __ \/  _ \ / ____/
\    \_\  \  | \(  <_> < <_|  |
 \______  /__|   \____/ \__   |
        \/                 |__|
'''
def _groq_whisper(bot_transcript: str, scenario: str) -> list:
    pass
