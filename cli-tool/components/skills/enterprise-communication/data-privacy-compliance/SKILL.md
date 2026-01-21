---
name: Data Privacy Compliance
description: Data privacy and regulatory compliance specialist for GDPR, CCPA, HIPAA, and international data protection laws. Use when implementing privacy controls, conducting data protection impact assessments, ensuring regulatory compliance, or managing data subject rights. Expert in consent management, data minimization, and privacy-by-design principles.
---

# Data Privacy Compliance

Comprehensive guidance for implementing data privacy compliance across GDPR, CCPA, HIPAA, and other global data protection regulations.

## When to Use This Skill

Use this skill when:
- Implementing GDPR, CCPA, or HIPAA compliance
- Conducting Data Protection Impact Assessments (DPIA)
- Managing data subject rights (access, deletion, portability)
- Implementing consent management systems
- Drafting privacy policies and notices
- Handling data breaches and incident response
- Designing privacy-by-design systems
- Conducting privacy audits and assessments

## Key Regulations Overview

### GDPR (General Data Protection Regulation)
**Scope:** EU residents' data, regardless of where company is located
**Key Requirements:**
- Lawful basis for processing (consent, contract, legitimate interest, etc.)
- Data subject rights (access, deletion, portability, objection)
- Data Protection Impact Assessments for high-risk processing
- 72-hour breach notification requirement
- Records of processing activities
- Privacy by design and by default

**Penalties:** Up to €20M or 4% of global annual revenue

### CCPA/CPRA (California Consumer Privacy Act)
**Scope:** California residents' data
**Key Requirements:**
- Right to know what data is collected
- Right to delete personal information
- Right to opt-out of sale/sharing
- Right to correct inaccurate information
- Right to limit use of sensitive personal information

**Penalties:** Up to $7,500 per intentional violation

### HIPAA (Health Insurance Portability and Accountability Act)
**Scope:** Protected Health Information (PHI) in the US
**Key Requirements:**
- Privacy Rule (patient rights and information uses)
- Security Rule (safeguards for ePHI)
- Breach Notification Rule (60-day notification)
- Business Associate Agreements (BAAs)

**Penalties:** Up to $1.5M per violation category per year

## Data Subject Rights Implementation

### 1. Right to Access (GDPR Art. 15 / CCPA § 1798.100)

**Request Handler:**
```javascript
async function handleAccessRequest(userId, email) {
  // Verify identity
  const verified = await verifyIdentity(email);
  if (!verified) throw new Error('Identity verification failed');

  // Collect all personal data
  const userData = await collectUserData(userId);

  // Format for readability
  const report = {
    personalInfo: userData.profile,
    activityLogs: userData.activities,
    preferences: userData.settings,
    thirdPartySharing: userData.dataSharing,
    retentionPeriod: '2 years from last activity',
    dataProtectionOfficer: 'dpo@company.com'
  };

  // Generate downloadable report
  const pdf = await generatePDFReport(report);

  // Log request for compliance
  await logAccessRequest(userId, 'completed');

  return pdf;
}
```

**Response Timeline:**
- GDPR: 1 month (extendable to 3 months)
- CCPA: 45 days (extendable to 90 days)

### 2. Right to Deletion (GDPR Art. 17 / CCPA § 1798.105)

**Deletion Handler:**
```javascript
async function handleDeletionRequest(userId, email) {
  // Verify identity
  const verified = await verifyIdentity(email);
  if (!verified) throw new Error('Identity verification failed');

  // Check for legal obligations to retain
  const mustRetain = await checkRetentionRequirements(userId);
  if (mustRetain.required) {
    return {
      status: 'partial_deletion',
      retained: mustRetain.data,
      reason: mustRetain.legalBasis,
      retentionPeriod: mustRetain.period
    };
  }

  // Delete from all systems
  await Promise.all([
    deleteFromDatabase(userId),
    deleteFromBackups(userId), // Mark for deletion in next backup cycle
    deleteFromAnalytics(userId),
    deleteFromThirdPartyServices(userId),
    revokeAPIKeys(userId),
    anonymizeHistoricalRecords(userId)
  ]);

  // Confirm deletion
  await sendDeletionConfirmation(email);
  await logDeletionRequest(userId, 'completed');

  return { status: 'deleted', timestamp: new Date() };
}
```

