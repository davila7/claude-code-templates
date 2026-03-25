# FastAPI Deployment

Basic production deployment setup for FastAPI applications.

## Usage

```bash
# Run with Uvicorn
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4

# Docker deployment
docker build -t fastapi-app .
docker run -p 8000:8000 fastapi-app
```

## Production Configuration

```python
# app/core/config.py
from pydantic import BaseSettings
import os

class Settings(BaseSettings):
    """Production settings."""
    
    # App
    PROJECT_NAME: str = "FastAPI App"
    VERSION: str = "1.0.0"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "dev-key")
    
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    WORKERS: int = 4
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./app.db")
    
    # Redis
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379")
    
    class Config:
        env_file = ".env"

settings = Settings()
```

## Docker Setup

```dockerfile
# Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app
COPY . .

# Create non-root user
RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Health check
HEALTHCHECK CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/fastapi_db
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis

  db:
    image: postgres:15
    environment:
      POSTGRES_DB: fastapi_db
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

## Environment Variables

```bash
# .env
SECRET_KEY=your-secret-key
DATABASE_URL=postgresql://user:pass@localhost/fastapi_db
REDIS_URL=redis://localhost:6379
```

## Health Check

```python
# app/api/health.py
from fastapi import APIRouter
from app.core.config import settings

router = APIRouter()

@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "version": settings.VERSION
    }
```

## Deployment Script

```bash
#!/bin/bash
# deploy.sh

set -e

echo "Deploying FastAPI app..."

# Build and deploy
docker-compose build
docker-compose up -d

# Health check
echo "Checking health..."
if curl -f http://localhost:8000/health; then
    echo "✅ Deployment successful!"
else
    echo "❌ Deployment failed!"
    exit 1
fi
```
