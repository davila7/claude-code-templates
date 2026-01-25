# QA Test Planner

A comprehensive Claude Code skill for QA engineers to generate test plans, manual test cases, regression test suites, Figma design validations, and structured bug reports.

## Purpose

The QA Test Planner skill helps quality assurance professionals create thorough, well-structured testing documentation quickly and consistently. It eliminates the repetitive work of formatting test plans and cases while ensuring best practices are followed for test coverage, bug reporting, and design validation.

## When to Use This Skill

Use the QA Test Planner skill when you need to:

- Create a comprehensive test plan for a new feature or release
- Generate manual test cases with step-by-step instructions
- Build regression test suites (smoke, targeted, or full)
- Validate UI implementation against Figma designs
- Document bugs with clear reproduction steps
- Establish testing standards for your team
- Train new QA engineers on proper documentation

### Activation

This skill uses **explicit triggering** - it must be called by name:

```
/qa-test-planner
qa-test-planner
use the skill qa-test-planner
```

## How It Works

The QA Test Planner follows a three-phase workflow:

### 1. Analyze Phase
- Parses your feature description or requirement
- Identifies the types of testing needed (functional, UI, integration, etc.)
- Determines scope, priorities, and edge cases to cover

### 2. Generate Phase
- Creates structured deliverables using proven templates
- Applies QA best practices automatically
- Includes comprehensive edge cases and test variations
- Organizes content for easy execution and tracking

### 3. Validate Phase
- Checks completeness of generated documentation
- Verifies traceability between requirements and tests
- Ensures all steps are clear and actionable

## Key Features

### 1. Test Plan Generation
Creates complete test plans including:
- Executive summary with objectives and risks
- Clear scope definition (in-scope and out-of-scope)
- Testing strategy and approach
- Environment requirements
- Entry and exit criteria
- Risk assessment with mitigations
- Timeline and deliverables

### 2. Manual Test Case Creation
Generates structured test cases with:
- Step-by-step test instructions
- Expected results for each step
- Preconditions and test data requirements
- Priority and severity assignments
- Post-conditions and cleanup steps
- Edge cases and variations

### 3. Regression Test Suites
Builds tiered test suites:
- **Smoke tests** (15-30 min) - Critical paths only
- **Targeted regression** (30-60 min) - Affected areas
- **Full regression** (2-4 hours) - Comprehensive coverage
- **Sanity tests** (10-15 min) - Quick validation after hotfixes

### 4. Figma Design Validation
Integrates with Figma MCP to:
- Extract design specifications (colors, spacing, typography)
- Compare implementation against design system
- Create validation checklists for UI testing
- Document visual discrepancies as bugs

### 5. Bug Report Documentation
Generates structured bug reports with:
- Clear reproduction steps
- Environment details (OS, browser, device, build)
- Expected vs actual behavior
- Visual evidence (screenshots, videos, console logs)
- Severity and priority classification
- Impact assessment and workarounds

## Usage Examples

### Example 1: Create Test Plan

**Input:**
```
/qa-test-planner
Create a test plan for the user authentication feature
```

**Output:**
A complete test plan document including:
- Testing objectives for login, registration, password reset
- Scope definition (web and mobile apps)
- Test strategy (manual, exploratory, security testing)
- Environment requirements (browsers, devices, test data)
- Entry/exit criteria with measurable thresholds
- Risk assessment (security vulnerabilities, third-party auth)
- Timeline with milestones

### Example 2: Generate Test Cases

**Input:**
```
/qa-test-planner
Generate 5 manual test cases for the checkout flow
```

**Output:**
Five numbered test cases covering:
1. Valid checkout with credit card
2. Invalid credit card handling
3. Empty cart checkout attempt
4. Promo code application
5. Guest vs. logged-in checkout

Each includes preconditions, step-by-step instructions, expected results, test data, and edge cases.

### Example 3: Build Regression Suite

**Input:**
```
/qa-test-planner
Build a smoke test suite for the payment module
```

**Output:**
A prioritized smoke test suite (15-30 min execution) with:
- Critical path tests (payment processing, refunds)
- Execution order and dependencies
- Pass/fail criteria
- Quick validation checklist

### Example 4: Validate Against Figma

**Input:**
```
/qa-test-planner
Compare the login page against the Figma design at [Figma URL]
```

**Output:**
A validation checklist comparing:
- Button dimensions, colors, and states
- Typography (fonts, sizes, weights)
- Spacing and layout
- Responsive behavior
- Interactive states (hover, focus, disabled)

Plus test cases to verify each element and document discrepancies.

### Example 5: Create Bug Report

**Input:**
```
/qa-test-planner
Create a bug report for: Form validation doesn't prevent submission when email field is empty
```

**Output:**
A structured bug report with:
- Clear title: "[Contact Form] Submission allowed with empty email field"
- Severity: High (data quality issue)
- Reproduction steps (numbered, specific actions)
- Expected behavior: Form submission blocked with error message
- Actual behavior: Form submits without email
- Environment details
- Visual evidence placeholder
- Impact assessment