**Exceptions (when deletion can be refused):**
- Legal obligations (tax records, contracts)
- Public interest/scientific research
- Defense of legal claims
- Exercise of freedom of expression

### 3. Right to Data Portability (GDPR Art. 20)

**Export Handler:**
```javascript
async function handlePortabilityRequest(userId, format = 'json') {
  const userData = await collectUserData(userId);

  // Structure in machine-readable format
  const portableData = {
    exportDate: new Date().toISOString(),
    userId: userId,
    data: {
      profile: userData.profile,
      content: userData.userGeneratedContent,
      settings: userData.preferences,
      history: userData.activityHistory
    }
  };

  // Support multiple formats
  if (format === 'csv') {
    return convertToCSV(portableData);
  } else if (format === 'xml') {
    return convertToXML(portableData);
  }

  return portableData; // JSON by default
}
```

**Requirements:**
- Structured, commonly used, machine-readable format
- Ability to transmit directly to another controller
- Only applies to data provided by data subject
- Only for automated processing based on consent or contract

### 4. Right to Object (GDPR Art. 21)

**Objection Handler:**
```javascript
async function handleObjectionRequest(userId, processingType) {
  switch (processingType) {
    case 'direct_marketing':
      // Must stop immediately
      await disableMarketing(userId);
      await updateConsent(userId, 'marketing', false);
      break;

    case 'legitimate_interest':
      // Assess if we have compelling grounds
      const assessment = await assessLegitimateInterest(userId);
      if (!assessment.compelling) {
        await stopProcessing(userId, processingType);
      }
      return assessment;

    case 'profiling':
      await disableProfiling(userId);
      await updateConsent(userId, 'profiling', false);
      break;

    default:
      throw new Error('Invalid processing type');
  }

  await logObjectionRequest(userId, processingType, 'granted');
}
```

## Consent Management

### Consent Requirements (GDPR)

**Valid Consent Must Be:**
1. Freely given (no coercion)
2. Specific (for each purpose)
3. Informed (clear language)
4. Unambiguous (clear affirmative action)
5. Withdrawable (as easy to withdraw as to give)

**Consent Implementation:**
```html
<!-- Good: Granular consent -->
<form>
  <h3>Privacy Preferences</h3>

  <label>
    <input type="checkbox" name="essential" checked disabled>
    <strong>Essential cookies (Required)</strong>
    <p>Necessary for website functionality</p>
  </label>

  <label>
    <input type="checkbox" name="analytics" value="analytics">
    <strong>Analytics cookies</strong>
    <p>Help us improve our website by collecting usage data</p>
  </label>

  <label>
    <input type="checkbox" name="marketing" value="marketing">
    <strong>Marketing cookies</strong>
    <p>Show you personalized ads based on your interests</p>
  </label>

  <button type="submit">Save Preferences</button>
  <a href="/privacy-policy">Learn More</a>
</form>
```

**Consent Record Storage:**
```javascript
const consentRecord = {
  userId: 'user123',
  timestamp: new Date().toISOString(),
  consentVersion: '2.0',
  purposes: {
    essential: { granted: true, required: true },
    analytics: { granted: true, purpose: 'Website improvement' },
    marketing: { granted: false, purpose: 'Personalized advertising' }
  },
  ipAddress: '192.168.1.1', // For proof
  userAgent: 'Mozilla/5.0...', // For context
  method: 'explicit_opt_in' // or 'implicit', 'presumed'
};

await saveConsentRecord(consentRecord);
```

### Cookie Banner (GDPR Compliant)

```html
<div id="cookie-banner" role="dialog" aria-labelledby="cookie-title">
  <h2 id="cookie-title">Cookie Preferences</h2>
  <p>
    We use cookies to enhance your experience. Choose which cookies you
    allow us to use. You can change your preferences at any time.
  </p>

  <button onclick="acceptAll()">Accept All</button>
  <button onclick="rejectNonEssential()">Reject Non-Essential</button>
  <button onclick="showPreferences()">Manage Preferences</button>
</div>

<script>
// Must not load non-essential cookies until consent given
function acceptAll() {
  setConsent({ analytics: true, marketing: true });
  loadAnalyticsCookies();
  loadMarketingCookies();
  hideBanner();
}

function rejectNonEssential() {
  setConsent({ analytics: false, marketing: false });
  hideBanner();
}
</script>
```

