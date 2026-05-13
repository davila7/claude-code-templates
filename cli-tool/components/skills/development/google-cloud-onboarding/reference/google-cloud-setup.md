# Google Cloud Setup

This guide provides an overview of the enterprise-level setup process for
[Google Cloud](https://cloud.google.com/), focusing on creating a secure,
scalable foundation.

## Overview

Enterprise onboarding requires more than just a single project. It involves
establishing an
**[Organization](https://docs.cloud.google.com/resource-manager/docs/creating-managing-organization)**
resource, setting up a [resource
hierarchy](https://docs.cloud.google.com/resource-manager/docs/cloud-platform-resource-hierarchy)
(Folders and Projects), managing identities centrally, and configuring shared
networking and security policies.

## Phases of Enterprise Setup

### 1. Establish Your Organization

The Organization resource is the root node of your resource hierarchy.

-   **Identity Provider:** Set up **[Cloud
    Identity](https://cloud.google.com/identity)** or **[Google
    Workspace](https://workspace.google.com/)**.
-   **Domain Verification:** [Verify your domain](https://knowledge.workspace.google.com/admin/domains/verify-your-domain-for-google-workspace)
    (e.g., `example.com`) to automatically create the Organization resource.
-   **Super Administrator:** Assign a [super administrator](https://knowledge.workspace.google.com/admin/users/prebuilt-administrator-roles)
    to manage the identity service.

### 2. Configure Billing

-   **Billing Account:** Create a **[Cloud
    Billing](https://docs.cloud.google.com/billing/docs)** account at the
    Organization level.
-   **Payment Method:** Connect your corporate payment method.
-   **FinOps:** Set up [budgets and spending
    notifications](https://docs.cloud.google.com/billing/docs/how-to/budgets).
-   **Exporting Data:** Enable [billing data export to BigQuery](https://docs.cloud.google.com/billing/docs/how-to/export-data-bigquery)
    for custom cost reporting.

### 3. Identity and Access (IAM)

-   **Centralized Management:** Use **[Google
    Groups](https://docs.cloud.google.com/iam/docs/groups-in-cloud-console)** to
    manage permissions rather than assigning roles directly to individual users.
-   **Administrative Access:** Assign core [IAM
    roles](https://docs.cloud.google.com/iam/docs/roles-overview):
    -   **Organization Administrator:** Full control over all resources.
    -   **Billing Administrator:** Manage billing accounts and link projects.
    -   **Network Administrator:** Manage VPC networks, firewalls, and VPNs.
    -   **Security Administrator:** Manage security policies and SCC.

### 4. Resource Hierarchy

Organize your projects using
**[Folders](https://docs.cloud.google.com/resource-manager/docs/creating-managing-folders)**
to reflect your business structure or environments (e.g., Production,
Development).

-   **Folders:** Group projects by department or environment.
-   **Projects:** The base unit for resource management.

### 5. Networking (VPC)

-   **[Shared VPC](https://docs.cloud.google.com/vpc/docs/shared-vpc):** Allows
    multiple service projects to share a common VPC network managed by a host
    project.
-   **Subnets:** Create regional subnets with non-overlapping IP ranges.
-   **Connectivity:** Set up **[High Availability (HA)
    VPN](https://cloud.google.com/network-connectivity/docs/vpn)** or **[Cloud
    Interconnect](https://cloud.google.com/network-connectivity/docs/interconnect)**
    for hybrid connectivity to on-premises data centers.

### 6. Security and Compliance

-   **[Organization
    Policies](https://docs.cloud.google.com/resource-manager/docs/organization-policy/overview):**
    Apply constraints at the organization or folder level (e.g., restrict
    allowed regions, disable public IP creation).
-   **[Security Command Center
    (SCC)](https://cloud.google.com/security-command-center/docs):** Enable SCC
    for threat detection and security health analytics.
-   **Encryption:** Use **[Cloud KMS](https://cloud.google.com/kms/docs)** (Key
    Management Service) for managing encryption keys.

### 7. Centralized Logging and Monitoring

-   **[Cloud Logging](https://docs.cloud.google.com/logging/docs):** Use [Log
    Sinks](https://docs.cloud.google.com/logging/docs/export/configure_export_v2)
    to export logs from across the organization to a central BigQuery dataset or
    Pub/Sub topic. Routing logs to a centralized bucket helps users centrally
    manage compliance with data retention and data residency requirements.
-   **[Cloud Monitoring](https://docs.cloud.google.com/monitoring/docs):** Set
    up a scoping project to monitor metrics from multiple projects in one place.

## Best Practices

-   **Infrastructure as Code (IaC):** Use
    **[Terraform](https://docs.cloud.google.com/docs/terraform)** to manage and
    deploy your foundation. Google Cloud provides [Terraform
    blueprints](https://cloud.google.com/docs/terraform/blueprints/terraform-blueprints)
    for enterprise setup.
-   **[Principle of Least
    Privilege](https://docs.cloud.google.com/iam/docs/using-iam-securely#least_privilege):**
    Start with minimal permissions and expand as needed.
-   **Separation of Duties:** Ensure that network, security, and application
    administrators have distinct roles.

## Links

-   [Google Cloud Setup Checklist](https://docs.cloud.google.com/docs/enterprise/cloud-setup)
-   [Best Practices for Planning Accounts and Organizations](https://docs.cloud.google.com/architecture/identity/best-practices-for-planning)
-   [Landing zone design in Google Cloud](https://docs.cloud.google.com/architecture/landing-zones)
-   [Google Cloud Well-Architected Framework](https://docs.cloud.google.com/architecture/framework)
