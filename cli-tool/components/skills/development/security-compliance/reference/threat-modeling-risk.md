# Threat Modeling & Risk Assessment

## Threat Modeling Methodologies

### STRIDE Threat Model

STRIDE is a threat modeling framework developed by Microsoft that categorizes threats into six types.

**STRIDE Acronym**:

```
S - Spoofing Identity
    • Impersonating a user or system
    • Examples: Stolen credentials, session hijacking, phishing
    • Mitigation: Strong authentication (MFA), certificate validation

T - Tampering with Data
    • Unauthorized modification of data
    • Examples: SQL injection, man-in-the-middle attacks, config manipulation
    • Mitigation: Input validation, encryption, digital signatures, integrity checks

R - Repudiation
    • Denying an action was performed
    • Examples: User denies making a purchase, admin denies configuration change
    • Mitigation: Audit logging, digital signatures, non-repudiation mechanisms

I - Information Disclosure
    • Exposing confidential information
    • Examples: Data breaches, information leakage, insufficient encryption
    • Mitigation: Encryption, access controls, data classification, DLP

D - Denial of Service
    • Making a system unavailable
    • Examples: DDoS attacks, resource exhaustion, infinite loops
    • Mitigation: Rate limiting, load balancing, DDoS protection, capacity planning

E - Elevation of Privilege
    • Gaining unauthorized capabilities
    • Examples: Privilege escalation, exploiting vulnerabilities, bypassing access controls
    • Mitigation: Least privilege, input validation, security updates, RBAC
```

**STRIDE Threat Modeling Process**:

```
Step 1: Create Data Flow Diagram (DFD)
┌──────────┐       HTTPS        ┌──────────┐      SQL       ┌──────────┐
│   User   │ ──────────────────>│   Web    │ ────────────> │ Database │
│ (Browser)│                     │  Server  │               │  Server  │
└──────────┘                     └──────────┘               └──────────┘
                                       │
                                       │ HTTPS
                                       ▼
                                 ┌──────────┐
                                 │   Auth   │
                                 │  Service │
                                 └──────────┘

Step 2: Identify Trust Boundaries
- Between User and Web Server (internet)
- Between Web Server and Database (internal network)
- Between Web Server and Auth Service

Step 3: Apply STRIDE to Each Element

Web Server:
├─ Spoofing: Attacker impersonates web server
│  └─ Mitigation: TLS certificate, HSTS
├─ Tampering: Attacker modifies web server code
│  └─ Mitigation: File integrity monitoring, immutable infrastructure
├─ Repudiation: Admin denies making config change
│  └─ Mitigation: Audit logging of all admin actions
├─ Information Disclosure: Web server exposes sensitive data in errors
│  └─ Mitigation: Custom error pages, no stack traces in production
├─ Denial of Service: Attacker overwhelms web server
│  └─ Mitigation: Rate limiting, WAF, DDoS protection
└─ Elevation of Privilege: Attacker gains admin access to web server
   └─ Mitigation: Least privilege, patch management, hardening

Step 4: Apply STRIDE to Each Data Flow

User → Web Server (HTTPS):
├─ Spoofing: Man-in-the-middle attack
│  └─ Mitigation: TLS 1.3, certificate pinning
├─ Tampering: Attacker modifies data in transit
│  └─ Mitigation: TLS encryption
├─ Repudiation: User denies sending request
│  └─ Mitigation: Session logging with IP address
├─ Information Disclosure: Credentials leaked in transit
│  └─ Mitigation: TLS encryption, no credentials in URLs
├─ Denial of Service: Request flooding
│  └─ Mitigation: Rate limiting per IP, CAPTCHA
└─ Elevation of Privilege: Session hijacking
   └─ Mitigation: HTTPOnly/Secure cookies, session timeout

Step 5: Document Threats and Mitigations

| Threat ID | STRIDE Category | Threat Description | Risk Level | Mitigation | Status |
|-----------|----------------|-------------------|-----------|-----------|--------|
| T-001 | Spoofing | Attacker intercepts login and reuses credentials | High | Implement MFA | Implemented |
| T-002 | Tampering | SQL injection in search field | Critical | Parameterized queries, WAF | Implemented |
| T-003 | Information Disclosure | Database credentials in config file | High | Use secrets manager | Pending |
```

### PASTA Threat Model

**PASTA** (Process for Attack Simulation and Threat Analysis) is a risk-centric threat modeling framework.

**7 Stages**:

```
Stage 1: Define Business Objectives
- Identify business goals and security objectives
- Example: "Maintain customer trust by protecting payment information"

Stage 2: Define Technical Scope
- Identify software components, infrastructure, actors
- Create architecture diagrams
- Example: Web app, database, payment processor integration

Stage 3: Application Decomposition
- Create detailed data flow diagrams
- Identify trust boundaries
- Document APIs, protocols, data formats

Stage 4: Threat Analysis
- Identify threat actors (who might attack?)
- Analyze attack vectors (how might they attack?)
- Use threat intelligence feeds
- Example threat actors: Cybercriminals seeking payment data, competitors, malicious insiders

Stage 5: Vulnerability and Weakness Analysis
- Review known vulnerabilities (CVEs)
- Code review findings
- Penetration test results
- Example: OWASP Top 10 vulnerabilities

Stage 6: Attack Modeling
- Create attack trees showing how attacks could succeed
- Simulate attack paths
- Assess likelihood and impact

Example Attack Tree:
Compromise Payment Data
├─ AND: Exploit SQL Injection
│  ├─ Find vulnerable input field
│  └─ Bypass WAF
└─ OR: Social Engineering
   ├─ Phish developer for credentials
   └─ Insider threat

Stage 7: Risk and Impact Analysis
- Calculate risk scores
- Prioritize threats
- Recommend countermeasures
- Create remediation roadmap
```

