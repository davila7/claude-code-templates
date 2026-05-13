# BigQuery MCP Usage

BigQuery is supported by a remote Model Context Protocol (MCP) server that
provides a set of tools for automated data management and analysis.

## MCP Tools for BigQuery

- **list_dataset_ids:** List BigQuery dataset IDs in a Google Cloud project.
- **get_dataset_info:** Get metadata information about a BigQuery dataset.
- **list_table_ids:** List table ids in a BigQuery dataset.
- **get_table_info:** Get metadata information about a BigQuery table.
- **execute_sql:** Run a SQL query in the project and return the result. This
tool is restricted to only `SELECT` statements. `INSERT`, `UPDATE`, and
`DELETE` statements and stored procedures aren't allowed. If the query
doesn't include a `SELECT` statement, an error is returned. For information
on creating queries, see the GoogleSQL documentation. The `execute_sql` tool
can also have side effects if the query invokes remote functions or Python
UDFs. All queries that are run using the `execute_sql` tool have a label that
identifies the tool as the source. You can use this label to filter the
queries using the label and value pair `goog-mcp-server: true`. Queries are
charged to the project specified in the `project_id` field.

## Setup Instructions

To connect to the BigQuery MCP server, see [Configure a client connection](https://docs.cloud.google.com/bigquery/docs/use-bigquery-mcp#configure-client).

## Supported Operations

Agents using the BigQuery MCP remote server can perform tasks such as:

- Answering questions about data by generating and running SQL.
- Getting dataset metadata.
- Getting table metadata.

For more information about the BigQuery MCP server, visit:
[Use the BigQuery MCP server](https://docs.cloud.google.com/bigquery/docs/use-bigquery-mcp).
Alternatively, you can use
[MCP Toolbox](https://mcp-toolbox.dev/integrations/bigquery/source/), an
open-source CLI tool that runs a local MCP server for BigQuery connections. For
more on connecting BigQuery to your tools, see
[Connect LLMs to BigQuery with MCP](https://docs.cloud.google.com/bigquery/docs/pre-built-tools-with-mcp-toolbox)
for details. For additional specialized skills and advanced analytics workflows,
install the
[BigQuery Data Analytics extension](https://github.com/gemini-cli-extensions/bigquery-data-analytics)
for the Gemini CLI or plugin for Claude Code and Codex.
