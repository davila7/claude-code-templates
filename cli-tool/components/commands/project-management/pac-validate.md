---
allowed-tools: Read, Bash
argument-hint: [scope] | --file | --epic | --fix | --pre-commit
description: Validate Product as Code project structure and files for PAC specification compliance
model: sonnet
---

# Validate PAC Structure

Validate Product as Code project structure and files for PAC specification compliance: **$ARGUMENTS**

## Current PAC State

- PAC directory: !`ls -la .pac/ 2>/dev/null || echo "No .pac directory found"`
- Configuration: @.pac/pac.config.yaml (if exists)
- Epic count: !`find .pac/epics/ -name "*.yaml" 2>/dev/null | wc -l`
- Ticket count: !`find .pac/tickets/ -name "*.yaml" 2>/dev/null | wc -l`

## Task

Comprehensive validation of PAC project structure and specification compliance:

**Validation Scope**: Use $ARGUMENTS for specific files/epics or validate entire PAC structure

**Validation Checks**:
1. **Structure Validation** - Directory structure and required files
2. **Configuration Compliance** - PAC config file format and values
3. **Epic Validation** - YAML syntax, required fields, and spec compliance
4. **Ticket Validation** - Format, metadata, and epic references
5. **Cross-Reference Integrity** - Epic-ticket relationships and dependencies
6. **Data Consistency** - Timestamps, status transitions, and ID uniqueness

**Output**: Detailed validation report with compliance status, issues found, and specific recommendations for fixes. Use --fix to automatically resolve common issues.

**Exit Codes**: 0 (valid), 1 (errors found), 2 (configuration issues)
