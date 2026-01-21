# Fine-tuning for Context Extension

Complete guide to fine-tuning transformer models for longer context windows.

## Table of Contents
- Data Preparation
- Training Configuration
- YaRN Fine-tuning
- Position Interpolation Fine-tuning
- Evaluation
- Production Deployment

## Data Preparation

### Long Document Datasets

**Best datasets for context extension**:

```python
# 1. PG-19 (Books)
from datasets import load_dataset

pg19 = load_dataset("pg19", split="train")
# Average length: 50k-150k tokens
# Quality: High (literary works)

# 2. arXiv Papers
arxiv = load_dataset("scientific_papers", "arxiv", split="train")
# Average length: 4k-15k tokens
# Quality: High (technical content)

# 3. Long-form GitHub Code
github = load_dataset("codeparrot/github-code", split="train")
# Filter for large files (>5k tokens)

# 4. Long Conversations
conversations = load_dataset("HuggingFaceH4/ultrachat_200k", split="train")
# Concatenate multi-turn dialogues

# 5. Wikipedia Articles (concatenated)
wikipedia = load_dataset("wikipedia", "20220301.en", split="train")
```

### Creating Training Sequences

```python
def create_long_sequences(dataset, target_length=32768, tokenizer=None):
    """Create training sequences of target length."""
    sequences = []

    for example in dataset:
        # Tokenize
        tokens = tokenizer.encode(example['text'])

        # If single document is long enough
        if len(tokens) >= target_length:
            # Split into chunks
            for i in range(0, len(tokens) - target_length, target_length // 2):
                sequences.append(tokens[i:i + target_length])
        else:
            # Concatenate multiple documents
            buffer = tokens
            while len(buffer) < target_length:
                next_example = next(dataset)
                buffer.extend(tokenizer.encode(next_example['text']))

            sequences.append(buffer[:target_length])

    return sequences
```

### Data Quality Checks

```python
def validate_training_data(sequences, tokenizer, min_length=8192):
    """Ensure data quality for context extension."""
    issues = []

    for i, seq in enumerate(sequences):
        # 1. Check length
        if len(seq) < min_length:
            issues.append(f"Sequence {i}: too short ({len(seq)} tokens)")

        # 2. Check for repetition (copy-paste errors)
        if has_excessive_repetition(seq):
            issues.append(f"Sequence {i}: excessive repetition")

        # 3. Check for truncation artifacts
        if looks_truncated(seq, tokenizer):
            issues.append(f"Sequence {i}: appears truncated")

    if issues:
        print(f"⚠️  Found {len(issues)} data quality issues:")
        for issue in issues[:10]:  # Show first 10
            print(f"  - {issue}")

    return len(issues) == 0

def has_excessive_repetition(tokens, window=50, threshold=0.8):
    """Detect copy-paste or generated repetition."""
    for i in range(len(tokens) - window * 2):
        chunk1 = tokens[i:i + window]
        chunk2 = tokens[i + window:i + window * 2]
        similarity = sum(a == b for a, b in zip(chunk1, chunk2)) / window
        if similarity > threshold:
            return True
    return False

def looks_truncated(tokens, tokenizer):
    """Check if sequence ends mid-sentence."""
    last_20 = tokenizer.decode(tokens[-20:])
    # Check for incomplete sentences
    return not any(last_20.endswith(c) for c in ['.', '!', '?', '\n'])
```

## Training Configuration

### Position Interpolation Setup

**Minimal fine-tuning** (fastest method):

