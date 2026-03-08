---
name: "PocketBase SDK"
description: "JavaScript SDK usage for PocketBase client applications. Use when calling PocketBase from frontend or Node.js, authenticating users, subscribing to realtime events, uploading files, or working with the PocketBase JS/TS SDK. Covers CRUD, auth flows, authStore, realtime SSE, file handling, batch operations, and query syntax."
---

# PocketBase JavaScript SDK

## Installation & Setup

```bash
npm install pocketbase
# or
yarn add pocketbase
# or
<script src="https://cdn.jsdelivr.net/npm/pocketbase@0.25.0/dist/pocketbase.umd.js"></script>
```

```js
import PocketBase from 'pocketbase'

const pb = new PocketBase('http://127.0.0.1:8090')
```

## CRUD Operations

### List records

```js
const records = await pb.collection('posts').getList(1, 20, {
    filter: 'status = "active" && created > "2024-01-01"',
    sort: '-created,title',
    expand: 'author,tags',
    fields: 'id,title,author,created',  // partial response
    skipTotal: true,  // skip COUNT query for better performance
})

// records.page, records.perPage, records.totalItems, records.totalPages, records.items
```

### Get full list (auto-paginate)

```js
const allRecords = await pb.collection('posts').getFullList({
    filter: 'status = "active"',
    sort: '-created',
    batch: 200,  // records per request (default: 200)
})
```

### View single record

```js
const record = await pb.collection('posts').getOne('RECORD_ID', {
    expand: 'author',
})
```

### Get first matching record

```js
const record = await pb.collection('posts').getFirstListItem('slug = "my-post"', {
    expand: 'author',
})
```

### Create record

```js
const record = await pb.collection('posts').create({
    title: 'My Post',
    body: 'Content here',
    author: 'USER_ID',
    status: 'draft',
})
```

### Update record

```js
const record = await pb.collection('posts').update('RECORD_ID', {
    title: 'Updated Title',
    status: 'published',
})
```

### Delete record

```js
await pb.collection('posts').delete('RECORD_ID')
```

## Query Parameters

### Filter syntax

Same as API rules filter syntax. Common patterns:

```js
// Equality
filter: 'status = "active"'

// Contains (LIKE)
filter: 'title ~ "hello"'

// Multi-relation contains
filter: 'tags ?= "TAG_ID"'

// Date comparison
filter: 'created > "2024-01-01 00:00:00"'

// Relative dates
filter: 'created > @now - 7d'

// Logical operators
filter: 'status = "active" && author = "USER_ID"'
filter: '(type = "a" || type = "b") && active = true'

// Null check
filter: 'parent = null'
filter: 'parent != null'
```

### Sort syntax

```js
sort: '-created'          // descending by created
sort: 'title'             // ascending by title
sort: '-created,title'    // multi-field sort
sort: '@random'           // random order
```

### Expand relations

```js
expand: 'author'                    // single relation
expand: 'author,tags'               // multiple relations
expand: 'author.team'               // nested expand (author's team)
expand: 'comments_via_post'         // back-relation (comments that reference this post)
expand: 'comments_via_post.author'  // nested back-relation expand
```

### Fields (partial response)

```js
fields: 'id,title,created'
fields: 'id,expand.author.name'     // include expanded field
fields: '*,expand.author.name'      // all fields + specific expand
```

## Authentication

### Email/password

```js
const authData = await pb.collection('users').authWithPassword('user@example.com', 'password123')
// authData.token, authData.record
```

### OAuth2 (all-in-one)

```js
// Opens popup/redirect for OAuth2 provider
const authData = await pb.collection('users').authWithOAuth2({ provider: 'google' })
// or with redirect
const authData = await pb.collection('users').authWithOAuth2({
    provider: 'google',
    urlCallback: (url) => { window.location.href = url }
})
```

### OTP (one-time password)

```js
// Step 1: Request OTP
const result = await pb.collection('users').requestOTP('user@example.com')
// result.otpId

// Step 2: Verify OTP
const authData = await pb.collection('users').authWithOTP(result.otpId, '123456')
```

### MFA (multi-factor authentication)

MFA is triggered automatically when enabled. After primary auth returns a `mfaId`:

```js
try {
    await pb.collection('users').authWithPassword('user@example.com', 'password')
} catch (err) {
    if (err.response?.mfaId) {
        // Need second factor — e.g., OTP
        const otpResult = await pb.collection('users').requestOTP('user@example.com')
        await pb.collection('users').authWithOTP(otpResult.otpId, '123456', {
            mfaId: err.response.mfaId
        })
    }
}
```

### Auth store

```js
pb.authStore.token       // current JWT token
pb.authStore.record      // current auth record
pb.authStore.isValid     // token not expired
pb.authStore.isAdmin     // deprecated — check record.collectionName === '_superusers'
pb.authStore.isSuperuser // check if superuser

// Listen for auth changes
pb.authStore.onChange((token, record) => {
    console.log('Auth changed:', record?.id)
})

// Clear auth
pb.authStore.clear()

// Refresh auth (get fresh token + record)
await pb.collection('users').authRefresh()
```

### Password reset

