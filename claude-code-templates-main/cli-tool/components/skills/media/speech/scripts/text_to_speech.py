#!/usr/bin/env python3
"""Generate speech audio with the OpenAI Audio API (TTS).

Defaults to gpt-4o-mini-tts-2025-12-15 and a built-in voice (cedar).
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import re
import sys
import time
from typing import Any, Dict, List, Optional

DEFAULT_MODEL = "gpt-4o-mini-tts-2025-12-15"
DEFAULT_VOICE = "cedar"
DEFAULT_RESPONSE_FORMAT = "mp3"
DEFAULT_SPEED = 1.0
MAX_INPUT_CHARS = 4096
MAX_RPM = 50
DEFAULT_RPM = 50
DEFAULT_ATTEMPTS = 3

ALLOWED_VOICES = {
    "alloy",
    "ash",
    "ballad",
    "cedar",
    "coral",
    "echo",
    "fable",
    "marin",
    "nova",
    "onyx",
    "sage",
    "shimmer",
    "verse",
}

ALLOWED_FORMATS = {"mp3", "opus", "aac", "flac", "wav", "pcm"}


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


def _read_text(text: Optional[str], text_file: Optional[str], label: str) -> str:
    if text and text_file:
        _die(f"Use --{label} or --{label}-file, not both.")
    if text_file:
        path = Path(text_file)
        if not path.exists():
            _die(f"{label} file not found: {path}")
        return path.read_text(encoding="utf-8").strip()
    if text:
        return str(text).strip()
    _die(f"Missing {label}. Use --{label} or --{label}-file.")
    return ""  # unreachable


def _validate_input(text: str) -> None:
    if not text:
        _die("Input text is empty.")
    if len(text) > MAX_INPUT_CHARS:
        _die(
            f"Input text exceeds {MAX_INPUT_CHARS} characters. Split into smaller chunks."
        )


def _normalize_voice(voice: Optional[str]) -> str:
    if not voice:
        return DEFAULT_VOICE
    value = str(voice).strip().lower()
    if value not in ALLOWED_VOICES:
        _die(
            "voice must be one of: " + ", ".join(sorted(ALLOWED_VOICES))
        )
    return value


def _normalize_format(fmt: Optional[str]) -> str:
    if not fmt:
        return DEFAULT_RESPONSE_FORMAT
    value = str(fmt).strip().lower()
    if value not in ALLOWED_FORMATS:
        _die("response-format must be one of: " + ", ".join(sorted(ALLOWED_FORMATS)))
    return value


def _normalize_speed(speed: Optional[float]) -> Optional[float]:
    if speed is None:
        return None
    try:
        value = float(speed)
    except ValueError:
        _die("speed must be a number")
    if value < 0.25 or value > 4.0:
        _die("speed must be between 0.25 and 4.0")
    return value


def _normalize_output_path(out: Optional[str], response_format: str) -> Path:
    if out:
        path = Path(out)
        if path.exists() and path.is_dir():
            return path / f"speech.{response_format}"
        if path.suffix == "":
            return path.with_suffix("." + response_format)
        if path.suffix.lstrip(".").lower() != response_format:
            _warn(
                f"Output extension {path.suffix} does not match response-format {response_format}."
            )
        return path
    return Path(f"speech.{response_format}")


def _create_client():
    try:
        from openai import OpenAI
    except ImportError:
        _die("openai SDK not installed. Install with `uv pip install openai`.")
    return OpenAI()


def _extract_retry_after_seconds(exc: Exception) -> Optional[float]:
    for attr in ("retry_after", "retry_after_seconds"):
        val = getattr(exc, attr, None)
        if isinstance(val, (int, float)) and val >= 0:
            return float(val)
    msg = str(exc)
    m = re.search(r"retry[- ]after[:= ]+([0-9]+(?:\\.[0-9]+)?)", msg, re.IGNORECASE)
    if m:
        try:
            return float(m.group(1))
        except Exception:
            return None
    return None


def _is_rate_limit_error(exc: Exception) -> bool:
    name = exc.__class__.__name__.lower()
    if "ratelimit" in name or "rate_limit" in name:
        return True
    msg = str(exc).lower()
    return "429" in msg or "rate limit" in msg or "too many requests" in msg


def _is_transient_error(exc: Exception) -> bool:
    if _is_rate_limit_error(exc):
        return True
    name = exc.__class__.__name__.lower()
    if "timeout" in name or "timedout" in name or "tempor" in name:
        return True
    msg = str(exc).lower()
    return "timeout" in msg or "timed out" in msg or "connection reset" in msg


def _maybe_drop_instructions(model: str, instructions: Optional[str]) -> Optional[str]:
    if instructions and model in {"tts-1", "tts-1-hd"}:
        _warn("instructions are not supported for tts-1 / tts-1-hd; ignoring.")
        return None
    return instructions


def _print_payload(payload: Dict[str, Any]) -> None:
    print(json.dumps(payload, indent=2, sort_keys=True))


def _write_audio(
    client: Any,
    payload: Dict[str, Any],
    out_path: Path,
    *,
    dry_run: bool,
    force: bool,
    attempts: int,
) -> None:
    if dry_run:
        _print_payload(payload)
        print(f"Would write {out_path}")
        return

    _ensure_api_key(dry_run)

    if out_path.exists() and not force:
        _die(f"Output already exists: {out_path} (use --force to overwrite)")

    out_path.parent.mkdir(parents=True, exist_ok=True)

    last_exc: Optional[Exception] = None
    for attempt in range(1, attempts + 1):
        try:
            with client.audio.speech.with_streaming_response.create(**payload) as response:
                response.stream_to_file(out_path)
            print(f"Wrote {out_path}")
            return
        except Exception as exc:
            last_exc = exc
            if not _is_transient_error(exc) or attempt >= attempts:
                raise
            sleep_s = _extract_retry_after_seconds(exc)
            if sleep_s is None:
                sleep_s = min(60.0, 2.0 ** attempt)
            print(
                f"Attempt {attempt}/{attempts} failed ({exc.__class__.__name__}); retrying in {sleep_s:.1f}s",
                file=sys.stderr,
            )
            time.sleep(sleep_s)

    if last_exc:
        raise last_exc


def _slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = re.sub(r"-+", "-", value).strip("-")
    return value[:60] if value else "job"


def _read_jobs_jsonl(path: str) -> List[Dict[str, Any]]:
    p = Path(path)
    if not p.exists():
        _die(f"Input file not found: {p}")
    jobs: List[Dict[str, Any]] = []
    for line_no, raw in enumerate(p.read_text(encoding="utf-8").splitlines(), start=1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("{"):
            try:
                item = json.loads(line)
            except json.JSONDecodeError as exc:
                _die(f"Invalid JSON on line {line_no}: {exc}")
            if not isinstance(item, dict):
                _die(f"Invalid job on line {line_no}: expected object")
            jobs.append(item)
        else:
            jobs.append({"input": line})
    if not jobs:
        _die("No jobs found in input file.")
    return jobs


def _job_input(job: Dict[str, Any]) -> str:
    for key in ("input", "text", "prompt"):
        if key in job and str(job[key]).strip():
            return str(job[key]).strip()
    _die("Job missing input text (use 'input').")
    return ""  # unreachable


def _merge_non_null(base: Dict[str, Any], extra: Dict[str, Any]) -> Dict[str, Any]:
    merged = dict(base)
    for k, v in extra.items():
        if v is not None:
            merged[k] = v
    return merged


def _enforce_rpm(rpm: int) -> int:
    if rpm <= 0:
        _die("rpm must be > 0")
    if rpm > MAX_RPM:
        _warn(f"rpm capped at {MAX_RPM} (requested {rpm}).")
        return MAX_RPM
    return rpm


def _sleep_for_rate_limit(last_ts: Optional[float], rpm: int) -> float:
    min_interval = 60.0 / float(rpm)
    now = time.monotonic()
    if last_ts is None:
        return now
    elapsed = now - last_ts
    if elapsed < min_interval:
        time.sleep(min_interval - elapsed)
    return time.monotonic()


def _list_voices() -> None:
    for name in sorted(ALLOWED_VOICES):
        print(name)


def _run_speak(args: argparse.Namespace) -> int:
    if args.list_voices:
        _list_voices()
        return 0

    input_text = _read_text(args.input, args.input_file, "input")
    _validate_input(input_text)

    instructions = None
    if args.instructions or args.instructions_file:
        instructions = _read_text(args.instructions, args.instructions_file, "instructions")

    model = str(args.model).strip()
    voice = _normalize_voice(args.voice)
    response_format = _normalize_format(args.response_format)
    speed = _normalize_speed(args.speed)

    instructions = _maybe_drop_instructions(model, instructions)

    payload: Dict[str, Any] = {
        "model": model,
        "voice": voice,
        "input": input_text,
        "response_format": response_format,
    }
    if instructions:
        payload["instructions"] = instructions
    if speed is not None:
        payload["speed"] = speed

    out_path = _normalize_output_path(args.out, response_format)

    if args.dry_run:
        _ensure_api_key(True)
        _print_payload(payload)
        print(f"Would write {out_path}")
        return 0

    client = _create_client()
    _write_audio(
        client,
        payload,
        out_path,
        dry_run=args.dry_run,
        force=args.force,
        attempts=args.attempts,
    )
    return 0


def _run_speak_batch(args: argparse.Namespace) -> int:
    jobs = _read_jobs_jsonl(args.input)
    out_dir = Path(args.out_dir)

    base_instructions = None
    if args.instructions or args.instructions_file:
        base_instructions = _read_text(args.instructions, args.instructions_file, "instructions")

    base_payload = {
        "model": str(args.model).strip(),
        "voice": _normalize_voice(args.voice),
        "response_format": _normalize_format(args.response_format),
        "speed": _normalize_speed(args.speed),
        "instructions": base_instructions,
    }

    rpm = _enforce_rpm(args.rpm)
    last_ts: Optional[float] = None

    if args.dry_run:
        _ensure_api_key(True)

    client = None if args.dry_run else _create_client()

    for idx, job in enumerate(jobs, start=1):
        input_text = _job_input(job)
        _validate_input(input_text)

        job_payload = dict(base_payload)
        job_payload["input"] = input_text

        overrides: Dict[str, Any] = {}
        if "model" in job:
            overrides["model"] = str(job["model"]).strip()
        if "voice" in job:
            overrides["voice"] = _normalize_voice(job["voice"])
        if "response_format" in job or "format" in job:
            overrides["response_format"] = _normalize_format(job.get("response_format") or job.get("format"))
        if "speed" in job and job["speed"] is not None:
            overrides["speed"] = _normalize_speed(job["speed"])
        if "instructions" in job and str(job["instructions"]).strip():
            overrides["instructions"] = str(job["instructions"]).strip()

        job_payload = _merge_non_null(job_payload, overrides)
        job_payload["instructions"] = _maybe_drop_instructions(
            job_payload["model"], job_payload.get("instructions")
        )
        if job_payload.get("instructions") is None:
            job_payload.pop("instructions", None)

        response_format = job_payload["response_format"]

        explicit_out = job.get("out")
        if explicit_out:
            out_path = _normalize_output_path(str(explicit_out), response_format)
            if out_path.is_absolute():
                out_path = out_dir / out_path.name
            else:
                out_path = out_dir / out_path
        else:
            slug = _slugify(input_text[:80])
            out_path = out_dir / f"{idx:03d}-{slug}.{response_format}"

        if args.dry_run:
            _print_payload(job_payload)
            print(f"Would write {out_path}")
            continue

        last_ts = _sleep_for_rate_limit(last_ts, rpm)

        if client is None:
            client = _create_client()
        _write_audio(
            client,
            job_payload,
            out_path,
            dry_run=False,
            force=args.force,
            attempts=args.attempts,
        )

    return 0


def _add_common_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument(
        "--model",
        default=DEFAULT_MODEL,
        help=f"Model to use (default: {DEFAULT_MODEL})",
    )
    parser.add_argument(
        "--voice",
        default=DEFAULT_VOICE,
        help=f"Voice to use (default: {DEFAULT_VOICE})",
    )
    parser.add_argument(
        "--response-format",
        default=DEFAULT_RESPONSE_FORMAT,
        help=f"Output format (default: {DEFAULT_RESPONSE_FORMAT})",
    )
    parser.add_argument(
        "--speed",
        type=float,
        default=DEFAULT_SPEED,
        help=f"Speech speed (0.25-4.0, default: {DEFAULT_SPEED})",
    )
    parser.add_argument(
        "--instructions",
        help="Style directions for the voice",
    )
    parser.add_argument(
        "--instructions-file",
        help="Path to instructions text file",
    )
    parser.add_argument(
        "--attempts",
        type=int,
        default=DEFAULT_ATTEMPTS,
        help=f"Retries on transient errors (default: {DEFAULT_ATTEMPTS})",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print payload; do not call the API",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite output files if they exist",
    )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate speech audio using the OpenAI Audio API."
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    list_voices = subparsers.add_parser("list-voices", help="List supported voices")
    list_voices.set_defaults(func=lambda _args: (_list_voices() or 0))

    speak = subparsers.add_parser("speak", help="Generate a single audio file")
    speak.add_argument("--input", help="Input text")
    speak.add_argument("--input-file", help="Path to input text file")
    speak.add_argument("--out", help="Output file path")
    speak.add_argument(
        "--list-voices",
        action="store_true",
        help="Print voices and exit",
    )
    _add_common_args(speak)
    speak.set_defaults(func=_run_speak)

    batch = subparsers.add_parser("speak-batch", help="Generate from JSONL jobs")
    batch.add_argument("--input", required=True, help="Path to JSONL file")
    batch.add_argument(
        "--out-dir",
        default="out",
        help="Output directory (default: out)",
    )
    batch.add_argument(
        "--rpm",
        type=int,
        default=DEFAULT_RPM,
        help=f"Requests per minute cap (default: {DEFAULT_RPM}, max: {MAX_RPM})",
    )
    _add_common_args(batch)
    batch.set_defaults(func=_run_speak_batch)

    args = parser.parse_args()
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
