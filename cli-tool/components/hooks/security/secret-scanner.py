#!/usr/bin/env python3
"""
Secret Scanner Hook
Detects hardcoded secrets before git commits
"""

import json
import sys
import re
import subprocess
import os

# Secret detection patterns with descriptions
SECRET_PATTERNS = [
    # AWS Keys
    (r'AKIA[0-9A-Z]{16}', 'AWS Access Key ID', 'high'),
    (r'(?i)aws[_\-\s]*secret[_\-\s]*access[_\-\s]*key[\'"\s]*[=:][\'"\s]*[A-Za-z0-9/+=]{40}', 'AWS Secret Access Key', 'high'),

    # Anthropic (Claude) API Keys
    (r'sk-ant-api\d{2}-[A-Za-z0-9\-_]{20,}', 'Anthropic API Key', 'high'),

    # OpenAI API Keys
    (r'sk-[a-zA-Z0-9]{48,}', 'OpenAI API Key', 'high'),
    (r'sk-proj-[a-zA-Z0-9\-_]{32,}', 'OpenAI Project API Key', 'high'),

    # Google API Keys & Service Accounts
    (r'AIza[0-9A-Za-z\-_]{35}', 'Google API Key', 'high'),
    (r'ya29\.[0-9A-Za-z\-_]+', 'Google OAuth Access Token', 'high'),

    # Stripe API Keys
    (r'sk_live_[0-9a-zA-Z]{24,}', 'Stripe Live Secret Key', 'critical'),
    (r'sk_test_[0-9a-zA-Z]{24,}', 'Stripe Test Secret Key', 'medium'),
    (r'rk_live_[0-9a-zA-Z]{24,}', 'Stripe Live Restricted Key', 'high'),
    (r'pk_live_[0-9a-zA-Z]{24,}', 'Stripe Live Publishable Key', 'medium'),

    # GitHub Tokens
    (r'ghp_[0-9a-zA-Z]{36}', 'GitHub Personal Access Token', 'high'),
    (r'gho_[0-9a-zA-Z]{36}', 'GitHub OAuth Token', 'high'),
    (r'ghs_[0-9a-zA-Z]{36}', 'GitHub App Secret', 'high'),
    (r'ghr_[0-9a-zA-Z]{36}', 'GitHub Refresh Token', 'high'),
    (r'github_pat_[0-9a-zA-Z_]{22,}', 'GitHub Fine-Grained PAT', 'high'),

    # GitLab Tokens
    (r'glpat-[0-9a-zA-Z\-_]{20,}', 'GitLab Personal Access Token', 'high'),

    # Vercel Tokens
    (r'vercel_[0-9a-zA-Z_\-]{24,}', 'Vercel Token', 'high'),

    # Supabase Keys
    (r'sbp_[0-9a-f]{40}', 'Supabase Service Key', 'high'),
    (r'sb_publishable_[A-Za-z0-9\-_]{20,}', 'Supabase Publishable Key', 'medium'),
    (r'sb_secret_[A-Za-z0-9\-_]{20,}', 'Supabase Secret Key', 'high'),

    # Hugging Face Tokens
    (r'hf_[a-zA-Z0-9]{34,}', 'Hugging Face Token', 'high'),

    # Replicate API Tokens
    (r'r8_[a-zA-Z0-9]{38,}', 'Replicate API Token', 'high'),

    # Groq API Keys
    (r'gsk_[a-zA-Z0-9]{48,}', 'Groq API Key', 'high'),

    # Databricks Personal Access Tokens
    (r'dapi[0-9a-f]{32}', 'Databricks Access Token', 'high'),

    # Azure Keys
    (r'(?i)azure[_\-\s]*(?:key|secret|token)[\'"\s]*[=:][\'"\s]*[A-Za-z0-9+/=]{32,}', 'Azure Key', 'high'),

    # Cloudflare API Tokens
    (r'(?:cf|cloudflare)[_\-]?[A-Za-z0-9_\-]{37,}', 'Cloudflare API Token', 'medium'),

    # DigitalOcean Tokens
    (r'dop_v1_[0-9a-f]{64}', 'DigitalOcean Personal Access Token', 'high'),
    (r'doo_v1_[0-9a-f]{64}', 'DigitalOcean OAuth Token', 'high'),

    # Linear API Keys
    (r'lin_api_[a-zA-Z0-9]{40,}', 'Linear API Key', 'high'),

    # Notion API Keys
    (r'ntn_[0-9a-zA-Z]{40,}', 'Notion Integration Token', 'high'),
    (r'secret_[0-9a-zA-Z]{43}', 'Notion API Key (legacy)', 'high'),

    # Figma Access Tokens
    (r'figd_[0-9a-zA-Z\-_]{40,}', 'Figma Access Token', 'high'),

    # npm Tokens
    (r'npm_[0-9a-zA-Z]{36,}', 'npm Access Token', 'high'),

    # PyPI API Tokens
    (r'pypi-[A-Za-z0-9\-_]{16,}', 'PyPI API Token', 'high'),

    # Generic API Keys
    (r'(?i)(api[_\-\s]*key|apikey)[\'"\s]*[=:][\'"\s]*[\'"][0-9a-zA-Z\-_]{20,}[\'"]', 'Generic API Key', 'medium'),
    (r'(?i)(secret[_\-\s]*key|secretkey)[\'"\s]*[=:][\'"\s]*[\'"][0-9a-zA-Z\-_]{20,}[\'"]', 'Generic Secret Key', 'medium'),
    (r'(?i)(access[_\-\s]*token|accesstoken)[\'"\s]*[=:][\'"\s]*[\'"][0-9a-zA-Z\-_]{20,}[\'"]', 'Generic Access Token', 'medium'),

    # Passwords
    (r'(?i)password[\'"\s]*[=:][\'"\s]*[\'"][^\'"\s]{8,}[\'"]', 'Hardcoded Password', 'high'),
    (r'(?i)passwd[\'"\s]*[=:][\'"\s]*[\'"][^\'"\s]{8,}[\'"]', 'Hardcoded Password', 'high'),

    # Private Keys
    (r'-----BEGIN (RSA |DSA |EC )?PRIVATE KEY-----', 'Private Key', 'critical'),
    (r'-----BEGIN OPENSSH PRIVATE KEY-----', 'OpenSSH Private Key', 'critical'),

    # Database Connection Strings
    (r'(?i)(mysql|postgresql|postgres|mongodb)://[^\s\'"\)]+:[^\s\'"\)]+@', 'Database Connection String', 'high'),
    (r'(?i)Server=[^;]+;Database=[^;]+;User Id=[^;]+;Password=[^;]+', 'SQL Server Connection String', 'high'),

    # JWT Tokens
    (r'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}', 'JWT Token', 'medium'),

    # Slack Tokens
    (r'xox[baprs]-[0-9a-zA-Z\-]{10,}', 'Slack Token', 'high'),

    # Telegram Bot Tokens
    (r'[0-9]{8,10}:[A-Za-z0-9_\-]{35}', 'Telegram Bot Token', 'medium'),

    # Discord Webhooks
    (r'https://discord\.com/api/webhooks/[0-9]+/[A-Za-z0-9_\-]+', 'Discord Webhook URL', 'medium'),

    # Twilio API Keys
    (r'SK[0-9a-fA-F]{32}', 'Twilio API Key', 'high'),

    # SendGrid API Keys
    (r'SG\.[A-Za-z0-9_\-]{22}\.[A-Za-z0-9_\-]{43}', 'SendGrid API Key', 'high'),

    # Mailgun API Keys
    (r'key-[0-9a-zA-Z]{32}', 'Mailgun API Key', 'medium'),

    # Heroku API Keys
    (r'[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}', 'Potential API Key (UUID format)', 'low'),
]