## Interactive Scripts

The skill includes bash scripts for guided test case and bug report creation:

### Generate Test Cases Script
```bash
./scripts/generate_test_cases.sh
```
Prompts for:
- Feature name
- Test type (functional, UI, integration)
- Number of test cases
- Priority level

### Create Bug Report Script
```bash
./scripts/create_bug_report.sh
```
Prompts for:
- Bug title
- Severity and priority
- Reproduction steps
- Environment details
- Expected vs actual behavior

## Reference Documentation

The skill includes comprehensive reference guides in the `references/` directory:

- **test_case_templates.md** - Standard formats for all test types
- **bug_report_templates.md** - Bug documentation templates
- **regression_testing.md** - Suite building and execution strategies
- **figma_validation.md** - Design-implementation validation workflows

## Quality Standards

### Test Plan Checklist
- Scope clearly defined (in/out)
- Entry/exit criteria specified
- Risks identified with mitigations
- Timeline is realistic and achievable

### Test Case Checklist
- Each step has an expected result
- Preconditions documented
- Test data available or specified
- Priority assigned (P0-P3)
- Edge cases included

### Bug Report Checklist
- Reproducible steps provided
- Environment documented completely
- Screenshots or evidence attached
- Severity and priority set appropriately

## Anti-Patterns to Avoid

The skill helps you avoid common testing mistakes:

| Avoid | Why It's Bad | What to Do Instead |
|-------|--------------|-------------------|
| Vague test steps | Can't reproduce consistently | Use specific actions with expected results |
| Missing preconditions | Tests fail unexpectedly | Document all setup requirements |
| No test data | Testers get blocked | Provide sample data or generation instructions |
| Generic bug titles | Hard to track and prioritize | Be specific: "[Feature] issue when [action]" |
| Skipping edge cases | Miss critical bugs | Include boundary values, nulls, empty states |

## Integration with Figma MCP

When Figma MCP is configured, the skill can:

1. Extract design specifications from Figma URLs
2. Generate pixel-perfect validation test cases
3. Compare implementation against design tokens
4. Create bug reports with Figma links for UI discrepancies

**Example Query:**
```
Get button specifications from Figma design [URL]
```

**Returns:**
- Dimensions (width x height)
- Colors (background, text, border with hex values)
- Typography (font family, size, weight, line-height)
- Spacing (padding, margin)
- Border radius
- Interactive states (default, hover, active, disabled)

## Best Practices

### Test Case Writing
- Be specific and unambiguous
- Include expected results for each step
- Test one thing per test case
- Use consistent naming conventions (TC-MODULE-###)
- Keep test cases maintainable (update as features change)

### Bug Reporting
- Provide clear reproduction steps anyone can follow
- Include screenshots, videos, or console logs
- Specify exact environment details
- Describe impact on users
- Link to Figma designs for UI bugs

### Regression Testing
- Maintain regression suite regularly
- Prioritize critical paths
- Run smoke tests frequently (daily/per build)
- Update suite after each release
- Track coverage to identify gaps

## Skill Structure

```
qa-test-planner/
├── README.md                          # This file
├── SKILL.md                           # Main skill definition and templates
├── references/
│   ├── test_case_templates.md        # Test case formats
│   ├── bug_report_templates.md       # Bug documentation templates
│   ├── regression_testing.md         # Regression suite strategies
│   └── figma_validation.md           # Design validation workflows
└── scripts/
    ├── generate_test_cases.sh        # Interactive test case generator
    └── create_bug_report.sh          # Interactive bug report creator
```

## Output Formats

All deliverables are generated in **Markdown format** for easy copy-paste into:
- Jira, Linear, GitHub Issues
- Confluence, Notion
- TestRail, Zephyr
- Google Docs, Word

The structured format ensures consistency across your team and makes test documentation searchable and maintainable.

## Time Savings

Typical time to create documentation:

| Deliverable | Manual Time | With Skill | Time Saved |
|-------------|-------------|------------|------------|
| Test Plan | 2-3 hours | 10-15 min | 90% |
| 10 Test Cases | 1-2 hours | 5-10 min | 85% |
| Regression Suite | 2-4 hours | 15-20 min | 90% |
| Bug Report | 10-15 min | 5 min | 50% |
| Figma Validation | 30-60 min | 10-15 min | 75% |

## Getting Started

1. Activate the skill: `/qa-test-planner`
2. Describe what you need (test plan, test cases, bug report, etc.)
3. Review and customize the generated documentation
4. Copy to your tracking system (Jira, Linear, etc.)

## Support

For detailed information on specific deliverables, see SKILL.md which includes:
- Deep dive sections on each deliverable type
- Complete templates with examples
- QA process workflow
- Test execution tracking
- Coverage matrix templates

---

**"Testing shows the presence, not the absence of bugs."** - Edsger Dijkstra

**"Quality is not an act, it is a habit."** - Aristotle
