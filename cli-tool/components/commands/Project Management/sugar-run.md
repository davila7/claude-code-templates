# /sugar-run

Start Sugar's autonomous execution mode with safety validation and monitoring guidance.

## Purpose

The `/sugar-run` command initiates Sugar's autonomous development mode, where AI agents independently select and execute tasks from your queue. This command emphasizes safety-first execution with validation, dry-run testing, and proper monitoring setup.

## Usage

### Validate Configuration First (Recommended)
```
/sugar-run --validate
```
Checks configuration, environment, and requirements before execution.

### Dry Run Test
```
/sugar-run --dry-run --once
```
Simulates execution without making changes - perfect for testing.

### Single Cycle Execution
```
/sugar-run --once
```
Executes one task cycle and exits - ideal for controlled testing.

### Continuous Autonomous Mode
```
/sugar-run
```
Runs continuously until manually stopped - for production autonomous development.

## Implementation

The agent follows a safety-first approach:

### Step 1: Pre-Flight Validation
Before starting any execution, verify:
- Sugar initialized (`.sugar/` directory exists)
- Configuration valid (`.sugar/config.yaml` properly configured)
- Claude CLI accessible
- Database operational
- Task queue has work
- Git repository status (recommended)

### Step 2: Guided Startup Sequence
For first-time users or production starts:

1. **Validate:** Run `/sugar-run --validate` and review all checks
2. **Dry Run:** Test with `/sugar-run --dry-run --once` to simulate
3. **Single Cycle:** Execute real work with `/sugar-run --once`
4. **Monitor:** Verify results, check logs, confirm quality
5. **Continuous:** Start full autonomous mode with `/sugar-run`

### Step 3: Monitoring Setup
Provide users with monitoring commands:

```bash
# Real-time log monitoring
tail -f .sugar/sugar.log

# Check status periodically
sugar status

# View active tasks
sugar list --status active

# Background execution with logging
nohup sugar run > sugar-autonomous.log 2>&1 &
echo $! > .sugar/sugar.pid
```

### Step 4: Safety Reminders
Always emphasize:
- ✅ Test with dry-run before real execution
- ✅ Monitor logs actively during first cycles
- ✅ Have git commits as backups
- ✅ Use graceful shutdown (Ctrl+C, not kill -9)
- ✅ Review completed work for quality

## Examples

### Example 1: First Time Setup
**User:** `/sugar-run`

**Agent Response:**
"Let's start Sugar's autonomous mode safely. Since this appears to be your first time (or a fresh start), I'll guide you through the recommended validation sequence.

**Step 1: Validate Configuration**

```bash
sugar run --validate
```

Running validation checks...

```
✅ Configuration valid (.sugar/config.yaml)
✅ Database accessible (.sugar/sugar.db)
✅ Claude CLI found (/usr/local/bin/claude)
✅ Git repository detected
✅ Task queue has 8 pending tasks
⚠️ Warning: dry_run=false (will make real changes)

System ready for execution.
```

**Step 2: Test with Dry Run**

Let's simulate execution without making changes:

```bash
sugar run --dry-run --once
```

```
[DRY RUN] Sugar Autonomous Execution
[DRY RUN] Selected task: Fix login timeout (task-123, priority: 4)
[DRY RUN] Would assign to: backend-developer agent
[DRY RUN] Estimated approach: Add session timeout configuration
[DRY RUN] Would execute: Implementation + testing
[DRY RUN] No actual changes made
```

Dry run looks good! The system would select and execute the high-priority login timeout fix.

**Step 3: Execute One Real Cycle**

Ready to execute one real task?

```bash
sugar run --once
```

This will:
- Select highest priority task from queue
- Execute using appropriate agent
- Make real code changes
- Run tests
- Update task status

Proceed? (The agent would wait for confirmation)"

### Example 2: Quick Execution
**User:** `/sugar-run --once`

**Agent Response:**
"Starting single cycle execution...

```bash
sugar run --once
```

