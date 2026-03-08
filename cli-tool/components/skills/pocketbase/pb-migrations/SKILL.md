---
name: "PocketBase Migrations"
description: "Schema migrations and versioning for PocketBase. Use when creating migrations, managing schema versions, syncing collections between environments, using automigrate, or creating collections programmatically. Covers migrate commands, migration file format, snapshot imports, and the _migrations tracking table."
---

# PocketBase Migrations & Schema Versioning

## Overview

PocketBase supports two approaches to schema management:

1. **Auto-migrate** (default in dev) — Dashboard changes auto-generate migration files in `pb_migrations/`
2. **Manual migrations** — write migration files by hand for full control

## CLI Commands

```bash
# Create a new empty migration file
./pocketbase migrate create "add_posts_collection"
# Creates: pb_migrations/1234567890_add_posts_collection.js

# Apply all pending migrations
./pocketbase migrate up

# Revert the last applied migration
./pocketbase migrate down

# Generate a full snapshot of all current collections
./pocketbase migrate collections
# Creates a migration file that recreates all collections from scratch

# Sync migration history with actual DB state (mark all as applied)
./pocketbase migrate history-sync
```

## Auto-migrate Mode

Enabled by default. When you change collections in the Dashboard, PocketBase auto-generates migration files in `pb_migrations/`.

```bash
# Start with auto-migrate (default)
./pocketbase serve

# Disable auto-migrate (production)
./pocketbase serve --automigrate=0
```

**Workflow**:
1. Develop with auto-migrate ON — use Dashboard to design schema
2. Migration files are auto-generated in `pb_migrations/`
3. Commit these files to git
4. Deploy: migrations run automatically on `serve` start
5. In production: use `--automigrate=0` to prevent Dashboard changes from generating new migrations

## Migration File Format

```js
// pb_migrations/1234567890_add_posts_collection.js

migrate(
    // UP — apply migration
    function(app) {
        var collection = new Collection({
            name: "posts",
            type: "base",
            fields: [
                { name: "title", type: "text", required: true },
                { name: "body", type: "editor" },
                { name: "author", type: "relation", collectionId: "USERS_COLLECTION_ID", cascadeDelete: false, maxSelect: 1, required: true },
                { name: "status", type: "select", values: ["draft", "published", "archived"] },
                { name: "published_at", type: "date" },
                { name: "tags", type: "relation", collectionId: "TAGS_COLLECTION_ID", maxSelect: 0 }
            ],
            indexes: [
                "CREATE INDEX idx_posts_author ON posts (author)",
                "CREATE INDEX idx_posts_status ON posts (status)",
                "CREATE UNIQUE INDEX idx_posts_title ON posts (title)"
            ],
            listRule: "",
            viewRule: "",
            createRule: "@request.auth.id != ''",
            updateRule: "author = @request.auth.id",
            deleteRule: "author = @request.auth.id"
        })
        app.save(collection)
    },
    // DOWN — revert migration
    function(app) {
        var collection = app.findCollectionByNameOrId("posts")
        app.delete(collection)
    }
)
```

**Important**: the `app` inside migrations is a transactional instance. If any error occurs, the entire migration is rolled back.

## Creating Collections Programmatically

### Base collection

```js
var collection = new Collection({
    name: "posts",
    type: "base",
    fields: [
        { name: "title", type: "text", required: true, min: 3, max: 200 },
        { name: "slug", type: "text", required: true, autogenerate: { pattern: "slugify(title)" } },
        { name: "body", type: "editor" },
        { name: "cover", type: "file", maxSelect: 1, maxSize: 5242880, mimeTypes: ["image/jpeg", "image/png", "image/webp"] },
        { name: "views", type: "number", min: 0 },
        { name: "metadata", type: "json", maxSize: 2000000 },
        { name: "featured", type: "bool" },
        { name: "published_at", type: "date" }
    ]
})
app.save(collection)
```

### Auth collection

