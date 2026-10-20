#!/usr/bin/env python3
"""Generate speech with Atlas Cloud's asynchronous audio API.

The generation POST is sent exactly once. Only prediction GET requests are
retried, and every polling loop is finite.
"""

from __future__ import annotations

import argparse
import ipaddress
import json
import os
import socket
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

API_BASE = "https://api.atlascloud.ai/api/v1"
DEFAULT_MODEL = "xai/tts-v1"
DEFAULT_VOICE = "eve"
DEFAULT_LANGUAGE = "auto"
DEFAULT_CODEC = "mp3"
DEFAULT_POLL_INTERVAL = 2.0
DEFAULT_POLL_ATTEMPTS = 120
MAX_DOWNLOAD_BYTES = 100 * 1024 * 1024
MAX_INPUT_CHARS = 15_000
USER_AGENT = "claude-code-templates-speech/atlas-tts"

VOICES = {"ara", "eve", "leo", "rex", "sal"}
LANGUAGES = {
    "auto",
    "en",
    "zh",
    "ar-EG",
    "ar-SA",
    "ar-AE",
    "bn",
    "fr",
    "de",
    "hi",
    "id",
    "it",
    "ja",
    "ko",
    "pt-BR",
    "pt-PT",
    "ru",
    "es-MX",
    "es-ES",
    "tr",
    "vi",
}
CODECS = {"mp3", "wav", "pcm", "mulaw", "alaw"}
TERMINAL_FAILURES = {"failed", "timeout", "canceled", "cancelled"}
BENCHMARK_NETWORK = ipaddress.ip_network("198.18.0.0/15")


def _die(message: str, code: int = 1) -> None:
    print(f"Error: {message}", file=sys.stderr)
    raise SystemExit(code)


def _read_text(text: Optional[str], text_file: Optional[str]) -> str:
    if text and text_file:
        _die("Use --input or --input-file, not both.")
    if text_file:
        path = Path(text_file)
        if not path.is_file():
            _die(f"Input file not found: {path}")
        value = path.read_text(encoding="utf-8").strip()
    elif text:
        value = text.strip()
    else:
        _die("Missing input. Use --input or --input-file.")
        return ""  # unreachable
    if not value:
        _die("Input text is empty.")
    if len(value) > MAX_INPUT_CHARS:
        _die(f"Input text exceeds {MAX_INPUT_CHARS} characters.")
    return value


def _choice(value: str, allowed: Iterable[str], label: str) -> str:
    if value not in allowed:
        _die(f"{label} must be one of: {', '.join(sorted(allowed))}")
    return value


def _speed(value: float) -> float:
    if value < 0.7 or value > 1.5:
        _die("speed must be between 0.7 and 1.5")
    return value


def _output_path(value: Optional[str], codec: str) -> Path:
    path = Path(value) if value else Path(f"speech.{codec}")
    if path.exists() and path.is_dir():
        return path / f"speech.{codec}"
    if not path.suffix:
        return path.with_suffix(f".{codec}")
    return path


def _api_key(dry_run: bool) -> str:
    key = os.getenv("ATLASCLOUD_API_KEY", "").strip()
    if key:
        return key
    if dry_run:
        return ""
    _die("ATLASCLOUD_API_KEY is not set. Export it before running.")
    return ""  # unreachable


def _request_json(
    url: str,
    *,
    api_key: str,
    method: str,
    payload: Optional[Dict[str, Any]] = None,
    attempts: int = 1,
) -> Dict[str, Any]:
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json",
        "User-Agent": USER_AGENT,
    }
    if body is not None:
        headers["Content-Type"] = "application/json"

    last_error: Optional[Exception] = None
    for attempt in range(1, attempts + 1):
        request = urllib.request.Request(url, data=body, headers=headers, method=method)
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                result = json.loads(response.read().decode("utf-8"))
            if not isinstance(result, dict):
                raise ValueError("API response was not a JSON object")
            return result
        except urllib.error.HTTPError as exc:
            if (
                method == "GET"
                and exc.code in {408, 429, 500, 502, 503, 504}
                and attempt < attempts
            ):
                time.sleep(min(4.0, 2.0 ** (attempt - 1)))
                continue
            # Do not print response bodies: upstream errors may include request data.
            raise RuntimeError(
                f"Atlas API returned HTTP {exc.code}: {exc.reason}"
            ) from exc
        except (
            urllib.error.URLError,
            TimeoutError,
            json.JSONDecodeError,
            ValueError,
        ) as exc:
            last_error = exc
            if attempt >= attempts:
                raise
            time.sleep(min(4.0, 2.0 ** (attempt - 1)))
    if last_error:
        raise last_error
    raise RuntimeError("request failed without an error")


