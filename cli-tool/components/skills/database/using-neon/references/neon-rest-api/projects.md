## Overview

This document outlines the rules for managing Neon projects programmatically. It covers creation, retrieval, updates, and deletion.

## Manage projects

### List projects

1.  Action: Retrieves a list of all projects accessible to the account associated with the API key. This is the primary method for obtaining `project_id` values required for other API calls.
2.  Endpoint: `GET /projects`
3.  Query Parameters:
    - `limit` (optional, integer, default: 10): Specifies the number of projects to return, from 1 to 400.
    - `cursor` (optional, string): Used for pagination. Provide the `cursor` value from a previous response to fetch the next set of projects.
    - `search` (optional, string): Filters projects by a partial match on the project `name` or `id`.
    - `org_id` (optional, string): Filters projects by a specific organization ID.
4.  When iterating through all projects, use a combination of the `limit` and `cursor` parameters to handle pagination correctly.

Example request:

```bash
# Retrieve the first 10 projects
curl 'https://console.neon.tech/api/v2/projects?limit=10' \
  -H 'Accept: application/json' \
  -H "Authorization: Bearer $NEON_API_KEY"
```

Example response:

```json
{
  "projects": [
    {
      "id": "old-fire-32990194",
      "platform_id": "aws",
      "region_id": "aws-ap-southeast-1",
      "name": "old-fire-32990194",
      "provisioner": "k8s-neonvm",
      "default_endpoint_settings": {
        "autoscaling_limit_min_cu": 0.25,
        "autoscaling_limit_max_cu": 2,
        "suspend_timeout_seconds": 0
      },
      "settings": {
        "allowed_ips": {
          "ips": [],
          "protected_branches_only": false
        },
        "enable_logical_replication": false,
        "maintenance_window": {
          "weekdays": [5],
          "start_time": "19:00",
          "end_time": "20:00"
        },
        "block_public_connections": false,
        "block_vpc_connections": false,
        "hipaa": false
      },
      "pg_version": 17,
      "proxy_host": "ap-southeast-1.aws.neon.tech",
      "branch_logical_size_limit": 512,
      "branch_logical_size_limit_bytes": 536870912,
      "store_passwords": true,
      "active_time": 0,
      "cpu_used_sec": 0,
      "creation_source": "console",
      "created_at": "2025-09-10T06:58:33Z",
      "updated_at": "2025-09-10T06:58:39Z",
      "synthetic_storage_size": 0,
      "quota_reset_at": "2025-10-01T00:00:00Z",
      "owner_id": "org-royal-sun-91776391",
      "compute_last_active_at": "2025-09-10T06:58:38Z",
      "org_id": "org-royal-sun-91776391",
      "history_retention_seconds": 86400
    }
  ],
  "pagination": {
    "cursor": "old-fire-32990194"
  },
  "applications": {},
  "integrations": {}
}
```

### Create project

