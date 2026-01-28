---
name: llm-response-tester
description: Test what ChatGPT, Perplexity, Claude, and Gemini say about your website or brand using Playwright automation. Monitor AI citations, track brand mentions, and validate GEO optimization effectiveness across multiple LLM platforms.
---

# LLM Response Tester Skill

## Overview

Automate testing of what AI systems say about your website, brand, or topics. This skill uses Playwright to query ChatGPT, Perplexity, Claude, and Gemini, then analyzes responses for citations, accuracy, and brand mentions.

Essential for validating your GEO (Generative Engine Optimization) strategy and monitoring how AI systems represent your content.

## When to Use This Skill

Use this skill when:
- Checking if your site appears in AI responses
- Monitoring brand mentions across LLM platforms
- Validating GEO optimizations are working
- Tracking competitor mentions in AI responses
- Auditing AI response accuracy about your content
- Building citation tracking dashboards
- A/B testing content changes for AI visibility

## Quick Start

### Setup

```bash
# Install dependencies
pip install playwright
playwright install chromium

# Set up API keys (for API-based testing)
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."
export PERPLEXITY_API_KEY="pplx-..."
```

### Basic Usage

```bash
# Test a single query across all platforms
python scripts/llm_tester.py "What is aitmpl.com?"

# Test with specific platforms
python scripts/llm_tester.py "Best Claude Code tools" --platforms chatgpt,perplexity

# Save results
python scripts/llm_tester.py "Who makes [product]?" --output results.json
```

## Supported Platforms

### API-Based Testing (Recommended for Automation)

| Platform | Model | API Key Variable |
|----------|-------|------------------|
| ChatGPT | gpt-4o | `OPENAI_API_KEY` |
| Claude | claude-3-5-sonnet | `ANTHROPIC_API_KEY` |
| Perplexity | sonar-pro | `PERPLEXITY_API_KEY` |
| Gemini | gemini-pro | `GOOGLE_API_KEY` |

### Browser-Based Testing (For Real UI Testing)

Uses Playwright to interact with actual web interfaces:
- chat.openai.com (ChatGPT)
- perplexity.ai
- claude.ai
- gemini.google.com

**Note**: Browser testing requires authentication and may be subject to rate limits.

## Testing Strategies

### Brand Mention Testing

Check how often and accurately your brand is mentioned:

```bash
python scripts/llm_tester.py \
  --query-file queries/brand_queries.txt \
  --check-mentions "YourBrand,yourbrand.com" \
  --output brand_report.json
```

Example query file:
```
What are the best tools for [your category]?
Who is the leader in [your industry]?
What does [YourBrand] do?
How does [YourBrand] compare to [Competitor]?
What are alternatives to [Competitor]?
```

### Citation Tracking

Monitor if AI systems cite your content:

```bash
python scripts/llm_tester.py \
  "How to [topic your content covers]" \
  --check-citations "yourdomain.com" \
  --verbose
```

### Accuracy Auditing

Verify AI responses match your actual content:

```bash
python scripts/llm_tester.py \
  "What features does [YourProduct] have?" \
  --verify-against "https://yourdomain.com/features" \
  --output accuracy_report.json
```

### Competitive Monitoring

Track competitor mentions and positioning:

```bash
python scripts/llm_tester.py \
  "Best [category] tools 2025" \
  --track-mentions "YourBrand,Competitor1,Competitor2,Competitor3" \
  --output competitive_report.json
```

## Response Analysis

### Citation Detection

The tool identifies different citation types:

```python
{
  "citations": {
    "direct_links": ["https://yourdomain.com/page"],
    "domain_mentions": ["yourdomain.com"],
    "brand_mentions": ["YourBrand"],
    "indirect_references": ["according to YourBrand's documentation"]
  },
  "citation_score": 85,  # 0-100
  "citation_position": 2  # Position in response (1 = first mentioned)
}
```

### Sentiment Analysis

Analyze how AI describes your brand:

```python
{
  "sentiment": {
    "score": 0.82,  # -1 to 1
    "label": "positive",
    "key_phrases": [
      "widely used",
      "comprehensive solution",
      "active community"
    ]
  }
}
```

### Accuracy Scoring

Compare AI responses to ground truth:

```python
{
  "accuracy": {
    "factual_score": 0.9,  # 0-1
    "completeness": 0.75,
    "outdated_info": false,
    "errors": []
  }
}
```

## Automated Monitoring

### Scheduled Testing

Set up continuous monitoring:

```bash
# cron job - test daily at 9 AM
0 9 * * * python scripts/llm_tester.py \
  --query-file queries/daily_checks.txt \
  --output /var/logs/llm/$(date +\%Y\%m\%d).json \
  --alert-webhook https://hooks.slack.com/xxx
```

### Dashboard Integration

Export results to monitoring dashboards:

```bash
# Export to Prometheus/Grafana
python scripts/llm_tester.py \
  "What is YourBrand?" \
  --export-metrics prometheus \
  --metrics-endpoint localhost:9090

# Export to custom dashboard
python scripts/llm_tester.py \
  --query-file queries/all.txt \
  --export-csv results.csv \
  --export-json results.json
```

### Alert Configuration

Get notified when AI responses change:

```yaml
# config/alerts.yaml
alerts:
  - name: brand_mention_dropped
    condition: "mention_count < previous_mention_count"
    severity: warning
    channels: [slack, email]

  - name: negative_sentiment
    condition: "sentiment_score < 0.3"
    severity: critical
    channels: [slack, pagerduty]

  - name: competitor_overtook
    condition: "competitor_position < brand_position"
    severity: warning
    channels: [slack]
```

