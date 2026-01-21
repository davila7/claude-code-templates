# Marketing Skill for Claude

A comprehensive Claude skill designed to help marketing teams plan, execute, and measure marketing campaigns across all channels.

## Overview

This skill provides frameworks, templates, and best practices for:
- **Campaign Planning & Strategy** - Structured approaches to campaign development
- **Content Creation** - Copywriting guidelines and templates for all channels
- **Social Media Management** - Platform-specific strategies and content calendars
- **Email Marketing** - Email templates, sequences, and best practices
- **Analytics & Measurement** - KPI frameworks and performance tracking
- **Brand Management** - Brand guidelines and voice standards
- **Ready-to-Use Templates** - Immediately applicable email, landing page, and content templates

## File Structure

```
marketing-skill/
├── SKILL.md                          # Main skill file with overview & core workflows
├── reference/
│   ├── campaigns.md                  # Campaign planning frameworks
│   ├── content.md                    # Content creation & copywriting guidelines
│   ├── social_media.md               # Platform-specific social media strategies
│   ├── email.md                      # Email marketing guides & templates
│   ├── analytics.md                  # Analytics frameworks & KPI definitions
│   ├── brand.md                      # Brand guidelines & voice standards
│   └── templates.md                  # Ready-to-use marketing templates
├── scripts/
│   └── marketing_utils.py            # Utility script for campaign tracking & UTM generation
└── README.md                         # This file
```

## Quick Start

### 1. For Campaign Planning
Start with [SKILL.md](SKILL.md) → [reference/campaigns.md](reference/campaigns.md)
- Use the campaign development template for structured planning
- Choose a campaign type (product launch, lead generation, retention, awareness)
- Define objectives, audience, strategy, and success metrics

### 2. For Content Creation
[reference/content.md](reference/content.md) → [reference/templates.md](reference/templates.md)
- Review copywriting fundamentals and templates
- Select the right template for your channel/format
- Customize with your specific messaging and offers

### 3. For Social Media
[reference/social_media.md](reference/social_media.md)
- Find platform-specific best practices (LinkedIn, Twitter, Facebook, Instagram, YouTube)
- Use the campaign framework for social planning
- Reference metrics and targets by platform

### 4. For Email Marketing
[reference/email.md](reference/email.md) → [reference/templates.md](reference/templates.md)
- Choose email type (welcome, newsletter, promotional, nurture, re-engagement)
- Use ready-to-use email templates
- Apply segmentation and A/B testing best practices

### 5. For Analytics & Measurement
[reference/analytics.md](reference/analytics.md)
- Map your campaign to the marketing funnel
- Define KPIs and success metrics
- Set up proper tracking with UTM parameters
- Create measurement dashboards

### 6. For Brand Consistency
[reference/brand.md](reference/brand.md)
- Review voice and tone guidelines
- Check visual branding standards
- Ensure consistency across campaigns

## Using the Utility Script

### Generate UTM Parameters
```bash
python scripts/marketing_utils.py generate_utm \
  --source "email" \
  --medium "newsletter" \
  --campaign "Q3_product_launch"
```

### Build Tracking URLs
```bash
python scripts/marketing_utils.py build_url \
  --url "https://example.com/pricing" \
  --source "email" \
  --medium "newsletter" \
  --campaign "Q3_product_launch"
```

### Validate Tracking URLs
```bash
python scripts/marketing_utils.py validate \
  --url "https://example.com/pricing?utm_source=email&utm_medium=newsletter&utm_campaign=Q3_product_launch"
```

### Batch Generate Campaign URLs from CSV
```bash
python scripts/marketing_utils.py batch \
  --file campaigns.csv \
  --url "https://example.com/pricing" \
  --output tracking_urls.csv
```

**CSV format for batch:**
```
name,channel,content_type,variant
Q3_Product_Launch,email,newsletter,hero_image
Q3_Product_Launch,email,newsletter,button_v1
Q3_Product_Launch,linkedin,sponsored_content,
```

## Key Concepts

### Marketing Funnel
All content and campaigns map to one of these stages:
- **Awareness**: Build reach and brand recognition
- **Consideration**: Educate and build credibility
- **Decision**: Drive conversions
- **Retention**: Keep customers happy
- **Advocacy**: Turn customers into promoters

### Consistent Terminology
This skill uses consistent terminology throughout:
- "Campaign" - coordinated marketing activities with unified messaging
- "Channels" - distribution platforms (email, social, ads, blog, etc.)
- "Target audience" - specific segments the campaign reaches
- "Engagement rate" - percentage who interact with content
- "Conversion" - desired action (signup, purchase, demo, etc.)
- "CTR" - Click-through rate
- "CAC" - Customer acquisition cost

## Best Practices Applied

This skill follows the Claude skills best practices:

✓ **Concise & Efficient** - Focuses on essentials without unnecessary explanations
✓ **Progressive Disclosure** - Core content in SKILL.md, detailed information in reference files
✓ **Domain-Organized** - Content grouped by marketing function (campaigns, content, social, email, analytics, brand)
✓ **One Level Deep** - All references directly from SKILL.md for clarity
✓ **Actionable Templates** - Ready-to-use templates for immediate application
✓ **Clear Workflows** - Step-by-step processes for common marketing tasks
✓ **Executable Utilities** - Python script for deterministic campaign tracking setup
✓ **Tested Patterns** - Uses proven marketing frameworks and best practices

## Customization Guide

### For Your Company
Before using this skill, customize:

1. **Brand Guidelines** ([reference/brand.md](reference/brand.md))
   - Update brand voice and tone examples
   - Add color palette and typography
   - Update logo usage and style

2. **Key Terminology** (Throughout all files)
   - Replace generic terms with your product/industry terminology
   - Use consistent naming for your audience types
   - Include your internal metrics and definitions

3. **Audience Types** ([reference/campaigns.md](reference/campaigns.md))
   - Define your specific customer personas
   - List your key audience segments
   - Add role-specific messaging guidance

4. **Success Metrics** ([reference/analytics.md](reference/analytics.md))
   - Set realistic targets for your industry/company
   - Define how you measure success
   - Specify your key reporting metrics

## Measurement & KPIs

See [reference/analytics.md](reference/analytics.md) for:
- Marketing funnel stages and metrics
- Essential KPIs for leadership reporting
- Channel-specific KPIs (paid ads, email, social, content)
- Attribution modeling approaches
- Dashboard and reporting templates

## Common Marketing Workflows

### Workflow: Launch a Product
1. Define campaign using [reference/campaigns.md](reference/campaigns.md) template
2. Plan content across channels using [reference/social_media.md](reference/social_media.md) and [reference/email.md](reference/email.md)
3. Create assets using [reference/content.md](reference/content.md) and [reference/templates.md](reference/templates.md)
4. Set up tracking with [scripts/marketing_utils.py](scripts/marketing_utils.py)
5. Define success metrics in [reference/analytics.md](reference/analytics.md)
6. Execute and measure

### Workflow: Generate Leads
1. Identify target audience in [reference/campaigns.md](reference/campaigns.md)
2. Choose lead magnet using [reference/templates.md](reference/templates.md)
3. Create landing page and forms
4. Plan email nurture sequence in [reference/email.md](reference/email.md)
5. Set up conversion tracking
6. Monitor performance using KPIs in [reference/analytics.md](reference/analytics.md)

### Workflow: Build Brand Awareness
1. Define campaign strategy in [reference/campaigns.md](reference/campaigns.md)
2. Plan content themes using [reference/content.md](reference/content.md)
3. Create social media calendar in [reference/social_media.md](reference/social_media.md)
4. Generate content using [reference/templates.md](reference/templates.md)
5. Measure reach and engagement KPIs from [reference/analytics.md](reference/analytics.md)

## Troubleshooting

**Issue**: Marketing messages aren't resonating
**Solution**: Review audience research in [reference/campaigns.md](reference/campaigns.md), test different value propositions using [reference/templates.md](reference/templates.md)

**Issue**: Low email open rates
**Solution**: Check subject line formulas in [reference/email.md](reference/email.md), test send times, review audience segmentation

**Issue**: Can't measure campaign impact
**Solution**: Use UTM parameters from [scripts/marketing_utils.py](scripts/marketing_utils.py), implement conversion tracking in [reference/analytics.md](reference/analytics.md)

**Issue**: Campaigns not converting
**Solution**: Review funnel stages in [reference/analytics.md](reference/analytics.md), use offer templates in [reference/templates.md](reference/templates.md), optimize CTA based on channel best practices

## Support & Questions

Each reference file includes:
- Best practices and proven frameworks
- Common mistakes to avoid
- Specific examples and templates
- Implementation guidance

For questions about specific topics:
- **Campaign strategy**: See [reference/campaigns.md](reference/campaigns.md)
- **Writing and messaging**: See [reference/content.md](reference/content.md)
- **Platform-specific tactics**: See [reference/social_media.md](reference/social_media.md)
- **Email mechanics**: See [reference/email.md](reference/email.md)
- **Measurement**: See [reference/analytics.md](reference/analytics.md)
- **Brand standards**: See [reference/brand.md](reference/brand.md)

## Version History

- **v1.0** - Initial release with core marketing functions
  - Campaign planning frameworks
  - Content creation guidelines
  - Social media strategies for 5 platforms
  - Email marketing templates and best practices
  - Analytics frameworks and KPIs
  - Brand guidelines template
  - Ready-to-use templates for all channels
  - Marketing utility script for UTM generation

## License & Usage

This skill is designed for use with Claude AI. Adapt and customize for your organization's specific needs.

---

**Last Updated**: October 2025
**Skill Version**: 1.0
**For Claude Models**: Claude Opus 4.1, Claude Sonnet 4.5, Claude Haiku 4.5
