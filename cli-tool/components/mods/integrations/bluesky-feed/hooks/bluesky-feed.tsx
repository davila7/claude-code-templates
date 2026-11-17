/**
 * bluesky-feed — Claude Mod
 *
 * Your Bluesky "Following" timeline in a side pane:
 *
 *   - the posts of the accounts you follow, newest first, with reposts and
 *     replies marked, images, videos, link cards and quotes described in a line
 *   - a field to write and send a post (links and #hashtags become clickable)
 *   - a like button on every post (press again to unlike) and a link that
 *     opens the post on bsky.app
 *
 * `/bsky` opens it, `/bsky stop` closes it. `$.clock.every(5000)` decides when
 * to read again, every `pollSeconds`, only while the pane is open.
 *
 * It logs in with an app password (Bluesky, Settings, Privacy and security,
 * App passwords), never your account password. The app password and the
 * session tokens stay in memory, are sent only to `service`, and are never
 * logged, drawn or stored. Never hardcode them in this file.
 *
 * Needs Claude Code >= 2.1.287.
 *
 * Options (pluginConfigs["bluesky-feed@skills-dir"].options):
 *   handle: string        your handle, e.g. dan.bsky.social (required)
 *   appPassword: string   an app password (required)
 *   service: string       your PDS (default https://bsky.social)
 *   limit: number         posts per page, 10-50 (default 30)
 *   pollSeconds: number   refresh interval, 30-3600 (default 120)
 *   openOnStart: boolean  open the pane at session start (default false)
 */
import type { Register } from 'claude-code'
import { BskyError, Client, MAX_GRAPHEMES, ago, clampInt, compact, graphemes, handleOf, postUrl, serviceUrl } from './bsky-api.ts'
import type { Post } from './bsky-api.ts'

const PANE = 'bsky'
const COMMAND = 'bsky'
const TICK_MS = 5000
const MAX_POSTS = 120

const SKY = '#1185fe'
const PINK = '#ec4899'
const INK = '#0b1220'
const GREY = '#8a8a8a'
const RULE = '#3a3a3a'
const GREEN = '#22c55e'

let posts: Post[] = []
let cursor: string | undefined
let error: string | undefined
let notice: { text: string; tone: 'success' | 'error' } | undefined
let isOpen = false
let isBusy = false
let isPosting = false
let lastReadAt = 0
let draftLength = 0
let composeGeneration = 0
let timer: { cancel: () => void } | undefined

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const message = (err: unknown) => (err instanceof Error ? err.message : String(err))
// Desktop draws text as HTML and collapses runs of spaces; keep short gaps
const nb = (s: string) => s.replace(/ /g, ' ')

