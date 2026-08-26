#!/usr/bin/env python3
"""Generate speech through MuAPI's asynchronous text-to-speech endpoint.

This is an explicitly selected optional backend. The default speech workflow
continues to use the OpenAI CLI. The MuAPI generation POST is sent once; only
bounded prediction GET requests may be retried. Download requests never carry
the MuAPI credential.
"""

from __future__ import annotations

import argparse
import http.client
import ipaddress
import json
import math
import os
import socket
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, Optional, Tuple


API_BASE = "https://api.muapi.ai"
API_HOST = "api.muapi.ai"
MODEL_NAME = "elevenlabs-tts-turbo-2-5"
MODEL_ENDPOINT = f"/api/v1/{MODEL_NAME}"
MODEL_DETAIL_PATH = f"/api/v1/models/{MODEL_NAME}"
DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"
DEFAULT_STABILITY = 0.5
DEFAULT_SIMILARITY_BOOST = 0.75
DEFAULT_SPEED = 1.0
DEFAULT_POLL_INTERVAL = 2.0
DEFAULT_POLL_ATTEMPTS = 60
MAX_POLL_ATTEMPTS = 120
MAX_INPUT_CHARS = 40_000
MAX_DOWNLOAD_BYTES = 100 * 1024 * 1024
USER_AGENT = "claude-code-templates-speech/muapi-tts"

LANGUAGE_CODES = ("en", "fr", "de", "ja", "vi", "hu", "no")
VOICE_LABELS = {
    "21m00Tcm4TlvDq8ikWAM": "Published model default",
    "ZQe5CZNOzWyzPSCn5a3c": "James - Husky, Engaging and Bold",
    "Z3R5wn05IrDiVCyEkUrK": "Arabella - Mysterious and Emotive",
    "NNl6r8mD7vthiJatiJt1": "Bradford - Expressive and Articulate",
    "YOq2y2Up4RgXP2HyXjE5": "Xavier - Dominating, Metallic Announcer",
    "qDuRKMlYmrm8trt5QyBn": "Taksh - Calm, Serious and Smooth",
    "iP95p4xoKVk53GoZ742B": "Monika Sogam - Deep and Natural",
    "UgBBYS2sOqTuMpoF3BR0": "Mark - Casual, Relaxed and Light",
    "5l5f8iK3YPeGga21rQIX": "Adeline - Feminine and Conversational",
    "yoZ06aMxZJJ28mfd3POQ": "Sam - Support Agent",
    "NOpBlnGInO9m6vDvFkFC": "Spuds Oxley - Wise and Approachable",
    "scOwDtmlLZohaFMFCHFe": "Eve - Authentic, Energetic and Happy",
    "N2lVS1w4EtoT3dr4eOWO": "Callum - Husky Trickster",
    "FGY2WhTYpPnrIDTdsKH5": "Laura - Enthusiast, Quirky Attitude",
    "zPhCVfO2NBER7bRLIdbq": "Brian - Deep, Resonant and Comforting",
    "nPczCjzI2devNBz1zQrb": "Nathan - Virtual Radio Host",
    "IKne3meq5aSn9XLyUdCD": "Charlie - Natural",
    "JBFqnCBsd6RMkjVDRZzb": "George - Warm",
    "EXAVITQu4vr4xnSDxMaL": "Sarah - Soft",
    "XB0fDUnXU5powFXDhCwa": "Charlotte - Clear",
    "tnSpp4vdxKPjI9w0GnoV": "Hope - Bubbly, Gossipy and Girly",
    "DYkrAHD8iwork3YSUBbs": "Finn - Youthful, Eager and Energetic",
    "56AoDkrOh6qfVPDXZ7Pt": "Tom - Conversations and Books",
    "lcMyyd2HUfFzxdCaC4Ta": "Lucy - Fresh and Casual",
    "6aDn1KB0hjpdcocrUkmq": "Tiffany - Natural and Welcoming",
    "7ftFdxRlmR6Z9V3nTdUh": "Brock - Commanding and Loud Sergeant",
    "bajNon13EdhNMndG3z05": "Viraj - Rich and Soft",
}
VOICE_IDS = tuple(VOICE_LABELS)
TERMINAL_FAILURES = {"failed", "error", "canceled", "cancelled", "timeout"}
AUDIO_URL_KEYS = {
    "audio_url",
    "audiourl",
    "url",
    "file_url",
    "fileurl",
    "output",
    "outputs",
    "data",
}
AUDIO_SUFFIXES = (".aac", ".flac", ".m4a", ".mp3", ".ogg", ".opus", ".wav")
BENCHMARK_NETWORK = ipaddress.ip_network("198.18.0.0/15")


