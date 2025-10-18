# Marketing Analytics & Measurement

## Marketing Funnel Framework

Understand where to measure at each stage:

```
AWARENESS → CONSIDERATION → DECISION → RETENTION → ADVOCACY
```

### Stage 1: AWARENESS
**Goal**: Reach target audience, build brand recognition
**Key Metrics**:
- Impressions: Total times content was displayed
- Reach: Unique people who saw content
- Brand searches: How many people search for you specifically
- Share of voice: Your content vs. competitor content in feeds
- Website traffic from organic/paid

**Measurement Tools**: Google Analytics, social analytics, ad platform dashboards

### Stage 2: CONSIDERATION
**Goal**: Educate audience, build credibility, move closer to decision
**Key Metrics**:
- Click-through rate (CTR): Percentage who clicked your content
- Engagement rate: Comments, shares, reactions
- Time on page: How long they spent reading
- Pages per session: Depth of engagement
- Lead generation: Form submissions, downloads
- Email open/click rates

**Measurement Tools**: Google Analytics, email platform analytics, form tracking

### Stage 3: DECISION
**Goal**: Drive conversion (purchase, demo, signup)
**Key Metrics**:
- Conversion rate: Percentage of visitors who converted
- Cost per conversion (CPC, CPL): Marketing spend / conversions
- Average deal size: Revenue per customer acquired
- Sales qualified leads (SQLs): Leads ready for sales
- Demo requests or trial signups
- Cart abandonment rate (e-commerce)

**Measurement Tools**: CRM analytics, ad platform conversion tracking, Google Analytics goals

### Stage 4: RETENTION
**Goal**: Keep customers happy, reduce churn
**Key Metrics**:
- Customer retention rate: Percentage of customers retained
- Churn rate: Percentage of customers lost
- Customer lifetime value (CLV): Total revenue from customer
- Net revenue retention: Revenue growth from existing customers
- Product engagement: Feature usage, login frequency
- Customer satisfaction (NPS, CSAT)

**Measurement Tools**: CRM, product analytics, customer surveys

### Stage 5: ADVOCACY
**Goal**: Turn customers into promoters
**Key Metrics**:
- Net Promoter Score (NPS): Likelihood to recommend (0-10 scale)
- Customer testimonials or case study participation
- Referrals generated: Customers brought in by word-of-mouth
- Social media mentions/shares: Customer-generated content
- Review scores: Ratings on G2, Capterra, Trustpilot
- Repeat purchase rate: Percentage who bought again

**Measurement Tools**: Survey tools, referral programs, review sites, social listening

## Essential Marketing KPIs

### Top-Level KPIs (report to leadership monthly)

**Marketing Contribution to Revenue**
- Revenue influenced by marketing: $X (direct + attributed)
- Revenue per marketing dollar spent: $X
- Marketing-sourced customers this period: #
- % of pipeline sourced by marketing: X%

**Lead Generation**
- Total leads generated: # (qualified + unqualified)
- Cost per lead: $X (marketing spend / leads)
- Sales qualified leads (SQLs): # (leads sales is actively pursuing)
- Conversion rate (lead to customer): X%

**Customer Acquisition**
- New customers acquired: #
- Customer acquisition cost (CAC): $X (marketing spend / new customers)
- CAC payback period: X months (revenue per customer ÷ CAC)
- Cost per acquisition by channel: $X (breakdown by email, paid, organic, etc.)

**Campaign Performance**
- Overall marketing ROI: X% (revenue - cost / cost × 100)
- Best performing campaign: [Name] (ROI: X%)
- Cost per MQL/SQL/Opportunity: $X at each stage

**Marketing Efficiency**
- Marketing spend as % of revenue: X%
- Customer lifetime value (CLV): $X
- CLV to CAC ratio: X:1 (ideal 3:1 or better)
- Marketing headcount efficiency: Revenue per marketer

### Channel-Specific KPIs

**Paid Digital Advertising (Google, LinkedIn, Facebook)**
- Cost per click (CPC): $X
- Click-through rate (CTR): X%
- Cost per conversion: $X
- Return on ad spend (ROAS): X:1 (revenue / ad spend)
- Impression share: X% (your impressions / total available)
- Quality score (Google Ads): X/10

**Email Marketing**
- Email open rate: X% (across all campaigns)
- Click-through rate: X%
- Conversion rate (from email click to signup): X%
- Unsubscribe rate: X%
- Revenue generated: $X
- Email list growth rate: X% (new subscribers / total list)

**Social Media**
- Engagement rate: X% ((likes + comments + shares) / impressions)
- Follower growth: X% (monthly)
- Reach per post: X average
- Click-through rate from social: X%
- Traffic to website from social: X visits
- Conversion rate from social traffic: X%
- Cost per acquired customer (if using paid social): $X

**Content Marketing (Blog, Resources)**
- Organic website traffic: X visits
- Keyword rankings: # of keywords ranking in top 10/top 3
- Content engagement: Avg. time on page, pages per session
- Leads from content: # of leads sourced from blog/resources
- Content downloads: # of gated content downloads
- Backlinks: # high-quality referring domains

**Event Marketing (Webinars, Conferences)**
- Registrations: #
- Attendance rate: X%
- Leads generated: #
- Cost per attendee: $X
- Attendee-to-customer conversion: X%
- Post-event engagement: X% attended follow-up emails

## Attribution Modeling

Attribution answers: "Which marketing touchpoint gets credit for a conversion?"

### Attribution Models

