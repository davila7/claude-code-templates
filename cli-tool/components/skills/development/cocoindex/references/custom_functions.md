# Custom Functions Reference

Complete guide for creating custom functions in CocoIndex.

## Overview

Custom functions allow creating data transformation logic that can be used within flows. There are two approaches:

1. **Standalone function** - Simple, no configuration or setup logic
2. **Function spec + executor** - Advanced, with configuration and setup logic

## Standalone Functions

Use for simple transformations that don't need configuration or setup.

### Basic Example

```python
@cocoindex.op.function(behavior_version=1)
def compute_word_count(text: str) -> int:
    """Count words in text."""
    return len(text.split())
```

**Requirements:**
- Decorate with `@cocoindex.op.function()`
- Type annotations required for all arguments and return value
- Supports basic types, structs, tables, and numpy arrays

### With Optional Parameters

```python
@cocoindex.op.function(behavior_version=1)
def extract_info(content: str, filename: str, max_length: int | None = None) -> dict:
    """
    Extract information from content.

    Args:
        content: The document content
        filename: Source filename
        max_length: Optional maximum length for truncation
    """
    info = {
        "filename": filename,
        "length": len(content),
        "word_count": len(content.split())
    }

    if max_length and len(content) > max_length:
        info["truncated"] = True

    return info
```

### Using in Flows

```python
@cocoindex.flow_def(name="MyFlow")
def my_flow(flow_builder: cocoindex.FlowBuilder, data_scope: cocoindex.DataScope):
    data_scope["documents"] = flow_builder.add_source(
        cocoindex.sources.LocalFile(path="documents")
    )

    collector = data_scope.add_collector()

    with data_scope["documents"].row() as doc:
        # Use standalone function
        doc["word_count"] = doc["content"].transform(compute_word_count)

        # With additional arguments
        doc["info"] = doc["content"].transform(
            extract_info,
            filename=doc["filename"],
            max_length=1000
        )

        collector.collect(
            filename=doc["filename"],
            word_count=doc["word_count"],
            info=doc["info"]
        )

    collector.export("documents", cocoindex.targets.Postgres(), primary_key_fields=["filename"])
```

## Function Spec + Executor

Use for functions that need configuration or setup logic (e.g., loading models).

### Basic Structure

```python
# 1. Define the function spec (configuration)
class ComputeSomething(cocoindex.op.FunctionSpec):
    """
    Configuration for the ComputeSomething function.
    """
    param1: str
    param2: int = 10  # Optional with default

# 2. Define the executor (implementation)
@cocoindex.op.executor_class(behavior_version=1)
class ComputeSomethingExecutor:
    spec: ComputeSomething  # Required: link to spec

    def prepare(self) -> None:
        """
        Optional: Setup logic run once before execution.
        Use for loading models, establishing connections, etc.
        """
        # Setup based on self.spec
        pass

    def __call__(self, input_data: str) -> dict:
        """
        Required: Execute the function for each data row.

        Args must have type annotations.
        Return type must have type annotation.
        """
        # Use self.spec.param1, self.spec.param2
        return {"result": f"{input_data}-{self.spec.param1}"}
```

### Example: Custom Embedding Function

```python
from sentence_transformers import SentenceTransformer
import numpy as np
from numpy.typing import NDArray

class CustomEmbed(cocoindex.op.FunctionSpec):
    """
    Embed text using a specified SentenceTransformer model.
    """
    model_name: str
    normalize: bool = True

@cocoindex.op.executor_class(cache=True, behavior_version=1)
class CustomEmbedExecutor:
    spec: CustomEmbed
    model: SentenceTransformer | None = None

    def prepare(self) -> None:
        """Load the model once during initialization."""
        self.model = SentenceTransformer(self.spec.model_name)

    def __call__(self, text: str) -> NDArray[np.float32]:
        """Embed the input text."""
        assert self.model is not None
        embedding = self.model.encode(text, normalize_embeddings=self.spec.normalize)
        return embedding.astype(np.float32)

# Usage in flow
@cocoindex.flow_def(name="CustomEmbedFlow")
def custom_embed_flow(flow_builder: cocoindex.FlowBuilder, data_scope: cocoindex.DataScope):
    data_scope["documents"] = flow_builder.add_source(
        cocoindex.sources.LocalFile(path="documents")
    )

    collector = data_scope.add_collector()

    with data_scope["documents"].row() as doc:
        doc["embedding"] = doc["content"].transform(
            CustomEmbed(
                model_name="sentence-transformers/all-MiniLM-L6-v2",
                normalize=True
            )
        )

        collector.collect(
            text=doc["content"],
            embedding=doc["embedding"]
        )

    collector.export("embeddings", cocoindex.targets.Postgres(), primary_key_fields=["text"])
```

