# BigQuery Infrastructure as Code

Managing BigQuery resources using Infrastructure as Code (IaC) ensures
consistency and repeatability across environments.

## Terraform

The Google Cloud Terraform provider supports BigQuery datasets, tables, jobs,
and reservations.

### Dataset and Table Example

```terraform
resource "google_bigquery_dataset" "dataset" {
  dataset_id                  = "example_dataset"
  friendly_name               = "test"
  description                 = "This is a test description"
  location                    = "US"
  default_table_expiration_ms = 3600000

  labels = {
    env = "default"
  }
}

resource "google_bigquery_table" "default" {
  dataset_id = google_bigquery_dataset.dataset.dataset_id
  table_id   = "example_table"

  time_partitioning {
    type = "DAY"
  }

  labels = {
    env = "default"
  }

  schema = <<EOF
[
  {
    "name": "name",
    "type": "STRING",
    "mode": "REQUIRED",
    "description": "The user's name"
  },
  {
    "name": "age",
    "type": "INTEGER",
    "mode": "NULLABLE",
    "description": "The user's age"
  }
]
EOF
}
```

### Reference Documentation

- [Terraform Google Provider - BigQuery Dataset](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/bigquery_dataset)

- [Terraform Google Provider - BigQuery Table](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/bigquery_table)

- [Terraform Google Provider - BigQuery Job](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/bigquery_job)

## YAML Samples

BigQuery resources can also be managed via Deployment Manager or other tools
using YAML configurations.

- [BigQuery YAML Samples](https://docs.cloud.google.com/docs/samples?language=yaml&text=bigquery)
