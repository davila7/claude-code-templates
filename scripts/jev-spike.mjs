#!/usr/bin/env node
/**
 * Fase 0 — spike de medición de Jev, contra cualquiera de los dos backends.
 *
 * Mide latencia (p50/p95) y accuracy de Jev como clasificador de tier de
 * modelo, sobre prompts etiquetados a mano. Sin dependencias: fetch nativo.
 *
 * Uso:
 *   export TYPESAFE_API_KEY=...          # API directa de TypeSafe
 *   # o bien
 *   export AI_GATEWAY_API_KEY=...        # Vercel AI Gateway
 *
 *   node jev-spike.mjs                   # dataset de ejemplo de abajo
 *   node jev-spike.mjs prompts.json      # dataset propio: [{prompt, expected}]
 *   JEV_PROVIDER=gateway node jev-spike.mjs   # forzar backend
 *
 * "expected" es uno de: haiku | sonnet | opus
 *
 * Contratos:
 *   typesafe  POST https://api.typesafe.ai/v1/systemone
 *             body { model, state, questions }; yes/no es "noul";
 *             cada respuesta trae su propio "confidence".
 *             Verificado leyendo @typesafe-ai/sdk v0.6.0.
 *   gateway   POST https://ai-gateway.vercel.sh/v4/ai/evaluation-model
 *             body { state, questions }, modelo en header; yes/no es
 *             "boolean"; NO hay "confidence", hay que derivarlo de
 *             "probabilities", que además es opcional.
 *             Verificado leyendo @ai-sdk/gateway v4.0.86 (no está documentado).
 */

const TYPESAFE_KEY = process.env.TYPESAFE_API_KEY
const GATEWAY_KEY = process.env.AI_GATEWAY_API_KEY

const provider = process.env.JEV_PROVIDER ?? (TYPESAFE_KEY ? 'typesafe' : GATEWAY_KEY ? 'gateway' : null)
if (!provider) {
  console.error('Falta TYPESAFE_API_KEY o AI_GATEWAY_API_KEY')
  process.exit(1)
}

const BACKENDS = {
  typesafe: {
    url: 'https://api.typesafe.ai/v1/systemone',
    key: TYPESAFE_KEY,
    model: process.env.JEV_MODEL ?? 'jev-latest',
    yesNo: 'noul',
    headers(key) {
      return { 'content-type': 'application/json', authorization: `Bearer ${key}` }
    },
    body(state, questions, model) {
      return JSON.stringify({ model, state, questions })
    },
  },
  gateway: {
    url: 'https://ai-gateway.vercel.sh/v4/ai/evaluation-model',
    key: GATEWAY_KEY,
    model: process.env.JEV_MODEL ?? 'typesafe-ai/jev',
    yesNo: 'boolean',
    headers(key, model) {
      return {
        'content-type': 'application/json',
        authorization: `Bearer ${key}`,
        'ai-gateway-auth-method': 'api-key',
        'ai-model-id': model,
        'ai-evaluation-model-specification-version': '4',
      }
    },
    body(state, questions) {
      return JSON.stringify({ state, questions })
    },
  },
}

const backend = BACKENDS[provider]
if (!backend) {
  console.error(`JEV_PROVIDER desconocido: ${provider}`)
  process.exit(1)
}
if (!backend.key) {
  console.error(`Backend "${provider}" elegido pero su key no está en el entorno`)
  process.exit(1)
}

const TIERS = {
  haiku: 'Mechanical and local: read a file, run one command, rename a symbol, answer a fact already in context.',
  sonnet: 'Ordinary engineering: implement a well-specified change across a few files, write tests, fix a clear bug.',
  opus: 'Hard or high-stakes: architecture, debugging an unclear failure, security, migrations, anything touching production.',
}

const QUESTIONS = {
  tier: {
    type: 'choice',
    instructions: 'Which is the cheapest model tier that can complete this coding task well?',
    criteria: TIERS,
  },
  effort: {
    type: 'score',
    instructions: 'How much step-by-step reasoning does this task need?',
    criteria: ['almost none', 'some', 'a lot', 'as much as possible'],
  },
  risky: {
    type: backend.yesNo,
    // Debe preguntar por el acto, no por el tema. La primera version ("the
    // task touches production, money, credentials") daba 0.96 en "agrega un
    // endpoint de refund que llame a Stripe", que es codigo normal.
    instructions:
      'Carrying out this task would itself change production, move real money, or alter data that cannot be restored. Writing or testing code that deals with such things, without running it against the real system, does not count.',
  },
}

