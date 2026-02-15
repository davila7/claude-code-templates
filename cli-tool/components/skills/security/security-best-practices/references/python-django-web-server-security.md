# Django (Python) Web Security Spec (Django 6.0.x, Python 3.x)

This document is designed as a **security spec** that supports:

1. **Secure-by-default code generation** for new Django code.
2. **Security review / vulnerability hunting** in existing Django code (passive “notice issues while working” and active “scan the repo and report findings”).

It is intentionally written as a set of **normative requirements** (“MUST/SHOULD/MAY”) plus **audit rules** (what bad patterns look like, how to detect them, and how to fix/mitigate them).

---

## 0) Safety, boundaries, and anti-abuse constraints (MUST FOLLOW)

* MUST NOT request, output, log, or commit secrets (API keys, passwords, private keys, session cookies, `SECRET_KEY`, `SECRET_KEY_FALLBACKS`, database passwords).
* MUST NOT “fix” security by disabling protections (e.g., removing `CsrfViewMiddleware`, sprinkling `@csrf_exempt`, loosening `ALLOWED_HOSTS` to `['*']`, disabling `SecurityMiddleware`, disabling template auto-escaping, disabling permission checks).
* MUST provide **evidence-based findings** during audits: cite file paths, code snippets, and concrete configuration values that justify the claim.
* MUST treat uncertainty honestly: if a protection might exist in infrastructure (reverse proxy, WAF, CDN, ingress controller), report it as “not visible in app code; verify at runtime / edge config”.
* MUST keep fixes compatible with Django’s intended security model: prefer Django’s built-ins (middleware, auth, forms, ORM) over custom security logic whenever possible. Django’s deployment checklist and system checks are part of the intended model. ([Django Project][1])

---

## 1) Operating modes

### 1.1 Generation mode (default)

When asked to write new Django code or modify existing code:

* MUST follow every **MUST** requirement in this spec.
* SHOULD follow every **SHOULD** requirement unless the user explicitly says otherwise.
* MUST prefer safe-by-default Django APIs and proven libraries over custom security code.
* MUST avoid introducing new risky sinks (dynamic template rendering from untrusted strings, unsafe redirects, unsafe file serving, shell execution, raw SQL string formatting, SSRF-capable URL fetchers from untrusted input).

### 1.2 Passive review mode (always on while editing)

While working anywhere in a Django repo (even if the user did not ask for a security scan):

* MUST “notice” violations of this spec in touched/nearby code.
* SHOULD mention issues as they come up, with a brief explanation + safe fix.

### 1.3 Active audit mode (explicit scan request)

When the user asks to “scan”, “audit”, or “hunt for vulns”:

* MUST systematically search the codebase for violations of this spec.
* MUST output findings in a structured format (see §2.3).

Recommended audit order:

1. Deployment entrypoints (ASGI/WSGI), Dockerfiles, Procfiles, systemd units, platform manifests.
2. `settings.py` and environment-specific settings modules.
3. Middleware ordering and enabled protections.
4. Authn/authz (login, session management, permissions, admin).
5. CSRF protections and state-changing endpoints.
6. Templates and XSS.
7. File handling (uploads/downloads/static/media) and path traversal.
8. Injection classes (SQL, command execution, unsafe deserialization).
9. Outbound requests (SSRF).
10. Redirect handling (open redirects) + CORS + security headers (CSP, HSTS, etc.).
11. Dependency/pinning and patch posture.

---

## 2) Definitions and review guidance

### 2.1 Untrusted input (treat as attacker-controlled unless proven otherwise)

Examples include:

* `request.GET`, `request.POST`, `request.FILES`
* `request.body`, JSON bodies (e.g., `json.loads(request.body)`), DRF `request.data`
* URL path parameters (e.g., `<int:id>`, `<slug:...>`)
* `request.headers` / `request.META` (including `HTTP_HOST`, `HTTP_ORIGIN`, `HTTP_REFERER`, `HTTP_X_FORWARDED_*`)
* `request.COOKIES`
* Any data from external systems (webhooks, third-party APIs, message queues)
* Any persisted content that originated from users (DB rows, cached content, file uploads)

Django explicitly emphasizes “never trust user-controlled data” and recommends using forms/validation. ([Django Project][2])

### 2.2 State-changing request

A request is state-changing if it can create/update/delete data, change auth/session state, trigger side effects (purchase, email send, webhook send), or initiate privileged actions.

### 2.3 Required audit finding format

For each issue found, output:

* Rule ID:
* Severity: Critical / High / Medium / Low
* Location: file path + function/class/view name + line(s)
* Evidence: the exact code/config snippet
* Impact: what could go wrong, who can exploit it
* Fix: safe change (prefer minimal diff)
* Mitigation: defense-in-depth if immediate fix is hard
* False positive notes: what to verify if uncertain

---

## 3) Secure baseline: minimum production configuration (MUST in production)

This is the smallest “production baseline” that prevents common Django misconfigurations. Django provides a “Deployment checklist” and recommends running `manage.py check --deploy` against production settings. ([Django Project][1])

