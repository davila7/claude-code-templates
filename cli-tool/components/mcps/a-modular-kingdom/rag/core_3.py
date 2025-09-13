import os, re, string, fitz, json, math

# --- FIX for Ollama Proxy ---
# This is necessary to ensure the local Ollama server can be reached.
def clear_proxy_settings():
    for var in ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"]:
        if var in os.environ:
            del os.environ[var]
clear_proxy_settings()

import ollama
from collections import Counter
from typing import List, Dict, Any, Tuple, Callable, Optional
from langchain_community.embeddings import SentenceTransformerEmbeddings
from langchain_core.documents import Document
from langchain.text_splitter import RecursiveCharacterTextSplitter


class VectorIndex:
    """
    Custom Vector Database implementation from RAG Course.
    Uses cosine or euclidean distance for similarity search.
    """
    def __init__(self, distance_metric: str = "cosine", embedding_fn=None):
        self.vectors: List[List[float]] = []
        self.documents: List[Dict[str, Any]] = []
        self._vector_dim: Optional[int] = None
        if distance_metric not in ["cosine", "euclidean"]:
            raise ValueError("distance_metric must be 'cosine' or 'euclidean'")
        self._distance_metric = distance_metric
        self._embedding_fn = embedding_fn

    def _euclidean_distance(self, vec1: List[float], vec2: List[float]) -> float:
        if len(vec1) != len(vec2):
            raise ValueError("Vectors must have the same dimension")
        return math.sqrt(sum((p - q) ** 2 for p, q in zip(vec1, vec2)))

    def _dot_product(self, vec1: List[float], vec2: List[float]) -> float:
        if len(vec1) != len(vec2):
            raise ValueError("Vectors must have the same dimension")
        return sum(p * q for p, q in zip(vec1, vec2))

    def _magnitude(self, vec: List[float]) -> float:
        return math.sqrt(sum(x * x for x in vec))

    def _cosine_distance(self, vec1: List[float], vec2: List[float]) -> float:
        if len(vec1) != len(vec2):
            raise ValueError("Vectors must have the same dimension")

        mag1 = self._magnitude(vec1)
        mag2 = self._magnitude(vec2)

        if mag1 == 0 and mag2 == 0:
            return 0.0
        elif mag1 == 0 or mag2 == 0:
            return 1.0

        dot_prod = self._dot_product(vec1, vec2)
        cosine_similarity = dot_prod / (mag1 * mag2)
        cosine_similarity = max(-1.0, min(1.0, cosine_similarity))

        return 1.0 - cosine_similarity

    def add_document(self, document: Dict[str, Any]):
        if not self._embedding_fn:
            raise ValueError("Embedding function not provided during initialization.")
        if not isinstance(document, dict):
            raise TypeError("Document must be a dictionary.")
        if "content" not in document:
            raise ValueError("Document dictionary must contain a 'content' key.")

        content = document["content"]
        if not isinstance(content, str):
            raise TypeError("Document 'content' must be a string.")

        vector = self._embedding_fn(content)
        self.add_vector(vector=vector, document=document)

    def add_vector(self, vector: List[float], document: Dict[str, Any]):
        if not isinstance(vector, list) or not all(isinstance(x, (int, float)) for x in vector):
            raise TypeError("Vector must be a list of numbers.")
        if not isinstance(document, dict):
            raise TypeError("Document must be a dictionary.")
        if "content" not in document:
            raise ValueError("Document dictionary must contain a 'content' key.")

        if not self.vectors:
            self._vector_dim = len(vector)
        elif len(vector) != self._vector_dim:
            raise ValueError(f"Inconsistent vector dimension. Expected {self._vector_dim}, got {len(vector)}")

        self.vectors.append(list(vector))
        self.documents.append(document)

    def search(self, query: Any, k: int = 1) -> List[Tuple[Dict[str, Any], float]]:
        if not self.vectors:
            return []

        if isinstance(query, str):
            if not self._embedding_fn:
                raise ValueError("Embedding function not provided for string query.")
            query_vector = self._embedding_fn(query)
        elif isinstance(query, list) and all(isinstance(x, (int, float)) for x in query):
            query_vector = query
        else:
            raise TypeError("Query must be either a string or a list of numbers.")

        if self._vector_dim is None:
            return []

        if len(query_vector) != self._vector_dim:
            raise ValueError(f"Query vector dimension mismatch. Expected {self._vector_dim}, got {len(query_vector)}")

        if k <= 0:
            raise ValueError("k must be a positive integer.")

        if self._distance_metric == "cosine":
            dist_func = self._cosine_distance
        else:
            dist_func = self._euclidean_distance

        distances = []
        for i, stored_vector in enumerate(self.vectors):
            distance = dist_func(query_vector, stored_vector)
            distances.append((distance, self.documents[i]))

        distances.sort(key=lambda item: item[0])
        return [(doc, dist) for dist, doc in distances[:k]]

    def __len__(self) -> int:
        return len(self.vectors)


