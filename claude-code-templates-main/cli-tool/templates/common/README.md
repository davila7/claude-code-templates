# Common Claude Code Templates

This folder contains language-agnostic templates and configurations that can be used across different programming languages and project types.

## What's Included

### Core Files
- `CLAUDE.md` - Base configuration for Claude Code with universal best practices
- `.claude/commands/` - Custom commands for common development tasks

### Common Custom Commands
- `git-workflow.md` - Git operations and workflow automation
- `code-review.md` - Code review and quality assurance tasks
- `project-setup.md` - Project initialization and configuration
- `documentation.md` - Documentation generation and maintenance

## How to Use

### For New Projects
Copy the entire `common/` folder contents to your project root:

```bash
cp -r claude-code-templates/common/* your-project/
```

### For Existing Projects
Merge the relevant files with your existing Claude Code configuration:

```bash
# Copy custom commands
cp -r claude-code-templates/common/.claude/commands/* your-project/.claude/commands/

# Review and merge CLAUDE.md content
cat claude-code-templates/common/CLAUDE.md >> your-project/CLAUDE.md
```

## Customization

### CLAUDE.md
The base CLAUDE.md file includes:
- Universal development best practices
- Common project patterns and conventions
- Git workflow guidelines
- Code quality standards

Customize it by:
- Adding project-specific information
- Modifying coding standards to match your team's preferences
- Including technology-specific guidelines

### Custom Commands
The included commands are designed to be generic and widely applicable. You can:
- Modify existing commands to match your workflow
- Add new commands for project-specific tasks
- Remove commands that don't apply to your project

## Language-Specific Integration

This common template is designed to work alongside language-specific templates:

1. Start with the common template
2. Add language-specific configurations from the appropriate folder
3. Customize both to match your project needs

## Examples

### Multi-language Projects
For projects using multiple programming languages:

```bash
# Copy common base
cp -r claude-code-templates/common/* your-project/

# Add language-specific configurations
cp -r claude-code-templates/javascript-typescript/.claude/commands/* your-project/.claude/commands/
cp -r claude-code-templates/python/.claude/commands/* your-project/.claude/commands/
```

### Team Standardization
Organizations can use this as a base template and customize it for their specific needs:

1. Fork this repository
2. Modify the common templates to match your standards
3. Distribute to development teams
4. Keep synchronized with updates

## Best Practices

- **Start Simple**: Begin with the common template and add complexity as needed
- **Document Changes**: Keep track of customizations in your project's documentation
- **Regular Updates**: Periodically review and update your Claude Code configuration
- **Team Alignment**: Ensure all team members understand the custom commands and workflows

## Contributing

If you create useful generic commands or improvements to the common template, consider contributing them back to this repository to help other developers.