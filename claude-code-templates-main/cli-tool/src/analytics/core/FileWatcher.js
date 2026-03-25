const chalk = require('chalk');
const chokidar = require('chokidar');
const path = require('path');

/**
 * FileWatcher - Handles file system watching and automatic data refresh
 * Extracted from monolithic analytics.js for better maintainability
 */
class FileWatcher {
  constructor() {
    this.watchers = [];
    this.intervals = [];
    this.isActive = false;
    this.fileActivity = new Map(); // Track file activity for typing detection
    this.typingTimeout = new Map(); // Track typing timeouts
  }

  /**
   * Setup file watchers for real-time updates
   * @param {string} claudeDir - Path to Claude directory
   * @param {Function} dataRefreshCallback - Callback to refresh data
   * @param {Function} processRefreshCallback - Callback to refresh process data
   * @param {Object} dataCache - DataCache instance for invalidation
   */
  setupFileWatchers(claudeDir, dataRefreshCallback, processRefreshCallback, dataCache = null, conversationChangeCallback = null) {
    console.log(chalk.blue('👀 Setting up file watchers for real-time updates...'));

    this.claudeDir = claudeDir;
    this.dataRefreshCallback = dataRefreshCallback;
    this.processRefreshCallback = processRefreshCallback;
    this.dataCache = dataCache;
    this.conversationChangeCallback = conversationChangeCallback;

    this.setupConversationWatcher();
    this.setupProjectWatcher();
    this.setupPeriodicRefresh();
    
    this.isActive = true;
  }

  /**
   * Setup watcher for conversation files (.jsonl)
   */
  setupConversationWatcher() {
    const conversationWatcher = chokidar.watch([
      path.join(this.claudeDir, '**/*.jsonl')
    ], {
      persistent: true,
      ignoreInitial: true,
    });

    conversationWatcher.on('change', async (filePath) => {
      
      // Extract conversation ID from file path
      const conversationId = this.extractConversationId(filePath);
      
      // Enhanced file activity detection for typing
      await this.handleFileActivity(conversationId, filePath);
      
      // Invalidate cache for the changed file
      if (this.dataCache && filePath) {
        this.dataCache.invalidateFile(filePath);
      }
      
      // Notify specific conversation change if callback exists
      if (this.conversationChangeCallback && conversationId) {
        await this.conversationChangeCallback(conversationId, filePath);
      }
      
      await this.triggerDataRefresh();
    });

    conversationWatcher.on('add', async () => {
      await this.triggerDataRefresh();
    });

    this.watchers.push(conversationWatcher);
  }

  /**
   * Setup watcher for project directories
   */
  setupProjectWatcher() {
    const projectWatcher = chokidar.watch(this.claudeDir, {
      persistent: true,
      ignoreInitial: true,
      depth: 2, // Increased depth to catch subdirectories
    });

    projectWatcher.on('addDir', async () => {
      await this.triggerDataRefresh();
    });

    projectWatcher.on('change', async () => {
      await this.triggerDataRefresh();
    });

    this.watchers.push(projectWatcher);
  }

  /**
   * Setup periodic refresh intervals
   */
  setupPeriodicRefresh() {
    // Periodic refresh to catch any missed changes (reduced frequency)
    const dataRefreshInterval = setInterval(async () => {
      await this.triggerDataRefresh();
    }, 120000); // Every 2 minutes (reduced from 30 seconds)

    this.intervals.push(dataRefreshInterval);

    // Process updates for active processes (reduced frequency)
    const processRefreshInterval = setInterval(async () => {
      if (this.processRefreshCallback) {
        await this.processRefreshCallback();
      }
    }, 30000); // Every 30 seconds (reduced from 10 seconds)

    this.intervals.push(processRefreshInterval);
  }