### 3.1 Settings management pattern (SHOULD)

* SHOULD use environment-based configuration (or a secret manager) so production settings are not hard-coded.
* MUST treat sensitive settings as confidential (e.g., `SECRET_KEY`, DB passwords) and keep them out of source control. Django’s checklist explicitly recommends loading `SECRET_KEY` from env or a file rather than hardcoding. ([Django Project][1])
* SHOULD separate dev vs prod settings modules, with safe defaults for production (fail closed if critical settings are missing). ([Django Project][1])

### 3.2 Minimum baseline targets (production)

* MUST NOT use `manage.py runserver` as the production entrypoint; use a production-ready WSGI or ASGI server. ([Django Project][1])
* MUST set `DEBUG = False` in production. ([Django Project][1])
* MUST set a strong, secret `SECRET_KEY` and keep it secret; MAY use `SECRET_KEY_FALLBACKS` for safe rotation. ([Django Project][1])
* MUST set `ALLOWED_HOSTS` to expected hosts (no wildcard unless you do your own host validation). ([Django Project][1])
* MUST enforce HTTPS for authenticated areas (ideally site-wide for any login-capable app) and set `CSRF_COOKIE_SECURE=True` and `SESSION_COOKIE_SECURE=True` when HTTPS is used. ([Django Project][1])
* SHOULD enable key `SecurityMiddleware` headers/settings: HSTS, Referrer-Policy, COOP, nosniff, SSL redirect (with correct proxy configuration). ([Django Project][3])
* MUST treat user uploads as untrusted; ensure your web server never interprets them as executable content; keep `MEDIA_ROOT` separate from `STATIC_ROOT`. ([Django Project][1])

---

## 4) Rules (generation + audit)

Each rule contains: required practice, insecure patterns, detection hints, and remediation.

### DJANGO-DEPLOY-001: Do not use Django’s development server in production

Severity: High (if production)

Required:

* MUST NOT deploy `manage.py runserver` as the production server.
* MUST run behind a production-grade WSGI or ASGI server. ([Django Project][1])

Insecure patterns:

* Production docs/scripts using `python manage.py runserver 0.0.0.0:8000`.
* Docker `CMD`/entrypoint uses `runserver`.
* Kubernetes/Procfile/systemd units invoking `runserver`.

Detection hints:

* Search for `manage.py runserver`, `runserver 0.0.0.0`, `--insecure`.
* Check Docker `CMD/ENTRYPOINT`, Procfile, systemd unit files, Helm charts.

Fix:

* Use a production server (WSGI/ASGI) as recommended in Django’s deployment checklist. ([Django Project][1])

Note:

* `runserver` is fine for local development. Only flag if it’s used as the production entrypoint.

---

### DJANGO-DEPLOY-002: `DEBUG` MUST be disabled in production

Severity: High

Required:

* MUST set `DEBUG = False` in production.
* MUST treat any mechanism that exposes debug pages/tracebacks to untrusted users as a critical information disclosure risk. Django’s checklist explicitly warns `DEBUG=True` leaks source excerpts, local variables, settings, and more. ([Django Project][1])

Insecure patterns:

* `DEBUG = True` in production settings.
* Environment defaults to `DEBUG=True` unless explicitly overridden.

Detection hints:

* Search `DEBUG = True`, `DEBUG=os.environ.get(..., True)`, `DJANGO_DEBUG`, `.env` files.
* Look for “production” settings modules that import from dev defaults.

Fix:

* Set `DEBUG=False` in prod settings; use explicit environment config.
* Ensure error reporting is via safe logging/monitoring, not debug pages. ([Django Project][1])

---

### DJANGO-CONFIG-001: `SECRET_KEY` must be strong, secret, and rotated safely

Severity: High (Critical if missing in production with signing/sessions)

Required:

* MUST set a large random `SECRET_KEY` in production and keep it secret. ([Django Project][1])
* MUST NOT commit it to source control or print/log it. ([Django Project][1])
* SHOULD load it from env or a file/secret store (not hard-coded). ([Django Project][1])
* MAY rotate keys using `SECRET_KEY_FALLBACKS` to avoid instantly invalidating all signed data; MUST remove old keys from fallbacks in a timely manner. ([Django Project][1])

Insecure patterns:

* Hard-coded `SECRET_KEY = "..."` in repo for production.
* `SECRET_KEY` reused across environments.
* `SECRET_KEY_FALLBACKS` contains long-expired keys indefinitely.

Detection hints:

* Search for `SECRET_KEY =`, `SECRET_KEY_FALLBACKS`, `.env` committed files, `print(settings.SECRET_KEY)`.

Fix:

* Load from secret manager / environment variable.
* If rotating:

  * Set new `SECRET_KEY`
  * Keep old key(s) temporarily in `SECRET_KEY_FALLBACKS`
  * Remove old key(s) after the rotation window. ([Django Project][1])

---

### DJANGO-HOST-001: Host header must be validated (`ALLOWED_HOSTS` must be strict)

