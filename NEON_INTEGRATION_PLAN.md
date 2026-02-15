# Neon OSS Program Integration Plan (Simplified)
**Claude Code Templates x Neon Instagres Partnership**

Version: 2.0 (Simplified)
Date: 2026-01-18
Status: 🟢 Ready for Implementation

---

## 📋 Executive Summary

**Approach:** Create **Complete Neon Template** featuring a new auto-activating Skill that integrates seamlessly with **9 existing Neon components**.

**Partnership Deliverables (30-day deadline):**
1. ✅ Neon referral link integration: `https://get.neon.com/4eCjZDz`
2. ✅ Neon logo in GitHub README
3. ✅ **NEW** Neon Instagres Skill (instant provisioning entry point)
4. ✅ Featured template page showcasing complete ecosystem
5. ✅ Blog article: Complete template walkthrough + partnership

**Complete Template (9 Components):**
- 🆕 **1 NEW Skill** - `neon-instagres` (auto-provisioning)
- ✅ **5 Existing Agents** - Expert specialists for schema, auth, migrations, optimization
- ✅ **1 Existing MCP** - Neon Management API integration
- ✅ **2 Existing Settings** - Statusline monitoring tools

**Business Value:**
- $5,000 annual sponsorship + $20 referral commissions
- Complete Neon ecosystem (provisioning → production optimization)
- Co-marketing with Neon's developer community
- Neon as recommended Postgres provider across Claude Code

---

## 🎯 Integration Strategy

### The Challenge
- Users don't know about existing Neon components (5 agents, 1 MCP, 2 settings)
- No easy way to get started with Neon instantly
- Components exist but lack cohesive entry point
- Database provisioning still requires manual setup

### New Approach (Integrated)
- ✅ **1 Skill** that auto-activates (neon-instagres)
- ✅ Integrates with **5 existing Neon agents**
- ✅ Works with **1 existing Neon MCP**
- ✅ Includes **2 statusline settings**
- ✅ Single install: `--skill database/neon-instagres`
- ✅ Complete template for Neon ecosystem

### Existing Neon Components

**Agents (5):**
- `neon-expert` - General Neon consultant and coordinator
- `neon-database-architect` - Schema design with Drizzle ORM
- `neon-auth-specialist` - Stack Auth & Neon Auth integration
- `neon-migration-specialist` - Database migration patterns
- `neon-optimization-analyzer` - Query optimization and performance

**MCP (1):**
- `neon` - Neon Management API integration

**Settings (2):**
- `neon-database-dev` - Statusline for development metrics
- `neon-database-resources` - Statusline for resource monitoring

### Integration Strategy

The **neon-instagres Skill** becomes the **entry point** for instant provisioning, then delegates to existing agents for specialized tasks:

```
User: "Setup a Neon database with auth"
  ↓
neon-instagres Skill activates
  ↓
Provisions database (npx get-db)
  ↓
Delegates to neon-auth-specialist for auth setup
```

### How Skills Work Magic
Skills are **model-invoked**: Claude automatically activates them based on context. When a user mentions "database", "postgres", "setup database", etc., Claude loads the Neon Instagres Skill and provisions a database instantly.

**Zero friction = Maximum adoption**

---

## 🏗️ Implementation Plan

### Complete Neon Template

| Component | Type | Status | Purpose |
|-----------|------|--------|---------|
| `neon-instagres` | **Skill** | 🆕 NEW | Auto-provisioning entry point |
| `neon-expert` | Agent | ✅ Existing | General Neon consultant |
| `neon-database-architect` | Agent | ✅ Existing | Schema design with Drizzle |
| `neon-auth-specialist` | Agent | ✅ Existing | Auth integration (Stack Auth) |
| `neon-migration-specialist` | Agent | ✅ Existing | Migration patterns |
| `neon-optimization-analyzer` | Agent | ✅ Existing | Query optimization |
| `neon` | MCP | ✅ Existing | Neon Management API |
| `neon-database-dev` | Setting | ✅ Existing | Dev metrics statusline |
| `neon-database-resources` | Setting | ✅ Existing | Resource monitoring statusline |

### Marketing & Documentation

