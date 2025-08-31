---
sidebar_position: 4
---

# MCPs (Model Context Protocol) 🔌

**MCPs** (Model Context Protocol integrations) enable Claude Code to interact with external services and tools, dramatically expanding its capabilities beyond the local development environment. They provide secure, structured ways to connect Claude Code with databases, APIs, version control systems, and other development tools.

## What Are MCPs?

MCPs are standardized integrations that allow Claude Code to:

- **Access External Data**: Connect to databases, APIs, and cloud services
- **Interact with Tools**: Use external development tools and services directly
- **Extend Functionality**: Add capabilities that go beyond file-based operations
- **Maintain Security**: Provide controlled access to external resources with proper authentication

## Available MCPs

### 🔗 Version Control Integration

#### GitHub Integration MCP
**Purpose**: Direct GitHub repository interactions and management

**Capabilities**:
- Repository browsing and file management
- Issue creation and management
- Pull request operations
- Commit history analysis
- Branch management
- Release management

**Configuration Example**:
```json
{
  "name": "github-integration",
  "type": "mcp",
  "config": {
    "apiUrl": "https://api.github.com",
    "authentication": "token",
    "permissions": ["repo", "issues", "pull_requests"],
    "rateLimit": {
      "requests": 5000,
      "window": "3600"
    }
  }
}
```

**Usage Examples**:
```bash
# With GitHub MCP enabled, Claude Code can:
# - Analyze repository structure and history
# - Create issues directly from code analysis
# - Generate pull request descriptions
# - Review commit patterns and suggest improvements
# - Automate release notes generation
```

#### GitLab Integration MCP  
**Purpose**: GitLab repository and CI/CD pipeline management

**Capabilities**:
- Repository operations
- Merge request management
- CI/CD pipeline monitoring
- Issue tracking integration
- Wiki management

### 🗄️ Database Integration

#### Database Integration MCP
**Purpose**: Connect to and query databases directly from Claude Code

**Supported Databases**:
- PostgreSQL
- MySQL/MariaDB
- SQLite
- MongoDB
- Redis

**Configuration Example**:
```json
{
  "name": "database-integration",
  "type": "mcp",
  "config": {
    "connections": {
      "primary": {
        "type": "postgresql",
        "host": "localhost",
        "port": 5432,
        "database": "myapp",
        "authentication": "credentials"
      },
      "cache": {
        "type": "redis",
        "host": "localhost",
        "port": 6379
      }
    },
    "permissions": {
      "read": true,
      "write": false,
      "schema": false
    }
  }
}
```

**Capabilities**:
- Query execution and result analysis
- Schema exploration and documentation
- Performance optimization suggestions
- Data integrity validation
- Migration planning assistance

**Usage Examples**:
```bash
# With Database MCP enabled, Claude Code can:
# - Analyze query performance and suggest optimizations
# - Generate database documentation from schema
# - Validate data consistency across tables
# - Suggest indexing strategies
# - Help plan database migrations
```

### 🚀 Cloud Services Integration

#### AWS Integration MCP
**Purpose**: Amazon Web Services resource management and monitoring

**Supported Services**:
- EC2 instances
- S3 buckets
- RDS databases
- Lambda functions
- CloudFormation stacks

**Configuration Example**:
```json
{
  "name": "aws-integration",
  "type": "mcp",
  "config": {
    "region": "us-east-1",
    "authentication": "iam-role",
    "services": ["ec2", "s3", "rds", "lambda"],
    "permissions": {
      "read": true,
      "write": false,
      "billing": false
    }
  }
}
```

**Capabilities**:
- Resource monitoring and optimization
- Cost analysis and recommendations
- Security best practices validation
- Infrastructure as Code assistance
- Deployment guidance

#### Docker Integration MCP
**Purpose**: Container management and optimization

**Configuration Example**:
```json
{
  "name": "docker-integration",
  "type": "mcp",
  "config": {
    "dockerHost": "unix:///var/run/docker.sock",
    "registries": [
      {
        "name": "docker-hub",
        "url": "https://index.docker.io/v1/"
      }
    ],
    "permissions": {
      "read": true,
      "build": true,
      "run": false
    }
  }
}
```

**Capabilities**:
- Dockerfile optimization
- Image security scanning
- Multi-stage build recommendations
- Container orchestration guidance
- Registry management

### 🔍 Analysis & Monitoring

#### DeepGraph React MCP
**Purpose**: Advanced React component analysis and visualization

