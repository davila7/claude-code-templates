# Flask (Python) Web Security Spec (Flask 3.1.x, Python 3.x)

This document is designed as a **security spec** that supports:
1) **Secure-by-default code generation** for new Flask code.
2) **Security review / vulnerability hunting** in existing Flask code (passive “notice issues while working” and active “scan the repo and report findings”).

It is intentionally written as a set of **normative requirements** (“MUST/SHOULD/MAY”) plus **audit rules** (what bad patterns look like, how to detect them, and how to fix/mitigate them).

--------------------------------------------------------------------

## 0) Safety, boundaries, and anti-abuse constraints (MUST FOLLOW)

- MUST NOT request, output, log, or commit secrets (API keys, passwords, private keys, session cookies, SECRET_KEY).
- MUST NOT “fix” security by disabling protections (e.g., turning off CSRF, relaxing CORS, disabling escaping, disabling auth checks).
- MUST provide **evidence-based findings** during audits: cite file paths, code snippets, and configuration values that justify the claim.
- MUST treat uncertainty honestly: if a protection might exist in infrastructure (reverse proxy, WAF, CDN), report it as “not visible in app code; verify at runtime/config”.

--------------------------------------------------------------------

## 1) Operating modes

### 1.1 Generation mode (default)
When asked to write new Flask code or modify existing code:
- MUST follow every **MUST** requirement in this spec.
- SHOULD follow every **SHOULD** requirement unless the user explicitly says otherwise.
- MUST prefer safe-by-default APIs and proven libraries over custom security code.
- MUST avoid introducing new risky sinks (template rendering from strings, shell execution, dynamic imports, unsafe redirects, serving user files as HTML, etc.).

### 1.2 Passive review mode (always on while editing)
While working anywhere in a Flask repo (even if the user did not ask for a security scan):
- MUST “notice” violations of this spec in touched/nearby code.
- SHOULD mention issues as they come up, with a brief explanation + safe fix.

### 1.3 Active audit mode (explicit scan request)
When the user asks to “scan”, “audit”, or “hunt for vulns”:
- MUST systematically search the codebase for violations of this spec.
- MUST output findings in a structured format (see §2.3).

Recommended audit order:
1) App entrypoints / deployment scripts / Dockerfiles / Procfiles.
2) Flask configuration and environment handling.
3) Auth + sessions + cookies.
4) CSRF protections and state-changing routes.
5) Template rendering and XSS/SSTI.
6) File handling (uploads + downloads) and path traversal.
7) Injection classes (SQL, command execution, unsafe deserialization).
8) Outbound requests (SSRF).
9) Redirect handling (open redirects).
10) CORS and security headers.

--------------------------------------------------------------------

## 2) Definitions and review guidance

### 2.1 Untrusted input (treat as attacker-controlled unless proven otherwise)
Examples include:
- `request.args`, `request.form`, `request.values`
- `request.get_json()`, `request.json`, `request.data`
- `request.headers`, `request.cookies`
- URL path parameters (e.g., `/user/<id>`)
- Any data from external systems (webhooks, third-party APIs, message queues)
- Any persisted user content (DB rows) that originated from users

### 2.2 State-changing request
A request is state-changing if it can create/update/delete data, change auth/session state, trigger side effects (purchase, email send, webhook send), or initiate privileged actions.

### 2.3 Required audit finding format
For each issue found, output:

- Rule ID:
- Severity: Critical / High / Medium / Low
- Location: file path + function/route name + line(s)
- Evidence: the exact code/config snippet
- Impact: what could go wrong, who can exploit it
- Fix: safe change (prefer minimal diff)
- Mitigation: defense-in-depth if immediate fix is hard
- False positive notes: what to verify if uncertain

--------------------------------------------------------------------

## 3) Secure baseline: minimum production configuration (MUST in production)

This is the smallest “production baseline” that prevents common Flask misconfigurations.

### 3.1 App initialization pattern (SHOULD)
SHOULD use an app factory and environment-based config so production config is not hard-coded.

Example skeleton (illustrative; adjust to your project):
- Load config from environment / secret store.
- Fail closed if critical settings are missing in production.

