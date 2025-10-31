# Cloud Platforms: AWS, Azure, GCP

## Cloud Platform Selection

### AWS (Amazon Web Services)
- **Strengths**: Market leader, most services, mature ecosystem
- **Best for**: Enterprise, startups, wide service selection
- **Key Services**: EC2, EKS, RDS, S3, Lambda, CloudFormation

### Azure (Microsoft Azure)
- **Strengths**: Enterprise integration, hybrid cloud, Microsoft stack
- **Best for**: Windows workloads, hybrid scenarios, Microsoft shops
- **Key Services**: VMs, AKS, SQL Database, Blob Storage, ARM Templates

### GCP (Google Cloud Platform)
- **Strengths**: Kubernetes-native, ML/AI, data analytics
- **Best for**: Kubernetes, data processing, ML workloads
- **Key Services**: Compute Engine, GKE, Cloud SQL, Cloud Storage, Deployment Manager

## AWS Architecture Patterns

### Multi-Tier Web Application
```
Internet
    │
    ▼
┌─────────────────┐
│  CloudFront     │ CDN
│  (Global)       │
└────────┬────────┘
         │
    ┌────▼────┐
    │   ALB   │ Load Balancer
    └────┬────┘
         │
    ┌────▼──────────┐
    │   ECS/EKS     │ Application Layer
    │  (Multi-AZ)   │
    └────┬──────────┘
         │
    ┌────▼────┐
    │   RDS   │ Database Layer
    │ (Multi-AZ)│
    └─────────┘
```

### AWS Well-Architected Framework Pillars

**1. Operational Excellence**
- IaC (Terraform/CloudFormation)
- CI/CD automation
- Monitoring and observability

**2. Security**
- IAM least privilege
- Encryption at rest and in transit
- Network segmentation (VPC, Security Groups)

**3. Reliability**
- Multi-AZ deployment
- Auto Scaling
- Backup and disaster recovery

**4. Performance Efficiency**
- Right-sizing instances
- CloudFront for content delivery
- ElastiCache for caching

**5. Cost Optimization**
- Reserved Instances
- Spot Instances
- Auto Scaling based on demand

**6. Sustainability**
- Region selection for renewable energy
- Right-sizing to minimize waste

### AWS Core Services

#### Compute
```hcl
# EC2 Instance
resource "aws_instance" "app" {
  ami           = data.aws_ami.amazon_linux_2.id
  instance_type = "t3.medium"

  vpc_security_group_ids = [aws_security_group.app.id]
  subnet_id              = aws_subnet.private[0].id

  iam_instance_profile = aws_iam_instance_profile.app.name

  user_data = <<-EOF
              #!/bin/bash
              yum update -y
              yum install -y docker
              systemctl start docker
              EOF

  tags = {
    Name = "${var.name_prefix}-app-server"
  }
}

# ECS Fargate
resource "aws_ecs_service" "app" {
  name            = "${var.name_prefix}-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = 3

  launch_type = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.app.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_name   = "app"
    container_port   = 8080
  }
}

# Lambda Function
resource "aws_lambda_function" "processor" {
  filename      = "lambda.zip"
  function_name = "${var.name_prefix}-processor"
  role          = aws_iam_role.lambda.arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"

  environment {
    variables = {
      ENV = var.environment
    }
  }
}
```

#### Storage
```hcl
# S3 Bucket
resource "aws_s3_bucket" "data" {
  bucket = "${var.name_prefix}-data-bucket"
}

resource "aws_s3_bucket_versioning" "data" {
  bucket = aws_s3_bucket.data.id

  versioning_configuration {
    status = "Enabled"
  }
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

# EBS Volume
resource "aws_ebs_volume" "data" {
  availability_zone = var.availability_zone
  size              = 100
  type              = "gp3"
  encrypted         = true
  kms_key_id        = aws_kms_key.ebs.arn

  tags = {
    Name = "${var.name_prefix}-data-volume"
  }
}

# EFS File System
resource "aws_efs_file_system" "shared" {
  encrypted = true
  kms_key_id = aws_kms_key.efs.arn

  lifecycle_policy {
    transition_to_ia = "AFTER_30_DAYS"
  }

  tags = {
    Name = "${var.name_prefix}-efs"
  }
}
```

#### Database
```hcl
# RDS PostgreSQL
resource "aws_db_instance" "main" {
  identifier = "${var.name_prefix}-db"

  engine         = "postgres"
  engine_version = "15.4"
  instance_class = "db.t3.medium"

  allocated_storage     = 100
  max_allocated_storage = 1000
  storage_type          = "gp3"
  storage_encrypted     = true

  multi_az               = true
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.db.id]

  backup_retention_period = 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"

  enabled_cloudwatch_logs_exports = ["postgresql"]

  deletion_protection = var.environment == "prod"
}

# DynamoDB Table
resource "aws_dynamodb_table" "sessions" {
  name           = "${var.name_prefix}-sessions"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "session_id"

  attribute {
    name = "session_id"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }
}
```

