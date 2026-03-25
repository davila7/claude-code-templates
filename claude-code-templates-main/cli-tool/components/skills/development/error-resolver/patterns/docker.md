# Docker Error Patterns

Common Docker and container errors with diagnosis and solutions.

## Build Errors

### Dockerfile parse error

```
failed to solve: dockerfile parse error
```

**Causes**:
1. Syntax error in Dockerfile
2. Invalid instruction
3. Missing required argument

**Common Issues**:
```dockerfile
# Wrong - missing argument
FROM

# Correct
FROM node:18-alpine

# Wrong - instruction case (older Docker)
from node:18
run npm install

# Correct - uppercase instructions
FROM node:18
RUN npm install
```

---

### COPY failed: file not found

```
COPY failed: file not found in build context
```

**Causes**:
1. File doesn't exist
2. File is in .dockerignore
3. Wrong path (relative to build context)

**Diagnosis**:
```bash
# Check build context
ls -la

# Check .dockerignore
cat .dockerignore

# Build with verbose output
docker build --progress=plain .
```

**Solutions**:
```dockerfile
# Path is relative to build context, not Dockerfile
# If Dockerfile is in root, and file is in root:
COPY package.json .

# If building from parent directory:
# docker build -f app/Dockerfile .
COPY app/package.json .

# Check file exists in build context
# (not in .dockerignore)
```

---

### RUN command failed

```
ERROR: failed to solve: process "/bin/sh -c npm install" did not complete successfully
```

**Diagnosis**:
```bash
# Build with no cache to see full output
docker build --no-cache --progress=plain .
```

**Common Fixes**:
```dockerfile
# Add build dependencies
FROM node:18-alpine
RUN apk add --no-cache python3 make g++  # For native modules
COPY package*.json ./
RUN npm install

# Use specific npm version
RUN npm install -g npm@10
RUN npm ci

# Clear npm cache if issues
RUN npm cache clean --force
```

---

### Cannot connect to Docker daemon

```
Cannot connect to the Docker daemon at unix:///var/run/docker.sock
```

**Causes**:
1. Docker not running
2. Permission denied
3. Wrong socket path

**Solutions**:
```bash
# Start Docker
# macOS - start Docker Desktop

# Linux
sudo systemctl start docker

# Check status
docker info

# Permission issue - add user to docker group
sudo usermod -aG docker $USER
newgrp docker  # Or logout/login
```

---

### No space left on device

```
no space left on device
```

**Solutions**:
```bash
# Remove unused resources
docker system prune -a

# Remove all unused images
docker image prune -a

# Remove all stopped containers
docker container prune

# Remove unused volumes
docker volume prune

# Check disk usage
docker system df
```

---

## Runtime Errors

### Container exits immediately

```
Container exited with code 0/1
```

**Diagnosis**:
```bash
# Check logs
docker logs container_name

# Run interactively
docker run -it image_name /bin/sh

# Check entrypoint
docker inspect image_name | grep -A5 Entrypoint
```

**Common Causes**:

1. **No foreground process**
```dockerfile
# Wrong - runs in background
CMD ["node", "server.js", "&"]

# Correct - runs in foreground
CMD ["node", "server.js"]
```

2. **Script exits**
```dockerfile
# Keep container running
CMD ["tail", "-f", "/dev/null"]
```

3. **Error on startup**
```bash
# Check exit code
docker inspect container_name --format='{{.State.ExitCode}}'
```

---

### Port already in use

```
Error: listen EADDRINUSE: address already in use :::3000
Bind for 0.0.0.0:3000 failed: port is already allocated
```

**Diagnosis**:
```bash
# Find what's using the port
lsof -i :3000
netstat -tulpn | grep 3000

# Find container using port
docker ps --format "table {{.Names}}\t{{.Ports}}"
```

**Solutions**:
```bash
# Use different port
docker run -p 3001:3000 image_name

# Stop container using port
docker stop $(docker ps -q --filter publish=3000)

# Kill process using port
kill $(lsof -t -i:3000)
```

---

### Permission denied

```
permission denied while trying to connect to the Docker daemon socket
```

**Solutions**:
```bash
# Run with sudo (not recommended for regular use)
sudo docker ps

# Better - add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify
groups | grep docker
```

---

### OOMKilled

```
Container killed due to OOM (Out of Memory)
```

**Diagnosis**:
```bash
docker inspect container_name | grep -i oom
```

**Solutions**:
```bash
# Increase memory limit
docker run -m 2g image_name

# In docker-compose.yml
services:
  app:
    deploy:
      resources:
        limits:
          memory: 2G
```

---

## Networking Errors

