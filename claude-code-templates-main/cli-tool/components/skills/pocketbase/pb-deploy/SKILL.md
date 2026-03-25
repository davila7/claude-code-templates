---
name: "PocketBase Deploy"
description: "Production deployment for PocketBase. Use when deploying PocketBase to a server, setting up Docker, configuring systemd, reverse proxy (nginx/Caddy), TLS, SMTP, backups, S3 storage, rate limiting, or hardening for production. Provides ready-to-use configs."
---

# PocketBase Production Deployment

## Single Binary Deployment

PocketBase is a single binary. No runtime dependencies.

```bash
# Download
wget https://github.com/pocketbase/pocketbase/releases/download/v0.X.X/pocketbase_0.X.X_linux_amd64.zip
unzip pocketbase_*.zip
chmod +x pocketbase

# Run
./pocketbase serve --http="0.0.0.0:8090"
```

Data stored in `pb_data/` (SQLite DB, uploaded files, logs).

## systemd Service

```ini
# /etc/systemd/system/pocketbase.service
[Unit]
Description=PocketBase
After=network.target

[Service]
Type=simple
User=pocketbase
Group=pocketbase
LimitNOFILE=4096
Restart=always
RestartSec=5s
WorkingDirectory=/opt/pocketbase
ExecStart=/opt/pocketbase/pocketbase serve --http="127.0.0.1:8090"

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/pocketbase/pb_data /opt/pocketbase/pb_hooks /opt/pocketbase/pb_migrations
PrivateTmp=true

# Memory limit (adjust to your server)
# MemoryMax=512M

[Install]
WantedBy=multi-user.target
```

```bash
# Setup
sudo useradd --system --no-create-home pocketbase
sudo mkdir -p /opt/pocketbase
sudo cp pocketbase /opt/pocketbase/
sudo chown -R pocketbase:pocketbase /opt/pocketbase

# Enable & start
sudo systemctl daemon-reload
sudo systemctl enable pocketbase
sudo systemctl start pocketbase
sudo systemctl status pocketbase

# Logs
sudo journalctl -u pocketbase -f
```

### File descriptor limit

For high-traffic deployments, increase the limit:

```ini
# In the [Service] section:
LimitNOFILE=65535
```

Also set system-wide in `/etc/security/limits.conf`:
```
pocketbase soft nofile 65535
pocketbase hard nofile 65535
```

### Go memory limit

For constrained environments:

```ini
Environment=GOMEMLIMIT=400MiB
```

## Docker

### Dockerfile

```dockerfile
FROM alpine:latest

ARG PB_VERSION=0.25.0

RUN apk add --no-cache \
    unzip \
    ca-certificates

# Download and install PocketBase
# NOTE: verify the checksum in production — see https://github.com/pocketbase/pocketbase/releases
ADD https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip /tmp/pb.zip
RUN unzip /tmp/pb.zip -d /pb/ && rm /tmp/pb.zip

# Copy hooks and migrations
COPY ./pb_hooks /pb/pb_hooks
COPY ./pb_migrations /pb/pb_migrations

EXPOSE 8090

CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8090"]
```

### docker-compose.yml

```yaml
services:
  pocketbase:
    build: .
    ports:
      - "127.0.0.1:8090:8090"  # bind to localhost only — expose via reverse proxy
    volumes:
      - pb_data:/pb/pb_data
      - ./pb_hooks:/pb/pb_hooks
      - ./pb_migrations:/pb/pb_migrations
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:8090/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3

volumes:
  pb_data:
```

## Reverse Proxy

### Caddy (recommended — auto TLS)

```
# /etc/caddy/Caddyfile
myapp.com {
    reverse_proxy localhost:8090
}
```

That's it. Caddy handles TLS certificates automatically via Let's Encrypt.

### nginx

```nginx
# /etc/nginx/sites-available/pocketbase
server {
    listen 80;
    server_name myapp.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name myapp.com;

    ssl_certificate /etc/letsencrypt/live/myapp.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/myapp.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 50M;

    # Block public access to the admin dashboard
    location /_/ {
        return 403;
    }

    location / {
        proxy_pass http://127.0.0.1:8090;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE support for realtime
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 3600s;
    }
}
```

**Critical for realtime**: `proxy_buffering off` and `proxy_read_timeout` must be set for SSE subscriptions to work.

```bash
# Let's Encrypt with nginx
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d myapp.com
```

## SMTP Configuration

Configure in Dashboard > Settings > Mail settings, or via hooks:

```js
// pb_hooks/settings.pb.js
onBootstrap(function(e) {
    var settings = e.app.settings()
    settings.smtp.enabled = true
    settings.smtp.host = $os.getenv("SMTP_HOST")
    settings.smtp.port = parseInt($os.getenv("SMTP_PORT") || "587")
    settings.smtp.username = $os.getenv("SMTP_USER")
    settings.smtp.password = $os.getenv("SMTP_PASS")
    settings.smtp.tls = true  // STARTTLS
    // settings.smtp.authMethod = "PLAIN"  // or "LOGIN"
    settings.meta.senderName = "My App"
    settings.meta.senderAddress = "noreply@myapp.com"
    e.app.save(settings)
    return e.next()
})
```

