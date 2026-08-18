# Atlas Cloud speech backend

Use this backend only when the user explicitly selects Atlas Cloud. The default
OpenAI speech workflow and `scripts/text_to_speech.py` remain unchanged.

## Configuration

Set the API key locally and never place it in prompts, committed files, command
output, or generated metadata:

```
export ATLASCLOUD_API_KEY="your-key"
```

The Atlas CLI is stdlib-only:

```
export ATLAS_TTS_GEN="$CODEX_HOME/skills/speech/scripts/atlas_text_to_speech.py"
python "$ATLAS_TTS_GEN" speak --input "Hello from Atlas Cloud" --dry-run
```

## Live generation

The default model is `xai/tts-v1`. Its default multilingual voice is `eve`,
language is `auto`, codec is `mp3`, and speed is `1.0`:

```
python "$ATLAS_TTS_GEN" speak \
  --input "Welcome to the product tour." \
  --voice eve \
  --language en \
  --codec mp3 \
  --out output/speech/tour.mp3
```

The five multilingual voices are `ara`, `eve`, `leo`, `rex`, and `sal`. Run
`python "$ATLAS_TTS_GEN" list-voices` to print them. The supported speed range
is 0.7 through 1.5.

## Batch generation

Each JSONL line is one job. Per-job `model`, `language`, `voice`, `codec`,
`speed`, and `out` values override command defaults:

```
python "$ATLAS_TTS_GEN" speak-batch \
  --input tmp/speech/jobs.jsonl \
  --out-dir output/speech
```

## Request contract

1. The CLI sends one `POST /api/v1/model/generateAudio` request. It never
   automatically retries a generation submission.
2. It prints the prediction ID to stderr before polling, so an interrupted task
   remains recoverable.
3. It polls `GET /api/v1/model/prediction/{id}` with bounded retries and stops
   after `--poll-attempts` (120 by default).
4. It downloads the first completed output over HTTPS without an Authorization
   header, validates redirects, rejects private-network targets, limits the file
   to 100 MiB, and refuses to overwrite unless `--force` is set.

If submission fails, report the error and do not resubmit automatically. If
polling is interrupted after an ID was printed, inspect that existing prediction
rather than starting a second paid generation.

## Model-specific notes

- `xai/tts-v1` accepts up to 15,000 text characters.
- Use `language=auto` unless the user requests an explicit language.
- Inline speech tags such as `[pause]` are part of the text. The separate OpenAI
  `instructions` parameter is not sent to Atlas Cloud.
- Valid codecs are `mp3`, `wav`, `pcm`, `mulaw`, and `alaw`.
