---
name: sglang
description: Fast structured generation and serving for LLMs with RadixAttention prefix caching. Use for JSON/regex outputs, constrained decoding, agentic workflows with tool calls, or when you need 5× faster inference than vLLM with prefix sharing. Powers 300,000+ GPUs at xAI, AMD, NVIDIA, and LinkedIn.
version: 1.0.0
author: Orchestra Research
license: MIT
tags: [Inference Serving, SGLang, Structured Generation, RadixAttention, Prefix Caching, Constrained Decoding, Agents, JSON Output, Fast Inference, Production Scale]
dependencies: [sglang, torch, transformers]
---

# SGLang

High-performance serving framework for LLMs and VLMs with RadixAttention for automatic prefix caching.

## When to use SGLang

**Use SGLang when:**
- Need structured outputs (JSON, regex, grammar)
- Building agents with repeated prefixes (system prompts, tools)
- Agentic workflows with function calling
- Multi-turn conversations with shared context
- Need faster JSON decoding (3× vs standard)

**Use vLLM instead when:**
- Simple text generation without structure
- Don't need prefix caching
- Want mature, widely-tested production system

**Use TensorRT-LLM instead when:**
- Maximum single-request latency (no batching needed)
- NVIDIA-only deployment
- Need FP8/INT4 quantization on H100

## Quick start

### Installation

```bash
# pip install (recommended)
pip install "sglang[all]"

# With FlashInfer (faster, CUDA 11.8/12.1)
pip install sglang[all] flashinfer -i https://flashinfer.ai/whl/cu121/torch2.4/

# From source
git clone https://github.com/sgl-project/sglang.git
cd sglang
pip install -e "python[all]"
```

### Launch server

```bash
# Basic server (Llama 3-8B)
python -m sglang.launch_server \
    --model-path meta-llama/Meta-Llama-3-8B-Instruct \
    --port 30000

# With RadixAttention (automatic prefix caching)
python -m sglang.launch_server \
    --model-path meta-llama/Meta-Llama-3-8B-Instruct \
    --port 30000 \
    --enable-radix-cache  # Default: enabled

# Multi-GPU (tensor parallelism)
python -m sglang.launch_server \
    --model-path meta-llama/Meta-Llama-3-70B-Instruct \
    --tp 4 \
    --port 30000
```

### Basic inference

```python
import sglang as sgl

# Set backend
sgl.set_default_backend(sgl.OpenAI("http://localhost:30000/v1"))

# Simple generation
@sgl.function
def simple_gen(s, question):
    s += "Q: " + question + "\n"
    s += "A:" + sgl.gen("answer", max_tokens=100)

# Run
state = simple_gen.run(question="What is the capital of France?")
print(state["answer"])
# Output: "The capital of France is Paris."
```

### Structured JSON output

```python
import sglang as sgl

@sgl.function
def extract_person(s, text):
    s += f"Extract person information from: {text}\n"
    s += "Output JSON:\n"

    # Constrained JSON generation
    s += sgl.gen(
        "json_output",
        max_tokens=200,
        regex=r'\{"name": "[^"]+", "age": \d+, "occupation": "[^"]+"\}'
    )

# Run
state = extract_person.run(
    text="John Smith is a 35-year-old software engineer."
)
print(state["json_output"])
# Output: {"name": "John Smith", "age": 35, "occupation": "software engineer"}
```

## RadixAttention (Key Innovation)

**What it does**: Automatically caches and reuses common prefixes across requests.

**Performance**:
- **5× faster** for agentic workloads with shared system prompts
- **10× faster** for few-shot prompting with repeated examples
- **Zero configuration** - works automatically

**How it works**:
1. Builds radix tree of all processed tokens
2. Automatically detects shared prefixes
3. Reuses KV cache for matching prefixes
4. Only computes new tokens

**Example** (Agent with system prompt):

```
Request 1: [SYSTEM_PROMPT] + "What's the weather?"
→ Computes full prompt (1000 tokens)

Request 2: [SAME_SYSTEM_PROMPT] + "Book a flight"
→ Reuses system prompt KV cache (998 tokens)
→ Only computes 2 new tokens
→ 5× faster!
```

