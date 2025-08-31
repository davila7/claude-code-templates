# Claude Code Data Structure Documentation

## Overview
This document provides comprehensive information about the data structures and formats found in the `.claude` directory, used by Claude Code and the Analytics Dashboard.

## Directory Structure

```
~/.claude/
├── projects/                    # Project-specific conversations
│   ├── -Users-user-Project1/
│   │   ├── conversation.jsonl   # Main conversation file
│   │   └── settings.json        # Project settings
│   └── -Users-user-Project2/
│       └── conversation.jsonl
├── desktop/                     # Claude Desktop app data
├── statsig/                     # Analytics and feature flags
│   ├── logs/
│   └── user_overrides.json
└── settings.json               # Global Claude Code settings
```

## JSONL Conversation Format

### File Structure
Each conversation is stored in a JSONL (JSON Lines) file where each line represents a single message or event.

### Message Types

#### 1. User Messages
```json
{
  "parentUuid": "previous-message-uuid",
  "isSidechain": false,
  "userType": "external",
  "cwd": "/Users/user/project-path",
  "sessionId": "ae93d7b5-1c54-4578-b208-603b48a88c5e",
  "version": "1.0.35",
  "type": "user",
  "message": {
    "role": "user",
    "content": "User's message text here"
  },
  "uuid": "6a8f4604-6fdd-406f-87d6-436e6cf26bd1",
  "timestamp": "2025-07-01T19:06:05.237Z"
}
```

#### 2. Assistant Messages
```json
{
  "parentUuid": "6a8f4604-6fdd-406f-87d6-436e6cf26bd1",
  "isSidechain": false,
  "userType": "external",
  "cwd": "/Users/user/project-path",
  "sessionId": "ae93d7b5-1c54-4578-b208-603b48a88c5e",
  "version": "1.0.35",
  "message": {
    "id": "msg_016xDLMzLsNRmD5PsdEjPu3N",
    "type": "message",
    "role": "assistant",
    "model": "claude-sonnet-4-20250514",
    "content": [
      {
        "type": "text",
        "text": "Assistant's response text"
      }
    ],
    "stop_reason": null,
    "stop_sequence": null,
    "usage": {
      "input_tokens": 4,
      "cache_creation_input_tokens": 15116,
      "cache_read_input_tokens": 0,
      "output_tokens": 1,
      "service_tier": "standard"
    }
  },
  "requestId": "req_011CQgpcgetL2WTXxNz8FxVs",
  "type": "assistant",
  "uuid": "2f7d6c65-27a6-40b4-aa52-0fb8cad8f9a6",
  "timestamp": "2025-07-01T19:06:09.724Z"
}
```

#### 3. Tool Use Messages
```json
{
  "message": {
    "role": "assistant",
    "content": [
      {
        "type": "text",
        "text": "I'll help you with that task."
      },
      {
        "type": "tool_use",
        "id": "toolu_01A2B3C4D5E6F7G8H9I0J1K2",
        "name": "bash",
        "input": {
          "command": "ls -la"
        }
      }
    ]
  }
}
```

#### 4. Tool Result Messages
```json
{
  "message": {
    "role": "user",
    "content": [
      {
        "type": "tool_result",
        "tool_use_id": "toolu_01A2B3C4D5E6F7G8H9I0J1K2",
        "content": "drwxr-xr-x  5 user  staff   160 Jul 20 10:30 .\ndrwxr-xr-x  8 user  staff   256 Jul 20 10:29 .."
      }
    ]
  }
}
```

## Field Definitions

### Root Level Fields
| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `uuid` | String | Unique identifier for this message | `"6a8f4604-6fdd-406f-87d6-436e6cf26bd1"` |
| `parentUuid` | String/null | UUID of the previous message in conversation | `"previous-uuid"` or `null` |
| `timestamp` | ISO String | When the message was created | `"2025-07-01T19:06:05.237Z"` |
| `type` | String | Message type: `"user"` or `"assistant"` | `"user"` |
| `sessionId` | String | Session identifier for the conversation | `"ae93d7b5-1c54-4578-b208-603b48a88c5e"` |
| `version` | String | Claude Code version that created this message | `"1.0.35"` |
| `cwd` | String | Current working directory when message was sent | `"/Users/user/project"` |
| `userType` | String | Type of user: `"external"` (CLI) or other | `"external"` |
| `isSidechain` | Boolean | Whether this is a sidechain conversation | `false` |
| `requestId` | String | API request ID (assistant messages only) | `"req_011CQgpcgetL2WTXxNz8FxVs"` |

### Message Object Fields
| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `role` | String | `"user"` or `"assistant"` | `"assistant"` |
| `id` | String | Message ID (assistant messages only) | `"msg_016xDLMzLsNRmD5PsdEjPu3N"` |
| `type` | String | Always `"message"` for assistant messages | `"message"` |
| `model` | String | AI model used (assistant messages only) | `"claude-sonnet-4-20250514"` |
| `content` | String/Array | Message content (string for user, array for assistant) | See content formats below |
| `stop_reason` | String/null | Why the assistant stopped generating | `null`, `"end_turn"`, `"max_tokens"` |
| `stop_sequence` | String/null | Stop sequence that triggered end | `null` |
| `usage` | Object | Token usage information | See usage object below |

### Content Formats

#### User Content (String)
```json
"content": "Simple text message from user"
```

#### Assistant Content (Array of Blocks)
```json
"content": [
  {
    "type": "text",
    "text": "Text response from assistant"
  },
  {
    "type": "tool_use",
    "id": "toolu_01A2B3C4D5E6F7G8H9I0J1K2",
    "name": "bash",
    "input": {
      "command": "ls -la",
      "description": "List directory contents"
    }
  }
]
```

