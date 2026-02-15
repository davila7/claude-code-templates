# CrewAI Tools Guide

## Built-in Tools

Install the tools package:

```bash
pip install 'crewai[tools]'
```

### Search Tools

```python
from crewai_tools import (
    SerperDevTool,         # Google search via Serper
    TavilySearchTool,      # Tavily search API
    BraveSearchTool,       # Brave search
    EXASearchTool,         # EXA semantic search
)

# Serper (requires SERPER_API_KEY)
search = SerperDevTool()

# Tavily (requires TAVILY_API_KEY)
search = TavilySearchTool()

# Use in agent
researcher = Agent(
    role="Researcher",
    goal="Find information",
    tools=[SerperDevTool()]
)
```

### Web Scraping Tools

```python
from crewai_tools import (
    ScrapeWebsiteTool,           # Basic scraping
    FirecrawlScrapeWebsiteTool,  # Firecrawl API
    SeleniumScrapingTool,        # Browser automation
    SpiderTool,                  # Spider.cloud
)

# Basic scraping
scraper = ScrapeWebsiteTool()

# Firecrawl (requires FIRECRAWL_API_KEY)
scraper = FirecrawlScrapeWebsiteTool()

# Selenium (requires chromedriver)
scraper = SeleniumScrapingTool()

agent = Agent(
    role="Web Analyst",
    goal="Extract web content",
    tools=[ScrapeWebsiteTool()]
)
```

### File Tools

```python
from crewai_tools import (
    FileReadTool,           # Read any file
    FileWriterTool,         # Write files
    DirectoryReadTool,      # List directory contents
    DirectorySearchTool,    # Search in directory
)

# Read files
file_reader = FileReadTool(file_path="./data")  # Limit to directory

# Write files
file_writer = FileWriterTool()

agent = Agent(
    role="File Manager",
    tools=[FileReadTool(), FileWriterTool()]
)
```

### Document Tools

```python
from crewai_tools import (
    PDFSearchTool,          # Search PDF content
    DOCXSearchTool,         # Search Word docs
    TXTSearchTool,          # Search text files
    CSVSearchTool,          # Search CSV files
    JSONSearchTool,         # Search JSON files
    XMLSearchTool,          # Search XML files
    MDXSearchTool,          # Search MDX files
)

# PDF search (uses embeddings)
pdf_tool = PDFSearchTool(pdf="./documents/report.pdf")

# CSV search
csv_tool = CSVSearchTool(csv="./data/sales.csv")

agent = Agent(
    role="Document Analyst",
    tools=[PDFSearchTool(), CSVSearchTool()]
)
```

### Database Tools

```python
from crewai_tools import (
    MySQLSearchTool,              # MySQL queries
    PostgreSQLTool,               # PostgreSQL
    MongoDBVectorSearchTool,      # MongoDB vector search
    QdrantVectorSearchTool,       # Qdrant vector DB
    WeaviateVectorSearchTool,     # Weaviate
)

# MySQL
mysql_tool = MySQLSearchTool(
    host="localhost",
    port=3306,
    database="mydb",
    user="user",
    password="pass"
)

# Qdrant
qdrant_tool = QdrantVectorSearchTool(
    url="http://localhost:6333",
    collection_name="my_collection"
)
```

### AI Service Tools

```python
from crewai_tools import (
    DallETool,              # DALL-E image generation
    VisionTool,             # Image analysis
    OCRTool,                # Text extraction from images
)

# DALL-E (requires OPENAI_API_KEY)
dalle = DallETool()

# Vision (GPT-4V)
vision = VisionTool()

agent = Agent(
    role="Visual Designer",
    tools=[DallETool(), VisionTool()]
)
```

### Code Tools

```python
from crewai_tools import (
    CodeDocsSearchTool,     # Search code documentation
    GithubSearchTool,       # Search GitHub repos
    CodeInterpreterTool,    # Execute Python code
)

# Code docs search
code_docs = CodeDocsSearchTool(docs_url="https://docs.python.org")

# GitHub search (requires GITHUB_TOKEN)
github = GithubSearchTool(
    repo="owner/repo",
    content_types=["code", "issue"]
)

# Code interpreter (sandboxed)
interpreter = CodeInterpreterTool()
```

### Cloud Platform Tools

```python
from crewai_tools import (
    BedrockInvokeAgentTool,     # AWS Bedrock
    DatabricksQueryTool,        # Databricks
    S3ReaderTool,               # AWS S3
    SnowflakeTool,              # Snowflake
)

# AWS Bedrock
bedrock = BedrockInvokeAgentTool(
    agent_id="your-agent-id",
    agent_alias_id="alias-id"
)

# Databricks
databricks = DatabricksQueryTool(
    host="your-workspace.databricks.com",
    token="your-token"
)
```

### Integration Tools

```python
from crewai_tools import (
    MCPServerAdapter,       # MCP protocol
    ComposioTool,           # Composio integrations
    ZapierActionTool,       # Zapier automations
)

# MCP Server
mcp = MCPServerAdapter(
    server_url="http://localhost:8080",
    tool_names=["tool1", "tool2"]
)

# Composio (requires COMPOSIO_API_KEY)
composio = ComposioTool()
```

## Custom Tools

### Basic Custom Tool