Severity: Medium

Required:

* MUST set `ALLOWED_HOSTS` in production to your expected domains/hosts. ([Django Project][1])
* MUST NOT set `ALLOWED_HOSTS = ['*']` in production unless you also implement your own robust `Host` validation (Django warns that wildcards require your own validation to avoid CSRF-class attacks). ([Django Project][1])
* SHOULD configure the fronting web server to reject unknown hosts early (defense-in-depth). ([Django Project][1])

Insecure patterns:

* `ALLOWED_HOSTS = ['*']` (or env expands to `*`) in production.
* `ALLOWED_HOSTS = []` with `DEBUG=False` (site won’t run, or misconfigured deployments attempt workarounds).

Detection hints:

* Search `ALLOWED_HOSTS`.
* Check platform environment settings that override `ALLOWED_HOSTS`.

Fix:

* Set `ALLOWED_HOSTS = ['example.com', 'www.example.com', ...]` for prod.
* Keep dev hosts separate.

Notes:

* Django uses the Host header for URL construction; fake Host values can lead to CSRF, cache poisoning, and poisoned email links (Django security docs call this out). ([Django Project][2])

---

### DJANGO-HTTPS-001: If TLS is used cookie transport must be secured

Severity: High (Critical for auth-enabled apps)

NOTE: Only enforce this if TLS is enabled, as it will break non-TLS applications

If using TLS:
* MUST set:

  * `CSRF_COOKIE_SECURE = True` ([Django Project][1])
  * `SESSION_COOKIE_SECURE = True` ([Django Project][1])
* SHOULD consider enabling:

  * `SECURE_SSL_REDIRECT = True` (with correct proxy config) ([Django Project][3])
  * HSTS via `SECURE_HSTS_SECONDS` (+ includeSubDomains/preload as appropriate). ([Django Project][3])

Insecure patterns:

* Login pages over HTTP, or mixed HTTP/HTTPS with the same session cookie.
* `CSRF_COOKIE_SECURE=False` or `SESSION_COOKIE_SECURE=False` in production HTTPS.
* HSTS enabled incorrectly (can break site for the duration).

Detection hints:

* Inspect `settings.py` for `CSRF_COOKIE_SECURE`, `SESSION_COOKIE_SECURE`, `SECURE_SSL_REDIRECT`, `SECURE_HSTS_SECONDS`.
* Inspect proxy/ingress config for HTTP->HTTPS redirect behavior.

Fix:

* Enable HTTPS redirect and secure cookies.
* Add HSTS carefully (start with low value, validate, then increase). Django warns misconfig can break your site for the HSTS duration. ([Django Project][3])

---

### DJANGO-PROXY-001: Reverse proxy trust must be configured correctly (`SECURE_PROXY_SSL_HEADER`)

Severity: Medium (when behind a TLS proxy)

Required:

* If behind a reverse proxy that terminates TLS, MUST configure Django so `request.is_secure()` reflects the *external* scheme, otherwise CSRF and other logic can break. Django documents using `SECURE_PROXY_SSL_HEADER` for this. ([Django Project][3])
* MUST only set `SECURE_PROXY_SSL_HEADER` if you control the proxy (or have guarantees) and it strips inbound spoofed headers. Django explicitly warns misconfig can compromise security and lists required conditions. ([Django Project][3])

Insecure patterns:

* `SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")` in an environment where the proxy does not strip user-supplied `X-Forwarded-Proto`.
* Infinite redirect loops after setting `SECURE_SSL_REDIRECT=True` (often indicates proxy HTTPS detection is wrong). ([Django Project][3])

Detection hints:

* Search `SECURE_PROXY_SSL_HEADER`, `SECURE_SSL_REDIRECT`.
* Inspect ingress/proxy behavior for stripping forwarded headers.

Fix:

* Set `SECURE_PROXY_SSL_HEADER` only if the proxy strips and sets the header correctly (per Django’s documented prerequisites). ([Django Project][3])

---

### DJANGO-SESS-001: Session cookies must use secure attributes in production

Severity: Medium (Only if TLS enabled)

Required (production, HTTPS):

* MUST set `SESSION_COOKIE_SECURE=True` (only transmit over HTTPS). ([Django Project][3])
* MUST keep `SESSION_COOKIE_HTTPONLY=True` (Django default is `True`). ([Django Project][3])
* SHOULD keep `SESSION_COOKIE_SAMESITE='Lax'` (Django default is `Lax`) unless a justified cross-site flow requires `None`. ([Django Project][3])
* SHOULD avoid setting `SESSION_COOKIE_DOMAIN` unless you truly need cross-subdomain cookies (subdomain-wide cookies expand attack surface).

Insecure patterns:

* `SESSION_COOKIE_SECURE=False` in production HTTPS.

IMPORTANT NOTE: Only set `Secure` in production environment when TLS is configured. When running in a local dev environment over HTTP, do not set `Secure` property on cookies. You should do this conditionally based on if the app is running in production mode. You should also include a property like `SESSION_COOKIE_SECURE` which can be used to disable `Secure` cookies when testing over HTTP.