## Azure Architecture Patterns

### Multi-Tier Application on Azure
```
Internet
    │
    ▼
┌─────────────────┐
│  Azure Front    │ CDN + WAF
│     Door        │
└────────┬────────┘
         │
    ┌────▼────────┐
    │   App GW    │ Load Balancer
    └────┬────────┘
         │
    ┌────▼──────────┐
    │     AKS       │ Application Layer
    │ (Multi-Zone)  │
    └────┬──────────┘
         │
    ┌────▼──────────┐
    │ Azure SQL DB  │ Database Layer
    │ (Geo-Replica) │
    └───────────────┘
```

### Azure Core Services

#### Compute
```hcl
# Virtual Machine
resource "azurerm_linux_virtual_machine" "app" {
  name                = "${var.name_prefix}-vm"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  size                = "Standard_D2s_v3"

  network_interface_ids = [
    azurerm_network_interface.app.id,
  ]

  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "Premium_LRS"
  }

  source_image_reference {
    publisher = "Canonical"
    offer     = "0001-com-ubuntu-server-focal"
    sku       = "20_04-lts"
    version   = "latest"
  }

  admin_username = "azureuser"
  admin_ssh_key {
    username   = "azureuser"
    public_key = file("~/.ssh/id_rsa.pub")
  }
}

# AKS Cluster
resource "azurerm_kubernetes_cluster" "main" {
  name                = "${var.name_prefix}-aks"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  dns_prefix          = var.name_prefix

  default_node_pool {
    name            = "default"
    node_count      = 3
    vm_size         = "Standard_D2s_v3"
    os_disk_size_gb = 100
  }

  identity {
    type = "SystemAssigned"
  }

  network_profile {
    network_plugin = "azure"
    network_policy = "calico"
  }
}

# Azure Functions
resource "azurerm_linux_function_app" "processor" {
  name                = "${var.name_prefix}-func"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location

  storage_account_name       = azurerm_storage_account.func.name
  storage_account_access_key = azurerm_storage_account.func.primary_access_key
  service_plan_id            = azurerm_service_plan.func.id

  site_config {
    application_stack {
      node_version = "20"
    }
  }
}
```

## GCP Architecture Patterns

### Multi-Tier Application on GCP
```
Internet
    │
    ▼
┌─────────────────┐
│  Cloud CDN      │
└────────┬────────┘
         │
    ┌────▼────────┐
    │  Cloud LB   │ Global Load Balancer
    └────┬────────┘
         │
    ┌────▼──────────┐
    │     GKE       │ Application Layer
    │ (Multi-Zone)  │
    └────┬──────────┘
         │
    ┌────▼──────────┐
    │  Cloud SQL    │ Database Layer
    │   (HA)        │
    └───────────────┘
```

### GCP Core Services

#### Compute
```hcl
# Compute Engine Instance
resource "google_compute_instance" "app" {
  name         = "${var.name_prefix}-vm"
  machine_type = "e2-medium"
  zone         = var.zone

  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2004-lts"
      size  = 50
      type  = "pd-ssd"
    }
  }

  network_interface {
    network    = google_compute_network.vpc.name
    subnetwork = google_compute_subnetwork.private.name

    access_config {
      // Ephemeral public IP
    }
  }

  metadata_startup_script = file("startup.sh")

  service_account {
    scopes = ["cloud-platform"]
  }
}

# GKE Cluster
resource "google_container_cluster" "main" {
  name     = "${var.name_prefix}-gke"
  location = var.region

  # Remove default node pool
  remove_default_node_pool = true
  initial_node_count       = 1

  network    = google_compute_network.vpc.name
  subnetwork = google_compute_subnetwork.private.name

  ip_allocation_policy {
    cluster_ipv4_cidr_block  = "/16"
    services_ipv4_cidr_block = "/22"
  }

  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }
}

resource "google_container_node_pool" "main" {
  name       = "main-pool"
  location   = var.region
  cluster    = google_container_cluster.main.name
  node_count = 1

  autoscaling {
    min_node_count = 1
    max_node_count = 10
  }

  node_config {
    machine_type = "e2-medium"
    disk_size_gb = 100
    disk_type    = "pd-standard"

    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]

    workload_metadata_config {
      mode = "GKE_METADATA"
    }
  }
}
```

## Multi-Cloud Strategy

### When to Use Multi-Cloud
✓ **Avoid vendor lock-in**
✓ **Leverage best-of-breed services**
✓ **Geographic requirements**
✓ **Disaster recovery**

### Multi-Cloud Challenges
✗ Increased complexity
✗ Higher operational overhead
✗ Different APIs and tools
✗ Data transfer costs

