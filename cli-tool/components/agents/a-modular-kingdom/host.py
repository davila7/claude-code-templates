#!/usr/bin/env python
# coding: utf-8
import os
import sys
import warnings
import logging

# Configure logging to prevent contamination of stdout when running as MCP server
logging.basicConfig(level=logging.WARNING, stream=sys.stderr)
warnings.filterwarnings("ignore")

# Silence specific noisy loggers that might write to stdout
for logger_name in ['httpx', 'httpcore', 'urllib3', 'requests', 'chromadb', 'sentence_transformers', 'transformers', 'huggingface_hub']:
    logging.getLogger(logger_name).setLevel(logging.WARNING)

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)
import json
from typing import Dict, List, Optional
from mcp.server.fastmcp import FastMCP
from pydantic import Field
from memory.core import Mem0
from rag.fetch_2 import fetchExternalKnowledge
from rag.fetch_3 import fetchExternalKnowledge as fetch_3
from tools.web_search import perform_web_search
from tools.browser_agent import browse_web
from tools.code_exec import run_code
from tools.vision import analyze_media_with_ollama
from tools.tts import text_to_speech, list_tts_voices
from tools.stt import speech_to_text, list_stt_models
import glob

mcp = FastMCP("unified_knowledge_agent_host")
memory_database = None

try:
    chroma_path = os.path.join(project_root, "agent_chroma_db")
    memory_database = Mem0(chroma_path=chroma_path)
except Exception as e:
    sys.stderr.write(f"[HOST] WARNING: MemoryDB disabled: {e}\n")
    memory_database = None

@mcp.tool(
    name="save_fact",
    description="Save structured facts to the memory system with automatic processing and fact extraction from the provided content"
)
def save_fact(
    fact_data: Dict = Field(description="Dictionary containing 'content' key with the fact to save")
) -> str:
    if memory_database is None:
        return json.dumps({"error": "MemoryDB is not initialized on the host."})
    try:
        content_to_save = fact_data.get('content')
        if not content_to_save:
            return json.dumps({"error": "No 'content' field in fact JSON."})
        memory_database.add(content_to_save)
        return json.dumps({"status": "success", "message": f"Fact sent to processing: '{content_to_save}'"})
    except Exception as e:
        return json.dumps({"error": f"Error saving fact on host: {str(e)}"})

@mcp.tool(
    name="save_memory",
    description="Save content directly to the personal memory system for future reference and retrieval"
)
def save_direct_memory(
    content: str = Field(description="The text content to save to memory")
) -> str:
    """Save content directly to memory without fact extraction."""
    if memory_database is None:
        return json.dumps({"error": "MemoryDB is not initialized on the host."})
    try:
        new_id = memory_database.direct_add(content)
        return json.dumps({"status": "success", "message": f"Content saved directly to memory: '{content[:50]}...'", "id": new_id})
    except Exception as e:
        return json.dumps({"error": f"Error saving direct memory on host: {str(e)}"})

@mcp.tool(
    name="delete_memory",
    description="Delete a specific memory from the memory system using its unique identifier"
)
def delete_memory(
    memory_id: str = Field(description="The unique ID of the memory to delete")
) -> str:
    """Delete a memory by its ID."""
    if memory_database is None:
        return json.dumps({"error": "MemoryDB is not initialized on the host."})
    try:
        memory_database.direct_delete(memory_id)
        return json.dumps({"status": "success", "message": f"Memory {memory_id} deleted successfully"})
    except Exception as e:
        return json.dumps({"error": f"Error deleting memory on host: {str(e)}"})

@mcp.tool(
    name="search_memories",
    description="Search through saved memories using semantic similarity to find relevant stored information"
)
def search_memories(
    query: str = Field(description="The search query to find relevant memories"),
    top_k: int = Field(default=3, description="Number of top matching memories to return")
) -> str:
    if memory_database is None:
        return json.dumps([{"error": "MemoryDB not initialized on the host."}] )
    try:
        results = memory_database.search(query, k=top_k)
        return json.dumps([{"content": res["content"]} for res in results])
    except Exception as e:
        return json.dumps([{"error": f"Error searching memories on host: {str(e)}"}])

