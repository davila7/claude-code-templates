# Supported Models

Complete list of model architectures supported by LitGPT with parameter sizes and variants.

## Overview

LitGPT supports **20+ model families** with **100+ model variants** ranging from 135M to 405B parameters.

**List all models**:
```bash
litgpt download list
```

**List pretrain-capable models**:
```bash
litgpt pretrain list
```

## Model Families

### Llama Family

**Llama 3, 3.1, 3.2, 3.3**:
- **Sizes**: 1B, 3B, 8B, 70B, 405B
- **Use Cases**: General-purpose, long-context (128K), multimodal
- **Best For**: Production applications, research, instruction following

**Code Llama**:
- **Sizes**: 7B, 13B, 34B, 70B
- **Use Cases**: Code generation, completion, infilling
- **Best For**: Programming assistants, code analysis

**Function Calling Llama 2**:
- **Sizes**: 7B
- **Use Cases**: Tool use, API integration
- **Best For**: Agents, function execution

**Llama 2**:
- **Sizes**: 7B, 13B, 70B
- **Use Cases**: General-purpose (predecessor to Llama 3)
- **Best For**: Established baselines, research comparisons

**Llama 3.1 Nemotron**:
- **Sizes**: 70B
- **Use Cases**: NVIDIA-optimized variant
- **Best For**: Enterprise deployments

**TinyLlama**:
- **Sizes**: 1.1B
- **Use Cases**: Edge devices, resource-constrained environments
- **Best For**: Fast inference, mobile deployment

**OpenLLaMA**:
- **Sizes**: 3B, 7B, 13B
- **Use Cases**: Open-source Llama reproduction
- **Best For**: Research, education

**Vicuna**:
- **Sizes**: 7B, 13B, 33B
- **Use Cases**: Chatbot, instruction following
- **Best For**: Conversational AI

**R1 Distill Llama**:
- **Sizes**: 8B, 70B
- **Use Cases**: Distilled reasoning models
- **Best For**: Efficient reasoning tasks

**MicroLlama**:
- **Sizes**: 300M
- **Use Cases**: Extremely small Llama variant
- **Best For**: Prototyping, testing

**Platypus**:
- **Sizes**: 7B, 13B, 70B
- **Use Cases**: STEM-focused fine-tune
- **Best For**: Science, math, technical domains

### Mistral Family

**Mistral**:
- **Sizes**: 7B, 123B
- **Use Cases**: Efficient open models, long-context
- **Best For**: Cost-effective deployments

**Mathstral**:
- **Sizes**: 7B
- **Use Cases**: Math reasoning
- **Best For**: Mathematical problem solving

**Mixtral MoE**:
- **Sizes**: 8×7B (47B total, 13B active), 8×22B (141B total, 39B active)
- **Use Cases**: Sparse mixture of experts
- **Best For**: High capacity with lower compute

### Falcon Family

**Falcon**:
- **Sizes**: 7B, 40B, 180B
- **Use Cases**: Open-source models from TII
- **Best For**: Multilingual applications

**Falcon 3**:
- **Sizes**: 1B, 3B, 7B, 10B
- **Use Cases**: Newer Falcon generation
- **Best For**: Efficient multilingual models

### Phi Family (Microsoft)

**Phi 1.5 & 2**:
- **Sizes**: 1.3B, 2.7B
- **Use Cases**: Small language models with strong performance
- **Best For**: Edge deployment, low-resource environments

**Phi 3 & 3.5**:
- **Sizes**: 3.8B
- **Use Cases**: Improved small models
- **Best For**: Mobile, browser-based applications

**Phi 4**:
- **Sizes**: 14B
- **Use Cases**: Medium-size high-performance model
- **Best For**: Balance of size and capability

**Phi 4 Mini Instruct**:
- **Sizes**: 3.8B
- **Use Cases**: Instruction-tuned variant
- **Best For**: Chat, task completion

### Gemma Family (Google)

**Gemma**:
- **Sizes**: 2B, 7B
- **Use Cases**: Google's open models
- **Best For**: Research, education

**Gemma 2**:
- **Sizes**: 2B, 9B, 27B
- **Use Cases**: Second generation improvements
- **Best For**: Enhanced performance

**Gemma 3**:
- **Sizes**: 1B, 4B, 12B, 27B
- **Use Cases**: Latest Gemma generation
- **Best For**: State-of-the-art open models

**CodeGemma**:
- **Sizes**: 7B
- **Use Cases**: Code-specialized Gemma
- **Best For**: Code generation, analysis

### Qwen Family (Alibaba)

**Qwen2.5**:
- **Sizes**: 0.5B, 1.5B, 3B, 7B, 14B, 32B, 72B
- **Use Cases**: General-purpose multilingual models
- **Best For**: Chinese/English applications

**Qwen2.5 Coder**:
- **Sizes**: 0.5B, 1.5B, 3B, 7B, 14B, 32B
- **Use Cases**: Code-specialized variants
- **Best For**: Programming in multiple languages

