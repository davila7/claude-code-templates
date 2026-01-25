#!/usr/bin/env python3
"""
Set up a test environment for evaluating the session-handoff skill.

Creates a mock project with:
- Git repository with commit history
- Sample source files
- Sample handoffs (fresh and stale)

Usage:
    python setup_test_env.py [--path /tmp/handoff-test]
    python setup_test_env.py --clean  # Remove test environment
"""

import argparse
import os
import shutil
import subprocess
from datetime import datetime, timedelta
from pathlib import Path


DEFAULT_TEST_PATH = "/tmp/handoff-eval-project"


def run_cmd(cmd: list[str], cwd: str = None) -> bool:
    """Run a command and return success status."""
    try:
        subprocess.run(cmd, cwd=cwd, capture_output=True, check=True)
        return True
    except subprocess.CalledProcessError:
        return False


def create_test_project(base_path: str):
    """Create a mock project structure."""
    path = Path(base_path)

    # Clean if exists
    if path.exists():
        shutil.rmtree(path)

    # Create directories
    (path / "src").mkdir(parents=True)
    (path / "tests").mkdir()
    (path / "config").mkdir()

    # Create sample files
    (path / "README.md").write_text("""# Test Project

A sample project for testing the session-handoff skill.

## Features
- User authentication
- API endpoints
- Database integration
""")

    (path / "src" / "index.js").write_text("""// Main entry point
const express = require('express');
const app = express();

app.get('/', (req, res) => {
    res.send('Hello World');
});

module.exports = app;
""")

    (path / "src" / "auth.js").write_text("""// Authentication module
const jwt = require('jsonwebtoken');

function validateToken(token) {
    // TODO: Implement token validation
    return true;
}

function generateToken(user) {
    return jwt.sign({ id: user.id }, process.env.JWT_SECRET);
}

module.exports = { validateToken, generateToken };
""")

    (path / "src" / "database.js").write_text("""// Database connection
const mongoose = require('mongoose');

async function connect() {
    await mongoose.connect(process.env.DATABASE_URL);
}

module.exports = { connect };
""")

    (path / "tests" / "auth.test.js").write_text("""// Auth tests
describe('Authentication', () => {
    test('validates tokens', () => {
        expect(true).toBe(true);
    });
});
""")

    (path / "config" / "default.json").write_text("""{
    "port": 3000,
    "database": {
        "host": "localhost",
        "name": "testdb"
    }
}
""")

    (path / "package.json").write_text("""{
    "name": "test-project",
    "version": "1.0.0",
    "main": "src/index.js",
    "scripts": {
        "start": "node src/index.js",
        "test": "jest"
    }
}
""")

    print(f"Created project structure at {path}")
    return path


def init_git_repo(path: Path):
    """Initialize git repo with commit history."""
    # Initialize
    run_cmd(["git", "init"], cwd=str(path))
    run_cmd(["git", "config", "user.email", "test@example.com"], cwd=str(path))
    run_cmd(["git", "config", "user.name", "Test User"], cwd=str(path))

    # Initial commit
    run_cmd(["git", "add", "."], cwd=str(path))
    run_cmd(["git", "commit", "-m", "Initial commit: project setup"], cwd=str(path))

    # Add more commits to simulate history
    commits = [
        ("src/auth.js", "// Added validation logic\n", "Add token validation"),
        ("src/database.js", "// Added connection pooling\n", "Implement connection pooling"),
        ("tests/auth.test.js", "// More tests\n", "Add authentication tests"),
        ("src/index.js", "// Added middleware\n", "Add auth middleware"),
        ("README.md", "\n## API Docs\n", "Update documentation"),
    ]

    for file, content, message in commits:
        file_path = path / file
        with open(file_path, "a") as f:
            f.write(content)
        run_cmd(["git", "add", file], cwd=str(path))
        run_cmd(["git", "commit", "-m", message], cwd=str(path))

    print(f"Initialized git repo with {len(commits) + 1} commits")


