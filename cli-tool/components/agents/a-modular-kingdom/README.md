# Agent Module

A unified MCP-based agent system that provides access to memory, knowledge base (RAG), and web search capabilities through the Model Context Protocol.

## Architecture

The agent uses a client-server architecture where `main.py` (client) communicates with `host.py` (MCP server) to access various tools and resources.

### `host.py` - MCP Server

**Purpose**: Hosts all agent capabilities as MCP tools and resources.

**Key Components**:
- **Memory System**: Mem0-based persistent memory with ChromaDB
- **RAG System**: Document knowledge base using advanced retrieval (V3)
- **Web Search**: DuckDuckGo or Google Search API integration 
- **Document Resources**: File access via @ mentions

**MCP Tools**:
- `save_memory` - Save content directly to memory system
- `save_fact` - Save structured facts with automatic processing
- `search_memories` - Semantic search through saved memories
- `delete_memory` - Remove specific memories by ID
- `list_all_memories` - View all stored memories
- `query_knowledge_base` - Search documents using RAG system
- `web_search` - Perform web searches for current information

**MCP Resources**:
- `docs://documents` - List available documents for @ mentions
- `docs://documents/{doc_id}` - Access specific document content

### `main.py` - MCP Client

**Purpose**: Interactive chat interface with intelligent tool selection.

**Key Features**:
- **Auto-completion**: @ mentions for documents, / commands
- **Memory Management**: Direct memory saving with # prefix
- **Tool Selection**: Automatic choice between memory, RAG, and web search
- **Document Integration**: @ mentions automatically fetch document content
- **Command Interface**: /memory, /tools, /files, /help commands

**Workflow**:
1. Process @ mentions to fetch document content
2. Search internal memories for relevant context
3. Decide on external tool usage (RAG vs web search)
4. Synthesize response with all available context
5. Optionally save important information to memory

## Usage

```bash
# Start the agent
python agent/main.py
uv run agent/main.py
# Commands
#message          - Save directly to memory
@filename        - Reference documents
/memory          - Manage memories. 
/tools           - List available tools
/files           - Show available documents
/help            - Show help information
```

## Configuration

- **LLM Model**: `qwen3:8b` (configurable in main.py)
- **Memory Storage**: `agent_chroma_db/`
- **Documents**: `rag/files/`
- **Knowledge Base**: Configurable to use all three versions.