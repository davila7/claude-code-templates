# Google Analytics Analysis Examples

Practical examples of common analytics tasks and analysis patterns.

## Example 1: Traffic Overview Analysis

**User Request**: "Review our Google Analytics performance for the last 30 days"

**Analysis Steps**:
1. Fetch core metrics for the period
2. Compare with previous 30 days
3. Identify trends and anomalies
4. Generate insights and recommendations

**Script Command**:
```bash
python scripts/analyze.py \
  --period last-30-days \
  --compare previous-period \
  --metrics sessions,activeUsers,newUsers,bounceRate,engagementRate
```

**Sample Output Analysis**:
```
Traffic Overview (Last 30 Days vs Previous 30 Days)

Sessions: 45,230 (+12.5%)
Active Users: 32,150 (+8.3%)
New Users: 18,920 (+15.2%)
Bounce Rate: 42.3% (-3.1pp)
Engagement Rate: 68.5% (+4.2pp)

Key Insights:
✓ Strong growth in new user acquisition (+15.2%)
✓ Improving engagement (bounce rate down, engagement rate up)
⚠ Sessions per user declining slightly (1.41 → 1.38)

Recommendations:
1. HIGH: Investigate new user source - identify which channels driving growth
2. MEDIUM: Implement retention campaign for existing users
3. LOW: A/B test homepage to improve session depth
```

## Example 2: Traffic Source Analysis

**User Request**: "What are our top traffic sources and which perform best?"

**Analysis Steps**:
1. Group traffic by source/medium
2. Calculate engagement metrics per source
3. Identify high-value vs high-volume sources
4. Recommend optimization strategies

**Script Command**:
```bash
python scripts/ga_client.py \
  --days 30 \
  --metrics sessions,engagementRate,conversions,bounceRate \
  --dimensions sessionSource,sessionMedium \
  --order-by sessions \
  --limit 20
```

**Sample Insights**:
```
Top Traffic Sources (Last 30 Days)

Source/Medium          Sessions    Eng.Rate    Conv.    Bounce
--------------------------------------------------------------
google/organic         18,240      72.3%       245      38.2%
direct/(none)          12,150      65.1%       189      45.6%
facebook/social         5,430      58.2%        67      52.3%
newsletter/email        3,210      81.5%       124      28.1%
google/cpc              2,890      68.9%        98      41.2%

Key Insights:
✓ Newsletter traffic has highest engagement (81.5%) and lowest bounce (28.1%)
✓ Organic search is largest volume but mid-tier engagement
⚠ Social traffic underperforming (high bounce, low conversion)

Recommendations:
1. HIGH: Invest in email list growth - highest quality traffic
2. HIGH: Optimize Facebook campaigns - high spend, poor performance
3. MEDIUM: Improve organic landing pages to boost engagement
4. LOW: Test paid search expansion - good ROI potential
```

## Example 3: Content Performance Analysis

**User Request**: "Which pages have the highest bounce rates and need improvement?"

**Analysis Steps**:
1. Get page-level metrics
2. Filter for high-traffic pages
3. Identify performance issues
4. Prioritize improvements

**Script Command**:
```bash
python scripts/ga_client.py \
  --days 30 \
  --metrics screenPageViews,bounceRate,averageSessionDuration,conversions \
  --dimensions pagePath,pageTitle \
  --order-by screenPageViews \
  --limit 50
```

**Sample Analysis**:
```
High-Bounce Pages Needing Attention

Page                          Views    Bounce    Avg.Time    Conv.
-------------------------------------------------------------------
/blog/getting-started         8,430    67.2%     0:45        12
/products/pricing             6,210    71.8%     1:12        23
/features/comparison          4,890    64.5%     2:03        18
/resources/guides             3,650    69.3%     1:28         8

Issues Identified:
❌ Pricing page: High bounce despite good time-on-page (missing CTA?)
❌ Getting started: Short visit time suggests content mismatch
⚠ Comparison page: Long time but high bounce (decision paralysis?)

Recommendations:
1. HIGH: Add clear CTAs to pricing page (demo request, free trial)
2. HIGH: Review "getting started" keywords - traffic may be mismatched
3. MEDIUM: Simplify comparison page - reduce options or add guidance
4. MEDIUM: Add exit-intent popups on high-bounce pages
5. LOW: Internal linking to reduce single-page sessions
```

## Example 4: Conversion Funnel Analysis

**User Request**: "Analyze our conversion funnel and identify drop-off points"

**Analysis Steps**:
1. Define funnel steps (landing → product → cart → checkout → purchase)
2. Measure completion rates at each step
3. Identify biggest drop-offs
4. Suggest optimizations

