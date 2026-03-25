# Skills Provider

> Expose agent skills as MCP resources

Agent skills are directories containing instructions and supporting files that teach an AI assistant how to perform specific tasks. Tools like Claude Code, Cursor, and VS Code Copilot each have their own skills directories where users can add custom capabilities. The Skills Provider exposes these skill directories as MCP resources, making skills discoverable and shareable across different AI tools and clients.

## Why Skills as Resources

Skills live in platform-specific directories (`~/.claude/skills/`, `~/.cursor/skills/`, etc.) and typically contain a main instruction file plus supporting reference materials. When you want to share skills between tools or access them from a custom client, you need a way to discover and retrieve these files programmatically.

The Skills Provider solves this by exposing each skill as a set of MCP resources. A client can list available skills, read the main instruction file, check the manifest to see what supporting files exist, and fetch any file it needs. This transforms local skill directories into a standardized API that works with any MCP client.

## Quick Start

Create a provider pointing to your skills directory, then add it to your server.

```python
from pathlib import Path

from fastmcp import FastMCP
from fastmcp.server.providers.skills import SkillsDirectoryProvider

mcp = FastMCP("Skills Server")
mcp.add_provider(SkillsDirectoryProvider(roots=Path.home() / ".claude" / "skills"))
```

Each subdirectory containing a `SKILL.md` file becomes a discoverable skill. Clients can then list resources to see available skills and read them as needed.

```python
from fastmcp import Client

async with Client(mcp) as client:
    # List all skill resources
    resources = await client.list_resources()
    for r in resources:
        print(r.uri)  # skill://my-skill/SKILL.md, skill://my-skill/_manifest, ...

    # Read a skill's main instruction file
    result = await client.read_resource("skill://my-skill/SKILL.md")
    print(result[0].text)
```

## Skill Structure

A skill is a directory containing a main instruction file (default: `SKILL.md`) and optionally supporting files. The directory name becomes the skill's identifier.

```
~/.claude/skills/
├── pdf-processing/
│   ├── SKILL.md           # Main instructions
│   ├── reference.md       # Supporting documentation
│   └── examples/
│       └── sample.pdf
└── code-review/
    └── SKILL.md
```

The main file can include YAML frontmatter to provide metadata. If no frontmatter exists, the provider extracts a description from the first meaningful line of content.

```markdown
---
description: Process and extract information from PDF documents
---

# PDF Processing

Instructions for handling PDFs...
```

## Resource URIs

Each skill exposes three types of resources, all using the `skill://` URI scheme.

The main instruction file contains the primary skill content. This is the resource clients read to understand what a skill does and how to use it.

```
skill://pdf-processing/SKILL.md
```

The manifest is a synthetic JSON resource listing all files in the skill directory with their sizes and SHA256 hashes. Clients use this to discover supporting files and verify content integrity.

```
skill://pdf-processing/_manifest
```

Reading the manifest returns structured file information.

```json
{
  "skill": "pdf-processing",
  "files": [
    {"path": "SKILL.md", "size": 1234, "hash": "sha256:abc123..."},
    {"path": "reference.md", "size": 567, "hash": "sha256:def456..."},
    {"path": "examples/sample.pdf", "size": 89012, "hash": "sha256:ghi789..."}
  ]
}
```

Supporting files are any additional files in the skill directory. These might be reference documentation, code examples, or binary assets.

```
skill://pdf-processing/reference.md
skill://pdf-processing/examples/sample.pdf
```

## Provider Architecture

The Skills Provider uses a two-layer architecture to handle both single skills and skill directories.

### SkillProvider

`SkillProvider` handles a single skill directory. It loads the main file, parses any frontmatter, scans for supporting files, and creates the appropriate resources.

```python
from pathlib import Path

from fastmcp import FastMCP
from fastmcp.server.providers.skills import SkillProvider

mcp = FastMCP("Single Skill")
mcp.add_provider(SkillProvider(Path.home() / ".claude" / "skills" / "pdf-processing"))
```

Use `SkillProvider` when you want to expose exactly one skill, or when you need fine-grained control over individual skill configuration.

### SkillsDirectoryProvider

`SkillsDirectoryProvider` scans one or more root directories and creates a `SkillProvider` for each valid skill folder it finds. A folder is considered a valid skill if it contains the main file (default: `SKILL.md`).

```python
from pathlib import Path

from fastmcp import FastMCP
from fastmcp.server.providers.skills import SkillsDirectoryProvider

mcp = FastMCP("Skills")
mcp.add_provider(SkillsDirectoryProvider(roots=Path.home() / ".claude" / "skills"))
```

When scanning multiple root directories, provide them as a list. The first directory takes precedence if the same skill name appears in multiple roots.

```python
from pathlib import Path

from fastmcp import FastMCP
from fastmcp.server.providers.skills import SkillsDirectoryProvider

mcp = FastMCP("Skills")
mcp.add_provider(SkillsDirectoryProvider(roots=[
    Path.cwd() / ".claude" / "skills",      # Project-level skills first
    Path.home() / ".claude" / "skills",     # User-level fallback
]))
```

