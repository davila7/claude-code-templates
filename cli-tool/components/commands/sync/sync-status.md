---
allowed-tools: Read, Bash
argument-hint: [--detailed] | [--health-check] | [--diagnostics]
description: Monitor GitHub-Linear sync health status with performance metrics and diagnostics
model: sonnet
---

# Sync Status Monitor

Monitor GitHub-Linear sync health: $ARGUMENTS

## Current Sync State

- Sync configuration: @.sync-config.json or @sync/ (if exists)
- Recent sync logs: !`find . -name "*sync*.log" | head -3`
- GitHub status: !`gh api rate_limit` (if GitHub CLI available)
- Process status: !`ps aux | grep -i sync | head -3`

## Task

Analyze synchronization status between GitHub and Linear. When checking synchronization status:

1. **Sync State Overview**
   ```javascript
   async function getSyncOverview() {
     const state = await loadSyncState();
     
     return {
       lastFullSync: state.lastFullSync,
       lastIncrementalSync: state.lastIncremental,
       totalSyncedItems: Object.keys(state.entities).length,
       pendingSync: state.queue.length,
       failedSync: state.failures.length,
       syncEnabled: state.config.enabled,
       syncDirection: state.config.direction,
       webhooksActive: await checkWebhooks()
     };
   }
   ```

2. **Health Metrics**
   ```javascript
   const healthMetrics = {
     // Performance metrics
     avgSyncTime: calculateAverage(syncTimes),
     maxSyncTime: Math.max(...syncTimes),
     syncSuccessRate: (successful / total) * 100,
     
     // Data quality metrics
     conflictRate: (conflicts / syncs) * 100,
     duplicateRate: (duplicates / total) * 100,
     orphanedItems: countOrphaned(),
     
     // API health
     githubRateLimit: await getGitHubRateLimit(),
     linearRateLimit: await getLinearRateLimit(),
     apiErrors: recentErrors.length,
     
     // Sync lag
     avgSyncLag: calculateSyncLag(),
     maxSyncLag: findMaxLag(),
     itemsOutOfSync: findOutOfSync().length
   };
   ```

3. **Consistency Checks**
   ```javascript
   async function checkConsistency() {
     const issues = [];
     
     // Check GitHub → Linear
     const githubIssues = await fetchAllGitHubIssues();
     for (const issue of githubIssues) {
       const linearTask = await findLinearTask(issue);
       if (!linearTask) {
         issues.push({
           type: 'MISSING_IN_LINEAR',
           github: issue.number,
           severity: 'high'
         });
       } else {
         const diffs = compareFields(issue, linearTask);
         if (diffs.length > 0) {
           issues.push({
             type: 'FIELD_MISMATCH',
             github: issue.number,
             linear: linearTask.identifier,
             differences: diffs,
             severity: 'medium'
           });
         }
       }
     }
     
     return issues;
   }
   ```

4. **Sync History Analysis**
   ```javascript
   function analyzeSyncHistory(days = 7) {
     const history = loadSyncHistory(days);
     
     return {
       totalSyncs: history.length,
       byType: groupBy(history, 'type'),
       byDirection: groupBy(history, 'direction'),
       successRate: calculateRate(history, 'success'),
       
       patterns: {
         peakHours: findPeakSyncHours(history),
         commonErrors: findCommonErrors(history),
         slowestOperations: findSlowestOps(history)
       },
       
       trends: {
         syncVolume: calculateTrend(history, 'volume'),
         errorRate: calculateTrend(history, 'errors'),
         performance: calculateTrend(history, 'duration')
       }
     };
   }
   ```

5. **Real-time Monitoring**
   ```javascript
   class SyncMonitor {
     constructor() {
       this.metrics = new Map();
       this.alerts = [];
     }
     
     track(operation) {
       const start = Date.now();
       
       return {
         complete: (success, details) => {
           const duration = Date.now() - start;
           this.metrics.set(operation.id, {
             ...operation,
             duration,
             success,
             details,
             timestamp: new Date()
           });
           
           // Check for alerts
           if (duration > SLOW_SYNC_THRESHOLD) {
             this.alert('SLOW_SYNC', operation);
           }
           if (!success) {
             this.alert('SYNC_FAILURE', operation);
           }
         }
       };
     }
   }
   ```

6. **Webhook Status**
   ```bash
   # Check GitHub webhooks
   gh api repos/:owner/:repo/hooks --jq '.[] | select(.config.url | contains("linear"))'
   
   # Validate webhook health
   gh api repos/:owner/:repo/hooks/:id/deliveries --jq '.[0:10] | .[] | {id, status_code, delivered_at}'
   ```

7. **Queue Management**
   ```javascript
   async function getQueueStatus() {
     const queue = await loadSyncQueue();
     
     return {
       size: queue.length,
       oldest: queue[0]?.createdAt,
       byPriority: groupBy(queue, 'priority'),
       estimatedTime: estimateProcessingTime(queue),
       
       blocked: queue.filter(item => item.retries >= MAX_RETRIES),
       processing: queue.filter(item => item.status === 'processing'),
       pending: queue.filter(item => item.status === 'pending')
     };
   }
   ```

