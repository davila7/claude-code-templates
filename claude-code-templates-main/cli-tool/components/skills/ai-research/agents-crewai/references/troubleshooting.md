# CrewAI Troubleshooting Guide

## Installation Issues

### Missing Dependencies

**Error**: `ModuleNotFoundError: No module named 'crewai_tools'`

**Fix**:
```bash
pip install 'crewai[tools]'
```

### Python Version

**Error**: `Python version not supported`

**Fix**: CrewAI requires Python 3.10-3.13:
```bash
python --version  # Check current version

# Use pyenv to switch
pyenv install 3.11
pyenv local 3.11
```

### UV Package Manager

**Error**: Poetry-related errors

**Fix**: CrewAI migrated from Poetry to UV:
```bash
crewai update

# Or manually install UV
pip install uv
```

## Agent Issues

### Agent Stuck in Loop

**Problem**: Agent keeps iterating without completing.

**Solutions**:

1. **Set max iterations**:
```python
agent = Agent(
    role="...",
    max_iter=10,  # Limit iterations
    max_rpm=5     # Rate limit
)
```

2. **Clearer task description**:
```python
task = Task(
    description="Research AI trends. Return EXACTLY 5 bullet points.",
    expected_output="A list of 5 bullet points, nothing more."
)
```

3. **Enable verbose to debug**:
```python
agent = Agent(role="...", verbose=True)
```

### Agent Not Using Tools

**Problem**: Agent ignores available tools.

**Solutions**:

1. **Better tool descriptions**:
```python
class MyTool(BaseTool):
    name: str = "Calculator"
    description: str = "Use this to perform mathematical calculations. Input: math expression like '2+2'"
```

2. **Include tool in goal/backstory**:
```python
agent = Agent(
    role="Data Analyst",
    goal="Calculate metrics using the Calculator tool",
    backstory="You are skilled at using calculation tools."
)
```

3. **Limit tools** (3-5 max):
```python
agent = Agent(
    role="...",
    tools=[tool1, tool2, tool3]  # Don't overload with tools
)
```

### Agent Using Wrong Tool

**Problem**: Agent picks incorrect tool for task.

**Fix**: Make descriptions distinct:
```python
search_tool = SerperDevTool()
search_tool.description = "Search the web for current news and information. Use for recent events."

pdf_tool = PDFSearchTool()
pdf_tool.description = "Search within PDF documents. Use for document-specific queries."
```

## Task Issues

### Task Not Receiving Context

**Problem**: Task doesn't use output from previous task.

**Fix**: Explicitly pass context:
```python
task1 = Task(
    description="Research AI trends",
    expected_output="List of trends",
    agent=researcher
)

task2 = Task(
    description="Write about the research findings",
    expected_output="Blog post",
    agent=writer,
    context=[task1]  # Must explicitly reference
)
```

### Output Not Matching Expected

**Problem**: Task output doesn't match expected_output format.

**Solutions**:

1. **Be specific in expected_output**:
```python
task = Task(
    description="...",
    expected_output="""
    A JSON object with:
    - 'title': string
    - 'points': array of 5 strings
    - 'summary': string under 100 words
    """
)
```

2. **Use output_pydantic for structure**:
```python
from pydantic import BaseModel

class Report(BaseModel):
    title: str
    points: list[str]
    summary: str

task = Task(
    description="...",
    expected_output="Structured report",
    output_pydantic=Report
)
```

### Task Timeout

**Problem**: Task takes too long.

**Fix**: Set timeouts and limits:
```python
agent = Agent(
    role="...",
    max_iter=15,
    max_rpm=10
)

crew = Crew(
    agents=[agent],
    tasks=[task],
    max_rpm=20  # Crew-level limit
)
```

## Crew Issues

### CUDA/Memory Errors

**Problem**: Out of memory with local models.

**Fix**: Use cloud LLM or smaller model:
```python
from crewai import LLM

# Use cloud API instead of local
llm = LLM(model="gpt-4o")

# Or smaller local model
llm = LLM(model="ollama/llama3.1:7b")

agent = Agent(role="...", llm=llm)
```

### Rate Limiting

**Problem**: API rate limit errors.

**Fix**: Configure rate limits:
```python
agent = Agent(
    role="...",
    max_rpm=5  # 5 requests per minute
)

crew = Crew(
    agents=[agent1, agent2],
    max_rpm=10  # Total crew limit
)
```

### Memory Errors

**Problem**: Memory storage issues.

**Fix**: Set storage directory:
```python
import os
os.environ["CREWAI_STORAGE_DIR"] = "./my_storage"

# Or disable memory
crew = Crew(
    agents=[...],
    tasks=[...],
    memory=False
)
```

## Flow Issues

### State Not Persisting

