"""
OWASP Top 10 - A09: Logging & Monitoring Failures
For detailed guidance, see: owasp-comprehensive-security-skills.md#section-1-owasp-top-10-2025

This example demonstrates logging and monitoring failures including:
- Missing security event logging
- Secrets logged in plaintext
- No centralized logging
- No alerting for suspicious patterns
- Insufficient audit trails
"""

import logging
import json
from datetime import datetime
from functools import wraps

# ===== VULNERABLE: Insufficient Logging =====
class VulnerableAuthService:
    """VULNERABLE: Minimal logging without security context."""
    
    def authenticate(self, username, password):
        # VULNERABLE: No logging at all
        if self.validate_credentials(username, password):
            return {"status": "success"}
        else:
            return {"status": "failed"}
    
    def change_password(self, user_id, old_password, new_password):
        # VULNERABLE: Logging success but no failure logging
        if self.validate_password(old_password):
            self.update_password(user_id, new_password)
            print(f"Password changed for user {user_id}")  # Logged to console
        # No log if validation fails - attacker can try repeatedly undetected
    
    def export_user_data(self, user_id):
        # VULNERABLE: No audit trail for sensitive data access
        data = self.get_user_data(user_id)
        return data


# ===== VULNERABLE: Secrets in Logs =====
class VulnerableLogger:
    """VULNERABLE: Logging sensitive information in plaintext."""
    
    def __init__(self):
        # VULNERABLE: Basic logging without filters
        self.logger = logging.getLogger('app')
        handler = logging.StreamHandler()
        formatter = logging.Formatter('%(message)s')
        handler.setFormatter(formatter)
        self.logger.addHandler(handler)
    
    def login_attempt(self, username, password):
        # VULNERABLE: Password logged in plaintext!
        self.logger.info(f"Login attempt: user={username}, password={password}")
    
    def api_call(self, api_key, data):
        # VULNERABLE: API key exposed in logs
        self.logger.info(f"API call with key {api_key}: {data}")
    
    def database_error(self, query, connection_string):
        # VULNERABLE: Connection string (with password) logged
        self.logger.error(f"DB error: {query} on {connection_string}")
    
    def payment_processing(self, user_id, card_number, amount):
        # VULNERABLE: Credit card data in logs!
        self.logger.info(f"Processing payment: user={user_id}, card={card_number}, amount=${amount}")


# ===== VULNERABLE: No Centralized Logging =====
class VulnerableDistributedLogs:
    """VULNERABLE: Logs scattered across multiple servers, no aggregation."""
    
    def __init__(self):
        # Each service logs to local file only
        # VULNERABLE: No correlation across services
        # VULNERABLE: No centralized search/analysis
        # VULNERABLE: Easy to delete logs on compromise
        self.logger = logging.getLogger('local_service')
        handler = logging.FileHandler('/var/log/app.log')
        self.logger.addHandler(handler)
    
    def process_request(self, request_id, user_id, action):
        # VULNERABLE: Log entry doesn't correlate requests across services
        self.logger.info(f"Request {request_id}: {action}")
        # If API calls another service, no trace of it
        # If attacker compromises server, they delete /var/log/app.log
        # No audit trail remains


# ===== VULNERABLE: No Alerting =====
class VulnerableMonitoring:
    """VULNERABLE: Logs exist but no automated detection of attacks."""
    
    def __init__(self):
        self.logger = logging.getLogger('app')
        handler = logging.FileHandler('/var/log/app.log')
        self.logger.addHandler(handler)
        # VULNERABLE: No alerting configured
        # Logs exist but no one checks them
    
    def failed_login(self, username):
        self.logger.warning(f"Failed login: {username}")
        # Even if attacker tries 1000 failed logins in 1 minute, no alert!
    
    def unauthorized_access(self, user_id, resource):
        self.logger.warning(f"Unauthorized access attempt: user={user_id}, resource={resource}")
        # No alert sent even though this is clearly suspicious
    
    def privilege_escalation(self, user_id, old_role, new_role):
        self.logger.info(f"Role changed: {user_id} {old_role} -> {new_role}")
        # No alert for account escalation


