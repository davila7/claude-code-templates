# UX3 Product Design Harness

Review a product direction before committing to design, implementation, launch,
growth or automation. UX3 connects User Flow, Evidence Flow and Business Flow
and returns `continue`, `verify` or `stop_reframe` with the next action, evidence
gaps and execution boundaries.

Use it for a feature proposal, an onboarding change, a product experiment,
a launch decision or a disputed interpretation of customer feedback. It
supports Quick Gate, Standard Gate and UX3 Council review modes. A council
review is optional and depends on the host and the user's authorization.

## Install

After this contribution is merged and published in the AI Templates catalog:

```sh
npx claude-code-templates@1.30.0 --skill productivity/product-design-harness --yes
```

The catalog installer downloads the complete directory into
`.claude/skills/product-design-harness/`. Read `SKILL.md` and keep `resources/`
beside it. The skill contains schemas, product-brief and handoff templates,
knowledge definitions, illustrative examples and three local Python helpers.
It is not a standalone prompt that can operate without those resources.

## First review

Ask the host to use `product-design-harness` to review your product brief.
Include the intended users, current problem, proposed change, observed evidence,
business constraints, responsible owner and a decision to make. A useful first
output identifies the weakest flow, distinguishes observed evidence from
assumptions, and gives a bounded next action.

Python 3 and the `jsonschema` package are needed to run the local validators.
Run helpers through `python3`. This catalog copy omits interpreter headers,
comments and docstrings. References to module help text are replaced with that
same literal text, so a usage error still explains the required arguments.

```sh
python3 .claude/skills/product-design-harness/resources/scripts/check_review.py review.json
python3 .claude/skills/product-design-harness/resources/scripts/check_review.py review.json --context-pack context-pack.json
```

The included examples are illustrative fixtures. They are not customer results,
proof of revenue, retention measurements or an independent security audit.
Validation checks the supplied contract and consistency; the host must enforce
permissions, evidence access, human approvals and execution limits.
The Python helpers read the supplied local JSON files and bundled schemas and
write their results to stdout/stderr. They do not read credentials or environment
variables, make network requests, execute child processes or grant host tools.
This skill declares no automatic tool allowance. Any file or command permission
still comes from the host and the user's existing authorization.

## Source and license

Maintained by [cis2042](https://github.com/cis2042), licensed under MIT. This
directory vendors all 91 files from upstream commit
`48965c6b501f61ebbb8130c9c2e4f9af08922b9f`. Eighty-eight files are byte-identical,
including MIT LICENSE and both handbook diagrams. The three Python helpers
omit comments/docstrings and retain equivalent executable ASTs after replacing
module-help references with the original literal text. This README is the only
catalog-specific extra file. All schemas, examples and required resources are
retained. The refresh includes the upstream Council lane/round checks, exact
handoff-scope checks, consistent examples and installation documentation.

- [Canonical repository](https://github.com/cis2042/ux3-product-design-harness)
- [Exact source](https://github.com/cis2042/ux3-product-design-harness/tree/48965c6b501f61ebbb8130c9c2e4f9af08922b9f/skills/product-design-harness)
- [Product overview](https://cis2042.github.io/ux3-product-design-harness/)
- [Adoption inquiries and feedback](https://www.linkedin.com/in/cis2042/)

For an adoption discussion, describe your team, a real product decision and the
review or handoff problem you want to improve. No hosted service, API key,
subscription or paid inference is required by the local validation helpers.
The host agent's own inference charges depend on the user's provider. Optional
evidence retrieval uses only tools the user separately authorizes; the package
configures no publisher endpoint or automatic tool grant.
