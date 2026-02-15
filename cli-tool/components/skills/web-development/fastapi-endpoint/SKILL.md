---
name: fastapi-endpoint
description: Plan and build production-ready FastAPI endpoints with async SQLAlchemy, Pydantic v2 models, dependency injection for auth, and pytest tests. Uses interview-driven planning to clarify data models, authentication method, pagination strategy, and caching before writing any code.
tags: [fastapi, python, api, async, pydantic, sqlalchemy, backend]
---

# FastAPI Endpoint Builder

## When to use

Use this skill when you need to:

- Add new API endpoints to an existing FastAPI project
- Build CRUD operations with proper validation and error handling
- Set up authenticated endpoints with dependency injection
- Create async database queries with SQLAlchemy 2.0
- Generate complete test coverage for API routes

## Phase 1: Explore (Plan Mode)

Enter plan mode. Before writing any code, explore the existing project to understand:

### Project structure
- Find the FastAPI app entry point (`main.py`, `app.py`, or `app/__init__.py`)
- Identify the router organization pattern (single file vs `routers/` directory)
- Check for existing `models/`, `schemas/`, `crud/`, or `services/` directories
- Look at `pyproject.toml` or `requirements.txt` for installed dependencies

### Existing patterns
- How are existing endpoints structured? (function-based vs class-based)
- What ORM is used? (SQLAlchemy 2.0 async, Tortoise, raw SQL, none)
- How is the database session managed? (`Depends(get_db)`, middleware, other)
- What auth pattern exists? (OAuth2PasswordBearer, API key header, custom)
- Are there existing Pydantic base models or shared schemas?
- What response format is standard? (direct model, wrapped `{"data": ..., "meta": ...}`)

### Test patterns
- Where do tests live? (`tests/`, `test_*.py`, `*_test.py`)
- What test client is used? (httpx AsyncClient, TestClient, pytest-asyncio)
- Are there test fixtures for database and auth?

## Phase 2: Interview (AskUserQuestion)

Use AskUserQuestion to clarify requirements. Ask in rounds — do NOT dump all questions at once.

### Round 1: Core endpoint

```
Question: "What resource does this endpoint manage?"
Header: "Resource"
Options:
  - "New resource (I'll describe the fields)" — Creating a new data model from scratch
  - "Existing model (extend it)" — Adding endpoints for a model that already exists in the codebase
  - "Relationship endpoint (nested)" — e.g., /users/{id}/orders — endpoint on a related resource

Question: "Which HTTP methods do you need?"
Header: "Methods"
multiSelect: true
Options:
  - "Full CRUD (GET list, GET detail, POST, PUT/PATCH, DELETE)" — All standard operations
  - "Read-only (GET list + GET detail)" — No mutations
  - "Custom action (POST /resource/{id}/action)" — Business logic endpoint, not standard CRUD
```

### Round 2: Data model (if new resource)

```
Question: "What fields does the resource have? (describe briefly)"
Header: "Fields"
Options:
  - "Simple (< 6 fields, basic types)" — Strings, ints, booleans, dates
  - "Medium (6-15 fields, some relations)" — Includes foreign keys or enums
  - "Complex (nested objects, polymorphic)" — JSON fields, discriminated unions, computed fields
```

### Round 3: Auth and access control

```
Question: "How should this endpoint be authenticated?"
Header: "Auth"
Options:
  - "JWT Bearer token (Recommended)" — OAuth2PasswordBearer with JWT decode
  - "API Key header" — X-API-Key header validation
  - "No auth (public)" — Open endpoint, no authentication required
  - "Use existing auth" — Reuse the auth dependency already in the project

Question: "Do you need role-based access control?"
Header: "RBAC"
Options:
  - "No — any authenticated user" — Single permission level
  - "Yes — role check (admin, user, etc.)" — Require specific roles per endpoint
  - "Yes — ownership check" — Users can only access their own resources
```

### Round 4: Pagination, filtering, caching

