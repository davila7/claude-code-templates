# CI/CD Pipeline Generator

Generate production-ready CI/CD pipelines for any platform with best practices built-in.

## Purpose

This command creates comprehensive CI/CD pipeline configurations that include linting, testing, building, security scanning, and deployment stages. It supports multiple platforms and can be customized for your specific workflow needs.

## Usage

```
/cicd-generate                           # Interactive setup
/cicd-generate github-actions            # GitHub Actions pipeline
/cicd-generate gitlab                    # GitLab CI pipeline
/cicd-generate --platform github --type full
/cicd-generate --include security,docker
```

## What this command does

1. **Detects your project type** (Node.js, Python, Go, Rust, etc.)
2. **Generates platform-specific pipeline** configurations
3. **Includes best practices** for testing, security, and deployment
4. **Configures caching** for faster builds
5. **Sets up deployment stages** for staging and production

## Supported Platforms

| Platform | Config File | Features |
|----------|-------------|----------|
| **GitHub Actions** | `.github/workflows/*.yml` | Matrix builds, reusable workflows, environments |
| **GitLab CI** | `.gitlab-ci.yml` | Stages, artifacts, environments, review apps |
| **CircleCI** | `.circleci/config.yml` | Orbs, workflows, caching |
| **Jenkins** | `Jenkinsfile` | Declarative pipeline, parallel stages |
| **Azure Pipelines** | `azure-pipelines.yml` | Templates, stages, environments |

## Pipeline Types

### Basic Pipeline
```
lint → test → build
```

### Full Pipeline
```
lint → test → security-scan → build → deploy-staging → deploy-production
```

### Monorepo Pipeline
```
detect-changes → [affected-packages] → lint → test → build → deploy
```

## GitHub Actions Examples

### Node.js Full Pipeline

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20'

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

  test:
    runs-on: ubuntu-latest
    needs: lint
    strategy:
      matrix:
        node-version: [18, 20, 22]
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test -- --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        if: matrix.node-version == '20'

  security:
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v4

      - name: Run security audit
        run: npm audit --audit-level=high

      - name: Run Snyk scan
        uses: snyk/actions/node@0.4.0
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        continue-on-error: true

  build:
    runs-on: ubuntu-latest
    needs: [test, security]
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: build
          path: dist/

  deploy-staging:
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/develop'
    environment: staging
    steps:
      - uses: actions/checkout@v4

      - name: Download build artifacts
        uses: actions/download-artifact@v4
        with:
          name: build
          path: dist/

      - name: Deploy to staging
        run: |
          # Add your deployment commands here
          echo "Deploying to staging..."

  deploy-production:
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'
    environment: production
    steps:
      - uses: actions/checkout@v4

      - name: Download build artifacts
        uses: actions/download-artifact@v4
        with:
          name: build
          path: dist/

      - name: Deploy to production
        run: |
          # Add your deployment commands here
          echo "Deploying to production..."
```

### Python Pipeline

```yaml
name: Python CI/CD

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: ['3.10', '3.11', '3.12']

    steps:
      - uses: actions/checkout@v4

      - name: Set up Python ${{ matrix.python-version }}
        uses: actions/setup-python@v5
        with:
          python-version: ${{ matrix.python-version }}
          cache: 'pip'

      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements-dev.txt

      - name: Lint with ruff
        run: ruff check .

      - name: Type check with mypy
        run: mypy src/

      - name: Test with pytest
        run: pytest --cov=src --cov-report=xml

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        if: matrix.python-version == '3.11'
```

### Docker Build Pipeline

```yaml
name: Docker Build

on:
  push:
    branches: [main]
    tags: ['v*']

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=semver,pattern={{version}}
            type=sha

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

## GitLab CI Example

```yaml
stages:
  - lint
  - test
  - build
  - deploy

variables:
  NODE_VERSION: "20"

.node-cache:
  cache:
    key: ${CI_COMMIT_REF_SLUG}
    paths:
      - node_modules/

lint:
  stage: lint
  image: node:${NODE_VERSION}
  extends: .node-cache
  script:
    - npm ci
    - npm run lint

test:
  stage: test
  image: node:${NODE_VERSION}
  extends: .node-cache
  script:
    - npm ci
    - npm test -- --coverage
  coverage: '/All files[^|]*\|[^|]*\s+([\d\.]+)/'
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml

build:
  stage: build
  image: node:${NODE_VERSION}
  extends: .node-cache
  script:
    - npm ci
    - npm run build
  artifacts:
    paths:
      - dist/
    expire_in: 1 week

deploy-staging:
  stage: deploy
  environment:
    name: staging
    url: https://staging.example.com
  script:
    - echo "Deploying to staging..."
  only:
    - develop

deploy-production:
  stage: deploy
  environment:
    name: production
    url: https://example.com
  script:
    - echo "Deploying to production..."
  only:
    - main
  when: manual
```

## Optional Stages

### Security Scanning
```yaml
security:
  stage: test
  script:
    - npm audit --audit-level=high
    - npx snyk test
```

### Docker Build
```yaml
docker:
  stage: build
  image: docker:latest
  services:
    - docker:dind
  script:
    - docker build -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA .
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
```

### E2E Testing
```yaml
e2e:
  stage: test
  image: mcr.microsoft.com/playwright:latest
  script:
    - npm ci
    - npx playwright install
    - npm run test:e2e
```

## Deployment Integrations

| Platform | Integration |
|----------|-------------|
| **Vercel** | `vercel deploy --prod` |
| **Netlify** | `netlify deploy --prod` |
| **AWS** | `aws s3 sync`, `aws ecs update-service` |
| **Railway** | `railway up` |
| **Fly.io** | `flyctl deploy` |
| **Heroku** | `git push heroku main` |
| **Kubernetes** | `kubectl apply -f k8s/` |

## Best Practices

### Caching
- Cache dependencies (node_modules, pip cache, cargo registry)
- Use lock files for reproducible builds
- Leverage platform-specific caching (GHA cache, GitLab cache)

### Security
- Never commit secrets to pipelines
- Use platform secret management
- Run security scans (npm audit, Snyk, Trivy)
- Pin action/image versions

### Performance
- Run independent jobs in parallel
- Use matrix builds for multi-version testing
- Skip unnecessary steps on documentation changes
- Use shallow clones for large repos

### Reliability
- Set appropriate timeouts
- Add retry logic for flaky tests
- Use proper error handling
- Include status checks for PRs

## Related Commands

- `/test` - Run test suites
- `/lint` - Check code quality
- `/security-audit` - Security scanning
- `/api-docs` - Generate API documentation
