/**
 * WebSocketService - Handles real-time communication with the server
 * Part of the modular frontend architecture for Phase 3
 */
class WebSocketService {
  constructor() {
    this.ws = null;
    this.url = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5; // Increase attempts for better reliability
    this.reconnectDelay = 1000;
    this.maxReconnectDelay = 30000;
    this.heartbeatInterval = null;
    this.heartbeatTimeout = null;
    
    this.eventListeners = new Map();
    this.subscriptions = new Set();
    this.messageQueue = [];
    this.autoReconnect = true; // Enable auto-reconnect for real-time updates
    
    // Message ID tracking for responses
    this.messageId = 0;
    this.pendingMessages = new Map();
  }

  /**
   * Connect to WebSocket server
   * @param {string} url - WebSocket URL (default: current host with /ws path)
   */
  connect(url = null) {
    if (this.isConnected) {
      console.log('🔌 WebSocket already connected');
      return Promise.resolve();
    }

    // Auto-detect WebSocket URL if not provided
    if (!url) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      this.url = `${protocol}//${host}/ws`;
    } else {
      this.url = url;
    }

    return new Promise((resolve, reject) => {
      try {
        console.log(`🔌 Connecting to WebSocket: ${this.url}`);
        this.ws = new WebSocket(this.url);
        
        this.ws.onopen = (event) => {
          this.handleOpen(event);
          resolve();
        };
        
        this.ws.onmessage = (event) => {
          this.handleMessage(event);
        };
        
        this.ws.onclose = (event) => {
          this.handleClose(event);
        };
        
        this.ws.onerror = (event) => {
          this.handleError(event);
          if (!this.isConnected) {
            reject(new Error(`WebSocket connection failed to ${this.url}`));
          }
        };
        
      } catch (error) {
        console.error('❌ Failed to create WebSocket connection:', error);
        reject(error);
      }
    });
  }

  /**
   * Handle WebSocket connection open
   * @param {Event} event - Open event
   */
  handleOpen(event) {
    console.log('✅ WebSocket connected');
    this.isConnected = true;
    this.reconnectAttempts = 0;
    
    // Start heartbeat
    this.startHeartbeat();
    
    // Process queued messages
    this.processMessageQueue();
    
    // Re-subscribe to channels
    this.resubscribeToChannels();
    
    // Emit connection event
    this.emit('connected', { event });
  }

  /**
   * Handle WebSocket message
   * @param {MessageEvent} event - Message event
   */
  handleMessage(event) {
    try {
      const data = JSON.parse(event.data);
      console.log('📨 WebSocket message received:', data.type);
      
      // Handle different message types
      switch (data.type) {
        case 'connection':
          this.handleConnectionMessage(data);
          break;
        case 'pong':
          this.handlePong(data);
          break;
        case 'conversation_state_change':
          this.handleConversationStateChange(data);
          break;
        case 'data_refresh':
          this.handleDataRefresh(data);
          break;
        case 'new_message':
          this.handleNewMessage(data);
          break;
        case 'system_status':
          this.handleSystemStatus(data);
          break;
        case 'file_change':
          this.handleFileChange(data);
          break;
        case 'process_change':
          this.handleProcessChange(data);
          break;
        case 'subscription_confirmed':
        case 'unsubscription_confirmed':
          this.handleSubscriptionConfirmation(data);
          break;
        default:
          // Check if it's a response to a pending message
          if (data.messageId && this.pendingMessages.has(data.messageId)) {
            this.handleMessageResponse(data);
          } else {
            this.emit('message', data);
          }
      }
      
    } catch (error) {
      console.error('❌ Error parsing WebSocket message:', error);
    }
  }

  /**
   * Handle WebSocket connection close
   * @param {CloseEvent} event - Close event
   */
  handleClose(event) {
    console.info('ℹ️ WebSocket disconnected (polling mode active)');
    this.isConnected = false;
    this.stopHeartbeat();
    
    // Emit disconnection event
    this.emit('disconnected', { event });
    
    // Auto-reconnect if enabled
    if (this.autoReconnect && event.code !== 1000) { // 1000 = normal closure
      this.scheduleReconnect();
    }
  }

  /**
   * Handle WebSocket error
   * @param {Event} event - Error event
   */
  handleError(event) {
    console.warn('⚠️ WebSocket connection failed (using polling mode instead)');
    this.emit('error', { event });
  }

  /**
   * Handle connection message
   * @param {Object} data - Message data
   */
  handleConnectionMessage(data) {
    console.log('🎉 WebSocket connection established:', data.data.clientId);
    this.clientId = data.data.clientId;
    this.emit('connection_established', data.data);
  }

  /**
   * Handle conversation state change
   * @param {Object} data - Message data
   */
  handleConversationStateChange(data) {
    console.log(`🔄 Conversation state changed: ${data.data.conversationId} → ${data.data.newState}`);
    this.emit('conversation_state_change', data.data);
  }

  /**
   * Handle data refresh
   * @param {Object} data - Message data
   */
  handleDataRefresh(data) {
    console.log('📊 Data refresh received');
    this.emit('data_refresh', data.data);
  }

  /**
   * Handle new message
   * @param {Object} data - Message data
   */
  handleNewMessage(data) {
    console.log(`📨 New message received for conversation: ${data.data.conversationId}`);
    this.emit('new_message', data.data);
  }

  /**
   * Handle system status
   * @param {Object} data - Message data
   */
  handleSystemStatus(data) {
    console.log('ℹ️ System status update:', data.data);
    this.emit('system_status', data.data);
  }

  /**
   * Handle file change notification
   * @param {Object} data - Message data
   */
  handleFileChange(data) {
    console.log('📁 File change detected:', data.data);
    this.emit('file_change', data.data);
  }

  /**
   * Handle process change notification
   * @param {Object} data - Message data
   */
  handleProcessChange(data) {
    console.log('⚡ Process change detected:', data.data);
    this.emit('process_change', data.data);
  }

  /**
   * Handle subscription confirmation
   * @param {Object} data - Message data
   */
  handleSubscriptionConfirmation(data) {
    console.log(`📡 Subscription ${data.type}:`, data.data.channel);
    this.emit('subscription_change', data.data);
  }

  /**
   * Handle pong response
   * @param {Object} data - Message data
   */
  handlePong(data) {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  /**
   * Handle response to pending message
   * @param {Object} data - Response data
   */
  handleMessageResponse(data) {
    const pending = this.pendingMessages.get(data.messageId);
    if (pending) {
      this.pendingMessages.delete(data.messageId);
      if (pending.resolve) {
        pending.resolve(data);
      }
    }
  }

  /**
   * Send message to server
   * @param {Object} message - Message to send
   * @param {boolean} expectResponse - Whether to expect a response
   * @returns {Promise} Promise that resolves with response (if expected)
   */
  send(message, expectResponse = false) {
    if (!this.isConnected) {
      // Queue message for later
      this.messageQueue.push({ message, expectResponse });
      console.log('📦 Message queued (not connected):', message.type);
      return Promise.resolve();
    }

    const messageWithId = {
      ...message,
      messageId: expectResponse ? this.generateMessageId() : undefined,
      timestamp: Date.now()
    };

    if (expectResponse) {
      return new Promise((resolve, reject) => {
        this.pendingMessages.set(messageWithId.messageId, { resolve, reject });
        
        // Set timeout for response
        setTimeout(() => {
          if (this.pendingMessages.has(messageWithId.messageId)) {
            this.pendingMessages.delete(messageWithId.messageId);
            reject(new Error('WebSocket message timeout'));
          }
        }, 10000); // 10 second timeout
        
        this.ws.send(JSON.stringify(messageWithId));
      });
    } else {
      this.ws.send(JSON.stringify(messageWithId));
      return Promise.resolve();
    }
  }

  /**
   * Subscribe to a channel
   * @param {string} channel - Channel name
   */
  subscribe(channel) {
    this.subscriptions.add(channel);
    return this.send({
      type: 'subscribe',
      channel
    });
  }

  /**
   * Unsubscribe from a channel
   * @param {string} channel - Channel name
   */
  unsubscribe(channel) {
    this.subscriptions.delete(channel);
    return this.send({
      type: 'unsubscribe',
      channel
    });
  }

  /**
   * Request data refresh
   */
  requestRefresh() {
    return this.send({
      type: 'refresh_request'
    });
  }

  /**
   * Send ping to server
   */
  ping() {
    return this.send({
      type: 'ping'
    });
  }

  /**
   * Add event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event).add(callback);
    
    // Return unsubscribe function
    return () => {
      const eventCallbacks = this.eventListeners.get(event);
      if (eventCallbacks) {
        eventCallbacks.delete(callback);
        if (eventCallbacks.size === 0) {
          this.eventListeners.delete(event);
        }
      }
    };
  }

  /**
   * Emit event to listeners
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  emit(event, data) {
    const eventCallbacks = this.eventListeners.get(event);
    if (eventCallbacks) {
      eventCallbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in WebSocket event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Process queued messages
   */
  processMessageQueue() {
    while (this.messageQueue.length > 0 && this.isConnected) {
      const { message, expectResponse } = this.messageQueue.shift();
      this.send(message, expectResponse);
    }
  }

  /**
   * Re-subscribe to channels after reconnection
   */
  resubscribeToChannels() {
    this.subscriptions.forEach(channel => {
      this.send({
        type: 'subscribe',
        channel
      });
    });
  }

  /**
   * Start heartbeat mechanism
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected) {
        this.ping();
        
        // Set timeout for pong response
        this.heartbeatTimeout = setTimeout(() => {
          console.warn('💔 Heartbeat timeout - closing connection');
          this.ws.close();
        }, 5000); // 5 second timeout for pong
      }
    }, 30000); // Send ping every 30 seconds
  }

  /**
   * Stop heartbeat mechanism
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  /**
   * Schedule reconnection attempt
   */
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached');
      this.emit('max_reconnects_reached');
      return;
    }

    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    );

    console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      this.reconnectAttempts++;
      this.connect(this.url).catch(() => {
        // Reconnection failed, will be handled by scheduleReconnect again
      });
    }, delay);
  }

  /**
   * Generate unique message ID
   * @returns {string} Message ID
   */
  generateMessageId() {
    return `msg_${++this.messageId}_${Date.now()}`;
  }

  /**
   * Disconnect WebSocket
   */
  disconnect() {
    this.autoReconnect = false;
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
    }
  }

  /**
   * Get connection status
   * @returns {Object} Connection status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      url: this.url,
      clientId: this.clientId,
      reconnectAttempts: this.reconnectAttempts,
      subscriptions: Array.from(this.subscriptions),
      queuedMessages: this.messageQueue.length,
      pendingMessages: this.pendingMessages.size,
      readyState: this.ws ? this.ws.readyState : WebSocket.CLOSED
    };
  }

  /**
   * Set auto-reconnect behavior
   * @param {boolean} enabled - Enable auto-reconnect
   */
  setAutoReconnect(enabled) {
    this.autoReconnect = enabled;
  }

  /**
   * Clear message queue
   */
  clearMessageQueue() {
    this.messageQueue = [];
    console.log('🗑️ Message queue cleared');
  }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WebSocketService;
}