**Script Command**:
```bash
python scripts/analyze.py \
  --analysis-type funnel \
  --steps "homepage,/products,/cart,/checkout,/confirmation" \
  --period last-30-days
```

**Sample Funnel Analysis**:
```
Conversion Funnel Analysis (Last 30 Days)

Step                Sessions    Drop-off    Conversion
------------------------------------------------------
1. Homepage         45,230         -          100.0%
2. Product Page     18,920      58.2%         41.8%
3. Cart              5,430      71.3%         12.0%
4. Checkout          2,150      60.4%          4.8%
5. Purchase          1,290      40.0%          2.9%

Critical Issues:
❌ CRITICAL: 71.3% drop-off from product to cart (industry avg: 45%)
❌ HIGH: 60.4% drop-off from cart to checkout (industry avg: 30%)
⚠ MEDIUM: Homepage to product 58.2% (could be better)

Recommendations:
1. CRITICAL: Cart page optimization
   - Add trust badges (secure checkout, money-back guarantee)
   - Show shipping costs earlier
   - Implement abandoned cart email
   - A/B test one-click checkout

2. HIGH: Checkout flow improvement
   - Reduce form fields
   - Add guest checkout option
   - Display progress indicator
   - Test express payment (Apple Pay, Google Pay)

3. MEDIUM: Product page enhancements
   - Better product images and videos
   - Customer reviews and ratings
   - Clear shipping and return policy
   - Recommended products

Expected Impact: +15-25% overall conversion rate
```

## Example 5: Mobile vs Desktop Performance

**User Request**: "Compare mobile and desktop performance"

**Analysis Steps**:
1. Segment metrics by device category
2. Identify device-specific issues
3. Recommend mobile optimizations

**Script Command**:
```bash
python scripts/ga_client.py \
  --days 30 \
  --metrics sessions,bounceRate,averageSessionDuration,conversions,engagementRate \
  --dimensions deviceCategory \
  --order-by sessions
```

**Sample Device Comparison**:
```
Device Performance (Last 30 Days)

Device      Sessions    Bounce    Avg.Time    Conv.Rate    Eng.Rate
--------------------------------------------------------------------
mobile      26,140      48.5%     2:15        2.1%         64.2%
desktop     17,890      35.2%     4:32        4.8%         76.8%
tablet       1,200      42.1%     3:18        3.2%         68.5%

Key Findings:
❌ Mobile conversion rate 56% lower than desktop (2.1% vs 4.8%)
❌ Mobile bounce rate 38% higher (48.5% vs 35.2%)
✓ Mobile represents 57.8% of traffic (good mobile reach)
⚠ Mobile engagement duration 50% shorter

Root Causes:
- Slower mobile page load times
- Complex checkout on small screens
- Poor mobile navigation
- Touch target sizing issues

Recommendations:
1. CRITICAL: Mobile checkout optimization
   - Implement single-page checkout for mobile
   - Add autofill for forms
   - Larger buttons and form fields
   - Mobile-specific payment options

2. HIGH: Mobile performance improvements
   - Optimize images for mobile (WebP, lazy loading)
   - Implement AMP for key landing pages
   - Reduce JavaScript bundle size
   - Enable browser caching

3. MEDIUM: Mobile UX enhancements
   - Sticky navigation for easy access
   - Improve mobile search functionality
   - Add click-to-call buttons
   - Optimize forms for mobile keyboards

4. LOW: Mobile-specific features
   - Geolocation for store finder
   - Mobile app promotion
   - Progressive Web App (PWA) features

Expected Impact: +30-50% mobile conversion rate
```

## Example 6: Geographic Performance Analysis

**User Request**: "Which countries should we focus our marketing efforts on?"

**Analysis Steps**:
1. Segment by country/region
2. Calculate ROI metrics per market
3. Identify growth opportunities
4. Recommend market prioritization

**Script Command**:
```bash
python scripts/ga_client.py \
  --days 90 \
  --metrics sessions,activeUsers,conversions,totalRevenue,engagementRate \
  --dimensions country \
  --order-by totalRevenue \
  --limit 20
```