export const register: Register = (on, options) => {
  const handle = handleOf(options.handle)
  const password = text(options.appPassword)
  const service = serviceUrl(options.service)
  const limit = clampInt(options.limit, 30, 10, 50)
  const pollMs = clampInt(options.pollSeconds, 120, 30, 3600) * 1000
  const openOnStart = options.openOnStart === true
  const isConfigured = handle !== '' && password !== ''

  let client: Client | undefined
  const api = (f: ConstructorParameters<typeof Client>[0]) => (client ??= new Client(f, service, handle, password))

  async function read(c: Client, more = false): Promise<void> {
    isBusy = true
    try {
      const page = await c.timeline(limit, more ? cursor : undefined)
      if (more) {
        const seen = new Set(posts.map(p => p.uri))
        posts = [...posts, ...page.posts.filter(p => !seen.has(p.uri))].slice(0, MAX_POSTS)
      } else {
        posts = page.posts
      }
      cursor = page.cursor
      error = undefined
    } catch (err) {
      error = message(err)
    } finally {
      lastReadAt = Date.now()
      isBusy = false
    }
  }

  on('session.start', async ($, e, next) => {
    const r = await next(e)
    await $.command
      .register({
        name: COMMAND,
        description: 'Your Bluesky timeline: read, post and like (stop closes)',
        argumentHint: '[stop]',
        immediate: true,
      })
      .catch(err => $.ui.log(`bluesky-feed: /${COMMAND} not registered: ${err}`))
    if (!isConfigured) {
      $.ui.log('bluesky-feed: set handle and appPassword in the plugin options', { to: 'debug' })
      return r
    }

    timer?.cancel()
    timer = $.clock.every(TICK_MS, () => {
      if (isBusy || !isOpen) return
      if (Date.now() - lastReadAt < pollMs - TICK_MS / 2) return
      void read(api((url, init) => $.http.fetch(url, init))).then(() => $.ui.invalidate('ui.render'))
    })

    if (openOnStart) {
      // open first and read in the background: a slow PDS never holds up the session
      isOpen = true
      await $.ui.open({ id: PANE, title: 'bluesky' }).catch(() => {
        isOpen = false
      })
      if (isOpen) void read(api((url, init) => $.http.fetch(url, init))).then(() => $.ui.invalidate('ui.render'))
    }
    return r
  })

  on('session.end', async ($, e, next) => {
    timer?.cancel()
    timer = undefined
    return next(e)
  })

  on('command.run', { command: COMMAND }, async ($, e) => {
    if (!isConfigured) return { text: 'bsky: set handle and appPassword in the plugin options' }
    if (['stop', 'close'].includes(e.args.trim().toLowerCase())) {
      await $.ui.close({ id: PANE }).catch(() => undefined)
      isOpen = false
      return { text: 'bluesky closed' }
    }
    await read(api((url, init) => $.http.fetch(url, init)))
    isOpen = true
    const opened = await $.ui.open({ id: PANE, title: 'bluesky', focus: true }).then(
      () => true,
      () => false,
    )
    if (!opened) {
      isOpen = false
      return { text: 'bsky: the pane could not open here' }
    }
    $.ui.invalidate('ui.render')
    if (error) return { text: `bsky: ${error}` }
    return { text: `bluesky: ${posts.length} posts from the accounts you follow · /${COMMAND} stop closes` }
  })

  on('ui.close', async ($, e, next) => {
    if (e.id !== PANE) return next(e)
    isOpen = false
    return next(e)
  })

  on('ui.input', async ($, e, next) => {
    if (e.plugin !== $.plugin.name || e.requestId !== PANE || !e.element.startsWith('compose')) return next(e)
    const r = await next(e)
    if (e.kind === 'change') {
      const n = graphemes(e.value)
      // redraw only when the counter's look changes, not on every key
      const band = (x: number) => (x === 0 ? 0 : x > MAX_GRAPHEMES ? 3 : x > MAX_GRAPHEMES - 20 ? 2 : 1)
      const changed = band(n) !== band(draftLength) || band(n) >= 2
      draftLength = n
      if (changed) $.ui.invalidate('ui.render')
      return r
    }
    const body = e.value.trim()
    if (!body || isPosting) return r
    if (graphemes(body) > MAX_GRAPHEMES) {
      notice = { text: `Too long: ${graphemes(body)}/${MAX_GRAPHEMES} characters`, tone: 'error' }
      $.ui.invalidate('ui.render')
      return r
    }
    isPosting = true
    $.ui.invalidate('ui.render')
    try {
      const c = api((url, init) => $.http.fetch(url, init))
      await c.post(body)
      notice = { text: 'Posted', tone: 'success' }
      composeGeneration++
      draftLength = 0
      $.ui.toast('🦋 posted to Bluesky')
      await read(c)
    } catch (err) {
      notice = { text: `Not posted: ${message(err)}`, tone: 'error' }
    } finally {
      isPosting = false
    }
    $.ui.invalidate('ui.render')
    return r
  })

  on('ui.press', async ($, e, next) => {
    if (e.plugin !== $.plugin.name || e.requestId !== PANE) return next(e)
    const r = await next(e)
    const target = e.element
    const c = api((url, init) => $.http.fetch(url, init))
    if (target === 'close') {
      await $.ui.close({ id: PANE }).catch(() => undefined)
      return r
    }
    if (target === 'refresh') {
      notice = undefined
      if (!isBusy) await read(c)
    } else if (target === 'more') {
      if (!isBusy && cursor) await read(c, true)
    } else if (target.startsWith('like:')) {
      const p = posts.find(x => x.cid === target.slice(5))
      if (p && p.likeUri !== 'pending') {
        // optimistic: draw the heart now, put it back if Bluesky refuses
        const before = { likeUri: p.likeUri, likeCount: p.likeCount }
        const wasLiked = Boolean(p.likeUri)
        p.likeUri = wasLiked ? undefined : 'pending'
        p.likeCount = Math.max(0, p.likeCount + (wasLiked ? -1 : 1))
        $.ui.invalidate('ui.render')
        try {
          if (wasLiked) await c.unlike(before.likeUri!)
          else p.likeUri = await c.like(p)
        } catch (err) {
          Object.assign(p, before)
          notice = { text: `${wasLiked ? 'Unlike' : 'Like'} failed: ${message(err)}`, tone: 'error' }
          if (err instanceof BskyError && err.status === 401) error = err.message
        }
      }
    }
    $.ui.invalidate('ui.render')
    return r
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE) return next(e)
    // a pane the engine kept open across a reload or a resume: read once, poll again
    if (isConfigured && !isOpen) {
      isOpen = true
      if (lastReadAt === 0 && !isBusy) void read(api((url, init) => $.http.fetch(url, init))).then(() => $.ui.invalidate('ui.render'))
    }
    const els = $.ui.resolve(e)
    const { Box, Text, Button } = els
    // mobile draws no field and no link: there the timeline is read-only
    const Input = 'Input' in els ? els.Input : undefined
    const Link = 'Link' in els ? els.Link : undefined
    const W = Math.max(30, e.props.bodyColumns - 1)
    const now = Date.now()
    const noop = () => {}
    const me = client?.session?.handle ?? handle
    const counter = MAX_GRAPHEMES - draftLength
    const counterColor = counter < 0 ? 'error' : counter < 20 ? 'warning' : GREY

    const rows = posts.map(p => {
      const isLiked = Boolean(p.likeUri)
      const lines = p.text.split('\n').filter((l, i, all) => l.trim() !== '' || (i > 0 && i < all.length - 1))
      return (
        <Box key={`p:${p.uri}`} flexDirection="column" width={W}>
          {p.repostBy ? <Text color={GREEN} wrap="truncate-end">{nb(`↻ reposted by ${p.repostBy}`)}</Text> : null}
          <Text wrap="truncate-end">
            <Text color={SKY} bold>{p.name || p.handle}</Text>
            <Text color={GREY}>{nb(` @${p.handle} · ${ago(p.createdAt, now)}`)}</Text>
          </Text>
          {p.replyTo ? <Text color={SKY} dimColor wrap="truncate-end">{nb(`↳ replying to @${p.replyTo}`)}</Text> : null}
          {lines.map((l, i) => (
            <Text key={`l:${i}`}>{l || ' '}</Text>
          ))}
          {p.embed ? <Text color={GREY} wrap="truncate-end">{p.embed}</Text> : null}
          <Box flexDirection="row" columnGap={2}>
            <Box flexDirection="row">
              <Text color={isLiked ? PINK : GREY}>{nb(isLiked ? '♥ ' : '♡ ')}</Text>
              {/* a label string, not rich children: Claude Code 2.1.287 (and the Desktop build) skips the whole render on those */}
              <Button key={`like:${p.cid}`} plain dimColor={!isLiked} label={compact(p.likeCount)} onPress={noop} />
            </Box>
            <Text color={GREY}>{nb(`↩ ${compact(p.replyCount)}`)}</Text>
            <Text color={GREY}>{nb(`↻ ${compact(p.repostCount)}`)}</Text>
            {Link ? <Link href={postUrl(p)} label="open ↗" /> : null}
          </Box>
          <Text color={RULE}>{'─'.repeat(W)}</Text>
        </Box>
      )
    })

    return (
      <Box flexDirection="column" width={W}>
        <Box key="head" flexDirection="column" width={W}>
          <Box flexDirection="row" justifyContent="space-between" width={W}>
            <Text>
              <Text backgroundColor={SKY} color={INK} bold>{nb(' 🦋 BLUESKY ')}</Text>
              <Text backgroundColor="#1b2a41" color="#e6f0ff" bold>{nb(' FOLLOWING ')}</Text>
            </Text>
            <Text color={GREY}>{nb([`@${me}`, isBusy ? 'updating…' : lastReadAt ? `updated ${ago(new Date(lastReadAt).toISOString(), now)}` : ''].filter(Boolean).join(' · '))}</Text>
          </Box>
          <Text color={RULE}>{'─'.repeat(W)}</Text>
          {error ? <Text color="error">{`! ${error}`}</Text> : null}
          {notice ? <Text color={notice.tone}>{`${notice.tone === 'success' ? '✓' : '!'} ${notice.text}`}</Text> : null}
        </Box>

        {Input ? (
          <Box key="compose-box" flexDirection="column" width={W} marginBottom={1}>
            <Input
              key={`compose:${composeGeneration}`}
              label="✎ post"
              placeholder="What's up?"
              submitLabel={isPosting ? 'posting…' : 'post'}
              onSubmit={noop}
            />
            <Text color={counterColor}>{nb(`${counter} left · Enter posts · links and #tags are clickable`)}</Text>
          </Box>
        ) : null}

        {posts.length === 0 && !error ? <Text color={GREY}>{isBusy ? 'Loading your timeline…' : 'Nothing here yet: follow a few accounts on bsky.app'}</Text> : null}
        {rows}

        <Box key="foot" flexDirection="column" width={W}>
          <Box flexDirection="row" columnGap={1}>
            {cursor && posts.length < MAX_POSTS ? <Button key="more" label="more" hotkey="m" onPress={noop} /> : null}
            <Button key="refresh" label="refresh" hotkey="r" onPress={noop} />
            <Button key="close" label="close" onPress={noop} />
          </Box>
          <Text color={GREY}>{nb(`${posts.length} posts · refreshes every ${Math.round(pollMs / 1000)}s while open`)}</Text>
        </Box>
      </Box>
    )
  })
}