@mcp.tool(
    name="query_knowledge_base",
    description="Search external documents and knowledge base using the RAG system to find relevant information from stored documents"
)
def query_knowledge_base(
    query: str = Field(description="The search query to find relevant information in the knowledge base"),
    doc_path: Optional[str] = Field(default=None, description="Optional absolute or relative path to a project-specific documents directory"),
    rag_version: str = Field(default="v2", description="RAG version to use: v1, v2, or v3")
) -> str:
    """A tool to query the external knowledge base (RAG system)."""
    import sys
    sys.stderr.write(f"[HOST] RAG {rag_version} tool called with: {query[:20]}...\n")
    sys.stderr.flush()
    try:
        sys.stderr.write(f"[HOST] About to call RAG {rag_version}\n")
        sys.stderr.flush()
        
        # Import the appropriate RAG version
        if rag_version == "v1":
            from rag.fetch import fetchExternalKnowledge as fetch_func
        elif rag_version == "v3":
            fetch_func = fetch_3
        else:  # v2 is default
            from rag.fetch_2 import fetchExternalKnowledge as fetch_func
        
        # Always use current directory unless explicitly specified
        if doc_path is None:
            final_path = os.getcwd()
            sys.stderr.write(f"[HOST] Using current directory: {final_path}\n")
        else:
            final_path = doc_path
            sys.stderr.write(f"[HOST] Using specified path: {final_path}\n")
        
        sys.stderr.flush()
        results = fetch_func(query, doc_path=final_path)
        sys.stderr.write(f"[HOST] RAG {rag_version} returned {len(results)} chars\n")
        sys.stderr.flush()
        return json.dumps({"result": results, "version": rag_version})
    except Exception as e:
        sys.stderr.write(f"[HOST] RAG {rag_version} error: {e}\n")
        sys.stderr.flush()
        return json.dumps({"error": f"Error querying knowledge base on host: {str(e)}"})

@mcp.tool(
    name="list_all_memories",
    description="Retrieve and list all saved memories from the memory system for review and management"
)
def list_all_memories() -> str:
    """A tool to inspect the contents of the memory database."""
    if memory_database is None:
        return json.dumps([{"error": "MemoryDB not initialized on the host."}])
    try:
        all_mems = memory_database.get_all_memories()
        return json.dumps(all_mems)
    except Exception as e:
        return json.dumps([{"error": f"Error listing memories on host: {str(e)}"}])

@mcp.tool(
    name="web_search",
    description="Perform a web search to find current information that may not be available in local memory or knowledge base"
)
def web_search(
    query: str = Field(description="The search query to look up on the web")
) -> str:
    """A tool to perform a web search using the Google Search API."""
    try:
        results = perform_web_search(query)
        return results
    except Exception as e:
        return json.dumps({"error": f"Error performing web search on host: {str(e)}"})

 

@mcp.tool(
    name="browser_automation",
    description="Perform automated browser tasks using natural language instructions."
)
def browser_automation(
    task: str = Field(description="Natural language description of the browser task to perform"),
    headless: bool = Field(default=True, description="Whether to run browser in headless mode (default: True)")
) -> str:
    try:
        import asyncio as _asyncio
        return _asyncio.run(browse_web(task, headless))
    except Exception as e:
        return json.dumps({"status": "error", "error": str(e)})

@mcp.tool(
    name="code_execute",
    description="Execute Python code in a sandboxed subprocess and return stdout/stderr"
)
def code_execute(
    code: str = Field(description="Python code to execute"),
    timeout_seconds: int = Field(default=15, description="Execution timeout in seconds")
) -> str:
    try:
        return run_code(code=code, timeout_seconds=timeout_seconds)
    except Exception as e:
        return json.dumps({"status": "error", "error": str(e)})

@mcp.tool(
    name="analyze_media",
    description="Analyze image/video files with a local multimodal model via Ollama (e.g., gemma3:4b)"
)
def analyze_media(
    model: str = Field(default="gemma3:4b", description="Ollama model id to use"),
    paths: list[str] = Field(description="List of absolute file paths to media files")
) -> str:
    try:
        return analyze_media_with_ollama(model=model, paths=paths)
    except Exception as e:
        return json.dumps({"status": "error", "error": str(e)})

