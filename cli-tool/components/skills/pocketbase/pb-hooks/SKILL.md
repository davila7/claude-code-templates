---
name: "PocketBase Hooks"
description: "Server-side JavaScript hooks for PocketBase (pb_hooks). Use when writing custom routes, event hooks, cron jobs, sending emails, making HTTP requests, querying the database, or extending PocketBase with server-side logic. Covers the goja ES5 runtime, routing, middleware, all event hooks, DB queries, record operations, and global APIs."
---

# PocketBase Server-Side JavaScript (pb_hooks)

## Runtime Basics

- Files go in `pb_hooks/*.pb.js` (must end with `.pb.js`)
- Engine: **goja** — ES5.1 + some ES6. **No ES6 modules** (`import`/`export`), **no async/await**, **no arrow functions in older versions**. Use `function(){}` and CommonJS `require()`.
- Each file is loaded on app start and on hot-reload
- `__hooks` — absolute path to the pb_hooks directory
- TypeScript declarations: `pb_data/types.d.ts` (auto-generated, useful for IDE support)
- `--hooksPool=25` flag controls concurrent JS goroutines (default: 25)
- Each handler runs in an isolated context — no shared mutable state between requests

## Routing

### Adding routes

```js
routerAdd("GET", "/api/hello/{name}", function(e) {
    var name = e.request.pathValue("name")
    return e.json(200, { "message": "Hello " + name })
}, /* optional middleware */)
```

### Path patterns
- `{name}` — named path parameter
- `{path...}` — wildcard (matches rest of path)
- `{$}` — exact match (no trailing slash)

### Response methods

| Method | Usage |
|--------|-------|
| `e.json(status, data)` | JSON response |
| `e.string(status, text)` | Plain text |
| `e.html(status, html)` | HTML response |
| `e.redirect(status, url)` | Redirect (301/302) |
| `e.blob(status, contentType, bytes)` | Binary data |
| `e.stream(status, contentType, reader)` | Streaming response |
| `e.noContent(status)` | No body (204) |

### Reading request data

```js
// Body (JSON)
var body = new DynamicModel({ name: "", age: 0 })
e.bindBody(body)

// Query params
var page = e.request.url.query().get("page")

// Headers
var token = e.request.header.get("Authorization")

// Uploaded files
var files = e.findUploadedFiles("document")  // returns array of *filesystem.File

// Auth state
var user = e.auth          // current auth record or null
var isSuper = e.hasSuperuserAuth()
```

## Middleware

### Built-in middleware

```js
routerAdd("GET", "/api/protected", handler,
    $apis.requireAuth(),                // any authenticated user
    // OR
    $apis.requireAuth("users"),         // only "users" collection
    // OR
    $apis.requireSuperuserAuth(),       // superusers only
    // OR
    $apis.requireGuestOnly(),           // unauthenticated only
    // OR
    $apis.bodyLimit(5 * 1024 * 1024),   // 5MB body limit
    // OR
    $apis.gzip()                        // gzip compression
)
```

### Global middleware

```js
routerUse(function(e) {
    // runs before every request
    console.log(e.request.method, e.request.url.path)
    return e.next()  // MUST call e.next() to continue
})
```

### Custom route middleware

```js
function myMiddleware(e) {
    // pre-processing
    var result = e.next()  // call next handler
    // post-processing
    return result
}

routerAdd("GET", "/api/test", handler, myMiddleware)
```

Priority: middleware runs in order — first registered, first executed.

## Event Hooks

### Record lifecycle

Each record event has 3 variants:
- `onRecord*Execute` — wraps the default action. Call `e.next()` to proceed.
- `onRecord*AfterSuccess` — runs after successful execution
- `onRecord*AfterError` — runs after execution error

```js
// Before/during create
onRecordCreateExecute(function(e) {
    // e.record — the record being created
    e.record.set("status", "pending")
    return e.next()  // proceed with creation
}, "posts")  // optional collection filter

// After successful create
onRecordCreateAfterSuccessExecute(function(e) {
    // e.record — the created record (has ID now)
    console.log("Created:", e.record.id)
}, "posts")

// After failed create
onRecordCreateAfterErrorExecute(function(e) {
    // e.error — the error
    console.log("Failed:", e.error)
}, "posts")
```

