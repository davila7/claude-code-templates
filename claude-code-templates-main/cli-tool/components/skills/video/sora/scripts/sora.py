#!/usr/bin/env python3
"""Create and manage Sora videos with the OpenAI Video API.

Defaults to sora-2 and a structured prompt augmentation workflow.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
from pathlib import Path
import re
import sys
import time
from typing import Any, Dict, Iterable, List, Optional, Tuple, Union

DEFAULT_MODEL = "sora-2"
DEFAULT_SIZE = "1280x720"
DEFAULT_SECONDS = "4"
DEFAULT_POLL_INTERVAL = 10.0
DEFAULT_VARIANT = "video"
DEFAULT_CONCURRENCY = 3
DEFAULT_MAX_ATTEMPTS = 3

ALLOWED_MODELS = {"sora-2", "sora-2-pro"}
ALLOWED_SIZES_SORA2 = {"1280x720", "720x1280"}
ALLOWED_SIZES_SORA2_PRO = {"1280x720", "720x1280", "1024x1792", "1792x1024"}
ALLOWED_SECONDS = {"4", "8", "12"}
ALLOWED_VARIANTS = {"video", "thumbnail", "spritesheet"}
ALLOWED_ORDERS = {"asc", "desc"}
ALLOWED_INPUT_EXTS = {".jpg", ".jpeg", ".png", ".webp"}
TERMINAL_STATUSES = {"completed", "failed", "canceled"}

VARIANT_EXTENSIONS = {"video": ".mp4", "thumbnail": ".webp", "spritesheet": ".jpg"}

MAX_BATCH_JOBS = 200


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


def _read_prompt(prompt: Optional[str], prompt_file: Optional[str]) -> str:
    if prompt and prompt_file:
        _die("Use --prompt or --prompt-file, not both.")
    if prompt_file:
        path = Path(prompt_file)
        if not path.exists():
            _die(f"Prompt file not found: {path}")
        return path.read_text(encoding="utf-8").strip()
    if prompt:
        return prompt.strip()
    _die("Missing prompt. Use --prompt or --prompt-file.")
    return ""  # unreachable


def _normalize_model(model: Optional[str]) -> str:
    value = (model or DEFAULT_MODEL).strip().lower()
    if value not in ALLOWED_MODELS:
        _die("model must be one of: sora-2, sora-2-pro")
    return value


def _normalize_size(size: Optional[str], model: str) -> str:
    value = (size or DEFAULT_SIZE).strip().lower()
    allowed = ALLOWED_SIZES_SORA2 if model == "sora-2" else ALLOWED_SIZES_SORA2_PRO
    if value not in allowed:
        allowed_list = ", ".join(sorted(allowed))
        _die(f"size must be one of: {allowed_list} for model {model}")
    return value


def _normalize_seconds(seconds: Optional[Union[int, str]]) -> str:
    if seconds is None:
        value = DEFAULT_SECONDS
    elif isinstance(seconds, int):
        value = str(seconds)
    else:
        value = str(seconds).strip()
    if value not in ALLOWED_SECONDS:
        _die("seconds must be one of: 4, 8, 12")
    return value


def _normalize_variant(variant: Optional[str]) -> str:
    value = (variant or DEFAULT_VARIANT).strip().lower()
    if value not in ALLOWED_VARIANTS:
        _die("variant must be one of: video, thumbnail, spritesheet")
    return value


def _normalize_order(order: Optional[str]) -> Optional[str]:
    if order is None:
        return None
    value = order.strip().lower()
    if value not in ALLOWED_ORDERS:
        _die("order must be one of: asc, desc")
    return value


def _normalize_poll_interval(interval: Optional[float]) -> float:
    value = float(interval if interval is not None else DEFAULT_POLL_INTERVAL)
    if value <= 0:
        _die("poll-interval must be > 0")
    return value


def _normalize_timeout(timeout: Optional[float]) -> Optional[float]:
    if timeout is None:
        return None
    value = float(timeout)
    if value <= 0:
        _die("timeout must be > 0")
    return value


def _default_out_path(variant: str) -> Path:
    if variant == "video":
        return Path("video.mp4")
    if variant == "thumbnail":
        return Path("thumbnail.webp")
    return Path("spritesheet.jpg")


def _normalize_out_path(out: Optional[str], variant: str) -> Path:
    expected_ext = VARIANT_EXTENSIONS[variant]
    if not out:
        return _default_out_path(variant)
    path = Path(out)
    if path.suffix == "":
        return path.with_suffix(expected_ext)
    if path.suffix.lower() != expected_ext:
        _warn(f"Output extension {path.suffix} does not match {expected_ext} for {variant}.")
    return path


def _normalize_json_out(out: Optional[str], default_name: str) -> Optional[Path]:
    if not out:
        return None
    raw = str(out)
    if raw.endswith("/") or raw.endswith(os.sep):
        return Path(raw) / default_name
    path = Path(out)
    if path.exists() and path.is_dir():
        return path / default_name
    if path.suffix == "":
        path = path.with_suffix(".json")
    return path


def _open_input_reference(path: Optional[str]):
    if not path:
        return _NullContext()
    p = Path(path)
    if not p.exists():
        _die(f"Input reference not found: {p}")
    if p.suffix.lower() not in ALLOWED_INPUT_EXTS:
        _warn("Input reference should be jpeg, png, or webp.")
    return _SingleFile(p)


def _create_client():
    try:
        from openai import OpenAI
    except ImportError:
        _die("openai SDK not installed. Run with `uv run --with openai` or install with `uv pip install openai`.")
    return OpenAI()


def _create_async_client():
    try:
        from openai import AsyncOpenAI
    except ImportError:
        try:
            import openai as _openai  # noqa: F401
        except ImportError:
            _die("openai SDK not installed. Run with `uv run --with openai` or install with `uv pip install openai`.")
        _die(
            "AsyncOpenAI not available in this openai SDK version. Upgrade with `uv pip install -U openai`."
        )
    return AsyncOpenAI()


def _to_dict(obj: Any) -> Any:
    if isinstance(obj, dict):
        return obj
    if hasattr(obj, "model_dump"):
        return obj.model_dump()
    if hasattr(obj, "dict"):
        return obj.dict()
    if hasattr(obj, "__dict__"):
        return obj.__dict__
    return obj


def _print_json(obj: Any) -> None:
    print(json.dumps(_to_dict(obj), indent=2, sort_keys=True))


def _print_request(payload: Dict[str, Any]) -> None:
    print(json.dumps(payload, indent=2, sort_keys=True))


def _slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = re.sub(r"-{2,}", "-", value).strip("-")
    return value[:60] if value else "job"


def _normalize_job(job: Any, idx: int) -> Dict[str, Any]:
    if isinstance(job, str):
        prompt = job.strip()
        if not prompt:
            _die(f"Empty prompt at job {idx}")
        return {"prompt": prompt}
    if isinstance(job, dict):
        if "prompt" not in job or not str(job["prompt"]).strip():
            _die(f"Missing prompt for job {idx}")
        return job
    _die(f"Invalid job at index {idx}: expected string or object.")
    return {}  # unreachable


def _read_jobs_jsonl(path: str) -> List[Dict[str, Any]]:
    p = Path(path)
    if not p.exists():
        _die(f"Input file not found: {p}")
    jobs: List[Dict[str, Any]] = []
    for line_no, raw in enumerate(p.read_text(encoding="utf-8").splitlines(), start=1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        try:
            item: Any
            if line.startswith("{"):
                item = json.loads(line)
            else:
                item = line
            jobs.append(_normalize_job(item, idx=line_no))
        except json.JSONDecodeError as exc:
            _die(f"Invalid JSON on line {line_no}: {exc}")
    if not jobs:
        _die("No jobs found in input file.")
    if len(jobs) > MAX_BATCH_JOBS:
        _die(f"Too many jobs ({len(jobs)}). Max is {MAX_BATCH_JOBS}.")
    return jobs


def _merge_non_null(dst: Dict[str, Any], src: Dict[str, Any]) -> Dict[str, Any]:
    merged = dict(dst)
    for k, v in src.items():
        if v is not None:
            merged[k] = v
    return merged


def _job_output_path(out_dir: Path, idx: int, prompt: str, explicit_out: Optional[str]) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    if explicit_out:
        path = Path(explicit_out)
        if path.suffix == "":
            path = path.with_suffix(".json")
        return out_dir / path.name
    slug = _slugify(prompt[:80])
    return out_dir / f"{idx:03d}-{slug}.json"


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


def _fields_from_args(args: argparse.Namespace) -> Dict[str, Optional[str]]:
    return {
        "use_case": getattr(args, "use_case", None),
        "scene": getattr(args, "scene", None),
        "subject": getattr(args, "subject", None),
        "action": getattr(args, "action", None),
        "camera": getattr(args, "camera", None),
        "style": getattr(args, "style", None),
        "lighting": getattr(args, "lighting", None),
        "palette": getattr(args, "palette", None),
        "audio": getattr(args, "audio", None),
        "dialogue": getattr(args, "dialogue", None),
        "text": getattr(args, "text", None),
        "timing": getattr(args, "timing", None),
        "constraints": getattr(args, "constraints", None),
        "negative": getattr(args, "negative", None),
    }


def _augment_prompt_fields(augment: bool, prompt: str, fields: Dict[str, Optional[str]]) -> str:
    if not augment:
        return prompt

    sections: List[str] = []
    if fields.get("use_case"):
        sections.append(f"Use case: {fields['use_case']}")
    sections.append(f"Primary request: {prompt}")
    if fields.get("scene"):
        sections.append(f"Scene/background: {fields['scene']}")
    if fields.get("subject"):
        sections.append(f"Subject: {fields['subject']}")
    if fields.get("action"):
        sections.append(f"Action: {fields['action']}")
    if fields.get("camera"):
        sections.append(f"Camera: {fields['camera']}")
    if fields.get("lighting"):
        sections.append(f"Lighting/mood: {fields['lighting']}")
    if fields.get("palette"):
        sections.append(f"Color palette: {fields['palette']}")
    if fields.get("style"):
        sections.append(f"Style/format: {fields['style']}")
    if fields.get("timing"):
        sections.append(f"Timing/beats: {fields['timing']}")
    if fields.get("audio"):
        sections.append(f"Audio: {fields['audio']}")
    if fields.get("text"):
        sections.append(f"Text (verbatim): \"{fields['text']}\"")
    if fields.get("dialogue"):
        dialogue = fields["dialogue"].strip()
        sections.append("Dialogue:\n<dialogue>\n" + dialogue + "\n</dialogue>")
    if fields.get("constraints"):
        sections.append(f"Constraints: {fields['constraints']}")
    if fields.get("negative"):
        sections.append(f"Avoid: {fields['negative']}")

    return "\n".join(sections)


def _augment_prompt(args: argparse.Namespace, prompt: str) -> str:
    fields = _fields_from_args(args)
    return _augment_prompt_fields(args.augment, prompt, fields)


def _get_status(video: Any) -> Optional[str]:
    if isinstance(video, dict):
        for key in ("status", "state"):
            if key in video and isinstance(video[key], str):
                return video[key]
        data = video.get("data") if isinstance(video.get("data"), dict) else None
        if data:
            for key in ("status", "state"):
                if key in data and isinstance(data[key], str):
                    return data[key]
        return None
    for key in ("status", "state"):
        val = getattr(video, key, None)
        if isinstance(val, str):
            return val
    return None


def _get_video_id(video: Any) -> Optional[str]:
    if isinstance(video, dict):
        if isinstance(video.get("id"), str):
            return video["id"]
        data = video.get("data") if isinstance(video.get("data"), dict) else None
        if data and isinstance(data.get("id"), str):
            return data["id"]
        return None
    vid = getattr(video, "id", None)
    return vid if isinstance(vid, str) else None


def _poll_video(
    client: Any,
    video_id: str,
    *,
    poll_interval: float,
    timeout: Optional[float],
) -> Any:
    start = time.time()
    last_status: Optional[str] = None

    while True:
        video = client.videos.retrieve(video_id)
        status = _get_status(video) or "unknown"
        if status != last_status:
            print(f"Status: {status}", file=sys.stderr)
            last_status = status
        if status in TERMINAL_STATUSES:
            return video
        if timeout is not None and (time.time() - start) > timeout:
            _die(f"Timed out after {timeout:.1f}s waiting for {video_id}")
        time.sleep(poll_interval)


def _download_content(client: Any, video_id: str, variant: str) -> Any:
    content = client.videos.download_content(video_id, variant=variant)
    if hasattr(content, "write_to_file"):
        return content
    if hasattr(content, "read"):
        return content.read()
    if isinstance(content, (bytes, bytearray)):
        return bytes(content)
    if hasattr(content, "content"):
        return content.content
    return content


def _write_download(data: Any, out_path: Path, *, force: bool) -> None:
    if out_path.exists() and not force:
        _die(f"Output exists: {out_path} (use --force to overwrite)")
    if hasattr(data, "write_to_file"):
        data.write_to_file(out_path)
        print(f"Wrote {out_path}")
        return
    if hasattr(data, "read"):
        out_path.write_bytes(data.read())
        print(f"Wrote {out_path}")
        return
    out_path.write_bytes(data)
    print(f"Wrote {out_path}")


def _build_create_payload(args: argparse.Namespace, prompt: str) -> Dict[str, Any]:
    model = _normalize_model(args.model)
    size = _normalize_size(args.size, model)
    seconds = _normalize_seconds(args.seconds)
    return {
        "model": model,
        "prompt": prompt,
        "size": size,
        "seconds": seconds,
    }


def _prepare_job_payload(
    args: argparse.Namespace,
    job: Dict[str, Any],
    base_fields: Dict[str, Optional[str]],
    base_payload: Dict[str, Any],
) -> Tuple[Dict[str, Any], Optional[str], str]:
    prompt = str(job["prompt"]).strip()
    fields = _merge_non_null(base_fields, job.get("fields", {}))
    fields = _merge_non_null(fields, {k: job.get(k) for k in base_fields.keys()})
    augmented = _augment_prompt_fields(args.augment, prompt, fields)

    payload = dict(base_payload)
    payload["prompt"] = augmented
    payload = _merge_non_null(payload, {k: job.get(k) for k in base_payload.keys()})
    payload = {k: v for k, v in payload.items() if v is not None}

    model = _normalize_model(payload.get("model"))
    size = _normalize_size(payload.get("size"), model)
    seconds = _normalize_seconds(payload.get("seconds"))

    payload["model"] = model
    payload["size"] = size
    payload["seconds"] = seconds

    input_ref = (
        job.get("input_reference")
        or job.get("input_reference_path")
        or job.get("input_reference_file")
    )

    return payload, input_ref, prompt


def _write_json(path: Path, obj: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(_to_dict(obj), indent=2, sort_keys=True), encoding="utf-8")
    print(f"Wrote {path}")


def _write_json_out(out_path: Optional[Path], obj: Any) -> None:
    if out_path is None:
        return
    _write_json(out_path, obj)


async def _create_one_with_retries(
    client: Any,
    payload: Dict[str, Any],
    *,
    attempts: int,
    job_label: str,
) -> Any:
    last_exc: Optional[Exception] = None
    for attempt in range(1, attempts + 1):
        try:
            return await client.videos.create(**payload)
        except Exception as exc:
            last_exc = exc
            if not _is_transient_error(exc):
                raise
            if attempt == attempts:
                raise
            sleep_s = _extract_retry_after_seconds(exc)
            if sleep_s is None:
                sleep_s = min(60.0, 2.0**attempt)
            print(
                f"{job_label} attempt {attempt}/{attempts} failed ({exc.__class__.__name__}); retrying in {sleep_s:.1f}s",
                file=sys.stderr,
            )
            await asyncio.sleep(sleep_s)
    raise last_exc or RuntimeError("unknown error")


async def _run_create_batch(args: argparse.Namespace) -> int:
    jobs = _read_jobs_jsonl(args.input)
    out_dir = Path(args.out_dir)

    base_fields = _fields_from_args(args)
    base_payload = {
        "model": args.model,
        "size": args.size,
        "seconds": args.seconds,
    }

    if args.dry_run:
        for i, job in enumerate(jobs, start=1):
            payload, input_ref, prompt = _prepare_job_payload(args, job, base_fields, base_payload)
            out_path = _job_output_path(out_dir, i, prompt, job.get("out"))
            preview = dict(payload)
            if input_ref:
                preview["input_reference"] = input_ref
            _print_request(
                {
                    "endpoint": "/v1/videos",
                    "job": i,
                    "output": str(out_path),
                    **preview,
                }
            )
        return 0

    client = _create_async_client()
    sem = asyncio.Semaphore(args.concurrency)
    any_failed = False

    async def run_job(i: int, job: Dict[str, Any]) -> Tuple[int, Optional[str]]:
        nonlocal any_failed
        payload, input_ref, prompt = _prepare_job_payload(args, job, base_fields, base_payload)
        job_label = f"[job {i}/{len(jobs)}]"
        out_path = _job_output_path(out_dir, i, prompt, job.get("out"))

        try:
            async with sem:
                print(f"{job_label} starting", file=sys.stderr)
                started = time.time()
                with _open_input_reference(input_ref) as ref:
                    request = dict(payload)
                    if ref is not None:
                        request["input_reference"] = ref
                    result = await _create_one_with_retries(
                        client,
                        request,
                        attempts=args.max_attempts,
                        job_label=job_label,
                    )
                elapsed = time.time() - started
                print(f"{job_label} completed in {elapsed:.1f}s", file=sys.stderr)
            _write_json(out_path, result)
            return i, None
        except Exception as exc:
            any_failed = True
            print(f"{job_label} failed: {exc}", file=sys.stderr)
            if args.fail_fast:
                raise
            return i, str(exc)

    tasks = [asyncio.create_task(run_job(i, job)) for i, job in enumerate(jobs, start=1)]

    try:
        await asyncio.gather(*tasks)
    except Exception:
        for t in tasks:
            if not t.done():
                t.cancel()
        raise

    return 1 if any_failed else 0


def _create_batch(args: argparse.Namespace) -> None:
    exit_code = asyncio.run(_run_create_batch(args))
    if exit_code:
        raise SystemExit(exit_code)


def _cmd_create(args: argparse.Namespace) -> int:
    prompt = _read_prompt(args.prompt, args.prompt_file)
    prompt = _augment_prompt(args, prompt)

    payload = _build_create_payload(args, prompt)
    json_out = _normalize_json_out(args.json_out, "create.json")

    if args.dry_run:
        preview = dict(payload)
        if args.input_reference:
            preview["input_reference"] = args.input_reference
        _print_request({"endpoint": "/v1/videos", **preview})
        _write_json_out(json_out, {"dry_run": True, "request": {"endpoint": "/v1/videos", **preview}})
        return 0

    client = _create_client()
    with _open_input_reference(args.input_reference) as input_ref:
        if input_ref is not None:
            payload["input_reference"] = input_ref
        video = client.videos.create(**payload)
    _print_json(video)
    _write_json_out(json_out, video)
    return 0


def _cmd_create_and_poll(args: argparse.Namespace) -> int:
    prompt = _read_prompt(args.prompt, args.prompt_file)
    prompt = _augment_prompt(args, prompt)

    payload = _build_create_payload(args, prompt)
    json_out = _normalize_json_out(args.json_out, "create-and-poll.json")

    if args.dry_run:
        preview = dict(payload)
        if args.input_reference:
            preview["input_reference"] = args.input_reference
        _print_request({"endpoint": "/v1/videos", **preview})
        print("Would poll for completion.")
        if args.download:
            variant = _normalize_variant(args.variant)
            out_path = _normalize_out_path(args.out, variant)
            print(f"Would download variant={variant} to {out_path}")
        if json_out:
            dry_bundle: Dict[str, Any] = {
                "dry_run": True,
                "request": {"endpoint": "/v1/videos", **preview},
                "poll": True,
            }
            if args.download:
                dry_bundle["download"] = {
                    "variant": variant,
                    "out": str(out_path),
                }
            _write_json_out(json_out, dry_bundle)
        return 0

    client = _create_client()
    with _open_input_reference(args.input_reference) as input_ref:
        if input_ref is not None:
            payload["input_reference"] = input_ref
        video = client.videos.create(**payload)
    _print_json(video)

    video_id = _get_video_id(video)
    if not video_id:
        _die("Could not determine video id from create response.")

    poll_interval = _normalize_poll_interval(args.poll_interval)
    timeout = _normalize_timeout(args.timeout)
    final_video = _poll_video(
        client,
        video_id,
        poll_interval=poll_interval,
        timeout=timeout,
    )
    _print_json(final_video)

    if args.download:
        status = _get_status(final_video) or "unknown"
        if status != "completed":
            _die(f"Video status is {status}; download is available only after completion.")
        variant = _normalize_variant(args.variant)
        out_path = _normalize_out_path(args.out, variant)
        data = _download_content(client, video_id, variant)
        _write_download(data, out_path, force=args.force)

    if json_out:
        _write_json_out(
            json_out,
            {"create": _to_dict(video), "final": _to_dict(final_video)},
        )

    return 0


def _cmd_poll(args: argparse.Namespace) -> int:
    poll_interval = _normalize_poll_interval(args.poll_interval)
    timeout = _normalize_timeout(args.timeout)
    json_out = _normalize_json_out(args.json_out, "poll.json")

    client = _create_client()
    final_video = _poll_video(
        client,
        args.id,
        poll_interval=poll_interval,
        timeout=timeout,
    )
    _print_json(final_video)
    _write_json_out(json_out, final_video)

    if args.download:
        status = _get_status(final_video) or "unknown"
        if status != "completed":
            _die(f"Video status is {status}; download is available only after completion.")
        variant = _normalize_variant(args.variant)
        out_path = _normalize_out_path(args.out, variant)
        data = _download_content(client, args.id, variant)
        _write_download(data, out_path, force=args.force)

    return 0


def _cmd_status(args: argparse.Namespace) -> int:
    json_out = _normalize_json_out(args.json_out, "status.json")
    client = _create_client()
    video = client.videos.retrieve(args.id)
    _print_json(video)
    _write_json_out(json_out, video)
    return 0


def _cmd_list(args: argparse.Namespace) -> int:
    params: Dict[str, Any] = {
        "limit": args.limit,
        "order": _normalize_order(args.order),
        "after": args.after,
        "before": args.before,
    }
    params = {k: v for k, v in params.items() if v is not None}
    json_out = _normalize_json_out(args.json_out, "list.json")
    client = _create_client()
    videos = client.videos.list(**params)
    _print_json(videos)
    _write_json_out(json_out, videos)
    return 0


def _cmd_delete(args: argparse.Namespace) -> int:
    json_out = _normalize_json_out(args.json_out, "delete.json")
    client = _create_client()
    result = client.videos.delete(args.id)
    _print_json(result)
    _write_json_out(json_out, result)
    return 0


def _cmd_remix(args: argparse.Namespace) -> int:
    prompt = _read_prompt(args.prompt, args.prompt_file)
    prompt = _augment_prompt(args, prompt)
    json_out = _normalize_json_out(args.json_out, "remix.json")

    if args.dry_run:
        preview = {"endpoint": f"/v1/videos/{args.id}/remix", "prompt": prompt}
        _print_request(preview)
        _write_json_out(json_out, {"dry_run": True, "request": preview})
        return 0

    client = _create_client()
    result = client.videos.remix(video_id=args.id, prompt=prompt)
    _print_json(result)
    _write_json_out(json_out, result)
    return 0


def _cmd_download(args: argparse.Namespace) -> int:
    variant = _normalize_variant(args.variant)
    out_path = _normalize_out_path(args.out, variant)

    client = _create_client()
    data = _download_content(client, args.id, variant)
    _write_download(data, out_path, force=args.force)
    return 0


class _NullContext:
    def __enter__(self):
        return None

    def __exit__(self, exc_type, exc, tb):
        return False


class _SingleFile:
    def __init__(self, path: Path):
        self._path = path
        self._handle = None

    def __enter__(self):
        self._handle = self._path.open("rb")
        return self._handle

    def __exit__(self, exc_type, exc, tb):
        if self._handle:
            try:
                self._handle.close()
            except Exception:
                pass
        return False


def _add_prompt_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--prompt")
    parser.add_argument("--prompt-file")
    parser.add_argument("--augment", dest="augment", action="store_true")
    parser.add_argument("--no-augment", dest="augment", action="store_false")
    parser.set_defaults(augment=True)

    parser.add_argument("--use-case")
    parser.add_argument("--scene")
    parser.add_argument("--subject")
    parser.add_argument("--action")
    parser.add_argument("--camera")
    parser.add_argument("--style")
    parser.add_argument("--lighting")
    parser.add_argument("--palette")
    parser.add_argument("--audio")
    parser.add_argument("--dialogue")
    parser.add_argument("--text")
    parser.add_argument("--timing")
    parser.add_argument("--constraints")
    parser.add_argument("--negative")


def _add_create_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--size", default=DEFAULT_SIZE)
    parser.add_argument("--seconds", default=DEFAULT_SECONDS)
    parser.add_argument("--input-reference")
    parser.add_argument("--dry-run", action="store_true")
    _add_prompt_args(parser)


def _add_poll_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--poll-interval", type=float, default=DEFAULT_POLL_INTERVAL)
    parser.add_argument("--timeout", type=float)


def _add_download_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--download", action="store_true")
    parser.add_argument("--variant", default=DEFAULT_VARIANT)
    parser.add_argument("--out")
    parser.add_argument("--force", action="store_true")


def _add_json_out(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--json-out")


def main() -> int:
    parser = argparse.ArgumentParser(description="Create and manage videos via the Sora Video API")
    subparsers = parser.add_subparsers(dest="command", required=True)

    create_parser = subparsers.add_parser("create", help="Create a new video job")
    _add_create_args(create_parser)
    _add_json_out(create_parser)
    create_parser.set_defaults(func=_cmd_create)

    create_poll_parser = subparsers.add_parser(
        "create-and-poll",
        help="Create a job, poll until complete, optionally download",
    )
    _add_create_args(create_poll_parser)
    _add_poll_args(create_poll_parser)
    _add_download_args(create_poll_parser)
    _add_json_out(create_poll_parser)
    create_poll_parser.set_defaults(func=_cmd_create_and_poll)

    poll_parser = subparsers.add_parser("poll", help="Poll a job until it completes")
    poll_parser.add_argument("--id", required=True)
    _add_poll_args(poll_parser)
    _add_download_args(poll_parser)
    _add_json_out(poll_parser)
    poll_parser.set_defaults(func=_cmd_poll)

    status_parser = subparsers.add_parser("status", help="Retrieve a job status")
    status_parser.add_argument("--id", required=True)
    _add_json_out(status_parser)
    status_parser.set_defaults(func=_cmd_status)

    list_parser = subparsers.add_parser("list", help="List recent video jobs")
    list_parser.add_argument("--limit", type=int)
    list_parser.add_argument("--order")
    list_parser.add_argument("--after")
    list_parser.add_argument("--before")
    _add_json_out(list_parser)
    list_parser.set_defaults(func=_cmd_list)

    delete_parser = subparsers.add_parser("delete", help="Delete a video job")
    delete_parser.add_argument("--id", required=True)
    _add_json_out(delete_parser)
    delete_parser.set_defaults(func=_cmd_delete)

    remix_parser = subparsers.add_parser("remix", help="Remix a completed video job")
    remix_parser.add_argument("--id", required=True)
    remix_parser.add_argument("--dry-run", action="store_true")
    _add_prompt_args(remix_parser)
    _add_json_out(remix_parser)
    remix_parser.set_defaults(func=_cmd_remix)

    download_parser = subparsers.add_parser("download", help="Download video/thumbnail/spritesheet")
    download_parser.add_argument("--id", required=True)
    download_parser.add_argument("--variant", default=DEFAULT_VARIANT)
    download_parser.add_argument("--out")
    download_parser.add_argument("--force", action="store_true")
    download_parser.set_defaults(func=_cmd_download)

    batch_parser = subparsers.add_parser("create-batch", help="Create multiple video jobs (JSONL input)")
    _add_create_args(batch_parser)
    batch_parser.add_argument("--input", required=True, help="Path to JSONL file (one job per line)")
    batch_parser.add_argument("--out-dir", required=True)
    batch_parser.add_argument("--concurrency", type=int, default=DEFAULT_CONCURRENCY)
    batch_parser.add_argument("--max-attempts", type=int, default=DEFAULT_MAX_ATTEMPTS)
    batch_parser.add_argument("--fail-fast", action="store_true")
    batch_parser.set_defaults(func=_create_batch)

    args = parser.parse_args()

    if getattr(args, "concurrency", 1) < 1 or getattr(args, "concurrency", 1) > 10:
        _die("--concurrency must be between 1 and 10")
    if getattr(args, "max_attempts", DEFAULT_MAX_ATTEMPTS) < 1 or getattr(args, "max_attempts", DEFAULT_MAX_ATTEMPTS) > 10:
        _die("--max-attempts must be between 1 and 10")

    dry_run = bool(getattr(args, "dry_run", False))
    _ensure_api_key(dry_run)

    args.func(args)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
