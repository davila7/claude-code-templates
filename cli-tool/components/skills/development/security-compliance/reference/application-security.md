# Application Security & Secure SDLC

## Secure Software Development Lifecycle (SDLC)

### Security Activities by SDLC Phase

```
┌─────────────────────────────────────────────────────────────┐
│  Requirements Phase                                         │
├─────────────────────────────────────────────────────────────┤
│  □ Security requirements gathering                          │
│  □ Privacy impact assessment                                │
│  □ Compliance requirements (GDPR, HIPAA, PCI-DSS)          │
│  □ Data classification                                      │
│  □ Abuse case development                                   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  Design Phase                                               │
├─────────────────────────────────────────────────────────────┤
│  □ Threat modeling (STRIDE, PASTA)                          │
│  □ Security architecture review                             │
│  □ Data flow diagrams with trust boundaries                │
│  □ Authentication/authorization design                      │
│  □ Encryption and key management design                    │
│  □ Security control selection                              │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  Development Phase                                          │
├─────────────────────────────────────────────────────────────┤
│  □ Secure coding training for developers                    │
│  □ IDE security plugins (e.g., SonarLint)                  │
│  □ Pre-commit hooks (secrets scanning)                     │
│  □ Code reviews with security focus                        │
│  □ SAST (Static Application Security Testing)              │
│  □ SCA (Software Composition Analysis)                     │
│  □ Unit tests for security functions                       │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  Testing Phase                                              │
├─────────────────────────────────────────────────────────────┤
│  □ DAST (Dynamic Application Security Testing)             │
│  □ Penetration testing                                     │
│  □ Security test cases execution                           │
│  □ Fuzz testing                                            │
│  □ Authentication/authorization testing                     │
│  □ Container/infrastructure scanning                       │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  Deployment Phase                                           │
├─────────────────────────────────────────────────────────────┤
│  □ Security configuration review                            │
│  □ Secrets management (no hardcoded credentials)           │
│  □ Security hardening (disable unnecessary services)       │
│  □ Infrastructure as Code (IaC) security scanning          │
│  □ Deploy security monitoring/logging                      │
│  □ WAF/API gateway configuration                           │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  Maintenance Phase                                          │
├─────────────────────────────────────────────────────────────┤
│  □ Vulnerability scanning (continuous)                      │
│  □ Security patch management                                │
│  □ Dependency updates (address CVEs)                       │
│  □ Security monitoring and incident response               │
│  □ Periodic penetration testing (annually)                 │
│  □ Threat intelligence monitoring                          │
└─────────────────────────────────────────────────────────────┘
```

---

## OWASP Top 10 (2021) & Mitigation

### A01:2021 - Broken Access Control

**Description**: Restrictions on what authenticated users can do are not properly enforced.

**Examples**:
- Accessing other users' data by modifying URL parameter (`/user/123` → `/user/124`)
- Elevation of privilege (acting as admin without being admin)
- IDOR (Insecure Direct Object Reference)
- Missing authorization checks on API endpoints

**Code Example (Vulnerable)**:

```python
# Vulnerable: No authorization check
@app.route('/user/<user_id>/profile')
def get_user_profile(user_id):
    user = User.query.get(user_id)
    return jsonify(user.to_dict())
```

**Code Example (Secure)**:

```python
# Secure: Verify user owns the resource
@app.route('/user/<user_id>/profile')
@login_required
def get_user_profile(user_id):
    # Check if logged-in user is requesting their own profile
    if current_user.id != int(user_id):
        abort(403)  # Forbidden

    user = User.query.get(user_id)
    return jsonify(user.to_dict())
```

**Mitigation**:
- Deny by default
- Implement access control checks on every request
- Use centralized authorization (RBAC, ABAC)
- Log access control failures
- Disable directory listing on web servers

---

### A02:2021 - Cryptographic Failures

**Description**: Failures related to cryptography that lead to exposure of sensitive data.

