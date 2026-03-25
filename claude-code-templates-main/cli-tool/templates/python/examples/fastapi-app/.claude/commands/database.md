# FastAPI Database Integration

Complete database setup with SQLAlchemy, Alembic, and async support for FastAPI.

## Usage

```bash
# Initialize Alembic
alembic init alembic

# Create migration
alembic revision --autogenerate -m "Initial migration"

# Apply migrations
alembic upgrade head

# Downgrade migration
alembic downgrade -1
```

## Database Configuration

```python
# app/core/config.py
from pydantic import BaseSettings, PostgresDsn, validator
from typing import Optional, Dict, Any
import os

class Settings(BaseSettings):
    """Application settings."""
    
    # Database
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "password"
    POSTGRES_DB: str = "fastapi_app"
    POSTGRES_PORT: str = "5432"
    DATABASE_URL: Optional[PostgresDsn] = None
    
    @validator("DATABASE_URL", pre=True)
    def assemble_db_connection(cls, v: Optional[str], values: Dict[str, Any]) -> Any:
        if isinstance(v, str):
            return v
        return PostgresDsn.build(
            scheme="postgresql+asyncpg",
            user=values.get("POSTGRES_USER"),
            password=values.get("POSTGRES_PASSWORD"),
            host=values.get("POSTGRES_SERVER"),
            port=values.get("POSTGRES_PORT"),
            path=f"/{values.get('POSTGRES_DB') or ''}",
        )
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # Database settings
    DATABASE_POOL_SIZE: int = 10
    DATABASE_MAX_OVERFLOW: int = 20
    DATABASE_POOL_RECYCLE: int = 3600
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
```

## Database Setup

```python
# app/db/database.py
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# Create async engine
engine = create_async_engine(
    str(settings.DATABASE_URL),
    pool_size=settings.DATABASE_POOL_SIZE,
    max_overflow=settings.DATABASE_MAX_OVERFLOW,
    pool_recycle=settings.DATABASE_POOL_RECYCLE,
    pool_pre_ping=True,
    echo=False  # Set to True for SQL debugging
)

# Create async session factory
AsyncSessionLocal = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

# Base class for models
Base = declarative_base()

async def get_db() -> AsyncSession:
    """Dependency to get database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

async def create_tables():
    """Create database tables."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

async def drop_tables():
    """Drop database tables."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
```

## Base Model

```python
# app/models/base.py
from sqlalchemy import Column, Integer, DateTime, func
from sqlalchemy.ext.declarative import declared_attr
from app.db.database import Base
from datetime import datetime
from typing import Any

class TimestampMixin:
    """Mixin for timestamp fields."""
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )

class BaseModel(Base, TimestampMixin):
    """Base model with common functionality."""
    __abstract__ = True
    
    id = Column(Integer, primary_key=True, index=True)
    
    @declared_attr
    def __tablename__(cls) -> str:
        return cls.__name__.lower()
    
    def dict(self, exclude: set = None) -> dict[str, Any]:
        """Convert model to dictionary."""
        exclude = exclude or set()
        return {
            column.name: getattr(self, column.name)
            for column in self.__table__.columns
            if column.name not in exclude
        }
    
    def __repr__(self) -> str:
        return f"<{self.__class__.__name__}(id={self.id})>"
```

## Example Models

```python
# app/models/user.py
from sqlalchemy import Column, String, Boolean, Text, Index
from sqlalchemy.orm import relationship
from app.models.base import BaseModel
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class User(BaseModel):
    """User model."""
    __tablename__ = "users"
    
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    first_name = Column(String(50), nullable=False)
    last_name = Column(String(50), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_superuser = Column(Boolean, default=False, nullable=False)
    bio = Column(Text)
    
    # Relationships
    posts = relationship("Post", back_populates="author", cascade="all, delete-orphan")
    
    # Indexes
    __table_args__ = (
        Index('idx_user_email_active', email, is_active),
        Index('idx_user_username_active', username, is_active),
    )
    
    def verify_password(self, password: str) -> bool:
        """Verify password against hash."""
        return pwd_context.verify(password, self.hashed_password)
    
    @staticmethod
    def get_password_hash(password: str) -> str:
        """Generate password hash."""
        return pwd_context.hash(password)
    
    def set_password(self, password: str) -> None:
        """Set user password."""
        self.hashed_password = self.get_password_hash(password)
    
    @property
    def full_name(self) -> str:
        """Get user's full name."""
        return f"{self.first_name} {self.last_name}"
    
    def dict(self, exclude: set = None) -> dict:
        """Convert to dict excluding sensitive data."""
        exclude = exclude or set()
        exclude.add('hashed_password')
        return super().dict(exclude=exclude)

# app/models/post.py
from sqlalchemy import Column, String, Text, ForeignKey, Boolean, Index
from sqlalchemy.orm import relationship
from app.models.base import BaseModel

class Post(BaseModel):
    """Blog post model."""
    __tablename__ = "posts"
    
    title = Column(String(200), nullable=False, index=True)
    content = Column(Text, nullable=False)
    slug = Column(String(200), unique=True, nullable=False, index=True)
    is_published = Column(Boolean, default=False, nullable=False)
    
    # Foreign keys
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Relationships
    author = relationship("User", back_populates="posts")
    
    # Indexes
    __table_args__ = (
        Index('idx_post_published_created', is_published, 'created_at'),
        Index('idx_post_author_published', author_id, is_published),
    )
```

