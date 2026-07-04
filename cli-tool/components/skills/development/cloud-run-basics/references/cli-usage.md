# Cloud Run CLI

Use the `gcloud run` command to manage your Cloud Run applications.

## Basic Syntax

```bash
gcloud run [GROUP] [COMMAND] [FLAGS]
```

## Essential Commands

### Cloud Run service

-   **Deploy a service from an image:**

    ```bash
    gcloud run deploy my-service \
        --image us-docker.pkg.dev/cloudrun/container/hello:latest \
        --quiet
    ```

-   **Deploy from source code:**

    ```bash
    gcloud run deploy my-service --source . --quiet
    ```

-   **Deploy a Cloud Run function:** 

    ```bash
    gcloud run deploy my-service
    --source . --function example-hello --base-image go126 --region us-central1 --quiet
    ```

-   **List services:**

    ```bash
    gcloud run services list --quiet
    ```

-   **Update traffic split:**

    ```bash
    gcloud run services update-traffic my-service --to-revisions=REV1=50,REV2=50 --quiet
    ```

### Cloud Run job

-   **Create a job:**

    ```bash
    gcloud run jobs create my-job \
      --image us-docker.pkg.dev/cloudrun/container/job:latest \
      --quiet
    ```

-   **Execute a job:**

    ```bash
    gcloud run jobs execute my-job --quiet
    ```

-   **List jobs:** `gcloud run jobs list`

-   **List job executions:**

    ```bash
    gcloud run executions list --job my-job
    ```

### Cloud Run worker pools

-   **Deploy a worker pool from an image:**

    ```bash
    gcloud run worker-pools deploy my-workerpool \
      --image us-docker.pkg.dev/cloudrun/container/worker-pool:latest \
      --quiet
    ```

-   **Deploy from source code:**

    ```bash
    gcloud run worker-pools deploy my-workerpool --source . --quiet
    ```

-   **List worker pools:**

    ```bash
    gcloud run worker-pools list --region us-central1 --quiet
    ```

-   **Configure scaling (manual):**

    ```bash
    gcloud run worker-pools deploy my-workerpool --instances=5 \
      --image us-docker.pkg.dev/cloudrun/container/worker-pool:latest \
      --quiet
    ```

### Configuration and logs

-   **View more details about a service:** `gcloud run services describe my-service`

-   **View logs:**

    ```bash
    gcloud logging read "resource.type=cloud_run_revision AND \
      resource.labels.service_name=my-service" \
      --quiet
    ```

## Common Flags

-   `--region`: The region where the service or job is located.
-   `--allow-unauthenticated`: Makes the service publicly accessible.

-   `--no-allow-unauthenticated`: Restricts access to authenticated users only.