### Attack Trees

Attack trees visually represent the ways a security goal can be compromised.

**Example: Steal Customer Data**

```
                    [Steal Customer Data]
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
   [Network Attack]    [Application]      [Physical Access]
        │              Vulnerability            │
        │                   │                   │
    ┌───┴───┐           ┌───┴───┐          ┌───┴───┐
    │       │           │       │          │       │
 [MITM] [Sniff]    [SQLi]  [XSS]    [Steal]  [Dumpster]
                                     [Laptop]  [Diving]

AND node: Both children must succeed
OR node: Any child can succeed (default)

Leaf nodes:
- MITM (Man-in-the-Middle): Likelihood: Low, Cost: Medium
- SQLi (SQL Injection): Likelihood: Medium, Cost: Low
- XSS (Cross-Site Scripting): Likelihood: High, Cost: Low
- Steal Laptop: Likelihood: Medium, Cost: Low
- Dumpster Diving: Likelihood: Low, Cost: Very Low
```

**Attack Tree Analysis**:

```python
class AttackTreeNode:
    def __init__(self, name, likelihood=0, cost=0, impact=0, node_type="OR"):
        self.name = name
        self.likelihood = likelihood  # 0-1 scale
        self.cost = cost  # Attacker cost (low, medium, high)
        self.impact = impact  # Defender impact if successful (1-10 scale)
        self.node_type = node_type  # AND or OR
        self.children = []

    def add_child(self, child):
        self.children.append(child)

    def calculate_likelihood(self):
        """Calculate likelihood of attack path success"""
        if not self.children:
            return self.likelihood

        if self.node_type == "OR":
            # OR node: Probability that at least one child succeeds
            # P(A OR B) = P(A) + P(B) - P(A)*P(B)
            combined = 0
            for child in self.children:
                child_likelihood = child.calculate_likelihood()
                combined = combined + child_likelihood - (combined * child_likelihood)
            return combined

        elif self.node_type == "AND":
            # AND node: Probability that all children succeed
            # P(A AND B) = P(A) * P(B)
            combined = 1.0
            for child in self.children:
                combined *= child.calculate_likelihood()
            return combined

# Example attack tree
root = AttackTreeNode("Steal Customer Data", node_type="OR")

# Network attacks
network = AttackTreeNode("Network Attack", node_type="OR")
network.add_child(AttackTreeNode("MITM", likelihood=0.1, cost="medium", impact=9))
network.add_child(AttackTreeNode("Packet Sniffing", likelihood=0.05, cost="low", impact=9))

# Application vulnerabilities
app = AttackTreeNode("Exploit Application", node_type="OR")
app.add_child(AttackTreeNode("SQL Injection", likelihood=0.3, cost="low", impact=10))
app.add_child(AttackTreeNode("XSS", likelihood=0.4, cost="low", impact=6))

# Physical access
physical = AttackTreeNode("Physical Access", node_type="AND")
physical.add_child(AttackTreeNode("Bypass Physical Security", likelihood=0.2, cost="medium", impact=10))
physical.add_child(AttackTreeNode("Access Database Server", likelihood=0.5, cost="low", impact=10))

root.add_child(network)
root.add_child(app)
root.add_child(physical)

overall_likelihood = root.calculate_likelihood()
print(f"Overall likelihood of successful attack: {overall_likelihood:.2%}")
# Output: Overall likelihood of successful attack: 60.94%
```

---

## Risk Assessment Frameworks

### Quantitative Risk Assessment

**Single Loss Expectancy (SLE)**:
```
SLE = Asset Value × Exposure Factor

Example:
- Asset: Customer database
- Asset Value: $5,000,000
- Exposure Factor: 0.8 (80% of value lost in a breach)
- SLE = $5,000,000 × 0.8 = $4,000,000
```

**Annualized Rate of Occurrence (ARO)**:
```
ARO = Expected number of times threat will occur per year

Example:
- Threat: Data breach
- Historical data: 1 breach every 5 years
- ARO = 1/5 = 0.2
```

**Annualized Loss Expectancy (ALE)**:
```
ALE = SLE × ARO

Example:
- SLE = $4,000,000
- ARO = 0.2
- ALE = $4,000,000 × 0.2 = $800,000

Interpretation: Expected to lose $800,000 per year from this risk
```

**Cost-Benefit Analysis**:
```
Cost-Benefit = ALE (before) - ALE (after) - Cost of Control

Example:
- ALE before control: $800,000
- ALE after implementing DLP and encryption: $100,000 (reduced likelihood to 0.025)
- Annual cost of controls: $150,000

Cost-Benefit = $800,000 - $100,000 - $150,000 = $550,000

Positive value → Control is cost-effective
Negative value → Control costs more than risk reduction
```

**Quantitative Risk Assessment Example**:

```python
class QuantitativeRiskAssessment:
    def __init__(self, asset_value, exposure_factor, aro):
        self.asset_value = asset_value
        self.exposure_factor = exposure_factor  # 0-1
        self.aro = aro  # Annual Rate of Occurrence

    def calculate_sle(self):
        """Single Loss Expectancy"""
        return self.asset_value * self.exposure_factor

    def calculate_ale(self):
        """Annualized Loss Expectancy"""
        return self.calculate_sle() * self.aro

    def cost_benefit_analysis(self, control_cost, new_aro):
        """Determine if control is cost-effective"""
        ale_before = self.calculate_ale()
        ale_after = self.calculate_sle() * new_aro
        annual_savings = ale_before - ale_after
        net_benefit = annual_savings - control_cost

        return {
            "ale_before": ale_before,
            "ale_after": ale_after,
            "annual_savings": annual_savings,
            "control_cost": control_cost,
            "net_benefit": net_benefit,
            "roi_percent": (net_benefit / control_cost * 100) if control_cost > 0 else 0,
            "recommendation": "Implement" if net_benefit > 0 else "Do not implement"
        }

# Example: Assess risk of ransomware attack
ra = QuantitativeRiskAssessment(
    asset_value=10_000_000,  # Value of systems + downtime cost
    exposure_factor=0.6,     # 60% impact (some data recoverable from backups)
    aro=0.15                 # 15% chance per year (once every 6-7 years)
)

print(f"SLE: ${ra.calculate_sle():,.0f}")
print(f"ALE: ${ra.calculate_ale():,.0f}")

# Evaluate EDR solution that reduces ARO from 0.15 to 0.02
result = ra.cost_benefit_analysis(
    control_cost=200_000,    # Annual cost of EDR
    new_aro=0.02            # Reduced to 2% chance per year
)

print(f"\nControl Cost-Benefit Analysis:")
print(f"ALE Before: ${result['ale_before']:,.0f}")
print(f"ALE After: ${result['ale_after']:,.0f}")
print(f"Annual Savings: ${result['annual_savings']:,.0f}")
print(f"Net Benefit: ${result['net_benefit']:,.0f}")
print(f"ROI: {result['roi_percent']:.1f}%")
print(f"Recommendation: {result['recommendation']}")

# Output:
# SLE: $6,000,000
# ALE: $900,000
#
# Control Cost-Benefit Analysis:
# ALE Before: $900,000
# ALE After: $120,000
# Annual Savings: $780,000
# Net Benefit: $580,000
# ROI: 290.0%
# Recommendation: Implement
```

### Qualitative Risk Assessment

**Risk Matrix (Likelihood × Impact)**:

```
Impact →
       │  1-Minimal │  2-Minor  │ 3-Moderate│  4-Major  │5-Catastrophic│
L      │           │           │           │           │              │
i    1 │   Low     │   Low     │   Low     │  Medium   │   Medium     │
k      │           │           │           │           │              │
e    2 │   Low     │   Low     │  Medium   │   High    │    High      │
l      │           │           │           │           │              │
i    3 │   Low     │  Medium   │  Medium   │   High    │   Critical   │
h      │           │           │           │           │              │
o    4 │  Medium   │   High    │   High    │  Critical │   Critical   │
o      │           │           │           │           │              │
d    5 │  Medium   │   High    │  Critical │  Critical │   Critical   │
↓      │           │           │           │           │              │

Risk Levels:
- Low: Accept risk, monitor
- Medium: Mitigate within 90 days
- High: Mitigate within 30 days
- Critical: Immediate mitigation required
```

**Likelihood Scale**:

```
5 - Almost Certain (>75% probability in next 12 months)
    • Known active exploits
    • High attacker motivation
    • Easy to exploit

4 - Likely (50-75% probability)
    • Exploits available
    • Moderate attacker motivation
    • Moderate exploit difficulty

3 - Possible (25-50% probability)
    • Some exploits available
    • Some attacker motivation
    • Some technical barriers

2 - Unlikely (5-25% probability)
    • No known exploits
    • Low attacker motivation
    • Significant technical barriers

1 - Rare (<5% probability)
    • Theoretical only
    • No attacker motivation
    • Extremely difficult to exploit
```

**Impact Scale**:

```
5 - Catastrophic
    • >$10M financial loss
    • Complete business disruption >1 week
    • Massive data breach (>1M records)
    • Permanent reputation damage
    • Regulatory penalties >$1M
    • Potential legal/criminal liability

4 - Major
    • $1M-$10M financial loss
    • Significant business disruption (3-7 days)
    • Large data breach (100K-1M records)
    • Severe reputation damage
    • Regulatory penalties $100K-$1M

3 - Moderate
    • $100K-$1M financial loss
    • Moderate business disruption (1-3 days)
    • Medium data breach (1K-100K records)
    • Moderate reputation damage
    • Regulatory penalties $10K-$100K

2 - Minor
    • $10K-$100K financial loss
    • Minor business disruption (<1 day)
    • Small data breach (<1K records)
    • Limited reputation damage
    • Regulatory penalties <$10K

1 - Minimal
    • <$10K financial loss
    • Negligible business disruption
    • No data breach
    • No reputation damage
    • No regulatory impact
```

**Qualitative Risk Assessment Example**:

