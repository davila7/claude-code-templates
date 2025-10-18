---
name: security-compliance
description: Guides security professionals in implementing defense-in-depth security architectures, achieving compliance with industry frameworks (SOC2, ISO27001, GDPR, HIPAA), conducting threat modeling and risk assessments, managing security operations and incident response, and embedding security throughout the SDLC.
---

# Security & Compliance Expert

## Core Principles

### 1. Defense in Depth
Apply multiple layers of security controls so that if one fails, others provide protection. Never rely on a single security mechanism.

### 2. Zero Trust Architecture
Never trust, always verify. Assume breach and verify every access request regardless of location or network.

### 3. Least Privilege
Grant the minimum access necessary for users and systems to perform their functions. Regularly review and revoke unused permissions.

### 4. Security by Design
Integrate security requirements from the earliest stages of system design, not as an afterthought.

### 5. Continuous Monitoring
Implement ongoing monitoring and alerting to detect anomalies and security events in real-time.

### 6. Risk-Based Approach
Prioritize security efforts based on risk assessment, focusing resources on the most critical assets and likely threats.

### 7. Compliance as Foundation
Use compliance frameworks as a baseline, but go beyond minimum requirements to achieve actual security.

### 8. Incident Readiness
Prepare for security incidents through planning, testing, and regular tabletop exercises. Assume compromise will occur.

---

## Security & Compliance Lifecycle

### Phase 1: Assess & Plan
**Objective**: Understand current security posture and compliance requirements

**Activities**:
- Conduct security assessments and gap analysis
- Identify compliance requirements (SOC2, ISO27001, GDPR, HIPAA, PCI-DSS)
- Perform risk assessments and threat modeling
- Define security policies and standards
- Establish security governance structure
- Create security roadmap with prioritized initiatives

**Deliverables**:
- Risk register with prioritized risks
- Compliance gap analysis report
- Security architecture documentation
- Security policies and procedures
- Security roadmap and budget

### Phase 2: Design & Architect
**Objective**: Design secure systems and architectures

**Activities**:
- Design defense-in-depth architectures
- Implement Zero Trust network architecture
- Design identity and access management (IAM) systems
- Architect data protection and encryption solutions
- Design secure CI/CD pipelines
- Create threat models for applications and systems
- Define security controls and compensating controls

**Deliverables**:
- Security architecture diagrams
- Threat models (STRIDE, PASTA, or attack trees)
- Data flow diagrams with security boundaries
- Encryption and key management design
- IAM design with RBAC/ABAC models
- Security control matrix

### Phase 3: Implement & Harden
**Objective**: Deploy security controls and harden systems

**Activities**:
- Implement security controls (preventive, detective, corrective)
- Configure security tools (SIEM, EDR, CASB, WAF, IDS/IPS)
- Harden operating systems and applications
- Implement encryption at rest and in transit
- Deploy multi-factor authentication (MFA)
- Configure logging and monitoring
- Implement data loss prevention (DLP)
- Set up vulnerability management program

**Deliverables**:
- Hardening baselines and configuration standards
- Deployed security tools and controls
- Encryption implementation
- MFA deployment
- Security monitoring dashboards
- Vulnerability management procedures

### Phase 4: Monitor & Detect
**Objective**: Continuously monitor for threats and anomalies

**Activities**:
- Monitor security logs and events (SIEM)
- Analyze security alerts and anomalies
- Conduct threat hunting
- Perform vulnerability scanning and penetration testing
- Monitor compliance controls
- Track security metrics and KPIs
- Review access logs and privileged account activity
- Analyze threat intelligence feeds

**Deliverables**:
- Security operations center (SOC) runbooks
- Alert triage and escalation procedures
- Threat hunting playbooks
- Vulnerability scan reports
- Penetration test reports
- Security metrics dashboard
- Compliance monitoring reports

### Phase 5: Respond & Recover
**Objective**: Respond to security incidents and recover operations

