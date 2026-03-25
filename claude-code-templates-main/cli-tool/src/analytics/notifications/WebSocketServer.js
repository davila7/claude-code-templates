/**
 * WebSocketServer - Handles real-time communication between server and clients
 * Part of the modular backend architecture for Phase 3
 */
const WebSocket = require('ws');
const chalk = require('chalk');

class WebSocketServer {
  constructor(httpServer, options = {}, performanceMonitor = null) {
    this.httpServer = httpServer;
    this.performanceMonitor = performanceMonitor;
    this.options = {
      port: options.port || 3334,
      path: options.path || '/ws',
      heartbeatInterval: options.heartbeatInterval || 30000,
      ...options
    };
    
    this.wss = null;
    this.clients = new Map();
    this.heartbeatInterval = null;
    this.isRunning = false;
    this.messageQueue = [];
    this.maxQueueSize = 100;
  }

  /**
   * Initialize and start the WebSocket server
   */
  async initialize() {
    try {
      console.log(chalk.blue('🔌 Initializing WebSocket server...'));
      
      // Create WebSocket server
      this.wss = new WebSocket.Server({
        server: this.httpServer,
        path: this.options.path,
        clientTracking: true
      });

      this.setupEventHandlers();
      this.startHeartbeat();
      this.isRunning = true;

      console.log(chalk.green(`✅ WebSocket server initialized on ${this.options.path}`));
    } catch (error) {
      console.error(chalk.red('❌ Failed to initialize WebSocket server:'), error);
      throw error;
    }
  }

  /**
   * Setup WebSocket event handlers
   */
  setupEventHandlers() {
    this.wss.on('connection', (ws, request) => {
      this.handleConnection(ws, request);
    });

    this.wss.on('error', (error) => {
      console.error(chalk.red('WebSocket server error:'), error);
    });

    this.wss.on('close', () => {
      console.log(chalk.yellow('🔌 WebSocket server closed'));
      this.isRunning = false;
    });
  }

  /**
   * Handle new WebSocket connection
   * @param {WebSocket} ws - WebSocket connection
   * @param {Object} request - HTTP request object
   */
  handleConnection(ws, request) {
    const clientId = this.generateClientId();
    const clientInfo = {
      id: clientId,
      ws: ws,
      ip: request.socket.remoteAddress,
      userAgent: request.headers['user-agent'],
      connectedAt: new Date(),
      isAlive: true,
      subscriptions: new Set()
    };

    this.clients.set(clientId, clientInfo);
    console.log(chalk.green(`🔗 WebSocket client connected: ${clientId} (${this.clients.size} total)`));

    // Track WebSocket connection in performance monitor
    if (this.performanceMonitor) {
      this.performanceMonitor.recordWebSocket('connection', {
        clientId,
        totalClients: this.clients.size,
        ip: request.socket.remoteAddress
      });
    }

    // Send welcome message
    this.sendToClient(clientId, {
      type: 'connection',
      data: {
        clientId: clientId,
        serverTime: new Date().toISOString(),
        message: 'Connected to Claude Code Analytics WebSocket'
      }
    });

    // Send any queued messages
    this.sendQueuedMessages(clientId);

    // Setup client event handlers
    ws.on('message', (message) => {
      this.handleClientMessage(clientId, message);
    });

    ws.on('close', (code, reason) => {
      this.handleClientDisconnect(clientId, code, reason);
    });

    ws.on('error', (error) => {
      console.error(chalk.red(`WebSocket client error (${clientId}):`), error);
    });

    ws.on('pong', () => {
      this.handleClientPong(clientId);
    });
  }

