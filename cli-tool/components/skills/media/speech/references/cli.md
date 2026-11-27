# CLI reference (`scripts/text_to_speech.py`)

This file contains the "command catalog" for the bundled speech generation CLI. Keep `SKILL.md` as overview-first; put verbose CLI details here.

## What this CLI does
- `speak`: generate a single audio file
- `speak-batch`: run many jobs from a JSONL file (one job per line)
- `list-voices`: list supported voices

Real API calls require network access + `OPENAI_API_KEY`. `--dry-run` does not.

OpenAI remains the default workflow. When the user explicitly selects Atlas Cloud,
use `scripts/atlas_text_to_speech.py`; it has the same three subcommands, requires
`ATLASCLOUD_API_KEY` for live calls, and needs no third-party Python package.

## Quick start (works from any repo)
Set a stable path to the skill CLI (default `CODEX_HOME` is `~/.codex`):

```
export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
export TTS_GEN="$CODEX_HOME/skills/speech/scripts/text_to_speech.py"
export ATLAS_TTS_GEN="$CODEX_HOME/skills/speech/scripts/atlas_text_to_speech.py"
```

Dry-run (no API call; no network required; does not require the `openai` package):

```
python "$TTS_GEN" speak --input "Test" --dry-run
```

Atlas Cloud dry-run:

```
python "$ATLAS_TTS_GEN" speak \
  --input "Test" \
  --voice eve \
  --language auto \
  --dry-run
```

Generate (requires `OPENAI_API_KEY` + network):

```
uv run --with openai python "$TTS_GEN" speak \
  --input "Today is a wonderful day to build something people love!" \
  --voice cedar \
  --instructions "Voice Affect: Warm and composed. Tone: upbeat and encouraging." \
  --response-format mp3 \
  --out speech.mp3
```

No `uv` installed? Use your active Python env:

```
python "$TTS_GEN" speak --input "Hello" --voice cedar --out speech.mp3
```

## Guardrails (important)
- Use `python "$TTS_GEN" ...` (or equivalent full path) for the default OpenAI workflow.
- Use `python "$ATLAS_TTS_GEN" ...` only after the user selects Atlas Cloud.
- Atlas generation POSTs are never retried. Its prediction GET polling is finite.
- Atlas output downloads never receive the API key and reject private-network URLs.
- Do **not** create one-off runners (e.g., `gen_audio.py`) unless the user explicitly asks.

## Defaults (unless overridden by flags)
- Model: `$OPENAI_TTS_MODEL`, else `gpt-4o-mini-tts-2025-12-15`
- Voice: `$OPENAI_TTS_VOICE`, else `cedar`
- Response format: `mp3`
- Speed: `1.0`
- Batch rpm cap: `50`

Atlas Cloud defaults are model `xai/tts-v1`, multilingual voice `eve`, language
`auto`, codec `mp3`, 2-second polling, and at most 120 polls.

## Input limits
- Input text must be <= 4096 characters per request.
- For longer text, split into smaller chunks (manual or via batch JSONL).

## Instructions compatibility
- `instructions` are supported for GPT-4o mini TTS models.
- `tts-1` and `tts-1-hd` ignore instructions (the CLI will warn and drop them).

## Common recipes

List voices:
```
python "$TTS_GEN" list-voices
```

Generate with explicit pacing:
```
python "$TTS_GEN" speak \
  --input "Welcome to the demo. We'll show how it works." \
  --instructions "Tone: friendly and confident. Pacing: steady and moderate." \
  --out demo.mp3
```

Batch generation (JSONL):
```
mkdir -p tmp/speech
cat > tmp/speech/jobs.jsonl << 'JSONL'
{"input":"Thank you for calling. Please hold.","voice":"cedar","response_format":"mp3","out":"hold.mp3"}
{"input":"For sales, press 1. For support, press 2.","voice":"marin","instructions":"Tone: clear and neutral. Pacing: slow.","response_format":"wav"}
JSONL

python "$TTS_GEN" speak-batch --input tmp/speech/jobs.jsonl --out-dir out --rpm 50

# Cleanup (recommended)
rm -f tmp/speech/jobs.jsonl
```

Notes:
- Use `--rpm` to control rate limiting (default `50`, max `50`).
- Per-job overrides are supported in JSONL (`model`, `voice`, `response_format`, `speed`, `instructions`, `out`).
- Treat the JSONL file as temporary: write it under `tmp/` and delete it after the run (do not commit it).

Another OpenAI-compatible speech server (these set the defaults; an explicit `--voice` or per-job `voice` must use the server's own ids):
```
export OPENAI_BASE_URL="http://localhost:8000/v1"
export OPENAI_API_KEY="<that server's key, or any non-empty value if it doesn't check keys>"
export OPENAI_TTS_MODEL="<its model id>"
export OPENAI_TTS_VOICE="<its voice id>"
python "$TTS_GEN" speak --input "Hello" --out hello.mp3
```

Notes:
- When `OPENAI_BASE_URL` names a host other than `openai.com` or one of its subdomains, voice ids outside OpenAI's list are sent exactly as given. OpenAI's own voice names are still lower-cased. A proxy or gateway in front of OpenAI counts as another server, so the local voice check is skipped there.
- `OPENAI_API_KEY` is sent to that host, so don't leave a real OpenAI key exported while pointing at someone else's server.
- `list-voices` still prints OpenAI's list, with a warning; use the server's own voice list instead.
- The CLI's limits still apply: 4096 characters per request, `--rpm` up to 50, the six formats, and speed 0.25 to 4.0.

## See also
- API parameter quick reference: `references/audio-api.md`
- Atlas Cloud workflow: `references/atlas-cloud.md`
- Instruction patterns and examples: `references/voice-directions.md`
