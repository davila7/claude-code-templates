# RAG Module V3

This module contains the advanced Retrieval-Augmented Generation (RAG) pipeline V3. It implements cutting-edge techniques from industry tutorials while maintaining compatibility with the existing V2 system for seamless comparison and testing.

## `core_3.py` - The Advanced RAG Pipeline

This file contains the `RAGPipelineV3` class, implementing all 7 steps of modern RAG architecture.

### Architecture

**V3 implements tutorial-grade techniques:**

-   **Custom Vector Database**: Built-from-scratch `VectorIndex` class with configurable distance metrics (cosine/euclidean) for educational transparency, vs V2's production-optimized FAISS.
-   **Custom BM25 Implementation**: `BM25Index` class with proper IDF calculation using the formula: `log(((N - freq + 0.5) / (freq + 0.5)) + 1)` for precise keyword matching.
-   **RRF Hybrid Fusion**: Uses Reciprocal Rank Fusion (`score = sum(1 / (k + rank))`) for automatic balancing between vector and BM25 results, eliminating the need for manual weight tuning used in V2's `EnsembleRetriever`.
-   **LLM-based Reranking**: Employs Ollama with `qwen3:8b` for contextually-aware document selection, providing superior understanding compared to V2's `CrossEncoder` neural model.
-   **Contextual Retrieval**: Preprocesses chunks by adding situational context using LLM before embedding, significantly improving searchability and relevance.

### The 7 RAG Steps Implemented

1. **Chunking**: Uses the same `RecursiveCharacterTextSplitter` as V2 for consistency
2. **Embeddings**: Converts text to vectors using `SentenceTransformerEmbeddings`
3. **Vector Search**: Custom implementation with cosine/euclidean distance calculation
4. **BM25 Search**: Custom keyword-based search with proper IDF scoring
5. **Hybrid Fusion**: RRF algorithm combines both search methods automatically
6. **LLM Reranking**: Qwen3:8b selects most relevant documents contextually
7. **Contextual Enhancement**: Adds document context to chunks before indexing

## `fetch_3.py` - The V3 Control Panel

This file provides the entry point to the RAG V3 system.

-   **Configuration (`RAG_CONFIG_V3`)**: Extended configuration supporting V3-specific parameters:
    -   `rrf_k`: RRF fusion parameter (default: 60)
    -   `use_contextual`: Enable/disable contextual retrieval
    -   `llm_model`: Model for reranking and contextualization
    -   `bm25_k1`, `bm25_b`: BM25 algorithm parameters
    -   `distance_metric`: Vector similarity metric
-   **Singleton Pattern (`get_rag_pipeline_v3`)**: Ensures V3 pipeline loads once, independent of V2
-   **Main Function (`fetchExternalKnowledgeV3`)**: Entry point for V3 RAG queries

## `evaluation.py` - Scientific Comparison System

Comprehensive evaluation framework to compare V2 vs V3 performance:

-   **Standardized Queries**: 5 test queries covering different topics
-   **Relevance Scoring**: Topic coverage analysis
-   **Performance Metrics**: Response time and success rate measurement
-   **Detailed Reporting**: Query-by-query comparison with winner determination
-   **JSON Export**: Timestamped results for analysis

### Key Differences from V2

| Feature | V2 | V3 |
|---------|----|----|
| **Vector DB** | FAISS (optimized) | Custom VectorIndex (educational) |
| **BM25** | Langchain BM25Retriever | Custom BM25Index with proper IDF |
| **Fusion** | Weighted Ensemble [0.7, 0.3] | RRF (automatic balancing) |
| **Reranking** | CrossEncoder neural model | LLM-based with qwen3:8b |
| **Context** | None | Contextual chunk preprocessing |
| **Philosophy** | Production-ready | Learning-focused with transparency |

## Database Structure

V3 maintains separate database (`rag_db_v3/`) with:
-   `docs.json`: Document metadata and contextual information
-   Custom indexes rebuilt from raw implementations

This allows seamless switching between V2 and V3 for comparison testing.