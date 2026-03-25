# RadixAttention Deep Dive

Complete guide to RadixAttention - SGLang's key innovation for automatic prefix caching.

## What is RadixAttention?

**RadixAttention** is an algorithm that automatically caches and reuses KV cache for common prefixes across requests using a radix tree data structure.

**Key insight**: In real-world LLM serving:
- System prompts are repeated across requests
- Few-shot examples are shared
- Multi-turn conversations build on previous context
- Agent tools/functions are defined once

**Problem with traditional serving**:
- Every request recomputes the entire prompt
- Wasteful for shared prefixes
- 5-10× slower than necessary

**RadixAttention solution**:
- Build radix tree of all processed tokens
- Automatically detect shared prefixes
- Reuse KV cache for matching tokens
- Only compute new/different tokens

## How It Works

### Radix Tree Structure

```
Example requests:
1. "System: You are helpful\nUser: What's AI?"
2. "System: You are helpful\nUser: What's ML?"
3. "System: You are helpful\nUser: What's DL?"

Radix tree:
Root
└── "System: You are helpful\nUser: What's "
    ├── "AI?" → [KV cache for request 1]
    ├── "ML?" → [KV cache for request 2]
    └── "DL?" → [KV cache for request 3]

Shared prefix: "System: You are helpful\nUser: What's "
→ Computed once, reused 3 times
→ 5× speedup!
```

### Token-Level Matching

RadixAttention works at the token level:

```python
# Request 1: "Hello world"
Tokens: [15496, 1917]  # Hello=15496, world=1917
→ KV cache computed and stored in tree

# Request 2: "Hello there"
Tokens: [15496, 612]   # Hello=15496, there=612
→ Reuses KV cache for token 15496
→ Only computes token 612
→ 2× faster
```

### Automatic Eviction

When memory is full:
1. **LRU policy**: Evict least recently used prefixes
2. **Leaf-first**: Remove leaf nodes before internal nodes
3. **Preserves common prefixes**: Frequently used prefixes stay cached

```
Before eviction (memory full):
Root
├── "System A" (used 5 min ago)
│   ├── "Task 1" (used 1 min ago) ← Keep (recent)
│   └── "Task 2" (used 30 min ago) ← Evict (old + leaf)
└── "System B" (used 60 min ago) ← Evict (very old)

After eviction:
Root
└── "System A"
    └── "Task 1"
```

## Performance Analysis

### Few-Shot Prompting

**Scenario**: 10 examples in prompt (2000 tokens), user query (50 tokens)

**Without RadixAttention** (vLLM):
- Request 1: Compute 2050 tokens (2000 examples + 50 query)
- Request 2: Compute 2050 tokens (recompute all examples)
- Request 3: Compute 2050 tokens (recompute all examples)
- Total: 6150 tokens computed

**With RadixAttention** (SGLang):
- Request 1: Compute 2050 tokens (initial)
- Request 2: Reuse 2000 tokens, compute 50 (query only)
- Request 3: Reuse 2000 tokens, compute 50 (query only)
- Total: 2150 tokens computed
- **Speedup: 2.86×** (6150 / 2150)

### Agent Workflows

**Scenario**: System prompt (1000 tokens) + tools (500 tokens) + query (100 tokens)

**Without RadixAttention**:
- Request 1: 1600 tokens
- Request 2: 1600 tokens
- Request 3: 1600 tokens
- Total: 4800 tokens

**With RadixAttention**:
- Request 1: 1600 tokens (initial)
- Request 2: Reuse 1500, compute 100
- Request 3: Reuse 1500, compute 100
- Total: 1800 tokens
- **Speedup: 2.67×**

### Multi-Turn Conversations

**Scenario**: Conversation grows from 100 → 500 → 1000 tokens

| Turn | Tokens | vLLM | SGLang (RadixAttention) |
|------|--------|------|-------------------------|
| 1 | 100 | 100 | 100 (initial) |
| 2 | 500 | 500 | 400 (reuse 100) |
| 3 | 1000 | 1000 | 500 (reuse 500) |
| **Total** | | **1600** | **1000** |
| **Speedup** | | | **1.6×** |

