# Complete Guide to Creating Claude Code Status Lines

This guide teaches you how to create custom status lines for Claude Code that display contextual information at the bottom of your interface, similar to terminal prompts in shells like Oh-my-zsh.

## What are Claude Code Status Lines?

Status lines are customizable information displays that appear at the bottom of the Claude Code interface. Each status line:

- **Shows contextual information** about your current session, model, directory, and project
- **Updates automatically** when conversation messages change (max every 300ms)
- **Supports ANSI colors** and emojis for rich visual formatting
- **Receives session data** as JSON input for dynamic content generation
- **Runs custom scripts** that you create and configure

## Key Benefits

### 📊 Real-time Session Information
Display current model, directories, git status, and project metrics at a glance.

### 🎨 Visual Customization
Use colors, emojis, and formatting to create informative and visually appealing status displays.

### 🔄 Dynamic Updates
Status line refreshes automatically as your session progresses and context changes.

### 🛠️ Full Programmability
Write custom scripts in any language to display exactly the information you need.

### ⚡ Contextual Awareness
Access rich session data including costs, duration, model info, and workspace details.

## Status Line Configuration

### Configuration Methods

You can set up a status line in two ways:

#### 1. Interactive Setup
Use the built-in command for guided setup:
```bash
/statusline
```

This will help you create a status line, often reproducing your terminal prompt by default.

**With custom instructions**:
```bash
/statusline show the model name in orange and git branch in green
/statusline include current time and session cost
/statusline make it minimal with just directory and model
```

#### 2. Manual Configuration
Add directly to your settings file:

**File**: `.claude/settings.json`
```json
{
  "statusLine": {
    "type": "command",
    "command": "~/.claude/statusline.sh",
    "padding": 0
  }
}
```

**Configuration Options**:
- `type`: Always `"command"` (only supported type currently)
- `command`: Path to your status line script (absolute or relative to home directory)
- `padding`: Optional spacing from edges (default has padding, set to `0` for edge-to-edge)

### Settings File Locations

| Type | Location | Scope | Usage |
|------|----------|-------|--------|
| **User Settings** | `~/.claude/settings.json` | All projects | Personal status line across all projects |
| **Project Settings** | `.claude/settings.json` | Current project | Team-shared status line (committed) |
| **Local Project Settings** | `.claude/settings.local.json` | Current project | Personal project status line (not committed) |

## Session Data Input

### JSON Input Structure

Your status line script receives comprehensive session data via stdin:

```json
{
  "hook_event_name": "Status",
  "session_id": "abc123-def456-789",
  "transcript_path": "/Users/you/.claude/projects/my-project/transcript.jsonl",
  "cwd": "/Users/you/projects/my-project",
  "model": {
    "id": "claude-3-5-sonnet-20241022",
    "display_name": "Sonnet"
  },
  "workspace": {
    "current_dir": "/Users/you/projects/my-project/src",
    "project_dir": "/Users/you/projects/my-project"
  },
  "version": "1.0.80",
  "output_style": {
    "name": "default"
  },
  "cost": {
    "total_cost_usd": 0.01234,
    "total_duration_ms": 45000,
    "total_api_duration_ms": 2300,
    "total_lines_added": 156,
    "total_lines_removed": 23
  }
}
```

### Available Data Fields

#### Model Information
- `model.id`: Full model identifier
- `model.display_name`: Human-readable model name (Sonnet, Haiku, Opus)

#### Workspace Information
- `workspace.current_dir`: Current working directory
- `workspace.project_dir`: Original project root directory
- `cwd`: Current working directory (same as workspace.current_dir)

#### Session Metrics
- `cost.total_cost_usd`: Total API cost in USD
- `cost.total_duration_ms`: Total session duration
- `cost.total_api_duration_ms`: Total API request time
- `cost.total_lines_added`: Lines of code added
- `cost.total_lines_removed`: Lines of code removed

#### Session Identity
- `session_id`: Unique session identifier
- `transcript_path`: Path to conversation transcript
- `version`: Claude Code version
- `output_style.name`: Current output style

## Complete Status Line Examples

### 1. Essential Information Display

