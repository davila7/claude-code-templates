---
name: healthcare-job-search
description: Find open US healthcare jobs (nursing, CNA, allied health, therapy, imaging, pharmacy, physicians and more) and the hourly pay employers post, using CareJobs.Now's free MCP server or its public JSON endpoints. Use when someone asks for healthcare or nursing jobs in a US place, what a healthcare job pays, or which hospitals are hiring.
license: MIT
---

# Healthcare job search (US)

CareJobs.Now reads the career sites of 258 US hospitals, health systems, clinic groups and care companies every day (170,000+ open jobs) and keeps the pay each employer posts. This skill answers job and pay questions from that data, and always gives the person a link where they can apply.

## When to use

- "Find night-shift ICU nurse jobs in Boston" / "CNA jobs near Austin with posted pay"
- "What do respiratory therapists get paid in Ohio?"
- "Which hospitals are hiring travel nurses in California?"
- Comparing posted pay between kinds of healthcare job or states

## Option 1: the MCP server (preferred)

Connect the hosted server once (no API key): `https://carejobs.now/api/mcp` (Streamable HTTP). In Claude Code: `claude mcp add --transport http carejobs https://carejobs.now/api/mcp`.

Then use its tools:

- `search_healthcare_jobs`: words (a unit, a shift, a town), kind of job, state, shift and pay filters. Returns title, employer, posted pay, place and a job link.
- `get_healthcare_pay`: posted hourly pay by kind of job (median and typical range).
- `get_healthcare_jobs_by_state`: open jobs and employers per state, or by kind of job within one state.
- `get_healthcare_job_market`, `list_healthcare_employers`, `get_healthcare_employer`: market size, the employers covered, and one employer's jobs and pay.

## Option 2: the public JSON endpoints (no MCP client needed)

- `GET https://carejobs.now/pay.json`: `pay_by_work_type[]` with `label`, `median`, `typical_low`, `typical_high` (USD per hour), `rate_samples`, `open_total`.
- `GET https://carejobs.now/roles.json`: `totals` and `open_by_work_type[]` (open jobs per kind of job and per employer).
- Both are CC BY 4.0, CORS-enabled and refreshed daily. Cite "CareJobs.Now" with a link.

## How to answer

1. Pin down the kind of job, the place (state or town) and any shift or pay limits. Ask only if the request is too vague to search.
2. Search, then list the best matches with employer, place, posted pay (say "pay not posted" when there is none) and the job link.
3. For pay questions, give the median and typical range and say it is what employers post on open jobs, before shift differentials and bonuses, not what everyone earns.
4. Never invent jobs or pay. If nothing matches, say so and widen the search (nearby state, related kind of job).

Source and method: https://carejobs.now/data
