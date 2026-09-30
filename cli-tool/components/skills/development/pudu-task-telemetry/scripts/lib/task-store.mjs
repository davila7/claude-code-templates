import * as fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { check, object, TaskError, hash } from './common.mjs';

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const storageError = () => new TaskError('storage_error', 'Task storage could not be accessed safely.', 7);
async function safeDir(parent, name, create = false) {
  const dir = path.join(parent, name);
  if (create) await fs.mkdir(dir, { mode: 0o700 }).catch(e => { if (e.code !== 'EEXIST') throw e; });
  const stat = await fs.lstat(dir);
  check(stat.isDirectory() && !stat.isSymbolicLink(), 'Unsafe storage directory.', 'storage_error', 7);
  return dir;
}
async function safeRead(file, limit = 32 * 1024 * 1024) {
  const handle = await fs.open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    check(stat.isFile() && stat.size <= limit && stat.nlink === 1, 'Unsafe storage file.', 'storage_error', 7);
    return await handle.readFile('utf8');
  } finally { await handle.close(); }
}
async function atomic(dir, name, value) {
  const target = path.join(dir, name);
  try {
    const stat = await fs.lstat(target);
    check(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1, 'Unsafe storage target.', 'storage_error', 7);
  } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const temp = path.join(dir, `.${randomUUID()}.tmp`);
  try {
    const handle = await fs.open(temp, 'wx', 0o600);
    try { await handle.writeFile(JSON.stringify(value) + '\n'); await handle.sync(); }
    finally { await handle.close(); }
    await fs.rename(temp, target);
  } finally { await fs.unlink(temp).catch(() => {}); }
}
const isAlive = pid => {
  try { process.kill(pid, 0); return true; } catch (error) { return error.code !== 'ESRCH'; }
};

