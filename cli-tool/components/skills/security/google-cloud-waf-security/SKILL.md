---
name: google-cloud-waf-security
description: Generates security-focused guidance for Google Cloud workloads based on the Google Cloud Well-Architected Framework (WAF). Use to evaluate a workload, identify security requirements, and provide actionable recommendations for IAM, network security, data protection, and operational security.
source: google/skills (Apache 2.0)
---

# Google Cloud Well-Architected Framework skill for the Security pillar

## Overview

The security pillar of the Google Cloud Well-Architected Framework provides
design principles and best practices for building a robust security posture by
integrating security into every layer of the architecture for cloud workloads.
It focuses on maintaining confidentiality and integrity of data and systems
while ensuring compliance and privacy. It provides a structured approach to risk
management, threat defense, and identity control, enabling you to operate cloud
workloads securely and at scale.

## Core principles

The recommendations in the security pillar of the Well-Architected Framework are
aligned with the following core principles:

-  **Implement security by design**: Integrate cloud security and network
   security considerations starting from the initial design phase of your
   applications and infrastructure. Google Cloud provides architecture
   blueprints and recommendations to help you apply this principle. Grounding
   document:
   https://docs.cloud.google.com/architecture/framework/security/implement-security-by-design

-  **Implement zero trust**: Use a _never trust, always verify_ approach, where
   access to resources is granted based on continuous verification of trust.
   Google Cloud supports this principle through products like Chrome Enterprise
   Premium and Identity-Aware Proxy (IAP). Grounding document:
   https://docs.cloud.google.com/architecture/framework/security/implement-zero-trust

-  **Implement shift-left security**: Implement security controls early in the
   software development lifecycle. Avoid security defects before system changes
   are made. Detect and fix security bugs early, fast, and reliably after the
   system changes are committed. Google Cloud supports this principle through
   products like Cloud Build, Binary Authorization, and Artifact Registry.
   Grounding document:
   https://docs.cloud.google.com/architecture/framework/security/implement-shift-left-security

-  **Implement preemptive cyber defense**: Adopt a proactive approach to
   security by implementing robust fundamental measures like threat
   intelligence. This approach helps you build a foundation for more effective
   threat detection and response. Google Cloud's approach to layered security
   controls aligns with this principle. Google Cloud supports this principle
   through products like Security Command Center, Google Threat Intelligence,
   and Google SecOps. Grounding document:
   https://docs.cloud.google.com/architecture/framework/security/implement-preemptive-cyber-defense

-  **Use AI securely and responsibly**: Develop and deploy AI systems in a
   responsible and secure manner. The recommendations for this principle are
   aligned with guidance in the AI and ML perspective of the Well-Architected
   Framework and in Google's Secure AI Framework (SAIF). Grounding document:
   https://docs.cloud.google.com/architecture/framework/security/use-ai-securely-and-responsibly

-  **Use AI for security**: Use AI capabilities to improve your existing
   security systems and processes through Gemini in Security and overall
   platform-security capabilities. Use AI as a tool to increase the automation
   of remedial work and ensure security hygiene to make other systems more
   secure. Google Cloud supports this principle through products like Google
   Threat Intelligence and Google SecOps. Grounding document:
   https://docs.cloud.google.com/architecture/framework/security/use-ai-for-security

-  **Meet regulatory, compliance, and privacy needs**: Adhere to
   industry-specific regulations, compliance standards, and privacy
   requirements. Google Cloud helps you meet these obligations through products
   like Assured Workloads, Organization Policy Service, and our compliance
   resource center. Grounding document:
   https://docs.cloud.google.com/architecture/framework/security/meet-regulatory-compliance-and-privacy-needs

## Relevant Google Cloud products

The following are _examples_ of Google Cloud products and features that are
relevant to security:

- **Identity and access management**

  - **Identity and Access Management (IAM)**: Fine-grained access control for
    Google Cloud resources.
  - **Identity-Aware Proxy (IAP)**: Secure access to applications without a VPN.
  - **Chrome Enterprise Premium**: Endpoint security and context-aware access.

