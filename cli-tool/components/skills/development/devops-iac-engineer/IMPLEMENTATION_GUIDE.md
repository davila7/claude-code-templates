# DevOps IaC Engineer Skill - Implementation Guide

## Deployment Checklist

Use this checklist to ensure the DevOps IaC Engineer Skill is properly deployed and ready for your team.

### Phase 1: Preparation (Before Deployment)

**File Structure Validation**
- [ ] All files created in correct locations with proper structure
- [ ] SKILL.md exists in root directory with proper YAML frontmatter
- [ ] All reference files in `/reference/` directory
- [ ] Python script in `/scripts/` directory
- [ ] Example files in `/examples/` directory
- [ ] README.md in root directory

**File Content Verification**
- [ ] SKILL.md has required frontmatter (name: 64 chars max, description: 1024 chars max)
- [ ] All reference files use markdown format (.md)
- [ ] Python script is executable and tested
- [ ] Links between files use correct relative paths (forward slashes)

**Quality Review**
- [ ] No typos in SKILL.md or reference files
- [ ] Terminology is consistent throughout
- [ ] All internal links tested and working
- [ ] Code in scripts directory is well-commented
- [ ] Examples folder contains working sample configurations

### Phase 2: Customization (Modify for Your Organization)

**Cloud Provider Standards**
- [ ] Update cloud provider preferences (AWS/Azure/GCP)
- [ ] Add your organization's cloud account structure
- [ ] Include your naming conventions
- [ ] Define your tagging strategy
- [ ] Add your cost allocation approach

**Security & Compliance**
- [ ] Update [reference/security.md](reference/security.md):
  - [ ] Add your compliance requirements (HIPAA, PCI-DSS, SOC2, etc.)
  - [ ] Specify your secrets management solution
  - [ ] Include your organization's security policies
  - [ ] Add your vulnerability scanning tools

**Infrastructure Standards**
- [ ] Define your Terraform module standards
- [ ] Specify your Kubernetes cluster configurations
- [ ] Add your CI/CD tool preferences
- [ ] Include your observability stack

**Naming Conventions**
- [ ] Review consistent terminology throughout (search and replace if needed)
- [ ] Update environment names (dev, staging, prod, etc.)
- [ ] Add your resource naming patterns
- [ ] Include your label/tag standards

### Phase 3: Testing (Verify Skill Works)

**Functionality Tests**

**Test 1: Terraform Project Initialization**
- [ ] Run: `python scripts/devops_utils.py terraform init-project --name test --cloud aws --region us-east-1`
- [ ] Verify directory structure is created correctly
- [ ] Check that all template files are generated
- [ ] Validate Terraform syntax

**Test 2: Kubernetes Validation**
- [ ] Run: `python scripts/devops_utils.py k8s validate --file examples/kubernetes/complete-app.yaml`
- [ ] Verify validation passes
- [ ] Check all manifests are recognized
- [ ] Test with invalid YAML to ensure error detection

**Test 3: Security Scanning**
- [ ] Run: `python scripts/devops_utils.py security scan-secrets --directory .`
- [ ] Verify no secrets are detected in examples
- [ ] Test with a file containing a fake secret
- [ ] Ensure detection works correctly

**Test 4: Template Usage**
- [ ] Deploy example Kubernetes application
- [ ] Verify all resources are created
- [ ] Check health checks work
- [ ] Validate autoscaling configuration

**Test 5: CI/CD Pipeline**
- [ ] Use GitHub Actions example pipeline
- [ ] Test build and push stages
- [ ] Verify deployment logic
- [ ] Check rollback procedures

**Performance Tests**

**Token Usage**
- [ ] SKILL.md body is under 500 lines ✓
- [ ] Reference files are at appropriate length
- [ ] No unnecessary repetition between files
- [ ] Files load efficiently without excessive context

**Load Tests**
- [ ] Test with Haiku model (fast, economical)
- [ ] Test with Sonnet model (balanced)
- [ ] Test with Opus model (powerful reasoning)
- [ ] Verify consistent behavior across models

