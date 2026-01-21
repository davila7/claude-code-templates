---
name: marketing-demand-acquisition
description: Multi-channel demand generation, paid media optimization, SEO strategy, and partnership programs for Series A+ startups. Includes CAC calculator, channel playbooks, HubSpot integration, and international expansion tactics. Use when planning demand generation campaigns, optimizing paid media, building SEO strategies, establishing partnerships, or when user mentions demand gen, paid ads, LinkedIn ads, Google ads, CAC, acquisition, lead generation, or pipeline generation.
license: MIT
metadata:
  version: 1.0.0
  author: Alireza Rezvani
  category: marketing
  domain: demand-generation
  updated: 2025-10-20
  python-tools: calculate_cac.py
  tech-stack: HubSpot, LinkedIn-Ads, Google-Ads, Meta-Ads, SEO-tools
  target-market: B2B-SaaS, Series-A+
---

# Marketing Demand & Acquisition

Expert acquisition playbook for Series A+ startups scaling internationally (EU/US/Canada) with hybrid PLG/Sales-Led motion.

## Keywords
demand generation, paid media, paid ads, LinkedIn ads, Google ads, Meta ads, CAC, customer acquisition cost, lead generation, MQL, SQL, pipeline generation, acquisition strategy, performance marketing, paid social, paid search, partnerships, affiliate marketing, SEO strategy, HubSpot campaigns, marketing automation, B2B marketing, SaaS marketing

## Role Coverage

This skill serves:
- **Demand Generation Manager** - Multi-channel campaigns, pipeline generation
- **Paid Media/Performance Marketer** - Paid search/social/display optimization
- **SEO Manager** - Organic acquisition and technical SEO
- **Affiliate/Partnerships Manager** - Co-marketing and channel partnerships

## Core KPIs by Role

**Demand Gen**: MQL/SQL volume, cost per opportunity, marketing-sourced pipeline $, pipeline velocity, MQL→SQL conversion rate

**Paid Media**: CAC, ROAS, CPL, CPA, incrementality lift, channel efficiency ratio

**SEO**: Organic sessions, non-brand traffic %, keyword rankings (P1-P3), organic-assisted conversions, technical health score

**Partnerships**: Partner-sourced pipeline $, partner CAC, net new logos via partners, co-marketing ROI

## Tech Stack Integration

**HubSpot CRM** - Campaign tracking, lead scoring, attribution, workflows
**Google Analytics** - Traffic analysis, conversion tracking, funnel optimization
**Search Console** - Keyword performance, technical issues, indexing
**LinkedIn Campaign Manager** - B2B paid social
**Google Ads** - Search, Display, YouTube
**Meta Ads** - Facebook, Instagram

---

## 1. Demand Generation Framework

### 1.1 Full-Funnel Strategy (2025 Best Practice)

**TOFU (Awareness)** → **MOFU (Consideration)** → **BOFU (Decision)** → **Handoff to Sales/Product**

#### TOFU Tactics
- Paid social (LinkedIn thought leadership, Meta awareness)
- Display advertising (programmatic, retargeting)
- Content syndication
- SEO (informational keywords)
- Partnerships (co-webinars, guest content)
- Target: Brand lift, site traffic, early-stage engagement

#### MOFU Tactics
- Paid search (solution keywords)
- Retargeting campaigns
- Gated content (eBooks, templates, webinars)
- Email nurture sequences
- Comparison pages (SEO)
- Target: MQLs, demo requests, trial signups

#### BOFU Tactics
- Paid search (brand + competitor keywords)
- Direct outreach campaigns
- Free trial CTAs
- Case studies & ROI calculators
- Intent-based retargeting
- Target: SQLs, demos booked, pipeline $

### 1.2 Campaign Planning Template

**Campaign Brief** (use this for every campaign):

```
Campaign Name: [Q2-2025-LinkedIn-ABM-Enterprise]
Objective: [Generate 50 SQLs from Enterprise accounts ($50k+ ACV)]
Budget: [$15k/month]
Duration: [90 days]
Channels: [LinkedIn Ads, Retargeting, Email]
Audience: [Director+ at SaaS companies, 500-5000 employees, EU/US]
Offer: [Gated Industry Benchmark Report]
Success Metrics:
  - Primary: 50 SQLs, <$300 CPO
  - Secondary: 500 MQLs, 10% MQL→SQL rate, 40% email open rate
HubSpot Setup:
  - Campaign ID: [create in HubSpot]
  - Lead scoring: +20 for download, +30 for demo request
  - Attribution: First-touch + Multi-touch
Handoff Protocol:
  - SQL criteria: Title + Company size + Budget confirmed
  - Routing: Enterprise SDR team via HubSpot workflow
  - SLA: 4-hour response time
```

