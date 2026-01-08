# NanoGPT Data Preparation

## Data Format

NanoGPT uses **binary token files** for efficient loading:

```
dataset/
├── train.bin       # Training tokens (uint16 array)
├── val.bin         # Validation tokens (uint16 array)
└── meta.pkl        # Metadata (vocab_size, mappings)
```

**Why binary?**
- 100× faster than reading text files
- Memory-mapped loading (no RAM overhead)
- Simple format (just token IDs)

## Character-Level Tokenization

### Shakespeare Example

**Input text**:
```
First Citizen:
Before we proceed any further, hear me speak.

All:
Speak, speak.
```

**Character vocabulary** (65 total):
```python
chars = ['\n', ' ', '!', ',', '.', ':', ';', '?', 'A', 'B', ..., 'z']
stoi = {'\n': 0, ' ': 1, '!': 2, ...}  # char → ID
itos = {0: '\n', 1: ' ', 2: '!', ...}  # ID → char
```

**Tokenization**:
```python
text = "First Citizen:"
tokens = [18, 47, 56, 57, 58, 1, 15, 47, 58, 47, 63, 43, 52, 10]
# F=18, i=47, r=56, s=57, t=58, ' '=1, C=15, ...
```

**Full preparation script**:

```python
# data/shakespeare_char/prepare.py
import os
import requests
import pickle
import numpy as np

# Download Shakespeare dataset
input_file = 'input.txt'
if not os.path.exists(input_file):
    url = 'https://raw.githubusercontent.com/karpathy/char-rnn/master/data/tinyshakespeare/input.txt'
    with open(input_file, 'w') as f:
        f.write(requests.get(url).text)

# Load text
with open(input_file, 'r') as f:
    data = f.read()

print(f"Dataset size: {len(data):,} characters")

# Build vocabulary
chars = sorted(list(set(data)))
vocab_size = len(chars)
print(f"Vocabulary: {vocab_size} unique characters")
print(f"Characters: {''.join(chars[:20])}...")

# Create mappings
stoi = {ch: i for i, ch in enumerate(chars)}
itos = {i: ch for i, ch in enumerate(chars)}

# Encode full dataset
def encode(s):
    return [stoi[c] for c in s]

def decode(l):
    return ''.join([itos[i] for i in l])

# Split train/val (90/10)
n = len(data)
train_data = data[:int(n * 0.9)]
val_data = data[int(n * 0.9):]

# Tokenize
train_ids = encode(train_data)
val_ids = encode(val_data)

print(f"Train: {len(train_ids):,} tokens")
print(f"Val: {len(val_ids):,} tokens")

# Save as binary (uint16)
train_ids = np.array(train_ids, dtype=np.uint16)
val_ids = np.array(val_ids, dtype=np.uint16)

train_ids.tofile('train.bin')
val_ids.tofile('val.bin')

# Save metadata
meta = {
    'vocab_size': vocab_size,
    'itos': itos,
    'stoi': stoi,
}

with open('meta.pkl', 'wb') as f:
    pickle.dump(meta, f)

print("Saved train.bin, val.bin, meta.pkl")
```

**Output**:
```
Dataset size: 1,115,394 characters
Vocabulary: 65 unique characters
Characters:  !$&',-.3:;?ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz
Train: 1,003,854 tokens
Val: 111,540 tokens
Saved train.bin, val.bin, meta.pkl
```

### Custom Character Dataset

```python
# For your own text dataset
text = open('my_data.txt', 'r').read()

# Build vocab
chars = sorted(list(set(text)))
vocab_size = len(chars)

# Create mappings
stoi = {ch: i for i, ch in enumerate(chars)}
itos = {i: ch for i, ch in enumerate(chars)}

# Encode
encode = lambda s: [stoi[c] for c in s]
decode = lambda l: ''.join([itos[i] for i in l])

# Split and save
data = np.array(encode(text), dtype=np.uint16)
n = len(data)
train = data[:int(n*0.9)]
val = data[int(n*0.9):]

train.tofile('data/custom/train.bin')
val.tofile('data/custom/val.bin')

# Save meta
with open('data/custom/meta.pkl', 'wb') as f:
    pickle.dump({'vocab_size': vocab_size, 'itos': itos, 'stoi': stoi}, f)
```

## BPE (Byte Pair Encoding)

### OpenWebText with GPT-2 Tokenizer

