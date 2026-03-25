# Neon TypeScript SDK

The `@neondatabase/api-client` TypeScript SDK is a typed wrapper around the Neon REST API. It provides methods for managing all Neon resources, including projects, branches, endpoints, roles, and databases.

For core concepts (Organization, Project, Branch, Endpoint, etc.), see `what-is-neon.md`.

## Documentation

```bash
curl -H "Accept: text/markdown" https://neon.tech/docs/reference/typescript-sdk
```

## Installation

```bash
npm install @neondatabase/api-client
```

## Authentication

```typescript
import { createApiClient } from "@neondatabase/api-client";

const apiKey = process.env.NEON_API_KEY;
if (!apiKey) {
  throw new Error("NEON_API_KEY environment variable is not set.");
}

const apiClient = createApiClient({ apiKey });
```

## Projects

### List Projects

```typescript
const response = await apiClient.listProjects({});
console.log("Projects:", response.data.projects);
```

### Create Project

```typescript
const response = await apiClient.createProject({
  project: { name: "my-project", pg_version: 17, region_id: "aws-us-east-2" },
});
console.log(
  "Connection URI:",
  response.data.connection_uris[0]?.connection_uri,
);
```

### Get Project

```typescript
const response = await apiClient.getProject("your-project-id");
```

### Update Project

```typescript
await apiClient.updateProject("your-project-id", {
  project: { name: "new-name" },
});
```

### Delete Project

```typescript
await apiClient.deleteProject("project-id");
```

### Get Connection URI

```typescript
const response = await apiClient.getConnectionUri({
  projectId: "your-project-id",
  database_name: "neondb",
  role_name: "neondb_owner",
  pooled: true,
});
console.log("URI:", response.data.uri);
```

## Branches

### Create Branch

```typescript
import { EndpointType } from "@neondatabase/api-client";

const response = await apiClient.createProjectBranch("your-project-id", {
  branch: { name: "feature-branch" },
  endpoints: [{ type: EndpointType.ReadWrite, autoscaling_limit_max_cu: 1 }],
});
```

### List Branches

```typescript
const response = await apiClient.listProjectBranches({
  projectId: "your-project-id",
});
```

### Get Branch

```typescript
const response = await apiClient.getProjectBranch("your-project-id", "br-xxx");
```

### Update Branch

```typescript
await apiClient.updateProjectBranch("your-project-id", "br-xxx", {
  branch: { name: "updated-name" },
});
```

### Delete Branch

```typescript
await apiClient.deleteProjectBranch("your-project-id", "br-xxx");
```

## Databases

### Create Database

```typescript
await apiClient.createProjectBranchDatabase("your-project-id", "br-xxx", {
  database: { name: "my-app-db", owner_name: "neondb_owner" },
});
```

### List Databases

```typescript
const response = await apiClient.listProjectBranchDatabases(
  "your-project-id",
  "br-xxx",
);
```

### Delete Database

```typescript
await apiClient.deleteProjectBranchDatabase(
  "your-project-id",
  "br-xxx",
  "my-app-db",
);
```

## Roles

### Create Role

```typescript
const response = await apiClient.createProjectBranchRole(
  "your-project-id",
  "br-xxx",
  {
    role: { name: "app_user" },
  },
);
console.log("Password:", response.data.role.password);
```

### List Roles

```typescript
const response = await apiClient.listProjectBranchRoles(
  "your-project-id",
  "br-xxx",
);
```

### Delete Role

```typescript
await apiClient.deleteProjectBranchRole(
  "your-project-id",
  "br-xxx",
  "app_user",
);
```

## Endpoints

### Create Endpoint

```typescript
import { EndpointType } from "@neondatabase/api-client";

const response = await apiClient.createProjectEndpoint("your-project-id", {
  endpoint: { branch_id: "br-xxx", type: EndpointType.ReadOnly },
});
```

### List Endpoints

```typescript
const response = await apiClient.listProjectEndpoints("your-project-id");
```

### Start/Suspend/Restart Endpoint

```typescript
// Start
await apiClient.startProjectEndpoint("your-project-id", "ep-xxx");

// Suspend
await apiClient.suspendProjectEndpoint("your-project-id", "ep-xxx");

// Restart
await apiClient.restartProjectEndpoint("your-project-id", "ep-xxx");
```

### Update Endpoint

```typescript
await apiClient.updateProjectEndpoint("your-project-id", "ep-xxx", {
  endpoint: { autoscaling_limit_max_cu: 2 },
});
```

### Delete Endpoint

```typescript
await apiClient.deleteProjectEndpoint("your-project-id", "ep-xxx");
```

## API Keys

### List API Keys

```typescript
const response = await apiClient.listApiKeys();
```

### Create API Key

```typescript
const response = await apiClient.createApiKey({ key_name: "my-script-key" });
console.log("Key:", response.data.key); // Store securely!
```

### Revoke API Key

```typescript
await apiClient.revokeApiKey(1234);
```

## Operations

### List Operations

```typescript
const response = await apiClient.listProjectOperations({
  projectId: "your-project-id",
});
```

### Get Operation

```typescript
const response = await apiClient.getProjectOperation(
  "your-project-id",
  "op-xxx",
);
```

## Organizations

### Get Organization

```typescript
const response = await apiClient.getOrganization("org-xxx");
```

### List Members

```typescript
const response = await apiClient.getOrganizationMembers("org-xxx");
```

### Create Org API Key

```typescript
const response = await apiClient.createOrgApiKey("org-xxx", {
  key_name: "ci-key",
  project_id: "project-xxx", // Optional: scope to project
});
```

### Invite Member

```typescript
import { MemberRole } from "@neondatabase/api-client";

await apiClient.createOrganizationInvitations("org-xxx", {
  invitations: [{ email: "dev@example.com", role: MemberRole.Member }],
});
```

## Error Handling

```typescript
async function safeApiOperation(projectId: string) {
  try {
    const response = await apiClient.getProject(projectId);
    return response.data;
  } catch (error: any) {
    if (error.isAxiosError) {
      const status = error.response?.status;
      switch (status) {
        case 401:
          console.error("Check your NEON_API_KEY");
          break;
        case 404:
          console.error("Resource not found");
          break;
        case 429:
          console.error("Rate limit exceeded");
          break;
        default:
          console.error("API error:", error.response?.data?.message);
      }
    }
    return null;
  }
}
```
