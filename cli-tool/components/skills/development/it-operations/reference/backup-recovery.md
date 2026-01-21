# Backup and Disaster Recovery

Comprehensive guide to backup strategies, disaster recovery planning, business continuity, and data protection for IT operations.

## Table of Contents
- [Backup Strategy](#backup-strategy)
- [Backup Types](#backup-types)
- [Backup Tools](#backup-tools)
- [Disaster Recovery Planning](#disaster-recovery-planning)
- [Business Continuity](#business-continuity)
- [Recovery Testing](#recovery-testing)
- [Cloud Backup Solutions](#cloud-backup-solutions)
- [Database Backups](#database-backups)
- [Backup Monitoring](#backup-monitoring)

## Backup Strategy

### 3-2-1 Backup Rule

```yaml
The Gold Standard: 3-2-1 Rule

3 Copies of Data:
  - 1 Production copy
  - 2 Backup copies

2 Different Media Types:
  - Local storage (NAS, SAN)
  - Cloud storage (S3, Azure Blob)
  - Or: Disk + Tape

1 Offsite Copy:
  - Geographic separation
  - Protection against site disasters
  - Cloud storage or remote datacenter

Example Implementation:
  Production: Database server (primary)
  Backup 1: Local NAS (hourly snapshots)
  Backup 2: Cloud storage S3 (daily backups)
  Result: 3 copies, 2 media (disk + cloud), 1 offsite (cloud)
```

### Backup Policy Framework

```yaml
RPO (Recovery Point Objective):
  Definition: Maximum acceptable data loss (time)
  Question: "How much data can we afford to lose?"

  Examples:
    Critical databases: RPO = 15 minutes (need transaction log backups)
    File servers: RPO = 24 hours (daily backups acceptable)
    Development servers: RPO = 7 days (weekly backups)

RTO (Recovery Time Objective):
  Definition: Maximum acceptable downtime (time)
  Question: "How quickly must we recover?"

  Examples:
    E-commerce site: RTO = 1 hour (hot standby, fast recovery)
    Internal tools: RTO = 8 hours (restore from backup)
    Archive data: RTO = 72 hours (restore from tape/glacier)

Retention Policy:
  Daily backups: Keep 7 days
  Weekly backups: Keep 4 weeks
  Monthly backups: Keep 12 months
  Yearly backups: Keep 7 years (compliance)

  Grandfather-Father-Son (GFS) Rotation:
    Son: Daily backups (7 days)
    Father: Weekly backups (4 weeks)
    Grandfather: Monthly backups (12 months)
```

### Backup Matrix

| System | Criticality | RPO | RTO | Backup Frequency | Retention | Method |
|--------|-------------|-----|-----|------------------|-----------|--------|
| Production Database | Critical | 15 min | 1 hour | Continuous (transaction logs) + Daily full | 30 days | Replication + Snapshots |
| Application Servers | High | 1 hour | 4 hours | Hourly incremental | 7 days | Agent-based |
| File Servers | Medium | 24 hours | 8 hours | Daily | 30 days | Filesystem snapshots |
| Development | Low | 7 days | 24 hours | Weekly | 14 days | Full backup |
| Workstations | Low | N/A | N/A | User responsibility | N/A | Cloud sync |

## Backup Types

### Full Backup

```yaml
Description:
  - Complete copy of all data
  - Self-contained (no dependencies)

Pros:
  - Simplest to restore (single backup set)
  - Fastest restore time
  - No dependency on other backups

Cons:
  - Slowest backup time
  - Largest storage requirement
  - Most network bandwidth

Use Case:
  - Weekly or monthly baseline
  - Small datasets (< 1 TB)
  - High-priority systems

Time Required:
  - 1 TB database: 2-4 hours (to disk)
  - 10 TB file server: 20-40 hours
```

### Incremental Backup

```yaml
Description:
  - Only backs up changes since last backup (full or incremental)
  - Creates chain of dependencies

Pros:
  - Fastest backup time
  - Smallest storage requirement
  - Least network bandwidth

Cons:
  - Slowest restore (need full + all incrementals)
  - Higher restore complexity
  - Chain dependency (missing link = data loss)

Use Case:
  - Daily/hourly backups
  - Large datasets with small changes
  - Bandwidth-constrained environments

Time Required:
  - Daily changes (10 GB): 5-15 minutes

Restore Process:
  1. Restore full backup (baseline)
  2. Apply incremental 1
  3. Apply incremental 2
  4. ... apply all incrementals in order
```

### Differential Backup

```yaml
Description:
  - Backs up changes since last FULL backup
  - Each differential is cumulative

Pros:
  - Faster restore than incremental (only need full + latest differential)
  - Simpler dependency chain
  - Easier to manage than incremental

Cons:
  - Slower than incremental (growing backup size)
  - More storage than incremental

Use Case:
  - Compromise between full and incremental
  - Weekly full + daily differentials

Time Required:
  - Day 1 differential: 10 GB (15 min)
  - Day 2 differential: 20 GB (30 min)
  - Day 6 differential: 60 GB (90 min)

Restore Process:
  1. Restore full backup
  2. Apply latest differential only
```

### Snapshot Backup

```yaml
Description:
  - Point-in-time copy using storage features
  - Copy-on-write or redirect-on-write
  - Nearly instantaneous

Pros:
  - Very fast to create (seconds)
  - Minimal performance impact
  - Multiple snapshots (hourly, daily)
  - Fast rollback

Cons:
  - Depends on source storage (not offsite)
  - Storage overhead grows over time
  - Limited retention (storage capacity)

Use Case:
  - Frequent recovery points (hourly)
  - VM backups
  - Database consistency points
  - Pre-change snapshots

Examples:
  - LVM snapshots (Linux)
  - ZFS snapshots
  - VMware snapshots
  - AWS EBS snapshots
```

### Continuous Data Protection (CDP)

```yaml
Description:
  - Real-time or near real-time replication
  - Every change is captured
  - Can recover to any point in time

Pros:
  - RPO near zero (< 1 minute)
  - Granular recovery (any point in time)
  - No backup windows

Cons:
  - Most expensive
  - Complex to implement
  - High bandwidth requirements

Use Case:
  - Mission-critical databases
  - Financial systems
  - Zero data loss requirement

Examples:
  - Database replication (PostgreSQL streaming replication)
  - Storage replication (DRBD, ZFS replication)
  - Application-level replication
```

## Backup Tools

### Open Source Backup Tools

**Rsync (File-level)**:
```bash
#!/bin/bash
# Rsync backup script with rotation

SOURCE="/var/www"
DEST="/backup/www"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${DEST}/${DATE}"
LATEST_LINK="${DEST}/latest"

# Create backup with hard links to previous backup (space-efficient)
rsync -avH \
  --delete \
  --link-dest="${LATEST_LINK}" \
  "${SOURCE}/" \
  "${BACKUP_DIR}/"

# Update latest symlink
rm -f "${LATEST_LINK}"
ln -s "${BACKUP_DIR}" "${LATEST_LINK}"

# Retention: Keep 7 daily backups
find "${DEST}" -maxdepth 1 -type d -mtime +7 -exec rm -rf {} \;

echo "Backup completed: ${BACKUP_DIR}"
```

**Restic (Encrypted, deduplicated backups)**:
```bash
#!/bin/bash
# Restic backup to S3

export RESTIC_REPOSITORY="s3:s3.amazonaws.com/my-backup-bucket"
export RESTIC_PASSWORD="your-encryption-password"
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"

# Initialize repository (first time only)
# restic init

# Backup
restic backup /var/www /etc --exclude="*.log" --tag daily

# Verify backup
restic check

# List snapshots
restic snapshots

# Retention: Keep last 7 daily, 4 weekly, 12 monthly
restic forget --keep-daily 7 --keep-weekly 4 --keep-monthly 12 --prune

# Restore (to different location)
# restic restore latest --target /tmp/restore
```

**Borg Backup (Deduplicated, compressed)**:
```bash
#!/bin/bash
# Borg backup script

REPO="/backup/borg-repo"
HOSTNAME=$(hostname)

# Initialize repository (first time only)
# borg init --encryption=repokey ${REPO}

# Create backup
borg create \
  --verbose \
  --stats \
  --compression lz4 \
  ${REPO}::${HOSTNAME}-$(date +%Y%m%d_%H%M%S) \
  /var/www \
  /etc \
  --exclude '/var/www/cache/*' \
  --exclude '*.tmp'

# Prune old backups
borg prune \
  --verbose \
  --list \
  ${REPO} \
  --prefix ${HOSTNAME}- \
  --keep-daily 7 \
  --keep-weekly 4 \
  --keep-monthly 6

# List backups
borg list ${REPO}

# Restore
# borg extract ${REPO}::${HOSTNAME}-20250115_120000
```

**Bacula (Enterprise backup suite)**:
```conf
# /etc/bacula/bacula-dir.conf - Director configuration

Director {
  Name = backup-dir
  DIRport = 9101
  QueryFile = "/etc/bacula/query.sql"
  WorkingDirectory = "/var/lib/bacula"
  PidDirectory = "/var/run/bacula"
  Maximum Concurrent Jobs = 20
  Password = "director-password"
  Messages = Daemon
}

# File sets
FileSet {
  Name = "WebServer Files"
  Include {
    Options {
      signature = MD5
      compression = GZIP
    }
    File = /var/www
    File = /etc/nginx
  }
  Exclude {
    File = /var/www/cache
  }
}

# Job definition
Job {
  Name = "WebServerBackup"
  Type = Backup
  Level = Incremental
  Client = webserver01-fd
  FileSet = "WebServer Files"
  Schedule = "WeeklyCycle"
  Storage = File
  Messages = Standard
  Pool = Default
  Priority = 10
  Write Bootstrap = "/var/lib/bacula/%c.bsr"
}

# Schedule
Schedule {
  Name = "WeeklyCycle"
  Run = Full 1st sun at 23:05
  Run = Differential 2nd-5th sun at 23:05
  Run = Incremental mon-sat at 23:05
}

# Client
Client {
  Name = webserver01-fd
  Address = 10.0.10.20
  FDPort = 9102
  Catalog = MyCatalog
  Password = "client-password"
  File Retention = 30 days
  Job Retention = 6 months
  AutoPrune = yes
}
```

### Commercial Backup Solutions

```yaml
Veeam Backup & Replication:
  Best For: VMware, Hyper-V environments
  Features:
    - VM-aware backups
    - Instant VM recovery
    - Replication
    - Cloud backups
  Pricing: $$$

Commvault:
  Best For: Large enterprises
  Features:
    - Multi-platform (VM, physical, cloud)
    - Compliance and e-discovery
    - Data classification
  Pricing: $$$$

Acronis Cyber Backup:
  Best For: MSPs, SMBs
  Features:
    - Image-based backups
    - Anti-ransomware
    - Cloud integration
  Pricing: $$

Rubrik:
  Best For: Modern enterprises
  Features:
    - Cloud-native architecture
    - Instant recovery
    - Policy-driven automation
  Pricing: $$$$
```

## Disaster Recovery Planning

### DR Site Types

```yaml
Cold Site:
  Description: Empty datacenter space with basic infrastructure
  RTO: Days to weeks
  Cost: $
  Use Case: Non-critical systems, tight budget

  Includes:
    - Physical space
    - Power and cooling
    - Network connectivity
  Does NOT Include:
    - Hardware
    - Software
    - Data

Warm Site:
  Description: Partially equipped datacenter with some systems ready
  RTO: Hours to days
  Cost: $$
  Use Case: Medium criticality, balanced budget

  Includes:
    - Hardware installed
    - Software installed
    - Network configured
    - Older backups restored
  Missing:
    - Latest data (must restore from backup)

Hot Site:
  Description: Fully equipped datacenter with live replication
  RTO: Minutes to hours
  Cost: $$$$
  Use Case: Critical systems, zero data loss

  Includes:
    - Identical hardware
    - Real-time data replication
    - Ready to take over immediately
    - Regular testing

Active-Active (No DR site):
  Description: Multiple production sites, all serving traffic
  RTO: Seconds to minutes
  Cost: $$$$$
  Use Case: Mission-critical, global services

  Includes:
    - Load balanced across sites
    - Automatic failover
    - No "DR site" (all are production)
```

### DR Plan Template

```markdown
# Disaster Recovery Plan

## 1. Scope and Objectives

### Systems Covered
- Production database cluster
- Application servers (web tier)
- API gateway
- Authentication service

### Recovery Objectives
- RTO: 4 hours
- RPO: 1 hour
- Maximum Tolerable Downtime: 24 hours

## 2. Roles and Responsibilities

| Role | Name | Phone | Email | Responsibility |
|------|------|-------|-------|----------------|
| DR Coordinator | John Doe | +1-555-0100 | john@example.com | Overall coordination |
| Infrastructure Lead | Jane Smith | +1-555-0101 | jane@example.com | Server recovery |
| Database Lead | Bob Wilson | +1-555-0102 | bob@example.com | Database recovery |
| Application Lead | Alice Johnson | +1-555-0103 | alice@example.com | Application recovery |
| Communications Lead | Carol Martinez | +1-555-0104 | carol@example.com | Stakeholder updates |

## 3. Emergency Contact List

### Internal Contacts
- CTO: +1-555-0200
- VP Engineering: +1-555-0201
- On-Call Engineer: PagerDuty escalation

### External Contacts
- AWS Support: 1-877-632-3000
- DNS Provider (Cloudflare): support ticket
- ISP: 1-800-xxx-xxxx

## 4. DR Invocation Criteria

Invoke DR plan if:
- Primary datacenter is inaccessible (fire, flood, power outage > 4 hours)
- Catastrophic system failure (ransomware, data corruption)
- Prolonged network outage (> 2 hours)
- Legal/safety order to evacuate

Decision Maker: CTO or VP Engineering

## 5. Recovery Procedures

### Phase 1: Assessment (0-30 minutes)
1. Assess extent of disaster
2. Activate DR team (conference call)
3. Declare disaster (DR Coordinator)
4. Notify stakeholders
5. Update status page

### Phase 2: Failover to DR Site (30 minutes - 2 hours)
1. Verify DR site accessibility
2. Restore latest backups to DR site
   - Database: Restore from S3 (1 hour)
   - Application: Deploy from Git (30 minutes)
3. Update DNS to point to DR site (5 minutes + TTL propagation)
4. Validate connectivity and functionality

### Phase 3: Service Validation (2-3 hours)
1. Run smoke tests
2. Verify database integrity
3. Test critical user workflows
4. Monitor error rates and performance

### Phase 4: Operations at DR Site (3-4 hours)
1. Begin normal operations from DR site
2. Continuous monitoring
3. Communicate to users: "Services restored"

### Phase 5: Return to Primary (Days/Weeks)
1. Repair/rebuild primary site
2. Replicate data back to primary
3. Scheduled failback (low-traffic window)
4. Validate primary site
5. Return to normal operations

## 6. Step-by-Step Recovery

### Database Recovery
```bash
# 1. Restore database from S3 backup
aws s3 cp s3://backups/db-latest.sql.gz /tmp/
gunzip /tmp/db-latest.sql.gz

# 2. Create new database
createdb production

# 3. Restore data
psql production < /tmp/db-latest.sql

# 4. Verify data
psql production -c "SELECT COUNT(*) FROM users;"
psql production -c "SELECT MAX(created_at) FROM orders;"

# 5. Update connection string in application
# Edit /etc/app/config.yaml
# DB_HOST: dr-db.example.com
```

### Application Recovery
```bash
# 1. Pull latest code
cd /opt/app
git fetch origin
git checkout production

# 2. Install dependencies
pip install -r requirements.txt

# 3. Update configuration for DR environment
cp config/dr.yaml config/production.yaml

# 4. Start application
systemctl start myapp

# 5. Verify
curl https://dr.example.com/health
```

### DNS Failover
```bash
# Update DNS to point to DR site
# Example: Cloudflare API

curl -X PUT "https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records/{record_id}" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  --data '{
    "type": "A",
    "name": "www",
    "content": "203.0.113.100",
    "ttl": 300,
    "proxied": false
  }'
```

## 7. Communication Plan

### Internal Communication
- Slack channel: #incident-dr
- Conference bridge: Zoom link
- Update frequency: Every 30 minutes

### External Communication
- Status page: status.example.com
- Twitter: @example_status
- Email: customers@example.com
- Update frequency: Every hour or when status changes

### Communication Template
```
Subject: Service Disruption - Disaster Recovery Activated

We are experiencing a major service disruption due to [reason].

Current Status: Disaster recovery procedures are in progress.

Impact: All services are currently unavailable.

ETA: We expect to restore services within 4 hours.

We will provide updates every hour.

For more information: https://status.example.com
```

## 8. Testing Schedule

- Tabletop Exercise: Quarterly
- DR Drill (partial): Bi-annually
- Full DR Test: Annually

## 9. Document Maintenance

- Review: Quarterly
- Owner: DR Coordinator
- Last Updated: 2025-01-15
- Next Review: 2025-04-15
```

## Business Continuity

### Business Impact Analysis (BIA)

```yaml
Purpose: Identify critical business functions and their dependencies

Process:
  1. Identify Business Functions:
     - Customer transactions (e-commerce)
     - Customer support (ticket system)
     - Employee email (email server)
     - Payroll (HR system)

  2. Assess Impact of Downtime:
     Per Hour Downtime:
       - E-commerce: $10,000 revenue loss + reputation damage
       - Customer support: Customer satisfaction impact
       - Email: Productivity loss
       - Payroll: Minimal (unless near payday)

  3. Determine RTO/RPO:
     E-commerce: RTO 1 hour, RPO 5 minutes
     Customer support: RTO 4 hours, RPO 1 hour
     Email: RTO 8 hours, RPO 4 hours
     Payroll: RTO 24 hours, RPO 24 hours

  4. Identify Dependencies:
     E-commerce depends on:
       - Web servers
       - Database
       - Payment gateway (external)
       - Inventory system

  5. Develop Recovery Strategies:
     E-commerce: Hot DR site with real-time replication
     Customer support: Warm DR site, daily backups
     Email: Cloud-based (Office 365) - already resilient
     Payroll: Weekly backups, manual processing possible
```

### BCP vs DR

```yaml
Business Continuity Plan (BCP):
  Scope: Entire business operations
  Focus: Keeping business running during disruption
  Includes:
    - Alternate work locations
    - Manual processes
    - Third-party vendors
    - Supply chain
    - Communication plans

  Example: COVID-19 pandemic
    - Work from home policy
    - VPN capacity expansion
    - Video conferencing tools
    - Policy changes

Disaster Recovery Plan (DR):
  Scope: IT systems and data
  Focus: Restoring technology infrastructure
  Includes:
    - Server recovery
    - Data restoration
    - Network failover
    - Application recovery

  Example: Datacenter fire
    - Failover to DR site
    - Restore from backups
    - DNS updates

Relationship: DR is a subset of BCP
```

## Recovery Testing

### Testing Levels

```yaml
Level 1: Tabletop Exercise (Quarterly)
  Duration: 2 hours
  Participants: DR team, stakeholders
  Process:
    - Present disaster scenario
    - Walk through DR plan
    - Discuss roles and procedures
    - Identify gaps and improvements

  No actual systems affected

Level 2: Partial DR Test (Bi-annually)
  Duration: 4 hours
  Participants: DR team
  Process:
    - Restore backups to DR environment
    - Validate data integrity
    - Test application startup
    - No traffic cutover

  Production unaffected

Level 3: Full DR Test (Annually)
  Duration: 1 day
  Participants: All teams
  Process:
    - Complete failover to DR site
    - Cutover traffic (planned maintenance window)
    - Run in DR mode for 4-8 hours
    - Failback to primary

  Brief production impact during cutover

Level 4: Surprise DR Test (Optional)
  Duration: Variable
  Participants: All teams
  Process:
    - Unannounced DR invocation
    - Tests team readiness
    - Identifies training gaps

  High stress, maximum learning
```

### Test Checklist

```markdown
# DR Test Checklist

## Pre-Test (1 week before)
- [ ] Schedule test date and time
- [ ] Notify all stakeholders
- [ ] Verify DR site readiness
- [ ] Verify backup integrity
- [ ] Review DR procedures with team
- [ ] Prepare test scenarios
- [ ] Set up monitoring and logging

## During Test
- [ ] Start timer (measure RTO)
- [ ] Activate DR team
- [ ] Begin recovery procedures
- [ ] Document all actions taken
- [ ] Document any deviations from plan
- [ ] Record issues encountered
- [ ] Capture screenshots/logs

## Validation
- [ ] Database connectivity
- [ ] Application functionality
- [ ] User authentication
- [ ] External integrations
- [ ] Performance metrics
- [ ] Data integrity checks

## Post-Test
- [ ] Calculate actual RTO/RPO
- [ ] Debrief with team (within 48 hours)
- [ ] Document lessons learned
- [ ] Create action items for improvements
- [ ] Update DR plan
- [ ] Update runbooks
- [ ] Report results to management

## Metrics to Capture
- Time to detection: _____ minutes
- Time to activation: _____ minutes
- Time to recovery: _____ minutes
- Data loss: _____ minutes/records
- Issues encountered: _____
- Success rate: _____%
```

## Cloud Backup Solutions

### AWS Backup

```yaml
# AWS Backup plan (CloudFormation)

Resources:
  BackupVault:
    Type: AWS::Backup::BackupVault
    Properties:
      BackupVaultName: ProductionBackupVault
      EncryptionKeyArn: !GetAtt BackupKey.Arn

  BackupKey:
    Type: AWS::KMS::Key
    Properties:
      Description: Encryption key for backups
      KeyPolicy:
        Statement:
          - Sid: Enable IAM User Permissions
            Effect: Allow
            Principal:
              AWS: !Sub 'arn:aws:iam::${AWS::AccountId}:root'
            Action: 'kms:*'
            Resource: '*'

  BackupPlan:
    Type: AWS::Backup::BackupPlan
    Properties:
      BackupPlan:
        BackupPlanName: DailyBackupPlan
        BackupPlanRule:
          - RuleName: DailyBackup
            TargetBackupVault: !Ref BackupVault
            ScheduleExpression: "cron(0 2 * * ? *)"  # 2 AM daily
            StartWindowMinutes: 60
            CompletionWindowMinutes: 120
            Lifecycle:
              DeleteAfterDays: 30
              MoveToColdStorageAfterDays: 7

  BackupSelection:
    Type: AWS::Backup::BackupSelection
    Properties:
      BackupPlanId: !Ref BackupPlan
      BackupSelection:
        SelectionName: ProductionResources
        IamRoleArn: !GetAtt BackupRole.Arn
        Resources:
          - !Sub 'arn:aws:ec2:${AWS::Region}:${AWS::AccountId}:instance/*'
          - !Sub 'arn:aws:rds:${AWS::Region}:${AWS::AccountId}:db:*'
        ListOfTags:
          - ConditionType: STRINGEQUALS
            ConditionKey: Environment
            ConditionValue: Production
```

## Database Backups

### PostgreSQL Backup

```bash
#!/bin/bash
# PostgreSQL backup script with PITR (Point-in-Time Recovery)

# Configuration
DB_NAME="production"
DB_USER="postgres"
BACKUP_DIR="/backup/postgres"
S3_BUCKET="s3://my-db-backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Full backup (daily)
pg_dump -U ${DB_USER} -Fc ${DB_NAME} | gzip > ${BACKUP_DIR}/full_${DATE}.dump.gz

# Upload to S3
aws s3 cp ${BACKUP_DIR}/full_${DATE}.dump.gz ${S3_BUCKET}/full/

# Continuous archiving (transaction logs)
# In postgresql.conf:
# wal_level = replica
# archive_mode = on
# archive_command = 'aws s3 cp %p s3://my-db-backups/wal/%f'

# Restore process:
# 1. Restore from full backup
# pg_restore -U postgres -d production /backup/full_latest.dump.gz
#
# 2. Create recovery.conf for PITR
# cat > /var/lib/postgresql/data/recovery.conf <<EOF
# restore_command = 'aws s3 cp s3://my-db-backups/wal/%f %p'
# recovery_target_time = '2025-01-15 14:30:00'
# EOF
#
# 3. Start PostgreSQL (will replay WAL logs)
```

### MySQL Backup

```bash
#!/bin/bash
# MySQL/MariaDB backup with binlog

DB_NAME="production"
BACKUP_DIR="/backup/mysql"
DATE=$(date +%Y%m%d_%H%M%S)

# Full backup with mysqldump
mysqldump \
  --single-transaction \
  --routines \
  --triggers \
  --events \
  --flush-logs \
  --master-data=2 \
  ${DB_NAME} | gzip > ${BACKUP_DIR}/full_${DATE}.sql.gz

# Binary log backups (continuous)
# In my.cnf:
# log_bin = /var/log/mysql/mysql-bin
# expire_logs_days = 7
# sync_binlog = 1

# Backup binary logs
mysqlbinlog /var/log/mysql/mysql-bin.* | gzip > ${BACKUP_DIR}/binlog_${DATE}.sql.gz

# Point-in-Time Recovery:
# 1. Restore full backup
# gunzip < full_20250115_020000.sql.gz | mysql production
#
# 2. Apply binary logs up to specific time
# mysqlbinlog --stop-datetime="2025-01-15 14:30:00" binlog_*.sql | mysql production
```

## Backup Monitoring

### Backup Health Checks

```python
#!/usr/bin/env python3
"""
Backup monitoring and alerting
"""

import boto3
import datetime
import smtplib
from email.mime.text import MIMEText

def check_aws_backup_jobs():
    """Check AWS Backup job status"""
    client = boto3.client('backup')

    # Get backup jobs from last 24 hours
    end_time = datetime.datetime.now()
    start_time = end_time - datetime.timedelta(days=1)

    response = client.list_backup_jobs(
        ByCreatedAfter=start_time,
        ByCreatedBefore=end_time
    )

    failed_jobs = []
    for job in response['BackupJobs']:
        if job['State'] == 'FAILED':
            failed_jobs.append({
                'BackupJobId': job['BackupJobId'],
                'ResourceArn': job['ResourceArn'],
                'StatusMessage': job.get('StatusMessage', 'Unknown error')
            })

    return failed_jobs

def check_backup_age(bucket, prefix, max_age_hours=25):
    """Check if backups are recent"""
    s3 = boto3.client('s3')

    response = s3.list_objects_v2(Bucket=bucket, Prefix=prefix)

    if 'Contents' not in response:
        return [f"No backups found in {bucket}/{prefix}"]

    # Get most recent backup
    latest = max(response['Contents'], key=lambda x: x['LastModified'])
    age = datetime.datetime.now(datetime.timezone.utc) - latest['LastModified']
    age_hours = age.total_seconds() / 3600

    if age_hours > max_age_hours:
        return [f"Latest backup is {age_hours:.1f} hours old (threshold: {max_age_hours})"]

    return []

def send_alert(subject, body):
    """Send email alert"""
    msg = MIMEText(body)
    msg['Subject'] = subject
    msg['From'] = 'backup-monitor@example.com'
    msg['To'] = 'ops-team@example.com'

    s = smtplib.SMTP('localhost')
    s.send_message(msg)
    s.quit()

def main():
    issues = []

    # Check AWS Backup jobs
    failed_jobs = check_aws_backup_jobs()
    if failed_jobs:
        issues.append(f"Failed backup jobs: {len(failed_jobs)}")
        for job in failed_jobs:
            issues.append(f"  - {job['ResourceArn']}: {job['StatusMessage']}")

    # Check backup age
    age_issues = check_backup_age('my-backups', 'database/')
    issues.extend(age_issues)

    # Alert if issues found
    if issues:
        send_alert(
            'Backup Health Check FAILED',
            'Backup issues detected:\n\n' + '\n'.join(issues)
        )
        print('ALERT:', '\n'.join(issues))
    else:
        print('All backup checks passed')

if __name__ == '__main__':
    main()
```

This comprehensive backup and disaster recovery guide provides all the necessary knowledge and procedures for protecting data and ensuring business continuity.
