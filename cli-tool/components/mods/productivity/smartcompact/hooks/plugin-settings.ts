import type { PluginOptions } from 'claude-code';

export type Settings = {
  minTokens: number;
  claudeModel: string;
};

/** Reads the userConfig values. The engine fills in the plugin.json defaults first. */
export function settingsFrom(options: PluginOptions): Settings {
  return {
    minTokens: Number(options['minTokens']),
    claudeModel: String(options['claudeModel']),
  };
}
