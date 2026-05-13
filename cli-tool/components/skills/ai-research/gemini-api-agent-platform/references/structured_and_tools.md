# Structured Output and Tools

## Structured Output (JSON Schema)
Enforce a specific JSON schema using standard Python type hints or Pydantic models.

```python
from google import genai
from google.genai import types
from pydantic import BaseModel

class Recipe(BaseModel):
    recipe_name: str
    ingredients: list[str]

client = genai.Client()
response = client.models.generate_content(
    model="gemini-3-flash-preview",
    contents="List a few popular cookie recipes.",
    config=types.GenerateContentConfig(
        response_mime_type="application/json",
        response_json_schema=list[Recipe],
    ),
)
# response.text is guaranteed to be valid JSON matching the schema
print(response.text)
 # Returns list of Recipe objects
print(response.parsed)
```

## Function Calling
Let the model output function calls that you can execute.

```python
from google import genai
from google.genai import types

def get_current_weather(location: str) -> str:
    """Example method. Returns the current weather.
    Args: location: The city and state, e.g. San Francisco, CA
    """
    if 'boston' in location.lower():
        return "Snowing"
    return "Sunny"

client = genai.Client()
response = client.models.generate_content(
    model="gemini-3-flash-preview",
    contents="What is the weather like in Boston?",
    config=types.GenerateContentConfig(tools=[get_current_weather]),
)

if response.function_calls:
    print('Function calls requested by the model:')
    for function_call in response.function_calls:
        print(f'- Function: {function_call.name}')
        print(f'- Args: {dict(function_call.args)}')
else:
    print('The model responded directly:')
    print(response.text)
```

## Search Grounding
Ground the model's responses in Google Search or your own enterprise data with Agent Search (formerly known as Vertex AI Search).

```python
from google import genai
from google.genai import types

client = genai.Client()

response = client.models.generate_content(
    model="gemini-3-flash-preview",
    contents="When is the next total solar eclipse in the US?",
    config=types.GenerateContentConfig(
        tools=[
            types.Tool(google_search=types.GoogleSearch())
        ],
    ),
)
print(response.text)
# Search details
print(f'Search Query: {response.candidates[0].grounding_metadata.web_search_queries}')
# Inspect grounding metadata
print(response.candidates[0].grounding_metadata.search_entry_point.rendered_content)
# Urls used for grounding
print(f"Search Pages: {', '.join([site.web.title for site in response.candidates[0].grounding_metadata.grounding_chunks])}")
```

## Code Execution
Allow the model to run Python code to calculate answers precisely.

```python
from google import genai
from google.genai import types

client = genai.Client()

response = client.models.generate_content(
    model="gemini-3-flash-preview",
    contents="Calculate 20th fibonacci number.",
    config=types.GenerateContentConfig(
        tools=[types.Tool(code_execution=types.ToolCodeExecution())],
    ),
)
print(response.executable_code)
print(response.code_execution_result)
```

## Url Context
You can use the URL context tool to provide Gemini with URLs as additional context for your prompt. The model can then retrieve content from the URLs and use that content to inform and shape its response.

```python
from google import genai
from google.genai import types

client = genai.Client()

response = client.models.generate_content(
    model=model_id,
    contents="Compare recipes from http://example.com and http://example2.com",
    config=GenerateContentConfig(
        tools=[types.Tool(url_context=types.UrlContext)],
    )
)

print(response.text)
# get URLs retrieved for context
print(response.candidates[0].url_context_metadata)
```