## Browser Automation Details

### ChatGPT Testing

```python
# scripts/test_chatgpt.py
from playwright.sync_api import sync_playwright

def test_chatgpt(query: str):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Navigate and authenticate (requires saved session)
        page.goto("https://chat.openai.com")

        # Send query
        page.fill('[data-testid="chat-input"]', query)
        page.click('[data-testid="send-button"]')

        # Wait for response
        page.wait_for_selector('[data-testid="response-content"]')

        # Extract response
        response = page.inner_text('[data-testid="response-content"]')

        browser.close()
        return response
```

### Perplexity Testing

```python
# scripts/test_perplexity.py
def test_perplexity(query: str):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Perplexity allows unauthenticated queries
        page.goto("https://perplexity.ai")
        page.fill('textarea[placeholder*="Ask"]', query)
        page.press('textarea', 'Enter')

        # Wait for response with citations
        page.wait_for_selector('.citation-link')

        response = page.inner_text('.answer-content')
        citations = page.query_selector_all('.citation-link')

        browser.close()
        return {
            "response": response,
            "citations": [c.get_attribute('href') for c in citations]
        }
```

## Query Templates

### For Brand Awareness

```
What is [Brand]?
Who makes [Product]?
Tell me about [Brand]
What does [Brand] do?
What is [Brand] known for?
```

### For Product Discovery

```
Best [category] tools in 2025
Top [category] solutions
What are alternatives to [Competitor]?
[Category] comparison
How to choose a [category] tool
```

### For Feature Verification

```
What features does [Product] have?
How does [Product] work?
What can I do with [Product]?
[Product] capabilities
[Product] integrations
```

### For Competitive Analysis

```
[Brand] vs [Competitor]
[Brand] alternatives
Is [Brand] better than [Competitor]?
[Brand] pros and cons
[Category] market leaders
```

## Interpreting Results

### Citation Quality Metrics

| Metric | Good | Fair | Poor |
|--------|------|------|------|
| Direct link citation | > 50% | 20-50% | < 20% |
| Domain mention | > 70% | 40-70% | < 40% |
| Brand mention | > 80% | 50-80% | < 50% |
| First position | > 30% | 10-30% | < 10% |

### Response Consistency

Check consistency across platforms:

```python
{
  "consistency_score": 0.85,
  "platforms_mentioning": ["chatgpt", "perplexity", "claude"],
  "platforms_missing": ["gemini"],
  "response_similarity": 0.78,
  "key_fact_agreement": 0.92
}
```

### Trend Analysis

Track changes over time:

```bash
python scripts/llm_trend.py \
  --data-dir /var/logs/llm/ \
  --metric citation_count \
  --period 30d \
  --output trend_report.html
```

## Best Practices

### Query Design

1. **Use natural language**: Write queries as users would ask
2. **Include context**: Add relevant qualifiers
3. **Test variations**: Same intent, different wording
4. **Include competitors**: Compare relative positioning
5. **Test edge cases**: Uncommon but relevant queries

### Testing Frequency

| Test Type | Recommended Frequency |
|-----------|----------------------|
| Brand mentions | Daily |
| Citation tracking | Weekly |
| Competitive analysis | Weekly |
| Accuracy audits | After content updates |
| Full platform sweep | Monthly |

### Handling Rate Limits

```python
# config/rate_limits.yaml
rate_limits:
  chatgpt_api: 60/min
  chatgpt_browser: 10/hour
  perplexity_api: 100/min
  perplexity_browser: 20/hour
  claude_api: 40/min
  gemini_api: 60/min
```

## Integration with GEO Workflow

### Pre-Launch Testing

```bash
# Before launching GEO optimizations
python scripts/llm_tester.py \
  --query-file queries/baseline.txt \
  --output baseline.json

# After implementing changes
python scripts/llm_tester.py \
  --query-file queries/baseline.txt \
  --output post_changes.json

# Compare results
python scripts/compare_results.py baseline.json post_changes.json
```

### A/B Testing Content

```bash
# Test which content structure gets more citations
python scripts/ab_test.py \
  --page-a "https://example.com/feature-v1" \
  --page-b "https://example.com/feature-v2" \
  --queries "queries/feature_queries.txt" \
  --duration 7d
```

## Dependencies

```bash
# Required
pip install playwright
playwright install chromium

# For API testing
pip install openai anthropic

# For analysis
pip install pandas beautifulsoup4

# For monitoring
pip install prometheus-client
```

## Resources

### Scripts

- `scripts/llm_tester.py`: Main testing script
- `scripts/test_chatgpt.py`: ChatGPT-specific testing
- `scripts/test_perplexity.py`: Perplexity-specific testing
- `scripts/compare_results.py`: Compare test results
- `scripts/llm_trend.py`: Trend analysis

### References

- `references/query_templates.md`: Pre-built query templates
- `references/platform_selectors.md`: Playwright selectors by platform
- `references/metrics_guide.md`: Understanding metrics

## Summary

LLM Response Tester helps you:

1. **Validate GEO effectiveness**: See if optimizations lead to citations
2. **Monitor brand presence**: Track mentions across AI platforms
3. **Audit accuracy**: Ensure AI says correct things about you
4. **Track competitors**: Monitor relative positioning
5. **Automate monitoring**: Continuous citation tracking

Know what AI says about you. Influence it through better GEO.
