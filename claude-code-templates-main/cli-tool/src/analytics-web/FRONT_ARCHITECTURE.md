# Analytics Web Architecture

## Current Architecture (Active)

### Main Components:
- **App.js** - Main application orchestrator with sidebar navigation
- **Sidebar.js** - Navigation sidebar component
- **DashboardPage.js** - Dashboard page with metrics and charts
- **AgentsPage.js** - Agents/conversations page

### Services:
- **WebSocketService.js** - Real-time communication
- **DataService.js** - API data fetching and caching
- **StateService.js** - Application state management

### Layout Structure:
```
App.js
├── Sidebar.js (navigation)
└── Page Components
    ├── DashboardPage.js
    └── AgentsPage.js
```

## Deprecated Architecture (Removed)

### Deprecated Files:
- **main.js** → `main.js.deprecated` - Old initialization system
- **Dashboard.js** → `Dashboard.js.deprecated` - Old monolithic dashboard

### Reason for Deprecation:
The old architecture used a single Dashboard.js component without navigation, while the new architecture uses App.js with proper routing and a sidebar navigation system.

## WebSocket Integration

The WebSocket system is fully functional and provides real-time updates for:
- Conversation state changes
- Data refresh events
- System status updates

## Loading State Fix

Fixed issue where loading states weren't clearing properly by:
1. Reordering DOM rendering before setting loading states
2. Adding proper error handling and fallback mechanisms
3. Ensuring `setLoading(false)` is called in finally blocks