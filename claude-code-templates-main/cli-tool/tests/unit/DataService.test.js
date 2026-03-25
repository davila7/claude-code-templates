/**
 * Unit Tests for DataService
 * Tests API communication and caching functionality
 */

// Load the DataService class
const fs = require('fs');
const path = require('path');

// Load DataService from the actual file
const DataServicePath = path.join(__dirname, '../../src/analytics-web/services/DataService.js');
const DataServiceCode = fs.readFileSync(DataServicePath, 'utf8');

// Create a module-like environment
const moduleExports = {};
const module = { exports: moduleExports };

// Execute the DataService code in our test environment
eval(DataServiceCode);
const DataService = moduleExports.DataService || global.DataService;

describe('DataService', () => {
  let dataService;
  let mockWebSocketService;
  let mockFetch;

  beforeEach(() => {
    // Mock WebSocket service
    mockWebSocketService = {
      on: jest.fn(),
      subscribe: jest.fn().mockResolvedValue(true),
      isConnected: true,
      requestRefresh: jest.fn().mockResolvedValue(true),
      getStatus: jest.fn().mockReturnValue({ isConnected: true })
    };

    // Mock fetch
    mockFetch = jest.fn();
    global.fetch = mockFetch;

    dataService = new DataService(mockWebSocketService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete global.fetch;
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      const service = new DataService();
      
      expect(service.cache).toBeInstanceOf(Map);
      expect(service.eventListeners).toBeInstanceOf(Set);
      expect(service.baseURL).toBe('');
      expect(service.realTimeEnabled).toBe(false);
    });

    it('should setup WebSocket integration when provided', () => {
      expect(mockWebSocketService.on).toHaveBeenCalledWith('data_refresh', expect.any(Function));
      expect(mockWebSocketService.on).toHaveBeenCalledWith('conversation_state_change', expect.any(Function));
      expect(mockWebSocketService.on).toHaveBeenCalledWith('connected', expect.any(Function));
      expect(mockWebSocketService.on).toHaveBeenCalledWith('disconnected', expect.any(Function));
    });
  });

  describe('cachedFetch', () => {
    const mockEndpoint = '/api/test';
    const mockResponse = { data: 'test' };

    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse)
      });
    });

    it('should fetch data and cache it', async () => {
      const result = await dataService.cachedFetch(mockEndpoint);
      
      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(mockEndpoint, expect.objectContaining({
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      }));
      expect(dataService.cache.has(`${mockEndpoint}_${JSON.stringify({})}`)).toBe(true);
    });

    it('should return cached data when available and fresh', async () => {
      // First call - cache miss
      await dataService.cachedFetch(mockEndpoint);
      
      // Second call - cache hit
      const result = await dataService.cachedFetch(mockEndpoint);
      
      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledTimes(1); // Only called once
    });

    it('should refetch when cache is expired', async () => {
      // First call
      await dataService.cachedFetch(mockEndpoint, { cacheDuration: 100 });
      
      // Wait for cache to expire
      await testUtils.waitFor(150);
      
      // Second call - should refetch
      await dataService.cachedFetch(mockEndpoint, { cacheDuration: 100 });
      
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle fetch errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      
      await expect(dataService.cachedFetch(mockEndpoint)).rejects.toThrow('Network error');
    });

    it('should return stale cache on fetch error', async () => {
      // First successful call
      await dataService.cachedFetch(mockEndpoint);
      
      // Simulate network error on second call
      mockFetch.mockRejectedValue(new Error('Network error'));
      
      const result = await dataService.cachedFetch(mockEndpoint);
      
      expect(result).toEqual(mockResponse); // Should return cached data
    });

    it('should handle HTTP errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404
      });
      
      await expect(dataService.cachedFetch(mockEndpoint)).rejects.toThrow('HTTP error! status: 404');
    });
  });

  describe('API methods', () => {
    beforeEach(() => {
      jest.spyOn(dataService, 'cachedFetch').mockResolvedValue({ data: 'mock' });
    });

    it('should call correct endpoint for getConversations', async () => {
      await dataService.getConversations();
      
      expect(dataService.cachedFetch).toHaveBeenCalledWith('/api/data');
    });

    it('should call correct endpoint for getConversationStates', async () => {
      await dataService.getConversationStates();
      
      expect(dataService.cachedFetch).toHaveBeenCalledWith('/api/conversation-state', 
        expect.objectContaining({ cacheDuration: expect.any(Number) })
      );
    });

    it('should adjust cache duration based on real-time status', async () => {
      // With real-time enabled
      dataService.realTimeEnabled = true;
      await dataService.getConversationStates();
      
      expect(dataService.cachedFetch).toHaveBeenCalledWith('/api/conversation-state', 
        expect.objectContaining({ cacheDuration: 30000 })
      );
      
      // With real-time disabled
      dataService.realTimeEnabled = false;
      await dataService.getConversationStates();
      
      expect(dataService.cachedFetch).toHaveBeenCalledWith('/api/conversation-state', 
        expect.objectContaining({ cacheDuration: 5000 })
      );
    });

    it('should call correct endpoints for other methods', async () => {
      await dataService.getChartData();
      expect(dataService.cachedFetch).toHaveBeenCalledWith('/api/charts');
      
      await dataService.getSessionData();
      expect(dataService.cachedFetch).toHaveBeenCalledWith('/api/session/data');
      
      await dataService.getProjectStats();
      expect(dataService.cachedFetch).toHaveBeenCalledWith('/api/session/projects');
      
      await dataService.getSystemHealth();
      expect(dataService.cachedFetch).toHaveBeenCalledWith('/api/system/health');
    });
  });

  describe('WebSocket integration', () => {
    it('should enable real-time when WebSocket connects', () => {
      expect(dataService.realTimeEnabled).toBe(false);
      
      // Simulate WebSocket connection
      const connectedHandler = mockWebSocketService.on.mock.calls
        .find(call => call[0] === 'connected')[1];
      connectedHandler();
      
      expect(dataService.realTimeEnabled).toBe(true);
      expect(mockWebSocketService.subscribe).toHaveBeenCalledWith('data_updates');
      expect(mockWebSocketService.subscribe).toHaveBeenCalledWith('conversation_updates');
      expect(mockWebSocketService.subscribe).toHaveBeenCalledWith('system_updates');
    });

    it('should disable real-time when WebSocket disconnects', () => {
      dataService.realTimeEnabled = true;
      jest.spyOn(dataService, 'startFallbackPolling');
      
      // Simulate WebSocket disconnection
      const disconnectedHandler = mockWebSocketService.on.mock.calls
        .find(call => call[0] === 'disconnected')[1];
      disconnectedHandler();
      
      expect(dataService.realTimeEnabled).toBe(false);
      expect(dataService.startFallbackPolling).toHaveBeenCalled();
    });

    it('should handle real-time data refresh', () => {
      jest.spyOn(dataService, 'clearCacheEntry');
      jest.spyOn(dataService, 'notifyListeners');
      
      const testData = { conversations: [], summary: {} };
      
      // Simulate data refresh event
      const dataRefreshHandler = mockWebSocketService.on.mock.calls
        .find(call => call[0] === 'data_refresh')[1];
      dataRefreshHandler(testData);
      
      expect(dataService.clearCacheEntry).toHaveBeenCalledWith('/api/data');
      expect(dataService.clearCacheEntry).toHaveBeenCalledWith('/api/conversation-state');
      expect(dataService.notifyListeners).toHaveBeenCalledWith('data_refresh', testData);
    });

    it('should handle real-time state changes', () => {
      jest.spyOn(dataService, 'clearCacheEntry');
      jest.spyOn(dataService, 'notifyListeners');
      
      const stateData = { conversationId: 'conv_123', newState: 'active' };
      
      // Simulate state change event
      const stateChangeHandler = mockWebSocketService.on.mock.calls
        .find(call => call[0] === 'conversation_state_change')[1];
      stateChangeHandler(stateData);
      
      expect(dataService.clearCacheEntry).toHaveBeenCalledWith('/api/conversation-state');
      expect(dataService.notifyListeners).toHaveBeenCalledWith('conversation_state_change', stateData);
    });
  });

  describe('requestRefresh', () => {
    it('should use WebSocket refresh when available', async () => {
      dataService.realTimeEnabled = true;
      
      const result = await dataService.requestRefresh();
      
      expect(mockWebSocketService.requestRefresh).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should fallback to cache clearing when WebSocket unavailable', async () => {
      dataService.realTimeEnabled = false;
      jest.spyOn(dataService, 'clearCache');
      
      const result = await dataService.requestRefresh();
      
      expect(dataService.clearCache).toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it('should handle WebSocket request errors', async () => {
      dataService.realTimeEnabled = true;
      mockWebSocketService.requestRefresh.mockRejectedValue(new Error('WebSocket error'));
      jest.spyOn(dataService, 'clearCache');
      
      const result = await dataService.requestRefresh();
      
      expect(dataService.clearCache).toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });

  describe('event listeners', () => {
    it('should add and notify event listeners', () => {
      const mockCallback = jest.fn();
      
      dataService.addEventListener(mockCallback);
      expect(dataService.eventListeners.has(mockCallback)).toBe(true);
      
      dataService.notifyListeners('test_event', 'test_data');
      expect(mockCallback).toHaveBeenCalledWith('test_event', 'test_data');
    });

    it('should remove event listeners', () => {
      const mockCallback = jest.fn();
      
      dataService.addEventListener(mockCallback);
      dataService.removeEventListener(mockCallback);
      
      expect(dataService.eventListeners.has(mockCallback)).toBe(false);
    });

    it('should handle listener errors gracefully', () => {
      const errorCallback = jest.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });
      
      dataService.addEventListener(errorCallback);
      
      expect(() => {
        dataService.notifyListeners('test_event', 'test_data');
      }).not.toThrow();
    });
  });

  describe('cache management', () => {
    it('should clear entire cache', () => {
      dataService.cache.set('test_key', { data: 'test' });
      
      dataService.clearCache();
      
      expect(dataService.cache.size).toBe(0);
    });

    it('should clear specific cache entries', () => {
      dataService.cache.set('/api/data_{}', { data: 'test1' });
      dataService.cache.set('/api/other_{}', { data: 'test2' });
      
      dataService.clearCacheEntry('/api/data');
      
      expect(dataService.cache.has('/api/data_{}')).toBe(false);
      expect(dataService.cache.has('/api/other_{}')).toBe(true);
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', () => {
      dataService.cache.set('test1', { data: 'test' });
      dataService.cache.set('test2', { data: 'test' });
      
      const stats = dataService.getCacheStats();
      
      expect(stats).toMatchObject({
        size: 2,
        keys: expect.arrayContaining(['test1', 'test2']),
        listeners: 0,
        realTimeEnabled: expect.any(Boolean),
        webSocketConnected: true
      });
    });
  });

  describe('startPeriodicRefresh', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should skip polling when real-time is enabled', () => {
      dataService.realTimeEnabled = true;
      
      dataService.startPeriodicRefresh();
      
      expect(dataService.refreshInterval).toBeUndefined();
    });

    it('should start polling when real-time is disabled', () => {
      dataService.realTimeEnabled = false;
      jest.spyOn(dataService, 'getConversations').mockResolvedValue({});
      jest.spyOn(dataService, 'getConversationStates').mockResolvedValue({});
      
      dataService.startPeriodicRefresh(1000);
      
      expect(dataService.refreshInterval).toBeDefined();
      
      // Fast forward time
      jest.advanceTimersByTime(1000);
      
      expect(dataService.getConversations).toHaveBeenCalled();
      expect(dataService.getConversationStates).toHaveBeenCalled();
    });
  });
});