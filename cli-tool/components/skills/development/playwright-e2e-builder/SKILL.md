---
name: playwright-e2e-builder
description: Plan and build comprehensive Playwright E2E test suites with Page Object Model, authentication state persistence, custom fixtures, visual regression, and CI integration. Uses interview-driven planning to clarify critical user flows, auth strategy, test data approach, and parallelization before writing any tests.
tags: [playwright, e2e, testing, automation, typescript, ci, visual-regression]
---

# Playwright E2E Test Suite Builder

## When to use

Use this skill when you need to:

- Set up Playwright from scratch in an existing project
- Build E2E tests for critical user flows (signup, checkout, dashboards)
- Implement Page Object Model for maintainable test architecture
- Configure authentication state persistence across tests
- Set up visual regression testing with screenshots
- Integrate Playwright into CI/CD with sharding and retries

## Phase 1: Explore (Plan Mode)

Enter plan mode. Before writing any tests, explore the existing project:

### Project structure
- Find the tech stack: is this React, Next.js, Vue, SvelteKit, or another framework?
- Check if Playwright is already installed (`playwright.config.ts`, `@playwright/test` in package.json)
- Look for existing test directories (`e2e/`, `tests/`, `__tests__/`)
- Check for existing E2E tests in Cypress, Selenium, or other frameworks (migration context)
- Find the dev server command and port (`npm run dev`, `next dev`, etc.)

### Application structure
- Identify the main routes/pages (look at router config, pages directory, or route files)
- Find authentication flow (login page URL, auth API endpoints, token storage)
- Check for test IDs in components (`data-testid`, `data-test`, `data-cy` attributes)
- Look for API routes that tests might need to seed data through
- Check `.env` files for test-specific environment variables

### CI/CD
- Check for existing CI config (`.github/workflows/`, `.gitlab-ci.yml`, `Jenkinsfile`)
- Look for Docker or docker-compose setup (useful for consistent test environments)
- Check if there's a staging/preview environment URL pattern

## Phase 2: Interview (AskUserQuestion)

Use AskUserQuestion to clarify requirements. Ask in rounds.

### Round 1: Scope and critical flows

```
Question: "What are the critical user flows to test?"
Header: "Flows"
multiSelect: true
Options:
  - "Authentication (signup, login, logout, password reset)" — Core auth flows
  - "Core CRUD (create, read, update, delete main resources)" — Primary data operations
  - "Checkout/payments (cart, billing, confirmation)" — E-commerce or payment flows
  - "Dashboard/admin (data views, filters, exports)" — Admin panel interactions
```

```
Question: "How many pages/routes does the application have approximately?"
Header: "App size"
Options:
  - "Small (< 10 routes)" — Landing page, auth, a few feature pages
  - "Medium (10-30 routes)" — Multiple feature areas, settings, profiles
  - "Large (30+ routes)" — Complex app with many sections and user roles
```

### Round 2: Authentication strategy for tests

```
Question: "How does your app handle authentication?"
Header: "Auth type"
Options:
  - "Cookie/session based (Recommended)" — Server sets httpOnly cookies after login
  - "JWT in localStorage" — Token stored in browser localStorage
  - "OAuth/SSO (Google, GitHub, etc.)" — Third-party auth provider redirect flow
  - "No auth (public app)" — No login required

Question: "How should tests authenticate?"
Header: "Test auth"
Options:
  - "Login via UI once, reuse state (Recommended)" — storageState pattern: login in setup, share cookies across tests
  - "API login in beforeEach" — Call auth API directly before each test, skip UI login
  - "Seed auth token in fixtures" — Inject pre-generated tokens, no login flow needed
  - "Test login UI every time" — Actually test the login form in each test suite
```

### Round 3: Test data and environment

```
Question: "How should test data be managed?"
Header: "Test data"
Options:
  - "API seeding in fixtures (Recommended)" — Call API endpoints to create/clean test data before each test
  - "Database seeding (direct SQL)" — Run SQL scripts or ORM commands to populate test database
  - "Shared test environment (pre-populated)" — Tests run against a persistent staging environment with existing data
  - "Mock API responses" — Intercept network requests and return mock data

Question: "What environment do E2E tests run against?"
Header: "Environment"
Options:
  - "Local dev server (Recommended)" — Start dev server before tests, run against localhost
  - "Preview/staging URL" — Run against a deployed preview or staging environment
  - "Docker Compose stack" — Full stack in containers, tests run outside or inside
```

