# Go (Golang) Security Spec (Go 1.25.x, Standard Library, net/http)

This document is designed as a **security spec** that supports:
1) **Secure-by-default code generation** for new Go code.
2) **Security review / vulnerability hunting** in existing Go code (passive “notice issues while working” and active “scan the repo and report findings”).

It is intentionally written as a set of **normative requirements** (“MUST/SHOULD/MAY”) plus **audit rules** (what bad patterns look like, how to detect them, and how to fix/mitigate them).

--------------------------------------------------------------------

## 0) Safety, boundaries, and anti-abuse constraints (MUST FOLLOW)

- MUST NOT request, output, log, or commit secrets (API keys, passwords, private keys, session cookies, JWTs, database URLs with credentials, signing keys, client secrets).
- MUST NOT “fix” security by disabling protections (e.g., `InsecureSkipVerify`, `GOSUMDB=off` for public modules, wildcard CORS + credentials, removing auth checks, disabling CSRF defenses on cookie-auth apps).
- MUST provide **evidence-based findings** during audits: cite file paths, code snippets, build/deploy configs, and concrete values that justify the claim.
- MUST treat uncertainty honestly: if a control might exist in infrastructure (reverse proxy, WAF, service mesh, platform config), report it as “not visible in app code; verify at runtime/config.”
- MUST keep fixes minimal, correct, and production-safe; avoid introducing breaking changes without warning (especially around auth/session flows, and proxies).

--------------------------------------------------------------------

## 1) Operating modes

### 1.1 Generation mode (default)
When asked to write new Go code or modify existing code:
- MUST follow every **MUST** requirement in this spec.
- SHOULD follow every **SHOULD** requirement unless the user explicitly says otherwise.
- MUST prefer safe-by-default APIs and proven libraries over custom security code.
- MUST avoid introducing new risky sinks (shell execution, dynamic template execution, serving user files as HTML, unsafe redirects, weak crypto, unbounded parsing, etc.).

### 1.2 Passive review mode (always on while editing)
While working anywhere in a Go repo (even if the user did not ask for a security scan):
- MUST “notice” violations of this spec in touched/nearby code.
- SHOULD mention issues as they come up, with a brief explanation + safe fix.

### 1.3 Active audit mode (explicit scan request)
When the user asks to “scan”, “audit”, or “hunt for vulns”:
- MUST systematically search the codebase for violations of this spec.
- MUST output findings in a structured format (see §2.3).

Recommended audit order:
1) Build/deploy entrypoints: `main.go`, `cmd/*`, Dockerfiles, Kubernetes manifests, systemd units, CI workflows.
2) Go toolchain & dependency policy: Go version, modules, `go.mod/go.sum`, proxy/sumdb settings, govulncheck usage.
3) Secret management and config loading (env, files, secret stores) + logging patterns.
4) HTTP server configuration (timeouts, body limits, proxy trust, security headers).
5) AuthN/AuthZ boundaries, session/cookie settings, token validation.
6) CSRF protections for cookie-authenticated state-changing endpoints.
7) Template usage and output encoding (XSS), and any “render template from string” behavior (SSTI).
8) File handling (uploads/downloads/path traversal/temp files), static file serving.
9) Injection sinks: SQL, OS command execution, SSRF/outbound fetch, open redirects.
10) Concurrency/resource exhaustion (unbounded goroutines/queues, missing timeouts/contexts).
11) Use of `unsafe` / `cgo` / `reflect` in security-sensitive paths.
12) Debug/diagnostic endpoints (pprof/expvar/metrics) exposure.
13) Cryptography usage (randomness, password hashing).

--------------------------------------------------------------------

## 2) Definitions and review guidance

### 2.1 Untrusted input (treat as attacker-controlled unless proven otherwise)
Examples include:
- `*http.Request` fields: `r.URL.Path`, `r.URL.RawQuery`, `r.Form`, `r.PostForm`, headers, cookies, `r.Body`
- Path parameters from routers (including values extracted from URL paths)
- JSON/XML/YAML bodies, multipart form parts, uploaded files
- Any data from external systems (webhooks, third-party APIs, message queues)
- Any persisted user content (DB rows) that originated from users
- Configuration values that might be attacker-influenced in some deployments (headers set by upstream proxies, environment variables in multi-tenant systems)

### 2.2 State-changing request
A request is state-changing if it can create/update/delete data, change auth/session state, trigger side effects (purchase, email send, webhook send), or initiate privileged actions.

### 2.3 Required audit finding format
For each issue found, output:

- Rule ID:
- Severity: Critical / High / Medium / Low
- Location: file path + function/handler name + line(s)
- Evidence: the exact code/config snippet
- Impact: what could go wrong, who can exploit it
- Fix: safe change (prefer minimal diff)
- Mitigation: defense-in-depth if immediate fix is hard
- False positive notes: what to verify if uncertain (edge configs, proxy behavior, auth assumptions)

