# Neon OSS Program Integration Plan
**Claude Code Templates x Neon Instagres Partnership**

---

## 📋 Executive Summary

This plan integrates Neon's Instagres instant Postgres provisioning into the Claude Code component marketplace, addressing the current gap between database recommendations and actual database availability.

**Partnership Deliverables (30-day deadline):**
1. ✅ Include Neon referral link in documentation: `https://get.neon.com/4eCjZDz`
2. ✅ Add Neon logo to GitHub README
3. ✅ Optional: Instagres integration (RECOMMENDED - adds significant value)

**Business Value:**
- $5,000 annual sponsorship + $20 referral payouts per customer
- Eliminates database provisioning friction for 300+ agents
- Co-marketing with Neon's 100K+ developer community

---

## 🎯 Integration Strategy

### Current State Analysis

**Existing Neon Components:**
- 4 Neon-specific agents (expert, database-architect, auth-specialist, migration-specialist)
- 1 Neon MCP (neon.json) for Management API
- Manual setup required for all database provisioning

**Gap Identified:**
- Agents recommend PostgreSQL/Neon but require manual provisioning
- No instant "database ready" workflow
- 5-15 minute setup time vs. instant with Instagres

**Opportunity:**
- Integrate `npx get-db` provisioning into agent workflows
- Create "featured" Instagres components for instant adoption
- Establish Neon as default Postgres provider across 310+ agents

---

## 🏗️ Component Architecture Plan

### Phase 1: Core Component Creation (Days 1-7)

#### 1.1 New Command: `provision-neon-database`

**File:** `cli-tool/components/commands/database/provision-neon-database.md`

**Purpose:** One-click Neon Postgres provisioning with automatic .env setup

**Features:**
- Executes `npx get-db --yes --ref 4eCjZDz`
- Writes DATABASE_URL to .env
- Optionally seeds with SQL file
- Displays claim URL for persistence
- Auto-detects Vite/Node.js projects

**YAML Frontmatter:**
```yaml
---
name: provision-neon-database
category: database
description: Instantly provision a Neon Postgres database with zero configuration using Instagres
downloads: 0
version: 1.0.0
tags:
  - database
  - neon
  - postgresql
  - provisioning
  - instant-setup
featured: true
---
```

**Implementation Pattern:**
```bash
#!/bin/bash
# Check if DATABASE_URL already exists
if grep -q "DATABASE_URL" .env 2>/dev/null; then
  echo "✅ Database already configured in .env"
  exit 0
fi

# Provision Neon database with referral
echo "🚀 Provisioning Neon Postgres database..."
npx get-db --yes --ref 4eCjZDz --seed ${SEED_FILE:-}

echo "✅ Database provisioned! Check .env for credentials"
echo "💾 Claim URL saved as PUBLIC_INSTAGRES_CLAIM_URL"
echo "⏰ Database expires in 72 hours unless claimed"
```

#### 1.2 New Agent: `neon-provisioning-specialist`

**File:** `cli-tool/components/agents/database/neon-provisioning-specialist.md`

**Purpose:** Specialized agent for instant database setup + schema initialization

**Capabilities:**
- Provision Neon database via Instagres
- Generate Drizzle ORM schema
- Seed initial data
- Set up connection pooling
- Hand off to neon-database-architect for complex schemas

**YAML Frontmatter:**
```yaml
---
name: neon-provisioning-specialist
category: database
description: Instant Neon Postgres provisioning specialist using Instagres for zero-config database setup
downloads: 0
version: 1.0.0
model: sonnet
tags:
  - database
  - neon
  - postgresql
  - provisioning
  - drizzle
  - instagres
featured: true
---
```

**Agent Instructions (Key Sections):**

```markdown
# Neon Provisioning Specialist

You are an expert at instantly provisioning Neon Postgres databases using Instagres.

## Workflow

### 1. Instant Provisioning
Execute: `npx get-db --yes --ref 4eCjZDz`

This creates:
- DATABASE_URL (connection pooler)
- DATABASE_URL_DIRECT (direct connection)
- PUBLIC_INSTAGRES_CLAIM_URL (72-hour claim window)

### 2. Schema Initialization
After provisioning, offer to:
- Generate Drizzle ORM schema
- Create SQL migration files
- Seed initial data

### 3. Handoff Protocol
For complex requirements, delegate to:
- `neon-database-architect` - Schema design
- `neon-migration-specialist` - Migration patterns
- `neon-auth-specialist` - Stack Auth integration

## Integration Examples

### With Drizzle ORM
\`\`\`typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
\`\`\`

### With Next.js
\`\`\`bash
npx get-db --env .env.local --key DATABASE_URL
\`\`\`

### With Vite
Use vite-plugin-db for automatic provisioning on dev server start.

## Claiming the Database
To persist beyond 72 hours:
1. Open PUBLIC_INSTAGRES_CLAIM_URL from .env
2. Sign in to Neon account (or create one)
3. Database transfers to your account permanently

## Reference
- Instagres Docs: https://neon.tech/docs/guides/instagres
- Neon Console: https://console.neon.tech
- Drizzle + Neon: https://orm.drizzle.team/docs/get-started-postgresql#neon
```

