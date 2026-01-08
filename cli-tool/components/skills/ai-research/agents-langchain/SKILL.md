---
name: langchain
description: Framework for building LLM-powered applications with agents, chains, and RAG. Supports multiple providers (OpenAI, Anthropic, Google), 500+ integrations, ReAct agents, tool calling, memory management, and vector store retrieval. Use for building chatbots, question-answering systems, autonomous agents, or RAG applications. Best for rapid prototyping and production deployments.
version: 1.0.0
author: Orchestra Research
license: MIT
tags: [Agents, LangChain, RAG, Tool Calling, ReAct, Memory Management, Vector Stores, LLM Applications, Chatbots, Production]
dependencies: [langchain, langchain-core, langchain-openai, langchain-anthropic]
---

# LangChain - Build LLM Applications with Agents & RAG

The most popular framework for building LLM-powered applications.

## When to use LangChain

**Use LangChain when:**
- Building agents with tool calling and reasoning (ReAct pattern)
- Implementing RAG (retrieval-augmented generation) pipelines
- Need to swap LLM providers easily (OpenAI, Anthropic, Google)
- Creating chatbots with conversation memory
- Rapid prototyping of LLM applications
- Production deployments with LangSmith observability

**Metrics**:
- **119,000+ GitHub stars**
- **272,000+ repositories** use LangChain
- **500+ integrations** (models, vector stores, tools)
- **3,800+ contributors**

**Use alternatives instead**:
- **LlamaIndex**: RAG-focused, better for document Q&A
- **LangGraph**: Complex stateful workflows, more control
- **Haystack**: Production search pipelines
- **Semantic Kernel**: Microsoft ecosystem

## Quick start

### Installation

```bash
# Core library (Python 3.10+)
pip install -U langchain

# With OpenAI
pip install langchain-openai

# With Anthropic
pip install langchain-anthropic

# Common extras
pip install langchain-community  # 500+ integrations
pip install langchain-chroma     # Vector store
```

### Basic LLM usage

```python
from langchain_anthropic import ChatAnthropic

# Initialize model
llm = ChatAnthropic(model="claude-sonnet-4-5-20250929")

# Simple completion
response = llm.invoke("Explain quantum computing in 2 sentences")
print(response.content)
```

### Create an agent (ReAct pattern)

```python
from langchain.agents import create_agent
from langchain_anthropic import ChatAnthropic

# Define tools
def get_weather(city: str) -> str:
    """Get current weather for a city."""
    return f"It's sunny in {city}, 72°F"

def search_web(query: str) -> str:
    """Search the web for information."""
    return f"Search results for: {query}"

# Create agent (<10 lines!)
agent = create_agent(
    model=ChatAnthropic(model="claude-sonnet-4-5-20250929"),
    tools=[get_weather, search_web],
    system_prompt="You are a helpful assistant. Use tools when needed."
)

# Run agent
result = agent.invoke({"messages": [{"role": "user", "content": "What's the weather in Paris?"}]})
print(result["messages"][-1].content)
```

## Core concepts

### 1. Models - LLM abstraction

```python
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from langchain_google_genai import ChatGoogleGenerativeAI

# Swap providers easily
llm = ChatOpenAI(model="gpt-4o")
llm = ChatAnthropic(model="claude-sonnet-4-5-20250929")
llm = ChatGoogleGenerativeAI(model="gemini-2.0-flash-exp")

# Streaming
for chunk in llm.stream("Write a poem"):
    print(chunk.content, end="", flush=True)
```

### 2. Chains - Sequential operations

```python
from langchain.chains import LLMChain
from langchain.prompts import PromptTemplate

# Define prompt template
prompt = PromptTemplate(
    input_variables=["topic"],
    template="Write a 3-sentence summary about {topic}"
)

# Create chain
chain = LLMChain(llm=llm, prompt=prompt)

# Run chain
result = chain.run(topic="machine learning")
```

### 3. Agents - Tool-using reasoning

**ReAct (Reasoning + Acting) pattern:**

```python
from langchain.agents import create_tool_calling_agent, AgentExecutor
from langchain.tools import Tool

# Define custom tool
calculator = Tool(
    name="Calculator",
    func=lambda x: eval(x),
    description="Useful for math calculations. Input: valid Python expression."
)

# Create agent with tools
agent = create_tool_calling_agent(
    llm=llm,
    tools=[calculator, search_web],
    prompt="Answer questions using available tools"
)

# Create executor
agent_executor = AgentExecutor(agent=agent, tools=[calculator], verbose=True)

# Run with reasoning
result = agent_executor.invoke({"input": "What is 25 * 17 + 142?"})
```

