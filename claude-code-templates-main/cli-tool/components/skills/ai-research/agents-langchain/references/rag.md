# LangChain RAG Guide

Complete guide to Retrieval-Augmented Generation with LangChain.

## What is RAG?

**RAG (Retrieval-Augmented Generation)** combines:
1. **Retrieval**: Find relevant documents from knowledge base
2. **Generation**: LLM generates answer using retrieved context

**Benefits**:
- Reduce hallucinations
- Up-to-date information
- Domain-specific knowledge
- Source citations

## RAG pipeline components

### 1. Document loading

```python
from langchain_community.document_loaders import (
    WebBaseLoader,
    PyPDFLoader,
    TextLoader,
    DirectoryLoader,
    CSVLoader,
    UnstructuredMarkdownLoader
)

# Web pages
loader = WebBaseLoader("https://docs.python.org/3/tutorial/")
docs = loader.load()

# PDF files
loader = PyPDFLoader("paper.pdf")
docs = loader.load()

# Multiple PDFs
loader = DirectoryLoader("./papers/", glob="**/*.pdf", loader_cls=PyPDFLoader)
docs = loader.load()

# Text files
loader = TextLoader("data.txt")
docs = loader.load()

# CSV
loader = CSVLoader("data.csv")
docs = loader.load()

# Markdown
loader = UnstructuredMarkdownLoader("README.md")
docs = loader.load()
```

### 2. Text splitting

```python
from langchain.text_splitter import (
    RecursiveCharacterTextSplitter,
    CharacterTextSplitter,
    TokenTextSplitter
)

# Recommended: Recursive (tries multiple separators)
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,        # Characters per chunk
    chunk_overlap=200,      # Overlap between chunks
    length_function=len,
    separators=["\n\n", "\n", " ", ""]
)

splits = text_splitter.split_documents(docs)

# Token-based (for precise token limits)
text_splitter = TokenTextSplitter(
    chunk_size=512,         # Tokens per chunk
    chunk_overlap=50
)

# Character-based (simple)
text_splitter = CharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200,
    separator="\n\n"
)
```

**Chunk size recommendations**:
- **Short answers**: 256-512 tokens
- **General Q&A**: 512-1024 tokens (recommended)
- **Long context**: 1024-2048 tokens
- **Overlap**: 10-20% of chunk_size

### 3. Embeddings

```python
from langchain_openai import OpenAIEmbeddings
from langchain_community.embeddings import (
    HuggingFaceEmbeddings,
    CohereEmbeddings
)

# OpenAI (fast, high quality)
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

# HuggingFace (free, local)
embeddings = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-mpnet-base-v2"
)

# Cohere
embeddings = CohereEmbeddings(model="embed-english-v3.0")
```

### 4. Vector stores

```python
from langchain_chroma import Chroma
from langchain_community.vectorstores import FAISS
from langchain_pinecone import PineconeVectorStore

# Chroma (local, persistent)
vectorstore = Chroma.from_documents(
    documents=splits,
    embedding=embeddings,
    persist_directory="./chroma_db"
)

# FAISS (fast similarity search)
vectorstore = FAISS.from_documents(splits, embeddings)
vectorstore.save_local("./faiss_index")

# Pinecone (cloud, scalable)
vectorstore = PineconeVectorStore.from_documents(
    documents=splits,
    embedding=embeddings,
    index_name="my-index"
)
```

### 5. Retrieval

```python
# Basic retriever (top-k similarity)
retriever = vectorstore.as_retriever(
    search_type="similarity",
    search_kwargs={"k": 4}  # Return top 4 documents
)

# MMR (Maximal Marginal Relevance) - diverse results
retriever = vectorstore.as_retriever(
    search_type="mmr",
    search_kwargs={
        "k": 4,
        "fetch_k": 20,      # Fetch 20, return diverse 4
        "lambda_mult": 0.5  # Diversity (0=diverse, 1=similar)
    }
)

# Similarity score threshold
retriever = vectorstore.as_retriever(
    search_type="similarity_score_threshold",
    search_kwargs={
        "score_threshold": 0.5  # Minimum similarity score
    }
)

# Query documents directly
docs = retriever.get_relevant_documents("What is Python?")
```

### 6. QA chain

```python
from langchain.chains import RetrievalQA
from langchain_anthropic import ChatAnthropic

llm = ChatAnthropic(model="claude-sonnet-4-5-20250929")

# Basic QA chain
qa_chain = RetrievalQA.from_chain_type(
    llm=llm,
    retriever=retriever,
    return_source_documents=True
)

# Query
result = qa_chain({"query": "What are Python decorators?"})
print(result["result"])
print(f"Sources: {len(result['source_documents'])}")
```

## Advanced RAG patterns

### Conversational RAG

