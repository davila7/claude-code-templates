---
name: qa-test-planner
description: Generate comprehensive test plans, manual test cases, regression test suites, and bug reports for QA engineers. Includes Figma MCP integration for design validation.
trigger: explicit
---

# QA Test Planner

A comprehensive skill for QA engineers to create test plans, generate manual test cases, build regression test suites, validate designs against Figma, and document bugs effectively.

> **Activation:** This skill is triggered only when explicitly called by name (e.g., `/qa-test-planner`, `qa-test-planner`, or `use the skill qa-test-planner`).

---

## Quick Start

**Create a test plan:**
```
"Create a test plan for the user authentication feature"
```

**Generate test cases:**
```
"Generate manual test cases for the checkout flow"
```

**Build regression suite:**
```
"Build a regression test suite for the payment module"
```

**Validate against Figma:**
```
"Compare the login page against the Figma design at [URL]"
```

**Create bug report:**
```
"Create a bug report for the form validation issue"
```

---

## Quick Reference

| Task | What You Get | Time |
|------|--------------|------|
| Test Plan | Strategy, scope, schedule, risks | 10-15 min |
| Test Cases | Step-by-step instructions, expected results | 5-10 min each |
| Regression Suite | Smoke tests, critical paths, execution order | 15-20 min |
| Figma Validation | Design-implementation comparison, discrepancy list | 10-15 min |
| Bug Report | Reproducible steps, environment, evidence | 5 min |

---

## How It Works

```
Your Request
    │
    ▼
┌─────────────────────────────────────────────────────┐
│ 1. ANALYZE                                          │
│    • Parse feature/requirement                      │
│    • Identify test types needed                     │
│    • Determine scope and priorities                 │
├─────────────────────────────────────────────────────┤
│ 2. GENERATE                                         │
│    • Create structured deliverables                 │
│    • Apply templates and best practices             │
│    • Include edge cases and variations              │
├─────────────────────────────────────────────────────┤
│ 3. VALIDATE                                         │
│    • Check completeness                             │
│    • Verify traceability                            │
│    • Ensure actionable steps                        │
└─────────────────────────────────────────────────────┘
    │
    ▼
QA Deliverable Ready
```

---

## Commands

### Interactive Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `./scripts/generate_test_cases.sh` | Create test cases interactively | Step-by-step prompts |
| `./scripts/create_bug_report.sh` | Generate bug reports | Guided input collection |

### Natural Language

| Request | Output |
|---------|--------|
| "Create test plan for {feature}" | Complete test plan document |
| "Generate {N} test cases for {feature}" | Numbered test cases with steps |
| "Build smoke test suite" | Critical path tests |
| "Compare with Figma at {URL}" | Visual validation checklist |
| "Document bug: {description}" | Structured bug report |

---

## Core Deliverables

### 1. Test Plans
- Test scope and objectives
- Testing approach and strategy
- Environment requirements
- Entry/exit criteria
- Risk assessment
- Timeline and milestones

### 2. Manual Test Cases
- Step-by-step instructions
- Expected vs actual results
- Preconditions and setup
- Test data requirements
- Priority and severity

### 3. Regression Suites
- Smoke tests (15-30 min)
- Full regression (2-4 hours)
- Targeted regression (30-60 min)
- Execution order and dependencies

### 4. Figma Validation
- Component-by-component comparison
- Spacing and typography checks
- Color and visual consistency
- Interactive state validation

### 5. Bug Reports
- Clear reproduction steps
- Environment details
- Evidence (screenshots, logs)
- Severity and priority

---

## Anti-Patterns

| Avoid | Why | Instead |
|-------|-----|---------|
| Vague test steps | Can't reproduce | Specific actions + expected results |
| Missing preconditions | Tests fail unexpectedly | Document all setup requirements |
| No test data | Tester blocked | Provide sample data or generation |
| Generic bug titles | Hard to track | Specific: "[Feature] issue when [action]" |
| Skip edge cases | Miss critical bugs | Include boundary values, nulls |

---

## Verification Checklist

**Test Plan:**
- [ ] Scope clearly defined (in/out)
- [ ] Entry/exit criteria specified
- [ ] Risks identified with mitigations
- [ ] Timeline realistic

**Test Cases:**
- [ ] Each step has expected result
- [ ] Preconditions documented
- [ ] Test data available
- [ ] Priority assigned

**Bug Reports:**
- [ ] Reproducible steps
- [ ] Environment documented
- [ ] Screenshots/evidence attached
- [ ] Severity/priority set

---

## References

