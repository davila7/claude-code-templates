# Token Verification

> Protect your server by validating bearer tokens issued by external systems.

Token verification enables your FastMCP server to validate bearer tokens issued by external systems without participating in user authentication flows. Your server acts as a pure resource server, focusing on token validation and authorization decisions while delegating identity management to other systems in your infrastructure.

> **Note:** Token verification operates somewhat outside the formal MCP authentication flow, which expects OAuth-style discovery. It's best suited for internal systems, microservices architectures, or when you have full control over token generation and distribution.


## Understanding Token Verification

Token verification addresses scenarios where authentication responsibility is distributed across multiple systems. Your MCP server receives structured tokens containing identity and authorization information, validates their authenticity, and makes access control decisions based on their contents.

This pattern emerges naturally in microservices architectures where a central authentication service issues tokens that multiple downstream services validate independently. It also works well when integrating MCP servers into existing systems that already have established token-based authentication mechanisms.

### The Token Verification Model

Token verification treats your MCP server as a resource server in OAuth terminology. The key insight is that token validation and token issuance are separate concerns that can be handled by different systems.

**Token Issuance**: Another system (API gateway, authentication service, or identity provider) handles user authentication and creates signed tokens containing identity and permission information.

**Token Validation**: Your MCP server receives these tokens, verifies their authenticity using cryptographic signatures, and extracts authorization information from their claims.

**Access Control**: Based on token contents, your server determines what resources, tools, and prompts the client can access.

This separation allows your MCP server to focus on its core functionality while leveraging existing authentication infrastructure. The token acts as a portable proof of identity that travels with each request.

### Token Security Considerations

Token-based authentication relies on cryptographic signatures to ensure token integrity. Your MCP server validates tokens using public keys corresponding to the private keys used for token creation. This asymmetric approach means your server never needs access to signing secrets.

Token validation must address several security requirements: signature verification ensures tokens haven't been tampered with, expiration checking prevents use of stale tokens, and audience validation ensures tokens intended for your server aren't accepted by other systems.

The challenge in MCP environments is that clients need to obtain valid tokens before making requests, but the MCP protocol doesn't provide built-in discovery mechanisms for token endpoints. Clients must obtain tokens through separate channels or prior configuration.

## TokenVerifier Class

FastMCP provides the `TokenVerifier` class to handle token validation complexity while remaining flexible about token sources and validation strategies.

`TokenVerifier` focuses exclusively on token validation without providing OAuth discovery metadata. This makes it ideal for internal systems where clients already know how to obtain tokens, or for microservices that trust tokens from known issuers.

The class validates token signatures, checks expiration timestamps, and extracts authorization information from token claims. It supports various token formats and validation strategies while maintaining a consistent interface for authorization decisions.

You can subclass `TokenVerifier` to implement custom validation logic for specialized token formats or validation requirements. The base class handles common patterns while allowing extension for unique use cases.

## JWT Token Verification

JSON Web Tokens (JWTs) represent the most common token format for modern applications. FastMCP's `JWTVerifier` validates JWTs using industry-standard cryptographic techniques and claim validation.

### JWKS Endpoint Integration

JWKS endpoint integration provides the most flexible approach for production systems. The verifier automatically fetches public keys from a JSON Web Key Set endpoint, enabling automatic key rotation without server configuration changes.

```python
from fastmcp import FastMCP
from fastmcp.server.auth.providers.jwt import JWTVerifier

# Configure JWT verification against your identity provider
verifier = JWTVerifier(
    jwks_uri="https://auth.yourcompany.com/.well-known/jwks.json",
    issuer="https://auth.yourcompany.com",
    audience="mcp-production-api"
)

mcp = FastMCP(name="Protected API", auth=verifier)
```

This configuration creates a server that validates JWTs issued by `auth.yourcompany.com`. The verifier periodically fetches public keys from the JWKS endpoint and validates incoming tokens against those keys. Only tokens with the correct issuer and audience claims will be accepted.

The `issuer` parameter ensures tokens come from your trusted authentication system, while `audience` validation prevents tokens intended for other services from being accepted by your MCP server.

### Symmetric Key Verification (HMAC)

Symmetric key verification uses a shared secret for both signing and validation, making it ideal for internal microservices and trusted environments where the same secret can be securely distributed to both token issuers and validators.

This approach is commonly used in microservices architectures where services share a secret key, or when your authentication service and MCP server are both managed by the same organization. The HMAC algorithms (HS256, HS384, HS512) provide strong security when the shared secret is properly managed.

```python
from fastmcp import FastMCP
from fastmcp.server.auth.providers.jwt import JWTVerifier

# Use a shared secret for symmetric key verification
verifier = JWTVerifier(
    public_key="your-shared-secret-key-minimum-32-chars",  # Despite the name, this accepts symmetric secrets
    issuer="internal-auth-service",
    audience="mcp-internal-api",
    algorithm="HS256"  # or HS384, HS512 for stronger security
)

mcp = FastMCP(name="Internal API", auth=verifier)
```

