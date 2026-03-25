const fs = require('fs-extra');
const chalk = require('chalk');

/**
 * DataCache - Multi-level caching system for analytics performance optimization
 * Provides file content, parsed data, and computation result caching with smart invalidation
 */
class DataCache {
  constructor() {
    // Multi-level caching strategy
    this.caches = {
      // File content cache (highest impact)
      fileContent: new Map(), // filepath -> { content, timestamp, stats }
      
      // Parsed data cache
      parsedConversations: new Map(), // filepath -> { messages, timestamp }
      
      // Computed results cache  
      tokenUsage: new Map(), // filepath -> { usage, timestamp }
      modelInfo: new Map(), // filepath -> { info, timestamp }
      statusSquares: new Map(), // filepath -> { squares, timestamp }
      toolUsage: new Map(), // filepath -> { usage, timestamp }
      
      // Expensive computations cache
      sessions: { data: null, timestamp: 0, dependencies: new Set() },
      summary: { data: null, timestamp: 0, dependencies: new Set() },
      
      // Process cache enhancement
      processes: { data: null, timestamp: 0, ttl: 500 },
      
      // Metadata cache
      fileStats: new Map(), // filepath -> { stats, timestamp }
      projectStats: new Map(), // projectPath -> { data, timestamp }
    };
    
    // Cache configuration - balanced for performance vs memory
    this.config = {
      fileContentTTL: 60000, // 1 minute for file content
      parsedDataTTL: 30000, // 30 seconds for parsed data
      computationTTL: 20000, // 20 seconds for expensive computations
      metadataTTL: 10000, // 10 seconds for metadata
      processTTL: 1000, // 1 second for process data
      maxCacheSize: 50, // Increased to reduce evictions
    };
    
    // Dependency tracking for smart invalidation
    this.dependencies = new Map(); // computation -> Set(filepaths)
    
    // Performance metrics
    this.metrics = {
      hits: 0,
      misses: 0,
      invalidations: 0,
      filesInvalidated: 0,
      computationsInvalidated: 0,
      evictions: 0
    };
    
    // Start automatic cleanup interval (more aggressive)
    this.cleanupInterval = setInterval(() => {
      this.evictOldEntries();
      this.enforceSizeLimits();
    }, 15000); // Every 15 seconds (reduced from 30 seconds)
  }

  /**
   * Get file content with caching and modification time checking
   * @param {string} filepath - Path to file
   * @returns {Promise<string>} File content
   */
  async getFileContent(filepath) {
    const cached = this.caches.fileContent.get(filepath);
    
    try {
      const stats = await fs.stat(filepath);
      
      // Check if cached content is still valid
      if (cached && cached.timestamp >= stats.mtime.getTime()) {
        this.metrics.hits++;
        return cached.content;
      }
      
      // Cache miss - read file
      this.metrics.misses++;
      const content = await fs.readFile(filepath, 'utf8');
      
      this.caches.fileContent.set(filepath, {
        content,
        timestamp: stats.mtime.getTime(),
        stats: stats
      });
      
      // Also cache the file stats
      this.caches.fileStats.set(filepath, {
        stats: stats,
        timestamp: Date.now()
      });
      
      return content;
    } catch (error) {
      // File doesn't exist or can't be read
      this.invalidateFile(filepath);
      throw error;
    }
  }

  /**
   * Get parsed conversation with caching
   * @param {string} filepath - Path to conversation file
   * @returns {Promise<Array>} Parsed conversation messages
   */
  async getParsedConversation(filepath) {
    const cached = this.caches.parsedConversations.get(filepath);
    const fileStats = await this.getFileStats(filepath);
    
    // Check if cached parsed data is still valid
    if (cached && cached.timestamp >= fileStats.mtime.getTime()) {
      this.metrics.hits++;
      return cached.messages;
    }
    
    // Cache miss - parse conversation with tool correlation
    this.metrics.misses++;
    const content = await this.getFileContent(filepath);
    const lines = content.trim().split('\n').filter(line => line.trim());
    
    const messages = this.parseAndCorrelateToolMessages(lines);
    
    this.caches.parsedConversations.set(filepath, {
      messages,
      timestamp: fileStats.mtime.getTime()
    });
    
    return messages;
  }

