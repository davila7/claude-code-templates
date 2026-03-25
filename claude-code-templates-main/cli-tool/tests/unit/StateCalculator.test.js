/**
 * Unit Tests for StateCalculator
 * Tests conversation state detection logic
 */

const StateCalculator = require('../../src/analytics/core/StateCalculator');

describe('StateCalculator', () => {
  let stateCalculator;

  beforeEach(() => {
    stateCalculator = new StateCalculator();
  });

  describe('determineConversationStatus', () => {
    it('should return "active" for recent messages with user input', () => {
      const messages = [
        {
          role: 'user',
          timestamp: new Date(Date.now() - 30000), // 30 seconds ago
          content: 'Hello'
        },
        {
          role: 'assistant',
          timestamp: new Date(Date.now() - 20000), // 20 seconds ago
          content: 'Hi there!'
        }
      ];
      const lastModified = new Date(Date.now() - 10000); // 10 seconds ago

      const status = stateCalculator.determineConversationStatus(messages, lastModified);
      expect(status).toBe('active');
    });

    it('should return "waiting" for conversation with recent user message', () => {
      const messages = [
        {
          role: 'user',
          timestamp: new Date(Date.now() - 30000),
          content: 'Can you help me?'
        }
      ];
      const lastModified = new Date(Date.now() - 25000);

      const status = stateCalculator.determineConversationStatus(messages, lastModified);
      expect(status).toBe('waiting');
    });

    it('should return "idle" for old conversations', () => {
      const messages = [
        {
          role: 'user',
          timestamp: new Date(Date.now() - 3700000), // Over 1 hour ago
          content: 'Old message'
        }
      ];
      const lastModified = new Date(Date.now() - 3600000); // 1 hour ago

      const status = stateCalculator.determineConversationStatus(messages, lastModified);
      expect(status).toBe('idle');
    });

    it('should return "completed" for conversation ending with assistant', () => {
      const messages = [
        {
          role: 'user',
          timestamp: new Date(Date.now() - 600000), // 10 minutes ago
          content: 'Thanks for the help!'
        },
        {
          role: 'assistant',
          timestamp: new Date(Date.now() - 590000), // 9:50 minutes ago
          content: 'You\'re welcome! Let me know if you need anything else.'
        }
      ];
      const lastModified = new Date(Date.now() - 580000); // 9:40 minutes ago

      const status = stateCalculator.determineConversationStatus(messages, lastModified);
      expect(status).toBe('completed');
    });

    it('should handle empty messages array', () => {
      const status = stateCalculator.determineConversationStatus([], new Date());
      expect(status).toBe('idle');
    });

    it('should handle null/undefined inputs gracefully', () => {
      expect(stateCalculator.determineConversationStatus(null, new Date())).toBe('idle');
      expect(stateCalculator.determineConversationStatus([], null)).toBe('idle');
    });
  });

  describe('determineConversationState', () => {
    it('should return detailed state with running process', () => {
      const messages = [
        {
          role: 'user',
          timestamp: new Date(Date.now() - 30000),
          content: 'Start coding'
        }
      ];
      const lastModified = new Date(Date.now() - 20000);
      const runningProcess = { pid: 12345, command: 'node app.js' };

      const state = stateCalculator.determineConversationState(messages, lastModified, runningProcess);
      
      expect(state).toMatchObject({
        status: 'active',
        hasRunningProcess: true,
        lastActivity: expect.any(Date),
        messageCount: 1,
        lastUserMessage: expect.any(Date),
        lastAssistantMessage: null,
        timeSinceLastActivity: expect.any(Number),
        isRecent: true
      });
    });

    it('should detect conversation patterns correctly', () => {
      const messages = [
        {
          role: 'user',
          timestamp: new Date(Date.now() - 120000), // 2 minutes ago
          content: 'Can you help me debug this?'
        },
        {
          role: 'assistant',
          timestamp: new Date(Date.now() - 110000), // 1:50 minutes ago
          content: 'Sure! Let me take a look.'
        },
        {
          role: 'user',
          timestamp: new Date(Date.now() - 100000), // 1:40 minutes ago
          content: 'Here\'s the error message...'
        }
      ];
      const lastModified = new Date(Date.now() - 90000);

      const state = stateCalculator.determineConversationState(messages, lastModified);
      
      expect(state.status).toBe('waiting');
      expect(state.messageCount).toBe(3);
      expect(state.lastUserMessage).toBeInstanceOf(Date);
      expect(state.lastAssistantMessage).toBeInstanceOf(Date);
      expect(state.isRecent).toBe(true);
    });
  });

  describe('quickStateCalculation', () => {
    const mockConversation = {
      id: 'conv_123',
      filePath: '/path/to/conv.jsonl',
      lastModified: new Date(Date.now() - 60000).toISOString(),
      status: 'idle'
    };

    it('should update status when running process matches conversation', () => {
      const runningProcesses = [
        { pid: 123, command: 'node app.js', cwd: '/path/to' }
      ];

      const result = stateCalculator.quickStateCalculation(mockConversation, runningProcesses);
      
      expect(result.status).toBe('active');
      expect(result.hasRunningProcess).toBe(true);
      expect(result.runningProcess).toMatchObject({
        pid: 123,
        command: 'node app.js'
      });
    });

    it('should keep original status when no matching process', () => {
      const runningProcesses = [
        { pid: 456, command: 'other-app', cwd: '/other/path' }
      ];

      const result = stateCalculator.quickStateCalculation(mockConversation, runningProcesses);
      
      expect(result.status).toBe('idle');
      expect(result.hasRunningProcess).toBe(false);
    });

    it('should handle empty processes array', () => {
      const result = stateCalculator.quickStateCalculation(mockConversation, []);
      
      expect(result.status).toBe('idle');
      expect(result.hasRunningProcess).toBe(false);
    });
  });

  describe('isRecentActivity', () => {
    it('should return true for recent timestamps', () => {
      const recentTime = new Date(Date.now() - 30000); // 30 seconds ago
      expect(stateCalculator.isRecentActivity(recentTime)).toBe(true);
    });

    it('should return false for old timestamps', () => {
      const oldTime = new Date(Date.now() - 3700000); // Over 1 hour ago
      expect(stateCalculator.isRecentActivity(oldTime)).toBe(false);
    });

    it('should handle string timestamps', () => {
      const recentTimeStr = new Date(Date.now() - 30000).toISOString();
      expect(stateCalculator.isRecentActivity(recentTimeStr)).toBe(true);
    });

    it('should handle invalid timestamps', () => {
      expect(stateCalculator.isRecentActivity(null)).toBe(false);
      expect(stateCalculator.isRecentActivity('invalid')).toBe(false);
    });
  });

  describe('getTimeSinceLastActivity', () => {
    it('should calculate time difference correctly', () => {
      const timestamp = new Date(Date.now() - 60000); // 1 minute ago
      const timeSince = stateCalculator.getTimeSinceLastActivity(timestamp);
      
      expect(timeSince).toBeGreaterThan(59000); // At least 59 seconds
      expect(timeSince).toBeLessThan(65000); // Less than 65 seconds
    });

    it('should return 0 for invalid timestamps', () => {
      expect(stateCalculator.getTimeSinceLastActivity(null)).toBe(0);
      expect(stateCalculator.getTimeSinceLastActivity('invalid')).toBe(0);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle malformed message objects', () => {
      const messages = [
        { role: 'user' }, // Missing timestamp
        { timestamp: new Date() }, // Missing role
        null, // Null message
        undefined // Undefined message
      ];

      const status = stateCalculator.determineConversationStatus(messages, new Date());
      expect(status).toBe('idle'); // Should fallback gracefully
    });

    it('should handle timezone differences', () => {
      const utcTime = new Date().toISOString();
      const localTime = new Date();
      
      const status1 = stateCalculator.determineConversationStatus(
        [{ role: 'user', timestamp: utcTime, content: 'test' }],
        localTime
      );
      
      expect(['active', 'waiting', 'idle', 'completed']).toContain(status1);
    });
  });
});