**statusline.sh**:
```bash
#!/bin/bash
# Essential status line with model, directory, and git info

# Read JSON input from stdin
input=$(cat)

# Extract core information using jq
MODEL_DISPLAY=$(echo "$input" | jq -r '.model.display_name')
CURRENT_DIR=$(echo "$input" | jq -r '.workspace.current_dir')
PROJECT_DIR=$(echo "$input" | jq -r '.workspace.project_dir')

# Get directory name (relative to project if possible)
if [[ "$CURRENT_DIR" == "$PROJECT_DIR"* ]]; then
    REL_DIR="${CURRENT_DIR#$PROJECT_DIR}"
    REL_DIR="${REL_DIR#/}"
    DISPLAY_DIR="${REL_DIR:-$(basename "$PROJECT_DIR")}"
else
    DISPLAY_DIR=$(basename "$CURRENT_DIR")
fi

# Git branch information
GIT_INFO=""
if git rev-parse --git-dir > /dev/null 2>&1; then
    BRANCH=$(git branch --show-current 2>/dev/null)
    if [ -n "$BRANCH" ]; then
        # Check for uncommitted changes
        if ! git diff-index --quiet HEAD -- 2>/dev/null; then
            GIT_STATUS="±"
        else
            GIT_STATUS="✓"
        fi
        GIT_INFO=" \033[32m🌿 $BRANCH$GIT_STATUS\033[0m"
    fi
fi

# Output with colors
echo -e "\033[94m[$MODEL_DISPLAY]\033[0m \033[93m📁 $DISPLAY_DIR\033[0m$GIT_INFO"
```

### 2. Comprehensive Development Status

**dev-statusline.py**:
```python
#!/usr/bin/env python3
import json
import sys
import os
import subprocess
from datetime import datetime, timedelta

def get_git_info():
    """Get comprehensive git information"""
    if not os.path.exists('.git'):
        return ""
    
    try:
        # Current branch
        branch = subprocess.check_output(['git', 'branch', '--show-current'], 
                                       stderr=subprocess.DEVNULL).decode().strip()
        if not branch:
            return ""
        
        # Check for changes
        status_cmd = ['git', 'status', '--porcelain']
        status_output = subprocess.check_output(status_cmd, stderr=subprocess.DEVNULL).decode().strip()
        
        if status_output:
            # Count changes
            lines = status_output.split('\n')
            modified = sum(1 for line in lines if line.startswith(' M'))
            added = sum(1 for line in lines if line.startswith('A'))
            deleted = sum(1 for line in lines if line.startswith(' D'))
            untracked = sum(1 for line in lines if line.startswith('??'))
            
            changes = []
            if modified: changes.append(f"~{modified}")
            if added: changes.append(f"+{added}")
            if deleted: changes.append(f"-{deleted}")
            if untracked: changes.append(f"?{untracked}")
            
            status_indicator = f"({','.join(changes)})" if changes else "±"
        else:
            status_indicator = "✓"
        
        return f" \033[32m🌿 {branch}{status_indicator}\033[0m"
    
    except subprocess.CalledProcessError:
        return ""

def format_duration(ms):
    """Format duration in human readable format"""
    seconds = ms / 1000
    if seconds < 60:
        return f"{seconds:.0f}s"
    elif seconds < 3600:
        minutes = seconds / 60
        return f"{minutes:.1f}m"
    else:
        hours = seconds / 3600
        return f"{hours:.1f}h"

def format_cost(cost_usd):
    """Format cost in readable format"""
    if cost_usd < 0.01:
        return f"{cost_usd*100:.1f}¢"
    else:
        return f"${cost_usd:.3f}"

def get_node_version():
    """Get Node.js version if available"""
    try:
        if os.path.exists('package.json'):
            version = subprocess.check_output(['node', '--version'], 
                                            stderr=subprocess.DEVNULL).decode().strip()
            return f" \033[32m⬢ {version}\033[0m"
    except (subprocess.CalledProcessError, FileNotFoundError):
        pass
    return ""

def get_python_version():
    """Get Python version if available"""
    try:
        if os.path.exists('requirements.txt') or os.path.exists('pyproject.toml'):
            version = subprocess.check_output(['python', '--version'], 
                                            stderr=subprocess.DEVNULL).decode().strip()
            version = version.replace('Python ', '')
            return f" \033[33m🐍 {version}\033[0m"
    except (subprocess.CalledProcessError, FileNotFoundError):
        pass
    return ""

def main():
    # Read JSON from stdin
    data = json.load(sys.stdin)
    
    # Extract basic information
    model = data['model']['display_name']
    current_dir = data['workspace']['current_dir']
    project_dir = data['workspace']['project_dir']
    
    # Calculate relative directory
    if current_dir.startswith(project_dir):
        rel_dir = current_dir[len(project_dir):].lstrip('/')
        display_dir = rel_dir if rel_dir else os.path.basename(project_dir)
    else:
        display_dir = os.path.basename(current_dir)
    
    # Session metrics
    cost = data['cost']
    duration_str = format_duration(cost['total_duration_ms'])
    cost_str = format_cost(cost['total_cost_usd'])
    
    # Lines changed
    lines_info = ""
    if cost['total_lines_added'] > 0 or cost['total_lines_removed'] > 0:
        lines_info = f" \033[36m📝 +{cost['total_lines_added']}/-{cost['total_lines_removed']}\033[0m"
    
    # Build status line
    status_parts = [
        f"\033[94m[{model}]\033[0m",
        f"\033[93m📁 {display_dir}\033[0m",
        get_git_info(),
        get_node_version(),
        get_python_version(),
        lines_info,
        f"\033[90m⏱ {duration_str} • {cost_str}\033[0m"
    ]
    
    # Filter empty parts and join
    status_line = "".join(part for part in status_parts if part.strip())
    print(status_line)

if __name__ == "__main__":
    main()
```

