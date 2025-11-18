# Security Checklist - Claude Code Templates

## Daily Checks
- [ ] Monitor Vercel function logs for errors or suspicious activity
- [ ] Check API endpoint response times
- [ ] Review any error reports or user complaints

## Weekly Security Tasks
- [ ] Run `npm audit` to check for new vulnerabilities
- [ ] Review Vercel Analytics for unusual traffic patterns
- [ ] Check GitHub security alerts (if repository is on GitHub)
- [ ] Update local dependencies: `npm update`

## Monthly Security Review
- [ ] Full dependency audit and update
  ```bash
  npm audit
  npm outdated
  npm update
  ```
- [ ] Review and rotate API keys if needed
- [ ] Check Supabase usage and security logs
- [ ] Verify backup procedures are working
- [ ] Review rate limiting effectiveness

## Quarterly Security Assessment
- [ ] Comprehensive security audit
- [ ] Penetration testing of API endpoints
- [ ] Review and update security headers
- [ ] Update security documentation
- [ ] Review GDPR/privacy compliance

## Pre-Deployment Checklist
- [ ] Run `npm audit` - ensure no high/critical vulnerabilities
- [ ] Run all tests: `npm test`
- [ ] Run API tests: `cd api && npm test`
- [ ] Verify environment variables are set correctly
- [ ] Check that sensitive files are in .gitignore
- [ ] Review code changes for security issues
- [ ] Test rate limiting is working
- [ ] Verify CORS configuration is appropriate

## Incident Response Plan

### If Vulnerability Detected:
1. **Assess Severity**
   - Critical/High: Fix within 24 hours
   - Medium: Fix within 7 days
   - Low: Fix within 30 days

2. **Immediate Actions**
   - Run security upgrade script: `./security-upgrade.sh`
   - Create backup: `cp package*.json backup/`
   - Document the vulnerability

3. **Remediation**
   - Update affected packages
   - Test thoroughly
   - Deploy fix
   - Monitor for issues

4. **Post-Incident**
   - Document lessons learned
   - Update security procedures
   - Notify stakeholders if needed

## Security Tools & Commands

### NPM Security Commands
```bash
# Check for vulnerabilities
npm audit

# Fix automatically (careful with breaking changes)
npm audit fix

# See what would be fixed
npm audit fix --dry-run

# Force fixes (may break things)
npm audit fix --force

# Check outdated packages
npm outdated

# Update packages
npm update
```

### Vercel Security Commands
```bash
# Check function logs
vercel logs aitmpl.com --follow

# Check deployment status
vercel ls

# Rollback if needed
vercel rollback
```

### Testing Commands
```bash
# Run all tests
npm test

# API tests
cd api && npm test

# Check syntax
node --check src/index.js

# Validate package.json
npm ls
```

## Security Contacts

- **Primary Security Lead:** [Your Name]
- **Vercel Support:** https://vercel.com/support
- **Supabase Support:** https://supabase.com/support
- **Discord Security:** abuse@discord.com

## API Security Configuration

### Required Headers (Minimum)
```javascript
res.setHeader('X-Content-Type-Options', 'nosniff');
res.setHeader('X-Frame-Options', 'DENY');
res.setHeader('X-XSS-Protection', '1; mode=block');
res.setHeader('Strict-Transport-Security', 'max-age=31536000');
```

### Rate Limiting Configuration
```javascript
// Recommended limits
const RATE_LIMITS = {
  '/api/track-download': { window: 15, max: 100 },
  '/api/discord': { window: 5, max: 30 },
  '/api/claude-code-check': { window: 60, max: 10 }
};
```

### Input Validation Rules
```javascript
// Component name: alphanumeric + dash/underscore only
const nameRegex = /^[a-zA-Z0-9-_]+$/;

// Max lengths
const MAX_LENGTHS = {
  name: 255,
  path: 500,
  category: 100,
  userAgent: 255
};
```

## Privacy & Compliance

### GDPR Checklist
- [ ] IP addresses are anonymized before storage
- [ ] User agent strings are truncated to reasonable length
- [ ] No PII (Personally Identifiable Information) is logged
- [ ] Data retention policy is documented
- [ ] Privacy policy is available

### Data Handling
- [ ] Sensitive data encrypted at rest (Supabase handles this)
- [ ] All API communications use HTTPS
- [ ] No credentials in code or version control
- [ ] Environment variables used for secrets

## Monitoring & Alerting

### What to Monitor
1. **API Response Times**
   - Normal: < 500ms
   - Warning: 500-1000ms
   - Critical: > 1000ms

2. **Error Rates**
   - Normal: < 1%
   - Warning: 1-5%
   - Critical: > 5%

3. **Rate Limit Hits**
   - Monitor for abuse patterns
   - Adjust limits if needed

4. **Database Performance**
   - Query times
   - Connection pool usage
   - Storage usage

### Alert Thresholds
- 5xx errors > 10 in 5 minutes
- Response time > 2 seconds for > 1 minute
- Rate limit exceeded > 100 times in 1 hour
- Database connection failures

## Security Resources

- **OWASP Top 10:** https://owasp.org/Top10/
- **Node.js Security:** https://nodejs.org/en/docs/guides/security/
- **Vercel Security:** https://vercel.com/docs/security
- **NPM Security:** https://docs.npmjs.com/auditing-package-dependencies-for-security-vulnerabilities

---

**Last Updated:** November 18, 2025
**Next Review:** December 18, 2025

Remember: Security is not a one-time task but an ongoing process. Stay vigilant!