**Examples**:
- Transmitting data in cleartext (HTTP instead of HTTPS)
- Using weak cryptographic algorithms (MD5, SHA1, DES)
- Hardcoded encryption keys
- No encryption of sensitive data at rest

**Code Example (Vulnerable)**:

```python
# Vulnerable: Weak hash, no salt
import hashlib

def hash_password(password):
    return hashlib.md5(password.encode()).hexdigest()
```

**Code Example (Secure)**:

```python
# Secure: Strong hash with salt
import bcrypt

def hash_password(password):
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode(), salt)

def verify_password(password, hashed):
    return bcrypt.checkpw(password.encode(), hashed)
```

**Mitigation**:
- Use TLS 1.2+ for all data in transit
- Use strong, modern encryption algorithms (AES-256, RSA-2048+)
- Use bcrypt, scrypt, or Argon2 for password hashing
- Never store sensitive data unnecessarily
- Use proper key management (KMS, Hardware Security Modules)

---

### A03:2021 - Injection

**Description**: User-supplied data is not validated, filtered, or sanitized.

**Examples**:
- SQL injection
- NoSQL injection
- OS command injection
- LDAP injection

**Code Example (Vulnerable SQL Injection)**:

```python
# Vulnerable: String concatenation
@app.route('/search')
def search():
    query = request.args.get('q')
    sql = f"SELECT * FROM products WHERE name LIKE '%{query}%'"
    results = db.execute(sql)
    return jsonify(results)
```

**Code Example (Secure)**:

```python
# Secure: Parameterized queries
@app.route('/search')
def search():
    query = request.args.get('q')
    sql = "SELECT * FROM products WHERE name LIKE ?"
    results = db.execute(sql, (f'%{query}%',))
    return jsonify(results)
```

**Code Example (Vulnerable Command Injection)**:

```python
# Vulnerable: Passing user input to shell
import os

@app.route('/ping')
def ping():
    host = request.args.get('host')
    result = os.system(f'ping -c 1 {host}')
    return str(result)
```

**Code Example (Secure)**:

```python
# Secure: Use library instead of shell command
import subprocess

@app.route('/ping')
def ping():
    host = request.args.get('host')

    # Validate input
    import re
    if not re.match(r'^[a-zA-Z0-9.-]+$', host):
        return "Invalid host", 400

    # Use array format (no shell interpretation)
    try:
        result = subprocess.run(['ping', '-c', '1', host],
                              capture_output=True,
                              timeout=5,
                              check=False)
        return result.stdout.decode()
    except subprocess.TimeoutExpired:
        return "Timeout", 408
```

**Mitigation**:
- Use parameterized queries (prepared statements)
- Use ORM frameworks
- Input validation (allowlist preferred over blocklist)
- Escape special characters
- Use language-specific APIs instead of shell commands

---

### A04:2021 - Insecure Design

**Description**: Missing or ineffective security design patterns.

**Examples**:
- No rate limiting on authentication (allows brute force)
- No defense against automated attacks (bots)
- Insufficient logging for security events

**Mitigation**:
- Threat modeling during design phase
- Secure design patterns (rate limiting, circuit breakers)
- Defense in depth
- Separation of duties

---

### A05:2021 - Security Misconfiguration

**Description**: Improperly configured security settings.

**Examples**:
- Default credentials not changed
- Unnecessary features enabled (directory listing, debug mode)
- Error messages revealing stack traces
- Missing security headers

**Secure Configuration Example**:

```python
# Flask example with security headers
from flask import Flask
from flask_talisman import Talisman

app = Flask(__name__)

# Enforce HTTPS and security headers
Talisman(app,
    force_https=True,
    strict_transport_security=True,
    content_security_policy={
        'default-src': "'self'",
        'script-src': "'self' 'unsafe-inline'",
        'style-src': "'self' 'unsafe-inline'"
    },
    content_security_policy_nonce_in=['script-src'],
    referrer_policy='strict-origin-when-cross-origin',
    feature_policy={
        'geolocation': "'none'",
        'camera': "'none'",
        'microphone': "'none'"
    }
)

# Disable debug mode in production
app.config['DEBUG'] = False

# Custom error handlers (don't reveal stack traces)
@app.errorhandler(500)
def internal_error(error):
    # Log error details server-side
    app.logger.error(f'Server Error: {error}')
    # Return generic message to user
    return "Internal server error", 500
```

