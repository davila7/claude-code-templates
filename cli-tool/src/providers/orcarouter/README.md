# OrcaRouter

[OrcaRouter](https://www.orcarouter.ai) is an OpenAI-compatible AI gateway that
routes many providers behind one endpoint. This repository can point Claude Code
at it, install it as a provider preset, and discover the models your workspace
can actually call.

Two provider IDs are registered, because there are two ways to authenticate and
they fail differently:

| Selection | ID | How you authenticate |
| --- | --- | --- |
| **OrcaRouter - API** | `orcarouter` | Paste an `sk-orca-…` key you created in the [console](https://www.orcarouter.ai/console/token) |
| **OrcaRouter - Auth** | `orcarouter-oauth` | Sign in with an OrcaRouter account via OAuth 2.0 + PKCE; the key is issued to your account |

Both produce **the same ordinary OrcaRouter API key** and route to the same
inference API. Keeping them separate means a headless or CI user who already
holds a key never has to open a browser, and a user without a key never has to
copy one.

## Endpoints

Inference and authorization live on different public origins. They are never
derived from one another:

| Purpose | URL |
| --- | --- |
| Inference (OpenAI wire) | `https://api.orcarouter.ai/v1` |
| Inference (Anthropic wire, used by Claude Code) | `https://api.orcarouter.ai` |
| Model catalog | `https://api.orcarouter.ai/v1/models?capability=chat` |
| Authorization screen | `https://www.orcarouter.ai/auth` |
| Code exchange | `https://www.orcarouter.ai/api/v1/auth/keys` |

`https://api.orcarouter.ai/v1/auth/keys` is a 404 — the relay is at `/v1`, the
auth endpoints are not.

## Authentication

### API key

```bash
npx claude-code-templates@latest --orcarouter-api-key sk-orca-...
# or be prompted for it, so the key never lands in shell history:
npx claude-code-templates@latest --orcarouter-api-key
```

The key is stored with mode `0600` in the local credential store
(`~/.claude/orcarouter/credentials.json`) — the same trust boundary that already
holds `ANTHROPIC_AUTH_TOKEN` in `~/.claude/settings.json`. `ORCAROUTER_API_KEY`
in the environment always takes precedence and never writes to disk.

Format is checked (`sk-orca-` prefix, minimum length); validity is reported as
*unknown* until a real request, because an `sk-orca-` prefix is not proof that a
credential works and OrcaRouter exposes no free validation endpoint.

### Sign in with OrcaRouter (OAuth 2.0 + PKCE)

```bash
npx claude-code-templates@latest --orcarouter-connect
```

This is **Flow A (loopback redirect)**: the CLI binds `127.0.0.1` on an
ephemeral port *before* opening the browser, so the redirect can never race the
listener. It is the right flow because the CLI runs on the user's own machine.

```bash
# No browser can reach a loopback listener (SSH session, container, CI runner):
npx claude-code-templates@latest --orcarouter-connect --orcarouter-flow oob
# or use the device grant (Flow C) — an extra capability, never a replacement:
npx claude-code-templates@latest --orcarouter-connect --orcarouter-flow device
```

Both PKCE flows send `S256`. That is not optional: the consent screen lets a user
choose "show me a code", and a displayed code must be redeemable only by the
process that generated the verifier. The verifier is 32 bytes from
`crypto.randomBytes`, is regenerated for every attempt, and never leaves the
process — it appears in no URL, log line, error message, or telemetry event.

The Flow A listener compares `state` in constant time *before* reading the code,
so a response that did not come from the authorization this process started can
never be exchanged.

### Credential lifecycle

The exchange returns a **durable API key, not a refresh token**. There is no
refresh grant, and the CLI never invents one:

- the stored key is reused on every run until OrcaRouter revokes it;
- `--orcarouter-connect` refuses to mint a second key while a usable one is
  stored (a user may issue at most 10 PKCE keys per 24 hours), unless `--force`;
- a `401`/`403` from the relay is treated as terminal reauthentication. Only the
  exact account *and credential generation* that made the rejected request is
  marked `needsReauth`, so a late failure from an old request can never mark a
  freshly authorized credential as broken;
- the old secret is never deleted before a successful replacement.

## Models

Model discovery reads the live catalog from the configured inference origin
(`GET https://api.orcarouter.ai/v1/models?capability=chat`) using your own key, so
the list is what *your* workspace can call. The `vendor/model` namespace is
preserved verbatim.

The request is scoped to the capability being selected: `?capability=chat`,
`?capability=embedding` or `?capability=image` (the three the gateway documents).
Video and rerank have no documented filter value, so those read the unscoped
catalog and match `supported_endpoint_types` strictly. Non-text modalities are
never sent as a query parameter — the gateway does not narrow on them — so a
multimodal surface scopes to `chat` and filters on
`architecture.input_modalities` locally, failing closed for models that declare
nothing.

```bash
npx claude-code-templates@latest --orcarouter-models              # chat
npx claude-code-templates@latest --orcarouter-models chat+image   # chat models that declare image input
npx claude-code-templates@latest --orcarouter-models embedding
npx claude-code-templates@latest --orcarouter-models image
```

Capability filtering is metadata-driven, never name-based:

| Surface | Rule |
| --- | --- |
| chat | `supported_endpoint_types` includes openai / openai-response / anthropic / gemini, and the model is not non-text-only (`image-generation`, `openai-video`, `jina-rerank`, `embeddings`) |
| multimodal chat | must satisfy chat **and** declare the uploaded modality in `architecture.input_modalities`; undeclared capability fails closed |
| embedding | strictly `embeddings` |
| image | strictly `image-generation` |
| video | strictly `openai-video` |
| rerank | strictly `jina-rerank` |

If live discovery fails, a small **verified fallback** catalog is used and the
result is flagged `degraded` so the CLI can say so. A fallback is never merged
into a successful live result, and there is no free-text fallback: a capability
the catalog does not advertise produces an empty list with an explanation.

## Presets

Two installable settings presets are shipped for users who prefer a static
`.claude/settings.json`:

```bash
npx claude-code-templates@latest --setting partnerships/orcarouter        # API key
npx claude-code-templates@latest --setting partnerships/orcarouter-oauth  # account login
```

Replace `YOUR-ORCAROUTER-API-KEY` with a real key, or run
`--orcarouter-connect` and let the credential store hold it.

## Commands

| Flag | Purpose |
| --- | --- |
| `--orcarouter-api-key [key]` | Store a key (prompted when the value is omitted) and route Claude Code through OrcaRouter |
| `--orcarouter-connect` | OAuth 2.0 + PKCE sign-in; stores the issued key |
| `--orcarouter-flow <loopback\|oob\|device>` | Choose the PKCE flow |
| `--orcarouter-force` | Authorize again even when a credential is already stored |
| `--orcarouter-status` | Show both auth methods, the masked credential, and catalog status |
| `--orcarouter-models [capability]` | Capability-filtered model list |
| `--orcarouter-logout` | Remove the stored credential |

Environment overrides: `ORCA_AUTH_BASE_URL`, `ORCA_API_BASE_URL`, and the shared
self-hosted fallback `ORCA_BASE_URL`. Explicit overrides win. Remote origins must
be HTTPS; plain HTTP is accepted only for loopback development.

## Revocation

Revoke every key issued to this CLI at
<https://www.orcarouter.ai/console/authorized-apps>, or a single key at
<https://www.orcarouter.ai/console/token>. The next request returns `401` and the
CLI asks you to reauthorize instead of retrying a dead credential.
