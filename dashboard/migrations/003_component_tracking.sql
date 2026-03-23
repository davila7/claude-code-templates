-- Component Version Tracking & Update Notifications
-- Migration 003

-- Table: component_installations
-- Tracks which components users have installed via CLI
CREATE TABLE IF NOT EXISTS component_installations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_user_id TEXT NOT NULL,
    
    -- Component info
    component_type TEXT NOT NULL,  -- 'agents', 'commands', etc.
    component_path TEXT NOT NULL,  -- 'development-team/frontend-developer'
    component_name TEXT NOT NULL,
    component_category TEXT,
    
    -- Version tracking
    installed_version TEXT,        -- Hash or timestamp of content
    current_version TEXT,          -- Latest available version
    is_outdated BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    installed_at TIMESTAMP DEFAULT NOW(),
    last_checked_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP,
    
    -- Metadata
    install_source TEXT,           -- 'cli', 'web', 'api'
    install_command TEXT,          -- Full CLI command used
    
    CONSTRAINT unique_user_component UNIQUE (clerk_user_id, component_path)
);

-- Indexes for component_installations
CREATE INDEX IF NOT EXISTS idx_installations_user ON component_installations(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_installations_outdated ON component_installations(is_outdated) WHERE is_outdated = TRUE;
CREATE INDEX IF NOT EXISTS idx_installations_type ON component_installations(component_type);

-- Table: component_versions
-- Tracks the current version of each component in the catalog
CREATE TABLE IF NOT EXISTS component_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_path TEXT NOT NULL UNIQUE,
    component_type TEXT NOT NULL,
    
    -- Version info
    current_version TEXT NOT NULL,     -- Hash of current content
    previous_version TEXT,
    version_number TEXT,               -- Semantic version if available
    
    -- Change tracking
    last_updated_at TIMESTAMP DEFAULT NOW(),
    changelog TEXT,                    -- What changed
    breaking_changes BOOLEAN DEFAULT FALSE,
    
    -- Stats
    total_installations INTEGER DEFAULT 0,
    active_users INTEGER DEFAULT 0,
    
    CONSTRAINT unique_component_path UNIQUE (component_path)
);

-- Indexes for component_versions
CREATE INDEX IF NOT EXISTS idx_versions_type ON component_versions(component_type);
CREATE INDEX IF NOT EXISTS idx_versions_updated ON component_versions(last_updated_at DESC);

-- Table: update_notifications
-- Stores notifications about component updates for users
CREATE TABLE IF NOT EXISTS update_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_user_id TEXT NOT NULL,
    
    -- Notification content
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    notification_type TEXT DEFAULT 'component_update',  -- 'component_update', 'breaking_change', 'new_feature'
    
    -- Related data
    component_paths TEXT[],            -- Array of updated component paths
    total_updates INTEGER DEFAULT 0,
    
    -- Status
    is_read BOOLEAN DEFAULT FALSE,
    is_dismissed BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    read_at TIMESTAMP,
    dismissed_at TIMESTAMP,
    
    -- Actions
    action_url TEXT,                   -- Link to updates page
    action_label TEXT                  -- "View Updates"
);

-- Indexes for update_notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user ON update_notifications(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON update_notifications(clerk_user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON update_notifications(created_at DESC);
