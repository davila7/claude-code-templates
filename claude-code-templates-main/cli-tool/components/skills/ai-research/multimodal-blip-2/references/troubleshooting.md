# BLIP-2 Troubleshooting Guide

## Installation Issues

### Import errors

**Error**: `ModuleNotFoundError: No module named 'transformers'`

**Solutions**:
```bash
# Install transformers with vision support
pip install transformers[vision] accelerate

# Or install all optional dependencies
pip install transformers accelerate torch Pillow scipy

# Verify installation
python -c "from transformers import Blip2ForConditionalGeneration; print('OK')"
```

### LAVIS installation fails

**Error**: Errors installing salesforce-lavis

**Solutions**:
```bash
# Install from source
git clone https://github.com/salesforce/LAVIS.git
cd LAVIS
pip install -e .

# Or specific version
pip install salesforce-lavis==1.0.2

# Install dependencies separately if issues persist
pip install omegaconf iopath timm webdataset
pip install salesforce-lavis --no-deps
```

### CUDA version mismatch

**Error**: `RuntimeError: CUDA error: no kernel image is available`

**Solutions**:
```bash
# Check CUDA version
nvcc --version
python -c "import torch; print(torch.version.cuda)"

# Install matching PyTorch
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121

# For CUDA 11.8
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118
```

## Model Loading Issues

### Out of memory during load

**Error**: `torch.cuda.OutOfMemoryError` during model loading

**Solutions**:
```python
# Use quantization
from transformers import BitsAndBytesConfig

quantization_config = BitsAndBytesConfig(load_in_8bit=True)
model = Blip2ForConditionalGeneration.from_pretrained(
    "Salesforce/blip2-opt-2.7b",
    quantization_config=quantization_config,
    device_map="auto"
)

# Or 4-bit quantization
quantization_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_compute_dtype=torch.float16
)

# Use smaller model
model = Blip2ForConditionalGeneration.from_pretrained(
    "Salesforce/blip2-opt-2.7b",  # Instead of 6.7b or flan-t5-xxl
    torch_dtype=torch.float16,
    device_map="auto"
)

# Offload to CPU
model = Blip2ForConditionalGeneration.from_pretrained(
    "Salesforce/blip2-opt-6.7b",
    device_map="auto",
    offload_folder="offload"
)
```

### Model download fails

**Error**: Connection errors or incomplete downloads

**Solutions**:
```python
# Set cache directory
import os
os.environ["HF_HOME"] = "/path/to/cache"

# Resume download
from huggingface_hub import snapshot_download
snapshot_download(
    "Salesforce/blip2-opt-2.7b",
    resume_download=True
)

# Use local files only after download
model = Blip2ForConditionalGeneration.from_pretrained(
    "Salesforce/blip2-opt-2.7b",
    local_files_only=True
)
```

### Weight loading errors

**Error**: `RuntimeError: Error(s) in loading state_dict`

**Solutions**:
```python
# Ignore mismatched weights
model = Blip2ForConditionalGeneration.from_pretrained(
    "Salesforce/blip2-opt-2.7b",
    ignore_mismatched_sizes=True
)

# Check model architecture matches checkpoint
from transformers import AutoConfig
config = AutoConfig.from_pretrained("Salesforce/blip2-opt-2.7b")
print(config.text_config.model_type)  # Should be 'opt'
```

## Inference Issues

### Image format errors

**Error**: `ValueError: Unable to create tensor`

**Solutions**:
```python
from PIL import Image

# Ensure RGB format
image = Image.open("image.jpg").convert("RGB")

# Handle different formats
def load_image(path):
    image = Image.open(path)

    # Convert RGBA to RGB
    if image.mode == "RGBA":
        background = Image.new("RGB", image.size, (255, 255, 255))
        background.paste(image, mask=image.split()[3])
        image = background
    elif image.mode != "RGB":
        image = image.convert("RGB")

    return image

# Handle URL images
import requests
from io import BytesIO

def load_image_from_url(url):
    response = requests.get(url)
    image = Image.open(BytesIO(response.content))
    return image.convert("RGB")
```

