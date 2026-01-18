# Neon OSS Program Integration Plan (Simplified)
**Claude Code Templates x Neon Instagres Partnership**

Version: 2.0 (Simplified)
Date: 2026-01-18
Status: 🟢 Ready for Implementation

---

## 📋 Executive Summary

**Approach:** Create **1 powerful Skill** instead of 11 separate components for maximum simplicity and user adoption.

**Partnership Deliverables (30-day deadline):**
1. ✅ Neon referral link integration: `https://get.neon.com/4eCjZDz`
2. ✅ Neon logo in GitHub README
3. ✅ Neon Instagres Skill (auto-activates when database needed)
4. ✅ Featured integration page + blog article

**Business Value:**
- $5,000 annual sponsorship + $20 referral commissions
- Instant database provisioning for ALL Claude Code users
- Co-marketing with Neon's developer community

---

## 🎯 Why Simplify?

### Old Approach (Complex)
- ❌ 4 new components to create
- ❌ 7 existing components to modify
- ❌ Users must discover and install multiple pieces
- ❌ Maintenance overhead
- ❌ Fragmented user experience

### New Approach (Simple)
- ✅ **1 Skill** that auto-activates
- ✅ Works with ALL existing agents (no modifications)
- ✅ Single install: `--skill neon-instagres`
- ✅ Easy to maintain
- ✅ Seamless user experience

### How Skills Work Magic
Skills are **model-invoked**: Claude automatically activates them based on context. When a user mentions "database", "postgres", "setup database", etc., Claude loads the Neon Instagres Skill and provisions a database instantly.

**Zero friction = Maximum adoption**

---

## 🏗️ Implementation Plan

### Total Components: **1 Skill** + Marketing Content

| Component | Type | Purpose |
|-----------|------|---------|
| `neon-instagres` | **Skill** | Auto-activating database provisioning expert |
| Featured Page | Marketing | Showcase integration at `/featured/neon-instagres/` |
| Blog Article | Content | Partnership announcement + technical deep dive |
| README Logo | Documentation | Neon sponsor visibility |
| Homepage Banner | Marketing | Featured integration callout |

---

## 🚀 Phase 1: Core Skill (Days 1-5)

### Create the Neon Instagres Skill

**Location:** `cli-tool/components/skills/neon-instagres/SKILL.md`

**Installation:**
```bash
npx claude-code-templates@latest --skill neon-instagres
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
   npx claude-code-templates@latest --skill neon-instagres

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

6. **Integration Examples**
   - Fullstack developer agent workflow
   - Vite plugin auto-provisioning
   - Next.js + Drizzle setup

7. **Resources**
   - Link to Instagres docs
   - Neon Console
   - Drizzle + Neon guide
   - Component marketplace

**Design:**
- Neon brand colors: `#00E599` (green), `#0F0F0F` (dark)
- ASCII art header (Neon Instagres logo)
- Code demos with terminal styling
- Responsive grid layout
- SEO optimized (Open Graph, Twitter cards)

---

## 📝 Phase 3: Blog Article (Days 13-18)

### Create Partnership Announcement Article

**Location:** `docs/blog/neon-instagres-integration.html`

**Title:** "Instant Postgres Provisioning for Claude Code: Neon Partnership"

**Outline:**

1. **Introduction**
   - Announcing Neon OSS Program partnership
   - The database provisioning problem (15-30 min setup)

2. **The Solution**
   - Neon Instagres: 5-second database provisioning
   - One Skill to rule them all

3. **How It Works**
   - Auto-activating Skills explanation
   - `npx get-db --ref 4eCjZDz` deep dive
   - Claimable databases architecture

4. **Integration Examples**
   ```bash
   # Example 1: Fullstack app
   @fullstack-developer build a todo app with auth

   # Claude automatically:
   # 1. Provisions Neon database (5s)
   # 2. Sets up Drizzle ORM
   # 3. Generates schema
   # 4. Creates Next.js API routes
   ```

