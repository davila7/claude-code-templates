---
name: google-cloud-auth
description: Provides expert guidance on authenticating and authorizing to Google Cloud services and APIs, covering human users, service identities, Application Default Credentials (ADC), and best practices for secure access.
source: google/skills (Apache 2.0)
---

# Authenticating to Google Cloud

[Authentication](https://docs.cloud.google.com/docs/authentication) is the
process of proving **who you are**. In Google Cloud, you represent a
**Principal** (an identity like a user or a service). This is the first step
before [Authorization](https://docs.cloud.google.com/iam/docs/overview)
(determining **what you can do**).

## Authentication

### Clarifying Questions for the Agent

Before providing a specific solution, clarify the following with the user:

1.  **Who or what is authenticating?** (A human developer, a local script, or an
    application running in production?)
2.  **Where is the code running?** (Local laptop, [Compute
    Engine](https://docs.cloud.google.com/compute/docs),
    [GKE](https://docs.cloud.google.com/kubernetes-engine/docs), [Cloud
    Run](https://docs.cloud.google.com/run/docs), or another cloud like
    AWS/Azure?)
3.  **What is the target?** (A Google Cloud API like Storage/BigQuery, or a
    custom application you built?)
4.  **Are you using a high-level client library?** (e.g., Python, Go, Node.js
    libraries usually handle ADC automatically.)

---

## Human Authentication

For users to access Google Cloud, they need an identity that Google Cloud can
recognize.

### Types of User Identities

Google Cloud supports several ways to configure identities for your internal
workforce (developers, administrators, employees):

*   **[Google-Managed
    Accounts](https://docs.cloud.google.com/iam/docs/user-identities#google-accounts)**:
    You can use Cloud Identity or Google Workspace to create managed user
    accounts. These are called managed accounts because your organization
    controls their lifecycle and configuration.
*   **[Federation using Cloud Identity or Google
    Workspace](https://docs.cloud.google.com/iam/docs/user-identities#synced-federation)**:
    You can federate identities to allow users to use their existing identity
    and credentials to sign in to Google services. Users authenticate against an
    external identity provider (IdP), but you must keep accounts synchronized
    into Google Cloud using tools like Google Cloud Directory Sync (GCDS) or an
    external authoritative source like Active Directory or Microsoft Entra ID.
*   **[Workforce Identity
    Federation](https://docs.cloud.google.com/iam/docs/user-identities#workforce)**:
    This lets you use an external IdP to authenticate and authorize a workforce
    using IAM directly. Unlike standard federation, you do not need to
    synchronize user identities from your existing IdP to Google Cloud
    identities. It supports syncless, attribute-based single sign-on.

### Methods of Access for Developers and Administrators

Used for interacting with Google Cloud resources and APIs during development and
management.

*   **[Google Cloud Console](https://console.cloud.google.com/)**: The primary
    web interface. You authenticate using your Google Account (Gmail or [Google
    Workspace](https://workspace.google.com/)).
*   **[gcloud CLI](https://docs.cloud.google.com/sdk/docs/install-sdk) (`gcloud
    auth login`)**: Used to authenticate the CLI itself so you can run
    management commands (e.g., `gcloud compute instances list`). It uses a
    **Credential** (like an OAuth 2.0 refresh token) stored locally.
*   **Local Development with [App Default Credentials
    (ADC)](https://docs.cloud.google.com/docs/authentication/application-default-credentials)
    (`gcloud auth application-default login`)**: This is different from CLI
    auth. It creates a local JSON file that Google Cloud **Client Libraries**
    (Python, Java, etc.) use to act as "you" when you run code on your laptop.
*   **[Service Account
    Impersonation](https://docs.cloud.google.com/docs/authentication/use-service-account-impersonation)**:
    For security reasons, developers should avoid downloading Service Account
    keys entirely. Instead, they should authenticate as humans (`gcloud auth
    login`) and use Service Account Impersonation to run CLI commands or
    generate short-lived credentials. This is a critical best practice for local
    development and troubleshooting.

### For End-Users and Customers

Used when a human (who is not a developer) needs to access a web application
you've deployed on Google Cloud. Note: These are distinct from workforce
identities.

*   **[Identity-Aware Proxy (IAP)](https://docs.cloud.google.com/iap/docs)**:
    Acts as a central authorization layer for web applications. It intercepts
    web requests and verifies the user's identity (via Google Workspace, Cloud
    Identity, or external providers) before letting them reach the application.
    It's often used to protect internal apps without a VPN, or secure customer
    portals.
*   **[Identity
    Platform](https://docs.cloud.google.com/identity-platform/docs)**: A
    Customer Identity and Access Management (CIAM) solution for adding consumer
    sign-in (email/password, phone, social) directly into the code of your
    custom-built applications.

---

## Service-to-Service Authentication

When code runs in production, it should use a **Service Account** rather than a
human user account.

### Service Accounts and Service Agents

*   **[Service
    Account](https://docs.cloud.google.com/iam/docs/service-account-overview)**:
    A special identity intended for non-human users. It's like a "robot
    identity" with its own email address.
*   **[Service Agent](https://docs.cloud.google.com/iam/docs/service-agents)**:
    A service account managed by Google that allows a service (like Pub/Sub) to
    access your resources on your behalf.

### Best Practice: Attaching Service Accounts

Instead of using **Service Account Keys** (dangerous JSON files), you should
**attach** a custom service account to the Google Cloud resource. The resource's
environment then provides a **Token** (a short-lived digital object) via a local
metadata server.

*   **[Compute
    Engine](https://docs.cloud.google.com/compute/docs/access/create-enable-service-accounts-for-instances)**:
    Assign a service account during VM creation.
*   **[Cloud
    Run](https://docs.cloud.google.com/run/docs/securing/service-identity)**:
    Assign a service account in the service configuration.

### Special Cases & Advanced Topics

#### Kubernetes Engine (GKE)

Use **[Workload Identity Federation for
GKE](https://docs.cloud.google.com/kubernetes-engine/docs/how-to/workload-identity)**
to map Kubernetes identities to IAM principal identifiers. This grants specific
Kubernetes workloads access to specific Google Cloud APIs. [Learn more
here.](https://docs.cloud.google.com/kubernetes-engine/docs/how-to/workload-identity#configure-authz-principals)

#### External Workloads ([Workload Identity Federation](https://docs.cloud.google.com/iam/docs/workload-identity-federation))

For code running **outside** Google Cloud (e.g., AWS, Azure, or on-prem), do not
use keys. Instead, use Workload Identity Federation to exchange an external
token (like an AWS IAM role) for a short-lived Google Cloud access token.

#### [API Keys](https://docs.cloud.google.com/docs/authentication/api-keys)

API keys are encrypted strings used for public data (e.g., Google Maps) or
simplified access like **[Vertex AI Express
Mode](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/start/express-mode/overview)**,
which allows fast testing of Gemini models without complex setup. Both humans
and services (e.g., Cloud Run-based AI agent) can use API keys, for the services
that support it.

Note: API keys should be
[restricted](https://docs.cloud.google.com/api-keys/docs/add-restrictions-api-keys)
to specific APIs and projects to minimize security risks. Store API keys in a
secrets manager like [Secret
Manager](https://docs.cloud.google.com/secret-manager/docs) to prevent
accidental exposure.

#### OAuth 2.0 Access Scopes

While IAM is the modern way to handle authorization, legacy Compute Engine VMs
and GKE node pools still rely on **Access Scopes** alongside IAM. If a VM's
scope is restricted, the attached service account will fail to make API calls
even if it has the correct IAM permissions. Check this first if attached service
accounts are failing unexpectedly.

#### Short-Lived Credentials

The underlying mechanism for impersonation and secure service-to-service
communication is the **IAM Service Account Credentials API**. This API generates
short-lived access tokens, OpenID Connect (OIDC) ID tokens, or self-signed JSON
Web Tokens (JWTs) dynamically, removing the need for static credentials.

---

## Authorization

After Authentication, Google Cloud uses **[Identity and Access Management
(IAM)](https://docs.cloud.google.com/iam/docs/overview)** to determine what the
authenticated principal can do.

*   **Allow Policy**: A record that binds a **Principal** to a **Role** on a
    **Resource**.
*   **[Predefined
    Roles](https://docs.cloud.google.com/iam/docs/understanding-roles)**:
    Prebuilt roles like `roles/storage.objectViewer` or
    `roles/bigquery.dataEditor`. **Always try to use these first.**
*   **[Custom
    Roles](https://docs.cloud.google.com/iam/docs/creating-custom-roles)**:
    User-defined collections of specific permissions if predefined roles are too
    broad.

---

## Examples

### Human-to-Service (Local Python Development)

1.  **Authn**: Run `gcloud auth application-default login` to create local
    credentials (ADC).
2.  **Authz**: Grant your email the `roles/storage.objectViewer` role on a
    bucket.
3.  **Code**: Use the Python `storage.Client()`. It automatically finds your
    local credentials via ADC. *Note: ADC searches in a specific order—first
    checking the `GOOGLE_APPLICATION_CREDENTIALS` environment variable, then the
    local gcloud JSON file, and finally the attached service account metadata
    server.*

### Service-to-Service (Cloud Run to Cloud SQL)

1.  **Authn**: Attach a custom Service Account to your Cloud Run service.
2.  **Authz**: Grant that Service Account the `roles/cloudsql.client` role on
    the project.
3.  **Code**: The Cloud Run environment provides the token automatically to the
    connection driver.

### Calling a Custom Application ([OIDC](https://docs.cloud.google.com/docs/authentication/get-id-token))

When calling a private Cloud Run service from another service, the caller
generates a Google-signed **OpenID Connect (OIDC) ID Token** and passes it in
the `Authorization: Bearer <TOKEN>` header.

---

## Validation Checklist

-   [ ] Is the user running code locally? Suggest `gcloud auth
    application-default login` or **Service Account Impersonation**.
-   [ ] Is the user attempting to use Service Account keys locally? Strongly
    discourage this and recommend impersonation.
-   [ ] Is the user running in production? Recommend attaching a custom,
    least-privilege service account, NOT using keys.
-   [ ] Is the user relying on the Compute Engine Default Service Account?
    Recommend creating a custom service account instead.
-   [ ] Is the user running on another cloud? Recommend Workload Identity
    Federation.
-   [ ] Is the user calling a custom app? Recommend OIDC ID Tokens.
-   [ ] Has the user restricted their API Keys? Check for appropriate [API Key
    Restrictions](https://docs.cloud.google.com/docs/authentication/api-keys#adding-application-restrictions).

## References

-   [Authentication Overview](https://docs.cloud.google.com/docs/authentication)
-   [User Identities](https://docs.cloud.google.com/iam/docs/user-identities)
-   [Application Default Credentials](https://docs.cloud.google.com/docs/authentication/provide-credentials-adc)
-   [Service Account Best Practices](https://docs.cloud.google.com/iam/docs/best-practices-service-accounts)
