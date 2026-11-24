#!/usr/bin/env bash
# Setup script for Garmin Coach Bot
# Clones repo, creates venv, installs deps, generates encryption key, creates .env

set -euo pipefail

REPO_URL="https://github.com/imolina29/conexion_garmin.git"
TARGET_DIR="${1:-garmin-coach-bot}"

echo "=== Garmin Coach Bot Setup ==="
echo

# Clone
if [ -d "$TARGET_DIR" ]; then
    echo "Directory '$TARGET_DIR' already exists. Using it."
    cd "$TARGET_DIR"
    git pull --ff-only 2>/dev/null || true
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

# Generate encryption key
ENCRYPTION_KEY=$(.venv/bin/python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")

# Create .env if not exists
if [ ! -f ".env" ]; then
    echo "Creating .env file..."
    cat > .env << EOF
TELEGRAM_BOT_TOKEN=
GEMINI_API_KEY=
ENCRYPTION_KEY=$ENCRYPTION_KEY
CALENDAR_BASE_URL=
USER_TIMEZONE=America/Bogota
EOF
    echo
    echo "Generated .env with a fresh ENCRYPTION_KEY."
    echo
    echo "NEXT STEPS:"
    echo "  1. Create a Telegram bot via @BotFather and paste the token"
    echo "  2. Get a Gemini API key from https://aistudio.google.com/apikey"
    echo "  3. Edit .env and fill in TELEGRAM_BOT_TOKEN and GEMINI_API_KEY"
    echo "  4. Run: source .venv/bin/activate && python bot.py"
else
    echo ".env already exists, skipping."
fi

echo
echo "Setup complete. Run tests with: .venv/bin/python -m pytest tests/ -v"
