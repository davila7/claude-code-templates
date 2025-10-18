# Compliance Frameworks

## SOC 2 (Service Organization Control 2)

### Overview

SOC 2 is an auditing standard developed by the American Institute of CPAs (AICPA) for service organizations. It evaluates a company's information systems based on five Trust Service Criteria (TSC).

**Best for**: SaaS companies, cloud service providers, hosting companies

**Audit Types**:
- **Type I**: Point-in-time assessment of control design
- **Type II**: 3-12 month assessment of control operating effectiveness (required for most customers)

### Trust Service Criteria

```
1. Security (Common Criteria - Required for all SOC 2 audits)
   ├─ Access controls (logical and physical)
   ├─ System operations and change management
   ├─ Risk mitigation
   └─ Network and data protection

2. Availability (Optional)
   ├─ System uptime and reliability
   ├─ Disaster recovery
   └─ Business continuity

3. Processing Integrity (Optional)
   ├─ Data processing accuracy and completeness
   ├─ Error detection and correction
   └─ Data validation

4. Confidentiality (Optional)
   ├─ Protection of confidential information
   ├─ Data classification
   └─ Secure disposal

5. Privacy (Optional)
   ├─ Collection, use, retention, disposal of personal information
   ├─ Privacy notices and consent
   └─ Data subject access requests
```

### SOC 2 Readiness Roadmap

**Months 6-4 Before Audit**:
```
1. Scoping
   □ Define in-scope systems and services
   □ Select Trust Service Criteria (most choose Security + Availability)
   □ Identify control boundaries
   □ Engage auditor for planning

2. Gap Assessment
   □ Review current controls against SOC 2 requirements
   □ Document control deficiencies
   □ Create remediation plan with priorities
   □ Estimate implementation timeline

3. Policy & Procedure Development
   □ Information Security Policy
   □ Access Control Policy
   □ Change Management Policy
   □ Incident Response Policy
   □ Risk Assessment Policy
   □ Vendor Management Policy
   □ Business Continuity/Disaster Recovery Plan
   □ Employee onboarding/offboarding procedures
```

**Months 4-2 Before Audit**:
```
4. Control Implementation
   □ Implement technical controls (MFA, encryption, logging)
   □ Configure security tools (SIEM, EDR, vulnerability scanner)
   □ Establish change management process
   □ Deploy monitoring and alerting
   □ Implement backup and recovery procedures
   □ Establish access review process

5. Evidence Preparation
   □ Set up evidence collection automation
   □ Create evidence repository (shared drive or GRC tool)
   □ Document control narratives
   □ Assign control owners
   □ Train team on evidence collection
```

**Months 2-0 (Audit Period)**:
```
6. Observation Period (3-12 months)
   □ Operate controls consistently
   □ Collect evidence continuously
   □ Conduct quarterly access reviews
   □ Perform vulnerability scans monthly
   □ Document security incidents and responses
   □ Track change requests and approvals
   □ Maintain audit trails

7. Audit Execution
   □ Provide evidence to auditor
   □ Schedule interviews with control owners
   □ Respond to auditor information requests
   □ Address preliminary findings
   □ Review draft report
   □ Receive final SOC 2 report
```

### SOC 2 Control Examples

**CC6.1 - Logical and Physical Access Controls**

```yaml
Control Objective:
  The entity implements logical access security software, infrastructure, and
  architectures over protected information assets to protect them from security events.

Example Controls:

1. Multi-Factor Authentication (MFA)
   - Control: MFA is required for all user access to production systems
   - Evidence: MFA enrollment report, authentication logs
   - Frequency: Quarterly review
   - Test: Auditor validates MFA enforcement by attempting login

2. Least Privilege Access
   - Control: Users are granted minimum access necessary for job function
   - Evidence: Role-based access matrix, access review certifications
   - Frequency: Quarterly access reviews
   - Test: Auditor samples 25 users and validates access is appropriate

3. Access Provisioning/Deprovisioning
   - Control: Access is granted via approval workflow and revoked within 24 hours of termination
   - Evidence: Onboarding/offboarding tickets, access modification logs
   - Frequency: For each user change
   - Test: Auditor samples 20 new hires and 20 terminations
```

**CC7.2 - System Monitoring**

```yaml
Control Objective:
  The entity monitors system components and the operation of those components
  for anomalies that are indicative of malicious acts.

Example Controls:

1. Security Information and Event Management (SIEM)
   - Control: SIEM collects and monitors security logs from all critical systems
   - Evidence: SIEM configuration, log source inventory, sample alerts
   - Frequency: Continuous monitoring
   - Test: Auditor validates SIEM is ingesting logs from all in-scope systems

2. Intrusion Detection
   - Control: IDS/IPS monitors network traffic for malicious activity
   - Evidence: IDS/IPS configuration, alert dashboard, investigation records
   - Frequency: Continuous monitoring
   - Test: Auditor reviews alert volume and response procedures

3. Log Review
   - Control: Security team reviews high-severity alerts within 24 hours
   - Evidence: SIEM investigation records, incident tickets
   - Frequency: Daily review of alerts
   - Test: Auditor samples 20 alerts and validates timely review
```

**CC8.1 - Change Management**