def _die(message: str) -> None:
    print(f"Error: {message}", file=sys.stderr)
    raise SystemExit(1)


def _read_text(text: Optional[str], text_file: Optional[str]) -> str:
    if text is not None and text_file is not None:
        _die("Use --input or --input-file, not both.")
    if text_file:
        path = Path(text_file)
        if not path.is_file():
            _die("Input file was not found.")
        try:
            value = path.read_text(encoding="utf-8").strip()
        except OSError as exc:
            _die(f"Could not read input file: {exc}")
    elif text is not None:
        value = text.strip()
    else:
        _die("Missing input. Use --input or --input-file.")
        return ""
    if not value:
        _die("Input text is empty.")
    if len(value) > MAX_INPUT_CHARS:
        _die(f"Input text exceeds {MAX_INPUT_CHARS} characters.")
    return value


def _choice(value: str, allowed: Iterable[str], label: str) -> str:
    if value not in allowed:
        _die(f"{label} must be one of: {', '.join(allowed)}")
    return value


def _number(value: Any, minimum: float, maximum: float, label: str) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        _die(f"{label} must be a number.")
    if not math.isfinite(number) or number < minimum or number > maximum:
        _die(f"{label} must be finite and between {minimum:g} and {maximum:g}.")
    return number


def _poll_options(args: argparse.Namespace) -> tuple[int, float]:
    attempts = args.poll_attempts
    interval = args.poll_interval
    if not isinstance(attempts, int) or attempts < 1 or attempts > MAX_POLL_ATTEMPTS:
        _die(f"poll-attempts must be an integer from 1 to {MAX_POLL_ATTEMPTS}.")
    interval = _number(interval, 0.0, 60.0, "poll-interval")
    return attempts, interval


def _output_path(value: Optional[str]) -> Path:
    path = Path(value) if value else Path("speech.mp3")
    if path.exists() and path.is_dir():
        return path / "speech.mp3"
    if not path.suffix:
        return path.with_suffix(".mp3")
    return path


def _api_key(dry_run: bool) -> str:
    key = os.getenv("MUAPI_API_KEY", "").strip()
    if key:
        return key
    if dry_run:
        return ""
    _die("MUAPI_API_KEY is not set. Export it before running MuAPI speech generation.")
    return ""


def _is_api_origin(url: str) -> bool:
    parsed = urllib.parse.urlsplit(url)
    try:
        port = parsed.port
    except ValueError:
        return False
    return (
        parsed.scheme.lower() == "https"
        and parsed.hostname is not None
        and parsed.hostname.lower() == API_HOST
        and port in {None, 443}
    )


class _FixedOriginRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # type: ignore[no-untyped-def]
        if not _is_api_origin(newurl):
            raise RuntimeError("MuAPI API redirect left the fixed API origin")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def _open_api(request: urllib.request.Request):
    opener = urllib.request.build_opener(_FixedOriginRedirectHandler())
    return opener.open(request, timeout=60)