- **Network security**

  - **Google Cloud Armor**: DDoS protection and Web Application Firewall (WAF).
  - **VPC Service Controls**: Define security perimeters to prevent data
    exfiltration.
  - **Cloud Next-Generation Firewall (NGFW)**: Advanced threat protection for
    network traffic.
  - **Shared VPC**: Centralized network management across projects.
  - **Cloud Interconnect and IPsec VPN**: Secure, private connectivity.

- **Data security**

  - **Cloud Key Management Service (KMS)**: Manage encryption keys.
  - **Sensitive Data Protection (formerly Cloud DLP)**: Discover and redact
    sensitive data.
  - **Confidential Computing**: Encrypt data in use (memory).

- **Security operations (SecOps)**

  - **Google SecOps (Chronicle)**: Threat detection and security analytics.
  - **Security Command Center (SCC)**: Centralized vulnerability and threat
    management.
  - **Cloud Logging and Cloud Monitoring**: Visibility into system activity.

- **Automation and supply chain**

  - **Cloud Build**: Secure CI/CD pipelines.
  - **Artifact Analysis**: Vulnerability scanning for container images.
  - **Binary Authorization**: Deploy-time policy enforcement.
  - **Assured open source software**: Use secured OSS packages.

## Workload assessment questions

Ask appropriate questions to understand the security-related requirements and
constraints of the workload and the user's organization. Choose questions from
the following list:

- **Security by design**:

  - How do you incorporate security considerations into your project's initial
    planning and design phases?
  - How do you define and document security requirements for new applications
    and services?
  - How do you ensure that security is integrated into your development
    lifecycle?
  - What tools and techniques do you use to perform threat modeling during the
    design phase?
  - How do you manage and prioritize security vulnerabilities discovered during
    the design and development process?
  - How do you handle security updates and patches for your applications and
    infrastructure?
  - How do you document and communicate security design decisions to your team
    and stakeholders?
  - How do you ensure that security configurations are consistently applied
    across your environments?
  - How do you validate the effectiveness of your security controls and
    measures?
  - How do you handle security exceptions and deviations from your security
    design?

- **Zero trust**:

  - How do you verify and authenticate users and devices accessing your Google
    Cloud resources?
  - How do you implement the principle of least privilege for access control?
  - How do you monitor and control network traffic within your Google Cloud
    environment?
  - How do you secure data in transit and at rest in your Google Cloud
    environment?
  - How do you implement continuous monitoring and logging of user and device
    activity?
  - How do you handle and respond to security incidents and breaches in a Zero
    Trust environment?
  - How do you manage and update security policies and controls in a Zero Trust
    environment?
  - How do you ensure that third-party applications and services comply with
    your Zero Trust principles?
  - How do you handle remote access and BYOD devices in a Zero Trust
    environment?
  - How do you educate and train your employees on Zero Trust principles and
    practices?

- **Shift-left security**:

  - How do you integrate security testing into your development pipeline early
    in the process?
  - What types of security testing do you perform during the development phase?
  - How do you provide developers with feedback on security vulnerabilities and
    best practices?
  - How do you empower developers to take ownership of security in their code?
  - How do you ensure that security requirements are clearly defined and
    communicated to developers?
  - How do you measure the effectiveness of your Shift Left security
    initiatives?
  - How do you handle security dependencies and third-party libraries in your
    code?
  - How do you manage and update security configurations in your development
    environment?
  - How do you handle security exceptions and deviations from your security
    policies in development?
  - How do you promote a culture of security awareness and responsibility among
    developers?

