---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [platform] | --github-actions | --gitlab-ci | --jenkins | --full-setup
description: Setup comprehensive CI/CD pipeline with automated testing, building, and deployment
model: sonnet
---

# CI/CD Pipeline Setup

Setup continuous integration pipeline: $ARGUMENTS

## Current Project Analysis

- Project type: @package.json or @setup.py or @go.mod or @pom.xml (detect language/framework)
- Existing workflows: !`find .github/workflows -name "*.yml" 2>/dev/null | head -3`
- Git branches: !`git branch -r | head -5`
- Dependencies: @package-lock.json or @requirements.txt or @go.sum (if exists)
- Build scripts: Check for build commands in package.json or Makefile

## Task

Implement comprehensive CI/CD following best practices: $ARGUMENTS

1. **Project Analysis**
   - Identify the technology stack and deployment requirements
   - Review existing build and test processes
   - Understand deployment environments (dev, staging, prod)
   - Assess current version control and branching strategy

2. **CI/CD Platform Selection**
   - Choose appropriate CI/CD platform based on requirements:
     - **GitHub Actions**: Native GitHub integration, extensive marketplace
     - **GitLab CI**: Built-in GitLab, comprehensive DevOps platform
     - **Jenkins**: Self-hosted, highly customizable, extensive plugins
     - **CircleCI**: Cloud-based, optimized for speed
     - **Azure DevOps**: Microsoft ecosystem integration
     - **AWS CodePipeline**: AWS-native solution

3. **Repository Setup**
   - Ensure proper `.gitignore` configuration
   - Set up branch protection rules
   - Configure merge requirements and reviews
   - Establish semantic versioning strategy

4. **Build Pipeline Configuration**
   
   **GitHub Actions Example:**
   ```yaml
   name: CI/CD Pipeline
   
   on:
     push:
       branches: [ main, develop ]
     pull_request:
       branches: [ main ]
   
   jobs:
     test:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         - name: Setup Node.js
           uses: actions/setup-node@v3
           with:
             node-version: '18'
             cache: 'npm'
         - run: npm ci
         - run: npm run test
         - run: npm run build
   ```

   **GitLab CI Example:**
   ```yaml
   stages:
     - test
     - build
     - deploy
   
   test:
     stage: test
     script:
       - npm ci
       - npm run test
     cache:
       paths:
         - node_modules/
   ```

5. **Environment Configuration**
   - Set up environment variables and secrets
   - Configure different environments (dev, staging, prod)
   - Implement environment-specific configurations
   - Set up secure secret management

6. **Automated Testing Integration**
   - Configure unit test execution
   - Set up integration test running
   - Implement E2E test execution
   - Configure test reporting and coverage

   **Multi-stage Testing:**
   ```yaml
   test:
     strategy:
       matrix:
         node-version: [16, 18, 20]
     runs-on: ubuntu-latest
     steps:
       - uses: actions/checkout@v3
       - uses: actions/setup-node@v3
         with:
           node-version: ${{ matrix.node-version }}
       - run: npm ci
       - run: npm test
   ```

7. **Code Quality Gates**
   - Integrate linting and formatting checks
   - Set up static code analysis (SonarQube, CodeClimate)
   - Configure security vulnerability scanning
   - Implement code coverage thresholds

8. **Build Optimization**
   - Configure build caching strategies
   - Implement parallel job execution
   - Optimize Docker image builds
   - Set up artifact management

   **Caching Example:**
   ```yaml
   - name: Cache node modules
     uses: actions/cache@v3
     with:
       path: ~/.npm
       key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
       restore-keys: |
         ${{ runner.os }}-node-
   ```

