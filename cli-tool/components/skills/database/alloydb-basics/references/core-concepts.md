# AlloyDB Core Concepts

AlloyDB for PostgreSQL is a fully managed, PostgreSQL-compatible database
service designed for high performance, scale, and availability. It is built on
top of a cloud-native storage engine that separates compute from storage,
allowing for efficient scaling and high availability.

AlloyDB is ideal for enterprise-grade transactional workloads, such as ERP or
CRM systems, as well as for analytical workloads that benefit from its columnar
engine, and vector workloads using its [vector search
capabilities](https://docs.cloud.google.com/alloydb/docs/ai/perform-vector-search).

## Regional Availability

AlloyDB is a regional service. A cluster consists of a primary instance and
optional read pool instances, all of which are located in the same region. The
storage is replicated across multiple zones within the region to ensure high
availability.

## AlloyDB Auth Proxy

The [AlloyDB Auth
Proxy](https://cloud.google.com/alloydb/docs/auth-proxy/connect) is a standalone
tool that can be deployed in any environment, and works by opening a local
socket and proxying connections to your AlloyDB instance.

## Connectivity Options

### Private vs Public IP

When connecting to AlloyDB, you can use either a Private IP or a Public IP:

-   **Private IP:** Your client must be deployed either in the same VPC network
    as your AlloyDB cluster (when using PSA), or have a PSC endpoint in your VPC
    (when using PSC) to connect directly using Private IP. For indirect methods
    of connecting outside your VPC, see [Enable private services
    access](https://cloud.google.com/alloydb/docs/configure-connectivity).
-   **Public IP:** If enabled on your instance, you can connect from outside the
    VPC network.

## Connection Pooling

For production workloads, use connection poolers like **PgBouncer** (integrated
in AlloyDB) to manage high numbers of concurrent connections efficiently.

## Pricing

For up-to-date pricing information, visit the official [AlloyDB
Pricing](https://cloud.google.com/alloydb/pricing) page. Pricing is based on the
number of vCPUs and memory for each instance, as well as the storage used.