The verifier will validate tokens signed with the same secret using the specified HMAC algorithm. This approach offers several advantages for internal systems:

* **Simplicity**: No key pair management or certificate distribution
* **Performance**: HMAC operations are typically faster than RSA
* **Compatibility**: Works well with existing microservice authentication patterns

> **Note:** The parameter is named `public_key` for backwards compatibility, but when using HMAC algorithms (HS256/384/512), it accepts the symmetric secret string.


> **Warning:** **Security Considerations for Symmetric Keys:**

  * Use a strong, randomly generated secret (minimum 32 characters recommended)
  * Never expose the secret in logs, error messages, or version control
  * Implement secure key distribution and rotation mechanisms
  * Consider using asymmetric keys (RSA/ECDSA) for external-facing APIs


### Static Public Key Verification

Static public key verification works when you have a fixed RSA or ECDSA signing key and don't need automatic key rotation. This approach is primarily useful for development environments or controlled deployments where JWKS endpoints aren't available.

```python
from fastmcp import FastMCP
from fastmcp.server.auth.providers.jwt import JWTVerifier

# Use a static public key for token verification
public_key_pem = """-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
-----END PUBLIC KEY-----"""

verifier = JWTVerifier(
    public_key=public_key_pem,
    issuer="https://auth.yourcompany.com",
    audience="mcp-production-api"
)

mcp = FastMCP(name="Protected API", auth=verifier)
```

This configuration validates tokens using a specific RSA or ECDSA public key. The key must correspond to the private key used by your token issuer. While less flexible than JWKS endpoints, this approach can be useful in development environments or when testing with fixed keys.

## Opaque Token Verification

Many authorization servers issue opaque tokens rather than self-contained JWTs. Opaque tokens are random strings that carry no information themselves - the authorization server maintains their state and validation requires querying the server. FastMCP supports opaque token validation through OAuth 2.0 Token Introspection (RFC 7662).

### Understanding Opaque Tokens

Opaque tokens differ fundamentally from JWTs in their verification model. Where JWTs carry signed claims that can be validated locally, opaque tokens require network calls to the issuing authorization server for validation. The authorization server maintains token state and can revoke tokens immediately, providing stronger security guarantees for sensitive operations.

This approach trades performance (network latency on each validation) for security and flexibility. Authorization servers can revoke opaque tokens instantly, implement complex authorization logic, and maintain detailed audit logs of token usage. Many enterprise OAuth providers default to opaque tokens for these security advantages.

### Token Introspection Protocol

RFC 7662 standardizes how resource servers validate opaque tokens. The protocol defines an introspection endpoint where resource servers authenticate using client credentials and receive token metadata including active status, scopes, expiration, and subject identity.

FastMCP implements this protocol through the `IntrospectionTokenVerifier` class, handling authentication, request formatting, and response parsing according to the specification.

```python
from fastmcp import FastMCP
from fastmcp.server.auth.providers.introspection import IntrospectionTokenVerifier

# Configure introspection with your OAuth provider
verifier = IntrospectionTokenVerifier(
    introspection_url="https://auth.yourcompany.com/oauth/introspect",
    client_id="mcp-resource-server",
    client_secret="your-client-secret",
    required_scopes=["api:read", "api:write"]
)

mcp = FastMCP(name="Protected API", auth=verifier)
```

The verifier authenticates to the introspection endpoint using client credentials and queries it whenever a bearer token arrives. FastMCP checks whether the token is active and has sufficient scopes before allowing access.

Two standard client authentication methods are supported, both defined in RFC 6749:

* **`client_secret_basic`** (default): Sends credentials via HTTP Basic Auth header
* **`client_secret_post`**: Sends credentials in the POST request body

Most OAuth providers support both methods, though some may require one specifically. Configure the authentication method with the `client_auth_method` parameter:

```python
# Use POST body authentication instead of Basic Auth
verifier = IntrospectionTokenVerifier(
    introspection_url="https://auth.yourcompany.com/oauth/introspect",
    client_id="mcp-resource-server",
    client_secret="your-client-secret",
    client_auth_method="client_secret_post",
    required_scopes=["api:read", "api:write"]
)
```

## Development and Testing

Development environments often need simpler token management without the complexity of full JWT infrastructure. FastMCP provides tools specifically designed for these scenarios.

### Static Token Verification

Static token verification enables rapid development by accepting predefined tokens with associated claims. This approach eliminates the need for token generation infrastructure during development and testing.

