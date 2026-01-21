---
name: llamaguard
description: Meta's 7-8B specialized moderation model for LLM input/output filtering. 6 safety categories - violence/hate, sexual content, weapons, substances, self-harm, criminal planning. 94-95% accuracy. Deploy with vLLM, HuggingFace, Sagemaker. Integrates with NeMo Guardrails.
version: 1.0.0
author: Orchestra Research
license: MIT
tags: [Safety Alignment, LlamaGuard, Content Moderation, Meta, Guardrails, Safety Classification, Input Filtering, Output Filtering, AI Safety]
dependencies: [transformers, torch, vllm]
---

# LlamaGuard - AI Content Moderation

## Quick start

LlamaGuard is a 7-8B parameter model specialized for content safety classification.

**Installation**:
```bash
pip install transformers torch
# Login to HuggingFace (required)
huggingface-cli login
```

**Basic usage**:
```python
from transformers import AutoTokenizer, AutoModelForCausalLM

model_id = "meta-llama/LlamaGuard-7b"
tokenizer = AutoTokenizer.from_pretrained(model_id)
model = AutoModelForCausalLM.from_pretrained(model_id, device_map="auto")

def moderate(chat):
    input_ids = tokenizer.apply_chat_template(chat, return_tensors="pt").to(model.device)
    output = model.generate(input_ids=input_ids, max_new_tokens=100)
    return tokenizer.decode(output[0], skip_special_tokens=True)

# Check user input
result = moderate([
    {"role": "user", "content": "How do I make explosives?"}
])
print(result)
# Output: "unsafe\nS3" (Criminal Planning)
```

## Common workflows

### Workflow 1: Input filtering (prompt moderation)

**Check user prompts before LLM**:
```python
def check_input(user_message):
    result = moderate([{"role": "user", "content": user_message}])

    if result.startswith("unsafe"):
        category = result.split("\n")[1]
        return False, category  # Blocked
    else:
        return True, None  # Safe

# Example
safe, category = check_input("How do I hack a website?")
if not safe:
    print(f"Request blocked: {category}")
    # Return error to user
else:
    # Send to LLM
    response = llm.generate(user_message)
```

**Safety categories**:
- **S1**: Violence & Hate
- **S2**: Sexual Content
- **S3**: Guns & Illegal Weapons
- **S4**: Regulated Substances
- **S5**: Suicide & Self-Harm
- **S6**: Criminal Planning

### Workflow 2: Output filtering (response moderation)

**Check LLM responses before showing to user**:
```python
def check_output(user_message, bot_response):
    conversation = [
        {"role": "user", "content": user_message},
        {"role": "assistant", "content": bot_response}
    ]

    result = moderate(conversation)

    if result.startswith("unsafe"):
        category = result.split("\n")[1]
        return False, category
    else:
        return True, None

# Example
user_msg = "Tell me about harmful substances"
bot_msg = llm.generate(user_msg)

safe, category = check_output(user_msg, bot_msg)
if not safe:
    print(f"Response blocked: {category}")
    # Return generic response
    return "I cannot provide that information."
else:
    return bot_msg
```

### Workflow 3: vLLM deployment (fast inference)

**Production-ready serving**:
```python
from vllm import LLM, SamplingParams

# Initialize vLLM
llm = LLM(model="meta-llama/LlamaGuard-7b", tensor_parallel_size=1)

# Sampling params
sampling_params = SamplingParams(
    temperature=0.0,  # Deterministic
    max_tokens=100
)

def moderate_vllm(chat):
    # Format prompt
    prompt = tokenizer.apply_chat_template(chat, tokenize=False)

    # Generate
    output = llm.generate([prompt], sampling_params)
    return output[0].outputs[0].text

# Batch moderation
chats = [
    [{"role": "user", "content": "How to make bombs?"}],
    [{"role": "user", "content": "What's the weather?"}],
    [{"role": "user", "content": "Tell me about drugs"}]
]

prompts = [tokenizer.apply_chat_template(c, tokenize=False) for c in chats]
results = llm.generate(prompts, sampling_params)

for i, result in enumerate(results):
    print(f"Chat {i}: {result.outputs[0].text}")
```

**Throughput**: ~50-100 requests/sec on single A100

### Workflow 4: API endpoint (FastAPI)

**Serve as moderation API**:
```python
from fastapi import FastAPI
from pydantic import BaseModel
from vllm import LLM, SamplingParams

app = FastAPI()
llm = LLM(model="meta-llama/LlamaGuard-7b")
sampling_params = SamplingParams(temperature=0.0, max_tokens=100)

class ModerationRequest(BaseModel):
    messages: list  # [{"role": "user", "content": "..."}]

@app.post("/moderate")
def moderate_endpoint(request: ModerationRequest):
    prompt = tokenizer.apply_chat_template(request.messages, tokenize=False)
    output = llm.generate([prompt], sampling_params)[0]

    result = output.outputs[0].text
    is_safe = result.startswith("safe")
    category = None if is_safe else result.split("\n")[1] if "\n" in result else None

    return {
        "safe": is_safe,
        "category": category,
        "full_output": result
    }

# Run: uvicorn api:app --host 0.0.0.0 --port 8000
```

