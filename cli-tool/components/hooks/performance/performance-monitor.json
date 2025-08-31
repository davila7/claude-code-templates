{
  "description": "Monitor system performance during Claude Code operations. Tracks CPU, memory usage, and execution time for performance optimization.",
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "echo \"$(date +%s.%N),$(ps -o %cpu= -p $$),$(ps -o rss= -p $$),$CLAUDE_TOOL_NAME,start\" >> ~/.claude/performance.csv"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "echo \"$(date +%s.%N),$(ps -o %cpu= -p $$),$(ps -o rss= -p $$),$CLAUDE_TOOL_NAME,end\" >> ~/.claude/performance.csv; if [[ $(wc -l < ~/.claude/performance.csv) -gt 1000 ]]; then tail -n 500 ~/.claude/performance.csv > ~/.claude/performance.csv.tmp && mv ~/.claude/performance.csv.tmp ~/.claude/performance.csv; fi"
          }
        ]
      }
    ]
  }
}