9. **Docker Integration**
   - Create optimized Dockerfiles
   - Set up multi-stage builds
   - Configure container registry integration
   - Implement security scanning for images

   **Multi-stage Dockerfile:**
   ```dockerfile
   FROM node:18-alpine AS builder
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --only=production
   
   FROM node:18-alpine AS runtime
   WORKDIR /app
   COPY --from=builder /app/node_modules ./node_modules
   COPY . .
   EXPOSE 3000
   CMD ["npm", "start"]
   ```

10. **Deployment Strategies**
    - Implement blue-green deployment
    - Set up canary releases
    - Configure rolling updates
    - Implement feature flags integration

11. **Infrastructure as Code**
    - Use Terraform, CloudFormation, or similar tools
    - Version control infrastructure definitions
    - Implement infrastructure testing
    - Set up automated infrastructure provisioning

12. **Monitoring and Observability**
    - Set up application performance monitoring
    - Configure log aggregation and analysis
    - Implement health checks and alerting
    - Set up deployment notifications

13. **Security Integration**
    - Implement dependency vulnerability scanning
    - Set up container security scanning
    - Configure SAST (Static Application Security Testing)
    - Implement secrets scanning

   **Security Scanning Example:**
   ```yaml
   security:
     runs-on: ubuntu-latest
     steps:
       - uses: actions/checkout@v3
       - name: Run Snyk to check for vulnerabilities
         uses: snyk/actions/node@master
         env:
           SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
   ```

14. **Database Migration Handling**
    - Automate database schema migrations
    - Implement rollback strategies
    - Set up database seeding for testing
    - Configure backup and recovery procedures

15. **Performance Testing Integration**
    - Set up load testing in pipeline
    - Configure performance benchmarks
    - Implement performance regression detection
    - Set up performance monitoring

16. **Multi-Environment Deployment**
    - Configure staging environment deployment
    - Set up production deployment with approvals
    - Implement environment promotion workflow
    - Configure environment-specific configurations

   **Environment Deployment:**
   ```yaml
   deploy-staging:
     needs: test
     if: github.ref == 'refs/heads/develop'
     runs-on: ubuntu-latest
     steps:
       - name: Deploy to staging
         run: |
           # Deploy to staging environment
   
   deploy-production:
     needs: test
     if: github.ref == 'refs/heads/main'
     runs-on: ubuntu-latest
     environment: production
     steps:
       - name: Deploy to production
         run: |
           # Deploy to production environment
   ```

17. **Rollback and Recovery**
    - Implement automated rollback procedures
    - Set up deployment verification tests
    - Configure failure detection and alerts
    - Document manual recovery procedures

18. **Notification and Reporting**
    - Set up Slack/Teams integration for notifications
    - Configure email alerts for failures
    - Implement deployment status reporting
    - Set up metrics dashboards

19. **Compliance and Auditing**
    - Implement deployment audit trails
    - Set up compliance checks (SOC 2, HIPAA, etc.)
    - Configure approval workflows for sensitive deployments
    - Document change management processes

20. **Pipeline Optimization**
    - Monitor pipeline performance and costs
    - Implement pipeline parallelization
    - Optimize resource allocation
    - Set up pipeline analytics and reporting

**Best Practices:**

1. **Fail Fast**: Implement early failure detection
2. **Parallel Execution**: Run independent jobs in parallel
3. **Caching**: Cache dependencies and build artifacts
4. **Security**: Never expose secrets in logs
5. **Documentation**: Document pipeline processes and procedures
6. **Monitoring**: Monitor pipeline health and performance
7. **Testing**: Test pipeline changes in feature branches
8. **Rollback**: Always have a rollback strategy

**Sample Complete Pipeline:**
```yaml
name: Full CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run test:coverage
      - run: npm run build

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Security scan
        run: npm audit --audit-level=high

  deploy-staging:
    needs: [lint-and-test, security-scan]
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to staging
        run: echo "Deploying to staging"

  deploy-production:
    needs: [lint-and-test, security-scan]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to production
        run: echo "Deploying to production"
```

Start with basic CI and gradually add more sophisticated features as your team and project mature.