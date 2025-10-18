#!/usr/bin/env python3
"""
DevOps Utility Scripts
Provides helper functions for common DevOps tasks
"""

import argparse
import sys
import os
import json
import yaml
import subprocess
from pathlib import Path
from typing import Dict, List, Optional


class TerraformHelper:
    """Helper functions for Terraform operations"""

    @staticmethod
    def init_project(name: str, cloud: str, region: str) -> None:
        """Initialize a new Terraform project structure"""
        base_path = Path(name)

        # Create directory structure
        directories = [
            base_path / "environments" / "dev",
            base_path / "environments" / "staging",
            base_path / "environments" / "prod",
            base_path / "modules" / "vpc",
            base_path / "modules" / "compute",
            base_path / "modules" / "database",
        ]

        for directory in directories:
            directory.mkdir(parents=True, exist_ok=True)
            print(f"Created: {directory}")

        # Create main.tf template
        main_tf_content = f"""terraform {{
  required_version = ">= 1.6.0"

  required_providers {{
    {cloud} = {{
      source  = "hashicorp/{cloud}"
      version = "~> 5.0"
    }}
  }}

  backend "s3" {{
    bucket         = "terraform-state-{name}"
    key            = "{{{{env}}}}/terraform.tfstate"
    region         = "{region}"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
  }}
}}

provider "{cloud}" {{
  region = "{region}"
}}
"""

        for env in ["dev", "staging", "prod"]:
            env_path = base_path / "environments" / env
            (env_path / "main.tf").write_text(main_tf_content.replace("{{env}}", env))
            (env_path / "variables.tf").write_text(
                'variable "environment" {\n  description = "Environment name"\n  type        = string\n  default     = "'
                + env
                + '"\n}\n'
            )
            (env_path / "outputs.tf").write_text("# Define outputs here\n")
            print(f"Created Terraform files in: {env_path}")

        # Create README
        readme_content = f"""# {name} Infrastructure

## Structure
- `environments/`: Environment-specific configurations
- `modules/`: Reusable Terraform modules

## Usage

### Initialize
```bash
cd environments/dev
terraform init
```

### Plan
```bash
terraform plan -out=tfplan
```

### Apply
```bash
terraform apply tfplan
```
"""
        (base_path / "README.md").write_text(readme_content)
        print(f"\nProject '{name}' initialized successfully!")

    @staticmethod
    def validate_hcl(file_path: str) -> bool:
        """Validate Terraform HCL syntax"""
        try:
            result = subprocess.run(
                ["terraform", "fmt", "-check", file_path],
                capture_output=True,
                text=True,
            )
            if result.returncode == 0:
                print(f"✓ {file_path} is properly formatted")
                return True
            else:
                print(f"✗ {file_path} needs formatting")
                print(result.stdout)
                return False
        except FileNotFoundError:
            print("Error: terraform command not found")
            return False


class KubernetesHelper:
    """Helper functions for Kubernetes operations"""

    @staticmethod
    def validate_manifest(file_path: str, schema_version: str = "1.28") -> bool:
        """Validate Kubernetes manifest syntax"""
        try:
            with open(file_path, "r") as f:
                docs = list(yaml.safe_load_all(f))

            print(f"Validating {len(docs)} document(s) in {file_path}")

            for i, doc in enumerate(docs):
                if not doc:
                    continue

                # Basic validation
                if "apiVersion" not in doc:
                    print(f"✗ Document {i + 1}: Missing apiVersion")
                    return False

                if "kind" not in doc:
                    print(f"✗ Document {i + 1}: Missing kind")
                    return False

                if "metadata" not in doc:
                    print(f"✗ Document {i + 1}: Missing metadata")
                    return False

                print(
                    f"✓ Document {i + 1}: {doc['kind']} '{doc['metadata'].get('name', 'unnamed')}'"
                )

            print(f"✓ All documents in {file_path} are valid")
            return True

        except yaml.YAMLError as e:
            print(f"✗ YAML syntax error: {e}")
            return False
        except FileNotFoundError:
            print(f"✗ File not found: {file_path}")
            return False

    @staticmethod
    def generate_deployment(
        name: str, image: str, namespace: str = "default", replicas: int = 3
    ) -> str:
        """Generate a Kubernetes deployment manifest"""
        manifest = {
            "apiVersion": "apps/v1",
            "kind": "Deployment",
            "metadata": {"name": name, "namespace": namespace, "labels": {"app": name}},
            "spec": {
                "replicas": replicas,
                "selector": {"matchLabels": {"app": name}},
                "template": {
                    "metadata": {"labels": {"app": name}},
                    "spec": {
                        "containers": [
                            {
                                "name": name,
                                "image": image,
                                "ports": [{"containerPort": 8080}],
                                "resources": {
                                    "requests": {"memory": "256Mi", "cpu": "250m"},
                                    "limits": {"memory": "512Mi", "cpu": "500m"},
                                },
                                "livenessProbe": {
                                    "httpGet": {"path": "/healthz", "port": 8080},
                                    "initialDelaySeconds": 30,
                                    "periodSeconds": 10,
                                },
                                "readinessProbe": {
                                    "httpGet": {"path": "/ready", "port": 8080},
                                    "initialDelaySeconds": 10,
                                    "periodSeconds": 5,
                                },
                            }
                        ]
                    },
                },
            },
        }

        return yaml.dump(manifest, default_flow_style=False, sort_keys=False)