**BPE advantages**:
- Handles rare words better (subword units)
- Standard for GPT-2, GPT-3
- Vocabulary: 50,257 tokens

**Preparation script**:

```python
# data/openwebtext/prepare.py
import os
import numpy as np
import tiktoken
from datasets import load_dataset
from tqdm import tqdm

# Number of workers for parallel processing
num_proc = 8
num_proc_load_dataset = num_proc

# Download OpenWebText dataset
dataset = load_dataset("openwebtext", num_proc=num_proc_load_dataset)

# Use GPT-2 tokenizer
enc = tiktoken.get_encoding("gpt2")

def process(example):
    """Tokenize a single example."""
    ids = enc.encode_ordinary(example['text'])  # Tokenize
    ids.append(enc.eot_token)  # Add end-of-text token
    out = {'ids': ids, 'len': len(ids)}
    return out

# Tokenize entire dataset (parallel)
tokenized = dataset.map(
    process,
    remove_columns=['text'],
    desc="Tokenizing",
    num_proc=num_proc,
)

# Concatenate all into one big array
train_ids = np.concatenate([
    np.array(sample['ids'], dtype=np.uint16)
    for sample in tqdm(tokenized['train'], desc="Concatenating")
])

print(f"Total tokens: {len(train_ids):,}")  # ~9 billion tokens

# Save train.bin
train_ids.tofile(os.path.join(os.path.dirname(__file__), 'train.bin'))

# Create val.bin (sample from train)
# Take first 5000 documents for validation
val_ids = np.concatenate([
    np.array(sample['ids'], dtype=np.uint16)
    for sample in tokenized['train'][:5000]
])
val_ids.tofile(os.path.join(os.path.dirname(__file__), 'val.bin'))

# Save metadata
import pickle
meta = {
    'vocab_size': enc.n_vocab,
    'eot_token': enc.eot_token,
}
with open(os.path.join(os.path.dirname(__file__), 'meta.pkl'), 'wb') as f:
    pickle.dump(meta, f)

print(f"Train tokens: {len(train_ids):,}")
print(f"Val tokens: {len(val_ids):,}")
print(f"Vocab size: {enc.n_vocab:,}")
```

**Output**:
```
Total tokens: 9,035,582,198
Train tokens: 9,035,582,198
Val tokens: 4,123,676
Vocab size: 50,257
```

**Time**: 1-2 hours on 8-core CPU

**Disk usage**:
- train.bin: ~18 GB (9B tokens × 2 bytes)
- val.bin: ~8 MB
- Original text: ~54 GB

### BPE Tokenization Example

```python
import tiktoken

enc = tiktoken.get_encoding("gpt2")

# Tokenize
text = "Hello world! This is a test."
tokens = enc.encode_ordinary(text)
print(tokens)
# [15496, 995, 0, 770, 318, 257, 1332, 13]

# Decode
decoded = enc.decode(tokens)
print(decoded)
# "Hello world! This is a test."

# Token → text
print([enc.decode([t]) for t in tokens])
# ['Hello', ' world', '!', ' This', ' is', ' a', ' test', '.']
```

**Subword splitting**:
```python
# Rare word "electroencephalography" is split
tokens = enc.encode_ordinary("electroencephalography")
print([enc.decode([t]) for t in tokens])
# ['elect', 'ro', 'ence', 'ph', 'al', 'ography']
```

## Data Loading

### Memory-Mapped Loading (Efficient)

```python
import numpy as np
import torch

# Load data (memory-mapped, no RAM overhead)
data_dir = 'data/shakespeare_char'
train_data = np.memmap(
    os.path.join(data_dir, 'train.bin'),
    dtype=np.uint16,
    mode='r'
)

print(f"Loaded {len(train_data):,} tokens")  # No actual read yet!

# Get batch (read on-demand)
def get_batch(split):
    data = train_data if split == 'train' else val_data

    # Random indices
    ix = torch.randint(len(data) - block_size, (batch_size,))

    # Extract sequences
    x = torch.stack([torch.from_numpy(data[i:i+block_size].astype(np.int64)) for i in ix])
    y = torch.stack([torch.from_numpy(data[i+1:i+1+block_size].astype(np.int64)) for i in ix])

    # Move to GPU
    x, y = x.to('cuda'), y.to('cuda')

    return x, y

# Usage
X, Y = get_batch('train')
# X shape: (batch_size, block_size)
# Y shape: (batch_size, block_size)
```