def _request_json(
    url: str,
    *,
    api_key: str,
    method: str,
    payload: Optional[Mapping[str, Any]] = None,
    attempts: int = 1,
) -> Dict[str, Any]:
    """Make one fixed-origin JSON request; only GETs may be retried."""
    if method not in {"GET", "POST"}:
        raise ValueError("MuAPI requests must use GET or POST")
    if attempts < 1:
        raise ValueError("request attempts must be positive")
    if method != "GET":
        attempts = 1

    body = None if payload is None else json.dumps(dict(payload)).encode("utf-8")
    headers = {"Accept": "application/json", "User-Agent": USER_AGENT}
    if body is not None:
        headers["Content-Type"] = "application/json"
    if api_key:
        headers["x-api-key"] = api_key

    for attempt in range(1, attempts + 1):
        request = urllib.request.Request(url, data=body, headers=headers, method=method)
        try:
            with _open_api(request) as response:
                result = json.loads(response.read().decode("utf-8"))
            if not isinstance(result, dict):
                raise ValueError("MuAPI returned a non-object JSON response")
            return result
        except urllib.error.HTTPError as exc:
            if method == "GET" and exc.code in {408, 429, 500, 502, 503, 504} and attempt < attempts:
                time.sleep(min(4.0, 2.0 ** (attempt - 1)))
                continue
            raise RuntimeError(f"MuAPI API returned HTTP {exc.code}") from exc
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, ValueError) as exc:
            if method == "GET" and attempt < attempts:
                time.sleep(min(4.0, 2.0 ** (attempt - 1)))
                continue
            raise RuntimeError("MuAPI request failed") from exc
    raise RuntimeError("MuAPI request failed")


def _validate_model(details: Mapping[str, Any]) -> None:
    if details.get("name") not in {None, MODEL_NAME}:
        raise RuntimeError("MuAPI returned unexpected model metadata")
    if str(details.get("category") or "").lower() != "text to audio":
        raise RuntimeError("MuAPI model is not a text-to-audio capability")
    if details.get("endpoint") != MODEL_ENDPOINT:
        raise RuntimeError("MuAPI returned an unexpected model endpoint")
    schema = details.get("input_schema")
    properties = (
        schema.get("schemas", {}).get("input_data", {}).get("properties", {})
        if isinstance(schema, dict)
        else {}
    )
    if not isinstance(properties, dict) or "prompt" not in properties:
        raise RuntimeError("MuAPI model metadata did not include a prompt input")


def _discover_model() -> Dict[str, Any]:
    details = _request_json(
        f"{API_BASE}{MODEL_DETAIL_PATH}",
        api_key="",
        method="GET",
        attempts=3,
    )
    _validate_model(details)
    return details


def _request_id(response: Mapping[str, Any]) -> Optional[str]:
    candidates: List[Any] = [response.get("request_id"), response.get("id")]
    data = response.get("data")
    if isinstance(data, dict):
        candidates.extend([data.get("request_id"), data.get("id")])
    for candidate in candidates:
        if candidate is not None and str(candidate).strip():
            return str(candidate).strip()
    return None


def _submit(payload: Mapping[str, Any], api_key: str) -> str:
    response = _request_json(
        f"{API_BASE}{MODEL_ENDPOINT}",
        api_key=api_key,
        method="POST",
        payload=payload,
        attempts=1,
    )
    prediction_id = _request_id(response)
    if not prediction_id:
        raise RuntimeError("MuAPI submission did not return a prediction ID")
    return prediction_id


def _audio_urls(value: Any, *, parent_key: str = "") -> List[str]:
    if isinstance(value, str):
        if not value.lower().startswith("https://"):
            return []
        key = parent_key.lower()
        if key in AUDIO_URL_KEYS or value.lower().split("?", 1)[0].endswith(AUDIO_SUFFIXES):
            return [value]
        return []
    if isinstance(value, list):
        result: List[str] = []
        for item in value:
            result.extend(_audio_urls(item, parent_key=parent_key))
        return result
    if isinstance(value, dict):
        result = []
        for key, item in value.items():
            if str(key).lower() in {"request_url", "status", "id", "created_at"}:
                continue
            result.extend(_audio_urls(item, parent_key=str(key)))
        return result
    return []


