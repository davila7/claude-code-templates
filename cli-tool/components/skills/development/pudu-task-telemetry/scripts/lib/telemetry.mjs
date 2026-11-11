import os from 'node:os';
import { performance } from 'node:perf_hooks';

export function metric(value, unit, source, origin = 'measured', scope = 'attempt', reason = 'not_available') {
  const available = typeof value === 'number' && Number.isFinite(value) && value >= 0;
  return { value: available ? value : null, unit, origin: available ? origin : 'unavailable', source, scope, unavailableReason: available ? null : reason };
}
export function runtimeMetrics(final = {}) {
  const duration = key => Number.isFinite(final[key]) && final[key] >= 0 ? final[key] / 1e6 : null;
  const count = key => Number.isSafeInteger(final[key]) && final[key] >= 0 ? final[key] : null;
  const tokens = count('eval_count');
  const tps = tokens !== null && Number.isFinite(final.eval_duration) && final.eval_duration > 0 ? tokens / (final.eval_duration / 1e9) : null;
  return {
    prompt_tokens: metric(count('prompt_eval_count'), 'tokens', 'ollama.final'),
    completion_tokens: metric(tokens, 'tokens', 'ollama.final'),
    generation_tps: metric(tps, 'tokens/s', 'ollama.final', 'derived'),
    load_ms: metric(duration('load_duration'), 'ms', 'ollama.final'),
    runtime_total_ms: metric(duration('total_duration'), 'ms', 'ollama.final'),
    prompt_eval_ms: metric(duration('prompt_eval_duration'), 'ms', 'ollama.final'),
    eval_ms: metric(duration('eval_duration'), 'ms', 'ollama.final'),
  };
}
export function sampler({ enabled = true, intervalMs = 1000 } = {}) {
  const started = performance.now();
  let previous = os.cpus();
  let peak = null;
  let samples = 0;
  let cpuSum = 0;
  let cpuSamples = 0;
  let lastSampleMs = null;
  const tick = () => {
    peak = Math.max(peak ?? 0, os.totalmem() - os.freemem());
    samples++;
    const current = os.cpus();
    if (lastSampleMs !== null && current.length === previous.length) {
      let total = 0;
      let idle = 0;
      current.forEach((cpu, index) => {
        for (const key of Object.keys(cpu.times)) total += cpu.times[key] - previous[index].times[key];
        idle += cpu.times.idle - previous[index].times.idle;
      });
      if (total > 0 && idle >= 0 && idle <= total) { cpuSum += 100 * (1 - idle / total); cpuSamples++; }
    }
    previous = current;
    lastSampleMs = performance.now() - started;
  };
  if (enabled) tick();
  const timer = enabled ? setInterval(tick, intervalMs) : null;
  timer?.unref();
  return {
    stop() {
      if (timer) clearInterval(timer);
      return {
        samples, sampleCoverageMs: lastSampleMs,
        metrics: {
          system_memory_peak_bytes: metric(peak, 'bytes', 'node.os', 'measured', 'system'),
          system_cpu_mean_pct: metric(cpuSamples ? cpuSum / cpuSamples : null, '%', 'node.os', 'measured', 'system'),
          ...Object.fromEntries([['gpu_pct', '%'], ['power_w', 'W'], ['temperature_c', 'C'], ['model_rss_bytes', 'bytes'], ['swap_bytes', 'bytes']].map(([name, unit]) => [name, metric(null, unit, 'none', 'unavailable', name === 'model_rss_bytes' ? 'model' : 'system', 'sensor_not_implemented')])),
        },
      };
    },
  };
}
