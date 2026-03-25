# GPTQ Integration Guide

Integration with transformers, PEFT, vLLM, and other frameworks.

## Transformers Integration

### Auto-detection
```python
from transformers import AutoModelForCausalLM

# Automatically detects and loads GPTQ model
model = AutoModelForCausalLM.from_pretrained(
    "TheBloke/Llama-2-13B-GPTQ",
    device_map="auto"
)
```

### Manual loading
```python
from auto_gptq import AutoGPTQForCausalLM

model = AutoGPTQForCausalLM.from_quantized(
    "TheBloke/Llama-2-13B-GPTQ",
    device="cuda:0",
    use_exllama=True
)
```

## QLoRA Fine-Tuning

```python
from transformers import AutoModelForCausalLM, TrainingArguments
from peft import prepare_model_for_kbit_training, LoraConfig, get_peft_model
from trl import SFTTrainer

# Load GPTQ model
model = AutoModelForCausalLM.from_pretrained(
    "TheBloke/Llama-2-70B-GPTQ",
    device_map="auto"
)

# Prepare for training
model = prepare_model_for_kbit_training(model)

# LoRA config
lora_config = LoraConfig(
    r=16,
    lora_alpha=32,
    target_modules=["q_proj", "v_proj"],
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM"
)

model = get_peft_model(model, lora_config)

# Train (70B model on single A100!)
trainer = SFTTrainer(
    model=model,
    train_dataset=dataset,
    max_seq_length=2048,
    args=TrainingArguments(
        per_device_train_batch_size=1,
        gradient_accumulation_steps=16,
        learning_rate=2e-4,
        num_train_epochs=3,
        output_dir="./results"
    )
)

trainer.train()
```

## vLLM Integration

```python
from vllm import LLM, SamplingParams

# Load GPTQ model in vLLM
llm = LLM(
    model="TheBloke/Llama-2-70B-GPTQ",
    quantization="gptq",
    dtype="float16",
    gpu_memory_utilization=0.95
)

# Generate
sampling_params = SamplingParams(
    temperature=0.7,
    top_p=0.9,
    max_tokens=200
)

outputs = llm.generate(["Explain AI"], sampling_params)
```

## Text Generation Inference (TGI)

```bash
# Docker with GPTQ support
docker run --gpus all -p 8080:80 \
    -v $PWD/data:/data \
    ghcr.io/huggingface/text-generation-inference:latest \
    --model-id TheBloke/Llama-2-70B-GPTQ \
    --quantize gptq
```

## LangChain Integration

```python
from langchain.llms import HuggingFacePipeline
from transformers import AutoTokenizer, pipeline

tokenizer = AutoTokenizer.from_pretrained("TheBloke/Llama-2-13B-GPTQ")
model = AutoModelForCausalLM.from_pretrained(
    "TheBloke/Llama-2-13B-GPTQ",
    device_map="auto"
)

pipe = pipeline("text-generation", model=model, tokenizer=tokenizer, max_new_tokens=200)
llm = HuggingFacePipeline(pipeline=pipe)

# Use in LangChain
from langchain.chains import LLMChain
from langchain.prompts import PromptTemplate

chain = LLMChain(llm=llm, prompt=PromptTemplate(...))
result = chain.run(input="...")
```
