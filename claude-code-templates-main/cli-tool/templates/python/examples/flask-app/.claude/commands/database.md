# Flask Database Management

Complete database setup and management for Flask applications using SQLAlchemy.

## Usage

```bash
# Initialize database
flask db init

# Create migration
flask db migrate -m "Initial migration"

# Apply migrations
flask db upgrade

# Downgrade migration
flask db downgrade
```

## Database Configuration

```python
# config.py
import os
from urllib.parse import quote_plus

class Config:
    """Base configuration."""
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_RECORD_QUERIES = True
    
class DevelopmentConfig(Config):
    """Development configuration."""
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        'sqlite:///app.db'
        
class ProductionConfig(Config):
    """Production configuration."""
    DEBUG = False
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        f"postgresql://{os.environ.get('DB_USER')}:{quote_plus(os.environ.get('DB_PASSWORD'))}@" \
        f"{os.environ.get('DB_HOST')}:{os.environ.get('DB_PORT', '5432')}/{os.environ.get('DB_NAME')}"
    
class TestingConfig(Config):
    """Testing configuration."""
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

## Database Extensions

```python
# app/extensions.py
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_login import LoginManager
from flask_wtf.csrf import CSRFProtect
from flask_caching import Cache
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# Initialize extensions
db = SQLAlchemy()
migrate = Migrate()
login_manager = LoginManager()
csrf = CSRFProtect()
cache = Cache()
limiter = Limiter(key_func=get_remote_address)

def init_extensions(app):
    """Initialize Flask extensions."""
    db.init_app(app)
    migrate.init_app(app, db)
    login_manager.init_app(app)
    csrf.init_app(app)
    cache.init_app(app)
    limiter.init_app(app)
    
    # Configure login manager
    login_manager.login_view = 'auth.login'
    login_manager.login_message = 'Please log in to access this page.'
    login_manager.login_message_category = 'info'
```

## Base Model

```python
# app/models/base.py
from app.extensions import db
from datetime import datetime
from sqlalchemy.ext.declarative import declared_attr

class TimestampMixin:
    """Add timestamp fields to model."""
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

class BaseModel(db.Model, TimestampMixin):
    """Base model with common functionality."""
    __abstract__ = True
    
    id = db.Column(db.Integer, primary_key=True)
    
    @declared_attr
    def __tablename__(cls):
        return cls.__name__.lower()
    
    def save(self, commit=True):
        """Save model to database."""
        db.session.add(self)
        if commit:
            db.session.commit()
        return self
    
    def delete(self, commit=True):
        """Delete model from database."""
        db.session.delete(self)
        if commit:
            db.session.commit()
    
    def update(self, **kwargs):
        """Update model attributes."""
        for key, value in kwargs.items():
            if hasattr(self, key):
                setattr(self, key, value)
        return self.save()
    
    def to_dict(self, exclude=None):
        """Convert model to dictionary."""
        exclude = exclude or []
        return {
            column.name: getattr(self, column.name)
            for column in self.__table__.columns
            if column.name not in exclude
        }
    
    @classmethod
    def get_or_404(cls, id):
        """Get model by ID or raise 404."""
        return cls.query.get_or_404(id)
    
    @classmethod
    def create(cls, **kwargs):
        """Create new model instance."""
        instance = cls(**kwargs)
        return instance.save()
```

## Example Models

```python
# app/models/user.py
from app.extensions import db
from app.models.base import BaseModel
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import UserMixin

class User(UserMixin, BaseModel):
    """User model."""
    __tablename__ = 'users'
    
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    first_name = db.Column(db.String(50), nullable=False)
    last_name = db.Column(db.String(50), nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    is_admin = db.Column(db.Boolean, default=False, nullable=False)
    last_login = db.Column(db.DateTime)
    
    # Relationships
    posts = db.relationship('Post', backref='author', lazy='dynamic', cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<User {self.username}>'
    
    def set_password(self, password):
        """Set password hash."""
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        """Check password hash."""
        return check_password_hash(self.password_hash, password)
    
    @property
    def full_name(self):
        """Get user's full name."""
        return f"{self.first_name} {self.last_name}"
    
    def to_dict(self, exclude=None):
        """Convert to dictionary excluding sensitive data."""
        exclude = exclude or ['password_hash']
        return super().to_dict(exclude=exclude)

# app/models/post.py
class Post(BaseModel):
    """Blog post model."""
    __tablename__ = 'posts'
    
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)
    slug = db.Column(db.String(200), unique=True, nullable=False, index=True)
    status = db.Column(db.String(20), default='draft', nullable=False)
    published_at = db.Column(db.DateTime)
    
    # Foreign keys
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey('categories.id'))
    
    # Relationships
    category = db.relationship('Category', backref='posts')
    tags = db.relationship('Tag', secondary='post_tags', backref='posts')
    
    def __repr__(self):
        return f'<Post {self.title}>'
    
    @property
    def is_published(self):
        """Check if post is published."""
        return self.status == 'published' and self.published_at is not None
