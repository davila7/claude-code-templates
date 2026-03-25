# Sentence Transformers Models Guide

Guide to selecting and using sentence-transformers models.

## Top recommended models

### General purpose

**all-MiniLM-L6-v2** (Default recommendation)
- Dimensions: 384
- Speed: ~2000 sentences/sec
- Quality: Good
- Use: Prototyping, general tasks

**all-mpnet-base-v2** (Best quality)
- Dimensions: 768
- Speed: ~600 sentences/sec
- Quality: Better
- Use: Production RAG

**all-roberta-large-v1** (Highest quality)
- Dimensions: 1024
- Speed: ~300 sentences/sec
- Quality: Best
- Use: When accuracy critical

### Multilingual (50+ languages)

**paraphrase-multilingual-MiniLM-L12-v2**
- Languages: 50+
- Dimensions: 384
- Speed: Fast
- Use: Multilingual semantic search

**paraphrase-multilingual-mpnet-base-v2**
- Languages: 50+
- Dimensions: 768
- Speed: Medium
- Use: Better multilingual quality

**LaBSE** (109 languages)
- Languages: 109
- Dimensions: 768
- Speed: Medium
- Use: Maximum language coverage

### Domain-specific

**allenai/specter** (Scientific papers)
- Domain: Academic papers
- Use: Paper similarity, citations

**nlpaueb/legal-bert-base-uncased** (Legal)
- Domain: Legal documents
- Use: Legal document analysis

**microsoft/codebert-base** (Code)
- Domain: Source code
- Use: Code similarity, search

## Model selection matrix

| Task | Model | Dimensions | Speed | Quality |
|------|-------|------------|-------|---------|
| Quick prototyping | MiniLM-L6 | 384 | Fast | Good |
| Production RAG | mpnet-base | 768 | Medium | Better |
| Highest accuracy | roberta-large | 1024 | Slow | Best |
| Multilingual | paraphrase-multi-mpnet | 768 | Medium | Good |
| Scientific papers | specter | 768 | Medium | Domain |
| Legal docs | legal-bert | 768 | Medium | Domain |

## Performance benchmarks

### Speed comparison (CPU)

| Model | Sentences/sec | Memory |
|-------|---------------|--------|
| MiniLM-L6 | 2000 | 120 MB |
| MPNet-base | 600 | 420 MB |
| RoBERTa-large | 300 | 1.3 GB |

### Quality comparison (STS Benchmark)

| Model | Cosine Similarity | Spearman |
|-------|-------------------|----------|
| MiniLM-L6 | 82.4 | - |
| MPNet-base | 84.1 | - |
| RoBERTa-large | 85.4 | - |

## Usage examples

### Load and use model

```python
from sentence_transformers import SentenceTransformer

# Load model
model = SentenceTransformer('all-mpnet-base-v2')

# Generate embeddings
sentences = ["This is a sentence", "This is another sentence"]
embeddings = model.encode(sentences)
```

### Compare different models

```python
models = {
    'MiniLM': 'all-MiniLM-L6-v2',
    'MPNet': 'all-mpnet-base-v2',
    'RoBERTa': 'all-roberta-large-v1'
}

for name, model_name in models.items():
    model = SentenceTransformer(model_name)
    embeddings = model.encode(["Test sentence"])
    print(f"{name}: {embeddings.shape}")
```

## Resources

- **Models**: https://huggingface.co/sentence-transformers
- **Docs**: https://www.sbert.net/docs/pretrained_models.html
