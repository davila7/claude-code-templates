#!/usr/bin/env python3
"""
Supabase Remote Guard (PreToolUse)

Stops Claude from changing a hosted Supabase project. Local work (supabase start,
db reset, migration new, test db, gen types --local) is untouched.

Denied:
  Bash  - supabase CLI commands that write to the linked/remote project, however
          they are launched (npx, bunx, pnpm dlx, sh -c, env prefixes, &&-chains):
          db push (unless --local or --dry-run, not =false), db reset --linked/--db-url,
          migration repair, migration up/squash --linked/--db-url, functions
          deploy/delete, secrets set/unset, config push, projects/orgs create,
          projects delete, branches create/update/delete, domains, network,
          ssl, sso, backups and postgres-config changes, seed buckets --linked,
          storage rm/mv/cp (unless --local).
        - any command that names a hosted Supabase database host
          (db.<ref>.supabase.co, *.pooler.supabase.com): psql, pg_dump,
          pg_restore, prisma, drizzle-kit, scripts with a connection string.
  MCP   - every Supabase MCP tool except list_*, get_*, search_docs,
          generate_typescript_types, and execute_sql with one read-only
          statement (select / with / explain / show, no comments, no write
          keywords or side-effect functions such as net.*, cron.*, vault.*).

Not caught (it reads command text): scripts that connect through an
environment variable such as DATABASE_URL, REST calls with a secret key
(curl https://<ref>.supabase.co/rest/v1 ...), deliberately obfuscated
commands, and a select that calls one of the project's own functions that
writes. Run the Supabase MCP server with --read-only so the database itself
refuses writes from execute_sql. Treat it as a guard against mistakes, not a sandbox.

The person can still run any of these themselves with `! <command>` in Claude
Code, which does not go through hooks. Fails closed: input it cannot parse is
denied.
"""

import json
import re
import sys


def deny(reason):
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason
            + " Local work (supabase start, db reset, test db) is allowed. "
            "If the person wants this run against the hosted project, ask them "
            "to run it themselves (in Claude Code: `! <command>`).",
        }
    }))
    sys.exit(0)


# A supabase invocation followed (within the same shell command, possibly
# after global flags such as --workdir x or --debug) by a remote-writing
# subcommand. [^;&|\n] keeps the match inside one simple command.
SB = r"\bsupabase\b[^;&|\n]*?"
# A boolean flag that is on: bare or =true, never --dry-run=false.
FLAG_ON = r"(?:=true)?(?=[\s;&|)]|$)"
REMOTE_CLI = [
    (SB + r"\bdb\s+push\b(?![^;&|\n]*--(local|dry-run)" + FLAG_ON + ")", "supabase db push writes migrations to the hosted project."),
    (SB + r"\bdb\s+reset\b[^;&|\n]*--(linked|db-url)\b", "supabase db reset --linked/--db-url wipes a remote database."),
    (SB + r"\bmigration\s+repair\b", "supabase migration repair rewrites the remote migration history."),
    (SB + r"\bmigration\s+up\b[^;&|\n]*--(linked|db-url)\b", "supabase migration up --linked/--db-url applies migrations to a remote database."),
    (SB + r"\bfunctions\s+(deploy|delete)\b", "supabase functions deploy/delete changes the hosted project's edge functions."),
    (SB + r"\bsecrets\s+(set|unset)\b", "supabase secrets set/unset changes the hosted project's secrets."),
    (SB + r"\bconfig\s+push\b", "supabase config push changes the hosted project's settings."),
    (SB + r"\bprojects\s+delete\b", "supabase projects delete deletes a hosted project."),
    (SB + r"\b(projects|orgs)\s+create\b", "supabase projects/orgs create creates billable hosted resources."),
    (SB + r"\bbranches\s+(create|update|delete|pause|unpause)\b", "supabase branches create/update/delete changes hosted branches."),
    (SB + r"\b(domains|vanity-subdomains|network-restrictions|network-bans|ssl-enforcement|postgres-config|sso|backups|encryption)\s+(create|update|delete|remove|add|activate|reverify|restore|set)\b",
     "this supabase command changes the hosted project's configuration."),
    (SB + r"\bstorage\s+(rm|mv|cp)\b(?![^;&|\n]*--local" + FLAG_ON + ")",
     "supabase storage rm/mv/cp without --local changes the hosted project's files."),
    (SB + r"\b(migration\s+squash|seed\s+buckets)\b[^;&|\n]*--(linked|db-url)\b", "this supabase command writes to a remote database or storage."),
]
DB_HOST = re.compile(r"\b(db\.[a-z0-9]{10,}\.supabase\.co|[a-z0-9.-]*pooler\.supabase\.com)\b", re.I)

