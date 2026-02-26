# GCC File Format Reference

## main.md

The global roadmap. Updated on every MERGE and periodically on significant COMMITs.

```markdown
# Project Roadmap

## Objectives
- [ ] Objective 1
- [x] Objective 2 (completed)

## Milestones
### M1: Feature X implemented
- Branch: feature-x
- Commits: 3
- Status: merged

### M2: Bug fix Y
- Branch: fix-y
- Commits: 1
- Status: active

## Active Branches
- `experiment-z`: Testing alternative approach for caching
```

## commit.md

Each commit entry captures the full reasoning context, not just a diff summary.

```markdown
## [C003] Implement retry logic for API calls
- **Date**: 2025-01-15T10:30:00Z
- **Branch**: feature-resilience
- **Branch Purpose**: Add fault tolerance to external API integrations
- **Previous Progress**: Identified failure patterns in logs; designed retry strategy with exponential backoff
- **This Commit's Contribution**: Implemented `retry_with_backoff(fn, max_retries=3)` in `utils/http.py`. Added unit tests covering timeout, 5xx, and network error scenarios. Validated against staging API.
- **Files touched**: utils/http.py, tests/test_http.py
```

## log.md

Fine-grained OTA (Observation-Thought-Action) trace entries. Keep the last 50 entries maximum.

```markdown
---
**[OTA-042]** 2025-01-15T10:15:00Z | Branch: feature-resilience
- **Observation**: API calls to /users endpoint failing with 503 errors intermittently
- **Thought**: Need exponential backoff rather than fixed delay; should cap at 3 retries to avoid infinite loops
- **Action**: Implementing retry_with_backoff() in utils/http.py

---
**[OTA-043]** 2025-01-15T10:28:00Z | Branch: feature-resilience
- **Observation**: Tests passing for timeout and 5xx scenarios
- **Thought**: Ready to commit this milestone - retry logic is complete and validated
- **Action**: COMMIT with summary of retry implementation
```

## metadata.yaml

Structured infrastructure state. Updated on every operation.

```yaml
version: 1
created: "2025-01-10T08:00:00Z"
proactive_commits: true
branches:
  - name: main
    status: active
    created: "2025-01-10T08:00:00Z"
  - name: feature-resilience
    status: active
    created: "2025-01-15T09:00:00Z"
    parent: main
  - name: experiment-cache
    status: abandoned
    created: "2025-01-12T14:00:00Z"
    reason: "Redis dependency too heavy for this use case"
file_tree:
  - src/main.py
  - src/utils/http.py
  - tests/test_http.py
dependencies:
  - requests>=2.28
  - pytest>=7.0
config:
  language: python
  framework: fastapi
```

## Branch Directory Structure

Each branch under `.GCC/branches/<branch-name>/` contains:

```
.GCC/branches/feature-resilience/
├── commit.md    # Commits specific to this branch
├── log.md       # OTA traces for this branch
└── summary.md   # Branch purpose and current status
```

### summary.md (per-branch)

```markdown
# Branch: feature-resilience

## Purpose
Add fault tolerance to external API integrations to handle intermittent 503 errors.

## Status: active
## Parent: main
## Created: 2025-01-15T09:00:00Z

## Key Decisions
- Using exponential backoff (not fixed delay)
- Max 3 retries to prevent cascade failures
- Logging all retry attempts for observability
```
