-- Migración: Crear tablas para monitoreo de documentación de Claude Code
-- Ejecutar en Neon Database

-- Tabla principal de snapshots de páginas
CREATE TABLE IF NOT EXISTS doc_page_snapshots (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(100) NOT NULL,
    url VARCHAR(500) NOT NULL,
    page_title VARCHAR(255),
    content_hash VARCHAR(50) NOT NULL,
    full_content TEXT,
    sections JSONB NOT NULL DEFAULT '[]',
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_latest BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_doc_snapshots_slug ON doc_page_snapshots(slug);
CREATE INDEX IF NOT EXISTS idx_doc_snapshots_latest ON doc_page_snapshots(slug, is_latest) WHERE is_latest = true;
CREATE INDEX IF NOT EXISTS idx_doc_snapshots_scraped ON doc_page_snapshots(scraped_at DESC);

-- Tabla de cambios detectados
CREATE TABLE IF NOT EXISTS doc_changes (
    id SERIAL PRIMARY KEY,
    snapshot_id INTEGER REFERENCES doc_page_snapshots(id),
    slug VARCHAR(100) NOT NULL,
    page_title VARCHAR(255),
    url VARCHAR(500) NOT NULL,
    change_type VARCHAR(20) NOT NULL, -- 'added', 'modified', 'removed'
    section_id VARCHAR(100),
    section_title VARCHAR(255),
    section_anchor VARCHAR(255),
    old_content TEXT,
    new_content TEXT,
    diff_added TEXT[], -- Array de líneas añadidas
    diff_removed TEXT[], -- Array de líneas eliminadas
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    telegram_notified BOOLEAN DEFAULT false,
    telegram_notified_at TIMESTAMP WITH TIME ZONE
);

-- Índices para cambios
CREATE INDEX IF NOT EXISTS idx_doc_changes_slug ON doc_changes(slug);
CREATE INDEX IF NOT EXISTS idx_doc_changes_detected ON doc_changes(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_doc_changes_type ON doc_changes(change_type);
CREATE INDEX IF NOT EXISTS idx_doc_changes_notified ON doc_changes(telegram_notified);

-- Tabla de logs de notificaciones de Telegram
CREATE TABLE IF NOT EXISTS doc_telegram_notifications (
    id SERIAL PRIMARY KEY,
    change_id INTEGER REFERENCES doc_changes(id),
    chat_id VARCHAR(50),
    message_id VARCHAR(50),
    message_text TEXT,
    response_status INTEGER,
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de metadata del monitoreo
CREATE TABLE IF NOT EXISTS doc_monitoring_metadata (
    id SERIAL PRIMARY KEY,
    last_full_scan_at TIMESTAMP WITH TIME ZONE,
    last_change_detected_at TIMESTAMP WITH TIME ZONE,
    total_scans INTEGER DEFAULT 0,
    total_changes_detected INTEGER DEFAULT 0,
    total_notifications_sent INTEGER DEFAULT 0,
    last_error TEXT,
    error_count INTEGER DEFAULT 0,
    pages_monitored INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insertar registro inicial de metadata
INSERT INTO doc_monitoring_metadata (id, pages_monitored)
VALUES (1, 24)
ON CONFLICT (id) DO NOTHING;

-- Función para actualizar timestamp automáticamente
CREATE OR REPLACE FUNCTION update_doc_monitoring_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar timestamp
DROP TRIGGER IF EXISTS trigger_doc_monitoring_updated ON doc_monitoring_metadata;
CREATE TRIGGER trigger_doc_monitoring_updated
    BEFORE UPDATE ON doc_monitoring_metadata
    FOR EACH ROW
    EXECUTE FUNCTION update_doc_monitoring_timestamp();

-- Vista útil: últimos cambios por página
CREATE OR REPLACE VIEW recent_doc_changes AS
SELECT
    dc.id,
    dc.slug,
    dc.page_title,
    dc.url,
    dc.change_type,
    dc.section_title,
    dc.section_anchor,
    dc.detected_at,
    dc.telegram_notified,
    CASE
        WHEN dc.change_type = 'added' THEN dc.new_content
        WHEN dc.change_type = 'removed' THEN dc.old_content
        ELSE CONCAT('Removed: ', COALESCE(array_length(dc.diff_removed, 1), 0), ' lines, Added: ', COALESCE(array_length(dc.diff_added, 1), 0), ' lines')
    END as change_summary
FROM doc_changes dc
ORDER BY dc.detected_at DESC
LIMIT 100;

-- Vista: resumen de páginas monitoreadas
CREATE OR REPLACE VIEW doc_pages_status AS
SELECT
    dps.slug,
    dps.page_title,
    dps.url,
    dps.content_hash,
    dps.scraped_at as last_scraped,
    (SELECT COUNT(*) FROM doc_changes WHERE slug = dps.slug) as total_changes,
    (SELECT MAX(detected_at) FROM doc_changes WHERE slug = dps.slug) as last_change
FROM doc_page_snapshots dps
WHERE dps.is_latest = true
ORDER BY dps.slug;

COMMENT ON TABLE doc_page_snapshots IS 'Snapshots de páginas de documentación de Claude Code';
COMMENT ON TABLE doc_changes IS 'Cambios detectados en la documentación';
COMMENT ON TABLE doc_telegram_notifications IS 'Log de notificaciones enviadas a Telegram';
COMMENT ON TABLE doc_monitoring_metadata IS 'Metadata del sistema de monitoreo';
