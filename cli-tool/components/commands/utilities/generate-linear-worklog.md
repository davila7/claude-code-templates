# Generate Linear Work Log

You are tasked with generating a technical work log comment for a Linear issue based on recent git commits.

## Instructions

1. **Check Linear MCP Availability**
   - Verify that Linear MCP tools are available (mcp__linear__* functions)
   - If Linear MCP is not installed, inform the user to install it and provide installation instructions
   - Do not proceed with work log generation if Linear MCP is unavailable

2. **Check for Existing Work Log**
   - Use Linear MCP to get existing comments on the issue
   - Look for comments with today's date in the format "## Work Completed [TODAY'S DATE]"
   - If found, note the existing content to append/update rather than duplicate

2. **Extract Git Information**
   - Get the current branch name
   - Get recent commits on the current branch (last 10 commits)
   - Get commits that are on the current branch but not on main branch
   - For each relevant commit, get detailed information including file changes and line counts
   - Focus on commits since the last work log update (if any exists)

3. **Generate Work Log Content**
   - Use dry, technical language without adjectives or emojis
   - Focus on factual implementation details
   - Structure the log with date, branch, and commit information
   - Include quantitative metrics (file counts, line counts) where relevant
   - Avoid subjective commentary or promotional language

4. **Handle Existing Work Log**
   - If no work log exists for today: Create new comment
   - If work log exists for today: Replace the existing comment with updated content including all today's work
   - Ensure chronological order of commits
   - Include both previous and new work completed today

5. **Format Structure**
   ```
   ## Work Completed [TODAY'S DATE]

   ### Branch: [current-branch-name]

   **Commit [short-hash]: [Commit Title]**
   - [Technical detail 1]
   - [Technical detail 2]
   - [Line count] lines of code across [file count] files

   [Additional commits in chronological order]

   ### [Status Section]
   - [Current infrastructure/testing status]
   - [What is now available/ready]
   ```

6. **Post to Linear**
   - Use the Linear MCP integration to create or update the comment
   - Post the formatted work log to the specified Linear issue
   - If updating, replace the entire existing work log comment
   - Confirm successful posting

## Git Commands to Use
- `git branch --show-current` - Get current branch
- `git log --oneline -10` - Get recent commits
- `git log main..HEAD --oneline` - Get branch-specific commits
- `git show --stat [commit-hash]` - Get detailed commit info
- `git log --since="[today's date]" --pretty=format:"%h %ad %s" --date=short` - Get today's commits

## Content Guidelines
- Include commit hashes and descriptive titles
- Provide specific technical implementations
- Include file counts and line counts for significant changes
- Maintain consistent formatting
- Focus on technical accomplishments
- Include current status summary
- No emojis or special characters

## Error Handling
- Check if Linear MCP client is available before proceeding
- If Linear MCP is not available, display installation instructions:
  ```
  Linear MCP client is not installed. To install it:
  
  1. Install the Linear MCP server:
     npm install -g @modelcontextprotocol/server-linear
  
  2. Add Linear MCP to your Claude configuration:
     Add the following to your Claude MCP settings:
     {
       "mcpServers": {
         "linear": {
           "command": "npx",
           "args": ["@modelcontextprotocol/server-linear"],
           "env": {
             "LINEAR_API_KEY": "your_linear_api_key_here"
           }
         }
       }
     }
  
  3. Restart Claude Code
  4. Get your Linear API key from: https://linear.app/settings/api
  ```
- Validate that the Linear ticket ID exists
- Handle cases where no recent commits are found
- Provide clear error messages for git operation failures
- Confirm successful comment posting

## Example Usage
When invoked with `/generate-linear-worklog BLA2-2`, the command should:
1. Analyze git commits on the current branch
2. Generate a structured work log
3. Post the comment to Linear issue BLA2-2
4. Confirm successful posting