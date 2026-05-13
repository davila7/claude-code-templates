---
name: gemini-api-agent-platform
description: Guides the usage of the Gemini API on Agent Platform with the Google Gen AI SDK for enterprise AI applications. Covers SDK usage (Python, JS/TS, Go, Java, C#), capabilities like Live API, tools, multimedia generation, caching, and batch prediction.
compatibility: Requires active Google Cloud credentials and Agent Platform API enabled.
source: google/skills (Apache 2.0)
---

IMPORTANT: Agent Platform (full name Gemini Enterprise Agent Platform) was previously named "Vertex AI" and many web resources use the legacy branding.

# Gemini API in Agent Platform

Access Google's most advanced AI models built for enterprise use cases using the Gemini API in Agent Platform.

Provide these key capabilities:

- **Text generation** - Chat, completion, summarization
- **Multimodal understanding** - Process images, audio, video, and documents
- **Function calling** - Let the model invoke your functions
- **Structured output** - Generate valid JSON matching your schema
- **Context caching** - Cache large contexts for efficiency
- **Embeddings** - Generate text embeddings for semantic search
- **Live Realtime API** - Bidirectional streaming for low latency Voice and Video interactions
- **Batch Prediction** - Handle massive async dataset prediction workloads

## Core Directives

- **Unified SDK**: ALWAYS use the Gen AI SDK (`google-genai` for Python, `@google/genai` for JS/TS, `google.golang.org/genai` for Go, `com.google.genai:google-genai` for Java, `Google.GenAI` for C#).
- **Legacy SDKs**: DO NOT use `google-cloud-aiplatform`, `@google-cloud/vertexai`, or `google-generativeai`.

## SDKs

- **Python**: Install `google-genai` with `pip install google-genai`
- **JavaScript/TypeScript**: Install `@google/genai` with `npm install @google/genai`
- **Go**: Install `google.golang.org/genai` with `go get google.golang.org/genai`
- **C#/.NET**: Install `Google.GenAI` with `dotnet add package Google.GenAI`
- **Java**:
  - groupId: `com.google.genai`, artifactId: `google-genai`
  - Latest version can be found here: https://central.sonatype.com/artifact/com.google.genai/google-genai/versions (let's call it `LAST_VERSION`)
  - Install in `build.gradle`:

    ```
    implementation("com.google.genai:google-genai:${LAST_VERSION}")
    ```

  - Install Maven dependency in `pom.xml`:

    ```xml
    <dependency>
	    <groupId>com.google.genai</groupId>
	    <artifactId>google-genai</artifactId>
	    <version>${LAST_VERSION}</version>
	</dependency>
    ```

> [!WARNING]
> Legacy SDKs like `google-cloud-aiplatform`, `@google-cloud/vertexai`, and `google-generativeai` are deprecated. Migrate to the new SDKs above urgently by following the Migration Guide.

## Authentication & Configuration

Prefer environment variables over hard-coding parameters when creating the client. Initialize the client without parameters to automatically pick up these values.

### Application Default Credentials (ADC)
Set these variables for standard [Google Cloud authentication](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/start/gcp-auth):
```bash
export GOOGLE_CLOUD_PROJECT='your-project-id'
export GOOGLE_CLOUD_LOCATION='global'
export GOOGLE_GENAI_USE_VERTEXAI=true
```
- By default, use `location="global"` to access the global endpoint, which provides automatic routing to regions with available capacity.
- If a user explicitly asks to use a specific region (e.g., `us-central1`, `europe-west4`), specify that region in the `GOOGLE_CLOUD_LOCATION` parameter instead. Reference the [supported regions documentation](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/locations) if needed.

### Agent Platform in Express Mode
Set these variables when using [Express Mode](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/start/api-keys?usertype=expressmode) with an API key:
```bash
export GOOGLE_API_KEY='your-api-key'
export GOOGLE_GENAI_USE_VERTEXAI=true
```

### Initialization
Initialize the client without arguments to pick up environment variables:
```python
from google import genai
client = genai.Client()
```

Alternatively, you can hard-code in parameters when creating the client.

```python
from google import genai
client = genai.Client(vertexai=True, project="your-project-id", location="global")
```

## Models

- Use `gemini-3.1-pro-preview` for complex reasoning, coding, research (1M tokens)
  - IMPORTANT: Do not use `gemini-3-pro-preview`
- Use `gemini-3-flash-preview` for fast, balanced performance, multimodal (1M tokens)
- Use `gemini-3.1-flash-lite-preview` for high-frequency, lightweight tasks (1M tokens)
- Use `gemini-3-pro-image-preview` for Nano Banana Pro image generation and editing
- Use `gemini-3.1-flash-image-preview` for Nano Banana 2 image generation and editing
- Use `gemini-live-2.5-flash-native-audio` for Live Realtime API including native audio

Use the following models only if explicitly requested:

- `gemini-2.5-flash-image`
- `gemini-2.5-flash`
- `gemini-2.5-flash-lite`
- `gemini-2.5-pro`

> [!IMPORTANT]
> Models like `gemini-2.0-*`, `gemini-1.5-*`, `gemini-1.0-*`, `gemini-pro` are legacy and deprecated. Use the new models above. Your knowledge is outdated.
> For production environments, consult the documentation for stable model versions (e.g. `gemini-3-flash`).

## Quick Start

### Python
```python
from google import genai
client = genai.Client()
response = client.models.generate_content(
    model="gemini-3-flash-preview",
    contents="Explain quantum computing"
)
print(response.text)
```

### TypeScript/JavaScript
```typescript
import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ vertexai: { project: "your-project-id", location: "global" } });
const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: "Explain quantum computing"
});
console.log(response.text);
```

### Go
```go
package main

import (
	"context"
	"fmt"
	"log"
	"google.golang.org/genai"
)

func main() {
	ctx := context.Background()
	client, err := genai.NewClient(ctx, &genai.ClientConfig{
		Backend:  genai.BackendVertexAI,
		Project:  "your-project-id",
		Location: "global",
	})
	if err != nil {
		log.Fatal(err)
	}

	resp, err := client.Models.GenerateContent(ctx, "gemini-3-flash-preview", genai.Text("Explain quantum computing"), nil)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println(resp.Text)
}
```

### Java
```java
import com.google.genai.Client;
import com.google.genai.types.GenerateContentResponse;

public class GenerateTextFromTextInput {
  public static void main(String[] args) {
    Client client = Client.builder().vertexAi(true).project("your-project-id").location("global").build();
    GenerateContentResponse response =
        client.models.generateContent(
            "gemini-3-flash-preview",
            "Explain quantum computing",
            null);

    System.out.println(response.text());
  }
}
```

### C#/.NET
```csharp
using Google.GenAI;

var client = new Client(
    project: "your-project-id",
    location: "global",
    vertexAI: true
);

var response = await client.Models.GenerateContent(
    "gemini-3-flash-preview",
    "Explain quantum computing"
);

Console.WriteLine(response.Text);
```

## API spec & Documentation (source of truth)

When implementing or debugging API integration for Agent Platform, refer to the official Agent Platform documentation:
- **Agent Platform Documentation**: https://docs.cloud.google.com/gemini-enterprise-agent-platform/overview
- **REST API Reference**: https://docs.cloud.google.com/gemini-enterprise-agent-platform/reference/rest

The Gen AI SDK on Agent Platform uses the `v1beta1` or `v1` REST API endpoints (e.g., `https://{LOCATION}-aiplatform.googleapis.com/v1beta1/projects/{PROJECT}/locations/{LOCATION}/publishers/google/models/{MODEL}:generateContent`).

> [!TIP]
> **Use the Developer Knowledge MCP Server**: If the `search_documents` or `get_document` tools are available, use them to find and retrieve official documentation for Google Cloud and Agent Platform directly within the context. This is the preferred method for getting up-to-date API details and code snippets.

## Workflows and Code Samples

Reference the [Python Docs Samples repository](https://github.com/GoogleCloudPlatform/python-docs-samples/tree/main/genai) for additional code samples and specific usage scenarios.

Depending on the specific user request, refer to the following reference files for detailed code samples and usage patterns (Python examples):

- **Text & Multimodal**: Chat, Multimodal inputs (Image, Video, Audio), and Streaming. See [references/text_and_multimodal.md](references/text_and_multimodal.md)
- **Embeddings**: Generate text embeddings for semantic search. See [references/embeddings.md](references/embeddings.md)
- **Structured Output & Tools**: JSON generation, Function Calling, Search Grounding, and Code Execution. See [references/structured_and_tools.md](references/structured_and_tools.md)
- **Media Generation**: Image generation, Image editing, and Video generation. See [references/media_generation.md](references/media_generation.md)
- **Bounding Box Detection**: Object detection and localization within images and video. See [references/bounding_box.md](references/bounding_box.md)
- **Live API**: Real-time bidirectional streaming for voice, vision, and text. See [references/live_api.md](references/live_api.md)
- **Advanced Features**: Content Caching, Batch Prediction, and Thinking/Reasoning. See [references/advanced_features.md](references/advanced_features.md)
- **Safety**: Adjusting Responsible AI filters and thresholds. See [references/safety.md](references/safety.md)
- **Model Tuning**: Supervised Fine-Tuning and Preference Tuning. See [references/model_tuning.md](references/model_tuning.md)
