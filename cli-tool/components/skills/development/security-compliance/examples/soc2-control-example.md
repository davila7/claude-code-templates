# SOC 2 Control Documentation Example

## Control: CC6.1 - Logical Access Controls

### Control Objective
The entity implements logical access security software, infrastructure, and architectures over protected information assets to protect them from security events to meet the entity's objectives.

---

## Sub-Control: Multi-Factor Authentication (MFA) for Production Access

### Control ID
CC6.1-MFA-01

### Control Description
Multi-factor authentication (MFA) is required for all user access to production systems, including applications, databases, cloud infrastructure, and administrative consoles. MFA must be configured to require at least two of the following factors:
- Something you know (password)
- Something you have (hardware token, authenticator app)
- Something you are (biometric)

### Control Owner
**Primary**: IT Security Manager
**Secondary**: Cloud Infrastructure Lead

### Control Type
- [x] Preventive
- [ ] Detective
- [ ] Corrective

### Control Frequency
- [x] Continuous (system-enforced)
- [ ] Daily
- [ ] Weekly
- [ ] Monthly
- [ ] Quarterly
- [ ] Annually
- [ ] Event-driven

---

## Implementation Details

### Scope
**In-Scope Systems**:
- AWS production accounts (all regions)
- Azure production subscriptions
- Kubernetes production clusters
- Production databases (PostgreSQL, MySQL)
- CI/CD pipeline (production deployments)
- VPN access to production network
- Jump servers / bastion hosts
- SIEM and security tooling

**Out-of-Scope**:
- Development and test environments (MFA recommended but not required)
- Internal corporate applications (covered under separate control)

### MFA Solutions Implemented
1. **Okta** - Primary identity provider for SSO
   - Enforces MFA for all production application access
   - Supported factors: Okta Verify (push), Google Authenticator (TOTP), YubiKey (hardware token)

2. **AWS IAM** - Cloud infrastructure access
   - MFA required for console access
   - MFA required for CLI/API access using temporary credentials
   - Hardware MFA (YubiKey) required for root account

3. **Azure AD** - Microsoft cloud services
   - Conditional access policy enforces MFA for production resource access
   - Supported factors: Microsoft Authenticator, SMS, phone call

4. **SSH Certificates** - Linux server access
   - Short-lived SSH certificates issued after MFA authentication via Okta
   - Certificate validity: 8 hours

### Technical Implementation

