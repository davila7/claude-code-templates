---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [--pull] [--push] [--validate] [--backup]
description: Synchronize environment variables between local development and Vercel deployments
model: sonnet
---

## Vercel Environment Sync

**Sync Operation**: $ARGUMENTS

## Current Environment Analysis

### Local Environment
- Environment files: 
  - @.env.local (if exists)
  - @.env.development (if exists)
  - @.env.production (if exists)
  - @.env (if exists)
- Environment example: @.env.example (if exists)
- Vercel config: @vercel.json (if exists)

### Project Status
- Vercel CLI status: !`vercel --version 2>/dev/null || echo "Vercel CLI not installed"`
- Current project: !`vercel project ls 2>/dev/null | head -5 || echo "Not linked to Vercel project"`
- Git status: !`git status --porcelain | head -5`

## Environment Synchronization Strategy

### 1. Environment File Analysis
```typescript
// Environment file structure analysis
interface EnvironmentConfig {
  development: Record<string, string>;
  preview: Record<string, string>;
  production: Record<string, string>;
}

const environmentFiles = {
  '.env.local': 'Local development overrides',
  '.env.development': 'Development environment',
  '.env.staging': 'Staging/preview environment', 
  '.env.production': 'Production environment',
  '.env': 'Default environment (committed to git)',
  '.env.example': 'Environment template (safe to commit)',
};
```

### 2. Vercel Environment Management
```bash
# List all environment variables for all environments
vercel env ls

# List environment variables for specific environment
vercel env ls --environment=production
vercel env ls --environment=preview
vercel env ls --environment=development

# Pull environment variables from Vercel
vercel env pull .env.vercel

# Add new environment variable
vercel env add [name] [environment]

# Remove environment variable
vercel env rm [name] [environment]
```

## Synchronization Operations

### 1. Pull Environment Variables from Vercel
```bash
#!/bin/bash
# Pull environments from Vercel

echo "🔄 Pulling environment variables from Vercel..."

# Create backup of existing files
if [ -f .env.local ]; then
  cp .env.local .env.local.backup.$(date +%Y%m%d_%H%M%S)
  echo "📦 Backup created for .env.local"
fi

# Pull from Vercel (creates .env.local by default)
vercel env pull .env.local

if [ $? -eq 0 ]; then
  echo "✅ Successfully pulled environment variables"
  echo "📁 Variables saved to .env.local"
  
  # Show summary
  echo ""
  echo "📊 Environment Variables Summary:"
  echo "================================"
  grep -c "=" .env.local 2>/dev/null && echo "Total variables: $(grep -c "=" .env.local)"
  
  # List variable names (hide values for security)
  echo ""
  echo "🔑 Variable Names:"
  grep "^[A-Z]" .env.local | cut -d'=' -f1 | sort
else
  echo "❌ Failed to pull environment variables"
  exit 1
fi
```

### 2. Push Environment Variables to Vercel
```bash
#!/bin/bash
# Push environment variables to Vercel

echo "🚀 Pushing environment variables to Vercel..."

# Check if environment files exist
ENV_FILES=(".env.production" ".env.staging" ".env.development")
FOUND_FILES=()

for file in "${ENV_FILES[@]}"; do
  if [ -f "$file" ]; then
    FOUND_FILES+=("$file")
  fi
done

if [ ${#FOUND_FILES[@]} -eq 0 ]; then
  echo "❌ No environment files found to push"
  echo "💡 Expected files: ${ENV_FILES[*]}"
  exit 1
fi

# Push each environment file
for file in "${FOUND_FILES[@]}"; do
  echo "📤 Processing $file..."
  
  # Determine target environment
  if [[ "$file" == *"production"* ]]; then
    ENV="production"
  elif [[ "$file" == *"staging"* ]]; then
    ENV="preview"  # Vercel uses 'preview' for staging
  elif [[ "$file" == *"development"* ]]; then
    ENV="development"
  else
    ENV="development"  # Default
  fi
  
  echo "🎯 Pushing to $ENV environment..."
  
  # Read variables from file and push to Vercel
  while IFS='=' read -r key value; do
    # Skip empty lines and comments
    if [[ -z "$key" || "$key" =~ ^#.* ]]; then
      continue
    fi
    
    # Remove quotes from value if present
    value=$(echo "$value" | sed 's/^"\(.*\)"$/\1/' | sed "s/^'\(.*\)'$/\1/")
    
    echo "  🔑 Setting $key..."
    echo "$value" | vercel env add "$key" "$ENV" --force
    
  done < "$file"
  
  echo "✅ Completed $file -> $ENV"
  echo ""
done

echo "🎉 All environment variables pushed successfully!"
```

