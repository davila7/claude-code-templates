# Neon JS Data API Reference

Complete reference for PostgREST-style database queries using `@neondatabase/neon-js`.

## Client Setup

### Next.js

```typescript
// lib/db/client.ts
import { createClient } from "@neondatabase/neon-js";
import type { Database } from "./database.types";

export const dbClient = createClient<Database>({
  auth: { url: process.env.NEXT_PUBLIC_NEON_AUTH_URL! },
  dataApi: { url: process.env.NEON_DATA_API_URL! },
});
```

### React SPA

```typescript
import { createClient } from "@neondatabase/neon-js";
import { BetterAuthReactAdapter } from "@neondatabase/neon-js/auth/react/adapters";

const client = createClient<Database>({
  auth: {
    adapter: BetterAuthReactAdapter(),
    url: import.meta.env.VITE_NEON_AUTH_URL,
  },
  dataApi: { url: import.meta.env.VITE_NEON_DATA_API_URL },
});
```

### Node.js Backend

```typescript
import { createClient } from "@neondatabase/neon-js";

const client = createClient<Database>({
  auth: { url: process.env.NEON_AUTH_URL! },
  dataApi: { url: process.env.NEON_DATA_API_URL! },
});
```

---

## Query Patterns

All query methods follow PostgREST syntax (same as Supabase).

### Select Queries

**Basic select:**

```typescript
const { data, error } = await client.from("items").select();
```

**Select specific columns:**

```typescript
const { data } = await client.from("items").select("id, name, status");
```

**Select with filters:**

```typescript
const { data } = await client
  .from("items")
  .select("id, name, status")
  .eq("status", "active")
  .order("created_at", { ascending: false })
  .limit(10);
```

**Select single row:**

```typescript
const { data, error } = await client
  .from("items")
  .select("*")
  .eq("id", 1)
  .single();
```

### Insert

**Insert single row:**

```typescript
const { data, error } = await client
  .from("items")
  .insert({ name: "New Item", status: "pending" })
  .select()
  .single();
```

**Insert multiple rows:**

```typescript
const { data, error } = await client
  .from("items")
  .insert([
    { name: "Item 1", status: "pending" },
    { name: "Item 2", status: "pending" },
  ])
  .select();
```

### Update

**Update with filter:**

```typescript
await client.from("items").update({ status: "completed" }).eq("id", 1);
```

**Update and return data:**

```typescript
const { data, error } = await client
  .from("items")
  .update({ status: "completed" })
  .eq("id", 1)
  .select()
  .single();
```

### Delete

**Delete single row:**

```typescript
await client.from("items").delete().eq("id", 1);
```

**Delete and return data:**

```typescript
const { data, error } = await client
  .from("items")
  .delete()
  .eq("id", 1)
  .select()
  .single();
```

### Upsert

```typescript
await client
  .from("items")
  .upsert({ id: 1, name: "Updated Item", status: "active" });
```

---

## Filtering

### Comparison Operators

```typescript
// Equal
.eq("status", "active")

// Not equal
.neq("status", "archived")

// Greater than
.gt("price", 100)

// Greater than or equal
.gte("price", 100)

// Less than
.lt("price", 100)

// Less than or equal
.lte("price", 100)

// Like (pattern matching)
.like("name", "%item%")

// ILike (case-insensitive)
.ilike("name", "%item%")

// Is null
.is("deleted_at", null)

// Is not null
.not("deleted_at", "is", null)

// In array
.in("status", ["active", "pending"])

// Contains (for arrays/JSONB)
.contains("tags", ["important"])
```

### Logical Operators

```typescript
// AND (chained)
.eq("status", "active")
.gt("price", 100)

// OR
.or("status.eq.active,price.gt.100")

// NOT
.not("status", "eq", "archived")
```

### Ordering

```typescript
// Ascending
.order("created_at", { ascending: true })

// Descending
.order("created_at", { ascending: false })

// Multiple columns
.order("status", { ascending: true })
.order("created_at", { ascending: false })
```

### Pagination

