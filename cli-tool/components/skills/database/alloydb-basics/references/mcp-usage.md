# AlloyDB MCP Usage

AlloyDB supports a remote Model Context Protocol (MCP) server, allowing AI
applications to interact with AlloyDB resources.

## Endpoint

The AlloyDB MCP server endpoint is regional:
`https://alloydb.REGION.rep.googleapis.com/mcp`

Replace `REGION` with the regional location of the endpoint (e.g.,
`us-central1`).

## Setup and Authentication

1. Enable the AlloyDB API in your project.
2. Grant the `roles/mcp.toolUser` role to the principal making the tool calls.
3. Configure your MCP host to point to the regional endpoint.

For more details, see the [Use the AlloyDB remote MCP
server](https://cloud.google.com/alloydb/docs/ai/use-alloydb-mcp) guide.

## Resources

- [AlloyDB MCP Reference](https://cloud.google.com/alloydb/docs/reference/mcp)
- [MCP Toolbox](https://mcp-toolbox.dev/): An open-source alternative to the remote MCP server that runs on a local machine or IDE.
    - [MCP Toolbox AlloyDB Integration](https://mcp-toolbox.dev/integrations/alloydb/source/)
    - [Configure your MCP client](https://docs.cloud.google.com/alloydb/docs/connect-ide-using-mcp-toolbox#configure-your-mcp-client)
- For additional specialized skills including health auditing, performance monitoring, and lifecycle management, install the [AlloyDB for PostgreSQL](https://github.com/gemini-cli-extensions/alloydb) Gemini CLI extension or Claude Plugin.
