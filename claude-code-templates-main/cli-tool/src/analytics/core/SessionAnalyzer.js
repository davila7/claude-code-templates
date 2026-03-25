/**
 * SessionAnalyzer - Extracts session timing, token usage, and plan information
 * Tracks Claude Max plan session limits and usage patterns
 */
const chalk = require('chalk');

class SessionAnalyzer {
  constructor() {
    // CORRECTED: Sessions don't have fixed duration - they reset at scheduled times
    // Reset hours: 1am, 7am, 1pm, 7pm local time
    this.RESET_HOURS = [1, 7, 13, 19];
    this.MONTHLY_SESSION_LIMIT = 50;
    
    // Plan-specific usage information (Claude uses complexity-based limits, not fixed message counts)
    this.PLAN_LIMITS = {
      'free': {
        name: 'Free Plan',
        estimatedMessagesPerSession: null,
        monthlyPrice: 0,
        hasSessionLimits: false,
        description: 'Daily usage limits apply'
      },
      'standard': {
        name: 'Pro Plan',
        estimatedMessagesPerSession: 45, // Rough estimate for ~200 sentence messages
        monthlyPrice: 20,
        hasSessionLimits: true,
        description: 'Usage based on message complexity, conversation length, and current capacity. Limits reset every 5 hours.'
      },
      'max': {
        name: 'Max Plan (5x)',
        estimatedMessagesPerSession: null, // 5x more than Pro, but still complexity-based
        monthlyPrice: 100,
        hasSessionLimits: true,
        description: '5x the usage of Pro plan. Complexity-based limits.'
      },
      'premium': {
        name: 'Max Plan (20x)',
        estimatedMessagesPerSession: null, // 20x more than Pro
        monthlyPrice: 200,
        hasSessionLimits: true,
        description: '20x the usage of Pro plan. Complexity-based limits.'
      }
    };
  }

  /**
   * Analyze all conversations to extract session information
   * @param {Array} conversations - Array of conversation objects with parsed messages
   * @param {Object} claudeSessionInfo - Real Claude session information from statsig files
   * @returns {Object} Session analysis data
   */
  analyzeSessionData(conversations, claudeSessionInfo = null) {
    let sessions, currentSession;
    
    if (claudeSessionInfo && claudeSessionInfo.hasSession) {
      // Use real Claude session information
      sessions = this.extractSessionsFromClaudeInfo(conversations, claudeSessionInfo);
      currentSession = this.getCurrentActiveSessionFromClaudeInfo(sessions, claudeSessionInfo);
    } else {
      // Fallback to old logic
      sessions = this.extractSessions(conversations);
      currentSession = this.getCurrentActiveSession(sessions);
    }
    
    const monthlyUsage = this.calculateMonthlyUsage(sessions);
    const userPlan = this.detectUserPlan(conversations);
    
    const limits = this.PLAN_LIMITS[userPlan.planType] || this.PLAN_LIMITS['standard'];
    
    return {
      sessions,
      currentSession,
      monthlyUsage,
      userPlan,
      limits: limits,
      warnings: this.generateWarnings(currentSession, monthlyUsage, userPlan),
      claudeSessionInfo
    };
  }

  /**
   * Calculate message complexity weight based on token usage
   * Pro plan limits are based on message complexity, not just count
   * @param {Object} message - Message object
   * @returns {number} Message weight (1.0 = average message)
   */
  calculateMessageWeight(message) {
    // If we have token usage data, use it for more accurate weighting
    if (message.usage && message.usage.input_tokens) {
      // Average user message is ~200 English sentences = ~3000-4000 tokens
      // But Claude Code messages tend to be shorter, so we use ~500 tokens as average
      const AVERAGE_MESSAGE_TOKENS = 500;
      const inputTokens = message.usage.input_tokens || 0;
      const cacheTokens = message.usage.cache_creation_input_tokens || 0;
      const totalTokens = inputTokens + cacheTokens;
      
      // Calculate weight based on token count relative to average
      const weight = Math.max(0.1, totalTokens / AVERAGE_MESSAGE_TOKENS);
      
      // Cap maximum weight to prevent single very long messages from dominating
      return Math.min(weight, 5.0);
    }
    
    // Fallback: assume average message if no usage data
    return 1.0;
  }

