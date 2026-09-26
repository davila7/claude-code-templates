import { inspectModel } from './ollama-adapter.mjs';
import { median, hash } from './common.mjs';

export async function candidates(pudu, server, contextBudget, signal) {
  const result = [];
  for (const row of pudu.models.filter(m => m.source === 'ollama')) {
    const exact = server.models.find(m => m.name === row.id);
    const digestMatches = row.digest && row.digest.length >= 12 ? server.models.filter(m => m.digest.startsWith(row.digest)) : [];
    const tag = exact ?? (digestMatches.length === 1 ? digestMatches[0] : null);
    if (!tag) continue;
    try {
      const model = await inspectModel(server, tag.name, signal);
      const excluded = model.contextLength < contextBudget ? 'insufficient_context' : model.sizeBytes > pudu.hardware.memoryBytes * 0.85 ? 'weights_exceed_memory_budget' : null;
      result.push({ ...model, grade: row.grade, benchmark: row.benchmark, excluded, autoEligible: !excluded && ['S', 'A', 'B'].includes(row.grade), gradeOrigin: row.gradeOrigin });
    } catch (e) {
      if (signal?.aborted) throw e;
      result.push({ name: tag.name, excluded: e.code ?? 'unsupported_model', autoEligible: false });
    }
  }
  return result;
}

export function recommend(models, evidence, { hardwareHash, runtimeVersion, taskKind, contextBudget }) {
  const eligible = models.filter(m => m.autoEligible);
  const scores = [];
  for (const model of eligible) {
    const groups = new Map();
    const seen = new Set();
    let total = 0;
    let passed = 0;
    for (const task of evidence) {
      if (seen.has(task.taskId)) continue;
      seen.add(task.taskId);
      for (const a of task.attempts) {
        if (a.model.digest !== model.digest || a.hardwareHash !== hardwareHash || a.runtime.version !== runtimeVersion || a.taskKind !== taskKind || a.options.num_ctx !== contextBudget || a.loadPolicy !== 'warm' || !a.rubricHash) continue;
        total++;
        const valid = task.status === 'completed' && task.attempts.length === 1 && a.status === 'completed' && a.verification?.source === 'runner' && a.verification?.status === 'passed' && Number.isFinite(a.metrics?.request_wall_ms?.value);
        if (valid) passed++;
        const key = hash({ task: task.taskHash, request: a.requestHash, rubric: a.rubricHash, options: a.options });
        const samples = groups.get(key) ?? [];
        samples.push(valid ? a.metrics.request_wall_ms.value : null);
        groups.set(key, samples);
      }
    }
    const suite = [...groups.keys()].sort();
    const qualified = total > 0 && passed === total && suite.length >= 5 && suite.every(k => groups.get(k).length >= 3);
    scores.push({ model: model.name, digest: model.digest, qualified, total, passed, passRate: total ? passed / total : null,
      suiteHash: hash(suite), cases: suite.length,
      medianMs: qualified ? median(suite.map(k => median(groups.get(k)))) : null });
  }
  // Do not rank models against different suites. The caller must supply a shared suite.
  const qualified = scores.filter(s => s.qualified);
  const comparable = qualified.length > 0 && qualified.every(s => s.suiteHash === qualified[0].suiteHash);
  qualified.sort((a, b) => a.medianMs - b.medianMs || a.model.localeCompare(b.model));
  return { status: comparable ? 'selected' : 'needs_selection', selected: comparable ? qualified[0].model : null,
    reason: comparable ? 'Passed at least five shared exact-text cases, three runs each; lowest median of per-case median latencies; all supplied comparable trials passed.' : 'No comparable verified local suite. Select a model explicitly for a pilot.',
    candidates: models, evidence: scores };
}
