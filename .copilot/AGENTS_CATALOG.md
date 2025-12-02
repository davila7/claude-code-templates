# 🤖 Agents Catalog

<div align="center">

**Complete Guide to All 20 Specialized Agents**

[🏠 Home](../README.md) • [📘 Manual](../MANUAL.md) • [⚡ Quick Start](../QUICKSTART.md)

</div>

---

## 📑 Quick Navigation

**Development Agents**:
[Frontend](#-frontend-developer) • [Backend](#%EF%B8%8F-backend-architect) • [Mobile](#-mobile-developer) • [Fullstack](#-fullstack-developer)

**Infrastructure**:
[DevOps](#-devops-engineer) • [Infrastructure](#%EF%B8%8F-infrastructure-architect) • [Deployment](#-deployment-engineer)

**Data**:
[Database](#%EF%B8%8F-database-architect)

**Quality & Testing**:
[Test Engineer](#-test-engineer) • [Code Reviewer](#%EF%B8%8F-code-reviewer) • [Debugger](#-debugger) • [Error Detective](#-error-detective)

**Security & Compliance**:
[Security](#-security-specialist) • [Compliance](#-compliance-auditor)

**Performance**:
[Optimizer](#-performance-optimizer)

**AI/ML**:
[AI Engineer](#-ai-engineer) • [Prompt Engineer](#-prompt-engineer)

**Specialized**:
[MCP Expert](#-mcp-expert) • [CLI Designer](#-cli-ui-designer) • [Documentation](#-documentation-specialist)

---

## Development Agents

### 🎨 Frontend Developer

<table>
<tr>
<td><strong>Specialty</strong></td>
<td>React, Vue, Angular, Modern Web Development</td>
</tr>
<tr>
<td><strong>Priority</strong></td>
<td>⭐⭐⭐⭐⭐ (10/10)</td>
</tr>
<tr>
<td><strong>Auto-Activates On</strong></td>
<td>
<code>*.jsx</code>, <code>*.tsx</code>, <code>*.vue</code>, <code>components/**</code><br>
Keywords: react, vue, component, frontend, ui
</td>
</tr>
</table>

**🎯 Core Capabilities**:
- Component architecture & design patterns
- State management (Redux, Zustand, Pinia, Context API)
- Responsive design & mobile-first approach
- Accessibility (WCAG 2.1 AA compliance)
- Performance optimization (bundle size, lazy loading)
- Modern CSS (Tailwind, Styled Components, CSS Modules)

**🛠️ Tools & Technologies**:
```
React • Vue • Angular • TypeScript • Tailwind CSS • Redux • Zustand
styled-components • Webpack • Vite • Jest • React Testing Library
```

**📝 Example Usage**:
```bash
# Create responsive component
copilot "create a responsive Card component with TypeScript, hover effects, and loading states"

# State management
copilot "implement Zustand store for theme management with dark/light mode toggle"

# Accessibility
copilot "make this modal component WCAG 2.1 AA compliant with keyboard navigation"

# Performance
copilot "optimize React app bundle size using code splitting and lazy loading"
```

**💡 Best For**:
- Building UI components and layouts
- Implementing design systems
- State management setup
- Performance optimization
- Accessibility improvements

**🔗 Related Agents**: [fullstack-developer](#-fullstack-developer), [performance-optimizer](#-performance-optimizer)

---

### 🏗️ Backend Architect

<table>
<tr>
<td><strong>Specialty</strong></td>
<td>API Design, Microservices, System Architecture</td>
</tr>
<tr>
<td><strong>Priority</strong></td>
<td>⭐⭐⭐⭐⭐ (10/10)</td>
</tr>
<tr>
<td><strong>Auto-Activates On</strong></td>
<td>
<code>*.controller.js</code>, <code>*.service.js</code>, <code>api/**</code><br>
Keywords: api, backend, server, microservice
</td>
</tr>
</table>

**🎯 Core Capabilities**:
- RESTful & GraphQL API design
- Microservices architecture
- Database integration & ORM usage
- Authentication & authorization (JWT, OAuth2)
- Caching strategies (Redis, Memcached)
- Message queues & event-driven architecture

**🛠️ Tools & Technologies**:
```
Node.js • Express • NestJS • GraphQL • Prisma • TypeORM
PostgreSQL • MongoDB • Redis • RabbitMQ • Docker
```

**📝 Example Usage**:
```bash
# API design
copilot "design RESTful API for e-commerce with products, cart, and checkout"

# Microservices
copilot "create payment microservice with Stripe integration and webhook handling"

# Authentication
copilot "implement JWT authentication with refresh tokens and role-based access"

# Caching
copilot "add Redis caching layer for product catalog with TTL management"
```

**💡 Best For**:
- Designing scalable APIs
- Building microservices
- Database schema design
- Authentication systems
- Performance optimization

**🔗 Related Agents**: [database-architect](#%EF%B8%8F-database-architect), [security-specialist](#-security-specialist)

---

### 📱 Mobile Developer

<table>
<tr>
<td><strong>Specialty</strong></td>
<td>React Native, Flutter, iOS/Android Development</td>
</tr>
<tr>
<td><strong>Priority</strong></td>
<td>⭐⭐⭐⭐ (8/10)</td>
</tr>
<tr>
<td><strong>Auto-Activates On</strong></td>
<td>
<code>*.native.js</code>, <code>*.dart</code>, <code>ios/**</code>, <code>android/**</code><br>
Keywords: mobile, react native, flutter, ios, android
</td>
</tr>
</table>

**🎯 Core Capabilities**:
- Cross-platform app development
- Native module integration
- Offline-first architecture
- Push notifications
- In-app purchases
- Platform-specific optimizations

**🛠️ Tools & Technologies**:
```
React Native • Flutter • Expo • TypeScript • Firebase
AsyncStorage • Realm • React Navigation • Native Modules
```

**📝 Example Usage**:
```bash
# App creation
copilot "create React Native app with bottom tab navigation and authentication"

# Native features
copilot "implement camera capture with image compression and upload"

# Offline support
copilot "add offline-first data sync with background queue"

# Push notifications
copilot "setup Firebase Cloud Messaging with local notifications"
```

**💡 Best For**:
- Building cross-platform apps
- Native feature integration
- Mobile-specific UI/UX
- App store deployment

**🔗 Related Agents**: [frontend-developer](#-frontend-developer), [backend-architect](#%EF%B8%8F-backend-architect)

---

### 🔄 Fullstack Developer

<table>
<tr>
<td><strong>Specialty</strong></td>
<td>Next.js, Remix, End-to-End Development</td>
</tr>
<tr>
<td><strong>Priority</strong></td>
<td>⭐⭐⭐⭐⭐ (10/10)</td>
</tr>
<tr>
<td><strong>Auto-Activates On</strong></td>
<td>
<code>pages/**</code>, <code>app/**</code><br>
Keywords: fullstack, nextjs, remix, trpc, end-to-end
</td>
</tr>
</table>

**🎯 Core Capabilities**:
- Full-stack framework expertise (Next.js, Remix)
- Type-safe API development (tRPC)
- Server-side rendering & static generation
- End-to-end TypeScript
- Database to UI integration
- Authentication & authorization

**🛠️ Tools & Technologies**:
```
Next.js • Remix • tRPC • Prisma • TypeScript • Tailwind CSS
NextAuth • SWR • React Query • Vercel • Railway
```

**📝 Example Usage**:
```bash
# Full feature
copilot "create complete blog feature with CRUD operations, authentication, and comments"

# tRPC setup
copilot "setup tRPC with Next.js for type-safe API routes"

# SSR/SSG
copilot "implement ISR for product pages with 60-second revalidation"

# Authentication
copilot "add NextAuth with Google OAuth and database sessions"
```

**💡 Best For**:
- Building complete features
- Full-stack applications
- SEO-optimized websites
- Real-time features

**🔗 Related Agents**: [frontend-developer](#-frontend-developer), [backend-architect](#%EF%B8%8F-backend-architect)

---

## Infrastructure Agents

### 🚀 DevOps Engineer

<table>
<tr>
<td><strong>Specialty</strong></td>
<td>CI/CD, Containerization, Infrastructure Automation</td>
</tr>
<tr>
<td><strong>Priority</strong></td>
<td>⭐⭐⭐⭐ (9/10)</td>
</tr>
<tr>
<td><strong>Auto-Activates On</strong></td>
<td>
<code>Dockerfile</code>, <code>docker-compose.yml</code>, <code>.github/workflows/**</code><br>
Keywords: docker, kubernetes, ci/cd, pipeline
</td>
</tr>
</table>

**🎯 Core Capabilities**:
- CI/CD pipeline configuration
- Docker & Kubernetes orchestration
- Infrastructure as Code
- Monitoring & logging setup
- GitOps workflows
- Security scanning integration

**🛠️ Tools & Technologies**:
```
Docker • Kubernetes • GitHub Actions • GitLab CI • Terraform
Prometheus • Grafana • ELK Stack • ArgoCD • Helm
```

**📝 Example Usage**:
```bash
# CI/CD
copilot "create GitHub Actions workflow with test, build, and deploy stages"

# Docker
copilot "create multi-stage Dockerfile for Node.js app with minimal size"

# Kubernetes
copilot "setup Kubernetes deployment with HPA, health checks, and ingress"

# Monitoring
copilot "configure Prometheus and Grafana for application metrics"
```

**💡 Best For**:
- Pipeline automation
- Container orchestration
- Infrastructure monitoring
- Deployment automation

**🔗 Related Agents**: [infrastructure-architect](#%EF%B8%8F-infrastructure-architect), [deployment-engineer](#-deployment-engineer)

---

### 🏛️ Infrastructure Architect

<table>
<tr>
<td><strong>Specialty</strong></td>
<td>Cloud Architecture, IaC, System Design</td>
</tr>
<tr>
<td><strong>Priority</strong></td>
<td>⭐⭐⭐⭐ (9/10)</td>
</tr>
<tr>
<td><strong>Auto-Activates On</strong></td>
<td>
<code>*.tf</code>, <code>terraform/**</code>, <code>infrastructure/**</code><br>
Keywords: infrastructure, cloud, aws, terraform, iac
</td>
</tr>
</table>

**🎯 Core Capabilities**:
- Cloud architecture design (AWS, Azure, GCP)
- Infrastructure as Code (Terraform, Pulumi, CDK)
- Multi-region deployments
- Disaster recovery planning
- Cost optimization
- Network architecture

**🛠️ Tools & Technologies**:
```
Terraform • AWS • Azure • GCP • Pulumi • CloudFormation
VPC • Load Balancers • Auto Scaling • RDS • S3
```

**📝 Example Usage**:
```bash
# Cloud architecture
copilot "design AWS architecture for highly available web application"

# Terraform
copilot "create Terraform modules for VPC, ECS, and RDS"

# Multi-region
copilot "setup multi-region deployment with failover"

# Cost optimization
copilot "analyze and optimize AWS infrastructure costs"
```

**💡 Best For**:
- Cloud infrastructure design
- IaC implementation
- High availability systems
- Cost management

**🔗 Related Agents**: [devops-engineer](#-devops-engineer), [security-specialist](#-security-specialist)

---

### 📦 Deployment Engineer

<table>
<tr>
<td><strong>Specialty</strong></td>
<td>Production Deployments, Release Management</td>
</tr>
<tr>
<td><strong>Priority</strong></td>
<td>⭐⭐⭐⭐ (9/10)</td>
</tr>
<tr>
<td><strong>Auto-Activates On</strong></td>
<td>
<code>vercel.json</code>, <code>netlify.toml</code><br>
Keywords: deployment, release, canary, feature flag
</td>
</tr>
</table>

**🎯 Core Capabilities**:
- Blue-green deployments
- Canary releases
- Feature flag management
- Rollback strategies
- Zero-downtime deployments
- Health checks & monitoring

**🛠️ Tools & Technologies**:
```
Kubernetes • AWS ECS • Vercel • Netlify • LaunchDarkly
Unleash • Health Checks • Load Balancers • CDN
```

**📝 Example Usage**:
```bash
# Deployment strategy
copilot "setup canary deployment with gradual traffic shifting"

# Feature flags
copilot "implement feature flags with LaunchDarkly for A/B testing"

# Rollback
copilot "create automated rollback on health check failure"

# Zero-downtime
copilot "configure zero-downtime deployment for Kubernetes"
```

**💡 Best For**:
- Production releases
- Deployment strategies
- Feature rollouts
- Incident recovery

**🔗 Related Agents**: [devops-engineer](#-devops-engineer), [infrastructure-architect](#%EF%B8%8F-infrastructure-architect)

---

## Data Agents

### 🗄️ Database Architect

<table>
<tr>
<td><strong>Specialty</strong></td>
<td>Database Design, Query Optimization</td>
</tr>
<tr>
<td><strong>Priority</strong></td>
<td>⭐⭐⭐⭐ (9/10)</td>
</tr>
<tr>
<td><strong>Auto-Activates On</strong></td>
<td>
<code>*.sql</code>, <code>migrations/**</code>, <code>schema.prisma</code><br>
Keywords: database, sql, migration, schema, query
</td>
</tr>
</table>

**🎯 Core Capabilities**:
- Database schema design (normalized & denormalized)
- Query optimization & indexing
- Migration management
- Replication & sharding
- Full-text search
- Performance tuning

**🛠️ Tools & Technologies**:
```
PostgreSQL • MySQL • MongoDB • Prisma • TypeORM
Redis • Elasticsearch • Database Indexing • Query Optimization
```

**📝 Example Usage**:
```bash
# Schema design
copilot "design database schema for social media platform with posts, likes, and comments"

# Optimization
copilot "optimize this slow query with proper indexes"

# Migrations
copilot "create Prisma migration for adding user roles"

# Full-text search
copilot "implement full-text search with PostgreSQL tsvector"
```

**💡 Best For**:
- Schema design
- Query optimization
- Data modeling
- Migration strategy

**🔗 Related Agents**: [backend-architect](#%EF%B8%8F-backend-architect), [performance-optimizer](#-performance-optimizer)

---

## Quality & Testing Agents

### ✅ Test Engineer

<table>
<tr>
<td><strong>Specialty</strong></td>
<td>Automated Testing, Quality Assurance</td>
</tr>
<tr>
<td><strong>Priority</strong></td>
<td>⭐⭐⭐⭐ (8/10)</td>
</tr>
<tr>
<td><strong>Auto-Activates On</strong></td>
<td>
<code>*.test.js</code>, <code>*.spec.js</code>, <code>tests/**</code><br>
Keywords: test, testing, coverage, e2e
</td>
</tr>
</table>

**🎯 Core Capabilities**:
- Unit testing (Jest, Vitest)
- Integration testing
- E2E testing (Playwright, Cypress)
- Test coverage analysis
- TDD/BDD practices
- Performance testing

**🛠️ Tools & Technologies**:
```
Jest • Vitest • Playwright • Cypress • Testing Library
Supertest • k6 • Artillery • Code Coverage • Mocking
```

**📝 Example Usage**:
```bash
# Unit tests
copilot "write comprehensive unit tests for UserService with 90% coverage"

# E2E tests
copilot "create Playwright tests for checkout flow with error scenarios"

# Integration tests
copilot "write integration tests for REST API endpoints"

# Performance tests
copilot "create k6 load test for 10,000 concurrent users"
```

**💡 Best For**:
- Test automation
- Coverage improvement
- E2E testing
- Quality assurance

**🔗 Related Agents**: [code-reviewer](#%EF%B8%8F-code-reviewer), [debugger](#-debugger)

---

### 👁️ Code Reviewer

<table>
<tr>
<td><strong>Specialty</strong></td>
<td>Code Quality, Best Practices</td>
</tr>
<tr>
<td><strong>Priority</strong></td>
<td>⭐⭐⭐⭐ (8/10)</td>
</tr>
<tr>
<td><strong>Auto-Activates On</strong></td>
<td>
Keywords: review, pr, code quality, refactor
</td>
</tr>
</table>

**🎯 Core Capabilities**:
- Code quality analysis
- SOLID principles enforcement
- Anti-pattern detection
- Refactoring suggestions
- Performance analysis
- Security review

**🛠️ Tools & Technologies**:
```
ESLint • Prettier • SonarQube • Code Complexity Analysis
Security Scanning • Refactoring Tools
```

**📝 Example Usage**:
```bash
# Code review
copilot "review this pull request for code quality and best practices"

# Refactoring
copilot "suggest refactoring for this 500-line function"

# Performance
copilot "analyze code for performance bottlenecks"

# Security
copilot "review code for security vulnerabilities"
```

**💡 Best For**:
- PR reviews
- Code quality checks
- Refactoring guidance
- Best practice enforcement

**🔗 Related Agents**: [security-specialist](#-security-specialist), [test-engineer](#-test-engineer)

---

### 🐛 Debugger

<table>
<tr>
<td><strong>Specialty</strong></td>
<td>Bug Investigation, Problem Resolution</td>
</tr>
<tr>
<td><strong>Priority</strong></td>
<td>⭐⭐⭐⭐⭐ (9/10)</td>
</tr>
<tr>
<td><strong>Auto-Activates On</strong></td>
<td>
Keywords: debug, error, bug, fix, crash, issue
</td>
</tr>
</table>

**🎯 Core Capabilities**:
- Systematic debugging
- Stack trace analysis
- Memory leak detection
- Race condition identification
- Performance profiling
- Root cause analysis

**🛠️ Tools & Technologies**:
```
Chrome DevTools • Node Debugger • Memory Profilers
Log Analysis • Stack Trace Parsing • Performance Monitoring
```

**📝 Example Usage**:
```bash
# Debug issue
copilot "debug why users getting 500 error on login"

# Memory leak
copilot "find memory leak in Node.js application"

# Race condition
copilot "debug intermittent test failures in async code"

# Performance
copilot "debug slow React component rendering"
```

**💡 Best For**:
- Bug investigation
- Performance debugging
- Error analysis
- Production issues

**🔗 Related Agents**: [error-detective](#-error-detective), [performance-optimizer](#-performance-optimizer)

---

### 🔍 Error Detective

<table>
<tr>
<td><strong>Specialty</strong></td>
<td>Error Handling, Monitoring</td>
</tr>
<tr>
<td><strong>Priority</strong></td>
<td>⭐⭐⭐⭐⭐ (9/10)</td>
</tr>
<tr>
<td><strong>Auto-Activates On</strong></td>
<td>
Keywords: error handling, exception, monitoring, sentry
</td>
</tr>
</table>

**🎯 Core Capabilities**:
- Error handling implementation
- Error monitoring setup (Sentry, Rollbar)
- Error boundaries (React)
- Retry logic & circuit breakers
- Error logging & alerting
- Error pattern analysis

**🛠️ Tools & Technologies**:
```
Sentry • Rollbar • LogRocket • Error Boundaries
Retry Mechanisms • Circuit Breakers • Monitoring
```

**📝 Example Usage**:
```bash
# Error monitoring
copilot "setup Sentry for error tracking with source maps"

# Error handling
copilot "implement comprehensive error boundaries in React app"

# Retry logic
copilot "add exponential backoff retry for API calls"

# Alerting
copilot "configure error rate alerting with thresholds"
```

**💡 Best For**:
- Error monitoring
- Exception handling
- Production reliability
- Alert management

**🔗 Related Agents**: [debugger](#-debugger), [devops-engineer](#-devops-engineer)

---

## Security & Compliance

### 🔒 Security Specialist

<table>
<tr>
<td><strong>Specialty</strong></td>
<td>Application Security, OWASP Top 10</td>
</tr>
<tr>
<td><strong>Priority</strong></td>
<td>⭐⭐⭐⭐⭐ (10/10) - Always Active</td>
</tr>
<tr>
<td><strong>Auto-Activates On</strong></td>
<td>
Keywords: security, vulnerability, auth, owasp<br>
<strong>Always active in background</strong>
</td>
</tr>
</table>

**🎯 Core Capabilities**:
- OWASP Top 10 vulnerability detection
- Security audit & penetration testing
- Authentication/authorization implementation
- Input validation & sanitization
- Dependency vulnerability scanning
- Security headers & CSP

**🛠️ Tools & Technologies**:
```
OWASP ZAP • Snyk • npm audit • Helmet • bcrypt • JWT
Rate Limiting • CORS • CSP • Security Headers
```

**📝 Example Usage**:
```bash
# Security audit
copilot "audit application for OWASP Top 10 vulnerabilities"

# Fix vulnerabilities
copilot "fix SQL injection in user search endpoint"

# Authentication
copilot "implement secure JWT authentication with refresh tokens"

# Rate limiting
copilot "add rate limiting to prevent brute force attacks"
```

**💡 Best For**:
- Security audits
- Vulnerability fixes
- Secure authentication
- Compliance requirements

**🔗 Related Agents**: [compliance-auditor](#-compliance-auditor), [backend-architect](#%EF%B8%8F-backend-architect)

---

### 📋 Compliance Auditor

<table>
<tr>
<td><strong>Specialty</strong></td>
<td>GDPR, HIPAA, SOC2 Compliance</td>
</tr>
<tr>
<td><strong>Priority</strong></td>
<td>⭐⭐⭐⭐ (8/10)</td>
</tr>
<tr>
<td><strong>Auto-Activates On</strong></td>
<td>
Keywords: compliance, gdpr, hipaa, privacy, audit
</td>
</tr>
</table>

**🎯 Core Capabilities**:
- GDPR compliance implementation
- Data privacy & protection
- Audit logging
- Consent management
- Data retention policies
- Right to be forgotten

**🛠️ Tools & Technologies**:
```
GDPR Tools • Audit Logging • Consent Management
Data Encryption • Access Controls • Compliance Reports
```

**📝 Example Usage**:
```bash
# GDPR compliance
copilot "implement GDPR-compliant user data export and deletion"

# Audit logging
copilot "setup audit trail for all user data access"

# Consent
copilot "create cookie consent management with preferences"

# Data retention
copilot "implement 30-day data retention policy"
```

**💡 Best For**:
- Regulatory compliance
- Data privacy
- Audit requirements
- Legal compliance

**🔗 Related Agents**: [security-specialist](#-security-specialist), [documentation-specialist](#-documentation-specialist)

---

## Performance

### ⚡ Performance Optimizer

<table>
<tr>
<td><strong>Specialty</strong></td>
<td>Speed, Caching, Web Vitals</td>
</tr>
<tr>
<td><strong>Priority</strong></td>
<td>⭐⭐⭐ (7/10)</td>
</tr>
<tr>
<td><strong>Auto-Activates On</strong></td>
<td>
Keywords: performance, optimization, slow, cache
</td>
</tr>
</table>

**🎯 Core Capabilities**:
- Frontend optimization (bundle, lazy loading)
- Backend optimization (caching, queries)
- Core Web Vitals improvement
- Database query optimization
- CDN configuration
- Image optimization

**🛠️ Tools & Technologies**:
```
Webpack • Vite • Redis • CDN • Lighthouse • Web Vitals
Image Optimization • Code Splitting • Caching Strategies
```

**📝 Example Usage**:
```bash
# Frontend
copilot "optimize bundle size and improve Largest Contentful Paint"

# Backend
copilot "add Redis caching for expensive database queries"

# Database
copilot "optimize slow PostgreSQL query with proper indexes"

# Images
copilot "implement responsive images with WebP and lazy loading"
```

**💡 Best For**:
- Performance tuning
- Speed optimization
- Cache implementation
- Web Vitals improvement

**🔗 Related Agents**: [frontend-developer](#-frontend-developer), [database-architect](#%EF%B8%8F-database-architect)

---

## AI/ML Agents

### 🤖 AI Engineer

<table>
<tr>
<td><strong>Specialty</strong></td>
<td>LLMs, RAG, Machine Learning</td>
</tr>
<tr>
<td><strong>Priority</strong></td>
<td>⭐⭐⭐⭐ (8/10)</td>
</tr>
<tr>
<td><strong>Auto-Activates On</strong></td>
<td>
<code>*llm*.js</code>, <code>*ai*.js</code>, <code>ai/**</code><br>
Keywords: ai, ml, llm, rag, embedding
</td>
</tr>
</table>

**🎯 Core Capabilities**:
- LLM integration (OpenAI, Anthropic)
- RAG (Retrieval Augmented Generation)
- Vector databases
- ML pipeline development
- Model fine-tuning
- AI API integration

**🛠️ Tools & Technologies**:
```
OpenAI • Anthropic Claude • Pinecone • Weaviate • LangChain
TensorFlow • PyTorch • Hugging Face • Vector DBs
```

**📝 Example Usage**:
```bash
# LLM integration
copilot "integrate OpenAI GPT-4 with streaming responses"

# RAG system
copilot "create RAG system with Pinecone for document Q&A"

# Embeddings
copilot "implement semantic search with OpenAI embeddings"

# Chatbot
copilot "build chatbot with conversation history and context"
```

**💡 Best For**:
- AI feature development
- LLM integration
- RAG systems
- Semantic search

**🔗 Related Agents**: [prompt-engineer](#-prompt-engineer), [backend-architect](#%EF%B8%8F-backend-architect)

---

### 💬 Prompt Engineer

<table>
<tr>
<td><strong>Specialty</strong></td>
<td>Prompt Design, LLM Optimization</td>
</tr>
<tr>
<td><strong>Priority</strong></td>
<td>⭐⭐⭐ (7/10)</td>
</tr>
<tr>
<td><strong>Auto-Activates On</strong></td>
<td>
<code>prompts/**</code>, <code>*.prompt.md</code><br>
Keywords: prompt, llm, few-shot, chain-of-thought
</td>
</tr>
</table>

**🎯 Core Capabilities**:
- Effective prompt design
- Few-shot learning
- Chain-of-thought prompting
- Structured output generation
- Prompt templates
- Cost optimization

**🛠️ Tools & Technologies**:
```
Prompt Engineering • Few-shot Learning • Chain-of-Thought
Structured Outputs • JSON Schemas • Token Optimization
```

**📝 Example Usage**:
```bash
# Prompt design
copilot "create effective prompt for extracting structured data from text"

# Few-shot learning
copilot "design few-shot prompt for sentiment analysis"

# Structured output
copilot "create prompt with JSON schema for consistent responses"

# Optimization
copilot "optimize prompt to reduce token usage by 50%"
```

**💡 Best For**:
- Prompt optimization
- LLM integration
- Structured outputs
- Cost reduction

**🔗 Related Agents**: [ai-engineer](#-ai-engineer)

---

## Specialized Agents

### 🔌 MCP Expert

<table>
<tr>
<td><strong>Specialty</strong></td>
<td>Model Context Protocol Development</td>
</tr>
<tr>
<td><strong>Priority</strong></td>
<td>⭐⭐⭐ (7/10)</td>
</tr>
<tr>
<td><strong>Auto-Activates On</strong></td>
<td>
<code>*.mcp.js</code>, <code>mcp/**</code><br>
Keywords: mcp, model context protocol, integration
</td>
</tr>
</table>

**🎯 Core Capabilities**:
- MCP server development
- Tool definition
- Resource management
- Protocol implementation
- External service integration
- Type-safe implementations

**🛠️ Tools & Technologies**:
```
TypeScript • MCP Protocol • Tool Definitions
Resource Management • API Integration
```

**📝 Example Usage**:
```bash
# MCP server
copilot "create MCP server for Stripe payment integration"

# Tool definition
copilot "define MCP tools for file system operations"

# Integration
copilot "build MCP integration for PostgreSQL database"

# Testing
copilot "create MCP protocol compliance tests"
```

**💡 Best For**:
- MCP server development
- External integrations
- Tool creation
- Protocol implementation

**🔗 Related Agents**: [backend-architect](#%EF%B8%8F-backend-architect)

---

### 💻 CLI UI Designer

<table>
<tr>
<td><strong>Specialty</strong></td>
<td>Terminal UI, CLI Tools</td>
</tr>
<tr>
<td><strong>Priority</strong></td>
<td>⭐⭐⭐ (7/10)</td>
</tr>
<tr>
<td><strong>Auto-Activates On</strong></td>
<td>
<code>bin/**</code>, <code>cli/**</code><br>
Keywords: cli, command line, terminal
</td>
</tr>
</table>

**🎯 Core Capabilities**:
- CLI tool development
- Interactive prompts
- Progress indicators
- Colored output
- Argument parsing
- Help documentation

**🛠️ Tools & Technologies**:
```
Commander • Inquirer • Chalk • Ora • Boxen
Yargs • CLI-Table • Terminal UI
```

**📝 Example Usage**:
```bash
# CLI tool
copilot "create CLI tool with interactive prompts and spinners"

# Arguments
copilot "implement argument parsing with flags and options"

# Progress
copilot "add progress bar for long-running operations"

# Help
copilot "generate comprehensive help documentation"
```

**💡 Best For**:
- CLI tool development
- Developer tools
- Automation scripts
- Terminal interfaces

**🔗 Related Agents**: [devops-engineer](#-devops-engineer)

---

### 📚 Documentation Specialist

<table>
<tr>
<td><strong>Specialty</strong></td>
<td>Technical Writing, API Documentation</td>
</tr>
<tr>
<td><strong>Priority</strong></td>
<td>⭐⭐⭐ (6/10)</td>
</tr>
<tr>
<td><strong>Auto-Activates On</strong></td>
<td>
<code>*.md</code>, <code>docs/**</code><br>
Keywords: documentation, docs, readme, api docs
</td>
</tr>
</table>

**🎯 Core Capabilities**:
- Technical documentation
- API documentation (OpenAPI/Swagger)
- README creation
- Code comments (JSDoc/TSDoc)
- Documentation sites
- Examples & tutorials

**🛠️ Tools & Technologies**:
```
Markdown • JSDoc • TSDoc • OpenAPI • Swagger
Docusaurus • VitePress • Storybook
```

**📝 Example Usage**:
```bash
# API docs
copilot "generate OpenAPI specification for REST API"

# README
copilot "create comprehensive README with examples and badges"

# Code comments
copilot "add JSDoc comments to all public functions"

# Documentation site
copilot "setup Docusaurus documentation site"
```

**💡 Best For**:
- API documentation
- README files
- Code documentation
- User guides

**🔗 Related Agents**: [code-reviewer](#%EF%B8%8F-code-reviewer)

---

## 🎯 Agent Comparison Matrix

| Agent | Priority | Auto-Activate | Best For | Complexity |
|:------|:--------:|:-------------:|:---------|:----------:|
| Frontend Developer | ⭐⭐⭐⭐⭐ | ✅ | UI/UX, Components | Medium |
| Backend Architect | ⭐⭐⭐⭐⭐ | ✅ | APIs, Services | High |
| Mobile Developer | ⭐⭐⭐⭐ | ✅ | Mobile Apps | Medium |
| Fullstack Developer | ⭐⭐⭐⭐⭐ | ✅ | Complete Features | High |
| DevOps Engineer | ⭐⭐⭐⭐ | ✅ | CI/CD, Containers | High |
| Infrastructure Architect | ⭐⭐⭐⭐ | ✅ | Cloud, IaC | Very High |
| Deployment Engineer | ⭐⭐⭐⭐ | ✅ | Releases | Medium |
| Database Architect | ⭐⭐⭐⭐ | ✅ | DB Design, Queries | High |
| Test Engineer | ⭐⭐⭐⭐ | ✅ | Testing, QA | Medium |
| Code Reviewer | ⭐⭐⭐⭐ | ⚠️ | Quality, Reviews | Low |
| Debugger | ⭐⭐⭐⭐⭐ | ✅ | Bug Fixes | Medium |
| Error Detective | ⭐⭐⭐⭐⭐ | ✅ | Error Handling | Medium |
| Security Specialist | ⭐⭐⭐⭐⭐ | ✅ Always | Security, OWASP | High |
| Compliance Auditor | ⭐⭐⭐⭐ | ⚠️ | GDPR, Compliance | Medium |
| Performance Optimizer | ⭐⭐⭐ | ⚠️ | Speed, Optimization | Medium |
| AI Engineer | ⭐⭐⭐⭐ | ✅ | LLMs, RAG | High |
| Prompt Engineer | ⭐⭐⭐ | ⚠️ | Prompts | Low |
| MCP Expert | ⭐⭐⭐ | ✅ | MCP Development | Medium |
| CLI UI Designer | ⭐⭐⭐ | ✅ | CLI Tools | Low |
| Documentation Specialist | ⭐⭐⭐ | ✅ | Docs, READMEs | Low |

**Legend**:
- ✅ Auto-activates based on triggers
- ⚠️ Keyword-based activation
- Complexity: Low (simple tasks) → Very High (complex architecture)

---

## 🚀 Quick Start with Agents

### Choose Your Agent

```bash
# Let system auto-select
copilot "your request here"

# Manual selection
copilot --agent=agent-name "your request"

# Use workflow (multiple agents)
copilot --workflow=workflow-name "your request"
```

### Configuration

All agents are configured in:
- **`.copilot/agents/`** - Individual agent definitions
- **`.copilot/config.json`** - Global settings & preferences
- **`.copilot/triggers.json`** - Auto-activation rules
- **`.copilot/workflows.json`** - Multi-agent workflows

---

<div align="center">

**[⬆ Back to Top](#-agents-catalog)**

**Need Help?** Check out:
- [📘 Complete Manual](../MANUAL.md)
- [⚡ Quick Start Guide](../QUICKSTART.md)
- [🏠 Project Home](../README.md)

**Made with ❤️ by developers, for developers**

---

**Desenvolvido por RLuf** | 🌐 [https://fcc.rogerluft.com.br](https://fcc.rogerluft.com.br)

</div>
