import os
import json
from google import genai
from google.genai import types
from prompts import SCENARIOS

def get_whisper_suggestions(bot_transcript: str, model: int = 2, scenario: str = "START_INTRO", chat_history: list = None) -> list:
    """
    Main entry point for generating Whisper suggestions.
    model = 1 (Google)
    model = 2 (Mistral)
    model = 3 (Groq)
    """
    if not bot_transcript or not bot_transcript.strip():
        return []
        
    if model == 1:
        return _google_whisper(bot_transcript, scenario, chat_history)
    elif model == 2:
        return _mistral_whisper(bot_transcript, scenario, chat_history)
    elif model == 3:
        return _groq_whisper(bot_transcript, scenario, chat_history)
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
def _google_whisper(bot_transcript: str, scenario: str, chat_history: list = None) -> list:
    api_key = os.getenv("WHISPER_SYSTEM_GEMINI")
    if not api_key:
        print("Warning: WHISPER_SYSTEM_GEMINI not set")
        return []
        
    client = genai.Client(api_key=api_key)
    scenario_context = SCENARIOS.get(scenario, "")
    
    if chat_history and len(chat_history) > 0:
        history_text = "\n".join([f"{m.get('sender', 'unknown').upper()}: {m.get('text', '')}" for m in chat_history])
        prompt = f"""You are generating reply suggestions for the human player in a Dutch learning game.
        The human player is talking to an AI bot.
        AI Bot Persona: {scenario_context}

        Conversation History:
        {history_text}

        The AI Bot just said: "{bot_transcript}"

        Read this conversation history and suggest 3 short, natural replies in Dutch that the HUMAN PLAYER could say next to the AI Bot.
        
        CRITICAL REQUIREMENTS:
        - The suggestions MUST range from CEFR Level A1 (Beginner) to A2 (Elementary). Keep vocabulary relatively simple but offer a mix of very basic and slightly more advanced conversational replies.
        - Provide a variety of options (e.g., one short statement, one question, etc.).

        Return ONLY a JSON array of objects with exactly two properties: "dutch" (the suggestion translated to Dutch) and "english" (the suggestion in English). Never include markdown formatting or reasoning. Example:
        [{{"dutch": "Hoi", "english": "Hi"}}, ...]"""
    else:
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
def _mistral_whisper(bot_transcript: str, scenario: str, chat_history: list = None) -> list:
    from mistralai import Mistral
    
    api_key = os.getenv("WHISPER_SYSTEM_MISTRAL")
    if not api_key:
        print("Warning: WHISPER_SYSTEM_MISTRAL not set")
        return []
        
    client = Mistral(api_key=api_key)
    scenario_context = SCENARIOS.get(scenario, "")
    
    if chat_history and len(chat_history) > 0:
        history_text = "\n".join([f"{m.get('sender', 'unknown').upper()}: {m.get('text', '')}" for m in chat_history])
        prompt = f"""You are generating reply suggestions for the human player in a Dutch learning game.
        The human player is talking to an AI bot.
        AI Bot Persona: {scenario_context}

        Conversation History:
        {history_text}

        The AI Bot just said: "{bot_transcript}"

        Read this conversation history and suggest 3 short, natural replies in Dutch that the HUMAN PLAYER could say next to the AI Bot.
        
        CRITICAL REQUIREMENTS:
        - The suggestions MUST range from CEFR Level A1 (Beginner) to A2 (Elementary). Keep vocabulary relatively simple but offer a mix of very basic and slightly more advanced conversational replies.
        - Provide a variety of options (e.g., one short statement, one question, etc.).

        Return a JSON object with a single key "suggestions" that contains an array of exactly three objects. Each object must have exactly two properties: "dutch" (the suggestion translated to Dutch) and "english" (the suggestion in English). Example:
        {{"suggestions": [{{"dutch": "Hoi", "english": "Hi"}}]}}"""
    else:
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

def generate_conversation_review(chat_history: list, scenario: str) -> dict:
    from mistralai import Mistral
    
    if not chat_history:
        return {"error": "No conversation history provided."}
        
    api_key = os.getenv("WHISPER_SYSTEM_MISTRAL")
    if not api_key:
        return {"error": "Missing WHISPER_SYSTEM_MISTRAL API key for review."}
        
    client = Mistral(api_key=api_key)
    
    # Filter to only user messages to ensure we have something to review
    user_messages = [m for m in chat_history if m.get("sender") == "user"]
    if not user_messages:
         return {"error": "No user messages to review."}
         
    # Pass the full conversational context (both bot and user) to the AI
    history_text = "\n".join([f"{'APPARITION' if m.get('sender') == 'bot' else 'USER'}: {m.get('text', '')}" for m in chat_history])
    
    prompt = f"""You are a gentle, encouraging Dutch language tutor evaluating a student's conversation.
    Below is the full transcript of the conversation between the student (USER) and the AI (APPARITION).
    
    Conversation History:
    {history_text}
    
    CRITICAL WARNING: The transcript contains lines from both the AI (APPARITION) and the human student (USER). You MUST ONLY evaluate the lines spoken by the USER. Do NOT praise or review the sentences spoken by the APPARITION.
    
    TASK 1: Write a concise 1-2 paragraph summary in ENGLISH reviewing the USER's performance in the conversation.
    - The entire summary MUST be written in English.
    - When quoting or correcting Dutch phrases, clearly use the Dutch language.
    - IGNORE commas, full stops, or minor punctuation details. 
    - Focus strictly on noticeable grammatical trends and alternative ways to say things natively. 
    - E.g., "You did great ordering coffee, but a native person would say this...".
    
    TASK 2: Based on the conversational context, suggest 3-4 entirely new phrases that the USER could have used or could say next to naturally continue their specific situation.
    
    CRITICAL REQUIREMENTS:
    - Return ONLY a JSON object with exactly two keys: "summary" and "topic_suggestions".
    - "summary" should be a single string containing your 1-2 paragraph review (you can use '\\n\\n' to separate the paragraphs).
    - "topic_suggestions" should be an array of objects. Each object must have:
      - "dutch" (the suggested phrase)
      - "english" (the translation)
    """

    try:
        response = client.chat.complete(
            model="mistral-large-latest",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.7
        )
        
        raw_output = response.choices[0].message.content
        
        if raw_output.startswith("```json"):
            raw_output = raw_output[7:-3].strip()
        elif raw_output.startswith("```"):
            raw_output = raw_output[3:-3].strip()
            
        data = json.loads(raw_output)
        return data
        
    except Exception as e:
        print(f"Review Error: {e}")
        return {"error": str(e)}

'''
  ________                     
 /  _____/______  ____   ______
/   \  __\_  __ \/  _ \ / ____/
\    \_\  \  | \(  <_> < <_|  |
 \______  /__|   \____/ \__   |
        \/                 |__|
'''
def _groq_whisper(bot_transcript: str, scenario: str, chat_history: list = None) -> list:
    pass