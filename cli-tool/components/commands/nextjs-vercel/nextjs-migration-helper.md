---
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
argument-hint: [--pages-to-app] [--js-to-ts] [--class-to-hooks] [--analyze]
description: Comprehensive Next.js migration assistant for Pages Router to App Router, JavaScript to TypeScript, and modern patterns
model: sonnet
---

## Next.js Migration Helper

**Migration Type**: $ARGUMENTS

## Current Project Analysis

### Project Structure Analysis
- Next.js version: !`grep '"next"' package.json | head -1`
- Current router: !`ls -la pages/ 2>/dev/null && echo "Pages Router detected" || echo "No pages/ directory found"`
- App router: !`ls -la app/ 2>/dev/null && echo "App Router detected" || echo "No app/ directory found"`
- TypeScript: @tsconfig.json (if exists)

### File Structure Overview
- Pages directory: @pages/ (if exists)
- App directory: @app/ (if exists)  
- Components: @components/ (if exists)
- API routes: @pages/api/ or @app/api/
- Styles: @styles/ (if exists)

## Migration Strategies

### 1. Pages Router to App Router Migration

#### Pre-Migration Analysis
```typescript
// Migration analysis tool
interface MigrationAnalysis {
  currentStructure: 'pages' | 'app' | 'hybrid';
  pagesCount: number;
  apiRoutesCount: number;
  customApp: boolean;
  customDocument: boolean;
  customError: boolean;
  middlewareExists: boolean;
  complexityScore: number;
}

const analyzeMigrationComplexity = (): MigrationAnalysis => {
  return {
    currentStructure: 'pages', // Detected from file structure
    pagesCount: 0, // Count .js/.tsx files in pages/
    apiRoutesCount: 0, // Count files in pages/api/
    customApp: false, // Check for pages/_app
    customDocument: false, // Check for pages/_document
    customError: false, // Check for pages/_error or 404
    middlewareExists: false, // Check for middleware.ts
    complexityScore: 0, // 1-10 scale
  };
};
```

#### Migration Steps

##### Step 1: Create App Directory Structure
```bash
#!/bin/bash
# Create app directory structure

echo "🚀 Creating App Router directory structure..."

# Create base app directory
mkdir -p app
mkdir -p app/globals
mkdir -p app/api

# Create layout files
echo "📁 Creating layout structure..."

# Root layout
cat > app/layout.tsx << 'EOF'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Your App',
  description: 'Migrated to App Router',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
EOF

# Global CSS
cat > app/globals.css << 'EOF'
/* Global styles for App Router */
:root {
  --max-width: 1100px;
  --border-radius: 12px;
  --font-mono: ui-monospace, Menlo, Monaco, 'Cascadia Code', 'Segoe UI Mono',
    'Roboto Mono', 'Oxygen Mono', 'Ubuntu Monospace', 'Source Code Pro',
    'Fira Code', 'Droid Sans Mono', 'Courier New', monospace;
}

* {
  box-sizing: border-box;
  padding: 0;
  margin: 0;
}

html,
body {
  max-width: 100vw;
  overflow-x: hidden;
}

body {
  color: rgb(var(--foreground-rgb));
  background: linear-gradient(
      to bottom,
      transparent,
      rgb(var(--background-end-rgb))
    )
    rgb(var(--background-start-rgb));
}

a {
  color: inherit;
  text-decoration: none;
}

@media (prefers-color-scheme: dark) {
  html {
    color-scheme: dark;
  }
}
EOF

echo "✅ App Router structure created"
```

