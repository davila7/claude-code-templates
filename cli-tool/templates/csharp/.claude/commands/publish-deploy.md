# Publish and Deploy

Complete publishing and deployment workflow for .NET Core applications with multiple deployment targets.

## Purpose

This command handles the complete publishing and deployment process for .NET Core applications including containerization, cloud deployment, and production optimizations.

## Usage

```
/publish-deploy
```

## What this command does

1. **Builds production-ready artifacts** with optimizations
2. **Creates deployment packages** for different platforms
3. **Generates Docker containers** with multi-stage builds
4. **Deploys to cloud platforms** (Azure, AWS, etc.)
5. **Verifies deployment health** and rollback capabilities

## Example Commands

### Local Publishing
```bash
# Publish for current platform
dotnet publish -c Release -o ./publish

# Publish self-contained for Windows
dotnet publish -c Release -r win-x64 --self-contained -o ./publish/win-x64

# Publish self-contained for Linux
dotnet publish -c Release -r linux-x64 --self-contained -o ./publish/linux-x64

# Single-file executable
dotnet publish -c Release -r win-x64 --self-contained -p:PublishSingleFile=true -o ./publish/single-file
```

### Docker Deployment
```bash
# Build production Docker image
docker build -t myapp:latest .

# Build with multi-architecture support
docker buildx build --platform linux/amd64,linux/arm64 -t myapp:latest .

# Tag for registry
docker tag myapp:latest myregistry/myapp:v1.0.0

# Push to registry
docker push myregistry/myapp:v1.0.0

# Run container locally for testing
docker run -d -p 8080:80 --name myapp-test myapp:latest
```

### Production Dockerfile
```dockerfile
# Multi-stage production build
FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine AS base
WORKDIR /app
EXPOSE 80
EXPOSE 443

# Install necessary packages for production
RUN apk add --no-cache icu-libs
ENV DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy project files for better layer caching
COPY ["MyApp.csproj", "./"]
RUN dotnet restore "MyApp.csproj"

# Copy source and build
COPY . .
RUN dotnet build "MyApp.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "MyApp.csproj" -c Release -o /app/publish --no-restore

FROM base AS final
WORKDIR /app

# Create non-root user for security
RUN adduser -D -s /bin/sh appuser
USER appuser

COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "MyApp.dll"]
```

## Cloud Deployment

### Azure App Service
```bash
# Install Azure CLI extension
az extension add --name webapp

# Create resource group
az group create --name myapp-rg --location "East US"

# Create App Service plan
az appservice plan create --name myapp-plan --resource-group myapp-rg --sku B1 --is-linux

# Create web app
az webapp create --resource-group myapp-rg --plan myapp-plan --name myapp-webapp --runtime "DOTNETCORE|8.0"

# Deploy from local publish folder
az webapp deployment source config-zip --resource-group myapp-rg --name myapp-webapp --src ./publish.zip
```

### Azure Container Instances
```bash
# Deploy container to ACI
az container create \
  --resource-group myapp-rg \
  --name myapp-container \
  --image myregistry/myapp:latest \
  --dns-name-label myapp-unique \
  --ports 80 \
  --environment-variables ASPNETCORE_ENVIRONMENT=Production

# Check deployment status
az container show --resource-group myapp-rg --name myapp-container --query "{FQDN:ipAddress.fqdn,ProvisioningState:provisioningState}"
```

### Kubernetes Deployment
```yaml
# k8s-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-deployment
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
      - name: myapp
        image: myregistry/myapp:latest
        ports:
        - containerPort: 80
        env:
        - name: ASPNETCORE_ENVIRONMENT
          value: "Production"
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: myapp-service
spec:
  selector:
    app: myapp
  ports:
  - port: 80
    targetPort: 80
  type: LoadBalancer
```

```bash
# Deploy to Kubernetes
kubectl apply -f k8s-deployment.yaml

# Check deployment status
kubectl get deployments
kubectl get services
kubectl get pods
```

## Production Optimizations

