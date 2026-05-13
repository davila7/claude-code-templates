# BigQuery Client Libraries

Google Cloud client libraries provide an idiomatic way to interact with BigQuery
from your preferred programming language.

## Getting Started

To use the client libraries, ensure you have the Google Cloud SDK installed and
authenticated.
[Install Google Cloud SDK](https://cloud.google.com/sdk/docs/install)

### Python

- **Installation:**

  ```bash
  pip install --upgrade google-cloud-bigquery
  ```

- **Usage Example:**

  ```python
  from google.cloud import bigquery
  client = bigquery.Client()
  query_job = client.query("SELECT * FROM `project.dataset.table` LIMIT 10")
  results = query_job.result()
  ```

- [Python Reference](https://docs.cloud.google.com/python/docs/reference/bigquery/latest)

### Java

- **Maven Dependency:**

  ```xml
  <dependency>
    <groupId>com.google.cloud</groupId>
    <artifactId>google-cloud-bigquery</artifactId>
  </dependency>
  ```

- **Usage Example:**

  ```java
  BigQuery bigquery = BigQueryOptions.getDefaultInstance().getService();
  QueryJobConfiguration queryConfig = QueryJobConfiguration.newBuilder(
      "SELECT * FROM dataset.table").build();
  TableResult results = bigquery.query(queryConfig);
  ```

- [Java Reference](https://docs.cloud.google.com/java/docs/reference/google-cloud-bigquery/latest/overview)

### Node.js (TypeScript)

- **Installation:**

  ```bash
  npm install @google-cloud/bigquery
  ```

- **Usage Example:**

  ```typescript
  import {BigQuery} from '@google-cloud/bigquery';
  const bigquery = new BigQuery();
  const [rows] = await bigquery.query('SELECT * FROM dataset.table');
  ```

- [Node.js Reference](https://googleapis.dev/nodejs/bigquery/latest/index.html)

### Go

- **Installation:**

  ```bash
  go get cloud.google.com/go/bigquery
  ```

- **Usage Example:**

  ```go
  ctx := context.Background()
  client, _ := bigquery.NewClient(ctx, "project-id")
  q := client.Query("SELECT * FROM dataset.table")
  it, _ := q.Read(ctx)
  ```

- [Go Reference](https://docs.cloud.google.com/go/docs/reference/cloud.google.com/go/bigquery/latest)

## BigQuery DataFrames (BigFrames)

For Python users, `bigframes` provides a pandas-like API that executes directly
in BigQuery.

```bash
pip install --upgrade bigframes
```

- [BigFrames Guide](https://dataframes.bigquery.dev/)
