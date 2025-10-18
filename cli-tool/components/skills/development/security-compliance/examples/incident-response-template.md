# Incident Response Report Template

## Incident Summary

**Incident ID**: INC-2025-XXX
**Severity**: [P0 - Critical | P1 - High | P2 - Medium | P3 - Low]
**Status**: [Open | Contained | Resolved | Closed]
**Incident Commander**: [Name]
**Date Opened**: YYYY-MM-DD HH:MM UTC
**Date Closed**: YYYY-MM-DD HH:MM UTC

**Executive Summary**:
[Brief 2-3 sentence summary of what happened, impact, and resolution]

---

## Incident Details

### Classification
- **Incident Type**: [Malware | Phishing | Data Breach | DDoS | Unauthorized Access | Other]
- **Attack Vector**: [Email | Web Application | Network | Physical | Social Engineering | Other]
- **Affected Assets**: [List systems, applications, or data affected]

### Timeline

| Time (UTC) | Event | Action Taken | Owner |
|-----------|-------|--------------|-------|
| 2025-01-15 14:23 | SIEM alert: Unusual outbound traffic | Analyst began investigation | SOC Analyst |
| 2025-01-15 14:30 | Confirmed malware on web-01 | Server isolated from network | SOC Analyst |
| 2025-01-15 14:45 | CIRT activated | Incident commander assigned | Security Manager |
| 2025-01-15 15:00 | Root cause identified | Vulnerability assessment | Security Engineer |
| 2025-01-15 16:00 | Patch applied to all systems | Systems patched and restarted | IT Operations |
| 2025-01-15 18:00 | Forensic analysis completed | Evidence collected | Forensic Analyst |
| 2025-01-17 10:00 | Systems restored to production | Monitoring in place | IT Operations |
| 2025-01-17 12:00 | Incident closed | Post-incident review scheduled | Incident Commander |

---

## Impact Assessment

### Systems Affected
- **Production Systems**: [Number and list]
- **Development/Test Systems**: [Number and list]
- **User Accounts**: [Number affected]

### Data Impact
- **Data Confidentiality**: [None | Low | Medium | High | Critical]
  - Personal Identifiable Information (PII): [Yes/No, quantity if applicable]
  - Protected Health Information (PHI): [Yes/No, quantity if applicable]
  - Financial Data: [Yes/No, quantity if applicable]
  - Intellectual Property: [Yes/No]
  - Other Sensitive Data: [Specify]

- **Data Integrity**: [None | Low | Medium | High | Critical]
  - Data modified or corrupted: [Yes/No, describe]

- **Data Availability**: [None | Low | Medium | High | Critical]
  - Systems offline: [Duration]
  - Services unavailable: [List]

### Business Impact
- **Downtime**: X hours
- **Estimated Financial Loss**: $X,XXX
  - Direct costs (response, recovery): $X,XXX
  - Indirect costs (downtime, productivity): $X,XXX
  - Potential regulatory fines: $X,XXX
- **Customers Affected**: [Number]
- **Reputation Impact**: [None | Minor | Moderate | Significant | Severe]

---

## Root Cause Analysis

### What Happened
[Detailed description of the incident from start to finish]

### How It Happened
[Technical explanation of the attack vector and vulnerabilities exploited]

### Why It Happened
[Underlying causes: missing patches, misconfiguration, human error, etc.]

### Contributing Factors
- Factor 1: [Description]
- Factor 2: [Description]
- Factor 3: [Description]

---

## Response Actions

### Detection
[How the incident was detected: SIEM alert, user report, etc.]

### Containment
**Short-term Containment**:
- [Action 1: e.g., Isolated affected systems from network]
- [Action 2: e.g., Disabled compromised user accounts]
- [Action 3: e.g., Blocked malicious IPs at firewall]

**Long-term Containment**:
- [Action 1: e.g., Patched vulnerable systems]
- [Action 2: e.g., Implemented compensating controls]

### Eradication
- [Action 1: e.g., Removed malware from all systems]
- [Action 2: e.g., Closed vulnerable attack vector]
- [Action 3: e.g., Reset all potentially compromised credentials]

### Recovery
- [Action 1: e.g., Restored systems from clean backups]
- [Action 2: e.g., Verified system integrity]
- [Action 3: e.g., Returned systems to production with enhanced monitoring]

### Evidence Collected
- **Forensic Images**: [List systems imaged]
- **Log Files**: [List log sources collected]
- **Network Captures**: [PCAP files if applicable]
- **Malware Samples**: [Hashes and analysis]
- **Other Evidence**: [Specify]