class GitOpsHelper:
    """Helper functions for GitOps workflows"""

    @staticmethod
    def init_gitops(tool: str, environments: List[str]) -> None:
        """Initialize GitOps directory structure"""
        base_path = Path("gitops")

        if tool.lower() == "argocd":
            # ArgoCD structure
            for env in environments:
                env_path = base_path / "applications" / env
                env_path.mkdir(parents=True, exist_ok=True)

                # Create application manifest
                app_manifest = {
                    "apiVersion": "argoproj.io/v1alpha1",
                    "kind": "Application",
                    "metadata": {
                        "name": f"myapp-{env}",
                        "namespace": "argocd",
                    },
                    "spec": {
                        "project": "default",
                        "source": {
                            "repoURL": "https://github.com/myorg/myapp.git",
                            "targetRevision": "HEAD",
                            "path": f"kubernetes/overlays/{env}",
                        },
                        "destination": {
                            "server": "https://kubernetes.default.svc",
                            "namespace": env,
                        },
                        "syncPolicy": {
                            "automated": {
                                "prune": True,
                                "selfHeal": True,
                            }
                        },
                    },
                }

                with open(env_path / "application.yaml", "w") as f:
                    yaml.dump(app_manifest, f, default_flow_style=False)

                print(f"Created ArgoCD application for: {env}")

        elif tool.lower() == "flux":
            # Flux structure
            for env in environments:
                env_path = base_path / "clusters" / env
                env_path.mkdir(parents=True, exist_ok=True)

                # Create kustomization
                kustomization = {
                    "apiVersion": "kustomize.toolkit.fluxcd.io/v1",
                    "kind": "Kustomization",
                    "metadata": {"name": f"myapp-{env}", "namespace": "flux-system"},
                    "spec": {
                        "interval": "5m",
                        "path": f"./kubernetes/overlays/{env}",
                        "prune": True,
                        "sourceRef": {"kind": "GitRepository", "name": "myapp"},
                    },
                }

                with open(env_path / "kustomization.yaml", "w") as f:
                    yaml.dump(kustomization, f, default_flow_style=False)

                print(f"Created Flux kustomization for: {env}")

        print(f"\nGitOps structure initialized for {tool}")


class SecurityHelper:
    """Helper functions for security operations"""

    @staticmethod
    def scan_secrets(directory: str) -> List[str]:
        """Scan for potential secrets in files"""
        import re

        secret_patterns = {
            "AWS Access Key": r"AKIA[0-9A-Z]{16}",
            "Private Key": r"-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----",
            "API Key": r"api[_-]?key['\"]?\s*[:=]\s*['\"]?[a-zA-Z0-9]{32,}",
            "Password": r"password['\"]?\s*[:=]\s*['\"]?[^'\"\s]{8,}",
            "Token": r"token['\"]?\s*[:=]\s*['\"]?[a-zA-Z0-9._\-]{20,}",
        }

        findings = []

        for root, dirs, files in os.walk(directory):
            # Skip common non-code directories
            dirs[:] = [
                d
                for d in dirs
                if d not in [".git", "node_modules", "venv", ".terraform"]
            ]

            for file in files:
                file_path = os.path.join(root, file)

                try:
                    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read()

                        for secret_type, pattern in secret_patterns.items():
                            matches = re.finditer(pattern, content)
                            for match in matches:
                                findings.append(
                                    f"{file_path}:{secret_type} - {match.group()[:20]}..."
                                )
                except Exception as e:
                    continue

        return findings


