---
allowed-tools: Read, Write, Edit, WebSearch, Grep, Glob
argument-hint: [feature-description] | --research | --template | --validate
description: Create comprehensive Product Requirement Prompt (PRP) with research and validation
model: sonnet
---

# Create Product Requirement Prompt

Create comprehensive Product Requirement Prompt (PRP) following structured research process: **$ARGUMENTS**

## PRP Foundation

- Base template: @concept_library/cc_PRP_flow/PRPs/base_template_v1
- PRP concept: @concept_library/cc_PRP_flow/README.md
- Existing PRPs: !`find concept_library/cc_PRP_flow/PRPs/ -name "*.md" | head -5`
- Documentation: @ai_docs/ directory analysis

## Task

Develop comprehensive PRP through systematic research and structured documentation:

**Research Process**:
1. **Documentation Review** - Analyze existing ai_docs/ and project documentation
2. **Web Research** - Gather implementation examples, library docs, and best practices
3. **Template Analysis** - Study base_template_v1 structure and existing PRPs
4. **Codebase Exploration** - Identify patterns, dependencies, and integration points
5. **Context Synthesis** - Compile comprehensive implementation context

**PRP Development**:
- Follow base_template_v1 structure exactly
- Include specific file references and web resources
- Provide curated codebase intelligence
- Define clear validation criteria and success metrics
- Create production-ready implementation guide

**Remember**: PRP = PRD + curated codebase intelligence + agent/runbook—the minimum viable packet an AI needs to ship production-ready code on the first pass.
