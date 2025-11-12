# DevOps IaC Engineer Skill - Directory Structure & Quick Reference

## Complete Directory Structure

```
DevOps IaC Engineer/
│
├── SKILL.md                                    ← Main skill file (START HERE)
├── README.md                                   ← Overview and quick start guide
├── DIRECTORY_STRUCTURE.md                      ← This file
│
├── reference/                                  ← Core reference materials
│   ├── terraform.md                           ← Terraform best practices & patterns
│   ├── kubernetes.md                          ← Kubernetes & container orchestration
│   ├── cloud_platforms.md                     ← AWS, Azure, GCP guidance (to be created)
│   ├── cicd.md                                ← CI/CD pipelines & GitOps (to be created)
│   ├── observability.md                       ← Monitoring, logging, tracing (to be created)
│   ├── security.md                            ← DevSecOps practices (to be created)
│   └── templates.md                           ← Ready-to-use templates
│
├── scripts/                                    ← Executable utility scripts
│   └── devops_utils.py                        ← Common DevOps automation tasks
│
├── examples/                                   ← Sample files for reference
│   ├── terraform/                             ← Example Terraform configurations
│   ├── kubernetes/                            ← Example Kubernetes manifests
│   └── pipelines/                             ← Example CI/CD pipelines
│
└── [After customization, you may add]:
    ├── company-standards/                     ← Your organization's standards
    ├── runbooks/                              ← Operational runbooks
    └── architecture/                          ← Architecture diagrams and docs
```

### File Relationships

```
SKILL.md (Entry point)
  │
  ├─→ reference/terraform.md
  │   ├─ For: Infrastructure as Code, Terraform modules
  │   ├─ Use when: Provisioning cloud infrastructure
  │   └─ Contains: Best practices, module templates, state management
  │
  ├─→ reference/kubernetes.md
  │   ├─ For: Container orchestration, deployments
  │   ├─ Use when: Deploying containerized applications
  │   └─ Contains: Production-ready manifests, Helm charts, RBAC
  │
  ├─→ reference/cloud_platforms.md
  │   ├─ For: AWS, Azure, GCP architecture
  │   ├─ Use when: Designing cloud solutions
  │   └─ Contains: Well-Architected patterns, service selection
  │
  ├─→ reference/cicd.md
  │   ├─ For: CI/CD pipelines, GitOps workflows
  │   ├─ Use when: Automating deployments
  │   └─ Contains: Pipeline templates, testing strategies
  │
  ├─→ reference/observability.md
  │   ├─ For: Monitoring, logging, tracing
  │   ├─ Use when: Implementing observability
  │   └─ Contains: SLI/SLO frameworks, alert rules
  │
  ├─→ reference/security.md
  │   ├─ For: DevSecOps, compliance, secrets management
  │   ├─ Use when: Securing infrastructure and applications
  │   └─ Contains: Security best practices, compliance automation
  │
  ├─→ reference/templates.md
  │   ├─ For: Ready-to-use configurations
  │   ├─ Use when: Need quick-start templates
  │   └─ Contains: Complete application stacks, pipelines
  │
  └─→ scripts/devops_utils.py
      ├─ For: Automated DevOps tasks
      ├─ Use when: Generating boilerplate, validation
      └─ Contains: Terraform init, K8s validation, secret scanning
```

---

## Quick Reference By Use Case

### "I need to provision cloud infrastructure"
1. Read: [SKILL.md](SKILL.md) → Section "Workflow: Infrastructure Implementation"
2. Use: [reference/terraform.md](reference/terraform.md) → Module templates
3. Reference: [reference/cloud_platforms.md](reference/cloud_platforms.md) → Architecture patterns
4. Tool: `python scripts/devops_utils.py terraform init-project`

### "I need to deploy a containerized application"
1. Read: [reference/kubernetes.md](reference/kubernetes.md) → Production-ready deployment
2. Use: [reference/templates.md](reference/templates.md) → Complete application stack
3. Validate: `python scripts/devops_utils.py k8s validate --file deployment.yaml`