```yaml
Control Objective:
  The entity authorizes, designs, develops or acquires, configures, documents,
  tests, approves, and implements changes to infrastructure, data, software,
  and procedures to meet its objectives.

Example Control:

1. Production Change Approval
   - Control: All production changes require approval from change management board
   - Evidence: Change request tickets in Jira/ServiceNow with approval
   - Frequency: For each production change
   - Test: Auditor samples 25 production changes and validates approval

2. Segregation of Duties
   - Control: Developers cannot deploy to production without approval
   - Evidence: CI/CD pipeline configuration, deployment logs with approver
   - Frequency: Enforced by automation
   - Test: Auditor validates pipeline prevents unauthorized deployments

3. Change Testing
   - Control: All changes are tested in non-production environment before production
   - Evidence: Test results, staging deployment logs
   - Frequency: For each change
   - Test: Auditor samples 15 changes and validates testing occurred
```

### SOC 2 Evidence Collection

**Automated Evidence Collection**:

```python
# Example: Automated evidence collection for quarterly access review
import subprocess
import json
from datetime import datetime

def collect_access_review_evidence():
    evidence = {
        "collection_date": datetime.now().isoformat(),
        "control_id": "CC6.2",
        "control_name": "Quarterly Access Review"
    }

    # Collect list of all users with production access
    okta_users = subprocess.check_output([
        "okta", "user", "list",
        "--groups", "production-access",
        "--format", "json"
    ])
    evidence["users"] = json.loads(okta_users)

    # Collect AWS IAM users
    aws_users = subprocess.check_output([
        "aws", "iam", "list-users",
        "--output", "json"
    ])
    evidence["aws_iam_users"] = json.loads(aws_users)

    # Collect MFA enrollment status
    mfa_status = subprocess.check_output([
        "okta", "user", "list",
        "--mfa-status",
        "--format", "json"
    ])
    evidence["mfa_enrollment"] = json.loads(mfa_status)

    # Save evidence to repository
    filename = f"access_review_{datetime.now().strftime('%Y_%m_%d')}.json"
    with open(f"/evidence/access_reviews/{filename}", "w") as f:
        json.dump(evidence, indent=2, fp=f)

    print(f"Evidence collected: {filename}")
    return evidence

# Run quarterly
collect_access_review_evidence()
```

**Evidence Retention**:
- SOC 2 evidence should be retained for at least 7 years
- Organize by control and audit period
- Use version control for policies and procedures

---

## ISO/IEC 27001

### Overview

ISO/IEC 27001 is an international standard for information security management systems (ISMS). It provides a systematic approach to managing sensitive information.

**Best for**: Organizations seeking international recognition, government contractors, enterprises

**Certification Process**:
1. **Gap Assessment** (optional but recommended)
2. **Stage 1 Audit**: Documentation review
3. **Stage 2 Audit**: Implementation assessment
4. **Certification**: Valid for 3 years
5. **Surveillance Audits**: Annual audits in years 1 and 2
6. **Recertification**: Full audit in year 3

### ISMS Framework

```
┌─────────────────────────────────────────────────────────────┐
│  Plan                                                        │
│  • Establish ISMS scope                                     │
│  • Define information security policy                       │
│  • Conduct risk assessment                                  │
│  • Select controls from Annex A                            │
│  • Create Statement of Applicability (SOA)                 │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  Do                                                          │
│  • Implement controls                                       │
│  • Provide security awareness training                      │
│  • Document procedures                                      │
│  • Operate the ISMS                                        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  Check                                                       │
│  • Monitor and measure control effectiveness                │
│  • Conduct internal audits                                  │
│  • Management review                                        │
│  • Review risk assessment                                   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  Act                                                         │
│  • Implement improvements                                   │
│  • Corrective actions for nonconformities                  │
│  • Update risk treatment plan                              │
│  • Continual improvement                                    │
└─────────────────────────────────────────────────────────────┘
```

### Annex A Controls (ISO 27001:2022)

**14 Control Domains, 93 Controls**:

```
A.5 Organizational Controls (37 controls)
├─ Information security policies
├─ Roles and responsibilities
├─ Segregation of duties
├─ Management responsibilities
├─ Contact with authorities
├─ Contact with special interest groups
├─ Threat intelligence
├─ Information security in project management
├─ Inventory of information and assets
├─ Acceptable use of information and assets
├─ Return of assets
├─ Classification of information
├─ Labelling of information
├─ Information transfer
├─ Access control
├─ Identity management
├─ Authentication information
├─ Access rights
├─ Information security in supplier relationships
├─ Addressing information security in supplier agreements
├─ Managing information security in ICT supply chain
├─ Monitoring, review and change management of supplier services
├─ Information security for use of cloud services
├─ Information security incident management planning
├─ Assessment and decision on information security events
├─ Response to information security incidents
├─ Learning from information security incidents
├─ Collection of evidence
├─ Information security during disruption
├─ ICT readiness for business continuity
├─ Legal, statutory, regulatory and contractual requirements
├─ Intellectual property rights
├─ Protection of records
├─ Privacy and protection of PII
├─ Independent review of information security
├─ Compliance with policies, rules and standards
├─ Documented operating procedures

A.6 People Controls (8 controls)
├─ Screening
├─ Terms and conditions of employment
├─ Information security awareness, education and training
├─ Disciplinary process
├─ Responsibilities after termination or change of employment
├─ Confidentiality or non-disclosure agreements
├─ Remote working
└─ Information security event reporting

A.7 Physical Controls (14 controls)
├─ Physical security perimeters
├─ Physical entry
├─ Securing offices, rooms and facilities
├─ Physical security monitoring
├─ Protecting against physical and environmental threats
├─ Working in secure areas
├─ Clear desk and clear screen
├─ Equipment siting and protection
├─ Security of assets off-premises
├─ Storage media
├─ Supporting utilities
├─ Cabling security
├─ Equipment maintenance
└─ Secure disposal or reuse of equipment

A.8 Technological Controls (34 controls)
├─ User endpoint devices
├─ Privileged access rights
├─ Information access restriction
├─ Access to source code
├─ Secure authentication
├─ Capacity management
├─ Protection against malware
├─ Management of technical vulnerabilities
├─ Configuration management
├─ Information deletion
├─ Data masking
├─ Data leakage prevention
├─ Information backup
├─ Redundancy of information processing facilities
├─ Logging
├─ Monitoring activities
├─ Clock synchronization
├─ Use of privileged utility programs
├─ Installation of software on operational systems
├─ Networks security
├─ Security of network services
├─ Segregation of networks
├─ Web filtering
├─ Use of cryptography
├─ Secure development life cycle
├─ Application security requirements
├─ Secure system architecture and engineering principles
├─ Secure coding
├─ Security testing in development and acceptance
├─ Outsourced development
├─ Separation of development, test and production environments
├─ Change management
├─ Test information
└─ Protection of information systems during audit testing
```