### Example: PDF Processing

```python
import pymupdf  # PyMuPDF

class PdfToMarkdown(cocoindex.op.FunctionSpec):
    """
    Convert PDF to markdown.
    """
    extract_images: bool = False
    page_range: tuple[int, int] | None = None  # (start, end) pages

@cocoindex.op.executor_class(cache=True, behavior_version=1)
class PdfToMarkdownExecutor:
    spec: PdfToMarkdown

    def __call__(self, pdf_bytes: bytes) -> str:
        """Convert PDF bytes to markdown text."""
        doc = pymupdf.Document(stream=pdf_bytes, filetype="pdf")

        # Determine page range
        start = 0
        end = doc.page_count
        if self.spec.page_range:
            start, end = self.spec.page_range
            start = max(0, start)
            end = min(doc.page_count, end)

        markdown_parts = []
        for page_num in range(start, end):
            page = doc[page_num]
            text = page.get_text()
            markdown_parts.append(f"# Page {page_num + 1}\n\n{text}")

        return "\n\n".join(markdown_parts)

# Usage
@cocoindex.flow_def(name="PdfFlow")
def pdf_flow(flow_builder: cocoindex.FlowBuilder, data_scope: cocoindex.DataScope):
    data_scope["pdfs"] = flow_builder.add_source(
        cocoindex.sources.LocalFile(path="pdfs", included_patterns=["*.pdf"])
    )

    collector = data_scope.add_collector()

    with data_scope["pdfs"].row() as pdf:
        pdf["markdown"] = pdf["content"].transform(
            PdfToMarkdown(extract_images=False, page_range=(0, 10))
        )

        collector.collect(
            filename=pdf["filename"],
            markdown=pdf["markdown"]
        )

    collector.export("pdf_text", cocoindex.targets.Postgres(), primary_key_fields=["filename"])
```

## Function Parameters

Both standalone functions and executors support these parameters:

### cache (bool)

Enable caching of function results for reuse during reprocessing.

```python
@cocoindex.op.function(cache=True, behavior_version=1)
def expensive_computation(text: str) -> dict:
    # Computationally intensive operation
    return {"result": analyze(text)}
```

**When to use:**
- Functions that are computationally expensive
- LLM API calls
- Model inference
- External API calls

### behavior_version (int)

Required when `cache=True`. Increment this when function behavior changes to invalidate cache.

```python
@cocoindex.op.function(cache=True, behavior_version=2)  # Incremented from 1
def improved_analysis(text: str) -> dict:
    # Updated algorithm - need to reprocess cached data
    return {"result": new_analysis(text)}
```

### gpu (bool)

Indicates the function uses GPU resources, affecting scheduling.

```python
@cocoindex.op.executor_class(gpu=True, cache=True, behavior_version=1)
class GpuModelExecutor:
    spec: GpuModel

    def prepare(self) -> None:
        self.model = load_model_on_gpu(self.spec.model_name)

    def __call__(self, text: str) -> NDArray[np.float32]:
        return self.model.predict(text)
```

### arg_relationship

Specifies metadata about argument relationships for tools like CocoInsight.

```python
@cocoindex.op.function(
    cache=True,
    behavior_version=1,
    arg_relationship=(cocoindex.ArgRelationship.CHUNKS_BASE_TEXT, "content")
)
def custom_chunker(content: str, chunk_size: int) -> list[dict]:
    """
    Chunks are derived from 'content' argument.
    First element of each chunk dict must be a Range type.
    """
    # Return list of chunks with location ranges
    return [
        {"location": cocoindex.Range(...), "text": chunk}
        for chunk in split_content(content, chunk_size)
    ]
```

**Supported relationships:**
- `ArgRelationship.CHUNKS_BASE_TEXT` - Output is chunks of input text
- `ArgRelationship.EMBEDDING_ORIGIN_TEXT` - Output is embedding of input text
- `ArgRelationship.RECTS_BASE_IMAGE` - Output is rectangles on input image

## Supported Data Types

Functions can use these types for arguments and return values:

### Basic Types
- `str` - Text
- `int` - Integer (maps to Int64)
- `float` - Float (maps to Float64)
- `bool` - Boolean
- `bytes` - Binary data
- `None` / `type(None)` - Null value