**Activities**:
- Execute incident response plan
- Contain and eradicate threats
- Perform forensic analysis
- Recover affected systems
- Conduct post-incident reviews
- Update security controls based on lessons learned
- Report incidents to stakeholders and regulators
- Improve detection rules and response procedures

**Deliverables**:
- Incident response reports
- Forensic analysis findings
- Root cause analysis
- Remediation plans
- Updated incident response playbooks
- Regulatory breach notifications (if required)
- Post-incident review and recommendations

### Phase 6: Audit & Improve
**Objective**: Validate compliance and continuously improve security

**Activities**:
- Conduct internal audits
- Prepare for external audits (SOC2, ISO27001)
- Perform compliance assessments
- Review and update security policies
- Conduct security training and awareness programs
- Perform tabletop exercises and disaster recovery drills
- Update risk assessments
- Implement security improvements

**Deliverables**:
- Audit reports (internal and external)
- SOC2 Type II report
- ISO27001 certification
- Compliance attestations
- Updated policies and procedures
- Training completion metrics
- Tabletop exercise results
- Continuous improvement plan

---

## Decision Frameworks

### 1. Risk Assessment Framework

**When to use**: Evaluating security risks and prioritizing mitigation efforts

**Process**:

```
1. Identify Assets
   - What systems, data, and services need protection?
   - What is the business value of each asset?
   - Who are the asset owners?

2. Identify Threats
   - What threat actors might target these assets? (nation-state, cybercriminals, insiders)
   - What are their motivations? (financial gain, espionage, disruption)
   - What are current threat trends?

3. Identify Vulnerabilities
   - What weaknesses exist in systems or processes?
   - What security controls are missing or ineffective?
   - What are known CVEs affecting your systems?

4. Calculate Risk
   Risk = Likelihood × Impact

   Likelihood scale (1-5):
   1 = Rare (< 5% chance in 1 year)
   2 = Unlikely (5-25%)
   3 = Possible (25-50%)
   4 = Likely (50-75%)
   5 = Almost Certain (> 75%)

   Impact scale (1-5):
   1 = Minimal (< $10K loss, no data breach)
   2 = Minor ($10K-$100K, limited data exposure)
   3 = Moderate ($100K-$1M, significant data breach)
   4 = Major ($1M-$10M, extensive data breach, regulatory fines)
   5 = Catastrophic (> $10M, business-threatening)

   Risk Score = Likelihood × Impact (max 25)

5. Prioritize Risks
   - Critical: Risk score 15-25 (immediate action)
   - High: Risk score 10-14 (action within 30 days)
   - Medium: Risk score 5-9 (action within 90 days)
   - Low: Risk score 1-4 (monitor and accept)

6. Determine Risk Response
   - Mitigate: Implement controls to reduce risk
   - Accept: Document acceptance if risk is within tolerance
   - Transfer: Use insurance or third-party services
   - Avoid: Eliminate the activity that creates risk
```

**Output**: Risk register with prioritized risks and mitigation plans

### 2. Security Control Selection

**When to use**: Choosing appropriate security controls for identified risks

**Framework**: Use NIST CSF categories or CIS Controls

```
NIST CSF Functions:
1. Identify (ID)
   - Asset Management
   - Risk Assessment
   - Governance

2. Protect (PR)
   - Access Control
   - Data Security
   - Protective Technology

3. Detect (DE)
   - Anomalies and Events
   - Security Monitoring
   - Detection Processes

4. Respond (RS)
   - Response Planning
   - Communications
   - Analysis and Mitigation

5. Recover (RC)
   - Recovery Planning
   - Improvements
   - Communications

Control Types:
- Preventive: Stop incidents before they occur (MFA, firewalls, encryption)
- Detective: Identify incidents when they occur (SIEM, IDS, log monitoring)
- Corrective: Fix issues after detection (patching, incident response)
- Deterrent: Discourage attackers (security policies, warnings)
- Compensating: Alternative controls when primary controls aren't feasible

Selection Criteria:
1. Does it address the identified risk?
2. Is it cost-effective? (Control cost < Risk value)
3. Is it technically feasible?
4. Does it meet compliance requirements?
5. Can we maintain and monitor it?
```

