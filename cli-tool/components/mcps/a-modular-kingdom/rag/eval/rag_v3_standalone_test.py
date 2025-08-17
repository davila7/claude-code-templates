

import os
import re
import string
import fitz
import json
import math
import ollama
from collections import Counter
from typing import List, Dict, Any, Tuple, Callable, Optional
from langchain_community.embeddings import SentenceTransformerEmbeddings
from langchain_core.documents import Document
from langchain.text_splitter import RecursiveCharacterTextSplitter
import asyncio

# --- Proxy Fix for Ollama ---
def clear_proxy_settings():
    for var in ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"]:
        if var in os.environ:
            del os.environ[var]
clear_proxy_settings()

# --- RAG Configuration ---
RAG_CONFIG_V3 = {
    "version": "v3_standalone",
    "persist_dir": "./rag_db_v3_standalone_test", 
    "document_paths": ["./rag/files/"],
    "embed_model": "all-MiniLM-L6-v2",
    "top_k": 20,
    "chunk_size": 350,
    "chunk_overlap": 75,
    "rrf_k": 60,
    "rerank_top_k": 3,
    "force_reindex": True,
    "llm_model": "qwen3:8b",
    "bm25_k1": 1.5,
    "bm25_b": 0.75,
    "distance_metric": "cosine"
}

# --- VectorIndex Class (from rag/core_3.py) ---
class VectorIndex:
    def __init__(self, distance_metric: str = "cosine", embedding_fn=None):
        self.vectors: List[List[float]] = []
        self.documents: List[Dict[str, Any]] = []
        self._vector_dim: Optional[int] = None
        if distance_metric not in ["cosine", "euclidean"]:
            raise ValueError("distance_metric must be 'cosine' or 'euclidean'")
        self._distance_metric = distance_metric
        self._embedding_fn = embedding_fn

    def _euclidean_distance(self, vec1: List[float], vec2: List[float]) -> float:
        return math.sqrt(sum((p - q) ** 2 for p, q in zip(vec1, vec2)))

    def _dot_product(self, vec1: List[float], vec2: List[float]) -> float:
        return sum(p * q for p, q in zip(vec1, vec2))

    def _magnitude(self, vec: List[float]) -> float:
        return math.sqrt(sum(x * x for x in vec))

    def _cosine_distance(self, vec1: List[float], vec2: List[float]) -> float:
        mag1 = self._magnitude(vec1)
        mag2 = self._magnitude(vec2)
        if mag1 == 0 or mag2 == 0: return 1.0
        dot_prod = self._dot_product(vec1, vec2)
        cosine_similarity = max(-1.0, min(1.0, dot_prod / (mag1 * mag2)))
        return 1.0 - cosine_similarity

    def add_document(self, document: Dict[str, Any]):
        vector = self._embedding_fn(document["content"])
        if not self.vectors: self._vector_dim = len(vector)
        self.vectors.append(vector)
        self.documents.append(document)

    def search(self, query: Any, k: int = 1) -> List[Tuple[Dict[str, Any], float]]:
        if not self.vectors: return []
        query_vector = self._embedding_fn(query) if isinstance(query, str) else query
        dist_func = self._cosine_distance if self._distance_metric == "cosine" else self._euclidean_distance
        distances = [(dist_func(query_vector, v), d) for v, d in zip(self.vectors, self.documents)]
        distances.sort(key=lambda item: item[0])
        return [(doc, dist) for dist, doc in distances[:k]]

