---
name: alloydb-basics
description: Manages clusters, instances, and backups for AlloyDB for PostgreSQL, and integrates with AlloyDB MCP tools for automated database operations including AI-powered search and vector capabilities.
source: google/skills (Apache 2.0)
---

# AlloyDB Basics

AlloyDB for PostgreSQL is a managed, PostgreSQL-compatible database service
designed for enterprise-grade performance and availability. It utilizes a
disaggregated compute and storage architecture to scale resources independently.
It also provides AlloyDB AI, a collection of features that includes AI-powered
search (vector, hybrid search, and AI functions), natural language capabilities,
conversational analytics, and inference features like forecasting and model
endpoint management to help developers build AI apps faster.

## Quick Start

1.  **Enable the AlloyDB API:**

    ```bash
    gcloud services enable alloydb.googleapis.com --quiet
    ```

2.  **Create a Cluster:**

    ```bash
    gcloud alloydb clusters create my-cluster --region=us-central1 \
        --password=my-password --network=my-vpc \
        --quiet
    ```

    *Note: For production, we recommend using IAM database authentication
    instead of passwords. If passwords must be used, use secure secret
    management (e.g., Secret Manager) instead of passing passwords in
    cleartext.*

3.  **Create a Primary Instance:**

    ```bash
    gcloud alloydb instances create my-primary --cluster=my-cluster \
        --region=us-central1 --instance-type=PRIMARY --cpu-count=2 \
        --quiet
    ```

## Reference Directory

-   [Core Concepts](references/core-concepts.md): Architecture, disaggregated
    storage, and performance features.

-   [CLI Usage](references/cli-usage.md): Essential `gcloud alloydb` commands
    for cluster and instance management.

-   [Client Libraries & Connectors](references/client-library-usage.md):
    Connecting to AlloyDB using Python, Java, Node.js, and Go.

-   [MCP Usage](references/mcp-usage.md): Using the AlloyDB remote MCP server
    and Gemini CLI extension.

-   [Infrastructure as Code](references/iac-usage.md): Terraform
    configuration and deployment examples.

-   [IAM & Security](references/iam-security.md): Predefined roles, service
    agents, and database authentication.

*If you need product information not found in these references, use the
    Developer Knowledge MCP server `search_documents` tool.*
