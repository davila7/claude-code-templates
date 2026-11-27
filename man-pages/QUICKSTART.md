# Quick Start Guide - Claude Code Skills Man Pages

Get started in 60 seconds! 🚀

## One-Command Installation

```bash
cd /home/dchichkov/Z/claude-code-templates/man-pages
./install.sh --user
```

Then add to your `~/.bashrc` or `~/.zshrc`:

```bash
export MANPATH="$HOME/.local/share/man:$MANPATH"
```

Reload your shell:

```bash
source ~/.bashrc  # or source ~/.zshrc
```

## Try It Out

```bash
# View a skill
man skill-file-organizer

# Search for skills
man -k skill | head

# Find specific topics
man -k pdf | grep skill
man -k seo
man -k code
```

## What You Get

- ✅ **257 skills** as man pages
- ✅ **Offline access** - no internet needed
- ✅ **Fast search** - instant results
- ✅ **Standard interface** - familiar man page navigation

## Common Commands

```bash
# Inside a man page:
/keyword    # Search forward
?keyword    # Search backward
n           # Next result
N           # Previous result
Space       # Next page
b           # Previous page
q           # Quit

# From command line:
man skill-<name>              # View specific skill
man -k skill                  # List all skills
apropos <topic>               # Search by topic
whatis skill-<name>           # Brief description
```

## Popular Skills to Try

```bash
# Development
man skill-code-reviewer
man skill-senior-frontend
man skill-mcp-builder
man skill-systematic-debugging

# Productivity
man skill-file-organizer
man skill-notion-knowledge-capture

# Business
man skill-seo-optimizer
man skill-content-creator

# Document Processing
man skill-pdf-processing-pro
man skill-docx
```

## Troubleshooting

### "No manual entry" error?

```bash
# Check if installed
ls ~/.local/share/man/man1/skill-*.1

# Update MANPATH
export MANPATH="$HOME/.local/share/man:$MANPATH"

# Update man database
mandb ~/.local/share/man
```

### Search not working?

```bash
# Rebuild man database
mandb -c ~/.local/share/man
```

## Uninstall

```bash
./install.sh --uninstall-user
```

## More Options

See [README.md](README.md) for:
- System-wide installation
- Compressed installation
- Build customization
- Advanced usage

---

**That's it!** You now have 257 Claude Code Skills at your fingertips. 🎉

