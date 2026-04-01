<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Apparitions

A nocturnal, brutalist Dutch language-learning engine built on real-time geospatial data from the Netherlands.

## About

Apparitions drops you into a pitch-black 3D rendering of Dutch cities — powered by deck.gl, the TU Delft 3D BAG, and live transit feeds — and teaches you the language through cinematic roleplay with AI-driven conversation partners. Vocabulary is woven directly into the architecture: hover over a building, click a ghostlike tram, intercept a live emergency dispatch. Every interaction is a lesson.

The application features real-time voice conversation via the Gemini Live API, a structured lesson engine, comprehension games, and a live P2000 emergency radar overlay across five Dutch cities.

## Tech Stack

- **Frontend** — React · TypeScript · Vite · deck.gl · Framer Motion · GSAP
- **Backend** — Python · FastAPI · Google Generative AI · WebSockets
- **Data Sources** — TU Delft 3D BAG · OVAPI (Dutch public transport) · PDOK · P2000 emergency feed · Open-Meteo

## Getting Started

### Prerequisites

- Node.js (v18+)
- Python 3.10+

### Frontend

```bash
npm install
npm run dev
```

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8080
```

### Environment Variables

Create a `.env.local` file in the project root with the following keys:

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Google Gemini API key (primary) |
| `WHISPER_SYSTEM_GEMINI` | Gemini key for the Whisper suggestion system |
| `WHISPER_SYSTEM_MISTRAL` | Mistral key for the Whisper suggestion system |
| `APPARITIONS_LESSON_KEY` | Gemini key for the lesson engine |
| `APPARITIONS_LESSON_KEY_MISTRAL` | Mistral key for the lesson engine |

## Licence

All rights reserved.