1.  Action: Creates a new Neon project. You can specify a wide range of settings at creation time, including the region, Postgres version, default branch and compute configurations, and security settings.
2.  Endpoint: `POST /projects`
3.  Body Parameters: The request body must contain a top-level `project` object with the following nested attributes:

    `project` (object, required): The main container for all project settings.
    - `name` (string, optional): A descriptive name for the project (1-256 characters). If omitted, the project name will be identical to its generated ID.
    - `pg_version` (integer, optional): The major Postgres version. Defaults to `17`. Supported versions: 14, 15, 16, 17, 18.
    - `region_id` (string, optional): The identifier for the region where the project will be created (e.g., `aws-us-east-1`).
    - `org_id` (string, optional): The ID of an organization to which the project will belong. Required if using an Organization API key.
    - `store_passwords` (boolean, optional): Whether to store role passwords in Neon. Storing passwords is required for features like the SQL Editor and integrations.
    - `history_retention_seconds` (integer, optional): The duration in seconds (0 to 2,592,000) to retain project history for features like Point-in-Time Restore. Defaults to 86400 (1 day).
    - `provisioner` (string, optional): The compute provisioner. Specify `k8s-neonvm` to enable Autoscaling. Allowed values: `k8s-pod`, `k8s-neonvm`.
    - `default_endpoint_settings` (object, optional): Default settings for new compute endpoints created in this project.
      - `autoscaling_limit_min_cu` (number, optional): The minimum number of Compute Units (CU). Minimum value is `0.25`.
      - `autoscaling_limit_max_cu` (number, optional): The maximum number of Compute Units (CU). Minimum value is `0.25`.
      - `suspend_timeout_seconds` (integer, optional): Duration of inactivity in seconds before a compute is suspended. Ranges from -1 (never suspend) to 604800 (1 week). A value of `0` uses the default of 300 seconds (5 minutes).
    - `settings` (object, optional): Project-wide settings.
      - `quota` (object, optional): Per-project consumption quotas. A zero or empty value means "unlimited".
        - `active_time_seconds` (integer, optional): Wall-clock time allowance for active computes.
        - `compute_time_seconds` (integer, optional): CPU seconds allowance.
        - `written_data_bytes` (integer, optional): Data written allowance.
        - `data_transfer_bytes` (integer, optional): Data transferred allowance.
        - `logical_size_bytes` (integer, optional): Logical data size limit per branch.
      - `allowed_ips` (object, optional): Configures the IP Allowlist.
        - `ips` (array of strings, optional): A list of allowed IP addresses or CIDR ranges.
        - `protected_branches_only` (boolean, optional): If `true`, the IP allowlist applies only to protected branches.
      - `enable_logical_replication` (boolean, optional): Sets `wal_level=logical`.
      - `maintenance_window` (object, optional): The time period for scheduled maintenance.
        - `weekdays` (array of integers, required if `maintenance_window` is set): Days of the week (1=Monday, 7=Sunday).
        - `start_time` (string, required if `maintenance_window` is set): Start time in "HH:MM" UTC format.
        - `end_time` (string, required if `maintenance_window` is set): End time in "HH:MM" UTC format.
    - `branch` (object, optional): Configuration for the project's default branch.
      - `name` (string, optional): The name for the default branch. Defaults to `main`.
      - `role_name` (string, optional): The name for the default role. Defaults to `{database_name}_owner`.
      - `database_name` (string, optional): The name for the default database. Defaults to `neondb`.

Example request

```bash
curl -X POST 'https://console.neon.tech/api/v2/projects' \
  -H 'Accept: application/json' \
  -H "Authorization: Bearer $NEON_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
  "project": {
    "name": "my-new-api-project",
    "pg_version": 17
  }
}'
```

Example response