##### Step 2: Migrate Pages to App Router
```typescript
// Page migration utility
interface PageMigration {
  source: string;
  destination: string;
  type: 'page' | 'api' | 'dynamic' | 'nested';
  hasGetServerSideProps: boolean;
  hasGetStaticProps: boolean;
  hasGetStaticPaths: boolean;
}

const migratePage = async (pagePath: string): Promise<string> => {
  const pageContent = readFileSync(pagePath, 'utf-8');
  
  // Extract page component
  const componentMatch = pageContent.match(/export default function (\w+)/);
  const componentName = componentMatch?.[1] || 'Page';
  
  // Check for data fetching methods
  const hasGetServerSideProps = pageContent.includes('getServerSideProps');
  const hasGetStaticProps = pageContent.includes('getStaticProps');
  const hasGetStaticPaths = pageContent.includes('getStaticPaths');
  
  // Convert to App Router format
  let appRouterCode = '';
  
  // Add metadata if page has Head component
  if (pageContent.includes('from \'next/head\'')) {
    appRouterCode += `import type { Metadata } from 'next'\n\n`;
    appRouterCode += generateMetadata(pageContent);
  }
  
  // Convert data fetching
  if (hasGetServerSideProps) {
    appRouterCode += convertGetServerSideProps(pageContent);
  } else if (hasGetStaticProps) {
    appRouterCode += convertGetStaticProps(pageContent);
  }
  
  // Convert component
  appRouterCode += convertPageComponent(pageContent);
  
  return appRouterCode;
};

const convertGetServerSideProps = (content: string): string => {
  // Extract getServerSideProps logic and convert to Server Component
  const gsspMatch = content.match(/export async function getServerSideProps[\s\S]*?(?=export|$)/);
  
  if (!gsspMatch) return '';
  
  return `
// Server Component with direct data fetching
async function fetchData(context: any) {
  // Converted from getServerSideProps
  // Add your data fetching logic here
  return { data: null };
}
`;
};

const generateMetadata = (content: string): string => {
  // Extract Head component content and convert to metadata
  return `
export const metadata: Metadata = {
  title: 'Page Title',
  description: 'Page description',
}

`;
};

const convertPageComponent = (content: string): string => {
  // Convert page component to App Router format
  return content
    .replace(/import Head from \'next\/head\'/g, '')
    .replace(/<Head>[\s\S]*?<\/Head>/g, '')
    .replace(/export async function getServerSideProps[\s\S]*?(?=export)/g, '')
    .replace(/export async function getStaticProps[\s\S]*?(?=export)/g, '')
    .replace(/export async function getStaticPaths[\s\S]*?(?=export)/g, '');
};
```

##### Step 3: Migrate API Routes
```typescript
// API route migration
const migrateApiRoute = (apiPath: string): string => {
  const apiContent = readFileSync(apiPath, 'utf-8');
  
  // Convert to App Router API format
  let newApiContent = `import { NextRequest, NextResponse } from 'next/server'\n\n`;
  
  // Extract handler functions
  const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
  
  methods.forEach(method => {
    const handlerRegex = new RegExp(`if.*req\\.method.*===.*['"]${method}['"]`, 'i');
    
    if (apiContent.match(handlerRegex)) {
      newApiContent += `
export async function ${method}(
  request: NextRequest,
  { params }: { params: { [key: string]: string } }
) {
  try {
    // Migrated ${method} handler
    // Add your logic here
    
    return NextResponse.json({ message: '${method} success' })
  } catch (error) {
    console.error('${method} error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
`;
    }
  });
  
  return newApiContent;
};
```

### 2. JavaScript to TypeScript Migration

#### TypeScript Configuration Setup
```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "es6"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