# Files to exclude from scanning
EXCLUDED_FILES = [
    '.env.example',
    '.env.sample',
    '.env.template',
    'package-lock.json',
    'yarn.lock',
    'poetry.lock',
    'Pipfile.lock',
    'Cargo.lock',
    'go.sum',
    '.gitignore',
]

# Directories to exclude
EXCLUDED_DIRS = [
    'node_modules/',
    'vendor/',
    '.git/',
    'dist/',
    'build/',
    '__pycache__/',
    '.pytest_cache/',
    'venv/',
    'env/',
]

def should_skip_file(file_path):
    """Check if file should be skipped"""
    # Skip if file doesn't exist (might be deleted)
    if not os.path.exists(file_path):
        return True

    # Skip excluded files
    filename = os.path.basename(file_path)
    if filename in EXCLUDED_FILES:
        return True

    # Skip excluded directories
    for excluded_dir in EXCLUDED_DIRS:
        if excluded_dir in file_path:
            return True

    # Skip binary files
    try:
        with open(file_path, 'rb') as f:
            chunk = f.read(1024)
            if b'\0' in chunk:
                return True
    except:
        return True

    return False

def get_staged_files():
    """Get list of staged files"""
    try:
        result = subprocess.run(
            ['git', 'diff', '--cached', '--name-only', '--diff-filter=ACM'],
            capture_output=True,
            text=True,
            check=True
        )
        return [f.strip() for f in result.stdout.split('\n') if f.strip()]
    except subprocess.CalledProcessError:
        return []

def scan_file(file_path):
    """Scan a single file for secrets"""
    findings = []

    if should_skip_file(file_path):
        return findings

    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()

        for line_num, line in enumerate(content.split('\n'), 1):
            for pattern, description, severity in SECRET_PATTERNS:
                matches = re.finditer(pattern, line)
                for match in matches:
                    # Skip if it looks like a comment or example
                    line_stripped = line.strip()
                    if line_stripped.startswith('#') or line_stripped.startswith('//'):
                        # Check if it's actually a comment with example
                        if 'example' in line_stripped.lower() or 'placeholder' in line_stripped.lower():
                            continue

                    findings.append({
                        'file': file_path,
                        'line': line_num,
                        'description': description,
                        'severity': severity,
                        'match': match.group(0)[:50] + '...' if len(match.group(0)) > 50 else match.group(0),
                        'full_line': line.strip()[:100]
                    })
    except Exception as e:
        # Skip files that can't be read
        pass

    return findings