```
🚀 Sugar Autonomous Execution (Single Cycle)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Selected Task: Fix database connection leak (task-124)
   Priority: 5 (Urgent)
   Type: bug_fix
   Agent: backend-developer

🔨 Executing...
   ✅ Root cause identified: Missing connection.close() in error handler
   ✅ Implemented fix: Added finally block with cleanup
   ✅ Added connection pool monitoring
   ✅ Tests passed (including stress test)
   ✅ Task marked complete

⏱️  Duration: 35 minutes
📊 Status: ✅ SUCCESS
```

**Task Completed Successfully!**

The database connection leak has been fixed. Changes include:
- Added proper connection cleanup in error handlers
- Implemented connection pool monitoring
- Added stress tests to prevent regression

**Next Steps:**
1. Review changes: `git diff`
2. Verify fix: Check `.sugar/sugar.log` for details
3. View task: `sugar view task-124`
4. Continue execution: `/sugar-run --once` for next task
5. Or start continuous mode: `/sugar-run`
"

### Example 3: Production Autonomous Mode
**User:** `/sugar-run --validate` then confirms to start continuous mode

**Agent Response:**
"Configuration validated successfully. Starting continuous autonomous mode...

```bash
# Starting in background with logging
nohup sugar run > sugar-autonomous.log 2>&1 &
echo $! > .sugar/sugar.pid
```

```
🤖 Sugar Autonomous Mode Started
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Process ID: 42315 (saved to .sugar/sugar.pid)
Log File: sugar-autonomous.log
Loop Interval: 5 minutes
Max Concurrent: 2 tasks

System will continuously:
1. Select highest priority pending tasks
2. Assign to appropriate specialized agents
3. Execute autonomous development
4. Monitor progress and quality
5. Repeat every 5 minutes

✅ Autonomous mode running in background
```

**Monitoring Commands:**

```bash
# Real-time log monitoring
tail -f sugar-autonomous.log

# Check system status
sugar status

# View active tasks
sugar list --status active

# Stop gracefully
kill $(cat .sugar/sugar.pid)
```

**Important:**
- Monitor logs actively for the first few cycles
- Check completed work quality with git diff
- System will run until manually stopped
- Use Ctrl+C or kill (not kill -9) for graceful shutdown

**Logs will show:**
- Task selection decisions
- Agent assignments
- Execution progress
- Completion status
- Any errors or issues

Your autonomous development system is now running! 🚀
"

### Example 4: Troubleshooting
**User:** `/sugar-run` but validation fails

**Agent Response:**
"Let me validate your configuration first...

```bash
sugar run --validate
```

```
⚠️  Configuration Issues Detected
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Database accessible
❌ Claude CLI not found
   Expected: /usr/local/bin/claude
   Error: Command not found
   Fix: Install Claude CLI or update path in config

❌ No tasks in queue
   Warning: Nothing to execute
   Fix: Create tasks with /sugar-task or /sugar-analyze

⚠️ Git repository not initialized
   Warning: No version control detected
   Recommendation: Initialize git for safety

Configuration invalid - cannot start execution
```

**Issues Found:**

**1. Claude CLI Missing** 🚨
The Claude CLI is not installed or not in PATH.

Fix:
```bash
# Check if Claude is installed
which claude

# If not found, verify installation
# Then update config with correct path:
vim .sugar/config.yaml
# Set: claude.command: \"/path/to/claude\"
```

**2. Empty Task Queue** ⚠️
No tasks available for execution.

Fix:
```bash
# Create tasks manually
/sugar-task \"Your task description\"

# Or discover work automatically
/sugar-analyze
```

**3. No Git Repository** ℹ️
Git provides safety through version control.

Recommendation:
```bash
git init
git add .
git commit -m \"Initial commit before autonomous execution\"
```

**Next Steps:**
1. Fix critical issues (Claude CLI, task queue)
2. Run validation again: `/sugar-run --validate`
3. When all checks pass, start with dry-run: `/sugar-run --dry-run --once`
"

## Integration with Claude Code

The command provides:
- **Safety-first approach** with validation and testing
- **Step-by-step guidance** for first-time users
- **Clear monitoring setup** for production use
- **Troubleshooting assistance** when issues arise
- **Graceful degradation** with helpful error messages

This ensures users can confidently start autonomous execution with appropriate safeguards and monitoring in place.
