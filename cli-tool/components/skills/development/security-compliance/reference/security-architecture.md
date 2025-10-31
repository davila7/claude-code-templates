# Security Architecture & Design

## Zero Trust Architecture

### Core Principles

Zero Trust is a security model based on the principle of "never trust, always verify." It assumes that threats exist both inside and outside the network.

**Foundational Tenets**:
1. **Verify explicitly** - Always authenticate and authorize based on all available data points
2. **Use least privilege access** - Limit user access with Just-In-Time and Just-Enough-Access (JIT/JEA)
3. **Assume breach** - Minimize blast radius and segment access. Verify end-to-end encryption

### Zero Trust Architecture Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Control Plane                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Identity   │  │    Device    │  │  Application │      │
│  │  Management  │  │  Management  │  │   Registry   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │    Policy    │  │   Threat     │  │   Analytics  │      │
│  │    Engine    │  │ Intelligence │  │   & Logging  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      Data Plane                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Policy      │  │  Policy      │  │  Policy      │      │
│  │  Enforcement │→ │  Enforcement │→ │  Enforcement │      │
│  │  Point (PEP) │  │  Point (PEP) │  │  Point (PEP) │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│        ↓                  ↓                  ↓               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Resource   │  │   Resource   │  │   Resource   │      │
│  │   (App/DB)   │  │   (App/DB)   │  │   (App/DB)   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### Zero Trust Access Flow

```
1. User/Device requests access to resource
   ↓
2. Policy Enforcement Point (PEP) intercepts request
   ↓
3. PEP queries Policy Engine
   ↓
4. Policy Engine evaluates:
   - Identity verification (MFA)
   - Device posture (compliant, patched, encrypted)
   - Location and network context
   - Resource sensitivity
   - Risk score (based on behavior analytics)
   ↓
5. Policy Decision Point (PDP) makes decision:
   - Allow (with session time limit)
   - Deny
   - Allow with step-up authentication
   ↓
6. Continuous verification during session
   - Monitor for anomalous behavior
   - Re-authenticate periodically
   - Revoke access if risk increases
```

### Zero Trust Implementation Roadmap

**Phase 1: Foundation (Months 1-3)**
- Implement strong identity and access management (IAM)
- Deploy multi-factor authentication (MFA) everywhere
- Create comprehensive asset inventory
- Establish baseline logging and monitoring

**Phase 2: Visibility (Months 4-6)**
- Map all data flows and dependencies
- Implement network traffic analysis
- Deploy endpoint detection and response (EDR)
- Establish user and entity behavior analytics (UEBA)

**Phase 3: Segmentation (Months 7-9)**
- Implement network micro-segmentation
- Create security zones based on data sensitivity
- Apply least privilege access policies
- Implement application-layer controls

**Phase 4: Automation (Months 10-12)**
- Automate policy enforcement
- Implement SOAR for incident response
- Deploy continuous compliance monitoring
- Integrate threat intelligence feeds

**Phase 5: Optimization (Ongoing)**
- Continuous policy refinement
- Regular access reviews and certifications
- Threat hunting and proactive defense
- Measure and improve security posture

---

## Defense in Depth

### Security Layers

```
Layer 7: User Education & Awareness
         ↓ (Social engineering, phishing)
Layer 6: Physical Security
         ↓ (Access badges, surveillance, locks)
Layer 5: Perimeter Security
         ↓ (Firewall, IDS/IPS, WAF)
Layer 4: Network Security
         ↓ (Segmentation, VLANs, ACLs)
Layer 3: Endpoint Security
         ↓ (EDR, antivirus, host firewall)
Layer 2: Application Security
         ↓ (Input validation, authentication, secure coding)
Layer 1: Data Security
         ↓ (Encryption, DLP, access controls)
```

### Security Control Types by Layer

**Preventive Controls** (Stop attacks before they occur):
- Firewalls and network segmentation
- Multi-factor authentication
- Encryption at rest and in transit
- Secure coding practices
- Access control lists (ACLs)
- Security awareness training

