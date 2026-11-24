# Backend reference

Constants:

```
AUTH_ORIGIN   = https://auth.claude.com
API_ORIGIN    = https://api.anthropic.com
API_VERSION   = 2026-10-21                         (anthropic-version header)
BILLING_BETA  = user-profiles-billing-2026-10-01   (anthropic-beta header)
ASSERTION_TYPE = urn:ietf:params:oauth:client-assertion-type:jwt-bearer
```

All `auth.claude.com` and `/v1/oauth/token` requests are `POST` with `content-type: application/json`.

## 1. Signer

An ES256 JWT, valid for 5 minutes, signed with the private key:

```
header  { "alg": "ES256", "kid": <kid>, "typ": "JWT" }
payload { "iss": <issuer URL>, "sub": <subject>, "aud": <audience>,
          "iat": now, "exp": now + 300, "jti": <random uuid> }
```

| Assertion | `sub` | `aud` |
|-----------|-------|-------|
| client | client subject | `https://auth.claude.com` |
| operator | operator subject | `https://api.anthropic.com` |

The signature must be the raw 64-byte `r||s` form, base64url:
- WebCrypto (`crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'}, key, data)`): already correct. Import the PKCS#8 PEM with `importKey('pkcs8', der, {name:'ECDSA', namedCurve:'P-256'}, false, ['sign'])`.
- Node `crypto.sign('sha256', data, { key, dsaEncoding: 'ieee-p1363' })`. Without `dsaEncoding` Node returns DER and the server answers `jwt_signature_invalid`.
- Python `cryptography`: `sign(data, ec.ECDSA(hashes.SHA256()))` returns DER; convert with `decode_dss_signature` to `r.to_bytes(32,'big') + s.to_bytes(32,'big')`. PyJWT with `algorithm="ES256"` already does this.
- Go: `ecdsa.Sign` returns `r, s`; pad each to 32 bytes.

## 2. Operator token

```
POST https://api.anthropic.com/v1/oauth/token
{
  "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
  "assertion": <operator assertion>,
  "federation_rule_id": "fdrl_…",
  "organization_id": "<organization id>",
  "service_account_id": "svac_…"
}
→ { "access_token": "...", "expires_in": ... }
```

Cache it in memory until about a minute before `expires_in` (about an hour). Use it as a bearer token (`Authorization: Bearer …`) on API calls; with the TypeScript SDK: `new Anthropic({ apiKey: null, authToken: token, defaultHeaders: { 'anthropic-version': API_VERSION } })`.

## 3. User profile (one per app user)

Create it the first time the user starts a link, and store the id next to the user.

```
POST https://api.anthropic.com/v1/user_profiles
Authorization: Bearer <operator token>
anthropic-version: 2026-10-21
{ "name": "Customer", "external_user_details": { "reference_id": "<opaque id>" } }
→ { "id": "uprof_…", ... }
```

Use an opaque `reference_id` (a hash of your user id), not an email or the raw id. The TypeScript SDK exposes it as `client.beta.userProfiles.create(...)` in recent versions.

## 4. `link/start` (authenticated route)

1. Find or create the user's profile.
2. Generate `state` (random, 24+ bytes), a PKCE verifier (random, 32 to 96 bytes, base64url) and `code_challenge = base64url(sha256(verifier))`, and a random browser binding value.
3. Store a pending row: `state`, verifier, `sha256(binding)`, user id, expiry 10 to 15 minutes. Never store the binding itself.
4. Push the authorization request:

```
POST https://auth.claude.com/v1/oauth/par
{
  "response_type": "code",
  "client_id": "clid_…",
  "redirect_uri": "<exact registered callback URL>",
  "scope": "billing:attribution offline_access",
  "connection_type": "organization_shared",
  "connection_auth_target": "platform",
  "user_profile_id": "uprof_…",
  "state": "<state>",
  "code_challenge": "<challenge>",
  "code_challenge_method": "S256",
  "client_assertion_type": "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
  "client_assertion": <client assertion>
}
→ 201 { "request_uri": "urn:ietf:params:oauth:request_uri:…", "expires_in": 600 }
```

5. Respond with a redirect (or the URL for the frontend to open) to
   `https://auth.claude.com/oauth/authorize?client_id=<clid>&request_uri=<url-encoded request_uri>`
   and set the cookie: `Set-Cookie: __Host-<app>_link=<binding>; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=900`.

If the frontend calls `link/start` with `fetch`, the cookie must be set on the backend's origin with credentials allowed for that one route, and the callback must be on the same origin. Otherwise make `link/start` a top-level navigation.

The `request_uri` lasts 10 minutes. The customer sees three screens: how billing works, a monthly spend limit, link and authorize.

## 5. `link/callback` (public route, the registered redirect URI)

Claude redirects to `redirect_uri?code=…&state=…&iss=https://identity.anthropic.com/users` (or `error=access_denied` if the customer cancels).

1. Look up the pending row by `state`; reject if missing or expired; delete it so it is single-use.
2. Read the cookie, hash it and compare with the stored hash in constant time. Reject if missing or different. This is the CSRF/account-linking protection; never "park" the code and complete it later from another session.
3. Exchange the code within 5 minutes:

```
POST https://auth.claude.com/v1/oauth/token
{
  "grant_type": "authorization_code",
  "code": "<code>",
  "code_verifier": "<verifier>",
  "redirect_uri": "<same callback URL>",
  "client_id": "clid_…",
  "client_assertion_type": "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
  "client_assertion": <client assertion>
}
→ { "access_token": "...", "expires_in": 3600,
    "refresh_token": "...", "refresh_token_expires_in": ~31500000,
    "connection_id": "ocon_…", "scope": "...", ... }
```

4. Save `connection_id`, the refresh token **encrypted** (for example AES-GCM with a key from the secret store, with the user id as associated data) and its expiry. Mark the user linked.
5. Clear the cookie and redirect back to the app with a status flag (`linked`, `canceled`, `error`). Do not put tokens or error details from Anthropic in the URL.

The refresh token lasts up to a year and rotates on each refresh: if the app refreshes, save the newest one every time. The billed call in step 6 authenticates with the operator token and names the customer with the profile id; it does not send the connection's tokens. Store the refresh token anyway (encrypted), and check the current docs for when it is needed.

## 6. The billed call

Operator token + profile header + `billing_policy` + beta header:

```
POST https://api.anthropic.com/v1/messages
Authorization: Bearer <operator token>
anthropic-version: 2026-10-21
anthropic-beta: user-profiles-billing-2026-10-01
anthropic-user-profile-id: uprof_…
{
  "model": "...",
  "max_tokens": ...,
  "messages": [...],
  "billing_policy": { "type": "billing_policy", "bill_to": "user_profile" }
}
```

TypeScript SDK: `client.beta.messages.create({ ...params, betas: [BILLING_BETA], billing_policy: {...} }, { headers: { 'anthropic-user-profile-id': profileId } })` (cast the params if the SDK version does not type `billing_policy` yet).

Responses that mean "not linked": `403 user_profile_billing_not_authorized` (never approved, revoked, or spend limit reached). Show a "Link your Claude organization" action instead of a generic error.

## 7. Status and unlink

- Status route: returns linked / not linked for the signed-in user, no ids or tokens.
- Unlink: delete the stored connection and refresh token locally, and tell the user they can also revoke it in their Console under Keys → Linked platforms.

## Limits to respect

- Bill only requests the customer started. No background jobs, no retries that bill twice.
- Batches and billable code execution are not supported with linked billing.
- The customer's ZDR/BAA does not apply to these calls.
