# Railpack Reference

Railpack is Railway's default builder. Zero-config for most projects.

Full docs: https://railpack.com/llms.txt

## Detection

Railpack analyzes source code to detect language, framework, and build requirements automatically.

Supported: Node, Python, Go, PHP, Java, Ruby, Rust, Elixir, Gleam, Deno, C/C++, static files.

## Static Sites

### Detection Patterns

Railpack serves static files via Caddy when it detects:
1. `Staticfile` in root (can specify `root: dist`)
2. `index.html` in root
3. `public/` directory
4. `RAILPACK_STATIC_FILE_ROOT` env var set

### Root Directory Priority

1. `RAILPACK_STATIC_FILE_ROOT` env var
2. `root` in `Staticfile`
3. `public/` directory
4. Current directory (if index.html exists)

### Common Patterns

Railpack auto-detects common static build outputs. Only set `RAILPACK_STATIC_FILE_ROOT` for non-standard output directories.

| Framework | Build Output | Config Needed |
|-----------|--------------|---------------|
| Plain HTML | root | None (auto-detected) |
| Vite | dist | None (auto-detected) |
| Astro (static) | dist | None (auto-detected) |
| Create React App | build | None (auto-detected) |
| Angular | dist/<project> | `RAILPACK_STATIC_FILE_ROOT=dist/<project>` (non-standard path) |
| Custom output | varies | Set if output dir is non-standard |

### Custom Caddyfile

Put a `Caddyfile` in project root to override default serving behavior.

## Node.js

### Detection
- `package.json` in root

### Version Priority
1. `RAILPACK_NODE_VERSION` env var
2. `engines.node` in package.json
3. `.nvmrc` or `.node-version`
4. Default: Node 22

### Package Manager Detection
1. `packageManager` field in package.json (enables Corepack)
2. Lock file: `pnpm-lock.yaml`, `bun.lockb`, `yarn.lock`
3. Default: npm

### Build Command
Auto-detected from package.json `scripts.build`. Override via `buildCommand` in service settings.

### Start Command
Auto-detected:
1. `scripts.start` in package.json
2. `main` field in package.json
3. `index.js` or `index.ts` in root

Override via `startCommand` in service settings.

### Framework Detection

| Framework | Detection | Notes |
|-----------|-----------|-------|
| Next.js | `next` in dependencies | Caches `.next/cache` |
| Vite | `vite` in devDependencies | Static or SSR mode |
| Astro | `astro` in dependencies | Caches `.astro` |
| Nuxt | `nuxt` in dependencies | Auto start command |
| Remix | `@remix-run/*` in deps | - |

### Static Site Mode (SPA)

For frameworks like Vite, CRA, Astro (static), Angular:
- Railpack builds then serves via Caddy
- Set `RAILPACK_SPA_OUTPUT_DIR` if output isn't `dist`

## Python

### Detection
- `requirements.txt`, `pyproject.toml`, `Pipfile`, or `uv.lock`

### Version Priority
1. `RAILPACK_PYTHON_VERSION` env var
2. `.python-version` file
3. `requires-python` in pyproject.toml
4. Default: Python 3.12

### WSGI/ASGI Auto-Config

| Framework | Start Command |
|-----------|---------------|
| Django | `gunicorn <project>.wsgi` |
| FastAPI | `uvicorn main:app --host 0.0.0.0` |
| Flask | `gunicorn app:app` |

Override via `startCommand` in service settings.

## Go

### Detection
- `go.mod` in root

### Build
Compiles to binary automatically. For `cmd/` structure, set binary name or use `RAILPACK_GO_BIN`.

## Rust

### Detection
- `Cargo.toml` in root

### Build
Release build by default. Binary auto-detected from Cargo.toml.

## Configuration

### Preferred: Service Settings

Use `environment` skill to set:
- `buildCommand` - Custom build command
- `startCommand` - Custom start command

These are stored in Railway and don't pollute your codebase.

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `RAILPACK_STATIC_FILE_ROOT` | Static file serving directory |
| `RAILPACK_SPA_OUTPUT_DIR` | SPA build output (defaults to `dist`) |
| `RAILPACK_NODE_VERSION` | Node.js version |
| `RAILPACK_PYTHON_VERSION` | Python version |
| `RAILPACK_GO_BIN` | Go binary name |
| `RAILPACK_PACKAGES` | Additional Mise packages (`pkg@version`) |
| `RAILPACK_BUILD_APT_PACKAGES` | System packages for build |
| `RAILPACK_DEPLOY_APT_PACKAGES` | System packages for runtime |

### railpack.json

Advanced config for custom build steps:

```json
{
  "$schema": "https://schema.railpack.com",
  "packages": {
    "ffmpeg": "latest"
  },
  "deploy": {
    "aptPackages": ["libmagic1"]
  }
}
```

### railway.toml

Alternative config format:

```toml
[build]
builder = "RAILPACK"
buildCommand = "npm run build"

[deploy]
startCommand = "npm start"
```

## Minimal Project Scaffolding

When no code exists, suggest these patterns:

### Static HTML
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Site</title>
</head>
<body>
  <h1>Hello Railway</h1>
</body>
</html>
```

### Vite React
```bash
npm create vite@latest . -- --template react
```

### Astro
```bash
npm create astro@latest
```

### Python FastAPI
```python
# main.py
from fastapi import FastAPI
app = FastAPI()

@app.get("/")
def root():
    return {"message": "Hello Railway"}
```

```txt
# requirements.txt
fastapi
uvicorn
```

### Go HTTP Server
```go
// main.go
package main

import (
    "fmt"
    "net/http"
    "os"
)

func main() {
    port := os.Getenv("PORT")
    if port == "" {
        port = "8080"
    }
    http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
        fmt.Fprintf(w, "Hello Railway")
    })
    http.ListenAndServe(":"+port, nil)
}
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Static site 404s | Check output dir - set `RAILPACK_STATIC_FILE_ROOT` if non-standard |
| Wrong build command | Use `environment` skill to set `buildCommand` |
| Wrong start command | Use `environment` skill to set `startCommand` |
| Missing system package | Add to `RAILPACK_BUILD_APT_PACKAGES` or `RAILPACK_DEPLOY_APT_PACKAGES` |
| Wrong Node version | Set `RAILPACK_NODE_VERSION` or add `.nvmrc` |
| Wrong Python version | Set `RAILPACK_PYTHON_VERSION` or add `.python-version` |
