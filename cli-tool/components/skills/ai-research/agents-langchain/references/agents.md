# LangChain Agents Guide

Complete guide to building agents with ReAct, tool calling, and streaming.

## What are agents?

Agents combine language models with tools to solve complex tasks through reasoning and action:

1. **Reasoning**: LLM decides what to do
2. **Acting**: Execute tools based on reasoning
3. **Observation**: Receive tool results
4. **Loop**: Repeat until task complete

This is the **ReAct pattern** (Reasoning + Acting).

## Basic agent creation

```python
from langchain.agents import create_agent
from langchain_anthropic import ChatAnthropic

# Define tools
def calculator(expression: str) -> str:
    """Evaluate a math expression."""
    return str(eval(expression))

def search(query: str) -> str:
    """Search for information."""
    return f"Results for: {query}"

# Create agent
agent = create_agent(
    model=ChatAnthropic(model="claude-sonnet-4-5-20250929"),
    tools=[calculator, search],
    system_prompt="You are a helpful assistant. Use tools when needed."
)

# Run agent
result = agent.invoke({
    "messages": [{"role": "user", "content": "What is 25 * 17?"}]
})
print(result["messages"][-1].content)
```

## Agent components

### 1. Model - The reasoning engine

```python
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic

# OpenAI
model = ChatOpenAI(model="gpt-4o", temperature=0)

# Anthropic (better for complex reasoning)
model = ChatAnthropic(model="claude-sonnet-4-5-20250929", temperature=0)

# Dynamic model selection
def select_model(task_complexity: str):
    if task_complexity == "high":
        return ChatAnthropic(model="claude-sonnet-4-5-20250929")
    else:
        return ChatOpenAI(model="gpt-4o-mini")
```

### 2. Tools - Actions the agent can take

```python
from langchain.tools import tool

# Simple function tool
@tool
def get_current_time() -> str:
    """Get the current time."""
    from datetime import datetime
    return datetime.now().strftime("%H:%M:%S")

# Tool with parameters
@tool
def fetch_weather(city: str, units: str = "fahrenheit") -> str:
    """Fetch weather for a city.

    Args:
        city: City name
        units: Temperature units (fahrenheit or celsius)
    """
    # Your weather API call here
    return f"Weather in {city}: 72°{units[0].upper()}"

# Tool with error handling
@tool
def risky_api_call(endpoint: str) -> str:
    """Call an external API that might fail."""
    try:
        response = requests.get(endpoint, timeout=5)
        return response.text
    except Exception as e:
        return f"Error calling API: {str(e)}"
```

### 3. System prompt - Agent behavior

```python
# General assistant
system_prompt = "You are a helpful assistant. Use tools when needed."

# Domain expert
system_prompt = """You are a financial analyst assistant.
- Use the calculator for precise calculations
- Search for recent financial data
- Provide data-driven recommendations
- Always cite your sources"""

# Constrained agent
system_prompt = """You are a customer support agent.
- Only use search_kb tool to find answers
- If answer not found, escalate to human
- Be concise and professional
- Never make up information"""
```

## Agent types

### 1. Tool-calling agent (recommended)

Uses native function calling for best performance:

```python
from langchain.agents import create_tool_calling_agent, AgentExecutor
from langchain.prompts import ChatPromptTemplate

# Create prompt
prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful assistant"),
    ("human", "{input}"),
    ("placeholder", "{agent_scratchpad}"),
])

# Create agent
agent = create_tool_calling_agent(
    llm=model,
    tools=[calculator, search],
    prompt=prompt
)

# Wrap in executor
agent_executor = AgentExecutor(
    agent=agent,
    tools=[calculator, search],
    verbose=True,
    max_iterations=5,
    handle_parsing_errors=True
)

# Run
result = agent_executor.invoke({"input": "What is the weather in Paris?"})
```

### 2. ReAct agent (reasoning trace)

Shows step-by-step reasoning:

```python
from langchain.agents import create_react_agent

# ReAct prompt shows thought process
react_prompt = """Answer the following questions as best you can. You have access to the following tools:

{tools}

Use the following format:

Question: the input question you must answer
Thought: you should always think about what to do
Action: the action to take, should be one of [{tool_names}]
Action Input: the input to the action
Observation: the result of the action
... (this Thought/Action/Action Input/Observation can repeat N times)
Thought: I now know the final answer
Final Answer: the final answer to the original input question

Begin!

Question: {input}
Thought: {agent_scratchpad}"""

agent = create_react_agent(
    llm=model,
    tools=[calculator, search],
    prompt=ChatPromptTemplate.from_template(react_prompt)
)

# Run with visible reasoning
result = agent_executor.invoke({"input": "What is 25 * 17 + 142?"})
```

### 3. Conversational agent (with memory)

Remembers conversation history:

```python
from langchain.agents import create_conversational_retrieval_agent
from langchain.memory import ConversationBufferMemory

# Add memory
memory = ConversationBufferMemory(
    memory_key="chat_history",
    return_messages=True
)

# Conversational agent
agent_executor = AgentExecutor(
    agent=agent,
    tools=[calculator, search],
    memory=memory,
    verbose=True
)

# Multi-turn conversation
agent_executor.invoke({"input": "My name is Alice"})
agent_executor.invoke({"input": "What's my name?"})  # Remembers "Alice"
agent_executor.invoke({"input": "What is 25 * 17?"})
```

## Tool execution patterns

### Parallel tool execution

```python
# Agent automatically parallelizes independent calls
agent = create_tool_calling_agent(llm=model, tools=[get_weather, search])

# This calls get_weather("Paris") and get_weather("London") in parallel
result = agent_executor.invoke({
    "input": "Compare weather in Paris and London"
})
```

### Sequential tool chaining

```python
# Agent chains tools automatically
@tool
def search_company(name: str) -> str:
    """Search for company information."""
    return f"Company ID: 12345, Industry: Tech"

@tool
def get_stock_price(company_id: str) -> str:
    """Get stock price for a company."""
    return f"${150.00}"

# Agent will: search_company → get_stock_price
result = agent_executor.invoke({
    "input": "What is Apple's current stock price?"
})
```

### Conditional tool usage

```python
# Agent decides when to use tools
@tool
def expensive_tool(query: str) -> str:
    """Use only when necessary - costs $0.10 per call."""
    return perform_expensive_operation(query)

# Agent uses tool only if needed
result = agent_executor.invoke({
    "input": "What is 2+2?"  # Won't use expensive_tool
})
```

## Streaming

### Stream agent steps

```python
# Stream intermediate steps
for step in agent_executor.stream({"input": "Research quantum computing"}):
    if "actions" in step:
        action = step["actions"][0]
        print(f"Tool: {action.tool}, Input: {action.tool_input}")
    if "steps" in step:
        print(f"Observation: {step['steps'][0].observation}")
    if "output" in step:
        print(f"Final: {step['output']}")
```

### Stream LLM tokens

```python
from langchain.callbacks import StreamingStdOutCallbackHandler

# Stream model responses
agent_executor = AgentExecutor(
    agent=agent,
    tools=[calculator],
    callbacks=[StreamingStdOutCallbackHandler()],
    verbose=True
)

result = agent_executor.invoke({"input": "Explain quantum computing"})
```

## Error handling

### Tool error handling

```python
@tool
def fallible_tool(query: str) -> str:
    """A tool that might fail."""
    try:
        result = risky_operation(query)
        return f"Success: {result}"
    except Exception as e:
        return f"Error: {str(e)}. Please try a different approach."

# Agent adapts to errors
agent_executor = AgentExecutor(
    agent=agent,
    tools=[fallible_tool],
    handle_parsing_errors=True,  # Handle malformed tool calls
    max_iterations=5
)
```

### Timeout handling

```python
from langchain.callbacks import TimeoutCallback

# Set timeout
agent_executor = AgentExecutor(
    agent=agent,
    tools=[slow_tool],
    callbacks=[TimeoutCallback(timeout=30)],  # 30 second timeout
    max_iterations=10
)
```

### Retry logic

