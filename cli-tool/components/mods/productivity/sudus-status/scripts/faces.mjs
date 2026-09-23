// Rewrites hooks/faces.ts from blobatar.dev: the face for "sudus" in the six expressions the mod
// uses. Blobatar is deterministic, so a run changes nothing unless blobatar's own drawing changed.
// Run with: node scripts/faces.mjs
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const EXPRESSIONS = ['idle', 'happy', 'sad', 'mad', 'sick', 'thinking']
const url = (x) => `https://blobatar.dev/avatar/sudus?background=squircle&expression=${x}`

const svgs = {}
for (const x of EXPRESSIONS) {
  const res = await fetch(url(x))
  const text = (await res.text()).trim()
  if (!res.ok || !text.startsWith('<svg') || text.includes('`') || text.includes('${')) throw new Error(`${url(x)}: unexpected response ${res.status}`)
  svgs[x] = text
}

const lines = [
  '// The face for the name "sudus" in six expressions, from',
  '// https://blobatar.dev/avatar/sudus?background=squircle&expression=<name> (blobatar by Alain00,',
  '// MIT): deterministic geometry, so these are the same bytes every time. Another `face` option',
  '// fetches its six expressions the same way at session start. scripts/faces.mjs rewrites this file.',
  '',
  "export type Expression = 'idle' | 'happy' | 'sad' | 'mad' | 'sick' | 'thinking'",
  '',
  "export const EXPRESSIONS: readonly Expression[] = ['idle', 'happy', 'sad', 'mad', 'sick', 'thinking']",
  '',
  'export const SUDUS_SVG: Record<Expression, string> = {',
  ...EXPRESSIONS.map((x) => `  ${x}: \`${svgs[x]}\`,`),
  '}',
  '',
]
writeFileSync(fileURLToPath(new URL('../hooks/faces.ts', import.meta.url)), lines.join('\n'))
console.log('hooks/faces.ts rewritten')
