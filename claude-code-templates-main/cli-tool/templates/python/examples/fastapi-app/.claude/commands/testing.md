# FastAPI Testing Framework

Comprehensive testing setup for FastAPI applications with pytest and async support.

## Usage

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html

# Run specific test file
pytest tests/test_api.py

# Run with verbose output
pytest -v -s
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
    --asyncio-mode=auto
    --strict-markers
    --disable-warnings
markers =
    unit: Unit tests
    integration: Integration tests
    e2e: End-to-end tests
    slow: Slow running tests
    auth: Authentication tests
    api: API tests
asyncio_mode = auto
```

## Test Dependencies

```python
# requirements/test.txt
pytest>=7.0.0
pytest-asyncio>=0.21.0
pytest-cov>=4.0.0
httpx>=0.24.0
factory-boy>=3.2.0
faker>=18.0.0
respx>=0.20.0
pytest-mock>=3.10.0
```

## Test Fixtures

```python
# tests/conftest.py
import pytest
import asyncio
from typing import AsyncGenerator, Generator
from fastapi.testclient import TestClient
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.db.database import get_db, Base
from app.models.user import User
from app.core.security import get_password_hash
from tests.factories import UserFactory

# Test database URL
TEST_DATABASE_URL = "sqlite+aiosqlite:///./test.db"

@pytest.fixture(scope="session")
def event_loop() -> Generator[asyncio.AbstractEventLoop, None, None]:
    """Create event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="session")
async def test_engine():
    """Create test database engine."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        future=True
    )
    
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    yield engine
    
    # Drop tables and dispose engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    
    await engine.dispose()

@pytest.fixture
async def db_session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    """Create database session for testing."""
    TestSessionLocal = sessionmaker(
        test_engine, 
        class_=AsyncSession, 
        expire_on_commit=False
    )
    
    async with TestSessionLocal() as session:
        yield session

@pytest.fixture
def override_get_db(db_session: AsyncSession) -> Generator:
    """Override database dependency."""
    async def _override_get_db():
        yield db_session
    
    app.dependency_overrides[get_db] = _override_get_db
    yield
    app.dependency_overrides = {}

@pytest.fixture
def client(override_get_db) -> Generator[TestClient, None, None]:
    """Create test client."""
    with TestClient(app) as test_client:
        yield test_client