### Performance Tuning
```bash
# Publish with ReadyToRun images for faster startup
dotnet publish -c Release -p:PublishReadyToRun=true -r linux-x64

# Trim unused assemblies
dotnet publish -c Release -p:PublishTrimmed=true -r linux-x64 --self-contained

# Enable tiered compilation
dotnet publish -c Release -p:TieredCompilation=true
```

### Production Configuration
```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Warning",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "myapp.com,*.myapp.com",
  "ConnectionStrings": {
    "DefaultConnection": "Server=prod-server;Database=MyApp;User Id=app_user;Password=secure_password;"
  },
  "Kestrel": {
    "Limits": {
      "MaxConcurrentConnections": 100,
      "MaxConcurrentUpgradedConnections": 100,
      "MaxRequestBodySize": 10485760
    }
  },
  "ForwardedHeaders": {
    "ForwardedHeaders": "XForwardedFor,XForwardedProto"
  }
}
```

### Health Checks Setup
```csharp
// Program.cs additions for production
builder.Services.AddHealthChecks()
    .AddDbContext<AppDbContext>()
    .AddUrlGroup(new Uri("https://external-api.com/health"), "external-api");

app.MapHealthChecks("/health", new HealthCheckOptions
{
    ResponseWriter = UIResponseWriter.WriteHealthCheckUIResponse
});

app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready"),
    ResponseWriter = UIResponseWriter.WriteHealthCheckUIResponse
});
```

## Monitoring and Logging

### Application Insights Integration
```bash
# Add Application Insights package
dotnet add package Microsoft.ApplicationInsights.AspNetCore

# Configure in appsettings.json
{
  "ApplicationInsights": {
    "InstrumentationKey": "your-instrumentation-key"
  }
}
```

### Structured Logging with Serilog
```bash
# Add Serilog packages
dotnet add package Serilog.AspNetCore
dotnet add package Serilog.Sinks.Console
dotnet add package Serilog.Sinks.File
dotnet add package Serilog.Sinks.ApplicationInsights
```

## Deployment Verification

### Health Check Scripts
```bash
#!/bin/bash
# health-check.sh

ENDPOINT="https://myapp.com/health"
TIMEOUT=30

echo "Checking application health..."
response=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT $ENDPOINT)

if [ $response -eq 200 ]; then
    echo "✅ Application is healthy"
    exit 0
else
    echo "❌ Application health check failed (HTTP $response)"
    exit 1
fi
```

### Smoke Tests
```bash
# smoke-tests.sh
#!/bin/bash

BASE_URL="https://myapp.com"

# Test endpoints
echo "Running smoke tests..."

# Health check
curl -f "$BASE_URL/health" || exit 1

# API endpoints
curl -f "$BASE_URL/api/users" -H "Accept: application/json" || exit 1

# Static content
curl -f "$BASE_URL/" || exit 1

echo "✅ All smoke tests passed"
```

## Rollback Strategies

### Blue-Green Deployment
```bash
# Deploy to staging slot (Azure)
az webapp deployment slot create --resource-group myapp-rg --name myapp-webapp --slot staging

# Deploy to staging
az webapp deployment source config-zip --resource-group myapp-rg --name myapp-webapp --slot staging --src ./publish.zip

# Swap slots after verification
az webapp deployment slot swap --resource-group myapp-rg --name myapp-webapp --slot staging --target-slot production
```

### Container Rollback
```bash
# Tag current production version
docker tag myregistry/myapp:latest myregistry/myapp:rollback

# Rollback to previous version
kubectl set image deployment/myapp-deployment myapp=myregistry/myapp:v1.0.0

# Verify rollback
kubectl rollout status deployment/myapp-deployment
```

## Best Practices

### Security
- Use minimal base images (Alpine Linux)
- Run containers as non-root users
- Scan images for vulnerabilities before deployment
- Use secrets management for sensitive configuration
- Enable HTTPS redirect and HSTS headers

### Performance
- Enable response compression and caching
- Use CDN for static content
- Implement proper connection pooling
- Monitor memory usage and garbage collection
- Use ReadyToRun images for faster startup

### Reliability
- Implement health checks for all external dependencies
- Use circuit breaker patterns for external calls
- Set up proper logging and monitoring
- Plan for graceful shutdown handling
- Implement retry policies with exponential backoff