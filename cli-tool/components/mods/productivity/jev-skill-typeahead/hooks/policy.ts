/**
 * jev-skill-typeahead — the pure part: what the draft in the prompt box means
 * and which skills and subagents it points at. No `$` in here; the hook module
 * does the I/O and these functions are what the tests exercise.
 *
 * Only what the MODEL calls on its own is a candidate: skills (through the
 * Skill tool) and subagent types (through the Agent tool). Slash commands the
 * person runs by typing `/name` are not: nothing needs to guess those. A draft
 * that starts with `/`, `!` or `#` is a command, a shell line or a memory note
 * and gets no band.
 *
 * The keyword match is deliberately plain (IDF-weighted term overlap, name
 * hits worth 2.5x a description hit, the word still being typed matched as a
 * prefix): it runs on every keystroke with no network. Deciding which one the
 * model WILL call is Jev's job once the person pauses (see jev.ts).
 */
import type { Origin, Row } from '../types'

export interface Skill {
  name: string
  description: string
  origin: Origin
}

/** What the draft is, as far as the band is concerned. */
export interface Draft {
  mode: 'idle' | 'prose'
  /** The prose to match: code fences and URLs removed, the tail kept. */
  prose: string
}

const IDLE: Draft = { mode: 'idle', prose: '' }

/** Words of a prompt that point at nothing, English and Spanish. */
const STOP = new Set(
  (
    'a about all also an and any are as at be been but by can could do does for from had has have how i if in into is it its just like make me my no not of on one or our out please so some that the their them then there these they this to up us use was we what when where which who will with would you your ' +
    'al algo ahora aqui asi aunque como con cual cuando de del desde donde el ella ellos en es esa ese eso esta este esto estoy fue ha hay hacer hace la las le les lo los mas me mi muy nos para pero por porque que quiero se si sin sobre son su sus te tiene tu tus un una uno unos van ver voy ya yo'
  ).split(' '),
)

/** A Spanish word and the English words skills are described in. */
const ALIASES: Record<string, string> = {
  prueba: 'test', pruebas: 'test', probar: 'test', testear: 'test',
  documento: 'document doc', documentos: 'document doc', documentacion: 'documentation docs',
  presentacion: 'presentation slides deck pptx', presentaciones: 'presentation slides deck pptx', diapositivas: 'slides deck pptx',
  hoja: 'spreadsheet xlsx', planilla: 'spreadsheet xlsx', calculo: 'spreadsheet xlsx', excel: 'spreadsheet xlsx',
  revisar: 'review', revision: 'review', revisa: 'review',
  arreglar: 'fix bug', corregir: 'fix bug', arregla: 'fix bug', error: 'error bug', errores: 'error bug', falla: 'bug failure',
  seguridad: 'security', vulnerabilidad: 'security vulnerability', vulnerabilidades: 'security vulnerability',
  desplegar: 'deploy', despliegue: 'deploy', publicar: 'publish deploy release',
  informe: 'report', reporte: 'report', diseno: 'design', disenar: 'design',
  datos: 'data database', correo: 'email mail', rama: 'branch', fusionar: 'merge', cambios: 'diff changes',
  limpiar: 'clean cleanup', refactorizar: 'refactor', rendimiento: 'performance optimize', optimizar: 'optimize performance',
  migrar: 'migrate migration', migracion: 'migrate migration', imagen: 'image', imagenes: 'image',
  grafico: 'chart plot', graficos: 'chart plot', escribir: 'write', resumir: 'summarize summary', resumen: 'summary summarize',
  traducir: 'translate translation', buscar: 'search find', instalar: 'install', configurar: 'configure config setting',
  configuracion: 'configuration config setting', contrasena: 'password', agente: 'agent', agentes: 'agent',
  commit: 'commit git', confirmar: 'commit', subir: 'push upload', pdf: 'pdf', tabla: 'table', archivo: 'file', archivos: 'file',
  tarea: 'task', tareas: 'task', plan: 'plan', planificar: 'plan planning', investigar: 'research', analizar: 'analyze analysis',
  crear: 'create', generar: 'generate create', nuevo: 'new create', componente: 'component',
}