  /**
   * Calculate session usage based on weighted messages
   * @param {Array} userMessages - Array of user messages
   * @returns {Object} Usage statistics
   */
  calculateSessionUsage(userMessages) {
    let totalWeight = 0;
    let shortMessages = 0;
    let longMessages = 0;
    
    userMessages.forEach(msg => {
      const weight = this.calculateMessageWeight(msg);
      totalWeight += weight;
      
      if (weight < 0.5) shortMessages++;
      else if (weight > 2.0) longMessages++;
    });
    
    return {
      messageCount: userMessages.length,
      totalWeight: totalWeight,
      shortMessages,
      longMessages,
      averageWeight: userMessages.length > 0 ? totalWeight / userMessages.length : 0
    };
  }

  /**
   * Generate estimated messages for session analysis when parsedMessages is not available
   * @param {Object} conversation - Conversation object
   * @returns {Array} Array of estimated message objects
   */
  generateEstimatedMessages(conversation) {
    const messages = [];
    const messageCount = conversation.messageCount || 0;
    const created = new Date(conversation.created);
    const lastModified = new Date(conversation.lastModified);
    
    if (messageCount === 0) return messages;
    
    // Estimate message distribution over time
    const timeDiff = lastModified - created;
    const timePerMessage = timeDiff / messageCount;
    
    // Generate alternating user/assistant messages
    for (let i = 0; i < messageCount; i++) {
      const timestamp = new Date(created.getTime() + (i * timePerMessage));
      const role = i % 2 === 0 ? 'user' : 'assistant';
      
      messages.push({
        timestamp: timestamp,
        role: role,
        usage: conversation.tokenUsage || null
      });
    }
    
    return messages;
  }

  /**
   * Extract 5-hour sliding window sessions from conversations
   * @param {Array} conversations - Array of conversation objects
   * @returns {Array} Array of 5-hour session windows
   */
  extractSessions(conversations) {
    // Collect all messages from all conversations with timestamps
    const allMessages = [];
    
    conversations.forEach(conversation => {
      // Skip conversations without message count or with zero messages
      if (!conversation.messageCount || conversation.messageCount === 0) {
        return;
      }

      // Generate estimated messages based on token usage and timestamps
      // This is a fallback when parsedMessages is not available
      const estimatedMessages = this.generateEstimatedMessages(conversation);

      estimatedMessages.forEach(message => {
        allMessages.push({
          timestamp: message.timestamp,
          role: message.role,
          conversationId: conversation.id,
          usage: message.usage
        });
      });
    });

    // Sort all messages by timestamp
    allMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Group messages into 5-hour sliding windows
    const sessions = [];
    const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;
    
    // Find first user message to start session tracking
    const firstUserMessage = allMessages.find(msg => msg.role === 'user');
    if (!firstUserMessage) return [];

    let currentWindowStart = new Date(firstUserMessage.timestamp);
    let sessionCounter = 1;
    
    // Create sessions based on 5-hour windows
    while (currentWindowStart <= new Date()) {
      const windowEnd = new Date(currentWindowStart.getTime() + FIVE_HOURS_MS);
      
      // Find messages within this 5-hour window
      const windowMessages = allMessages.filter(msg => {
        const msgTime = new Date(msg.timestamp);
        return msgTime >= currentWindowStart && msgTime < windowEnd;
      });

      if (windowMessages.length > 0) {
        const session = {
          id: `session_${sessionCounter}`,
          startTime: currentWindowStart,
          endTime: windowEnd,
          messages: windowMessages,
          tokenUsage: {
            input: 0,
            output: 0,
            cacheCreation: 0,
            cacheRead: 0,
            total: 0
          },
          conversations: [...new Set(windowMessages.map(msg => msg.conversationId))],
          serviceTier: null,
          isActive: false
        };

        // Calculate token usage for this window
        windowMessages.forEach(message => {
          if (message.usage) {
            session.tokenUsage.input += message.usage.input_tokens || 0;
            session.tokenUsage.output += message.usage.output_tokens || 0;
            session.tokenUsage.cacheCreation += message.usage.cache_creation_input_tokens || 0;
            session.tokenUsage.cacheRead += message.usage.cache_read_input_tokens || 0;
            session.serviceTier = message.usage.service_tier || session.serviceTier;
          }
        });
        
        session.tokenUsage.total = session.tokenUsage.input + session.tokenUsage.output + 
                                  session.tokenUsage.cacheCreation + session.tokenUsage.cacheRead;

        // Calculate additional properties
        const now = new Date();
        session.duration = windowEnd - currentWindowStart;
        // Only count USER messages for session limits (Claude Code only counts prompts, not responses)
        const userMessages = windowMessages.filter(msg => msg.role === 'user');
        
        // Calculate session usage with message complexity weighting
        const sessionUsage = this.calculateSessionUsage(userMessages);
        session.messageCount = sessionUsage.messageCount;
        session.messageWeight = sessionUsage.totalWeight;
        session.usageDetails = sessionUsage;
        session.conversationCount = session.conversations.length;
        
        // Session is active if current time is within this window
        session.isActive = now >= currentWindowStart && now < windowEnd;
        
        // Calculate time remaining in this window
        if (session.isActive) {
          session.timeRemaining = Math.max(0, windowEnd - now);
        } else {
          session.timeRemaining = 0;
        }
        
        session.actualDuration = session.duration;
        
        sessions.push(session);
        sessionCounter++;
      }

      // Move to next potential session start (look for next user message after current window)
      const nextUserMessage = allMessages.find(msg => 
        msg.role === 'user' && new Date(msg.timestamp) >= windowEnd
      );
      
      if (nextUserMessage) {
        currentWindowStart = new Date(nextUserMessage.timestamp);
      } else {
        break;
      }
    }

    // Sort by start time (most recent first)
    return sessions.sort((a, b) => b.startTime - a.startTime);
  }