--------------------------------------------------------------------

## 3) Secure baseline: minimum production configuration (MUST in production)

This is the smallest “production baseline” that prevents common Go misconfigurations.

### 3.1 Toolchain, patching, and dependency hygiene (MUST)
- MUST run a supported Go major version and keep to the latest patch releases.
- MUST treat Go standard library patch releases as security-relevant (many security fixes land in stdlib components like `net/http`, `crypto/*`, parsing packages).
- MUST use Go modules with committed `go.mod` and `go.sum`.
- MUST NOT disable module authenticity mechanisms for public modules (checksum DB) unless you have a controlled, documented replacement.
- MUST run `govulncheck` (source scan and/or binary scan) in CI and address findings.

### 3.2 HTTP server baseline (MUST for network-facing services)
If the program serves HTTP (directly or via a framework built on `net/http`):
- MUST configure an `http.Server` with explicit timeouts and header limits.
- MUST set request body size limits (global and per-route as needed).
- MUST avoid exposing diagnostic endpoints (pprof/expvar) publicly.
- SHOULD set a consistent set of security headers (or verify they are set at the edge).
- MUST set cookie security attributes for any cookies you issue.
- SHOULD implement rate limiting and abuse controls for auth and expensive endpoints.

Illustrative baseline skeleton (adjust to your project):
- Create a dedicated mux (avoid implicit global defaults unless intentionally managed).
- Wrap handlers with: panic-safe error handling, request ID, logging, auth, and limits.

--------------------------------------------------------------------

## 4) Rules (generation + audit)

Each rule contains: required practice, insecure patterns, detection hints, and remediation.

### GO-DEPLOY-001: Keep the Go toolchain and standard library updated (security releases)
Severity: Medium

NOTE: Upgrading dependencies and the core Go version can break projects in unexpected ways. Focus on only security-critical dependencies and if noticed, let the user know rather than upgrading automatically.

Required:
- MUST run a supported Go major release and apply patch releases promptly.
- SHOULD treat patch releases as security-relevant, even if your application code didn’t change.

Insecure patterns:
- Production builds pinned to old Go versions without a patching process.
- Docker images like `golang:1.xx` or custom base images that are not updated regularly.
- CI pipelines that intentionally suppress Go updates.

Detection hints:
- Inspect CI (`.github/workflows`, `gitlab-ci.yml`, etc.) for `go-version:` or toolchain setup.
- Inspect Dockerfiles for `FROM golang:` tags.
- Inspect `go.mod` `go` directive and any toolchain pinning.

Fix:
- Upgrade to the latest patch of a supported Go version.
- Add an automated check (CI) that fails when Go is below an approved minimum.

Notes:
- Go publishes regular minor releases that frequently include security fixes across standard library packages.

---

### GO-SUPPLY-001: Go module authenticity MUST NOT be disabled for public dependencies
Severity: High

Required:
- MUST keep module checksum verification enabled for public modules.
- SHOULD commit `go.sum` and treat changes as security-sensitive.
- MUST NOT use insecure module fetching settings for public modules.
- MAY configure private module behavior using `GOPRIVATE`/`GONOSUMDB` for private repos, but must do so narrowly and intentionally.

Insecure patterns:
- `GOSUMDB=off` in CI or production build environments for public modules.
- `GONOSUMDB=*` or overly broad patterns that effectively disable verification.
- `GOINSECURE=*` or broad `GOINSECURE` patterns for public modules.
- `GOPROXY=direct` everywhere without a clear policy.

Detection hints:
- Search build configs for `GOSUMDB`, `GONOSUMDB`, `GOINSECURE`, `GOPROXY`, `GOPRIVATE`.
- Look for documentation/scripts that recommend disabling checksum DB “to make builds work”.

Fix:
- Restore defaults for public module verification.
- For private modules:
  - Set `GOPRIVATE=your.private.domain/*`
  - Configure an internal proxy or direct fetching, and restrict `GONOSUMDB` to private patterns only.

Notes:
- Disabling checksum verification removes an important integrity layer against targeted or compromised upstream delivery.

---

### GO-CONFIG-001: Secrets must be externalized and never logged or committed
Severity: High (Critical if credentials are committed)

Required:
- MUST load secrets from environment variables, secret managers, or secure config files with restricted permissions.
- MUST NOT hard-code secrets in Go source, test fixtures that may reach production, or build args.
- MUST NOT log secrets or full credential-bearing connection strings.
- SHOULD fail closed in production if required secrets are missing.

Insecure patterns:
- String constants containing tokens/keys/passwords.
- `.env` files or config files with secrets committed to repo.
- Logging `os.Environ()`, dumping full configs, or printing DSNs.

