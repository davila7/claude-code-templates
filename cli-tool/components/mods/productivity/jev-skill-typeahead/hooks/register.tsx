/**
 * jev-skill-typeahead — Claude Mod
 *
 * Suggests the skills you could use while you type, in the band above the
 * prompt box. The draft is read on every edit (`prompt.edit`), so the band
 * follows the box key by key:
 *
 *   /com            you are picking a command: your installed skills ranked by
 *                   NAME (prefix, word start, substring, subsequence)
 *   /commit fix     the name is complete: that skill is the one that will run
 *   make a deck…    prose: your installed skills ranked by keyword match over
 *                   name and description (English and Spanish); once you
 *                   pause, Jev decides which ONE will be used and the band
 *                   marks it ▶ with the probability it answered
 *   !ls / #note     nothing: a shell line or a memory note is not a task
 *
 * Phases the footer tells apart, so the band never claims more than it knows:
 * `keywords` (instant, local, a guess), `asking Jev…` (a decision is in
 * flight), `Jev decided` (the answer, with its confidence when the backend
 * reports one), `no skill needed` (the gate said prose is enough), `offline`
 * (the request failed; the keyword match stays).
 *
 * With `attach` on (the default) the skill the band marked ▶ for exactly the
 * text you submit is named to the model in a `<skill_relevance>` note, so what
 * the band says WILL be used is what the model is told. Text edited after the
 * decision, or submitted before it, gets no note. Turn it off when
 * jev-skill-suggestion is installed: that mod decides at submit, with its own
 * two-request pipeline.
 *
 * Privacy: with a Jev key set, the prompt draft and every skill's name and
 * description are sent to the backend the key belongs to, once per pause.
 * Without a key nothing leaves the machine.
 *
 * Keys come from the plugin's options (userConfig); never hardcode them here.
 * Needs Claude Code >= 2.1.287.
 */
import { atom, read, update } from 'claude-code'
import type { Register, Timer } from 'claude-code'

import type { Mode, Origin, Row, View } from '../types'
import {
  DEFAULT_BASE_URL,
  DEFAULT_MODEL,
  NONE,
  classifyText,
  endpoint,
  questions,
  readDecision,
  requestBody,
  requestHeaders,
  selectProvider,
  verdictOf,
} from './jev.ts'
import type { Provider } from './jev.ts'
import {
  buildIndex,
  exactSkill,
  parseNames,
  rankProse,
  rankSlash,
  readDraft,
  rosterOf,
  toRow,
} from './policy.ts'
import type { Hit, Index, Skill } from './policy.ts'

const EMPTY: View = { mode: 'idle', draft: '', rows: [], phase: 'live', by: '', roster: 0 }
const view = atom({ plugin: 'jev-skill-typeahead', key: 'view' } as const, EMPTY)

/** The roster is re-read this often: skills can be installed mid-session. */
const ROSTER_TTL_MS = 30_000
/** Keys typed this close together are one redraw. */
const LIVE_DELAY_MS = 60
/** Cells of the score meter. */
const METER = 8

const ICON: Record<Origin, string> = { user: '●', plugin: '◆', mcp: '◇' }
const COLOR: Record<Origin, string> = { user: 'green', plugin: 'magenta', mcp: 'yellow' }

const WORDS = {
  en: {
    title: 'Skills',
    installed: 'installed',
    modes: { slash: 'command', command: 'running', prose: 'prompt', idle: '' } as Record<Mode, string>,
    keywords: 'keyword match · pause for Jev to decide',
    keywordsOnly: 'keyword match · set a Jev key to get a decision',
    thinking: 'asking Jev…',
    decidedJev: 'Jev decided',
    decidedBuiltin: 'Claude Code decided',
    none: 'no skill needed for this',
    offline: 'decision unavailable · keyword match',
    willUse: 'will be used',
    runs: 'runs',
    nothing: 'no installed skill matches',
    origins: 'user ● · plugin ◆ · mcp ◇',
  },
  es: {
    title: 'Skills',
    installed: 'instalados',
    modes: { slash: 'comando', command: 'ejecuta', prose: 'prompt', idle: '' } as Record<Mode, string>,
    keywords: 'coincidencia por palabras · pausa para que Jev decida',
    keywordsOnly: 'coincidencia por palabras · configura una key de Jev para decidir',
    thinking: 'consultando a Jev…',
    decidedJev: 'Jev decidió',
    decidedBuiltin: 'Claude Code decidió',
    none: 'no hace falta ningún skill',
    offline: 'decisión no disponible · coincidencia por palabras',
    willUse: 'se usará',
    runs: 'ejecuta',
    nothing: 'ningún skill instalado coincide',
    origins: 'usuario ● · plugin ◆ · mcp ◇',
  },
}

