---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [pr-number] | --team | --estimate | --batch-process | --auto-create
description: Create Linear tasks from GitHub pull requests with intelligent content extraction and task sizing
model: sonnet
---

# Task from PR

Create Linear tasks from GitHub pull requests with intelligent analysis: **$ARGUMENTS**

## Current PR Environment

- Repository: !`gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "No repo context"`
- PR status: Based on $ARGUMENTS PR number or batch processing criteria
- Linear teams: Available teams for task assignment
- User mappings: GitHub username to Linear user correspondence

## Task

Generate Linear tasks from GitHub pull requests with comprehensive content analysis:

**PR Source**: Use $ARGUMENTS to specify PR number, team assignment, size estimation, or batch processing mode

**Task Generation Framework**:
1. **PR Analysis** - Extract comprehensive PR data, parse description structure, identify key components, analyze changes
2. **Content Extraction** - Parse structured sections, extract checklists, identify technical details, capture requirements
3. **Intelligent Sizing** - Estimate task complexity from code changes, file count, review comments, testing requirements
4. **Task Construction** - Build Linear task with proper formatting, preserve PR context, maintain references, structure content
5. **Team Assignment** - Map to appropriate Linear team, assign based on code areas, set priorities from labels
6. **Validation & Creation** - Check for duplicates, validate task structure, create in Linear, establish bidirectional links

**Advanced Features**: Smart content parsing, automated size estimation, intelligent team mapping, comprehensive validation, batch processing.

**Quality Assurance**: Duplicate detection, content validation, proper formatting, relationship maintenance, comprehensive error handling.

**Output**: Successfully created Linear tasks with comprehensive PR context, accurate sizing estimates, proper team assignments, and complete bidirectional linking.