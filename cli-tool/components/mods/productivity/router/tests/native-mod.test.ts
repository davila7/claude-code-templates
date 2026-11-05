import type { PluginState } from 'claude-code';
import { expect, mock, test } from 'claude-code/testing';

test('terminal and desktop panes show observed usage, cost scenarios and native controls', async ($, on) => {
  mock.store(on);
  on('session.id', () => ({ value: 'ui-controls' }));
  on('session.model', () => ({ value: 'claude-sonnet-5-5' }));
  on('session.usage', () => ({
    value: {
      startedAt: 0,
      context: { tokens: 150_000, window: 1_000_000 },
      rateLimits: [],
      cost: { usd: 0.25 },
    },
  }));
  on('ui.log', () => ({ value: undefined }));
  let view: PluginState['router']['view'] = {
    phase: 'routed',
    mode: 'auto',
    nativeModel: 'claude-sonnet-5-5',
    selectedModel: 'claude-haiku-5-5',
    actualModel: 'claude-haiku-5-5',
    effort: null,
    reason: 'pinned',
    error: null,
    credentials: { jev: null, clef: 'missing-key', 'clef-flash': 'missing-account' },
    pendingPin: null,
    inputTokens: 150_000,
    outputTokens: 500,
    contextTokens: 150_000,
    contextKnown: true,
    cacheRead: 120_000,
    cacheWrite: 25_000,
    history: [100_000, 150_000, 120_000],
    tiers: ['low', 'micro', 'low'],
    adviceMs: 390,
    comparison: {
      incumbent: 'low',
      candidate: 'micro',
      minUsd: -0.02,
      maxUsd: 0.03,
      paybackTurns: 3,
      outputTokens: 500,
    },
  };
  on('state.get', { plugin: 'router', key: 'view' }, () => ({ value: { value: view, version: 1 } }));
  on('state.set', { plugin: 'router', key: 'view' }, (_$, e) => {
    view = e.value;
    return { value: { isSet: true, version: 2 } };
  });
  for (const surface of ['terminal', 'desktop'] as const) {
    const pane = await $.ui.mount({
      plugin: 'router',
      surface,
      component: 'Pane',
      requestId: 'jev-router',
      viewport: { columns: 60, rows: 32 },
      props: {
        title: 'Router',
        isFocused: true,
        bodyColumns: 60,
        placement: 'dock',
        scroll: { offset: 0, bodyRows: 32 },
        view: {},
      },
    });
    expect(await pane.find({ type: 'Text', text: /Context.*15%.*1.00M/ })).toBeDefined();
    expect(await pane.find({ type: 'Text', text: /Cache.*80%/ })).toBeDefined();
    expect(await pane.find({ type: 'Text', text: /2 switches/ })).toBeDefined();
    await pane.press({ key: 'tab-usage' });
    await pane.redraw();
    expect(await pane.find({ type: 'Text', text: /Cost.*\$0.250/ })).toBeDefined();
    expect(await pane.find({ type: 'Text', text: /Next-turn difference\s+−\$0.020 to \+\$0.030/ })).toBeDefined();
    await pane.press({ key: 'help' });
    await pane.redraw();
    expect(await pane.find({ type: 'Text', text: /Routing savings are not measured/ })).toBeDefined();
    await pane.press({ key: 'help' });
    await pane.redraw();
    expect(await pane.find({ type: 'Text', text: /Routing savings are not measured/ })).toBeUndefined();
    await pane.press({ key: 'tab-classifier' });
    await pane.redraw();
    expect(await pane.find({ key: 'classifier-jev' })).toBeDefined();
    expect(await pane.find({ key: 'classifier-clef-flash' })).toBeDefined();
    expect(await pane.find({ key: 'key-clef' })).toBeDefined();
    expect(await pane.find({ key: 'timeoutMs' })).toBeDefined();
    expect(await pane.find({ type: 'Text', text: /no account ID/ })).toBeDefined();
    await pane.press({ key: 'tab-routing' });
    await pane.redraw();
    expect(await pane.find({ key: 'route-model-medium' })).toBeDefined();
    expect(await pane.find({ type: 'Text', text: /same model, new effort/ })).toBeDefined();
    await pane.press({ key: 'tab-now' });
    await pane.redraw();
    await pane.press({ key: 'manual' });
    expect(view.mode).toBe('manual');
    await pane.press({ key: 'auto' });
    expect(view.mode).toBe('auto');
    await pane.press({ key: 'pin-high' });
    expect(view.pendingPin).toBe('high');
    await pane.unmount();
  }
});

test('unknown readings remain unknown and the band preserves other Mods', async ($, on) => {
  on('env.get', { name: 'JEV_ROUTER_MODE' }, () => ({ value: undefined }));
  mock.store(on);
  on('session.id', () => ({ value: 'ui-empty' }));
  on('session.model', () => ({ value: 'claude-sonnet-5-5' }));
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 1_000_000 }, rateLimits: [] } }));
  on('state.get', { plugin: 'router', key: 'view' }, () => ({ value: { value: undefined, version: 0 } }));
  on('ui.render', () => ({ type: 'Text', props: {}, children: ['other mod'] }));
  for (const surface of ['terminal', 'desktop'] as const) {
    const pane = await $.ui.mount({
      plugin: 'router',
      surface,
      component: 'Pane',
      requestId: 'jev-router',
      viewport: { columns: 48, rows: 24 },
      props: {
        title: 'Router',
        isFocused: true,
        bodyColumns: 48,
        placement: 'dock',
        scroll: { offset: 0, bodyRows: 24 },
        view: {},
      },
    });
    expect(await pane.find({ type: 'Text', text: /Cost.*not reported/ })).toBeDefined();
    expect(await pane.find({ type: 'Text', text: /Cache.*unknown/ })).toBeDefined();
    await pane.unmount();
    const band = await $.ui.mount({
      plugin: 'router',
      surface,
      component: 'AbovePrompt',
      requestId: 'band',
      viewport: { columns: 60, rows: 24 },
      props: {
        hasSurvey: false,
        isWorking: false,
        maxRows: 4,
        bodyColumns: 60,
        scroll: { offset: 0, bodyRows: 4 },
        view: {},
      },
    });
    expect(await band.find({ type: 'Text', text: 'other mod' })).toBeDefined();
    expect(await band.find({ key: 'details' })).toBeDefined();
    expect(await band.find({ key: 'band-detail' })).toBeDefined();
    await band.unmount();
  }
});
