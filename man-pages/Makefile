# Makefile for building Claude Code Skills man pages

SKILLS_DIR = ../cli-tool/components/skills
SCRIPT = convert-skill-to-man.py
MAN_DIR = man1
PREFIX = skill

# Find all SKILL.md files
SKILL_FILES := $(shell find $(SKILLS_DIR) -name "SKILL.md")

# Generate man page paths
MAN_PAGES := $(patsubst $(SKILLS_DIR)/%/SKILL.md,$(MAN_DIR)/$(PREFIX)-%.1,$(SKILL_FILES))

# Default target
.PHONY: all
all: man-pages

.PHONY: man-pages
man-pages: $(MAN_DIR)
	@echo "Converting skills to man pages..."
	@for skill in $(SKILL_FILES); do \
		echo "Converting $$skill..."; \
		python3 $(SCRIPT) "$$skill" 2>/dev/null || true; \
	done
	@echo "Done! Created $$(ls -1 $(MAN_DIR)/*.1 2>/dev/null | wc -l) man pages."

$(MAN_DIR):
	mkdir -p $(MAN_DIR)

# Compress man pages with gzip
.PHONY: compress
compress: man-pages
	@echo "Compressing man pages..."
	@for man in $(MAN_DIR)/*.1; do \
		if [ -f "$$man" ]; then \
			gzip -9 -f "$$man"; \
			echo "Compressed: $$man.gz"; \
		fi \
	done
	@echo "Done! Created $$(ls -1 $(MAN_DIR)/*.1.gz 2>/dev/null | wc -l) compressed man pages."

# Decompress man pages
.PHONY: decompress
decompress:
	@echo "Decompressing man pages..."
	@for man in $(MAN_DIR)/*.1.gz; do \
		if [ -f "$$man" ]; then \
			gunzip "$$man"; \
			echo "Decompressed: $${man%.gz}"; \
		fi \
	done

# Preview a specific man page
.PHONY: preview
preview:
	@if [ -z "$(SKILL)" ]; then \
		echo "Usage: make preview SKILL=<skill-name>"; \
		echo "Example: make preview SKILL=file-organizer"; \
		exit 1; \
	fi
	@if [ -f "$(MAN_DIR)/$(PREFIX)-$(SKILL).1" ]; then \
		man ./$(MAN_DIR)/$(PREFIX)-$(SKILL).1; \
	elif [ -f "$(MAN_DIR)/$(PREFIX)-$(SKILL).1.gz" ]; then \
		man ./$(MAN_DIR)/$(PREFIX)-$(SKILL).1.gz; \
	else \
		echo "Man page not found: $(PREFIX)-$(SKILL)"; \
		echo "Available pages:"; \
		ls $(MAN_DIR)/ | head -10; \
		exit 1; \
	fi

# Install to user's local man directory
.PHONY: install-user
install-user: man-pages
	@echo "Installing man pages to ~/.local/share/man/man1/..."
	@mkdir -p ~/.local/share/man/man1
	@cp $(MAN_DIR)/*.1 ~/.local/share/man/man1/
	@echo "Done! Installed $$(ls -1 $(MAN_DIR)/*.1 | wc -l) man pages."
	@echo ""
	@echo "You may need to update your MANPATH:"
	@echo "  export MANPATH=~/.local/share/man:\$$MANPATH"
	@echo ""
	@echo "Or run: mandb ~/.local/share/man"

# Install compressed versions
.PHONY: install-user-compressed
install-user-compressed: compress
	@echo "Installing compressed man pages to ~/.local/share/man/man1/..."
	@mkdir -p ~/.local/share/man/man1
	@cp $(MAN_DIR)/*.1.gz ~/.local/share/man/man1/
	@echo "Done! Installed $$(ls -1 $(MAN_DIR)/*.1.gz | wc -l) compressed man pages."
	@echo ""
	@echo "You may need to update your MANPATH:"
	@echo "  export MANPATH=~/.local/share/man:\$$MANPATH"

# Install to system-wide directory (requires sudo)
.PHONY: install-system
install-system: man-pages
	@echo "Installing man pages to /usr/local/share/man/man1/ (requires sudo)..."
	@sudo mkdir -p /usr/local/share/man/man1
	@sudo cp $(MAN_DIR)/*.1 /usr/local/share/man/man1/
	@sudo mandb
	@echo "Done! Installed $$(ls -1 $(MAN_DIR)/*.1 | wc -l) man pages system-wide."

# Uninstall from user directory
.PHONY: uninstall-user
uninstall-user:
	@echo "Removing skill man pages from ~/.local/share/man/man1/..."
	@rm -f ~/.local/share/man/man1/$(PREFIX)-*.1
	@rm -f ~/.local/share/man/man1/$(PREFIX)-*.1.gz
	@echo "Done!"

# Uninstall from system directory
.PHONY: uninstall-system
uninstall-system:
	@echo "Removing skill man pages from /usr/local/share/man/man1/ (requires sudo)..."
	@sudo rm -f /usr/local/share/man/man1/$(PREFIX)-*.1
	@sudo rm -f /usr/local/share/man/man1/$(PREFIX)-*.1.gz
	@sudo mandb
	@echo "Done!"

# List all available skills
.PHONY: list
list:
	@echo "Available skill man pages:"
	@if [ -n "$$(ls $(MAN_DIR)/*.1 2>/dev/null)" ]; then \
		ls $(MAN_DIR)/*.1 | xargs -n1 basename | sed 's/\.1$$//' | sort; \
	elif [ -n "$$(ls $(MAN_DIR)/*.1.gz 2>/dev/null)" ]; then \
		ls $(MAN_DIR)/*.1.gz | xargs -n1 basename | sed 's/\.1\.gz$$//' | sort; \
	else \
		echo "No man pages built yet. Run 'make all' first."; \
	fi

# Count skills by category
.PHONY: stats
stats:
	@echo "Skill statistics:"
	@echo "Total skills: $$(find $(SKILLS_DIR) -name 'SKILL.md' | wc -l)"
	@echo ""
	@echo "By category:"
	@for dir in $(SKILLS_DIR)/*/; do \
		category=$$(basename "$$dir"); \
		count=$$(find "$$dir" -name 'SKILL.md' | wc -l); \
		if [ $$count -gt 0 ]; then \
			printf "  %-30s %3d skills\n" "$$category" $$count; \
		fi \
	done | sort -k2 -rn

