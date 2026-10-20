# BigQuery CLI Usage

The `bq` command-line tool is used to interact with BigQuery for managing
resources and running jobs.

## Basic Syntax

```bash
bq COMMAND [FLAGS] [ARGUMENTS]
```

## Essential Commands

### Dataset Management

- **Create a dataset:**

  ```bash
  bq mk --dataset --location=us my_dataset
  ```

- **List datasets:**

  ```bash
  bq ls --project_id my_project
  ```

### Table Management

- **Create a table from a schema file:**

  ```bash
  bq mk --table my_dataset.my_table schema.json
  ```

- **Copy a table within or across datasets:**

  ```bash
  bq cp my_dataset.my_table my_other_dataset.my_table_copy
  ```

- **Create a table snapshot (read-only copy):**

  ```bash
  bq cp --snapshot --no_clobber my_dataset.my_table my_other_dataset.my_table_snapshot
  ```

- **Load data from Cloud Storage (CSV):**

  ```bash
  bq load --source_format=CSV my_dataset.my_table gs://my-bucket/data.csv
  ```

- **Stream data into a table from a newline-delimited JSON file:**

  ```bash
  bq insert my_dataset.my_table data.json
  ```

- **Delete a table:**

  ```bash
  bq rm -f my_dataset.my_table
  ```

### Querying Data

- **Run a standard SQL query:**

  ```bash
  bq query --use_legacy_sql=false \
  'SELECT count(*) FROM `my_project.my_dataset.my_table`'
  ```

- **Run a dry run to estimate bytes processed:**

  ```bash
  bq query --use_legacy_sql=false --dry_run \
  'SELECT * FROM `my_project.my_dataset.my_table`'
  ```

### Job Management

- **List recent jobs:**

  ```bash
  bq ls -j
  ```

- **Show job details:**

  ```bash
  bq show -j job_id
  ```

- **Cancel a job:**

  ```bash
  bq cancel job_id
  ```

## Global Flags

- `--location`: Specifies the geographic location for the job or resource.

- `--project_id`: Overrides the default project for the command.

- `--format`: Changes output format (e.g., `prettyjson`, `sparse`, `csv`).

For the complete BigQuery CLI reference guide, visit:
[bq command-line tool reference](https://docs.cloud.google.com/bigquery/docs/reference/bq-cli-reference).
