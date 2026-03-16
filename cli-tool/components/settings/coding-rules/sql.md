---
description: SQL guidelines for .sql files and migration files
globs: ["**/*.sql", "**/migrations/**"]
---

# SQL Rules

## Naming Conventions
- Use `snake_case` for all table names, column names, index names, and constraint names.
- Table names are plural nouns (`users`, `orders`, `line_items`).
- Foreign key columns follow the pattern `<referenced_table_singular>_id` (e.g., `user_id`).
- Index names follow the pattern `idx_<table>_<columns>` (e.g., `idx_orders_user_id`).

## Schema Design
- Use `BIGINT` (or `BIGSERIAL` in Postgres) for primary keys. Do not use `INT` for IDs on tables that may grow large.
- Add indexes for every foreign key column.
- Add indexes for columns that appear frequently in `WHERE`, `ORDER BY`, or `JOIN` conditions.
- Add a `created_at` timestamp (with timezone) to every table.

## Migrations
- Every migration must include both an `up` and a `down` section. Migrations must be reversible.
- Wrap multi-statement migrations in a transaction where supported. Note: some DDL operations (e.g., `CREATE INDEX CONCURRENTLY` in Postgres, `ALTER TABLE` in MySQL) cannot run inside a transaction and must be handled separately.
- When adding a column to a large table, add it as `NULL` first. Backfill data in a separate step. Then add the `NOT NULL` constraint.
- Never drop a column or table in the same migration that removes the application code referencing it. Drop in a follow-up migration after deploying the code change.
- Never rename a column or table directly in one step on a live database. Add the new name, migrate data, then remove the old name.

## Query Style
- Write SQL keywords in uppercase (`SELECT`, `FROM`, `WHERE`, `JOIN`).
- Qualify ambiguous column names with the table name or alias when joining multiple tables.
- Avoid `SELECT *` in application queries. List columns explicitly.
- Prefer `EXISTS` over `COUNT(*)` when checking for the presence of rows.
