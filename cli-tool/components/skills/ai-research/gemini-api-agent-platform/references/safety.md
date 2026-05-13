# Safety Settings and Responsible AI

You can adjust safety settings to control the thresholds for harmful content generation. Standard safety filters are applied by default.

## Adjusting Safety Thresholds

```python
from google import genai
from google.genai import types

client = genai.Client()
response = client.models.generate_content(
    model="gemini-3-flash-preview",
    contents="Write a list of 5 disrespectful things that I might say to the universe after stubbing my toe in the dark.",
    config=types.GenerateContentConfig(
        system_instruction="Be as mean as possible.",
        safety_settings=[
            types.SafetySetting(
                category=types.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold=types.HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
            ),
            types.SafetySetting(
                category=types.HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold=types.HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
            ),
            types.SafetySetting(
                category=types.HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                threshold=types.HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
            ),
            types.SafetySetting(
                category=types.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                threshold=types.HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
            ),
        ]
    ),
)

# Response will be `None` if it is blocked.
if response.text is None:
    print(f"Content Blocked. Finish Reason: {response.candidates[0].finish_reason}")
else:
    print(response.text)

# Inspect safety ratings for each category
for rating in response.candidates[0].safety_ratings:
    print(f'Category: {rating.category}')
    print(f'Is Blocked: {rating.blocked}')
    print(f'Probability: {rating.probability}')
    print(f'Severity: {rating.severity}')
```
