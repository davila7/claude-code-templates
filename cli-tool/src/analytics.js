const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');
const express = require('express');
const open = require('open');
const os = require('os');
const inquirer = require('inquirer');
const boxen = require('boxen');
const { spawn } = require('child_process');
const packageJson = require('../package.json');
const StateCalculator = require('./analytics/core/StateCalculator');
const ProcessDetector = require('./analytics/core/ProcessDetector');
const ConversationAnalyzer = require('./analytics/core/ConversationAnalyzer');
const FileWatcher = require('./analytics/core/FileWatcher');
const SessionAnalyzer = require('./analytics/core/SessionAnalyzer');
const AgentAnalyzer = require('./analytics/core/AgentAnalyzer');
const DataCache = require('./analytics/data/DataCache');
const WebSocketServer = require('./analytics/notifications/WebSocketServer');
const NotificationManager = require('./analytics/notifications/NotificationManager');
const PerformanceMonitor = require('./analytics/utils/PerformanceMonitor');
const ConsoleBridge = require('./console-bridge');
const ClaudeAPIProxy = require('./claude-api-proxy');

class ClaudeAnalytics {
  constructor(options = {}) {
    this.options = options;
    this.verbose = options.verbose || false;
    this.app = express();
    this.port = 3333;
    this.stateCalculator = new StateCalculator();
    this.processDetector = new ProcessDetector();
    this.fileWatcher = new FileWatcher();
    this.sessionAnalyzer = new SessionAnalyzer();
    this.agentAnalyzer = new AgentAnalyzer();
    this.dataCache = new DataCache();
    this.performanceMonitor = new PerformanceMonitor({
      enabled: true,
      logInterval: 60000,
      memoryThreshold: 300 * 1024 * 1024 // 300MB - more realistic for analytics dashboard
    });
    this.webSocketServer = null;
    this.notificationManager = null;
    this.httpServer = null;
    this.consoleBridge = null;
    this.cloudflareProcess = null;
    this.publicUrl = null;
    this.claudeApiProxy = null;
    this.data = {
      conversations: [],
      summary: {},
      activeProjects: [],
      realtimeStats: {
        totalConversations: 0,
        totalTokens: 0,
        activeProjects: 0,
        lastActivity: null,
      },
    };
  }

  /**
   * Log messages only if verbose mode is enabled
   * @param {string} level - Log level ('info', 'warn', 'error')
   * @param {string} message - Message to log
   * @param {...any} args - Additional arguments
   */
  log(level, message, ...args) {
    if (!this.verbose) return;
    
    switch (level) {
      case 'error':
        console.error(message, ...args);
        break;
      case 'warn':
        console.warn(message, ...args);
        break;
      case 'info':
      default:
        console.log(message, ...args);
        break;
    }
  }

  async initialize() {
    const homeDir = os.homedir();
    this.claudeDir = path.join(homeDir, '.claude');
    this.claudeDesktopDir = path.join(homeDir, 'Library', 'Application Support', 'Claude');
    this.claudeStatsigDir = path.join(this.claudeDir, 'statsig');

    // Check if Claude directories exist
    if (!(await fs.pathExists(this.claudeDir))) {
      throw new Error(`Claude Code directory not found at ${this.claudeDir}`);
    }

    // Initialize conversation analyzer with Claude directory and cache
    this.conversationAnalyzer = new ConversationAnalyzer(this.claudeDir, this.dataCache);

    await this.loadInitialData();
    this.setupFileWatchers();
    this.setupWebServer();
  }

  async loadInitialData() {
    try {
      // Store previous data for comparison
      const previousData = this.data;
      
      // Use ConversationAnalyzer to load and analyze all data
      const analyzedData = await this.conversationAnalyzer.loadInitialData(
        this.stateCalculator,
        this.processDetector
      );
      
      // Update our data structure with analyzed data
      this.data = analyzedData;
      
      // Get Claude session information
      const claudeSessionInfo = await this.getClaudeSessionInfo();
      
      // Analyze session data for Max plan usage tracking with real Claude session info
      this.data.sessionData = this.sessionAnalyzer.analyzeSessionData(this.data.conversations, claudeSessionInfo);
      
      // Send real-time notifications if WebSocket is available
      if (this.notificationManager) {
        this.notificationManager.notifyDataRefresh(this.data, 'data_refresh');
        
        // Check for conversation state changes
        this.detectAndNotifyStateChanges(previousData, this.data);
      }

    } catch (error) {
      console.error(chalk.red('Error loading Claude data:'), error.message);
      throw error;
    }
  }


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

  async findTodoFiles(projectPath) {
    try {
      const files = await fs.readdir(projectPath);
      return files.filter(file => file.includes('todo') || file.includes('TODO'));
    } catch {
      return [];
    }
  }

