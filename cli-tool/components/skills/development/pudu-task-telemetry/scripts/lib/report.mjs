import { check, hash, identifier, median, object } from './common.mjs';
import { metric } from './telemetry.mjs';

export function verificationInput(value) {
  check(object(value) && value.schemaVersion === 1 && value.source === 'host_reported' && ['passed', 'failed', 'unverified'].includes(value.status), 'Invalid external verification; source must be host_reported.');
  identifier(value.rubricId, 'rubricId');
  check(Array.isArray(value.checks) && value.checks.length <= 100, 'Invalid verification checks.');
  const checks = value.checks.map(c => {
    check(object(c), 'Invalid verification check.'); identifier(c.id, 'check ID'); check(typeof c.passed === 'boolean', 'Check result must be boolean.');
    return { id: c.id, passed: c.passed };
  });
  check(new Set(checks.map(c => c.id)).size === checks.length, 'Duplicate check IDs.');
  const status = checks.length ? (checks.every(c => c.passed) ? 'passed' : 'failed') : 'unverified';
  check(value.status === status, 'Verification status does not match checks.');
  // Free-form paths/text are not copied into portable telemetry.
  return { status, source: 'host_reported', rubricHash: hash(value.rubricId), checks: checks.map(c => ({ id: hash(c.id), passed: c.passed })) };
}
export function buildReport(task) {
  const attempts = task.attempts;
  const latencies = attempts.filter(a => a.status === 'completed').map(a => a.metrics?.request_wall_ms?.value).filter(Number.isFinite);
  const elapsed = task.endedAt ? Date.parse(task.endedAt) - Date.parse(task.startedAt) : null;
  const checks = task.verification.checks ?? [];
  const verified = checks.length && task.verification.status !== 'unverified';
  const tokenSum = key => {
    const counts = attempts.map(a => a.metrics?.[key]?.value);
    return counts.length && counts.every(Number.isFinite) ? counts.reduce((a, b) => a + b, 0) : null;
  };
  return {
    ...task,
    summary: {
      attempts: attempts.length, retries: attempts.filter(a => a.retryOf).length,
      completed: attempts.filter(a => a.status === 'completed').length,
      failed: attempts.filter(a => a.status === 'failed').length,
      task_elapsed_ms: metric(elapsed, 'ms', 'runner.wall_clock', 'derived', 'task'),
      median_request_ms: metric(median(latencies), 'ms', 'runner.monotonic', 'derived', 'task'),
      prompt_tokens: metric(tokenSum('prompt_tokens'), 'tokens', 'ollama.final', 'derived', 'task'),
      completion_tokens: metric(tokenSum('completion_tokens'), 'tokens', 'ollama.final', 'derived', 'task'),
      verification: { source: task.verification.source, passed: verified ? checks.filter(c => c.passed).length : null, executed: verified ? checks.length : null, passRate: verified ? checks.filter(c => c.passed).length / checks.length : null },
      cost: null, savings: null,
    },
  };
}
export function comparisonKey(task) {
  return hash({ taskHash: task.taskHash, git: task.git, attempts: task.attempts.map(a => ({ requestHash: a.requestHash, options: a.options, runtime: a.runtime, hardwareHash: a.hardwareHash, rubricHash: a.rubricHash, loadPolicy: a.loadPolicy })), verification: task.verification.rubricHash ?? task.attempts.map(a => a.rubricHash) });
}
export function compare(tasks) {
  check(tasks.length >= 2, 'Compare needs at least two tasks.');
  const equivalent = tasks.every(t => comparisonKey(t) === comparisonKey(tasks[0])) && tasks.every(t => t.attempts.length > 0 && t.attempts.every(a => a.loadPolicy !== 'uncontrolled'));
  return { equivalent, limitations: equivalent ? ['Small samples do not establish statistical superiority.', 'Warm/cold policy is caller-declared; inspect load_ms.'] : ['Inputs, environment, rubric, options, or declared load policies are not comparable; no winner is selected.'], runs: tasks.map(buildReport), winner: null };
}
export function markdown(report) {
  const value = m => m?.value === null || m?.value === undefined ? 'N/A' : String(Math.round(m.value * 100) / 100);
  return [
    '# Local task telemetry', '', `Task: ${report.taskId}`, `Status: ${report.status}`, `Verification: ${report.verification.status} (${report.verification.source})`, '',
    '| Attempt | Status | Model | Wall ms | Prompt tokens | Output tokens |', '|---|---|---|---:|---:|---:|',
    ...report.attempts.map(a => `| ${a.attemptId} | ${a.status} | ${String(a.model.name).replace(/[|\r\n<>]/g, '')} | ${value(a.metrics?.request_wall_ms)} | ${value(a.metrics?.prompt_tokens)} | ${value(a.metrics?.completion_tokens)} |`), '',
    'Coverage: runner local calls only. Host activity is not instrumented.',
    'System CPU/memory are not model-only usage. Missing sensors are N/A.',
    'No monetary, energy, or human-time savings are inferred.', '',
  ].join('\n');
}