### Collection Types
- `list[T]` - List of type T
- `dict[str, T]` - Dictionary (becomes Struct)
- `cocoindex.Json` - Arbitrary JSON

### Numpy Types
- `NDArray[np.float32]` - Vector[Float32, N]
- `NDArray[np.float64]` - Vector[Float64, N]
- `NDArray[np.int32]` - Vector[Int32, N]
- `NDArray[np.int64]` - Vector[Int64, N]

### CocoIndex Types
- `cocoindex.Range` - Text range with location info
- Dataclasses - Become Struct types

### Optional Types
- `T | None` or `Optional[T]` - Optional value

### Table Types (Output only)
Functions can return table-like data using dataclasses:

```python
@dataclasses.dataclass
class Chunk:
    location: cocoindex.Range
    text: str

@cocoindex.op.function(behavior_version=1)
def chunk_text(content: str) -> list[Chunk]:
    """Returns a list representing a table."""
    return [
        Chunk(location=..., text=chunk)
        for chunk in split_content(content)
    ]
```

## Common Patterns

### Pattern: LLM-based Extraction

```python
from openai import OpenAI

class ExtractStructuredInfo(cocoindex.op.FunctionSpec):
    """Extract structured information using an LLM."""
    model: str = "gpt-4"
    system_prompt: str = "Extract key information from the text."

@cocoindex.op.executor_class(cache=True, behavior_version=1)
class ExtractStructuredInfoExecutor:
    spec: ExtractStructuredInfo
    client: OpenAI | None = None

    def prepare(self) -> None:
        self.client = OpenAI()  # Uses OPENAI_API_KEY env var

    def __call__(self, text: str) -> dict:
        assert self.client is not None
        response = self.client.chat.completions.create(
            model=self.spec.model,
            messages=[
                {"role": "system", "content": self.spec.system_prompt},
                {"role": "user", "content": text}
            ]
        )
        # Parse and return structured data
        return {"extracted": response.choices[0].message.content}
```

### Pattern: External API Call

```python
import requests

class FetchEnrichmentData(cocoindex.op.FunctionSpec):
    """Fetch enrichment data from external API."""
    api_endpoint: str
    api_key: str

@cocoindex.op.executor_class(cache=True, behavior_version=1)
class FetchEnrichmentDataExecutor:
    spec: FetchEnrichmentData

    def __call__(self, entity_id: str) -> dict:
        response = requests.get(
            f"{self.spec.api_endpoint}/entities/{entity_id}",
            headers={"Authorization": f"Bearer {self.spec.api_key}"}
        )
        response.raise_for_status()
        return response.json()
```

### Pattern: Multi-step Processing

```python
class ProcessDocument(cocoindex.op.FunctionSpec):
    """Process document through multiple steps."""
    min_quality_score: float = 0.7

@cocoindex.op.executor_class(cache=True, behavior_version=1)
class ProcessDocumentExecutor:
    spec: ProcessDocument
    nlp_model = None

    def prepare(self) -> None:
        import spacy
        self.nlp_model = spacy.load("en_core_web_sm")

    def __call__(self, text: str) -> dict:
        # Step 1: Clean text
        cleaned = self._clean_text(text)

        # Step 2: Extract entities
        doc = self.nlp_model(cleaned)
        entities = [ent.text for ent in doc.ents]

        # Step 3: Quality check
        quality_score = self._compute_quality(cleaned)

        return {
            "cleaned_text": cleaned if quality_score >= self.spec.min_quality_score else None,
            "entities": entities,
            "quality_score": quality_score
        }

    def _clean_text(self, text: str) -> str:
        # Cleaning logic
        return text.strip()

    def _compute_quality(self, text: str) -> float:
        # Quality scoring logic
        return len(text) / 1000.0
```

## Best Practices

1. **Use caching for expensive operations** - Enable `cache=True` for LLM calls, model inference, or external APIs
2. **Type annotations required** - All arguments and return types must be annotated
3. **Increment behavior_version** - When changing cached function logic, increment version to invalidate cache
4. **Use prepare() for initialization** - Load models, establish connections once in prepare()
5. **Keep functions focused** - Each function should do one thing well
6. **Document parameters** - Use docstrings to explain function purpose and parameters
7. **Handle errors gracefully** - Consider edge cases and invalid inputs
8. **Use appropriate return types** - Match return types to target schema needs
