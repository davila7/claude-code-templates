# Authorization

> Control access to components using callable-based authorization checks that filter visibility and enforce permissions.

Authorization controls what authenticated users can do with your FastMCP server. While authentication verifies identity (who you are), authorization determines access (what you can do). FastMCP provides a callable-based authorization system that works at both the component level and globally via middleware.

The authorization model centers on a simple concept: callable functions that receive context about the current request and return `True` to allow access or `False` to deny it. Multiple checks combine with AND logic, meaning all checks must pass for access to be granted.

> **Note:** Authorization relies on OAuth tokens which are only available with HTTP transports (SSE, Streamable HTTP). In STDIO mode, there's no OAuth mechanism, so `get_access_token()` returns `None` and all auth checks are skipped.


> **Note:** When an `AuthProvider` is configured, all requests to the MCP endpoint must carry a valid token—unauthenticated requests are rejected at the transport level before any auth checks run. Authorization checks therefore differentiate between authenticated users based on their scopes and claims, not between authenticated and unauthenticated users.


## Auth Checks

An auth check is any callable that accepts an `AuthContext` and returns a boolean. Auth checks can be synchronous or asynchronous, so checks that need to perform async operations (like reading server state or calling external services) work naturally.

```python
from fastmcp.server.auth import AuthContext

def my_custom_check(ctx: AuthContext) -> bool:
    # ctx.token is AccessToken | None
    # ctx.component is the Tool, Resource, or Prompt being accessed
    return ctx.token is not None and "special" in ctx.token.scopes
```

FastMCP provides two built-in auth checks that cover common authorization patterns.

### require\_scopes

Scope-based authorization checks that the token contains all specified OAuth scopes. When multiple scopes are provided, all must be present (AND logic).

```python
from fastmcp import FastMCP
from fastmcp.server.auth import require_scopes

mcp = FastMCP("Scoped Server")

@mcp.tool(auth=require_scopes("admin"))
def admin_operation() -> str:
    """Requires the 'admin' scope."""
    return "Admin action completed"

@mcp.tool(auth=require_scopes("read", "write"))
def read_write_operation() -> str:
    """Requires both 'read' AND 'write' scopes."""
    return "Read/write action completed"
```

### restrict\_tag

Tag-based restrictions apply scope requirements conditionally. If a component has the specified tag, the token must have the required scopes. Components without the tag are unaffected.

```python
from fastmcp import FastMCP
from fastmcp.server.auth import restrict_tag
from fastmcp.server.middleware import AuthMiddleware

mcp = FastMCP(
    "Tagged Server",
    middleware=[
        AuthMiddleware(auth=restrict_tag("admin", scopes=["admin"]))
    ]
)

@mcp.tool(tags={"admin"})
def admin_tool() -> str:
    """Tagged 'admin', so requires 'admin' scope."""
    return "Admin only"

@mcp.tool(tags={"public"})
def public_tool() -> str:
    """Not tagged 'admin', so no scope required by the restriction."""
    return "Anyone can access"
```

### Combining Checks

Multiple auth checks can be combined by passing a list. All checks must pass for authorization to succeed (AND logic).

```python
from fastmcp import FastMCP
from fastmcp.server.auth import require_scopes

mcp = FastMCP("Combined Auth Server")

@mcp.tool(auth=[require_scopes("admin"), require_scopes("write")])
def secure_admin_action() -> str:
    """Requires both 'admin' AND 'write' scopes."""
    return "Secure admin action"
```

### Custom Auth Checks

Any callable that accepts `AuthContext` and returns `bool` can serve as an auth check. This enables authorization logic based on token claims, component metadata, or external systems.

```python
from fastmcp import FastMCP
from fastmcp.server.auth import AuthContext

mcp = FastMCP("Custom Auth Server")

def require_premium_user(ctx: AuthContext) -> bool:
    """Check for premium user status in token claims."""
    if ctx.token is None:
        return False
    return ctx.token.claims.get("premium", False) is True

def require_access_level(minimum_level: int):
    """Factory function for level-based authorization."""
    def check(ctx: AuthContext) -> bool:
        if ctx.token is None:
            return False
        user_level = ctx.token.claims.get("level", 0)
        return user_level >= minimum_level
    return check

@mcp.tool(auth=require_premium_user)
def premium_feature() -> str:
    """Only for premium users."""
    return "Premium content"

@mcp.tool(auth=require_access_level(5))
def advanced_feature() -> str:
    """Requires access level 5 or higher."""
    return "Advanced feature"
```

