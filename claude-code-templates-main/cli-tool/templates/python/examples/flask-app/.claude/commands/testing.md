# Flask Testing Suite

Comprehensive testing setup for Flask applications with pytest.

## Usage

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html

# Run specific test file
pytest tests/test_models.py

# Run with verbose output
pytest -v
```

## Test Configuration

```python
# pytest.ini
[tool:pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
addopts = 
    --cov=app
    --cov-report=term-missing
    --cov-report=html:htmlcov
    --strict-markers
    --disable-warnings
markers =
    unit: Unit tests
    integration: Integration tests
    slow: Slow running tests
    auth: Authentication tests
```

## Test Fixtures

```python
# tests/conftest.py
import pytest
import tempfile
import os
from app import create_app
from app.extensions import db
from app.models import User, Post, Category
from flask_login import login_user

@pytest.fixture(scope='session')
def app():
    """Create test application."""
    # Create temporary database
    db_fd, db_path = tempfile.mkstemp()
    
    app = create_app({
        'TESTING': True,
        'SQLALCHEMY_DATABASE_URI': f'sqlite:///{db_path}',
        'WTF_CSRF_ENABLED': False,
        'SECRET_KEY': 'test-secret-key'
    })
    
    with app.app_context():
        db.create_all()
        yield app
        
    # Cleanup
    os.close(db_fd)
    os.unlink(db_path)

@pytest.fixture
def client(app):
    """Create test client."""
    return app.test_client()

@pytest.fixture
def runner(app):
    """Create test CLI runner."""
    return app.test_cli_runner()

@pytest.fixture
def db_session(app):
    """Create database session for testing."""
    with app.app_context():
        connection = db.engine.connect()
        transaction = connection.begin()
        
        # Configure session to use the connection
        db.session.configure(bind=connection)
        
        yield db.session
        
        # Rollback transaction
        transaction.rollback()
        connection.close()
        db.session.remove()

@pytest.fixture
def user(db_session):
    """Create test user."""
    user = User(
        username='testuser',
        email='test@example.com',
        first_name='Test',
        last_name='User'
    )
    user.set_password('testpass123')
    user.save()
    return user

@pytest.fixture
def admin_user(db_session):
    """Create admin user."""
    admin = User(
        username='admin',
        email='admin@example.com',
        first_name='Admin',
        last_name='User',
        is_admin=True
    )
    admin.set_password('adminpass123')
    admin.save()
    return admin

@pytest.fixture
def category(db_session):
    """Create test category."""
    category = Category(
        name='Test Category',
        description='A test category'
    )
    category.save()
    return category

@pytest.fixture
def post(db_session, user, category):
    """Create test post."""
    post = Post(
        title='Test Post',
        content='This is a test post content.',
        slug='test-post',
        status='published',
        user_id=user.id,
        category_id=category.id
    )
    post.save()
    return post

@pytest.fixture
def auth_headers(user):
    """Create authentication headers."""
    # For API testing
    token = user.generate_auth_token()
    return {'Authorization': f'Bearer {token}'}
```

## Model Testing

```python
# tests/test_models.py
import pytest
from datetime import datetime
from app.models import User, Post, Category
from werkzeug.security import check_password_hash

class TestUser:
    """Test User model."""
    
    def test_user_creation(self, db_session):
        """Test user creation."""
        user = User(
            username='newuser',
            email='new@example.com',
            first_name='New',
            last_name='User'
        )
        user.set_password('password123')
        user.save()
        
        assert user.id is not None
        assert user.username == 'newuser'
        assert user.email == 'new@example.com'
        assert user.full_name == 'New User'
        assert user.is_active is True
        assert user.is_admin is False
        assert user.created_at is not None
    
    def test_password_hashing(self, user):
        """Test password hashing."""
        user.set_password('newpassword')
        assert user.password_hash != 'newpassword'
        assert check_password_hash(user.password_hash, 'newpassword')
        assert user.check_password('newpassword')
        assert not user.check_password('wrongpassword')
    
    def test_user_repr(self, user):
        """Test user string representation."""
        assert repr(user) == '<User testuser>'
    
    def test_user_to_dict(self, user):
        """Test user dictionary conversion."""
        user_dict = user.to_dict()
        assert 'username' in user_dict
        assert 'email' in user_dict
        assert 'password_hash' not in user_dict  # Should be excluded
    
    def test_user_relationships(self, user, post):
        """Test user relationships."""
        assert post in user.posts
        assert user.posts.count() == 1

class TestPost:
    """Test Post model."""
    
    def test_post_creation(self, db_session, user, category):
        """Test post creation."""
        post = Post(
            title='New Post',
            content='New post content',
            slug='new-post',
            status='draft',
            user_id=user.id,
            category_id=category.id
        )
        post.save()
        
        assert post.id is not None
        assert post.title == 'New Post'
        assert post.author == user
        assert post.category == category
        assert not post.is_published
    
    def test_published_status(self, post):
        """Test post published status."""
        assert post.is_published  # Published with published_at
        
        post.status = 'draft'
        assert not post.is_published
```

## View Testing

```python
# tests/test_views.py
import pytest
from flask import url_for
from app.models import User

class TestMainViews:
    """Test main application views."""
    
    def test_home_page(self, client):
        """Test home page."""
        response = client.get('/')
        assert response.status_code == 200
        assert b'Welcome' in response.data
    
    def test_about_page(self, client):
        """Test about page."""
        response = client.get('/about')
        assert response.status_code == 200

class TestUserViews:
    """Test user-related views."""
    
    def test_user_list(self, client, user):
        """Test user list page."""
        response = client.get('/users/')
        assert response.status_code == 200
        assert user.username.encode() in response.data
    
    def test_user_detail(self, client, user):
        """Test user detail page."""
        response = client.get(f'/users/{user.id}')
        assert response.status_code == 200
        assert user.username.encode() in response.data
    
    def test_user_create_get(self, client):
        """Test user creation form."""
        response = client.get('/users/create')
        assert response.status_code == 200
        assert b'Create User' in response.data
    
    def test_user_create_post(self, client, db_session):
        """Test user creation submission."""
        data = {
            'username': 'newuser',
            'email': 'new@example.com',
            'first_name': 'New',
            'last_name': 'User',
            'password': 'password123',
            'confirm_password': 'password123'
        }
        response = client.post('/users/create', data=data, follow_redirects=True)
        assert response.status_code == 200
        
        # Check user was created
        user = User.query.filter_by(username='newuser').first()
        assert user is not None
        assert user.email == 'new@example.com'
    
    def test_user_edit(self, client, user):
        """Test user editing."""
        data = {
            'username': user.username,
            'email': 'updated@example.com',
            'first_name': 'Updated',
            'last_name': 'User'
        }
        response = client.post(f'/users/{user.id}/edit', data=data, follow_redirects=True)
        assert response.status_code == 200
        
        # Refresh user from database
        db_session.refresh(user)
        assert user.email == 'updated@example.com'
        assert user.first_name == 'Updated'
```

## Authentication Testing

```python
# tests/test_auth.py
import pytest
from flask import url_for
from app.models import User

class TestAuthentication:
    """Test authentication functionality."""
    
    def test_login_page(self, client):
        """Test login page access."""
        response = client.get('/auth/login')
        assert response.status_code == 200
        assert b'Login' in response.data
    
    def test_valid_login(self, client, user):
        """Test valid user login."""
        data = {
            'username': user.username,
            'password': 'testpass123'
        }
        response = client.post('/auth/login', data=data, follow_redirects=True)
        assert response.status_code == 200
        assert b'Welcome' in response.data
    
    def test_invalid_login(self, client, user):
        """Test invalid login credentials."""
        data = {
            'username': user.username,
            'password': 'wrongpassword'
        }
        response = client.post('/auth/login', data=data)
        assert response.status_code == 200
        assert b'Invalid' in response.data
    
    def test_logout(self, client, user):
        """Test user logout."""
        # Login first
        with client.session_transaction() as sess:
            sess['_user_id'] = str(user.id)
        
        response = client.get('/auth/logout', follow_redirects=True)
        assert response.status_code == 200
    
    def test_register_page(self, client):
        """Test registration page."""
        response = client.get('/auth/register')
        assert response.status_code == 200
        assert b'Register' in response.data
    
    def test_valid_registration(self, client, db_session):
        """Test valid user registration."""
        data = {
            'username': 'newuser',
            'email': 'new@example.com',
            'first_name': 'New',
            'last_name': 'User',
            'password': 'password123',
            'confirm_password': 'password123'
        }
        response = client.post('/auth/register', data=data, follow_redirects=True)
        assert response.status_code == 200
        
        # Check user was created
        user = User.query.filter_by(username='newuser').first()
        assert user is not None
```

## API Testing

```python
# tests/test_api.py
import pytest
import json
from flask import url_for

class TestUserAPI:
    """Test User API endpoints."""
    
    def test_get_users(self, client, user):
        """Test GET /api/users."""
        response = client.get('/api/users')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert 'users' in data
        assert len(data['users']) >= 1
    
    def test_get_user(self, client, user):
        """Test GET /api/users/<id>."""
        response = client.get(f'/api/users/{user.id}')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert data['username'] == user.username
        assert data['email'] == user.email
    
    def test_create_user(self, client, db_session):
        """Test POST /api/users."""
        user_data = {
            'username': 'apiuser',
            'email': 'api@example.com',
            'first_name': 'API',
            'last_name': 'User',
            'password': 'password123'
        }
        
        response = client.post(
            '/api/users',
            data=json.dumps(user_data),
            content_type='application/json'
        )
        
        assert response.status_code == 201
        data = json.loads(response.data)
        assert data['username'] == 'apiuser'
    
    def test_update_user(self, client, user, auth_headers):
        """Test PUT /api/users/<id>."""
        update_data = {
            'email': 'updated@example.com',
            'first_name': 'Updated'
        }
        
        response = client.put(
            f'/api/users/{user.id}',
            data=json.dumps(update_data),
            content_type='application/json',
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['email'] == 'updated@example.com'
    
    def test_delete_user(self, client, user, auth_headers):
        """Test DELETE /api/users/<id>."""
        response = client.delete(
            f'/api/users/{user.id}',
            headers=auth_headers
        )
        
        assert response.status_code == 204
```

## Test Utilities

```python
# tests/utils.py
import json
from flask import url_for

def login_user(client, username, password):
    """Helper to login user in tests."""
    return client.post('/auth/login', data={
        'username': username,
        'password': password
    }, follow_redirects=True)

def logout_user(client):
    """Helper to logout user in tests."""
    return client.get('/auth/logout', follow_redirects=True)

def assert_json_response(response, expected_status=200):
    """Assert JSON response format and status."""
    assert response.status_code == expected_status
    assert response.content_type == 'application/json'
    return json.loads(response.data)

def create_test_data(db_session):
    """Create common test data."""
    from app.models import User, Category, Post
    
    # Create test users
    users = []
    for i in range(3):
        user = User(
            username=f'user{i}',
            email=f'user{i}@example.com',
            first_name=f'User{i}',
            last_name='Test'
        )
        user.set_password('password123')
        user.save()
        users.append(user)
    
    return {'users': users}
```

## Performance Testing

```python
# tests/test_performance.py
import pytest
import time
from app.models import User

@pytest.mark.slow
class TestPerformance:
    """Test application performance."""
    
    def test_user_query_performance(self, db_session):
        """Test user query performance."""
        # Create multiple users
        users = []
        for i in range(100):
            user = User(
                username=f'perfuser{i}',
                email=f'perf{i}@example.com',
                first_name=f'Perf{i}',
                last_name='User'
            )
            users.append(user)
        
        db_session.bulk_save_objects(users)
        db_session.commit()
        
        # Test query performance
        start_time = time.time()
        result = User.query.all()
        end_time = time.time()
        
        assert len(result) >= 100
        assert (end_time - start_time) < 0.1  # Should complete in under 100ms
    
    def test_endpoint_response_time(self, client):
        """Test endpoint response time."""
        start_time = time.time()
        response = client.get('/')
        end_time = time.time()
        
        assert response.status_code == 200
        assert (end_time - start_time) < 0.5  # Should respond in under 500ms
```
