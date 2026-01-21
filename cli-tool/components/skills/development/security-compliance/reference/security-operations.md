# Security Operations & Incident Response

## Security Operations Center (SOC)

### SOC Structure

```
Tier 1: Alert Triage (L1 Analyst)
├─ Monitor SIEM dashboards and security alerts
├─ Perform initial triage and classification
├─ Escalate confirmed incidents to Tier 2
├─ Document all activities in ticketing system
└─ Response Time: 15 minutes for critical alerts

Tier 2: Incident Investigation (L2 Analyst)
├─ Deep investigation of escalated incidents
├─ Contain threats and perform forensic analysis
├─ Coordinate with IT teams for remediation
├─ Escalate to Tier 3 for complex threats
└─ Response Time: 1 hour for critical incidents

Tier 3: Threat Hunting & Advanced Analysis (L3 Analyst)
├─ Proactive threat hunting
├─ Advanced forensics and malware analysis
├─ Create custom detection rules
├─ Research emerging threats
└─ Mentor junior analysts

SOC Manager
├─ Oversee SOC operations
├─ Manage team performance and training
├─ Report metrics to leadership
├─ Coordinate with other departments
└─ Budget and resource planning
```

### SIEM Configuration

**Log Sources to Ingest**:

```
Critical Priority (Real-time):
├─ Firewall logs (allow/deny, connections)
├─ IDS/IPS alerts
├─ EDR/antivirus alerts
├─ Authentication logs (successes and failures)
├─ VPN connections
├─ Privileged account activity
└─ Database access logs (for sensitive data)

High Priority (Near real-time, <5 min delay):
├─ Web application logs (access, errors)
├─ Cloud infrastructure logs (AWS CloudTrail, Azure Activity)
├─ Email gateway logs (spam, malware detection)
├─ DLP alerts
└─ File integrity monitoring

Medium Priority (15-30 min delay):
├─ Application logs
├─ DNS query logs
├─ Proxy logs
├─ Network flow data (NetFlow/IPFIX)
└─ Patch management logs

Low Priority (Hourly or daily):
├─ Backup logs
├─ System performance metrics
└─ Non-security application logs
```

**Essential SIEM Use Cases**:

```yaml
# 1. Brute Force Attack Detection
use_case: "Detect brute force login attempts"
data_sources:
  - Windows Security Event Logs (Event ID 4625)
  - Linux auth logs
  - VPN logs
  - Application authentication logs

detection_logic: |
  More than 10 failed login attempts
  FROM same source IP
  TO same user account
  WITHIN 5-minute window

actions:
  - Alert: High severity
  - Block source IP (automatic via firewall integration)
  - Notify account owner
  - Create incident ticket

# 2. Unusual Privileged Account Activity
use_case: "Detect anomalous admin account usage"
data_sources:
  - Active Directory logs
  - Unix/Linux sudo logs
  - PAM session logs

detection_logic: |
  Privileged account login
  OUTSIDE business hours (8 AM - 6 PM)
  OR FROM unusual location
  OR ON unusual system

actions:
  - Alert: Critical severity
  - Require MFA step-up authentication
  - Notify security team and account owner
  - Create incident ticket

# 3. Data Exfiltration Detection
use_case: "Detect large outbound data transfers"
data_sources:
  - Firewall logs
  - Proxy logs
  - DLP alerts
  - Cloud storage logs

detection_logic: |
  Outbound data transfer > 1 GB
  TO external destination
  FROM single user/system
  WITHIN 1-hour window

actions:
  - Alert: High severity
  - Block connection if still active
  - Investigate user/system activity
  - Check for data classification violations

# 4. Malware Detection
use_case: "Detect malware execution"
data_sources:
  - EDR alerts
  - Antivirus logs
  - Process execution logs (Sysmon)
  - Network connections

detection_logic: |
  Malware signature match
  OR suspicious process execution (PowerShell obfuscation)
  OR connection to known C2 IP
  OR file hash matches threat intelligence

actions:
  - Alert: Critical severity
  - Isolate endpoint from network (EDR integration)
  - Kill malicious process
  - Collect forensic artifacts
  - Create incident ticket

# 5. Insider Threat - Abnormal File Access
use_case: "Detect abnormal access to sensitive files"
data_sources:
  - File server audit logs
  - Database query logs
  - SharePoint access logs

detection_logic: |
  User accesses > 100 files
  CONTAINING sensitive data (SSN, credit card, PHI)
  WITHIN 1-hour window
  WHERE user has no recent history of accessing these files

actions:
  - Alert: High severity
  - Notify manager and security team
  - Investigate user activity
  - Check for USB device insertion
  - Review data transfer logs
```

