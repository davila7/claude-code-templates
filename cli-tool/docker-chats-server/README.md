# Docker Deployment for Chats Server (`--chats`)

Security-hardened Docker deployment for the `--chats` conversation browser feature of claude-code-templates.

> **Note**: This Docker setup is specifically for running the `--chats` server persistently.
> It uses network isolation which prevents other CLI features (like `--agent`, `--command`)
> that require downloading templates from the internet.

## Security Architecture

This deployment uses a **sidecar proxy pattern** to maximize security while maintaining functionality:

```
[localhost:9876] → [proxy container] → [isolated app container]
                      (external net)      (internal net, NO internet)
```

### Security Features

| Feature | Description |
|---------|-------------|
| **Network Isolation** | App container has NO internet access via Docker's `internal: true` network |
| **Read-only Filesystem** | Container cannot modify itself or persist malicious changes |
| **Dropped Capabilities** | All Linux capabilities removed (CAP_DROP ALL) |
| **No Privilege Escalation** | `security_opt: no-new-privileges:true` prevents container breakouts |
| **Non-root User** | Runs as unprivileged `appuser` (customizable UID) |
| **Health Checks** | Auto-restarts via autoheal if API becomes unresponsive |
| **Memory Limits** | Prevents resource exhaustion (2.5GB limit) |
| **Localhost Only** | Port 9876 only bound to 127.0.0.1, not exposed to network |

### Why Network Isolation?

Your Claude conversation history is valuable data. The isolated network ensures:
- **No data exfiltration**: Even if the app is compromised, it cannot send data anywhere
- **No C2 communication**: Malicious code cannot phone home
- **No supply chain attacks**: Runtime `npm install` attacks are blocked

## Quick Start

```bash
# Navigate to this directory
cd cli-tool/docker-chats-server

# Set your user ID (for volume permissions)
export USER_ID=$(id -u)

# Build and start
docker-compose up -d --build

# View logs
docker-compose logs -f claude-chats

# Access the dashboard
open http://localhost:9876
```

## Configuration

### User ID
The container needs to read your `~/.claude` directory. Set `USER_ID` to match your host user:

```bash
# Check your user ID
id -u

# Set in environment or docker-compose.yml
export USER_ID=502  # Replace with your actual UID
```

### Memory Limits
Default limits are tuned for ~800 conversations. Adjust in `docker-compose.yml`:

```yaml
deploy:
  resources:
    limits:
      memory: 2.5G  # Increase for more conversations
```

## Troubleshooting

### Container keeps restarting
Check logs for the actual error:
```bash
docker-compose logs claude-chats
```

Common issues:
- **Permission denied**: Ensure `USER_ID` matches your host user
- **Symlink errors**: The volume is mounted at the same absolute path to resolve symlinks

### Health check failures
The health check tests `http://localhost:9876/api/conversations`. If failing:
```bash
# Check if the app is responding
docker exec claude-chats-monitor curl -s http://localhost:9876/api/conversations | head
```

### Memory issues
If you have many conversations (1000+), increase the memory limit:
```yaml
deploy:
  resources:
    limits:
      memory: 4G
```

## Stopping

```bash
# Stop all containers
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

## Architecture Details

### Container Roles

1. **claude-chats** - Main application
   - Runs the chats-mobile server
   - Read-only access to `~/.claude`
   - No network access

2. **proxy** - Network bridge
   - Lightweight socat container
   - Forwards localhost:9876 to app container
   - Has network access but no data access

3. **autoheal** - Health monitor
   - Watches for failed health checks
   - Automatically restarts unhealthy containers
   - No network access (uses Docker socket)

### Network Topology

```
┌─────────────────────────────────────────────────┐
│                   Host Machine                   │
├─────────────────────────────────────────────────┤
│  localhost:9876                                  │
│        │                                         │
│        ▼                                         │
│  ┌───────────┐                                  │
│  │   proxy   │ ← external network (has internet)│
│  │  (socat)  │                                  │
│  └─────┬─────┘                                  │
│        │ TCP:9876                               │
│        ▼                                         │
│  ┌───────────┐                                  │
│  │ claude-   │ ← isolated network (NO internet) │
│  │  chats    │                                  │
│  └───────────┘                                  │
│        │                                         │
│        ▼ :ro                                    │
│  ~/.claude (read-only)                          │
└─────────────────────────────────────────────────┘
```
