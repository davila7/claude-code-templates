// One job at a time, and the newest request always runs: a request while a job runs replaces any
// request still waiting, and runs once the current job settles. What `trigger` returns settles
// after the newest job has run. A job's failure is the job's to report; it never stops the next.
// Pure: no engine, so tests/latest.test.ts runs it alone.

export type Job = () => Promise<void>

export function latest(): (job: Job) => Promise<void> {
  let running: Promise<void> | null = null
  let waiting: Job | null = null
  const drain = async (): Promise<void> => {
    while (waiting) {
      const job = waiting
      waiting = null
      try { await job() } catch { /* the job reports its own failure */ }
    }
    running = null
  }
  return job => {
    waiting = job
    running ??= drain()
    return running
  }
}
