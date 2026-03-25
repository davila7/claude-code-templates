# Render Runtime Options

Complete guide to available runtimes on Render, including versions, configuration, and best practices for each language.

## Native Language Runtimes

### Node.js (`runtime: node`)

**Supported Versions:** 14, 16, 18, 20, 21
**Default Version:** 20

**Version Specification:**

Specify Node version in `package.json`:
```json
{
  "engines": {
    "node": "20.x"
  }
}
```

**Package Managers:**
- **npm**: Default, uses `package-lock.json`
- **Yarn**: Auto-detected if `yarn.lock` exists
- **pnpm**: Auto-detected if `pnpm-lock.yaml` exists

**Common Build Commands:**
```bash
npm ci                          # Recommended (faster, reproducible)
npm ci && npm run build         # Build step included
yarn install --frozen-lockfile  # Yarn equivalent
pnpm install --frozen-lockfile  # pnpm equivalent
```

**Common Start Commands:**
```bash
npm start                       # Uses "start" script in package.json
node server.js                  # Direct file execution
node dist/main.js               # Built output
```

**Popular Frameworks:**
- Express.js, Fastify, Koa (APIs)
- Next.js (full-stack React)
- Nest.js (enterprise TypeScript)
- Remix (full-stack React)
- Nuxt.js (full-stack Vue)

**Example Configuration:**
```yaml
type: web
name: node-app
runtime: node
buildCommand: npm ci && npm run build
startCommand: npm start
```

---

### Python (`runtime: python`)

**Supported Versions:** 3.8, 3.9, 3.10, 3.11, 3.12
**Default Version:** 3.11

**Version Specification:**

Option 1 - `runtime.txt`:
```
python-3.11.5
```

Option 2 - `Pipfile`:
```toml
[requires]
python_version = "3.11"
```

**Package Managers:**
- **pip**: Default, uses `requirements.txt`
- **Poetry**: Auto-detected if `pyproject.toml` exists
- **Pipenv**: Auto-detected if `Pipfile` exists

**Common Build Commands:**
```bash
pip install -r requirements.txt
pip install -r requirements.txt && python manage.py collectstatic --no-input
poetry install --no-dev
pipenv install --deploy
```

**Common Start Commands:**
```bash
gunicorn app:app                                    # Flask
gunicorn config.wsgi:application                    # Django
uvicorn main:app --host 0.0.0.0 --port $PORT       # FastAPI
celery -A tasks worker                              # Celery worker
```

**Popular Frameworks:**
- Django (full-stack web framework)
- Flask (microframework)
- FastAPI (modern async API framework)
- Celery (task queue)

**Example Configuration:**
```yaml
type: web
name: python-app
runtime: python
buildCommand: pip install -r requirements.txt
startCommand: gunicorn app:app --bind 0.0.0.0:$PORT
```

---

### Go (`runtime: go`)

**Supported Versions:** 1.20, 1.21, 1.22, 1.23
**Default Version:** Latest stable

**Version Specification:**

Specify in `go.mod`:
```go
module myapp

go 1.22
```

**Build System:** Uses Go modules

**Common Build Commands:**
```bash
go build -o bin/app .
go build -o bin/app cmd/server/main.go
go build -tags netgo -ldflags '-s -w' -o bin/app
```

**Common Start Commands:**
```bash
./bin/app
./bin/server
```

**Popular Frameworks:**
- net/http (standard library)
- Gin (fast web framework)
- Echo (high performance framework)
- Chi (lightweight router)
- Fiber (Express-inspired framework)
- Gorilla Mux (powerful router)

**Example Configuration:**
```yaml
type: web
name: go-app
runtime: go
buildCommand: go build -o bin/app .
startCommand: ./bin/app
```

---

### Ruby (`runtime: ruby`)

**Supported Versions:** 3.0, 3.1, 3.2, 3.3
**Default Version:** 3.3

**Version Specification:**

Option 1 - `.ruby-version`:
```
3.3.0
```

Option 2 - `Gemfile`:
```ruby
ruby '3.3.0'
```

**Package Manager:** Bundler (uses `Gemfile` and `Gemfile.lock`)

**Common Build Commands:**
```bash
bundle install --jobs=4 --retry=3
bundle install && bundle exec rails assets:precompile
```

**Common Start Commands:**
```bash
bundle exec rails server -b 0.0.0.0 -p $PORT
bundle exec puma -C config/puma.rb
bundle exec rackup -o 0.0.0.0 -p $PORT
bundle exec sidekiq                                  # Worker
```

**Popular Frameworks:**
- Ruby on Rails (full-stack framework)
- Sinatra (microframework)
- Sidekiq (background jobs)

**Example Configuration:**
```yaml
type: web
name: rails-app
runtime: ruby
buildCommand: bundle install && bundle exec rails assets:precompile
startCommand: bundle exec puma -C config/puma.rb
```

---

### Rust (`runtime: rust`)

**Supported Versions:** Latest stable
**Default Version:** Latest stable

**Build System:** Cargo

**Common Build Commands:**
```bash
cargo build --release
cargo build --release --locked
```

**Common Start Commands:**
```bash
./target/release/myapp
```

