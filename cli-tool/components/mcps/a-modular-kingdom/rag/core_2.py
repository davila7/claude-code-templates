import os, re, string, fitz
from sentence_transformers import CrossEncoder
from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import SentenceTransformerEmbeddings
from langchain_core.documents import Document
from langchain_community.retrievers import BM25Retriever
from langchain.retrievers import EnsembleRetriever
from langchain.text_splitter import RecursiveCharacterTextSplitter

class RAGPipeline:
    def __init__(self, config: dict):
        self.config = config
        self.embeddings = SentenceTransformerEmbeddings(model_name=self.config.get("embed_model"))
        self.reranker = CrossEncoder(self.config.get("reranker_model"))
        self.vector_db = self._load_or_create_database()

    def _normalize_text(self, text: str) -> str:
        if not text: return ""
        translator = str.maketrans('', '', string.punctuation + '،؛؟»«')
        text = text.translate(translator)
        return ' '.join(text.split()).lower()

    def _extract_text_from_pdf(self, pdf_path: str) -> str:
        try:
            doc = fitz.open(pdf_path)
            full_text = "".join(page.get_text() for page in doc)
            doc.close()
            return re.sub(r'\s+', ' ', full_text).strip()
        except Exception as e:
            print(f"Error extracting text from {pdf_path}: {e}")
            return ""

    def _load_or_create_database(self) -> FAISS:
        persist_dir = self.config.get("persist_dir")
        if not os.path.exists(persist_dir) or self.config.get("force_reindex", False):
            print(f"Creating new FAISS database at {persist_dir}...")
            all_docs = []
            for path in self.config.get("document_paths"):
                if not os.path.exists(path): continue
                if os.path.isdir(path):
                    for file in os.listdir(path):
                        file_path = os.path.join(path, file)
                        if file.lower().endswith(('.pdf', '.txt', '.py', '.md')):
                            text = self._extract_text_from_pdf(file_path) if file.lower().endswith(".pdf") else open(file_path, 'r', encoding='utf-8').read()
                            if text:
                                text_splitter = RecursiveCharacterTextSplitter(chunk_size=self.config.get("chunk_size"), chunk_overlap=self.config.get("chunk_overlap"))
                                chunks = text_splitter.split_text(text)
                                for i, chunk in enumerate(chunks):
                                    if len(chunk.strip()) > 50:
                                        all_docs.append(Document(page_content=chunk, metadata={"source": file_path, "chunk_id": i}))
                else:
                    text = self._extract_text_from_pdf(path) if path.lower().endswith(".pdf") else open(path, 'r', encoding='utf-8').read()
                    if not text: continue
                text_splitter = RecursiveCharacterTextSplitter(chunk_size=self.config.get("chunk_size"), chunk_overlap=self.config.get("chunk_overlap"))
                chunks = text_splitter.split_text(text)
                for i, chunk in enumerate(chunks):
                    if len(chunk.strip()) > 50:
                        all_docs.append(Document(page_content=chunk, metadata={"source": path, "chunk_id": i}))
            if not all_docs: raise ValueError("No documents processed.")
            vector_db = FAISS.from_documents(all_docs, self.embeddings)
            vector_db.save_local(persist_dir)
            return vector_db
        else:
            print(f"Loading existing FAISS database from {persist_dir}...")
            return FAISS.load_local(persist_dir, self.embeddings, allow_dangerous_deserialization=True)

    def search(self, query: str) -> str:
        top_k = self.config.get("top_k", 5)
        vector_retriever = self.vector_db.as_retriever(search_kwargs={"k": top_k})
        docs_for_bm25 = [Document(page_content=doc.page_content, metadata=doc.metadata) for doc in self.vector_db.docstore._dict.values()]
        bm25_retriever = BM25Retriever.from_documents(docs_for_bm25)
        bm25_retriever.k = top_k
        ensemble_retriever = EnsembleRetriever(retrievers=[vector_retriever, bm25_retriever], weights=self.config.get("ensemble_weights"))
        initial_results = ensemble_retriever.get_relevant_documents(query)
        if not initial_results:
            return "No relevant information found."
        print(f"Re-ranking {len(initial_results)} initial results...")
        rerank_top_k = self.config.get("rerank_top_k", 3)
        pairs = [[query, doc.page_content] for doc in initial_results]
        scores = self.reranker.predict(pairs)
        scored_results = zip(scores, initial_results)
        sorted_results = sorted(scored_results, key=lambda x: x[0], reverse=True)
        final_results = [doc for score, doc in sorted_results[:rerank_top_k]]
        unique_content = list({doc.page_content for doc in final_results})
        return "Document search results:\n\n" + "\n\n---\n\n".join(unique_content)
