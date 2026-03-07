---
allowed-tools: Bash, Read, Write, Edit
argument-hint: [task-parameters]
description: Read data from a Google Sheet and create a formatted Google Docs report.
---

# Generate Report From Sheet

Execute Google Workspace workflow: $ARGUMENTS

# Generate a Google Docs Report from Sheet Data

> **PREREQUISITE:** Load the following skills to execute this recipe: `gws-sheets`, `gws-docs`, `gws-drive`

Read data from a Google Sheet and create a formatted Google Docs report.

## Steps

1. Read the data: `gws sheets +read --spreadsheet-id SHEET_ID --range 'Sales!A1:D'`
2. Create the report doc: `gws docs documents create --json '{"title": "Sales Report - January 2025"}'`
3. Write the report: `gws docs +write --document-id DOC_ID --text '## Sales Report - January 2025

### Summary
Total deals: 45
Revenue: $125,000

### Top Deals
1. Acme Corp - $25,000
2. Widget Inc - $18,000'`
4. Share with stakeholders: `gws drive permissions create --params '{"fileId": "DOC_ID"}' --json '{"role": "reader", "type": "user", "emailAddress": "cfo@company.com"}'`

## Task

Execute this workflow with the following parameters: $ARGUMENTS

1. **Prerequisites Check**
   - Verify `gws` CLI is installed: `gws --version`
   - Confirm authentication: `gws auth status`
   - Load required GWS skills (check PREREQUISITE section above)

2. **Parameter Preparation**
   - Parse task parameters from $ARGUMENTS
   - Validate required inputs
   - Prepare JSON payloads and flags

3. **Execute Workflow Steps**
   - Follow the steps outlined above
   - Replace placeholder IDs with actual values
   - Handle errors and retries
   - Log progress and results

4. **Verify Results**
   - Confirm each step completed successfully
   - Verify changes in Google Workspace
   - Report final status and any issues

## Tips

- Use `--dry-run` flag when available to preview changes
- Always inspect API schemas before calling: `gws schema <service>.<resource>.<method>`
- Check command help for all flags: `gws <service> <resource> <method> --help`

---

**License**: Apache License 2.0
**Source**: [Google Workspace CLI](https://github.com/googleworkspace/cli)
**Original Skill**: `recipe-generate-report-from-sheet`