  /**
   * Extract conversation ID from file path
   * @param {string} filePath - Path to the conversation file
   * @returns {string|null} Conversation ID or null if not found
   */
  extractConversationId(filePath) {
    try {
      // Handle different path formats:
      // /Users/user/.claude/projects/PROJECT_NAME/conversation.jsonl -> PROJECT_NAME
      // /Users/user/.claude/CONVERSATION_ID.jsonl -> CONVERSATION_ID
      
      const pathParts = filePath.split(path.sep);
      const fileName = pathParts[pathParts.length - 1];
      
      if (fileName === 'conversation.jsonl') {
        // Project-based conversation
        const projectName = pathParts[pathParts.length - 2];
        return projectName;
      } else if (fileName.endsWith('.jsonl')) {
        // Direct conversation file
        return fileName.replace('.jsonl', '');
      }
      
      return null;
    } catch (error) {
      console.error(chalk.red('Error extracting conversation ID:'), error);
      return null;
    }
  }

  /**
   * Handle file activity for typing detection
   * @param {string} conversationId - Conversation ID
   * @param {string} filePath - File path that changed
   */
  async handleFileActivity(conversationId, filePath) {
    if (!conversationId) return;

    const fs = require('fs');
    try {
      // Get file stats
      const stats = fs.statSync(filePath);
      const now = Date.now();
      const fileSize = stats.size;
      const mtime = stats.mtime.getTime();

      // Get previous activity
      const previousActivity = this.fileActivity.get(conversationId) || {
        lastSize: 0,
        lastMtime: 0,
        lastMessageCheck: 0
      };

      // Check if this is just a file touch/modification without significant content change
      const sizeChanged = fileSize !== previousActivity.lastSize;
      const timeChanged = mtime !== previousActivity.lastMtime;
      const timeSinceLastCheck = now - previousActivity.lastMessageCheck;

      // Update activity tracking
      this.fileActivity.set(conversationId, {
        lastSize: fileSize,
        lastMtime: mtime,
        lastMessageCheck: now
      });

      // If file changed but we haven't checked for complete messages recently
      if ((sizeChanged || timeChanged) && timeSinceLastCheck > 1000) {
        // Clear any existing typing timeout
        const existingTimeout = this.typingTimeout.get(conversationId);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
        }

        // Set a timeout to detect if this is typing activity
        const typingTimeout = setTimeout(async () => {
          // After delay, check if a complete message was added
          await this.checkForTypingActivity(conversationId, filePath);
        }, 2000); // Wait 2 seconds to see if a complete message appears

        this.typingTimeout.set(conversationId, typingTimeout);
      }
    } catch (error) {
      console.error(chalk.red(`Error handling file activity for ${conversationId}:`), error);
    }
  }

  /**
   * Check if file activity indicates user typing
   * @param {string} conversationId - Conversation ID
   * @param {string} filePath - File path to check
   */
  async checkForTypingActivity(conversationId, filePath) {
    try {
      // Parse the conversation to see if new complete messages were added
      const ConversationAnalyzer = require('./ConversationAnalyzer');
      const analyzer = new ConversationAnalyzer();
      const messages = await analyzer.getParsedConversation(filePath);

      if (messages && messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        const lastMessageTime = new Date(lastMessage.timestamp).getTime();
        const now = Date.now();
        const messageAge = now - lastMessageTime;

        // If the last message is very recent (< 5 seconds), it's probably a new complete message
        // If it's older, the file activity might indicate typing
        if (messageAge > 5000 && lastMessage.role === 'assistant') {
          // File activity after assistant message suggests user is typing
          
          // Send typing notification if we have access to notification manager
          if (this.notificationManager) {
            this.notificationManager.notifyConversationStateChange(conversationId, 'User typing...', {
              detectionMethod: 'file_activity',
              timestamp: new Date().toISOString()
            });
          }
        }
      }
    } catch (error) {
      console.error(chalk.red(`Error checking typing activity for ${conversationId}:`), error);
    }
  }

  /**
   * Set notification manager for state notifications
   * @param {Object} notificationManager - NotificationManager instance
   */
  setNotificationManager(notificationManager) {
    this.notificationManager = notificationManager;
  }

  /**
   * Trigger data refresh with error handling
   */
  async triggerDataRefresh() {
    try {
      if (this.dataRefreshCallback) {
        await this.dataRefreshCallback();
      }
    } catch (error) {
      console.error(chalk.red('Error during data refresh:'), error.message);
    }
  }

  /**
   * Add a custom watcher
   * @param {Object} watcher - Chokidar watcher instance
   */
  addWatcher(watcher) {
    this.watchers.push(watcher);
  }

  /**
   * Add a custom interval
   * @param {number} intervalId - Interval ID from setInterval
   */
  addInterval(intervalId) {
    this.intervals.push(intervalId);
  }

  /**
   * Pause all watchers and intervals
   */
  pause() {
    console.log(chalk.yellow('⏸️  Pausing file watchers...'));
    
    // Pause watchers (they will still exist but not trigger events)
    this.watchers.forEach(watcher => {
      if (watcher.unwatch) {
        // Temporarily remove all watched paths
        const watchedPaths = watcher.getWatched();
        Object.keys(watchedPaths).forEach(dir => {
          watchedPaths[dir].forEach(file => {
            watcher.unwatch(path.join(dir, file));
          });
        });
      }
    });

    this.isActive = false;
  }

  /**
   * Resume all watchers
   */
  resume() {
    if (!this.isActive && this.claudeDir) {
      console.log(chalk.green('▶️  Resuming file watchers...'));
      
      // Clear existing watchers
      this.stop();
      
      // Restart watchers
      this.setupFileWatchers(
        this.claudeDir, 
        this.dataRefreshCallback, 
        this.processRefreshCallback
      );
    }
  }

  /**
   * Stop and cleanup all watchers and intervals
   */
  stop() {
    console.log(chalk.red('🛑 Stopping file watchers...'));

    // Close all watchers
    this.watchers.forEach(watcher => {
      try {
        watcher.close();
      } catch (error) {
        console.warn(chalk.yellow('Warning: Error closing watcher:'), error.message);
      }
    });

    // Clear all intervals
    this.intervals.forEach(intervalId => {
      clearInterval(intervalId);
    });

    // Reset arrays
    this.watchers = [];
    this.intervals = [];
    this.isActive = false;
  }

  /**
   * Get watcher status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      isActive: this.isActive,
      watcherCount: this.watchers.length,
      intervalCount: this.intervals.length,
      watchedDir: this.claudeDir
    };
  }

  /**
   * Check if watchers are active
   * @returns {boolean} True if watchers are active
   */
  isWatching() {
    return this.isActive && this.watchers.length > 0;
  }

  /**
   * Get list of watched paths (for debugging)
   * @returns {Array} Array of watched paths
   */
  getWatchedPaths() {
    const watchedPaths = [];
    
    this.watchers.forEach(watcher => {
      if (watcher.getWatched) {
        const watched = watcher.getWatched();
        Object.keys(watched).forEach(dir => {
          watched[dir].forEach(file => {
            watchedPaths.push(path.join(dir, file));
          });
        });
      }
    });

    return watchedPaths;
  }

  /**
   * Set debounced refresh to avoid spam
   * @param {number} debounceMs - Debounce time in milliseconds
   */
  setDebounce(debounceMs = 200) {
    let debounceTimeout;
    const originalCallback = this.dataRefreshCallback;
    
    this.dataRefreshCallback = async (...args) => {
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(async () => {
        if (originalCallback) {
          await originalCallback(...args);
        }
      }, debounceMs);
    };
  }

  /**
   * Force immediate refresh
   */
  async forceRefresh() {
    await this.triggerDataRefresh();
    if (this.processRefreshCallback) {
      await this.processRefreshCallback();
    }
  }
}

module.exports = FileWatcher;