### 3. Minimal Clean Status

**minimal-statusline.sh**:
```bash
#!/bin/bash
# Minimal, clean status line

input=$(cat)

# Extract essentials
MODEL=$(echo "$input" | jq -r '.model.display_name')
DIR=$(echo "$input" | jq -r '.workspace.current_dir')
DIR_NAME=$(basename "$DIR")

# Simple git branch
BRANCH=""
if git rev-parse --git-dir > /dev/null 2>&1; then
    BRANCH_NAME=$(git branch --show-current 2>/dev/null)
    if [ -n "$BRANCH_NAME" ]; then
        BRANCH=" • $BRANCH_NAME"
    fi
fi

echo "$MODEL • $DIR_NAME$BRANCH"
```

### 4. Performance-Focused Status

**performance-statusline.js**:
```javascript
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Read JSON from stdin
let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
    try {
        const data = JSON.parse(input);
        
        // Extract information
        const model = data.model.display_name;
        const currentDir = data.workspace.current_dir;
        const projectDir = data.workspace.project_dir;
        const cost = data.cost;
        
        // Calculate directory display
        const displayDir = currentDir.startsWith(projectDir)
            ? currentDir.slice(projectDir.length + 1) || path.basename(projectDir)
            : path.basename(currentDir);
        
        // Performance metrics
        const avgResponseTime = cost.total_api_duration_ms / Math.max(1, cost.total_duration_ms / 10000);
        const efficiency = cost.total_lines_added / Math.max(0.01, cost.total_cost_usd * 100);
        
        // Git status (cached for performance)
        let gitInfo = '';
        try {
            if (fs.existsSync('.git/HEAD')) {
                const headContent = fs.readFileSync('.git/HEAD', 'utf8').trim();
                if (headContent.startsWith('ref: refs/heads/')) {
                    const branch = headContent.replace('ref: refs/heads/', '');
                    gitInfo = ` \x1b[32m⭐ ${branch}\x1b[0m`;
                }
            }
        } catch (e) {
            // Ignore git errors
        }
        
        // Build status with performance focus
        const parts = [
            `\x1b[94m[${model}]\x1b[0m`,
            `\x1b[93m📁 ${displayDir}\x1b[0m`,
            gitInfo,
            `\x1b[36m⚡ ${efficiency.toFixed(0)} lines/¢\x1b[0m`,
            `\x1b[90m${avgResponseTime.toFixed(0)}ms avg\x1b[0m`
        ];
        
        console.log(parts.filter(p => p.trim()).join(' '));
        
    } catch (error) {
        console.log(`[Status Error] ${error.message}`);
    }
});
```

### 5. Project-Aware Status Line

**project-statusline.py**:
```python
#!/usr/bin/env python3
import json
import sys
import os
import subprocess
from pathlib import Path

def detect_project_type():
    """Detect project type and return appropriate icon and info"""
    if os.path.exists('package.json'):
        with open('package.json', 'r') as f:
            try:
                package = json.load(f)
                framework = ""
                if 'react' in str(package.get('dependencies', {})):
                    framework = "⚛️"
                elif 'vue' in str(package.get('dependencies', {})):
                    framework = "💚"
                elif 'angular' in str(package.get('dependencies', {})):
                    framework = "🅰️"
                elif 'express' in str(package.get('dependencies', {})):
                    framework = "🚂"
                else:
                    framework = "📦"
                
                name = package.get('name', 'unknown')
                version = package.get('version', '0.0.0')
                return f"{framework} {name}@{version}"
            except:
                return "📦 Node.js"
    
    elif os.path.exists('Cargo.toml'):
        try:
            with open('Cargo.toml', 'r') as f:
                content = f.read()
                # Simple parsing for name and version
                name = "rust-project"
                version = "0.1.0"
                for line in content.split('\n'):
                    if line.strip().startswith('name ='):
                        name = line.split('=')[1].strip().strip('"')
                    elif line.strip().startswith('version ='):
                        version = line.split('=')[1].strip().strip('"')
                return f"🦀 {name}@{version}"
        except:
            return "🦀 Rust"
    
    elif os.path.exists('go.mod'):
        try:
            with open('go.mod', 'r') as f:
                first_line = f.readline().strip()
                if first_line.startswith('module '):
                    module_name = first_line.split(' ')[1].split('/')[-1]
                    return f"🐹 {module_name}"
        except:
            return "🐹 Go"
    
    elif os.path.exists('pyproject.toml') or os.path.exists('requirements.txt'):
        if os.path.exists('pyproject.toml'):
            try:
                import toml
                with open('pyproject.toml', 'r') as f:
                    data = toml.load(f)
                    name = data.get('project', {}).get('name', 'python-project')
                    version = data.get('project', {}).get('version', '0.1.0')
                    return f"🐍 {name}@{version}"
            except:
                return "🐍 Python"
        else:
            return "🐍 Python"
    
    elif os.path.exists('pom.xml'):
        return "☕ Java/Maven"
    
    elif os.path.exists('build.gradle') or os.path.exists('build.gradle.kts'):
        return "☕ Java/Gradle"
    
    elif os.path.exists('Gemfile'):
        return "💎 Ruby"
    
    elif os.path.exists('composer.json'):
        return "🐘 PHP"
    
    return "📁 Generic"

def get_testing_status():
    """Check testing status"""
    test_files = []
    for pattern in ['*test*', '*spec*', 'tests/', '__tests__/', 'test/']:
        test_files.extend(Path('.').glob(pattern))
    
    if test_files:
        return " \033[32m🧪\033[0m"
    return ""

def get_docker_status():
    """Check if Docker is configured"""
    if os.path.exists('Dockerfile') or os.path.exists('docker-compose.yml'):
        return " \033[36m🐳\033[0m"
    return ""

def get_ci_status():
    """Check CI configuration"""
    ci_files = ['.github/workflows/', '.gitlab-ci.yml', '.travis.yml', 'Jenkinsfile']
    for ci_file in ci_files:
        if os.path.exists(ci_file):
            return " \033[35m🔄\033[0m"
    return ""

def main():
    data = json.load(sys.stdin)
    
    # Basic info
    model = data['model']['display_name']
    current_dir = data['workspace']['current_dir']
    project_dir = data['workspace']['project_dir']
    
    # Directory display
    if current_dir.startswith(project_dir):
        rel_dir = current_dir[len(project_dir):].lstrip('/')
        display_dir = rel_dir if rel_dir else os.path.basename(project_dir)
    else:
        display_dir = os.path.basename(current_dir)
    
    # Project detection
    project_info = detect_project_type()
    
    # Git info
    git_info = ""
    if os.path.exists('.git'):
        try:
            branch = subprocess.check_output(['git', 'branch', '--show-current'], 
                                           stderr=subprocess.DEVNULL).decode().strip()
            if branch:
                git_info = f" \033[32m🌿 {branch}\033[0m"
        except:
            pass
    
    # Additional status indicators
    test_status = get_testing_status()
    docker_status = get_docker_status()
    ci_status = get_ci_status()
    
    # Session cost
    cost_str = f"${data['cost']['total_cost_usd']:.3f}" if data['cost']['total_cost_usd'] >= 0.001 else f"{data['cost']['total_cost_usd']*100:.1f}¢"
    
    # Build final status
    status = f"\033[94m[{model}]\033[0m \033[93m{project_info}\033[0m{git_info}{test_status}{docker_status}{ci_status} \033[90m{cost_str}\033[0m"
    print(status)

if __name__ == "__main__":
    main()
```

### 6. Time and Productivity Status

**productivity-statusline.sh**:
```bash
#!/bin/bash
# Productivity-focused status line with time tracking

input=$(cat)

# Basic info
MODEL=$(echo "$input" | jq -r '.model.display_name')
DIR=$(echo "$input" | jq -r '.workspace.current_dir' | xargs basename)

# Session metrics
DURATION_MS=$(echo "$input" | jq -r '.cost.total_duration_ms')
LINES_ADDED=$(echo "$input" | jq -r '.cost.total_lines_added')
LINES_REMOVED=$(echo "$input" | jq -r '.cost.total_lines_removed')
COST=$(echo "$input" | jq -r '.cost.total_cost_usd')

# Format duration
if [ "$DURATION_MS" -gt 0 ]; then
    DURATION_SEC=$((DURATION_MS / 1000))
    if [ $DURATION_SEC -lt 60 ]; then
        DURATION="${DURATION_SEC}s"
    elif [ $DURATION_SEC -lt 3600 ]; then
        DURATION="$((DURATION_SEC / 60))m"
    else
        DURATION="$((DURATION_SEC / 3600))h$((($DURATION_SEC % 3600) / 60))m"
    fi
else
    DURATION="0s"
fi

# Productivity metrics
NET_LINES=$((LINES_ADDED - LINES_REMOVED))
if [ $NET_LINES -gt 0 ]; then
    PRODUCTIVITY_COLOR="\033[32m"
    PRODUCTIVITY_SYMBOL="+"
elif [ $NET_LINES -lt 0 ]; then
    PRODUCTIVITY_COLOR="\033[31m"
    PRODUCTIVITY_SYMBOL=""
else
    PRODUCTIVITY_COLOR="\033[33m"
    PRODUCTIVITY_SYMBOL=""
fi

# Cost formatting
if (( $(echo "$COST < 0.01" | bc -l) )); then
    COST_DISPLAY=$(echo "$COST * 100" | bc -l | cut -d. -f1)¢
else
    COST_DISPLAY=\$$(printf "%.3f" "$COST")
fi

# Current time
CURRENT_TIME=$(date "+%H:%M")

# Build status line
echo -e "[$MODEL] 📁 $DIR | ⏰ $CURRENT_TIME | ⏱ $DURATION | ${PRODUCTIVITY_COLOR}📝 ${PRODUCTIVITY_SYMBOL}${NET_LINES}\033[0m | 💰 $COST_DISPLAY"
```

## Advanced Status Line Techniques

### 1. Caching for Performance

```bash
#!/bin/bash
# Status line with caching for expensive operations

CACHE_DIR="$HOME/.claude/statusline_cache"
mkdir -p "$CACHE_DIR"

# Cache expensive git operations
get_git_info_cached() {
    local cache_file="$CACHE_DIR/git_info_$(pwd | sed 's/\//_/g')"
    local cache_timeout=5  # seconds
    
    if [[ -f "$cache_file" && $(($(date +%s) - $(stat -f %m "$cache_file" 2>/dev/null || echo 0))) -lt $cache_timeout ]]; then
        cat "$cache_file"
    else
        local git_info=""
        if git rev-parse --git-dir > /dev/null 2>&1; then
            local branch=$(git branch --show-current 2>/dev/null)
            local status="✓"
            if ! git diff-index --quiet HEAD -- 2>/dev/null; then
                status="±"
            fi
            git_info=" 🌿 $branch$status"
        fi
        echo "$git_info" > "$cache_file"
        echo "$git_info"
    fi
}

# Use cached functions in your status line
input=$(cat)
MODEL=$(echo "$input" | jq -r '.model.display_name')
DIR=$(echo "$input" | jq -r '.workspace.current_dir' | xargs basename)
GIT_INFO=$(get_git_info_cached)

echo "[$MODEL] 📁 $DIR$GIT_INFO"
```

### 2. Dynamic Color Schemes

```python
#!/usr/bin/env python3
# Status line with dynamic colors based on context

import json
import sys
import os

# Color schemes
COLORS = {
    'production': {
        'model': '\033[91m',  # Red for production
        'directory': '\033[93m',
        'git': '\033[92m',
        'reset': '\033[0m'
    },
    'staging': {
        'model': '\033[93m',  # Yellow for staging
        'directory': '\033[94m', 
        'git': '\033[92m',
        'reset': '\033[0m'
    },
    'development': {
        'model': '\033[94m',  # Blue for development
        'directory': '\033[95m',
        'git': '\033[92m',
        'reset': '\033[0m'
    }
}

def detect_environment():
    """Detect environment based on various indicators"""
    # Check environment variables
    env = os.environ.get('NODE_ENV', '').lower()
    if env in ['production', 'prod']:
        return 'production'
    elif env in ['staging', 'stage']:
        return 'staging'
    
    # Check for environment files
    if os.path.exists('.env.production'):
        return 'production'
    elif os.path.exists('.env.staging'):
        return 'staging'
    
    # Check git branch
    try:
        import subprocess
        branch = subprocess.check_output(['git', 'branch', '--show-current'], 
                                       stderr=subprocess.DEVNULL).decode().strip()
        if branch in ['main', 'master', 'production']:
            return 'production'
        elif branch in ['staging', 'stage']:
            return 'staging'
    except:
        pass
    
    return 'development'

def main():
    data = json.load(sys.stdin)
    
    # Detect environment and get colors
    env = detect_environment()
    colors = COLORS[env]
    
    # Extract data
    model = data['model']['display_name']
    current_dir = os.path.basename(data['workspace']['current_dir'])
    
    # Environment indicator
    env_indicator = {
        'production': '🔴 PROD',
        'staging': '🟡 STAGE', 
        'development': '🟢 DEV'
    }[env]
    
    # Build colored status line
    status = (f"{colors['model']}[{model}]{colors['reset']} "
             f"{colors['directory']}📁 {current_dir}{colors['reset']} "
             f"{env_indicator}")
    
    print(status)

if __name__ == "__main__":
    main()
```

### 3. Multi-line Status Support

```bash
#!/bin/bash
# Multi-line status line (only first line is used, but you can prepare data)

input=$(cat)

# Collect comprehensive information
MODEL=$(echo "$input" | jq -r '.model.display_name')
DIR=$(echo "$input" | jq -r '.workspace.current_dir' | xargs basename)
COST=$(echo "$input" | jq -r '.cost.total_cost_usd')
DURATION_MS=$(echo "$input" | jq -r '.cost.total_duration_ms')
LINES_NET=$(($(echo "$input" | jq -r '.cost.total_lines_added') - $(echo "$input" | jq -r '.cost.total_lines_removed')))

# Build a comprehensive but single-line status
# (Note: Only the first line of output is used by Claude Code)
STATUS_PARTS=()
STATUS_PARTS+=("[$MODEL]")
STATUS_PARTS+=("📁 $DIR")

# Add git info if available
if git rev-parse --git-dir > /dev/null 2>&1; then
    BRANCH=$(git branch --show-current 2>/dev/null)
    if [ -n "$BRANCH" ]; then
        STATUS_PARTS+=("🌿 $BRANCH")
    fi
fi

# Add metrics if significant
if [ $LINES_NET -ne 0 ]; then
    STATUS_PARTS+=("📝 $LINES_NET lines")
fi

# Join with separators
IFS=' • '
echo "${STATUS_PARTS[*]}"

# You could output additional lines for your own debugging/logging
# (These won't be displayed in the status line)
echo "Debug: Session duration $(($DURATION_MS / 1000))s, Cost $COST" >&2
```

### 4. Conditional Information Display

```python
#!/usr/bin/env python3
# Smart status line that shows different info based on context

import json
import sys
import os
import subprocess
from datetime import datetime

def get_priority_info(data):
    """Determine what information is most important to show"""
    current_dir = data['workspace']['current_dir']
    cost = data['cost']
    
    priorities = []
    
    # High priority: Expensive session
    if cost['total_cost_usd'] > 0.05:  # More than 5 cents
        priorities.append(('cost', f"💰 ${cost['total_cost_usd']:.3f}", 1))
    
    # High priority: Long session
    if cost['total_duration_ms'] > 300000:  # More than 5 minutes
        duration_min = cost['total_duration_ms'] / 60000
        priorities.append(('duration', f"⏱ {duration_min:.1f}m", 1))
    
    # Medium priority: Significant changes
    if cost['total_lines_added'] + cost['total_lines_removed'] > 50:
        net_lines = cost['total_lines_added'] - cost['total_lines_removed']
        sign = '+' if net_lines >= 0 else ''
        priorities.append(('changes', f"📝 {sign}{net_lines}", 2))
    
    # Medium priority: Git status with changes
    try:
        if os.path.exists('.git'):
            status_output = subprocess.check_output(['git', 'status', '--porcelain'], 
                                                  stderr=subprocess.DEVNULL).decode().strip()
            if status_output:
                change_count = len(status_output.split('\n'))
                priorities.append(('git_changes', f"⚠️ {change_count} changed", 2))
    except:
        pass
    
    # Low priority: Time
    current_time = datetime.now().strftime("%H:%M")
    priorities.append(('time', f"🕐 {current_time}", 3))
    
    return priorities

def main():
    data = json.load(sys.stdin)
    
    # Basic info (always shown)
    model = data['model']['display_name']
    current_dir = os.path.basename(data['workspace']['current_dir'])
    
    # Get prioritized additional info
    priorities = get_priority_info(data)
    
    # Sort by priority and take top items
    priorities.sort(key=lambda x: x[2])  # Sort by priority level
    
    # Build status line with space management
    max_length = 80  # Estimate terminal width
    base_status = f"[{model}] 📁 {current_dir}"
    remaining_space = max_length - len(base_status)
    
    additional_info = []
    for info_type, info_text, priority in priorities:
        if len(' • '.join(additional_info + [info_text])) < remaining_space - 3:
            additional_info.append(info_text)
        else:
            break  # Stop adding info if we're running out of space
    
    # Combine everything
    if additional_info:
        full_status = f"{base_status} • {' • '.join(additional_info)}"
    else:
        full_status = base_status
    
    print(full_status)

if __name__ == "__main__":
    main()
```

## Best Practices

### 1. Performance Optimization
- **Keep scripts fast**: Status lines update frequently, so optimize for speed
- **Cache expensive operations**: Use caching for git status, file system checks
- **Limit external command calls**: Minimize subprocess execution
- **Use efficient parsing**: Prefer lightweight JSON parsing methods

### 2. Visual Design
- **Be concise**: Status lines should fit on one line
- **Use meaningful colors**: Color-code different types of information
- **Choose clear icons**: Use universally understood emojis and symbols
- **Maintain consistency**: Stick to a consistent visual style

### 3. Error Handling
```bash
#!/bin/bash
# Robust error handling example

input=$(cat)

# Always provide fallback values
MODEL=$(echo "$input" | jq -r '.model.display_name' 2>/dev/null || echo "Claude")
DIR=$(echo "$input" | jq -r '.workspace.current_dir' 2>/dev/null || pwd)
DIR_NAME=$(basename "$DIR" 2>/dev/null || echo "Unknown")

# Safe git operations
GIT_INFO=""
if command -v git >/dev/null 2>&1 && git rev-parse --git-dir >/dev/null 2>&1; then
    BRANCH=$(git branch --show-current 2>/dev/null || echo "")
    if [ -n "$BRANCH" ]; then
        GIT_INFO=" | $BRANCH"
    fi
fi

# Always output something, even if minimal
echo "[$MODEL] $DIR_NAME$GIT_INFO"
```

### 4. Testing and Development

**Test your status line script**:
```bash
# Create test JSON input
echo '{
  "model": {"display_name": "Sonnet"},
  "workspace": {"current_dir": "/test/project"},
  "cost": {"total_cost_usd": 0.01, "total_duration_ms": 30000}
}' | ./your-statusline.sh
```

**Debug with logging**:
```python
#!/usr/bin/env python3
import json
import sys
import logging

# Set up logging for debugging
logging.basicConfig(
    filename='/tmp/statusline-debug.log',
    level=logging.DEBUG,
    format='%(asctime)s - %(message)s'
)

try:
    data = json.load(sys.stdin)
    logging.debug(f"Received data: {data}")
    
    # Your status line logic
    result = "Status line output"
    logging.debug(f"Generated: {result}")
    print(result)
    
except Exception as e:
    logging.error(f"Error: {e}")
    print("[Status Error]")  # Fallback display
```

### 5. Cross-Platform Compatibility

```bash
#!/bin/bash
# Cross-platform compatible status line

# Detect OS for different commands
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    STAT_CMD="stat -f %m"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    STAT_CMD="stat -c %Y"
else
    # Fallback
    STAT_CMD="date +%s"
fi

# Use OS-appropriate commands
# Your status line logic here
```

## Configuration Examples

### Personal Development Setup

**.claude/settings.json** (Project):
```json
{
  "statusLine": {
    "type": "command",
    "command": "~/.claude/scripts/dev-statusline.py",
    "padding": 0
  }
}
```

### Team-Shared Configuration

**.claude/settings.json** (Committed):
```json
{
  "statusLine": {
    "type": "command",
    "command": "./.claude/statusline/team-status.sh",
    "padding": 1
  }
}
```

### Environment-Specific Status

**.claude/settings.local.json** (Not committed):
```json
{
  "statusLine": {
    "type": "command", 
    "command": "$HOME/.claude/statuslines/production-status.py",
    "padding": 0
  }
}
```

## Troubleshooting

### Common Issues

1. **Status line doesn't appear**
   - Check script is executable: `chmod +x your-script`
   - Verify path in settings.json is correct
   - Test script manually with mock JSON input

2. **Colors not displaying**
   - Ensure terminal supports ANSI colors
   - Check color codes are properly formatted
   - Test with simple color: `echo -e "\033[31mRed text\033[0m"`

3. **Script errors**
   - Add error logging to your script
   - Test with minimal functionality first
   - Check dependencies (jq, git, etc.) are installed

4. **Performance issues**
   - Profile your script execution time
   - Add caching for expensive operations
   - Minimize external command calls

### Debug Tools

**Test JSON Input**:
```json
{
  "hook_event_name": "Status",
  "session_id": "test-123",
  "model": {"display_name": "Sonnet"},
  "workspace": {
    "current_dir": "/Users/you/project",
    "project_dir": "/Users/you/project"
  },
  "cost": {
    "total_cost_usd": 0.05,
    "total_duration_ms": 120000,
    "total_lines_added": 25,
    "total_lines_removed": 8
  }
}
```

**Test Command**:
```bash
echo 'test-json-here' | ~/.claude/statusline.sh
```

**Performance Testing**:
```bash
time echo 'test-json' | ~/.claude/statusline.sh
```

## Status Line Gallery

### Inspiration Examples

```bash
# Minimal
[Sonnet] 📁 my-project

# Git-aware  
[Sonnet] 📁 src • 🌿 feature-branch

# Development-focused
[Sonnet] ⚛️ React App • 🌿 main✓ • 🧪 • $0.02

# Performance-oriented
[Sonnet] 📁 api • ⚡ 250ms avg • 💰 $0.01

# Time-tracking
[Sonnet] 📦 Node.js • ⏰ 14:30 • ⏱ 25m • 📝 +42 lines

# Project-aware
[Sonnet] 🐍 data-pipeline@1.2.0 • 🌿 develop • 🐳 • 🔄
```

## Conclusion

Claude Code status lines provide a powerful way to customize your development interface with contextual information that matters to you. With status lines, you can:

- **Monitor session metrics** like cost, duration, and productivity
- **Display project context** including git status, environment, and dependencies  
- **Track development progress** with real-time updates
- **Customize the interface** to match your workflow and preferences
- **Enhance situational awareness** during coding sessions

Start with simple status lines and gradually add more sophisticated features as you become comfortable with the system. The key is finding the right balance of information density and visual clarity for your workflow.

For more advanced customization and community examples, explore the Claude Code documentation and share your status line configurations with other developers.