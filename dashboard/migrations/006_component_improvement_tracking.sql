-- Component Improvement System Database Schema
-- Tracks automated component improvements, testing, analytics, and optimization

-- Component improvement tracking
CREATE TABLE IF NOT EXISTS component_improvements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_path TEXT NOT NULL,
    component_name TEXT NOT NULL,
    component_type TEXT NOT NULL, -- 'agent', 'command', 'hook', 'mcp', 'setting', 'skill'
    improvement_type TEXT NOT NULL, -- 'research', 'optimization', 'security', 'performance', 'quality'
    priority TEXT NOT NULL, -- 'critical', 'high', 'medium', 'low'
    status TEXT NOT NULL, -- 'researched', 'in_progress', 'testing', 'review', 'merged', 'failed', 'cancelled'
    
    -- Research data
    research_report JSONB,
    research_agent TEXT DEFAULT 'component-researcher',
    research_timestamp TIMESTAMP,
    
    -- Improvement data
    improvements_planned JSONB, -- Array of planned improvements
    improvements_applied JSONB, -- Array of applied improvements
    improver_agent TEXT DEFAULT 'component-improver',
    improvement_timestamp TIMESTAMP,
    
    -- Testing data
    test_results JSONB,
    tester_agent TEXT DEFAULT 'component-tester',
    test_timestamp TIMESTAMP,
    
    -- Review data
    review_results JSONB,
    reviewer_agent TEXT DEFAULT 'component-reviewer',
    review_timestamp TIMESTAMP,
    
    -- PR tracking
    pr_number INTEGER,
    pr_url TEXT,
    pr_status TEXT, -- 'open', 'merged', 'closed'
    branch_name TEXT,
    
    -- Impact metrics
    impact_score FLOAT, -- 0-10 scale
    effort_estimate_hours INTEGER,
    token_savings INTEGER,
    cost_savings_per_invocation FLOAT,
    performance_improvement_percent FLOAT,
    
    -- Rollback support
    backup_path TEXT,
    rollback_commit TEXT,
    rollback_available BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    created_by TEXT DEFAULT 'automated-system',
    
    -- Indexes
    CONSTRAINT valid_status CHECK (status IN ('researched', 'in_progress', 'testing', 'review', 'merged', 'failed', 'cancelled')),
    CONSTRAINT valid_priority CHECK (priority IN ('critical', 'high', 'medium', 'low'))
);

CREATE INDEX IF NOT EXISTS idx_component_improvements_path ON component_improvements(component_path);
CREATE INDEX IF NOT EXISTS idx_component_improvements_status ON component_improvements(status);
CREATE INDEX IF NOT EXISTS idx_component_improvements_priority ON component_improvements(priority);
CREATE INDEX IF NOT EXISTS idx_component_improvements_type ON component_improvements(component_type);
CREATE INDEX IF NOT EXISTS idx_component_improvements_created ON component_improvements(created_at DESC);

-- Component analytics tracking
CREATE TABLE IF NOT EXISTS component_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_path TEXT NOT NULL,
    component_name TEXT NOT NULL,
    component_type TEXT NOT NULL,
    
    -- Metric data
    metric_name TEXT NOT NULL, -- 'invocations', 'success_rate', 'error_rate', 'avg_execution_time', etc.
    metric_value FLOAT NOT NULL,
    metric_unit TEXT, -- 'count', 'percent', 'milliseconds', 'dollars', etc.
    
    -- Time period
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    period_type TEXT NOT NULL, -- 'hourly', 'daily', 'weekly', 'monthly'
    
    -- Metadata
    recorded_at TIMESTAMP DEFAULT NOW(),
    recorded_by TEXT DEFAULT 'component-analytics',
    
    -- Indexes
    CONSTRAINT valid_period_type CHECK (period_type IN ('hourly', 'daily', 'weekly', 'monthly'))
);

CREATE INDEX IF NOT EXISTS idx_component_analytics_path ON component_analytics(component_path);
CREATE INDEX IF NOT EXISTS idx_component_analytics_metric ON component_analytics(metric_name);
CREATE INDEX IF NOT EXISTS idx_component_analytics_period ON component_analytics(period_start DESC, period_end DESC);
CREATE INDEX IF NOT EXISTS idx_component_analytics_recorded ON component_analytics(recorded_at DESC);

