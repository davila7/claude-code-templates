# ⚡ Quick Start Guide

<div align="center">

**Copy-Paste Ready Examples**

Get started in 60 seconds!

[🏠 Home](./README.md) • [📘 Full Manual](./MANUAL.md) • [🤖 Agent Catalog](./.copilot/AGENTS_CATALOG.md)

</div>

---

## 🎯 5 Common Scenarios

### 1️⃣ Build a Complete Feature

**Scenario**: Create a user authentication system

```bash
copilot "create a complete user authentication system with:
- JWT token authentication
- Password hashing with bcrypt
- Login and registration endpoints
- Input validation
- Error handling
- Unit tests"
```

<details>
<summary>📦 Expected Output</summary>

**Agents Activated**:
- 🏗️ backend-architect
- 🗄️ database-architect
- 🔒 security-specialist
- ✅ test-engineer

**Files Created**:
```
src/
├── controllers/
│   └── AuthController.ts
├── models/
│   └── User.ts
├── routes/
│   └── auth.ts
├── middleware/
│   ├── auth.ts
│   └── validation.ts
├── services/
│   └── AuthService.ts
└── __tests__/
    └── auth.test.ts
```

**Key Features**:
- ✅ Secure JWT implementation
- ✅ Password hashing (bcrypt)
- ✅ Input validation (express-validator)
- ✅ Rate limiting
- ✅ Error handling
- ✅ 95% test coverage

</details>

---

### 2️⃣ Fix a Production Bug

**Scenario**: Debug login failures

```bash
copilot "Users are getting 'Invalid credentials' error even with correct password.
Error logs show:
Error: Invalid credentials
    at AuthService.login (auth.service.ts:45)
    at AuthController.handleLogin (auth.controller.ts:23)

Investigate and fix this issue."
```

<details>
<summary>🔍 Expected Output</summary>

**Agents Activated**:
- 🐛 debugger
- 🔍 error-detective
- 🔒 security-specialist

**Analysis**:
```
Root Cause Identified:
❌ Password comparison using strict equality (===) instead of bcrypt.compare()
❌ No error logging for failed comparisons
❌ Timing attack vulnerability

Fix Applied:
✅ Replaced === with bcrypt.compare()
✅ Added comprehensive error logging
✅ Implemented constant-time comparison
✅ Added rate limiting
✅ Added monitoring alerts

Test Coverage:
✅ Unit tests for password comparison
✅ Integration tests for login flow
✅ Security tests for timing attacks
```

**Fixed Code**:
```typescript
// Before (BROKEN)
if (user.password === password) {
  return generateToken(user);
}

// After (FIXED)
const isValid = await bcrypt.compare(password, user.passwordHash);
if (!isValid) {
  logger.warn('Invalid login attempt', { userId: user.id });
  return null;
}
return generateToken(user);
```

</details>

---

### 3️⃣ Optimize Performance

**Scenario**: App is slow, needs optimization

```bash
copilot "My React application is slow. Current issues:
- Initial load time: 8 seconds
- Bundle size: 5MB
- Lighthouse score: 45/100
- Largest Contentful Paint: 6.5s

Optimize for production."
```

<details>
<summary>⚡ Expected Output</summary>

**Agents Activated**:
- ⚡ performance-optimizer
- 🎨 frontend-developer
- 🏗️ backend-architect

**Optimization Plan**:

**Frontend Optimizations**:
```javascript
// 1. Code Splitting
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Profile = lazy(() => import('./pages/Profile'));

// 2. Bundle Optimization
// webpack.config.js
module.exports = {
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          priority: 10
        }
      }
    }
  }
};

// 3. Image Optimization
<Image
  src="/hero.jpg"
  alt="Hero"
  width={800}
  height={600}
  loading="lazy"
  placeholder="blur"
/>

// 4. Memoization
const MemoizedComponent = React.memo(({ data }) => {
  return <ExpensiveComponent data={data} />;
});
```

**Backend Optimizations**:
```javascript
// 1. Redis Caching
const cachedData = await redis.get(`user:${userId}`);
if (cachedData) return JSON.parse(cachedData);

// 2. Query Optimization
// Before: N+1 queries
const users = await User.findAll();
for (const user of users) {
  user.posts = await Post.findAll({ where: { userId: user.id } });
}

// After: Single query with joins
const users = await User.findAll({
  include: [{ model: Post }]
});

// 3. Compression
app.use(compression());

// 4. CDN for Static Assets
<script src="https://cdn.example.com/bundle.js"></script>
```

