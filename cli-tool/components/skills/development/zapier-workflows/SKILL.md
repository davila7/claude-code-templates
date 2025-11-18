---
name: zapier-workflows
description: Manage and trigger pre-built Zapier workflows and MCP tool orchestration. Use when user mentions workflows, Zaps, automations, daily digest, research, search, lead tracking, expenses, or asks to "run" any process. Also handles Perplexity-based research and Google Sheets data tracking.
---

# Zapier Workflows Skill

## The Problem This Solves

**Zapier MCP gives Claude access to 8,000+ individual tools** (every Zapier action), but there are critical limitations:

❌ **No memory** - Claude doesn't remember which tools YOU use or why
❌ **No context** - Doesn't know when to use specific tools for your workflows
❌ **Only one-off actions** - Can't trigger your complex, multi-step Zaps
❌ **Fresh start every session** - All context lost between conversations

### The Two Types of Zapier Automation

**1. MCP Tools (One-Off Actions)**
- Individual Zapier actions (Add row to sheet, Send email, etc.)
- Available via Zapier MCP at https://mcp.zapier.com/mcp/servers
- Great for flexible, on-the-fly automation
- **Problem:** 8,000+ choices with no guidance on which to use or when

**2. Multi-Step Zaps (Webhook-Triggered)**
- Complex workflows you've built in Zapier dashboard
- Multiple actions chained together, pre-optimized
- Triggered via webhook URL (POST request)
- **Problem:** Claude can't trigger these - they're not in the MCP

## What This Skill Does

**This skill solves both problems** by giving Claude persistent memory for your Zapier workflows:

✅ **Remembers your MCP tool preferences** - "Use Google Sheets for expenses, Notion for tasks"
✅ **Knows when/why to use each tool** - "Search with Perplexity when researching, not Google"
✅ **Triggers multi-step Zaps** - "Run my daily digest" = webhook POST to your complex Zap
✅ **Self-learning** - Claude updates the skill as you teach it, never forgets
✅ **Cross-session persistence** - Works across all conversations (global install)

### What You Get

**For Multi-Step Zaps:**
- Store webhook URLs and what they do
- Trigger complex workflows just by asking
- Remember when/why to use each Zap
- Document costs, timing, outputs

**For MCP Tools:**
- Document which tools you prefer for which tasks
- Build reusable workflow patterns
- Store tool-specific preferences (sheet names, formats, etc.)
- Create multi-tool orchestration sequences

**Self-Learning:**
- Claude automatically updates skill files when you teach it
- Changes persist forever (global install) or per-project (local install)
- No manual editing required - just talk to Claude

## Installation & Setup

### Installation Location

**Global (`~/.claude/skills/`) - RECOMMENDED:**
- Learned patterns persist across ALL projects
- One Zap library for everything
- Preferences carry over to all projects

**Project-level (`./.claude/skills/`):**
- Learned patterns ONLY in this project
- Isolated from other projects
- Useful for project-specific workflows

### ⚠️ Security Warning

**IMPORTANT:** This skill stores webhook URLs and workflow details in plain text files.

**Webhook URLs contain authentication tokens.** If someone has your webhook URL, they can trigger your Zaps.

**Best practices:**
- ✅ Install globally at `~/.claude/skills/` (not in project repos)
- ✅ Add `.claude/` to your `.gitignore` if installed in a project
- ✅ Never commit skill files with real webhook URLs to public repos
- ✅ Regenerate webhook URLs if accidentally exposed
- ✅ Use Zapier's webhook authentication features when available

**If you need to share this skill:**
- Remove real webhook URLs first
- Replace with placeholder examples
- Or use separate webhook URLs for sharing/testing

### Prerequisites

**Required:**
- Claude Code
- Zapier account (for webhooks and MCP tools)

**Optional:**
- Additional MCP tools based on your workflows (Perplexity Search, Google Sheets, etc.)

### Setting Up Zapier MCP

To connect Zapier's MCP tools to Claude Code:

1. **Go to Zapier MCP servers:**
   - Visit https://mcp.zapier.com/mcp/servers
   - Login to your Zapier account if prompted

2. **Create a new MCP server:**
   - Click "New MCP Server" button (top left)
   - In "MCP Client (required)" dropdown, select **Claude Code**
   - Give your server a name (e.g., "My Zapier Tools")

3. **Add tools:**
   - Click "Add tools" button
   - Select as many Zapier actions as you want (each becomes an MCP tool)
   - Common tools: Run Zap, Add Row to Google Sheets, Send Email, etc.

4. **Connect to Claude Code:**
   - Click "Connect" button
   - You'll see a command like this:
   ```bash
   claude mcp add zapier https://mcp.zapier.com/api/mcp/mcp -t http -H "Authorization: Bearer ZjFmZGJkN..................1NjBhYzc2MDRlYg=="
   ```
   - Copy and run this command in your terminal

