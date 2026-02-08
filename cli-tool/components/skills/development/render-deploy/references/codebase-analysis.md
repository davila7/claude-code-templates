# Codebase Analysis (Deploy)

Use this reference for framework-specific detection and build/start command selection when preparing a Render deployment.

## Node.js Projects
- Read `package.json` to detect framework (Express, Next.js, Nest.js, Fastify, etc.)
- Check `scripts` section for build/start commands
- Look for `engines` field for Node version, or look in `.node-versions` or `.nvmrc`
- Detect package manager:
  - `bun.lockb` (Bun) -> `bun install --frozen-lockfile` / `bun run start`
  - `pnpm-lock.yaml` (pnpm) -> `pnpm install --frozen-lockfile` / `pnpm start`
  - `yarn.lock` (Yarn) -> `yarn install --frozen-lockfile` / `yarn start`
  - `package-lock.json` (npm) -> `npm ci` / `npm start`
  - `package.json` only (npm fallback) -> `npm install` / `npm start`

## Python Projects
- Check for dependency files and detect package manager:
  - `uv.lock` (uv) -> `uv sync` / `uv run gunicorn app:app`
  - `poetry.lock` (Poetry) -> `poetry install --no-dev` / `poetry run gunicorn app:app`
  - `Pipfile.lock` (pipenv) -> `pipenv install --deploy` / `pipenv run gunicorn app:app`
  - `requirements.txt` (pip) -> `pip install -r requirements.txt` / `gunicorn app:app`
  - `pyproject.toml` only -> check for `[tool.uv]`, `[tool.poetry]`, or use pip
- Detect framework: Django, Flask, FastAPI, Celery, others
- Check for Python version:
  - `.python-version` (uv/pyenv)
  - `runtime.txt` (Render-specific)
  - `pyproject.toml` (requires-python field)

## Go Projects
- Read `go.mod` for dependencies
- Identify web framework (Gin, Echo, Chi, Fiber, net/http)
- Note Go version from `go.mod`

## Static Sites
- Look for build output directories (`build/`, `dist/`, `site/`, `public/`)
- Detect framework: React, Vue, Gatsby, Next.js (static export)
- Check build scripts in `package.json`

## Docker Projects
- Look for `Dockerfile`
- Note exposed ports and build stages
- Check for `docker-compose.yml` patterns

## Key Information to Extract
- Build command (e.g., `npm ci`, `pip install -r requirements.txt`, `go build`)
- Start command (e.g., `npm start`, `gunicorn app:app`, `./bin/app`)
- Environment variables used in code (API keys, database URLs, secrets)
- Database requirements (PostgreSQL, Redis, MongoDB)
- Port binding (check if app uses an environment variable for port to run on)
