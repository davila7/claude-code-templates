# Quick Start Guide

Get your autonomous team running in 5 minutes!

## 1. Copy Template

```bash
cp -r cli-tool/templates/autonomous-team-template my-awesome-team
cd my-awesome-team
```

## 2. Customize team.yaml

```yaml
team:
  name: my-awesome-team
  description: Does awesome things
  
agents:
  - id: analyzer
    role: Analyzes stuff
    priority: 1
    
  - id: reporter
    role: Reports findings
    priority: 2
    dependencies: [analyzer]
```

## 3. Create Your Agents

```bash
# Copy template for each agent
cp agents/agent-template.md agents/analyzer.md
cp agents/agent-template.md agents/reporter.md

# Edit each file - replace [PLACEHOLDERS]
```

## 4. Add Rules

```bash
# Copy rule template
cp rules/rule-template.md rules/my-rules.md

# Edit and add your rules
```

## 5. Update Orchestrator

Edit `orchestrator.md` - replace all [PLACEHOLDERS] with your team details.

## 6. Test It

```bash
# Test configuration
claude-code --team my-awesome-team --test

# Run on sample data
claude-code --team my-awesome-team --target ./sample
```

## 7. Publish

```bash
# Move to components (replace [category] with actual category like 'development-tools')
mv my-awesome-team cli-tool/components/agents/development-tools/my-awesome-team

# Commit
git add .
git commit -m "Add my-awesome-team"
git push
```

## Done! 🎉

Your autonomous team is ready to use!

## Next Steps

- Read [CREATE_NEW_TEAM_GUIDE.md](CREATE_NEW_TEAM_GUIDE.md) for details
- Check [examples/](examples/) for inspiration
- Join community for support

## Common Issues

**Q: Team not found**
```bash
# Make sure it's in the right location (replace [category] with actual category)
ls cli-tool/components/agents/development-tools/my-awesome-team
```

**Q: Agents not running**
```bash
# Check team.yaml syntax
claude-code --team my-awesome-team --validate
```

**Q: No output generated**
```bash
# Check output configuration in team.yaml
output:
  location: ./my-awesome-team-report.md
```

## Get Help

- [Full Guide](CREATE_NEW_TEAM_GUIDE.md)
- [Documentation](README.md)
- [Examples](examples/)
- [Community Discord](https://discord.gg/...)