Key baseline config targets:
- `SECRET_KEY` set and not committed
- `SESSION_COOKIE_SECURE=True` (when HTTPS) IMPORTANT NOTE: Only set `Secure` in production environment when TLS is configured. When running in a local dev environment over HTTP, do not set `Secure` property on cookies. You should do this conditionally based on if the app is running in production mode. You should also include a property like `SESSION_COOKIE_SECURE` which can be used to disable `Secure` cookies when testing over HTTP.
- `SESSION_COOKIE_HTTPONLY=True`
- `SESSION_COOKIE_SAMESITE='Lax'` (or `'Strict'` if compatible)
- `TRUSTED_HOSTS` set in production
- Security headers set (CSP, etc.) either in app or at the edge

--------------------------------------------------------------------

## 4) Rules (generation + audit)

Each rule contains: required practice, insecure patterns, detection hints, and remediation.

### FLASK-DEPLOY-001: Do not use Flask’s development server in production
Severity: High (if production)

Required:
- MUST NOT deploy the built-in development server as the production server.
- MUST run behind a production-grade WSGI server or managed platform (such as gunicorn)

Insecure patterns:
- `app.run(...)` in a production entrypoint.
- Deployment docs/scripts that use `flask run` in production.

Detection hints:
- Search for `app.run(`, `flask run`, `--debug`, `FLASK_DEBUG`, `FLASK_ENV=development`.
- Check Docker CMD/ENTRYPOINT, Procfile, systemd units, shell scripts.

Fix:
- Use a production WSGI server (and keep Flask as the app object).
- Ensure the dev server is only used for local development.

Note:
- These are often used in dev mode or local testing. This is allowed. Only flag if it is clear that it is being used as the production entrypoint

---

### FLASK-DEPLOY-002: Debug mode MUST be disabled in production
Severity: Critical

Required:
- MUST NOT enable debug mode in production.
- MUST treat the interactive debugger as equivalent to remote code execution if exposed.

Insecure patterns:
- `app.run(debug=True)`
- `flask run --debug` in production.
- `DEBUG=True` via env/config in production.

Detection hints:
- Look for `debug=True`, `FLASK_DEBUG=1`, `DEBUG = True`, `app.debug = True`.
- Look for `TRAP_HTTP_EXCEPTIONS`/debugger settings enabled in non-test contexts.

Fix:
- Ensure debug is only enabled in local dev/test.
- Prefer environment-based toggles and safe defaults.

Note:
- These are often used in dev mode or local testing. This is allowed. Only flag if it is clear that it is being used as the production entrypoint

---

### FLASK-CONFIG-001: SECRET_KEY must be strong, secret, and rotated safely
Severity: High (Critical if missing in production with sessions or signing)

Required:
- MUST set a strong random `SECRET_KEY` in production.
- MUST keep `SECRET_KEY` out of source control and out of logs.
- MAY rotate keys periodically; MAY use `SECRET_KEY_FALLBACKS` to support rotation without instantly invalidating existing sessions, then remove old keys after the rotation window. This likely is not needed for smaller applications but is good practice for larger applications. As this may complicate deployment, suggest that it be implemented rather than implementing it by default.

Insecure patterns:
- Missing `SECRET_KEY` in production.
- Hard-coded `SECRET_KEY` in repo (including test keys accidentally used in prod).
- Logging or printing `SECRET_KEY`.

Detection hints:
- Search for `SECRET_KEY =`, `app.secret_key =`, `SECRET_KEY_FALLBACKS =`.
- Check `.env` files committed to repo.
- Check config modules for constants.

Fix:
- Load from secret manager or environment variable.
- Add a rotation process:
  - Set new `SECRET_KEY`
  - Keep old key(s) temporarily in `SECRET_KEY_FALLBACKS`
  - Remove old key(s) after the safe window.

Notes:
- If the application uses Flask sessions (cookie-based by default), `SECRET_KEY` is directly security-critical.

---

### FLASK-SESS-001: Session cookies must use secure attributes in production
Severity: Medium

Required (production, HTTPS):
- MUST set `SESSION_COOKIE_SECURE=True` (cookies only over HTTPS). NOTE: Only set `Secure` in production environment when TLS is configured. When running in a local dev environment over HTTP, do not set `Secure` property on cookies. You should do this conditionally based on if the app is running in production mode. You should also include a property like `SESSION_COOKIE_SECURE` which can be used to disable `Secure` cookies when testing over HTTP.
- MUST ensure `SESSION_COOKIE_HTTPONLY=True` (protect from JS access).
- SHOULD set `SESSION_COOKIE_SAMESITE='Lax'` (recommended) or `'Strict'` if compatible with UX.
- SHOULD keep `SESSION_COOKIE_DOMAIN=None` unless you explicitly need subdomain-wide cookies.
- If you need embedded/iframe third-party usage, MAY consider `SESSION_COOKIE_PARTITIONED=True` (requires HTTPS).