**Configuration Example**:
```json
{
  "name": "deepgraph-react",
  "type": "mcp",
  "config": {
    "analysisDepth": "deep",
    "componentTracking": true,
    "performanceMetrics": true,
    "dependencyMapping": true
  }
}
```

**Capabilities**:
- Component dependency mapping
- Performance bottleneck identification
- State flow analysis
- Render pattern optimization
- Bundle analysis and recommendations

**Usage Examples**:
```bash
# With DeepGraph React MCP enabled, Claude Code can:
# - Generate visual component dependency graphs
# - Identify circular dependencies
# - Suggest component splitting strategies
# - Analyze prop drilling patterns
# - Recommend state management solutions
```

#### API Monitoring MCP
**Purpose**: External API monitoring and analysis

**Capabilities**:
- API endpoint health monitoring
- Response time analysis
- Error rate tracking
- Documentation generation
- Rate limiting optimization

## Installation & Configuration

### CLI Parameter Installation (Recommended)
Install MCPs using the `--mcp` parameter:

```bash
# Install specific MCPs directly
npx claude-code-templates@latest --mcp=github-integration --yes
npx claude-code-templates@latest --mcp=database-integration --yes
npx claude-code-templates@latest --mcp=deepgraph-react --yes
npx claude-code-templates@latest --mcp=aws-integration --yes
npx claude-code-templates@latest --mcp=docker-integration --yes
```

### Direct Installation Method (Alternative)
MCPs can also be installed as JSON configuration files via direct download:

```bash
# Install GitHub integration MCP
curl -o ./github-integration.json \
  https://raw.githubusercontent.com/davila7/claude-code-templates/main/components/mcps/github-integration.json

# Install database integration MCP
curl -o ./database-integration.json \
  https://raw.githubusercontent.com/davila7/claude-code-templates/main/components/mcps/database-integration.json

# Install DeepGraph React MCP
curl -o ./deepgraph-react.json \
  https://raw.githubusercontent.com/davila7/claude-code-templates/main/components/mcps/deepgraph-react.json
```

### Configuration Management
After installation, MCPs need to be configured:

#### 1. Environment Variables
Set up required environment variables:

```bash
# GitHub integration
export GITHUB_TOKEN="your-github-token"
export GITHUB_REPO="username/repository"

# Database integration
export DB_HOST="localhost"
export DB_USER="username"
export DB_PASSWORD="password"

# AWS integration
export AWS_REGION="us-east-1"
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
```

#### 2. Update Claude Code Configuration
Add MCPs to your `CLAUDE.md` file:

```markdown
## Active MCPs

### GitHub Integration
This project uses GitHub MCP for repository management and automation.
- Enabled features: issues, pull requests, repository browsing
- Authentication: GitHub token
- Permissions: read/write repository, read issues

### Database Integration  
Direct database access for query optimization and schema analysis.
- Supported databases: PostgreSQL (primary), Redis (cache)
- Permissions: read-only access
- Use cases: query optimization, schema documentation
```

#### 3. Verify Installation
Test MCP connectivity:

```bash
# With MCPs configured, Claude Code can verify connections
# Test database connectivity
# Verify GitHub API access
# Check AWS service permissions
```

## Security Considerations

### Authentication & Authorization

#### Best Practices
- **Use Environment Variables**: Never hardcode credentials in configuration files
- **Minimal Permissions**: Grant only necessary permissions to MCPs
- **Token Rotation**: Regularly rotate API tokens and keys
- **Network Security**: Use encrypted connections (HTTPS/TLS) for all external communications

#### Security Configuration
```json
{
  "name": "secure-mcp",
  "type": "mcp",
  "security": {
    "authentication": {
      "method": "environment-variable",
      "tokenVariable": "MCP_API_TOKEN"
    },
    "permissions": {
      "read": true,
      "write": false,
      "admin": false
    },
    "networking": {
      "enforceHttps": true,
      "allowedHosts": ["api.example.com"],
      "timeout": 30000
    }
  }
}
```

### Data Privacy
- **Data Minimization**: Only access data necessary for the task
- **Local Processing**: Process sensitive data locally when possible
- **Audit Logging**: Log MCP access and operations for security monitoring
- **Compliance**: Ensure MCPs comply with relevant data protection regulations

## Working with MCPs

### Development Workflow Integration

