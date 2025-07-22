const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');
const express = require('express');
const open = require('open');
const os = require('os');
const packageJson = require('../package.json');
const StateCalculator = require('./analytics/core/StateCalculator');
const ProcessDetector = require('./analytics/core/ProcessDetector');
const ConversationAnalyzer = require('./analytics/core/ConversationAnalyzer');
const FileWatcher = require('./analytics/core/FileWatcher');
const SessionAnalyzer = require('./analytics/core/SessionAnalyzer');
const DataCache = require('./analytics/data/DataCache');
const WebSocketServer = require('./analytics/notifications/WebSocketServer');
const NotificationManager = require('./analytics/notifications/NotificationManager');
const PerformanceMonitor = require('./analytics/utils/PerformanceMonitor');

class ClaudeAnalytics {
  constructor() {
    this.app = express();
    this.port = 3333;
    this.stateCalculator = new StateCalculator();
    this.processDetector = new ProcessDetector();
    this.fileWatcher = new FileWatcher();
    this.sessionAnalyzer = new SessionAnalyzer();
    this.dataCache = new DataCache();
    this.performanceMonitor = new PerformanceMonitor({
      enabled: true,
      logInterval: 60000,
      memoryThreshold: 300 * 1024 * 1024 // 300MB - more realistic for analytics dashboard
    });
    this.webSocketServer = null;
    this.notificationManager = null;
    this.httpServer = null;
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

  extractProjectFromPath(filePath) {
    // Extract project name from file path like:
    // /Users/user/.claude/projects/-Users-user-Projects-MyProject/conversation.jsonl
    const pathParts = filePath.split('/');
    const projectIndex = pathParts.findIndex(part => part === 'projects');

    if (projectIndex !== -1 && projectIndex + 1 < pathParts.length) {
      const projectDir = pathParts[projectIndex + 1];
      // Clean up the project directory name
      // The directory name is like: -Users-thom-10-19-projects-notice-wise-docs
      // We want to extract just the project name at the end (notice-wise-docs)
      
      // Convert the encoded path back to a real path
      const decodedPath = projectDir.replace(/^-/, '/').replace(/-/g, '/');
      
      // Get just the last component of the path (the actual project name)
      const decodedPathParts = decodedPath.split('/');
      const projectName = decodedPathParts[decodedPathParts.length - 1];
      
      return projectName || 'Unknown';
    }

    return null;
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
      this.dataCache
    );
  }

  setupWebServer() {
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
          console.log(chalk.yellow(`🧹 Cleaning up conversation history: ${this.data.conversations.length} -> 150`));
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
      console.log(chalk.blue('🔄 Manual refresh requested...'));
      await this.loadInitialData();
      res.json({
        success: true,
        message: 'Data refreshed',
        timestamp: new Date().toISOString(),
      });
    });

    // NEW: Ultra-fast endpoint ONLY for conversation states
    this.app.get('/api/conversation-state', async (req, res) => {
      try {
        // Only detect processes and calculate states - no file reading
        const runningProcesses = await this.processDetector.detectRunningClaudeProcesses();
        const activeStates = [];
        
        // Quick state calculation for active conversations only
        for (const conversation of this.data.conversations) {
          if (conversation.runningProcess) {
            // Use existing state calculation but faster
            const state = this.stateCalculator.quickStateCalculation(conversation, runningProcesses);
            if (state) {
              activeStates.push({
                id: conversation.id,
                project: conversation.project,
                state: state,
                timestamp: Date.now()
              });
            }
          }
        }
        
        res.json({ activeStates, timestamp: Date.now() });
      } catch (error) {
        res.status(500).json({ error: 'Failed to get conversation states' });
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
          
          if (hasChanges) {
            console.log(chalk.gray(`⚡ State update: ${activeConvs.length} active conversations`));
            activeConvs.forEach(conv => {
              console.log(chalk.gray(`  📊 ${conv.project}: ${conv.conversationState}`));
            });
          }
        }
        
        // Memory cleanup: limit conversation history to prevent memory buildup
        if (this.data.conversations.length > 100) {
          console.log(chalk.yellow(`🧹 Cleaning up conversation history: ${this.data.conversations.length} -> 100`));
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

  async openBrowser() {
    try {
      await open(`http://localhost:${this.port}`);
      console.log(chalk.blue('🌐 Opening browser...'));
    } catch (error) {
      console.log(chalk.yellow('Could not open browser automatically. Please visit:'));
      console.log(chalk.cyan(`http://localhost:${this.port}`));
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
      
      // Setup notification subscriptions
      this.setupNotificationSubscriptions();
      
      console.log(chalk.green('✅ WebSocket and notifications initialized'));
    } catch (error) {
      console.error(chalk.red('❌ Failed to initialize WebSocket:'), error);
    }
  }
  
  /**
   * Setup notification subscriptions
   */
  setupNotificationSubscriptions() {
    // Subscribe to refresh requests from WebSocket clients
    this.notificationManager.subscribe('refresh_requested', async (notification) => {
      console.log(chalk.blue('🔄 Refresh requested via WebSocket'));
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
      
      // Based on observed pattern: ~2 hours and 21 minutes session limit
      const sessionLimitMs = 2 * 60 * 60 * 1000 + 21 * 60 * 1000; // 2h 21m
      const timeRemaining = sessionLimitMs - sessionDuration;
      const timeRemainingMinutes = Math.floor(timeRemaining / (1000 * 60));
      const timeRemainingHours = Math.floor(timeRemainingMinutes / 60);
      const remainingMinutesDisplay = timeRemainingMinutes % 60;
      
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
          isExpired: timeRemaining <= 0
        },
        sessionLimit: {
          ms: sessionLimitMs,
          hours: 2,
          minutes: 21,
          formatted: '2h 21m'
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

    // Stop server
    // Close WebSocket server
    if (this.webSocketServer) {
      this.webSocketServer.close();
    }
    
    // Shutdown notification manager
    if (this.notificationManager) {
      this.notificationManager.shutdown();
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
  console.log(chalk.blue('📊 Starting Claude Code Analytics Dashboard...'));

  const analytics = new ClaudeAnalytics();

  try {
    await analytics.initialize();

    // Create web dashboard files
    // Web dashboard files are now static in analytics-web directory

    await analytics.startServer();
    await analytics.openBrowser();

    console.log(chalk.green('✅ Analytics dashboard is running!'));
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


module.exports = {
  runAnalytics
};