```js
var collection = new Collection({
    name: "users",
    type: "auth",
    fields: [
        { name: "name", type: "text", required: true },
        { name: "avatar", type: "file", maxSelect: 1, maxSize: 5242880 },
        { name: "role", type: "select", values: ["user", "editor", "admin"], required: true }
    ],
    passwordAuth: { enabled: true, identityFields: ["email", "username"] },
    oauth2: { enabled: true },
    otp: { enabled: false },
    mfa: { enabled: false },
    authToken: { duration: 604800 }  // 7 days
})
app.save(collection)
```

### View collection

```js
var collection = new Collection({
    name: "posts_stats",
    type: "view",
    viewQuery: "SELECT p.id, p.title, COUNT(c.id) as comments_count, p.views FROM posts p LEFT JOIN comments c ON c.post = p.id GROUP BY p.id",
    listRule: "",
    viewRule: ""
})
app.save(collection)
```

## Modifying Existing Collections

```js
migrate(function(app) {
    var collection = app.findCollectionByNameOrId("posts")

    // Add a new field
    collection.fields.add({
        name: "subtitle",
        type: "text",
        max: 500
    })

    // Remove a field
    collection.fields.removeByName("old_field")

    // Update API rules
    collection.listRule = "@request.auth.id != ''"
    collection.viewRule = ""

    // Add index
    collection.indexes.push("CREATE INDEX idx_posts_subtitle ON posts (subtitle)")

    app.save(collection)
}, function(app) {
    var collection = app.findCollectionByNameOrId("posts")
    collection.fields.removeByName("subtitle")
    app.save(collection)
})
```

## Raw SQL in Migrations

```js
migrate(function(app) {
    app.db().newQuery("ALTER TABLE posts ADD COLUMN legacy_id TEXT DEFAULT ''").execute()
    app.db().newQuery("UPDATE posts SET legacy_id = id WHERE legacy_id = ''").execute()
}, function(app) {
    app.db().newQuery("ALTER TABLE posts DROP COLUMN legacy_id").execute()
})
```

**Warning**: raw SQL bypasses PocketBase's schema cache. Run `migrate collections` afterward to re-sync if needed.

## Settings & Superuser in Migrations

### Initialize app settings

```js
onBootstrap(function(e) {
    var settings = e.app.settings()
    settings.meta.appName = "My App"
    settings.meta.appURL = "https://myapp.com"
    settings.meta.senderName = "My App"
    settings.meta.senderAddress = "noreply@myapp.com"
    settings.smtp.enabled = true
    settings.smtp.host = "smtp.example.com"
    settings.smtp.port = 587
    settings.smtp.username = $os.getenv("SMTP_USER")
    settings.smtp.password = $os.getenv("SMTP_PASS")
    e.app.save(settings)
    return e.next()
})
```

### Create superuser in migration

```js
migrate(function(app) {
    var superusers = app.findCollectionByNameOrId("_superusers")
    var record = new Record(superusers)
    record.set("email", "admin@example.com")
    record.set("password", "securepassword123")
    app.save(record)
})
```

## Snapshot Migrations

`./pocketbase migrate collections` generates a complete snapshot — useful for:
- Bootstrapping a new environment
- Resetting migration history
- Reviewing full schema in one file

The generated file uses `app.importCollections(collections)` which supports two modes:
- **Default (merge/extend)**: adds new collections and fields, updates existing ones, doesn't delete anything
- **Delete missing**: `app.importCollections(collections, true)` — deletes collections/fields not in the snapshot

## `_migrations` Table

PocketBase tracks applied migrations in the internal `_migrations` table:
- `id` — auto-generated
- `file` — migration filename
- `applied` — timestamp

`migrate history-sync` marks all existing migration files as applied without running them — useful when importing an existing database.

## Best Practices

1. **Dev**: use auto-migrate + Dashboard for schema design, commit generated files
2. **Staging/Prod**: deploy with `--automigrate=0`, migrations run on startup
3. **Always write DOWN migrations** — reversibility saves you when things go wrong
4. **One concern per migration** — don't mix unrelated schema changes
5. **Test migrations**: apply on a copy of production data before deploying
6. **Use `migrate collections`** periodically to snapshot current state for documentation
7. **Never edit applied migrations** — create a new migration to fix issues
8. **Seed data**: use `onBootstrap` hook or a dedicated migration for initial data