### Round 4: CI and parallelization

```
Question: "How should tests run in CI?"
Header: "CI"
Options:
  - "GitHub Actions (Recommended)" — Native Playwright support with sharding
  - "GitLab CI" — Docker-based runners with Playwright image
  - "Local only (no CI yet)" — Just local test runs for now
  - "Other CI (Jenkins, CircleCI)" — Custom CI configuration

Question: "Do you need visual regression testing?"
Header: "Visual"
Options:
  - "No — functional tests only (Recommended)" — Assert behavior, not pixels
  - "Yes — screenshot comparisons" — Capture and compare page screenshots
  - "Yes — component screenshots" — Capture specific components, not full pages
```

## Phase 3: Plan (ExitPlanMode)

Write a concrete implementation plan covering:

1. **Directory structure** — test files, page objects, fixtures, config
2. **Playwright config** — projects (browsers), base URL, retries, workers
3. **Auth setup** — global setup for storageState or API-based auth
4. **Page objects** — classes for each page with locators and actions
5. **Test fixtures** — custom fixtures for data seeding, auth, API client
6. **Test suites** — test files for each critical flow from the interview
7. **CI config** — workflow file with sharding, artifact upload, reporting

Present via ExitPlanMode for user approval.

## Phase 4: Execute

After approval, implement following this order:

### Step 1: Playwright config

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['github']]
    : [['html', { open: 'on-failure' }]],

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },

  projects: [
    // Auth setup — runs before all tests
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'mobile',
      use: {
        ...devices['iPhone 14'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

### Step 2: Auth setup (global)

```typescript
// e2e/auth.setup.ts
import { test as setup, expect } from '@playwright/test';

const authFile = 'e2e/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Navigate to login page
  await page.goto('/login');

  // Fill login form
  await page.getByLabel('Email').fill(process.env.TEST_USER_EMAIL || 'test@example.com');
  await page.getByLabel('Password').fill(process.env.TEST_USER_PASSWORD || 'testpassword');
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Wait for auth to complete — adjust selector to your app
  await page.waitForURL('/dashboard');
  await expect(page.getByRole('navigation')).toBeVisible();

  // Save signed-in state
  await page.context().storageState({ path: authFile });
});
```

### Step 3: Custom fixtures

```typescript
// e2e/fixtures.ts
import { test as base, expect } from '@playwright/test';
import { LoginPage } from './pages/login-page';
import { DashboardPage } from './pages/dashboard-page';

// API client for test data seeding
class ApiClient {
  constructor(private baseURL: string, private token?: string) {}

  async createResource(data: Record<string, unknown>) {
    const response = await fetch(`${this.baseURL}/api/resources`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(`Seed failed: ${response.status}`);
    return response.json();
  }

  async deleteResource(id: string) {
    await fetch(`${this.baseURL}/api/resources/${id}`, {
      method: 'DELETE',
      headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
    });
  }
}

type Fixtures = {
  loginPage: LoginPage;
  dashboardPage: DashboardPage;
  api: ApiClient;
};

export const test = base.extend<Fixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },

  api: async ({ baseURL }, use) => {
    const client = new ApiClient(baseURL!);
    await use(client);
  },
});

export { expect };
```

### Step 4: Page Object Model

```typescript
// e2e/pages/login-page.ts
import { type Page, type Locator, expect } from '@playwright/test';

export class LoginPage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;

  constructor(private page: Page) {
    this.emailInput = page.getByLabel('Email');
    this.passwordInput = page.getByLabel('Password');
    this.submitButton = page.getByRole('button', { name: 'Sign in' });
    this.errorMessage = page.getByRole('alert');
  }

  async goto() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async expectError(message: string) {
    await expect(this.errorMessage).toContainText(message);
  }
}

// e2e/pages/dashboard-page.ts
import { type Page, type Locator, expect } from '@playwright/test';

export class DashboardPage {
  readonly heading: Locator;
  readonly createButton: Locator;
  readonly searchInput: Locator;
  readonly resourceList: Locator;

  constructor(private page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.createButton = page.getByRole('button', { name: 'Create' });
    this.searchInput = page.getByPlaceholder('Search');
    this.resourceList = page.getByTestId('resource-list');
  }

  async goto() {
    await this.page.goto('/dashboard');
  }

  async createResource(name: string) {
    await this.createButton.click();
    await this.page.getByLabel('Name').fill(name);
    await this.page.getByRole('button', { name: 'Save' }).click();
  }

  async search(query: string) {
    await this.searchInput.fill(query);
    // Wait for debounced search to trigger
    await this.page.waitForResponse(resp =>
      resp.url().includes('/api/resources') && resp.status() === 200
    );
  }

  async expectResourceVisible(name: string) {
    await expect(this.resourceList.getByText(name)).toBeVisible();
  }

  async expectResourceCount(count: number) {
    await expect(this.resourceList.getByRole('listitem')).toHaveCount(count);
  }
}
```

### Step 5: Test suites

```typescript
// e2e/auth.spec.ts
import { test, expect } from './fixtures';

test.describe('Authentication', () => {
  // These tests run WITHOUT storageState (unauthenticated)
  test.use({ storageState: { cookies: [], origins: [] } });

  test('successful login redirects to dashboard', async ({ loginPage, page }) => {
    await loginPage.goto();
    await loginPage.login('test@example.com', 'testpassword');
    await expect(page).toHaveURL('/dashboard');
  });

  test('invalid credentials shows error', async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.login('test@example.com', 'wrongpassword');
    await loginPage.expectError('Invalid credentials');
  });

  test('logout clears session', async ({ page }) => {
    // Login first
    await page.goto('/login');
    // ... login steps ...

    // Logout
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page).toHaveURL('/login');

    // Verify can't access protected route
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/login');
  });
});

// e2e/dashboard.spec.ts
import { test, expect } from './fixtures';

test.describe('Dashboard', () => {
  test('displays resource list', async ({ dashboardPage }) => {
    await dashboardPage.goto();
    await expect(dashboardPage.heading).toHaveText('Dashboard');
    await expect(dashboardPage.resourceList).toBeVisible();
  });

  test('create new resource', async ({ dashboardPage, page }) => {
    await dashboardPage.goto();
    await dashboardPage.createResource('New E2E Resource');

    // Verify resource appears in list
    await dashboardPage.expectResourceVisible('New E2E Resource');
  });

  test('search filters results', async ({ dashboardPage, api }) => {
    // Seed test data via API
    await api.createResource({ name: 'Alpha Item' });
    await api.createResource({ name: 'Beta Item' });

    await dashboardPage.goto();
    await dashboardPage.search('Alpha');
    await dashboardPage.expectResourceVisible('Alpha Item');
  });

  test('empty state shown when no resources', async ({ dashboardPage, page }) => {
    await dashboardPage.goto();
    await dashboardPage.search('nonexistent-query-xyz');
    await expect(page.getByText('No results found')).toBeVisible();
  });
});

// e2e/crud.spec.ts
import { test, expect } from './fixtures';

test.describe('Resource CRUD', () => {
  let resourceId: string;

  test.beforeEach(async ({ api }) => {
    // Seed a resource for tests that need one
    const resource = await api.createResource({ name: 'Test Resource' });
    resourceId = resource.id;
  });

  test.afterEach(async ({ api }) => {
    // Clean up seeded data
    if (resourceId) {
      await api.deleteResource(resourceId).catch(() => {});
    }
  });

  test('edit resource name', async ({ page }) => {
    await page.goto(`/resources/${resourceId}`);
    await page.getByRole('button', { name: 'Edit' }).click();
    await page.getByLabel('Name').clear();
    await page.getByLabel('Name').fill('Updated Resource');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByRole('heading')).toHaveText('Updated Resource');
  });

  test('delete resource with confirmation', async ({ page }) => {
    await page.goto(`/resources/${resourceId}`);
    await page.getByRole('button', { name: 'Delete' }).click();

    // Confirm deletion dialog
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Confirm' }).click();

    // Should redirect to list
    await expect(page).toHaveURL('/dashboard');
  });
});
```

### Step 6: Visual regression (if selected)

```typescript
// e2e/visual.spec.ts
import { test, expect } from './fixtures';

test.describe('Visual regression', () => {
  test('dashboard matches snapshot', async ({ dashboardPage, page }) => {
    await dashboardPage.goto();
    // Wait for dynamic content to stabilize
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('dashboard.png', {
      maxDiffPixelRatio: 0.01,
    });
  });

  test('login page matches snapshot', async ({ loginPage, page }) => {
    test.use({ storageState: { cookies: [], origins: [] } });
    await loginPage.goto();
    await expect(page).toHaveScreenshot('login.png', {
      maxDiffPixelRatio: 0.01,
    });
  });

  // Component-level screenshots
  test('navigation component matches snapshot', async ({ page }) => {
    await page.goto('/dashboard');
    const nav = page.getByRole('navigation');
    await expect(nav).toHaveScreenshot('navigation.png');
  });
});
```

### Step 7: GitHub Actions CI

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  e2e:
    timeout-minutes: 30
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        shard: [1/4, 2/4, 3/4, 4/4]

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Run E2E tests
        run: npx playwright test --shard=${{ matrix.shard }}
        env:
          BASE_URL: http://localhost:3000
          TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
          TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}

      - name: Upload test report
        uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }}
        with:
          name: playwright-report-${{ strategy.job-index }}
          path: playwright-report/
          retention-days: 14

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }}
        with:
          name: test-results-${{ strategy.job-index }}
          path: test-results/
          retention-days: 7