## Structured generation patterns

### JSON with schema

```python
@sgl.function
def structured_extraction(s, article):
    s += f"Article: {article}\n\n"
    s += "Extract key information as JSON:\n"

    # JSON schema constraint
    schema = {
        "type": "object",
        "properties": {
            "title": {"type": "string"},
            "author": {"type": "string"},
            "summary": {"type": "string"},
            "sentiment": {"type": "string", "enum": ["positive", "negative", "neutral"]}
        },
        "required": ["title", "author", "summary", "sentiment"]
    }

    s += sgl.gen("info", max_tokens=300, json_schema=schema)

state = structured_extraction.run(article="...")
print(state["info"])
# Output: Valid JSON matching schema
```

### Regex-constrained generation

```python
@sgl.function
def extract_email(s, text):
    s += f"Extract email from: {text}\n"
    s += "Email: "

    # Email regex pattern
    s += sgl.gen(
        "email",
        max_tokens=50,
        regex=r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
    )

state = extract_email.run(text="Contact john.doe@example.com for details")
print(state["email"])
# Output: "john.doe@example.com"
```

### Grammar-based generation

```python
@sgl.function
def generate_code(s, description):
    s += f"Generate Python code for: {description}\n"
    s += "```python\n"

    # EBNF grammar for Python
    python_grammar = """
    ?start: function_def
    function_def: "def" NAME "(" [parameters] "):" suite
    parameters: parameter ("," parameter)*
    parameter: NAME
    suite: simple_stmt | NEWLINE INDENT stmt+ DEDENT
    """

    s += sgl.gen("code", max_tokens=200, grammar=python_grammar)
    s += "\n```"
```

## Agent workflows with function calling

```python
import sglang as sgl

# Define tools
tools = [
    {
        "name": "get_weather",
        "description": "Get weather for a location",
        "parameters": {
            "type": "object",
            "properties": {
                "location": {"type": "string"}
            }
        }
    },
    {
        "name": "book_flight",
        "description": "Book a flight",
        "parameters": {
            "type": "object",
            "properties": {
                "from": {"type": "string"},
                "to": {"type": "string"},
                "date": {"type": "string"}
            }
        }
    }
]

@sgl.function
def agent_workflow(s, user_query, tools):
    # System prompt (cached with RadixAttention)
    s += "You are a helpful assistant with access to tools.\n"
    s += f"Available tools: {tools}\n\n"

    # User query
    s += f"User: {user_query}\n"
    s += "Assistant: "

    # Generate with function calling
    s += sgl.gen(
        "response",
        max_tokens=200,
        tools=tools,  # SGLang handles tool call format
        stop=["User:", "\n\n"]
    )

# Multiple queries reuse system prompt
state1 = agent_workflow.run(
    user_query="What's the weather in NYC?",
    tools=tools
)
# First call: Computes full system prompt

state2 = agent_workflow.run(
    user_query="Book a flight to LA",
    tools=tools
)
# Second call: Reuses system prompt (5× faster)
```

## Performance benchmarks

### RadixAttention speedup

**Few-shot prompting** (10 examples in prompt):
- vLLM: 2.5 sec/request
- SGLang: **0.25 sec/request** (10× faster)
- Throughput: 4× higher

**Agent workflows** (1000-token system prompt):
- vLLM: 1.8 sec/request
- SGLang: **0.35 sec/request** (5× faster)

**JSON decoding**:
- Standard: 45 tok/s
- SGLang: **135 tok/s** (3× faster)

### Throughput (Llama 3-8B, A100)

| Workload | vLLM | SGLang | Speedup |
|----------|------|--------|---------|
| Simple generation | 2500 tok/s | 2800 tok/s | 1.12× |
| Few-shot (10 examples) | 500 tok/s | 5000 tok/s | 10× |
| Agent (tool calls) | 800 tok/s | 4000 tok/s | 5× |
| JSON output | 600 tok/s | 2400 tok/s | 4× |

## Multi-turn conversations

```python
@sgl.function
def multi_turn_chat(s, history, new_message):
    # System prompt (always cached)
    s += "You are a helpful AI assistant.\n\n"

    # Conversation history (cached as it grows)
    for msg in history:
        s += f"{msg['role']}: {msg['content']}\n"

    # New user message (only new part)
    s += f"User: {new_message}\n"
    s += "Assistant: "
    s += sgl.gen("response", max_tokens=200)

