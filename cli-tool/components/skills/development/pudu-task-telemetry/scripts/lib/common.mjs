import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';

export class TaskError extends Error {
  constructor(code, message, exitCode = 2) {
    super(message);
    this.code = code;
    this.exitCode = exitCode;
  }
}
export const fail = (code, message, exitCode) => { throw new TaskError(code, message, exitCode); };
export const hash = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
export const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export function check(condition, message, code = 'invalid_input', exitCode = 2) {
  if (!condition) fail(code, message, exitCode);
}
export function identifier(value, label = 'identifier') {
  check(typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(value), `Invalid ${label}.`);
  return value;
}
export async function inputFile(file, json = true) {
  try {
    check((await stat(file)).size <= 4 * 1024 * 1024, 'Input exceeds 4 MiB.');
    const data = await readFile(file, 'utf8');
    return json ? JSON.parse(data) : data;
  } catch (error) {
    if (error instanceof TaskError) throw error;
    fail('invalid_input', 'Cannot read input file or parse JSON.');
  }
}
export function publicError(error) {
  return error instanceof TaskError
    ? { code: error.code, message: error.message }
    : { code: 'internal_error', message: 'Operation failed; raw diagnostics are omitted to protect local data.' };
}
export const median = values => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