**Nginx Security Headers**:

```nginx
# Security headers
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';" always;

# Disable server version disclosure
server_tokens off;
```

---

### A06:2021 - Vulnerable and Outdated Components

**Description**: Using components with known vulnerabilities.

**Examples**:
- Outdated libraries with known CVEs
- Unsupported software versions
- Not scanning dependencies for vulnerabilities

**Mitigation**:
- Inventory all dependencies
- Monitor for CVEs (use Snyk, Dependabot, Renovate)
- Update dependencies regularly
- Remove unused dependencies

**Example: package.json with automated scanning**:

```json
{
  "name": "secure-app",
  "scripts": {
    "audit": "npm audit",
    "audit:fix": "npm audit fix"
  },
  "dependencies": {
    "express": "^4.18.2",
    "helmet": "^7.0.0"
  }
}
```

**GitHub Dependabot configuration** (`.github/dependabot.yml`):

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
    reviewers:
      - "security-team"
    labels:
      - "dependencies"
      - "security"
```

---

### A07:2021 - Identification and Authentication Failures

**Description**: Weaknesses in authentication and session management.

**Examples**:
- Weak password requirements
- No brute force protection
- Session fixation
- Insecure session tokens

**Secure Authentication Example**:

```python
from flask import Flask, session, request
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import bcrypt
import secrets

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)  # Strong random secret

# Rate limiting (brute force protection)
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["100 per hour"]
)

# Session configuration
app.config.update(
    SESSION_COOKIE_SECURE=True,  # HTTPS only
    SESSION_COOKIE_HTTPONLY=True,  # No JavaScript access
    SESSION_COOKIE_SAMESITE='Lax',  # CSRF protection
    PERMANENT_SESSION_LIFETIME=timedelta(hours=1)  # Session timeout
)

@app.route('/login', methods=['POST'])
@limiter.limit("5 per minute")  # Max 5 login attempts per minute
def login():
    username = request.form.get('username')
    password = request.form.get('password')

    user = User.query.filter_by(username=username).first()

    if user and bcrypt.checkpw(password.encode(), user.password_hash):
        # Regenerate session ID (prevent session fixation)
        session.clear()
        session['user_id'] = user.id
        session['login_time'] = datetime.utcnow()
        return {"status": "success"}
    else:
        # Generic error message (don't reveal if username exists)
        return {"error": "Invalid credentials"}, 401
```

**Password Policy**:

```python
import re

def validate_password(password):
    """
    Enforce strong password requirements:
    - Minimum 12 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one digit
    - At least one special character
    """
    if len(password) < 12:
        return False, "Password must be at least 12 characters"

    if not re.search(r'[A-Z]', password):
        return False, "Password must contain uppercase letter"

    if not re.search(r'[a-z]', password):
        return False, "Password must contain lowercase letter"

    if not re.search(r'\d', password):
        return False, "Password must contain digit"

    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        return False, "Password must contain special character"

    # Check against common passwords (implement breach password check)
    # Example: Use haveibeenpwned API

    return True, "Password is strong"
```

---

### A08:2021 - Software and Data Integrity Failures

**Description**: Code and infrastructure that does not protect against integrity violations.

**Examples**:
- Unsigned or unverified software updates
- Insecure CI/CD pipeline
- Insecure deserialization

**Mitigation**:
- Code signing
- Verify software signatures before installation
- Use SRI (Subresource Integrity) for CDN resources
- Secure CI/CD pipeline

**Example: SRI for CDN resources**:

```html
<!-- With Subresource Integrity -->
<script src="https://cdn.example.com/library.js"
        integrity="sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC"
        crossorigin="anonymous"></script>