# Turn 1
history = []
state = multi_turn_chat.run(history=history, new_message="Hi there!")
history.append({"role": "User", "content": "Hi there!"})
history.append({"role": "Assistant", "content": state["response"]})

# Turn 2 (reuses Turn 1 KV cache)
state = multi_turn_chat.run(history=history, new_message="What's 2+2?")
# Only computes new message (much faster!)

# Turn 3 (reuses Turn 1 + Turn 2 KV cache)
state = multi_turn_chat.run(history=history, new_message="Tell me a joke")
# Progressively faster as history grows
```

## Advanced features

### Speculative decoding

```bash
# Launch with draft model (2-3× faster)
python -m sglang.launch_server \
    --model-path meta-llama/Meta-Llama-3-70B-Instruct \
    --speculative-model meta-llama/Meta-Llama-3-8B-Instruct \
    --speculative-num-steps 5
```

### Multi-modal (vision models)

```python
@sgl.function
def describe_image(s, image_path):
    s += sgl.image(image_path)
    s += "Describe this image in detail: "
    s += sgl.gen("description", max_tokens=200)

state = describe_image.run(image_path="photo.jpg")
print(state["description"])
```

### Batching and parallel requests

```python
# Automatic batching (continuous batching)
states = sgl.run_batch(
    [
        simple_gen.bind(question="What is AI?"),
        simple_gen.bind(question="What is ML?"),
        simple_gen.bind(question="What is DL?"),
    ]
)

# All 3 processed in single batch (efficient)
```

## OpenAI-compatible API

```bash
# Start server with OpenAI API
python -m sglang.launch_server \
    --model-path meta-llama/Meta-Llama-3-8B-Instruct \
    --port 30000

# Use with OpenAI client
curl http://localhost:30000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "default",
    "messages": [
      {"role": "system", "content": "You are helpful"},
      {"role": "user", "content": "Hello"}
    ],
    "temperature": 0.7,
    "max_tokens": 100
  }'

# Works with OpenAI Python SDK
from openai import OpenAI
client = OpenAI(base_url="http://localhost:30000/v1", api_key="EMPTY")

response = client.chat.completions.create(
    model="default",
    messages=[{"role": "user", "content": "Hello"}]
)
```

## Supported models

**Text models**:
- Llama 2, Llama 3, Llama 3.1, Llama 3.2
- Mistral, Mixtral
- Qwen, Qwen2, QwQ
- DeepSeek-V2, DeepSeek-V3
- Gemma, Phi-3

**Vision models**:
- LLaVA, LLaVA-OneVision
- Phi-3-Vision
- Qwen2-VL

**100+ models** from HuggingFace

## Hardware support

**NVIDIA**: A100, H100, L4, T4 (CUDA 11.8+)
**AMD**: MI300, MI250 (ROCm 6.0+)
**Intel**: Xeon with GPU (coming soon)
**Apple**: M1/M2/M3 via MPS (experimental)

## References

- **[Structured Generation Guide](references/structured-generation.md)** - JSON schemas, regex, grammars, validation
- **[RadixAttention Deep Dive](references/radix-attention.md)** - How it works, optimization, benchmarks
- **[Production Deployment](references/deployment.md)** - Multi-GPU, monitoring, autoscaling

## Resources

- **GitHub**: https://github.com/sgl-project/sglang
- **Docs**: https://sgl-project.github.io/
- **Paper**: RadixAttention (arXiv:2312.07104)
- **Discord**: https://discord.gg/sglang


