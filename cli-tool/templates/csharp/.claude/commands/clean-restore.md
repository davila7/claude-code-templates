# Clean and Restore

Complete cleanup and package restoration workflow for .NET Core projects.

## Purpose

This command performs a thorough cleanup of build artifacts and restores all NuGet packages with proper dependency resolution.

## Usage

```
/clean-restore
```

## What this command does

1. **Cleans all build outputs** and temporary files
2. **Clears NuGet caches** for fresh package resolution
3. **Restores packages** with dependency validation
4. **Verifies project integrity** after restoration
5. **Optimizes package references** for better performance

## Example Commands

### Complete Clean and Restore
```bash
# Clean build outputs
dotnet clean

# Clear NuGet caches
dotnet nuget locals all --clear

# Restore packages with verbose output
dotnet restore --verbosity normal

# Verify restoration success
dotnet build --dry-run
```

### Advanced Cleanup Options
```bash
# Clean specific configuration
dotnet clean --configuration Release

# Clean all configurations and platforms
dotnet clean --configuration Debug
dotnet clean --configuration Release

# Remove bin and obj directories manually (if needed)
find . -name "bin" -type d -exec rm -rf {} +
find . -name "obj" -type d -exec rm -rf {} +
```

### Package Management
```bash
# Clear specific NuGet cache types
dotnet nuget locals http-cache --clear
dotnet nuget locals global-packages --clear
dotnet nuget locals temp --clear

# Restore with package source verification
dotnet restore --source https://api.nuget.org/v3/index.json --verbosity normal

# Force package re-evaluation
dotnet restore --force --no-cache
```

## Troubleshooting Package Issues

### Resolve Package Conflicts
```bash
# Check for package vulnerabilities
dotnet list package --vulnerable

# Update outdated packages
dotnet list package --outdated

# Restore with detailed diagnostics
dotnet restore --verbosity diagnostic

# Check package sources
dotnet nuget list source
```

### Fix Common Issues
```bash
# Remove package lock files if corrupted
rm -f packages.lock.json
rm -f */packages.lock.json

# Clear MSBuild cache
dotnet build-server shutdown

# Reset NuGet configuration
dotnet nuget locals all --clear
dotnet restore --configfile nuget.config
```

## Best Practices

### Regular Maintenance
- Run clean-restore weekly for active projects
- Clear caches before major builds or releases
- Verify package sources are accessible and secure
- Monitor for security vulnerabilities in dependencies

### Performance Optimization
- Use `--no-cache` sparingly (only when troubleshooting)
- Keep local NuGet cache for faster subsequent restores
- Use package reference consolidation to reduce conflicts
- Enable central package management for large solutions

### Security Considerations
```bash
# Audit packages for known vulnerabilities
dotnet list package --vulnerable --include-transitive

# Check package signatures
dotnet nuget verify MyPackage.nupkg

# Use trusted package sources only
dotnet nuget list source
```

## Integration Scenarios

### CI/CD Pipeline
```bash
# Optimized CI restore
dotnet restore --locked-mode --verbosity minimal

# Cache-friendly approach
dotnet restore --packages ~/.nuget/packages
```

### Development Environment Setup
```bash
# First-time setup
dotnet clean
dotnet nuget locals all --clear
dotnet restore
dotnet build --no-restore
```

### Multi-Project Solutions
```bash
# Solution-level operations
dotnet clean MySolution.sln
dotnet restore MySolution.sln --verbosity normal

# Project-specific operations
dotnet clean MyProject/MyProject.csproj
dotnet restore MyProject/MyProject.csproj
```

## Verification Steps

### Post-Restore Validation
```bash
# Verify all packages restored
dotnet restore --verbosity normal | grep -i "restored"

# Check for restore warnings
dotnet restore 2>&1 | grep -i "warning"

# Test build without restore
dotnet build --no-restore --verbosity minimal
```

### Health Check Commands
```bash
# List all package references
dotnet list package --include-transitive

# Check project file integrity
dotnet msbuild MyProject.csproj /target:ValidatePackageReferences

# Verify SDK version compatibility
dotnet --list-sdks
dotnet --list-runtimes
```