#!/usr/bin/env python3
"""Transcribe audio (optionally with speaker diarization) using OpenAI."""

from __future__ import annotations

import argparse
import base64
import json
import mimetypes
import os
from pathlib import Path
import sys
from typing import Any, Dict, List, Optional, Tuple

DEFAULT_MODEL = "gpt-4o-mini-transcribe"
DEFAULT_RESPONSE_FORMAT = "text"
DEFAULT_CHUNKING_STRATEGY = "auto"
MAX_AUDIO_BYTES = 25 * 1024 * 1024
MAX_KNOWN_SPEAKERS = 4

ALLOWED_RESPONSE_FORMATS = {"text", "json", "diarized_json"}


def _die(message: str, code: int = 1) -> None:
    print(f"Error: {message}", file=sys.stderr)
    raise SystemExit(code)


def _warn(message: str) -> None:
    print(f"Warning: {message}", file=sys.stderr)


def _ensure_api_key(dry_run: bool) -> None:
    if os.getenv("OPENAI_API_KEY"):
        print("OPENAI_API_KEY is set.", file=sys.stderr)
        return
    if dry_run:
        _warn("OPENAI_API_KEY is not set; dry-run only.")
        return
    _die("OPENAI_API_KEY is not set. Export it before running.")


def _normalize_response_format(value: Optional[str]) -> str:
    if not value:
        return DEFAULT_RESPONSE_FORMAT
    fmt = value.strip().lower()
    if fmt not in ALLOWED_RESPONSE_FORMATS:
        _die(
            "response-format must be one of: "
            + ", ".join(sorted(ALLOWED_RESPONSE_FORMATS))
        )
    return fmt


def _normalize_chunking_strategy(value: Optional[str]) -> Any:
    if not value:
        return DEFAULT_CHUNKING_STRATEGY
    raw = str(value).strip()
    if raw.startswith("{"):
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            _die("chunking-strategy JSON is invalid")
    return raw


def _guess_mime_type(path: Path) -> str:
    mime, _ = mimetypes.guess_type(str(path))
    if mime:
        return mime
    return "audio/wav"


def _encode_data_url(path: Path) -> str:
    data = path.read_bytes()
    mime = _guess_mime_type(path)
    encoded = base64.b64encode(data).decode("ascii")
    return f"data:{mime};base64,{encoded}"


def _parse_known_speakers(raw_items: List[str]) -> Tuple[List[str], List[str]]:
    names: List[str] = []
    refs: List[str] = []
    for raw in raw_items:
        if "=" not in raw:
            _die("known-speaker must be NAME=PATH")
        name, path_str = raw.split("=", 1)
        name = name.strip()
        path = Path(path_str.strip())
        if not name or not path_str.strip():
            _die("known-speaker must be NAME=PATH")
        if not path.exists():
            _die(f"Known speaker file not found: {path}")
        names.append(name)
        refs.append(_encode_data_url(path))
    if len(names) > MAX_KNOWN_SPEAKERS:
        _die(f"known speakers must be <= {MAX_KNOWN_SPEAKERS}")
    return names, refs


def _output_extension(response_format: str) -> str:
    return "txt" if response_format == "text" else "json"


def _build_output_path(
    audio_path: Path,
    response_format: str,
    out: Optional[str],
    out_dir: Optional[str],
) -> Path:
    ext = "." + _output_extension(response_format)
    if out:
        path = Path(out)
        if path.exists() and path.is_dir():
            return path / f"{audio_path.stem}.transcript{ext}"
        if path.suffix == "":
            return path.with_suffix(ext)
        return path
    if out_dir:
        base = Path(out_dir)
        base.mkdir(parents=True, exist_ok=True)
        return base / f"{audio_path.stem}.transcript{ext}"
    return Path(f"{audio_path.stem}.transcript{ext}")


def _create_client():
    try:
        from openai import OpenAI
    except ImportError:
        _die("openai SDK not installed. Install with `uv pip install openai`.")
    return OpenAI()


