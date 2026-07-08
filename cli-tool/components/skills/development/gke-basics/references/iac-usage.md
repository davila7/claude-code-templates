# GKE Infrastructure as Code

GKE resources, including clusters and Kubernetes objects, can be provisioned and
managed using Terraform.

## Terraform

Terraform uses two main providers for GKE:
*   The **Google Cloud provider** connects to the Google Cloud API to manage
    GKE cluster infrastructure using Terraform resources such as
    `google_container_cluster` for the cluster itself, and
    `google_container_node_pool` for nodes in Standard mode.
*   The **Kubernetes provider** connects to the Kubernetes API to manage
    workloads inside the cluster using Kubernetes resources such as
    Deployments and Services.


### GKE Autopilot Cluster Example

```hcl
resource "google_container_cluster" "primary" {
  name     = "my-gke-cluster"
  location = "us-central1"

  enable_autopilot = true

  # Do NOT specify node configurations (like initial_node_count or node_config)
  # in Autopilot mode; doing so causes a Terraform provider error.

  # Deletion protection should be set to false for testing
  deletion_protection = false
}
```

### Deploying a Workload Example (Kubernetes Provider)

```hcl
resource "kubernetes_deployment_v1" "default" {
  metadata {
    name = "hello-app"
  }
  spec {
    replicas = 2
    selector {
      match_labels = {
        app = "hello-app"
      }
    }
    template {
      metadata {
        labels = {
          app = "hello-app"
        }
      }
      spec {
        container {
          image = "us-docker.pkg.dev/google-samples/containers/gke/hello-app:2.0"
          name  = "hello-app"
        }
      }
    }
  }
}
```

### Reference Documentation

- [Terraform Google Provider - Container Cluster](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/container_cluster)

- [Terraform Google Provider - Kubernetes Provider](https://registry.terraform.io/providers/hashicorp/kubernetes/latest/docs)

## YAML Samples

GKE cluster configurations and Kubernetes manifests can also be defined using
YAML for use with `kubectl apply` or Deployment Manager.

- [GKE YAML Samples](https://docs.cloud.google.com/docs/samples?product=googlekubernetesengine)
