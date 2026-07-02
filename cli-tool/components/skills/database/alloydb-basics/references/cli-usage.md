# AlloyDB CLI Usage

AlloyDB resources are managed using the `gcloud alloydb` command group.

## Clusters

1. Create a cluster: `gcloud alloydb clusters create CLUSTER_ID --region=REGION
   --password=PASSWORD`

2. List clusters: `gcloud alloydb clusters list --region=REGION`

3. Get cluster info: `gcloud alloydb clusters describe CLUSTER_ID
   --region=REGION`

4. Delete a cluster: `gcloud alloydb clusters delete CLUSTER_ID --region=REGION`

## Instances

1. Create a primary instance: `gcloud alloydb instances create INSTANCE_ID
   --cluster=CLUSTER_ID --region=REGION --instance-type=PRIMARY --cpu-count=8`

2. Create a read pool instance: `gcloud alloydb instances create INSTANCE_ID
   --cluster=CLUSTER_ID --region=REGION --instance-type=READ_POOL
   --read-pool-node-count=2 --cpu-count=2`

3. List instances: `gcloud alloydb instances list --cluster=CLUSTER_ID
   --region=REGION`

4. Restart an instance: `gcloud alloydb instances restart INSTANCE_ID
   --cluster=CLUSTER_ID --region=REGION`

## Backups

1. Create a backup: `gcloud alloydb backups create BACKUP_ID
   --cluster=CLUSTER_ID --region=REGION`

2. List backups: `gcloud alloydb backups list --region=REGION`
