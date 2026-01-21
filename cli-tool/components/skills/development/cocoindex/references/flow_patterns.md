# CocoIndex Flow Patterns

This reference provides common patterns and examples for building CocoIndex flows.

## Basic Flow Pattern

```python
import cocoindex

@cocoindex.flow_def(name="FlowName")
def my_flow(flow_builder: cocoindex.FlowBuilder, data_scope: cocoindex.DataScope):
    # 1. Import source data
    data_scope["source_data"] = flow_builder.add_source(...)

    # 2. Create collectors for output
    my_collector = data_scope.add_collector()

    # 3. Transform data
    with data_scope["source_data"].row() as item:
        item["transformed"] = item["field"].transform(...)
        my_collector.collect(...)

    # 4. Export to target
    my_collector.export("target_name", ..., primary_key_fields=[...])
```

## Common Flow Patterns

### Pattern 1: Simple Text Embedding

Embed documents from local files into a vector database.

```python
@cocoindex.flow_def(name="TextEmbedding")
def text_embedding_flow(flow_builder: cocoindex.FlowBuilder, data_scope: cocoindex.DataScope):
    # Import documents
    data_scope["documents"] = flow_builder.add_source(
        cocoindex.sources.LocalFile(path="documents")
    )

    doc_embeddings = data_scope.add_collector()

    with data_scope["documents"].row() as doc:
        # Split into chunks
        doc["chunks"] = doc["content"].transform(
            cocoindex.functions.SplitRecursively(),
            language="markdown",
            chunk_size=2000,
            chunk_overlap=500
        )

        with doc["chunks"].row() as chunk:
            # Embed each chunk
            chunk["embedding"] = chunk["text"].transform(
                cocoindex.functions.SentenceTransformerEmbed(
                    model="sentence-transformers/all-MiniLM-L6-v2"
                )
            )

            doc_embeddings.collect(
                id=cocoindex.GeneratedField.UUID,
                filename=doc["filename"],
                text=chunk["text"],
                embedding=chunk["embedding"]
            )

    # Export to Postgres with vector index
    doc_embeddings.export(
        "doc_embeddings",
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

### Pattern 2: Code Embedding with Language Detection

```python
@cocoindex.flow_def(name="CodeEmbedding")
def code_embedding_flow(flow_builder: cocoindex.FlowBuilder, data_scope: cocoindex.DataScope):
    data_scope["files"] = flow_builder.add_source(
        cocoindex.sources.LocalFile(
            path=".",
            included_patterns=["*.py", "*.rs", "*.md"],
            excluded_patterns=["**/.*", "target", "**/node_modules"]
        )
    )

    code_embeddings = data_scope.add_collector()

    with data_scope["files"].row() as file:
        # Detect language
        file["language"] = file["filename"].transform(
            cocoindex.functions.DetectProgrammingLanguage()
        )

        # Split using language-aware chunking
        file["chunks"] = file["content"].transform(
            cocoindex.functions.SplitRecursively(),
            language=file["language"],
            chunk_size=1000,
            chunk_overlap=300
        )

        with file["chunks"].row() as chunk:
            chunk["embedding"] = chunk["text"].transform(
                cocoindex.functions.SentenceTransformerEmbed(
                    model="sentence-transformers/all-MiniLM-L6-v2"
                )
            )

            code_embeddings.collect(
                filename=file["filename"],
                location=chunk["location"],
                code=chunk["text"],
                embedding=chunk["embedding"],
                start=chunk["start"],
                end=chunk["end"]
            )

    code_embeddings.export(
        "code_embeddings",
        cocoindex.targets.Postgres(),
        primary_key_fields=["filename", "location"],
        vector_indexes=[
            cocoindex.VectorIndexDef(
                field_name="embedding",
                metric=cocoindex.VectorSimilarityMetric.COSINE_SIMILARITY
            )
        ]
    )
```

### Pattern 3: LLM-based Extraction to Knowledge Graph

Extract structured information using LLMs and build a knowledge graph.

```python
import dataclasses

@dataclasses.dataclass
class ProductInfo:
    id: str
    title: str
    price: float

@dataclasses.dataclass
class Taxonomy:
    name: str

