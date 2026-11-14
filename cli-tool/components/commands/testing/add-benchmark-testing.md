# Add Benchmark Testing

Configure automated micro-benchmarks, throughput profiling, and regression tracking across the project codebase.

## Objective
Detect performance regressions, measure operations-per-second, and capture memory allocations by generating framework-idiomatic benchmarking harnesses.

## Auto-Detection & Framework Selection
Detect the primary programming language and configure the industry-standard benchmarking harness:
- **TypeScript / Node.js**: `mitata` or `tinybench`
- **Python**: `pytest-benchmark`
- **Go**: Native `testing.B` benchmarks
- **Rust**: `criterion` with statistical analysis
- **C# / .NET**: `BenchmarkDotNet`
- **Java**: `JMH` (Java Microbenchmark Harness)

## Instructions for Claude

When the user runs `/add-benchmark-testing` on a file or target directory:

1. **Analyze Target Code**:
   - Identify critical computational loops, serialization/deserialization logic, algorithmic data manipulations, and hot paths.
   - Separate pure computation from I/O or network dependencies (mock external dependencies if testing pure algorithms).

2. **Generate Benchmark Harness**:
   - Create a dedicated benchmark file (e.g., `benchmarks/<target>.bench.ts` or `benchmarks/test_<target>_bench.py`).
   - Implement warm-up iterations to eliminate JIT and cold-start variance.
   - Benchmark isolated functions across multiple dataset sizes ($N = 10, 100, 1000, 10000$) to surface scaling characteristics.

3. **Measure & Report**:
   - Measure **Operations per Second (ops/sec)**.
   - Track **P50, P95, and P99 latency percentiles**.
   - Measure memory allocation overhead per iteration (where supported by runtime).

4. **Add CI Regression Quality Gate**:
   - Add a configuration snippet to alert or fail CI builds if execution time degrades by more than 15% against the baseline branch.

## Example Output Structure

```typescript
// benchmarks/parser.bench.ts
import { bench, run } from 'mitata';
import { parsePayload } from '../src/parser';

const smallPayload = JSON.stringify({ id: 1, type: "test" });
const largePayload = JSON.stringify(Array.from({ length: 1000 }, (_, i) => ({ id: i })));

bench('parse small payload', () => {
  parsePayload(smallPayload);
});

bench('parse large payload (1k items)', () => {
  parsePayload(largePayload);
});

await run();
```

## Review Checklist
- [x] No external network calls during micro-benchmarking
- [x] Warm-up cycles configured
- [x] Statistical outliers filtered
- [x] Baseline comparison enabled
