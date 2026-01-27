## Overview

This section provides rules for managing compute endpoints associated with branches in a project. Compute endpoints are Neon compute instances that allow you to connect to and interact with your databases.

## Manage compute endpoints

### Create compute endpoint

1.  Action: Creates a new compute endpoint (a Neon compute instance) and associates it with a specified branch.
2.  Endpoint: `POST /projects/{project_id}/endpoints`
3.  Path Parameters:
    - `project_id` (string, required): The unique identifier of the project.
4.  Body Parameters:
    `endpoint` (object, required): The container for the new endpoint's properties.
    - `branch_id` (string, required): The ID of the branch to associate the endpoint with.
    - `type` (string, required): The endpoint type. A branch can have only one `read_write` endpoint but multiple `read_only` endpoints. Allowed values: `read_write`, `read_only`.
    - `region_id` (string, optional): The region where the endpoint will be created. Must match the project's region.
    - `autoscaling_limit_min_cu` (number, optional): The minimum number of Compute Units (CU). Minimum `0.25`.
    - `autoscaling_limit_max_cu` (number, optional): The maximum number of Compute Units (CU). Minimum `0.25`.
    - `provisioner` (string, optional): The compute provisioner. Specify `k8s-neonvm` to enable Autoscaling. Allowed values: `k8s-pod`, `k8s-neonvm`.
    - `suspend_timeout_seconds` (integer, optional): Duration of inactivity in seconds before suspending the compute. Ranges from -1 (never suspend) to 604800 (1 week).
    - `disabled` (boolean, optional): If `true`, restricts connections to the endpoint.

Example Request:

```bash
curl 'https://console.neon.tech/api/v2/projects/hidden-river-50598307/endpoints' \
  -H 'Accept: application/json' \
  -H "Authorization: Bearer $NEON_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
  "endpoint": {
    "branch_id": "br-your-branch-id",
    "type": "read_only"
  }
}'
```

Example Response:

```json
{
  "endpoint": {
    "host": "ep-proud-mud-adwmnxz4.c-2.us-east-1.aws.neon.tech",
    "id": "ep-proud-mud-adwmnxz4",
    "project_id": "hidden-river-50598307",
    "branch_id": "br-super-wildflower-adniii9u",
    "autoscaling_limit_min_cu": 0.25,
    "autoscaling_limit_max_cu": 2,
    "region_id": "aws-us-east-1",
    "type": "read_only",
    "current_state": "init",
    "pending_state": "active",
    "settings": {},
    "pooler_enabled": false,
    "pooler_mode": "transaction",
    "disabled": false,
    "passwordless_access": true,
    "creation_source": "console",
    "created_at": "2025-09-11T06:25:12Z",
    "updated_at": "2025-09-11T06:25:12Z",
    "proxy_host": "c-2.us-east-1.aws.neon.tech",
    "suspend_timeout_seconds": 0,
    "provisioner": "k8s-neonvm"
  },
  "operations": [
    {
      "id": "4d10642f-5212-4517-ad60-afd28c9096e2",
      "project_id": "hidden-river-50598307",
      "branch_id": "br-super-wildflower-adniii9u",
      "endpoint_id": "ep-proud-mud-adwmnxz4",
      "action": "start_compute",
      "status": "running",
      "failures_count": 0,
      "created_at": "2025-09-11T06:25:12Z",
      "updated_at": "2025-09-11T06:25:12Z",
      "total_duration_ms": 0
    }
  ]
}
```

### List compute endpoints

1.  Action: Retrieves a list of all compute endpoints for the specified project.
2.  Endpoint: `GET /projects/{project_id}/endpoints`
3.  Path Parameters:
    - `project_id` (string, required): The unique identifier of the project.

Example Request:

```bash
curl 'https://console.neon.tech/api/v2/projects/hidden-river-50598307/endpoints' \
  -H 'Accept: application/json' \
  -H "Authorization: Bearer $NEON_API_KEY"
```

### Retrieve compute endpoint details

1.  Action: Retrieves detailed information about a specific compute endpoint, including its configuration (e.g., autoscaling limits), current state (`active` or `idle`), and associated branch ID.
2.  Endpoint: `GET /projects/{project_id}/endpoints/{endpoint_id}`
3.  Path Parameters:
    - `project_id` (string, required): The unique identifier of the project.
    - `endpoint_id` (string, required): The unique identifier of the compute endpoint).

Example Request:

