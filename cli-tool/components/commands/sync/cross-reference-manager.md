---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [action] | audit | repair | map | validate | export
description: Manage cross-platform reference links between GitHub and Linear with integrity checking
model: sonnet
---

# Cross-Reference Manager

Manage comprehensive cross-platform reference links with integrity validation: **$ARGUMENTS**

## Current Reference State

- GitHub CLI: !`gh --version 2>/dev/null && echo "✓ Available" || echo "⚠ Not available"`
- Linear MCP: Check Linear MCP server connectivity and authentication
- Reference database: @.reference-mappings.json or reference state files
- Link integrity: !`find . -name "*sync*" -o -name "*reference*" | wc -l` mapping files found

## Task

Implement comprehensive cross-reference management for GitHub-Linear integration:

**Management Action**: Use $ARGUMENTS to specify audit, repair, mapping, validation, or export operations

**Reference Management Framework**:
1. **Reference Database** - Initialize mapping storage, track bidirectional links, maintain sync history
2. **Integrity Auditing** - Scan cross-references, identify orphaned links, detect mismatches, validate consistency
3. **Smart Repair** - Fix broken references, update outdated links, consolidate duplicates, remove invalid entries
4. **Mapping Visualization** - Display reference networks, show connection health, highlight problems, provide statistics
5. **Deep Validation** - Verify link functionality, test bidirectional navigation, check field consistency, ensure data integrity
6. **Export & Documentation** - Generate mapping reports, create backup files, provide import instructions, maintain audit trails

**Advanced Features**: Automated orphan detection, intelligent reference reconstruction, duplicate consolidation, comprehensive validation.

**Data Protection**: Backup before modifications, transaction-based operations, rollback capabilities, comprehensive logging.

**Output**: Complete reference management system with integrity reports, repair summaries, mapping visualizations, and comprehensive cross-platform link maintenance.