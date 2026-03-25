# Audio Speech API quick reference

## Endpoint
- Create speech: `POST /v1/audio/speech`

## Default model
- `gpt-4o-mini-tts-2025-12-15`

## Other speech models (if requested)
- `gpt-4o-mini-tts`
- `tts-1`
- `tts-1-hd`

## Core parameters
- `model`: speech model
- `input`: text to synthesize (max 4096 characters)
- `voice`: built-in voice name
- `instructions`: optional style directions (not supported for `tts-1` or `tts-1-hd`)
- `response_format`: `mp3`, `opus`, `aac`, `flac`, `wav`, or `pcm`
- `speed`: 0.25 to 4.0

## Built-in voices
- `alloy`, `ash`, `ballad`, `cedar`, `coral`, `echo`, `fable`, `marin`, `nova`, `onyx`, `sage`, `shimmer`, `verse`

## Output notes
- Default format is `mp3`.
- `pcm` is raw 24 kHz 16-bit little-endian samples (no header).
- `wav` includes a header (better for quick playback).

## Compliance note
- Provide a clear disclosure that the voice is AI-generated.
