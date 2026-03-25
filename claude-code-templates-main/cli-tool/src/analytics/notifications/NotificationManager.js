/**
 * NotificationManager - Manages notifications and real-time updates
 * Part of the modular backend architecture for Phase 3
 */
const chalk = require('chalk');

class NotificationManager {
  constructor(webSocketServer) {
    this.webSocketServer = webSocketServer;
    this.notificationHistory = [];
    this.maxHistorySize = 1000;
    this.subscribers = new Map();
    this.throttleMap = new Map();
    this.defaultThrottleTime = 1000; // 1 second
  }

  /**
   * Initialize the notification manager
   */
  async initialize() {
    console.log(chalk.blue('📢 Initializing Notification Manager...'));
    
    // Setup WebSocket event listeners
    if (this.webSocketServer) {
      this.webSocketServer.on('refresh_requested', (data) => {
        this.handleRefreshRequest(data);
      });
    }
    
    console.log(chalk.green('✅ Notification Manager initialized'));
  }

  /**
   * Send conversation state change notification
   * @param {string} conversationId - Conversation ID
   * @param {string} oldState - Previous state
   * @param {string} newState - New state
   * @param {Object} metadata - Additional metadata
   */
  notifyConversationStateChange(conversationId, oldState, newState, metadata = {}) {
    const notification = {
      type: 'conversation_state_change',
      conversationId,
      oldState,
      newState,
      metadata,
      timestamp: new Date().toISOString(),
      id: this.generateNotificationId()
    };

    // Throttle rapid state changes for the same conversation
    const throttleKey = `state_${conversationId}`;
    if (this.isThrottled(throttleKey)) {
      console.log(chalk.yellow(`⏱️ Throttling state change for conversation ${conversationId}`));
      return;
    }

    this.addToHistory(notification);
    
    // Send via WebSocket
    if (this.webSocketServer) {
      this.webSocketServer.notifyConversationStateChange(conversationId, newState, {
        oldState,
        ...metadata
      });
    }

    // Send to local subscribers
    this.notifySubscribers('conversation_state_change', notification);

    console.log(chalk.green(`🔄 State change: ${conversationId} ${oldState} → ${newState}`));
  }

  /**
   * Send data refresh notification
   * @param {Object} data - Refreshed data
   * @param {string} source - Source of the refresh
   */
  notifyDataRefresh(data, source = 'system') {
    const notification = {
      type: 'data_refresh',
      data,
      source,
      timestamp: new Date().toISOString(),
      id: this.generateNotificationId()
    };

    // Throttle data refresh notifications
    if (this.isThrottled('data_refresh')) {
      console.log(chalk.yellow('⏱️ Throttling data refresh notification'));
      return;
    }

    this.addToHistory(notification);

    // Send via WebSocket
    if (this.webSocketServer) {
      this.webSocketServer.notifyDataRefresh(data);
    }

    // Send to local subscribers
    this.notifySubscribers('data_refresh', notification);

    console.log(chalk.green(`📊 Data refreshed (source: ${source})`));
  }

  /**
   * Send new message notification for real-time updates
   * @param {string} conversationId - Conversation ID
   * @param {Object} message - New message object
   * @param {Object} metadata - Additional metadata
   */
  notifyNewMessage(conversationId, message, metadata = {}) {
    const notification = {
      type: 'new_message',
      conversationId,
      message,
      metadata,
      timestamp: new Date().toISOString(),
      id: this.generateNotificationId()
    };

    // Don't throttle new message notifications - they should be immediate
    this.addToHistory(notification);

    // Send via WebSocket to conversation_updates channel
    if (this.webSocketServer) {
      this.webSocketServer.broadcast({
        type: 'new_message',
        data: {
          conversationId,
          message,
          metadata
        }
      }, 'conversation_updates');
    }

    // Send to local subscribers
    this.notifySubscribers('new_message', notification);

    console.log(chalk.blue(`📨 New message notification sent for conversation ${conversationId}`));
  }

