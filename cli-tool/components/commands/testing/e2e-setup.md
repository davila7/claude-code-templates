---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [framework] | --cypress | --playwright | --webdriver | --puppeteer | --mobile
description: Configure comprehensive end-to-end testing suite with framework selection and CI integration
model: sonnet
---

# E2E Setup

Configure comprehensive end-to-end testing suite with framework optimization: **$ARGUMENTS**

## Current E2E Context

- Application type: !`find . -name "index.html" -o -name "app.js" -o -name "App.tsx" | head -1 && echo "Web app" || echo "Detect app type"`
- Framework: !`grep -l "react\\|vue\\|angular" package.json 2>/dev/null || echo "Detect framework"`
- Existing tests: !`find . -name "cypress" -o -name "playwright" -o -name "e2e" | head -1 || echo "No E2E setup"`
- CI system: !`find . -name ".github" -o -name ".gitlab-ci.yml" | head -1 || echo "No CI detected"`

## Task

Implement comprehensive end-to-end testing with framework selection and optimization:

**Framework Focus**: Use $ARGUMENTS to specify Cypress, Playwright, WebDriver, Puppeteer, mobile testing, or auto-detect best fit

**E2E Testing Framework**:
1. **Framework Selection & Setup** - Choose optimal E2E tool, install dependencies, configure basic settings, setup project structure
2. **Test Environment Configuration** - Setup test environments, configure base URLs, implement environment switching, optimize test isolation
3. **Page Object Patterns** - Design page object model, create reusable components, implement element selectors, optimize maintainability
4. **Test Data Management** - Setup test data strategies, implement fixtures, configure database seeding, design cleanup procedures
5. **Cross-Browser Testing** - Configure multi-browser execution, setup mobile testing, implement responsive testing, optimize compatibility
6. **CI/CD Integration** - Configure automated execution, setup parallel testing, implement reporting, optimize performance

**Advanced Features**: Visual regression testing, accessibility testing, performance monitoring, API testing integration, mobile device testing.

**Quality Assurance**: Test reliability optimization, flaky test prevention, execution speed optimization, debugging capabilities.

**Output**: Complete E2E testing setup with framework configuration, test suites, CI integration, and maintenance workflows.