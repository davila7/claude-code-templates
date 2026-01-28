---
name: geo-report
description: Generate a comprehensive GEO (Generative Engine Optimization) report for your website. Analyzes AI visibility, llms.txt, crawler rules, structured data, and citation potential.
command_type: claude_slash
---

# /geo-report

Generate a comprehensive Generative Engine Optimization (GEO) report analyzing your site's visibility to AI systems like ChatGPT, Perplexity, Claude, and Gemini.

## Usage

```
/geo-report [url] [options]
```

## Arguments

| Argument | Description |
|----------|-------------|
| `url` | Website URL to audit (default: current project site) |
| `--full` | Include all checks (default) |
| `--quick` | Quick audit (llms.txt + robots.txt only) |
| `--output [file]` | Save report to file (json/html/md) |
| `--compare [url]` | Compare with competitor site |

## Examples

### Full audit

```
/geo-report https://aitmpl.com
```

### Quick check

```
/geo-report https://example.com --quick
```

### Compare with competitor

```
/geo-report https://mysite.com --compare https://competitor.com
```

### Export report

```
/geo-report https://aitmpl.com --output geo-report.html
```

## Report Sections

### 1. Executive Summary (Score: 0-100)

```
GEO Score: 78/100
Rating: GOOD

Strengths:
  + llms.txt properly configured
  + AI crawlers allowed in robots.txt
  + Rich structured data (FAQ, Article)

Weaknesses:
  - No IndexNow implementation
  - Missing Organization schema
  - Long paragraphs reduce extractability
```

### 2. llms.txt Analysis

```
Status: FOUND
Location: /llms.txt
Size: 12.4 KB
Sections: 8
Pages listed: 156

Issues:
  - Missing contact information
  - 3 broken URLs detected

Recommendations:
  1. Add Contact: field with email
  2. Fix broken URLs in Section: Blog
```

### 3. AI Crawler Configuration

```
robots.txt AI Rules:
  GPTBot: ALLOWED (with crawl-delay: 2)
  PerplexityBot: ALLOWED
  ClaudeBot: ALLOWED
  Google-Extended: BLOCKED ⚠️
  CCBot: ALLOWED

Recommendations:
  1. Consider allowing Google-Extended for Gemini
  2. Add explicit allow for /llms.txt
```

### 4. Structured Data

```
Schema Types Found:
  + Organization (complete)
  + WebSite (with SearchAction)
  + Article (15 pages)
  + FAQ (3 pages)
  - HowTo (not found)
  - BreadcrumbList (not found)

Coverage: 65%

Recommendations:
  1. Add BreadcrumbList to all pages
  2. Implement HowTo schema for tutorials
```

### 5. Content Structure

```
Heading Analysis:
  H1 tags: 1 per page ✓
  H2-H6 hierarchy: Proper ✓
  Question headings: 23% (aim for >30%)

Paragraph Analysis:
  Average length: 4.2 sentences (ideal: 2-4)
  Bullet lists: 45 found ✓
  Summary sections: 12% of pages

Recommendations:
  1. Add more question-style headings
  2. Break longer paragraphs
  3. Add TL;DR sections to articles
```

### 6. IndexNow Status

```
Status: NOT CONFIGURED ⚠️

Setup Required:
  1. Generate IndexNow key
  2. Create /{key}.txt verification file
  3. Configure submission automation

Impact: New content takes days vs minutes to appear in AI responses
```

### 7. Citation Signals

```
E-E-A-T Analysis:
  Author attribution: 60% of pages
  Credentials shown: 30% of authors
  External sources cited: 45 unique domains
  Original data/research: 5 pages

Authority Signals:
  Domain age: 2 years
  Backlinks: 1,234 (from 89 domains)
  Social proof: GitHub stars, npm downloads

Recommendations:
  1. Add author bios with credentials
  2. Include more original research
  3. Add publication dates to all content
```

### 8. Competitive Comparison (if --compare used)

```
Metric           Your Site    Competitor    Diff
─────────────────────────────────────────────────
GEO Score        78           85           -7
llms.txt         ✓            ✓            =
AI Crawlers      5/7          7/7          -2
Schema Types     4            6            -2
Question H2s     23%          41%          -18%
IndexNow         ✗            ✓            Missing
```

## Score Breakdown

| Category | Weight | Description |
|----------|--------|-------------|
| llms.txt | 25% | Presence, completeness, accuracy |
| AI Crawlers | 20% | robots.txt rules for AI bots |
| Structured Data | 20% | Schema.org implementation |
| Content Structure | 15% | Headings, paragraphs, lists |
| IndexNow | 10% | Instant indexing setup |
| Citation Signals | 10% | E-E-A-T, authority markers |

## Output Formats

### JSON (for automation)

```json
{
  "score": 78,
  "rating": "GOOD",
  "sections": {
    "llms_txt": { "score": 22, "max": 25, "issues": [] },
    "ai_crawlers": { "score": 18, "max": 20, "issues": [] }
  },
  "recommendations": [...]
}
```

### HTML (for sharing)

Visual report with charts and detailed breakdown.

### Markdown (for documentation)

Text-based report suitable for README or wiki.

## Automation

### Weekly Reports

```bash
# Generate weekly GEO report
/geo-report https://mysite.com --output reports/geo-$(date +%Y%m%d).html
```

### CI/CD Check

```yaml
- name: GEO Audit
  run: |
    score=$(npx claude-code-templates --command geo-report --output json | jq '.score')
    if [ $score -lt 70 ]; then
      echo "GEO score below threshold: $score"
      exit 1
    fi
```

### Monitoring

```bash
# Alert on score drop
/geo-report https://mysite.com --compare-baseline reports/baseline.json --alert-threshold 5
```

## Related Commands

- `/submit-indexnow` - Submit URLs for instant indexing
- `/generate-llms-txt` - Create or update llms.txt
- `/test-llm-response` - Test AI responses about your site

## Resources

- [GEO Best Practices](https://aitmpl.com/blog/geo-optimization)
- [llms.txt Specification](https://llmstxt.org/)
- [IndexNow Protocol](https://www.indexnow.org/)
