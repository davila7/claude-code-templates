---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [workflow-name] | create | run | schedule | monitor
description: Orchestrate complex automation workflows with task dependencies, scheduling, and cross-platform execution
model: sonnet
---

# Workflow Orchestrator

Orchestrate complex automation workflows: $ARGUMENTS

## Current Workflow State

- Existing workflows: !`find . -name "*.workflow.json" -o -name "workflow.yml" -o -name "Taskfile.yml" | head -5`
- Cron jobs: !`crontab -l 2>/dev/null || echo "No crontab found"`
- Running processes: !`ps aux | grep -E "(workflow|task|job)" | head -3`
- System capabilities: !`which docker node python3 | head -3`
- Configuration: @.workflow-config.json or @workflows/ (if exists)

## Task

Create and manage complex automation workflows with dependency management, scheduling, and monitoring.

## Workflow Definition Structure

### Basic Workflow Schema
```json
{
  "name": "deployment-workflow",
  "version": "1.0.0",
  "description": "Complete deployment automation with testing and rollback",
  "trigger": {
    "type": "manual|schedule|webhook|file_change",
    "config": {
      "schedule": "0 2 * * *",
      "files": ["src/**/*", "package.json"],
      "webhook": "/trigger/deploy"
    }
  },
  "environment": {
    "NODE_ENV": "production",
    "LOG_LEVEL": "info"
  },
  "tasks": [
    {
      "id": "pre-build",
      "name": "Pre-build validation",
      "type": "shell",
      "command": "npm run validate",
      "timeout": 300,
      "retry": {
        "attempts": 3,
        "delay": 5000
      }
    },
    {
      "id": "build",
      "name": "Build application",
      "type": "shell",
      "command": "npm run build",
      "depends_on": ["pre-build"],
      "parallel": false,
      "timeout": 600
    },
    {
      "id": "test",
      "name": "Run tests",
      "type": "shell",
      "command": "npm run test:ci",
      "depends_on": ["build"],
      "condition": "${env.SKIP_TESTS} != 'true'"
    },
    {
      "id": "deploy",
      "name": "Deploy to staging",
      "type": "shell",
      "command": "npm run deploy:staging",
      "depends_on": ["test"],
      "on_success": ["notify-success"],
      "on_failure": ["rollback", "notify-failure"]
    }
  ],
  "notifications": {
    "channels": ["slack", "email"],
    "on_completion": true,
    "on_failure": true
  }
}
```

## Advanced Workflow Features

### 1. **Conditional Execution**
```json
{
  "id": "conditional-deploy",
  "name": "Deploy if tests pass",
  "type": "conditional",
  "condition": "${tasks.test.exit_code} == 0 && ${env.DEPLOY_ENABLED} == 'true'",
  "then": {
    "type": "shell",
    "command": "npm run deploy"
  },
  "else": {
    "type": "shell",
    "command": "echo 'Skipping deployment'"
  }
}
```

### 2. **Parallel Task Execution**
```json
{
  "id": "parallel-tests",
  "name": "Run parallel test suites",
  "type": "parallel",
  "tasks": [
    {
      "id": "unit-tests",
      "command": "npm run test:unit"
    },
    {
      "id": "integration-tests", 
      "command": "npm run test:integration"
    },
    {
      "id": "e2e-tests",
      "command": "npm run test:e2e"
    }
  ],
  "wait_for": "all|any|first",
  "timeout": 1800
}
```

### 3. **Loop and Iteration**
```json
{
  "id": "deploy-multiple-envs",
  "name": "Deploy to multiple environments",
  "type": "loop",
  "items": ["staging", "qa", "production"],
  "task": {
    "type": "shell",
    "command": "npm run deploy -- --env ${item}",
    "timeout": 300
  },
  "parallel": false,
  "stop_on_failure": true
}
```

### 4. **File and Data Processing**
```json
{
  "id": "process-data",
  "name": "Process data files",
  "type": "data_processor",
  "input": {
    "type": "file",
    "path": "data/*.json"
  },
  "processor": {
    "type": "javascript",
    "script": "scripts/process-data.js"
  },
  "output": {
    "type": "file",
    "path": "processed/output.json"
  }
}
```

## Workflow Orchestration Engine

