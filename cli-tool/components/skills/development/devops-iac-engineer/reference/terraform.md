# Terraform Best Practices & Patterns

## Terraform Project Structure

### Standard Module Structure
```
terraform/
├── environments/
│   ├── dev/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   ├── terraform.tfvars
│   │   └── backend.tf
│   ├── staging/
│   └── prod/
├── modules/
│   ├── vpc/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   └── README.md
│   ├── eks/
│   ├── rds/
│   └── s3-bucket/
└── README.md
```

**Why this structure?**
- Separates environment configurations for isolation
- Promotes module reusability across environments
- Makes state management cleaner (one state per environment)
- Enables environment-specific variable overrides

### Module Development Template

**modules/vpc/main.tf:**
```hcl
# VPC
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = var.enable_dns_hostnames
  enable_dns_support   = var.enable_dns_support

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-vpc"
    }
  )
}

# Public Subnets
resource "aws_subnet" "public" {
  count                   = length(var.public_subnet_cidrs)
  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-public-${var.availability_zones[count.index]}"
      Type = "public"
    }
  )
}

# Private Subnets
resource "aws_subnet" "private" {
  count             = length(var.private_subnet_cidrs)
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_subnet_cidrs[count.index]
  availability_zone = var.availability_zones[count.index]

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-private-${var.availability_zones[count.index]}"
      Type = "private"
    }
  )
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  count  = length(var.public_subnet_cidrs) > 0 ? 1 : 0
  vpc_id = aws_vpc.main.id

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-igw"
    }
  )
}

# NAT Gateways
resource "aws_eip" "nat" {
  count  = var.enable_nat_gateway ? var.single_nat_gateway ? 1 : length(var.availability_zones) : 0
  domain = "vpc"

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-nat-eip-${count.index + 1}"
    }
  )
}

resource "aws_nat_gateway" "main" {
  count         = var.enable_nat_gateway ? var.single_nat_gateway ? 1 : length(var.availability_zones) : 0
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-nat-${count.index + 1}"
    }
  )

  depends_on = [aws_internet_gateway.main]
}
```

**modules/vpc/variables.tf:**
```hcl
variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "Must be a valid IPv4 CIDR block."
  }
}

variable "availability_zones" {
  description = "List of availability zones"
  type        = list(string)
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  default     = []
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
  default     = []
}

variable "enable_nat_gateway" {
  description = "Enable NAT Gateway for private subnets"
  type        = bool
  default     = true
}

variable "single_nat_gateway" {
  description = "Use single NAT gateway for all AZs (cost optimization)"
  type        = bool
  default     = false
}

variable "enable_dns_hostnames" {
  description = "Enable DNS hostnames in VPC"
  type        = bool
  default     = true
}

variable "enable_dns_support" {
  description = "Enable DNS support in VPC"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
```

**modules/vpc/outputs.tf:**
```hcl
output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "vpc_cidr" {
  description = "CIDR block of the VPC"
  value       = aws_vpc.main.cidr_block
}

output "public_subnet_ids" {
  description = "IDs of public subnets"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "IDs of private subnets"
  value       = aws_subnet.private[*].id
}

output "nat_gateway_ids" {
  description = "IDs of NAT Gateways"
  value       = aws_nat_gateway.main[*].id
}
```

## State Management Best Practices

### Remote State Configuration (S3 + DynamoDB)

**environments/prod/backend.tf:**
```hcl
terraform {
  backend "s3" {
    bucket         = "company-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"

    # Enable versioning on the S3 bucket for state history
    # Enable server-side encryption
    # Use DynamoDB for state locking
  }
}
```

### State Locking Setup
```bash
# Create S3 bucket for state
aws s3api create-bucket \
  --bucket company-terraform-state \
  --region us-east-1

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket company-terraform-state \
  --versioning-configuration Status=Enabled

# Enable encryption
aws s3api put-bucket-encryption \
  --bucket company-terraform-state \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'

# Create DynamoDB table for locking
aws dynamodb create-table \
  --table-name terraform-state-lock \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

## Advanced Terraform Patterns

### Data Sources for Dynamic Configuration
```hcl
# Get latest Amazon Linux 2 AMI
data "aws_ami" "amazon_linux_2" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# Get current AWS account ID
data "aws_caller_identity" "current" {}

# Get current AWS region
data "aws_region" "current" {}