### Multi-Cloud Tools
- **Terraform**: Unified IaC across clouds
- **Kubernetes**: Consistent compute layer
- **Service Mesh**: Unified networking
- **OpenTelemetry**: Unified observability

## Cost Optimization Strategies

### AWS Cost Optimization
```hcl
# Savings Plans / Reserved Instances
# Purchase via AWS Console or API

# Spot Instances
resource "aws_autoscaling_group" "app" {
  mixed_instances_policy {
    instances_distribution {
      on_demand_base_capacity                  = 1
      on_demand_percentage_above_base_capacity = 20
      spot_allocation_strategy                 = "capacity-optimized"
    }

    launch_template {
      launch_template_specification {
        launch_template_id = aws_launch_template.app.id
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

# S3 Lifecycle Policy
resource "aws_s3_bucket_lifecycle_configuration" "data" {
  bucket = aws_s3_bucket.data.id

  rule {
    id     = "archive-old-data"
    status = "Enabled"

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    expiration {
      days = 365
    }
  }
}
```

### Cost Monitoring
```hcl
# AWS Budget
resource "aws_budgets_budget" "monthly" {
  name         = "monthly-budget"
  budget_type  = "COST"
  limit_amount = "1000"
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = ["devops@example.com"]
  }
}
```

## Disaster Recovery

### RTO/RPO Targets
- **RTO (Recovery Time Objective)**: Maximum acceptable downtime
- **RPO (Recovery Point Objective)**: Maximum acceptable data loss

### DR Strategies (Lowest to Highest Cost)

**1. Backup & Restore (RPO: hours, RTO: hours)**
- Regular backups to cloud storage
- Restore when needed

**2. Pilot Light (RPO: minutes, RTO: hours)**
- Minimal infrastructure always running
- Scale up when needed

**3. Warm Standby (RPO: seconds, RTO: minutes)**
- Scaled-down version running
- Scale up for failover

**4. Multi-Site Active/Active (RPO: none, RTO: none)**
- Full capacity in multiple regions
- Traffic distributed across sites

### Multi-Region Setup (AWS)
```hcl
provider "aws" {
  alias  = "primary"
  region = "us-east-1"
}

provider "aws" {
  alias  = "dr"
  region = "us-west-2"
}

# Primary region resources
module "vpc_primary" {
  source = "./modules/vpc"
  providers = {
    aws = aws.primary
  }
}

# DR region resources
module "vpc_dr" {
  source = "./modules/vpc"
  providers = {
    aws = aws.dr
  }
}

# Route53 health check and failover
resource "aws_route53_health_check" "primary" {
  fqdn              = aws_lb.primary.dns_name
  port              = 443
  type              = "HTTPS"
  resource_path     = "/health"
  failure_threshold = "3"
  request_interval  = "30"
}

resource "aws_route53_record" "app" {
  zone_id = aws_route53_zone.main.id
  name    = "app.example.com"
  type    = "A"

  set_identifier = "primary"
  failover_routing_policy {
    type = "PRIMARY"
  }

  alias {
    name                   = aws_lb.primary.dns_name
    zone_id                = aws_lb.primary.zone_id
    evaluate_target_health = true
  }

  health_check_id = aws_route53_health_check.primary.id
}

resource "aws_route53_record" "app_dr" {
  zone_id = aws_route53_zone.main.id
  name    = "app.example.com"
  type    = "A"

  set_identifier = "secondary"
  failover_routing_policy {
    type = "SECONDARY"
  }

  alias {
    name                   = aws_lb.dr.dns_name
    zone_id                = aws_lb.dr.zone_id
    evaluate_target_health = true
  }
}
```

## Best Practices Summary

### AWS
- Use IAM roles, not access keys
- Enable CloudTrail in all regions
- Encrypt everything (S3, EBS, RDS)
- Use VPC for network isolation
- Tag all resources for cost allocation

### Azure
- Use Managed Identities
- Enable Azure Policy for governance
- Use Azure Key Vault for secrets
- Implement RBAC
- Use Resource Groups for organization

### GCP
- Use Service Accounts with least privilege
- Enable Cloud Audit Logs
- Use VPC Service Controls
- Implement Organization Policies
- Use Labels for resource management

---

## Cloud Service Comparison

| Service Type | AWS | Azure | GCP |
|--------------|-----|-------|-----|
| Compute | EC2 | Virtual Machines | Compute Engine |
| Containers | ECS, EKS | AKS | GKE |
| Serverless | Lambda | Functions | Cloud Functions |
| Storage | S3 | Blob Storage | Cloud Storage |
| Database (SQL) | RDS | SQL Database | Cloud SQL |
| Database (NoSQL) | DynamoDB | Cosmos DB | Firestore |
| Networking | VPC | Virtual Network | VPC |
| Load Balancer | ALB/NLB | App Gateway | Cloud Load Balancing |
| CDN | CloudFront | Front Door | Cloud CDN |
| IAM | IAM | Azure AD | Cloud IAM |