```python
from langchain.chains import ConversationalRetrievalChain
from langchain.memory import ConversationBufferMemory

# Add memory
memory = ConversationBufferMemory(
    memory_key="chat_history",
    return_messages=True,
    output_key="answer"
)

# Conversational RAG chain
qa = ConversationalRetrievalChain.from_llm(
    llm=llm,
    retriever=retriever,
    memory=memory,
    return_source_documents=True
)

# Multi-turn conversation
result1 = qa({"question": "What is Python used for?"})
result2 = qa({"question": "Can you give examples?"})  # Remembers context
result3 = qa({"question": "What about web development?"})
```

### Custom prompt template

```python
from langchain.prompts import PromptTemplate

# Custom QA prompt
template = """Use the following pieces of context to answer the question.
If you don't know the answer, say so - don't make it up.
Always cite your sources using [Source N] notation.

Context: {context}

Question: {question}

Helpful Answer:"""

prompt = PromptTemplate(
    template=template,
    input_variables=["context", "question"]
)

qa_chain = RetrievalQA.from_chain_type(
    llm=llm,
    retriever=retriever,
    chain_type_kwargs={"prompt": prompt}
)
```

### Chain types

```python
# 1. Stuff (default) - Put all docs in context
qa_chain = RetrievalQA.from_chain_type(
    llm=llm,
    retriever=retriever,
    chain_type="stuff"  # Fast, works if docs fit in context
)

# 2. Map-reduce - Summarize each doc, then combine
qa_chain = RetrievalQA.from_chain_type(
    llm=llm,
    retriever=retriever,
    chain_type="map_reduce"  # For many documents
)

# 3. Refine - Iteratively refine answer
qa_chain = RetrievalQA.from_chain_type(
    llm=llm,
    retriever=retriever,
    chain_type="refine"  # Most thorough, slowest
)

# 4. Map-rerank - Score answers, return best
qa_chain = RetrievalQA.from_chain_type(
    llm=llm,
    retriever=retriever,
    chain_type="map_rerank"  # Good for multiple perspectives
)
```

### Multi-query retrieval

```python
from langchain.retrievers import MultiQueryRetriever

# Generate multiple queries for better recall
retriever = MultiQueryRetriever.from_llm(
    retriever=vectorstore.as_retriever(),
    llm=llm
)

# "What is Python?" becomes:
# - "What is Python programming language?"
# - "Python language definition"
# - "Overview of Python"
docs = retriever.get_relevant_documents("What is Python?")
```

### Contextual compression

```python
from langchain.retrievers import ContextualCompressionRetriever
from langchain.retrievers.document_compressors import LLMChainExtractor

# Compress retrieved docs to relevant parts only
compressor = LLMChainExtractor.from_llm(llm)

compression_retriever = ContextualCompressionRetriever(
    base_compressor=compressor,
    base_retriever=vectorstore.as_retriever()
)

# Returns only relevant excerpts
compressed_docs = compression_retriever.get_relevant_documents("Python decorators")
```

### Ensemble retrieval (hybrid search)

```python
from langchain.retrievers import EnsembleRetriever
from langchain.retrievers import BM25Retriever

# Vector search (semantic)
vector_retriever = vectorstore.as_retriever(search_kwargs={"k": 5})

# Keyword search (BM25)
keyword_retriever = BM25Retriever.from_documents(splits)
keyword_retriever.k = 5

# Combine both
ensemble_retriever = EnsembleRetriever(
    retrievers=[vector_retriever, keyword_retriever],
    weights=[0.5, 0.5]  # Equal weight
)

docs = ensemble_retriever.get_relevant_documents("Python async")
```

## RAG with agents

### Agent-based RAG

```python
from langchain.agents import create_tool_calling_agent
from langchain.tools.retriever import create_retriever_tool

# Create retriever tool
retriever_tool = create_retriever_tool(
    retriever=retriever,
    name="python_docs",
    description="Searches Python documentation for answers about Python programming"
)

# Create agent with retriever tool
agent = create_tool_calling_agent(
    llm=llm,
    tools=[retriever_tool, calculator, search],
    system_prompt="Use python_docs tool for Python questions"
)

# Agent decides when to retrieve
from langchain.agents import AgentExecutor
agent_executor = AgentExecutor(agent=agent, tools=[retriever_tool])

result = agent_executor.invoke({"input": "What are Python generators?"})
```

### Multi-document agents

```python
# Multiple knowledge bases
python_retriever = create_retriever_tool(
    retriever=python_vectorstore.as_retriever(),
    name="python_docs",
    description="Python programming documentation"
)

numpy_retriever = create_retriever_tool(
    retriever=numpy_vectorstore.as_retriever(),
    name="numpy_docs",
    description="NumPy library documentation"
)

# Agent chooses which knowledge base to query
agent = create_agent(
    model=llm,
    tools=[python_retriever, numpy_retriever, search]
)

result = agent.invoke({"input": "How do I create numpy arrays?"})
```

## Metadata filtering

### Add metadata to documents

