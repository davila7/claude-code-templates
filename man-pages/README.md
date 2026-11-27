# Claude Code Skills - Man Pages

Access Claude Code Skills documentation directly from your terminal using the standard Linux `man` command.

## Overview

This directory contains tools to convert all 263 Claude Code Skills into Linux man pages, making them accessible offline through your terminal. Perfect for developers who prefer command-line workflows.

## Features

✅ **263 Skills Converted** - All skills from business, development, scientific, and more  
✅ **Standard Man Format** - Works with `man`, `apropos`, and `whatis` commands  
✅ **Offline Access** - No internet required once installed  
✅ **Fast Search** - Find skills instantly with `man -k` or `apropos`  
✅ **Familiar Interface** - Standard man page navigation and formatting  
✅ **Compressed Format** - Optional gzip compression to save disk space  

## Quick Start

### 1. Build and Install (User Directory)

```bash
# Navigate to man-pages directory
cd man-pages

# Install for current user (no sudo required)
./install.sh --user

# Add to your shell profile (~/.bashrc or ~/.zshrc)
export MANPATH="$HOME/.local/share/man:$MANPATH"

# Reload shell or source the file
source ~/.bashrc
```

### 2. Use the Man Pages

```bash
# View a specific skill
man skill-file-organizer
man skill-code-reviewer
man skill-seo-optimizer
man skill-pdf-processing-pro

# Search for skills by keyword
man -k skill | grep organizing
man -k pdf
man -k security

# Use apropos for keyword search
apropos skill | grep marketing
```

## Installation Options

### User Installation (Recommended)

Install to `~/.local/share/man` (no sudo required):

```bash
./install.sh --user
```

Add to your `~/.bashrc` or `~/.zshrc`:
```bash
export MANPATH="$HOME/.local/share/man:$MANPATH"
```

### User Installation (Compressed)

Save disk space with gzip compression:

```bash
./install.sh --user --compress
```

### System-Wide Installation

Install to `/usr/local/share/man` (requires sudo, available to all users):

```bash
./install.sh --system
```

### Build Only (No Installation)

Just build the man pages without installing:

```bash
./install.sh --build-only

# Or use make directly
make all
```

## Using the Makefile

The Makefile provides more granular control:

### Build Commands

```bash
# Build all man pages
make all

# Build and compress
make compress

# Decompress man pages
make decompress
```

### Installation Commands

```bash
# Install for current user
make install-user

# Install compressed for current user
make install-user-compressed

# Install system-wide (requires sudo)
make install-system
```

### Preview and Testing

```bash
# Preview a specific skill
make preview SKILL=file-organizer
make preview SKILL=code-reviewer

# Test random man pages for validity
make test

# List all available skills
make list

# Show statistics
make stats
```

### Cleanup

```bash
# Clean generated man pages
make clean

# Uninstall from user directory
make uninstall-user

# Uninstall from system (requires sudo)
make uninstall-system
```

## Manual Conversion

Convert individual skills:

```bash
# Convert a single skill
python3 convert-skill-to-man.py ../cli-tool/components/skills/productivity/file-organizer/SKILL.md

# Convert with custom prefix
python3 convert-skill-to-man.py ../cli-tool/components/skills/development/code-reviewer/SKILL.md -p claude

# Compress output
python3 convert-skill-to-man.py ../cli-tool/components/skills/business-marketing/seo-optimizer/SKILL.md --compress
```

## Usage Examples

### Basic Usage

```bash
# Read about file organization
man skill-file-organizer

# Learn about code review
man skill-code-reviewer

# SEO optimization guide
man skill-seo-optimizer
```

### Searching for Skills

```bash
# Find all skills
man -k skill

# Find productivity skills
man -k skill | grep -i productivity

# Find development skills
man -k skill | grep -i development

# Search by topic
apropos "file organizer"
apropos "code review"
apropos "SEO"
```

### Navigation Inside Man Pages

Once viewing a man page:

- `/keyword` - Search forward for keyword
- `?keyword` - Search backward for keyword
- `n` - Next search result
- `N` - Previous search result
- `Space` - Next page
- `b` - Previous page
- `g` - Go to top
- `G` - Go to bottom
- `q` - Quit

## Skill Categories

### Development (56 skills)
```bash
man skill-code-reviewer
man skill-senior-frontend
man skill-mcp-builder
man skill-security-compliance
man skill-systematic-debugging
```

### Business & Marketing (12 skills)
```bash
man skill-seo-optimizer
man skill-content-creator
man skill-product-manager-toolkit
man skill-marketing-strategy-pmm
```