```json
{
  "project": {
    "data_storage_bytes_hour": 0,
    "data_transfer_bytes": 0,
    "written_data_bytes": 0,
    "compute_time_seconds": 0,
    "active_time_seconds": 0,
    "cpu_used_sec": 0,
    "id": "sparkling-hill-99143322",
    "platform_id": "aws",
    "region_id": "aws-us-west-2",
    "name": "my-new-api-project",
    "provisioner": "k8s-neonvm",
    "default_endpoint_settings": {
      "autoscaling_limit_min_cu": 0.25,
      "autoscaling_limit_max_cu": 0.25,
      "suspend_timeout_seconds": 0
    },
    "settings": {
      "allowed_ips": {
        "ips": [],
        "protected_branches_only": false
      },
      "enable_logical_replication": false,
      "maintenance_window": {
        "weekdays": [5],
        "start_time": "07:00",
        "end_time": "08:00"
      },
      "block_public_connections": false,
      "block_vpc_connections": false,
      "hipaa": false
    },
    "pg_version": 17,
    "proxy_host": "c-2.us-west-2.aws.neon.tech",
    "branch_logical_size_limit": 512,
    "branch_logical_size_limit_bytes": 536870912,
    "store_passwords": true,
    "creation_source": "console",
    "history_retention_seconds": 86400,
    "created_at": "2025-09-10T07:58:16Z",
    "updated_at": "2025-09-10T07:58:16Z",
    "consumption_period_start": "0001-01-01T00:00:00Z",
    "consumption_period_end": "0001-01-01T00:00:00Z",
    "owner_id": "org-royal-sun-91776391",
    "org_id": "org-royal-sun-91776391"
  },
  "connection_uris": [
    {
      "connection_uri": "postgresql://neondb_owner:npg_N67FDMtGvJke@ep-round-unit-afbn7qv4.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require",
      "connection_parameters": {
        "database": "neondb",
        "password": "npg_N67FDMtGvJke",
        "role": "neondb_owner",
        "host": "ep-round-unit-afbn7qv4.c-2.us-west-2.aws.neon.tech",
        "pooler_host": "ep-round-unit-afbn7qv4-pooler.c-2.us-west-2.aws.neon.tech"
      }
    }
  ],
  "roles": [
    {
      "branch_id": "br-green-mode-afe3fl9y",
      "name": "neondb_owner",
      "password": "npg_N67FDMtGvJke",
      "protected": false,
      "created_at": "2025-09-10T07:58:16Z",
      "updated_at": "2025-09-10T07:58:16Z"
    }
  ],
  "databases": [
    {
      "id": 6677853,
      "branch_id": "br-green-mode-afe3fl9y",
      "name": "neondb",
      "owner_name": "neondb_owner",
      "created_at": "2025-09-10T07:58:16Z",
      "updated_at": "2025-09-10T07:58:16Z"
    }
  ],
  "operations": [
    {
      "id": "08b9367d-6918-4cd5-b4a6-41c8fd984b7e",
      "project_id": "sparkling-hill-99143322",
      "branch_id": "br-green-mode-afe3fl9y",
      "action": "create_timeline",
      "status": "running",
      "failures_count": 0,
      "created_at": "2025-09-10T07:58:16Z",
      "updated_at": "2025-09-10T07:58:16Z",
      "total_duration_ms": 0
    },
    {
      "id": "c6917f04-5cd3-48a2-97c9-186b1d9729f0",
      "project_id": "sparkling-hill-99143322",
      "branch_id": "br-green-mode-afe3fl9y",
      "endpoint_id": "ep-round-unit-afbn7qv4",
      "action": "start_compute",
      "status": "scheduling",
      "failures_count": 0,
      "created_at": "2025-09-10T07:58:16Z",
      "updated_at": "2025-09-10T07:58:16Z",
      "total_duration_ms": 0
    }
  ],
  "branch": {
    "id": "br-green-mode-afe3fl9y",
    "project_id": "sparkling-hill-99143322",
    "name": "main",
    "current_state": "init",
    "pending_state": "ready",
    "state_changed_at": "2025-09-10T07:58:16Z",
    "creation_source": "console",
    "primary": true,
    "default": true,
    "protected": false,
    "cpu_used_sec": 0,
    "compute_time_seconds": 0,
    "active_time_seconds": 0,
    "written_data_bytes": 0,
    "data_transfer_bytes": 0,
    "created_at": "2025-09-10T07:58:16Z",
    "updated_at": "2025-09-10T07:58:16Z",
    "init_source": "parent-data"
  },
  "endpoints": [
    {
      "host": "ep-round-unit-afbn7qv4.c-2.us-west-2.aws.neon.tech",
      "id": "ep-round-unit-afbn7qv4",
      "project_id": "sparkling-hill-99143322",
      "branch_id": "br-green-mode-afe3fl9y",
      "autoscaling_limit_min_cu": 0.25,
      "autoscaling_limit_max_cu": 0.25,
      "region_id": "aws-us-west-2",
      "type": "read_write",
      "current_state": "init",
      "pending_state": "active",
      "settings": {},
      "pooler_enabled": false,
      "pooler_mode": "transaction",
      "disabled": false,
      "passwordless_access": true,
      "creation_source": "console",
      "created_at": "2025-09-10T07:58:16Z",
      "updated_at": "2025-09-10T07:58:16Z",
      "proxy_host": "c-2.us-west-2.aws.neon.tech",
      "suspend_timeout_seconds": 0,
      "provisioner": "k8s-neonvm"
    }
  ]
}
```

