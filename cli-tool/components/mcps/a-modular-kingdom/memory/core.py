# mem0_memory.py
import os

import ollama
import chromadb
import uuid
import json
from typing import List, Dict, Optional
import datetime
import re
from rank_bm25 import BM25Okapi

LLM_MODEL = 'qwen3:8b'
COLLECTION_NAME = "agent_memories"
LOG_FILE = "mem0_debug_log.txt"

# --- Helper function for logging to a file ---
def log_message(message: str):
    """Disabled debug logging."""
    pass

class Mem0:
    def __init__(self, chroma_path: str):
        self.chroma_path = chroma_path
        if not os.path.exists(self.chroma_path):
            os.makedirs(self.chroma_path)
        # In-memory BM25 index state
        self._bm25_docs: List[List[str]] = []
        self._bm25_ids: List[str] = []
        self._bm25: Optional[BM25Okapi] = None
        self._bm25_dirty: bool = True

    def _get_client_and_collection(self):
        client = chromadb.PersistentClient(path=self.chroma_path)
        collection = client.get_or_create_collection(name=COLLECTION_NAME)
        return client, collection

    def _execute_operation(self, operation: str, fact: str, memory_id: str = None):
        log_message(f"DEBUG: Executing DB operation: Op='{operation}', Fact='{fact}', ID='{memory_id}'")
        try:
            client, collection = self._get_client_and_collection()
            if operation == 'ADD':
                new_id = str(uuid.uuid4())
                collection.add(ids=[new_id], documents=[fact])
                log_message(f"[Mem0] HOST ACTION: ADDED new memory. ID: {new_id[:8]}")
                self._bm25_dirty = True
            elif operation == 'UPDATE' and memory_id:
                log_message(f"DEBUG: Calling ChromaDB update with ID: {memory_id} and Document: {fact}")
                collection.update(ids=[memory_id], documents=[fact])
                log_message(f"[Mem0] HOST ACTION: UPDATED memory. ID: {memory_id[:8]}")
                self._bm25_dirty = True
            elif operation == 'UPDATE' and not memory_id:
                log_message(f"[Mem0] HOST ERROR: UPDATE operation called but memory_id is None.")
        except Exception as e:
            log_message(f"[Mem0] HOST ERROR during DB operation: {e}")

    def _decide_memory_operation(self, fact: str, similar_memories: List[Dict]) -> Dict:
        if not similar_memories:
            log_message("[Mem0] No similar memories found. Defaulting to ADD.")
            return {"operation": "ADD", "fact": fact}
        
        similar_memories_str = "\n".join([f"- ID: {mem['id']}, Fact: {mem['content']}" for mem in similar_memories])

        prompt = f"""You are a memory consolidation system. Your goal is to maintain a concise and accurate fact store.

Follow these rules:
1. A correction (e.g., 'no, it's a DSL button') should ALWAYS be an UPDATE.
2. If the "New Fact" is semantically identical or redundant to an "Existing Memory", you MUST use the "NOOP" operation. Do not add duplicate information.

Based on the 'New Fact', decide if it should be added as a new memory, update an existing one, or be ignored.

Existing Memories:
{similar_memories_str}

New Fact: "{fact}"

Your decision MUST be a single JSON object with either:
1. {{"operation": "ADD", "fact": "the new fact to add"}}
2. {{"operation": "UPDATE", "memory_id": "the id of the memory to update", "updated_fact": "the new, corrected fact"}}
3. {{"operation": "NOOP", "reason": "why no action is needed"}}

Decision:"""
        try:
            # --- DIAGNOSTIC LOG 1 ---
            log_message(f"DEBUG: Prompt sent to LLM:\n---\n{prompt}\n---")

            response = ollama.chat(model=LLM_MODEL, messages=[{'role': 'user', 'content': prompt}], format='json')
            raw_response_content = response['message']['content']

            # --- DIAGNOSTIC LOG 2 ---
            log_message(f"DEBUG: Raw LLM Response content:\n---\n{raw_response_content}\n---")

            decision = json.loads(raw_response_content)
            
            # --- DIAGNOSTIC LOG 3 ---
            log_message(f"DEBUG: Parsed Decision:\n---\n{json.dumps(decision, indent=2)}\n---")

            return decision
        except (json.JSONDecodeError, KeyError, Exception) as e:
            log_message(f"HOST ERROR: Could not get valid decision from LLM: {e}")
            raw_content_for_error = "not available"
            if 'raw_response_content' in locals():
                raw_content_for_error = raw_response_content
            log_message(f"HOST ERROR DETAILS: Failed to parse this content: {raw_content_for_error}")
            return {"operation": "ADD", "fact": fact}

    def _extract_facts(self, conversation: str) -> List[str]:
        log_message(f"DEBUG: Extracting facts from:\n---\n{conversation}\n---")
        prompt = f"""You are a hyper-critical fact extractor. Your job is to extract only the most essential, enduring facts from a conversation.

Follow these rules STRICTLY:
1.  A fact MUST be a definitive statement of truth (e.g., "The user's car is red," "There is no DNS button on the modem").
2.  A fact MUST be a correction of a previous misunderstanding.
3.  A fact MUST be a core user preference (e.g., "The user is a vegetarian").
4.  IGNORE conversational filler, greetings, questions, or uncertainties (e.g., "I think...", "Maybe...", "Hello", "How are you?").
5.  The fact must be self-contained and understandable on its own.

Return a JSON object with a single key "facts" containing a list of strings. If no essential facts are found, return an empty list.

Conversation:
{conversation}

JSON Output:"""
        try:
            response = ollama.chat(model=LLM_MODEL, messages=[{'role': 'user', 'content': prompt}], format='json')
            raw_response_content = response['message']['content']
            log_message(f"DEBUG: Raw fact extraction response:\n---\n{raw_response_content}\n---")
            data = json.loads(raw_response_content)
            return data.get("facts", [])
        except (json.JSONDecodeError, KeyError, Exception) as e:
            log_message(f"HOST ERROR: Could not extract facts from LLM: {e}")
            return []

    # --- BM25 helpers and direct operations ---
    def _tokenize(self, text: str) -> List[str]:
        text = (text or "").lower()
        return [tok for tok in re.split(r"[^a-z0-9]+", text) if tok]

    def _rebuild_bm25(self):
        try:
            client, collection = self._get_client_and_collection()
            results = collection.get(include=['documents'])
            ids = results.get('ids') or []
            docs = results.get('documents') or []
            tokenized = [self._tokenize(d or "") for d in docs]
            self._bm25_ids = ids
            self._bm25_docs = tokenized
            self._bm25 = BM25Okapi(tokenized) if tokenized else None
            self._bm25_dirty = False
        except Exception as e:
            log_message(f"[Mem0] ERROR rebuilding BM25: {e}")
            self._bm25 = None
            self._bm25_docs = []
            self._bm25_ids = []
            self._bm25_dirty = True

    def direct_add(self, content: str, metadata: Optional[Dict] = None) -> str:
        client, collection = self._get_client_and_collection()
        new_id = str(uuid.uuid4())
        collection.add(ids=[new_id], documents=[content], metadatas=[metadata] if metadata else None)
        self._bm25_dirty = True
        return new_id

    def direct_delete(self, memory_id: str) -> None:
        client, collection = self._get_client_and_collection()
        collection.delete(ids=[memory_id])
        self._bm25_dirty = True

    def add(self, conversation: str):
        log_message(f"Processing conversation: '{conversation}'")
        
        # Step 1: Extract facts from the conversation
        facts = self._extract_facts(conversation)
        if not facts:
            log_message("No facts extracted. Nothing to add to memory.")
            return

        log_message(f"Extracted facts: {facts}")

        # Step 2: For each fact, decide whether to ADD, UPDATE, or NOOP
        for fact in facts:
            log_message(f"Processing fact: '{fact}'")
            similar_docs = self.search(query=fact, k=3)
            decision = self._decide_memory_operation(fact, similar_docs)
            log_message(f"LLM Decision for fact '{fact}': {decision}")
            
            op = decision.get("operation")
            if op == "ADD":
                self._execute_operation("ADD", decision.get("fact", fact))
            elif op == "UPDATE":
                self._execute_operation("UPDATE", decision.get("updated_fact"), decision.get("memory_id"))
            else:
                log_message(f"HOST ACTION: NOOP for fact '{fact}'. Reason: {decision.get('reason')}")

    def search(self, query: str, k: int = 3) -> List[Dict]:
        # Try BM25 first for speed and lexical robustness
        try:
            if self._bm25_dirty or self._bm25 is None:
                self._rebuild_bm25()
            if self._bm25 is not None and self._bm25_docs:
                q_tokens = self._tokenize(query)
                scores = self._bm25.get_scores(q_tokens)
                ranked = sorted(enumerate(scores), key=lambda x: x[1], reverse=True)
                top = ranked[:k]
                client, collection = self._get_client_and_collection()
                formatted_results: List[Dict] = []
                for idx, _ in top:
                    doc_id = self._bm25_ids[idx]
                    got = collection.get(ids=[doc_id], include=['documents', 'metadatas'])
                    if got.get('documents'):
                        formatted_results.append({
                            "id": doc_id,
                            "content": got['documents'][0],
                            "metadata": got.get('metadatas', [None])[0] or {}
                        })
                return formatted_results
        except Exception as e:
            log_message(f"HOST ERROR during BM25 search: {e}")

        # Fallback to vector similarity via Chroma
        try:
            client, collection = self._get_client_and_collection()
            results = collection.query(query_texts=[query], n_results=k, include=['documents', 'metadatas'])
            formatted_results = []
            if results.get('ids') and results['ids'][0]:
                for i, doc_id in enumerate(results['ids'][0]):
                    formatted_results.append({
                        "id": doc_id,
                        "content": results['documents'][0][i],
                        "metadata": results['metadatas'][0][i] if results['metadatas'] and results['metadatas'][0] else {}
                    })
            return formatted_results
        except Exception as e:
            log_message(f"HOST ERROR during vector search: {e}")
            return []

    def get_all_memories(self) -> List[Dict]:
        """Retrieves all memories from the database."""
        try:
            client, collection = self._get_client_and_collection()
            results = collection.get(include=['documents', 'metadatas'])
            
            formatted_results = []
            if results.get('ids'):
                for i, doc_id in enumerate(results['ids']):
                    formatted_results.append({
                        "id": doc_id,
                        "content": results['documents'][i],
                        "metadata": results['metadatas'][i] if results['metadatas'] else {}
                    })
            log_message(f"Retrieved {len(formatted_results)} memories from the database.")
            return formatted_results
        except Exception as e:
            log_message(f"HOST ERROR during get_all_memories: {e}")
            return []