def _format_output(result: Any, response_format: str) -> str:
    if response_format == "text":
        text = getattr(result, "text", None)
        return text if isinstance(text, str) else str(result)
    if hasattr(result, "model_dump"):
        return json.dumps(result.model_dump(), indent=2)
    if isinstance(result, (dict, list)):
        return json.dumps(result, indent=2)
    return json.dumps({"text": getattr(result, "text", str(result))}, indent=2)


def _validate_audio(path: Path) -> None:
    if not path.exists():
        _die(f"Audio file not found: {path}")
    size = path.stat().st_size
    if size > MAX_AUDIO_BYTES:
        _warn(
            f"Audio file exceeds 25MB limit ({size} bytes): {path}"
        )


def _build_payload(
    args: argparse.Namespace,
    known_speaker_names: List[str],
    known_speaker_refs: List[str],
) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        "model": args.model,
        "response_format": args.response_format,
        "chunking_strategy": args.chunking_strategy,
    }
    if args.language:
        payload["language"] = args.language
    if args.prompt:
        payload["prompt"] = args.prompt
    if known_speaker_names:
        payload["extra_body"] = {
            "known_speaker_names": known_speaker_names,
            "known_speaker_references": known_speaker_refs,
        }
    return payload


def _run_one(
    client: Any,
    audio_path: Path,
    payload: Dict[str, Any],
) -> Any:
    with audio_path.open("rb") as audio_file:
        return client.audio.transcriptions.create(
            file=audio_file,
            **payload,
        )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Transcribe audio (optionally with speaker diarization) using OpenAI."
    )
    parser.add_argument("audio", nargs="+", help="Audio file(s) to transcribe")
    parser.add_argument(
        "--model",
        default=DEFAULT_MODEL,
        help=f"Model to use (default: {DEFAULT_MODEL})",
    )
    parser.add_argument(
        "--response-format",
        default=DEFAULT_RESPONSE_FORMAT,
        help="Response format: text, json, or diarized_json",
    )
    parser.add_argument(
        "--chunking-strategy",
        default=DEFAULT_CHUNKING_STRATEGY,
        help="Chunking strategy (use 'auto' for long audio)",
    )
    parser.add_argument("--language", help="Optional language hint (e.g. 'en')")
    parser.add_argument("--prompt", help="Optional prompt to guide transcription")
    parser.add_argument(
        "--known-speaker",
        action="append",
        default=[],
        help="Known speaker reference as NAME=PATH (repeatable, max 4)",
    )
    parser.add_argument("--out", help="Output file path (single audio only)")
    parser.add_argument("--out-dir", help="Output directory for transcripts")
    parser.add_argument(
        "--stdout",
        action="store_true",
        help="Write transcript to stdout instead of a file",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate inputs and print payload without calling the API",
    )

    args = parser.parse_args()
    args.response_format = _normalize_response_format(args.response_format)
    args.chunking_strategy = _normalize_chunking_strategy(args.chunking_strategy)

    if args.out and len(args.audio) > 1:
        _die("--out only supports a single audio file")
    if args.stdout and (args.out or args.out_dir):
        _die("--stdout cannot be combined with --out or --out-dir")
    if args.stdout and len(args.audio) > 1:
        _die("--stdout only supports a single audio file")

    if args.prompt and "transcribe-diarize" in args.model:
        _die("prompt is not supported with gpt-4o-transcribe-diarize")
    if args.response_format == "diarized_json" and "transcribe-diarize" not in args.model:
        _die("diarized_json requires gpt-4o-transcribe-diarize")

    _ensure_api_key(args.dry_run)

    audio_paths = [Path(p) for p in args.audio]
    for path in audio_paths:
        _validate_audio(path)

    known_names, known_refs = _parse_known_speakers(args.known_speaker)
    if known_names and "transcribe-diarize" not in args.model:
        _warn("known-speaker references are only supported for gpt-4o-transcribe-diarize")
    payload = _build_payload(args, known_names, known_refs)

    if args.dry_run:
        print(json.dumps(payload, indent=2))
        return

    client = _create_client()

    for path in audio_paths:
        result = _run_one(client, path, payload)
        output = _format_output(result, args.response_format)
        if args.stdout:
            print(output)
            continue
        out_path = _build_output_path(path, args.response_format, args.out, args.out_dir)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(output, encoding="utf-8")
        print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()
