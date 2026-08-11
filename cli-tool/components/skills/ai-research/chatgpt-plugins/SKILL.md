---
name: "chatgpt-plugins"
description: "Use when the user asks about ChatGPT plugins, the OpenAI plugin ecosystem, building ChatGPT plugins, or wants to discover available plugins (official, plugin-store, and third-party). Covers plugin development, ai-plugin.json manifests, OpenAPI specs, retrieval plugin, and curated third-party plugin list."
author: "yoavanaki"
source: "https://github.com/yoavanaki/chatgpt-plugins"
---

# ChatGPT Plugins

Help the user discover, install, and build ChatGPT plugins using the curated list and OpenAI's plugin development resources.

## Official OpenAI Plugins

| Plugin | Description |
|--------|-------------|
| Browsing | Experimental model that knows when and how to browse the internet |
| Code Interpreter | Experimental ChatGPT model that can use Python, handle uploads and downloads |
| Retrieval | Open-source retrieval plugin enabling ChatGPT to access personal/organizational information sources |

## OpenAI Plugin Store (Built-in)

| Plugin | Description |
|--------|-------------|
| Instacart | Order from local grocery stores |
| Kayak | Search for flights, stays and rental cars |
| Shop | Search millions of products from top brands |
| FiscalNote | Real-time legal, political, and regulatory data |
| Klarna | Compare prices from thousands of online shops |
| Zapier | Interact with 5,000+ apps (Google Sheets, Trello, Gmail, etc.) |
| OpenTable | Restaurant recommendations with direct booking |
| Speak | AI-powered language tutor |
| Wolfram | Computation, math, and real-time data via Wolfram|Alpha |
| Expedia | Trip planning: flights, hotels, activities |
| JoPilot | Search US jobs by company, keywords, location |
| Resume Copilot | Upload resume, get feedback, create new version |

## Third-Party Plugins

| Plugin | Description | Source |
|--------|-------------|--------|
| Gerev AI | Search engine for your organization | https://github.com/GerevAI/gerev |
| chat-todo-plugin | Manage a TODO list via ChatGPT | https://github.com/lencx/chat-todo-plugin |
| ChadCode | Intelligence layer on your codebase | https://twitter.com/mathemagic1an/status/1639779842769014784 |
| Domain Ideas | Brainstorm domain names with ChatGPT | https://twitter.com/steventey/status/1640378476950855680 |
| Paperplane | Update SalesForce automatically | https://twitter.com/dnlkwk/status/1640932332638179329 |
| ReviewReader | Summarise Amazon product reviews instantly | https://youtu.be/SaNvkaRGUeI |
| Transvribe | Ask any YouTube video a question | https://www.transvribe.com/.well-known/ai-plugin.json |

## Plugin Development Resources

- **OpenAI Plugins Documentation**: https://platform.openai.com/docs/plugins/introduction
- **OpenAI Plugins Examples**: https://platform.openai.com/docs/plugins/examples
- **OpenAI Retrieval Plugin**: https://github.com/openai/chatgpt-retrieval-plugin

## Building a ChatGPT Plugin

### 1. Create `ai-plugin.json` manifest

```json
{
  "schema_version": "v1",
  "name_for_human": "My Plugin",
  "name_for_model": "my_plugin",
  "description_for_human": "What your plugin does in plain English.",
  "description_for_model": "Description used by the model to understand when to invoke your plugin.",
  "auth": {
    "type": "none"
  },
  "api": {
    "type": "openapi",
    "url": "https://your-domain.com/openapi.yaml"
  },
  "logo_url": "https://your-domain.com/logo.png",
  "contact_email": "support@your-domain.com",
  "legal_info_url": "https://your-domain.com/legal"
}
```

### 2. Create an OpenAPI spec

Define your API endpoints in `openapi.yaml` following the OpenAPI 3.0 spec. ChatGPT uses this to understand available actions.

### 3. Serve the manifest

Host `ai-plugin.json` at `https://your-domain.com/.well-known/ai-plugin.json`.

### 4. Development workflow

1. Build your API (any language/framework)
2. Write the `ai-plugin.json` manifest and `openapi.yaml`
3. Test locally using the ChatGPT plugin dev tools
4. Submit for review via the OpenAI plugin waitlist

## Tips

- Keep `description_for_model` specific and concise — it directly affects when the model invokes your plugin
- Use OAuth or API key auth for production plugins
- The Retrieval plugin is the best starting point for RAG-based plugins
- LangChain integrates natively with ChatGPT plugins for agent-based workflows