```
Question: "What pagination style for list endpoints?"
Header: "Pagination"
Options:
  - "Cursor-based (Recommended)" — Best for real-time data, no offset drift
  - "Offset/limit" — Simple, good for admin panels with page numbers
  - "No pagination" — Small datasets, return all results

Question: "Do you need response caching?"
Header: "Caching"
Options:
  - "No caching" — Fresh data on every request
  - "Cache-Control headers" — Client-side caching via HTTP headers
  - "Redis/in-memory cache" — Server-side caching with TTL
```

## Phase 3: Plan (ExitPlanMode)

Write a concrete implementation plan covering:

1. **Files to create/modify** — exact paths based on project structure discovered in Phase 1
2. **Pydantic schemas** — `Create`, `Update`, `Response`, and `List` schemas with field types
3. **SQLAlchemy model** — table name, columns, relationships, indexes
4. **CRUD/service layer** — async functions for each operation
5. **Router** — endpoint signatures, status codes, response models
6. **Dependencies** — auth, pagination, filtering dependencies
7. **Tests** — test cases for happy path, validation errors, auth failures, not found

Present via ExitPlanMode for user approval.

## Phase 4: Execute

After approval, implement following this order:

### Step 1: Pydantic schemas

```python
from pydantic import BaseModel, ConfigDict
from datetime import datetime
from uuid import UUID

class ResourceBase(BaseModel):
    """Shared fields between create and response."""
    name: str
    # ... fields from interview

class ResourceCreate(ResourceBase):
    """Fields required to create the resource."""
    pass

class ResourceUpdate(BaseModel):
    """All fields optional for partial updates."""
    name: str | None = None

class ResourceResponse(ResourceBase):
    """Full resource with DB-generated fields."""
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    created_at: datetime
    updated_at: datetime

class ResourceListResponse(BaseModel):
    """Paginated list response."""
    data: list[ResourceResponse]
    next_cursor: str | None = None
    has_more: bool
```

### Step 2: SQLAlchemy model

```python
from sqlalchemy import Column, String, DateTime, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
import uuid
from app.database import Base

class Resource(Base):
    __tablename__ = "resources"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
```

### Step 3: CRUD/service layer

```python
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID

async def get_resource(db: AsyncSession, resource_id: UUID) -> Resource | None:
    result = await db.execute(select(Resource).where(Resource.id == resource_id))
    return result.scalar_one_or_none()

async def list_resources(
    db: AsyncSession,
    cursor: str | None = None,
    limit: int = 20,
) -> tuple[list[Resource], str | None]:
    query = select(Resource).order_by(Resource.created_at.desc()).limit(limit + 1)
    if cursor:
        query = query.where(Resource.created_at < decode_cursor(cursor))
    result = await db.execute(query)
    items = list(result.scalars().all())
    next_cursor = encode_cursor(items[-1].created_at) if len(items) > limit else None
    return items[:limit], next_cursor

async def create_resource(db: AsyncSession, data: ResourceCreate) -> Resource:
    resource = Resource(**data.model_dump())
    db.add(resource)
    await db.commit()
    await db.refresh(resource)
    return resource

async def update_resource(
    db: AsyncSession, resource_id: UUID, data: ResourceUpdate
) -> Resource | None:
    resource = await get_resource(db, resource_id)
    if not resource:
        return None
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(resource, field, value)
    await db.commit()
    await db.refresh(resource)
    return resource

async def delete_resource(db: AsyncSession, resource_id: UUID) -> bool:
    resource = await get_resource(db, resource_id)
    if not resource:
        return False
    await db.delete(resource)
    await db.commit()
    return True
```

### Step 4: Router with dependencies

```python
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

router = APIRouter(prefix="/resources", tags=["resources"])

@router.get("", response_model=ResourceListResponse)
async def list_resources_endpoint(
    cursor: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),  # if auth required
):
    items, next_cursor = await list_resources(db, cursor=cursor, limit=limit)
    return ResourceListResponse(
        data=items,
        next_cursor=next_cursor,
        has_more=next_cursor is not None,
    )

@router.get("/{resource_id}", response_model=ResourceResponse)
async def get_resource_endpoint(
    resource_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    resource = await get_resource(db, resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    return resource

@router.post("", response_model=ResourceResponse, status_code=status.HTTP_201_CREATED)
async def create_resource_endpoint(
    data: ResourceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await create_resource(db, data)

@router.patch("/{resource_id}", response_model=ResourceResponse)
async def update_resource_endpoint(
    resource_id: UUID,
    data: ResourceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    resource = await update_resource(db, resource_id, data)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    return resource

@router.delete("/{resource_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_resource_endpoint(
    resource_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    deleted = await delete_resource(db, resource_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Resource not found")
```

