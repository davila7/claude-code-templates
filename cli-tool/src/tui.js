'use strict';

const { intro, outro, text, select, multiselect, confirm, spinner, note, isCancel, cancel } = require('@clack/prompts');
const gradient = require('gradient-string');
const chalk = require('chalk');

// Brand colors
const ORANGE_PRIMARY = '#F97316';
const ORANGE_DARK = '#EA580C';
const ORANGE_LIGHT = '#FB923C';

// Create the orange gradient for the brand title
const orangeGradient = gradient([ORANGE_DARK, ORANGE_PRIMARY, ORANGE_LIGHT]);

/**
 * Get the current version from package.json
 */
function getVersion() {
  try {
    const pkg = require('../package.json');
    return pkg.version || '1.0.0';
  } catch (_) {
    return '1.0.0';
  }
}

/**
 * showBanner() - Beautiful banner with gradient title
 *
 * Output:
 *  ╔═══════════════════════════════════════════════════╗
 *  ║                                                   ║
 *  ║   🔮  Claude Code Templates                       ║
 *  ║       Your starting point for Claude Code         ║
 *  ║                                                   ║
 *  ║   v1.28.13   aitmpl.com   docs.aitmpl.com        ║
 *  ╚═══════════════════════════════════════════════════╝
 */
function showBanner() {
  const version = getVersion();
  const borderColor = chalk.hex(ORANGE_PRIMARY);
  const dimColor = chalk.hex(ORANGE_DARK).dim;
  const subtitleColor = chalk.white.dim;
  const metaColor = chalk.hex(ORANGE_LIGHT).dim;

  const width = 53; // inner width between the border chars

  const top =    borderColor('╔' + '═'.repeat(width) + '╗');
  const empty =  borderColor('║' + ' '.repeat(width) + '║');
  const bottom = borderColor('╚' + '═'.repeat(width) + '╝');

  // Title line: "   🔮  Claude Code Templates                       "
  const titleText = '🔮  ' + orangeGradient('Claude Code Templates');
  // Clack/chalk color sequences add invisible bytes; we pad to fill the inner width
  // We compute visible length: "   🔮  Claude Code Templates" — emoji is 2 cols wide
  // Visible: 3 spaces + "🔮" (2) + 2 spaces + "Claude Code Templates" (21) = 28 visible
  const titleVisible = 28;
  const titlePad = ' '.repeat(width - titleVisible - 3); // -3 for left margin (3 spaces)
  const titleLine = borderColor('║') + '   ' + titleText + titlePad + borderColor('║');

  // Subtitle line
  const subtitle = subtitleColor('Your starting point for Claude Code');
  const subtitleVisible = 36;
  const subtitlePad = ' '.repeat(width - subtitleVisible - 7); // 7 = "       " indent
  const subtitleLine = borderColor('║') + '       ' + subtitle + subtitlePad + borderColor('║');

  // Version / links line
  const versionStr = metaColor('v' + version);
  const separator = dimColor('   ');
  const site = metaColor('aitmpl.com');
  const docsLink = metaColor('docs.aitmpl.com');
  const metaText = 'v' + version + '   ' + 'aitmpl.com' + '   ' + 'docs.aitmpl.com';
  const metaVisible = metaText.length;
  const metaPad = ' '.repeat(width - metaVisible - 3); // -3 for left margin
  const metaLine = borderColor('║') + '   ' + versionStr + separator + site + separator + docsLink + metaPad + borderColor('║');

  console.log('');
  console.log(top);
  console.log(empty);
  console.log(titleLine);
  console.log(subtitleLine);
  console.log(empty);
  console.log(metaLine);
  console.log(bottom);
  console.log('');
}

/**
 * showProjectDetected(projectInfo) - Shows what was auto-detected
 *
 * @param {Object} projectInfo
 * @param {string} projectInfo.language - e.g. "JavaScript/TypeScript"
 * @param {string} projectInfo.framework - e.g. "React"
 * @param {string[]} projectInfo.files - e.g. ["package.json", "src/", "components/"]
 *
 * Output:
 * ┌─ Project Detected ──────────────────────────────┐
 * │  Language:   JavaScript/TypeScript               │
 * │  Framework:  React                               │
 * │  Files:      package.json, src/, components/     │
 * └─────────────────────────────────────────────────┘
 */
function showProjectDetected(projectInfo) {
  const borderColor = chalk.hex(ORANGE_PRIMARY);
  const labelColor = chalk.white.dim;
  const valueColor = chalk.white;
  const titleColor = chalk.hex(ORANGE_LIGHT);

  const innerWidth = 51;

  const headerLabel = ' Project Detected ';
  const headerDashes = '─'.repeat(innerWidth - headerLabel.length - 1);
  const top = borderColor('┌') + borderColor('─') + titleColor(headerLabel) + borderColor(headerDashes) + borderColor('┐');
  const bottom = borderColor('└') + borderColor('─'.repeat(innerWidth)) + borderColor('┘');

  function row(label, value) {
    const paddedLabel = (label + ':').padEnd(11);
    const content = '  ' + labelColor(paddedLabel) + ' ' + valueColor(value);
    // Visible length: 2 + label(11) + 1 + value.length
    const visibleLen = 2 + 11 + 1 + value.length;
    const pad = ' '.repeat(Math.max(0, innerWidth - visibleLen - 2)); // -2 for '│ ' and ' │' margins
    // Actually build: '│  <label> <value><pad>│'
    return borderColor('│') + '  ' + labelColor(paddedLabel) + ' ' + valueColor(value) + pad + ' ' + borderColor('│');
  }

  const language = projectInfo.language || 'Unknown';
  const framework = projectInfo.framework || 'None detected';
  const files = Array.isArray(projectInfo.files)
    ? projectInfo.files.join(', ')
    : (projectInfo.files || 'None detected');

  console.log('');
  console.log(top);
  console.log(row('Language', language));
  console.log(row('Framework', framework));
  console.log(row('Files', files));
  console.log(bottom);
  console.log('');
}