**Sample Geographic Analysis**:
```
Top Markets by Revenue (Last 90 Days)

Country          Sessions    Users    Revenue    Conv.Rate    Eng.Rate
----------------------------------------------------------------------
United States    125,340    89,230   $245,680      3.8%       72.3%
United Kingdom    28,450    19,840    $52,340      3.2%       68.9%
Canada           18,920    13,210    $31,450      2.9%       65.4%
Australia        12,680     8,940    $24,120      3.1%       70.1%
Germany          15,430    10,230    $18,920      1.9%       64.2%

Emerging Markets (High Engagement, Lower Revenue):
India            22,140    16,780     $4,230      1.2%       71.5%
Brazil            8,930     6,540     $2,840      1.5%       68.2%
Mexico            6,420     4,890     $2,120      1.6%       66.8%

Market Insights:
✓ US is strongest market (high volume + high conversion)
✓ UK/Canada/Australia: Good performance, expansion ready
⚠ Germany: High traffic but low conversion (pricing/localization?)
✓ India/Brazil: High engagement, untapped revenue potential

Recommendations:
1. HIGH: Germany localization project
   - Translate product pages and checkout
   - Add local payment methods (SEPA, Sofort)
   - Currency conversion (EUR pricing)
   - Local customer support
   Expected: +50-80% German conversion rate

2. MEDIUM: Emerging market strategy
   - India: Lower-priced product tier, UPI payment
   - Brazil: Installment payment options
   - Mexico: Spanish localization
   Expected: 3x revenue from emerging markets

3. MEDIUM: UK/Canada expansion
   - Increase ad spend (+20%)
   - Localized campaigns
   - Region-specific promotions
   Expected: +25% revenue from these markets

4. LOW: New market exploration
   - Test France, Spain, Italy (EU proximity)
   - Test Singapore, Japan (APAC)
   - Small budget pilots before full launch
```

## Example 7: Campaign Performance Analysis

**User Request**: "Which marketing campaigns are delivering the best ROI?"

**Analysis Steps**:
1. Group by campaign name and source
2. Calculate cost per acquisition (if ad spend data available)
3. Measure campaign contribution to revenue
4. Recommend budget reallocation

**Script Command**:
```bash
python scripts/ga_client.py \
  --days 30 \
  --metrics sessions,conversions,totalRevenue,engagementRate \
  --dimensions sessionCampaignName,sessionSource,sessionMedium \
  --filter "sessionCampaignName!=(not set)" \
  --order-by conversions
```

**Sample Campaign Analysis**:
```
Campaign Performance (Last 30 Days)

Campaign              Source   Medium    Sessions   Conv.   Revenue   Eng.Rate
------------------------------------------------------------------------------
spring-sale-2026      google   cpc        12,340    234    $28,450    71.2%
email-product-launch  email    email       4,890    189    $24,120    82.5%
retargeting-q1        facebook cpc         8,920    145    $18,920    64.3%
brand-awareness       google   display    18,450     89    $12,340    52.1%
social-organic        facebook social      6,540     67     $8,450    58.7%

Campaign Efficiency:
✓ Email campaign: Best engagement (82.5%) and conversion rate (3.9%)
✓ Spring sale: High volume and good ROI
⚠ Brand awareness: High spend, low conversion
❌ Social organic: Underperforming vs paid

Recommendations:
1. HIGH: Scale email marketing
   - Increase send frequency (weekly → 2x/week)
   - Expand email list acquisition
   - Segment for personalization
   Expected: +40% email revenue

2. MEDIUM: Optimize brand awareness campaign
   - Narrow targeting to high-intent audiences
   - Add retargeting pixel for display viewers
   - Test different creatives
   - Consider reducing budget if no improvement

3. MEDIUM: Retargeting expansion
   - Increase budget (+30%)
   - Add cart abandonment flow
   - Segment by product category
   Expected: +25% retargeting conversions

4. LOW: Social media strategy review
   - Focus on paid over organic
   - Test Instagram vs Facebook
   - Video content experiments
```

## Common Analysis Patterns

### Trend Analysis Template
```python
# Compare week-over-week or month-over-month
# Identify seasonal patterns
# Detect anomalies and investigate causes
```

### Segmentation Template
```python
# Break down by key dimensions (source, device, location)
# Compare segment performance
# Identify best and worst performers
# Allocate resources accordingly
```

### Cohort Analysis Template
```python
# Group users by acquisition date
# Track retention over time
# Measure lifetime value
# Optimize onboarding
```

### Attribution Analysis Template
```python
# Multi-touch attribution modeling
# Identify assist channels
# Understand customer journey
# Budget allocation
```

## Pro Tips

### Ask Better Questions
Instead of: "Show me analytics data"
Ask: "What are the top 3 issues hurting our conversion rate?"

### Request Actionable Insights
Instead of: "What's our bounce rate?"
Ask: "Which pages have high bounce rates and how can we fix them?"

### Compare Time Periods
Instead of: "How many sessions last month?"
Ask: "How does last month compare to the previous month?"

### Focus on Business Goals
Instead of: "Show me all metrics"
Ask: "Which marketing channels drive the most revenue?"

### Request Prioritization
Instead of: "List all problems"
Ask: "What are the top 3 improvements we should make this quarter?"