#### Tool Result Content (Array)
```json
"content": [
  {
    "type": "tool_result",
    "tool_use_id": "toolu_01A2B3C4D5E6F7G8H9I0J1K2",
    "content": "Command output here...",
    "is_error": false
  }
]
```

### Usage Object (Token Information)
```json
"usage": {
  "input_tokens": 156,                    // Tokens in the input
  "output_tokens": 45,                    // Tokens in the output
  "cache_creation_input_tokens": 2048,    // Tokens used to create cache
  "cache_read_input_tokens": 1024,        // Tokens read from cache
  "service_tier": "standard"              // Service tier: "standard" or "premium"
}
```

## Tool Types and Input Formats

### Available Tools
1. **bash** - Execute shell commands
2. **read** - Read file contents
3. **write** - Write/create files
4. **edit** - Edit existing files
5. **glob** - File pattern matching
6. **grep** - Search within files
7. **ls** - List directory contents

### Tool Input Examples

#### Bash Tool
```json
{
  "type": "tool_use",
  "name": "bash",
  "input": {
    "command": "npm install --save express",
    "description": "Install Express.js package"
  }
}
```

#### Read Tool
```json
{
  "type": "tool_use",
  "name": "read",
  "input": {
    "file_path": "/path/to/file.js",
    "limit": 100,
    "offset": 0
  }
}
```

#### Write Tool
```json
{
  "type": "tool_use",
  "name": "write",
  "input": {
    "file_path": "/path/to/new-file.js",
    "content": "console.log('Hello World');"
  }
}
```

#### Edit Tool
```json
{
  "type": "tool_use",
  "name": "edit",
  "input": {
    "file_path": "/path/to/file.js",
    "old_string": "const oldCode = 'old';",
    "new_string": "const newCode = 'new';",
    "replace_all": false
  }
}
```

## Settings Files

## Message Flow and Relationships

### Conversation Threading
Messages are linked through `parentUuid` fields:
```
Message 1 (uuid: A, parentUuid: null)          # First message
├── Message 2 (uuid: B, parentUuid: A)         # Response to Message 1
    ├── Message 3 (uuid: C, parentUuid: B)     # Response to Message 2
    └── Message 4 (uuid: D, parentUuid: B)     # Alternative response
```

### Tool Use Flow
```
User Message → Assistant with Tool Use → Tool Result → Assistant Response
     ↓                    ↓                    ↓               ↓
   uuid: A             uuid: B              uuid: C        uuid: D
parentUuid: null    parentUuid: A        parentUuid: B   parentUuid: C
```

## Analytics Data Extraction

### Extractable Metrics
1. **Conversation Metrics**
   - Total messages per conversation
   - Message frequency over time
   - User vs Assistant message ratio
   - Tool usage patterns

2. **Token Usage**
   - Input/Output token consumption
   - Cache hit rates
   - Model usage patterns
   - Cost analysis

3. **Tool Analytics**
   - Most used tools
   - Tool success/error rates
   - Tool execution time (estimated)
   - File operation patterns

4. **Project Analytics**
   - Active projects
   - Project-specific usage patterns
   - File types being worked on
   - Development patterns

## Common Patterns and Edge Cases

### User Confirmation Messages
User responses to Claude's prompts often appear as simple strings:
```json
{
  "message": {
    "role": "user",
    "content": "[ok]"  // or "yes", "1", "y", etc.
  }
}
```

### Large Tool Results
Long command outputs are stored as complete strings:
```json
{
  "type": "tool_result",
  "content": "Very long output that could be thousands of characters..."
}
```

### Error Messages
Tool errors are marked with `is_error: true`:
```json
{
  "type": "tool_result",
  "tool_use_id": "toolu_xxx",
  "content": "bash: command not found: invalidcommand",
  "is_error": true
}
```

## Data Processing Notes

### Performance Considerations
1. **File Sizes**: JSONL files can become large (100MB+) for long conversations
2. **Parsing**: Each line must be parsed individually as valid JSON
3. **Memory**: Large conversations should be streamed or paginated
4. **Caching**: Parsed conversations should be cached to avoid re-parsing

### Data Validation
1. **Required Fields**: Always check for required fields before processing
2. **Timestamps**: Parse ISO strings carefully, handle timezone differences
3. **Content Arrays**: Assistant messages may have mixed content types
4. **UUIDs**: Validate UUID format for consistency checks

## Usage in Analytics Dashboard

### Current Implementation
The analytics dashboard extracts the following data:
```javascript
// Simplified message object after parsing
{
  id: item.message.id || item.uuid,           // Message identifier
  role: item.message.role,                    // "user" or "assistant"
  timestamp: new Date(item.timestamp),        // Parsed timestamp
  content: item.message.content,              // Raw content
  model: item.message.model || null,          // AI model used
  usage: item.message.usage || null,          // Token usage
}
```

### Available Extensions
With this data structure, the dashboard could be extended to show:
- Conversation threading/branching
- Tool usage analytics
- Project-specific insights
- Cost tracking per project
- Development velocity metrics
- Error rate analysis

## File System Integration

### Directory Monitoring
Watch for changes in:
- `~/.claude/projects/*/conversation.jsonl` - New messages
- `~/.claude/projects/` - New projects
- `~/.claude/settings.json` - Setting changes

### File Reading Strategies
1. **Tail Reading**: Read only new lines from JSONL files
2. **Full Parse**: Parse entire file for complete analysis
3. **Chunk Processing**: Process large files in smaller chunks
4. **Incremental Updates**: Track file modification times

This documentation provides a complete reference for working with Claude Code data structures and can be updated as new formats or features are discovered.