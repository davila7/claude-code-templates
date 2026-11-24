---
name: platform-oauth-linked-billing
description: Use when adding Claude Platform OAuth (linked billing) to an app, so that customers link their own Claude Console organization and the Claude calls they start are billed to them. Invoke it before writing any code for "connect your Claude org", "bill Claude usage to the customer", user profiles, auth.claude.com, PAR/PKCE with Anthropic, workload identity federation or billing_policy.
---

# Claude Platform OAuth (linked billing)

Set up Claude Platform OAuth in the project you are running in, end to end: Console, signing key, backend routes, token storage and a verified billed call. Work in three phases and do not skip ahead: **inspect**, **plan**, **execute**.

`<skill-dir>` below is the folder that holds this file (usually `.claude/skills/platform-oauth-linked-billing`). The scripts need only Node 18+ on the machine running them, whatever language the backend is written in.

The feature is in beta. Tested with `anthropic-version: 2026-10-21` and the beta header `user-profiles-billing-2026-10-01`. If the user has newer docs, they win: https://platform.claude.com/docs/en/manage-claude/oauth-apps/overview

## What it is (tell the user if they are unsure)

- A customer links a Claude Console organization that **pays Anthropic for API usage** (prepaid credits or invoice) to the user's app once, and sets a monthly spend limit. From then on, the Claude calls they start in the app are billed to their organization.
- It is **not** "Sign in with Claude.ai". Pro/Max subscriptions cannot be linked (`403 user_profile_not_billable`), and using Claude.ai subscription logins in third-party apps is not allowed. Organizations that buy through a cloud marketplace cannot link either. The person linking needs the Admin or Billing role.
- There is **no client secret**. The backend signs short ES256 JWTs with its own key, registered in Console as an issuer with inline keys.
- The same key signs two assertions: the **client** one (`aud https://auth.claude.com`, for PAR and the code exchange) and the **operator** one (`aud https://api.anthropic.com`, exchanged for an operator service-account token that creates user profiles and makes the billed calls).

If the user wants something this does not cover (end users paying with a Claude.ai plan, batches, billable code execution), say so before doing any work.

## Phase 1: Inspect the project

Read, do not change anything. Find and note:

| Question | Where to look |
|----------|---------------|
| Language and framework of the server code | `package.json`, `pyproject.toml`, `requirements.txt`, `go.mod`, `Gemfile`, `composer.json`, `Cargo.toml` |
| Where server code runs | `wrangler.toml` (Cloudflare Workers), `vercel.json`, `netlify.toml`, `Dockerfile`, `fly.toml`, `serverless.yml`, `app.yaml` |
| Is there a server at all | A static site or a mobile/desktop app with no backend cannot hold the key: the plan must add one (an edge function or small service) |
| Existing users and sessions | Auth libraries (Clerk, Auth.js/NextAuth, Supabase Auth, Lucia, Devise, Django auth, Passport) and the user table or id |
| Database for per-user state | ORM schema, migrations folder, `DATABASE_URL`-style env names |
| Secret store | `.env.example`, `.dev.vars`, `wrangler secret`, Vercel/Netlify env, Doppler, AWS/GCP secret managers. Read names only |
| Existing Anthropic usage | `@anthropic-ai/sdk`, `anthropic` (Python), raw calls to `api.anthropic.com`, current API key handling |
| Public URL and local dev URL | Deploy config, README, dev server port. The callback URL is built from these |

Rules while inspecting:
- Never open files that hold secrets: `.env`, `.env.*` (except `.env.example`), `.dev.vars`, `*.pem`, `*.key`, credentials JSON, `~/.aws`, `~/.config/gcloud`. Variable names from `.env.example` or code are enough.
- If the repository is public (check the remote or ask), all signing material, refresh tokens and billing code must stay out of it. Propose a private service or the platform's secret store.

## Phase 2: Write the plan

Write `CLAUDE_PLATFORM_OAUTH_PLAN.md` at the project root (ask before committing it) with:

1. **Summary** of what was found in Phase 1: stack, runtime, user model, database, secret store, public and local URLs.
2. **Console checklist** (the user does these; see [references/console-setup.md](references/console-setup.md)). Fill in the real values you can already know: app name, redirect URIs, subjects (`<app>:backend:client`, `<app>:backend:operator`), audiences.
3. **Secrets** the backend will need, with the exact names you will use and where each one is stored: signing private key (PEM), key id (`kid`), issuer URL, client subject, operator subject, client ID, organization ID, operator service account ID, operator federation rule ID, and a key to encrypt refresh tokens at rest.
4. **Data model**: a per-user record with `user_profile_id`, `connection_id`, encrypted refresh token and its expiry, link status; a short-lived table or cache for pending link attempts (state, PKCE verifier, browser binding hash, user id, expiry 10 to 15 minutes).
5. **Backend work**, as files to create or change for this stack (see [references/backend.md](references/backend.md)): signer, operator token cache, user profile creation, `link/start`, `link/callback`, unlink/status, and the billed call wrapper.
6. **Verification steps** (see the end of this file).
7. **Open questions** for the user, only the ones you cannot answer from the code.

