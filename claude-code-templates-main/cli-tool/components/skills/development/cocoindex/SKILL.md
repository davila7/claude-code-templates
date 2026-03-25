---
name: cocoindex
description: Comprehensive toolkit for developing with the CocoIndex library. Use when users need to create data transformation pipelines (flows), write custom functions, or operate flows via CLI or API. Covers building ETL workflows for AI data processing, including embedding documents into vector databases, building knowledge graphs, creating search indexes, or processing data streams with incremental updates.
---

# CocoIndex

## Overview

CocoIndex is an ultra-performant real-time data transformation framework for AI with incremental processing. This skill enables building **indexing flows** that extract data from sources, apply transformations (chunking, embedding, LLM extraction), and export to targets (vector databases, graph databases, relational databases).

**Core capabilities:**

1. **Write indexing flows** - Define ETL pipelines using Python
2. **Create custom functions** - Build reusable transformation logic
3. **Operate flows** - Run and manage flows using CLI or Python API

**Key features:**

- Incremental processing (only processes changed data)
- Live updates (continuously sync source changes to targets)
- Built-in functions (text chunking, embeddings, LLM extraction)
- Multiple data sources (local files, S3, Azure Blob, Google Drive, Postgres)
- Multiple targets (Postgres+pgvector, Qdrant, LanceDB, Neo4j, Kuzu)

**For detailed documentation:** <https://cocoindex.io/docs/>
**Search documentation:** <https://cocoindex.io/docs/search?q=url%20encoded%20keyword>

## When to Use This Skill

Use when users request:

- "Build a vector search index for my documents"
- "Create an embedding pipeline for code/PDFs/images"
- "Extract structured information using LLMs"
- "Build a knowledge graph from documents"
- "Set up live document indexing"
- "Create custom transformation functions"
- "Run/update my CocoIndex flow"

## Flow Writing Workflow

### Step 1: Understand Requirements

Ask clarifying questions to understand:

**Data source:**

- Where is the data? (local files, S3, database, etc.)
- What file types? (text, PDF, JSON, images, code, etc.)
- How often does it change? (one-time, periodic, continuous)

**Transformations:**

- What processing is needed? (chunking, embedding, extraction, etc.)
- Which embedding model? (SentenceTransformer, OpenAI, custom)
- Any custom logic? (filtering, parsing, enrichment)

**Target:**

- Where should results go? (Postgres, Qdrant, Neo4j, etc.)
- What schema? (fields, primary keys, indexes)
- Vector search needed? (specify similarity metric)

### Step 2: Set Up Dependencies

Guide user to add CocoIndex with appropriate extras to their project based on their needs:

**Required dependency:**

- `cocoindex` - Core functionality, CLI, and most built-in functions

**Optional extras (add as needed):**

- `cocoindex[embeddings]` - For SentenceTransformer embeddings (when using `SentenceTransformerEmbed`)
- `cocoindex[colpali]` - For ColPali image/document embeddings (when using `ColPaliEmbedImage` or `ColPaliEmbedQuery`)
- `cocoindex[lancedb]` - For LanceDB target (when exporting to LanceDB)
- `cocoindex[embeddings,lancedb]` - Multiple extras can be combined

**What's included:**

- Base package: Core functionality, CLI, most built-in functions, Postgres/Qdrant/Neo4j/Kuzu targets
- `embeddings` extra: SentenceTransformers library for local embedding models
- `colpali` extra: ColPali engine for multimodal document/image embeddings
- `lancedb` extra: LanceDB client library for LanceDB vector database support

Users can install using their preferred package manager (pip, uv, poetry, etc.) or add to `pyproject.toml`.

**For installation details:** <https://cocoindex.io/docs/getting_started/installation>

### Step 3: Set Up Environment

**Check existing environment first:**

1. Check if `COCOINDEX_DATABASE_URL` exists in environment variables
   - If not found, use default: `postgres://cocoindex:cocoindex@localhost/cocoindex`

2. **For flows requiring LLM APIs** (embeddings, extraction):
   - Ask user which LLM provider they want to use:
     - **OpenAI** - Both generation and embeddings
     - **Anthropic** - Generation only
     - **Gemini** - Both generation and embeddings
     - **Voyage** - Embeddings only
     - **Ollama** - Local models (generation and embeddings)
   - Check if the corresponding API key exists in environment variables
   - If not found, **ask user to provide the API key value**
   - **Never create simplified examples without LLM** - always get the proper API key and use the real LLM functions