@cocoindex.flow_def(name="ProductGraph")
def product_graph_flow(flow_builder: cocoindex.FlowBuilder, data_scope: cocoindex.DataScope):
    # Setup Neo4j connection
    neo4j_conn = cocoindex.add_auth_entry(
        "Neo4jConnection",
        cocoindex.targets.Neo4jConnection(
            uri="bolt://localhost:7687",
            user="neo4j",
            password="password"
        )
    )

    data_scope["products"] = flow_builder.add_source(
        cocoindex.sources.LocalFile(path="products", included_patterns=["*.json"])
    )

    product_nodes = data_scope.add_collector()
    product_taxonomy = data_scope.add_collector()

    with data_scope["products"].row() as product:
        # Parse JSON and extract info
        data = product["content"].transform(
            cocoindex.functions.ParseJson()
        )

        # Use LLM to extract taxonomies
        taxonomy = data["description"].transform(
            cocoindex.functions.ExtractByLlm(
                llm_spec=cocoindex.LlmSpec(
                    api_type=cocoindex.LlmApiType.OPENAI,
                    model="gpt-4"
                ),
                output_type=list[Taxonomy]
            )
        )

        product_nodes.collect(
            id=data["id"],
            title=data["title"],
            price=data["price"]
        )

        with taxonomy.row() as t:
            product_taxonomy.collect(
                id=cocoindex.GeneratedField.UUID,
                product_id=data["id"],
                taxonomy=t["name"]
            )

    # Export product nodes
    product_nodes.export(
        "product_node",
        cocoindex.targets.Neo4j(
            connection=neo4j_conn,
            mapping=cocoindex.targets.Nodes(label="Product")
        ),
        primary_key_fields=["id"]
    )

    # Declare taxonomy nodes
    flow_builder.declare(
        cocoindex.targets.Neo4jDeclaration(
            connection=neo4j_conn,
            nodes_label="Taxonomy",
            primary_key_fields=["value"]
        )
    )

    # Export relationships
    product_taxonomy.export(
        "product_taxonomy",
        cocoindex.targets.Neo4j(
            connection=neo4j_conn,
            mapping=cocoindex.targets.Relationships(
                rel_type="HAS_TAXONOMY",
                source=cocoindex.targets.NodeFromFields(
                    label="Product",
                    fields=[cocoindex.targets.TargetFieldMapping(source="product_id", target="id")]
                ),
                target=cocoindex.targets.NodeFromFields(
                    label="Taxonomy",
                    fields=[cocoindex.targets.TargetFieldMapping(source="taxonomy", target="value")]
                )
            )
        ),
        primary_key_fields=["id"]
    )
```

### Pattern 4: Live Updates with Refresh Interval

```python
import datetime

@cocoindex.flow_def(name="LiveDataFlow")
def live_data_flow(flow_builder: cocoindex.FlowBuilder, data_scope: cocoindex.DataScope):
    # Add source with refresh interval
    data_scope["documents"] = flow_builder.add_source(
        cocoindex.sources.LocalFile(path="live_documents"),
        refresh_interval=datetime.timedelta(minutes=1)  # Refresh every minute
    )

    # ... rest of flow definition
```

### Pattern 5: Custom Transform Function

```python
@cocoindex.op.function(behavior_version=1)
def extract_metadata(content: str, filename: str) -> dict:
    """Extract metadata from document content."""
    return {
        "word_count": len(content.split()),
        "char_count": len(content),
        "source": filename
    }

@cocoindex.flow_def(name="CustomFunctionFlow")
def custom_function_flow(flow_builder: cocoindex.FlowBuilder, data_scope: cocoindex.DataScope):
    data_scope["documents"] = flow_builder.add_source(
        cocoindex.sources.LocalFile(path="documents")
    )

    collector = data_scope.add_collector()

    with data_scope["documents"].row() as doc:
        # Use custom function
        doc["metadata"] = doc["content"].transform(
            extract_metadata,
            filename=doc["filename"]
        )

        collector.collect(
            filename=doc["filename"],
            word_count=doc["metadata"]["word_count"],
            char_count=doc["metadata"]["char_count"]
        )

    collector.export("metadata", cocoindex.targets.Postgres(), primary_key_fields=["filename"])
