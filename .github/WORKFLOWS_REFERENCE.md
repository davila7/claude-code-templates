# GitHub Workflows Reference

## ✅ Active Workflows

### `deploy.yml` - **CLOUDFLARE PAGES DEPLOYMENT**
- **Status**: ✅ ACTIVE - Production deployment
- **Purpose**: Builds `dashboard/` and deploys it to the Cloudflare Pages project `aitmpl-dashboard` (www.aitmpl.com and app.aitmpl.com)
- **Trigger**: Push to main touching `dashboard/**`, or manual dispatch
- **Features**:
  - Astro build + `wrangler pages deploy dist`
  - Needs the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets

### `pages-build-deployment` - **GITHUB PAGES (LEGACY)**
- **Status**: ⚠️ LEGACY - not a file in this repository
- **Purpose**: GitHub's built-in Pages build, configured from repository settings against the `docs/` folder on `main`. It publishes the old static site to `davila7.github.io/claude-code-templates`.
- **Trigger**: Every push to main
- **Note**: Nothing in production depends on it — www.aitmpl.com is served by Cloudflare Pages, and every article under `docs/blog/` already canonicalises to `aitmpl.com`. It can be switched off with Settings → Pages → Source: None.

## 📊 Download Tracking System

**Current Architecture**: Direct Supabase database integration

- **Method**: CLI directly sends tracking data to Supabase API endpoint
- **Endpoint**: `https://www.aitmpl.com/api/track-download-supabase`
- **Database**: Supabase PostgreSQL with anonymous data collection
- **Real-time**: Immediate tracking on component installation
- **Privacy**: Completely anonymous, no personal data collected

## Usage Instructions

### For Production Deployment
**Use**: `deploy.yml` (triggers automatically on main branch)

### For Package Publishing
The CLI is published to npm as `claude-code-templates`, by hand, from a
maintainer's machine — see the "Publishing Workflow" section of `CLAUDE.md`.
No workflow publishes it.

## Migration History

**Previous Tracking System**: The project previously used multiple GitHub Actions workflows for download tracking:
- `analytics-processor.yml` - Processed GitHub Issues as data backend
- `tracking-dispatch.yml` - Handled repository dispatch events  
- `process-tracking-logs.yml` - Processed GitHub Pages access logs
- `simple-tracking.yml` - Manual workflow dispatch system

**Current System**: All tracking workflows have been **removed** and replaced with direct Supabase database integration from the CLI. This provides:
- ✅ Real-time tracking (no workflow delays)
- ✅ Better performance (no GitHub API rate limits)
- ✅ Simpler maintenance (no complex workflow logic)
- ✅ Higher reliability (no dependency on GitHub Actions)

## Troubleshooting

### Workflow Issues
- **Deployment failed**: Check the `CLOUDFLARE_API_TOKEN` secret and the Cloudflare Pages environment variables
- **Pages not updating**: `docs/` is the legacy GitHub Pages site, unrelated to www.aitmpl.com

### Download Tracking Issues
- **Tracking not working**: Verify CLI is updated and Supabase endpoint is accessible
- **Debug tracking**: Run CLI with `CCT_DEBUG=true` environment variable
- **Opt-out**: Set `CCT_NO_TRACKING=true` to disable tracking

---

Last updated: 2026-09-20  
Active tracking system: Direct Supabase database integration