# Cloud SQL CLI Usage

The `gcloud sql` command group is used to manage Cloud SQL instances and
related resources.

## Basic Syntax

```bash
gcloud sql [GROUP] [COMMAND] [FLAGS]
```

## Essential Commands

### Instance Management

- **Create an instance:**

  ```bash
  gcloud sql instances create my-instance --database-version=MYSQL_8_0 \
      --tier=db-f1-micro --region=us-central1 \
      --quiet
  ```

- **List instances:**

  ```bash
  gcloud sql instances list --quiet
  ```

- **Describe an instance:**

  ```bash
  gcloud sql instances describe my-instance --quiet
  ```

- **Restart an instance:**

  ```bash
  gcloud sql instances restart my-instance --quiet
  ```

### Database and User Management

- **Create a database:**

  ```bash
  gcloud sql databases create my-db --instance=my-instance --quiet
  ```

- **Create a user:**

  ```bash
  gcloud sql users create my-user --instance=my-instance \
      --password=my-password \
      --quiet
  ```

### Operations and Backups

- **List operations:**

  ```bash
  gcloud sql operations list --instance=my-instance --quiet
  ```

- **Create a backup:**

  ```bash
  gcloud sql backups create --instance=my-instance --quiet
  ```

- **Restore from a backup:**

  ```bash
  gcloud sql backups restore backup_id --restore-instance=my-instance --quiet
  ```

## Common Flags

- `--project`: Specifies the project ID.

- `--region`: The region where the instance is located.

- `--format`: Changes output format (e.g., `json`, `yaml`).
