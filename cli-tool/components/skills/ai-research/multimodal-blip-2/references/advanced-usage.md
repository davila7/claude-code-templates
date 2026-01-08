# BLIP-2 Advanced Usage Guide

## Fine-tuning BLIP-2

### LoRA fine-tuning (recommended)

```python
import torch
from transformers import Blip2ForConditionalGeneration, Blip2Processor
from peft import LoraConfig, get_peft_model

# Load base model
model = Blip2ForConditionalGeneration.from_pretrained(
    "Salesforce/blip2-opt-2.7b",
    torch_dtype=torch.float16,
    device_map="auto"
)

# Configure LoRA for the language model
lora_config = LoraConfig(
    r=16,
    lora_alpha=32,
    target_modules=["q_proj", "v_proj", "k_proj", "out_proj"],
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM"
)

# Apply LoRA
model = get_peft_model(model, lora_config)
model.print_trainable_parameters()
# trainable params: ~4M, all params: ~3.8B (0.1%)
```

### Fine-tuning Q-Former only

```python
# Freeze everything except Q-Former
for name, param in model.named_parameters():
    if "qformer" not in name.lower():
        param.requires_grad = False
    else:
        param.requires_grad = True

# Check trainable parameters
trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
total = sum(p.numel() for p in model.parameters())
print(f"Trainable: {trainable:,} / {total:,} ({100*trainable/total:.2f}%)")
```

### Custom dataset for fine-tuning

```python
import torch
from torch.utils.data import Dataset, DataLoader
from PIL import Image

class CaptionDataset(Dataset):
    def __init__(self, data, processor, max_length=128):
        self.data = data  # List of {"image_path": str, "caption": str}
        self.processor = processor
        self.max_length = max_length

    def __len__(self):
        return len(self.data)

    def __getitem__(self, idx):
        item = self.data[idx]
        image = Image.open(item["image_path"]).convert("RGB")

        # Process inputs
        encoding = self.processor(
            images=image,
            text=item["caption"],
            padding="max_length",
            truncation=True,
            max_length=self.max_length,
            return_tensors="pt"
        )

        # Remove batch dimension
        encoding = {k: v.squeeze(0) for k, v in encoding.items()}

        # Labels for language modeling
        encoding["labels"] = encoding["input_ids"].clone()

        return encoding

# Create dataloader
dataset = CaptionDataset(train_data, processor)
dataloader = DataLoader(dataset, batch_size=8, shuffle=True)
```

### Training loop

```python
from transformers import AdamW, get_linear_schedule_with_warmup
from tqdm import tqdm

# Optimizer
optimizer = AdamW(model.parameters(), lr=1e-5, weight_decay=0.01)

# Scheduler
num_epochs = 3
num_training_steps = len(dataloader) * num_epochs
scheduler = get_linear_schedule_with_warmup(
    optimizer,
    num_warmup_steps=num_training_steps // 10,
    num_training_steps=num_training_steps
)

# Training
model.train()
for epoch in range(num_epochs):
    total_loss = 0

    for batch in tqdm(dataloader, desc=f"Epoch {epoch+1}"):
        batch = {k: v.to("cuda") for k, v in batch.items()}

        outputs = model(**batch)
        loss = outputs.loss

        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)

        optimizer.step()
        scheduler.step()
        optimizer.zero_grad()

        total_loss += loss.item()

    avg_loss = total_loss / len(dataloader)
    print(f"Epoch {epoch+1} - Loss: {avg_loss:.4f}")

# Save fine-tuned model
model.save_pretrained("blip2-finetuned")
processor.save_pretrained("blip2-finetuned")
```

### Fine-tuning with LAVIS