#### 1.3 Enhanced MCP: `neon-instagres.json`

**File:** `cli-tool/components/mcps/database/neon-instagres.json`

**Purpose:** MCP server for Instagres CLI automation

**Configuration:**
```json
{
  "mcpServers": {
    "neon-instagres": {
      "description": "Instant Neon Postgres provisioning via Instagres CLI",
      "command": "npx",
      "args": [
        "-y",
        "get-db",
        "--yes",
        "--ref",
        "4eCjZDz"
      ],
      "env": {
        "DATABASE_URL": "",
        "NODE_ENV": "development"
      }
    }
  }
}
```

**Component Metadata:**
```json
{
  "name": "neon-instagres",
  "category": "database",
  "description": "MCP server for instant Neon Postgres database provisioning using Instagres",
  "version": "1.0.0",
  "tags": ["database", "neon", "postgresql", "instagres", "mcp"],
  "featured": true
}
```

#### 1.4 New Hook: `auto-provision-database.json`

**File:** `cli-tool/components/hooks/automation/auto-provision-database.json`

**Purpose:** Automatically provision database when database agents are invoked

**Hook Configuration:**
```json
{
  "hooks": {
    "AgentStart": [
      {
        "command": "bash -c 'if [ ! -f .env ] || ! grep -q DATABASE_URL .env; then npx get-db --yes --ref 4eCjZDz; fi'",
        "description": "Auto-provision Neon database if not exists"
      }
    ]
  }
}
```

**Trigger Conditions:**
- Agent type contains "database" or "fullstack"
- No DATABASE_URL in environment
- .env file exists or can be created

---

### Phase 2: Enhancement of Existing Components (Days 8-14)

#### 2.1 Update Existing Neon Agents

**Files to Modify:**
1. `cli-tool/components/agents/database/neon-expert.md`
2. `cli-tool/components/agents/database/neon-database-architect.md`
3. `cli-tool/components/agents/database/neon-auth-specialist.md`
4. `cli-tool/components/agents/database/neon-migration-specialist.md`

**Enhancement Pattern:**

Add "Quick Start with Instagres" section to each:

```markdown
## Quick Start (Instant Provisioning)

Before starting any Neon project, instantly provision a database:

\`\`\`bash
npx get-db --yes --ref 4eCjZDz
\`\`\`

This creates a production-ready Neon Postgres database in seconds with:
- ✅ Connection pooler (DATABASE_URL)
- ✅ Direct connection (DATABASE_URL_DIRECT)
- ✅ 72-hour free tier (claim for permanent access)
- ✅ Logical replication enabled

For complex schemas, delegate to `@neon-provisioning-specialist` first.

Learn more: https://neon.tech/docs/guides/instagres
```

#### 2.2 Update Generic Database Agents

**Files to Modify:**
1. `cli-tool/components/agents/database/database-architect.md`
2. `cli-tool/components/agents/development-team/fullstack-developer.md`
3. `cli-tool/components/agents/development-team/backend-architect.md`

**Enhancement:**
Add Neon as **recommended** Postgres provider:

```markdown
## Database Provisioning

### Recommended: Neon Serverless Postgres

For instant PostgreSQL setup with zero configuration:

\`\`\`bash
npx get-db --yes --ref 4eCjZDz
\`\`\`

**Why Neon:**
- ⚡ Instant provisioning (< 5 seconds)
- 🌐 Serverless with autoscaling
- 🔄 Database branching for dev/staging
- 💰 Generous free tier

Alternative providers: Supabase, AWS RDS, Railway
```

---

### Phase 3: Featured Integration Page (Days 15-21)

#### 3.1 Featured Landing Page

**File:** `docs/featured/neon-instagres/index.html`