## Privacy by Design Principles

### 1. Data Minimization

**Principle:** Collect only data necessary for specified purpose

**Implementation:**
```javascript
// ❌ Bad: Collecting unnecessary data
const userRegistration = {
  email: req.body.email,
  password: req.body.password,
  fullName: req.body.fullName,
  phoneNumber: req.body.phoneNumber, // Not needed
  dateOfBirth: req.body.dateOfBirth, // Not needed
  address: req.body.address, // Not needed
  socialSecurityNumber: req.body.ssn // Definitely not needed!
};

// ✅ Good: Only essential data
const userRegistration = {
  email: req.body.email,
  password: hashPassword(req.body.password),
  displayName: req.body.displayName // Optional
};
```

### 2. Purpose Limitation

**Principle:** Use data only for specified, explicit purposes

**Implementation:**
```javascript
// Document and enforce purpose
const dataProcessingPurpose = {
  email: [
    'account_authentication',
    'order_confirmations',
    'password_reset'
  ],
  phoneNumber: [
    'order_delivery_notifications'
    // NOT: 'marketing_calls' (requires separate consent)
  ],
  purchaseHistory: [
    'order_fulfillment',
    'customer_support'
    // NOT: 'targeted_advertising' (requires separate consent)
  ]
};

async function processData(data, purpose) {
  if (!isAllowedPurpose(data.type, purpose)) {
    throw new Error('Purpose not authorized for this data');
  }
  // Proceed with processing
}
```

### 3. Storage Limitation

**Principle:** Retain data only as long as necessary

**Implementation:**
```javascript
const retentionPolicy = {
  userAccounts: {
    active: 'indefinite',
    inactive: '2 years',
    deleted: '30 days grace period'
  },
  orderRecords: '7 years', // Legal requirement
  supportTickets: '3 years',
  analytics: '26 months',
  marketingData: '1 year or until consent withdrawn'
};

// Automated data deletion
async function enforceRetentionPolicy() {
  const now = new Date();

  // Delete inactive accounts
  await User.deleteMany({
    lastActive: { $lt: subYears(now, 2) },
    status: 'inactive'
  });

  // Anonymize old analytics
  await Analytics.updateMany(
    { createdAt: { $lt: subMonths(now, 26) } },
    { $unset: { userId: 1, ipAddress: 1 } }
  );

  // Delete expired marketing consent
  await MarketingConsent.deleteMany({
    $or: [
      { expiresAt: { $lt: now } },
      { withdrawnAt: { $lt: subDays(now, 30) } }
    ]
  });
}

// Schedule daily
cron.schedule('0 2 * * *', enforceRetentionPolicy);
```

## Data Protection Impact Assessment (DPIA)

**When Required (GDPR Art. 35):**
- Systematic and extensive profiling
- Large-scale processing of sensitive data
- Systematic monitoring of publicly accessible areas
- New technologies with high privacy risks

**DPIA Template:**
```markdown
# Data Protection Impact Assessment

## Processing Overview
- **Purpose**: [Describe the processing activity]
- **Data Types**: [Personal data categories]
- **Data Subjects**: [Who is affected]
- **Recipients**: [Who receives the data]

## Necessity Assessment
- [ ] Is processing necessary for the stated purpose?
- [ ] Could the purpose be achieved with less data?
- [ ] Is the retention period justified?

## Risk Assessment
| Risk | Likelihood | Severity | Mitigation |
|------|------------|----------|------------|
| Data breach | Medium | High | Encryption, access controls |
| Unauthorized access | Low | High | 2FA, audit logs |
| Purpose creep | Medium | Medium | Purpose documentation, training |

## Safeguards
- [ ] Encryption at rest and in transit
- [ ] Access controls and authentication
- [ ] Regular security audits
- [ ] Data minimization applied
- [ ] Retention policies enforced
- [ ] DPO consulted
- [ ] Data subject rights mechanism in place

## Conclusion
Processing is/is not acceptable with proposed safeguards.

Signed: [Data Protection Officer]
Date: [Assessment Date]
```

## Privacy Policy Requirements