def select_audio_url(result: Mapping[str, Any]) -> Optional[str]:
    """Select the first HTTPS audio URL from a completed prediction response."""
    for key in ("output", "outputs", "data"):
        urls = _audio_urls(result.get(key), parent_key=key)
        if urls:
            return urls[0]
    return None


def _result_status(result: Mapping[str, Any]) -> str:
    data = result.get("data")
    output = result.get("output")
    for value in (
        result.get("status"),
        data.get("status") if isinstance(data, dict) else None,
        output.get("status") if isinstance(output, dict) else None,
    ):
        if value:
            return str(value).lower()
    return ""


def _poll(
    prediction_id: str,
    api_key: str,
    *,
    attempts: int,
    interval: float,
    sleep_fn: Optional[Any] = None,
) -> str:
    if attempts < 1 or attempts > MAX_POLL_ATTEMPTS:
        raise ValueError(f"poll attempts must be between 1 and {MAX_POLL_ATTEMPTS}")
    if not math.isfinite(interval) or interval < 0:
        raise ValueError("poll interval must be finite and non-negative")
    sleep = sleep_fn or time.sleep
    quoted_id = urllib.parse.quote(prediction_id, safe="")
    url = f"{API_BASE}/api/v1/predictions/{quoted_id}/result"

    for poll_number in range(1, attempts + 1):
        result = _request_json(url, api_key=api_key, method="GET", attempts=3)
        status = _result_status(result)
        output_url = select_audio_url(result)
        if output_url:
            return output_url
        if status in TERMINAL_FAILURES:
            raise RuntimeError(f"MuAPI prediction ended with status '{status}'")
        if status in {"completed", "succeeded", "success"}:
            raise RuntimeError("MuAPI prediction completed without an audio URL")
        if poll_number < attempts:
            sleep(interval)
    raise RuntimeError(f"MuAPI prediction did not finish after {attempts} polls")


def _is_safe_ip(address: str, *, named_host: bool) -> bool:
    ip = ipaddress.ip_address(address)
    if named_host and ip in BENCHMARK_NETWORK:
        return True
    return ip.is_global


def _resolve_public_addresses(
    host: str, port: int
) -> List[Tuple[int, int, int, Any]]:
    try:
        infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise OSError(f"Could not resolve MuAPI output host: {exc}") from exc
    if not infos:
        raise OSError("MuAPI output host did not resolve")

    addresses: List[Tuple[int, int, int, Any]] = []
    seen = set()
    for family, socktype, protocol, _canonname, sockaddr in infos:
        address = sockaddr[0]
        try:
            safe = _is_safe_ip(address, named_host=True)
        except ValueError as exc:
            raise OSError("MuAPI output host returned an invalid address") from exc
        if not safe:
            raise OSError("MuAPI output URL resolves to a non-public address")
        key = (family, socktype, protocol, sockaddr)
        if key not in seen:
            seen.add(key)
            addresses.append((family, socktype, protocol, sockaddr))
    if not addresses:
        raise OSError("MuAPI output host did not resolve to a usable address")
    return addresses


class _PinnedHTTPSConnection(http.client.HTTPSConnection):
    """Connect to the exact public address validated at connection setup."""

    def connect(self):  # type: ignore[no-untyped-def]
        addresses = _resolve_public_addresses(self.host, self.port)
        last_error: Optional[OSError] = None
        for family, socktype, protocol, sockaddr in addresses:
            sock = socket.socket(family, socktype or socket.SOCK_STREAM, protocol)
            try:
                if self.timeout is not socket._GLOBAL_DEFAULT_TIMEOUT:
                    sock.settimeout(self.timeout)
                sock.connect(sockaddr)
                try:
                    sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
                except OSError:
                    pass
                self.sock = sock
                if self._tunnel_host:
                    self._tunnel()
                server_hostname = self._tunnel_host or self.host
                self.sock = self._context.wrap_socket(
                    self.sock, server_hostname=server_hostname
                )
                return
            except OSError as exc:
                last_error = exc
                sock.close()
                self.sock = None
        if last_error is not None:
            raise OSError("Could not connect to MuAPI output host") from last_error
        raise OSError("Could not connect to MuAPI output host")