**Guide user to create `.env` file:**

```bash
# Database connection (required - internal storage)
COCOINDEX_DATABASE_URL=postgres://cocoindex:cocoindex@localhost/cocoindex

# LLM API keys (add the ones you need)
OPENAI_API_KEY=sk-...          # For OpenAI (generation + embeddings)
ANTHROPIC_API_KEY=sk-ant-...   # For Anthropic (generation only)
GOOGLE_API_KEY=...             # For Gemini (generation + embeddings)
VOYAGE_API_KEY=pa-...          # For Voyage (embeddings only)
# Ollama requires no API key (local)
```

**For more LLM options:** <https://cocoindex.io/docs/ai/llm>

Create basic project structure:

```python
# main.py
from dotenv import load_dotenv
import cocoindex

@cocoindex.flow_def(name="FlowName")
def my_flow(flow_builder: cocoindex.FlowBuilder, data_scope: cocoindex.DataScope):
    # Flow definition here
    pass

if __name__ == "__main__":
    load_dotenv()
    cocoindex.init()
    my_flow.update()
```

### Step 4: Write the Flow

Follow this structure:

```python
@cocoindex.flow_def(name="DescriptiveName")
def flow_name(flow_builder: cocoindex.FlowBuilder, data_scope: cocoindex.DataScope):
    # 1. Import source data
    data_scope["source_name"] = flow_builder.add_source(
        cocoindex.sources.SourceType(...)
    )

    # 2. Create collector(s) for outputs
    collector = data_scope.add_collector()

    # 3. Transform data (iterate through rows)
    with data_scope["source_name"].row() as item:
        # Apply transformations
        item["new_field"] = item["existing_field"].transform(
            cocoindex.functions.FunctionName(...)
        )

        ...

        # Nested iteration (e.g., chunks within documents)
        with item["nested_table"].row() as nested_item:
            # More transformations
            nested_item["embedding"] = nested_item["text"].transform(...)

            # Collect data for export
            collector.collect(
                field1=nested_item["field1"],
                field2=item["field2"],
                generated_id=cocoindex.GeneratedField.UUID
            )

    # 4. Export to target
    collector.export(
        "target_name",
        cocoindex.targets.TargetType(...),
        primary_key_fields=["field1"],
        vector_indexes=[...]  # If needed
    )
```

**Key principles:**

- Each source creates a field in the top-level data scope
- Use `.row()` to iterate through table data
- **CRITICAL: Always assign transformed data to row fields** - Use `item["new_field"] = item["existing_field"].transform(...)`, NOT local variables like `new_field = item["existing_field"].transform(...)`
- Transformations create new fields without mutating existing data
- Collectors gather data from any scope level
- Export must happen at top level (not within row iterations)

**Common mistakes to avoid:**

❌ **Wrong:** Using local variables for transformations

```python
with data_scope["files"].row() as file:
    summary = file["content"].transform(...)  # ❌ Local variable
    summaries_collector.collect(filename=file["filename"], summary=summary)
```

✅ **Correct:** Assigning to row fields

```python
with data_scope["files"].row() as file:
    file["summary"] = file["content"].transform(...)  # ✅ Field assignment
    summaries_collector.collect(filename=file["filename"], summary=file["summary"])
```

❌ **Wrong:** Creating unnecessary dataclasses to mirror flow fields

```python
from dataclasses import dataclass

@dataclass
class FileSummary:  # ❌ Unnecessary - CocoIndex manages fields automatically
    filename: str
    summary: str
    embedding: list[float]

# This dataclass is never used in the flow!
```

### Step 5: Design the Flow Solution

**IMPORTANT:** The patterns listed below are common starting points, but **you cannot exhaustively enumerate all possible scenarios**. When user requirements don't match existing patterns:

1. **Combine elements from multiple patterns** - Mix and match sources, transformations, and targets creatively
2. **Review additional examples** - See <https://github.com/cocoindex-io/cocoindex?tab=readme-ov-file#-examples-and-demo> for diverse real-world use cases (face recognition, multimodal search, product recommendations, patient form extraction, etc.)
3. **Think from first principles** - Use the core APIs (sources, transforms, collectors, exports) and apply common sense to solve novel problems
4. **Be creative** - CocoIndex is flexible; unique combinations of components can solve unique problems

**Common starting patterns (use references for detailed examples):**

**For text embedding:** Load `references/flow_patterns.md` and refer to "Pattern 1: Simple Text Embedding"

**For code embedding:** Load `references/flow_patterns.md` and refer to "Pattern 2: Code Embedding with Language Detection"

**For LLM extraction + knowledge graph:** Load `references/flow_patterns.md` and refer to "Pattern 3: LLM-based Extraction to Knowledge Graph"

**For live updates:** Load `references/flow_patterns.md` and refer to "Pattern 4: Live Updates with Refresh Interval"

**For custom functions:** Load `references/flow_patterns.md` and refer to "Pattern 5: Custom Transform Function"

**For reusable query logic:** Load `references/flow_patterns.md` and refer to "Pattern 6: Transform Flow for Reusable Logic"

**For concurrency control:** Load `references/flow_patterns.md` and refer to "Pattern 7: Concurrency Control"

**Example of pattern composition:**

If a user asks to "index images from S3, generate captions with a vision API, and store in Qdrant", combine:

- AmazonS3 source (from S3 examples)
- Custom function for vision API calls (from custom functions pattern)
- EmbedText to embed the captions (from embedding patterns)
- Qdrant target (from target examples)

No single pattern covers this exact scenario, but the building blocks are composable.

### Step 6: Test and Run

Guide user through testing:

```bash
# 1. Run with setup
cocoindex update --setup -f main   # -f force setup without confirmation prompts


# 2. Start a server and redirect users to CocoInsight
cocoindex server -ci main
# Then open CocoInsight at https://cocoindex.io/cocoinsight

```

## Data Types

CocoIndex has a type system independent of programming languages. All data types are determined at flow definition time, making schemas clear and predictable.

**IMPORTANT: When to define types:**

- **Custom functions**: Type annotations are **required** for return values (these are the source of truth for type inference)
- **Flow fields**: Type annotations are **NOT needed** - CocoIndex automatically infers types from sources, functions, and transformations
- **Dataclasses/Pydantic models**: Only create them when they're **actually used** (as function parameters/returns or ExtractByLlm output_type), NOT to mirror flow field schemas

**Type annotation requirements:**

- **Return values of custom functions**: Must use **specific type annotations** - these are the source of truth for type inference
- **Arguments of custom functions**: Relaxed - can use `Any`, `dict[str, Any]`, or omit annotations; engine already knows the types
- **Flow definitions**: No explicit type annotations needed - CocoIndex automatically infers types from sources and functions

**Why specific return types matter:** Custom function return types let CocoIndex infer field types throughout the flow without processing real data. This enables creating proper target schemas (e.g., vector indexes with fixed dimensions).

**Common type categories:**

1. **Primitive types**: `str`, `int`, `float`, `bool`, `bytes`, `datetime.date`, `datetime.datetime`, `uuid.UUID`

2. **Vector types** (embeddings): Specify dimension in return type if you plan to export as vectors to targets, as most targets require a fixed vector dimension
   - `cocoindex.Vector[cocoindex.Float32, typing.Literal[768]]` - 768-dim float32 vector (recommended)
   - `list[float]` without dimension also works

3. **Struct types**: Dataclass, NamedTuple, or Pydantic model
   - Return type: Must use specific class (e.g., `Person`)
   - Argument: Can use `dict[str, Any]` or `Any`

4. **Table types**:
   - **KTable** (keyed): `dict[K, V]` where K = key type (primitive or frozen struct), V = Struct type
   - **LTable** (ordered): `list[R]` where R = Struct type
   - Arguments: Can use `dict[Any, Any]` or `list[Any]`

5. **Json type**: `cocoindex.Json` for unstructured/dynamic data

6. **Optional types**: `T | None` for nullable values

**Examples:**

