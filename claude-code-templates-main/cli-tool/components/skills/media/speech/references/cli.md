# CLI reference (`scripts/text_to_speech.py`)

This file contains the "command catalog" for the bundled speech generation CLI. Keep `SKILL.md` as overview-first; put verbose CLI details here.

## What this CLI does
- `speak`: generate a single audio file
- `speak-batch`: run many jobs from a JSONL file (one job per line)
- `list-voices`: list supported voices

Real API calls require network access + `OPENAI_API_KEY`. `--dry-run` does not.

## Quick start (works from any repo)
Set a stable path to the skill CLI (default `CODEX_HOME` is `~/.codex`):

```
export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
export TTS_GEN="$CODEX_HOME/skills/speech/scripts/text_to_speech.py"
```

Dry-run (no API call; no network required; does not require the `openai` package):

```
python "$TTS_GEN" speak --input "Test" --dry-run
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
- Use `python "$TTS_GEN" ...` (or equivalent full path) for all TTS work.
- Do **not** create one-off runners (e.g., `gen_audio.py`) unless the user explicitly asks.
- **Never modify** `scripts/text_to_speech.py`. If something is missing, ask the user before doing anything else.

## Defaults (unless overridden by flags)
- Model: `gpt-4o-mini-tts-2025-12-15`
- Voice: `cedar`
- Response format: `mp3`
- Speed: `1.0`
- Batch rpm cap: `50`

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

## See also
- API parameter quick reference: `references/audio-api.md`
- Instruction patterns and examples: `references/voice-directions.md`
