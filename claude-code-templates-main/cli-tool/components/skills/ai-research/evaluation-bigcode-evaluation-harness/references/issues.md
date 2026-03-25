# Common Issues and Troubleshooting

Solutions to frequently encountered problems with BigCode Evaluation Harness.

## Installation Issues

### Issue: PyTorch Version Conflicts

**Symptom**: Import errors or CUDA incompatibility after installation.

**Solution**: Install PyTorch separately BEFORE installing the harness:
```bash
# Check your CUDA version
nvidia-smi

# Install matching PyTorch (example for CUDA 11.8)
pip install torch --index-url https://download.pytorch.org/whl/cu118

# Then install harness
pip install -e .
```

### Issue: DS-1000 Specific Requirements

**Symptom**: Errors when running DS-1000 benchmark.

**Solution**: DS-1000 requires Python 3.7.10 specifically:
```bash
# Create conda environment
conda create -n ds1000 python=3.7.10
conda activate ds1000

# Install specific dependencies
pip install -e ".[ds1000]"
pip install torch==1.12.1+cu116 --extra-index-url https://download.pytorch.org/whl/cu116

# Set environment variables
export TF_CPP_MIN_LOG_LEVEL=3
export TF_FORCE_GPU_ALLOW_GROWTH=true
```

### Issue: HuggingFace Authentication

**Symptom**: `401 Unauthorized` when accessing gated models/datasets.

**Solution**:
```bash
# Login to HuggingFace
huggingface-cli login

# Use auth token in command
accelerate launch main.py \
  --model meta-llama/CodeLlama-7b-hf \
  --use_auth_token \
  ...
```

## Memory Issues

### Issue: CUDA Out of Memory

**Symptom**: `torch.cuda.OutOfMemoryError: CUDA out of memory`

**Solutions**:

1. **Use quantization**:
```bash
# 8-bit quantization (saves ~50% memory)
accelerate launch main.py \
  --model bigcode/starcoder2-15b \
  --load_in_8bit \
  ...

# 4-bit quantization (saves ~75% memory)
accelerate launch main.py \
  --model bigcode/starcoder2-15b \
  --load_in_4bit \
  ...
```

2. **Reduce batch size**:
```bash
--batch_size 1
```

3. **Set memory limits**:
```bash
--max_memory_per_gpu "20GiB"
# OR
--max_memory_per_gpu auto
```

4. **Use half precision**:
```bash
--precision fp16
# OR
--precision bf16
```

### Issue: Running Out of RAM During Evaluation

**Symptom**: Process killed, system becomes unresponsive.

**Solution**: Reduce number of samples being held in memory:
```bash
# Save intermediate results
--save_every_k_tasks 10

# Evaluate subset at a time
--limit 50 --limit_start 0
# Then
--limit 50 --limit_start 50
```

## Execution Issues

### Issue: Code Execution Not Allowed

**Symptom**: Error about code execution being disabled.

**Solution**: Add the execution flag:
```bash
accelerate launch main.py \
  --model ... \
  --tasks humaneval \
  --allow_code_execution  # Required for unit test benchmarks
```

### Issue: Execution Timeout/Hang

**Symptom**: Evaluation hangs indefinitely or times out.

**Solutions**:

1. **Use Docker for isolation**:
```bash
# Generate without execution
accelerate launch main.py \
  --model ... \
  --tasks humaneval \
  --generation_only \
  --save_generations \
  --save_generations_path generations.json

# Evaluate in Docker
docker run -v $(pwd)/generations.json:/app/generations.json:ro \
  -it evaluation-harness python3 main.py \
  --tasks humaneval \
  --load_generations_path /app/generations.json \
  --allow_code_execution
```

2. **Use subsets for debugging**:
```bash
--limit 10  # Only evaluate first 10 problems
```

### Issue: MultiPL-E Language Runtime Errors

**Symptom**: Errors executing code in non-Python languages.

**Solution**: Use the MultiPL-E specific Docker image:
```bash
docker pull ghcr.io/bigcode-project/evaluation-harness-multiple
docker run -it evaluation-harness-multiple ...
```

## Result Discrepancies

### Issue: Results Don't Match Paper/Leaderboard

**Symptom**: Your pass@k scores differ from reported values.

**Common causes and fixes**:

1. **Wrong n_samples**:
```bash
# For accurate pass@k estimation, use n_samples >= 200
--n_samples 200
```