### 3. Compliance Framework Selection

**When to use**: Determining which compliance frameworks to implement

**Decision Tree**:

```
What type of organization are you?

├─ SaaS/Cloud Service Provider
│  ├─ Selling to enterprises? → SOC2 Type II (required)
│  ├─ International customers? → ISO27001 (strongly recommended)
│  ├─ Handling health data? → HIPAA + HITRUST
│  └─ Handling payment cards? → PCI-DSS

├─ Healthcare Provider/Payer
│  ├─ U.S.-based → HIPAA (required)
│  ├─ International → HIPAA + GDPR
│  └─ Plus: HITRUST for comprehensive framework

├─ Financial Services
│  ├─ U.S. banks → GLBA, SOX (if public)
│  ├─ Payment processing → PCI-DSS (required)
│  ├─ International → ISO27001, local regulations
│  └─ Plus: NIST CSF for framework

├─ E-commerce/Retail
│  ├─ Accept credit cards → PCI-DSS (required)
│  ├─ EU customers → GDPR (required)
│  ├─ California customers → CCPA
│  └─ B2B sales → SOC2 Type II

└─ General Enterprise
   ├─ Selling to enterprises → SOC2 Type II
   ├─ Want broad recognition → ISO27001
   ├─ Government contracts → FedRAMP, NIST 800-53
   └─ Industry-specific → Check sector regulations

Multi-Framework Strategy:
- Start with: SOC2 or ISO27001 (choose one as foundation)
- Add: Data privacy regulations (GDPR, CCPA) as needed
- Layer on: Industry-specific requirements
```

### 4. Incident Severity Classification

**When to use**: Triaging and responding to security incidents

**Severity Levels**:

```
P0 - Critical (Immediate Response)
- Active breach with data exfiltration occurring
- Ransomware encryption in progress
- Complete system outage of critical services
- Unauthorized access to production databases
- Response: Engage CIRT immediately, executive notification, 24/7 effort

P1 - High (Response within 1 hour)
- Confirmed malware on critical systems
- Attempted unauthorized access to sensitive data
- DDoS attack affecting availability
- Significant vulnerability with active exploits
- Response: Engage CIRT, manager notification, work until contained

P2 - Medium (Response within 4 hours)
- Malware on non-critical systems
- Suspicious account activity
- Policy violations with security impact
- Vulnerability requiring patching
- Response: Security team investigation, business hours

P3 - Low (Response within 24 hours)
- Failed login attempts (below threshold)
- Minor policy violations
- Informational security events
- Response: Standard queue, document findings

Classification Factors:
1. Data confidentiality impact (PHI, PII, financial, IP)
2. System availability impact (revenue, operations)
3. Data integrity impact (corruption, unauthorized changes)
4. Number of affected systems/users
5. Regulatory reporting requirements
```

### 5. Vulnerability Prioritization

**When to use**: Prioritizing vulnerability remediation

**Framework**: Enhanced CVSS with business context

```
Base CVSS Score × Business Context Multiplier = Priority Score

CVSS Severity Ranges:
- Critical: 9.0-10.0
- High: 7.0-8.9
- Medium: 4.0-6.9
- Low: 0.1-3.9

Business Context Multipliers:
- Internet-facing production system: 2.0×
- Internal production system: 1.5×
- Systems with sensitive data: 1.5×
- Development/test environment: 0.5×
- Active exploit in the wild: 2.0×
- Compensating controls in place: 0.7×

Priority Levels:
- P0 (Critical): Score ≥ 14 → Patch within 24-48 hours
- P1 (High): Score 10-13.9 → Patch within 7 days
- P2 (Medium): Score 6-9.9 → Patch within 30 days
- P3 (Low): Score < 6 → Patch within 90 days or accept risk

Additional Considerations:
- Can the system be isolated/segmented?
- Are there effective detective controls?
- What is the patching complexity/risk?
- Is there a vendor patch available?
```

### 6. Third-Party Risk Assessment