```python
from dataclasses import dataclass
from typing import Literal
import cocoindex

@dataclass
class Person:
    name: str
    age: int

# ✅ Vector with dimension (recommended for vector search)
@cocoindex.op.function(behavior_version=1)
def embed_text(text: str) -> cocoindex.Vector[cocoindex.Float32, Literal[768]]:
    """Generate 768-dim embedding - dimension needed for vector index."""
    # ... embedding logic ...
    return embedding  # numpy array or list of 768 floats

# ✅ Struct return type, relaxed argument
@cocoindex.op.function(behavior_version=1)
def process_person(person: dict[str, Any]) -> Person:
    """Argument can be dict[str, Any], return must be specific Struct."""
    return Person(name=person["name"], age=person["age"])

# ✅ LTable return type
@cocoindex.op.function(behavior_version=1)
def filter_people(people: list[Any]) -> list[Person]:
    """Return type specifies list of specific Struct."""
    return [p for p in people if p.age >= 18]

# ❌ Wrong: dict[str, str] is not a valid specific CocoIndex type
# @cocoindex.op.function(...)
# def bad_example(person: Person) -> dict[str, str]:
#     return {"name": person.name}
```

**For comprehensive data types documentation:** <https://cocoindex.io/docs/core/data_types>

## Custom Functions

When users need custom transformation logic, create custom functions.

### Decision: Standalone vs Spec+Executor

**Use standalone function when:**

- Simple transformation
- No configuration needed
- No setup/initialization required

**Use spec+executor when:**

- Needs configuration (model names, API endpoints, parameters)
- Requires setup (loading models, establishing connections)
- Complex multi-step processing

### Creating Standalone Functions

```python
@cocoindex.op.function(behavior_version=1)
def my_function(input_arg: str, optional_arg: int | None = None) -> dict:
    """
    Function description.

    Args:
        input_arg: Description
        optional_arg: Optional description
    """
    # Transformation logic
    return {"result": f"processed-{input_arg}"}
```

**Requirements:**

- Decorator: `@cocoindex.op.function()`
- Type annotations on all arguments and return value
- Optional parameters: `cache=True` for expensive ops, `behavior_version` (required with cache)

### Creating Spec+Executor Functions

```python
# 1. Define configuration spec
class MyFunction(cocoindex.op.FunctionSpec):
    """Configuration for MyFunction."""
    model_name: str
    threshold: float = 0.5

# 2. Define executor
@cocoindex.op.executor_class(cache=True, behavior_version=1)
class MyFunctionExecutor:
    spec: MyFunction  # Required: link to spec
    model = None      # Instance variables for state

    def prepare(self) -> None:
        """Optional: run once before execution."""
        # Load model, setup connections, etc.
        self.model = load_model(self.spec.model_name)

    def __call__(self, text: str) -> dict:
        """Required: execute for each data row."""
        # Use self.spec for configuration
        # Use self.model for loaded resources
        result = self.model.process(text)
        return {"result": result}
```

**When to enable cache:**

- LLM API calls
- Model inference
- External API calls
- Computationally expensive operations

**Important:** Increment `behavior_version` when function logic changes to invalidate cache.

For detailed examples and patterns, load `references/custom_functions.md`.

**For more on custom functions:** <https://cocoindex.io/docs/custom_ops/custom_functions>

## Operating Flows

### CLI Operations

**Setup flow (create resources):**

```bash
cocoindex setup main
```

**One-time update:**

```bash
cocoindex update main

# With auto-setup
cocoindex update --setup main

# Force reset everything before setup and update
cocoindex update --reset main
```

**Live update (continuous monitoring):**

```bash
cocoindex update main.py -L

# Requires refresh_interval on source or source-specific change capture
```

**Drop flow (remove all resources):**

```bash
cocoindex drop main.py
```

**Inspect flow:**

```bash
cocoindex show main.py:FlowName
```

**Test without side effects:**

```bash
cocoindex evaluate main.py:FlowName --output-dir ./test_output
```

For complete CLI reference, load `references/cli_operations.md`.

**For CLI documentation:** <https://cocoindex.io/docs/core/cli>

### API Operations

**Basic setup:**

```python
from dotenv import load_dotenv
import cocoindex

load_dotenv()
cocoindex.init()

@cocoindex.flow_def(name="MyFlow")
def my_flow(flow_builder, data_scope):
    # ... flow definition ...
    pass
```