  /**
   * Handle message from client
   * @param {string} clientId - Client ID
   * @param {Buffer} message - Message buffer
   */
  handleClientMessage(clientId, message) {
    try {
      const data = JSON.parse(message.toString());
      const client = this.clients.get(clientId);
      
      if (!client) return;

      console.log(chalk.cyan(`📨 Message from ${clientId}:`), data.type);

      // Track message in performance monitor
      if (this.performanceMonitor) {
        this.performanceMonitor.recordWebSocket('message_received', {
          clientId,
          messageType: data.type,
          messageSize: message.length
        });
      }

      switch (data.type) {
        case 'subscribe':
          this.handleSubscription(clientId, data.channel);
          break;
        case 'unsubscribe':
          this.handleUnsubscription(clientId, data.channel);
          break;
        case 'ping':
          this.sendToClient(clientId, { type: 'pong', timestamp: Date.now() });
          break;
        case 'refresh_request':
          this.handleRefreshRequest(clientId);
          break;
        default:
          console.warn(chalk.yellow(`Unknown message type from ${clientId}: ${data.type}`));
      }
    } catch (error) {
      console.error(chalk.red(`Error parsing message from ${clientId}:`), error);
    }
  }

  /**
   * Handle client subscription to a channel
   * @param {string} clientId - Client ID
   * @param {string} channel - Channel name
   */
  handleSubscription(clientId, channel) {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.subscriptions.add(channel);
    console.log(chalk.green(`📡 Client ${clientId} subscribed to ${channel}`));

    this.sendToClient(clientId, {
      type: 'subscription_confirmed',
      data: { channel, subscriptions: Array.from(client.subscriptions) }
    });
  }

  /**
   * Handle client unsubscription from a channel
   * @param {string} clientId - Client ID
   * @param {string} channel - Channel name
   */
  handleUnsubscription(clientId, channel) {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.subscriptions.delete(channel);
    console.log(chalk.yellow(`📡 Client ${clientId} unsubscribed from ${channel}`));

    this.sendToClient(clientId, {
      type: 'unsubscription_confirmed',
      data: { channel, subscriptions: Array.from(client.subscriptions) }
    });
  }

  /**
   * Handle refresh request from client
   * @param {string} clientId - Client ID
   */
  handleRefreshRequest(clientId) {
    console.log(chalk.blue(`🔄 Refresh requested by ${clientId}`));
    // Emit refresh event that the main analytics server can listen to
    this.emit('refresh_requested', { clientId });
  }

  /**
   * Handle client disconnection
   * @param {string} clientId - Client ID
   * @param {number} code - Close code
   * @param {Buffer} reason - Close reason
   */
  handleClientDisconnect(clientId, code, reason) {
    this.clients.delete(clientId);
    console.log(chalk.yellow(`🔗 WebSocket client disconnected: ${clientId} (${this.clients.size} remaining)`));
    console.log(chalk.gray(`   Close code: ${code}, Reason: ${reason || 'No reason provided'}`));

    // Track disconnection in performance monitor
    if (this.performanceMonitor) {
      this.performanceMonitor.recordWebSocket('disconnection', {
        clientId,
        closeCode: code,
        totalClients: this.clients.size,
        reason: reason?.toString() || 'No reason provided'
      });
    }
  }