## Security Hardening

### Superuser MFA

Always enable MFA for superuser accounts in production:
Dashboard > Superusers > Auth options > MFA > Enable

### Settings encryption key

Encrypt sensitive settings (SMTP passwords, S3 keys) at rest:

```bash
./pocketbase serve --encryptionEnv=PB_ENCRYPTION_KEY
```

Set `PB_ENCRYPTION_KEY` environment variable to a 32+ character random string. Once set, settings are encrypted in the DB. **Do not lose this key** — you won't be able to decrypt settings without it.

### Rate limiting

Built-in rate limiter (enabled by default). Configure in Dashboard > Settings > Rate limits, or:

```js
settings.rateLimits.enabled = true
settings.rateLimits.rules = [
    { label: "*:auth*", maxRequests: 10, duration: 300 },  // 10 auth attempts per 5 min
    { label: "POST:/api/collections/*/records", maxRequests: 50, duration: 60 },
]
```

### Hide the Dashboard in production

```bash
./pocketbase serve --http="127.0.0.1:8090"  # bind to localhost only
```

Access the dashboard only via SSH tunnel:
```bash
ssh -L 8090:127.0.0.1:8090 user@server
```

## S3 Storage

For file uploads, offload to S3-compatible storage:

Dashboard > Settings > Files storage > S3

```js
// Or via hooks:
onBootstrap(function(e) {
    var settings = e.app.settings()
    settings.s3.enabled = true
    settings.s3.bucket = $os.getenv("S3_BUCKET")
    settings.s3.region = $os.getenv("S3_REGION")
    settings.s3.endpoint = $os.getenv("S3_ENDPOINT")
    settings.s3.accessKey = $os.getenv("S3_ACCESS_KEY")
    settings.s3.secret = $os.getenv("S3_SECRET")
    settings.s3.forcePathStyle = true  // for MinIO/Backblaze
    e.app.save(settings)
    return e.next()
})
```

Compatible providers: AWS S3, Backblaze B2, Cloudflare R2, MinIO, DigitalOcean Spaces, Wasabi.

## Backups

### Small databases (< 1GB)

Use the built-in backup feature:
- Dashboard > Settings > Backups
- Or via API: `POST /api/backups`
- Auto-schedule: configure cron in Dashboard

### Large databases

The Dashboard backup uses SQLite's online backup API (locks DB briefly). For large DBs, use:

```bash
# sqlite3 .backup command (hot backup, minimal locking)
sqlite3 /opt/pocketbase/pb_data/data.db ".backup '/tmp/backup.db'"

# Then rsync to remote
rsync -avz /tmp/backup.db backup-server:/backups/pocketbase/data-$(date +%Y%m%d).db
```

**Never copy the `.db` file directly** while PocketBase is running — it may be in an inconsistent state.

### Backup script

```bash
#!/bin/bash
# /opt/pocketbase/backup.sh
set -euo pipefail

BACKUP_DIR="/backups/pocketbase"
DB_PATH="/opt/pocketbase/pb_data/data.db"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

# Hot backup
sqlite3 "$DB_PATH" ".backup '${BACKUP_DIR}/data_${DATE}.db'"

# Also backup pb_data files (uploads, if not using S3)
tar -czf "${BACKUP_DIR}/pb_data_${DATE}.tar.gz" -C /opt/pocketbase pb_data --exclude='pb_data/data.db*'

# Retain last 30 days
find "$BACKUP_DIR" -name "data_*.db" -mtime +30 -delete
find "$BACKUP_DIR" -name "pb_data_*.tar.gz" -mtime +30 -delete
```

```bash
# Crontab: daily at 2 AM
0 2 * * * /opt/pocketbase/backup.sh >> /var/log/pocketbase-backup.log 2>&1
```

## Health Check

```bash
curl http://localhost:8090/api/health
# {"code":200,"message":"API is healthy."}
```

## Deployment Checklist

1. **Binary**: correct architecture (linux_amd64 / linux_arm64)
2. **systemd**: service enabled, LimitNOFILE set
3. **Reverse proxy**: Caddy or nginx with TLS, proxy_buffering off for SSE
4. **SMTP**: configured and tested (send a test verification email)
5. **Superuser**: strong password + MFA enabled
6. **Encryption key**: `--encryptionEnv` set for sensitive settings
7. **Backups**: automated daily, tested restore procedure
8. **Rate limiting**: enabled with sane defaults
9. **File storage**: S3 configured if expecting many uploads
10. **Monitoring**: health check endpoint monitored, journalctl logs reviewed
11. **Firewall**: only 80/443 exposed, 8090 bound to localhost
12. **GOMEMLIMIT**: set if on constrained VPS
