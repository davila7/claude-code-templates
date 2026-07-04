---
name: bigquery-basics
description: Manages datasets, tables, and jobs in BigQuery, and integrates with BigQuery ML and Gemini for advanced data analytics and AI-driven insights. Use for SQL queries, resource management, data ingestion, or AI applications on BigQuery.
source: google/skills (Apache 2.0)
---

# BigQuery Basics

BigQuery is a serverless, AI-ready data platform that enables high-speed
analysis of large datasets using SQL and Python. Its disaggregated architecture
separates compute and storage, allowing them to scale independently while
providing built-in machine learning, geospatial analysis, and business
intelligence capabilities.

## Setup and Basic Usage

1.  **Enable the BigQuery API:**
    ```bash
    gcloud services enable bigquery.googleapis.com --quiet
    ```

2.  **Create a Dataset:**
    ```bash
    bq mk --dataset --location=US my_dataset
    ```

3.  **Create a Table:**

    Create a file named `schema.json` with your table schema:

    ```json
    [
      {
        "name": "name",
        "type": "STRING",
        "mode": "REQUIRED"
      },
      {
        "name": "post_abbr",
        "type": "STRING",
        "mode": "NULLABLE"
      }
    ]
    ```

    Then create the table with the `bq` tool:

    ```bash
    bq mk --table my_dataset.mytable schema.json
    ```

4.  **Run a Query:**
    ```bash
    bq query --use_legacy_sql=false \
    'SELECT name FROM `bigquery-public-data.usa_names.usa_1910_2013` \
    WHERE state = "TX" LIMIT 10'
    ```

## Reference Directory

- [Core Concepts](references/core-concepts.md): Storage types, analytics
  workflows, and BigQuery Studio features.

- [CLI Usage](references/cli-usage.md): Essential `bq` command-line tool
  operations for managing data and jobs.

- [Client Libraries](references/client-library-usage.md): Using Google Cloud
  client libraries for Python, Java, Node.js, and Go.

- [MCP Usage](references/mcp-usage.md): Using the BigQuery remote MCP server and
  Gemini CLI extension.

- [Infrastructure as Code](references/iac-usage.md): Terraform examples for
  datasets, tables, and reservations.

- [IAM & Security](references/iam-security.md): Roles, permissions, and data
  governance best practices.

*If you need product information not found in these references, use the
Developer Knowledge MCP server `search_documents` tool.*

## Related Skills

- [BigQuery AI & ML Skill](https://github.com/google/adk-python/tree/main/src/google/adk/tools/bigquery/skills/bigquery-ai-ml):
  SKILL.md file for BigQuery AI and ML capabilities.
- [BigQuery AI & ML References](https://github.com/google/adk-python/tree/main/src/google/adk/tools/bigquery/skills/bigquery-ai-ml/references):
  Reference files published for the BigQuery AI and ML skill.
  - [bigquery_ai_classify.md](https://github.com/google/adk-python/blob/main/src/google/adk/tools/bigquery/skills/bigquery-ai-ml/references/bigquery_ai_classify.md)
  - [bigquery_ai_detect_anomalies.md](https://github.com/google/adk-python/blob/main/src/google/adk/tools/bigquery/skills/bigquery-ai-ml/references/bigquery_ai_detect_anomalies.md)
  - [bigquery_ai_forecast.md](https://github.com/google/adk-python/blob/main/src/google/adk/tools/bigquery/skills/bigquery-ai-ml/references/bigquery_ai_forecast.md)
  - [bigquery_ai_generate.md](https://github.com/google/adk-python/blob/main/src/google/adk/tools/bigquery/skills/bigquery-ai-ml/references/bigquery_ai_generate.md)
  - [bigquery_ai_generate_bool.md](https://github.com/google/adk-python/blob/main/src/google/adk/tools/bigquery/skills/bigquery-ai-ml/references/bigquery_ai_generate_bool.md)
  - [bigquery_ai_generate_double.md](https://github.com/google/adk-python/blob/main/src/google/adk/tools/bigquery/skills/bigquery-ai-ml/references/bigquery_ai_generate_double.md)
  - [bigquery_ai_generate_int.md](https://github.com/google/adk-python/blob/main/src/google/adk/tools/bigquery/skills/bigquery-ai-ml/references/bigquery_ai_generate_int.md)
  - [bigquery_ai_if.md](https://github.com/google/adk-python/blob/main/src/google/adk/tools/bigquery/skills/bigquery-ai-ml/references/bigquery_ai_if.md)
  - [bigquery_ai_score.md](https://github.com/google/adk-python/blob/main/src/google/adk/tools/bigquery/skills/bigquery-ai-ml/references/bigquery_ai_score.md)
  - [bigquery_ai_search.md](https://github.com/google/adk-python/blob/main/src/google/adk/tools/bigquery/skills/bigquery-ai-ml/references/bigquery_ai_search.md)
  - [bigquery_ai_similarity.md](https://github.com/google/adk-python/blob/main/src/google/adk/tools/bigquery/skills/bigquery-ai-ml/references/bigquery_ai_similarity.md)
