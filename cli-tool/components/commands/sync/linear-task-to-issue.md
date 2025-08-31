---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [task-id] | --repo | --milestone | --close-linear | --skip-attachments
description: Convert Linear tasks to GitHub issues with relationship preservation and metadata mapping
model: sonnet
---

# Linear Task to Issue

Convert Linear tasks to GitHub issues with comprehensive relationship mapping: **$ARGUMENTS**

## Current Task Context

- Task details: Based on $ARGUMENTS task identifier or selection criteria
- Target repository: !`gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "No repo context"`
- User mappings: Linear email to GitHub username correspondence
- Attachment handling: Linear attachment access and GitHub upload capabilities

## Task

Execute precise conversion of Linear tasks to GitHub issues:

**Task Target**: Use $ARGUMENTS to specify task identifier, target repository, milestone mapping, or processing preferences

**Conversion Framework**:
1. **Task Analysis** - Fetch complete Linear task data, extract relationships, analyze content structure, identify priorities
2. **Content Transformation** - Build GitHub issue body, map Linear fields, preserve formatting, handle rich content
3. **GitHub Integration** - Create issue with proper structure, apply labels, assign users, set milestones, manage relationships
4. **Attachment Migration** - Download Linear attachments, upload to GitHub, update references, maintain accessibility
5. **Comment Import** - Transfer comments with attribution, preserve timestamps, maintain context, handle mentions
6. **Cross-Reference Setup** - Create bidirectional links, update Linear task, maintain sync database, enable navigation

**Advanced Features**: Rich content conversion, attachment handling, relationship mapping, user mention translation, comprehensive validation.

**Relationship Management**: Preserve parent-child relationships, maintain team context, map project associations, handle dependencies.

**Output**: Successfully created GitHub issue with complete data migration, accurate field mappings, preserved relationships, and comprehensive conversion report.