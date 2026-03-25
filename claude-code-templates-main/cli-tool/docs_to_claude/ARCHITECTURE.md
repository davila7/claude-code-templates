# Claude Code Templates - Modular Architecture

This document provides detailed technical documentation for the modular architecture implementation of the Claude Code Templates analytics dashboard.

## Overview

The analytics dashboard has been refactored from a monolithic architecture to a modern, scalable modular design. This transformation occurred in 4 phases:

1. **Phase 1**: Backend modularization (Core modules extraction)
2. **Phase 2**: Frontend modularization (Component-based architecture)  
3. **Phase 3**: WebSocket integration (Real-time communication)
4. **Phase 4**: Testing & Performance monitoring

## Directory Structure

```
src/
├── analytics.js                          # Main orchestration class
├── analytics/
│   ├── core/                            # Core business logic modules
│   │   ├── StateCalculator.js           # Conversation state detection
│   │   ├── ProcessDetector.js           # Running process detection
│   │   ├── ConversationAnalyzer.js      # Message analysis & parsing
│   │   └── FileWatcher.js               # File system monitoring
│   ├── data/
│   │   └── DataCache.js                 # Multi-level caching system
│   ├── notifications/
│   │   ├── WebSocketServer.js           # WebSocket communication
│   │   └── NotificationManager.js       # Event management
│   └── utils/
│       └── PerformanceMonitor.js        # Performance tracking
├── analytics-web/                       # Frontend modular components
│   ├── index.html                       # Main dashboard page
│   ├── assets/
│   │   ├── css/style.css               # Styling
│   │   └── js/main.js                  # Application entry point
│   ├── components/
│   │   ├── Dashboard.js                # Main dashboard component
│   │   ├── ConversationTable.js        # Conversation display
│   │   └── Charts.js                   # Data visualization
│   └── services/
│       ├── DataService.js              # API communication
│       ├── StateService.js             # State management
│       └── WebSocketService.js         # Real-time communication
└── tests/                               # Comprehensive test suite
    ├── unit/                           # Unit tests for modules
    ├── integration/                    # Integration tests
    └── e2e/                           # End-to-end tests
```

## Backend Architecture

### Core Modules

#### StateCalculator.js
Responsible for determining conversation states based on message analysis and process detection.

**Key Features:**
- Real-time state detection: `active`, `waiting`, `idle`, `completed`
- Message pattern analysis for tool usage and errors
- Process-aware state calculation
- Ultra-fast refresh for live updates

**API:**
```javascript
const stateCalculator = new StateCalculator();
const state = stateCalculator.determineConversationState(messages, lastModified, runningProcess);
const quickState = stateCalculator.quickStateCalculation(conversation, processes);
```

#### ProcessDetector.js
Manages detection and monitoring of running Claude Code processes.

**Key Features:**
- Cross-platform process detection (macOS, Linux, Windows)
- Process-conversation correlation
- Orphan process identification
- Efficient process monitoring

**API:**
```javascript
const detector = new ProcessDetector();
const processes = await detector.getRunningClaudeProcesses();
const enriched = await detector.enrichWithRunningProcesses(conversations, claudeDir, stateCalculator);
```

#### ConversationAnalyzer.js
Handles conversation file parsing, analysis, and data extraction.

**Key Features:**
- JSONL file parsing with error handling
- Token counting and message analysis
- Project detection and categorization
- Integrated caching for performance

**API:**
```javascript
const analyzer = new ConversationAnalyzer(claudeDir, dataCache);
const data = await analyzer.loadInitialData(stateCalculator, processDetector);
const conversations = await analyzer.analyzeConversations(files, stateCalculator);
```

#### FileWatcher.js
Provides real-time file system monitoring with efficient change detection.

**Key Features:**
- Chokidar-based file watching
- Intelligent refresh throttling
- Multiple watcher management
- Cache invalidation integration

