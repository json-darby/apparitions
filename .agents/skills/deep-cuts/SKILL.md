---
name: deep-cuts
description: A living catalogue of hard-won debugging fixes and non-obvious pitfalls encountered in the Apparitions codebase.
---

# Deep Cuts

This skill documents subtle, difficult-to-diagnose bugs and their resolutions. Each entry details the **symptom**, **root cause**, and **fix** so they are never repeated.

---

## 1. React Strict Mode & Mutable Refs Inside State Updaters

**Symptom:** A state array (e.g. a FIFO queue) appears to populate correctly on the first pass of a `setState` updater function, but is immediately emptied on the second pass. Console logs show the queue growing to `N` items and then snapping back to `0`.

**Root Cause:** React's Strict Mode (active in development) intentionally invokes state updater functions **twice** to detect impure side effects. If a mutable `useRef` (e.g. a `Set` tracking "seen" IDs) is modified *inside* the updater callback, the first invocation mutates the ref, and the second invocation—starting from the **same original `prev` state**—finds the ref already mutated, preventing any items from being added.

```tsx
// ❌ BROKEN: Mutating a ref inside the state updater
setQueue(prev => {
    const updated = [...prev];
    items.forEach(item => {
        if (!seenRef.current.has(item.id)) {
            seenRef.current.add(item.id); // Mutates on pass 1; pass 2 sees it already added
            updated.push(item);
        }
    });
    return updated; // Pass 2 returns an empty array
});
```

**Fix:** Perform all filtering and ref mutation **before** calling the state updater. The updater should be a pure function of `prev` with no external side effects.

```tsx
// ✅ CORRECT: Filter and mutate ref BEFORE the updater
const newItems = items.filter(item => !seenRef.current.has(item.id));
newItems.forEach(item => seenRef.current.add(item.id));

setQueue(prev => {
    const currentIds = new Set(prev.map(i => i.id));
    const toAdd = newItems.filter(item => !currentIds.has(item.id));
    return [...prev, ...toAdd];
});
```

**Key Principle:** Never mutate a `useRef` or any external mutable state inside a `setState` updater function. Treat updaters as pure functions of `prev`.

---

## 2. Gemini Live API — `session.receive()` Exits After One Turn

**Symptom:** The Gemini Live session connects, the bot speaks its greeting, then the WebSocket immediately closes. The backend logs show `Connected to Gemini` followed instantly by `connection closed`.

**Root Cause:** The Python SDK's `session.receive()` is an async iterator that **breaks after `turn_complete`** (see `live.py` line 455–457). If you use a flat `async for response in session.receive():` loop, it exhausts after the first turn. With `asyncio.wait(FIRST_COMPLETED)`, the receive task completes, which cancels all other tasks and kills the session.

```python
# ❌ BROKEN: Exits after the first turn
async for response in session.receive():
    process(response)
# Function returns here → FIRST_COMPLETED fires → everything cancelled
```

**Fix:** Wrap `session.receive()` in a `while True` loop, exactly as shown in the [official Gemini Live API docs](https://ai.google.dev/gemini-api/docs/live.md.txt):

```python
# ✅ CORRECT: Survives across multiple turns
while True:
    turn = session.receive()
    async for response in turn:
        process(response)
    # Turn complete — loop back to wait for next turn
```

---

## 3. Gemini Live API — Echo Feedback Loop (Bot Talks to Itself)

**Symptom:** The bot speaks its greeting, then immediately starts responding to itself in a loop. The terminal shows rapid-fire audio chunks and the session eventually crashes with `1008 policy violation`.

**Root Cause:** When the frontend streams mic audio to Gemini in "instant" mode, it sends audio **continuously** — including while the bot is speaking through the speakers. The mic picks up the bot's own audio output, Gemini's server-side VAD interprets it as user speech, and the bot responds to itself.

**Fix:** In the `onaudioprocess` callback, check if the bot is currently playing audio and skip sending mic data while it is:

```typescript
const botPlaying = outputAudioCtxRef.current
  ? nextStartTimeRef.current > outputAudioCtxRef.current.currentTime
  : false;

if (responseModeRef.current === 'instant' && activeSession && !botPlaying) {
  activeSession.sendRealtimeInput({ audio: createBlob(inputData) });
}
```

**Key Principle:** Always mute the mic stream while the bot is speaking, or use headphones. The Gemini skill doc itself warns: "Use headphones when testing mic audio to prevent echo/self-interruption."

---

## 4. Gemini Live API — Dict Config vs Typed `LiveConnectConfig` (1008 Crash)

**Symptom:** The Gemini Live session connects, the bot begins to speak, then crashes mid-sentence with `1008 None. Operation is not implemented, or supported, or enabled.`

**Root Cause:** Using typed SDK objects like `types.LiveConnectConfig(...)` with `types.AudioTranscriptionConfig()` causes the SDK (v1.65.0) to serialise the setup message in a way the API server rejects. The exact failure point is the combination of native audio model + transcription + tools.

```python
# ❌ BROKEN: Typed config causes 1008 mid-sentence
config = types.LiveConnectConfig(
    response_modalities=[types.Modality.AUDIO],
    output_audio_transcription=types.AudioTranscriptionConfig(),
    ...
)
```

**Fix:** Use a plain **dict config** matching the exact format from the [official Gemini docs](https://ai.google.dev/gemini-api/docs/live-guide.md.txt). The `connect()` method accepts dicts directly:

```python
# ✅ CORRECT: Dict config works reliably
config = {
    "response_modalities": ["AUDIO"],
    "output_audio_transcription": {},
    "input_audio_transcription": {},
    "speech_config": { "voice_config": { "prebuilt_voice_config": { "voice_name": "Kore" } } },
    "tools": [provide_suggestions_tool],
    "system_instruction": "Your system prompt as a plain string"
}
```

**Key Principle:** When using preview/native-audio Gemini models, prefer dict-based configs over typed SDK objects. The SDK's Pydantic serialisation can produce subtly different wire formats that the server rejects for newer features.

---

## General Guidelines

- **Always suspect Strict Mode** when state appears to "reset" immediately after being set in development. Test with `React.StrictMode` removed temporarily to confirm.
- **Refs are not React state.** They are mutable escape hatches. Mutating them inside render-phase or updater callbacks creates subtle, Strict-Mode-only bugs that vanish in production builds, making them extremely difficult to reproduce.
- **Gemini Live API:** Always use `while True` around `session.receive()`. Always mute the mic while the bot speaks. Prefer dict configs over typed `LiveConnectConfig` for native-audio models. Add a 300ms debounce after WebSocket accept to skip React StrictMode phantom connections (prevents double API quota usage). Wrap Gemini sessions in retry loops with backoff for intermittent 1008/1011 errors.
- **Use British English** in all comments, documentation, and variable naming where semantically appropriate (e.g. `colour`, `behaviour`, `serialise`).