export const register: Register = (on, options) => {
  const text = (key: string, fallback: string) =>
    typeof options[key] === 'string' && options[key] ? (options[key] as string) : fallback
  const number = (key: string, fallback: number) =>
    typeof options[key] === 'number' ? (options[key] as number) : fallback
  const flag = (key: string, fallback: boolean) =>
    typeof options[key] === 'boolean' ? (options[key] as boolean) : fallback

  const typesafeKey = text('typesafeApiKey', '')
  const gatewayKey = text('gatewayApiKey', '')
  const forced = text('provider', 'auto')
  const provider: Provider | null = selectProvider(forced, typesafeKey, gatewayKey)
  const isBuiltin = forced === 'builtin'
  const apiKey = provider === 'typesafe' ? typesafeKey : gatewayKey
  const modelId = provider === 'gateway' ? text('gatewayModel', DEFAULT_MODEL.gateway) : text('typesafeModel', DEFAULT_MODEL.typesafe)
  const url = provider
    ? provider === 'typesafe'
      ? endpoint('typesafe', text('typesafeBaseUrl', DEFAULT_BASE_URL.typesafe))
      : endpoint('gateway', text('gatewayBaseUrl', DEFAULT_BASE_URL.gateway))
    : ''
  const canDecide = provider !== null || isBuiltin

  const maxRows = Math.max(1, Math.min(8, Math.round(number('maxRows', 4))))
  const pauseMs = Math.max(150, number('pauseMs', 600))
  const timeoutMs = Math.max(500, number('timeoutMs', 4000))
  const minWords = Math.max(1, Math.round(number('minWords', 2)))
  const attach = flag('attach', true)
  const logDecisions = flag('logDecisions', true)
  const words = WORDS[text('language', 'en') === 'es' ? 'es' : 'en']
  const excluded = parseNames(text('neverSuggested', ''))
  const limits = { gate: number('gateThreshold', 0.3), confidence: number('confidenceThreshold', 0.35) }

  let roster: Skill[] = []
  let index: Index = buildIndex([])
  let rosterAt = -Infinity
  // Latest draft, and the counter that tells a late answer it was overtaken.
  let latest = ''
  let seq = 0
  let liveTimer: Timer | null = null
  let settleTimer: Timer | null = null
  // The one decision still valid: for exactly this draft, this skill (or none).
  let decision: { draft: string; name: string | null } | null = null

  const stop = () => {
    liveTimer?.cancel()
    settleTimer?.cancel()
    liveTimer = null
    settleTimer = null
  }

  on('session.start', async ($, e, next) => {
    const how = provider ? `Jev on ${provider}` : isBuiltin ? "Claude Code's classifier" : 'keyword match only (no Jev key)'
    $.ui.log(`[jev-skill-typeahead] ready: suggesting skills above the prompt as you type · decisions by ${how}`)
    return next(e)
  })

  on('prompt.edit', async ($, e, next) => {
    const box = await next(e)
    latest = box.text
    seq += 1
    decision = null
    stop()

    // `$` may not be handed to a helper, so the work lives in closures of this hook.
    const fail = (error: unknown) => $.ui.log(`[jev-skill-typeahead] ${String(error)}`)

    /** The decision: one request to Jev (or the built-in classifier) for the draft as it stands. */
    const settle = async (draftText: string, prose: string, liveRows: Row[], mySeq: number) => {
      if (mySeq !== seq) return
      const base: View = { mode: 'prose', draft: draftText, rows: liveRows, phase: 'thinking', by: provider ? 'jev' : 'builtin', roster: roster.length }
      await update($, view, () => base)

      // The skills the keyword match likes go first: a backend that truncates keeps them.
      const liked = new Set(liveRows.map((r) => r.name))
      const candidates = [...roster.filter((s) => liked.has(s.name)), ...roster.filter((s) => !liked.has(s.name))].slice(0, 250)
      const known = new Set(candidates.map((s) => s.name))

      let name: string | null = null
      let probabilities = new Map<string, number | null>()
      let failed = false
      try {
        if (provider) {
          const response = await Promise.race([
            $.http.fetch(url, {
              method: 'POST',
              headers: requestHeaders(provider, apiKey, modelId),
              body: requestBody(provider, prose.trim(), questions(provider, candidates), modelId),
            }),
            $.clock.sleep(timeoutMs),
          ])
          const decided = response && response.ok ? readDecision(response.text) : null
          if (!decided) throw new Error(response ? `${provider} answered ${response.status}` : `no answer in ${timeoutMs}ms`)
          name = verdictOf(decided, known, limits)
          probabilities = new Map(decided.ranked.filter((r) => known.has(r.name)).map((r) => [r.name, r.probability]))
        } else {
          const label = await $.model.classify(classifyText(prose.trim(), candidates), [...candidates.map((s) => s.name), NONE])
          name = label && label !== NONE && known.has(label) ? label : null
          if (name) probabilities = new Map([[name, null]])
        }
      } catch (error) {
        failed = true
        if (logDecisions) fail(`decision failed: ${String(error)}`)
      }
      if (mySeq !== seq) return

      if (failed) {
        await update($, view, () => ({ ...base, phase: 'offline' }))
        return
      }
      decision = { draft: draftText.trim(), name }

      // Rows: what the backend ranked (top few above 3%), else the keyword rows; the chosen one first.
      const byName = new Map(roster.map((s) => [s.name, s]))
      const hitsOf = new Map(liveRows.map((r) => [r.name, r.hits]))
      const ranked: Hit[] = [...probabilities.entries()]
        .filter(([, p]) => p === null || p >= 0.03)
        .slice(0, maxRows)
        .map(([n, p]) => ({
          skill: byName.get(n) as Skill,
          score: p === null ? -1 : Math.round(p * 100),
          hits: hitsOf.get(n) ?? [],
        }))
      const rows = (ranked.length > 0 ? ranked : liveRows.map((r): Hit => ({ skill: byName.get(r.name) as Skill, score: r.score, hits: r.hits })))
        .filter((h) => h.skill)
        .map((h) => toRow(h, h.skill.name === name))
        .sort((a, b) => Number(b.isChosen) - Number(a.isChosen))
      if (logDecisions) $.ui.log(`[jev-skill-typeahead] ${name ? `/${name}` : 'no skill'}`)
      await update($, view, () => ({ ...base, rows, phase: name ? 'decided' : 'none' }))
    }

    /** The instant half: no network, runs a moment after the last key. */
    const live = async (draftText: string, mySeq: number) => {
      const draft = readDraft(draftText, minWords)
      if (draft.mode === 'idle') return update($, view, () => EMPTY)
      const now = await $.clock.now()
      if (now - rosterAt >= ROSTER_TTL_MS || roster.length === 0) {
        roster = rosterOf(await $.command.list(), excluded)
        index = buildIndex(roster)
        rosterAt = now
      }
      if (mySeq !== seq) return
      if (roster.length === 0) return update($, view, () => EMPTY)

      let rows: Row[] = []
      if (draft.mode === 'slash') {
        rows = rankSlash(roster, draft.token, maxRows).map((h) => toRow(h, false))
      } else if (draft.mode === 'command') {
        const skill = exactSkill(roster, draft.token)
        rows = skill
          ? [toRow({ skill, score: 100, hits: [draft.token] }, true)]
          : rankSlash(roster, draft.token, maxRows).map((h) => toRow(h, false))
      } else {
        rows = rankProse(index, draft.prose, maxRows).map((h) => toRow(h, false))
      }
      const shown: View = { mode: draft.mode, draft: draftText, rows, phase: 'live', by: '', roster: roster.length }
      await update($, view, (old) => (JSON.stringify(old) === JSON.stringify(shown) ? old : shown))

      if (draft.mode === 'prose' && canDecide) {
        settleTimer = $.clock.after(pauseMs, () => {
          void settle(draftText, draft.prose, rows, mySeq).catch(fail)
        })
      }
    }

    liveTimer = $.clock.after(LIVE_DELAY_MS, () => {
      void live(latest, seq).catch(fail)
    })
    return box
  })

  on('prompt.submit', async ($, e, next) => {
    stop()
    seq += 1
    const decided = decision
    decision = null
    latest = ''
    await update($, view, () => EMPTY)

    const isSlash = e.text.trimStart().startsWith('/')
    if (!attach || !decided?.name || isSlash || decided.draft !== e.text.trim()) return next(e)
    if (logDecisions) $.ui.log(`[jev-skill-typeahead] told the model about /${decided.name}`)
    const note = [
      '<skill_relevance>',
      `Relevant to the current request: ${decided.name}. Load it with the Skill tool if it fits; ignore this if it does not fit what the user actually asked for.`,
      '</skill_relevance>',
    ].join('\n')
    return next({ ...e, context: [...(e.context ?? []), note] })
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const v = await read($, view)
    if (v.mode === 'idle') return next(e)
    const isQuiet = v.rows.length === 0 && (v.mode === 'prose' ? v.phase === 'live' || v.phase === 'offline' : false)
    if (isQuiet) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    // HTML collapses runs of spaces; a no-break space keeps them (desktop).
    const pad = (s: string) => (e.surface === 'terminal' ? s : s.replace(/ /g, ' '))
    const fit = (s: string, n: number) => pad(s.length > n ? `${s.slice(0, n - 1)}…` : s.padEnd(n))
    const meter = (score: number) => {
      if (score < 0) return '·'.repeat(METER)
      const full = Math.max(score > 0 ? 1 : 0, Math.round((score / 100) * METER))
      return '█'.repeat(full) + '░'.repeat(METER - full)
    }

    const modeLabel = words.modes[v.mode]
    const footer =
      v.phase === 'thinking' ? words.thinking
      : v.phase === 'decided' ? `${v.by === 'jev' ? words.decidedJev : words.decidedBuiltin}`
      : v.phase === 'none' ? words.none
      : v.phase === 'offline' ? words.offline
      : v.mode === 'prose' ? (canDecide ? words.keywords : words.keywordsOnly)
      : words.origins
    const footerColor = v.phase === 'decided' ? 'green' : v.phase === 'offline' ? 'yellow' : undefined

    const table = v.rows.map((r, i) => {
      const accent = r.isChosen ? 'green' : COLOR[r.origin]
      const detail = r.isChosen && v.mode === 'prose' ? `${words.willUse}${r.hits.length ? ` · ${r.hits.join(', ')}` : ''}`
        : v.mode === 'command' && r.isChosen ? words.runs
        : r.hits.length > 0 && v.mode === 'prose' ? r.hits.join(', ')
        : r.description
      return (
        <Box key={`row:${i}:${r.name}`} flexDirection="row">
          <Box key="mark" width={2} flexShrink={0}>
            <Text bold color="green">{pad(r.isChosen ? '▶ ' : '  ')}</Text>
          </Box>
          <Box key="icon" width={2} flexShrink={0}>
            <Text color={COLOR[r.origin]}>{pad(`${ICON[r.origin]} `)}</Text>
          </Box>
          <Box key="name" width={26} flexShrink={0}>
            <Text bold={r.isChosen} color={accent}>{fit(`/${r.name}`, 25)}</Text>
          </Box>
          {v.mode === 'slash' || v.mode === 'command' ? null : (
            <Box key="meter" width={METER + 6} flexShrink={0}>
              <Text color={r.isChosen ? 'green' : 'cyan'} dimColor={!r.isChosen}>{pad(`${meter(r.score)} `)}</Text>
              <Text dimColor>{pad((r.score < 0 ? '—' : `${r.score}%`).padStart(4))}</Text>
            </Box>
          )}
          <Box key="detail" flexGrow={1} flexShrink={1}>
            <Text dimColor={!r.isChosen} color={r.isChosen ? 'green' : undefined} wrap="truncate-end">{detail}</Text>
          </Box>
        </Box>
      )
    })

    return (
      <Box flexDirection="column" borderStyle="round" borderColor={v.phase === 'decided' ? 'green' : 'cyan'} borderDimColor={v.phase !== 'decided'} paddingX={1}>
        <Box key="head" flexDirection="row">
          <Text bold color="cyan">{pad(`✦ ${words.title} `)}</Text>
          <Text dimColor>{pad(`${v.roster} ${words.installed}  `)}</Text>
          {modeLabel ? <Text bold color="black" backgroundColor="cyan">{pad(` ${modeLabel} `)}</Text> : null}
        </Box>
        {table.length > 0 ? table : <Text key="empty" dimColor>{words.nothing}</Text>}
        <Text key="foot" dimColor={!footerColor} color={footerColor} wrap="truncate-end">{footer}</Text>
      </Box>
    )
  })
}
