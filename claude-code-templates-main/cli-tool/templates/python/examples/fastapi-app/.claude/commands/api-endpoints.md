# FastAPI Endpoints Generator

Create comprehensive FastAPI endpoints with proper structure, validation, and documentation.

## Purpose

This command helps you quickly create FastAPI endpoints with Pydantic models, dependency injection, and automatic API documentation.

## Usage

```
/api-endpoints
```

## What this command does

1. **Creates API endpoints** with proper HTTP methods
2. **Adds Pydantic models** for request/response validation
3. **Implements dependency injection** for database and auth
4. **Includes error handling** and status codes
5. **Generates automatic documentation** with OpenAPI

## Example Output

```python
# main.py
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import uvicorn

from app.database import get_db, engine
from app.models import models
from app.routers import auth, users, posts, comments
from app.core.config import settings

# Create database tables
models.Base.metadata.create_all(bind=engine)

# Initialize FastAPI app
app = FastAPI(
    title="Blog API",
    description="A comprehensive blog API built with FastAPI",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_HOSTS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/users", tags=["Users"])
app.include_router(posts.router, prefix="/posts", tags=["Posts"])
app.include_router(comments.router, prefix="/comments", tags=["Comments"])

@app.get("/", tags=["Root"])
async def root():
    """API root endpoint."""
    return {
        "message": "Welcome to Blog API",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc"
    }

@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "timestamp": "2024-01-01T00:00:00Z"}

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
```

```python
# app/routers/posts.py
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import post_schemas
from app.services import post_service
from app.core.dependencies import get_current_user, get_current_active_user
from app.models.user import User

router = APIRouter()

@router.get("/", response_model=List[post_schemas.PostResponse])
async def get_posts(
    skip: int = Query(0, ge=0, description="Number of posts to skip"),
    limit: int = Query(10, ge=1, le=100, description="Number of posts to return"),
    search: Optional[str] = Query(None, description="Search in title and content"),
    category: Optional[str] = Query(None, description="Filter by category"),
    published: Optional[bool] = Query(True, description="Filter by published status"),
    db: Session = Depends(get_db)
):
    """
    Get all posts with pagination and filtering.
    
    - **skip**: Number of posts to skip (for pagination)
    - **limit**: Maximum number of posts to return (1-100)
    - **search**: Search term for title and content
    - **category**: Filter posts by category
    - **published**: Filter by published status
    """
    posts = post_service.get_posts(
        db=db,
        skip=skip,
        limit=limit,
        search=search,
        category=category,
        published=published
    )
    return posts

@router.get("/{post_id}", response_model=post_schemas.PostResponse)
async def get_post(
    post_id: int,
    db: Session = Depends(get_db)
):
    """
    Get a specific post by ID.
    
    - **post_id**: Unique identifier for the post
    """
    post = post_service.get_post(db=db, post_id=post_id)
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found"
        )
    return post

@router.post("/", response_model=post_schemas.PostResponse, status_code=status.HTTP_201_CREATED)
async def create_post(
    post: post_schemas.PostCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Create a new post.
    
    - **title**: Post title (required)
    - **content**: Post content (required)
    - **category**: Post category (optional)
    - **published**: Publication status (default: false)
    """
    return post_service.create_post(
        db=db,
        post=post,
        user_id=current_user.id
    )

@router.put("/{post_id}", response_model=post_schemas.PostResponse)
async def update_post(
    post_id: int,
    post_update: post_schemas.PostUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Update an existing post.
    
    - **post_id**: Unique identifier for the post
    - **title**: Updated post title (optional)
    - **content**: Updated post content (optional)
    - **category**: Updated post category (optional)
    - **published**: Updated publication status (optional)
    """
    post = post_service.get_post(db=db, post_id=post_id)
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found"
        )
    
    if post.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this post"
        )
    
    return post_service.update_post(
        db=db,
        post_id=post_id,
        post_update=post_update
    )

@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Delete a post.
    
    - **post_id**: Unique identifier for the post to delete
    """
    post = post_service.get_post(db=db, post_id=post_id)
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found"
        )
    
    if post.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this post"
        )
    
    post_service.delete_post(db=db, post_id=post_id)

@router.post("/{post_id}/like", response_model=post_schemas.PostResponse)
async def like_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Like/unlike a post.
    
    - **post_id**: Unique identifier for the post to like
    """
    post = post_service.get_post(db=db, post_id=post_id)
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found"
        )
    
    return post_service.toggle_like(
        db=db,
        post_id=post_id,
        user_id=current_user.id
    )

@router.get("/{post_id}/comments", response_model=List[post_schemas.CommentResponse])
async def get_post_comments(
    post_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """
    Get all comments for a specific post.
    
    - **post_id**: Unique identifier for the post
    - **skip**: Number of comments to skip
    - **limit**: Maximum number of comments to return
    """
    post = post_service.get_post(db=db, post_id=post_id)
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found"
        )
    
    return post_service.get_post_comments(
        db=db,
        post_id=post_id,
        skip=skip,
        limit=limit
    )
```