**Results**:
- ✅ Initial load: 8s → 1.2s
- ✅ Bundle size: 5MB → 450KB
- ✅ Lighthouse: 45 → 95
- ✅ LCP: 6.5s → 1.1s

</details>

---

### 4️⃣ Security Audit

**Scenario**: Pre-deployment security check

```bash
copilot --workflow=security-audit "Audit my application for:
- OWASP Top 10 vulnerabilities
- Authentication/authorization issues
- Data exposure risks
- Dependency vulnerabilities
- GDPR compliance"
```

<details>
<summary>🔒 Expected Output</summary>

**Agents Activated**:
- 🔒 security-specialist
- 🏗️ backend-architect
- 🎨 frontend-developer
- 📋 compliance-auditor

**Security Report**:

**Critical Issues Found** (Must Fix):
```
❌ SQL Injection in user search endpoint
   Location: src/controllers/UserController.ts:45
   Risk: High
   Fix: Use parameterized queries

❌ XSS vulnerability in comment rendering
   Location: src/components/Comment.tsx:23
   Risk: High
   Fix: Sanitize user input with DOMPurify

❌ Secrets in source code
   Location: src/config/database.ts:12
   Risk: Critical
   Fix: Move to environment variables
```

**High Priority Issues**:
```
⚠️  Weak password requirements
   Fix: Enforce min 12 chars, special characters

⚠️  No rate limiting on login endpoint
   Fix: Implement express-rate-limit

⚠️  CORS allows all origins
   Fix: Whitelist specific domains
```

**Fixes Applied**:
```javascript
// 1. SQL Injection Fix
// Before
const query = `SELECT * FROM users WHERE name='${userInput}'`;

// After
const query = 'SELECT * FROM users WHERE name = ?';
db.query(query, [userInput]);

// 2. XSS Protection
import DOMPurify from 'dompurify';
const sanitized = DOMPurify.sanitize(userComment);

// 3. Secrets Management
// .env
DATABASE_URL=postgresql://user:pass@localhost:5432/db

// code
const dbUrl = process.env.DATABASE_URL;

// 4. Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5
});
app.use('/api/auth', limiter);

// 5. CORS Configuration
app.use(cors({
  origin: ['https://myapp.com', 'https://www.myapp.com']
}));
```

**Compliance Check**:
```
✅ GDPR: User consent implemented
✅ Data retention: 30-day deletion policy
✅ Audit logging: All actions tracked
✅ Data export: User data download available
✅ Right to deletion: Account deletion implemented
```

</details>

---

### 5️⃣ Setup CI/CD Pipeline

**Scenario**: Deploy to production with automation

```bash
copilot --workflow=deployment-pipeline "Setup complete CI/CD pipeline for:
- Node.js backend
- React frontend
- PostgreSQL database
- Deploy to AWS
- Include automated tests, security scans, and monitoring"
```

<details>
<summary>🚀 Expected Output</summary>

**Agents Activated**:
- 🚀 devops-engineer
- ✅ test-engineer
- 🔒 security-specialist
- 📦 deployment-engineer
- 🏛️ infrastructure-architect

**Pipeline Created**:

**.github/workflows/deploy.yml**:
```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Run tests
        run: npm test -- --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run Snyk security scan
        run: npx snyk test

      - name: OWASP dependency check
        run: npm audit

      - name: Trivy vulnerability scan
        uses: aquasecurity/trivy-action@master

  build:
    needs: [test, security]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Build Docker image
        run: docker build -t myapp:${{ github.sha }} .

      - name: Push to ECR
        run: |
          aws ecr get-login-password | docker login --username AWS --password-stdin
          docker push myapp:${{ github.sha }}

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to ECS
        run: |
          aws ecs update-service \
            --cluster production \
            --service myapp \
            --force-new-deployment

      - name: Wait for deployment
        run: aws ecs wait services-stable --cluster production --services myapp

      - name: Run smoke tests
        run: npm run test:smoke

  notify:
    needs: deploy
    runs-on: ubuntu-latest
    steps:
      - name: Slack notification
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Deployment completed!'
```