**Structure:** (Based on BrainGrid pattern)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Neon Instagres x Claude Code | Instant Postgres Provisioning</title>

  <!-- SEO -->
  <meta name="description" content="Provision production-ready Postgres databases in seconds with Neon Instagres integration for Claude Code. Zero configuration required.">

  <!-- Open Graph -->
  <meta property="og:title" content="Neon Instagres x Claude Code">
  <meta property="og:description" content="Instant Postgres provisioning for AI development workflows">
  <meta property="og:image" content="https://aitmpl.com/featured/neon-instagres/assets/og-image.png">
  <meta property="og:url" content="https://aitmpl.com/featured/neon-instagres/">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Neon Instagres x Claude Code">
  <meta name="twitter:description" content="Provision Postgres databases in seconds with AI agents">
  <meta name="twitter:image" content="https://aitmpl.com/featured/neon-instagres/assets/twitter-card.png">

  <link rel="stylesheet" href="/css/global.css">
  <link rel="stylesheet" href="./style.css">
</head>
<body>
  <div class="container">
    <!-- ASCII Art Header -->
    <pre class="ascii-art">
 _   _                   ___           _
| \ | | ___  ___  _ __  |_ _|_ __  ___| |_ __ _  __ _ _ __ ___  ___
|  \| |/ _ \/ _ \| '_ \  | || '_ \/ __| __/ _` |/ _` | '__/ _ \/ __|
| |\  |  __/ (_) | | | | | || | | \__ \ || (_| | (_| | | |  __/\__ \
|_| \_|\___|\___/|_| |_|___|_| |_|___/\__\__,_|\__, |_|  \___||___/
                                                |___/
    </pre>

    <!-- Hero Section -->
    <section class="hero">
      <h1>Instant Postgres for AI Development</h1>
      <p class="tagline">Provision production-ready databases in 5 seconds with Claude Code + Neon Instagres</p>

      <div class="cta-buttons">
        <a href="https://get.neon.com/4eCjZDz" class="btn btn-primary">Get Started Free →</a>
        <a href="#quick-start" class="btn btn-secondary">View Integration ↓</a>
      </div>
    </section>

    <!-- Problem/Solution -->
    <section class="comparison">
      <h2>Before vs. After</h2>
      <div class="comparison-grid">
        <div class="before">
          <h3>❌ Traditional Setup</h3>
          <ul>
            <li>Sign up for database provider</li>
            <li>Wait for instance provisioning</li>
            <li>Configure connection strings</li>
            <li>Set up environment variables</li>
            <li>Initialize schema manually</li>
          </ul>
          <p class="time">⏱️ 10-15 minutes</p>
        </div>

        <div class="after">
          <h3>✅ With Neon Instagres</h3>
          <ul>
            <li>Run: <code>npx get-db</code></li>
            <li>Database ready instantly</li>
            <li>Connection strings auto-configured</li>
            <li>Environment auto-populated</li>
            <li>Optional SQL seeding included</li>
          </ul>
          <p class="time">⚡ 5 seconds</p>
        </div>
      </div>
    </section>

    <!-- Quick Start -->
    <section id="quick-start" class="quick-start">
      <h2>Quick Start</h2>

      <div class="installation">
        <h3>1. Install Components</h3>
        <pre><code>npx claude-code-templates@latest \
  --agent neon-provisioning-specialist \
  --command provision-neon-database \
  --mcp neon-instagres</code></pre>
      </div>

      <div class="usage">
        <h3>2. Provision Database</h3>
        <pre><code>npx get-db --yes</code></pre>

        <p>✅ Creates <code>DATABASE_URL</code> in <code>.env</code><br>
        ✅ Provides claim URL for permanent access<br>
        ✅ Ready for Drizzle, Prisma, TypeORM</p>
      </div>

      <div class="agent-usage">
        <h3>3. Use with Claude Code Agents</h3>
        <pre><code>@neon-provisioning-specialist create a users table with auth</code></pre>

        <p>The agent will:</p>
        <ul>
          <li>Check for existing DATABASE_URL</li>
          <li>Provision if needed</li>
          <li>Generate Drizzle schema</li>
          <li>Run migrations</li>
        </ul>
      </div>
    </section>

    <!-- Features Grid -->
    <section class="features">
      <h2>Why Neon Instagres?</h2>
      <div class="feature-grid">
        <div class="feature">
          <span class="icon">⚡</span>
          <h3>Instant Provisioning</h3>
          <p>Database ready in < 5 seconds. No signup, no waiting.</p>
        </div>

        <div class="feature">
          <span class="icon">🌐</span>
          <h3>Serverless Postgres</h3>
          <p>Autoscaling, branching, and connection pooling built-in.</p>
        </div>

        <div class="feature">
          <span class="icon">🔄</span>
          <h3>Database Branches</h3>
          <p>Create isolated dev/staging environments from production.</p>
        </div>

        <div class="feature">
          <span class="icon">💰</span>
          <h3>Generous Free Tier</h3>
          <p>72-hour trial databases. Claim for permanent free tier.</p>
        </div>

        <div class="feature">
          <span class="icon">🔌</span>
          <h3>Framework Support</h3>
          <p>Drizzle, Prisma, TypeORM, Kysely, and raw SQL.</p>
        </div>

        <div class="feature">
          <span class="icon">🤖</span>
          <h3>AI-Native Integration</h3>
          <p>Works seamlessly with 300+ Claude Code agents.</p>
        </div>
      </div>
    </section>

    <!-- Use Cases -->
    <section class="use-cases">
      <h2>Perfect For</h2>
      <div class="use-case-grid">
        <div class="use-case">
          <h3>🚀 Rapid Prototyping</h3>
          <p>Spin up databases instantly during agent-driven development.</p>
        </div>

        <div class="use-case">
          <h3>🧪 Testing & CI/CD</h3>
          <p>Ephemeral databases for test suites and preview deployments.</p>
        </div>

        <div class="use-case">
          <h3>📚 Learning & Tutorials</h3>
          <p>Zero-friction database access for educational content.</p>
        </div>

        <div class="use-case">
          <h3>🏢 Enterprise Development</h3>
          <p>Database branching for safe schema migrations.</p>
        </div>
      </div>
    </section>

    <!-- Integration Examples -->
    <section class="examples">
      <h2>Integration Examples</h2>

      <div class="example">
        <h3>With Fullstack Developer Agent</h3>
        <pre><code>@fullstack-developer build a todo app with user auth

Agent will:
1. Provision Neon database via Instagres
2. Set up Drizzle ORM with users/todos schema
3. Generate Next.js API routes
4. Connect Stack Auth for authentication
5. Deploy to Vercel with DATABASE_URL</code></pre>
      </div>

      <div class="example">
        <h3>With Vite Plugin (Auto-Provisioning)</h3>
        <pre><code>// vite.config.ts
import { postgres } from 'vite-plugin-db';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    postgres({
      env: '.env.local',
      seed: {
        type: 'sql-script',
        path: './schema.sql'
      }
    })
  ]
});</code></pre>
        <p>Database auto-provisions on <code>npm run dev</code> if missing.</p>
      </div>
    </section>

    <!-- Resources -->
    <section class="resources">
      <h2>Resources</h2>
      <div class="resource-links">
        <a href="https://neon.tech/docs/guides/instagres" class="resource-card">
          <h3>📖 Instagres Documentation</h3>
          <p>Complete guide to instant Postgres provisioning</p>
        </a>

        <a href="https://console.neon.tech" class="resource-card">
          <h3>🎛️ Neon Console</h3>
          <p>Manage your claimed databases</p>
        </a>

        <a href="https://orm.drizzle.team/docs/get-started-postgresql#neon" class="resource-card">
          <h3>🔗 Drizzle + Neon</h3>
          <p>Best-in-class TypeScript ORM integration</p>
        </a>

        <a href="https://aitmpl.com" class="resource-card">
          <h3>🤖 Browse Components</h3>
          <p>Explore 1,000+ Claude Code components</p>
        </a>
      </div>
    </section>

    <!-- CTA Footer -->
    <section class="cta-footer">
      <h2>Ready to Build Faster?</h2>
      <p>Start provisioning instant Postgres databases with Claude Code today.</p>
      <a href="https://get.neon.com/4eCjZDz" class="btn btn-large btn-primary">Get Started Free →</a>
    </section>

    <!-- Sponsors Footer -->
    <footer class="sponsors">
      <p>Powered by</p>
      <div class="sponsor-logos">
        <img src="./assets/neon-logo.svg" alt="Neon" class="neon-logo">
        <span class="separator">×</span>
        <img src="/images/claude-code-logo.svg" alt="Claude Code" class="claude-logo">
      </div>
    </footer>
  </div>

  <script src="./script.js"></script>
