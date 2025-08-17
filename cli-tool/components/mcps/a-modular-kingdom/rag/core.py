import os
import re # Stands for Regular Expressions. It's a powerful tool for finding and replacing patterns in text. We use it to clean up messy spaces.
import string # A simple library that contains common strings, like all punctuation marks (string.punctuation).
import fitz  # PyMuPDF: To read PDF file.
import numpy as np
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import SentenceTransformerEmbeddings #Because SentenceTransformerEmbeddings process each sentence at once, unlike older embedding systems.
from langchain_core.documents import Document
from langchain_community.retrievers import BM25Retriever
from langchain.retrievers import EnsembleRetriever
from langchain.text_splitter import RecursiveCharacterTextSplitter #It's used in chunks = text_splitter.split_text(text), to create chunks!

class RAGPipeline:
    def __init__(self, config: dict):
        self.config = config
        self.embed_model_name = self.config.get("embed_model") #my_dict.get('key') gets the value for just one key.
        self.persist_dir = self.config.get("persist_dir")
        self.document_paths = self.config.get("document_paths")
        self.chunk_size = self.config.get("chunk_size", 400)
        self.chunk_overlap = self.config.get("chunk_overlap", 150)
        self.embeddings = SentenceTransformerEmbeddings(model_name=self.embed_model_name)
        self.vector_db = self._load_or_create_database()

    #This is a fast way to remove all punctuation
    def _normalize_text(self, text: str) -> str: # -> str: This is a "type hint." It's a label that tells other programmers that this function is expected to return a string.
        if not text: return "" # A safety check. If an empty piece of text is accidentally sent to the function, it just returns an empty string instead of crashing.
        translator = str.maketrans('', '', string.punctuation + '،؛؟»«')
        text = text.translate(translator)
        return ' '.join(text.split()).lower()

    def _extract_text_from_pdf(self, pdf_path: str) -> str:
        try:
            doc = fitz.open(pdf_path)
            full_text = "".join(page.get_text() for page in doc)
            doc.close() # This tells the operating system that you are finished with the file, releasing it from memory. It's good practice, like hanging up the phone.
            return re.sub(r'\s+', ' ', full_text).strip() # It's cleaning the text. The r'\s+' is a regular expression that means "find one or more whitespace characters (spaces, newlines, tabs)" and replace them with a single space ' '.
        except Exception as e:
            print(f"Error extracting text from {pdf_path}: {e}")
            return ""

    def _load_or_create_database(self) -> Chroma:
        if not os.path.exists(self.persist_dir) or self.config.get("force_reindex", False):
            print(f"Creating new vector database at {self.persist_dir}...")
            all_docs = []
            for path in self.document_paths:
                if not os.path.exists(path):
                    print(f"Warning: Document path not found: {path}")
                    continue
                
                if os.path.isdir(path):
                    for file in os.listdir(path):
                        file_path = os.path.join(path, file)
                        if file.lower().endswith(('.pdf', '.txt', '.py', '.md')):
                            text = self._extract_text_from_pdf(file_path) if file.lower().endswith(".pdf") else open(file_path, 'r', encoding='utf-8').read()
                            if text:
                                text_splitter = RecursiveCharacterTextSplitter(
                                    chunk_size=self.chunk_size,
                                    chunk_overlap=self.chunk_overlap,
                                    separators=["\n\n", "\n", ". ", "،", " ", ""]
                                )
                                chunks = text_splitter.split_text(text)
                                for i, chunk in enumerate(chunks):
                                    if len(chunk.strip()) > 50:
                                        all_docs.append(Document(page_content=chunk, metadata={"source": file_path, "chunk_id": i}))
                else:
                    text = ""
                    if path.lower().endswith(".pdf"):
                        text = self._extract_text_from_pdf(path)
                    else:
                        with open(path, 'r', encoding='utf-8') as f:
                            text = f.read()

                    if not text: continue

                    text_splitter = RecursiveCharacterTextSplitter(
                        chunk_size=self.chunk_size,
                        chunk_overlap=self.chunk_overlap,
                        separators=["\n\n", "\n", ". ", "،", " ", ""]
                    )
                    chunks = text_splitter.split_text(text)
                    for i, chunk in enumerate(chunks):
                        if len(chunk.strip()) > 50:
                            all_docs.append(Document(page_content=chunk, metadata={"source": path, "chunk_id": i}))

            if not all_docs:
                raise ValueError("No documents were processed. Cannot create a database.")

            vector_db = Chroma.from_documents(
                documents=all_docs,
                embedding=self.embeddings,
                persist_directory=self.persist_dir
            )
            vector_db.persist()
            return vector_db
        else:
            print(f"Loading existing vector database from {self.persist_dir}...")
            return Chroma(persist_directory=self.persist_dir, embedding_function=self.embeddings)

    def search(self, query: str) -> str:
        top_k = self.config.get("top_k", 5)
        ensemble_weights = self.config.get("ensemble_weights", [0.7, 0.3])

        vector_retriever = self.vector_db.as_retriever(
            search_type="mmr",
            search_kwargs={"k": top_k}
        )

        all_db_docs = self.vector_db.get(include=["metadatas", "documents"])
        docs_for_bm25 = [Document(page_content=doc, metadata=meta) for doc, meta in zip(all_db_docs['documents'], all_db_docs['metadatas'])]

        if not docs_for_bm25:
            return "Knowledge base is empty."

        bm25_retriever = BM25Retriever.from_documents(docs_for_bm25)
        bm25_retriever.k = top_k

        ensemble_retriever = EnsembleRetriever(
            retrievers=[vector_retriever, bm25_retriever],
            weights=ensemble_weights
        )

        results = ensemble_retriever.get_relevant_documents(query)

        if not results:
            return "No relevant information found for your query."

        unique_results = list({doc.page_content for doc in results})
        return "Document search results:\n\n" + "\n\n---\n\n".join(unique_results)