  /**
   * Extract sessions based on real Claude session information
   * @param {Array} conversations - Array of conversation objects
   * @param {Object} claudeSessionInfo - Real Claude session information
   * @returns {Array} Array of session objects
   */
  extractSessionsFromClaudeInfo(conversations, claudeSessionInfo) {
    // Get all messages from all conversations
    const allMessages = [];
    
    conversations.forEach(conversation => {
      // Skip conversations without message count or with zero messages
      if (!conversation.messageCount || conversation.messageCount === 0) {
        return;
      }

      // Generate estimated messages based on token usage and timestamps
      // This is a fallback when parsedMessages is not available
      const estimatedMessages = this.generateEstimatedMessages(conversation);

      estimatedMessages.forEach(message => {
        allMessages.push({
          timestamp: message.timestamp,
          role: message.role,
          conversationId: conversation.id,
          usage: message.usage
        });
      });
    });

    // Sort all messages by timestamp
    allMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Create current session based on Claude's actual session window
    const sessionStartTime = new Date(claudeSessionInfo.startTime);
    const sessionEndTime = new Date(claudeSessionInfo.sessionLimit.nextResetTime);
    const now = new Date();
    
    // Find the first user message that occurred AT OR AFTER the Claude session started
    // This handles cases where a conversation was ongoing when Claude session reset
    const firstMessageAfterSessionStart = allMessages.find(msg => {
      const msgTime = new Date(msg.timestamp);
      return msg.role === 'user' && msgTime >= sessionStartTime;
    });
    
    let effectiveSessionStart = sessionStartTime;
    if (firstMessageAfterSessionStart) {
      effectiveSessionStart = new Date(firstMessageAfterSessionStart.timestamp);
    }
    
    // Filter messages that are within the current Claude session window AND after the effective session start
    const currentSessionMessages = allMessages.filter(msg => {
      const msgTime = new Date(msg.timestamp);
      return msgTime >= effectiveSessionStart && msgTime < sessionEndTime;
    });

    // If no estimated messages found in session window, check for active conversations by lastModified
    if (currentSessionMessages.length === 0) {
      const RECENT_ACTIVITY_THRESHOLD = 10 * 60 * 1000; // 10 minutes
      const now = new Date();
      
      // Find conversations with recent activity (lastModified within session timeframe)
      const activeConversations = conversations.filter(conversation => {
        if (!conversation.lastModified) return false;
        
        const lastModified = new Date(conversation.lastModified);
        const timeSinceModified = now - lastModified;
        
        // Consider conversation active if:
        // 1. Modified after session start, AND
        // 2. Recently modified (within threshold)
        return lastModified >= sessionStartTime && timeSinceModified < RECENT_ACTIVITY_THRESHOLD;
      });
      
      if (activeConversations.length === 0) {
        return [];
      }
      
      // Create messages for active conversations based on their real message count
      activeConversations.forEach(conversation => {
        const lastModified = new Date(conversation.lastModified);
        const messageCount = conversation.messageCount || 0;
        
        // Create messages based on real message count, distributing them over the session
        const sessionDuration = now - sessionStartTime;
        const timePerMessage = sessionDuration / messageCount;
        
        for (let i = 0; i < messageCount; i++) {
          // Distribute messages over the session timeline, alternating user/assistant
          const messageTime = new Date(sessionStartTime.getTime() + (i * timePerMessage));
          const role = i % 2 === 0 ? 'user' : 'assistant';
          
          currentSessionMessages.push({
            timestamp: messageTime,
            role: role,
            conversationId: conversation.id,
            usage: conversation.tokenUsage || null
          });
        }
      });
    }

    // Create the current session object
    const session = {
      id: `claude_session_${claudeSessionInfo.sessionId.substring(0, 8)}`,
      startTime: effectiveSessionStart,
      endTime: sessionEndTime,
      messages: currentSessionMessages,
      tokenUsage: {
        input: 0,
        output: 0,
        cacheCreation: 0,
        cacheRead: 0,
        total: 0
      },
      conversations: [...new Set(currentSessionMessages.map(msg => msg.conversationId))],
      serviceTier: null,
      isActive: now >= sessionStartTime && now < sessionEndTime && !claudeSessionInfo.estimatedTimeRemaining.isExpired
    };

    // Calculate token usage for this session
    currentSessionMessages.forEach(message => {
      if (message.usage) {
        session.tokenUsage.input += message.usage.input_tokens || 0;
        session.tokenUsage.output += message.usage.output_tokens || 0;
        session.tokenUsage.cacheCreation += message.usage.cache_creation_input_tokens || 0;
        session.tokenUsage.cacheRead += message.usage.cache_read_input_tokens || 0;
        session.serviceTier = message.usage.service_tier || session.serviceTier;
      }
    });
    
    session.tokenUsage.total = session.tokenUsage.input + session.tokenUsage.output + 
                              session.tokenUsage.cacheCreation + session.tokenUsage.cacheRead;

    // Only count USER messages for session limits
    const userMessages = currentSessionMessages.filter(msg => msg.role === 'user');
    
    // Calculate session usage with message complexity weighting
    const sessionUsage = this.calculateSessionUsage(userMessages);
    session.messageCount = sessionUsage.messageCount;
    session.messageWeight = sessionUsage.totalWeight;
    session.usageDetails = sessionUsage;
    session.conversationCount = session.conversations.length;
    
    // Use Claude's actual time remaining
    session.timeRemaining = Math.max(0, claudeSessionInfo.estimatedTimeRemaining.ms);
    session.actualDuration = claudeSessionInfo.sessionDuration.ms;
    session.duration = claudeSessionInfo.sessionLimit.ms;
    
    return [session];
  }