### Threat Hunting

**Threat Hunting Process**:

```
1. Hypothesis Generation
   ├─ Based on threat intelligence (e.g., "APT group targeting our industry")
   ├─ Based on recent attacks (e.g., "Check for Log4Shell exploitation attempts")
   └─ Based on anomalies (e.g., "Unusual PowerShell activity in environment")

2. Investigation
   ├─ Query SIEM and EDR for indicators
   ├─ Analyze logs for suspicious patterns
   ├─ Review network traffic
   └─ Examine endpoint artifacts

3. Discovery
   ├─ Confirm presence or absence of threat
   ├─ Document findings
   └─ Assess impact if threat found

4. Response
   ├─ Containment and eradication if threat confirmed
   ├─ Create detection rule for future prevention
   └─ Share findings with team

5. Continuous Improvement
   ├─ Update threat intelligence
   ├─ Refine detection rules
   └─ Document lessons learned
```

**Example Threat Hunt: Living Off the Land (LOLBins)**

```bash
# Hypothesis: Attackers using native Windows tools for malicious activity

# Hunt 1: Suspicious PowerShell execution
# SIEM query to find encoded PowerShell commands
index=windows EventCode=4688
NewProcessName="*powershell.exe"
CommandLine="*-enc*" OR CommandLine="*-encodedcommand*"
| stats count by Computer, User, CommandLine
| where count > 0

# Hunt 2: Unusual certutil usage (commonly used to download malware)
index=windows EventCode=4688
NewProcessName="*certutil.exe"
CommandLine="*-urlcache*" OR CommandLine="*-decode*"
| stats count by Computer, User, CommandLine

# Hunt 3: WMIC used for lateral movement
index=windows EventCode=4688
NewProcessName="*wmic.exe"
CommandLine="*/node:*"
| stats count by Computer, User, CommandLine

# Hunt 4: BITSAdmin downloading files
index=windows EventCode=4688
NewProcessName="*bitsadmin.exe"
CommandLine="*/transfer*"
| stats count by Computer, User, CommandLine

# Hunt 5: Malicious use of regsvr32
index=windows EventCode=4688
NewProcessName="*regsvr32.exe"
CommandLine="*/s*" AND CommandLine="*http*"
| stats count by Computer, User, CommandLine
```

---

## Incident Response

### Incident Response Lifecycle

```
1. Preparation
   ↓
2. Detection & Analysis
   ↓
3. Containment
   ↓
4. Eradication
   ↓
5. Recovery
   ↓
6. Post-Incident Activity
```

### Incident Response Plan Structure

