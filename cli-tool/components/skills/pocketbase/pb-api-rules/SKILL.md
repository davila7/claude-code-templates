---
name: "PocketBase API Rules"
description: "API rules and filter expressions for PocketBase access control. Use when setting permissions, writing filter expressions, configuring who can access what, or debugging 403/404 responses. Covers all 5 rule types, filter syntax, operators, request/collection macros, and field modifiers."
---

# PocketBase API Rules & Filter Expressions

## Rule Types

Each collection has 5 rule types. Each rule is a **filter expression** that must evaluate to `true` for the request to proceed.

| Rule | Controls | Locked = | Empty string = |
|------|----------|----------|----------------|
| **List** | `GET /api/collections/{name}/records` | nobody can list | everyone can list |
| **View** | `GET /api/collections/{name}/records/{id}` | nobody can view | everyone can view |
| **Create** | `POST /api/collections/{name}/records` | nobody can create | everyone can create |
| **Update** | `PATCH /api/collections/{name}/records/{id}` | nobody can update | everyone can update |
| **Delete** | `DELETE /api/collections/{name}/records/{id}` | nobody can delete | everyone can delete |

**Critical**: `null`/locked means only superusers can perform the action (regular users and guests are denied). Empty string `""` means EVERYONE including guests. Superusers always bypass API rules entirely — see below.

## Superuser Bypass

Superusers (formerly admins) **always bypass API rules**. Rules only apply to regular auth records and guests.

## Filter Syntax

### Operators

| Operator | Meaning | Example |
|----------|---------|---------|
| `=` | Equal | `status = "active"` |
| `!=` | Not equal | `status != "draft"` |
| `>` | Greater than | `count > 5` |
| `>=` | Greater or equal | `count >= 5` |
| `<` | Less than | `count < 10` |
| `<=` | Less or equal | `count <= 10` |
| `~` | LIKE (contains) | `title ~ "hello"` |
| `!~` | NOT LIKE | `title !~ "spam"` |
| `?=` | Any/has (array contains) | `tags ?= "TAG_ID"` |
| `?!=` | None (array not contains) | `tags ?!= "TAG_ID"` |
| `?>` | Any greater than | `scores ?> 90` |
| `?>=` | Any greater or equal | `scores ?>= 90` |
| `?<` | Any less than | `scores ?< 10` |
| `?<=` | Any less or equal | `scores ?<= 10` |
| `?~` | Any LIKE | `emails ?~ "@gmail.com"` |
| `?!~` | Any NOT LIKE | `emails ?!~ "@test.com"` |

**Critical**: use `?=` (not `=`) for multi-valued fields (multi-select, multi-relation, multi-file). `=` checks the raw JSON string, `?=` checks individual values.

### Logical Operators

```
status = "active" && author = @request.auth.id
status = "active" || status = "featured"
```

Parentheses for grouping: `(a = 1 || b = 2) && c = 3`

### Values

- Strings: `"value"` or `'value'`
- Numbers: `123`, `45.67`
- Booleans: `true`, `false`
- `null` — empty/missing value
- Identifiers: field names, macros

## Request Macros (`@request.*`)

Access the current request context in rules:

| Macro | Type | Description |
|-------|------|-------------|
| `@request.auth.id` | `string` | Current auth record ID (empty if guest) |
| `@request.auth.email` | `string` | Current auth record email |
| `@request.auth.verified` | `bool` | Whether email is verified |
| `@request.auth.collectionId` | `string` | Auth collection ID |
| `@request.auth.collectionName` | `string` | Auth collection name |
| `@request.auth.*` | `any` | Any field from the auth record |
| `@request.body.fieldName` | `any` | Field value from request body |
| `@request.query.paramName` | `string` | URL query parameter |
| `@request.headers.name` | `string` | Request header (lowercase key) |
| `@request.method` | `string` | HTTP method (GET/POST/PATCH/DELETE) |

### Auth record relations

You can traverse relations on the auth record:
```
@request.auth.team.owner = @request.auth.id
```

## Collection Macros (`@collection.*`)

Cross-collection lookups without explicit joins:

```
@collection.memberships.user ?= @request.auth.id &&
@collection.memberships.team ?= team
```

This checks if a record exists in the `memberships` collection where the user matches the current auth user and the team matches the current record's team field.

**Note**: `@collection.*` performs an implicit EXISTS subquery. It's powerful but can be slow on large datasets — add indexes.

## Field Modifiers

Use in create/update rules to validate specific field behaviors:

| Modifier | Works on | Description |
|----------|----------|-------------|
| `:isset` | `@request.body.*` | True if the field was sent in the request (even if empty) |
| `:changed` | record field | True if the field value differs from current stored value (update only) |
| `:length` | `string`/`array` | Returns the length |
| `:each` | `array` | Applies the condition to each element |
| `:lower` | `string` | Lowercased value |

### Examples

```
// Only allow changing status if user is owner
status:changed = false || author = @request.auth.id

// Prevent setting role on create
@request.body.role:isset = false

// Require at least 2 tags
@request.body.tags:length >= 2

// Check each tag is from allowed list
@request.body.tags:each ?= @collection.allowed_tags.id
```

## Datetime Macros

| Macro | Example output |
|-------|----------------|
| `@now` | `2024-01-15 10:30:00.000Z` |
| `@second` | `2024-01-15 10:30:00.000Z` |
| `@minute` | `2024-01-15 10:30:00.000Z` |
| `@hour` | `2024-01-15 10:00:00.000Z` |
| `@day` | `2024-01-15 00:00:00.000Z` |
| `@month` | `2024-01-01 00:00:00.000Z` |
| `@year` | `2024-01-01 00:00:00.000Z` |
| `@todayStart` | `2024-01-15 00:00:00.000Z` |
| `@todayEnd` | `2024-01-15 23:59:59.999Z` |
| `@monthStart` | `2024-01-01 00:00:00.000Z` |
| `@monthEnd` | `2024-01-31 23:59:59.999Z` |
| `@yearStart` | `2024-01-01 00:00:00.000Z` |
| `@yearEnd` | `2024-12-31 23:59:59.999Z` |

Arithmetic: `@now - 7d`, `@now + 1h`, `@now - 30m`

## `geoDistance()`

For location-based filtering:

```
geoDistance(lat, lon, 40.7128, -74.0060) <= 10000
```

Arguments: `geoDistance(latField, lonField, targetLat, targetLon)` — returns meters.

## Common Patterns

### Owner-only access
```
// View/Update/Delete rule:
author = @request.auth.id
```

### Authenticated users only
```
@request.auth.id != ""
```

### Verified users only
```
@request.auth.verified = true
```

### Role-based access
```
@request.auth.role = "admin" || author = @request.auth.id
```

### Team membership
```
@collection.team_members.user ?= @request.auth.id &&
@collection.team_members.team ?= team
```

### Public read, owner write
```
// List/View: ""  (empty = everyone)
// Create: @request.auth.id != ""
// Update/Delete: author = @request.auth.id
```

### Prevent field modification
```
// Update rule: prevent changing `owner` after creation
owner:changed = false
```

### Time-limited access
```
expires > @now
```