def create_sample_handoffs(path: Path):
    """Create sample handoff documents for testing."""
    handoffs_dir = path / ".claude" / "handoffs"
    handoffs_dir.mkdir(parents=True)

    # Fresh handoff (today)
    now = datetime.now()
    fresh_name = now.strftime("%Y-%m-%d-%H%M%S") + "-auth-implementation.md"
    fresh_content = f"""# Handoff: Implementing User Authentication

## Session Metadata
- Created: {now.strftime("%Y-%m-%d %H:%M:%S")}
- Project: {path}
- Branch: main
- Session duration: 2 hours

## Handoff Chain

- **Continues from**: None (fresh start)
- **Supersedes**: None

## Current State Summary

Working on implementing JWT-based authentication for the API. Successfully added token generation and basic validation. The middleware integration is partially complete.

## Codebase Understanding

### Architecture Overview

Express.js application with modular structure. Auth logic separated into src/auth.js, database connection in src/database.js.

### Critical Files

| File | Purpose | Relevance |
|------|---------|-----------|
| src/auth.js | Authentication logic | Main file being modified |
| src/index.js | App entry point | Needs middleware integration |

### Key Patterns Discovered

- Using environment variables for secrets (JWT_SECRET, DATABASE_URL)
- Jest for testing

## Work Completed

### Tasks Finished

- [x] Set up JWT token generation
- [x] Create basic validation function
- [ ] Integrate middleware (in progress)

### Files Modified

| File | Changes | Rationale |
|------|---------|-----------|
| src/auth.js | Added validateToken, generateToken | Core auth functionality |

### Decisions Made

| Decision | Options Considered | Rationale |
|----------|-------------------|-----------|
| Use JWT over sessions | JWT, Sessions, OAuth | Stateless, scales better for API |

## Pending Work

### Immediate Next Steps

1. Complete middleware integration in src/index.js
2. Add refresh token logic
3. Write comprehensive tests

### Blockers/Open Questions

- [ ] Need to decide on token expiry time (1h vs 24h)

### Deferred Items

- OAuth integration (future sprint)

## Context for Resuming Agent

### Important Context

The validateToken function in src/auth.js currently returns true always - this is a placeholder that needs real implementation. The JWT_SECRET env var must be set.

### Assumptions Made

- Using HS256 algorithm for JWT
- Tokens should be passed in Authorization header

### Potential Gotchas

- Don't forget to set JWT_SECRET environment variable
- Database connection must be established before auth checks

## Environment State

### Tools/Services Used

- Node.js with Express
- JWT library (jsonwebtoken)

### Active Processes

- None currently running

### Environment Variables

- JWT_SECRET
- DATABASE_URL

## Related Resources

- JWT documentation: https://jwt.io
- Express middleware guide
"""
    (handoffs_dir / fresh_name).write_text(fresh_content)

    # Stale handoff (2 weeks ago)
    old_date = now - timedelta(days=14)
    stale_name = old_date.strftime("%Y-%m-%d-%H%M%S") + "-database-setup.md"
    stale_content = f"""# Handoff: Database Setup

## Session Metadata
- Created: {old_date.strftime("%Y-%m-%d %H:%M:%S")}
- Project: {path}
- Branch: main
- Session duration: 1 hour

## Handoff Chain

- **Continues from**: None (fresh start)
- **Supersedes**: None

## Current State Summary

Set up initial database connection with MongoDB. Basic schema defined but not fully implemented.

## Codebase Understanding

### Architecture Overview

MongoDB database with Mongoose ODM.

### Critical Files

| File | Purpose | Relevance |
|------|---------|-----------|
| src/database.js | DB connection | Main database file |
| src/old-file.js | Legacy code | Was being refactored |

## Pending Work

### Immediate Next Steps

1. Define user schema
2. Add connection pooling
3. Implement error handling

## Context for Resuming Agent

### Important Context

Using MongoDB Atlas for hosting. Connection string in DATABASE_URL.

### Assumptions Made

- MongoDB version 5.x
- Mongoose 7.x

## Environment State

### Environment Variables

- DATABASE_URL
"""
    (handoffs_dir / stale_name).write_text(stale_content)

    # Incomplete handoff (with TODOs)
    incomplete_name = now.strftime("%Y-%m-%d-%H%M%S") + "-incomplete-test.md"
    incomplete_content = f"""# Handoff: [TASK_TITLE - replace this]

## Session Metadata
- Created: {now.strftime("%Y-%m-%d %H:%M:%S")}
- Project: {path}
- Branch: main
- Session duration: [estimate how long you worked]

## Current State Summary

[TODO: Write one paragraph describing what was being worked on]

## Codebase Understanding

### Architecture Overview

[TODO: Document key architectural insights]

## Pending Work

### Immediate Next Steps

1. [TODO: Most critical next action]
2. [TODO: Second priority]

## Context for Resuming Agent

### Important Context

[TODO: This is the MOST IMPORTANT section]
"""
    (handoffs_dir / incomplete_name).write_text(incomplete_content)

    print(f"Created 3 sample handoffs:")
    print(f"  - {fresh_name} (fresh)")
    print(f"  - {stale_name} (stale, 14 days old)")
    print(f"  - {incomplete_name} (incomplete, has TODOs)")


def clean_test_env(path: str):
    """Remove test environment."""
    if Path(path).exists():
        shutil.rmtree(path)
        print(f"Cleaned up test environment at {path}")
    else:
        print(f"No test environment found at {path}")


def main():
    parser = argparse.ArgumentParser(
        description="Set up test environment for session-handoff skill"
    )
    parser.add_argument(
        "--path",
        default=DEFAULT_TEST_PATH,
        help=f"Path for test project (default: {DEFAULT_TEST_PATH})"
    )
    parser.add_argument(
        "--clean",
        action="store_true",
        help="Remove test environment instead of creating"
    )

    args = parser.parse_args()

    if args.clean:
        clean_test_env(args.path)
    else:
        path = create_test_project(args.path)
        init_git_repo(path)
        create_sample_handoffs(path)
        print(f"\nTest environment ready at: {args.path}")
        print(f"\nTo test, run:")
        print(f"  cd {args.path}")
        print(f"  # Then use Claude Code with the session-handoff skill")


if __name__ == "__main__":
    main()