```python
# app/schemas/post_schemas.py
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field, validator

class PostBase(BaseModel):
    """Base post schema."""
    title: str = Field(..., min_length=1, max_length=200, description="Post title")
    content: str = Field(..., min_length=1, description="Post content")
    category: Optional[str] = Field(None, max_length=50, description="Post category")
    published: bool = Field(False, description="Publication status")

class PostCreate(PostBase):
    """Schema for creating a post."""
    
    @validator('title')
    def validate_title(cls, v):
        if not v.strip():
            raise ValueError('Title cannot be empty')
        return v.strip()
    
    @validator('content')
    def validate_content(cls, v):
        if len(v.strip()) < 10:
            raise ValueError('Content must be at least 10 characters long')
        return v.strip()

class PostUpdate(BaseModel):
    """Schema for updating a post."""
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    content: Optional[str] = Field(None, min_length=1)
    category: Optional[str] = Field(None, max_length=50)
    published: Optional[bool] = None
    
    @validator('title')
    def validate_title(cls, v):
        if v is not None and not v.strip():
            raise ValueError('Title cannot be empty')
        return v.strip() if v else v
    
    @validator('content')
    def validate_content(cls, v):
        if v is not None and len(v.strip()) < 10:
            raise ValueError('Content must be at least 10 characters long')
        return v.strip() if v else v

class PostResponse(PostBase):
    """Schema for post responses."""
    id: int
    author_id: int
    created_at: datetime
    updated_at: datetime
    like_count: int = 0
    comment_count: int = 0
    
    class Config:
        from_attributes = True

class CommentBase(BaseModel):
    """Base comment schema."""
    content: str = Field(..., min_length=1, max_length=1000, description="Comment content")

class CommentCreate(CommentBase):
    """Schema for creating a comment."""
    post_id: int = Field(..., description="ID of the post to comment on")

class CommentResponse(CommentBase):
    """Schema for comment responses."""
    id: int
    post_id: int
    author_id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
```

```python
# app/services/post_service.py
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.post import Post, Comment, PostLike
from app.schemas.post_schemas import PostCreate, PostUpdate

def get_posts(
    db: Session,
    skip: int = 0,
    limit: int = 10,
    search: Optional[str] = None,
    category: Optional[str] = None,
    published: Optional[bool] = True
) -> List[Post]:
    """Get posts with filtering and pagination."""
    query = db.query(Post)
    
    if published is not None:
        query = query.filter(Post.published == published)
    
    if category:
        query = query.filter(Post.category == category)
    
    if search:
        query = query.filter(
            or_(
                Post.title.contains(search),
                Post.content.contains(search)
            )
        )
    
    return query.offset(skip).limit(limit).all()

def get_post(db: Session, post_id: int) -> Optional[Post]:
    """Get a single post by ID."""
    return db.query(Post).filter(Post.id == post_id).first()

def create_post(db: Session, post: PostCreate, user_id: int) -> Post:
    """Create a new post."""
    db_post = Post(**post.dict(), author_id=user_id)
    db.add(db_post)
    db.commit()
    db.refresh(db_post)
    return db_post

def update_post(
    db: Session,
    post_id: int,
    post_update: PostUpdate
) -> Optional[Post]:
    """Update an existing post."""
    db_post = db.query(Post).filter(Post.id == post_id).first()
    if not db_post:
        return None
    
    update_data = post_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_post, field, value)
    
    db.commit()
    db.refresh(db_post)
    return db_post

def delete_post(db: Session, post_id: int) -> bool:
    """Delete a post."""
    db_post = db.query(Post).filter(Post.id == post_id).first()
    if not db_post:
        return False
    
    db.delete(db_post)
    db.commit()
    return True

def toggle_like(db: Session, post_id: int, user_id: int) -> Post:
    """Toggle like status for a post."""
    existing_like = db.query(PostLike).filter(
        PostLike.post_id == post_id,
        PostLike.user_id == user_id
    ).first()
    
    if existing_like:
        db.delete(existing_like)
    else:
        new_like = PostLike(post_id=post_id, user_id=user_id)
        db.add(new_like)
    
    db.commit()
    return get_post(db, post_id)
```

## Features Included

### API Documentation
- **Automatic OpenAPI** schema generation
- **Interactive docs** at `/docs`
- **ReDoc documentation** at `/redoc`
- **Request/Response examples** in schemas

### Validation & Serialization
- **Pydantic models** for data validation
- **Custom validators** for business rules
- **Type hints** for better IDE support
- **Automatic data conversion** and validation

### Error Handling
- **HTTP status codes** for different scenarios
- **Detailed error messages** with context
- **Input validation errors** with field-specific messages
- **Custom exception handlers** for consistent responses

### Security
- **JWT authentication** with dependencies
- **Role-based access control** for endpoints
- **CORS middleware** for cross-origin requests
- **Input sanitization** through Pydantic

### Performance
- **Database query optimization** with SQLAlchemy
- **Pagination support** for large datasets
- **Async/await support** for concurrent requests
- **Connection pooling** for database efficiency

## Testing Example

```python
# tests/test_posts.py
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_get_posts():
    """Test getting posts."""
    response = client.get("/posts/")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_create_post():
    """Test creating a new post."""
    post_data = {
        "title": "Test Post",
        "content": "This is a test post content.",
        "published": True
    }
    response = client.post("/posts/", json=post_data)
    assert response.status_code == 201
    assert response.json()["title"] == "Test Post"
```