```python
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    TrainingArguments,
    Trainer
)

# 1. Load base model
model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-2-7b-hf",
    torch_dtype=torch.float16,
    device_map="auto"
)
tokenizer = AutoTokenizer.from_pretrained("meta-llama/Llama-2-7b-hf")

# 2. Configure position interpolation
scaling_factor = 16.0  # 2k → 32k
model.config.max_position_embeddings = 32768
model.config.rope_scaling = {
    "type": "linear",
    "factor": scaling_factor
}

# 3. Training arguments
training_args = TrainingArguments(
    output_dir="./llama-2-7b-32k",
    num_train_epochs=1,
    max_steps=1000,                # Only 1000 steps!
    per_device_train_batch_size=1,
    gradient_accumulation_steps=16,
    learning_rate=2e-5,            # Low LR
    warmup_steps=100,
    lr_scheduler_type="cosine",
    logging_steps=10,
    save_steps=500,
    bf16=True,
    gradient_checkpointing=True,   # Reduce memory
    dataloader_num_workers=4,
)

# 4. Create trainer
trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=long_context_dataset,
    data_collator=DataCollatorForLanguageModeling(tokenizer, mlm=False),
)

# 5. Train
trainer.train()
```

### YaRN Setup

**State-of-the-art extension** (best quality):

```python
# 1. Install YaRN
# git clone https://github.com/jquesnelle/yarn
# cd yarn && pip install -e .

# 2. Configure YaRN scaling
model.config.max_position_embeddings = 32768
model.config.rope_scaling = {
    "type": "yarn",
    "factor": 16.0,
    "original_max_position_embeddings": 2048,
    "attention_factor": 1.0,
    "beta_fast": 32,
    "beta_slow": 1,
}

# 3. Training arguments (fewer steps than position interpolation!)
training_args = TrainingArguments(
    output_dir="./llama-2-7b-32k-yarn",
    max_steps=400,                 # 400 steps (vs 1000 for PI)
    per_device_train_batch_size=1,
    gradient_accumulation_steps=16,
    learning_rate=2e-5,
    warmup_steps=50,
    bf16=True,
    gradient_checkpointing=True,
)

# 4. Train
trainer = Trainer(model=model, args=training_args, train_dataset=dataset)
trainer.train()
```

### Full Configuration Example

```python
# Complete fine-tuning script
import torch
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    TrainingArguments,
    Trainer,
    DataCollatorForLanguageModeling,
)
from datasets import load_dataset

def prepare_long_context_data(dataset, tokenizer, context_length=32768):
    """Prepare training data."""
    def tokenize_function(examples):
        # Concatenate all texts
        concatenated = "\n\n".join(examples['text'])
        # Tokenize
        tokenized = tokenizer(
            concatenated,
            truncation=False,
            return_tensors=None,
        )
        # Split into chunks
        total_length = len(tokenized['input_ids'])
        chunks = []
        for i in range(0, total_length - context_length, context_length // 2):
            chunk = {
                'input_ids': tokenized['input_ids'][i:i + context_length],
                'attention_mask': tokenized['attention_mask'][i:i + context_length],
            }
            chunks.append(chunk)
        return chunks

    return dataset.map(tokenize_function, batched=True, remove_columns=dataset.column_names)

def fine_tune_long_context(
    base_model="meta-llama/Llama-2-7b-hf",
    target_context=32768,
    method="yarn",  # or "linear"
    output_dir="./output",
    max_steps=400,
):
    """Complete fine-tuning pipeline."""

    # Load model and tokenizer
    print(f"Loading {base_model}...")
    model = AutoModelForCausalLM.from_pretrained(
        base_model,
        torch_dtype=torch.bfloat16,
        device_map="auto",
        use_cache=False  # Required for gradient checkpointing
    )
    tokenizer = AutoTokenizer.from_pretrained(base_model)
    tokenizer.pad_token = tokenizer.eos_token

    # Configure scaling
    original_context = model.config.max_position_embeddings
    scaling_factor = target_context / original_context

    print(f"Scaling {original_context} → {target_context} ({scaling_factor}×)")
    model.config.max_position_embeddings = target_context

    if method == "yarn":
        model.config.rope_scaling = {
            "type": "yarn",
            "factor": scaling_factor,
            "original_max_position_embeddings": original_context,
            "attention_factor": 1.0,
            "beta_fast": 32,
            "beta_slow": 1,
        }
    else:  # linear
        model.config.rope_scaling = {
            "type": "linear",
            "factor": scaling_factor
        }

    # Enable gradient checkpointing
    model.gradient_checkpointing_enable()

    # Load and prepare data
    print("Preparing training data...")
    dataset = load_dataset("pg19", split="train[:1000]")  # Use subset for testing
    train_dataset = prepare_long_context_data(dataset, tokenizer, target_context)

    # Training arguments
    training_args = TrainingArguments(
        output_dir=output_dir,
        max_steps=max_steps,
        per_device_train_batch_size=1,
        gradient_accumulation_steps=16,
        learning_rate=2e-5,
        warmup_steps=max_steps // 10,
        lr_scheduler_type="cosine",
        logging_steps=10,
        save_steps=max_steps // 4,
        bf16=True,
        gradient_checkpointing=True,
        dataloader_num_workers=4,
        remove_unused_columns=False,
    )

    # Trainer
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        data_collator=DataCollatorForLanguageModeling(tokenizer, mlm=False),
    )

    # Train
    print("Starting fine-tuning...")
    trainer.train()

    # Save
    print(f"Saving model to {output_dir}...")
    model.save_pretrained(output_dir)
    tokenizer.save_pretrained(output_dir)

    print("Done!")

# Usage
if __name__ == "__main__":
    fine_tune_long_context(
        base_model="meta-llama/Llama-2-7b-hf",
        target_context=32768,
        method="yarn",
        max_steps=400,
    )
```