8. **Diagnostic Reports**
   ```javascript
   function generateDiagnostics() {
     return {
       systemInfo: {
         version: SYNC_VERSION,
         githubCLI: checkGitHubCLI(),
         linearMCP: checkLinearMCP(),
         config: loadSyncConfig()
       },
       
       connectivity: {
         github: testGitHubAPI(),
         linear: testLinearAPI(),
         webhooks: testWebhooks()
       },
       
       dataIntegrity: {
         orphanedGitHub: findOrphanedGitHubIssues(),
         orphanedLinear: findOrphanedLinearTasks(),
         duplicates: findDuplicates(),
         conflicts: findConflicts()
       },
       
       recommendations: generateRecommendations()
     };
   }
   ```

9. **Alert Configuration**
   ```yaml
   alerts:
     - name: high_conflict_rate
       condition: conflict_rate > 10%
       severity: warning
       action: notify
     
     - name: sync_failure
       condition: success_rate < 95%
       severity: critical
       action: pause_sync
     
     - name: api_rate_limit
       condition: rate_limit_remaining < 100
       severity: warning
       action: throttle
   ```

10. **Performance Visualization**
    ```
    Sync Performance (Last 24h)
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    Sync Volume:
    00:00 ▁▁▂▁▁▁▂▃▄▅▆▇█▇▆▅▄▃▂▁▁▁▂▁ 23:59
    
    Success Rate: 98.5%
    ████████████████████░ 
    
    Avg Duration: 2.3s
    ████████░░░░░░░░░░░░ (Target: 5s)
    ```

## Examples

### Basic Status Check
```bash
# Get current sync status
claude sync-status

# Detailed status with history
claude sync-status --detailed

# Check specific sync types
claude sync-status --type="issue-to-linear"
```

### Health Monitoring
```bash
# Run health check
claude sync-status --health-check

# Continuous monitoring
claude sync-status --monitor --interval=5m

# Generate diagnostic report
claude sync-status --diagnostics
```

### Troubleshooting
```bash
# Check for sync issues
claude sync-status --check-issues

# Verify specific items
claude sync-status --verify="gh-123,ABC-456"

# Queue management
claude sync-status --queue --clear-failed
```

## Output Format

```
GitHub-Linear Sync Status
=========================
Last Updated: 2025-01-16 10:45:00

Overview:
✓ Sync Enabled: Bidirectional
✓ Webhooks: Active (GitHub: ✓, Linear: ✓)
✓ Last Full Sync: 2 hours ago
✓ Last Activity: 5 minutes ago

Statistics:
- Total Synced Items: 1,234
- Items in Queue: 3
- Failed Items: 1

Health Metrics:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Success Rate    █████████████████░░░ 96.5%
Conflict Rate   ███░░░░░░░░░░░░░░░░  8.2%
Sync Lag        ████░░░░░░░░░░░░░░░ ~2min

API Status:
- GitHub: 4,832/5,000 requests remaining
- Linear: 1,245/1,500 requests remaining

Recent Activity:
10:44 ✓ Issue #123 → ABC-789 (1.2s)
10:42 ✓ ABC-788 → Issue #122 (0.8s)
10:40 ⚠ Issue #121 → Conflict detected
10:38 ✓ PR #456 → ABC-787 linked

Alerts:
⚠ High conflict rate in last hour (12%)
⚠ 1 item failed after max retries

Recommendations:
1. Review and resolve conflict for Issue #121
2. Retry failed sync for ABC-456
3. Consider increasing sync frequency
```

## Advanced Features

### Sync Analytics Dashboard
```
═══════════════════════════════════════════════════════
                 SYNC ANALYTICS DASHBOARD
═══════════════════════════════════════════════════════

Daily Sync Volume         │ Sync Types
─────────────────────────┼─────────────────────────
     150 ┤               │ Issues → Linear  45%
     120 ┤    ╭─╮        │ Linear → Issues  30%
      90 ┤   ╱  ╲        │ PR → Task        20%
      60 ┤  ╱    ╲       │ Comments          5%
      30 ┤ ╱      ╲___   │
       0 └─────────────   │
         Mon  Wed  Fri    │

Error Distribution        │ Performance Trends
─────────────────────────┼─────────────────────────
Network      ████ 40%     │ Avg Time  ▂▄▆█▆▄▂ 2.3s
Rate Limit   ███  30%     │ P95 Time  ▃▅▇█▇▅▃ 5.1s
Conflicts    ██   20%     │ P99 Time  ▄▆███▆▄ 8.2s
Other        █    10%     │
```

### Predictive Analysis
```javascript
function predictSyncIssues() {
  const patterns = analyzeHistoricalData();
  
  return {
    likelyConflicts: predictConflicts(patterns),
    peakLoadTimes: predictPeakLoad(patterns),
    rateLimitRisk: calculateRateLimitRisk(),
    recommendations: {
      optimalSyncInterval: calculateOptimalInterval(),
      suggestedBatchSize: calculateOptimalBatch(),
      conflictPrevention: suggestConflictStrategies()
    }
  };
}
```

## Best Practices

1. **Regular Monitoring**
   - Set up automated health checks
   - Review sync metrics daily
   - Act on alerts promptly

2. **Proactive Maintenance**
   - Clear failed items regularly
   - Optimize sync intervals
   - Update conflict strategies

3. **Documentation**
   - Log all sync issues
   - Document resolution steps
   - Track performance trends