```markdown
# Incident Response Plan

## 1. Preparation

### Incident Response Team (CIRT)

| Role | Name | Contact | Responsibilities |
|------|------|---------|-----------------|
| Incident Commander | Jane Doe | +1-555-0101 | Overall coordination |
| Security Lead | John Smith | +1-555-0102 | Technical investigation |
| IT Lead | Bob Johnson | +1-555-0103 | System remediation |
| Communications | Alice Brown | +1-555-0104 | Internal/external comms |
| Legal | Carol White | +1-555-0105 | Legal implications |
| HR | Dave Lee | +1-555-0106 | Insider threats |

### Tools and Resources

- SIEM: Splunk (https://siem.company.com)
- EDR: CrowdStrike (https://falcon.crowdstrike.com)
- Ticketing: Jira Service Desk (security-incidents project)
- Communication: Dedicated Slack channel #incident-response
- Forensic workstation: Located in SOC, admin laptop with encrypted drive
- Incident response jump bag: USB with tools, clean OS images, cables

### Contact Information

- Internal IT Help Desk: x5000
- Security Team On-Call: +1-555-SECURITY
- Legal Department: legal@company.com
- PR/Communications: pr@company.com
- Cyber Insurance: PolicyCo, +1-800-CYBER-INSURE, Policy #12345
- External IR Firm: MandiantFire, +1-888-RESPOND
- Law Enforcement: FBI Cyber Division, Agent Smith, +1-202-555-CYBER

## 2. Detection & Analysis

### Incident Classification

| Severity | Definition | Examples | Response Time |
|----------|-----------|----------|---------------|
| P0 - Critical | Active breach, data exfiltration, ransomware | Active data theft, ransomware encryption, complete system compromise | Immediate (24/7) |
| P1 - High | Confirmed malware, unauthorized access | Malware on critical system, confirmed intrusion | 1 hour |
| P2 - Medium | Suspicious activity requiring investigation | Potential malware, failed intrusion attempt | 4 hours |
| P3 - Low | Policy violation, informational | Minor policy violation, phishing email (no click) | 24 hours |

### Initial Assessment Questions

When receiving an incident report, gather:

1. **What happened?** (Description of the incident)
2. **When did it occur?** (Date and time)
3. **Who discovered it?** (Reporter name and contact)
4. **Which systems are affected?** (Hostnames, IP addresses)
5. **What is the current status?** (Ongoing, contained, resolved)
6. **What data is at risk?** (PII, PHI, financial, IP)
7. **Has law enforcement been notified?** (Yes/No)
8. **What immediate actions were taken?** (System isolated, account disabled)

### Incident Documentation

Create ticket in Jira with:
- Incident ID (auto-generated)
- Classification (P0-P3)
- Timeline of events
- Systems affected
- Actions taken
- Evidence collected
- Next steps

## 3. Containment

### Short-term Containment (Stop the Bleeding)

**Network-Based Containment**:
```bash
# Isolate compromised system (via firewall)
# Block inbound and outbound traffic except to/from SOC analyst workstation
iptables -A INPUT -s <SOC_IP> -j ACCEPT
iptables -A OUTPUT -d <SOC_IP> -j ACCEPT
iptables -P INPUT DROP
iptables -P OUTPUT DROP

# Block malicious IP at perimeter firewall
# (Use firewall management interface or API)

# Disable compromised user account
# Active Directory
Disable-ADAccount -Identity compromised_user

# Linux
usermod -L compromised_user
```

**Endpoint-Based Containment**:
```bash
# Using EDR (CrowdStrike example via API)
curl -X POST "https://api.crowdstrike.com/devices/v2/actions/contain" \
  -H "Authorization: Bearer $FALCON_TOKEN" \
  -d '{"ids": ["device_id_here"], "action_parameters": []}'

# Kill malicious process
# Windows
taskkill /F /IM malware.exe /T

# Linux
pkill -9 -f malware
```

**Account-Based Containment**:
```bash
# Reset password and revoke sessions
# Azure AD
Revoke-AzureADUserAllRefreshToken -ObjectId user@company.com

# Force password change on next login
Set-ADUser -Identity compromised_user -ChangePasswordAtLogon $true

# Disable API keys/tokens
# (Application-specific, e.g., AWS IAM)
aws iam delete-access-key --user-name compromised_user --access-key-id AKIA...
```

### Long-term Containment

- Patch vulnerable systems
- Implement compensating controls (WAF rules, additional monitoring)
- Rebuild compromised systems from clean images
- Update detection rules to prevent recurrence

## 4. Eradication

### Malware Removal

```bash
# Identify all affected systems
# Search EDR for same malware hash or C2 communications

# Remove malware from each system
# Preferred: Reimage from clean backup
# If reimaging not possible:
# - Use EDR to quarantine/delete malicious files
# - Remove persistence mechanisms (registry, scheduled tasks, services)
# - Clear cached credentials

# Windows: Remove scheduled task
schtasks /Delete /TN "Malicious Task" /F

# Windows: Remove registry persistence
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "Malware" /f

# Linux: Remove cron job
crontab -e  # Remove malicious line
```

### Vulnerability Remediation

```bash
# Patch vulnerable systems
# Ubuntu/Debian
apt-get update && apt-get upgrade -y

