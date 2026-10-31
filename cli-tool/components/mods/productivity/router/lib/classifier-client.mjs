import {
  buildRequest,
  FAILURES_TO_PAUSE,
  isTransientStatus,
  PAUSE_MS,
  parseAnswers,
  RETRY_DELAY_MS,
  retryDelayMs,
} from './classifier-contract.mjs';
import { activeClassifier } from './config.mjs';

class AdviceError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

// Owned by one Mod activation. It survives history resets; the host cancels its work on unload.
export class ClassifierClient {
  constructor({ now = Date.now, health = null } = {}) {
    this.now = now;
    this.pending = null;
    this.active = false;
    this.restore(health);
  }

  restore(health) {
    this.failures =
      Number.isInteger(health?.failures) && health.failures >= 0 ? Math.min(health.failures, FAILURES_TO_PAUSE) : 0;
    this.pausedUntil = Number.isFinite(health?.pausedUntil) ? health.pausedUntil : 0;
  }

  snapshot() {
    return { failures: this.failures, pausedUntil: this.pausedUntil };
  }

  async ask({ request, sleep, config, apiKey, endpoint, prompt, turns, signal }) {
    if (!apiKey) return { advice: null, error: 'missing-key' };
    if (!endpoint) return { advice: null, error: 'missing-account' };
    if (signal?.aborted) return { advice: null, error: 'cancelled' };
    if (this.now() < this.pausedUntil) return { advice: null, error: 'paused' };
    if (this.active || this.pending) return { advice: null, error: 'busy' };
    this.active = true;
    try {
      const advice = await this.complete({ request, sleep, config, apiKey, endpoint, prompt, turns, signal });
      this.failures = 0;
      this.pausedUntil = 0;
      return { advice, error: null };
    } catch (error) {
      const code = signal?.aborted ? 'cancelled' : error instanceof AdviceError ? error.code : 'unreachable';
      if (code !== 'cancelled' && code !== 'policy') {
        this.failures = Math.min(this.failures + 1, FAILURES_TO_PAUSE);
        if (this.failures >= FAILURES_TO_PAUSE) this.pausedUntil = this.now() + PAUSE_MS;
      }
      return { advice: null, error: code };
    } finally {
      this.active = false;
    }
  }

  async complete({ request, sleep, config, apiKey, endpoint, prompt, turns, signal }) {
    const deadline = this.now() + activeClassifier(config).timeoutMs;
    const body = JSON.stringify(buildRequest(config, prompt, turns));
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const remaining = deadline - this.now();
      if (signal?.aborted) throw new AdviceError('cancelled');
      if (remaining <= 0) throw new AdviceError('timeout');
      const call = Promise.resolve().then(() =>
        request(endpoint, {
          method: 'POST',
          headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
          body,
        }),
      );
      this.pending = call;
      const release = () => {
        if (this.pending === call) this.pending = null;
      };
      call.then(release, release);
      const timer = new AbortController();
      const cancel = () => timer.abort();
      signal?.addEventListener('abort', cancel, { once: true });
      let response;
      try {
        response = await Promise.race([
          call,
          sleep(remaining, { signal: timer.signal }).then(() => {
            throw new AdviceError('timeout');
          }),
        ]);
      } catch (error) {
        if (signal?.aborted) throw new AdviceError('cancelled');
        if (error instanceof AdviceError) throw error;
        if (/policy|denied|(?<!conn)refus|network access|nonessential/i.test(String(error?.message)))
          throw new AdviceError('policy');
        if (attempt === 1) throw new AdviceError('unreachable');
        if (RETRY_DELAY_MS >= deadline - this.now()) throw new AdviceError('timeout');
        await sleep(RETRY_DELAY_MS, { signal });
        continue;
      } finally {
        signal?.removeEventListener('abort', cancel);
        timer.abort();
      }
      if (signal?.aborted) throw new AdviceError('cancelled');
      if (this.now() >= deadline) throw new AdviceError('timeout');
      if (response.ok) {
        try {
          if (typeof response.text !== 'string' || response.text.length > 16_384) throw new AdviceError('malformed');
          const advice = parseAnswers(JSON.parse(response.text));
          if (this.now() >= deadline) throw new AdviceError('timeout');
          return advice;
        } catch (error) {
          if (error instanceof AdviceError) throw error;
          throw new AdviceError('malformed');
        }
      }
      if (response.status === 401 || response.status === 403) throw new AdviceError('auth');
      if (!isTransientStatus(response.status) || attempt === 1) throw new AdviceError('http');
      const value = response.headers?.['retry-after'];
      const wait = retryDelayMs(typeof value === 'string' ? value : null, this.now()) ?? RETRY_DELAY_MS;
      if (wait >= deadline - this.now()) throw new AdviceError('timeout');
      await sleep(wait, { signal });
    }
    throw new AdviceError('unreachable');
  }
}