class _PinnedHTTPSHandler(urllib.request.HTTPSHandler):
    def https_open(self, req):  # type: ignore[no-untyped-def]
        return self.do_open(_PinnedHTTPSConnection, req, context=self._context)


def _validate_download_url(url: str) -> None:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme.lower() != "https" or not parsed.hostname:
        _die("MuAPI output URL must use HTTPS.")
    if parsed.username or parsed.password:
        _die("MuAPI output URL must not include user information.")
    host = parsed.hostname
    try:
        literal = ipaddress.ip_address(host)
    except ValueError:
        literal = None
    if literal is not None:
        if not _is_safe_ip(str(literal), named_host=False):
            _die("MuAPI output URL resolves to a non-public address.")
        return
    if host.lower() == "localhost" or host.lower().endswith(".localhost"):
        _die("MuAPI output URL must not target localhost.")
    try:
        port = parsed.port or 443
        _resolve_public_addresses(host, port)
    except (OSError, ValueError) as exc:
        _die(str(exc))


class _SafeRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # type: ignore[no-untyped-def]
        _validate_download_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def _download(url: str, out_path: Path, *, force: bool) -> None:
    _validate_download_url(url)
    if out_path.exists() and not force:
        _die(f"Output already exists: {out_path} (use --force to overwrite)")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path: Optional[Path] = None
    request = urllib.request.Request(
        url,
        headers={"Accept": "audio/*", "User-Agent": USER_AGENT},
        method="GET",
    )
    opener = urllib.request.build_opener(
        urllib.request.ProxyHandler({}),
        _SafeRedirectHandler(),
        _PinnedHTTPSHandler(),
    )
    try:
        with tempfile.NamedTemporaryFile(
            prefix=f".{out_path.name}.",
            suffix=".part",
            dir=out_path.parent,
            delete=False,
        ) as temporary:
            temporary_path = Path(temporary.name)
            with opener.open(request, timeout=60) as response:
                content_length = response.headers.get("Content-Length")
                if content_length:
                    try:
                        if int(content_length) > MAX_DOWNLOAD_BYTES:
                            raise RuntimeError("MuAPI output exceeds the 100 MiB download limit")
                    except ValueError:
                        pass
                written = 0
                while True:
                    chunk = response.read(64 * 1024)
                    if not chunk:
                        break
                    written += len(chunk)
                    if written > MAX_DOWNLOAD_BYTES:
                        raise RuntimeError("MuAPI output exceeds the 100 MiB download limit")
                    temporary.write(chunk)
                if written == 0:
                    raise RuntimeError("MuAPI output download was empty")
                temporary.flush()
                os.fsync(temporary.fileno())
        os.replace(temporary_path, out_path)
        temporary_path = None
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)
    print(f"Wrote {out_path}")


def _payload(args: argparse.Namespace, text: str) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        "prompt": text,
        "voice_id": _choice(args.voice_id, VOICE_IDS, "voice-id"),
        "stability": _number(args.stability, 0.0, 1.0, "stability"),
        "similarity_boost": _number(
            args.similarity_boost, 0.0, 1.0, "similarity-boost"
        ),
        "speed": _number(args.speed, 0.7, 1.2, "speed"),
    }
    if args.language_code is not None:
        payload["language_code"] = _choice(
            args.language_code, LANGUAGE_CODES, "language-code"
        )
    return payload


