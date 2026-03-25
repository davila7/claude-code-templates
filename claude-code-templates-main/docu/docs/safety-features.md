---
sidebar_position: 1
---

# Safety Features

`claude-code-templates` is designed with several safety features to ensure that your project and data are protected during the setup and configuration process.

-   **Automatic Backups**: Existing files are automatically backed up before any changes are made, allowing you to revert to a previous state if needed.
-   **Confirmation Required**: The CLI always asks for your confirmation before making significant changes to your project (unless the `--yes` flag is used), giving you full control over the process.
-   **Dry Run Mode**: You can preview the installation and changes without actually modifying your files by using the `--dry-run` option.
-   **Cancel Anytime**: You can cancel the operation at any point by pressing `Ctrl+C` or by answering 'No' to confirmation prompts.
-   **Back Navigation**: During interactive setup, you can navigate back to modify previous selections, preventing accidental configurations.