## Repository Pattern

```python
# app/repositories/base.py
from typing import Generic, TypeVar, Type, Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, func
from sqlalchemy.orm import selectinload
from app.models.base import BaseModel

ModelType = TypeVar("ModelType", bound=BaseModel)

class BaseRepository(Generic[ModelType]):
    """Base repository with common CRUD operations."""
    
    def __init__(self, model: Type[ModelType], db: AsyncSession):
        self.model = model
        self.db = db
    
    async def get(self, id: int) -> Optional[ModelType]:
        """Get model by ID."""
        result = await self.db.execute(
            select(self.model).where(self.model.id == id)
        )
        return result.scalar_one_or_none()
    
    async def get_multi(
        self, 
        skip: int = 0, 
        limit: int = 100,
        filters: Dict[str, Any] = None
    ) -> List[ModelType]:
        """Get multiple models with pagination."""
        query = select(self.model)
        
        if filters:
            for field, value in filters.items():
                if hasattr(self.model, field):
                    query = query.where(getattr(self.model, field) == value)
        
        query = query.offset(skip).limit(limit)
        result = await self.db.execute(query)
        return result.scalars().all()
    
    async def create(self, obj_in: Dict[str, Any]) -> ModelType:
        """Create new model."""
        db_obj = self.model(**obj_in)
        self.db.add(db_obj)
        await self.db.commit()
        await self.db.refresh(db_obj)
        return db_obj
    
    async def update(
        self, 
        id: int, 
        obj_in: Dict[str, Any]
    ) -> Optional[ModelType]:
        """Update model by ID."""
        await self.db.execute(
            update(self.model)
            .where(self.model.id == id)
            .values(**obj_in)
        )
        await self.db.commit()
        return await self.get(id)
    
    async def delete(self, id: int) -> bool:
        """Delete model by ID."""
        result = await self.db.execute(
            delete(self.model).where(self.model.id == id)
        )
        await self.db.commit()
        return result.rowcount > 0
    
    async def count(self, filters: Dict[str, Any] = None) -> int:
        """Count models with optional filters."""
        query = select(func.count(self.model.id))
        
        if filters:
            for field, value in filters.items():
                if hasattr(self.model, field):
                    query = query.where(getattr(self.model, field) == value)
        
        result = await self.db.execute(query)
        return result.scalar()

# app/repositories/user.py
from typing import Optional
from sqlalchemy import select
from app.models.user import User
from app.repositories.base import BaseRepository

class UserRepository(BaseRepository[User]):
    """User repository with custom methods."""
    
    async def get_by_email(self, email: str) -> Optional[User]:
        """Get user by email."""
        result = await self.db.execute(
            select(User).where(User.email == email)
        )
        return result.scalar_one_or_none()
    
    async def get_by_username(self, username: str) -> Optional[User]:
        """Get user by username."""
        result = await self.db.execute(
            select(User).where(User.username == username)
        )
        return result.scalar_one_or_none()
    
    async def get_active_users(self, skip: int = 0, limit: int = 100):
        """Get active users."""
        return await self.get_multi(
            skip=skip, 
            limit=limit, 
            filters={'is_active': True}
        )
```

## Alembic Configuration

```python
# alembic/env.py
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from sqlalchemy.ext.asyncio import AsyncEngine
from alembic import context
import asyncio

# Import your models
from app.models.base import Base
from app.models.user import User
from app.models.post import Post
from app.core.config import settings

# Alembic Config object
config = context.config

# Override database URL
config.set_main_option("sqlalchemy.url", str(settings.DATABASE_URL))

# Interpret the config file for logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Add your model's MetaData object here
target_metadata = Base.metadata

def do_run_migrations(connection):
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
    )
    
    with context.begin_transaction():
        context.run_migrations()

async def run_migrations_online():
    """Run migrations in 'online' mode."""
    configuration = config.get_section(config.config_ini_section)
    configuration["sqlalchemy.url"] = str(settings.DATABASE_URL)
    
    connectable = AsyncEngine(
        engine_from_config(
            configuration,
            prefix="sqlalchemy.",
            poolclass=pool.NullPool,
        )
    )
    
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    
    await connectable.dispose()

if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
```