# --- BM25Index Class (from rag/core_3.py) ---
class BM25Index:
    def __init__(self, k1: float = 1.5, b: float = 0.75):
        self.documents: List[Dict[str, Any]] = []
        self._corpus_tokens: List[List[str]] = []
        self._doc_len: List[int] = []
        self._doc_freqs: Dict[str, int] = {}
        self._avg_doc_len: float = 0.0
        self._idf: Dict[str, float] = {}
        self._index_built: bool = False
        self.k1 = k1
        self.b = b

    def _tokenizer(self, text: str) -> List[str]:
        return [t for t in re.split(r"\W+", text.lower()) if t]

    def _calculate_idf(self):
        N = len(self.documents)
        self._idf = {t: math.log(((N - f + 0.5) / (f + 0.5)) + 1) for t, f in self._doc_freqs.items()}

    def add_document(self, document: Dict[str, Any]):
        tokens = self._tokenizer(document["content"])
        self.documents.append(document)
        self._corpus_tokens.append(tokens)
        self._doc_len.append(len(tokens))
        for token in set(tokens):
            self._doc_freqs[token] = self._doc_freqs.get(token, 0) + 1
        self._index_built = False

    def _build_index(self):
        if not self.documents: return
        self._avg_doc_len = sum(self._doc_len) / len(self.documents)
        self._calculate_idf()
        self._index_built = True

    def search(self, query: str, k: int = 1) -> List[Tuple[Dict[str, Any], float]]:
        if not self.documents: return []
        if not self._index_built: self._build_index()
        query_tokens = self._tokenizer(query)
        scores = []
        for i, doc in enumerate(self.documents):
            score = 0.0
            doc_counts = Counter(self._corpus_tokens[i])
            for token in query_tokens:
                if token not in self._idf: continue
                idf = self._idf[token]
                tf = doc_counts.get(token, 0)
                numerator = idf * tf * (self.k1 + 1)
                denominator = tf + self.k1 * (1 - self.b + self.b * (self._doc_len[i] / self._avg_doc_len))
                score += numerator / (denominator + 1e-9)
            if score > 1e-9: scores.append((score, doc))
        scores.sort(key=lambda x: x[0], reverse=True)
        return [(doc, math.exp(-0.1 * s)) for s, doc in scores[:k]]

# --- RAGPipelineV3 Class (from rag/core_3.py) ---
class RAGPipelineV3:
    def __init__(self, config: dict):
        self.config = config
        print(f"[RAG V3] Initializing with config: {config.get('version', 'unknown')}")
        embeddings_model = SentenceTransformerEmbeddings(model_name=self.config.get("embed_model"))
        self.embedding_fn = lambda text: embeddings_model.embed_query(text)
        self.vector_index = VectorIndex(distance_metric=self.config.get("distance_metric", "cosine"), embedding_fn=self.embedding_fn)
        self.bm25_index = BM25Index(k1=self.config.get("bm25_k1", 1.5), b=self.config.get("bm25_b", 0.75))
        self._load_or_create_database()

    def _extract_text_from_pdf(self, pdf_path: str) -> str:
        try:
            with fitz.open(pdf_path) as doc:
                return "".join(page.get_text() for page in doc)
        except Exception as e:
            print(f"Error extracting text from {pdf_path}: {e}")
            return ""

    def _load_or_create_database(self):
        if not os.path.exists(self.config.get("persist_dir")) or self.config.get("force_reindex", False):
            print(f"[RAG V3] Creating new database...")
            all_docs = []
            for path_str in self.config.get("document_paths"):
                path = os.path.abspath(path_str)
                print(f"[RAG V3] Processing path: {path}")
                if os.path.isdir(path):
                    for file in os.listdir(path):
                        file_path = os.path.join(path, file)
                        if file.lower().endswith(('.pdf', '.txt', '.py', '.md')):
                            content = self._extract_text_from_pdf(file_path) if file.lower().endswith('.pdf') else open(file_path, 'r', encoding='utf-8').read()
                            if content:
                                text_splitter = RecursiveCharacterTextSplitter(chunk_size=self.config.get("chunk_size"), chunk_overlap=self.config.get("chunk_overlap"))
                                chunks = text_splitter.split_text(content)
                                for i, chunk in enumerate(chunks):
                                    if len(chunk.strip()) > 50:
                                        all_docs.append({"content": chunk, "source": file_path, "id": f"{os.path.basename(file_path)}_chunk_{i}"})
            if not all_docs: raise ValueError("No documents processed.")
            print(f"[RAG V3] Indexing {len(all_docs)} chunks...")
            for doc in all_docs:
                self.vector_index.add_document(doc)
                self.bm25_index.add_document(doc)
            print(f"[RAG V3] Database created.")

    def _rrf_fusion(self, vector_results: List[Tuple], bm25_results: List[Tuple]) -> List[Dict]:
        doc_scores = {}
        k = self.config.get("rrf_k", 60)
        for rank, (doc, _) in enumerate(vector_results, 1):
            doc_id = doc.get("id")
            if doc_id not in doc_scores: doc_scores[doc_id] = {"doc": doc, "vector_rank": float('inf'), "bm25_rank": float('inf')}
            doc_scores[doc_id]["vector_rank"] = rank
        for rank, (doc, _) in enumerate(bm25_results, 1):
            doc_id = doc.get("id")
            if doc_id not in doc_scores: doc_scores[doc_id] = {"doc": doc, "vector_rank": float('inf'), "bm25_rank": float('inf')}
            doc_scores[doc_id]["bm25_rank"] = rank
        
        rrf_results = []
        for _, data in doc_scores.items():
            v_score = 1.0 / (k + data["vector_rank"]) if data["vector_rank"] != float('inf') else 0
            b_score = 1.0 / (k + data["bm25_rank"]) if data["bm25_rank"] != float('inf') else 0
            if (v_score + b_score) > 0: rrf_results.append((data["doc"], v_score + b_score))
        
        rrf_results.sort(key=lambda x: x[1], reverse=True)
        return [doc for doc, _ in rrf_results]

    async def _llm_rerank(self, docs: List[Dict], query: str, k: int) -> List[Dict]:
        if len(docs) <= k: return docs
        try:
            doc_list = [f"<document id='{i}'>{doc['content'][:500]}...</document>" for i, doc in enumerate(docs)]
            prompt = f"""You are a reranking engine. Your task is to select the {k} most relevant document IDs from the following list to answer the user's question.
Respond ONLY with a single, clean JSON object containing a list of the integer IDs. Do not include any other text, conversation, or markdown.

User question: {query}

Documents:
""" + "\n".join(doc_list) + f"""

JSON Response:"""
            response = await ollama.AsyncClient().chat(model=self.config.get("llm_model"), messages=[{'role': 'user', 'content': prompt}], format='json')
            
            # Clean the response to ensure it's valid JSON
            response_text = response['message']['content']
            clean_json_str = re.search(r'\{.*\}', response_text, re.DOTALL).group(0)
            
            selected_ids = json.loads(clean_json_str).get("document_ids", [])
            return [docs[i] for i in selected_ids if isinstance(i, int) and 0 <= i < len(docs)][:k]
        except Exception as e:
            print(f"[RAG V3] LLM reranking failed: {e}, falling back to original order")
            return docs[:k]

    async def search(self, query: str) -> List[Dict]:
        top_k = self.config.get("top_k", 20)
        rerank_top_k = self.config.get("rerank_top_k", 3)
        print(f"[RAG V3] Searching with query: '{query[:50]}...' ")
        vector_results = self.vector_index.search(query, k=top_k)
        bm25_results = self.bm25_index.search(query, k=top_k)
        fused_docs = self._rrf_fusion(vector_results, bm25_results)
        if not fused_docs: return []
        final_docs = await self._llm_rerank(fused_docs, query, rerank_top_k)
        return final_docs

