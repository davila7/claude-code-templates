# Neon and Drizzle Integration

Integration patterns, configurations, and optimizations for using **Drizzle ORM** with **Neon** Postgres.

For official documentation:

```bash
curl -H "Accept: text/markdown" https://neon.tech/docs/guides/drizzle
```

## Choosing the Right Driver

Drizzle ORM works with multiple Postgres drivers. See `connection-methods.md` for the full decision tree.

| Platform                | TCP Support | Pooling             | Recommended Driver         |
| ----------------------- | ----------- | ------------------- | -------------------------- |
| Vercel (Fluid)          | Yes         | `@vercel/functions` | `pg` (node-postgres)       |
| Cloudflare (Hyperdrive) | Yes         | Hyperdrive          | `pg` (node-postgres)       |
| Cloudflare Workers      | No          | No                  | `@neondatabase/serverless` |
| Netlify Functions       | No          | No                  | `@neondatabase/serverless` |
| Deno Deploy             | No          | No                  | `@neondatabase/serverless` |
| Railway / Render        | Yes         | Built-in            | `pg` (node-postgres)       |

## Connection Setup

### 1. TCP with node-postgres (Long-Running Servers)

Best for Railway, Render, traditional VPS.

```bash
npm install drizzle-orm pg
npm install -D drizzle-kit @types/pg dotenv
```

```typescript
// src/db.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool });
```

### 2. Vercel Fluid Compute with Connection Pooling

```bash
npm install drizzle-orm pg @vercel/functions
npm install -D drizzle-kit @types/pg
```

```typescript
// src/db.ts
import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
attachDatabasePool(pool);

export const db = drizzle({ client: pool, schema });
```

### 3. HTTP Adapter (Edge Without TCP)

For Cloudflare Workers, Netlify Edge, Deno Deploy. Does NOT support interactive transactions.

```bash
npm install drizzle-orm @neondatabase/serverless
npm install -D drizzle-kit dotenv
```

```typescript
// src/db.ts
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql);
```

### 4. WebSocket Adapter (Edge with Transactions)

```bash
npm install drizzle-orm @neondatabase/serverless ws
npm install -D drizzle-kit dotenv @types/ws
```

```typescript
// src/db.ts
import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws; // Required for Node.js < v22

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool);
```

## Drizzle Config

```typescript
// drizzle.config.ts
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

## Migrations

```bash
# Generate migrations
npx drizzle-kit generate

# Apply migrations
npx drizzle-kit migrate
```

## Schema Definition

```typescript
// src/schema.ts
import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role").default("user").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;

export const postsTable = pgTable("posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Post = typeof postsTable.$inferSelect;
export type NewPost = typeof postsTable.$inferInsert;
```

## Query Patterns

### Batch Inserts

```typescript
export async function batchInsertUsers(users: NewUser[]) {
  return db.insert(usersTable).values(users).returning();
}
```

### Prepared Statements

```typescript
import { sql } from "drizzle-orm";

export const getUsersByRolePrepared = db
  .select()
  .from(usersTable)
  .where(sql`${usersTable.role} = $1`)
  .prepare("get_users_by_role");

// Usage: getUsersByRolePrepared.execute(['admin'])
```

### Transactions

```typescript
export async function createUserWithPosts(user: NewUser, posts: NewPost[]) {
  return await db.transaction(async (tx) => {
    const [newUser] = await tx.insert(usersTable).values(user).returning();

    if (posts.length > 0) {
      await tx.insert(postsTable).values(
        posts.map((post) => ({
          ...post,
          userId: newUser.id,
        })),
      );
    }

    return newUser;
  });
}
```

## Working with Neon Branches

```typescript
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

const getBranchUrl = () => {
  const env = process.env.NODE_ENV;
  if (env === "development") return process.env.DEV_DATABASE_URL;
  if (env === "test") return process.env.TEST_DATABASE_URL;
  return process.env.DATABASE_URL;
};

const sql = neon(getBranchUrl()!);
export const db = drizzle({ client: sql });
```

## Error Handling

```typescript
export async function safeNeonOperation<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    if (error.message?.includes("connection pool timeout")) {
      console.error("Neon connection pool timeout");
    }
    throw error;
  }
}
```

## Best Practices

1. **Connection Management** - See `connection-methods.md` for platform-specific guidance
2. **Neon Features** - Utilize branching for development/testing (see `features.md`)
3. **Query Optimization** - Batch operations, use prepared statements
4. **Schema Design** - Leverage Postgres-specific features, use appropriate indexes