### 1.3 HubSpot Campaign Tracking Setup

**Step-by-step**:

1. **Create Campaign in HubSpot**
   - Marketing → Campaigns → Create Campaign
   - Name: `Q2-2025-LinkedIn-ABM-Enterprise`
   - Tag all assets (landing pages, emails, ads) with campaign ID

2. **UTM Parameter Structure** (critical for attribution)
   ```
   utm_source={channel}       // linkedin, google, facebook
   utm_medium={type}          // cpc, display, email, organic
   utm_campaign={campaign-id} // q2-2025-linkedin-abm-enterprise
   utm_content={variant}      // ad-variant-a, email-1
   utm_term={keyword}         // [for paid search only]
   ```

3. **Lead Scoring Configuration**
   - Navigate to: Settings → Marketing → Lead Scoring
   - Campaign engagement: +10-30 points based on action depth
   - Channel quality: LinkedIn +5, Google Search +10, Organic +15

4. **Attribution Reports**
   - Use HubSpot's multi-touch attribution (W-shaped for hybrid motion)
   - First-touch: Awareness credit
   - Multi-touch: Full journey credit
   - Build custom report: Marketing → Reports → Attribution

### 1.4 International Expansion Considerations

**EU Market Entry**:
- GDPR compliance: Double opt-in for email, explicit consent tracking in HubSpot
- Localization: Translate landing pages, ads, emails (DE, FR, ES priority)
- Payment: Display prices in EUR
- Partnerships: Local co-marketing partners for credibility
- Paid channels: LinkedIn most effective for B2B EU, Google Ads second

**US/Canada Market Entry**:
- Messaging: Direct, ROI-focused, less formal than EU
- Paid channels: Google Ads + LinkedIn equal priority
- Partnerships: Industry associations, review sites (G2, Capterra)
- Content: Case studies with $ impact, not just features
- Sales alignment: Faster sales cycles, need immediate lead follow-up

**Budget Allocation** (Series A recommended):
- EU: 40% LinkedIn, 25% Google, 20% SEO, 15% Partnerships
- US/CA: 35% Google, 30% LinkedIn, 20% SEO, 15% Partnerships

---

## 2. Paid Media Optimization

### 2.1 Channel Strategy Matrix

| Channel | Best For | CAC Benchmark | Conversion Rate | Series A Priority |
|---------|----------|---------------|-----------------|-------------------|
| **LinkedIn Ads** | B2B, Enterprise, ABM | $150-$400 | 0.5-2% | ⭐⭐⭐⭐⭐ |
| **Google Search** | High-intent, BOFU | $80-$250 | 2-5% | ⭐⭐⭐⭐⭐ |
| **Google Display** | Retargeting, awareness | $50-$150 | 0.3-1% | ⭐⭐⭐ |
| **Meta (FB/IG)** | SMB, consumer-like products | $60-$200 | 1-3% | ⭐⭐⭐ |
| **YouTube** | Product demos, brand | $100-$300 | 0.5-1.5% | ⭐⭐ |
| **Reddit/Twitter** | Technical audiences | $40-$180 | 0.5-2% | ⭐⭐ |

### 2.2 LinkedIn Ads Playbook (Primary B2B Channel)

**Campaign Structure**:
```
Account
└─ Campaign Group: [Q2-2025-Enterprise-ABM]
   ├─ Campaign 1: [Awareness - Thought Leadership]
   │  ├─ Ad Set: [CTO/VP Eng, US, Tech Companies]
   │  └─ Creatives: [3 carousel posts, 2 video ads]
   ├─ Campaign 2: [Consideration - Product Education]
   │  ├─ Ad Set: [Engaged audience, retargeting]
   │  └─ Creatives: [2 lead gen forms, 1 landing page]
   └─ Campaign 3: [Conversion - Demo Requests]
      ├─ Ad Set: [Website visitors, content downloaders]
      └─ Creatives: [Direct demo CTA, case study]
```

