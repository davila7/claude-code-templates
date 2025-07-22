const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');

/**
 * ConversationAnalyzer - Handles conversation data loading, parsing, and analysis
 * Extracted from monolithic analytics.js for better maintainability
 */
class ConversationAnalyzer {
  constructor(claudeDir, dataCache = null) {
    this.claudeDir = claudeDir;
    this.dataCache = dataCache;
    this.data = {
      conversations: [],
      activeProjects: [],
      summary: {},
      orphanProcesses: [],
      realtimeStats: {}
    };
  }

  /**
   * Main data loading orchestrator method
   * @param {Object} stateCalculator - StateCalculator instance
   * @param {Object} processDetector - ProcessDetector instance
   * @returns {Promise<Object>} Complete analyzed data
   */
  async loadInitialData(stateCalculator, processDetector) {
    console.log(chalk.yellow('📊 Analyzing Claude Code data...'));

    try {
      // Load conversation files
      const conversations = await this.loadConversations(stateCalculator);
      this.data.conversations = conversations;

      // Load active projects
      const projects = await this.loadActiveProjects();
      this.data.activeProjects = projects;

      // Detect active Claude processes and enrich data
      const enrichmentResult = await processDetector.enrichWithRunningProcesses(
        this.data.conversations, 
        this.claudeDir, 
        stateCalculator
      );
      this.data.conversations = enrichmentResult.conversations;
      this.data.orphanProcesses = enrichmentResult.orphanProcesses;

      // Calculate summary statistics with caching
      this.data.summary = await this.calculateSummary(conversations, projects);

      // Update realtime stats
      this.updateRealtimeStats();

      console.log(chalk.green('✅ Data analysis complete'));
      console.log(chalk.gray(`Found ${conversations.length} conversations across ${projects.length} projects`));

      return this.data;
    } catch (error) {
      console.error(chalk.red('Error loading Claude data:'), error.message);
      throw error;
    }
  }

  /**
   * Load and parse all conversation files recursively
   * @param {Object} stateCalculator - StateCalculator instance for status determination
   * @returns {Promise<Array>} Array of conversation objects
   */
  async loadConversations(stateCalculator) {
    const conversations = [];

    try {
      // Search for .jsonl files recursively in all subdirectories
      const findJsonlFiles = async (dir) => {
        const files = [];
        const items = await fs.readdir(dir);

        for (const item of items) {
          const itemPath = path.join(dir, item);
          const stats = await fs.stat(itemPath);

          if (stats.isDirectory()) {
            // Recursively search subdirectories
            const subFiles = await findJsonlFiles(itemPath);
            files.push(...subFiles);
          } else if (item.endsWith('.jsonl')) {
            files.push(itemPath);
          }
        }

        return files;
      };

      const jsonlFiles = await findJsonlFiles(this.claudeDir);
      console.log(chalk.blue(`Found ${jsonlFiles.length} conversation files`));

      for (const filePath of jsonlFiles) {
        const stats = await this.getFileStats(filePath);
        const filename = path.basename(filePath);

        try {
          // Extract project name from path
          const projectFromPath = this.extractProjectFromPath(filePath);

          // Use cached parsed conversation if available
          const parsedMessages = await this.getParsedConversation(filePath);

          // Calculate real token usage and extract model info with caching
          const tokenUsage = await this.getCachedTokenUsage(filePath, parsedMessages);
          const modelInfo = await this.getCachedModelInfo(filePath, parsedMessages);

          // Calculate tool usage data with caching
          const toolUsage = await this.getCachedToolUsage(filePath, parsedMessages);

          const conversation = {
            id: filename.replace('.jsonl', ''),
            filename: filename,
            filePath: filePath,
            messageCount: parsedMessages.length,
            fileSize: stats.size,
            lastModified: stats.mtime,
            created: stats.birthtime,
            tokens: tokenUsage.total > 0 ? tokenUsage.total : this.estimateTokens(await this.getFileContent(filePath)),
            tokenUsage: tokenUsage,
            modelInfo: modelInfo,
            toolUsage: toolUsage,
            project: projectFromPath || this.extractProjectFromConversation(parsedMessages),
            status: stateCalculator.determineConversationStatus(parsedMessages, stats.mtime),
            conversationState: stateCalculator.determineConversationState(parsedMessages, stats.mtime),
            statusSquares: await this.getCachedStatusSquares(filePath, parsedMessages),
            // parsedMessages removed to prevent memory leak - available via cache when needed
          };

          conversations.push(conversation);
        } catch (error) {
          console.warn(chalk.yellow(`Warning: Could not parse ${filename}:`, error.message));
        }
      }

      return conversations.sort((a, b) => b.lastModified - a.lastModified);
    } catch (error) {
      console.error(chalk.red('Error loading conversations:'), error.message);
      return [];
    }
  }