### Retrieve project details

1.  Action: Retrieves detailed information about a single, specific project.
2.  Endpoint: `GET /projects/{project_id}`
3.  Prerequisite: You must have the `project_id` of the project you wish to retrieve.
4.  Path Parameters:
    - `project_id` (required, string): The unique identifier of the project.

Example request:

```bash
curl 'https://console.neon.tech/api/v2/projects/sparkling-hill-99143322' \
  -H 'Accept: application/json' \
  -H "Authorization: Bearer $NEON_API_KEY"
```

Example response

```json
{
  "project": {
    "data_storage_bytes_hour": 0,
    "data_transfer_bytes": 0,
    "written_data_bytes": 0,
    "compute_time_seconds": 0,
    "active_time_seconds": 0,
    "cpu_used_sec": 0,
    "id": "sparkling-hill-99143322",
    "platform_id": "aws",
    "region_id": "aws-us-west-2",
    "name": "my-new-api-project",
    "provisioner": "k8s-neonvm",
    "default_endpoint_settings": {
      "autoscaling_limit_min_cu": 0.25,
      "autoscaling_limit_max_cu": 0.25,
      "suspend_timeout_seconds": 0
    },
    "settings": {
      "allowed_ips": {
        "ips": [],
        "protected_branches_only": false
      },
      "enable_logical_replication": false,
      "maintenance_window": {
        "weekdays": [5],
        "start_time": "07:00",
        "end_time": "08:00"
      },
      "block_public_connections": false,
      "block_vpc_connections": false,
      "hipaa": false
    },
    "pg_version": 17,
    "proxy_host": "c-2.us-west-2.aws.neon.tech",
    "branch_logical_size_limit": 512,
    "branch_logical_size_limit_bytes": 536870912,
    "store_passwords": true,
    "creation_source": "console",
    "history_retention_seconds": 86400,
    "created_at": "2025-09-10T07:58:16Z",
    "updated_at": "2025-09-10T07:58:25Z",
    "synthetic_storage_size": 0,
    "consumption_period_start": "2025-09-10T06:58:15Z",
    "consumption_period_end": "2025-10-01T00:00:00Z",
    "owner_id": "org-royal-sun-91776391",
    "owner": {
      "email": "<USER_EMAIL>",
      "name": "My Personal Account",
      "branches_limit": 10,
      "subscription_type": "free_v3"
    },
    "compute_last_active_at": "2025-09-10T07:58:21Z",
    "org_id": "org-royal-sun-91776391"
  }
}
```

### Update a project

1.  Action: Updates the settings of a specified project. This endpoint is used to modify a wide range of project attributes after creation, such as its name, default compute settings, security policies, and maintenance schedules.
2.  Endpoint: `PATCH /projects/{project_id}`
3.  Path Parameters:
    - `project_id` (string, required): The unique identifier of the project to update.
