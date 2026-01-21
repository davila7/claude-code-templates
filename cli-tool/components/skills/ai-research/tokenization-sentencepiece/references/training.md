# SentencePiece Training Guide

Complete guide to training SentencePiece models.

## Training workflow

### Step 1: Prepare corpus

```bash
# Plain text file, one sentence per line (recommended)
cat corpus.txt
# Hello world
# This is a test
# SentencePiece is language-independent

# Or use raw text (SentencePiece handles sentence splitting)
```

### Step 2: Train model

**Command-line**:
```bash
spm_train \
  --input=corpus.txt \
  --model_prefix=m \
  --vocab_size=8000 \
  --model_type=unigram \
  --character_coverage=0.9995
```

**Python API**:
```python
import sentencepiece as spm

spm.SentencePieceTrainer.train(
    input='corpus.txt',
    model_prefix='m',
    vocab_size=8000,
    model_type='unigram'
)
```

**Output**: `m.model` (binary), `m.vocab` (text vocabulary)

### Step 3: Load and use

```python
sp = spm.SentencePieceProcessor(model_file='m.model')
pieces = sp.encode('Test sentence', out_type=str)
```

## Training parameters

### Core parameters

```python
spm.SentencePieceTrainer.train(
    # Required
    input='corpus.txt',           # Input corpus
    model_prefix='output',        # Output prefix
    vocab_size=8000,              # Target vocabulary size

    # Algorithm
    model_type='unigram',         # 'unigram', 'bpe', 'char', 'word'

    # Coverage
    character_coverage=0.9995,    # 0.9995 for most, 1.0 for CJK

    # Normalization
    normalization_rule_name='nmt_nfkc',  # 'nmt_nfkc', 'nfkc', 'identity'

    # Performance
    num_threads=16,               # Training threads
    input_sentence_size=10000000  # Max sentences to load
)
```

### Special tokens

```python
spm.SentencePieceTrainer.train(
    input='corpus.txt',
    model_prefix='m',
    vocab_size=32000,

    # Control symbols (special tokens for model control)
    control_symbols=['<s>', '</s>', '<pad>'],

    # User-defined symbols (never split)
    user_defined_symbols=['[MASK]', '[SEP]', '[CLS]'],

    # Special token pieces
    unk_piece='<unk>',
    bos_piece='<s>',
    eos_piece='</s>',
    pad_piece='<pad>',

    # Special token IDs
    unk_id=0,
    bos_id=1,
    eos_id=2,
    pad_id=3
)
```

### Advanced options

```python
spm.SentencePieceTrainer.train(
    input='corpus.txt',
    model_prefix='m',
    vocab_size=32000,

    # Byte fallback (handle unknown chars)
    byte_fallback=True,

    # Digit handling
    split_digits=True,            # Split digits individually

    # Script splitting
    split_by_unicode_script=True, # Split by Unicode script
    split_by_whitespace=True,     # Split by whitespace

    # Length constraints
    max_sentencepiece_length=16,  # Max token length

    # Rare word handling
    min_frequency=2,              # Min frequency for token

    # Training size
    input_sentence_size=10000000, # Max sentences
    shuffle_input_sentence=True,  # Shuffle training data

    # Seed
    seed_sentencepiece_size=1000000  # Seed vocab size
)
```

## Training from Python iterator

```python
import sentencepiece as spm
from datasets import load_dataset

# Load dataset
dataset = load_dataset('wikitext', 'wikitext-103-raw-v1', split='train')

# Create iterator
def corpus_iterator():
    for example in dataset:
        if example['text'].strip():
            yield example['text']

# Train from iterator
spm.SentencePieceTrainer.train(
    sentence_iterator=corpus_iterator(),
    model_prefix='wiki',
    vocab_size=32000,
    model_type='unigram'
)
```

## Model types

### BPE

```python
spm.SentencePieceTrainer.train(
    input='corpus.txt',
    model_type='bpe',
    vocab_size=16000
)
```

**Training time**: ~10-15 min for 1GB corpus

### Unigram (recommended)

```python
spm.SentencePieceTrainer.train(
    input='corpus.txt',
    model_type='unigram',
    vocab_size=8000
)
```

**Training time**: ~30-40 min for 1GB corpus

## Character coverage

### English/European (0.9995)

```python
spm.SentencePieceTrainer.train(
    input='en_corpus.txt',
    character_coverage=0.9995  # Cover 99.95% of chars
)
```

Covers: a-z, A-Z, punctuation, common accents

### CJK (1.0)

```python
spm.SentencePieceTrainer.train(
    input='zh_corpus.txt',
    character_coverage=1.0  # Cover ALL characters
)
```

Required for: Chinese, Japanese, Korean

### Multilingual (0.9995-1.0)

```python
spm.SentencePieceTrainer.train(
    input='multilingual_corpus.txt',
    character_coverage=0.9995  # Balance coverage/size
)
```

## Vocabulary size selection

| Task | Vocab Size | Rationale |
|------|------------|-----------|
| English monolingual | 16k-32k | Standard |
| Multilingual | 32k-250k | More languages |
| CJK | 32k-100k | More characters |
| Code | 16k-32k | Similar to English |

## Normalization rules

### nmt_nfkc (recommended)

```python
normalization_rule_name='nmt_nfkc'
```

- NFKC Unicode normalization
- Whitespace handling
- **Recommended for most tasks**

### identity (no normalization)

```python
normalization_rule_name='identity'
```

- Preserves input exactly
- Use for code, case-sensitive tasks

### nfkc (standard Unicode)

```python
normalization_rule_name='nfkc'
```

- Standard Unicode normalization
- Less aggressive than nmt_nfkc

## Performance optimization

### Multi-threading

```python
spm.SentencePieceTrainer.train(
    input='large_corpus.txt',
    num_threads=32  # Use all cores
)
```

**Speedup**: ~4-8× with 16+ cores

### Sampling input

```python
spm.SentencePieceTrainer.train(
    input='huge_corpus.txt',
    input_sentence_size=10000000,  # Sample 10M sentences
    shuffle_input_sentence=True
)
```

**For very large corpora** (>10GB)

### Extremely large corpus

```python
spm.SentencePieceTrainer.train(
    input='massive_corpus.txt',
    train_extremely_large_corpus=True,  # Enable for >10GB
    input_sentence_size=100000000
)
```

## Best practices

1. **Use Unigram for most tasks** - Better for multilingual
2. **Set character_coverage=1.0 for CJK** - Required for full coverage
3. **Use nmt_nfkc normalization** - Works well for most cases
4. **Add user_defined_symbols for special tokens** - BERT-style tokens
5. **Enable byte_fallback for robustness** - Handles emojis/rare chars
6. **Start with vocab_size=32000** - Good default for most tasks
7. **Use multi-threading** - Speeds up training significantly