**Detective Controls** (Identify attacks when they occur):
- Security Information and Event Management (SIEM)
- Intrusion Detection Systems (IDS)
- Log monitoring and analysis
- File integrity monitoring (FIM)
- Vulnerability scanning
- User and Entity Behavior Analytics (UEBA)

**Corrective Controls** (Fix issues after detection):
- Incident response procedures
- Patch management
- Malware removal
- Account lockout and password reset
- Backup and recovery
- Forensic analysis

**Deterrent Controls** (Discourage attackers):
- Warning banners
- Security policies and consequences
- Legal agreements and NDAs
- Audit trails and accountability

---

## Secure Network Architecture

### Network Segmentation Design

```
Internet
   ↓
┌─────────────────────────────────────────────────────────────┐
│  DMZ (Demilitarized Zone)                                   │
│  - Web servers (public-facing)                              │
│  - Reverse proxies                                          │
│  - Email gateways                                           │
│  Security: WAF, DDoS protection, IDS                        │
└─────────────────────────────────────────────────────────────┘
   ↓ (Firewall)
┌─────────────────────────────────────────────────────────────┐
│  Application Tier                                           │
│  - Application servers                                      │
│  - API gateways                                             │
│  - Microservices                                            │
│  Security: Application firewall, API security               │
└─────────────────────────────────────────────────────────────┘
   ↓ (Firewall)
┌─────────────────────────────────────────────────────────────┐
│  Data Tier                                                  │
│  - Database servers                                         │
│  - Data warehouses                                          │
│  - File storage                                             │
│  Security: Database firewall, encryption, DLP               │
└─────────────────────────────────────────────────────────────┘
   ↓ (Firewall)
┌─────────────────────────────────────────────────────────────┐
│  Management Network (Separate VLAN)                         │
│  - Jump servers/bastion hosts                              │
│  - Monitoring systems                                       │
│  - Backup infrastructure                                    │
│  Security: PAM, MFA, session recording                      │
└─────────────────────────────────────────────────────────────┘
```

### Micro-segmentation Strategy

Traditional segmentation creates large security zones. Micro-segmentation creates granular controls around individual workloads.

**Benefits**:
- Limits lateral movement
- Reduces blast radius of breaches
- Enables Zero Trust networking
- Improves compliance (isolate regulated data)

**Implementation Approaches**:

1. **Network-based** (VLANs, ACLs, firewalls)
   - Pros: Mature technology, hardware-based
   - Cons: Static, difficult to manage at scale

2. **Software-Defined** (SDN, NSX, Cisco ACI)
   - Pros: Dynamic, policy-based, scales well
   - Cons: Requires new infrastructure, complexity

3. **Host-based** (iptables, Windows Firewall, Security Groups)
   - Pros: Granular, follows workloads, cloud-native
   - Cons: Requires agent management

**Micro-segmentation Policy Example**:

```yaml
# Allow web tier to communicate with app tier only on port 443
source:
  tier: web
  environment: production
destination:
  tier: app
  environment: production
protocol: tcp
port: 443
action: allow

# Deny all other traffic from web tier to app tier
source:
  tier: web
destination:
  tier: app
action: deny
```

### Secure Remote Access Architecture

```
Remote Users
   ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 1: Identity Verification                              │
│  - MFA (TOTP, push, biometric)                             │
│  - Device posture check (patch level, encryption)          │
│  - Conditional access policies (location, risk score)      │
└─────────────────────────────────────────────────────────────┘
   ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 2: Secure Connection                                  │
│  Options:                                                    │
│  A) VPN (IPsec, SSL VPN) - Network-level access            │
│  B) ZTNA (Zero Trust Network Access) - Application access  │
│  C) Privileged Access Workstation (PAW) for admins         │
└─────────────────────────────────────────────────────────────┘
   ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 3: Access Broker                                      │
│  - Evaluate access policies                                 │
│  - Grant least privilege access                            │
│  - Establish session with time limit                       │
│  - Monitor session for anomalies                           │
└─────────────────────────────────────────────────────────────┘
   ↓
Corporate Resources (Applications, Files, Databases)
```