#### File Conversion Process
```bash
#!/bin/bash
# Convert JavaScript files to TypeScript

echo "🔄 Converting JavaScript files to TypeScript..."

# Find all .js and .jsx files
find . -name "*.js" -o -name "*.jsx" | grep -v node_modules | grep -v .next | while read file; do
  # Skip if TypeScript version already exists
  ts_file="${file%.*}.ts"
  tsx_file="${file%.*}.tsx"
  
  if [[ -f "$ts_file" ]] || [[ -f "$tsx_file" ]]; then
    echo "⏭️  Skipping $file (TypeScript version exists)"
    continue
  fi
  
  # Determine if file contains JSX
  if grep -q "jsx\|<.*>" "$file"; then
    new_file="${file%.*}.tsx"
  else
    new_file="${file%.*}.ts"
  fi
  
  echo "📝 Converting $file -> $new_file"
  
  # Copy file with new extension
  cp "$file" "$new_file"
  
  # Add basic type annotations
  sed -i.bak '
    # Add React import for TSX files
    /^import.*React/!{
      /\.tsx$/s/^/import React from '\''react'\''\n/
    }
    
    # Add basic prop types
    s/function \([A-Z][a-zA-Z]*\)(\([^)]*\))/function \1(\2: any)/g
    
    # Add return type annotations for simple functions
    s/const \([a-zA-Z][a-zA-Z0-9]*\) = (/const \1 = (/g
  ' "$new_file"
  
  # Remove backup file
  rm "${new_file}.bak" 2>/dev/null || true
  
  echo "✅ Converted $file"
done

echo "🎉 JavaScript to TypeScript conversion completed"
echo "⚠️  Please review and add proper type annotations"
```

### 3. Class Components to Function Components Migration

#### Component Analysis and Conversion
```typescript
// Class to function component converter
const convertClassComponent = (componentCode: string): string => {
  // Extract class component parts
  const classMatch = componentCode.match(/class (\w+) extends (?:React\.)?Component/);
  const componentName = classMatch?.[1] || 'Component';
  
  // Extract state
  const stateMatch = componentCode.match(/state\s*=\s*{([^}]+)}/);
  const initialState = stateMatch?.[1] || '';
  
  // Extract lifecycle methods
  const lifecycleMethods = extractLifecycleMethods(componentCode);
  
  // Extract render method
  const renderMatch = componentCode.match(/render\(\)\s*{([\s\S]*?)(?=^\s*})/m);
  const renderContent = renderMatch?.[1] || '';
  
  // Generate function component
  let functionComponent = `import React, { useState, useEffect } from 'react';\n\n`;
  
  // Add prop types if they exist
  const propsMatch = componentCode.match(/(\w+)Props/);
  if (propsMatch) {
    functionComponent += `interface ${propsMatch[1]}Props {\n  // Add prop definitions here\n}\n\n`;
  }
  
  functionComponent += `const ${componentName}: React.FC<${componentName}Props> = (props) => {\n`;
  
  // Convert state
  if (initialState) {
    const stateVars = parseState(initialState);
    stateVars.forEach(({ name, value }) => {
      functionComponent += `  const [${name}, set${capitalize(name)}] = useState(${value});\n`;
    });
  }
  
  // Convert lifecycle methods to hooks
  if (lifecycleMethods.componentDidMount) {
    functionComponent += `\n  useEffect(() => {\n`;
    functionComponent += `    ${lifecycleMethods.componentDidMount}\n`;
    functionComponent += `  }, []);\n`;
  }
  
  if (lifecycleMethods.componentDidUpdate) {
    functionComponent += `\n  useEffect(() => {\n`;
    functionComponent += `    ${lifecycleMethods.componentDidUpdate}\n`;
    functionComponent += `  });\n`;
  }
  
  if (lifecycleMethods.componentWillUnmount) {
    functionComponent += `\n  useEffect(() => {\n`;
    functionComponent += `    return () => {\n`;
    functionComponent += `      ${lifecycleMethods.componentWillUnmount}\n`;
    functionComponent += `    };\n`;
    functionComponent += `  }, []);\n`;
  }
  
  // Add render return
  functionComponent += `\n  return (\n`;
  functionComponent += renderContent.replace(/this\.state\./g, '').replace(/this\.props\./g, 'props.');
  functionComponent += `  );\n`;
  functionComponent += `};\n\n`;
  functionComponent += `export default ${componentName};`;
  
  return functionComponent;
};

const extractLifecycleMethods = (code: string) => {
  return {
    componentDidMount: extractMethod(code, 'componentDidMount'),
    componentDidUpdate: extractMethod(code, 'componentDidUpdate'),
    componentWillUnmount: extractMethod(code, 'componentWillUnmount'),
  };
};

