---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [testing-scope] | --components | --pages | --responsive | --cross-browser | --accessibility
description: Setup comprehensive visual regression testing with cross-browser and responsive testing
model: sonnet
---

# Setup Visual Testing

Setup comprehensive visual regression testing with responsive and accessibility validation: **$ARGUMENTS**

## Current Visual Testing Context

- Frontend framework: !`grep -l "react\\|vue\\|angular" package.json 2>/dev/null || echo "Detect framework"`
- UI components: !`find . -name "components" -o -name "src" | head -1 && echo "Component structure detected" || echo "Analyze structure"`
- Existing testing: !`find . -name "cypress" -o -name "playwright" -o -name "storybook" | head -1 || echo "No visual testing"`
- CI system: !`find . -name ".github" -o -name ".gitlab-ci.yml" | head -1 || echo "No CI detected"`

## Task

Implement comprehensive visual testing with regression detection and accessibility validation:

**Testing Scope**: Use $ARGUMENTS to focus on component testing, page testing, responsive testing, cross-browser testing, or accessibility testing

**Visual Testing Framework**:
1. **Tool Selection & Setup** - Choose visual testing tools (Percy, Chromatic, BackstopJS, Playwright), configure integration, setup environments
2. **Baseline Creation** - Capture visual baselines, organize screenshot structure, implement version control, optimize image management
3. **Test Scenario Design** - Create component tests, design page workflows, implement responsive breakpoints, configure browser matrix
4. **Integration Setup** - Configure CI/CD integration, setup automated execution, implement review workflows, optimize performance
5. **Regression Detection** - Configure diff algorithms, setup threshold management, implement approval workflows, optimize accuracy
6. **Advanced Testing** - Setup accessibility testing, configure cross-browser validation, implement responsive testing, design performance monitoring

**Advanced Features**: Automated visual testing, intelligent diff analysis, accessibility compliance checking, responsive design validation, performance visual metrics.

**Quality Assurance**: Test reliability, false positive reduction, maintainability optimization, execution performance.

**Output**: Complete visual testing setup with baseline management, regression detection, CI integration, and comprehensive validation workflows.