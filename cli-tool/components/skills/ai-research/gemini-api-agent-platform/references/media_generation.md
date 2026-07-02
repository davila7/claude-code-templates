# Media Generation

## Image Generation
Generate images using `gemini-3.1-flash-image-preview`.

```python
from google import genai
from google.genai import types

client = genai.Client()

response = client.models.generate_content(
    model="gemini-3.1-flash-image-preview",
    contents="A dog reading a newspaper",
)

for part in response.parts:
    if part.text is not None:
        print(part.text)
    elif part.inline_data is not None:
        image = part.as_image()
        image.save("generated_image.png")
```

For high-resolution images or using the Search tool, use `gemini-3-pro-image-preview`.

```python
from google import genai
from google.genai import types

client = genai.Client()

response = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents="A dog reading a newspaper",
    config=types.GenerateContentConfig(
        image_config=types.ImageConfig(
            aspect_ratio="16:9",
            image_size="2K"
        )
    )
)

for part in response.parts:
    if part.text is not None:
        print(part.text)
    elif part.inline_data is not None:
        image = part.as_image()
        image.save("generated_image.png")
```

## Image Editing
It is recommended to use chat mode for editing images.

```python
from google import genai
from PIL import Image

client = genai.Client()

prompt = "A small white ceramic bowl with lemons and limes"
image = Image.open('fruit.png')

# Create the chat
chat = client.chats.create(model='gemini-3.1-flash-image-preview')

# Send the image and ask for it to be edited
response = chat.send_message([prompt, image])

# Get the text and the image generated
for i, part in enumerate(response.candidates[0].content.parts):
    if part.text is not None:
        print(part.text)
    elif part.inline_data is not None:
        image = part.as_image()
        image.save(f'generated_image_{i}.png')

# Continue iterating
chat.send_message('Make the bowl blue')
```

## Video Generation
Generate video using the Veo model. Usage of Veo can be costly, so check pricing for Veo. Start with the fast model (`veo-3.1-fast-generate-001`) since the result quality is usually sufficient, and swap to the larger model if needed.

```python
import time
from google import genai
from google.genai import types
from PIL import Image

client = genai.Client()

image = Image.open('image.png') # Optional initial image

# Video generation is an async operation
operation = client.models.generate_videos(
    model="veo-3.1-fast-generate-001",
    prompt="a cat reading a book",
    image=image,
    config=types.GenerateVideosConfig(
        person_generation="dont_allow",
        aspect_ratio="16:9",
        number_of_videos=1,
        duration_seconds=5,
        output_gcs_uri="gs://your-bucket/your-prefix",
    ),
)

# Poll for completion
while not operation.done:
    time.sleep(20)
    operation = client.operations.get(operation)

if operation.response:
    print(operation.result.generated_videos[0].video.uri)
```