  /**
   * Handle client pong response
   * @param {string} clientId - Client ID
   */
  handleClientPong(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      client.isAlive = true;
    }
  }

  /**
   * Broadcast message to all connected clients
   * @param {Object} message - Message to broadcast
   * @param {string} channel - Optional channel filter
   */
  broadcast(message, channel = null) {
    const messageStr = JSON.stringify({
      ...message,
      timestamp: Date.now(),
      server: 'Claude Code Analytics'
    });

    let sentCount = 0;
    this.clients.forEach((client, clientId) => {
      // Filter by channel subscription if specified
      if (channel && !client.subscriptions.has(channel)) {
        return;
      }

      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(messageStr);
          sentCount++;
        } catch (error) {
          console.error(chalk.red(`Error sending to client ${clientId}:`), error);
          this.clients.delete(clientId);
        }
      }
    });

    if (sentCount > 0) {
      //console.log(chalk.green(`📢 Broadcasted ${message.type} to ${sentCount} clients${channel ? ` on channel ${channel}` : ''}`));
    }

    // Queue message if no clients connected
    if (sentCount === 0 && this.clients.size === 0) {
      this.queueMessage(message);
    }
  }

  /**
   * Send message to specific client
   * @param {string} clientId - Client ID
   * @param {Object} message - Message to send
   */
  sendToClient(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      const messageStr = JSON.stringify({
        ...message,
        timestamp: Date.now(),
        server: 'Claude Code Analytics'
      });
      client.ws.send(messageStr);
      return true;
    } catch (error) {
      console.error(chalk.red(`Error sending to client ${clientId}:`), error);
      this.clients.delete(clientId);
      return false;
    }
  }

  /**
   * Queue message for future delivery
   * @param {Object} message - Message to queue
   */
  queueMessage(message) {
    this.messageQueue.push({
      ...message,
      queuedAt: Date.now()
    });

    // Keep queue size manageable
    if (this.messageQueue.length > this.maxQueueSize) {
      this.messageQueue.shift();
    }
  }

  /**
   * Send queued messages to newly connected client
   * @param {string} clientId - Client ID
   */
  sendQueuedMessages(clientId) {
    if (this.messageQueue.length === 0) return;

    console.log(chalk.blue(`📦 Sending ${this.messageQueue.length} queued messages to ${clientId}`));
    
    this.messageQueue.forEach(message => {
      this.sendToClient(clientId, {
        ...message,
        type: 'queued_' + message.type,
        wasQueued: true
      });
    });
  }

  /**
   * Notify clients of conversation state change
   * @param {string} conversationId - Conversation ID
   * @param {string} newState - New state
   * @param {Object} metadata - Additional metadata
   */
  notifyConversationStateChange(conversationId, newState, metadata = {}) {
    this.broadcast({
      type: 'conversation_state_change',
      data: {
        conversationId,
        newState,
        ...metadata
      }
    }, 'conversation_updates');
  }

  /**
   * Notify clients of data refresh
   * @param {Object} data - Updated data
   */
  notifyDataRefresh(data) {
    this.broadcast({
      type: 'data_refresh',
      data
    }, 'data_updates');
  }

  /**
   * Notify clients of system status change
   * @param {Object} status - System status
   */
  notifySystemStatus(status) {
    this.broadcast({
      type: 'system_status',
      data: status
    }, 'system_updates');
  }

  /**
   * Start heartbeat mechanism
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.clients.forEach((client, clientId) => {
        if (!client.isAlive) {
          console.log(chalk.yellow(`💔 Terminating unresponsive client: ${clientId}`));
          client.ws.terminate();
          this.clients.delete(clientId);
          return;
        }

        client.isAlive = false;
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.ping();
        }
      });
    }, this.options.heartbeatInterval);
  }

  /**
   * Stop heartbeat mechanism
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Generate unique client ID
   * @returns {string} Client ID
   */
  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get server statistics
   * @returns {Object} Server statistics
   */
  getStats() {
    const clientStats = Array.from(this.clients.values()).map(client => ({
      id: client.id,
      ip: client.ip,
      connectedAt: client.connectedAt,
      subscriptions: Array.from(client.subscriptions),
      isAlive: client.isAlive
    }));

    return {
      isRunning: this.isRunning,
      clientCount: this.clients.size,
      queuedMessages: this.messageQueue.length,
      clients: clientStats,
      uptime: this.isRunning ? Date.now() - this.startTime : 0
    };
  }

  /**
   * Gracefully close all connections and stop server
   */
  async close() {
    console.log(chalk.yellow('🔌 Closing WebSocket server...'));
    
    this.stopHeartbeat();
    
    // Close all client connections
    this.clients.forEach((client, clientId) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.close(1000, 'Server shutting down');
      }
    });
    
    this.clients.clear();
    
    if (this.wss) {
      await new Promise((resolve) => {
        this.wss.close(resolve);
      });
    }
    
    this.isRunning = false;
    console.log(chalk.green('✅ WebSocket server closed'));
  }

  /**
   * Event emitter functionality
   */
  emit(event, data) {
    // Simple event emitter implementation
    if (this.listeners && this.listeners[event]) {
      this.listeners[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in WebSocket event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Add event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  on(event, callback) {
    if (!this.listeners) {
      this.listeners = {};
    }
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  /**
   * Remove event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  off(event, callback) {
    if (this.listeners && this.listeners[event]) {
      const index = this.listeners[event].indexOf(callback);
      if (index !== -1) {
        this.listeners[event].splice(index, 1);
      }
    }
  }
}

module.exports = WebSocketServer;