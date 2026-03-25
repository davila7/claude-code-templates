/**
 * Unit Tests for WebSocketServer
 * Tests real-time communication server
 */

const WebSocketServer = require('../../src/analytics/notifications/WebSocketServer');
const WebSocket = require('ws');

// Mock the WebSocket library
jest.mock('ws');

describe('WebSocketServer', () => {
  let webSocketServer;
  let mockHttpServer;
  let mockWss;
  let mockWs;

  beforeEach(() => {
    // Mock HTTP server
    mockHttpServer = {
      listen: jest.fn(),
      close: jest.fn()
    };

    // Mock WebSocket server
    mockWss = {
      on: jest.fn(),
      close: jest.fn(),
      clients: new Set()
    };

    // Mock WebSocket connection
    mockWs = {
      on: jest.fn(),
      send: jest.fn(),
      close: jest.fn(),
      terminate: jest.fn(),
      ping: jest.fn(),
      readyState: WebSocket.OPEN
    };

    // Mock WebSocket.Server constructor
    WebSocket.Server.mockImplementation(() => mockWss);

    webSocketServer = new WebSocketServer(mockHttpServer);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      expect(webSocketServer.httpServer).toBe(mockHttpServer);
      expect(webSocketServer.options.port).toBe(3334);
      expect(webSocketServer.options.path).toBe('/ws');
      expect(webSocketServer.isRunning).toBe(false);
      expect(webSocketServer.clients).toBeInstanceOf(Map);
    });

    it('should accept custom options', () => {
      const customServer = new WebSocketServer(mockHttpServer, {
        port: 4444,
        path: '/websocket',
        heartbeatInterval: 60000
      });

      expect(customServer.options.port).toBe(4444);
      expect(customServer.options.path).toBe('/websocket');
      expect(customServer.options.heartbeatInterval).toBe(60000);
    });
  });

  describe('initialize', () => {
    it('should create WebSocket server with correct options', async () => {
      await webSocketServer.initialize();

      expect(WebSocket.Server).toHaveBeenCalledWith({
        server: mockHttpServer,
        path: '/ws',
        clientTracking: true
      });
      expect(webSocketServer.isRunning).toBe(true);
    });

    it('should setup event handlers', async () => {
      await webSocketServer.initialize();

      expect(mockWss.on).toHaveBeenCalledWith('connection', expect.any(Function));
      expect(mockWss.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockWss.on).toHaveBeenCalledWith('close', expect.any(Function));
    });

    it('should handle initialization errors', async () => {
      WebSocket.Server.mockImplementation(() => {
        throw new Error('Failed to create WebSocket server');
      });

      await expect(webSocketServer.initialize()).rejects.toThrow('Failed to create WebSocket server');
    });
  });

  describe('handleConnection', () => {
    beforeEach(async () => {
      await webSocketServer.initialize();
    });

    it('should register new client and setup handlers', () => {
      const mockRequest = {
        socket: { remoteAddress: '127.0.0.1' },
        headers: { 'user-agent': 'test-client' }
      };

      // Simulate connection event
      const connectionHandler = mockWss.on.mock.calls.find(call => call[0] === 'connection')[1];
      connectionHandler(mockWs, mockRequest);

      expect(webSocketServer.clients.size).toBe(1);
      expect(mockWs.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('pong', expect.any(Function));
    });

    it('should send welcome message to new client', () => {
      const mockRequest = {
        socket: { remoteAddress: '127.0.0.1' },
        headers: { 'user-agent': 'test-client' }
      };

      const connectionHandler = mockWss.on.mock.calls.find(call => call[0] === 'connection')[1];
      connectionHandler(mockWs, mockRequest);

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"connection"')
      );
    });
  });

  describe('handleClientMessage', () => {
    let clientId;

    beforeEach(async () => {
      await webSocketServer.initialize();
      
      // Add a mock client
      clientId = 'test_client_123';
      webSocketServer.clients.set(clientId, {
        id: clientId,
        ws: mockWs,
        subscriptions: new Set(),
        isAlive: true
      });
    });

    it('should handle subscribe message', () => {
      const subscribeMessage = JSON.stringify({
        type: 'subscribe',
        channel: 'conversation_updates'
      });

      webSocketServer.handleClientMessage(clientId, Buffer.from(subscribeMessage));

      const client = webSocketServer.clients.get(clientId);
      expect(client.subscriptions.has('conversation_updates')).toBe(true);
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"subscription_confirmed"')
      );
    });

    it('should handle unsubscribe message', () => {
      // First subscribe
      const client = webSocketServer.clients.get(clientId);
      client.subscriptions.add('conversation_updates');

      const unsubscribeMessage = JSON.stringify({
        type: 'unsubscribe',
        channel: 'conversation_updates'
      });

      webSocketServer.handleClientMessage(clientId, Buffer.from(unsubscribeMessage));

      expect(client.subscriptions.has('conversation_updates')).toBe(false);
    });

    it('should handle ping message', () => {
      const pingMessage = JSON.stringify({ type: 'ping' });

      webSocketServer.handleClientMessage(clientId, Buffer.from(pingMessage));

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"pong"')
      );
    });

    it('should handle malformed JSON gracefully', () => {
      const invalidMessage = 'invalid json{';

      expect(() => {
        webSocketServer.handleClientMessage(clientId, Buffer.from(invalidMessage));
      }).not.toThrow();
    });
  });

  describe('broadcast', () => {
    beforeEach(async () => {
      await webSocketServer.initialize();
      
      // Add mock clients
      webSocketServer.clients.set('client1', {
        id: 'client1',
        ws: { ...mockWs, readyState: WebSocket.OPEN },
        subscriptions: new Set(['conversation_updates'])
      });
      
      webSocketServer.clients.set('client2', {
        id: 'client2',
        ws: { ...mockWs, readyState: WebSocket.OPEN, send: jest.fn() },
        subscriptions: new Set(['data_updates'])
      });
    });

    it('should broadcast to all clients when no channel specified', () => {
      const message = { type: 'test_message', data: 'test' };

      webSocketServer.broadcast(message);

      expect(mockWs.send).toHaveBeenCalledTimes(2);
    });

    it('should broadcast only to subscribed clients when channel specified', () => {
      const message = { type: 'conversation_state_change', data: 'test' };

      webSocketServer.broadcast(message, 'conversation_updates');

      // Only client1 should receive the message (subscribed to conversation_updates)
      expect(mockWs.send).toHaveBeenCalledTimes(1);
    });

    it('should handle send errors gracefully', () => {
      const errorWs = {
        ...mockWs,
        send: jest.fn().mockImplementation(() => {
          throw new Error('Send failed');
        }),
        readyState: WebSocket.OPEN
      };

      webSocketServer.clients.set('error_client', {
        id: 'error_client',
        ws: errorWs,
        subscriptions: new Set()
      });

      const message = { type: 'test_message', data: 'test' };

      expect(() => {
        webSocketServer.broadcast(message);
      }).not.toThrow();

      // Error client should be removed
      expect(webSocketServer.clients.has('error_client')).toBe(false);
    });
  });

  describe('notification methods', () => {
    beforeEach(async () => {
      await webSocketServer.initialize();
      jest.spyOn(webSocketServer, 'broadcast');
    });

    it('should notify conversation state change', () => {
      webSocketServer.notifyConversationStateChange('conv_123', 'active', { project: 'test' });

      expect(webSocketServer.broadcast).toHaveBeenCalledWith(
        {
          type: 'conversation_state_change',
          data: {
            conversationId: 'conv_123',
            newState: 'active',
            project: 'test'
          }
        },
        'conversation_updates'
      );
    });

    it('should notify data refresh', () => {
      const testData = { conversations: [], summary: {} };
      
      webSocketServer.notifyDataRefresh(testData);

      expect(webSocketServer.broadcast).toHaveBeenCalledWith(
        {
          type: 'data_refresh',
          data: testData
        },
        'data_updates'
      );
    });

    it('should notify system status', () => {
      const status = { message: 'System healthy', level: 'info' };
      
      webSocketServer.notifySystemStatus(status);

      expect(webSocketServer.broadcast).toHaveBeenCalledWith(
        {
          type: 'system_status',
          data: status
        },
        'system_updates'
      );
    });
  });

  describe('heartbeat mechanism', () => {
    beforeEach(async () => {
      jest.useFakeTimers();
      await webSocketServer.initialize();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should start heartbeat on initialization', () => {
      expect(webSocketServer.heartbeatInterval).not.toBeNull();
    });

    it('should ping clients and remove unresponsive ones', () => {
      // Add responsive client
      const responsiveWs = { ...mockWs, ping: jest.fn() };
      webSocketServer.clients.set('responsive', {
        id: 'responsive',
        ws: responsiveWs,
        isAlive: true
      });

      // Add unresponsive client
      const unresponsiveWs = { ...mockWs, terminate: jest.fn() };
      webSocketServer.clients.set('unresponsive', {
        id: 'unresponsive',
        ws: unresponsiveWs,
        isAlive: false
      });

      // Trigger heartbeat
      jest.advanceTimersByTime(30000);

      expect(responsiveWs.ping).toHaveBeenCalled();
      expect(unresponsiveWs.terminate).toHaveBeenCalled();
      expect(webSocketServer.clients.has('unresponsive')).toBe(false);
    });
  });

  describe('getStats', () => {
    beforeEach(async () => {
      await webSocketServer.initialize();
    });

    it('should return server statistics', () => {
      // Add some mock clients
      webSocketServer.clients.set('client1', {
        id: 'client1',
        ip: '127.0.0.1',
        connectedAt: new Date(),
        subscriptions: new Set(['test']),
        isAlive: true
      });

      const stats = webSocketServer.getStats();

      expect(stats).toMatchObject({
        isRunning: true,
        clientCount: 1,
        queuedMessages: 0,
        clients: expect.arrayContaining([
          expect.objectContaining({
            id: 'client1',
            ip: '127.0.0.1',
            subscriptions: ['test'],
            isAlive: true
          })
        ])
      });
    });
  });

  describe('close', () => {
    beforeEach(async () => {
      await webSocketServer.initialize();
    });

    it('should close all connections and stop server', async () => {
      // Add a mock client
      webSocketServer.clients.set('client1', {
        id: 'client1',
        ws: mockWs
      });

      await webSocketServer.close();

      expect(mockWs.close).toHaveBeenCalledWith(1000, 'Server shutting down');
      expect(mockWss.close).toHaveBeenCalled();
      expect(webSocketServer.isRunning).toBe(false);
      expect(webSocketServer.clients.size).toBe(0);
    });
  });
});