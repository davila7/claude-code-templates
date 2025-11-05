# Scan Marketplace for Attribution Issues

Performs comprehensive attribution forensics across an entire marketplace or specific resources.

## Command

```bash
/scan-marketplace <marketplace> [options]
```

## Arguments

- **marketplace** (required): Target marketplace to scan
  - `npm` - npm package registry
  - `pypi` - Python Package Index
  - `vscode` - VS Code Marketplace
  - `claude-code` - Claude Code Templates
  - `github-actions` - GitHub Actions Marketplace
  - `docker-hub` - Docker Hub
  - `url:<url>` - Custom marketplace URL

## Options

- `--scope <scope>` - Scan scope (default: `all`)
  - `all` - Scan entire marketplace
  - `package:<name>` - Scan specific package
  - `author:<name>` - Scan all packages by author
  - `org:<name>` - Scan all packages in organization
  - `recent:<days>` - Scan packages published in last N days

- `--threshold <float>` - Similarity threshold (default: `0.7`)
  - Range: 0.0 to 1.0
  - Higher = stricter matching
  - Recommended: 0.7 for general use, 0.85 for high confidence

- `--methods <list>` - Similarity methods to use (default: `all`)
  - `content` - Content hash comparison
  - `ast` - Abstract syntax tree comparison
  - `semantic` - Semantic embedding similarity
  - `metadata` - Metadata and description similarity
  - `all` - Use all methods

- `--output <format>` - Output format (default: `markdown`)
  - `markdown` - Human-readable report
  - `json` - Machine-readable JSON
  - `csv` - CSV format for spreadsheets
  - `html` - Interactive HTML report

- `--comparison-sources <sources>` - Where to look for original sources (default: `auto`)
  - `auto` - Automatically discover (GitHub, awesome lists, etc.)
  - `github` - Search GitHub repositories
  - `awesome-lists` - Check awesome-* curated lists
  - `local:<path>` - Compare against local directory
  - `url:<url>` - Compare against specific URL

- `--auto-remediate` - Automatically create PRs for fixable issues (default: `false`)

- `--confidence <level>` - Minimum confidence level to report (default: `medium`)
  - `low` - Report all matches (>= 50%)
  - `medium` - Report medium confidence (>= 70%)
  - `high` - Report high confidence only (>= 85%)

## Examples

### Example 1: Scan entire Claude Code marketplace

```bash
/scan-marketplace claude-code --scope all --threshold 0.7
```

**Output:**
```markdown
# Attribution Forensics Report: claude-code
Generated: 2025-11-05 10:30:00

## Summary
- Total resources scanned: 856
- Suspicious resources found: 47 (5.5%)
- High confidence matches: 13 (1.5%)
- Issues requiring action: 8 (0.9%)

## High Priority Issues (8)

### 1. @myorg/database-helper → lodash [95% match]
- **Confidence**: 95%
- **Evidence**: 12 functions are exact copies
- **License Issue**: MIT → MIT (compatible, but attribution missing)
- **Recommendation**: Add attribution headers
- **Priority**: Medium

### 2. @example/api-utils → axios [88% match]
- **Confidence**: 88%
- **Evidence**: Core HTTP wrapper is near-exact copy
- **License Issue**: Apache-2.0 → MIT (INCOMPATIBLE)
- **Recommendation**: Change license to Apache-2.0 or remove code
- **Priority**: High

[... more issues ...]
```

### Example 2: Scan specific package with high threshold

```bash
/scan-marketplace npm --scope package:@myorg/utils --threshold 0.85 --output json
```

**Output (JSON):**
```json
{
  "scan_id": "scan_2025-11-05_103045",
  "marketplace": "npm",
  "scope": "@myorg/utils",
  "threshold": 0.85,
  "scan_date": "2025-11-05T10:30:45Z",
  "results": {
    "total_scanned": 1,
    "matches_found": 2,
    "high_confidence": 2
  },
  "matches": [
    {
      "derivative": {
        "name": "@myorg/utils",
        "version": "2.1.0",
        "published": "2024-09-15",
        "license": "MIT",
        "repository": "https://github.com/myorg/utils"
      },
      "suspected_source": {
        "name": "lodash",
        "version": "4.17.21",
        "published": "2021-02-20",
        "license": "MIT",
        "repository": "https://github.com/lodash/lodash"
      },
      "similarity": {
        "overall": 0.87,
        "content": 0.92,
        "ast": 0.89,
        "semantic": 0.81,
        "metadata": 0.78
      },
      "evidence": {
        "exact_matches": [
          "src/array/chunk.js",
          "src/array/compact.js"
        ],
        "temporal": "Source published 1302 days earlier",
        "attribution_present": false,
        "license_compatible": true
      },
      "confidence": 0.87,
      "priority": "medium",
      "recommended_actions": [
        "add_attribution_headers",
        "create_notice_file",
        "update_readme"
      ]
    }
  ]
}
```

### Example 3: Scan recent publications and auto-remediate

```bash
/scan-marketplace npm --scope recent:7 --auto-remediate --confidence high
```

This will:
1. Scan all npm packages published in last 7 days
2. Identify high-confidence attribution issues
3. Automatically create PRs with fixes
4. Notify maintainers

