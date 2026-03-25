# GitHub Workflows Reference

## ✅ Active Workflows

### `deploy.yml` - **VERCEL DEPLOYMENT**
- **Status**: ✅ ACTIVE - Production deployment
- **Purpose**: Deploys main site to Vercel production
- **Trigger**: Push to main branch
- **Features**: 
  - Automated Vercel deployment
  - Production environment setup
  - Zero-downtime deployment

### `deploy-docusaurus.yml` - **GITHUB PAGES DEPLOYMENT**
- **Status**: ✅ ACTIVE - Documentation site
- **Purpose**: Deploys main site to GitHub Pages
- **Trigger**: Push to main branch or manual dispatch
- **Features**:
  - Builds and deploys documentation
  - GitHub Pages integration
  - Jekyll disabled (.nojekyll)

### `publish-package.yml` - **PACKAGE PUBLISHING**
- **Status**: ✅ ACTIVE - Package distribution
- **Purpose**: Publishes CLI package to GitHub Packages
- **Trigger**: Release published or manual dispatch
- **Features**:
  - Automated version management
  - GitHub Packages publishing
  - NPM registry integration

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

### For Documentation Updates  
**Use**: `deploy-docusaurus.yml` (triggers automatically on main branch)

### For Package Publishing
**Use**: `publish-package.yml`

```bash
# Trigger manual package publishing
gh workflow run "Publish Package to GitHub Packages" \
  --field version=patch
```

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
- **Deployment failed**: Check Vercel token and environment variables
- **Pages not updating**: Verify GitHub Pages settings and branch configuration
- **Package publishing failed**: Ensure GitHub token has packages:write permission

### Download Tracking Issues
- **Tracking not working**: Verify CLI is updated and Supabase endpoint is accessible
- **Debug tracking**: Run CLI with `CCT_DEBUG=true` environment variable
- **Opt-out**: Set `CCT_NO_TRACKING=true` to disable tracking

---

Last updated: 2025-08-19  
Active tracking system: Direct Supabase database integration