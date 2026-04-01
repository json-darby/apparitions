FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM python:3.10-slim
WORKDIR /app

# Install system dependencies needed for geos, shapefiles, etc.
RUN apt-get update && apt-get install -y \
    build-essential \
    libgeos-dev \
    libproj-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy python backend requirements
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Smoke-test: verify every critical import resolves at BUILD time
# If anything is missing, Docker fails here — not on Cloud Run
RUN python -c "\
import nest_asyncio; \
from llama_index.core import VectorStoreIndex; \
from llama_index.llms.mistralai import MistralAI; \
from llama_index.embeddings.mistralai import MistralAIEmbedding; \
import argostranslate.translate; \
import edge_tts; \
import wikipediaapi; \
from google import genai; \
import httpx; \
print('All imports verified OK')"

# Copy source code
COPY backend/ backend/
COPY public/ public/

# Copy built frontend
COPY --from=frontend-builder /app/dist ./dist

# Run argos setup script to pre-download language models
RUN python backend/setup_argos.py

# Expose port (Cloud Run defaults to 8080)
EXPOSE 8080

# Run FastAPI from the backend directory
WORKDIR /app/backend
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