* `SESSION_COOKIE_HTTPONLY=False`.
* `SESSION_COOKIE_SAMESITE=None` combined with cookie-authenticated state-changing endpoints (higher CSRF risk).

Detection hints:

* Search for `SESSION_COOKIE_` settings, `response.set_cookie(..., httponly=..., secure=..., samesite=...)`.

Fix:

* Set the above explicitly in production settings.
* Validate compatibility with your auth flows. ([Django Project][3])

---

### DJANGO-SESS-002: CSRF cookie settings must be deliberate (HttpOnly has tradeoffs)

Severity: Medium

Required:

* SHOULD set `CSRF_COOKIE_SECURE=True` when using HTTPS/TLS. ([Django Project][3])
* SHOULD keep `CSRF_COOKIE_SAMESITE='Lax'` unless you have a cross-site requirement. Django default is `Lax`. ([Django Project][3])
* MAY set `CSRF_COOKIE_HTTPONLY=True` (default is `False`) if your frontend does not need to read the CSRF cookie. If you enable it, your JS must read the CSRF token from the DOM instead (Django documents this). ([Django Project][3])

Insecure patterns:

* `CSRF_COOKIE_SECURE=False` in production HTTPS/TLS.
* Setting `CSRF_COOKIE_HTTPONLY=True` but still relying on “read csrftoken cookie in JS” patterns (breaks CSRF for AJAX).
* `CSRF_COOKIE_SAMESITE=None` without a clear reason.

Detection hints:

* Search for `CSRF_COOKIE_` settings.
* Search JS for `document.cookie` usage to fetch `csrftoken`.

Fix:

* Align cookie settings with your CSRF token acquisition method (cookie vs DOM) as Django describes. ([Django Project][4])

---

### DJANGO-CSRF-001: Cookie-authenticated state-changing requests MUST be CSRF-protected

Severity: High

Required:

* MUST keep `django.middleware.csrf.CsrfViewMiddleware` enabled (it is activated by default). ([Django Project][4])
* MUST include `{% csrf_token %}` in internal POST forms; MUST NOT include it in forms that POST to external URLs (Django warns this leaks the token). ([Django Project][4])
* MUST protect all state-changing endpoints (POST/PUT/PATCH/DELETE) that rely on cookies for authentication.
* For AJAX/SPA calls, MUST send the CSRF token via the `X-CSRFToken` header (or configured header name) as documented. ([Django Project][4])
* MUST be very careful with `@csrf_exempt` and use it only when absolutely necessary; if used, MUST replace CSRF with an appropriate alternative control (e.g., request signing for webhooks). Django explicitly warns about `csrf_exempt`. ([Django Project][2])

Insecure patterns:

* Missing `CsrfViewMiddleware` in `MIDDLEWARE`.
* `@csrf_exempt` on general-purpose authenticated views.
* POST/PUT/PATCH/DELETE endpoints with session auth and no CSRF tokens.
* Using GET for state-changing actions (amplifies CSRF risk).

Detection hints:

* Inspect `settings.py` `MIDDLEWARE` for `CsrfViewMiddleware` and its order (Django notes it should come before middleware that assumes CSRF is handled). ([Django Project][4])
* Search for `csrf_exempt`, `csrf_protect`, `ensure_csrf_cookie`.
* Enumerate URL patterns for non-GET methods; confirm CSRF coverage.

Fix:

* Re-enable `CsrfViewMiddleware`, add CSRF tokens to forms, and add AJAX header handling.
* For caching decorators: if you cache a view that needs CSRF tokens, apply `@csrf_protect` as Django documents to avoid caching a response without CSRF cookie/Vary headers. ([Django Project][4])

Notes:

* When deployed with HTTPS, Django’s CSRF middleware also checks the Referer header for same-origin (Django security docs mention this). ([Django Project][2])

---

### DJANGO-XSS-001: Prevent reflected/stored XSS in templates and HTML generation

Severity: High

Required:

* MUST rely on Django template auto-escaping (safe-by-default) for HTML templates. Django security docs highlight that Django templates escape dangerous characters but have limitations. ([Django Project][2])
* MUST NOT disable auto-escaping broadly (`{% autoescape off %}`) unless the content is trusted or safely sanitized. ([Django Project][5])
* MUST NOT mark untrusted content as safe:

  * Avoid `mark_safe(...)` on user data.
  * Avoid `|safe` on user-controlled content.
* MUST be careful about HTML context pitfalls (e.g., unquoted attributes); Django explicitly shows an example where escaping does not protect an unquoted attribute context. ([Django Project][2])
* SHOULD prefer safe HTML construction helpers (e.g., `format_html`) rather than manual concatenation that risks missing escapes. ([Django Project][6])

Insecure patterns:

* `{% autoescape off %}{{ user_input }}{% endautoescape %}`
* `{{ user_input|safe }}`
* `mark_safe(request.GET["q"])`
* Unquoted attribute injections: `<style class={{ var }}>...` (Django’s own example). ([Django Project][2])