| Deliverable | Type | Purpose |
|-------------|------|---------|
| Featured Page | Marketing | Complete Neon template showcase |
| Blog Article | Content | Full template walkthrough + partnership |
| README Logo | Documentation | Neon sponsor visibility |
| Homepage Banner | Marketing | Featured integration callout |

---

## 🚀 Phase 1: Core Skill (Days 1-5)

### Create the Neon Instagres Skill

**Location:** `cli-tool/components/skills/neon-instagres/SKILL.md`

**Installation:**
```bash
npx claude-code-templates@latest --skill database/neon-instagres
```

**Auto-Activation Triggers:**
- User mentions: "database", "postgres", "postgresql", "SQL", "Drizzle", "Prisma"
- Commands like: "setup database", "create database", "need a database"
- Framework contexts: Next.js, Vite, Express, SvelteKit, Remix
- When building: fullstack apps, APIs, backends

**What the Skill Does:**
1. Detects when database is needed
2. Checks if `DATABASE_URL` exists in `.env`
3. If not, runs: `npx get-db --yes --ref 4eCjZDz`
4. Provisions Neon Postgres in 5 seconds
5. Guides user through ORM setup (Drizzle, Prisma, etc.)
6. Reminds about 72-hour claim window

**Key Features:**
- ⚡ Instant provisioning (5 seconds)
- 🔄 Framework-specific instructions (Next.js, Vite, Express)
- 🛠️ ORM integration guides (Drizzle, Prisma, TypeORM, Kysely)
- 📦 Seeding support (`--seed schema.sql`)
- 🔐 Security best practices (environment variables)
- 💾 Claiming instructions for permanent access

**Complete Skill Content:**

````markdown
---
name: neon-instagres
description: Instantly provision production-ready Postgres databases with Neon Instagres. Use when setting up databases, when users mention PostgreSQL/Postgres, database setup, or need a development database. Works with Drizzle, Prisma, raw SQL.
allowed-tools: Read, Write, Bash, Grep, Glob
model: sonnet
user-invocable: true
---

# Neon Instagres - Instant Postgres Provisioning

You are an expert at provisioning instant, production-ready PostgreSQL databases using Neon's Instagres service.

## Core Command

```bash
npx get-db --yes --ref 4eCjZDz
```

This provisions a Neon Postgres database in **5 seconds** and creates:
- `DATABASE_URL` - Connection pooler (for app queries)
- `DATABASE_URL_DIRECT` - Direct connection (for migrations)
- `PUBLIC_INSTAGRES_CLAIM_URL` - Claim URL (72-hour window)

## Workflow

### 1. Check Existing Database
```bash
cat .env 2>/dev/null | grep DATABASE_URL
```

If found, ask user if they want to use existing or create new.

### 2. Provision Database

For new database:
```bash
npx get-db --yes --ref 4eCjZDz
```

**Common Options:**
- `--env .env.local` - Custom env file (Next.js, Remix)
- `--seed schema.sql` - Seed with initial data
- `--key DB_URL` - Custom variable name

### 3. Confirm Success

Tell the user:
```
✅ Neon Postgres database provisioned!

📁 Connection details in .env:
   DATABASE_URL - Use in your app
   DATABASE_URL_DIRECT - Use for migrations
   PUBLIC_INSTAGRES_CLAIM_URL - Claim within 72h

⚡ Ready for: Drizzle, Prisma, TypeORM, Kysely, raw SQL

⏰ IMPORTANT: Database expires in 72 hours.
   To claim: npx get-db claim
```

## Framework Integration

### Next.js
```bash
npx get-db --env .env.local --yes --ref 4eCjZDz
```

### Vite / SvelteKit
Option 1: Manual
```bash
npx get-db --yes --ref 4eCjZDz
```

Option 2: Auto-provisioning with vite-plugin-db
```typescript
// vite.config.ts
import { postgres } from 'vite-plugin-db';

export default defineConfig({
  plugins: [postgres()]
});
```

### Express / Node.js
```bash
npx get-db --yes --ref 4eCjZDz
```

Then load with dotenv:
```javascript
import 'dotenv/config';
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL);
```

## ORM Setup

### Drizzle (Recommended)
```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! }
});
```

