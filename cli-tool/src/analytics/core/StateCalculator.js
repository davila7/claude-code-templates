const chalk = require('chalk');

/**
 * StateCalculator - Handles all conversation state determination logic
 * Extracted from monolithic analytics.js for better maintainability
 */
class StateCalculator {
  constructor() {
    // Cache for process states to avoid repeated calculations
    this.processCache = new Map();
  }

  /**
   * Main state determination logic with process information
   * @param {Array} messages - Parsed conversation messages
   * @param {Date} lastModified - File last modification time
   * @param {Object} runningProcess - Active process information
   * @returns {string} Conversation state
   */
  determineConversationState(messages, lastModified, runningProcess = null) {
    const now = new Date();
    const fileTimeDiff = now - lastModified;
    const fileMinutesAgo = fileTimeDiff / (1000 * 60);

    // Enhanced detection: Look for real Claude Code activity indicators
    const claudeActivity = this.detectRealClaudeActivity(messages, lastModified);
    if (claudeActivity.isActive) {
      return claudeActivity.status;
    }

    // If there's very recent file activity (within 5 minutes), consider it active
    if (fileMinutesAgo < 5) {
      return 'Claude Code working...';
    }

    // If there's an active process, prioritize that
    if (runningProcess && runningProcess.hasActiveCommand) {
      // Check conversation flow first for immediate response
      if (messages.length > 0) {
        const sortedMessages = messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        const lastMessage = sortedMessages[sortedMessages.length - 1];
        const lastMessageTime = new Date(lastMessage.timestamp);
        const lastMessageMinutesAgo = (now - lastMessageTime) / (1000 * 60);
        
        if (lastMessage.role === 'user') {
          // User sent message - be more generous about active state
          if (lastMessageMinutesAgo < 3) {
            return 'Claude Code working...';
          } else if (lastMessageMinutesAgo < 10) {
            return 'Awaiting response...';
          } else {
            return 'Active session';
          }
        } else if (lastMessage.role === 'assistant') {
          // Claude responded - if there's an active process, still active
          if (lastMessageMinutesAgo < 10) {
            return 'Awaiting user input...';
          } else {
            return 'Active session';
          }
        }
      }
      
      // Default for active process - be more generous
      return 'Active session';
    }

    if (messages.length === 0) {
      return fileMinutesAgo < 5 ? 'Waiting for input...' : 'Idle';
    }

    // Sort messages by timestamp to get the actual conversation flow
    const sortedMessages = messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const lastMessage = sortedMessages[sortedMessages.length - 1];
    const lastMessageTime = new Date(lastMessage.timestamp);
    const lastMessageMinutesAgo = (now - lastMessageTime) / (1000 * 60);

    // More generous logic for active conversations
    if (lastMessage.role === 'user') {
      // User sent last message
      if (lastMessageMinutesAgo < 3) {
        return 'Claude Code working...';
      } else if (lastMessageMinutesAgo < 10) {
        return 'Awaiting response...';
      } else if (lastMessageMinutesAgo < 30) {
        return 'User typing...';
      } else {
        return 'Recently active';
      }
    } else if (lastMessage.role === 'assistant') {
      // Assistant sent last message
      if (lastMessageMinutesAgo < 10) {
        return 'Awaiting user input...';
      } else if (lastMessageMinutesAgo < 30) {
        return 'User typing...';
      } else {
        return 'Recently active';
      }
    }

    // Fallback states - be more generous about "active" state
    if (fileMinutesAgo < 10 || lastMessageMinutesAgo < 30) return 'Recently active';
    if (fileMinutesAgo < 60 || lastMessageMinutesAgo < 120) return 'Idle';
    return 'Inactive';
  }

  /**
   * Quick state calculation without file I/O for ultra-fast updates
   * @param {Object} conversation - Conversation object
   * @param {Array} runningProcesses - Array of active processes
   * @returns {string|null} Conversation state or null if not active
   */
  quickStateCalculation(conversation, runningProcesses) {
    // Check if there's an active process for this conversation
    const hasActiveProcess = runningProcesses.some(process => 
      process.workingDir.includes(conversation.project) ||
      process.command.includes(conversation.project) ||
      conversation.runningProcess // Already matched
    );
    
    if (!hasActiveProcess) {
      return null; // Not active, skip
    }
    
    // Simple heuristic based on file modification time - use broader ranges for stability
    const now = new Date();
    const timeDiff = (now - new Date(conversation.lastModified)) / 1000; // seconds
    
    // More stable state logic - fewer transitions
    if (timeDiff < 30) {
      return 'Claude Code working...';
    } else if (timeDiff < 300) { // 5 minutes
      return 'Awaiting user input...';
    } else {
      return 'User typing...';
    }
  }