@pytest.fixture
async def async_client(override_get_db) -> AsyncGenerator[AsyncClient, None]:
    """Create async test client."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac

@pytest.fixture
async def test_user(db_session: AsyncSession) -> User:
    """Create test user."""
    user_data = {
        "username": "testuser",
        "email": "test@example.com",
        "hashed_password": get_password_hash("testpass123"),
        "first_name": "Test",
        "last_name": "User",
        "is_active": True,
        "is_superuser": False
    }
    
    user = User(**user_data)
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user

@pytest.fixture
async def superuser(db_session: AsyncSession) -> User:
    """Create superuser."""
    user_data = {
        "username": "admin",
        "email": "admin@example.com",
        "hashed_password": get_password_hash("adminpass123"),
        "first_name": "Admin",
        "last_name": "User",
        "is_active": True,
        "is_superuser": True
    }
    
    user = User(**user_data)
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user

@pytest.fixture
def user_token(test_user: User) -> str:
    """Create authentication token for test user."""
    from app.core.security import create_access_token
    return create_access_token(subject=test_user.id)

@pytest.fixture
def superuser_token(superuser: User) -> str:
    """Create authentication token for superuser."""
    from app.core.security import create_access_token
    return create_access_token(subject=superuser.id)

@pytest.fixture
def auth_headers(user_token: str) -> dict[str, str]:
    """Create authorization headers."""
    return {"Authorization": f"Bearer {user_token}"}

@pytest.fixture
def superuser_headers(superuser_token: str) -> dict[str, str]:
    """Create superuser authorization headers."""
    return {"Authorization": f"Bearer {superuser_token}"}
```

## Test Factories

```python
# tests/factories.py
import factory
from factory import Faker, SubFactory
from app.models.user import User
from app.models.post import Post
from app.core.security import get_password_hash

class UserFactory(factory.Factory):
    """Factory for User model."""
    
    class Meta:
        model = User
    
    username = Faker('user_name')
    email = Faker('email')
    first_name = Faker('first_name')
    last_name = Faker('last_name')
    hashed_password = factory.LazyAttribute(lambda obj: get_password_hash('testpass123'))
    is_active = True
    is_superuser = False
    bio = Faker('text', max_nb_chars=200)

class SuperUserFactory(UserFactory):
    """Factory for superuser."""
    username = 'admin'
    email = 'admin@example.com'
    first_name = 'Admin'
    last_name = 'User'
    is_superuser = True

class PostFactory(factory.Factory):
    """Factory for Post model."""
    
    class Meta:
        model = Post
    
    title = Faker('sentence', nb_words=4)
    content = Faker('text', max_nb_chars=1000)
    slug = Faker('slug')
    is_published = True
    author = SubFactory(UserFactory)

class InactiveUserFactory(UserFactory):
    """Factory for inactive user."""
    is_active = False
```

## API Testing

```python
# tests/test_api/test_users.py
import pytest
from httpx import AsyncClient
from app.models.user import User
from tests.factories import UserFactory

class TestUserAPI:
    """Test User API endpoints."""
    
    @pytest.mark.asyncio
    async def test_create_user(
        self, 
        async_client: AsyncClient, 
        superuser_headers: dict
    ):
        """Test POST /api/v1/users/."""
        user_data = {
            "username": "newuser",
            "email": "new@example.com",
            "password": "newpass123",
            "first_name": "New",
            "last_name": "User"
        }
        
        response = await async_client.post(
            "/api/v1/users/",
            json=user_data,
            headers=superuser_headers
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["username"] == user_data["username"]
        assert data["email"] == user_data["email"]
        assert "password" not in data
        assert "hashed_password" not in data
    
    @pytest.mark.asyncio
    async def test_get_users(
        self, 
        async_client: AsyncClient, 
        test_user: User,
        auth_headers: dict
    ):
        """Test GET /api/v1/users/."""
        response = await async_client.get(
            "/api/v1/users/",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "size" in data
        assert len(data["items"]) >= 1
    
    @pytest.mark.asyncio
    async def test_get_user(
        self, 
        async_client: AsyncClient, 
        test_user: User,
        auth_headers: dict
    ):
        """Test GET /api/v1/users/{id}."""
        response = await async_client.get(
            f"/api/v1/users/{test_user.id}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_user.id
        assert data["username"] == test_user.username
        assert data["email"] == test_user.email
    
    @pytest.mark.asyncio
    async def test_update_user(
        self, 
        async_client: AsyncClient, 
        test_user: User,
        auth_headers: dict
    ):
        """Test PUT /api/v1/users/{id}."""
        update_data = {
            "first_name": "Updated",
            "last_name": "Name",
            "bio": "Updated bio"
        }
        
        response = await async_client.put(
            f"/api/v1/users/{test_user.id}",
            json=update_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["first_name"] == update_data["first_name"]
        assert data["last_name"] == update_data["last_name"]
        assert data["bio"] == update_data["bio"]
    
    @pytest.mark.asyncio
    async def test_delete_user(
        self, 
        async_client: AsyncClient, 
        test_user: User,
        superuser_headers: dict
    ):
        """Test DELETE /api/v1/users/{id}."""
        response = await async_client.delete(
            f"/api/v1/users/{test_user.id}",
            headers=superuser_headers
        )
        
        assert response.status_code == 204
        
        # Verify user is deleted
        get_response = await async_client.get(
            f"/api/v1/users/{test_user.id}",
            headers=superuser_headers
        )
        assert get_response.status_code == 404
    
    @pytest.mark.asyncio
    async def test_unauthorized_access(self, async_client: AsyncClient):
        """Test unauthorized access to protected endpoints."""
        response = await async_client.get("/api/v1/users/")
        assert response.status_code == 401
    
    @pytest.mark.asyncio
    async def test_forbidden_access(
        self, 
        async_client: AsyncClient, 
        auth_headers: dict
    ):
        """Test forbidden access to admin endpoints."""
        user_data = {
            "username": "unauthorized",
            "email": "unauthorized@example.com",
            "password": "pass123"
        }
        
        response = await async_client.post(
            "/api/v1/users/",
            json=user_data,
            headers=auth_headers  # Regular user, not superuser
        )
        
        assert response.status_code == 403
```

## Authentication Testing

```python
# tests/test_api/test_auth.py
import pytest
from httpx import AsyncClient
from app.models.user import User
from app.core.security import create_access_token, decode_token

class TestAuthAPI:
    """Test authentication API endpoints."""
    
    @pytest.mark.asyncio
    async def test_register(
        self, 
        async_client: AsyncClient
    ):
        """Test user registration."""
        user_data = {
            "username": "newuser",
            "email": "new@example.com",
            "password": "newpass123",
            "first_name": "New",
            "last_name": "User"
        }
        
        response = await async_client.post(
            "/api/v1/auth/register",
            json=user_data
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["username"] == user_data["username"]
        assert data["email"] == user_data["email"]
        assert "password" not in data
    
    @pytest.mark.asyncio
    async def test_register_duplicate_email(
        self, 
        async_client: AsyncClient, 
        test_user: User
    ):
        """Test registration with duplicate email."""
        user_data = {
            "username": "different",
            "email": test_user.email,  # Duplicate email
            "password": "pass123",
            "first_name": "Test",
            "last_name": "User"
        }
        
        response = await async_client.post(
            "/api/v1/auth/register",
            json=user_data
        )
        
        assert response.status_code == 400
        assert "Email already registered" in response.json()["detail"]
    
    @pytest.mark.asyncio
    async def test_login(
        self, 
        async_client: AsyncClient, 
        test_user: User
    ):
        """Test user login."""
        login_data = {
            "username": test_user.username,
            "password": "testpass123"
        }
        
        response = await async_client.post(
            "/api/v1/auth/login",
            data=login_data,
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert "expires_in" in data
        
        # Verify token is valid
        payload = decode_token(data["access_token"])
        assert payload is not None
        assert payload["sub"] == str(test_user.id)
    
    @pytest.mark.asyncio
    async def test_login_invalid_credentials(
        self, 
        async_client: AsyncClient, 
        test_user: User
    ):
        """Test login with invalid credentials."""
        login_data = {
            "username": test_user.username,
            "password": "wrongpassword"
        }
        
        response = await async_client.post(
            "/api/v1/auth/login",
            data=login_data,
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        assert response.status_code == 401
        assert "Incorrect username or password" in response.json()["detail"]
    
    @pytest.mark.asyncio
    async def test_get_current_user(
        self, 
        async_client: AsyncClient, 
        test_user: User,
        auth_headers: dict
    ):
        """Test get current user endpoint."""
        response = await async_client.get(
            "/api/v1/auth/me",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_user.id
        assert data["username"] == test_user.username
        assert data["email"] == test_user.email
    
    @pytest.mark.asyncio
    async def test_refresh_token(
        self, 
        async_client: AsyncClient, 
        test_user: User
    ):
        """Test token refresh."""
        from app.core.security import create_refresh_token
        
        refresh_token = create_refresh_token(subject=test_user.id)
        
        response = await async_client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": refresh_token}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
    
    @pytest.mark.asyncio
    async def test_change_password(
        self, 
        async_client: AsyncClient, 
        test_user: User,
        auth_headers: dict
    ):
        """Test password change."""
        password_data = {
            "current_password": "testpass123",
            "new_password": "newpass123"
        }
        
        response = await async_client.post(
            "/api/v1/auth/change-password",
            json=password_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        assert "Password changed successfully" in response.json()["message"]
```

## Model Testing

```python
# tests/test_models/test_user.py
import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.core.security import verify_password, get_password_hash

class TestUserModel:
    """Test User model."""
    
    @pytest.mark.asyncio
    async def test_create_user(self, db_session: AsyncSession):
        """Test user creation."""
        user_data = {
            "username": "testuser",
            "email": "test@example.com",
            "hashed_password": get_password_hash("password123"),
            "first_name": "Test",
            "last_name": "User"
        }
        
        user = User(**user_data)
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
        
        assert user.id is not None
        assert user.username == "testuser"
        assert user.email == "test@example.com"
        assert user.full_name == "Test User"
        assert user.is_active is True
        assert user.is_superuser is False
        assert user.created_at is not None
        assert user.updated_at is not None
    
    def test_password_verification(self):
        """Test password verification."""
        password = "testpassword123"
        hashed = get_password_hash(password)
        
        user = User(
            username="test",
            email="test@example.com",
            hashed_password=hashed,
            first_name="Test",
            last_name="User"
        )
        
        assert user.verify_password(password)
        assert not user.verify_password("wrongpassword")
    
    def test_user_dict_excludes_password(self):
        """Test that dict() method excludes password."""
        user = User(
            username="test",
            email="test@example.com",
            hashed_password="hashed_password",
            first_name="Test",
            last_name="User"
        )
        
        user_dict = user.dict()
        assert "hashed_password" not in user_dict
        assert "username" in user_dict
        assert "email" in user_dict
    
    def test_user_repr(self):
        """Test user string representation."""
        user = User(
            id=1,
            username="test",
            email="test@example.com",
            hashed_password="hash",
            first_name="Test",
            last_name="User"
        )
        
        assert repr(user) == "<User(id=1)>"
```

## Repository Testing

```python
# tests/test_repositories/test_user.py
import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.repositories.user import UserRepository
from app.core.security import get_password_hash

class TestUserRepository:
    """Test UserRepository."""
    
    @pytest.mark.asyncio
    async def test_create_user(self, db_session: AsyncSession):
        """Test user creation through repository."""
        repo = UserRepository(User, db_session)
        
        user_data = {
            "username": "repouser",
            "email": "repo@example.com",
            "hashed_password": get_password_hash("password123"),
            "first_name": "Repo",
            "last_name": "User"
        }
        
        user = await repo.create(user_data)
        
        assert user.id is not None
        assert user.username == "repouser"
        assert user.email == "repo@example.com"
    
    @pytest.mark.asyncio
    async def test_get_by_email(self, db_session: AsyncSession, test_user: User):
        """Test get user by email."""
        repo = UserRepository(User, db_session)
        
        found_user = await repo.get_by_email(test_user.email)
        
        assert found_user is not None
        assert found_user.id == test_user.id
        assert found_user.email == test_user.email
    
    @pytest.mark.asyncio
    async def test_get_by_username(self, db_session: AsyncSession, test_user: User):
        """Test get user by username."""
        repo = UserRepository(User, db_session)
        
        found_user = await repo.get_by_username(test_user.username)
        
        assert found_user is not None
        assert found_user.id == test_user.id
        assert found_user.username == test_user.username
    
    @pytest.mark.asyncio
    async def test_get_multi_with_pagination(
        self, 
        db_session: AsyncSession, 
        test_user: User
    ):
        """Test get multiple users with pagination."""
        repo = UserRepository(User, db_session)
        
        # Create additional users
        for i in range(5):
            user_data = {
                "username": f"user{i}",
                "email": f"user{i}@example.com",
                "hashed_password": get_password_hash("password123"),
                "first_name": f"User{i}",
                "last_name": "Test"
            }
            await repo.create(user_data)
        
        # Test pagination
        users = await repo.get_multi(skip=0, limit=3)
        assert len(users) == 3
        
        users_page_2 = await repo.get_multi(skip=3, limit=3)
        assert len(users_page_2) >= 1  # At least test_user
    
    @pytest.mark.asyncio
    async def test_update_user(self, db_session: AsyncSession, test_user: User):
        """Test user update."""
        repo = UserRepository(User, db_session)
        
        updated_user = await repo.update(test_user.id, {
            "first_name": "Updated",
            "bio": "Updated bio"
        })
        
        assert updated_user is not None
        assert updated_user.first_name == "Updated"
        assert updated_user.bio == "Updated bio"
    
    @pytest.mark.asyncio
    async def test_delete_user(self, db_session: AsyncSession, test_user: User):
        """Test user deletion."""
        repo = UserRepository(User, db_session)
        
        result = await repo.delete(test_user.id)
        assert result is True
        
        # Verify user is deleted
        deleted_user = await repo.get(test_user.id)
        assert deleted_user is None
```

## Performance Testing

```python
# tests/test_performance.py
import pytest
import time
import asyncio
from httpx import AsyncClient
from app.models.user import User
from tests.factories import UserFactory

@pytest.mark.slow
class TestPerformance:
    """Test application performance."""
    
    @pytest.mark.asyncio
    async def test_concurrent_requests(
        self, 
        async_client: AsyncClient,
        auth_headers: dict
    ):
        """Test concurrent API requests."""
        
        async def make_request():
            response = await async_client.get(
                "/api/v1/users/",
                headers=auth_headers
            )
            return response.status_code
        
        # Make 10 concurrent requests
        start_time = time.time()
        tasks = [make_request() for _ in range(10)]
        results = await asyncio.gather(*tasks)
        end_time = time.time()
        
        # All requests should succeed
        assert all(status == 200 for status in results)
        
        # Should complete within reasonable time
        assert (end_time - start_time) < 5.0
    
    @pytest.mark.asyncio
    async def test_large_dataset_pagination(
        self, 
        async_client: AsyncClient,
        db_session,
        auth_headers: dict
    ):
        """Test pagination with large dataset."""
        # Create 100 users
        users = []
        for i in range(100):
            user = UserFactory.build()
            users.append(user)
        
        db_session.add_all(users)
        await db_session.commit()
        
        # Test pagination performance
        start_time = time.time()
        response = await async_client.get(
            "/api/v1/users/?skip=0&limit=50",
            headers=auth_headers
        )
        end_time = time.time()
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 50
        
        # Should complete quickly
        assert (end_time - start_time) < 1.0
```

## Mocking External Services

```python
# tests/test_external.py
import pytest
import respx
import httpx
from app.services.email import EmailService

class TestExternalServices:
    """Test external service integrations."""
    
    @pytest.mark.asyncio
    @respx.mock
    async def test_email_service(
        self, 
        async_client: AsyncClient
    ):
        """Test email service with mocked external API."""
        # Mock email service API
        respx.post("https://api.emailservice.com/send").mock(
            return_value=httpx.Response(
                200, 
                json={"message": "Email sent successfully"}
            )
        )
        
        email_service = EmailService()
        result = await email_service.send_email(
            to="test@example.com",
            subject="Test",
            body="Test email"
        )
        
        assert result["success"] is True
```

## Test Utilities

```python
# tests/utils.py
from typing import Dict, Any
from httpx import Response
import json

def assert_response_status(response: Response, expected_status: int = 200):
    """Assert response status code."""
    assert response.status_code == expected_status, f"Expected {expected_status}, got {response.status_code}. Response: {response.text}"

def assert_response_json(response: Response, expected_keys: list[str] = None):
    """Assert response is valid JSON with expected keys."""
    assert response.headers.get("content-type") == "application/json"
    data = response.json()
    
    if expected_keys:
        for key in expected_keys:
            assert key in data, f"Missing key '{key}' in response"
    
    return data

def create_auth_headers(token: str) -> Dict[str, str]:
    """Create authorization headers with token."""
    return {"Authorization": f"Bearer {token}"}

async def create_test_users(db_session, count: int = 5) -> list:
    """Create multiple test users."""
    from tests.factories import UserFactory
    
    users = []
    for i in range(count):
        user = UserFactory.build()
        users.append(user)
    
    db_session.add_all(users)
    await db_session.commit()
    
    return users
```