```typescript
// src/db/index.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const client = postgres(process.env.DATABASE_URL!);
export const db = drizzle(client);
```

### Prisma
```bash
npx prisma init
# DATABASE_URL already set by get-db
npx prisma db push
```

### TypeORM
```typescript
import { DataSource } from 'typeorm';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: ['src/entity/*.ts'],
  synchronize: true
});
```

## Seeding

```bash
npx get-db --seed ./schema.sql --yes --ref 4eCjZDz
```

Example schema.sql:
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO users (email) VALUES ('demo@example.com');
```

## Claiming (Make Permanent)

**Option 1: CLI**
```bash
npx get-db claim
```

**Option 2: Manual**
1. Copy `PUBLIC_INSTAGRES_CLAIM_URL` from .env
2. Open in browser
3. Sign in to Neon (or create account)
4. Database becomes permanent

**After claiming:**
- No expiration
- Included in Neon Free Tier (0.5 GB)
- Can use database branching (dev/staging/prod)

## Best Practices

**Connection Pooling:**
- Use `DATABASE_URL` (pooler) for app queries
- Use `DATABASE_URL_DIRECT` for migrations/admin
- Prevents connection exhaustion

**Environment Security:**
- Never commit `.env` to git
- Add `.env` to `.gitignore`
- Use `.env.example` with placeholders

**Database Branching:**
- After claiming, create branches for dev/staging
- Test migrations safely before production

## Troubleshooting

**"npx get-db not found"**
- Ensure Node.js 18+ installed
- Check internet connection

**"Connection refused"**
- Use `DATABASE_URL` (pooler), not `_DIRECT`
- Add `?sslmode=require` if needed

**Database expired**
- Provision new: `npx get-db --yes --ref 4eCjZDz`
- Remember to claim databases you want to keep

## Resources

- 📖 [Instagres Docs](https://neon.tech/docs/guides/instagres)
- 🎛️ [Neon Console](https://console.neon.tech)
- 🚀 [Get Started](https://get.neon.com/4eCjZDz)

## Key Reminders

- **Always use `--ref 4eCjZDz`** for referral tracking
- **Remind about 72h expiration** and claiming
- **DATABASE_URL contains credentials** - keep .env private
- **Logical replication enabled** by default
````

---

## 🎨 Phase 2: Featured Page (Days 6-12)

### Create Featured Integration Page

**Location:** `docs/featured/neon-instagres/`

**Files:**
- `index.html` - Main landing page
- `style.css` - Neon-themed styling
- `assets/` - Logos and images

**Key Sections:**

1. **Hero Section**
   - "Instant Postgres for AI Development"
   - CTA: "Get Started Free" → `https://get.neon.com/4eCjZDz`
   - Terminal demo showing `npx get-db`

2. **Before/After Comparison**
   - Traditional setup: 10-15 minutes
   - With Instagres: 5 seconds
   - **180x faster**

3. **Quick Start**
   ```bash
   # Install Skill
   npx claude-code-templates@latest --skill database/neon-instagres

   # Ask Claude to setup database
   "I need a Postgres database for my Next.js app"

   # Claude automatically provisions with Instagres
   ```

4. **Features Grid**
   - ⚡ Instant provisioning (< 5s)
   - 🌐 Serverless Postgres
   - 🔄 Database branching
   - 💰 Generous free tier
   - 🔌 All ORMs supported
   - 🤖 AI-native integration

5. **Use Cases**
   - 🚀 Rapid prototyping
   - 🧪 Testing & CI/CD
   - 📚 Learning & tutorials
   - 🏢 Enterprise dev workflows