Detection hints:
- Search for suspicious literals (`API_KEY`, `SECRET`, `PASSWORD`, `Authorization:`).
- Inspect config loaders and logging statements.
- Inspect CI logs or debug print paths.

Fix:
- Move secrets to a secret store / environment variables.
- Redact sensitive fields in logs.
- Add secret scanning to CI and pre-commit.

---

### GO-HTTP-001: HTTP servers MUST set timeouts and MaxHeaderBytes
Severity: High (DoS risk)

Required:
- MUST set: `ReadHeaderTimeout`, and SHOULD set `ReadTimeout`, `WriteTimeout`, `IdleTimeout` as appropriate for the service.
- MUST set `MaxHeaderBytes` to a justified limit for your application.
- MUST NOT rely on default zero-values for timeouts in production for internet-facing servers.

Insecure patterns:
- `http.ListenAndServe(":8080", handler)` with a default `http.Server` (no explicit timeouts).
- `&http.Server{}` with timeouts left at zero.
- Missing `MaxHeaderBytes`.

Detection hints:
- Search for `http.ListenAndServe(`, `ListenAndServeTLS(`, `Server{` and inspect configured fields.
- Check for reverse proxies; even with a proxy, app-level timeouts still matter.

Fix:
- Use `http.Server{ReadHeaderTimeout: ..., ReadTimeout: ..., WriteTimeout: ..., IdleTimeout: ..., MaxHeaderBytes: ...}`.
- Calibrate timeouts per endpoint type (streaming vs JSON APIs).

Notes:
- Net/http documents that these timeouts exist and that zero/negative values mean “no timeout”; production services should choose explicit values.

---

### GO-HTTP-002: Request body and multipart parsing MUST be size-bounded
Severity: Medium (DoS risk; can be High for upload-heavy apps)

Required:
- MUST enforce a global maximum request body size for endpoints that accept bodies.
- MUST enforce strict multipart upload limits and avoid unbounded form parsing.
- SHOULD enforce per-route limits when some endpoints legitimately need larger bodies.
- SHOULD set upstream (proxy) limits as defense-in-depth.

Insecure patterns:
- Reading `r.Body` with `io.ReadAll(r.Body)` without a size cap.
- Calling `r.ParseMultipartForm(...)` with overly large limits (or forgetting size controls).
- Accepting file uploads with no limits on file size, number of parts, or total body size.

Detection hints:
- Search for `io.ReadAll(r.Body)`, `json.NewDecoder(r.Body)`, `ParseMultipartForm`, `FormFile`, `multipart`.
- Look for missing `http.MaxBytesReader` or equivalent per-handler limiting.
- Look for “upload” endpoints and check limits.

Fix:
- Wrap request bodies with `http.MaxBytesReader(w, r.Body, maxBytes)` before parsing.
- For multipart, set conservative limits and validate file sizes/part counts explicitly.
- Set proxy limits (e.g., at ingress) in addition to app limits.

Notes:
- There are known vulnerability classes and advisories related to excessive resource consumption in multipart/form parsing; treat unbounded parsing as a security issue.

---

### GO-DEPLOY-002: Diagnostic endpoints (pprof/expvar/metrics) MUST NOT be publicly exposed
Severity: High

NOTE: This only applies to production configurations. These endpoints are often used for debug or dev endpoints. If found, confirm that it would be reachable from the actual production deployment.

Required:
- MUST NOT expose `net/http/pprof` handlers on a public internet-facing listener without strong access controls.
- SHOULD run diagnostics on a separate, internal-only listener (loopback/VPC-only) and require auth.
- MUST review what diagnostic endpoints reveal (stack traces, memory, command lines, environment, internal URLs).

Insecure patterns:
- Side-effect import `import _ "net/http/pprof"` in a server binary with a public mux.
- `/debug/pprof/*` reachable without auth.
- `/debug/vars` (expvar) reachable without auth.

Detection hints:
- Search for `net/http/pprof` imports (including blank imports).
- Search for route prefixes `/debug/pprof`, `/debug/vars`.
- Check whether `http.DefaultServeMux` is used and whether any debug handlers register globally.

Fix:
- Remove diagnostics from production builds, or bind them to an internal-only listener.
- Add strong authentication/authorization (and ideally network-level restrictions).

Notes:
- pprof is typically imported for its side effect of registering HTTP handlers under `/debug/pprof/`.

---

### GO-HTTP-003: Reverse proxy and forwarded header trust MUST be explicit
Severity: High (auth, URL generation, logging/auditing correctness)