**When to use**: Evaluating security risks of vendors and partners

**Assessment Framework**:

```
1. Categorize Vendor Risk Level

Low Risk (Minimal assessment):
- No access to systems or data
- Limited integration
- Non-critical service
→ Simple questionnaire

Medium Risk (Standard assessment):
- Limited system access
- Non-sensitive data access
- Important but not critical service
→ Security questionnaire + evidence review

High Risk (Comprehensive assessment):
- Production system access
- Sensitive data processing
- Critical service dependency
→ Full assessment + audit reports + pen test

Critical Risk (Extensive assessment):
- Full production access
- PHI/PII processing
- Business-critical dependency
→ On-site audit + continuous monitoring + SLA

2. Assessment Components

For Medium/High/Critical vendors:
□ Security questionnaire (SIG, CAIQ, or custom)
□ Compliance certifications (SOC2, ISO27001)
□ Insurance certificates (cyber liability)
□ Security policies and procedures
□ Incident response plan
□ Disaster recovery/business continuity plan
□ Data processing agreement (DPA)
□ Penetration test results (for high/critical)
□ Right to audit clause in contract

3. Ongoing Monitoring

- Annual reassessment
- Monitor for breaches/incidents
- Review security updates and patches
- Track compliance certification renewals
- Conduct periodic audits (for critical vendors)

4. Vendor Risk Score

Calculate score (0-100):
- Security maturity: 40 points
- Compliance certifications: 20 points
- Incident history: 15 points
- Financial stability: 15 points
- References and reputation: 10 points

Action based on score:
- 80-100: Approved
- 60-79: Approved with conditions
- 40-59: Requires remediation plan
- < 40: Do not engage
```

---

## Key Security Frameworks & Standards

### NIST Cybersecurity Framework (CSF)
- **Purpose**: Risk-based framework for improving cybersecurity
- **Structure**: 5 Functions, 23 Categories, 108 Subcategories
- **Best for**: General organizations, government contractors
- **Maturity model**: Tier 1 (Partial) to Tier 4 (Adaptive)

### CIS Critical Security Controls
- **Purpose**: Prioritized set of actions for cyber defense
- **Structure**: 18 Controls with Implementation Groups (IG1, IG2, IG3)
- **Best for**: Practical implementation guidance
- **Focus**: Defense against common attack patterns

### ISO/IEC 27001
- **Purpose**: International standard for information security management
- **Structure**: 14 domains, 114 controls (Annex A)
- **Best for**: International recognition, formal certification
- **Requirements**: ISMS (Information Security Management System)

### SOC 2 Type II
- **Purpose**: Service organization controls for security and availability
- **Structure**: Trust Service Criteria (Security, Availability, Confidentiality, Processing Integrity, Privacy)
- **Best for**: SaaS companies, cloud service providers
- **Audit**: 3-12 month observation period

### NIST 800-53
- **Purpose**: Security controls for federal systems
- **Structure**: 20 families, 1000+ controls
- **Best for**: Government contractors, FedRAMP
- **Baselines**: Low, Moderate, High impact systems

### GDPR (General Data Protection Regulation)
- **Purpose**: EU data privacy regulation
- **Scope**: Any organization processing EU residents' data
- **Requirements**: Lawful basis, consent, data subject rights, breach notification
- **Penalties**: Up to 4% of global revenue or €20M

### HIPAA (Health Insurance Portability and Accountability Act)
- **Purpose**: Protect health information (PHI)
- **Scope**: Healthcare providers, payers, business associates
- **Requirements**: Administrative, Physical, Technical safeguards
- **Penalties**: $100-$50,000 per violation, criminal charges possible

### PCI-DSS (Payment Card Industry Data Security Standard)
- **Purpose**: Protect cardholder data
- **Structure**: 12 requirements, 6 control objectives
- **Scope**: Any organization storing, processing, or transmitting card data
- **Levels**: Based on transaction volume (Level 1-4)

---

## Core Security Domains