  /**
   * Load active Claude projects from directory structure
   * @returns {Promise<Array>} Array of project objects
   */
  async loadActiveProjects() {
    const projects = [];

    try {
      const files = await fs.readdir(this.claudeDir);

      for (const file of files) {
        const filePath = path.join(this.claudeDir, file);
        const stats = await fs.stat(filePath);

        if (stats.isDirectory() && !file.startsWith('.')) {
          const projectPath = filePath;
          const todoFiles = await this.findTodoFiles(projectPath);

          const project = {
            name: file,
            path: projectPath,
            lastActivity: stats.mtime,
            todoFiles: todoFiles.length,
            status: this.determineProjectStatus(stats.mtime),
          };

          projects.push(project);
        }
      }

      return projects.sort((a, b) => b.lastActivity - a.lastActivity);
    } catch (error) {
      console.error(chalk.red('Error loading projects:'), error.message);
      return [];
    }
  }

  /**
   * Get file content with caching support
   * @param {string} filepath - Path to file
   * @returns {Promise<string>} File content
   */
  async getFileContent(filepath) {
    if (this.dataCache) {
      return await this.dataCache.getFileContent(filepath);
    }
    return await fs.readFile(filepath, 'utf8');
  }

  /**
   * Get file stats with caching support
   * @param {string} filepath - Path to file
   * @returns {Promise<Object>} File stats
   */
  async getFileStats(filepath) {
    if (this.dataCache) {
      return await this.dataCache.getFileStats(filepath);
    }
    return await fs.stat(filepath);
  }

  /**
   * Get parsed conversation with caching support
   * @param {string} filepath - Path to conversation file
   * @returns {Promise<Array>} Parsed conversation messages
   */
  async getParsedConversation(filepath) {
    if (this.dataCache) {
      return await this.dataCache.getParsedConversation(filepath);
    }
    
    // Fallback to direct parsing
    const content = await fs.readFile(filepath, 'utf8');
    return content.trim().split('\n')
      .filter(line => line.trim())
      .map(line => {
        try {
          const item = JSON.parse(line);
          if (item.message && item.message.role) {
            return {
              role: item.message.role,
              timestamp: new Date(item.timestamp),
              content: item.message.content,
              model: item.message.model || null,
              usage: item.message.usage || null,
            };
          }
        } catch {}
        return null;
      })
      .filter(Boolean);
  }

  /**
   * Get cached token usage calculation
   * @param {string} filepath - File path
   * @param {Array} parsedMessages - Parsed messages array
   * @returns {Promise<Object>} Token usage statistics
   */
  async getCachedTokenUsage(filepath, parsedMessages) {
    if (this.dataCache) {
      return await this.dataCache.getCachedTokenUsage(filepath, () => {
        return this.calculateRealTokenUsage(parsedMessages);
      });
    }
    return this.calculateRealTokenUsage(parsedMessages);
  }

  /**
   * Get cached model info extraction
   * @param {string} filepath - File path
   * @param {Array} parsedMessages - Parsed messages array
   * @returns {Promise<Object>} Model info data
   */
  async getCachedModelInfo(filepath, parsedMessages) {
    if (this.dataCache) {
      return await this.dataCache.getCachedModelInfo(filepath, () => {
        return this.extractModelInfo(parsedMessages);
      });
    }
    return this.extractModelInfo(parsedMessages);
  }

  /**
   * Get cached status squares generation
   * @param {string} filepath - File path
   * @param {Array} parsedMessages - Parsed messages array
   * @returns {Promise<Array>} Status squares data
   */
  async getCachedStatusSquares(filepath, parsedMessages) {
    if (this.dataCache) {
      return await this.dataCache.getCachedStatusSquares(filepath, () => {
        return this.generateStatusSquares(parsedMessages);
      });
    }
    return this.generateStatusSquares(parsedMessages);
  }

