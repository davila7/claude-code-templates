# Code Quality Analysis

Comprehensive code quality analysis and improvement workflow for .NET Core projects.

## Purpose

This command performs thorough code quality analysis including formatting, linting, security scanning, and code metrics analysis for .NET Core applications.

## Usage

```
/code-quality
```

## What this command does

1. **Formats code** according to .editorconfig standards
2. **Analyzes code quality** with multiple analyzers
3. **Scans for security vulnerabilities** in code and dependencies
4. **Generates code metrics** and complexity reports
5. **Provides actionable recommendations** for improvements

## Example Commands

### Code Formatting
```bash
# Format all C# files
dotnet format

# Format specific files or folders
dotnet format --include Program.cs
dotnet format --include Controllers/

# Check formatting without applying changes
dotnet format --verify-no-changes

# Format with specific severity
dotnet format --severity info
```

### Static Code Analysis
```bash
# Build with all analyzers enabled
dotnet build -p:TreatWarningsAsErrors=true -p:WarningsAsErrors=""

# Run Roslyn analyzers
dotnet build -p:RunAnalyzersDuringBuild=true

# Generate code analysis report
dotnet build -p:RunCodeAnalysis=true -p:CodeAnalysisRuleSet=security.ruleset
```

### Security Analysis
```bash
# Scan for vulnerable packages
dotnet list package --vulnerable --include-transitive

# Update vulnerable packages
dotnet list package --outdated | grep -i "security"

# Run security code analysis
dotnet build -p:EnableNETAnalyzers=true -p:AnalysisLevel=latest

# Custom security rules
dotnet build -p:CodeAnalysisRuleSet=security-rules.ruleset
```

## Advanced Analysis Tools

### SonarAnalyzer Integration
```bash
# Install SonarAnalyzer
dotnet add package SonarAnalyzer.CSharp

# Run with SonarQube analysis
dotnet sonarscanner begin /k:"MyProject" /d:sonar.login="mytoken"
dotnet build
dotnet sonarscanner end /d:sonar.login="mytoken"
```

### StyleCop Analyzers
```bash
# Add StyleCop to project
dotnet add package StyleCop.Analyzers

# Configure in .editorconfig
echo "[*.cs]
dotnet_analyzer_diagnostic.SA1200.severity = warning
dotnet_analyzer_diagnostic.SA1309.severity = none" >> .editorconfig

# Build with StyleCop analysis
dotnet build -p:TreatWarningsAsErrors=false
```

### Roslynator Code Analysis
```bash
# Install Roslynator globally
dotnet tool install -g roslynator.dotnet.cli

# Analyze code
roslynator analyze MyProject.sln

# List analyzers
roslynator list-analyzers

# Apply code fixes
roslynator fix MyProject.sln --analyzer-assemblies Roslynator.CSharp.Analyzers
```

## Code Metrics and Complexity

### Calculate Code Metrics
```bash
# Install metrics tool
dotnet tool install -g dotnet-counters

# Basic complexity analysis
dotnet build -p:RunCodeAnalysis=true -p:CodeAnalysisRuleSet=metrics.ruleset

# Generate metrics report (using custom tool or VS extension)
# This would require additional tooling like NDepend or similar
```

### Cyclomatic Complexity Check
```xml
<!-- In .csproj file -->
<PropertyGroup>
  <CodeAnalysisRuleSet>complexity.ruleset</CodeAnalysisRuleSet>
</PropertyGroup>

<ItemGroup>
  <PackageReference Include="Microsoft.CodeAnalysis.NetAnalyzers" Version="7.0.0">
    <PrivateAssets>all</PrivateAssets>
    <IncludeAssets>runtime; build; native; contentfiles; analyzers</IncludeAssets>
  </PackageReference>
</ItemGroup>
```

### Custom Quality Rules
```xml
<!-- quality.ruleset -->
<?xml version="1.0" encoding="utf-8"?>
<RuleSet Name="Quality Rules" ToolsVersion="16.0">
  <Rules AnalyzerId="Microsoft.CodeAnalysis.CSharp" RuleNamespace="Microsoft.CodeAnalysis.CSharp">
    <Rule Id="CS8618" Action="Error" />  <!-- Non-nullable field must contain non-null value -->
    <Rule Id="CS8625" Action="Error" />  <!-- Cannot convert null literal to non-nullable reference -->
  </Rules>
  <Rules AnalyzerId="Microsoft.CodeQuality.Analyzers" RuleNamespace="Microsoft.CodeQuality.Analyzers">
    <Rule Id="CA1062" Action="Warning" /> <!-- Validate arguments of public methods -->
    <Rule Id="CA2007" Action="None" />    <!-- Consider calling ConfigureAwait -->
  </Rules>
</RuleSet>
```

## Automated Quality Checks

### Pre-commit Hook
```bash
#!/bin/sh
# .git/hooks/pre-commit

echo "Running code quality checks..."

# Format check
dotnet format --verify-no-changes
if [ $? -ne 0 ]; then
  echo "❌ Code formatting issues found. Run 'dotnet format' to fix."
  exit 1
fi

# Build with warnings as errors
dotnet build -p:TreatWarningsAsErrors=true
if [ $? -ne 0 ]; then
  echo "❌ Build warnings/errors found."
  exit 1
fi

# Run tests
dotnet test --no-build
if [ $? -ne 0 ]; then
  echo "❌ Tests failed."
  exit 1
fi

echo "✅ All quality checks passed."
```

