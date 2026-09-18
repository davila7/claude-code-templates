import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Animated Claude Code CLI terminal shown on every component detail page.
 *
 * It replays two phases: the `npx claude-code-templates@latest --<flag> <path>`
 * installation (the same lines the CLI prints in cli-tool/src/index.js) and a
 * short Claude Code session using the component that was just installed.
 *
 * The session is an illustrative demo, not a recording — the install phase
 * mirrors the real CLI output, the session phase shows how the component is
 * invoked once installed.
 */

type Tone = 'default' | 'gray' | 'green' | 'blue' | 'cyan' | 'yellow' | 'orange' | 'magenta';

const TONE_COLOR: Record<Tone, string> = {
  default: '#c9d1d9',
  gray: '#7d8590',
  green: '#3fb950',
  blue: '#58a6ff',
  cyan: '#39c5cf',
  yellow: '#d29922',
  orange: '#d57455',
  magenta: '#bc8cff',
};

type Step =
  /** Typed after a shell `$ ` prompt. */
  | { kind: 'cmd'; text: string }
  /** Typed after Claude Code's `> ` prompt. */
  | { kind: 'ask'; text: string }
  /** Printed instantly. */
  | { kind: 'out'; text: string; tone?: Tone }
  /** Spinner for `ms`, then replaced by `done`. */
  | { kind: 'work'; text: string; done: string; tone?: Tone; ms?: number }
  /** Claude Code's welcome panel, drawn with CSS rather than box characters. */
  | { kind: 'welcome'; cwd: string }
  | { kind: 'wait'; ms: number };

type Rendered =
  | { type: 'line'; text: string; tone: Tone }
  | { type: 'welcome'; cwd: string };

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

const TYPE_SPEED = 38; // ms per character
const LINE_PAUSE = 190; // ms between printed lines

export interface ComponentTerminalProps {
  /** Plural type key: skills, agents, commands, mcps, hooks, settings, mods, loops. */
  typePlural: string;
  /** Display name, e.g. "Frontend Design". */
  title: string;
  /** Clean component path without extension, e.g. "creative-design/frontend-design". */
  path: string;
  /** Full install command as shown in the sidebar. */
  installCmd: string;
  /** MCP server name or hook event, when the component declares one. */
  detail?: string;
  /** Number of files shipped with a skill/mod, when known. */
  fileCount?: number;
}

function baseName(path: string): string {
  return path.split('/').pop() ?? path;
}

function claudeBox(cwd = '~/projects/my-app'): Step[] {
  return [
    { kind: 'welcome', cwd },
    { kind: 'out', text: '' },
  ];
}

