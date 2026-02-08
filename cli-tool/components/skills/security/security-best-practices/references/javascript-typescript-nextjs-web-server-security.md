# Next.js (TypeScript/JavaScript) Web Security Spec (Next.js 16.1.x, Node.js 20.9+)

This document is designed as a **security spec** that supports:

1. **Secure-by-default code generation** for new Next.js backend code (Route Handlers, API Routes, Server Actions, Proxy/Middleware).
2. **Security review / vulnerability hunting** in existing Next.js repos (passive “notice issues while working” and active “scan the repo and report findings”).

It is intentionally written as a set of **normative requirements** (“MUST/SHOULD/MAY”) plus **audit rules** (what bad patterns look like, how to detect them, and how to fix/mitigate them).

Target scope: Next.js **16.1.x** (latest line shown in the App Router docs) ([Next.js][1]), running on Node.js **20.9+** (per Next.js system requirements). ([Next.js][2])

---

## 0) Safety, boundaries, and anti-abuse constraints (MUST FOLLOW)

* MUST NOT request, output, log, or commit secrets (API keys, passwords, private keys, session cookies, OAuth tokens, `process.env` dumps, database URLs with credentials).
* MUST NOT “fix” security by disabling protections (e.g., disabling origin checks, relaxing CORS to `*`, skipping authz checks, turning off cookie security flags, turning off CSP because it’s “hard”).
* MUST provide **evidence-based findings** during audits: cite file paths, code snippets, and configuration values that justify each claim.
* MUST treat uncertainty honestly: if a protection might exist in infrastructure (reverse proxy, CDN, WAF, platform headers), report it as “not visible in app code; verify at runtime/config”.
* MUST assume all request-facing server code is reachable by attackers unless there is a clearly enforced auth boundary (not just “the UI doesn’t link to it”).
* MUST treat TypeScript types as **non-security boundaries**: types do not validate runtime input; runtime checks are required. ([Next.js][3])

---

## 1) Operating modes

### 1.1 Generation mode (default)

When asked to write new Next.js code or modify existing code:

* MUST follow every **MUST** requirement in this spec.
* SHOULD follow every **SHOULD** requirement unless the user explicitly says otherwise.
* MUST prefer safe-by-default APIs and proven libraries over custom security code.
* MUST avoid introducing new risky sinks (dynamic code execution, unsafe redirects, serving user files as HTML, SSRF URL fetchers, building SQL strings, etc.).

### 1.2 Passive review mode (always on while editing)

While working anywhere in a Next.js repo (even if the user did not ask for a security scan):

* MUST “notice” violations of this spec in touched/nearby code.
* SHOULD mention issues as they come up, with a brief explanation + safe fix.

### 1.3 Active audit mode (explicit scan request)

When the user asks to “scan”, “audit”, or “hunt for vulns”:

* MUST systematically search the codebase for violations of this spec.
* MUST output findings in a structured format (see §2.3).

Recommended audit order:

1. Deployment entrypoints and environment (Dockerfiles, `package.json` scripts, hosting config).
2. Next.js config (`next.config.*`), Proxy/Middleware, routing patterns.
3. Authentication, sessions, cookies.
4. CSRF protections and state-changing endpoints (Server Actions, Route Handlers, API Routes).
5. XSS (React + CSP) and unsafe HTML rendering.
6. Cache/data-leak hazards (static rendering + caching + “use cache”).
7. File handling (uploads/downloads) and path traversal.
8. Injection classes (SQL/ORM misuse, command execution, unsafe deserialization).
9. Outbound requests (SSRF).
10. Redirect handling (open redirects).
11. CORS and security headers.

---

## 2) Definitions and review guidance

### 2.1 Untrusted input (treat as attacker-controlled unless proven otherwise)

In Next.js backends, untrusted input includes:

App Router:

* Route Handler params and request data:

  * `context.params` (dynamic segments), search params (`request.url`, `new URL(request.url).searchParams`)
  * `request.headers`, `request.cookies`
  * `await request.json()`, `await request.formData()`, `await request.text()`
* Dynamic APIs used in Server Components/Server Functions:

  * `headers()` and `cookies()` values ([Next.js][4])

Pages Router:

* `req.query`, `req.cookies`, `req.body` in `pages/api/*` handlers ([Next.js][3])

Plus:

* Anything from external systems (webhooks, third-party APIs, message queues)
* Any persisted user content (DB rows) that originated from users

### 2.2 State-changing request

A request is state-changing if it can create/update/delete data, change auth/session state, trigger side effects (purchase, email send, webhook send), or initiate privileged actions.

Special note for Next.js:

* **Server Actions** are invoked via network requests and can mutate state; treat them as state-changing endpoints. ([Next.js][5])

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

This is the smallest “production baseline” that prevents common Next.js backend misconfigurations.

### 3.1 Run Next.js in production mode (MUST)

* MUST run `next build` + `next start` (or the managed platform equivalent), not `next dev`. Dev mode has different error/reporting behavior and is not designed for production exposure. ([Next.js][6])
* MUST ensure `NODE_ENV=production` in production (Next.js defaults `NODE_ENV` based on command; verify the runtime environment). ([Next.js][7])

### 3.2 Put a reverse proxy / edge layer in front when self-hosting (MUST for public internet)

