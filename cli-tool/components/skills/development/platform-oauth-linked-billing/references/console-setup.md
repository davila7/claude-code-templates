# Console setup (the user does these steps)

Console: https://platform.claude.com. Names below are the ones Console showed in November 2026; the feature is in beta, so match by meaning if a label moved.

The user needs **two Claude accounts with different emails**, each with its own Console organization:
- the one that **owns the app**;
- one that plays the **customer**, with some prepaid credits. ⚠️ The owning organization cannot link its own app, and Console has no button to create a second organization under the same account, so this second account is required to test.

## 1. Create the OAuth app

Organization → Customers → OAuth apps → **Create**.

- Name: what the customer sees on the approval screen.
- Connection type: `organization_shared`.
- Accept the Linked Billing Terms (the user does this).
- Copy the **Client ID** (`clid_…`). It is public, but keep it in config, not hard-coded.

The app starts in **Testing**: only test users can link, each with a monthly limit of at most USD 50.

## 2. Permissions tab

Turn on **both** scopes: `billing:attribution` and `offline_access`.

⚠️ If `offline_access` is off, PAR fails with `invalid_scope` even when the request asks for it, and no refresh token is issued.

## 3. Settings tab

- **Test users**: add the customer account's email. ⚠️ Without it the customer sees "Can't link <app> to any of your organizations".
- **Redirect URIs**: the exact callback URL, for example `https://app.example.com/link/callback`. While developing, `http://localhost:<port>/link/callback` is accepted.

## 4. Register the signing key as an issuer

Keys → Workload identity → Issuers → **Register issuer**.

- Issuer URL: an identifier you choose, usually the backend's public origin (`https://api.example.com`). It does not need to resolve or serve `/.well-known`. It must equal the `iss` claim the backend signs.
- JWKS source: **Inline keys**.
- Paste the array that `scripts/genkey.mjs` printed.

⚠️ The editor starts with `[]` and rejects `{"keys": [...]}`. Paste only the array.

The docs list AWS, GCP, Kubernetes, GitHub Actions, Entra, Okta or a public OIDC issuer; none of them is required. Inline keys are what let a small server or an edge worker sign its own assertions.

## 5. Client authentication tab: the client rule

Client authentication → **Edit**:
- Issuer: the one from step 4.
- Subject: the client subject from the plan, for example `myapp:backend:client`.
- Audience: `https://auth.claude.com`.

Console creates the federation rule. The backend's client assertions must use exactly this `iss`, `sub` and `aud`.

## 6. Operator service account and its rule

1. Keys → Service accounts → **Create service account**. Copy its id (`svac_…`).
2. Keys → Workload identity → Rules → **New rule**: same issuer, subject `myapp:backend:operator`, default audience `https://api.anthropic.com`, target = that service account. Copy the rule id (`fdrl_…`).
3. Back in the app's Client authentication tab, choose that account as **Operator service account**.
4. Right below it, set **Default workspace for platform auth mode OAuth tokens** (for example "Default").

⚠️ Without that default workspace the code exchange fails with `unauthorized_client: no workspace is set for the tokens of this app's connections`. The authorization code expires 5 minutes after approval, so set it before anyone links.

Also note the **organization ID** (Organization settings). The operator token request needs it.

## Values to collect

| Value | Looks like | Secret? |
|-------|-----------|---------|
| Client ID | `clid_…` | no |
| Organization ID | UUID | no, but keep in config |
| Issuer URL | `https://api.example.com` | no |
| Key id | the `kid` genkey printed | no |
| Client subject / operator subject | `myapp:backend:client` / `myapp:backend:operator` | no |
| Operator service account ID | `svac_…` | no |
| Operator federation rule ID | `fdrl_…` | no |
| Signing private key | PEM | **yes**, secret store only |