```python
from crewai.tools import BaseTool
from pydantic import Field

class WeatherTool(BaseTool):
    name: str = "Weather Lookup"
    description: str = "Get current weather for a city. Input: city name"

    def _run(self, city: str) -> str:
        # Your implementation
        return f"Weather in {city}: 72°F, sunny"

# Use custom tool
agent = Agent(
    role="Weather Reporter",
    tools=[WeatherTool()]
)
```

### Tool with Parameters

```python
from crewai.tools import BaseTool
from pydantic import Field
from typing import Optional

class APITool(BaseTool):
    name: str = "API Client"
    description: str = "Make API requests"

    # Tool configuration
    api_key: str = Field(default="")
    base_url: str = Field(default="https://api.example.com")

    def _run(self, endpoint: str, method: str = "GET") -> str:
        import requests

        url = f"{self.base_url}/{endpoint}"
        headers = {"Authorization": f"Bearer {self.api_key}"}

        response = requests.request(method, url, headers=headers)
        return response.json()

# Configure tool
api_tool = APITool(api_key="your-key", base_url="https://api.example.com")
```

### Tool with Validation

```python
from crewai.tools import BaseTool
from pydantic import Field, field_validator

class CalculatorTool(BaseTool):
    name: str = "Calculator"
    description: str = "Perform math calculations. Input: expression (e.g., '2 + 2')"

    allowed_operators: list = Field(default=["+", "-", "*", "/", "**"])

    @field_validator("allowed_operators")
    def validate_operators(cls, v):
        valid = ["+", "-", "*", "/", "**", "%", "//"]
        for op in v:
            if op not in valid:
                raise ValueError(f"Invalid operator: {op}")
        return v

    def _run(self, expression: str) -> str:
        try:
            # Simple eval with safety checks
            for char in expression:
                if char.isalpha():
                    return "Error: Letters not allowed"
            result = eval(expression)
            return f"Result: {result}"
        except Exception as e:
            return f"Error: {str(e)}"
```

### Async Tool

```python
from crewai.tools import BaseTool
import aiohttp

class AsyncAPITool(BaseTool):
    name: str = "Async API"
    description: str = "Make async API requests"

    async def _arun(self, url: str) -> str:
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                return await response.text()

    def _run(self, url: str) -> str:
        import asyncio
        return asyncio.run(self._arun(url))
```

## Tool Configuration

### Caching

```python
from crewai_tools import SerperDevTool

# Enable caching (default)
search = SerperDevTool(cache=True)

# Disable for real-time data
search = SerperDevTool(cache=False)
```

### Error Handling

```python
class RobustTool(BaseTool):
    name: str = "Robust Tool"
    description: str = "A tool with error handling"

    max_retries: int = 3

    def _run(self, query: str) -> str:
        for attempt in range(self.max_retries):
            try:
                return self._execute(query)
            except Exception as e:
                if attempt == self.max_retries - 1:
                    return f"Failed after {self.max_retries} attempts: {str(e)}"
                continue
```

### Tool Limits per Agent

```python
# Recommended: 3-5 tools per agent
researcher = Agent(
    role="Researcher",
    goal="Find information",
    tools=[
        SerperDevTool(),        # Search
        ScrapeWebsiteTool(),    # Scrape
        PDFSearchTool(),        # PDF search
    ],
    max_iter=15                 # Limit iterations
)
```

## MCP (Model Context Protocol)

### Using MCP Servers

```python
from crewai_tools import MCPServerAdapter

# Connect to MCP server
mcp_adapter = MCPServerAdapter(
    server_url="http://localhost:8080",
    tool_names=["search", "calculate", "translate"]
)

# Get tools from MCP
mcp_tools = mcp_adapter.get_tools()

agent = Agent(
    role="MCP User",
    tools=mcp_tools
)
```

### MCP Tool Discovery

```python
# List available tools
tools = mcp_adapter.list_tools()
for tool in tools:
    print(f"{tool.name}: {tool.description}")

# Get specific tools
selected_tools = mcp_adapter.get_tools(tool_names=["search", "translate"])
```

## Tool Best Practices

1. **Single responsibility** - Each tool should do one thing well
2. **Clear descriptions** - Agents use descriptions to choose tools
3. **Input validation** - Validate inputs before processing
4. **Error messages** - Return helpful error messages
5. **Limit per agent** - 3-5 tools max for focused agents
6. **Cache when appropriate** - Enable caching for expensive operations
7. **Timeout handling** - Add timeouts for external API calls
8. **Test thoroughly** - Unit test tools independently

## Tool Categories Reference

| Category | Tools | Use Case |
|----------|-------|----------|
| **Search** | Serper, Tavily, Brave, EXA | Web search, information retrieval |
| **Scraping** | ScrapeWebsite, Firecrawl, Selenium | Extract web content |
| **Files** | FileRead, FileWrite, DirectoryRead | Local file operations |
| **Documents** | PDF, DOCX, CSV, JSON, XML | Document parsing |
| **Databases** | MySQL, PostgreSQL, MongoDB, Qdrant | Data storage queries |
| **AI Services** | DALL-E, Vision, OCR | AI-powered tools |
| **Code** | CodeDocs, GitHub, CodeInterpreter | Development tools |
| **Cloud** | Bedrock, Databricks, S3, Snowflake | Cloud platform integration |
| **Integration** | MCP, Composio, Zapier | Third-party integrations |
