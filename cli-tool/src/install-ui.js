'use strict';

/**
 * Output for the multi-component install flow (`--agent x --hook y ...`).
 *
 * Interactive terminals get a step rail: a header, a plan table, the location
 * prompt, then one row per component that turns from a spinner into ✔ / ✖ with
 * the files it wrote. Without a TTY (or in CI) the same content is printed as
 * plain lines with no animation.
 *
 * The individual installers still print their own progress; runStep() captures
 * that output so only the result row is shown, and surfaces captured warnings
 * if an installer needs to ask a question mid-install.
 */

const os = require('os');
const path = require('path');
const chalk = require('chalk');
const { S_BAR, S_BAR_END, S_STEP_SUBMIT, S_STEP_ACTIVE, unicodeOr } = require('@clack/prompts');

const ORANGE = chalk.hex('#F97316');
const ORANGE_LIGHT = chalk.hex('#FB923C');
const RAIL = chalk.gray(S_BAR);

// Single-width symbols so the plan columns line up in every terminal.
const TYPES = {
  agent:   { icon: unicodeOr('◆', '*'), label: 'agent',   color: chalk.hex('#93C5FD') },
  command: { icon: '/', label: 'command', color: chalk.hex('#67E8F9') },
  mcp:     { icon: unicodeOr('⬢', '#'), label: 'mcp',     color: chalk.hex('#F9A8D4') },
  setting: { icon: unicodeOr('⚙', '%'), label: 'setting', color: chalk.hex('#C4B5FD') },
  hook:    { icon: unicodeOr('↯', '!'), label: 'hook',    color: chalk.hex('#FACC15') },
  skill:   { icon: unicodeOr('✦', '+'), label: 'skill',   color: chalk.hex('#4ADE80') },
  loop:    { icon: unicodeOr('↻', '@'), label: 'loop',    color: chalk.hex('#FB923C') },
  mod:     { icon: unicodeOr('◈', '&'), label: 'mod',     color: chalk.hex('#FCA5A5') }
};

const WRITES = {
  agent: '.claude/agents/',
  command: '.claude/commands/',
  mcp: '.mcp.json',
  setting: 'settings',
  hook: 'settings',
  skill: '.claude/skills/',
  loop: '.claude/loops/ + referenced',
  mod: '.claude/skills/'
};

const LOCATIONS = [
  { value: 'local', label: 'Local', file: '.claude/settings.local.json', hint: 'personal, git-ignored' },
  { value: 'project', label: 'Project', file: '.claude/settings.json', hint: 'shared with your team' },
  { value: 'user', label: 'User', file: '~/.claude/settings.json', hint: 'every project' },
  { value: 'enterprise', label: 'Enterprise', file: 'managed-settings.json', hint: 'needs admin' }
];

const SPINNER_FRAMES = unicodeOr(['◒', '◐', '◓', '◑'], ['•', 'o', 'O', '0']);
const S_OK = unicodeOr('✔', '√');
const S_FAIL = unicodeOr('✖', 'x');
const ANSI_RE = /\u001b\[[0-9;]*m/g;

function stripAnsi(text) {
  return String(text).replace(ANSI_RE, '');
}

function isInteractive() {
  return Boolean(process.stdout.isTTY) && !process.env.CI;
}

function displayPath(absPath, targetDir) {
  const rel = path.relative(targetDir, absPath);
  if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) return rel.split(path.sep).join('/');
  const home = os.homedir();
  if (absPath.startsWith(home + path.sep)) return '~/' + path.relative(home, absPath).split(path.sep).join('/');
  return absPath;
}

/**
 * Collapse the files a component wrote into one short description:
 * a directory for skills/mods (with a file count), otherwise the file list.
 */
