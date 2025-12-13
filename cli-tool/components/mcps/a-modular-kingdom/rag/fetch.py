import os
from .core import RAGPipeline

# --- Configuration ---
# This is the main control panel for the RAG system.
# Change these settings to experiment with the pipeline.
RAG_CONFIG = {
    "persist_dir": "./rag_db",
    "document_paths": ["./files/"],
    "embed_model": "all-MiniLM-L6-v2",
    "top_k": 3,
    "chunk_size": 500,
    "chunk_overlap": 100,
    "ensemble_weights": [0.3, 0.7], # [Vector retriever, BM25] 
    # Developer tool: Set to True to force the database to be rebuilt.
    "force_reindex": True
}

# --- System Singleton ---
import hashlib
from typing import Optional, Dict

_rag_system_v1_instances: Dict[str, RAGPipeline] = {}

def _safe_dir_name(path: str) -> str:
    abs_path = os.path.abspath(path)
    h = hashlib.md5(abs_path.encode("utf-8")).hexdigest()[:8]
    base = os.path.basename(abs_path.rstrip(os.sep)) or "root"
    return f"{base}_{h}"

def get_rag_pipeline(doc_path: Optional[str] = None):
    """
    Initializes and returns the RAGPipeline instance for the given doc_path.
    """
    global _rag_system_v1_instances
    key = os.path.abspath(doc_path) if doc_path else "__DEFAULT__"
    if key in _rag_system_v1_instances:
        return _rag_system_v1_instances[key]
    
    print("Initializing RAG v1 system...")
    try:
        config = RAG_CONFIG.copy()
        current_dir = os.path.dirname(os.path.abspath(__file__))
        if doc_path:
            # Scope documents to the provided directory
            config["document_paths"] = [os.path.abspath(doc_path)]
            # Create a unique persist dir per doc scope
            scope_dir = os.path.join(current_dir, "rag_db", _safe_dir_name(doc_path))
            os.makedirs(scope_dir, exist_ok=True)
            config["persist_dir"] = scope_dir
            # Force reindexing for new document paths
            config["force_reindex"] = True
        else:
            config["persist_dir"] = os.path.join(current_dir, "rag_db")
            config["document_paths"] = [os.path.join(current_dir, "files")]

        instance = RAGPipeline(config=config)
        _rag_system_v1_instances[key] = instance
        print("RAG v1 system initialized successfully.")
        return instance
    except Exception as e:
        print(f"FATAL ERROR: Could not initialize RAGPipeline v1: {e}")
        raise 

def get_retriever():
    """Returns the retriever interface for the evaluation script."""
    pipeline = get_rag_pipeline()
    return pipeline.vector_db.as_retriever()
        
def fetchExternalKnowledge(query: str, doc_path: str = None) -> str:
    """
    Fetches external knowledge based on a query.
    This is the main entry point for using the RAG system.
    """
    try:
        pipeline = get_rag_pipeline(doc_path=doc_path)
        # Safety checks
        if not isinstance(query, str) or not query:
            return "Error: Invalid or empty query provided."

        return pipeline.search(query)
    except Exception as e:
        return f"Sorry, an error occurred while searching: {e}"