### 3. Environment Validation
```typescript
// Environment validation script
interface ValidationRule {
  name: string;
  required: boolean;
  pattern?: RegExp;
  description: string;
}

const validationRules: ValidationRule[] = [
  {
    name: 'DATABASE_URL',
    required: true,
    pattern: /^(postgresql|mysql|sqlite):\/\/.+/,
    description: 'Database connection string',
  },
  {
    name: 'NEXTAUTH_SECRET',
    required: true,
    pattern: /.{32,}/,
    description: 'NextAuth.js secret key (min 32 characters)',
  },
  {
    name: 'NEXTAUTH_URL',
    required: true,
    pattern: /^https?:\/\/.+/,
    description: 'NextAuth.js canonical URL',
  },
  {
    name: 'API_KEY',
    required: false,
    pattern: /^[A-Za-z0-9_-]+$/,
    description: 'API key for external services',
  },
];

function validateEnvironment(envFile: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const env = readEnvironmentFile(envFile);
  
  // Check required variables
  validationRules.forEach(rule => {
    const value = env[rule.name];
    
    if (rule.required && !value) {
      errors.push(`Missing required variable: ${rule.name}`);
      return;
    }
    
    if (value && rule.pattern && !rule.pattern.test(value)) {
      errors.push(`Invalid format for ${rule.name}: ${rule.description}`);
    }
  });
  
  // Check for common issues
  Object.entries(env).forEach(([key, value]) => {
    // Check for placeholder values
    if (value === 'your-secret-here' || value === 'change-me') {
      warnings.push(`Placeholder value detected for ${key}`);
    }
    
    // Check for potentially committed secrets
    if (key.includes('SECRET') || key.includes('PRIVATE')) {
      if (value.length < 16) {
        warnings.push(`${key} appears to be too short for a secret`);
      }
    }
  });
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function readEnvironmentFile(filePath: string): Record<string, string> {
  // Implementation to read and parse environment file
  return {};
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
```

### 4. Environment Backup and Restore
```bash
#!/bin/bash
# Backup and restore environment variables

BACKUP_DIR=".env-backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

backup_environment() {
  echo "📦 Creating environment backup..."
  
  mkdir -p "$BACKUP_DIR"
  
  # Backup local files
  for file in .env.local .env.development .env.staging .env.production; do
    if [ -f "$file" ]; then
      cp "$file" "$BACKUP_DIR/${file}.${TIMESTAMP}"
      echo "✅ Backed up $file"
    fi
  done
  
  # Backup Vercel environment variables
  echo "📤 Backing up Vercel environment variables..."
  
  for env in production preview development; do
    vercel env ls --environment="$env" > "$BACKUP_DIR/vercel-${env}.${TIMESTAMP}.txt"
    echo "✅ Backed up Vercel $env environment"
  done
  
  echo "🎉 Backup completed in $BACKUP_DIR/"
  ls -la "$BACKUP_DIR/" | grep "$TIMESTAMP"
}

restore_environment() {
  local backup_timestamp="$1"
  
  if [ -z "$backup_timestamp" ]; then
    echo "❌ Please specify backup timestamp"
    echo "💡 Available backups:"
    ls -1 "$BACKUP_DIR/" | grep -E "\.env" | cut -d'.' -f3 | sort -u
    exit 1
  fi
  
  echo "🔄 Restoring environment from backup $backup_timestamp..."
  
  # Restore local files
  for file in .env.local .env.development .env.staging .env.production; do
    backup_file="$BACKUP_DIR/${file}.${backup_timestamp}"
    if [ -f "$backup_file" ]; then
      cp "$backup_file" "$file"
      echo "✅ Restored $file"
    fi
  done
  
  echo "🎉 Environment restored from backup"
}

# Usage functions
case "$1" in
  backup)
    backup_environment
    ;;
  restore)
    restore_environment "$2"
    ;;
  *)
    echo "Usage: $0 {backup|restore} [timestamp]"
    exit 1
    ;;
esac
```

## Advanced Synchronization Features

