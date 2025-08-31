---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [deployment-type] | --microservices | --monolith | --stateful | --full-stack | --production-ready
description: Configure comprehensive Kubernetes deployment with manifests, security, scaling, and production best practices
model: sonnet
---

# Kubernetes Deployment Configuration

Configure Kubernetes deployment: $ARGUMENTS

## Current Environment Analysis

- Application type: @package.json or @Dockerfile (detect containerization readiness)
- Existing K8s config: !`find . -name "*.yaml" -o -name "*.yml" | grep -E "(k8s|kubernetes|deployment|service)" | head -3`
- Cluster access: !`kubectl cluster-info 2>/dev/null | head -2 || echo "No cluster access"`
- Container registry: @docker-compose.yml or check for registry configuration
- Resource requirements: Analysis needed based on application type

## Task

Implement production-ready Kubernetes deployment:

1. **Kubernetes Architecture Planning**
   - Analyze application architecture and deployment requirements
   - Define resource requirements (CPU, memory, storage, network)
   - Plan namespace organization and multi-tenancy strategy
   - Assess high availability and disaster recovery requirements
   - Define scaling strategies and performance requirements

2. **Cluster Setup and Configuration**
   - Set up Kubernetes cluster (managed or self-hosted)
   - Configure cluster networking and CNI plugin
   - Set up cluster storage classes and persistent volumes
   - Configure cluster security policies and RBAC
   - Set up cluster monitoring and logging infrastructure

3. **Application Containerization**
   - Ensure application is properly containerized
   - Optimize container images for Kubernetes deployment
   - Configure multi-stage builds and security scanning
   - Set up container registry and image management
   - Configure image pull policies and secrets

4. **Kubernetes Manifest Creation**
   - Create Deployment manifests with proper resource limits
   - Set up Service manifests for internal and external communication
   - Configure ConfigMaps and Secrets for configuration management
   - Create PersistentVolumeClaims for data storage
   - Set up NetworkPolicies for security and isolation

5. **Load Balancing and Ingress**
   - Configure Ingress controllers and routing rules
   - Set up SSL/TLS termination and certificate management
   - Configure load balancing strategies and session affinity
   - Set up external DNS and domain management
   - Configure traffic management and canary deployments

6. **Auto-scaling Configuration**
   - Set up Horizontal Pod Autoscaler (HPA) based on metrics
   - Configure Vertical Pod Autoscaler (VPA) for resource optimization
   - Set up Cluster Autoscaler for node scaling
   - Configure custom metrics and scaling policies
   - Set up resource quotas and limits

7. **Health Checks and Monitoring**
   - Configure liveness and readiness probes
   - Set up startup probes for slow-starting applications
   - Configure health check endpoints and monitoring
   - Set up application metrics collection
   - Configure alerting and notification systems

8. **Security and Compliance**
   - Configure Pod Security Standards and policies
   - Set up network segmentation and security policies
   - Configure service accounts and RBAC permissions
   - Set up secret management and rotation
   - Configure security scanning and compliance monitoring

9. **CI/CD Integration**
   - Set up automated Kubernetes deployment pipelines
   - Configure GitOps workflows with ArgoCD or Flux
   - Set up automated testing in Kubernetes environments
   - Configure blue-green and canary deployment strategies
   - Set up rollback and disaster recovery procedures

10. **Operations and Maintenance**
    - Set up cluster maintenance and update procedures
    - Configure backup and disaster recovery strategies
    - Set up cost optimization and resource management
    - Create operational runbooks and troubleshooting guides
    - Train team on Kubernetes operations and best practices
    - Set up cluster lifecycle management and governance