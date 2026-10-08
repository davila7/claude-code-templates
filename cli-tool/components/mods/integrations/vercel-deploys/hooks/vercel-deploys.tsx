/**
 * vercel-deploys — Claude Mod
 *
 * Your Vercel projects in a pane: one row per connected site with the state of
 * its latest deployment, the production domain, the commit behind it and
 * whether the site answers. It keeps itself current:
 *
 *   - `$.clock.every(5000)` decides when to read: every `pollSeconds` while
 *     nothing builds, every 10 s while something does; nothing while the pane
 *     is closed and the status line is off
 *   - a deployment that turns ready or fails raises a toast
 *   - `$.ui.status` keeps "N ready · N building · N failed" under the prompt
 *
 * Read-only: it lists projects and deployments through Vercel's REST API and,
 * if `healthCheck` is on, sends one GET to each production domain at most once
 * a minute. The token is only ever sent to api.vercel.com in an Authorization
 * header and is never logged or drawn. Never hardcode it in this file.
 *
 * Needs Claude Code >= 2.1.287 and a
 * Vercel access token in the plugin's options.
 *
 * Options (pluginConfigs["vercel-deploys@skills-dir"].options):
 *   vercelToken: string   required; without it the mod does nothing
 *   teamId: string        team_... id or a team slug (default: the token's own account)
 *   maxProjects: number   projects listed, 1-50 (default 20)
 *   pollSeconds: number   idle refresh interval, 10-3600 (default 60)
 *   healthCheck: boolean  GET each production domain, at most once a minute (default true)
 *   status: boolean       status line summary, keeps polling with the pane closed (default true)
 *   toast: boolean        toast when a deployment finishes (default true)
 *   openOnStart: boolean  open the pane at session start (default false)
 */
import type { Register } from 'claude-code'
import {
  COLOR,
  GLYPH,
  ago,
  answers,
  changes,
  clampInt,
  fit,
  listDeploys,
  listProjects,
  sortProjects,
  summarize,
  summaryText,
} from './vercel-api.ts'
import type { Change, Deploy, Fetch, Project } from './vercel-api.ts'

const PANE = 'vercel'
const COMMAND = 'vercel'
const TICK_MS = 5000
const BUILDING_POLL_MS = 10_000
const HEALTH_EVERY_MS = 60_000
const HEALTH_TIMEOUT_MS = 5000

type Health = { status: number; ok: boolean; at: number }

let projects: Project[] = []
let before = new Map<string, Deploy>()
let health = new Map<string, Health>()
let error: string | undefined
let isOpen = false
let isBusy = false
let lastReadAt = 0
let selected: string | undefined
let history: Deploy[] = []
let timer: { cancel: () => void } | undefined

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