### All record hooks

| Hook | Event object fields |
|------|-------------------|
| `onRecordCreateExecute` | `e.record` |
| `onRecordUpdateExecute` | `e.record` |
| `onRecordDeleteExecute` | `e.record` |
| `onRecordValidate` | `e.record` — add custom validation errors |
| `onRecordEnrich` | `e.record` — modify API response (hide/add fields) |
| `onRecordsListRequest` | `e.records`, `e.result` — modify list response |
| `onRecordRequestCreate` | `e.record` — during API create request |
| `onRecordRequestUpdate` | `e.record` — during API update request |
| `onRecordRequestDelete` | `e.record` — during API delete request |

### Auth hooks

```js
onRecordAuthWithPasswordRequest(function(e) {
    // e.record — the auth record
    // e.password — the provided password
    return e.next()
}, "users")

onRecordAuthWithOAuth2Request(function(e) {
    // e.record — the auth record (may be new)
    // e.oAuth2User — OAuth2 user data
    // e.isNewRecord — true if first OAuth2 login
    return e.next()
}, "users")

onRecordAuthWithOTPRequest(function(e) {
    // e.record — the auth record
    return e.next()
}, "users")

onRecordAuthRefreshRequest(function(e) {
    return e.next()
}, "users")
```

### Realtime hooks

```js
onRealtimeConnectRequest(function(e) {
    // e.client — the SSE client
    // e.idleTimeout — connection timeout
    return e.next()
})

onRealtimeSubscribeRequest(function(e) {
    // e.client
    // e.subscriptions — requested subscriptions
    return e.next()
})
```

### Other hooks

```js
onFileDownloadRequest(function(e) {
    // e.record, e.fileField, e.servedPath, e.servedName
    return e.next()
}, "documents")

onBatchRequest(function(e) {
    // e.batch — array of sub-requests
    return e.next()
})

onCollectionCreateExecute(function(e) {
    // e.collection
    return e.next()
})

// App lifecycle
onBootstrap(function(e) {
    // runs once on app start (after DB is ready)
    return e.next()
})

onTerminate(function(e) {
    // runs on graceful shutdown
    return e.next()
})
```

### Validation hook

```js
onRecordValidate(function(e) {
    if (e.record.getString("title").length < 3) {
        e.error = new ValidationError("title", "Title must be at least 3 characters")
    }
    return e.next()
}, "posts")
```

### Enrich hook (modify API response)

```js
onRecordEnrich(function(e) {
    // Hide field from non-owners
    if (!e.requestInfo.auth || e.requestInfo.auth.id !== e.record.getString("author")) {
        e.record.set("private_notes", undefined)
    }
    // Add computed field
    e.record.withCustomData(true)
    e.record.set("displayName", e.record.getString("first") + " " + e.record.getString("last"))
    return e.next()
}, "users")
```

## Database

### Query builder

```js
var results = arrayOf(new DynamicModel({ id: "", title: "", count: 0 }))

$app.db()
    .select("id", "title", "COUNT(comments) as count")
    .from("posts")
    .where($dbx.hashExp({ status: "active" }))
    .andWhere($dbx.like("title", "hello"))
    .orderBy("created DESC")
    .limit(10)
    .offset(0)
    .all(results)  // populates results array
```

### Execution methods

| Method | Returns |
|--------|---------|
| `.all(results)` | Populates array |
| `.one(result)` | Single record |
| `.execute()` | For INSERT/UPDATE/DELETE |

### Raw queries

```js
$app.db().newQuery("SELECT * FROM posts WHERE status = {:status}")
    .bind({ status: "active" })
    .all(results)
```

**Always use named params `{:param}`** — never concatenate SQL strings.

### $dbx expressions

