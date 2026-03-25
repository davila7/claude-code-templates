# Django Project Configuration

This file provides specific guidance for Django web application development using Claude Code.

## Project Overview

This is a Django web application project optimized for scalable web development with the Django framework. The project follows Django best practices and conventions.

## Django-Specific Development Commands

### Project Management
- `django-admin startproject myproject` - Create new Django project
- `python manage.py startapp myapp` - Create new Django app
- `python manage.py runserver` - Start development server
- `python manage.py runserver 0.0.0.0:8000` - Start server accessible from network

### Database Management
- `python manage.py makemigrations` - Create database migrations
- `python manage.py migrate` - Apply database migrations
- `python manage.py showmigrations` - Show migration status
- `python manage.py sqlmigrate app_name migration_name` - Show SQL for migration
- `python manage.py dbshell` - Open database shell

### User Management
- `python manage.py createsuperuser` - Create admin superuser
- `python manage.py changepassword username` - Change user password
- `python manage.py shell` - Open Django shell

### Static Files & Media
- `python manage.py collectstatic` - Collect static files for production
- `python manage.py findstatic filename` - Find static file location

### Testing & Quality
- `python manage.py test` - Run Django tests
- `python manage.py test app_name` - Run tests for specific app
- `python manage.py test --keepdb` - Run tests keeping test database
- `coverage run --source='.' manage.py test` - Run tests with coverage

### Development Tools
- `python manage.py check` - Check for Django issues
- `python manage.py validate` - Validate models
- `python manage.py inspectdb` - Generate models from existing database
- `python manage.py dumpdata app_name` - Export data
- `python manage.py loaddata fixture.json` - Import data

## Django Project Structure

```
myproject/
├── manage.py                   # Django management script
├── myproject/                  # Project configuration
│   ├── __init__.py
│   ├── settings/              # Settings modules
│   │   ├── __init__.py
│   │   ├── base.py           # Base settings
│   │   ├── development.py    # Development settings
│   │   ├── production.py     # Production settings
│   │   └── testing.py        # Testing settings
│   ├── urls.py               # URL configuration
│   ├── wsgi.py               # WSGI configuration
│   └── asgi.py               # ASGI configuration
├── apps/                      # Django applications
│   ├── users/                # User management app
│   ├── blog/                 # Blog app example
│   └── api/                  # API app
├── static/                   # Static files
├── media/                    # User uploaded files
├── templates/                # Django templates
├── requirements/             # Requirements files
│   ├── base.txt
│   ├── development.txt
│   └── production.txt
└── tests/                    # Test files
```

## Django Settings Configuration

### Base Settings (settings/base.py)
```python
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Security
SECRET_KEY = os.environ.get('SECRET_KEY')
DEBUG = False
ALLOWED_HOSTS = []

# Application definition
DJANGO_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
]

THIRD_PARTY_APPS = [
    'rest_framework',
    'django_extensions',
]

LOCAL_APPS = [
    'apps.users',
    'apps.blog',
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

# Database
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('DB_NAME'),
        'USER': os.environ.get('DB_USER'),
        'PASSWORD': os.environ.get('DB_PASSWORD'),
        'HOST': os.environ.get('DB_HOST', 'localhost'),
        'PORT': os.environ.get('DB_PORT', '5432'),
    }
}

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static files
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_DIRS = [BASE_DIR / 'static']

# Media files
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'
```

## Django Best Practices

### Models
- Use descriptive model names (singular)
- Add `__str__` methods for better admin interface
- Use `related_name` for foreign keys
- Implement `get_absolute_url` method
- Add proper Meta class with ordering

### Views
- Use class-based views for complex logic
- Implement proper error handling
- Add pagination for list views
- Use `select_related` and `prefetch_related` for optimization
- Implement proper permission checks

### URLs
- Use app namespaces
- Use descriptive URL names
- Group related URLs in separate files
- Use slug fields for SEO-friendly URLs

### Templates
- Extend base templates
- Use template inheritance effectively
- Create reusable template tags
- Implement proper CSRF protection
- Use Django's built-in template filters

### Forms
- Use Django forms for validation
- Implement custom form validation
- Use ModelForms when appropriate
- Add proper error handling
- Implement CSRF protection

## Security Considerations

### Django Security Settings
```python
# Security settings for production
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_HSTS_SECONDS = 31536000
SECURE_REDIRECT_EXEMPT = []
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
```

### User Authentication
- Use Django's built-in authentication
- Implement proper password policies
- Add two-factor authentication if needed
- Use Django's permission system
- Implement proper session management

## Testing Strategy

### Test Organization
```python
# tests/test_models.py
from django.test import TestCase
from django.contrib.auth import get_user_model
from apps.blog.models import Post

User = get_user_model()

class PostModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
    
    def test_post_creation(self):
        post = Post.objects.create(
            title='Test Post',
            content='Test content',
            author=self.user
        )
        self.assertEqual(post.title, 'Test Post')
        self.assertEqual(str(post), 'Test Post')
```

### Test Types
- **Unit tests** for models and utilities
- **Integration tests** for views and forms
- **Functional tests** for user workflows
- **API tests** for REST endpoints

## Deployment Considerations

### Production Settings
- Use environment variables for sensitive data
- Configure proper logging
- Set up static file serving
- Configure database connection pooling
- Implement proper caching strategy

### Docker Configuration
```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["gunicorn", "--bind", "0.0.0.0:8000", "myproject.wsgi:application"]
```

## Performance Optimization

### Database Optimization
- Use `select_related()` for foreign keys
- Use `prefetch_related()` for many-to-many
- Add database indexes for frequent queries
- Implement database connection pooling
- Use database query optimization tools

### Caching Strategy
- Implement Redis/Memcached for session storage
- Use template fragment caching
- Implement view-level caching
- Add database query caching
- Use CDN for static files

## Common Django Patterns

### Custom User Model
```python
from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=30)
    last_name = models.CharField(max_length=30)
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'first_name', 'last_name']
```

### Custom Managers
```python
class PublishedManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset().filter(status='published')

class Post(models.Model):
    title = models.CharField(max_length=200)
    status = models.CharField(max_length=20, default='draft')
    
    objects = models.Manager()  # Default manager
    published = PublishedManager()  # Custom manager
```

## Django Extensions & Tools

### Useful Third-Party Packages
- **Django REST Framework** - API development
- **Celery** - Asynchronous task processing
- **Django Debug Toolbar** - Development debugging
- **Django Extensions** - Additional management commands
- **Pillow** - Image processing
- **psycopg2-binary** - PostgreSQL adapter