**VPN vs. ZTNA Comparison**:

| Aspect | VPN | ZTNA |
|--------|-----|------|
| Access model | Network-level | Application-level |
| Trust model | Implicit trust once connected | Continuous verification |
| Lateral movement | Possible | Prevented |
| Deployment | On-premises appliance | Cloud-native service |
| User experience | Full network access | Seamless app access |
| Security | Perimeter-based | Identity-based |

---

## Cloud Security Architecture

### Multi-Cloud Security Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Centralized Security Management                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   SIEM   │  │   CSPM   │  │   CASB   │  │   PAM    │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────┬──────────────────┬──────────────────────┐
│   AWS            │   Azure          │   GCP                │
├──────────────────┼──────────────────┼──────────────────────┤
│ • Security Hub   │ • Defender       │ • Security Command   │
│ • GuardDuty      │ • Sentinel       │   Center             │
│ • IAM            │ • Entra ID       │ • Cloud IAM          │
│ • KMS            │ • Key Vault      │ • Cloud KMS          │
│ • WAF            │ • WAF            │ • Cloud Armor        │
│ • VPC Flow Logs  │ • NSG Flow Logs  │ • VPC Flow Logs      │
└──────────────────┴──────────────────┴──────────────────────┘
```

### Shared Responsibility Model

**Cloud Provider Responsibilities** (Security OF the cloud):
- Physical security of data centers
- Hardware and infrastructure
- Network infrastructure
- Hypervisor and virtualization layer
- Managed service security (e.g., RDS, DynamoDB)

**Customer Responsibilities** (Security IN the cloud):
- Data encryption and classification
- Identity and access management (IAM)
- Application security and patching
- Network configuration and firewalls
- Operating system security (for IaaS)
- Compliance and governance

**Shared Responsibilities** (varies by service model):
- IaaS (e.g., EC2): Customer manages OS and above
- PaaS (e.g., App Service): Customer manages application and data
- SaaS (e.g., Office 365): Customer manages data and access policies

### Cloud Security Best Practices

**Identity & Access Management**:
```bash
# Enforce MFA for all users
aws iam create-virtual-mfa-device --virtual-mfa-device-name root-mfa

# Use least privilege IAM policies
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "s3:GetObject",
      "s3:PutObject"
    ],
    "Resource": "arn:aws:s3:::my-bucket/specific-prefix/*"
  }]
}

# Enable IAM Access Analyzer
aws accessanalyzer create-analyzer --analyzer-name my-analyzer --type ACCOUNT

# Rotate access keys regularly (max 90 days)
aws iam update-access-key --access-key-id AKIAIOSFODNN7EXAMPLE --status Inactive
```

**Data Encryption**:
```bash
# Enable S3 bucket encryption by default
aws s3api put-bucket-encryption \
  --bucket my-bucket \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "aws:kms",
        "KMSMasterKeyID": "arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012"
      },
      "BucketKeyEnabled": true
    }]
  }'

# Enable EBS encryption by default
aws ec2 enable-ebs-encryption-by-default --region us-east-1

# Enable RDS encryption at rest
aws rds create-db-instance \
  --db-instance-identifier mydb \
  --storage-encrypted \
  --kms-key-id arn:aws:kms:us-east-1:123456789012:key/12345678
```

**Network Security**:
```bash
# Create security group with minimal access
aws ec2 create-security-group \
  --group-name my-app-sg \
  --description "App tier security group" \
  --vpc-id vpc-12345678

# Only allow traffic from specific sources
aws ec2 authorize-security-group-ingress \
  --group-id sg-12345678 \
  --protocol tcp \
  --port 443 \
  --source-group sg-87654321  # Only from load balancer SG

# Enable VPC Flow Logs
aws ec2 create-flow-logs \
  --resource-type VPC \
  --resource-ids vpc-12345678 \
  --traffic-type ALL \
  --log-destination-type s3 \
  --log-destination arn:aws:s3:::my-flow-logs-bucket