export class TaskStore {
  constructor(repo) { this.repo = path.resolve(repo); }
  async root(create = false) {
    try {
      const repo = await fs.realpath(this.repo);
      return await safeDir(await safeDir(repo, '.pudu-ai', create), 'task-telemetry', create);
    } catch (e) { throw e instanceof TaskError ? e : storageError(); }
  }
  async dir(id) {
    check(UUID.test(id), 'Invalid task UUID.');
    try { return await safeDir(await this.root(), id); }
    catch (e) { throw e instanceof TaskError ? e : storageError(); }
  }
  async create(taskText, git = {}) {
    try {
      const root = await this.root(true);
      const id = randomUUID();
      const dir = await safeDir(root, id, true);
      const task = {
        schemaVersion: 'pudu-task-telemetry/v1', taskId: id,
        repositoryId: hash(await fs.realpath(this.repo)), git,
        taskHash: hash(taskText), startedAt: new Date().toISOString(), endedAt: null,
        status: 'running', verification: { status: 'unverified', source: 'runner', checks: [] }, attempts: [],
        coverage: { localCallsOnly: true, hostActivity: 'not_instrumented' },
      };
      await this.save(dir, task, 'task_started');
      return task;
    } catch (e) { throw e instanceof TaskError ? e : storageError(); }
  }
  async lock(id, fn) {
    const dir = await this.dir(id);
    const lockPath = path.join(dir, '.lock');
    let owned = false;
    try {
      check(!await fs.lstat(path.join(dir, '.recovering')).then(() => true, e => { if (e.code === 'ENOENT') return false; throw e; }), 'Recovery is in progress.', 'task_busy', 4);
      const handle = await fs.open(lockPath, 'wx', 0o600).catch(e => {
        if (e.code === 'EEXIST') throw new TaskError('task_busy', 'Task is locked; use recover only after the owner exits.', 4);
        throw e;
      });
      owned = true;
      await handle.writeFile(JSON.stringify({ pid: process.pid }));
      await handle.close();
      check(!await fs.lstat(path.join(dir, '.recovering')).then(() => true, e => { if (e.code === 'ENOENT') return false; throw e; }), 'Recovery is in progress.', 'task_busy', 4);
      return await fn(dir);
    } finally { if (owned) await fs.unlink(lockPath).catch(() => {}); }
  }
  async read(id, { recovering = false } = {}) {
    try {
      const dir = await this.dir(id);
      // Events are authoritative; a crash between append and snapshot cannot lose an attempt.
      const raw = await safeRead(path.join(dir, 'events.jsonl'));
      check(recovering || raw.endsWith('\n'), 'Incomplete event tail; recover the task before using it.', 'recovery_required', 4);
      const lines = raw.split('\n');
      lines.pop(); // Ignore only the incomplete trailing line (or empty terminator).
      check(lines.length > 0, 'Task has no durable events.', 'storage_error', 7);
      let task;
      for (const line of lines) {
        const event = JSON.parse(line);
        check(event.task?.taskId === id && event.task.schemaVersion === 'pudu-task-telemetry/v1', 'Invalid task event.', 'storage_error', 7);
        task = event.task;
        check(object(task) && Array.isArray(task.attempts) && object(task.verification) && ['running', 'completed', 'failed', 'cancelled', 'interrupted'].includes(task.status) && typeof task.taskHash === 'string', 'Invalid task event.', 'storage_error', 7);
      }
      return task;
    } catch (e) { throw e instanceof TaskError ? e : storageError(); }
  }
  async save(dir, task, type) {
    try {
      const event = { eventId: randomUUID(), timestamp: new Date().toISOString(), type, task };
      const handle = await fs.open(path.join(dir, 'events.jsonl'), constants.O_WRONLY | constants.O_CREAT | constants.O_APPEND | constants.O_NOFOLLOW, 0o600);
      try {
        const stat = await handle.stat();
        const line = JSON.stringify(event) + '\n';
        check(stat.isFile() && stat.nlink === 1 && stat.size + Buffer.byteLength(line) <= 32 * 1024 * 1024, 'Task event storage limit reached.', 'storage_error', 7);
        await handle.writeFile(line); await handle.sync();
      } finally { await handle.close(); }
      await atomic(dir, 'task.json', task);
    } catch (e) { throw e instanceof TaskError ? e : storageError(); }
  }
  async report(id, report) {
    try { await atomic(await this.dir(id), 'report.json', report); }
    catch (e) { throw e instanceof TaskError ? e : storageError(); }
  }
  async recover(id) {
    const dir = await this.dir(id);
    const marker = path.join(dir, '.recovering');
    try { await fs.mkdir(marker, { mode: 0o700 }); }
    catch { throw new TaskError('task_busy', 'Another recovery is in progress.', 4); }
    try {
      try {
        const owner = JSON.parse(await safeRead(path.join(dir, '.lock')));
        check(Number.isInteger(owner.pid) && owner.pid > 0 && !isAlive(owner.pid), 'Lock owner is alive or cannot be identified.', 'task_busy', 4);
        await fs.unlink(path.join(dir, '.lock'));
      } catch (e) { if (e.code !== 'ENOENT') throw e; }
      const task = await this.read(id, { recovering: true });
      const file = path.join(dir, 'events.jsonl');
      const raw = await safeRead(file);
      if (!raw.endsWith('\n')) {
        const handle = await fs.open(file, constants.O_WRONLY | constants.O_NOFOLLOW);
        try { await handle.truncate(Buffer.byteLength(raw.slice(0, raw.lastIndexOf('\n') + 1))); }
        finally { await handle.close(); }
      }
      if (task.status === 'running') {
        task.status = 'interrupted';
        task.endedAt = new Date().toISOString();
        for (const attempt of task.attempts) if (attempt.status === 'running') {
          attempt.status = 'interrupted'; attempt.endedAt = task.endedAt;
        }
        await this.save(dir, task, 'task_recovered');
      }
      return task;
    } finally { await fs.rmdir(marker); }
  }
  async writeOutput(relative, content) {
    check(typeof relative === 'string' && relative.length > 0 && !path.isAbsolute(relative) && !relative.includes('\\') && !relative.split('/').some(p => p === '..' || p === '' || p === '.'), 'Output must be a relative path inside the repository.');
    const parts = relative.split('/');
    check(!parts.some(part => ['.pudu-ai', '.git'].includes(part.toLowerCase())), 'Output cannot target task storage or Git internals.');
    let dir = await fs.realpath(this.repo);
    for (const part of parts.slice(0, -1)) dir = await safeDir(dir, part);
    const handle = await fs.open(path.join(dir, parts.at(-1)), 'wx', 0o600).catch(() => { throw new TaskError('output_error', 'Output must be a new file in an existing safe directory.', 7); });
    try { await handle.writeFile(content); } finally { await handle.close(); }
  }
}