  /**
   * Get cached tool usage analysis
   * @param {string} filepath - File path
   * @param {Array} parsedMessages - Parsed messages array
   * @returns {Promise<Object>} Tool usage data
   */
  async getCachedToolUsage(filepath, parsedMessages) {
    if (this.dataCache) {
      return await this.dataCache.getCachedToolUsage(filepath, () => {
        return this.extractToolUsage(parsedMessages);
      });
    }
    return this.extractToolUsage(parsedMessages);
  }

  /**
   * Calculate real token usage from message usage data
   * @param {Array} parsedMessages - Array of parsed message objects
   * @returns {Object} Token usage statistics
   */
  calculateRealTokenUsage(parsedMessages) {
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCacheCreationTokens = 0;
    let totalCacheReadTokens = 0;
    let messagesWithUsage = 0;

    parsedMessages.forEach(message => {
      if (message.usage) {
        totalInputTokens += message.usage.input_tokens || 0;
        totalOutputTokens += message.usage.output_tokens || 0;
        totalCacheCreationTokens += message.usage.cache_creation_input_tokens || 0;
        totalCacheReadTokens += message.usage.cache_read_input_tokens || 0;
        messagesWithUsage++;
      }
    });

    return {
      total: totalInputTokens + totalOutputTokens,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      cacheCreationTokens: totalCacheCreationTokens,
      cacheReadTokens: totalCacheReadTokens,
      messagesWithUsage: messagesWithUsage,
      totalMessages: parsedMessages.length,
    };
  }

  /**
   * Extract model and service tier information from messages
   * @param {Array} parsedMessages - Array of parsed message objects
   * @returns {Object} Model information
   */
  extractModelInfo(parsedMessages) {
    const models = new Set();
    const serviceTiers = new Set();
    let lastModel = null;
    let lastServiceTier = null;

    parsedMessages.forEach(message => {
      if (message.model) {
        models.add(message.model);
        lastModel = message.model;
      }
      if (message.usage && message.usage.service_tier) {
        serviceTiers.add(message.usage.service_tier);
        lastServiceTier = message.usage.service_tier;
      }
    });

    return {
      models: Array.from(models),
      primaryModel: lastModel || models.values().next().value || 'Unknown',
      serviceTiers: Array.from(serviceTiers),
      currentServiceTier: lastServiceTier || serviceTiers.values().next().value || 'Unknown',
      hasMultipleModels: models.size > 1,
    };
  }

  /**
   * Extract project name from Claude directory file path
   * @param {string} filePath - Full path to conversation file
   * @returns {string|null} Project name or null
   */
  extractProjectFromPath(filePath) {
    // Extract project name from file path like:
    // /Users/user/.claude/projects/-Users-user-Projects-MyProject/conversation.jsonl
    const pathParts = filePath.split('/');
    const projectIndex = pathParts.findIndex(part => part === 'projects');

    if (projectIndex !== -1 && projectIndex + 1 < pathParts.length) {
      const projectDir = pathParts[projectIndex + 1];
      // Clean up the project directory name
      // The directory appears to be encoded with dashes, but we need to be careful
      // about which dashes are path separators vs part of the project name
      
      // First, let's see what we're working with
      console.log('DEBUG: projectDir =', projectDir);
      console.log('DEBUG: full filePath =', filePath);
      
      // Split by dash, but we need to intelligently reconstruct the path
      const parts = projectDir.split('-');
      
      // Find the last occurrence of common parent directory names
      let lastParentIndex = -1;
      const parentDirs = ['projects', 'repos', 'code', 'src', 'dev', 'workspace', 
                         'git', 'github', 'Documents', 'Desktop', 'Downloads'];
      
      for (let i = parts.length - 1; i >= 0; i--) {
        // Check if this part matches any parent directory pattern
        if (parentDirs.includes(parts[i]) || /^\d+$/.test(parts[i]) || 
            /^\d+_\d+$/.test(parts[i].replace('-', '_'))) {
          lastParentIndex = i;
          break;
        }
      }
      
      // If we found a parent directory, everything after it is the project name
      // Otherwise, look for the pattern where we have user directory structure
      if (lastParentIndex === -1) {
        // Look for username position (typically after empty string and 'Users')
        let userIndex = -1;
        if (parts[0] === '') userIndex = 1; // Path started with /
        if (parts[userIndex] && parts[userIndex].toLowerCase() === 'users') userIndex++;
        
        // Skip username and any intermediate directories
        if (userIndex >= 0 && userIndex < parts.length - 1) {
          // Start from after the username
          lastParentIndex = userIndex;
          
          // Skip any numeric or date-like directories (e.g., "10-19")
          for (let i = userIndex + 1; i < parts.length - 1; i++) {
            if (/^\d+$/.test(parts[i]) || /^\d+_\d+$/.test(parts[i].replace('-', '_'))) {
              lastParentIndex = i;
            }
          }
        }
      }
      
      // Get the project name parts and join them
      const projectParts = parts.slice(lastParentIndex + 1);
      const projectName = projectParts.join('-');
      
      console.log('DEBUG: extracted projectName =', projectName);
      
      return projectName || 'Unknown';
    }

    return null;
  }