**Essential Elements:**
```markdown
# Privacy Policy

## 1. Identity of Controller
Company Name, Address, Contact Information
Data Protection Officer: dpo@company.com

## 2. Data We Collect
- Account data: email, name
- Usage data: pages visited, features used
- Technical data: IP address, browser type

## 3. Legal Basis for Processing
- **Consent**: Marketing communications
- **Contract**: Order fulfillment
- **Legitimate Interest**: Fraud prevention
- **Legal Obligation**: Tax records

## 4. How We Use Your Data
- Provide services you requested
- Improve our products
- Send important updates
- [Be specific, avoid vague statements]

## 5. Data Sharing
- Payment processors (Stripe, PayPal)
- Shipping providers (FedEx, UPS)
- Analytics (Google Analytics)

We do NOT sell your personal data.

## 6. Your Rights
- Right to access your data
- Right to correct inaccuracies
- Right to delete your data
- Right to object to processing
- Right to data portability
- Right to withdraw consent

Contact: privacy@company.com

## 7. Data Retention
- Account data: Until account deletion + 30 days
- Order history: 7 years (legal requirement)
- Marketing data: 1 year or until opt-out

## 8. Security
We use industry-standard security measures including
encryption, secure servers, and regular security audits.

## 9. International Transfers
Data may be transferred to US servers. We use Standard
Contractual Clauses approved by the EU Commission.

## 10. Changes to Policy
Last updated: [Date]
We will notify you of material changes via email.

## 11. Contact
Questions? Contact our Data Protection Officer at dpo@company.com
```

## Incident Response

### Data Breach Response Plan

**Within 72 Hours (GDPR):**
```markdown
1. **Detect & Contain** (0-4 hours)
   - Identify scope of breach
   - Isolate affected systems
   - Prevent further data loss

2. **Assess** (4-24 hours)
   - Determine data types affected
   - Identify number of individuals
   - Assess risk to rights and freedoms
   - Document everything

3. **Notify Authority** (24-72 hours)
   - Report to supervisory authority
   - Include: nature, categories, approximate numbers,
     likely consequences, measures taken

4. **Notify Data Subjects** (ASAP if high risk)
   - Direct communication required
   - Describe breach in clear language
   - Provide recommendations for protection
```

**Breach Notification Template:**
```
Subject: Important Security Notice

Dear [Name],

We are writing to inform you of a data security incident that may
have affected your personal information.

WHAT HAPPENED:
On [date], we discovered that [brief description].

WHAT INFORMATION WAS INVOLVED:
[List specific data types: name, email, etc.]
[List what was NOT involved]

WHAT WE ARE DOING:
- [Immediate actions taken]
- [Ongoing security enhancements]
- [Resources provided to affected individuals]

WHAT YOU CAN DO:
- Change your password immediately
- Monitor your accounts for suspicious activity
- [Specific recommendations]

FOR MORE INFORMATION:
Contact our dedicated hotline: [phone]
Email: security@company.com

We sincerely apologize for this incident and the inconvenience
it may cause.

Sincerely,
[Name, Title]
```

## Compliance Checklist

### GDPR Compliance
- [ ] Lawful basis documented for all processing
- [ ] Privacy policy published and accessible
- [ ] Consent mechanism implements granular controls
- [ ] Data subject rights request process established
- [ ] Records of processing activities maintained
- [ ] Data Protection Officer appointed (if required)
- [ ] DPIA conducted for high-risk processing
- [ ] Data breach notification procedure in place
- [ ] Vendor contracts include data processing agreements
- [ ] International data transfer safeguards implemented
- [ ] Staff training on data protection completed

### CCPA Compliance
- [ ] "Do Not Sell My Personal Information" link on homepage
- [ ] Privacy policy discloses data collection and sales
- [ ] Mechanisms for verifiable consumer requests
- [ ] Process for opt-out requests (48-hour response)
- [ ] Annual report on requests and compliance
- [ ] Service provider agreements updated
- [ ] Notice at collection provided

### HIPAA Compliance
- [ ] Risk assessment completed
- [ ] Security policies and procedures documented
- [ ] Workforce trained on HIPAA requirements
- [ ] Business Associate Agreements signed
- [ ] Access controls and audit trails implemented
- [ ] Encryption for ePHI
- [ ] Breach notification procedures established
- [ ] Contingency plan and disaster recovery

Privacy compliance is an ongoing process, not a one-time checklist. Regularly review and update practices as regulations evolve and your data processing changes.