```python
from lavis.models import load_model_and_preprocess
from lavis.common.registry import registry
from lavis.datasets.builders import load_dataset

# Load model
model, vis_processors, txt_processors = load_model_and_preprocess(
    name="blip2_opt",
    model_type="pretrain_opt2.7b",
    is_eval=False,  # Training mode
    device="cuda"
)

# Load dataset
dataset = load_dataset("coco_caption")

# Get trainer class
runner_cls = registry.get_runner_class("runner_base")
runner = runner_cls(
    cfg=cfg,
    task=task,
    model=model,
    datasets=datasets
)

# Train
runner.train()
```

## Multi-GPU Training

### DataParallel

```python
import torch.nn as nn

model = Blip2ForConditionalGeneration.from_pretrained(
    "Salesforce/blip2-opt-2.7b",
    torch_dtype=torch.float16
)

# Wrap with DataParallel
if torch.cuda.device_count() > 1:
    model = nn.DataParallel(model)

model.to("cuda")
```

### DistributedDataParallel

```python
import torch.distributed as dist
from torch.nn.parallel import DistributedDataParallel as DDP
from torch.utils.data.distributed import DistributedSampler

def setup(rank, world_size):
    dist.init_process_group("nccl", rank=rank, world_size=world_size)
    torch.cuda.set_device(rank)

def train(rank, world_size):
    setup(rank, world_size)

    model = Blip2ForConditionalGeneration.from_pretrained(
        "Salesforce/blip2-opt-2.7b",
        torch_dtype=torch.float16
    ).to(rank)

    model = DDP(model, device_ids=[rank])

    # Use DistributedSampler
    sampler = DistributedSampler(dataset, num_replicas=world_size, rank=rank)
    dataloader = DataLoader(dataset, sampler=sampler, batch_size=4)

    # Training loop
    for epoch in range(num_epochs):
        sampler.set_epoch(epoch)
        for batch in dataloader:
            # ... training code
            pass

    dist.destroy_process_group()

# Launch
import torch.multiprocessing as mp
world_size = torch.cuda.device_count()
mp.spawn(train, args=(world_size,), nprocs=world_size)
```

### Accelerate integration

```python
from accelerate import Accelerator
from transformers import Blip2ForConditionalGeneration, Blip2Processor

accelerator = Accelerator(mixed_precision="fp16")

model = Blip2ForConditionalGeneration.from_pretrained("Salesforce/blip2-opt-2.7b")
optimizer = torch.optim.AdamW(model.parameters(), lr=1e-5)

# Prepare for distributed training
model, optimizer, dataloader = accelerator.prepare(
    model, optimizer, dataloader
)

# Training loop
for batch in dataloader:
    outputs = model(**batch)
    loss = outputs.loss

    accelerator.backward(loss)
    optimizer.step()
    optimizer.zero_grad()
```

## Integration Patterns

### Gradio interface

```python
import gradio as gr
import torch
from PIL import Image
from transformers import Blip2Processor, Blip2ForConditionalGeneration

# Load model
processor = Blip2Processor.from_pretrained("Salesforce/blip2-opt-2.7b")
model = Blip2ForConditionalGeneration.from_pretrained(
    "Salesforce/blip2-opt-2.7b",
    torch_dtype=torch.float16,
    device_map="auto"
)

def caption_image(image, question=None):
    if question:
        inputs = processor(images=image, text=question, return_tensors="pt")
    else:
        inputs = processor(images=image, return_tensors="pt")

    inputs = inputs.to("cuda", torch.float16)

    generated_ids = model.generate(**inputs, max_new_tokens=100)
    return processor.decode(generated_ids[0], skip_special_tokens=True)

# Create interface
demo = gr.Interface(
    fn=caption_image,
    inputs=[
        gr.Image(type="pil", label="Upload Image"),
        gr.Textbox(label="Question (optional)", placeholder="What is in this image?")
    ],
    outputs=gr.Textbox(label="Response"),
    title="BLIP-2 Demo",
    examples=[
        ["example1.jpg", None],
        ["example2.jpg", "What colors are in this image?"]
    ]
)

demo.launch()
```

