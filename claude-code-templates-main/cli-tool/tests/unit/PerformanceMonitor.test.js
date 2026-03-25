/**
 * Unit Tests for PerformanceMonitor
 * Tests performance monitoring and metrics collection
 */

const PerformanceMonitor = require('../../src/analytics/utils/PerformanceMonitor');

describe('PerformanceMonitor', () => {
  let performanceMonitor;

  beforeEach(() => {
    performanceMonitor = new PerformanceMonitor({
      enabled: true,
      logInterval: 1000,
      memoryThreshold: 50 * 1024 * 1024 // 50MB for testing
    });
  });

  afterEach(() => {
    if (performanceMonitor) {
      performanceMonitor.stopMonitoring();
    }
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const monitor = new PerformanceMonitor();
      
      expect(monitor.options.enabled).toBe(true);
      expect(monitor.options.logInterval).toBe(60000);
      expect(monitor.options.memoryThreshold).toBe(100 * 1024 * 1024);
      expect(monitor.metrics).toBeDefined();
      expect(monitor.timers).toEqual({});
      expect(monitor.counters).toEqual({});
    });

    it('should merge custom options', () => {
      const customOptions = {
        enabled: false,
        logInterval: 5000,
        memoryThreshold: 200 * 1024 * 1024
      };
      
      const monitor = new PerformanceMonitor(customOptions);
      
      expect(monitor.options.enabled).toBe(false);
      expect(monitor.options.logInterval).toBe(5000);
      expect(monitor.options.memoryThreshold).toBe(200 * 1024 * 1024);
    });
  });

  describe('timer operations', () => {
    it('should start and end timers correctly', () => {
      const timerName = 'test_operation';
      
      performanceMonitor.startTimer(timerName);
      expect(performanceMonitor.timers[timerName]).toBeDefined();
      expect(performanceMonitor.timers[timerName].start).toBeDefined();
      
      // Wait a small amount of time
      setTimeout(() => {
        const duration = performanceMonitor.endTimer(timerName);
        
        expect(duration).toBeGreaterThan(0);
        expect(performanceMonitor.timers[timerName]).toBeUndefined();
        expect(performanceMonitor.metrics.performance).toBeDefined();
      }, 10);
    });

    it('should handle ending non-existent timer', () => {
      const duration = performanceMonitor.endTimer('non_existent');
      expect(duration).toBe(0);
    });

    it('should record timer metadata', () => {
      const timerName = 'test_with_metadata';
      const metadata = { userId: '123', action: 'save' };
      
      performanceMonitor.startTimer(timerName);
      performanceMonitor.endTimer(timerName, metadata);
      
      const performanceMetrics = performanceMonitor.metrics.performance;
      expect(performanceMetrics).toBeDefined();
      expect(performanceMetrics.length).toBeGreaterThan(0);
      
      const lastMetric = performanceMetrics[performanceMetrics.length - 1];
      expect(lastMetric.operation).toBe(timerName);
      expect(lastMetric.userId).toBe('123');
      expect(lastMetric.action).toBe('save');
    });
  });

  describe('counter operations', () => {
    it('should increment counters', () => {
      const counterName = 'test_counter';
      
      performanceMonitor.incrementCounter(counterName);
      expect(performanceMonitor.counters[counterName]).toBe(1);
      
      performanceMonitor.incrementCounter(counterName, 5);
      expect(performanceMonitor.counters[counterName]).toBe(6);
    });

    it('should handle initial counter value', () => {
      const counterName = 'new_counter';
      
      performanceMonitor.incrementCounter(counterName, 10);
      expect(performanceMonitor.counters[counterName]).toBe(10);
    });
  });

  describe('metric recording', () => {
    it('should record metrics in categories', () => {
      const category = 'test_category';
      const data = { value: 42, timestamp: Date.now() };
      
      performanceMonitor.recordMetric(category, data);
      
      expect(performanceMonitor.metrics[category]).toBeDefined();
      expect(performanceMonitor.metrics[category]).toHaveLength(1);
      expect(performanceMonitor.metrics[category][0]).toMatchObject(data);
    });

    it('should add timestamp if not provided', () => {
      const category = 'test_category';
      const data = { value: 42 };
      
      performanceMonitor.recordMetric(category, data);
      
      const metric = performanceMonitor.metrics[category][0];
      expect(metric.timestamp).toBeDefined();
      expect(typeof metric.timestamp).toBe('number');
    });

    it('should limit metric array size', () => {
      const category = 'test_category';
      
      // Add more than 1000 metrics
      for (let i = 0; i < 1005; i++) {
        performanceMonitor.recordMetric(category, { value: i });
      }
      
      expect(performanceMonitor.metrics[category]).toHaveLength(1000);
    });

    it('should skip recording when disabled', () => {
      performanceMonitor.options.enabled = false;
      
      performanceMonitor.recordMetric('test', { value: 1 });
      
      expect(performanceMonitor.metrics.test).toBeUndefined();
    });
  });

  describe('error recording', () => {
    it('should record errors', () => {
      const errorType = 'validation_error';
      const errorMessage = 'Invalid input data';
      const metadata = { field: 'email' };
      
      performanceMonitor.recordError(errorType, errorMessage, metadata);
      
      expect(performanceMonitor.metrics.errors).toBeDefined();
      expect(performanceMonitor.metrics.errors).toHaveLength(1);
      
      const error = performanceMonitor.metrics.errors[0];
      expect(error.type).toBe(errorType);
      expect(error.message).toBe(errorMessage);
      expect(error.field).toBe('email');
    });
  });

  describe('request recording', () => {
    it('should record successful requests', () => {
      const endpoint = '/api/data';
      const duration = 150;
      const statusCode = 200;
      
      performanceMonitor.recordRequest(endpoint, duration, statusCode);
      
      expect(performanceMonitor.metrics.requests).toHaveLength(1);
      expect(performanceMonitor.counters.total_requests).toBe(1);
      expect(performanceMonitor.counters.error_requests).toBeUndefined();
      
      const request = performanceMonitor.metrics.requests[0];
      expect(request.endpoint).toBe(endpoint);
      expect(request.duration).toBe(duration);
      expect(request.statusCode).toBe(statusCode);
      expect(request.success).toBe(true);
    });

    it('should record error requests', () => {
      const endpoint = '/api/data';
      const duration = 500;
      const statusCode = 500;
      
      performanceMonitor.recordRequest(endpoint, duration, statusCode);
      
      expect(performanceMonitor.counters.total_requests).toBe(1);
      expect(performanceMonitor.counters.error_requests).toBe(1);
      
      const request = performanceMonitor.metrics.requests[0];
      expect(request.success).toBe(false);
    });
  });

  describe('cache recording', () => {
    it('should record cache operations', () => {
      const operation = 'hit';
      const key = 'user:123';
      const duration = 5;
      
      performanceMonitor.recordCache(operation, key, duration);
      
      expect(performanceMonitor.metrics.cache).toHaveLength(1);
      expect(performanceMonitor.counters[`cache_${operation}`]).toBe(1);
      
      const cacheMetric = performanceMonitor.metrics.cache[0];
      expect(cacheMetric.operation).toBe(operation);
      expect(cacheMetric.key).toBe(key);
      expect(cacheMetric.duration).toBe(duration);
    });
  });

  describe('WebSocket recording', () => {
    it('should record WebSocket events', () => {
      const event = 'connection';
      const data = { clientId: 'client_123' };
      
      performanceMonitor.recordWebSocket(event, data);
      
      expect(performanceMonitor.metrics.websocket).toHaveLength(1);
      expect(performanceMonitor.counters[`websocket_${event}`]).toBe(1);
      
      const wsMetric = performanceMonitor.metrics.websocket[0];
      expect(wsMetric.event).toBe(event);
      expect(wsMetric.clientId).toBe('client_123');
    });
  });

  describe('system metrics collection', () => {
    it('should collect memory and CPU metrics', () => {
      performanceMonitor.collectSystemMetrics();
      
      expect(performanceMonitor.metrics.memory).toHaveLength(1);
      expect(performanceMonitor.metrics.cpu).toHaveLength(1);
      
      const memMetric = performanceMonitor.metrics.memory[0];
      expect(memMetric.rss).toBeDefined();
      expect(memMetric.heapUsed).toBeDefined();
      expect(memMetric.heapTotal).toBeDefined();
      
      const cpuMetric = performanceMonitor.metrics.cpu[0];
      expect(cpuMetric.user).toBeDefined();
      expect(cpuMetric.system).toBeDefined();
    });
  });

  describe('statistics calculation', () => {
    beforeEach(() => {
      // Add some test data
      performanceMonitor.recordRequest('/api/test1', 100, 200);
      performanceMonitor.recordRequest('/api/test2', 200, 404);
      performanceMonitor.recordRequest('/api/test1', 150, 200);
      
      performanceMonitor.recordCache('hit', 'key1', 5);
      performanceMonitor.recordCache('miss', 'key2', 10);
      performanceMonitor.recordCache('hit', 'key3', 3);
      
      performanceMonitor.recordError('test_error', 'Test message');
      
      performanceMonitor.collectSystemMetrics();
    });

    it('should calculate request statistics', () => {
      const stats = performanceMonitor.getStats();
      
      expect(stats.requests.total).toBe(3);
      expect(stats.requests.successful).toBe(2);
      expect(stats.requests.errors).toBe(1);
      expect(stats.requests.averageResponseTime).toBe(150); // (100 + 200 + 150) / 3
    });

    it('should calculate cache hit rate', () => {
      const stats = performanceMonitor.getStats();
      
      expect(stats.cache.operations).toBe(3);
      expect(stats.cache.hitRate).toBe(66.67); // 2 hits out of 3 operations
    });

    it('should include error count', () => {
      const stats = performanceMonitor.getStats();
      
      expect(stats.errors.total).toBe(1);
    });

    it('should include memory statistics', () => {
      const stats = performanceMonitor.getStats();
      
      expect(stats.memory.current).toBeDefined();
      expect(stats.memory.average).toBeDefined();
      expect(stats.memory.peak).toBeDefined();
    });

    it('should filter by timeframe', () => {
      // Add old data (simulate by manually setting old timestamp)
      const oldTimestamp = Date.now() - 10 * 60 * 1000; // 10 minutes ago
      performanceMonitor.metrics.requests.push({
        endpoint: '/api/old',
        duration: 999,
        timestamp: oldTimestamp
      });
      
      // Get stats for last 5 minutes
      const stats = performanceMonitor.getStats(5 * 60 * 1000);
      
      // Should not include the old request
      expect(stats.requests.total).toBe(3);
    });
  });

  describe('Express middleware', () => {
    it('should create Express middleware function', () => {
      const middleware = performanceMonitor.createExpressMiddleware();
      
      expect(typeof middleware).toBe('function');
      expect(middleware.length).toBe(3); // (req, res, next)
    });

    it('should track request performance', (done) => {
      const middleware = performanceMonitor.createExpressMiddleware();
      
      // Mock Express req, res, next
      const req = {
        method: 'GET',
        url: '/api/test',
        route: { path: '/api/test' },
        get: jest.fn().mockReturnValue('test-agent'),
        ip: '127.0.0.1'
      };
      
      const res = {
        on: jest.fn((event, callback) => {
          if (event === 'finish') {
            // Simulate response finishing
            setTimeout(() => {
              res.statusCode = 200;
              callback();
              
              // Check that request was recorded
              expect(performanceMonitor.metrics.requests).toHaveLength(1);
              expect(performanceMonitor.counters.total_requests).toBe(1);
              
              done();
            }, 10);
          }
        }),
        statusCode: 200
      };
      
      const next = jest.fn();
      
      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('cleanup and memory management', () => {
    it('should clean up old metrics', () => {
      // Add metrics with old timestamps
      const oldTimestamp = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago
      performanceMonitor.metrics.requests = [
        { endpoint: '/api/old', timestamp: oldTimestamp },
        { endpoint: '/api/new', timestamp: Date.now() }
      ];
      
      performanceMonitor.cleanupOldMetrics();
      
      expect(performanceMonitor.metrics.requests).toHaveLength(1);
      expect(performanceMonitor.metrics.requests[0].endpoint).toBe('/api/new');
    });
  });
});

// Test utilities
const testUtils = {
  async waitFor(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};

// Make testUtils available for cachedFetch test
global.testUtils = testUtils;