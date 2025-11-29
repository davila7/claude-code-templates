# Gemini CLI Built-in Tools

Reference for Gemini's built-in tools and their capabilities.

## Unique Tools (Not in Claude Code)

These tools are available only through Gemini CLI:

### google_web_search

Performs web search using Google Search API.

**Capabilities:**
- Real-time internet search
- Current information (news, releases, docs)
- Grounded responses with sources

**Usage:**
```bash
gemini "What are the latest React 19 features? Use Google Search." -o text
```

**Best For:**
- Current events and news
- Latest library versions
- Recent documentation updates
- Community opinions and benchmarks

**Example Queries:**
- "What are the security vulnerabilities in lodash 4.x? Use Google Search."
- "What's new in TypeScript 5.4? Use Google Search."
- "Best practices for Next.js 14 app router in November 2025."

---

### codebase_investigator

Specialized tool for deep codebase analysis.

**Capabilities:**
- Architectural mapping
- Dependency analysis
- Cross-file relationship detection
- System-wide pattern identification

**Usage:**
```bash
gemini "Use the codebase_investigator tool to analyze this project" -o text
```

**Output Includes:**
- Overall architecture description
- Key file purposes
- Component relationships
- Dependency chains
- Potential issues/inconsistencies

**Best For:**
- Onboarding to new codebases
- Understanding legacy systems
- Finding hidden dependencies
- Architecture documentation

**Example:**
```bash
gemini "Use codebase_investigator to map the authentication flow in this project" -o text
```

---

### save_memory

Saves information to persistent long-term memory.

**Capabilities:**
- Cross-session persistence
- Key-value storage
- Recall in future sessions

**Usage:**
```bash
gemini "Remember that this project uses Zustand for state management. Save this to memory." -o text
```

**Best For:**
- Project conventions
- User preferences
- Recurring context
- Custom instructions

---

## Standard Tools

These tools are similar to Claude Code's capabilities:

### list_directory

Lists files and subdirectories in a path.

**Parameters:**
- `path`: Directory to list
- `ignore`: Glob patterns to exclude

**Example Output:**
```
src/
  components/
  utils/
  index.js
package.json
README.md
```

---

### read_file

Reads file content with truncation for large files.

**Supported Formats:**
- Text files (all types)
- Images (PNG, JPG, GIF, WEBP, SVG, BMP)
- PDF documents

**Parameters:**
- `path`: File path
- `offset`: Starting line (for large files)
- `limit`: Number of lines

**Large File Handling:**
If file exceeds limit, output indicates truncation and provides instructions for reading more with offset/limit.

---

### search_file_content

Fast content search powered by ripgrep.

**Advantages over grep:**
- Optimized performance
- Automatic output limiting (max 20k matches)
- Better pattern matching

**Parameters:**
- `pattern`: Regex pattern
- `path`: Search root
- Various ripgrep flags

---

### glob

Pattern-based file finding.

**Returns:**
- Absolute paths
- Sorted by modification time (newest first)

**Example Patterns:**
- `src/**/*.ts` - All TypeScript files in src
- `**/*.test.js` - All test files
- `**/README.md` - All READMEs

---

### web_fetch

Fetches content from URLs.

**Capabilities:**
- HTTP/HTTPS URLs
- Local addresses (localhost)
- Up to 20 URLs per request

**Usage:**
```bash
gemini "Fetch and summarize https://example.com/docs" -o text
```

---

### write_todos

Internal task tracking.

**Capabilities:**
- Track subtasks for complex requests
- Organize multi-step work
- Prevent missed steps

**Automatic Usage:**
Gemini uses this internally for complex tasks.

---

## Tool Invocation

### Automatic Tool Selection

Gemini automatically selects appropriate tools based on the prompt:

| Prompt Type | Tool Selected |
|-------------|---------------|
| "What files are in src/" | list_directory |
| "Find all TODO comments" | search_file_content |
| "Read package.json" | read_file |
| "Find all React components" | glob |
| "What's new in Vue 4?" | google_web_search |
| "Analyze this codebase" | codebase_investigator |

### Explicit Tool Requests

You can explicitly request tools:

```bash
gemini "Use the codebase_investigator tool to..." -o text
gemini "Search the web for..." -o text
gemini "Use glob to find all..." -o text
```

---

## Tool Statistics in JSON Output

When using `-o json`, tool usage is reported:

```json
{
  "stats": {
    "tools": {
      "totalCalls": 3,
      "totalSuccess": 3,
      "totalFail": 0,
      "totalDurationMs": 5000,
      "totalDecisions": {
        "accept": 0,
        "reject": 0,
        "modify": 0,
        "auto_accept": 3
      },
      "byName": {
        "google_web_search": {
          "count": 1,
          "success": 1,
          "fail": 0,
          "durationMs": 3000,
          "decisions": {
            "auto_accept": 1
          }
        },
        "read_file": {
          "count": 2,
          "success": 2,
          "fail": 0,
          "durationMs": 2000,
          "decisions": {
            "auto_accept": 2
          }
        }
      }
    }
  }
}
```

---

## Comparison with Claude Code Tools

| Capability | Claude Code | Gemini CLI |
|------------|-------------|------------|
| File listing | LS, Glob | list_directory, glob |
| File reading | Read | read_file |
| File writing | Write, Edit | write_file (in YOLO) |
| Code search | Grep | search_file_content |
| Web fetch | WebFetch | web_fetch |
| Web search | WebSearch | **google_web_search** |
| Architecture | Task (Explore) | **codebase_investigator** |
| Memory | N/A | **save_memory** |
| Task tracking | TodoWrite | write_todos |

**Bold** = Gemini's unique advantage

---

## Tool Restrictions

### Using allowed-tools

In settings or command line, restrict available tools:

```bash
gemini --allowed-tools "read_file,glob" "Find config files" -o text
```

### In Settings
```json
{
  "security": {
    "allowedTools": ["read_file", "list_directory", "glob"]
  }
}
```

---

## Best Practices

### When to Use Specific Tools

**google_web_search:**
- Need current/recent information
- Checking latest versions
- Finding documentation updates
- Community solutions to problems

**codebase_investigator:**
- New to a codebase
- Understanding complex systems
- Finding hidden dependencies
- Creating documentation

**save_memory:**
- Recurring project context
- User preferences
- Custom conventions

### Tool Combination Patterns

**Research → Implement:**
```bash
gemini "Use Google Search to find best practices for [topic], then implement them" --yolo -o text
```

**Analyze → Report:**
```bash
gemini "Use codebase_investigator to analyze the project, then write a summary report" --yolo -o text
```

**Search → Read → Modify:**
```bash
gemini "Find all files using deprecated API, read them, and suggest updates" -o text
```
