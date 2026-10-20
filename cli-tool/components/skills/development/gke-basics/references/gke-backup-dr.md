# GKE Backup & Disaster Recovery

This reference provides workflows for protecting stateful workloads on GKE using Backup for GKE.

> **MCP Tools:** `get_cluster`, `update_cluster`. **CLI-only:** `gcloud container backup-restore *`

## Workflows

### 1. Enable Backup for GKE

Backup for GKE must be enabled at the cluster level.

```bash
# Check if enabled
gcloud container clusters describe <CLUSTER_NAME> --region <REGION> \
  --format="value(addonsConfig.gkeBackupAgentConfig.enabled)" \
  --quiet

# Enable (Day-1 change)
gcloud container clusters update <CLUSTER_NAME> \
  --enable-gke-backup \
  --region <REGION> \
  --quiet
```

### 2. Create a Backup Plan

A Backup Plan defines what to back up, when, and for how long.

```bash
gcloud container backup-restore backup-plans create <PLAN_NAME> \
  --cluster=<CLUSTER_NAME> \
  --location=<REGION> \
  --retention-days=<DAYS> \
  --cron-schedule="<CRON>" \
  --all-namespaces \
  --quiet
```

**Options:**
- `--all-namespaces` — back up everything
- `--included-namespaces=<ns1>,<ns2>` — back up specific namespaces
- `--backup-encryption-key=<KEY>` — encrypt with Customer-Managed Encryption Key (CMEK)

### 3. Create a Manual Backup

Trigger a backup immediately outside the schedule:

```bash
gcloud container backup-restore backups create <BACKUP_NAME> \
  --backup-plan=<PLAN_NAME> \
  --location=<REGION> \
  --quiet
```

### 4. Restore from Backup

**Create a restore plan:**

```bash
gcloud container backup-restore restore-plans create <RESTORE_PLAN_NAME> \
  --cluster=<TARGET_CLUSTER_NAME> \
  --location=<REGION> \
  --backup-plan=<SOURCE_BACKUP_PLAN_NAME> \
  --cluster-resource-conflict-policy=USE_EXISTING_VERSION \
  --namespaced-resource-restore-mode=FAIL_ON_CONFLICT \
  --quiet
```

**Execute the restore:**

```bash
gcloud container backup-restore restores create <RESTORE_NAME> \
  --restore-plan=<RESTORE_PLAN_NAME> \
  --backup=<BACKUP_NAME> \
  --location=<REGION> \
  --quiet
```

## Best Practices

1. **Automate backups**: Always use a cron schedule for production workloads
2. **Test restores regularly**: Restore to a separate namespace or cluster to verify data integrity
3. **Cross-region DR**: Store backups in a different region or configure cross-region restore plans
4. **Encrypt backups**: Use CMEK for compliance and security requirements
5. **Scope backups**: Back up specific namespaces rather than the entire cluster when possible to reduce restore complexity