### 4. Memory - Conversation history

```python
from langchain.memory import ConversationBufferMemory
from langchain.chains import ConversationChain

# Add memory to track conversation
memory = ConversationBufferMemory()

conversation = ConversationChain(
    llm=llm,
    memory=memory,
    verbose=True
)

# Multi-turn conversation
conversation.predict(input="Hi, I'm Alice")
conversation.predict(input="What's my name?")  # Remembers "Alice"
```

## RAG (Retrieval-Augmented Generation)

### Basic RAG pipeline

```python
from langchain_community.document_loaders import WebBaseLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from langchain_chroma import Chroma
from langchain.chains import RetrievalQA

# 1. Load documents
loader = WebBaseLoader("https://docs.python.org/3/tutorial/")
docs = loader.load()

# 2. Split into chunks
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200
)
splits = text_splitter.split_documents(docs)

# 3. Create embeddings and vector store
vectorstore = Chroma.from_documents(
    documents=splits,
    embedding=OpenAIEmbeddings()
)

# 4. Create retriever
retriever = vectorstore.as_retriever(search_kwargs={"k": 4})

# 5. Create QA chain
qa_chain = RetrievalQA.from_chain_type(
    llm=llm,
    retriever=retriever,
    return_source_documents=True
)

# 6. Query
result = qa_chain({"query": "What are Python decorators?"})
print(result["result"])
print(f"Sources: {result['source_documents']}")
```

### Conversational RAG with memory

```python
from langchain.chains import ConversationalRetrievalChain

# RAG with conversation memory
qa = ConversationalRetrievalChain.from_llm(
    llm=llm,
    retriever=retriever,
    memory=ConversationBufferMemory(
        memory_key="chat_history",
        return_messages=True
    )
)

# Multi-turn RAG
qa({"question": "What is Python used for?"})
qa({"question": "Can you elaborate on web development?"})  # Remembers context
```

## Advanced agent patterns

### Structured output

```python
from langchain_core.pydantic_v1 import BaseModel, Field

# Define schema
class WeatherReport(BaseModel):
    city: str = Field(description="City name")
    temperature: float = Field(description="Temperature in Fahrenheit")
    condition: str = Field(description="Weather condition")

# Get structured response
structured_llm = llm.with_structured_output(WeatherReport)
result = structured_llm.invoke("What's the weather in SF? It's 65F and sunny")
print(result.city, result.temperature, result.condition)
```

### Parallel tool execution

```python
from langchain.agents import create_tool_calling_agent

# Agent automatically parallelizes independent tool calls
agent = create_tool_calling_agent(
    llm=llm,
    tools=[get_weather, search_web, calculator]
)

# This will call get_weather("Paris") and get_weather("London") in parallel
result = agent.invoke({
    "messages": [{"role": "user", "content": "Compare weather in Paris and London"}]
})
```

### Streaming agent execution

```python
# Stream agent steps
for step in agent_executor.stream({"input": "Research AI trends"}):
    if "actions" in step:
        print(f"Tool: {step['actions'][0].tool}")
    if "output" in step:
        print(f"Output: {step['output']}")
```

## Common patterns

### Multi-document QA

```python
from langchain.chains.qa_with_sources import load_qa_with_sources_chain

# Load multiple documents
docs = [
    loader.load("https://docs.python.org"),
    loader.load("https://docs.numpy.org")
]

# QA with source citations
chain = load_qa_with_sources_chain(llm, chain_type="stuff")
result = chain({"input_documents": docs, "question": "How to use numpy arrays?"})
print(result["output_text"])  # Includes source citations
```

### Custom tools with error handling

```python
from langchain.tools import tool

@tool
def risky_operation(query: str) -> str:
    """Perform a risky operation that might fail."""
    try:
        # Your operation here
        result = perform_operation(query)
        return f"Success: {result}"
    except Exception as e:
        return f"Error: {str(e)}"

# Agent handles errors gracefully
agent = create_agent(model=llm, tools=[risky_operation])
```

### LangSmith observability

