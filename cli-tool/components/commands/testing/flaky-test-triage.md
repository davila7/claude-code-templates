---
allowed-tools: Read, Glob, Grep, Bash(git:*), Bash(npm test:*), Bash(npm run:*), Bash(pnpm test:*), Bash(yarn test:*), Bash(pytest:*), Bash(cargo test:*)
argument-hint: <test-file-or-test-name>
description: Detect, isolate, and remediate non-deterministic or flaky tests through stress-repetition and root-cause analysis
---

# Flaky Test Triage

Investigate and eliminate non-deterministic behavior for: **$ARGUMENTS**

## Purpose

Isolate tests that pass and fail intermittently without code changes, determine the underlying source of non-determinism (race conditions, order coupling, timing drift, or leaked state), and apply robust deflaking fixes.

## Pre-flight

1. Confirm working tree cleanliness before running repeated test runs:
   ```bash
   test -z "$(git status --porcelain)" || { echo "Working tree is dirty; commit or stash changes first."; exit 1; }
   ```
2. Identify the target test file or test case from `$ARGUMENTS`.
3. Detect the test framework in use (e.g., Jest, Vitest, Pytest, Go test, Cargo test) from project configuration.

## Triage & Stabilization Workflow

### 1. Stress Repetition to Measure Flake Frequency

Run the specific test in a tight loop to calculate an empirical failure rate. Choose the appropriate repetition method based on the framework:

- **Vitest**:
  ```bash
  npx vitest run <path-to-test> --repeat=20
  ```
- **Jest**:
  ```bash
  for i in $(seq 1 20); do npx jest <path-to-test> --runInBand || break; done
  ```
- **Pytest**:
  ```bash
  pytest <path-to-test> --count=20 -v
  ```
- **Go**:
  ```bash
  go test -count=20 -run <TestName> <package-path>
  ```
- **Cargo**:
  ```bash
  for i in $(seq 1 20); do cargo test <test_name> -- --nocapture || break; done
  ```

Record the pass/fail ratio and capture stdout/stderr from failed iterations.

### 2. Diagnose Flake Root Cause

Categorize the failure using the common non-determinism taxonomy:

1. **Timing & Asynchronous Race Conditions**:
   - Symptom: Fails under high CPU load or CI runners; passes on fast local hardware.
   - Indicators: Arbitrary `sleep()`, `setTimeout()`, or unawaited promises/goroutines.
   - Root cause: Test asserts before an asynchronous background operation resolves.

2. **Test Order Dependency & State Pollution**:
   - Symptom: Passes when executed in isolation (`--testNamePattern`), fails when the entire suite runs.
   - Indicators: Leaked global variables, uncleared database records, singleton caches, or shared filesystem artifacts.
   - Verification: Run the test suite with randomized order (`--shuffle` or `--randomize`).

3. **Clock & Timezone Skew**:
   - Symptom: Fails around midnight UTC, during month/year rollovers, or in different local timezones.
   - Indicators: Unmocked `Date.now()`, `new Date()`, `datetime.utcnow()`, or reliance on implicit locale sorting.

4. **Resource & Port Contention**:
   - Symptom: `EADDRINUSE`, file locking errors, or database transaction deadlocks when run concurrently.
   - Indicators: Hardcoded network ports, static temporary file names, or shared test database schemas.

### 3. Apply Targeted Stabilization Patterns

Implement the appropriate pattern based on the diagnosed category:

- **Replace Arbitrary Delays with Condition-Based Polling**:
  Avoid static `sleep(1000)`. Instead, use poll-based assertions with explicit timeouts:
  ```typescript
  // Bad
  await sleep(500);
  expect(await getStatus()).toBe("completed");

  // Good
  await waitFor(async () => {
    expect(await getStatus()).toBe("completed");
  }, { timeout: 5000, interval: 50 });
  ```

- **Enforce Clean Teardown & Mock Restoration**:
  Ensure global mocks, timers, and database tables are cleared in `afterEach` hooks:
  ```typescript
  afterEach(async () => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    await cleanupDatabase();
  });
  ```

- **Dynamic Resource Isolation**:
  Use ephemeral ports (`0` for OS-assigned port) and unique temporary folders per test run:
  ```typescript
  const testDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "test-run-"));
  ```

### 4. Verification & Stability Certification

1. Re-run the target test 50 consecutive times using the stress runner.
2. Run the entire enclosing test file with shuffle/randomized order to prove absence of order coupling:
   ```bash
   npx vitest run <path-to-test> --shuffle
   ```
3. Run the complete project test suite to guarantee zero regressions:
   ```bash
   npm test
   ```

### 5. Report Findings

Summarize:
- **Flake Rate Before**: e.g., 3 failures out of 20 runs (15% flake rate).
- **Identified Root Cause**: Specific race condition, state leak, or timing dependency.
- **Remediation Applied**: Exact code changes made to stabilize the test.
- **Verification Result**: 50/50 consecutive runs passed without error.

## Safety Notes

- Never fix a flaky test by simply increasing an arbitrary `sleep()` duration; this increases test suite runtime without fixing the underlying race.
- Do not mark tests with `@skip`, `xit`, or blanket retries without addressing the fundamental root cause.
- Maintain test assertions' strictness; do not weaken expectations merely to make a test pass.
