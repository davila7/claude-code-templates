jest.mock('fs-extra', () => ({ stat: jest.fn(), readFile: jest.fn() }));

const DataCache = require('../../src/analytics/data/DataCache');
const fs = require('fs-extra');

describe('DataCache size limits during startup', () => {
  let cache;

  beforeEach(() => {
    jest.useFakeTimers();
    cache = new DataCache();
    cache.configure({ maxCacheSize: 3 });
    fs.stat.mockResolvedValue({ mtime: new Date(1000), size: 100 });
    fs.readFile.mockResolvedValue(JSON.stringify({
      type: 'user',
      uuid: 'message',
      timestamp: '2026-01-01T00:00:00Z',
      message: { role: 'user', content: 'hello' }
    }));
  });

  afterEach(() => {
    cache.cleanup();
    jest.useRealTimers();
  });

  it('bounds raw and parsed transcripts before the cleanup timer runs', async () => {
    for (let i = 0; i < 100; i++) {
      const messages = await cache.getParsedConversation(`/sessions/${i}.jsonl`);
      expect(messages[0].content).toBe('hello');
      for (const name of ['fileContent', 'parsedConversations', 'fileStats']) {
        expect(cache.caches[name].size).toBeLessThanOrEqual(3);
      }
    }
    expect(cache.metrics.evictions).toBeGreaterThan(0);
    expect(jest.getTimerCount()).toBe(1);
  });

  it.each([
    ['getCachedTokenUsage', 'tokenUsage'],
    ['getCachedModelInfo', 'modelInfo'],
    ['getCachedStatusSquares', 'statusSquares'],
    ['getCachedToolUsage', 'toolUsage']
  ])('bounds %s results on insertion', async (method, name) => {
    for (let i = 0; i < 10; i++) {
      const result = { index: i };
      expect(await cache[method](`/sessions/${i}.jsonl`, async () => result)).toBe(result);
      expect(cache.caches[name].size).toBeLessThanOrEqual(3);
      expect(cache.caches.fileStats.size).toBeLessThanOrEqual(3);
    }
  });

  it('retains hits and reloads an evicted transcript without losing data', async () => {
    for (let i = 0; i < 4; i++) {
      await cache.getParsedConversation(`/sessions/${i}.jsonl`);
    }
    expect(cache.caches.parsedConversations.has('/sessions/0.jsonl')).toBe(false);
    const reads = fs.readFile.mock.calls.length;
    await cache.getParsedConversation('/sessions/3.jsonl');
    expect(fs.readFile).toHaveBeenCalledTimes(reads);
    const messages = await cache.getParsedConversation('/sessions/0.jsonl');
    expect(messages[0].content).toBe('hello');
    expect(fs.readFile).toHaveBeenCalledTimes(reads + 1);
  });

  it('keeps eviction metrics numeric after clearAll', async () => {
    cache.clearAll();
    for (let i = 0; i < 5; i++) {
      await cache.getFileContent(`/sessions/${i}.jsonl`);
    }
    expect(cache.caches.fileContent.size).toBe(3);
    expect(Number.isFinite(cache.metrics.evictions)).toBe(true);
    expect(cache.metrics.evictions).toBeGreaterThan(0);
  });

  it('evicts the oldest file timestamp, not simply the first insertion', async () => {
    fs.stat.mockImplementation(async (filepath) => ({
      mtime: new Date(filepath.includes('old') ? 1000 : 2000), size: 100
    }));
    await cache.getFileContent('/new-1.jsonl');
    await cache.getFileContent('/old.jsonl');
    await cache.getFileContent('/new-2.jsonl');
    await cache.getFileContent('/new-3.jsonl');
    expect(cache.caches.fileContent.has('/old.jsonl')).toBe(false);
    expect(cache.caches.fileContent.has('/new-1.jsonl')).toBe(true);
  });

  it('can disable retention with a zero entry limit while still returning data', async () => {
    cache.configure({ maxCacheSize: 0 });
    const messages = await cache.getParsedConversation('/session.jsonl');
    expect(messages[0].content).toBe('hello');
    expect(cache.caches.fileContent.size).toBe(0);
    expect(cache.caches.parsedConversations.size).toBe(0);
    expect(cache.caches.fileStats.size).toBe(0);
  });

  it('continues to invalidate and recompute retained entries', async () => {
    const compute = jest.fn().mockResolvedValueOnce({ total: 1 }).mockResolvedValueOnce({ total: 2 });
    const filepath = '/session.jsonl';
    expect(await cache.getCachedTokenUsage(filepath, compute)).toEqual({ total: 1 });
    expect(await cache.getCachedTokenUsage(filepath, compute)).toEqual({ total: 1 });
    expect(compute).toHaveBeenCalledTimes(1);
    cache.invalidateFile(filepath);
    expect(await cache.getCachedTokenUsage(filepath, compute)).toEqual({ total: 2 });
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('periodic enforcement still bounds maps and counts each eviction once', () => {
    for (let i = 0; i < 5; i++) {
      cache.caches.projectStats.set(`/projects/${i}`, { timestamp: i });
    }
    cache.enforceSizeLimits();
    expect(cache.caches.projectStats.size).toBe(3);
    expect(cache.metrics.evictions).toBe(2);
    cache.enforceSizeLimits();
    expect(cache.metrics.evictions).toBe(2);
  });
});
