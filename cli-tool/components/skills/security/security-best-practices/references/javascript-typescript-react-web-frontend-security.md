# React (JavaScript/TypeScript) Web Security Spec (React 19.x, TypeScript 5.x)

This document is designed as a **security spec** that supports:

1. **Secure-by-default code generation** for new React code.
2. **Security review / vulnerability hunting** in existing React code (passive “notice issues while working” and active “scan the repo and report findings”).

It is intentionally written as a set of **normative requirements** (“MUST/SHOULD/MAY”) plus **audit rules** (what bad patterns look like, how to detect them, and how to fix/mitigate them).

---

## 0) Safety, boundaries, and anti-abuse constraints (MUST FOLLOW)

* MUST NOT request, output, log, or commit secrets (API keys, OAuth client secrets, private keys, session cookies, JWTs, signing keys).

  * Frontend note: anything shipped to the browser is observable by end users and attackers (view-source, devtools, proxies); never treat client code or “env vars in the bundle” as secret. ([create-react-app.dev][1])
* MUST NOT “fix” security by disabling protections (e.g., turning off CSP to “make it work”, adding `unsafe-inline`/`unsafe-eval` without a documented, constrained plan, disabling CSRF protections when using cookies, widening CORS, skipping sanitization, or “temporary” bypasses that ship). ([OWASP Cheat Sheet Series][2])
* MUST provide **evidence-based findings** during audits: cite file paths, code snippets, and configuration values that justify the claim.
* MUST treat uncertainty honestly: if a protection might exist in infra (CDN/WAF/reverse proxy), report it as “not visible in app code; verify via runtime headers / edge config”.
* MUST assume any data that crosses a trust boundary (URL, storage, network, postMessage, third-party scripts) can be attacker-influenced unless proven otherwise (see §2.1).

---

## 1) Operating modes

### 1.1 Generation mode (default)

When asked to write new React code or modify existing code:

* MUST follow every **MUST** requirement in this spec.
* SHOULD follow every **SHOULD** requirement unless the user explicitly says otherwise.
* MUST prefer safe-by-default APIs and proven libraries over custom security code.
* MUST avoid introducing new risky sinks (raw HTML insertion, direct DOM sinks like `innerHTML`, dynamic code execution, untrusted redirects/navigation, third‑party script injection, unsafe token storage, etc.). ([MDN Web Docs][3])

### 1.2 Passive review mode (always on while editing)

While working anywhere in a React repo (even if the user did not ask for a security scan):

* MUST “notice” violations of this spec in touched/nearby code.
* SHOULD mention issues as they come up, with a brief explanation + safe fix.

### 1.3 Active audit mode (explicit scan request)

When the user asks to “scan”, “audit”, or “hunt for vulns”:

* MUST systematically search the codebase for violations of this spec.
* MUST output findings in a structured format (see §2.3).

Recommended audit order:

1. App entrypoints, build tooling (Vite/Webpack/CRA/Next), deployment configs, CDN/static hosting config.
2. Secrets & configuration exposure (env vars, runtime config injection, source maps).
3. Rendering of untrusted data (XSS/DOM XSS), especially `dangerouslySetInnerHTML`, markdown/HTML renderers, URL attributes.
4. Direct DOM usage and dangerous JS execution (`innerHTML`, `eval`, `new Function`, `document.write`, etc.).
5. Auth & session patterns (token storage, cookies, CSRF interactions, OAuth flows).
6. Network layer (axios/fetch wrappers, dynamic base URLs, credentialed requests, data exfil risks).
7. Navigation & redirect handling (open redirects, `window.location`, `target=_blank`, `window.open`).
8. Third-party scripts/tags/analytics and integrity controls (CSP, SRI).
9. Service worker/PWA behavior (HTTPS, caching rules, update strategy).
10. Security headers posture (CSP, clickjacking, nosniff, referrer policy) in app or at the edge. ([OWASP Cheat Sheet Series][2])

---

## 2) Definitions and review guidance

### 2.1 Untrusted input (treat as attacker-controlled unless proven otherwise)

Examples include:

* URL-derived data: `window.location`, query params, hash fragments, route params.
* Any data from browser storage: `localStorage`, `sessionStorage`, `IndexedDB` (including data previously written by the app—because XSS or extensions can tamper with it). ([OWASP Cheat Sheet Series][4])
* Any data from cross-window messaging: `window.postMessage` payloads. ([OWASP Cheat Sheet Series][4])
* Any data from remote APIs, webhooks proxied to the client, GraphQL responses, CMS content, feature flag services.
* Any persisted user content (profiles, comments, rich text, markdown) rendered in the UI.
* Any data produced by third-party scripts or tag managers (treat as untrusted unless strongly controlled). ([OWASP Cheat Sheet Series][5])

### 2.2 State-changing request (frontend perspective)

A request is state-changing if it can create/update/delete data, change auth/session state, trigger side effects (purchase, email send, webhook), or initiate privileged actions.

Frontend-specific note:

* State changes are often triggered by `fetch/axios` calls or form submissions. If authentication is cookie-based, these calls can be CSRF-relevant (§4 REACT-CSRF-001). ([OWASP Cheat Sheet Series][6])