  /**
   * Determine conversation status (active/recent/inactive)
   * @param {Array} messages - Parsed conversation messages
   * @param {Date} lastModified - File last modification time
   * @returns {string} Conversation status
   */
  determineConversationStatus(messages, lastModified) {
    const now = new Date();
    const timeDiff = now - lastModified;
    const minutesAgo = timeDiff / (1000 * 60);

    if (messages.length === 0) {
      return minutesAgo < 5 ? 'active' : 'inactive';
    }

    // Sort messages by timestamp
    const sortedMessages = messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const lastMessage = sortedMessages[sortedMessages.length - 1];
    const lastMessageTime = new Date(lastMessage.timestamp);
    const lastMessageMinutesAgo = (now - lastMessageTime) / (1000 * 60);

    // More balanced logic - active conversations and recent activity
    if (lastMessage.role === 'user' && lastMessageMinutesAgo < 3) {
      return 'active';
    } else if (lastMessage.role === 'assistant' && lastMessageMinutesAgo < 5) {
      return 'active';
    }

    // Use file modification time for recent activity
    if (minutesAgo < 5) return 'active';
    if (minutesAgo < 30) return 'recent';
    return 'inactive';
  }

  /**
   * Detect real Claude Code activity based on conversation patterns and file activity
   * @param {Array} messages - Conversation messages
   * @param {Date} lastModified - File last modification time
   * @returns {Object} Activity detection result
   */
  detectRealClaudeActivity(messages, lastModified) {
    const now = new Date();
    const fileMinutesAgo = (now - lastModified) / (1000 * 60);
    
    if (!messages || messages.length === 0) {
      return { isActive: false, status: 'No messages' };
    }
    
    // Sort messages by timestamp
    const sortedMessages = messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const lastMessage = sortedMessages[sortedMessages.length - 1];
    const lastMessageTime = new Date(lastMessage.timestamp);
    const messageMinutesAgo = (now - lastMessageTime) / (1000 * 60);
    
    // Real activity indicators:
    
    // 1. Very recent file modification (Claude Code just wrote to the conversation file)
    if (fileMinutesAgo < 1) {
      return { isActive: true, status: 'Claude Code working...' };
    }
    
    // 2. Recent user message with recent file activity (Claude is processing)
    if (lastMessage.role === 'user' && messageMinutesAgo < 5 && fileMinutesAgo < 10) {
      return { isActive: true, status: 'Claude Code working...' };
    }
    
    // 3. Recent assistant message with very recent file activity (might still be working)
    if (lastMessage.role === 'assistant' && messageMinutesAgo < 2 && fileMinutesAgo < 5) {
      return { isActive: true, status: 'Claude Code finishing...' };
    }
    
    // 4. Look for tool activity patterns (tools often indicate active sessions)
    const recentMessages = sortedMessages.slice(-3);
    const hasRecentTools = recentMessages.some(msg => 
      (Array.isArray(msg.content) && msg.content.some(block => block.type === 'tool_use')) ||
      (msg.toolResults && msg.toolResults.length > 0)
    );
    
    if (hasRecentTools && messageMinutesAgo < 10 && fileMinutesAgo < 15) {
      return { isActive: true, status: 'Active session' };
    }
    
    // 5. Rapid message exchange pattern (back-and-forth conversation)
    if (sortedMessages.length >= 2) {
      const lastTwoMessages = sortedMessages.slice(-2);
      const timeBetweenLast = Math.abs(
        new Date(lastTwoMessages[1].timestamp) - new Date(lastTwoMessages[0].timestamp)
      ) / (1000 * 60); // minutes
      
      if (timeBetweenLast < 5 && messageMinutesAgo < 15 && fileMinutesAgo < 20) {
        return { isActive: true, status: 'Active conversation' };
      }
    }
    
    return { isActive: false, status: null };
  }

  /**
   * Get CSS class for conversation state styling
   * @param {string} conversationState - The conversation state
   * @returns {string} CSS class name
   */
  getStateClass(conversationState) {
    if (conversationState.includes('working') || conversationState.includes('Working')) {
      return 'working';
    }
    if (conversationState.includes('typing') || conversationState.includes('Typing')) {
      return 'typing';
    }
    return '';
  }

  /**
   * Clear any cached state information
   */
  clearCache() {
    this.processCache.clear();
  }
}

module.exports = StateCalculator;