Insecure patterns:
- `SESSION_COOKIE_SECURE=False` in production.
- `SESSION_COOKIE_HTTPONLY=False`.
- `SESSION_COOKIE_SAMESITE=None` with cookie-authenticated state-changing endpoints (higher CSRF risk).

Detection hints:
- Inspect `app.config.update(...)` blocks and config classes.
- Look for `set_cookie(..., secure=..., httponly=..., samesite=...)` usage on non-session cookies too.

Fix:
- Set these config values explicitly in production config.

Notes:
- SameSite is defense-in-depth; do not treat it as a full replacement for CSRF tokens.

---

### FLASK-SESS-002: Sessions must be bounded and resistant to fixation/replay
Severity: Medium

Required:
- SHOULD set a bounded session lifetime appropriate to the app.
- SHOULD set `session.permanent = True` only when you intend persistent sessions, and set `PERMANENT_SESSION_LIFETIME` to a justified value.
- SHOULD clear the session on login and privilege changes to reduce session fixation risk.
- MUST NOT store sensitive secrets in the default Flask session cookie. The default session is signed, not encrypted.

Insecure patterns:
- Extremely long or unlimited lifetimes for privileged sessions.
- No session clearing on login.
- Storing secrets (passwords, access tokens, PII) directly in `session[...]` when using default cookie sessions.

Detection hints:
- Search for `PERMANENT_SESSION_LIFETIME`, `session.permanent`, `session[...] =`.
- Identify whether server-side session storage is used; if not, assume default cookie sessions.

Fix:
- Set appropriate lifetimes.
- Clear/rotate session on login.
- Store sensitive data server-side; store only identifiers in the session cookie.

---

### FLASK-CSRF-001: State-changing requests using cookie auth MUST be CSRF-protected
Severity: High

- IMPORTANT NOTE: If cookies are not being used for auth (ie auth is via Authentication header or other passed token), then there is no CSRF risk.

Required:
- MUST protect all state-changing endpoints (POST/PUT/PATCH/DELETE) that rely on cookies for authentication.
- MAY use a well-tested CSRF library/integration (form framework or middleware) rather than rolling your own.
- MAY use additional defenses (Origin/Referer checking, SameSite cookies, Fetch Metadata headers, custom headers for AJAX/API), but tokens remain the primary defense for cookie-authenticated apps.
If tokens are impractical, or for small applications:
* MUST at a minimum require a custom header to be set and set the session cookie SESSION_COOKIE_SAMESITE=lax, as this is the strongest method besides requiring a form token, and may be much easier to implement.

Insecure patterns:
- Cookie-authenticated endpoints that change state with no CSRF protection.
- Using GET for state-changing actions (amplifies CSRF risk).

Detection hints:
- Enumerate routes with methods other than GET and identify auth mechanism.
- Look for CSRF integrations (e.g., Flask-WTF, global CSRF middleware). If absent, treat as suspicious.
- Check JSON API endpoints too, not only HTML forms.

Fix:
- Add CSRF protection to all state-changing requests.
- If the app is a pure API and uses Authorization headers (bearer tokens) rather than cookies, document that choice and ensure cookies aren’t used for auth. If cookies are not used for auth, there is no CSRF risk.

Notes:
- XSS can defeat CSRF protections; CSRF defenses do not replace XSS prevention.

---

### FLASK-XSS-001: Prevent reflected/stored XSS in templates and HTML generation
Severity: High

Required:
- MUST rely on Jinja auto-escaping for HTML templates.
- MUST NOT mark untrusted content as safe:
  - Avoid `Markup(...)` on user data.
  - Avoid Jinja `|safe` on user-controlled content.
- MUST quote HTML attributes containing Jinja expressions (`value="{{ x }}"` not `value={{ x }}`).
- MUST NOT serve uploaded HTML as active HTML; serve as download (`Content-Disposition: attachment`) or transform to a safe format. Note: This is only relevant if it is possible to upload document content such as html, js, css, etc. If it purely is image files, there is no concern.
- SHOULD deploy a Content Security Policy (CSP) to mitigate XSS classes (including `javascript:` in `href`).

