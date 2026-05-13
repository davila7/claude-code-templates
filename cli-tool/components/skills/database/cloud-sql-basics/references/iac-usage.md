# Cloud SQL Infrastructure as Code

Cloud SQL resources can be provisioned and managed using Terraform and other IaC
tools.

## Terraform

The Google Cloud Terraform provider supports Cloud SQL instances, databases, and
users.

### Cloud SQL Instance Example

```terraform
resource "google_sql_database_instance" "default" {
  name             = "master-instance"
  region           = "us-central1"
  database_version = "POSTGRES_15"

  settings {
    tier = "db-f1-micro"
    backup_configuration {
      enabled = true
    }
  }
}

resource "google_sql_database" "database" {
  name     = "my-database"
  instance = google_sql_database_instance.default.name
}

resource "google_sql_user" "users" {
  name     = "me"
  instance = google_sql_database_instance.default.name
  password = "changeme"
}
```

### Reference Documentation

- [Terraform Google Provider - SQL Database Instance](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/sql_database_instance)

- [Terraform Google Provider - SQL Database](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/sql_database)

- [Terraform Google Provider - SQL User](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/sql_user)