#### AWS MFA Policy (Example)
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyAllExceptListedIfNoMFA",
      "Effect": "Deny",
      "NotAction": [
        "iam:CreateVirtualMFADevice",
        "iam:EnableMFADevice",
        "iam:GetUser",
        "iam:ListMFADevices",
        "iam:ListVirtualMFADevices",
        "iam:ResyncMFADevice",
        "sts:GetSessionToken"
      ],
      "Resource": "*",
      "Condition": {
        "BoolIfExists": {
          "aws:MultiFactorAuthPresent": "false"
        }
      }
    }
  ]
}
```

#### Okta Policy Configuration
- **Policy Name**: Production Access MFA
- **Users**: All employees with production access
- **Applications**: All production applications
- **MFA Requirement**: Required at every sign-on
- **Allowed Factors**: Okta Verify (push), TOTP, YubiKey
- **Factor Enrollment**: Required within 24 hours of production access grant

#### Azure Conditional Access Policy
- **Policy Name**: Require MFA for Production Resources
- **Users**: All users
- **Cloud apps**: All production Azure resources (tagged: Environment=Production)
- **Conditions**: Any location
- **Access controls**: Require MFA
- **Session**: Sign-in frequency = 8 hours

---

## Control Testing

### Test Procedures

#### Test 1: MFA Enrollment Verification
**Objective**: Verify all users with production access have MFA enrolled

**Test Steps**:
1. Export list of all users with production access from Okta
2. Query MFA enrollment status for each user
3. Verify 100% enrollment rate
4. For any users without MFA, verify access has been revoked

**Expected Evidence**:
- Okta user report showing MFA enrollment status
- Screenshot of enrollment rate: 100%

**Test Frequency**: Quarterly

---

#### Test 2: MFA Enforcement Testing
**Objective**: Verify MFA cannot be bypassed

**Test Steps**:
1. Attempt to access production AWS console without MFA
   - Expected: Access denied
2. Attempt to access production application without MFA
   - Expected: Redirect to MFA enrollment/challenge
3. Attempt to SSH to production server without MFA
   - Expected: Certificate issuance fails without MFA

**Expected Evidence**:
- Screenshots of access denial without MFA
- Log entries showing MFA enforcement

**Test Frequency**: Annually (during audit)

---

#### Test 3: Sample User Access Verification
**Objective**: Verify sample of users have appropriate MFA configured

**Test Steps**:
1. Auditor selects random sample of 25 users with production access
2. For each user, verify:
   - MFA is enrolled
   - At least 2 factors registered
   - Last MFA usage within past 30 days (for active users)
3. Document any exceptions

**Expected Evidence**:
- Okta user detail report for each sampled user
- MFA authentication logs

**Test Frequency**: Annually (during audit)

---

## Evidence Collection

### Automated Evidence
Evidence is collected automatically on the following schedule:

| Evidence Type | Frequency | Location | Retention |
|--------------|-----------|----------|-----------|
| Okta MFA Enrollment Report | Weekly | GRC Tool / Evidence Repository | 7 years |
| AWS MFA Usage Report | Weekly | S3 Bucket (compliance-evidence) | 7 years |
| Azure MFA Sign-in Logs | Daily | Azure Monitor / Log Analytics | 2 years |
| MFA Authentication Logs | Real-time | SIEM (Splunk) | 1 year |

### Evidence Collection Script
```python
#!/usr/bin/env python3
"""
Automated MFA evidence collection for SOC 2 audit
Runs weekly via cron job
"""

import requests
import json
from datetime import datetime

OKTA_API_KEY = "xxx"  # Retrieved from secrets manager
OKTA_DOMAIN = "company.okta.com"

def collect_mfa_enrollment():
    """Collect MFA enrollment status for all users"""
    headers = {
        "Authorization": f"SSWS {OKTA_API_KEY}",
        "Content-Type": "application/json"
    }

    # Get all active users
    users_url = f"https://{OKTA_DOMAIN}/api/v1/users?filter=status eq \"ACTIVE\""
    users = requests.get(users_url, headers=headers).json()

    enrollment_data = []

    for user in users:
        # Get MFA factors for each user
        factors_url = f"https://{OKTA_DOMAIN}/api/v1/users/{user['id']}/factors"
        factors = requests.get(factors_url, headers=headers).json()

        enrollment_data.append({
            "user_id": user['id'],
            "email": user['profile']['email'],
            "mfa_enrolled": len(factors) > 0,
            "factor_count": len(factors),
            "factors": [f['factorType'] for f in factors]
        })

    # Calculate enrollment rate
    total_users = len(enrollment_data)
    enrolled_users = sum(1 for u in enrollment_data if u['mfa_enrolled'])
    enrollment_rate = (enrolled_users / total_users * 100) if total_users > 0 else 0

    # Save evidence
    evidence = {
        "collection_date": datetime.now().isoformat(),
        "control_id": "CC6.1-MFA-01",
        "total_users": total_users,
        "enrolled_users": enrolled_users,
        "enrollment_rate": round(enrollment_rate, 2),
        "users": enrollment_data
    }

    filename = f"mfa_enrollment_{datetime.now().strftime('%Y%m%d')}.json"
    with open(f"/evidence/mfa/{filename}", "w") as f:
        json.dump(evidence, f, indent=2)

    print(f"Evidence collected: {filename}")
    print(f"Enrollment rate: {enrollment_rate:.2f}%")

    return evidence

