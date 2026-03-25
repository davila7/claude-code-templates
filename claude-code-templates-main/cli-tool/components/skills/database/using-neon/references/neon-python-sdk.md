# Neon Python SDK

The `neon-api` Python SDK is a Pythonic wrapper around the Neon REST API. It provides methods for managing all Neon resources, including projects, branches, endpoints, roles, and databases.

For core concepts (Organization, Project, Branch, Endpoint, etc.), see `what-is-neon.md`.

## Documentation

```bash
curl -H "Accept: text/markdown" https://neon.tech/docs/reference/python-sdk
```

## Installation

```bash
pip install neon-api
```

## Authentication

```python
import os
from neon_api import NeonAPI

api_key = os.getenv("NEON_API_KEY")
if not api_key:
    raise ValueError("NEON_API_KEY environment variable is not set.")

neon = NeonAPI(api_key=api_key)
```

## Projects

### List Projects

```python
all_projects = neon.projects()
```

### Create Project

```python
new_project = neon.project_create(
    project={
        'name': 'my-new-project',
        'pg_version': 17
    }
)
```

### Get Project Details

```python
project = neon.project(project_id='your-project-id')
```

### Update Project

```python
neon.project_update(
    project_id='your-project-id',
    project={
        'name': 'renamed-project',
        'default_endpoint_settings': {
            'autoscaling_limit_min_cu': 1,
            'autoscaling_limit_max_cu': 2,
        }
    }
)
```

### Delete Project

```python
neon.project_delete(project_id='project-to-delete')
```

### Get Connection URI

```python
uri = neon.connection_uri(
    project_id='your-project-id',
    database_name='neondb',
    role_name='neondb_owner'
)
print(f"Connection URI: {uri.uri}")
```

## Branches

### Create Branch

```python
new_branch = neon.branch_create(
    project_id='your-project-id',
    branch={'name': 'feature-branch'},
    endpoints=[
        {'type': 'read_write', 'autoscaling_limit_max_cu': 1}
    ]
)
```

### List Branches

```python
branches = neon.branches(project_id='your-project-id')
```

### Get Branch Details

```python
branch = neon.branch(project_id='your-project-id', branch_id='br-xxx')
```

### Update Branch

```python
neon.branch_update(
    project_id='your-project-id',
    branch_id='br-xxx',
    branch={'name': 'updated-branch-name'}
)
```

### Delete Branch

```python
neon.branch_delete(project_id='your-project-id', branch_id='br-xxx')
```

## Databases

### Create Database

```python
neon.database_create(
    project_id='your-project-id',
    branch_id='br-xxx',
    database={'name': 'my-app-db', 'owner_name': 'neondb_owner'}
)
```

### List Databases

```python
databases = neon.databases(project_id='your-project-id', branch_id='br-xxx')
```

### Delete Database

```python
neon.database_delete(
    project_id='your-project-id',
    branch_id='br-xxx',
    database_id='my-app-db'
)
```

## Roles

### Create Role

```python
new_role = neon.role_create(
    project_id='your-project-id',
    branch_id='br-xxx',
    role_name='app_user'
)
print(f"Password: {new_role.role.password}")
```

### List Roles

```python
roles = neon.roles(project_id='your-project-id', branch_id='br-xxx')
```

### Delete Role

```python
neon.role_delete(
    project_id='your-project-id',
    branch_id='br-xxx',
    role_name='app_user'
)
```

## Endpoints

### Create Endpoint

```python
neon.endpoint_create(
    project_id='your-project-id',
    endpoint={
        'branch_id': 'br-xxx',
        'type': 'read_only'
    }
)
```

### Start/Suspend Endpoint

```python
# Start
neon.endpoint_start(project_id='your-project-id', endpoint_id='ep-xxx')

# Suspend
neon.endpoint_suspend(project_id='your-project-id', endpoint_id='ep-xxx')
```

### Update Endpoint

```python
neon.endpoint_update(
    project_id='your-project-id',
    endpoint_id='ep-xxx',
    endpoint={'autoscaling_limit_max_cu': 2}
)
```

### Delete Endpoint

```python
neon.endpoint_delete(project_id='your-project-id', endpoint_id='ep-xxx')
```

## API Keys

### List API Keys

```python
api_keys = neon.api_keys()
```

### Create API Key

```python
new_key = neon.api_key_create(key_name='my-script-key')
print(f"Key (store securely!): {new_key.key}")
```

### Revoke API Key

```python
neon.api_key_revoke(1234)  # key ID
```

## Operations

### List Operations

```python
ops = neon.operations(project_id='your-project-id')
```

### Get Operation Details

```python
op = neon.operation(project_id='your-project-id', operation_id='op-xxx')
```