As conversation grows, speedup increases!

## Benchmarks

### Throughput Comparison (Llama 3-8B, A100)

| Workload | Prefix Length | vLLM | SGLang | Speedup |
|----------|---------------|------|--------|---------|
| Simple generation | 0 | 2500 tok/s | 2800 tok/s | 1.12× |
| Few-shot (5 ex) | 1000 | 800 tok/s | 3200 tok/s | 4× |
| Few-shot (10 ex) | 2000 | 500 tok/s | 5000 tok/s | **10×** |
| Agent (tools) | 1500 | 800 tok/s | 4000 tok/s | 5× |
| Chat (history) | 500-2000 | 1200 tok/s | 3600 tok/s | 3× |

**Key insight**: Longer shared prefixes = bigger speedups

### Latency Reduction

**Agent workflow** (1000-token system prompt):

| Metric | vLLM | SGLang | Improvement |
|--------|------|--------|-------------|
| First request | 1.8s | 1.8s | Same (no cache) |
| Subsequent requests | 1.8s | **0.35s** | **5× faster** |
| P50 latency (100 req) | 1.8s | 0.42s | 4.3× faster |
| P99 latency | 2.1s | 0.58s | 3.6× faster |

### Memory Efficiency

**Without RadixAttention**:
- Each request stores its own KV cache
- 100 requests with 2000-token prefix = 200K tokens cached
- Memory: ~1.5 GB (Llama 3-8B, FP16)

**With RadixAttention**:
- Prefix stored once in radix tree
- 100 requests share 2000-token prefix
- Memory: ~15 MB for prefix + unique tokens
- **Savings: 99%** for shared portions

## Configuration

### Enable/Disable RadixAttention

```bash
# Enabled by default
python -m sglang.launch_server \
    --model-path meta-llama/Meta-Llama-3-8B-Instruct

# Disable (for comparison)
python -m sglang.launch_server \
    --model-path meta-llama/Meta-Llama-3-8B-Instruct \
    --disable-radix-cache
```

### Cache Size Tuning

```bash
# Set max cache size (default: 90% of GPU memory)
python -m sglang.launch_server \
    --model-path meta-llama/Meta-Llama-3-8B-Instruct \
    --max-radix-cache-len 16384  # Max 16K tokens cached

# Reserve memory for KV cache
--mem-fraction-static 0.85  # Use 85% GPU memory for cache
```

### Eviction Policy

```bash
# LRU eviction (default)
--eviction-policy lru

# FIFO eviction
--eviction-policy fifo
```

## Best Practices

### Design prompts for prefix sharing

**Bad** (no prefix sharing):
```python
# Each request has unique prefix
request_1 = "User Alice asks: What is AI?"
request_2 = "User Bob asks: What is ML?"
request_3 = "User Carol asks: What is DL?"

# No common prefix → No speedup
```

**Good** (maximize prefix sharing):
```python
# Shared system prompt
system = "You are a helpful AI assistant.\n\n"

request_1 = system + "User: What is AI?"
request_2 = system + "User: What is ML?"
request_3 = system + "User: What is DL?"

# Shared prefix → 5× speedup!
```

### Structure agent prompts

```python
# Template for maximum caching
@sgl.function
def agent_template(s, user_query):
    # Layer 1: System prompt (always cached)
    s += "You are a helpful assistant.\n\n"

    # Layer 2: Tools definition (always cached)
    s += "Available tools:\n"
    s += "- get_weather(location)\n"
    s += "- send_email(to, subject, body)\n\n"

    # Layer 3: Examples (always cached)
    s += "Examples:\n"
    s += "User: What's the weather?\n"
    s += "Assistant: <tool>get_weather('NYC')</tool>\n\n"

    # Layer 4: User query (unique per request)
    s += f"User: {user_query}\n"
    s += "Assistant: "
    s += sgl.gen("response", max_tokens=200)

# Layers 1-3 cached, only Layer 4 computed
# 5× faster for typical agent queries
```

### Optimize few-shot prompting

