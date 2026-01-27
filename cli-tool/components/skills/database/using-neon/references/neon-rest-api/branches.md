## Overview

This document outlines the rules for managing branches in a Neon project using the Neon API.

## Manage branches

### Create branch

1.  Action: Creates a new branch within a specified project. By default, a branch is created from the project's default branch, but you can specify a parent branch, a point-in-time (LSN or timestamp), and attach compute endpoints.
2.  Endpoint: `POST /projects/{project_id}/branches`
3.  Path Parameters:
    - `project_id` (string, required): The unique identifier of the project where the branch will be created.
4.  Body Parameters: The request body is optional. If provided, it can contain `endpoints` and/or `branch` objects.

    `endpoints` (array of objects, optional): A list of compute endpoints to create and attach to the new branch.
    - `type` (string, required): The endpoint type. Allowed values: `read_write`, `read_only`.
    - `autoscaling_limit_min_cu` (number, optional): The minimum number of Compute Units (CU). Minimum value is `0.25`.
    - `autoscaling_limit_max_cu` (number, optional): The maximum number of Compute Units (CU). Minimum value is `0.25`.
    - `provisioner` (string, optional): The compute provisioner. Specify `k8s-neonvm` to enable Autoscaling. Allowed values: `k8s-pod`, `k8s-neonvm`.
    - `suspend_timeout_seconds` (integer, optional): Duration of inactivity in seconds before a compute is suspended. Ranges from -1 (never suspend) to 604800 (1 week). A value of `0` uses the default of 300 seconds (5 minutes).

    `branch` (object, optional): Specifies the properties of the new branch.
    - `name` (string, optional): A name for the branch (max 256 characters). If omitted, a name is auto-generated.
    - `parent_id` (string, optional): The ID of the parent branch. If omitted, the project's default branch is used as the parent.
    - `parent_lsn` (string, optional): A Log Sequence Number (LSN) from the parent branch to create the new branch from a specific point-in-time.
    - `parent_timestamp` (string, optional): An ISO 8601 timestamp (e.g., `2025-08-26T12:00:00Z`) to create the branch from a specific point-in-time.
    - `protected` (boolean, optional): If `true`, the branch is created as a protected branch.
    - `init_source` (string, optional): The source for branch initialization. `parent-data` (default) copies schema and data. `schema-only` creates a new root branch with only the schema from the specified parent.
    - `expires_at` (string, optional): An RFC 3339 timestamp for when the branch should be automatically deleted (e.g., `2025-06-09T18:02:16Z`).

Example: Create a branch from a specific parent with a read-write compute

```bash
curl 'https://console.neon.tech/api/v2/projects/hidden-river-50598307/branches' \
  -H 'Accept: application/json' \
  -H "Authorization: Bearer $NEON_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
  "endpoints": [
    {
      "type": "read_write"
    }
  ],
  "branch": {
    "parent_id": "br-super-wildflower-adniii9u",
    "name": "my-new-feature-branch"
  }
}'
```

Example response