## Database Utilities

```python
# app/db/utils.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.db.database import engine, AsyncSessionLocal
from app.core.config import settings
import asyncio

async def check_database_connection() -> bool:
    """Check if database is accessible."""
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
            return True
    except Exception:
        return False

async def create_database_if_not_exists():
    """Create database if it doesn't exist."""
    # This is PostgreSQL specific
    import asyncpg
    from urllib.parse import urlparse
    
    url = urlparse(str(settings.DATABASE_URL))
    
    try:
        # Connect to postgres database to create our database
        conn = await asyncpg.connect(
            host=url.hostname,
            port=url.port,
            user=url.username,
            password=url.password,
            database='postgres'
        )
        
        # Check if database exists
        exists = await conn.fetchval(
            "SELECT 1 FROM pg_database WHERE datname = $1",
            url.path[1:]  # Remove leading slash
        )
        
        if not exists:
            await conn.execute(f'CREATE DATABASE "{url.path[1:]}"')
            print(f"Database {url.path[1:]} created.")
        
        await conn.close()
        
    except Exception as e:
        print(f"Error creating database: {e}")

async def execute_raw_sql(sql: str, params: dict = None) -> list:
    """Execute raw SQL query."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(text(sql), params or {})
        return result.fetchall()

async def get_table_info(table_name: str) -> dict:
    """Get information about a table."""
    sql = """
    SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
    FROM information_schema.columns 
    WHERE table_name = :table_name
    ORDER BY ordinal_position;
    """
    
    result = await execute_raw_sql(sql, {'table_name': table_name})
    return [
        {
            'column_name': row[0],
            'data_type': row[1],
            'is_nullable': row[2],
            'column_default': row[3]
        }
        for row in result
    ]
```

## Database Initialization

```python
# app/db/init_db.py
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import get_db, create_tables
from app.models.user import User
from app.repositories.user import UserRepository
from app.core.config import settings
import asyncio

async def init_db() -> None:
    """Initialize database with tables and default data."""
    # Create tables
    await create_tables()
    print("Database tables created.")
    
    # Create default superuser
    async with AsyncSessionLocal() as session:
        user_repo = UserRepository(User, session)
        
        # Check if superuser exists
        existing_user = await user_repo.get_by_email("admin@example.com")
        
        if not existing_user:
            superuser_data = {
                "username": "admin",
                "email": "admin@example.com",
                "first_name": "Admin",
                "last_name": "User",
                "is_superuser": True,
                "is_active": True
            }
            
            superuser = User(**superuser_data)
            superuser.set_password("admin123")
            
            session.add(superuser)
            await session.commit()
            print("Superuser created.")
        else:
            print("Superuser already exists.")

if __name__ == "__main__":
    asyncio.run(init_db())
```

## Testing Database

```python
# tests/conftest.py
import pytest
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.db.database import Base, get_db
from app.main import app
import pytest_asyncio

# Test database URL
TEST_DATABASE_URL = "sqlite+aiosqlite:///./test.db"

@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest_asyncio.fixture(scope="session")
async def test_engine():
    """Create test database engine."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    yield engine
    
    # Drop tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    
    await engine.dispose()

@pytest_asyncio.fixture
async def test_session(test_engine):
    """Create test database session."""
    TestSessionLocal = sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )
    
    async with TestSessionLocal() as session:
        yield session

@pytest.fixture
def override_get_db(test_session):
    """Override database dependency."""
    async def _override_get_db():
        yield test_session
    
    app.dependency_overrides[get_db] = _override_get_db
    yield
    app.dependency_overrides = {}
```

## Database Health Check

```python
# app/api/health.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.db.database import get_db
import time

router = APIRouter()

@router.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    """Health check endpoint."""
    checks = {
        "status": "healthy",
        "timestamp": time.time(),
        "database": await check_database_health(db),
    }
    
    # Determine overall status
    if checks["database"]["status"] != "ok":
        checks["status"] = "unhealthy"
        raise HTTPException(status_code=503, detail=checks)
    
    return checks

async def check_database_health(db: AsyncSession) -> dict:
    """Check database connection."""
    try:
        start_time = time.time()
        await db.execute(text("SELECT 1"))
        response_time = (time.time() - start_time) * 1000  # milliseconds
        
        return {
            "status": "ok",
            "response_time_ms": round(response_time, 2)
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
        }
```
