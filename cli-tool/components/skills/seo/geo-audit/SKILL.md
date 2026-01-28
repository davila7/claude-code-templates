---
name: geo-audit
description: Comprehensive Generative Engine Optimization (GEO) audit for websites. Analyzes LLM visibility, AI crawler optimization, llms.txt implementation, structured data, and citation potential. Essential for optimizing sites to appear in ChatGPT, Perplexity, Claude, and Gemini responses.
---

# GEO Audit Skill

## Overview

Perform comprehensive Generative Engine Optimization (GEO) audits to optimize your website for visibility in AI-powered search engines and LLM responses. This skill analyzes your site's readiness to be cited by ChatGPT, Perplexity, Claude, Gemini, and other AI systems.

GEO is the next evolution of SEO - optimizing content not just for traditional search engines, but for the AI systems that increasingly answer user queries directly.

## When to Use This Skill

Use this skill when:
- Launching a new website and want AI visibility from day one
- Your site isn't appearing in AI responses despite good traditional SEO
- Implementing llms.txt for AI crawler guidance
- Optimizing content structure for LLM extraction
- Setting up IndexNow for rapid indexing (feeds LLMs via Bing)
- Auditing competitors' GEO strategies
- Building a comprehensive AI citation strategy

## Quick Start

### Run a Basic Audit

```bash
python scripts/geo_audit.py https://example.com
```

### Run with Detailed Report

```bash
python scripts/geo_audit.py https://example.com --verbose --output report.json
```

### Check Specific Elements

```bash
# Check llms.txt only
python scripts/geo_audit.py https://example.com --check llms-txt

# Check AI crawler rules
python scripts/geo_audit.py https://example.com --check robots-ai

# Check structured data
python scripts/geo_audit.py https://example.com --check schema
```

## What the Audit Checks

### 1. llms.txt Implementation

The llms.txt file guides AI crawlers through your site:

```
# Required checks:
- File exists at /llms.txt
- Valid syntax and structure
- Site metadata (URL, description)
- Page sections with titles/descriptions
- Training permissions (Train: no/yes)
- Attribution requirements
- License information
- Contact details
```

**Score Impact**: 0-25 points

### 2. AI Crawler robots.txt Rules

Proper crawler directives for AI systems:

```
# Checked user-agents:
- GPTBot (ChatGPT)
- ChatGPT-User
- PerplexityBot
- ClaudeBot / Claude-Web / anthropic-ai
- Google-Extended (Gemini)
- CCBot (Common Crawl - feeds many LLMs)
- Applebot-Extended
- cohere-ai
- meta-externalagent
```

**Score Impact**: 0-20 points

### 3. Structured Data Quality

Schema.org markup for AI understanding:

```
# Priority schemas:
- Organization (brand identity)
- WebSite (site info + search)
- Article/BlogPosting (content)
- FAQ (question-answer pairs)
- HowTo (instructional content)
- Product (e-commerce)
- BreadcrumbList (navigation)
- SoftwareApplication (tools/apps)
```

**Score Impact**: 0-20 points

### 4. Content Structure for AI Extraction

How well content can be parsed by LLMs:

```
# Checks:
- Clear heading hierarchy (H1 > H2 > H3)
- Question-formatted headings
- Short, scannable paragraphs (2-4 sentences)
- Bullet/numbered lists
- Summary/TL;DR sections
- Key takeaways clearly marked
- Author attribution
- Publication dates
```

**Score Impact**: 0-15 points

### 5. IndexNow Integration

Rapid indexing for Bing (feeds LLMs):

```
# Checks:
- IndexNow key file exists
- API endpoint configured
- Recent submissions
- URL change notifications
```

**Score Impact**: 0-10 points

### 6. Citation Signals

Factors that encourage AI systems to cite your content:

```
# Checks:
- Clear author expertise (E-E-A-T)
- Verifiable sources/references
- Original research or data
- Unique insights
- Publication credibility
- Update frequency
- Canonical URLs
```

**Score Impact**: 0-10 points

## Audit Score Interpretation

| Score | Rating | Description |
|-------|--------|-------------|
| 90-100 | Excellent | Fully optimized for GEO, high citation potential |
| 70-89 | Good | Well-optimized, minor improvements possible |
| 50-69 | Fair | Basic optimization, significant gaps |
| 30-49 | Poor | Minimal GEO, unlikely to be cited |
| 0-29 | Critical | No GEO strategy, invisible to AI |

## Implementation Guides

### Creating an Effective llms.txt

```markdown
# ===== LLMs Roadmap =====
Site: https://example.com
Generated: 2025-01-15T10:00:00Z
User-agent: *
Allow: /
Train: no
Attribution: required
License: https://example.com/terms
Contact: hello@example.com

# About This Site
[2-3 sentence description of your site's purpose and authority]

## Section: [Category Name]
Title: [Page Title]
URL: /path/to/page
Desc: [120 char max description starting with action verb]

Title: [Another Page]
URL: /another/path
Desc: [Description]
```

### Optimizing robots.txt for AI