```

**Monitoring & Logging**:
```bash
# Enable CloudTrail for all regions
aws cloudtrail create-trail \
  --name my-trail \
  --s3-bucket-name my-cloudtrail-bucket \
  --is-multi-region-trail

# Enable GuardDuty
aws guardduty create-detector --enable

# Enable AWS Config
aws configservice put-configuration-recorder \
  --configuration-recorder name=default,roleARN=arn:aws:iam::123456789012:role/config-role
```

### Container Security Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Build Time Security                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Base Image   │→ │ Vulnerability│→ │  Image       │      │
│  │ Scanning     │  │  Scanning    │  │  Signing     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  Tools: Trivy, Snyk, Clair, Anchore                         │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  Registry Security                                          │
│  • Private registries (ECR, ACR, GCR, Harbor)              │
│  • Image signing and verification (Cosign, Notary)        │
│  • Access control (IAM, RBAC)                              │
│  • Vulnerability scanning on push                          │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  Runtime Security                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Admission   │  │   Runtime    │  │   Network    │      │
│  │  Control     │  │  Protection  │  │   Policies   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  Tools: OPA, Falco, Sysdig, Calico                          │
└─────────────────────────────────────────────────────────────┘
```

**Kubernetes Security Best Practices**:

```yaml
# 1. Use Pod Security Standards
apiVersion: v1
kind: Namespace
metadata:
  name: production
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted

# 2. Run containers as non-root
apiVersion: v1
kind: Pod
metadata:
  name: secure-pod
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    fsGroup: 1000
  containers:
  - name: app
    image: myapp:1.0
    securityContext:
      allowPrivilegeEscalation: false
      capabilities:
        drop:
        - ALL
      readOnlyRootFilesystem: true

# 3. Use Network Policies
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: app-network-policy
spec:
  podSelector:
    matchLabels:
      app: web
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: loadbalancer
    ports:
    - protocol: TCP
      port: 8080
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: database
    ports:
    - protocol: TCP
      port: 5432

# 4. Use Resource Limits
apiVersion: v1
kind: Pod
metadata:
  name: resource-limited-pod
spec:
  containers:
  - name: app
    image: myapp:1.0
    resources:
      limits:
        cpu: "1"
        memory: "512Mi"
      requests:
        cpu: "500m"
        memory: "256Mi"

# 5. Enable audit logging
apiVersion: audit.k8s.io/v1
kind: Policy
rules:
- level: Metadata
  resources:
  - group: ""
    resources: ["secrets", "configmaps"]
- level: RequestResponse
  users: ["system:serviceaccount:kube-system:*"]
```

---

## Data Security Architecture

### Data Classification Framework

```
┌─────────────────────────────────────────────────────────────┐
│  Level 4: Highly Confidential (Top Secret)                 │
│  • National security information                            │
│  • Encryption: AES-256, encryption at rest AND in transit  │
│  • Access: Named individuals only, MFA + biometric         │
│  • Storage: Air-gapped systems, hardware encryption        │
│  • Retention: Indefinite or per legal requirements         │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│  Level 3: Confidential (Restricted)                        │
│  • PII, PHI, financial data, trade secrets                 │
│  • Encryption: AES-256, encryption at rest and in transit  │
│  • Access: Role-based, MFA required, annual certification  │
│  • Storage: Encrypted databases, secure file shares        │
│  • Retention: Per compliance requirements (7 years)        │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│  Level 2: Internal Use Only                                │
│  • Internal documents, employee data, project plans        │
│  • Encryption: TLS in transit, optional at rest            │
│  • Access: All employees, SSO authentication               │
│  • Storage: Corporate file shares, intranet                │
│  • Retention: 3-5 years                                    │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│  Level 1: Public                                            │
│  • Marketing materials, published documentation            │
│  • Encryption: Optional                                    │
│  • Access: Public                                          │
│  • Storage: Public website, public repositories            │
│  • Retention: Indefinite                                   │
└─────────────────────────────────────────────────────────────┘
```

