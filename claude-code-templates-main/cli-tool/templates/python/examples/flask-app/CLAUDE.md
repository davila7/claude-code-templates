# Flask Project Configuration

This file provides specific guidance for Flask web application development using Claude Code.

## Project Overview

This is a Flask web application project optimized for scalable web development with the Flask micro-framework. The project follows Flask best practices and modern Python development patterns.

## Flask-Specific Development Commands

### Project Management
- `flask run` - Start development server
- `flask run --host=0.0.0.0 --port=5000` - Start server accessible from network
- `flask shell` - Open Flask shell with application context
- `python -m flask --help` - Show available Flask commands

### Database Management
- `flask db init` - Initialize database migrations
- `flask db migrate -m "message"` - Create database migration
- `flask db upgrade` - Apply database migrations
- `flask db downgrade` - Rollback database migration
- `flask db current` - Show current migration
- `flask db history` - Show migration history

### Development Tools
- `flask routes` - Show all registered routes
- `flask --version` - Show Flask version
- `export FLASK_ENV=development` - Set development environment
- `export FLASK_DEBUG=1` - Enable debug mode

### Custom Commands
- `flask init-db` - Initialize database with tables
- `flask seed-db` - Seed database with sample data
- `flask reset-db` - Reset database (development only)

## Flask Project Structure

```
myproject/
├── app/                        # Application package
│   ├── __init__.py            # Application factory
│   ├── extensions.py          # Flask extensions
│   ├── config.py              # Configuration settings
│   ├── models/                # Database models
│   │   ├── __init__.py
│   │   ├── base.py           # Base model class
│   │   ├── user.py           # User model
│   │   └── post.py           # Post model
│   ├── blueprints/            # Application blueprints
│   │   ├── __init__.py
│   │   ├── main/             # Main blueprint
│   │   ├── auth/             # Authentication blueprint
│   │   ├── api/              # API blueprint
│   │   └── admin/            # Admin blueprint
│   ├── templates/             # Jinja2 templates
│   │   ├── base.html
│   │   ├── index.html
│   │   └── auth/
│   ├── static/                # Static files
│   │   ├── css/
│   │   ├── js/
│   │   └── images/
│   ├── forms/                 # WTForms
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   └── user.py
│   ├── utils/                 # Utility functions
│   └── cli.py                 # Custom CLI commands
├── migrations/                 # Database migrations
├── tests/                     # Test files
│   ├── conftest.py
│   ├── test_models.py
│   ├── test_views.py
│   └── test_api.py
├── requirements/              # Requirements files
│   ├── base.txt
│   ├── development.txt
│   └── production.txt
├── wsgi.py                    # WSGI entry point
├── gunicorn.conf.py          # Gunicorn configuration
└── docker-compose.yml        # Docker Compose configuration
```

## Flask Application Factory

```python
# app/__init__.py
from flask import Flask
from app.extensions import db, migrate, login_manager, csrf, cache
from app.config import config

def create_app(config_name='default'):
    app = Flask(__name__)
    app.config.from_object(config[config_name])
    
    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    login_manager.init_app(app)
    csrf.init_app(app)
    cache.init_app(app)
    
    # Register blueprints
    from app.blueprints.main import main_bp
    from app.blueprints.auth import auth_bp
    from app.blueprints.api import api_bp
    
    app.register_blueprint(main_bp)
    app.register_blueprint(auth_bp, url_prefix='/auth')
    app.register_blueprint(api_bp, url_prefix='/api/v1')
    
    # Register CLI commands
    from app.cli import init_commands
    init_commands(app)
    
    return app
```

## Configuration Management

```python
# app/config.py
import os
from datetime import timedelta

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_RECORD_QUERIES = True
    
    # Session configuration
    PERMANENT_SESSION_LIFETIME = timedelta(hours=1)
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    
    # File upload
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB
    UPLOAD_FOLDER = os.path.join(os.getcwd(), 'uploads')
    
    # Cache
    CACHE_TYPE = 'simple'
    CACHE_DEFAULT_TIMEOUT = 300

class DevelopmentConfig(Config):
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = os.environ.get('DEV_DATABASE_URL') or \
        'sqlite:///dev.db'
    SESSION_COOKIE_SECURE = False

class ProductionConfig(Config):
    DEBUG = False
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL')
    
    # Security headers
    SECURITY_HEADERS = {
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block'
    }

class TestingConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    WTF_CSRF_ENABLED = False

config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}
```

## Flask Best Practices

### Application Structure
- Use application factory pattern for configuration flexibility
- Organize code into blueprints for modularity
- Separate models, views, and forms into different modules
- Use extensions.py to initialize Flask extensions
- Implement proper error handling and logging

