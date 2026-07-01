# Stage 1: Build React Frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Create Python runtime for FastAPI
FROM python:3.12-slim
WORKDIR /app

# Copy backend requirements list
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend source code
COPY backend/ ./backend

# Copy React production build from Stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Create local directories for uploads
RUN mkdir -p /app/backend/uploads

# Expose the API and Chat server port
EXPOSE 8000

# Run FastAPI backend using Uvicorn
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