```js
$dbx.hashExp({ field: "value" })           // field = "value"
$dbx.hashExp({ field: ["a", "b"] })        // field IN ("a", "b")
$dbx.not($dbx.hashExp({ field: "value" })) // NOT (field = "value")
$dbx.and(expr1, expr2)                     // expr1 AND expr2
$dbx.or(expr1, expr2)                      // expr1 OR expr2
$dbx.like("field", "val")                  // field LIKE "%val%"
$dbx.orLike("field", "a", "b")            // field LIKE "%a%" OR field LIKE "%b%"
$dbx.notLike("field", "val")              // field NOT LIKE "%val%"
$dbx.in("field", "a", "b", "c")           // field IN ("a", "b", "c")
$dbx.notIn("field", "a", "b")             // field NOT IN ("a", "b")
$dbx.between("field", 1, 10)              // field BETWEEN 1 AND 10
$dbx.exists($dbx.exp("SELECT 1 FROM t WHERE ..."))
$dbx.exp("raw SQL expression", optionalParams)
```

### Transactions

```js
$app.runInTransaction(function(txApp) {
    // use txApp instead of $app inside transaction
    var record = txApp.findRecordById("posts", "RECORD_ID")
    record.set("views", record.getInt("views") + 1)
    txApp.save(record)
})
```

## Record Operations

### Find records

```js
// By ID
var record = $app.findRecordById("posts", "RECORD_ID")

// By field value
var record = $app.findFirstRecordByData("users", "email", "user@example.com")

// By filter expression (same syntax as API rules)
var record = $app.findFirstRecordByFilter("posts", "slug = {:slug}", { slug: "my-post" })

// Multiple records with filter
var records = $app.findRecordsByFilter(
    "posts",                    // collection
    "status = 'active'",        // filter
    "-created",                 // sort
    10,                         // limit
    0                           // offset
)

// All records (no limit)
var records = $app.findAllRecords("posts", $dbx.hashExp({ status: "active" }))

// Count
var total = $app.countRecords("posts", $dbx.hashExp({ status: "active" }))
```

### Create records

```js
var collection = $app.findCollectionByNameOrId("posts")
var record = new Record(collection)
record.set("title", "My Post")
record.set("author", "USER_ID")
record.set("tags", ["tag1", "tag2"])  // multi-relation
$app.save(record)
// record.id is now set
```

### Update records

```js
var record = $app.findRecordById("posts", "RECORD_ID")
record.set("title", "Updated Title")
$app.save(record)
```

### Delete records

```js
var record = $app.findRecordById("posts", "RECORD_ID")
$app.delete(record)
```

### Record getters

```js
record.id
record.getString("title")
record.getInt("count")
record.getFloat("price")
record.getBool("active")
record.getStringSlice("tags")  // for multi-valued fields
record.getDateTime("created")  // returns DateTime object
record.get("field")            // raw interface{} value
```

### Expand relations

```js
$app.expandRecord(record, ["author", "tags"], null)
var author = record.expandedOne("author")   // single relation
var tags = record.expandedAll("tags")        // multi relation
```

### File operations

```js
// Assign file from path
var file = $filesystem.fileFromPath("/path/to/file.pdf")
record.set("document", file)

// Assign file from bytes
var file = $filesystem.fileFromBytes(byteArray, "report.pdf")
record.set("document", file)

// Assign file from URL
var file = $filesystem.fileFromURL("https://example.com/file.pdf")
record.set("document", file)

$app.save(record)
```

## Cron Jobs

```js
cronAdd("daily_cleanup", "0 3 * * *", function() {
    // runs every day at 3:00 AM
    var old = $app.findRecordsByFilter("temp", "created < @now - 30d", "", 0, 0)
    for (var i = 0; i < old.length; i++) {
        $app.delete(old[i])
    }
})

cronRemove("daily_cleanup")  // remove a previously registered job
```

Cron expressions: `minute hour day month weekday`
Preview registered crons: Dashboard > Settings > Crons

## Email

```js
var message = new MailerMessage()
message.from = { address: $app.settings().meta.senderAddress, name: $app.settings().meta.senderName }
message.to = [{ address: "user@example.com", name: "User" }]
message.subject = "Hello"
message.html = "<h1>Hello World</h1>"
// message.bcc, message.cc — optional arrays
// message.attachments — optional

$app.newMailClient().send(message)
```

### Customize system emails