  /**
   * Send system status notification
   * @param {Object} status - System status
   * @param {string} level - Notification level (info, warning, error)
   */
  notifySystemStatus(status, level = 'info') {
    const notification = {
      type: 'system_status',
      status,
      level,
      timestamp: new Date().toISOString(),
      id: this.generateNotificationId()
    };

    this.addToHistory(notification);

    // Send via WebSocket
    if (this.webSocketServer) {
      this.webSocketServer.notifySystemStatus({
        ...status,
        level
      });
    }

    // Send to local subscribers
    this.notifySubscribers('system_status', notification);

    const emoji = level === 'error' ? '❌' : level === 'warning' ? '⚠️' : 'ℹ️';
    console.log(chalk[level === 'error' ? 'red' : level === 'warning' ? 'yellow' : 'blue'](`${emoji} System status: ${status.message || JSON.stringify(status)}`));
  }

  /**
   * Send file change notification
   * @param {string} filePath - Path of changed file
   * @param {string} changeType - Type of change (created, modified, deleted)
   */
  notifyFileChange(filePath, changeType) {
    const notification = {
      type: 'file_change',
      filePath,
      changeType,
      timestamp: new Date().toISOString(),
      id: this.generateNotificationId()
    };

    // Throttle file change notifications for the same file
    const throttleKey = `file_${filePath}`;
    if (this.isThrottled(throttleKey, 2000)) { // 2 second throttle for files
      return;
    }

    this.addToHistory(notification);

    // Send via WebSocket
    if (this.webSocketServer) {
      this.webSocketServer.broadcast({
        type: 'file_change',
        data: {
          filePath,
          changeType
        }
      }, 'file_updates');
    }

    // Send to local subscribers
    this.notifySubscribers('file_change', notification);

    console.log(chalk.cyan(`📁 File ${changeType}: ${filePath}`));
  }

  /**
   * Send process change notification
   * @param {Array} processes - Current processes
   * @param {Array} changedProcesses - Processes that changed
   */
  notifyProcessChange(processes, changedProcesses) {
    const notification = {
      type: 'process_change',
      processes,
      changedProcesses,
      timestamp: new Date().toISOString(),
      id: this.generateNotificationId()
    };

    // Throttle process change notifications
    if (this.isThrottled('process_change', 5000)) { // 5 second throttle for processes
      return;
    }

    this.addToHistory(notification);

    // Send via WebSocket
    if (this.webSocketServer) {
      this.webSocketServer.broadcast({
        type: 'process_change',
        data: {
          processes,
          changedProcesses
        }
      }, 'process_updates');
    }

    // Send to local subscribers
    this.notifySubscribers('process_change', notification);

    if (changedProcesses.length > 0) {
      console.log(chalk.blue(`⚡ Process changes detected: ${changedProcesses.length} processes`));
    }
  }

