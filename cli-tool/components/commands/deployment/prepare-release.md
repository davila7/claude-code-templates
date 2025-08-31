---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [version-type] | patch | minor | major | --pre-release | --hotfix
description: Prepare and validate release packages with comprehensive testing, documentation, and automation
model: sonnet
---

# Release Preparation

Prepare and validate release: $ARGUMENTS

## Current Release Context

- Current version: !`git describe --tags --abbrev=0 2>/dev/null || echo "No previous releases"`
- Package version: @package.json or @setup.py or @pyproject.toml or @go.mod (if exists)
- Unreleased changes: !`git log $(git describe --tags --abbrev=0)..HEAD --oneline 2>/dev/null | wc -l || echo "All commits"`
- Branch status: !`git status --porcelain | wc -l || echo "0"` uncommitted changes
- Build status: !`npm test 2>/dev/null || python -m pytest 2>/dev/null || go test ./... 2>/dev/null || echo "Test framework detection needed"`

## Task

Systematic release preparation: $ARGUMENTS

1. **Release Planning and Validation**
   - Determine release version number (semantic versioning)
   - Review and validate all features included in release
   - Check that all planned issues and features are complete
   - Verify release criteria and acceptance requirements

2. **Pre-Release Checklist**
   - Ensure all tests are passing (unit, integration, E2E)
   - Verify code coverage meets project standards
   - Complete security vulnerability scanning
   - Perform performance testing and validation
   - Review and approve all pending pull requests

3. **Version Management**
   ```bash
   # Check current version
   git describe --tags --abbrev=0
   
   # Determine next version (semantic versioning)
   # MAJOR.MINOR.PATCH
   # MAJOR: Breaking changes
   # MINOR: New features (backward compatible)
   # PATCH: Bug fixes (backward compatible)
   
   # Example version updates
   # 1.2.3 -> 1.2.4 (patch)
   # 1.2.3 -> 1.3.0 (minor)
   # 1.2.3 -> 2.0.0 (major)
   ```

4. **Code Freeze and Branch Management**
   ```bash
   # Create release branch from main
   git checkout main
   git pull origin main
   git checkout -b release/v1.2.3
   
   # Alternative: Use main branch directly for smaller releases
   # Ensure no new features are merged during release process
   ```

5. **Version Number Updates**
   - Update package.json, setup.py, or equivalent version files
   - Update version in application configuration
   - Update version in documentation and README
   - Update API version if applicable

   ```bash
   # Node.js projects
   npm version patch  # or minor, major
   
   # Python projects
   # Update version in setup.py, __init__.py, or pyproject.toml
   
   # Manual version update
   sed -i 's/"version": "1.2.2"/"version": "1.2.3"/' package.json
   ```

6. **Changelog Generation**
   ```markdown
   # CHANGELOG.md
   
   ## [1.2.3] - 2024-01-15
   
   ### Added
   - New user authentication system
   - Dark mode support for UI
   - API rate limiting functionality
   
   ### Changed
   - Improved database query performance
   - Updated user interface design
   - Enhanced error handling
   
   ### Fixed
   - Fixed memory leak in background tasks
   - Resolved issue with file upload validation
   - Fixed timezone handling in date calculations
   
   ### Security
   - Updated dependencies with security patches
   - Improved input validation and sanitization
   ```

7. **Documentation Updates**
   - Update API documentation with new endpoints
   - Revise user documentation and guides
   - Update installation and deployment instructions
   - Review and update README.md
   - Update migration guides if needed

8. **Dependency Management**
   ```bash
   # Update and audit dependencies
   npm audit fix
   npm update
   
   # Python
   pip-audit
   pip freeze > requirements.txt
   
   # Review security vulnerabilities
   npm audit
   snyk test
   ```

9. **Build and Artifact Generation**
   ```bash
   # Clean build environment
   npm run clean
   rm -rf dist/ build/
   
   # Build production artifacts
   npm run build
   
   # Verify build artifacts
   ls -la dist/
   
   # Test built artifacts
   npm run test:build
   ```

10. **Testing and Quality Assurance**
    - Run comprehensive test suite
    - Perform manual testing of critical features
    - Execute regression testing
    - Conduct user acceptance testing
    - Validate in staging environment

    ```bash
    # Run all tests
    npm test
    npm run test:integration
    npm run test:e2e
    
    # Check code coverage
    npm run test:coverage
    
    # Performance testing
    npm run test:performance
    ```

11. **Security and Compliance Verification**
    - Run security scans and penetration testing
    - Verify compliance with security standards
    - Check for exposed secrets or credentials
    - Validate data protection and privacy measures