export const register: Register = (on, options) => {
  const token = str(options.vercelToken)
  const team = str(options.teamId)
  const maxProjects = clampInt(options.maxProjects, 20, 1, 50)
  const idleMs = clampInt(options.pollSeconds, 60, 10, 3600) * 1000
  const healthCheck = options.healthCheck !== false
  const showStatus = options.status !== false
  const wantToast = options.toast !== false
  const openOnStart = options.openOnStart === true

  const isBuilding = () => projects.some(p => p.latest?.state === 'building')
  const statusText = () => (token && projects.length > 0 ? summaryText(summarize(projects)) : undefined)

  /** One read of the projects, then the sites that are due a health check; the toasts it earned. */
  async function read(f: Fetch, sleep: (ms: number) => Promise<void>): Promise<Change[]> {
    isBusy = true
    try {
      const list = sortProjects(await listProjects(f, token, team, maxProjects))
      const finished = changes(before, list)
      before = new Map(list.flatMap(p => (p.latest ? [[p.id, p.latest] as const] : [])))
      projects = list
      error = undefined
      lastReadAt = Date.now()

      if (healthCheck) {
        const due = list.filter(p => p.domain && Date.now() - (health.get(p.id)?.at ?? 0) >= HEALTH_EVERY_MS)
        await Promise.all(
          due.map(async p => {
            const at = Date.now()
            const hit = await Promise.race([
              f(`https://${p.domain}`, { method: 'GET' }).then(r => ({ status: r.status })),
              sleep(HEALTH_TIMEOUT_MS).then(() => ({ status: 0 })),
            ]).catch(() => ({ status: 0 }))
            health.set(p.id, { status: hit.status, ok: answers(hit.status), at })
          }),
        )
      }
      return finished
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
      lastReadAt = Date.now()
      return []
    } finally {
      isBusy = false
    }
  }

  const toastFor = (c: Change) =>
    c.to === 'ready'
      ? `vercel: ${c.project} is ready${c.target === 'production' ? ' in production' : ''}`
      : `vercel: ${c.project} failed${c.error ? `: ${fit(c.error, 80)}` : ''}`

  on('session.start', async ($, e, next) => {
    const r = await next(e)
    await $.command
      .register({
        name: COMMAND,
        description: 'Your Vercel projects and the state of their deployments (stop closes)',
        argumentHint: '[stop]',
        immediate: true,
      })
      .catch(err => $.ui.log(`vercel-deploys: /${COMMAND} not registered: ${err}`))
    if (!token) {
      $.ui.log('vercel-deploys: set vercelToken in the plugin options to list your projects', { to: 'debug' })
      return r
    }

    timer?.cancel()
    timer = $.clock.every(TICK_MS, () => {
      if (isBusy || (!isOpen && !showStatus)) return
      if (Date.now() - lastReadAt < (isBuilding() ? BUILDING_POLL_MS : idleMs) - TICK_MS / 2) return
      void read(
        (url, init) => $.http.fetch(url, init),
        ms => $.clock.sleep(ms),
      ).then(finished => {
        if (wantToast) for (const c of finished) $.ui.toast(toastFor(c))
        $.ui.status(showStatus ? statusText() : undefined)
        $.ui.invalidate('ui.render')
      })
    })

    if (openOnStart) {
      await read(
        (url, init) => $.http.fetch(url, init),
        ms => $.clock.sleep(ms),
      )
      isOpen = true
      await $.ui.open({ id: PANE, title: 'vercel' }).catch(() => {
        isOpen = false
      })
      $.ui.status(showStatus ? statusText() : undefined)
    }
    return r
  })

  on('session.end', async ($, e, next) => {
    timer?.cancel()
    timer = undefined
    return next(e)
  })

  on('command.run', { command: COMMAND }, async ($, e) => {
    if (!token) return { text: 'vercel: set vercelToken in the plugin options' }
    const arg = e.args.trim().toLowerCase()
    if (arg === 'stop' || arg === 'close') {
      await $.ui.close({ id: PANE }).catch(() => undefined)
      isOpen = false
      return { text: 'vercel closed' }
    }
    await read(
      (url, init) => $.http.fetch(url, init),
      ms => $.clock.sleep(ms),
    )
    isOpen = true
    await $.ui.open({ id: PANE, title: 'vercel', focus: true })
    $.ui.status(showStatus ? statusText() : undefined)
    $.ui.invalidate('ui.render')
    if (error) return { text: `vercel: ${error}` }
    return { text: `${summaryText(summarize(projects))} · /${COMMAND} stop closes` }
  })

  on('ui.close', async ($, e, next) => {
    if (e.id !== PANE) return next(e)
    isOpen = false
    return next(e)
  })

  on('ui.press', async ($, e, next) => {
    if (e.plugin !== $.plugin.name || e.requestId !== PANE) return next(e)
    const r = await next(e)
    const key = e.element
    if (key === 'close') {
      await $.ui.close({ id: PANE }).catch(() => undefined)
      return r
    }
    if (key === 'refresh') {
      if (!isBusy) {
        health = new Map()
        const finished = await read(
          (url, init) => $.http.fetch(url, init),
          ms => $.clock.sleep(ms),
        )
        if (wantToast) for (const c of finished) $.ui.toast(toastFor(c))
        if (selected) {
          history = await listDeploys((url, init) => $.http.fetch(url, init), token, team, selected, 5).catch(() => history)
        }
      }
    } else if (key.startsWith('p:')) {
      const project = projects[Number(key.slice(2))]
      if (project && selected === project.id) {
        selected = undefined
        history = []
      } else if (project) {
        selected = project.id
        history = await listDeploys((url, init) => $.http.fetch(url, init), token, team, project.id, 5).catch(() => [])
      }
    } else if (key === 'copy') {
      const domain = projects.find(p => p.id === selected)?.domain
      if (domain) {
        await $.ui.copy({ text: `https://${domain}`, surface: e.surface }).catch(() => undefined)
        $.ui.toast(`vercel: copied https://${domain}`)
      }
    }
    $.ui.status(showStatus ? statusText() : undefined)
    $.ui.invalidate('ui.render')
    return r
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const width = Math.max(30, e.props.bodyColumns - 1)
    const now = Date.now()
    const noop = () => {}
    const chosen = selected ? projects.find(p => p.id === selected) : undefined

    return (
      <Box flexDirection="column">
        <Text bold>{fit(summaryText(summarize(projects)), width)}</Text>
        {error ? <Text color="red">{fit(error, width)}</Text> : null}
        {projects.length === 0 && !error ? <Text dimColor>no projects</Text> : null}

        {projects.map((p, i) => {
          const state = p.latest?.state ?? 'unknown'
          const probe = health.get(p.id)
          const site = !healthCheck || !p.domain || !probe ? '' : probe.ok ? ` ✓${probe.status}` : probe.status === 0 ? ' ✕down' : ` ✕${probe.status}`
          const age = ago(p.latest?.createdAt, now)
          const label = `${p.name}${age ? `  ${age}` : ''}`
          const room = width - 2 - site.length
          return (
            <Box key={`row:${i}`} flexDirection="row">
              <Text color={COLOR[state]}>{`${GLYPH[state]} `}</Text>
              <Button key={`p:${i}`} plain dimColor={selected !== p.id && state === 'canceled'} label={fit(label, room)} onPress={noop} />
              {site ? <Text color={probe?.ok ? 'green' : 'red'}>{site}</Text> : null}
            </Box>
          )
        })}

        {chosen ? (
          <Box key="detail" flexDirection="column" marginTop={1} borderStyle="round" borderDimColor paddingX={1}>
            <Text bold>{fit(chosen.domain ?? chosen.name, width - 4)}</Text>
            <Text dimColor>
              {fit([chosen.framework, chosen.repo].filter(Boolean).join(' · ') || 'no Git repository linked', width - 4)}
            </Text>
            {history.map((d, i) => (
              <Text key={`d:${i}`} wrap="truncate-end">
                <Text color={COLOR[d.state]}>{`${GLYPH[d.state]} `}</Text>
                {`${d.target === 'production' ? 'prod' : 'prev'} ${ago(d.createdAt, now)} ${d.commit ?? d.readyState.toLowerCase()}`}
              </Text>
            ))}
            {chosen.latest?.error ? <Text color="red">{fit(chosen.latest.error, width - 4)}</Text> : null}
            {chosen.domain ? <Button key="copy" label="copy url" hotkey="c" onPress={noop} /> : null}
          </Box>
        ) : null}

        <Box key="foot" marginTop={1} flexDirection="column">
          <Box flexDirection="row" columnGap={1}>
            <Button key="refresh" label="refresh" hotkey="r" onPress={noop} />
            <Button key="close" label="close" onPress={noop} />
          </Box>
          <Text dimColor>{fit('● ready  ◐ building  ✕ failed · ✓ site answers', width)}</Text>
        </Box>
      </Box>
    )
  })
}