Insecure patterns:
- `Markup(request.args.get(...))`
- Template filters: `{{ user_html|safe }}`
- Unquoted attributes in templates
- Serving user-uploaded content directly with `text/html` or inline rendering

Detection hints:
- Search for `Markup(` and investigate origin of the data.
- Search template files for `|safe`, `|tojson` misuse, and unquoted attributes.
- Review file-serving routes that might return user uploads without `as_attachment=True`. Note: This is only relevant if it is possible to upload document content such as html, js, css, etc. If it purely is image files, there is no concern.

Fix:
- Remove unsafe marking; sanitize only when strictly necessary using a trusted HTML sanitizer.
- Always quote attributes.
- Add CSP and reduce inline scripts.

---

### FLASK-SSTI-001: Never render untrusted templates (Server-Side Template Injection)
Severity: Critical

Required:
- MUST NOT render templates that contain user-controlled template syntax.
- MUST treat `render_template_string` and `Environment.from_string(...).render(...)` as dangerous if the template string is influenced by untrusted input.
- MUST NOT use use `.format()` on user controlled strings
- If untrusted templates are absolutely required, treat it as a special high-risk design:
  - MUST use a sandboxed templating approach and restrict capabilities.
  - MUST keep Jinja updated and assume sandbox escapes are possible; isolate further.

Insecure patterns:
- `render_template_string(request.args["tmpl"], ...)`
- Storing user templates in DB and rendering them with the normal Jinja environment.
- `request.args["tmpl"].format(...)`

Detection hints:
- Grep for `render_template_string`, `from_string`, `.render(` with dynamic strings.
- Trace the origin of the template string (DB, request, uploads, admin panels).

Fix:
- Replace with safe templating alternatives that do not evaluate code (e.g., string.Template, str.replace).
- If templates must be user-defined, use a sandbox plus strict allowlists and heavy isolation.

---

### FLASK-HEADERS-001: Set essential security headers (in app or at the edge)
Severity: Medium

Required (typical web app):
- SHOULD set:
  - CSP (`Content-Security-Policy`)
  - `X-Content-Type-Options: nosniff`
  - Clickjacking protection (`X-Frame-Options: SAMEORIGIN` and/or CSP `frame-ancestors`) (there may be cases where the user wants to iframe their site elsewhere. If that is the case, work with them to safely allow it)
- SHOULD consider additional hardening headers depending on app (Referrer-Policy, Permissions-Policy).
- MUST ensure cookies are set with secure attributes (see FLASK-SESS-001).

NOTE: Security headers may be set via a proxy or other cloud provider. Check to see if there is evidence of that.

Insecure patterns:
- No security headers anywhere (app or edge).
- CSP missing on apps that display untrusted content.

Detection hints:
- Search for `after_request` hooks, Flask-Talisman usage, reverse proxy config.
- If not visible in app code, flag as “verify at edge”.

Fix:
- Set headers centrally (middleware / after_request) or via reverse proxy/CDN.
- Keep CSP realistic and compatible; avoid `unsafe-inline` where possible.

---

### FLASK-LIMITS-001: Request size and form parsing limits MUST be set appropriately
Severity: Low (Medium if file uploads / large bodies are possible)

Required:
- SHOULD set and justify:
  - `MAX_CONTENT_LENGTH` (global maximum request bytes)
  - `MAX_FORM_MEMORY_SIZE` (max per non-file form field in multipart)
  - `MAX_FORM_PARTS` (max number of multipart fields)
- MUST enforce additional limits at the reverse proxy / WSGI / platform level where possible.

Insecure patterns:
- Unlimited request body sizes when handling uploads or user content.
- Accepting arbitrarily large multipart forms or many fields.

Detection hints:
- Inspect Flask config for these keys.
- Inspect upload routes and APIs that accept large JSON.

Fix:
- Set conservative defaults, override per-route only when needed.
- Ensure large uploads use dedicated upload mechanisms.

---

### FLASK-HOST-001: Host header must be validated in production
Severity: Low (depends on app’s use of external URLs)

Required:
- MUST set `TRUSTED_HOSTS` in production to restrict accepted Host values.
- MUST NOT rely on `SERVER_NAME` as a host restriction mechanism.

