-- Schema para tracking de estrellas de GitHub con notificaciones por Telegram
-- Ejecutar en Neon Database

-- Tabla principal: historial de estrellas
CREATE TABLE IF NOT EXISTS github_stars_history (
  id SERIAL PRIMARY KEY,
  total_stars INTEGER NOT NULL,
  weekly_new_stars INTEGER DEFAULT 0,
  forks INTEGER DEFAULT 0,
  watchers INTEGER DEFAULT 0,
  open_issues INTEGER DEFAULT 0,
  stargazers_data JSONB,                           -- Últimos stargazers de la semana (max 50)
  telegram_notified BOOLEAN DEFAULT FALSE,
  telegram_notified_at TIMESTAMP WITH TIME ZONE,
  checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla: logs de notificaciones Telegram
CREATE TABLE IF NOT EXISTS telegram_notifications_log (
  id SERIAL PRIMARY KEY,
  record_id INTEGER REFERENCES github_stars_history(id) ON DELETE SET NULL,
  notification_type VARCHAR(50) NOT NULL,           -- 'weekly_stars'
  payload_summary JSONB,
  response_status INTEGER,
  error_message TEXT,
  success BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_stars_history_checked_at ON github_stars_history(checked_at DESC);
CREATE INDEX idx_stars_history_telegram_notified ON github_stars_history(telegram_notified);
CREATE INDEX idx_telegram_log_record_id ON telegram_notifications_log(record_id);
CREATE INDEX idx_telegram_log_sent_at ON telegram_notifications_log(sent_at DESC);
CREATE INDEX idx_telegram_log_type ON telegram_notifications_log(notification_type);

-- Comentarios
COMMENT ON TABLE github_stars_history IS 'Historial semanal de estrellas de GitHub para el repo claude-code-templates';
COMMENT ON TABLE telegram_notifications_log IS 'Log de notificaciones enviadas por Telegram (estrellas y otros)';