```

---

### A09:2021 - Security Logging and Monitoring Failures

**Description**: Insufficient logging and monitoring.

**Examples**:
- Login attempts not logged
- No alerting on suspicious activity
- Logs not retained long enough

**Secure Logging Example**:

```python
import logging
from logging.handlers import RotatingFileHandler
from flask import request, g

# Configure secure logging
handler = RotatingFileHandler('security.log', maxBytes=10000000, backupCount=10)
handler.setLevel(logging.INFO)
formatter = logging.Formatter(
    '[%(asctime)s] %(levelname)s in %(module)s: %(message)s'
)
handler.setFormatter(formatter)

security_logger = logging.getLogger('security')
security_logger.addHandler(handler)
security_logger.setLevel(logging.INFO)

@app.before_request
def log_request():
    # Log all requests with security context
    security_logger.info(f'Request: {request.method} {request.path} from {request.remote_addr}')

@app.route('/login', methods=['POST'])
def login():
    username = request.form.get('username')
    password = request.form.get('password')

    user = User.query.filter_by(username=username).first()

    if user and verify_password(password, user.password_hash):
        security_logger.info(f'Successful login: {username} from {request.remote_addr}')
        session['user_id'] = user.id
        return {"status": "success"}
    else:
        # Log failed login attempt
        security_logger.warning(f'Failed login attempt: {username} from {request.remote_addr}')
        return {"error": "Invalid credentials"}, 401
```

**What to Log**:

```
Authentication Events:
□ Login success/failure (username, IP, timestamp)
□ Logout
□ Password change
□ MFA enrollment/removal
□ Account lockout

Authorization Events:
□ Access denied (403 errors)
□ Privilege escalation attempts
□ Admin actions

Input Validation Failures:
□ SQL injection attempts
□ XSS attempts
□ Path traversal attempts

System Events:
□ Application start/stop
□ Configuration changes
□ Error conditions

NEVER LOG:
✗ Passwords or password hashes
✗ Session tokens or API keys
✗ Credit card numbers or PII
✗ Cryptographic keys
```

---

### A10:2021 - Server-Side Request Forgery (SSRF)

**Description**: Application fetches a remote resource without validating the user-supplied URL.

**Code Example (Vulnerable)**:

```python
# Vulnerable: No URL validation
@app.route('/fetch')
def fetch_url():
    url = request.args.get('url')
    response = requests.get(url)
    return response.text
```

**Code Example (Secure)**:

```python
from urllib.parse import urlparse
import ipaddress

# Secure: Validate and restrict URLs
ALLOWED_DOMAINS = ['api.trusted-partner.com', 'cdn.example.com']

def is_safe_url(url):
    parsed = urlparse(url)

    # Only allow HTTPS
    if parsed.scheme != 'https':
        return False

    # Check against allowlist
    if parsed.hostname not in ALLOWED_DOMAINS:
        return False

    # Prevent access to internal IPs
    try:
        ip = ipaddress.ip_address(parsed.hostname)
        if ip.is_private or ip.is_loopback:
            return False
    except ValueError:
        # Hostname is not an IP (which is fine)
        pass

    return True

@app.route('/fetch')
def fetch_url():
    url = request.args.get('url')

    if not is_safe_url(url):
        return "Invalid URL", 400

    try:
        response = requests.get(url, timeout=5)
        return response.text
    except requests.exceptions.RequestException:
        return "Error fetching URL", 500
```

---

## DevSecOps Pipeline

### CI/CD Security Integration

```yaml
# .github/workflows/security.yml
name: Security Checks

on: [push, pull_request]

