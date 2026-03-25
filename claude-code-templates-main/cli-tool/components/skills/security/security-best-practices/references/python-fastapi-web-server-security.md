# FastAPI (Python) Web Security Spec (FastAPI 0.128.x, Python 3.x) ([PyPI][1])

This document is designed as a **security spec** that supports:

1. **Secure-by-default code generation** for new FastAPI code.
2. **Security review / vulnerability hunting** in existing FastAPI code (passive “notice issues while working” and active “scan the repo and report findings”).

It is intentionally written as a set of **normative requirements** (“MUST/SHOULD/MAY”) plus **audit rules** (what bad patterns look like, how to detect them, and how to fix/mitigate them).

FastAPI is commonly deployed with an ASGI server (e.g., Uvicorn) and is built on Starlette + Pydantic, so this spec covers those layers where they affect security. ([PyPI][1])

---

## 0) Safety, boundaries, and anti-abuse constraints (MUST FOLLOW)

* MUST NOT request, output, log, or commit secrets (API keys, passwords, private keys, session cookies, signing keys, database URLs with credentials).
* MUST NOT “fix” security by disabling protections (e.g., weakening auth, making CORS permissive, skipping signature checks, disabling validation, turning off TLS verification, adding `allow_origins=["*"]` with credentials).
* MUST provide **evidence-based findings** during audits: cite file paths, code snippets, and configuration values that justify the claim.
* MUST treat uncertainty honestly: if a protection might exist in infrastructure (reverse proxy, WAF, CDN, service mesh), report it as “not visible in app code; verify at runtime/config”.
* MUST treat browser controls correctly:

  * CORS is **not** an auth mechanism; it only affects browsers.
  * CSRF defenses apply when the browser automatically attaches credentials (cookies); they are usually not relevant for purely header-token APIs. ([OWASP Cheat Sheet Series][2])

---

## 1) Operating modes

### 1.1 Generation mode (default)

When asked to write new FastAPI code or modify existing code:

* MUST follow every **MUST** requirement in this spec.
* SHOULD follow every **SHOULD** requirement unless the user explicitly says otherwise.
* MUST prefer safe-by-default APIs and proven libraries over custom security code.
* MUST avoid introducing new risky sinks (shell execution, unsafe deserialization, dynamic eval, untrusted template rendering, unsafe file serving, unsafe redirects, arbitrary outbound fetching).

### 1.2 Passive review mode (always on while editing)

While working anywhere in a FastAPI repo (even if the user did not ask for a security scan):

* MUST “notice” violations of this spec in touched/nearby code.
* SHOULD mention issues as they come up, with a brief explanation + safe fix.

### 1.3 Active audit mode (explicit scan request)

When the user asks to “scan”, “audit”, or “hunt for vulns”:

* MUST systematically search the codebase for violations of this spec.
* MUST output findings in a structured format (see §2.3).

Recommended audit order:

1. App entrypoints / deployment scripts / Dockerfiles / Procfiles / Helm/terraform.
2. ASGI server configuration (Uvicorn/Gunicorn), proxy settings, debug/reload settings.
3. FastAPI app configuration (docs exposure, middleware, trusted hosts, CORS).
4. Authn/Authz design (dependencies, JWT/session handling, password storage).
5. Cookie/session usage + CSRF (if cookies are used).
6. Input validation and output shaping (Pydantic models, mass assignment, excessive data exposure).
7. Template rendering and XSS/SSTI (if HTML is served).
8. File handling (uploads + downloads), StaticFiles, Range support.
9. Injection classes (SQL, command execution, unsafe deserialization).
10. Outbound requests (SSRF), redirect handling, WebSockets security.

---

## 2) Definitions and review guidance

### 2.1 Untrusted input (treat as attacker-controlled unless proven otherwise)

Examples include:

* Query parameters / path parameters
* JSON bodies (including nested fields)
* Headers (including `Host`, `Origin`, `X-Forwarded-*`)
* Cookies (including session cookies)
* File uploads (multipart parts)
* WebSocket messages, query params, and headers during handshake ([Starlette][3])
* Any data from external systems (webhooks, third-party APIs, message queues)
* Any persisted user content (DB rows) that originated from users

### 2.2 State-changing request

A request is state-changing if it can create/update/delete data, change auth/session state, trigger side effects (purchase, email send, webhook send), or initiate privileged actions.

### 2.3 Required audit finding format

For each issue found, output:

* Rule ID:
* Severity: Critical / High / Medium / Low
* Location: file path + function/route name + line(s)
* Evidence: the exact code/config snippet
* Impact: what could go wrong, who can exploit it
* Fix: safe change (prefer minimal diff)
* Mitigation: defense-in-depth if immediate fix is hard
* False positive notes: what to verify if uncertain

---

## 3) Secure baseline: minimum production configuration (MUST in production)

This is the smallest “production baseline” that prevents common FastAPI/ASGI misconfigurations.

Baseline goals:

* No debug tracebacks or auto-reload in production. ([PyPI][4])
* Run under a production ASGI server configuration (workers, timeouts, resource controls). ([PyPI][4])
* Host header validation enabled (TrustedHostMiddleware or equivalent). ([PyPI][5])
* CORS disabled unless explicitly needed; if enabled, it is strict and least-privilege. ([OWASP Cheat Sheet Series][6])
* Auth is enforced consistently via dependencies (no “oops, forgot auth on this route”). ([FastAPI][7])
* If cookies/sessions are used, cookie flags are secure and CSRF is addressed. ([OWASP Cheat Sheet Series][8])
* Request size limits and multipart limits exist at the edge and are validated in app as needed (to mitigate memory/CPU DoS). ([advisories.gitlab.com][9])
* Dependencies are patched promptly, especially Starlette/python-multipart (multiple DoS and traversal advisories exist historically). ([advisories.gitlab.com][10])