Insecure patterns:
- `TRUSTED_HOSTS` unset in production.
- Code that generates external URLs for emails/password resets without host validation.

Detection hints:
- Find `TRUSTED_HOSTS` config usage.
- Find `url_for(..., _external=True)` and check how host is determined.

Fix:
- Set `TRUSTED_HOSTS` to your expected domains (and required subdomains).
- Ensure external URL generation uses trusted host/scheme.

---

### FLASK-PROXY-001: Reverse proxy trust must be configured correctly
Severity: Medium (High if relying on IPs for auth)

Required:
- If behind a reverse proxy, MUST configure Flask/Werkzeug to trust forwarded headers only from the intended proxy.
- MUST NOT blindly trust `X-Forwarded-*` headers from the open internet.

Insecure patterns:
- `ProxyFix` applied with overly broad trust settings, or applied without understanding how many proxies are in front.
- Relying on forwarded headers for scheme/host without validation.

Detection hints:
- Search for `ProxyFix`.
- Search for usage of `request.remote_addr`, `request.scheme`, `request.host` in security-sensitive logic.

Fix:
- Configure `ProxyFix` (or platform-specific settings) with correct hop counts.
- Keep `TRUSTED_HOSTS` in place even behind proxies.

---

### FLASK-PATH-001: Prevent path traversal and unsafe file serving
Severity: High

Required:
- MUST NOT pass user-controlled file paths to `send_file` or to direct file I/O.
- MUST use safe file serving patterns:
  - `send_from_directory` for user-specified paths under a trusted base directory
  - `safe_join` for joining a trusted base directory with untrusted path components
  - `secure_filename` for uploaded filenames (and still generate your own unique storage name)
- MUST ensure user uploads are not served as executable/active content (especially HTML).
- SHOULD in general use `safe_join` over `os.path.join` for almost any filesystem path computations.

Insecure patterns:
- `send_file(request.args["path"])`
- `open(os.path.join(base_dir, user_path))` where `user_path` is untrusted
- Serving uploads from within a static web root without restrictions

Detection hints:
- Search for `send_file(`, `open(`, `os.path.join(`, `pathlib.Path(...)/...` in file routes.
- Identify where filenames come from (request args, DB, headers).

Fix:
- Serve only from a non-user-controlled directory base.
- Store uploads outside static roots; serve through controlled routes.
- Always validate and normalize file identifiers.

Note: `safe_join` is imported from `werkzeug.security`

---

### FLASK-UPLOAD-001: File uploads must be validated, stored safely, and served safely
Severity: High

Required:
- MUST enforce upload size limits (app + edge).
- MUST validate file type using allowlists and content checks (not only extension).
- MUST store uploads outside executable/static roots when possible.
- SHOULD generate server-side filenames (random IDs) and avoid trusting original names.
- MUST serve potentially active formats safely (download attachment) unless explicitly intended.

Insecure patterns:
- Accepting arbitrary file types and serving them back inline.
- Using user-supplied filename as storage path.
- Missing size/type validation.

Detection hints:
- Look for `request.files[...]` handlers.
- Check for `secure_filename` usage (and whether it’s combined with uniqueness).
- Check where files are stored and how they are served.

Fix:
- Implement allowlist validation + safe storage + safe serving.
- Add scanning / quarantine if applicable.

---

### FLASK-INJECT-001: Prevent SQL injection (use parameterized queries / ORM)
Severity: High

Required:
- MUST use parameterized queries or an ORM that parameterizes under the hood.
- MUST NOT build SQL by string concatenation / f-strings with untrusted input.

Insecure patterns:
- `f"SELECT ... WHERE id={request.args['id']}"`
- `"... WHERE name = '%s'" % user_input`

Detection hints:
- Grep for `SELECT`, `INSERT`, `UPDATE`, `DELETE` strings in Python code.
- Track untrusted data into DB execute calls.

Fix:
- Replace with parameterized queries or ORM query APIs.
- Validate types (e.g., int IDs) before querying.

---

### FLASK-INJECT-002: Prevent OS command injection
Severity: Critical to High (depends on exposure)

Required:
- MUST avoid executing shell commands with untrusted input.
- If subprocess is necessary:
  - MUST pass args as a list (not a string)
  - MUST NOT use `shell=True` with attacker-influenced strings
  - SHOULD use strict allowlists for any variable component