Required:
- If behind a reverse proxy, MUST define which proxy is trusted and how client IP/scheme/host are derived.
- MUST NOT trust `X-Forwarded-For`, `X-Forwarded-Proto`, `Forwarded`, or similar headers from the open internet.
- MUST ensure “secure cookie” logic, redirects, and absolute URL generation do not rely on spoofable headers.

Insecure patterns:
- Using `r.Header.Get("X-Forwarded-For")` as the client IP without validating the proxy boundary.
- Deriving “is HTTPS” from `X-Forwarded-Proto` without confirming it came from a trusted proxy.
- Using forwarded `Host` values for password reset links without allowlisting.

Detection hints:
- Search for `X-Forwarded-For`, `X-Forwarded-Proto`, `Forwarded`, `Real-IP`, and any custom “client IP” helpers.
- Inspect ingress/proxy configs; if not visible, mark as “verify at edge”.

Fix:
- Enforce proxy trust at the edge and in app:
  - Accept forwarded headers only from known proxy IP ranges.
  - Prefer platform-provided mechanisms where available.
- If generating external links, use a configured allowlisted canonical origin (not the request’s Host header).

---

### GO-HTTP-004: Security headers SHOULD be set (in app or at the edge)
Severity: Medium

Required (typical web app serving browsers):
- SHOULD set:
  - `Content-Security-Policy` (CSP) appropriate to the app. NOTE: It is most important to set the CSP's script-src. All other directives are not as important and can generally be excluded for the ease of development.
  - `X-Content-Type-Options: nosniff`
  - Clickjacking protection (`X-Frame-Options` and/or CSP `frame-ancestors`)
  - `Referrer-Policy` and `Permissions-Policy` where appropriate
- MUST ensure cookies have secure attributes (see GO-HTTP-005).

NOTE:
- These headers may be set via reverse proxy/CDN; if not visible in app code, report as “verify at edge”.

Insecure patterns:
- No security headers anywhere (app or edge) for a browser-facing app.
- CSP missing for apps rendering untrusted content.

Detection hints:
- Search for middleware setting headers: `w.Header().Set("Content-Security-Policy", ...)`, etc.
- Search for reverse proxy config that sets headers.

Fix:
- Add centralized header middleware in Go, or configure at the edge.
- Keep CSP realistic; avoid `unsafe-inline` where possible.

---

### GO-HTTP-005: Cookies MUST use secure attributes in production
Severity: Medium

Required (production, HTTPS):
- MUST set `Secure` on cookies that carry auth/session state. IMPORTANT NOTE: Only set `Secure` in production environment when TLS is configured. When running in a local dev environment over HTTP, do not set `Secure` property on cookies. You should do this conditionally based on if the app is running in production mode. You should also include a property like `SESSION_COOKIE_SECURE` which can be used to disable `Secure` cookies when testing over HTTP.
- MUST set `HttpOnly` on auth/session cookies.
- SHOULD set `SameSite=Lax` by default (or `Strict` if compatible), and only use `None` when necessary (and only with `Secure`).
- SHOULD set bounded lifetimes (`Max-Age`/`Expires`) appropriate to the app.

Insecure patterns:
- Setting auth/session cookies without `Secure` in HTTPS deployments.
- Cookies without `HttpOnly` for session identifiers.
- `SameSite=None` for cookie-authenticated apps without a strong CSRF strategy.

Detection hints:
- Search for `http.SetCookie`, `&http.Cookie{`, `Set-Cookie`.
- Inspect cookie flags in auth/session code.

Fix:
- Set the correct fields on `http.Cookie` and centralize cookie creation.

Notes:
- SameSite is defense-in-depth and does not replace CSRF protections for cookie-auth apps.

---

### GO-HTTP-006: Cookie-authenticated state-changing endpoints MUST be CSRF-protected
Severity: High

- IMPORTANT NOTE: If cookies are not used for auth (e.g., pure bearer token in Authorization header with no ambient cookies), CSRF is not a risk for those endpoints.

Required:
- MUST protect all state-changing endpoints (POST/PUT/PATCH/DELETE) that rely on cookies for authentication.
- SHOULD use a well-tested CSRF library/middleware rather than rolling your own.
- MAY use additional defenses (Origin/Referer checks, Fetch Metadata, SameSite cookies), but tokens remain the primary defense for cookie-authenticated apps.
If tokens are impractical, or for small applications:
* MUST at a minimum require a custom header to be set and set the session cookie SESSION_COOKIE_SAMESITE=lax, as this is the strongest method besides requiring a form token, and may be much easier to implement.


Insecure patterns:
- Cookie-authenticated JSON endpoints that mutate state with no CSRF checks.
- Using GET for state-changing actions.

Detection hints:
- Enumerate all non-GET routes and identify auth mechanism.
- Look for CSRF middleware usage; if absent, treat as suspicious in browser-facing apps.

