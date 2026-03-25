---
allowed-tools: Bash(df:*), Bash(du:*), Bash(npm cache clean:*), Bash(brew cleanup:*), Bash(rm:*), Bash(find:*), Bash(docker system prune:*)
argument-hint: [--aggressive] | [--maximum]
description: Clean system caches (npm, Homebrew, Yarn, browsers, Python/ML) to free disk space
---

# System Cache Cleanup

Clean temporary files and caches to free disk space: $ARGUMENTS

## Current Disk Usage

- **Disk space**: !`df -h / | tail -1`
- **npm cache**: !`du -sh ~/.npm 2>/dev/null || echo "Not found"`
- **Yarn cache**: !`du -sh ~/Library/Caches/Yarn 2>/dev/null || echo "Not found"`
- **Homebrew cache**: !`brew cleanup -n 2>/dev/null | head -5 || echo "Homebrew not installed"`

## Cleanup Options

Based on the arguments provided, execute the appropriate cleanup level:

### Option 1: Conservative Cleanup (default)

Safe cleanup of package manager caches that can be easily rebuilt:

```bash
# Record starting disk space
echo "Starting cleanup..."
df -h / | tail -1 | awk '{print "Before: " $4 " free"}'

# Clean npm cache
echo "Cleaning npm cache..."
npm cache clean --force

# Clean Homebrew
echo "Cleaning Homebrew..."
brew cleanup

# Clean Yarn cache
echo "Cleaning Yarn cache..."
rm -rf ~/Library/Caches/Yarn

# Show results
df -h / | tail -1 | awk '{print "After: " $4 " free"}'
```

### Option 2: Aggressive Cleanup (--aggressive flag)

Includes all conservative cleanup plus browser and development tool caches:

```bash
# Run conservative cleanup first (from Option 1)
npm cache clean --force
brew cleanup
rm -rf ~/Library/Caches/Yarn

# Clean browser caches
echo "Cleaning browser caches..."
rm -rf ~/Library/Caches/Google
rm -rf ~/Library/Caches/com.operasoftware.Opera
rm -rf ~/Library/Caches/Firefox
rm -rf ~/Library/Caches/Mozilla
rm -rf ~/Library/Caches/zen
rm -rf ~/Library/Caches/Arc

# Clean development tool caches
echo "Cleaning development caches..."
rm -rf ~/Library/Caches/JetBrains
rm -rf ~/Library/Caches/pnpm
rm -rf ~/.cache/puppeteer
rm -rf ~/.cache/selenium

# Clean Python/ML caches
echo "Cleaning Python/ML caches..."
rm -rf ~/.cache/uv
rm -rf ~/.cache/huggingface
rm -rf ~/.cache/torch
rm -rf ~/.cache/whisper

# Show results
df -h / | tail -1 | awk '{print "After aggressive cleanup: " $4 " free"}'
```

### Option 3: Maximum Cleanup (--maximum flag)

Includes all aggressive cleanup plus Docker and old node_modules:

```bash
# Run aggressive cleanup first (from Option 2)
npm cache clean --force
brew cleanup
rm -rf ~/Library/Caches/Yarn
rm -rf ~/Library/Caches/{Google,com.operasoftware.Opera,Firefox,Mozilla,zen,Arc,JetBrains,pnpm}
rm -rf ~/.cache/{puppeteer,selenium,uv,huggingface,torch,whisper}

# Clean Docker (if installed)
echo "Cleaning Docker..."
docker system prune -af --volumes 2>/dev/null || echo "Docker not running or not installed"

# List node_modules directories for manual review
echo "Finding node_modules directories..."
echo "Note: Not auto-deleting. Review and delete manually if needed."
find ~ -name "node_modules" -type d -prune 2>/dev/null | head -20

# Show results
df -h / | tail -1 | awk '{print "After maximum cleanup: " $4 " free"}'
```

## Execution Steps

1. **Determine Cleanup Level**
   - No arguments or empty: Run Conservative Cleanup (Option 1)
   - `--aggressive`: Run Aggressive Cleanup (Option 2)
   - `--maximum`: Run Maximum Cleanup (Option 3)

2. **Safety Checks**
   - Verify sufficient permissions
   - Ensure critical applications are closed (browsers for Option 2+)
   - Warn about Docker containers being removed (Option 3)

3. **Execute Cleanup**
   - Run appropriate commands based on the selected option
   - Show progress for each cleanup step
   - Handle errors gracefully (missing directories, permissions)

4. **Report Results**
   - Display disk space before and after
   - Show amount of space recovered
   - List what was cleaned
   - Provide recommendations if more space is needed

## Important Notes

**Conservative Cleanup** (default):
- ✅ Always safe to run
- ✅ Caches rebuild automatically when needed
- ✅ No application impact

**Aggressive Cleanup** (--aggressive):
- ⚠️ Close browsers before running
- ⚠️ Browser caches will rebuild on next use
- ⚠️ ML models will re-download if needed

**Maximum Cleanup** (--maximum):
- ⚠️ Stops and removes all Docker containers/images
- ⚠️ Only deletes node_modules after manual review
- ⚠️ Most impactful but recovers the most space

## Recovery

All cleaned caches are temporary and will rebuild automatically:

- **npm/Yarn**: Rebuilds on next `npm install`
- **Homebrew**: Downloaded on next `brew install`
- **Browsers**: Rebuilds on next browsing session
- **Python/ML**: Re-downloads models on next use
- **Docker**: Pull images again with `docker pull`

## Example Usage

```bash
# Conservative cleanup (default)
/cleanup-cache

# Aggressive cleanup
/cleanup-cache --aggressive

# Maximum cleanup
/cleanup-cache --maximum
```

After cleanup, verify the results and inform the user of:
1. Space freed
2. Current free space
3. What was cleaned
4. Whether additional cleanup is recommended
