---
name: garmin-coach-bot
description: Deploy a personal AI training coach Telegram bot that connects to Garmin Connect. Syncs activities, sleep, HRV, and training readiness data. Sends morning/evening reports via Google Gemini. Per-user routines, timezones, and schedules. Use when user wants to set up a Garmin coaching bot, deploy a fitness bot, or connect Garmin data to Telegram.
license: MIT
metadata:
  version: 1.0.0
  author: Ivan Molina Ruiz
  tags: [Garmin, Telegram, Fitness, Coach, AI, Gemini, Training, Wearable, Health, Sports]
  dependencies: [python3.13, pip]
  homepage: https://github.com/imolina29/conexion_garmin
---

# Garmin Coach Bot

Bot de Telegram que actua como coach de entrenamiento personal usando datos reales de un reloj Garmin y Google Gemini como motor de IA.

## Que hace

- Sincroniza automaticamente actividades, sueno, HRV, Training Readiness y Body Battery desde Garmin Connect
- Envia reportes matutinos (recuperacion, sueno, recomendacion del dia) y nocturnos (resumen de actividad, cumplimiento del plan)
- Genera planes de entrenamiento semanales personalizados con calendario .ics suscribible
- Cada usuario configura su propia rutina (`/rutina`), zona horaria y horarios de reportes (`/config`)
- Credenciales de Garmin cifradas con Fernet/AES, con transparencia total y opcion de eliminacion (`/eliminar`)

## Requisitos previos

Antes de empezar, el usuario necesita:

1. **Un reloj Garmin** con cuenta activa en Garmin Connect
2. **Un bot de Telegram** creado via @BotFather
3. **Google Gemini API key** (tier gratuito funciona)
4. **Python 3.13+** instalado localmente (para desarrollo)
5. **(Opcional) Cuenta en Railway** para deploy en la nube

## Setup paso a paso

### 1. Clonar el repositorio

```bash
git clone https://github.com/imolina29/conexion_garmin.git
cd conexion_garmin
```

### 2. Crear entorno virtual e instalar dependencias

```bash
python3.13 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 3. Crear bot de Telegram

Guia al usuario para que hable con @BotFather en Telegram:

1. Enviar `/newbot` a @BotFather
2. Elegir nombre (ej: "Mi Coach Garmin")
3. Elegir username (ej: `mi_coach_garmin_bot`)
4. Copiar el token que BotFather devuelve

### 4. Obtener Gemini API key

1. Ir a https://aistudio.google.com/apikey
2. Crear una API key (el tier gratuito es suficiente)
3. Copiar la key

### 5. Configurar variables de entorno

Copiar el archivo de ejemplo y llenar los valores:

```bash
cp .env.example .env
```

Variables requeridas en `.env`:

| Variable | Descripcion | Ejemplo |
|----------|-------------|---------|
| `TELEGRAM_BOT_TOKEN` | Token del bot de BotFather | `123456:ABC-DEF...` |
| `GEMINI_API_KEY` | API key de Google AI Studio | `AIza...` |
| `ENCRYPTION_KEY` | Clave Fernet para cifrar credenciales de Garmin | (ver abajo) |

Generar la clave de cifrado:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Variables opcionales:

| Variable | Descripcion | Default |
|----------|-------------|---------|
| `USER_TIMEZONE` | Timezone por defecto para nuevos usuarios | `America/Bogota` |
| `CALENDAR_BASE_URL` | URL publica para suscripcion de calendario | (vacio) |

### 6. Ejecutar localmente

```bash
python bot.py
```

El bot arranca y empieza a escuchar mensajes. El usuario se registra enviando `/start` al bot en Telegram.

### 7. Ejecutar tests

```bash
python -m pytest tests/ -v
```

## Deploy en Railway

### Opcion A: Desde GitHub

1. Crear cuenta en [Railway](https://railway.com)
2. New Project > Deploy from GitHub repo
3. Seleccionar el repositorio
4. Agregar las variables de entorno en Settings > Variables:
   - `TELEGRAM_BOT_TOKEN`
   - `GEMINI_API_KEY`
   - `ENCRYPTION_KEY`
   - `CALENDAR_BASE_URL` (usar el dominio publico que Railway asigna)

Railway detecta el `Dockerfile` automaticamente y hace deploy.

### Opcion B: Con Railway CLI

```bash
# Instalar Railway CLI
npm install -g @railway/cli

