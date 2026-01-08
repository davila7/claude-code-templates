# LangChain Integration Guide

Integration with vector stores, LangSmith observability, and deployment.

## Vector store integrations

### Chroma (local, open-source)

```python
from langchain_chroma import Chroma
from langchain_openai import OpenAIEmbeddings

# Create vector store
vectorstore = Chroma.from_documents(
    documents=docs,
    embedding=OpenAIEmbeddings(),
    persist_directory="./chroma_db"
)

# Load existing store
vectorstore = Chroma(
    persist_directory="./chroma_db",
    embedding_function=OpenAIEmbeddings()
)

# Add documents incrementally
vectorstore.add_documents([new_doc1, new_doc2])

# Delete documents
vectorstore.delete(ids=["doc1", "doc2"])
```

### Pinecone (cloud, scalable)

```python
from langchain_pinecone import PineconeVectorStore
import pinecone

# Initialize Pinecone
pinecone.init(api_key="your-api-key", environment="us-west1-gcp")

# Create index (one-time)
pinecone.create_index("my-index", dimension=1536, metric="cosine")

# Create vector store
vectorstore = PineconeVectorStore.from_documents(
    documents=docs,
    embedding=OpenAIEmbeddings(),
    index_name="my-index"
)

# Query with metadata filters
results = vectorstore.similarity_search(
    "Python tutorials",
    k=4,
    filter={"category": "beginner"}
)
```

### FAISS (fast similarity search)

```python
from langchain_community.vectorstores import FAISS

# Create FAISS index
vectorstore = FAISS.from_documents(docs, OpenAIEmbeddings())

# Save to disk
vectorstore.save_local("./faiss_index")

# Load from disk
vectorstore = FAISS.load_local(
    "./faiss_index",
    OpenAIEmbeddings(),
    allow_dangerous_deserialization=True
)

# Merge multiple indices
vectorstore1 = FAISS.load_local("./index1", embeddings)
vectorstore2 = FAISS.load_local("./index2", embeddings)
vectorstore1.merge_from(vectorstore2)
```

### Weaviate (production, ML-native)

```python
from langchain_weaviate import WeaviateVectorStore
import weaviate

# Connect to Weaviate
client = weaviate.Client("http://localhost:8080")

# Create vector store
vectorstore = WeaviateVectorStore.from_documents(
    documents=docs,
    embedding=OpenAIEmbeddings(),
    client=client,
    index_name="LangChain"
)

# Hybrid search (vector + keyword)
results = vectorstore.similarity_search(
    "Python async",
    k=4,
    alpha=0.5  # 0=keyword, 1=vector, 0.5=hybrid
)
```

### Qdrant (fast, open-source)

```python
from langchain_qdrant import QdrantVectorStore
from qdrant_client import QdrantClient

# Connect to Qdrant
client = QdrantClient(host="localhost", port=6333)

# Create vector store
vectorstore = QdrantVectorStore.from_documents(
    documents=docs,
    embedding=OpenAIEmbeddings(),
    collection_name="my_documents",
    client=client
)
```

## LangSmith observability

### Enable tracing

```python
import os

# Set environment variables
os.environ["LANGCHAIN_TRACING_V2"] = "true"
os.environ["LANGCHAIN_API_KEY"] = "your-langsmith-api-key"
os.environ["LANGCHAIN_PROJECT"] = "my-project"

# All chains/agents automatically traced
from langchain.agents import create_agent
from langchain_anthropic import ChatAnthropic

agent = create_agent(
    model=ChatAnthropic(model="claude-sonnet-4-5-20250929"),
    tools=[calculator, search]
)

# Run - automatically logged to LangSmith
result = agent.invoke({"input": "What is 25 * 17?"})

# View traces at https://smith.langchain.com
```

### Custom metadata

