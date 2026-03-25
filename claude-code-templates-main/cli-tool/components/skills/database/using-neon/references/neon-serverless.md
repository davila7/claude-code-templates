# Neon Serverless Driver

Patterns and best practices for connecting to Neon databases in serverless environments using the `@neondatabase/serverless` driver. The driver connects over **HTTP** for fast, single queries or **WebSockets** for `node-postgres` compatibility and interactive transactions.

For official documentation:

```bash
curl -H "Accept: text/markdown" https://neon.tech/docs/serverless/serverless-driver
```

## Installation

```bash
# Using npm
npm install @neondatabase/serverless

# Using JSR
bunx jsr add @neon/serverless
```

**Note:** Version 1.0.0+ requires **Node.js v19 or later**.

For projects that depend on `pg` but want to use Neon's WebSocket-based connection pool:

```json
"dependencies": {
  "pg": "npm:@neondatabase/serverless@^0.10.4"
},
"overrides": {
  "pg": "npm:@neondatabase/serverless@^0.10.4"
}
```

## Connection String

Always use environment variables:

```typescript
// For HTTP queries
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);

// For WebSocket connections
import { Pool } from "@neondatabase/serverless";
const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
```

**Never hardcode credentials:**

```typescript
// AVOID
const sql = neon("postgres://username:password@host.neon.tech/neondb");
```

## HTTP Queries with `neon` function

Ideal for simple, "one-shot" queries in serverless/edge environments. Uses HTTP `fetch` - fastest method for single queries.

### Parameterized Queries

Use tagged template literals for safe parameter interpolation:

```typescript
const [post] = await sql`SELECT * FROM posts WHERE id = ${postId}`;
```

For manually constructed queries:

```typescript
const [post] = await sql.query("SELECT * FROM posts WHERE id = $1", [postId]);
```

**Never concatenate user input:**

```typescript
// AVOID: SQL Injection Risk
const [post] = await sql("SELECT * FROM posts WHERE id = " + postId);
```

### Configuration Options

```typescript
// Return rows as arrays instead of objects
const sqlArrayMode = neon(process.env.DATABASE_URL!, { arrayMode: true });
const rows = await sqlArrayMode`SELECT id, title FROM posts`;
// rows -> [[1, "First Post"], [2, "Second Post"]]

// Get full results including row count and field metadata
const sqlFull = neon(process.env.DATABASE_URL!, { fullResults: true });
const result = await sqlFull`SELECT * FROM posts LIMIT 1`;
// result -> { rows: [...], fields: [...], rowCount: 1, ... }
```

## WebSocket Connections with `Pool` and `Client`

Use for `node-postgres` compatibility, interactive transactions, or session support.

### WebSocket Configuration

For Node.js v21 and earlier:

```typescript
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

// Required for Node.js < v22
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
```

### Serverless Lifecycle Management

Create, use, and close the pool within the same invocation:

```typescript
// Vercel Edge Functions example
export default async (req: Request, ctx: ExecutionContext) => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

  try {
    const { rows } = await pool.query("SELECT * FROM users");
    return new Response(JSON.stringify(rows));
  } catch (err) {
    console.error(err);
    return new Response("Database error", { status: 500 });
  } finally {
    ctx.waitUntil(pool.end());
  }
};
```

**Avoid** creating a global `Pool` instance outside the handler.

## Transactions

### HTTP Transactions

For running multiple queries in a single, non-interactive transaction:

```typescript
const [newUser, newProfile] = await sql.transaction(
  [
    sql`INSERT INTO users(name) VALUES(${name}) RETURNING id`,
    sql`INSERT INTO profiles(user_id, bio) VALUES(${userId}, ${bio})`,
  ],
  {
    isolationLevel: "ReadCommitted",
    readOnly: false,
  },
);
```

### Interactive Transactions

For complex transactions with conditional logic:

```typescript
const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  const {
    rows: [{ id }],
  } = await client.query("INSERT INTO users(name) VALUES($1) RETURNING id", [
    name,
  ]);
  await client.query("INSERT INTO profiles(user_id, bio) VALUES($1, $2)", [
    id,
    bio,
  ]);
  await client.query("COMMIT");
} catch (err) {
  await client.query("ROLLBACK");
  throw err;
} finally {
  client.release();
  await pool.end();
}
```

## Environment-Specific Optimizations

```javascript
// For Vercel Edge Functions, specify nearest region
export const config = {
  runtime: "edge",
  regions: ["iad1"], // Region nearest to your Neon DB
};

// For Cloudflare Workers, consider using Hyperdrive
// https://neon.tech/blog/hyperdrive-neon-faq
```

## ORM Integration

For Drizzle ORM integration with the serverless driver, see `neon-drizzle.md`.

### Prisma

```typescript
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon, PrismaNeonHTTP } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";
import ws from "ws";

const connectionString = process.env.DATABASE_URL;
neonConfig.webSocketConstructor = ws;

// HTTP adapter
const adapterHttp = new PrismaNeonHTTP(connectionString!, {});
export const prismaClientHttp = new PrismaClient({ adapter: adapterHttp });

// WebSocket adapter
const adapterWs = new PrismaNeon({ connectionString });
export const prismaClientWs = new PrismaClient({ adapter: adapterWs });
```

### Kysely

```typescript
import { Pool } from "@neondatabase/serverless";
import { Kysely, PostgresDialect } from "kysely";

const dialect = new PostgresDialect({
  pool: new Pool({ connectionString: process.env.DATABASE_URL }),
});

const db = new Kysely({ dialect });
```

**NOTE:** Do not pass the `neon()` function to ORMs that expect a `node-postgres` compatible `Pool`.

## Error Handling

```javascript
// Pool error handling
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
  process.exit(-1);
});

// Query error handling
try {
  const [post] = await sql`SELECT * FROM posts WHERE id = ${postId}`;
  if (!post) {
    return new Response("Not found", { status: 404 });
  }
} catch (err) {
  console.error("Database query failed:", err);
  return new Response("Server error", { status: 500 });
}
```
