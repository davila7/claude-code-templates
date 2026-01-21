# CLI Operations Reference

Complete guide for operating CocoIndex flows using the CLI.

## Overview

The CocoIndex CLI (`cocoindex` command) provides tools for managing and inspecting flows. Most commands require an `APP_TARGET` argument specifying where flow definitions are located.

## Environment Setup

### Environment Variables

Create a `.env` file in the project directory:

```bash
# Database connection (required)
COCOINDEX_DATABASE_URL=postgresql://user:password@localhost/cocoindex_db

# Optional: App namespace for organizing flows
COCOINDEX_APP_NAMESPACE=dev

# Optional: Global concurrency limits
COCOINDEX_SOURCE_MAX_INFLIGHT_ROWS=50
COCOINDEX_SOURCE_MAX_INFLIGHT_BYTES=524288000  # 500MB

# Optional: LLM API keys (if using LLM functions)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
VOYAGE_API_KEY=pa-...
```

### Loading Environment Files

```bash
# Default: loads .env from current directory
cocoindex <command> ...

# Specify custom env file
cocoindex --env-file path/to/.env <command> ...

# Specify app directory
cocoindex --app-dir /path/to/project <command> ...
```

## APP_TARGET Format

The `APP_TARGET` tells the CLI where flow definitions are located:

### Python Module
```bash
# Load from module name
cocoindex update main

# Load from package module
cocoindex update my_package.flows
```

### Python File
```bash
# Load from file path
cocoindex update main.py

# Load from nested file
cocoindex update path/to/flows.py
```

### Specific Flow
```bash
# Target specific flow in module
cocoindex update main:MyFlowName

# Target specific flow in file
cocoindex update path/to/flows.py:MyFlowName
```

## Core Commands

### setup - Initialize Flow Resources

Create all persistent backends needed by flows (database tables, collections, etc.).

```bash
# Setup all flows
cocoindex setup main.py

# Setup specific flow
cocoindex setup main.py:MyFlow
```

**What it does:**
- Creates internal storage tables in Postgres
- Creates target resources (database tables, vector collections, graph structures)
- Updates schemas if flow definition changed
- No-op if already set up and no changes needed

**When to use:**
- First time running a flow
- After modifying flow structure (new fields, new targets)
- After dropping flows to recreate resources

### update - Build/Update Target Data

Run transformations and update target data based on current source data.

```bash
# One-time update
cocoindex update main.py

# One-time update with setup
cocoindex update --setup main.py

# One-time update specific flow
cocoindex update main.py:TextEmbedding

# Force reexport even if no changes
cocoindex update --reexport main.py
```

**What it does:**
- Reads source data
- Applies transformations
- Updates target databases
- Uses incremental processing (only processes changed data)

**Options:**
- `--setup` - Run setup first if needed
- `--reexport` - Reexport all data even if unchanged (useful after data loss)

### update -L - Live Update Mode

Continuously monitor source changes and update targets.

```bash
# Live update mode
cocoindex update main.py -L

# Live update with setup
cocoindex update --setup main.py -L

# Live update with reexport on initial update
cocoindex update --reexport main.py -L
```

**What it does:**
- Performs initial one-time update
- Continuously monitors source changes
- Automatically processes updates
- Runs until aborted (Ctrl-C)

**Requires:**
- At least one source with change capture enabled:
  - `refresh_interval` parameter on source
  - Source-specific change capture (Postgres notifications, S3 events, etc.)

**Example with refresh interval:**
```python
data_scope["documents"] = flow_builder.add_source(
    cocoindex.sources.LocalFile(path="documents"),
    refresh_interval=datetime.timedelta(minutes=1)  # Check every minute
)
```

### drop - Remove Flow Resources

Remove all persistent backends owned by flows.

```bash
# Drop all flows
cocoindex drop main.py

# Drop specific flow
cocoindex drop main.py:MyFlow
```

**What it does:**
- Drops internal storage tables
- Drops target resources (tables, collections, graphs)
- Cleans up all persistent data

**Warning:** This is destructive and cannot be undone!

### show - Inspect Flow Definition

Display flow structure and statistics.

```bash
# Show flow structure
cocoindex show main.py:MyFlow

# Show all flows
cocoindex show main.py
```

**What it shows:**
- Flow name and structure
- Sources configured
- Transformations defined
- Targets and their schemas
- Current statistics (if flow is set up)

### evaluate - Test Flow Without Updating

Run transformations and dump results to files without updating targets.