Fix:
- Add CSRF middleware and ensure it covers all state-changing routes.
- If the service is an API intended for non-browser clients, avoid cookie auth; use Authorization headers.

---

### GO-HTTP-007: CORS must be explicit and least-privilege
Severity: Medium (High if misconfigured with credentials)

Required:
- If CORS is not needed, MUST keep it disabled.
- If CORS is needed:
  - MUST allowlist trusted origins (do not reflect arbitrary origins)
  - MUST be careful with credentialed requests; do not combine broad origins with cookies
  - SHOULD restrict allowed methods/headers

Insecure patterns:
- `Access-Control-Allow-Origin: *` paired with cookies (`Access-Control-Allow-Credentials: true`).
- Reflecting `Origin` without validation.

Detection hints:
- Search for `Access-Control-Allow-` header setting.
- Search for CORS middleware configuration.

Fix:
- Implement strict origin allowlists and minimal methods/headers.
- Ensure cookie-auth endpoints are not exposed cross-origin unless required.

---

### GO-XSS-001: Use html/template and avoid bypassing auto-escaping with untrusted data
Severity: High

Required:
- MUST use `html/template` for HTML rendering (not `text/template`).
- MUST NOT convert untrusted data into “trusted” template types (`template.HTML`, `template.JS`, `template.URL`, etc.).
- SHOULD keep templates static and controlled by developers; treat dynamic templates as high risk.
- MUST NOT serve user-uploaded HTML/JS as active content unless explicitly intended and safely sandboxed.

Insecure patterns:
- `text/template` used to generate HTML.
- Using `template.HTML(userInput)` or similar typed wrappers.
- Directly writing unescaped user content into HTML responses.

Detection hints:
- Search for `text/template`, `template.New(...).Parse(...)`, and typed wrappers like `template.HTML(`.
- Inspect handlers that return HTML with string concatenation.

Fix:
- Use `html/template` and pass untrusted data as data, not markup.
- If you must allow limited HTML, use a vetted HTML sanitizer and still be careful with attributes/URLs.

---

### GO-SSTI-001: Never parse/execute templates from untrusted input (SSTI)
Severity: Critical

Required:
- MUST NOT call `template.Parse` / `template.ParseFiles` / `template.New(...).Parse(...)` on template text influenced by untrusted input.
- MUST treat “user-defined templates” as a special high-risk design:
  - MUST use heavy sandboxing and strict allowlists
  - MUST isolate execution (process/container boundary) if truly required

Insecure patterns:
- `tmpl := template.Must(template.New("x").Parse(r.FormValue("tmpl")))`
- Reading templates from uploads / DB entries and executing them in the same trust domain as server code.

Detection hints:
- Search for `.Parse(` and trace the origin of the template string.
- Look for “custom email templates”, “user theming templates”, etc.

Fix:
- Replace with safe substitution mechanisms (no code execution).
- If templates must be user-controlled, isolate and sandbox aggressively.

---

### GO-PATH-001: Prevent path traversal and unsafe file serving
Severity: High

Required:
- MUST NOT pass user-controlled paths to `os.Open`, `os.ReadFile`, `http.ServeFile`, or `http.FileServer` without strict validation and base-dir enforcement.
- MUST treat `..`, absolute paths, and OS-specific path tricks as hostile input.
- SHOULD store user uploads outside any static web root; serve through controlled handlers.
- MUST avoid directory listing for sensitive file trees.

Insecure patterns:
- `http.ServeFile(w, r, r.URL.Query().Get("path"))`
- `os.Open(filepath.Join(baseDir, userPath))` without checking that the result stays under `baseDir`
- `http.FileServer(http.Dir("."))` serving the project root or user-writable directories

Detection hints:
- Search for `ServeFile(`, `FileServer(`, `http.Dir(`, `os.Open(`, `ReadFile(`, `filepath.Join(`.
- Trace whether path components come from request/DB.

Fix:
- Use an allowlist of file identifiers (e.g., database IDs) mapped to server-side paths.
- Enforce base directory containment after cleaning and joining.
- Serve active formats as downloads (`Content-Disposition: attachment`) unless explicitly intended.

---

### GO-UPLOAD-001: File uploads must be validated, stored safely, and served safely
Severity: High

Required:
- MUST enforce upload size limits (app + edge).
- MUST validate file type using allowlists and content checks (not only extensions).
- MUST store uploads outside executable/static roots when possible.
- SHOULD generate server-side filenames (random IDs) and avoid trusting original names.
- MUST serve potentially active formats safely (download attachment) unless explicitly intended.

Insecure patterns:
- Accepting arbitrary file types and serving them back inline.
- Using user-supplied filename as storage path.
- Missing size/type validation.

Detection hints:
- Search for `multipart`, `FormFile`, `ParseMultipartForm`, `io.Copy` to disk.
- Check where files are stored and how they are served.