# RHEL/CentOS
yum update -y

# Windows (via PowerShell)
Install-WindowsUpdate -AcceptAll -AutoReboot

# Application-specific (e.g., Log4Shell)
# Upgrade Log4j to 2.17.1+
# Set JVM option: -Dlog4j2.formatMsgNoLookups=true
```

### Credential Reset

```bash
# Force password reset for all potentially compromised accounts
# Generate list of users who logged in during breach window

# Bulk password reset (Azure AD example)
$users = Get-AzureADUser -All $true | Where-Object {$_.UserPrincipalName -like "*@company.com"}
foreach ($user in $users) {
    Set-AzureADUser -ObjectId $user.ObjectId -PasswordPolicies "DisablePasswordExpiration" -Password (ConvertTo-SecureString "TempPassword123!" -AsPlainText -Force)
    Set-AzureADUser -ObjectId $user.ObjectId -ForceChangePasswordNextLogin $true
}

# Rotate service account credentials
# Rotate API keys and tokens
# Rotate database passwords
# Rotate encryption keys (where feasible)
```

## 5. Recovery

### System Restoration

```bash
# Restore from clean backup (verified malware-free)
# Validate backup integrity
sha256sum backup.tar.gz
# Compare to known good hash

# Restore data
tar -xzf backup.tar.gz -C /restore/location

# Rebuild from golden image (preferred for compromised systems)
# Deploy fresh OS from trusted source
# Apply all patches
# Reinstall applications
# Restore data only (not configurations that may contain backdoors)
```

### Validation Testing

Before returning systems to production:

```
□ Antivirus/EDR scan shows clean
□ No outbound connections to malicious IPs
□ File integrity monitoring shows no unexpected changes
□ No unauthorized user accounts or scheduled tasks
□ All patches applied
□ Passwords rotated
□ System logs reviewed for anomalies
□ Functionality testing completed
□ Monitoring/alerting configured
```

### Return to Normal Operations

- Gradual restoration (not all systems at once)
- Enhanced monitoring for 30 days post-incident
- User communication about password resets
- Document all changes made

## 6. Post-Incident Activity

### Post-Incident Review (PIR)

**Within 5 business days of incident closure, conduct PIR meeting**

Attendees: CIRT members, affected business units, leadership

Agenda:
1. Incident timeline review
2. What went well?
3. What could be improved?
4. Root cause analysis
5. Action items for improvement

### Incident Report Template

```markdown
# Incident Report: [Incident ID]

## Executive Summary
Brief non-technical summary of what happened, impact, and resolution.

## Incident Details
- **Incident ID**: INC-2025-001
- **Severity**: P1 (High)
- **Detected**: 2025-01-15 14:23 UTC
- **Contained**: 2025-01-15 16:45 UTC
- **Resolved**: 2025-01-17 10:00 UTC
- **Total Duration**: 44 hours

## Timeline
| Time (UTC) | Event |
|-----------|-------|
| 2025-01-15 14:23 | SIEM alert: Unusual outbound traffic from web server |
| 2025-01-15 14:30 | Analyst confirms malware on web-01.company.com |
| 2025-01-15 14:45 | Server isolated from network |
| 2025-01-15 15:00 | CIRT activated, incident commander assigned |
| 2025-01-15 16:00 | Root cause identified: Unpatched Log4Shell vuln |
| 2025-01-15 16:45 | All vulnerable servers patched and restarted |
| 2025-01-16 09:00 | Forensic analysis completed |
| 2025-01-17 10:00 | Systems restored, monitoring in place, incident closed |

## Root Cause
Apache web server running vulnerable version of Log4j (2.14.1) was exploited
via crafted HTTP User-Agent header. Patch released on 2021-12-10 was not
applied due to lack of automated patch management.

## Impact Assessment
- **Systems Affected**: 3 web servers (web-01, web-02, web-03)
- **Data Compromised**: None confirmed
- **Downtime**: 12 hours (web services offline during remediation)
- **Financial Impact**: Estimated $50,000 (12 hours downtime × $4,200/hour)
- **Customers Affected**: None (no data breach)
- **Regulatory**: No breach notification required