### FastAPI server

```python
from fastapi import FastAPI, UploadFile, File
from PIL import Image
import torch
from transformers import Blip2Processor, Blip2ForConditionalGeneration
import io

app = FastAPI()

# Load model at startup
processor = None
model = None

@app.on_event("startup")
async def load_model():
    global processor, model
    processor = Blip2Processor.from_pretrained("Salesforce/blip2-opt-2.7b")
    model = Blip2ForConditionalGeneration.from_pretrained(
        "Salesforce/blip2-opt-2.7b",
        torch_dtype=torch.float16,
        device_map="auto"
    )

@app.post("/caption")
async def caption(file: UploadFile = File(...), question: str = None):
    # Read image
    contents = await file.read()
    image = Image.open(io.BytesIO(contents)).convert("RGB")

    # Process
    if question:
        inputs = processor(images=image, text=question, return_tensors="pt")
    else:
        inputs = processor(images=image, return_tensors="pt")

    inputs = inputs.to("cuda", torch.float16)

    # Generate
    generated_ids = model.generate(**inputs, max_new_tokens=100)
    caption = processor.decode(generated_ids[0], skip_special_tokens=True)

    return {"caption": caption}

@app.post("/batch_caption")
async def batch_caption(files: list[UploadFile] = File(...)):
    images = []
    for file in files:
        contents = await file.read()
        images.append(Image.open(io.BytesIO(contents)).convert("RGB"))

    inputs = processor(images=images, return_tensors="pt", padding=True)
    inputs = inputs.to("cuda", torch.float16)

    generated_ids = model.generate(**inputs, max_new_tokens=100)
    captions = processor.batch_decode(generated_ids, skip_special_tokens=True)

    return {"captions": captions}

# Run: uvicorn server:app --host 0.0.0.0 --port 8000
```

### LangChain integration

```python
from langchain.tools import BaseTool
from langchain.agents import initialize_agent, AgentType
from langchain.llms import OpenAI
import torch
from PIL import Image
from transformers import Blip2Processor, Blip2ForConditionalGeneration

class ImageCaptionTool(BaseTool):
    name = "image_caption"
    description = "Generate a caption for an image. Input should be an image file path."

    def __init__(self):
        super().__init__()
        self.processor = Blip2Processor.from_pretrained("Salesforce/blip2-opt-2.7b")
        self.model = Blip2ForConditionalGeneration.from_pretrained(
            "Salesforce/blip2-opt-2.7b",
            torch_dtype=torch.float16,
            device_map="auto"
        )

    def _run(self, image_path: str) -> str:
        image = Image.open(image_path).convert("RGB")
        inputs = self.processor(images=image, return_tensors="pt").to("cuda", torch.float16)
        generated_ids = self.model.generate(**inputs, max_new_tokens=50)
        return self.processor.decode(generated_ids[0], skip_special_tokens=True)

class VisualQATool(BaseTool):
    name = "visual_qa"
    description = "Answer questions about an image. Input format: 'image_path|question'"

    def __init__(self, processor, model):
        super().__init__()
        self.processor = processor
        self.model = model

    def _run(self, query: str) -> str:
        image_path, question = query.split("|")
        image = Image.open(image_path.strip()).convert("RGB")
        inputs = self.processor(images=image, text=question.strip(), return_tensors="pt")
        inputs = inputs.to("cuda", torch.float16)
        generated_ids = self.model.generate(**inputs, max_new_tokens=50)
        return self.processor.decode(generated_ids[0], skip_special_tokens=True)

# Use with agent
tools = [ImageCaptionTool(), VisualQATool(processor, model)]
agent = initialize_agent(tools, llm, agent=AgentType.ZERO_SHOT_REACT_DESCRIPTION)
```

## ONNX Export and Deployment

### Export to ONNX