const extractMethod = (code: string, methodName: string): string | null => {
  const regex = new RegExp(`${methodName}\\(\\)\\s*{([\\s\\S]*?)(?=^\\s*})`);
  const match = code.match(regex);
  return match?.[1] || null;
};

const parseState = (stateString: string) => {
  // Simple state parser - would need more robust implementation
  return [
    { name: 'example', value: 'null' }
  ];
};

const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);
```

### 4. Modern React Patterns Migration

#### Hook Conversion Patterns
```typescript
// Convert common patterns to modern hooks

// State management
const convertStateManagement = `
// ❌ Old class component state
class MyComponent extends Component {
  state = { count: 0, name: '' };
  
  updateCount = () => {
    this.setState({ count: this.state.count + 1 });
  };
}

// ✅ Modern function component with hooks
const MyComponent = () => {
  const [count, setCount] = useState(0);
  const [name, setName] = useState('');
  
  const updateCount = () => {
    setCount(prev => prev + 1);
  };
};
`;

// Effect management
const convertEffects = `
// ❌ Old lifecycle methods
componentDidMount() {
  this.fetchData();
}

componentDidUpdate(prevProps) {
  if (prevProps.id !== this.props.id) {
    this.fetchData();
  }
}

componentWillUnmount() {
  clearInterval(this.timer);
}

// ✅ Modern useEffect
useEffect(() => {
  fetchData();
}, []); // componentDidMount

useEffect(() => {
  fetchData();
}, [id]); // componentDidUpdate with dependency

useEffect(() => {
  return () => {
    clearInterval(timer);
  };
}, []); // componentWillUnmount
`;

// Context usage
const convertContext = `
// ❌ Old context usage
import { ThemeContext } from './context';

class MyComponent extends Component {
  static contextType = ThemeContext;
  
  render() {
    const theme = this.context;
    return <div style={{ color: theme.color }}>Content</div>;
  }
}

// ✅ Modern context with hooks
import { useContext } from 'react';
import { ThemeContext } from './context';

const MyComponent = () => {
  const theme = useContext(ThemeContext);
  
  return <div style={{ color: theme.color }}>Content</div>;
};
`;
```

## Comprehensive Migration Process

### 1. Pre-Migration Checklist
```bash
#!/bin/bash
# Pre-migration validation

echo "🔍 Running pre-migration checks..."

# Check Next.js version
NEXT_VERSION=$(grep '"next"' package.json | grep -o '[0-9.]*')
echo "📦 Next.js version: $NEXT_VERSION"

# Check for potential blockers
BLOCKERS=0

# Check for custom server
if [ -f "server.js" ] || [ -f "server.ts" ]; then
  echo "⚠️  Custom server detected - may need special handling"
  ((BLOCKERS++))
fi

# Check for pages/_document with custom logic
if [ -f "pages/_document.js" ] || [ -f "pages/_document.tsx" ]; then
  if grep -q "getInitialProps" pages/_document.*; then
    echo "⚠️  Custom _document with getInitialProps - needs manual migration"
    ((BLOCKERS++))
  fi
fi

# Check for pages/_error
if [ -f "pages/_error.js" ] || [ -f "pages/_error.tsx" ]; then
  echo "ℹ️  Custom error page found - will need to migrate to error.tsx"
fi

# Check for middleware
if [ -f "middleware.ts" ] || [ -f "middleware.js" ]; then
  echo "✅ Middleware already exists"
else
  echo "ℹ️  No middleware found"
fi

echo ""
if [ $BLOCKERS -eq 0 ]; then
  echo "✅ Ready for migration!"
else
  echo "⚠️  Found $BLOCKERS potential blockers - review before proceeding"
fi
```

### 2. Migration Execution
```bash
#!/bin/bash
# Execute migration

echo "🚀 Starting Next.js migration process..."

# Step 1: Backup current project
echo "📦 Creating backup..."
tar -czf "project-backup-$(date +%Y%m%d_%H%M%S).tar.gz" \
  --exclude=node_modules \
  --exclude=.next \
  --exclude=.git \
  .

