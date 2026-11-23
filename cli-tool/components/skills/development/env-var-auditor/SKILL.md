---
name: env-var-auditor
description: "Cross-check environment variables used in code against .env.example, docker-compose.yml, CI configs and README setup blocks. Finds variables that are read but never declared, declared but never used, and name mismatches between config files, before they break a deployment."
---

# Env Var Auditor

## Overview

Environment variables fail silently: the code reads a variable that nothing defines, the deploy works in one place and dies in another, or a variable gets renamed in the compose file but not in the code. This skill walks through the codebase and the configuration files, builds both lists, and reports the differences in a single review pass.

Use it on its own repo or on a service you just cloned and want to run locally for the first time.

## When to Use This Skill

- Before running a project locally for the first time
- Before wiring a service into docker-compose or a CI pipeline
- After renaming a variable in config files, to catch leftover references in code
- When a deployment works in staging but crashes at boot in production with a missing-key error
- During code review of a PR that touches `.env.example`, `docker-compose.yml`, or app startup code
- When onboarding a teammate who asks "which variables do I actually need to set?"

## How It Works

### Step 1: Collect what is declared

Gather variables from every place the project defines them:

- `.env`, `.env.example`, `.env.local`, `.env.production` (and per-service versions)
- `docker-compose.yml` / `docker-compose.yaml`: the `environment:` blocks and `env_file:` entries, plus any `${VAR}` interpolation in other fields
- Dockerfile `ENV` and `ARG` lines
- CI configs: `.github/workflows/*.yml`, `.gitlab-ci.yml`, `Jenkinsfile`
- Helm values, k8s manifests, Terraform variables, if the repo ships them
- README and docs: code blocks that show what to export before running

Record where each one is declared. A variable declared only in a doc block is a soft declaration; the report should say so.

### Step 2: Collect what is used

Scan the source for the read patterns of each language present:

- JavaScript / TypeScript: `process.env.NAME`, `import.meta.env.NAME`, `Bun.env`, `Deno.env.get()`
- Python: `os.environ["NAME"]`, `os.environ.get("NAME")`, `os.getenv("NAME")`
- Go: `os.Getenv("NAME")`, `os.LookupEnv("NAME")`
- Java / Kotlin: `System.getenv("NAME")`, `@Value("${NAME}")` in Spring, `Env.` access in Quarkus
- Rust: `std::env::var("NAME")`
- Ruby: `ENV["NAME"]`, `ENV.fetch("NAME")`
- Shell: `$NAME`, `${NAME}` outside of test fixtures
- PHP: `getenv()`, `$_ENV`, `$_SERVER`

Skip test directories, fixtures, and generated code, but note them separately rather than hiding the results. If a test is the only place a variable appears, that is usually a bug in itself.

### Step 3: Diff and classify

Match the two lists case-sensitively (most runtimes treat them that way) and sort findings into:

1. **Used but never declared** — the dangerous one. The code reads it, nothing defines it, and the failure mode depends on the framework: a crash at boot, an empty default that corrupts data, or a silent fallback to the wrong environment.
2. **Declared but never used** — dead config. Usually leftovers from a removed feature. Flag for deletion, not for wiring up.
3. **Name mismatches** — `DATABASE_URL` in compose but `DB_URL` in code, or `API_KEY` vs `APIKEY`. Check for prefix conventions too: frontend builds gate on prefixes like `VITE_`, `NEXT_PUBLIC_`, `REACT_APP_`, and a variable without its prefix never reaches the client bundle.
4. **Defaults that disagree** — the same variable with one default in docker-compose and another in code. Report both values and both file locations.
5. **Secret-looking values in committed files** — `.env` files checked into git, or real values in `.env.example` instead of placeholders. Report location only; never echo the value.

### Step 4: Report

Output one table per finding class, ordered by severity. For each row: variable name, where it is used (file and line), where it is declared (or "nowhere"), and a one-line suggestion. End with a short verdict: which findings block a deploy, which are cleanup, and which are safe to ignore.

Suggested fixes are edits to the config files, not to the code, unless the code is clearly the odd one out. Never invent values for undeclared variables; mark them as needing a decision from the developer.

## Edge Cases

- Compose interpolation like `${DB_HOST:-localhost}` is both a declaration and a default; treat it as such.
- Some projects build variable names dynamically (`env["SETTING_" + key]`). Flag that line instead of guessing the names.
- Monorepos: run per service, since each service has its own deployment surface and merging the lists produces false matches.
- Framework shorthands (`DATABASE_URL` for ORMs, `PORT`, `NODE_ENV`, `RAILS_MASTER_KEY`, `AWS_*` for SDKs) have implicit provider defaults. Mark them "provider default exists" rather than "never declared" so the report stays honest.

## Report Format

```
== Used but never declared ==
PGPASSWORD        config/db.js:12          declared nowhere        blocks deploy

== Declared but never used ==
LEGACY_WEBHOOK    .env.example:4           unused                  remove or wire up

== Name mismatches ==
DB_URL (code) vs DATABASE_URL (compose)     pick one spelling

== Defaults disagree ==
LOG_LEVEL         compose: warn            code: info              reconcile
```

Keep the final report under one screen when possible. A wall of text defeats the purpose.