6. **Complete Template Components**

   **🆕 Instant Provisioning:**
   - `neon-instagres` Skill - Auto-activating database provisioning

   **✅ Expert Agents:**
   - `neon-expert` - Orchestrates Neon workflows
   - `neon-database-architect` - Schema design with Drizzle
   - `neon-auth-specialist` - Auth integration (Stack Auth)
   - `neon-migration-specialist` - Migration patterns
   - `neon-optimization-analyzer` - Query optimization

   **✅ Management & Monitoring:**
   - `neon` MCP - Neon Management API
   - `neon-database-dev` - Dev metrics statusline
   - `neon-database-resources` - Resource monitoring

   **Installation:**
   ```bash
   # Quick Start (Skill only)
   npx claude-code-templates@latest --skill database/neon-instagres

   # Full Template (all 9 components)
   npx claude-code-templates@latest \
     --skill database/neon-instagres \
     --agent database/neon-expert \
     --agent database/neon-database-architect \
     --agent database/neon-auth-specialist \
     --agent data-ai/neon-migration-specialist \
     --agent data-ai/neon-optimization-analyzer \
     --mcp database/neon \
     --setting statusline/neon-database-dev \
     --setting statusline/neon-database-resources \
     --yes
   ```

7. **Workflow Examples**
   - **Fullstack App**: Skill provisions → architect designs schema → auth specialist adds auth
   - **Production Migration**: Migration specialist creates safe migration → branching tests → optimization review
   - **Performance Tuning**: Optimization analyzer identifies bottlenecks → MCP monitors resources → implements fixes

8. **Resources**
   - Link to Instagres docs
   - Neon Console
   - Drizzle + Neon guide
   - Component marketplace
   - Template documentation

**Design:**
- Neon brand colors: `#00E599` (green), `#0F0F0F` (dark)
- ASCII art header (Neon Instagres logo)
- Code demos with terminal styling
- Responsive grid layout
- SEO optimized (Open Graph, Twitter cards)

---

## 📝 Phase 3: Blog Article (Days 13-18)

### Create Complete Template Article

**Location:** `docs/blog/neon-complete-template-integration.html`

**Title:** "Complete Neon Template for Claude Code: Instant Provisioning + Expert Agents"

**Outline:**

1. **Introduction: Neon OSS Program Partnership**
   - Announcing partnership with Neon
   - The complete Neon ecosystem for Claude Code
   - From instant provisioning to production optimization

2. **The Database Setup Problem**
   - Traditional workflow: 15-30 minutes
   - Manual configuration, trial and error
   - Fragmented tools and knowledge

3. **The Complete Solution: Neon Template**

   **3.1 Instant Provisioning (New Skill)**
   - `neon-instagres` Skill: Auto-activating database provisioning
   - `npx get-db --ref 4eCjZDz` - 5 seconds to production-ready Postgres
   - Claimable databases architecture

   **3.2 Expert Agents (Existing)**
   - `neon-expert` - Orchestrates complex Neon workflows
   - `neon-database-architect` - Schema design with Drizzle ORM
   - `neon-auth-specialist` - Stack Auth & Neon Auth integration
   - `neon-migration-specialist` - Safe migration patterns
   - `neon-optimization-analyzer` - Query performance tuning

   **3.3 Management API (Existing MCP)**
   - `neon` MCP - Programmatic Neon control
   - Project management, branch creation, metrics

   **3.4 Development Tools (Existing Settings)**
   - `neon-database-dev` - Real-time dev metrics in statusline
   - `neon-database-resources` - Resource monitoring

4. **Complete Workflow Examples**

   **Example 1: Fullstack App from Zero**
   ```bash
   # User: "Build a todo app with auth using Neon"

   # Claude automatically:
   # 1. neon-instagres Skill provisions database (5s)
   # 2. neon-database-architect generates Drizzle schema
   # 3. neon-auth-specialist sets up Stack Auth
   # 4. Creates Next.js app with API routes
   ```

   **Example 2: Production Migration**
   ```bash
   # User: "Migrate our users table to add email verification"

   # Claude automatically:
   # 1. neon-migration-specialist creates safe migration
   # 2. Uses Neon branching to test migration
   # 3. neon-optimization-analyzer reviews performance impact
   # 4. Executes migration with rollback plan
   ```

   **Example 3: Performance Optimization**
   ```bash
   # User: "My queries are slow, help optimize"

   # Claude automatically:
   # 1. neon-optimization-analyzer analyzes query patterns
   # 2. Recommends indexes and schema changes
   # 3. Uses neon MCP to check resource usage
   # 4. Implements optimizations with benchmarks
   ```