async function evaluate(state) {
  const startedAt = performance.now()
  const response = await fetch(backend.url, {
    method: 'POST',
    headers: backend.headers(backend.key, backend.model),
    body: backend.body(state, QUESTIONS, backend.model),
  })
  const ms = performance.now() - startedAt
  const text = await response.text()
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 400)}`)
  return { ms, body: JSON.parse(text) }
}

/** Confianza: explícita en TypeSafe, derivada del máximo de la distribución en el Gateway. */
function confidenceOf(answer) {
  if (typeof answer.confidence === 'number') return answer.confidence
  const probs = answer.probabilities
  return probs ? Math.max(...Object.values(probs)) : null
}

/** P(true): "noul" en TypeSafe, "probability" en el Gateway. */
function riskOf(answer) {
  if (!answer) return null
  if (typeof answer.noul === 'number') return answer.noul
  if (typeof answer.probability === 'number') return answer.probability
  return null
}

const SAMPLE = [
  { prompt: 'Que hace el archivo src/index.js?', expected: 'haiku' },
  { prompt: 'Renombra la variable foo a bar en utils.ts', expected: 'haiku' },
  { prompt: 'Corre los tests', expected: 'haiku' },
  { prompt: 'Agrega un endpoint POST /api/ads/refund que cancele el ad y llame a Stripe', expected: 'sonnet' },
  { prompt: 'Escribe tests para el parser del changelog', expected: 'sonnet' },
  { prompt: 'El webhook de Stripe activa dos ads a la vez a veces. Encuentra por que y arreglalo', expected: 'opus' },
  { prompt: 'Migra la tabla sponsored_ads a un esquema con multiples slots sin downtime', expected: 'opus' },
]

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]
}

const file = process.argv[2]
const { readFileSync } = await import('node:fs')
const dataset = file ? JSON.parse(readFileSync(file, 'utf8')) : SAMPLE

console.log(`backend ${provider} · modelo ${backend.model} · ${dataset.length} prompts\n`)

const latencies = []
let hits = 0
let noConfidence = 0

for (const row of dataset) {
  try {
    const { ms, body } = await evaluate({ prompt: row.prompt })
    latencies.push(ms)

    const tier = body.answers.tier
    const confidence = confidenceOf(tier)
    if (confidence === null) noConfidence++

    const ok = tier.choice === row.expected
    if (ok) hits++

    console.log(
      [
        ok ? 'OK  ' : 'MISS',
        `${Math.round(ms)}ms`.padStart(7),
        tier.choice.padEnd(7),
        `(esperado ${row.expected})`.padEnd(20),
        confidence === null ? 'conf n/d ' : `conf ${confidence.toFixed(2)}`,
        `effort ${body.answers.effort.score.toFixed(2)}`,
        `risky ${(riskOf(body.answers.risky) ?? NaN).toFixed(2)}`,
        row.prompt.slice(0, 60),
      ].join('  '),
    )
  } catch (error) {
    console.error('ERROR', row.prompt.slice(0, 60), '-', error.message)
  }
}

console.log('\n--- resumen ---')
console.log(`backend      ${provider}`)
console.log(`n            ${latencies.length}/${dataset.length}`)
console.log(`accuracy     ${((hits / dataset.length) * 100).toFixed(0)}%`)
if (latencies.length > 0) {
  console.log(`latencia p50 ${Math.round(percentile(latencies, 50))}ms`)
  console.log(`latencia p95 ${Math.round(percentile(latencies, 95))}ms`)
}
if (noConfidence) console.log(`sin confianza en ${noConfidence} respuestas`)
console.log('\nGate: seguir solo si p95 <= 500ms y accuracy >= 80%.')
console.log('Corre los dos backends (JEV_PROVIDER=typesafe|gateway) para compararlos.')
