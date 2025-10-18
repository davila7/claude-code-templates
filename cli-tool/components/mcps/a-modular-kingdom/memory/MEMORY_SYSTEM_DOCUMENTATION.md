# Memory System Documentation

The memory system provides persistent storage and retrieval of information using ChromaDB and intelligent fact processing through LLM-based decision making.

## Architecture

### Core Components

**`core.py`** - Contains the `Mem0` class that handles all memory operations:
- ChromaDB integration for vector storage
- LLM-based fact processing and deduplication
- Semantic search and retrieval
- Memory management (add, update, delete, search)

### Key Features

1. **Intelligent Fact Processing**
   - Uses LLM to decide whether to ADD new memories or UPDATE existing ones
   - Prevents duplicate storage through similarity analysis
   - Automatic fact extraction and refinement

2. **Vector Storage**
   - ChromaDB backend for semantic similarity search
   - Persistent storage in configurable directory
   - UUID-based memory identification

3. **LLM Integration**
   - Uses `qwen3:8b` model for memory processing decisions
   - Contextual understanding of fact relationships
   - Smart memory consolidation

## API Reference

### `Mem0` Class

```python
Mem0(chroma_path: str)
```

**Methods:**

- `add(fact: str)` - Add new information to memory with intelligent processing
- `search(query: str, k: int = 3)` - Search memories by semantic similarity
- `get_all_memories()` - Retrieve all stored memories
- `delete_memory(memory_id: str)` - Remove specific memory by ID

### Internal Methods

- `_decide_memory_operation(fact, similar_memories)` - LLM-based decision on ADD vs UPDATE
- `_execute_operation(operation, fact, memory_id)` - Execute database operations
- `_get_client_and_collection()` - ChromaDB client management

## Configuration

- **LLM Model**: `qwen3:8b` (configurable via `LLM_MODEL`)
- **Collection Name**: `agent_memories`
- **Storage**: ChromaDB persistent client
- **Search Results**: Default top-k = 3

## Usage Examples

```python
from memory.core import Mem0

# Initialize memory system
memory = Mem0(chroma_path="./memory_db")

# Add information
memory.add("The user prefers Python over JavaScript")

# Search for related information
results = memory.search("programming languages", k=5)

# Get all memories
all_memories = memory.get_all_memories()

# Delete specific memory
memory.delete_memory("uuid-string-here")
```

## Integration

The memory system integrates with the agent through MCP tools:
- `save_memory` - Direct memory storage
- `save_fact` - Intelligent fact processing
- `search_memories` - Semantic search
- `list_all_memories` - Memory management
- `delete_memory` - Memory cleanup

## Storage Location

Memories are stored in the configured ChromaDB path (typically `agent_chroma_db/`) with the collection name `agent_memories`.