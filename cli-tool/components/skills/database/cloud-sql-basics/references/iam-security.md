# Cloud SQL IAM & Security

Cloud SQL uses Identity and Access Management (IAM) to control access to
instances and databases.

## Predefined IAM Roles

| Predefined Role | Usage |
| :--- | :--- |
| `roles/cloudsql.admin` | Full control over all Cloud SQL resources. |
| `roles/cloudsql.editor` | Manage Cloud SQL resources. Cannot see or modify

 permissions, nor modify users or ssl Certs. Cannot import data or restore from
a backup, nor clone, delete, or promote instances. Cannot start or stop
  replicas. Cannot delete databases, replicas, or backups. |
| `roles/cloudsql.viewer` | Read-only access to Cloud SQL resources. |
| `roles/cloudsql.client` | Connectivity access to Cloud SQL instances from App
 Engine and the Cloud SQL Auth Proxy. Not required for accessing an instance
  using IP addresses. |
| `roles/cloudsql.instanceUser` | Permission to log in to a Cloud SQL
  instance. |
| `roles/cloudsql.schemaViewer` | Role allowing access to a Cloud SQL instance
  schema in Knowledge Catalog. |
| `roles/cloudsql.studioUser` | Role allowing access to Cloud SQL Studio. |

## Secure Connectivity

-   **Cloud SQL Auth Proxy:** The recommended way to connect securely. It
    provides IAM-based authentication and end-to-end encryption without
    requiring SSL/TLS certificates or authorized networks.

-   **Private IP:** Use VPC, private services access, or Private Service Connect
    (PSC) to keep database traffic within the Google Cloud network.

-   **Authorized Networks:** If using Public IP, restrict access to specific
    CIDR ranges.

## Data Security

-   **Encryption at Rest:** All data is encrypted by default. Use
    Customer-Managed Encryption Keys (CMEK) for additional control.

-   **IAM Database Authentication:** Authenticate to the database using IAM
    users or service accounts instead of static passwords (available for MySQL
    and PostgreSQL).

## Organization Policies

-   **Cloud SQL organization policies:** Organization policies let organization
    administrators set restrictions on how users can configure instances under
    that organization.

## Service Accounts

-   **Service Identity:** Cloud SQL uses an instance service account
    (`p[PROJECT_NUMBER]-[UNIQUE_ID]@gcp-sa-cloud-sql.iam.gserviceaccount.com`)
    for tasks like exporting a SQL dump file to Cloud Storage. Service agent
    accounts (`service-PROJECT_NUMBER@gcp-sa-cloud-sql.iam.gserviceaccount.com`)
    are used only for internal management tasks.

-   **App Connectivity:** Grant the service account running your app (e.g., on
    Cloud Run or GKE) the `roles/cloudsql.client` role.

For more information, see: 
- [About Access Control - Cloud SQL for MySQL](https://docs.cloud.google.com/sql/docs/mysql/instance-access-control)
- [About Access Control - Cloud SQL for PostgreSQL](https://docs.cloud.google.com/sql/docs/postgres/instance-access-control)
- [About Access Control - Cloud SQL for SQL Server](https://docs.cloud.google.com/sql/docs/sqlserver/instance-access-control)