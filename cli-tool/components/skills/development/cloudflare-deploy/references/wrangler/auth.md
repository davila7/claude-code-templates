# Authentication

Authenticate with Cloudflare before deploying Workers or Pages.

## Quick Decision Tree

```
Need to authenticate?
├─ Interactive/local dev → wrangler login (recommended)
├─ CI/CD or headless → CLOUDFLARE_API_TOKEN env var
└─ Terraform/Pulumi → See respective references
```

## wrangler login (Recommended)

One-time OAuth flow for local development:

```bash
npx wrangler login     # Opens browser, completes OAuth
npx wrangler whoami    # Verify: shows email + account ID
```

Credentials stored locally. Works for all subsequent commands.

## API Token (CI/CD)

For automated pipelines or environments without browser access:

1. Go to: **https://dash.cloudflare.com/profile/api-tokens**
2. Click **Create Token**
3. Use template: **"Edit Cloudflare Workers"** (covers Workers, Pages, KV, D1, R2)
4. Copy the token (shown only once)
5. Set environment variable:

```bash
export CLOUDFLARE_API_TOKEN="your-token-here"
```

### Minimal Permissions by Task

| Task | Template / Permissions |
|------|------------------------|
| Deploy Workers/Pages | "Edit Cloudflare Workers" template |
| Read-only access | "Read All Resources" template |
| Custom scope | Account:Read + Workers Scripts:Edit + specific resources |

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| "Not logged in" | No credentials | `wrangler login` or set `CLOUDFLARE_API_TOKEN` |
| "Authentication error" | Invalid/expired token | Regenerate token in dashboard |
| "Missing account" | Wrong account selected | `wrangler whoami` to check, add `account_id` to wrangler.jsonc |
| Token works locally, fails CI | Token scoped to wrong account | Verify account ID matches in both places |
| "Insufficient permissions" | Token lacks required scope | Create new token with correct permissions |

## Verifying Authentication

```bash
npx wrangler whoami
```

Output shows:
- Email (if OAuth login)
- Account ID and name
- Token scopes (if API token)

Non-zero exit code means not authenticated.

## See Also

- [terraform/README.md](../terraform/README.md) - Terraform provider auth
- [pulumi/README.md](../pulumi/README.md) - Pulumi provider auth
