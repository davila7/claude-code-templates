---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [automation-type] | --changelog | --workflow-demo | --ci-integration | --validation
description: Automate changelog testing workflow with CI integration and validation
model: sonnet
---

# Test Changelog Automation

Automate changelog testing workflow with comprehensive CI integration: **$ARGUMENTS**

## Current Automation Context

- Changelog files: !`find . -name "CHANGELOG*" -o -name "changelog*" | head -1 || echo "No changelog detected"`
- CI system: !`find . -name ".github" -o -name ".gitlab-ci.yml" -o -name "Jenkinsfile" | head -1 || echo "No CI detected"`
- Version control: !`git status >/dev/null 2>&1 && echo "Git repository" || echo "No git repository"`
- Release process: Analysis of existing release automation and versioning

## Task

Implement comprehensive changelog automation with testing and validation workflows:

**Automation Type**: Use $ARGUMENTS to focus on changelog automation, workflow demonstration, CI integration, or validation testing

**Changelog Automation Framework**:
1. **Automation Setup** - Configure changelog generation, setup version control integration, implement automated updates, design validation rules
2. **Workflow Integration** - Design CI/CD integration, configure automated triggers, implement validation checks, optimize execution performance
3. **Testing Strategy** - Create changelog validation tests, implement format verification, design content validation, setup regression testing
4. **Quality Assurance** - Configure automated formatting, implement consistency checks, setup content validation, optimize maintenance workflows
5. **Validation Framework** - Design automated validation rules, implement compliance checking, configure error reporting, optimize feedback loops
6. **CI Integration** - Setup automated execution, configure deployment triggers, implement notification systems, optimize pipeline performance

**Advanced Features**: Automated release note generation, semantic versioning integration, automated documentation updates, compliance validation.

**Quality Metrics**: Changelog accuracy, automation reliability, validation effectiveness, maintenance efficiency.

**Output**: Complete changelog automation with testing workflows, CI integration, validation rules, and maintenance procedures.