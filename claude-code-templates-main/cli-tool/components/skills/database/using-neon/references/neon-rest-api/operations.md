## Overview

This document outlines the rules for managing and monitoring long-running operations in Neon, including branch creation and compute management.

## Operations

An operation is an action performed by the Neon Control Plane (e.g., `create_branch`, `start_compute`). When using the API programmatically, it is crucial to monitor the status of long-running operations to ensure one has completed before starting another that depends on it. Operations older than 6 months may be deleted from Neon's systems.

### List operations

1.  Action: Retrieves a list of operations for the specified Neon project. The number of operations can be large, so pagination is recommended.
2.  Endpoint: `GET /projects/{project_id}/operations`
3.  Path Parameters:
    - `project_id` (string, required): The unique identifier of the project whose operations you want to list.
4.  Query Parameters:
    - `limit` (integer, optional): The number of operations to return in the response. Must be between 1 and 1000.
    - `cursor` (string, optional): The cursor value from a previous response to fetch the next page of operations.
5.  Procedure:
    - Make an initial request with a `limit` to get the first page of results.
    - The response will contain a `pagination.cursor` value.
    - To get the next page, make a subsequent request including both the `limit` and the `cursor` from the previous response.

Example request

```bash
curl 'https://console.neon.tech/api/v2/projects/hidden-river-50598307/operations' \
  -H 'Accept: application/json' \
  -H "Authorization: Bearer $NEON_API_KEY"
```

Example response

```json
{
  "operations": [
    {
      "id": "639f7f73-0b76-4749-a767-2d3c627ca5a6",
      "project_id": "hidden-river-50598307",
      "branch_id": "br-long-feather-adpbgzlx",
      "endpoint_id": "ep-round-morning-adtpn2oc",
      "action": "apply_config",
      "status": "finished",
      "failures_count": 0,
      "created_at": "2025-09-10T12:15:23Z",
      "updated_at": "2025-09-10T12:15:23Z",
      "total_duration_ms": 87
    },
    {
      "id": "b5a7882b-a5b3-4292-ad27-bffe733feae4",
      "project_id": "hidden-river-50598307",
      "branch_id": "br-super-wildflower-adniii9u",
      "endpoint_id": "ep-ancient-brook-ad5ea04d",
      "action": "apply_config",
      "status": "finished",
      "failures_count": 0,
      "created_at": "2025-09-10T12:15:23Z",
      "updated_at": "2025-09-10T12:15:23Z",
      "total_duration_ms": 49
    },
    {
      "id": "36a1cba0-97f1-476d-af53-d9e0d3a3606d",
      "project_id": "hidden-river-50598307",
      "branch_id": "br-super-wildflower-adniii9u",
      "endpoint_id": "ep-ancient-brook-ad5ea04d",
      "action": "start_compute",
      "status": "finished",
      "failures_count": 0,
      "created_at": "2025-09-10T12:15:04Z",
      "updated_at": "2025-09-10T12:15:05Z",
      "total_duration_ms": 913
    },
    {
      "id": "409c35ef-cbc3-4f1b-a4ca-f2de319f5360",
      "project_id": "hidden-river-50598307",
      "branch_id": "br-super-wildflower-adniii9u",
      "action": "create_branch",
      "status": "finished",
      "failures_count": 0,
      "created_at": "2025-09-10T12:15:04Z",
      "updated_at": "2025-09-10T12:15:04Z",
      "total_duration_ms": 136
    },
    {
      "id": "274e240f-e2fb-4719-b796-c1ab7c4ae91c",
      "project_id": "hidden-river-50598307",
      "branch_id": "br-long-feather-adpbgzlx",
      "endpoint_id": "ep-round-morning-adtpn2oc",
      "action": "start_compute",
      "status": "finished",
      "failures_count": 0,
      "created_at": "2025-09-10T12:14:58Z",
      "updated_at": "2025-09-10T12:15:03Z",
      "total_duration_ms": 4843
    },
    {
      "id": "22ef6fbd-21c5-4cdb-9825-b0f9afddbb0d",
      "project_id": "hidden-river-50598307",
      "branch_id": "br-long-feather-adpbgzlx",
      "action": "create_timeline",
      "status": "finished",
      "failures_count": 0,
      "created_at": "2025-09-10T12:14:58Z",
      "updated_at": "2025-09-10T12:15:01Z",
      "total_duration_ms": 3096
    }
  ],
  "pagination": {
    "cursor": "2025-09-10T12:14:58.848485Z"
  }
}
```

### Retrieve operation details

1.  Action: Retrieves the details and status of a single, specified operation. The `operation_id` is found in the response body of the initial API call that initiated it, or by listing operations.
2.  Endpoint: `GET /projects/{project_id}/operations/{operation_id}`
3.  Path Parameters:
    - `project_id` (string, required): The unique identifier of the project where the operation occurred.
    - `operation_id` (UUID, required): The unique identifier of the operation. This ID is returned in the response body of the API call that initiated the operation.

Example request:

```bash
curl 'https://console.neon.tech/api/v2/projects/hidden-river-50598307/operations/274e240f-e2fb-4719-b796-c1ab7c4ae91c' \
  -H 'Accept: application/json' \
  -H "Authorization: Bearer $NEON_API_KEY"
```

Example response:

```json
{
  "operation": {
    "id": "274e240f-e2fb-4719-b796-c1ab7c4ae91c",
    "project_id": "hidden-river-50598307",
    "branch_id": "br-long-feather-adpbgzlx",
    "endpoint_id": "ep-round-morning-adtpn2oc",
    "action": "start_compute",
    "status": "finished",
    "failures_count": 0,
    "created_at": "2025-09-10T12:14:58Z",
    "updated_at": "2025-09-10T12:15:03Z",
    "total_duration_ms": 4843
  }
}
```