4.  Body Parameters: The request body must contain a top-level `project` object with the attributes to be updated.

    `project` (object, required): The main container for the settings you want to modify.
    - `name` (string, optional): A new descriptive name for the project.
    - `history_retention_seconds` (integer, optional): The duration in seconds (0 to 2,592,000) to retain project history.
    - `default_endpoint_settings` (object, optional): New default settings for compute endpoints created in this project.
      - `autoscaling_limit_min_cu` (number, optional): The minimum number of Compute Units (CU). Minimum `0.25`.
      - `autoscaling_limit_max_cu` (number, optional): The maximum number of Compute Units (CU). Minimum `0.25`.
      - `suspend_timeout_seconds` (integer, optional): Duration of inactivity in seconds before a compute is suspended. Ranges from -1 (never suspend) to 604800 (1 week). A value of `0` uses the default of 300 seconds (5 minutes).
    - `settings` (object, optional): Project-wide settings to update.
      - `quota` (object, optional): Per-project consumption quotas.
        - `active_time_seconds` (integer, optional): Wall-clock time allowance for active computes.
        - `compute_time_seconds` (integer, optional): CPU seconds allowance.
        - `written_data_bytes` (integer, optional): Data written allowance.
        - `data_transfer_bytes` (integer, optional): Data transferred allowance.
        - `logical_size_bytes` (integer, optional): Logical data size limit per branch.
      - `allowed_ips` (object, optional): Modifies the IP Allowlist.
        - `ips` (array of strings, optional): The new list of allowed IP addresses or CIDR ranges.
        - `protected_branches_only` (boolean, optional): If `true`, the IP allowlist applies only to protected branches.
      - `enable_logical_replication` (boolean, optional): Sets `wal_level=logical`. This is irreversible.
      - `maintenance_window` (object, optional): The time period for scheduled maintenance.
        - `weekdays` (array of integers, required if `maintenance_window` is set): Days of the week (1=Monday, 7=Sunday).
        - `start_time` (string, required if `maintenance_window` is set): Start time in "HH:MM" UTC format.
        - `end_time` (string, required if `maintenance_window` is set): End time in "HH:MM" UTC format.
      - `block_public_connections` (boolean, optional): If `true`, disallows connections from the public internet.
      - `block_vpc_connections` (boolean, optional): If `true`, disallows connections from VPC endpoints.
      - `audit_log_level` (string, optional): Sets the audit log level. Allowed values: `base`, `extended`, `full`.
      - `hipaa` (boolean, optional): Toggles HIPAA compliance settings.
      - `preload_libraries` (object, optional): Libraries to preload into compute instances.
        - `use_defaults` (boolean, optional): Toggles the use of default libraries.
        - `enabled_libraries` (array of strings, optional): A list of specific libraries to enable.

Example request

```bash
curl -X PATCH 'https://console.neon.tech/api/v2/projects/sparkling-hill-99143322' \
  -H 'accept: application/json' \
  -H "Authorization: Bearer $NEON_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
  "project": {
    "name": "updated-project-name"
  }
}'
```

Example response

```json
{
  "project": {
    "data_storage_bytes_hour": 0,
    "data_transfer_bytes": 0,
    "written_data_bytes": 29060360,
    "compute_time_seconds": 79,
    "active_time_seconds": 308,
    "cpu_used_sec": 79,
    "id": "sparkling-hill-99143322",
    "platform_id": "aws",
    "region_id": "aws-us-west-2",
    "name": "updated-project-name",
    "provisioner": "k8s-neonvm",
    "default_endpoint_settings": {
      "autoscaling_limit_min_cu": 0.25,
      "autoscaling_limit_max_cu": 0.25,
      "suspend_timeout_seconds": 0
    },
    "settings": {
      "allowed_ips": {
        "ips": [],
        "protected_branches_only": false
      },
      "enable_logical_replication": false,
      "maintenance_window": {
        "weekdays": [5],
        "start_time": "07:00",
        "end_time": "08:00"
      },
      "block_public_connections": false,
      "block_vpc_connections": false,
      "hipaa": false
    },
    "pg_version": 17,
    "proxy_host": "c-2.us-west-2.aws.neon.tech",
    "branch_logical_size_limit": 512,
    "branch_logical_size_limit_bytes": 536870912,
    "store_passwords": true,
    "creation_source": "console",
    "history_retention_seconds": 86400,
    "created_at": "2025-09-10T07:58:16Z",
    "updated_at": "2025-09-10T08:08:23Z",
    "synthetic_storage_size": 0,
    "consumption_period_start": "0001-01-01T00:00:00Z",
    "consumption_period_end": "0001-01-01T00:00:00Z",
    "owner_id": "org-royal-sun-91776391",
    "compute_last_active_at": "2025-09-10T07:58:21Z"
  },
  "operations": []
}
```