2. **Wrong temperature**:
```bash
# Papers often use different temperatures
# For pass@1: temperature 0.2 (near-greedy)
# For pass@10, pass@100: temperature 0.8 (more sampling)
--temperature 0.8
```

3. **Task name mismatch**:
```bash
# Use exact task names
--tasks humaneval      # Correct
--tasks human_eval     # Wrong
--tasks HumanEval      # Wrong
```

4. **Prompting differences**:
```bash
# Some models need instruction formatting
--instruction_tokens "<s>[INST],</s>,[/INST]"

# Or specific prompt types for HumanEvalPack
--prompt instruct
```

5. **Postprocessing differences**:
```bash
# Enable/disable postprocessing
--postprocess True  # Default
```

### Issue: Inconsistent Results Across Runs

**Symptom**: Different scores each time you run.

**Solution**: For reproducibility:
```bash
# Use greedy decoding for deterministic results
--do_sample False
--temperature 0.0

# OR set seeds (if using sampling)
# Note: Sampling inherently has variance
# Use high n_samples to reduce noise
--n_samples 200
```

## Model Loading Issues

### Issue: Model with Custom Code

**Symptom**: `ValueError: ... requires you to execute the configuration file`

**Solution**:
```bash
--trust_remote_code
```

### Issue: Private/Gated Model Access

**Symptom**: `401 Unauthorized` or `403 Forbidden`

**Solution**:
```bash
# First login
huggingface-cli login

# Then use auth token
--use_auth_token
```

### Issue: PEFT/LoRA Adapter Loading

**Symptom**: Can't load fine-tuned adapter.

**Solution**:
```bash
--model base-model-name \
--peft_model path/to/adapter
```

### Issue: Seq2Seq Model Not Generating

**Symptom**: Empty or truncated outputs with encoder-decoder models.

**Solution**:
```bash
--modeltype seq2seq
```

## Task-Specific Issues

### Issue: Low MBPP Scores with Instruction Models

**Symptom**: Instruction-tuned models score poorly on MBPP.

**Solution**: MBPP prompts are plain text, not instruction format. Consider:
1. Using `instruct-humaneval` for instruction models
2. Creating custom instruction-formatted prompts

### Issue: APPS Taking Too Long

**Symptom**: APPS evaluation runs for hours.

**Solutions**:
```bash
# Use subset
--limit 100

# Reduce samples
--n_samples 10

# Use introductory level only
--tasks apps-introductory
```

### Issue: GSM8K Wrong max_length

**Symptom**: Truncated outputs, low scores on math tasks.

**Solution**: GSM8K needs longer context for 8-shot prompts:
```bash
--max_length_generation 2048  # Not default 512
```

## Docker Issues

### Issue: Docker Image Pull Fails

**Symptom**: `Error response from daemon: manifest unknown`

**Solution**: Build locally:
```bash
# Clone repo
git clone https://github.com/bigcode-project/bigcode-evaluation-harness.git
cd bigcode-evaluation-harness

# Build image
sudo make DOCKERFILE=Dockerfile all

# For MultiPL-E
sudo make DOCKERFILE=Dockerfile-multiple all
```

### Issue: Docker Can't Access GPU

**Symptom**: No GPU available inside container.

**Solution**: Use nvidia-docker:
```bash
docker run --gpus all -it evaluation-harness ...
```

## Debugging Tips

### Enable Verbose Output

```bash
# Check what's being generated
--save_generations
--save_references

# Inspect a few samples
--limit 5
```

### Test Reference Solutions

```bash
# Verify test cases pass with ground truth
--check_references
```

### Inspect Intermediate Results

```bash
# Save progress periodically
--save_every_k_tasks 10
--save_generations_path intermediate_generations.json
```

### Common Debug Workflow

```bash
# 1. Test with tiny subset
accelerate launch main.py \
  --model your-model \
  --tasks humaneval \
  --limit 3 \
  --n_samples 1 \
  --save_generations \
  --allow_code_execution

# 2. Inspect generations
cat generations.json | python -m json.tool | head -100

# 3. If looks good, scale up
accelerate launch main.py \
  --model your-model \
  --tasks humaneval \
  --n_samples 200 \
  --allow_code_execution
```

## Getting Help

1. **Check existing issues**: https://github.com/bigcode-project/bigcode-evaluation-harness/issues
2. **Search closed issues**: Often contains solutions
3. **Open new issue** with:
   - Full command used
   - Error message
   - Environment details (Python version, PyTorch version, GPU)
   - Model being evaluated