## Actions Taken
1. Isolated affected servers from network
2. Captured forensic images
3. Analyzed malware (CobaltStrike beacon)
4. Identified 3 vulnerable systems
5. Patched Log4j on all servers
6. Rebuilt servers from clean images
7. Deployed WAF rule to block exploit attempts
8. Reset all service account passwords

## Lessons Learned

### What Went Well
- SIEM alert fired immediately
- CIRT responded within 15 minutes
- Isolation prevented lateral movement
- Backups were recent and intact

### What Could Be Improved
- Patch management process too slow (vulnerability was 1 month old)
- No vulnerability scanning for application dependencies
- Incident response playbook for ransomware needed update

## Recommendations
1. **Implement automated patch management** (Priority: High, Owner: IT, Due: 2025-02-15)
   - Deploy Patch Manager to automate patching
   - SLA: Critical patches within 7 days

2. **Add SCA scanning to CI/CD** (Priority: High, Owner: AppSec, Due: 2025-02-28)
   - Use Snyk or similar to scan for vulnerable dependencies
   - Block deployments with critical vulnerabilities

3. **Update incident response playbooks** (Priority: Medium, Owner: Security, Due: 2025-03-15)
   - Add ransomware playbook
   - Add supply chain attack playbook
   - Conduct tabletop exercise

4. **Enhance vulnerability scanning** (Priority: Medium, Owner: Security, Due: 2025-03-01)
   - Configure Nessus to scan for application vulnerabilities
   - Integrate with vulnerability management workflow

## Regulatory Reporting
- **GDPR Breach Notification**: Not required (no personal data compromised)
- **State Breach Laws**: Not required
- **Cyber Insurance**: Notified on 2025-01-15, claim filed

## Sign-off
- **Incident Commander**: Jane Doe, 2025-01-18
- **CISO**: John Smith, 2025-01-18
```

---

## Security Metrics & KPIs

### SOC Metrics

```yaml
Detection Metrics:
  - name: "Mean Time to Detect (MTTD)"
    formula: "Time from incident occurrence to detection"
    target: "<1 hour for critical incidents"
    measurement: "Automated via SIEM"

  - name: "Alert Volume"
    formula: "Total alerts per day/week/month"
    target: "Trending down (improving signal-to-noise)"
    measurement: "SIEM dashboard"

  - name: "False Positive Rate"
    formula: "(False positives / Total alerts) × 100"
    target: "<20%"
    measurement: "Track in ticketing system"

Response Metrics:
  - name: "Mean Time to Respond (MTTR)"
    formula: "Time from detection to initial response"
    target: "P0: <15 min, P1: <1 hour, P2: <4 hours"
    measurement: "Ticket timestamps"

  - name: "Mean Time to Contain (MTTC)"
    formula: "Time from detection to containment"
    target: "P0: <1 hour, P1: <4 hours"
    measurement: "Ticket timestamps"

  - name: "Mean Time to Resolve (MTTR)"
    formula: "Time from detection to incident closure"
    target: "P0: <72 hours, P1: <7 days"
    measurement: "Ticket timestamps"

Effectiveness Metrics:
  - name: "Incidents by Severity"
    formula: "Count of P0/P1/P2/P3 incidents per month"
    target: "Zero P0, minimal P1 incidents"
    measurement: "Ticket reports"

  - name: "Repeat Incidents"
    formula: "(Repeat incidents / Total incidents) × 100"
    target: "<5%"
    measurement: "Track root causes in tickets"

  - name: "SLA Compliance"
    formula: "(Incidents meeting SLA / Total incidents) × 100"
    target: ">95%"
    measurement: "Automated via ticketing system"

Team Metrics:
  - name: "Analyst Utilization"
    formula: "Hours on incidents / Total work hours"
    target: "60-80% (balance investigation and improvement)"
    measurement: "Time tracking"

  - name: "Training Completion"
    formula: "(Analysts completing training / Total analysts) × 100"
    target: "100% quarterly"
    measurement: "LMS reporting"

  - name: "Threat Hunts Conducted"
    formula: "Number of proactive threat hunts per month"
    target: "Minimum 4 hunts per month"
    measurement: "Track in project board"