def print_findings(findings):
    """Print findings in a formatted way"""
    if not findings:
        return

    # Sort by severity
    severity_order = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3}
    findings.sort(key=lambda x: (severity_order.get(x['severity'], 4), x['file'], x['line']))

    print('', file=sys.stderr)
    print('🚨 SECRET SCANNER: Potential secrets detected!', file=sys.stderr)
    print('', file=sys.stderr)

    critical_count = sum(1 for f in findings if f['severity'] == 'critical')
    high_count = sum(1 for f in findings if f['severity'] == 'high')
    medium_count = sum(1 for f in findings if f['severity'] == 'medium')
    low_count = sum(1 for f in findings if f['severity'] == 'low')

    print(f'Found {len(findings)} potential secret(s):', file=sys.stderr)
    if critical_count > 0:
        print(f'  🔴 Critical: {critical_count}', file=sys.stderr)
    if high_count > 0:
        print(f'  🟠 High: {high_count}', file=sys.stderr)
    if medium_count > 0:
        print(f'  🟡 Medium: {medium_count}', file=sys.stderr)
    if low_count > 0:
        print(f'  🔵 Low: {low_count}', file=sys.stderr)
    print('', file=sys.stderr)

    for finding in findings:
        severity_emoji = {
            'critical': '🔴',
            'high': '🟠',
            'medium': '🟡',
            'low': '🔵'
        }.get(finding['severity'], '⚪')

        print(f'{severity_emoji} {finding["description"]}', file=sys.stderr)
        print(f'   File: {finding["file"]}:{finding["line"]}', file=sys.stderr)
        print(f'   Match: {finding["match"]}', file=sys.stderr)
        print('', file=sys.stderr)

    print('❌ COMMIT BLOCKED: Remove secrets before committing', file=sys.stderr)
    print('', file=sys.stderr)
    print('How to fix:', file=sys.stderr)
    print('  1. Move secrets to environment variables:', file=sys.stderr)
    print('     • Create/update .env file (ensure it\'s in .gitignore)', file=sys.stderr)
    print('     • Use process.env.SECRET_NAME (Node.js) or os.environ.get("SECRET_NAME") (Python)', file=sys.stderr)
    print('', file=sys.stderr)
    print('  2. Use a secrets management service:', file=sys.stderr)
    print('     • AWS Secrets Manager, Google Secret Manager, Azure Key Vault', file=sys.stderr)
    print('     • HashiCorp Vault, Doppler, 1Password', file=sys.stderr)
    print('', file=sys.stderr)
    print('  3. For false positives:', file=sys.stderr)
    print('     • Add comments with "example" or "placeholder" to skip detection', file=sys.stderr)
    print('     • Disable hook temporarily: remove from .claude/hooks.json', file=sys.stderr)
    print('', file=sys.stderr)

def main():
    # Read hook input from stdin (Claude Code passes JSON via stdin)
    try:
        input_data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        # If no valid JSON on stdin, allow the action
        sys.exit(0)

    # Only act on git commit commands
    tool_input = input_data.get('tool_input', {})
    command = tool_input.get('command', '')
    if not re.search(r'git\s+commit', command):
        sys.exit(0)

    # Get staged files
    staged_files = get_staged_files()

    # PreToolUse runs before the command, so files may not be staged yet.
    # Handle two cases:
    # 1. git commit -a/-am: scans tracked modified files (what -a would stage)
    # 2. git add ... && git commit: scans files from the git add part
    if not staged_files:
        # Check if commit uses -a flag (auto-stage tracked modified files)
        commit_match = re.search(r'git\s+commit\s+(.+)', command)
        if commit_match and re.search(r'-\w*a', commit_match.group(1)):
            result = subprocess.run(
                ['git', 'diff', '--name-only'],
                capture_output=True, text=True
            )
            for f in result.stdout.strip().split('\n'):
                if f.strip() and os.path.isfile(f.strip()):
                    staged_files.append(f.strip())

        # Check for chained git add ... && git commit
        for part in re.split(r'&&|;', command):
            part = part.strip()
            add_match = re.match(r'git\s+add\s+(.+)', part)
            if add_match:
                args = add_match.group(1).strip()
                if args in ('.', '-A', '--all'):
                    result = subprocess.run(
                        ['git', 'status', '--porcelain'],
                        capture_output=True, text=True
                    )
                    for line in result.stdout.strip().split('\n'):
                        if line and len(line) > 3:
                            f = line[3:].strip()
                            if os.path.isfile(f):
                                staged_files.append(f)
                else:
                    for token in args.split():
                        if not token.startswith('-') and os.path.isfile(token):
                            staged_files.append(token)

    if not staged_files:
        sys.exit(0)

    # Scan all staged files
    all_findings = []
    for file_path in staged_files:
        findings = scan_file(file_path)
        all_findings.extend(findings)

    # If we found any secrets, block the commit
    if all_findings:
        print_findings(all_findings)
        sys.exit(2)

    # No secrets found, allow commit
    sys.exit(0)

if __name__ == '__main__':
    main()