```json
{
  "branch": {
    "id": "br-damp-glitter-adqd4hk5",
    "project_id": "hidden-river-50598307",
    "parent_id": "br-super-wildflower-adniii9u",
    "parent_lsn": "0/1A7F730",
    "name": "my-new-feature-branch",
    "current_state": "init",
    "pending_state": "ready",
    "state_changed_at": "2025-09-10T16:45:52Z",
    "creation_source": "console",
    "primary": false,
    "default": false,
    "protected": false,
    "cpu_used_sec": 0,
    "compute_time_seconds": 0,
    "active_time_seconds": 0,
    "written_data_bytes": 0,
    "data_transfer_bytes": 0,
    "created_at": "2025-09-10T16:45:52Z",
    "updated_at": "2025-09-10T16:45:52Z",
    "created_by": {
      "name": "<USER_NAME>",
      "image": "<USER_IMAGE_URL>"
    },
    "init_source": "parent-data"
  },
  "endpoints": [
    {
      "host": "ep-raspy-glade-ad8e3gvy.c-2.us-east-1.aws.neon.tech",
      "id": "ep-raspy-glade-ad8e3gvy",
      "project_id": "hidden-river-50598307",
      "branch_id": "br-damp-glitter-adqd4hk5",
      "autoscaling_limit_min_cu": 0.25,
      "autoscaling_limit_max_cu": 2,
      "region_id": "aws-us-east-1",
      "type": "read_write",
      "current_state": "init",
      "pending_state": "active",
      "settings": {},
      "pooler_enabled": false,
      "pooler_mode": "transaction",
      "disabled": false,
      "passwordless_access": true,
      "creation_source": "console",
      "created_at": "2025-09-10T16:45:52Z",
      "updated_at": "2025-09-10T16:45:52Z",
      "proxy_host": "c-2.us-east-1.aws.neon.tech",
      "suspend_timeout_seconds": 0,
      "provisioner": "k8s-neonvm"
    }
  ],
  "operations": [
    {
      "id": "cf5d0923-fc13-4125-83d5-8fc31c6b0214",
      "project_id": "hidden-river-50598307",
      "branch_id": "br-damp-glitter-adqd4hk5",
      "action": "create_branch",
      "status": "running",
      "failures_count": 0,
      "created_at": "2025-09-10T16:45:52Z",
      "updated_at": "2025-09-10T16:45:52Z",
      "total_duration_ms": 0
    },
    {
      "id": "e3c60b62-00c8-4ad4-9cd1-cdc3e8fd8154",
      "project_id": "hidden-river-50598307",
      "branch_id": "br-damp-glitter-adqd4hk5",
      "endpoint_id": "ep-raspy-glade-ad8e3gvy",
      "action": "start_compute",
      "status": "scheduling",
      "failures_count": 0,
      "created_at": "2025-09-10T16:45:52Z",
      "updated_at": "2025-09-10T16:45:52Z",
      "total_duration_ms": 0
    }
  ],
  "roles": [
    {
      "branch_id": "br-damp-glitter-adqd4hk5",
      "name": "neondb_owner",
      "protected": false,
      "created_at": "2025-09-10T12:14:58Z",
      "updated_at": "2025-09-10T12:14:58Z"
    }
  ],
  "databases": [
    {
      "id": 9554148,
      "branch_id": "br-damp-glitter-adqd4hk5",
      "name": "neondb",
      "owner_name": "neondb_owner",
      "created_at": "2025-09-10T12:14:58Z",
      "updated_at": "2025-09-10T12:14:58Z"
    }
  ],
  "connection_uris": [
    {
      "connection_uri": "postgresql://neondb_owner:npg_EwcS9IOgFfb7@ep-raspy-glade-ad8e3gvy.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require",
      "connection_parameters": {
        "database": "neondb",
        "password": "npg_EwcS9IOgFfb7",
        "role": "neondb_owner",
        "host": "ep-raspy-glade-ad8e3gvy.c-2.us-east-1.aws.neon.tech",
        "pooler_host": "ep-raspy-glade-ad8e3gvy-pooler.c-2.us-east-1.aws.neon.tech"
      }
    }
  ]
}
```

### List branches

1.  Action: Retrieves a list of branches for the specified project. Supports filtering, sorting, and pagination.
2.  Endpoint: `GET /projects/{project_id}/branches`
3.  Path Parameters:
    - `project_id` (string, required): The unique identifier of the project.
4.  Query Parameters:
    - `search` (string, optional): Filters branches by a partial match on name or ID.
    - `sort_by` (string, optional): The field to sort by. Allowed values: `name`, `created_at`, `updated_at`. Defaults to `updated_at`.
    - `sort_order` (string, optional): The sort order. Allowed values: `asc`, `desc`. Defaults to `desc`.
    - `limit` (integer, optional): The number of branches to return (1 to 10000).
    - `cursor` (string, optional): The cursor from a previous response for pagination.

Example: List all branches sorted by creation date

```bash
curl 'https://console.neon.tech/api/v2/projects/hidden-river-50598307/branches?sort_by=created_at&sort_order=asc' \
  -H 'accept: application/json' \
  -H "Authorization: Bearer $NEON_API_KEY"
```

Example response