  /**
   * Parse JSONL lines and correlate tool_use with tool_result
   * @param {Array} lines - JSONL lines
   * @returns {Array} Parsed and correlated messages
   */
  parseAndCorrelateToolMessages(lines) {
    const entries = [];
    const toolUseMap = new Map();
    
    // First pass: parse all entries and map tool_use entries
    for (const line of lines) {
      try {
        const item = JSON.parse(line);
        if (item.message && (item.type === 'assistant' || item.type === 'user')) {
          entries.push(item);
          
          // Track tool_use entries by their ID
          if (item.type === 'assistant' && item.message.content) {
            const toolUseBlock = Array.isArray(item.message.content) 
              ? item.message.content.find(c => c.type === 'tool_use')
              : (item.message.content.type === 'tool_use' ? item.message.content : null);
            
            if (toolUseBlock && toolUseBlock.id) {
              toolUseMap.set(toolUseBlock.id, item);
              if (toolUseBlock.id === 'toolu_01D8RMQYDySWAscQCC6pfDWf') {
                // Debug: Specific tool_use mapped for debugging
              }
            }
          }
        }
      } catch (error) {
        // Skip invalid JSONL lines
      }
    }
    
    // Second pass: correlate tool_result with tool_use (first process ALL tool_results)
    for (const item of entries) {
      if (item.type === 'user' && item.message.content) {
        // Check if this is a tool_result entry
        const toolResultBlock = Array.isArray(item.message.content)
          ? item.message.content.find(c => c.type === 'tool_result')
          : (item.message.content.type === 'tool_result' ? item.message.content : null);
        
        if (toolResultBlock && toolResultBlock.tool_use_id) {
          // This is a tool_result - attach it to the corresponding tool_use
          const toolUseEntry = toolUseMap.get(toolResultBlock.tool_use_id);
          if (toolUseEntry) {
            // Enhance tool result with additional metadata
            const enhancedToolResult = {
              ...toolResultBlock,
              // Include additional metadata from toolUseResult if available
              ...(item.toolUseResult && {
                stdout: item.toolUseResult.stdout,
                stderr: item.toolUseResult.stderr,
                interrupted: item.toolUseResult.interrupted,
                isImage: item.toolUseResult.isImage,
                returnCodeInterpretation: item.toolUseResult.returnCodeInterpretation
              })
            };
            
            // Attach tool result to the tool use entry
            if (!toolUseEntry.toolResults) {
              toolUseEntry.toolResults = [];
            }
            toolUseEntry.toolResults.push(enhancedToolResult);
            // console.log: Tool result attached successfully
          }
        }
      }
    }
    
    // Third pass: process messages and filter out standalone tool_result entries
    const processedMessages = [];
    
    for (const item of entries) {
      if (item.type === 'user' && item.message.content) {
        // Check if this is a tool_result entry (skip it as we've already processed it)
        const toolResultBlock = Array.isArray(item.message.content)
          ? item.message.content.find(c => c.type === 'tool_result')
          : (item.message.content.type === 'tool_result' ? item.message.content : null);
        
        if (toolResultBlock && toolResultBlock.tool_use_id) {
          // Skip standalone tool_result entries - they've been attached to their tool_use
          continue;
        }
      }
      
      // Convert to our standard format
      if (item.toolResults) {
        // console.log: Processing item with tool results
      }
      
      // Debug specific item we're looking for
      if (item.message && item.message.content && Array.isArray(item.message.content)) {
        const toolUseBlock = item.message.content.find(c => c.type === 'tool_use' && c.id === 'toolu_01D8RMQYDySWAscQCC6pfDWf');
        if (toolUseBlock) {
          // Debug: Processing tool_use item
        }
      }
      const parsed = {
        id: item.message.id || item.uuid || null,
        role: item.message.role || (item.type === 'assistant' ? 'assistant' : 'user'),
        timestamp: new Date(item.timestamp),
        content: item.message.content,
        model: item.message.model || null,
        usage: item.message.usage || null,
        toolResults: item.toolResults || null, // Include attached tool results (populated during correlation)
        isCompactSummary: item.isCompactSummary || false, // Preserve compact summary flag
        uuid: item.uuid || null, // Include UUID for message identification
        type: item.type || null // Include type field
      };
      
      // Debug log for our specific tool_use
      // Debug: Final message processing completed
      
      processedMessages.push(parsed);
    }
    
    return processedMessages;
  }

