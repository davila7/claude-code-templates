# Cloud Run core concepts

Cloud Run is a fully managed application platform for running your code,
function, or container on top of Google's highly scalable infrastructure. On
Cloud Run, your code can run as a service, job, or worker pool. All of these
resource types are running sandboxed container instances in the same execution
environment and can integrate with Google Cloud services.

## Services vs. Jobs vs. Worker pools

-   **Cloud Run services:** Used for code that handles requests or events (e.g.,
    web apps, APIs). They provide an HTTPS endpoint and automatically scale
    based on traffic.

-   **Cloud Run jobs:** Used for code that performs a specific task and then
    exits (e.g., data processing, database migrations). They can run a single
    task or an array of parallel tasks.

-   **Cloud Run worker pools:** Designed for continuous, non-HTTP, pull-based
    background processing (e.g., Kafka consumers).

## Resource model

Cloud Run organizes resources as follows:

1.  **Service** The top-level resource. You can deploy a service from a
    container, repository, or source code.
                    1.  **Revision:** An immutable snapshot of a service's
                        configuration and container image. Each service
                        deployment creates a new revision.
                    1.  **Service instances:** The running container that
                        processes requests. Each service revision receiving
                        requests is automatically scaled to the number of
                        instances needed to handle all these requests.
                    1.  **Cloud Run functions**: Deploy functions as Cloud Run
                        services. You can deploy single-purpose functions that
                        respond to events emitted from your cloud infrastructure
                        and services

1.  **Job**: Executes one or more containers to completion. A job consists of
    one or multiple independent tasks that are executed in parallel in a given
    job execution.

1.  **Worker pools**: If your code processes workloads from an external source
    but not from an HTTP request, such as pulling work from a message queue, you
    can deploy it to a Cloud Run worker pool .

## Autoscaling for Cloud Run services

Cloud Run services scale automatically based on:

-   **Request concurrency:** The number of concurrent requests per instance.
-   **CPU utilization:**: The average CPU utilization of existing instances over
    a one minute window.
-   **Scale to zero:** Cloud Run autoscales from one to zero instances only
    after verifying that an instance is no longer processing requests. If you
    use instance-based billing, Cloud Run instances are charged for the entire
    lifecycle of instances, even when there are no incoming requests.

## Container contract 

Your container image can run code written in the programming language
of your choice and use any base image, provided that it respects the
constraints listed in the [Container runtime contract](https://docs.cloud.google.com/run/docs/container-contract).

Executables in the container image must be compiled for
Linux 64-bit. Cloud Run specifically supports the Linux x86_64 ABI format.

Cloud Run accepts container images in the Docker Imag
 Manifest V2, Schema 1, Schema 2, and OCI image formats. Cloud Run
also accepts Zstd compressed container images.

If deploying a multi-architecture image, the manifest list must include
linux/amd64.

For functions deployed with Cloud Run, you can use one of the
Cloud Run runtime base images that are published by Google
Cloud's buildpacks to receive automatic security and maintenance updates.
For more information about the supported runtimes, see the [Runtime support schedule](https://docs.cloud.google.com/run/docs/runtime-support).

### Container requirements

When deploying containers to Cloud Run, the following requirements must be met:

* Container deployed to services must listen for requests on the correct port
* A Cloud Run service starts Cloud Run instances to handle incoming
  requests. A Cloud Run instance always has one single ingress
  container that listens for requests, and optionally one or more
  sidecar containers. The following port configuration details
  apply only to the ingress container, not to sidecars.
* The ingress container within an instance must listen for
  requests on `0.0.0.0` on the port to which requests are sent. Notably,
  the ingress container should not listen on `127.0.0.1`. By default, request
  are sent to 8080, but you can configure Cloud Run to send requests to the port of your choice.
  Cloud Run injects the PORT environment variable into the ingress container.

## VPC network connectivity

Cloud Run services and jobs support Direct VPC egress. This means
that they can send traffic to private resources within your
configured VPC network, such as databases or internal services. Cloud Run
services and jobs don't support Direct VPC ingress.
Cloud Run worker pools support both Direct VPC egress and Direct VPC
ingress. When you configure Direct VPC for your Cloud Run worker pool
deployment, each worker instance receives a private IP address on the
configured network and subnet. Only resources from your VPC network can
connect to the worker pool private IP address endpoint. For more information
about obtaining the private IP addresses of your worker pool instance, see
[Retrieve the private IP addresses using the metadata server (MDS)](https://docs.cloud.google.com/run/docs/configuring/vpc-direct-vpc#mds-support).

For Cloud Run worker pools with Direct VPC ingress, such as database
connections or any other custom TCP-based protocol, the container must
listen for TCP connections on the port exposed in your container image
through the Dockerfile or specified by the PORT environment variable.

## AI and GPU support

Cloud Run supports hosting AI inference models. You can configure services with
GPUs (e.g., NVIDIA RTX PRO 6000 Blackwell GPU, NVIDIA L4) to accelerate
workloads like LLM inference using Gemma 3. For more information, see GPU
support for
[services](https://docs.cloud.google.com/run/docs/configuring/services/gpu),
[jobs](https://docs.cloud.google.com/run/docs/configuring/jobs/gpu), and [worker
pools](https://docs.cloud.google.com/run/docs/configuring/workerpools/gpu).

## Pricing

Cloud Run uses a pay-as-you-go model:

-   **Request-based:** Charged for resources used during request processing.
-   **Instance-based:** Charged for the entire lifetime of an instance.

For the latest pricing, visit: [Cloud Run
pricing](https://cloud.google.com/run/pricing).