### "I need to set up a CI/CD pipeline"
1. Read: [reference/cicd.md](reference/cicd.md) → Pipeline design patterns
2. Choose: [reference/templates.md](reference/templates.md) → GitHub Actions, GitLab CI
3. Implement: GitOps with ArgoCD or Flux

### "I need to implement monitoring"
1. Read: [reference/observability.md](reference/observability.md) → SLI/SLO framework
2. Use: [reference/templates.md](reference/templates.md) → Prometheus rules
3. Set up: Dashboards and alerting

### "I need to secure my infrastructure"
1. Read: [reference/security.md](reference/security.md) → DevSecOps practices
2. Scan: `python scripts/devops_utils.py security scan-secrets`
3. Implement: Policy as code, secrets management

---

## Navigation Tips

### For DevOps Beginners
**Start with**: README.md → SKILL.md → One reference file based on your task

**Suggested First Tasks**:
1. Read SKILL.md core principles
2. Initialize Terraform project with utility script
3. Deploy sample application to Kubernetes
4. Set up basic monitoring

### For Experienced Engineers
**Start with**: Specific reference file based on current task

**Advanced Features**:
1. Multi-cloud Terraform modules
2. Advanced Kubernetes patterns (StatefulSets, Operators)
3. GitOps workflows with progressive delivery
4. Custom observability with distributed tracing

### For Platform Teams
**Focus on**:
1. Creating reusable Terraform modules
2. Building self-service platforms
3. Implementing policy as code
4. Establishing SRE practices

---

## File Dependencies & Links

**No file depends on other files being loaded** - This is by design.

- Each reference file is self-contained
- No circular references between files
- All links point FROM reference files, not between them
- SKILL.md is the only entry point

This architecture ensures:
- ✓ Efficient context usage
- ✓ Parallel loading of information
- ✓ No broken reference chains
- ✓ Easy file updates without cascading changes

---

## Tool Usage

### DevOps Utilities Script

```bash
# Initialize Terraform project
python scripts/devops_utils.py terraform init-project \
  --name myproject --cloud aws --region us-east-1

# Validate Terraform files
python scripts/devops_utils.py terraform validate --file main.tf

# Validate Kubernetes manifests
python scripts/devops_utils.py k8s validate --file deployment.yaml

# Generate Kubernetes deployment
python scripts/devops_utils.py k8s generate \
  --name myapp --image myapp:1.0.0 --namespace production

# Initialize GitOps structure
python scripts/devops_utils.py gitops init \
  --tool argocd --environments dev,staging,prod

# Scan for secrets
python scripts/devops_utils.py security scan-secrets --directory .
```

---

## Best Practices Summary

### Infrastructure as Code
1. **Version everything** in Git
2. **Use modules** for reusability
3. **Implement state locking** (S3 + DynamoDB)
4. **Never hardcode secrets**
5. **Tag all resources** consistently

### Kubernetes
1. **Set resource limits** on all containers
2. **Implement health checks** (liveness, readiness)
3. **Use namespaces** for isolation
4. **Enable RBAC** and network policies
5. **Run as non-root** user

### CI/CD
1. **Automate everything** possible
2. **Test before deploy** (lint, security scan, unit tests)
3. **Use GitOps** for declarative deployments
4. **Implement rollback** strategies
5. **Monitor deployments** closely

### Security
1. **Least privilege** access
2. **Encrypt data** at rest and in transit
3. **Scan for vulnerabilities** regularly
4. **Rotate secrets** automatically
5. **Audit all changes**

---

## Storage & Sharing

The complete skill folder can be:
- **Shared** - Copy entire folder to team members
- **Backed up** - Store in version control (git)
- **Customized** - Modify files for your organization
- **Extended** - Add new files while maintaining structure

**Recommended**: Store in git repository for version tracking and collaboration.

---

**Last Updated**: October 2025
**Version**: 1.0
**Compatible Models**: Claude 4 family (Opus 4.1, Sonnet 4.5, Haiku 4.5)