```bash
curl 'https://console.neon.tech/api/v2/projects/hidden-river-50598307/endpoints/ep-proud-mud-adwmnxz4' \
  -H 'Accept: application/json' \
  -H "Authorization: Bearer $NEON_API_KEY"
```

### Update compute endpoint

1.  Action: Updates the configuration of a specified compute endpoint.
2.  Endpoint: `PATCH /projects/{project_id}/endpoints/{endpoint_id}`
3.  Path Parameters:
    - `project_id` (string, required): The unique identifier of the project.
    - `endpoint_id` (string, required): The unique identifier of the compute endpoint.
4.  Body Parameters:
    `endpoint` (object, required): The container for the endpoint attributes to update.
    - `autoscaling_limit_min_cu` (number, optional): A new minimum number of Compute Units (CU).
    - `autoscaling_limit_max_cu` (number, optional): A new maximum number of Compute Units (CU).
    - `suspend_timeout_seconds` (integer, optional): A new inactivity period in seconds before suspension.
    - `disabled` (boolean, optional): Set to `true` to disable connections or `false` to enable them.
    - `provisioner` (string, optional): Change the compute provisioner.

Example: Update autoscaling limits

```bash
curl -X 'PATCH' \
  'https://console.neon.tech/api/v2/projects/hidden-river-50598307/endpoints/ep-proud-mud-adwmnxz4' \
  -H 'Accept: application/json' \
  -H "Authorization: Bearer $NEON_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
  "endpoint": {
    "autoscaling_limit_min_cu": 0.5,
    "autoscaling_limit_max_cu": 1
  }
}'
```

### Delete compute endpoint

1.  Action: Deletes the specified compute endpoint. This action drops any existing network connections to the endpoint.
2.  Endpoint: `DELETE /projects/{project_id}/endpoints/{endpoint_id}`
3.  Path Parameters:
    - `project_id` (string, required): The unique identifier of the project.
    - `endpoint_id` (string, required): The unique identifier of the compute endpoint to delete.

Example Request:

```bash
curl -X 'DELETE' \
  'https://console.neon.tech/api/v2/projects/hidden-river-50598307/endpoints/ep-proud-mud-adwmnxz4' \
  -H 'Accept: application/json' \
  -H "Authorization: Bearer $NEON_API_KEY"
```

### Start compute endpoint

1.  Action: Manually starts a compute endpoint that is currently in an `idle` state. The endpoint is ready for connections once the start operation completes successfully.
2.  Endpoint: `POST /projects/{project_id}/endpoints/{endpoint_id}/start`
3.  Path Parameters:
    - `project_id` (string, required): The unique identifier of the project.
    - `endpoint_id` (string, required): The unique identifier of the compute endpoint.

Example Request:

```bash
curl -X 'POST' \
  'https://console.neon.tech/api/v2/projects/hidden-river-50598307/endpoints/ep-ancient-brook-ad5ea04d/start' \
  -H 'Accept: application/json' \
  -H "Authorization: Bearer $NEON_API_KEY"
```

### Suspend compute endpoint

1.  Action: Manually suspends an `active` compute endpoint, forcing it into an `idle` state. This will immediately drop any active connections to the endpoint.
2.  Endpoint: `POST /projects/{project_id}/endpoints/{endpoint_id}/suspend`
3.  Path Parameters:
    - `project_id` (string, required): The unique identifier of the project.
    - `endpoint_id` (string, required): The unique identifier of the compute endpoint.

Example Request:

```bash
curl -X 'POST' \
  'https://console.neon.tech/api/v2/projects/hidden-river-50598307/endpoints/ep-ancient-brook-ad5ea04d/suspend' \
  -H 'Accept: application/json' \
  -H "Authorization: Bearer $NEON_API_KEY"
```

### Restart compute endpoint

1.  Action: Restarts the specified compute endpoint. This involves an immediate suspend operation followed by a start operation. This is useful for applying configuration changes or refreshing the compute instance. All active connections will be dropped.
2.  Endpoint: `POST /projects/{project_id}/endpoints/{endpoint_id}/restart`
3.  Path Parameters:
    - `project_id` (string, required): The unique identifier of the project.
    - `endpoint_id` (string, required): The unique identifier of the compute endpoint.

Example Request:

```bash
curl -X 'POST' \
  'https://console.neon.tech/api/v2/projects/hidden-river-50598307/endpoints/ep-ancient-brook-ad5ea04d/restart' \
  -H 'Accept: application/json' \
  -H "Authorization: Bearer $NEON_API_KEY"
```