# --- RESOURCES for @ functionality ---
@mcp.resource("docs://documents", mime_type="application/json")  
def list_documents() -> str:
    """Returns list of available document IDs for @ mentions."""
    try:
        files_dir = os.path.join(project_root, "rag", "files")
        if not os.path.exists(files_dir):
            return json.dumps([])
        
        pattern = os.path.join(files_dir, "*")
        files = glob.glob(pattern)
        doc_ids = [os.path.basename(f) for f in files if os.path.isfile(f)]
        
        return json.dumps(doc_ids)
    except Exception as e:
        return json.dumps([])

@mcp.resource("docs://documents/{doc_id}", mime_type="text/plain")
def get_document_content(doc_id: str) -> str:
    """Returns the content of a specific document."""
    try:
        files_dir = os.path.join(project_root, "rag", "files")
        file_path = os.path.join(files_dir, doc_id)
        
        if not os.path.exists(file_path):
            raise ValueError(f"Document {doc_id} not found")
        
        if doc_id.lower().endswith('.pdf'):
            import fitz
            doc = fitz.open(file_path)
            text = "".join(page.get_text() for page in doc)
            doc.close()
            return text
        else:
            with open(file_path, 'r', encoding='utf-8') as f:
                return f.read()
    except Exception as e:
        return f"Error: Could not retrieve content for {doc_id}: {str(e)}"

@mcp.tool(
    name="text_to_speech",
    description="Convert text to speech using various TTS engines. Can play audio directly or save to file."
)
def tts_tool(
    text: str = Field(description="Text to convert to speech"),
    engine: str = Field(default="pyttsx3", description="TTS engine to use: pyttsx3, gtts, or kokoro"),
    voice: str = Field(default="", description="Voice name/ID to use (engine-specific)"),
    speed: float = Field(default=200, description="Speech rate for pyttsx3"),
    play_audio: bool = Field(default=True, description="Whether to play audio immediately")
) -> str:
    """Convert text to speech and optionally play it."""
    try:
        kwargs = {
            "engine": engine,
            "speed": speed,
            "play_audio": play_audio
        }
        if voice:
            kwargs["voice"] = voice
            
        return text_to_speech(text, **kwargs)
    except Exception as e:
        return json.dumps({"success": False, "error": str(e)})

@mcp.tool(
    name="speech_to_text", 
    description="Convert speech to text using microphone recording or existing audio file"
)
def stt_tool(
    duration: int = Field(default=5, description="Recording duration in seconds (ignored if file_path provided)"),
    engine: str = Field(default="whisper", description="STT engine: whisper or speech_recognition"),
    model: str = Field(default="base", description="Model size for Whisper: tiny, base, small, medium, large"),
    language: str = Field(default="", description="Language code (e.g., en, es, fr)"),
    file_path: str = Field(default="", description="Path to existing audio file to transcribe")
) -> str:
    """Record audio and convert it to text, or transcribe an existing audio file."""
    try:
        kwargs = {
            "duration": duration,
            "engine": engine,
            "model": model
        }
        if language:
            kwargs["language"] = language
        if file_path:
            kwargs["file_path"] = file_path
            
        return speech_to_text(**kwargs)
    except Exception as e:
        return json.dumps({"success": False, "error": str(e)})

@mcp.tool(
    name="list_tts_voices",
    description="List available voices for text-to-speech engines"
)
def list_voices_tool(
    engine: str = Field(default="pyttsx3", description="TTS engine to query for available voices")
) -> str:
    """List available voices for the specified TTS engine."""
    try:
        return list_tts_voices(engine)
    except Exception as e:
        return json.dumps({"success": False, "error": str(e)})

@mcp.tool(
    name="list_stt_models",
    description="List available models and languages for speech-to-text engines"
)
def list_models_tool() -> str:
    """List available STT models and supported languages."""
    try:
        return list_stt_models()
    except Exception as e:
        return json.dumps({"success": False, "error": str(e)})

mcp.run(transport='stdio')