5. **Template Installation**

   **Quick Start (Skill Only):**
   ```bash
   npx claude-code-templates@latest --skill database/neon-instagres
   ```

   **Full Template (All Components):**
   ```bash
   npx claude-code-templates@latest \
     --skill database/neon-instagres \
     --agent database/neon-expert \
     --agent database/neon-database-architect \
     --agent database/neon-auth-specialist \
     --agent data-ai/neon-migration-specialist \
     --agent data-ai/neon-optimization-analyzer \
     --mcp database/neon \
     --setting statusline/neon-database-dev \
     --setting statusline/neon-database-resources \
     --yes
   ```

6. **Real-World Use Cases**
   - **Rapid Prototyping**: Instant databases + expert schema design
   - **Testing & CI/CD**: Ephemeral databases with automated migrations
   - **Education**: Zero-friction learning with best practices built-in
   - **Enterprise Production**: Branching + optimization + monitoring

7. **Performance Benchmarks**
   - **Provisioning**: Traditional 17-30 min → Neon 5 seconds (**180x-360x faster**)
   - **Schema Design**: Manual trial → Expert agent guidance
   - **Migration Safety**: Risky production changes → Branching + testing
   - **Optimization**: Guesswork → Data-driven analysis

8. **Partnership Details**
   - $5K annual sponsorship + referral program
   - Co-marketing with Neon's developer community
   - Neon as recommended Postgres provider across Claude Code
   - Complete template maintained and updated

9. **Component Deep Dives**

   **9.1 neon-instagres Skill**
   - Auto-activation triggers
   - Framework integration (Next.js, Vite, Express)
   - ORM support (Drizzle, Prisma, TypeORM)

   **9.2 Agent Ecosystem**
   - How agents delegate to each other
   - Specialization vs. orchestration
   - Custom workflow examples

   **9.3 MCP Integration**
   - Programmatic Neon control
   - Branch management
   - Metrics and monitoring

10. **Getting Started Guide**
    - Install Skill for instant provisioning
    - Add agents as needed for specialization
    - Enable MCP for advanced workflows
    - Monitor with statusline settings

11. **Conclusion**
    - Complete Neon ecosystem in Claude Code
    - From zero to production in minutes
    - Try Neon: `https://get.neon.com/4eCjZDz`
    - Explore template: `https://aitmpl.com/featured/neon-instagres/`

**Assets:**
- AI-generated cover image (database + lightning bolt theme)
- Code screenshots
- Before/After diagrams
- Neon + Claude Code logos

**Metadata:**
```json
{
  "id": "neon-complete-template-integration",
  "title": "Complete Neon Template for Claude Code: Instant Provisioning + Expert Agents",
  "description": "Complete Neon ecosystem for Claude Code: 1 auto-provisioning Skill + 5 expert agents + MCP + monitoring tools. From zero to production-optimized Postgres in minutes.",
  "date": "2026-01-25",
  "tags": ["neon", "postgres", "template", "skills", "agents", "mcp", "partnership"],
  "featured": true,
  "author": "Claude Code Team",
  "components": {
    "new": ["database/neon-instagres"],
    "existing": [
      "database/neon-expert",
      "database/neon-database-architect",
      "database/neon-auth-specialist",
      "data-ai/neon-migration-specialist",
      "data-ai/neon-optimization-analyzer",
      "database/neon",
      "statusline/neon-database-dev",
      "statusline/neon-database-resources"
    ]
  }
}
```

---

## 🏠 Phase 4: Homepage Integration (Days 19-22)

### Add Featured Banner to Main Homepage

**Location:** `docs/index.html`

**Featured Section** (before component grid):