- [Test Case Templates](references/test_case_templates.md) - Standard formats for all test types
- [Bug Report Templates](references/bug_report_templates.md) - Documentation templates
- [Regression Testing Guide](references/regression_testing.md) - Suite building and execution
- [Figma Validation Guide](references/figma_validation.md) - Design-implementation validation

---

<details>
<summary><strong>Deep Dive: Test Case Structure</strong></summary>

### Standard Test Case Format

```markdown
## TC-001: [Test Case Title]

**Priority:** High | Medium | Low
**Type:** Functional | UI | Integration | Regression
**Status:** Not Run | Pass | Fail | Blocked

### Objective
[What are we testing and why]

### Preconditions
- [Setup requirement 1]
- [Setup requirement 2]
- [Test data needed]

### Test Steps
1. [Action to perform]
   **Expected:** [What should happen]

2. [Action to perform]
   **Expected:** [What should happen]

3. [Action to perform]
   **Expected:** [What should happen]

### Test Data
- Input: [Test data values]
- User: [Test account details]
- Configuration: [Environment settings]

### Post-conditions
- [System state after test]
- [Cleanup required]

### Notes
- [Edge cases to consider]
- [Related test cases]
- [Known issues]
```

### Test Types

| Type | Focus | Example |
|------|-------|---------|
| Functional | Business logic | Login with valid credentials |
| UI/Visual | Appearance, layout | Button matches Figma design |
| Integration | Component interaction | API returns data to frontend |
| Regression | Existing functionality | Previous features still work |
| Performance | Speed, load handling | Page loads under 3 seconds |
| Security | Vulnerabilities | SQL injection prevented |

</details>

<details>
<summary><strong>Deep Dive: Test Plan Template</strong></summary>

### Test Plan Structure

```markdown
# Test Plan: [Feature/Release Name]

## Executive Summary
- Feature/product being tested
- Testing objectives
- Key risks
- Timeline overview

## Test Scope

**In Scope:**
- Features to be tested
- Test types (functional, UI, performance)
- Platforms and environments
- User flows and scenarios

**Out of Scope:**
- Features not being tested
- Known limitations
- Third-party integrations (if applicable)

## Test Strategy

**Test Types:**
- Manual testing
- Exploratory testing
- Regression testing
- Integration testing
- User acceptance testing

**Test Approach:**
- Black box testing
- Positive and negative testing
- Boundary value analysis
- Equivalence partitioning

## Test Environment
- Operating systems
- Browsers and versions
- Devices (mobile, tablet, desktop)
- Test data requirements
- Backend/API environments

## Entry Criteria
- [ ] Requirements documented
- [ ] Designs finalized
- [ ] Test environment ready
- [ ] Test data prepared
- [ ] Build deployed

## Exit Criteria
- [ ] All high-priority test cases executed
- [ ] 90%+ test case pass rate
- [ ] All critical bugs fixed
- [ ] No open high-severity bugs
- [ ] Regression suite passed

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| [Risk 1] | H/M/L | H/M/L | [Mitigation] |

## Test Deliverables
- Test plan document
- Test cases
- Test execution reports
- Bug reports
- Test summary report
```

</details>

<details>
<summary><strong>Deep Dive: Bug Reporting</strong></summary>

### Bug Report Template

```markdown
# BUG-[ID]: [Clear, specific title]

**Severity:** Critical | High | Medium | Low
**Priority:** P0 | P1 | P2 | P3
**Type:** Functional | UI | Performance | Security
**Status:** Open | In Progress | Fixed | Closed

## Environment
- **OS:** [Windows 11, macOS 14, etc.]
- **Browser:** [Chrome 120, Firefox 121, etc.]
- **Device:** [Desktop, iPhone 15, etc.]
- **Build:** [Version/commit]
- **URL:** [Page where bug occurs]

## Description
[Clear, concise description of the issue]

## Steps to Reproduce
1. [Specific step]
2. [Specific step]
3. [Specific step]

## Expected Behavior
[What should happen]

## Actual Behavior
[What actually happens]

## Visual Evidence
- Screenshot: [attached]
- Video: [link if applicable]
- Console errors: [paste errors]

## Impact
- **User Impact:** [How many users affected]
- **Frequency:** [Always, Sometimes, Rarely]
- **Workaround:** [If one exists]

## Additional Context
- Related to: [Feature/ticket]
- Regression: [Yes/No]
- Figma design: [Link if UI bug]
```

### Severity Definitions

| Level | Criteria | Examples |
|-------|----------|----------|
| **Critical (P0)** | System crash, data loss, security | Payment fails, login broken |
| **High (P1)** | Major feature broken, no workaround | Search not working |
| **Medium (P2)** | Feature partial, workaround exists | Filter missing one option |
| **Low (P3)** | Cosmetic, rare edge cases | Typo, minor alignment |