### Core Engine Implementation
```javascript
class WorkflowOrchestrator {
  constructor(config) {
    this.config = config;
    this.tasks = new Map();
    this.running = new Set();
    this.completed = new Set();
    this.failed = new Set();
    this.logger = new Logger(config.logLevel);
  }

  async execute(workflowPath) {
    const workflow = await this.loadWorkflow(workflowPath);
    
    try {
      await this.validateWorkflow(workflow);
      await this.setupEnvironment(workflow.environment);
      
      const result = await this.executeWorkflow(workflow);
      await this.cleanup();
      
      return result;
    } catch (error) {
      await this.handleError(error, workflow);
      throw error;
    }
  }

  async executeWorkflow(workflow) {
    const taskGraph = this.buildDependencyGraph(workflow.tasks);
    const execution = {
      id: this.generateExecutionId(),
      workflow: workflow.name,
      startTime: Date.now(),
      tasks: {}
    };

    while (this.hasRunnableTasks(taskGraph)) {
      const runnableTasks = this.getRunnableTasks(taskGraph);
      
      if (runnableTasks.length === 0) {
        break; // Circular dependency or all failed
      }

      await this.executeTaskBatch(runnableTasks, execution);
    }

    return this.generateExecutionReport(execution);
  }

  async executeTask(task, execution) {
    const taskExecution = {
      id: task.id,
      name: task.name,
      startTime: Date.now(),
      status: 'running'
    };

    execution.tasks[task.id] = taskExecution;
    this.running.add(task.id);

    try {
      // Pre-execution hooks
      await this.runPreHooks(task);
      
      // Task execution
      const result = await this.runTaskByType(task);
      
      // Post-execution hooks
      await this.runPostHooks(task, result);

      taskExecution.endTime = Date.now();
      taskExecution.duration = taskExecution.endTime - taskExecution.startTime;
      taskExecution.status = 'completed';
      taskExecution.result = result;

      this.completed.add(task.id);
      this.running.delete(task.id);

      // Handle success callbacks
      if (task.on_success) {
        await this.executeCallbacks(task.on_success, taskExecution);
      }

      return result;
    } catch (error) {
      taskExecution.endTime = Date.now();
      taskExecution.duration = taskExecution.endTime - taskExecution.startTime;
      taskExecution.status = 'failed';
      taskExecution.error = error.message;

      this.failed.add(task.id);
      this.running.delete(task.id);

      // Handle failure callbacks
      if (task.on_failure) {
        await this.executeCallbacks(task.on_failure, taskExecution);
      }

      throw error;
    }
  }

  async runTaskByType(task) {
    switch (task.type) {
      case 'shell':
        return await this.executeShellTask(task);
      case 'http':
        return await this.executeHttpTask(task);
      case 'docker':
        return await this.executeDockerTask(task);
      case 'javascript':
        return await this.executeJavaScriptTask(task);
      case 'python':
        return await this.executePythonTask(task);
      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
  }
}
```

### Task Types Implementation

#### Shell Task
```javascript
async executeShellTask(task) {
  const { spawn } = require('child_process');
  
  return new Promise((resolve, reject) => {
    const process = spawn('sh', ['-c', task.command], {
      cwd: task.cwd || process.cwd(),
      env: { ...process.env, ...task.environment },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
      if (task.live_output) {
        console.log(data.toString());
      }
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    const timeout = setTimeout(() => {
      process.kill('SIGKILL');
      reject(new Error(`Task timeout after ${task.timeout}ms`));
    }, task.timeout || 300000);

    process.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve({ stdout, stderr, exitCode: code });
      } else {
        reject(new Error(`Shell command failed with exit code ${code}: ${stderr}`));
      }
    });
  });
}
```

#### HTTP Task
```javascript
async executeHttpTask(task) {
  const axios = require('axios');
  
  const config = {
    method: task.method || 'GET',
    url: task.url,
    headers: task.headers || {},
    timeout: task.timeout || 30000
  };

  if (task.data) {
    config.data = task.data;
  }

  if (task.auth) {
    config.auth = task.auth;
  }

  try {
    const response = await axios(config);
    return {
      status: response.status,
      data: response.data,
      headers: response.headers
    };
  } catch (error) {
    throw new Error(`HTTP request failed: ${error.message}`);
  }
}
```

## Workflow Scheduling

### Cron Integration
```bash
#!/bin/bash
# setup-workflow-cron.sh

# Daily backup workflow
0 2 * * * cd /path/to/project && node workflow-engine.js run backup-workflow.json

# Hourly health check
0 * * * * cd /path/to/project && node workflow-engine.js run health-check.json

# Weekly cleanup
0 0 * * 0 cd /path/to/project && node workflow-engine.js run cleanup-workflow.json
```