**Qwen2.5 Math**:
- **Sizes**: 1.5B, 7B, 72B
- **Use Cases**: Mathematical reasoning
- **Best For**: Math problems, STEM education

**QwQ & QwQ-Preview**:
- **Sizes**: 32B
- **Use Cases**: Question-answering focus
- **Best For**: Reasoning tasks

### Pythia Family (EleutherAI)

**Pythia**:
- **Sizes**: 14M, 31M, 70M, 160M, 410M, 1B, 1.4B, 2.8B, 6.9B, 12B
- **Use Cases**: Research, interpretability
- **Best For**: Scientific studies, ablations

### StableLM Family (Stability AI)

**StableLM**:
- **Sizes**: 3B, 7B
- **Use Cases**: Open models from Stability AI
- **Best For**: Research, commercial use

**StableLM Zephyr**:
- **Sizes**: 3B
- **Use Cases**: Instruction-tuned variant
- **Best For**: Chat applications

**StableCode**:
- **Sizes**: 3B
- **Use Cases**: Code generation
- **Best For**: Programming tasks

**FreeWilly2 (Stable Beluga 2)**:
- **Sizes**: 70B
- **Use Cases**: Large Stability AI model
- **Best For**: High-capability tasks

### Other Models

**Danube2**:
- **Sizes**: 1.8B
- **Use Cases**: Efficient small model
- **Best For**: Resource-constrained environments

**Dolly**:
- **Sizes**: 3B, 7B, 12B
- **Use Cases**: Databricks' instruction-following model
- **Best For**: Enterprise applications

**LongChat**:
- **Sizes**: 7B, 13B
- **Use Cases**: Extended context windows
- **Best For**: Long-document understanding

**Nous-Hermes**:
- **Sizes**: 7B, 13B, 70B
- **Use Cases**: Instruction-following fine-tune
- **Best For**: Task completion, reasoning

**OLMo**:
- **Sizes**: 1B, 7B
- **Use Cases**: Allen AI's fully open model
- **Best For**: Research transparency

**RedPajama-INCITE**:
- **Sizes**: 3B, 7B
- **Use Cases**: Open reproduction project
- **Best For**: Research, education

**Salamandra**:
- **Sizes**: 2B, 7B
- **Use Cases**: Multilingual European model
- **Best For**: European language support

**SmolLM2**:
- **Sizes**: 135M, 360M, 1.7B
- **Use Cases**: Ultra-small models
- **Best For**: Edge devices, testing

## Download Examples

**Download specific model**:
```bash
litgpt download meta-llama/Llama-3.2-1B
litgpt download microsoft/phi-2
litgpt download google/gemma-2-9b
```

**Download with HuggingFace token** (for gated models):
```bash
export HF_TOKEN=hf_...
litgpt download meta-llama/Llama-3.1-405B
```

## Model Selection Guide

### By Use Case

**General Chat/Instruction Following**:
- Small: Phi-2 (2.7B), TinyLlama (1.1B)
- Medium: Llama-3.2-8B, Mistral-7B
- Large: Llama-3.1-70B, Mixtral-8x22B

**Code Generation**:
- Small: Qwen2.5-Coder-3B
- Medium: CodeLlama-13B, CodeGemma-7B
- Large: CodeLlama-70B, Qwen2.5-Coder-32B

**Math/Reasoning**:
- Small: Qwen2.5-Math-1.5B
- Medium: Mathstral-7B, Qwen2.5-Math-7B
- Large: QwQ-32B, Qwen2.5-Math-72B

**Multilingual**:
- Small: SmolLM2-1.7B
- Medium: Qwen2.5-7B, Falcon-7B
- Large: Qwen2.5-72B

**Research/Education**:
- Pythia family (14M-12B for ablations)
- OLMo (fully open)
- TinyLlama (fast iteration)

### By Hardware

**Consumer GPU (8-16GB VRAM)**:
- Phi-2 (2.7B)
- TinyLlama (1.1B)
- Gemma-2B
- SmolLM2 family

**Single A100 (40-80GB)**:
- Llama-3.2-8B
- Mistral-7B
- CodeLlama-13B
- Gemma-9B

**Multi-GPU (200GB+ total)**:
- Llama-3.1-70B (TP=4)
- Mixtral-8x22B (TP=2)
- Falcon-40B

**Large Cluster**:
- Llama-3.1-405B (FSDP)
- Falcon-180B

## Model Capabilities

### Context Lengths

| Model | Context Window |
|-------|----------------|
| Llama 3.1 | 128K |
| Llama 3.2/3.3 | 128K |
| Mistral-123B | 128K |
| Mixtral | 32K |
| Gemma 2 | 8K |
| Phi-3 | 128K |
| Qwen2.5 | 32K |

### Training Data

- **Llama 3**: 15T tokens (multilingual)
- **Mistral**: Web data, code
- **Qwen**: Multilingual (Chinese/English focus)
- **Pythia**: The Pile (controlled training)

## References

- LitGPT GitHub: https://github.com/Lightning-AI/litgpt
- Model configs: `litgpt/config.py`
- Download tutorial: `tutorials/download_model_weights.md`
