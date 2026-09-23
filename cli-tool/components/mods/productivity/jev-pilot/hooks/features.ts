/**
 * jev-pilot — what is switched on. Every part can be turned off on its own,
 * from the settings (defaults) or live with `/jev <feature> on|off`, which is
 * remembered in the plugin's store across sessions.
 *
 * Shared: the modules run in the plugin's one worker, so they all read these.
 */

export type Feature = 'effort' | 'raise' | 'subagents' | 'skills' | 'strategy' | 'model' | 'pet'

export const FEATURES: readonly Feature[] = ['effort', 'raise', 'subagents', 'skills', 'strategy', 'model', 'pet']

/** What each switch does, for `/jev`. */
export const FEATURE_INFO: Record<Feature, string> = {
  effort: 'sets the reasoning effort of each turn',
  raise: 'raises the effort when tool calls keep failing',
  subagents: 'picks each subagent’s model',
  skills: 'picks the one skill a prompt needs (off: the full skill list stays)',
  strategy: 'advises splitting big work across subagents',
  model: 'switches the main conversation’s model (resets the prompt cache)',
  pet: 'shows Claude the pilot above the prompt',
}

let defaults: Record<Feature, boolean> = {
  effort: true,
  raise: true,
  subagents: true,
  skills: true,
  strategy: true,
  model: false,
  pet: true,
}
let overrides: Partial<Record<Feature, boolean>> = {}

/** The defaults, from the plugin's options (once, when the plugin registers). */
export function initFeatures(from: Record<Feature, boolean>): void {
  defaults = { ...from }
  overrides = {}
}

export function feature(name: Feature): boolean {
  return overrides[name] ?? defaults[name]
}

export function setFeature(name: Feature, on: boolean): void {
  if (on === defaults[name]) delete overrides[name]
  else overrides[name] = on
}

/** What `/jev` changed, to keep in the store. */
export function featureOverrides(): Partial<Record<Feature, boolean>> {
  return { ...overrides }
}

/** Overrides read back from the store; anything that is not one is ignored. */
export function loadFeatureOverrides(stored: unknown): void {
  overrides = {}
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return
  for (const [name, on] of Object.entries(stored as Record<string, unknown>)) {
    if ((FEATURES as readonly string[]).includes(name) && typeof on === 'boolean') {
      setFeature(name as Feature, on)
    }
  }
}

export type JevCommand =
  | { kind: 'status' }
  | { kind: 'set'; features: Feature[]; on: boolean }
  | { kind: 'reset' }
  | { kind: 'unknown'; text: string }

/**
 * `/jev` arguments:
 *   (none)             what is on
 *   <feature> on|off   one switch
 *   all on|off         every switch
 *   on | off           the pet (a shortcut)
 *   reset              back to the settings' defaults
 */
export function parseJevCommand(args: string): JevCommand {
  const words = args.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return { kind: 'status' }
  if (words.length === 1 && words[0] === 'reset') return { kind: 'reset' }
  const onOff = (word: string | undefined) => (word === 'on' ? true : word === 'off' ? false : null)
  if (words.length === 1) {
    const on = onOff(words[0])
    return on === null ? { kind: 'unknown', text: words[0] as string } : { kind: 'set', features: ['pet'], on }
  }
  const on = onOff(words[1])
  if (on === null || words.length > 2) return { kind: 'unknown', text: args.trim() }
  if (words[0] === 'all') return { kind: 'set', features: [...FEATURES], on }
  if ((FEATURES as readonly string[]).includes(words[0] as string)) return { kind: 'set', features: [words[0] as Feature], on }
  return { kind: 'unknown', text: words[0] as string }
}

/** `/jev`'s answer: every switch with its state. */
export function describeFeatures(): string {
  const width = Math.max(...FEATURES.map((name) => name.length))
  return [
    'jev-pilot switches (/jev <name> on|off, /jev all on|off, /jev reset):',
    ...FEATURES.map((name) => `  ${feature(name) ? 'on ' : 'off'}  ${name.padEnd(width)}  ${FEATURE_INFO[name]}`),
  ].join('\n')
}
