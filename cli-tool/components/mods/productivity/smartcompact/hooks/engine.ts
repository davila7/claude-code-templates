import type {
  AgentInfo,
  CommandSpec,
  FsEntry,
  FsStat,
  ModelCompleteRequest,
  ModelCompleteResult,
  PromptBox,
  PromptFillArgs,
  PromptFilled,
  PromptSubmitArgs,
  PromptSubmitResult,
  SessionAppendResult,
  SessionCompactArgs,
  SessionCompactResult,
  SessionMessage,
  SessionUsage,
  TimerCall,
} from 'claude-code';

/**
 * The engine calls this plugin makes. The engine refuses a module that passes `$` around,
 * so register.ts binds each call from `$` and the other files get this.
 */
export type Engine = {
  /** The plugin's folder, where its shipped files sit. */
  pluginRoot: () => string;
  now: () => Promise<number>;
  after: TimerCall;
  status: (text: string | undefined) => void;
  sessionId: () => Promise<string>;
  cwd: () => Promise<string>;
  usage: () => Promise<SessionUsage>;
  messages: () => Promise<SessionMessage[]>;
  agents: () => Promise<AgentInfo[]>;
  readPrompt: () => Promise<PromptBox>;
  fillPrompt: (input: PromptFillArgs) => Promise<PromptFilled>;
  submitPrompt: (input: PromptSubmitArgs) => Promise<PromptSubmitResult>;
  /** Adds a user row the model reads and the person does not see as typed. */
  appendNote: (text: string) => Promise<SessionAppendResult>;
  compact: (args: SessionCompactArgs) => Promise<SessionCompactResult>;
  registerCommand: (command: CommandSpec) => Promise<{ command: string }>;
  complete: (request: ModelCompleteRequest) => Promise<ModelCompleteResult>;
  fs: {
    exists: (path: string) => Promise<boolean>;
    list: (path: string) => Promise<FsEntry[]>;
    stat: (path: string) => Promise<FsStat>;
    read: (path: string) => Promise<string>;
    write: (path: string, text: string) => Promise<void>;
  };
  store: {
    get: (key: string) => Promise<unknown>;
    set: (key: string, value: unknown) => Promise<void>;
    delete: (key: string) => Promise<void>;
  };
  env: {
    configDir: () => Promise<string | undefined>;
    logFile: () => Promise<string | undefined>;
    userProfile: () => Promise<string | undefined>;
    home: () => Promise<string | undefined>;
  };
};
