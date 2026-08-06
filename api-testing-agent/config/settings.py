import os

# API Testing Agent Settings

# Default request timeout in seconds
DEFAULT_TIMEOUT = 10.0

# User agent string sent with requests
USER_AGENT = "AI-API-Testing-Agent/1.0.0"

# Common SQL injection payloads for security auditing
SQLI_PAYLOADS = [
    "' OR '1'='1",
    "' OR 1=1 --",
    "admin' --",
    "' UNION SELECT NULL, NULL, NULL --",
]

# Common XSS payloads for security auditing
XSS_PAYLOADS = [
    "<script>alert(1)</script>",
    "<img src=x onerror=alert(1)>",
    "javascript:alert(1)",
]

# Supported response verification thresholds
PERFORMANCE_LATENCY_THRESHOLD_MS = 500  # Warning if response time > 500ms