### Empty or nonsensical output

**Problem**: Model returns empty string or gibberish

**Solutions**:
```python
# Check input preprocessing
inputs = processor(images=image, return_tensors="pt")
print(f"Pixel values shape: {inputs['pixel_values'].shape}")
# Should be [1, 3, 224, 224] for single image

# Ensure correct dtype
inputs = inputs.to("cuda", torch.float16)

# Use better generation parameters
generated_ids = model.generate(
    **inputs,
    max_new_tokens=100,
    min_length=10,
    num_beams=5,
    do_sample=False  # Deterministic for debugging
)

# Check decoder starting tokens
print(f"Generated IDs: {generated_ids}")
```

### Slow generation

**Problem**: Generation takes too long

**Solutions**:
```python
# Reduce max_new_tokens
generated_ids = model.generate(**inputs, max_new_tokens=30)

# Use greedy decoding (faster than beam search)
generated_ids = model.generate(
    **inputs,
    max_new_tokens=50,
    num_beams=1,
    do_sample=False
)

# Enable model compilation (PyTorch 2.0+)
model = torch.compile(model)

# Use Flash Attention
model = Blip2ForConditionalGeneration.from_pretrained(
    "Salesforce/blip2-opt-2.7b",
    torch_dtype=torch.float16,
    attn_implementation="flash_attention_2",
    device_map="auto"
)
```

### Batch processing errors

**Error**: Dimension mismatch in batch processing

**Solutions**:
```python
# Ensure consistent image sizes with padding
inputs = processor(
    images=images,
    return_tensors="pt",
    padding=True
)

# Handle variable size images
from torchvision import transforms

transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
])

# Ensure all images are same size before processing
images = [transform(img) for img in images]

# For text inputs, use padding
inputs = processor(
    images=images,
    text=questions,
    return_tensors="pt",
    padding="max_length",
    max_length=32,
    truncation=True
)
```

## Memory Issues

### CUDA out of memory

**Error**: `torch.cuda.OutOfMemoryError: CUDA out of memory`

**Solutions**:
```python
# Clear cache before inference
torch.cuda.empty_cache()

# Use smaller batch size
batch_size = 1  # Start with 1

# Process sequentially
results = []
for image in images:
    inputs = processor(images=image, return_tensors="pt").to("cuda", torch.float16)
    generated_ids = model.generate(**inputs, max_new_tokens=50)
    results.append(processor.decode(generated_ids[0], skip_special_tokens=True))
    torch.cuda.empty_cache()

# Use gradient checkpointing
model.gradient_checkpointing_enable()

# Monitor memory
print(f"Allocated: {torch.cuda.memory_allocated() / 1e9:.2f} GB")
print(f"Cached: {torch.cuda.memory_reserved() / 1e9:.2f} GB")
```

### Memory leak during batch processing

**Problem**: Memory grows over time

**Solutions**:
```python
import gc

# Delete tensors explicitly
del inputs, generated_ids
gc.collect()
torch.cuda.empty_cache()

# Use context manager
with torch.inference_mode():
    inputs = processor(images=image, return_tensors="pt").to("cuda", torch.float16)
    generated_ids = model.generate(**inputs, max_new_tokens=50)
    caption = processor.decode(generated_ids[0], skip_special_tokens=True)

# Move to CPU after inference
caption = processor.decode(generated_ids.cpu()[0], skip_special_tokens=True)
```

## Quality Issues

### Poor caption quality

**Problem**: Captions are generic or inaccurate

**Solutions**:
```python
# Use larger model
model = Blip2ForConditionalGeneration.from_pretrained(
    "Salesforce/blip2-flan-t5-xl",  # Better quality than OPT
    torch_dtype=torch.float16,
    device_map="auto"
)

# Use prompts for better captions
inputs = processor(
    images=image,
    text="a detailed description of the image:",
    return_tensors="pt"
)

# Increase diversity with sampling
generated_ids = model.generate(
    **inputs,
    max_new_tokens=100,
    num_beams=5,
    num_return_sequences=3,  # Generate multiple
    temperature=0.9,
    do_sample=True
)

# Select best from multiple candidates
```

