# Live API

The Live API provides real-time, low-latency bidirectional streaming via WebSockets. It is ideal for interactive voice and video applications.

```python
import asyncio
from google import genai
from google.genai import types

async def generate_content():
    client = genai.Client()
    model_id = "gemini-live-2.5-flash-native-audio"

    config = types.LiveConnectConfig(
        response_modalities=[types.LiveModality.TEXT], # Change to AUDIO for voice responses
    )

    async with client.aio.live.connect(model=model_id, config=config) as session:
        text_input = "Hello? Gemini, are you there?"
        await session.send_client_content(
            turns=types.Content(role="user", parts=[types.Part.from_text(text=text_input)])
        )

        async for message in session.receive():
            if message.text:
                print(message.text, end="")

asyncio.run(generate_content())
```

For sending audio:
```python
await session.send_realtime_input(
    media=Blob(data=audio_bytes, mime_type="audio/pcm;rate=16000")
)
```