  /**
   * Handle refresh request from WebSocket client
   * @param {Object} data - Request data
   */
  handleRefreshRequest(data) {
    console.log(chalk.blue(`🔄 Refresh requested by client: ${data.clientId}`));
    
    // Emit refresh event that analytics server can listen to
    this.notifySubscribers('refresh_requested', {
      clientId: data.clientId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Subscribe to notifications
   * @param {string} type - Notification type
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  subscribe(type, callback) {
    if (!this.subscribers.has(type)) {
      this.subscribers.set(type, new Set());
    }
    
    this.subscribers.get(type).add(callback);
    
    // Return unsubscribe function
    return () => {
      const typeSubscribers = this.subscribers.get(type);
      if (typeSubscribers) {
        typeSubscribers.delete(callback);
        if (typeSubscribers.size === 0) {
          this.subscribers.delete(type);
        }
      }
    };
  }

  /**
   * Notify all subscribers of a specific type
   * @param {string} type - Notification type
   * @param {Object} notification - Notification data
   */
  notifySubscribers(type, notification) {
    const typeSubscribers = this.subscribers.get(type);
    if (!typeSubscribers) return;

    typeSubscribers.forEach(callback => {
      try {
        callback(notification);
      } catch (error) {
        console.error(chalk.red(`Error in notification subscriber for ${type}:`), error);
      }
    });
  }

  /**
   * Check if a notification type is throttled
   * @param {string} key - Throttle key
   * @param {number} throttleTime - Throttle time in milliseconds
   * @returns {boolean} Is throttled
   */
  isThrottled(key, throttleTime = this.defaultThrottleTime) {
    const now = Date.now();
    const lastTime = this.throttleMap.get(key);
    
    if (lastTime && (now - lastTime) < throttleTime) {
      return true;
    }
    
    this.throttleMap.set(key, now);
    return false;
  }

  /**
   * Add notification to history
   * @param {Object} notification - Notification to add
   */
  addToHistory(notification) {
    this.notificationHistory.push(notification);
    
    // Keep history size manageable
    if (this.notificationHistory.length > this.maxHistorySize) {
      this.notificationHistory.shift();
    }
  }

  /**
   * Get notification history
   * @param {string} type - Filter by type (optional)
   * @param {number} limit - Limit number of results
   * @returns {Array} Notification history
   */
  getHistory(type = null, limit = 100) {
    let history = this.notificationHistory;
    
    if (type) {
      history = history.filter(notification => notification.type === type);
    }
    
    return history.slice(-limit);
  }

  /**
   * Clear notification history
   * @param {string} type - Clear specific type only (optional)
   */
  clearHistory(type = null) {
    if (type) {
      this.notificationHistory = this.notificationHistory.filter(
        notification => notification.type !== type
      );
    } else {
      this.notificationHistory = [];
    }
    
    console.log(chalk.yellow(`🗑️ Cleared notification history${type ? ` for type: ${type}` : ''}`));
  }

  /**
   * Generate unique notification ID
   * @returns {string} Notification ID
   */
  generateNotificationId() {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get notification statistics
   * @returns {Object} Notification statistics
   */
  getStats() {
    const typeCount = {};
    this.notificationHistory.forEach(notification => {
      typeCount[notification.type] = (typeCount[notification.type] || 0) + 1;
    });

    return {
      historySize: this.notificationHistory.length,
      maxHistorySize: this.maxHistorySize,
      subscriberCount: this.subscribers.size,
      typeCount,
      throttleMapSize: this.throttleMap.size,
      webSocketConnected: this.webSocketServer ? this.webSocketServer.isRunning : false,
      webSocketClients: this.webSocketServer ? this.webSocketServer.getStats().clientCount : 0
    };
  }

  /**
   * Create a batch notification for multiple changes
   * @param {Array} notifications - Array of notifications
   * @param {string} batchType - Type of batch
   */
  createBatch(notifications, batchType = 'batch') {
    if (notifications.length === 0) return;

    const batchNotification = {
      type: batchType,
      notifications,
      count: notifications.length,
      timestamp: new Date().toISOString(),
      id: this.generateNotificationId()
    };

    this.addToHistory(batchNotification);

    // Send via WebSocket
    if (this.webSocketServer) {
      this.webSocketServer.broadcast({
        type: batchType,
        data: {
          notifications,
          count: notifications.length
        }
      });
    }

    // Send to local subscribers
    this.notifySubscribers(batchType, batchNotification);

    console.log(chalk.green(`📦 Batch notification sent: ${notifications.length} items`));
  }

  /**
   * Cleanup throttle map periodically
   */
  cleanupThrottleMap() {
    const now = Date.now();
    const maxAge = this.defaultThrottleTime * 10; // 10x throttle time
    
    this.throttleMap.forEach((timestamp, key) => {
      if (now - timestamp > maxAge) {
        this.throttleMap.delete(key);
      }
    });
  }

  /**
   * Start periodic cleanup
   */
  startPeriodicCleanup() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupThrottleMap();
    }, 60000); // Clean up every minute
  }

  /**
   * Stop periodic cleanup
   */
  stopPeriodicCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Shutdown the notification manager
   */
  async shutdown() {
    console.log(chalk.yellow('📢 Shutting down Notification Manager...'));
    
    this.stopPeriodicCleanup();
    this.subscribers.clear();
    this.throttleMap.clear();
    
    console.log(chalk.green('✅ Notification Manager shut down'));
  }
}

module.exports = NotificationManager;