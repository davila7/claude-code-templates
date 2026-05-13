# GKE Storage

This reference covers storage configuration for GKE clusters including persistent disks, file storage, and cloud storage integration.

> **MCP Tools:** `apply_k8s_manifest`, `get_k8s_resource`, `describe_k8s_resource`, `get_cluster`

## Golden Path Storage Defaults

The golden path Autopilot config enables these CSI drivers:

| Driver | Golden Path | Access Mode | Use Case |
|--------|-------------|-------------|----------|
| Compute Engine Persistent Disk CSI | Enabled (default) | ReadWriteOnce | Block storage for databases, single-pod workloads |
| Google Cloud Filestore CSI | Enabled | ReadWriteMany | Shared NFS for multi-pod access |
| Cloud Storage FUSE CSI | Enabled | ReadWriteMany / ReadOnlyMany | Mount GCS buckets as volumes |
| Parallelstore CSI | Enabled | ReadWriteMany | High-performance parallel file system |
| Boot disk type | `pd-balanced` | N/A | Node boot disks |

## StorageClasses

### Default StorageClasses

GKE provides built-in StorageClasses:

| StorageClass | Disk Type | Use Case |
|-------------|-----------|----------|
| `standard-rwo` | `pd-standard` | Cost-effective, low IOPS |
| `premium-rwo` | `pd-ssd` | High IOPS, databases |
| `standard-rwx` | Filestore (Basic HDD) | Shared NFS |
| `premium-rwx` | Filestore (Basic SSD) | Shared NFS, higher performance |

### Custom StorageClass

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-regional
provisioner: pd.csi.storage.gke.io
parameters:
  type: pd-ssd
  replication-type: regional-pd    # Replicate across 2 zones
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true         # Always enable for production
```

## PersistentVolumeClaims

### Block Storage (ReadWriteOnce)

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: database-pvc
spec:
  accessModes:
  - ReadWriteOnce
  storageClassName: premium-rwo
  resources:
    requests:
      storage: 100Gi
```

### Shared File Storage (ReadWriteMany via Filestore)

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: shared-data
spec:
  accessModes:
  - ReadWriteMany
  storageClassName: standard-rwx
  resources:
    requests:
      storage: 1Ti    # Filestore minimum is 1 TiB for Basic tier
```

### GCS Bucket Mount (Cloud Storage FUSE)

Mount a GCS bucket as a volume without a PVC:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: gcs-reader
  annotations:
    gke-gcsfuse/volumes: "true"
spec:
  containers:
  - name: reader
    image: busybox
    command: ["ls", "/data"]
    volumeMounts:
    - name: gcs-bucket
      mountPath: /data
  volumes:
  - name: gcs-bucket
    csi:
      driver: gcsfuse.csi.storage.gke.io
      readOnly: true
      volumeAttributes:
        bucketName: <BUCKET_NAME>
```

> Requires Workload Identity for the pod's service account to have `storage.objectViewer` on the bucket.

## Volume Expansion

If `allowVolumeExpansion: true` is set on the StorageClass, resize by updating the PVC:

```bash
# kubectl
kubectl patch pvc <PVC_NAME> -p '{"spec":{"resources":{"requests":{"storage":"200Gi"}}}}'
```

```
# MCP (preferred)
patch_k8s_resource(parent="...", resourceType="persistentvolumeclaim", name="<PVC_NAME>",
  patch='{"spec":{"resources":{"requests":{"storage":"200Gi"}}}}')
```

Kubernetes automatically resizes the filesystem.

## Best Practices

1. **Always enable volume expansion**: Set `allowVolumeExpansion: true` on all StorageClasses
2. **Use regional PDs for production**: `replication-type: regional-pd` replicates across 2 zones for HA
3. **Use `WaitForFirstConsumer`**: Ensures the PV is provisioned in the same zone as the pod
4. **Choose the right disk type**: `pd-ssd` for databases, `pd-balanced` (golden path default) for general use, `pd-standard` for cold storage
5. **Use Filestore for shared access**: When multiple pods need to read/write the same files
6. **Use GCS FUSE for data pipelines**: Mount buckets directly for ML training data, logs, etc.
7. **Back up PVCs**: Use Backup for GKE (see [gke-backup-dr.md](./gke-backup-dr.md)) to protect persistent data
