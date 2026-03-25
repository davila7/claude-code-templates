# Storage Backends

> Configure persistent and distributed storage for caching and OAuth state management

FastMCP uses pluggable storage backends for caching responses and managing OAuth state. By default, all storage is in-memory, which is perfect for development but doesn't persist across restarts. FastMCP includes support for multiple storage backends, and you can easily extend it with custom implementations.

> **Tip:** The storage layer is powered by **[py-key-value-aio](https://github.com/strawgate/py-key-value)**, an async key-value library maintained by a core FastMCP maintainer. This library provides a unified interface for multiple backends, making it easy to swap implementations based on your deployment needs.


## Available Backends

### In-Memory Storage

**Best for:** Development, testing, single-process deployments

In-memory storage is the default for all FastMCP storage needs. It's fast, requires no setup, and is perfect for getting started.

```python
from key_value.aio.stores.memory import MemoryStore

# Used by default - no configuration needed
# But you can also be explicit:
cache_store = MemoryStore()
```

**Characteristics:**

* ✅ No setup required
* ✅ Very fast
* ❌ Data lost on restart
* ❌ Not suitable for multi-process deployments

### Disk Storage

**Best for:** Single-server production deployments, persistent caching

Disk storage persists data to the filesystem, allowing it to survive server restarts.

```python
from key_value.aio.stores.disk import DiskStore
from fastmcp.server.middleware.caching import ResponseCachingMiddleware

# Persistent response cache
middleware = ResponseCachingMiddleware(
    cache_storage=DiskStore(directory="/var/cache/fastmcp")
)
```

Or with OAuth token storage:

```python
from fastmcp.server.auth.providers.github import GitHubProvider
from key_value.aio.stores.disk import DiskStore

auth = GitHubProvider(
    client_id="your-id",
    client_secret="your-secret",
    base_url="https://your-server.com",
    client_storage=DiskStore(directory="/var/lib/fastmcp/oauth")
)
```

**Characteristics:**

* ✅ Data persists across restarts
* ✅ Good performance for moderate load
* ❌ Not suitable for distributed deployments
* ❌ Filesystem access required

### Redis

**Best for:** Distributed production deployments, shared caching across multiple servers

> **Note:** Redis support requires an optional dependency: `pip install 'py-key-value-aio[redis]'`


Redis provides distributed caching and state management, ideal for production deployments with multiple server instances.

```python
from key_value.aio.stores.redis import RedisStore
from fastmcp.server.middleware.caching import ResponseCachingMiddleware

# Distributed response cache
middleware = ResponseCachingMiddleware(
    cache_storage=RedisStore(host="redis.example.com", port=6379)
)
```

With authentication:

```python
from key_value.aio.stores.redis import RedisStore

cache_store = RedisStore(
    host="redis.example.com",
    port=6379,
    password="your-redis-password"
)
```

For OAuth token storage:

```python
import os
from fastmcp.server.auth.providers.github import GitHubProvider
from key_value.aio.stores.redis import RedisStore

auth = GitHubProvider(
    client_id=os.environ["GITHUB_CLIENT_ID"],
    client_secret=os.environ["GITHUB_CLIENT_SECRET"],
    base_url="https://your-server.com",
    jwt_signing_key=os.environ["JWT_SIGNING_KEY"],
    client_storage=RedisStore(host="redis.example.com", port=6379)
)
```

**Characteristics:**

* ✅ Distributed and highly available
* ✅ Fast in-memory performance
* ✅ Works across multiple server instances
* ✅ Built-in TTL support
* ❌ Requires Redis infrastructure
* ❌ Network latency vs local storage

### Other Backends from py-key-value-aio

The py-key-value-aio library includes additional implementations for various storage systems:

* **DynamoDB** - AWS distributed database
* **MongoDB** - NoSQL document store
* **Elasticsearch** - Distributed search and analytics
* **Memcached** - Distributed memory caching
* **RocksDB** - Embedded high-performance key-value store
* **Valkey** - Redis-compatible server

For configuration details on these backends, consult the [py-key-value-aio documentation](https://github.com/strawgate/py-key-value).

> **Warning:** Before using these backends in production, review the [py-key-value documentation](https://github.com/strawgate/py-key-value) to understand the maturity level and limitations of your chosen backend. Some backends may be in preview or have specific constraints that make them unsuitable for production use.


## Use Cases in FastMCP

### Server-Side OAuth Token Storage

The OAuth Proxy and OAuth auth providers use storage for persisting OAuth client registrations and upstream tokens. **By default, storage is automatically encrypted using `FernetEncryptionWrapper`.** When providing custom storage, wrap it in `FernetEncryptionWrapper` to encrypt sensitive OAuth tokens at rest.

**Development (default behavior):**

By default, FastMCP automatically manages keys and storage based on your platform:

* **Mac/Windows**: Keys are auto-managed via system keyring, storage defaults to disk. Suitable **only** for development and local testing.
* **Linux**: Keys are ephemeral, storage defaults to memory.

No configuration needed:

```python
from fastmcp.server.auth.providers.github import GitHubProvider

auth = GitHubProvider(
    client_id="your-id",
    client_secret="your-secret",
    base_url="https://your-server.com"
)
```

**Production:**

For production deployments, configure explicit keys and persistent network-accessible storage with encryption:

```python
import os
from fastmcp.server.auth.providers.github import GitHubProvider
from key_value.aio.stores.redis import RedisStore
from key_value.aio.wrappers.encryption import FernetEncryptionWrapper
from cryptography.fernet import Fernet

auth = GitHubProvider(
    client_id=os.environ["GITHUB_CLIENT_ID"],
    client_secret=os.environ["GITHUB_CLIENT_SECRET"],
    base_url="https://your-server.com",
    # Explicit JWT signing key (required for production)
    jwt_signing_key=os.environ["JWT_SIGNING_KEY"],
    # Encrypted persistent storage (required for production)
    client_storage=FernetEncryptionWrapper(
        key_value=RedisStore(host="redis.example.com", port=6379),
        fernet=Fernet(os.environ["STORAGE_ENCRYPTION_KEY"])
    )
)
```

Both parameters are required for production. **Wrap your storage in `FernetEncryptionWrapper` to encrypt sensitive OAuth tokens at rest** - without it, tokens are stored in plaintext. See OAuth Token Security and Key and Storage Management for complete setup details.

### Response Caching Middleware

The Response Caching Middleware caches tool calls, resource reads, and prompt requests. Storage configuration is passed via the `cache_storage` parameter:

```python
from fastmcp import FastMCP
from fastmcp.server.middleware.caching import ResponseCachingMiddleware
from key_value.aio.stores.disk import DiskStore

mcp = FastMCP("My Server")

# Cache to disk instead of memory
mcp.add_middleware(ResponseCachingMiddleware(
    cache_storage=DiskStore(directory="cache")
))
```

For multi-server deployments sharing a Redis instance:

```python
from fastmcp.server.middleware.caching import ResponseCachingMiddleware
from key_value.aio.stores.redis import RedisStore
from key_value.aio.wrappers.prefix_collections import PrefixCollectionsWrapper

base_store = RedisStore(host="redis.example.com")
namespaced_store = PrefixCollectionsWrapper(
    key_value=base_store,
    prefix="my-server"
)

middleware = ResponseCachingMiddleware(cache_storage=namespaced_store)
```

### Client-Side OAuth Token Storage

The FastMCP Client uses storage for persisting OAuth tokens locally. By default, tokens are stored in memory:

```python
from fastmcp.client.auth import OAuthClientProvider
from key_value.aio.stores.disk import DiskStore

# Store tokens on disk for persistence across restarts
token_storage = DiskStore(directory="~/.local/share/fastmcp/tokens")

oauth_provider = OAuthClientProvider(
    mcp_url="https://your-mcp-server.com/mcp/sse",
    token_storage=token_storage
)
```

This allows clients to reconnect without re-authenticating after restarts.

## Choosing a Backend

| Backend  | Development | Single Server | Multi-Server | Cloud Native |
| -------- | ----------- | ------------- | ------------ | ------------ |
| Memory   | ✅ Best      | ⚠️ Limited    | ❌            | ❌            |
| Disk     | ✅ Good      | ✅ Recommended | ❌            | ⚠️           |
| Redis    | ⚠️ Overkill | ✅ Good        | ✅ Best       | ✅ Best       |
| DynamoDB | ❌           | ⚠️            | ✅            | ✅ Best (AWS) |
| MongoDB  | ❌           | ⚠️            | ✅            | ✅ Good       |

**Decision tree:**

1. **Just starting?** Use **Memory** (default) - no configuration needed
2. **Single server, needs persistence?** Use **Disk**
3. **Multiple servers or cloud deployment?** Use **Redis** or **DynamoDB**
4. **Existing infrastructure?** Look for a matching py-key-value-aio backend

## More Resources

* [py-key-value-aio GitHub](https://github.com/strawgate/py-key-value) - Full library documentation
* Response Caching Middleware - Using storage for caching
* OAuth Token Security - Production OAuth configuration
* HTTP Deployment - Complete deployment guide

> ## Documentation Index
> Fetch the complete documentation index at: https://gofastmcp.com/llms.txt
> Use this file to discover all available pages before exploring further.
