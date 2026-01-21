# DevOps IaC Engineer Skill for Claude

A comprehensive Claude skill designed to help DevOps teams implement infrastructure as code, manage cloud platforms, deploy containerized applications, and maintain reliable production systems.

## Overview

This skill provides frameworks, templates, and best practices for:
- **Terraform & IaC** - Infrastructure as Code implementation patterns
- **Kubernetes & Containers** - Container orchestration and deployment
- **Cloud Platforms** - AWS, Azure, GCP architecture and services
- **CI/CD Pipelines** - GitOps, automated testing, and deployment
- **Observability** - Monitoring, logging, and tracing strategies
- **Security** - DevSecOps practices and compliance automation
- **Ready-to-Use Templates** - Production-ready configurations

## File Structure

```
DevOps IaC Engineer/
├── SKILL.md                          # Main skill file with overview & core workflows
├── reference/
│   ├── terraform.md                  # Terraform best practices and patterns
│   ├── kubernetes.md                 # Kubernetes and container orchestration
│   ├── cloud_platforms.md            # AWS, Azure, GCP guidance
│   ├── cicd.md                       # CI/CD pipelines and GitOps
│   ├── observability.md              # Monitoring, logging, and tracing
│   ├── security.md                   # DevSecOps and compliance
│   └── templates.md                  # Ready-to-use templates
├── scripts/
│   └── devops_utils.py               # Utility scripts for common DevOps tasks
├── examples/
│   ├── terraform/                    # Example Terraform configurations
│   ├── kubernetes/                   # Example Kubernetes manifests
│   └── pipelines/                    # Example CI/CD pipelines
└── README.md                         # This file
```

## Quick Start

### 1. For Infrastructure as Code
Start with [SKILL.md](SKILL.md) → [reference/terraform.md](reference/terraform.md)
- Use Terraform module templates for reusable infrastructure
- Implement remote state management with S3 + DynamoDB
- Follow security best practices for secrets and credentials
- Apply cost optimization patterns

### 2. For Kubernetes Deployments
[reference/kubernetes.md](reference/kubernetes.md) → [reference/templates.md](reference/templates.md)
- Deploy production-ready workloads with health checks
- Implement autoscaling (HPA/VPA)
- Configure RBAC and network policies
- Use Helm charts for application packaging

### 3. For Cloud Architecture
[reference/cloud_platforms.md](reference/cloud_platforms.md)
- Design multi-tier architectures on AWS/Azure/GCP
- Implement high availability and disaster recovery
- Optimize costs with right-sizing and spot instances
- Follow Well-Architected Framework principles

### 4. For CI/CD Pipelines
[reference/cicd.md](reference/cicd.md)
- Implement GitOps workflows with ArgoCD or Flux
- Create automated testing pipelines
- Configure deployment strategies (blue/green, canary)
- Set up infrastructure validation and security scanning

### 5. For Observability
[reference/observability.md](reference/observability.md)
- Define SLIs, SLOs, and SLAs
- Implement structured logging with correlation IDs
- Set up distributed tracing
- Create actionable alerts and runbooks

### 6. For Security
[reference/security.md](reference/security.md)
- Implement least privilege access
- Automate security scanning and compliance checks
- Manage secrets with cloud-native solutions
- Apply zero-trust networking principles

## Using the Utility Scripts

### Generate Terraform Boilerplate
```bash
python scripts/devops_utils.py terraform init-project \
  --name myproject \
  --cloud aws \
  --region us-east-1
```

### Validate Kubernetes Manifests
```bash
python scripts/devops_utils.py k8s validate \
  --file deployment.yaml \
  --schema-version 1.28
```

### Generate GitOps Structure
```bash
python scripts/devops_utils.py gitops init \
  --tool argocd \
  --environments dev,staging,prod
```

## Key Concepts

### Infrastructure as Code Principles
All infrastructure should be:
- **Version Controlled**: Track all changes in Git
- **Declarative**: Define desired state, not imperative steps
- **Idempotent**: Multiple runs produce same result
- **Modular**: Reusable components with clear interfaces
- **Tested**: Automated validation and security scanning
- **Documented**: Clear README and inline comments

### DevOps Best Practices
This skill follows the DevOps best practices:

✓ **Security First** - Never hardcode credentials, use least privilege
✓ **Immutable Infrastructure** - Replace rather than modify
✓ **GitOps Workflows** - Git as single source of truth
✓ **Observability Built-In** - Logs, metrics, and traces from day one
✓ **Cost Optimization** - Right-size resources, use spot instances
✓ **Disaster Recovery** - Automated backups and tested failover
✓ **CI/CD Automation** - Automated testing and deployment
✓ **Policy as Code** - Automated compliance and governance

## Customization Guide

### For Your Organization

Before using this skill, customize:

1. **Cloud Provider Standards** ([reference/cloud_platforms.md](reference/cloud_platforms.md))
   - Update with your organization's cloud accounts
   - Add your naming conventions and tagging standards
   - Include your cost allocation and budgeting approach

2. **Security Requirements** ([reference/security.md](reference/security.md))
   - Define your compliance requirements (HIPAA, PCI-DSS, SOC2)
   - Specify your secrets management solution
   - Add your organization's security policies

3. **Naming Conventions** (Throughout all files)
   - Replace generic names with your naming standards
   - Use consistent environment names (dev, staging, prod)
   - Include your resource tagging strategy

4. **Observability Tools** ([reference/observability.md](reference/observability.md))
   - Specify your monitoring stack (Prometheus, Datadog, New Relic)
   - Define your logging solution (ELK, Splunk, CloudWatch)
   - Add your alerting and on-call system

## Common DevOps Workflows

### Workflow: Deploy New Application
1. Design architecture using [reference/cloud_platforms.md](reference/cloud_platforms.md)
2. Create infrastructure with [reference/terraform.md](reference/terraform.md)
3. Containerize application and deploy with [reference/kubernetes.md](reference/kubernetes.md)
4. Set up CI/CD pipeline using [reference/cicd.md](reference/cicd.md)
5. Implement monitoring with [reference/observability.md](reference/observability.md)
6. Apply security controls from [reference/security.md](reference/security.md)

### Workflow: Cloud Migration
1. Assess current architecture and dependencies
2. Design target cloud architecture
3. Create infrastructure as code modules
4. Implement migration pipeline with testing
5. Execute phased migration
6. Validate and optimize

### Workflow: Implement GitOps
1. Set up Git repository structure
2. Install ArgoCD or Flux in cluster
3. Create application manifests and Helm charts
4. Configure automated sync policies
5. Implement progressive delivery
6. Set up monitoring and alerts

## Troubleshooting

**Issue**: Terraform state conflicts
**Solution**: Use remote state with locking (S3 + DynamoDB), implement state file backups, check for concurrent runs

**Issue**: Kubernetes pods failing health checks
**Solution**: Review pod logs, check resource limits, verify network policies, validate environment variables

**Issue**: High cloud costs
**Solution**: Implement tagging strategy, use cost allocation tags, right-size resources, use spot instances, enable auto-scaling

**Issue**: Secrets exposed in Git
**Solution**: Use git-secrets or trufflehog to scan, rotate exposed secrets immediately, implement SOPS or Sealed Secrets

## Support & Questions

Each reference file includes:
- Best practices and proven patterns
- Common mistakes to avoid
- Production-ready examples
- Implementation guidance

For questions about specific topics:
- **Terraform & IaC**: See [reference/terraform.md](reference/terraform.md)
- **Kubernetes**: See [reference/kubernetes.md](reference/kubernetes.md)
- **Cloud platforms**: See [reference/cloud_platforms.md](reference/cloud_platforms.md)
- **CI/CD**: See [reference/cicd.md](reference/cicd.md)
- **Observability**: See [reference/observability.md](reference/observability.md)
- **Security**: See [reference/security.md](reference/security.md)

## Version History

- **v1.0** - Initial release with core DevOps functions
  - Terraform best practices and module patterns
  - Kubernetes production-ready configurations
  - Cloud platform guidance (AWS, Azure, GCP)
  - CI/CD pipeline templates
  - Observability frameworks
  - DevSecOps practices
  - Utility scripts for common tasks

## License & Usage

This skill is designed for use with Claude AI. Adapt and customize for your organization's specific needs.

---

**Last Updated**: October 2025
**Skill Version**: 1.0
**For Claude Models**: Claude Opus 4.1, Claude Sonnet 4.5, Claude Haiku 4.5