# Allowlist: only these Supabase MCP tools pass (plus read-only execute_sql);
# any other tool, including ones added to the server later, is denied.
MCP_READ = re.compile(r"^(list_\w+|get_\w+|search_docs|generate_typescript_types)$")
SQL_WRITE = re.compile(
    r"\b(insert|update|delete|merge|upsert|alter|drop|create|truncate|grant|revoke|"
    r"comment|copy|call|do|vacuum|analyze|cluster|reindex|refresh|lock|set|reset|"
    r"security\s+label|nextval|setval|pg_terminate_backend|pg_cancel_backend|"
    r"pg_reload_conf|set_config|lo_import|lo_export|dblink|into|pg_notify|pg_advisory\w*|"
    r"lo_\w+|pg_create_\w+|pg_drop_\w+|pg_replication_origin_\w+|pg_switch_wal|pg_promote|"
    r"pg_stat_reset\w*|pg_file_write|pg_rotate_logfile|"
    r"net\.\w+|cron\.\w+|vault\.\w+|pgmq\.\w+)\b",
    re.I,
)


def read_only_sql(sql):
    s = (sql or "").strip().rstrip(";").strip()
    # No comments and no second statement anywhere, even inside string
    # literals: simpler to refuse than to tokenize SQL correctly.
    if not s or ";" in s or "--" in s or "/*" in s:
        return False
    if not re.match(r"(?is)^(select|with|explain|show|table|values)\b", s):
        return False
    if re.match(r"(?is)^explain\b.*\banalyze\b", s):  # EXPLAIN ANALYZE executes the statement
        return False
    # Ignore string literals when looking for write keywords.
    body = re.sub(r"'(?:[^']|'')*'", "''", s)
    body = re.sub(r"\$([A-Za-z_]*)\$.*?\$\1\$", "''", body, flags=re.S)
    return not SQL_WRITE.search(body)


def check_bash(cmd):
    flat = cmd.replace("\\\n", " ")
    for pattern, why in REMOTE_CLI:
        if re.search(pattern, flat, re.I):
            deny("Blocked by supabase-remote-guard: " + why)
    if DB_HOST.search(flat):
        deny("Blocked by supabase-remote-guard: this command connects to a hosted Supabase database.")


def check_mcp(tool, tool_input):
    action = tool.rsplit("__", 1)[-1].lower()
    if action == "execute_sql":
        if not read_only_sql(tool_input.get("query") or tool_input.get("sql") or ""):
            deny("Blocked by supabase-remote-guard: execute_sql is allowed only for one read-only statement (select, with, explain, show) without comments.")
    elif not MCP_READ.match(action):
        deny(f"Blocked by supabase-remote-guard: {action} is not a read-only Supabase MCP tool.")


def main():
    try:
        data = json.load(sys.stdin)
        tool = data.get("tool_name") or ""
        tool_input = data.get("tool_input") or {}
    except Exception:
        deny("supabase-remote-guard could not read the tool call, so it was blocked.")
        return
    try:
        if tool == "Bash":
            check_bash(str(tool_input.get("command") or ""))
        elif tool.startswith("mcp__") and "supabase" in tool.lower():
            check_mcp(tool, tool_input)
    except SystemExit:
        raise
    except Exception as e:  # fail closed
        deny(f"supabase-remote-guard failed ({type(e).__name__}), so the call was blocked.")
    sys.exit(0)


if __name__ == "__main__":
    main()