**First-Touch Attribution**
- Gives all credit to the first touchpoint
- Useful for: Understanding awareness channels
- Example: Prospect sees ad (credit) → opens email → clicks link → converts (email gets no credit)

**Last-Touch Attribution**
- Gives all credit to the final touchpoint
- Useful for: Understanding which channel closes deals
- Example: Email (no credit) → email → email (credit) → converts
- **Most common but can be misleading**

**Linear Attribution**
- Splits credit equally across all touchpoints
- Useful for: Understanding full customer journey
- Example: Ad (25%) → email (25%) → landing page (25%) → click (25%) → converts

**Time-Decay Attribution**
- Gives more credit to touchpoints closer to conversion
- Useful for: Understanding which channel was most recent influence
- Example: Ad (15%) → email (30%) → landing page (40%) → click (15%) → converts

**Custom/Multi-Touch Attribution**
- Splits credit based on role: awareness gets 30%, consideration gets 30%, decision gets 40%
- Most accurate but requires custom setup
- Use this when possible

### Setting Up Attribution in Analytics

1. Use UTM parameters consistently on all campaign links
   - Format: ?utm_source=email&utm_medium=newsletter&utm_campaign=Q3_launch
   
2. Set up conversion tracking (Google Analytics goals)
   
3. Choose attribution model aligned with business model:
   - Long B2B sales cycle: Multi-touch or time-decay
   - Quick e-commerce purchase: Last-touch
   - Building awareness: First-touch

4. Review attribution monthly - identify:
   - Which channels drive awareness (first-touch high %)
   - Which channels drive conversions (last-touch high %)
   - Full customer journey

## Reporting & Dashboards

### Monthly Marketing Report Template

**Executive Summary (1 page)**
- Top KPIs vs. target (traffic, leads, revenue influenced)
- Key wins this month
- Key challenges and mitigation
- Recommended actions/decisions needed

**Performance vs. Goals**
| Goal | Target | Actual | % of Target | Status |
|------|--------|--------|------------|--------|
| Website traffic | 50,000 | 48,500 | 97% | On track |
| Leads generated | 200 | 215 | 108% | Above target |
| Customers acquired | 10 | 8 | 80% | Below target |

**Channel Performance**
| Channel | Traffic | Leads | Lead Quality | Cost | ROI |
|---------|---------|-------|--------------|------|-----|
| Paid Google | 15,000 | 45 | 60% qualified | $3,000 | 5:1 |
| Email | 8,000 | 35 | 80% qualified | $500 | 12:1 |
| Organic | 18,000 | 55 | 50% qualified | $0 | ∞ |

**Campaign Highlights**
- Campaign name + results (traffic, leads, ROI)
- Comparison vs. previous month
- Notable learnings

**Issues & Opportunities**
- What's not working and why
- Opportunities for improvement
- Recommended actions

**Looking Ahead**
- Major campaigns launching next month
- Expected results/targets
- Support needed from other teams

## Analytics Tools & Setup

### Essential Tools

**Website Analytics**
- Google Analytics (free, built-in goal tracking)
- Setup: Create conversion goals, enable utm parameter tracking
- Alternative: Mixpanel, Amplitude for more advanced tracking

**Email Analytics**
- Mailchimp, HubSpot, Klaviyo (built-in email metrics)
- Track: open rate, click rate, conversion rate, revenue

**Paid Advertising**
- Google Ads dashboard (Google campaigns)
- LinkedIn Campaign Manager (LinkedIn ads)
- Facebook Ads Manager (Facebook/Instagram ads)
- Track: CPC, CTR, ROAS, conversion rate

**Social Media Analytics**
- Platform native analytics (LinkedIn, Twitter, Facebook, Instagram)
- Alternative: Hootsuite, Sprout Social (multi-platform)
- Track: engagement rate, reach, follower growth, traffic to website

**CRM/Lead Tracking**
- HubSpot, Salesforce, Pipedrive
- Track: lead source, conversion rate to customer, deal value

**Survey/Feedback**
- Typeform, SurveyMonkey, Google Forms
- Track: NPS, CSAT, customer satisfaction

### Google Analytics Setup Essentials

1. **Enable UTM Parameter Tracking**
   - Applied to all campaign links
   - Parameters: source, medium, campaign, content, term
   - Example: ?utm_source=email&utm_medium=newsletter&utm_campaign=Q3_launch

2. **Set Up Conversion Goals**
   - Page views: Thank you page after signup form
   - Event tracking: Button clicks, file downloads
   - E-commerce: Purchase value

3. **Enable Demographics & Interests**
   - Understand who your audience is
   - Refine targeting based on demographic data

4. **Set Up Custom Dashboards**
   - Daily: Traffic and key conversion metrics
   - Weekly: Campaign performance by channel
   - Monthly: Full funnel and ROI metrics

5. **Link to CRM**
   - Use Google Analytics 4 CRM integrations
   - Track when web visitor becomes customer
   - Calculate true conversion rates

## Data Quality Standards

**Before trusting any metric, verify:**

- [ ] Definition is clear (what counts as a "lead"?)
- [ ] Tracking is consistent (all links have UTM parameters?)
- [ ] Delays are understood (email data may lag 24 hours)
- [ ] Discrepancies are explained (why does email platform show 5% opens but GA shows different conversion rate?)
- [ ] Baseline exists (do we have historical data to compare?)
- [ ] External factors noted (was there a platform outage? Ad account issue?)

**Common Data Quality Issues:**
- UTM parameters inconsistent or missing
- Conversion tracking not installed or broken
- Duplicate tracking (counting conversion twice)
- Attribution not aligned (different tools show different results)
- Time zone mismatches