### Delete project

1.  Action: Permanently deletes a project and all of its associated resources, including all branches, computes, databases, and roles.
2.  Endpoint: `DELETE /projects/{project_id}`
3.  Prerequisite: You must have the `project_id` of the project you wish to delete.
4.  Warning: This is a destructive action that cannot be undone. It deletes all data, databases, and resources in the project. Proceed with extreme caution and confirm with the user before executing this operation.
5.  Path Parameters:
    - `project_id` (required, string): The unique identifier of the project to be deleted.

Example request:

```bash
curl -X 'DELETE' \
  'https://console.neon.tech/api/v2/projects/sparkling-hill-99143322' \
  -H 'Accept: application/json' \
  -H "Authorization: Bearer $NEON_API_KEY"
```

Example response:

```json
{
  "project": {
    "data_storage_bytes_hour": 0,
    "data_transfer_bytes": 0,
    "written_data_bytes": 29060360,
    "compute_time_seconds": 79,
    "active_time_seconds": 308,
    "cpu_used_sec": 79,
    "id": "sparkling-hill-99143322",
    "platform_id": "aws",
    "region_id": "aws-us-west-2",
    "name": "updated-project-name",
    "provisioner": "k8s-neonvm",
    "default_endpoint_settings": {
      "autoscaling_limit_min_cu": 0.25,
      "autoscaling_limit_max_cu": 0.25,
      "suspend_timeout_seconds": 0
    },
    "settings": {
      "allowed_ips": {
        "ips": [],
        "protected_branches_only": false
      },
      "enable_logical_replication": false,
      "maintenance_window": {
        "weekdays": [5],
        "start_time": "07:00",
        "end_time": "08:00"
      },
      "block_public_connections": false,
      "block_vpc_connections": false,
      "hipaa": false
    },
    "pg_version": 17,
    "proxy_host": "c-2.us-west-2.aws.neon.tech",
    "branch_logical_size_limit": 512,
    "branch_logical_size_limit_bytes": 536870912,
    "store_passwords": true,
    "creation_source": "console",
    "history_retention_seconds": 86400,
    "created_at": "2025-09-10T07:58:16Z",
    "updated_at": "2025-09-10T08:08:23Z",
    "synthetic_storage_size": 0,
    "consumption_period_start": "0001-01-01T00:00:00Z",
    "consumption_period_end": "0001-01-01T00:00:00Z",
    "owner_id": "org-royal-sun-91776391",
    "compute_last_active_at": "2025-09-10T07:58:21Z",
    "org_id": "org-royal-sun-91776391"
  }
}
```

### Retrieve connection URI

1.  Action: Retrieves a ready-to-use connection URI for a specific database within a project.
2.  Endpoint: `GET /projects/{project_id}/connection_uri`
3.  Prerequisites: You must know the `project_id`, `database_name`, and `role_name`.
4.  Query Parameters:
    - `project_id` (path, required): The unique identifier of the project.
    - `database_name` (query, required): The name of the target database.
    - `role_name` (query, required): The role to use for the connection.
    - `branch_id` (query, optional): The branch ID. Defaults to the project's primary branch if not specified.
    - `pooled` (query, optional, boolean): If set to `false`, returns a direct connection URI instead of a pooled one. Defaults to `true`.
    - `endpoint_id` (query, optional): The specific endpoint ID to connect to. Defaults to the `read-write` endpoint_id associated with the `branch_id` if not specified.

Example request:

```bash
curl 'https://console.neon.tech/api/v2/projects/old-fire-32990194/connection_uri?database_name=neondb&role_name=neondb_owner' \
  -H 'Accept: application/json' \
  -H "Authorization: Bearer $NEON_API_KEY"
```

Example response:

```json
{
  "uri": "postgresql://neondb_owner:npg_IDNnorOST71P@ep-shiny-morning-a1bfdvjs-pooler.ap-southeast-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require"
}
```
