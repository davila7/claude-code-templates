/**
 * jev-skill-typeahead — Claude Mod
 *
 * Shows, in the band above the prompt box and while you type, the skills and
 * subagents Claude will PROBABLY call for the prompt you are writing. Only
 * what the model invokes on its own counts: skills (Skill tool) and subagent
 * types (Agent tool). Slash commands are left out: you run those by typing
 * `/name`, so a draft starting with `/`, `!` or `#` gets no band.
 *
 * The candidates are what the engine itself offers the model, observed as it
 * builds the listings: the `skill_listing` attachment (`prompt.attachment`)
 * and every agent type offered (`agent.offer`). Both hooks only watch and
 * pass the event on. The engine renders those listings at a turn's first
 * request, so before the first prompt of a session the skills come from
 * `$.command.list()` instead (which also holds commands only you can run) and
 * subagents are not known yet; the listings replace that as soon as they
 * arrive.
 *
 * The draft is read on every edit (`prompt.edit`):
 *
 *   keywords   instant, local: candidates ranked by keyword match over name
 *              and description, English or Spanish; the word still being
 *              typed matches as a prefix
 *   decision   once you pause, Jev decides which ONE will be called and the
 *              band marks it ▶ with the probability it answered
 *
 * Phases the footer tells apart, so the band never claims more than it knows:
 * `keywords` (a guess), `asking Jev…`, `Jev decided` (with its confidence when
 * the backend reports one), `no skill needed`, `offline` (the request failed;
 * the keyword match stays).
 *
 * With `attach` on (the default) the candidate the band marked ▶ for exactly
 * the text you submit is named to the model in a `<skill_relevance>` note.
 * Text edited after the decision, or submitted before it, gets no note. Turn it
 * off when jev-skill-suggestion is installed: that mod decides at submit.
 *
 * Privacy: with a Jev key set, the prompt draft and every candidate's name and
 * description are sent to the backend the key belongs to, once per pause.
 * Without a key nothing leaves the machine.
 *
 * Keys come from the plugin's options (userConfig); never hardcode them here.
 * Needs Claude Code >= 2.1.287.
 */
import { atom, read, update } from 'claude-code'
import type { Register, Timer } from 'claude-code'

import type { Origin, Row, View } from '../types'
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
  keyOf,
  parseListing,
  parseNames,
  rankProse,
  readDraft,
  rosterOf,
  skillsFromCommands,
  toRow,
} from './policy.ts'
import type { Hit, Index, Skill } from './policy.ts'

const EMPTY: View = { mode: 'idle', draft: '', rows: [], phase: 'live', by: '', skills: 0, agents: 0 }
const view = atom({ plugin: 'jev-skill-typeahead', key: 'view' } as const, EMPTY)

/** The command fallback is re-read this often: skills can be installed mid-session. */
const FALLBACK_TTL_MS = 30_000
/** Keys typed this close together are one redraw. */
const LIVE_DELAY_MS = 60
/** Cells of the score meter. */
const METER = 8

const ICON: Record<Origin, string> = { user: '●', plugin: '◆', agent: '▣' }
const COLOR: Record<Origin, string> = { user: 'green', plugin: 'magenta', agent: 'blue' }