```python
import os

# Enable tracing
os.environ["LANGCHAIN_TRACING_V2"] = "true"
os.environ["LANGCHAIN_API_KEY"] = "your-api-key"
os.environ["LANGCHAIN_PROJECT"] = "my-project"

# All chains/agents automatically traced
agent = create_agent(model=llm, tools=[calculator])
result = agent.invoke({"input": "Calculate 123 * 456"})

# View traces at smith.langchain.com
```

## Vector stores

### Chroma (local)

```python
from langchain_chroma import Chroma

vectorstore = Chroma.from_documents(
    documents=docs,
    embedding=OpenAIEmbeddings(),
    persist_directory="./chroma_db"
)
```

### Pinecone (cloud)

```python
from langchain_pinecone import PineconeVectorStore

vectorstore = PineconeVectorStore.from_documents(
    documents=docs,
    embedding=OpenAIEmbeddings(),
    index_name="my-index"
)
```

### FAISS (similarity search)

```python
from langchain_community.vectorstores import FAISS

vectorstore = FAISS.from_documents(docs, OpenAIEmbeddings())
vectorstore.save_local("faiss_index")

# Load later
vectorstore = FAISS.load_local("faiss_index", OpenAIEmbeddings())
```

## Document loaders

```python
# Web pages
from langchain_community.document_loaders import WebBaseLoader
loader = WebBaseLoader("https://example.com")

# PDFs
from langchain_community.document_loaders import PyPDFLoader
loader = PyPDFLoader("paper.pdf")

# GitHub
from langchain_community.document_loaders import GithubFileLoader
loader = GithubFileLoader(repo="user/repo", file_filter=lambda x: x.endswith(".py"))

# CSV
from langchain_community.document_loaders import CSVLoader
loader = CSVLoader("data.csv")
```

## Text splitters

```python
# Recursive (recommended for general text)
from langchain.text_splitter import RecursiveCharacterTextSplitter
splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200,
    separators=["\n\n", "\n", " ", ""]
)

# Code-aware
from langchain.text_splitter import PythonCodeTextSplitter
splitter = PythonCodeTextSplitter(chunk_size=500)

# Semantic (by meaning)
from langchain_experimental.text_splitter import SemanticChunker
splitter = SemanticChunker(OpenAIEmbeddings())
```

## Best practices

1. **Start simple** - Use `create_agent()` for most cases
2. **Enable streaming** - Better UX for long responses
3. **Add error handling** - Tools can fail, handle gracefully
4. **Use LangSmith** - Essential for debugging agents
5. **Optimize chunk size** - 500-1000 chars for RAG
6. **Version prompts** - Track changes in production
7. **Cache embeddings** - Expensive, cache when possible
8. **Monitor costs** - Track token usage with LangSmith

## Performance benchmarks

| Operation | Latency | Notes |
|-----------|---------|-------|
| Simple LLM call | ~1-2s | Depends on provider |
| Agent with 1 tool | ~3-5s | ReAct reasoning overhead |
| RAG retrieval | ~0.5-1s | Vector search + LLM |
| Embedding 1000 docs | ~10-30s | Depends on model |

## LangChain vs LangGraph

| Feature | LangChain | LangGraph |
|---------|-----------|-----------|
| **Best for** | Quick agents, RAG | Complex workflows |
| **Abstraction level** | High | Low |
| **Code to start** | <10 lines | ~30 lines |
| **Control** | Simple | Full control |
| **Stateful workflows** | Limited | Native |
| **Cyclic graphs** | No | Yes |
| **Human-in-loop** | Basic | Advanced |

**Use LangGraph when:**
- Need stateful workflows with cycles
- Require fine-grained control
- Building multi-agent systems
- Production apps with complex logic

## References

- **[Agents Guide](references/agents.md)** - ReAct, tool calling, streaming
- **[RAG Guide](references/rag.md)** - Document loaders, retrievers, QA chains
- **[Integration Guide](references/integration.md)** - Vector stores, LangSmith, deployment

## Resources

- **GitHub**: https://github.com/langchain-ai/langchain ⭐ 119,000+
- **Docs**: https://docs.langchain.com
- **API Reference**: https://reference.langchain.com/python
- **LangSmith**: https://smith.langchain.com (observability)
- **Version**: 0.3+ (stable)
- **License**: MIT