Detection hints:

* Search templates for `|safe`, `autoescape off`, `safeseq`.
* Search Python for `mark_safe`, `SafeString`, or direct HTML concatenation with request/DB values.
* Review any code returning `HttpResponse(user_value)` where `user_value` contains HTML.

Fix:

* Remove unsafe marking; sanitize only when strictly necessary (use an allowlist-based HTML sanitizer).
* Quote attributes and avoid placing untrusted values into dangerous contexts.
* Add CSP as defense-in-depth (see DJANGO-CSP-001). ([Django Project][2])

---

### DJANGO-TEMPLATE-001: Never render untrusted template source strings

Severity: High to Critical (depends on context and exposure)

Required:

* MUST NOT render templates where the template source string is influenced by untrusted input (request, user content, DB rows editable by untrusted users).
* MUST treat “template from string” patterns as dangerous, even if Django templates are more constrained than some other engines: they can still leak data from context, bypass escaping, and create XSS or content injection.

Insecure patterns:

* `Template(request.GET["tmpl"]).render(Context(...))`
* Saving user templates in the DB and rendering them with normal privileges/context.

Detection hints:

* Search for `django.template.Template(`, `Engine.from_string`, `.render(Context(` with non-constant strings.
* Trace where the template string comes from (admin panels, DB, uploads, requests).

Fix:

* Replace with non-executing formatting (e.g., `string.Template`, explicit placeholders) or a strict allowlisted rendering model.
* If you *must* support user-defined templates, isolate heavily (separate service/tenant context, strict allowlists, and assume bypasses are possible).

---

### DJANGO-SQL-001: Prevent SQL injection (use ORM or parameterized raw SQL)

Severity: High

Required:

* MUST use Django ORM/querysets for normal DB access; Django notes querysets are parameterized and protected from SQL injection under typical use. ([Django Project][2])
* MUST be very careful with raw SQL; if using `raw()`, `cursor.execute()`, `extra()`, or `RawSQL`, MUST pass parameters separately (e.g., `params=`) and MUST NOT string-interpolate untrusted input into SQL. Django’s raw SQL docs warn to escape user-controlled parameters using `params`. ([Django Project][7])
* MUST NOT quote placeholders in SQL templates (Django docs explicitly warn that quoting `%s` placeholders makes it unsafe). ([Django Project][8])
* SHOULD avoid `extra()` and `RawSQL` unless necessary; Django security docs call for caution. ([Django Project][2])

Insecure patterns:

* `cursor.execute(f"SELECT ... WHERE id={request.GET['id']}")`
* `Model.objects.raw("... %s" % user_input)` (string formatting)
* `extra(where=[f"headline='{q}'"])`
* Quoted placeholders: `WHERE othercol = '%s'` (explicitly documented as unsafe). ([Django Project][8])

Detection hints:

* Grep for `.raw(`, `.extra(`, `RawSQL(`, `connection.cursor()`, `.execute(`.
* Grep for SQL keywords (`SELECT`, `UPDATE`, `DELETE`, `INSERT`) in Python strings.
* Track untrusted inputs into these call sites.

Fix:

* Prefer ORM queries.
* If raw SQL is unavoidable, use parameters (`params`, DB-API param binding) and do not quote placeholders. ([Django Project][7])

---

### DJANGO-CMD-001: Prevent OS command injection

Severity: Critical to High (depends on exposure)

Required:

* MUST avoid executing system commands with attacker-influenced input.
* If subprocess is necessary:

  * MUST pass args as a list (not a shell string).
  * MUST NOT use `shell=True` with attacker-influenced content.
  * SHOULD use strict allowlists for variable components.
* SHOULD prefer pure-Python libraries instead of shelling out.

Insecure patterns:

* `os.system(request.GET["cmd"])`
* `subprocess.run(f"convert {path}", shell=True)` where `path` is user-controlled.

Detection hints:

* Search `os.system`, `subprocess`, `Popen`, `shell=True`.
* Trace request/DB inputs into those calls.

Fix:

* Replace with library APIs; if unavoidable, hard-code executable and allowlist validated parameters.

---

### DJANGO-UPLOAD-001: File uploads must be validated, stored safely, and served safely

Severity: High

Required:

* MUST treat all user uploads as untrusted. Django explicitly warns “Media files are uploaded by your users. They’re untrusted!” ([Django Project][1])
* MUST ensure the web server never interprets user uploads as executable code (e.g., don’t allow uploaded `.php` or HTML to execute/inline as active content). ([Django Project][1])
* MUST enforce size limits (at least at the web server; Django security docs recommend limiting upload size at the server to prevent DoS). ([Django Project][2])
* SHOULD validate file types using allowlists and content checks (not only extensions).
* SHOULD store uploads outside the application code directory and outside any static root.
* SHOULD consider serving uploads from a separate top-level/second-level domain to reduce same-origin impact; Django security docs recommend a distinct domain and note that a subdomain may be insufficient for some protections. ([Django Project][2])
* MUST be aware of polyglot upload risks: Django documents a case where HTML can be uploaded “as an image” by using a valid PNG header (and may be served as HTML depending on the web server). ([Django Project][2])

