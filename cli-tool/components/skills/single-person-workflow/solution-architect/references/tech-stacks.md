# Technology Stack Templates

Complete technology stack configurations for common scenarios.

## Modern Web Full-Stack (Recommended)

**Best for**: Most web applications, SaaS products, content platforms

```yaml
Frontend:
  Framework: Next.js 15 + React 19
  Language: TypeScript
  UI: shadcn/ui + Tailwind CSS
  State: Zustand / Jotai
  Forms: React Hook Form + Zod
  
Backend:
  Runtime: Next.js API Routes / Node.js
  Framework: Express / Fastify
  Language: TypeScript
  ORM: Prisma / Drizzle ORM
  Validation: Zod
  
Database:
  Primary: PostgreSQL
  Cache: Redis (Upstash / Railway)
  Search: Typesense / MeiliSearch (optional)
  
Storage:
  Object: S3 / R2 / Supabase Storage
  
Services:
  Auth: NextAuth.js / Clerk / Supabase Auth
  Payments: Stripe / LemonSqueezy
  Email: Resend / SendGrid
  Queue: BullMQ + Redis / Inngest
  
Observability:
  Errors: Sentry
  Analytics: Vercel Analytics / PostHog
  Logs: Axiom / BetterStack
```

**Pros**: Unified stack, excellent DX, fast iteration, strong TypeScript support
**Cons**: Node.js performance limitations, not ideal for CPU-intensive tasks

## Traditional Enterprise Java Stack

**Best for**: Enterprise applications, large organizations, existing Java teams

```yaml
Backend:
  Framework: Spring Boot 3.x
  Language: Java 17 / 21
  Web: Spring MVC / Spring WebFlux
  Security: Spring Security + JWT
  
Data Access Layer Options:
  
  Option 1 - MyBatis Plus:
    Use: Lightweight, SQL control, flexible
    Best: Complex queries, performance-critical
    Config: MyBatis-Plus + MyBatis Dynamic SQL
    
  Option 2 - Spring Data JPA:
    Use: Standard JPA, high automation
    Best: Simple CRUD, rapid development
    Config: Hibernate + Spring Data JPA
    
  Option 3 - jOOQ:
    Use: Type-safe, SQL-first, code generation
    Best: High performance, complex SQL
    Config: jOOQ + HikariCP
    
  Option 4 - QueryDSL:
    Use: Type-safe queries, works with JPA/MyBatis
    Best: Type safety with existing ORM
    Config: QueryDSL + JPA or MyBatis
    
  Option 5 - Spring Data JDBC:
    Use: Lightweight, no complex mapping
    Best: Simpler than JPA, still Spring ecosystem
    Config: Spring Data JDBC
    
  Option 6 - JDBI:
    Use: Lightweight SQL mapping
    Best: Between MyBatis and raw JDBC
    Config: JDBI 3
    
  Option 7 - Exposed (Kotlin):
    Use: Kotlin DSL, type-safe
    Best: Kotlin projects
    Config: Exposed + Kotlin
    
  Recommended Combinations:
    - Simple CRUD → Spring Data JPA
    - Complex queries → MyBatis Plus
    - High performance → jOOQ + HikariCP
    - Type safety priority → jOOQ / QueryDSL
    - Lightweight → Spring Data JDBC / JDBI

Database:
  Primary: PostgreSQL / MySQL / Oracle
  Pool: HikariCP (default) / Druid (monitoring)
  Cache: Redis (Redisson / Lettuce)
  Queue: RabbitMQ / Kafka / RocketMQ
  Search: Elasticsearch / OpenSearch
  
Frontend:
  Framework: Vue 3 / React / Angular
  Build: Vite / Webpack
  UI: Element Plus / Ant Design / PrimeVue
  
Infrastructure:
  Container: Docker + Kubernetes / Docker Compose
  Monitor: Prometheus + Grafana + Spring Boot Actuator
  Logging: ELK Stack / Loki
  Tracing: SkyWalking / Zipkin / Jaeger
```

**Pros**: Enterprise-grade, mature ecosystem, strong type safety, excellent tooling
**Cons**: Verbose, slower iteration, steeper learning curve

## High-Performance Backend Services

**Best for**: Microservices, high-throughput APIs, system services

### Go Stack
```yaml
Language: Go 1.21+
Framework: Gin / Fiber / Echo
Database: PostgreSQL + pgx / sqlx
Cache: Redis (go-redis)
Queue: NATS / Kafka
Config: Viper
```

### Rust Stack
```yaml
Language: Rust
Framework: Axum / Actix-web
Database: PostgreSQL + sqlx
Cache: Redis
Queue: NATS / Kafka
Async: Tokio
```

**Pros**: Excellent performance, low resource usage, strong concurrency
**Cons**: Longer development time, smaller talent pool

## Mobile Cross-Platform

**Best for**: iOS + Android apps, startup MVPs

### React Native Stack
```yaml
Framework: React Native
Language: TypeScript
Navigation: React Navigation
State: Redux Toolkit / Zustand
UI: React Native Paper / NativeBase
Backend: Firebase / Supabase / Custom API
Push: Firebase Cloud Messaging
Analytics: Firebase Analytics / Mixpanel
```

### Flutter Stack
```yaml
Framework: Flutter
Language: Dart
State: Riverpod / BLoC
UI: Material Design / Cupertino
Backend: Firebase / Supabase / Custom API
Push: Firebase Cloud Messaging
Analytics: Firebase Analytics
```

**Pros**: Single codebase, native performance, fast development
**Cons**: Platform-specific features may require native modules

## Python Data/ML Stack

**Best for**: Data processing, ML applications, scientific computing

```yaml
Web Framework: FastAPI / Django
Language: Python 3.11+
Database: PostgreSQL + SQLAlchemy / asyncpg
Cache: Redis
Queue: Celery + Redis / RabbitMQ
ML: PyTorch / TensorFlow
Data: Pandas / NumPy / Polars
API: FastAPI + Pydantic
```

**Pros**: Rich ML/data ecosystem, rapid prototyping, extensive libraries
**Cons**: Performance limitations, deployment complexity

## Tech Stack Selection Decision Matrix

| Scenario | Recommended Stack | Rationale |
|----------|------------------|-----------|
| Web SaaS MVP | Next.js + Supabase | Fast iteration, low ops, good DX |
| Enterprise App | Spring Boot + PostgreSQL | Mature, enterprise support, scalable |
| High-traffic API | Go + PostgreSQL + Redis | Performance, concurrency, efficiency |
| Mobile App | React Native + Firebase | Cross-platform, rapid development |
| Data Platform | Python + FastAPI + PostgreSQL | Rich data/ML ecosystem |
| Real-time App | Node.js + WebSocket + Redis | Good async I/O, real-time support |
| Microservices | Go/Rust + gRPC + Kubernetes | Performance, resource efficient |

## When to Choose What

**Choose JavaScript/TypeScript (Node.js/Next.js) when**:
- Rapid iteration is priority
- Team is web-focused
- Need SSR/SSG for SEO
- Building modern web apps

**Choose Java (Spring Boot) when**:
- Enterprise environment
- Need mature ecosystem
- Team is Java-experienced
- Long-term stability priority

**Choose Go when**:
- Performance is critical
- Building microservices
- Need efficient resource usage
- Systems programming

**Choose Python when**:
- Data processing/ML heavy
- Rapid prototyping
- Scientific computing
- Rich library ecosystem needed

**Choose Rust when**:
- Maximum performance needed
- Safety is critical
- Systems-level programming
- Long-running services
