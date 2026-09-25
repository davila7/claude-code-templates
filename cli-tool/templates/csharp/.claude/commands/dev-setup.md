# Development Setup

Complete development environment setup for .NET Core projects with all necessary tools and configurations.

## Purpose

This command configures a complete development environment with proper tooling, certificates, and project structure for .NET Core development.

## Usage

```
/dev-setup
```

## What this command does

1. **Installs required .NET tools** and global packages
2. **Configures HTTPS certificates** for local development
3. **Sets up user secrets** for secure configuration
4. **Initializes database** with Entity Framework migrations
5. **Configures development environment** variables and settings

## Example Commands

### Initial Development Setup
```bash
# Verify .NET installation
dotnet --version
dotnet --list-sdks

# Install essential global tools
dotnet tool install -g dotnet-ef
dotnet tool install -g dotnet-format
dotnet tool install -g dotnet-reportgenerator-globaltool

# Trust HTTPS development certificate
dotnet dev-certs https --trust

# Initialize user secrets
dotnet user-secrets init
```

### Database Setup (Entity Framework)
```bash
# Install Entity Framework tools
dotnet add package Microsoft.EntityFrameworkCore.SqlServer
dotnet add package Microsoft.EntityFrameworkCore.Tools

# Create initial migration
dotnet ef migrations add InitialCreate

# Update database
dotnet ef database update

# Verify database connection
dotnet ef database list
```

### Project Configuration
```bash
# Create development appsettings
cp appsettings.json appsettings.Development.json

# Set up user secrets for sensitive data
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Server=localhost;Database=MyApp;Trusted_Connection=true;"
dotnet user-secrets set "Jwt:SecretKey" "your-development-secret-key"

# List all user secrets
dotnet user-secrets list
```

## Essential Tools Installation

### Global .NET Tools
```bash
# Code formatting and analysis
dotnet tool install -g dotnet-format
dotnet tool install -g roslynator.dotnet.cli

# Testing and coverage
dotnet tool install -g dotnet-reportgenerator-globaltool
dotnet tool install -g coverlet.console

# Database management
dotnet tool install -g dotnet-ef

# Performance analysis
dotnet tool install -g dotnet-counters
dotnet tool install -g dotnet-trace

# Update all tools
dotnet tool update -g dotnet-ef
dotnet tool update -g dotnet-format
```

### IDE Configuration
```bash
# Generate .editorconfig
cat > .editorconfig << 'EOF'
root = true

[*]
charset = utf-8
end_of_line = crlf
insert_final_newline = true
indent_style = space
indent_size = 4

[*.{json,yml,yaml}]
indent_size = 2

[*.cs]
csharp_new_line_before_open_brace = all
csharp_prefer_braces = true:warning
EOF
```

## Environment Configuration

### Development Settings
```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning",
      "Microsoft.EntityFrameworkCore.Database.Command": "Information"
    }
  },
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost;Database=MyApp_Dev;Trusted_Connection=true;TrustServerCertificate=true"
  },
  "AllowedHosts": "*",
  "DetailedErrors": true,
  "Kestrel": {
    "Endpoints": {
      "Https": {
        "Url": "https://localhost:5001"
      },
      "Http": {
        "Url": "http://localhost:5000"
      }
    }
  }
}
```

### User Secrets Setup
```bash
# Initialize user secrets
dotnet user-secrets init

# Add common development secrets
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Server=localhost;Database=MyApp_Dev;Trusted_Connection=true;TrustServerCertificate=true"
dotnet user-secrets set "Jwt:SecretKey" "development-secret-key-123456789"
dotnet user-secrets set "Jwt:Issuer" "MyApp"
dotnet user-secrets set "Jwt:Audience" "MyApp-Users"
dotnet user-secrets set "ExternalApi:ApiKey" "dev-api-key"

# Verify secrets
dotnet user-secrets list
```

## Local Database Setup

### SQL Server LocalDB
```bash
# Create LocalDB instance
sqllocaldb create MSSQLLocalDB
sqllocaldb start MSSQLLocalDB

# Test connection
sqlcmd -S "(LocalDB)\MSSQLLocalDB" -Q "SELECT @@VERSION"
```

### Entity Framework Setup
```bash
# Add EF Core packages
dotnet add package Microsoft.EntityFrameworkCore.SqlServer
dotnet add package Microsoft.EntityFrameworkCore.Tools
dotnet add package Microsoft.EntityFrameworkCore.Design

# Create DbContext and models
# (This would be done through code generation or manual creation)

# Add initial migration
dotnet ef migrations add InitialCreate

# Apply migration
dotnet ef database update

# Seed development data (if seeder exists)
dotnet run --seed-data
```

## Docker Development Setup

### Development Docker Compose
```yaml
version: '3.8'
services:
  api:
    build: 
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "5000:80"
      - "5001:443"
    environment:
      - ASPNETCORE_ENVIRONMENT=Development
      - ASPNETCORE_URLS=https://+:443;http://+:80
    volumes:
      - ~/.aspnet/https:/https:ro
      - .:/app
    depends_on:
      - db

  db:
    image: mcr.microsoft.com/mssql/server:2022-latest
    environment:
      SA_PASSWORD: "DevPassword123!"
      ACCEPT_EULA: "Y"
    ports:
      - "1433:1433"
    volumes:
      - sqlserver_data:/var/opt/mssql

volumes:
  sqlserver_data:
```

### Development Dockerfile
```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS base
WORKDIR /app
EXPOSE 80
EXPOSE 443

# Install dotnet tools
RUN dotnet tool install -g dotnet-ef
ENV PATH="$PATH:/root/.dotnet/tools"

# Copy project files
COPY *.csproj ./
RUN dotnet restore

# Copy source code
COPY . ./

# Setup for development
RUN dotnet dev-certs https --trust
CMD ["dotnet", "watch", "run", "--urls", "http://0.0.0.0:80"]
```

## Verification and Testing

### Environment Health Check
```bash
# Verify .NET installation
dotnet --info

# Check global tools
dotnet tool list -g

# Test HTTPS certificate
curl -k https://localhost:5001/health

# Verify database connection
dotnet ef database list

# Run application
dotnet run --launch-profile "Development"
```

### Development Workflow Test
```bash
# Build and test
dotnet build
dotnet test

# Format code
dotnet format

# Run with hot reload
dotnet watch run
```

## Best Practices

### Security
- Never commit user secrets to version control
- Use separate databases for development and testing
- Regularly rotate development certificates
- Keep sensitive configuration in user secrets or environment variables

### Performance
- Use connection pooling for database connections
- Enable response compression in development
- Configure proper logging levels to avoid performance impact
- Use async/await patterns consistently

### Maintenance
- Regularly update global tools: `dotnet tool update -g`
- Keep development database schema in sync with migrations
- Clean build outputs regularly: `dotnet clean`
- Monitor for package security vulnerabilities