Insecure patterns:

* Serving uploads inline with `text/html` or without forcing download for potentially active formats.
* Upload allowlist based only on extension.
* Upload storage inside static roots or code roots.

Detection hints:

* Search for `request.FILES`, `FileField`, `ImageField`, upload forms/views.
* Inspect upload serving paths and Nginx/Apache config (media handlers).
* Check `MEDIA_URL`, `MEDIA_ROOT`, and static config.

Fix:

* Configure the web server to serve uploads as inert bytes (no execution), and consider forcing `Content-Disposition: attachment` for risky types.
* Use a separate domain for user content when warranted. ([Django Project][2])

---

### DJANGO-PATH-001: Prevent path traversal and unsafe file serving (static/media separation)

Severity: High

Required:

* MUST NOT treat user input as a filesystem path for reads/writes/serving.
* MUST keep `MEDIA_ROOT` and `STATIC_ROOT` distinct; Django settings docs explicitly warn they must have different values to avoid security implications. ([Django Project][3])
* SHOULD prefer using Django storage APIs keyed by server-side identifiers rather than accepting arbitrary relative paths from users.

Insecure patterns:

* `open(os.path.join(MEDIA_ROOT, request.GET["path"]))`
* Download endpoints that take `?file=../../...` style parameters.
* Misconfigured `MEDIA_ROOT == STATIC_ROOT`.

Detection hints:

* Grep for `open(`, `Path(`, `os.path.join(` used with request values.
* Check `MEDIA_ROOT`, `STATIC_ROOT` in settings. ([Django Project][3])

Fix:

* Use server-side IDs mapped to known files.
* Keep static and media separated and ensure the web server treats media as untrusted. ([Django Project][3])

---

### DJANGO-REDIRECT-001: Prevent open redirects (`next`, `return_to`, `redirect`)

Severity: Medium (High when combined with auth flows)

Required:

* MUST validate redirect targets derived from untrusted input (e.g., `next`, `return_to`).
* SHOULD restrict to same-site relative paths or allowlisted hosts/schemes.
* SHOULD use Django’s safe URL helpers (e.g., `django.utils.http.url_has_allowed_host_and_scheme`) rather than custom parsing.

Insecure patterns:

* `return redirect(request.GET.get("next"))` with no validation.
* Redirect allowlist implemented with naive string checks.

Detection hints:

* Search for `redirect(` and track origin of the target.
* Search for parameters named `next`, `return_to`, `redirect`, `url`.

Fix:

* Validate with allowlists and default to a safe internal path if validation fails.
* Ensure host validation via `ALLOWED_HOSTS` remains strict (see DJANGO-HOST-001). ([Django Project][3])

---

### DJANGO-HEADERS-001: Enable essential security headers (SecurityMiddleware + clickjacking protection)

Severity: Medium to High

Required:

* SHOULD use `django.middleware.security.SecurityMiddleware` and configure it appropriately (production) for:

  * `X-Content-Type-Options: nosniff` (Django setting `SECURE_CONTENT_TYPE_NOSNIFF`, default `True`). ([Django Project][3])
  * `Referrer-Policy` (Django setting `SECURE_REFERRER_POLICY`, default `'same-origin'`). ([Django Project][3])
  * COOP (Django setting `SECURE_CROSS_ORIGIN_OPENER_POLICY`, default `'same-origin'`). ([Django Project][3])
  * HTTPS redirects and HSTS as appropriate (see DJANGO-HTTPS-001). ([Django Project][3])
* SHOULD enable clickjacking protection via X-Frame-Options middleware; Django security docs strongly recommend it for sites that don’t need third-party framing. ([Django Project][2])

Insecure patterns:

* Missing SecurityMiddleware.
* Missing clickjacking protection (or disabling it globally) without a clear framing requirement.
* Over-broad framing allowances for sensitive endpoints.

Detection hints:

* Inspect `MIDDLEWARE` for SecurityMiddleware and XFrameOptionsMiddleware.
* Search for per-view disabling of framing/CSRF protections.

Fix:

* Add/enable middleware and configure the settings intentionally. ([Django Project][3])

NOTE:

* Some headers may be set at the edge (CDN/reverse proxy). If not visible in app code, flag as “verify at edge”.

---

### DJANGO-CSP-001: Deploy a Content Security Policy (CSP) as defense-in-depth

Severity: Medium (High for apps rendering untrusted content) 

NOTE: It is most important to set the CSP's script-src. All other directives are not as important and can generally be excluded for the ease of development.

Required:

* SHOULD deploy a CSP to mitigate XSS and content injection classes; Django’s security docs recommend CSP and note it is new in Django 6.0. ([Django Project][2])
* MUST understand CSP limitations:

  * Avoid excluding routes from CSP coverage; Django warns that an unprotected page can undermine protected pages due to same-origin policy. ([Django Project][2])
