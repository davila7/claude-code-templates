# Database Schema Designer

A comprehensive skill for designing production-ready database schemas with built-in best practices for both SQL and NoSQL databases.

## Purpose

The Database Schema Designer skill helps you create robust, scalable database schemas by providing:

- **Normalization guidance** - Apply proper normal forms (1NF, 2NF, 3NF) to eliminate data redundancy
- **Indexing strategies** - Optimize query performance with the right indexes
- **Migration patterns** - Evolve schemas safely with reversible, zero-downtime migrations
- **Constraint design** - Ensure data integrity with proper foreign keys, checks, and unique constraints
- **Performance optimization** - Design for your specific access patterns (OLTP vs OLAP)

Whether you are starting a new project or evolving an existing database, this skill ensures your schema follows industry best practices and avoids common pitfalls.

## When to Use

Use this skill when you need to:

- Design a new database schema from scratch
- Normalize an existing table structure
- Add indexes to improve query performance
- Create migration scripts for schema changes
- Review and audit existing schemas
- Choose between SQL and NoSQL approaches

### Trigger Phrases

| Trigger | Example |
|---------|---------|
| `design schema` | "design a schema for user authentication" |
| `database design` | "database design for multi-tenant SaaS" |
| `create tables` | "create tables for a blog system" |
| `schema for` | "schema for inventory management" |
| `model data` | "model data for real-time analytics" |
| `I need a database` | "I need a database for tracking orders" |
| `design NoSQL` | "design NoSQL schema for product catalog" |

## How It Works

The skill follows a four-phase process:

### Phase 1: Analysis
- Identify entities and their relationships
- Determine access patterns (read-heavy vs write-heavy)
- Choose SQL or NoSQL based on requirements

### Phase 2: Design
- Normalize to 3NF for SQL or determine embed/reference strategy for NoSQL
- Define primary keys and foreign keys
- Choose appropriate data types
- Add constraints (UNIQUE, CHECK, NOT NULL)

### Phase 3: Optimize
- Plan indexing strategy based on query patterns
- Consider denormalization for read-heavy queries
- Add audit timestamps (created_at, updated_at)

### Phase 4: Migrate
- Generate reversible migration scripts (up + down)
- Ensure backward compatibility
- Plan for zero-downtime deployment

## Key Features

### SQL Schema Design
- **Normalization** - Automatic application of 1NF, 2NF, and 3NF rules
- **Data Types** - Appropriate type selection (DECIMAL for money, proper VARCHAR sizing)
- **Constraints** - Foreign keys with ON DELETE strategies, CHECK constraints, UNIQUE constraints
- **Indexes** - B-Tree, Hash, Full-text, and Partial index recommendations

### NoSQL Schema Design (MongoDB)
- **Embedding vs Referencing** - Guidance on when to embed documents vs use references
- **Index Strategies** - Single field, composite, text search, and geospatial indexes
- **Document Structure** - Optimal document design based on access patterns

### Relationship Patterns
- One-to-Many relationships
- Many-to-Many with junction tables
- Self-referencing hierarchies
- Polymorphic associations

### Migration Support
- Zero-downtime migration patterns
- Reversible migration templates
- Safe column addition/rename strategies
- Backward compatible changes

## Usage Examples

### Basic Schema Design

```
design a schema for an e-commerce platform with users, products, orders
```

Output:

```sql
CREATE TABLE users (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  total DECIMAL(10,2) NOT NULL,
  INDEX idx_orders_user (user_id)
);
```

### Available Commands

| Command | Purpose |
|---------|---------|
| `design schema for {domain}` | Generate a complete schema from scratch |
| `normalize {table}` | Apply normalization rules to fix an existing table |
| `add indexes for {table}` | Generate an index strategy for performance |
| `migration for {change}` | Create reversible migration scripts |
| `review schema` | Audit an existing schema for issues |

### Request Tips

Include these details in your request for best results:

- **Entities** - users, products, orders
- **Key relationships** - users have orders, orders have items
- **Scale hints** - high-traffic, millions of records
- **Database preference** - SQL or NoSQL (defaults to SQL if not specified)
- **Access patterns** - read-heavy analytics, write-heavy transactions

## Prerequisites

No special tools or dependencies required. The skill generates standard SQL or NoSQL schema definitions that work with:

- MySQL / MariaDB
- PostgreSQL
- SQLite
- MongoDB
- And other compatible databases

## Output

The skill produces:

1. **Schema DDL** - Complete CREATE TABLE statements with all constraints
2. **Index Definitions** - Optimized indexes for your query patterns
3. **Migration Scripts** - Reversible UP and DOWN migrations
4. **Mermaid Diagrams** - Entity-relationship diagrams (when requested)
5. **Verification Checklist** - Items to review before deploying

### Verification Checklist

After designing a schema, verify:

- [ ] Every table has a primary key
- [ ] All relationships have foreign key constraints
- [ ] ON DELETE strategy defined for each FK
- [ ] Indexes exist on all foreign keys
- [ ] Indexes exist on frequently queried columns
- [ ] Appropriate data types (DECIMAL for money, etc.)
- [ ] NOT NULL on required fields
- [ ] UNIQUE constraints where needed
- [ ] CHECK constraints for validation
- [ ] created_at and updated_at timestamps
- [ ] Migration scripts are reversible
- [ ] Tested on staging with production data

## Best Practices

### Do

- Start with domain modeling, not UI requirements
- Normalize to 3NF first, then selectively denormalize
- Use DECIMAL for money (never FLOAT)
- Always define foreign key constraints
- Index every foreign key column
- Size VARCHAR columns appropriately
- Store dates in DATE/TIMESTAMP types
- Always write reversible migrations
- Test migrations on staging with production-like data

### Avoid

| Anti-Pattern | Problem | Solution |
|--------------|---------|----------|
| VARCHAR(255) everywhere | Wastes storage, hides intent | Size appropriately per field |
| FLOAT for money | Rounding errors | DECIMAL(10,2) |
| Missing FK constraints | Orphaned data | Always define foreign keys |
| No indexes on FKs | Slow JOINs | Index every foreign key |
| Storing dates as strings | Cannot compare/sort properly | Use DATE/TIMESTAMP types |
| Non-reversible migrations | Cannot rollback safely | Always write DOWN migration |

## Key Terminology

| Term | Definition |
|------|------------|
| **Normalization** | Organizing data to reduce redundancy (1NF to 2NF to 3NF) |
| **3NF** | Third Normal Form - no transitive dependencies between columns |
| **OLTP** | Online Transaction Processing - write-heavy, needs normalization |
| **OLAP** | Online Analytical Processing - read-heavy, benefits from denormalization |
| **Foreign Key (FK)** | Column that references another table's primary key |
| **Index** | Data structure that speeds up queries (at cost of slower writes) |
| **Access Pattern** | How your app reads/writes data (queries, joins, filters) |
| **Denormalization** | Intentionally duplicating data to speed up reads |

## License

MIT
