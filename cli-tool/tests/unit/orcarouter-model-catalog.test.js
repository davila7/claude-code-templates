'use strict';

const path = require('path');
const fs = require('fs-extra');

const catalog = require('../../src/providers/orcarouter/model-catalog');
const constants = require('../../src/providers/orcarouter/constants');

const FIXTURE = path.join(__dirname, '..', 'fixtures', 'orcarouter', 'models.json');
const RAW = fs.readFileSync(FIXTURE, 'utf8');

function fakeFetch(body, status = 200) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url: String(url), init: init || {} });
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => body,
    };
  };
  impl.calls = calls;
  return impl;
}

function ids(options) {
  return options.map((option) => option.id);
}

describe('catalog parsing', () => {
  test('preserves the vendor/model namespace verbatim', () => {
    const models = catalog.parseCatalog(RAW);
    expect(ids(models)).toContain('openai/gpt-5.5');
    expect(ids(models)).toContain('anthropic/claude-opus-4.8');
    expect(ids(models)).toContain('deepseek/deepseek-v4-pro');
    // nothing is rewritten or trimmed to a bare name
    expect(ids(models).every((id) => id === id.trim())).toBe(true);
  });

  test('drops records it cannot understand instead of guessing', () => {
    const models = catalog.parseCatalog(RAW);
    expect(ids(models)).not.toContain('');
    expect(models.every((model) => typeof model.id === 'string' && model.id.length > 0)).toBe(true);
    // the malformed tail entries produced nothing
    expect(models.length).toBe(12);
  });

  test('keeps context, input modalities and the reasoning ladder', () => {
    const models = catalog.parseCatalog(RAW);
    const gpt = models.find((model) => model.id === 'openai/gpt-5.5');
    expect(gpt.context_length).toBe(400000);
    expect(gpt.input_modalities).toEqual(['file', 'image', 'text']);
    expect(gpt.reasoning_efforts).toEqual(['low', 'medium', 'high', 'xhigh']);
  });

  test('rejects a body that is not a catalog', () => {
    expect(() => catalog.parseCatalog('<html>gateway error</html>')).toThrow(/not valid JSON/);
    expect(() => catalog.parseCatalog('{"object":"list"}')).toThrow(/data/);
  });

  test('accepts both the enveloped and the bare-array shape', () => {
    expect(catalog.parseCatalog(RAW).length).toBe(12);
    const bare = JSON.stringify(JSON.parse(RAW).data);
    expect(catalog.parseCatalog(bare).length).toBe(12);
  });

  test('bounds the number of accepted items', () => {
    const many = JSON.stringify({
      data: Array.from({ length: constants.LIMITS.catalogMaxModels + 50 }, (_, index) => ({
        id: `vendor/model-${index}`,
        supported_endpoint_types: ['openai'],
      })),
    });
    expect(catalog.parseCatalog(many).length).toBe(constants.LIMITS.catalogMaxModels);
  });
});

