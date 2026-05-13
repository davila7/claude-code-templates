# Cloud SQL MCP Usage

Cloud SQL can be managed via the Model Context Protocol (MCP), which allows
agents to manage database instances and execute SQL queries. MCP is available
via remote servers and through local execution with the MCP Toolbox:

*   [Cloud SQL for PostgreSQL](https://mcp-toolbox.dev/integrations/cloud-sql-pg/source/)
*   [Cloud SQL for MySQL](https://mcp-toolbox.dev/integrations/cloud-sql-mysql/source/)
*   [Cloud SQL for SQL Server](https://mcp-toolbox.dev/integrations/cloud-sql-mssql/source/)

## MCP Tools for Cloud SQL

The Cloud SQL MCP server typically includes the following tools:

-   `clone_instance`: creates a Cloud SQL instance as a clone of source
    instance.
-   `create_instance`: initiates the creation of a Cloud SQL instance.
-   `create_user`: creates a database user for a Cloud SQL instance.
-   `execute_sql`: executes any valid SQL statements (DDL, DCL, DQL, DML) on a
    Cloud SQL instance.
-   `get_instance`: gets the details of a Cloud SQL instance.
-   `get_operation`: gets the status of a long-running operation in Cloud SQL.
-   `list_instances`: lists all Cloud SQL instances in a project.
-   `list_users`: lists all database users for a Cloud SQL instance.
-   `import_data`: imports data into a Cloud SQL instance from Cloud Storage.
-   `update_instance`: updates supported settings of a Cloud SQL instance.
-   `update_user`: updates a database user for a Cloud SQL instance.

For additional specialized skills including health auditing, performance
monitoring, and lifecycle management, install the Gemini CLI extension or Claude
Plugin:

*   [Cloud SQL for PostgreSQL](https://github.com/gemini-cli-extensions/cloud-sql-postgresql)
*   [Cloud SQL for MySQL](https://github.com/gemini-cli-extensions/cloud-sql-mysql)
*   [Cloud SQL for SQL Server](https://github.com/gemini-cli-extensions/cloud-sql-sqlserver)

## Setup Instructions

Setup varies by database engine and whether you are connecting to a remote
server or using the MCP Toolbox. For remote server setup, see Setting up
Cloud SQL MCP for [PostgreSQL](https://docs.cloud.google.com/sql/docs/postgres/use-cloudsql-mcp),
[MySQL](https://docs.cloud.google.com/sql/docs/mysql/use-cloudsql-mcp), or
[SQL Server](https://docs.cloud.google.com/sql/docs/sqlserver/use-cloudsql-mcp).

## Supported Operations

Agents using the Cloud SQL MCP can:

-   Automate database schema migrations.
-   Perform health checks and monitor operation logs.
-   Assist in debugging SQL performance issues.
