/**
 * Unit Tests for DataCache
 * Tests multi-level caching functionality
 */

const DataCache = require('../../src/analytics/data/DataCache');
const fs = require('fs-extra');

// Mock fs-extra
jest.mock('fs-extra');

describe('DataCache', () => {
  let dataCache;
  
  beforeEach(() => {
    dataCache = new DataCache();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      expect(dataCache.caches.fileContent).toBeInstanceOf(Map);
      expect(dataCache.caches.parsedData).toBeInstanceOf(Map);
      expect(dataCache.caches.computationResults).toBeInstanceOf(Map);
      expect(dataCache.metrics.hits).toBe(0);
      expect(dataCache.metrics.misses).toBe(0);
    });

    it('should accept custom options', () => {
      const customCache = new DataCache({
        fileContentTTL: 10000,
        maxFileSize: 2000000
      });
      
      expect(customCache.options.fileContentTTL).toBe(10000);
      expect(customCache.options.maxFileSize).toBe(2000000);
    });
  });

  describe('getFileContent', () => {
    const mockFilePath = '/test/file.jsonl';
    const mockContent = '{"test": "data"}';
    const mockStats = {
      mtime: new Date(Date.now() - 1000),
      size: 1024
    };

    beforeEach(() => {
      fs.stat.mockResolvedValue(mockStats);
      fs.readFile.mockResolvedValue(mockContent);
    });

    it('should read file when not cached', async () => {
      const content = await dataCache.getFileContent(mockFilePath);
      
      expect(content).toBe(mockContent);
      expect(fs.stat).toHaveBeenCalledWith(mockFilePath);
      expect(fs.readFile).toHaveBeenCalledWith(mockFilePath, 'utf8');
      expect(dataCache.metrics.misses).toBe(1);
      expect(dataCache.metrics.hits).toBe(0);
    });

    it('should return cached content when file unchanged', async () => {
      // First call - cache miss
      await dataCache.getFileContent(mockFilePath);
      
      // Second call - cache hit
      const content = await dataCache.getFileContent(mockFilePath);
      
      expect(content).toBe(mockContent);
      expect(fs.readFile).toHaveBeenCalledTimes(1); // Only called once
      expect(dataCache.metrics.hits).toBe(1);
      expect(dataCache.metrics.misses).toBe(1);
    });

    it('should re-read file when modified', async () => {
      // First call
      await dataCache.getFileContent(mockFilePath);
      
      // Simulate file modification
      const newerStats = {
        mtime: new Date(Date.now() + 1000),
        size: 1024
      };
      fs.stat.mockResolvedValue(newerStats);
      fs.readFile.mockResolvedValue('{"updated": "data"}');
      
      // Second call
      const content = await dataCache.getFileContent(mockFilePath);
      
      expect(content).toBe('{"updated": "data"}');
      expect(fs.readFile).toHaveBeenCalledTimes(2);
      expect(dataCache.metrics.misses).toBe(2);
    });

    it('should handle file read errors', async () => {
      fs.stat.mockRejectedValue(new Error('File not found'));
      
      await expect(dataCache.getFileContent(mockFilePath)).rejects.toThrow('File not found');
    });

    it('should skip large files', async () => {
      const largeFileStats = {
        mtime: new Date(),
        size: 11 * 1024 * 1024 // 11MB - exceeds default 10MB limit
      };
      fs.stat.mockResolvedValue(largeFileStats);
      
      await expect(dataCache.getFileContent(mockFilePath)).rejects.toThrow('File too large');
    });
  });

  describe('getParsedConversation', () => {
    const mockFilePath = '/test/conversation.jsonl';
    const mockContent = '{"message": {"role": "user", "content": "hello"}}\n{"message": {"role": "assistant", "content": "hi"}}';

    beforeEach(() => {
      // Mock getFileContent to return our test data
      jest.spyOn(dataCache, 'getFileContent').mockResolvedValue(mockContent);
    });

    it('should parse conversation content correctly', async () => {
      const parsed = await dataCache.getParsedConversation(mockFilePath);
      
      expect(parsed).toHaveLength(2);
      expect(parsed[0]).toMatchObject({
        role: 'user',
        content: 'hello'
      });
      expect(parsed[1]).toMatchObject({
        role: 'assistant',
        content: 'hi'
      });
    });

    it('should cache parsed results', async () => {
      // First call
      await dataCache.getParsedConversation(mockFilePath);
      
      // Second call
      await dataCache.getParsedConversation(mockFilePath);
      
      // getFileContent should only be called once due to caching
      expect(dataCache.getFileContent).toHaveBeenCalledTimes(1);
    });

    it('should handle malformed JSON lines', async () => {
      const badContent = '{"valid": "json"}\n{invalid json}\n{"another": "valid"}';
      dataCache.getFileContent.mockResolvedValue(badContent);
      
      const parsed = await dataCache.getParsedConversation(mockFilePath);
      
      expect(parsed).toHaveLength(2); // Should skip the invalid line
    });

    it('should handle empty files', async () => {
      dataCache.getFileContent.mockResolvedValue('');
      
      const parsed = await dataCache.getParsedConversation(mockFilePath);
      
      expect(parsed).toHaveLength(0);
    });
  });

  describe('getCachedTokenUsage', () => {
    const mockFilePath = '/test/file.jsonl';
    const mockComputeFunction = jest.fn().mockReturnValue({
      total: 1500,
      input: 800,
      output: 700
    });

    it('should compute and cache token usage', async () => {
      const result = await dataCache.getCachedTokenUsage(mockFilePath, mockComputeFunction);
      
      expect(result).toEqual({
        total: 1500,
        input: 800,
        output: 700
      });
      expect(mockComputeFunction).toHaveBeenCalledTimes(1);
    });

    it('should return cached result on subsequent calls', async () => {
      // First call
      await dataCache.getCachedTokenUsage(mockFilePath, mockComputeFunction);
      
      // Second call
      const result = await dataCache.getCachedTokenUsage(mockFilePath, mockComputeFunction);
      
      expect(result).toEqual({
        total: 1500,
        input: 800,
        output: 700
      });
      expect(mockComputeFunction).toHaveBeenCalledTimes(1); // Only called once
    });

    it('should handle computation errors', async () => {
      const errorFunction = jest.fn().mockImplementation(() => {
        throw new Error('Computation failed');
      });
      
      await expect(dataCache.getCachedTokenUsage(mockFilePath, errorFunction)).rejects.toThrow('Computation failed');
    });
  });

  describe('invalidateFile', () => {
    const mockFilePath = '/test/file.jsonl';

    it('should remove all cache entries for a file', async () => {
      // Populate caches
      dataCache.caches.fileContent.set(mockFilePath, { content: 'test', timestamp: Date.now() });
      dataCache.caches.parsedData.set(mockFilePath, { data: 'test', timestamp: Date.now() });
      dataCache.caches.computationResults.set(`tokens_${mockFilePath}`, { result: 'test', timestamp: Date.now() });
      
      dataCache.invalidateFile(mockFilePath);
      
      expect(dataCache.caches.fileContent.has(mockFilePath)).toBe(false);
      expect(dataCache.caches.parsedData.has(mockFilePath)).toBe(false);
      expect(dataCache.caches.computationResults.has(`tokens_${mockFilePath}`)).toBe(false);
    });
  });

  describe('clearExpired', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should remove expired cache entries', () => {
      const now = Date.now();
      jest.setSystemTime(now);
      
      // Add expired entry
      dataCache.caches.fileContent.set('/expired/file', {
        content: 'old',
        timestamp: now - 100000 // Older than TTL
      });
      
      // Add fresh entry
      dataCache.caches.fileContent.set('/fresh/file', {
        content: 'new',
        timestamp: now - 1000 // Within TTL
      });
      
      // Fast forward time
      jest.setSystemTime(now + 50000);
      
      dataCache.clearExpired();
      
      expect(dataCache.caches.fileContent.has('/expired/file')).toBe(false);
      expect(dataCache.caches.fileContent.has('/fresh/file')).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', async () => {
      // Add some test data
      await dataCache.getFileContent('/test/file1.jsonl');
      await dataCache.getFileContent('/test/file2.jsonl');
      
      const stats = dataCache.getStats();
      
      expect(stats).toMatchObject({
        fileContent: expect.objectContaining({
          size: expect.any(Number),
          hitRate: expect.any(Number)
        }),
        parsedData: expect.objectContaining({
          size: expect.any(Number)
        }),
        computationResults: expect.objectContaining({
          size: expect.any(Number)
        }),
        metrics: expect.objectContaining({
          hits: expect.any(Number),
          misses: expect.any(Number),
          hitRate: expect.any(Number)
        })
      });
    });

    it('should calculate hit rate correctly', async () => {
      // Generate some hits and misses
      await dataCache.getFileContent('/test/file.jsonl'); // miss
      await dataCache.getFileContent('/test/file.jsonl'); // hit
      await dataCache.getFileContent('/test/file.jsonl'); // hit
      
      const stats = dataCache.getStats();
      
      expect(stats.metrics.hits).toBe(2);
      expect(stats.metrics.misses).toBe(1);
      expect(stats.metrics.hitRate).toBeCloseTo(66.67, 1); // 2/3 * 100
    });
  });

  describe('cleanup', () => {
    it('should clear all caches and reset metrics', () => {
      // Populate caches
      dataCache.caches.fileContent.set('test', { data: 'test' });
      dataCache.caches.parsedData.set('test', { data: 'test' });
      dataCache.caches.computationResults.set('test', { data: 'test' });
      dataCache.metrics.hits = 10;
      dataCache.metrics.misses = 5;
      
      dataCache.cleanup();
      
      expect(dataCache.caches.fileContent.size).toBe(0);
      expect(dataCache.caches.parsedData.size).toBe(0);
      expect(dataCache.caches.computationResults.size).toBe(0);
      expect(dataCache.metrics.hits).toBe(0);
      expect(dataCache.metrics.misses).toBe(0);
    });
  });
});