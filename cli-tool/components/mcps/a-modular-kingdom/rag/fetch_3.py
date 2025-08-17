import os
import hashlib
from typing import Optional, Dict
from .core_3 import RAGPipelineV3

RAG_CONFIG_V3 = {
    "version": "v3",
    "persist_dir": "./rag_db_v3", 
    "document_paths": ["./files/"],
    "embed_model": "all-MiniLM-L6-v2",
    "top_k": 20,
    "chunk_size": 350,
    "chunk_overlap": 75,
    "rrf_k": 60,  # RRF parameter instead of ensemble weights
    "rerank_top_k": 3,  # Enable LLM reranking
    "force_reindex": False,
    "use_contextual": False,  # Disable contextual retrieval for performance
    "llm_model": "qwen3:8b",  # For LLM reranking
    "bm25_k1": 1.5,  # BM25 parameters
    "bm25_b": 0.75,
    "distance_metric": "cosine"  # Vector distance metric
}

_rag_system_v3_instances: Dict[str, RAGPipelineV3] = {}

def _safe_dir_name(path: str) -> str:
    abs_path = os.path.abspath(path)
    h = hashlib.md5(abs_path.encode("utf-8")).hexdigest()[:8]
    base = os.path.basename(abs_path.rstrip(os.sep)) or "root"
    return f"{base}_{h}"

def get_rag_pipeline_v3(doc_path: Optional[str] = None):
    import sys
    key = os.path.abspath(doc_path) if doc_path else "__DEFAULT__"
    if key in _rag_system_v3_instances:
        sys.stderr.write(f"[RAG] Returning existing instance for key {key}\n")
        sys.stderr.flush()
        return _rag_system_v3_instances[key]
    sys.stderr.write("[RAG] Creating new V3 instance...\n")
    sys.stderr.flush()
    try:
        config = RAG_CONFIG_V3.copy()
        current_dir = os.path.dirname(os.path.abspath(__file__))
        if doc_path:
            # Scope documents to the provided directory
            config["document_paths"] = [os.path.abspath(doc_path)]
            # Create a unique persist dir per doc scope
            scope_dir = os.path.join(current_dir, "rag_db_v3", _safe_dir_name(doc_path))
            os.makedirs(scope_dir, exist_ok=True)
            config["persist_dir"] = scope_dir
            # Force reindexing for new document paths only if needed
            config["force_reindex"] = False
        else:
            config["persist_dir"] = os.path.join(current_dir, config["persist_dir"])
            config["document_paths"] = [os.path.join(current_dir, path) for path in config["document_paths"]]
        
        sys.stderr.write("[RAG] About to create RAGPipelineV3...\n")
        sys.stderr.flush()
        instance = RAGPipelineV3(config=config)
        _rag_system_v3_instances[key] = instance
        sys.stderr.write("[RAG] V3 initialization complete\n")
        sys.stderr.flush()
        return instance
    except Exception as e:
        sys.stderr.write(f"[RAG] FATAL ERROR: {e}\n")
        sys.stderr.flush()
        raise

# class V3RetrieverAdapter:
#     """
#     Adapts the V3 pipeline's custom output to the standard retriever interface
#     expected by the evaluation script.
#     """
#     def __init__(self, pipeline):
#         self.pipeline = pipeline

#     def get_relevant_documents(self, query: str):
#         """
#         Calls the V3 search and wraps the string results in Document objects.
#         """
#         # The V3 search function returns a single string with results separated by "---".
#         search_result_str = self.pipeline.search(query)
        
#         # We need to parse this string back into a list of Document objects.
#         # This is a simplified parsing based on the V3 search function's output format.
#         if "Document search results:" in search_result_str:
#             content = search_result_str.split("Document search results:\n\n")[1]
#             chunks = content.split("\n\n---\n\n")
#             # langchain_core.documents.Document
#             from langchain_core.documents import Document
#             return [Document(page_content=chunk) for chunk in chunks]
#         return []

# def get_retriever():
#     """Returns the retriever interface for the evaluation script."""
#     pipeline = get_rag_pipeline_v3()
#     return V3RetrieverAdapter(pipeline)

def fetchExternalKnowledgeV3(query: str, doc_path: Optional[str] = None) -> str:
    try:
        pipeline = get_rag_pipeline_v3(doc_path=doc_path)
        if not isinstance(query, str) or not query:
            return "Error: Invalid or empty query provided."
        return pipeline.search(query)
    except Exception as e:
        return f"Sorry, an error occurred while searching: {e}"

# For compatibility with a unified interface
def fetchExternalKnowledge(query: str, doc_path: Optional[str] = None) -> str:
    return fetchExternalKnowledgeV3(query, doc_path=doc_path)