**Targeting Best Practices**:
- **Company Size**: 50-5000 employees (Series A sweet spot)
- **Job Titles**: Director+, VP+, C-level (use LinkedIn's precise targeting)
- **Industries**: Software, SaaS, Tech Services
- **Matched Audiences**: Website retargeting (install Insight Tag), uploaded email lists
- **Budget**: Start $50/day per campaign, scale 20% weekly if CAC < target

**Creative Frameworks**:
1. **Thought Leadership** - Industry insights, no product pitch
2. **Social Proof** - Customer logos, testimonials, case study snippets
3. **Problem-Solution** - Pain point + your solution in 3 seconds
4. **Demo-First** - Show product immediately, skip fluff

**LinkedIn Lead Gen Forms vs. Landing Pages**:
- **Lead Gen Forms**: Higher conversion (2-3x), lower quality, use for TOFU/MOFU
- **Landing Pages**: Lower conversion, higher quality, use for BOFU/demo requests
- **HubSpot Sync**: Connect LinkedIn Lead Gen Forms via native integration

### 2.3 Google Ads Playbook (High-Intent Capture)

**Campaign Types Priority**:
1. **Search - Brand** (highest priority, protect brand terms)
2. **Search - Competitor** (steal market share)
3. **Search - Solution** (problem-aware buyers)
4. **Search - Product Category** (earlier stage)
5. **Display - Retargeting** (re-engage warm traffic)

**Search Campaign Structure**:
```
Campaign: [Search-Solution-Keywords]
├─ Ad Group: [project management software]
│  ├─ Keywords:
│  │  - "project management software" [Phrase]
│  │  - "best project management tool" [Phrase]
│  │  - +project +management +solution [Broad Match Modifier]
│  └─ Ads: [3 responsive search ads with 15 headlines, 4 descriptions]
│
├─ Ad Group: [team collaboration tools]
   ├─ Keywords: [5-10 tightly themed keywords]
   └─ Ads: [3 responsive search ads]
```

**Keyword Strategy**:
- **Brand Terms**: Exact match, bid high, protect brand
- **Competitor Terms**: "[Competitor] alternative", "[Competitor] vs [You]"
- **Solution Terms**: "best [category] software", "top [category] tools"
- **Problem Terms**: "how to [solve problem]"
- **Negative Keywords**: Maintain list of 100+ (free, cheap, jobs, career, reviews)

**Bid Strategy** (2025 best practice):
- New campaigns: Start Manual CPC for control
- After 50+ conversions: Switch to Target CPA
- After 100+ conversions: Test Maximize Conversions with tCPA
- EU markets: Bid 15-20% higher for same quality

**Ad Copy Framework** (Responsive Search Ads):
```
Headlines (15 required):
- H1-3: Value props (Save 10 hours/week, Trusted by 500+ teams)
- H4-6: Features (AI-powered, Real-time sync, Mobile app)
- H7-9: Social proof (4.8★ G2 rating, Used by Microsoft)
- H10-12: CTAs (Start free trial, Book demo, See pricing)
- H13-15: Keywords pinned (Dynamic insertion)

Descriptions (4 required):
- D1: Primary value prop + CTA (30-60 chars)
- D2: Feature list + differentiator (60-90 chars)
- D3: Social proof + urgency (45-90 chars)
- D4: Backup generic (60-90 chars)
```

### 2.4 Meta Ads Playbook (SMB/Lower ACV)

**When to Use Meta**:
- ✅ Product ACV <$10k
- ✅ Visual product (UI, consumer-facing)
- ✅ SMB/prosumer audience
- ✅ Broader awareness campaigns
- ❌ Enterprise/high ACV (use LinkedIn)

**Campaign Setup**:
```
Campaign Objective: [Conversions]
├─ Ad Set 1: [Lookalike - 1% of converters]
│  └─ Placement: [Feed + Stories, Auto]
├─ Ad Set 2: [Interest - Business Software]
│  └─ Placement: [Feed only]
└─ Ad Set 3: [Retargeting - Website 30d]
   └─ Placement: [All placements]
```

**Audience Strategy**:
1. **Core Audiences**: Interests (business tools, productivity, startups)
2. **Lookalike**: 1% of purchasers/high-value leads
3. **Retargeting**: 30-day website visitors, video viewers (75%+)

**Creative Best Practices**:
- Use video (1:1 or 9:16 for Stories)
- First 3 seconds = hook (problem or result)
- Show product UI in action
- Add captions (85% watch muted)
- Test 3-5 creative variants per campaign

### 2.5 Budget Allocation & Scaling

**Initial Budget** (Series A, $30k-50k/month total):
```
Channel            Budget    Expected Results
─────────────────────────────────────────────
LinkedIn Ads       $15k      50 MQLs, 10 SQLs, $1.5k CAC
Google Search      $12k      80 MQLs, 20 SQLs, $600 CAC
Google Display     $5k       120 MQLs, 5 SQLs, $1k CAC
Meta Ads           $5k       100 MQLs, 8 SQLs, $625 CAC
Partnerships       $3k       20 MQLs, 5 SQLs, $600 CAC
─────────────────────────────────────────────
TOTAL              $40k      370 MQLs, 48 SQLs, $833 avg CAC
```

**Scaling Rules**:
1. If CAC <target → Increase budget 20% weekly
2. If CAC >target → Pause, optimize, relaunch
3. If conversion rate drops >20% → Check landing page, offer fatigue
4. Scale winners, kill losers fast (2-week test minimum)

**HubSpot ROI Dashboard**:
- Marketing → Reports → Create Custom Report
- Metrics: Spend, Leads, MQLs, SQLs, CAC, ROAS, Pipeline $
- Dimensions: Campaign, Channel, Region
- Frequency: Daily review, weekly optimization

---

## 3. SEO Strategy

### 3.1 Technical SEO Foundation (Must-Have)

**Pre-Launch Checklist**:
- [ ] XML sitemap submitted to Search Console
- [ ] Robots.txt configured (allow crawling)
- [ ] HTTPS enabled (SSL certificate)
- [ ] Page speed >90 mobile (Google PageSpeed Insights)
- [ ] Core Web Vitals passing (LCP, FID, CLS)
- [ ] Structured data (Organization, Product, FAQ schema)
- [ ] Canonical tags on all pages
- [ ] Hreflang tags for international (en-US, en-GB, de-DE, etc.)

**Technical Audit** (quarterly):
```
1. Crawl site with Screaming Frog
2. Check for:
   - 404 errors (fix or redirect)
   - Redirect chains (consolidate)
   - Duplicate content (canonicalize)
   - Missing meta descriptions
   - Slow pages (>3s load time)
   - Mobile usability issues
3. Fix issues in priority order: Critical → High → Medium
```

### 3.2 Keyword Strategy Framework

**Keyword Research Process**:
1. **Seed Keywords** - Your product category (e.g., "project management software")
2. **Use Tools** - Ahrefs, SEMrush, or free: Google Keyword Planner + Search Console
3. **Analyze** - Volume, difficulty, intent, SERP features
4. **Prioritize** - Quick wins (low difficulty, high intent)

**Keyword Tiers**:

**Tier 1: High-Intent BOFU** (target first)
- "best [product category]"
- "[product category] for [use case]"
- "[competitor] alternative"
- Volume: 100-1k/mo, Difficulty: Medium, Intent: Commercial

**Tier 2: Solution-Aware MOFU**
- "how to [solve problem]"
- "[problem] solution"
- "[use case] tools"
- Volume: 500-5k/mo, Difficulty: Medium-High, Intent: Informational-Commercial

**Tier 3: Problem-Aware TOFU**
- "what is [concept]"
- "[problem] examples"
- "[industry] challenges"
- Volume: 1k-10k/mo, Difficulty: High, Intent: Informational

**International Keyword Research**:
- Use Ahrefs/SEMrush with language filters
- Translate keywords, don't just localize (cultural nuances matter)
- EU: Higher trust in localized content (domain.de > domain.com/de)
- UK: Use British spelling (optimise vs. optimize)

### 3.3 On-Page SEO Template

**Page Optimization Checklist**:
```
URL: [/best-project-management-software]
Title Tag (60 chars): [Best Project Management Software 2025 | YourBrand]
Meta Description (155 chars): [Compare top 10 PM tools. Features, pricing, reviews. Find the perfect fit for your team. Free trials available.]

H1 (60 chars): [Best Project Management Software in 2025]
H2s (structure):
  - What is Project Management Software?
  - Top 10 PM Tools Compared
  - Key Features to Look For
  - Pricing & Plans
  - How to Choose
  - FAQ

Content:
  - Length: 2000-3000 words (comprehensive)
  - Keyword density: 1-2% (natural)
  - Internal links: 3-5 relevant pages
  - External links: 2-3 authoritative sources
  - Images: 3-5 with alt text
  - Schema: Product, FAQ, HowTo

CTA:
  - Above fold: [Start Free Trial]
  - Mid-content: [Compare Plans]
  - End: [Book Demo]
```

**Content Refresh Schedule**:
- Tier 1 pages: Update quarterly (rankings, pricing, features)
- Tier 2 pages: Update semi-annually
- Tier 3 pages: Update annually
- All pages: Monitor Search Console for ranking drops, refresh immediately

### 3.4 Link Building Strategy (2025 Best Practices)

**Link Acquisition Tactics** (in priority order):

**1. Digital PR** (highest ROI)
- Publish original research/data
- Create industry reports
- Pitch journalists (use HARO, Terkel, Featured)
- Target: Industry blogs, tech publications

**2. Guest Posting** (quality over quantity)
- Target: Domain Authority (DA) 40+ sites
- Avoid: Link farms, PBNs, paid links (Google penalty risk)
- Anchor text: Branded (70%), topical (20%), exact match (10%)

**3. Partnerships & Co-Marketing**
- Partner with complementary SaaS tools
- Create co-branded content
- Exchange homepage links (footer or partner section)

**4. Community Engagement**
- Answer questions on Reddit, Quora
- Participate in industry forums
- Create tools/calculators → natural backlinks

**5. Broken Link Building**
- Find broken links on competitor sites
- Offer your content as replacement
- Tools: Ahrefs' Broken Backlinks report

**Link Velocity** (avoid penalties):
- Natural: 5-10 links/month for new sites
- Aggressive: 20-30 links/month after 6 months
- Monitor: Google Search Console for manual actions

### 3.5 Content Strategy for SEO

**Content Types by Funnel Stage**:

**TOFU (Awareness)**:
- Blog posts: "Ultimate Guide to [Topic]"
- Listicles: "Top 10 [Category]"
- Industry reports: "[Industry] State of 2025"
- Target: Broad keywords, thought leadership

**MOFU (Consideration)**:
- Comparison pages: "[Your Product] vs [Competitor]"
- Best of lists: "Best [Category] for [Use Case]"
- How-to guides: "How to [Solve Problem] with [Product]"
- Target: Solution keywords, product education

**BOFU (Decision)**:
- Product pages: "[Product] Features & Pricing"
- Case studies: "How [Customer] Achieved [Result]"
- Landing pages: "Start Free Trial"
- Target: Brand keywords, high-intent searches

**Content Calendar** (Series A minimum):
- TOFU: 4 posts/month (1 per week)
- MOFU: 2 posts/month
- BOFU: 1 post/month
- Refresh: 2 existing posts/month

### 3.6 Local SEO (For Regional Offices)

**Google Business Profile Setup** (per location):
- Complete all fields: Name, address, phone, hours, category
- Upload photos: Office, team, product (10+ images)
- Collect reviews: Ask customers, automate via HubSpot workflow
- Post updates: Weekly posts about company news, events

**Local Citations** (US/Canada/EU):
- Submit to: Yelp, Yellow Pages, local directories
- NAP consistency: Name, Address, Phone identical everywhere
- Industry directories: Software review sites (G2, Capterra)

---

## 4. Partnerships & Affiliate Programs

### 4.1 Partnership Types & Strategy

**Partnership Tiers**:

**Tier 1: Strategic Partnerships** (high impact, low volume)
- Target: Complementary SaaS tools with overlapping ICPs
- Structure: Co-marketing, product integrations, revenue share
- Examples: Slack ↔ Asana, Shopify ↔ Klaviyo
- Effort: High (6-12 months to establish)
- ROI: Very high (100+ leads/month after ramp)

**Tier 2: Affiliate Partners** (scalable)
- Target: Bloggers, review sites, industry influencers
- Structure: Commission per sale (10-30% first year)
- Platform: Use PartnerStack, Impact, or Rewardful
- Effort: Medium (setup once, ongoing management)
- ROI: Medium-High (depends on partner quality)

**Tier 3: Referral Partners** (customer-driven)
- Target: Your existing customers
- Structure: Referral bonus ($500-$1k per SQL)
- Platform: Built into HubSpot or standalone (Friendbuy)
- Effort: Low (automate via workflows)
- ROI: Medium (5-10% of customers refer)

**Tier 4: Marketplace Listings** (distribution)
- Target: Shopify App Store, Salesforce AppExchange, HubSpot Marketplace
- Structure: Free listing + revenue share
- Effort: Medium (initial listing, ongoing updates)
- ROI: Low-Medium (brand visibility + discovery)

### 4.2 Partnership Playbook

**Step 1: Identify Partners**
```
Criteria:
- Similar ICP (overlapping audience, no direct competition)
- Product fit (complementary, not substitute)
- Scale (similar company size, funding stage)
- Values alignment (culture, brand positioning)

Research:
- Tools: BuiltWith, SimilarWeb, LinkedIn Sales Nav
- Look for: Integration pages, partner pages, co-marketing history
```

**Step 2: Outreach Template**
```
Subject: [YourBrand] ↔ [TheirBrand] Partnership Idea

Hi [Name],

I'm [Your Name] at [YourBrand] - we help [ICP] with [value prop].

I noticed [TheirBrand] serves a similar audience, and I think our customers would benefit from an integration between [YourProduct] and [TheirProduct].

Would you be open to exploring a partnership? I'm thinking:
- Product integration (bi-directional sync)
- Co-marketing (joint webinar, case study)
- Revenue share (referral fees)

Let me know if you'd like to chat. Happy to send more details.

Best,
[Your Name]
```

**Step 3: Partnership Agreement**
- Define scope (integration depth, marketing commitment)
- Revenue model (rev share %, referral fees, co-selling)
- Success metrics (leads, pipeline, revenue)
- Term (12-24 months, with renewal)
- Exit clause (90-day notice)

**Step 4: Activation & Enablement**
- Create co-branded assets (landing page, webinar deck, one-pager)
- Train partner sales team (product demo, pitch deck, objection handling)
- Set up tracking (UTM parameters, partner portal in HubSpot)

**Step 5: Ongoing Management**
- Quarterly business reviews (QBRs)
- Monthly check-ins (pipeline, blockers)
- Co-marketing calendar (1-2 activities/quarter)
- Reporting (HubSpot dashboard for partner-sourced pipeline)

### 4.3 Affiliate Program Setup

**Platform Selection**:
- **PartnerStack** - Best for B2B SaaS, native integrations
- **Impact** - Enterprise-grade, high control
- **Rewardful** - Lightweight, Stripe integration
- **FirstPromoter** - Budget-friendly, good analytics

**Commission Structure** (Series A typical):
```
Tier 1: Influencers/Publishers
- 30% recurring for 12 months
- Or: $500 flat per SQL
- Bonus: $1k for 10+ referrals/quarter

Tier 2: Bloggers/Content Creators
- 20% recurring for 12 months
- Or: $300 flat per SQL

Tier 3: Customers (Referral Program)
- $500 per closed deal
- Or: 1 month free for both referrer + referee
```

**Recruitment Strategy**:
1. **Outbound**: Find industry bloggers, YouTubers, newsletter writers
2. **Inbound**: "Become an Affiliate" page, promote in product
3. **Events**: Recruit at conferences, meetups
4. **Communities**: Reddit, LinkedIn groups, Slack communities

**Affiliate Enablement Kit**:
- Brand assets (logos, product screenshots)
- Pre-written content (blog post templates, social posts)
- Tracking links (unique UTM codes per affiliate)
- Sales collateral (one-pagers, case studies, demo videos)

### 4.4 Co-Marketing Campaigns

**Joint Webinar Playbook**:
```
Planning (6 weeks out):
- Define topic (audience pain point, not product pitch)
- Assign roles (host, co-host, Q&A moderator)
- Create landing page (co-branded, dual logos)
- Design promo assets (social graphics, email templates)

Promotion (4 weeks out):
- Email: 3 sends (announcement, reminder, last chance)
- Social: 8-10 posts per partner (LinkedIn, Twitter)
- Paid: $2k budget for LinkedIn ads → landing page
- Partners: Cross-promote to each other's audiences

Execution (day of):
- 60-min format: 5min intro, 40min content, 15min Q&A
- Record for on-demand
- Polls/CTAs: Mid-webinar poll, end with demo CTA

Follow-up (1 week after):
- Send recording to all registrants
- Nurture sequence: 3 emails over 2 weeks
- Split leads: Each partner owns their referred leads
- Report: Attendees, pipeline generated, next steps
```

**Other Co-Marketing Tactics**:
- **Co-branded Content**: eBook, report, guide
- **Case Study**: Joint customer success story
- **Bundle Offer**: "Buy [YourProduct] + [TheirProduct], save 20%"
- **Cross-promotion**: Feature each other in newsletters
- **Social Media Takeover**: Guest post on each other's channels

### 4.5 HubSpot Partner Tracking

**Setup**:
1. **Create Partner Property**
   - Settings → Properties → Create "Partner Source" dropdown
   - Values: Partner A, Partner B, Affiliate Network, etc.

2. **UTM Tracking**
   - Partner links: `?utm_source=partner-name&utm_medium=referral`
   - HubSpot auto-captures UTM parameters

3. **Lead Assignment**
   - Workflow: If "Partner Source" is set → Assign to Partner Manager
   - Notification: Slack alert when partner lead arrives

4. **Reporting**
   - Dashboard: Partner-sourced leads, pipeline, revenue
   - Report to partners: Monthly performance summary

---

## 5. Attribution & Reporting

### 5.1 Attribution Models (HubSpot Native)

**Model Selection** (use multi-touch for hybrid motion):

**First-Touch** - Credit to first interaction
- Use case: Awareness campaigns, brand building
- Pro: Shows what drives discovery
- Con: Ignores nurturing influence

**Last-Touch** - Credit to last interaction before conversion
- Use case: Direct response, BOFU campaigns
- Pro: Shows what closes deals
- Con: Ignores earlier touchpoints

**Multi-Touch (W-Shaped)** - Credit to first, last, and middle (40-20-40 split)
- Use case: Hybrid PLG/Sales-Led (recommended for Series A)
- Pro: Full-funnel view
- Con: More complex to explain to stakeholders

**HubSpot Setup**:
- Marketing → Reports → Attribution → Select Model
- Default: Use Multi-Touch for holistic view
- Compare: Run reports side-by-side to see differences

### 5.2 Reporting Dashboard (HubSpot)

**Weekly Performance Dashboard**:
```
Metrics to Track:
1. Traffic: Visits, unique visitors, bounce rate
2. Leads: MQLs, SQLs, conversion rates
3. Pipeline: Opportunities created, value, velocity
4. CAC: Spend ÷ customers acquired
5. Channel Mix: % of leads by source

Dimensions:
- By Channel: Organic, Paid, Email, Social, Referral
- By Campaign: Individual campaign performance
- By Region: US, CA, EU breakdown
- By Stage: TOFU, MOFU, BOFU metrics
```

**Monthly Executive Dashboard**:
```
KPIs:
1. Marketing-Sourced Pipeline: $[X]M (target: $[Y]M)
2. Marketing-Sourced Revenue: $[X]k (target: $[Y]k)
3. Blended CAC: $[X] (target: $[Y])
4. MQL→SQL Rate: [X]% (target: [Y]%)
5. Pipeline Velocity: [X] days (target: [Y] days)
6. ROMI: [X]:1 (target: 3:1+)

Insights:
- Top performing campaigns
- Underperforming channels (kill or optimize)
- New experiments to test next month
- Budget reallocation recommendations
```

### 5.3 Google Analytics Setup

**Events to Track** (GA4):
```
Engagement:
- page_view (auto-tracked)
- scroll (75% depth)
- video_play (product demos)
- file_download (whitepapers, eBooks)

Conversions:
- sign_up (free trial, account created)
- demo_request (calendar booking)
- contact_form (inbound interest)
- pricing_view (pricing page visit)

E-commerce (if applicable):
- add_to_cart
- begin_checkout
- purchase
```

**Custom Dimensions**:
- User Type: Free vs. Paid
- Plan Type: Starter, Pro, Enterprise
- HubSpot Lead Status: MQL, SQL, Customer
- Campaign: HubSpot Campaign ID

**Integration with HubSpot**:
- Use HubSpot tracking code (includes GA4 by default)
- Or: Google Tag Manager for advanced tracking
- Sync: GA4 audiences → HubSpot lists for retargeting

---

## 6. Experimentation Framework

### 6.1 A/B Testing Prioritization (ICE Score)

**Formula**: ICE = (Impact × Confidence × Ease) ÷ 3

Rate each factor 1-10:
- **Impact**: How much will this move the needle?
- **Confidence**: How sure are you it will work?
- **Ease**: How easy is it to implement?

**Example Tests** (sorted by ICE score):

| Test | Impact | Confidence | Ease | ICE | Priority |
|------|--------|------------|------|-----|----------|
| CTA button color (red vs. green) | 3 | 8 | 10 | 7.0 | Low |
| Landing page headline rewrite | 8 | 7 | 8 | 7.7 | Medium |
| Pricing page redesign | 9 | 6 | 4 | 6.3 | Medium |
| New lead magnet offer | 9 | 8 | 7 | 8.0 | High |
| Add live chat to pricing page | 7 | 9 | 8 | 8.0 | High |

### 6.2 Test Design & Execution

**Test Template**:
```
Hypothesis: [Adding a case study carousel to the pricing page will increase demo requests by 20% because users need social proof before committing]

Metric: [Demo requests from /pricing page]
Sample Size: [1000 visitors per variant]
Duration: [2 weeks or until significance]
Success Criteria: [20% lift, 95% confidence]

Variant A (Control): [Current pricing page]
Variant B (Treatment): [Pricing page + case study carousel]

Tools: [HubSpot A/B test, or Google Optimize]
```

**Statistical Significance**:
- Minimum: 95% confidence, 1000 visitors/variant
- Use calculator: Optimizely Sample Size Calculator
- Don't stop tests early (false positives)

**Test Velocity** (Series A target):
- 4-6 tests/month across channels
- 70% win rate not realistic (aim for 30-40%)
- Document losers (learnings matter)

### 6.3 Common Experiments

**Landing Page Tests**:
- Headline variations (problem-focused vs. solution-focused)
- CTA copy ("Start Free Trial" vs. "Get Started" vs. "Try Now")
- Form length (5 fields vs. 2 fields)
- Social proof placement (above vs. below fold)
- Hero image (product screenshot vs. people vs. abstract)

**Ad Tests**:
- Creative format (static vs. video vs. carousel)
- Messaging angle (feature-led vs. benefit-led vs. outcome-led)
- Audience targeting (broad vs. narrow)
- Landing page destination (homepage vs. dedicated LP)

**Email Tests**:
- Subject line length (short vs. long)
- Personalization (generic vs. first name vs. company name)
- Send time (morning vs. afternoon vs. evening)
- CTA placement (top vs. middle vs. bottom)

---

## 7. Handoff Protocols

### 7.1 MQL → SQL Handoff (Marketing → Sales)

**SQL Definition Criteria** (customize for your ICP):
```
Required:
✅ Job title: Director+ (or Budget Authority confirmed)
✅ Company size: 50-5000 employees
✅ Budget: $10k+ annual (or Qualified Need confirmed)
✅ Timeline: Buying within 90 days
✅ Engagement: Demo requested OR High intent action

Optional:
✅ Industry: Target verticals
✅ Geography: US/CA/EU
✅ Use case: Matches product capabilities
```

**HubSpot Workflow**:
1. Lead reaches MQL threshold (lead score >75)
2. Trigger: Automated email to SDR
3. SDR qualification call (BANT: Budget, Authority, Need, Timeline)
4. If qualified → Mark as SQL, assign to AE
5. If not qualified → Recycle to nurture, adjust lead score

**SLA** (Service Level Agreement):
- SDR responds to MQL: 4 hours
- AE books demo with SQL: 24 hours
- First demo: Within 3 business days of SQL status

### 7.2 SQL → Opportunity Handoff (Sales → RevOps)

**Opportunity Creation**:
- AE creates opportunity in HubSpot after first demo
- Required fields: Company, Deal value, Close date, Stage
- Pipeline stages: Discovery → Demo → Proposal → Negotiation → Closed Won/Lost

**Marketing Support Post-SQL**:
- Retargeting ads to target accounts (ABM)
- Send case studies, ROI calculator
- Invite to customer webinar
- Executive briefing (for Enterprise deals)

### 7.3 Lost Opportunity Handoff (Sales → Marketing)

**Recycle to Nurture**:
- Reason: No budget, bad timing, wrong fit
- Action: Move to "Nurture" list in HubSpot
- Sequence: Quarterly check-in emails, invite to webinars
- Re-engage: After 6-12 months, SDR re-qualification

**Closed Lost Reasons** (track in HubSpot):
- Price too high
- Missing features
- Chose competitor
- No budget
- Bad timing
- Champion left company

**Use lost reasons to inform**:
- Product roadmap
- Pricing changes
- Competitive positioning
- Messaging adjustments

---

## 8. Quick Reference

### 8.1 Channel-Specific Benchmarks (B2B SaaS Series A)

| Metric | LinkedIn | Google Search | SEO | Email | Partnerships |
|--------|----------|---------------|-----|-------|--------------|
| CTR | 0.4-0.9% | 2-5% | 1-3% | 15-25% | N/A |
| CVR | 1-3% | 3-7% | 2-5% | 2-5% | 5-10% |
| CAC | $150-400 | $80-250 | $50-150 | $20-80 | $100-300 |
| MQL→SQL | 10-20% | 15-25% | 12-22% | 8-15% | 20-35% |

### 8.2 Budget Allocation (Recommended)

**Series A ($40k-60k/month)**:
- 40% Paid Acquisition (LinkedIn + Google)
- 25% Content/SEO
- 20% Partnerships
- 10% Tools/Automation
- 5% Experiments/Testing

### 8.3 Team Handoff Quick Guide

**Demand Gen → Sales**:
- Deliver: SQLs with BANT qualification
- Frequency: Real-time via HubSpot
- SLA: 4-hour response time

**Demand Gen → Product Marketing**:
- Request: Product positioning, competitive intel, case studies
- Frequency: Monthly sync
- Deliverables: Updated messaging, new collateral

**Demand Gen → Marketing Ops**:
- Request: Campaign tracking setup, attribution reports, data cleaning
- Frequency: Weekly check-in
- SLA: 48-hour turnaround for new campaigns

**Paid Media → Creative/Brand**:
- Request: Ad creative (10-20 variants/month)
- Format: Specs sheet with dimensions, copy length, brand guidelines
- SLA: 5 business days per request

**SEO → Content**:
- Request: Content based on keyword research
- Deliverables: Content brief with target keywords, structure, length
- Frequency: Monthly editorial calendar

**Partnerships → Sales**:
- Deliver: Partner-sourced leads with partner context
- Co-selling: Joint calls for strategic deals
- Frequency: Weekly partner pipeline review

---

## Resources

### references/

- **hubspot-workflows.md** - Pre-built HubSpot workflow templates for lead scoring, nurture, assignment
- **campaign-templates.md** - Ready-to-use campaign briefs for LinkedIn, Google, SEO
- **international-playbooks.md** - Market-specific tactics for EU, US, Canada expansion
- **attribution-guide.md** - Deep dive on multi-touch attribution setup and analysis

### scripts/

- **calculate_cac.py** - Calculate blended and channel-specific CAC
- **experiment_calculator.py** - A/B test sample size and significance calculator

### assets/

- **campaign-brief-template.docx** - Editable campaign planning document
- **dashboard-template.xlsx** - Pre-configured performance dashboard

---

**Last Updated**: October 2025 | **Version**: 1.0