## Evaluation

### Perplexity Evaluation

```python
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from datasets import load_dataset
import math

def evaluate_perplexity(model, tokenizer, dataset, context_length=32768):
    """Evaluate perplexity on long context."""
    model.eval()
    total_loss = 0
    total_tokens = 0

    with torch.no_grad():
        for example in dataset:
            # Tokenize
            tokens = tokenizer(
                example['text'],
                return_tensors='pt',
                max_length=context_length,
                truncation=True,
            ).to(model.device)

            # Forward pass
            outputs = model(**tokens, labels=tokens['input_ids'])
            loss = outputs.loss
            num_tokens = tokens['input_ids'].numel()

            total_loss += loss.item() * num_tokens
            total_tokens += num_tokens

    # Compute perplexity
    avg_loss = total_loss / total_tokens
    perplexity = math.exp(avg_loss)

    return perplexity

# Usage
model = AutoModelForCausalLM.from_pretrained("./llama-2-7b-32k")
tokenizer = AutoTokenizer.from_pretrained("./llama-2-7b-32k")

test_dataset = load_dataset("pg19", split="test[:100]")
ppl = evaluate_perplexity(model, tokenizer, test_dataset, context_length=32768)

print(f"Perplexity at 32k context: {ppl:.2f}")
```

### Passkey Retrieval Test

```python
def passkey_retrieval_test(model, tokenizer, context_lengths=[4096, 8192, 16384, 32768]):
    """Test ability to retrieve information from different positions."""
    results = {}

    for context_len in context_lengths:
        # Create synthetic document with passkey at random position
        passkey = "12345"
        position = random.randint(100, context_len - 100)

        # Generate filler text
        filler = "The quick brown fox jumps over the lazy dog. " * (context_len // 10)
        text = filler[:position] + f"The passkey is {passkey}. " + filler[position:]

        # Truncate to context length
        tokens = tokenizer(text, return_tensors='pt', max_length=context_len, truncation=True)

        # Query
        prompt = text + "\nWhat is the passkey?"
        inputs = tokenizer(prompt, return_tensors='pt').to(model.device)

        # Generate
        outputs = model.generate(**inputs, max_new_tokens=10)
        response = tokenizer.decode(outputs[0], skip_special_tokens=True)

        # Check if passkey retrieved
        success = passkey in response
        results[context_len] = success

        print(f"Context {context_len}: {'✓' if success else '✗'}")

    return results
```

### Long Document Q&A

