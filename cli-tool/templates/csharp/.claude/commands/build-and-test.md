# Build and Test

Complete build and test workflow for .NET Core projects with comprehensive validation.

## Purpose

This command performs a full build and test cycle with proper error handling and reporting for .NET Core applications.

## Usage

```
/build-and-test
```

## What this command does

1. **Restores NuGet packages** with dependency validation
2. **Builds the project** in Debug and Release configurations
3. **Runs all tests** with coverage reporting
4. **Validates build output** and checks for warnings
5. **Generates test reports** in multiple formats

## Example Commands

### Full Build and Test Cycle
```bash
# Restore packages and build
dotnet restore
dotnet build --configuration Debug --verbosity normal

# Run tests with coverage
dotnet test --collect:"XPlat Code Coverage" --logger trx --results-directory ./TestResults

# Build release version
dotnet build --configuration Release --no-restore

# Verify no build warnings
dotnet build --configuration Release --verbosity normal | grep -i warning
```

### Advanced Testing Options
```bash
# Run tests with detailed output
dotnet test --verbosity normal --collect:"XPlat Code Coverage" --settings coverlet.runsettings

# Run specific test categories
dotnet test --filter "Category=Unit"
dotnet test --filter "Category=Integration"

# Run tests with blame for crash investigation
dotnet test --blame --collect:"XPlat Code Coverage"

# Parallel test execution
dotnet test --parallel
```

### Performance Testing
```bash
# Build with optimizations
dotnet build -c Release --verbosity minimal

# Run performance benchmarks (if using BenchmarkDotNet)
dotnet run -c Release --project Benchmarks

# Memory usage analysis
dotnet-counters monitor --process-id <pid> --counters System.Runtime
```

## Coverage Analysis

### Generate HTML Coverage Report
```bash
# Install report generator tool
dotnet tool install -g dotnet-reportgenerator-globaltool

# Generate coverage report
dotnet test --collect:"XPlat Code Coverage"
reportgenerator -reports:"TestResults/*/coverage.cobertura.xml" -targetdir:"TestResults/CoverageReport" -reporttypes:Html
```

### Coverage Thresholds
```bash
# Fail build if coverage below threshold
dotnet test --collect:"XPlat Code Coverage" /p:CollectCoverage=true /p:CoverletOutputFormat=cobertura /p:Threshold=80 /p:ThresholdType=line
```

## Best Practices

### Build Configuration
- Always restore packages before building
- Use `--no-restore` flag in subsequent builds for performance
- Build both Debug and Release configurations
- Check for build warnings and treat them as errors in CI/CD

### Test Execution
- Run tests in parallel when possible
- Use test categories to organize test execution
- Generate coverage reports for code quality metrics
- Use blame mode to identify flaky tests

### Error Handling
- Check exit codes after each command
- Capture build and test output for debugging
- Use structured logging for better diagnostics
- Set up proper test result reporting

## Integration with CI/CD

### GitHub Actions Example
```yaml
- name: Build and Test
  run: |
    dotnet restore
    dotnet build --no-restore --configuration Release
    dotnet test --no-build --configuration Release --collect:"XPlat Code Coverage" --logger trx
```

### Docker Build Test
```bash
# Test in container environment
docker build -t myapp-test --target test .
docker run --rm myapp-test
```

## Troubleshooting

### Common Issues
- **Package restore failures**: Check NuGet sources and authentication
- **Test discovery issues**: Verify test project references and SDK version
- **Coverage collection problems**: Ensure coverlet.collector package is installed
- **Build timeouts**: Increase timeout values for large projects

### Debug Commands
```bash
# Verbose build output
dotnet build --verbosity diagnostic

# List all tests
dotnet test --list-tests

# Run specific test with detailed output
dotnet test --filter "FullyQualifiedName~MyTest" --verbosity normal
```