-- Component test results
CREATE TABLE IF NOT EXISTS component_test_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_path TEXT NOT NULL,
    component_name TEXT NOT NULL,
    
    -- Test information
    test_type TEXT NOT NULL, -- 'unit', 'integration', 'regression', 'load', 'security', 'accessibility'
    test_suite TEXT, -- Name of test suite
    test_name TEXT, -- Specific test name
    
    -- Test results
    passed BOOLEAN NOT NULL,
    duration_ms INTEGER,
    error_message TEXT,
    error_stack TEXT,
    
    -- Test details
    test_data JSONB, -- Additional test data (inputs, outputs, etc.)
    assertions_total INTEGER,
    assertions_passed INTEGER,
    assertions_failed INTEGER,
    
    -- Context
    improvement_id UUID REFERENCES component_improvements(id),
    git_commit TEXT,
    git_branch TEXT,
    
    -- Metadata
    tested_at TIMESTAMP DEFAULT NOW(),
    tested_by TEXT DEFAULT 'component-tester',
    
    -- Indexes
    CONSTRAINT valid_test_type CHECK (test_type IN ('unit', 'integration', 'regression', 'load', 'security', 'accessibility', 'performance'))
);

CREATE INDEX IF NOT EXISTS idx_component_test_results_path ON component_test_results(component_path);
CREATE INDEX IF NOT EXISTS idx_component_test_results_type ON component_test_results(test_type);
CREATE INDEX IF NOT EXISTS idx_component_test_results_passed ON component_test_results(passed);
CREATE INDEX IF NOT EXISTS idx_component_test_results_tested ON component_test_results(tested_at DESC);
CREATE INDEX IF NOT EXISTS idx_component_test_results_improvement ON component_test_results(improvement_id);

-- Component optimization history
CREATE TABLE IF NOT EXISTS component_optimizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_path TEXT NOT NULL,
    component_name TEXT NOT NULL,
    
    -- Optimization details
    optimization_type TEXT NOT NULL, -- 'token', 'cost', 'performance', 'complexity', 'memory'
    optimization_description TEXT NOT NULL,
    
    -- Before metrics
    before_tokens INTEGER,
    before_cost_per_invocation FLOAT,
    before_complexity_score FLOAT,
    before_file_size_bytes INTEGER,
    
    -- After metrics
    after_tokens INTEGER,
    after_cost_per_invocation FLOAT,
    after_complexity_score FLOAT,
    after_file_size_bytes INTEGER,
    
    -- Improvements
    token_savings INTEGER,
    token_savings_percent FLOAT,
    cost_savings_per_invocation FLOAT,
    cost_savings_percent FLOAT,
    complexity_reduction FLOAT,
    performance_improvement_percent FLOAT,
    
    -- Validation
    functionality_preserved BOOLEAN DEFAULT true,
    tests_passed BOOLEAN DEFAULT true,
    no_breaking_changes BOOLEAN DEFAULT true,
    
    -- Context
    improvement_id UUID REFERENCES component_improvements(id),
    optimizer_agent TEXT DEFAULT 'component-optimizer',
    
    -- Metadata
    optimized_at TIMESTAMP DEFAULT NOW(),
    
    -- Indexes
    CONSTRAINT valid_optimization_type CHECK (optimization_type IN ('token', 'cost', 'performance', 'complexity', 'memory', 'tool_usage'))
);

CREATE INDEX IF NOT EXISTS idx_component_optimizations_path ON component_optimizations(component_path);
CREATE INDEX IF NOT EXISTS idx_component_optimizations_type ON component_optimizations(optimization_type);
CREATE INDEX IF NOT EXISTS idx_component_optimizations_optimized ON component_optimizations(optimized_at DESC);
CREATE INDEX IF NOT EXISTS idx_component_optimizations_improvement ON component_optimizations(improvement_id);

-- Component usage events (for detailed analytics)
CREATE TABLE IF NOT EXISTS component_usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_path TEXT NOT NULL,
    component_name TEXT NOT NULL,
    component_type TEXT NOT NULL,
    
    -- Event details
    event_type TEXT NOT NULL, -- 'invocation', 'success', 'error', 'timeout', 'cancelled'
    event_timestamp TIMESTAMP DEFAULT NOW(),
    
    -- Performance metrics
    execution_time_ms INTEGER,
    tokens_used INTEGER,
    cost FLOAT,
    
    -- Error tracking
    error_type TEXT,
    error_message TEXT,
    
    -- User context (anonymized)
    user_id_hash TEXT, -- Hashed user ID for privacy
    session_id TEXT,
    
    -- Metadata
    metadata JSONB, -- Additional event-specific data
    
    -- Indexes
    CONSTRAINT valid_event_type CHECK (event_type IN ('invocation', 'success', 'error', 'timeout', 'cancelled', 'retry'))
);