```typescript
// Limit
.limit(10)

// Range (offset + limit)
.range(0, 9)  // First 10 items

// Range for pagination
const page = 1;
const pageSize = 10;
.range((page - 1) * pageSize, page * pageSize - 1)
```

---

## Relationships

### Select with Relationships

**One-to-many:**

```typescript
const { data } = await client
  .from("posts")
  .select("id, title, author:users(name, email)");
```

**Many-to-many:**

```typescript
const { data } = await client
  .from("posts")
  .select("id, title, tags:post_tags(tag:tags(name))");
```

**Nested relationships:**

```typescript
const { data } = await client.from("posts").select(`
    id,
    title,
    author:users(
      id,
      name,
      profile:profiles(bio, avatar)
    )
  `);
```

---

## Type Generation

Generate TypeScript types from your database schema:

```bash
npx neon-js gen-types --db-url "postgresql://user:pass@host/db" --output src/types/database.ts
```

Or using environment variable:

```bash
npx neon-js gen-types --db-url "$DATABASE_URL" --output lib/db/database.types.ts
```

**Use types in client:**

```typescript
import { createClient } from "@neondatabase/neon-js";
import type { Database } from "./database.types";

export const dbClient = createClient<Database>({
  auth: { url: process.env.NEXT_PUBLIC_NEON_AUTH_URL! },
  dataApi: { url: process.env.NEON_DATA_API_URL! },
});
```

**Benefits:**

- Full TypeScript autocomplete for tables and columns
- Type-safe queries
- Compile-time error checking

---

## Error Handling

**Check for errors:**

```typescript
const { data, error } = await client.from("items").select();

if (error) {
  console.error("Database error:", error.message);
  console.error("Error code:", error.code);
  console.error("Error details:", error.details);
  return;
}

// Use data
console.log(data);
```

**Common error codes:**

- `PGRST116` - No rows returned (when using `.single()`)
- `23505` - Unique violation
- `23503` - Foreign key violation
- `42P01` - Table does not exist

---

## Usage Examples

### Server Component (Next.js)

```typescript
// app/posts/page.tsx
import { dbClient } from "@/lib/db/client";

export default async function PostsPage() {
  const { data: posts, error } = await dbClient
    .from("posts")
    .select("id, title, created_at, author:users(name)")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) return <div>Error loading posts</div>;

  return (
    <ul>
      {posts?.map((post) => (
        <li key={post.id}>
          <h2>{post.title}</h2>
          <p>By {post.author?.name}</p>
        </li>
      ))}
    </ul>
  );
}
```

### API Route (Next.js)

```typescript
// app/api/posts/route.ts
import { dbClient } from "@/lib/db/client";
import { NextResponse } from "next/server";

export async function GET() {
  const { data, error } = await dbClient.from("posts").select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const body = await request.json();

  const { data, error } = await dbClient
    .from("posts")
    .insert(body)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data, { status: 201 });
}
```

### Client Component (React)

```typescript
"use client";

import { useEffect, useState } from "react";
import { dbClient } from "@/lib/db/client";

export function ItemsList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchItems() {
      const { data, error } = await dbClient
        .from("items")
        .select("id, name, status")
        .eq("status", "active");

      if (error) {
        console.error(error);
        return;
      }

      setItems(data || []);
      setLoading(false);
    }

    fetchItems();
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <ul>
      {items.map((item) => (
        <li key={item.id}>{item.name}</li>
      ))}
    </ul>
  );
}
```

---

## Supabase Migration

The Neon JS SDK uses the same PostgREST API as Supabase, making migration straightforward:

**Before (Supabase):**

```typescript
import { createClient } from "@supabase/supabase-js";

const client = createClient(SUPABASE_URL, SUPABASE_KEY);
```

**After (Neon):**

```typescript
import { createClient, SupabaseAuthAdapter } from "@neondatabase/neon-js";

const client = createClient({
  auth: { adapter: SupabaseAuthAdapter(), url: NEON_AUTH_URL },
  dataApi: { url: NEON_DATA_API_URL },
});
```

**Query syntax remains the same:**

```typescript
// Works identically in both
await client.auth.signInWithPassword({ email, password });
const { data } = await client.from("items").select();
```
