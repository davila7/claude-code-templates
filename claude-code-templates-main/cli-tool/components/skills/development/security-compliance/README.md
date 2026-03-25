# Security & Compliance Expert

A comprehensive skill pack for security professionals implementing defense-in-depth security architectures, achieving compliance with industry frameworks, conducting threat modeling and risk assessments, managing security operations and incident response, and embedding security throughout the SDLC.

## Overview

This skill pack provides frameworks, methodologies, tools, and best practices for:

- **Security Architecture**: Zero Trust, defense in depth, network segmentation, cloud security
- **Compliance**: SOC 2, ISO 27001, GDPR, HIPAA, PCI-DSS, FedRAMP
- **Threat Modeling & Risk Assessment**: STRIDE, PASTA, attack trees, quantitative/qualitative risk analysis
- **Security Operations**: SOC operations, SIEM, incident response, threat hunting
- **Application Security**: OWASP Top 10, secure SDLC, DevSecOps, API security

## Quick Start

### For New Security Professionals

**Getting Started Checklist**:
1. Read [SKILL.md](SKILL.md) for core principles and lifecycle
2. Review [security-architecture.md](reference/security-architecture.md) for foundational concepts
3. Study [compliance-frameworks.md](reference/compliance-frameworks.md) for your industry
4. Practice with risk calculator: `python scripts/risk_calculator.py --interactive`

**First 30 Days**:
- Week 1: Learn security fundamentals and core principles
- Week 2: Understand your organization's compliance requirements
- Week 3: Shadow SOC operations and incident response
- Week 4: Conduct first risk assessment using provided tools

### For Experienced Security Professionals

**Quick Reference**:
- [Security Operations](reference/security-operations.md): SOC playbooks, SIEM use cases, IR procedures
- [Threat Modeling](reference/threat-modeling-risk.md): STRIDE methodology, attack trees, vulnerability scoring
- [Application Security](reference/application-security.md): Secure coding, OWASP Top 10, DevSecOps pipeline

**Common Tasks**:
- Risk assessment: `python scripts/risk_calculator.py risks.csv`
- Vulnerability prioritization: `python scripts/vuln_prioritizer.py vulnerabilities.csv`
- Incident response: Use [incident-response-template.md](examples/incident-response-template.md)

## File Structure

```
security-compliance/
├── SKILL.md                          # Core security frameworks and workflows
├── README.md                         # This file
├── reference/
│   ├── security-architecture.md      # Zero Trust, defense in depth, cloud security
│   ├── compliance-frameworks.md      # SOC2, ISO27001, GDPR, HIPAA, PCI-DSS
│   ├── threat-modeling-risk.md       # Threat modeling, risk assessment, vulnerability management
│   ├── security-operations.md        # SOC operations, SIEM, incident response
│   └── application-security.md       # Secure SDLC, OWASP Top 10, DevSecOps
├── scripts/
│   ├── risk_calculator.py            # Risk assessment calculator (quantitative & qualitative)
│   └── vuln_prioritizer.py           # Vulnerability prioritization tool
└── examples/
    ├── risks.csv                     # Sample risk data
    ├── vulnerabilities.csv           # Sample vulnerability data
    ├── incident-response-template.md # Complete incident response report template
    └── soc2-control-example.md       # SOC 2 control documentation example
```

## Common Scenarios

### Scenario 1: Conducting a Risk Assessment

**Situation**: You need to assess cybersecurity risks for your organization and create a risk register.

**Steps**:
1. Review risk assessment methodology in [threat-modeling-risk.md](reference/threat-modeling-risk.md)
2. Create CSV file with your risks (use [risks.csv](examples/risks.csv) as template)
3. Run risk calculator:
   ```bash
   python scripts/risk_calculator.py risks.csv --output risk_report.csv
   ```
4. Review report and prioritize high-risk items
5. Create risk mitigation plans for Critical and High risks
6. Present findings to leadership using summary statistics

**Expected Outcome**: Comprehensive risk register with quantitative ALE calculations and qualitative risk levels, enabling data-driven prioritization of security investments.

---

### Scenario 2: Achieving SOC 2 Type II Compliance