```
# Allow AI crawlers with appropriate rate limits
User-agent: GPTBot
Allow: /
Allow: /llms.txt
Crawl-delay: 2

User-agent: PerplexityBot
Allow: /
Allow: /llms.txt
Crawl-delay: 1

User-agent: ClaudeBot
Allow: /
Allow: /llms.txt
Crawl-delay: 1

# Point to llms.txt
# LLMs.txt: https://example.com/llms.txt
```

### Adding FAQ Schema

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [{
    "@type": "Question",
    "name": "What is [topic]?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Clear, comprehensive answer that LLMs can extract..."
    }
  }]
}
</script>
```

## Common Issues and Fixes

### Issue: No llms.txt File

**Impact**: AI crawlers have no roadmap for your site

**Fix**:
```bash
# Generate llms.txt from sitemap
python scripts/generate_llms_txt.py --sitemap https://example.com/sitemap.xml

# Or create manually
touch public/llms.txt
```

### Issue: AI Crawlers Blocked in robots.txt

**Impact**: ChatGPT, Perplexity, etc. cannot index your content

**Fix**: Add explicit allow rules (see robots.txt section above)

### Issue: No Structured Data

**Impact**: AI systems can't understand content context

**Fix**: Add JSON-LD schema markup to pages

### Issue: Long, Unstructured Paragraphs

**Impact**: LLMs struggle to extract key information

**Fix**:
- Break into 2-4 sentence paragraphs
- Add bullet points for lists
- Include summary sections
- Use question-style headings

### Issue: No Author Attribution

**Impact**: Lower E-E-A-T signals, less likely to be cited

**Fix**: Add author schema and visible bylines with credentials

## Integration with Other Tools

### With IndexNow for Rapid Indexing

```bash
# After content update, submit to IndexNow
python scripts/submit_indexnow.py https://example.com/updated-page

# Bing indexes in minutes, not days
# Bing data feeds ChatGPT and other LLMs
```

### With LLM Response Tester

```bash
# Run GEO audit
python scripts/geo_audit.py https://example.com

# Then test actual LLM responses
python scripts/llm_response_tester.py "What does [your site] offer?"
```

### With Search Console

Monitor AI crawler activity:
- Filter by user-agent in crawl stats
- Track impressions from AI-referred traffic
- Identify pages being crawled by GPTBot, etc.

## Competitive Analysis

Audit competitor sites to understand their GEO strategy:

```bash
# Audit competitor
python scripts/geo_audit.py https://competitor.com --output competitor_report.json

# Compare with your site
python scripts/geo_audit.py https://yoursite.com --output your_report.json

# Diff the reports
python scripts/compare_geo.py your_report.json competitor_report.json
```

## Automated Monitoring

Set up continuous GEO monitoring:

```bash
# Daily audit cron job
0 6 * * * python scripts/geo_audit.py https://example.com --output /var/logs/geo/$(date +\%Y\%m\%d).json

# Alert on score drop
python scripts/geo_monitor.py --threshold 70 --alert-webhook https://hooks.slack.com/xxx
```

## Best Practices

### Content Optimization

1. **Write for humans first**: AI rewards genuinely helpful content
2. **Be authoritative**: Include expert credentials and citations
3. **Answer questions directly**: Use question-style headings
4. **Keep it current**: Update content regularly
5. **Be unique**: Original research and insights get cited more

### Technical Optimization

1. **Implement llms.txt**: Guide AI crawlers explicitly
2. **Allow AI crawlers**: Don't block GPTBot, PerplexityBot, etc.
3. **Use IndexNow**: Get indexed in minutes, not days
4. **Add structured data**: Help AI understand context
5. **Optimize page speed**: Fast sites get crawled more

### Citation Strategy

1. **Be quotable**: Write clear, extractable statements
2. **Provide sources**: Link to authoritative references
3. **Include data**: Original statistics and research
4. **Stay updated**: Current information gets cited
5. **Build authority**: Consistent quality over time

## Resources

### Scripts

- `scripts/geo_audit.py`: Main audit script
- `scripts/generate_llms_txt.py`: Generate llms.txt from sitemap
- `scripts/submit_indexnow.py`: Submit URLs to IndexNow
- `scripts/compare_geo.py`: Compare audit reports

### References

- `references/llms_txt_spec.md`: Complete llms.txt specification
- `references/ai_crawlers.md`: AI crawler user-agents and behavior
- `references/schema_examples.md`: Schema.org examples for GEO

### External Resources

- [llms.txt Specification](https://llmstxt.org/)
- [IndexNow Protocol](https://www.indexnow.org/)
- [Schema.org](https://schema.org/)
- [Google Search Central - AI](https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers)

## Dependencies

```bash
# Required
pip install requests beautifulsoup4 lxml

# Optional for advanced features
pip install playwright  # For JavaScript rendering
pip install aiohttp    # For async auditing
```

## Summary

GEO Audit helps you:

1. **Measure AI visibility**: Score your site's LLM citation potential
2. **Identify gaps**: Find missing llms.txt, blocked crawlers, poor structure
3. **Prioritize fixes**: Focus on highest-impact improvements
4. **Monitor progress**: Track GEO score over time
5. **Beat competitors**: Understand and exceed competitor GEO strategies

The future of search is AI-powered. Optimize for it today.