### Cannot resolve hostname

```
Could not resolve host: api.example.com
```

**Causes**:
1. No network access
2. DNS not configured
3. Network mode issue

**Solutions**:
```bash
# Check container network
docker inspect container_name | grep -A20 NetworkSettings

# Use host network (development)
docker run --network host image_name

# Add DNS server
docker run --dns 8.8.8.8 image_name
```

---

### Connection refused between containers

```
Error: connect ECONNREFUSED 172.17.0.2:5432
```

**Causes**:
1. Containers not on same network
2. Using wrong hostname
3. Target service not ready

**Solutions**:
```yaml
# docker-compose.yml - use service names as hostnames
services:
  app:
    depends_on:
      - db
    environment:
      DATABASE_URL: postgresql://db:5432/mydb  # 'db' is the service name

  db:
    image: postgres
```

```bash
# Create network and connect containers
docker network create mynetwork
docker run --network mynetwork --name db postgres
docker run --network mynetwork --name app myapp

# In app, connect to 'db' hostname
```

---

### Network not found

```
network mynetwork not found
```

**Solutions**:
```bash
# Create network
docker network create mynetwork

# List networks
docker network ls

# In docker-compose, networks are created automatically
# Or define explicitly:
```

```yaml
networks:
  mynetwork:
    driver: bridge

services:
  app:
    networks:
      - mynetwork
```

---

## Volume Errors

### Volume mount permission denied

```
permission denied: '/app/data'
```

**Causes**:
1. Container user can't write to mounted directory
2. SELinux/AppArmor blocking
3. Host directory permissions

**Solutions**:
```bash
# Check host directory permissions
ls -la /host/path

# Fix permissions
chmod 777 /host/path  # Not recommended for production
# Or
chown 1000:1000 /host/path  # Match container user ID

# SELinux - add :z or :Z suffix
docker run -v /host/path:/container/path:z image_name

# Run as root (not recommended)
docker run --user root image_name
```

```dockerfile
# In Dockerfile - create directory as root, then switch user
RUN mkdir -p /app/data && chown -R node:node /app
USER node
```

---

### Volume not found

```
Error: No such volume: myvolume
```

**Solutions**:
```bash
# Create volume
docker volume create myvolume

# List volumes
docker volume ls

# In docker-compose
volumes:
  myvolume:

services:
  app:
    volumes:
      - myvolume:/app/data
```

---

## Image Errors

### Image not found

```
Unable to find image 'myimage:latest' locally
Error response from daemon: pull access denied
```

**Causes**:
1. Image doesn't exist
2. Not logged into registry
3. Private image without auth

**Solutions**:
```bash
# Check if image exists
docker images | grep myimage

# Login to registry
docker login
docker login registry.example.com

# Pull explicitly
docker pull myimage:latest

# For private registries
docker pull registry.example.com/myimage:latest
```

---

### Manifest not found

```
manifest for image:tag not found
```

**Causes**:
1. Tag doesn't exist
2. Architecture mismatch (arm64 vs amd64)

**Solutions**:
```bash
# Check available tags
docker manifest inspect image_name

# Specify platform
docker pull --platform linux/amd64 image_name

# Build for multiple platforms
docker buildx build --platform linux/amd64,linux/arm64 -t myimage .
```

---

## Docker Compose Errors

### Service failed to build

```
ERROR: Service 'app' failed to build
```

**Diagnosis**:
```bash
# Build with verbose output
docker-compose build --no-cache --progress=plain app
```

---

### Depends_on not waiting

```
Connection refused to database
```

**Problem**: `depends_on` only waits for container start, not service ready.

**Solutions**:
```yaml
# Use healthcheck
services:
  db:
    image: postgres
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  app:
    depends_on:
      db:
        condition: service_healthy
```

```bash
# Or use wait script in app
#!/bin/sh
until pg_isready -h db -p 5432; do
  echo "Waiting for database..."
  sleep 2
done
exec "$@"
```

---

## Quick Reference Table

| Error | Category | Quick Fix |
|-------|----------|-----------|
| Cannot connect to daemon | Setup | Start Docker, check permissions |
| No space left | Disk | `docker system prune -a` |
| COPY failed | Build | Check path relative to build context |
| Container exits immediately | Runtime | Add foreground process |
| Port already in use | Network | Use different port or stop other container |
| OOMKilled | Memory | Increase memory limit with `-m` |
| Connection refused between containers | Network | Use same network, service names |
| Volume permission denied | Volume | Fix host permissions, use :z |
| Image not found | Image | `docker login`, check registry |
| Depends_on not waiting | Compose | Use healthcheck with condition |