if __name__ == "__main__":
    collect_mfa_enrollment()
```

---

## Exception Management

### Current Exceptions
| User | Reason | Approval | Expiration | Compensating Control |
|------|--------|----------|------------|---------------------|
| service-account@company.com | API-only account, no interactive login | CISO | 2025-12-31 | API key rotation every 90 days, IP allowlist |

### Exception Approval Process
1. User submits exception request via Jira Service Desk
2. Control owner reviews and recommends approval/denial
3. CISO approves exceptions >30 days
4. Exceptions reviewed quarterly
5. All exceptions documented in GRC tool

---

## Related Controls

| Control ID | Control Name | Relationship |
|-----------|--------------|--------------|
| CC6.1-PWD-01 | Password Complexity Requirements | Prerequisite (MFA requires strong password) |
| CC6.2-ACC-01 | Quarterly Access Reviews | Complementary (verify MFA users still need access) |
| CC7.2-LOG-01 | Authentication Logging | Detective control (logs MFA authentications) |
| CC8.1-JIT-01 | Just-in-Time Access | Related (JIT access also requires MFA) |

---

## Control Effectiveness Metrics

### KPIs
1. **MFA Enrollment Rate**: Target 100%
   - Current: 100% (500/500 users)
   - Trend: ✓ Maintained 100% for past 12 months

2. **MFA Bypass Attempts**: Target 0 successful bypasses
   - Current: 0 successful bypasses
   - Blocked attempts: 3 (all blocked by system)

3. **MFA-Related Helpdesk Tickets**: Target <5 per month
   - Current: 2 per month average
   - Trend: ↓ Decreasing (user training effective)

4. **Average Time to MFA Enrollment**: Target <24 hours after access grant
   - Current: 4.2 hours average
   - Trend: → Stable

---

## Change History

| Date | Version | Change Description | Changed By |
|------|---------|-------------------|------------|
| 2024-01-15 | 1.0 | Initial control implementation | IT Security Manager |
| 2024-06-01 | 1.1 | Added Azure AD MFA for Microsoft services | Cloud Architect |
| 2024-09-15 | 1.2 | Implemented SSH certificate-based authentication | Security Engineer |
| 2025-01-10 | 1.3 | Updated to require hardware tokens for privileged users | CISO |

---

## Audit Trail

### 2024 SOC 2 Type II Audit
- **Audit Firm**: Deloitte & Touche LLP
- **Audit Period**: January 1, 2024 - December 31, 2024
- **Test Results**: No exceptions noted
- **Auditor Comments**: "The Company has effectively implemented MFA for all production system access. Control operates effectively throughout the audit period."
- **Report Date**: February 15, 2025

### Previous Audits
| Audit Period | Audit Firm | Result | Exceptions |
|-------------|------------|--------|------------|
| 2023 (Full Year) | Deloitte | Passed | 0 |
| 2023 (Initial, 3 months) | Deloitte | Passed | 0 |

---

## Continuous Improvement

### Planned Enhancements
1. **Phishing-Resistant MFA** (Q2 2025)
   - Migrate to FIDO2/WebAuthn hardware keys for all privileged users
   - Phase out SMS/phone call factors (vulnerable to SIM swapping)

2. **Risk-Based Authentication** (Q3 2025)
   - Implement adaptive MFA based on risk signals (location, device, behavior)
   - Reduce MFA prompts for low-risk access while maintaining security

3. **Passwordless Authentication** (Q4 2025)
   - Pilot passwordless authentication using biometrics + hardware keys
   - Eliminate password-based attacks

---

## Control Sign-off

**Control Owner**: John Smith, IT Security Manager
**Date**: January 15, 2025

**Reviewed by**: Jane Doe, CISO
**Date**: January 16, 2025

**Next Review Date**: July 15, 2025 (Semi-annual review)