---

## 4) Rules (generation + audit)

Each rule contains: required practice, insecure patterns, detection hints, and remediation.

### FASTAPI-DEPLOY-001: Do not use auto-reload / dev-only server modes in production

Severity: High (if production)

Required:

* MUST NOT run production using auto-reload/watch mode (e.g., Uvicorn reload).
* MUST run with a production process model (e.g., multiple workers where appropriate) and stable server settings. ([PyPI][4])

Insecure patterns:

* `uvicorn ... --reload` (or equivalent “reload=True” configs) in production entrypoints.
* Docker/Procfile/systemd commands that run with `--reload` in production.

Detection hints:

* Search for `--reload`, `reload=True`, `watchfiles`, `fastapi dev`, “development” run scripts.
* Check Docker CMD/ENTRYPOINT, Procfile, systemd units, shell scripts.

Fix:

* Remove reload in production; run Uvicorn/Gunicorn with stable settings and explicit worker configuration. ([PyPI][4])

Note:

* Reload is fine for local development. Only flag when it is clearly used as a production entrypoint.

---

### FASTAPI-DEPLOY-002: Debug mode MUST be disabled in production

Severity: Critical

Required:

* MUST NOT enable debug tracebacks in production (FastAPI/Starlette debug mode can expose sensitive internals and make some exploit chains easier). ([PyPI][5])
* MUST treat any configuration that returns detailed stack traces to clients as sensitive.

Insecure patterns:

* `app = FastAPI(debug=True)` (or Starlette `debug=True`), or equivalent environment toggles enabling debug in production. ([PyPI][5])
* Server/log config that exposes tracebacks to end users.

Detection hints:

* Search for `debug=True`, `DEBUG = True`, environment flags mapped to debug.
* Review exception middleware and error handler setup.

Fix:

* Ensure debug is only enabled in local dev/test.
* Return generic error responses to clients; log details internally.

---

### FASTAPI-OPENAPI-001: OpenAPI and interactive docs MUST be disabled or protected in production

Severity: Medium (can be High in sensitive/internal apps)

Required:

* SHOULD disable `/docs`, `/redoc`, and `/openapi.json` in production for public-facing services unless there is an explicit business need.
* If enabled, MUST protect them (e.g., auth, network allowlists, or internal-only routing).
* MUST NOT assume “security through obscurity”; treat docs exposure as an information disclosure amplifier.

Insecure patterns:

* Publicly reachable `/docs` and `/openapi.json` for internal/admin APIs.
* Docs enabled on the same hostname as production without access control.

Detection hints:

* Look for `FastAPI(docs_url=..., redoc_url=..., openapi_url=...)` or defaults.
* Check reverse proxy routing and allowlists.

Fix:

* Disable docs endpoints in prod (`docs_url=None`, `redoc_url=None`, `openapi_url=None`) or restrict access at the edge.

---

### FASTAPI-AUTH-001: Authentication MUST be explicit and consistently enforced via dependencies

Severity: High

Required:

* MUST implement authentication as a dependency (or router-level dependency) so that protected endpoints cannot “forget” auth.
* MUST default to “deny” for privileged routers/endpoints; explicitly mark truly public routes.
* SHOULD centralize auth enforcement at router boundaries (e.g., protected `APIRouter` for authenticated endpoints). ([FastAPI][7])

Insecure patterns:

* Per-route ad-hoc auth checks scattered through handlers (easy to miss).
* A mix of protected/unprotected endpoints with no clear policy.

Detection hints:

* Identify routers and endpoints; check whether protected ones include `Depends(...)`/`Security(...)`.
* Search for patterns like `if user is None: raise ...` inside handlers (instead of dependencies).

Fix:

* Move authentication into a dependency and attach it to the router/endpoint consistently using `Depends()`/`Security()`. ([FastAPI][7])

---

### FASTAPI-AUTH-002: Use standard auth transports; avoid secrets in URLs

Severity: High

Required:

* SHOULD use the `Authorization: Bearer <token>` header for token auth, not query parameters. ([FastAPI][11])
* MUST NOT place secrets (tokens, reset links containing long-lived secrets, API keys) in query strings when avoidable.

Insecure patterns:

* `?token=...`, `?api_key=...`, `?auth=...` used for primary auth.
* Long-lived access tokens embedded in URLs (leak via logs, referrers, caches).

Detection hints:

* Search for parameter names like `token`, `api_key`, `key`, `secret`, `password`.
* Look for security schemes that use query API keys without justification.

Fix:

* Move tokens to Authorization headers; rotate/shorten lifetimes; use POST bodies for sensitive values.

---

### FASTAPI-AUTH-003: Password storage MUST be strongly hashed; never store plaintext passwords

Severity: Critical

Required:

* MUST store passwords using a strong, slow password hashing scheme (e.g., Argon2id, bcrypt).
* MUST NOT store plaintext passwords, or reversible encryption as the primary protection.
* SHOULD use established libraries for hashing and verification (do not roll your own).

Insecure patterns:

* Storing plaintext passwords in DB.
* Using fast hashes (e.g., SHA256) without a proper password hashing KDF.
* Returning password hashes in API responses.

