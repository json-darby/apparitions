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