### 1. Identity & Access Management (IAM)
- Authentication mechanisms (MFA, SSO, passwordless)
- Authorization models (RBAC, ABAC, ReBAC)
- Privileged access management (PAM)
- Identity governance and administration (IGA)
- Directory services (Active Directory, LDAP, Okta, Auth0)

### 2. Network Security
- Network segmentation and micro-segmentation
- Firewalls (next-gen, WAF, application-layer)
- Intrusion detection/prevention (IDS/IPS)
- VPN and secure remote access
- Zero Trust network architecture (ZTNA)
- DDoS protection

### 3. Data Security
- Encryption at rest and in transit (AES-256, TLS 1.3)
- Key management (KMS, HSM)
- Data classification and labeling
- Data loss prevention (DLP)
- Database security (encryption, masking, tokenization)
- Secrets management (Vault, AWS Secrets Manager)

### 4. Application Security
- Secure SDLC and DevSecOps
- SAST (Static Application Security Testing)
- DAST (Dynamic Application Security Testing)
- SCA (Software Composition Analysis)
- Secure code review
- OWASP Top 10 mitigation

### 5. Cloud Security
- Cloud security posture management (CSPM)
- Cloud access security broker (CASB)
- Container security (image scanning, runtime protection)
- Serverless security
- Infrastructure as Code (IaC) security scanning
- Multi-cloud security architecture

### 6. Endpoint Security
- Endpoint detection and response (EDR)
- Antivirus and anti-malware
- Host-based firewalls
- Device encryption (BitLocker, FileVault)
- Mobile device management (MDM)
- Patch management

### 7. Security Operations
- Security Information and Event Management (SIEM)
- Security Orchestration, Automation, and Response (SOAR)
- Threat intelligence platforms (TIP)
- Threat hunting
- Vulnerability management
- Penetration testing and red teaming

### 8. Incident Response
- Incident response plan and playbooks
- Computer forensics and investigation
- Malware analysis
- Threat containment and eradication
- Post-incident review and lessons learned
- Regulatory breach notification

### 9. Governance, Risk & Compliance (GRC)
- Security policies and procedures
- Risk assessment and management
- Compliance management and auditing
- Security awareness training
- Vendor risk management
- Business continuity and disaster recovery

---

## Security Metrics & KPIs

### Risk & Compliance Metrics
- Number of critical/high risks open
- Risk remediation time (mean time to remediate)
- Compliance audit findings (open/closed)
- Compliance control effectiveness rate
- Policy acknowledgment completion rate
- Training completion rate

### Vulnerability Management Metrics
- Mean time to detect (MTTD) vulnerabilities
- Mean time to patch (MTTP)
- Vulnerability backlog (total open, by severity)
- Patch compliance rate (% systems patched within SLA)
- Vulnerability recurrence rate

### Incident Response Metrics
- Mean time to detect (MTTD) incidents
- Mean time to respond (MTTR)
- Mean time to contain (MTTC)
- Mean time to recover (MTTR)
- Number of incidents by severity
- Incident recurrence rate
- False positive rate

### Security Operations Metrics
- SIEM alert volume (total, by severity)
- Alert triage time
- Alert false positive rate
- Security tool coverage (% assets monitored)
- Threat hunting coverage (% environment reviewed)
- Penetration test findings

### Access Management Metrics
- MFA adoption rate
- Privileged account review completion rate
- Access certification completion rate
- Orphaned account count
- Password policy compliance rate
- Failed login attempt rate

### Awareness & Culture Metrics
- Phishing simulation click rate
- Security training completion rate
- Security awareness quiz scores
- Security policy violations
- Security-related helpdesk tickets

---

## Security Tools Ecosystem

### SIEM (Security Information & Event Management)
- Splunk Enterprise Security
- IBM QRadar
- Microsoft Sentinel
- Elastic Security
- Sumo Logic

### EDR/XDR (Endpoint/Extended Detection & Response)
- CrowdStrike Falcon
- SentinelOne
- Microsoft Defender for Endpoint
- Palo Alto Cortex XDR
- Carbon Black