def _response_data(response: Dict[str, Any], operation: str) -> Dict[str, Any]:
    code = response.get("code")
    data = response.get("data")
    if code not in {0, 200} or not isinstance(data, dict):
        message = response.get("message") or response.get("msg") or "unknown error"
        _die(f"Atlas {operation} failed: {message}")
    return data


def _submit(payload: Dict[str, Any], api_key: str) -> str:
    response = _request_json(
        f"{API_BASE}/model/generateAudio",
        api_key=api_key,
        method="POST",
        payload=payload,
        attempts=1,
    )
    data = _response_data(response, "submission")
    prediction_id = str(data.get("id") or "").strip()
    if not prediction_id:
        _die("Atlas submission response did not include a prediction ID.")
    print(f"Atlas prediction ID: {prediction_id}", file=sys.stderr)
    return prediction_id


def _poll(
    prediction_id: str,
    api_key: str,
    *,
    attempts: int,
    interval: float,
) -> str:
    if attempts < 1:
        _die("poll-attempts must be at least 1")
    if interval < 0:
        _die("poll-interval must not be negative")
    quoted_id = urllib.parse.quote(prediction_id, safe="")
    url = f"{API_BASE}/model/prediction/{quoted_id}"

    for poll_number in range(1, attempts + 1):
        response = _request_json(
            url,
            api_key=api_key,
            method="GET",
            attempts=3,
        )
        data = _response_data(response, "prediction lookup")
        status = str(data.get("status") or "").lower()
        if status in {"completed", "succeeded"}:
            outputs = data.get("outputs")
            if (
                not isinstance(outputs, list)
                or not outputs
                or not isinstance(outputs[0], str)
            ):
                _die("Atlas prediction completed without an output URL.")
            return outputs[0]
        if status in TERMINAL_FAILURES:
            detail = data.get("error") or status
            _die(f"Atlas prediction {status}: {detail}")
        if poll_number < attempts:
            time.sleep(interval)
    _die(f"Atlas prediction did not finish after {attempts} polls.")
    return ""  # unreachable


def _is_safe_ip(address: str, *, named_host: bool) -> bool:
    ip = ipaddress.ip_address(address)
    if named_host and ip in BENCHMARK_NETWORK:
        # macOS proxy/TUN clients commonly synthesize public DNS into this block.
        return True
    return ip.is_global


def _validate_download_url(url: str) -> None:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != "https" or not parsed.hostname:
        _die("Atlas output URL must use HTTPS.")
    if parsed.username or parsed.password:
        _die("Atlas output URL must not include user information.")
    host = parsed.hostname
    try:
        literal = ipaddress.ip_address(host)
    except ValueError:
        literal = None
    if literal is not None:
        if not _is_safe_ip(str(literal), named_host=False):
            _die("Atlas output URL resolves to a non-public address.")
        return
    if host.lower() == "localhost" or host.lower().endswith(".localhost"):
        _die("Atlas output URL must not target localhost.")
    try:
        addresses = {
            item[4][0]
            for item in socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
        }
    except socket.gaierror as exc:
        _die(f"Could not resolve Atlas output host: {exc}")
        return
    if not addresses or any(
        not _is_safe_ip(address, named_host=True) for address in addresses
    ):
        _die("Atlas output URL resolves to a non-public address.")


class _SafeRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # type: ignore[no-untyped-def]
        _validate_download_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def _download(url: str, out_path: Path, *, force: bool) -> None:
    _validate_download_url(url)
    if out_path.exists() and not force:
        _die(f"Output already exists: {out_path} (use --force to overwrite)")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(
        url,
        headers={"Accept": "audio/*", "User-Agent": USER_AGENT},
        method="GET",
    )
    opener = urllib.request.build_opener(_SafeRedirectHandler())
    written = 0
    with opener.open(request, timeout=60) as response, out_path.open("wb") as target:
        while True:
            chunk = response.read(64 * 1024)
            if not chunk:
                break
            written += len(chunk)
            if written > MAX_DOWNLOAD_BYTES:
                target.close()
                out_path.unlink(missing_ok=True)
                _die("Atlas output exceeds the 100 MiB download limit.")
            target.write(chunk)
    if written == 0:
        out_path.unlink(missing_ok=True)
        _die("Atlas output download was empty.")
    print(f"Wrote {out_path}")