**Situation**: Your SaaS company needs SOC 2 Type II certification to close enterprise deals.

**Steps**:
1. Read SOC 2 section in [compliance-frameworks.md](reference/compliance-frameworks.md)
2. Follow 6-month readiness roadmap:
   - Months 6-4: Scoping, gap assessment, policy development
   - Months 4-2: Control implementation, evidence preparation
   - Months 2-0: Observation period, audit execution
3. Use [soc2-control-example.md](examples/soc2-control-example.md) as template for documenting controls
4. Implement automated evidence collection (Python scripts provided in examples)
5. Conduct mock audit 1 month before real audit
6. Work with auditor during field work

**Expected Outcome**: SOC 2 Type II report within 6-8 months, enabling enterprise sales.

---

### Scenario 3: Responding to a Security Incident

**Situation**: Your SOC detected ransomware on multiple systems.

**Steps**:
1. Follow incident response lifecycle in [security-operations.md](reference/security-operations.md)
2. Use IR playbook for ransomware (included in security-operations.md)
3. Document everything using [incident-response-template.md](examples/incident-response-template.md)
4. Execute response:
   - **Preparation**: Activate CIRT, establish communication channels
   - **Detection**: Determine scope (number of systems infected)
   - **Containment**: Isolate affected systems, disable VPN
   - **Eradication**: Remove malware, close vulnerability
   - **Recovery**: Restore from offline backups, verify integrity
   - **Post-Incident**: Conduct review, implement improvements
5. Assess breach notification requirements (GDPR, state laws)
6. Conduct post-incident review within 5 days

**Expected Outcome**: Contained incident with minimal data loss, documented response for audit trail, actionable improvements to prevent recurrence.

---

### Scenario 4: Prioritizing Vulnerability Remediation

**Situation**: Vulnerability scan identified 500+ vulnerabilities across your infrastructure. You need to prioritize patching.

**Steps**:
1. Export vulnerabilities to CSV (use [vulnerabilities.csv](examples/vulnerabilities.csv) as template)
2. Add business context:
   - Asset criticality (1-5)
   - Exposure (internet_facing, internal, isolated)
   - Data sensitivity (highly_confidential, confidential, public)
   - Exploit availability and active exploitation
   - Compensating controls
3. Run vulnerability prioritizer:
   ```bash
   python scripts/vuln_prioritizer.py vulnerabilities.csv --output prioritized.csv
   ```
4. Review prioritized list (P0 = Critical, P1 = High, P2 = Medium, P3 = Low)
5. Create remediation tickets with SLA:
   - P0: Patch within 24-48 hours
   - P1: Patch within 7 days
   - P2: Patch within 30 days
   - P3: Patch within 90 days
6. Track remediation progress

**Expected Outcome**: Focused remediation efforts on highest-risk vulnerabilities, reducing critical exposures within days instead of months.

---

### Scenario 5: Implementing Zero Trust Architecture

**Situation**: Your organization is moving to cloud and wants to implement Zero Trust.

**Steps**:
1. Read Zero Trust section in [security-architecture.md](reference/security-architecture.md)
2. Follow Zero Trust implementation roadmap:
   - **Phase 1 (Months 1-3)**: Foundation - Strong IAM, MFA everywhere, asset inventory, logging
   - **Phase 2 (Months 4-6)**: Visibility - Map data flows, deploy EDR, implement UEBA
   - **Phase 3 (Months 7-9)**: Segmentation - Micro-segmentation, security zones, application-layer controls
   - **Phase 4 (Months 10-12)**: Automation - Automated policy enforcement, SOAR, threat intelligence
   - **Phase 5 (Ongoing)**: Optimization - Continuous policy refinement, threat hunting
3. Implement three tenets:
   - Verify explicitly (MFA, device posture, context)
   - Use least privilege (JIT access, RBAC)
   - Assume breach (monitor continuously, segment)
4. Deploy technology stack:
   - Identity: Okta, Azure AD
   - Network: Micro-segmentation, ZTNA
   - Endpoint: EDR, device compliance
   - Data: Encryption, DLP