### Phase 4: Deployment

**Make Skill Available**
- [ ] Upload all files to skill repository/system
- [ ] Verify file structure matches expected format
- [ ] Test that Claude can access all files
- [ ] Confirm skill appears in available skills list

**Team Onboarding**
- [ ] Share README.md with team
- [ ] Provide quick start guide (specific to your organization)
- [ ] Schedule skill training/demo session
- [ ] Create internal documentation on how to use

**Process Documentation**
- [ ] Document your standard infrastructure workflow
- [ ] Create quick reference guides for common tasks
- [ ] Establish when to use each reference file
- [ ] Document any customizations you made

### Phase 5: Optimization (After Initial Use)

**Monitor Usage**
- [ ] Track which parts of the skill are used most
- [ ] Note any confusion or questions from team
- [ ] Collect feedback on missing information
- [ ] Track time saved vs. previous approach

**Iterative Improvements**
- [ ] Update based on team feedback
- [ ] Add organization-specific examples
- [ ] Refine terminology based on actual usage
- [ ] Improve unclear sections
- [ ] Add new templates based on common needs

**Knowledge Capture**
- [ ] Document successful infrastructure patterns discovered
- [ ] Add new modules as they're created
- [ ] Update with actual performance data
- [ ] Share lessons learned with team

---

## Customization Template

When customizing the skill for your organization, use this template:

### 1. Organization Information
- **Company Name**: [Your Company]
- **Industry**: [Your Industry]
- **Cloud Provider(s)**: [AWS/Azure/GCP]
- **Primary Services**: [List key applications/services]
- **Team Size**: [Number of engineers]

### 2. Infrastructure Standards
- **IaC Tool**: [Terraform/Pulumi/CloudFormation]
- **Container Orchestration**: [Kubernetes/ECS/Other]
- **CI/CD Platform**: [GitHub Actions/GitLab CI/Jenkins]
- **GitOps Tool**: [ArgoCD/Flux/Other]

### 3. Cloud Architecture
- **Primary Cloud**: [AWS/Azure/GCP]
- **Multi-Cloud**: [Yes/No]
- **Account Structure**: [Multi-account strategy]
- **Regions**: [List primary regions]

### 4. Security & Compliance
- **Compliance Requirements**: [HIPAA/PCI-DSS/SOC2/etc.]
- **Secrets Manager**: [AWS Secrets Manager/Vault/etc.]
- **Security Scanning**: [Trivy/Snyk/Checkov/etc.]
- **SIEM/Logging**: [Splunk/ELK/CloudWatch/etc.]

### 5. Observability Stack
- **Metrics**: [Prometheus/Datadog/New Relic/etc.]
- **Logging**: [ELK/Splunk/CloudWatch/etc.]
- **Tracing**: [Jaeger/Zipkin/X-Ray/etc.]
- **Alerting**: [PagerDuty/Opsgenie/etc.]

### 6. Naming Conventions
- **Resource Naming**: [Pattern: {env}-{app}-{resource}]
- **Tags Required**: [Environment, Owner, CostCenter, etc.]
- **Git Branching**: [GitFlow/Trunk-based/etc.]

### 7. Deployment Strategy
- **Environments**: [dev, staging, prod, etc.]
- **Deployment Method**: [Rolling/Blue-Green/Canary]
- **Approval Process**: [Manual gates, auto-deploy rules]
- **Rollback Strategy**: [Automatic/Manual]

---

## Common Customization Updates

### Update 1: Cloud Provider Configuration
**Files**: reference/terraform.md, reference/cloud_platforms.md

Replace generic cloud provider examples with your specific configuration:

```hcl
# Your organization's Terraform backend configuration
terraform {
  backend "s3" {
    bucket         = "your-company-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "your-company-terraform-lock"
  }
}
```

### Update 2: Kubernetes Cluster Configuration
**File**: reference/kubernetes.md

Add your organization's cluster configuration:

```yaml
# Your organization's namespace structure
apiVersion: v1
kind: Namespace
metadata:
  name: production
  labels:
    environment: production
    team: platform
    cost-center: engineering
```

### Update 3: CI/CD Pipeline Standards
**File**: reference/cicd.md, examples/pipelines/

Update with your CI/CD platform and standards:

```yaml
# Your organization's pipeline template
name: Standard Deploy Pipeline
# Include your specific stages, approval gates, etc.
```

### Update 4: Tagging Strategy
**File**: reference/terraform.md

Replace generic tags with your organization's required tags:

```hcl
locals {
  common_tags = {
    Environment   = var.environment
    Project       = var.project_name
    ManagedBy     = "Terraform"
    CostCenter    = var.cost_center
    Owner         = var.owner_email
    Compliance    = var.compliance_level
    DataClass     = var.data_classification
  }
}
```

---

## Troubleshooting Deployment Issues

**Issue**: Files not loading
**Solution**: Verify file paths use forward slashes and are relative to SKILL.md location

**Issue**: Links between files broken
**Solution**: Check that all links use proper markdown format: `[text](path/to/file.md)`

**Issue**: Skill not appearing
**Solution**: Verify SKILL.md frontmatter has exactly `name` and `description` fields

**Issue**: Python script not executing
**Solution**: Verify script has execute permissions and Python 3 is available in environment

```bash
chmod +x scripts/devops_utils.py
python3 --version  # Should be 3.8 or higher
```

**Issue**: Terraform examples don't work
**Solution**: Update provider versions and check AWS credentials configuration

**Issue**: Kubernetes manifests fail validation
**Solution**: Check apiVersion compatibility with your cluster version

---

## Maintenance Schedule

### Monthly
- [ ] Review team feedback and usage patterns
- [ ] Update templates based on recent successful deployments
- [ ] Refresh examples with current configurations
- [ ] Verify all links are still working
- [ ] Update provider versions in examples

### Quarterly
- [ ] Update Kubernetes version compatibility
- [ ] Review and update security best practices
- [ ] Add new infrastructure patterns discovered
- [ ] Update cost optimization recommendations
- [ ] Refresh CI/CD pipeline templates

### Annually
- [ ] Major review of all reference files
- [ ] Update with new cloud services and features
- [ ] Refresh all examples to reflect current state
- [ ] Conduct team training refresher
- [ ] Review and update compliance requirements

---

## Success Metrics for Skill Implementation

Track these to measure skill effectiveness:

**Adoption Metrics**
- % of team using the skill regularly
- Number of infrastructure projects using skill templates
- Frequency of skill usage per engineer

**Efficiency Metrics**
- Time to provision new infrastructure (before vs. after)
- Time to deploy new application (before vs. after)
- Reduction in infrastructure errors
- Consistency of team output

**Quality Metrics**
- Infrastructure security score improvement
- Compliance audit results
- Infrastructure drift reduction
- Incident rate decrease

**Business Impact**
- Infrastructure provisioning time reduction
- Team productivity increase
- Cost optimization achieved
- Mean time to recovery (MTTR) improvement

---

## Script Dependencies

The utility script requires:

```bash
# Python 3.8 or higher
python3 --version

# Install dependencies
pip install pyyaml

# Make script executable
chmod +x scripts/devops_utils.py
```

---

## Questions or Issues?

- **Content questions**: See relevant reference file
- **Technical issues**: Check file structure and verify all files uploaded
- **Customization help**: Use the template in "Customization Template" section
- **New feature requests**: Document in quarterly review and add to next update

---

## Integration with Existing Tools

### Integrate with Git
```bash
cd "DevOps IaC Engineer"
git init
git add .
git commit -m "Initial DevOps IaC Engineer skill"
```

### Integrate with VS Code
- Open folder in VS Code
- Install Terraform and YAML extensions
- Configure workspace settings for linting

### Integrate with CI/CD
- Add skill files to your infrastructure repository
- Reference templates in your pipelines
- Use utility scripts in automation

---

**Last Updated**: October 2025
**Version**: 1.0
