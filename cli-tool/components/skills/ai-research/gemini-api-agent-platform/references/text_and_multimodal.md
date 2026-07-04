# Text and Multimodal Generation

## Basic Text Generation
```python
from google import genai

client = genai.Client()
response = client.models.generate_content(
    model="gemini-3-flash-preview",
    contents="How does AI work?"
)
print(response.text)
```

## Chat (Multi-turn conversations)
```python
from google import genai
from google.genai import types

client = genai.Client()
chat_session = client.chats.create(
    model="gemini-3-flash-preview",
    history=[
        types.UserContent(parts=[types.Part.from_text(text="Hello")]),
        types.ModelContent(parts=[types.Part.from_text(text="Great to meet you. What would you like to know?")]),
    ],
)
response = chat_session.send_message("Tell me a story.")
print(response.text)
```

## Synchronous Streaming

Generate content in a streaming format so that the model outputs streams back
to you, rather than being returned as one chunk.

```python
from google import genai
from google.genai import types

client = genai.Client()
for chunk in client.models.generate_content_stream(
    model="gemini-3-flash-preview", contents="Tell me a story in 300 words."
):
    print(chunk.text, end='')
```

## Multimodal Inputs (Images, Audio, Video)
You can provide files natively using Google Cloud Storage URIs or local bytes.

```python
from google import genai
from google.genai import types

client = genai.Client()

gcs_image = types.Part.from_uri(file_uri="gs://cloud-samples-data/generative-ai/image/scones.jpg", mime_type="image/jpeg")

with open("local_image.jpg", "rb") as f:
    local_image = types.Part.from_bytes(data=f.read(), mime_type="image/jpeg")

response = client.models.generate_content(
    model="gemini-3-flash-preview",
    contents=[
        "Generate a list of all the objects contained in both images.",
        gcs_image,
        local_image,
    ],
)
print(response.text)
```

### YouTube Videos
```python
from google import genai
from google.genai import types

client = genai.Client()
response = client.models.generate_content(
    model="gemini-3-flash-preview",
    contents=[
        types.Part.from_uri(
            file_uri="https://www.youtube.com/watch?v=3KtWfp0UopM",
            mime_type="video/mp4",
        ),
        "Write a short and engaging blog post based on this video.",
    ],
)
print(response.text)
```