/**
 * showInstallSummary(components) - Shows what will be installed
 *
 * @param {Array<{type: string, name: string, description?: string}>} components
 *
 * Output:
 * ┌─ Install Summary ─────────────────────────────────┐
 * │                                                    │
 * │  Agents (2)                                        │
 * │    • frontend-developer                            │
 * │    • security-auditor                              │
 * │                                                    │
 * │  Commands (1)                                      │
 * │    • setup-testing                                 │
 * │                                                    │
 * └────────────────────────────────────────────────────┘
 */
function showInstallSummary(components) {
  const borderColor = chalk.hex(ORANGE_PRIMARY);
  const titleColor = chalk.hex(ORANGE_LIGHT);
  const typeColor = chalk.hex(ORANGE_PRIMARY).bold;
  const itemColor = chalk.white;
  const bulletColor = chalk.hex(ORANGE_DARK);

  const innerWidth = 52;

  const headerLabel = ' Install Summary ';
  const headerDashes = '─'.repeat(innerWidth - headerLabel.length - 1);
  const top = borderColor('┌') + borderColor('─') + titleColor(headerLabel) + borderColor(headerDashes) + borderColor('┐');
  const bottom = borderColor('└') + borderColor('─'.repeat(innerWidth)) + borderColor('┘');
  const emptyRow = borderColor('│') + ' '.repeat(innerWidth) + borderColor('│');

  function contentRow(text, indent) {
    const indentStr = ' '.repeat(indent);
    const visibleLen = indent + text.length;
    const pad = ' '.repeat(Math.max(0, innerWidth - visibleLen));
    return borderColor('│') + indentStr + text + pad + borderColor('│');
  }

  // Group components by type
  const grouped = {};
  for (const comp of components) {
    const type = comp.type || 'Other';
    if (!grouped[type]) grouped[type] = [];
    grouped[type].push(comp.name || comp);
  }

  const lines = [top, emptyRow];

  for (const [type, names] of Object.entries(grouped)) {
    const typeHeader = typeColor(type) + chalk.white.dim(' (' + names.length + ')');
    lines.push(contentRow(typeHeader, 2));
    for (const name of names) {
      lines.push(contentRow(bulletColor('• ') + itemColor(name), 4));
    }
    lines.push(emptyRow);
  }

  lines.push(bottom);

  console.log('');
  for (const line of lines) {
    console.log(line);
  }
  console.log('');
}

/**
 * showStepIndicator(current, total, title) - Shows step progress
 *
 * @param {number} current - Current step number (1-based)
 * @param {number} total - Total number of steps
 * @param {string} title - Step title
 *
 * Output:
 *   Step 2 of 5  ─────────────────  Select Commands
 */
function showStepIndicator(current, total, title) {
  const stepColor = chalk.hex(ORANGE_PRIMARY).bold;
  const separatorColor = chalk.hex(ORANGE_DARK).dim;
  const titleColor = chalk.white.bold;
  const dimColor = chalk.white.dim;

  const stepText = stepColor('Step ' + current) + dimColor(' of ' + total);
  const separator = separatorColor('  ─────────────────  ');
  const titleText = titleColor(title);

  console.log('');
  console.log('  ' + stepText + separator + titleText);
  console.log('');
}

/**
 * showSuccess(message) - Beautiful success message
 *
 * @param {string} message - Success message text
 */
function showSuccess(message) {
  const checkColor = chalk.hex(ORANGE_PRIMARY).bold;
  const messageColor = chalk.white.bold;
  const borderColor = chalk.hex(ORANGE_DARK).dim;

  const line = '─'.repeat(Math.min(60, message.length + 8));

  console.log('');
  console.log('  ' + checkColor('✓') + '  ' + messageColor(message));
  console.log('  ' + borderColor(line));
  console.log('');
}

/**
 * showError(message) - Error message
 *
 * @param {string} message - Error message text
 */
function showError(message) {
  const crossColor = chalk.red.bold;
  const messageColor = chalk.red;
  const borderColor = chalk.red.dim;

  const line = '─'.repeat(Math.min(60, message.length + 8));

  console.log('');
  console.log('  ' + crossColor('✗') + '  ' + messageColor(message));
  console.log('  ' + borderColor(line));
  console.log('');
}

/**
 * createSpinner(text) - Wrapper around @clack/prompts spinner
 *
 * @param {string} text - Initial spinner message
 * @returns {{ start: (msg?: string) => void, stop: (msg?: string, code?: number) => void, message: (msg: string) => void }}
 */
function createSpinner(text) {
  const s = spinner();

  return {
    /**
     * Start the spinner with an optional message (falls back to the initial text)
     * @param {string} [msg]
     */
    start(msg) {
      s.start(msg || text);
    },

    /**
     * Stop the spinner with an optional final message
     * @param {string} [msg]
     * @param {number} [code] - 0 = success (green checkmark), 1 = error (red cross)
     */
    stop(msg, code) {
      s.stop(msg, code);
    },

    /**
     * Update the spinner message while it is running
     * @param {string} msg
     */
    message(msg) {
      s.message(msg);
    }
  };
}

module.exports = {
  // @clack/prompts re-exports for convenience
  intro,
  outro,
  text,
  select,
  multiselect,
  confirm,
  note,
  isCancel,
  cancel,

  // TUI utilities
  showBanner,
  showProjectDetected,
  showInstallSummary,
  showStepIndicator,
  showSuccess,
  showError,
  createSpinner,

  // Exposed brand helpers for external use
  orangeGradient
};
