---
name: submit-indexnow
description: Submit URLs to IndexNow for instant indexing on Bing. Critical for GEO as Bing feeds ChatGPT, Perplexity, and other LLMs. Index new content in minutes, not days.
---

# Submit IndexNow Skill

## Overview

Submit URLs to IndexNow for instant indexing on Bing, which feeds data to ChatGPT, Perplexity, and other LLMs. This is a critical component of any GEO (Generative Engine Optimization) strategy.

**Why IndexNow matters for GEO:**
- Bing indexes in minutes vs Google's days
- ChatGPT's browsing mode uses Bing index
- Perplexity pulls from Bing data
- New content appears in AI responses faster

## When to Use This Skill

Use this skill when:
- Publishing new content that should appear in AI responses
- Updating existing pages with significant changes
- Launching new product pages or blog posts
- Deploying website changes that affect multiple pages
- Automating indexing in CI/CD pipelines

## Quick Start

### Submit a Single URL

```bash
python scripts/submit_indexnow.py https://example.com/new-article
```

### Submit from Sitemap

```bash
python scripts/submit_indexnow.py --sitemap https://example.com/sitemap.xml
```

### Submit Changed Files (Git-based)

```bash
python scripts/submit_indexnow.py --changed
```

## Configuration

### Environment Variables

```bash
# Your IndexNow key (generate UUID or custom key)
export INDEXNOW_KEY="your-unique-key-here"

# Your site URL
export SITE_URL="https://example.com"
```

### Key Verification File

Create the verification file at your domain root:

```
https://yourdomain.com/{INDEXNOW_KEY}.txt
```

The file should contain only the key string.

## Usage Examples

### Command Line Interface

```bash
# Single URL
python scripts/submit_indexnow.py https://example.com/blog/new-post

# Multiple URLs
python scripts/submit_indexnow.py \
  https://example.com/page1 \
  https://example.com/page2 \
  https://example.com/page3

# From sitemap
python scripts/submit_indexnow.py --sitemap https://example.com/sitemap.xml

# Recently changed (last 24h from git)
python scripts/submit_indexnow.py --changed

# From file (one URL per line)
python scripts/submit_indexnow.py --batch urls-to-index.txt

# Verify before submitting
python scripts/submit_indexnow.py https://example.com/page --verify
```

### Python API

```python
from submit_indexnow import IndexNowSubmitter

submitter = IndexNowSubmitter(
    key="your-indexnow-key",
    site_url="https://example.com"
)

# Submit single URL
result = submitter.submit("https://example.com/new-page")
print(f"Status: {result.status_code}")

# Submit batch
urls = [
    "https://example.com/page1",
    "https://example.com/page2"
]
results = submitter.submit_batch(urls)

# Submit from sitemap
results = submitter.submit_sitemap("https://example.com/sitemap.xml")
```

## How It Works

1. **URL Validation**: Verifies URLs belong to your configured domain
2. **Key Verification**: Checks that your key file is accessible
3. **API Submission**: Sends URLs to IndexNow endpoints (Bing, Yandex, IndexNow.org)
4. **Response Handling**: Returns status for each URL
5. **Rate Limiting**: Respects API limits (10,000 URLs/day)

## API Response Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | URL submitted successfully | None needed |
| 202 | URL accepted for processing | None needed |
| 400 | Invalid URL format | Fix URL syntax |
| 403 | Key validation failed | Check key file |
| 422 | URL doesn't match site | Use correct domain |
| 429 | Rate limit exceeded | Wait and retry |

## Automation

### Git Hook (post-commit)

```bash
#!/bin/bash
# .git/hooks/post-commit

# Get changed files
changed_files=$(git diff --name-only HEAD~1 HEAD)

# Build URL list for docs/public folder
urls=""
for file in $changed_files; do
  if [[ $file == docs/* ]] || [[ $file == public/* ]]; then
    # Convert file path to URL
    path="${file#docs/}"
    path="${path#public/}"
    url="${SITE_URL}/${path%.md}"
    urls="$urls $url"
  fi
done

# Submit if we have URLs
if [ -n "$urls" ]; then
  python scripts/submit_indexnow.py $urls
fi
```