/** Build the replay script for a component type. */
function buildScript(props: ComponentTerminalProps): Step[] {
  const { typePlural, title, path, installCmd, detail, fileCount } = props;
  const name = baseName(path);
  const files = fileCount && fileCount > 0 ? fileCount : 3;

  const install: Step[] = [{ kind: 'cmd', text: installCmd }, { kind: 'out', text: '' }];
  const run: Step[] = [];

  switch (typePlural) {
    case 'skills':
      install.push(
        { kind: 'out', text: `💡 Installing skill: ${path}`, tone: 'blue' },
        { kind: 'out', text: '📥 Downloading skill from GitHub (main branch)...', tone: 'gray' },
        { kind: 'work', text: 'Fetching files', done: '✓ Downloaded: SKILL.md', tone: 'green' },
        { kind: 'out', text: '✓ Downloaded: references/', tone: 'green' },
        { kind: 'out', text: `✅ Skill "${path}" installed successfully!`, tone: 'green' },
        { kind: 'out', text: `📁 Installed to: .claude/skills/${name}/SKILL.md`, tone: 'cyan' },
        { kind: 'out', text: `📄 Total files downloaded: ${files}`, tone: 'cyan' },
      );
      run.push(
        { kind: 'cmd', text: 'claude' },
        ...claudeBox(),
        { kind: 'ask', text: `Use the ${name} skill on this project` },
        { kind: 'out', text: '' },
        { kind: 'out', text: `⏺ Skill(${name})`, tone: 'magenta' },
        { kind: 'out', text: `  ⎿  Loaded .claude/skills/${name}/SKILL.md`, tone: 'gray' },
        { kind: 'work', text: `Applying ${title}`, done: '  ⎿  Updated 3 files', tone: 'gray', ms: 1500 },
        { kind: 'out', text: '⏺ Done.', tone: 'green' },
      );
      break;

    case 'agents':
      install.push(
        { kind: 'out', text: `🤖 Installing agent: ${path}`, tone: 'blue' },
        { kind: 'out', text: '📥 Downloading from GitHub (main branch)...', tone: 'gray' },
        { kind: 'work', text: 'Writing agent', done: `✅ Agent "${path}" installed successfully!`, tone: 'green' },
        { kind: 'out', text: `📁 Installed to: .claude/agents/${name}.md`, tone: 'cyan' },
      );
      run.push(
        { kind: 'cmd', text: 'claude' },
        ...claudeBox(),
        { kind: 'ask', text: `Use the ${name} agent to review this codebase` },
        { kind: 'out', text: '' },
        { kind: 'out', text: `⏺ Task(${name})`, tone: 'magenta' },
        { kind: 'work', text: 'Agent running', done: '  ⎿  Done (14 tool uses · 32.4k tokens)', tone: 'gray', ms: 1600 },
        { kind: 'out', text: '⏺ Report ready.', tone: 'green' },
      );
      break;

    case 'commands':
      install.push(
        { kind: 'out', text: `⚡ Installing command: ${path}`, tone: 'blue' },
        { kind: 'out', text: '📥 Downloading from GitHub (main branch)...', tone: 'gray' },
        { kind: 'work', text: 'Writing command', done: `✅ Command "${path}" installed successfully!`, tone: 'green' },
        { kind: 'out', text: `📁 Installed to: .claude/commands/${name}.md`, tone: 'cyan' },
      );
      run.push(
        { kind: 'cmd', text: 'claude' },
        ...claudeBox(),
        { kind: 'ask', text: `/${name}` },
        { kind: 'out', text: '' },
        { kind: 'out', text: `⏺ Command(${name})`, tone: 'magenta' },
        { kind: 'out', text: `  ⎿  Loaded .claude/commands/${name}.md`, tone: 'gray' },
        { kind: 'work', text: 'Running', done: '  ⎿  Finished in 8.2s', tone: 'gray', ms: 1400 },
        { kind: 'out', text: '⏺ Done.', tone: 'green' },
      );
      break;

    case 'mcps': {
      const server = detail || name;
      install.push(
        { kind: 'out', text: `🔌 Installing MCP: ${path}`, tone: 'blue' },
        { kind: 'out', text: '📥 Downloading from GitHub (main branch)...', tone: 'gray' },
        { kind: 'out', text: '📝 Existing .mcp.json found, merging configurations...', tone: 'yellow' },
        { kind: 'work', text: 'Merging config', done: `✅ MCP "${path}" installed successfully!`, tone: 'green' },
        { kind: 'out', text: '📁 Configuration merged into: .mcp.json', tone: 'cyan' },
      );
      run.push(
        { kind: 'cmd', text: 'claude' },
        ...claudeBox(),
        { kind: 'ask', text: '/mcp' },
        { kind: 'out', text: '' },
        { kind: 'out', text: 'MCP servers', tone: 'gray' },
        { kind: 'work', text: `Connecting to ${server}`, done: `  ${server}  ✔ connected`, tone: 'green', ms: 1400 },
        { kind: 'out', text: '' },
        { kind: 'out', text: `⏺ ${server} tools are available in this session.`, tone: 'magenta' },
      );
      break;
    }

    case 'hooks': {
      const event = detail || 'PreToolUse';
      install.push(
        { kind: 'out', text: `🪝 Installing hook: ${path}`, tone: 'blue' },
        { kind: 'out', text: '📥 Downloading from GitHub (main branch)...', tone: 'gray' },
        { kind: 'out', text: '📍 Installing in project settings...', tone: 'blue' },
        { kind: 'work', text: 'Merging config', done: `✅ Hook "${path}" installed successfully in project!`, tone: 'green' },
        { kind: 'out', text: '📁 Configuration merged into: .claude/settings.json', tone: 'cyan' },
      );
      // The scene has to match when the hook actually fires, otherwise the
      // demo shows a SessionStart hook running "before the tool".
      if (event === 'SessionStart' || event === 'SessionEnd' || event === 'PreCompact') {
        run.push(
          { kind: 'cmd', text: 'claude' },
          { kind: 'work', text: `Running ${event} hooks`, done: `⏺ ${event}:${name}`, tone: 'magenta', ms: 1300 },
          { kind: 'out', text: `  ⎿  hook ran on ${event}`, tone: 'gray' },
          { kind: 'out', text: '' },
          ...claudeBox(),
          { kind: 'ask', text: 'Continue with the task' },
          { kind: 'out', text: '' },
          { kind: 'out', text: `⏺ ${title} is active in this session.`, tone: 'green' },
        );
      } else if (event === 'UserPromptSubmit') {
        run.push(
          { kind: 'cmd', text: 'claude' },
          ...claudeBox(),
          { kind: 'ask', text: 'Refactor the auth module' },
          { kind: 'out', text: '' },
          { kind: 'work', text: `${event} hook`, done: `⏺ ${event}:${name}`, tone: 'magenta', ms: 1300 },
          { kind: 'out', text: '  ⎿  hook ran on the prompt', tone: 'gray' },
          { kind: 'out', text: '⏺ Working on it…', tone: 'green' },
        );
      } else if (event === 'Stop' || event === 'SubagentStop' || event === 'Notification') {
        run.push(
          { kind: 'cmd', text: 'claude' },
          ...claudeBox(),
          { kind: 'ask', text: 'Run the test suite' },
          { kind: 'out', text: '' },
          { kind: 'out', text: '⏺ Bash(npm test)', tone: 'magenta' },
          { kind: 'out', text: '  ⎿  42 tests passed', tone: 'green' },
          { kind: 'work', text: `${event} hook`, done: `⏺ ${event}:${name}`, tone: 'magenta', ms: 1300 },
          { kind: 'out', text: `  ⎿  hook ran on ${event}`, tone: 'gray' },
        );
      } else {
        run.push(
          { kind: 'cmd', text: 'claude' },
          ...claudeBox(),
          { kind: 'ask', text: 'Run the test suite' },
          { kind: 'out', text: '' },
          { kind: 'out', text: '⏺ Bash(npm test)', tone: 'magenta' },
          { kind: 'work', text: `${event} hook`, done: `  ⎿  ${event}:${name} ran on the tool call`, tone: 'gray', ms: 1400 },
          { kind: 'out', text: '  ⎿  42 tests passed', tone: 'green' },
        );
      }
      break;
    }

    case 'settings':
      install.push(
        { kind: 'out', text: `⚙️  Installing setting: ${path}`, tone: 'blue' },
        { kind: 'out', text: '📥 Downloading from GitHub (main branch)...', tone: 'gray' },
        { kind: 'out', text: '📍 Installing in project settings...', tone: 'blue' },
        { kind: 'work', text: 'Merging config', done: `✅ Setting "${path}" installed successfully in project!`, tone: 'green' },
        { kind: 'out', text: '📁 Configuration merged into: .claude/settings.json', tone: 'cyan' },
      );
      run.push(
        { kind: 'cmd', text: 'claude' },
        ...claudeBox(),
        { kind: 'ask', text: '/config' },
        { kind: 'out', text: '' },
        { kind: 'work', text: 'Reading settings', done: `  ${title}  ✔ active`, tone: 'green', ms: 1300 },
        { kind: 'out', text: '  source: .claude/settings.json', tone: 'gray' },
      );
      break;

    case 'mods':
      install.push(
        { kind: 'out', text: `ƒ  Installing mod: ${path}`, tone: 'blue' },
        { kind: 'out', text: '⚠️  Early access: mods need CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1', tone: 'yellow' },
        { kind: 'out', text: '📥 Downloading from GitHub (main branch)...', tone: 'gray' },
        { kind: 'work', text: 'Fetching plugin', done: '✓ .claude-plugin/plugin.json', tone: 'green' },
        { kind: 'out', text: '✓ hooks/hooks.json', tone: 'green' },
        { kind: 'out', text: `✅ Mod "${path}" installed successfully!`, tone: 'green' },
        { kind: 'out', text: `📁 Installed to: .claude/skills/${name}/  (${files} files)`, tone: 'cyan' },
      );
      run.push(
        { kind: 'cmd', text: 'CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude' },
        ...claudeBox(),
        { kind: 'work', text: 'Loading plugins', done: `⏺ ${name}@skills-dir loaded`, tone: 'magenta', ms: 1400 },
        { kind: 'out', text: '  ⎿  function hooks registered', tone: 'gray' },
        { kind: 'out', text: '' },
        { kind: 'ask', text: 'Continue with the task' },
        { kind: 'out', text: '' },
        { kind: 'out', text: `⏺ ${title} is now hooking engine events.`, tone: 'green' },
      );
      break;

    case 'loops':
      install.push(
        { kind: 'out', text: `🔁 Installing loop: ${path}`, tone: 'blue' },
        { kind: 'out', text: '📥 Downloading from GitHub (main branch)...', tone: 'gray' },
        { kind: 'work', text: 'Writing loop', done: `✅ Loop "${path}" installed successfully!`, tone: 'green' },
        { kind: 'out', text: '🧩 Installing referenced component(s) for this loop...', tone: 'blue' },
        { kind: 'out', text: '   ✓ referenced components installed', tone: 'green' },
        { kind: 'out', text: `📁 Installed to: .claude/loops/${name}.md`, tone: 'cyan' },
      );
      run.push(
        { kind: 'cmd', text: 'claude' },
        ...claudeBox(),
        { kind: 'ask', text: `/loop ${name}` },
        { kind: 'out', text: '' },
        { kind: 'out', text: `⏺ Loop(${name})`, tone: 'magenta' },
        { kind: 'work', text: 'Iteration 1', done: '  ⎿  iteration 1 complete', tone: 'gray', ms: 1400 },
        { kind: 'out', text: '  ⎿  waiting for next interval…', tone: 'gray' },
      );
      break;

    default:
      install.push(
        { kind: 'out', text: `📦 Installing component: ${path}`, tone: 'blue' },
        { kind: 'out', text: '📥 Downloading from GitHub (main branch)...', tone: 'gray' },
        { kind: 'work', text: 'Installing', done: `✅ "${path}" installed successfully!`, tone: 'green' },
      );
      run.push(
        { kind: 'cmd', text: 'claude' },
        ...claudeBox(),
        { kind: 'out', text: `⏺ ${title} is ready to use.`, tone: 'green' },
      );
  }

  return [...install, { kind: 'wait', ms: 700 }, { kind: 'out', text: '' }, ...run];
}

