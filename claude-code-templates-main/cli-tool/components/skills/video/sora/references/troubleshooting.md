# Troubleshooting

## Job fails with size or seconds errors
- Cause: size not supported by model, or seconds not in 4/8/12.
- Fix: match size to model; use only "4", "8", or "12" seconds (see `references/video-api.md`).
- If you see `invalid_type` for seconds, update `scripts/sora.py` or pass a string value for `--seconds`.

## openai SDK not installed
- Cause: running `python "$SORA_CLI" ...` without the OpenAI SDK available.
- Fix: run with `uv run --with openai python "$SORA_CLI" ...` instead of using pip directly.

## uv cache permission error
- Cause: uv cache directory is not writable in CI or sandboxed environments.
- Fix: set `UV_CACHE_DIR=/tmp/uv-cache` (or another writable path) before running `uv`.

## Prompt shell escaping issues
- Cause: multi-line prompts or quotes break the shell.
- Fix: use `--prompt-file prompt.txt` (see `references/cli.md` for an example).

## Prompt looks double-wrapped ("Primary request: Use case: ...")
- Cause: you structured the prompt manually but left CLI augmentation on.
- Fix: add `--no-augment` when passing a structured prompt file, or use the CLI fields (`--use-case`, `--scene`, etc.) instead of pre-formatting.

## Input reference rejected
- Cause: file is not jpg/png/webp, or has a human face, or dimensions do not match target size.
- Fix: convert to jpg/png/webp, remove faces, and resize to match `--size`.

## Download fails or returns expired URL
- Cause: download URLs expire after about 1 hour.
- Fix: re-download while the link is fresh; save to your own storage.

## Video completes but looks unstable or flickers
- Cause: multiple actions or aggressive camera motion.
- Fix: reduce to one main action and one camera move; keep beats simple; add constraints like "avoid flicker" or "stable motion".

## Text is unreadable
- Cause: text too long, too small, or moving.
- Fix: shorten text, increase size, keep camera locked-off, and avoid fast motion.

## Remix drifts from the original
- Cause: too many changes requested at once.
- Fix: state invariants explicitly ("same shot and camera move") and change only one element per remix.

## Job stuck in queued/in_progress for a long time
- Cause: temporary queue delays.
- Fix: increase poll timeout, or retry later; avoid high concurrency if you are rate-limited.

## create-and-poll times out in CI/sandbox
- Cause: long-running CLI commands can exceed CI time limits.
- Fix: run `create` (capture the ID) and then `poll` separately, or set `--timeout`.

## Audio or voiceover missing / incorrect
- Cause: audio wasn't explicitly requested, or the dialogue/audio cue was too long or vague.
- Fix: add a clear `Audio:` line and a short `Dialogue:` block.

## Cleanup blocked by sandbox policy
- Cause: some environments block `rm`.
- Fix: skip cleanup, or truncate files instead of deleting.
