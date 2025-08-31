# Download Tracking System

Sistema de seguimiento de descargas anónimo para Claude Code Templates, inspirado en npm analytics.

## Descripción

Este sistema rastrea las descargas e instalaciones de componentes de forma completamente anónima para:
- Identificar los componentes más populares
- Mejorar la calidad de los componentes más utilizados
- Entender patrones de uso para desarrollo futuro
- Proporcionar estadísticas públicas similares a npm

## Arquitectura

### Backend (Vercel + Supabase)

1. **API Endpoint**: `/api/track-download-supabase.js`
   - Recibe requests POST con datos de descarga
   - Valida y almacena en Supabase (PostgreSQL)
   - Maneja rate limiting y validaciones

2. **Base de Datos**:
   ```sql
   -- Tabla principal de descargas
   component_downloads (
     id, component_type, component_name, component_path,
     category, download_timestamp, user_agent, ip_address,
     country, cli_version, created_at
   )
   
   -- Tabla de estadísticas agregadas
   download_stats (
     id, component_type, component_name, total_downloads,
     last_download, created_at, updated_at
   )
   ```

### Cliente (CLI)

1. **TrackingService**: Maneja el envío de datos
   - Dual endpoint: Base de datos + telemetría
   - Fire-and-forget (no bloquea al usuario)
   - Respeta opt-out del usuario
   - Timeout de 5 segundos

2. **Integración**: Se ejecuta automáticamente en:
   - `--agent`, `--command`, `--mcp`, `--setting`, `--hook`
   - Instalaciones de templates
   - Health checks
   - Lanzamientos de analytics dashboard

## Datos Recopilados

### Información Anónima
- **Tipo de componente**: agent, command, mcp, setting, hook
- **Nombre del componente**: ej. "api-security-audit"
- **Categoría**: ej. "security", "testing", "automation"
- **Timestamp**: Momento de instalación
- **Plataforma**: OS (linux, darwin, win32)
- **Versión CLI**: Para compatibilidad
- **País**: Solo código de 2 letras (IP geolocation)

### NO se Recopila
- ❌ Información personal identificable
- ❌ Nombres de usuario
- ❌ Rutas completas de archivos
- ❌ Contenido de proyectos
- ❌ Tokens o credenciales

## Configuración

### Variables de Entorno

```bash
# Desactivar tracking completamente
export CCT_NO_TRACKING=true
export CCT_NO_ANALYTICS=true

# Modo debug (mostrar info de tracking)
export CCT_DEBUG=true

# Base de datos (Supabase)
export SUPABASE_URL="https://..."
export SUPABASE_SERVICE_ROLE_KEY="..."
```

### Opt-out del Usuario

El tracking se desactiva automáticamente si:
- `CCT_NO_TRACKING=true`
- `CCT_NO_ANALYTICS=true` 
- `CI=true` (entornos CI/CD)

## Desarrollo

### Setup Local

1. Instalar dependencias:
   ```bash
   npm install
   ```

2. Configurar Vercel:
   ```bash
   # Instalar Vercel CLI
   npm i -g vercel
   
   # Configurar proyecto
   vercel
   ```

3. Configurar base de datos (Supabase):
   ```bash
   # Crear proyecto en Supabase
   # Copiar SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
   # Agregar variables de entorno en Vercel Dashboard
   ```

### Testing

```bash
# Test local con CLI
CCT_DEBUG=true node cli-tool/bin/create-claude-config.js --agent deep-research-team/academic-researcher

# Test sin tracking (simula opt-out)
CCT_NO_TRACKING=true node cli-tool/bin/create-claude-config.js --agent test-agent

# Test directo al API
curl -X POST https://www.aitmpl.com/api/track-download-supabase \
  -H "Content-Type: application/json" \
  -d '{"type":"agent","name":"test","path":"test","category":"test","cliVersion":"1.19.0"}'
```

### Deployment

```bash
# Deploy a Vercel
vercel --prod

# Verificar endpoints
curl -X POST https://tu-dominio.com/api/track-download-supabase \
  -H "Content-Type: application/json" \
  -d '{"type":"agent","name":"test","path":"test","category":"test","cliVersion":"1.19.0"}'
```

## API Reference

### POST /api/track-download-supabase

**Request Body:**
```json
{
  "type": "agent|command|mcp|setting|hook|template",
  "name": "component-name",
  "path": "optional/component/path", 
  "category": "component-category",
  "cliVersion": "1.0.0"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Download tracked successfully",
  "data": {
    "type": "agent",
    "name": "component-name", 
    "timestamp": "2023-12-07T10:30:00.000Z"
  }
}
```

**Error Response:**
```json
{
  "error": "Bad Request",
  "message": "Component type and name are required"
}
```

## Monitoreo

### Health Check

```bash
# Verificar salud del API
curl https://tu-dominio.com/api/track-download
```

### Métricas

El sistema proporciona métricas para:
- Total de descargas por componente
- Tendencias de popularidad
- Distribución geográfica
- Versiones de CLI más usadas
- Patrones temporales de uso

### Logs

Los logs incluyen:
- Requests exitosos/fallidos
- Errores de validación
- Problemas de conectividad a BD
- Rate limiting activado

## Seguridad

### Protecciones Implementadas

1. **Rate Limiting**: Por IP y por endpoint
2. **Validación de Input**: Sanitización de todos los campos
3. **Timeout**: 5s máximo por request
4. **CORS**: Headers configurados apropiadamente
5. **SQL Injection**: Queries parametrizadas
6. **Privacy**: No PII, solo métricas agregadas

### Compliance

- **GDPR**: No se almacenan datos personales identificables
- **CCPA**: Sistema completamente anónimo
- **Opt-out**: Múltiples formas de desactivar tracking

## Troubleshooting

### Problemas Comunes

1. **Tracking no funciona**: 
   - Verificar conectividad de red
   - Comprobar variables de entorno
   - Revisar logs con `CCT_DEBUG=true`

2. **Base de datos no responde**:
   - Verificar `POSTGRES_URL`
   - Comprobar límites de conexión
   - Revisar logs de Vercel

3. **Rate limiting activo**:
   - Espaciar requests
   - Implementar backoff exponencial
   - Contactar soporte si persiste

### Debugging

```bash
# Debug completo
CCT_DEBUG=true node cli-tool/src/index.js --agent api-security-audit

# Solo tracking de base de datos
# (modificar código temporalmente)

# Verificar payload
console.log(JSON.stringify(payload, null, 2))
```

## Roadmap

### Próximas Features

1. **Dashboard Público**: Estadísticas en tiempo real
2. **API Pública**: Endpoint para consultar métricas
3. **Webhooks**: Notificaciones de descargas populares
4. **ML Insights**: Recomendaciones basadas en patrones
5. **Retention Analytics**: Análisis de uso continuado

### Mejoras Técnicas

1. **Caching**: Redis para requests frecuentes
2. **CDN**: Distribución geográfica
3. **Monitoring**: Alertas y métricas avanzadas
4. **Backup**: Replicación de base de datos
5. **Performance**: Optimización de queries

## Contribuir

1. Fork el repositorio
2. Crear branch: `git checkout -b feature/tracking-improvement`
3. Commit cambios: `git commit -m 'Add tracking feature'`
4. Push branch: `git push origin feature/tracking-improvement`
5. Crear Pull Request

## Licencia

MIT License - Ver [LICENSE](LICENSE) para detalles.

## Contacto

- Issues: [GitHub Issues](https://github.com/davila7/claude-code-templates/issues)
- Discussions: [GitHub Discussions](https://github.com/davila7/claude-code-templates/discussions)
- Email: soporte@claude-code-templates.com