export default function ComponentTerminal(props: ComponentTerminalProps) {
  const script = useMemo(() => buildScript(props), [props]);

  const [lines, setLines] = useState<Rendered[]>([]);
  const [typing, setTyping] = useState<{ prefix: string; text: string } | null>(null);
  const [finished, setFinished] = useState(false);
  const [runId, setRunId] = useState(0);
  const [started, setStarted] = useState(false);

  const bodyRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Start once the terminal scrolls into view (and only then).
  useEffect(() => {
    const el = rootRef.current;
    if (!el || started) return;
    if (typeof IntersectionObserver === 'undefined') {
      setStarted(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setStarted(true);
          io.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started) return;

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    // Reduced motion: print the whole transcript at once, no animation.
    if (reduced) {
      const all: Rendered[] = [];
      for (const step of script) {
        if (step.kind === 'cmd') all.push({ type: 'line', text: `$ ${step.text}`, tone: 'default' });
        else if (step.kind === 'ask') all.push({ type: 'line', text: `> ${step.text}`, tone: 'default' });
        else if (step.kind === 'out') all.push({ type: 'line', text: step.text, tone: step.tone ?? 'default' });
        else if (step.kind === 'work') all.push({ type: 'line', text: step.done, tone: step.tone ?? 'default' });
        else if (step.kind === 'welcome') all.push({ type: 'welcome', cwd: step.cwd });
      }
      setLines(all);
      setTyping(null);
      setFinished(true);
      return;
    }

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const intervals: ReturnType<typeof setInterval>[] = [];

    setLines([]);
    setTyping(null);
    setFinished(false);

    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        timers.push(setTimeout(resolve, ms));
      });

    async function typeText(prefix: string, text: string) {
      for (let i = 0; i <= text.length; i++) {
        if (cancelled) return;
        setTyping({ prefix, text: text.slice(0, i) });
        await sleep(TYPE_SPEED);
      }
      if (cancelled) return;
      setTyping(null);
      setLines((prev) => [...prev, { type: 'line', text: `${prefix}${text}`, tone: 'default' }]);
    }

    async function spin(label: string, done: string, tone: Tone, ms: number) {
      let frame = 0;
      setLines((prev) => [...prev, { type: 'line', text: `${SPINNER_FRAMES[0]} ${label}…`, tone: 'gray' }]);
      const interval = setInterval(() => {
        frame = (frame + 1) % SPINNER_FRAMES.length;
        setLines((prev) => {
          if (prev.length === 0) return prev;
          const next = [...prev];
          next[next.length - 1] = { type: 'line', text: `${SPINNER_FRAMES[frame]} ${label}…`, tone: 'gray' };
          return next;
        });
      }, 80);
      intervals.push(interval);
      await sleep(ms);
      clearInterval(interval);
      if (cancelled) return;
      setLines((prev) => {
        if (prev.length === 0) return prev;
        const next = [...prev];
        next[next.length - 1] = { type: 'line', text: done, tone };
        return next;
      });
    }

    (async () => {
      await sleep(500);
      for (const step of script) {
        if (cancelled) return;
        if (step.kind === 'cmd') {
          await typeText('$ ', step.text);
          await sleep(400);
        } else if (step.kind === 'ask') {
          await typeText('> ', step.text);
          await sleep(500);
        } else if (step.kind === 'out') {
          setLines((prev) => [...prev, { type: 'line', text: step.text, tone: step.tone ?? 'default' }]);
          await sleep(step.text === '' ? 80 : LINE_PAUSE);
        } else if (step.kind === 'welcome') {
          setLines((prev) => [...prev, { type: 'welcome', cwd: step.cwd }]);
          await sleep(450);
        } else if (step.kind === 'work') {
          await spin(step.text, step.done, step.tone ?? 'default', step.ms ?? 1200);
          await sleep(LINE_PAUSE);
        } else if (step.kind === 'wait') {
          await sleep(step.ms);
        }
      }
      if (!cancelled) setFinished(true);
    })();

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      intervals.forEach(clearInterval);
    };
  }, [script, runId, started]);

  // Keep the newest line visible.
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, typing]);

  return (
    <div
      ref={rootRef}
      className="relative flex h-full min-h-[380px] flex-col overflow-hidden rounded-2xl border border-[#30363d] bg-[#0d1117] shadow-2xl"
    >
      {/* Title bar */}
      <div className="flex items-center gap-3 border-b border-[#30363d] bg-[#161b22] px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        </div>
        <span className="flex-1 truncate text-center font-mono text-[11px] text-[#7d8590]">
          claude-code — {baseName(props.path)}
        </span>
        <button
          type="button"
          onClick={() => {
            setStarted(true);
            setRunId((n) => n + 1);
          }}
          className="flex items-center gap-1.5 rounded-md border border-[#30363d] px-2 py-1 font-mono text-[10px] text-[#7d8590] transition-colors hover:border-[#d57455] hover:text-[#d57455]"
          aria-label="Replay terminal animation"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 11-2.64-6.36" />
            <polyline points="21 3 21 8 16 8" />
          </svg>
          Replay
        </button>
      </div>

      {/* Body */}
      <div
        ref={bodyRef}
        className="flex-1 overflow-y-auto px-4 py-3.5 font-mono text-[12px] leading-[1.75] [scrollbar-color:#30363d_transparent] [scrollbar-width:thin]"
      >
        {lines.map((item, i) =>
          item.type === 'welcome' ? (
            <div
              key={i}
              className="my-2 rounded-lg px-3 py-2"
              style={{ border: '1px solid rgba(213, 116, 85, 0.5)', background: 'rgba(213, 116, 85, 0.07)' }}
            >
              <div style={{ color: TONE_COLOR.orange }}>&#10043; Welcome to Claude Code</div>
              <div className="mt-1.5" style={{ color: TONE_COLOR.gray }}>cwd: {item.cwd}</div>
            </div>
          ) : (
            <div key={i} className="whitespace-pre-wrap break-words" style={{ color: TONE_COLOR[item.tone] }}>
              {item.text || '\u00a0'}
            </div>
          ),
        )}
        {typing && (
          <div className="whitespace-pre-wrap break-words text-[#c9d1d9]">
            <span style={{ color: typing.prefix === '> ' ? TONE_COLOR.orange : TONE_COLOR.green }}>
              {typing.prefix}
            </span>
            {typing.text}
            <span className="cct-caret">▋</span>
          </div>
        )}
        {finished && (
          <div className="text-[#c9d1d9]">
            <span style={{ color: TONE_COLOR.green }}>$ </span>
            <span className="cct-caret">▋</span>
          </div>
        )}
      </div>

      <style>{`
        @keyframes cct-caret-blink { 0%, 49% { opacity: 1 } 50%, 100% { opacity: 0 } }
        .cct-caret { animation: cct-caret-blink 1s steps(1) infinite; }
        @media (prefers-reduced-motion: reduce) { .cct-caret { animation: none } }
      `}</style>
    </div>
  );
}