```python
from langchain.callbacks import RetryCallback

# Retry on failure
agent_executor = AgentExecutor(
    agent=agent,
    tools=[unreliable_tool],
    callbacks=[RetryCallback(max_retries=3)],
    max_execution_time=60
)
```

## Advanced patterns

### Dynamic tool selection

```python
# Select tools based on context
def get_tools_for_user(user_role: str):
    if user_role == "admin":
        return [search, calculator, database_query, delete_data]
    elif user_role == "analyst":
        return [search, calculator, database_query]
    else:
        return [search, calculator]

# Create agent with role-based tools
tools = get_tools_for_user(current_user.role)
agent = create_agent(model=model, tools=tools)
```

### Multi-step reasoning

```python
# Agent plans multiple steps
system_prompt = """Break down complex tasks into steps:
1. Analyze the question
2. Determine required information
3. Use tools to gather data
4. Synthesize findings
5. Provide final answer"""

agent = create_agent(
    model=model,
    tools=[search, calculator, database],
    system_prompt=system_prompt
)

result = agent.invoke({
    "input": "Compare revenue growth of top 3 tech companies over 5 years"
})
```

### Structured output from agents

```python
from langchain_core.pydantic_v1 import BaseModel, Field

class ResearchReport(BaseModel):
    summary: str = Field(description="Executive summary")
    findings: list[str] = Field(description="Key findings")
    sources: list[str] = Field(description="Source URLs")

# Agent returns structured output
structured_agent = agent.with_structured_output(ResearchReport)
report = structured_agent.invoke({"input": "Research AI safety"})
print(report.summary, report.findings)
```

## Middleware & customization

### Custom agent middleware

```python
from langchain.agents import AgentExecutor

def logging_middleware(agent_executor):
    """Log all agent actions."""
    original_invoke = agent_executor.invoke

    def wrapped_invoke(*args, **kwargs):
        print(f"Agent invoked with: {args[0]}")
        result = original_invoke(*args, **kwargs)
        print(f"Agent result: {result}")
        return result

    agent_executor.invoke = wrapped_invoke
    return agent_executor

# Apply middleware
agent_executor = logging_middleware(agent_executor)
```

### Custom stopping conditions

```python
from langchain.agents import EarlyStoppingMethod

# Stop early if confident
agent_executor = AgentExecutor(
    agent=agent,
    tools=[search],
    early_stopping_method=EarlyStoppingMethod.GENERATE,  # or FORCE
    max_iterations=10
)
```

## Best practices

1. **Use tool-calling agents** - Fastest and most reliable
2. **Keep tool descriptions clear** - Agent needs to understand when to use each tool
3. **Add error handling** - Tools will fail, handle gracefully
4. **Set max_iterations** - Prevent infinite loops (default: 15)
5. **Enable streaming** - Better UX for long tasks
6. **Use verbose=True during dev** - See agent reasoning
7. **Test tool combinations** - Ensure tools work together
8. **Monitor with LangSmith** - Essential for production
9. **Cache tool results** - Avoid redundant API calls
10. **Version system prompts** - Track changes in behavior

## Common pitfalls

1. **Vague tool descriptions** - Agent won't know when to use tool
2. **Too many tools** - Agent gets confused (limit to 5-10)
3. **Tools without error handling** - One failure crashes agent
4. **Circular tool dependencies** - Agent gets stuck in loops
5. **Missing max_iterations** - Agent runs forever
6. **Poor system prompts** - Agent doesn't follow instructions

## Debugging agents

```python
# Enable verbose logging
agent_executor = AgentExecutor(
    agent=agent,
    tools=[calculator],
    verbose=True,  # See all steps
    return_intermediate_steps=True  # Get full trace
)

result = agent_executor.invoke({"input": "Calculate 25 * 17"})

# Inspect intermediate steps
for step in result["intermediate_steps"]:
    print(f"Action: {step[0].tool}")
    print(f"Input: {step[0].tool_input}")
    print(f"Output: {step[1]}")
```

## Resources

- **ReAct Paper**: https://arxiv.org/abs/2210.03629
- **LangChain Agents Docs**: https://docs.langchain.com/oss/python/langchain/agents
- **LangSmith Debugging**: https://smith.langchain.com
