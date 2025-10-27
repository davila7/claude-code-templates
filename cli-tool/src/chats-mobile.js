const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');
const express = require('express');
const open = require('open');
const os = require('os');
const { spawn } = require('child_process');
const ConversationAnalyzer = require('./analytics/core/ConversationAnalyzer');
const StateCalculator = require('./analytics/core/StateCalculator');
const FileWatcher = require('./analytics/core/FileWatcher');
const DataCache = require('./analytics/data/DataCache');
const WebSocketServer = require('./analytics/notifications/WebSocketServer');
const SessionSharing = require('./session-sharing');

class ChatsMobile {
  constructor(options = {}) {
    this.app = express();
    this.port = 9876; // Uncommon port for chats mobile
    this.fileWatcher = new FileWatcher();
    this.stateCalculator = new StateCalculator();
    this.dataCache = new DataCache();
    this.httpServer = null;
    this.refreshTimeout = null;
    this.webSocketServer = null;
    this.options = options;
    this.verbose = options.verbose || false;
    
    // Initialize ConversationAnalyzer with proper parameters
    const homeDir = os.homedir();
    const claudeDir = path.join(homeDir, '.claude');
    this.conversationAnalyzer = new ConversationAnalyzer(claudeDir, this.dataCache);

    // Initialize SessionSharing for export/import functionality
    this.sessionSharing = new SessionSharing(this.conversationAnalyzer);

    this.data = {
      conversations: [],
      conversationStates: {},
      lastUpdate: new Date().toISOString()
    };
    
    // Track message counts per conversation to detect new messages
    this.conversationMessageCounts = new Map();
    
    // Track message snapshots to detect message updates (e.g., tool correlation)
    this.conversationMessageSnapshots = new Map();
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

  /**
   * Initialize the chats mobile server
   */
  async initialize() {
    console.log(chalk.gray('🔧 Initializing Claude Code Chats Mobile...'));
    
    try {
      // Setup middleware
      this.setupMiddleware();
      
      // Setup routes
      this.setupRoutes();
      
      // Setup file watching
      await this.setupFileWatching();
      
      // Load initial data
      await this.loadInitialData();
      
      // Setup WebSocket server
      await this.setupWebSocket();
      
      this.log('info', chalk.green('✅ Chats Mobile initialized successfully'));
    } catch (error) {
      console.error(chalk.red('❌ Failed to initialize Chats Mobile:'), error);
      throw error;
    }
  }

  /**
   * Setup Express middleware
   */
  setupMiddleware() {
    this.app.use(express.json());
    
    // Serve static files from analytics-web directory (for services, components, etc.)
    this.app.use('/services', express.static(path.join(__dirname, 'analytics-web', 'services')));
    this.app.use('/components', express.static(path.join(__dirname, 'analytics-web', 'components')));
    this.app.use('/assets', express.static(path.join(__dirname, 'analytics-web', 'assets')));
  }

  /**
   * Setup API routes
   */
  setupRoutes() {
    // API to get conversations
    this.app.get('/api/conversations', (req, res) => {
      try {
        res.json({
          conversations: this.data.conversations,
          timestamp: new Date().toISOString(),
          lastUpdate: this.data.lastUpdate
        });
      } catch (error) {
        console.error('Error serving conversations:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // API to get conversation states (plural - for compatibility)
    this.app.get('/api/conversation-states', (req, res) => {
      try {
        res.json({
          activeStates: this.data.conversationStates,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error serving conversation states:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // API to get conversation state (singular - like main analytics server)
    this.app.get('/api/conversation-state', async (req, res) => {
      try {
        // Calculate states for ALL conversations using StateCalculator
        const activeStates = {};
        
        for (const conversation of this.data.conversations) {
          try {
            // Get parsed messages for state calculation
            const parsedMessages = await this.conversationAnalyzer.getParsedConversation(conversation.filePath);
            
            // Use StateCalculator to determine current state
            const state = this.stateCalculator.determineConversationState(
              parsedMessages, 
              conversation.lastModified,
              null // No running process detection for now
            );
            
            activeStates[conversation.id] = state;
          } catch (error) {
            console.warn(`Error calculating state for conversation ${conversation.id}:`, error.message);
            activeStates[conversation.id] = 'Inactive';
          }
        }
        
        res.json({
          activeStates,
          timestamp: new Date().toISOString(),
          totalConversations: this.data.conversations.length
        });
      } catch (error) {
        console.error('Error calculating conversation states:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // API to get unique working directories from conversations
    this.app.get('/api/directories', (req, res) => {
      try {
        // Extract unique directories from conversations
        const directories = new Set();

        this.data.conversations.forEach(conv => {
          if (conv.project && conv.project.trim()) {
            directories.add(conv.project);
          }
        });

        // Convert to array and sort alphabetically
        const sortedDirectories = Array.from(directories).sort((a, b) =>
          a.toLowerCase().localeCompare(b.toLowerCase())
        );

        res.json({
          directories: sortedDirectories,
          count: sortedDirectories.length,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error getting directories:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // API to search conversations with advanced filters
    this.app.post('/api/search', async (req, res) => {
      try {
        const { query, workingDirectory, dateFrom, dateTo, contentSearch } = req.body;

        let results = [...this.data.conversations];

        // Filter by working directory (project)
        if (workingDirectory && workingDirectory.trim()) {
          results = results.filter(conv => {
            if (!conv.project) return false;
            return conv.project.toLowerCase().includes(workingDirectory.toLowerCase());
          });
        }

        // Filter by date range
        if (dateFrom) {
          const fromDate = new Date(dateFrom);
          results = results.filter(conv => new Date(conv.created) >= fromDate);
        }

        if (dateTo) {
          const toDate = new Date(dateTo);
          toDate.setHours(23, 59, 59, 999); // Include entire day
          results = results.filter(conv => new Date(conv.created) <= toDate);
        }

        // Filter by conversation metadata (filename, id)
        if (query && query.trim()) {
          const searchTerm = query.toLowerCase();
          results = results.filter(conv =>
            conv.filename.toLowerCase().includes(searchTerm) ||
            conv.id.toLowerCase().includes(searchTerm) ||
            (conv.project && conv.project.toLowerCase().includes(searchTerm))
          );
        }

        // Search within message content
        if (contentSearch && contentSearch.trim()) {
          const contentTerm = contentSearch.toLowerCase();
          const matchingConversations = [];

          for (const conv of results) {
            try {
              const messages = await this.conversationAnalyzer.getParsedConversation(conv.filePath);

              // Search in message content
              const hasMatch = messages.some(msg => {
                // Search in text content
                if (typeof msg.content === 'string') {
                  return msg.content.toLowerCase().includes(contentTerm);
                }

                // Search in array content (tool use, text blocks)
                if (Array.isArray(msg.content)) {
                  return msg.content.some(block => {
                    if (block.type === 'text' && block.text) {
                      return block.text.toLowerCase().includes(contentTerm);
                    }
                    if (block.type === 'tool_use' && block.name) {
                      return block.name.toLowerCase().includes(contentTerm);
                    }
                    return false;
                  });
                }

                return false;
              });

              if (hasMatch) {
                matchingConversations.push(conv);
              }
            } catch (error) {
              // Skip conversations that can't be parsed
              this.log('warn', `Error searching in conversation ${conv.id}:`, error.message);
            }
          }

          results = matchingConversations;
        }

        // Sort by last modified (most recent first)
        results.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));

        res.json({
          results: results,
          count: results.length,
          filters: {
            query,
            workingDirectory,
            dateFrom,
            dateTo,
            contentSearch
          },
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error searching conversations:', error);
        res.status(500).json({ error: 'Internal server error', message: error.message });
      }
    });

    // API to search within a specific conversation
    this.app.post('/api/conversations/:id/search', async (req, res) => {
      try {
        const conversationId = req.params.id;
        const { query } = req.body;
        const conversation = this.data.conversations.find(conv => conv.id === conversationId);

        if (!conversation) {
          return res.status(404).json({ error: 'Conversation not found' });
        }

        if (!query || !query.trim()) {
          return res.json({
            matches: [],
            totalMatches: 0,
            conversationId: conversationId
          });
        }

        // Get all messages from the conversation
        const allMessages = await this.conversationAnalyzer.getParsedConversation(conversation.filePath);
        const searchTerm = query.toLowerCase();
        const matches = [];

        // Search through all messages
        allMessages.forEach((msg, index) => {
          let messageText = '';
          let allText = [];

          // Extract text from message content
          if (typeof msg.content === 'string') {
            allText.push(msg.content);
          } else if (Array.isArray(msg.content)) {
            msg.content.forEach(block => {
              if (block.type === 'text' && block.text) {
                allText.push(block.text);
              }
              // Also search in tool_use content
              if (block.type === 'tool_use') {
                if (block.name) allText.push(block.name);
                if (block.input) {
                  allText.push(JSON.stringify(block.input));
                }
              }
            });
          }

          // IMPORTANT: Also search in tool results (this is where code blocks appear!)
          if (msg.toolResults && Array.isArray(msg.toolResults)) {
            msg.toolResults.forEach(toolResult => {
              if (toolResult.content) {
                if (typeof toolResult.content === 'string') {
                  allText.push(toolResult.content);
                } else if (Array.isArray(toolResult.content)) {
                  toolResult.content.forEach(block => {
                    if (block.type === 'text' && block.text) {
                      allText.push(block.text);
                    }
                  });
                }
              }
            });
          }

          // Combine all text
          messageText = allText.join(' ');

          // Search in the combined text
          if (messageText.toLowerCase().includes(searchTerm)) {
            // Find all positions of the search term in this message
            const lowerText = messageText.toLowerCase();
            let position = 0;
            let matchCount = 0;

            while ((position = lowerText.indexOf(searchTerm, position)) !== -1) {
              matchCount++;
              position += searchTerm.length;
            }

            matches.push({
              messageIndex: index,
              messageId: msg.id,
              role: msg.role,
              timestamp: msg.timestamp,
              preview: this.getMessagePreview(messageText, searchTerm),
              matchCount: matchCount
            });
          }
        });

        console.log(`🔍 Search in conversation ${conversationId}:`, {
          query: query,
          messagesWithMatches: matches.length,
          totalOccurrences: matches.reduce((sum, m) => sum + m.matchCount, 0)
        });

        res.json({
          matches: matches,
          totalMatches: matches.length,
          conversationId: conversationId,
          query: query
        });
      } catch (error) {
        console.error('Error searching in conversation:', error);
        res.status(500).json({ error: 'Internal server error', message: error.message });
      }
    });

    // API to get specific conversation messages (with pagination support)
    this.app.get('/api/conversations/:id/messages', async (req, res) => {
      try {
        const conversationId = req.params.id;
        const conversation = this.data.conversations.find(conv => conv.id === conversationId);
        
        if (!conversation) {
          return res.status(404).json({ error: 'Conversation not found' });
        }

        // Get the actual parsed messages from the conversation file
        const allMessages = await this.conversationAnalyzer.getParsedConversation(conversation.filePath);
        
        // Parse pagination parameters
        const page = parseInt(req.query.page) || 0;
        const limit = parseInt(req.query.limit) || 50; // Default to 50 messages if no limit specified
        
        if (!req.query.page && !req.query.limit) {
          // No pagination requested - return all messages (backward compatibility)
          res.json({
            conversation: conversation,
            messages: allMessages || [],
            timestamp: new Date().toISOString()
          });
          return;
        }
        
        // Sort messages chronologically (oldest first)
        const sortedMessages = (allMessages || []).sort((a, b) => 
          new Date(a.timestamp) - new Date(b.timestamp)
        );
        
        const totalMessages = sortedMessages.length;
        const totalPages = Math.ceil(totalMessages / limit);
        
        // For reverse pagination: page 0 = most recent messages, page 1 = older messages, etc.
        // Calculate from the end of the array going backwards
        const endIndex = totalMessages - (page * limit);
        const startIndex = Math.max(0, endIndex - limit);
        
        // Get the requested page of messages
        const paginatedMessages = sortedMessages.slice(startIndex, endIndex);
        
        res.json({
          conversation: conversation,
          messages: paginatedMessages,
          pagination: {
            page: page,
            limit: limit,
            totalMessages: totalMessages,
            totalPages: totalPages,
            hasMore: startIndex > 0,
            isFirstPage: page === 0,
            isLastPage: startIndex <= 0
          },
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error serving conversation messages:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // API to share a conversation session
    this.app.post('/api/conversations/:id/share', async (req, res) => {
      try {
        const conversationId = req.params.id;
        const conversation = this.data.conversations.find(conv => conv.id === conversationId);

        if (!conversation) {
          return res.status(404).json({ error: 'Conversation not found' });
        }

        console.log(chalk.cyan(`📤 Sharing conversation ${conversationId}...`));

        // Share the session using SessionSharing module
        const shareResult = await this.sessionSharing.shareSession(conversationId, conversation);

        res.json({
          success: true,
          conversationId: conversationId,
          uploadUrl: shareResult.uploadUrl,
          shareCommand: shareResult.shareCommand,
          expiresIn: shareResult.expiresIn,
          qrCode: shareResult.qrCode,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error sharing conversation:', error);
        res.status(500).json({
          error: 'Failed to share session',
          message: error.message
        });
      }
    });

    // Serve the mobile chats page as default
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'analytics-web', 'chats_mobile.html'));
    });

    // Fallback for any other routes (but not for API or static files)
    this.app.get('*', (req, res) => {
      // Don't redirect API calls or static files
      if (req.path.startsWith('/api/') || 
          req.path.startsWith('/services/') || 
          req.path.startsWith('/components/') || 
          req.path.startsWith('/assets/')) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      res.sendFile(path.join(__dirname, 'analytics-web', 'chats_mobile.html'));
    });
  }

  /**
   * Setup file watching for Claude Code conversations
   */
  async setupFileWatching() {
    try {
      const homeDir = os.homedir();
      const claudeDir = path.join(homeDir, '.claude');
      
      this.fileWatcher.setupFileWatchers(
        claudeDir,
        this.handleDataRefresh.bind(this),
        () => {}, // processRefreshCallback (not needed for mobile)
        this.dataCache,
        this.handleConversationChange.bind(this)
      );
      
      this.log('info', chalk.green('👀 File watching setup successful'));
    } catch (error) {
      this.log('warn', chalk.yellow('⚠️  File watching setup failed:', error.message));
    }
  }

  /**
   * Handle data refresh from file watcher (with debouncing)
   */
  async handleDataRefresh() {
    // Clear previous timeout to debounce rapid file changes
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }
    
    // Set a new timeout to refresh after 2 seconds of inactivity
    this.refreshTimeout = setTimeout(async () => {
      try {
        await this.loadInitialData();
        console.log(chalk.gray('🔄 Data refreshed from file changes'));
      } catch (error) {
        console.error('Error refreshing data:', error);
      }
    }, 2000);
  }

  /**
   * Generate a snapshot of a message for change detection
   * @param {Object} message - Message object
   * @returns {string} Message snapshot hash
   */
  generateMessageSnapshot(message) {
    // Create a hash based on key message properties that can change
    const snapshot = {
      id: message.id,
      role: message.role,
      contentLength: Array.isArray(message.content) ? message.content.length : (message.content?.length || 0),
      toolResultsCount: message.toolResults ? message.toolResults.length : 0,
      hasToolUse: Array.isArray(message.content) && message.content.some(block => block.type === 'tool_use'),
      hasToolResults: !!(message.toolResults && message.toolResults.length > 0)
    };
    return JSON.stringify(snapshot);
  }

  /**
   * Handle conversation changes
   */
  async handleConversationChange(conversationId) {
    this.log('info', chalk.gray(`💬 Conversation ${conversationId.slice(-8)} changed`));
    
    // Get the conversation to find new messages
    const conversation = this.data.conversations.find(conv => conv.id === conversationId);
    if (!conversation) return;

    try {
      // Get the latest parsed messages with proper tool correlation
      const parsedMessages = await this.conversationAnalyzer.getParsedConversation(conversation.filePath);
      
      if (parsedMessages && parsedMessages.length > 0) {
        // Get the previous message count and snapshots for this conversation
        const previousCount = this.conversationMessageCounts.get(conversationId) || 0;
        const currentCount = parsedMessages.length;
        const previousSnapshots = this.conversationMessageSnapshots.get(conversationId) || [];
        
        // Update the count
        this.conversationMessageCounts.set(conversationId, currentCount);
        
        // Generate current snapshots
        const currentSnapshots = parsedMessages.map(msg => this.generateMessageSnapshot(msg));
        this.conversationMessageSnapshots.set(conversationId, currentSnapshots);
        
        // Find new messages (by count increase)
        const newMessages = currentCount > previousCount ? parsedMessages.slice(previousCount) : [];
        
        // Find updated messages (by comparing snapshots)
        const updatedMessages = [];
        for (let i = 0; i < Math.min(previousCount, currentCount); i++) {
          if (i < previousSnapshots.length && currentSnapshots[i] !== previousSnapshots[i]) {
            this.log('info', chalk.yellow(`🔄 Message ${i} changed:`));
            this.log('info', chalk.gray(`   Previous: ${previousSnapshots[i]}`));
            this.log('info', chalk.gray(`   Current:  ${currentSnapshots[i]}`));
            this.log('info', chalk.gray(`   Message:  role=${parsedMessages[i].role}, content=${typeof parsedMessages[i].content}, toolResults=${parsedMessages[i].toolResults?.length || 0}`));
            updatedMessages.push(parsedMessages[i]);
          }
        }
        
        // Combine new and updated messages, avoiding duplicates
        const messagesToBroadcast = [...newMessages];
        for (const updatedMsg of updatedMessages) {
          if (!newMessages.find(newMsg => newMsg.id === updatedMsg.id)) {
            messagesToBroadcast.push(updatedMsg);
          }
        }
        
        if (messagesToBroadcast.length > 0) {
          this.log('info', chalk.cyan(`🔧 Found ${newMessages.length} new messages and ${updatedMessages.length} updated messages in conversation ${conversationId.slice(-8)}`));
          
          // Broadcast each message (new or updated)
          for (const message of messagesToBroadcast) {
            if (this.webSocketServer) {
              // Log message details for debugging
              const messageType = message.toolResults && message.toolResults.length > 0 ? 'tool' : 'text';
              const toolCount = message.toolResults ? message.toolResults.length : 0;
              const hasToolsInContent = Array.isArray(message.content) && 
                                       message.content.some(block => block.type === 'tool_use');
              const isUpdatedMessage = updatedMessages.includes(message);
              
              this.log('info', chalk.cyan(`🌐 Broadcasting ${isUpdatedMessage ? 'updated' : 'new'} ${messageType} message (${toolCount} tools) for ${conversationId.slice(-8)}`));
              this.log('info', chalk.gray(`   Message details: role=${message.role}, hasToolResults=${!!message.toolResults}, hasToolsInContent=${hasToolsInContent}`));
              if (message.toolResults) {
                this.log('info', chalk.gray(`   Tool results: ${message.toolResults.map(tr => tr.tool_use_id || 'no-id').join(', ')}`));
              }
              
              this.webSocketServer.broadcast({
                type: 'new_message',
                data: {
                  conversationId: conversationId,
                  message: message,
                  metadata: {
                    timestamp: new Date().toISOString(),
                    totalMessages: currentCount,
                    hasTools: !!(message.toolResults && message.toolResults.length > 0),
                    toolCount: toolCount,
                    messageIndex: parsedMessages.indexOf(message),
                    isUpdated: isUpdatedMessage
                  }
                }
              });
            }
          }
        } else {
          console.log(chalk.gray(`📝 No new messages in conversation ${conversationId.slice(-8)} (${currentCount} total)`));
        }
      }
    } catch (error) {
      console.warn(chalk.yellow('⚠️  Error handling conversation change:', error.message));
    }
  }

  /**
   * Setup WebSocket server for real-time updates (will be initialized after HTTP server starts)
   */
  async setupWebSocket() {
    // WebSocketServer will be initialized after HTTP server is created
    console.log(chalk.gray('🔧 WebSocket server setup prepared'));
  }

  /**
   * Helper function to get message preview with context
   */
  getMessagePreview(text, searchTerm, contextLength = 100) {
    const lowerText = text.toLowerCase();
    const lowerTerm = searchTerm.toLowerCase();
    const position = lowerText.indexOf(lowerTerm);

    if (position === -1) return text.substring(0, contextLength);

    const start = Math.max(0, position - contextLength / 2);
    const end = Math.min(text.length, position + searchTerm.length + contextLength / 2);

    let preview = text.substring(start, end);
    if (start > 0) preview = '...' + preview;
    if (end < text.length) preview = preview + '...';

    return preview;
  }

  /**
   * Load initial conversation data
   */
  async loadInitialData() {
    try {
      const homeDir = os.homedir();
      const claudeDataDir = path.join(homeDir, '.claude');
      
      if (await fs.pathExists(claudeDataDir)) {
        // Use ConversationAnalyzer to load conversations
        const conversations = await this.conversationAnalyzer.loadConversations(this.stateCalculator);
        
        this.data.conversations = conversations || [];
        this.data.conversationStates = {}; // Will be populated by state calculation if needed
        this.data.lastUpdate = new Date().toISOString();
        
        // Initialize message counts and snapshots for each conversation
        for (const conversation of conversations) {
          try {
            const parsedMessages = await this.conversationAnalyzer.getParsedConversation(conversation.filePath);
            this.conversationMessageCounts.set(conversation.id, parsedMessages.length);
            
            // Initialize snapshots for change detection
            const snapshots = parsedMessages.map(msg => this.generateMessageSnapshot(msg));
            this.conversationMessageSnapshots.set(conversation.id, snapshots);
          } catch (error) {
            // If we can't parse the conversation, set count to 0 and empty snapshots
            this.conversationMessageCounts.set(conversation.id, 0);
            this.conversationMessageSnapshots.set(conversation.id, []);
          }
        }
        
        console.log(chalk.green(`📂 Loaded ${this.data.conversations.length} conversations`));
        console.log(chalk.gray(`📊 Initialized message counts for ${this.conversationMessageCounts.size} conversations`));
      } else {
        console.log(chalk.yellow('⚠️  No Claude Code data directory found'));
        console.log(chalk.gray(`    Expected directory: ${claudeDataDir}`));
      }
    } catch (error) {
      console.warn(chalk.yellow('⚠️  Failed to load initial data:', error.message));
    }
  }

  /**
   * Start the mobile chats server
   */
  async startServer() {
    return new Promise(async (resolve) => {
      this.httpServer = this.app.listen(this.port, async () => {
        this.localUrl = `http://localhost:${this.port}`;
        console.log(chalk.green(`📱 Chats Mobile server started at ${this.localUrl}`));
        
        // Initialize WebSocket server with HTTP server
        try {
          this.webSocketServer = new WebSocketServer(this.httpServer, {
            port: this.port,
            path: '/ws'
          });
          await this.webSocketServer.initialize();
          this.log('info', chalk.green('🌐 WebSocket server initialized'));
        } catch (error) {
          this.log('warn', chalk.yellow('⚠️  WebSocket server failed to initialize:', error.message));
        }
        
        // Setup Cloudflare Tunnel if requested
        if (this.options.tunnel) {
          await this.setupCloudflaredTunnel();
        }
        
        resolve();
      });
    });
  }

  /**
   * Setup Cloudflare Tunnel for remote access
   */
  async setupCloudflaredTunnel() {
    console.log(chalk.blue('☁️  Setting up Cloudflare Tunnel...'));
    console.log(chalk.gray(`📡 Tunneling ${this.localUrl}...`));
    
    try {
      const { spawn } = require('child_process');
      
      // Spawn cloudflared tunnel with more options for better compatibility
      const cloudflared = spawn('cloudflared', [
        'tunnel', 
        '--url', this.localUrl,
        '--no-autoupdate'  // Prevent update check that can cause delays
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, NO_UPDATE_NOTIFIER: '1' } // Disable update notifier
      });
      
      // Store process reference for cleanup
      this.cloudflaredProcess = cloudflared;
      
      // Parse tunnel URL from cloudflared output
      return new Promise((resolve) => {
        let output = '';
        
        cloudflared.stdout.on('data', (data) => {
          const str = data.toString();
          output += str;
          
          // Always show cloudflared output for debugging tunnel issues
          console.log(chalk.gray(`[cloudflared] ${str.trim()}`));
          
          // Look for various tunnel URL patterns
          let urlMatch = str.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
          if (!urlMatch) {
            // Try alternative patterns
            urlMatch = str.match(/https:\/\/[a-zA-Z0-9-]+\.cfargotunnel\.com/);
          }
          if (!urlMatch) {
            // Try to find any HTTPS URL in the output
            urlMatch = str.match(/https:\/\/[a-zA-Z0-9.-]+\.(?:trycloudflare|cfargotunnel)\.com/);
          }
          
          if (urlMatch) {
            this.tunnelUrl = urlMatch[0];
            console.log(chalk.green(`☁️  Cloudflare Tunnel ready: ${this.tunnelUrl}`));
            resolve(this.tunnelUrl);
          }
        });
        
        cloudflared.stderr.on('data', (data) => {
          const str = data.toString();
          // Always show stderr for debugging
          console.error(chalk.gray(`[cloudflared stderr] ${str.trim()}`));
          
          // Sometimes tunnel URLs appear in stderr
          let urlMatch = str.match(/https:\/\/[a-zA-Z0-9-]+\.(?:trycloudflare|cfargotunnel)\.com/);
          if (urlMatch && !this.tunnelUrl) {
            this.tunnelUrl = urlMatch[0];
            console.log(chalk.green(`☁️  Cloudflare Tunnel ready: ${this.tunnelUrl}`));
            resolve(this.tunnelUrl);
          }
        });
        
        cloudflared.on('error', (error) => {
          console.error(chalk.red('❌ Failed to start Cloudflare Tunnel:'), error.message);
          console.log(chalk.yellow('💡 Make sure cloudflared is installed: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/'));
          resolve(null);
        });
        
        cloudflared.on('close', (code) => {
          console.log(chalk.yellow(`⚠️  Cloudflared process exited with code ${code}`));
          if (!this.tunnelUrl) {
            resolve(null);
          }
        });
        
        // Timeout after 45 seconds (increased from 30)
        setTimeout(() => {
          if (!this.tunnelUrl) {
            console.warn(chalk.yellow('⚠️  Tunnel URL not detected within 45 seconds'));
            console.log(chalk.gray('Full cloudflared output:'));
            console.log(chalk.gray(output));
            console.log(chalk.blue('💡 You can manually run: ') + chalk.white(`cloudflared tunnel --url ${this.localUrl}`));
            console.log(chalk.blue('   Then copy the tunnel URL and access it in your browser.'));
            resolve(null);
          }
        }, 45000);
      });
    } catch (error) {
      console.error(chalk.red('❌ Error setting up Cloudflare Tunnel:'), error.message);
      return null;
    }
  }

  /**
   * Open browser to the mobile chats interface
   */
  async openBrowser() {
    try {
      // Use tunnel URL if available, otherwise local URL
      const url = this.tunnelUrl || this.localUrl || `http://localhost:${this.port}`;
      console.log(chalk.cyan(`🌐 Opening browser to ${url}`));
      await open(url);
    } catch (error) {
      console.warn(chalk.yellow('⚠️  Could not auto-open browser:', error.message));
    }
  }

  /**
   * Stop the server
   */
  async stop() {
    if (this.cloudflaredProcess) {
      try {
        this.cloudflaredProcess.kill('SIGTERM');
        this.log('info', chalk.gray('☁️  Cloudflare Tunnel stopped'));
      } catch (error) {
        this.log('warn', chalk.yellow('⚠️  Error stopping Cloudflare Tunnel:', error.message));
      }
    }
    
    if (this.webSocketServer) {
      try {
        await this.webSocketServer.close();
        this.log('info', chalk.gray('🌐 WebSocket server stopped'));
      } catch (error) {
        this.log('warn', chalk.yellow('⚠️  Error stopping WebSocket server:', error.message));
      }
    }
    
    if (this.httpServer) {
      await new Promise((resolve) => {
        this.httpServer.close(resolve);
      });
    }
    
    if (this.fileWatcher) {
      await this.fileWatcher.stop();
    }
    
    console.log(chalk.gray('🛑 Chats Mobile server stopped'));
  }
}

/**
 * Start the mobile chats server
 */
async function startChatsMobile(options = {}) {
  console.log(chalk.blue('📱 Starting Claude Code Chats Mobile...'));
  
  const chatsMobile = new ChatsMobile(options);
  
  try {
    await chatsMobile.initialize();
    await chatsMobile.startServer();
    
    if (!options.noOpen) {
      await chatsMobile.openBrowser();
    }
    
    console.log(chalk.green('✅ Claude Code Chats Mobile is running!'));
    
    // Show access URLs
    console.log(chalk.cyan(`📱 Local access: ${chatsMobile.localUrl}`));
    if (chatsMobile.tunnelUrl) {
      console.log(chalk.cyan(`☁️  Remote access: ${chatsMobile.tunnelUrl}`));
      console.log(chalk.blue(`🌐 Opening remote URL: ${chatsMobile.tunnelUrl}`));
    }
    
    console.log(chalk.gray('Press Ctrl+C to stop'));
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log(chalk.yellow('\n🛑 Shutting down...'));
      await chatsMobile.stop();
      process.exit(0);
    });
    
  } catch (error) {
    console.error(chalk.red('❌ Failed to start Chats Mobile:'), error);
    process.exit(1);
  }
}

module.exports = { ChatsMobile, startChatsMobile };