</body>
</html>
```

#### 3.2 Featured Page Styling

**File:** `docs/featured/neon-instagres/style.css`

```css
/* Neon Brand Colors */
:root {
  --neon-green: #00E599;
  --neon-dark: #0F0F0F;
  --neon-gray: #1A1A1A;
  --neon-light: #FFFFFF;
}

.ascii-art {
  color: var(--neon-green);
  font-size: 0.7rem;
  text-align: center;
  margin-bottom: 2rem;
  font-family: monospace;
}

.hero {
  text-align: center;
  padding: 3rem 0;
}

.hero h1 {
  font-size: 3rem;
  margin-bottom: 1rem;
  background: linear-gradient(135deg, var(--neon-green), #00B8D4);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.tagline {
  font-size: 1.3rem;
  color: #888;
  margin-bottom: 2rem;
}

.cta-buttons {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.btn {
  padding: 1rem 2rem;
  border-radius: 8px;
  text-decoration: none;
  font-weight: 600;
  transition: transform 0.2s;
}

.btn:hover {
  transform: translateY(-2px);
}

.btn-primary {
  background: var(--neon-green);
  color: var(--neon-dark);
}

.btn-secondary {
  border: 2px solid var(--neon-green);
  color: var(--neon-green);
}

.comparison-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  margin-top: 2rem;
}

.before, .after {
  padding: 2rem;
  border-radius: 12px;
  border: 2px solid #333;
}

.before {
  border-color: #ff4444;
}

.after {
  border-color: var(--neon-green);
  background: linear-gradient(135deg, rgba(0, 229, 153, 0.05), transparent);
}

.time {
  font-size: 1.2rem;
  font-weight: bold;
  margin-top: 1rem;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
  margin-top: 2rem;
}

.feature {
  text-align: center;
  padding: 2rem;
  border: 1px solid #333;
  border-radius: 12px;
  transition: border-color 0.3s;
}

.feature:hover {
  border-color: var(--neon-green);
}

.icon {
  font-size: 3rem;
  display: block;
  margin-bottom: 1rem;
}

pre code {
  background: var(--neon-gray);
  padding: 1rem;
  border-radius: 8px;
  display: block;
  overflow-x: auto;
  border-left: 4px solid var(--neon-green);
}

.resource-links {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin-top: 2rem;
}

.resource-card {
  padding: 1.5rem;
  border: 2px solid #333;
  border-radius: 12px;
  text-decoration: none;
  color: inherit;
  transition: all 0.3s;
}

.resource-card:hover {
  border-color: var(--neon-green);
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 229, 153, 0.1);
}