```

## Directory structure reference

```
e2e/
├── .auth/
│   └── user.json            # Saved auth state (gitignored)
├── fixtures.ts              # Custom test fixtures and API client
├── pages/
│   ├── login-page.ts        # Login page object
│   ├── dashboard-page.ts    # Dashboard page object
│   └── resource-page.ts     # Resource detail page object
├── auth.setup.ts            # Global auth setup (runs once)
├── auth.spec.ts             # Authentication tests
├── dashboard.spec.ts        # Dashboard tests
├── crud.spec.ts             # CRUD operation tests
└── visual.spec.ts           # Visual regression tests (optional)
playwright.config.ts         # Playwright configuration
```

## Best practices

### Use role-based locators first
Prefer `getByRole()`, `getByLabel()`, `getByText()` over CSS selectors or test IDs. These locators mirror how users interact with the page and catch accessibility issues:

```typescript
// Preferred — accessible and resilient
await page.getByRole('button', { name: 'Submit' }).click();
await page.getByLabel('Email').fill('user@test.com');

// Fallback — when role-based doesn't work
await page.getByTestId('custom-widget').click();

// Avoid — fragile, breaks on refactors
await page.locator('.btn-primary').click();
await page.locator('#email-input').fill('user@test.com');
```

### Wait for network, not timers
Never use `page.waitForTimeout()`. Wait for specific conditions:

```typescript
// Wait for API response
await page.waitForResponse(resp => resp.url().includes('/api/data'));

// Wait for element state
await expect(page.getByText('Saved')).toBeVisible();

// Wait for navigation
await expect(page).toHaveURL('/dashboard');

// Wait for loading to finish
await expect(page.getByTestId('spinner')).toBeHidden();
```

### Isolate test data
Each test should create its own data and clean up after:

```typescript
test('edit resource', async ({ api, page }) => {
  // Arrange — seed via API
  const resource = await api.createResource({ name: 'Test' });

  // Act
  await page.goto(`/resources/${resource.id}`);
  // ... test logic ...

  // Cleanup (also runs on failure via afterEach)
});
```

### Tag tests for selective runs

```typescript
test('checkout flow @slow @checkout', async ({ page }) => {
  // Long test tagged for selective execution
});

// Run only: npx playwright test --grep @checkout
// Skip slow: npx playwright test --grep-invert @slow
```

### .gitignore additions

```
# Playwright
e2e/.auth/
test-results/
playwright-report/
blob-report/
```

## Checklist before finishing

- [ ] `playwright.config.ts` has webServer configured to start the dev server
- [ ] Auth setup saves storageState and all test projects depend on it
- [ ] Page objects use role-based locators (`getByRole`, `getByLabel`, `getByText`)
- [ ] No `waitForTimeout()` calls — only wait for elements, URLs, or responses
- [ ] Tests create and clean up their own data (no shared mutable state)
- [ ] CI config has sharding for parallel execution
- [ ] Trace, screenshot, and video are captured on failure for debugging
- [ ] `.auth/` directory is in `.gitignore`
- [ ] `npx playwright test` passes locally before pushing