### Database Models
- Use SQLAlchemy ORM for database operations
- Implement base model with common functionality
- Add proper relationships between models
- Use database migrations for schema changes
- Implement model validation and constraints

### Blueprint Organization
- Group related functionality into blueprints
- Use URL prefixes for namespacing
- Implement blueprint-specific templates
- Add proper error handlers for each blueprint
- Use blueprint factories for complex blueprints

### Template Management
- Use template inheritance for consistent layout
- Create reusable template macros
- Implement proper CSRF protection in forms
- Use Flask-WTF for form handling and validation
- Organize templates by blueprint

### Security Considerations
- Always validate and sanitize user input
- Use Flask-Login for user session management
- Implement proper authentication and authorization
- Use CSRF protection for all forms
- Set secure session cookie configuration
- Implement rate limiting for API endpoints

## Flask Extensions

### Essential Extensions
```python
# app/extensions.py
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_login import LoginManager
from flask_wtf.csrf import CSRFProtect
from flask_caching import Cache
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

db = SQLAlchemy()
migrate = Migrate()
login_manager = LoginManager()
csrf = CSRFProtect()
cache = Cache()
limiter = Limiter(key_func=get_remote_address)
```

### Recommended Extensions
- **Flask-SQLAlchemy** - Database ORM
- **Flask-Migrate** - Database migrations
- **Flask-Login** - User session management
- **Flask-WTF** - Form handling and CSRF protection
- **Flask-Caching** - Caching support
- **Flask-Limiter** - Rate limiting
- **Flask-Mail** - Email support
- **Flask-Admin** - Admin interface

## Testing Strategy

### Test Organization
```python
# tests/conftest.py
import pytest
from app import create_app
from app.extensions import db

@pytest.fixture(scope='session')
def app():
    app = create_app('testing')
    with app.app_context():
        db.create_all()
        yield app
        db.drop_all()

@pytest.fixture
def client(app):
    return app.test_client()

@pytest.fixture
def runner(app):
    return app.test_cli_runner()
```

### Test Types
- **Unit tests** for models and utilities
- **Integration tests** for views and API endpoints
- **Functional tests** for user workflows
- **Performance tests** for critical paths

### Testing Best Practices
- Use fixtures for common test data
- Test both success and error conditions
- Mock external dependencies
- Use factory_boy for test data generation
- Implement database transaction rollback in tests

## Performance Optimization

### Database Optimization
- Use connection pooling for production
- Implement query optimization with indexes
- Use lazy loading for relationships
- Cache frequently accessed data
- Monitor database query performance

### Caching Strategy
- Implement Redis for session storage
- Use view-level caching for static content
- Cache database query results
- Implement cache invalidation strategies
- Use CDN for static files

### Application Optimization
- Use Gunicorn with multiple workers
- Implement proper logging and monitoring
- Optimize static file serving
- Use async tasks for long-running operations
- Implement proper error handling

## Deployment Considerations

### Production Setup
- Use environment variables for configuration
- Implement proper logging and monitoring
- Set up database connection pooling
- Configure reverse proxy (Nginx)
- Use HTTPS with proper SSL certificates

### Docker Configuration
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements/production.txt requirements.txt
RUN pip install -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["gunicorn", "--config", "gunicorn.conf.py", "wsgi:app"]
```

### Environment Variables
```bash
FLASK_ENV=production
SECRET_KEY=your-secret-key
DATABASE_URL=postgresql://user:pass@host:port/db
REDIS_URL=redis://host:port/db
```

## Common Flask Patterns

### Custom Decorators
```python
from functools import wraps
from flask import abort
from flask_login import current_user

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_admin:
            abort(403)
        return f(*args, **kwargs)
    return decorated_function
```

### Request Context Processors
```python
@app.context_processor
def inject_user():
    return dict(current_user=current_user)
```

### Custom Filters
```python
@app.template_filter('datetime')
def datetime_filter(value, format='%Y-%m-%d %H:%M'):
    return value.strftime(format) if value else ''
```

## Development Workflow

### Getting Started
1. Clone the repository
2. Create virtual environment: `python -m venv venv`
3. Activate environment: `source venv/bin/activate`
4. Install dependencies: `pip install -r requirements/development.txt`
5. Set environment variables
6. Initialize database: `flask db upgrade`
7. Run development server: `flask run`

### Development Process
1. Create feature branch from main
2. Implement changes with tests
3. Run test suite: `pytest`
4. Check code quality: `flake8`, `black`
5. Create pull request for review
6. Deploy after approval

### Code Quality Tools
- **Black** - Code formatting
- **isort** - Import sorting
- **flake8** - Linting
- **mypy** - Type checking
- **pytest** - Testing framework
- **coverage** - Test coverage