- **Preemptive cyber defense**:

  - How do you proactively identify and mitigate potential security threats
    before they impact your systems?
  - What tools and techniques do you use for continuous security monitoring and
    analysis?
  - How do you respond to and remediate security alerts and incidents?
  - How do you simulate and test your incident response plans?
  - How do you stay up-to-date with the latest security threats and
    vulnerabilities?
  - How do you handle and mitigate DDoS attacks against your applications and
    services?
  - How do you protect your sensitive data from insider threats?
  - How do you ensure that your security controls are effective against advanced
    persistent threats (APTs)?
  - How do you handle security vulnerabilities in your supply chain?
  - How do you adapt your security posture to evolving threats and technologies?

- **Security of AI workloads**:

  - How do you ensure the security of your AI models and data?
  - How do you address potential biases and ethical concerns in your AI models?
  - How do you protect your AI models from adversarial attacks and data
    poisoning?
  - How do you ensure the privacy of data used in your AI models?
  - How do you explain and interpret the decisions made by your AI models?
  - How do you manage and control access to your AI models and data?
  - How do you ensure compliance with regulations and standards related to
    AI and ML?
  - How do you monitor and detect anomalies in the behavior of your AI models?
  - How do you handle and respond to security incidents involving your AI
    models?
  - How do you educate and train your employees on the secure and responsible
    use of AI and ML?

- **AI for security**:

  - How do you leverage AI and ML to enhance your security posture?
  - What types of AI models do you use for security purposes?
  - How do you train and validate your AI models for security applications?
  - How do you ensure the accuracy and reliability of AI-based security
    systems?
  - How do you handle false positives and false negatives from AI-based
    security systems?
  - How do you integrate AI-based security systems with your existing security
    infrastructure?
  - How do you manage and update your AI models for security applications?
  - How do you explain and interpret the decisions made by your AI models for
    security applications?
  - How do you ensure the ethical and responsible use of AI and ML for security
    purposes?
  - How do you measure the effectiveness of AI and ML in improving your security
    posture?

- **Regulatory compliance and privacy**:

  - What regulatory compliance frameworks and privacy standards do you need to
    adhere to?
  - How do you assess and manage compliance risks in your Google Cloud
    environment?
  - How do you ensure the privacy of sensitive data stored and processed in
    Google Cloud?
  - How do you handle data subject requests (DSRs) related to privacy
    regulations?
  - How do you document and track compliance activities and evidence?
  - How do you ensure that third-party vendors and partners comply with your
    regulatory and privacy requirements?
  - How do you handle data breaches and security incidents related to compliance
    regulations?
  - How do you stay up-to-date with changes in regulatory compliance and privacy
    standards?
  - How do you educate and train your employees on regulatory compliance and
    privacy requirements?
  - How do you demonstrate and prove compliance to auditors and regulators?

## Validation checklist

Use the following checklist to evaluate the architecture's alignment with
security recommendations:

- **Security by design**:

  - Are system components selected based on their security features and
    hardening?
  - Is defense-in-depth implemented at the network, host, and application
    layers?
  - Are safe libraries and application frameworks used to prevent common
    vulnerabilities?
  - Is a risk assessment performed using industry standards?

- **Zero trust**:

  - Is access control enforced based on user identity and context (device,
    location)?
  - Are private connectivity methods (Cloud Interconnect, VPN) used for internal
    traffic?
  - Are default networks disabled in all projects?
  - Are VPC Service Controls perimeters established around sensitive data?

- **Shift-left security**:

  - Is infrastructure provisioned using Infrastructure as Code
    (e.g., Terraform)?
  - Are automated security scans integrated into the CI/CD pipeline?
  - Is there a process for scanning and patching vulnerabilities in
    dependencies?
  - Is Binary Authorization used to ensure only trusted images are deployed?

- **Preemptive cyber defense**:

  - Is threat intelligence integrated into security operations?
  - Is security logging enabled and centralized for all critical resources?
  - Are automated responses configured for common security threats?
  - Are defenses validated through periodic testing or red-teaming?

- **AI security and governance**:

  - Are AI pipelines secured against tampering and data poisoning?
  - Is differential privacy or data masking used for training data where
    appropriate?
  - Are Vertex Explainable AI and fairness indicators used for model governance?
