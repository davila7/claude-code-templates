# FastAPI Authentication & Authorization

Complete authentication system with JWT tokens, OAuth2, and role-based access control.

## Usage

```bash
# Install auth dependencies
pip install python-jose[cryptography] passlib[bcrypt] python-multipart

# Generate secret key
openssl rand -hex 32
```

## JWT Configuration

```python
# app/core/security.py
from datetime import datetime, timedelta
from typing import Optional, Union, Any
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.core.config import settings

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT settings
SECRET_KEY = settings.SECRET_KEY
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7

def create_access_token(
    subject: Union[str, Any], 
    expires_delta: Optional[timedelta] = None
) -> str:
    """Create JWT access token."""
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode = {"exp": expire, "sub": str(subject), "type": "access"}
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token(subject: Union[str, Any]) -> str:
    """Create JWT refresh token."""
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode = {"exp": expire, "sub": str(subject), "type": "refresh"}
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash."""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Generate password hash."""
    return pwd_context.hash(password)

def decode_token(token: str) -> Optional[dict]:
    """Decode and verify JWT token."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None
```

## Authentication Dependencies

```python
# app/api/dependencies/auth.py
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.security import decode_token
from app.db.database import get_db
from app.models.user import User
from app.repositories.user import UserRepository

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/login",
    scheme_name="JWT"
)

# Bearer token scheme
security = HTTPBearer()

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Get current authenticated user."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    payload = decode_token(token)
    if payload is None:
        raise credentials_exception
    
    user_id: str = payload.get("sub")
    token_type: str = payload.get("type")
    
    if user_id is None or token_type != "access":
        raise credentials_exception
    
    user_repo = UserRepository(User, db)
    user = await user_repo.get(int(user_id))
    
    if user is None:
        raise credentials_exception
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    
    return user

async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Get current active user."""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    return current_user

async def get_current_superuser(
    current_user: User = Depends(get_current_user)
) -> User:
    """Get current superuser."""
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user

def require_permissions(*permissions: str):
    """Decorator for permission-based access control."""
    async def permission_checker(
        current_user: User = Depends(get_current_active_user)
    ) -> User:
        # Check if user has required permissions
        user_permissions = set(current_user.permissions or [])
        required_permissions = set(permissions)
        
        if not required_permissions.issubset(user_permissions) and not current_user.is_superuser:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )
        
        return current_user
    
    return permission_checker

def require_roles(*roles: str):
    """Decorator for role-based access control."""
    async def role_checker(
        current_user: User = Depends(get_current_active_user)
    ) -> User:
        user_roles = set(role.name for role in current_user.roles or [])
        required_roles = set(roles)
        
        if not required_roles.issubset(user_roles) and not current_user.is_superuser:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient role permissions"
            )
        
        return current_user
    
    return role_checker
```

## Authentication Schemas

```python
# app/schemas/auth.py
from pydantic import BaseModel, EmailStr
from typing import Optional

class Token(BaseModel):
    """Token response schema."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int

class TokenPayload(BaseModel):
    """Token payload schema."""
    sub: Optional[int] = None
    exp: Optional[int] = None
    type: Optional[str] = None

class UserLogin(BaseModel):
    """User login schema."""
    username: str
    password: str

class UserRegister(BaseModel):
    """User registration schema."""
    username: str
    email: EmailStr
    password: str
    first_name: str
    last_name: str

class PasswordReset(BaseModel):
    """Password reset schema."""
    email: EmailStr

class PasswordResetConfirm(BaseModel):
    """Password reset confirmation schema."""
    token: str
    new_password: str

class ChangePassword(BaseModel):
    """Change password schema."""
    current_password: str
    new_password: str

class RefreshToken(BaseModel):
    """Refresh token schema."""
    refresh_token: str
```

## Authentication Endpoints

