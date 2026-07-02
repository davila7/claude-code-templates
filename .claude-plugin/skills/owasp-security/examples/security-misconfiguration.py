# OWASP Top 10 - A05: Security Misconfiguration
# For detailed guidance, see: owasp-comprehensive-security-skills.md#section-1-owasp-top-10-2025
#
# This example demonstrates security misconfiguration issues including:
# - Debug mode enabled in production
# - Default credentials
# - Unnecessary services running
# - Missing security headers
# - Overly permissive file permissions
# - Unpatched software

# ===== VULNERABLE: Flask Debug Mode in Production =====
# app_vulnerable.py
from flask import Flask, request, jsonify

app = Flask(__name__)

# VULNERABLE: Debug mode enabled in production
# Exposes full stack traces, variables, and allows interactive debugging
app.run(debug=True, host='0.0.0.0', port=5000)

@app.route('/api/data', methods=['GET'])
def get_data():
    # VULNERABLE: Debug=True means this error will show full traceback
    # with variable values to attacker in browser
    data = request.args.get('id')
    result = process_data(data)  # If error, full code exposed
    return jsonify(result)


# ===== VULNERABLE: Dockerfile =====
# Dockerfile.vulnerable
DOCKERFILE_VULNERABLE = """
FROM python:3.10

# VULNERABLE: Running as root
USER root

# VULNERABLE: No health checks
# VULNERABLE: No resource limits specified
# VULNERABLE: No security scanner run
# VULNERABLE: Pip packages not pinned to versions

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY app.py .
EXPOSE 5000

# VULNERABLE: Using default entrypoint without security context
CMD ["python", "app.py"]
"""


# ===== VULNERABLE: Nginx Configuration =====
NGINX_VULNERABLE = """
server {
    listen 80;
    server_name api.example.com;
    
    # VULNERABLE: No HTTPS redirect
    # VULNERABLE: No security headers
    # VULNERABLE: Directory listing enabled
    autoindex on;
    
    location / {
        # VULNERABLE: No rate limiting
        # VULNERABLE: Overly permissive CORS
        add_header Access-Control-Allow-Origin *;
        proxy_pass http://backend:5000;
    }
    
    # VULNERABLE: Status page exposed to internet
    location /nginx_status {
        stub_status on;
    }
    
    # VULNERABLE: Default error pages show server version
    # VULNERABLE: No custom error pages
}
"""


# ===== VULNERABLE: Docker Compose =====
DOCKER_COMPOSE_VULNERABLE = """
version: '3'
services:
  app:
    image: myapp:latest
    environment:
      # VULNERABLE: Hardcoded sensitive data in compose file
      DATABASE_URL: "postgresql://admin:password123@db:5432/mydb"
      API_KEY: "sk-abc123xyz789"
      DEBUG: "true"
    ports:
      # VULNERABLE: Unnecessary ports exposed
      - "5000:5000"
      - "9000:9000"
  
  db:
    image: postgres:latest
    environment:
      # VULNERABLE: Default credentials
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: password
    volumes:
      # VULNERABLE: Unencrypted database backups
      - backups:/var/backups
"""


# ===== VULNERABLE: Apache Configuration =====
APACHE_VULNERABLE = """
<VirtualHost *:80>
    ServerName api.example.com
    DocumentRoot /var/www/html
    
    # VULNERABLE: No HTTPS enforcement
    # VULNERABLE: Directory listing enabled
    <Directory /var/www/html>
        Options Indexes FollowSymLinks
        AllowOverride All
    </Directory>
    
    # VULNERABLE: No security headers
    # VULNERABLE: Exposes Apache version in headers
    # VULNERABLE: No input validation
    
    # VULNERABLE: Sensitive files accessible
    <Directory /var/www/html/config>
        # Should block access, instead allows it
        Options Indexes
    </Directory>
</VirtualHost>
"""


# ===== VULNERABLE: Application Configuration =====
VULNERABLE_CONFIG = """
# config/production.yml
# VULNERABLE: Secrets in YAML file (checked into git)
database:
  host: db.example.com
  user: admin
  password: SuperSecret123!
  encryption_key: aE8%k@Mz$9pL#2qW

redis:
  url: redis://:myredispass@redis.example.com:6379/0

jwt_secret: jwt-secret-key-12345

# VULNERABLE: Debug settings in production
debug: true
verbose_logging: true
expose_errors: true

# VULNERABLE: All features enabled by default
features:
  admin_panel: true
  debug_api: true
  profiling: true
  metrics_export: true
"""


# ===== SECURE: Flask Configuration =====
SECURE_FLASK = """
import os
from flask import Flask

app = Flask(__name__)

# SECURE: Configuration from environment variables
app.config['DEBUG'] = os.getenv('DEBUG', 'false').lower() == 'true'
app.config['ENV'] = os.getenv('FLASK_ENV', 'production')
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')

if app.config['ENV'] == 'production':
    app.config['DEBUG'] = False
    app.config['PROPAGATE_EXCEPTIONS'] = True

# SECURE: Security headers added in middleware
@app.after_request
def add_security_headers(response):
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Content-Security-Policy'] = "default-src 'self'"
    # NO Access-Control-Allow-Origin: * (CORS restricted)
    return response

# SECURE: Run with production server
if __name__ == '__main__':
    # Never use debug=True in production
    # Use gunicorn/uwsgi with proper user
    app.run(debug=False, host='127.0.0.1', port=5000)
"""