```

## Database CLI Commands

```python
# app/cli.py
import click
from flask import current_app
from flask.cli import with_appcontext
from app.extensions import db
from app.models import User, Post, Category

@click.command()
@with_appcontext
def init_db():
    """Initialize database."""
    db.create_all()
    click.echo('Database initialized.')

@click.command()
@with_appcontext
def seed_db():
    """Seed database with sample data."""
    # Create admin user
    admin = User(
        username='admin',
        email='admin@example.com',
        first_name='Admin',
        last_name='User',
        is_admin=True
    )
    admin.set_password('admin123')
    admin.save()
    
    # Create sample category
    category = Category(
        name='Technology',
        description='Tech-related posts'
    )
    category.save()
    
    # Create sample post
    post = Post(
        title='Welcome to Flask',
        content='This is a sample blog post.',
        slug='welcome-to-flask',
        status='published',
        user_id=admin.id,
        category_id=category.id
    )
    post.save()
    
    click.echo('Database seeded with sample data.')

@click.command()
@with_appcontext
def reset_db():
    """Reset database."""
    if click.confirm('Are you sure you want to reset the database?'):
        db.drop_all()
        db.create_all()
        click.echo('Database reset.')

def init_commands(app):
    """Register CLI commands."""
    app.cli.add_command(init_db)
    app.cli.add_command(seed_db)
    app.cli.add_command(reset_db)
```

## Connection Pooling

```python
# app/database.py
from sqlalchemy import create_engine
from sqlalchemy.pool import QueuePool

def configure_database(app):
    """Configure database with connection pooling."""
    if app.config.get('SQLALCHEMY_DATABASE_URI', '').startswith('postgresql'):
        # PostgreSQL configuration
        engine = create_engine(
            app.config['SQLALCHEMY_DATABASE_URI'],
            poolclass=QueuePool,
            pool_size=10,
            max_overflow=20,
            pool_recycle=3600,
            pool_pre_ping=True
        )
        app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
            'pool_size': 10,
            'max_overflow': 20,
            'pool_recycle': 3600,
            'pool_pre_ping': True
        }
```

## Database Utilities

```python
# app/utils/database.py
from app.extensions import db
from sqlalchemy import text
from flask import current_app

def execute_sql(sql, params=None):
    """Execute raw SQL query."""
    with db.engine.connect() as conn:
        result = conn.execute(text(sql), params or {})
        return result.fetchall()

def backup_database():
    """Create database backup."""
    # Implementation depends on database type
    pass

def check_database_health():
    """Check database connection health."""
    try:
        db.session.execute(text('SELECT 1'))
        return True
    except Exception as e:
        current_app.logger.error(f'Database health check failed: {e}')
        return False

def get_table_info(table_name):
    """Get table information."""
    inspector = db.inspect(db.engine)
    return {
        'columns': inspector.get_columns(table_name),
        'indexes': inspector.get_indexes(table_name),
        'foreign_keys': inspector.get_foreign_keys(table_name)
    }
```

## Testing Database

```python
# tests/conftest.py
import pytest
from app import create_app
from app.extensions import db
from app.models import User

@pytest.fixture(scope='session')
def app():
    """Create test app."""
    app = create_app('testing')
    with app.app_context():
        db.create_all()
        yield app
        db.drop_all()

@pytest.fixture
def client(app):
    """Create test client."""
    return app.test_client()

@pytest.fixture
def db_session(app):
    """Create database session for testing."""
    with app.app_context():
        db.session.begin()
        yield db.session
        db.session.rollback()

@pytest.fixture
def user(db_session):
    """Create test user."""
    user = User(
        username='testuser',
        email='test@example.com',
        first_name='Test',
        last_name='User'
    )
    user.set_password('testpass')
    user.save()
    return user
```
