---
name: railway-docs
description: Fetch up-to-date Railway documentation to answer questions accurately. Use when user asks about Railway features, how Railway works, or shares a docs.railway.com URL.
version: 1.0.0
author: Railway
license: MIT
tags: [Railway, Documentation, Docs, Help, Reference, Learning]
dependencies: [railway-cli]
---

# Railway Documentation

Fetch up-to-date Railway documentation to answer questions accurately.

## When to Use

- User asks how something works on Railway (projects, deployments, volumes, etc.)
- User shares a docs.railway.com URL
- User needs current info about Railway features or pricing
- Before answering Railway questions from memory - check the docs first

## LLM-Optimized Sources

Start here for comprehensive, up-to-date info:

| Source             | URL                                         |
| ------------------ | ------------------------------------------- |
| **Full docs**      | `https://docs.railway.com/api/llms-docs.md` |
| **llms.txt index** | `https://railway.com/llms.txt`              |
| **Templates**      | `https://railway.com/llms-templates.md`     |
| **Changelog**      | `https://railway.com/llms-changelog.md`     |
| **Blog**           | `https://blog.railway.com/llms-blog.md`     |

## Fetching Specific Pages

Append `.md` to any docs.railway.com URL:

```
https://docs.railway.com/guides/projects
→ https://docs.railway.com/guides/projects.md
```

## Common Doc Paths

| Topic       | URL                                              |
| ----------- | ------------------------------------------------ |
| Projects    | `https://docs.railway.com/guides/projects.md`    |
| Deployments | `https://docs.railway.com/guides/deployments.md` |
| Volumes     | `https://docs.railway.com/guides/volumes.md`     |
| Variables   | `https://docs.railway.com/guides/variables.md`   |
| CLI         | `https://docs.railway.com/reference/cli-api.md`  |
| Pricing     | `https://docs.railway.com/reference/pricing.md`  |
