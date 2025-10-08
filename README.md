# Claude Code Templates Website

This directory contains the static website for browsing and installing Claude Code configuration templates.

## Features

- **Dynamic Template Loading**: Templates are loaded directly from the GitHub repository's `templates.js` file
- **Interactive Cards**: Click any template card to see the installation command
- **Responsive Design**: Works on desktop and mobile devices
- **Framework Logos**: Uses Devicon CDN for professional programming language and framework logos
- **Copy to Clipboard**: Easy command copying with visual feedback

## Architecture

The website is built as a static site that:

1. **Fetches template data** from `cli-tool/src/templates.js` in the GitHub repository
2. **Parses the configuration** to extract available languages and frameworks
3. **Generates cards dynamically** with proper logos from Devicon CDN
4. **Updates automatically** when new templates are added to the repository

## Files

- `index.html` - Main HTML structure
- `styles.css` - Styling and responsive design
- `script.js` - JavaScript for dynamic content loading and interactions
- `_config.yml` - Jekyll configuration for GitHub Pages
- `README.md` - This documentation

## GitHub Pages Deployment

This website is automatically deployed to GitHub Pages when changes are pushed to the `docs/` directory in the main branch.

Visit: [https://davila7.github.io/claude-code-templates](https://davila7.github.io/claude-code-templates)

## Development

To test locally:

1. Clone the repository
2. Navigate to the `docs/` directory
3. Serve with any static file server (e.g., `python -m http.server 8000`)
4. Open `http://localhost:8000`

## Dependencies

- **Devicon CDN**: For programming language and framework logos
- **GitHub Raw Content**: For fetching template configurations
- **Modern Browser**: Support for ES6+ features and Fetch API