```html
<section class="featured-integration neon">
  <div class="featured-badge">✨ Featured Partnership</div>

  <div class="featured-content">
    <div class="featured-text">
      <img src="/featured/neon-instagres/assets/neon-logo.svg" class="partner-logo">
      <h2>Complete Neon Template</h2>
      <p>Instant provisioning + expert agents + monitoring tools. The complete Neon ecosystem for Claude Code: <strong>9 components</strong> working together seamlessly.</p>

      <div class="stats">
        <div class="stat">
          <span class="number">⚡ 5s</span>
          <span class="label">Database Ready</span>
        </div>
        <div class="stat">
          <span class="number">9 Components</span>
          <span class="label">Complete Template</span>
        </div>
        <div class="stat">
          <span class="number">5 Agents</span>
          <span class="label">Expert Specialists</span>
        </div>
      </div>

      <div class="cta">
        <a href="/featured/neon-instagres/" class="btn primary">Learn More →</a>
        <a href="https://get.neon.com/4eCjZDz" class="btn secondary">Try Neon Free →</a>
      </div>
    </div>

    <div class="featured-demo">
      <pre class="terminal"><code>$ npx get-db --yes

🚀 Provisioning Neon Postgres...
✅ Database ready in 3.2s!

DATABASE_URL=postgresql://user@ep-cool.neon.tech/db
PUBLIC_INSTAGRES_CLAIM_URL=https://neon.new/database/abc

⏰ Claim within 72h for permanent access</code></pre>
    </div>
  </div>
</section>
```

**Styling:**
- Neon green gradient background
- Terminal-style code demo
- Responsive two-column layout
- Hover effects on CTAs

---

## 📚 Phase 5: Documentation (Days 23-25)

### 5.1 Add Neon Logo to README

**File:** `README.md`

**Add to Sponsors Section:**

```markdown
## 💎 Sponsors

<div align="center">
  <a href="https://get.neon.com/4eCjZDz">
    <img src="https://neon.tech/brand/neon-logo-dark.svg" alt="Neon" height="60">
  </a>
</div>

**Sponsored by [Neon](https://get.neon.com/4eCjZDz)** - Serverless Postgres with instant provisioning via Instagres. Get a production-ready database in 5 seconds with `npx get-db`.

---
```

### 5.2 Update CLAUDE.md

**File:** `CLAUDE.md`

**Add Neon Integration Section:**

```markdown
## Database Integration: Neon Instagres

### Instant Postgres Provisioning

Install the Neon Instagres Skill for automatic database provisioning:

\`\`\`bash
npx claude-code-templates@latest --skill database/neon-instagres
\`\`\`

Once installed, Claude automatically provisions Neon Postgres databases when needed:
- Just ask: "I need a database for my Next.js app"
- Claude runs: `npx get-db --yes --ref 4eCjZDz`
- Database ready in 5 seconds

**Features:**
- ⚡ 5-second provisioning
- 🔄 Works with all frameworks (Next.js, Vite, Express)
- 🛠️ Supports all ORMs (Drizzle, Prisma, TypeORM)
- 💾 72-hour trial (claim for permanent access)

**Learn more:** https://aitmpl.com/featured/neon-instagres/
**Try Neon:** https://get.neon.com/4eCjZDz
```

---

## 📊 Phase 6: Testing & Deployment (Days 26-30)

### 6.1 Testing Checklist

- [ ] **Skill Installation**
  ```bash
  npx claude-code-templates@latest --skill database/neon-instagres
  ```

- [ ] **Skill Activation**
  - Ask: "I need a Postgres database"
  - Verify Claude loads the Skill
  - Verify `npx get-db` executes
  - Verify `.env` created with DATABASE_URL

- [ ] **Framework Integration**
  - Test with Next.js project
  - Test with Vite project
  - Test with Express app

- [ ] **ORM Integration**
  - Test Drizzle setup
  - Test Prisma setup
  - Verify schema generation

- [ ] **Featured Page**
  - Check responsive design
  - Test all CTAs link correctly
  - Verify SEO metadata
  - Check mobile view

- [ ] **Blog Article**
  - Proofread content
  - Check code examples
  - Verify image loading
  - Test social sharing

- [ ] **Homepage**
  - Featured banner displays correctly
  - CTAs work
  - Stats are accurate

- [ ] **README**
  - Neon logo displays
  - Link works
  - Formatting correct

### 6.2 Deployment Steps

```bash
# 1. Regenerate component catalog
python scripts/generate_components_json.py

# 2. Run tests
npm test

# 3. Test API endpoints
cd api && npm test && cd ..

# 4. Commit all changes
git add .
git commit -m "feat: Neon Instagres integration - instant Postgres provisioning

- Add neon-instagres Skill for auto-provisioning
- Create featured integration page
- Add blog article announcing partnership
- Update homepage with featured banner
- Add Neon logo to README sponsors

Partnership deliverables completed for Neon OSS Program."

# 5. Push to branch
git push -u origin claude/review-neon-oss-proposal-YpoGW

# 6. Deploy to production
vercel --prod

# 7. Monitor
vercel logs aitmpl.com --follow
```

