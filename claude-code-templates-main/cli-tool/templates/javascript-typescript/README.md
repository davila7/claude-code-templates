# JavaScript/TypeScript Templates

**Claude Code configuration template optimized for modern JavaScript and TypeScript development**

This folder contains a comprehensive Claude Code template specifically designed for JavaScript and TypeScript projects, supporting popular frameworks like React, Vue.js, Angular, and Node.js.

## 📁 What's in This Folder

This template provides the foundation for JavaScript/TypeScript development with Claude Code:

### 📄 Files Included
- **`CLAUDE.md`** - Complete JavaScript/TypeScript development guidance for Claude Code
- **`README.md`** - This documentation file

### 🎯 Template Features
When you use this template with the installer, it automatically creates:
- **`.claude/settings.json`** - Optimized settings for JS/TS projects
- **`.claude/commands/`** - Ready-to-use commands for common tasks

## 🚀 How to Use This Template

### Option 1: Automated Installation (Recommended)
Use the CLI installer to automatically set up this template in your project:

```bash
cd your-javascript-project
npx claude-code-templates --language javascript-typescript
```

The installer will:
- Copy the `CLAUDE.md` file to your project
- Auto-detect your framework (React, Vue, Node.js, etc.)
- Create appropriate `.claude/` configuration files
- Set up framework-specific commands
- Configure development workflows

### Option 2: Manual Installation
Copy the template manually for more control:

```bash
# Clone the repository
git clone https://github.com/davila7/claude-code-templates.git

# Copy the JavaScript/TypeScript template
cp claude-code-templates/javascript-typescript/CLAUDE.md your-project/

# Then use the CLI to complete the setup
cd your-project
npx claude-code-templates --language javascript-typescript
```

## 🎨 Framework Support

This template automatically configures Claude Code for:

### Frontend Frameworks
- **React** - Components, hooks, JSX, testing with React Testing Library
- **Vue.js** - Composition API, single-file components, state management
- **Angular** - TypeScript-first development, RxJS patterns, CLI integration
- **Svelte** - Compile-time optimizations, modern JavaScript patterns

### Backend Frameworks
- **Express.js** - RESTful APIs, middleware, error handling
- **Fastify** - High-performance Node.js applications
- **NestJS** - Enterprise-grade TypeScript framework
- **Next.js** - Full-stack React applications with SSR/SSG

### Build Tools & Testing
- **Vite, Webpack, esbuild** - Modern build tool configurations
- **Jest, Vitest, Cypress** - Testing framework optimization
- **ESLint, Prettier, TypeScript** - Code quality and formatting

## 🛠️ Commands Created by the Template

When installed, this template provides commands for:

### 🧪 Testing & Quality
- **`/test`** - Run tests with Jest, Vitest, or other frameworks
- **`/lint`** - ESLint with auto-fix capabilities
- **`/typescript-migrate`** - Convert JavaScript files to TypeScript

### 🔧 Development Tools
- **`/debug`** - Debug Node.js applications and browser code
- **`/refactor`** - AI-assisted code refactoring
- **`/npm-scripts`** - Manage and execute npm/yarn scripts

### ⚡ Framework-Specific Commands
- **`/react-component`** - Generate React components (React projects)
- **`/api-endpoint`** - Create Express.js endpoints (Node.js projects)
- **`/route`** - Create API routes (Node.js projects)
- **`/component`** - Create components (React/Vue projects)

## 🎯 What Happens When You Install

### Step 1: Framework Detection
The installer analyzes your project to detect:
- Package.json dependencies
- Project structure
- Framework type (React, Vue, Angular, Node.js)

### Step 2: Template Configuration  
Based on detection, it creates:
```
your-project/
├── CLAUDE.md                    # Copied from this template
├── .claude/
│   ├── settings.json           # Framework-specific settings
│   └── commands/               # Commands for your framework
│       ├── test.md
│       ├── lint.md
│       ├── debug.md
│       └── [framework-specific commands]
```

### Step 3: Framework Customization
For specific frameworks, additional commands are added:

**React Projects:**
- Component generation with TypeScript support
- React hooks creation and management
- Testing with React Testing Library patterns

**Node.js Projects:**
- RESTful API endpoint creation
- Middleware development patterns
- Database integration helpers

**Vue.js Projects:**
- Single-file component templates
- Composition API patterns
- Vue 3 best practices

## 📚 What's in the CLAUDE.md File

The `CLAUDE.md` file in this folder contains comprehensive guidance for:

### Development Commands
- Package management (npm, yarn, pnpm)
- Build commands (dev, build, preview)
- Testing commands (unit, integration, e2e)
- Code quality commands (lint, format, typecheck)

### Technology Stack Guidelines
- JavaScript/TypeScript best practices
- Framework-specific patterns (React, Vue, Angular, Node.js)
- Build tools configuration (Vite, Webpack, esbuild)
- Testing frameworks (Jest, Vitest, Cypress, Playwright)

### Project Structure Recommendations
- File organization patterns
- Naming conventions
- TypeScript configuration
- Code quality standards

### Performance & Security
- Bundle optimization strategies
- Runtime performance tips
- Security best practices
- Dependency management

## 🚀 Getting Started

1. **Navigate to your JavaScript/TypeScript project:**
   ```bash
   cd your-project
   ```

2. **Run the installer:**
   ```bash
   npx claude-code-templates --language javascript-typescript
   ```

3. **Start Claude Code:**
   ```bash
   claude
   ```

4. **Try the commands:**
   ```bash
   /test          # Run your tests
   /lint          # Check code quality
   /component     # Create components (React/Vue)
   /route         # Create API routes (Node.js)
   ```

## 🔧 Customization

After installation, you can customize the setup:

### Modify Commands
Edit files in `.claude/commands/` to match your workflow:
```bash
# Edit the test command
vim .claude/commands/test.md

# Add a custom command
echo "# Deploy Command" > .claude/commands/deploy.md
```

### Adjust Settings
Update `.claude/settings.json` for your project:
```json
{
  "framework": "react",
  "testFramework": "jest", 
  "packageManager": "npm",
  "buildTool": "vite"
}
```

### Add Framework Features
The template adapts to your specific framework needs automatically.

## 📖 Learn More

- **Main Project**: [Claude Code Templates](../README.md)
- **Common Templates**: [Universal patterns](../common/README.md)
- **Python Templates**: [Python development](../python/README.md)
- **CLI Tool**: [Automated installer](../cli-tool/README.md)

## 💡 Why Use This Template?

### Before (Manual Setup)
```bash
# Create CLAUDE.md from scratch
# Research JS/TS best practices
# Configure commands manually
# Set up linting and testing
# Configure TypeScript
# ... hours of setup
```

### After (With This Template)
```bash
npx claude-code-templates --language javascript-typescript
# ✅ Everything configured in 30 seconds!
```

### Benefits
- **Instant Setup** - Get started immediately with proven configurations
- **Framework-Aware** - Automatically adapts to React, Vue, Node.js, etc.
- **Best Practices** - Uses industry-standard patterns and tools
- **TypeScript Ready** - Full TypeScript support out of the box
- **Testing Included** - Pre-configured for Jest, Vitest, and more

## 🤝 Contributing

Help improve this JavaScript/TypeScript template:

1. Test the template with different JS/TS projects
2. Report issues or suggest improvements
3. Add support for new frameworks or tools
4. Share your customizations and best practices

Your contributions make this template better for the entire JavaScript/TypeScript community!

---

**Ready to supercharge your JavaScript/TypeScript development?** Run `npx claude-code-templates --language javascript-typescript` in your project now!