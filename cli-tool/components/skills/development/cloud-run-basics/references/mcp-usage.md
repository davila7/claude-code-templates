# Cloud Run MCP Usage

Cloud Run is supported by a remote Model Context Protocol (MCP) server that
enables agents to deploy, manage, and monitor serverless applications.

## MCP Tools for Cloud Run

The Cloud Run MCP server typically includes tools for:

- `get_service`: Get info about a Cloud Run service, such as its URI and
  whether the deploy succeeded.
- `list_services`: List Cloud Run services in a given Google Cloud project and
  region.
- `deploy_service_from_image`: Deploy a container image from Artifact Registry
  or Docker Hub as a Cloud Run service.
- `deploy_service_from_archive`: Deploy a Cloud Run service directly from a
  self-contained source code archive (.tar.gz), skipping the container image
  build step for faster deployment. The archive must include all dependencies.
- `deploy_service_from_file_contents`: Deploys a Cloud Run service directly from
  local source files. This method is suitable for scripting languages like Python
  and Node.js, of which the source code can be embedded in the request. This is
  ideal for quick tests and development feedback loops. You must include all
  necessary dependencies within the source files because it skips the build step
  for faster deployment.

## Setup Instructions

To connect to the Cloud Run MCP server:

1.  Enable the Cloud Run API in your Google Cloud project.
2.  Configure the agent's MCP connection using the Gemini CLI extension.
3.  Follow the setup guide:
    [Setting up Cloud Run MCP](https://docs.cloud.google.com/run/docs/reference/mcp).

## Supported Operations

Agents using the Cloud Run MCP can:

- Automate the rollout of new revisions.
- Troubleshoot failing deployments by inspecting logs and status.
- Manage scheduled jobs and verify their execution history.

Alternatively, use the [open source Cloud Run MCP server](https://github.com/GoogleCloudPlatform/cloud-run-mcp) which runs locally.