```json
{
  "branches": [
    {
      "id": "br-long-feather-adpbgzlx",
      "project_id": "hidden-river-50598307",
      "name": "production",
      "current_state": "ready",
      "state_changed_at": "2025-09-10T12:15:01Z",
      "logical_size": 30785536,
      "creation_source": "console",
      "primary": true,
      "default": true,
      "protected": false,
      "cpu_used_sec": 82,
      "compute_time_seconds": 82,
      "active_time_seconds": 316,
      "written_data_bytes": 29060360,
      "data_transfer_bytes": 0,
      "created_at": "2025-09-10T12:14:58Z",
      "updated_at": "2025-09-10T12:35:33Z",
      "created_by": {
        "name": "<USER_NAME>",
        "image": "<USER_IMAGE_URL>"
      },
      "init_source": "parent-data"
    },
    {
      "id": "br-super-wildflower-adniii9u",
      "project_id": "hidden-river-50598307",
      "parent_id": "br-long-feather-adpbgzlx",
      "parent_lsn": "0/1A33BC8",
      "parent_timestamp": "2025-09-10T12:15:03Z",
      "name": "development",
      "current_state": "ready",
      "state_changed_at": "2025-09-10T12:15:04Z",
      "logical_size": 30842880,
      "creation_source": "console",
      "primary": false,
      "default": false,
      "protected": false,
      "cpu_used_sec": 78,
      "compute_time_seconds": 78,
      "active_time_seconds": 312,
      "written_data_bytes": 310120,
      "data_transfer_bytes": 0,
      "created_at": "2025-09-10T12:15:04Z",
      "updated_at": "2025-09-10T12:35:33Z",
      "created_by": {
        "name": "<USER_NAME>",
        "image": "<USER_IMAGE_URL>"
      },
      "init_source": "parent-data"
    }
  ],
  "annotations": {
    "br-long-feather-adpbgzlx": {
      "object": {
        "type": "console/branch",
        "id": "br-long-feather-adpbgzlx"
      },
      "value": {
        "environment": "production"
      },
      "created_at": "2025-09-10T12:14:58Z",
      "updated_at": "2025-09-10T12:14:58Z"
    }
  },
  "pagination": {
    "sort_by": "created_at",
    "sort_order": "ASC"
  }
}
```

### Retrieve branch details

1.  Action: Retrieves detailed information about a specific branch, including its parent, creation timestamp, and state.
2.  Endpoint: `GET /projects/{project_id}/branches/{branch_id}`
3.  Path Parameters:
    - `project_id` (string, required): The unique identifier of the project.
    - `branch_id` (string, required): The unique identifier of the branch.

Example Request:

```bash
curl 'https://console.neon.tech/api/v2/projects/hidden-river-50598307/branches/br-super-wildflower-adniii9u' \
  -H 'accept: application/json' \
  -H "Authorization: Bearer $NEON_API_KEY"
```

Example Response:

```json
{
  "branch": {
    "id": "br-super-wildflower-adniii9u",
    "project_id": "hidden-river-50598307",
    "parent_id": "br-long-feather-adpbgzlx",
    "parent_lsn": "0/1A33BC8",
    "parent_timestamp": "2025-09-10T12:15:03Z",
    "name": "development",
    "current_state": "ready",
    "state_changed_at": "2025-09-10T12:15:04Z",
    "logical_size": 30842880,
    "creation_source": "console",
    "primary": false,
    "default": false,
    "protected": false,
    "cpu_used_sec": 78,
    "compute_time_seconds": 78,
    "active_time_seconds": 312,
    "written_data_bytes": 310120,
    "data_transfer_bytes": 0,
    "created_at": "2025-09-10T12:15:04Z",
    "updated_at": "2025-09-10T12:35:33Z",
    "created_by": {
      "name": "<USER_NAME>",
      "image": "<USER_IMAGE_URL>"
    },
    "init_source": "parent-data"
  },
  "annotation": {
    "object": {
      "type": "console/branch",
      "id": "br-super-wildflower-adniii9u"
    },
    "value": {
      "environment": "development"
    },
    "created_at": "2025-09-10T12:15:04Z",
    "updated_at": "2025-09-10T12:15:04Z"
  }
}
```

### Update branch

1.  Action: Updates the properties of a specified branch, such as its name, protection status, or expiration time.
2.  Endpoint: `PATCH /projects/{project_id}/branches/{branch_id}`
3.  Path Parameters:
    - `project_id` (string, required): The unique identifier of the project.
    - `branch_id` (string, required): The unique identifier of the branch to update.
