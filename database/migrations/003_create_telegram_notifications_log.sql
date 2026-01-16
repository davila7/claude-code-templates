-- Schema para tracking de notificaciones Telegram de PRs

-- Tabla: logs de notificaciones Telegram para PRs
CREATE TABLE IF NOT EXISTS telegram_notifications_log (
  id SERIAL PRIMARY KEY,
  pr_number INTEGER NOT NULL,
  pr_title TEXT NOT NULL,
  pr_url VARCHAR(500) NOT NULL,
  repository VARCHAR(200) NOT NULL,
  action VARCHAR(50) NOT NULL, -- 'opened', 'synchronize', 'reopened'
  chat_id VARCHAR(100),
  payload JSONB,
  response_status INTEGER,
  response_body TEXT,
  error_message TEXT,
  success BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para optimización
CREATE INDEX idx_telegram_notifications_pr_number ON telegram_notifications_log(pr_number);
CREATE INDEX idx_telegram_notifications_repository ON telegram_notifications_log(repository);
CREATE INDEX idx_telegram_notifications_sent_at ON telegram_notifications_log(sent_at DESC);
CREATE INDEX idx_telegram_notifications_success ON telegram_notifications_log(success);

-- Comentarios para documentación
COMMENT ON TABLE telegram_notifications_log IS 'Log de todas las notificaciones de PRs enviadas a Telegram';
COMMENT ON COLUMN telegram_notifications_log.pr_number IS 'Número del Pull Request';
COMMENT ON COLUMN telegram_notifications_log.pr_title IS 'Título del Pull Request';
COMMENT ON COLUMN telegram_notifications_log.pr_url IS 'URL del Pull Request en GitHub';
COMMENT ON COLUMN telegram_notifications_log.repository IS 'Repositorio completo (owner/repo)';
COMMENT ON COLUMN telegram_notifications_log.action IS 'Acción que disparó la notificación (opened, synchronize, reopened)';
COMMENT ON COLUMN telegram_notifications_log.chat_id IS 'ID del chat de Telegram donde se envió';
COMMENT ON COLUMN telegram_notifications_log.payload IS 'Payload completo enviado a Telegram API';
COMMENT ON COLUMN telegram_notifications_log.response_status IS 'Código HTTP de respuesta de Telegram';
COMMENT ON COLUMN telegram_notifications_log.response_body IS 'Cuerpo de respuesta de Telegram API';
COMMENT ON COLUMN telegram_notifications_log.error_message IS 'Mensaje de error si la notificación falló';
COMMENT ON COLUMN telegram_notifications_log.success IS 'Indica si la notificación se envió exitosamente';
COMMENT ON COLUMN telegram_notifications_log.sent_at IS 'Timestamp de cuando se intentó enviar la notificación';