Detection hints:

* Search for `password=` persisted fields, and look for `hashlib.md5/sha1/sha256` usage on passwords.
* Inspect response models for password/hash fields.

Fix:

* Migrate to a proper password hashing library; add a re-hash-on-login upgrade path.

---

### FASTAPI-AUTH-004: JWT validation MUST be strict; JWTs MUST NOT carry secrets

Severity: High

Required:

* MUST validate JWT signature and enforce an algorithm allowlist.
* MUST validate standard claims appropriate to your system (at least `exp`; typically also `iss`/`aud` if multi-service or multi-tenant).
* MUST treat JWT contents as readable by the client; do not put secrets in JWT payloads. ([FastAPI][12])

Insecure patterns:

* `jwt.decode(..., options={"verify_signature": False})` or equivalent.
* Accepting `alg=none` / algorithm confusion.
* Using JWT payload to store sensitive secrets (API keys, passwords).

Detection hints:

* Search for `jwt.decode`, `python-jose`, `PyJWT`, `verify_signature`.
* Check for missing exp validation or long expirations.

Fix:

* Enforce strict validation (signature, allowed algorithms, exp, and any required issuer/audience constraints).
* Store only identifiers/claims you are comfortable exposing to the client. ([FastAPI][12])

---

### FASTAPI-AUTHZ-001: Authorization MUST be enforced per-object and per-property

Severity: High

Required:

* MUST perform object-level authorization whenever accessing a resource by user-controlled identifier (ID in path/query/body).
* MUST perform property-level authorization and response shaping to prevent “excessive data exposure” (e.g., admin-only fields). ([OWASP Foundation][13])

Insecure patterns:

* `GET /users/{id}` returns user record without verifying caller can access that `id`.
* Response models include internal fields (roles, permissions, billing data, password hashes).

Detection hints:

* Enumerate endpoints that accept IDs; trace whether an authz check is performed.
* Compare response models for public vs internal fields.

Fix:

* Add object-level checks (ownership, ACLs, tenant boundaries).
* Use dedicated response models that include only allowed fields.

---

### FASTAPI-SESS-001: If using cookie-based sessions and TLS, cookie attributes MUST be secure in production

Severity: High (only if TLS is enabled)

Required (production, HTTPS):

* MUST set session cookies to be sent only over HTTPS (secure). IMPORTANT NOTE: Only set `Secure` in production environment when TLS is configured. When running in a local dev environment over HTTP, do not set `Secure` property on cookies. You should do this conditionally based on if the app is running in production mode. You should also include a property like `SESSION_COOKIE_SECURE` which can be used to disable `Secure` cookies when testing over HTTP.
* MUST set HttpOnly for session cookies (not accessible to JS).
* SHOULD use `SameSite=Lax` (or `Strict` if UX allows); if you require cross-site cookies, document the CSRF implications and add compensating controls. ([OWASP Cheat Sheet Series][8])
* If using Starlette `SessionMiddleware`, MUST set `https_only=True` in production and choose an appropriate `same_site`. ([PyPI][5])

Insecure patterns:

* Session cookies without Secure/HttpOnly.
* `SameSite=None` cookies used for authenticated state-changing endpoints without CSRF protections.

Detection hints:

* Search for `SessionMiddleware(` and inspect parameters like `https_only`, `same_site`.
* Search for `set_cookie(` usage and cookie flags.

Fix:

* Set secure cookie attributes; prefer short lifetimes for high-privilege sessions. ([OWASP Cheat Sheet Series][8])

---

### FASTAPI-SESS-002: Do not store sensitive secrets in signed session cookies

Severity: High

Required:

* MUST assume cookie-based session data is readable by the client (signed ≠ encrypted); do not store secrets/PII unless encrypted server-side.
* Store only opaque identifiers (e.g., session ID) or non-sensitive state in the cookie; store sensitive session state server-side. ([OWASP Cheat Sheet Series][8])

Insecure patterns:

* Storing access tokens, refresh tokens, or PII directly in cookie session payloads.
* Treating “signed cookies” as confidential storage.

Detection hints:

* Search for `request.session[...] =` or `session[...] =`-equivalent patterns; identify what is stored.
* Identify use of `SessionMiddleware` or other cookie session mechanisms.

Fix:

* Move sensitive values to server-side storage; keep cookie minimal.

---

### FASTAPI-CSRF-001: Cookie-authenticated state-changing requests MUST be CSRF-protected

Severity: High

Note: This only applies if using cookie based auth. If the application uses header or token based auth such as Authorization header, then CSRF is not an issue.

Required:

* MUST protect all state-changing endpoints (POST/PUT/PATCH/DELETE) that rely on cookies for authentication.
* SHOULD use a proven CSRF approach (synchronizer token pattern, or well-reviewed middleware) rather than rolling your own. ([OWASP Cheat Sheet Series][2])
* MAY add defense-in-depth (Origin/Referer checks, SameSite cookies, Fetch Metadata), but tokens are the primary defense for cookie-authenticated apps. ([OWASP Cheat Sheet Series][2])
* IMPORTANT NOTE: If cookies are not used for auth (auth is via `Authorization` header), CSRF is usually not applicable. ([FastAPI][11])

Insecure patterns:

* Cookie-authenticated endpoints that change state with no CSRF validation.
* Using GET for state-changing actions (amplifies CSRF risk).

Detection hints:

* Enumerate routes with methods other than GET; identify whether cookies are used for auth.
* Look for CSRF token generation/verification or middleware.

Fix:

* Add CSRF tokens (and validate them) on state-changing actions when cookie auth is in use. ([OWASP Cheat Sheet Series][2])

---

### FASTAPI-VALID-001: Request parsing and validation MUST be schema-driven; prevent mass assignment

Severity: Medium (especially for APIs that write to DB)

Required:

* SHOULD use Pydantic models for request bodies instead of accepting arbitrary `dict`/`Any`.
* SHOULD configure models to reject unexpected fields where appropriate (prevents “mass assignment” style bugs).
* MUST validate and normalize identifiers (IDs, email, URLs) before using them for access control or side effects. ([OWASP Cheat Sheet Series][14])

Insecure patterns:

* `payload = await request.json()` followed by `Model(**payload)` or direct DB writes with `payload` (no allowlist).
* Models that silently accept unknown fields for write endpoints.

Detection hints:

* Search for `await request.json()`, `request.body()`, `dict`-typed bodies, `Any`-typed bodies.
* Look for endpoints that do `db.update(**payload)` or `Model(**payload)` with unfiltered input.

Fix:

* Use explicit Pydantic models with allowlisted fields; reject extras for write endpoints. ([OWASP Cheat Sheet Series][14])

---

### FASTAPI-RESP-001: Prevent excessive data exposure via response models and explicit serialization

Severity: Medium

Required:

* MUST define response models that include only intended fields (especially for user objects, auth-related objects, billing objects).
* SHOULD use separate models for “create input”, “db/internal”, and “public output” to avoid leaking sensitive fields. ([FastAPI][15])

Insecure patterns:

* Returning ORM objects or dicts that include internal columns.
* Reusing “DB model” as the response model (includes `password_hash`, `is_admin`, etc).

Detection hints:

* Look for endpoints that `return user` where `user` is an ORM instance.
* Check for `response_model` omissions on endpoints that return sensitive resources.

Fix:

* Add explicit response models; create “public” schemas that exclude sensitive fields. ([FastAPI][15])

---

### FASTAPI-XSS-001: Prevent reflected/stored XSS in HTML responses and templates

Severity: High (if the service serves HTML)

Required:

* MUST use templating with auto-escaping enabled for HTML.
* MUST NOT mark untrusted content as safe (no unsafe “raw HTML” rendering of user-controlled data).
* SHOULD deploy a CSP when serving HTML that includes any user content. ([OWASP Cheat Sheet Series][16])

Insecure patterns:

* Rendering user content directly into HTML without escaping/sanitization.
* Disabling auto-escaping or using “raw HTML” features without sanitization.

Detection hints:

* Search for template rendering and string concatenation that builds HTML.
* Review templates for “unsafe” filters/constructs and unquoted attributes.

Fix:

* Keep auto-escaping on; sanitize user HTML only if absolutely required using a trusted sanitizer; add CSP. ([OWASP Cheat Sheet Series][16])

Note:

* If the app is a pure JSON API, XSS is usually a client/app concern, but error pages/docs pages might still render HTML.

---

### FASTAPI-SSTI-001: Never render untrusted templates (Server-Side Template Injection)

Severity: Critical

Required:

* MUST NOT render templates that contain user-controlled template syntax.
* MUST treat “template-from-string” rendering as dangerous if influenced by untrusted input.
* If untrusted templates are absolutely required (rare, high-risk):

  * MUST use a sandboxed templating approach and restrict capabilities.
  * MUST assume sandbox escapes are possible; add isolation and strict allowlists. ([OWASP Foundation][17])

Insecure patterns:

* Rendering templates loaded from user input or DB via a normal Jinja environment.
* Building templates dynamically using user-controlled strings.

Detection hints:

* Grep for Jinja `Environment.from_string`, `Template(...)`, or similar.
* Trace origin of template string (request, DB, uploads, admin panels).

Fix:

* Replace with non-executable templating (simple string substitution).
* If truly needed, use Jinja’s sandbox environment plus strong isolation. ([jinja.palletsprojects.com][18])

---

### FASTAPI-HEADERS-001: Set essential security headers (in app or at the edge)

Severity: Medium

Required (typical API/web app):

* SHOULD set:

  * `X-Content-Type-Options: nosniff`
  * Clickjacking protection (`X-Frame-Options` and/or CSP `frame-ancestors`) if HTML is served
  * `Referrer-Policy` and `Permissions-Policy` as appropriate

NOTE:

* Headers may be set by a proxy/CDN. If not visible in app code, flag as “verify at edge”. ([OWASP Cheat Sheet Series][6])

Insecure patterns:

* No security headers anywhere (app or edge) for apps serving HTML or sensitive APIs.

Detection hints:

* Search for middleware that sets headers; check reverse proxy config.

Fix:

* Set headers centrally (middleware) or via reverse proxy/CDN.

---

### FASTAPI-CORS-001: CORS MUST be explicit and least-privilege

Severity: Medium (High if misconfigured with credentials)

Required:

* If CORS is not needed, MUST keep it disabled.
* If CORS is needed:

  * MUST allowlist trusted origins (do not reflect arbitrary origins).
  * MUST NOT combine credentialed requests with wildcard origins (this is unsafe and commonly rejected by compliant middleware). ([OWASP Cheat Sheet Series][6])
  * SHOULD restrict allowed methods and headers.

Insecure patterns:

* `allow_origins=["*"]` together with `allow_credentials=True`.
* Reflecting `Origin` without validation.
* `allow_origin_regex=".*"` used broadly.

Detection hints:

* Search for `CORSMiddleware` configuration.
* Look for `allow_origins=["*"]`, `allow_credentials=True`, `allow_origin_regex`.

Fix:

* Use an explicit origin allowlist and minimal methods/headers; keep credentials off unless required. ([OWASP Cheat Sheet Series][6])

---

### FASTAPI-HOST-001: Host header MUST be validated in production

Severity: Low

Required:

* SHOULD use `TrustedHostMiddleware` (or equivalent at edge) to restrict accepted Host values. ([PyPI][5])
* MUST NOT trust the `Host` header for security-sensitive decisions without validation.

Insecure patterns:

* No Host validation while generating external URLs (password reset links, callback URLs) from request host.
* Allowing arbitrary Host headers in apps behind permissive proxies.

Detection hints:

* Search for `TrustedHostMiddleware` usage.
* Search for logic that uses `request.url`, `request.base_url`, or host-derived values to build external URLs.

Fix:

* Configure a strict allowed-hosts list in production; enforce at edge too if possible.

---

### FASTAPI-PROXY-001: Reverse proxy trust MUST be configured correctly

Severity: High (when behind a proxy)

Required:

* If behind a reverse proxy, MUST configure forwarded-header trust correctly.
* MUST NOT blindly trust `X-Forwarded-*` headers from the open internet.
* If using Uvicorn proxy header support, MUST restrict which IPs are allowed to provide forwarded headers. ([PyPI][4])

Insecure patterns:

* Enabling proxy headers broadly without restricting trusted proxy IPs.
* Using forwarded headers to decide “is secure” / “is internal” / “client IP” without proper trust boundaries.

Detection hints:

* Search for `--proxy-headers`, `--forwarded-allow-ips`, or equivalent config.
* Search for security-sensitive use of `request.client.host`, `request.url.scheme`, `request.headers["x-forwarded-for"]`.

Fix:

* Configure Uvicorn with proxy headers only when behind a known proxy, and restrict `forwarded_allow_ips` to that proxy. ([PyPI][4])
* Keep Host allowlisting in place even behind proxies.

---

### FASTAPI-LIMITS-001: Request and multipart limits MUST be enforced to prevent DoS

Severity: Low

Required:

* MUST enforce request size limits at the edge (reverse proxy/load balancer) and validate in app where needed.
* MUST apply special scrutiny to multipart/form-data handling; historical vulnerabilities include unbounded buffering and DoS vectors. ([advisories.gitlab.com][9])
* SHOULD rate limit and/or add per-IP/per-user throttles for expensive endpoints.

Insecure patterns:

* Accepting arbitrarily large JSON bodies or multipart forms.
* Parsing multipart forms without size/field-count controls.

Detection hints:

* Identify file upload endpoints and `multipart/form-data` usage.
* Look for missing proxy-level limits (nginx `client_max_body_size`, ALB limits, etc.) and missing app-level checks.

Fix:

* Enforce strict body limits and multipart constraints; keep Starlette and python-multipart updated to patched versions. ([advisories.gitlab.com][9])

---

### FASTAPI-FILES-001: Prevent path traversal and unsafe static file exposure

Severity: High

Required:

* MUST NOT pass user-controlled file paths to `FileResponse`/filesystem calls without strict validation and safe base directories.
* If using `StaticFiles`, MUST keep Starlette updated and understand the security history (path traversal advisory exists for older versions). ([advisories.gitlab.com][10])
* MUST NOT serve user uploads as executable/active content (especially HTML/JS) from a static root without safe handling.

Insecure patterns:

* `FileResponse(request.query_params["path"])`
* Mounting `StaticFiles(directory="uploads")` where uploads include HTML/JS/SVG and are served inline.

Detection hints:

* Search for `FileResponse(`, `StaticFiles(`, `open(` in routes.
* Trace whether the path originates from untrusted input.

Fix:

* Use opaque IDs for files; map IDs to server-side stored paths.
* Serve untrusted content as attachment downloads where appropriate.

---

### FASTAPI-FILES-002: Mitigate Range-header DoS on file-serving endpoints

Severity: Low (if affected versions and file serving is enabled)

Required:

* MUST keep Starlette patched against known file-serving DoS issues if using `FileResponse`/`StaticFiles`.
* MUST treat unusual `Range` header handling and file serving as a DoS surface. ([advisories.gitlab.com][19])

Insecure patterns:

* Serving large files with vulnerable Starlette versions.
* No rate limiting / CDN shielding for file endpoints.

Detection hints:

* Identify Starlette version; if in affected range, flag.
* Find uses of `FileResponse` and `StaticFiles`.

Fix:

* Upgrade Starlette to a fixed version per advisory guidance. ([advisories.gitlab.com][19])
* Add edge caching/rate limiting for file endpoints where appropriate.

---

### FASTAPI-UPLOAD-001: File uploads MUST be validated, stored safely, and served safely

Severity: Medium

Required:

* MUST enforce upload size limits (app + edge).
* MUST validate file type using allowlists and content checks (not only extension). ([OWASP Cheat Sheet Series][20])
* SHOULD generate server-side filenames (random IDs) and avoid trusting original names.
* MUST serve potentially active formats safely (download attachment) unless explicitly intended.

Insecure patterns:

* Accepting arbitrary file types and serving them back inline.
* Using user-supplied filename as storage path.