### 1. Environment Diff and Comparison
```typescript
// Environment comparison tool
interface EnvironmentDiff {
  added: string[];
  removed: string[];
  modified: Array<{
    key: string;
    local: string;
    remote: string;
  }>;
  unchanged: string[];
}

function compareEnvironments(
  local: Record<string, string>,
  remote: Record<string, string>
): EnvironmentDiff {
  const diff: EnvironmentDiff = {
    added: [],
    removed: [],
    modified: [],
    unchanged: [],
  };
  
  const allKeys = new Set([...Object.keys(local), ...Object.keys(remote)]);
  
  allKeys.forEach(key => {
    if (!(key in local)) {
      diff.added.push(key);
    } else if (!(key in remote)) {
      diff.removed.push(key);
    } else if (local[key] !== remote[key]) {
      diff.modified.push({
        key,
        local: local[key],
        remote: remote[key],
      });
    } else {
      diff.unchanged.push(key);
    }
  });
  
  return diff;
}

// Generate diff report
function generateDiffReport(diff: EnvironmentDiff): string {
  let report = '# Environment Variables Comparison\n\n';
  
  if (diff.added.length > 0) {
    report += '## ➕ Variables in Remote (not in Local)\n';
    diff.added.forEach(key => {
      report += `- \`${key}\`\n`;
    });
    report += '\n';
  }
  
  if (diff.removed.length > 0) {
    report += '## ➖ Variables in Local (not in Remote)\n';
    diff.removed.forEach(key => {
      report += `- \`${key}\`\n`;
    });
    report += '\n';
  }
  
  if (diff.modified.length > 0) {
    report += '## 🔄 Modified Variables\n';
    diff.modified.forEach(({ key, local, remote }) => {
      report += `### \`${key}\`\n`;
      report += `- **Local**: \`${maskSensitive(local)}\`\n`;
      report += `- **Remote**: \`${maskSensitive(remote)}\`\n\n`;
    });
  }
  
  if (diff.unchanged.length > 0) {
    report += `## ✅ Unchanged Variables (${diff.unchanged.length})\n`;
    report += `${diff.unchanged.map(key => `- \`${key}\``).join('\n')}\n\n`;
  }
  
  return report;
}

function maskSensitive(value: string): string {
  // Mask sensitive values for security
  if (value.length <= 8) {
    return '*'.repeat(value.length);
  }
  return `${value.substring(0, 4)}${'*'.repeat(value.length - 8)}${value.substring(value.length - 4)}`;
}
```

### 2. Environment Template Generation
```typescript
// Generate .env.example from existing environment
function generateEnvExample(envFile: string): string {
  const env = readEnvironmentFile(envFile);
  let template = '# Environment Variables Template\n';
  template += '# Copy this file to .env.local and fill in the values\n\n';
  
  const categories = categorizeVariables(env);
  
  Object.entries(categories).forEach(([category, variables]) => {
    template += `# ${category.toUpperCase()}\n`;
    variables.forEach(({ key, description, example }) => {
      if (description) {
        template += `# ${description}\n`;
      }
      template += `${key}=${example || 'your-value-here'}\n\n`;
    });
  });
  
  return template;
}

function categorizeVariables(env: Record<string, string>) {
  const categories: Record<string, Array<{
    key: string;
    description?: string;
    example?: string;
  }>> = {
    database: [],
    authentication: [],
    external_apis: [],
    configuration: [],
  };
  
  Object.keys(env).forEach(key => {
    if (key.includes('DATABASE') || key.includes('DB_')) {
      categories.database.push({ key, description: getDatabaseDescription(key) });
    } else if (key.includes('AUTH') || key.includes('SECRET')) {
      categories.authentication.push({ key, description: getAuthDescription(key) });
    } else if (key.includes('API_KEY') || key.includes('_TOKEN')) {
      categories.external_apis.push({ key, description: getApiDescription(key) });
    } else {
      categories.configuration.push({ key, description: getConfigDescription(key) });
    }
  });
  
  return categories;
}

function getDatabaseDescription(key: string): string {
  if (key === 'DATABASE_URL') return 'Database connection string';
  if (key === 'DB_HOST') return 'Database host';
  if (key === 'DB_PORT') return 'Database port';
  if (key === 'DB_NAME') return 'Database name';
  return 'Database configuration';
}

function getAuthDescription(key: string): string {
  if (key === 'NEXTAUTH_SECRET') return 'NextAuth.js secret key';
  if (key === 'NEXTAUTH_URL') return 'NextAuth.js canonical URL';
  if (key === 'JWT_SECRET') return 'JWT secret key';
  return 'Authentication configuration';
}

function getApiDescription(key: string): string {
  return `API key for ${key.toLowerCase().replace(/_/g, ' ')}`;
}

function getConfigDescription(key: string): string {
  return `Configuration for ${key.toLowerCase().replace(/_/g, ' ')}`;
}
```

### 3. Security and Validation
```bash
#!/bin/bash
# Security checks for environment variables

