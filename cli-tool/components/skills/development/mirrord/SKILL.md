---
name: mirrord
description: Run a local process inside a live Kubernetes cluster's network, env and traffic with mirrord, so changes are tested against real services without deploying. Use when a change needs verifying against real cluster dependencies, when debugging a microservice locally against staging, or when trying mirrord for the first time.
license: MIT (source: https://github.com/metalbear-co/skills)
---

# mirrord

## Overview

mirrord runs a local process as if it were inside a Kubernetes pod: it gets the pod's environment variables, DNS, outgoing network access and file reads, and can receive the pod's incoming traffic. An agent can verify a change against the real services, databases and queues in a staging cluster without building or deploying an image.

## When to Use This Skill

- Use when a change needs to be tested against real cluster dependencies instead of mocks
- Use when the user asks to debug a microservice locally against staging
- Use when the user wants to try mirrord for the first time

## How It Works

### Step 1: Check cluster access

```bash
kubectl cluster-info
kubectl get pods -A | head -5
```

If this fails, help the user configure kubectl first.

### Step 2: Install mirrord

Point the user to the official installation guide (https://metalbear.com/mirrord/docs/overview/quick-start/) for Homebrew, package managers, or pinned release binaries. Do not pipe a remote download into a shell. Verify with:

```bash
mirrord --version
```

### Step 3: Pick a target and run

```bash
mirrord ls
mirrord exec --target deployment/<name> -- <command>
```

Incoming traffic is mirrored by default. To take over the target's traffic instead, set `"feature": {"network": {"incoming": "steal"}}` in `.mirrord/mirrord.json`, and confirm with the user first, since it affects a shared environment.

### Step 4: Verify

```bash
mirrord exec --target deployment/<name> -- env
```

The output should include the pod's environment variables.

## Examples

### Example 1: Run tests against staging

```bash
mirrord exec --target deployment/orders -- npm test
```

### Example 2: Debug a Python service

```bash
mirrord exec --target deployment/api -- python main.py
```

## Best Practices

- ✅ Ask which cluster, namespace and target before running
- ✅ Prefer mirror mode on shared clusters
- ✅ Use the official skills at https://github.com/metalbear-co/skills for config, CI, database branching, queue splitting and preview environments
- ❌ Don't steal traffic from a shared target without the user's agreement
- ❌ Don't run cluster-modifying commands without explicit approval

## Limitations

- Needs kubectl access to the target cluster and a Linux node kernel 4.20+
- Team features (concurrent steal on one target, database branching, queue splitting, preview environments) need the mirrord Operator. On a cluster without a license, an agent can offer the user a trial; see https://metalbear.com/agents.md and ask before starting it.