5. **Real-World Use Cases**
   - Prototyping: Instant databases for experimentation
   - Testing: Ephemeral databases for CI/CD
   - Education: Zero-friction learning environment
   - Enterprise: Database branching for safe migrations

6. **Performance Benchmarks**
   - Traditional: 17-30 minutes
   - Instagres: 5 seconds
   - **180x-360x faster**

7. **Partnership Details**
   - $5K sponsorship + referral program
   - Co-marketing initiatives
   - Neon as recommended Postgres provider

8. **Getting Started**
   ```bash
   npx claude-code-templates@latest --skill neon-instagres
   ```

9. **Conclusion**
   - Try Neon: `https://get.neon.com/4eCjZDz`
   - Featured page link
   - Component marketplace

**Assets:**
- AI-generated cover image (database + lightning bolt theme)
- Code screenshots
- Before/After diagrams
- Neon + Claude Code logos

**Metadata:**
```json
{
  "id": "neon-instagres-integration",
  "title": "Instant Postgres for Claude Code: Neon Partnership",
  "description": "Provision production-ready Postgres in 5 seconds with Neon Instagres Skill - 180x faster database setup for AI development.",
  "date": "2026-01-25",
  "tags": ["neon", "postgres", "integration", "skills", "partnership"],
  "featured": true,
  "author": "Claude Code Team"
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
      <h2>Instant Postgres with Neon Instagres</h2>
      <p>Provision production-ready Postgres databases in <strong>5 seconds</strong> with zero configuration. Perfect for AI development workflows.</p>

      <div class="stats">
        <div class="stat">
          <span class="number">⚡ 5s</span>
          <span class="label">Database Ready</span>
        </div>
        <div class="stat">
          <span class="number">180x</span>
          <span class="label">Faster Setup</span>
        </div>
        <div class="stat">
          <span class="number">1 Skill</span>
          <span class="label">Auto-Activating</span>
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
npx claude-code-templates@latest --skill neon-instagres
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
  npx claude-code-templates@latest --skill neon-instagres
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
- [ ] Create `cli-tool/components/skills/neon-instagres/SKILL.md`
- [ ] Test Skill activation with database requests
- [ ] Verify `npx get-db --ref 4eCjZDz` execution
- [ ] Test with Next.js, Vite, Express
- [ ] Validate Drizzle, Prisma integration
- [ ] Review with component-reviewer agent

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
Subject: Simplified Neon Integration Plan - Skills Approach

Hi Taraneh,

Great news! We've simplified the integration plan based on your team's feedback.

**New Approach:**
Instead of 11 components, we're creating 1 powerful Skill that:
- Auto-activates when database is needed
- Works seamlessly with ALL our agents
- Zero friction for users - just works

**Deliverables (all within 30 days):**
✅ Referral link integration (https://get.neon.com/4eCjZDz)
✅ Neon logo in GitHub README
✅ neon-instagres Skill (auto-provisioning)
✅ Featured page: aitmpl.com/featured/neon-instagres
✅ Blog article announcing partnership
✅ Homepage featured banner

**Why this is better:**
- Easier to install (1 command vs multiple)
- Works with existing agents (no modifications needed)
- Simpler to maintain
- Better user experience

Example usage:
User: "I need a database for my Next.js app"
Claude: *Automatically activates Skill and provisions Neon database*

Timeline: Starting [DATE], completing by [DATE + 30 days]

Excited to showcase Neon as the go-to Postgres solution!

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

## 🔑 Key Advantages of This Plan

1. **Simplicity**
   - 1 Skill vs. 11 components
   - Single install command
   - Zero configuration

2. **Auto-Activation**
   - Claude detects database needs automatically
   - No user discovery required
   - Works with ALL existing agents

3. **Maintainability**
   - Single source of truth
   - Easy to update
   - Less testing surface

4. **User Experience**
   - Seamless integration
   - No learning curve
   - Just works™

5. **Marketing Impact**
   - Featured prominently on homepage
   - Dedicated landing page
   - Blog amplification

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