### Step 5: Tests

```python
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.fixture
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac

@pytest.mark.asyncio
async def test_create_resource(client: AsyncClient, auth_headers: dict):
    response = await client.post(
        "/resources",
        json={"name": "Test Resource"},
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test Resource"
    assert "id" in data

@pytest.mark.asyncio
async def test_get_resource_not_found(client: AsyncClient, auth_headers: dict):
    response = await client.get(
        "/resources/00000000-0000-0000-0000-000000000000",
        headers=auth_headers,
    )
    assert response.status_code == 404

@pytest.mark.asyncio
async def test_list_resources_pagination(client: AsyncClient, auth_headers: dict):
    # Create multiple resources first
    for i in range(5):
        await client.post(
            "/resources",
            json={"name": f"Resource {i}"},
            headers=auth_headers,
        )
    response = await client.get("/resources?limit=2", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data["data"]) == 2
    assert data["has_more"] is True
    assert data["next_cursor"] is not None

@pytest.mark.asyncio
async def test_create_resource_unauthorized(client: AsyncClient):
    response = await client.post("/resources", json={"name": "Test"})
    assert response.status_code in (401, 403)

@pytest.mark.asyncio
async def test_update_resource_partial(client: AsyncClient, auth_headers: dict):
    # Create
    create_resp = await client.post(
        "/resources",
        json={"name": "Original"},
        headers=auth_headers,
    )
    resource_id = create_resp.json()["id"]
    # Partial update
    response = await client.patch(
        f"/resources/{resource_id}",
        json={"name": "Updated"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Updated"

@pytest.mark.asyncio
async def test_delete_resource(client: AsyncClient, auth_headers: dict):
    create_resp = await client.post(
        "/resources",
        json={"name": "To Delete"},
        headers=auth_headers,
    )
    resource_id = create_resp.json()["id"]
    response = await client.delete(
        f"/resources/{resource_id}", headers=auth_headers
    )
    assert response.status_code == 204
    # Verify deleted
    get_resp = await client.get(
        f"/resources/{resource_id}", headers=auth_headers
    )
    assert get_resp.status_code == 404
```

## Key patterns to follow

### Dependency injection for auth

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token")

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    payload = decode_jwt(token)
    user = await db.get(User, payload["sub"])
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user

def require_role(*roles: str):
    """Factory for role-based access control."""
    async def checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return checker
```

### Cursor-based pagination helper

```python
import base64
from datetime import datetime

def encode_cursor(dt: datetime) -> str:
    return base64.urlsafe_b64encode(dt.isoformat().encode()).decode()

def decode_cursor(cursor: str) -> datetime:
    return datetime.fromisoformat(base64.urlsafe_b64decode(cursor).decode())
```

### Error responses

Always use FastAPI's `HTTPException` with consistent detail messages. For validation errors, Pydantic v2 handles them automatically via `RequestValidationError` (422).

```python
# 404 — not found
raise HTTPException(status_code=404, detail="Resource not found")

# 409 — conflict (duplicate)
raise HTTPException(status_code=409, detail="Resource with this name already exists")

# 403 — forbidden
raise HTTPException(status_code=403, detail="Not allowed to modify this resource")
```

## Checklist before finishing

- [ ] All endpoints return proper status codes (201 for POST, 204 for DELETE)
- [ ] Pydantic schemas use `model_config = ConfigDict(from_attributes=True)` for ORM mode
- [ ] List endpoint has pagination with configurable limit
- [ ] Auth dependency is applied to all non-public endpoints
- [ ] Tests cover: happy path, not found, unauthorized, validation errors
- [ ] Router is registered in the main FastAPI app
- [ ] Database model has proper indexes on filtered/sorted columns