### Systemd Timer (Linux)
```ini
# /etc/systemd/system/workflow-orchestrator.timer
[Unit]
Description=Workflow Orchestrator Timer
Requires=workflow-orchestrator.service

[Timer]
OnCalendar=*:0/5
Persistent=true

[Install]
WantedBy=timers.target
```

## Monitoring and Alerting

### Workflow Metrics Dashboard
```javascript
class WorkflowMonitor {
  constructor() {
    this.metrics = {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      averageDuration: 0,
      taskMetrics: new Map()
    };
  }

  recordExecution(execution) {
    this.metrics.totalRuns++;
    
    if (execution.status === 'completed') {
      this.metrics.successfulRuns++;
    } else {
      this.metrics.failedRuns++;
    }

    // Update average duration
    const totalDuration = this.metrics.averageDuration * (this.metrics.totalRuns - 1) + execution.duration;
    this.metrics.averageDuration = totalDuration / this.metrics.totalRuns;

    // Record task metrics
    for (const [taskId, task] of Object.entries(execution.tasks)) {
      if (!this.metrics.taskMetrics.has(taskId)) {
        this.metrics.taskMetrics.set(taskId, {
          runs: 0,
          failures: 0,
          averageDuration: 0
        });
      }

      const taskMetrics = this.metrics.taskMetrics.get(taskId);
      taskMetrics.runs++;
      
      if (task.status === 'failed') {
        taskMetrics.failures++;
      }

      const taskTotalDuration = taskMetrics.averageDuration * (taskMetrics.runs - 1) + task.duration;
      taskMetrics.averageDuration = taskTotalDuration / taskMetrics.runs;
    }
  }

  getHealthReport() {
    const successRate = (this.metrics.successfulRuns / this.metrics.totalRuns) * 100;
    
    return {
      overall: {
        successRate: successRate.toFixed(2) + '%',
        totalRuns: this.metrics.totalRuns,
        averageDuration: (this.metrics.averageDuration / 1000).toFixed(2) + 's'
      },
      tasks: this.getTaskHealthReport()
    };
  }
}
```

### Alert Configuration
```json
{
  "alerts": [
    {
      "name": "workflow-failure",
      "condition": "execution.status === 'failed'",
      "channels": ["slack", "email"],
      "template": "Workflow ${workflow.name} failed: ${error.message}"
    },
    {
      "name": "high-failure-rate",
      "condition": "metrics.successRate < 90",
      "channels": ["slack"],
      "template": "Workflow success rate dropped to ${metrics.successRate}%"
    },
    {
      "name": "long-duration",
      "condition": "execution.duration > workflow.expected_duration * 2",
      "channels": ["email"],
      "template": "Workflow taking unusually long: ${execution.duration}ms"
    }
  ]
}
```

## CLI Interface

### Command-line Usage
```bash
# Create new workflow
workflow create --name "deployment" --template "web-app"

# Run workflow
workflow run deployment-workflow.json

# Schedule workflow
workflow schedule --cron "0 2 * * *" backup-workflow.json

# Monitor workflows
workflow monitor --live

# View execution history
workflow history --limit 10

# Get workflow status
workflow status --execution-id abc123

# Validate workflow
workflow validate deployment-workflow.json

# Generate workflow from template
workflow generate --type "ci-cd" --output ci-workflow.json
```

## Integration Examples

### Slack Integration
```javascript
async function sendSlackNotification(message, channel = '#deployments') {
  const webhook = process.env.SLACK_WEBHOOK_URL;
  
  await axios.post(webhook, {
    channel: channel,
    text: message,
    username: 'Workflow Orchestrator',
    icon_emoji: ':gear:'
  });
}
```

### Docker Integration
```json
{
  "id": "docker-build",
  "name": "Build Docker image",
  "type": "docker",
  "config": {
    "dockerfile": "Dockerfile",
    "context": ".",
    "tags": ["myapp:latest", "myapp:${env.BUILD_NUMBER}"],
    "build_args": {
      "NODE_ENV": "production"
    }
  }
}
```

### Database Integration
```json
{
  "id": "db-migration",
  "name": "Run database migrations",
  "type": "database",
  "config": {
    "connection": "${env.DATABASE_URL}",
    "migrations_path": "migrations/",
    "rollback_on_failure": true
  }
}
```

This workflow orchestrator provides enterprise-grade automation capabilities with dependency management, monitoring, and cross-platform execution support.