* If self-hosting, MUST place a reverse proxy (e.g., nginx) or equivalent edge layer in front of the Next.js server to handle malformed requests, slow attacks, payload size limits, rate limiting, and similar concerns. ([Next.js][8])

### 3.3 Baseline header/cookie posture (SHOULD)

* SHOULD set a baseline of security headers globally (CSP, `X-Content-Type-Options`, clickjacking defense via CSP `frame-ancestors` and/or `X-Frame-Options`, etc.). Next.js provides guidance for implementing CSP via Proxy/headers. ([Next.js][7])
* MUST ensure auth/session cookies use secure attributes (`Secure`, `HttpOnly`, `SameSite`) as appropriate. ([Next.js][9])
IMPORTANT NOTE: Only set `Secure` in production environment. When running in a local dev environment over HTTP, do not set `Secure` property on cookies. You should do this conditionally based on if the app is running in production mode. You should also include a property like `SESSION_COOKIE_SECURE` which can be used to disable `Secure` cookies when testing over HTTP.

### 3.4 Clear separation between server-only and client code (MUST)

* MUST prevent secrets and privileged logic from being bundled into client code.
* MUST treat `NEXT_PUBLIC_*` environment variables as public (browser-exposed and inlined at build time). ([Next.js][7])

---

## 4) Rules (generation + audit)

Each rule contains: required practice, insecure patterns, detection hints, and remediation.

### NEXT-DEPLOY-001: Do not run `next dev` in production; ensure production mode behavior

Severity: High (if production)

NOTE: If they are deploying to a specific Next.js hosting provider, they do not need to worry about this.

Required:

* MUST NOT deploy `next dev` or any development server mode to production.
* MUST ensure production builds and production runtime are used for any public deployment. ([Next.js][6])

Insecure patterns:

* `next dev` in Docker `CMD`, Procfile, platform start command.
* `NODE_ENV=development` in production environment config.
* Debug/dev-only endpoints or flags exposed publicly.

Detection hints:

* Search `package.json` scripts and deployment manifests for `next dev`.
* Search infra for `NODE_ENV=development` or missing `NODE_ENV`.
* Check Kubernetes/PM2/systemd entrypoints for `next dev`.

Fix:

* Use `next build` during CI/build and `next start` at runtime (or platform-native build/run).
* Ensure environment sets `NODE_ENV=production`.

Note:

* Dev mode is fine for local development. Only flag if it is being used as a production entrypoint.

---

### NEXT-SUPPLY-001: Stay on supported Next.js releases; patch quickly for security advisories

Severity: High (Critical if known-vulnerable version)

Required:

* MUST run a supported Next.js version line and apply security updates promptly. Next.js documents an LTS/support policy. ([Next.js][10])
* MUST treat published advisories as urgent upgrade signals (e.g., update to a patched release). ([GitHub][11])

Insecure patterns:

* Running EOL Next.js major/minor without backported security fixes.
* Ignoring advisories, or pinning `next` to a vulnerable range.

Detection hints:

* Check `package.json` and lockfiles for `next` version.
* Compare against Next.js support policy and advisories.