Show the plan to the user and wait for an explicit go before Phase 3. If they change scope, update the file.

## Phase 3: Execute

Go in this order. Stop at each step that needs the user and say exactly what they must do.

### 3.1 Signing key

Run [scripts/genkey.mjs](scripts/genkey.mjs) with an `--out` path outside the repository (it refuses a path git would track):

```bash
node <skill-dir>/scripts/genkey.mjs --prefix <app>-backend --out <path-outside-repo>/priv.pem
```

It writes the private key with mode 0600 and prints only the public JWKS array and the `kid`. Never print, `cat` or paste the private key into the chat. Tell the user to load it into the secret store themselves (for example `wrangler secret put SIGNING_KEY_PEM < priv.pem`) and delete the file after.

For production use a fresh key, never one that was used in a test run.

### 3.2 Console setup (user)

Walk the user through [references/console-setup.md](references/console-setup.md) one step at a time and wait for confirmation after each. Check the gotchas with them as you go: they are each a failed request otherwise. If you have browser tools and the user is signed in to Console, you may navigate and read the pages for them, but the user clicks Create/Save, accepts terms and handles sign-in. Never type secrets into forms.

Collect the public values they give you (client ID, organization ID, service account ID, operator rule ID, issuer URL) and put them in the secret store or config, not in code.

### 3.3 Backend

Implement what the plan lists, following [references/backend.md](references/backend.md) and the project's own conventions (router, ORM, error handling, test framework). Requirements that do not change with the stack:

- Use the official Anthropic SDK for the API calls when the project already uses one or it is available for the language; `auth.claude.com` calls are plain HTTPS POSTs with JSON.
- ES256 signature in raw `r||s` form (JWS). WebCrypto already does it; Node `crypto.sign` needs `dsaEncoding: 'ieee-p1363'`; Python `cryptography` returns DER and must be converted with `decode_dss_signature`.
- PKCE S256 + `state`, and **bind the callback to the browser that started the flow** with an HttpOnly, Secure, SameSite=Lax cookie set on `link/start` and checked (by hash) on `link/callback`. `state` alone does not stop someone from linking their organization to another person's account.
- Store refresh tokens encrypted, keyed to the user. Each refresh rotates the token: always save the newest one.
- Bill only requests the customer directed (a click of theirs), never background jobs. Show the user what a run will cost and cap `max_tokens`.
- The private key, operator token, refresh tokens and connection data never reach the browser, logs or error messages.
- Add tests for the signer (signature verifies with the public key), the callback (wrong or missing cookie rejected, expired state rejected, state used once) and the billed call wrapper (sends the profile header and `billing_policy`).

### 3.4 Verify

Run [scripts/verify.mjs](scripts/verify.mjs) with the same values the backend uses. The user exports them in their own shell (the variable names are at the top of the script); never write them to a file you create. It prints no key or token; between `link` and `exchange` it keeps the PKCE verifier in `~/.cache/platform-oauth-linked-billing/` (mode 600, deleted by `exchange`). If the default model id is rejected, set `CPO_MODEL`.

```bash
node <skill-dir>/scripts/verify.mjs operator            # key, issuer, operator rule and service account match
node <skill-dir>/scripts/verify.mjs profile "Test user" # creates a user profile, prints uprof_…
node <skill-dir>/scripts/verify.mjs bill uprof_…        # 403 user_profile_billing_not_authorized before linking
node <skill-dir>/scripts/verify.mjs link uprof_…        # client rule + PAR; prints the URL for the test customer
node <skill-dir>/scripts/verify.mjs exchange <code>     # code exchange (within 5 minutes of approval)
node <skill-dir>/scripts/verify.mjs bill uprof_…        # 200 after linking
```

`link`/`exchange` let you prove the Console setup before the backend exists (use a `localhost` redirect URI with nothing listening and copy `code` from the address bar).

Then the end-to-end check with the app running:

1. The test user (a second Claude account, added as a test user) starts the link from the app, sees the three screens (how billing works, monthly spend limit, link and authorize) and approves.
2. The callback stores the connection; the app's Overview tab in Console shows the linked customer.
3. `verify.mjs bill <uprof>` (or the app's own action) returns 200, and the usage appears in the customer's organization.
4. Negative checks: opening the authorize URL in another browser fails the callback; a profile that never linked gets `403 user_profile_billing_not_authorized`.

Report the results with the exact responses. If something fails, use [references/troubleshooting.md](references/troubleshooting.md) before changing code.

## Before going live

- The app starts in **Testing**: only listed test users can link, each with at most USD 50 a month. Publishing needs a DNS TXT record and a review by Anthropic.
- Remove test redirect URIs (`localhost`) and archive test issuers and rules.
- The customer's ZDR or BAA does not cover these calls: the privacy policy must say so.
- Customers can revoke the link any time from Keys → Linked platforms; handle `403 user_profile_billing_not_authorized` as "not linked" in the UI.