### Productivity (12 skills)
```bash
man skill-file-organizer
man skill-notion-knowledge-capture
man skill-meeting-insights-analyzer
```

### Document Processing (7 skills)
```bash
man skill-pdf-processing-pro
man skill-docx
man skill-xlsx
man skill-pptx
```

### Scientific (139 skills)
```bash
man skill-biopython
man skill-alphafold-database
man skill-clinical-decision-support
```

### Enterprise Communication (17 skills)
```bash
man skill-brand-guidelines
man skill-gdpr-dsgvo-expert
man skill-quality-manager-qms-iso13485
```

### Creative & Design (9 skills)
```bash
man skill-algorithmic-art
man skill-canvas-design
man skill-ui-design-system
```

## Directory Structure

```
man-pages/
├── README.md                   # This file
├── convert-skill-to-man.py     # Conversion script
├── install.sh                  # Installation script
├── Makefile                    # Build automation
└── man1/                       # Generated man pages
    ├── skill-file-organizer.1
    ├── skill-code-reviewer.1
    ├── skill-seo-optimizer.1
    └── ... (263 total)
```

## Technical Details

### Man Page Format

Man pages are generated in standard `groff` format with the following sections:

- **NAME** - Skill name and brief description
- **SYNOPSIS** - Quick start and main capabilities
- **DESCRIPTION** - Detailed information about when and how to use
- **EXAMPLES** - Code examples and usage patterns
- **SEE ALSO** - Related skills and resources

### Naming Convention

All skills use the `skill-` prefix to avoid conflicts:

- Original: `file-organizer`
- Man page: `skill-file-organizer`
- Command: `man skill-file-organizer`

This can be customized using the `--prefix` option.

### File Locations

**User Installation:**
- Location: `~/.local/share/man/man1/`
- Requires: `MANPATH` environment variable
- Access: Current user only

**System Installation:**
- Location: `/usr/local/share/man/man1/`
- Requires: sudo privileges
- Access: All users

## Troubleshooting

### Man Page Not Found

If `man skill-file-organizer` returns "No manual entry":

1. Check if installed:
   ```bash
   ls ~/.local/share/man/man1/skill-*.1*
   ```

2. Verify MANPATH:
   ```bash
   echo $MANPATH
   ```

3. Add to MANPATH if missing:
   ```bash
   export MANPATH="$HOME/.local/share/man:$MANPATH"
   ```

4. Update man database:
   ```bash
   mandb ~/.local/share/man
   ```

### Search Not Finding Skills

If `man -k skill` returns nothing:

1. Update man database:
   ```bash
   mandb -c ~/.local/share/man
   ```

2. Check man configuration:
   ```bash
   manpath
   ```

### Python Script Errors

Ensure Python 3 is installed:
```bash
python3 --version
```

If missing, install:
```bash
# Ubuntu/Debian
sudo apt install python3

# Fedora/RHEL
sudo dnf install python3

# macOS
brew install python3
```

## Uninstallation

### Remove User Installation

```bash
./install.sh --uninstall-user

# Or manually
rm ~/.local/share/man/man1/skill-*.1*
```

### Remove System Installation

```bash
./install.sh --uninstall-system

# Or manually (requires sudo)
sudo rm /usr/local/share/man/man1/skill-*.1*
sudo mandb
```

## Integration with NPM Package

Future integration planned:

```bash
# Via npx (proposed)
npx claude-code-templates@latest --install-man-pages

# Alternative
npx claude-code-templates@latest --skill-man file-organizer
```

## Contributing

To add or improve man page conversion:

1. **Modify the conversion script**: `convert-skill-to-man.py`
2. **Test the changes**:
   ```bash
   python3 convert-skill-to-man.py path/to/SKILL.md
   man ./man1/skill-name.1
   ```
3. **Rebuild all pages**:
   ```bash
   make clean
   make all
   ```

## Performance

- **Conversion time**: ~2-5 seconds for all 263 skills
- **Disk space**:
  - Uncompressed: ~1.5 MB total
  - Compressed: ~400 KB total (gzip)
- **Search speed**: Instant (uses man database index)

## License

MIT License - Same as Claude Code Templates

## Resources

- **Main Project**: https://github.com/davila7/claude-code-templates
- **Documentation**: https://docs.aitmpl.com/
- **Man Page Format**: https://man7.org/linux/man-pages/man7/groff_man.7.html
- **Man Command**: https://man7.org/linux/man-pages/man1/man.1.html

## Support

- **Issues**: https://github.com/davila7/claude-code-templates/issues
- **Discussions**: https://github.com/davila7/claude-code-templates/discussions

---

**Made with ❤️ for the command-line community**