* MAY start with `SECURE_CSP_REPORT_ONLY` to iterate safely (Django provides report-only support). ([Django Project][3])

Insecure patterns:

* No CSP on apps that render user-controlled content.
* CSP excludes “just a couple pages” (weakens overall protection), especially pages with any injection surface. ([Django Project][2])
* CSP uses overly permissive directives (e.g., widespread `unsafe-inline`) without justification.

Detection hints:

* Search `SECURE_CSP`, `SECURE_CSP_REPORT_ONLY`, and CSP middleware configuration.
* Inspect reverse proxy/CDN config for CSP headers.

Fix:

* Implement a realistic CSP, ideally report-only first, then enforce. ([Django Project][3])

---

### DJANGO-AUTH-001: Password storage must use Django’s secure hashers; password policy must be configured

Severity: High

Required:

* MUST use Django’s built-in password hashing (never store plaintext or reversible encrypted passwords).
* SHOULD prefer modern hashers and keep defaults updated; Django documents `PASSWORD_HASHERS` and includes modern options (Argon2, bcrypt, scrypt, PBKDF2 variants). ([Django Project][3])
* SHOULD configure `AUTH_PASSWORD_VALIDATORS` (default is empty) for production password policy. ([Django Project][3])

Insecure patterns:

* Custom password storage or hashing.
* Plaintext passwords stored in DB fields.
* No password validation on consumer-facing apps.

Detection hints:

* Search for `.set_password(` usage vs manual hashing.
* Inspect settings for `PASSWORD_HASHERS` and `AUTH_PASSWORD_VALIDATORS`. ([Django Project][3])

Fix:

* Use Django auth user model APIs.
* Enable password validators appropriate to the product’s risk profile. ([Django Project][3])

---

### DJANGO-AUTHZ-001: Authorization must be explicit and consistent

Severity: High

Required:

* MUST enforce authorization checks on every privileged action (view, modify, admin-like operations).
* MUST NOT rely on UI-only restrictions (e.g., hiding buttons) without server-side permission checks.
* SHOULD use Django’s permissions/groups and per-object authorization patterns where applicable.

Insecure patterns:

* Views that assume “user is logged in” implies “user may do action”.
* Missing authorization checks on update/delete endpoints.

Detection hints:

* Enumerate views that modify state; ensure they validate ownership/permission.
* Look for use of only `is_authenticated` or only `is_staff` without checking object-level access.

Fix:

* Add explicit permission checks and tests for unauthorized access.

---

### DJANGO-ADMIN-001: Django admin must be treated as a high-value target

Severity: High

Required:

* MUST ensure admin is protected by strong authentication and HTTPS-only transport (see DJANGO-HTTPS-001). ([Django Project][1])
* SHOULD restrict admin exposure (network allowlists, VPN, SSO, or additional authentication controls) when possible.
* SHOULD audit installed admin extensions and third-party apps for XSS/CSRF exposure.

Insecure patterns:

* Admin exposed to the internet with weak authentication.
* Admin served over HTTP.

Detection hints:

* Search `urlpatterns` for `admin.site.urls`.
* Check deployment config for IP allowlisting or auth gateways.

Fix:

* Add network controls and enforce HTTPS.

---

### DJANGO-LOG-001: Logging and error reporting must not leak secrets

Severity: Medium to High

Required:

* MUST NOT log secrets (including `SECRET_KEY`, session cookies, auth headers, password reset tokens).
* MUST configure production logging deliberately; Django’s deployment checklist explicitly calls out reviewing logging before production. ([Django Project][1])
* MUST ensure `DEBUG=False` in production so exceptions aren’t rendered with sensitive context. ([Django Project][1])

Insecure patterns:

* Logging full request headers or cookies in production.
* Printing settings dictionaries.
* Debug error pages.

Detection hints:

* Inspect `LOGGING` config; search for middleware that logs request headers/cookies.
* Grep for `print(settings` / `logging.info(request.META)` patterns.

Fix:

* Redact sensitive values; log IDs not secrets.
* Use structured logging and a safe error monitoring tool. ([Django Project][1])

---

### DJANGO-SUPPLY-001: Dependency and patch hygiene (Django + security-critical deps)

Severity: Medium (High if known vulnerable versions)

Required:

* SHOULD pin and regularly update Django and security-critical dependencies.
* MUST respond to Django security releases promptly.

Detection hints:

* Check `requirements.txt`, lockfiles, build images.
* Identify Django version; compare against latest supported release (Django’s download page publishes current stable and supported branches). ([Django Project][9])

Fix:

* Upgrade to patched versions; add regression tests for previously vulnerable classes.

---

## 5) Practical scanning heuristics (how to “hunt”)

When actively scanning, use these high-signal patterns:

* Deployment/dev server:

  * `manage.py runserver`, `runserver 0.0.0.0`, `--insecure` ([Django Project][1])