Fix:
- Implement allowlist validation + safe storage + safe serving.
- Add scanning/quarantine workflows where applicable.

---

### GO-INJECT-001: Prevent SQL injection (parameterized queries / ORM)
Severity: High

Required:
- MUST use parameterized queries or an ORM that parameterizes under the hood.
- MUST NOT build SQL by string concatenation / `fmt.Sprintf` / string interpolation with untrusted input.

Insecure patterns:
- `fmt.Sprintf("SELECT ... WHERE id=%s", r.URL.Query().Get("id"))`
- `query := "UPDATE users SET role='" + role + "' WHERE id=" + id`

Detection hints:
- Grep for `SELECT`, `INSERT`, `UPDATE`, `DELETE` and check how query strings are built.
- Trace untrusted data into `db.Query`, `db.Exec`, `QueryRow`, etc.

Fix:
- Replace with placeholders (`?`, `$1`, etc.) and pass parameters separately.
- Validate and type-check IDs before use.

---

### GO-INJECT-002: Prevent OS command injection; avoid shelling out with untrusted input
Severity: Critical to High (depends on exposure)

Required:
- MUST avoid executing external commands with attacker-controlled strings.
- If subprocess is necessary:
  - MUST use `exec.CommandContext` with an argument list (not `sh -c`).
  - MUST NOT pass untrusted input to a shell (`bash -c`, `sh -c`, PowerShell).
  - SHOULD use strict allowlists for any variable component (subcommand, flags, filenames).
- MUST assume CLI tools may interpret attacker-controlled args as flags or special values.

Insecure patterns:
- `exec.Command("sh", "-c", userString)`
- `exec.Command("bash", "-c", fmt.Sprintf("tool %s", user))`
- Calling the shell to get glob expansion for user-supplied globs.

Detection hints:
- Search for `os/exec`, `exec.Command(`, `CommandContext(`, `"sh"`, `"bash"`, `"-c"`.
- Trace untrusted input into command name/args.

Fix:
- Use library APIs instead of subprocesses.
- Hardcode command and allowlist/validate args.
- If a shell is unavoidable, escape robustly and treat as high risk (prefer avoiding).

Notes:
- The Go `os/exec` package intentionally does invoke a shell; introducing `sh -c` reintroduces shell injection hazards.

---

### GO-SSRF-001: Prevent SSRF in outbound HTTP requests
Severity: Medium (High in cloud/LAN environments)

- Note: For small stand alone projects this is less important. It is most important when deploying into an LAN or with other services listening on the same server.

Required:
- MUST treat outbound requests to user-provided URLs as high risk.
- SHOULD allowlist hosts/domains for any user-influenced URL fetch.
- SHOULD block access to localhost/private IP ranges/link-local addresses and cloud metadata endpoints.
- MUST restrict schemes to `http`/`https` (no `file:`, `gopher:`, etc.).
- MUST set client timeouts and restrict redirects.

Insecure patterns:
- `http.Get(r.URL.Query().Get("url"))`
- “URL preview” / “webhook test” endpoints that fetch arbitrary URLs.

Detection hints:
- Search for `http.Get`, `client.Do`, and URL values derived from requests/DB.
- Identify features that fetch remote resources.

Fix:
- Parse URLs strictly; enforce scheme and allowlisted hostnames.
- Resolve DNS and enforce IP-range restrictions (with care for DNS rebinding).
- Set timeouts, disable redirects unless needed, and cap response sizes.

---

### GO-HTTPCLIENT-001: Outbound HTTP clients MUST set timeouts and close bodies
Severity: High (DoS and resource exhaustion)

Required:
- MUST set an overall timeout on `http.Client` usage (or equivalent per-request deadlines via context + transport timeouts).
- MUST ensure `resp.Body.Close()` is called for all successful requests (typically `defer resp.Body.Close()` immediately after error check).
- SHOULD limit response body reads (do not `io.ReadAll` unbounded responses).
- SHOULD restrict redirects for security-sensitive fetches (SSRF, auth flows).

Insecure patterns:
- Using `http.DefaultClient` / `http.Get` for user-influenced destinations with no timeout policy.
- Missing `defer resp.Body.Close()` leading to resource leaks.
- `io.ReadAll(resp.Body)` with no limit.

Detection hints:
- Search for `http.Get(`, `http.Post(`, `client := &http.Client{}` without `Timeout`, `client.Do(` and missing closes.
- Search for `io.ReadAll(resp.Body)`.

Fix:
- Use a configured client with timeouts.
- Always close response bodies.
- Use bounded readers (`io.LimitReader`) for large/untrusted responses.

Notes:
- The net/http package exposes `DefaultClient` as a zero-valued `http.Client`, which can easily lead to “no timeout” behavior unless configured.