  /**
   * Get file stats with caching
   * @param {string} filepath - Path to file
   * @returns {Promise<Object>} File stats
   */
  async getFileStats(filepath) {
    const cached = this.caches.fileStats.get(filepath);
    
    // Check if metadata cache is still valid
    if (cached && (Date.now() - cached.timestamp) < this.config.metadataTTL) {
      this.metrics.hits++;
      return cached.stats;
    }
    
    // Cache miss - get fresh stats
    this.metrics.misses++;
    const stats = await fs.stat(filepath);
    
    this.caches.fileStats.set(filepath, {
      stats: stats,
      timestamp: Date.now()
    });
    
    return stats;
  }

  /**
   * Cache expensive computation results with dependency tracking
   * @param {string} key - Cache key
   * @param {Function} computeFn - Function to compute result
   * @param {Array<string>} dependencies - File dependencies
   * @param {number} ttl - Time to live override
   * @returns {Promise<any>} Computation result
   */
  async getCachedComputation(key, computeFn, dependencies = [], ttl = null) {
    const cached = this.caches[key];
    const effectiveTTL = ttl || this.config.computationTTL;
    
    // Check if any dependencies have changed
    let dependenciesChanged = false;
    if (dependencies.length > 0) {
      for (const dep of dependencies) {
        try {
          const depStats = await this.getFileStats(dep);
          const cachedDep = cached?.dependencies?.has(dep);
          const depTimestamp = cached?.dependencyTimestamps?.get(dep);
          
          if (!cachedDep || !depTimestamp || depStats.mtime.getTime() > depTimestamp) {
            dependenciesChanged = true;
            break;
          }
        } catch {
          // Dependency file doesn't exist anymore
          dependenciesChanged = true;
          break;
        }
      }
    }
    
    // Check cache validity
    const isCacheValid = cached?.data && 
                        !dependenciesChanged && 
                        (Date.now() - cached.timestamp) < effectiveTTL;
    
    if (isCacheValid) {
      this.metrics.hits++;
      return cached.data;
    }
    
    // Cache miss - compute result
    this.metrics.misses++;
    const result = await computeFn();
    
    // Store dependency timestamps
    const dependencyTimestamps = new Map();
    for (const dep of dependencies) {
      try {
        const stats = await this.getFileStats(dep);
        dependencyTimestamps.set(dep, stats.mtime.getTime());
      } catch {}
    }
    
    this.caches[key] = {
      data: result,
      timestamp: Date.now(),
      dependencies: new Set(dependencies),
      dependencyTimestamps: dependencyTimestamps
    };
    
    return result;
  }

  /**
   * Cache token usage calculation
   * @param {string} filepath - File path
   * @param {Function} calculateFn - Token calculation function
   * @returns {Promise<Object>} Token usage data
   */
  async getCachedTokenUsage(filepath, calculateFn) {
    const cached = this.caches.tokenUsage.get(filepath);
    const fileStats = await this.getFileStats(filepath);
    
    if (cached && cached.timestamp >= fileStats.mtime.getTime()) {
      this.metrics.hits++;
      return cached.usage;
    }
    
    this.metrics.misses++;
    const usage = await calculateFn();
    
    this.caches.tokenUsage.set(filepath, {
      usage,
      timestamp: fileStats.mtime.getTime()
    });
    
    return usage;
  }

  /**
   * Cache model info extraction
   * @param {string} filepath - File path
   * @param {Function} extractFn - Model extraction function
   * @returns {Promise<Object>} Model info data
   */
  async getCachedModelInfo(filepath, extractFn) {
    const cached = this.caches.modelInfo.get(filepath);
    const fileStats = await this.getFileStats(filepath);
    
    if (cached && cached.timestamp >= fileStats.mtime.getTime()) {
      this.metrics.hits++;
      return cached.info;
    }
    
    this.metrics.misses++;
    const info = await extractFn();
    
    this.caches.modelInfo.set(filepath, {
      info,
      timestamp: fileStats.mtime.getTime()
    });
    
    return info;
  }