### VQA hallucinations

**Problem**: Model makes up information not in image

**Solutions**:
```python
# Use more specific questions
# Instead of "What is happening?"
# Ask "Is there a person in this image?"

# Lower temperature
generated_ids = model.generate(
    **inputs,
    max_new_tokens=30,
    temperature=0.3,  # More focused
    do_sample=True
)

# Use beam search (more deterministic)
generated_ids = model.generate(
    **inputs,
    max_new_tokens=30,
    num_beams=5,
    do_sample=False
)

# Add constraints
generated_ids = model.generate(
    **inputs,
    max_new_tokens=30,
    no_repeat_ngram_size=3,
)
```

### Incorrect colors/objects

**Problem**: Model identifies wrong colors or objects

**Solutions**:
```python
# Ensure image is RGB not BGR
import cv2
image_cv = cv2.imread("image.jpg")
image_rgb = cv2.cvtColor(image_cv, cv2.COLOR_BGR2RGB)
image = Image.fromarray(image_rgb)

# Check image quality
print(f"Image size: {image.size}")
print(f"Image mode: {image.mode}")

# Use higher resolution if possible (but processor resizes to 224x224)

# Ask more specific questions
# Instead of "What color is it?"
# Ask "Is the car red or blue?"
```

## Processor Issues

### Tokenizer warnings

**Warning**: `Asking to pad but the tokenizer does not have a padding token`

**Solutions**:
```python
# Set padding token
processor.tokenizer.pad_token = processor.tokenizer.eos_token

# Or specify during processing
inputs = processor(
    images=image,
    text=question,
    return_tensors="pt",
    padding="max_length",
    max_length=32
)
```

### Image normalization issues

**Problem**: Unexpected results due to normalization

**Solutions**:
```python
# Check processor's image normalization
print(processor.image_processor.image_mean)
print(processor.image_processor.image_std)

# Manual normalization if needed
from torchvision import transforms

normalize = transforms.Normalize(
    mean=processor.image_processor.image_mean,
    std=processor.image_processor.image_std
)

# Or use raw pixel values
inputs = processor(
    images=image,
    return_tensors="pt",
    do_normalize=False  # Skip normalization
)
```

## LAVIS-Specific Issues

### Config not found

**Error**: `ConfigError: Config file not found`

**Solutions**:
```python
# Use registry properly
from lavis.common.registry import registry
from lavis.models import load_model_and_preprocess

# Check available models
print(registry.list_models())

# Load with explicit config
model, vis_processors, txt_processors = load_model_and_preprocess(
    name="blip2_opt",
    model_type="pretrain_opt2.7b",
    is_eval=True,
    device="cuda"
)
```

### Dataset loading errors

**Error**: `Dataset not found` or download issues

**Solutions**:
```python
from lavis.datasets.builders import load_dataset

# Set download directory
import os
os.environ["LAVIS_DATASETS_ROOT"] = "/path/to/datasets"

# Download manually first
# Then load with local files
dataset = load_dataset("coco_caption", split="val")
```

## Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| `CUDA out of memory` | Model too large | Use quantization or smaller model |
| `Unable to create tensor` | Invalid image format | Convert to RGB PIL Image |
| `padding_side must be` | Tokenizer config | Set pad_token explicitly |
| `Expected 4D input` | Wrong tensor shape | Add batch dimension with unsqueeze(0) |
| `device mismatch` | Tensors on different devices | Move all to same device |
| `half() not implemented` | CPU doesn't support FP16 | Use float32 on CPU |

## Getting Help

1. **HuggingFace Forums**: https://discuss.huggingface.co
2. **LAVIS GitHub Issues**: https://github.com/salesforce/LAVIS/issues
3. **Paper**: https://arxiv.org/abs/2301.12597
4. **Model Card**: https://huggingface.co/Salesforce/blip2-opt-2.7b

### Reporting Issues

Include:
- Python version
- transformers/lavis version
- PyTorch and CUDA versions
- GPU model and VRAM
- Full error traceback
- Minimal reproducible code
- Image resolution and format