```python
import torch
from transformers import Blip2ForConditionalGeneration, Blip2Processor

model = Blip2ForConditionalGeneration.from_pretrained("Salesforce/blip2-opt-2.7b")
processor = Blip2Processor.from_pretrained("Salesforce/blip2-opt-2.7b")

# Example inputs
image = Image.open("example.jpg").convert("RGB")
inputs = processor(images=image, return_tensors="pt")

# Export vision encoder
torch.onnx.export(
    model.vision_model,
    inputs["pixel_values"],
    "blip2_vision.onnx",
    input_names=["pixel_values"],
    output_names=["image_embeds"],
    dynamic_axes={
        "pixel_values": {0: "batch_size"},
        "image_embeds": {0: "batch_size"}
    },
    opset_version=14
)
```

### TensorRT optimization

```python
import tensorrt as trt
import pycuda.driver as cuda

def build_engine(onnx_path, engine_path):
    logger = trt.Logger(trt.Logger.WARNING)
    builder = trt.Builder(logger)
    network = builder.create_network(1 << int(trt.NetworkDefinitionCreationFlag.EXPLICIT_BATCH))
    parser = trt.OnnxParser(network, logger)

    with open(onnx_path, 'rb') as f:
        parser.parse(f.read())

    config = builder.create_builder_config()
    config.set_flag(trt.BuilderFlag.FP16)  # Enable FP16
    config.max_workspace_size = 1 << 30  # 1GB

    engine = builder.build_serialized_network(network, config)

    with open(engine_path, 'wb') as f:
        f.write(engine)

build_engine("blip2_vision.onnx", "blip2_vision.trt")
```

## Specialized Use Cases

### Video captioning (frame-by-frame)

```python
import cv2
import torch
from PIL import Image

def caption_video(video_path, sample_rate=30):
    """Caption video by sampling frames."""
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    frame_interval = int(fps * sample_rate / 30)  # Sample every N frames

    captions = []
    frame_count = 0

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        if frame_count % frame_interval == 0:
            # Convert BGR to RGB
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            image = Image.fromarray(rgb_frame)

            # Caption
            inputs = processor(images=image, return_tensors="pt").to("cuda", torch.float16)
            generated_ids = model.generate(**inputs, max_new_tokens=50)
            caption = processor.decode(generated_ids[0], skip_special_tokens=True)

            timestamp = frame_count / fps
            captions.append({"timestamp": timestamp, "caption": caption})

        frame_count += 1

    cap.release()
    return captions

# Usage
captions = caption_video("video.mp4", sample_rate=1)  # 1 frame per second
for c in captions:
    print(f"[{c['timestamp']:.1f}s] {c['caption']}")
```

### Document understanding

```python
def analyze_document(image_path):
    """Extract information from document image."""
    image = Image.open(image_path).convert("RGB")

    questions = [
        "What type of document is this?",
        "What is the title of this document?",
        "What are the main sections?",
        "Summarize the key information."
    ]

    results = {}
    for q in questions:
        inputs = processor(images=image, text=q, return_tensors="pt").to("cuda", torch.float16)
        generated_ids = model.generate(**inputs, max_new_tokens=100)
        answer = processor.decode(generated_ids[0], skip_special_tokens=True)
        results[q] = answer

    return results

# Usage
doc_info = analyze_document("invoice.png")
for q, a in doc_info.items():
    print(f"Q: {q}\nA: {a}\n")
```

### Medical image analysis

