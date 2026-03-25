# Testing Guide for claude-code-templates

This guide explains how to test the `claude-code-templates` CLI tool before publishing.

## Quick Start

```bash
# Install for local testing
npm run dev:link

# Run basic tests
npm test

# Run detailed tests
npm run test:detailed

# Test specific frameworks
npm run test:react
npm run test:vue
npm run test:node

# Uninstall when done
npm run dev:unlink
```

## Testing Methods

### 1. **NPM Scripts (Recommended)**

```bash
# Basic test suite
npm test

# Detailed testing with all scenarios
npm run test:detailed

# Test specific frameworks
npm run test:react    # Test React setup
npm run test:vue      # Test Vue setup  
npm run test:node     # Test Node.js setup

# Full test suite
npm run test:all
```

### 2. **Makefile Commands**

```bash
# Install for testing
make install-dev

# Run specific tests
make test-basic       # Basic functionality
make test-detailed    # Comprehensive tests
make test-react       # React scenario
make test-vue         # Vue scenario
make test-node        # Node.js scenario

# Interactive testing (manual)
make test-interactive

# Full pre-publish check
make pre-publish

# Cleanup
make uninstall-dev
```

### 3. **Manual Testing**

```bash
# Link package locally
npm link

# Test different scenarios manually
claude-code-templates --help
claude-code-templates --version
claude-code-templates --dry-run
claude-code-templates --language javascript-typescript --framework react --yes
claude-code-templates --language common --yes

# Test in different directories
mkdir test-project && cd test-project
claude-code-templates --language javascript-typescript --framework vue --yes
ls -la  # Check created files

# Cleanup
npm unlink -g claude-code-templates
```

### 4. **Direct Node Execution**

```bash
# Test without installing globally
node bin/create-claude-config.js --help
node bin/create-claude-config.js --dry-run --language javascript-typescript --framework react --yes
```

## Test Coverage

### Automated Tests Include:

- ✅ **Command Variants**: All CLI aliases work
- ✅ **Help & Version**: Basic commands respond correctly
- ✅ **Language Support**: JavaScript/TypeScript, Common, Python, Rust, Go
- ✅ **Framework Support**: React, Vue, Angular, Node.js, None
- ✅ **File Creation**: CLAUDE.md, .claude directory, settings.json
- ✅ **Framework Commands**: Framework-specific commands are created
- ✅ **Dry Run Mode**: Preview mode works without creating files
- ✅ **Error Handling**: Invalid languages/frameworks are rejected

### Framework-Specific Tests:

**React:**
- Component creation commands
- Hooks management commands
- State management helpers

**Vue.js:**
- Component creation commands
- Composables helpers
- Vue 3 patterns

**Angular:**
- Component generation
- Service creation
- Dependency injection patterns

**Node.js:**
- API endpoint creation
- Middleware helpers
- Database integration

## Pre-Publish Checklist

Before publishing a new version, run:

```bash
# Full automated test suite
npm run test:all

# Manual verification
make test-interactive

# Test in fresh environment
make pre-publish
```

### Manual Verification Steps:

1. **Interactive Flow**: Start `claude-code-templates` without flags and go through the full interactive setup
2. **Error Scenarios**: Test invalid inputs and edge cases
3. **File Content**: Verify that created files have correct content
4. **Framework Detection**: Test in projects with existing package.json files
5. **Permissions**: Test in different directory permission scenarios

## Continuous Integration

The `prepublishOnly` script automatically runs tests before publishing:

```json
{
  "scripts": {
    "prepublishOnly": "npm run sync && npm run test"
  }
}
```

This ensures that:
- Templates are synchronized
- All tests pass
- Package is ready for publication

## Test Environments

### Local Development
```bash
npm run dev:link    # Install locally
# ... test commands ...
npm run dev:unlink  # Remove when done
```

### CI/CD Pipeline
```bash
npm ci              # Clean install
npm test           # Run test suite
npm run build      # If applicable
```

### Production Testing
```bash
# Test published version
npx claude-code-templates@latest --version
npx claude-code-templates@latest --help
```

## Debugging Tests

### Verbose Output
```bash
# Add verbose flag to see detailed output
claude-code-templates --language javascript-typescript --framework react --dry-run --yes --verbose
```

### Test Specific Scenarios
```bash
# Create isolated test environment
mkdir /tmp/test-claude && cd /tmp/test-claude
claude-code-templates --language javascript-typescript --framework react --yes
ls -la .claude/commands/
cat CLAUDE.md
```

### Check Generated Files
```bash
# Verify file content
find .claude -name "*.md" -exec echo "=== {} ===" \; -exec cat {} \;
```

## Common Issues & Solutions

### Permission Errors
```bash
# If npm link fails due to permissions
sudo npm link  # Use with caution
# Or use local npm prefix
npm config set prefix ~/.npm-global
```

### Command Not Found
```bash
# If linked command isn't found
which claude-code-templates
echo $PATH
# May need to add npm global bin to PATH
```

### Template Sync Issues
```bash
# Force sync before testing
npm run sync
```

## Contributing Tests

When adding new features, also add tests:

1. Update `test-commands.sh` for basic scenarios
2. Update `test-detailed.sh` for comprehensive coverage
3. Add Makefile targets for specific test cases
4. Update this README with new test procedures

## Test File Structure

```
cli-tool/
├── test-commands.sh      # Basic test suite
├── test-detailed.sh      # Comprehensive tests
├── Makefile             # Test automation
├── TESTING.md           # This guide
└── package.json         # NPM test scripts
```