## Vendor Providers

FastMCP includes pre-configured providers for popular AI coding tools. Each vendor provider extends `SkillsDirectoryProvider` with the appropriate default directory for that platform.

| Provider                 | Default Directory                           |
| ------------------------ | ------------------------------------------- |
| `ClaudeSkillsProvider`   | `~/.claude/skills/`                         |
| `CursorSkillsProvider`   | `~/.cursor/skills/`                         |
| `VSCodeSkillsProvider`   | `~/.copilot/skills/`                        |
| `CodexSkillsProvider`    | `/etc/codex/skills/` and `~/.codex/skills/` |
| `GeminiSkillsProvider`   | `~/.gemini/skills/`                         |
| `GooseSkillsProvider`    | `~/.config/agents/skills/`                  |
| `CopilotSkillsProvider`  | `~/.copilot/skills/`                        |
| `OpenCodeSkillsProvider` | `~/.config/opencode/skills/`                |

Vendor providers accept the same configuration options as `SkillsDirectoryProvider` (except for `roots`, which is locked to the platform default).

```python
from fastmcp import FastMCP
from fastmcp.server.providers.skills import ClaudeSkillsProvider

mcp = FastMCP("Claude Skills")
mcp.add_provider(ClaudeSkillsProvider())  # Uses ~/.claude/skills/
```

`CodexSkillsProvider` scans both system-level (`/etc/codex/skills/`) and user-level (`~/.codex/skills/`) directories, with system skills taking precedence.

## Supporting Files Disclosure

The `supporting_files` parameter controls how supporting files (everything except the main file and manifest) appear to clients.

### Template Mode (Default)

With `supporting_files="template"`, supporting files are accessed through a `ResourceTemplate` rather than being listed as individual resources. Clients see only the main file and manifest in `list_resources()`, then discover supporting files by reading the manifest.

```python
from pathlib import Path

from fastmcp.server.providers.skills import SkillsDirectoryProvider

# Default behavior - supporting files hidden from list_resources()
provider = SkillsDirectoryProvider(
    roots=Path.home() / ".claude" / "skills",
    supporting_files="template",  # This is the default
)
```

This keeps the resource list compact when skills contain many files. Clients that need supporting files read the manifest first, then request specific files by URI.

### Resources Mode

With `supporting_files="resources"`, every file in every skill appears as an individual resource in `list_resources()`. Clients get full enumeration upfront without needing to read manifests.

```python
from pathlib import Path

from fastmcp.server.providers.skills import SkillsDirectoryProvider

# All files visible as individual resources
provider = SkillsDirectoryProvider(
    roots=Path.home() / ".claude" / "skills",
    supporting_files="resources",
)
```

Use this mode when clients need to discover all available files without additional round trips, or when integrating with tools that expect flat resource lists.

## Reload Mode

Enable reload mode to re-scan the skills directory on every request. Changes to skills take effect immediately without restarting the server.

```python
from pathlib import Path

from fastmcp.server.providers.skills import SkillsDirectoryProvider

provider = SkillsDirectoryProvider(
    roots=Path.home() / ".claude" / "skills",
    reload=True,
)
```

With `reload=True`, the provider re-discovers skills on each `list_resources()` or `read_resource()` call. New skills appear, removed skills disappear, and modified content reflects current file state.

> **Warning:** Reload mode adds overhead to every request. Use it during development when you're actively editing skills, but disable it in production.


## Client Utilities

FastMCP provides utilities for downloading skills from any MCP server that exposes them. These are standalone functions in `fastmcp.utilities.skills`.

### Discovering Skills

Use `list_skills()` to see what skills are available on a server.

```python
from fastmcp import Client
from fastmcp.utilities.skills import list_skills

async with Client("http://skills-server/mcp") as client:
    skills = await list_skills(client)
    for skill in skills:
        print(f"{skill.name}: {skill.description}")
```

### Downloading Skills

Use `download_skill()` to download a single skill, or `sync_skills()` to download all available skills.

```python
from pathlib import Path

from fastmcp import Client
from fastmcp.utilities.skills import download_skill, sync_skills

async with Client("http://skills-server/mcp") as client:
    # Download one skill
    path = await download_skill(client, "pdf-processing", Path.home() / ".claude" / "skills")

    # Or download all skills
    paths = await sync_skills(client, Path.home() / ".claude" / "skills")
```

Both functions accept an `overwrite` parameter. When `False` (default), existing skills are skipped. When `True`, existing files are replaced.

### Inspecting Manifests

Use `get_skill_manifest()` to see what files a skill contains before downloading.

```python
from fastmcp import Client
from fastmcp.utilities.skills import get_skill_manifest

async with Client("http://skills-server/mcp") as client:
    manifest = await get_skill_manifest(client, "pdf-processing")
    for file in manifest.files:
        print(f"{file.path} ({file.size} bytes, {file.hash})")
```

> ## Documentation Index
> Fetch the complete documentation index at: https://gofastmcp.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Custom Providers