CREATE INDEX IF NOT EXISTS idx_component_usage_events_path ON component_usage_events(component_path);
CREATE INDEX IF NOT EXISTS idx_component_usage_events_type ON component_usage_events(event_type);
CREATE INDEX IF NOT EXISTS idx_component_usage_events_timestamp ON component_usage_events(event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_component_usage_events_user ON component_usage_events(user_id_hash);

-- Component recommendations
CREATE TABLE IF NOT EXISTS component_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Recommendation details
    recommendation_type TEXT NOT NULL, -- 'user', 'improvement', 'deprecation', 'discovery'
    target_component_path TEXT NOT NULL,
    target_component_name TEXT NOT NULL,
    
    -- For user recommendations
    recommended_component_path TEXT,
    recommended_component_name TEXT,
    recommendation_reason TEXT NOT NULL,
    confidence_score FLOAT, -- 0-1 scale
    
    -- For improvement recommendations
    improvement_area TEXT, -- 'error_handling', 'performance', 'documentation', etc.
    priority TEXT, -- 'critical', 'high', 'medium', 'low'
    estimated_impact TEXT,
    
    -- Status tracking
    status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'rejected', 'implemented'
    
    -- Metadata
    generated_at TIMESTAMP DEFAULT NOW(),
    generated_by TEXT DEFAULT 'component-analytics',
    reviewed_at TIMESTAMP,
    reviewed_by TEXT,
    
    -- Indexes
    CONSTRAINT valid_recommendation_type CHECK (recommendation_type IN ('user', 'improvement', 'deprecation', 'discovery')),
    CONSTRAINT valid_recommendation_status CHECK (status IN ('pending', 'accepted', 'rejected', 'implemented'))
);

CREATE INDEX IF NOT EXISTS idx_component_recommendations_target ON component_recommendations(target_component_path);
CREATE INDEX IF NOT EXISTS idx_component_recommendations_type ON component_recommendations(recommendation_type);
CREATE INDEX IF NOT EXISTS idx_component_recommendations_status ON component_recommendations(status);
CREATE INDEX IF NOT EXISTS idx_component_recommendations_generated ON component_recommendations(generated_at DESC);

-- Component health scores (aggregated view)
CREATE TABLE IF NOT EXISTS component_health_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_path TEXT NOT NULL UNIQUE,
    component_name TEXT NOT NULL,
    component_type TEXT NOT NULL,
    
    -- Health metrics (0-10 scale)
    overall_health_score FLOAT NOT NULL,
    quality_score FLOAT,
    reliability_score FLOAT,
    performance_score FLOAT,
    usability_score FLOAT,
    maintainability_score FLOAT,
    
    -- Usage metrics
    usage_rank INTEGER,
    usage_percentile FLOAT,
    total_invocations_30d INTEGER,
    success_rate_30d FLOAT,
    error_rate_30d FLOAT,
    
    -- Trend indicators
    usage_trend TEXT, -- 'increasing', 'stable', 'decreasing'
    quality_trend TEXT,
    performance_trend TEXT,
    
    -- Status
    needs_attention BOOLEAN DEFAULT false,
    attention_reason TEXT,
    
    -- Metadata
    calculated_at TIMESTAMP DEFAULT NOW(),
    calculation_period_days INTEGER DEFAULT 30,
    
    -- Indexes
    CONSTRAINT valid_trend CHECK (usage_trend IN ('increasing', 'stable', 'decreasing', 'unknown'))
);

CREATE INDEX IF NOT EXISTS idx_component_health_scores_path ON component_health_scores(component_path);
CREATE INDEX IF NOT EXISTS idx_component_health_scores_overall ON component_health_scores(overall_health_score DESC);
CREATE INDEX IF NOT EXISTS idx_component_health_scores_needs_attention ON component_health_scores(needs_attention);
CREATE INDEX IF NOT EXISTS idx_component_health_scores_calculated ON component_health_scores(calculated_at DESC);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_component_improvements_updated_at
    BEFORE UPDATE ON component_improvements
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE component_improvements IS 'Tracks automated component improvement lifecycle from research to merge';
COMMENT ON TABLE component_analytics IS 'Time-series metrics for component usage and effectiveness';
COMMENT ON TABLE component_test_results IS 'Detailed test results for component validation';
COMMENT ON TABLE component_optimizations IS 'History of component optimizations and their impact';
COMMENT ON TABLE component_usage_events IS 'Detailed event log for component invocations and outcomes';
COMMENT ON TABLE component_recommendations IS 'AI-generated recommendations for components and users';
COMMENT ON TABLE component_health_scores IS 'Aggregated health scores and rankings for all components';