4.  Body Parameters:
    `branch` (object, required): The container for the branch attributes to update.
    - `name` (string, optional): A new name for the branch (max 256 characters).
    - `protected` (boolean, optional): Set to `true` to protect the branch or `false` to unprotect it.
    - `expires_at` (string or null, optional): Set a new RFC 3339 expiration timestamp or `null` to remove the expiration.

Example: Change branch name:

```bash
curl -X 'PATCH' \
  'https://console.neon.tech/api/v2/projects/hidden-river-50598307/branches/br-damp-glitter-adqd4hk5' \
  -H 'accept: application/json' \
  -H "Authorization: Bearer $NEON_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
  "branch": {
    "name": "updated-branch-name"
  }
}'
```

Example response:

```json
{
  "branch": {
    "id": "br-damp-glitter-adqd4hk5",
    "project_id": "hidden-river-50598307",
    "parent_id": "br-super-wildflower-adniii9u",
    "parent_lsn": "0/1A7F730",
    "parent_timestamp": "2025-09-10T12:15:05Z",
    "name": "updated-branch-name",
    "current_state": "ready",
    "state_changed_at": "2025-09-10T16:45:52Z",
    "logical_size": 30842880,
    "creation_source": "console",
    "primary": false,
    "default": false,
    "protected": false,
    "cpu_used_sec": 68,
    "compute_time_seconds": 68,
    "active_time_seconds": 268,
    "written_data_bytes": 0,
    "data_transfer_bytes": 0,
    "created_at": "2025-09-10T16:45:52Z",
    "updated_at": "2025-09-10T16:55:30Z",
    "created_by": {
      "name": "<USER_NAME>",
      "image": "<USER_IMAGE_URL>"
    },
    "init_source": "parent-data"
  },
  "operations": []
}
```

### Delete branch

1.  Action: Deletes the specified branch from a project. This action will also place all associated compute endpoints into an idle state, breaking any active client connections.
2.  Endpoint: `DELETE /projects/{project_id}/branches/{branch_id}`
3.  Path Parameters:
    - `project_id` (string, required): The unique identifier of the project.
    - `branch_id` (string, required): The unique identifier of the branch to delete.
4.  Constraints:
    - You cannot delete a project's root or default branch.
    - You cannot delete a branch that has child branches. You must delete all child branches first.

Example Request:

```bash
curl -X 'DELETE' \
  'https://console.neon.tech/api/v2/projects/{project_id}/branches/{branch_id}' \
  -H 'accept: application/json' \
  -H "Authorization: Bearer $NEON_API_KEY"
```

### List branch endpoints

1.  Action: Retrieves a list of all compute endpoints that are associated with a specific branch.
2.  Endpoint: `GET /projects/{project_id}/branches/{branch_id}/endpoints`
3.  Path Parameters:
    - `project_id` (string, required): The unique identifier of the project.
    - `branch_id` (string, required): The unique identifier of the branch whose endpoints you want to list.
4.  A branch can have one `read_write` compute endpoint and multiple `read_only` endpoints. This method returns an array of all endpoints currently attached to the specified branch.

Example Request:

```bash
curl 'https://console.neon.tech/api/v2/projects/hidden-river-50598307/branches/br-super-wildflower-adniii9u/endpoints' \
  -H 'accept: application/json' \
  -H "Authorization: Bearer $NEON_API_KEY"
```

## Manage databases

### Create database

1.  Action: Creates a new database within a specified branch. A branch can contain multiple databases.
2.  Endpoint: `POST /projects/{project_id}/branches/{branch_id}/databases`
3.  Path Parameters:
    - `project_id` (string, required): The unique identifier of the project.
    - `branch_id` (string, required): The unique identifier of the branch where the database will be created.
4.  Body Parameters:
    `database` (object, required): The container for the new database's properties.
    - `name` (string, required): The name for the new database.
    - `owner_name` (string, required): The name of an existing role that will own the database.

Example Request:

```bash
curl 'https://console.neon.tech/api/v2/projects/hidden-river-50598307/branches/br-super-wildflower-adniii9u/databases' \
  -H 'Accept: application/json' \
  -H "Authorization: Bearer $NEON_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
  "database": {
    "name": "my_new_app_db",
    "owner_name": "app_owner_role"
  }
}'
```

