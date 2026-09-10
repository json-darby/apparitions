"""
The Whisper ("shh") system.

Generates the reply suggestions the player can peek at mid-conversation, plus the
end-of-session review. Mistral is the only model used here — there is deliberately
no fallback to another provider, so a misconfigured or failing Mistral shows up as
a real error rather than being masked by a different model's output.

Failures are reported to the caller instead of being swallowed as an empty list:
returning [] silently was why the SHH panel could sit permanently dead with no
explanation of why.
"""

import os
import json
from typing import List, Optional

from prompts import SCENARIOS

MISTRAL_MODEL = "mistral-medium-latest"
SUGGESTION_COUNT = 3


class WhisperUnavailable(RuntimeError):
    """Raised when Mistral cannot produce a result, so the API can say why."""


def _strip_code_fence(text: str) -> str:
    """LLMs still wrap JSON in markdown fences now and then; peel them off."""
    text = (text or "").strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()


def _coerce_suggestions(payload, limit: Optional[int] = SUGGESTION_COUNT) -> List[dict]:
    """
    Accept the handful of shapes the models actually return — a bare array, or an
    object keyed "suggestions" — and normalise to a list of {dutch, english}.
    """
    if isinstance(payload, dict):
        payload = payload.get("suggestions") or payload.get("replies") or []
    if not isinstance(payload, list):
        return []

    cleaned = []
    for item in payload:
        if not isinstance(item, dict):
            continue
        dutch = (item.get("dutch") or "").strip()
        english = (item.get("english") or "").strip()
        if dutch:
            cleaned.append({"dutch": dutch, "english": english})
    return cleaned[:limit] if limit else cleaned


OBJECT_SHAPE = (
    'Return a JSON object with a single key "suggestions" containing an array of exactly three '
    'objects. Each object must have exactly two properties: "dutch" (the suggestion in Dutch) and '
    '"english" (the suggestion in English). Example:\n        '
    '{"suggestions": [{"dutch": "Hoi", "english": "Hi"}]}'
)



def _build_suggestion_prompt(bot_transcript: str, scenario: str, chat_history: Optional[list]) -> str:
    scenario_context = SCENARIOS.get(scenario, "")

    history_block = ""
    if chat_history:
        lines = "\n".join(
            f"{str(m.get('sender', 'unknown')).upper()}: {m.get('text', '')}"
            for m in chat_history
        )
        history_block = f"\n        Conversation History:\n        {lines}\n"

    return f"""You are generating reply suggestions for the human player in a Dutch learning game.
        The human player is talking to an AI bot.
        AI Bot Persona: {scenario_context}
{history_block}
        The AI Bot just said: "{bot_transcript}"

        Suggest {SUGGESTION_COUNT} short, natural replies in Dutch that the HUMAN PLAYER could say next to the AI Bot.

        CRITICAL REQUIREMENTS:
        - The suggestions MUST range from CEFR Level A1 (Beginner) to A2 (Elementary). Keep vocabulary relatively simple but offer a mix of very basic and slightly more advanced conversational replies.
        - Provide a variety of options (e.g., one short statement, one question, etc.).

        {OBJECT_SHAPE}"""


'''
   _____  .__          __                .__
  /     \\ |__| _______/  |_____________  |  |
 /  \\ /  \\|  |/  ___/\\   __\\_  __ \\__  \\ |  |
/    Y    \\  |\\___ \\  |  |  |  | \\// __ \\|  |__
\\____|__  /__/____  > |__|  |__|  (____  /____/
        \\/        \\/                   \\/
'''


def _mistral_json(prompt: str) -> str:
    """Single Mistral JSON call. Raises when the provider is unavailable."""
    from mistralai import Mistral

    api_key = os.getenv("WHISPER_SYSTEM_MISTRAL")
    if not api_key:
        raise RuntimeError("no Mistral API key (WHISPER_SYSTEM_MISTRAL)")

    client = Mistral(api_key=api_key)
    response = client.chat.complete(
        model=MISTRAL_MODEL,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        temperature=0.7,
    )
    return response.choices[0].message.content


def get_whisper_suggestions(
    bot_transcript: str,
    model: int = 2,
    scenario: str = "START_INTRO",
    chat_history: Optional[list] = None,
) -> List[dict]:
    """
    Generate reply suggestions with Mistral.

    `model` is accepted for backwards compatibility with the existing API payload
    but is ignored: Mistral is the only provider.

    Raises WhisperUnavailable if Mistral cannot answer, so the endpoint can return a
    real error instead of an empty list that looks like "no suggestions".
    """
    if not bot_transcript or not bot_transcript.strip():
        return []

    prompt = _build_suggestion_prompt(bot_transcript, scenario, chat_history)

    try:
        raw = _mistral_json(prompt)
    except Exception as e:
        raise WhisperUnavailable(f"Mistral request failed: {e}") from e

    try:
        suggestions = _coerce_suggestions(json.loads(_strip_code_fence(raw)))
    except (ValueError, TypeError) as e:
        raise WhisperUnavailable(f"Mistral returned unreadable JSON: {e}") from e

    if not suggestions:
        raise WhisperUnavailable("Mistral returned no usable suggestions.")

    return suggestions


def generate_conversation_review(chat_history: list, scenario: str) -> dict:
    """End-of-session grammar review of the *user's* lines, in English."""
    if not chat_history:
        return {"error": "No conversation history provided."}

    if not any(m.get("sender") == "user" for m in chat_history):
        return {"error": "No user messages to review."}

    history_text = "\n".join(
        f"{'APPARITION' if m.get('sender') != 'user' else 'USER'}: {m.get('text', '')}"
        for m in chat_history
    )

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
        raw = _mistral_json(prompt)
    except Exception as e:
        message = f"Mistral request failed: {e}"
        print(f"[Review] {message}")
        return {"error": message}

    try:
        data = json.loads(_strip_code_fence(raw))
    except ValueError as e:
        message = f"Mistral returned unreadable JSON: {e}"
        print(f"[Review] {message}")
        return {"error": message}

    if not isinstance(data, dict) or not data.get("summary"):
        print("[Review] Mistral response contained no summary.")
        return {"error": "The review came back empty. Try again."}

    data["topic_suggestions"] = _coerce_suggestions(data.get("topic_suggestions") or [], limit=None)
    return data
