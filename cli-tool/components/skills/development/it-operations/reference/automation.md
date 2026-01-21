# Automation and Orchestration

Comprehensive guide to IT automation, scripting, configuration management, orchestration tools, and reducing operational toil.

## Table of Contents
- [Automation Strategy](#automation-strategy)
- [Scripting Best Practices](#scripting-best-practices)
- [Configuration Management](#configuration-management)
- [Orchestration Tools](#orchestration-tools)
- [CI/CD for Infrastructure](#cicd-for-infrastructure)
- [Runbook Automation](#runbook-automation)
- [Self-Healing Systems](#self-healing-systems)
- [Toil Reduction](#toil-reduction)

## Automation Strategy

### When to Automate

```yaml
Automation Decision Framework:

High Priority (Automate Immediately):
  - Task performed > 10 times per week
  - Task is error-prone when done manually
  - Task requires precision (e.g., exact timing, complex steps)
  - Task performed outside business hours
  - Task blocks other work

  Examples:
    - Server provisioning
    - Deployment process
    - Backup operations
    - Certificate renewal
    - Log rotation

Medium Priority (Automate Within 3 Months):
  - Task performed 2-10 times per week
  - Task is time-consuming (> 30 minutes)
  - Task has multiple steps that could be forgotten
  - Task involves multiple systems

  Examples:
    - User account creation
    - Monthly reporting
    - Security patching
    - Capacity planning data collection

Low Priority (Consider Automation):
  - Task performed < 2 times per week
  - Task is simple and quick (< 5 minutes)
  - Task requires human judgment
  - Automation effort > 10x manual effort

  Examples:
    - One-off investigations
    - Ad-hoc queries
    - Executive requests

Don't Automate:
  - Task requires critical thinking
  - Task changes frequently (automation would break)
  - Task is performed once per year
  - Legal/compliance requires human oversight

  Examples:
    - Incident response decision-making
    - Architecture reviews
    - Contract negotiations
```

### Automation Maturity Model

```yaml
Level 0: Manual
  - All tasks performed manually
  - Documentation may exist
  - High error rate, inconsistent results
  - Tribal knowledge

Level 1: Documented
  - Detailed runbooks exist
  - Step-by-step procedures
  - Anyone can follow documentation
  - Still fully manual execution

Level 2: Scripted
  - Scripts automate individual tasks
  - Scripts run on-demand
  - Reduces errors, saves time
  - Scripts may live on individual machines

  Example: backup_database.sh

Level 3: Scheduled Automation
  - Scripts run on schedule (cron, systemd timers)
  - Central script repository (Git)
  - Logging and error handling
  - Notifications on failure

  Example: Daily backups via cron

Level 4: Event-Driven Automation
  - Automation triggered by events (alerts, webhooks)
  - Self-healing (auto-restart failed services)
  - Integration with monitoring systems
  - Closed-loop automation

  Example: Auto-scale on high CPU alert

Level 5: Intelligent Automation
  - Machine learning predicts issues
  - Proactive remediation before user impact
  - Continuous optimization
  - Full observability and feedback loops

  Example: Predictive auto-scaling based on traffic patterns
```

### ROI Calculation for Automation

```python
# Automation ROI Calculator

def calculate_automation_roi(
    manual_time_hours,
    frequency_per_month,
    hourly_cost,
    automation_development_hours,
    automation_maintenance_hours_per_month
):
    """
    Calculate ROI for automation project

    Args:
        manual_time_hours: Time to perform task manually (hours)
        frequency_per_month: How often task is performed per month
        hourly_cost: Cost per hour of engineer time ($)
        automation_development_hours: Time to develop automation (hours)
        automation_maintenance_hours_per_month: Ongoing maintenance (hours/month)

    Returns:
        dict with ROI metrics
    """

    # Monthly cost without automation
    monthly_manual_cost = manual_time_hours * frequency_per_month * hourly_cost

    # Annual manual cost
    annual_manual_cost = monthly_manual_cost * 12

    # Upfront automation cost
    automation_dev_cost = automation_development_hours * hourly_cost

    # Monthly automation maintenance cost
    monthly_automation_cost = automation_maintenance_hours_per_month * hourly_cost

    # Annual automation cost
    annual_automation_cost = monthly_automation_cost * 12

    # Annual savings
    annual_savings = annual_manual_cost - annual_automation_cost

    # Break-even time (months)
    if annual_savings > 0:
        break_even_months = automation_dev_cost / (annual_savings / 12)
    else:
        break_even_months = float('inf')

    # 3-year ROI
    three_year_savings = (annual_savings * 3) - automation_dev_cost
    roi_percentage = (three_year_savings / automation_dev_cost) * 100 if automation_dev_cost > 0 else 0

    return {
        'monthly_manual_cost': monthly_manual_cost,
        'annual_manual_cost': annual_manual_cost,
        'automation_dev_cost': automation_dev_cost,
        'annual_automation_cost': annual_automation_cost,
        'annual_savings': annual_savings,
        'break_even_months': break_even_months,
        'three_year_savings': three_year_savings,
        'roi_percentage': roi_percentage,
        'recommendation': 'Automate' if break_even_months < 12 else 'Consider alternatives'
    }

# Example: Database backup automation
result = calculate_automation_roi(
    manual_time_hours=2,              # 2 hours to backup manually
    frequency_per_month=30,           # Daily backups
    hourly_cost=75,                   # Engineer costs $75/hour
    automation_development_hours=16,  # 2 days to develop automation
    automation_maintenance_hours_per_month=1  # 1 hour/month maintenance
)

print("=== Automation ROI Analysis ===")
print(f"Monthly Manual Cost: ${result['monthly_manual_cost']:,.2f}")
print(f"Annual Manual Cost: ${result['annual_manual_cost']:,.2f}")
print(f"Automation Development Cost: ${result['automation_dev_cost']:,.2f}")
print(f"Annual Automation Cost: ${result['annual_automation_cost']:,.2f}")
print(f"Annual Savings: ${result['annual_savings']:,.2f}")
print(f"Break-even Time: {result['break_even_months']:.1f} months")
print(f"3-Year Savings: ${result['three_year_savings']:,.2f}")
print(f"3-Year ROI: {result['roi_percentage']:.0f}%")
print(f"Recommendation: {result['recommendation']}")

# Output:
# === Automation ROI Analysis ===
# Monthly Manual Cost: $4,500.00
# Annual Manual Cost: $54,000.00
# Automation Development Cost: $1,200.00
# Annual Automation Cost: $900.00
# Annual Savings: $53,100.00
# Break-even Time: 0.3 months
# 3-Year Savings: $158,100.00
# 3-Year ROI: 13175%
# Recommendation: Automate
```

## Scripting Best Practices

### Shell Scripting (Bash)

```bash
#!/bin/bash
#
# Script: server_health_check.sh
# Description: Perform comprehensive server health check
# Author: Ops Team
# Date: 2025-01-15
# Version: 1.0

# Strict error handling
set -euo pipefail  # Exit on error, undefined var, pipe failure
IFS=$'\n\t'        # Set internal field separator

# Configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly LOG_FILE="/var/log/health_check.log"
readonly EMAIL_TO="ops-team@example.com"
readonly DISK_THRESHOLD=80
readonly MEMORY_THRESHOLD=85
readonly CPU_THRESHOLD=90

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m' # No Color

# Logging function
log() {
    local level=$1
    shift
    local message="$@"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[${timestamp}] [${level}] ${message}" | tee -a "${LOG_FILE}"
}

# Error handling
error_exit() {
    log "ERROR" "$1"
    exit 1
}

# Cleanup on exit
cleanup() {
    log "INFO" "Cleaning up..."
    # Remove temp files, etc.
}
trap cleanup EXIT

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error_exit "This script must be run as root"
    fi
}

# Check disk space
check_disk_space() {
    log "INFO" "Checking disk space..."
    local status=0

    while read -r line; do
        local usage=$(echo "$line" | awk '{print $5}' | sed 's/%//')
        local mount=$(echo "$line" | awk '{print $6}')

        if [[ $usage -ge $DISK_THRESHOLD ]]; then
            log "WARN" "Disk usage on ${mount} is ${usage}% (threshold: ${DISK_THRESHOLD}%)"
            status=1
        else
            log "INFO" "Disk usage on ${mount} is ${usage}% - OK"
        fi
    done < <(df -h | grep -vE '^Filesystem|tmpfs|cdrom' | awk '{print $0}')

    return $status
}

# Check memory usage
check_memory() {
    log "INFO" "Checking memory usage..."

    local total_mem=$(free -m | awk '/^Mem:/{print $2}')
    local used_mem=$(free -m | awk '/^Mem:/{print $3}')
    local usage_pct=$((used_mem * 100 / total_mem))

    if [[ $usage_pct -ge $MEMORY_THRESHOLD ]]; then
        log "WARN" "Memory usage is ${usage_pct}% (threshold: ${MEMORY_THRESHOLD}%)"
        return 1
    else
        log "INFO" "Memory usage is ${usage_pct}% - OK"
        return 0
    fi
}

# Check CPU load
check_cpu() {
    log "INFO" "Checking CPU load..."

    local load_avg=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
    local cpu_count=$(nproc)
    local load_pct=$(echo "scale=2; ($load_avg / $cpu_count) * 100" | bc)
    local load_pct_int=${load_pct%.*}

    if [[ $load_pct_int -ge $CPU_THRESHOLD ]]; then
        log "WARN" "CPU load is ${load_pct}% (threshold: ${CPU_THRESHOLD}%)"
        return 1
    else
        log "INFO" "CPU load is ${load_pct}% - OK"
        return 0
    fi
}

# Check critical services
check_services() {
    log "INFO" "Checking critical services..."
    local services=("sshd" "nginx" "postgresql")
    local status=0

    for service in "${services[@]}"; do
        if systemctl is-active --quiet "$service"; then
            log "INFO" "Service ${service} is running - OK"
        else
            log "ERROR" "Service ${service} is NOT running"
            status=1
        fi
    done

    return $status
}

# Check network connectivity
check_network() {
    log "INFO" "Checking network connectivity..."
    local hosts=("8.8.8.8" "1.1.1.1")
    local status=0

    for host in "${hosts[@]}"; do
        if ping -c 3 -W 5 "$host" &>/dev/null; then
            log "INFO" "Network connectivity to ${host} - OK"
        else
            log "ERROR" "Cannot reach ${host}"
            status=1
        fi
    done

    return $status
}

# Generate report
generate_report() {
    local overall_status=$1

    cat <<EOF > /tmp/health_report.txt
Server Health Check Report
==========================
Hostname: $(hostname)
Date: $(date)
Status: $([[ $overall_status -eq 0 ]] && echo "HEALTHY" || echo "ISSUES DETECTED")

Details:
$(tail -n 50 "${LOG_FILE}")

EOF

    # Email report if issues detected
    if [[ $overall_status -ne 0 ]]; then
        mail -s "ALERT: Health Check Failed on $(hostname)" "${EMAIL_TO}" < /tmp/health_report.txt
    fi
}

# Main execution
main() {
    log "INFO" "Starting server health check..."

    local overall_status=0

    check_root
    check_disk_space || overall_status=1
    check_memory || overall_status=1
    check_cpu || overall_status=1
    check_services || overall_status=1
    check_network || overall_status=1

    if [[ $overall_status -eq 0 ]]; then
        log "INFO" "All health checks passed"
    else
        log "WARN" "Some health checks failed"
    fi

    generate_report $overall_status

    log "INFO" "Health check complete"
    exit $overall_status
}

# Run main function
main "$@"
```

### Python Automation Scripts

```python
#!/usr/bin/env python3
"""
User account management automation

Automates user provisioning across multiple systems
"""

import argparse
import logging
import sys
import subprocess
import json
from typing import Dict, List, Optional
from pathlib import Path
import yaml

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/var/log/user_management.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)


class UserManagementError(Exception):
    """Custom exception for user management errors"""
    pass


class UserManager:
    """Manages user accounts across systems"""

    def __init__(self, config_file: str):
        self.config = self._load_config(config_file)
        self.dry_run = False

    def _load_config(self, config_file: str) -> Dict:
        """Load configuration from YAML file"""
        try:
            with open(config_file, 'r') as f:
                return yaml.safe_load(f)
        except Exception as e:
            logger.error(f"Failed to load config: {e}")
            raise UserManagementError(f"Config load failed: {e}")

    def _run_command(self, cmd: List[str], check: bool = True) -> subprocess.CompletedProcess:
        """Execute shell command with error handling"""
        logger.debug(f"Executing command: {' '.join(cmd)}")

        if self.dry_run:
            logger.info(f"[DRY RUN] Would execute: {' '.join(cmd)}")
            return subprocess.CompletedProcess(cmd, 0, '', '')

        try:
            result = subprocess.run(
                cmd,
                check=check,
                capture_output=True,
                text=True,
                timeout=30
            )
            return result
        except subprocess.CalledProcessError as e:
            logger.error(f"Command failed: {e.stderr}")
            raise UserManagementError(f"Command failed: {e}")
        except subprocess.TimeoutExpired:
            logger.error(f"Command timed out: {' '.join(cmd)}")
            raise UserManagementError("Command timeout")

    def user_exists(self, username: str) -> bool:
        """Check if user exists"""
        result = self._run_command(['id', username], check=False)
        return result.returncode == 0

    def create_user(
        self,
        username: str,
        full_name: str,
        email: str,
        groups: Optional[List[str]] = None,
        ssh_public_key: Optional[str] = None
    ) -> None:
        """Create user account with specified attributes"""

        logger.info(f"Creating user: {username}")

        if self.user_exists(username):
            logger.warning(f"User {username} already exists")
            return

        # Create user
        cmd = ['useradd', '-m', '-s', '/bin/bash']

        if full_name:
            cmd.extend(['-c', full_name])

        if groups:
            cmd.extend(['-G', ','.join(groups)])

        cmd.append(username)

        self._run_command(cmd)

        # Set up SSH key
        if ssh_public_key:
            self._setup_ssh_key(username, ssh_public_key)

        # Send welcome email (pseudo-code)
        # self._send_welcome_email(username, email)

        logger.info(f"User {username} created successfully")

    def _setup_ssh_key(self, username: str, public_key: str) -> None:
        """Set up SSH public key for user"""

        logger.info(f"Setting up SSH key for {username}")

        # Create .ssh directory
        ssh_dir = Path(f"/home/{username}/.ssh")
        ssh_dir.mkdir(mode=0o700, exist_ok=True)

        # Write authorized_keys
        authorized_keys = ssh_dir / "authorized_keys"
        authorized_keys.write_text(public_key + "\n")
        authorized_keys.chmod(0o600)

        # Set ownership
        self._run_command(['chown', '-R', f'{username}:{username}', str(ssh_dir)])

    def delete_user(self, username: str, remove_home: bool = False) -> None:
        """Delete user account"""

        logger.info(f"Deleting user: {username}")

        if not self.user_exists(username):
            logger.warning(f"User {username} does not exist")
            return

        cmd = ['userdel']
        if remove_home:
            cmd.append('-r')
        cmd.append(username)

        self._run_command(cmd)

        logger.info(f"User {username} deleted successfully")

    def modify_user_groups(self, username: str, groups: List[str]) -> None:
        """Modify user's group membership"""

        logger.info(f"Modifying groups for {username}")

        if not self.user_exists(username):
            raise UserManagementError(f"User {username} does not exist")

        # Set supplementary groups
        cmd = ['usermod', '-G', ','.join(groups), username]
        self._run_command(cmd)

        logger.info(f"Groups updated for {username}")

    def list_users(self) -> List[Dict[str, str]]:
        """List all users on the system"""

        logger.info("Listing all users")

        users = []
        with open('/etc/passwd', 'r') as f:
            for line in f:
                parts = line.strip().split(':')
                if int(parts[2]) >= 1000:  # Only regular users
                    users.append({
                        'username': parts[0],
                        'uid': parts[2],
                        'home': parts[5],
                        'shell': parts[6]
                    })

        return users

    def bulk_create_users(self, users_file: str) -> None:
        """Create multiple users from CSV file"""

        logger.info(f"Bulk creating users from {users_file}")

        import csv

        with open(users_file, 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    self.create_user(
                        username=row['username'],
                        full_name=row.get('full_name', ''),
                        email=row.get('email', ''),
                        groups=row.get('groups', '').split(',') if row.get('groups') else None,
                        ssh_public_key=row.get('ssh_public_key')
                    )
                except Exception as e:
                    logger.error(f"Failed to create user {row['username']}: {e}")


def main():
    parser = argparse.ArgumentParser(description='User account management automation')
    parser.add_argument('--config', default='/etc/user_mgmt/config.yaml', help='Config file path')
    parser.add_argument('--dry-run', action='store_true', help='Dry run mode')

    subparsers = parser.add_subparsers(dest='command', help='Command to execute')

    # Create user
    create_parser = subparsers.add_parser('create', help='Create user')
    create_parser.add_argument('username', help='Username')
    create_parser.add_argument('--full-name', help='Full name')
    create_parser.add_argument('--email', help='Email address')
    create_parser.add_argument('--groups', help='Comma-separated groups')
    create_parser.add_argument('--ssh-key', help='SSH public key')

    # Delete user
    delete_parser = subparsers.add_parser('delete', help='Delete user')
    delete_parser.add_argument('username', help='Username')
    delete_parser.add_argument('--remove-home', action='store_true', help='Remove home directory')

    # List users
    list_parser = subparsers.add_parser('list', help='List users')

    # Bulk create
    bulk_parser = subparsers.add_parser('bulk-create', help='Bulk create users')
    bulk_parser.add_argument('csv_file', help='CSV file with user data')

    args = parser.parse_args()

    # Initialize manager
    manager = UserManager(args.config)
    manager.dry_run = args.dry_run

    # Execute command
    try:
        if args.command == 'create':
            groups = args.groups.split(',') if args.groups else None
            manager.create_user(
                args.username,
                args.full_name or '',
                args.email or '',
                groups,
                args.ssh_key
            )

        elif args.command == 'delete':
            manager.delete_user(args.username, args.remove_home)

        elif args.command == 'list':
            users = manager.list_users()
            for user in users:
                print(f"{user['username']}\t{user['uid']}\t{user['home']}")

        elif args.command == 'bulk-create':
            manager.bulk_create_users(args.csv_file)

        else:
            parser.print_help()
            sys.exit(1)

    except UserManagementError as e:
        logger.error(f"Operation failed: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
```

## Configuration Management

### Ansible Playbooks

```yaml
# playbook.yml - Web server setup playbook

---
- name: Configure web servers
  hosts: webservers
  become: yes
  vars:
    nginx_port: 80
    app_user: webapp
    app_path: /var/www/myapp

  tasks:
    # System updates
    - name: Update apt cache
      apt:
        update_cache: yes
        cache_valid_time: 3600
      when: ansible_os_family == "Debian"

    # Install packages
    - name: Install required packages
      apt:
        name:
          - nginx
          - python3-pip
          - git
          - ufw
        state: present

    # Create application user
    - name: Create application user
      user:
        name: "{{ app_user }}"
        shell: /bin/bash
        create_home: yes
        system: no

    # Configure firewall
    - name: Configure UFW
      ufw:
        rule: allow
        port: "{{ item }}"
        proto: tcp
      loop:
        - 22
        - 80
        - 443

    - name: Enable UFW
      ufw:
        state: enabled
        policy: deny

    # Deploy application
    - name: Create application directory
      file:
        path: "{{ app_path }}"
        state: directory
        owner: "{{ app_user }}"
        group: "{{ app_user }}"
        mode: '0755'

    - name: Clone application repository
      git:
        repo: 'https://github.com/example/myapp.git'
        dest: "{{ app_path }}"
        version: main
      become_user: "{{ app_user }}"
      notify: restart nginx

    # Configure Nginx
    - name: Deploy Nginx configuration
      template:
        src: templates/nginx.conf.j2
        dest: /etc/nginx/sites-available/myapp
        owner: root
        group: root
        mode: '0644'
      notify: restart nginx

    - name: Enable Nginx site
      file:
        src: /etc/nginx/sites-available/myapp
        dest: /etc/nginx/sites-enabled/myapp
        state: link
      notify: restart nginx

    - name: Remove default Nginx site
      file:
        path: /etc/nginx/sites-enabled/default
        state: absent
      notify: restart nginx

    # Install application dependencies
    - name: Install Python dependencies
      pip:
        requirements: "{{ app_path }}/requirements.txt"
        virtualenv: "{{ app_path }}/venv"
        virtualenv_command: python3 -m venv
      become_user: "{{ app_user }}"

    # Configure systemd service
    - name: Deploy systemd service file
      template:
        src: templates/myapp.service.j2
        dest: /etc/systemd/system/myapp.service
        owner: root
        group: root
        mode: '0644'
      notify: restart myapp

    - name: Enable and start application service
      systemd:
        name: myapp
        enabled: yes
        state: started
        daemon_reload: yes

    # Monitoring
    - name: Install node_exporter
      include_role:
        name: node_exporter

  handlers:
    - name: restart nginx
      service:
        name: nginx
        state: restarted

    - name: restart myapp
      service:
        name: myapp
        state: restarted

# Nginx template (templates/nginx.conf.j2)
---
server {
    listen {{ nginx_port }};
    server_name {{ ansible_hostname }};

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /static {
        alias {{ app_path }}/static;
    }
}
```

### Ansible Inventory

```ini
# inventory/production.ini

[webservers]
web01.example.com ansible_host=10.0.10.20
web02.example.com ansible_host=10.0.10.21
web03.example.com ansible_host=10.0.10.22

[databases]
db01.example.com ansible_host=10.0.30.10
db02.example.com ansible_host=10.0.30.11

[monitoring]
mon01.example.com ansible_host=10.0.99.10

[all:vars]
ansible_user=ansible
ansible_become=yes
ansible_python_interpreter=/usr/bin/python3

[webservers:vars]
nginx_port=80
environment=production
```

### Running Ansible

```bash
# Check syntax
ansible-playbook playbook.yml --syntax-check

# Dry run (check mode)
ansible-playbook -i inventory/production.ini playbook.yml --check

# Run playbook
ansible-playbook -i inventory/production.ini playbook.yml

# Run specific tags
ansible-playbook -i inventory/production.ini playbook.yml --tags "nginx,app"

# Limit to specific hosts
ansible-playbook -i inventory/production.ini playbook.yml --limit web01.example.com

# Run ad-hoc command
ansible webservers -i inventory/production.ini -m shell -a "uptime"
ansible webservers -i inventory/production.ini -m apt -a "name=nginx state=latest" --become
```

## Orchestration Tools

### Terraform for Infrastructure Orchestration

See [infrastructure.md](infrastructure.md#infrastructure-as-code) for detailed Terraform examples.

### Kubernetes Operators (Advanced Automation)

```yaml
# Custom Kubernetes Operator for database backups
# backup-operator.yaml

apiVersion: v1
kind: ServiceAccount
metadata:
  name: backup-operator
  namespace: operators

---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: backup-operator
rules:
  - apiGroups: [""]
    resources: ["pods", "secrets"]
    verbs: ["get", "list", "create"]
  - apiGroups: ["batch"]
    resources: ["cronjobs", "jobs"]
    verbs: ["get", "list", "create", "update", "delete"]

---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: backup-operator
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: backup-operator
subjects:
  - kind: ServiceAccount
    name: backup-operator
    namespace: operators

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backup-operator
  namespace: operators
spec:
  replicas: 1
  selector:
    matchLabels:
      app: backup-operator
  template:
    metadata:
      labels:
        app: backup-operator
    spec:
      serviceAccountName: backup-operator
      containers:
        - name: operator
          image: myregistry/backup-operator:latest
          env:
            - name: WATCH_NAMESPACE
              value: ""
            - name: POD_NAME
              valueFrom:
                fieldRef:
                  fieldPath: metadata.name
            - name: OPERATOR_NAME
              value: "backup-operator"
```

## CI/CD for Infrastructure

### GitOps Workflow

```yaml
# GitOps workflow for infrastructure changes

Step 1: Developer makes change
  - Edit Terraform/Ansible files
  - Commit to feature branch
  - Open pull request

Step 2: Automated validation (CI)
  - terraform fmt -check (code formatting)
  - terraform validate (syntax check)
  - tflint (linting)
  - terraform plan (dry run)
  - Security scan (Checkov, tfsec)
  - Cost estimation (Infracost)

Step 3: Peer review
  - Code review by team member
  - Review terraform plan output
  - Approve or request changes

Step 4: Merge to main
  - PR approved and merged
  - Triggers deployment pipeline

Step 5: Automated deployment (CD)
  - terraform apply (auto-approved for specific changes)
  - Or manual approval for high-risk changes
  - Post-deployment validation
  - Notify team in Slack

Step 6: Monitoring
  - Monitor for issues
  - Auto-rollback on failure
  - Update status page
```

### GitHub Actions for Infrastructure

```yaml
# .github/workflows/terraform.yml

name: Terraform CI/CD

on:
  pull_request:
    branches: [main]
    paths:
      - 'terraform/**'
  push:
    branches: [main]
    paths:
      - 'terraform/**'

env:
  TF_VERSION: 1.6.0
  AWS_REGION: us-east-1

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v2
        with:
          terraform_version: ${{ env.TF_VERSION }}

      - name: Terraform Format Check
        run: terraform fmt -check -recursive
        working-directory: ./terraform

      - name: Terraform Init
        run: terraform init
        working-directory: ./terraform

      - name: Terraform Validate
        run: terraform validate
        working-directory: ./terraform

      - name: TFLint
        uses: terraform-linters/setup-tflint@v3
        with:
          tflint_version: latest

      - name: Run TFLint
        run: tflint --recursive
        working-directory: ./terraform

  plan:
    runs-on: ubuntu-latest
    needs: validate
    if: github.event_name == 'pull_request'
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v2
        with:
          terraform_version: ${{ env.TF_VERSION }}

      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Terraform Init
        run: terraform init
        working-directory: ./terraform

      - name: Terraform Plan
        run: terraform plan -out=tfplan
        working-directory: ./terraform

      - name: Comment PR with Plan
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const plan = fs.readFileSync('./terraform/tfplan', 'utf8');
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## Terraform Plan\n\`\`\`\n${plan}\n\`\`\``
            });

  apply:
    runs-on: ubuntu-latest
    needs: validate
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v2
        with:
          terraform_version: ${{ env.TF_VERSION }}

      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Terraform Init
        run: terraform init
        working-directory: ./terraform

      - name: Terraform Apply
        run: terraform apply -auto-approve
        working-directory: ./terraform

      - name: Notify Slack
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Terraform applied successfully'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
        if: always()
```

## Runbook Automation

### ChatOps Integration

```python
# Slack bot for runbook automation

from slack_bolt import App
from slack_bolt.adapter.socket_mode import SocketModeHandler
import subprocess
import logging

app = App(token="xoxb-your-token")

logging.basicConfig(level=logging.INFO)

# Command: restart service
@app.command("/restart-service")
def restart_service_command(ack, command, respond):
    ack()

    service_name = command['text']

    # Validate service name (whitelist)
    allowed_services = ['nginx', 'postgresql', 'redis']

    if service_name not in allowed_services:
        respond(f"❌ Service '{service_name}' is not allowed. Allowed: {', '.join(allowed_services)}")
        return

    # Confirm with user
    respond(f"Restarting service: {service_name}...")

    try:
        # Execute restart command
        result = subprocess.run(
            ['ansible', 'webservers', '-m', 'service', '-a', f'name={service_name} state=restarted'],
            capture_output=True,
            text=True,
            timeout=30
        )

        if result.returncode == 0:
            respond(f"✅ Service {service_name} restarted successfully\n```{result.stdout}```")
        else:
            respond(f"❌ Failed to restart {service_name}\n```{result.stderr}```")

    except Exception as e:
        respond(f"❌ Error: {str(e)}")

# Command: check server health
@app.command("/health-check")
def health_check_command(ack, command, respond):
    ack()

    hostname = command['text'] or 'all'

    respond(f"Running health check on {hostname}...")

    try:
        result = subprocess.run(
            ['ansible', hostname, '-m', 'shell', '-a', '/opt/scripts/health_check.sh'],
            capture_output=True,
            text=True,
            timeout=60
        )

        respond(f"```{result.stdout}```")

    except Exception as e:
        respond(f"❌ Error: {str(e)}")

# Interactive approval flow
@app.action("approve_deployment")
def handle_approval(ack, body, client):
    ack()

    user = body["user"]["id"]
    deployment_id = body["actions"][0]["value"]

    # Execute deployment
    result = execute_deployment(deployment_id)

    client.chat_postMessage(
        channel=body["channel"]["id"],
        text=f"<@{user}> approved deployment {deployment_id}. Status: {result}"
    )

def execute_deployment(deployment_id):
    # Deployment logic here
    return "Success"

if __name__ == "__main__":
    handler = SocketModeHandler(app, "xapp-your-app-token")
    handler.start()
```

## Self-Healing Systems

### Auto-Remediation Framework

```python
# Self-healing automation framework

import time
import logging
from prometheus_client import start_http_server, Counter, Gauge
import requests

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Metrics
remediation_counter = Counter('remediations_total', 'Total remediations', ['type', 'status'])
system_health = Gauge('system_health', 'System health status (1=healthy, 0=unhealthy)')


class SelfHealingAgent:
    """Auto-remediation agent that monitors and fixes common issues"""

    def __init__(self):
        self.checks = [
            self.check_disk_space,
            self.check_service_health,
            self.check_memory_usage,
        ]

    def check_disk_space(self):
        """Check disk space and clean up if needed"""
        import shutil

        stat = shutil.disk_usage('/')
        usage_pct = (stat.used / stat.total) * 100

        if usage_pct > 85:
            logger.warning(f"Disk usage high: {usage_pct:.1f}%")
            self.cleanup_disk()
            remediation_counter.labels(type='disk_cleanup', status='executed').inc()
            return False

        return True

    def cleanup_disk(self):
        """Clean up disk space"""
        import subprocess

        logger.info("Cleaning up disk space...")

        # Clean apt cache
        subprocess.run(['apt-get', 'clean'], check=False)

        # Clean old logs
        subprocess.run(['find', '/var/log', '-name', '*.gz', '-mtime', '+30', '-delete'], check=False)

        # Clean temp files
        subprocess.run(['find', '/tmp', '-mtime', '+7', '-delete'], check=False)

        logger.info("Disk cleanup complete")

    def check_service_health(self):
        """Check if critical services are running"""
        import subprocess

        services = ['nginx', 'postgresql']
        all_healthy = True

        for service in services:
            result = subprocess.run(
                ['systemctl', 'is-active', service],
                capture_output=True,
                text=True
            )

            if result.returncode != 0:
                logger.warning(f"Service {service} is not running")
                self.restart_service(service)
                all_healthy = False

        return all_healthy

    def restart_service(self, service_name):
        """Restart a failed service"""
        import subprocess

        logger.info(f"Restarting service: {service_name}")

        try:
            subprocess.run(['systemctl', 'restart', service_name], check=True, timeout=30)
            logger.info(f"Service {service_name} restarted successfully")
            remediation_counter.labels(type='service_restart', status='success').inc()

        except Exception as e:
            logger.error(f"Failed to restart {service_name}: {e}")
            remediation_counter.labels(type='service_restart', status='failed').inc()

    def check_memory_usage(self):
        """Check memory usage and kill memory hogs if needed"""
        import psutil

        mem = psutil.virtual_memory()
        usage_pct = mem.percent

        if usage_pct > 90:
            logger.warning(f"Memory usage critical: {usage_pct:.1f}%")
            self.kill_memory_hogs()
            remediation_counter.labels(type='memory_cleanup', status='executed').inc()
            return False

        return True

    def kill_memory_hogs(self):
        """Kill processes using excessive memory"""
        import psutil

        logger.info("Identifying memory hogs...")

        # Get processes sorted by memory usage
        processes = []
        for proc in psutil.process_iter(['pid', 'name', 'memory_percent']):
            try:
                processes.append(proc.info)
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass

        processes.sort(key=lambda x: x['memory_percent'], reverse=True)

        # Kill top memory consumer (with safety checks)
        for proc in processes[:3]:  # Check top 3
            # Don't kill critical processes
            if proc['name'] in ['systemd', 'init', 'sshd']:
                continue

            if proc['memory_percent'] > 20:  # Using more than 20% memory
                logger.warning(f"Killing memory hog: {proc['name']} (PID {proc['pid']})")
                try:
                    psutil.Process(proc['pid']).kill()
                    break
                except Exception as e:
                    logger.error(f"Failed to kill process: {e}")

    def run(self, interval=60):
        """Run continuous health checks"""
        logger.info("Starting self-healing agent...")

        while True:
            try:
                all_healthy = True

                for check in self.checks:
                    if not check():
                        all_healthy = False

                system_health.set(1 if all_healthy else 0)

                time.sleep(interval)

            except Exception as e:
                logger.error(f"Error in health check loop: {e}")
                time.sleep(interval)


if __name__ == '__main__':
    # Start Prometheus metrics server
    start_http_server(9101)

    # Run agent
    agent = SelfHealingAgent()
    agent.run(interval=60)
```

## Toil Reduction

### Measuring Toil

```yaml
Toil Definition (Google SRE):
  - Manual: Requires human intervention
  - Repetitive: Done over and over
  - Automatable: Can be automated
  - Tactical: Interrupt-driven, reactive
  - No enduring value: Doesn't improve system
  - Scales linearly: Grows with service

Examples of Toil:
  - Manually restarting services
  - Copying files between servers
  - Running deployment scripts manually
  - Responding to recurring alerts
  - Manual user provisioning
  - Generating reports manually

Target: < 50% of time on toil (Google SRE recommendation)
```

### Toil Reduction Strategy

```yaml
Step 1: Identify Toil (Weekly)
  - Track time spent on tasks
  - Categorize: Toil vs Engineering work
  - Prioritize by time impact

  Tool: Time tracking spreadsheet
  Columns: Task, Time Spent, Frequency, Automatable?, Priority

Step 2: Quantify Impact
  - Calculate time spent per month
  - Estimate automation effort
  - Calculate ROI (see ROI calculator above)

Step 3: Automate High-Impact Toil
  - Start with highest ROI
  - Build automation incrementally
  - Test thoroughly
  - Document automation

Step 4: Measure Improvement
  - Track toil percentage monthly
  - Celebrate wins
  - Share automations across team

Step 5: Prevent New Toil
  - Question new manual processes
  - Design for automation from start
  - Code review includes automation check
```

This comprehensive automation guide provides everything needed to reduce toil and improve operational efficiency through automation.
