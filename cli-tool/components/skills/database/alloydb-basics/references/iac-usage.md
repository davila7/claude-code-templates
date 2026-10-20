# AlloyDB Infrastructure as Code Usage

AlloyDB resources can be managed using Terraform via the Google Cloud Provider,
or via Kubernetes Config Connector (KCC).

## Terraform

### Resources

1.  `google_alloydb_cluster`: Manages an AlloyDB cluster.
2.  `google_alloydb_instance`: Manages an AlloyDB instance within a cluster.

### Example

```terraform
data "google_project" "project" {}

resource "google_compute_network" "default" {
  name = "alloydb-network"
}

resource "google_compute_global_address" "private_ip_alloc" {
  name          =  "alloydb-cluster"
  address_type  = "INTERNAL"
  purpose       = "VPC_PEERING"
  prefix_length = 16
  network       = google_compute_network.default.id
}

resource "google_service_networking_connection" "vpc_connection" {
  network                 = google_compute_network.default.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_alloc.name]
}

resource "google_alloydb_cluster" "default" {
  cluster_id = "alloydb-cluster"
  location   = "us-central1"
  network_config {
    network = google_compute_network.default.id
  }

  initial_user {
    password = "alloydb-cluster"
  }

  deletion_protection = false
}

resource "google_alloydb_instance" "default" {
  cluster       = google_alloydb_cluster.default.name
  instance_id   = "alloydb-instance"
  instance_type = "PRIMARY"

  machine_config {
    cpu_count = 2
  }

  depends_on = [google_service_networking_connection.vpc_connection]
}
```

For more information, see the [Google Provider
Reference](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/alloydb_cluster).

## Kubernetes Config Connector (KCC)

### Resources

1.  `AlloyDBCluster`: Manages an AlloyDB cluster.
2.  `AlloyDBInstance`: Manages an AlloyDB instance within a cluster.

### Example

```yaml
apiVersion: compute.cnrm.cloud.google.com/v1beta1
kind: ComputeNetwork
metadata:
  name: alloydb-network-kcc
spec:
  routingMode: REGIONAL
  autoCreateSubnetworks: false
---
apiVersion: compute.cnrm.cloud.google.com/v1beta1
kind: ComputeAddress
metadata:
  name: alloydb-kcc-addr
spec:
  location: global
  addressType: INTERNAL
  purpose: VPC_PEERING
  prefixLength: 16
  networkRef:
    name: alloydb-network-kcc
---
apiVersion: servicenetworking.cnrm.cloud.google.com/v1beta1
kind: ServiceNetworkingConnection
metadata:
  name: alloydb-vpc-connection-kcc
spec:
  networkRef:
    name: alloydb-network-kcc
  service: servicenetworking.googleapis.com
  reservedPeeringRanges:
    - name: alloydb-kcc-addr
---
apiVersion: alloydb.cnrm.cloud.google.com/v1beta1
kind: AlloyDBCluster
metadata:
  name: alloydb-cluster-kcc
spec:
  location: us-central1
  networkConfig:
    networkRef:
      name: alloydb-network-kcc
  initialUser:
    password:
      valueFrom:
        secretKeyRef:
          name: alloydb-secret
          key: password
---
apiVersion: alloydb.cnrm.cloud.google.com/v1beta1
kind: AlloyDBInstance
metadata:
  name: alloydb-instance-kcc
spec:
  clusterRef:
    name: alloydb-cluster-kcc
  instanceType: PRIMARY
  machineConfig:
    cpuCount: 2
```

For more information, see the [Config Connector resources](https://docs.cloud.google.com/config-connector/docs/reference/overview).
