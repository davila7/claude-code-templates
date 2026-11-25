// Skills over MCP (extension io.modelcontextprotocol/skills, protocol revision 2026-07-28).
// The skills are the Markdown files under skills/, bundled as text by wrangler ([[rules]] type = "Text"),
// so the served bytes are exactly those files. Clients on older revisions connect as before and see no skills.
import { SkillsExtension, memorySkillFiles } from '@modelcontextprotocol/server/ext/skills';
import componentReview from '../skills/component-review/SKILL.md';
import componentChecklist from '../skills/component-review/references/checklist.md';
import skillOverMcp from '../skills/skill-over-mcp/SKILL.md';
import skillServer from '../skills/skill-over-mcp/references/server.md';

/** Paths relative to the skills root; the SDK computes each file's digest and checks the frontmatter. */
export const SKILL_FILES: Record<string, string> = {
  'component-review/SKILL.md': componentReview,
  'component-review/references/checklist.md': componentChecklist,
  'skill-over-mcp/SKILL.md': skillOverMcp,
  'skill-over-mcp/references/server.md': skillServer,
};

export const SKILL_NAMES = Object.keys(SKILL_FILES).filter((p) => p.endsWith('/SKILL.md')).map((p) => p.split('/')[0]);

let loaded: Promise<SkillsExtension> | null = null;

/** strict: a bad frontmatter or a name that differs from its folder fails instead of serving fewer skills. */
export function loadSkills(): Promise<SkillsExtension> {
  loaded ??= SkillsExtension.load(memorySkillFiles(SKILL_FILES), {
    strict: true,
    cacheHint: { ttlMs: 300_000, cacheScope: 'public' },
  });
  return loaded;
}