- If possible, use pure python or a python library rather than using a subprocess or system command
- Do not assume that arguments to commands will be inherently safe even in `shell=False`. Commands may incorrectly process these arguments as command line flags or other trusted values.

Insecure patterns:
- `os.system(user_input)`
- `subprocess.run(f"cmd {user}", shell=True)`
- Passing user strings into `bash -c`, `sh -c`, PowerShell, etc.

Detection hints:
- Search for `os.system`, `subprocess`, `Popen`, `shell=True`.
- Trace data from request/DB into these calls.

Fix:
- Use library APIs instead of shell commands.
- If unavoidable, hard-code the command and allowlist validated parameters. If supported by the subcommand, try to keep user values after `--` to prevent them being processed as command line flags.

---

### FLASK-SSRF-001: Prevent server-side request forgery (SSRF) in outbound HTTP
Severity: Medium

- Note: For small stand alone projects this is less important. It is most important when deploying into an LAN or with other services listening on the same server.

Required:
- MUST treat outbound requests to user-provided URLs as high risk.
- SHOULD validate and restrict destinations (allowlist hosts/domains) for any user-influenced URL fetch.
- SHOULD block access to:
  - localhost / private IP ranges / link-local addresses
  - cloud metadata endpoints
- MUST NOT allow non http/https protocols (ie file: etc)
- SHOULD set timeouts and restrict redirects.



Insecure patterns:
- `requests.get(request.args["url"])`
- Webhooks/preview/fetch endpoints that accept arbitrary URLs.

Detection hints:
- Search for `requests.get/post`, `httpx`, `urllib`, `aiohttp` usage with untrusted URL sources.
- Identify URL fetch features (preview, import, webhook tester).

Fix:
- Ensure URLs are http or https (disallow file: or other protocols)
- Enforce allowlists and network egress controls.
- Add strict parsing and IP resolution checks; set timeouts; disable redirects if not needed.

---

### FLASK-REDIRECT-001: Prevent open redirects
Severity: Low

Required:
- MUST validate redirect targets derived from untrusted input (e.g., `next`, `redirect`, `return_to`).
- SHOULD use allowlists of internal paths or known domains.
- SHOULD prefer redirecting only to same-site relative paths.

Insecure patterns:
- `redirect(request.args.get("next"))` with no validation.

Detection hints:
- Search for `redirect(` and examine where `location` comes from.

Fix:
- Only allow relative paths or allowlisted domains.
- Fall back to a safe default if validation fails.

---

### FLASK-HTTP-001: Use HTTP methods safely; do not change state via GET; avoid secrets in URLs
Severity: Medium

Required:
- MUST NOT perform state-changing actions over GET.
- MUST NOT put secrets in URLs (query strings are commonly logged and leaked via referrers).
- SHOULD require POST/PUT/PATCH/DELETE for state change and apply CSRF protections when cookie-authenticated.

Insecure patterns:
- `/delete?id=...` implemented as GET
- Password reset tokens or API keys in query params

Detection hints:
- Enumerate GET routes and inspect whether they mutate state.
- Look for URL parameters named `token`, `key`, `secret`, `password`, etc.

Fix:
- Move state changes to non-GET methods.
- Move sensitive values to secure channels (POST bodies, headers) and protect them.

---

### FLASK-CORS-001: CORS must be explicit and least-privilege
Severity: Medium (High if misconfigured with credentials)

Required:
- If CORS is not needed, MUST keep it disabled.
- If CORS is needed:
  - MUST allowlist trusted origins (do not reflect arbitrary origins).
  - MUST be careful with credentialed requests; do not combine broad origins with cookies.
  - SHOULD restrict allowed methods and headers.

Insecure patterns:
- `Access-Control-Allow-Origin: *` paired with credentialed cookies or overly broad access.
- Reflecting `Origin` without validation.
- `flask_cors.CORS(app)` with permissive defaults.

Detection hints:
- Search for `flask_cors`, `CORS(`, `Access-Control-Allow-Origin`.
- Check for `supports_credentials=True` and wildcard origins.

Fix:
- Use a strict origin allowlist and minimal methods/headers.
- Ensure cookie-authenticated endpoints are not exposed cross-origin unless necessary.

---

### FLASK-SUPPLY-001: Dependency and patch hygiene (focus on security-relevant deps)
Severity: Low

Required:
- SHOULD pin and regularly update security-critical dependencies (Flask, Werkzeug, Jinja2, itsdangerous).
- MUST respond to known security advisories promptly.