</details>

<details>
<summary><strong>Deep Dive: Figma MCP Integration</strong></summary>

### Design Validation Workflow

**Prerequisites:**
- Figma MCP server configured
- Access to Figma design files
- Figma URLs for components/pages

**Process:**

1. **Get Design Specs from Figma**
```
"Get the button specifications from Figma file [URL]"

Response includes:
- Dimensions (width, height)
- Colors (background, text, border)
- Typography (font, size, weight)
- Spacing (padding, margin)
- Border radius
- States (default, hover, active, disabled)
```

2. **Compare Implementation**
```
TC: Primary Button Visual Validation
1. Inspect primary button in browser dev tools
2. Compare against Figma specs:
   - Dimensions: 120x40px
   - Border-radius: 8px
   - Background color: #0066FF
   - Font: 16px Medium #FFFFFF
3. Document discrepancies
```

3. **Create Bug if Mismatch**
```
BUG: Primary button color doesn't match design
Severity: Medium
Expected (Figma): #0066FF
Actual (Implementation): #0052CC
Screenshot: [attached]
Figma link: [specific component]
```

### What to Validate

| Element | What to Check | Tool |
|---------|---------------|------|
| Colors | Hex values exact | Browser color picker |
| Spacing | Padding/margin px | DevTools computed styles |
| Typography | Font, size, weight | DevTools font panel |
| Layout | Width, height, position | DevTools box model |
| States | Hover, active, focus | Manual interaction |
| Responsive | Breakpoint behavior | DevTools device mode |

### Example Queries
```
"Get button specifications from Figma design [URL]"
"Compare navigation menu implementation against Figma design"
"Extract spacing values for dashboard layout from Figma"
"List all color tokens used in Figma design system"
```

</details>

<details>
<summary><strong>Deep Dive: Regression Testing</strong></summary>

### Suite Structure

| Suite Type | Duration | Frequency | Coverage |
|------------|----------|-----------|----------|
| Smoke | 15-30 min | Daily | Critical paths only |
| Targeted | 30-60 min | Per change | Affected areas |
| Full | 2-4 hours | Weekly/Release | Comprehensive |
| Sanity | 10-15 min | After hotfix | Quick validation |

### Building a Regression Suite

**Step 1: Identify Critical Paths**
- What can users NOT live without?
- What generates revenue?
- What handles sensitive data?
- What's used most frequently?

**Step 2: Prioritize Test Cases**

| Priority | Description | Must Run |
|----------|-------------|----------|
| P0 | Business-critical, security | Always |
| P1 | Major features, common flows | Weekly+ |
| P2 | Minor features, edge cases | Releases |

**Step 3: Execution Order**
1. Smoke first - if fails, stop and fix build
2. P0 tests next - must pass before proceeding
3. P1 then P2 - track all failures
4. Exploratory - find unexpected issues

### Pass/Fail Criteria

**PASS:**
- All P0 tests pass
- 90%+ P1 tests pass
- No critical bugs open

**FAIL (Block Release):**
- Any P0 test fails
- Critical bug discovered
- Security vulnerability
- Data loss scenario

**CONDITIONAL:**
- P1 failures with workarounds
- Known issues documented
- Fix plan in place

</details>

<details>
<summary><strong>Deep Dive: Test Execution Tracking</strong></summary>

### Test Run Report Template

```markdown
# Test Run: [Release Version]

**Date:** 2024-01-15
**Build:** v2.5.0-rc1
**Tester:** [Name]
**Environment:** Staging

## Summary
- Total Test Cases: 150
- Executed: 145
- Passed: 130
- Failed: 10
- Blocked: 5
- Not Run: 5
- Pass Rate: 90%

## Test Cases by Priority

| Priority | Total | Pass | Fail | Blocked |
|----------|-------|------|------|---------|
| P0 (Critical) | 25 | 23 | 2 | 0 |
| P1 (High) | 50 | 45 | 3 | 2 |
| P2 (Medium) | 50 | 45 | 3 | 2 |
| P3 (Low) | 25 | 17 | 2 | 1 |

## Critical Failures
- TC-045: Payment processing fails
  - Bug: BUG-234
  - Status: Open

## Blocked Tests
- TC-112: Dashboard widget (API endpoint down)

## Risks
- 2 critical bugs blocking release
- Payment integration needs attention

## Next Steps
- Retest after BUG-234 fix
- Complete remaining 5 test cases
- Run full regression before sign-off
```

### Coverage Tracking