```bash
# Evaluate flow
cocoindex evaluate main.py:MyFlow

# Specify output directory
cocoindex evaluate main.py:MyFlow --output-dir ./eval_results

# Disable cache
cocoindex evaluate main.py:MyFlow --no-cache
```

**What it does:**
- Runs transformations
- Saves results to files (JSON, CSV, etc.)
- Does NOT update targets
- Uses existing cache by default

**When to use:**
- Testing flow logic before running full update
- Debugging transformation issues
- Inspecting intermediate data
- Validating output format

**Options:**
- `--output-dir PATH` - Directory for output files (default: `eval_{flow_name}_{timestamp}`)
- `--no-cache` - Disable reading from cache (still doesn't write to cache)

## Complete Workflow Examples

### First-Time Setup and Indexing

```bash
# 1. Setup flow resources
cocoindex setup main.py

# 2. Run initial indexing
cocoindex update main.py

# 3. Verify results
cocoindex show main.py
```

### Development Workflow

```bash
# 1. Test with evaluate (no side effects)
cocoindex evaluate main.py:MyFlow --output-dir ./test_output

# 2. If looks good, setup and update
cocoindex update --setup main.py:MyFlow

# 3. Check results
cocoindex show main.py:MyFlow
```

### Production Live Updates

```bash
# Run with live updates and auto-setup
cocoindex update --setup main.py -L
```

### Rebuild After Changes

```bash
# Drop old resources
cocoindex drop main.py

# Setup with new definition
cocoindex setup main.py

# Reindex everything
cocoindex update --reexport main.py
```

### Multiple Flows

```bash
# Setup all flows
cocoindex setup main.py

# Update specific flows
cocoindex update main.py:CodeEmbedding
cocoindex update main.py:DocumentEmbedding

# Show all flows
cocoindex show main.py
```

## Common Issues and Solutions

### Issue: "Flow not found"

**Problem:** CLI can't find the flow definition.

**Solutions:**
```bash
# Make sure APP_TARGET is correct
cocoindex show main.py  # Should list flows

# Use --app-dir if not in project root
cocoindex --app-dir /path/to/project show main.py

# Check flow name is correct
cocoindex show main.py:CorrectFlowName
```

### Issue: "Database connection failed"

**Problem:** Can't connect to Postgres.

**Solutions:**
```bash
# Check .env file exists
cat .env | grep COCOINDEX_DATABASE_URL

# Test connection
psql $COCOINDEX_DATABASE_URL

# Use --env-file if .env is elsewhere
cocoindex --env-file /path/to/.env update main.py
```

### Issue: "Schema mismatch"

**Problem:** Flow definition changed but resources not updated.

**Solution:**
```bash
# Re-run setup to update schemas
cocoindex setup main.py

# Then update data
cocoindex update main.py
```

### Issue: "Live update exits immediately"

**Problem:** No change capture mechanisms enabled.

**Solution:**
Add refresh_interval or use source-specific change capture:
```python
data_scope["docs"] = flow_builder.add_source(
    cocoindex.sources.LocalFile(path="docs"),
    refresh_interval=datetime.timedelta(seconds=30)  # Add this
)
```

## Advanced Options

### Global Options

```bash
# Show version
cocoindex --version

# Show help
cocoindex --help
cocoindex update --help

# Specify app directory
cocoindex --app-dir /custom/path update main

# Custom env file
cocoindex --env-file prod.env update main
```

### Performance Tuning

Set environment variables for concurrency:

```bash
# In .env file
COCOINDEX_SOURCE_MAX_INFLIGHT_ROWS=100
COCOINDEX_SOURCE_MAX_INFLIGHT_BYTES=1073741824  # 1GB
```

Or per-source in code:
```python
data_scope["docs"] = flow_builder.add_source(
    cocoindex.sources.LocalFile(path="docs"),
    max_inflight_rows=50,
    max_inflight_bytes=500*1024*1024  # 500MB
)
```

## Best Practices

1. **Use evaluate before update** - Test flow logic without side effects
2. **Always setup before first update** - Or use `--setup` flag
3. **Use live updates in production** - Keeps targets always fresh
4. **Set app namespace** - Organize flows across environments (dev/staging/prod)
5. **Monitor with show** - Regularly check flow statistics
6. **Version control .env.example** - Document required environment variables
7. **Use specific flow targets** - For selective updates: `main.py:FlowName`
8. **Setup after definition changes** - Ensures schemas match flow definition