```js
// Request reset email
await pb.collection('users').requestPasswordReset('user@example.com')

// Confirm reset (usually from email link)
await pb.collection('users').confirmPasswordReset(token, newPassword, newPasswordConfirm)
```

### Email verification

```js
await pb.collection('users').requestVerification('user@example.com')
await pb.collection('users').confirmVerification(token)
```

### Email change

```js
await pb.collection('users').requestEmailChange('new@example.com')
await pb.collection('users').confirmEmailChange(token, password)
```

## Realtime (SSE)

### Subscribe to record changes

```js
// Subscribe to all changes in a collection
pb.collection('posts').subscribe('*', function(e) {
    // e.action: 'create' | 'update' | 'delete'
    // e.record: the affected record
    console.log(e.action, e.record.id)
}, {
    expand: 'author',  // expand relations in realtime events
    filter: 'status = "active"',  // only receive matching records
})

// Subscribe to a specific record
pb.collection('posts').subscribe('RECORD_ID', function(e) {
    console.log('Record changed:', e.record)
})

// Unsubscribe
pb.collection('posts').unsubscribe('*')        // from specific topic
pb.collection('posts').unsubscribe('RECORD_ID')
pb.collection('posts').unsubscribe()            // from all collection topics
pb.realtime.unsubscribe()                       // from everything
```

### Connection management

```js
// The SDK auto-reconnects on disconnect
// You can listen for connect/disconnect:
pb.realtime.onConnect = function() {
    console.log('Connected')
}
pb.realtime.onDisconnect = function() {
    console.log('Disconnected')
}
```

## File Upload & Download

### Upload files

```js
// Via FormData (browser)
const formData = new FormData()
formData.append('title', 'My Post')
formData.append('document', fileInput.files[0])
formData.append('images', fileInput1.files[0])  // multi-file
formData.append('images', fileInput2.files[0])

const record = await pb.collection('posts').create(formData)

// Via object (Node.js or when you have the file as a Blob/File)
const record = await pb.collection('posts').create({
    title: 'My Post',
    document: new File([blob], 'file.pdf'),
})
```

### Delete a file

```js
// Set field to empty to delete
await pb.collection('posts').update('RECORD_ID', {
    document: null,  // deletes the file
})

// For multi-file: remove specific file
await pb.collection('posts').update('RECORD_ID', {
    'images-': ['filename_to_remove.jpg'],  // minus suffix removes
})
```

### Get file URL

```js
const url = pb.files.getURL(record, record.document)
// https://example.com/api/files/COLLECTION_ID/RECORD_ID/filename.pdf

// With thumbnail (for image fields)
const thumb = pb.files.getURL(record, record.cover, { thumb: '100x100' })
// Supported: WxH, WxHt (top), WxHb (bottom), WxHf (fit), 0xH, Wx0
```

### Protected files

For files in collections with view rules, include the auth token:

```js
const url = pb.files.getURL(record, record.document, { token: pb.authStore.token })
```

## Batch Operations

Send multiple create/update/delete in one request (transactional):

```js
const batch = pb.createBatch()

batch.collection('posts').create({ title: 'Post 1' })
batch.collection('posts').create({ title: 'Post 2' })
batch.collection('posts').update('RECORD_ID', { title: 'Updated' })
batch.collection('comments').delete('COMMENT_ID')

const results = await batch.send()
// results[0], results[1], ... correspond to each operation
```

## Error Handling

```js
try {
    const record = await pb.collection('posts').create(data)
} catch (err) {
    // err.status — HTTP status code
    // err.response — full error response
    // err.response.message — error message
    // err.response.data — field-level validation errors
    //   e.g., { title: { code: "validation_required", message: "Missing required value." } }
    // err.isAbort — true if request was cancelled

    if (err.status === 400) {
        // Validation error
        for (const [field, error] of Object.entries(err.response.data)) {
            console.log(`${field}: ${error.message}`)
        }
    }
}
```

## Advanced

### Auto-cancellation

By default, duplicate pending requests to the same endpoint are auto-cancelled. Disable per-request:

```js
await pb.collection('posts').getList(1, 20, {
    requestKey: null,  // disable auto-cancel for this request
})

// Or use a custom key to group cancellations
await pb.collection('posts').getList(1, 20, {
    requestKey: 'my-custom-key',
})
```

### Custom headers

```js
// Per-request
await pb.collection('posts').getList(1, 20, {
    headers: { 'X-Custom': 'value' }
})

// Global (all requests)
pb.beforeSend = function(url, options) {
    options.headers['X-Custom'] = 'value'
    return { url, options }
}

// Intercept response
pb.afterSend = function(response, data) {
    // modify data if needed
    return data
}
```

### SSR / Server-side

```js
// Load auth from cookie (e.g., in Next.js/SvelteKit)
pb.authStore.loadFromCookie(request.headers.get('cookie') || '')

// Export auth to cookie
const cookie = pb.authStore.exportToCookie({ httpOnly: false })
response.headers.set('set-cookie', cookie)
```

### Sending as superuser

```js
const pb = new PocketBase('http://127.0.0.1:8090')
await pb.collection('_superusers').authWithPassword('admin@example.com', 'password')
// Now all requests are authenticated as superuser
```