  /**
   * Attempt to extract project information from conversation content
   * @param {Array} messages - Array of message objects
   * @returns {string} Project name or 'Unknown'
   */
  extractProjectFromConversation(messages) {
    // Try to extract project information from conversation
    for (const message of messages.slice(0, 5)) {
      if (message.content && typeof message.content === 'string') {
        const pathMatch = message.content.match(/\/([^\/\s]+)$/);
        if (pathMatch) {
          return pathMatch[1];
        }
      }
    }
    return 'Unknown';
  }

  /**
   * Extract tool usage statistics from parsed messages
   * @param {Array} parsedMessages - Array of parsed message objects
   * @returns {Object} Tool usage statistics
   */
  extractToolUsage(parsedMessages) {
    const toolStats = {};
    const toolTimeline = [];
    let totalToolCalls = 0;

    parsedMessages.forEach(message => {
      if (message.role === 'assistant' && message.content) {
        const content = message.content;
        const timestamp = message.timestamp;

        // Handle string content with tool indicators
        if (typeof content === 'string') {
          const toolMatches = content.match(/\[Tool:\s*([^\]]+)\]/g);
          if (toolMatches) {
            toolMatches.forEach(match => {
              const toolName = match.replace(/\[Tool:\s*([^\]]+)\]/, '$1').trim();
              toolStats[toolName] = (toolStats[toolName] || 0) + 1;
              totalToolCalls++;
              toolTimeline.push({
                tool: toolName,
                timestamp: timestamp,
                type: 'usage'
              });
            });
          }
        }

        // Handle array content with tool_use blocks
        if (Array.isArray(content)) {
          content.forEach(block => {
            if (block.type === 'tool_use') {
              const toolName = block.name || 'Unknown Tool';
              toolStats[toolName] = (toolStats[toolName] || 0) + 1;
              totalToolCalls++;
              toolTimeline.push({
                tool: toolName,
                timestamp: timestamp,
                type: 'usage',
                parameters: block.input || {}
              });
            }
          });
        }
      }
    });

    return {
      toolStats,
      toolTimeline: toolTimeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)),
      totalToolCalls,
      uniqueTools: Object.keys(toolStats).length
    };
  }

  /**
   * Generate status indicators for conversation messages
   * @param {Array} messages - Array of message objects
   * @returns {Array} Array of status square objects
   */
  generateStatusSquares(messages) {
    if (!messages || messages.length === 0) {
      return [];
    }

    // Sort messages by timestamp and take last 10 for status squares
    const sortedMessages = messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const recentMessages = sortedMessages.slice(-10);

    return recentMessages.map((message, index) => {
      const messageNum = sortedMessages.length - recentMessages.length + index + 1;

      // Determine status based on message content and role
      if (message.role === 'user') {
        return {
          type: 'pending',
          tooltip: `Message #${messageNum}: User input`,
        };
      } else if (message.role === 'assistant') {
        // Check if the message contains tool usage or errors
        const content = message.content || '';

        if (typeof content === 'string') {
          if (content.includes('[Tool:') || content.includes('tool_use')) {
            return {
              type: 'tool',
              tooltip: `Message #${messageNum}: Tool execution`,
            };
          } else if (content.includes('error') || content.includes('Error') || content.includes('failed')) {
            return {
              type: 'error',
              tooltip: `Message #${messageNum}: Error in response`,
            };
          } else {
            return {
              type: 'success',
              tooltip: `Message #${messageNum}: Successful response`,
            };
          }
        } else if (Array.isArray(content)) {
          // Check for tool_use blocks in array content
          const hasToolUse = content.some(block => block.type === 'tool_use');
          const hasError = content.some(block =>
            block.type === 'text' && (block.text?.includes('error') || block.text?.includes('Error'))
          );

          if (hasError) {
            return {
              type: 'error',
              tooltip: `Message #${messageNum}: Error in response`,
            };
          } else if (hasToolUse) {
            return {
              type: 'tool',
              tooltip: `Message #${messageNum}: Tool execution`,
            };
          } else {
            return {
              type: 'success',
              tooltip: `Message #${messageNum}: Successful response`,
            };
          }
        }
      }

      return {
        type: 'pending',
        tooltip: `Message #${messageNum}: Unknown status`,
      };
    });
  }

  /**
   * Calculate summary statistics from conversations and projects data with caching
   * @param {Array} conversations - Array of conversation objects
   * @param {Array} projects - Array of project objects
   * @returns {Promise<Object>} Summary statistics
   */
  async calculateSummary(conversations, projects) {
    if (this.dataCache) {
      const dependencies = conversations.map(conv => conv.filePath);
      return await this.dataCache.getCachedComputation(
        'summary',
        () => this.computeSummary(conversations, projects),
        dependencies
      );
    }
    return this.computeSummary(conversations, projects);
  }

  /**
   * Compute summary statistics (internal method)
   * @param {Array} conversations - Array of conversation objects
   * @param {Array} projects - Array of project objects
   * @returns {Promise<Object>} Summary statistics
   */
  async computeSummary(conversations, projects) {
    const totalTokens = conversations.reduce((sum, conv) => sum + conv.tokens, 0);
    const totalConversations = conversations.length;
    const activeConversations = conversations.filter(c => c.status === 'active').length;
    const activeProjects = projects.filter(p => p.status === 'active').length;

    const avgTokensPerConversation = totalConversations > 0 ? Math.round(totalTokens / totalConversations) : 0;
    const totalFileSize = conversations.reduce((sum, conv) => sum + conv.fileSize, 0);

    // Calculate real Claude sessions (5-hour periods)
    const claudeSessions = await this.calculateClaudeSessions(conversations);

    return {
      totalConversations,
      totalTokens,
      activeConversations,
      activeProjects,
      avgTokensPerConversation,
      totalFileSize: this.formatBytes(totalFileSize),
      lastActivity: conversations.length > 0 ? conversations[0].lastModified : null,
      claudeSessions,
    };
  }

  /**
   * Calculate Claude usage sessions based on 5-hour periods with caching
   * @param {Array} conversations - Array of conversation objects
   * @returns {Promise<Object>} Session statistics
   */
  async calculateClaudeSessions(conversations) {
    if (this.dataCache) {
      const dependencies = conversations.map(conv => conv.filePath);
      return await this.dataCache.getCachedComputation(
        'sessions',
        () => this.computeClaudeSessions(conversations),
        dependencies
      );
    }
    return this.computeClaudeSessions(conversations);
  }

  /**
   * Compute Claude usage sessions (internal method)
   * @param {Array} conversations - Array of conversation objects
   * @returns {Promise<Object>} Session statistics
   */
  async computeClaudeSessions(conversations) {
    // Collect all message timestamps across all conversations
    const allMessages = [];

    for (const conv of conversations) {
      // Use cached file content for better performance
      try {
        const content = await this.getFileContent(conv.filePath);
        const lines = content.trim().split('\n').filter(line => line.trim());

        lines.forEach(line => {
          try {
            const item = JSON.parse(line);
            if (item.timestamp && item.message && item.message.role === 'user') {
              // Only count user messages as session starters
              allMessages.push({
                timestamp: new Date(item.timestamp),
                conversationId: conv.id,
              });
            }
          } catch {}
        });
      } catch {}
    };

    if (allMessages.length === 0) return {
      total: 0,
      currentMonth: 0,
      thisWeek: 0
    };

    // Sort messages by timestamp
    allMessages.sort((a, b) => a.timestamp - b.timestamp);

    // Calculate sessions (5-hour periods)
    const sessions = [];
    let currentSession = null;

    allMessages.forEach(message => {
      if (!currentSession) {
        // Start first session
        currentSession = {
          start: message.timestamp,
          end: new Date(message.timestamp.getTime() + 5 * 60 * 60 * 1000), // +5 hours
          messageCount: 1,
          conversations: new Set([message.conversationId]),
        };
      } else if (message.timestamp <= currentSession.end) {
        // Message is within current session
        currentSession.messageCount++;
        currentSession.conversations.add(message.conversationId);
        // Update session end if this message extends beyond current session
        const potentialEnd = new Date(message.timestamp.getTime() + 5 * 60 * 60 * 1000);
        if (potentialEnd > currentSession.end) {
          currentSession.end = potentialEnd;
        }
      } else {
        // Message is outside current session, start new session
        sessions.push(currentSession);
        currentSession = {
          start: message.timestamp,
          end: new Date(message.timestamp.getTime() + 5 * 60 * 60 * 1000),
          messageCount: 1,
          conversations: new Set([message.conversationId]),
        };
      }
    });

    // Add the last session
    if (currentSession) {
      sessions.push(currentSession);
    }

    // Calculate statistics
    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const currentMonthSessions = sessions.filter(s => s.start >= currentMonth).length;
    const thisWeekSessions = sessions.filter(s => s.start >= thisWeek).length;

    return {
      total: sessions.length,
      currentMonth: currentMonthSessions,
      thisWeek: thisWeekSessions,
      sessions: sessions.map(s => ({
        start: s.start,
        end: s.end,
        messageCount: s.messageCount,
        conversationCount: s.conversations.size,
        duration: Math.round((s.end - s.start) / (1000 * 60 * 60) * 10) / 10, // hours with 1 decimal
      })),
    };
  }

  /**
   * Simple token estimation fallback
   * @param {string} text - Text to estimate tokens for
   * @returns {number} Estimated token count
   */
  estimateTokens(text) {
    // Simple token estimation (roughly 4 characters per token)
    return Math.ceil(text.length / 4);
  }

  /**
   * Find TODO files in project directories
   * @param {string} projectPath - Path to project directory
   * @returns {Promise<Array>} Array of TODO file names
   */
  async findTodoFiles(projectPath) {
    try {
      const files = await fs.readdir(projectPath);
      return files.filter(file => file.includes('todo') || file.includes('TODO'));
    } catch {
      return [];
    }
  }

  /**
   * Determine project activity status based on last modification time
   * @param {Date} lastActivity - Last activity timestamp
   * @returns {string} Status: 'active', 'recent', or 'inactive'
   */
  determineProjectStatus(lastActivity) {
    const now = new Date();
    const timeDiff = now - lastActivity;
    const hoursAgo = timeDiff / (1000 * 60 * 60);

    if (hoursAgo < 1) return 'active';
    if (hoursAgo < 24) return 'recent';
    return 'inactive';
  }

  /**
   * Update real-time statistics cache
   */
  updateRealtimeStats() {
    this.data.realtimeStats = {
      totalConversations: this.data.conversations.length,
      totalTokens: this.data.conversations.reduce((sum, conv) => sum + conv.tokens, 0),
      activeProjects: this.data.activeProjects.filter(p => p.status === 'active').length,
      lastActivity: this.data.summary.lastActivity,
    };
  }

  /**
   * Format byte sizes for display
   * @param {number} bytes - Number of bytes
   * @returns {string} Formatted byte string
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get current conversation data
   * @returns {Array} Current conversations
   */
  getConversations() {
    return this.data.conversations;
  }

  /**
   * Get current project data
   * @returns {Array} Current projects
   */
  getActiveProjects() {
    return this.data.activeProjects;
  }

  /**
   * Get current summary data
   * @returns {Object} Current summary
   */
  getSummary() {
    return this.data.summary;
  }

  /**
   * Get current orphan processes
   * @returns {Array} Current orphan processes
   */
  getOrphanProcesses() {
    return this.data.orphanProcesses;
  }

  /**
   * Get current realtime stats
   * @returns {Object} Current realtime stats
   */
  getRealtimeStats() {
    return this.data.realtimeStats;
  }

  /**
   * Update conversations data (used for external updates)
   * @param {Array} conversations - Updated conversations array
   */
  setConversations(conversations) {
    this.data.conversations = conversations;
    this.updateRealtimeStats();
  }

  /**
   * Update orphan processes data
   * @param {Array} orphanProcesses - Updated orphan processes array
   */
  setOrphanProcesses(orphanProcesses) {
    this.data.orphanProcesses = orphanProcesses;
  }
}

module.exports = ConversationAnalyzer;