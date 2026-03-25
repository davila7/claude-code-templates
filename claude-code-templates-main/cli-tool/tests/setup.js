/**
 * Jest Test Setup
 * Global configuration and utilities for all tests
 */

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// Mock WebSocket for frontend tests
global.WebSocket = class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = 1; // OPEN
    this.CONNECTING = 0;
    this.OPEN = 1;
    this.CLOSING = 2;
    this.CLOSED = 3;
    
    // Simulate async connection
    setTimeout(() => {
      if (this.onopen) this.onopen({});
    }, 0);
  }
  
  send(data) {
    // Mock send
  }
  
  close(code, reason) {
    this.readyState = 3; // CLOSED
    if (this.onclose) this.onclose({ code, reason });
  }
  
  addEventListener(type, callback) {
    this[`on${type}`] = callback;
  }
  
  removeEventListener(type, callback) {
    this[`on${type}`] = null;
  }
};

// Mock Notification API
global.Notification = class MockNotification {
  constructor(title, options) {
    this.title = title;
    this.options = options;
  }
  
  static requestPermission() {
    return Promise.resolve('granted');
  }
  
  static get permission() {
    return 'granted';
  }
};

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.sessionStorage = sessionStorageMock;

// Mock document for frontend tests
global.document = {
  createElement: jest.fn(() => ({
    click: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    setAttribute: jest.fn(),
    style: {},
    href: '',
    download: ''
  })),
  getElementById: jest.fn(),
  querySelector: jest.fn(),
  querySelectorAll: jest.fn(() => []),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  body: {
    appendChild: jest.fn(),
    removeChild: jest.fn(),
  },
  location: {
    protocol: 'http:',
    host: 'localhost:3333',
    hostname: 'localhost',
    port: '3333'
  },
  hidden: false,
  visibilityState: 'visible'
};

// Mock window for frontend tests
global.window = {
  location: global.document.location,
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  localStorage: localStorageMock,
  sessionStorage: sessionStorageMock,
  WebSocket: global.WebSocket,
  Notification: global.Notification
};

// Test utilities
global.testUtils = {
  /**
   * Create a mock conversation object
   */
  createMockConversation: (overrides = {}) => ({
    id: 'conv_123',
    filename: 'conversation.jsonl',
    project: 'test-project',
    status: 'active',
    tokens: 1500,
    messages: 5,
    lastModified: new Date().toISOString(),
    filePath: '/path/to/conversation.jsonl',
    fileSize: 2048,
    ...overrides
  }),
  
  /**
   * Create mock conversation data
   */
  createMockConversationData: (count = 3) => {
    const conversations = [];
    for (let i = 0; i < count; i++) {
      conversations.push(global.testUtils.createMockConversation({
        id: `conv_${i + 1}`,
        filename: `conversation_${i + 1}.jsonl`,
        status: i === 0 ? 'active' : 'idle'
      }));
    }
    return {
      conversations,
      summary: {
        totalConversations: count,
        activeConversations: 1,
        totalTokens: count * 1500,
        avgTokensPerConversation: 1500
      }
    };
  },
  
  /**
   * Create a mock WebSocket message
   */
  createMockWSMessage: (type, data = {}) => ({
    type,
    data,
    timestamp: Date.now(),
    server: 'Claude Code Analytics'
  }),
  
  /**
   * Wait for async operations
   */
  waitFor: (ms = 0) => new Promise(resolve => setTimeout(resolve, ms)),
  
  /**
   * Mock file system operations
   */
  mockFs: {
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
    writeFileSync: jest.fn(),
    stat: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
  }
};

// Increase timeout for integration tests
jest.setTimeout(30000);

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  global.console.log.mockClear();
  global.console.warn.mockClear();
  global.console.error.mockClear();
});