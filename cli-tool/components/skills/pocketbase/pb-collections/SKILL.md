---
name: "PocketBase Collections"
description: "Collection and schema design for PocketBase. Use when creating collections, designing schemas, adding fields, setting up relations, or choosing between base/auth/view collection types. Prevents wrong field types, documents zero-default behavior, and covers relation cascading."
---

# PocketBase Collection & Schema Design

## Collection Types

### Base Collection
Standard data collection. System fields: `id`, `created`, `updated`.

### Auth Collection
Extends base with authentication. Additional system fields: `email`, `emailVisibility`, `verified`, `password`, `tokenKey`.

Cannot delete system fields. Can disable email/password auth in collection options.

### View Collection
Read-only, backed by a SQL SELECT query. No create/update/delete. Fields are auto-detected from the query. Useful for aggregations, joins, and computed views.

```sql
-- Example: view collection query
SELECT p.id, p.title, COUNT(c.id) as comments_count
FROM posts p LEFT JOIN comments c ON c.post = p.id
GROUP BY p.id
```

View collections support API rules (list/view only) and can be used in relations.

## Field Types

| Type | Go type | Zero default | Notes |
|------|---------|-------------|-------|
| `text` | `string` | `""` | min/max length, regex pattern |
| `editor` | `string` | `""` | Rich text (sanitized HTML) |
| `number` | `float64` | `0` | min/max, `noDecimal` option |
| `bool` | `bool` | `false` | |
| `email` | `string` | `""` | Auto-validated format |
| `url` | `string` | `""` | Auto-validated format |
| `date` | `string` | `""` | ISO 8601 (`2024-01-01 00:00:00.000Z`) |
| `select` | `string`/`[]string` | `""`/`[]` | `values` list, `maxSelect` |
| `file` | `string`/`[]string` | `""`/`[]` | `maxSelect`, `maxSize`, `mimeTypes` |
| `relation` | `string`/`[]string` | `""`/`[]` | `collectionId`, `cascadeDelete`, `maxSelect` |
| `json` | `any` | `null` | Only type that can be null! `maxSize` |
| `autodate` | `string` | auto | `onCreate`/`onUpdate` modifiers |
| `password` | `string` | `""` | Stored hashed, never returned in API |

**Critical**: all types default to their zero value, NOT null. Only `json` fields can be null.

## Field Modifiers

Use in collection schema definitions:

- **`required`** — field cannot be empty/zero
- **`unique`** — unique constraint (composite via unique indexes)
- **`presentable`** — included in relation display
- **`hidden`** — excluded from API responses unless explicitly requested
- **`:autogenerate`** — for `text` fields: auto-generate value (e.g., slug from other field)

## Relation Patterns

### One-to-many
```
posts.author -> users (maxSelect: 1)
```
Each post has one author. Query posts by author: `author = "USER_ID"`.

### Many-to-many
```
posts.tags -> tags (maxSelect: 0, meaning unlimited)
```
Multi-select relation. Filter: `tags ?= "TAG_ID"` (contains).

### Back-relations
No explicit back-relation field needed. Use `@collection.posts.author` in API rules or expand from either side:
```
GET /api/collections/users/records/USER_ID?expand=posts_via_author
```

### Cascade Delete
Set `cascadeDelete: true` on the relation field. When the referenced record is deleted, all records pointing to it are also deleted. Default is `false` (sets to empty string).

### Self-referencing
A collection can reference itself:
```
categories.parent -> categories (maxSelect: 1)
```

## Indexes

- Created in the collection settings (not field-level)
- Format: `CREATE [UNIQUE] INDEX idx_name ON collection (field1, field2)`
- Unique indexes enforce composite uniqueness
- Partial indexes: `CREATE INDEX ... WHERE condition`
- Indexes on relation fields improve join performance

## Auth Collection Specifics

### OAuth2
Enable per-provider in collection settings. Each provider needs client ID + secret. PocketBase handles the full OAuth2 flow.

### OTP (One-Time Password)
Enable in auth collection settings. Sends code via email. Configure `OTP.enabled`, `OTP.duration`, `OTP.length`.

### MFA (Multi-Factor Authentication)
Enable in auth collection settings. Requires a second factor after primary auth. `MFA.enabled`, `MFA.duration`, `MFA.rule` (filter to determine which users need MFA).

### Password Auth
Enabled by default. Can customize `minPasswordLength`. Can disable entirely if using only OAuth2/OTP.

### Auth Options
- `authToken.duration` — token lifetime (seconds)
- `passwordAuth.enabled` — toggle email/password
- `passwordAuth.identityFields` — fields used for login (default: `email`; can add `username`)
- `oauth2.enabled` — toggle OAuth2
- `otp.enabled` — toggle OTP

## Best Practices

1. **Prefer `select` over `bool`** when there might be more than 2 states in the future
2. **Use `relation` not `text`** for foreign keys — you get cascade, expand, and type safety
3. **`json` fields** are schemaless — use sparingly, prefer typed fields
4. **Name collections** in lowercase snake_case (e.g., `blog_posts`, `user_profiles`)
5. **Index early** — add indexes for any field used in filters or sorts
6. **`maxSelect: 1`** on relations returns a string ID; **`maxSelect: >1` or `0`** returns an array