---

### GO-REDIRECT-001: Prevent open redirects
Severity: Medium (can be High with auth flows)

Required:
- MUST validate redirect targets derived from untrusted input (`next`, `redirect`, `return_to`).
- SHOULD prefer only same-site relative paths.
- SHOULD fall back to a safe default on validation failure.

Insecure patterns:
- `http.Redirect(w, r, r.URL.Query().Get("next"), http.StatusFound)` with no validation.

Detection hints:
- Search for `http.Redirect(` and check origin of the location.

Fix:
- Allowlist internal paths or known domains.
- Reject absolute URLs unless explicitly needed and allowlisted.

---

### GO-CRYPTO-001: Cryptographic randomness MUST come from crypto/rand
Severity: High (Critical if used for auth/session tokens or keys)

Required:
- MUST use `crypto/rand` for:
  - session IDs, password reset tokens, API keys, CSRF tokens, nonces
  - encryption keys, signing keys, salts when required
- MUST NOT use `math/rand` for any security-sensitive value.
- SHOULD use built-in helpers that produce appropriately strong tokens when available.

Insecure patterns:
- `math/rand.Seed(time.Now().UnixNano())` followed by token generation for auth or sessions.
- Using UUIDv4-like constructs built from `math/rand`.

Detection hints:
- Search for `math/rand`, `rand.Seed`, `rand.Intn` in code that touches auth/session/token flows.
- Search for custom token generators.

Fix:
- Switch to `crypto/rand` (`rand.Reader`, `rand.Read`, or secure token helpers).
- Ensure sufficient entropy and use URL-safe encoding.

Notes:
- The crypto/rand package provides secure randomness APIs and token generation helpers.

---

### GO-AUTH-001: Password storage MUST use adaptive hashing (bcrypt/argon2id) and safe comparisons
Severity: High

Required:
- MUST hash passwords using an adaptive password hashing function (bcrypt or argon2id).
- MUST NOT store plaintext passwords or reversible encryption of passwords.
- MUST compare secrets in constant time when relevant (tokens, MACs, API keys) to reduce timing leaks.
- SHOULD ensure password policies do not exceed algorithm constraints (e.g., bcrypt has input length limits; handle long passphrases appropriately).

Insecure patterns:
- `sha256(password)` stored as password hash.
- Plaintext password storage.
- Comparing secrets with `==` in timing-sensitive contexts.

Detection hints:
- Search for `sha1`, `sha256`, `md5` used on passwords.
- Search for `bcrypt`/`argon2` usage; if absent, suspect.
- Search for `==` comparisons on tokens/API keys.

Fix:
- Use `bcrypt.GenerateFromPassword` / `CompareHashAndPassword` or argon2id with recommended parameters.
- Use constant-time compare helpers when comparing MACs/tokens.

Notes:
- Go provides bcrypt in `golang.org/x/crypto/bcrypt`, and constant-time comparisons in `crypto/subtle`.

---

### GO-CONC-001: Data races and concurrency hazards MUST be treated as security-relevant
Severity: Medium to High (depends on what races affect)

Required:
- MUST run tests with the race detector (`go test -race`) in CI for security-sensitive services.
- MUST fix detected races; do not suppress without deep justification.
- SHOULD treat shared mutable state in handlers as high risk; enforce synchronization or avoid shared mutability.

Insecure patterns:
- Global maps/slices mutated from multiple goroutines without a mutex.
- Caches or auth/session state stored in globals without concurrency protection.
- Racy access to authorization state (can lead to bypasses or inconsistent enforcement).

Detection hints:
- Search for `var someMap = map[...]...` used in handlers.
- Look for missing `sync.Mutex`, `sync.Map`, channels, or other synchronization.
- Ensure CI includes `-race` and that it runs relevant tests.

Fix:
- Add proper synchronization or redesign to avoid shared mutable state.
- Add race tests and run them continuously.

Notes:
- The Go race detector only finds races that occur in executed code paths; improve test coverage and run realistic workloads with `-race` where feasible.

---

### GO-UNSAFE-001: Use of unsafe/cgo MUST be minimized and audited like memory-unsafe code
Severity: High (Critical in high-risk code paths)

Required:
- SHOULD avoid importing `unsafe` in application code unless absolutely necessary.
- If `unsafe` is used, MUST treat it as “manual memory safety” requiring careful review and test coverage.
- If `cgo` is used, MUST treat the C/C++ boundary as memory-unsafe; apply secure coding practices on the C side and isolate where possible.

Insecure patterns:
- Widespread `unsafe.Pointer` casts in parsing, serialization, auth, or network code.
- `cgo` used for parsing or security boundaries without sandboxing.

