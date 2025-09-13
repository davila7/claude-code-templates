#!/usr/bin/env python3
"""
Speech-to-Text Tool for A-Modular-Kingdom
CLI-compatible audio input and transcription
"""

import os
import tempfile
import subprocess
import json
import time
from pathlib import Path
from typing import Optional, Literal, Union
import threading
import queue

def clear_proxy_settings():
    """Clear proxy settings for STT operations"""
    for var in ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"]:
        if var in os.environ:
            del os.environ[var]

clear_proxy_settings()

class STTEngine:
    """Speech-to-Text engine with multiple backend support"""
    
    def __init__(self):
        self.temp_dir = Path(tempfile.gettempdir()) / "amk_stt"
        self.temp_dir.mkdir(exist_ok=True)
        self.recording = False
        
    def record_and_transcribe(
        self,
        duration: int = 5,
        engine: Literal["whisper", "speech_recognition"] = "whisper",
        model: str = "base",
        language: Optional[str] = None,
        auto_start: bool = True
    ) -> dict:
        """
        Record audio and transcribe it to text
        
        Args:
            duration: Recording duration in seconds (0 for manual stop)
            engine: STT engine to use ("whisper", "speech_recognition")  
            model: Model size for Whisper ("tiny", "base", "small", "medium", "large")
            language: Language code (e.g., "en", "es", "fr")
            auto_start: Start recording automatically
            
        Returns:
            dict with transcription result and metadata
        """
        try:
            # Record audio
            audio_path = self._record_audio(duration, auto_start)
            if not audio_path:
                return {"success": False, "error": "Recording failed"}
            
            # Transcribe based on engine
            if engine == "whisper":
                return self._whisper_transcribe(audio_path, model, language)
            elif engine == "speech_recognition":
                return self._sr_transcribe(audio_path, language)
            else:
                return {"success": False, "error": f"Unknown engine: {engine}"}
                
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def transcribe_file(
        self,
        file_path: str,
        engine: Literal["whisper", "speech_recognition"] = "whisper",
        model: str = "base", 
        language: Optional[str] = None
    ) -> dict:
        """
        Transcribe an existing audio file
        
        Args:
            file_path: Path to audio file
            engine: STT engine to use
            model: Model size for Whisper
            language: Language code
            
        Returns:
            dict with transcription result
        """
        try:
            if not os.path.exists(file_path):
                return {"success": False, "error": f"File not found: {file_path}"}
            
            if engine == "whisper":
                return self._whisper_transcribe(file_path, model, language)
            elif engine == "speech_recognition":
                return self._sr_transcribe(file_path, language)
            else:
                return {"success": False, "error": f"Unknown engine: {engine}"}
                
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def _record_audio(self, duration: int, auto_start: bool) -> Optional[str]:
        """Record audio using system tools"""
        output_path = self.temp_dir / f"recording_{int(time.time())}.wav"
        
        try:
            if auto_start:
                print(f"🎤 Recording for {duration} seconds... Speak now!")
            else:
                print("🎤 Press Enter to start recording...")
                input()
                print(f"🎤 Recording for {duration} seconds... Speak now!")
            
            # Use arecord on Linux
            if os.name == 'posix':
                cmd = [
                    "arecord",
                    "-f", "cd",  # CD quality
                    "-t", "wav",
                    "-d", str(duration),
                    str(output_path)
                ]
                
                result = subprocess.run(cmd, capture_output=True, text=True)
                
                if result.returncode != 0:
                    print(f"Recording error: {result.stderr}")
                    return None
                    
            # Use PowerShell on Windows (fallback)
            elif os.name == 'nt':
                # This is a basic fallback - you might want to use a better solution
                print("Windows recording not fully implemented - please use an audio file")
                return None
                
            if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
                print(f"✅ Recording saved: {output_path}")
                return str(output_path)
            else:
                print("❌ Recording failed - no audio captured")
                return None
                
        except Exception as e:
            print(f"❌ Recording error: {e}")
            return None
    
    def _whisper_transcribe(self, audio_path: str, model: str, language: Optional[str]) -> dict:
        """Transcribe using OpenAI Whisper"""
        try:
            import whisper
            
            # Load model
            whisper_model = whisper.load_model(model)
            
            # Transcribe
            options = {}
            if language:
                options['language'] = language
                
            result = whisper_model.transcribe(audio_path, **options)
            
            return {
                "success": True,
                "text": result["text"].strip(),
                "language": result.get("language", "unknown"),
                "engine": "whisper",
                "model": model,
                "confidence": None,  # Whisper doesn't provide confidence scores
                "segments": result.get("segments", [])
            }
            
        except ImportError:
            return {"success": False, "error": "Whisper not installed. Install with: pip install openai-whisper"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def _sr_transcribe(self, audio_path: str, language: Optional[str]) -> dict:
        """Transcribe using SpeechRecognition library"""
        try:
            import speech_recognition as sr
            
            recognizer = sr.Recognizer()
            
            # Load audio file
            with sr.AudioFile(audio_path) as source:
                audio = recognizer.record(source)
            
            # Recognize using Google Web Speech API
            lang_code = language or "en-US"
            text = recognizer.recognize_google(audio, language=lang_code)
            
            return {
                "success": True,
                "text": text,
                "language": lang_code,
                "engine": "speech_recognition",
                "confidence": None
            }
            
        except ImportError:
            return {"success": False, "error": "SpeechRecognition not installed. Install with: pip install SpeechRecognition"}
        except sr.UnknownValueError:
            return {"success": False, "error": "Could not understand audio"}
        except sr.RequestError as e:
            return {"success": False, "error": f"Could not request results: {e}"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def start_live_transcription(
        self,
        engine: Literal["whisper", "speech_recognition"] = "whisper",
        model: str = "base",
        language: Optional[str] = None,
        chunk_duration: int = 3
    ) -> dict:
        """
        Start continuous live transcription (experimental)
        
        Returns:
            dict with status and instructions
        """
        return {
            "success": True, 
            "message": "Live transcription not implemented yet. Use record_and_transcribe() for now.",
            "suggestion": f"Try: record_and_transcribe(duration={chunk_duration}, engine='{engine}')"
        }

# Main interface for MCP integration
def speech_to_text(
    duration: int = 5,
    engine: str = "whisper", 
    model: str = "base",
    language: Optional[str] = None,
    file_path: Optional[str] = None
) -> str:
    """
    MCP tool interface for speech-to-text
    
    Args:
        duration: Recording duration (ignored if file_path provided)
        engine: STT engine ("whisper", "speech_recognition")
        model: Model size for Whisper
        language: Language code
        file_path: Path to existing audio file (optional)
        
    Returns:
        JSON string with transcription result
    """
    stt = STTEngine()
    
    if file_path:
        result = stt.transcribe_file(file_path, engine, model, language)
    else:
        result = stt.record_and_transcribe(duration, engine, model, language)
    
    return json.dumps(result, indent=2)

def list_stt_models() -> str:
    """
    MCP tool interface for listing available models
    
    Returns:
        JSON string with available models
    """
    models = {
        "whisper": ["tiny", "base", "small", "medium", "large"],
        "speech_recognition": ["google_web_speech_api"],
        "supported_languages": ["en", "es", "fr", "de", "it", "pt", "ru", "ja", "ko", "zh"]
    }
    
    return json.dumps(models, indent=2)

if __name__ == "__main__":
    # Test the STT system
    stt = STTEngine()
    
    print("🎤 Testing A-Modular-Kingdom STT System...")
    
    # Show available models
    print("\nAvailable models:")
    print(list_stt_models())
    
    # Test recording and transcription
    print("\nTest transcription (5 seconds):")
    print("This will use your microphone - make sure it's working!")
    
    user_input = input("Press Enter to test recording, or 'skip' to skip: ")
    
    if user_input.lower() != 'skip':
        result = stt.record_and_transcribe(duration=5, engine="whisper", model="base")
        print(f"\nResult: {json.dumps(result, indent=2)}")
    else:
        print("Skipped audio test.")