### List databases

1.  Action: Retrieves a list of all databases within a specified branch.
2.  Endpoint: `GET /projects/{project_id}/branches/{branch_id}/databases`
3.  Path Parameters:
    - `project_id` (string, required): The unique identifier of the project.
    - `branch_id` (string, required): The unique identifier of the branch.

Example Request:

```bash
curl 'https://console.neon.tech/api/v2/projects/hidden-river-50598307/branches/br-super-wildflower-adniii9u/databases' \
  -H 'Accept: application/json' \
  -H "Authorization: Bearer $NEON_API_KEY"
```

### Retrieve database details

1.  Action: Retrieves detailed information about a specific database within a branch.
2.  Endpoint: `GET /projects/{project_id}/branches/{branch_id}/databases/{database_name}`
3.  Path Parameters:
    - `project_id` (string, required): The unique identifier of the project.
    - `branch_id` (string, required): The unique identifier of the branch.
    - `database_name` (string, required): The name of the database.

### Update database

1.  Action: Updates the properties of a specified database, such as its name or owner.
2.  Endpoint: `PATCH /projects/{project_id}/branches/{branch_id}/databases/{database_name}`
3.  Path Parameters:
    - `project_id` (string, required): The unique identifier of the project.
    - `branch_id` (string, required): The unique identifier of the branch.
    - `database_name` (string, required): The current name of the database to update.
4.  Body Parameters:
    `database` (object, required): The container for the database attributes to update.
    - `name` (string, optional): A new name for the database.
    - `owner_name` (string, optional): The name of a different existing role to become the new owner.

### Delete database

1.  Action: Deletes the specified database from a branch. This action is permanent and cannot be undone.
2.  Endpoint: `DELETE /projects/{project_id}/branches/{branch_id}/databases/{database_name}`
3.  Path Parameters:
    - `project_id` (string, required): The unique identifier of the project.
    - `branch_id` (string, required): The unique identifier of the branch.
    - `database_name` (string, required): The name of the database to delete.

## Manage roles

### Create role

1.  Action: Creates a new Postgres role in a specified branch. This action may drop existing connections to the active compute endpoint.
2.  Endpoint: `POST /projects/{project_id}/branches/{branch_id}/roles`
3.  Path Parameters:
    - `project_id` (string, required): The unique identifier of the project.
    - `branch_id` (string, required): The unique identifier of the branch where the role will be created.
4.  Body Parameters:
    `role` (object, required): The container for the new role's properties.
    - `name` (string, required): The name for the new role. Cannot exceed 63 bytes in length.
    - `no_login` (boolean, optional): If `true`, creates a role that cannot be used to log in. Defaults to `false`.

Example Request:

```bash
curl 'https://console.neon.tech/api/v2/projects/hidden-river-50598307/branches/br-super-wildflower-adniii9u/roles' \
  -H 'Accept: application/json' \
  -H "Authorization: Bearer $NEON_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
  "role": {
    "name": "new_app_user"
  }
}'
```

### List roles

1.  Action: Retrieves a list of all Postgres roles from the specified branch.
2.  Endpoint: `GET /projects/{project_id}/branches/{branch_id}/roles`
3.  Path Parameters:
    - `project_id` (string, required): The unique identifier of the project.
    - `branch_id` (string, required): The unique identifier of the branch.

### Retrieve role details

1.  Action: Retrieves detailed information about a specific Postgres role within a branch.
2.  Endpoint: `GET /projects/{project_id}/branches/{branch_id}/roles/{role_name}`
3.  Path Parameters:
    - `project_id` (string, required): The unique identifier of the project.
    - `branch_id` (string, required): The unique identifier of the branch.
    - `role_name` (string, required): The name of the role.

### Delete role

1.  Action: Deletes the specified Postgres role from the branch. This action is permanent.
2.  Endpoint: `DELETE /projects/{project_id}/branches/{branch_id}/roles/{role_name}`
3.  Path Parameters:
    - `project_id` (string, required): The unique identifier of the project.
    - `branch_id` (string, required): The unique identifier of the branch.
    - `role_name` (string, required): The name of the role to delete.