const SUFFIXES = [
  'ations', 'ation', 'ciones', 'cion', 'ments', 'ment', 'ings', 'ing', 'ando', 'iendo',
  'ados', 'adas', 'idos', 'idas', 'ado', 'ada', 'ido', 'ida', 'ed', 'es', 's',
]

/** Lowercase, accents off: `presentación` and `presentacion` are one word. */
export function fold(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

/** A light stem, applied the same way to the draft and to every skill. */
export function stem(word: string): string {
  if (word.length <= 3) return word
  for (const suffix of SUFFIXES) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 3) return word.slice(0, -suffix.length)
  }
  return word
}

function words(text: string): string[] {
  return fold(text).split(/[^a-z0-9]+/).filter(Boolean)
}

/** What the draft is: see the header of this file. */
export function readDraft(text: string, minWords = 2): Draft {
  const t = text.replace(/^\s+/, '')
  if (!t || /^[/!#]/.test(t)) return IDLE
  const prose = t
    .replace(/```[\s\S]*?(```|$)/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .slice(-600)
  const content = words(prose).filter((w) => !STOP.has(w))
  return content.length >= minWords || prose.trim().length >= 24 ? { mode: 'prose', prose } : IDLE
}

/** The search structure of one roster: each skill's words and how common each word is. */
export interface Index {
  skills: Skill[]
  docs: { name: Set<string>; desc: Set<string>; raw: string }[]
  idf: Map<string, number>
  /** Idf of a word no skill has. */
  unseen: number
}

export function buildIndex(skills: readonly Skill[]): Index {
  const docs = skills.map((skill) => ({
    name: new Set(words(skill.name).map(stem)),
    desc: new Set(words(skill.description).filter((w) => !STOP.has(w)).map(stem)),
    raw: fold(skill.name),
  }))
  const df = new Map<string, number>()
  for (const doc of docs) {
    for (const term of new Set([...doc.name, ...doc.desc])) df.set(term, (df.get(term) ?? 0) + 1)
  }
  const n = Math.max(1, docs.length)
  const idf = new Map<string, number>()
  for (const [term, count] of df) idf.set(term, Math.log(1 + n / (1 + count)))
  return { skills: [...skills], docs, idf, unseen: Math.log(1 + n) }
}

interface Term {
  stem: string
  /** The word as the person typed it, for display. */
  shown: string
  weight: number
  isPartial: boolean
}

/** The query's terms: its words (the one still being typed as a prefix) and their English aliases. */
export function termsOf(prose: string): Term[] {
  const endsOpen = /[a-zA-Z0-9À-ſ]$/.test(prose)
  const raw = fold(prose).split(/[^a-z0-9]+/).filter(Boolean)
  const out = new Map<string, Term>()
  raw.forEach((word, i) => {
    if (STOP.has(word)) return
    const isPartial = endsOpen && i === raw.length - 1 && word.length >= 3
    const s = stem(word)
    if (!out.has(s)) out.set(s, { stem: s, shown: word, weight: isPartial ? 0.6 : 1, isPartial })
    for (const alias of (ALIASES[word] ?? '').split(' ').filter(Boolean)) {
      const a = stem(alias)
      if (!out.has(a)) out.set(a, { stem: a, shown: word, weight: 0.8, isPartial: false })
    }
  })
  return [...out.values()]
}

export interface Hit {
  skill: Skill
  /** 0 to 100: how much of the draft this skill's name and description cover. */
  score: number
  hits: string[]
}

/** Keyword rank of the roster against a prose draft, best first. */
export function rankProse(index: Index, prose: string, limit = 5, floor = 12): Hit[] {
  const terms = termsOf(prose)
  if (terms.length === 0) return []
  const lower = fold(prose)
  const total = terms.reduce((sum, t) => sum + (index.idf.get(t.stem) ?? index.unseen) * t.weight, 0)
  const found: Hit[] = []
  index.docs.forEach((doc, i) => {
    let raw = 0
    const hits = new Set<string>()
    for (const t of terms) {
      const idf = index.idf.get(t.stem) ?? index.unseen
      let strength = 0
      if (doc.name.has(t.stem)) strength = 2.5
      else if (doc.desc.has(t.stem)) strength = 1
      else if (t.isPartial) {
        const starts = (set: Set<string>) => [...set].some((w) => w.startsWith(t.stem))
        strength = starts(doc.name) ? 1.5 : starts(doc.desc) ? 0.6 : 0
      }
      if (strength > 0) {
        raw += idf * t.weight * strength
        hits.add(t.shown)
      }
    }
    // The skill named outright ("use the pdf skill", "run commit").
    if (doc.raw.length >= 3 && new RegExp(`(^|[^a-z0-9])${doc.raw.replace(/[^a-z0-9]/g, '.')}($|[^a-z0-9])`).test(lower)) {
      raw += total * 1.5
      hits.add(doc.raw)
    }
    if (raw === 0 || total === 0) return
    const score = Math.min(100, Math.round((100 * (raw / total)) / 1.6))
    if (score >= floor) found.push({ skill: index.skills[i], score, hits: [...hits] })
  })
  return found.sort((a, b) => b.score - a.score || a.skill.name.localeCompare(b.skill.name)).slice(0, limit)
}

/** One band row from a hit. */
export function toRow(hit: Hit, isChosen: boolean, descriptionChars = 140): Row {
  const description = hit.skill.description.replace(/\s+/g, ' ').trim()
  return {
    name: hit.skill.name,
    description: description.length > descriptionChars ? `${description.slice(0, descriptionChars - 1)}…` : description,
    origin: hit.skill.origin,
    score: hit.score,
    hits: hit.hits.slice(0, 4),
    isChosen,
  }
}

/**
 * The skills the model may call, from the engine's `skill_listing` attachment:
 * a header line, then one `- name: description` per skill, a description
 * possibly running over several lines. A name with a colon
 * (`engineering:code-review`) belongs to a plugin.
 */
export function parseListing(text: string): Skill[] {
  const skills: Skill[] = []
  let current: Skill | null = null
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd()
    const entry = /^- (\S+?)(?::\s(.*))?$/.exec(line)
    if (entry) {
      const name = entry[1] as string
      current = { name, description: (entry[2] ?? '').trim(), origin: name.includes(':') ? 'plugin' : 'user' }
      skills.push(current)
    } else if (current && line.trim()) {
      current.description = `${current.description} ${line.trim()}`.trim()
    }
  }
  return skills
}

/**
 * The skills before the engine's listing has been seen (it is rendered at the
 * turn's first request): the commands the engine offers, less the built-ins.
 * That list also holds commands only the person can run, so this is the
 * fallback, and the listing replaces it as soon as it arrives.
 */
export function skillsFromCommands(
  commands: readonly { name: string; description: string; source: string }[],
): Skill[] {
  return commands
    .filter((c) => c.source !== 'builtin' && !/\s/.test(c.name))
    .map((c) => ({ name: c.name, description: (c.description ?? '').trim(), origin: c.source === 'plugin' ? 'plugin' as const : 'user' as const }))
}

/** The key a candidate answers to in a decision request: a subagent shares no namespace with a skill. */
export function keyOf(item: { name: string; origin: Origin }): string {
  return item.origin === 'agent' ? `agent:${item.name}` : item.name
}

/** What a roster is built from: the skills, the subagent types, and the names the person left out. */
export function rosterOf(skills: readonly Skill[], agents: readonly Skill[], excluded: ReadonlySet<string>): Skill[] {
  const seen = new Set<string>()
  const out: Skill[] = []
  for (const item of [...skills, ...agents]) {
    const key = `${item.origin === 'agent' ? 'agent' : 'skill'}:${item.name}`
    if (excluded.has(item.name) || seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

/** Comma-separated option → set of names. */
export function parseNames(option: string): Set<string> {
  return new Set(option.split(',').map((s) => s.trim().replace(/^\//, '')).filter(Boolean))
}