**Memory efficiency**:
- 9 GB dataset loaded with ~0 MB RAM
- Only batch data is loaded into memory

### Data Loader (PyTorch)

```python
from torch.utils.data import Dataset, DataLoader

class TokenDataset(Dataset):
    def __init__(self, data_path, block_size):
        self.data = np.memmap(data_path, dtype=np.uint16, mode='r')
        self.block_size = block_size

    def __len__(self):
        return len(self.data) - self.block_size

    def __getitem__(self, idx):
        x = torch.from_numpy(self.data[idx:idx+self.block_size].astype(np.int64))
        y = torch.from_numpy(self.data[idx+1:idx+1+self.block_size].astype(np.int64))
        return x, y

# Create data loader
train_dataset = TokenDataset('data/shakespeare_char/train.bin', block_size=256)
train_loader = DataLoader(
    train_dataset,
    batch_size=64,
    shuffle=True,
    num_workers=4,
    pin_memory=True
)

# Usage
for X, Y in train_loader:
    X, Y = X.to('cuda'), Y.to('cuda')
    # Train...
```

## Custom Datasets

### Wikipedia

```python
from datasets import load_dataset

# Load Wikipedia
dataset = load_dataset("wikipedia", "20220301.en", num_proc=8)

# Tokenize
enc = tiktoken.get_encoding("gpt2")

def tokenize(example):
    ids = enc.encode_ordinary(example['text'])
    return {'ids': ids, 'len': len(ids)}

tokenized = dataset.map(tokenize, num_proc=8, remove_columns=['text', 'title'])

# Save
train_ids = np.concatenate([np.array(x['ids'], dtype=np.uint16) for x in tokenized['train']])
train_ids.tofile('data/wikipedia/train.bin')
```

### Code (GitHub)

```python
from datasets import load_dataset

# Load code dataset (The Stack)
dataset = load_dataset("bigcode/the-stack", data_dir="data/python", num_proc=8)

# Tokenize (same as above)
enc = tiktoken.get_encoding("gpt2")
# ... tokenize and save
```

### Custom Text Files

```python
# Load custom text files
import glob

files = glob.glob('my_dataset/*.txt')
text = ''

for file in files:
    with open(file, 'r') as f:
        text += f.read() + '\n'

# Character-level
chars = sorted(list(set(text)))
stoi = {ch: i for i, ch in enumerate(chars)}
data = np.array([stoi[c] for c in text], dtype=np.uint16)

# Split and save
n = len(data)
train = data[:int(n*0.9)]
val = data[int(n*0.9):]

train.tofile('data/custom/train.bin')
val.tofile('data/custom/val.bin')

# Meta
with open('data/custom/meta.pkl', 'wb') as f:
    pickle.dump({'vocab_size': len(chars), 'itos': {i: ch for i, ch in enumerate(chars)}, 'stoi': stoi}, f)
```

## Data Augmentation (Advanced)

### Random Masking (BERT-style)

```python
def random_mask(tokens, mask_prob=0.15):
    """Randomly mask tokens for denoising objective."""
    mask = torch.rand(tokens.shape) < mask_prob
    tokens[mask] = mask_token_id
    return tokens

# Usage in training
X, Y = get_batch('train')
X_masked = random_mask(X.clone())
logits, loss = model(X_masked, Y)  # Predict original from masked
```

### Document Shuffling

```python
# Shuffle document order (not token order)
# Better generalization than sequential documents

import random

# Load documents
docs = dataset['train']
random.shuffle(docs)

# Concatenate shuffled
train_ids = np.concatenate([np.array(doc['ids'], dtype=np.uint16) for doc in docs])
```

## Benchmarks

| Dataset | Tokens | Vocab | Prep Time | Disk Size |
|---------|--------|-------|-----------|-----------|
| Shakespeare (char) | 1M | 65 | 1 sec | 2 MB |
| TinyStories | 250M | 50K | 5 min | 500 MB |
| OpenWebText | 9B | 50K | 90 min | 18 GB |
| The Pile | 300B | 50K | ~2 days | 600 GB |

## Resources

- Data preparation scripts: https://github.com/karpathy/nanoGPT/tree/master/data
- Tiktoken (BPE tokenizer): https://github.com/openai/tiktoken
- HuggingFace datasets: https://huggingface.co/datasets
- OpenWebText: https://huggingface.co/datasets/Skylion007/openwebtext
- The Stack (code): https://huggingface.co/datasets/bigcode/the-stack
