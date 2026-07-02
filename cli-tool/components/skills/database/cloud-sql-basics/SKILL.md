---
name: cloud-sql-basics
description: Creates and manages Cloud SQL instances for MySQL, PostgreSQL, and SQL Server. Handles backups, high availability, and secure connectivity for relational database workloads on Google Cloud.
source: google/skills (Apache 2.0)
---

# Cloud SQL Basics

Cloud SQL is a fully managed relational database service for MySQL, PostgreSQL,
and SQL Server. It automates time-consuming tasks like patches, updates,
backups, and replicas, while providing high performance and availability for
your applications.

## Prerequisites

Ensure you have the necessary IAM permissions to create and manage Cloud SQL
instances. The **Cloud SQL Admin** (`roles/cloudsql.admin`) role provides full
access to Cloud SQL resources.

## Quick Start (PostgreSQL)

1.  **Enable the API:**
    ```bash
    gcloud services enable sqladmin.googleapis.com --quiet
    ```

2.  **Create an Instance:**
    ```bash
    gcloud sql instances create INSTANCE_NAME \
      --database-version=POSTGRES_18 \
      --cpu=2 \
      --memory=7680MiB \
      --region=REGION \
      --quiet
    ```

3.  **Set a password for the default user:**

    Because this is a Cloud SQL for PostgreSQL instance, the default admin user
    is `postgres`:
    ```bash
    gcloud sql users set-password postgres \
      --instance=INSTANCE_NAME --password=PASSWORD \
      --quiet
    ```

4.  **Create a database:**
    ```bash
    gcloud sql databases create DATABASE_NAME \
      --instance=INSTANCE_NAME \
      --quiet
    ```

5.  **Get the instance connection name:**

    You need the instance connection name (which is formatted as
    `PROJECT_ID:REGION:INSTANCE_NAME`) to connect using the Cloud SQL Auth
    Proxy. Retrieve it with the following command:
    ```bash
    gcloud sql instances describe INSTANCE_NAME \
      --format="value(connectionName)" \
      --quiet
    ```

6.  **Connect to the instance:**

    The Cloud SQL Auth Proxy must be running to be able to connect to the
    instance. In a separate terminal, start the proxy using the connection name:
    ```bash
    ./cloud-sql-proxy INSTANCE_CONNECTION_NAME
    ```

    With the proxy running, connect using `psql` in another terminal:
    ```bash
    psql "host=127.0.0.1 port=5432 user=postgres dbname=DATABASE_NAME password=PASSWORD sslmode=disable"
    ```

## Reference Directory

-   [Core Concepts](references/core-concepts.md): Instance architecture, high
    availability (HA), and supported database engines.

-   [CLI Usage](references/cli-usage.md): Essential `gcloud sql` commands for
    instance, database, and user management.

-   [Client Libraries & Connectors](references/client-library-usage.md):
    Connecting to Cloud SQL using Python, Java, Node.js, and Go.

-   [MCP Usage](references/mcp-usage.md): Using the Cloud SQL remote MCP
    server and Gemini CLI extension.

-   [Infrastructure as Code](references/iac-usage.md): Terraform
    configuration for instances, databases, and users.

-   [IAM & Security](references/iam-security.md): Predefined roles, SSL/TLS
    certificates, and Auth Proxy configuration.

*If you need product information not found in these references, use the
    Developer Knowledge MCP server `search_documents` tool.*