const WORDS = {
  en: {
    title: 'Claude may call',
    skills: 'skills',
    agents: 'subagents',
    keywords: 'keyword match · pause for Jev to decide',
    keywordsOnly: 'keyword match · set a Jev key to get a decision',
    thinking: 'asking Jev…',
    decidedJev: 'Jev decided',
    decidedBuiltin: 'Claude Code decided',
    none: 'nothing needed for this',
    offline: 'decision unavailable · keyword match',
    willUse: 'will be called',
    legend: 'user ● · plugin ◆ · subagent ▣',
  },
  es: {
    title: 'Claude puede llamar',
    skills: 'skills',
    agents: 'subagents',
    keywords: 'coincidencia por palabras · pausa para que Jev decida',
    keywordsOnly: 'coincidencia por palabras · configura una key de Jev para decidir',
    thinking: 'consultando a Jev…',
    decidedJev: 'Jev decidió',
    decidedBuiltin: 'Claude Code decidió',
    none: 'no hace falta ninguno',
    offline: 'decisión no disponible · coincidencia por palabras',
    willUse: 'se llamará',
    legend: 'usuario ● · plugin ◆ · subagent ▣',
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
  const logDecisions = flag('logDecisions', false)
  const includeAgents = flag('includeSubagents', true)
  const words = WORDS[text('language', 'en') === 'es' ? 'es' : 'en']
  const excluded = parseNames(text('neverSuggested', ''))
  const limits = { gate: number('gateThreshold', 0.3), confidence: number('confidenceThreshold', 0.35) }

  // What the engine offers the model, as seen in its own listings.
  const listedSkills = new Map<string, Skill>()
  const offeredAgents = new Map<string, Skill>()
  let fallback: Skill[] = []
  let fallbackAt = -Infinity

  let roster: Skill[] = []
  let index: Index = buildIndex([])
  let latest = ''
  let seq = 0
  let liveTimer: Timer | null = null
  let settleTimer: Timer | null = null
  // The one decision still valid: for exactly this draft, this candidate (or none).
  let decision: { draft: string; skill: Skill | null } | null = null

  const stop = () => {
    liveTimer?.cancel()
    settleTimer?.cancel()
    liveTimer = null
    settleTimer = null
  }

  on('session.start', async ($, e, next) => {
    const how = provider ? `Jev on ${provider}` : isBuiltin ? "Claude Code's classifier" : 'keyword match only (no Jev key)'
    $.ui.log(`[jev-skill-typeahead] ready: suggesting what Claude may call above the prompt as you type · decisions by ${how}`)
    return next(e)
  })

  // The skills the engine lists for the model. Observed, never changed.
  on('prompt.attachment', { type: 'skill_listing' }, async ($, e, next) => {
    for (const skill of parseListing(e.text)) listedSkills.set(skill.name, skill)
    return next(e)
  })

  // The subagent types the engine offers the model. Observed, never changed.
  on('agent.offer', async ($, e, next) => {
    offeredAgents.set(e.agent, { name: e.agent, description: e.description, origin: 'agent' })
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
      const counts = { skills: roster.filter((s) => s.origin !== 'agent').length, agents: roster.filter((s) => s.origin === 'agent').length }
      const base: View = { mode: 'prose', draft: draftText, rows: liveRows, phase: 'thinking', by: provider ? 'jev' : 'builtin', ...counts }
      await update($, view, () => base)

      // The candidates the keyword match likes go first: a backend that truncates keeps them.
      const liked = new Set(liveRows.map((r) => keyOf(r)))
      const candidates = [...roster.filter((s) => liked.has(keyOf(s))), ...roster.filter((s) => !liked.has(keyOf(s)))].slice(0, 250)
      const known = new Set(candidates.map(keyOf))

      let chosen: string | null = null
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
          chosen = verdictOf(decided, known, limits)
          probabilities = new Map(decided.ranked.filter((r) => known.has(r.name)).map((r) => [r.name, r.probability]))
        } else {
          const label = await $.model.classify(classifyText(prose.trim(), candidates), [...candidates.map(keyOf), NONE])
          chosen = label && label !== NONE && known.has(label) ? label : null
          if (chosen) probabilities = new Map([[chosen, null]])
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
      const byKey = new Map(roster.map((s) => [keyOf(s), s]))
      decision = { draft: draftText.trim(), skill: chosen ? (byKey.get(chosen) ?? null) : null }

      // Rows: what the backend ranked (top few above 3%), else the keyword rows; the chosen one first.
      const hitsOf = new Map(liveRows.map((r) => [keyOf(r), r.hits]))
      const ranked: Hit[] = [...probabilities.entries()]
        .filter(([, p]) => p === null || p >= 0.03)
        .slice(0, maxRows)
        .map(([k, p]) => ({ skill: byKey.get(k) as Skill, score: p === null ? -1 : Math.round(p * 100), hits: hitsOf.get(k) ?? [] }))
      const rows = (ranked.length > 0 ? ranked : liveRows.map((r): Hit => ({ skill: byKey.get(keyOf(r)) as Skill, score: r.score, hits: r.hits })))
        .filter((h) => h.skill)
        .map((h) => toRow(h, keyOf(h.skill) === chosen))
        .sort((a, b) => Number(b.isChosen) - Number(a.isChosen))
      if (logDecisions) $.ui.log(`[jev-skill-typeahead] ${chosen ?? 'nothing'} called for the draft`)
      await update($, view, () => ({ ...base, rows, phase: chosen ? 'decided' : 'none' }))
    }

    /** The instant half: no network, runs a moment after the last key. */
    const live = async (draftText: string, mySeq: number) => {
      const draft = readDraft(draftText, minWords)
      if (draft.mode === 'idle') return update($, view, () => EMPTY)

      // The listings win; until the skill listing has been seen, the commands stand in.
      let skills = [...listedSkills.values()]
      if (skills.length === 0) {
        const now = await $.clock.now()
        if (now - fallbackAt >= FALLBACK_TTL_MS || fallback.length === 0) {
          fallback = skillsFromCommands(await $.command.list())
          fallbackAt = now
        }
        skills = fallback
      }
      roster = rosterOf(skills, includeAgents ? [...offeredAgents.values()] : [], excluded)
      index = buildIndex(roster)
      if (mySeq !== seq) return
      if (roster.length === 0) return update($, view, () => EMPTY)

      const rows = rankProse(index, draft.prose, maxRows).map((h) => toRow(h, false))
      const shown: View = {
        mode: 'prose',
        draft: draftText,
        rows,
        phase: 'live',
        by: '',
        skills: roster.filter((s) => s.origin !== 'agent').length,
        agents: roster.filter((s) => s.origin === 'agent').length,
      }
      await update($, view, (old) => (JSON.stringify(old) === JSON.stringify(shown) ? old : shown))

      if (canDecide) {
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

    if (!attach || !decided?.skill || decided.draft !== e.text.trim()) return next(e)
    const pick = decided.skill
    if (logDecisions) $.ui.log(`[jev-skill-typeahead] told the model about ${keyOf(pick)}`)
    const advice =
      pick.origin === 'agent'
        ? `Relevant to the current request: the ${pick.name} subagent. Consider delegating to it with the Agent tool if it fits; ignore this if it does not fit what the user actually asked for.`
        : `Relevant to the current request: the ${pick.name} skill. Load it with the Skill tool if it fits; ignore this if it does not fit what the user actually asked for.`
    const note = ['<skill_relevance>', advice, '</skill_relevance>'].join('\n')
    return next({ ...e, context: [...(e.context ?? []), note] })
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const v = await read($, view)
    if (v.mode === 'idle') return next(e)
    // A draft nothing matches stays quiet until a decision says something.
    if (v.rows.length === 0 && (v.phase === 'live' || v.phase === 'offline')) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    // HTML collapses runs of spaces; a no-break space keeps them (desktop).
    const pad = (s: string) => (e.surface === 'terminal' ? s : s.replace(/ /g, ' '))
    const fit = (s: string, n: number) => pad(s.length > n ? `${s.slice(0, n - 1)}…` : s.padEnd(n))
    const filled = (score: number) => (score < 0 ? 0 : Math.max(score > 0 ? 1 : 0, Math.round((score / 100) * METER)))
    // The terminal draws block glyphs one cell wide. Desktop fonts draw them
    // wider than a cell, so there the meter is two coloured boxes instead.
    const meter = (score: number, color: string, isDim: boolean) => {
      const full = filled(score)
      if (e.surface === 'terminal') {
        const bar = score < 0 ? '·'.repeat(METER) : '█'.repeat(full) + '░'.repeat(METER - full)
        return <Text color={color} dimColor={isDim}>{bar}</Text>
      }
      return (
        <Box flexDirection="row" width={METER} height={1} overflow="hidden">
          {full > 0 ? <Box key="on" width={full} height={1} backgroundColor={color} /> : null}
          {full < METER ? <Box key="off" width={METER - full} height={1} backgroundColor="gray" /> : null}
        </Box>
      )
    }

    const footer =
      v.phase === 'thinking' ? words.thinking
      : v.phase === 'decided' ? (v.by === 'jev' ? words.decidedJev : words.decidedBuiltin)
      : v.phase === 'none' ? words.none
      : v.phase === 'offline' ? words.offline
      : canDecide ? words.keywords
      : words.keywordsOnly
    const footerColor = v.phase === 'decided' ? 'green' : v.phase === 'offline' ? 'yellow' : undefined

    const table = v.rows.map((r, i) => {
      const accent = r.isChosen ? 'green' : COLOR[r.origin]
      const detail = r.isChosen ? `${words.willUse}${r.hits.length ? ` · ${r.hits.join(', ')}` : ''}` : r.hits.length > 0 ? r.hits.join(', ') : r.description
      return (
        <Box key={`row:${i}:${r.origin}:${r.name}`} flexDirection="row">
          <Box key="mark" width={2} flexShrink={0}>
            <Text bold color="green">{pad(r.isChosen ? '▶ ' : '  ')}</Text>
          </Box>
          <Box key="icon" width={2} flexShrink={0}>
            <Text color={COLOR[r.origin]}>{pad(`${ICON[r.origin]} `)}</Text>
          </Box>
          <Box key="name" width={26} flexShrink={0}>
            <Text bold={r.isChosen} color={accent}>{fit(r.name, 25)}</Text>
          </Box>
          <Box key="meter" width={METER + 1} flexShrink={0} overflow="hidden">
            {meter(r.score, r.isChosen ? 'green' : 'cyan', !r.isChosen)}
          </Box>
          <Box key="score" width={6} flexShrink={0} justifyContent="flex-end" overflow="hidden">
            <Text dimColor>{pad(`${r.score < 0 ? '—' : `${r.score}%`} `)}</Text>
          </Box>
          <Box key="detail" flexGrow={1} flexShrink={1}>
            <Text dimColor={!r.isChosen} color={r.isChosen ? 'green' : undefined} wrap="truncate-end">{detail}</Text>
          </Box>
        </Box>
      )
    })

    const counts = v.agents > 0 ? `${v.skills} ${words.skills} · ${v.agents} ${words.agents}` : `${v.skills} ${words.skills}`
    return (
      <Box flexDirection="column" borderStyle="round" borderColor={v.phase === 'decided' ? 'green' : 'cyan'} borderDimColor={v.phase !== 'decided'} paddingX={1}>
        <Box key="head" flexDirection="row">
          <Text bold color="cyan">{pad(`✦ ${words.title} `)}</Text>
          <Text dimColor>{pad(counts)}</Text>
        </Box>
        {table.length > 0 ? table : <Text key="empty" dimColor>{pad(' ')}</Text>}
        <Text key="foot" dimColor={!footerColor} color={footerColor} wrap="truncate-end">{footer}</Text>
      </Box>
    )
  })
}