  /**
   * Cache status squares generation
   * @param {string} filepath - File path
   * @param {Function} generateFn - Status squares generation function
   * @returns {Promise<Array>} Status squares data
   */
  async getCachedStatusSquares(filepath, generateFn) {
    const cached = this.caches.statusSquares.get(filepath);
    const fileStats = await this.getFileStats(filepath);
    
    if (cached && cached.timestamp >= fileStats.mtime.getTime()) {
      this.metrics.hits++;
      return cached.squares;
    }
    
    this.metrics.misses++;
    const squares = await generateFn();
    
    this.caches.statusSquares.set(filepath, {
      squares,
      timestamp: fileStats.mtime.getTime()
    });
    
    return squares;
  }

  /**
   * Cache tool usage analysis
   * @param {string} filepath - File path
   * @param {Function} extractFn - Tool usage extraction function
   * @returns {Promise<Object>} Tool usage data
   */
  async getCachedToolUsage(filepath, extractFn) {
    const cached = this.caches.toolUsage.get(filepath);
    const fileStats = await this.getFileStats(filepath);
    
    if (cached && cached.timestamp >= fileStats.mtime.getTime()) {
      this.metrics.hits++;
      return cached.usage;
    }
    
    this.metrics.misses++;
    const usage = await extractFn();
    
    this.caches.toolUsage.set(filepath, {
      usage,
      timestamp: fileStats.mtime.getTime()
    });
    
    return usage;
  }

  /**
   * Smart invalidation based on file changes
   * @param {string} filepath - Path of changed file
   */
  invalidateFile(filepath) {
    this.metrics.filesInvalidated++;
    
    // Remove direct file caches
    this.caches.fileContent.delete(filepath);
    this.caches.parsedConversations.delete(filepath);
    this.caches.tokenUsage.delete(filepath);
    this.caches.modelInfo.delete(filepath);
    this.caches.statusSquares.delete(filepath);
    this.caches.toolUsage.delete(filepath);
    this.caches.fileStats.delete(filepath);
    
    // Invalidate computations that depend on this file
    ['sessions', 'summary'].forEach(key => {
      const cached = this.caches[key];
      if (cached?.dependencies?.has(filepath)) {
        this.caches[key] = { 
          data: null, 
          timestamp: 0, 
          dependencies: new Set(),
          dependencyTimestamps: new Map()
        };
        this.metrics.computationsInvalidated++;
      }
    });
    
    this.metrics.invalidations++;
  }

  /**
   * Invalidate multiple files (for batch operations)
   * @param {Array<string>} filepaths - Array of file paths
   */
  invalidateFiles(filepaths) {
    filepaths.forEach(filepath => this.invalidateFile(filepath));
  }

  /**
   * Invalidate all computations (force recalculation)
   */
  invalidateComputations() {
    ['sessions', 'summary'].forEach(key => {
      this.caches[key] = { 
        data: null, 
        timestamp: 0, 
        dependencies: new Set(),
        dependencyTimestamps: new Map()
      };
    });
    this.metrics.computationsInvalidated += 2;
  }

  /**
   * Clear all caches
   */
  clearAll() {
    Object.values(this.caches).forEach(cache => {
      if (cache instanceof Map) {
        cache.clear();
      } else {
        cache.data = null;
        cache.timestamp = 0;
        cache.dependencies = new Set();
        cache.dependencyTimestamps = new Map();
      }
    });
    
    // Reset metrics
    this.metrics = {
      hits: 0,
      misses: 0,
      invalidations: 0,
      filesInvalidated: 0,
      computationsInvalidated: 0
    };
  }