**Monitoring Setup**:
```javascript
// Prometheus metrics
const prometheus = require('prom-client');
const register = new prometheus.Registry();

prometheus.collectDefaultMetrics({ register });

const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code']
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: Date.now()
  });
});
```

**Infrastructure as Code** (Terraform):
```hcl
# main.tf
provider "aws" {
  region = "us-east-1"
}

resource "aws_ecs_cluster" "main" {
  name = "production-cluster"
}

resource "aws_ecs_service" "app" {
  name            = "myapp"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = 3

  load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_name   = "myapp"
    container_port   = 3000
  }
}

resource "aws_cloudwatch_log_group" "app" {
  name              = "/ecs/myapp"
  retention_in_days = 30
}
```

**Results**:
- ✅ Automated testing on every push
- ✅ Security scans integrated
- ✅ Zero-downtime deployments
- ✅ Rollback capability
- ✅ Monitoring and alerting
- ✅ Infrastructure as code

</details>

---

## 🎨 More Quick Examples

### Frontend Development

```bash
# Create responsive component
copilot "create a responsive navbar with mobile menu, dark mode toggle, and search bar"

# State management
copilot "implement Zustand store for shopping cart with add, remove, and update quantity"

# Accessibility
copilot "make this form WCAG 2.1 AA compliant with proper ARIA labels"
```

### Backend Development

```bash
# API design
copilot "design RESTful API for blog with posts, comments, and categories"

# Database optimization
copilot "optimize this slow query: SELECT * FROM users JOIN orders ON users.id = orders.user_id WHERE orders.created_at > '2024-01-01'"

# Microservices
copilot "create microservice for email notifications with RabbitMQ queue"
```

### Testing

```bash
# Unit tests
copilot "write comprehensive unit tests for UserService class with Jest"

# E2E tests
copilot "create Playwright tests for login flow including error cases"

# Load testing
copilot "create k6 load test script for API with 1000 concurrent users"
```

### DevOps

```bash
# Docker
copilot "create multi-stage Dockerfile for Node.js app with minimal image size"

# Kubernetes
copilot "create Kubernetes deployment with 3 replicas, health checks, and HPA"

# Monitoring
copilot "setup Prometheus and Grafana for Node.js application monitoring"
```

### AI/ML Integration

```bash
# LLM integration
copilot "integrate OpenAI GPT-4 API with streaming responses and error handling"

# RAG system
copilot "create RAG system with Pinecone vector database for document Q&A"

# Prompt engineering
copilot "create few-shot prompt template for extracting structured data from text"
```

---

## 📋 Command Cheatsheet

| Task | Command |
|:-----|:--------|
| **Auto-select agent** | `copilot "your request"` |
| **Manual agent** | `copilot --agent=agent-name "request"` |
| **Run workflow** | `copilot --workflow=workflow-name "request"` |
| **List agents** | `ls .copilot/agents/` |
| **View config** | `cat .copilot/config.json` |
| **Check triggers** | `cat .copilot/triggers.json` |
| **View workflows** | `cat .copilot/workflows.json` |

---

## 🎯 Tips for Best Results

### ✅ DO:
- Be specific about requirements
- Mention technology stack
- Include error messages/logs
- Specify expected behavior
- Use workflows for complex tasks

### ❌ DON'T:
- Be vague ("make it better")
- Omit important context
- Skip error details
- Request too much at once
- Ignore agent suggestions

---

## 🚀 Next Steps

1. **Read the Manual**: [MANUAL.md](./MANUAL.md) for comprehensive guide
2. **Browse Agents**: [AGENTS_CATALOG.md](./.copilot/AGENTS_CATALOG.md) for all 20 agents
3. **Customize**: Edit `.copilot/config.json` to match your stack
4. **Create Workflows**: Add custom workflows in `.copilot/workflows.json`
5. **Share**: Commit `.copilot/` to git and share with your team

---

<div align="center">

**Ready to build amazing things?** 🚀

**[📖 Read Full Manual](./MANUAL.md)** • **[🤖 Browse All Agents](./.copilot/AGENTS_CATALOG.md)** • **[🏠 Back Home](./README.md)**

**Made with ❤️ for developers**

</div>
