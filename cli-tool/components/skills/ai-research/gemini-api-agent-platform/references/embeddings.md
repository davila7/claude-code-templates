# Text and Multimodal Embeddings

Generate embeddings for text or multimodal content (images and videos) to perform semantic search, clustering, and other NLP tasks. Text and multimodal embedding vectors share the same semantic space, which allows you to use them interchangeably for cross-modal applications like searching for an image using a text query, or searching for a video using an image.

## Basic Usage (Text)

```python
from google import genai
from google.genai import types

client = genai.Client()
response = client.models.embed_content(
    model="gemini-embedding-2",
    contents=[
        "How do I get a driver's license/learner's permit?",
        "How long is my driver's license valid for?",
    ],
    # Optional Parameters
    config=types.EmbedContentConfig(task_type="RETRIEVAL_DOCUMENT", output_dimensionality=768),
)
print(response.embeddings)
```

## Multimodal Embeddings (Image and Video)

To generate embeddings for images and videos, use the `types.Part.from_uri` method to point the model to a Google Cloud Storage (GCS) URI containing the media file, and provide the appropriate MIME type.

### Image Embeddings

For images, provide the GCS URI of the image and set the MIME type (e.g., `image/jpeg`).

```python
from google import genai
from google.genai import types

client = genai.Client()
response = client.models.embed_content(
    model="gemini-embedding-2",
    contents=types.Part.from_uri(
        file_uri="gs://github-repo/embeddings/getting_started_embeddings/gms_images/GGOEACBA104999.jpg",
        mime_type="image/jpeg"
    ),
    config=types.EmbedContentConfig(output_dimensionality=768),
)

image_embedding = response.embeddings[0].values
print(f"Length of image embedding: {len(image_embedding)}")
```

### Video Embeddings

Generating embeddings for a video works similarly. However, instead of a single vector, the API returns a list of embedding vectors—one representing each frame segment or interval of the processed video.

```python
from google import genai
from google.genai import types

client = genai.Client()
response = client.models.embed_content(
    model="gemini-embedding-2",
    contents=types.Part.from_uri(
        file_uri="gs://github-repo/embeddings/getting_started_embeddings/UCF-101-subset/BrushingTeeth/v_BrushingTeeth_g01_c02.mp4",
        mime_type="video/mp4"
    ),
    config=types.EmbedContentConfig(output_dimensionality=768),
)

# Extract embedding values for each video segment
video_embeddings =[emb.values for emb in response.embeddings]

print(f"Number of video segment embeddings returned: {len(video_embeddings)}")
print(f"First segment embedding length: {len(video_embeddings[0])}")
```

### Cross-Modal Search

Because these vectors share a semantic space, you can calculate the dot product or cosine similarity between different types of embeddings. For example, you can calculate the similarity between a text query embedding ("A music concert") and a pre-computed database of image or video embeddings to build a robust multimodal semantic search engine.