Detection hints:

* Look for upload handlers and where/how files are written.
* Look for direct exposure of upload directories.

Fix:

* Implement allowlist validation + safe storage + safe serving; add scanning/quarantine if applicable. ([OWASP Cheat Sheet Series][20])

---

### FASTAPI-INJECT-001: Prevent SQL injection (use parameterized queries / ORM)

Severity: High

Required:

* MUST use parameterized queries or an ORM that parameterizes under the hood.
* MUST NOT build SQL by string concatenation / f-strings with untrusted input. ([OWASP Cheat Sheet Series][21])

Insecure patterns:

* `f"SELECT ... WHERE id={user_id}"`
* `"... WHERE name = '%s'" % user_input`

Detection hints:

* Grep for SQL keywords in Python strings near `.execute(...)`.
* Trace untrusted data into DB calls.

Fix:

* Replace with parameterized queries / ORM query APIs; validate types before querying. ([OWASP Cheat Sheet Series][21])

---

### FASTAPI-INJECT-002: Prevent OS command injection

Severity: Critical to High (depends on exposure)

Required:

* MUST avoid executing shell commands with untrusted input.
* If subprocess is necessary:

  * MUST pass args as a list (not a string)
  * MUST NOT use `shell=True` with attacker-influenced strings
  * SHOULD use strict allowlists for any variable component ([OWASP Cheat Sheet Series][22])

Insecure patterns:

* `os.system(user_input)`
* `subprocess.run(f"cmd {user}", shell=True)`
* Passing user strings into `bash -c`, `sh -c`, PowerShell, etc.

Detection hints:

* Search for `os.system`, `subprocess`, `Popen`, `shell=True`.
* Trace data from request/DB into these calls.

Fix:

* Use library APIs instead of shell commands.
* If unavoidable, hard-code the command and allowlist validated parameters; use `--` separator where supported. ([OWASP Cheat Sheet Series][22])

---

### FASTAPI-SSRF-001: Prevent server-side request forgery (SSRF) in outbound HTTP

Severity: Medium (can be High in cloud/VPC environments)

- Note: For small stand alone projects this is less important. It is most important when deploying into an LAN or with other services listening on the same server.

Required:

* MUST treat outbound requests to user-provided URLs as high risk.
* SHOULD validate and restrict destinations (allowlist hosts/domains) for any user-influenced URL fetch.
* SHOULD block access to localhost/private IP ranges/link-local and cloud metadata endpoints.
* MUST restrict protocols to http/https.
* SHOULD set timeouts and carefully control redirects. ([OWASP Cheat Sheet Series][23])

Insecure patterns:

* `httpx.get(request.query_params["url"])`
* “URL preview/import/webhook tester” features that accept arbitrary URLs.

Detection hints:

* Search for `requests`, `httpx`, `urllib`, `aiohttp` calls with URLs derived from requests/DB.
* Identify endpoints named `fetch`, `preview`, `proxy`, `webhook`, `import`.

Fix:

* Implement strict URL parsing + allowlists; add egress controls; set short timeouts; disable redirects if not required. ([OWASP Cheat Sheet Series][23])

---

### FASTAPI-REDIRECT-001: Prevent open redirects

Severity: Low

Required:

* MUST validate redirect targets derived from untrusted input (`next`, `redirect`, `return_to`).
* SHOULD prefer redirecting only to same-site relative paths or an allowlist of domains. ([OWASP Cheat Sheet Series][24])

Insecure patterns:

* Returning `RedirectResponse(next)` where `next` is user-controlled with no validation.

Detection hints:

* Search for `RedirectResponse(` or redirect logic and examine the source of the target.

Fix:

* Allow only relative paths or allowlisted domains; fall back to a safe default. ([OWASP Cheat Sheet Series][24])

---

### FASTAPI-WS-001: WebSocket endpoints MUST be authenticated and protected against cross-site abuse

Severity: Medium to High (depends on data/privilege)

Required:

* MUST authenticate WebSocket connections for any non-public channel (WebSockets don’t inherently provide auth). ([OWASP Cheat Sheet Series][25])
* SHOULD enforce origin/CSRF-like protections appropriate for browser-based WebSocket clients (Origin validation is a common control).
* SHOULD rate limit message frequency and connection attempts; close idle/abusive connections.

Insecure patterns:

* `@app.websocket(...)` accepts and trusts the connection with no auth check.
* Using query-string tokens for auth without considering leakage/rotation.

Detection hints:

* Search for `@app.websocket` / `websocket_endpoint` and inspect whether auth is performed before accepting sensitive operations.
* Review origin checks, token parsing, and per-connection authorization.

Fix:

* Require authentication during handshake (e.g., a token or session) and enforce authorization for actions/messages.
* Validate Origin for browser-based clients where appropriate; apply rate limits and timeouts. ([OWASP Cheat Sheet Series][25])

---

### FASTAPI-SUPPLY-001: Dependency and patch hygiene (focus on security-relevant deps)

Severity: Low

Required:

* SHOULD pin and regularly update security-critical dependencies (FastAPI, Starlette, Uvicorn, Pydantic, python-multipart, auth/JWT libs).
* MUST respond to known security advisories promptly.
* MUST treat file serving and multipart parsing dependencies as security-sensitive due to historical CVEs. ([advisories.gitlab.com][10])

Audit focus examples (historical):

