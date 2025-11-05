# Commands Attribution from Awesome-Claude-Code

## Summary

This repository contains **21 verified commands** sourced from [awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code), a curated list maintained by hesreallyhim.

**Important**: Each command is attributed to its **ORIGINAL AUTHOR** (not to hesreallyhim, who maintains the awesome list). Each author retains their original license.

## Files Generated

### 1. VERIFIED_21_COMMANDS_FROM_AWESOME_CLAUDE_CODE.csv ✅
**The definitive list** - 21 commands with verified licenses and full attribution.

- **Rows**: 23 (2 commands appear in multiple locations)
- **Unique Commands**: 21
- **All have verified licenses** (MIT, Apache-2.0, or AGPL-3.0)

### 2. COMMANDS_FROM_AWESOME_CLAUDE_CODE_HIGH_CONFIDENCE.csv
Complete high-confidence matches including the 3 excluded commands.

- **Rows**: 26
- **Unique Commands**: 24
- **Includes 3 commands with license issues** (excluded from verified list)

### 3. COMMANDS_FROM_AWESOME_CLAUDE_CODE_LOW_CONFIDENCE.csv
Lower-confidence matches for manual review.

- **Rows**: 184
- **Confidence Levels**: low (19), none (165)
- **May include false positives** - recommend manual review

## The 21 Verified Commands

| # | Command | Author | License | Category |
|---|---------|--------|---------|----------|
| 1 | act | sotayamashita | MIT | Automation |
| 2 | add-to-changelog | berrydev-ai | MIT | Documentation |
| 3 | clean | Graphlet-AI | Apache-2.0 | Code Analysis |
| 4 | commit | evmts | MIT | Git Workflow |
| 5 | context-prime | elizaOS | MIT | Context Loading |
| 6 | create-jtbd | taddyorg | AGPL-3.0 | Project Management |
| 7 | create-pr | toyamarinyon | Apache-2.0 | Git Workflow |
| 8 | create-prd | taddyorg | AGPL-3.0 | Project Management |
| 9 | create-prp | Wirasm | MIT | Project Management |
| 10 | create-pull-request | liam-hq | Apache-2.0 | Git Workflow |
| 11 | create-worktrees | evmts | MIT | Git Workflow |
| 12 | fix-github-issue | jeremymailen | Apache-2.0 | Git Workflow |
| 13 | husky | evmts | MIT | Git Workflow |
| 14 | initref | okuvshynov | MIT | Context Loading |
| 15 | load-llms-txt | ethpandaops | MIT | Context Loading |
| 16 | optimize | to4iki | MIT | Code Analysis |
| 17 | pr-review | arkavo-org | MIT | Git Workflow |
| 18 | release | kelp | MIT | CI/Deployment |
| 19 | todo | chrisleyva | MIT | Project Management |
| 20 | update-branch-name | giselles-ai | Apache-2.0 | Git Workflow |
| 21 | update-docs | Consiliency | MIT | Documentation |

## Commands with Duplicates

Two commands appear in multiple directories:

### commit (evmts, MIT)
- `commands/git-workflow/commit.md`
- `commands/orchestration/commit.md`

### release (kelp, MIT)
- `commands/git/release.md`
- `commands/project-management/release.md`

**Note**: These are the same command in different locations, so they count as 1 unique command each.

## Excluded Commands (License Issues)

These 3 commands were found but excluded due to uncertain licenses:

| Command | Author | License Issue | Reason |
|---------|--------|---------------|--------|
| prime | yzyydev | NOT_FOUND | License could not be verified |
| fix-issue | metabase | NOASSERTION | License status unclear |
| testing_plan_integration | buster-so | NOASSERTION | License status unclear |

**Recommendation**: If these commands are needed, verify licenses directly with the original authors before use.

## License Distribution

| License | Count |
|---------|-------|
| MIT | 16 |
| Apache-2.0 | 5 |
| AGPL-3.0 | 2 |

**Total**: 21 commands with verified licenses

## Top Contributing Authors

| Author | Commands | License |
|--------|----------|---------|
| evmts | 4 | MIT |
| taddyorg | 2 | AGPL-3.0 |
| kelp | 2 | MIT |
| Others | 1 each | Various |

## Commands by Category

### Git Workflow (8 commands)
- commit, create-pr, create-pull-request, create-worktrees
- fix-github-issue, husky, pr-review, update-branch-name

### Project Management (4 commands)
- create-jtbd, create-prd, create-prp, todo

### Context Loading (3 commands)
- context-prime, initref, load-llms-txt

### Documentation (2 commands)
- add-to-changelog, update-docs

### Code Analysis (2 commands)
- clean, optimize

### CI/Deployment (1 command)
- release

### Automation (1 command)
- act

## How to Use This Attribution

### For Each Command File

Add this header to the top of each command file:

```markdown
<!--
  Source: awesome-claude-code
  Original Author: [author-name]
  Author GitHub: https://github.com/[author]
  License: [license]
  Original URL: [github-url-to-original]
-->
```

### Example (commit.md):

```markdown
<!--
  Source: awesome-claude-code
  Original Author: evmts
  Author GitHub: https://github.com/evmts
  License: MIT
  Original URL: https://github.com/evmts/tevm-monorepo/blob/main/.claude/commands/commit.md
-->

# Smart Git Commit

[rest of file...]
```

## Data Sources

- **awesome-claude-code**: https://github.com/hesreallyhim/awesome-claude-code
- **THE_RESOURCES_TABLE.csv**: https://raw.githubusercontent.com/hesreallyhim/awesome-claude-code/main/THE_RESOURCES_TABLE.csv

## Analysis Scripts

1. **create_attribution_csv.py** - Initial matching of all commands
2. **split_attribution_csv.py** - Split into high/low confidence
3. **create_verified_21_commands.py** - Extract the verified 21 commands

## Next Steps

1. ✅ **Commands Attribution Complete** - 21 verified commands documented
2. ⏳ **Agents Attribution** - Document 48 agents from wshobson/agents
3. ⏳ **Add Attribution Headers** - Add headers to all command files
4. ⏳ **Update README** - Add detailed attribution section

---

**Last Updated**: November 5, 2025
**Analysis Date**: November 5, 2025
**Verified Count**: 21 commands with clear licenses
