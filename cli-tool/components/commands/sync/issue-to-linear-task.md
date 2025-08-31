---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [issue-number] | --team | --project | --close-github | --skip-comments
description: Convert individual GitHub issues to Linear tasks with comprehensive data preservation
model: sonnet
---

# Issue to Linear Task

Convert GitHub issues to Linear tasks with comprehensive field mapping: **$ARGUMENTS**

## Current Conversion Context

- Repository: !`gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "No repo context"`
- Issue details: Based on $ARGUMENTS issue number or selection criteria
- Linear teams: Available Linear teams and project assignments
- User mappings: @user-mappings.json or GitHub-Linear user correspondence

## Task

Execute precise conversion of individual GitHub issues to Linear tasks:

**Issue Target**: Use $ARGUMENTS to specify issue number, conversion options, team assignment, or processing preferences

**Conversion Framework**:
1. **Issue Analysis** - Fetch complete issue data, extract metadata, analyze content structure, infer priorities
2. **Data Transformation** - Map fields accurately, convert formats, preserve relationships, enhance descriptions
3. **Linear Integration** - Create task with proper formatting, assign team/project, set priorities, manage labels
4. **Content Migration** - Import comments with attribution, handle attachments, preserve formatting, maintain threading
5. **Reference Management** - Create bidirectional links, update sync database, maintain cross-references, enable navigation
6. **Validation & Confirmation** - Verify conversion accuracy, confirm field mappings, validate relationships, provide preview

**Advanced Features**: Smart priority inference, intelligent user mapping, attachment handling, comment threading, comprehensive validation.

**Data Fidelity**: Preserve original formatting, maintain all metadata, keep comment attribution, ensure relationship integrity.

**Output**: Successfully converted Linear task with complete data preservation, accurate field mappings, bidirectional references, and comprehensive conversion summary.