* Starlette StaticFiles path traversal (fixed in 0.27.0). ([advisories.gitlab.com][10])
* Starlette multipart/form-data DoS (fixed in 0.40.0). ([advisories.gitlab.com][9])
* Starlette FileResponse Range header DoS (fixed in 0.49.1). ([advisories.gitlab.com][19])

Detection hints:

* Check `requirements.txt`, lockfiles, container images, and runtime environments for actual installed versions.
* Map file upload/file serving features to dependency versions.

Fix:

* Upgrade to patched versions per advisories; add regression tests around affected behavior.

---

## 5) Practical scanning heuristics (how to “hunt”)

When actively scanning, use these high-signal patterns:

* Dev server / debug:

  * `--reload`, `reload=True`, `debug=True`, `FastAPI(debug=True)` ([PyPI][4])
* OpenAPI/docs exposure:

  * `/docs`, `/redoc`, `/openapi.json`, `docs_url=`, `openapi_url=`
* Auth enforcement gaps:

  * Endpoints missing `Depends()`/`Security()` where expected; routers without a consistent dependency boundary ([FastAPI][7])
  * Tokens in query params (`token=`, `api_key=`, `key=`) ([FastAPI][11])
* Session/cookies + CSRF:

  * `SessionMiddleware(` and cookie flags (`https_only`, `same_site`) ([PyPI][5])
  * POST/PUT/PATCH/DELETE handlers using cookie auth with no CSRF checks ([OWASP Cheat Sheet Series][2])
* Input validation & mass assignment:

  * `await request.json()` and direct DB writes from dicts; models accepting extra fields ([OWASP Cheat Sheet Series][14])
* Excessive data exposure:

  * Returning ORM objects or dicts without `response_model`; responses containing password/role/internal fields ([FastAPI][15])
* CORS:

  * `CORSMiddleware` with `allow_origins=["*"]`, `allow_origin_regex=".*"`, `allow_credentials=True` ([OWASP Cheat Sheet Series][6])
* Files:

  * `FileResponse(` with user-controlled paths; `StaticFiles(` exposing uploads ([advisories.gitlab.com][10])
* Uploads / multipart:

  * `multipart/form-data` endpoints with no size/field constraints; outdated Starlette/python-multipart ([advisories.gitlab.com][9])
* Injection:

  * SQL strings with f-strings/concatenation into `.execute(...)` ([OWASP Cheat Sheet Series][21])
  * `subprocess.*`, `shell=True`, `os.system` ([OWASP Cheat Sheet Series][22])
* SSRF:

  * `httpx.get/post` or `requests.*` with URL from request/DB, no allowlist/timeouts ([OWASP Cheat Sheet Series][23])
* Redirect:

  * `RedirectResponse(next)` with no validation ([OWASP Cheat Sheet Series][24])
* WebSockets:

  * `@app.websocket` handlers without auth/origin checks; use of `ws://` in prod configs ([FastAPI][27])

Always try to confirm:

* data origin (untrusted vs trusted)
* sink type (SQL/subprocess/files/template/http/redirect/ws)
* protective controls present (validation, allowlists, middleware, edge controls)
* installed dependency versions vs vulnerable ranges ([advisories.gitlab.com][10])

---

## 6) Sources (accessed 2026-01-27)

Primary framework documentation:

* FastAPI (PyPI metadata, versioning) — `https://pypi.org/project/fastapi/` ([PyPI][1])
* FastAPI docs: Security “First Steps” (Authorization Bearer header conventions) — `https://fastapi.tiangolo.com/tutorial/security/first-steps/` ([FastAPI][11])
* FastAPI reference: Dependencies (`Depends`, `Security`) — `https://fastapi.tiangolo.com/reference/dependencies/` ([FastAPI][7])
* FastAPI reference: APIRouter (router-level dependencies) — `https://fastapi.tiangolo.com/reference/apirouter/` ([FastAPI][28])
* FastAPI docs: WebSockets — `https://fastapi.tiangolo.com/advanced/websockets/` ([FastAPI][27])

ASGI/server stack documentation:

* Starlette (PyPI, general capabilities) — `https://pypi.org/project/starlette/` ([PyPI][5])
* Starlette docs: WebSockets — `https://starlette.dev/websockets/` ([Starlette][3])
* Uvicorn (PyPI metadata) — `https://pypi.org/project/uvicorn/` ([PyPI][4])
* Pydantic docs (v2.12.x) — `https://docs.pydantic.dev/latest/` ([Pydantic][29])

Security standards and cheat sheets:

* OWASP Cheat Sheet Series: Session Management — `https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html` ([OWASP Cheat Sheet Series][8])
* OWASP Cheat Sheet Series: CSRF Prevention — `https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html` ([OWASP Cheat Sheet Series][2])
* OWASP Cheat Sheet Series: XSS Prevention — `https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html` ([OWASP Cheat Sheet Series][16])
* OWASP Cheat Sheet Series: Mass Assignment — `https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html` ([OWASP Cheat Sheet Series][14])
* OWASP API Security Top 10 (2023) — `https://owasp.org/API-Security/editions/2023/en/0x11-t10/` ([OWASP Foundation][13])
* OWASP Cheat Sheet Series: SQL Injection Prevention — `https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html` ([OWASP Cheat Sheet Series][21])
* OWASP Cheat Sheet Series: OS Command Injection Defense — `https://cheatsheetseries.owasp.org/cheatsheets/OS_Command_Injection_Defense_Cheat_Sheet.html` ([OWASP Cheat Sheet Series][22])
* OWASP Cheat Sheet Series: SSRF Prevention — `https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html` ([OWASP Cheat Sheet Series][23])
* OWASP Cheat Sheet Series: File Upload — `https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html` ([OWASP Cheat Sheet Series][20])
* OWASP Cheat Sheet Series: Unvalidated Redirects and Forwards — `https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html` ([OWASP Cheat Sheet Series][24])
* OWASP Cheat Sheet Series: HTTP Security Response Headers — `https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html` ([OWASP Cheat Sheet Series][6])
* OWASP Cheat Sheet Series: WebSocket Security — `https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html` ([OWASP Cheat Sheet Series][25])
* OWASP WSTG: Testing for Server-Side Template Injection — `https://owasp.org/www-project-web-security-testing-guide/v41/4-Web_Application_Security_Testing/07-Input_Validation_Testing/18-Testing_for_Server_Side_Template_Injection` ([OWASP Foundation][17])
* OWASP WSTG: Testing WebSockets — `https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/11-Client-side_Testing/10-Testing_WebSockets` ([OWASP Foundation][26])