```markdown
## Coverage Matrix

| Feature | Requirements | Test Cases | Status | Gaps |
|---------|--------------|------------|--------|------|
| Login | 8 | 12 | Complete | None |
| Checkout | 15 | 10 | Partial | Payment errors |
| Dashboard | 12 | 15 | Complete | None |
```

</details>

<details>
<summary><strong>QA Process Workflow</strong></summary>

### Phase 1: Planning
- [ ] Review requirements and designs
- [ ] Create test plan
- [ ] Identify test scenarios
- [ ] Estimate effort and timeline
- [ ] Set up test environment

### Phase 2: Test Design
- [ ] Write test cases
- [ ] Review test cases with team
- [ ] Prepare test data
- [ ] Build regression suite
- [ ] Get Figma design access

### Phase 3: Execution
- [ ] Execute test cases
- [ ] Log bugs with clear steps
- [ ] Validate against Figma (UI tests)
- [ ] Track test progress
- [ ] Communicate blockers

### Phase 4: Reporting
- [ ] Compile test results
- [ ] Analyze coverage
- [ ] Document risks
- [ ] Provide go/no-go recommendation
- [ ] Archive test artifacts

</details>

<details>
<summary><strong>Best Practices</strong></summary>

### Test Case Writing

**DO:**
- Be specific and unambiguous
- Include expected results for each step
- Test one thing per test case
- Use consistent naming conventions
- Keep test cases maintainable

**DON'T:**
- Assume knowledge
- Make test cases too long
- Skip preconditions
- Forget edge cases
- Leave expected results vague

### Bug Reporting

**DO:**
- Provide clear reproduction steps
- Include screenshots/videos
- Specify exact environment details
- Describe impact on users
- Link to Figma for UI bugs

**DON'T:**
- Report without reproduction steps
- Use vague descriptions
- Skip environment details
- Forget to assign priority
- Duplicate existing bugs

### Regression Testing

**DO:**
- Automate repetitive tests when possible
- Maintain regression suite regularly
- Prioritize critical paths
- Run smoke tests frequently
- Update suite after each release

**DON'T:**
- Skip regression before releases
- Let suite become outdated
- Test everything every time
- Ignore failed regression tests

</details>

---

## Examples

<details>
<summary><strong>Example: Login Flow Test Case</strong></summary>

```markdown
## TC-LOGIN-001: Valid User Login

**Priority:** P0 (Critical)
**Type:** Functional
**Estimated Time:** 2 minutes

### Objective
Verify users can successfully login with valid credentials

### Preconditions
- User account exists (test@example.com / Test123!)
- User is not already logged in
- Browser cookies cleared

### Test Steps
1. Navigate to https://app.example.com/login
   **Expected:** Login page displays with email and password fields

2. Enter email: test@example.com
   **Expected:** Email field accepts input

3. Enter password: Test123!
   **Expected:** Password field shows masked characters

4. Click "Login" button
   **Expected:**
   - Loading indicator appears
   - User redirected to /dashboard
   - Welcome message shown: "Welcome back, Test User"
   - Avatar/profile image displayed in header

### Post-conditions
- User session created
- Auth token stored
- Analytics event logged

### Edge Cases to Consider
- TC-LOGIN-002: Invalid password
- TC-LOGIN-003: Non-existent email
- TC-LOGIN-004: SQL injection attempt
- TC-LOGIN-005: Very long password
```

</details>

<details>
<summary><strong>Example: Responsive Design Test Case</strong></summary>

```markdown
## TC-UI-045: Mobile Navigation Menu

**Priority:** P1 (High)
**Type:** UI/Responsive
**Devices:** Mobile (iPhone, Android)

### Objective
Verify navigation menu works correctly on mobile devices

### Preconditions
- Access from mobile device or responsive mode
- Viewport width: 375px (iPhone SE) to 428px (iPhone Pro Max)

### Test Steps
1. Open homepage on mobile device
   **Expected:** Hamburger menu icon visible (top-right)

2. Tap hamburger icon
   **Expected:**
   - Menu slides in from right
   - Overlay appears over content
   - Close (X) button visible

3. Tap menu item
   **Expected:** Navigate to section, menu closes

4. Compare against Figma mobile design [link]
   **Expected:**
   - Menu width: 280px
   - Slide animation: 300ms ease-out
   - Overlay opacity: 0.5, color #000000
   - Font size: 16px, line-height 24px

### Breakpoints to Test
- 375px (iPhone SE)
- 390px (iPhone 14)
- 428px (iPhone 14 Pro Max)
- 360px (Galaxy S21)
```

</details>

---

**"Testing shows the presence, not the absence of bugs." - Edsger Dijkstra**

**"Quality is not an act, it is a habit." - Aristotle**