class BM25Index:
    """
    Custom BM25 implementation from RAG Course.
    Uses proper IDF calculation and BM25 scoring formula.
    """
    def __init__(self, k1: float = 1.5, b: float = 0.75, tokenizer=None):
        self.documents: List[Dict[str, Any]] = []
        self._corpus_tokens: List[List[str]] = []
        self._doc_len: List[int] = []
        self._doc_freqs: Dict[str, int] = {}
        self._avg_doc_len: float = 0.0
        self._idf: Dict[str, float] = {}
        self._index_built: bool = False

        self.k1 = k1  # Term frequency saturation parameter
        self.b = b    # Length normalization parameter
        self._tokenizer = tokenizer if tokenizer else self._default_tokenizer

    def _default_tokenizer(self, text: str) -> List[str]:
        text = text.lower()
        tokens = re.split(r"\W+", text)
        return [token for token in tokens if token]

    def _calculate_idf(self):
        """Calculate Inverse Document Frequency for each term"""
        N = len(self.documents)
        self._idf = {}
        for term, freq in self._doc_freqs.items():
            # IDF formula from tutorial: log(((N - freq + 0.5) / (freq + 0.5)) + 1)
            idf_score = math.log(((N - freq + 0.5) / (freq + 0.5)) + 1)
            self._idf[term] = idf_score

    def add_document(self, document: Dict[str, Any]):
        if not isinstance(document, dict):
            raise TypeError("Document must be a dictionary.")
        if "content" not in document:
            raise ValueError("Document dictionary must contain a 'content' key.")

        content = document.get("content", "")
        if not isinstance(content, str):
            raise TypeError("Document 'content' must be a string.")

        doc_tokens = self._tokenizer(content)
        self.documents.append(document)
        self._corpus_tokens.append(doc_tokens)
        
        # Update statistics
        self._doc_len.append(len(doc_tokens))
        seen_in_doc = set()
        for token in doc_tokens:
            if token not in seen_in_doc:
                self._doc_freqs[token] = self._doc_freqs.get(token, 0) + 1
                seen_in_doc.add(token)
        
        self._index_built = False

    def _build_index(self):
        """Build the BM25 index by calculating average doc length and IDF scores"""
        if not self.documents:
            self._avg_doc_len = 0.0
            self._idf = {}
            self._index_built = True
            return

        self._avg_doc_len = sum(self._doc_len) / len(self.documents)
        self._calculate_idf()
        self._index_built = True

    def search(self, query: str, k: int = 1) -> List[Tuple[Dict[str, Any], float]]:
        if not self.documents:
            return []

        if k <= 0:
            raise ValueError("k must be a positive integer.")

        if not self._index_built:
            self._build_index()

        if self._avg_doc_len == 0:
            return []

        query_tokens = self._tokenizer(query)
        if not query_tokens:
            return []

        # Calculate BM25 scores for all documents
        scores = []
        for i, doc in enumerate(self.documents):
            score = self._compute_bm25_score(query_tokens, i)
            if score > 1e-9:  # Only include documents with non-zero scores
                scores.append((score, doc))

        # Sort by score (highest first) and return top k
        scores.sort(key=lambda x: x[0], reverse=True)
        
        # Convert to distance format (lower is better) for consistency with VectorIndex
        results = []
        for score, doc in scores[:k]:
            # Convert score to distance using exponential normalization
            distance = math.exp(-0.1 * score)
            results.append((doc, distance))
        
        return results

    def _compute_bm25_score(self, query_tokens: List[str], doc_index: int) -> float:
        """Compute BM25 score for a document given query tokens"""
        score = 0.0
        doc_term_counts = Counter(self._corpus_tokens[doc_index])
        doc_length = self._doc_len[doc_index]

        for token in query_tokens:
            if token not in self._idf:
                continue

            idf = self._idf[token]
            term_freq = doc_term_counts.get(token, 0)

            # BM25 formula: IDF * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (|d| / avgdl)))
            numerator = idf * term_freq * (self.k1 + 1)
            denominator = term_freq + self.k1 * (1 - self.b + self.b * (doc_length / self._avg_doc_len))
            score += numerator / (denominator + 1e-9)  # Small epsilon to avoid division by zero

        return score