### Async Auth Checks

Auth checks can be `async` functions, which is useful when the authorization decision depends on asynchronous operations like reading server state or querying external services.

```python
from fastmcp import FastMCP
from fastmcp.server.auth import AuthContext

mcp = FastMCP("Async Auth Server")

async def check_user_permissions(ctx: AuthContext) -> bool:
    """Async auth check that reads server state."""
    if ctx.token is None:
        return False
    user_id = ctx.token.claims.get("sub")
    # Async operations work naturally in auth checks
    permissions = await fetch_user_permissions(user_id)
    return "admin" in permissions

@mcp.tool(auth=check_user_permissions)
def admin_tool() -> str:
    return "Admin action completed"
```

Sync and async checks can be freely combined in a list — each check is handled according to its type.

### Error Handling

Auth checks can raise exceptions for explicit denial with custom messages:

* **`AuthorizationError`**: Propagates with its custom message, useful for explaining why access was denied
* **Other exceptions**: Masked for security (logged internally, treated as denial)

```python
from fastmcp.server.auth import AuthContext
from fastmcp.exceptions import AuthorizationError

def require_verified_email(ctx: AuthContext) -> bool:
    """Require verified email with explicit denial message."""
    if ctx.token is None:
        raise AuthorizationError("Authentication required")
    if not ctx.token.claims.get("email_verified"):
        raise AuthorizationError("Email verification required")
    return True
```

## Component-Level Authorization

The `auth` parameter on decorators controls visibility and access for individual components. When auth checks fail for the current request, the component is hidden from list responses and direct access returns not-found.

```python
from fastmcp import FastMCP
from fastmcp.server.auth import require_scopes

mcp = FastMCP("Component Auth Server")

@mcp.tool(auth=require_scopes("write"))
def write_tool() -> str:
    """Only visible to users with 'write' scope."""
    return "Written"

@mcp.resource("secret://data", auth=require_scopes("read"))
def secret_resource() -> str:
    """Only visible to users with 'read' scope."""
    return "Secret data"

@mcp.prompt(auth=require_scopes("admin"))
def admin_prompt() -> str:
    """Only visible to users with 'admin' scope."""
    return "Admin prompt content"
```

> **Note:** Component-level `auth` controls both visibility (list filtering) and access (direct lookups return not-found for unauthorized requests). Additionally use `AuthMiddleware` to apply server-wide authorization rules and get explicit `AuthorizationError` responses on unauthorized execution attempts.


## Server-Level Authorization

For server-wide authorization enforcement, use `AuthMiddleware`. This middleware applies auth checks globally to all components—filtering list responses and blocking unauthorized execution with explicit `AuthorizationError` responses.

```python
from fastmcp import FastMCP
from fastmcp.server.auth import require_scopes
from fastmcp.server.middleware import AuthMiddleware

mcp = FastMCP(
    "Enforced Auth Server",
    middleware=[AuthMiddleware(auth=require_scopes("api"))]
)

@mcp.tool
def any_tool() -> str:
    """Requires 'api' scope to see AND call."""
    return "Protected"
```

### Component Auth + Middleware

Component-level `auth` and `AuthMiddleware` work together as complementary layers. The middleware applies server-wide rules to all components, while component-level auth adds per-component requirements. Both layers are checked—all checks must pass.

```python
from fastmcp import FastMCP
from fastmcp.server.auth import require_scopes, restrict_tag
from fastmcp.server.middleware import AuthMiddleware

mcp = FastMCP(
    "Layered Auth Server",
    middleware=[
        AuthMiddleware(auth=restrict_tag("admin", scopes=["admin"]))
    ]
)

# Requires "write" scope (component-level)
# Also requires "admin" scope if tagged "admin" (middleware-level)
@mcp.tool(auth=require_scopes("write"), tags={"admin"})
def admin_write() -> str:
    """Requires both 'write' AND 'admin' scopes."""
    return "Admin write"

# Requires "write" scope (component-level only)
@mcp.tool(auth=require_scopes("write"))
def user_write() -> str:
    """Requires 'write' scope."""
    return "User write"
```

