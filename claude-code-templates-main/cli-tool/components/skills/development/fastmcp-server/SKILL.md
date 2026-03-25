---
name: fastmcp-server
description: Complete guide for building MCP servers with FastMCP 3.0 - tools, resources, authentication, providers, middleware, and deployment. Use when creating Python MCP servers or integrating AI models with external tools and data.
version: 1.0.0
author: FastMCP Community
license: MIT
tags: [FastMCP, MCP, Python, AI, Tools, Server, Authentication, Providers]
dependencies: []
---

# FastMCP 3.0 Server Development

Complete reference for building production-ready MCP (Model Context Protocol) servers with FastMCP 3.0 - the fast, Pythonic framework for connecting LLMs to tools and data.

## When to use this skill

**Use FastMCP Server when:**
- Creating a new MCP server in Python
- Adding tools, resources, or prompts to an MCP server
- Implementing authentication (OAuth, OIDC, token verification)
- Setting up middleware for logging, rate limiting, or authorization
- Configuring providers (local, filesystem, skills, custom)
- Building production MCP servers with telemetry and storage
- Upgrading from FastMCP 2.x to 3.0

**Key areas covered:**
- **Tools & Resources** (CORE): Decorators, validation, return types, templates
- **Context & DI** (CORE): MCP context, dependency injection, background tasks
- **Authentication** (SECURITY): OAuth, OIDC, token verification, proxy patterns
- **Authorization** (SECURITY): Scope-based and role-based access control
- **Middleware** (ADVANCED): Request/response pipeline, built-in middleware
- **Providers** (ADVANCED): Local, filesystem, skills, and custom providers
- **Features** (ADVANCED): Pagination, sampling, storage, OpenTelemetry, versioning

## Quick reference

### Core patterns

**Create a server with tools:**
```python
from fastmcp import FastMCP

mcp = FastMCP("MyServer")

@mcp.tool
def add(a: int, b: int) -> int:
    """Add two numbers"""
    return a + b
```

**Create a resource:**
```python
@mcp.resource("data://config")
def get_config() -> dict:
    """Return server configuration"""
    return {"version": "1.0", "debug": False}
```

**Create a resource template:**
```python
@mcp.resource("users://{user_id}/profile")
def get_user_profile(user_id: str) -> dict:
    """Get a user's profile by ID"""
    return fetch_user(user_id)
```

**Create a prompt:**
```python
@mcp.prompt
def review_code(code: str, language: str = "python") -> str:
    """Review code for best practices"""
    return f"Review this {language} code:\n\n{code}"
```

**Run the server:**
```python
if __name__ == "__main__":
    mcp.run()

# Or with transport options:
# mcp.run(transport="sse", host="0.0.0.0", port=8000)
```

### Using context in tools

```python
from fastmcp import FastMCP, Context

mcp = FastMCP("MyServer")

@mcp.tool
def process_data(uri: str, ctx: Context) -> str:
    """Process data with logging and progress"""
    ctx.info(f"Processing {uri}")
    ctx.report_progress(0, 100)
    data = ctx.read_resource(uri)
    ctx.report_progress(100, 100)
    return f"Processed: {data}"
```

### Authentication setup

```python
from fastmcp import FastMCP
from fastmcp.server.auth import BearerAuthProvider

auth = BearerAuthProvider(
    jwks_uri="https://your-provider/.well-known/jwks.json",
    audience="your-api",
    issuer="https://your-provider/"
)

mcp = FastMCP("SecureServer", auth=auth)
```

## Key concepts

### Tools
Functions exposed as executable capabilities for LLMs. Decorated with `@mcp.tool`. Support Pydantic validation, async, custom return types, and annotations (readOnlyHint, destructiveHint).

### Resources & Templates
Static or dynamic data sources identified by URIs. Resources use fixed URIs (`data://config`), templates use parameterized URIs (`users://{id}/profile`). Support MIME types, annotations, and wildcard parameters.

### Context
The `Context` object provides access to MCP features within tools/resources: logging, progress reporting, resource access, LLM sampling, user elicitation, and session state.

### Dependency Injection
Inject values into tool/resource functions using `Depends()`. Supports HTTP requests, access tokens, custom dependencies, and generator-based cleanup patterns.

### Providers
Control where components come from. `LocalProvider` (default, decorator-based), `FileSystemProvider` (load from Python files on disk), `SkillsProvider` (packaged bundles), or custom providers.

### Authentication & Authorization
Multiple auth patterns: token verification (JWT, JWKS), OAuth proxy, OIDC proxy, remote OAuth, and full OAuth server. Authorization via scopes on components and middleware.

### Middleware
Intercept and modify requests/responses. Built-in middleware for rate limiting, error handling, logging, and response size limits. Custom middleware via `@mcp.middleware`.

## Using the references

Detailed documentation is organized in the `references/` folder:

### Getting Started
- **getting-started/installation.md** - Install FastMCP, optional dependencies, verify setup
- **getting-started/upgrade-guide.md** - Migrate from FastMCP 2.x to 3.0
- **getting-started/quickstart.md** - First server, tools, resources, prompts, running

### Server
- **server/server-class.md** - FastMCP server configuration, transport options, tag filtering
- **server/tools.md** - Tool decorator, parameters, validation, return types, annotations
- **server/resources-and-templates.md** - Resources, templates, URIs, wildcards, MIME types

### Context
- **context/mcp-context.md** - Context object, logging, progress, resource access, sampling
- **context/background-tasks.md** - Long-running operations with task support
- **context/dependency-injection.md** - Depends(), custom deps, HTTP request, access tokens
- **context/user-elicitation.md** - Request structured input from users during execution

### Features
- **features/icons.md** - Custom icons for tools, resources, prompts, and servers
- **features/lifespans.md** - Server lifecycle management and startup/shutdown hooks
- **features/client-logging.md** - Send log messages to MCP clients
- **features/middleware.md** - Request/response pipeline, built-in and custom middleware
- **features/pagination.md** - Paginate large component lists
- **features/progress-reporting.md** - Report progress for long-running operations
- **features/sampling.md** - Request LLM completions from the client
- **features/storage-backends.md** - Memory, file, and Redis storage for caching and tokens
- **features/opentelemetry.md** - Distributed tracing and observability
- **features/versioning.md** - Version components and filter by version ranges

### Authentication
- **authentication/token-verification.md** - JWT, JWKS, introspection, static keys, custom
- **authentication/remote-oauth.md** - Delegate auth to upstream OAuth provider
- **authentication/oauth-proxy.md** - Full OAuth proxy with PKCE, client management
- **authentication/oidc-proxy.md** - OpenID Connect proxy with auto-discovery
- **authentication/full-oauth-server.md** - Complete built-in OAuth server

### Authorization
- **authorization.md** - Scope-based access control, middleware authorization, patterns

### Providers
- **providers/local.md** - Default provider, decorator-based component registration
- **providers/filesystem.md** - Load components from Python files on disk
- **providers/skills.md** - Package and distribute component bundles
- **providers/custom.md** - Build custom providers for any component source

## Version history

**v1.0.0** (February 2026)
- Initial release covering FastMCP 3.0 (release candidate)
- 30 reference files across 7 categories
- Complete coverage of tools, resources, context, auth, providers, and features
