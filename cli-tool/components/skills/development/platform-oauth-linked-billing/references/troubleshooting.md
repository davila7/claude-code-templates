# Troubleshooting

| Symptom | Where | Cause and fix |
|---------|-------|---------------|
| JWKS editor rejects the key | Console, Register issuer | Pasted `{"keys": [...]}`. Paste only the array. |
| `invalid_scope` | PAR | `offline_access` is off in the app's Permissions tab. |
| `invalid_client` | PAR, token, operator token | Assertion signed with another key, wrong `kid`, or `iss`/`sub`/`aud` do not match the rule exactly. Compare with the Client authentication tab and the rule. |
| `jwt_signature_invalid` (Client authentication history) | PAR, token | DER signature. Use raw `r||s` (`dsaEncoding: 'ieee-p1363'` in Node). |
| `invalid_request` | PAR | `user_profile_id` does not exist, or a required field is missing. |
| "Can't link <app> to any of your organizations" | Approval screen | The email is not a test user, the account is in the owning organization, or the organization has no API billing. |
| `unauthorized_client … no workspace is set` | Code exchange | Set "Default workspace for platform auth mode OAuth tokens" in Client authentication. The code is then lost: start the link again. |
| `invalid_grant` | Code exchange | Code expired (5 minutes), already used, or `redirect_uri`/`code_verifier` differ from the PAR. |
| `403 user_profile_billing_not_authorized` | Billed call | No approval yet, the link was revoked, or the spend limit was reached. Treat as "not linked". |
| `403 user_profile_not_billable` | Linking | The organization only has a Claude.ai subscription, no API billing. |
| Callback rejected in the user's own browser | `link/callback` | Cookie not set or not sent: `__Host-` cookies need `Secure`, `Path=/` and no `Domain`; the callback must be on the origin that set it; `SameSite=Lax` (not `Strict`), because the return from auth.claude.com is a cross-site top-level navigation. |
| Operator token works, profile creation fails | `/v1/user_profiles` | Missing `anthropic-version` header, or the service account is not the app's operator service account. |

Console → the app → Client authentication → **Client authentication history** lists each PAR/token attempt with the reason. Check it before changing code.

Tip for a first manual test without a running server: register `http://localhost:<port>/callback` with nothing listening. After approval the browser shows a connection error, but the `code` is in the address bar; it lasts 5 minutes.