  /**
   * Evict old entries to manage memory
   */
  evictOldEntries() {
    const now = Date.now();
    let evicted = 0;
    
    // Evict old file content
    for (const [filepath, data] of this.caches.fileContent.entries()) {
      if (now - data.timestamp > this.config.fileContentTTL) {
        this.caches.fileContent.delete(filepath);
        evicted++;
      }
    }
    
    // Evict old parsed data
    for (const [filepath, data] of this.caches.parsedConversations.entries()) {
      if (now - data.timestamp > this.config.parsedDataTTL) {
        this.caches.parsedConversations.delete(filepath);
        evicted++;
      }
    }
    
    // Evict old metadata
    for (const [filepath, data] of this.caches.fileStats.entries()) {
      if (now - data.timestamp > this.config.metadataTTL) {
        this.caches.fileStats.delete(filepath);
        evicted++;
      }
    }
    
    if (evicted > 0) {
      this.metrics.evictions += evicted;
      console.log(chalk.gray(`🗑️  Evicted ${evicted} old cache entries`));
    }
  }

  /**
   * Enforce cache size limits to prevent memory buildup
   */
  enforceSizeLimits() {
    const maxSize = this.config.maxCacheSize;
    let totalEvicted = 0;

    // Enforce size limits on each cache
    const caches = [
      ['fileContent', this.caches.fileContent],
      ['parsedConversations', this.caches.parsedConversations],
      ['tokenUsage', this.caches.tokenUsage],
      ['modelInfo', this.caches.modelInfo],
      ['statusSquares', this.caches.statusSquares],
      ['toolUsage', this.caches.toolUsage],
      ['fileStats', this.caches.fileStats],
      ['projectStats', this.caches.projectStats]
    ];

    for (const [, cache] of caches) {
      if (cache.size > maxSize) {
        // Convert to array and sort by timestamp (oldest first)
        const entries = Array.from(cache.entries()).sort((a, b) => {
          const timestampA = a[1].timestamp || 0;
          const timestampB = b[1].timestamp || 0;
          return timestampA - timestampB;
        });

        // Remove oldest entries until we're under the limit
        const toRemove = cache.size - maxSize;
        for (let i = 0; i < toRemove && i < entries.length; i++) {
          cache.delete(entries[i][0]);
          totalEvicted++;
        }
      }
    }

    if (totalEvicted > 0) {
      this.metrics.evictions += totalEvicted;
      console.log(chalk.gray(`🗑️  Enforced size limits, evicted ${totalEvicted} entries`));
    }
  }

  /**
   * Clean up resources and stop timers
   */
  cleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clearAll();
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache performance metrics
   */
  getStats() {
    const hitRate = this.metrics.hits + this.metrics.misses > 0 
      ? (this.metrics.hits / (this.metrics.hits + this.metrics.misses) * 100).toFixed(2)
      : 0;
    
    return {
      ...this.metrics,
      hitRate: `${hitRate}%`,
      cacheSize: {
        fileContent: this.caches.fileContent.size,
        parsedConversations: this.caches.parsedConversations.size,
        tokenUsage: this.caches.tokenUsage.size,
        modelInfo: this.caches.modelInfo.size,
        statusSquares: this.caches.statusSquares.size,
        toolUsage: this.caches.toolUsage.size,
        fileStats: this.caches.fileStats.size,
        projectStats: this.caches.projectStats.size,
      },
      memoryUsage: process.memoryUsage()
    };
  }

  /**
   * Log cache performance
   */
  logStats() {
    const stats = this.getStats();
    console.log(chalk.cyan('📊 Cache Statistics:'));
    console.log(chalk.gray(`   Hit Rate: ${stats.hitRate}`));
    console.log(chalk.gray(`   Hits: ${stats.hits}, Misses: ${stats.misses}`));
    console.log(chalk.gray(`   Invalidations: ${stats.invalidations}`));
    console.log(chalk.gray(`   Cache Sizes: ${JSON.stringify(stats.cacheSize)}`));
  }

  /**
   * Check if cache is warming up (high miss rate)
   * @returns {boolean} True if cache needs warming
   */
  needsWarming() {
    const total = this.metrics.hits + this.metrics.misses;
    if (total < 10) return true; // Not enough data
    
    const hitRate = this.metrics.hits / total;
    return hitRate < 0.5; // Less than 50% hit rate
  }

  /**
   * Set cache configuration
   * @param {Object} config - New configuration
   */
  configure(config) {
    this.config = { ...this.config, ...config };
  }
}

module.exports = DataCache;