---

## 📈 Success Metrics

### 30-Day Targets

**Component Adoption:**
- `neon-instagres` Skill: **200+ downloads**
- Featured page visits: **1,000+ visits**
- Blog article reads: **500+ reads**

**Business Impact:**
- Referral link clicks: **300+ clicks**
- Database provisioning time saved: **10,000+ minutes** (collective)
- Neon signups from referrals: **50+ accounts**

**Developer Experience:**
- Average time to first database: **< 1 minute** (from Skill install)
- User satisfaction: **4.5+ stars** (from feedback)

### Tracking

```javascript
// Track Skill downloads via Supabase
{
  "component_type": "skill",
  "component_name": "neon-instagres",
  "referrer": "https://aitmpl.com",
  "timestamp": "2026-01-20T10:30:00Z"
}

// Track referral link clicks
{
  "event": "neon_referral_click",
  "source": "featured_page",
  "url": "https://get.neon.com/4eCjZDz"
}
```

---

## ✅ Implementation Checklist

### Core Skill
- [ ] Create `cli-tool/components/skills/database/neon-instagres/SKILL.md`
- [ ] Add delegation logic to existing Neon agents in Skill instructions
- [ ] Test Skill activation with database requests
- [ ] Verify `npx get-db --ref 4eCjZDz` execution
- [ ] Test with Next.js, Vite, Express
- [ ] Validate Drizzle, Prisma integration
- [ ] Test integration with `neon-database-architect` agent
- [ ] Test integration with `neon-auth-specialist` agent
- [ ] Verify Skill works alongside Neon MCP
- [ ] Review with component-reviewer agent

### Template Integration Testing
- [ ] Install full template (9 components)
- [ ] Test workflow: Skill → agent delegation
- [ ] Verify statusline settings display correctly
- [ ] Test MCP + Skill coordination
- [ ] Validate component interoperability

### Featured Page
- [ ] Create `/docs/featured/neon-instagres/index.html`
- [ ] Create `/docs/featured/neon-instagres/style.css`
- [ ] Add Neon logo assets to `/docs/featured/neon-instagres/assets/`
- [ ] Create Open Graph image (1200x630)
- [ ] Create Twitter Card image (1200x600)
- [ ] Test responsive design
- [ ] Verify all links work

### Blog Article
- [ ] Create `/docs/blog/neon-instagres-integration.html`
- [ ] Generate AI cover image
- [ ] Add to `/docs/blog/blog-articles.json`
- [ ] Proofread and edit
- [ ] Add code examples
- [ ] Test social sharing

### Homepage Integration
- [ ] Add featured banner to `/docs/index.html`
- [ ] Style with Neon theme
- [ ] Test responsive layout
- [ ] Verify CTAs work

### Documentation
- [ ] Add Neon logo to README sponsors section
- [ ] Update CLAUDE.md with integration guide
- [ ] Verify referral link in all locations

### Testing & Deployment
- [ ] Regenerate components.json catalog
- [ ] Run `npm test`
- [ ] Run `cd api && npm test`
- [ ] Full QA testing
- [ ] Deploy to Vercel production
- [ ] Monitor analytics and logs

---

## 📞 Communication Plan

### Internal Team

**Kick-off Message:**
```
Team,

We're simplifying the Neon integration to a single Skill instead of 11 components!

What we're building:
✅ 1 auto-activating Skill (neon-instagres)
✅ Featured integration page
✅ Blog article
✅ Homepage banner
✅ README logo

Timeline: 30 days
Benefits: $5K sponsorship + referral commissions

This eliminates database setup friction for ALL our users.
Much simpler than the original plan!

Questions? Let's discuss.
```

### Neon Partnership Update