```python
from langchain.callbacks import tracing_v2_enabled

# Add custom metadata to traces
with tracing_v2_enabled(
    project_name="my-project",
    tags=["production", "customer-support"],
    metadata={"user_id": "12345", "session_id": "abc"}
):
    result = agent.invoke({"input": "Help me with Python"})
```

### Evaluate runs

```python
from langsmith import Client

client = Client()

# Create dataset
dataset = client.create_dataset("qa-eval")
client.create_example(
    dataset_id=dataset.id,
    inputs={"question": "What is Python?"},
    outputs={"answer": "Python is a programming language"}
)

# Evaluate
from langchain.evaluation import load_evaluator

evaluator = load_evaluator("qa")
results = client.evaluate(
    lambda x: qa_chain(x),
    data=dataset,
    evaluators=[evaluator]
)
```

## Deployment patterns

### FastAPI server

```python
from fastapi import FastAPI
from pydantic import BaseModel
from langchain.agents import create_agent

app = FastAPI()

# Initialize agent once
agent = create_agent(
    model=llm,
    tools=[search, calculator]
)

class Query(BaseModel):
    input: str

@app.post("/chat")
async def chat(query: Query):
    result = agent.invoke({"input": query.input})
    return {"response": result["output"]}

# Run: uvicorn main:app --reload
```

### Streaming responses

```python
from fastapi.responses import StreamingResponse
from langchain.callbacks import AsyncIteratorCallbackHandler

@app.post("/chat/stream")
async def chat_stream(query: Query):
    callback = AsyncIteratorCallbackHandler()

    async def generate():
        async for token in agent.astream({"input": query.input}):
            if "output" in token:
                yield token["output"]

    return StreamingResponse(generate(), media_type="text/plain")
```

### Docker deployment

```dockerfile
# Dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```bash
# Build and run
docker build -t langchain-app .
docker run -p 8000:8000 \
  -e OPENAI_API_KEY=your-key \
  -e LANGCHAIN_API_KEY=your-key \
  langchain-app
```

### Kubernetes deployment

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: langchain-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: langchain
  template:
    metadata:
      labels:
        app: langchain
    spec:
      containers:
      - name: langchain
        image: your-registry/langchain-app:latest
        ports:
        - containerPort: 8000
        env:
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: langchain-secrets
              key: openai-api-key
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
```

## Model integrations

### OpenAI

```python
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    model="gpt-4o",
    temperature=0,
    max_tokens=1000,
    timeout=30,
    max_retries=2
)
```

### Anthropic

```python
from langchain_anthropic import ChatAnthropic

llm = ChatAnthropic(
    model="claude-sonnet-4-5-20250929",
    temperature=0,
    max_tokens=4096,
    timeout=60
)
```

### Google

```python
from langchain_google_genai import ChatGoogleGenerativeAI

llm = ChatGoogleGenerativeAI(
    model="gemini-2.0-flash-exp",
    temperature=0
)
```

### Local models (Ollama)

```python
from langchain_community.llms import Ollama

llm = Ollama(
    model="llama3",
    base_url="http://localhost:11434"
)
```

### Azure OpenAI

```python
from langchain_openai import AzureChatOpenAI

llm = AzureChatOpenAI(
    azure_endpoint="https://your-endpoint.openai.azure.com/",
    azure_deployment="gpt-4",
    api_version="2024-02-15-preview"
)
```

## Tool integrations

### Web search

```python
from langchain_community.tools import DuckDuckGoSearchRun, TavilySearchResults

# DuckDuckGo (free)
search = DuckDuckGoSearchRun()

# Tavily (best quality)
search = TavilySearchResults(api_key="your-key")
```

### Wikipedia

```python
from langchain_community.tools import WikipediaQueryRun
from langchain_community.utilities import WikipediaAPIWrapper

wikipedia = WikipediaQueryRun(api_wrapper=WikipediaAPIWrapper())
```

### Python REPL

```python
from langchain_experimental.tools import PythonREPLTool

python_repl = PythonREPLTool()

# Agent can execute Python code
agent = create_agent(model=llm, tools=[python_repl])
result = agent.invoke({"input": "Calculate the 10th Fibonacci number"})
```