# ===== SECURE: Structured Security Logging =====
class SecureLogger:
    """SECURE: Comprehensive security event logging with structured format."""
    
    def __init__(self):
        # SECURE: JSON structured logging for better parsing
        self.logger = logging.getLogger('security')
        
        # SECURE: Log to dedicated security log
        handler = logging.FileHandler('/var/log/security.log')
        
        # Use JSON formatter for structured logging
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        handler.setFormatter(formatter)
        self.logger.addHandler(handler)
    
    def log_security_event(self, event_type, user_id, details, severity='INFO'):
        """
        SECURE: Structured security event logging.
        Never logs sensitive data.
        """
        event = {
            'timestamp': datetime.utcnow().isoformat(),
            'event_type': event_type,
            'user_id': user_id,
            'details': details,
            'severity': severity
            # NO passwords, API keys, tokens, PII
        }
        
        self.logger.log(
            getattr(logging, severity),
            json.dumps(event)
        )
    
    def login_attempt(self, username, success, ip_address):
        """SECURE: Log login attempts without exposing password."""
        self.log_security_event(
            event_type='LOGIN_ATTEMPT',
            user_id=username,
            details={
                'success': success,
                'ip_address': ip_address,
                'timestamp': datetime.utcnow().isoformat()
            },
            severity='WARNING' if not success else 'INFO'
        )
    
    def unauthorized_access(self, user_id, resource, ip_address):
        """SECURE: Log unauthorized access with full context."""
        self.log_security_event(
            event_type='UNAUTHORIZED_ACCESS',
            user_id=user_id,
            details={
                'resource': resource,
                'ip_address': ip_address,
                'timestamp': datetime.utcnow().isoformat()
            },
            severity='CRITICAL'
        )
    
    def config_change(self, user_id, config_key, old_value, new_value, ip_address):
        """SECURE: Audit trail of configuration changes (no secrets logged)."""
        # SECURE: Never log actual credential values
        masked_old = '***' if config_key in ['password', 'api_key'] else old_value
        masked_new = '***' if config_key in ['password', 'api_key'] else new_value
        
        self.log_security_event(
            event_type='CONFIG_CHANGE',
            user_id=user_id,
            details={
                'config_key': config_key,
                'old_value': masked_old,
                'new_value': masked_new,
                'ip_address': ip_address
            },
            severity='INFO'
        )


# ===== SECURE: Centralized Logging with ELK Stack =====
SECURE_ELK_CONFIG = """
# SECURE: Centralized logging architecture

# Docker Compose for ELK (Elasticsearch, Logstash, Kibana)
version: '3.8'

services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.0.0
    environment:
      - xpack.security.enabled=true
      - xpack.security.enrollment.enabled=true
      - ELASTIC_PASSWORD=${ELASTIC_PASSWORD}
    volumes:
      - elasticsearch-data:/usr/share/elasticsearch/data
    ports:
      - "9200:9200"

  logstash:
    image: docker.elastic.co/logstash/logstash:8.0.0
    volumes:
      - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf
      - /var/log/app:/var/log/app  # Mount app logs
    environment:
      - ELASTICSEARCH_URL=http://elasticsearch:9200
    depends_on:
      - elasticsearch

  kibana:
    image: docker.elastic.co/kibana/kibana:8.0.0
    ports:
      - "5601:5601"
    environment:
      - ELASTICSEARCH_HOSTS=["http://elasticsearch:9200"]
      - ELASTICSEARCH_USERNAME=elastic
      - ELASTICSEARCH_PASSWORD=${ELASTIC_PASSWORD}
    depends_on:
      - elasticsearch

volumes:
  elasticsearch-data:

# Logstash configuration to parse security logs
# logstash.conf
input {
  file {
    path => "/var/log/app/security.log"
    start_position => "beginning"
  }
}

filter {
  if [message] =~ /^{.*}$/ {
    json {
      source => "message"
    }
  }
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    user => "elastic"
    password => "${ELASTIC_PASSWORD}"
  }
}
"""