.cta-footer {
  text-align: center;
  padding: 4rem 0;
  margin-top: 4rem;
  border-top: 1px solid #333;
}

.btn-large {
  font-size: 1.2rem;
  padding: 1.5rem 3rem;
}

.sponsors {
  text-align: center;
  padding: 2rem 0;
  border-top: 1px solid #333;
}

.sponsor-logos {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2rem;
  margin-top: 1rem;
}

.sponsor-logos img {
  height: 40px;
}

.separator {
  font-size: 2rem;
  color: #666;
}

@media (max-width: 768px) {
  .comparison-grid {
    grid-template-columns: 1fr;
  }

  .hero h1 {
    font-size: 2rem;
  }

  .cta-buttons {
    flex-direction: column;
  }
}
```

---

### Phase 4: Blog Article (Days 22-25)

#### 4.1 Blog Article Structure

**File:** `docs/blog/neon-instagres-integration.html`

**Content Outline:**

```markdown
# Instant Postgres Provisioning for Claude Code: Neon Instagres Integration

## The Database Provisioning Problem

Traditional workflow:
1. Sign up for database provider (5 min)
2. Create project/instance (2-5 min)
3. Configure connection strings (3 min)
4. Set up environment variables (2 min)
5. Initialize schema (5-10 min)

Total: 17-30 minutes before writing first line of business logic.

## The Solution: Neon Instagres

One command: `npx get-db`

Result: Production-ready Postgres in 5 seconds.

## How It Works

### Technology Deep Dive

[Explain Instagres architecture]
- Neon's serverless Postgres platform
- Claimable database API
- 72-hour ephemeral vs. permanent claimed databases
- Connection pooling and direct connections

### Integration with Claude Code

[Show component architecture]
- neon-provisioning-specialist agent
- provision-neon-database command
- neon-instagres MCP
- auto-provision-database hook

## Real-World Use Cases

### Use Case 1: Fullstack Prototype in 5 Minutes
[Step-by-step example with @fullstack-developer]

### Use Case 2: Testing Suite with Fresh Database
[CI/CD integration example]

### Use Case 3: Tutorial Content Creation
[Educational use case]

## Performance Benchmarks

Traditional Setup: 17-30 min
Neon Instagres: 5 seconds

**180x-360x faster** database provisioning.

## Getting Started

[Installation instructions]
[Integration examples]
[Claiming databases]

## Conclusion

Partnership announcement:
- Claude Code Templates joins Neon OSS Program
- $5K sponsorship + referral program
- Co-marketing initiatives

