# Third-Party Licenses and Attribution

This document provides comprehensive attribution for all third-party resources included in the claude-code-templates repository.

## Overview

This repository includes contributions from multiple community sources:

- **21 verified commands** from [awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code) (curated list of community contributions)
- **50 verified agents** from [wshobson/agents](https://github.com/wshobson/agents) (by Hobson)

All third-party resources are properly attributed to their original authors and maintain their original licenses.

## Quick Stats

| Category | Count | Source |
|----------|-------|--------|
| Commands | 21 | awesome-claude-code (multiple authors) |
| Agents | 50 | wshobson/agents (Hobson) |
| **Total Resources** | **71** | Multiple community contributors |

### Plugins Using Third-Party Resources

Out of 10 marketplace plugins, **9 plugins** use third-party resources:

- **git-workflow**: 1 command
- **supabase-toolkit**: 2 agents
- **nextjs-vercel-pro**: 1 agent
- **security-pro**: 2 agents
- **ai-ml-toolkit**: 3 agents
- **devops-automation**: 1 agent
- **documentation-generator**: 1 command
- **performance-optimizer**: 1 agent
- **project-management-suite**: 1 agent

## Attribution Structure

This repository maintains attribution at multiple levels:

### 1. Per-Plugin Attribution Files

Each plugin with third-party resources has a dedicated attribution file:

```
.claude-plugin/third-party-licenses/
├── <plugin-name>/
│   └── THIRD_PARTY_NOTICES.md  # Detailed attribution for each resource
└── README.md                    # Overview of plugin attributions
```

**See**: [`.claude-plugin/third-party-licenses/`](./.claude-plugin/third-party-licenses/) for per-plugin details.

### 2. Detailed Analysis CSVs

Comprehensive attribution data with verification details:

- **[VERIFIED_21_COMMANDS_FROM_AWESOME_CLAUDE_CODE.csv](./VERIFIED_21_COMMANDS_FROM_AWESOME_CLAUDE_CODE.csv)** - All commands with authors, licenses, and source URLs
- **[VERIFIED_48_AGENTS_FROM_WSHOBSON.csv](./VERIFIED_48_AGENTS_FROM_WSHOBSON.csv)** - All agents with content similarity verification
- **[COMMANDS_ATTRIBUTION_README.md](./COMMANDS_ATTRIBUTION_README.md)** - Detailed commands attribution documentation
- **[AGENTS_ATTRIBUTION_README.md](./AGENTS_ATTRIBUTION_README.md)** - Detailed agents attribution documentation

### 3. Analysis Scripts

Python scripts used to generate attribution data:

- `create_attribution_csv.py` - Initial cross-reference matching
- `split_attribution_csv.py` - Confidence level separation
- `create_verified_21_commands.py` - License verification
- `identify_wshobson_agents.py` - Agent name matching
- `verify_wshobson_complete.py` - Content similarity verification
- `generate_plugin_attributions.py` - Per-plugin attribution generation

## License Distribution

### Commands from awesome-claude-code

| License | Count | Percentage |
|---------|-------|------------|
| MIT | 16 | 76% |
| Apache-2.0 | 5 | 24% |
| AGPL-3.0 | 2 | 10% |

**Total**: 21 commands with verified licenses

### Agents from wshobson

| License | Count | Percentage |
|---------|-------|------------|
| MIT | 50 | 100% |

**Total**: 50 agents, all MIT licensed

## Top Contributing Authors

### Commands from awesome-claude-code

| Author | Commands | License | GitHub |
|--------|----------|---------|--------|
| evmts | 4 | MIT | https://github.com/evmts |
| taddyorg | 2 | AGPL-3.0 | https://github.com/taddyorg |
| kelp | 2 | MIT | https://github.com/kelp |
| sotayamashita | 1 | MIT | https://github.com/sotayamashita |
| berrydev-ai | 1 | MIT | https://github.com/berrydev-ai |
| Graphlet-AI | 1 | Apache-2.0 | https://github.com/Graphlet-AI |
| to4iki | 1 | MIT | https://github.com/to4iki |
| elizaOS | 1 | MIT | https://github.com/elizaOS |
| okuvshynov | 1 | MIT | https://github.com/okuvshynov |
| ethpandaops | 1 | MIT | https://github.com/ethpandaops |
| Consiliency | 1 | MIT | https://github.com/Consiliency |
| liam-hq | 1 | Apache-2.0 | https://github.com/liam-hq |
| arkavo-org | 1 | MIT | https://github.com/arkavo-org |
| jeremymailen | 1 | Apache-2.0 | https://github.com/jeremymailen |
| toyamarinyon | 1 | Apache-2.0 | https://github.com/toyamarinyon |
| giselles-ai | 1 | Apache-2.0 | https://github.com/giselles-ai |
| Wirasm | 1 | MIT | https://github.com/Wirasm |
| chrisleyva | 1 | MIT | https://github.com/chrisleyva |

### Agents from wshobson

| Author | Agents | License | GitHub |
|--------|--------|---------|--------|
| wshobson | 50 | MIT | https://github.com/wshobson |

**Note**: All 50 agents are created and maintained by Hobson (wshobson).

## Verification Methodology

### Commands Attribution

1. **Source**: Downloaded [THE_RESOURCES_TABLE.csv](https://raw.githubusercontent.com/hesreallyhim/awesome-claude-code/main/THE_RESOURCES_TABLE.csv) from awesome-claude-code
2. **Matching**: Cross-referenced repository commands using exact name matching
3. **Verification**: Filtered for high-confidence matches with verified licenses
4. **Exclusions**: Excluded 3 commands with uncertain licenses (NOT_FOUND, NOASSERTION)

### Agents Attribution

1. **Source**: Used GitHub API to fetch complete repository structure from wshobson/agents
2. **Matching**: Identified 50 exact name matches
3. **Verification**: Compared actual file content for similarity (65-100% match)
4. **Results**: All 50 agents verified with high content similarity

**Content Similarity Distribution**:
- 100% match: 18 agents (perfect copy)
- 80-99% match: 18 agents (minor modifications)
- 70-79% match: 10 agents (adapted versions)
- 65-69% match: 4 agents (significant adaptations)

## Resources Not Included

### Commands with License Issues (Excluded)

These 3 commands were found but excluded due to uncertain licenses:

| Command | Author | Issue | Reason |
|---------|--------|-------|--------|
| prime | yzyydev | NOT_FOUND | License could not be verified |
| fix-issue | metabase | NOASSERTION | License status unclear |
| testing_plan_integration | buster-so | NOASSERTION | License status unclear |

**Recommendation**: If these commands are needed, verify licenses directly with original authors.

## License Compliance

All included third-party resources comply with their respective open-source licenses:

### MIT License (66 resources)

**Permissions**: ✅ Commercial use, ✅ Modification, ✅ Distribution, ✅ Private use
**Conditions**: Require license and copyright notice
**Limitations**: No liability, no warranty

**Resources**:
- 16 commands from awesome-claude-code
- 50 agents from wshobson/agents

### Apache License 2.0 (5 resources)

**Permissions**: ✅ Commercial use, ✅ Modification, ✅ Distribution, ✅ Patent use, ✅ Private use
**Conditions**: License and copyright notice, state changes
**Limitations**: No trademark use, no liability, no warranty

**Resources**:
- 5 commands from awesome-claude-code: clean (Graphlet-AI), create-pull-request (liam-hq), fix-github-issue (jeremymailen), create-pr (toyamarinyon), update-branch-name (giselles-ai)

### GNU AGPL v3.0 (2 resources)

**Permissions**: ✅ Commercial use, ✅ Modification, ✅ Distribution, ✅ Patent use, ✅ Private use
**Conditions**: Disclose source, license and copyright notice, state changes, network use disclosure
**Limitations**: No liability, no warranty

**Resources**:
- 2 commands from awesome-claude-code: create-prd (taddyorg), create-jtbd (taddyorg)

## Full License Texts

### MIT License

```
MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### Apache License 2.0

Full text available at: https://www.apache.org/licenses/LICENSE-2.0

### GNU Affero General Public License v3.0

Full text available at: https://www.gnu.org/licenses/agpl-3.0.html

## Sources and References

### awesome-claude-code

A community-curated list of Claude Code resources from multiple authors.

- **Repository**: https://github.com/hesreallyhim/awesome-claude-code
- **Maintainer**: hesreallyhim (list curator, not original author)
- **Resource Table**: https://raw.githubusercontent.com/hesreallyhim/awesome-claude-code/main/THE_RESOURCES_TABLE.csv
- **Authors**: 18 different community contributors
- **Licenses**: MIT, Apache-2.0, AGPL-3.0

### wshobson/agents

A comprehensive collection of 88 specialized AI agents for Claude Code.

- **Repository**: https://github.com/wshobson/agents
- **Author**: Hobson (wshobson)
- **License**: MIT
- **Agents Used**: 50 out of 88 total agents
- **Verification**: Content similarity verified at 65-100%

## Contact and Questions

For questions about third-party attribution:

1. **Per-Plugin Attribution**: See `.claude-plugin/third-party-licenses/<plugin-name>/THIRD_PARTY_NOTICES.md`
2. **Detailed Analysis**: See CSV files and attribution README files in repository root
3. **Original Authors**: Contact information available in attribution files

For license compliance questions, refer to the original author's repository linked in the attribution files.

---

**Last Updated**: November 5, 2025
**Attribution Analysis Version**: 1.0
**Total Third-Party Resources**: 71 (21 commands + 50 agents)
**Verification Status**: All resources verified with source attribution
