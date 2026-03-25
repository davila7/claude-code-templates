-- Schema para tracking de versiones de Claude Code en Neon Database

-- Tabla principal: versiones de Claude Code
CREATE TABLE IF NOT EXISTS claude_code_versions (
  id SERIAL PRIMARY KEY,
  version VARCHAR(50) NOT NULL UNIQUE,
  published_at TIMESTAMP WITH TIME ZONE NOT NULL,
  changelog_content TEXT,
  npm_url VARCHAR(500),
  github_url VARCHAR(500),
  discord_notified BOOLEAN DEFAULT FALSE,
  discord_notification_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla: cambios individuales parseados del changelog
CREATE TABLE IF NOT EXISTS claude_code_changes (
  id SERIAL PRIMARY KEY,
  version_id INTEGER REFERENCES claude_code_versions(id) ON DELETE CASCADE,
  change_type VARCHAR(50), -- 'feature', 'fix', 'improvement', 'breaking', 'deprecation'
  description TEXT NOT NULL,
  category VARCHAR(100), -- 'Plugin System', 'Performance', 'CLI', etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla: logs de notificaciones Discord
CREATE TABLE IF NOT EXISTS discord_notifications_log (
  id SERIAL PRIMARY KEY,
  version_id INTEGER REFERENCES claude_code_versions(id) ON DELETE CASCADE,
  webhook_url VARCHAR(500),
  payload JSONB,
  response_status INTEGER,
  response_body TEXT,
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla: metadata de monitoreo
CREATE TABLE IF NOT EXISTS monitoring_metadata (
  id SERIAL PRIMARY KEY,
  last_check_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_version_found VARCHAR(50),
  check_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para optimización
CREATE INDEX idx_versions_version ON claude_code_versions(version);
CREATE INDEX idx_versions_published_at ON claude_code_versions(published_at DESC);
CREATE INDEX idx_versions_discord_notified ON claude_code_versions(discord_notified);
CREATE INDEX idx_changes_version_id ON claude_code_changes(version_id);
CREATE INDEX idx_changes_type ON claude_code_changes(change_type);
CREATE INDEX idx_notifications_version_id ON discord_notifications_log(version_id);
CREATE INDEX idx_notifications_sent_at ON discord_notifications_log(sent_at DESC);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para claude_code_versions
CREATE TRIGGER update_claude_code_versions_updated_at
  BEFORE UPDATE ON claude_code_versions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para monitoring_metadata
CREATE TRIGGER update_monitoring_metadata_updated_at
  BEFORE UPDATE ON monitoring_metadata
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insertar registro inicial de metadata
INSERT INTO monitoring_metadata (last_version_found, check_count, error_count)
VALUES (NULL, 0, 0)
ON CONFLICT DO NOTHING;

-- Comentarios para documentación
COMMENT ON TABLE claude_code_versions IS 'Almacena todas las versiones de Claude Code detectadas';
COMMENT ON TABLE claude_code_changes IS 'Cambios individuales extraídos del changelog de cada versión';
COMMENT ON TABLE discord_notifications_log IS 'Log de todas las notificaciones enviadas a Discord';
COMMENT ON TABLE monitoring_metadata IS 'Metadata del sistema de monitoreo (última verificación, errores, etc)';