**Problem**: Flow state resets between methods.

**Fix**: Use self.state correctly:
```python
class MyFlow(Flow[MyState]):
    @start()
    def init(self):
        self.state.data = "initialized"  # Correct
        return {}

    @listen(init)
    def process(self):
        print(self.state.data)  # "initialized"
```

### Router Not Triggering Listener

**Problem**: Router returns string but listener not triggered.

**Fix**: Match names exactly:
```python
@router(analyze)
def decide(self):
    return "high_confidence"  # Must match exactly

@listen("high_confidence")  # Match the router return value
def handle_high(self):
    pass
```

### Multiple Start Methods

**Problem**: Confusion with multiple @start methods.

**Note**: Multiple starts run in parallel:
```python
@start()
def start_a(self):
    return "A"

@start()
def start_b(self):  # Runs parallel with start_a
    return "B"

@listen(and_(start_a, start_b))
def after_both(self):  # Waits for both
    pass
```

## Tool Issues

### Tool Not Found

**Error**: `Tool 'X' not found`

**Fix**: Verify tool installation:
```python
# Check available tools
from crewai_tools import *

# Install specific tool
pip install 'crewai[tools]'

# Some tools need extra deps
pip install 'crewai-tools[selenium]'
pip install 'crewai-tools[firecrawl]'
```

### API Key Missing

**Error**: `API key not found`

**Fix**: Set environment variables:
```bash
# .env file
OPENAI_API_KEY=sk-...
SERPER_API_KEY=...
TAVILY_API_KEY=...
```

```python
# Or in code
import os
os.environ["SERPER_API_KEY"] = "your-key"

from crewai_tools import SerperDevTool
search = SerperDevTool()
```

### Tool Returns Error

**Problem**: Tool consistently fails.

**Fix**: Test tool independently:
```python
from crewai_tools import SerperDevTool

# Test tool directly
tool = SerperDevTool()
result = tool._run("test query")
print(result)  # Check output

# Add error handling
class SafeTool(BaseTool):
    def _run(self, query: str) -> str:
        try:
            return actual_operation(query)
        except Exception as e:
            return f"Error: {str(e)}"
```

## Performance Issues

### Slow Execution

**Problem**: Crew takes too long.

**Solutions**:

1. **Use faster model**:
```python
llm = LLM(model="gpt-4o-mini")  # Faster than gpt-4o
```

2. **Reduce iterations**:
```python
agent = Agent(role="...", max_iter=10)
```

3. **Enable caching**:
```python
crew = Crew(
    agents=[...],
    cache=True  # Cache tool results
)
```

4. **Parallel tasks** (where possible):
```python
task1 = Task(..., async_execution=True)
task2 = Task(..., async_execution=True)
```

### High Token Usage

**Problem**: Excessive API costs.

**Solutions**:

1. **Use smaller context**:
```python
task = Task(
    description="Brief research on X",  # Keep descriptions short
    expected_output="3 bullet points"    # Limit output
)
```

2. **Disable verbose in production**:
```python
agent = Agent(role="...", verbose=False)
crew = Crew(agents=[...], verbose=False)
```

3. **Use cheaper models**:
```python
llm = LLM(model="gpt-4o-mini")  # Cheaper than gpt-4o
```

## Debugging Tips

### Enable Verbose Output

```python
agent = Agent(role="...", verbose=True)
crew = Crew(agents=[...], verbose=True)
```

### Check Crew Output

```python
result = crew.kickoff(inputs={"topic": "AI"})

# Check all outputs
print(result.raw)            # Final output
print(result.tasks_output)   # All task outputs
print(result.token_usage)    # Token consumption

# Check individual tasks
for task_output in result.tasks_output:
    print(f"Task: {task_output.description}")
    print(f"Output: {task_output.raw}")
    print(f"Agent: {task_output.agent}")
```

### Test Agents Individually

```python
# Test single agent
agent = Agent(role="Researcher", goal="...", verbose=True)

task = Task(
    description="Simple test task",
    expected_output="Test output",
    agent=agent
)

crew = Crew(agents=[agent], tasks=[task], verbose=True)
result = crew.kickoff()
```

### Logging

```python
import logging

# Enable CrewAI logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger("crewai")
logger.setLevel(logging.DEBUG)
```

## Getting Help

1. **Documentation**: https://docs.crewai.com
2. **GitHub Issues**: https://github.com/crewAIInc/crewAI/issues
3. **Discord**: https://discord.gg/crewai
4. **Examples**: https://github.com/crewAIInc/crewAI-examples

### Reporting Issues

Include:
- CrewAI version: `pip show crewai`
- Python version: `python --version`
- Full error traceback
- Minimal reproducible code
- Expected vs actual behavior