**Email to Taraneh:**
```
Subject: Complete Neon Template Integration Plan - 9 Components Working Together

Hi Taraneh,

Excellent news! We've designed a comprehensive integration that showcases the complete Neon ecosystem within Claude Code.

**The Complete Neon Template:**
Instead of creating isolated components, we're building a cohesive template featuring:
- 🆕 1 NEW Skill (neon-instagres) - Auto-provisioning entry point
- ✅ 5 Existing Agents - Expert specialists already in our library
- ✅ 1 Existing MCP - Neon Management API integration
- ✅ 2 Existing Settings - Statusline monitoring tools

**Total: 9 components working as a unified ecosystem**

**Deliverables (all within 30 days):**
✅ Referral link integration (https://get.neon.com/4eCjZDz)
✅ Neon logo in GitHub README
✅ neon-instagres Skill (instant provisioning)
✅ Featured template page: aitmpl.com/featured/neon-instagres
✅ Blog article: Complete template walkthrough + partnership
✅ Homepage featured banner

**Complete Workflow Example:**
User: "Build a todo app with auth using Neon"
1. neon-instagres Skill provisions database (5 seconds)
2. neon-database-architect designs schema with Drizzle
3. neon-auth-specialist integrates Stack Auth
4. neon MCP manages branches and metrics
5. Statusline displays real-time database stats

**Why this approach is powerful:**
- Showcases entire Neon ecosystem (provisioning → production optimization)
- Leverages 5 existing expert agents (no need to create from scratch)
- Single entry point (Skill) that orchestrates specialist agents
- Complete template users can install with one command
- Better than competitors - no other Postgres provider has this integration depth

**Installation Options:**
```bash
# Quick Start (Skill only)
npx claude-code-templates@latest --skill database/neon-instagres

# Full Template (all 9 components)
npx claude-code-templates@latest \
  --skill database/neon-instagres \
  --agent database/neon-expert \
  --agent database/neon-database-architect \
  --agent database/neon-auth-specialist \
  --agent data-ai/neon-migration-specialist \
  --agent data-ai/neon-optimization-analyzer \
  --mcp database/neon \
  --setting statusline/neon-database-dev \
  --setting statusline/neon-database-resources \
  --yes
```

Timeline: Starting [DATE], completing by [DATE + 30 days]

This positions Neon not just as a database provider, but as a complete development ecosystem within Claude Code!

Best,
[Your Name]
```

---

## 🎯 Timeline Summary

| Phase | Days | Deliverables |
|-------|------|--------------|
| **Phase 1** | 1-5 | Neon Instagres Skill |
| **Phase 2** | 6-12 | Featured integration page |
| **Phase 3** | 13-18 | Blog article |
| **Phase 4** | 19-22 | Homepage banner |
| **Phase 5** | 23-25 | Documentation updates |
| **Phase 6** | 26-30 | Testing & deployment |

**Total:** 30 days from kickoff to production

---

## 🔑 Key Advantages of This Template

1. **Complete Ecosystem**
   - 9 components working together
   - From instant provisioning to production optimization
   - No other Postgres provider offers this depth

2. **Auto-Activation + Delegation**
   - Skill detects database needs automatically
   - Delegates to specialist agents seamlessly
   - Works with existing Neon components

3. **Leverages Existing Assets**
   - 5 Neon agents already exist
   - 1 Neon MCP already integrated
   - 2 statusline settings ready
   - Only 1 new Skill needed

4. **Flexible Installation**
   - Quick start: Skill only
   - Full template: All 9 components
   - Users choose their level of depth

5. **User Experience**
   - Single entry point (Skill)
   - Specialist agents for advanced workflows
   - Real-time monitoring in statusline
   - Just works™

6. **Marketing Impact**
   - Complete template showcase (not just one tool)
   - Featured prominently on homepage
   - Dedicated landing page
   - Blog covers entire ecosystem
   - Positions Neon as complete solution

---

## 🚀 Next Steps

1. **Approve this simplified plan**
2. **Set kick-off date** (within 30-day Neon deadline)
3. **Assign Phase 1** (Skill creation) to dev team
4. **Download Neon logo assets** from Google Drive
5. **Begin implementation**

---

**Document Version:** 2.0 (Simplified)
**Last Updated:** 2026-01-18
**Status:** 🟢 Ready for Implementation
**Estimated Completion:** [Kick-off Date + 30 days]