IMPORTANT: Any versions older than these minor versions are vulnerable to "react2shell" vulnerability (https://nextjs.org/blog/CVE-2025-66478):
15.0.5
15.1.9
15.2.6
15.3.6
15.4.8
15.5.7
16.0.7

Fix:

* Upgrade `next` to a supported and patched version.
* Add a dependency update process + CI checks.


---

### NEXT-SECRETS-001: Secrets MUST NOT be committed or exposed to the browser

Severity: High (Critical if secret is client-exposed)

Required:

* MUST store secrets in environment variables or a secret manager; MUST NOT commit `.env*` files.
* MUST treat `.env*` as sensitive; Next.js warns you “almost never want to commit these files.” ([Next.js][7])
* MUST treat any `NEXT_PUBLIC_*` environment variable as public and browser-visible (inlined into the client bundle at build time). ([Next.js][7])

Insecure patterns:

* `.env`, `.env.local`, `.env.production` committed to git.
* `NEXT_PUBLIC_API_KEY`, `NEXT_PUBLIC_SECRET`, `NEXT_PUBLIC_DATABASE_URL`, etc.
* Rendering `process.env` values into HTML or returning them from API routes.

Detection hints:

* Scan git history and repo files for `.env` content, `DB_PASS=`, `API_KEY=`, `SECRET=`.
* Grep for `NEXT_PUBLIC_` and review any sensitive-looking names.
* Search for `process.env` usage in Client Components (`"use client"`) and shared modules.

Fix:

* Move secrets to server-only env vars (no `NEXT_PUBLIC_` prefix).
* Ensure `.env*` is ignored and secrets are injected at deploy time.
* Rotate leaked keys.

---

### NEXT-SECRETS-002: Avoid server-only → client bundling mistakes (server/client boundary is a security boundary)

Severity: High

Required:

* MUST ensure server-only modules (DB clients, secret-dependent code) are not imported into Client Components or other client-bundled code paths.
* SHOULD use server-only patterns/layers (e.g., a dedicated DAL and server-only modules) and treat boundary violations as security bugs. Next.js explicitly discusses the “server-only” concept for sensitive modules. ([Next.js][6])

Insecure patterns:

* Importing DB clients, admin SDKs, or secret-reading modules into `"use client"` components.
* Shared `lib/` modules imported by both server and client code that reference secrets.

Detection hints:

* Search for `"use client"` and examine its imports for server-only dependencies.
* Look for DB client packages (`pg`, `mysql2`, `mongoose`, `prisma`, admin SDKs) imported from `components/` or other client paths.
* Search for `process.env` access in UI components.

Fix:

* Refactor into `lib/server/*` and only import from server contexts (Route Handlers, Server Components, Server Actions).
* Add an explicit “server-only” guard pattern (and/or tests) to prevent accidental imports.

---

### NEXT-AUTH-001: Authentication/authorization MUST be enforced server-side for every protected action

Severity: High

Required:

* MUST enforce authn/authz in server-side code for:

  * Route Handlers (`app/**/route.ts`) ([Next.js][1])
  * API Routes (`pages/api/**`) ([Next.js][3])
  * Server Actions (`"use server"` functions invoked by clients) ([Next.js][6])
* MUST NOT rely on client-side checks (hiding UI, route guards on the client) as the only protection.

Insecure patterns:

* Sensitive Route Handlers with no session verification.
* Server Actions that mutate data but do not validate user identity/permissions.
* “Authorization” checks in React components only.

Detection hints:

* Enumerate all Route Handlers and API Routes; for each, identify whether it requires auth.
* Grep for `"use server"` and review all exported actions for auth checks.
* Search for admin actions triggered by query params / form submits.

Fix:

* Centralize auth helpers and call them in every protected endpoint/action.
* Implement least-privilege authorization checks (role/resource ownership) per action.

---

### NEXT-AUTH-002: Proxy/Middleware-based auth MUST NOT create route coverage gaps

Severity: High

Required:

* If using **Proxy** or **Middleware** for authentication checks, MUST ensure it covers every route that needs protection.
* Next.js documentation notes Proxy can use a `matcher`, and for auth it’s recommended Proxy runs on all routes. ([Next.js][12])
* MUST treat `matcher` mistakes as an auth bypass risk.

Insecure patterns:

* Proxy/Middleware only matches “pages” but not `/api/*`, or only matches some route groups.
* “Denylist” style matchers that miss alternative request forms (framework-internal variants, RSC navigations, etc.).

Detection hints:

* Inspect `proxy.ts` / `middleware.ts` and its `matcher`.
* Compare matchers to the full set of routes (including `app/api/**` and `pages/api/**`).
* Ensure static assets and Next internals are excluded only intentionally, and that sensitive routes are included.

Fix:

* Prefer allowlisting protected route prefixes or running Proxy globally and doing internal allow/deny logic.
* Add integration tests: request protected route without auth and assert denial.

Notes:

* Proxy is commonly used for “optimistic checks”; it is not a complete authorization system by itself. ([Next.js][12])

---

### NEXT-CSRF-001: Cookie-authenticated state-changing endpoints MUST be CSRF-protected

Severity: High

- IMPORTANT NOTE: If cookies are not being used for auth (ie auth is via Authentication header or other passed token), then there is no CSRF risk.

Required:

* MUST protect every state-changing endpoint that relies on cookies for auth (POST/PUT/PATCH/DELETE).
* For **Server Actions**, Next.js performs an Origin/Host comparison to help prevent CSRF; do not disable or weaken it. ([Next.js][5])
* If Server Actions must be callable from additional trusted origins (e.g., a trusted proxy domain), MUST use `allowedOrigins` with a strict allowlist. ([Next.js][5])
* For **Route Handlers** and **API Routes**, MUST implement CSRF protections explicitly (tokens and/or strict Origin/Referer + SameSite + custom headers). Route Handlers are an “escape hatch” and require application-level security decisions. ([Next.js][6])

Insecure patterns:

* POST endpoints (including Server Actions) that mutate state and accept cross-site requests with no token/origin checks.
* `allowedOrigins: ['*']` (or broad wildcards) or “reflect Origin” logic.
* Using GET requests to change state.

Detection hints:

* Enumerate all state-changing endpoints and determine auth mechanism.
* Search for `allowedOrigins` and confirm the list is small, specific, and justified. ([Next.js][5])
* In Route Handlers/API Routes: look for missing CSRF token validation or missing Origin/Referer checks.

Fix:

* Implement a CSRF token strategy for cookie-auth endpoints.
* Keep cookies `SameSite=Lax` or `Strict` when compatible; don’t treat SameSite alone as sufficient.
* Use strict Origin validation for JSON API endpoints, especially when not using CSRF tokens.

Notes:

* XSS can defeat CSRF protections; CSRF defenses do not replace XSS prevention.

---

### NEXT-SESS-001: Session cookies MUST use secure attributes in production

Severity: Medium

Required (production, HTTPS):

* MUST set session/auth cookies with:

  * `Secure: true` (HTTPS-only) IMPORTANT NOTE: Only set `Secure` in production environment. When running in a local dev environment over HTTP, do not set `Secure` property on cookies. You should do this conditionally based on if the app is running in production mode. You should also include a property like `SESSION_COOKIE_SECURE` which can be used to disable `Secure` cookies when testing over HTTP.
  * `HttpOnly: true` (not readable by JS)
  * `SameSite: 'Lax'` (recommended) or `'Strict'` if compatible
* Only use `SameSite: 'none'` when you truly need cross-site cookies, and then MUST also set `Secure`. Cookie options are supported in Next.js cookie APIs. ([Next.js][9])

Insecure patterns:

* `secure: false` in production.
* `httpOnly: false` for auth cookies.
* `sameSite: 'none'` without a clear need, especially on cookie-authenticated state-changing endpoints.

Detection hints:

* Search for cookie setting sites (`cookies().set(...)`, `Set-Cookie` headers, auth library cookie config).
* Review cookie options used in Route Handlers and Server Actions. ([Next.js][9])

Fix:

* Set secure cookie attributes at the auth/session layer.
* Reduce cookie scope: avoid wide `domain` unless you explicitly need subdomain-wide cookies.

---

### NEXT-SESS-002: Sessions MUST be bounded and resistant to fixation/replay

Severity: Low

Required:

* SHOULD set bounded session lifetimes appropriate to the app.
* SHOULD rotate session identifiers on login and privilege changes.
* MUST NOT store sensitive secrets directly in client-readable storage (including cookies that are not encrypted).

Insecure patterns:

* Long-lived admin sessions with no rotation.
* “Remember me forever” for privileged roles without additional risk controls.
* Storing access tokens/refresh tokens in non-HttpOnly cookies or localStorage.

Detection hints:

* Review auth library configuration for expiration and rotation.
* Search for `localStorage.setItem('token'...)` and non-HttpOnly cookie usage.

Fix:

* Use short lifetimes for privileged sessions; refresh with rotation.
* Store only opaque session IDs in cookies; keep sensitive material server-side.

---

### NEXT-INPUT-001: Runtime input validation is mandatory (TypeScript is not validation)

Severity: High

Required:

* MUST validate and normalize all attacker-controlled input at runtime (schemas, type checks, bounds).
* Next.js API Routes explicitly note `req.body` is `any` and must be validated before use. ([Next.js][3])
* MUST validate Server Action arguments (treat as hostile). ([Next.js][6])

Insecure patterns:

* Trusting `req.body` shape directly.
* Passing `params.id`/`searchParams` directly into DB queries or file paths.
* Parsing JSON and then assuming types without validation.

Detection hints:

* Identify endpoints that accept JSON/form input and check for schema validation.
* Grep for `req.body.` usage and for `await request.json()` usage in Route Handlers; verify validation exists.

Fix:

* Add schema validation (e.g., zod/yup/valibot) and reject invalid input with 4xx.
* Validate IDs as strict types (UUID/int) and enforce length/charset constraints.

---

### NEXT-HEADERS-001: Essential security headers MUST be set (in app or at the edge)

Severity: Low

Required (typical web app):

* SHOULD set:

  * CSP (`Content-Security-Policy`) (see NEXT-CSP-001)
  * `X-Content-Type-Options: nosniff`
  * Clickjacking defense (`frame-ancestors` in CSP and/or `X-Frame-Options`)
  * `Referrer-Policy` and `Permissions-Policy` when appropriate
* MUST ensure cookies are set with secure attributes (see NEXT-SESS-001). ([Next.js][9])

Insecure patterns:

* No security headers anywhere (app or edge).
* Allowing iframing unintentionally.
* `Content-Type` sniffing possible due to missing `nosniff`.

Detection hints:

* Check `proxy.ts` / middleware for `response.headers.set(...)`. ([Next.js][7])
* If not visible in app code, flag as “verify at edge/CDN”.

Fix:

* Set headers centrally (Proxy/Middleware or other centralized mechanism).
* Ensure consistent headers across routes.

---

### NEXT-CSP-001: Use a CSP to reduce XSS impact; prefer nonces for scripts

Severity: Medium

NOTE: It is most important to set the CSP's script-src. All other directives are not as important and can generally be excluded for the ease of development.

Required:

* SHOULD deploy a CSP, ideally with nonces for scripts.
* SHOULD follow Next.js guidance for CSP implementation (including nonce generation and header application). ([Next.js][7])
* MUST avoid loosening CSP as a “fix” (e.g., `script-src 'unsafe-inline'`) without explicit risk acceptance.

Insecure patterns:

* CSP missing on apps that display user-generated HTML/markdown.
* CSP that broadly enables inline scripts or eval without strict justification.

Detection hints:

* Search for `Content-Security-Policy` header setting and examine its directives.
* Check use of `next/script` and whether a nonce is provided when CSP requires it.

Fix:

* Implement CSP per Next.js guidance; use a nonce and apply it consistently.
* Reduce inline scripts; avoid `eval`.

Notes:

* CSP is defense-in-depth; it does not replace proper output encoding and sanitization.

---

### NEXT-XSS-001: Prevent reflected/stored XSS in React/Next rendering

Severity: High

Required:

* MUST rely on React’s default escaping; MUST NOT insert untrusted HTML into the DOM without sanitization.
* MUST treat these as high-risk sinks:

  * `dangerouslySetInnerHTML`
  * rendering user-controlled strings into `<script>` tags or event handler attributes
* MUST avoid serving uploaded HTML as active HTML (serve as attachment or sanitize/transform).

Insecure patterns:

* `<div dangerouslySetInnerHTML={{ __html: userContent }} />` with no sanitizer.
* Markdown renderers configured to allow raw HTML with no sanitizer.
* Returning user content with `Content-Type: text/html` from a Route Handler.

Detection hints:

* Search for `dangerouslySetInnerHTML`, `__html:`.
* Search for template-like string concatenation that builds HTML.
* Review any “render HTML” or “preview” features.

Fix:

* Sanitize untrusted HTML with a well-maintained sanitizer; prefer strict allowlists.
* Prefer rendering user content as text, not HTML.
* Add CSP to reduce impact.

---

### NEXT-ACTION-001: Server Actions MUST be treated like public endpoints

Severity: High (Critical for privileged actions)

Required:

* MUST apply the same controls as for Route Handlers:

  * authn/authz
  * input validation
  * CSRF/origin protections
  * rate limiting for sensitive actions
* MUST NOT assume Server Actions are “not reachable” or “internal”.
* MUST understand Server Action request protections:

  * Next.js compares Origin with host to mitigate CSRF; extra origins must be explicitly allowlisted via `allowedOrigins`. ([Next.js][5])

Insecure patterns:

* `"use server"` functions that update DB state with no auth check.
* Adding overly broad `allowedOrigins` to “make it work”.

Detection hints:

* Grep for `"use server"` and inventory all exported actions.
* Identify any action doing privileged writes; confirm it checks identity and permission.

Fix:

* Wrap actions with an authz helper (fail closed).
* Keep `allowedOrigins` minimal and audited.

---

### NEXT-ACTION-002: Do not accidentally leak secrets through Server Action closure/binding patterns

Severity: Medium (High if important secrets are exposed)

Required:

* MUST treat Server Action closed-over values as sensitive and design intentionally.
* Next.js notes that closed-over values are encrypted/signed, but values passed through `.bind` are not encrypted; do not rely on `.bind` to protect secrets. ([Next.js][6])
* If using a stable encryption key for Server Actions across deployments, MUST treat it as a secret and store securely (do not commit/log it). ([Next.js][6])

Insecure patterns:

* `myAction.bind(null, process.env.SECRET)` or binding sensitive tokens/IDs that should not be client-influenced.
* Logging action arguments that include secrets.

Detection hints:

* Search for `.bind(` on Server Action functions.
* Search for `process.env` usage near Server Actions.

Fix:

* Avoid binding secrets into actions; fetch secrets server-side inside the action.
* Keep action arguments minimal and validated.

---

### NEXT-CACHE-001: Prevent data leaks via static rendering and shared caching

Severity: High (Critical if cross-user data leak)

Required:

* MUST ensure pages/endpoints that return user-specific or sensitive data are not statically generated or cached in a shared way.
* Route Handlers are not cached by default, but GET handlers can opt into caching/static behavior; do not do this for per-user data. ([Next.js][1])
* MUST treat `use cache` and similar caching mechanisms as potentially cross-user unless explicitly proven private; do not cache per-user DB results in shared caches. ([Next.js][1])
* SHOULD set explicit `Cache-Control: no-store` / `private` for sensitive responses (auth/session/user data APIs).

Insecure patterns:

* `export const dynamic = 'force-static'` on a route that returns user-specific data. ([Next.js][1])
* Using `use cache` around a function that queries user-specific data without a per-user cache key. ([Next.js][1])
* Returning auth/session responses from GET endpoints with caching enabled.

Detection hints:

* Search for `dynamic = 'force-static'`, `revalidate`, `use cache`, `cacheLife`, `unstable_cache`.
* Inspect all GET Route Handlers that are cached/static and confirm they only return public data.
* Confirm that use of `cookies()`/`headers()` (dynamic APIs) is not accidentally removed in ways that make a route static. ([Next.js][1])

Fix:

* Mark sensitive routes as dynamic and set `Cache-Control: no-store`.
* Ensure caching keys include user identity if caching is truly needed (and store it in a user-private cache).

---

### NEXT-FILES-001: User uploads MUST be validated, stored safely, and served safely

Severity: Medium

Required:

* MUST enforce upload size limits at the edge and in application logic.
* MUST validate file type using allowlists and content checks (not only extension).
* MUST store uploads outside the `public/` directory (anything under `public/` is served as static content by default).
* MUST serve potentially active formats safely (`Content-Disposition: attachment`) unless explicitly intended.

Insecure patterns:

* Accepting arbitrary file types and serving them back inline.
* Using user-supplied filename as the storage path.
* Writing uploads into `public/uploads/` and serving them directly.

Detection hints:

* Search for `formData()` / multipart parsing, `fs.writeFile`, storage SDK usage.
* Look for any write path under `public/`.
* Look for “download” endpoints that set `Content-Type: text/html` or serve user files inline.

Fix:

* Use a dedicated object store (S3/GCS) or a safe server-side directory outside static roots.
* Generate random server-side filenames; store metadata separately.

---

### NEXT-PATH-001: Prevent path traversal and unsafe file access

Severity: High

Required:

* MUST NOT use user-controlled strings as filesystem paths.
* MUST validate and normalize identifiers; use allowlists and safe base directories.
* MUST avoid reading arbitrary files based on request parameters.

Insecure patterns:

* `fs.readFile(request.nextUrl.searchParams.get('path'))`
* `path.join(base, userPath)` without normalization + boundary checks

Detection hints:

* Search for `fs.` usage in Route Handlers/API Routes.
* Search for `path.join`/`path.resolve` fed by request params.

Fix:

* Use opaque IDs that map to server-side stored paths.
* Enforce that resolved paths remain within an intended base directory.
* Sanitize and disallow `..` from being used when creating urls

---

### NEXT-SSRF-001: Outbound requests using user-influenced URLs MUST be restricted

Severity: Medium (High in internal networks)

NOTE: This is mostly only applicable to apps which will be deployed in a cloud/LAN setup or have other http services on the same box. Sometimes the feature requires this functionality unavoidably (webhooks).

Required:

* MUST treat any server-side `fetch()` to a user-provided URL as high-risk.
* SHOULD allowlist destinations (hosts/domains) for URL fetch features.
* SHOULD block:

  * localhost / private IP ranges / link-local
  * cloud metadata endpoints
* MUST restrict protocols to `http:` and `https:`.
* SHOULD set strict timeouts and restrict redirects.

Insecure patterns:

* `await fetch(req.query.url)` or `await fetch((await request.json()).url)`
* “URL preview” endpoints that fetch arbitrary URLs.

Detection hints:

* Search for `fetch(` in server code and trace where the URL comes from.
* Look for “webhook tester”, “preview”, “import from URL” features.

Fix:

* Parse URL, enforce `http/https`, allowlist hostnames, re-resolve DNS/IP to block private ranges.
* Set timeouts (AbortSignal) and limit redirects.

---

### NEXT-REDIRECT-001: Prevent open redirects (including auth flows)

Severity: Low

Required:

* MUST validate redirect targets derived from untrusted input (e.g., `next`, `redirect`, `returnTo`).
* SHOULD prefer redirecting only to same-site relative paths.
* MUST validate any absolute URL against an allowlist.
* MUST ensure urls are `http` or `https:` schema, disallowing `javascript:` schema

Insecure patterns:

* `redirect(searchParams.get('next')!)`
* `NextResponse.redirect(new URL(req.nextUrl.searchParams.get('to')!, req.url))` without checks

Detection hints:

* Search for `redirect(` (server components/actions) and `NextResponse.redirect`.
* Search for `res.redirect(` in API Routes. ([Next.js][3])

Fix:

* Only allow relative paths (`/path`) and reject protocol-relative (`//evil.com`) or absolute URLs.
* If invalid, fall back to a safe default (home/dashboard).

---

### NEXT-CORS-001: CORS must be explicit and least-privilege

Severity: Medium (High if misconfigured with credentials)

Required:

* If CORS is not needed, MUST keep it disabled.
* Next.js API Routes do not set CORS headers by default, meaning they are same-origin by default; only enable CORS when you truly need it. ([Next.js][3])
* If enabling CORS:

  * MUST allowlist trusted origins (no reflection of arbitrary Origin)
  * MUST be careful with credentialed requests (cookies); never combine broad origins with credentials.
  * SHOULD restrict methods and headers.

Insecure patterns:

* `Access-Control-Allow-Origin: *` with `Access-Control-Allow-Credentials: true`
* Reflecting `Origin` without validation.

Detection hints:

* Search for `Access-Control-Allow-Origin`, `cors`, “CORS” middleware/wrappers.
* Review preflight `OPTIONS` handlers.

Fix:

* Implement strict origin allowlist and minimal methods/headers.
* Ensure cookies aren’t exposed cross-origin unless necessary and reviewed.

---

### NEXT-WEBHOOK-001: Webhook endpoints MUST verify authenticity using the raw body

Severity: Medium

Required:

* MUST verify webhook signatures using the **raw request body** (not a re-serialized parsed object).
* Next.js notes a use case for disabling body parsing is verifying the raw body of a webhook request. ([Next.js][3])

Insecure patterns:

* Verifying webhook signatures over `JSON.stringify(req.body)` (can change formatting).
* Accepting webhooks with no signature verification and no allowlist.

Detection hints:

* Find webhook endpoints (`/api/webhook`, `/app/api/**/webhook`).
* Check whether they use raw body verification.

Fix:

* Disable Next.js automatic body parsing only for those webhook routes, read raw bytes safely, verify signature, then parse.

---

### NEXT-INJECT-001: Prevent SQL injection (use parameterized queries / ORM)

Severity: High

Required:

* MUST use parameterized queries or an ORM that parameterizes under the hood.
* MUST NOT build SQL by string concatenation / template strings with untrusted input.

Insecure patterns:

* ``db.query(`SELECT * FROM users WHERE id = ${id}`)``
* `"WHERE name = '" + user + "'"`

Detection hints:

* Grep for `SELECT`, `INSERT`, `UPDATE`, `DELETE` strings.
* Trace untrusted input (`params`, `searchParams`, `req.query`, `req.body`, `request.json()`) into DB calls.

Fix:

* Use prepared statements / ORM query APIs.
* Validate and coerce types before querying.

---

### NEXT-INJECT-002: Prevent OS command injection and unsafe subprocess use

Severity: Critical to High

Required:

* MUST avoid executing OS commands with attacker-controlled input.
* If subprocess is necessary:

  * MUST pass args as an array (not a single shell string)
  * MUST NOT use `shell: true` with attacker-influenced strings
  * SHOULD use strict allowlists for any variable component

Insecure patterns:

* `exec("convert " + filename)`
* `spawn("bash", ["-c", userInput])`
* `spawn(userInput, ["foo"])`

Detection hints:

* Search for `child_process`, `exec`, `spawn`, `shell: true`.

Fix:

* Use library APIs instead of shell commands.
* Hard-code commands and allowlist validated parameters (and use `--` to separate flags where supported).

---

### NEXT-INJECT-003: Avoid dynamic code execution and unsafe deserialization

Severity: High to Critical

Required:

* MUST NOT use `eval`, `new Function`, `vm.runIn*` on untrusted strings.
* MUST treat deserializing complex formats (YAML, XML, custom serialization) as risky; use safe parsers and strict schemas.

Insecure patterns:

* `eval(req.body.code)`
* Parsing YAML from user input with a non-safe schema.

Detection hints:

* Search for `eval(`, `new Function`, `vm.`, `require(` with non-literals.
* Search for `js-yaml`, XML parsers, custom serializer usage on untrusted input.

Fix:

* Remove dynamic execution; use safe interpreters or strict parsers.
* Validate and constrain input.

---

### NEXT-LOG-001: Logging MUST NOT leak secrets or sensitive headers

Severity: Medium

Required:

* MUST NOT log:

  * `Authorization` headers
  * cookies / session tokens
  * request bodies containing credentials
  * environment variables or configuration dumps
* SHOULD implement structured logging with redaction.

Insecure patterns:

* `console.log(req.headers)` in auth endpoints
* `console.log(process.env)` in server code

Detection hints:

* Search for `console.log(`, `logger.info(`, `debug(` in server routes/actions.
* Check for logs of headers/cookies/body.

Fix:

* Redact sensitive fields; log only what is needed for debugging.
* Use safe error messages for clients; keep detail server-side only.

---

### NEXT-ERROR-001: Error handling MUST avoid leaking implementation details in production

Severity: Low

Required:

* MUST not expose stack traces or internal error details to end users in production.
* Ensure production mode behavior (Next.js production error handling differs from dev). ([Next.js][6])

Insecure patterns:

* Returning `err.stack` in JSON responses.
* Showing detailed exception data to unauthenticated users.

Detection hints:

* Search for `res.status(500).json(err)` or `return Response.json(err)`.
* Verify error responses are sanitized.

Fix:

* Return generic error messages to clients; log details server-side with redaction.

---

### NEXT-PROXY-001: Proxy/Middleware must not introduce header smuggling or unsafe header forwarding

Severity: Medium

Required:

* MUST be careful when copying/forwarding request headers upstream:

  * Do not forward attacker-controlled `x-forwarded-*` headers unless you have a trusted proxy chain.
  * Do not forward `Authorization`/cookies to unrelated outbound services.
* Next.js Proxy patterns often mutate headers; ensure this doesn’t create security issues.

Insecure patterns:

* Blindly cloning all request headers to an outbound `fetch()` call.
* Trusting `x-forwarded-host` or `host` to construct sensitive absolute URLs without allowlisting.

Detection hints:

* Search `headers()` and `request.headers` usage (especially for URL building). ([Next.js][4])
* Search Proxy/Middleware for header rewrites.

Fix:

* Allowlist forwarded headers explicitly.
* Validate hostnames before using them to build callback URLs or redirects.

---

### NEXT-HOST-001: Host/Origin-derived URL construction MUST be allowlisted

Severity: Medium

Required:

* MUST NOT generate security-sensitive absolute URLs (password reset links, OAuth callback URLs, email verification links) directly from unvalidated `Host` headers.
* For Server Actions, Origin/Host matching is part of CSRF mitigation; do not weaken it. ([Next.js][5])

Insecure patterns:

* `const base = "https://" + request.headers.get("host")`
* Using unvalidated `x-forwarded-host` for absolute URL generation.

Detection hints:

* Grep for `.get('host')`, `.get('x-forwarded-host')`, and absolute URL building.
* Review auth-related email link generation code.

Fix:

* Use a configured, allowlisted canonical app origin (e.g., `APP_ORIGIN=https://example.com`).
* Allowlist hostnames; fail closed.

---

### NEXT-DOS-001: Rate limiting and resource controls MUST exist for abuse-prone endpoints

Severity: Medium

Required:

* SHOULD implement rate limiting/throttling for:

  * login, password reset, signup
  * expensive Server Actions
  * webhook ingestion
* MUST implement request size limits (see NEXT-LIMITS-001).
* If self-hosting, MUST rely on reverse proxy for additional protections. ([Next.js][8])

Insecure patterns:

* No throttling on login/reset endpoints.
* Expensive actions callable without auth or with unlimited frequency.

Detection hints:

* Identify auth endpoints and check for rate limiting.
* Search for “send email”, “charge”, “generate report” flows.

Fix:

* Add edge rate limiting and app-level user/IP throttles.
* Add job queues for heavy work; return 202 when appropriate.

---

## 5) Practical scanning heuristics (how to “hunt”)

When actively scanning, use these high-signal patterns:

* Production misconfig:

  * `next dev`, `NODE_ENV=development`, dev-only start commands ([Next.js][7])
* Secrets exposure:

  * `.env` committed, `NEXT_PUBLIC_` on sensitive variables ([Next.js][7])
  * `process.env` used in `"use client"` modules
* Auth coverage:

  * `app/**/route.ts` or `pages/api/**` with no auth checks ([Next.js][1])
  * `"use server"` actions with DB writes and no authz ([Next.js][6])
  * `proxy.ts` / `middleware.ts` matchers that exclude sensitive routes ([Next.js][12])
* CSRF:

  * cookie-auth POST/PUT/PATCH/DELETE with no token/origin checks
  * `serverActions.allowedOrigins` too broad ([Next.js][5])
* XSS:

  * `dangerouslySetInnerHTML`, raw HTML markdown rendering
  * missing CSP / overly permissive CSP ([Next.js][7])
* Caching/data leak:

  * `dynamic = 'force-static'` on sensitive GET handlers ([Next.js][1])
  * `use cache`, `cacheLife`, `unstable_cache` around user-specific data ([Next.js][1])
* Files:

  * writing uploads under `public/`
  * `fs.readFile` / `path.join` with request input
* SSRF:

  * `fetch(userProvidedUrl)` from Route Handlers / Server Actions
* Redirect:

  * `redirect(searchParams.get('next'))`, `NextResponse.redirect(...)`, `res.redirect(req.query.next)` ([Next.js][3])
* CORS:

  * wildcard origins, origin reflection, credentials + broad origins ([Next.js][3])
* Limits:

  * API routes with `bodyParser: false` and no raw-body verification for webhooks ([Next.js][3])
  * `serverActions.bodySizeLimit` raised without justification ([Next.js][5])
* Dependency hygiene:

  * old `next` versions that conflict with support policy/advisories ([Next.js][10])

Always try to confirm:

* data origin (untrusted vs trusted)
* sink type (HTML/DOM, SQL, subprocess, files, redirect, outbound HTTP)
* protective controls present (schema validation, allowlists, middleware/proxy checks, authz helpers, edge protections)

---

## 6) Sources (accessed 2026-01-27)

Primary framework documentation (Next.js):

* Next.js Docs: Installation (system requirements / Node version) — `https://nextjs.org/docs/app/getting-started/installation`
* Next.js Docs: Route Handlers — `https://nextjs.org/docs/app/getting-started/route-handlers`
* Next.js Docs: API Routes (Pages Router) — `https://nextjs.org/docs/pages/building-your-application/routing/api-routes`
* Next.js Docs: Environment Variables — `https://nextjs.org/docs/pages/guides/environment-variables`
* Next.js Docs: Data Security — `https://nextjs.org/docs/app/guides/data-security`
* Next.js Docs: Content Security Policy — `https://nextjs.org/docs/app/guides/content-security-policy`
* Next.js Docs: Proxy — `https://nextjs.org/docs/app/getting-started/proxy`
* Next.js Docs: `serverActions.allowedOrigins` and `serverActions.bodySizeLimit` — `https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions`
* Next.js Docs: `cookies()` — `https://nextjs.org/docs/app/api-reference/functions/cookies`
* Next.js Docs: `headers()` — `https://nextjs.org/docs/app/api-reference/functions/headers`
* Next.js Docs: Self-hosting (reverse proxy guidance) — `https://nextjs.org/docs/pages/guides/self-hosting`
* Next.js Docs: Support policy (supported versions/LTS) — `https://nextjs.org/docs/support-policy`

Next.js security guidance & advisories:

* Next.js Blog: How to think about security in Next.js — `https://nextjs.org/blog/security-nextjs-server-components-actions`
* GitHub Security Advisory: Next.js DoS via Server Components / Server Actions (CVE-2026-23864) — `https://github.com/advisories/GHSA-fq29-rrrv-cq2m`
* Next.js Blog: Security update (example security advisory context) — `https://nextjs.org/blog/security-update`

General web security references (recommended baseline):

* OWASP Cheat Sheet Series (CSRF, Session Management, XSS Prevention, SSRF Prevention, File Upload, HTTP Headers) — `https://cheatsheetseries.owasp.org/`

[1]: https://nextjs.org/docs/app/getting-started/route-handlers "Getting Started: Route Handlers | Next.js"
[2]: https://nextjs.org/docs/app/getting-started/deploying?utm_source=chatgpt.com "Getting Started: Deploying"
[3]: https://nextjs.org/docs/pages/building-your-application/routing/api-routes "Routing: API Routes | Next.js"
[4]: https://nextjs.org/docs/app/api-reference/functions/headers "Functions: headers | Next.js"
[5]: https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions "next.config.js: serverActions | Next.js"
[6]: https://nextjs.org/blog/security-nextjs-server-components-actions "How to Think About Security in Next.js | Next.js"
[7]: https://nextjs.org/docs/pages/guides/environment-variables "Guides: Environment Variables | Next.js"
[8]: https://nextjs.org/docs/pages/guides/self-hosting?utm_source=chatgpt.com "Guides: Self-Hosting"
[9]: https://nextjs.org/docs/app/api-reference/functions/cookies "Functions: cookies | Next.js"
[10]: https://nextjs.org/blog/next-16?utm_source=chatgpt.com "Next.js 16"
[11]: https://github.com/vercel/next.js/security/advisories/GHSA-9g9p-9gw9-jx7f?utm_source=chatgpt.com "Denial of Service in Image Optimizer · Advisory"
[12]: https://nextjs.org/docs/pages/guides/authentication "Guides: Authentication | Next.js"