### 2.3 Required audit finding format

For each issue found, output:

* Rule ID:
* Severity: Critical / High / Medium / Low
* Location: file path + component/function + line(s)
* Evidence: the exact code/config snippet
* Impact: what could go wrong, who can exploit it
* Fix: safe change (prefer minimal diff)
* Mitigation: defense-in-depth if immediate fix is hard
* False positive notes: what to verify if uncertain

---

## 3) Secure baseline: minimum production configuration (MUST in production)

This is the smallest “production baseline” that prevents common React frontend misconfigurations.

### 3.1 Production build and configuration hygiene (MUST)

* MUST ship a production build (minified, no dev-only overlays/tools, correct mode flags).
* MUST ensure build-time configuration does not embed secrets into the shipped JS/HTML/CSS. Build-time “environment variables” are not secret; treat them as public. ([create-react-app.dev][1])
* SHOULD treat source maps as sensitive operational artifacts:

  * Either don’t publish them publicly, or publish them only where intended (e.g., behind auth or to an error-reporting provider), because they can reveal code structure and internal URLs.

### 3.2 Browser-enforced protections (SHOULD, but baseline expectation for modern apps)

* SHOULD deploy a CSP as defense-in-depth against XSS, and keep it compatible with your React build (avoid `unsafe-inline` and `unsafe-eval` unless strictly necessary and documented). ([OWASP Cheat Sheet Series][2])
* SHOULD use Subresource Integrity (SRI) for any third-party script/style loaded from a CDN (or self-host instead). ([MDN Web Docs][7])
* SHOULD enable clickjacking defenses via `frame-ancestors` (CSP) and/or `X-Frame-Options`, unless embedding is an explicit product requirement. ([MDN Web Docs][8])

### 3.3 High-risk features baseline (MUST if used)

* If rendering any user-provided HTML/markdown/rich text:

  * MUST sanitize before insertion and avoid raw DOM sinks. ([OWASP Cheat Sheet Series][9])
* If using service workers / PWA:

  * MUST serve over HTTPS and implement a safe caching/update strategy (service workers are powerful request/response proxies). ([MDN Web Docs][10])

---

## 4) Rules (generation + audit)

Each rule contains: required practice, insecure patterns, detection hints, and remediation.

### REACT-CONFIG-001: Never embed secrets in the client bundle (env vars are public)

Severity: Critical (if secrets exposed)

Required:

* MUST NOT place secrets in React code, in `public/` assets, or in build-time environment variables intended for client consumption.
* MUST assume any value available to the React app at runtime can be extracted by an attacker.

Insecure patterns:

* Using build-time env vars for secrets:

  * `process.env.REACT_APP_*` containing private keys or credentials.
  * `import.meta.env.VITE_*` containing secrets.
* Hard-coded secrets in JS/TS, `.env` committed, or secrets in `public/config.json` served to all users.

Detection hints:

* Search for:

  * `REACT_APP_`, `VITE_`, `NEXT_PUBLIC_`, `process.env.`, `import.meta.env.`
  * `apiKey`, `secret`, `token`, `private`, `password`, `client_secret`
* Inspect `public/` for runtime config JSON.

Fix:

* Move secrets server-side (API, BFF, serverless function).
* Use a backend to mint short-lived, scoped tokens if the browser needs to call third-party APIs.

Notes:

* CRA explicitly warns not to store secrets and notes env vars are embedded into the build and visible to anyone inspecting files. ([create-react-app.dev][1])
* Vite explicitly notes that variables exposed to client code end up in the client bundle and should not contain sensitive info. ([vitejs][11])

---

### REACT-XSS-001: Do not use `dangerouslySetInnerHTML` with untrusted content (sanitize or avoid)

Severity: High (Only if you can prove attacker-controlled HTML reaches it)

Required:

* MUST avoid `dangerouslySetInnerHTML` unless absolutely necessary.
* If it must be used:

  * MUST sanitize untrusted HTML with a proven sanitizer (e.g., DOMPurify) and an allowlist-oriented configuration.
  * MUST keep the sanitization logic centralized and heavily reviewed.
  * SHOULD add a CSP and consider Trusted Types (see REACT-TT-001).

Insecure patterns:

* `<div dangerouslySetInnerHTML={{ __html: userHtml }} />` where `userHtml` is from API/URL/storage.
* “Sanitization” done with regexes, ad-hoc stripping, or incomplete allowlists.

Detection hints:

* Grep: `dangerouslySetInnerHTML`, `__html:`
* Trace the origin of the HTML string (API/CMS/URL/localStorage).

Fix:

* Replace with safe rendering:

  * Render structured data as React elements/components instead of HTML strings.
  * If rich text is required, sanitize with DOMPurify (or equivalent) and render the sanitized output.
* Add CSP; remove dangerous sinks where possible.

Notes:

* React explicitly warns that `dangerouslySetInnerHTML` is dangerous and can introduce XSS if misused. ([React][12])
* OWASP explicitly calls out React’s `dangerouslySetInnerHTML` without sanitization as a common framework “escape hatch” pitfall. ([OWASP Cheat Sheet Series][9])
* DOMPurify describes itself as an XSS sanitizer for HTML/SVG/MathML. ([GitHub][13])

---

### REACT-XSS-002: Rely on React’s escaping-by-default behavior; do not bypass it

Severity: High (when bypassed)

Required:

* MUST render untrusted strings via normal JSX interpolation (`{value}`) and React props, which are escaped by default.
* MUST NOT build HTML strings from untrusted data and then inject them into the DOM via any means.
* SHOULD treat any “escape hatch” as high risk and require review.

Insecure patterns:

* Converting untrusted text into HTML and injecting it:

  * `element.innerHTML = userValue`
  * `document.write(userValue)`
  * `insertAdjacentHTML(..., userValue)`

Detection hints:

* Grep for DOM sinks: `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `DOMParser`, `createContextualFragment`.

Fix:

* Render text content through React (JSX) so it is escaped.
* If you truly need HTML, sanitize and apply REACT-XSS-001 + REACT-TT-001.

Notes:

* React documentation (JSX) states that React DOM escapes values embedded in JSX before rendering to help prevent injection attacks. ([React][14])

---

### REACT-DOM-001: Avoid DOM XSS injection sinks in React code (use safe alternatives)

Severity: High

Required:

* MUST avoid direct DOM injection sinks, even outside React rendering, unless strongly controlled.
* If a DOM sink is required:

  * MUST ensure inputs are trusted/validated/sanitized.
  * SHOULD enforce Trusted Types (REACT-TT-001).

Insecure patterns:

* `someEl.innerHTML = untrusted`
* `document.write(untrusted)`
* `new DOMParser().parseFromString(untrusted, 'text/html')` followed by insertion

Detection hints:

* Grep for: `innerHTML`, `outerHTML`, `document.write`, `DOMParser`, `Range().createContextualFragment`, `insertAdjacentHTML`

Fix:

* Prefer:

  * `textContent` for text insertion.
  * React rendering rather than manual DOM manipulation.
  * A vetted sanitizer for any required HTML parsing.

Notes:

* Trusted Types documentation defines HTML sinks like `Element.innerHTML` and `document.write()` as injection sinks that can execute script when given attacker-controlled input. ([MDN Web Docs][3])
* OWASP HTML5 guidance recommends using `textContent` instead of `innerHTML` for assigning untrusted data. ([OWASP Cheat Sheet Series][4])

---

### REACT-URL-001: Validate and constrain untrusted URLs used in `href`, `src`, navigation, and redirects

Severity: High Only when you can prove they are attacker controlled

Required:

* MUST treat any URL derived from untrusted input as dangerous.
* MUST allowlist schemes and (when applicable) hosts:

  * Typically allow only `https:` (and maybe `http:` for localhost/dev) and relative URLs for in-app navigation.
  * MUST explicitly block `javascript:` and dangerous `data:` uses unless you have specialized validation and a clear use case.
* SHOULD prefer same-site relative paths (e.g., `/settings`) over absolute URLs.
* MUST validate “returnTo/next/redirect” parameters (see REACT-REDIRECT-001).

Insecure patterns:

* `<img src={userProvidedUrl}>...` (can be used for tracking / data exfil; also risky if used for scripts/iframes)
* `window.location = next`
* `navigate(next)` where `next` comes from query params without validation

Detection hints:

* Search for:

  * `href={`, `src={`, `window.location`, `location.href`, `window.open`, `navigate(`, `redirectTo`, `returnTo`, `next=`
* Track whether the value is derived from URL/query/storage/API.

Fix:

* Implement a shared `safeUrl()` utility:

  * Parse with `new URL(value, base)`
  * Enforce scheme allowlist and host allowlist (or enforce same-origin)
  * For redirects: allow only relative paths (starting with `/`) or a strict allowlist of absolute origins.
* Fall back to a safe default when validation fails.

Notes:

* OWASP explicitly notes React’s `dangerouslySetInnerHTML` risk and also states React cannot safely handle `javascript:` or `data:` URLs without specialized validation. ([OWASP Cheat Sheet Series][9])

---

### REACT-MARKUP-001: Markdown / rich text rendering must be configured safely

Severity: Medium

Required:

* MUST assume markdown/rich text can be attacker-controlled if it comes from users or CMS.
* MUST ensure raw HTML is not rendered unless sanitized.
* SHOULD prefer markdown renderers that:

  * Do not allow raw HTML by default, or
  * Can be configured to disallow raw HTML, or
  * Sanitize HTML output before rendering.

Insecure patterns:

* Markdown rendering with “raw HTML passthrough” enabled (e.g., options/plugins that allow HTML).
* Rendering user-provided SVG/MathML/HTML inline without sanitization.

Detection hints:

* Search for common libraries and risky options:

  * `marked`, `markdown-it`, `react-markdown`, `rehype-raw`, `sanitize: false`, `allowDangerousHtml`, etc.
* Look for `dangerouslySetInnerHTML` used with “markdown output”.

Fix:

* Disable raw HTML passthrough.
* Sanitize output with a proven sanitizer (e.g., DOMPurify) before rendering.

Notes:

* OWASP XSS guidance emphasizes that framework escape hatches require output encoding and/or HTML sanitization. ([OWASP Cheat Sheet Series][9])

---

### REACT-TT-001: Use Trusted Types (with CSP) to harden DOM XSS sinks where feasible

Severity: Low

Required:

* SHOULD consider enabling Trusted Types in report-only mode first, then enforce once violations are addressed.
* SHOULD centralize Trusted Types policies and treat them as high-risk code requiring review.
* MUST NOT create permissive policies that simply “pass through” untrusted strings.

Insecure patterns:

* A Trusted Types policy that returns the raw string without sanitization for HTML sinks.
* Many scattered policies across the codebase (hard to audit).

Detection hints:

* Search for:

  * `trustedTypes.createPolicy`
  * CSP directives: `require-trusted-types-for`, `trusted-types`
* Search for remaining DOM sinks (REACT-DOM-001).

Fix:

* Implement a small number of tightly scoped policies:

  * HTML policy uses sanitizer (DOMPurify or equivalent).
  * Script URL policy uses strict allowlists.
* Run in report-only mode, fix violations, then enforce.

Notes:

* MDN describes Trusted Types as a way to ensure input is transformed (commonly sanitized) before being passed to injection sinks, and highlights HTML sinks (`innerHTML`, `document.write`) and JS URL sinks (`script.src`). ([MDN Web Docs][3])
* The W3C Trusted Types spec frames this as reducing DOM XSS risk by locking down sinks to typed values created by reviewed policies. ([W3C][15])

---

### REACT-CSP-001: Deploy and maintain a CSP as defense-in-depth (especially when rendering untrusted content)

Severity: Medium to High

Required:

* SHOULD deploy CSP in production; MUST do so for apps that render untrusted content or integrate third-party scripts.
* SHOULD avoid `unsafe-inline` and `unsafe-eval` when possible.
* SHOULD use CSP nonces/hashes for inline scripts if needed, and keep policy realistic.
* SHOULD use CSP to require/encourage SRI where appropriate.

Insecure patterns:

* No CSP at all on the app shell (SPA entry HTML).
* CSP that relies on `unsafe-inline`/`unsafe-eval` broadly without justification.
* `script-src *` or overly broad sources.

Detection hints:

* Look for CSP configuration:

  * Server/CDN config, headers in `index.html` responses, or framework config.
* If absent in repo, mark as “verify at edge”.

Fix:

* Add CSP via HTTP response headers (preferred).
* Start with report-only to reduce breakage, then enforce.

Notes:

* OWASP describes CSP as “defense in depth” against XSS and notes it can help enforce SRI even on static sites, but should not be the only defense. ([OWASP Cheat Sheet Series][2])

---

### REACT-SRI-001: Use Subresource Integrity (SRI) for third-party scripts and styles (or self-host)

Severity: Low

Required:

* MUST treat third-party JS as equivalent to running arbitrary code in your origin.
* If loading from a CDN or third party:

  * SHOULD use SRI (`integrity=...`) and `crossorigin` where applicable.
  * SHOULD pin exact versions (avoid “latest” URLs).
  * SHOULD prefer self-hosting for critical code.

Insecure patterns:

* `<script src="https://cdn.example.com/lib/latest.js"></script>` with no integrity.
* Tag managers that dynamically load arbitrary scripts without governance.

Detection hints:

* Search in `public/index.html`, templates, or SSR wrappers for:

  * `<script src=`, `<link rel="stylesheet" href=`
  * Tag manager snippets (GTM, Segment, etc.)
* Identify scripts loaded dynamically in runtime JS.

Fix:

* Add SRI hashes for stable third-party assets or self-host.
* Apply governance controls for tag managers (see REACT-3P-001).

Notes:

* MDN describes SRI as a security feature enabling browsers to verify fetched resources (e.g., from a CDN) haven’t been manipulated by checking a cryptographic hash. ([MDN Web Docs][7])
* OWASP CSP guidance notes CSP can enforce SRI and is useful even on static sites. ([OWASP Cheat Sheet Series][2])

---

### REACT-3P-001: Third-party JavaScript and tag managers must be minimized and governed

Severity: High

Required:

* MUST minimize third-party scripts and treat each as a supply-chain risk.
* MUST know exactly what third-party JS executes in your origin and why.
* SHOULD implement governance:

  * Review and pin versions (or mirror in-house).
  * Restrict data access (data-layer approach).
  * Use SRI and CSP; consider sandboxing untrusted UI in iframes where possible.

Insecure patterns:

* Unreviewed analytics/ads scripts running with full access to DOM, cookies, storage, and user data.
* Tag managers that can be changed by non-engineering roles with no change control.

Detection hints:

* Search for common vendor snippets in HTML/JS:

  * GTM, Segment, Hotjar, FullStory, etc.
* Look for dynamic script insertion:

  * `document.createElement('script')`, `.src = ...`, `.appendChild(script)`

Fix:

* Reduce to only necessary vendors.
* Where feasible:

  * Self-host or mirror scripts.
  * Use SRI.
  * Limit data exposure via a controlled data layer.

Notes:

* OWASP notes third-party JS server compromise can inject malicious JS, and highlights risks like arbitrary code execution and disclosure of sensitive info to third parties. ([OWASP Cheat Sheet Series][5])

---

### REACT-AUTH-001: Token and session handling must be resilient to XSS (avoid sensitive storage in Web Storage)

Severity: Medium

Required:

* SHOULD avoid storing session identifiers or long-lived tokens in `localStorage` (and generally in Web Storage) because XSS can exfiltrate them.
* If tokens must exist client-side:

  * SHOULD prefer in-memory storage with short lifetimes and refresh mechanisms.
  * MUST scope and rotate tokens; avoid long-lived bearer tokens in persistent storage.
* SHOULD prefer HTTPOnly cookies for session tokens when possible (requires CSRF strategy: see REACT-CSRF-001).

Insecure patterns:

* `localStorage.setItem('token', ...)` / `sessionStorage.setItem('token', ...)` for auth tokens.
* Persisting refresh tokens in `localStorage`.
* Treating data from Web Storage as trusted.

Detection hints:

* Grep for: `localStorage.`, `sessionStorage.`, `setItem(`, `getItem(`, `token`, `jwt`, `refresh`
* Search auth code for “remember me” storing tokens persistently.

Fix:

* Move to HTTPOnly cookies (server change) + CSRF protections, or use short-lived in-memory tokens.
* Reduce token scope and lifetime.

Notes:

* OWASP HTML5 guidance recommends avoiding sensitive info and session identifiers in local storage and warns that a single XSS can steal all data in Web Storage. ([OWASP Cheat Sheet Series][4])
* OAuth browser-based apps guidance discusses that tokens stored in persistent browser storage like localStorage can be accessible to malicious JS (e.g., via XSS). ([IETF Datatracker][16])

---

### REACT-CSRF-001: Cookie-authenticated, state-changing requests MUST be CSRF-protected

Severity: High

NOTE: If the application does not use cookie based auth (using Authentication header for example), then CSRF is not a concern.

Required:

* If the app relies on cookies for authentication:

  * MUST protect state-changing requests (POST/PUT/PATCH/DELETE) against CSRF.
  * SHOULD include a CSRF token mechanism (synchronizer token or double-submit cookie) or other robust pattern appropriate to the backend.
  * SHOULD use SameSite cookies as defense-in-depth, not as the sole defense.

Insecure patterns:

* `fetch('/api/transfer', { method: 'POST', credentials: 'include' })` with no CSRF token/header, relying only on cookies.
* Using GET for state-changing operations.

Detection hints:

* Enumerate state-changing network calls and check:

  * Is `credentials: 'include'` or `withCredentials: true` used?
  * Is a CSRF token header included (e.g., `X-CSRF-Token`)?
* Search for “csrf” utilities; if absent, treat as suspicious.

Fix:

* Add CSRF token flow:

  * Fetch token from a safe endpoint and attach to state-changing requests.
  * Validate server-side.
* Keep SameSite cookies and Origin/Referer validation as defense-in-depth.

Notes:

* OWASP CSRF guidance explains SameSite behavior (Lax/Strict/None) as a defense-in-depth technique and why Lax is often the usability/security balance, but it is not a complete substitute for CSRF protections. ([OWASP Cheat Sheet Series][6])

---

### REACT-AUTHZ-001: Do not rely on frontend-only authorization

Severity: High (only if used as primary protection)

Required:

* MUST treat all frontend authorization checks as UX only.
* MUST enforce authorization on the server for any protected resource or action.

Insecure patterns:

* “Protected” actions hidden in UI but callable by API without server checks.
* Client checks like `if (user.isAdmin) { showAdminPanel(); }` with no server-side enforcement.

Detection hints:

* Look for UI gating around sensitive actions and verify server endpoints enforce authorization.
* In a frontend-only audit, report as “client checks are not security; verify backend”.

Fix:

* Add/confirm server-side authorization checks.
* Keep frontend gating only as convenience.

Notes:

* This is a general web app security property; React cannot protect server resources by itself.

---

### REACT-NET-001: Prevent data exfiltration and credential leakage via dynamic outbound requests

Severity: Medium to High

Required:

* MUST avoid making authenticated requests to attacker-controlled origins.
* SHOULD avoid allowing user input to control request destination (scheme/host/port).
* SHOULD centralize network clients (fetch/axios) with:

  * fixed `baseURL` (or strict allowlist),
  * strict handling of redirects,
  * explicit `credentials` usage.

Insecure patterns:

* `fetch(userProvidedUrl, { credentials: 'include' })`
* `axios.create({ baseURL: userProvidedBase })`
* “URL fetch/preview” features in the client that hit arbitrary domains with sensitive headers.

Detection hints:

* Search for `fetch(` / `axios(` where the first argument or `baseURL` is derived from:

  * query params, localStorage, API responses, postMessage
* Search for `credentials: 'include'`, `withCredentials: true`.

Fix:

* Enforce destination allowlists; disallow cross-origin requests unless explicitly required.
* Strip credentials/Authorization headers for any non-allowlisted destination.

Notes:

* Even if the browser limits some cross-origin behavior, leaking tokens/headers to untrusted endpoints is still a common failure mode.

---

### REACT-REDIRECT-001: Prevent open redirects and untrusted navigation

Severity: Medium

Required:

* MUST validate redirect/navigation targets derived from untrusted input (`next`, `returnTo`, `redirect`).
* SHOULD only allow same-site relative paths, or a strict allowlist of trusted origins for absolute URLs.

Insecure patterns:

* `window.location.href = new URLSearchParams(location.search).get('next')`
* `navigate(next)` where `next` comes from query params.

Detection hints:

* Search for: `next`, `returnTo`, `redirect`, `window.location`, `navigate(`
* Trace origin of the redirect target.

Fix:

* Only allow relative paths (`/^\/[^\s]*$/`) or allowlisted origins.
* Fall back to a safe default (e.g., `/`) when invalid.

Notes:

* Open redirects are frequently used in phishing and can undermine SSO/OAuth flows.

---

### REACT-SW-001: Service workers are high-privilege; require HTTPS and safe caching/update rules

Severity: Medium

Required:

* MUST serve service workers over HTTPS (except `localhost` dev), and deploy only in secure contexts.
* MUST avoid caching sensitive authenticated API responses unless explicitly designed and threat-modeled.
* SHOULD implement safe update strategy (prompt reload, versioned caches, remove old caches on activate).

Insecure patterns:

* Registering a service worker for an authenticated app and caching “everything” indiscriminately.
* Long-lived caches containing PII or user-specific content shared across accounts.

Detection hints:

* Search for:

  * `navigator.serviceWorker.register`
  * `workbox`, `precacheAndRoute`, custom `fetch` handlers
* Inspect caching patterns (`caches.open`, `cache.put`, `respondWith`).

Fix:

* Restrict caching to static assets only (JS/CSS/images) unless you have a designed offline model.
* Ensure cache keys are user-scoped if user-specific data must be cached.
* Provide a clear update mechanism.

Notes:

* MDN notes service workers require HTTPS for security reasons and act like a proxy for requests/responses. ([MDN Web Docs][10])
* “Secure contexts” exist to prevent MITM attackers from accessing powerful APIs; service workers are an example of such a powerful feature. ([MDN Web Docs][18])

---

### REACT-HEADERS-001: Ensure essential security headers are set for the React app shell (app or edge)

Severity: Medium

Required (typical SPA served from an origin):

* SHOULD set:

  * CSP (`Content-Security-Policy`)
  * `X-Content-Type-Options: nosniff`
  * Clickjacking protection (`frame-ancestors` in CSP and/or `X-Frame-Options`)
  * `Referrer-Policy`
  * `Permissions-Policy` as appropriate
* MUST ensure these are set somewhere (CDN/edge/server), even if not in repo.

Insecure patterns:

* No security headers anywhere (app or edge).
* CSP missing on apps that render untrusted content or use third-party scripts.

Detection hints:

* Check server/CDN config in repo (nginx, Cloudflare, Vercel config, etc.).
* If absent, flag as “verify at runtime/edge”.

Fix:

* Set headers centrally at the edge.
* Keep CSP realistic and iterative (report-only → enforce).

Notes:

* MDN clickjacking guidance discusses defenses including `X-Frame-Options` and CSP `frame-ancestors`. ([MDN Web Docs][8])
* OWASP CSP guidance explains delivery via response headers and recommends headers as the preferred mechanism. ([OWASP Cheat Sheet Series][2])

---

### REACT-POSTMSG-001: `postMessage` must validate origin and treat payload as untrusted data

Severity: Medium to High (depends on what messages can do)

Required:

* MUST specify exact `targetOrigin` when sending messages (not `*`) unless there is a strict reason.
* MUST validate `event.origin` on receipt and validate message shape.
* MUST NOT evaluate message data as code or insert it into the DOM as HTML.

Insecure patterns:

* `window.postMessage(data, '*')` to unknown targets.
* Receiving:

  * `window.addEventListener('message', (e) => { eval(e.data) })`
  * `element.innerHTML = e.data`

Detection hints:

* Search: `postMessage(`, `addEventListener('message'`
* Check for origin checks and safe handling.

Fix:

* Add strict origin allowlists and schema validation (e.g., zod).
* Treat message payload strictly as data; render safely via React.

Notes:

* OWASP HTML5 guidance recommends specifying expected origin for `postMessage`, checking sender origin, validating data, and avoiding eval/innerHTML with message content. ([OWASP Cheat Sheet Series][4])

---

### REACT-FILE-001: File uploads and previews must not create client-side active content vulnerabilities

Severity: Medium (can be High if stored-XSS possible)

Required:

* MUST treat user-uploaded files and previews as potentially malicious.
* MUST NOT render uploaded HTML/SVG/other active content inline unless sanitized and explicitly required.
* SHOULD validate file types client-side for UX, but MUST rely on server-side validation for security.

Insecure patterns:

* Rendering user-uploaded HTML as content.
* Inline rendering of untrusted SVG/HTML via `dangerouslySetInnerHTML` or `<iframe srcdoc=...>` without sanitization.

Detection hints:

* Search for upload components and preview logic:

  * `input type="file"`, `FileReader`, `URL.createObjectURL`, `<iframe>`, `<object>`, `<embed>`.
* Trace where uploaded content is later displayed.

Fix:

* Restrict accepted types, sanitize where needed, and prefer download/attachment flows for risky types.
* Ensure server enforces the real policy (type checking, renaming, scanning, storing outside webroot).

Notes:

* OWASP file upload guidance highlights allowlisting extensions, validating file type, generating filenames, limiting size, storing outside webroot, and considering “client-side active content (XSS, CSRF, etc.)” when files are publicly retrievable. ([OWASP Cheat Sheet Series][19])

---

### REACT-SUPPLY-001: Dependency and supply-chain hygiene (frontend + build tooling)

Severity: Low

Required:

* MUST use a lockfile and enforce reproducible installs in CI.
* SHOULD regularly audit dependencies and respond quickly to advisories for:

  * React, react-dom, router libs, build tooling (Vite/Webpack), sanitizers, auth libs, etc.
* SHOULD reduce exposure to install-time script attacks and typosquatting risk.

Audit focus:

* CI should use `npm ci` (or Yarn frozen lockfile / pnpm equivalent) to prevent drift.
* Use vulnerability scanning (`npm audit`, GitHub Dependabot/alerts, etc.).

Insecure patterns:

* No lockfile or lockfile ignored in CI.
* `npm install` in CI producing non-reproducible builds.
* Unpinned or unreviewed high-risk deps; sudden major updates without review.
* Blindly running install scripts from third-party packages.

Detection hints:

* Check for lockfiles: `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`.
* Check CI scripts for `npm install` vs `npm ci`.
* Search for `postinstall` scripts and suspicious build steps.

Fix:

* Use lockfile and enforce it in CI (e.g., `npm ci`).
* Run audits regularly; pin/upgrade responsibly.
* Consider restricting install scripts where feasible.

Notes:

* npm docs describe `npm audit` as submitting the project dependency tree to the registry to receive a report of known vulnerabilities and (optionally) applying remediations via `npm audit fix`, while noting some vulns require manual review. ([npm Docs][20])
* npm docs describe `npm ci` as intended for automated/CI environments, requiring an existing lockfile and failing if `package.json` and lockfile do not match. ([npm Docs][21])
* OWASP NPM security guidance recommends enforcing the lockfile and explicitly calls out `npm ci` / `yarn install --frozen-lockfile` to abort on inconsistencies, and highlights the risk of install-time scripts and the option to use `--ignore-scripts` to reduce attack surface. ([OWASP Cheat Sheet Series][22])

---

## 5) Practical scanning heuristics (how to “hunt”)

When actively scanning, use these high-signal patterns:

* Raw HTML / XSS escape hatches:

  * `dangerouslySetInnerHTML`, `__html:`
  * Markdown HTML passthrough flags: `rehype-raw`, `allowDangerousHtml`, `sanitize: false`
* DOM XSS sinks:

  * `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `DOMParser`, `createContextualFragment`
* Dangerous JS execution:

  * `eval(`, `new Function(`, `setTimeout("`, `setInterval("`
* Untrusted URL injection / navigation:

  * `href={` / `src={` with untrusted values
  * `window.location`, `location.href`, `window.open`, `navigate(`
  * Query params: `next`, `returnTo`, `redirect`
* Token/session risk:

  * `localStorage.setItem`, `sessionStorage.setItem`, `getItem(` with `token`, `jwt`, `refresh`
* Cookie/CSRF coupling:

  * `credentials: 'include'`, `withCredentials: true` on state-changing requests without CSRF headers
* Third-party scripts:

  * `<script src=...>` in `public/index.html`
  * Tag manager snippets and dynamic script insertion
* Service workers:

  * `navigator.serviceWorker.register`, Workbox usage, custom `fetch` handlers
* postMessage:

  * `postMessage(` with `*`, missing `event.origin` checks
* Supply chain:

  * Missing lockfile, CI uses `npm install`, no audit step, risky postinstall scripts

Always try to confirm:

* data origin (untrusted vs trusted)
* sink type (React escape hatch vs DOM sink vs navigation vs storage)
* protective controls present (sanitization, allowlists, CSP/Trusted Types, CSRF tokens, headers, governance)

---

## 6) Sources (accessed 2026-01-26)

Primary React documentation:

* React 19 stable announcement — `https://react.dev/blog/2024/12/05/react-19` ([React][23])
* React DOM docs: `dangerouslySetInnerHTML` warning — `https://react.dev/reference/react-dom/components/common#dangerouslysetting-the-inner-html` ([React][12])
* React (legacy) JSX escaping statement — `https://legacy.reactjs.org/docs/introducing-jsx.html` ([React][14])

OWASP Cheat Sheet Series:

* Cross Site Scripting Prevention (framework escape hatches; React `dangerouslySetInnerHTML`; URL validation notes) — `https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html` ([OWASP Cheat Sheet Series][9])
* Content Security Policy — `https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html` ([OWASP Cheat Sheet Series][2])
* Cross-Site Request Forgery Prevention — `https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html` ([OWASP Cheat Sheet Series][6])
* HTML5 Security (Web Storage, postMessage, tabnabbing, sandboxed frames) — `https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html` ([OWASP Cheat Sheet Series][4])
* Third Party JavaScript Management — `https://cheatsheetseries.owasp.org/cheatsheets/Third_Party_Javascript_Management_Cheat_Sheet.html` ([OWASP Cheat Sheet Series][5])
* File Upload — `https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html` ([OWASP Cheat Sheet Series][19])
* NPM Security best practices — `https://cheatsheetseries.owasp.org/cheatsheets/NPM_Security_Cheat_Sheet.html` ([OWASP Cheat Sheet Series][22])

Browser / platform references (MDN, W3C):

* Trusted Types API — `https://developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API` ([MDN Web Docs][3])
* W3C Trusted Types spec — `https://www.w3.org/TR/trusted-types/` ([W3C][15])
* Subresource Integrity — `https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity` ([MDN Web Docs][7])
* Clickjacking defenses overview — `https://developer.mozilla.org/en-US/docs/Web/Security/Attacks/Clickjacking` ([MDN Web Docs][8])
* Using Service Workers (HTTPS requirement; proxy-like behavior) — `https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers` ([MDN Web Docs][10])
* Secure contexts (powerful APIs restricted to HTTPS) — `https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts` ([MDN Web Docs][18])
* Link `rel` values (noopener/noreferrer) — `https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/rel` ([MDN Web Docs][17])

Build tooling / env exposure references:

* Create React App env variables warning — `https://create-react-app.dev/docs/adding-custom-environment-variables/` ([create-react-app.dev][1])
* Vite env variables security notes — `https://vite.dev/guide/env-and-mode` ([vitejs][11])

Auth/token storage guidance:

* OAuth 2.0 for Browser-Based Apps (token storage discussion) — `https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps` ([IETF Datatracker][16])

Dependency tooling references:

* npm audit docs — `https://docs.npmjs.com/cli/v10/commands/npm-audit/` ([npm Docs][20])
* npm ci docs — `https://docs.npmjs.com/cli/v10/commands/npm-ci/` ([npm Docs][21])

Sanitizer reference:

* DOMPurify — `https://github.com/cure53/DOMPurify` ([GitHub][13])

[1]: https://create-react-app.dev/docs/adding-custom-environment-variables/ "Adding Custom Environment Variables | Create React App"
[2]: https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html "Content Security Policy - OWASP Cheat Sheet Series"
[3]: https://developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API "Trusted Types API - Web APIs | MDN"
[4]: https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html "HTML5 Security - OWASP Cheat Sheet Series"
[5]: https://cheatsheetseries.owasp.org/cheatsheets/Third_Party_Javascript_Management_Cheat_Sheet.html "Third Party Javascript Management - OWASP Cheat Sheet Series"
[6]: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html "Cross-Site Request Forgery Prevention - OWASP Cheat Sheet Series"
[7]: https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Subresource_Integrity "Subresource Integrity - Security | MDN"
[8]: https://developer.mozilla.org/en-US/docs/Web/Security/Attacks/Clickjacking "Clickjacking - Security | MDN"
[9]: https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html "Cross Site Scripting Prevention - OWASP Cheat Sheet Series"
[10]: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers "Using Service Workers - Web APIs | MDN"
[11]: https://vite.dev/guide/env-and-mode "Env Variables and Modes | Vite"
[12]: https://react.dev/reference/react-dom/components/common "Common components (e.g. <div>) – React"
[13]: https://github.com/cure53/DOMPurify "GitHub - cure53/DOMPurify: DOMPurify - a DOM-only, super-fast, uber-tolerant XSS sanitizer for HTML, MathML and SVG. DOMPurify works with a secure default, but offers a lot of configurability and hooks. Demo:"
[14]: https://legacy.reactjs.org/docs/introducing-jsx.html "Introducing JSX – React"
[15]: https://www.w3.org/TR/trusted-types/ "Trusted Types"
[16]: https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps "
            
                draft-ietf-oauth-browser-based-apps-26
            
        "
[17]: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/rel "HTML attribute: rel - HTML | MDN"
[18]: https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts "Secure contexts - Security | MDN"
[19]: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html "File Upload - OWASP Cheat Sheet Series"
[20]: https://docs.npmjs.com/cli/v10/commands/npm-audit "npm-audit | npm Docs"
[21]: https://docs.npmjs.com/cli/v10/commands/npm-ci "npm-ci | npm Docs"
[22]: https://cheatsheetseries.owasp.org/cheatsheets/NPM_Security_Cheat_Sheet.html "NPM Security - OWASP Cheat Sheet Series"
[23]: https://react.dev/blog/2024/12/05/react-19 "React v19 – React"