**API:**
```javascript
const watcher = new FileWatcher();
watcher.setupFileWatchers(claudeDir, dataRefreshCallback, processRefreshCallback, dataCache);
watcher.pause(); // Pause monitoring
watcher.resume(); // Resume monitoring
```

### Data Layer

#### DataCache.js
Multi-level caching system with intelligent invalidation strategies.

**Cache Levels:**
1. **File Content Cache** - Raw file content with timestamp validation
2. **Parsed Data Cache** - Processed conversation data
3. **Computation Cache** - Expensive calculation results

**Key Features:**
- TTL-based expiration
- Dependency tracking
- Smart invalidation
- Memory usage optimization
- Performance metrics

**API:**
```javascript
const cache = new DataCache();
const content = await cache.getFileContent(filepath);
const parsed = await cache.getParsedData(key, parser);
const result = await cache.getComputationResult(key, computer);
cache.invalidateFile(filepath);
```

### Notification System

#### WebSocketServer.js
Real-time WebSocket communication with comprehensive client management.

**Key Features:**
- Client connection management
- Subscription-based messaging
- Heartbeat mechanism
- Message queuing for offline clients
- Performance monitoring integration

**API:**
```javascript
const wsServer = new WebSocketServer(httpServer, options, performanceMonitor);
await wsServer.initialize();
wsServer.broadcast(message, channel);
wsServer.notifyConversationStateChange(conversationId, newState, metadata);
```

#### NotificationManager.js
Event-driven notification system with subscription management.

**Key Features:**
- Event subscription management
- WebSocket integration
- Notification queuing
- Client filtering
- Error handling

**API:**
```javascript
const manager = new NotificationManager(webSocketServer);
manager.notifyDataRefresh(data, source);
manager.notifyConversationStateChange(id, oldState, newState, metadata);
manager.subscribe(event, callback);
```

### Performance Monitoring

#### PerformanceMonitor.js
Comprehensive performance tracking and system health monitoring.

**Monitoring Capabilities:**
- Memory usage tracking
- Request performance metrics
- Cache hit/miss ratios
- WebSocket connection metrics
- Error tracking and alerting
- System health status

**Key Features:**
- Express middleware integration
- Configurable thresholds
- Metric retention management
- Real-time statistics
- Export capabilities

**API:**
```javascript
const monitor = new PerformanceMonitor(options);
monitor.startTimer('operation');
monitor.endTimer('operation', metadata);
monitor.recordRequest(endpoint, duration, statusCode);
const stats = monitor.getStats(timeframe);
const middleware = monitor.createExpressMiddleware();
```

## Frontend Architecture

### Component-Based Design

#### Dashboard.js
Main orchestration component that manages the entire dashboard interface.

**Responsibilities:**
- Component initialization and lifecycle management
- Service integration (DataService, StateService, WebSocketService)
- Real-time data refresh coordination
- Error handling and recovery
- Performance optimization

**Key Features:**
- Modular component loading
- Service dependency injection
- Automatic reconnection handling
- Progressive enhancement

#### ConversationTable.js
Interactive table component for displaying conversation data.

**Key Features:**
- Real-time status updates
- Interactive sorting and filtering
- Responsive design
- Performance optimization for large datasets
- Export functionality

#### Charts.js
Data visualization component using Chart.js.

**Key Features:**
- Multiple chart types support
- Real-time data updates
- Responsive design
- Performance optimization
- Interactive features

### Service Layer

#### StateService.js
Reactive state management with observer pattern implementation.

**Key Features:**
- Centralized state management
- Subscriber notification system
- State history tracking
- Error state handling
- State persistence

**API:**
```javascript
const stateService = new StateService();
stateService.subscribe(callback);
stateService.setState(newState, action);
stateService.updateConversations(conversations);
const conversations = stateService.getConversationsByStatus('active');
```

#### DataService.js
API communication layer with intelligent caching and real-time integration.

**Key Features:**
- HTTP request management
- Response caching with TTL
- WebSocket integration
- Automatic retry logic
- Error handling
- Performance tracking