# Login y link
railway login
railway init

# Configurar variables
railway variables set TELEGRAM_BOT_TOKEN=...
railway variables set GEMINI_API_KEY=...
railway variables set ENCRYPTION_KEY=...

# Deploy
railway up --detach
```

## Comandos del bot

| Comando | Descripcion |
|---------|-------------|
| `/start` | Registrarse (email + password de Garmin + perfil + timezone) |
| `/rutina` | Configurar rutina de entrenamiento personalizada |
| `/config` | Cambiar zona horaria y horarios de reportes |
| `/plan` | Generar plan semanal de entrenamiento |
| `/reporte` | Pedir un reporte manual |
| `/perfil` | Actualizar perfil de entrenamiento |
| `/calendario` | Obtener link de suscripcion .ics |
| `/eliminar` | Eliminar todos los datos del usuario |
| `/cancelar` | Cancelar cualquier flujo activo |

## Flujo de registro

Cuando un usuario envia `/start`:

1. Pide email de Garmin Connect
2. Pide password (se cifra con Fernet/AES, se elimina el mensaje de Telegram)
3. Verifica conexion con Garmin Connect
4. Pide descripcion del perfil (objetivos, contexto)
5. Pide zona horaria (ciudad/pais)
6. Registrado — empieza a recibir reportes automaticos

## Arquitectura

```
bot.py              — Bot de Telegram, handlers, report loop, Gemini integration
sync.py             — Sincronizacion con Garmin Connect API
analysis.py         — Procesamiento de datos, snapshots, tendencias
users.py            — Gestion de usuarios, cifrado, config per-user
calendar_server.py  — Servidor HTTP para suscripciones .ics
```

- **Almacenamiento:** Filesystem JSON (un directorio por usuario bajo `data/users/`)
- **IA:** Google Gemini (cadena de fallback: gemini-3.1-flash-lite > gemini-3.1-flash > gemini-2.0-flash)
- **Cifrado:** Fernet (AES-128-CBC) para credenciales de Garmin
- **Reportes:** Polling cada 60s, horarios individuales por usuario con 2s delay entre envios

## Personalizacion

### Cambiar la personalidad del coach

Editar `build_system_prompt()` en `bot.py`. La personalidad actual es un coach critico y directo que habla en espanol. Para cambiar el idioma o tono, modificar el string del system prompt.

### Cambiar los prompts de reportes

Los prompts `MORNING_REPORT_PROMPT` y `EVENING_REPORT_PROMPT` en `bot.py` controlan que incluye cada reporte. Se pueden ajustar las secciones, el formato y el limite de palabras.

### Agregar metricas

`sync_daily_stats()` en `sync.py` controla que datos se bajan de Garmin. `summarize_daily_stats()` en `analysis.py` controla como se presentan. Para agregar nuevas metricas (ej: VO2max, intensityMinutes), agregar la llamada al API de Garmin y el formateo.

## Troubleshooting

| Problema | Solucion |
|----------|----------|
| "Token expirado" en logs | Normal — el bot re-autentica automaticamente |
| Reportes no llegan | Verificar timezone del usuario con `/config` |
| Pasos del dia muestran numeros bajos | Los datos de "hoy" son parciales hasta la siguiente sync |
| Gemini no responde | Verificar `GEMINI_API_KEY`, revisar limites del tier gratuito |
| "GARMIN_EMAIL y GARMIN_PASSWORD deben estar en .env" | Esto es para el CLI de sync.py, no para el bot multi-usuario |
| Error de cifrado | Verificar que `ENCRYPTION_KEY` sea una clave Fernet valida |