# Clean generated man pages
.PHONY: clean
clean:
	@echo "Cleaning man pages..."
	@rm -f $(MAN_DIR)/*.1 $(MAN_DIR)/*.1.gz
	@echo "Done!"

# Test a few random man pages
.PHONY: test
test: man-pages
	@echo "Testing random man pages..."
	@for man in $$(ls $(MAN_DIR)/*.1 | shuf | head -3); do \
		echo ""; \
		echo "Testing: $$man"; \
		man -l "$$man" > /dev/null 2>&1 && echo "  ✓ Valid" || echo "  ✗ Invalid"; \
	done

.PHONY: help
help:
	@echo "Claude Code Skills Man Pages - Makefile"
	@echo ""
	@echo "Targets:"
	@echo "  all                    - Build all man pages (default)"
	@echo "  man-pages              - Build all man pages"
	@echo "  compress               - Build and compress man pages with gzip"
	@echo "  decompress             - Decompress man pages"
	@echo "  preview SKILL=name     - Preview a specific man page"
	@echo "  install-user           - Install to ~/.local/share/man/man1/"
	@echo "  install-user-compressed- Install compressed to ~/.local/share/man/man1/"
	@echo "  install-system         - Install to /usr/local/share/man/man1/ (sudo)"
	@echo "  uninstall-user         - Remove from user directory"
	@echo "  uninstall-system       - Remove from system directory (sudo)"
	@echo "  list                   - List all available skill man pages"
	@echo "  stats                  - Show statistics about skills"
	@echo "  test                   - Test random man pages for validity"
	@echo "  clean                  - Remove all generated man pages"
	@echo "  help                   - Show this help message"
	@echo ""
	@echo "Examples:"
	@echo "  make all                           # Build all man pages"
	@echo "  make preview SKILL=file-organizer  # Preview file-organizer man page"
	@echo "  make install-user                  # Install for current user"
	@echo "  make list                          # List available man pages"