# Get available availability zones
data "aws_availability_zones" "available" {
  state = "available"
}
```

### Dynamic Blocks
```hcl
resource "aws_security_group" "app" {
  name        = "app-sg"
  description = "Security group for application"
  vpc_id      = var.vpc_id

  dynamic "ingress" {
    for_each = var.ingress_rules
    content {
      from_port   = ingress.value.from_port
      to_port     = ingress.value.to_port
      protocol    = ingress.value.protocol
      cidr_blocks = ingress.value.cidr_blocks
      description = ingress.value.description
    }
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Variable definition
variable "ingress_rules" {
  description = "List of ingress rules"
  type = list(object({
    from_port   = number
    to_port     = number
    protocol    = string
    cidr_blocks = list(string)
    description = string
  }))
}
```

### Conditional Resource Creation
```hcl
# Create resource only in production
resource "aws_db_instance" "replica" {
  count = var.environment == "prod" ? var.replica_count : 0

  identifier           = "${var.name_prefix}-replica-${count.index + 1}"
  replicate_source_db  = aws_db_instance.primary.identifier
  instance_class       = var.replica_instance_class
  publicly_accessible  = false
  skip_final_snapshot  = true
}
```

### Lifecycle Management
```hcl
resource "aws_instance" "web" {
  ami           = data.aws_ami.amazon_linux_2.id
  instance_type = var.instance_type

  lifecycle {
    # Prevent accidental deletion of critical resources
    prevent_destroy = true

    # Create new resource before destroying old one
    create_before_destroy = true

    # Ignore changes to specific attributes
    ignore_changes = [
      ami,  # Allow AMI updates outside Terraform
      tags["LastModified"],
    ]
  }
}
```

## Security Best Practices

### Never Hardcode Credentials
```hcl
# ❌ BAD - Hardcoded credentials
resource "aws_db_instance" "bad" {
  username = "admin"
  password = "SuperSecret123!"  # Never do this!
}

# ✅ GOOD - Use AWS Secrets Manager
data "aws_secretsmanager_secret_version" "db_password" {
  secret_id = "prod/db/master-password"
}

resource "aws_db_instance" "good" {
  username = "admin"
  password = jsondecode(data.aws_secretsmanager_secret_version.db_password.secret_string)["password"]
}

# ✅ BETTER - Use random password and store in Secrets Manager
resource "random_password" "db_password" {
  length  = 32
  special = true
}

resource "aws_secretsmanager_secret" "db_password" {
  name = "${var.name_prefix}-db-password"
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = random_password.db_password.result
}

resource "aws_db_instance" "best" {
  username = "admin"
  password = random_password.db_password.result
}
```

### Encryption Best Practices
```hcl
# S3 Bucket with encryption
resource "aws_s3_bucket" "data" {
  bucket = "${var.name_prefix}-data-bucket"
}

resource "aws_s3_bucket_server_side_encryption_configuration" "data" {
  bucket = aws_s3_bucket.data.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.s3.arn
    }
  }
}

# EBS encryption
resource "aws_ebs_volume" "data" {
  availability_zone = var.availability_zone
  size              = var.volume_size
  encrypted         = true
  kms_key_id        = aws_kms_key.ebs.arn
}

# RDS encryption
resource "aws_db_instance" "main" {
  allocated_storage    = var.allocated_storage
  storage_encrypted    = true
  kms_key_id          = aws_kms_key.rds.arn
}
```

## Cost Optimization Patterns

### Spot Instances with Auto Scaling
```hcl
resource "aws_launch_template" "app" {
  name_prefix   = "${var.name_prefix}-"
  image_id      = data.aws_ami.amazon_linux_2.id
  instance_type = var.instance_type

  instance_market_options {
    market_type = "spot"
    spot_options {
      max_price          = var.spot_max_price
      spot_instance_type = "one-time"
    }
  }
}

resource "aws_autoscaling_group" "app" {
  name                = "${var.name_prefix}-asg"
  vpc_zone_identifier = var.private_subnet_ids
  min_size            = var.min_size
  max_size            = var.max_size
  desired_capacity    = var.desired_capacity

  mixed_instances_policy {
    instances_distribution {
      on_demand_base_capacity                  = 1
      on_demand_percentage_above_base_capacity = 20
      spot_allocation_strategy                 = "capacity-optimized"
    }

    launch_template {
      launch_template_specification {
        launch_template_id = aws_launch_template.app.id
        version            = "$Latest"
      }

      override {
        instance_type = "t3.medium"
      }

      override {
        instance_type = "t3a.medium"
      }
    }
  }
}
```

### Resource Tagging for Cost Allocation
```hcl
locals {
  common_tags = {
    Environment  = var.environment
    Project      = var.project_name
    ManagedBy    = "Terraform"
    CostCenter   = var.cost_center
    Owner        = var.owner
    Application  = var.application_name
    CreatedDate  = timestamp()
  }
}

