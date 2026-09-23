/**
 * jev-pilot — the plugin's one hooks module.
 *
 * Claude Code loads a single hooks module per plugin, so this entry registers
 * both mods on the same `on` and the same options: the model router first,
 * then the skill suggester. Each keeps its own handlers and state; on the
 * events both hook (`prompt.submit`), the router's handler runs first and
 * hands the prompt on to the suggester's.
 *
 * Needs CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 and Claude Code >= 2.1.278.
 */
import type { Register } from 'claude-code'
import { register as registerModelRouter } from './jev-model-router.ts'
import { register as registerSkillSuggestion } from './jev-skill-suggestion.ts'

export const register: Register = (on, options) => {
  registerModelRouter(on, options)
  registerSkillSuggestion(on, options)
}
