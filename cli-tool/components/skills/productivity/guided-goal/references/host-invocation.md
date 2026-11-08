# Host invocation and behavior

The canonical `guided-goal` skill owns the interview, contract, confirmation, and portable execution behavior. Host adapters only provide discovery and command ergonomics.

| Host | Install surface | Invoke | Activation |
| --- | --- | --- | --- |
| Hermes Agent | General plugin | `/guided-goal [rough goal]` | Native persisted `GoalManager` through `guided_goal_activate` |
| Codex CLI | `~/.agents/skills/guided-goal` | `$guided-goal [rough goal]` | Portable in-session execution |
| Claude Code | `~/.claude/skills/guided-goal` | `/guided-goal [rough goal]` | Portable in-session execution |
| OpenCode | Agent Skill plus command shim using the `build` agent | `/guided-goal [rough goal]` | Portable in-session execution; stay in Build mode when confirming |
| Pi | Agent Skill plus prompt-template shim | `/guided-goal [rough goal]` or `/skill:guided-goal [rough goal]` | Portable in-session execution |

Host-native permissions and approval prompts still apply after activation. Installation does not modify instruction files, memories, session history, provider settings, or credentials.
