---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [import-scope] | --state | --label | --milestone | --batch-size
description: Bulk import GitHub issues to Linear with comprehensive progress tracking and error handling
model: sonnet
---

# Bulk Import Issues

Bulk import GitHub issues to Linear with advanced processing capabilities: **$ARGUMENTS**

## Current Import Context

- Repository: !`gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "No repo context"`
- Issue count: !`gh api repos/{owner}/{repo}/issues?state=all --paginate | jq length 2>/dev/null || echo "Check manually"`
- Linear teams: Check available Linear teams and projects for import mapping
- Rate limits: !`gh api rate_limit -q '.rate | "GitHub: \(.remaining)/\(.limit)"' 2>/dev/null || echo "Check GitHub rate limit"`

## Task

Execute efficient bulk import of GitHub issues to Linear with comprehensive management:

**Import Scope**: Use $ARGUMENTS to filter by state, labels, milestones, or configure batch processing parameters

**Import Pipeline**:
1. **Pre-Import Analysis** - Issue discovery, duplicate detection, import estimation, resource planning
2. **Batch Configuration** - Dynamic batch sizing, rate limit management, progress tracking, error handling
3. **Data Transformation** - Field mapping, priority inference, user mapping, content enhancement
4. **Import Execution** - Parallel processing, retry logic, transaction management, progress reporting
5. **Error Recovery** - Failed item handling, retry mechanisms, partial import recovery, validation
6. **Post-Import Actions** - Cross-reference creation, GitHub updates, mapping files, notifications

**Advanced Features**: Dynamic batch adjustment, intelligent rate limiting, duplicate detection, comprehensive error recovery, progress visualization.

**Quality Assurance**: Pre-import validation, post-import verification, data integrity checks, comprehensive audit trails.

**Output**: Complete import results with success metrics, failed item reports, mapping documentation, and performance analytics for large-scale issue migration.