resource "aws_instance" "web" {
  ami           = data.aws_ami.amazon_linux_2.id
  instance_type = var.instance_type

  tags = merge(
    local.common_tags,
    {
      Name = "${var.name_prefix}-web-server"
    }
  )
}
```

## Testing and Validation

### Input Validation
```hcl
variable "environment" {
  description = "Environment name"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  validation {
    condition     = can(regex("^[tm][3-6]\\.(nano|micro|small|medium|large|xlarge|2xlarge)$", var.instance_type))
    error_message = "Instance type must be a valid t3-t6 or m3-m6 type."
  }
}
```

### Pre-commit Hooks
```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/antonbabenko/pre-commit-terraform
    rev: v1.77.0
    hooks:
      - id: terraform_fmt
      - id: terraform_validate
      - id: terraform_docs
      - id: terraform_tflint
      - id: terraform_checkov
```

### CI/CD Pipeline Validation
```yaml
# .github/workflows/terraform.yml
name: Terraform CI

on:
  pull_request:
    paths:
      - 'terraform/**'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v2
        with:
          terraform_version: 1.6.0

      - name: Terraform Format Check
        run: terraform fmt -check -recursive

      - name: Terraform Init
        run: terraform init -backend=false
        working-directory: ./terraform/environments/dev

      - name: Terraform Validate
        run: terraform validate
        working-directory: ./terraform/environments/dev

      - name: Run Checkov
        uses: bridgecrewio/checkov-action@master
        with:
          directory: terraform/
          framework: terraform
```

## Common Anti-Patterns to Avoid

### ❌ Don't: Manage state manually
- Never edit `.tfstate` files directly
- Never commit state files to Git
- Always use remote state with locking

### ❌ Don't: Use count for stateful resources
```hcl
# Bad - Changes in list order cause resource recreation
resource "aws_instance" "web" {
  count = length(var.instance_names)
  # ...
}

# Good - Use for_each for stable resource addressing
resource "aws_instance" "web" {
  for_each = toset(var.instance_names)
  # ...
}
```

### ❌ Don't: Create monolithic configurations
- Split large configurations into modules
- Separate concerns (networking, compute, data)
- Use module composition

### ❌ Don't: Ignore drift detection
```bash
# Run regularly to detect drift
terraform plan -out=tfplan
terraform show -json tfplan | jq '.resource_changes[] | select(.change.actions != ["no-op"])'
```

## Terraform Commands Cheat Sheet

```bash
# Initialize and download providers
terraform init

# Upgrade providers to latest versions
terraform init -upgrade

# Format code
terraform fmt -recursive

# Validate configuration
terraform validate

# Plan changes
terraform plan -out=tfplan

# Apply changes
terraform apply tfplan

# Destroy infrastructure
terraform destroy

# Import existing resource
terraform import aws_instance.example i-1234567890abcdef0

# Show current state
terraform show

# List resources in state
terraform state list

# Remove resource from state (without destroying)
terraform state rm aws_instance.example

# Refresh state
terraform refresh

# Output values
terraform output

# Workspace commands
terraform workspace new prod
terraform workspace select prod
terraform workspace list
```

## Advanced Topics

### Terraform Cloud/Enterprise
- Remote execution
- Policy as code with Sentinel
- Private module registry
- Cost estimation
- VCS integration

### Multi-Environment Strategy
1. **Workspaces**: Simple, same code, different state
2. **Directories**: More isolation, easier to understand
3. **Branches**: Git-based separation (not recommended)

**Recommended: Directory-based with shared modules**

### Dependency Management
```hcl
# Implicit dependency (Terraform detects automatically)
resource "aws_instance" "web" {
  subnet_id = aws_subnet.public.id
}

# Explicit dependency (when needed)
resource "aws_instance" "web" {
  # ...
  depends_on = [aws_iam_role_policy_attachment.example]
}
```

---

## Resources
- [Terraform Registry](https://registry.terraform.io/)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [Terraform Best Practices](https://www.terraform-best-practices.com/)
