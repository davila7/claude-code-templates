---
title: "Collections System"
summary: "Authenticated dashboard APIs let Clerk users save components into Neon-backed collections and optionally publish a public, privacy-filtered share view."
topics: [architecture, dashboard, api]
sources:
  - id: collections-index
    type: file
    path: dashboard/src/pages/api/collections/index.ts
  - id: collection-detail
    type: file
    path: dashboard/src/pages/api/collections/[id].ts
  - id: collection-items
    type: file
    path: dashboard/src/pages/api/collections/items.ts
  - id: collection-share
    type: file
    path: dashboard/src/pages/api/collections/share.ts
  - id: auth-helper
    type: file
    path: dashboard/src/lib/api/auth.ts
  - id: neon-helper
    type: file
    path: dashboard/src/lib/api/neon.ts
---

# Collections System

The collections system is the dashboard's saved-components backend. It authenticates users with Clerk bearer tokens, stores collection ownership and items in Neon, and exposes a separate public sharing path that returns only display-safe fields. The private API is ownership-first: every list, rename, delete, add, remove, and move operation checks the authenticated Clerk user before touching collection data [@auth-helper] [@collections-index] [@collection-detail] [@collection-items].

## Responsibility

Collections group catalog components under a user-owned name. A collection stores its owner in `user_collections.clerk_user_id`, while component entries live in `collection_items` and carry component type, path, name, and optional category [@collections-index] [@collection-items]. The API does not resolve component metadata from the catalog at write time; it persists the component identity supplied by the dashboard client after validating the required fields [@collection-items].

The system also owns the share toggle. A private collection can be made public by assigning an eight-character `share_slug` and setting `is_public`, or made private again by clearing the slug and flag [@collection-share].

## Boundaries

Authentication is centralized in `authenticateRequest()`. It requires an `Authorization: Bearer ...` header, verifies the token with Clerk, and returns the Clerk subject as the user id [@auth-helper]. Database access is centralized through `getNeonClient()`, which reads `NEON_DATABASE_URL` from Astro or process environment variables and throws if the connection string is missing [@neon-helper].

The private collection endpoints never trust a collection id by itself. Listing filters by `clerk_user_id`, detail updates filter by both `id` and `clerk_user_id`, and item operations first verify that the source collection belongs to the caller [@collections-index] [@collection-detail] [@collection-items].

## Entrypoints

`GET /api/collections` returns the authenticated user's collections ordered by position and creation time, then attaches each collection's items ordered by `added_at` [@collections-index].

`POST /api/collections` creates a collection after requiring a non-empty string name and enforcing a 100-character limit. It places the new collection after the user's current maximum `position` [@collections-index].

`PATCH /api/collections/[id]` renames a collection after the same name validation, and `DELETE /api/collections/[id]` deletes the collection's items before deleting the collection row [@collection-detail].

`POST`, `DELETE`, and `PATCH /api/collections/items` add, remove, and move component entries. Adding rejects duplicate `component_path` values within the same collection, and moving requires both the source and destination collections to belong to the caller [@collection-items].

`POST /api/collections/share` toggles sharing for an authenticated owner. `GET /api/collections/share?slug=...` is intentionally unauthenticated and only returns a public collection when `share_slug` matches and `is_public` is true [@collection-share].

## Flow

The private flow starts with token verification, opens a Neon client, validates request shape, performs an ownership lookup, and then mutates or reads collection data [@auth-helper] [@neon-helper] [@collection-items]. Errors are deliberately simple at the API edge: missing auth returns 401, invalid input returns 400, missing owned resources return 404, duplicate collection items return 409, and unexpected database failures return 500 [@collections-index] [@collection-detail] [@collection-items].

The public sharing flow is narrower. It accepts only a slug, looks up a public collection, selects component fields from `collection_items`, and resolves a display name from Clerk as `username` or `firstName` when possible [@collection-share]. It does not return internal item ids, collection UUIDs, or Clerk user ids in the response body [@collection-share].

## Invariants And Failure Modes

Ownership checks are the main invariant. Any private operation that skips `clerk_user_id` would risk cross-user collection access, so new routes should follow the same pattern used by the existing index, detail, and item handlers [@collections-index] [@collection-detail] [@collection-items].

The share slug generator retries up to five times for uniqueness but does not enforce a final post-loop failure path if all generated slugs collide. The practical risk is low because the slug alphabet and length create a large space, but the code's actual collision handling is best-effort rather than transactional [@collection-share].

The public route's privacy boundary is explicit: author display name can be resolved from Clerk, but private identifiers and emails stay out of the returned payload [@collection-share]. This makes the collections API part of the broader [Critical API Surfaces](../api/critical-api-surfaces.md) rather than a purely local dashboard feature.