5. **Restart Claude Code:**
   - Close and reopen Claude Code
   - Your Zapier MCP tools are now available

**Tip:** You can add more tools later by editing your MCP server in Zapier and running the connect command again.

### Creating Webhook-Triggered Zaps

For pre-built, optimized workflows that you want to trigger on-demand:

1. **In Zapier dashboard:**
   - Create a new Zap
   - Choose "Webhooks by Zapier" as trigger
   - Select "Catch Hook"
   - Copy the webhook URL provided

2. **Build your workflow:**
   - Add whatever actions you want (API calls, data processing, etc.)
   - Test and optimize the Zap

3. **Document it in this skill:**
   - Tell Claude about the new Zap (webhook URL, what it does, trigger phrases)
   - Claude will add it to `references/zaps.md` automatically
   - Now you can trigger it by just asking Claude!

**Webhook vs MCP Tools:**
- **Webhooks:** Pre-built, multi-step Zaps you trigger with a POST request. Great for complex, optimized workflows.
- **MCP Tools:** Individual Zapier actions called directly. Great for flexible, on-the-fly automation.

## Self-Improvement Protocol

**CRITICAL: This skill can and should edit itself to learn from user feedback.**

When the user teaches you something new or corrects your approach:

1. **Identify what to update:**
   - New Zap to document → Edit `references/zaps.md`
   - MCP tool preference → Edit `references/mcp-patterns.md`
   - New workflow pattern → Edit `references/mcp-patterns.md`

2. **Make the edit using Claude Code tools:**
   - Read the file first with the **Read** tool
   - Update with the **Edit** tool (specify exact `old_string` and `new_string`)
   - Confirm the change to the user

3. **Update format:**
   ```markdown
   User: "Use Apollo instead of Clearbit for company data"
   Claude: [uses Read tool on references/mcp-patterns.md]
           [uses Edit tool to update the preference]
           "Updated! I'll use Apollo for company enrichment from now on.
            This change is now permanent in the skill."
   ```