### Encryption Architecture

**Encryption at Rest**:

```
Application Layer Encryption (ALE)
↓
Database Layer Encryption (TDE - Transparent Data Encryption)
↓
File System Encryption (dm-crypt, BitLocker, FileVault)
↓
Disk/Volume Encryption (LUKS, BitLocker)
↓
Hardware Encryption (Self-Encrypting Drives - SEDs)
```

**Encryption in Transit**:

```python
# TLS 1.3 configuration (nginx)
ssl_protocols TLSv1.3;
ssl_ciphers 'TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256';
ssl_prefer_server_ciphers on;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;

# HSTS header (force HTTPS)
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

# Certificate pinning (optional, advanced)
add_header Public-Key-Pins 'pin-sha256="base64+primary=="; pin-sha256="base64+backup=="; max-age=5184000; includeSubDomains';
```

**Key Management Architecture**:

```
┌─────────────────────────────────────────────────────────────┐
│  Key Management Service (KMS)                               │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Master Keys (Customer Master Keys - CMKs)           │  │
│  │  - Stored in Hardware Security Module (HSM)         │  │
│  │  - Never leave HSM in plaintext                     │  │
│  │  - Used to encrypt Data Encryption Keys (DEKs)      │  │
│  └──────────────────────────────────────────────────────┘  │
│                              ↓                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Data Encryption Keys (DEKs)                        │  │
│  │  - Generated per object/database/volume             │  │
│  │  - Encrypted by CMK (envelope encryption)           │  │
│  │  - Stored alongside encrypted data                  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  Encrypted Data                                             │
│  - Application databases                                    │
│  - File storage                                             │
│  - Backups                                                  │
└─────────────────────────────────────────────────────────────┘
```

**Envelope Encryption Example (AWS KMS)**:

```python
import boto3
import base64

kms_client = boto3.client('kms')

# Generate data encryption key
response = kms_client.generate_data_key(
    KeyId='arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012',
    KeySpec='AES_256'
)

# Plaintext DEK (use to encrypt data, then discard)
plaintext_dek = response['Plaintext']

# Encrypted DEK (store alongside encrypted data)
encrypted_dek = response['CiphertextBlob']

# Encrypt data with plaintext DEK
from cryptography.fernet import Fernet
cipher = Fernet(base64.urlsafe_b64encode(plaintext_dek))
encrypted_data = cipher.encrypt(b"Sensitive data")

# Store encrypted_data and encrypted_dek together
# Discard plaintext_dek from memory

# To decrypt later:
# 1. Decrypt the DEK using KMS
decrypt_response = kms_client.decrypt(CiphertextBlob=encrypted_dek)
plaintext_dek_decrypted = decrypt_response['Plaintext']

# 2. Use DEK to decrypt data
cipher = Fernet(base64.urlsafe_b64encode(plaintext_dek_decrypted))
decrypted_data = cipher.decrypt(encrypted_data)
```

### Data Loss Prevention (DLP) Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Data Discovery & Classification                            │
│  • Scan repositories for sensitive data (PII, PHI, PCI)    │
│  • Apply classification labels automatically               │
│  • Tools: Microsoft Purview, Varonis, BigID               │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  Policy Enforcement Points                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Endpoint   │  │   Network    │  │    Cloud     │      │
│  │     DLP      │  │     DLP      │  │     DLP      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  • Block file transfers with PII                           │
│  • Prevent copy/paste of sensitive data                    │
│  • Encrypt emails containing confidential data            │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  Monitoring & Alerting                                      │
│  • Log DLP policy violations                               │
│  • Alert security team for high-risk events               │
│  • User education on policy violations                     │
└─────────────────────────────────────────────────────────────┘
```

**DLP Policy Example**:

```yaml
policy:
  name: "Prevent PII Exfiltration"
  description: "Block transfer of SSNs via email or cloud storage"

  content_detection:
    - type: pattern
      pattern: '\d{3}-\d{2}-\d{4}'  # SSN pattern
      confidence: high
    - type: keyword
      keywords: ["SSN", "Social Security Number"]
      proximity: 50  # characters

  actions:
    email:
      - block_send
      - encrypt_if_internal
      - notify_sender
      - alert_security_team

    cloud_storage:
      - block_upload
      - notify_user
      - log_incident

    endpoint:
      - block_copy_to_usb
      - block_print
      - allow_with_justification

  exceptions:
    - group: "HR Department"
      action: allow_with_audit
    - application: "Payroll System"
      action: allow