def _payload(args: argparse.Namespace, text: str) -> Dict[str, Any]:
    return {
        "model": args.model,
        "text": text,
        "language": _choice(args.language, LANGUAGES, "language"),
        "voice_id": _choice(args.voice, VOICES, "voice"),
        "codec": _choice(args.codec, CODECS, "codec"),
        "speed": _speed(args.speed),
    }


def _generate(
    payload: Dict[str, Any], out_path: Path, args: argparse.Namespace
) -> None:
    if out_path.exists() and not args.force and not args.dry_run:
        _die(f"Output already exists: {out_path} (use --force to overwrite)")
    key = _api_key(args.dry_run)
    if args.dry_run:
        print(json.dumps(payload, indent=2, sort_keys=True))
        print(f"Would write {out_path}")
        return
    prediction_id = _submit(payload, key)
    output_url = _poll(
        prediction_id,
        key,
        attempts=args.poll_attempts,
        interval=args.poll_interval,
    )
    _download(output_url, out_path, force=args.force)


def _read_jobs(path: str) -> List[Dict[str, Any]]:
    jobs: List[Dict[str, Any]] = []
    for line_number, raw in enumerate(
        Path(path).read_text(encoding="utf-8").splitlines(), 1
    ):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        try:
            job = json.loads(line)
        except json.JSONDecodeError as exc:
            _die(f"Invalid JSON on line {line_number}: {exc}")
        if not isinstance(job, dict):
            _die(f"Invalid job on line {line_number}: expected an object")
        jobs.append(job)
    if not jobs:
        _die("No jobs found in input file.")
    return jobs


def _run_speak(args: argparse.Namespace) -> int:
    text = _read_text(args.input, args.input_file)
    codec = _choice(args.codec, CODECS, "codec")
    _generate(_payload(args, text), _output_path(args.out, codec), args)
    return 0


def _run_batch(args: argparse.Namespace) -> int:
    out_dir = Path(args.out_dir)
    for index, job in enumerate(_read_jobs(args.input), 1):
        child = argparse.Namespace(**vars(args))
        child.model = str(job.get("model", args.model))
        child.language = str(job.get("language", args.language))
        child.voice = str(job.get("voice", job.get("voice_id", args.voice)))
        child.codec = str(job.get("codec", args.codec))
        child.speed = float(job.get("speed", args.speed))
        text = _read_text(str(job.get("input") or job.get("text") or ""), None)
        filename = str(job.get("out") or f"{index:03d}-speech.{child.codec}")
        out_path = out_dir / Path(filename).name
        _generate(_payload(child, text), out_path, child)
    return 0


def _add_common_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--voice", default=DEFAULT_VOICE)
    parser.add_argument("--language", default=DEFAULT_LANGUAGE)
    parser.add_argument("--codec", default=DEFAULT_CODEC)
    parser.add_argument("--speed", type=float, default=1.0)
    parser.add_argument("--poll-interval", type=float, default=DEFAULT_POLL_INTERVAL)
    parser.add_argument("--poll-attempts", type=int, default=DEFAULT_POLL_ATTEMPTS)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--force", action="store_true")


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Generate speech using Atlas Cloud.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    voices = subparsers.add_parser("list-voices", help="List multilingual voices")
    voices.set_defaults(func=lambda _args: print("\n".join(sorted(VOICES))) or 0)

    speak = subparsers.add_parser("speak", help="Generate one audio file")
    speak.add_argument("--input")
    speak.add_argument("--input-file")
    speak.add_argument("--out")
    _add_common_args(speak)
    speak.set_defaults(func=_run_speak)

    batch = subparsers.add_parser("speak-batch", help="Generate from JSONL jobs")
    batch.add_argument("--input", required=True)
    batch.add_argument("--out-dir", default="out")
    _add_common_args(batch)
    batch.set_defaults(func=_run_batch)

    args = parser.parse_args(argv)
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