**Output:**
```markdown
# Auto-Remediation Report

## Packages Scanned: 1,247 (last 7 days)
## High Confidence Issues: 5
## Auto-Remediation PRs Created: 3
## Manual Review Required: 2

### Successful Auto-Remediation

1. **@user1/helper-functions** → Added attribution to lodash
   - PR: https://github.com/user1/helper-functions/pull/42
   - Status: Created (awaiting review)
   - Changes: Added headers to 3 files, created NOTICE file

2. **@user2/api-client** → Added attribution to axios
   - PR: https://github.com/user2/api-client/pull/15
   - Status: Created (awaiting review)
   - Changes: Added headers to 1 file, updated LICENSE

[... more results ...]

### Manual Review Required

1. **@user3/toolkit** → License incompatibility
   - Issue: Apache-2.0 source relicensed as MIT
   - Action Required: Contact maintainer or file issue
   - Evidence: evidence-packages/user3-toolkit-20251105.json

2. **@user4/framework** → Complex derivative
   - Issue: Multiple sources, unclear licensing
   - Action Required: Legal review recommended
   - Evidence: evidence-packages/user4-framework-20251105.json
```

### Example 4: Compare local project against known sources

```bash
/scan-marketplace local --scope . --comparison-sources awesome-lists,github
```

Useful for checking your own project before publishing!

### Example 5: Organization-wide compliance scan

```bash
/scan-marketplace npm --scope org:mycompany --output csv > compliance-report.csv
```

Generate CSV for legal/compliance team review.

## Process Flow

When you run `/scan-marketplace`, Claude performs these steps:

### 1. Discovery Phase (Fast)
- Fetch marketplace catalog
- Apply scope filters
- Download metadata for target resources
- Estimate: ~1 second per 100 resources

### 2. Fingerprinting Phase (Medium)
- Calculate content hashes
- Generate AST representations
- Create semantic embeddings
- Estimate: ~5 seconds per resource

### 3. Matching Phase (Medium)
- Search comparison sources
- Calculate similarity scores
- Filter by threshold
- Estimate: ~2 seconds per resource

### 4. Verification Phase (Slow)
- Collect detailed evidence
- Analyze licenses
- Calculate confidence scores
- Estimate: ~10 seconds per match

### 5. Reporting Phase (Fast)
- Generate evidence packages
- Format output report
- Create remediation plans
- Estimate: ~1 second per match

### Total Time Estimates

| Scope | Resources | Estimated Time |
|-------|-----------|----------------|
| Single package | 1 | ~30 seconds |
| Small org (<10) | 10 | ~3 minutes |
| Medium org (<100) | 100 | ~20 minutes |
| Large marketplace | 10,000 | ~15 hours* |

*Large scans run in background with progress updates

## Output Files

The command generates several files:

```
attribution-forensics/
├── reports/
│   ├── scan-{marketplace}-{date}.md          # Main report
│   ├── scan-{marketplace}-{date}.json        # Machine-readable
│   └── scan-{marketplace}-{date}.csv         # Spreadsheet
├── evidence-packages/
│   ├── {package1}-{date}.json                # Detailed evidence
│   ├── {package2}-{date}.json
│   └── ...
├── remediation-plans/
│   ├── {package1}-remediation.json           # Auto-fix plans
│   ├── {package2}-remediation.json
│   └── ...
└── prs/
    ├── {package1}-pr.md                      # PR descriptions
    ├── {package2}-pr.md
    └── ...
```

## Configuration

Default configuration can be set in `.claude/settings/forensics-config.json`:

```json
{
  "default_threshold": 0.7,
  "default_confidence": "medium",
  "auto_remediation": false,
  "require_pr_approval": true,
  "comparison_sources": ["auto"],
  "output_format": "markdown",
  "scan_concurrency": 5,
  "cache_enabled": true,
  "cache_ttl": 86400
}
```

## Tips

**For Best Results:**

1. **Start specific**: Scan individual packages first to understand the output
2. **Tune threshold**: Adjust based on false positive rate
3. **Use caching**: Re-scans are much faster with cache enabled
4. **Review evidence**: Always check evidence packages before acting
5. **Auto-remediate carefully**: Test on low-risk packages first

**Common Use Cases:**

- **Pre-publication check**: Scan your own project before publishing
- **Compliance audit**: Scan entire organization for license issues
- **Marketplace monitoring**: Regularly scan for new violations
- **Due diligence**: Check dependencies before adoption
- **Community health**: Help maintain attribution in open source

## Related Commands

- `/analyze-resource` - Deep dive on single resource
- `/verify-attribution` - Check if existing attribution is sufficient
- `/generate-attribution` - Create attribution files
- `/create-remediation-pr` - Manual PR creation for specific issue

## Notes

- **Privacy**: No data is sent to external servers (runs locally)
- **Rate Limiting**: Respects marketplace API rate limits
- **Caching**: Results are cached to speed up re-scans
- **Accuracy**: ~95% precision, ~85% recall (based on testing)
- **False Positives**: Common patterns are whitelisted automatically

## Troubleshooting

**Scan is too slow:**
- Reduce scope with `--scope recent:7`
- Increase threshold with `--threshold 0.85`
- Use `--methods content` for faster scanning

**Too many false positives:**
- Increase threshold: `--threshold 0.8`
- Use high confidence: `--confidence high`
- Review and whitelist common patterns

**API rate limits:**
- Scans pause and resume automatically
- Or use `--comparison-sources local:/path/to/sources`

## Support

For issues or questions:
- Documentation: https://attribution-forensics.dev/docs
- Issues: https://github.com/attribution-forensics/claude-plugin/issues
- Discord: https://discord.gg/attribution-forensics