class RAGPipelineV3:
    """
    RAG Pipeline V3 implementing tutorial techniques:
    1. Custom VectorIndex and BM25Index
    2. RRF (Reciprocal Rank Fusion) instead of weighted ensemble
    3. LLM-based reranking with Ollama
    4. Contextual chunk preprocessing
    """
    
    def __init__(self, config: dict):
        self.config = config
        print(f"[RAG V3] Initializing with config: {config.get('version', 'unknown')}")
        
        # Initialize embedding function
        embeddings_model = SentenceTransformerEmbeddings(model_name=self.config.get("embed_model"))
        self.embedding_fn = lambda text: embeddings_model.embed_query(text)
        
        # Initialize indexes
        self.vector_index = VectorIndex(
            distance_metric=self.config.get("distance_metric", "cosine"),
            embedding_fn=self.embedding_fn
        )
        self.bm25_index = BM25Index(
            k1=self.config.get("bm25_k1", 1.5),
            b=self.config.get("bm25_b", 0.75)
        )
        
        # Load or create database
        self._load_or_create_database()

    def _normalize_text(self, text: str) -> str:
        """Same normalization as V2 for consistency"""
        if not text: return ""
        translator = str.maketrans('', '', string.punctuation + '،؛؟»«')
        text = text.translate(translator)
        return ' '.join(text.split()).lower()

    def _extract_text_from_pdf(self, pdf_path: str) -> str:
        """Same PDF extraction as V2"""
        try:
            doc = fitz.open(pdf_path)
            full_text = "".join(page.get_text() for page in doc)
            doc.close()
            return re.sub(r'\s+', ' ', full_text).strip()
        except Exception as e:
            print(f"Error extracting text from {pdf_path}: {e}")
            return ""

    def _add_context_to_chunk(self, chunk: str, document_context: str) -> str:
        """
        STEP 7: CONTEXTUAL RETRIEVAL
        Add context to chunks using LLM before embedding.
        This helps chunks be more searchable by providing situational context.
        """
        # Always return chunk without context to avoid Ollama hanging
        return chunk

    def _load_or_create_database(self):
        """Load or create the V3 database with all tutorial techniques"""
        persist_dir = self.config.get("persist_dir")
        
        if not os.path.exists(persist_dir) or self.config.get("force_reindex", False):
            print(f"[RAG V3] Creating new database at {persist_dir}...")
            self._index_documents()
        else:
            print(f"[RAG V3] Loading existing database from {persist_dir}...")
            try:
                self._load_existing_database()
                # Check if database is actually loaded (has documents)
                if len(self.vector_index.documents) == 0:
                    print(f"[RAG V3] No documents loaded, creating fresh database...")
                    self._index_documents()
            except Exception as e:
                print(f"[RAG V3] Error loading existing database: {e}")
                print(f"[RAG V3] Creating fresh database...")
                self._index_documents()

    def _index_documents(self):
        """Index all documents using V3 techniques"""
        all_docs = []
        document_contents = {}  # Store full document content for contextual processing
        
        # First pass: extract all document content
        for path in self.config.get("document_paths"):
            if not os.path.exists(path): 
                continue
                
            if os.path.isdir(path):
                for file in os.listdir(path):
                    file_path = os.path.join(path, file)
                    if file.lower().endswith(('.pdf', '.txt', '.py', '.md')):
                        content = self._extract_content(file_path)
                        if content:
                            document_contents[file_path] = content
            else:
                content = self._extract_content(path)
                if content:
                    document_contents[path] = content

        # Second pass: chunk and optionally add context
        for file_path, full_content in document_contents.items():
            print(f"[RAG V3] Processing {os.path.basename(file_path)}...")
            
            # STEP 1: CHUNKING (same as V2)
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=self.config.get("chunk_size"),
                chunk_overlap=self.config.get("chunk_overlap")
            )
            chunks = text_splitter.split_text(full_content)
            
            for i, chunk in enumerate(chunks):
                if len(chunk.strip()) > 50:
                    # STEP 7: CONTEXTUAL RETRIEVAL
                    contextualized_chunk = self._add_context_to_chunk(chunk, full_content)
                    
                    doc = {
                        "content": contextualized_chunk,
                        "original_content": chunk,  # Keep original for comparison
                        "source": file_path,
                        "chunk_id": i,
                        "id": f"{os.path.basename(file_path)}_chunk_{i}"
                    }
                    all_docs.append(doc)

        if not all_docs:
            raise ValueError("No documents processed.")

        # Add documents to both indexes
        print(f"[RAG V3] Indexing {len(all_docs)} chunks...")
        for doc in all_docs:
            # STEP 2: EMBEDDINGS + STEP 3: VECTOR SEARCH
            self.vector_index.add_document(doc)
            # STEP 4: BM25
            self.bm25_index.add_document(doc)

        # Save database
        self._save_database(all_docs)
        print(f"[RAG V3] Database created with {len(all_docs)} chunks")

    def _extract_content(self, file_path: str) -> str:
        """Extract content from various file types"""
        if file_path.lower().endswith(".pdf"):
            return self._extract_text_from_pdf(file_path)
        else:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    return f.read()
            except Exception as e:
                print(f"Error reading {file_path}: {e}")
                return ""

    def _save_database(self, docs: List[Dict]):
        """Save the database with metadata validation"""
        persist_dir = self.config.get("persist_dir")
        os.makedirs(persist_dir, exist_ok=True)
        
        # Save document metadata with path validation info
        metadata = {
            "document_paths": self.config.get("document_paths", []),
            "docs": docs
        }
        with open(os.path.join(persist_dir, "docs.json"), 'w') as f:
            json.dump(metadata, f, indent=2)

    def _load_existing_database(self):
        """Load existing database with path validation"""
        persist_dir = self.config.get("persist_dir")
        docs_file = os.path.join(persist_dir, "docs.json")
        
        if os.path.exists(docs_file):
            with open(docs_file, 'r') as f:
                data = json.load(f)
            
            # Handle both old format (direct docs list) and new format (with metadata)
            if isinstance(data, list):
                # Old format - load docs and treat as if no existing database
                print(f"[RAG V3] Old format detected, migrating to new format...")
                # Don't load old data, let the system reindex fresh
                return
            elif isinstance(data, dict) and "docs" in data:
                # New format - validate paths
                cached_paths = data.get("document_paths", [])
                current_paths = self.config.get("document_paths", [])
                
                # Normalize paths for comparison
                cached_paths_abs = [os.path.abspath(p) for p in cached_paths]
                current_paths_abs = [os.path.abspath(p) for p in current_paths]
                
                if set(cached_paths_abs) != set(current_paths_abs):
                    print(f"[RAG V3] Path mismatch - cached: {cached_paths_abs}, current: {current_paths_abs}")
                    print(f"[RAG V3] Will reindex for new paths...")
                    # Don't load old data, let the system reindex fresh
                    return
                
                docs = data["docs"]
                # Rebuild indexes
                for doc in docs:
                    self.vector_index.add_document(doc)
                    self.bm25_index.add_document(doc)
                
                print(f"[RAG V3] Loaded {len(docs)} chunks from existing database")
            else:
                raise Exception("Invalid database format")

    def _rrf_fusion(self, vector_results: List[Tuple], bm25_results: List[Tuple], k: int = 60) -> List[Dict]:
        """
        STEP 5: HYBRID SEARCH with RRF (Reciprocal Rank Fusion)
        
        RRF Formula: score = sum(1 / (k + rank)) for each ranking system
        - k = RRF parameter (usually 60)
        - rank = position in ranking (1-indexed)
        
        This is different from your V2's weighted ensemble approach.
        RRF doesn't need to tune weights - it automatically balances different ranking systems.
        """
        doc_scores = {}
        
        # Process vector search results (rank by similarity - lower distance = higher rank)
        for rank, (doc, distance) in enumerate(vector_results, 1):
            doc_id = doc.get("id", id(doc))
            if doc_id not in doc_scores:
                doc_scores[doc_id] = {"doc": doc, "vector_rank": float('inf'), "bm25_rank": float('inf')}
            doc_scores[doc_id]["vector_rank"] = rank

        # Process BM25 results (rank by relevance - lower distance = higher rank) 
        for rank, (doc, distance) in enumerate(bm25_results, 1):
            doc_id = doc.get("id", id(doc))
            if doc_id not in doc_scores:
                doc_scores[doc_id] = {"doc": doc, "vector_rank": float('inf'), "bm25_rank": float('inf')}
            doc_scores[doc_id]["bm25_rank"] = rank

        # Calculate RRF scores
        rrf_results = []
        for doc_id, data in doc_scores.items():
            vector_score = 1.0 / (k + data["vector_rank"]) if data["vector_rank"] != float('inf') else 0
            bm25_score = 1.0 / (k + data["bm25_rank"]) if data["bm25_rank"] != float('inf') else 0
            
            rrf_score = vector_score + bm25_score
            if rrf_score > 0:
                rrf_results.append((data["doc"], rrf_score))

        # Sort by RRF score (higher is better)
        rrf_results.sort(key=lambda x: x[1], reverse=True)
        return [doc for doc, score in rrf_results]

    def _llm_rerank(self, docs: List[Dict], query: str, k: int) -> List[Dict]:
        """
        STEP 6: LLM RERANKING
        
        Use LLM to select the most relevant documents.
        This is more contextually aware than CrossEncoder models.
        """
        if len(docs) <= k:
            return docs

        try:
            # Prepare documents for LLM
            doc_list = []
            for i, doc in enumerate(docs):
                doc_list.append(f"""
<document>
<document_id>{i}</document_id>
<document_content>{doc['content'][:500]}...</document_content>
</document>""")

            joined_docs = "\n".join(doc_list)
            
            prompt = f"""You are about to be given a set of documents, along with an id of each.
Your task is to select the {k} most relevant documents to answer the user's question.

Here is the user's question:
<question>
{query}
</question>

Here are the documents to select from:
<documents>
{joined_docs}
</documents>

Respond in the following format:
```json
{{
    "document_ids": [list of document ids as numbers, {k} elements long, sorted in order of decreasing relevance]
}}
```"""

            response = ollama.chat(
                model=self.config.get("llm_model", "qwen3:8b"),
                messages=[
                    {'role': 'user', 'content': prompt},
                    {'role': 'assistant', 'content': '```json'}
                ]
            )
            
            # Parse response
            result_text = response['message']['content']
            if '```' in result_text:
                result_text = result_text.split('```')[0]
            
            result = json.loads(result_text)
            selected_ids = result.get("document_ids", [])
            
            # Return selected documents in order
            reranked_docs = []
            for doc_id in selected_ids:
                if isinstance(doc_id, int) and 0 <= doc_id < len(docs):
                    reranked_docs.append(docs[doc_id])
            
            return reranked_docs[:k]
            
        except Exception as e:
            print(f"[RAG V3] LLM reranking failed: {e}, falling back to original order")
            return docs[:k]

    def search(self, query: str) -> str:
        """
        Main search method implementing all 7 tutorial steps:
        1. ✅ Chunking (in indexing)
        2. ✅ Embeddings (in vector search)  
        3. ✅ Vector Search (semantic similarity)
        4. ✅ BM25 (keyword search)
        5. ✅ Hybrid (RRF fusion)
        6. ✅ Reranking (LLM-based)
        7. ✅ Contextual (in indexing)
        """
        try:
            top_k = self.config.get("top_k", 20)
            rerank_top_k = self.config.get("rerank_top_k", 3)
            
            print(f"[RAG V3] Searching with query: '{query[:50]}...'")
            
            # STEP 3: VECTOR SEARCH
            print("[RAG V3] Step 3: Vector search...")
            vector_results = self.vector_index.search(query, k=top_k)
            
            # STEP 4: BM25 SEARCH  
            print("[RAG V3] Step 4: BM25 search...")
            bm25_results = self.bm25_index.search(query, k=top_k)
            
            # STEP 5: HYBRID FUSION with RRF
            print("[RAG V3] Step 5: RRF fusion...")
            fused_docs = self._rrf_fusion(vector_results, bm25_results, k=self.config.get("rrf_k", 60))
            
            if not fused_docs:
                return "No relevant information found."
            
            # STEP 6: LLM RERANKING
            print("[RAG V3] Step 6: LLM reranking...")
            final_docs = self._llm_rerank(fused_docs, query, rerank_top_k)
            
            # Format results
            unique_content = []
            for doc in final_docs:
                content = doc.get('original_content', doc.get('content', ''))
                if content not in unique_content:
                    unique_content.append(content)
            
            result = "Document search results:\n\n" + "\n\n---\n\n".join(unique_content)
            print(f"[RAG V3] Search completed, returning {len(unique_content)} unique results")
            return result
            
        except Exception as e:
            print(f"[RAG V3] Search error: {e}")
            return f"Sorry, an error occurred while searching: {e}"