# AlloyDB IAM & Security

AlloyDB utilizes Google Cloud Identity and Access Management (IAM) to provide
granular access control and robust security features.

## Predefined IAM Roles

The following table describes the predefined roles available for AlloyDB:

| Role Name | Usage |
| :--- | :--- |
| `roles/alloydb.admin` | Full control of all AlloyDB resources. |
| `roles/alloydb.client` | Connectivity access to AlloyDB instances. |
| `roles/alloydb.databaseUser` | Authenticated database-user access to instances. |
| `roles/alloydb.viewer` | Read-only access to all AlloyDB resources. |

## Secure Connectivity

1.  **Network Security:**
    -   **Private IP:** Keeps traffic internal to Google Cloud.
        -   **Private Service Connect (PSC):** Recommended for new
            configurations. Offers enhanced security, better IP management, and
            flexible multi-VPC topologies without peering.
        -   **Private Services Access (PSA):** Uses VPC peering.
    -   **Public IP:** Allows connections from outside GCP.
        -   **ALWAYS** use with **Authorized Networks** to restrict access to
            specific IP ranges.
        -   **NEVER** use `0.0.0.0/0` in Authorized Networks.
    -   **VPC Service Controls (VPC-SC):** Define security perimeters around
        your AlloyDB instances to prevent data exfiltration.

1.  **Encryption:**
    -   **In Transit:** TLS encryption is enforced by default for all
        connections.
    -   **At Rest:** Data is always encrypted, using Google-managed keys by
        default. Customer-Managed Encryption Keys (CMEK) are supported for
        greater control.

1.  **Authentication & Authorization:**
    -   **IAM Authentication:** **Recommended.** Uses Google Cloud Identity and
        Access Management (IAM) principals (users/service accounts) and
        short-lived OAuth tokens. Centralizes access control and avoids database
        passwords.
    -   **Built-in Database Authentication:** Standard PostgreSQL
        username/password. Use strong password policies if this method is
        chosen.
    -   **Database Authorization:** Standard PostgreSQL GRANT / REVOKE
        statements manage permissions within the database, regardless of the
        authentication method.

1.  **Connection Methods:**
    -   **Direct Connection:** Standard PostgreSQL connection.
    -   **AlloyDB Connectors (Auth Proxy & Language Libraries):** **Highly
        Recommended for security.**
        -   Provide connection-level **IAM Authorization**.
        -   Automatically use **mTLS** (Mutual TLS) for encrypted and
            authenticated connections.
        -   Simplify using IAM Database Authentication (tokens are handled
            automatically).
        -   Essential for secure Public IP access without wide open Authorized
            Networks.
        -   Best practice: Run Auth Proxy as a sidecar to the application.

**Key Recommendations for Agents:**

-   **Prioritize Private IP:** Guide users to use Private IP (especially PSC)
    over Public IP whenever their application is within GCP.
-   **Push AlloyDB Connectors:** Strongly recommend AlloyDB Connectors (Auth
    Proxy or language libraries) because they enhance security through IAM
    connection authorization and mTLS, especially crucial for Public IP.
-   **IAM Authentication is Preferred:** Encourages centralized management and
    token-based auth.
-   **Secure Public IP:** If Public IP is necessary, stress the absolute need
    for tightly restricted Authorized Networks.
-   **Leverage Cloud Security Tools:** Remind users to use VPC-SC and Security
    Command Center for monitoring and policy enforcement.

## Data Security

- **Encryption at Rest:** All data is encrypted by default. Use Customer-Managed
  Encryption Keys (CMEK) for greater control.

- **IAM Database Authentication:** Authenticate to the database using IAM
  identities (users or service accounts) instead of static passwords.

## Service Agents

AlloyDB uses a managed service agent
(`service-PROJECT_NUMBER@gcp-sa-alloydb.iam.gserviceaccount.com`) to manage
resources like storage and backups. Ensure this agent has the necessary
permissions in your project.

For more information, see: [Security, privacy, risk, and compliance for AlloyDB for PostgreSQL](https://docs.cloud.google.com/alloydb/docs/security-privacy-compliance).