```

---

## Identity & Access Management (IAM) Architecture

### Authentication Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Identity Provider (IdP)                                    │
│  • Okta, Azure AD, Auth0, Google Workspace                 │
│  • Central user directory (LDAP, AD)                       │
│  • MFA enforcement                                         │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  Authentication Protocol                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │    SAML      │  │    OAuth     │  │    OIDC      │      │
│  │     2.0      │  │     2.0      │  │ (OpenID      │      │
│  │              │  │              │  │  Connect)    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  Applications & Services                                    │
│  • SaaS applications (Service Provider in SAML)            │
│  • Internal web applications                               │
│  • APIs (OAuth 2.0 protected)                              │
│  • Infrastructure (SSH, RDP via certificates)             │
└─────────────────────────────────────────────────────────────┘
```

**Multi-Factor Authentication (MFA) Methods**:

```
Tier 1 (Most Secure):
├─ Hardware Security Keys (FIDO2/WebAuthn: YubiKey, Titan)
├─ Biometric (Face ID, Touch ID, Windows Hello)
└─ Smart Cards with PKI

Tier 2 (Secure):
├─ Authenticator Apps (TOTP: Google Authenticator, Authy)
├─ Push Notifications (Duo, Okta Verify)
└─ Mobile Device Certificates

Tier 3 (Less Secure, Avoid):
├─ SMS One-Time Passcodes (vulnerable to SIM swapping)
└─ Email Codes
```

### Authorization Models

**Role-Based Access Control (RBAC)**:

```yaml
# Example: Enterprise application RBAC
roles:
  - name: "Admin"
    permissions:
      - "users:read"
      - "users:write"
      - "users:delete"
      - "settings:write"
      - "audit_logs:read"

  - name: "Manager"
    permissions:
      - "users:read"
      - "users:write"
      - "reports:read"
      - "reports:write"

  - name: "User"
    permissions:
      - "users:read_self"
      - "reports:read"

# User assignment
users:
  - email: "admin@company.com"
    roles: ["Admin"]

  - email: "manager@company.com"
    roles: ["Manager"]

  - email: "employee@company.com"
    roles: ["User"]
```

**Attribute-Based Access Control (ABAC)**:

```json
{
  "policy": "Allow read access to medical records",
  "effect": "Allow",
  "principal": {
    "attributes": {
      "department": "Healthcare",
      "role": "Doctor",
      "clearance_level": ">=3"
    }
  },
  "resource": {
    "type": "MedicalRecord",
    "attributes": {
      "sensitivity": "High"
    }
  },
  "action": "read",
  "conditions": {
    "time_of_day": "business_hours",
    "location": "on_premises OR vpn_connected",
    "device_compliance": "compliant"
  }
}
```

**Relationship-Based Access Control (ReBAC)**:

```python
# Example: Document sharing platform
# "User can edit a document if they are the owner OR a collaborator"

relationships = {
    "document:123": {
        "owner": "user:alice",
        "collaborators": ["user:bob", "user:charlie"]
    }
}

def can_edit(user, document):
    doc_rels = relationships.get(document)
    return (
        user == doc_rels["owner"] or
        user in doc_rels["collaborators"]
    )

# Using authorization service like Ory Keto or SpiceDB
# Tuple format: <object>#<relation>@<subject>
# "document:123#owner@user:alice"
# "document:123#collaborator@user:bob"
```

### Privileged Access Management (PAM)

