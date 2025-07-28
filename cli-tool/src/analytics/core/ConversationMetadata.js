const fs = require('fs').promises;
const path = require('path');
const StreamingJSONLParser = require('../utils/StreamingParser');

/**
 * Lightweight metadata loader for conversations
 * Only extracts essential information without loading full conversation content
 */
class ConversationMetadata {
  constructor(filepath) {
    this.filepath = filepath;
    this.parser = new StreamingJSONLParser();
    this.metadata = this.parser.extractMetadata(filepath);
  }

  /**
   * Load metadata without parsing entire file
   * @returns {Promise<Object>} Conversation metadata
   */
  async load() {
    try {
      // Get file stats
      const stats = await this.parser.getFileStats(this.filepath);
      
      // Get last 5 messages for status detection (lightweight)
      const recentMessages = await this.parser.getLastNMessages(this.filepath, 5);
      
      // Count total messages
      const messageCount = await this.parser.countMessages(this.filepath);
      
      return {
        id: this.metadata.id,
        projectId: this.metadata.projectId,
        filepath: this.filepath,
        messageCount,
        lastModified: stats.modified,
        created: stats.created,
        size: stats.size,
        sizeInMB: stats.sizeInMB,
        lastActivity: this.detectLastActivity(recentMessages),
        status: this.detectStatus(recentMessages),
        participant: this.detectParticipant(recentMessages),
        // Important: Don't store messages in metadata!
        hasRecentActivity: this.isRecent(stats.modified)
      };
    } catch (error) {
      console.error(`Error loading metadata for ${this.filepath}:`, error);
      return {
        id: this.metadata.id,
        projectId: this.metadata.projectId,
        filepath: this.filepath,
        error: error.message,
        status: 'error'
      };
    }
  }

  /**
   * Detect last activity from recent messages
   * @param {Array} messages - Recent messages
   * @returns {Date|null} Last activity date
   */
  detectLastActivity(messages) {
    if (!messages || messages.length === 0) return null;
    
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.timestamp) {
      return new Date(lastMessage.timestamp);
    }
    
    return null;
  }

  /**
   * Detect conversation status from recent messages
   * @param {Array} messages - Recent messages
   * @returns {string} Conversation status
   */
  detectStatus(messages) {
    if (!messages || messages.length === 0) return 'empty';
    
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return 'unknown';
    
    // Check for active conversation indicators
    const now = new Date();
    const lastTimestamp = lastMessage.timestamp ? new Date(lastMessage.timestamp) : null;
    const timeDiff = lastTimestamp ? now - lastTimestamp : Infinity;
    
    // Less than 5 minutes = active
    if (timeDiff < 5 * 60 * 1000) {
      return 'active';
    }
    
    // Less than 1 hour = recent
    if (timeDiff < 60 * 60 * 1000) {
      return 'recent';
    }
    
    // Check message roles
    const lastRole = lastMessage.role || lastMessage.type;
    if (lastRole === 'human' || lastRole === 'user') {
      return 'awaiting_response';
    }
    
    if (lastRole === 'assistant') {
      return 'idle';
    }
    
    return 'inactive';
  }

  /**
   * Detect primary participant from messages
   * @param {Array} messages - Recent messages
   * @returns {string} Participant type
   */
  detectParticipant(messages) {
    if (!messages || messages.length === 0) return 'unknown';
    
    const roles = messages.map(m => m.role || m.type).filter(Boolean);
    const hasHuman = roles.includes('human') || roles.includes('user');
    const hasAssistant = roles.includes('assistant');
    
    if (hasHuman && hasAssistant) return 'conversation';
    if (hasHuman) return 'human';
    if (hasAssistant) return 'assistant';
    
    return 'unknown';
  }

  /**
   * Check if conversation is recent (within last 7 days)
   * @param {Date} date - Date to check
   * @returns {boolean} True if recent
   */
  isRecent(date) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return date > sevenDaysAgo;
  }
}

module.exports = ConversationMetadata;