12. **Release Notes Preparation**
    ```markdown
    # Release Notes v1.2.3
    
    ## 🎉 What's New
    - **Dark Mode**: Users can now switch to dark mode in settings
    - **Enhanced Security**: Improved authentication with 2FA support
    - **Performance**: 40% faster page load times
    
    ## 🔧 Improvements
    - Better error messages for form validation
    - Improved mobile responsiveness
    - Enhanced accessibility features
    
    ## 🐛 Bug Fixes
    - Fixed issue with file downloads in Safari
    - Resolved memory leak in background tasks
    - Fixed timezone display issues
    
    ## 📚 Documentation
    - Updated API documentation
    - New user onboarding guide
    - Enhanced troubleshooting section
    
    ## 🔄 Migration Guide
    - No breaking changes in this release
    - Automatic database migrations included
    - See [Migration Guide](link) for details
    ```

13. **Release Tagging and Versioning**
    ```bash
    # Create annotated tag
    git add .
    git commit -m "chore: prepare release v1.2.3"
    git tag -a v1.2.3 -m "Release version 1.2.3
    
    Features:
    - Dark mode support
    - Enhanced authentication
    
    Bug fixes:
    - Fixed file upload issues
    - Resolved memory leaks"
    
    # Push tag to remote
    git push origin v1.2.3
    git push origin release/v1.2.3
    ```

14. **Deployment Preparation**
    - Prepare deployment scripts and configurations
    - Update environment variables and secrets
    - Plan deployment strategy (blue-green, rolling, canary)
    - Set up monitoring and alerting for release
    - Prepare rollback procedures

15. **Staging Environment Validation**
    ```bash
    # Deploy to staging
    ./deploy-staging.sh v1.2.3
    
    # Run smoke tests
    npm run test:smoke:staging
    
    # Manual validation checklist
    # [ ] User login/logout
    # [ ] Core functionality
    # [ ] New features
    # [ ] Performance metrics
    # [ ] Security checks
    ```

16. **Production Deployment Planning**
    - Schedule deployment window
    - Notify stakeholders and users
    - Prepare maintenance mode if needed
    - Set up deployment monitoring
    - Plan communication strategy

17. **Release Automation Setup**
    ```yaml
    # GitHub Actions Release Workflow
    name: Release
    
    on:
      push:
        tags:
          - 'v*'
    
    jobs:
      release:
        runs-on: ubuntu-latest
        steps:
          - uses: actions/checkout@v3
          - name: Setup Node.js
            uses: actions/setup-node@v3
            with:
              node-version: '18'
          
          - name: Install dependencies
            run: npm ci
          
          - name: Run tests
            run: npm test
          
          - name: Build
            run: npm run build
          
          - name: Create Release
            uses: actions/create-release@v1
            env:
              GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
            with:
              tag_name: ${{ github.ref }}
              release_name: Release ${{ github.ref }}
              draft: false
              prerelease: false
    ```

18. **Communication and Announcements**
    - Prepare release announcement
    - Update status page and documentation
    - Notify customers and users
    - Share on relevant communication channels
    - Update social media and marketing materials

19. **Post-Release Monitoring**
    - Monitor application performance and errors
    - Track user adoption of new features
    - Monitor system metrics and alerts
    - Collect user feedback and issues
    - Prepare hotfix procedures if needed

20. **Release Retrospective**
    - Document lessons learned
    - Review release process effectiveness
    - Identify improvement opportunities
    - Update release procedures
    - Plan for next release cycle

**Release Types and Considerations:**

**Patch Release (1.2.3 → 1.2.4):**
- Bug fixes only
- No new features
- Minimal testing required
- Quick deployment

**Minor Release (1.2.3 → 1.3.0):**
- New features (backward compatible)
- Enhanced functionality
- Comprehensive testing
- User communication needed

**Major Release (1.2.3 → 2.0.0):**
- Breaking changes
- Significant new features
- Migration guide required
- Extended testing period
- User training and support

**Hotfix Release:**
```bash
# Emergency hotfix process
git checkout main
git pull origin main
git checkout -b hotfix/critical-bug-fix

# Make minimal fix
git add .
git commit -m "hotfix: fix critical security vulnerability"

# Fast-track testing and deployment
npm test
git tag -a v1.2.4-hotfix.1 -m "Hotfix for critical security issue"
git push origin hotfix/critical-bug-fix
git push origin v1.2.4-hotfix.1
```

Remember to:
- Test everything thoroughly before release
- Communicate clearly with all stakeholders
- Have rollback procedures ready
- Monitor the release closely after deployment
- Document everything for future releases