Detection hints:
- Search for `import "unsafe"`, `unsafe.Pointer`, `// #cgo`, `import "C"`.
- Prioritize review where unsafe touches untrusted input.

Fix:
- Replace unsafe/cgo usage with safe standard library alternatives where possible.
- Isolate unsafe code in small, well-tested modules with fuzz/race tests.

Notes:
- The unsafe package explicitly provides operations that step around Go’s type safety guarantees.

--------------------------------------------------------------------

## 5) Practical scanning heuristics (how to “hunt”)

When actively scanning, use these high-signal patterns:

Toolchain & dependencies:
- `FROM golang:` (Dockerfiles), `go-version:` (CI), `toolchain go` (go.mod), pinned old versions
- `GOSUMDB=off`, `GOINSECURE`, `GONOSUMDB`, `GOPROXY=direct`
- `replace` directives in `go.mod` to forks/paths
- `govulncheck` missing in CI

HTTP server hardening:
- `http.ListenAndServe(`, `ListenAndServeTLS(`, `&http.Server{` with missing timeouts
- `ReadHeaderTimeout: 0`, `ReadTimeout: 0`, `WriteTimeout: 0`, `IdleTimeout: 0`, missing `MaxHeaderBytes`

Body parsing / DoS:
- `io.ReadAll(r.Body)`, `json.NewDecoder(r.Body)` without size cap
- `ParseMultipartForm`, `FormFile`, `multipart.NewReader` without explicit limits
- Missing `http.MaxBytesReader`

Debug exposure:
- `import _ "net/http/pprof"`
- `/debug/pprof`, `/debug/vars`

Templates / XSS / SSTI:
- `text/template` used for HTML output
- `template.HTML(`, `template.JS(`, `template.URL(` with user-controlled data
- `.Parse(` on user-controlled strings

Files:
- `http.ServeFile(` with user path
- `http.FileServer(http.Dir(` pointing at repo root or uploads
- `os.Open(filepath.Join(base, user))` without containment checks

Injection:
- SQL building with `fmt.Sprintf`, string concatenation near `db.Query/Exec`
- `exec.Command("sh","-c", ...)`, `exec.Command("bash","-c", ...)`

SSRF / outbound HTTP:
- `http.Get(userURL)`, `client.Do(req)` where URL comes from request/DB
- Missing client timeout, missing `resp.Body.Close()`, unbounded `io.ReadAll(resp.Body)`

Crypto:
- `math/rand` in token/session generation
- `InsecureSkipVerify: true`
- Password hashing with `sha256`/`md5` instead of bcrypt/argon2

Concurrency:
- Shared maps/slices mutated from handlers without locks
- CI lacking `go test -race`

Always try to confirm:
- data origin (untrusted vs trusted)
- sink type (template/SQL/subprocess/files/http)
- protective controls present (limits, validation, allowlists, middleware, network controls)

--------------------------------------------------------------------

## 6) Sources (accessed 2026-01-28)

Primary Go documentation:
- Go Security Policy — https://go.dev/doc/security/policy
- Go Release History (security fixes in patch releases) — https://go.dev/doc/devel/release
- Go 1.25 Release Notes — https://go.dev/doc/go1.25
- net/http (server timeouts, MaxHeaderBytes, DefaultClient) — https://pkg.go.dev/net/http
- html/template (auto-escaping and trusted-template assumptions) — https://pkg.go.dev/html/template
- crypto/tls (MinVersion defaults, InsecureSkipVerify warnings) — https://pkg.go.dev/crypto/tls
- crypto/rand (secure randomness, token helpers) — https://pkg.go.dev/crypto/rand
- crypto/subtle (constant-time comparisons) — https://pkg.go.dev/crypto/subtle
- os/exec (no shell by default; command execution guidance) — https://pkg.go.dev/os/exec
- unsafe (bypasses type safety) — https://go.dev/src/unsafe/unsafe.go
- net/http/pprof (debug endpoints) — https://pkg.go.dev/net/http/pprof
- cmd/go (module authentication via go.sum/checksum DB; env vars like GOINSECURE) — https://pkg.go.dev/cmd/go
- Module Mirror and Checksum Database Launched (Go blog) — https://go.dev/blog/module-mirror-launch
- govulncheck documentation — https://pkg.go.dev/golang.org/x/vuln/cmd/govulncheck
- Go Race Detector documentation — https://go.dev/doc/articles/race_detector
- bcrypt (password hashing) — https://pkg.go.dev/golang.org/x/crypto/bcrypt
- Go vulnerability entry example (multipart resource consumption) — https://pkg.go.dev/vuln/GO-2023-1569

OWASP Cheat Sheet Series (general web security):
- Session Management — https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- CSRF Prevention — https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
- SSRF Prevention — https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html
- XSS Prevention — https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
- HTTP Security Response Headers — https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html