---
name: database-designer
description: "Comprehensive database design tool creating complete schemas with tables, fields, indexes, and ER diagrams. Use when users request database design for any system. Generates Markdown docs, SQL scripts, and DrawDB-compatible JSON/DBML files. Supports MySQL, PostgreSQL, SQL Server. Triggers: database design, schema, ER diagram, SQL, data model. | 全面的数据库设计工具，创建完整的数据库架构。触发词：数据库设计、数据库架构、ER图、SQL、数据模型、表设计。"
---

# Database Designer

Design complete, production-ready database schemas based on user requirements. Generate comprehensive documentation, SQL scripts, and visual ER diagram files compatible with DrawDB.

## Core Design Principles

Before starting any design, always read `references/design-principles.md` to understand:
- No physical foreign keys (logical relationships only)
- Realistic field sizes based on actual usage
- Minimal, strategic index design
- Mandatory comments on all tables and fields
- Default system fields (id, timestamps, soft delete)
- snake_case naming conventions

## Workflow

### Step 1: Understand Requirements

Gather information about the database design:

1. **Database type**: MySQL 8.0 (default), PostgreSQL, SQL Server, etc.
2. **Business domain**: E-commerce, blog, CRM, ERP, etc.
3. **Core entities**: What are the main tables needed?
4. **Key features**: What functionality should the database support?
5. **Special requirements**: Any specific constraints or preferences?

If the user provides minimal information, intelligently infer missing details based on common business scenarios and best practices documented in `references/design-examples.md`.

**Key inference scenarios:**
- User says "design a user table" → Infer: username, password, email, phone, status
- User says "e-commerce system" → Infer: user, product, order, order_detail tables
- User says "blog system" → Infer: user, article, comment, tag, article_tag tables

### Step 2: Load Reference Documentation

Based on the design requirements, load appropriate references:

- **Always load**: `references/design-principles.md` for core design rules
- **For format generation**: `references/drawdb-formats.md` for JSON/DBML specifications
- **For examples**: `references/design-examples.md` for similar system designs

### Step 3: Design Database Schema

Create complete table structures following these guidelines:

#### Table Design Checklist

For each table:
- ✅ Add default system fields (unless user specifies otherwise):
  - `id` BIGINT AUTO_INCREMENT PRIMARY KEY
  - `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
  - `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  - `is_deleted` TINYINT(1) DEFAULT 0

- ✅ Design business fields with realistic sizes:
  - username: VARCHAR(50)
  - email: VARCHAR(100)
  - phone: VARCHAR(20)
  - title: VARCHAR(200)
  - description: TEXT
  - See `references/design-principles.md` for complete size standards

- ✅ Add appropriate constraints:
  - NOT NULL for required fields
  - DEFAULT values for optional fields
  - UNIQUE for fields requiring uniqueness (but not as foreign keys)

- ✅ Add COMMENT to every table and field (in Chinese)

- ✅ Do NOT create physical FOREIGN KEY constraints

#### Index Design Strategy

For each table, analyze and create indexes for:

1. **WHERE clause fields**: Fields frequently used in filtering
2. **JOIN fields**: All `xxx_id` foreign key fields
3. **ORDER BY / GROUP BY fields**: Sorting and grouping fields
4. **Unique constraints**: email, phone, order_no, etc. → UNIQUE indexes

**Index naming conventions:**
- Ordinary index: `idx_field_name` or `idx_field1_field2`
- Unique index: `uk_field_name`

**Index limits:**
- Maximum 5 indexes per table (unless user requests more)
- Only create indexes that directly support business queries

#### Relationship Design

Identify logical relationships between tables:

1. **One-to-Many (1:N)**: Most common
   - Example: user (1) → order (N)
   - Implementation: Add `user_id` in order table
   - DrawDB: many-to-one relationship

2. **One-to-One (1:1)**: For table splitting
   - Example: user (1) → user_profile (1)
   - Implementation: Add `user_id UNIQUE` in user_profile table
   - DrawDB: one-to-one relationship

3. **Many-to-Many (N:N)**: Requires junction table
   - Example: article (N) ↔ tag (N)
   - Implementation: Create article_tag junction table with article_id + tag_id
   - DrawDB: Two many-to-one relationships

### Step 4: Generate Outputs

Create all required output files:

#### 4.1 Comprehensive Design Document (Markdown)

Create a single, well-structured Markdown file containing:

**Structure:**
```markdown
# [Project Name] 数据库设计文档

## 1. 数据库概览
- 数据库类型
- 字符集
- 核心表数量
- 主要功能模块

## 2. 表结构设计

### 2.1 [Table Name]
**表名**: table_name
**说明**: Table description

**字段列表**:
| 字段名 | 类型 | 允许空 | 默认值 | 说明 |
|--------|------|--------|--------|------|
| id | BIGINT | NO | | Primary key |
| ... | ... | ... | ... | ... |

**索引列表**:
| 索引名 | 类型 | 字段 |
|--------|------|------|
| uk_email | UNIQUE | email |
| idx_username | INDEX | username |

### 2.2 [Next Table]
...

## 3. 表关系说明
- table1 → table2 (1:N): Description
- table3 ↔ table4 (N:N): Description via junction table

## 4. 索引策略说明
Explain the rationale behind index design decisions
```

#### 4.2 SQL Script

Create executable SQL script with:
```sql
-- Database: project_name
-- Generated: YYYY-MM-DD

-- Drop tables if exists (in reverse dependency order)
DROP TABLE IF EXISTS `table3`;
DROP TABLE IF EXISTS `table2`;
DROP TABLE IF EXISTS `table1`;

-- Create tables (in dependency order)
CREATE TABLE `table1` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT 'Comment',
  ...
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_field` (`field`),
  KEY `idx_field` (`field`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Table comment';

CREATE TABLE `table2` (
  ...
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Table comment';
```

#### 4.3 DrawDB JSON Format

Generate DrawDB-compatible JSON file following `references/drawdb-formats.md`:

**Critical Format Requirements:**
- **Table IDs**: Use random 21-character strings (e.g., `"_KV5MtPf2m4sI7Inu8pat"`)
- **Field IDs**: Use random 21-character strings (e.g., `"B8rPRTDtOv9oD2Gp4bhWL"`)
- **Index IDs**: Use numeric increments starting from 0 (across ALL tables)
- **Relationship IDs**: Use random 21-character strings
- **Field type**: Include complete type definition (e.g., `"VARCHAR(100)"`, not separate type and size)
- **No size field**: Type info is embedded in the type string
- **Index fields**: Use field name strings, NOT field IDs (e.g., `["email"]` not `[1]`)
- **Coordinates**: Use floating-point numbers for x/y positions

**ID Generation:**
```python
import random
import string

def generate_id():
    chars = string.ascii_letters + string.digits + '_-'
    return ''.join(random.choice(chars) for _ in range(21))
```

**Layout Strategy:**
- Use grid layout: `x = (index % 3) * 450 + 50`, `y = floor(index / 3) * 400 + 50`
- Rotate through predefined colors: `["#6360f7", "#bc49c4", "#ffe159", "#89e667", "#ff9159", "#59d9ff", "#ff5959", "#a0a0a0"]`

**Relationship Generation:**
- Generate relationships for all `xxx_id` foreign key fields
- Use the actual random string IDs for tables and fields
- Set cardinality based on UNIQUE constraint:
  - Has UNIQUE → "one_to_one"
  - No UNIQUE → "many_to_one"

**Structure:**
```json
{
  "tables": [
    {
      "id": "random_string",
      "name": "table_name",
      "comment": "表注释",
      "color": "#6360f7",
      "fields": [
        {
          "id": "random_string",
          "name": "id",
          "type": "BIGINT",
          "default": "",
          "check": "",
          "primary": true,
          "unique": true,
          "notNull": true,
          "increment": true,
          "comment": "主键ID"
        }
      ],
      "indices": [
        {
          "id": 0,
          "fields": ["field_name"],
          "name": "idx_field_name",
          "unique": false
        }
      ],
      "x": 50.0,
      "y": 50.0
    }
  ],
  "relationships": [
    {
      "name": "",
      "startTableId": "random_string",
      "endTableId": "random_string",
      "endFieldId": "random_string",
      "startFieldId": "random_string",
      "id": "random_string",
      "updateConstraint": "No action",
      "deleteConstraint": "No action",
      "cardinality": "many_to_one"
    }
  ],
  "notes": [],
  "subjectAreas": [],
  "database": "generic",
  "types": [],
  "title": "Project Database"
}
```

#### 4.4 DrawDB DBML Format

Generate DBML file following `references/drawdb-formats.md`:

**Key points:**
- Use lowercase data types: `bigint`, `varchar(50)`, `datetime`
- Add attributes in brackets: `[pk, increment, not null, unique, note: '注释']`
- Define indexes inside table definition in `indexes { }` block
- Define relationships outside tables using `Ref` blocks
- Use proper relationship symbols: `>` (many-to-one), `-` (one-to-one)

**Structure:**
```dbml
Table table_name [headercolor: #6360f7] {
  id bigint [pk, increment, not null, unique, note: 'Comment']
  field varchar(100) [not null, note: 'Comment']
  
  indexes {
    field [unique, name: 'uk_field']
  }
  
  Note: 'Table comment'
}

Ref fk_name {
  table1.field > table2.id [delete: no action, update: no action]
}
```

### Step 5: Finalize and Deliver

#### 5.1 Output Directory Convention

**Recommended Approach (Following Claude Code Official Standards):**

Save all database design files to `outputs/<project-name>/database/`:

```
outputs/
└── <project-name>/              # Project name (e.g., e-commerce-system)
    └── database/
        ├── schema-design.md     # Comprehensive design document
        ├── schema.sql           # Executable SQL script
        ├── drawdb-schema.json   # DrawDB JSON format
        └── drawdb-schema.dbml   # DrawDB DBML format
```

**Example:**
```
outputs/
├── e-commerce-system/
│   └── database/
│       ├── schema-design.md
│       ├── schema.sql
│       ├── drawdb-schema.json
│       └── drawdb-schema.dbml
└── task-management-app/
    └── database/
        ├── schema-design.md
        └── schema.sql
```

**Alternative Approach (Traditional Project Structure):**

If your project has an existing directory structure, you can also use:

```
project-root/
└── database/
    ├── schema-design.md
    ├── schema.sql
    ├── drawdb-schema.json
    └── drawdb-schema.dbml
```

#### 5.2 Output File List

**Required Outputs (4 files):**
- `schema-design.md` - Comprehensive database design document (Chinese)
- `schema.sql` - Executable SQL script
- `drawdb-schema.json` - DrawDB JSON format
- `drawdb-schema.dbml` - DrawDB DBML format

**Optional Outputs:**
- `er-diagram.png` - ER diagram visualization (if tools available)
- `index-strategy.md` - Index strategy documentation

#### 5.3 File Naming Convention

- Use kebab-case: `user-authentication-schema.sql`
- Include version/date when needed: `schema-v1.0.sql` or `schema-2024-12-10.sql`
- Use descriptive names: `e-commerce-database-schema.sql`

#### 5.4 Delivery Summary

After generating all files, provide a summary with:
- Brief overview of design decisions
- Number of tables created
- Key relationships and their rationale
- How to import into DrawDB (JSON or DBML)
- File save location confirmation
- Next steps suggestions (e.g., review indexes, implement in development environment)

## Special Handling

### When User Says "No System Fields"
Only create minimal structure:
```sql
CREATE TABLE `table_name` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT 'Primary key',
  /* business fields only */
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Table comment';
```

### When User Specifies Non-MySQL Database

Adapt SQL syntax accordingly:

**PostgreSQL:**
- Use `SERIAL` or `BIGSERIAL` instead of `AUTO_INCREMENT`
- Use `TIMESTAMP` instead of `DATETIME`
- Different syntax for defaults and constraints

**SQL Server:**
- Use `IDENTITY(1,1)` instead of `AUTO_INCREMENT`
- Use `DATETIME2` instead of `DATETIME`
- Use `NVARCHAR` for Unicode support

**Oracle:**
- Use `SEQUENCE` for auto-increment
- Use `VARCHAR2` instead of `VARCHAR`
- Use `DATE` or `TIMESTAMP` for time fields

### When Requirements Are Vague

Apply intelligent inference:
1. Identify the business domain (e-commerce, blog, CRM, etc.)
2. Reference similar examples in `references/design-examples.md`
3. Include common fields appropriate to the domain
4. Design reasonable indexes based on typical query patterns
5. Explain assumptions made in the design document

## Quality Verification

Before finalizing, verify:
- [ ] All tables have COMMENT
- [ ] All fields have COMMENT
- [ ] Field sizes are realistic (not generic VARCHAR(255))
- [ ] Index count per table ≤ 5
- [ ] No physical FOREIGN KEY constraints
- [ ] System fields added (unless user specified otherwise)
- [ ] All names use snake_case
- [ ] Logical relationships documented clearly
- [ ] SQL syntax matches target database type
- [ ] JSON/DBML formats follow DrawDB specifications
- [ ] All foreign key relationships have corresponding Ref entries

## Example Invocations

User says: "设计一个电商系统的数据库，包括用户、商品、订单功能"
→ Read design-principles.md and design-examples.md
→ Design: user_info, product_info, order_info, order_detail tables
→ Generate all 4 output files

User says: "Design a blog database"
→ Infer: user, article, comment, tag, article_tag tables
→ Follow standard design principles
→ Generate all outputs

User says: "Create a user table for PostgreSQL"
→ Single table design
→ Adapt SQL syntax for PostgreSQL
→ Include in all output formats

## References

- `references/design-principles.md` - Core design rules and standards
- `references/drawdb-formats.md` - JSON and DBML format specifications
- `references/design-examples.md` - Real-world design examples