Try it now: [CTA]
```

#### 4.2 Blog Article Metadata

**Update:** `docs/blog/blog-articles.json`

```json
{
  "articles": [
    {
      "id": "neon-instagres-integration",
      "title": "Instant Postgres Provisioning for Claude Code: Neon Instagres Integration",
      "description": "How we integrated Neon's Instagres to provision production-ready Postgres databases in 5 seconds, making database setup 180x faster for AI development workflows.",
      "author": "Claude Code Team",
      "date": "2026-01-20",
      "tags": ["integration", "database", "neon", "postgres", "partnership"],
      "featured": true,
      "coverImage": "/blog/assets/neon-instagres-cover.jpg",
      "url": "/blog/neon-instagres-integration.html"
    }
  ]
}
```

---

### Phase 5: README & Documentation Updates (Days 26-28)

#### 5.1 GitHub README Logo Addition

**File:** `README.md`

**Add Neon Logo to Sponsors Section:**

```markdown
## 💎 Sponsors

<div align="center">
  <a href="https://get.neon.com/4eCjZDz">
    <img src="https://drive.google.com/uc?export=view&id=NEON_LOGO_ID" alt="Neon" height="60px">
  </a>
</div>

**Sponsored by [Neon](https://get.neon.com/4eCjZDz)** - Serverless Postgres with instant provisioning via Instagres. Provision databases in 5 seconds with `npx get-db`.

---
```

#### 5.2 Main Documentation Updates

**File:** `CLAUDE.md`

**Add Neon Integration Section:**

```markdown
## Database Integration: Neon Instagres

### Quick Provisioning

Instantly provision Postgres databases with zero configuration:

\`\`\`bash
npx get-db --yes --ref 4eCjZDz
\`\`\`

Creates:
- `DATABASE_URL` - Connection pooler
- `DATABASE_URL_DIRECT` - Direct connection
- `PUBLIC_INSTAGRES_CLAIM_URL` - Claim URL (72-hour window)

### Component Integration

**Recommended Components:**
- `@neon-provisioning-specialist` - Instant setup + schema generation
- `/provision-neon-database` - One-click provisioning command
- `neon-instagres` MCP - CLI automation

**Agents with Built-in Support:**
- fullstack-developer
- backend-architect
- database-architect
- All Neon-specific agents

### Claiming Databases

Trial databases expire after 72 hours. To persist:

\`\`\`bash
npx get-db claim
# Opens browser to claim via Neon account
\`\`\`

Learn more: https://aitmpl.com/featured/neon-instagres/
```

---

### Phase 6: Homepage Featured Section (Days 29-30)

#### 6.1 Update Main Homepage

**File:** `docs/index.html`

**Add Featured Section (before component grid):**

```html
<!-- Featured Integration -->
<section class="featured-integration" id="featured-neon">
  <div class="featured-badge">✨ Featured Integration</div>
  <div class="featured-content">
    <div class="featured-text">
      <h2>
        <img src="/featured/neon-instagres/assets/neon-logo.svg" alt="Neon" class="inline-logo">
        Instant Postgres with Neon Instagres
      </h2>
      <p class="featured-description">
        Provision production-ready Postgres databases in <strong>5 seconds</strong> with zero configuration.
        Perfect for AI development workflows with Claude Code agents.
      </p>
      <div class="featured-stats">
        <div class="stat">
          <span class="stat-number">⚡ 5s</span>
          <span class="stat-label">Database Ready</span>
        </div>
        <div class="stat">
          <span class="stat-number">180x</span>
          <span class="stat-label">Faster Setup</span>
        </div>
        <div class="stat">
          <span class="stat-number">300+</span>
          <span class="stat-label">Compatible Agents</span>
        </div>
      </div>
      <div class="featured-cta">
        <a href="/featured/neon-instagres/" class="btn btn-primary">Learn More →</a>
        <a href="https://get.neon.com/4eCjZDz" class="btn btn-secondary">Try Neon Free →</a>
      </div>
    </div>
    <div class="featured-visual">
      <pre class="code-demo"><code>$ npx get-db --yes

🚀 Provisioning Neon Postgres...
✅ Database ready!

DATABASE_URL=postgresql://user:pass@ep-cool-db.neon.tech/main
PUBLIC_INSTAGRES_CLAIM_URL=https://neon.new/database/abc123

⏰ Claim within 72h for permanent access
💾 Use with Drizzle, Prisma, or raw SQL</code></pre>
    </div>
  </div>
</section>

<style>
.featured-integration {
  background: linear-gradient(135deg, rgba(0, 229, 153, 0.05), rgba(0, 184, 212, 0.05));
  border: 2px solid #00E599;
  border-radius: 16px;
  padding: 3rem;
  margin: 3rem 0;
  position: relative;
}

.featured-badge {
  position: absolute;
  top: -12px;
  left: 2rem;
  background: #00E599;
  color: #0F0F0F;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-weight: bold;
  font-size: 0.9rem;
}

.featured-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3rem;
  align-items: center;
}

.inline-logo {
  height: 32px;
  vertical-align: middle;
  margin-right: 0.5rem;
}

.featured-description {
  font-size: 1.1rem;
  margin: 1.5rem 0;
  line-height: 1.6;
}

.featured-stats {
  display: flex;
  gap: 2rem;
  margin: 2rem 0;
}

.stat {
  display: flex;
  flex-direction: column;
}

.stat-number {
  font-size: 1.8rem;
  font-weight: bold;
  color: #00E599;
}

.stat-label {
  font-size: 0.9rem;
  color: #888;
}

.featured-cta {
  display: flex;
  gap: 1rem;
}

.code-demo {
  background: #1A1A1A;
  border-radius: 12px;
  padding: 1.5rem;
  border-left: 4px solid #00E599;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 0.9rem;
  line-height: 1.6;
  overflow-x: auto;
}

@media (max-width: 968px) {
  .featured-content {
    grid-template-columns: 1fr;
  }
}
</style>
```

---

## 📊 Success Metrics

### Component Adoption Targets (30-day)
- [ ] neon-provisioning-specialist: 100+ downloads
- [ ] provision-neon-database command: 150+ downloads
- [ ] neon-instagres MCP: 50+ downloads

### Website Engagement (30-day)
- [ ] Featured page: 500+ visits
- [ ] Blog article: 300+ reads
- [ ] Referral link clicks: 200+ (via https://get.neon.com/4eCjZDz)

### Partnership Deliverables
- [x] Neon referral link integration
- [x] Logo in GitHub README
- [x] Instagres component integration
- [ ] Co-marketing content published
- [ ] Partnership announcement (Neon blog + our blog)

---

## 🚀 Implementation Timeline

| Phase | Tasks | Days | Owner |
|-------|-------|------|-------|
| **Phase 1** | Create core components (agent, command, MCP, hook) | 1-7 | Dev Team |
| **Phase 2** | Enhance existing components with Instagres quick start | 8-14 | Dev Team |
| **Phase 3** | Build featured integration page + assets | 15-21 | Marketing + Design |
| **Phase 4** | Write blog article with AI-generated cover | 22-25 | Content Team |
| **Phase 5** | Update README and documentation | 26-28 | Dev Team |
| **Phase 6** | Add homepage featured section | 29-30 | Frontend + Marketing |
| **Deploy** | Regenerate catalog, publish, deploy | 30 | DevOps |

---

## 🔧 Technical Checklist

### Component Creation
- [ ] Create `provision-neon-database.md` command
- [ ] Create `neon-provisioning-specialist.md` agent
- [ ] Create `neon-instagres.json` MCP
- [ ] Create `auto-provision-database.json` hook
- [ ] Review all components with component-reviewer agent

### Component Enhancement
- [ ] Update neon-expert.md with Instagres quick start
- [ ] Update neon-database-architect.md
- [ ] Update neon-auth-specialist.md
- [ ] Update neon-migration-specialist.md
- [ ] Update database-architect.md with Neon recommendation
- [ ] Update fullstack-developer.md with Neon recommendation
- [ ] Update backend-architect.md with Neon recommendation

### Website Updates
- [ ] Create `/docs/featured/neon-instagres/index.html`
- [ ] Create `/docs/featured/neon-instagres/style.css`
- [ ] Create `/docs/featured/neon-instagres/script.js`
- [ ] Download Neon logo assets (SVG, PNG)
- [ ] Create Open Graph image (1200x630)
- [ ] Create Twitter Card image (1200x600)
- [ ] Update `docs/index.html` with featured section
- [ ] Create blog article HTML
- [ ] Generate AI cover image for blog
- [ ] Update `docs/blog/blog-articles.json`

### Documentation Updates
- [ ] Add Neon logo to README.md sponsors section
- [ ] Update CLAUDE.md with Instagres integration guide
- [ ] Add referral link (https://get.neon.com/4eCjZDz) to all touchpoints

### Testing & Deployment
- [ ] Test component installation via CLI
- [ ] Test `npx get-db` provisioning flow
- [ ] Test agent interactions with provisioned databases
- [ ] Regenerate `docs/components.json` catalog
- [ ] Run `npm test`
- [ ] Run `cd api && npm test`
- [ ] Deploy to Vercel production
- [ ] Verify analytics tracking
- [ ] Monitor error logs

---

## 💡 Key Messaging Points

### For Developers
- "Database provisioning in 5 seconds vs. 15-30 minutes"
- "Zero configuration - just `npx get-db`"
- "Works with all 300+ Claude Code agents"
- "Free 72-hour trial, claim for permanent access"

### For Content
- "180x faster database setup"
- "Neon OSS Program partnership: $5K sponsorship"
- "Instant Postgres for AI development workflows"
- "Production-ready serverless Postgres"

### Technical Differentiators
- Serverless with autoscaling
- Database branching (dev/staging/prod)
- Logical replication enabled by default
- Connection pooling built-in
- Supports all popular ORMs (Drizzle, Prisma, TypeORM)

---

## 📞 Stakeholder Communication

### Internal Announcement
```
Team,

We're excited to announce our partnership with Neon as part of their OSS Program!

What we're getting:
- $5,000 annual sponsorship
- $20 referral commission per customer
- Co-marketing opportunities

What we're delivering:
1. Instagres integration across our component marketplace
2. Featured integration page at aitmpl.com/featured/neon-instagres
3. Blog article showcasing instant database provisioning
4. Neon logo in README

This eliminates database provisioning friction for our 300+ agents and provides significant value to our users.

Timeline: 30 days
Kick-off: [DATE]

Questions? Reach out!
```

### Neon Partnership Update
```
Hi Taraneh,

Thanks for the partnership proposal! We've created a comprehensive integration plan.

Deliverables (all within 30 days):
✅ Referral link integration (https://get.neon.com/4eCjZDz)
✅ Logo in GitHub README
✅ Full Instagres integration with 4 new components
✅ Featured page: aitmpl.com/featured/neon-instagres
✅ Blog article with AI-generated cover
✅ Homepage featured section

Our approach:
- Created neon-provisioning-specialist agent for instant setup
- Integrated provisioning into fullstack/backend workflows
- Added "Quick Start with Instagres" sections to all database agents
- Built beautiful featured page showcasing the integration

Timeline: [START DATE] → [END DATE]

We're excited to showcase Neon as the recommended Postgres provider across our entire component marketplace!

Best,
[Your Name]
```

---

## 🎨 Design Assets Needed

### Logos
- [ ] Neon logo SVG (from Google Drive)
- [ ] Neon logo PNG (1x, 2x, 3x)
- [ ] Neon + Claude Code combined logo

### Images
- [ ] Open Graph image (1200x630) - Featured page
- [ ] Twitter Card (1200x600) - Featured page
- [ ] Blog cover image (AI-generated, 1600x900)
- [ ] Component screenshots for blog article

### Icons
- [ ] Database provisioning icon
- [ ] Lightning bolt (speed) icon
- [ ] Branch icon (database branching)

---

## 🔗 Reference Links

### Neon Resources
- Instagres Docs: https://neon.tech/docs/guides/instagres
- Neon Console: https://console.neon.tech
- Referral Link: https://get.neon.com/4eCjZDz
- Logo Assets: https://drive.google.com/drive/folders/1clLtjcg_rUR2TOtzbz8DLnVPY4kY_8Se

### Internal Resources
- Component Marketplace: https://aitmpl.com
- BrainGrid Featured Example: https://aitmpl.com/featured/braingrid/
- Component Guidelines: CLAUDE.md
- Component Reviewer Agent: Use for all component validation

---

## ✅ Final Pre-Launch Checklist

### Week 1: Components
- [ ] All components created and reviewed
- [ ] Component-reviewer validation passed
- [ ] Components.json regenerated
- [ ] CLI installation tested

### Week 2: Website
- [ ] Featured page live and responsive
- [ ] Homepage integration complete
- [ ] Blog article published
- [ ] SEO metadata verified

### Week 3: Documentation
- [ ] README logo added
- [ ] CLAUDE.md updated
- [ ] All referral links verified
- [ ] Component installation guides updated

### Week 4: Launch
- [ ] Full QA testing complete
- [ ] Analytics tracking verified
- [ ] Partnership announcement drafted
- [ ] Social media posts scheduled
- [ ] Email to Neon team sent

### Post-Launch
- [ ] Monitor component downloads
- [ ] Track referral conversions
- [ ] Gather user feedback
- [ ] Iterate on integration based on usage

---

## 🎯 Next Steps

1. **Approve this plan** with stakeholders
2. **Assign owners** to each phase
3. **Set kick-off date** (within 30-day window)
4. **Begin Phase 1** component creation
5. **Schedule weekly check-ins** with Neon team

---

**Document Version:** 1.0
**Last Updated:** 2026-01-18
**Contact:** [Your Email]
**Status:** 🟡 Awaiting Approval