jobs:
  security-scan:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      # Secrets scanning
      - name: Gitleaks
        uses: gitleaks/gitleaks-action@v2

      # Dependency scanning
      - name: Dependency Check
        uses: dependency-check/Dependency-Check_Action@main
        with:
          project: 'my-app'
          path: '.'
          format: 'HTML'

      # SAST (Static Application Security Testing)
      - name: SonarCloud Scan
        uses: SonarSource/sonarcloud-github-action@master
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}

      # Container scanning
      - name: Build Docker image
        run: docker build -t myapp:${{ github.sha }} .

      - name: Trivy container scan
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: 'myapp:${{ github.sha }}'
          format: 'sarif'
          output: 'trivy-results.sarif'

      # IaC scanning
      - name: Checkov IaC scan
        uses: bridgecrewio/checkov-action@master
        with:
          directory: terraform/
          framework: terraform

      # Upload results
      - name: Upload SARIF results
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: trivy-results.sarif
```

### Pre-commit Hooks

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.0
    hooks:
      - id: gitleaks

  - repo: https://github.com/PyCQA/bandit
    rev: 1.7.5
    hooks:
      - id: bandit
        args: ['-r', 'src/']

  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.5.0
    hooks:
      - id: check-added-large-files
        args: ['--maxkb=500']
      - id: detect-private-key
      - id: check-yaml
      - id: check-json
```

---

## API Security

### API Security Best Practices

**1. Authentication**:

```python
# JWT-based API authentication
from flask import Flask, request, jsonify
from functools import wraps
import jwt
from datetime import datetime, timedelta

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key'

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')

        if not token:
            return jsonify({'error': 'Token is missing'}), 401

        try:
            # Remove "Bearer " prefix if present
            if token.startswith('Bearer '):
                token = token[7:]

            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = User.query.get(data['user_id'])
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401

        return f(current_user, *args, **kwargs)

    return decorated

@app.route('/api/protected', methods=['GET'])
@token_required
def protected_route(current_user):
    return jsonify({'message': f'Hello, {current_user.username}'})
```

**2. Rate Limiting**:

```python
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["1000 per day", "100 per hour"],
    storage_uri="redis://localhost:6379"
)

@app.route('/api/login', methods=['POST'])
@limiter.limit("5 per minute")
def api_login():
    # Login logic
    pass
```

**3. Input Validation**:

```python
from marshmallow import Schema, fields, validate, ValidationError

class UserRegistrationSchema(Schema):
    username = fields.Str(required=True, validate=validate.Length(min=3, max=50))
    email = fields.Email(required=True)
    password = fields.Str(required=True, validate=validate.Length(min=12))
    age = fields.Int(validate=validate.Range(min=18, max=120))

@app.route('/api/register', methods=['POST'])
def register():
    schema = UserRegistrationSchema()

    try:
        data = schema.load(request.json)
    except ValidationError as err:
        return jsonify({'errors': err.messages}), 400

    # Proceed with registration
    # ...
```

**4. CORS Configuration**:

```python
from flask_cors import CORS

# Restrict CORS to specific origins
CORS(app, resources={
    r"/api/*": {
        "origins": ["https://trusted-frontend.com"],
        "methods": ["GET", "POST"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})
```

---

## Container Security

### Dockerfile Security Best Practices

```dockerfile
# Use specific version (not 'latest')
FROM python:3.11.7-slim-bookworm

# Run as non-root user
RUN useradd --create-home --shell /bin/bash appuser

# Set working directory
WORKDIR /app

# Copy only requirements first (layer caching)
COPY requirements.txt .

# Install dependencies without cache
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY --chown=appuser:appuser . .

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD python healthcheck.py || exit 1

# Run application
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "app:app"]
```

### Container Scanning

```bash
# Scan container image with Trivy
trivy image myapp:latest

# Scan for critical and high severity vulnerabilities only
trivy image --severity CRITICAL,HIGH myapp:latest

# Scan and fail CI if vulnerabilities found
trivy image --exit-code 1 --severity CRITICAL myapp:latest
```

This comprehensive application security guide provides developers with the knowledge and code examples needed to build secure applications following industry best practices.
