/**
 * Unit Tests for StateService
 * Tests reactive state management functionality
 */

// Load the StateService class
const fs = require('fs');
const path = require('path');

// Load StateService from the actual file
const StateServicePath = path.join(__dirname, '../../src/analytics-web/services/StateService.js');
const StateServiceCode = fs.readFileSync(StateServicePath, 'utf8');

// Create a module-like environment
const moduleExports = {};
const module = { exports: moduleExports };

// Execute the StateService code in our test environment
eval(StateServiceCode);
const StateService = moduleExports.StateService || global.StateService;

describe('StateService', () => {
  let stateService;

  beforeEach(() => {
    stateService = new StateService();
  });

  describe('constructor', () => {
    it('should initialize with default state', () => {
      expect(stateService.state).toMatchObject({
        conversations: [],
        summary: {},
        chartData: {},
        selectedConversation: null,
        conversationStates: {},
        systemHealth: {},
        isLoading: false,
        error: null,
        lastUpdate: null
      });
      
      expect(stateService.subscribers).toBeInstanceOf(Set);
      expect(stateService.stateHistory).toEqual([]);
      expect(stateService.maxHistorySize).toBe(50);
    });
  });

  describe('subscribe/unsubscribe', () => {
    it('should add subscribers and return unsubscribe function', () => {
      const mockCallback = jest.fn();
      
      const unsubscribe = stateService.subscribe(mockCallback);
      
      expect(stateService.subscribers.has(mockCallback)).toBe(true);
      expect(typeof unsubscribe).toBe('function');
      
      // Test unsubscribe
      unsubscribe();
      expect(stateService.subscribers.has(mockCallback)).toBe(false);
    });

    it('should notify subscribers when state changes', () => {
      const mockCallback = jest.fn();
      stateService.subscribe(mockCallback);
      
      const newState = { isLoading: true };
      stateService.setState(newState, 'test_action');
      
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining(newState),
        'test_action',
        newState
      );
    });

    it('should handle multiple subscribers', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      stateService.subscribe(callback1);
      stateService.subscribe(callback2);
      
      stateService.setState({ isLoading: true });
      
      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('should handle subscriber errors gracefully', () => {
      const errorCallback = jest.fn().mockImplementation(() => {
        throw new Error('Subscriber error');
      });
      const normalCallback = jest.fn();
      
      stateService.subscribe(errorCallback);
      stateService.subscribe(normalCallback);
      
      expect(() => {
        stateService.setState({ test: true });
      }).not.toThrow();
      
      expect(normalCallback).toHaveBeenCalled();
    });
  });

  describe('getState and getStateProperty', () => {
    it('should return current state', () => {
      const state = stateService.getState();
      
      expect(state).toEqual(stateService.state);
      expect(state).not.toBe(stateService.state); // Should be a copy
    });

    it('should return specific state properties', () => {
      stateService.state.conversations = [{ id: 'test' }];
      
      expect(stateService.getStateProperty('conversations')).toEqual([{ id: 'test' }]);
      expect(stateService.getStateProperty('nonexistent')).toBeUndefined();
    });
  });

  describe('setState and setStateProperty', () => {
    it('should update state and preserve existing properties', () => {
      const initialState = stateService.getState();
      const newData = { isLoading: true, conversations: [{ id: 'test' }] };
      
      stateService.setState(newData);
      
      const updatedState = stateService.getState();
      expect(updatedState.isLoading).toBe(true);
      expect(updatedState.conversations).toEqual([{ id: 'test' }]);
      expect(updatedState.summary).toEqual(initialState.summary); // Preserved
      expect(updatedState.lastUpdate).toBeGreaterThan(0);
    });

    it('should update specific properties', () => {
      stateService.setStateProperty('isLoading', true, 'start_loading');
      
      expect(stateService.state.isLoading).toBe(true);
      expect(stateService.stateHistory[0].action).toBe('start_loading');
    });

    it('should save state to history', () => {
      const initialHistorySize = stateService.stateHistory.length;
      
      stateService.setState({ test: true }, 'test_action');
      
      expect(stateService.stateHistory).toHaveLength(initialHistorySize + 1);
      expect(stateService.stateHistory[0]).toMatchObject({
        action: 'test_action',
        timestamp: expect.any(Number)
      });
    });

    it('should limit history size', () => {
      stateService.maxHistorySize = 3;
      
      // Add more entries than max size
      for (let i = 0; i < 5; i++) {
        stateService.setState({ count: i }, `action_${i}`);
      }
      
      expect(stateService.stateHistory).toHaveLength(3);
      expect(stateService.stateHistory[0].action).toBe('action_2'); // Oldest preserved
      expect(stateService.stateHistory[2].action).toBe('action_4'); // Most recent
    });
  });

  describe('specific update methods', () => {
    it('should update conversations', () => {
      const conversations = [{ id: 'conv1' }, { id: 'conv2' }];
      const mockSubscriber = jest.fn();
      stateService.subscribe(mockSubscriber);
      
      stateService.updateConversations(conversations);
      
      expect(stateService.state.conversations).toEqual(conversations);
      expect(mockSubscriber).toHaveBeenCalledWith(
        expect.objectContaining({ conversations }),
        'update_conversations',
        { conversations }
      );
    });

    it('should update conversation states', () => {
      const states = { conv1: 'active', conv2: 'idle' };
      
      stateService.updateConversationStates(states);
      
      expect(stateService.state.conversationStates).toEqual(states);
    });

    it('should update summary', () => {
      const summary = { totalConversations: 5, activeConversations: 2 };
      
      stateService.updateSummary(summary);
      
      expect(stateService.state.summary).toEqual(summary);
    });

    it('should update chart data', () => {
      const chartData = { labels: ['A', 'B'], data: [1, 2] };
      
      stateService.updateChartData(chartData);
      
      expect(stateService.state.chartData).toEqual(chartData);
    });

    it('should set selected conversation', () => {
      const conversation = { id: 'conv1', title: 'Test Conversation' };
      
      stateService.setSelectedConversation(conversation);
      
      expect(stateService.state.selectedConversation).toEqual(conversation);
    });

    it('should set loading state', () => {
      stateService.setLoading(true);
      expect(stateService.state.isLoading).toBe(true);
      
      stateService.setLoading(false);
      expect(stateService.state.isLoading).toBe(false);
    });

    it('should set and clear error state', () => {
      const error = new Error('Test error');
      
      stateService.setError(error);
      expect(stateService.state.error).toBe(error);
      
      stateService.clearError();
      expect(stateService.state.error).toBeNull();
    });

    it('should handle string errors', () => {
      stateService.setError('String error');
      expect(stateService.state.error).toBe('String error');
    });

    it('should update system health', () => {
      const health = { cpu: 45, memory: 60, status: 'healthy' };
      
      stateService.updateSystemHealth(health);
      
      expect(stateService.state.systemHealth).toEqual(health);
    });
  });

  describe('notifyConversationStateChange', () => {
    beforeEach(() => {
      stateService.state.conversations = [
        { id: 'conv1', status: 'idle' },
        { id: 'conv2', status: 'active' }
      ];
      stateService.state.conversationStates = {
        conv1: 'idle',
        conv2: 'active'
      };
    });

    it('should update conversation state and conversation status', () => {
      stateService.notifyConversationStateChange('conv1', 'active');
      
      expect(stateService.state.conversationStates.conv1).toBe('active');
      expect(stateService.state.conversations[0].status).toBe('active');
    });

    it('should handle non-existent conversation gracefully', () => {
      expect(() => {
        stateService.notifyConversationStateChange('nonexistent', 'active');
      }).not.toThrow();
      
      expect(stateService.state.conversationStates.nonexistent).toBe('active');
    });
  });

  describe('conversation queries', () => {
    beforeEach(() => {
      stateService.state.conversations = [
        { id: 'conv1', status: 'active', title: 'Active Chat' },
        { id: 'conv2', status: 'idle', title: 'Idle Chat' },
        { id: 'conv3', status: 'active', title: 'Another Active' }
      ];
    });

    it('should get conversation by ID', () => {
      const conversation = stateService.getConversationById('conv2');
      
      expect(conversation).toEqual({
        id: 'conv2',
        status: 'idle',
        title: 'Idle Chat'
      });
    });

    it('should return null for non-existent conversation', () => {
      const conversation = stateService.getConversationById('nonexistent');
      
      expect(conversation).toBeNull();
    });

    it('should get conversations by status', () => {
      const activeConversations = stateService.getConversationsByStatus('active');
      
      expect(activeConversations).toHaveLength(2);
      expect(activeConversations.every(conv => conv.status === 'active')).toBe(true);
    });

    it('should return empty array for non-matching status', () => {
      const waitingConversations = stateService.getConversationsByStatus('waiting');
      
      expect(waitingConversations).toEqual([]);
    });
  });

  describe('state history management', () => {
    it('should return state history', () => {
      stateService.setState({ test1: true }, 'action1');
      stateService.setState({ test2: true }, 'action2');
      
      const history = stateService.getStateHistory();
      
      expect(history).toHaveLength(2);
      expect(history[0].action).toBe('action1');
      expect(history[1].action).toBe('action2');
      expect(history).not.toBe(stateService.stateHistory); // Should be a copy
    });

    it('should clear state history', () => {
      stateService.setState({ test: true });
      expect(stateService.stateHistory.length).toBeGreaterThan(0);
      
      stateService.clearStateHistory();
      
      expect(stateService.stateHistory).toHaveLength(0);
    });
  });

  describe('resetState', () => {
    it('should reset to initial state', () => {
      // Modify state
      stateService.setState({
        conversations: [{ id: 'test' }],
        isLoading: true,
        error: 'Some error'
      });
      
      // Reset
      stateService.resetState();
      
      expect(stateService.state).toMatchObject({
        conversations: [],
        summary: {},
        chartData: {},
        selectedConversation: null,
        conversationStates: {},
        systemHealth: {},
        isLoading: false,
        error: null,
        lastUpdate: null
      });
    });
  });

  describe('getStateStats', () => {
    it('should return state statistics', () => {
      const mockSubscriber = jest.fn();
      stateService.subscribe(mockSubscriber);
      stateService.setState({ conversations: [1, 2, 3] });
      stateService.setError('Test error');
      
      const stats = stateService.getStateStats();
      
      expect(stats).toMatchObject({
        subscribers: 1,
        historySize: 1,
        conversationsCount: 3,
        lastUpdate: expect.any(Number),
        hasError: true,
        isLoading: false
      });
    });

    it('should handle empty state', () => {
      const stats = stateService.getStateStats();
      
      expect(stats).toMatchObject({
        subscribers: 0,
        historySize: 0,
        conversationsCount: 0,
        lastUpdate: null,
        hasError: false,
        isLoading: false
      });
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle null/undefined state updates', () => {
      expect(() => {
        stateService.setState(null);
      }).not.toThrow();
      
      expect(() => {
        stateService.setState(undefined);
      }).not.toThrow();
    });

    it('should handle state updates with circular references', () => {
      const circularObj = { test: true };
      circularObj.self = circularObj;
      
      expect(() => {
        stateService.setState({ circular: circularObj });
      }).not.toThrow();
    });

    it('should maintain state integrity during concurrent updates', () => {
      const promises = [];
      
      // Simulate concurrent state updates
      for (let i = 0; i < 10; i++) {
        promises.push(
          Promise.resolve().then(() => {
            stateService.setState({ counter: i });
          })
        );
      }
      
      return Promise.all(promises).then(() => {
        expect(stateService.state.counter).toBeGreaterThanOrEqual(0);
        expect(stateService.state.counter).toBeLessThan(10);
      });
    });
  });
});