---
name: submit-indexnow
description: Submit URLs to IndexNow for instant indexing on Bing. Critical for GEO as Bing feeds ChatGPT, Perplexity, and other LLMs. Index new content in minutes, not days.
command_type: claude_slash
---

# /submit-indexnow

Submit URLs to IndexNow for instant indexing on Bing, which feeds data to ChatGPT, Perplexity, and other LLMs.

## Usage

```
/submit-indexnow [url|--sitemap|--changed]
```

## Arguments

| Argument | Description |
|----------|-------------|
| `url` | Single URL to submit for indexing |
| `--sitemap [url]` | Submit all URLs from a sitemap |
| `--changed` | Submit URLs changed in last 24 hours (from git) |
| `--batch [file]` | Submit URLs from a text file (one per line) |
| `--verify` | Check if URLs are already indexed before submitting |

## Examples

### Submit a single URL

```
/submit-indexnow https://aitmpl.com/blog/new-article
```

### Submit from sitemap

```
/submit-indexnow --sitemap https://aitmpl.com/sitemap.xml
```

### Submit recently changed pages

```
/submit-indexnow --changed
```

### Submit batch from file

```
/submit-indexnow --batch urls-to-index.txt
```

## How It Works

1. **URL Validation**: Verifies URLs belong to your configured domain
2. **IndexNow API**: Submits to multiple endpoints (Bing, Yandex, IndexNow)
3. **Verification**: Optionally checks if URLs are already indexed
4. **Reporting**: Shows submission status and any errors

## Configuration

Set these environment variables:

```bash
# Your IndexNow key (create one or use UUID)
INDEXNOW_KEY=your-unique-key-here

# Your site URL
SITE_URL=https://aitmpl.com
```

Also create the key verification file:
```
https://yourdomain.com/{INDEXNOW_KEY}.txt
```
containing just the key string.

## Why IndexNow for GEO?

1. **Speed**: Bing indexes in minutes vs Google's days
2. **LLM Data Source**: ChatGPT's browse feature uses Bing
3. **AI Search**: Perplexity pulls from Bing index
4. **Faster Citations**: Content appears in AI responses sooner

## Automation Tips

### Git Hook (post-commit)

```bash
#!/bin/bash
# .git/hooks/post-commit
changed_files=$(git diff --name-only HEAD~1)
urls=""
for file in $changed_files; do
  if [[ $file == docs/* ]]; then
    url="https://aitmpl.com/${file#docs/}"
    urls="$urls $url"
  fi
done
if [ -n "$urls" ]; then
  /submit-indexnow $urls
fi
```

### CI/CD Integration

```yaml
# .github/workflows/deploy.yml
- name: Submit to IndexNow
  run: |
    npx claude-code-templates --command submit-indexnow --changed
  env:
    INDEXNOW_KEY: ${{ secrets.INDEXNOW_KEY }}
```

### Cron Job

```bash
# Submit sitemap daily at midnight
0 0 * * * /submit-indexnow --sitemap https://aitmpl.com/sitemap.xml
```

## Response Codes

| Code | Meaning |
|------|---------|
| 200 | URL submitted successfully |
| 202 | URL accepted for processing |
| 400 | Invalid URL format |
| 403 | Key validation failed |
| 422 | URL not matching site |
| 429 | Too many requests |

## Related Commands

- `/geo-audit` - Audit site for GEO optimization
- `/generate-llms-txt` - Generate llms.txt file
- `/test-llm-response` - Test AI responses about your site

## Resources

- [IndexNow Documentation](https://www.indexnow.org/documentation)
- [Bing Webmaster Tools](https://www.bing.com/webmasters)