```python
from langchain.schema import Document

# Documents with metadata
docs = [
    Document(
        page_content="Python is a programming language",
        metadata={"source": "tutorial.pdf", "page": 1, "category": "intro"}
    ),
    Document(
        page_content="Python decorators modify functions",
        metadata={"source": "advanced.pdf", "page": 42, "category": "advanced"}
    )
]

vectorstore = Chroma.from_documents(docs, embeddings)
```

### Filter by metadata

```python
# Retrieve only from specific source
retriever = vectorstore.as_retriever(
    search_kwargs={
        "k": 4,
        "filter": {"category": "intro"}  # Only intro documents
    }
)

# Multiple filters
retriever = vectorstore.as_retriever(
    search_kwargs={
        "k": 4,
        "filter": {
            "category": "advanced",
            "source": "advanced.pdf"
        }
    }
)
```

## Document preprocessing

### Clean documents

```python
def preprocess_doc(doc):
    """Clean and normalize document."""
    # Remove extra whitespace
    doc.page_content = " ".join(doc.page_content.split())

    # Remove special characters
    doc.page_content = re.sub(r'[^\w\s]', '', doc.page_content)

    # Lowercase (optional)
    doc.page_content = doc.page_content.lower()

    return doc

# Apply preprocessing
clean_docs = [preprocess_doc(doc) for doc in docs]
```

### Extract structured data

```python
from langchain.document_transformers import Html2TextTransformer

# HTML to clean text
transformer = Html2TextTransformer()
clean_docs = transformer.transform_documents(html_docs)

# Extract tables
from langchain.document_loaders import UnstructuredHTMLLoader

loader = UnstructuredHTMLLoader("data.html")
docs = loader.load()  # Extracts tables as structured data
```

## Evaluation & monitoring

### Evaluate retrieval quality

```python
from langchain.evaluation import load_evaluator

# Relevance evaluator
evaluator = load_evaluator("relevance", llm=llm)

# Test retrieval
query = "What are Python decorators?"
retrieved_docs = retriever.get_relevant_documents(query)

for doc in retrieved_docs:
    result = evaluator.evaluate_strings(
        input=query,
        prediction=doc.page_content
    )
    print(f"Relevance score: {result['score']}")
```

### Track sources

```python
# Always return sources
qa_chain = RetrievalQA.from_chain_type(
    llm=llm,
    retriever=retriever,
    return_source_documents=True
)

result = qa_chain({"query": "What is Python?"})

# Show sources to user
print(result["result"])
print("\nSources:")
for i, doc in enumerate(result["source_documents"]):
    print(f"[{i+1}] {doc.metadata.get('source', 'Unknown')}")
    print(f"    {doc.page_content[:100]}...")
```

## Best practices

1. **Chunk size matters** - 512-1024 tokens is usually optimal
2. **Add overlap** - 10-20% overlap prevents context loss
3. **Use metadata** - Track sources for citations
4. **Test retrieval quality** - Evaluate before using in production
5. **Hybrid search** - Combine vector + keyword for best results
6. **Compress context** - Remove irrelevant parts before LLM
7. **Cache embeddings** - Expensive, cache when possible
8. **Version your index** - Track changes to knowledge base
9. **Monitor failures** - Log when retrieval doesn't find answers
10. **Update regularly** - Keep knowledge base current

## Common pitfalls

1. **Chunks too large** - Won't fit in context
2. **No overlap** - Important context lost at boundaries
3. **No metadata** - Can't cite sources
4. **Poor splitting** - Breaks mid-sentence or mid-paragraph
5. **Wrong embedding model** - Domain mismatch hurts retrieval
6. **No reranking** - Lower quality results
7. **Ignoring failures** - No handling when retrieval fails

## Performance optimization

### Caching

```python
from langchain.cache import InMemoryCache, SQLiteCache
from langchain.globals import set_llm_cache

# In-memory cache
set_llm_cache(InMemoryCache())

# Persistent cache
set_llm_cache(SQLiteCache(database_path=".langchain.db"))

# Same query uses cache (faster + cheaper)
result1 = qa_chain({"query": "What is Python?"})
result2 = qa_chain({"query": "What is Python?"})  # Cached
```

### Batch processing

```python
# Process multiple queries efficiently
queries = [
    "What is Python?",
    "What are decorators?",
    "How do I use async?"
]

# Batch retrieval
all_docs = vectorstore.similarity_search_batch(queries)

# Batch QA
results = qa_chain.batch([{"query": q} for q in queries])
```

### Async operations

```python
# Async RAG for concurrent queries
import asyncio

async def async_qa(query):
    return await qa_chain.ainvoke({"query": query})

# Run multiple queries concurrently
results = await asyncio.gather(
    async_qa("What is Python?"),
    async_qa("What are decorators?")
)
```

## Resources

- **LangChain RAG Docs**: https://docs.langchain.com/oss/python/langchain/rag
- **Vector Stores**: https://python.langchain.com/docs/integrations/vectorstores
- **Document Loaders**: https://python.langchain.com/docs/integrations/document_loaders
- **Retrievers**: https://python.langchain.com/docs/modules/data_connection/retrievers