### Statement of Applicability (SOA)

The SOA is a critical ISO 27001 document that lists all 93 Annex A controls and states whether each is applicable.

**SOA Format**:

```
Control Reference: A.8.5
Control Name: Secure authentication
Applicable: Yes
Implementation Status: Implemented
Justification:
  Multi-factor authentication is required for all users accessing corporate
  systems. MFA is enforced via Okta with TOTP or hardware tokens.
Control Owner: IT Security Manager
Evidence:
  - Okta MFA configuration
  - MFA enrollment report
  - Authentication logs
Related Risks: R-007 (Unauthorized access to systems)
```

**Example SOA Entry for Non-Applicable Control**:

```
Control Reference: A.7.4
Control Name: Physical security monitoring
Applicable: No
Implementation Status: Not applicable
Justification:
  Company operates entirely in cloud environments (AWS, Azure) with no
  physical data centers. Physical security is the responsibility of cloud
  providers (covered by their ISO 27001 certifications).
Control Owner: N/A
Evidence: N/A
Related Risks: N/A
```

### ISO 27001 Risk Assessment

**Risk Assessment Process**:

```python
# Example risk assessment framework for ISO 27001

class RiskAssessment:
    def __init__(self):
        self.assets = []
        self.threats = []
        self.vulnerabilities = []
        self.risks = []

    def assess_risk(self, asset, threat, vulnerability):
        # Calculate likelihood (1-5 scale)
        likelihood = self.calculate_likelihood(threat, vulnerability)

        # Calculate impact (1-5 scale)
        impact = self.calculate_impact(asset)

        # Risk level = Likelihood × Impact
        risk_level = likelihood * impact

        # Determine risk category
        if risk_level >= 15:
            category = "Critical"
        elif risk_level >= 10:
            category = "High"
        elif risk_level >= 5:
            category = "Medium"
        else:
            category = "Low"

        risk = {
            "asset": asset,
            "threat": threat,
            "vulnerability": vulnerability,
            "likelihood": likelihood,
            "impact": impact,
            "risk_level": risk_level,
            "category": category
        }

        self.risks.append(risk)
        return risk

    def calculate_likelihood(self, threat, vulnerability):
        # Likelihood based on threat capability and vulnerability exploitability
        threat_levels = {
            "nation-state": 5,
            "organized_crime": 4,
            "hacktivist": 3,
            "insider": 3,
            "script_kiddie": 2
        }

        vuln_levels = {
            "critical": 5,  # Easily exploitable, public exploit available
            "high": 4,
            "medium": 3,
            "low": 2,
            "minimal": 1
        }

        threat_score = threat_levels.get(threat.get("actor"), 3)
        vuln_score = vuln_levels.get(vulnerability.get("severity"), 3)

        # Average of threat capability and vulnerability exploitability
        return round((threat_score + vuln_score) / 2)

    def calculate_impact(self, asset):
        # Impact based on asset criticality and data sensitivity
        criticality = {
            "critical": 5,  # Business-critical, revenue-generating
            "high": 4,
            "medium": 3,
            "low": 2,
            "minimal": 1
        }

        data_sensitivity = {
            "highly_confidential": 5,  # PII, PHI, financial data
            "confidential": 4,
            "internal": 3,
            "public": 1
        }

        crit_score = criticality.get(asset.get("criticality"), 3)
        data_score = data_sensitivity.get(asset.get("data_classification"), 3)

        # Take maximum of criticality or data sensitivity
        return max(crit_score, data_score)

# Example usage
ra = RiskAssessment()

asset = {
    "name": "Customer Database",
    "criticality": "critical",
    "data_classification": "highly_confidential"
}

threat = {
    "name": "SQL Injection Attack",
    "actor": "organized_crime"
}

vulnerability = {
    "name": "Unvalidated user input in search function",
    "severity": "high"
}

risk = ra.assess_risk(asset, threat, vulnerability)
print(f"Risk: {risk['category']} ({risk['risk_level']})")
# Output: Risk: Critical (20)
```

---

## GDPR (General Data Protection Regulation)

### Overview

GDPR is a European Union regulation on data protection and privacy. It applies to any organization that processes personal data of EU residents, regardless of where the organization is located.

**Applicability**:
- Organizations in the EU
- Organizations offering goods/services to EU residents
- Organizations monitoring behavior of EU residents

**Penalties**: Up to €20 million or 4% of annual global turnover (whichever is higher)

