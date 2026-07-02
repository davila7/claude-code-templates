# Bounding Box Detection

Detect and localize objects within images or videos using bounding boxes. The model returns coordinates in the format `[y_min, x_min, y_max, x_max]`, normalized from 0 to 1000.

## Implementation (Python)

To ensure structured output, define a `BoundingBox` class and provide it as the `response_schema`.

```python
from google import genai
from google.genai.types import (
    GenerateContentConfig,
    Part,
)
from pydantic import BaseModel

# Define the schema for the bounding box
class BoundingBox(BaseModel):
    box_2d: list[int]
    label: str

client = genai.Client()

config = GenerateContentConfig(
    system_instruction="""
    Return bounding boxes as an array with labels.
    Never return masks. Limit to 25 objects.
    """,
    response_mime_type="application/json",
    response_schema=list[BoundingBox],
)

image_uri = "gs://cloud-samples-data/generative-ai/image/socks.jpg"

response = client.models.generate_content(
    model="gemini-3-flash-preview",
    contents=[
        Part.from_uri(file_uri=image_uri, mime_type="image/jpeg"),
        "Detect the socks in the image and provide bounding boxes.",
    ],
    config=config,
)

# Access the detected boxes
for bbox in response.parsed:
    print(f"Label: {bbox.label}, Box: {bbox.box_2d}")
```

## Coordinate System
- **Format**: `[y_min, x_min, y_max, x_max]`
- **Normalization**: Coordinates are integers from `0` to `1000`.
- **Origin**: `[0, 0]` is the top-left corner of the image.

## Visualization Helper
To visualize the results, scale the normalized coordinates back to the original image dimensions.

```python
def scale_box(box_2d, width, height):
    y_min, x_min, y_max, x_max = box_2d
    return [
        int(y_min / 1000 * height),
        int(x_min / 1000 * width),
        int(y_max / 1000 * height),
        int(x_max / 1000 * width)
    ]
```
