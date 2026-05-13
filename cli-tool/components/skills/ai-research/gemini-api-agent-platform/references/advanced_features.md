# Advanced Features

## Content Caching
Cache large documents or contexts to reduce cost and latency.

```python
from google import genai
from google.genai import types

client = genai.Client()

content_cache = client.caches.create(
    model="gemini-3-flash-preview",
    config=types.CreateCachedContentConfig(
        contents=[
            types.Content(
                role="user",
                parts=[types.Part.from_uri(file_uri="gs://your-bucket/large.pdf", mime_type="application/pdf")]
            )
        ],
        system_instruction="You are an expert researcher.",
        display_name="example-cache",
        ttl="86400s",
    ),
)

# Use the cache
response = client.models.generate_content(
    model="gemini-3-flash-preview",
    contents="Summarize the pdf",
    config=types.GenerateContentConfig(
        cached_content=content_cache.name
    ),
)
```

## Batch Prediction
For processing large datasets asynchronously.

```python
import time
from google import genai
from google.genai import types

client = genai.Client()

job = client.batches.create(
    model="gemini-3-flash-preview",
    src="gs://your-bucket/prompts.jsonl",
    config=types.CreateBatchJobConfig(dest="gs://your-bucket/outputs"),
)

completed_states = {types.JobState.JOB_STATE_SUCCEEDED, types.JobState.JOB_STATE_FAILED, types.JobState.JOB_STATE_CANCELLED}
while job.state not in completed_states:
    time.sleep(30)
    job = client.batches.get(name=job.name)
```

### Thinking (Reasoning)

Thinking is on by default for `gemini-3.1-pro-preview` and `gemini-3-flash-preview`.
It can be adjusted by using the `thinking_level` parameter.

- **`MINIMAL`:** (Gemini 3 Flash Only) Constrains the model to use as few tokens as possible for thinking and is best used for low-complexity tasks that wouldn't benefit from extensive reasoning.
- **`LOW`**: Constrains the model to use fewer tokens for thinking and is suitable for simpler tasks where extensive reasoning is not required.
- **`MEDIUM`**: Offers a balanced approach suitable for tasks of moderate complexity that benefit from reasoning but don't require deep, multi-step planning.
- **`HIGH`**: (Default) Maximizes reasoning depth. The model may take significantly longer to reach a first token, but the output will be more thoroughly vetted.

```python
from google import genai
from google.genai import types

client = genai.Client()
response = client.models.generate_content(
    model="gemini-3.1-pro-preview",
    contents="solve x^2 + 4x + 4 = 0",
    config=types.GenerateContentConfig(
        thinking_config=types.ThinkingConfig(
            thinking_level=types.ThinkingLevel.HIGH
        )
    )
)

# Access thoughts if returned
for part in response.candidates[0].content.parts:
    if part.thought:
        print(f"Thought: {part.text}")
    else:
        print(f"Final Answer: {part.text}")
```

## Model Context Protocol (MCP) support (experimental)

Built-in [MCP](https://modelcontextprotocol.io/introduction) support is an experimental feature. You can pass a local MCP server as a tool directly.

```python
import os
import asyncio
from datetime import datetime
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

from google import genai
from google.genai import types

client = genai.Client()

# Create server parameters for stdio connection
server_params = StdioServerParameters(
    command="npx",  # Executable
    args=["-y", "@philschmid/weather-mcp"],  # MCP Server
    env=None,  # Optional environment variables
)

async def run():
    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            # Prompt to get the weather for the current day in London.
            prompt = f"What is the weather in London in {datetime.now().strftime('%Y-%m-%d')}?"

            # Initialize the connection between client and server
            await session.initialize()

            # Send request to the model with MCP function declarations
            response = await client.aio.models.generate_content(
                model="gemini-3-flash-preview",
                contents=prompt,
                config=types.GenerateContentConfig(
                    tools=[session],  # uses the session, will automatically call the tool using automatic function calling
                ),
            )
            print(response.text)

# Start the asyncio event loop and run the main function
asyncio.run(run())
```