### Key Principles

```
1. Lawfulness, Fairness, Transparency
   - Process data lawfully with a valid legal basis
   - Transparent about data processing activities

2. Purpose Limitation
   - Collect data for specified, explicit, legitimate purposes
   - Do not use data for incompatible purposes

3. Data Minimization
   - Collect only data that is necessary for the purpose
   - Avoid excessive data collection

4. Accuracy
   - Ensure personal data is accurate and up to date
   - Erase or rectify inaccurate data

5. Storage Limitation
   - Retain data only as long as necessary
   - Define retention periods

6. Integrity and Confidentiality
   - Protect data with appropriate security measures
   - Prevent unauthorized access and data breaches

7. Accountability
   - Demonstrate compliance with GDPR
   - Document processing activities and decisions
```

### Legal Bases for Processing

```
1. Consent
   - Freely given, specific, informed, unambiguous
   - Easy to withdraw
   - Example: Newsletter subscriptions

2. Contract
   - Processing necessary to fulfill a contract
   - Example: Customer name/address for shipping

3. Legal Obligation
   - Required by law
   - Example: Tax record retention

4. Vital Interests
   - Necessary to protect life or safety
   - Example: Medical emergency

5. Public Task
   - Performing a task in the public interest
   - Example: Government services

6. Legitimate Interests
   - Balancing test: Your interests vs. data subject's rights
   - Example: Fraud prevention
```

### Data Subject Rights

```
1. Right to be Informed
   - Provide privacy notice explaining data processing
   - Include: what data, why, how long, who has access

2. Right of Access (Subject Access Request - SAR)
   - Provide copy of personal data upon request
   - Response time: 1 month (free of charge)
   - Include: what data you hold, why you process it, who you share it with

3. Right to Rectification
   - Correct inaccurate data within 1 month
   - Notify third parties of corrections

4. Right to Erasure ("Right to be Forgotten")
   - Delete data when:
     - No longer necessary
     - Consent withdrawn
     - Object to processing
   - Exceptions: Legal obligations, legal claims

5. Right to Restrict Processing
   - Temporarily suspend processing when:
     - Accuracy is contested
     - Processing is unlawful
     - Data subject objects

6. Right to Data Portability
   - Provide data in machine-readable format (JSON, CSV)
   - Applies only to data provided by the subject (not derived data)

7. Right to Object
   - Object to processing based on legitimate interests
   - Must stop unless compelling legitimate grounds

8. Rights Related to Automated Decision Making
   - Right not to be subject to automated decisions with legal effects
   - Right to human review of automated decisions
```

### GDPR Compliance Checklist

**Data Mapping**:
```
□ Create data inventory (what personal data you collect)
□ Document data flows (where data comes from, where it goes)
□ Identify legal basis for each processing activity
□ Maintain Record of Processing Activities (ROPA)
□ Classify data by sensitivity
```

**Privacy by Design**:
```
□ Conduct Data Protection Impact Assessments (DPIA) for high-risk processing
□ Implement data minimization (collect only what's needed)
□ Pseudonymization and anonymization where possible
□ Privacy-friendly default settings
□ Embed privacy in system design
```

**Security Measures**:
```
□ Encryption of personal data (at rest and in transit)
□ Access controls (least privilege, RBAC)
□ Pseudonymization and anonymization
□ Regular security testing (penetration tests, vulnerability scans)
□ Incident response plan
□ Data breach notification procedures (72 hours to authority)
```

**Transparency**:
```
□ Privacy policy/notice published and accessible
□ Cookie consent mechanism (explicit opt-in for non-essential cookies)
□ Clear, plain language in privacy notices
□ Layered privacy notices (summary + full version)
```

**Data Subject Rights**:
```
□ Process for handling subject access requests (SAR)
□ Process for data rectification and erasure
□ Process for data portability (export functionality)
□ Mechanism to withdraw consent
□ Process for objections to processing
□ Response time: 1 month (extendable to 3 months with justification)
```

**Vendor Management**:
```
□ Data Processing Agreements (DPA) with all processors
□ DPA includes: Purpose, duration, data types, security measures, sub-processors
□ Vendor security assessments
□ List of sub-processors disclosed
□ Standard Contractual Clauses (SCC) for transfers outside EU
```

**Breach Management**:
```
□ Breach detection and logging
□ Breach assessment procedure (risk to individuals?)
□ Notification to supervisory authority within 72 hours
□ Notification to affected individuals if high risk
□ Breach documentation and lessons learned
```

### Data Protection Impact Assessment (DPIA)

**When DPIA is Required**:
- Large-scale processing of sensitive data
- Systematic monitoring (e.g., tracking, profiling)
- Automated decision-making with legal effects
- Processing of vulnerable populations (children)
- New technologies with high privacy risk

**DPIA Template**:

```markdown
## Data Protection Impact Assessment

### 1. Project Description
- **Project Name**: Customer Behavior Analytics Platform
- **Purpose**: Analyze customer purchasing patterns to provide personalized recommendations
- **Legal Basis**: Legitimate interests (improving customer experience)
- **Data Controller**: Acme Corp
- **Data Processor**: Analytics Vendor Inc.

### 2. Data Processing Description
- **Data Categories**:
  - Purchase history
  - Browsing behavior
  - Demographics (age, gender, location)
  - Device information
- **Data Subjects**: Customers (18+)
- **Volume**: 1 million customers
- **Retention**: 2 years
- **Automated Decision Making**: Yes (product recommendations)

### 3. Necessity and Proportionality
- **Why is processing necessary?**: To improve customer experience and increase sales
- **Is data minimized?**: Yes, only collect data relevant to recommendations
- **Alternatives considered?**:
  - Option 1: Manual curation (not scalable)
  - Option 2: Anonymous analytics only (less effective)

### 4. Risks to Data Subjects
| Risk | Likelihood | Severity | Risk Level |
|------|-----------|----------|-----------|
| Unauthorized access to purchase history | Medium | High | High |
| Re-identification from pseudonymized data | Low | High | Medium |
| Inaccurate recommendations affecting user experience | Medium | Low | Low |
| Data breach exposing customer data | Low | Critical | High |

### 5. Measures to Address Risks
- **Encryption**: AES-256 encryption at rest, TLS 1.3 in transit
- **Access Control**: RBAC with least privilege, MFA required
- **Pseudonymization**: Customer IDs pseudonymized, no PII in analytics database
- **Audit Logging**: All data access logged and monitored
- **Data Minimization**: Only collect necessary fields, anonymize after 2 years
- **User Control**: Opt-out available, data deletion on request

### 6. Consultation
- **DPO Review**: Approved with recommendations implemented
- **Data Subjects Consulted**: No (but opt-out available)
- **Supervisory Authority**: Not required to consult

### 7. Sign-off
- **Completed by**: Privacy Officer
- **Date**: 2025-01-15
- **Approved by**: DPO
- **Review Date**: 2026-01-15 (annual review)
```

---

## HIPAA (Health Insurance Portability and Accountability Act)

### Overview

HIPAA is a US federal law that protects the privacy and security of Protected Health Information (PHI). It applies to covered entities and business associates.

**Covered Entities**:
- Healthcare providers (hospitals, clinics, doctors)
- Health plans (insurance companies)
- Healthcare clearinghouses

**Business Associates**:
- Vendors that handle PHI on behalf of covered entities
- Examples: EHR vendors, billing companies, cloud hosting providers

**Penalties**:
- Tier 1 (Unaware): $100-$50,000 per violation
- Tier 4 (Willful neglect): $50,000+ per violation
- Maximum: $1.5 million per year per violation type

### HIPAA Rules

```
1. Privacy Rule
   - Protects privacy of PHI
   - Patient rights (access, amendment, accounting of disclosures)
   - Minimum necessary standard
   - Notice of Privacy Practices (NPP)

2. Security Rule
   - Administrative safeguards (policies, training, risk assessment)
   - Physical safeguards (facility access, workstation security)
   - Technical safeguards (access control, encryption, audit logs)

3. Breach Notification Rule
   - Notify individuals within 60 days of breach discovery
   - Notify HHS within 60 days (or immediately if >500 individuals)
   - Notify media if >500 individuals in same state/jurisdiction

4. Enforcement Rule
   - Defines penalties and investigation procedures
   - Handled by Office for Civil Rights (OCR)
```

### Protected Health Information (PHI)

**PHI Identifiers** (must be removed for de-identification):

```
Direct Identifiers:
1. Names
2. Geographic subdivisions smaller than state (except first 3 digits of ZIP if >20,000 people)
3. Dates (except year) - birth, admission, discharge, death, age >89
4. Phone numbers
5. Fax numbers
6. Email addresses
7. Social Security Numbers
8. Medical record numbers
9. Health plan beneficiary numbers
10. Account numbers
11. Certificate/license numbers
12. Vehicle identifiers (license plates, VINs)
13. Device identifiers and serial numbers
14. Web URLs
15. IP addresses
16. Biometric identifiers (fingerprints, retinal scans)
17. Full-face photos and comparable images
18. Any other unique identifying number, characteristic, or code

Exceptions (not considered PHI if no other identifiers):
- Age if ≤89 years
- First 3 digits of ZIP code (if ≥20,000 people)
- Year only (no month/day)
```

### HIPAA Security Rule Safeguards

**Administrative Safeguards**:

```
Required:
□ Security Management Process
  - Risk assessment (annual)
  - Risk management
  - Sanction policy
  - Information system activity review

□ Assigned Security Responsibility
  - Designate security official

□ Workforce Security
  - Authorization/supervision
  - Workforce clearance
  - Termination procedures

□ Information Access Management
  - Access authorization
  - Access modification

□ Security Awareness and Training
  - Security reminders
  - Protection from malware
  - Log-in monitoring
  - Password management

□ Security Incident Procedures
  - Incident response and reporting

□ Contingency Plan
  - Data backup plan
  - Disaster recovery plan
  - Emergency mode operation plan

□ Evaluation
  - Periodic technical and non-technical evaluations

Addressable:
□ Business Associate Contracts
□ Written Contract or Other Arrangement
```

**Physical Safeguards**:

```
Required:
□ Facility Access Controls
  - Contingency operations
  - Facility security plan
  - Access control and validation procedures
  - Maintenance records

□ Workstation Use
  - Policies on appropriate use

□ Workstation Security
  - Physical safeguards for workstations

□ Device and Media Controls
  - Disposal (secure deletion/destruction)
  - Media re-use (sanitization)
  - Accountability (inventory)
  - Data backup and storage
```

**Technical Safeguards**:

```
Required:
□ Access Control
  - Unique user identification
  - Emergency access procedure
  - Automatic logoff (addressable)
  - Encryption and decryption (addressable)

□ Audit Controls
  - Hardware, software, procedural mechanisms to record and examine activity

□ Integrity
  - Mechanism to corroborate that PHI has not been altered or destroyed

□ Person or Entity Authentication
  - Verify that person/entity is who they claim to be

□ Transmission Security
  - Integrity controls (addressable)
  - Encryption (addressable)
```