**One-time update:**

```python
stats = my_flow.update()
print(f"Processed {stats.total_rows} rows")

# Async
stats = await my_flow.update_async()
```

**Live update:**

```python
# As context manager
with cocoindex.FlowLiveUpdater(my_flow) as updater:
    # Updater runs in background
    # Your application logic here
    pass

# Manual control
updater = cocoindex.FlowLiveUpdater(
    my_flow,
    cocoindex.FlowLiveUpdaterOptions(
        live_mode=True,
        print_stats=True
    )
)
updater.start()
# ... application logic ...
updater.wait()
```

**Setup/drop:**

```python
my_flow.setup(report_to_stdout=True)
my_flow.drop(report_to_stdout=True)
cocoindex.setup_all_flows()
cocoindex.drop_all_flows()
```

**Query with transform flows:**

```python
@cocoindex.transform_flow()
def text_to_embedding(text: cocoindex.DataSlice[str]) -> cocoindex.DataSlice[list[float]]:
    return text.transform(
        cocoindex.functions.SentenceTransformerEmbed(model="...")
    )

# Use in flow for indexing
doc["embedding"] = text_to_embedding(doc["content"])

# Use for querying
query_embedding = text_to_embedding.eval("search query")
```

For complete API reference and patterns, load `references/api_operations.md`.

**For API documentation:** <https://cocoindex.io/docs/core/flow_methods>

## Built-in Functions

### Text Processing

**SplitRecursively** - Chunk text intelligently

```python
doc["chunks"] = doc["content"].transform(
    cocoindex.functions.SplitRecursively(),
    language="markdown",  # or "python", "javascript", etc.
    chunk_size=2000,
    chunk_overlap=500
)
```

**ParseJson** - Parse JSON strings

```python
data = json_string.transform(cocoindex.functions.ParseJson())
```

**DetectProgrammingLanguage** - Detect language from filename

```python
file["language"] = file["filename"].transform(
    cocoindex.functions.DetectProgrammingLanguage()
)
```

### Embeddings

**SentenceTransformerEmbed** - Local embedding model

```python
# Requires: cocoindex[embeddings]
chunk["embedding"] = chunk["text"].transform(
    cocoindex.functions.SentenceTransformerEmbed(
        model="sentence-transformers/all-MiniLM-L6-v2"
    )
)
```

**EmbedText** - LLM API embeddings

This is the **recommended way** to generate embeddings using LLM APIs (OpenAI, Voyage, etc.).

```python
chunk["embedding"] = chunk["text"].transform(
    cocoindex.functions.EmbedText(
        api_type=cocoindex.LlmApiType.OPENAI,
        model="text-embedding-3-small",
    )
)
```

**ColPaliEmbedImage** - Multimodal image embeddings

```python
# Requires: cocoindex[colpali]
image["embedding"] = image["img_bytes"].transform(
    cocoindex.functions.ColPaliEmbedImage(model="vidore/colpali-v1.2")
)
```

### LLM Extraction

**ExtractByLlm** - Extract structured data with LLM

This is the **recommended way** to use LLMs for extraction and summarization tasks. It supports both structured outputs (dataclasses, Pydantic models) and simple text outputs (str).

```python
import dataclasses

# For structured extraction
@dataclasses.dataclass
class ProductInfo:
    name: str
    price: float
    category: str

item["product_info"] = item["text"].transform(
    cocoindex.functions.ExtractByLlm(
        llm_spec=cocoindex.LlmSpec(
            api_type=cocoindex.LlmApiType.OPENAI,
            model="gpt-4o-mini"
        ),
        output_type=ProductInfo,
        instruction="Extract product information"
    )
)

# For text summarization/generation
file["summary"] = file["content"].transform(
    cocoindex.functions.ExtractByLlm(
        llm_spec=cocoindex.LlmSpec(
            api_type=cocoindex.LlmApiType.OPENAI,
            model="gpt-4o-mini"
        ),
        output_type=str,
        instruction="Summarize this document in one paragraph"
    )
)
```

## Common Sources and Targets

**Browse all sources:** <https://cocoindex.io/docs/sources/>
**Browse all targets:** <https://cocoindex.io/docs/targets/>

### Sources

**LocalFile:**