```python
# app/api/v1/auth.py
from datetime import timedelta
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import get_db
from app.models.user import User
from app.repositories.user import UserRepository
from app.schemas.auth import (
    Token, UserLogin, UserRegister, PasswordReset, 
    PasswordResetConfirm, ChangePassword, RefreshToken
)
from app.schemas.user import UserCreate, UserResponse
from app.core.security import (
    create_access_token, create_refresh_token, verify_password,
    decode_token, ACCESS_TOKEN_EXPIRE_MINUTES
)
from app.api.dependencies.auth import get_current_user, get_current_active_user
from app.services.email import send_password_reset_email
from app.services.auth import AuthService

router = APIRouter()

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserRegister,
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Register new user."""
    user_repo = UserRepository(User, db)
    auth_service = AuthService(user_repo)
    
    # Check if user already exists
    if await user_repo.get_by_email(user_data.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    if await user_repo.get_by_username(user_data.username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken"
        )
    
    # Create user
    user = await auth_service.create_user(user_data.dict())
    return user

@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """OAuth2 compatible token login."""
    user_repo = UserRepository(User, db)
    auth_service = AuthService(user_repo)
    
    user = await auth_service.authenticate_user(
        form_data.username, 
        form_data.password
    )
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    
    # Create tokens
    access_token = create_access_token(subject=user.id)
    refresh_token = create_refresh_token(subject=user.id)
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60
    }

@router.post("/refresh", response_model=Token)
async def refresh_token(
    refresh_data: RefreshToken,
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Refresh access token."""
    payload = decode_token(refresh_data.refresh_token)
    
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    user_repo = UserRepository(User, db)
    user = await user_repo.get(int(user_id))
    
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    # Create new tokens
    access_token = create_access_token(subject=user.id)
    new_refresh_token = create_refresh_token(subject=user.id)
    
    return {
        "access_token": access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60
    }

@router.get("/me", response_model=UserResponse)
async def read_users_me(
    current_user: User = Depends(get_current_active_user)
) -> Any:
    """Get current user."""
    return current_user

@router.post("/change-password", status_code=status.HTTP_200_OK)
async def change_password(
    password_data: ChangePassword,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Change user password."""
    if not verify_password(password_data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect current password"
        )
    
    user_repo = UserRepository(User, db)
    auth_service = AuthService(user_repo)
    
    await auth_service.change_password(current_user.id, password_data.new_password)
    
    return {"message": "Password changed successfully"}

@router.post("/password-reset", status_code=status.HTTP_200_OK)
async def password_reset(
    reset_data: PasswordReset,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Request password reset."""
    user_repo = UserRepository(User, db)
    user = await user_repo.get_by_email(reset_data.email)
    
    if user:
        # Generate reset token
        reset_token = create_access_token(
            subject=user.id,
            expires_delta=timedelta(hours=1)  # 1 hour expiry
        )
        
        # Send email with reset token
        background_tasks.add_task(
            send_password_reset_email,
            email=user.email,
            username=user.username,
            token=reset_token
        )
    
    # Always return success to prevent email enumeration
    return {"message": "Password reset email sent if account exists"}

@router.post("/password-reset-confirm", status_code=status.HTTP_200_OK)
async def password_reset_confirm(
    reset_data: PasswordResetConfirm,
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Confirm password reset."""
    payload = decode_token(reset_data.token)
    
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )
    
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid reset token"
        )
    
    user_repo = UserRepository(User, db)
    auth_service = AuthService(user_repo)
    
    user = await user_repo.get(int(user_id))
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid reset token"
        )
    
    await auth_service.change_password(user.id, reset_data.new_password)
    
    return {"message": "Password reset successful"}

@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(
    current_user: User = Depends(get_current_user)
) -> Any:
    """Logout user (invalidate token on client side)."""
    # In a more sophisticated setup, you might want to blacklist the token
    return {"message": "Successfully logged out"}
```

## Authentication Service

```python
# app/services/auth.py
from typing import Optional
from app.models.user import User
from app.repositories.user import UserRepository
from app.core.security import verify_password, get_password_hash

class AuthService:
    """Authentication service."""
    
    def __init__(self, user_repository: UserRepository):
        self.user_repo = user_repository
    
    async def authenticate_user(
        self, 
        username_or_email: str, 
        password: str
    ) -> Optional[User]:
        """Authenticate user by username/email and password."""
        # Try to get user by username first, then by email
        user = await self.user_repo.get_by_username(username_or_email)
        if not user:
            user = await self.user_repo.get_by_email(username_or_email)
        
        if not user:
            return None
        
        if not verify_password(password, user.hashed_password):
            return None
        
        return user
    
    async def create_user(self, user_data: dict) -> User:
        """Create new user."""
        # Hash password
        password = user_data.pop('password')
        hashed_password = get_password_hash(password)
        
        # Create user data
        user_create_data = {
            **user_data,
            'hashed_password': hashed_password,
            'is_active': True,
            'is_superuser': False
        }
        
        return await self.user_repo.create(user_create_data)
    
    async def change_password(self, user_id: int, new_password: str) -> bool:
        """Change user password."""
        hashed_password = get_password_hash(new_password)
        
        result = await self.user_repo.update(user_id, {
            'hashed_password': hashed_password
        })
        
        return result is not None
    
    async def activate_user(self, user_id: int) -> bool:
        """Activate user account."""
        result = await self.user_repo.update(user_id, {'is_active': True})
        return result is not None
    
    async def deactivate_user(self, user_id: int) -> bool:
        """Deactivate user account."""
        result = await self.user_repo.update(user_id, {'is_active': False})
        return result is not None
```

## Role-Based Access Control