def main():
    parser = argparse.ArgumentParser(description="DevOps Utility Scripts")
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # Terraform commands
    tf_parser = subparsers.add_parser("terraform", help="Terraform utilities")
    tf_subparsers = tf_parser.add_subparsers(dest="subcommand")

    tf_init = tf_subparsers.add_parser("init-project", help="Initialize Terraform project")
    tf_init.add_argument("--name", required=True, help="Project name")
    tf_init.add_argument(
        "--cloud", required=True, choices=["aws", "azure", "gcp"], help="Cloud provider"
    )
    tf_init.add_argument("--region", required=True, help="Default region")

    tf_validate = tf_subparsers.add_parser("validate", help="Validate Terraform files")
    tf_validate.add_argument("--file", required=True, help="File to validate")

    # Kubernetes commands
    k8s_parser = subparsers.add_parser("k8s", help="Kubernetes utilities")
    k8s_subparsers = k8s_parser.add_subparsers(dest="subcommand")

    k8s_validate = k8s_subparsers.add_parser("validate", help="Validate K8s manifest")
    k8s_validate.add_argument("--file", required=True, help="Manifest file")
    k8s_validate.add_argument(
        "--schema-version", default="1.28", help="Kubernetes version"
    )

    k8s_generate = k8s_subparsers.add_parser("generate", help="Generate deployment")
    k8s_generate.add_argument("--name", required=True, help="Deployment name")
    k8s_generate.add_argument("--image", required=True, help="Container image")
    k8s_generate.add_argument("--namespace", default="default", help="Namespace")
    k8s_generate.add_argument("--replicas", type=int, default=3, help="Replica count")

    # GitOps commands
    gitops_parser = subparsers.add_parser("gitops", help="GitOps utilities")
    gitops_subparsers = gitops_parser.add_subparsers(dest="subcommand")

    gitops_init = gitops_subparsers.add_parser("init", help="Initialize GitOps structure")
    gitops_init.add_argument(
        "--tool", required=True, choices=["argocd", "flux"], help="GitOps tool"
    )
    gitops_init.add_argument(
        "--environments", required=True, help="Comma-separated environments"
    )

    # Security commands
    security_parser = subparsers.add_parser("security", help="Security utilities")
    security_subparsers = security_parser.add_subparsers(dest="subcommand")

    security_scan = security_subparsers.add_parser("scan-secrets", help="Scan for secrets")
    security_scan.add_argument("--directory", default=".", help="Directory to scan")

    args = parser.parse_args()

    # Execute commands
    if args.command == "terraform":
        if args.subcommand == "init-project":
            TerraformHelper.init_project(args.name, args.cloud, args.region)
        elif args.subcommand == "validate":
            TerraformHelper.validate_hcl(args.file)

    elif args.command == "k8s":
        if args.subcommand == "validate":
            KubernetesHelper.validate_manifest(args.file, args.schema_version)
        elif args.subcommand == "generate":
            manifest = KubernetesHelper.generate_deployment(
                args.name, args.image, args.namespace, args.replicas
            )
            print(manifest)

    elif args.command == "gitops":
        if args.subcommand == "init":
            environments = [env.strip() for env in args.environments.split(",")]
            GitOpsHelper.init_gitops(args.tool, environments)

    elif args.command == "security":
        if args.subcommand == "scan-secrets":
            findings = SecurityHelper.scan_secrets(args.directory)
            if findings:
                print(f"⚠️  Found {len(findings)} potential secrets:")
                for finding in findings:
                    print(f"  - {finding}")
                sys.exit(1)
            else:
                print("✓ No secrets found")

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
