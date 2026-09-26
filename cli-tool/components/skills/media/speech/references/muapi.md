# MuAPI speech backend

Use this backend only when the user explicitly selects MuAPI. The default
speech workflow and `scripts/text_to_speech.py` remain unchanged.

The bundled CLI uses the current `elevenlabs-tts-turbo-2-5` text-to-audio
capability through MuAPI's asynchronous API. It sends the text as `prompt`,
supports the model's verified voice IDs and language codes, polls the prediction
with a finite limit, and downloads the resulting audio without forwarding the
API key.

## Setup

Create a MuAPI key from the [MuAPI access keys page](https://muapi.ai/access-keys)
and set it in the local environment:

```bash
export MUAPI_API_KEY="<your-key>"
export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
export MUAPI_TTS_GEN="$CODEX_HOME/skills/speech/scripts/muapi-text-to-speech.py"
```

Keep the key in the environment; do not put it in prompts, JSONL files, shell
history, source files, or generated metadata.

## Commands

Inspect the currently published model metadata (read-only):

```bash
python "$MUAPI_TTS_GEN" models
python "$MUAPI_TTS_GEN" list-voices
```

Dry-run without network access or a key:

```bash
python "$MUAPI_TTS_GEN" speak \
  --input "Welcome to the demo." \
  --language-code en \
  --dry-run
```

Generate one clip:

```bash
python "$MUAPI_TTS_GEN" speak \
  --input "Welcome to the demo." \
  --voice-id IKne3meq5aSn9XLyUdCD \
  --out output/speech/welcome.mp3
```

Generate JSONL jobs. Each line may contain `input` (or `text`), `out`,
`voice_id`, `language_code`, `stability`, `similarity_boost`, and `speed`:

```bash
python "$MUAPI_TTS_GEN" speak-batch \
  --input tmp/speech/jobs.jsonl \
  --out-dir output/speech
```

## Guardrails

- MuAPI is opt-in; OpenAI remains the skill default.
- The model and API origin are fixed to the verified MuAPI contract.
- The generation POST is sent once. Only prediction GET polling is retried.
- Polling is bounded to at most 120 attempts; the default is 60.
- Input is limited to 40,000 characters, matching the published model schema.
- Speed, stability, and similarity boost values reject non-finite numbers and
  values outside the model's published ranges.
- Output URLs must use HTTPS and resolve to public hosts. Redirects are checked
  too, DNS is revalidated and pinned at connection setup, and downloads are
  written to a temporary file before atomic replacement.
- The download request does not include `MUAPI_API_KEY`.
- Generated speech is AI-generated; disclose that when sharing the audio.

For the provider's current model and API details, see the official
[MuAPI text-to-speech page](https://muapi.ai/text-to-speech) and
[music and speech documentation](https://muapi.ai/docs/music-and-speech).