# --- Main Execution Block ---
async def main():
    print("--- RAG V3 Standalone Test Script ---")
    try:
        pipeline = RAGPipelineV3(config=RAG_CONFIG_V3)
        print("\n✅ RAG Pipeline is ready.")
    except Exception as e:
        print(f"\n❌ FATAL ERROR during initialization: {e}")
        return

    while True:
        try:
            user_input = input("\n> Enter your query (or 'exit' to quit): ")
            if user_input.lower() == 'exit':
                break
            if not user_input.strip():
                continue

            filename = None
            query = user_input
            if '@' in user_input:
                match = re.search(r'@(\S+)', user_input)
                if match:
                    filename = match.group(1)
                    # Check if the file exists in the indexed documents
                    all_sources = {os.path.basename(doc.get('source', '')) for doc in pipeline.vector_index.documents}
                    if filename not in all_sources:
                        print(f"\n--- Error: File '{filename}' not found in the knowledge base. ---")
                        continue
                    query = re.sub(r'@\S+', '', user_input).strip()
                    print(f"Filtering for file: {filename}")

            results = await pipeline.search(query)

            if filename:
                # Perform filtering after retrieval
                filtered_results = [doc for doc in results if os.path.basename(doc.get('source', '')) == filename]
            else:
                filtered_results = results

            if not filtered_results:
                print("\n--- No relevant information found. ---")
            else:
                print("\n--- Search Results ---")
                unique_content = []
                for doc in filtered_results:
                    content = doc.get('content', '')
                    if content not in unique_content:
                        unique_content.append(content)
                
                print("\n\n---\n\n".join(unique_content))
                print("--------------------")

        except Exception as e:
            print(f"\nAn error occurred: {e}")

if __name__ == "__main__":
    asyncio.run(main())
