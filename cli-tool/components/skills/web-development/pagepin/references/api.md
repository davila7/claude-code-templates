# pagepin API reference

Full endpoint reference for the pagepin skill. All requests authenticate with a
Personal Access Token: `Authorization: Bearer $PP_TOKEN`. Base URL is
`$PAGEPIN_BASE` (the scheme + host of the pagepin instance, no trailing slash).
Authoritative quotas always come from `GET /api/me`.

## Endpoints

| Method & path | Purpose |
|---|---|
| `GET /api/me` | Verify token; returns `handle`, `content_base`, `limits`, quota |
| `GET /api/me/usage` | Current storage usage against the instance limits |
| `GET /api/sites` | List my sites |
| `POST /api/sites/{slug}/deploy` | Deploy/update (multipart; one atomic version). See below |
| `PATCH /api/sites/{slug}` | Set `{"visibility":"public","public_hours":72}` / `{"visibility":"private"}`; also `{"title":"…"}`, `{"spa_fallback":true}` |
| `GET /api/sites/{slug}/versions` | Version list (incl. current) |
| `POST /api/sites/{slug}/rollback` | `{"version_id":"…"}` — point current version backward |
| `DELETE /api/sites/{slug}` | Delete the site |
| `GET /api/sites/{slug}/comments` | Page comments (unresolved by default; `?all=true` includes resolved) |
| `POST /api/sites/{slug}/comments/{thread_id}/replies` | `{"text":"…"}` — reply to a thread |
| `PATCH /api/sites/{slug}/comments/{thread_id}` | `{"resolved":true}` / `{"resolved":false}` |
| `POST /api/sites/{slug}/share-link` | `{"hours":24,"label":"…"}` (both optional; **default: never expires**) → `{url, code, expires_at}` — short guest link, see below |
| `GET /api/sites/{slug}/share-links` | List active share links → `{links:[{code, url, label, created_at, expires_at}]}` |
| `DELETE /api/sites/{slug}/share-links/{code}` | Revoke **one** link (kicks its guest sessions too) |
| `DELETE /api/sites/{slug}/share-link` | Revoke **all** outstanding share links (and their guest sessions) for the site |

## Share links (review without accounts)

`POST /api/sites/{slug}/share-link` mints a short chat-friendly URL
(`https://<content-host>/s/<code>`). Anyone opening it can **view the private
site and pin comments as a guest** — no account needed. This is the preferred
way to collect review feedback from people outside the instance:

- Deploy → create a share link → hand the `url` to reviewers (chat/IM/email).
- Guests appear in `GET /api/sites/{slug}/comments` with their self-given name;
  their `author_sub` starts with `guest:`. They can comment and reply but never
  resolve — resolving stays with you (the token owner) and logged-in members.
- **Links never expire by default**; revocation is the control. Pass `hours`
  (server-capped, default cap 720h) for a self-expiring link. Expiry only stops
  *new* visitors; guests already inside stay until their session lapses
  (sliding ~14 days) — to kick everyone from one link, revoke that link.
- `label` (≤120 chars, optional) tags the link so you can tell them apart in
  the list (e.g. `"for the design review"`).
- Revoke one link (`DELETE …/share-links/{code}`) or all at once
  (`DELETE …/share-link`); both also invalidate guests who already entered.
- Guest commenting can be turned off per site: `PATCH /api/sites/{slug}`
  `{"guest_comments":false}` (the link then grants view-only access).
- Legacy `?key=` JWT links issued before short codes keep working until their
  original expiry.

## Deploy details

`POST /api/sites/{slug}/deploy` is `multipart/form-data`:

- `files` / `paths` come in pairs and may repeat. `files` is the file content,
  `paths` is the in-site relative path (must not start with `/`, no `..`).
- `slug`: lowercase letters/digits/hyphens, ≤64 chars. Re-deploying the same
  slug appends a new version and flips the current pointer atomically.
- Optional `title`: the site's display name.
- A single HTML file is safest deployed as `paths=index.html`. (When the root
  has exactly one HTML file, the server also auto-adds an `index.html` alias.)

Response JSON (key fields): `url` (the shareable link), `visibility`,
`version_count`.

## Large sites (> ~90MB total): batched upload

A single `POST …/deploy` carries every file in one request body, capped at
~100MB on Cloudflare. For bigger sites use the 3-step batched flow (each step
authenticates the same way):

1. `POST /api/sites/{slug}/deploys` `{"title":"…"}` → `{deploy_id}`
2. one or more `POST /api/sites/{slug}/deploys/{deploy_id}/files` (multipart
   `files`/`paths`, keep each request under ~90MB)
3. `POST /api/sites/{slug}/deploys/{deploy_id}/commit` `{"title":"…"}` to publish
   atomically.

`DELETE /api/sites/{slug}/deploys/{deploy_id}` aborts a draft. The web console
does this automatically.

## Comment-thread fields

Each thread returned by `GET /api/sites/{slug}/comments` includes:

- `id` — thread id (use it for replies / resolve).
- `selector` — CSS path of the commented element; `"@page"` = whole-page feedback.
- `rx` / `ry` — the anchor's relative position inside the element box (0–1). If
  `rw` / `rh` are also present, the feedback targets a box-selected region within
  the element (common when circling part of an image).
- `kind` — `copy` (edit text) / `style` (edit styling) / `question` / `bug`; may be null.
- `comments` — the comments and replies, with authors.
- `stale` — `true` = raised against an older version, may already be handled.
- `url` — a deep link straight to that comment.

The reply author is the token's owner (a named, traceable record). A resolved
thread can be reopened by the other party on the page. For a `question`-type
thread you can't judge, relay it to the user rather than resolving it yourself.

## Limits & error codes

- Quotas (defaults; self-hosters tune them via environment variables): single
  file ≤25MB, single site ≤200MB, ≤2000 files, plus a per-user total-storage quota
  (the `free_user_mb` field, default 1GB across all your sites/versions; `0` =
  unlimited). **Always defer to the `limits` returned by `GET /api/me`.**
- The `public_hours` upper bound follows server config (default 168 hours =
  7 days); anything beyond is hard-clamped.
- `401` invalid or revoked token · `404` site not found · `409` set a handle in
  the console first · `413` size limit exceeded · `422` invalid slug/path.
- **Recovering from first-run 4xx** (fresh accounts hit these; don't give up):
  - `409` `site.handle.required` — the account has no handle yet. Fix it via the
    API: `POST /api/me/handle/suggest` (empty body) for a free suggestion, then
    `POST /api/me/handle` `{"handle":"…"}` (works with the PAT), and retry the
    deploy. If that returns `403 auth.emailUnverified`, fall through to the next
    point.
  - `403` `auth.emailUnverified` — the user must click the verification email
    (or sign in with Google/GitHub once). Tell the user, wait, retry.
- Error bodies are `{ "detail": "<message>", "code": "<stable.key>" }`. Branch on
  the language-independent `code` (e.g. `auth.unauthenticated`, `site.quota.exceeded`,
  `comment.text.empty`); `detail` is a human message localized per request. Set the
  language with `?lang=en|zh`, a `pp_lang` cookie, or an `Accept-Language` header.
- Deployed sites are **private by default** (viewing requires login) — don't
  assume the link is anonymously reachable; PATCH it public first to share
  externally.

## Token lifecycle

Device-login tokens expire (default 90 days) and can be revoked or rotated any
time in the console. After rotating, update `~/.config/pagepin/token` to match.