Template safety references:

* Jinja: Sandbox — `https://jinja.palletsprojects.com/en/stable/sandbox/` ([jinja.palletsprojects.com][18])

Selected supply-chain/advisory references (Starlette examples):

* CVE-2023-29159 (StaticFiles path traversal; fixed 0.27.0) — `https://advisories.gitlab.com/pkg/pypi/starlette/CVE-2023-29159/` ([advisories.gitlab.com][10])
* CVE-2024-47874 (multipart/form-data DoS; fixed 0.40.0) — `https://advisories.gitlab.com/pkg/pypi/starlette/CVE-2024-47874/` ([advisories.gitlab.com][9])
* CVE-2025-62727 (FileResponse Range header DoS; fixed 0.49.1) — `https://advisories.gitlab.com/pkg/pypi/starlette/CVE-2025-62727/` ([advisories.gitlab.com][19])

[1]: https://pypi.org/project/fastapi/ "https://pypi.org/project/fastapi/"
[2]: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html "https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html"
[3]: https://starlette.dev/websockets/?utm_source=chatgpt.com "Websockets"
[4]: https://pypi.org/project/uvicorn/ "https://pypi.org/project/uvicorn/"
[5]: https://pypi.org/project/starlette/ "https://pypi.org/project/starlette/"
[6]: https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html?utm_source=chatgpt.com "HTTP Security Response Headers Cheat Sheet"
[7]: https://fastapi.tiangolo.com/reference/dependencies/?utm_source=chatgpt.com "Dependencies - Depends() and Security() - FastAPI"
[8]: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html "https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html"
[9]: https://advisories.gitlab.com/pkg/pypi/starlette/CVE-2024-47874/ "Starlette Denial of service (DoS) via multipart/form-data | GitLab Advisory Database"
[10]: https://advisories.gitlab.com/pkg/pypi/starlette/CVE-2023-29159/ "Starlette has Path Traversal vulnerability in StaticFiles | GitLab Advisory Database"
[11]: https://fastapi.tiangolo.com/tutorial/security/first-steps/?utm_source=chatgpt.com "Security - First Steps - FastAPI"
[12]: https://fastapi.tiangolo.com/tutorial/response-model/ "https://fastapi.tiangolo.com/tutorial/response-model/"
[13]: https://owasp.org/API-Security/editions/2023/en/0x11-t10/ "https://owasp.org/API-Security/editions/2023/en/0x11-t10/"
[14]: https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html "https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html"
[15]: https://fastapi.tiangolo.com/tutorial/extra-models/ "https://fastapi.tiangolo.com/tutorial/extra-models/"
[16]: https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html "https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html"
[17]: https://owasp.org/www-project-web-security-testing-guide/v41/4-Web_Application_Security_Testing/07-Input_Validation_Testing/18-Testing_for_Server_Side_Template_Injection?utm_source=chatgpt.com "Testing for Server Side Template Injection"
[18]: https://jinja.palletsprojects.com/en/stable/sandbox/?utm_source=chatgpt.com "Sandbox — Jinja Documentation (3.1.x)"
[19]: https://advisories.gitlab.com/pkg/pypi/starlette/CVE-2025-62727/ "Starlette vulnerable to O(n^2) DoS via Range header merging in ``starlette.responses.FileResponse`` | GitLab Advisory Database"
[20]: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html "https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html"
[21]: https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html "https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html"
[22]: https://cheatsheetseries.owasp.org/cheatsheets/OS_Command_Injection_Defense_Cheat_Sheet.html "https://cheatsheetseries.owasp.org/cheatsheets/OS_Command_Injection_Defense_Cheat_Sheet.html"
[23]: https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html "https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html"
[24]: https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html?utm_source=chatgpt.com "Unvalidated Redirects and Forwards Cheat Sheet"
[25]: https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html?utm_source=chatgpt.com "WebSocket Security - OWASP Cheat Sheet Series"
[26]: https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/11-Client-side_Testing/10-Testing_WebSockets?utm_source=chatgpt.com "WSTG - Latest | OWASP Foundation"
[27]: https://fastapi.tiangolo.com/advanced/websockets/?utm_source=chatgpt.com "WebSockets - FastAPI"
[28]: https://fastapi.tiangolo.com/reference/apirouter/?utm_source=chatgpt.com "APIRouter class - FastAPI"
[29]: https://docs.pydantic.dev/latest/ "https://docs.pydantic.dev/latest/"
