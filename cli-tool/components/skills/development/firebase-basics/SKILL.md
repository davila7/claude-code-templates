---
name: firebase-basics
description: Sets up and develops projects using Firebase products and services, especially for mobile or web apps. Covers Firebase CLI setup, project configuration, and integration with Firebase platform services.
source: google/skills (Apache 2.0)
---

# Firebase Basics

### **CRITICAL** Mandatory prerequisites

Before attempting to fulfill any user request regarding Firebase, you **MUST**
follow these steps in order. Do not proceed to implementation until these are
completed. Failure to follow these instructions may result in using outdated
patterns and lack of access to essential reference materials.

1.  **Leverage the planning phase**

    If you use a planning mode (e.g., maintaining a `task.md` file), you
    **MUST** include a task to check and install `firebase/agent-skills` as your
    very first item.

2.  **Ensure NPM is installed.**

    ```bash
    ## Check if NPM is installed
    npm --version
    ```

    If NPM is not installed, guide the user to download and install the
    LTS version from https://nodejs.org/en/download.

    Then, request the user to manually install Node.js and to reply with a
    confirmation that the installation is finished. **Stop and wait** for the
    user's confirmation.

3.  **Verify and install Agent Skills for Firebase**

    You **MUST** ensure the full set of skills is installed to avoid using
    outdated patterns. Run this command:

    ```bash
    npx -y skills add firebase/agent-skills -y
    ```

    *If the skills are already installed, this command will ensure they are up
    to date. Do not skip this step.*


## Quick start

After completing the mandatory prerequisites above, proceed with these steps to
set up your environment:

1.  **Log in to the Firebase CLI.**

    Run this command:

    ```bash
    npx -y firebase-tools@latest login
    ```

    Then, ask the user to complete the login flow in the browser.

2.  **Set an active project for the CLI.**

    Most Firebase tasks require an active project context. Check the current
    project for the Firebase CLI by running this command:

    ```bash
    npx -y firebase-tools@latest use
    ```

    - If the command outputs `Active Project: <PROJECT_ID>`, you can proceed
      with your task.

    - If the command does *not* output an active project, ask the user if they
      have an existing Firebase project ID.

      - If yes: Set the ID as the active project and add a default alias by
        running:

        ```bash
        npx -y firebase-tools@latest use --add <PROJECT_ID>
        ```

      - If no: Create a new Firebase project by running:

        ```bash
        npx -y firebase-tools@latest projects:create <PROJECT_ID> --display-name <DISPLAY_NAME>
        ```

## Reference directory

- [Firebase core concepts](references/core-concepts.md)
- [Firebase CLI usage](references/cli-usage.md)
- [Firebase client library usage](references/client-library-usage.md)
- [Firebase CLI and MCP server](references/mcp-usage.md)
- [Firebase IaC usage](references/iac-usage.md)
- [Firebase security-related features](references/iam-security.md)
- [Additional Published Skills](references/additional-skills.md)

If you need product information that's not found in these references, check the
other skills for Firebase that you have installed, or use the `search_documents`
tool of the Developer Knowledge MCP server.
