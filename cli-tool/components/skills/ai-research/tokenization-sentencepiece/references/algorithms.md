# Tokenization Algorithms

BPE vs Unigram comparison and subword regularization.

## BPE (Byte-Pair Encoding)

### Algorithm

1. Initialize vocabulary with characters
2. Count frequency of adjacent token pairs
3. Merge most frequent pair
4. Repeat until vocabulary size reached

### Example

**Corpus**:
```
low: 5
lower: 2
newest: 6
widest: 3
```

**Iteration 1**:
- Most frequent pair: 'e' + 's' (9 times)
- Merge → 'es'
- Vocabulary: [chars] + ['es']

**Iteration 2**:
- Most frequent: 'es' + 't' (9 times)
- Merge → 'est'
- Vocabulary: [chars] + ['es', 'est']

**Result**: `newest` → `new|est`, `widest` → `wid|est`

### Implementation

```python
import sentencepiece as spm

spm.SentencePieceTrainer.train(
    input='corpus.txt',
    model_type='bpe',
    vocab_size=16000
)
```

### Advantages

- Simple algorithm
- Fast training
- Good compression ratio

### Disadvantages

- Deterministic (no sampling)
- May split common words unexpectedly

## Unigram

### Algorithm

1. Start with large vocabulary (all substrings)
2. Compute probability of each token
3. Remove tokens with minimal loss impact
4. Repeat until vocabulary size reached

### Probabilistic tokenization

Given vocabulary with probabilities:
```
P('low') = 0.02
P('est') = 0.03
P('l') = 0.01
P('o') = 0.015
...
```

Tokenize "lowest":
```
Option 1: ['low', 'est']
P = 0.02 × 0.03 = 0.0006  ← highest

Option 2: ['l', 'o', 'w', 'est']
P = 0.01 × 0.015 × 0.01 × 0.03 = 0.000000045

Choose option 1 (highest probability)
```

### Implementation

```python
spm.SentencePieceTrainer.train(
    input='corpus.txt',
    model_type='unigram',
    vocab_size=8000
)
```

### Advantages

- Probabilistic (can sample)
- Better for morphologically rich languages
- Supports subword regularization

### Disadvantages

- Slower training
- More complex algorithm

## Comparison

| Feature | BPE | Unigram |
|---------|-----|---------|
| Training speed | Fast | Slow |
| Tokenization | Deterministic | Probabilistic |
| Sampling | No | Yes |
| Typical vocab size | 16k-32k | 8k-32k |
| Used by | mBART | T5, ALBERT, XLNet |

## Subword regularization

Sample different tokenizations during training for robustness.

### Enable sampling

```python
sp = spm.SentencePieceProcessor(model_file='m.model')

# Sample different tokenizations
for _ in range(5):
    pieces = sp.encode('tokenization', out_type=str, enable_sampling=True, alpha=0.1)
    print(pieces)

# Output (different each time):
# ['▁token', 'ization']
# ['▁tok', 'en', 'ization']
# ['▁token', 'iz', 'ation']
# ['▁to', 'ken', 'ization']
# ['▁token', 'ization']
```

### Parameters

- `alpha`: Regularization strength
  - 0.0 = deterministic (no sampling)
  - 0.1 = slight variation
  - 0.5 = high variation
  - 1.0 = maximum variation

### Benefits

1. **Robustness**: Model learns multiple tokenizations
2. **Data augmentation**: More diverse training data
3. **Better generalization**: Less overfitting to specific tokenization

### Use case

```python
# Training loop with regularization
for batch in dataloader:
    # Sample different tokenizations each epoch
    tokens = sp.encode(batch['text'], enable_sampling=True, alpha=0.1)
    # Train model...
```

**Used by**: mT5, XLM-RoBERTa

## NBest encoding

Get multiple tokenization candidates with scores.

```python
sp = spm.SentencePieceProcessor(model_file='m.model')

# Get top-5 tokenizations
nbest = sp.nbest_encode('tokenization', nbest_size=5, out_type=str)

for pieces, score in nbest:
    print(f"{pieces} (log prob: {score:.4f})")

# Output:
# ['▁token', 'ization'] (log prob: -2.34)
# ['▁tok', 'en', 'ization'] (log prob: -2.41)
# ['▁token', 'iz', 'ation'] (log prob: -2.57)
```

### Use cases

1. **Ensemble tokenization**: Average over multiple tokenizations
2. **Uncertainty estimation**: Check variance in scores
3. **Debugging**: Understand tokenizer behavior

## Best practices

1. **Use Unigram for multilingual** - Better for diverse languages
2. **Use BPE for speed** - Faster training and inference
3. **Enable subword regularization** - Improves model robustness
4. **Set alpha=0.1 for slight variation** - Good balance
5. **Use deterministic mode for inference** - Consistent results
