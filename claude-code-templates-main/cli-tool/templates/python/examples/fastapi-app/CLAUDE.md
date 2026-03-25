# FastAPI Project Configuration

This file provides specific guidance for FastAPI web application development using Claude Code.

## Project Overview

This is a FastAPI application project optimized for modern API development with automatic documentation, type hints, and async support.

## FastAPI-Specific Development Commands

### Project Management
- `uvicorn app.main:app --reload` - Start development server with auto-reload
- `uvicorn app.main:app --host 0.0.0.0 --port 8000` - Start server on all interfaces
- `uvicorn app.main:app --workers 4` - Start with multiple workers

### Database Management
- `alembic init alembic` - Initialize Alembic migrations
- `alembic revision --autogenerate -m "message"` - Create migration
- `alembic upgrade head` - Apply migrations
- `alembic downgrade -1` - Rollback one migration

### Development Tools
- `python -m pytest` - Run tests
- `python -m pytest --cov=app` - Run tests with coverage
- `mypy app/` - Type checking
- `black app/` - Code formatting

## FastAPI Project Structure

```
myproject/
├── app/                        # Application package
│   ├── __init__.py
│   ├── main.py                # FastAPI application
│   ├── core/                  # Core configuration
│   │   ├── __init__.py
│   │   ├── config.py         # Settings
│   │   └── security.py       # Authentication
│   ├── api/                   # API routes
│   │   ├── __init__.py
│   │   ├── deps.py           # Dependencies
│   │   └── v1/
│   │       ├── __init__.py
│   │       ├── api.py        # API router
│   │       └── endpoints/
│   ├── models/                # Database models
│   │   ├── __init__.py
│   │   ├── base.py
│   │   └── user.py
│   ├── schemas/               # Pydantic schemas
│   │   ├── __init__.py
│   │   └── user.py
│   ├── repositories/          # Data access layer
│   │   ├── __init__.py
│   │   └── user.py
│   ├── services/              # Business logic
│   │   ├── __init__.py
│   │   └── auth.py
│   └── db/                    # Database configuration
│       ├── __init__.py
│       └── database.py
├── alembic/                   # Database migrations
├── tests/                     # Test files
├── requirements.txt           # Dependencies
└── docker-compose.yml        # Docker configuration
```

## FastAPI Application Setup

```python
# app/main.py
from fastapi import FastAPI
from app.core.config import settings
from app.api.v1.api import api_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"/api/v1/openapi.json"
)

# Include routers
app.include_router(api_router, prefix="/api/v1")

@app.get("/")
async def root():
    return {"message": "Welcome to FastAPI"}
```

## Configuration Management

```python
# app/core/config.py
from pydantic import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "FastAPI App"
    VERSION: str = "1.0.0"
    SECRET_KEY: str
    DATABASE_URL: str
    
    class Config:
        env_file = ".env"

settings = Settings()
```

## FastAPI Best Practices

### API Design
- Use Pydantic models for request/response validation
- Implement proper HTTP status codes
- Add comprehensive API documentation
- Use dependency injection for common functionality
- Implement proper error handling

### Database Integration
- Use SQLAlchemy with async support
- Implement repository pattern for data access
- Use Alembic for database migrations
- Add proper database connection pooling
- Implement database health checks

### Authentication & Security
- Use JWT tokens for authentication
- Implement OAuth2 with scopes
- Add rate limiting for API endpoints
- Use HTTPS in production
- Implement proper CORS configuration

### Performance Optimization
- Use async/await for I/O operations
- Implement response caching
- Add database query optimization
- Use connection pooling
- Monitor application performance

## Testing Strategy

### Test Organization
```python
# tests/conftest.py
import pytest
from fastapi.testclient import TestClient
from app.main import app

@pytest.fixture
def client():
    return TestClient(app)
```

### Test Types
- **Unit tests** for business logic
- **Integration tests** for API endpoints
- **Database tests** with test fixtures
- **Authentication tests** for security

## Deployment Considerations

### Production Setup
- Use Uvicorn with multiple workers
- Implement proper logging and monitoring
- Set up reverse proxy (Nginx)
- Use environment variables for configuration
- Implement health checks

### Docker Configuration
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0"]
```

### Environment Variables
```bash
SECRET_KEY=your-secret-key
DATABASE_URL=postgresql://user:pass@host/db
REDIS_URL=redis://localhost:6379
```

## Common FastAPI Patterns

### Dependency Injection
```python
from fastapi import Depends
from app.db.database import get_db

@app.get("/users/")
async def get_users(db: Session = Depends(get_db)):
    return users
```

### Background Tasks
```python
from fastapi import BackgroundTasks

@app.post("/send-email/")
async def send_email(background_tasks: BackgroundTasks):
    background_tasks.add_task(send_email_task)
    return {"message": "Email sent"}
```

### Middleware
```python
@app.middleware("http")
async def add_process_time_header(request, call_next):
    response = await call_next(request)
    return response
```

## Development Workflow

### Getting Started
1. Clone repository
2. Create virtual environment: `python -m venv venv`
3. Install dependencies: `pip install -r requirements.txt`
4. Set environment variables
5. Run migrations: `alembic upgrade head`
6. Start server: `uvicorn app.main:app --reload`

### Code Quality
- **Black** - Code formatting
- **isort** - Import sorting  
- **mypy** - Type checking
- **pytest** - Testing framework
- **flake8** - Linting