```python
cocoindex.sources.LocalFile(
    path="documents",
    included_patterns=["*.md", "*.txt"],
    excluded_patterns=["**/.*", "node_modules"]
)
```

**AmazonS3:**

```python
cocoindex.sources.AmazonS3(
    bucket="my-bucket",
    prefix="documents/",
    aws_access_key_id=cocoindex.add_transient_auth_entry("..."),
    aws_secret_access_key=cocoindex.add_transient_auth_entry("...")
)
```

**Postgres:**

```python
cocoindex.sources.Postgres(
    connection=cocoindex.add_auth_entry("conn", cocoindex.sources.PostgresConnection(...)),
    query="SELECT id, content FROM documents"
)
```

### Targets

**Postgres (with vector support):**

```python
collector.export(
    "target_name",
    cocoindex.targets.Postgres(),
    primary_key_fields=["id"],
    vector_indexes=[
        cocoindex.VectorIndexDef(
            field_name="embedding",
            metric=cocoindex.VectorSimilarityMetric.COSINE_SIMILARITY
        )
    ]
)
```

**Qdrant:**

```python
collector.export(
    "target_name",
    cocoindex.targets.Qdrant(collection_name="my_collection"),
    primary_key_fields=["id"]
)
```

**LanceDB:**

```python
# Requires: cocoindex[lancedb]
collector.export(
    "target_name",
    cocoindex.targets.LanceDB(uri="lancedb_data", table_name="my_table"),
    primary_key_fields=["id"]
)
```

**Neo4j (nodes):**

```python
collector.export(
    "nodes",
    cocoindex.targets.Neo4j(
        connection=neo4j_conn,
        mapping=cocoindex.targets.Nodes(label="Entity")
    ),
    primary_key_fields=["id"]
)
```

**Neo4j (relationships):**

```python
collector.export(
    "relationships",
    cocoindex.targets.Neo4j(
        connection=neo4j_conn,
        mapping=cocoindex.targets.Relationships(
            rel_type="RELATES_TO",
            source=cocoindex.targets.NodeFromFields(
                label="Entity",
                fields=[cocoindex.targets.TargetFieldMapping(source="source_id", target="id")]
            ),
            target=cocoindex.targets.NodeFromFields(
                label="Entity",
                fields=[cocoindex.targets.TargetFieldMapping(source="target_id", target="id")]
            )
        )
    ),
    primary_key_fields=["id"]
)
```

## Common Issues and Solutions

### "Flow not found"

- Check APP_TARGET format: `cocoindex show main.py`
- Use `--app-dir` if not in project root
- Verify flow name matches decorator

### "Database connection failed"

- Check `.env` has `COCOINDEX_DATABASE_URL`
- Test connection: `psql $COCOINDEX_DATABASE_URL`
- Use `--env-file` to specify custom location

### "Schema mismatch"

- Re-run setup: `cocoindex setup main.py`
- Drop and recreate: `cocoindex drop main.py && cocoindex setup main.py`

### "Live update exits immediately"

- Add `refresh_interval` to source
- Or use source-specific change capture (Postgres notifications, S3 events)

### "Out of memory"

- Add concurrency limits on sources: `max_inflight_rows`, `max_inflight_bytes`
- Set global limits in `.env`: `COCOINDEX_SOURCE_MAX_INFLIGHT_ROWS`

## Reference Documentation

This skill includes comprehensive reference documentation for common patterns and operations:

- **references/flow_patterns.md** - Complete examples of common flow patterns (text embedding, code embedding, knowledge graphs, live updates, concurrency control, etc.)
- **references/custom_functions.md** - Detailed guide for creating custom functions with examples (standalone functions, spec+executor pattern, LLM calls, external APIs, caching)
- **references/cli_operations.md** - Complete CLI reference with all commands, options, and workflows
- **references/api_operations.md** - Python API reference with examples for programmatic flow control, live updates, queries, and application integration patterns

Load these references when users need:

- Detailed examples of specific patterns
- Complete API documentation
- Advanced usage scenarios
- Troubleshooting guidance

**For comprehensive documentation:** <https://cocoindex.io/docs/>
**Search specific topics:** <https://cocoindex.io/docs/search?q=url%20encoded%20keyword>
