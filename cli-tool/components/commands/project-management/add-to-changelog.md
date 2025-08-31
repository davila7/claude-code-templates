---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [version] [change-type] [message] | --added | --changed | --fixed
description: Add entry to project changelog following Keep a Changelog format
model: sonnet
---

# Update Changelog

Add a new entry to the project's CHANGELOG.md file: **$ARGUMENTS**

## Usage Examples
- `/add-to-changelog 1.1.0 added "New markdown to BlockDoc conversion feature"`
- `/add-to-changelog 1.0.2 fixed "Bug in HTML renderer causing incorrect output"`

## Current Changelog State

- Existing changelog: @CHANGELOG.md (if exists)
- Project version files: @package.json or @setup.py (if exists)

## Task

Add the specified change entry to CHANGELOG.md:

**Arguments**: 
- Version: First argument (e.g., "1.1.0")
- Change Type: Second argument (added/changed/deprecated/removed/fixed/security)  
- Message: Third argument (description of the change)

**Requirements**:
1. Create CHANGELOG.md with standard header if it doesn't exist
2. Find or create version section with today's date
3. Add entry under appropriate change type section
4. Follow Keep a Changelog format and Semantic Versioning
5. Update package version files if this is a new version

The changelog should follow [Keep a Changelog](https://keepachangelog.com/) format.