  /**
   * Get current active session based on Claude session info
   * @param {Array} sessions - Array of session objects
   * @param {Object} claudeSessionInfo - Real Claude session information
   * @returns {Object|null} Current active session or null
   */
  getCurrentActiveSessionFromClaudeInfo(sessions, claudeSessionInfo) {
    if (sessions.length === 0) return null;
    
    const now = Date.now();
    const RECENT_ACTIVITY_THRESHOLD = 5 * 60 * 1000; // 5 minutes
    
    // Check if there's recent activity - sessions can be renewed at reset time
    const timeSinceLastUpdate = now - claudeSessionInfo.lastUpdate;
    const hasRecentActivity = timeSinceLastUpdate < RECENT_ACTIVITY_THRESHOLD;
    
    // Session is active if not expired OR has recent activity (session was renewed)
    if (!claudeSessionInfo.estimatedTimeRemaining.isExpired || hasRecentActivity) {
      return sessions[0];
    }
    
    return null;
  }

  /**
   * Get current active session
   * @param {Array} sessions - Array of session objects
   * @returns {Object|null} Current active session or null
   */
  getCurrentActiveSession(sessions) {
    return sessions.find(session => session.isActive) || null;
  }

  /**
   * Calculate monthly usage statistics
   * @param {Array} sessions - Array of session objects
   * @returns {Object} Monthly usage data
   */
  calculateMonthlyUsage(sessions) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const monthlySessions = sessions.filter(session => 
      session.startTime >= monthStart
    );

