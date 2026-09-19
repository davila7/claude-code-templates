---
allowed-tools: Read, Glob, Grep, Edit, Write, Bash
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

Run the target test for 20 iterations without breaking early on first error so the full pass/fail ratio and flake frequency can be accurately quantified:

- **Vitest**:
  ```bash
  passes=0; fails=0
  for i in $(seq 1 20); do
    if npx vitest run <path-to-test>; then ((++passes)); else ((++fails)); fi
  done
  echo "Vitest Results: $passes passed, $fails failed out of 20 runs"
  ```
- **Jest**:
  ```bash
  passes=0; fails=0
  for i in $(seq 1 20); do
    if npx jest <path-to-test> --runInBand; then ((++passes)); else ((++fails)); fi
  done
  echo "Jest Results: $passes passed, $fails failed out of 20 runs"
  ```
- **Pytest**:
  ```bash
  passes=0; fails=0
  for i in $(seq 1 20); do
    if pytest <path-to-test> -v; then ((++passes)); else ((++fails)); fi
  done
  echo "Pytest Results: $passes passed, $fails failed out of 20 runs"
  ```
- **Go**:
  ```bash
  go test -count=20 -run <TestName> <package-path>
  ```
- **Cargo**:
  ```bash
  passes=0; fails=0
  for i in $(seq 1 20); do
    if cargo test <test_name> -- --nocapture; then ((++passes)); else ((++fails)); fi
  done
  echo "Cargo Results: $passes passed, $fails failed out of 20 runs"
  ```

Record the pass/fail ratio and capture stdout/stderr from failed iterations.

### 2. Diagnose Flake Root Cause

Categorize the failure using the common non-determinism taxonomy:

1. **Timing & Asynchronous Race Conditions**:
   - Symptom: Fails under high CPU load or CI runners; passes on fast local hardware.
   - Indicators: Arbitrary `sleep()`, `setTimeout()`, or unawaited promises/goroutines.
   - Root cause: Test asserts before an asynchronous background operation resolves.

2. **Test Order Dependency & State Pollution**:
   - **Symptom**: Passes when executed in isolation (`--testNamePattern`), fails when the entire suite runs.
   - **Indicators**: Leaked global variables, uncleared database records, singleton caches, or shared filesystem artifacts.
   - **Verification**: Use the framework's shuffle support when it is installed. For Pytest, detect optional plugins before passing their flags:
     ```bash
     if pytest --help 2>/dev/null | grep -q -- '--random-order'; then
       pytest <path-to-test> --random-order
     elif pytest --help 2>/dev/null | grep -q -- '--randomly-seed'; then
       pytest <path-to-test> --randomly-seed=random
     else
       echo 'No Pytest randomization plugin detected; record order-randomization as unavailable.'
       pytest <path-to-test> -v
     fi
     ```
     Do not pass `--random-order` or `--randomly-seed` unless the corresponding plugin advertises the option.

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

1. Verify stability by executing 50 consecutive iterations (stopping on any failure to observe if flake reoccurs):
   ```bash
   for i in $(seq 1 50); do
     <test-command> || { echo "Stability check failed on iteration $i"; exit 1; }
   done
   echo "Stability check passed: 50/50 consecutive runs passed without failure."
   ```
2. Run the enclosing test file with randomized test ordering when the framework supports it. Do not assume optional Pytest plugins are installed:
   ```bash
   # Vitest:
   npx vitest run <path-to-test> --sequence.shuffle.tests

   # Pytest:
   if pytest --help 2>/dev/null | grep -q -- '--random-order'; then
     pytest <path-to-test> --random-order
   elif pytest --help 2>/dev/null | grep -q -- '--randomly-seed'; then
     pytest <path-to-test> --randomly-seed=random
   else
     echo 'Pytest shuffle check unavailable: install pytest-random-order or pytest-randomly to enable it.'
     pytest <path-to-test> -v
   fi
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