# Step 2: Install dependencies
echo "📥 Installing required dependencies..."
npm install --save-dev @types/react @types/react-dom @types/node
npm install --save-dev typescript

# Step 3: Create TypeScript config
if [ ! -f "tsconfig.json" ]; then
  echo "⚙️  Creating TypeScript configuration..."
  npx tsc --init --jsx preserve --esModuleInterop --allowJs --strict
fi

# Step 4: Create App Router structure
echo "🏗️  Creating App Router structure..."
mkdir -p app
# ... (creation logic from previous steps)

# Step 5: Migrate pages
echo "📄 Migrating pages..."
# ... (migration logic)

# Step 6: Migrate API routes
echo "🔌 Migrating API routes..."
# ... (API migration logic)

# Step 7: Update configurations
echo "⚙️  Updating configurations..."
# Update next.config.js, package.json scripts, etc.

echo "✅ Migration completed!"
echo "⚠️  Please review the migrated code and test thoroughly"
```

### 3. Post-Migration Validation
```bash
#!/bin/bash
# Post-migration validation

echo "🔍 Running post-migration validation..."

# Check if project builds
echo "🏗️  Testing build..."
npm run build

if [ $? -eq 0 ]; then
  echo "✅ Build successful"
else
  echo "❌ Build failed - check errors above"
  exit 1
fi

# Check TypeScript compilation
echo "🔍 Checking TypeScript..."
npx tsc --noEmit

if [ $? -eq 0 ]; then
  echo "✅ TypeScript validation passed"
else
  echo "⚠️  TypeScript errors found - review and fix"
fi

# Run tests if they exist
if [ -f "package.json" ] && grep -q '"test"' package.json; then
  echo "🧪 Running tests..."
  npm test
fi

# Check for unused files
echo "🧹 Checking for unused files..."
if [ -d "pages" ]; then
  echo "ℹ️  Original pages/ directory still exists"
  echo "💡 Review and remove after confirming migration is complete"
fi

echo "✅ Post-migration validation completed"
```

## Migration Documentation and Guides

### 1. Migration Report Generation
```typescript
// Generate comprehensive migration report
interface MigrationReport {
  summary: {
    totalFiles: number;
    migratedFiles: number;
    skippedFiles: number;
    errorFiles: number;
  };
  details: {
    pages: MigratedFile[];
    components: MigratedFile[];
    apiRoutes: MigratedFile[];
  };
  issues: Issue[];
  recommendations: string[];
}

interface MigratedFile {
  original: string;
  migrated: string;
  status: 'success' | 'warning' | 'error';
  notes: string[];
}

interface Issue {
  file: string;
  type: 'error' | 'warning';
  message: string;
  solution?: string;
}

const generateMigrationReport = (): MigrationReport => {
  // Implementation to generate comprehensive migration report
  return {
    summary: {
      totalFiles: 0,
      migratedFiles: 0,
      skippedFiles: 0,
      errorFiles: 0,
    },
    details: {
      pages: [],
      components: [],
      apiRoutes: [],
    },
    issues: [],
    recommendations: [
      'Test all functionality thoroughly',
      'Update any hardcoded imports',
      'Review and optimize bundle splitting',
      'Update documentation and README',
    ],
  };
};
```

### 2. Best Practices Guide
```markdown
# Migration Best Practices

## Before Migration
- [ ] Update to latest Next.js version
- [ ] Run full test suite
- [ ] Create comprehensive backup
- [ ] Review custom configurations

## During Migration
- [ ] Migrate incrementally (pages first, then components)
- [ ] Test each migration step
- [ ] Keep detailed notes of changes
- [ ] Handle TypeScript errors immediately

## After Migration
- [ ] Update all imports and references
- [ ] Test all functionality
- [ ] Update documentation
- [ ] Monitor performance metrics
- [ ] Clean up old files after validation

## Common Gotchas
- Dynamic imports syntax changes
- Middleware configuration updates
- Environment variable handling
- CSS and styling adjustments
```

Provide comprehensive migration assistance with automated tools, validation steps, and detailed documentation for successful Next.js modernization.