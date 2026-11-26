#!/usr/bin/env bash
# Setup script for Garmin Coach Bot
# Clones repo, creates venv, installs deps, prints config instructions

set -euo pipefail

REPO_URL="https://github.com/imolina29/conexion_garmin.git"
TARGET_DIR="${1:-garmin-coach-bot}"

echo "=== Garmin Coach Bot Setup ==="
echo

# Clone or verify existing directory
if [ -d "$TARGET_DIR" ]; then
    if [ ! -f "$TARGET_DIR/bot.py" ] || [ ! -f "$TARGET_DIR/requirements.txt" ]; then
        echo "ERROR: Directory '$TARGET_DIR' exists but does not contain the Garmin Coach Bot."
        echo "Remove it or choose a different name: $0 <directory>"
        exit 1
    fi
    echo "Directory '$TARGET_DIR' already exists. Updating..."
    cd "$TARGET_DIR"
    if ! git pull --ff-only; then
        echo "WARNING: Could not update repository. Continuing with existing files."
    fi
else
    echo "Cloning repository..."
    git clone "$REPO_URL" "$TARGET_DIR"
    cd "$TARGET_DIR"
fi

# Python version check
PYTHON=""
for cmd in python3.13 python3 python; do
    if command -v "$cmd" &>/dev/null; then
        version=$("$cmd" --version 2>&1 | grep -oE '[0-9]+\.[0-9]+')
        major=$(echo "$version" | cut -d. -f1)
        minor=$(echo "$version" | cut -d. -f2)
        if [ "$major" -ge 3 ] && [ "$minor" -ge 13 ]; then
            PYTHON="$cmd"
            break
        fi
    fi
done

if [ -z "$PYTHON" ]; then
    echo "ERROR: Python 3.13+ is required but not found."
    echo "Install it from https://www.python.org/downloads/"
    exit 1
fi

echo "Using $PYTHON ($($PYTHON --version))"

# Virtual environment
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment..."
    $PYTHON -m venv .venv
fi

echo "Installing dependencies..."
.venv/bin/pip install -q -r requirements.txt

# Generate encryption key and display it
ENCRYPTION_KEY=$(.venv/bin/python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")

echo
echo "Setup complete!"
echo
echo "GENERATED ENCRYPTION KEY (save this — you will need it):"
echo
echo "  $ENCRYPTION_KEY"
echo
echo "NEXT STEPS:"
echo "  1. Copy .env.example to create your environment file"
echo "  2. Create a Telegram bot via @BotFather and paste the token"
echo "  3. Get a Gemini API key from https://aistudio.google.com/apikey"
echo "  4. Fill in your tokens and the encryption key above"
echo "  5. Run: source .venv/bin/activate && python bot.py"
echo
echo "Run tests with: .venv/bin/python -m pytest tests/ -v"