```

### Sample SOC Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│  Security Operations Dashboard - January 2025               │
├─────────────────────────────────────────────────────────────┤
│  Detection & Response Times                                 │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐ │
│  │ MTTD        │ MTTR        │ MTTC        │ MTT-Resolve │ │
│  │ 42 min      │ 18 min      │ 2.1 hours   │ 15 hours    │ │
│  │ ↓ 12% MoM   │ ↓ 5% MoM    │ → 0% MoM    │ ↓ 20% MoM   │ │
│  └─────────────┴─────────────┴─────────────┴─────────────┘ │
│                                                              │
│  Incident Volume (January 2025)                             │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐ │
│  │ Critical    │ High        │ Medium      │ Low         │ │
│  │ 2 (P0)      │ 12 (P1)     │ 45 (P2)     │ 87 (P3)     │ │
│  └─────────────┴─────────────┴─────────────┴─────────────┘ │
│                                                              │
│  Alert Metrics                                              │
│  Total Alerts: 15,234 │ False Positives: 2,841 (18.6%)     │
│  True Positives: 146 │ Under Investigation: 23              │
│                                                              │
│  Top Attack Vectors                                         │
│  1. Phishing (62 incidents)                                 │
│  2. Brute force login (31 incidents)                        │
│  3. Malware (18 incidents)                                  │
│  4. Vulnerability exploitation (12 incidents)               │
│  5. Insider threat (2 incidents)                            │
│                                                              │
│  Threat Hunting                                             │
│  Hunts Conducted: 5 │ Threats Found: 1 │ New Rules: 3      │
│                                                              │
│  SLA Compliance: 97.3% (Target: >95%)                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Tabletop Exercises

### Ransomware Tabletop Exercise

**Objective**: Test incident response procedures for ransomware attack

**Duration**: 90 minutes

**Participants**:
- Incident Commander
- Security team
- IT team
- Legal
- Communications
- Executive sponsor

**Scenario**:

```
Wednesday, 9:00 AM:
The IT help desk receives multiple calls from users reporting that files are
encrypted and they see a ransom note demanding $500,000 in Bitcoin.

Initial Investigation:
- 50+ workstations affected across 3 departments
- Ransomware appears to be spreading
- Backup server also appears to be encrypted
- Ransom note gives 48-hour deadline

Your Task:
Respond to this incident using your incident response plan.
```

**Exercise Flow**:

```
Inject 1 (0:00): Initial notification
- Question: Who do you notify first?
- Question: What immediate containment actions do you take?
- Expected: Activate CIRT, isolate network segments, disable VPN

Inject 2 (0:15): Scope determination
- Update: EDR shows 127 affected systems, ransomware is REvil variant
- Question: How do you determine the full scope?
- Question: Do you pay the ransom?
- Expected: Query EDR for all infected systems, check backups, legal consult

Inject 3 (0:30): Backup assessment
- Update: Backup server encrypted, but offline backups from 48 hours ago exist
- Question: How do you verify backup integrity?
- Question: What is your recovery strategy?
- Expected: Test restore from offline backups, prioritize critical systems

Inject 4 (0:45): External communication
- Update: News outlet calls asking about a data breach
- Question: What do you tell them?
- Question: Do you need to notify regulators?
- Expected: Escalate to communications team, assess breach notification requirements

Inject 5 (1:00): Recovery decisions
- Update: Backups verified clean, recovery will take 3-5 days
- Question: What is your recovery priority order?
- Question: How do you prevent reinfection?
- Expected: Restore critical systems first, implement enhanced monitoring, patch vulnerabilities

Inject 6 (1:15): Post-incident
- Question: What improvements are needed to prevent recurrence?
- Question: What metrics will you track?
- Expected: Better backup strategy, EDR on all systems, security awareness training
```

**Facilitator Notes**:
- Pause after each inject for discussion
- Ask probing questions to test knowledge
- Document gaps in procedures or knowledge
- Create action items for improvements

**After Action Report**:

```markdown
## Ransomware Tabletop Exercise - After Action Report

### Strengths
- Team quickly activated CIRT
- Network isolation performed correctly
- Good understanding of legal/regulatory requirements
- Clear communication during exercise