# ===== SECURE: Alerting Configuration =====
SECURE_ALERTING = """
# SECURE: Alert rules for suspicious patterns

# Prometheus alert rules (alerting.yml)
groups:
  - name: security_alerts
    rules:
      # SECURE: Alert on repeated failed logins
      - alert: BruteForceAttack
        expr: rate(failed_login_total[5m]) > 10
        annotations:
          summary: "Brute force attack detected"
          action: "Check logs, consider blocking IP"
      
      # SECURE: Alert on privilege escalation
      - alert: PrivilegeEscalation
        expr: role_change_total > 0
        annotations:
          summary: "User role changed"
          action: "Verify if authorized"
      
      # SECURE: Alert on unauthorized access attempts
      - alert: UnauthorizedAccess
        expr: unauthorized_access_total > 5
        annotations:
          summary: "Multiple unauthorized access attempts"
          action: "Check for lateral movement/data access"
      
      # SECURE: Alert on config changes
      - alert: ConfigChange
        expr: config_change_total > 0
        annotations:
          summary: "Production configuration changed"
          action: "Verify change request, check git history"

# Slack/PagerDuty integration for alerts
notification_channels:
  - name: security_slack
    type: slack
    webhook_url: https://hooks.slack.com/services/YOUR/WEBHOOK/URL
    mention: "@security-team"
  
  - name: on_call
    type: pagerduty
    integration_key: YOUR_PAGERDUTY_KEY
"""


# ===== SECURE: Monitoring Decorator =====
def secure_audit_log(event_type, severity='INFO'):
    """SECURE: Decorator to ensure critical functions are logged."""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            logger = SecureLogger()
            
            # Extract relevant audit information
            # Safely extract user_id from function arguments
            details = {
                'function': func.__name__,
                'timestamp': datetime.utcnow().isoformat()
            }
            
            try:
                result = func(*args, **kwargs)
                logger.log_security_event(
                    event_type=event_type,
                    user_id='system',
                    details=details,
                    severity=severity
                )
                return result
            except Exception as e:
                # SECURE: Log exceptions without exposing internal details
                details['error'] = type(e).__name__
                logger.log_security_event(
                    event_type=f'{event_type}_FAILED',
                    user_id='system',
                    details=details,
                    severity='CRITICAL'
                )
                raise
        
        return wrapper
    return decorator


# ===== SECURE: Usage Example =====
class SecureAuthService:
    """SECURE: Authentication with comprehensive logging."""
    
    def __init__(self):
        self.logger = SecureLogger()
    
    @secure_audit_log('USER_LOGIN', 'INFO')
    def authenticate(self, username, password, ip_address):
        """SECURE: Logged audit trail without exposing password."""
        success = self.validate_credentials(username, password)
        
        self.logger.login_attempt(
            username=username,
            success=success,
            ip_address=ip_address
        )
        
        if not success:
            # SECURE: Enforce account lockout after N failures
            self.check_brute_force(username, ip_address)
        
        return {"status": "success" if success else "failed"}


# ===== SECURITY CHECKLIST =====
CHECKLIST = """
✓ All authentication events logged (login, logout, failures)
✓ All authorization decisions logged (denied access)
✓ All configuration changes logged with audit trail
✓ All administrative actions logged
✓ All data access (especially PII/sensitive) logged
✓ Secrets NEVER logged (no passwords, tokens, API keys)
✓ Sensitive data masked in logs (***) or excluded entirely
✓ Logs centralized in secure location (ELK, Splunk, etc.)
✓ Logs encrypted in transit (TLS) and at rest
✓ Log access restricted (only authorized personnel)
✓ Structured logging (JSON) for machine parsing and alerting
✓ Correlation IDs used to trace requests across services
✓ Retention policy enforced (minimum 90 days for security events)
✓ Automated alerts for suspicious patterns (brute force, escalation)
✓ Failed login limit enforced with account lockout
✓ Rate limiting on sensitive endpoints
✓ Monitoring dashboard for security team
✓ Regular log review procedures documented
✓ Incident response playbooks created
✓ Log tampering detection (blockchain/immutable logs)
✓ SIEM (Security Information and Event Management) configured
"""
