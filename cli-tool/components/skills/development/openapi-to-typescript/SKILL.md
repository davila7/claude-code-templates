---
name: openapi-to-typescript
description: Converts OpenAPI 3.0 JSON/YAML to TypeScript interfaces and type guards. This skill should be used when the user asks to generate types from OpenAPI, convert schema to TS, create API interfaces, or generate TypeScript types from an API specification.
---

# OpenAPI to TypeScript

Converts OpenAPI 3.0 specifications to TypeScript interfaces and type guards.

**Input:** OpenAPI file (JSON or YAML)
**Output:** TypeScript file with interfaces and type guards

## When to Use

- "generate types from openapi"
- "convert openapi to typescript"
- "create API interfaces"
- "generate types from spec"

## Workflow

1. Request the OpenAPI file path (if not provided)
2. Read and validate the file (must be OpenAPI 3.0.x)
3. Extract schemas from `components/schemas`
4. Extract endpoints from `paths` (request/response types)
5. Generate TypeScript (interfaces + type guards)
6. Ask where to save (default: `types/api.ts` in current directory)
7. Write the file

## OpenAPI Validation

Check before processing:

```
- Field "openapi" must exist and start with "3.0"
- Field "paths" must exist
- Field "components.schemas" must exist (if there are types)
```

If invalid, report the error and stop.

## Type Mapping

### Primitives

| OpenAPI     | TypeScript   |
|-------------|--------------|
| `string`    | `string`     |
| `number`    | `number`     |
| `integer`   | `number`     |
| `boolean`   | `boolean`    |
| `null`      | `null`       |

### Format Modifiers

| Format        | TypeScript              |
|---------------|-------------------------|
| `uuid`        | `string` (comment UUID) |
| `date`        | `string` (comment date) |
| `date-time`   | `string` (comment ISO)  |
| `email`       | `string` (comment email)|
| `uri`         | `string` (comment URI)  |

### Complex Types

**Object:**
```typescript
// OpenAPI: type: object, properties: {id, name}, required: [id]
interface Example {
  id: string;      // required: no ?
  name?: string;   // optional: with ?
}
```

**Array:**
```typescript
// OpenAPI: type: array, items: {type: string}
type Names = string[];
```

**Enum:**
```typescript
// OpenAPI: type: string, enum: [active, draft]
type Status = "active" | "draft";
```

**oneOf (Union):**
```typescript
// OpenAPI: oneOf: [{$ref: Cat}, {$ref: Dog}]
type Pet = Cat | Dog;
```

**allOf (Intersection/Extends):**
```typescript
// OpenAPI: allOf: [{$ref: Base}, {type: object, properties: ...}]
interface Extended extends Base {
  extraField: string;
}
```

## Code Generation

### File Header

```typescript
/**
 * Auto-generated from: {source_file}
 * Generated at: {timestamp}
 *
 * DO NOT EDIT MANUALLY - Regenerate from OpenAPI schema
 */
```

### Interfaces (from components/schemas)

For each schema in `components/schemas`:

```typescript
export interface Product {
  /** Product unique identifier */
  id: string;

  /** Product title */
  title: string;

  /** Product price */
  price: number;

  /** Created timestamp */
  created_at?: string;
}
```

- Use OpenAPI description as JSDoc
- Fields in `required[]` have no `?`
- Fields outside `required[]` have `?`

### Request/Response Types (from paths)

For each endpoint in `paths`:

```typescript
// GET /products - query params
export interface GetProductsRequest {
  page?: number;
  limit?: number;
}

// GET /products - response 200
export type GetProductsResponse = ProductList;

// POST /products - request body
export interface CreateProductRequest {
  title: string;
  price: number;
}

// POST /products - response 201
export type CreateProductResponse = Product;
```

Naming convention:
- `{Method}{Path}Request` for params/body
- `{Method}{Path}Response` for response

### Type Guards

For each main interface, generate a type guard:

```typescript
export function isProduct(value: unknown): value is Product {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof (value as any).id === 'string' &&
    'title' in value &&
    typeof (value as any).title === 'string' &&
    'price' in value &&
    typeof (value as any).price === 'number'
  );
}
```

Type guard rules:
- Check `typeof value === 'object' && value !== null`
- For each required field: check `'field' in value`
- For primitive fields: check `typeof`
- For arrays: check `Array.isArray()`
- For enums: check `.includes()`

### Error Type (always include)

```typescript
export interface ApiError {
  status: number;
  error: string;
  detail?: string;
}

export function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    typeof (value as any).status === 'number' &&
    'error' in value &&
    typeof (value as any).error === 'string'
  );
}
```

## $ref Resolution

When encountering `{"$ref": "#/components/schemas/Product"}`:
1. Extract the schema name (`Product`)
2. Use the type directly (don't resolve inline)

```typescript
// OpenAPI: items: {$ref: "#/components/schemas/Product"}
// TypeScript:
items: Product[]  // reference, not inline
```

## Complete Example

**Input (OpenAPI):**
```json
{
  "openapi": "3.0.0",
  "components": {
    "schemas": {
      "User": {
        "type": "object",
        "properties": {
          "id": {"type": "string", "format": "uuid"},
          "email": {"type": "string", "format": "email"},
          "role": {"type": "string", "enum": ["admin", "user"]}
        },
        "required": ["id", "email", "role"]
      }
    }
  },
  "paths": {
    "/users/{id}": {
      "get": {
        "parameters": [{"name": "id", "in": "path", "required": true}],
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {"$ref": "#/components/schemas/User"}
              }
            }
          }
        }
      }
    }
  }
}
```

**Output (TypeScript):**
```typescript
/**
 * Auto-generated from: api.openapi.json
 * Generated at: 2025-01-15T10:30:00Z
 *
 * DO NOT EDIT MANUALLY - Regenerate from OpenAPI schema
 */

// ============================================================================
// Types
// ============================================================================

export type UserRole = "admin" | "user";

export interface User {
  /** UUID */
  id: string;

  /** Email */
  email: string;

  role: UserRole;
}

// ============================================================================
// Request/Response Types
// ============================================================================

export interface GetUserByIdRequest {
  id: string;
}

export type GetUserByIdResponse = User;

// ============================================================================
// Type Guards
// ============================================================================

export function isUser(value: unknown): value is User {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof (value as any).id === 'string' &&
    'email' in value &&
    typeof (value as any).email === 'string' &&
    'role' in value &&
    ['admin', 'user'].includes((value as any).role)
  );
}

// ============================================================================
// Error Types
// ============================================================================

export interface ApiError {
  status: number;
  error: string;
  detail?: string;
}

export function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    typeof (value as any).status === 'number' &&
    'error' in value &&
    typeof (value as any).error === 'string'
  );
}
```

## Common Errors

| Error | Action |
|-------|--------|
| OpenAPI version != 3.0.x | Report that only 3.0 is supported |
| $ref not found | List missing refs |
| Unknown type | Use `unknown` and warn |
| Circular reference | Use type alias with lazy reference |
