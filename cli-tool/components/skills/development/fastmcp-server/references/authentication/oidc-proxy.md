# OIDC Proxy

> Bridge OIDC providers to work seamlessly with MCP's authentication flow.

The OIDC proxy enables FastMCP servers to authenticate with OIDC providers that **don't support Dynamic Client Registration (DCR)** out of the box. This includes OAuth providers like: Auth0, Google, Azure, AWS, etc. For providers that do support DCR (like WorkOS AuthKit), use `RemoteAuthProvider` instead.

The OIDC proxy is built upon `OAuthProxy` so it has all the same functionality under the covers.

## Implementation

### Provider Setup Requirements

Before using the OIDC proxy, you need to register your application with your OAuth provider:

1. **Register your application** in the provider's developer console (Auth0 Applications, Google Cloud Console, Azure Portal, etc.)
2. **Configure the redirect URI** as your FastMCP server URL plus your chosen callback path:
   * Default: `https://your-server.com/auth/callback`
   * Custom: `https://your-server.com/your/custom/path` (if you set `redirect_path`)
   * Development: `http://localhost:8000/auth/callback`
3. **Obtain your credentials**: Client ID and Client Secret

> **Warning:** The redirect URI you configure with your provider must exactly match your
  FastMCP server's URL plus the callback path. If you customize `redirect_path`
  in the OIDC proxy, update your provider's redirect URI accordingly.


### Basic Setup

Here's how to implement the OIDC proxy with any provider:

```python
from fastmcp import FastMCP
from fastmcp.server.auth.oidc_proxy import OIDCProxy

# Create the OIDC proxy
auth = OIDCProxy(
    # Provider's configuration URL
    config_url="https://provider.com/.well-known/openid-configuration",

    # Your registered app credentials
    client_id="your-client-id",
    client_secret="your-client-secret",

    # Your FastMCP server's public URL
    base_url="https://your-server.com",

    # Optional: customize the callback path (default is "/auth/callback")
    # redirect_path="/custom/callback",
)

mcp = FastMCP(name="My Server", auth=auth)
```

### Configuration Parameters


  
    URL of your OAuth provider's OIDC configuration
  

  
    Client ID from your registered OAuth application
  

  
    Client secret from your registered OAuth application
  

  
    Public URL of your FastMCP server (e.g., `https://your-server.com`)
  

  
    Strict flag for configuration validation. When True, requires all OIDC
    mandatory fields.
  

  
    Audience parameter for OIDC providers that require it (e.g., Auth0). This is
    typically your API identifier.
  

  
    HTTP request timeout in seconds for fetching OIDC configuration
  

  
    Custom token verifier for validating tokens. When provided, FastMCP uses your custom verifier instead of creating a default `JWTVerifier`.

    Cannot be used with `algorithm` or `required_scopes` parameters - configure these on your verifier instead. The verifier's `required_scopes` are automatically loaded and advertised.
  

  
    JWT algorithm to use for token verification (e.g., "RS256"). If not specified,
    uses the provider's default. Only used when `token_verifier` is not provided.
  

  
    List of OAuth scopes for token validation. These are automatically
    included in authorization requests. Only used when `token_verifier` is not provided.
  

  
    Path for OAuth callbacks. Must match the redirect URI configured in your OAuth
    application
  

  
    List of allowed redirect URI patterns for MCP clients. Patterns support wildcards (e.g., `"http://localhost:*"`, `"https://*.example.com/*"`).

    * `None` (default): All redirect URIs allowed (for MCP/DCR compatibility)
    * Empty list `[]`: No redirect URIs allowed
    * Custom list: Only matching patterns allowed

    These patterns apply to MCP client loopback redirects, NOT the upstream OAuth app redirect URI.
  

  
    Token endpoint authentication method for the upstream OAuth server. Controls how the proxy authenticates when exchanging authorization codes and refresh tokens with the upstream provider.

    * `"client_secret_basic"`: Send credentials in Authorization header (most common)
    * `"client_secret_post"`: Send credentials in request body (required by some providers)
    * `"none"`: No authentication (for public clients)
    * `None` (default): Uses authlib's default (typically `"client_secret_basic"`)

    Set this if your provider requires a specific authentication method and the default doesn't work.
  

  
    Secret used to sign FastMCP JWT tokens issued to clients. Accepts any string or bytes - will be derived into a proper 32-byte cryptographic key using HKDF.

    **Default behavior (`None`):**

    * **Mac/Windows**: Auto-managed via system keyring. Keys are generated once and persisted, surviving server restarts with zero configuration. Keys are automatically derived from server attributes, so this approach, while convenient, is **only** suitable for development and local testing. For production, you must provide an explicit secret.
    * **Linux**: Ephemeral (random salt at startup). Tokens become invalid on server restart, triggering client re-authentication.

    **For production:**
    Provide an explicit secret (e.g., from environment variable) to use a fixed key instead of the auto-generated one.
  

  
    Storage backend for persisting OAuth client registrations and upstream tokens.

    **Default behavior:**

    * **Mac/Windows**: Encrypted DiskStore in your platform's data directory (derived from `platformdirs`)
    * **Linux**: MemoryStore (ephemeral - clients lost on restart)

    By default on Mac/Windows, clients are automatically persisted to encrypted disk storage, allowing them to survive server restarts as long as the filesystem remains accessible. This means MCP clients only need to register once and can reconnect seamlessly. On Linux where keyring isn't available, ephemeral storage is used to match the ephemeral key strategy.

    For production deployments with multiple servers or cloud deployments, use a network-accessible storage backend rather than local disk storage. **Wrap your storage in `FernetEncryptionWrapper` to encrypt sensitive OAuth tokens at rest.** See Storage Backends for available options.

    Testing with in-memory storage (unencrypted):

    ```python
    from key_value.aio.stores.memory import MemoryStore

    # Use in-memory storage for testing (clients lost on restart)
    auth = OIDCProxy(..., client_storage=MemoryStore())
    ```

    Production with encrypted Redis storage:

    ```python
    from key_value.aio.stores.redis import RedisStore
    from key_value.aio.wrappers.encryption import FernetEncryptionWrapper
    from cryptography.fernet import Fernet
    import os

    auth = OIDCProxy(
        ...,
        jwt_signing_key=os.environ["JWT_SIGNING_KEY"],
        client_storage=FernetEncryptionWrapper(
            key_value=RedisStore(host="redis.example.com", port=6379),
            fernet=Fernet(os.environ["STORAGE_ENCRYPTION_KEY"])
        )
    )
    ```
  

  
    Whether to require user consent before authorizing MCP clients. When enabled (default), users see a consent screen that displays which client is requesting access. See OAuthProxy documentation for details on confused deputy attack protection.
  

  
    Content Security Policy for the consent page.

    * `None` (default): Uses the built-in CSP policy with appropriate directives for form submission
    * Empty string `""`: Disables CSP entirely (no meta tag rendered)
    * Custom string: Uses the provided value as the CSP policy

    This is useful for organizations that have their own CSP policies and need to override or disable FastMCP's built-in CSP directives.
  


