// Pure request builders and reply parsers for each vendor. The engine only
// follows `$` into functions in the hooks module itself, so every
// `$.http.fetch` lives in register.tsx and this file never touches `$`.
//
// Adding a vendor: one entry in VENDORS, a key lookup in register.tsx's
// apiKey(), a userConfig field in plugin.json.
import type { HttpInit, HttpResponse } from 'claude-code'

import type { SecondOpinionEffort, SecondOpinionModel, SecondOpinionVendor } from '../types'

export type Vendor = SecondOpinionVendor
export type Effort = Exclude<SecondOpinionEffort, 'auto'>
export type Request = { url: string; init: HttpInit }
/** An image the person shared, base64 as the session holds it. */
export type Image = { mediaType: string; data: string }

type VendorSpec = {
  label: string
  envVar: string
  /** Which ids belong to this vendor, for a model named by id alone. */
  idPattern: RegExp
  /** Chat models only: what a reviewer list wants. */
  keep: (id: string) => boolean
  /** Our effort scale → the API's own values, tried in order; `undefined` sends none. */
  effort: Record<Effort, (string | undefined)[]>
  /** Words in a 400's message that mean the effort value itself was refused. */
  effortRefusal: RegExp
}

// OpenAI lists every model back to gpt-3.5; only the current generations are
// worth a review. Newer ones pass on their own as they ship.
const OPENAI_MIN_VERSION = 5.5

/** `gpt-5.6-sol` → 5.6, `gpt-6-luna` → 6; 0 for anything not named gpt-<n>. */
function gptVersion(id: string): number {
  const m = /^gpt-(\d+)(?:\.(\d+))?(?=-|$)/.exec(id)
  return m ? Number(m[1]) + Number(m[2] ?? 0) / 10 : 0
}

export const VENDORS: Record<Vendor, VendorSpec> = {
  openai: {
    label: 'OpenAI',
    envVar: 'OPENAI_API_KEY',
    idPattern: /^(gpt-|o\d|chatgpt-)/i,
    keep: id =>
      gptVersion(id) >= OPENAI_MIN_VERSION &&
      !/(audio|realtime|live|tts|transcribe|image|search|codex|instruct|embedding|moderation|-\d{4}-\d{2}-\d{2}$|-\d{4}$)/.test(id),
    effort: {
      low: ['low', undefined],
      medium: ['medium', undefined],
      high: ['high', undefined],
      max: ['xhigh', 'high', undefined],
    },
    effortRefusal: /reasoning/i,
  },
  gemini: {
    label: 'Gemini',
    envVar: 'GEMINI_API_KEY',
    idPattern: /^gemini-/i,
    keep: id =>
      id.startsWith('gemini-') &&
      !/(tts|transcribe|image|audio|live|embedding|robotics|computer-use|customtools|banana)/.test(id) &&
      // The `-latest` aliases point at a model already listed under its own id.
      !id.endsWith('-latest') &&
      // Still listed, but refused to new users.
      id !== 'gemini-2.5-pro',
    effort: {
      low: ['low', undefined],
      medium: ['medium', 'high', undefined],
      high: ['high', undefined],
      max: ['high', undefined],
    },
    effortRefusal: /thinking/i,
  },
  xai: {
    label: 'xAI',
    envVar: 'XAI_API_KEY',
    idPattern: /^grok-/i,
    keep: id => id.startsWith('grok-') && !/(image|imagine|vision|video|tts|embed)/.test(id),
    effort: {
      low: ['low', undefined],
      medium: ['medium', 'high', undefined],
      high: ['high', undefined],
      max: ['high', undefined],
    },
    effortRefusal: /reasoning/i,
  },
}

export const VENDOR_IDS = Object.keys(VENDORS) as Vendor[]

/** The vendor a bare model id belongs to, by its spelling. */
export function vendorOf(model: string): Vendor | undefined {
  return VENDOR_IDS.find(v => VENDORS[v].idPattern.test(model))
}


/** The model refused the effort value itself; the caller steps down the ladder. */
export class EffortRejected extends Error {}

export function completionRequest(
  vendor: Vendor,
  key: string,
  model: string,
  level: string | undefined,
  system: string,
  prompt: string,
  images: readonly Image[] = [],
): Request {
  const dataUrl = (i: Image) => `data:${i.mediaType};base64,${i.data}`
  if (vendor === 'gemini') {
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }, ...images.map(i => ({ inlineData: { mimeType: i.mediaType, data: i.data } }))],
            },
          ],
          ...(level ? { generationConfig: { thinkingConfig: { thinkingLevel: level } } } : {}),
        }),
      },
    }
  }
  if (vendor === 'openai') {
    // The Responses API serves every OpenAI model, the -pro ones included,
    // which chat completions does not.
    return {
      url: 'https://api.openai.com/v1/responses',
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          instructions: system,
          input: images.length
            ? [
                {
                  role: 'user',
                  content: [
                    { type: 'input_text', text: prompt },
                    ...images.map(i => ({ type: 'input_image', image_url: dataUrl(i) })),
                  ],
                },
              ]
            : prompt,
          ...(level ? { reasoning: { effort: level } } : {}),
        }),
      },
    }
  }
  return {
    url: 'https://api.x.ai/v1/chat/completions',
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        ...(level ? { reasoning_effort: level } : {}),
        messages: [
          { role: 'system', content: system },
          {
            role: 'user',
            content: images.length
              ? [
                  { type: 'text', text: prompt },
                  ...images.map(i => ({ type: 'image_url', image_url: { url: dataUrl(i) } })),
                ]
              : prompt,
          },
        ],
      }),
    },
  }
}