```python
from datasets import load_dataset

def test_long_qa(model, tokenizer, max_length=32768):
    """Test on long-form QA dataset."""
    # Load dataset
    dataset = load_dataset("narrativeqa", split="test[:100]")

    correct = 0
    total = 0

    for example in dataset:
        # Long document
        document = example['document']['text']
        question = example['question']['text']
        gold_answers = example['answers']

        # Create prompt
        prompt = f"Document:\n{document}\n\nQuestion: {question}\n\nAnswer:"

        # Tokenize (may exceed original context)
        inputs = tokenizer(
            prompt,
            return_tensors='pt',
            max_length=max_length,
            truncation=True
        ).to(model.device)

        # Generate
        outputs = model.generate(
            **inputs,
            max_new_tokens=50,
            temperature=0.7,
        )
        answer = tokenizer.decode(outputs[0][inputs['input_ids'].shape[1]:], skip_special_tokens=True)

        # Check correctness
        if any(gold in answer.lower() for gold in gold_answers):
            correct += 1
        total += 1

    accuracy = correct / total
    print(f"Long QA Accuracy: {accuracy:.1%}")
    return accuracy
```

## Best Practices

### 1. Gradual Scaling

```python
# Don't jump directly to 128k!
# Scale incrementally:

# Step 1: 2k → 8k
fine_tune(model, target=8192, steps=200)

# Step 2: 8k → 16k
fine_tune(model, target=16384, steps=200)

# Step 3: 16k → 32k
fine_tune(model, target=32768, steps=400)

# Each step builds on previous, reducing total training needed
```

### 2. Learning Rate Tuning

```python
# Position Interpolation: Lower LR
lr_pi = 2e-5

# YaRN: Can use slightly higher LR
lr_yarn = 5e-5

# Rule: Larger scaling factors need lower LR
lr = base_lr / sqrt(scaling_factor)
```

### 3. Gradient Checkpointing

```python
# Essential for long context (saves ~50% memory)
model.gradient_checkpointing_enable()

# Trade-off: ~20% slower training, but fits in memory
```

### 4. Flash Attention

```python
# 2-3× speedup for long sequences
model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-2-7b-hf",
    attn_implementation="flash_attention_2",  # Flash Attention 2
    torch_dtype=torch.bfloat16
)
```

## Production Deployment

### Save and Upload

```python
# Save fine-tuned model
model.save_pretrained("./llama-2-7b-32k-yarn")
tokenizer.save_pretrained("./llama-2-7b-32k-yarn")

# Upload to HuggingFace Hub
from huggingface_hub import HfApi

api = HfApi()
api.upload_folder(
    folder_path="./llama-2-7b-32k-yarn",
    repo_id="your-username/llama-2-7b-32k-yarn",
    repo_type="model",
)
```

### Inference Configuration

```python
# Load for inference
model = AutoModelForCausalLM.from_pretrained(
    "your-username/llama-2-7b-32k-yarn",
    torch_dtype=torch.float16,
    device_map="auto",
    max_memory={0: "40GB", "cpu": "100GB"}  # Offload to CPU if needed
)

# Process long document
long_text = "..." * 30000  # 30k tokens
inputs = tokenizer(long_text, return_tensors="pt", truncation=False).to('cuda')

outputs = model.generate(
    **inputs,
    max_new_tokens=512,
    do_sample=True,
    temperature=0.7,
    top_p=0.9,
)

response = tokenizer.decode(outputs[0], skip_special_tokens=True)
```

## Troubleshooting

### Issue: Out of Memory

**Solutions**:
1. Enable gradient checkpointing
2. Reduce batch size to 1
3. Increase gradient accumulation steps
4. Use bfloat16 or float16
5. Use Flash Attention

### Issue: Poor Extrapolation

**Solutions**:
1. Use YaRN instead of linear scaling
2. Increase fine-tuning steps
3. Use higher-quality long-form data
4. Gradual scaling (8k → 16k → 32k)

### Issue: Training Instability

**Solutions**:
1. Lower learning rate
2. Increase warmup steps
3. Use gradient clipping
4. Check data quality

## Resources

- **Position Interpolation Paper**: https://arxiv.org/abs/2306.15595
- **YaRN Paper**: https://arxiv.org/abs/2309.00071
- **Together AI Guide**: https://www.together.ai/blog/llama-2-7b-32k
- **HuggingFace Long Context Guide**: https://huggingface.co/blog/long-range-transformers