```python
# BAD: Examples mixed with query
def bad_few_shot(s, query):
    s += f"Query: {query}\n"  # Unique
    s += "Example 1: ..."     # Can't be cached
    s += "Example 2: ..."
    s += sgl.gen("answer")

# GOOD: Examples first, then query
def good_few_shot(s, query):
    # Examples (shared prefix, always cached)
    s += "Example 1: ...\n"
    s += "Example 2: ...\n"
    s += "Example 3: ...\n\n"

    # Query (unique suffix, computed)
    s += f"Query: {query}\n"
    s += sgl.gen("answer")

# 10× faster with RadixAttention
```

## Monitoring

### Cache hit rate

```python
# Check cache statistics
import requests
response = requests.get("http://localhost:30000/stats")
stats = response.json()

print(f"Cache hit rate: {stats['radix_cache_hit_rate']:.2%}")
print(f"Tokens cached: {stats['radix_cache_tokens']}")
print(f"Cache size: {stats['radix_cache_size_mb']} MB")

# Target: >80% hit rate for agent/few-shot workloads
```

### Optimization metrics

```bash
# Monitor cache usage
curl http://localhost:30000/metrics | grep radix

# Key metrics:
# - radix_cache_hit_tokens: Tokens reused from cache
# - radix_cache_miss_tokens: Tokens computed (not cached)
# - radix_cache_evictions: Number of evictions (should be low)
```

## Advanced Patterns

### Hierarchical caching

```python
@sgl.function
def hierarchical_agent(s, domain, task, query):
    # Level 1: Global system (cached across all requests)
    s += "You are an AI assistant.\n\n"

    # Level 2: Domain knowledge (cached per domain)
    s += f"Domain: {domain}\n"
    s += f"Knowledge: {get_domain_knowledge(domain)}\n\n"

    # Level 3: Task context (cached per task)
    s += f"Task: {task}\n"
    s += f"Instructions: {get_task_instructions(task)}\n\n"

    # Level 4: User query (unique)
    s += f"Query: {query}\n"
    s += sgl.gen("response")

# Example cache tree:
# Root
# └── "You are an AI assistant\n\n" (L1)
#     ├── "Domain: Finance\n..." (L2)
#     │   ├── "Task: Analysis\n..." (L3)
#     │   │   └── "Query: ..." (L4)
#     │   └── "Task: Forecast\n..." (L3)
#     └── "Domain: Legal\n..." (L2)
```

### Batch requests with common prefix

```python
# All requests share system prompt
system_prompt = "You are a helpful assistant.\n\n"

queries = [
    "What is AI?",
    "What is ML?",
    "What is DL?",
]

# Run in batch (RadixAttention automatically optimizes)
results = sgl.run_batch([
    agent.bind(prefix=system_prompt, query=q)
    for q in queries
])

# System prompt computed once, shared across all 3 requests
# 3× faster than sequential
```

## Troubleshooting

### Low cache hit rate (<50%)

**Causes**:
1. Prompts have no common structure
2. Dynamic content in prefix (timestamps, IDs)
3. Cache size too small (evictions)

**Solutions**:
1. Restructure prompts (shared prefix first)
2. Move dynamic content to suffix
3. Increase `--max-radix-cache-len`

### High memory usage

**Cause**: Too many unique prefixes cached

**Solutions**:
```bash
# Reduce cache size
--max-radix-cache-len 8192

# More aggressive eviction
--mem-fraction-static 0.75
```

### Performance worse than vLLM

**Cause**: No prefix sharing in workload

**Solution**: RadixAttention has small overhead if no sharing. Use vLLM for simple generation workloads without repeated prefixes.

## Comparison with Other Systems

| System | Prefix Caching | Automatic | Performance |
|--------|----------------|-----------|-------------|
| **SGLang** | ✅ RadixAttention | ✅ Automatic | 5-10× for agents |
| vLLM | ❌ No prefix caching | N/A | Baseline |
| Text Generation Inference | ✅ Prefix caching | ❌ Manual | 2-3× (if configured) |
| TensorRT-LLM | ✅ Static prefix | ❌ Manual | 2× (if configured) |

**SGLang advantage**: Fully automatic - no configuration needed, works for any workload with prefix sharing.