```

### Pattern 6: Transform Flow for Reusable Logic

Transform flows allow extracting reusable transformation logic that can be shared between indexing and querying.

```python
@cocoindex.transform_flow()
def text_to_embedding(text: cocoindex.DataSlice[str]) -> cocoindex.DataSlice[list[float]]:
    """Shared embedding logic for both indexing and querying."""
    return text.transform(
        cocoindex.functions.SentenceTransformerEmbed(
            model="sentence-transformers/all-MiniLM-L6-v2"
        )
    )

@cocoindex.flow_def(name="MainFlow")
def main_flow(flow_builder: cocoindex.FlowBuilder, data_scope: cocoindex.DataScope):
    data_scope["documents"] = flow_builder.add_source(
        cocoindex.sources.LocalFile(path="documents")
    )

    collector = data_scope.add_collector()

    with data_scope["documents"].row() as doc:
        # Use transform flow
        doc["embedding"] = text_to_embedding(doc["content"])
        collector.collect(text=doc["content"], embedding=doc["embedding"])

    collector.export("docs", cocoindex.targets.Postgres(), primary_key_fields=["text"])

# Later, use same transform flow for querying
def search(query: str):
    query_embedding = text_to_embedding.eval(query)  # Evaluate with input
    # ... perform search with query_embedding
```

### Pattern 7: Concurrency Control

```python
@cocoindex.flow_def(name="ConcurrencyControlFlow")
def concurrency_flow(flow_builder: cocoindex.FlowBuilder, data_scope: cocoindex.DataScope):
    # Limit concurrent processing at source level
    data_scope["documents"] = flow_builder.add_source(
        cocoindex.sources.LocalFile(path="large_documents"),
        max_inflight_rows=10,                    # Max 10 documents at once
        max_inflight_bytes=100 * 1024 * 1024    # Max 100MB in memory
    )

    collector = data_scope.add_collector()

    with data_scope["documents"].row() as doc:
        doc["chunks"] = doc["content"].transform(
            cocoindex.functions.SplitRecursively(),
            chunk_size=2000
        )

        # Limit concurrent processing at row iteration level
        with doc["chunks"].row(max_inflight_rows=100) as chunk:
            chunk["embedding"] = chunk["text"].transform(
                cocoindex.functions.SentenceTransformerEmbed(
                    model="sentence-transformers/all-MiniLM-L6-v2"
                )
            )
            collector.collect(text=chunk["text"], embedding=chunk["embedding"])

    collector.export("chunks", cocoindex.targets.Postgres(), primary_key_fields=["text"])
```

## Data Source Patterns

### Local Files

```python
cocoindex.sources.LocalFile(
    path="documents",
    included_patterns=["*.md", "*.txt"],
    excluded_patterns=["**/.*", "node_modules"]
)
```

### Amazon S3

```python
cocoindex.sources.AmazonS3(
    bucket="my-bucket",
    prefix="documents/",
    included_patterns=["*.pdf"],
    aws_access_key_id=cocoindex.add_transient_auth_entry("..."),
    aws_secret_access_key=cocoindex.add_transient_auth_entry("...")
)
```

### Postgres Source

```python
cocoindex.sources.Postgres(
    connection=cocoindex.add_auth_entry(
        "postgres_conn",
        cocoindex.sources.PostgresConnection(
            host="localhost",
            database="mydb",
            user="user",
            password="password"
        )
    ),
    query="SELECT id, content FROM documents"
)
```

## Target Patterns

### Postgres

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

### Qdrant

```python
collector.export(
    "target_name",
    cocoindex.targets.Qdrant(collection_name="my_collection"),
    primary_key_fields=["id"]
)
```

### LanceDB

```python
collector.export(
    "target_name",
    cocoindex.targets.LanceDB(
        uri="lancedb_data",
        table_name="my_table"
    ),
    primary_key_fields=["id"]
)
```

### Neo4j (Knowledge Graph)

```python
# Node export
collector.export(
    "nodes",
    cocoindex.targets.Neo4j(
        connection=neo4j_conn,
        mapping=cocoindex.targets.Nodes(label="Entity")
    ),
    primary_key_fields=["id"]
)

# Relationship export
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
