# Analytics Dashboard Optimization Changelog

## [1.0.0] - 2025-07-28

### Added

#### Memory Optimization Features
- **Backend Conversation Limit**: Limited to 100 most recent conversations to prevent OOM errors
  - File: `cli-tool/src/analytics/core/ConversationAnalyzer.js`
  - Reduces memory usage from 2-4GB to 700-800MB (75-80% reduction)
  
#### Dashboard Conversation Limit Dropdown
- **Location**: Dashboard homepage
- **Values**: 25, 50, 75, 100, 125, 150, 175, 200, All
- **Features**:
  - Persistent selection via localStorage
  - "Showing X out of Y conversations" display
  - Real-time metric recalculation
  - File: `cli-tool/src/analytics-web/components/DashboardPage.js`

#### Agents Page Conversation Limit Dropdown  
- **Location**: Agents/Chats page
- **Values**: 5, 10, 15, 20, 25, 30, 50, 100, All
- **Features**:
  - Prevents UI freezing with large datasets
  - Persistent selection via localStorage
  - File: `cli-tool/src/analytics-web/components/AgentsPage.js`

#### Folder Browser Modal
- **Purpose**: Allow Docker/remote users to select custom projects directory
- **Features**:
  - Modal overlay with folder navigation
  - Home, Root, and Parent directory shortcuts
  - Path persistence in localStorage
  - Real-time project dropdown updates
  - Fully opaque modal design (0% transparency)
  - Files: 
    - `cli-tool/src/analytics-web/components/AgentsPage.js`
    - `cli-tool/src/analytics-web/index.html` (CSS)

#### New API Endpoints
- **`/api/summary`**: Returns conversation metrics without loading all data
- **`/api/projects?path=/custom/path`**: Lists projects from specified directory
- **`/api/browse?path=/some/path`**: Browse filesystem directories with security
- File: `cli-tool/src/analytics.js`

#### Enhanced Agent Usage Display
- **Purpose**: Better visibility of agent usage in conversations
- **Features**:
  - Detects ALL agents used in each conversation via comprehensive pattern matching
  - Agents button always visible when agents were used (no hover required)
  - Shows count of different agents used (e.g., "4" in orange badge)
  - Tooltip displays names of all agents used (comma-separated list)
  - Enhanced visual styling with accent color and background changes
  - Dynamic updates when messages are loaded and agents are detected
  - Pattern recognition for various agent usage phrases
- **Technical Implementation**:
  - `detectAllAgentsInConversation()` method scans all messages for agent patterns
  - `updateAgentButtonForConversation()` method updates UI after message loading
  - Enhanced CSS with `:has()` selector for always-visible styling
  - Multiple regex patterns for comprehensive agent detection
- Files:
  - `cli-tool/src/analytics-web/components/AgentsPage.js` (agent detection & UI updates)
  - `cli-tool/src/analytics-web/index.html` (CSS styling for visual enhancements)

### Changed

#### Docker Configuration
- Optimized Dockerfile with Alpine Linux base image
- Added memory limits (2GB) to prevent system impact
- Added health checks for automatic recovery
- File: `Dockerfile`

#### CSS Variables
- Updated modal styles to use proper CSS variables
- Fixed transparency issues with modal dialog
- File: `cli-tool/src/analytics-web/index.html`

### Fixed

- Memory exhaustion with 100+ conversations
- Project dropdown not populating on initial load
- UI freezing when loading large conversation lists
- Modal appearing at bottom of page instead of centered overlay
- Modal dialog transparency issues

### Security

- Added path traversal protection in browse endpoint
- Validated all user inputs for file system operations
- Restricted browsing to safe directories only

### Performance

- Reduced server memory usage by 75-80%
- Improved page load times with lazy loading
- Eliminated UI freezing with pagination
- Optimized real-time updates via WebSocket

### Testing

- Added comprehensive Playwright test suite
- Created test files:
  - `test-all-features.js`
  - `test-folder-browser-simple.js`
  - `test-folder-browser-comprehensive.js`

## Code Comments Added

All changes include detailed comments with `FEATURE:` or `OPTIMIZATION:` prefixes for easy identification:

1. **Backend** (`cli-tool/src/analytics.js`):
   - `// FEATURE: Summary endpoint for dashboard conversation limit`
   - `// FEATURE: All projects API endpoint`
   - `// FEATURE: Folder browser endpoint for project path selection`

2. **Frontend** (`cli-tool/src/analytics-web/components/`):
   - `<!-- FEATURE: Conversation Limit Control for Dashboard -->`
   - `<!-- FEATURE: Folder Browser Modal for Projects Path Selection -->`
   - `// FEATURE: Dashboard conversation limit dropdown handler`
   - `// MEMORY OPTIMIZATION: Use paginated endpoint for limited data`

3. **Core** (`cli-tool/src/analytics/core/ConversationAnalyzer.js`):
   - `// MEMORY OPTIMIZATION: Limit conversation loading to prevent OOM errors`

4. **Styles** (`cli-tool/src/analytics-web/index.html`):
   - `/* FEATURE: Folder Browser Modal Styles */`

## Deployment Notes

- No breaking changes to existing deployments
- Backward compatible with existing data
- Settings persist across updates
- Graceful degradation for missing features

## Contributors

These optimizations address critical performance issues reported by users with large conversation histories and enhance the user experience for Docker deployments.