* Debug / settings:

  * `DEBUG = True` ([Django Project][1])
  * `SECRET_KEY =`, `SECRET_KEY_FALLBACKS` ([Django Project][1])
* Host validation:

  * `ALLOWED_HOSTS = ['*']` ([Django Project][3])
* HTTPS and proxy:

  * `SECURE_SSL_REDIRECT`, `SECURE_HSTS_SECONDS`, `SECURE_PROXY_SSL_HEADER` ([Django Project][3])
* Cookies / sessions:

  * `SESSION_COOKIE_SECURE`, `SESSION_COOKIE_HTTPONLY`, `SESSION_COOKIE_SAMESITE` ([Django Project][3])
  * `CSRF_COOKIE_SECURE`, `CSRF_COOKIE_HTTPONLY`, `CSRF_COOKIE_SAMESITE` ([Django Project][3])
* CSRF bypasses:

  * `csrf_exempt`, missing `CsrfViewMiddleware`, POST forms without `{% csrf_token %}` ([Django Project][4])
* XSS:

  * `|safe`, `autoescape off`, `mark_safe(`, HTML string concatenation ([Django Project][5])
* SQL injection:

  * `.raw(`, `.extra(`, `RawSQL(`, `cursor.execute(` with formatted SQL strings ([Django Project][7])
* User uploads / media:

  * `request.FILES`, `MEDIA_ROOT`, `MEDIA_URL`, serving media inline; `MEDIA_ROOT == STATIC_ROOT` ([Django Project][1])
* Redirects:

  * `redirect(request.GET.get("next"))` patterns; missing allowlist validation
* Security headers and CSP:

  * Missing `SecurityMiddleware`, missing X-Frame-Options protection, missing `SECURE_CSP` adoption (where appropriate) ([Django Project][2])

Always try to confirm:

* data origin (untrusted vs trusted)
* sink type (template/SQL/subprocess/files/redirect/http)
* protective controls present (middleware, validation, allowlists, authz checks)
* whether security headers/controls are set in-app vs at the edge

---

## 6) Sources (accessed 2026-01-27)

Primary Django documentation:

```text
- Django Downloads (current stable & supported branches): https://www.djangoproject.com/download/
- Django 6.0 Release Notes: https://docs.djangoproject.com/en/6.0/releases/6.0/
- Django: Deployment checklist (incl. check --deploy, runserver warning, HTTPS/cookies guidance): https://docs.djangoproject.com/en/6.0/howto/deployment/checklist/
- Django: Settings reference (SecurityMiddleware settings, cookies, SECRET_KEY_FALLBACKS, CSP settings): https://docs.djangoproject.com/en/6.0/ref/settings/
- Django: Security in Django (XSS/CSRF/SQLi/clickjacking/HTTPS/host header validation/uploads/CSP): https://docs.djangoproject.com/en/6.0/topics/security/
- Django: CSRF how-to (middleware, csrf_token usage, AJAX header patterns, csrf_exempt cautions): https://docs.djangoproject.com/en/6.0/howto/csrf/
- Django: Performing raw SQL queries (parameterization guidance): https://docs.djangoproject.com/en/6.0/topics/db/sql/
- Django: QuerySet API reference (extra() cautions; “do not quote placeholders” guidance): https://docs.djangoproject.com/en/6.0/ref/models/querysets/
- Django: Template built-ins (autoescape tag): https://docs.djangoproject.com/en/6.0/ref/templates/builtins/
- Django: Template language reference (turning off autoescape & risks): https://docs.djangoproject.com/en/6.0/ref/templates/language/
- Django: Utilities reference (e.g., format_html): https://docs.djangoproject.com/en/6.0/ref/utils/
```

OWASP:

```text
- OWASP Cheat Sheet Series: Django Security Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Django_Security_Cheat_Sheet.html
```

[1]: https://docs.djangoproject.com/en/6.0/howto/deployment/checklist/ "https://docs.djangoproject.com/en/6.0/howto/deployment/checklist/"
[2]: https://docs.djangoproject.com/en/6.0/topics/security/ "Security in Django | Django documentation | Django"
[3]: https://docs.djangoproject.com/en/6.0/ref/settings/ "Settings | Django documentation | Django"
[4]: https://docs.djangoproject.com/en/6.0/howto/csrf/ "How to use Django’s CSRF protection | Django documentation | Django"
[5]: https://docs.djangoproject.com/en/6.0/ref/templates/builtins/ "https://docs.djangoproject.com/en/6.0/ref/templates/builtins/"
[6]: https://docs.djangoproject.com/en/6.0/ref/utils/ "https://docs.djangoproject.com/en/6.0/ref/utils/"
[7]: https://docs.djangoproject.com/en/6.0/topics/db/sql/ "https://docs.djangoproject.com/en/6.0/topics/db/sql/"
[8]: https://docs.djangoproject.com/en/6.0/ref/models/querysets/ "https://docs.djangoproject.com/en/6.0/ref/models/querysets/"
[9]: https://www.djangoproject.com/download/ "Download Django | Django"