### Areas for Improvement
1. **Backup Strategy**
   - Current: Backups stored online, vulnerable to ransomware
   - Recommendation: Implement 3-2-1 backup strategy (3 copies, 2 media types, 1 offsite)
   - Owner: IT Manager
   - Due: 2025-03-01

2. **Incident Response Playbook**
   - Current: Generic IR plan, lacks ransomware-specific procedures
   - Recommendation: Create ransomware playbook with decision trees
   - Owner: Security Manager
   - Due: 2025-02-15

3. **Executive Decision Making**
   - Current: Unclear who has authority to approve ransom payment
   - Recommendation: Define authority matrix in IR plan
   - Owner: CISO
   - Due: 2025-02-01

4. **Communication Templates**
   - Current: No pre-approved external communication templates
   - Recommendation: Create templates for customers, media, regulators
   - Owner: Communications Director
   - Due: 2025-02-15

### Next Steps
- Schedule follow-up tabletop in 6 months
- Conduct technical drill (actual backup restoration test)
- Update incident response plan based on lessons learned
```

---

## Playbooks

### Phishing Email Response Playbook

```markdown
## Phishing Email Response Playbook

### Trigger
User reports suspicious email via "Report Phishing" button or to security@company.com

### Severity Classification
- **P1 (High)**: User clicked link or entered credentials
- **P2 (Medium)**: User opened attachment
- **P3 (Low)**: User did not interact with email

### Response Steps

#### Step 1: Triage (Within 15 minutes)
□ Review reported email
□ Classify severity (P1/P2/P3)
□ Check email gateway logs for delivery count
   ```bash
   # Exchange example
   Get-MessageTrace -SenderAddress "phishing@evil.com" -StartDate (Get-Date).AddHours(-24)
   ```

#### Step 2: Analysis
□ Analyze email headers (sender IP, SPF/DKIM/DMARC results)
□ Check URLs in email (use URL sandbox like urlscan.io)
□ Analyze attachments (upload to VirusTotal, do not execute)
□ Search threat intelligence for IOCs (AlienVault OTX, VirusTotal)

#### Step 3: Containment
□ Delete email from all mailboxes
   ```powershell
   # Office 365 example
   $SearchName = "Phishing Campaign - evil.com"
   New-ComplianceSearch -Name $SearchName -ExchangeLocation All -ContentMatchQuery '(subject:"Invoice 12345") AND (from:phishing@evil.com)'
   Start-ComplianceSearch -Identity $SearchName
   # After search completes:
   New-ComplianceSearchAction -SearchName $SearchName -Purge -PurgeType HardDelete
   ```

□ Block sender domain/IP at email gateway
□ Block malicious URLs at web proxy/firewall

#### Step 4: Credential Reset (If P1 - User Clicked/Entered Credentials)
□ Force password reset for affected user
   ```powershell
   Set-ADUser -Identity affected_user -ChangePasswordAtLogon $true
   ```
□ Revoke active sessions
   ```powershell
   Revoke-AzureADUserAllRefreshToken -ObjectId user@company.com
   ```
□ Monitor account for suspicious activity (24-48 hours)
□ Enable additional logging on account

#### Step 5: Malware Scan (If P2 - User Opened Attachment)
□ Isolate endpoint (if not already quarantined by EDR)
□ Run full antivirus/EDR scan
□ Check for IOCs from attachment analysis
□ If malware found, follow Malware Incident Playbook

#### Step 6: User Communication
□ Notify affected users that email was malicious
□ Thank users who reported (reinforce positive behavior)
□ If credentials reset, provide instructions
□ For P3 (no interaction), no additional user action needed

#### Step 7: Documentation
□ Update incident ticket with:
  - Email headers and content
  - Number of recipients
  - Number who clicked/opened
  - IOCs identified
  - Actions taken
□ Add IOCs to threat intelligence platform
□ Create detection rules for similar emails

#### Step 8: Prevention
□ Update email gateway rules to block similar emails
□ Add sender domain to blacklist
□ If widespread campaign, send security awareness notice
□ Consider additional user training if many users clicked
```

This comprehensive security operations and incident response guide provides SOC teams with the structure, processes, and playbooks needed to detect, respond to, and recover from security incidents effectively.