### HIPAA Compliance Checklist

```
Privacy Rule Compliance:
□ Designate Privacy Officer
□ Create and distribute Notice of Privacy Practices (NPP)
□ Obtain patient authorizations for uses beyond treatment/payment/operations
□ Implement minimum necessary standard
□ Business Associate Agreements (BAA) with all vendors handling PHI
□ Process for patient rights (access, amendment, accounting of disclosures)
□ Privacy training for all workforce members

Security Rule Compliance:
□ Designate Security Officer
□ Conduct annual risk assessment
□ Implement administrative safeguards (policies, training, sanctions)
□ Implement physical safeguards (facility access, workstation security, device disposal)
□ Implement technical safeguards (access control, audit logs, encryption)
□ Document all policies and procedures
□ Security awareness training for all workforce members

Breach Notification Compliance:
□ Breach detection and assessment procedures
□ Risk assessment methodology (4-factor analysis)
□ Notification templates (individual, HHS, media)
□ Breach log maintained
□ 60-day notification timeline process

Business Associate Management:
□ BAA template with required provisions
□ BAA signed with all business associates
□ Business associate risk assessments
□ Monitor business associate compliance
```

### HIPAA Risk Assessment

**Risk Assessment Process**:

```
1. Scope Determination
   - Define boundaries (locations, systems, workforce)
   - Identify where ePHI is created, received, maintained, transmitted

2. Data Collection
   - Asset inventory (hardware, software, data)
   - Network diagrams
   - Data flow diagrams
   - Current safeguards documentation

3. Threat and Vulnerability Identification
   Threats:
   - Natural disasters (fire, flood, earthquake)
   - Environmental (power failure, temperature)
   - Human (intentional: hackers, malicious insiders; unintentional: errors)
   - Technical (hardware failure, software bugs, malware)

   Vulnerabilities:
   - Unpatched systems
   - Weak passwords
   - Missing encryption
   - Lack of physical security
   - Insufficient logging

4. Current Security Measures Assessment
   - Document existing safeguards
   - Evaluate effectiveness
   - Identify gaps

5. Likelihood and Impact Determination
   Likelihood: Low (0.1) | Medium (0.5) | High (0.9)
   Impact: Low (10) | Medium (50) | High (100)

   Risk Level = Likelihood × Impact
   - Low: <10
   - Medium: 10-50
   - High: >50

6. Risk Determination
   For each threat + vulnerability + asset combination

7. Finalize Documentation
   - Risk assessment report
   - Risk register
   - Remediation plan with priorities

8. Implement Risk Management
   - Implement safeguards to reduce risk
   - Document decisions and rationale
   - Accept residual risk

9. Maintain Continuous Risk Management
   - Annual risk assessment
   - Update when significant changes occur
```

**HIPAA Risk Assessment Template**:

```
Asset: Electronic Health Records (EHR) System
Threat: Ransomware Attack
Vulnerability: Outdated server OS (Windows Server 2012)
Current Safeguards: Antivirus, firewall, network segmentation

Likelihood: High (0.9) - Widespread ransomware campaigns targeting healthcare
Impact: High (100) - Complete loss of access to patient records, treatment delays

Risk Level: 90 (High)

Recommended Action:
1. Immediate: Upgrade to Windows Server 2022 (Priority 1)
2. Short-term: Implement EDR solution (Priority 1)
3. Ongoing: Offline backups tested monthly (Priority 2)

Risk Owner: IT Director
Target Completion: 30 days
Residual Risk: Medium (after implementation of mitigations)
```

---

## PCI-DSS (Payment Card Industry Data Security Standard)

### Overview

PCI-DSS is a set of security standards for organizations that handle credit card information. Compliance is required by card brands (Visa, Mastercard, Amex, Discover).

**Merchant Levels** (based on annual Visa transaction volume):
- **Level 1**: >6 million transactions - Annual audit by QSA (Qualified Security Assessor)
- **Level 2**: 1-6 million - Annual SAQ (Self-Assessment Questionnaire) + quarterly network scan
- **Level 3**: 20,000-1 million e-commerce - Annual SAQ + quarterly scan
- **Level 4**: <20,000 e-commerce or <1 million - Annual SAQ + quarterly scan

**Fines**: $5,000-$100,000 per month for non-compliance (set by acquiring bank)

### PCI-DSS Requirements

**12 Requirements, 6 Control Objectives**:

```
Build and Maintain a Secure Network:
├─ Requirement 1: Install and maintain network security controls
│  • Firewalls at network boundaries
│  • Deny by default, allow by exception
│  • No direct routes between untrusted networks and CDE
│  • Stateful inspection
│
└─ Requirement 2: Apply secure configurations
   • Change default passwords and security parameters
   • Remove unnecessary accounts and services
   • Implement only one primary function per server
   • Enable only necessary services and protocols

Protect Account Data:
├─ Requirement 3: Protect stored account data
│  • Keep data storage to minimum necessary
│  • Do not store sensitive authentication data post-authorization (CVV, PIN, full track data)
│  • Mask PAN when displayed (max first 6 and last 4 digits)
│  • Render PAN unreadable (encryption, truncation, hashing, tokenization)
│  • Protect encryption keys
│
└─ Requirement 4: Protect cardholder data with strong cryptography during transmission
   • Use strong cryptography (TLS 1.2+) for transmission over open, public networks
   • Never send unencrypted PANs by end-user messaging technologies
   • Protect wireless transmissions

Maintain a Vulnerability Management Program:
├─ Requirement 5: Protect all systems and networks from malicious software
│  • Deploy anti-malware on all systems (especially where malware is common)
│  • Ensure anti-malware is current and actively running
│  • Periodic scans performed
│
└─ Requirement 6: Develop and maintain secure systems and software
   • Identify and address security vulnerabilities
   • Patch critical security patches within 30 days
   • Develop software securely (OWASP guidelines)
   • Prevent common coding vulnerabilities
   • Address vulnerabilities in bespoke and custom software

Implement Strong Access Control Measures:
├─ Requirement 7: Restrict access to system components and cardholder data by business need to know
│  • Limit access based on need to know
│  • Assign access based on job classification and function
│  • Default "deny-all" setting
│
├─ Requirement 8: Identify users and authenticate access to system components
│  • Assign unique ID to each person with access
│  • Multi-factor authentication for all access into CDE
│  • Strong authentication and password policies
│  • No use of shared accounts
│
└─ Requirement 9: Restrict physical access to cardholder data
   • Appropriate facility entry controls
   • Distinguish between employees and visitors
   • Physically secure all media containing cardholder data
   • Destroy media when no longer needed
   • Protect devices that capture payment card data

Regularly Monitor and Test Networks:
├─ Requirement 10: Log and monitor all access to system components and cardholder data
│  • Log all individual access to cardholder data
│  • Log all actions by individuals with administrative access
│  • Log all access to audit logs
│  • Record at minimum: user ID, type of event, date/time, success/failure, origin, identity of affected data/system
│  • Retain audit logs for at least 12 months (3 months immediately available)
│  • Review logs daily
│
└─ Requirement 11: Test security of systems and networks regularly
   • Implement wireless scanning (quarterly)
   • Run internal and external vulnerability scans (quarterly + after significant changes)
   • Perform penetration testing (annually + after significant changes)
   • Implement intrusion detection/prevention systems
   • Implement file-integrity monitoring

Maintain an Information Security Policy:
└─ Requirement 12: Support information security with organizational policies and programs
   • Establish, publish, maintain, and disseminate information security policy
   • Implement risk assessment process (at least annually)
   • Usage policies for critical technologies (remote access, wireless, removable media)
   • Assign information security responsibilities to specific individuals
   • Security awareness training for all personnel
   • Screen potential personnel prior to hire
   • Maintain incident response plan
```

### Cardholder Data Environment (CDE)

**CDE Scope**:

```
┌─────────────────────────────────────────────────────────────┐
│  Cardholder Data Environment (CDE)                          │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Systems that Store, Process, or Transmit CHD         │ │
│  │  • Payment application                                │ │
│  │  • Database with cardholder data                      │ │
│  │  • Web server handling transactions                   │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Connected Systems (can impact security of CDE)       │ │
│  │  • Firewalls protecting CDE                           │ │
│  │  • Jump servers with access to CDE                    │ │
│  │  • Systems on same network segment                    │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              ↑
                    Network Segmentation
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  Out of Scope (Segregated)                                  │
│  • Corporate website (no payment processing)                │
│  • Internal applications (no access to CDE)                 │
│  • Employee workstations (no CDE access)                    │
└─────────────────────────────────────────────────────────────┘
```

**Scope Reduction Strategies**:

1. **Tokenization**: Replace PAN with token, store tokens instead of PANs
2. **Point-to-Point Encryption (P2PE)**: Encrypt at point of interaction, decrypt at processor
3. **Network Segmentation**: Isolate CDE from other networks
4. **Third-Party Payment Processors**: Use Stripe, PayPal, Braintree (shifts PCI burden)

### PCI-DSS Compliance Example

**Example: E-commerce Implementation**:

```
Scenario: Online retailer processing credit cards

Approach: Minimize PCI scope with third-party processor

Architecture:
1. Use Stripe.js to collect payment information
   - Payment form hosted by Stripe (iframe)
   - Card data never touches your servers
   - Receive token from Stripe

2. Your server processes order with token
   - Store token (not PAN) in database
   - Use token for charges, refunds

3. PCI scope: Your JavaScript code only
   - No cardholder data stored/processed/transmitted by your servers
   - Reduced compliance burden (SAQ A instead of SAQ D)

Compliance Requirements (SAQ A):
□ Use only PCI-DSS validated third-party payment processor
□ Cardholder data never stored/processed/transmitted by merchant systems
□ HTTPS on payment pages
□ Quarterly vulnerability scans of public-facing web servers
□ Security policy and procedures
□ Vendor management
```

**Full PCI Compliance Example (Level 1 Merchant)**:

```python
# Example: Secure credit card processing (if you must handle PANs)

from cryptography.fernet import Fernet
import hashlib
import re

class PCICompliantPaymentProcessor:
    def __init__(self, encryption_key):
        self.cipher = Fernet(encryption_key)

    def validate_pan(self, pan):
        """Validate PAN using Luhn algorithm"""
        # Remove spaces and dashes
        pan = re.sub(r'[\s-]', '', pan)

        # Must be 13-19 digits
        if not re.match(r'^\d{13,19}$', pan):
            return False

        # Luhn check
        def luhn_check(card_num):
            digits = [int(d) for d in card_num]
            checksum = 0
            for i, d in enumerate(reversed(digits)):
                if i % 2 == 1:
                    d *= 2
                    if d > 9:
                        d -= 9
                checksum += d
            return checksum % 10 == 0

        return luhn_check(pan)

    def encrypt_pan(self, pan):
        """Encrypt PAN for storage (PCI Req 3.4)"""
        if not self.validate_pan(pan):
            raise ValueError("Invalid PAN")

        # Encrypt PAN
        encrypted = self.cipher.encrypt(pan.encode())
        return encrypted

    def decrypt_pan(self, encrypted_pan):
        """Decrypt PAN (only when necessary)"""
        decrypted = self.cipher.decrypt(encrypted_pan).decode()
        return decrypted

    def mask_pan(self, pan):
        """Mask PAN for display (PCI Req 3.3)"""
        # Show first 6 and last 4 digits only
        if len(pan) < 10:
            return '*' * len(pan)

        return pan[:6] + '*' * (len(pan) - 10) + pan[-4:]

    def hash_pan(self, pan):
        """Create one-way hash of PAN for lookups"""
        # Use strong hash with salt
        salt = b'your-random-salt'  # Should be unique per application
        return hashlib.pbkdf2_hmac('sha256', pan.encode(), salt, 100000)

    def log_access(self, user_id, action, result):
        """Log all access to cardholder data (PCI Req 10)"""
        import datetime
        log_entry = {
            "timestamp": datetime.datetime.utcnow().isoformat(),
            "user_id": user_id,
            "action": action,
            "result": result,
            "ip_address": self.get_client_ip()  # Implement this
        }
        # Write to tamper-proof log storage
        self.write_to_audit_log(log_entry)

# Usage
processor = PCICompliantPaymentProcessor(encryption_key=Fernet.generate_key())

# Process payment
pan = "4532015112830366"  # Test Visa card
encrypted = processor.encrypt_pan(pan)
masked = processor.mask_pan(pan)

print(f"Masked PAN: {masked}")  # Output: 453201******0366
# NEVER log or display full PAN
```

---

## Additional Compliance Frameworks

### NIST 800-53 (Federal Systems)

**Purpose**: Security controls for federal information systems and organizations

**Control Families** (20 families):
- AC: Access Control
- AT: Awareness and Training
- AU: Audit and Accountability
- CA: Assessment, Authorization, and Monitoring
- CM: Configuration Management
- CP: Contingency Planning
- IA: Identification and Authentication
- IR: Incident Response
- MA: Maintenance
- MP: Media Protection
- PE: Physical and Environmental Protection
- PL: Planning
- PM: Program Management
- PS: Personnel Security
- PT: PII Processing and Transparency
- RA: Risk Assessment
- SA: System and Services Acquisition
- SC: System and Communications Protection
- SI: System and Information Integrity
- SR: Supply Chain Risk Management

**Baselines**:
- Low Impact: 125 controls
- Moderate Impact: 325 controls
- High Impact: 421 controls

### FedRAMP (Federal Risk and Authorization Management Program)

**Purpose**: Standardized approach to security assessment, authorization, and continuous monitoring for cloud products and services used by federal agencies

**Authorization Levels**:
- **Low Impact**: LI-SaaS (SaaS only), FIPS 199 Low
- **Moderate Impact**: FIPS 199 Moderate (most common)
- **High Impact**: FIPS 199 High (highly sensitive data)

**Authorization Paths**:
1. **JAB P-ATO** (Joint Authorization Board Provisional Authority to Operate): Government-wide authorization
2. **Agency ATO**: Specific agency authorization
3. **CSP Supplied**: CSP provides package, agency reviews

### CCPA (California Consumer Privacy Act)

**Purpose**: California state law giving consumers more control over personal information collected by businesses

**Applicability**:
- Businesses with $25M+ annual revenue
- OR buy/sell personal information of 50,000+ consumers
- OR derive 50%+ revenue from selling personal information

**Consumer Rights**:
1. Right to know what personal information is collected
2. Right to know if personal information is sold or disclosed
3. Right to say no to the sale of personal information
4. Right to access personal information
5. Right to equal service and price (no discrimination for exercising rights)
6. Right to deletion

**Requirements**:
- "Do Not Sell My Personal Information" link on homepage
- Privacy policy updates
- Process for verifiable consumer requests
- 45-day response time to requests
- Reasonable security measures

---

## Multi-Framework Compliance Strategy

### Control Mapping

Map controls across frameworks to maximize efficiency:

```
Example: Multi-Factor Authentication (MFA)

SOC 2: CC6.1 - Logical and physical access controls
ISO 27001: A.9.4.2 - Secure log-on procedures
NIST CSF: PR.AC-7 - Users authenticated and managed
HIPAA: § 164.312(d) - Person or entity authentication
PCI-DSS: Req 8.3 - Secure all individual non-console administrative access and all remote access to the CDE using MFA
GDPR: Article 32 - Appropriate technical and organizational measures

Implementation:
✓ Single MFA solution (e.g., Okta) satisfies all frameworks
✓ Document control once, reference across multiple audits
✓ Collect evidence once, use for multiple compliance requirements
```

### GRC Platform for Multi-Framework Compliance

**GRC Tools**:
- Vanta (automated SOC 2, ISO 27001, HIPAA)
- Drata (similar to Vanta)
- OneTrust (privacy and governance)
- ServiceNow GRC
- Archer (RSA)

**Benefits**:
- Automated evidence collection
- Continuous compliance monitoring
- Control mapping across frameworks
- Audit trail documentation
- Policy management
- Risk assessment tracking