**Expected Outcome**: Zero Trust architecture reducing blast radius of breaches, enabling secure remote work, improving compliance posture.

---

## Python Scripts

### Risk Calculator

Calculate risk scores using both qualitative (risk matrix) and quantitative (ALE) methodologies.

**Features**:
- Quantitative: Single Loss Expectancy (SLE), Annualized Loss Expectancy (ALE)
- Qualitative: Risk matrix (Likelihood × Impact), risk levels (Critical/High/Medium/Low)
- Cost-benefit analysis for security controls
- Interactive mode for one-off assessments
- CSV batch processing

**Usage**:
```bash
# Interactive mode
python scripts/risk_calculator.py --interactive

# Process CSV file
python scripts/risk_calculator.py examples/risks.csv

# Generate report
python scripts/risk_calculator.py risks.csv --output risk_report.csv
```

**Sample Output**:
```
Risk Assessment Summary
============================================================
Total Risks: 15
Total ALE: $3,250,000

Risk Level Distribution:
  Critical: 3
  High: 5
  Medium: 4
  Low: 3

Top 5 Risks by ALE:
  Ransomware Attack on Production Infrastructure: $900,000
  Data Breach - Customer PII Exposure: $800,000
  Cloud Misconfiguration Exposure: $700,000
  ...
```

---

### Vulnerability Prioritizer

Prioritize vulnerabilities based on CVSS score combined with business context.

**Features**:
- Enhanced CVSS scoring with business context
- Factors: Asset criticality, exposure, data sensitivity, exploitability, compensating controls
- Priority levels (P0-P3) with SLA recommendations
- Rationale generation for prioritization decisions
- Filter by priority level

**Usage**:
```bash
# Interactive mode
python scripts/vuln_prioritizer.py --interactive

# Process CSV file
python scripts/vuln_prioritizer.py examples/vulnerabilities.csv

# Generate report
python scripts/vuln_prioritizer.py vulnerabilities.csv --output prioritized.csv

# Filter critical only
python scripts/vuln_prioritizer.py vulnerabilities.csv --filter-level P0
```

**Sample Output**:
```
Vulnerability Summary
============================================================
Total Vulnerabilities: 15

Priority Distribution:
  P0: 2
  P1: 5
  P2: 5
  P3: 3

Exploitability:
  Public exploits available: 11
  Active exploitation: 4

Top Prioritized Vulnerabilities
CVE ID                 System                           CVSS   Priority   Level   Due Date
------------------------------------------------------------------------------------------
CVE-2021-44228        prod-web-01.company.com          10.0   30.00      P0      2025-01-11
CVE-2024-66666        vcenter.company.com              9.8    29.40      P0      2025-01-10
...
```

---

## Best Practices

### Security Architecture
- Design with security from the start (shift-left)
- Apply defense in depth - multiple security layers
- Implement Zero Trust: verify explicitly, use least privilege, assume breach
- Segment networks to limit lateral movement
- Encrypt data at rest and in transit with strong algorithms

### Compliance
- Treat compliance as continuous, not one-time certification
- Map controls across frameworks to maximize efficiency
- Automate evidence collection where possible
- Maintain compliance calendar for deadlines
- Document everything - if it's not documented, it doesn't exist

### Risk Management
- Conduct risk assessments at least annually
- Use both qualitative (risk matrix) and quantitative (ALE) methods
- Focus on business impact, not just technical severity
- Accept risk explicitly when mitigation isn't cost-effective
- Track risk remediation with clear ownership and deadlines

### Security Operations
- Centralize logging with SIEM for correlation
- Tune alerts to reduce false positives (<20% target)
- Maintain incident response plan and test it (tabletop exercises)
- Measure metrics: MTTD, MTTR, MTTC, MTTR
- Conduct proactive threat hunting regularly

### Application Security
- Integrate security into CI/CD pipeline (DevSecOps)
- Use SAST, DAST, and SCA scanning
- Follow OWASP Top 10 guidelines
- Conduct security code reviews for critical changes
- Never store secrets in code - use secrets manager

---

## Integration with Other Skills

