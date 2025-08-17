import os
import hashlib
from typing import Optional, Dict
from .core_2 import RAGPipeline

RAG_CONFIG = {
    "persist_dir": "./rag_db_v2",
    "document_paths": ["./files/"],
    "embed_model": "all-MiniLM-L6-v2",
    "top_k": 20,
    "chunk_size": 350,
    "chunk_overlap": 75,
    "ensemble_weights": [0.3, 0.7],
    "reranker_model": 'cross-encoder/ms-marco-MiniLM-L-6-v2',
    "rerank_top_k": 3,
    "force_reindex": True
}

_rag_system_v2_instances: Dict[str, RAGPipeline] = {}

def _safe_dir_name(path: str) -> str:
    abs_path = os.path.abspath(path)
    h = hashlib.md5(abs_path.encode("utf-8")).hexdigest()[:8]
    base = os.path.basename(abs_path.rstrip(os.sep)) or "root"
    return f"{base}_{h}"

def get_rag_pipeline(doc_path: Optional[str] = None):
    global _rag_system_v2_instances
    key = os.path.abspath(doc_path) if doc_path else "__DEFAULT__"
    if key in _rag_system_v2_instances:
        return _rag_system_v2_instances[key]
        
    print("Initializing RAG system V2...")
    try:
        config = RAG_CONFIG.copy()
        current_dir = os.path.dirname(os.path.abspath(__file__))
        if doc_path:
            # Scope documents to the provided directory
            config["document_paths"] = [os.path.abspath(doc_path)]
            # Create a unique persist dir per doc scope
            scope_dir = os.path.join(current_dir, "rag_db_v2", _safe_dir_name(doc_path))
            os.makedirs(scope_dir, exist_ok=True)
            config["persist_dir"] = scope_dir
            # Force reindexing for new document paths
            config["force_reindex"] = True
        else:
            config["persist_dir"] = os.path.join(current_dir, config["persist_dir"])
            config["document_paths"] = [os.path.join(current_dir, path) for path in config["document_paths"]]
            
        instance = RAGPipeline(config=config)
        _rag_system_v2_instances[key] = instance
        print("RAG system V2 initialized successfully.")
        return instance
    except Exception as e:
        print(f"FATAL ERROR: Could not initialize RAGPipeline V2: {e}")
        raise

def fetchExternalKnowledge(query: str, doc_path: Optional[str] = None) -> str:
    try:
        pipeline = get_rag_pipeline(doc_path=doc_path)
        if not isinstance(query, str) or not query:
            return "Error: Invalid or empty query provided."
        return pipeline.search(query)
    except Exception as e:
        return f"Sorry, an error occurred while searching: {e}"
