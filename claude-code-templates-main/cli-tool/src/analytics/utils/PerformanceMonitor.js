/**
 * PerformanceMonitor - Monitors and tracks system performance
 * Phase 4: Performance monitoring and optimization
 */
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

class PerformanceMonitor {
  constructor(options = {}) {
    this.options = {
      enabled: options.enabled !== false,
      logInterval: options.logInterval || 60000, // 1 minute
      metricsRetention: options.metricsRetention || 3600000, // 1 hour
      memoryThreshold: options.memoryThreshold || 100 * 1024 * 1024, // 100MB
      ...options
    };
    
    this.metrics = {
      memory: [],
      cpu: [],
      requests: [],
      cache: [],
      errors: [],
      websocket: []
    };
    
    this.timers = {};
    this.counters = {};
    this.startTime = Date.now();
    this.logInterval = null;
    
    if (this.options.enabled) {
      this.startMonitoring();
    }
  }

  /**
   * Start performance monitoring
   */
  startMonitoring() {
    console.log(chalk.blue('📊 Starting performance monitoring...'));
    
    // Start periodic logging
    this.logInterval = setInterval(() => {
      this.collectSystemMetrics();
      this.logPerformanceReport();
      this.cleanupOldMetrics();
    }, this.options.logInterval);
    
    // Monitor process events
    this.setupProcessMonitoring();
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring() {
    if (this.logInterval) {
      clearInterval(this.logInterval);
      this.logInterval = null;
    }
    
    console.log(chalk.yellow('📊 Performance monitoring stopped'));
  }

  /**
   * Setup process monitoring
   */
  setupProcessMonitoring() {
    // Monitor memory usage
    process.on('warning', (warning) => {
      this.recordError('process_warning', warning.message, {
        name: warning.name,
        code: warning.code
      });
    });
    
    // Monitor uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.recordError('uncaught_exception', error.message, {
        stack: error.stack
      });
    });
    
    // Monitor unhandled rejections
    process.on('unhandledRejection', (reason, promise) => {
      this.recordError('unhandled_rejection', reason.toString(), {
        promise: promise.toString()
      });
    });
  }

  /**
   * Start timing an operation
   * @param {string} name - Timer name
   */
  startTimer(name) {
    this.timers[name] = {
      start: process.hrtime.bigint(),
      startTime: Date.now()
    };
  }

  /**
   * End timing an operation
   * @param {string} name - Timer name
   * @param {Object} metadata - Additional metadata
   */
  endTimer(name, metadata = {}) {
    if (!this.timers[name]) {
      console.warn(`Timer ${name} was not started`);
      return 0;
    }
    
    const timer = this.timers[name];
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - timer.start) / 1000000; // Convert to milliseconds
    
    this.recordMetric('performance', {
      operation: name,
      duration,
      timestamp: Date.now(),
      ...metadata
    });
    
    delete this.timers[name];
    return duration;
  }

  /**
   * Increment a counter
   * @param {string} name - Counter name
   * @param {number} value - Increment value
   */
  incrementCounter(name, value = 1) {
    this.counters[name] = (this.counters[name] || 0) + value;
  }

  /**
   * Record a metric
   * @param {string} category - Metric category
   * @param {Object} data - Metric data
   */
  recordMetric(category, data) {
    if (!this.options.enabled) return;
    
    if (!this.metrics[category]) {
      this.metrics[category] = [];
    }
    
    this.metrics[category].push({
      ...data,
      timestamp: data.timestamp || Date.now()
    });
    
    // Keep array size manageable
    if (this.metrics[category].length > 1000) {
      this.metrics[category].shift();
    }
  }

  /**
   * Record an error
   * @param {string} type - Error type
   * @param {string} message - Error message
   * @param {Object} metadata - Additional metadata
   */
  recordError(type, message, metadata = {}) {
    this.recordMetric('errors', {
      type,
      message,
      ...metadata
    });
    
    console.error(chalk.red(`❌ Error recorded: ${type} - ${message}`));
  }

  /**
   * Record API request metrics
   * @param {string} endpoint - API endpoint
   * @param {number} duration - Request duration
   * @param {number} statusCode - HTTP status code
   * @param {Object} metadata - Additional metadata
   */
  recordRequest(endpoint, duration, statusCode, metadata = {}) {
    this.recordMetric('requests', {
      endpoint,
      duration,
      statusCode,
      success: statusCode >= 200 && statusCode < 400,
      ...metadata
    });
    
    this.incrementCounter('total_requests');
    if (statusCode >= 400) {
      this.incrementCounter('error_requests');
    }
  }

  /**
   * Record cache metrics
   * @param {string} operation - Cache operation (hit, miss, set, delete)
   * @param {string} key - Cache key
   * @param {number} duration - Operation duration
   */
  recordCache(operation, key, duration = 0) {
    this.recordMetric('cache', {
      operation,
      key,
      duration
    });
    
    this.incrementCounter(`cache_${operation}`);
  }

  /**
   * Record WebSocket metrics
   * @param {string} event - WebSocket event
   * @param {Object} data - Event data
   */
  recordWebSocket(event, data = {}) {
    this.recordMetric('websocket', {
      event,
      ...data
    });
    
    this.incrementCounter(`websocket_${event}`);
  }

  /**
   * Collect system metrics
   */
  collectSystemMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    this.recordMetric('memory', {
      rss: memUsage.rss,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers
    });
    
    this.recordMetric('cpu', {
      user: cpuUsage.user,
      system: cpuUsage.system
    });
    
    // Check memory threshold
    if (memUsage.heapUsed > this.options.memoryThreshold) {
      this.recordError('memory_threshold', 
        `Memory usage exceeded threshold: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`
      );
    }
  }

  /**
   * Get performance statistics
   * @param {number} timeframe - Timeframe in milliseconds
   * @returns {Object} Performance statistics
   */
  getStats(timeframe = 300000) { // Default 5 minutes
    const cutoff = Date.now() - timeframe;
    
    const filterRecent = (metrics) => 
      metrics.filter(metric => metric.timestamp > cutoff);
    
    const recentRequests = filterRecent(this.metrics.requests || []);
    const recentErrors = filterRecent(this.metrics.errors || []);
    const recentMemory = filterRecent(this.metrics.memory || []);
    const recentCache = filterRecent(this.metrics.cache || []);
    
    return {
      uptime: Date.now() - this.startTime,
      requests: {
        total: recentRequests.length,
        successful: recentRequests.filter(r => r.success).length,
        errors: recentRequests.filter(r => !r.success).length,
        averageResponseTime: this.calculateAverage(recentRequests, 'duration'),
        endpointStats: this.groupBy(recentRequests, 'endpoint')
      },
      errors: {
        total: recentErrors.length,
        byType: this.groupBy(recentErrors, 'type')
      },
      memory: {
        current: recentMemory.length > 0 ? recentMemory[recentMemory.length - 1] : null,
        average: this.calculateAverageMemory(recentMemory),
        peak: this.calculatePeakMemory(recentMemory)
      },
      cache: {
        operations: recentCache.length,
        hitRate: this.calculateCacheHitRate(recentCache),
        operationStats: this.groupBy(recentCache, 'operation')
      },
      counters: { ...this.counters },
      activeTimers: Object.keys(this.timers).length
    };
  }

  /**
   * Calculate average value
   * @param {Array} items - Array of items
   * @param {string} field - Field to average
   * @returns {number} Average value
   */
  calculateAverage(items, field) {
    if (items.length === 0) return 0;
    const sum = items.reduce((acc, item) => acc + (item[field] || 0), 0);
    return Math.round(sum / items.length * 100) / 100;
  }

  /**
   * Calculate average memory usage
   * @param {Array} memoryMetrics - Memory metrics
   * @returns {Object} Average memory usage
   */
  calculateAverageMemory(memoryMetrics) {
    if (memoryMetrics.length === 0) return null;
    
    const avgRss = this.calculateAverage(memoryMetrics, 'rss');
    const avgHeapUsed = this.calculateAverage(memoryMetrics, 'heapUsed');
    const avgHeapTotal = this.calculateAverage(memoryMetrics, 'heapTotal');
    
    return { rss: avgRss, heapUsed: avgHeapUsed, heapTotal: avgHeapTotal };
  }

  /**
   * Calculate peak memory usage
   * @param {Array} memoryMetrics - Memory metrics
   * @returns {Object} Peak memory usage
   */
  calculatePeakMemory(memoryMetrics) {
    if (memoryMetrics.length === 0) return null;
    
    const maxRss = Math.max(...memoryMetrics.map(m => m.rss));
    const maxHeapUsed = Math.max(...memoryMetrics.map(m => m.heapUsed));
    
    return { rss: maxRss, heapUsed: maxHeapUsed };
  }

  /**
   * Calculate cache hit rate
   * @param {Array} cacheMetrics - Cache metrics
   * @returns {number} Cache hit rate percentage
   */
  calculateCacheHitRate(cacheMetrics) {
    const hits = cacheMetrics.filter(m => m.operation === 'hit').length;
    const misses = cacheMetrics.filter(m => m.operation === 'miss').length;
    const total = hits + misses;
    
    return total > 0 ? Math.round((hits / total) * 100 * 100) / 100 : 0;
  }

  /**
   * Group items by field
   * @param {Array} items - Items to group
   * @param {string} field - Field to group by
   * @returns {Object} Grouped items
   */
  groupBy(items, field) {
    return items.reduce((acc, item) => {
      const key = item[field] || 'unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }

  /**
   * Clean up old metrics
   */
  cleanupOldMetrics() {
    const cutoff = Date.now() - this.options.metricsRetention;
    
    Object.keys(this.metrics).forEach(category => {
      this.metrics[category] = this.metrics[category].filter(
        metric => metric.timestamp > cutoff
      );
    });
  }

  /**
   * Log performance report
   */
  logPerformanceReport() {
    const stats = this.getStats();
    
    console.log(chalk.cyan('\n📊 Performance Report:'));
    console.log(chalk.gray(`Uptime: ${Math.round(stats.uptime / 1000)}s`));
    
    if (stats.requests.total > 0) {
      console.log(chalk.green(`Requests: ${stats.requests.total} (${stats.requests.successful} success, ${stats.requests.errors} errors)`));
      console.log(chalk.blue(`Avg Response Time: ${stats.requests.averageResponseTime}ms`));
    }
    
    if (stats.memory.current) {
      const memMB = Math.round(stats.memory.current.heapUsed / 1024 / 1024);
      console.log(chalk.yellow(`Memory: ${memMB}MB heap used`));
    }
    
    if (stats.cache.operations > 0) {
      console.log(chalk.magenta(`Cache: ${stats.cache.hitRate}% hit rate (${stats.cache.operations} ops)`));
    }
    
    if (stats.errors.total > 0) {
      console.log(chalk.red(`Errors: ${stats.errors.total} in last 5 minutes`));
    }
  }

  /**
   * Export metrics to file
   * @param {string} filePath - Export file path
   */
  async exportMetrics(filePath) {
    const stats = this.getStats(3600000); // Last hour
    const exportData = {
      timestamp: new Date().toISOString(),
      stats,
      rawMetrics: this.metrics
    };
    
    await fs.writeJson(filePath, exportData, { spaces: 2 });
    console.log(chalk.green(`📊 Metrics exported to ${filePath}`));
  }

  /**
   * Create performance middleware for Express
   * @returns {Function} Express middleware
   */
  createExpressMiddleware() {
    return (req, res, next) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        this.recordRequest(
          `${req.method} ${req.route?.path || req.url}`,
          duration,
          res.statusCode,
          {
            method: req.method,
            userAgent: req.get('User-Agent'),
            ip: req.ip
          }
        );
      });
      
      next();
    };
  }
}

module.exports = PerformanceMonitor;