### Vulnerability Management
- Tenable Nessus/Tenable.io
- Qualys VMDR
- Rapid7 InsightVM
- Greenbone OpenVAS (open source)

### Cloud Security
- Wiz
- Prisma Cloud (Palo Alto)
- Lacework
- Orca Security
- AWS Security Hub / Azure Security Center / GCP Security Command Center

### SAST/DAST
- Snyk
- Veracode
- Checkmarx
- SonarQube
- OWASP ZAP (open source)

### Container Security
- Aqua Security
- Sysdig Secure
- Prisma Cloud Compute
- Trivy (open source)

### Secrets Management
- HashiCorp Vault
- AWS Secrets Manager
- Azure Key Vault
- CyberArk

### Identity & Access
- Okta
- Auth0
- Azure AD / Entra ID
- Ping Identity
- CyberArk (PAM)

---

## Common Security Workflows

### 1. Security Incident Response Workflow

```
1. Detection & Alert
   ↓
2. Triage & Classification
   - Determine severity (P0-P3)
   - Assign to responder
   ↓
3. Investigation
   - Gather evidence
   - Analyze logs (SIEM)
   - Determine scope
   ↓
4. Containment
   - Isolate affected systems
   - Block malicious IPs/domains
   - Disable compromised accounts
   ↓
5. Eradication
   - Remove malware
   - Close vulnerabilities
   - Patch systems
   ↓
6. Recovery
   - Restore from backups
   - Verify system integrity
   - Return to production
   ↓
7. Post-Incident Review
   - Document timeline
   - Root cause analysis
   - Update playbooks
   - Implement improvements
   ↓
8. Reporting
   - Executive summary
   - Regulatory notification (if required)
   - Stakeholder communication
```

### 2. Vulnerability Management Workflow

```
1. Asset Discovery
   - Scan network for assets
   - Maintain asset inventory
   ↓
2. Vulnerability Scanning
   - Authenticated scans
   - Unauthenticated scans
   - Agent-based monitoring
   ↓
3. Assessment & Validation
   - Validate findings
   - Remove false positives
   - Add business context
   ↓
4. Prioritization
   - Apply CVSS + context
   - Assign severity (P0-P3)
   - Create remediation tickets
   ↓
5. Remediation
   - Patch systems
   - Apply compensating controls
   - Update configurations
   ↓
6. Verification
   - Rescan to confirm fix
   - Update vulnerability status
   ↓
7. Reporting
   - Metrics dashboard
   - Executive reports
   - Trend analysis
```

### 3. Access Review Workflow

```
1. Schedule Review (Quarterly)
   ↓
2. Generate Access Reports
   - User access by role
   - Privileged accounts
   - Service accounts
   - Orphaned accounts
   ↓
3. Distribute to Managers
   - Each manager reviews their team
   - Certify appropriate access
   ↓
4. Review & Certify
   - Approve legitimate access
   - Flag inappropriate access
   - Identify orphaned accounts
   ↓
5. Remediation
   - Revoke unapproved access
   - Disable orphaned accounts
   - Update RBAC assignments
   ↓
6. Document & Report
   - Certification completion rate
   - Access changes made
   - Compliance evidence
```

### 4. SOC2 Audit Preparation Workflow

```
1. Scoping (3-4 months before)
   - Define in-scope systems
   - Select Trust Service Criteria
   - Engage auditor
   ↓
2. Gap Assessment (2-3 months before)
   - Map controls to requirements
   - Identify control gaps
   - Create remediation plan
   ↓
3. Readiness (1-2 months before)
   - Implement missing controls
   - Document policies/procedures
   - Conduct mock audit
   ↓
4. Evidence Collection (Ongoing)
   - Automate evidence gathering
   - Organize evidence repository
   - Prepare control narratives
   ↓
5. Audit Kickoff
   - Provide evidence to auditor
   - Respond to requests
   - Schedule interviews
   ↓
6. Fieldwork (4-6 weeks)
   - Auditor tests controls
   - Provide additional evidence
   - Address findings
   ↓
7. Report Issuance
   - Review draft report
   - Address any exceptions
   - Receive final SOC2 report
   ↓
8. Continuous Monitoring
   - Monitor control effectiveness
   - Prepare for next audit cycle
```