**What to capture in skill updates:**
- ✅ Tool preferences (which tool for which task)
- ✅ Workflow sequences (step-by-step patterns)
- ✅ Error handling approaches
- ✅ Data formatting requirements
- ✅ New Zaps and their details
- ❌ One-off requests (don't clutter the skill)
- ❌ Temporary context (use memory instead)

## Decision Logic

### When to Use Webhook-Triggered Zaps

Use webhooks when:
- Task is complex, multi-step, and already refined
- User mentions a specific Zap name (check `references/zaps.md`)
- Deterministic execution is critical
- Task involves 5+ API calls or complex orchestration
- Cost/time efficiency matters (pre-built Zaps are optimized)

### When to Use MCP Tool Orchestration

Use MCP tools when:
- Task is simple (1-3 actions)
- Flexibility is needed (parameters change)
- Testing a new workflow pattern
- User explicitly asks to use specific MCP tools

## Execution Pattern

1. **Listen for triggers:** Workflow names, "run", "trigger", "search", "research", etc.
2. **Check references:** Use Read tool on appropriate reference file for details
3. **Check prerequisites:**
   - **If MCP tools needed but not available:** Provide Zapier MCP setup instructions (see below)
   - **If MCP tools available but not documented:** Trigger tool discovery protocol (see below)
   - **If webhook URL needed but not in references:** Provide webhook extraction instructions (see below)
4. **Execute:**
   - **For webhook-triggered Zaps:** Use Bash tool with curl to POST to webhook URL (webhooks are created in Zapier dashboard with "Catch Hook" trigger)
   - **For MCP tool workflows:** Call the appropriate Zapier MCP tool directly (configured via https://mcp.zapier.com/mcp/servers)
5. **Confirm:** Tell user what happened in natural language
6. **Learn:** If user corrects you, use Edit tool to update the skill files
7. **Suggest pattern saving:** After successful tool use, offer to save the pattern (see below)

## Proactive Pattern Detection & Learning

**CRITICAL:** After you successfully help the user with MCP tools or workflows, proactively suggest saving valuable patterns.

### When to Suggest Saving Patterns

After completing a task using MCP tools, check if this is a pattern worth saving:

**Look for:**
- Multi-step tool sequences that worked well
- Specific parameter combinations the user liked
- Repeated workflows or use cases
- Tool preferences the user expressed during the task
- Successful solutions to user problems

**Suggest saving if:**
- You used 2+ MCP tools in sequence
- User expressed satisfaction with the result
- This seems like something user might repeat
- User gave specific preferences during the interaction

### How to Suggest Pattern Saving

After completing the task successfully:

```
"That worked well! I noticed I [describe what you did, e.g., 'used Perplexity to research, then saved results to Google Sheets'].

Would you like me to save this as a pattern? If you tell me:
- What trigger words to listen for
- When/why to use this workflow
- Any preferences or variations

I'll remember it and do this automatically next time!"
```

### Document the Pattern

If user says yes:
1. Use Read tool on `references/mcp-patterns.md`
2. Use Edit tool to add new pattern with:
   - Pattern name
   - Trigger phrases
   - When/why to use it
   - Step-by-step workflow
   - Parameters/preferences
   - Example
3. Confirm: "Saved! Next time you [trigger], I'll [workflow]."

**Examples of patterns worth saving:**
- "Research and document" (Perplexity → summarize → Google Sheets)
- "Expense tracking" (Extract amount/description → format → add to sheet)
- "Competitive analysis" (Search competitor → analyze → save insights)
- "Daily briefing" (Multiple searches → synthesize → deliver)

**Don't save:**
- One-off requests
- Highly specific/unique situations
- Simple single-tool uses (unless user asks)

## Setup Detection & Instructions

### If Zapier MCP Not Detected

When user requests MCP tool functionality but Zapier MCP is not connected, tell them:

```
"I don't see the Zapier MCP tools connected. Here's how to set them up:

1. Go to https://mcp.zapier.com/mcp/servers
2. Login to your Zapier account
3. Click 'New MCP Server' (top left)
4. Select 'Claude Code' in the MCP Client dropdown
5. Give it a name (e.g., 'My Zapier Tools')
6. Click 'Add tools' and select the Zapier actions you want
7. Click 'Connect' and copy the command shown
8. Run that command in your terminal (it looks like):
   claude mcp add zapier https://mcp.zapier.com/api/mcp/mcp -t http -H "Authorization: Bearer [your-token]"
9. Restart Claude Code

Once setup, I'll be able to use those Zapier actions directly!"
```

### When Zapier MCP Is Connected - Tool Discovery & Documentation

**IMPORTANT:** When Zapier MCP is connected (tools starting with `mcp__zapier__` are available), proactively help the user document them with rich context:

1. **List available tools:**
   - Check what Zapier MCP tools are available
   - List them out for the user

2. **Prompt for detailed documentation:**
   ```
   "I see you have these Zapier MCP tools available:
   - mcp__zapier__google_sheets_create_spreadsheet_row
   - mcp__zapier__perplexity_chat_completion
   - [etc.]

   To help me use these effectively, I need to understand:

   For each tool you want me to use, please tell me:

   1. WHEN should I use this tool?
      - What trigger words or phrases?
      - What situations or contexts?
      - What types of requests?

   2. WHY should I use this tool vs alternatives?
      - What's it best for?
      - When should I NOT use it?

   3. HOW should I use it?
      - Any specific parameters or preferences?
      - Default values I should use?
      - Sheet names, formats, or other specifics?

   4. Any PATTERNS or workflows involving this tool?
      - Multi-step sequences?
      - Common combinations with other tools?

   Take your time - the more detail you give me, the better I can serve you!"
   ```

3. **Document in skill:**
   - Use Read tool on `references/mcp-patterns.md`
   - Use Edit tool to add comprehensive documentation:
     - Tool name and purpose
     - Trigger phrases (when)
     - Use cases (why)
     - Parameters and preferences (how)
     - Workflow patterns if mentioned
   - Confirm to user what was documented

**When to trigger this:**
- First time user mentions Zapier or workflows after MCP setup
- User explicitly asks "what tools do I have?" or "what can you do with Zapier?"
- When you detect new Zapier MCP tools that aren't documented in `references/mcp-patterns.md`

### If User Wants to Add a Webhook-Triggered Zap

When user mentions creating or adding a multi-step Zap for webhook triggering, provide these instructions:

```
"To get your webhook URL from an existing Zap:

1. Go to your Zap in the Zapier dashboard
2. Make sure the trigger is a 'Webhooks by Zapier' node
3. In the 'Trigger Event' dropdown, select 'Catch Hook'
4. Go to the 'Test' tab
5. Copy the 'Webhook URL' shown
6. Give me that URL and tell me:
   - What the Zap does (step-by-step)
   - What trigger phrases you want to use
   - Any other details (timing, cost, etc.)

I'll add it to my knowledge so you can trigger it anytime just by asking!"
```

## Quick Reference

- **All Zaps:** See `references/zaps.md`
- **MCP Patterns:** See `references/mcp-patterns.md`
- **Common workflows:** Both files contain examples

## Usage Examples

**Triggering a Zap:**
```
User: "Run my daily digest"
Claude: [uses Read tool on references/zaps.md for webhook details]
        [uses Bash tool to trigger webhook with curl POST]
        "Started your Daily AI Digest. You'll get the report via email
         in ~3 minutes, with SMS alerts for any high-priority items."
```

**Using MCP orchestration:**
```
User: "Research the latest on quantum computing"
Claude: [uses Read tool on references/mcp-patterns.md]
        [calls Perplexity Search MCP tool]
        [analyzes results, identifies gaps]
        [calls Perplexity Search again for deeper dive]
        "Here's what I found... [summary]"
```

**Learning and updating:**
```
User: "No, when tracking expenses use my 'Personal Budget' sheet, not 'Expenses'"
Claude: [uses Read tool on references/mcp-patterns.md]
        [uses Edit tool to update the Google Sheets section]
        "Got it - updated the skill. I'll use 'Personal Budget' sheet
         for expense tracking from now on."
```

## FAQ & Troubleshooting

### "Claude isn't detecting my Zapier MCP tools"

**Check if MCP is connected:**
- Look for tools starting with `mcp__zapier__` in your available tools
- Try asking: "What Zapier tools do I have?"

**If not showing up:**
1. Verify you ran the connection command from https://mcp.zapier.com/mcp/servers
2. Restart Claude Code completely (not just reload)
3. Check your Claude Code MCP settings
4. Verify the authorization token in the command was correct

### "Claude isn't suggesting to save patterns"

**Pattern detection triggers when:**
- You use 2+ MCP tools in sequence
- The task completes successfully
- It seems repeatable (not a one-off request)

**Try explicitly asking:**
- "Can you save this as a pattern?"
- "Remember this workflow for next time"

### "Webhook URL not triggering my Zap"

**Common issues:**
1. **Wrong URL** - Make sure you copied the full URL from Test tab
2. **Zap not turned on** - Enable the Zap in Zapier dashboard
3. **Trigger node incorrect** - Must be "Webhooks by Zapier" → "Catch Hook"
4. **Firewall/network** - Check if curl command works from terminal first

**Test manually:**
```bash
curl -X POST https://hooks.zapier.com/hooks/catch/[your-url]
```

### "Claude keeps asking to document tools I already documented"

**Likely causes:**
- Tools documented but file not saved properly
- Using different Claude Code instance/installation
- Skill installed at project level, not global

**Fix:**
1. Check `references/mcp-patterns.md` has your tools
2. Verify skill location: `~/.claude/skills/` (global) vs `./.claude/skills/` (project)
3. If project-level, copy to global for cross-project persistence

### "How do I know if the skill is working?"

**Signs it's working:**
1. When you mention Zapier/workflows, Claude mentions checking references
2. Claude asks detailed questions (WHEN/WHY/HOW) about tools
3. After using tools, Claude suggests saving patterns
4. Claude successfully triggers your webhooks

**Quick test:**
1. Ask: "What Zapier tools do I have?"
2. Add a fake webhook and tell Claude about it
3. Check if it was added to `references/zaps.md`

### "Skill files getting too large / slow to load"

**If reference files grow too large:**
- Review and remove outdated/unused patterns
- Consolidate similar workflows
- Keep only actively-used tools documented
- Consider splitting into multiple skill instances for different domains

**Performance tips:**
- Keep trigger phrases concise and specific
- Avoid documenting one-off workflows
- Use pattern categories to organize

### "I want to reset the skill to template state"

**To start fresh:**
1. Backup your current skill files (if you want to keep anything)
2. Delete the skill directory
3. Re-clone from GitHub: https://github.com/AlexBoudreaux/claude-zapier-skill
4. Copy fresh template to `~/.claude/skills/`

### "Can I use this skill without Zapier MCP?"

**Yes!** The skill works with:
- **Only webhooks** - Trigger multi-step Zaps without MCP
- **Only MCP tools** - Document tool usage without webhooks
- **Both** - Get full functionality

Each mode is independent and valuable on its own.

### "Security: I accidentally committed webhook URLs"

**Immediate actions:**
1. Remove the commit from git history (git rebase, BFG Repo-Cleaner)
2. Regenerate webhook URLs in Zapier dashboard:
   - Edit the Zap
   - Delete and re-add the webhook trigger node
   - Get new webhook URL
3. Update skill files with new URLs
4. Add `.claude/` to `.gitignore`

**Prevention:**
- Install skill globally (`~/.claude/skills/`)
- Never commit `.claude/` directory in projects
- Use placeholder URLs in shared examples

## Important Notes

- **Webhooks don't need payloads** - Zaps get their data from Zapier Tables
- **Always read reference files** before executing - they contain critical details
- **Update skill files** when learning something new - don't just remember it for this conversation

## Claude Code Tools Used

This skill uses the following Claude Code tools:

- **Read** - To view reference files (zaps.md, mcp-patterns.md)
- **Edit** - To update skill files with new workflows, patterns, or preferences
- **Bash** - To trigger Zapier webhooks using curl POST requests
- **MCP Tools** - To call Perplexity Search, Google Sheets, and other integrations