---

## External Notifications

### Regulatory Notifications Required
- [ ] **GDPR Breach Notification** (72 hours to supervisory authority)
  - Submitted: [Yes/No]
  - Date: YYYY-MM-DD
  - Reference Number: [Number]

- [ ] **State Breach Notification Laws** (varies by state)
  - States: [List]
  - Notification Deadline: YYYY-MM-DD
  - Status: [Completed/In Progress/Not Required]

- [ ] **HIPAA Breach Notification** (60 days)
  - HHS Notification: [Yes/No/Not Required]
  - Affected Individuals: [Number]
  - Media Notification: [Yes/No/Not Required]

- [ ] **Other Regulatory Requirements**:
  - [Specify regulation and status]

### Other Notifications
- [ ] **Cyber Insurance**: Notified on YYYY-MM-DD, Claim #XXXXX
- [ ] **Law Enforcement**: [FBI/Local PD] contacted on YYYY-MM-DD
- [ ] **Third-Party Vendors**: [List vendors notified]
- [ ] **Customers**: [Number notified, method, date]
- [ ] **Media**: [Statement issued Yes/No, date]

---

## Lessons Learned

### What Went Well
1. [Example: SIEM alert triggered immediately, enabling fast detection]
2. [Example: Incident response team responded within SLA]
3. [Example: Recent backups were available and clean]

### What Could Be Improved
1. [Example: Vulnerability should have been patched 30 days ago]
2. [Example: Incident response playbook was outdated]
3. [Example: Communication with affected users was delayed]

### Action Items

| # | Action Item | Owner | Due Date | Priority | Status |
|---|------------|-------|----------|----------|--------|
| 1 | Implement automated patch management for critical systems | IT Manager | 2025-02-15 | High | Open |
| 2 | Update incident response playbook with ransomware procedures | Security Manager | 2025-02-01 | High | Open |
| 3 | Conduct security awareness training on phishing | HR/Security | 2025-03-01 | Medium | Open |
| 4 | Deploy EDR solution on all endpoints | IT Security | 2025-03-15 | High | Open |
| 5 | Implement immutable backups | IT Operations | 2025-02-28 | High | Open |
| 6 | Create customer communication templates | Communications | 2025-02-01 | Medium | Open |

---

## Post-Incident Review

**Review Meeting Date**: YYYY-MM-DD
**Attendees**: [List participants]

**Discussion Summary**:
[Summary of post-incident review meeting discussion]

**Key Decisions**:
1. [Decision 1]
2. [Decision 2]

---

## Compliance & Legal

### Regulatory Compliance Status
- **GDPR**: [Compliant | Breach Notification Filed | Under Review]
- **HIPAA**: [Compliant | Breach Notification Filed | Not Applicable]
- **PCI-DSS**: [Compliant | Incident Reported to Acquiring Bank | Not Applicable]
- **SOC 2**: [Control Deficiency Noted | No Impact | Not Applicable]

### Legal Review
- **Legal Counsel Consulted**: [Yes/No]
- **Litigation Risk**: [None | Low | Medium | High]
- **Privilege Considerations**: [Any communications under attorney-client privilege]

---

## Metrics

### Response Metrics
- **Mean Time to Detect (MTTD)**: X hours
- **Mean Time to Respond (MTTR)**: X hours
- **Mean Time to Contain (MTTC)**: X hours
- **Mean Time to Recover (MTTR)**: X hours
- **Total Incident Duration**: X hours

### Cost Metrics
- **Direct Response Costs**: $X,XXX
- **Recovery Costs**: $X,XXX
- **Downtime Costs**: $X,XXX
- **Notification Costs**: $X,XXX
- **Total Estimated Cost**: $X,XXX

---

## Appendices

### Appendix A: Technical Details
[Detailed technical analysis, IoCs, malware analysis, etc.]

### Appendix B: Evidence Inventory
[Complete list of all evidence collected with chain of custody]

### Appendix C: Communications
[Copies of all internal and external communications]

### Appendix D: Forensic Reports
[Attach or reference detailed forensic analysis reports]

---

## Sign-off

**Incident Commander**: _____________________ Date: __________
**CISO**: _____________________ Date: __________
**Legal**: _____________________ Date: __________

---

**Document Version**: 1.0
**Last Updated**: YYYY-MM-DD
**Classification**: Confidential - Internal Use Only