  estimateTokens(text) {
    // Simple token estimation (roughly 4 characters per token)
    return Math.ceil(text.length / 4);
  }

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
      total: totalInputTokens + totalOutputTokens + totalCacheCreationTokens + totalCacheReadTokens,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      cacheCreationTokens: totalCacheCreationTokens,
      cacheReadTokens: totalCacheReadTokens,
      messagesWithUsage: messagesWithUsage,
      totalMessages: parsedMessages.length,
    };
  }

  calculateDetailedTokenUsage() {
    if (!this.data || !this.data.conversations) {
      return null;
    }

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCacheCreationTokens = 0;
    let totalCacheReadTokens = 0;
    let totalMessages = 0;
    let messagesWithUsage = 0;

    this.data.conversations.forEach(conversation => {
      if (conversation.tokenUsage) {
        totalInputTokens += conversation.tokenUsage.inputTokens || 0;
        totalOutputTokens += conversation.tokenUsage.outputTokens || 0;
        totalCacheCreationTokens += conversation.tokenUsage.cacheCreationTokens || 0;
        totalCacheReadTokens += conversation.tokenUsage.cacheReadTokens || 0;
        messagesWithUsage += conversation.tokenUsage.messagesWithUsage || 0;
        totalMessages += conversation.tokenUsage.totalMessages || 0;
      }
    });

    const total = totalInputTokens + totalOutputTokens + totalCacheCreationTokens + totalCacheReadTokens;

    return {
      total,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      cacheCreationTokens: totalCacheCreationTokens,
      cacheReadTokens: totalCacheReadTokens,
      messagesWithUsage,
      totalMessages
    };
  }

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

  async extractProjectFromPath(filePath) {
    // First try to read cwd from the conversation file itself
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.trim().split('\n').filter(line => line.trim());
      
      for (const line of lines.slice(0, 10)) { // Check first 10 lines
        try {
          const item = JSON.parse(line);
          
          // Look for cwd field in the message
          if (item.cwd) {
            return path.basename(item.cwd);
          }
          
          // Also check if it's in nested objects
          if (item.message && item.message.cwd) {
            return path.basename(item.message.cwd);
          }
        } catch (parseError) {
          // Skip invalid JSON lines
          continue;
        }
      }
    } catch (error) {
      console.warn(chalk.yellow(`Warning: Could not extract project from conversation ${filePath}:`, error.message));
    }

    // Fallback: Extract project name from file path like:
    // /Users/user/.claude/projects/-Users-user-Projects-MyProject/conversation.jsonl
    const pathParts = filePath.split('/');
    const projectIndex = pathParts.findIndex(part => part === 'projects');

    if (projectIndex !== -1 && projectIndex + 1 < pathParts.length) {
      const projectDir = pathParts[projectIndex + 1];
      // Clean up the project directory name
      const cleanName = projectDir
        .replace(/^-/, '')
        .replace(/-/g, '/')
        .split('/')
        .pop() || 'Unknown';

      return cleanName;
    }

    return 'Unknown';
  }




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
            block.type === 'text' && (block.text ?.includes('error') || block.text ?.includes('Error'))
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

  determineProjectStatus(lastActivity) {
    const now = new Date();
    const timeDiff = now - lastActivity;
    const hoursAgo = timeDiff / (1000 * 60 * 60);

    if (hoursAgo < 1) return 'active';
    if (hoursAgo < 24) return 'recent';
    return 'inactive';
  }

  calculateSummary(conversations, projects) {
    const totalTokens = conversations.reduce((sum, conv) => sum + conv.tokens, 0);
    const totalConversations = conversations.length;
    const activeConversations = conversations.filter(c => c.status === 'active').length;
    const activeProjects = projects.filter(p => p.status === 'active').length;

    const avgTokensPerConversation = totalConversations > 0 ? Math.round(totalTokens / totalConversations) : 0;
    const totalFileSize = conversations.reduce((sum, conv) => sum + conv.fileSize, 0);

    // Calculate real Claude sessions (5-hour periods)
    const claudeSessions = this.calculateClaudeSessions(conversations);

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

  calculateClaudeSessions(conversations) {
    // Collect all message timestamps across all conversations
    const allMessages = [];

    conversations.forEach(conv => {
      // Parse the conversation file to get message timestamps
      try {
        const fs = require('fs-extra');
        const content = fs.readFileSync(conv.filePath, 'utf8');
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
    });

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

  updateRealtimeStats() {
    this.data.realtimeStats = {
      totalConversations: this.data.conversations.length,
      totalTokens: this.data.conversations.reduce((sum, conv) => sum + conv.tokens, 0),
      activeProjects: this.data.activeProjects.filter(p => p.status === 'active').length,
      lastActivity: this.data.summary.lastActivity,
    };
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Handle conversation file changes and detect new messages
   * @param {string} conversationId - Conversation ID that changed
   * @param {string} filePath - Path to the conversation file
   */
  async handleConversationChange(conversationId, filePath) {
    try {
      
      // Get the latest messages from the file
      const messages = await this.conversationAnalyzer.getParsedConversation(filePath);
      
      if (messages && messages.length > 0) {
        // Get the most recent message
        const latestMessage = messages[messages.length - 1];
        
        
        // Send WebSocket notification for new message
        if (this.notificationManager) {
          this.notificationManager.notifyNewMessage(conversationId, latestMessage, {
            totalMessages: messages.length,
            timestamp: new Date().toISOString()
          });
        }
        
      }
    } catch (error) {
      console.error(chalk.red(`Error handling conversation change for ${conversationId}:`), error);
    }
  }

  setupFileWatchers() {
    // Setup file watchers using the FileWatcher module
    this.fileWatcher.setupFileWatchers(
      this.claudeDir,
      // Data refresh callback
      async () => {
        await this.loadInitialData();
      },
      // Process refresh callback
      async () => {
        const enrichmentResult = await this.processDetector.enrichWithRunningProcesses(
          this.data.conversations, 
          this.claudeDir, 
          this.stateCalculator
        );
        this.data.conversations = enrichmentResult.conversations;
        this.data.orphanProcesses = enrichmentResult.orphanProcesses;
      },
      // DataCache for cache invalidation
      this.dataCache,
      // Conversation change callback for real-time message updates
      async (conversationId, filePath) => {
        await this.handleConversationChange(conversationId, filePath);
      }
    );
  }

  setupWebServer() {
    // Add CORS middleware
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      
      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
      }
      
      next();
    });
    
    // Add performance monitoring middleware
    this.app.use(this.performanceMonitor.createExpressMiddleware());
    
    // Serve static files (we'll create the dashboard HTML)
    this.app.use(express.static(path.join(__dirname, 'analytics-web')));

    // API endpoints
    this.app.get('/api/data', async (req, res) => {
      try {
        // Calculate detailed token usage
        const detailedTokenUsage = this.calculateDetailedTokenUsage();
        
        // Memory cleanup: limit conversation history to prevent memory buildup
        if (this.data.conversations && this.data.conversations.length > 150) {
            this.data.conversations = this.data.conversations
            .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified))
            .slice(0, 150);
        }
        
        // Add timestamp to verify data freshness
        const dataWithTimestamp = {
          ...this.data,
          detailedTokenUsage,
          timestamp: new Date().toISOString(),
          lastUpdate: new Date().toLocaleString(),
        };
        res.json(dataWithTimestamp);
      } catch (error) {
        console.error('Error calculating detailed token usage:', error);
        res.json({
          ...this.data,
          detailedTokenUsage: null,
          timestamp: new Date().toISOString(),
          lastUpdate: new Date().toLocaleString(),
        });
      }
    });

    // Paginated conversations endpoint
    this.app.get('/api/conversations', async (req, res) => {
      try {
        const page = parseInt(req.query.page) || 0;
        const limit = parseInt(req.query.limit) || 10;
        const offset = page * limit;
        
        // Sort conversations by lastModified (most recent first)
        const sortedConversations = [...this.data.conversations]
          .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
        
        const paginatedConversations = sortedConversations.slice(offset, offset + limit);
        const totalCount = this.data.conversations.length;
        const hasMore = offset + limit < totalCount;
        
        res.json({
          conversations: paginatedConversations,
          pagination: {
            page,
            limit,
            offset,
            totalCount,
            hasMore,
            currentCount: paginatedConversations.length
          },
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error getting paginated conversations:', error);
        res.status(500).json({ error: 'Failed to get conversations' });
      }
    });

    // Agent usage analytics endpoint
    this.app.get('/api/agents', async (req, res) => {
      try {
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;
        const dateRange = (startDate || endDate) ? { startDate, endDate } : null;
        
        const agentAnalysis = await this.agentAnalyzer.analyzeAgentUsage(this.data.conversations, dateRange);
        const agentSummary = this.agentAnalyzer.generateSummary(agentAnalysis);
        
        res.json({
          ...agentAnalysis,
          summary: agentSummary,
          dateRange,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error getting agent analytics:', error);
        res.status(500).json({ error: 'Failed to get agent analytics' });
      }
    });

    this.app.get('/api/realtime', async (req, res) => {
      const realtimeWithTimestamp = {
        ...this.data.realtimeStats,
        timestamp: new Date().toISOString(),
        lastUpdate: new Date().toLocaleString(),
      };
      res.json(realtimeWithTimestamp);
    });

    // Force refresh endpoint
    this.app.get('/api/refresh', async (req, res) => {
      await this.loadInitialData();
      res.json({
        success: true,
        message: 'Data refreshed',
        timestamp: new Date().toISOString(),
      });
    });

    // NEW: Ultra-fast endpoint for ALL conversation states
    this.app.get('/api/conversation-state', async (req, res) => {
      try {
        // Detect running processes for accurate state calculation
        const runningProcesses = await this.processDetector.detectRunningClaudeProcesses();
        const activeStates = {};
        
        // Calculate states for ALL conversations, not just those with runningProcess
        for (const conversation of this.data.conversations) {
          try {
            let state;
            
            // First try quick calculation if there's a running process
            if (conversation.runningProcess) {
              state = this.stateCalculator.quickStateCalculation(conversation, runningProcesses);
            }
            
            // If no quick state found, use full state calculation
            if (!state) {
              // For conversations without running processes, use basic heuristics
              const now = new Date();
              const timeDiff = (now - new Date(conversation.lastModified)) / (1000 * 60); // minutes
              
              if (timeDiff < 5) {
                state = 'Recently active';
              } else if (timeDiff < 60) {
                state = 'Idle';
              } else if (timeDiff < 1440) { // 24 hours
                state = 'Inactive';
              } else {
                state = 'Old';
              }
            }
            
            // Store state with conversation ID as key
            activeStates[conversation.id] = state;
            
          } catch (error) {
            activeStates[conversation.id] = 'unknown';
          }
        }
        
        res.json({ activeStates, timestamp: Date.now() });
      } catch (error) {
        console.error('Error getting conversation states:', error);
        res.status(500).json({ error: 'Failed to get conversation states' });
      }
    });

    // Conversation messages endpoint with optional pagination
    this.app.get('/api/conversations/:id/messages', async (req, res) => {
      try {
        const conversationId = req.params.id;
        const page = parseInt(req.query.page);
        const limit = parseInt(req.query.limit);
        
        const conversation = this.data.conversations.find(conv => conv.id === conversationId);
        
        if (!conversation) {
          return res.status(404).json({ error: 'Conversation not found' });
        }
        
        // Read all messages from the JSONL file
        const allMessages = await this.conversationAnalyzer.getParsedConversation(conversation.filePath);
        
        // If pagination parameters are provided, use pagination
        if (!isNaN(page) && !isNaN(limit)) {
          // Sort messages by timestamp (newest first for reverse pagination)
          const sortedMessages = allMessages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          
          // Calculate pagination
          const totalCount = sortedMessages.length;
          const offset = page * limit;
          const hasMore = offset + limit < totalCount;
          
          // Get page of messages (reverse order - newest first)
          const paginatedMessages = sortedMessages.slice(offset, offset + limit);
          
          // For display, we want messages in chronological order (oldest first)
          const messagesInDisplayOrder = [...paginatedMessages].reverse();
          
          res.json({
            conversationId,
            messages: messagesInDisplayOrder,
            pagination: {
              page,
              limit,
              offset,
              totalCount,
              hasMore,
              currentCount: paginatedMessages.length
            },
            timestamp: new Date().toISOString()
          });
        } else {
          // Non-paginated response (backward compatibility)
          res.json({
            conversationId,
            messages: allMessages,
            messageCount: allMessages.length,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error('Error loading conversation messages:', error);
        res.status(500).json({ error: 'Failed to load conversation messages' });
      }
    });

    // Session data endpoint for Max plan usage tracking
    this.app.get('/api/session/data', async (req, res) => {
      try {
        // Get real-time Claude session information
        const claudeSessionInfo = await this.getClaudeSessionInfo();
        
        if (!this.data.sessionData) {
          // Generate session data if not available
          this.data.sessionData = this.sessionAnalyzer.analyzeSessionData(this.data.conversations, claudeSessionInfo);
        }

        const timerData = this.sessionAnalyzer.getSessionTimerData(this.data.sessionData);
        
        res.json({
          ...this.data.sessionData,
          timer: timerData,
          claudeSessionInfo: claudeSessionInfo,
          timestamp: Date.now()
        });
      } catch (error) {
        console.error('Session data error:', error);
        res.status(500).json({ 
          error: 'Failed to get session data',
          timestamp: Date.now()
        });
      }
    });

    // Get specific conversation history
    this.app.get('/api/session/:id', async (req, res) => {
      try {
        const conversationId = req.params.id;
        
        // Find the conversation
        const conversation = this.data.conversations.find(conv => conv.id === conversationId);
        if (!conversation) {
          return res.status(404).json({ error: 'Conversation not found' });
        }

        // Read the conversation file to get full message history
        const conversationFile = conversation.filePath;
        
        if (!conversationFile) {
          return res.status(404).json({ 
            error: 'Conversation file path not found',
            conversationId: conversationId,
            conversationKeys: Object.keys(conversation),
            hasFilePath: !!conversation.filePath,
            hasFileName: !!conversation.filename
          });
        }
        
        if (!await fs.pathExists(conversationFile)) {
          return res.status(404).json({ error: 'Conversation file not found', path: conversationFile });
        }

        const content = await fs.readFile(conversationFile, 'utf8');
        const lines = content.trim().split('\n').filter(line => line.trim());
        const rawMessages = lines.map(line => {
          try {
            return JSON.parse(line);
          } catch (error) {
            console.warn('Error parsing message line:', error);
            return null;
          }
        }).filter(Boolean);

        // Extract actual messages from Claude Code format
        const messages = rawMessages.map(item => {
          if (item.message && item.message.role) {
            let content = '';

            if (typeof item.message.content === 'string') {
              content = item.message.content;
            } else if (Array.isArray(item.message.content)) {
              content = item.message.content
                .map(block => {
                  if (block.type === 'text') return block.text;
                  if (block.type === 'tool_use') return `[Tool: ${block.name}]`;
                  if (block.type === 'tool_result') return '[Tool Result]';
                  return block.content || '';
                })
                .join('\n');
            } else if (item.message.content && typeof item.message.content === 'object' && item.message.content.length) {
              content = item.message.content[0].text || '';
            }

            return {
              role: item.message.role,
              content: content || 'No content',
              timestamp: item.timestamp,
              type: item.type,
              stop_reason: item.message.stop_reason || null,
              message_id: item.message.id || null,
              model: item.message.model || null,
              usage: item.message.usage || null,
              hasToolUse: item.message.content && Array.isArray(item.message.content) && 
                         item.message.content.some(block => block.type === 'tool_use'),
              hasToolResult: item.message.content && Array.isArray(item.message.content) && 
                            item.message.content.some(block => block.type === 'tool_result'),
              contentBlocks: item.message.content && Array.isArray(item.message.content) ? 
                            item.message.content.map(block => ({ type: block.type, name: block.name || null })) : [],
              rawContent: item.message.content || null,
              parentUuid: item.parentUuid || null,
              uuid: item.uuid || null,
              sessionId: item.sessionId || null,
              userType: item.userType || null,
              cwd: item.cwd || null,
              version: item.version || null,
              isCompactSummary: item.isCompactSummary || false,
              isSidechain: item.isSidechain || false
            };
          }
          return null;
        }).filter(Boolean);


        res.json({
          conversation: {
            id: conversation.id,
            project: conversation.project,
            messageCount: conversation.messageCount,
            tokens: conversation.tokens,
            created: conversation.created,
            lastModified: conversation.lastModified,
            status: conversation.status
          },
          messages: messages,
          timestamp: Date.now()
        });

      } catch (error) {
        console.error('Error getting conversation history:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
          error: 'Failed to load conversation history',
          details: error.message,
          stack: error.stack
        });
      }
    });

    // Fast state update endpoint - only updates conversation states without full reload
    this.app.get('/api/fast-update', async (req, res) => {
      try {
        // Update process information and conversation states
        const enrichmentResult = await this.processDetector.enrichWithRunningProcesses(
          this.data.conversations, 
          this.claudeDir, 
          this.stateCalculator
        );
        this.data.conversations = enrichmentResult.conversations;
        this.data.orphanProcesses = enrichmentResult.orphanProcesses;
        
        // For active conversations, re-read the files to get latest messages
        const activeConversations = this.data.conversations.filter(c => c.runningProcess);
        
        for (const conv of activeConversations) {
          try {
            const conversationFile = path.join(this.claudeDir, conv.fileName);
            const content = await fs.readFile(conversationFile, 'utf8');
            const parsedMessages = content.split('\n')
              .filter(line => line.trim())
              .map(line => JSON.parse(line));
            
            const stats = await fs.stat(conversationFile);
            conv.conversationState = this.stateCalculator.determineConversationState(
              parsedMessages, 
              stats.mtime, 
              conv.runningProcess
            );
            
          } catch (error) {
            // If we can't read the file, keep the existing state
          }
        }
        
        // Only log when there are actually active conversations (reduce noise)
        const activeConvs = this.data.conversations.filter(c => c.runningProcess);
        if (activeConvs.length > 0) {
          // Only log every 10th update to reduce spam, or when states change
          if (!this.lastLoggedStates) this.lastLoggedStates = new Map();
          
          let hasChanges = false;
          activeConvs.forEach(conv => {
            const lastState = this.lastLoggedStates.get(conv.id);
            if (lastState !== conv.conversationState) {
              hasChanges = true;
              this.lastLoggedStates.set(conv.id, conv.conversationState);
            }
          });
          
        }
        
        // Memory cleanup: limit conversation history to prevent memory buildup
        if (this.data.conversations.length > 100) {
          this.data.conversations = this.data.conversations
            .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified))
            .slice(0, 100);
        }
        
        // Force garbage collection hint
        if (global.gc) {
          global.gc();
        }
        
        const dataWithTimestamp = {
          conversations: this.data.conversations,
          summary: this.data.summary,
          timestamp: new Date().toISOString(),
          lastUpdate: new Date().toLocaleString(),
        };
        res.json(dataWithTimestamp);
      } catch (error) {
        console.error('Fast update error:', error);
        res.status(500).json({ error: 'Failed to update states' });
      }
    });

    // Remove duplicate endpoint - this conflicts with the correct one above

    // System health endpoint
    this.app.get('/api/system/health', (req, res) => {
      try {
        const stats = this.performanceMonitor.getStats();
        const systemHealth = {
          status: 'healthy',
          uptime: stats.uptime,
          memory: stats.memory,
          requests: stats.requests,
          cache: {
            ...stats.cache,
            dataCache: this.dataCache.getStats()
          },
          errors: stats.errors,
          counters: stats.counters,
          timestamp: Date.now()
        };

        // Determine overall health status
        if (stats.errors.total > 10) {
          systemHealth.status = 'degraded';
        }
        if (stats.memory.current && stats.memory.current.heapUsed > this.performanceMonitor.options.memoryThreshold) {
          systemHealth.status = 'warning';
        }

        res.json(systemHealth);
      } catch (error) {
        res.status(500).json({
          status: 'error',
          message: 'Failed to get system health',
          timestamp: Date.now()
        });
      }
    });

    // Version endpoint
    this.app.get('/api/version', (req, res) => {
      res.json({
        version: packageJson.version,
        name: packageJson.name,
        description: packageJson.description,
        timestamp: Date.now()
      });
    });

    // Claude session information endpoint
    this.app.get('/api/claude/session', async (req, res) => {
      try {
        const sessionInfo = await this.getClaudeSessionInfo();
        res.json({
          ...sessionInfo,
          timestamp: Date.now()
        });
      } catch (error) {
        console.error('Error getting Claude session info:', error);
        res.status(500).json({ 
          error: 'Failed to get Claude session info',
          timestamp: Date.now()
        });
      }
    });

    // Performance metrics endpoint
    this.app.get('/api/system/metrics', (req, res) => {
      try {
        const timeframe = parseInt(req.query.timeframe) || 300000; // 5 minutes default
        const stats = this.performanceMonitor.getStats(timeframe);
        res.json({
          ...stats,
          dataCache: this.dataCache.getStats(),
          timestamp: Date.now()
        });
      } catch (error) {
        res.status(500).json({
          error: 'Failed to get performance metrics',
          timestamp: Date.now()
        });
      }
    });

    // Cache management endpoint
    this.app.post('/api/cache/clear', (req, res) => {
      try {
        // Clear specific cache types or all
        const { type } = req.body;
        
        if (!type || type === 'all') {
          // Clear all caches
          this.dataCache.invalidateComputations();
          this.dataCache.caches.parsedConversations.clear();
          this.dataCache.caches.fileContent.clear();
          this.dataCache.caches.fileStats.clear();
          res.json({ success: true, message: 'All caches cleared' });
        } else if (type === 'conversations') {
          // Clear only conversation-related caches
          this.dataCache.caches.parsedConversations.clear();
          this.dataCache.caches.fileContent.clear();
          res.json({ success: true, message: 'Conversation caches cleared' });
        } else {
          res.status(400).json({ error: 'Invalid cache type. Use "all" or "conversations"' });
        }
      } catch (error) {
        console.error('Error clearing cache:', error);
        res.status(500).json({ error: 'Failed to clear cache' });
      }
    });

    // Agents API endpoint
    this.app.get('/api/agents', async (req, res) => {
      try {
        const agents = await this.loadAgents();
        res.json({ agents });
      } catch (error) {
        console.error('Error loading agents:', error);
        res.status(500).json({ error: 'Failed to load agents data' });
      }
    });

    // Main dashboard route
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'analytics-web', 'index.html'));
    });
  }

  async startServer() {
    return new Promise(async (resolve) => {
      this.httpServer = this.app.listen(this.port, async () => {
        console.log(chalk.green(`🚀 Analytics dashboard started at http://localhost:${this.port}`));
        
        // Initialize WebSocket server
        await this.initializeWebSocket();
        
        resolve();
      });
      // Keep reference for compatibility
      this.server = this.httpServer;
    });
  }

  async openBrowser(openTo = null) {
    const baseUrl = this.publicUrl || `http://localhost:${this.port}`;
    let fullUrl = baseUrl;
    
    // Add fragment/hash for specific page
    if (openTo === 'agents') {
      fullUrl = `${baseUrl}/#agents`;
      console.log(chalk.blue('🌐 Opening browser to Claude Code Chats...'));
    } else {
      console.log(chalk.blue('🌐 Opening browser to Claude Code Analytics...'));
    }
    
    try {
      await open(fullUrl);
    } catch (error) {
      console.log(chalk.yellow('Could not open browser automatically. Please visit:'));
      console.log(chalk.cyan(fullUrl));
    }
  }

  /**
   * Prompt user if they want to use Cloudflare Tunnel
   */
  async promptCloudflareSetup() {
    console.log('');
    console.log(chalk.yellow('🌐 Analytics Dashboard Access Options'));
    console.log('');
    console.log(chalk.cyan('🔒 About Cloudflare Tunnel:'));
    console.log(chalk.gray('• Creates a secure connection between your localhost and the web'));
    console.log(chalk.gray('• Only you will have access to the generated URL (not public)'));
    console.log(chalk.gray('• The connection is end-to-end encrypted'));
    console.log(chalk.gray('• Automatically closes when you end the session'));
    console.log(chalk.gray('• No firewall or port configuration required'));
    console.log('');
    console.log(chalk.green('✅ It is completely secure - only you can access the dashboard'));
    console.log('');
    
    const { useCloudflare } = await inquirer.prompt([{
      type: 'confirm',
      name: 'useCloudflare',
      message: 'Enable Cloudflare Tunnel for secure remote access?',
      default: true
    }]);

    return useCloudflare;
  }

  /**
   * Start Cloudflare Tunnel
   */
  async startCloudflareTunnel() {
    try {
      console.log(chalk.blue('🔧 Starting Cloudflare Tunnel...'));
      
      // Check if cloudflared is installed
      const checkProcess = spawn('cloudflared', ['version'], { stdio: 'pipe' });
      
      return new Promise((resolve, reject) => {
        checkProcess.on('error', (error) => {
          console.log(chalk.red('❌ Cloudflared is not installed.'));
          console.log('');
          console.log(chalk.yellow('📥 To install Cloudflare Tunnel:'));
          console.log(chalk.gray('• macOS: brew install cloudflared'));
          console.log(chalk.gray('• Windows: winget install --id Cloudflare.cloudflared'));
          console.log(chalk.gray('• Linux: apt-get install cloudflared'));
          console.log('');
          console.log(chalk.blue('💡 More info: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/'));
          resolve(false);
        });

        checkProcess.on('close', (code) => {
          if (code === 0) {
            this.createCloudflareTunnel();
            resolve(true);
          } else {
            resolve(false);
          }
        });
      });
    } catch (error) {
      console.log(chalk.red(`❌ Error checking Cloudflare Tunnel: ${error.message}`));
      return false;
    }
  }

  /**
   * Create the actual Cloudflare Tunnel
   */
  async createCloudflareTunnel() {
    try {
      console.log(chalk.blue('🚀 Creating secure tunnel...'));
      
      // Start cloudflared tunnel normally, but filter the output to capture URL
      this.cloudflareProcess = spawn('cloudflared', [
        'tunnel',
        '--url', `http://localhost:${this.port}`
      ], { 
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let tunnelEstablished = false;

      return new Promise((resolve) => {
        // Monitor stderr for the tunnel URL (cloudflared outputs most info to stderr)
        this.cloudflareProcess.stderr.on('data', (data) => {
          const output = data.toString();
          
          // Use the cleaner regex to extract URL from the logs
          const urlMatch = output.match(/https:\/\/[a-zA-Z0-9.-]+\.trycloudflare\.com/);
          
          if (urlMatch && !tunnelEstablished) {
            tunnelEstablished = true;
            this.publicUrl = urlMatch[0];
            
            // Create a prominent, boxed display for the tunnel URL
            const tunnelMessage = chalk.green.bold('🌍 CLOUDFLARE TUNNEL ACTIVE') + '\n\n' +
              chalk.cyan.bold('Public URL: ') + chalk.white.underline(this.publicUrl) + '\n\n' +
              chalk.yellow('🔗 Share this URL to access your dashboard remotely') + '\n' +
              chalk.gray('🔒 This tunnel is private and secure - only accessible by you');
            
            console.log('\n');
            console.log(boxen(tunnelMessage, {
              padding: 1,
              margin: 1,
              borderStyle: 'double',
              borderColor: 'cyan',
              backgroundColor: '#1a1a1a'
            }));
            console.log('\n');
            resolve(true);
          }
        });

        // Also check stdout just in case
        this.cloudflareProcess.stdout.on('data', (data) => {
          const output = data.toString();
          const urlMatch = output.match(/https:\/\/[a-zA-Z0-9.-]+\.trycloudflare\.com/);
          
          if (urlMatch && !tunnelEstablished) {
            tunnelEstablished = true;
            this.publicUrl = urlMatch[0];
            
            // Create a prominent, boxed display for the tunnel URL
            const tunnelMessage = chalk.green.bold('🌍 CLOUDFLARE TUNNEL ACTIVE') + '\n\n' +
              chalk.cyan.bold('Public URL: ') + chalk.white.underline(this.publicUrl) + '\n\n' +
              chalk.yellow('🔗 Share this URL to access your dashboard remotely') + '\n' +
              chalk.gray('🔒 This tunnel is private and secure - only accessible by you');
            
            console.log('\n');
            console.log(boxen(tunnelMessage, {
              padding: 1,
              margin: 1,
              borderStyle: 'double',
              borderColor: 'cyan',
              backgroundColor: '#1a1a1a'
            }));
            console.log('\n');
            resolve(true);
          }
        });

        this.cloudflareProcess.on('close', (code) => {
          if (code !== 0) {
            console.log(chalk.red(`❌ Cloudflare Tunnel terminated with code: ${code}`));
          }
          this.publicUrl = null;
          this.cloudflareProcess = null;
          if (!tunnelEstablished) {
            resolve(false);
          }
        });

        this.cloudflareProcess.on('error', (error) => {
          console.log(chalk.red(`❌ Error with Cloudflare Tunnel: ${error.message}`));
          this.publicUrl = null;
          this.cloudflareProcess = null;
          resolve(false);
        });

        // Timeout after 15 seconds if tunnel doesn't establish
        setTimeout(() => {
          if (!tunnelEstablished) {
            console.log(chalk.red('❌ Timeout waiting for Cloudflare Tunnel to establish'));
            resolve(false);
          }
        }, 15000);
      });
    } catch (error) {
      console.log(chalk.red(`❌ Error creating Cloudflare Tunnel: ${error.message}`));
      return false;
    }
  }

  /**
   * Stop Cloudflare Tunnel
   */
  stopCloudflareTunnel() {
    if (this.cloudflareProcess) {
      console.log(chalk.yellow('🛑 Closing Cloudflare Tunnel...'));
      this.cloudflareProcess.kill('SIGTERM');
      this.cloudflareProcess = null;
      this.publicUrl = null;
    }
  }

  /**
   * Initialize WebSocket server and notification manager
   */
  async initializeWebSocket() {
    try {
      // Initialize WebSocket server with performance monitoring
      this.webSocketServer = new WebSocketServer(this.httpServer, {
        path: '/ws',
        heartbeatInterval: 30000
      }, this.performanceMonitor);
      await this.webSocketServer.initialize();
      
      // Initialize notification manager
      this.notificationManager = new NotificationManager(this.webSocketServer);
      await this.notificationManager.initialize();
      
      // Connect notification manager to file watcher for typing detection
      this.fileWatcher.setNotificationManager(this.notificationManager);
      
      // Initialize Claude API Proxy for bidirectional communication
      console.log(chalk.blue('🌉 Initializing Claude API Proxy...'));
      this.claudeApiProxy = new ClaudeAPIProxy();
      await this.claudeApiProxy.start();
      console.log(chalk.green('✅ Claude API Proxy initialized on port 3335'));
      
      // Setup notification subscriptions
      this.setupNotificationSubscriptions();
      
      // Initialize Console Bridge for Claude Code interaction
      await this.initializeConsoleBridge();
      
      console.log(chalk.green('✅ WebSocket, notifications, and console bridge initialized'));
    } catch (error) {
      console.error(chalk.red('❌ Failed to initialize WebSocket:'), error);
    }
  }

  /**
   * Initialize Console Bridge for Claude Code interaction
   */
  async initializeConsoleBridge() {
    try {
      console.log(chalk.blue('🌉 Initializing Console Bridge...'));
      
      // Create console bridge on a different port (3334)
      this.consoleBridge = new ConsoleBridge({
        port: 3334,
        debug: false // Set to true for detailed debugging
      });
      
      // Initialize the bridge
      const success = await this.consoleBridge.initialize();
      
      if (success) {
        console.log(chalk.green('✅ Console Bridge initialized on port 3334'));
        console.log(chalk.cyan('🔌 Web interface can connect to ws://localhost:3334 for console interactions'));
        
        // Bridge console interactions to main WebSocket
        this.setupConsoleBridgeIntegration();
      } else {
        console.warn(chalk.yellow('⚠️ Console Bridge failed to initialize - console interactions disabled'));
      }
      
    } catch (error) {
      console.warn(chalk.yellow('⚠️ Console Bridge initialization failed:'), error.message);
      console.log(chalk.gray('Console interactions will not be available, but analytics will continue normally'));
    }
  }

  /**
   * Setup integration between Console Bridge and main WebSocket
   */
  setupConsoleBridgeIntegration() {
    if (!this.consoleBridge || !this.webSocketServer) return;
    
    // Forward console interactions from bridge to main WebSocket
    this.consoleBridge.on('console_interaction', (interactionData) => {
      console.log(chalk.blue('📡 Forwarding console interaction to web interface'));
      
      // Broadcast to main WebSocket clients
      this.webSocketServer.broadcast({
        type: 'console_interaction',
        data: interactionData
      });
    });
    
    // Listen for responses from main WebSocket and forward to bridge
    this.webSocketServer.on('console_response', (responseData) => {
      console.log(chalk.blue('📱 Forwarding console response to Claude Code'));
      
      if (this.consoleBridge) {
        this.consoleBridge.handleWebMessage({
          type: 'console_response',
          data: responseData
        });
      }
    });
    
    console.log(chalk.green('🔗 Console Bridge integration established'));
  }
  
  /**
   * Setup notification subscriptions
   */
  setupNotificationSubscriptions() {
    // Subscribe to refresh requests from WebSocket clients
    this.notificationManager.subscribe('refresh_requested', async (notification) => {
      await this.loadInitialData();
      
      // Notify clients of the refreshed data
      this.notificationManager.notifyDataRefresh(this.data, 'websocket_request');
    });
  }

  /**
   * Detect and notify conversation state changes
   * @param {Object} previousData - Previous data state
   * @param {Object} currentData - Current data state
   */
  detectAndNotifyStateChanges(previousData, currentData) {
    if (!previousData || !previousData.conversations || !currentData || !currentData.conversations) {
      return;
    }
    
    // Create maps for easier lookup
    const previousConversations = new Map();
    previousData.conversations.forEach(conv => {
      previousConversations.set(conv.id, conv);
    });
    
    // Check for state changes
    currentData.conversations.forEach(currentConv => {
      const previousConv = previousConversations.get(currentConv.id);
      
      if (previousConv && previousConv.status !== currentConv.status) {
        // State changed - notify clients
        this.notificationManager.notifyConversationStateChange(
          currentConv.id,
          previousConv.status,
          currentConv.status,
          {
            project: currentConv.project,
            tokens: currentConv.tokens,
            lastModified: currentConv.lastModified
          }
        );
      }
    });
  }

  /**
   * Load available agents from .claude/agents directories (project and user level)
   * @returns {Promise<Array>} Array of agent objects
   */
  async loadAgents() {
    const agents = [];
    const homeDir = os.homedir();
    
    // Define agent paths (user level and project level)
    const userAgentsDir = path.join(homeDir, '.claude', 'agents');
    const projectAgentsDirs = [];
    
    try {
      // 1. Check current working directory for .claude/agents
      const currentProjectAgentsDir = path.join(process.cwd(), '.claude', 'agents');
      if (await fs.pathExists(currentProjectAgentsDir)) {
        const currentProjectName = path.basename(process.cwd());
        projectAgentsDirs.push({
          path: currentProjectAgentsDir,
          projectName: currentProjectName
        });
      }
      
      // 2. Check parent directories for .claude/agents (for monorepo/nested projects)
      let currentDir = process.cwd();
      let parentDir = path.dirname(currentDir);
      
      // Search up to 3 levels up for .claude/agents
      for (let i = 0; i < 3 && parentDir !== currentDir; i++) {
        const parentProjectAgentsDir = path.join(parentDir, '.claude', 'agents');
        
        if (await fs.pathExists(parentProjectAgentsDir)) {
          const parentProjectName = path.basename(parentDir);
          
          // Avoid duplicates
          const exists = projectAgentsDirs.some(p => p.path === parentProjectAgentsDir);
          if (!exists) {
            projectAgentsDirs.push({
              path: parentProjectAgentsDir,
              projectName: parentProjectName
            });
          }
          break; // Found one, no need to go further up
        }
        currentDir = parentDir;
        parentDir = path.dirname(currentDir);
      }
      
      // 3. Find all project directories that might have agents (in ~/.claude/projects)
      const projectsDir = path.join(this.claudeDir, 'projects');
      if (await fs.pathExists(projectsDir)) {
        const projectDirs = await fs.readdir(projectsDir);
        for (const projectDir of projectDirs) {
          const projectAgentsDir = path.join(projectsDir, projectDir, '.claude', 'agents');
          if (await fs.pathExists(projectAgentsDir)) {
            projectAgentsDirs.push({
              path: projectAgentsDir,
              projectName: this.cleanProjectName(projectDir)
            });
          }
        }
      }
      
      // Load user-level agents
      if (await fs.pathExists(userAgentsDir)) {
        const userAgents = await this.loadAgentsFromDirectory(userAgentsDir, 'user');
        agents.push(...userAgents);
      }
      
      // Load project-level agents
      for (const projectInfo of projectAgentsDirs) {
        const projectAgents = await this.loadAgentsFromDirectory(
          projectInfo.path, 
          'project', 
          projectInfo.projectName
        );
        agents.push(...projectAgents);
      }
      
      // Log agents summary
      console.log(chalk.blue('🤖 Agents loaded:'), agents.length);
      if (agents.length > 0) {
        const projectAgents = agents.filter(a => a.level === 'project').length;
        const userAgents = agents.filter(a => a.level === 'user').length;
        console.log(chalk.gray(`  📦 Project agents: ${projectAgents}, 👤 User agents: ${userAgents}`));
      }
      
      // Sort agents by name and prioritize project agents over user agents
      return agents.sort((a, b) => {
        if (a.level !== b.level) {
          return a.level === 'project' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
      
    } catch (error) {
      console.error(chalk.red('Error loading agents:'), error);
      return [];
    }
  }

  /**
   * Load agents from a specific directory
   * @param {string} agentsDir - Directory containing agent files
   * @param {string} level - 'user' or 'project'
   * @param {string} projectName - Name of project (if project level)
   * @returns {Promise<Array>} Array of agent objects
   */
  async loadAgentsFromDirectory(agentsDir, level, projectName = null) {
    const agents = [];
    
    try {
      const files = await fs.readdir(agentsDir);
      
      for (const file of files) {
        if (file.endsWith('.md')) {
          const filePath = path.join(agentsDir, file);
          const agentData = await this.parseAgentFile(filePath, level, projectName);
          if (agentData) {
            agents.push(agentData);
          }
        }
      }
    } catch (error) {
      console.warn(chalk.yellow(`Warning: Could not read agents directory ${agentsDir}:`, error.message));
    }
    
    return agents;
  }

  /**
   * Parse agent markdown file
   * @param {string} filePath - Path to agent file
   * @param {string} level - 'user' or 'project'
   * @param {string} projectName - Name of project (if project level)
   * @returns {Promise<Object|null>} Agent object or null if parsing failed
   */
  async parseAgentFile(filePath, level, projectName = null) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const stats = await fs.stat(filePath);
      
      // Parse YAML frontmatter
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (!frontmatterMatch) {
        console.warn(chalk.yellow(`Agent file ${path.basename(filePath)} missing frontmatter`));
        return null;
      }
      
      const frontmatter = {};
      const yamlContent = frontmatterMatch[1];
      
      // Simple YAML parser for the fields we need
      const yamlLines = yamlContent.split('\n');
      for (const line of yamlLines) {
        const match = line.match(/^(\w+):\s*(.*)$/);
        if (match) {
          const [, key, value] = match;
          frontmatter[key] = value.trim();
        }
      }
      
      // Log parsed frontmatter for debugging
      console.log(chalk.blue(`📋 Parsed agent frontmatter for ${path.basename(filePath)}:`), frontmatter);
      
      if (!frontmatter.name || !frontmatter.description) {
        console.warn(chalk.yellow(`Agent file ${path.basename(filePath)} missing required fields`));
        return null;
      }
      
      // Extract system prompt (content after frontmatter)
      const systemPrompt = content.substring(frontmatterMatch[0].length).trim();
      
      // Parse tools if specified
      let tools = [];
      if (frontmatter.tools) {
        tools = frontmatter.tools.split(',').map(tool => tool.trim()).filter(Boolean);
      }
      
      // Use color from frontmatter if available, otherwise generate one
      const color = frontmatter.color ? this.convertColorToHex(frontmatter.color) : this.generateAgentColor(frontmatter.name);
      
      return {
        name: frontmatter.name,
        description: frontmatter.description,
        systemPrompt,
        tools,
        level,
        projectName,
        filePath,
        lastModified: stats.mtime,
        color,
        isActive: true // All loaded agents are considered active
      };
      
    } catch (error) {
      console.warn(chalk.yellow(`Warning: Could not parse agent file ${filePath}:`, error.message));
      return null;
    }
  }

  /**
   * Generate consistent color for agent based on name
   * @param {string} agentName - Name of the agent
   * @returns {string} Hex color code
   */
  generateAgentColor(agentName) {
    // Simple hash function to generate consistent colors
    let hash = 0;
    for (let i = 0; i < agentName.length; i++) {
      const char = agentName.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Generate RGB values with good contrast and visibility
    const hue = Math.abs(hash) % 360;
    const saturation = 70 + (Math.abs(hash) % 30); // 70-100%
    const lightness = 45 + (Math.abs(hash) % 20);  // 45-65%
    
    // Convert HSL to RGB
    const hslToRgb = (h, s, l) => {
      h /= 360;
      s /= 100;
      l /= 100;
      
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      
      let r, g, b;
      if (s === 0) {
        r = g = b = l;
      } else {
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
      }
      
      return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
    };
    
    const [r, g, b] = hslToRgb(hue, saturation, lightness);
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }

  /**
   * Convert color names to hex values
   * @param {string} color - Color name or hex value
   * @returns {string} Hex color code
   */
  convertColorToHex(color) {
    if (!color) return '#007acc';
    
    // If already hex, return as-is
    if (color.startsWith('#')) return color;
    
    // Convert common color names to hex
    const colorMap = {
      'red': '#ff4444',
      'blue': '#4444ff', 
      'green': '#44ff44',
      'yellow': '#ffff44',
      'orange': '#ff8844',
      'purple': '#8844ff',
      'pink': '#ff44ff',
      'cyan': '#44ffff',
      'brown': '#8b4513',
      'gray': '#888888',
      'grey': '#888888',
      'black': '#333333',
      'white': '#ffffff',
      'teal': '#008080',
      'navy': '#000080',
      'lime': '#00ff00',
      'maroon': '#800000',
      'olive': '#808000',
      'silver': '#c0c0c0'
    };
    
    return colorMap[color.toLowerCase()] || '#007acc';
  }

  /**
   * Clean project name for display
   * @param {string} projectDir - Raw project directory name
   * @returns {string} Cleaned project name
   */
  cleanProjectName(projectDir) {
    // Convert encoded project paths like "-Users-user-Projects-MyProject" to "MyProject"
    const parts = projectDir.split('-').filter(Boolean);
    return parts[parts.length - 1] || projectDir;
  }

  /**
   * Get Claude session information from statsig files
   */
  async getClaudeSessionInfo() {
    try {
      if (!await fs.pathExists(this.claudeStatsigDir)) {
        return {
          hasSession: false,
          error: 'Claude statsig directory not found'
        };
      }

      const files = await fs.readdir(this.claudeStatsigDir);
      const sessionFile = files.find(file => file.startsWith('statsig.session_id.'));
      
      if (!sessionFile) {
        return {
          hasSession: false,
          error: 'No session file found'
        };
      }

      const sessionFilePath = path.join(this.claudeStatsigDir, sessionFile);
      const sessionData = await fs.readFile(sessionFilePath, 'utf8');
      const sessionInfo = JSON.parse(sessionData);

      const now = Date.now();
      const startTime = sessionInfo.startTime;
      const lastUpdate = sessionInfo.lastUpdate;
      
      // Calculate session duration
      const sessionDuration = now - startTime;
      const sessionDurationMinutes = Math.floor(sessionDuration / (1000 * 60));
      const sessionDurationHours = Math.floor(sessionDurationMinutes / 60);
      const remainingMinutes = sessionDurationMinutes % 60;
      
      // Calculate time since last update
      const timeSinceLastUpdate = now - lastUpdate;
      const timeSinceLastUpdateMinutes = Math.floor(timeSinceLastUpdate / (1000 * 60));
      
      // CORRECTED: Calculate next reset time based on scheduled reset hours
      // Claude sessions reset at specific times, not fixed durations
      const resetHours = [1, 7, 13, 19]; // 1am, 7am, 1pm, 7pm local time
      const sessionStartDate = new Date(startTime);
      
      // Find next reset time after session start
      let nextResetTime = new Date(sessionStartDate);
      nextResetTime.setMinutes(0, 0, 0); // Set to exact hour
      
      // Find the next reset hour
      let foundReset = false;
      for (let i = 0; i < resetHours.length * 2; i++) { // Check up to 2 full days
        const currentDay = Math.floor(i / resetHours.length);
        const hourIndex = i % resetHours.length;
        const resetHour = resetHours[hourIndex];
        
        const testResetTime = new Date(sessionStartDate);
        testResetTime.setDate(testResetTime.getDate() + currentDay);
        testResetTime.setHours(resetHour, 0, 0, 0);
        
        if (testResetTime > sessionStartDate) {
          nextResetTime = testResetTime;
          foundReset = true;
          break;
        }
      }
      
      if (!foundReset) {
        // Fallback: assume next day 7am if no pattern found
        nextResetTime.setDate(nextResetTime.getDate() + 1);
        nextResetTime.setHours(7, 0, 0, 0);
      }
      
      const sessionLimitMs = nextResetTime.getTime() - startTime;
      let timeRemaining = nextResetTime.getTime() - now;
      let timeRemainingMinutes = Math.floor(timeRemaining / (1000 * 60));
      let timeRemainingHours = Math.floor(timeRemainingMinutes / 60);
      let remainingMinutesDisplay = timeRemainingMinutes % 60;
      
      // If session is expired but has recent activity, calculate next reset time
      if (timeRemaining <= 0) {
        const RECENT_ACTIVITY_THRESHOLD = 5 * 60 * 1000; // 5 minutes
        const timeSinceLastUpdate = now - lastUpdate;
        
        if (timeSinceLastUpdate < RECENT_ACTIVITY_THRESHOLD) {
          // Session was renewed, find the NEXT reset time
          let nextNextResetTime = new Date(nextResetTime);
          let foundNextReset = false;
          
          for (let i = 0; i < resetHours.length; i++) {
            const resetHour = resetHours[i];
            const testResetTime = new Date(nextResetTime);
            
            if (resetHour > nextResetTime.getHours()) {
              // Same day, later hour
              testResetTime.setHours(resetHour, 0, 0, 0);
            } else {
              // Next day
              testResetTime.setDate(testResetTime.getDate() + 1);
              testResetTime.setHours(resetHour, 0, 0, 0);
            }
            
            if (testResetTime > nextResetTime) {
              nextNextResetTime = testResetTime;
              foundNextReset = true;
              break;
            }
          }
          
          if (!foundNextReset) {
            // Default to next day 1am
            nextNextResetTime.setDate(nextNextResetTime.getDate() + 1);
            nextNextResetTime.setHours(1, 0, 0, 0);
          }
          
          timeRemaining = nextNextResetTime.getTime() - now;
          timeRemainingMinutes = Math.floor(timeRemaining / (1000 * 60));
          timeRemainingHours = Math.floor(timeRemainingMinutes / 60);
          remainingMinutesDisplay = timeRemainingMinutes % 60;
          nextResetTime = nextNextResetTime;
        }
      }
      
      return {
        hasSession: true,
        sessionId: sessionInfo.sessionID,
        startTime: startTime,
        lastUpdate: lastUpdate,
        sessionDuration: {
          ms: sessionDuration,
          minutes: sessionDurationMinutes,
          hours: sessionDurationHours,
          remainingMinutes: remainingMinutes,
          formatted: `${sessionDurationHours}h ${remainingMinutes}m`
        },
        timeSinceLastUpdate: {
          ms: timeSinceLastUpdate,
          minutes: timeSinceLastUpdateMinutes,
          formatted: `${timeSinceLastUpdateMinutes}m`
        },
        estimatedTimeRemaining: {
          ms: timeRemaining,
          minutes: timeRemainingMinutes,
          hours: timeRemainingHours,
          remainingMinutes: remainingMinutesDisplay,
          formatted: timeRemaining > 0 ? `${timeRemainingHours}h ${remainingMinutesDisplay}m` : 'Session expired',
          isExpired: timeRemaining <= 0 && timeSinceLastUpdate >= (5 * 60 * 1000) // Expired only if past reset time AND no recent activity
        },
        sessionLimit: {
          ms: sessionLimitMs,
          hours: Math.floor(sessionLimitMs / (1000 * 60 * 60)),
          minutes: Math.floor((sessionLimitMs % (1000 * 60 * 60)) / (1000 * 60)),
          formatted: `${Math.floor(sessionLimitMs / (1000 * 60 * 60))}h ${Math.floor((sessionLimitMs % (1000 * 60 * 60)) / (1000 * 60))}m`,
          nextResetTime: nextResetTime.toISOString(),
          resetHour: nextResetTime.getHours()
        }
      };
    } catch (error) {
      return {
        hasSession: false,
        error: `Failed to read session info: ${error.message}`
      };
    }
  }


  stop() {
    // Stop file watchers
    this.fileWatcher.stop();

    // Stop Cloudflare Tunnel
    this.stopCloudflareTunnel();

    // Stop server
    // Close WebSocket server
    if (this.webSocketServer) {
      this.webSocketServer.close();
    }
    
    // Shutdown notification manager
    if (this.notificationManager) {
      this.notificationManager.shutdown();
    }
    
    // Shutdown console bridge
    if (this.consoleBridge) {
      this.consoleBridge.shutdown();
    }
    
    // Stop Claude API Proxy
    if (this.claudeApiProxy) {
      this.claudeApiProxy.stop();
    }
    
    if (this.httpServer) {
      this.httpServer.close();
    }
    
    // Keep compatibility
    if (this.server) {
      this.server.close();
    }

    // Log cache statistics before stopping
    this.dataCache.logStats();

    console.log(chalk.yellow('Analytics dashboard stopped'));
  }
}

async function runAnalytics(options = {}) {
  // Determine if we're opening to a specific page
  const openTo = options.openTo;
  
  if (openTo === 'agents') {
    console.log(chalk.blue('💬 Starting Claude Code Chats Dashboard...'));
  } else {
    console.log(chalk.blue('📊 Starting Claude Code Analytics Dashboard...'));
  }

  const analytics = new ClaudeAnalytics(options);

  try {
    // Handle Cloudflare Tunnel prompt BEFORE initializing anything
    let useCloudflare = false;
    
    if (options.tunnel) {
      useCloudflare = await analytics.promptCloudflareSetup();
    }

    await analytics.initialize();

    // Create web dashboard files
    // Web dashboard files are now static in analytics-web directory

    await analytics.startServer();
    
    // Start Cloudflare Tunnel BEFORE other services if requested and confirmed
    if (useCloudflare) {
      const cloudflareStarted = await analytics.startCloudflareTunnel();
      if (!cloudflareStarted) {
        console.log(chalk.yellow('⚠️  Continuing with localhost only...'));
      }
      // Wait a bit longer for tunnel to stabilize
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    await analytics.openBrowser(openTo);

    const accessUrl = analytics.publicUrl || `http://localhost:${analytics.port}`;
    
    if (openTo === 'agents') {
      console.log(chalk.green('✅ Claude Code Chats dashboard is running!'));
      console.log(chalk.cyan(`📱 Access at: ${accessUrl}/#agents`));
    } else {
      console.log(chalk.green('✅ Analytics dashboard is running!'));
      console.log(chalk.cyan(`📱 Access at: ${accessUrl}`));
    }
    
    if (analytics.publicUrl) {
      console.log(chalk.gray('🔒 Secure access via Cloudflare Tunnel'));
    } else {
      console.log(chalk.gray('🏠 Local access only'));
    }
    
    console.log(chalk.gray('Press Ctrl+C to stop the server'));

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\n🛑 Shutting down analytics dashboard...'));
      analytics.stop();
      process.exit(0);
    });

    // Keep the process running
    await new Promise(() => {});

  } catch (error) {
    console.error(chalk.red('❌ Failed to start analytics dashboard:'), error.message);
    process.exit(1);
  }
}


// If this file is executed directly, run analytics
if (require.main === module) {
  runAnalytics().catch(error => {
    console.error(chalk.red('❌ Analytics startup failed:'), error);
    process.exit(1);
  });
}

module.exports = {
  runAnalytics
};