### CI/CD Quality Gates
```yaml
# Azure DevOps Pipeline
- task: DotNetCoreCLI@2
  displayName: 'Code Format Check'
  inputs:
    command: 'custom'
    custom: 'format'
    arguments: '--verify-no-changes'

- task: DotNetCoreCLI@2
  displayName: 'Security Scan'
  inputs:
    command: 'custom'
    custom: 'list'
    arguments: 'package --vulnerable'

- task: SonarQubePrepare@4
  inputs:
    SonarQube: 'SonarQube-Connection'
    scannerMode: 'MSBuild'
    projectKey: 'MyProject'
```

## Quality Metrics Dashboard

### EditorConfig Configuration
```ini
# .editorconfig
root = true

[*]
charset = utf-8
end_of_line = crlf
insert_final_newline = true
indent_style = space
indent_size = 4
trim_trailing_whitespace = true

[*.cs]
# Code style rules
csharp_new_line_before_open_brace = all
csharp_new_line_before_else = true
csharp_new_line_before_catch = true
csharp_new_line_before_finally = true
csharp_new_line_before_members_in_object_initializers = true
csharp_new_line_before_members_in_anonymous_types = true

# Indentation preferences
csharp_indent_case_contents = true
csharp_indent_switch_labels = true

# Space preferences
csharp_space_after_cast = false
csharp_space_after_keywords_in_control_flow_statements = true
csharp_space_between_method_declaration_parameter_list_parentheses = false

# Wrapping preferences
csharp_preserve_single_line_statements = false
csharp_preserve_single_line_blocks = true

# Nullable reference types
dotnet_diagnostic.CS8618.severity = error
dotnet_diagnostic.CS8625.severity = error
```

### Code Analysis Configuration
```xml
<!-- Directory.Build.props -->
<Project>
  <PropertyGroup>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
    <WarningsAsErrors />
    <WarningsNotAsErrors>CS1591</WarningsNotAsErrors>
    <Nullable>enable</Nullable>
    <LangVersion>latest</LangVersion>
    <EnableNETAnalyzers>true</EnableNETAnalyzers>
    <AnalysisLevel>latest</AnalysisLevel>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Microsoft.CodeAnalysis.NetAnalyzers" Version="7.0.0">
      <PrivateAssets>all</PrivateAssets>
      <IncludeAssets>runtime; build; native; contentfiles; analyzers</IncludeAssets>
    </PackageReference>
    <PackageReference Include="SonarAnalyzer.CSharp" Version="9.0.0.73045">
      <PrivateAssets>all</PrivateAssets>
      <IncludeAssets>runtime; build; native; contentfiles; analyzers</IncludeAssets>
    </PackageReference>
  </ItemGroup>
</Project>
```

## Performance Analysis

### Memory and Performance Profiling
```bash
# Install profiling tools
dotnet tool install -g dotnet-counters
dotnet tool install -g dotnet-trace
dotnet tool install -g dotnet-dump

# Monitor performance counters
dotnet-counters monitor --process-id <pid> --counters System.Runtime

# Collect performance trace
dotnet-trace collect --process-id <pid> --duration 00:00:30

# Analyze memory dumps
dotnet-dump collect --process-id <pid>
dotnet-dump analyze core_20231201_123456
```

### Benchmark Testing
```bash
# Add BenchmarkDotNet
dotnet add package BenchmarkDotNet

# Run benchmarks
dotnet run -c Release --project Benchmarks

# Generate reports
dotnet run -c Release --project Benchmarks -- --exporters json html
```

## Quality Reports

### Generate Quality Report
```bash
#!/bin/bash
# quality-report.sh

echo "Generating Code Quality Report..."

# Create reports directory
mkdir -p reports

# Format check
echo "Checking code formatting..."
dotnet format --verify-no-changes > reports/format-check.txt 2>&1

# Security scan
echo "Scanning for vulnerabilities..."
dotnet list package --vulnerable > reports/security-scan.txt 2>&1

# Build with analysis
echo "Running static analysis..."
dotnet build -p:RunCodeAnalysis=true > reports/static-analysis.txt 2>&1

# Test coverage
echo "Running tests with coverage..."
dotnet test --collect:"XPlat Code Coverage" --results-directory reports/

echo "Quality report generated in reports/ directory"
```

## Best Practices

### Code Quality Standards
- Maintain consistent code formatting across the team
- Use nullable reference types to catch null-related issues
- Implement comprehensive error handling and logging
- Write self-documenting code with meaningful names
- Follow SOLID principles and design patterns

### Security Best Practices
- Regularly update dependencies to patch vulnerabilities
- Use static analysis tools to detect security issues
- Implement input validation and sanitization
- Follow secure coding practices for authentication and authorization
- Regularly audit third-party packages for security issues

### Performance Guidelines
- Use async/await for I/O operations
- Implement proper caching strategies
- Optimize database queries and connections
- Monitor memory usage and garbage collection
- Profile critical code paths for performance bottlenecks