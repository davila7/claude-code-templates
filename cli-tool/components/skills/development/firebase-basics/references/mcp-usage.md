# Firebase CLI and MCP server

The Firebase CLI includes a built-in local MCP server that can help with common
tasks.

1.  **Locate MCP configuration**

    Find the configuration file for your agent
    (e.g., `~/.codeium/windsurf/mcp_config.json`, `cline_mcp_settings.json`, or
    `claude_desktop_config.json`).

    *Note: If the document or its containing directory does not exist, create
    them and initialize the file with `{ "mcpServers": {} }` before proceeding.*

2.  **Check existing configuration**

    Open the configuration file and check the `mcpServers` section for a
    `firebase` entry.

    - Firebase is already configured if the `command` is `"firebase"` OR if the
      `command` is `"npx"` with `"firebase-tools"` and `"mcp"` in the `args`.

    - **Important**: If a valid `firebase` entry is found, the MCP server is
      already configured. **Skip step 3** and proceed directly to step 4.

    **Example valid configurations**:
    ```json
    "firebase": {
      "command": "npx",
      "args": ["-y", "firebase-tools@latest", "mcp"]
    }
    ```
    OR
    ```json
    "firebase": {
      "command": "firebase",
      "args": ["mcp"]
    }
    ```

3.  **Add or update configuration**

    If the `firebase` entry is missing or incorrect, add it to the `mcpServers`
    object:

    ```json
    "firebase": {
      "command": "npx",
      "args": [
        "-y",
        "firebase-tools@latest",
        "mcp"
      ]
    }
    ```

    *CRITICAL: Merge this configuration into the existing file. You MUST
    preserve any other existing servers inside the `mcpServers` object.*

4.  **Verify configuration**

    Save the file and confirm the `firebase` block is present and is properly
    formatted JSON.