### Shell commands

```python
from langchain_community.tools import ShellTool

shell = ShellTool()

# Agent can run shell commands
agent = create_agent(model=llm, tools=[shell])
```

### SQL databases

```python
from langchain_community.utilities import SQLDatabase
from langchain_community.agent_toolkits import create_sql_agent

db = SQLDatabase.from_uri("sqlite:///mydatabase.db")

agent = create_sql_agent(
    llm=llm,
    db=db,
    agent_type="openai-tools",
    verbose=True
)

result = agent.run("How many users are in the database?")
```

## Memory integrations

### Redis

```python
from langchain.memory import RedisChatMessageHistory
from langchain.memory import ConversationBufferMemory

# Redis-backed memory
message_history = RedisChatMessageHistory(
    url="redis://localhost:6379",
    session_id="user-123"
)

memory = ConversationBufferMemory(
    chat_memory=message_history,
    return_messages=True
)
```

### PostgreSQL

```python
from langchain_postgres import PostgresChatMessageHistory

message_history = PostgresChatMessageHistory(
    connection_string="postgresql://user:pass@localhost/db",
    session_id="user-123"
)
```

### MongoDB

```python
from langchain_mongodb import MongoDBChatMessageHistory

message_history = MongoDBChatMessageHistory(
    connection_string="mongodb://localhost:27017/",
    session_id="user-123"
)
```

## Caching

### In-memory cache

```python
from langchain.cache import InMemoryCache
from langchain.globals import set_llm_cache

set_llm_cache(InMemoryCache())

# Same query uses cache
response1 = llm.invoke("What is Python?")  # API call
response2 = llm.invoke("What is Python?")  # Cached
```

### SQLite cache

```python
from langchain.cache import SQLiteCache

set_llm_cache(SQLiteCache(database_path=".langchain.db"))
```

### Redis cache

```python
from langchain.cache import RedisCache
from redis import Redis

set_llm_cache(RedisCache(redis_=Redis(host="localhost", port=6379)))
```

## Monitoring & logging

### Custom callbacks

```python
from langchain.callbacks.base import BaseCallbackHandler

class CustomCallback(BaseCallbackHandler):
    def on_llm_start(self, serialized, prompts, **kwargs):
        print(f"LLM started with prompts: {prompts}")

    def on_llm_end(self, response, **kwargs):
        print(f"LLM finished with: {response}")

    def on_tool_start(self, serialized, input_str, **kwargs):
        print(f"Tool {serialized['name']} started with: {input_str}")

    def on_tool_end(self, output, **kwargs):
        print(f"Tool finished with: {output}")

# Use callback
agent = create_agent(
    model=llm,
    tools=[calculator],
    callbacks=[CustomCallback()]
)
```

### Token counting

```python
from langchain.callbacks import get_openai_callback

with get_openai_callback() as cb:
    result = llm.invoke("Write a long story")
    print(f"Tokens used: {cb.total_tokens}")
    print(f"Cost: ${cb.total_cost:.4f}")
```

## Best practices

1. **Use LangSmith in production** - Essential for debugging
2. **Cache aggressively** - LLM calls are expensive
3. **Set timeouts** - Prevent hanging requests
4. **Add retries** - Handle transient failures
5. **Monitor costs** - Track token usage
6. **Version your prompts** - Track changes
7. **Use async** - Better performance for I/O
8. **Persistent memory** - Don't lose conversation history
9. **Secure API keys** - Use environment variables
10. **Test integrations** - Verify connections before production

## Resources

- **LangSmith**: https://smith.langchain.com
- **Vector Stores**: https://python.langchain.com/docs/integrations/vectorstores
- **Model Providers**: https://python.langchain.com/docs/integrations/llms
- **Tools**: https://python.langchain.com/docs/integrations/tools
- **Deployment Guide**: https://docs.langchain.com/deploy
