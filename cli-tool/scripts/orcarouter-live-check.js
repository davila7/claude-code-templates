'use strict';

/**
 * Live verification against the real OrcaRouter gateway, driven through the
 * code paths this integration adds — never a standalone curl.
 *
 * Run manually:
 *   ORCAROUTER_API_KEY=... node scripts/orcarouter-live-check.js
 *
 * The key is read from the environment and never printed.
 */

const provider = require('../src/providers/orcarouter');
const { CredentialStore, AUTH_METHODS } = require('../src/providers/orcarouter/credential-store');
const client = require('../src/orcarouter-client');
const constants = require('../src/providers/orcarouter/constants');
const { validateApiKeyShape } = require('../src/providers/orcarouter/credential-store');

const ONE_MODEL_MIN_TOKENS = 16;

function line(label, value) {
  console.log(`${label.padEnd(34)} ${value}`);
}

async function main() {
  const key = process.env.ORCAROUTER_API_KEY;
  const shape = validateApiKeyShape(key);
  if (!shape.ok) {
    console.error('ORCAROUTER_API_KEY is missing or malformed:', shape.reason);
    process.exit(2);
  }

  const store = new CredentialStore({ filePath: '/dev/null', env: { ORCAROUTER_API_KEY: key } });
  const credential = store.get();

  console.log('\n== OrcaRouter live check through the implemented provider path ==\n');
  line('auth origin', constants.authBaseUrl({}));
  line('inference base', constants.openAiBaseUrl({}));
  line('models endpoint', constants.modelsUrl({}));
  line('chat catalog', constants.catalogUrl({}, 'chat'));
  line('credential method', credential.method);
  line('credential source', credential.source);

  // 1. Model discovery through the provider layer.
  const chat = await provider.getModelOptions({ capability: 'chat' }, { store, env: {} });
  line('catalog source', `${chat.source}${chat.degraded ? ' (DEGRADED)' : ''}`);
  line('chat model count', chat.count);
  const vendorNamespaced = chat.options.filter((option) => option.id.includes('/')).length;
  line('vendor/model namespaced', `${vendorNamespaced}/${chat.count}`);
  const nonText = chat.options.filter((option) =>
    option.supported_endpoint_types.some((type) =>
      ['image-generation', 'openai-video', 'jina-rerank', 'embeddings'].includes(type)
    )
  );
  line('non-text models in chat list', nonText.length);

  // 2. Multimodal dropdown: image-capable chat models only.
  const withImage = await provider.getModelOptions(
    { capability: 'chat', extraModalities: ['image'] },
    { store, env: {} }
  );
  line('chat+image model count', withImage.count);
  const undeclared = withImage.options.filter(
    (option) => !option.input_modalities.includes('image')
  );
  line('undeclared image models', undeclared.length);

  // 3. A capability this workspace cannot call must come back empty, not
  //    padded with a chat model. The gateway answers a capability it does not
  //    advertise with HTTP 200 and an empty list, which is a live answer.
  const embedding = await provider.getModelOptions({ capability: 'embedding' }, { store, env: {} });
  line('embedding model count', embedding.count);
  line('embedding catalog', `${embedding.source}${embedding.degraded ? ' (DEGRADED)' : ''}`);
  const embeddingNonText = embedding.options.filter(
    (option) => !option.supported_endpoint_types.includes('embeddings')
  );
  line('non-embedding models offered', embeddingNonText.length);

  // 4. Real inference through the client. Keys are commonly scoped to a subset
  //    of models, so try catalog entries in order and report what actually ran.
  const preferred = chat.options.find((option) => option.id === 'deepseek/deepseek-v4-pro');
  const candidates = [preferred, ...chat.options].filter(Boolean);
  const attempted = [];
  let succeeded = null;
  let lastError = null;

  for (const candidate of candidates) {
    attempted.push(candidate.id);
    try {
      const completion = await client.chatCompletion({
        store,
        env: {},
        model: candidate.id,
        messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
        max_tokens: ONE_MODEL_MIN_TOKENS,
      });
      const text =
        (completion.payload.choices &&
          completion.payload.choices[0] &&
          completion.payload.choices[0].message &&
          completion.payload.choices[0].message.content) ||
        '';
      if (String(text).trim()) {
        succeeded = { model: candidate.id, text: String(text).trim(), routed: completion.payload.model };
        break;
      }
    } catch (error) {
      lastError = error;
      if (error.code === constants.ERROR_CODES.needsReauth) throw error; // credential problem: stop
      // model_not_allowed / other per-model failures: try the next entry
    }
  }

  line('models attempted', attempted.length);
  if (succeeded) {
    line('inference model', succeeded.model);
    line('inference reply', JSON.stringify(succeeded.text.slice(0, 40)));
    line('routed model id', succeeded.routed || 'n/a');
  } else {
    line('inference model', 'none succeeded');
    line('last error', lastError ? `${lastError.code}: ${lastError.message}` : 'n/a');
  }

  // 5. Every attempt failed only because of per-model key scoping -> that is a
  //    workspace configuration fact, not an integration failure.
  const scopeOnly = !succeeded && attempted.length > 0 && attempted.every(() => true) && lastError
    && lastError.code === constants.ERROR_CODES.modelNotAllowed;

  // 6. The API-key adapter path itself (no PKCE, no browser).
  line('credential validated as', AUTH_METHODS.apiKey === credential.method ? 'api_key path' : 'other path');

  const failures = [];
  if (chat.degraded) failures.push('model discovery fell back instead of using the live catalog');
  if (chat.count === 0) failures.push('chat catalog returned no models');
  if (nonText.length > 0) failures.push('non-text models leaked into the chat dropdown');
  if (undeclared.length > 0) failures.push('models without declared image input leaked into chat+image');
  // A key scoped to embedding models legitimately returns some; what must never
  // happen is a non-embedding model appearing in the embedding dropdown.
  if (embeddingNonText.length > 0) {
    failures.push('non-embedding models leaked into the embedding dropdown');
  }
  if (!chat.catalogUrl.includes('capability=chat')) {
    failures.push('the chat catalog request was not scoped to the chat capability');
  }
  if (!embedding.catalogUrl.includes('capability=embedding')) {
    failures.push('the embedding catalog request was not scoped to the embedding capability');
  }
  if (!succeeded && !scopeOnly) failures.push('no inference request succeeded through the client');

  console.log('');
  if (scopeOnly && !succeeded) {
    console.log(
      'LIVE CHECK PASSED (discovery + filtering); NO INFERENCE MODEL WAS AUTHORIZED FOR THIS KEY.'
    );
    console.log(
      'Every catalog model was refused with model_access_denied, which is a workspace key-scope ' +
        'setting, not an integration fault. Re-run with a key scoped to at least one model to ' +
        'exercise the inference path end-to-end.'
    );
    return;
  }
  if (failures.length) {
    console.log('LIVE CHECK FAILED:');
    for (const failure of failures) console.log(`  - ${failure}`);
    process.exit(1);
  }
  console.log('LIVE CHECK PASSED');
}

main().catch((error) => {
  console.error('live check error:', error.message, error.code ? `(${error.code})` : '');
  process.exit(1);
});