### Tag-Based Global Authorization

A common pattern uses `restrict_tag` with `AuthMiddleware` to apply scope requirements based on component tags.

```python
from fastmcp import FastMCP
from fastmcp.server.auth import restrict_tag
from fastmcp.server.middleware import AuthMiddleware

mcp = FastMCP(
    "Tag-Based Auth Server",
    middleware=[
        AuthMiddleware(auth=restrict_tag("admin", scopes=["admin"])),
        AuthMiddleware(auth=restrict_tag("write", scopes=["write"])),
    ]
)

@mcp.tool(tags={"admin"})
def delete_all_data() -> str:
    """Requires 'admin' scope."""
    return "Deleted"

@mcp.tool(tags={"write"})
def update_record(id: str, data: str) -> str:
    """Requires 'write' scope."""
    return f"Updated {id}"

@mcp.tool
def read_record(id: str) -> str:
    """No tag restrictions, accessible to all."""
    return f"Record {id}"
```

## Accessing Tokens in Tools

Tools can access the current authentication token using `get_access_token()` from `fastmcp.server.dependencies`. This enables tools to make decisions based on user identity or permissions beyond simple authorization checks.

```python
from fastmcp import FastMCP
from fastmcp.server.dependencies import get_access_token

mcp = FastMCP("Token Access Server")

@mcp.tool
def personalized_greeting() -> str:
    """Greet the user based on their token claims."""
    token = get_access_token()

    if token is None:
        return "Hello, guest!"

    name = token.claims.get("name", "user")
    return f"Hello, {name}!"

@mcp.tool
def user_dashboard() -> dict:
    """Return user-specific data based on token."""
    token = get_access_token()

    if token is None:
        return {"error": "Not authenticated"}

    return {
        "client_id": token.client_id,
        "scopes": token.scopes,
        "claims": token.claims,
    }
```

## Reference

### AccessToken

The `AccessToken` object contains information extracted from the OAuth token.

| Property     | Type               | Description                         |
| ------------ | ------------------ | ----------------------------------- |
| `token`      | `str`              | The raw token string                |
| `client_id`  | `str \| None`      | OAuth client identifier             |
| `scopes`     | `list[str]`        | Granted OAuth scopes                |
| `expires_at` | `datetime \| None` | Token expiration time               |
| `claims`     | `dict[str, Any]`   | All JWT claims or custom token data |

### AuthContext

The `AuthContext` dataclass is passed to all auth check functions.

| Property    | Type                         | Description                                        |
| ----------- | ---------------------------- | -------------------------------------------------- |
| `token`     | `AccessToken \| None`        | Current access token, or `None` if unauthenticated |
| `component` | `Tool \| Resource \| Prompt` | The component being accessed                       |

Access to the component object enables authorization decisions based on metadata like tags, name, or custom properties.

```python
from fastmcp.server.auth import AuthContext

def require_matching_tag(ctx: AuthContext) -> bool:
    """Require a scope matching each of the component's tags."""
    if ctx.token is None:
        return False
    user_scopes = set(ctx.token.scopes)
    return ctx.component.tags.issubset(user_scopes)
```

### Imports

```python
from fastmcp.server.auth import (
    AccessToken,       # Token with .token, .client_id, .scopes, .expires_at, .claims
    AuthContext,       # Context with .token, .component
    AuthCheck,         # Type alias: sync or async Callable[[AuthContext], bool]
    require_scopes,    # Built-in: requires specific scopes
    restrict_tag,      # Built-in: tag-based scope requirements
    run_auth_checks,   # Utility: run checks with AND logic
)

from fastmcp.server.middleware import AuthMiddleware
```

> ## Documentation Index
> Fetch the complete documentation index at: https://gofastmcp.com/llms.txt
> Use this file to discover all available pages before exploring further.
