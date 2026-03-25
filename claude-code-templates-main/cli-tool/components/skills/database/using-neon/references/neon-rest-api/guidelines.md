## Overview

This document provides a comprehensive set of rules and guidelines for an AI agent to interact with the Neon API. The Neon API is a RESTful service that allows for programmatic management of all Neon resources. Adherence to these rules ensures correct, efficient, and safe API usage.

### General API guidelines

All Neon API requests must be made to the following base URL:

```
https://console.neon.tech/api/v2/
```

To construct a full request URL, append the specific endpoint path to this base URL.

### Authentication

- All API requests must be authenticated using a Neon API key.
- The API key must be included in the `Authorization` header using the `Bearer` authentication scheme.
- The header should be formatted as: `Authorization: Bearer $NEON_API_KEY`, where `$NEON_API_KEY` is a valid Neon API key.
- A request without a valid `Authorization` header will fail with a `401 Unauthorized` status code.

### API rate limiting

- Neon limits API requests to 700 requests per minute (approximately 11 per second).
- Bursts of up to 40 requests per second per route are permitted.
- If the rate limit is exceeded, the API will respond with an `HTTP 429 Too Many Requests` error.
- Your application logic must handle `429` errors and implement a retry strategy with appropriate backoff.

### Neon Core Concepts

To effectively use the Neon Python SDK, it's essential to understand the hierarchy and purpose of its core resources. The following table provides a high-level overview of each concept.

| Concept          | Description                                                                                                                        | Analogy/Purpose                                                                                                 | Key Relationship                                                                                      |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Organization     | The highest-level container, managing billing, users, and multiple projects.                                                       | A GitHub Organization or a company's cloud account.                                                             | Contains one or more Projects.                                                                        |
| Project          | The primary container that contains all related database resources for a single application or service.                            | A Git repository or a top-level folder for an application.                                                      | Lives within an Organization (or a personal account). Contains Branches.                              |
| Branch           | A lightweight, copy-on-write clone of a database's state at a specific point in time.                                              | A `git branch`. Used for isolated development, testing, staging, or previews without duplicating storage costs. | Belongs to a Project. Contains its own set of Databases and Roles, cloned from its parent.            |
| Compute Endpoint | The actual running PostgreSQL instance that you connect to. It provides the CPU and RAM for processing queries.                    | The "server" or "engine" for your database. It can be started, suspended (scaled to zero), and resized.         | Is attached to a single Branch. Your connection string points to a Compute Endpoint's hostname.       |
| Database         | A logical container for your data (tables, schemas, views) within a branch. It follows standard PostgreSQL conventions.            | A single database within a PostgreSQL server instance.                                                          | Exists within a Branch. A branch can have multiple databases.                                         |
| Role             | A PostgreSQL role used for authentication (logging in) and authorization (permissions to access data).                             | A database user account with a username and password.                                                           | Belongs to a Branch. Roles from a parent branch are copied to child branches upon creation.           |
| API Key          | A secret token used to authenticate requests to the Neon API. Keys have different scopes (Personal, Organization, Project-scoped). | A password for programmatic access, allowing you to manage all other Neon resources.                            | Authenticates actions on Organizations, Projects, Branches, etc.                                      |
| Operation        | An asynchronous action performed by the Neon control plane, such as creating a branch or starting a compute.                       | A background job or task. Its status can be polled to know when an action is complete.                          | Associated with a Project and often a specific Branch or Endpoint. Essential for scripting API calls. |

### Understanding API key types

When performing actions via the API, you must select the correct type of API key based on the required scope and permissions. There are three types:

1. Personal API Key

- Scope: Accesses all projects that the user who created the key is a member of.
- Permissions: The key has the same permissions as its owner. If the user's access is revoked from an organization, the key loses access too.
- Best For: Individual use, scripting, and tasks tied to a specific user's permissions.
- Created By: Any user.

2. Organization API Key

- Scope: Accesses all projects and resources within an entire organization.
- Permissions: Has admin-level access across the organization, independent of any single user. It remains valid even if the creator leaves the organization.
- Best For: CI/CD pipelines, organization-wide automation, and service accounts that need broad access.
- Created By: Organization administrators only.

3. Project-scoped API Key

- Scope: Access is strictly limited to a single, specified project.
- Permissions: Cannot perform organization-level actions (like creating new projects) or delete the project it is scoped to. This is the most secure and limited key type.
- Best For: Project-specific integrations, third-party services, or automation that should be isolated to one project.
- Created By: Any organization member.