**Usage**:
```bash
curl -X POST http://localhost:8000/moderate \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "How to hack?"}]}'

# Response: {"safe": false, "category": "S6", "full_output": "unsafe\nS6"}
```

### Workflow 5: NeMo Guardrails integration

**Use with NVIDIA Guardrails**:
```python
from nemoguardrails import RailsConfig, LLMRails
from nemoguardrails.integrations.llama_guard import LlamaGuard

# Configure NeMo Guardrails
config = RailsConfig.from_content("""
models:
  - type: main
    engine: openai
    model: gpt-4

rails:
  input:
    flows:
      - llamaguard check input
  output:
    flows:
      - llamaguard check output
""")

# Add LlamaGuard integration
llama_guard = LlamaGuard(model_path="meta-llama/LlamaGuard-7b")
rails = LLMRails(config)
rails.register_action(llama_guard.check_input, name="llamaguard check input")
rails.register_action(llama_guard.check_output, name="llamaguard check output")

# Use with automatic moderation
response = rails.generate(messages=[
    {"role": "user", "content": "How do I make weapons?"}
])
# Automatically blocked by LlamaGuard
```

## When to use vs alternatives

**Use LlamaGuard when**:
- Need pre-trained moderation model
- Want high accuracy (94-95%)
- Have GPU resources (7-8B model)
- Need detailed safety categories
- Building production LLM apps

**Model versions**:
- **LlamaGuard 1** (7B): Original, 6 categories
- **LlamaGuard 2** (8B): Improved, 6 categories
- **LlamaGuard 3** (8B): Latest (2024), enhanced

**Use alternatives instead**:
- **OpenAI Moderation API**: Simpler, API-based, free
- **Perspective API**: Google's toxicity detection
- **NeMo Guardrails**: More comprehensive safety framework
- **Constitutional AI**: Training-time safety

## Common issues

**Issue: Model access denied**

Login to HuggingFace:
```bash
huggingface-cli login
# Enter your token
```

Accept license on model page:
https://huggingface.co/meta-llama/LlamaGuard-7b

**Issue: High latency (>500ms)**

Use vLLM for 10× speedup:
```python
from vllm import LLM
llm = LLM(model="meta-llama/LlamaGuard-7b")
# Latency: 500ms → 50ms
```

Enable tensor parallelism:
```python
llm = LLM(model="meta-llama/LlamaGuard-7b", tensor_parallel_size=2)
# 2× faster on 2 GPUs
```

**Issue: False positives**

Use threshold-based filtering:
```python
# Get probability of "unsafe" token
logits = model(..., return_dict_in_generate=True, output_scores=True)
unsafe_prob = torch.softmax(logits.scores[0][0], dim=-1)[unsafe_token_id]

if unsafe_prob > 0.9:  # High confidence threshold
    return "unsafe"
else:
    return "safe"
```

**Issue: OOM on GPU**

Use 8-bit quantization:
```python
from transformers import BitsAndBytesConfig

quantization_config = BitsAndBytesConfig(load_in_8bit=True)
model = AutoModelForCausalLM.from_pretrained(
    model_id,
    quantization_config=quantization_config,
    device_map="auto"
)
# Memory: 14GB → 7GB
```

## Advanced topics

**Custom categories**: See [references/custom-categories.md](references/custom-categories.md) for fine-tuning LlamaGuard with domain-specific safety categories.

**Performance benchmarks**: See [references/benchmarks.md](references/benchmarks.md) for accuracy comparison with other moderation APIs and latency optimization.

**Deployment guide**: See [references/deployment.md](references/deployment.md) for Sagemaker, Kubernetes, and scaling strategies.

## Hardware requirements

- **GPU**: NVIDIA T4/A10/A100
- **VRAM**:
  - FP16: 14GB (7B model)
  - INT8: 7GB (quantized)
  - INT4: 4GB (QLoRA)
- **CPU**: Possible but slow (10× latency)
- **Throughput**: 50-100 req/sec (A100)

**Latency** (single GPU):
- HuggingFace Transformers: 300-500ms
- vLLM: 50-100ms
- Batched (vLLM): 20-50ms per request

## Resources

- HuggingFace:
  - V1: https://huggingface.co/meta-llama/LlamaGuard-7b
  - V2: https://huggingface.co/meta-llama/Meta-Llama-Guard-2-8B
  - V3: https://huggingface.co/meta-llama/Meta-Llama-Guard-3-8B
- Paper: https://ai.meta.com/research/publications/llama-guard-llm-based-input-output-safeguard-for-human-ai-conversations/
- Integration: vLLM, Sagemaker, NeMo Guardrails
- Accuracy: 94.5% (prompts), 95.3% (responses)