describe('capability filtering', () => {
  const models = catalog.parseCatalog(RAW);

  test('chat keeps text-capable models and excludes non-text-only endpoints', () => {
    const options = catalog.listModelsFor(models, 'chat');
    const list = ids(options);
    expect(list).toContain('orcarouter/auto');
    expect(list).toContain('openai/gpt-5.5');
    expect(list).toContain('anthropic/claude-opus-4.8');
    expect(list).toContain('deepseek/deepseek-v4-pro');
    expect(list).toContain('text-only/no-modalities-declared');
    // specialised models never appear in a text chat dropdown
    expect(list).not.toContain('some-vendor/image-gen-model');
    expect(list).not.toContain('some-vendor/video-gen-model');
    expect(list).not.toContain('some-vendor/rerank-model');
    expect(list).not.toContain('some-vendor/embedding-model');
  });

  test('a chat option carries the metadata the UI needs', () => {
    const options = catalog.listModelsFor(models, 'chat');
    const gpt = options.find((option) => option.id === 'openai/gpt-5.5');
    expect(gpt).toMatchObject({
      label: 'OpenAI: GPT-5.5',
      context_length: 400000,
      reasoning_efforts: ['low', 'medium', 'high', 'xhigh'],
      source: 'live',
      verified: false,
    });
  });

  test('multimodal chat keeps only models that declare the modality (fail closed)', () => {
    const withImage = ids(catalog.listModelsFor(models, 'chat', ['image']));
    expect(withImage).toContain('openai/gpt-5.5');
    expect(withImage).toContain('anthropic/claude-opus-4.8');
    expect(withImage).toContain('google/gemini-3.5-flash');
    // declared text-only, so it must be filtered out
    expect(withImage).not.toContain('deepseek/deepseek-v4-pro');
    // modality not declared at all -> fail closed
    expect(withImage).not.toContain('some-vendor/undeclared-modality-chat');
    expect(withImage).not.toContain('text-only/no-modalities-declared');
    // non-chat models still excluded
    expect(withImage).not.toContain('some-vendor/image-gen-model');

    const withVideo = ids(catalog.listModelsFor(models, 'chat', ['video']));
    expect(withVideo).toEqual(['google/gemini-3.5-flash']);

    const withAudio = ids(catalog.listModelsFor(models, 'chat', ['audio']));
    expect(withAudio.sort()).toEqual(['google/gemini-3.5-flash', 'some-vendor/audio-chat'].sort());
  });

  test('embedding, image, video and rerank match their endpoint type strictly', () => {
    expect(ids(catalog.listModelsFor(models, 'embedding'))).toEqual(['some-vendor/embedding-model']);
    expect(ids(catalog.listModelsFor(models, 'image'))).toEqual(['some-vendor/image-gen-model']);
    expect(ids(catalog.listModelsFor(models, 'video'))).toEqual(['some-vendor/video-gen-model']);
    expect(ids(catalog.listModelsFor(models, 'rerank'))).toEqual(['some-vendor/rerank-model']);
  });

  test('a capability the catalog does not advertise returns an empty list, never examples', () => {
    const empty = catalog.emptyCapabilityResult('image');
    expect(empty).toEqual({ capability: 'image', options: [], count: 0 });

    const chatOnly = catalog.parseCatalog(
      JSON.stringify({ data: [{ id: 'x/y', supported_endpoint_types: ['openai'] }] })
    );
    expect(catalog.listModelsFor(chatOnly, 'embedding')).toHaveLength(0);
    expect(catalog.listModelsFor(chatOnly, 'image')).toHaveLength(0);
    expect(catalog.listModelsFor(chatOnly, 'rerank')).toHaveLength(0);
  });

  test('capability is never inferred from a model name', () => {
    // A model whose name says "embedding" but whose metadata says chat.
    const misleading = catalog.parseCatalog(
      JSON.stringify({
        data: [
          {
            id: 'vendor/embedding-looking-chat-model',
            name: 'Embedding-Looking Chat Model',
            supported_endpoint_types: ['openai'],
            architecture: { input_modalities: ['text'] },
          },
        ],
      })
    );
    expect(ids(catalog.listModelsFor(misleading, 'chat'))).toEqual([
      'vendor/embedding-looking-chat-model',
    ]);
    expect(catalog.listModelsFor(misleading, 'embedding')).toHaveLength(0);
  });
});

describe('selection validity', () => {
  const models = catalog.parseCatalog(RAW);

  test('a persisted selection is revalidated before it is restored', () => {
    expect(catalog.isSelectionStillValid(models, 'openai/gpt-5.5', 'chat')).toBe(true);
    // no longer chat-capable once an image attachment is added? it still is.
    expect(catalog.isSelectionStillValid(models, 'openai/gpt-5.5', 'chat', ['image'])).toBe(true);
    // text-only model + image attachment -> invalid, must be cleared
    expect(catalog.isSelectionStillValid(models, 'deepseek/deepseek-v4-pro', 'chat', ['image'])).toBe(
      false
    );
    // removed from the catalog entirely
    expect(catalog.isSelectionStillValid(models, 'vendor/retired-model', 'chat')).toBe(false);
    expect(catalog.isSelectionStillValid(models, null, 'chat')).toBe(false);
  });
});