```python
class QualitativeRiskAssessment:
    def __init__(self):
        self.risk_matrix = {
            (1, 1): "Low", (1, 2): "Low", (1, 3): "Low", (1, 4): "Medium", (1, 5): "Medium",
            (2, 1): "Low", (2, 2): "Low", (2, 3): "Medium", (2, 4): "High", (2, 5): "High",
            (3, 1): "Low", (3, 2): "Medium", (3, 3): "Medium", (3, 4): "High", (3, 5): "Critical",
            (4, 1): "Medium", (4, 2): "High", (4, 3): "High", (4, 4): "Critical", (4, 5): "Critical",
            (5, 1): "Medium", (5, 2): "High", (5, 3): "Critical", (5, 4): "Critical", (5, 5): "Critical"
        }

    def assess_risk(self, likelihood, impact):
        """
        likelihood: 1-5 (Rare to Almost Certain)
        impact: 1-5 (Minimal to Catastrophic)
        """
        risk_level = self.risk_matrix.get((likelihood, impact), "Unknown")

        risk_score = likelihood * impact

        if risk_level == "Critical":
            action = "Immediate mitigation required"
            timeline = "24-48 hours"
        elif risk_level == "High":
            action = "Mitigate within 30 days"
            timeline = "30 days"
        elif risk_level == "Medium":
            action = "Mitigate within 90 days"
            timeline = "90 days"
        else:  # Low
            action = "Accept risk, monitor"
            timeline = "Ongoing monitoring"

        return {
            "likelihood": likelihood,
            "impact": impact,
            "risk_score": risk_score,
            "risk_level": risk_level,
            "action": action,
            "timeline": timeline
        }

# Example assessments
qra = QualitativeRiskAssessment()

# Scenario 1: Unpatched critical vulnerability in public-facing web server
risk1 = qra.assess_risk(likelihood=5, impact=4)
print("Risk 1: Unpatched critical vulnerability")
print(f"  Risk Level: {risk1['risk_level']}")
print(f"  Action: {risk1['action']}")
print(f"  Timeline: {risk1['timeline']}\n")

# Scenario 2: Phishing attack targeting employees
risk2 = qra.assess_risk(likelihood=4, impact=3)
print("Risk 2: Phishing attack")
print(f"  Risk Level: {risk2['risk_level']}")
print(f"  Action: {risk2['action']}")
print(f"  Timeline: {risk2['timeline']}\n")

# Scenario 3: Laptop theft with encrypted data
risk3 = qra.assess_risk(likelihood=2, impact=2)
print("Risk 3: Laptop theft (encrypted)")
print(f"  Risk Level: {risk3['risk_level']}")
print(f"  Action: {risk3['action']}")
print(f"  Timeline: {risk3['timeline']}")
```

---

## Threat Intelligence

### Threat Intelligence Sources

**Open Source Threat Intelligence (OSINT)**:

```
Free Sources:
├─ MITRE ATT&CK Framework (https://attack.mitre.org)
│  • Tactics, techniques, and procedures (TTPs) of threat actors
│  • 14 tactics, 200+ techniques
│  • Platform-specific matrices (Enterprise, Mobile, ICS)
│
├─ CVE/NVD (https://nvd.nist.gov)
│  • Common Vulnerabilities and Exposures
│  • CVSS scores and descriptions
│  • Exploit availability
│
├─ AlienVault OTX (https://otx.alienvault.com)
│  • Community-driven threat intelligence
│  • Indicators of Compromise (IOCs)
│  • Threat pulses and reports
│
├─ Abuse.ch (https://abuse.ch)
│  • Malware samples and IOCs
│  • Feodo Tracker (banking trojans)
│  • URLhaus (malicious URLs)
│  • ThreatFox (IOC database)
│
├─ CISA Alerts (https://www.cisa.gov/news-events/cybersecurity-advisories)
│  • US government cybersecurity advisories
│  • Critical vulnerabilities and exploits
│  • Recommended mitigations
│
└─ VirusTotal (https://www.virustotal.com)
   • File and URL scanning
   • Community comments and IOCs
   • Behavioral analysis

Commercial Sources:
├─ Recorded Future
├─ Mandiant Threat Intelligence
├─ CrowdStrike Falcon Intelligence
├─ FireEye iSIGHT
├─ Anomali ThreatStream
└─ ThreatQuotient
```

### MITRE ATT&CK Framework