```js
onMailerRecordVerificationSend(function(e) {
    // e.record, e.message
    e.message.subject = "Custom verification subject"
    e.message.html = "<p>Custom HTML with token: " + e.meta.token + "</p>"
    return e.next()
}, "users")

// Similar hooks: onMailerRecordResetPasswordSend, onMailerRecordEmailChangeSend, onMailerRecordOTPSend
```

## HTTP Client

```js
var res = $http.send({
    url: "https://api.example.com/data",
    method: "POST",
    body: JSON.stringify({ key: "value" }),
    headers: { "Content-Type": "application/json", "Authorization": "Bearer TOKEN" },
    timeout: 30  // seconds
})

// Response
res.statusCode  // number
res.json         // parsed JSON (if applicable)
res.headers      // object
res.cookies      // object
res.body         // raw string

// Multipart upload
var formData = new FormData()
formData.append("file", $filesystem.fileFromPath("/path/to/file.pdf"))
formData.append("name", "test")

var res = $http.send({
    url: "https://api.example.com/upload",
    method: "POST",
    body: formData
})
```

**No streaming support** in `$http.send()`.

## Error Types

```js
throw new BadRequestError("message", optionalData)     // 400
throw new UnauthorizedError("message", optionalData)    // 401
throw new ForbiddenError("message", optionalData)       // 403
throw new NotFoundError("message", optionalData)        // 404
throw new TooManyRequestsError("message", optionalData) // 429
throw new InternalServerError("message", optionalData)  // 500
throw new ApiError(statusCode, "message", optionalData) // custom status

// Validation errors (for onRecordValidate)
new ValidationError("field_name", "error message")
```

## Global Objects

| Object | Purpose |
|--------|---------|
| `$app` | Main app instance — DB, records, collections, settings |
| `$apis` | API middleware helpers |
| `$security` | JWT, encryption, random string generation |
| `$os` | OS operations: `$os.exec()`, `$os.readDir()`, `$os.tempDir()` |
| `$http` | HTTP client |
| `$filesystem` | File helpers (`fileFromPath`, `fileFromBytes`, `fileFromURL`) |
| `$dbx` | SQL expression builders |

### $security examples

```js
var token = $security.randomString(32)
var hash = $security.hs256("data", "secret")
var encrypted = $security.encrypt("data", "encryptionKey")
var decrypted = $security.decrypt(encrypted, "encryptionKey")
```

### $os examples

```js
var result = $os.exec("ls", ["-la", "/tmp"])  // returns { code, output }
var files = $os.readDir("/path")
var tmp = $os.tempDir("prefix")
```

## Common Patterns

### Auto-assign author on create

```js
onRecordCreateExecute(function(e) {
    if (e.auth) {
        e.record.set("author", e.auth.id)
    }
    return e.next()
}, "posts")
```

### Cascade custom logic on delete

```js
onRecordDeleteExecute(function(e) {
    // Clean up related data not handled by cascadeDelete
    var comments = $app.findRecordsByFilter("comments", "post = {:id}", "-created", 0, 0, { id: e.record.id })
    for (var i = 0; i < comments.length; i++) {
        $app.delete(comments[i])
    }
    return e.next()
}, "posts")
```

### Rate limiting per user

```js
routerAdd("POST", "/api/expensive-action", function(e) {
    var recent = $app.countRecords("actions",
        $dbx.hashExp({ user: e.auth.id }),
        $dbx.exp("created > {:cutoff}", { cutoff: new DateTime().sub(1 * 60) })  // last minute
    )
    if (recent >= 5) {
        throw new TooManyRequestsError("Rate limit exceeded")
    }
    // proceed with action
    return e.json(200, { ok: true })
}, $apis.requireAuth())
```

### Webhook on record change

```js
onRecordCreateAfterSuccessExecute(function(e) {
    try {
        $http.send({
            url: "https://hooks.example.com/webhook",
            method: "POST",
            body: JSON.stringify({
                event: "record.create",
                collection: e.record.collection().name,
                record: e.record
            }),
            headers: { "Content-Type": "application/json" },
            timeout: 10
        })
    } catch (err) {
        console.log("Webhook failed:", err)
    }
})
```
