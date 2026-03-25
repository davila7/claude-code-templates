---
sidebar_position: 6
---

# Templates

Complete project setups with pre-configured components and best practices. Browse and install from **[aitmpl.com](https://aitmpl.com)**.

## 📦 What are Templates?

Templates are complete project configurations that install multiple components together. They provide opinionated setups for common technology stacks.

## Installation

### 📦 Basic Installation
Install this component locally in your project. Works with your existing Claude Code setup.

```bash
npx claude-code-templates@latest --template react --yes
```

### Template with Directory
```bash
npx claude-code-templates@latest --template nextjs --directory ./my-app --yes
```

### Template with Additional Components
```bash
npx claude-code-templates@latest \
  --template react \
  --agent security/security-auditor \
  --hook notifications/slack-notifications
```

## 📁 What Gets Installed

Templates create a complete setup:

### File Structure
```
.claude/
├── agents/           # Template-specific agents
├── commands/         # Curated commands
├── mcps/            # Relevant integrations
├── settings/        # Optimized settings
└── hooks/           # Workflow automation

CLAUDE.md             # Template-specific instructions
```

### Configuration
- **CLAUDE.md**: Tailored project instructions
- **Component configs**: Optimized for the template
- **Environment setup**: Required variables and setup steps

## 💡 Template Benefits

### Faster Setup
- **Pre-configured components** for your stack
- **Best practices** built-in
- **Tested combinations** of agents and tools

### Consistency
- **Standardized setups** across projects
- **Team alignment** on tooling
- **Proven configurations**

## 🚀 Template Categories

Browse templates by development stack to find complete setups for your technology:

### Frontend Templates
Modern frontend development stacks for client-side applications. Examples: `react` for React applications, `vue` for Vue.js projects, `nextjs` for full-stack React, `angular` for enterprise applications.

### Backend Templates
Server-side development setups for API and service development. Examples: `nodejs` for Node.js services, `express` for web APIs, `fastapi` for Python APIs, `django` for web applications.

### Full-Stack Templates
Complete application stacks with frontend and backend. Examples: `fullstack-js` for JavaScript stacks, `t3-stack` for TypeScript full-stack, `mern-stack` for MongoDB-Express-React-Node, `python-web` for Python web apps.

### Mobile Templates
Mobile development configurations for cross-platform apps. Examples: `react-native` for native mobile, `flutter` for cross-platform, `ionic` for hybrid apps, `expo` for React Native development.

### Data & AI Templates
Data science and machine learning project setups. Examples: `data-science` for analytics projects, `machine-learning` for ML workflows, `jupyter-notebook` for research, `tensorflow` for deep learning.

### DevOps Templates
Infrastructure and deployment configurations. Examples: `docker` for containerization, `kubernetes` for orchestration, `aws-lambda` for serverless, `vercel-app` for frontend deployment.

## 🎯 How to Choose Templates

Select templates based on your project requirements and team expertise:

### By Technology Preference
- **React ecosystem**: Choose `react`, `nextjs`, or `t3-stack` based on complexity needs
- **Python development**: Select `fastapi`, `django`, or `data-science` based on application type
- **Node.js backend**: Pick `nodejs`, `express`, or `fullstack-js` based on project scope
- **Mobile applications**: Use `react-native`, `flutter`, or `expo` based on platform requirements

### By Project Complexity
- **Simple projects**: Start with `react`, `nodejs`, or `fastapi` for straightforward setups
- **Medium projects**: Use `nextjs`, `express`, or `django` for moderate complexity
- **Complex projects**: Choose `t3-stack`, `mern-stack`, or `kubernetes` for advanced requirements

### By Team Experience
- **Beginner teams**: Begin with `react`, `nodejs`, or `express` for easier learning curves
- **Intermediate teams**: Use `nextjs`, `fastapi`, or `docker` for balanced complexity
- **Advanced teams**: Select `t3-stack`, `kubernetes`, or `machine-learning` for sophisticated setups

## 🔧 Pro Tips

- **Start with templates** for new projects
- **Customize templates** with additional components
- **Study template configurations** to learn best practices
- **Browse [aitmpl.com](https://aitmpl.com)** for specialized templates

---

**Find more templates:** [Browse all templates on aitmpl.com](https://aitmpl.com) → Filter by "Templates"