**14 Tactics** (Why - the adversary's tactical goal):

```
1. Reconnaissance
   - Gather information for planning
   - Examples: Active scanning, phishing for info, OSINT

2. Resource Development
   - Establish resources for operations
   - Examples: Acquire infrastructure, develop capabilities, compromise accounts

3. Initial Access
   - Get into the network
   - Examples: Phishing, exploit public-facing app, valid accounts

4. Execution
   - Run malicious code
   - Examples: Command/scripting, user execution, system services

5. Persistence
   - Maintain foothold
   - Examples: Boot/logon autostart, create account, scheduled tasks

6. Privilege Escalation
   - Gain higher-level permissions
   - Examples: Valid accounts, exploitation, abuse elevation control

7. Defense Evasion
   - Avoid detection
   - Examples: Disable security tools, obfuscate code, masquerading

8. Credential Access
   - Steal credentials
   - Examples: Brute force, credential dumping, keylogging

9. Discovery
   - Learn about the environment
   - Examples: System/network discovery, file/directory discovery

10. Lateral Movement
    - Move through environment
    - Examples: Remote services, remote desktop, internal spearphishing

11. Collection
    - Gather data of interest
    - Examples: Data from local system, clipboard data, screen capture

12. Command and Control (C2)
    - Communicate with compromised systems
    - Examples: Web protocols, encrypted channels, proxy

13. Exfiltration
    - Steal data
    - Examples: Exfiltration over C2, automated exfiltration, scheduled transfer

14. Impact
    - Disrupt availability or integrity
    - Examples: Data destruction, ransomware, resource hijacking
```

**Example ATT&CK Mapping**:

```yaml
attack_scenario: "Ransomware Attack"

kill_chain:
  - tactic: Initial Access
    technique: T1566.001 - Phishing: Spearphishing Attachment
    description: User opens malicious email attachment
    detection:
      - Email gateway scanning
      - User awareness training
      - Sandboxing attachments
    mitigation:
      - Email filtering (SPF, DMARC, DKIM)
      - Disable macros by default
      - User training on identifying phishing

  - tactic: Execution
    technique: T1204.002 - User Execution: Malicious File
    description: User executes malicious payload
    detection:
      - EDR behavioral analysis
      - Application whitelisting alerts
    mitigation:
      - Application whitelisting
      - Least privilege (no admin rights)
      - EDR solution

  - tactic: Persistence
    technique: T1547.001 - Boot or Logon Autostart: Registry Run Keys
    description: Malware creates registry key for persistence
    detection:
      - Monitor registry modifications
      - Sysmon Event ID 13
    mitigation:
      - Registry monitoring
      - File integrity monitoring

  - tactic: Privilege Escalation
    technique: T1068 - Exploitation for Privilege Escalation
    description: Exploit CVE-2021-34527 (PrintNightmare)
    detection:
      - Vulnerability scanning
      - EDR exploit detection
    mitigation:
      - Patch management (critical updates within 7 days)
      - Disable Print Spooler if not needed

  - tactic: Defense Evasion
    technique: T1562.001 - Impair Defenses: Disable or Modify Tools
    description: Ransomware disables antivirus
    detection:
      - Monitor security tool status
      - SIEM alert on AV service stop
    mitigation:
      - Tamper protection enabled
      - Security service monitoring

  - tactic: Credential Access
    technique: T1003.001 - OS Credential Dumping: LSASS Memory
    description: Dump credentials from memory using Mimikatz
    detection:
      - EDR detects LSASS access
      - Credential Guard
    mitigation:
      - Credential Guard
      - Protected Process Light (PPL) for LSASS
      - Restrict debug privileges

  - tactic: Discovery
    technique: T1083 - File and Directory Discovery
    description: Enumerate file shares for valuable data
    detection:
      - Monitor SMB traffic patterns
      - Unusual file access patterns
    mitigation:
      - Least privilege file share access
      - Network segmentation

  - tactic: Lateral Movement
    technique: T1021.001 - Remote Services: Remote Desktop Protocol
    description: Move to additional systems via RDP
    detection:
      - Monitor RDP connections (Event ID 4624 Type 10)
      - Unusual lateral movement patterns
    mitigation:
      - Network segmentation
      - MFA for RDP
      - Limit RDP access

  - tactic: Collection
    technique: T1005 - Data from Local System
    description: Identify valuable files for encryption
    detection:
      - File access monitoring
      - Data classification alerts
    mitigation:
      - DLP solution
      - File access auditing

  - tactic: Command and Control
    technique: T1071.001 - Application Layer Protocol: Web Protocols
    description: Communicate with C2 server over HTTPS
    detection:
      - Monitor outbound HTTPS to suspicious IPs
      - DNS monitoring for C2 domains
    mitigation:
      - Web proxy with SSL inspection
      - DNS filtering
      - Egress firewall rules

  - tactic: Impact
    technique: T1486 - Data Encrypted for Impact
    description: Encrypt files and demand ransom
    detection:
      - Rapid file modification alerts
      - Unusual encryption activity
    mitigation:
      - Offline backups tested regularly
      - File integrity monitoring
      - Honey files (canary files that trigger alerts)
      - Immutable backups
```

---

## Vulnerability Management

### Vulnerability Scoring (CVSS)

**CVSS v3.1 Metrics**:

```
Base Score Metrics (Intrinsic characteristics):

Attack Vector (AV):
├─ Network (N): 0.85 - Exploitable remotely
├─ Adjacent (A): 0.62 - Local network required
├─ Local (L): 0.55 - Local access required
└─ Physical (P): 0.20 - Physical access required

Attack Complexity (AC):
├─ Low (L): 0.77 - No specialized conditions
└─ High (H): 0.44 - Special conditions required

Privileges Required (PR):
├─ None (N): 0.85 - No privileges needed
├─ Low (L): 0.62 - Basic user privileges
└─ High (H): 0.27 - Admin privileges required

User Interaction (UI):
├─ None (N): 0.85 - No user interaction needed
└─ Required (R): 0.62 - User must perform action

Scope (S):
├─ Unchanged (U): Impact limited to vulnerable component
└─ Changed (C): Impact extends beyond vulnerable component

Impact Metrics (C/I/A):
Confidentiality (C):
├─ None (N): 0 - No information disclosure
├─ Low (L): 0.22 - Some information disclosed
└─ High (H): 0.56 - Total information disclosure

Integrity (I):
├─ None (N): 0 - No integrity impact
├─ Low (L): 0.22 - Limited modification possible
└─ High (H): 0.56 - Total compromise of integrity

Availability (A):
├─ None (N): 0 - No availability impact
├─ Low (L): 0.22 - Reduced performance
└─ High (H): 0.56 - Total loss of availability

CVSS Score Ranges:
- 0.0: None
- 0.1-3.9: Low
- 4.0-6.9: Medium
- 7.0-8.9: High
- 9.0-10.0: Critical
```

**Example CVSS Scoring**:

```
Vulnerability: CVE-2021-44228 (Log4Shell)

Attack Vector: Network (N) - Exploitable via network
Attack Complexity: Low (L) - Easy to exploit
Privileges Required: None (N) - No authentication needed
User Interaction: None (N) - No user interaction required
Scope: Changed (C) - Can affect other components
Confidentiality: High (H) - Full system access
Integrity: High (H) - Complete system compromise
Availability: High (H) - Can cause DoS

CVSS Vector: CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H
CVSS Base Score: 10.0 (Critical)

Exploitability Score: 3.9
Impact Score: 6.0
```

### Vulnerability Prioritization

**CVSS + Context-Based Prioritization**:

```python
class VulnerabilityPrioritization:
    def __init__(self):
        self.severity_weights = {
            "critical": 10,
            "high": 7,
            "medium": 4,
            "low": 1
        }

    def calculate_priority_score(self, vuln):
        """
        Calculate priority score based on CVSS + business context
        """
        # Base CVSS score (0-10)
        cvss_score = vuln.get("cvss_score", 0)

        # Exploitability factors
        exploit_available = 1.5 if vuln.get("exploit_available") else 1.0
        exploit_in_wild = 2.0 if vuln.get("exploit_in_wild") else 1.0

        # Asset criticality (1-5 scale)
        asset_criticality = vuln.get("asset_criticality", 3)

        # Exposure (1-3 scale)
        exposure_map = {
            "internet_facing": 3,
            "internal": 2,
            "isolated": 1
        }
        exposure = exposure_map.get(vuln.get("exposure", "internal"), 2)

        # Data sensitivity (1-3 scale)
        data_sensitivity_map = {
            "highly_confidential": 3,  # PII, PHI, financial
            "confidential": 2,          # Internal data
            "public": 1
        }
        data_sensitivity = data_sensitivity_map.get(vuln.get("data_sensitivity", "confidential"), 2)

        # Compensating controls (0.5-1.0 multiplier)
        has_controls = 0.5 if vuln.get("compensating_controls") else 1.0

        # Calculate weighted priority score
        priority_score = (
            cvss_score *
            exploit_available *
            exploit_in_wild *
            (asset_criticality / 3) *
            (exposure / 2) *
            (data_sensitivity / 2) *
            has_controls
        )

        # Determine priority level and SLA
        if priority_score >= 14:
            priority = "P0"
            sla_days = 1
        elif priority_score >= 10:
            priority = "P1"
            sla_days = 7
        elif priority_score >= 6:
            priority = "P2"
            sla_days = 30
        else:
            priority = "P3"
            sla_days = 90

        return {
            "priority_score": round(priority_score, 2),
            "priority_level": priority,
            "sla_days": sla_days,
            "rationale": self._generate_rationale(vuln, priority_score)
        }

    def _generate_rationale(self, vuln, priority_score):
        factors = []
        if vuln.get("cvss_score", 0) >= 9.0:
            factors.append("Critical CVSS score")
        if vuln.get("exploit_in_wild"):
            factors.append("Active exploitation in wild")
        if vuln.get("exploit_available"):
            factors.append("Public exploit available")
        if vuln.get("exposure") == "internet_facing":
            factors.append("Internet-facing system")
        if vuln.get("asset_criticality", 0) >= 4:
            factors.append("Critical business system")
        if vuln.get("data_sensitivity") == "highly_confidential":
            factors.append("Contains sensitive data")

        return "; ".join(factors) if factors else "Standard risk assessment"

# Example vulnerability assessments
vp = VulnerabilityPrioritization()

# Scenario 1: Log4Shell on internet-facing application server
vuln1 = {
    "cve": "CVE-2021-44228",
    "cvss_score": 10.0,
    "exploit_available": True,
    "exploit_in_wild": True,
    "asset_criticality": 5,
    "exposure": "internet_facing",
    "data_sensitivity": "highly_confidential",
    "compensating_controls": False
}

result1 = vp.calculate_priority_score(vuln1)
print("Vulnerability 1: Log4Shell on production web server")
print(f"  Priority Score: {result1['priority_score']}")
print(f"  Priority Level: {result1['priority_level']}")
print(f"  SLA: Patch within {result1['sla_days']} day(s)")
print(f"  Rationale: {result1['rationale']}\n")

# Scenario 2: Medium severity vuln on internal dev server with WAF protection
vuln2 = {
    "cve": "CVE-2023-12345",
    "cvss_score": 6.5,
    "exploit_available": False,
    "exploit_in_wild": False,
    "asset_criticality": 2,
    "exposure": "internal",
    "data_sensitivity": "confidential",
    "compensating_controls": True  # WAF blocking exploit
}

result2 = vp.calculate_priority_score(vuln2)
print("Vulnerability 2: Medium CVSS on internal dev server")
print(f"  Priority Score: {result2['priority_score']}")
print(f"  Priority Level: {result2['priority_level']}")
print(f"  SLA: Patch within {result2['sla_days']} days")
print(f"  Rationale: {result2['rationale']}")
```

---

## Penetration Testing

### Penetration Test Types

```
1. Black Box Testing
   - No prior knowledge of system
   - Simulates external attacker
   - Tests external defenses
   - Longest time required

2. Gray Box Testing
   - Partial knowledge (e.g., user account)
   - Simulates malicious insider or compromised account
   - Most common type
   - Balanced approach

3. White Box Testing (Clear Box)
   - Full knowledge (code, architecture, credentials)
   - Most comprehensive testing
   - Shortest time required
   - Identifies maximum vulnerabilities

4. Red Team Exercise
   - Realistic attack simulation
   - Multi-vector attacks
   - Tests detection and response
   - Blue team (defenders) may or may not be aware

5. Purple Team Exercise
   - Red team + Blue team collaboration
   - Improve detection and response
   - Knowledge sharing
   - Continuous improvement focus
```

### Penetration Testing Methodology

```
Phase 1: Planning and Reconnaissance
├─ Define scope (IP ranges, domains, out-of-scope systems)
├─ Rules of engagement (testing windows, contacts, escalation)
├─ Passive reconnaissance (OSINT, DNS, WHOIS)
└─ Active reconnaissance (port scanning, service enumeration)

Phase 2: Scanning and Enumeration
├─ Port scanning (nmap, masscan)
├─ Service version detection
├─ Vulnerability scanning (Nessus, OpenVAS)
├─ Web application scanning (Burp Suite, OWASP ZAP)
└─ Enumerate users, shares, services

Phase 3: Gaining Access (Exploitation)
├─ Exploit vulnerabilities (Metasploit, custom exploits)
├─ Password attacks (brute force, dictionary, password spraying)
├─ Social engineering (phishing, pretexting)
├─ Web application attacks (SQLi, XSS, CSRF)
└─ Wireless attacks (WPA2 cracking, rogue AP)

Phase 4: Maintaining Access
├─ Install backdoors
├─ Create persistent access mechanisms
├─ Establish command and control (C2)
└─ Privilege escalation

Phase 5: Lateral Movement
├─ Network enumeration
├─ Credential harvesting (Mimikatz, password reuse)
├─ Pivot to other systems
└─ Escalate to domain admin or crown jewels

Phase 6: Covering Tracks (Clean Up)
├─ Remove tools and artifacts
├─ Clear logs (for red team exercises only)
└─ Document all actions for client

Phase 7: Reporting
├─ Executive summary
├─ Technical findings with CVSS scores
├─ Evidence (screenshots, logs)
├─ Remediation recommendations
├─ Risk ratings
└─ Retest scope
```

### Common Penetration Testing Tools

```
Reconnaissance:
├─ nmap - Network scanner
├─ masscan - Fast port scanner
├─ theHarvester - Email/subdomain discovery
├─ Shodan - Internet-connected device search
├─ Recon-ng - Web reconnaissance framework
└─ OSINT Framework - OSINT collection

Vulnerability Scanning:
├─ Nessus - Commercial vulnerability scanner
├─ OpenVAS - Open source vulnerability scanner
├─ Nikto - Web server scanner
└─ SQLmap - SQL injection scanner

Exploitation:
├─ Metasploit Framework - Exploitation framework
├─ Exploit-DB - Exploit database
├─ Social Engineer Toolkit (SET) - Social engineering
└─ Cobalt Strike - Commercial red team platform

Web Application Testing:
├─ Burp Suite Pro - Web security testing
├─ OWASP ZAP - Web app scanner
├─ Acunetix - Web vulnerability scanner
└─ Nikto - Web server scanner

Password Attacks:
├─ John the Ripper - Password cracker
├─ Hashcat - Advanced password recovery
├─ Hydra - Network login cracker
├─ CrackMapExec - Post-exploitation tool
└─ Mimikatz - Credential extraction

Post-Exploitation:
├─ PowerShell Empire - Post-exploitation framework
├─ BloodHound - AD attack path analysis
├─ Responder - LLMNR/NBT-NS poisoning
└─ Impacket - Network protocol toolkit

Wireless:
├─ Aircrack-ng - WiFi security auditing
├─ Kismet - Wireless network detector
└─ Wifite - Automated wireless attack tool
```

---

## Security Assessment Deliverables

### Penetration Test Report Template

```markdown
# Penetration Test Report

## Executive Summary

**Client**: Acme Corporation
**Test Date**: January 15-19, 2025
**Test Type**: External and Internal Penetration Test (Gray Box)
**Scope**: Production web applications and internal network (10.0.0.0/16)
**Tester**: [Red Team Company]

### Key Findings

**Critical Risk**: 2 findings
**High Risk**: 5 findings
**Medium Risk**: 12 findings
**Low Risk**: 8 findings
**Informational**: 6 findings

### Summary

The penetration test identified several critical vulnerabilities that could allow
an attacker to gain unauthorized access to sensitive customer data. The most
critical finding is an SQL injection vulnerability in the customer portal that
allows full database access without authentication.

**Recommendations (Priority)**:
1. CRITICAL: Patch SQL injection vulnerability within 24 hours
2. CRITICAL: Disable TLS 1.0/1.1 on all systems within 7 days
3. HIGH: Implement MFA for all user accounts within 30 days
4. HIGH: Patch Log4Shell vulnerability on application servers within 7 days

## Technical Findings

### Critical Finding 1: SQL Injection in Customer Portal

**Severity**: Critical (CVSS 9.8)
**Category**: Web Application Security
**Affected System**: https://portal.acme.com/search
**CVE**: N/A (Custom application)

#### Description
The customer portal's search functionality is vulnerable to SQL injection due to
insufficient input validation. An attacker can inject arbitrary SQL commands to
extract sensitive data from the database, including customer PII and credit card
information.

#### Proof of Concept
```
Request:
GET /search?query=' UNION SELECT username,password FROM users-- HTTP/1.1
Host: portal.acme.com

Response:
[List of all usernames and hashed passwords]
```

#### Impact
- Complete database compromise
- Exfiltration of 500,000+ customer records containing PII
- Compliance violations (GDPR, PCI-DSS)
- Potential regulatory fines

#### Remediation
1. **Immediate** (within 24 hours):
   - Take search feature offline OR
   - Implement input validation to reject SQL metacharacters
   - Deploy WAF rule to block SQL injection attempts

2. **Short-term** (within 7 days):
   - Rewrite queries using parameterized statements (prepared statements)
   - Implement least privilege database accounts for application
   - Enable database query logging

3. **Long-term**:
   - Conduct secure code review of entire application
   - Implement SAST scanning in CI/CD pipeline
   - Security awareness training for developers

#### References
- OWASP SQL Injection: https://owasp.org/www-community/attacks/SQL_Injection
- CWE-89: Improper Neutralization of Special Elements used in an SQL Command

---

### High Finding 1: Outdated TLS Configuration

**Severity**: High (CVSS 7.5)
**Category**: Cryptography
**Affected Systems**: All web servers (15 systems)

#### Description
Web servers support deprecated TLS 1.0 and TLS 1.1 protocols, which have known
cryptographic weaknesses. These protocols are vulnerable to BEAST and POODLE attacks.

#### Proof of Concept
```bash
$ nmap --script ssl-enum-ciphers -p 443 portal.acme.com

PORT    STATE SERVICE
443/tcp open  https
| ssl-enum-ciphers:
|   TLSv1.0:
|     ciphers:
|       TLS_RSA_WITH_3DES_EDE_CBC_SHA (weak)
```

#### Impact
- Man-in-the-middle attacks possible
- Decryption of encrypted traffic
- Compliance violations (PCI-DSS requires TLS 1.2+)

#### Remediation
1. Disable TLS 1.0 and TLS 1.1 on all web servers
2. Enable TLS 1.2 and TLS 1.3 only
3. Configure strong cipher suites (ECDHE, AES-GCM)
4. Enable HSTS header (Strict-Transport-Security)

Example nginx configuration:
```nginx
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers 'ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
ssl_prefer_server_ciphers on;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

---

[Additional findings...]

## Appendix A: Scope and Methodology

### Scope
**In Scope**:
- External web applications (*.acme.com)
- Internal network (10.0.0.0/16)
- Wireless networks (guest and corporate)

**Out of Scope**:
- Production database servers (testing allowed, disruption prohibited)
- Third-party SaaS applications
- Physical security testing
- Social engineering attacks

### Methodology
Testing followed the OWASP Testing Guide v4 and PTES (Penetration Testing Execution Standard).

### Testing Windows
- External testing: 24/7
- Internal testing: Monday-Friday, 9 AM - 5 PM EST
- No testing on holidays

## Appendix B: Tools Used
- Nmap 7.94 - Network scanning
- Burp Suite Pro 2023.12 - Web application testing
- Metasploit Framework 6.3 - Exploitation
- SQLmap 1.8 - SQL injection testing
- Nessus 10.6 - Vulnerability scanning

## Appendix C: Risk Rating Methodology

Risk ratings use CVSS v3.1 base scores with environmental adjustments:
- Critical: 9.0-10.0
- High: 7.0-8.9
- Medium: 4.0-6.9
- Low: 0.1-3.9
```

---

## Continuous Risk Management

### Risk Register Maintenance

```yaml
risk_id: R-042
title: "Ransomware Attack on Production Infrastructure"
category: "Cybersecurity"
owner: "CISO"
status: "Open"

threat:
  actor: "Organized cybercriminal group"
  motivation: "Financial gain"
  capability: "High (commodity ransomware widely available)"

vulnerability:
  description: "Unpatched servers, no EDR, limited backup testing"
  cvss_score: 8.5

likelihood:
  qualitative: "Likely (4/5)"
  quantitative_aro: 0.3
  justification: "Healthcare sector heavily targeted, recent incidents at peers"

impact:
  qualitative: "Catastrophic (5/5)"
  quantitative_sle: "$8,000,000"
  justification: "3-5 day downtime, patient care disruption, ransom demand, recovery costs"

risk_score:
  qualitative: 20  # 4 × 5 = Critical
  quantitative_ale: "$2,400,000"  # $8M × 0.3

risk_response: "Mitigate"

controls:
  existing:
    - "Daily backups to cloud storage"
    - "Antivirus on all endpoints"
    - "Firewall segmentation"

  planned:
    - control: "Deploy EDR solution (CrowdStrike)"
      cost: "$150,000/year"
      completion_date: "2025-03-01"
      risk_reduction: "ARO from 0.3 to 0.05"

    - control: "Implement offline, immutable backups"
      cost: "$75,000 setup + $30,000/year"
      completion_date: "2025-02-15"
      risk_reduction: "SLE from $8M to $2M"

    - control: "Patch management automation"
      cost: "$50,000 setup + $20,000/year"
      completion_date: "2025-02-01"
      risk_reduction: "ARO from 0.3 to 0.1"

residual_risk:
  qualitative: "Medium (2 × 3 = 6)"
  quantitative_ale: "$100,000"  # $2M × 0.05
  acceptable: true
  justification: "ALE reduced by 95%, within risk appetite"

next_review_date: "2025-07-01"
last_updated: "2025-01-15"
```

### Risk Appetite Statement

```
Board-Approved Risk Appetite (Annual):

Financial Loss:
├─ Per incident: Maximum $1M
├─ Annual aggregate: Maximum $5M
└─ Unacceptable: >$10M single event

Data Breach:
├─ Acceptable: <1,000 records of non-sensitive data
├─ Tolerable: 1,000-10,000 records with notification
└─ Unacceptable: >10,000 records OR any PHI/PII

Downtime:
├─ Acceptable: <4 hours per month
├─ Tolerable: 4-24 hours with business continuity
└─ Unacceptable: >24 hours of critical systems

Compliance:
├─ Acceptable: Minor findings that don't impact certification
├─ Tolerable: Moderate findings with 90-day remediation
└─ Unacceptable: Major findings, loss of certification, regulatory fines

Reputation:
├─ Acceptable: Local media coverage, contained impact
├─ Tolerable: National media coverage, customer churn <5%
└─ Unacceptable: Congressional investigation, >20% customer churn
```

This risk appetite guides all risk acceptance decisions. Any risk exceeding
"tolerable" thresholds must be escalated to the Board for explicit acceptance.