**Popular Frameworks:**
- Actix Web (powerful, performant)
- Rocket (web framework with focus on usability)
- Axum (modern, ergonomic framework)
- Warp (composable web framework)

**Example Configuration:**
```yaml
type: web
name: rust-app
runtime: rust
buildCommand: cargo build --release
startCommand: ./target/release/myapp
```

---

### Elixir (`runtime: elixir`)

**Supported Versions:** Latest stable
**Default Version:** Latest stable

**Build System:** Mix

**Common Build Commands:**
```bash
mix deps.get --only prod
mix deps.get && mix compile
mix do deps.get, compile, assets.deploy
```

**Common Start Commands:**
```bash
mix phx.server
elixir --name myapp -S mix phx.server
```

**Popular Frameworks:**
- Phoenix (full-stack web framework)
- Phoenix LiveView (real-time applications)

**Example Configuration:**
```yaml
type: web
name: elixir-app
runtime: elixir
buildCommand: mix deps.get --only prod && mix compile
startCommand: mix phx.server
```

---

## Container Runtimes

### Docker (`runtime: docker`)

Build your application from a Dockerfile in your repository.

**Additional Configuration:**
- `dockerfilePath`: Path to Dockerfile (default: `./Dockerfile`)
- `dockerContext`: Build context directory (default: `.`)

**Example Configuration:**
```yaml
type: web
name: docker-app
runtime: docker
dockerfilePath: ./Dockerfile
dockerContext: .
```

**Multi-stage Dockerfile Example:**
```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY package*.json ./
RUN npm ci --only=production
EXPOSE 10000
CMD ["node", "dist/main.js"]
```

**Best Practices:**
- Use multi-stage builds to reduce image size
- Copy `package.json` before source code (better caching)
- Use `.dockerignore` to exclude unnecessary files
- Expose port dynamically via `$PORT` environment variable
- Run as non-root user for security

---

### Pre-built Image (`runtime: image`)

Deploy pre-built Docker images from a container registry.

**Additional Configuration:**
- `image`: Full image URL with tag or digest
- `registryCredential`: Credentials for private registries

**Example with Public Image:**
```yaml
type: web
name: prebuilt-app
runtime: image
image: ghcr.io/myorg/myapp:v1.2.3
```

**Example with Private Registry:**
```yaml
type: web
name: private-app
runtime: image
image: myregistry.com/myapp:latest
registryCredential:
  username: my-username
  password:
    sync: false  # User provides in Dashboard
```

**Use Cases:**
- Deploy images built in CI/CD pipeline
- Use images from container registries
- Deploy Docker Hub images
- Use private registry images

---

## Static Runtime (`runtime: static`)

Serve pre-built static files without a backend runtime. Files are served via CDN.

**Additional Configuration:**
- `staticPublishPath`: Directory containing built files (e.g., `./dist`, `./build`)

**Common Build Commands by Framework:**

**React (Create React App):**
```bash
npm ci && npm run build
# Outputs to: ./build
```

**Vue:**
```bash
npm ci && npm run build
# Outputs to: ./dist
```

**Next.js (Static Export):**
```bash
npm ci && npm run build && npm run export
# Outputs to: ./out
```

**Gatsby:**
```bash
npm ci && npm run build
# Outputs to: ./public
```

**Vite:**
```bash
npm ci && npm run build
# Outputs to: ./dist
```

**Example Configuration:**
```yaml
type: web
name: react-app
runtime: static
buildCommand: npm ci && npm run build
staticPublishPath: ./build
```

---

## Runtime Comparison

| Runtime | Build Speed | Cold Start | Best For |
|---------|-------------|------------|----------|
| Node.js | Fast | Fast | APIs, full-stack apps |
| Python | Medium | Medium | Data apps, APIs, web |
| Go | Fast | Very Fast | High performance APIs |
| Ruby | Slow | Medium | Rails apps, traditional web |
| Rust | Very Slow | Very Fast | Performance-critical services |
| Elixir | Medium | Fast | Real-time, concurrent apps |
| Docker | Varies | Medium | Any language, custom setup |
| Static | Very Fast | N/A | SPAs, documentation, marketing |

---

## Choosing the Right Runtime

**Choose Node.js when:**
- Building JavaScript-based applications
- Need rich npm ecosystem
- Want fast iteration and deployment
- Building full-stack applications (Next.js, Remix)

**Choose Python when:**
- Building data-heavy applications
- Need machine learning libraries
- Django or Flask expertise
- Data processing pipelines

**Choose Go when:**
- Need high performance and low resource usage
- Building microservices
- Want simple deployment (single binary)
- Handling high concurrency

**Choose Ruby when:**
- Building traditional web applications
- Ruby on Rails expertise
- Rapid development priority

**Choose Rust when:**
- Maximum performance required
- Systems programming
- Resource-constrained environments

**Choose Docker when:**
- Need custom system dependencies
- Multi-language application
- Existing Dockerfile
- Need full control over environment

**Choose Static when:**
- Building SPAs or static sites
- No backend processing needed
- Want CDN caching and fast delivery
- Documentation or marketing sites
