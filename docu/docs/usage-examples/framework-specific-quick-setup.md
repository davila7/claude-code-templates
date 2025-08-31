---
sidebar_position: 2
---

# Framework-Specific Quick Setup

For a faster, non-interactive setup, you can use the modern `--template` parameter for direct template installation.

## Modern Template Installation (Recommended)

```bash
# React project
npx claude-code-templates@latest --template=react --yes

# Python project  
npx claude-code-templates@latest --template=python --yes

# Node.js project
npx claude-code-templates@latest --template=nodejs --yes

# Vue.js project
npx claude-code-templates@latest --template=vue --yes

# Django project
npx claude-code-templates@latest --template=django --yes
```

## Legacy Syntax (Still Supported)

The old `--language` and `--framework` parameters still work but are deprecated:

```bash
# React + TypeScript project (legacy)
npx claude-code-templates@latest --language=javascript-typescript --framework=react --yes

# Python + Django project (legacy)
npx claude-code-templates@latest --language=python --framework=django --yes
```

## Benefits of the New Syntax

- **Simpler Commands**: Single `--template` parameter instead of two separate ones
- **GitHub Downloads**: All templates downloaded directly from GitHub repository
- **Latest Versions**: Always get the most up-to-date configurations
- **Better Performance**: Improved caching and download optimization

The `--yes` flag will skip all prompts and use default configurations. For more details, see the [Framework-Specific Setup](/docs/project-setup/framework-specific-setup) documentation.