#### Code Analysis with External Context
```bash
# Example: Analyzing code with database context
User: "Optimize this SQL query for better performance"

Claude Code with Database MCP:
1. Connects to database to analyze current schema
2. Executes EXPLAIN PLAN for the query
3. Identifies missing indexes and bottlenecks
4. Suggests specific optimizations based on actual data patterns
5. Provides before/after performance metrics
```

#### Repository Management
```bash
# Example: Creating issues from code analysis
User: "Review this codebase for potential improvements"

Claude Code with GitHub MCP:
1. Analyzes codebase for issues and improvements
2. Creates GitHub issues for each identified problem
3. Labels issues appropriately (bug, enhancement, refactor)
4. Assigns priorities based on impact analysis
5. Links related issues and suggests milestones
```

### Best Practices for MCP Usage

#### Effective Integration
- **Start Simple**: Begin with read-only permissions and basic functionality
- **Monitor Usage**: Track MCP API usage to avoid rate limits
- **Handle Failures**: Implement graceful fallbacks when MCPs are unavailable
- **Document Dependencies**: Keep track of which MCPs your workflows depend on

#### Performance Optimization
- **Cache Results**: Cache frequently accessed data to reduce API calls
- **Batch Operations**: Group related operations to improve efficiency
- **Async Processing**: Use asynchronous operations for non-blocking workflows
- **Rate Limiting**: Respect API rate limits to maintain service availability

## Custom MCP Development

### Creating Custom MCPs

#### MCP Structure
```json
{
  "name": "custom-mcp",
  "version": "1.0.0",
  "description": "Custom MCP for specific integration",
  "type": "mcp",
  "config": {
    "endpoint": "https://api.custom-service.com",
    "authentication": {
      "method": "api-key",
      "keyHeader": "X-API-Key"
    },
    "capabilities": [
      "read-data",
      "write-data",
      "execute-operations"
    ]
  },
  "schema": {
    "requests": {
      "getData": {
        "method": "GET",
        "path": "/api/data/{id}",
        "parameters": ["id"],
        "response": "json"
      }
    }
  }
}
```

#### Development Process
1. **Identify Integration Need**: Determine what external service would benefit your workflow
2. **Design Interface**: Define how Claude Code should interact with the service
3. **Implement Security**: Add proper authentication and permission controls
4. **Test Thoroughly**: Validate functionality and error handling
5. **Document Usage**: Create clear documentation and examples
6. **Submit for Review**: Contribute to the community repository

### MCP Quality Standards

#### Technical Requirements
- **Secure Authentication**: Implement proper security measures
- **Error Handling**: Provide clear error messages and recovery strategies
- **Rate Limiting**: Respect external service limits
- **Documentation**: Include comprehensive setup and usage guides

#### User Experience
- **Clear Purpose**: Define what problems the MCP solves
- **Easy Setup**: Minimize configuration complexity
- **Reliable Operation**: Ensure consistent functionality
- **Helpful Feedback**: Provide meaningful status and error messages

## Troubleshooting

### Common Issues

#### Connection Problems
- **Check Credentials**: Verify authentication tokens and keys
- **Network Connectivity**: Ensure network access to external services
- **Firewall Rules**: Check for blocking firewall or proxy rules
- **Service Status**: Verify external service availability

#### Permission Errors
- **Review Permissions**: Ensure MCP has necessary permissions
- **Token Scope**: Verify API token has required scopes
- **Rate Limits**: Check if rate limits have been exceeded
- **Service Quotas**: Ensure service quotas haven't been reached

#### Performance Issues
- **Optimize Queries**: Reduce unnecessary API calls
- **Check Timeouts**: Adjust timeout settings for slow services
- **Monitor Usage**: Track API usage patterns
- **Cache Strategy**: Implement appropriate caching

### Maintenance

#### Regular Updates
- **Update Configurations**: Keep MCP configurations current
- **Rotate Credentials**: Regularly update API tokens and keys
- **Monitor Performance**: Track MCP performance and reliability
- **Review Permissions**: Audit and adjust permissions as needed

#### Debugging
- **Enable Logging**: Turn on detailed logging for troubleshooting
- **Test Connectivity**: Regularly test MCP connections
- **Validate Responses**: Ensure external services return expected data
- **Monitor Errors**: Track and analyze error patterns

---

**Related Documentation:**
- [Components Overview](./overview) - Understanding the component system
- [Agents](./agents) - AI specialists for development tasks
- [Commands](./commands) - Custom slash commands for Claude Code
- [Contributing](../contributing) - How to contribute new MCPs
- [MCP Integration](../project-setup/mcp-integration) - Detailed MCP setup guide