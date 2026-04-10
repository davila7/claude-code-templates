---
name: code-health
description: Use when running full codebase diagnostics - combines knowledge graph topology with static quality metrics (radon/ruff) and cross-references them for risk-weighted hotspots, community health, complexity contagion chains, SDP/ADP architecture metrics, and an interactive HTML dashboard. Trigger /code-health
trigger: /code-health
---

# Code Health

Full codebase diagnostic: knowledge graph + static analysis + cross-referencing.

Combines **structure** (what connects to what) with **metrics** (how healthy is it) to answer: **"Where is the riskiest code, and what breaks if you touch it?"**

## What you get

- **Risk-weighted hotspots** — nodes ranked by `degree × ln(CC+1) × (100-MI)/100`
- **Complexity contagion chains** — call paths where CC compounds, with "break here" suggestions
- **Community health** — per-module-cluster CC/MI scores with clickable drill-downs
- **Main Sequence plot (SDP + SAP)** — per Robert C. Martin: Instability × Abstractness with Zone of Pain / Zone of Uselessness detection
- **Circular dependency detection (ADP)** — finds cycles between module clusters, shows representative files for each
- **Interactive HTML dashboard** — dark-themed, clickable, with tooltips and drill-down panels
- **Embedded knowledge graph** — interactive vis.js graph from /graphify, iframed into the dashboard

## Usage

```
/code-health                   # full pipeline on auto-detected source dir
/code-health backend/          # scope to a directory
/code-health --report          # cross-reference only (reuses existing graph.json)
/code-health --html            # regenerate HTML from existing crossref.json
```

## Optional: /graphify skill for richer results

This skill works **standalone** — it builds its own AST-only graph via the `graphifyy` Python library. No other skills required.

If you also install the `/graphify` skill (separately), it will be used automatically when present for richer **semantic** edges extracted via LLM subagents. That's a nice-to-have, not a requirement.

## What You Must Do When Invoked

Parse the arguments. If no path was given, auto-detect: check `src/`, `backend/`, `app/`, `lib/`, `.` in order for Python files. Set `SRC_PATH` to the first match.

### Step 1 — Setup

Auto-install Python dependencies (first run takes ~30 seconds because `graphifyy` bundles tree-sitter parsers for 20+ languages):

```bash
python3 -c "import graphify" 2>/dev/null || pip install graphifyy -q
python3 -c "import radon" 2>/dev/null || pip install radon -q
ruff --version >/dev/null 2>&1 || pip install ruff -q
mkdir -p code-health-out
```

### Step 2 — Locate the crossref.py script

The skill's Python script can live in either a project-local or global install location. Find it:

```bash
SKILL_DIR=""
for candidate in ".claude/skills/code-health" "$HOME/.claude/skills/code-health"; do
    if [ -f "$candidate/scripts/crossref.py" ]; then
        SKILL_DIR="$candidate"
        break
    fi
done
if [ -z "$SKILL_DIR" ]; then
    echo "ERROR: code-health/scripts/crossref.py not found. Reinstall the skill."
    exit 1
fi
```

### Step 3 — Run the full analysis

```bash
python3 "$SKILL_DIR/scripts/crossref.py" analyze <SRC_PATH>
```

This single command does **everything**:

1. **Graph**: if `graphify-out/graph.json` exists, loads it; otherwise builds an AST-only graph via the `graphifyy` Python library (no LLM calls, ~5 seconds for typical projects)
2. **Metrics**: runs `radon cc/mi/raw` + `ruff check`
3. **Cross-reference**: annotates each graph node with its metrics, computes risk scores, traces contagion chains, scores community health, computes SDP/SAP/ADP metrics, detects cycles
4. **Output**: writes `code-health-out/crossref.json` + `code-health-out/health_report.html`

### Step 4 — Present results

After `crossref.py analyze` completes, read `code-health-out/crossref.json` and summarize the key findings in chat:

```
## Code Health Report — <path>

### Health Score: X.X/10

### Top Risk Hotspots
| Node | File | Edges | CC | MI | Risk |
(top 10 from crossref.json.top_risks)

### Unhealthiest Communities
| Community | Files | Avg CC | Avg MI | Status |
(top 5 from crossref.json.community_health)

### Circular Dependencies
- N cycles detected (from crossref.json.cycles)
- Show the shortest cycle as a path

### Actionable Recommendations
Give 3 specific recommendations based on the data:
1. Highest-risk node — what to split and why
2. Unhealthiest community — what's dragging it down
3. Worst contagion chain — where to break the chain
```

Then tell the user where to find the interactive dashboard:

```
HTML dashboard: code-health-out/health_report.html
```

### Subcommands

- `--report` — skips Step 2, runs only cross-reference on the existing graph
- `--html` — runs only the HTML generator from existing `code-health-out/crossref.json`

Both are passed through to crossref.py:

```bash
python3 "$SKILL_DIR/scripts/crossref.py" html
```

## What Makes This Different

Neither a knowledge graph alone nor static analysis alone can answer these questions:

- **"Is this complex function actually dangerous or just ugly?"** — Risk score weights complexity by connectivity
- **"Which part of the codebase should I refactor first?"** — Highest risk = most connected + most complex + least maintainable
- **"If I change this, what breaks?"** — Graph traces the blast radius, metrics quantify the pain
- **"Are my modules actually independent?"** — Community health + ADP cycle detection reveal hidden coupling
- **"Which modules should be stable vs unstable?"** — Main Sequence plot applies Robert C. Martin's SDP

## Dependencies

- **Python 3.10+**
- **graphifyy** (~50MB with all tree-sitter parsers) — used for AST extraction and Leiden clustering
- **radon** — cyclomatic complexity, maintainability index, LOC
- **ruff** — lint rules and statistics

All three are auto-installed on first run via Step 1.

## License

MIT — see LICENSE.txt