```python
from fastmcp import FastMCP
from fastmcp.server.auth.providers.jwt import StaticTokenVerifier

# Define development tokens and their associated claims
verifier = StaticTokenVerifier(
    tokens={
        "dev-alice-token": {
            "client_id": "alice@company.com",
            "scopes": ["read:data", "write:data", "admin:users"]
        },
        "dev-guest-token": {
            "client_id": "guest-user",
            "scopes": ["read:data"]
        }
    },
    required_scopes=["read:data"]
)

mcp = FastMCP(name="Development Server", auth=verifier)
```

Clients can now authenticate using `Authorization: Bearer dev-alice-token` headers. The server will recognize the token and load the associated claims for authorization decisions. This approach enables immediate development without external dependencies.

> **Warning:** Static token verification stores tokens as plain text and should never be used in production environments. It's designed exclusively for development and testing scenarios.


### Debug/Custom Token Verification

The `DebugTokenVerifier` provides maximum flexibility for testing and special cases where standard token verification isn't applicable. It delegates validation to a user-provided callable, making it useful for prototyping, testing scenarios, or handling opaque tokens without introspection endpoints.

```python
from fastmcp import FastMCP
from fastmcp.server.auth.providers.debug import DebugTokenVerifier

# Accept all tokens (useful for rapid development)
verifier = DebugTokenVerifier()

mcp = FastMCP(name="Development Server", auth=verifier)
```

By default, `DebugTokenVerifier` accepts any non-empty token as valid. This eliminates authentication barriers during early development, allowing you to focus on core functionality before adding security.

For more controlled testing, provide custom validation logic:

```python
from fastmcp.server.auth.providers.debug import DebugTokenVerifier

# Synchronous validation - check token prefix
verifier = DebugTokenVerifier(
    validate=lambda token: token.startswith("dev-"),
    client_id="development-client",
    scopes=["read", "write"]
)

mcp = FastMCP(name="Development Server", auth=verifier)
```

The validation callable can also be async, enabling database lookups or external service calls:

```python
from fastmcp.server.auth.providers.debug import DebugTokenVerifier

# Asynchronous validation - check against cache
async def validate_token(token: str) -> bool:
    # Check if token exists in Redis, database, etc.
    return await redis.exists(f"valid_tokens:{token}")

verifier = DebugTokenVerifier(
    validate=validate_token,
    client_id="api-client",
    scopes=["api:access"]
)

mcp = FastMCP(name="Custom API", auth=verifier)
```

**Use Cases:**

* **Testing**: Accept any token during integration tests without setting up token infrastructure
* **Prototyping**: Quickly validate concepts without authentication complexity
* **Opaque tokens without introspection**: When you have tokens from an IDP that provides no introspection endpoint, and you're willing to accept tokens without validation (validation happens later at the upstream service)
* **Custom token formats**: Implement validation for non-standard token formats or legacy systems

> **Warning:** `DebugTokenVerifier` bypasses standard security checks. Only use in controlled environments (development, testing) or when you fully understand the security implications. For production, use proper JWT or introspection-based verification.


### Test Token Generation

Test token generation helps when you need to test JWT verification without setting up complete identity infrastructure. FastMCP includes utilities for generating test key pairs and signed tokens.

```python
from fastmcp.server.auth.providers.jwt import JWTVerifier, RSAKeyPair

# Generate a key pair for testing
key_pair = RSAKeyPair.generate()

# Configure your server with the public key
verifier = JWTVerifier(
    public_key=key_pair.public_key,
    issuer="https://test.yourcompany.com",
    audience="test-mcp-server"
)

# Generate a test token using the private key
test_token = key_pair.create_token(
    subject="test-user-123",
    issuer="https://test.yourcompany.com", 
    audience="test-mcp-server",
    scopes=["read", "write", "admin"]
)

print(f"Test token: {test_token}")
```

This pattern enables comprehensive testing of JWT validation logic without depending on external token issuers. The generated tokens are cryptographically valid and will pass all standard JWT validation checks.

## Production Configuration

For production deployments, load sensitive configuration from environment variables:

```python
import os
from fastmcp import FastMCP
from fastmcp.server.auth.providers.jwt import JWTVerifier

# Load configuration from environment variables
# Parse comma-separated scopes if provided
scopes_env = os.environ.get("JWT_REQUIRED_SCOPES")
required_scopes = scopes_env.split(",") if scopes_env else None

verifier = JWTVerifier(
    jwks_uri=os.environ.get("JWT_JWKS_URI"),
    issuer=os.environ.get("JWT_ISSUER"),
    audience=os.environ.get("JWT_AUDIENCE"),
    required_scopes=required_scopes,
)

mcp = FastMCP(name="Production API", auth=verifier)
```

This keeps configuration out of your codebase while maintaining explicit setup.

This approach enables the same codebase to run across development, staging, and production environments with different authentication requirements. Development might use static tokens while production uses JWT verification, all controlled through environment configuration.

> ## Documentation Index
> Fetch the complete documentation index at: https://gofastmcp.com/llms.txt
> Use this file to discover all available pages before exploring further.