def _generate(
    payload: Mapping[str, Any],
    out_path: Path,
    args: argparse.Namespace,
    *,
    model_details: Optional[Mapping[str, Any]] = None,
) -> None:
    _poll_options(args)
    if out_path.exists() and not args.force and not args.dry_run:
        _die(f"Output already exists: {out_path} (use --force to overwrite)")
    key = _api_key(args.dry_run)
    if args.dry_run:
        print(
            json.dumps(
                {
                    "model": MODEL_NAME,
                    "endpoint": MODEL_ENDPOINT,
                    "payload": dict(payload),
                    "output": str(out_path),
                },
                indent=2,
                sort_keys=True,
            )
        )
        return

    if model_details is None:
        _discover_model()
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
    try:
        lines = Path(path).read_text(encoding="utf-8").splitlines()
    except OSError as exc:
        _die(f"Could not read batch input: {exc}")
    for line_number, raw in enumerate(lines, 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        try:
            job = json.loads(line)
        except json.JSONDecodeError:
            _die(f"Invalid JSON on batch line {line_number}.")
        if not isinstance(job, dict):
            _die(f"Invalid batch job on line {line_number}: expected an object.")
        jobs.append(job)
    if not jobs:
        _die("No jobs found in batch input.")
    return jobs


def _run_speak(args: argparse.Namespace) -> int:
    text = _read_text(args.input, args.input_file)
    _generate(_payload(args, text), _output_path(args.out), args)
    return 0


def _run_batch(args: argparse.Namespace) -> int:
    out_dir = Path(args.out_dir)
    jobs = _read_jobs(args.input)
    model_details: Optional[Mapping[str, Any]] = None
    if not args.dry_run:
        model_details = _discover_model()
    for index, job in enumerate(jobs, 1):
        child = argparse.Namespace(**vars(args))
        child.voice_id = job.get("voice_id", args.voice_id)
        child.stability = job.get("stability", args.stability)
        child.similarity_boost = job.get("similarity_boost", args.similarity_boost)
        child.speed = job.get("speed", args.speed)
        child.language_code = job.get("language_code", args.language_code)
        job_text = job.get("input", job.get("text"))
        if not isinstance(job_text, str):
            _die(f"Batch job {index} must provide string input text.")
        text = _read_text(job_text, None)
        filename = str(job.get("out") or f"{index:03d}-speech.mp3")
        out_path = out_dir / Path(filename).name
        _generate(
            _payload(child, text),
            out_path,
            child,
            model_details=model_details,
        )
    return 0


def _add_provider_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--voice-id", default=DEFAULT_VOICE_ID)
    parser.add_argument("--language-code", choices=LANGUAGE_CODES)
    parser.add_argument("--stability", type=float, default=DEFAULT_STABILITY)
    parser.add_argument(
        "--similarity-boost", type=float, default=DEFAULT_SIMILARITY_BOOST
    )
    parser.add_argument("--speed", type=float, default=DEFAULT_SPEED)
    parser.add_argument("--poll-interval", type=float, default=DEFAULT_POLL_INTERVAL)
    parser.add_argument("--poll-attempts", type=int, default=DEFAULT_POLL_ATTEMPTS)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--force", action="store_true")


def _list_voices(_args: argparse.Namespace) -> int:
    for voice_id, label in VOICE_LABELS.items():
        print(f"{voice_id}\t{label}")
    return 0


def _show_model(_args: argparse.Namespace) -> int:
    details = _discover_model()
    print(
        json.dumps(
            {
                "name": details.get("name", MODEL_NAME),
                "category": details.get("category"),
                "endpoint": details.get("endpoint"),
            },
            indent=2,
        )
    )
    return 0


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Generate speech using MuAPI.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    voices = subparsers.add_parser("list-voices", help="List supported voice IDs")
    voices.set_defaults(func=_list_voices)

    models = subparsers.add_parser("models", help="Check the current MuAPI TTS model")
    models.set_defaults(func=_show_model)

    speak = subparsers.add_parser("speak", help="Generate one audio file")
    speak.add_argument("--input")
    speak.add_argument("--input-file")
    speak.add_argument("--out")
    _add_provider_args(speak)
    speak.set_defaults(func=_run_speak)

    batch = subparsers.add_parser("speak-batch", help="Generate from JSONL jobs")
    batch.add_argument("--input", required=True)
    batch.add_argument("--out-dir", default="output/speech")
    _add_provider_args(batch)
    batch.set_defaults(func=_run_batch)

    args = parser.parse_args(argv)
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