describe('live discovery and fallback', () => {
  test('live success is authoritative and is not merged with the seed', async () => {
    const result = await catalog.resolveCatalog({ fetchImpl: fakeFetch(RAW), url: 'https://api.orcarouter.ai/v1/models' });
    expect(result.degraded).toBe(false);
    expect(result.source).toBe('live');
    expect(result.models.map((model) => model.id)).not.toContain('deepseek/deepseek-v4-pro-0813');
    // exactly the catalog contents, nothing added
    expect(result.models.length).toBe(catalog.parseCatalog(RAW).length);
    expect(result.models.every((model) => model.source === 'live')).toBe(true);
  });

  test('the request goes to the inference origin with the user key, never the auth origin', async () => {
    const fetchImpl = fakeFetch(RAW);
    await catalog.resolveCatalog({
      fetchImpl,
      credential: { key: 'sk-orca-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
      env: {},
    });
    expect(fetchImpl.calls[0].url).toBe('https://api.orcarouter.ai/v1/models?capability=chat');
    expect(fetchImpl.calls[0].url).not.toContain('www.orcarouter.ai');
    expect(fetchImpl.calls[0].init.headers.Authorization).toBe(
      'Bearer sk-orca-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    );
  });

  test('the catalog request is scoped to the capability being selected', async () => {
    for (const [capability, expected] of [
      ['chat', 'https://api.orcarouter.ai/v1/models?capability=chat'],
      ['chat+image', 'https://api.orcarouter.ai/v1/models?capability=chat'],
      ['embedding', 'https://api.orcarouter.ai/v1/models?capability=embedding'],
      ['image', 'https://api.orcarouter.ai/v1/models?capability=image'],
      // No documented filter value: the unscoped catalog is read and the
      // endpoint type is matched strictly instead.
      ['video', 'https://api.orcarouter.ai/v1/models'],
      ['rerank', 'https://api.orcarouter.ai/v1/models'],
    ]) {
      const fetchImpl = fakeFetch(RAW);
      const result = await catalog.resolveCapabilityOptions(capability, { fetchImpl });
      expect(fetchImpl.calls[0].url).toBe(expected);
      expect(result.catalogUrl).toBe(expected);
    }
  });

  test('a failed discovery falls back to the verified seed, flagged as degraded', async () => {
    const result = await catalog.resolveCatalog({
      fetchImpl: fakeFetch('gateway down', 502),
      url: 'https://api.orcarouter.ai/v1/models',
    });
    expect(result.degraded).toBe(true);
    expect(result.source).toBe('verified-fallback');
    expect(result.reason).toBe(constants.ERROR_CODES.catalogUnavailable);
    const fallbackIds = result.models.map((model) => model.id);
    // the documented seed is present and still verified with its metadata
    expect(fallbackIds).toEqual(
      expect.arrayContaining([
        'orcarouter/auto',
        'openai/gpt-5.5',
        'anthropic/claude-opus-4.8',
        'google/gemini-3.5-flash',
        'deepseek/deepseek-v4-pro',
      ])
    );
    const gpt = result.models.find((model) => model.id === 'openai/gpt-5.5');
    expect(gpt.reasoning_efforts).toEqual(['low', 'medium', 'high', 'xhigh']);
    expect(gpt.input_modalities).toContain('image');
    expect(gpt.verified).toBe(true);
  });

  test('an empty capability-scoped catalog is a live answer, not an outage', async () => {
    // The gateway answers a capability it does not advertise with HTTP 200 and
    // `{"data":[],"success":true}`. That is the honest result for that
    // capability and must not be replaced by the chat-shaped verified seed.
    const result = await catalog.resolveCatalog({
      capability: 'embedding',
      fetchImpl: fakeFetch('{"data":[],"object":"list","success":true}'),
    });
    expect(result.degraded).toBe(false);
    expect(result.source).toBe('live');
    expect(result.empty).toBe(true);
    expect(result.models).toEqual([]);
    expect(result.catalogUrl).toContain('capability=embedding');
  });

  test('a network failure falls back instead of throwing', async () => {
    const result = await catalog.resolveCatalog({
      fetchImpl: async () => {
        throw new Error('ENOTFOUND');
      },
    });
    expect(result.degraded).toBe(true);
    expect(result.source).toBe('verified-fallback');
  });

  test('a 401 on the catalog is reported as needing reauthentication', async () => {
    const result = await catalog.resolveCatalog({
      fetchImpl: fakeFetch('{"error":"unauthorized"}', 401),
      credential: { key: 'sk-orca-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
    });
    expect(result.degraded).toBe(true);
    expect(result.reason).toBe(constants.ERROR_CODES.needsReauth);
  });

  test('the verified fallback still filters by capability', async () => {
    const result = await catalog.resolveCapabilityOptions('chat', {
      fetchImpl: fakeFetch('down', 500),
    });
    expect(result.degraded).toBe(true);
    expect(result.options.length).toBeGreaterThan(0);
    expect(result.options.every((option) => option.verified)).toBe(true);

    // the seed has no embedding model, so the embedding dropdown is empty
    const embedding = await catalog.resolveCapabilityOptions('embedding', {
      fetchImpl: fakeFetch('down', 500),
    });
    expect(embedding.count).toBe(0);
    expect(embedding.empty).toBe(true);
  });

  test('capability options are recomputed per capability from the same catalog', async () => {
    const fetchImpl = fakeFetch(RAW);
    const chat = await catalog.resolveCapabilityOptions('chat', { fetchImpl });
    const image = await catalog.resolveCapabilityOptions('chat', {
      fetchImpl,
      extraModalities: ['image'],
    });
    expect(chat.count).toBeGreaterThan(image.count);
    expect(ids(image.options)).not.toContain('deepseek/deepseek-v4-pro');
  });
});
