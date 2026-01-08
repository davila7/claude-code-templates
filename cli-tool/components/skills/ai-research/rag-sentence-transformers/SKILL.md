---
name: sentence-transformers
description: Framework for state-of-the-art sentence, text, and image embeddings. Provides 5000+ pre-trained models for semantic similarity, clustering, and retrieval. Supports multilingual, domain-specific, and multimodal models. Use for generating embeddings for RAG, semantic search, or similarity tasks. Best for production embedding generation.
version: 1.0.0
author: Orchestra Research
license: MIT
tags: [Sentence Transformers, Embeddings, Semantic Similarity, RAG, Multilingual, Multimodal, Pre-Trained Models, Clustering, Semantic Search, Production]
dependencies: [sentence-transformers, transformers, torch]
---

# Sentence Transformers - State-of-the-Art Embeddings

Python framework for sentence and text embeddings using transformers.

## When to use Sentence Transformers

**Use when:**
- Need high-quality embeddings for RAG
- Semantic similarity and search
- Text clustering and classification
- Multilingual embeddings (100+ languages)
- Running embeddings locally (no API)
- Cost-effective alternative to OpenAI embeddings

**Metrics**:
- **15,700+ GitHub stars**
- **5000+ pre-trained models**
- **100+ languages** supported
- Based on PyTorch/Transformers

**Use alternatives instead**:
- **OpenAI Embeddings**: Need API-based, highest quality
- **Instructor**: Task-specific instructions
- **Cohere Embed**: Managed service

## Quick start

### Installation

```bash
pip install sentence-transformers
```

### Basic usage

```python
from sentence_transformers import SentenceTransformer

# Load model
model = SentenceTransformer('all-MiniLM-L6-v2')

# Generate embeddings
sentences = [
    "This is an example sentence",
    "Each sentence is converted to a vector"
]

embeddings = model.encode(sentences)
print(embeddings.shape)  # (2, 384)

# Cosine similarity
from sentence_transformers.util import cos_sim
similarity = cos_sim(embeddings[0], embeddings[1])
print(f"Similarity: {similarity.item():.4f}")
```

## Popular models

### General purpose

```python
# Fast, good quality (384 dim)
model = SentenceTransformer('all-MiniLM-L6-v2')

# Better quality (768 dim)
model = SentenceTransformer('all-mpnet-base-v2')

# Best quality (1024 dim, slower)
model = SentenceTransformer('all-roberta-large-v1')
```

### Multilingual

```python
# 50+ languages
model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')

# 100+ languages
model = SentenceTransformer('paraphrase-multilingual-mpnet-base-v2')
```

### Domain-specific

```python
# Legal domain
model = SentenceTransformer('nlpaueb/legal-bert-base-uncased')

# Scientific papers
model = SentenceTransformer('allenai/specter')

# Code
model = SentenceTransformer('microsoft/codebert-base')
```

## Semantic search

```python
from sentence_transformers import SentenceTransformer, util

model = SentenceTransformer('all-MiniLM-L6-v2')

# Corpus
corpus = [
    "Python is a programming language",
    "Machine learning uses algorithms",
    "Neural networks are powerful"
]

# Encode corpus
corpus_embeddings = model.encode(corpus, convert_to_tensor=True)

# Query
query = "What is Python?"
query_embedding = model.encode(query, convert_to_tensor=True)

# Find most similar
hits = util.semantic_search(query_embedding, corpus_embeddings, top_k=3)
print(hits)
```

## Similarity computation

```python
# Cosine similarity
similarity = util.cos_sim(embedding1, embedding2)

# Dot product
similarity = util.dot_score(embedding1, embedding2)

# Pairwise cosine similarity
similarities = util.cos_sim(embeddings, embeddings)
```

## Batch encoding

```python
# Efficient batch processing
sentences = ["sentence 1", "sentence 2", ...] * 1000

embeddings = model.encode(
    sentences,
    batch_size=32,
    show_progress_bar=True,
    convert_to_tensor=False  # or True for PyTorch tensors
)
```

## Fine-tuning

```python
from sentence_transformers import InputExample, losses
from torch.utils.data import DataLoader

# Training data
train_examples = [
    InputExample(texts=['sentence 1', 'sentence 2'], label=0.8),
    InputExample(texts=['sentence 3', 'sentence 4'], label=0.3),
]

train_dataloader = DataLoader(train_examples, batch_size=16)

# Loss function
train_loss = losses.CosineSimilarityLoss(model)

# Train
model.fit(
    train_objectives=[(train_dataloader, train_loss)],
    epochs=10,
    warmup_steps=100
)

# Save
model.save('my-finetuned-model')
```

## LangChain integration

```python
from langchain_community.embeddings import HuggingFaceEmbeddings

embeddings = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-mpnet-base-v2"
)

# Use with vector stores
from langchain_chroma import Chroma

vectorstore = Chroma.from_documents(
    documents=docs,
    embedding=embeddings
)
```

## LlamaIndex integration

```python
from llama_index.embeddings.huggingface import HuggingFaceEmbedding

embed_model = HuggingFaceEmbedding(
    model_name="sentence-transformers/all-mpnet-base-v2"
)

from llama_index.core import Settings
Settings.embed_model = embed_model

# Use in index
index = VectorStoreIndex.from_documents(documents)
```

## Model selection guide

| Model | Dimensions | Speed | Quality | Use Case |
|-------|------------|-------|---------|----------|
| all-MiniLM-L6-v2 | 384 | Fast | Good | General, prototyping |
| all-mpnet-base-v2 | 768 | Medium | Better | Production RAG |
| all-roberta-large-v1 | 1024 | Slow | Best | High accuracy needed |
| paraphrase-multilingual | 768 | Medium | Good | Multilingual |

## Best practices

1. **Start with all-MiniLM-L6-v2** - Good baseline
2. **Normalize embeddings** - Better for cosine similarity
3. **Use GPU if available** - 10× faster encoding
4. **Batch encoding** - More efficient
5. **Cache embeddings** - Expensive to recompute
6. **Fine-tune for domain** - Improves quality
7. **Test different models** - Quality varies by task
8. **Monitor memory** - Large models need more RAM

## Performance

| Model | Speed (sentences/sec) | Memory | Dimension |
|-------|----------------------|---------|-----------|
| MiniLM | ~2000 | 120MB | 384 |
| MPNet | ~600 | 420MB | 768 |
| RoBERTa | ~300 | 1.3GB | 1024 |

## Resources

- **GitHub**: https://github.com/UKPLab/sentence-transformers ⭐ 15,700+
- **Models**: https://huggingface.co/sentence-transformers
- **Docs**: https://www.sbert.net
- **License**: Apache 2.0