### GitHub Actions

```yaml
# .github/workflows/indexnow.yml
name: Submit to IndexNow

on:
  push:
    branches: [main]
    paths:
      - 'docs/**'
      - 'public/**'
      - 'content/**'

jobs:
  submit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2

      - name: Get changed files
        id: changes
        run: |
          echo "files=$(git diff --name-only HEAD~1 HEAD | tr '\n' ' ')" >> $GITHUB_OUTPUT

      - name: Submit to IndexNow
        env:
          INDEXNOW_KEY: ${{ secrets.INDEXNOW_KEY }}
          SITE_URL: ${{ vars.SITE_URL }}
        run: |
          python scripts/submit_indexnow.py --changed
```

### Vercel Deploy Hook

```javascript
// api/indexnow-hook.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { urls } = req.body;
  const key = process.env.INDEXNOW_KEY;
  const host = 'yourdomain.com';

  const response = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      host,
      key,
      keyLocation: `https://${host}/${key}.txt`,
      urlList: urls
    })
  });

  return res.status(response.status).json({
    submitted: urls.length,
    status: response.status
  });
}
```

### Cron Job

```bash
# Submit sitemap daily at midnight
0 0 * * * python /path/to/scripts/submit_indexnow.py --sitemap https://example.com/sitemap.xml

# Submit on weekdays at 9am
0 9 * * 1-5 python /path/to/scripts/submit_indexnow.py --changed
```

## Best Practices

### Do's

- Submit new content immediately after publishing
- Use sitemap submission for bulk updates
- Set up automation for consistent indexing
- Monitor submission success rates
- Keep your key file accessible

### Don'ts

- Don't submit the same URLs repeatedly
- Don't exceed 10,000 URLs per day
- Don't submit non-canonical URLs
- Don't submit pages with noindex
- Don't share your IndexNow key publicly

## Troubleshooting

### Key Verification Failed (403)

```bash
# Check if key file is accessible
curl -I https://yourdomain.com/your-key.txt

# Should return 200 OK with the key content
```

### URL Mismatch (422)

```bash
# URLs must match your configured domain
# Wrong: submit_indexnow.py https://other-domain.com/page
# Right: submit_indexnow.py https://yourdomain.com/page
```

### Rate Limited (429)

```bash
# Wait before retrying, use exponential backoff
# Consider batch submissions instead of individual URLs
```

## Integration with GEO Strategy

### Full GEO Workflow

```bash
# 1. Publish new content

# 2. Submit to IndexNow (instant Bing indexing)
python scripts/submit_indexnow.py https://example.com/new-article

# 3. Run GEO audit to verify optimization
python scripts/geo_audit.py https://example.com/new-article

# 4. Test LLM responses (after indexing)
python scripts/llm_tester.py "What does example.com say about [topic]?"
```

### With llms.txt

```bash
# After updating llms.txt, submit it
python scripts/submit_indexnow.py https://example.com/llms.txt
```

## Resources

### Scripts
- `scripts/submit_indexnow.py`: Main submission script

### External Documentation
- [IndexNow Official Documentation](https://www.indexnow.org/documentation)
- [Bing Webmaster Tools](https://www.bing.com/webmasters)
- [IndexNow API Reference](https://www.indexnow.org/api)

## Dependencies

```bash
pip install requests
```

## Summary

IndexNow is essential for GEO because:

1. **Speed**: Minutes vs days for indexing
2. **LLM Data Source**: Bing feeds ChatGPT and Perplexity
3. **Competitive Edge**: Your content appears in AI responses before competitors
4. **Automation**: Easy to integrate into any workflow
5. **Free**: No cost, supported by major search engines

Make IndexNow submission part of your publishing workflow to maximize AI visibility.
