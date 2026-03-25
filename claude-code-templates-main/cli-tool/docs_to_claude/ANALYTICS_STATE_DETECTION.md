# Analytics State Detection System

## Overview
This document describes how the Claude Code Analytics Dashboard determines and displays conversation states in real-time.

## State Detection Flow

### 1. Backend State Calculation (`/api/conversation-state`)

The conversation state endpoint processes **ALL** conversations and calculates their current state:

#### API Endpoint: `/api/conversation-state`
- **Method**: GET
- **Response Format**: `{ activeStates: {conversationId: state}, timestamp: number }`
- **Update Frequency**: Called by frontend every 5-30 seconds

#### State Calculation Logic

For each conversation, the system:

1. **Checks for Running Process**:
   - If `conversation.runningProcess` exists, uses `StateCalculator.quickStateCalculation()`
   - Returns states like: "Claude Code working...", "Awaiting user input...", "User typing..."

2. **Falls back to Basic Heuristics** (for conversations without active processes):
   ```javascript
   const timeDiff = (now - new Date(conversation.lastModified)) / (1000 * 60); // minutes
   
   if (timeDiff < 5) {
     state = 'Recently active';
   } else if (timeDiff < 60) {
     state = 'Idle';
   } else if (timeDiff < 1440) { // 24 hours
     state = 'Inactive';
   } else {
     state = 'Old';
   }
   ```

### 2. StateCalculator Logic (`src/analytics/core/StateCalculator.js`)

The StateCalculator determines detailed conversation states based on:

#### Primary Factors:
- **Running Process**: Whether there's an active Claude Code process
- **Last Message Role**: 'user' vs 'assistant'
- **Message Timing**: Time since last message
- **File Activity**: File modification time
- **Process Activity**: Active commands in the process

#### State Categories:

**Active Process States**:
- `"Claude Code working..."` - User just sent message or recent file activity
- `"Awaiting user input..."` - Claude responded and waiting for user
- `"User typing..."` - User hasn't responded for a while
- `"Awaiting response..."` - User sent message but Claude hasn't responded

**Inactive Process States**:
- `"Recently active"` - Modified within 5 minutes
- `"Idle"` - Modified within 1 hour
- `"Inactive"` - Modified within 24 hours
- `"Old"` - Modified more than 24 hours ago

### 3. Frontend State Display (`AgentsPage.js`)

#### State Mapping
The frontend maps backend states to display labels and CSS classes:

```javascript
// Label mapping
const stateLabels = {
  'Claude Code working...': 'Working',
  'Awaiting user input...': 'Awaiting input',
  'User typing...': 'Typing',
  'Awaiting response...': 'Awaiting response',
  'Recently active': 'Recent',
  'Idle': 'Idle',
  'Inactive': 'Inactive',
  'Old': 'Old',
  'unknown': 'Unknown'
};

// CSS class mapping
const stateClasses = {
  'Claude Code working...': 'status-active',
  'Awaiting user input...': 'status-waiting',
  'User typing...': 'status-typing',
  'Awaiting response...': 'status-pending',
  'Recently active': 'status-recent',
  'Idle': 'status-idle',
  'Inactive': 'status-inactive',
  'Old': 'status-old',
  'unknown': 'status-unknown'
};
```

#### Visual Indicators
States are displayed in the conversation sidebar as:
- **Status Dot**: Colored circle indicator
- **Status Badge**: Text label with background color
- **CSS Classes**: For consistent styling across components

## Real-time Updates

### WebSocket Integration
- State changes are pushed via WebSocket when available
- Falls back to polling every 5-30 seconds when WebSocket unavailable

### Update Triggers
- File system changes (FileWatcher)
- Process detection updates
- Periodic refresh intervals

## Troubleshooting

### Common Issues

1. **States showing as "unknown"**:
   - Check if `/api/conversation-state` is returning data
   - Verify conversation IDs match between API and frontend
   - Ensure StateCalculator is processing all conversations

2. **States not updating in real-time**:
   - Check WebSocket connection in browser dev tools
   - Verify FileWatcher is detecting changes
   - Check for polling fallback activation

3. **Incorrect state calculations**:
   - Review StateCalculator logic for edge cases
   - Check conversation file modification times
   - Verify process detection is working

### Debug Commands

```bash
# Test state endpoint
curl -s http://localhost:3333/api/conversation-state | jq .

# Check conversations count
curl -s "http://localhost:3333/api/conversations?page=0&limit=1" | jq '.pagination.totalCount'

# Monitor server logs for state calculation
# Look for: "🔍 Processing X conversations for state calculation"
```

## Configuration

### State Update Intervals
- **With WebSocket**: 30 seconds cache duration
- **Without WebSocket**: 5 seconds cache duration
- **File Watch**: Immediate updates when files change

### Performance Considerations
- StateCalculator uses caching to avoid repeated calculations
- Quick state calculation for active processes only
- Batch processing of all conversations in single API call

## Future Improvements

1. **Enhanced Process Detection**: Better correlation between conversations and running processes
2. **Message-Level Analysis**: Analyze message content for more accurate state detection
3. **User Activity Tracking**: Detect actual user typing vs idle time
4. **Custom State Rules**: Allow configuration of state calculation logic
5. **State History**: Track state changes over time for analytics

## Integration Points

### Files Involved
- `/src/analytics.js` - Main server and API endpoints
- `/src/analytics/core/StateCalculator.js` - Core state logic
- `/src/analytics-web/components/AgentsPage.js` - Frontend display
- `/src/analytics-web/services/DataService.js` - API communication
- `/src/analytics-web/index.html` - CSS styling

### Key Functions
- `StateCalculator.determineConversationState()` - Main state detection
- `StateCalculator.quickStateCalculation()` - Fast state for active processes
- `AgentsPage.getStateClass()` - CSS class mapping
- `AgentsPage.getStateLabel()` - Display label mapping
- `DataService.getConversationStates()` - API communication

This system provides real-time visibility into Claude Code conversation states, helping users understand what's happening across all their active sessions.