---

## Best Practices

### Security Architecture
- Design with security in mind from the start (shift-left)
- Apply defense in depth with multiple security layers
- Implement Zero Trust: verify explicitly, use least privilege, assume breach
- Segment networks and limit lateral movement
- Encrypt data at rest and in transit
- Use secure defaults and fail securely

### Access Control
- Enforce multi-factor authentication (MFA) everywhere
- Implement least privilege access
- Use just-in-time (JIT) privileged access
- Regularly review and certify access
- Disable accounts promptly on termination
- Avoid shared accounts and service account abuse

### Security Operations
- Centralize logging with SIEM
- Automate detection and response where possible
- Maintain an incident response plan and test it
- Conduct regular threat hunting exercises
- Keep vulnerability remediation SLAs aggressive
- Practice incident response through tabletop exercises

### Application Security
- Integrate security into CI/CD (DevSecOps)
- Scan code for vulnerabilities (SAST, DAST, SCA)
- Follow OWASP Top 10 guidelines
- Conduct security code reviews for critical changes
- Implement secure API design (authentication, rate limiting, input validation)
- Use security headers (CSP, HSTS, X-Frame-Options)

### Cloud Security
- Use infrastructure as code (IaC) with security scanning
- Enable cloud-native security services (GuardDuty, Security Hub)
- Implement CSPM to monitor misconfigurations
- Use cloud-native encryption and key management
- Apply least privilege IAM policies
- Monitor for shadow IT and unauthorized resources

### Compliance
- Treat compliance as a continuous process, not one-time
- Map controls to multiple frameworks for efficiency
- Automate evidence collection where possible
- Maintain a compliance calendar for deadlines
- Document everything (if it's not documented, it doesn't exist)
- Conduct internal audits before external audits

### Security Culture
- Make security everyone's responsibility
- Conduct regular security awareness training
- Run phishing simulations to test awareness
- Reward security-conscious behavior
- Create clear, accessible security policies
- Foster a culture where reporting security concerns is encouraged

---

## Integration with Other Disciplines

### With DevOps/Platform Engineering
- Integrate security scanning into CI/CD pipelines
- Automate security testing and compliance checks
- Implement Infrastructure as Code (IaC) security
- Use container scanning and runtime protection
- Coordinate on incident response for production issues

### With Enterprise Architecture
- Align security architecture with enterprise architecture
- Participate in architecture review boards
- Ensure security requirements in architecture standards
- Design secure integration patterns
- Define security reference architectures

### With IT Operations
- Coordinate on patch management and change control
- Collaborate on monitoring and alerting
- Joint incident response for security and operational incidents
- Align on backup and disaster recovery procedures
- Coordinate access management and privileged access

### With Product Management
- Provide security requirements for new features
- Participate in threat modeling for new products
- Balance security with user experience
- Advise on privacy and compliance implications
- Support security as a product differentiator

### With Legal/Privacy
- Coordinate on data privacy regulations (GDPR, CCPA)
- Collaborate on breach notification requirements
- Review vendor contracts for security terms
- Support privacy impact assessments
- Align on data retention and deletion policies

---

## When to Engage Security & Compliance

### Required Engagement
- New system or application design
- Architecture changes affecting security boundaries
- Regulatory compliance initiatives
- Security incidents
- Vendor risk assessments
- Pre-production security reviews
- Audit preparation
- Data breach or suspected breach

### Recommended Engagement
- Major feature releases
- Cloud migrations
- M&A due diligence
- Infrastructure changes
- New third-party integrations
- Significant process changes
- Security tool selection
- Policy updates

### Continuous Collaboration
- Security review of pull requests (for critical systems)
- Vulnerability remediation prioritization
- Security awareness and training
- Threat intelligence sharing
- Risk assessment updates
- Compliance monitoring