    const totalTokens = monthlySessions.reduce((sum, session) => 
      sum + session.tokenUsage.total, 0
    );

    const totalMessages = monthlySessions.reduce((sum, session) => 
      sum + session.messageCount, 0
    );

    return {
      sessionCount: monthlySessions.length,
      totalTokens,
      totalMessages,
      remainingSessions: Math.max(0, this.MONTHLY_SESSION_LIMIT - monthlySessions.length),
      averageTokensPerSession: monthlySessions.length > 0 ? 
        Math.round(totalTokens / monthlySessions.length) : 0,
      averageMessagesPerSession: monthlySessions.length > 0 ? 
        Math.round(totalMessages / monthlySessions.length) : 0
    };
  }

  /**
   * Detect user plan based on service tier information
   * @param {Array} conversations - Array of conversation objects
   * @returns {Object} User plan information
   */
  detectUserPlan(conversations) {
    const serviceTiers = new Set();
    let latestTier = null;
    let latestTimestamp = null;

    conversations.forEach(conversation => {
      if (!conversation.parsedMessages) return;

      conversation.parsedMessages.forEach(message => {
        if (message.usage && message.usage.service_tier) {
          serviceTiers.add(message.usage.service_tier);
          
          if (!latestTimestamp || message.timestamp > latestTimestamp) {
            latestTimestamp = message.timestamp;
            latestTier = message.usage.service_tier;
          }
        }
      });
    });

    // Map service tier to plan type - Pro plan users typically have 'standard' service tier
    // Default to Pro plan since most users have Pro plan
    const planMapping = {
      'free': 'free',           // Free Plan - daily limits
      'standard': 'standard',   // Pro Plan - 45 messages per 5-hour session
      'premium': 'premium',     // Max Plan 20x - 900 messages per 5-hour session
      'max': 'max'             // Max Plan 5x - 225 messages per 5-hour session
    };

    const detectedTier = latestTier || 'standard';
    const planType = planMapping[detectedTier] || 'standard';

    return {
      tier: detectedTier,
      planType: planType,
      allTiers: Array.from(serviceTiers),
      confidence: latestTier ? 'high' : 'low',
      lastDetected: latestTimestamp
    };
  }

  /**
   * Generate warnings based on current usage
   * @param {Object|null} currentSession - Current active session
   * @param {Object} monthlyUsage - Monthly usage data
   * @param {Object} userPlan - User plan information
   * @returns {Array} Array of warning objects
   */
  generateWarnings(currentSession, monthlyUsage, userPlan) {
    const warnings = [];
    const planLimits = this.PLAN_LIMITS[userPlan.planType] || this.PLAN_LIMITS['standard'];

    // Session-level warnings - only for time remaining and token usage
    if (currentSession) {
      // Time remaining warning (30 minutes before reset)
      if (currentSession.timeRemaining < 30 * 60 * 1000) { // 30 minutes
        warnings.push({
          type: 'session_time_warning',
          level: 'info',
          message: `Session resets in ${Math.round(currentSession.timeRemaining / 60000)} minutes`,
          timeRemaining: currentSession.timeRemaining
        });
      }

      // High token usage warning (if we have token data and it's exceptionally high)
      if (currentSession.tokenUsage && currentSession.tokenUsage.total > 1000000) { // 1M tokens
        warnings.push({
          type: 'high_token_usage',
          level: 'info',
          message: `High token usage in this session (${Math.round(currentSession.tokenUsage.total / 1000)}K tokens)`,
          tokenUsage: currentSession.tokenUsage.total
        });
      }

      // Note: We don't warn about message counts since Claude uses complexity-based limits
      // that can't be accurately predicted from simple message counts
    }

    // Monthly warnings (these limits are more predictable)
    const monthlyProgress = monthlyUsage.sessionCount / this.MONTHLY_SESSION_LIMIT;
    
    if (monthlyProgress >= 0.9) {
      warnings.push({
        type: 'monthly_limit_critical',
        level: 'error',
        message: `You're near your monthly session limit (${monthlyUsage.sessionCount}/${this.MONTHLY_SESSION_LIMIT})`,
        remainingSessions: monthlyUsage.remainingSessions
      });
    } else if (monthlyProgress >= 0.75) {
      warnings.push({
        type: 'monthly_limit_warning',
        level: 'warning',
        message: `75% of monthly sessions used (${monthlyUsage.sessionCount}/${this.MONTHLY_SESSION_LIMIT})`,
        remainingSessions: monthlyUsage.remainingSessions
      });
    }

    return warnings;
  }

  /**
   * Format time remaining for display
   * @param {number} milliseconds - Time in milliseconds
   * @returns {string} Formatted time string
   */
  formatTimeRemaining(milliseconds) {
    if (milliseconds <= 0) return '0m';
    
    const hours = Math.floor(milliseconds / (60 * 60 * 1000));
    const minutes = Math.floor((milliseconds % (60 * 60 * 1000)) / (60 * 1000));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  /**
   * Get session timer data for dashboard display
   * @param {Object} sessionData - Session analysis data
   * @returns {Object} Timer display data
   */
  getSessionTimerData(sessionData) {
    const { currentSession, monthlyUsage, limits, warnings } = sessionData;
    
    if (!currentSession) {
      return {
        hasActiveSession: false,
        message: 'No active session',
        nextSessionAvailable: true
      };
    }

    // Ensure limits exist, fallback to standard plan
    const planLimits = limits || this.PLAN_LIMITS['standard'];
    
    // Calculate only user messages (Claude only counts prompts toward limits)
    const userMessages = currentSession.messages ? currentSession.messages.filter(msg => msg.role === 'user') : [];
    const userMessageCount = userMessages.length;
    
    return {
      hasActiveSession: true,
      timeRemaining: currentSession.timeRemaining,
      timeRemainingFormatted: this.formatTimeRemaining(currentSession.timeRemaining),
      messagesUsed: userMessageCount,
      messagesEstimate: planLimits.estimatedMessagesPerSession, // Show as estimate, not limit
      tokensUsed: currentSession.tokenUsage.total,
      planName: planLimits.name,
      planDescription: planLimits.description,
      monthlySessionsUsed: monthlyUsage.sessionCount,
      monthlySessionsLimit: this.MONTHLY_SESSION_LIMIT,
      warnings: warnings.filter(w => w.type.includes('session')),
      willResetAt: currentSession.endTime,
      // Usage insights
      usageInsights: {
        tokensPerMessage: userMessageCount > 0 ? Math.round(currentSession.tokenUsage.total / userMessageCount) : 0,
        averageMessageComplexity: userMessageCount > 0 ? currentSession.messageWeight / userMessageCount : 0,
        conversationLength: currentSession.messages ? currentSession.messages.length : 0,
        sessionDuration: Date.now() - currentSession.startTime
      }
    };
  }
}

module.exports = SessionAnalyzer;