function describeWrites(files, targetDir) {
  const unique = [...new Set(files)].map(f => displayPath(f, targetDir));
  if (unique.length === 0) return '';

  // Settings files are named by file only (the location is already chosen),
  // any script a hook or setting adds is shown with its path.
  const isSettingsFile = f => /(^|\/)(settings(\.local)?|managed-settings)\.json$/.test(f);
  const settings = unique.filter(isSettingsFile);
  const others = unique.filter(f => !isSettingsFile(f));
  if (settings.length > 0) {
    const names = settings.length === 1 ? settings : settings.map(f => f.split('/').pop());
    if (others.length === 0) return names.join(', ');
    const extra = others.length === 1 ? others[0].replace(/^\.claude\//, '') : `${others.length} files`;
    return `${names.join(', ')} + ${extra}`;
  }

  if (unique.length === 1) return unique[0];
  const parts = unique.map(f => f.split('/'));
  const common = [];
  for (let i = 0; i < parts[0].length - 1; i++) {
    const seg = parts[0][i];
    if (parts.every(p => p[i] === seg)) common.push(seg); else break;
  }
  if (common.length > 1) return `${common.join('/')}/ (${unique.length} files)`;
  return `${unique[0]} + ${unique.length - 1} more`;
}

function typeCell(type) {
  const t = TYPES[type];
  return t.color(`${t.icon} ${t.label.padEnd(7)}`);
}

function createInstallUI({ version, targetDir }) {
  const interactive = isInteractive();
  const startedAt = Date.now();
  let nameWidth = 0;

  const line = (text = '') => console.log(text);
  const railLine = (text = '') => console.log(text ? `${RAIL}  ${text}` : RAIL);

  function header() {
    if (interactive) {
      line('');
      line(`${ORANGE.bold(`${S_STEP_ACTIVE} Claude Code Templates`)} ${chalk.gray(`v${version} · aitmpl.com`)}`);
      railLine();
    } else {
      line(`Claude Code Templates v${version}`);
    }
  }

  function plan(items) {
    nameWidth = Math.max(9, ...items.map(i => i.name.length)) + 2;
    const noun = items.length === 1 ? 'component' : 'components';
    if (!interactive) {
      line(`Plan: ${items.length} ${noun}`);
      for (const item of items) line(`  ${item.type.padEnd(8)} ${item.name}`);
      return;
    }
    line(`${ORANGE_LIGHT(S_STEP_SUBMIT)}  ${chalk.bold('Plan')} ${chalk.gray(`· ${items.length} ${noun}`)}`);
    railLine();
    railLine(chalk.gray(`${'TYPE'.padEnd(10)} ${'COMPONENT'.padEnd(nameWidth)} WRITES`));
    for (const item of items) {
      railLine(`${typeCell(item.type)}  ${chalk.bold(item.name.padEnd(nameWidth))} ${chalk.gray(WRITES[item.type])}`);
    }
    railLine();
  }

  async function chooseLocations({ skipPrompt }) {
    if (skipPrompt || !interactive) {
      const msg = skipPrompt ? 'Local (default with --yes)' : 'Local (default, no terminal to ask)';
      if (interactive) {
        line(`${ORANGE_LIGHT(S_STEP_SUBMIT)}  Settings and hooks go to ${chalk.gray(msg)}`);
        railLine();
      } else {
        line(`Location: ${msg.toLowerCase()}`);
      }
      return ['local'];
    }

    const { MultiSelectPrompt, isCancel } = require('@clack/core');
    const labelWidth = Math.max(...LOCATIONS.map(l => l.label.length)) + 1;
    const fileWidth = Math.max(...LOCATIONS.map(l => l.file.length)) + 1;
    const question = 'Where should settings and hooks go?';

    // Custom render on clack's core prompt: paths stay visible on every row,
    // and the submitted answer collapses to the chosen labels only.
    const prompt = new MultiSelectPrompt({
      options: LOCATIONS,
      initialValues: ['local'],
      required: true,
      render() {
        const chosen = this.value || [];
        if (this.state === 'submit') {
          const names = LOCATIONS.filter(l => chosen.includes(l.value)).map(l => l.label).join(', ');
          return `${ORANGE_LIGHT(S_STEP_SUBMIT)}  ${question} ${chalk.gray(names)}`;
        }
        if (this.state === 'cancel') {
          return `${chalk.red(S_STEP_ACTIVE)}  ${chalk.strikethrough.gray(question)}`;
        }
        const bar = this.state === 'error' ? chalk.yellow(S_BAR) : chalk.cyan(S_BAR);
        const rows = LOCATIONS.map((l, i) => {
          const active = i === this.cursor;
          const selected = chosen.includes(l.value);
          const box = selected ? chalk.green(unicodeOr('◼', '[+]')) : active ? chalk.cyan(unicodeOr('◻', '[ ]')) : chalk.gray(unicodeOr('◻', '[ ]'));
          const name = active ? chalk.cyan.underline(l.label) + ' '.repeat(labelWidth - l.label.length) : (selected ? l.label.padEnd(labelWidth) : chalk.gray(l.label.padEnd(labelWidth)));
          return `${bar}  ${box} ${name}${chalk.gray(`${l.file.padEnd(fileWidth)}· ${l.hint}`)}`;
        });
        const footer = this.state === 'error'
          ? chalk.yellow('Select at least one location (space).')
          : chalk.gray('space select · a all · enter confirm');
        return [
          `${chalk.cyan(S_STEP_ACTIVE)}  ${chalk.bold(question)}`,
          ...rows,
          `${this.state === 'error' ? chalk.yellow(S_BAR_END) : chalk.cyan(S_BAR_END)}  ${footer}`
        ].join('\n');
      }
    });
    const selected = await prompt.prompt();

    if (isCancel(selected)) {
      line(`${chalk.gray(S_BAR_END)}  ${chalk.yellow('Installation cancelled.')}`);
      process.exit(0);
    }
    railLine();
    return selected;
  }

  /**
   * Run one installer with its console output captured. `fn` receives an
   * `onWrite(absPath)` callback the installers call for every file they write.
   * The installer's return value decides success (truthy / > 0).
   */
  async function runStep(item, fn) {
    const files = [];
    const captured = [];
    const original = { log: console.log, warn: console.warn, error: console.error, info: console.info };
    const capture = (...args) => { captured.push(stripAnsi(args.map(String).join(' '))); };

    const label = `${typeCell(item.type)}  ${item.name.padEnd(nameWidth)}`;
    let frame = 0;
    let timer = null;

    const drawSpinner = () => {
      process.stdout.write(`\r\u001b[2K${RAIL}  ${chalk.cyan(SPINNER_FRAMES[frame++ % SPINNER_FRAMES.length])} ${label} ${chalk.gray(unicodeOr('installing…', 'installing...'))}`);
    };
    const startSpinner = () => {
      if (!interactive) return;
      drawSpinner();
      timer = setInterval(drawSpinner, 90);
    };
    const stopSpinner = () => {
      if (timer) clearInterval(timer);
      timer = null;
      if (interactive) process.stdout.write('\r\u001b[2K');
    };

    // An installer may still ask a question (e.g. a setting that conflicts with
    // an existing value). Pause the spinner, show the warnings that led to it,
    // and resume once answered.
    const inquirer = require('inquirer');
    const originalPrompt = inquirer.prompt;
    let shownUpTo = 0;
    inquirer.prompt = async (...args) => {
      stopSpinner();
      const context = captured.slice(shownUpTo).filter(l => /⚠|^\s+•/.test(l));
      shownUpTo = captured.length;
      Object.assign(console, original);
      for (const l of context) original.log(interactive ? `${RAIL}  ${chalk.yellow(l.trim().replace(/^⚠\uFE0F?\s*/, '▲ '))}` : l.trim());
      try {
        return await originalPrompt.apply(inquirer, args);
      } finally {
        Object.assign(console, { log: capture, warn: capture, error: capture, info: capture });
        startSpinner();
      }
    };

    const stepStart = Date.now();
    let result;
    let thrown = null;
    Object.assign(console, { log: capture, warn: capture, error: capture, info: capture });
    startSpinner();
    try {
      result = await fn(absPath => files.push(absPath));
    } catch (error) {
      thrown = error;
    } finally {
      stopSpinner();
      Object.assign(console, original);
      inquirer.prompt = originalPrompt;
    }

    const ok = !thrown && (typeof result === 'number' ? result > 0 : Boolean(result));
    const seconds = ((Date.now() - stepStart) / 1000).toFixed(1);
    let detail;
    if (ok) {
      detail = describeWrites(files, targetDir) || 'done';
    } else {
      const errorLine = thrown ? thrown.message : [...captured].reverse().find(l => /❌|error|could not|failed/i.test(l));
      detail = errorLine ? errorLine.replace(/^[^\w"]*/, '').replace(/^(.*[^(]*)\)$/, (m, inner) => (inner.includes('(') ? m : inner)).trim() : 'failed';
    }

    if (interactive) {
      const mark = ok ? chalk.green(S_OK) : chalk.red(S_FAIL);
      // Keep each row on one line: shorten the detail to the terminal width.
      const used = stripAnsi(`${S_BAR}  ${S_OK} ${label} `).length;
      const room = (process.stdout.columns || 100) - used - 1;
      let time = ` ${seconds}s`;
      if (detail.length + time.length > room) time = '';
      const shown = detail.length > room ? `…${detail.slice(detail.length - Math.max(room - 1, 8))}` : detail;
      const text = ok ? chalk.gray(shown) : chalk.red(shown);
      railLine(`${mark} ${label} ${text}${chalk.gray.dim(time)}`);
    } else {
      line(`  ${ok ? 'ok  ' : 'FAIL'} ${item.type.padEnd(8)} ${item.name.padEnd(nameWidth)} ${detail}`);
    }

    return { ok, files, detail };
  }

  function summary(results, items) {
    const installed = results.filter(r => r.ok).length;
    const failed = results.length - installed;
    const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
    const failedItems = items.filter((_, i) => !results[i].ok);

    if (!interactive) {
      line(`Installed ${installed} of ${results.length} · ${failed} failed · ${seconds}s`);
      for (const item of failedItems) line(`Retry: npx claude-code-templates@latest --${item.type} ${item.name}`);
      return;
    }

    railLine();
    if (failed === 0) {
      line(`${chalk.green(S_BAR_END)}  ${chalk.green.bold(`Installed ${installed} of ${results.length}`)} ${chalk.gray(`· 0 failed · ${seconds}s`)}`);
      line(`   ${chalk.gray('Next:')} run ${chalk.cyan('claude')} in this folder to use them.`);
    } else {
      const color = installed > 0 ? chalk.yellow : chalk.red;
      line(`${color(S_BAR_END)}  ${color.bold(`Installed ${installed} of ${results.length}`)} ${chalk.gray('·')} ${chalk.red(`${failed} failed`)} ${chalk.gray(`· ${seconds}s`)}`);
      const retry = failedItems.map(item => `--${item.type} ${item.name}`).join(' ');
      line(`   ${chalk.gray(failedItems.length === 1 ? 'Retry the failed one:' : 'Retry the failed ones:')} ${chalk.cyan(`npx claude-code-templates@latest ${retry}`)}`);
    }
    line('');
  }

  function note(text) {
    if (interactive) railLine(chalk.gray(text)); else line(text);
  }

  return { interactive, header, plan, chooseLocations, runStep, summary, note };
}

module.exports = { createInstallUI, describeWrites, displayPath, TYPES };