```python
def analyze_medical_image(image_path, modality="xray"):
    """Analyze medical images with specific prompts."""
    image = Image.open(image_path).convert("RGB")

    prompts = {
        "xray": [
            "Describe any abnormalities visible in this chest X-ray.",
            "What anatomical structures are visible?",
            "Is there any evidence of pathology?"
        ],
        "ct": [
            "Describe the CT scan findings.",
            "What organs are visible in this slice?",
            "Are there any masses or lesions?"
        ],
        "mri": [
            "Describe the MRI findings.",
            "What tissues show abnormal signal intensity?",
            "What is the most likely diagnosis?"
        ]
    }

    results = []
    for prompt in prompts.get(modality, prompts["xray"]):
        inputs = processor(images=image, text=prompt, return_tensors="pt").to("cuda", torch.float16)
        generated_ids = model.generate(**inputs, max_new_tokens=150)
        answer = processor.decode(generated_ids[0], skip_special_tokens=True)
        results.append({"question": prompt, "answer": answer})

    return results

# Note: BLIP-2 is not trained on medical data - use specialized models for clinical use
```

## Evaluation

### Caption evaluation metrics

```python
from pycocoevalcap.bleu.bleu import Bleu
from pycocoevalcap.meteor.meteor import Meteor
from pycocoevalcap.rouge.rouge import Rouge
from pycocoevalcap.cider.cider import Cider

def evaluate_captions(predictions, references):
    """
    Evaluate generated captions against references.

    Args:
        predictions: dict {image_id: [caption]}
        references: dict {image_id: [ref1, ref2, ...]}
    """
    scorers = [
        (Bleu(4), ["Bleu_1", "Bleu_2", "Bleu_3", "Bleu_4"]),
        (Meteor(), "METEOR"),
        (Rouge(), "ROUGE_L"),
        (Cider(), "CIDEr"),
    ]

    results = {}
    for scorer, method in scorers:
        score, _ = scorer.compute_score(references, predictions)
        if isinstance(method, list):
            for sc, m in zip(score, method):
                results[m] = sc
        else:
            results[method] = score

    return results

# Usage
preds = {0: ["a cat sitting on a mat"], 1: ["a dog running in the park"]}
refs = {0: ["a cat on a mat", "cat sitting"], 1: ["dog in park", "running dog"]}
scores = evaluate_captions(preds, refs)
print(scores)
```

### VQA evaluation

```python
def vqa_accuracy(predictions, ground_truths):
    """
    VQA accuracy metric (soft accuracy from VQA challenge).

    Args:
        predictions: list of predicted answers
        ground_truths: list of lists (multiple annotator answers)
    """
    def compute_accuracy(pred, gts):
        pred = pred.lower().strip()
        gts = [gt.lower().strip() for gt in gts]

        # Count matches
        matches = sum(1 for gt in gts if pred == gt)
        return min(matches / 3, 1.0)  # Cap at 1.0

    accuracies = []
    for pred, gts in zip(predictions, ground_truths):
        accuracies.append(compute_accuracy(pred, gts))

    return sum(accuracies) / len(accuracies)

# Usage
preds = ["yes", "a dog", "blue"]
gts = [["yes", "yes", "no"], ["dog", "a dog", "puppy"], ["blue", "light blue", "azure"]]
acc = vqa_accuracy(preds, gts)
print(f"VQA Accuracy: {acc:.2%}")
```

## Model Comparison

### BLIP-2 variants benchmark

| Model | COCO Caption (CIDEr) | VQAv2 (Acc) | GQA (Acc) | VRAM |
|-------|---------------------|-------------|-----------|------|
| blip2-opt-2.7b | 129.7 | 52.6 | 41.3 | 8GB |
| blip2-opt-6.7b | 133.4 | 54.2 | 42.8 | 16GB |
| blip2-flan-t5-xl | 138.1 | 62.9 | 44.1 | 10GB |
| blip2-flan-t5-xxl | 145.8 | 65.0 | 45.9 | 26GB |

### Comparison with other models

| Model | Architecture | Zero-shot VQA | Training Cost |
|-------|-------------|---------------|---------------|
| BLIP-2 | Q-Former + LLM | Excellent | Low (Q-Former only) |
| LLaVA | Linear + LLM | Good | Medium |
| Flamingo | Perceiver + LLM | Excellent | High |
| InstructBLIP | Q-Former + LLM | Best | Low |
