# Cloud Run IAM & security

Cloud Run uses Identity and Access Management (IAM) to secure your resources and control who can deploy or invoke them.

## Predefined IAM Roles

| Predefined Role | Usage |
| :--- | :--- |
| `roles/run.admin` | Full control over all Cloud Run resources. |
| `roles/run.invoker` | Invoke Cloud Run services and execute Cloud Run jobs. |
| `roles/run.developer` | Read and write access to services, jobs and worker pools; cannot
  set IAM policies. |
| `roles/run.viewer` | Read-only access to Cloud Run resources. |

## Types of service accounts for service identity

Cloud Run resources run as a specific service account (the service
identity).

- **User-managed service account (recommended)**: You manually create this
  service account and determine the most minimal set of permissions that
  the service account needs to access specific Google Cloud resources. The
  user-managed service account follows the format of `SERVICE_ACCOUNT_NAME@PROJECT_ID.iam.gserviceaccount.com`.

- **Compute Engine default service account:** Cloud Run automatically
  provides the Compute Engine default service account as the default
  service identity. The Compute Engine default service account
  follows the format of `PROJECT_NUMBER-compute@developer.gserviceaccount.com`.

## Best practices

By default, the Compute Engine default service account is automatically
created. If you don't specify a service account when the
Cloud Run service or job is created, Cloud Run uses this service account.
Depending on your organization policy configuration, the default
service account might automatically be granted the Editor role on your
project. We strongly recommend that you disable the automatic role
grant by enforcing the `iam.automaticIamGrantsForDefaultServiceAccounts`
organization policy constraint. If you created your organization after
May 3, 2024, this constraint is enforced by default.

Create a user-managed service account with minimal
permissions for each Cloud Run resource.

To allow a service to access another GCP resource (e.g.,
Cloud SQL), grant the service's identity the appropriate IAM role on that
resource.

## Security controls

- **Ingress Settings:** Control whether your service is reachable from the
  internet (`all`), only from within the VPC (`internal`), or via a load
  balancer (`internal-and-cloud-load-balancing`).

- **VPC Egress:** Use a VPC connector or Direct VPC egress to allow Cloud Run to
  access resources in your VPC.

- **Binary Authorization:** Ensure only trusted container images are deployed.

- **Secrets Management:** Use Secret Manager to securely pass sensitive
  information (e.g., API keys, database passwords) to your containers as
  environment variables or volumes.

## Public access

There are two ways to create a public Cloud Run service, you can either:

* Disable the Cloud Run Invoker IAM check (recommended).
* Assign the Cloud Run Invoker IAM role to the `allUsers` member type.

For more information, see:
[Cloud Run security overview](https://docs.cloud.google.com/run/docs/securing/managing-access#make-service-public).

## Configure IAP to secure access

By enabling IAP on Cloud Run directly, you can secure traffic with a single
click from all ingress paths, including default `run.app` URLs and load
balancers.

When you integrate IAP with Cloud Run, you can manage user or group access in
the following ways:

* Inside the organization - configure access to users who are within the same
  organization as your Cloud Run service

* Outside the organization - configure access to users who are from
  organizations different than your Cloud Run service

* No organization - configure access in projects that are not part of any
  Google organization

Enabling IAP on a Cloud Run service can be as easy as deploying a new service with
the following flags:

```bash
gcloud run deploy SERVICE_NAME \
  --region=REGION \
  --image=IMAGE_URL \
  --no-allow-unauthenticated \
  --iap \
  --quiet
```