**API:**
```javascript
const dataService = new DataService(webSocketService);
const conversations = await dataService.getConversations();
const states = await dataService.getConversationStates();
const success = await dataService.requestRefresh();
```

#### WebSocketService.js
Real-time communication service with automatic reconnection.

**Key Features:**
- Connection management
- Subscription handling
- Automatic reconnection
- Message queuing
- Heartbeat monitoring
- Error recovery

**API:**
```javascript
const wsService = new WebSocketService();
await wsService.connect();
wsService.subscribe('data_updates');
wsService.on('conversation_state_change', handler);
wsService.requestRefresh();
```

## Real-time Communication

### WebSocket Protocol

The system uses WebSocket for real-time bidirectional communication between server and clients.

#### Message Types

**Client to Server:**
- `subscribe` - Subscribe to a channel
- `unsubscribe` - Unsubscribe from a channel
- `refresh_request` - Request data refresh
- `ping` - Heartbeat ping

**Server to Client:**
- `connection` - Connection established
- `data_refresh` - Data updated
- `conversation_state_change` - State changed
- `subscription_confirmed` - Subscription successful
- `pong` - Heartbeat response

#### Channels
- `data_updates` - General data updates
- `conversation_updates` - Conversation state changes
- `system_updates` - System health updates

### Fallback Mechanisms

When WebSocket connection is unavailable:
1. Automatic fallback to polling
2. Cache-based updates
3. Manual refresh options
4. Offline mode handling

## Performance Optimizations

### Caching Strategy

#### Multi-Level Caching
1. **Browser Cache** - Static assets and API responses
2. **Service Cache** - DataService request caching
3. **Backend Cache** - File content and parsed data
4. **Computation Cache** - Expensive calculations

#### Cache Invalidation
- File-based invalidation using modification timestamps
- WebSocket-triggered cache clearing
- TTL-based expiration
- Manual cache control

### Memory Management

#### Backend Optimizations
- Automatic metric cleanup
- Configurable memory thresholds
- Efficient data structures
- Process monitoring

#### Frontend Optimizations
- Component cleanup on unmount
- Event listener management
- Memory leak prevention
- Performance monitoring

### Real-time Efficiency

#### WebSocket Optimizations
- Connection pooling
- Message compression
- Efficient serialization
- Heartbeat optimization

#### Update Strategies
- Differential updates
- Batch processing
- Throttling and debouncing
- Smart refresh logic

## Testing Framework

### Test Categories

#### Unit Tests
- Individual module testing
- Mock dependencies
- Edge case coverage
- Performance benchmarks

#### Integration Tests
- End-to-end workflows
- Real data scenarios
- Error condition testing
- Performance testing

#### Performance Tests
- Load testing
- Memory usage validation
- Response time benchmarks
- Concurrent operation testing

### Test Coverage Requirements

- **Global Coverage**: 70% minimum
- **Core Modules**: 80% minimum
- **Critical Paths**: 90% minimum

### Testing Tools

- **Jest** - Test framework
- **WebSocket Testing** - Real-time communication testing
- **Performance Testing** - Load and stress testing
- **Integration Testing** - Complete system validation

## Deployment and Operations

### Environment Configuration

#### Development
- Hot reloading
- Debug logging
- Performance profiling
- Test data generation

#### Production
- Optimized builds
- Error tracking
- Performance monitoring
- Health checks

### Monitoring and Alerting

#### Health Checks
- System resource monitoring
- WebSocket connection health
- Cache performance metrics
- Error rate tracking

#### Performance Metrics
- Request response times
- Memory usage patterns
- Cache hit ratios
- WebSocket message throughput

## Future Enhancements

### Planned Features
- Enhanced caching strategies
- Advanced performance analytics
- Multi-user support
- API rate limiting
- Advanced error tracking

### Scalability Improvements
- Horizontal scaling support
- Database integration
- Advanced caching layers
- Load balancing

This modular architecture provides a solid foundation for future enhancements while maintaining high performance and reliability.