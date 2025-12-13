import os
from typing import List, Dict, Any
import json

def analyze_media_with_ollama(model: str, paths: List[str]) -> str:
    """
    Send images/videos to a multimodal model via Ollama (e.g., gemma3:4b).
    Returns raw model text; caller decides how to render.
    """
    try:
        import ollama
    except Exception as e:
        return json.dumps({"status": "error", "error": f"ollama not available: {e}"})

    messages = [
        {
            'role': 'user',
            'content': 'Analyze the provided media and describe key details.',
            'images': [p for p in paths if os.path.exists(p)]
        }
    ]
    try:
        resp = ollama.chat(model=model, messages=messages)
        return resp['message']['content']
    except Exception as e:
        return f"Error: {e}"