```
┌─────────────────────────────────────────────────────────────┐
│  Just-In-Time (JIT) Access                                  │
│  1. User requests elevated access via portal               │
│  2. Manager approves (or auto-approved if policy allows)   │
│  3. User granted access for limited time (e.g., 4 hours)   │
│  4. Access automatically revoked after time expires        │
│  5. Session is recorded for audit                          │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  Privileged Access Workstation (PAW)                        │
│  • Hardened jump server / bastion host                     │
│  • No internet access                                      │
│  • MFA required to access                                  │
│  • All sessions recorded                                   │
│  • Credential rotation after each session                  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  Target Systems                                             │
│  • Production databases                                    │
│  • Cloud admin consoles                                    │
│  • Network infrastructure                                  │
│  • Domain controllers                                      │
└─────────────────────────────────────────────────────────────┘
```

**PAM Best Practices**:

1. **Eliminate standing privileges**: Use JIT access instead of permanent admin rights
2. **Rotate credentials**: Auto-rotate privileged passwords after each session
3. **Session monitoring**: Record all privileged sessions for audit and forensics
4. **Break-glass procedures**: Emergency access when PAM is unavailable
5. **Separate admin accounts**: Never use privileged accounts for regular tasks
6. **Remove local admin rights**: Users should not have admin on their workstations

---

## Secure Software Development Lifecycle (SDLC)

See [application-security.md](./application-security.md) for detailed coverage of secure SDLC, DevSecOps, and application security practices.

---

## Security Architecture Review Checklist

### Network Architecture Review
- [ ] Network segmentation properly implemented (DMZ, app tier, data tier)
- [ ] Firewall rules follow least privilege (deny by default)
- [ ] No overly permissive security groups (0.0.0.0/0)
- [ ] VPN or ZTNA for remote access (no direct RDP/SSH from internet)
- [ ] Network traffic logging enabled (VPC Flow Logs, NSG Flow Logs)
- [ ] DDoS protection enabled for public-facing services
- [ ] WAF deployed for web applications
- [ ] IDS/IPS deployed and tuned

### Identity & Access Review
- [ ] MFA enforced for all users
- [ ] Privileged access managed (PAM solution in place)
- [ ] No shared accounts or default credentials
- [ ] Regular access reviews and certifications conducted
- [ ] Least privilege access enforced (RBAC/ABAC)
- [ ] Service accounts have minimal permissions
- [ ] SSO implemented for applications
- [ ] Password policy enforces complexity and rotation

### Data Protection Review
- [ ] Data classified and labeled
- [ ] Encryption at rest for sensitive data (AES-256)
- [ ] Encryption in transit (TLS 1.2+)
- [ ] Key management using KMS or HSM
- [ ] DLP policies enforced
- [ ] Database activity monitoring enabled
- [ ] Backups encrypted and tested regularly
- [ ] Data retention policies enforced

### Cloud Security Review
- [ ] Cloud Security Posture Management (CSPM) enabled
- [ ] Security services enabled (GuardDuty, Security Hub, Defender)
- [ ] S3 buckets not publicly accessible (unless required)
- [ ] CloudTrail/Activity Log enabled for all regions
- [ ] Automated remediation for misconfigurations
- [ ] Container images scanned for vulnerabilities
- [ ] Secrets not hardcoded in code or config
- [ ] Infrastructure as Code (IaC) security scanned

### Monitoring & Detection Review
- [ ] SIEM deployed and ingesting logs
- [ ] Critical security events generate alerts
- [ ] Log retention meets compliance requirements (typically 1 year)
- [ ] EDR deployed on all endpoints
- [ ] Network traffic monitored for anomalies
- [ ] Threat intelligence feeds integrated
- [ ] Regular threat hunting performed
- [ ] Security metrics tracked and reported

### Incident Response Review
- [ ] Incident response plan documented and tested
- [ ] Incident response team (CIRT) identified
- [ ] Playbooks created for common scenarios
- [ ] Forensic capabilities available
- [ ] Communication plan for breaches
- [ ] Regulatory notification procedures documented
- [ ] Tabletop exercises conducted annually
- [ ] Lessons learned process in place