export function parseCompletion(vendor: Vendor, res: HttpResponse, level: string | undefined): string {
  const body = parseJson(res.text)
  if (!res.ok) {
    const message = errorMessage(body, res.text)
    const text = `HTTP ${res.status}: ${message}`
    throw res.status === 400 && level && VENDORS[vendor].effortRefusal.test(message)
      ? new EffortRejected(text)
      : new Error(text)
  }
  if (vendor === 'openai') {
    const output: { type?: string; content?: { type?: string; text?: string }[] }[] = body?.output ?? []
    const text = output
      .filter(o => o.type === 'message')
      .flatMap(o => o.content ?? [])
      .filter(c => c.type === 'output_text' && typeof c.text === 'string')
      .map(c => c.text)
      .join('')
      .trim()
    if (!text) throw new Error(body?.incomplete_details?.reason ? `Empty reply (${body.incomplete_details.reason})` : 'Empty reply')
    return text
  }
  if (vendor === 'xai') {
    const text = body?.choices?.[0]?.message?.content
    if (typeof text !== 'string' || !text.trim()) throw new Error('Empty reply')
    return text.trim()
  }
  const candidate = body?.candidates?.[0]
  const parts: { text?: string; thought?: boolean }[] = candidate?.content?.parts ?? []
  const text = parts
    .filter(p => !p.thought && typeof p.text === 'string')
    .map(p => p.text)
    .join('')
    .trim()
  if (!text) {
    const why = candidate?.finishReason ?? body?.promptFeedback?.blockReason
    throw new Error(why ? `Empty reply (${why})` : 'Empty reply')
  }
  return text
}

export function modelsRequest(vendor: Vendor, key: string): Request {
  if (vendor === 'gemini') {
    return {
      url: 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000',
      init: { headers: { 'x-goog-api-key': key } },
    }
  }
  const base = vendor === 'xai' ? 'https://api.x.ai' : 'https://api.openai.com'
  return { url: `${base}/v1/models`, init: { headers: { Authorization: `Bearer ${key}` } } }
}

/** The vendor's chat models, newest first. */
export function parseModels(vendor: Vendor, res: HttpResponse): SecondOpinionModel[] {
  const body = parseJson(res.text)
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${errorMessage(body, 'list failed')}`)
  const keep = VENDORS[vendor].keep
  if (vendor === 'gemini') {
    const models: { name: string; displayName?: string; supportedGenerationMethods?: string[] }[] =
      body?.models ?? []
    return models
      .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
      .map(m => ({ id: m.name.replace(/^models\//, ''), name: m.displayName }))
      .filter(m => keep(m.id))
      .filter((m, _, all) => isNewestOfFamily(m.id, all.map(o => o.id)))
      .sort((a, b) => geminiFamily(b.id).version - geminiFamily(a.id).version || a.id.localeCompare(b.id))
  }
  const models: { id: string; created?: number }[] = body?.data ?? []
  return models
    .filter(m => keep(m.id))
    .sort((a, b) => (b.created ?? 0) - (a.created ?? 0) || b.id.localeCompare(a.id, undefined, { numeric: true }))
    .map(m => ({ id: m.id }))
}

// Gemini lists every release of each family (Flash 3.5, 3.6, 3.7, 3.8…);
// only the newest of each is worth a review.
// `gemini-3.8-flash` → flash 3.8, `gemini-omni-1.1-flash` → omni-flash 1.1,
// `gemini-3.1-pro-preview` → pro 3.1 (preview).
function geminiFamily(id: string): { family: string; version: number; isPreview: boolean } {
  const isPreview = /-preview$/.test(id)
  const rest = id.replace(/^gemini-/, '').replace(/-preview$/, '')
  const version = /(?:^|-)(\d+(?:\.\d+)?)(?=-|$)/.exec(rest)?.[1]
  const family = rest
    .split('-')
    .filter(part => part !== version)
    .join('-')
  return { family, version: version ? Number(version) : 0, isPreview }
}

function isNewestOfFamily(id: string, ids: string[]): boolean {
  const me = geminiFamily(id)
  return !ids.some(other => {
    const them = geminiFamily(other)
    if (other === id || them.family !== me.family) return false
    // Newer wins; at the same version the released model beats its preview.
    return them.version > me.version || (them.version === me.version && me.isPreview && !them.isPreview)
  })
}

// OpenAI and Gemini nest the message under `error`; xAI sends `error` as a string.
function errorMessage(body: any, fallback: string): string { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (typeof body?.error === 'string') return body.error
  return body?.error?.message ?? fallback.slice(0, 300)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseJson(text: string): any {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}