```python
# app/models/rbac.py
from sqlalchemy import Column, String, Text, ForeignKey, Table
from sqlalchemy.orm import relationship
from app.models.base import BaseModel

# Association tables for many-to-many relationships
user_roles = Table(
    'user_roles',
    Base.metadata,
    Column('user_id', Integer, ForeignKey('users.id')),
    Column('role_id', Integer, ForeignKey('roles.id'))
)

role_permissions = Table(
    'role_permissions',
    Base.metadata,
    Column('role_id', Integer, ForeignKey('roles.id')),
    Column('permission_id', Integer, ForeignKey('permissions.id'))
)

class Role(BaseModel):
    """Role model for RBAC."""
    __tablename__ = "roles"
    
    name = Column(String(50), unique=True, nullable=False, index=True)
    description = Column(Text)
    
    # Relationships
    users = relationship("User", secondary=user_roles, back_populates="roles")
    permissions = relationship("Permission", secondary=role_permissions, back_populates="roles")

class Permission(BaseModel):
    """Permission model for RBAC."""
    __tablename__ = "permissions"
    
    name = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text)
    resource = Column(String(50), nullable=False)  # e.g., 'users', 'posts'
    action = Column(String(50), nullable=False)    # e.g., 'create', 'read', 'update', 'delete'
    
    # Relationships
    roles = relationship("Role", secondary=role_permissions, back_populates="permissions")

# Update User model to include roles
class User(BaseModel):
    # ... existing fields ...
    
    # Relationships
    roles = relationship("Role", secondary=user_roles, back_populates="users")
    
    @property
    def permissions(self) -> list[str]:
        """Get all permissions for user."""
        perms = set()
        for role in self.roles:
            for permission in role.permissions:
                perms.add(f"{permission.resource}:{permission.action}")
        return list(perms)
```

## OAuth2 Integration

```python
# app/api/v1/oauth.py
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security.utils import get_authorization_scheme_param
from starlette.requests import Request
from authlib.integrations.starlette_client import OAuth
from app.core.config import settings

router = APIRouter()

# OAuth configuration
oauth = OAuth()

# Google OAuth
google = oauth.register(
    name='google',
    client_id=settings.GOOGLE_CLIENT_ID,
    client_secret=settings.GOOGLE_CLIENT_SECRET,
    server_metadata_url='https://accounts.google.com/.well-known/openid_configuration',
    client_kwargs={
        'scope': 'openid email profile'
    }
)

# GitHub OAuth
github = oauth.register(
    name='github',
    client_id=settings.GITHUB_CLIENT_ID,
    client_secret=settings.GITHUB_CLIENT_SECRET,
    access_token_url='https://github.com/login/oauth/access_token',
    access_token_params=None,
    authorize_url='https://github.com/login/oauth/authorize',
    authorize_params=None,
    api_base_url='https://api.github.com/',
    client_kwargs={'scope': 'user:email'},
)

@router.get('/google')
async def google_login(request: Request):
    """Initiate Google OAuth login."""
    redirect_uri = request.url_for('google_callback')
    return await google.authorize_redirect(request, redirect_uri)

@router.get('/google/callback')
async def google_callback(request: Request):
    """Handle Google OAuth callback."""
    token = await google.authorize_access_token(request)
    user_info = token.get('userinfo')
    
    if user_info:
        # Create or get user
        # Generate JWT token
        # Return token
        pass
    
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="OAuth authentication failed"
    )
```

## API Key Authentication

```python
# app/models/api_key.py
from sqlalchemy import Column, String, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from app.models.base import BaseModel
import secrets

class APIKey(BaseModel):
    """API Key model."""
    __tablename__ = "api_keys"
    
    name = Column(String(100), nullable=False)
    key_hash = Column(String(255), unique=True, nullable=False, index=True)
    prefix = Column(String(10), nullable=False, index=True)
    is_active = Column(Boolean, default=True, nullable=False)
    expires_at = Column(DateTime)
    last_used_at = Column(DateTime)
    
    # Foreign key
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Relationships
    user = relationship("User", back_populates="api_keys")
    
    @classmethod
    def generate_key(cls) -> tuple[str, str]:
        """Generate API key and return (key, hash)."""
        key = secrets.token_urlsafe(32)
        prefix = key[:8]
        key_hash = get_password_hash(key)
        return key, prefix, key_hash
    
    def verify_key(self, key: str) -> bool:
        """Verify API key."""
        return verify_password(key, self.key_hash)

# Add to User model
class User(BaseModel):
    # ... existing fields ...
    
    # Relationships
    api_keys = relationship("APIKey", back_populates="user", cascade="all, delete-orphan")
```

## Testing Authentication

```python
# tests/test_auth.py
import pytest
from httpx import AsyncClient
from app.core.security import create_access_token

@pytest.mark.asyncio
async def test_register_user(client: AsyncClient):
    """Test user registration."""
    user_data = {
        "username": "testuser",
        "email": "test@example.com",
        "password": "testpass123",
        "first_name": "Test",
        "last_name": "User"
    }
    
    response = await client.post("/api/v1/auth/register", json=user_data)
    assert response.status_code == 201
    
    data = response.json()
    assert data["username"] == user_data["username"]
    assert data["email"] == user_data["email"]
    assert "hashed_password" not in data

@pytest.mark.asyncio
async def test_login_user(client: AsyncClient, test_user):
    """Test user login."""
    login_data = {
        "username": test_user.username,
        "password": "testpass123"
    }
    
    response = await client.post(
        "/api/v1/auth/login", 
        data=login_data,
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    
    assert response.status_code == 200
    
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"

@pytest.mark.asyncio
async def test_get_current_user(client: AsyncClient, test_user):
    """Test get current user endpoint."""
    token = create_access_token(subject=test_user.id)
    headers = {"Authorization": f"Bearer {token}"}
    
    response = await client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 200
    
    data = response.json()
    assert data["username"] == test_user.username
    assert data["email"] == test_user.email
```