### With DevOps/Platform Engineering
- Embed security in CI/CD pipelines (SAST, DAST, SCA, container scanning)
- Implement Infrastructure as Code (IaC) security scanning
- Automate security testing and compliance checks
- Coordinate on incident response for production issues
- Share responsibility for cloud security

### With Enterprise Architecture
- Align security architecture with enterprise architecture
- Participate in architecture review boards
- Define security reference architectures and patterns
- Ensure security requirements in architecture standards
- Design secure integration patterns for systems

### With IT Operations
- Coordinate on patch management and change control
- Collaborate on monitoring, logging, and alerting
- Joint incident response (security + operational)
- Align on backup/disaster recovery procedures
- Manage privileged access together

### With Product Management
- Provide security requirements for new features
- Participate in threat modeling for new products
- Balance security with user experience
- Advise on privacy and compliance implications
- Support security as product differentiator

### With Legal/Privacy
- Coordinate on data privacy regulations (GDPR, CCPA)
- Collaborate on breach notification requirements
- Review vendor contracts for security terms
- Support privacy impact assessments (DPIA)
- Align on data retention and deletion policies

---

## Key Frameworks Reference

### NIST Cybersecurity Framework (CSF)
**Functions**: Identify → Protect → Detect → Respond → Recover
**Best for**: General organizations, government contractors
**Maturity**: Tier 1 (Partial) to Tier 4 (Adaptive)

### CIS Critical Security Controls
**Structure**: 18 controls, 3 Implementation Groups
**Best for**: Practical, prioritized implementation
**Focus**: Defend against common attack patterns

### ISO/IEC 27001
**Structure**: ISMS with 14 domains, 93 controls (2022 version)
**Best for**: International recognition, formal certification
**Process**: Plan → Do → Check → Act

### SOC 2 Type II
**Criteria**: Security (required) + Availability, Confidentiality, Processing Integrity, Privacy (optional)
**Best for**: SaaS companies, cloud service providers
**Audit**: 3-12 month observation period

### OWASP Top 10 (2021)
1. Broken Access Control
2. Cryptographic Failures
3. Injection
4. Insecure Design
5. Security Misconfiguration
6. Vulnerable and Outdated Components
7. Identification and Authentication Failures
8. Software and Data Integrity Failures
9. Security Logging and Monitoring Failures
10. Server-Side Request Forgery (SSRF)

---

## Metrics & KPIs

### Risk Management
- Number of critical/high risks open
- Risk remediation time (mean)
- Compliance control effectiveness rate

### Vulnerability Management
- Mean time to patch (MTTP) by severity
- Vulnerability backlog (by severity)
- Patch compliance rate

### Security Operations
- Mean time to detect (MTTD)
- Mean time to respond (MTTR)
- Mean time to contain (MTTC)
- False positive rate (target <20%)

### Incident Response
- Number of incidents by severity
- Incident recurrence rate
- SLA compliance rate

### Application Security
- Vulnerabilities found per 1000 lines of code
- Security defects escaping to production
- SAST/DAST scan coverage

---

## Additional Resources

### Training & Certifications
- CISSP (Certified Information Systems Security Professional)
- CISM (Certified Information Security Manager)
- CEH (Certified Ethical Hacker)
- OSCP (Offensive Security Certified Professional)
- CCSP (Certified Cloud Security Professional)
- Security+ (CompTIA)

### Communities
- OWASP (Open Web Application Security Project)
- SANS Reading Room
- r/netsec, r/AskNetsec (Reddit)
- Information Security Stack Exchange
- Local ISACA and ISC² chapters

### Tools
- SIEM: Splunk, Elastic Security, Microsoft Sentinel
- EDR: CrowdStrike, SentinelOne, Microsoft Defender
- Vulnerability Scanning: Tenable, Qualys, Rapid7
- SAST/DAST: Snyk, Veracode, Checkmarx, SonarQube
- Cloud Security: Wiz, Prisma Cloud, Orca Security

---

## Contributing

This skill pack is continuously updated based on evolving threats, new regulations, and industry best practices. Contributions and feedback are welcome.

## License

This skill pack is provided for educational and professional development purposes.