### Using Built-in Providers

FastMCP includes pre-configured OIDC providers for common services:

```python
from fastmcp.server.auth.providers.auth0 import Auth0Provider

auth = Auth0Provider(
    config_url="https://.../.well-known/openid-configuration",
    client_id="your-auth0-client-id",
    client_secret="your-auth0-client-secret",
    audience="https://...",
    base_url="https://localhost:8000"
)

mcp = FastMCP(name="My Server", auth=auth)
```

Available providers include `Auth0Provider` at present.

### Scope Configuration

OAuth scopes are configured with `required_scopes` to automatically request the permissions your application needs.

Dynamic clients created by the proxy will automatically include these scopes in their authorization requests.

## CIMD Support

The OIDC proxy inherits full CIMD (Client ID Metadata Document) support from `OAuthProxy`. Clients can use HTTPS URLs as their `client_id` instead of registering dynamically, and the proxy will fetch and validate their metadata document.

See the OAuth Proxy CIMD documentation for complete details on how CIMD works, including private key JWT authentication and security considerations.

The CIMD-related parameters available on `OIDCProxy` are:


  
    Whether to accept CIMD URLs as client identifiers.
  


## Production Configuration

For production deployments, load sensitive credentials from environment variables:

```python
import os
from fastmcp import FastMCP
from fastmcp.server.auth.providers.auth0 import Auth0Provider

# Load secrets from environment variables
auth = Auth0Provider(
    config_url=os.environ.get("AUTH0_CONFIG_URL"),
    client_id=os.environ.get("AUTH0_CLIENT_ID"),
    client_secret=os.environ.get("AUTH0_CLIENT_SECRET"),
    audience=os.environ.get("AUTH0_AUDIENCE"),
    base_url=os.environ.get("BASE_URL", "https://localhost:8000")
)

mcp = FastMCP(name="My Server", auth=auth)

@mcp.tool
def protected_tool(data: str) -> str:
    """This tool is now protected by OAuth."""
    return f"Processed: {data}"

if __name__ == "__main__":
    mcp.run(transport="http", port=8000)
```

This keeps secrets out of your codebase while maintaining explicit configuration.

> ## Documentation Index
> Fetch the complete documentation index at: https://gofastmcp.com/llms.txt
> Use this file to discover all available pages before exploring further.