Audit focus example:
- If running on Windows and using file serving with untrusted paths, ensure Werkzeug’s `safe_join` behavior is not vulnerable to Windows device-name edge cases.

Detection hints:
- Check `requirements.txt`, lockfiles, and runtime environments.
- Identify where security helpers are used (safe_join, send_from_directory).

Fix:
- Upgrade to patched versions and add regression tests for the impacted behavior.

--------------------------------------------------------------------

## 5) Practical scanning heuristics (how to “hunt”)

When actively scanning, use these high-signal patterns:

- Dev server / debug:
  - `app.run(`, `flask run`, `--debug`, `DEBUG=True`, `FLASK_DEBUG`
- Secrets:
  - `SECRET_KEY`, `secret_key`, `.env` committed, `print(config)`
- Cookies / sessions:
  - `SESSION_COOKIE_SECURE`, `SESSION_COOKIE_HTTPONLY`, `SESSION_COOKIE_SAMESITE`
  - `session[...] =` with sensitive values
- CSRF:
  - POST/PUT/PATCH/DELETE handlers without CSRF checks in cookie-authenticated apps
- XSS/SSTI:
  - `Markup(`, `|safe`, unquoted attributes, `render_template_string`
- Files:
  - `send_file(` with user-controlled path; `open(` on user path; `os.path.join` with untrusted
  - upload handlers using user filename for path
- Injection:
  - SQL strings + string formatting into `.execute(...)`
  - `subprocess.*`, `shell=True`, `os.system`
- SSRF:
  - `requests.get/post` or `httpx` with URL from request/DB
- Redirect:
  - `redirect(request.args.get("next"))`
- CORS:
  - `flask_cors.CORS` permissive configs; wildcard origins with credentials

Always try to confirm:
- data origin (untrusted vs trusted)
- sink type (template/SQL/subprocess/files/redirect/http)
- protective controls present (validation, allowlists, middleware)

--------------------------------------------------------------------

## 6) Sources (accessed 2026-01-26)

Primary framework documentation:
- Flask Docs: Deploying to Production — https://flask.palletsprojects.com/en/stable/deploying/
- Flask Docs: Debugging Application Errors — https://flask.palletsprojects.com/en/stable/debugging/
- Flask Docs: Configuration Handling — https://flask.palletsprojects.com/en/stable/config/
- Flask Docs: Security Considerations — https://flask.palletsprojects.com/en/stable/web-security/
- Flask Docs: Tell Flask it is Behind a Proxy — https://flask.palletsprojects.com/en/stable/deploying/proxy_fix/
- Flask API Docs: Sessions — https://flask.palletsprojects.com/en/stable/api/#sessions

Werkzeug documentation & advisories:
- Werkzeug Docs: Utilities (send_file / send_from_directory / safe_join / secure_filename / password hashing) — https://werkzeug.palletsprojects.com/en/stable/utils/
- GitHub Advisory: CVE-2025-66221 (Werkzeug safe_join Windows device names) — https://github.com/advisories/GHSA-hgf8-39gv-g3f2

OWASP Cheat Sheet Series:
- Session Management — https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- CSRF Prevention — https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
- XSS Prevention — https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
- Input Validation — https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
- SQL Injection Prevention — https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html
- Injection Prevention — https://cheatsheetseries.owasp.org/cheatsheets/Injection_Prevention_Cheat_Sheet.html
- OS Command Injection Defense — https://cheatsheetseries.owasp.org/cheatsheets/OS_Command_Injection_Defense_Cheat_Sheet.html
- SSRF Prevention — https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html
- File Upload — https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
- Unvalidated Redirects — https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html
- HTTP Headers — https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html

Template safety references:
- Jinja: Sandbox (rendering untrusted templates) — https://jinja.palletsprojects.com/en/stable/sandbox/
- OWASP WSTG: Testing for Server-Side Template Injection — https://owasp.org/www-project-web-security-testing-guide/v41/4-Web_Application_Security_Testing/07-Input_Validation_Testing/18-Testing_for_Server_Side_Template_Injection
- PortSwigger Web Security Academy: Server-side template injection — https://portswigger.net/web-security/server-side-template-injection

HTTP semantics:
- RFC 9110: HTTP Semantics (safe methods) — https://www.rfc-editor.org/rfc/rfc9110