# ===== SECURE: Dockerfile =====
DOCKERFILE_SECURE = """
FROM python:3.10-slim as builder

# Build stage
WORKDIR /build
COPY requirements.txt .

# SECURE: Hash verification (if available)
RUN pip install --no-cache-dir -r requirements.txt


FROM python:3.10-slim

# SECURE: Create non-root user
RUN useradd -m -u 1000 appuser

WORKDIR /app

# SECURE: Copy only necessary files from builder
COPY --from=builder /build /app

# SECURE: Application files with proper ownership
COPY --chown=appuser:appuser app.py .

# SECURE: Switch to non-root user
USER appuser

# SECURE: Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
    CMD python -c "import requests; requests.get('http://localhost:5000/health')"

EXPOSE 5000

# SECURE: No write access to root filesystem
# SECURE: Resource limits enforced at runtime with docker run --memory=512m --cpus=1
# SECURE: Image scanned with Trivy/Grype before deployment
# SECURE: Signed image with Docker Content Trust

CMD ["gunicorn", "--bind", "127.0.0.1:5000", "--workers", "4", "app:app"]
"""


# ===== SECURE: Nginx Configuration =====
NGINX_SECURE = """
# SECURE: Limit connection rate to prevent DoS
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

server {
    listen 80;
    server_name api.example.com;
    
    # SECURE: Redirect all HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.example.com;
    
    # SECURE: TLS configuration
    ssl_certificate /etc/nginx/certs/api.example.com.crt;
    ssl_certificate_key /etc/nginx/certs/api.example.com.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # SECURE: Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Content-Security-Policy "default-src 'self'" always;
    add_header Referrer-Policy "no-referrer" always;
    
    # SECURE: Disable directory listing
    autoindex off;
    
    location / {
        # SECURE: Rate limiting enabled
        limit_req zone=api_limit burst=20 nodelay;
        
        # SECURE: Restricted CORS (specific origins only)
        if ($http_origin = "https://trusted-domain.com") {
            add_header Access-Control-Allow-Origin "https://trusted-domain.com";
        }
        
        # SECURE: Hide server information
        server_tokens off;
        proxy_hide_header Server;
        
        proxy_pass http://backend:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
    
    # SECURE: Health check endpoint (restricted)
    location /health {
        access_log off;
        proxy_pass http://backend:5000/health;
    }
    
    # SECURE: Block access to sensitive paths
    location ~ /\.well-known/(acme-challenge|security.txt) {
        allow all;
    }
    location ~ /\. {
        deny all;
    }
    location ~ /(config|backup|db)/ {
        deny all;
    }
}
"""


# ===== SECURE: Docker Compose with Secrets =====
DOCKER_COMPOSE_SECURE = """
version: '3.8'

secrets:
  # SECURE: Use Docker secrets instead of environment variables
  db_password:
    file: ./secrets/db_password.txt
  api_key:
    file: ./secrets/api_key.txt
  jwt_secret:
    file: ./secrets/jwt_secret.txt

services:
  app:
    image: myapp:v1.2.3  # SECURE: Specific version, not 'latest'
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    
    # SECURE: Run as non-root
    user: "1000:1000"
    
    # SECURE: Resource limits
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
    
    # SECURE: Secrets from secure store
    secrets:
      - db_password
      - api_key
      - jwt_secret
    
    environment:
      # SECURE: Sensitive data NOT in compose file
      DATABASE_PASSWORD_FILE: /run/secrets/db_password
      API_KEY_FILE: /run/secrets/api_key
      FLASK_ENV: production
      DEBUG: "false"
    
    # SECURE: Only required ports exposed
    ports:
      - "127.0.0.1:443:5000"  # Only localhost, only via SSL
    
    # SECURE: Health check
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/health"]
      interval: 30s
      timeout: 3s
      retries: 3
    
    # SECURE: Read-only filesystem except /tmp
    read_only: true
    tmpfs:
      - /tmp
  
  db:
    image: postgres:15-alpine  # SECURE: Specific version, slim image
    
    # SECURE: Non-root user
    user: "999:999"
    
    # SECURE: Secrets for credentials
    secrets:
      - db_password
    
    environment:
      # SECURE: Load password from secret file
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    
    # SECURE: Named volume with proper driver
    volumes:
      - db_data:/var/lib/postgresql/data
    
    # SECURE: No external port exposure
    expose:
      - 5432
    
    # SECURE: Resource limits
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 256M

volumes:
  db_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /secure/data/postgres
"""


# ===== SECURITY CHECKLIST =====
CHECKLIST = """
✓ Debug mode DISABLED in production
✓ All default credentials changed
✓ Unnecessary services and ports closed
✓ Security headers configured (HSTS, CSP, etc.)
✓ HTTPS/TLS enforced (HTTP redirects to HTTPS)
✓ Directory listing disabled
✓ Secrets in environment variables or secrets manager (NOT in files/config)
✓ Non-root user running application
✓ Resource limits configured (memory, CPU)
✓ Regular patching and updates scheduled
✓ File permissions restrictive (644 files, 755 directories)
✓ Sensitive files not readable by web server (.git, .env, config/)
✓ Error messages don't expose system information
✓ API rate limiting enabled
✓ CORS properly configured (not wildcards)
✓ Dependencies scanned for vulnerabilities (Trivy, Grype, OWASP Dependency Check)
✓ Security headers tested (Observatory, Qualys SSL Labs)
✓ Configuration as code reviewed and versioned
✓ Secret rotation policies implemented
✓ Audit logging of configuration changes enabled
"""