security_check() {
  echo "🔐 Running security checks on environment variables..."
  
  local issues=0
  
  # Check for common security issues
  for file in .env.local .env.development .env.staging .env.production; do
    if [ ! -f "$file" ]; then
      continue
    fi
    
    echo "🔍 Checking $file..."
    
    # Check for weak secrets
    while IFS='=' read -r key value; do
      if [[ -z "$key" || "$key" =~ ^#.* ]]; then
        continue
      fi
      
      # Remove quotes
      value=$(echo "$value" | sed 's/^"\(.*\)"$/\1/' | sed "s/^'\(.*\)'$/\1/")
      
      # Check for placeholder values
      if [[ "$value" == *"your-"* || "$value" == *"change-me"* || "$value" == *"replace-me"* ]]; then
        echo "⚠️  Placeholder value in $key"
        ((issues++))
      fi
      
      # Check for short secrets
      if [[ "$key" =~ (SECRET|PRIVATE|KEY|TOKEN) ]]; then
        if [ ${#value} -lt 16 ]; then
          echo "⚠️  $key appears to be too short for a secret (${#value} characters)"
          ((issues++))
        fi
      fi
      
      # Check for hardcoded URLs in production
      if [[ "$file" == *"production"* && "$value" =~ localhost ]]; then
        echo "⚠️  $key contains localhost in production environment"
        ((issues++))
      fi
      
    done < "$file"
  done
  
  # Check if .env files are in .gitignore
  if [ -f .gitignore ]; then
    if ! grep -q ".env.local" .gitignore; then
      echo "⚠️  .env.local not in .gitignore"
      ((issues++))
    fi
    if ! grep -q ".env.production" .gitignore; then
      echo "⚠️  .env.production not in .gitignore"
      ((issues++))
    fi
  else
    echo "⚠️  No .gitignore file found"
    ((issues++))
  fi
  
  echo ""
  if [ $issues -eq 0 ]; then
    echo "✅ No security issues found"
  else
    echo "❌ Found $issues security issues"
    exit 1
  fi
}

security_check
```

## Automation and Integration

### 1. GitHub Actions Integration
```yaml
# .github/workflows/env-sync.yml
name: Environment Sync

on:
  push:
    branches: [main, develop]
    paths: ['.env.example', '.env.*']
  
  workflow_dispatch:
    inputs:
      action:
        description: 'Sync action'
        required: true
        default: 'validate'
        type: choice
        options:
        - validate
        - pull
        - push

jobs:
  env-sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Install Vercel CLI
        run: npm i -g vercel@latest
      
      - name: Link to Vercel
        run: vercel link --token=${{ secrets.VERCEL_TOKEN }} --yes
      
      - name: Validate Environment
        if: github.event.inputs.action == 'validate' || github.event.inputs.action == ''
        run: |
          # Run environment validation
          node scripts/validate-env.js
      
      - name: Pull Environment
        if: github.event.inputs.action == 'pull'
        run: |
          vercel env pull .env.ci --token=${{ secrets.VERCEL_TOKEN }}
          # Validate pulled environment
          node scripts/validate-env.js .env.ci
      
      - name: Push Environment
        if: github.event.inputs.action == 'push'
        run: |
          # Push environment variables to Vercel
          node scripts/push-env.js --token=${{ secrets.VERCEL_TOKEN }}
```

### 2. Development Workflow Integration
```bash
#!/bin/bash
# Pre-commit hook for environment validation

echo "🔍 Validating environment variables..."

# Check if environment files are properly configured
if [ -f .env.local ]; then
  echo "✅ .env.local exists"
else
  echo "⚠️  .env.local not found"
  if [ -f .env.example ]; then
    echo "💡 Copy .env.example to .env.local and configure your variables"
  fi
fi

# Validate environment structure
node scripts/validate-env.js

if [ $? -ne 0 ]; then
  echo "❌ Environment validation failed"
  exit 1
fi

echo "✅ Environment validation passed"
```

## Comprehensive Sync Operations

Implement complete environment synchronization workflow with validation, backup, security checks, and automation integration for seamless development and deployment processes.

<function_calls>
<invoke name="TodoWrite">
<parameter name="todos">[{"content": "Analyze hook system and context monitoring capabilities", "status": "completed"}, {"content": "Design context threshold detection mechanism", "status": "completed"}, {"content": "Create hook script for automatic compact + clear sequence", "status": "pending"}, {"content": "Configure hook in settings.json with proper event triggers", "status": "pending"}, {"content": "Test hook execution and threshold detection", "status": "pending"}, {"content": "Add markdown copy button to Supabase blog post", "status": "completed"}, {"content": "Write Claude Code + Next.js and Vercel Integration article", "status": "completed"}, {"content": "Create Next.js Architecture Expert agent", "status": "completed"}, {"content": "Create Vercel Deployment Specialist agent", "status": "completed"}, {"content": "Create React Performance Optimizer agent", "status": "completed"}, {"content": "Create Next.js app scaffolding command", "status": "completed"}, {"content": "Create Vercel deployment optimization command", "status": "completed"}, {"content": "Create component generator command", "status": "completed"}, {"content": "Create API route tester command", "status": "completed"}, {"content": "Create bundle analyzer command", "status": "completed"}, {"content": "Create middleware creator command", "status": "completed"}, {"content": "Create edge function generator command", "status": "completed"}, {"content": "Create performance audit command", "status": "completed"}, {"content": "Create environment sync command", "status": "completed"}, {"content": "Create migration helper command", "status": "in_progress"}]