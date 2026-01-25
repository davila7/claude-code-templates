# OpenAPI to TypeScript

A Claude Code skill that converts OpenAPI 3.0 specifications (JSON or YAML) into TypeScript interfaces and type guards.

## Purpose

This skill automates the process of generating type-safe TypeScript code from OpenAPI API specifications. It creates:
- TypeScript interfaces for all schema definitions
- Request/Response type definitions for API endpoints
- Runtime type guards for validation
- Proper handling of complex types (unions, intersections, enums, arrays)

## When to Use

Use this skill when you need to:
- Generate TypeScript types from an OpenAPI specification
- Create type-safe API client interfaces
- Convert API documentation into TypeScript code
- Maintain type safety between backend API specs and frontend code

### Trigger Phrases

- "generate types from openapi"
- "convert openapi to typescript"
- "create API interfaces"
- "generate types from spec"
- "convert schema to TS"

## How It Works

### Workflow

1. **Request Input**: Asks for the OpenAPI file path (if not provided)
2. **Validation**: Reads and validates the OpenAPI specification (must be 3.0.x)
3. **Schema Extraction**: Extracts schemas from `components/schemas`
4. **Endpoint Analysis**: Extracts request/response types from `paths`
5. **Code Generation**: Generates TypeScript interfaces and type guards
6. **Output**: Asks where to save (default: `types/api.ts`)
7. **Write File**: Creates the TypeScript file

### OpenAPI Support

- **Version**: OpenAPI 3.0.x only
- **Format**: JSON or YAML
- **Required fields**: `openapi`, `paths`, `components.schemas`

## Key Features

### Type Mapping

**Primitives**:
- `string` → `string`
- `number` / `integer` → `number`
- `boolean` → `boolean`
- `null` → `null`

**Format Modifiers** (with JSDoc comments):
- `uuid` → `string` (/** UUID */)
- `date` → `string` (/** Date */)
- `date-time` → `string` (/** ISO DateTime */)
- `email` → `string` (/** Email */)
- `uri` → `string` (/** URI */)

**Complex Types**:
- **Objects** → TypeScript interfaces with optional/required fields
- **Arrays** → TypeScript array types (`Type[]`)
- **Enums** → TypeScript union types (`"value1" | "value2"`)
- **oneOf** → Union types (`Type1 | Type2`)
- **allOf** → Interface extension (`extends`)
- **$ref** → Direct type references

### Generated Code Structure

```typescript
/**
 * Auto-generated from: {source_file}
 * Generated at: {timestamp}
 *
 * DO NOT EDIT MANUALLY - Regenerate from OpenAPI schema
 */

// Types
export interface User { ... }
export type Status = "active" | "draft";

// Request/Response Types
export interface GetUsersRequest { ... }
export type GetUsersResponse = User[];

// Type Guards
export function isUser(value: unknown): value is User { ... }

// Error Types (always included)
export interface ApiError { ... }
export function isApiError(value: unknown): value is ApiError { ... }
```

### Type Guards

Runtime validation functions for each interface:
- Check object structure
- Validate required fields
- Type-check primitives
- Validate enums and arrays

## Usage Examples

### Basic Usage

```
User: Generate TypeScript types from my OpenAPI spec at ./api/openapi.json

Claude: I'll convert your OpenAPI specification to TypeScript.
[Reads file, validates, generates types, saves to types/api.ts]
```

### With Custom Output Path

```
User: Convert openapi.yaml to TypeScript and save it to src/types/backend.ts

Claude: I'll generate TypeScript types from your OpenAPI spec.
[Generates and saves to specified location]
```

### Example Input/Output

**Input** (openapi.json):
```json
{
  "openapi": "3.0.0",
  "components": {
    "schemas": {
      "Product": {
        "type": "object",
        "properties": {
          "id": {"type": "string", "format": "uuid"},
          "name": {"type": "string"},
          "price": {"type": "number"},
          "status": {"type": "string", "enum": ["active", "draft"]}
        },
        "required": ["id", "name", "price", "status"]
      }
    }
  },
  "paths": {
    "/products": {
      "get": {
        "parameters": [
          {"name": "page", "in": "query", "schema": {"type": "integer"}},
          {"name": "limit", "in": "query", "schema": {"type": "integer"}}
        ],
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "type": "array",
                  "items": {"$ref": "#/components/schemas/Product"}
                }
              }
            }
          }
        }
      }
    }
  }
}
```

**Output** (types/api.ts):
```typescript
/**
 * Auto-generated from: openapi.json
 * Generated at: 2026-01-18T19:00:00Z
 *
 * DO NOT EDIT MANUALLY - Regenerate from OpenAPI schema
 */

// ============================================================================
// Types
// ============================================================================

export type ProductStatus = "active" | "draft";

export interface Product {
  /** UUID */
  id: string;

  name: string;

  price: number;

  status: ProductStatus;
}

// ============================================================================
// Request/Response Types
// ============================================================================

export interface GetProductsRequest {
  page?: number;
  limit?: number;
}

export type GetProductsResponse = Product[];

// ============================================================================
// Type Guards
// ============================================================================

export function isProduct(value: unknown): value is Product {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof (value as any).id === 'string' &&
    'name' in value &&
    typeof (value as any).name === 'string' &&
    'price' in value &&
    typeof (value as any).price === 'number' &&
    'status' in value &&
    ['active', 'draft'].includes((value as any).status)
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

## Benefits

- **Type Safety**: Catch API contract violations at compile time
- **Auto-completion**: Full IDE support for API request/response types
- **Runtime Validation**: Type guards for validating API responses
- **Documentation**: JSDoc comments preserved from OpenAPI descriptions
- **Maintainability**: Regenerate types when API spec changes
- **DRY Principle**: Single source of truth (OpenAPI spec)

## Limitations

- Only supports OpenAPI 3.0.x (not 2.0 or 3.1)
- Circular references handled with type aliases
- Unknown types fall back to `unknown` with warnings
- Complex `allOf` scenarios may need manual refinement

## Related Tools

This skill complements:
- **openapi-validator**: Validate OpenAPI specs before conversion
- **api-client-generator**: Generate full API clients using these types
- **schema-diff**: Compare OpenAPI versions to track type changes

## Technical Details

### Naming Conventions

- **Interfaces**: PascalCase (e.g., `User`, `Product`)
- **Request Types**: `{Method}{Path}Request` (e.g., `GetUsersRequest`)
- **Response Types**: `{Method}{Path}Response` (e.g., `GetUsersResponse`)
- **Type Guards**: `is{TypeName}` (e.g., `isUser`, `isProduct`)
- **Enums**: `{TypeName}{FieldName}` (e.g., `ProductStatus`, `UserRole`)

### Field Handling

- **Required fields**: No `?` suffix
- **Optional fields**: `?` suffix
- **Descriptions**: Converted to JSDoc comments
- **Formats**: Added as JSDoc comments

### Error Handling

The skill validates and reports:
- Invalid OpenAPI version
- Missing required fields (`openapi`, `paths`, `components`)
- Unresolved `$ref` references
- Unknown or unsupported types
- Circular reference warnings

## License

Part of the Softaworks Agent Skills collection.