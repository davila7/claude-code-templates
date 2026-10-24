import { renderBand, switchToast } from '../lib/band.mjs';
import { ClassifierClient } from '../lib/classifier-client.mjs';
import { resolveCredentials } from '../lib/classifier-contract.mjs';
import {
  activeClassifier,
  DEFAULTS,
  effectiveRoutes,
  loadConfig,
  MIGRATION_HINT,
  supportedVersion,
  TIERS,
  tuningOf,
  withClassifier,
  withClassifierTimeout,
  withRoutes,
  withTuning,
} from '../lib/config.mjs';
import { changedLeaves, notSaved, restored, rewrittenConfig } from '../lib/config-file.mjs';
import {
  classifierStatus,
  classifierTimed,
  GATEWAY_CLEANUP,
  GATEWAY_SETTINGS,
  missingCredentials,
} from '../lib/display.mjs';
import { clip } from '../lib/facts.mjs';
import { renderPanel, routeDraftOf, routingChanges } from '../lib/panel.mjs';
import {
  chooseRoute,
  continueRoute,
  emptyLoop,
  isModelAllowed,
  isNativeFallback,
  isSameModel,
  nativeFacts,
  observeResponse,
  prepareLoop,
  resetHistory,
  tierForModel,
} from '../lib/route.mjs';
import { CLEARED_READINGS, healthOf, initialView, responseMetrics } from '../lib/view.mjs';

// The engine follows $ only into functions declared in this file, never across an import: every helper that takes $
// lives here, and the pure parts live in lib/.

const VIEW = { plugin: 'router', key: 'view' };
const LOOP = { plugin: 'router', key: 'loops' };
const PANE = 'jev-router';
const PANE_TITLE = 'Router';
const BAND_DETAIL = 'band:detail';
const MODE_PREFIX = 'mode:';

// Everything the hooks change between events, in one object `register()` creates and passes to its helpers. Module
// variables, not $.state: a reload starts them over, and the view is written through to $.state as it changes.
function createRouter(options) {
  return {
    options,
    config: loadConfig(),
    // Each turn's config, fixed at turn.start, so a pane save mid-turn does not change the turn.
    turnConfigs: new Map(),
    // One client per classifier, each with its own breaker and in-flight slot: a turn that started under one
    // classifier finishes with it, and its answer, failures or pause never land on another.
    clients: new Map(),
    prompts: new Map(),
    decisions: new Map(),
    controllers: new Set(),
    turnControllers: new Map(),
    view: null,
    modes: new Map(),
  };
}

function clientOf(router, id) {
  if (!router.clients.has(id)) router.clients.set(id, new ClassifierClient());
  return router.clients.get(id);
}

// `router.view` is a write-through cache of $.state, because state reads are frozen within one dispatch.
async function readView($, router) {
  return (await $.state.get(VIEW)).value ?? router.view ?? initialView(await $.session.model());
}

// Only a saved mode is cached: the engine can draw the band before session.start, and a cached fallback from that
// render would override the start rule.
async function modeOf($, router, fallback = 'auto') {
  const sessionId = await $.session.id();
  if (router.modes.has(sessionId)) return router.modes.get(sessionId);
  try {
    const saved = await $.store.get(`${MODE_PREFIX}${sessionId}`);
    if (saved !== 'manual' && saved !== 'auto') return fallback;
    router.modes.set(sessionId, saved);
    return saved;
  } catch {
    return 'manual';
  }
}

// A saved preference wins; a fresh session starts Auto on a model some tier routes to and Manual on any other.
async function startMode($, router, model) {
  const mode = await modeOf($, router, tierForModel(router.config, model) === null ? 'manual' : 'auto');
  router.modes.set(await $.session.id(), mode);
  return mode;
}

async function rememberMode($, mode) {
  try {
    await $.store.set(`${MODE_PREFIX}${await $.session.id()}`, mode);
    return true;
  } catch {
    return false;
  }
}

async function updateView($, router, patch) {
  const value = router.view ?? (await readView($, router));
  router.view = { ...value, ...patch };
  await $.state.set(VIEW, router.view);
}

// A notice answers the last press in the pane, so the pane opens without one; the last write keeps its Undo in the
// status bar.
async function openPane($, router) {
  await updateView($, router, { notice: null });
  await $.ui.open({ id: PANE, title: PANE_TITLE, focus: true, closeOnEscape: true });
}

async function changeMode($, router, mode) {
  const view = router.view ?? (await readView($, router));
  for (const controller of router.controllers) controller.abort();
  router.modes.set(await $.session.id(), mode);
  const saved = await rememberMode($, mode);
  await updateView($, router, {
    mode,
    pendingPin: null,
    phase: view.phase === 'unavailable' ? 'unavailable' : mode === 'manual' ? 'manual' : 'ready',
    reason: mode === 'manual' ? 'routing paused' : 'ready',
    ...(!saved ? { notice: 'Mode changed for this session. Resume preference could not be saved.' } : {}),
  });
}

async function setPin($, router, tier) {
  const view = router.view ?? (await readView($, router));
  if (view.phase === 'unavailable') return `Routing unavailable: ${view.error}.`;
  const mode = await modeOf($, router, view.mode);
  if (mode === 'manual') return 'Routing is paused. Select Auto before pinning a turn.';
  await updateView($, router, { pendingPin: tier });
  return `${tier} pinned for the next turn and its tool continuations.`;
}

// The environment variables that stand in for a classifier option: its upper-case name, then the one Claude Code
// exports for a plugin option. Spelled out because $.env.get takes literal names only. Cases: CLASSIFIER_OPTIONS.
async function envSettingOf($, name) {
  switch (name) {
    case 'typesafe_api_key':
      return (await $.env.get('TYPESAFE_API_KEY')) || (await $.env.get('CLAUDE_PLUGIN_OPTION_TYPESAFE_API_KEY'));
    case 'cloudflare_api_token':
      return (
        (await $.env.get('CLOUDFLARE_API_TOKEN')) || (await $.env.get('CLAUDE_PLUGIN_OPTION_CLOUDFLARE_API_TOKEN'))
      );
    case 'cloudflare_account_id':
      return (
        (await $.env.get('CLOUDFLARE_ACCOUNT_ID')) || (await $.env.get('CLAUDE_PLUGIN_OPTION_CLOUDFLARE_ACCOUNT_ID'))
      );
    default:
      return null;
  }
}

// A plugin option, else its environment variables.
async function settingOf($, options, name) {
  const value = options[name];
  if (typeof value === 'string' && value.trim()) return value.trim();
  return ((await envSettingOf($, name)) ?? '').trim() || null;
}

// The credentials error, or null, of every configured classifier: the pane lists them all.
async function credentialsOf($, options, config) {
  const lookup = (name) => settingOf($, options, name);
  return Object.fromEntries(
    await Promise.all(
      Object.entries(config.classifiers).map(async ([id, entry]) => [
        id,
        (await resolveCredentials(entry, lookup)).missing,
      ]),
    ),
  );
}

// The host refuses $.command.run from a hook the turn is holding, so the secure key dialog opens from a timer.
function openKeySettings($) {
  $.clock.after(0, () => $.command.run({ command: 'plugin', args: `configure ${$.plugin.name}` }).catch(() => {}));
}

async function loadNativeConfig($) {
  for (const source of ['project', 'local']) {
    const settings = await $.settings.read({ source });
    if (settings.env && ['HOME', 'CLAUDE_CONFIG_DIR'].some((key) => Object.hasOwn(settings.env, key)))
      throw new Error('project settings cannot redirect the router profile');
  }
  const home = await $.env.get('HOME');
  const profile = (await $.env.get('CLAUDE_CONFIG_DIR')) ?? `${home}/.claude`;
  const path = `${profile}/router.json`;
  const userFile = (await $.fs.exists(path)) ? JSON.parse(await $.fs.read(path)) : null;
  return { ...loadConfig({ userFile }), nativePath: path };
}

// Writes router.json through `change(previousFile)` once the result validates. Returns the new config or an error
// line for the pane; a failure leaves the file untouched.
async function saveConfig($, path, change) {
  try {
    if ((await $.fs.exists(path)) && (await $.fs.stat(path)).isLink)
      return { error: 'Not saved: router.json is a symlink. Edit its maintained source instead.' };
    const { config, text } = rewrittenConfig((await $.fs.exists(path)) ? await $.fs.read(path) : null, change);
    await $.fs.write(path, text);
    return { config: { ...config, nativePath: path } };
  } catch (error) {
    return { error: notSaved(error) };
  }
}

function detailText(config, view) {
  const missing = missingCredentials(view, config.classifier);
  return [
    `Router — ${view.mode === 'auto' ? 'Auto' : 'Manual'}`,
    `Native model: ${view.nativeModel}`,
    `Selected: ${view.selectedModel ?? 'not selected'}`,
    `Observed: ${view.actualModel ?? 'no response yet'}`,
    `Reason: ${view.reason}`,
    view.error || missing ? classifierStatus(config, view.error ?? missing) : `${activeClassifier(config).label} ready`,
    `Context: ${view.contextKnown ? `${view.contextTokens} tokens (estimate)` : 'unknown'}`,
    `Observed cache: ${view.cacheRead ?? 'unknown'} read, ${view.cacheWrite ?? 'unknown'} written tokens`,
    view.pendingPin ? `Next turn pin: ${view.pendingPin}` : 'No next-turn pin.',
    'Auto enables routing. Manual preserves Claude’s model. Pins serve one turn only.',
    'Cache lifetime is an estimate. Claude’s cost ledger owns session totals.',
    ...(view.error === GATEWAY_SETTINGS ? GATEWAY_CLEANUP : []),
  ].join('\n');
}

async function contextOf($, loop) {
  const previous = loop.lastRequest ? loop.lastRequest.tokens + loop.lastRequest.outputTokens : null;
  try {
    const usage = await $.session.usage({ breakdown: 'summary' });
    const estimate = usage.context.breakdown?.totalTokens;
    const observed = usage.context.tokens;
    const values = [previous, estimate, observed].filter((n) => Number.isFinite(n) && n >= 0);
    return { tokens: values.length ? Math.max(...values) : null, known: Number.isFinite(estimate) };
  } catch {
    return { tokens: previous, known: false };
  }
}

async function* passMain($, e, next, loop, version, nativeModel, reason, router) {
  const ref = { ...LOOP, id: 'main' };
  const context = await contextOf($, loop);
  await updateView($, router, {
    nativeModel,
    selectedModel: e.model,
    effort: e.effort ?? null,
    reason,
    contextTokens: context.tokens,
    contextKnown: context.known,
  });
  const sessionId = await $.session.id();
  const response = yield* next(e);
  if (!next.signal.aborted && (await $.session.id()) === sessionId) {
    const observed = observeResponse(loop, {
      usage: response.usage,
      requestedModel: e.model,
      effort: e.effort ?? null,
      stopReason: response.stopReason,
      now: Date.now(),
    });
    const written = await $.state.set(ref, observed, { ifVersion: version });
    if (written.isSet) await updateView($, router, responseMetrics(router.view, response, null));
  }
  return response;
}

// One turn's classification and route, written to the loop at `loopVersion`: the loop and its new version, or null
// when the turn was aborted, left the session or Auto, or lost the write. `signal` is the step's: its abort cancels
// the classifier call. The pin is the one in `view`, the view as the step read it.
async function decideTurn($, router, e, signal, step) {
  const { sessionId, view, cfg, loop, loopVersion, context, nativeModel, availableModels } = step;
  const ref = { ...LOOP, id: 'main' };
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal.addEventListener('abort', cancel, { once: true });
  router.controllers.add(controller);
  router.turnControllers.set(e.turnId, controller);
  const live = async () => !controller.signal.aborted && (await $.session.id()) === sessionId;
  try {
    const pin = view.pendingPin;
    const credentials = await resolveCredentials(activeClassifier(cfg), (name) => settingOf($, router.options, name));
    const messages = await $.session.messages({ as: 'api' });
    if (!(await live())) return null;
    const facts = nativeFacts(cfg, loop, {
      messages,
      prompt: router.prompts.get(e.turnId),
      effort: e.effort,
      turnId: e.turnId,
      contextTokens: context.tokens,
    });
    await updateView($, router, {
      phase: 'choosing',
      activeTurnId: e.turnId,
      nativeModel,
      pendingPin: null,
      credentials: { ...router.view?.credentials, [cfg.classifier]: credentials.missing },
    });
    const adviceStarted = Date.now();
    const result = pin
      ? { advice: null, error: null }
      : await clientOf(router, cfg.classifier).ask({
          request: (url, init) => $.http.fetch(url, init),
          sleep: (ms, args) => $.clock.sleep(ms, args),
          config: cfg,
          apiKey: credentials.apiKey,
          endpoint: credentials.endpoint,
          prompt: facts.prompt,
          turns: facts.turns,
          signal: controller.signal,
        });
    if (controller.signal.aborted || (await $.session.id()) !== sessionId || (await modeOf($, router)) !== 'auto')
      return null;
    const previous = loop.decision;
    const selected = chooseRoute(cfg, loop, {
      facts,
      advice: result.advice,
      pin,
      nativeModel,
      contextKnown: context.known,
      availableModels,
      now: Date.now(),
    });
    selected.engineModel = e.model;
    const written = await $.state.set(ref, selected, { ifVersion: loopVersion });
    // Manual, /clear and turn completion abort the controller; one may land during the write.
    if (!written.isSet || controller.signal.aborted) return null;
    if (previous?.model && previous.model !== selected.decision.model && !selected.decision.pinned)
      $.ui.toast(switchToast(cfg, previous, selected.decision, selected.decision.estimate));
    await updateView($, router, {
      phase: 'routed',
      selectedModel: selected.decision.model,
      actualModel: null,
      tier: selected.decision.tier,
      effort: selected.decision.effort,
      reason: selected.decision.reason,
      contextTokens: context.tokens,
      contextKnown: context.known,
      comparison: selected.decision.comparison,
      // A turn that started before a classifier switch routes on its own classifier's answer, but the
      // pane now labels the new one: its readings stay off the view.
      ...(cfg.classifier === router.config.classifier
        ? {
            error: result.error,
            health: healthOf(clientOf(router, cfg.classifier), cfg.classifier),
            adviceMs: pin || !classifierTimed(result.error) ? null : Date.now() - adviceStarted,
            adviceChoice: result.advice?.choice ?? null,
            probabilities: result.advice?.probabilities ?? null,
            estimate: selected.decision.estimate ?? null,
          }
        : {}),
    });
    return { loop: selected, version: written.version };
  } finally {
    signal.removeEventListener('abort', cancel);
    router.controllers.delete(controller);
    if (router.turnControllers.get(e.turnId) === controller) router.turnControllers.delete(e.turnId);
  }
}

// The pane's handlers. `view` is the view the pane was drawn from; a handler reads `router.view` first, which holds
// any press since.
function paneActions($, router, view) {
  const editRoute = (tier, change) => {
    const draft = routeDraftOf(router.config, router.view ?? view);
    const current = effectiveRoutes(draft, router.config).routes[tier];
    return updateView($, router, {
      routeDraft: { ...draft, routes: { ...draft.routes, [tier]: change(current) } },
      notice: null,
    });
  };
  // Every pane save adopts the file as written, which may name another classifier than before: a hand edit
  // meanwhile, or a row press. Then the new classifier starts clean and the old one's readings leave the view;
  // an unavailable reason stays.
  const adopt = async (loaded) => {
    const switched = loaded.classifier !== router.config.classifier;
    router.config = loaded;
    if (!switched) return {};
    clientOf(router, router.config.classifier).restore(null);
    const current = router.view ?? view;
    return {
      ...CLEARED_READINGS,
      error: current.phase === 'unavailable' ? current.error : null,
      credentials: await credentialsOf($, router.options, router.config),
      health: healthOf(clientOf(router, router.config.classifier), router.config.classifier),
    };
  };
  // Pending drafts re-pointed at the config a write just adopted. An edit that still differs stays; everything else
  // follows the file, and the file becomes what the draft compares against, so picking a value the write replaced
  // counts as a change again.
  const rebased = ({ routeDraft, tuning, tuningBase }) => {
    const routes = routeDraft && effectiveRoutes(routeDraft, router.config);
    const edited = Object.entries(tuning ?? {}).filter(([key, value]) => value !== tuningBase?.[key]);
    return {
      routeDraft: routes ? { ...routes, base: routeDraftOf(router.config, {}).base } : null,
      tuning: edited.length ? Object.fromEntries(edited) : null,
      tuningBase: edited.length ? tuningOf(router.config) : null,
    };
  };
  const save = async (change, saved) => {
    const result = await saveConfig($, router.config.nativePath, change);
    if (result.error) return updateView($, router, { notice: result.error });
    const drafts = router.view ?? view;
    const reset = await adopt(result.config);
    return updateView($, router, { ...reset, ...rebased(drafts), ...saved(router.config) });
  };
  // Defaults go into the routing draft like any edit; the notice says whether Save has anything of that section left
  // to write.
  const loadDefaults = (patch, what) => {
    const changes = routingChanges(router.config, { ...(router.view ?? view), ...patch });
    const pending = what === 'route' ? changes.tiers.length + Number(changes.baseline) : changes.policy.length;
    return updateView($, router, {
      ...patch,
      notice: pending
        ? `${what === 'route' ? 'Route' : 'Policy'} defaults loaded. Save removes your ${what} overrides from router.json.`
        : `${what === 'route' ? 'Routes' : 'Policy'} already at defaults.`,
    });
  };
  // A pane write keeps the leaves it changed as router.json had them, read from the file it rewrites rather than from
  // the loaded config, so Undo restores them verbatim. A later write replaces them, and Undo clears them.
  const write = (label, change, patch = {}) => {
    let leaves = [];
    return save(
      (file) => {
        const written = change(file);
        leaves = changedLeaves(file, written);
        return written;
      },
      () => ({ ...patch, lastWrite: { label, leaves }, notice: `Saved: ${label}. Applies from the next turn.` }),
    );
  };
  return {
    mode: (mode) => changeMode($, router, mode),
    tab: (tab) => updateView($, router, { tab, notice: null }),
    help: () => updateView($, router, { help: !(router.view ?? view).help }),
    pin: async (tier) => {
      await updateView($, router, { notice: await setPin($, router, tier) });
    },
    unpin: () => updateView($, router, { pendingPin: null, notice: null }),
    key: async () => {
      openKeySettings($);
      await $.ui.close({ id: PANE });
    },
    copyPath: async (press) => {
      await $.ui.copy({ text: router.config.nativePath, surface: press?.surface });
      await updateView($, router, { notice: 'Path copied.' });
    },
    close: () => $.ui.close({ id: PANE }),
    routeModel: (tier, alias) =>
      editRoute(tier, (route) => ({
        model: alias,
        effort: router.config.models[alias]?.efforts.includes(route.effort) ? route.effort : null,
      })),
    routeEffort: (tier, effort) => editRoute(tier, (route) => ({ model: route.model, effort })),
    baseline: async (tier) => {
      const draft = routeDraftOf(router.config, router.view ?? view);
      await updateView($, router, { routeDraft: { ...draft, baselineTier: tier }, notice: null });
    },
    saveRouting: async () => {
      const current = router.view ?? view;
      const routeDraft = current.routeDraft;
      const saved = tuningOf(router.config);
      const base = current.tuningBase ?? saved;
      const edited = Object.keys(current.tuning ?? {}).filter((key) => current.tuning[key] !== base[key]);
      const changes = routingChanges(router.config, current).count;
      if (!changes) return updateView($, router, { notice: 'No routing changes to save.' });
      const after = Object.fromEntries(edited.map((key) => [key, current.tuning[key]]));
      return write(
        `${changes} routing change${changes === 1 ? '' : 's'}`,
        (file) => {
          const routed = routeDraft ? withRoutes(file, routeDraft) : file;
          return edited.length ? withTuning(routed, { ...base, ...after }, base) : routed;
        },
        { routeDraft: null, tuning: null, tuningBase: null },
      );
    },
    discardRouting: () => updateView($, router, { routeDraft: null, tuning: null, tuningBase: null, notice: null }),
    resetRoutes: () =>
      loadDefaults(
        {
          routeDraft: {
            ...structuredClone({ routes: DEFAULTS.routes, baselineTier: DEFAULTS.baselineTier }),
            base: routeDraftOf(router.config, {}).base,
          },
        },
        'route',
      ),
    tune: (key, value) =>
      updateView($, router, {
        tuning: { ...(router.view ?? view).tuning, [key]: value },
        tuningBase: (router.view ?? view).tuningBase ?? tuningOf(router.config),
        notice: null,
      }),
    resetPolicy: () =>
      loadDefaults(
        // The draft is replaced whole, so it starts from the saved values, not from an older draft's base.
        { tuning: tuningOf(DEFAULTS), tuningBase: tuningOf(router.config) },
        'policy',
      ),
    classifier: (id) => {
      const { config } = router;
      if (!id || id === config.classifier || !Object.hasOwn(config.classifiers, id)) return undefined;
      const from = config.classifier;
      return write(`classifier ${config.classifiers[from].label} → ${config.classifiers[id].label}`, (file) =>
        withClassifier(file, id),
      );
    },
    classifierTimeout: (timeoutMs) => {
      const active = activeClassifier(router.config);
      if (timeoutMs === active.timeoutMs) return undefined;
      return write(`${active.label} deadline ${active.timeoutMs} → ${timeoutMs} ms`, (file) =>
        withClassifierTimeout(file, router.config.classifier, timeoutMs),
      );
    },
    undo: async () => {
      const last = (router.view ?? view).lastWrite;
      if (!last) return undefined;
      return save(
        (file) => restored(file, last.leaves),
        () => ({ lastWrite: null, notice: `Undid: ${last.label}.` }),
      );
    },
  };
}

export function register(on, options) {
  const router = createRouter(options);

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'router',
      description: 'Open the Router pane, or switch routing: auto, off, pin <tier>.',
      argumentHint: '[auto|off|pin <tier>]',
      immediate: true,
    });
    const model = await $.session.model();
    try {
      router.config = await loadNativeConfig($);
      const existing = await readView($, router);
      router.view = existing;
      const sameClassifier = existing.health?.classifier === router.config.classifier;
      clientOf(router, router.config.classifier).restore(sameClassifier ? existing.health : null);
      const base = await $.env.get('ANTHROPIC_BASE_URL');
      const version = await $.session.version().catch(() => null);
      const supported = supportedVersion(version?.version);
      const gateway =
        ['jev-router', 'jev-router[1m]'].includes(model) ||
        model === 'router' ||
        Boolean(base?.includes('127.0.0.1:43170') || base?.includes('localhost:43170'));
      await updateView($, router, {
        nativeModel: model,
        mode: await startMode($, router, model),
        phase: gateway || !supported ? 'unavailable' : 'ready',
        error: !supported ? 'requires Claude Code 2.1.289 or newer' : gateway ? GATEWAY_SETTINGS : null,
        ...(sameClassifier ? {} : CLEARED_READINGS),
        credentials: await credentialsOf($, options, router.config),
        health: healthOf(clientOf(router, router.config.classifier), router.config.classifier),
        configPath: router.config.nativePath,
        tuning: null,
        tuningBase: null,
        routeDraft: null,
        lastWrite: null,
        bandDetail: (await $.store.get(BAND_DETAIL).catch(() => false)) === true,
      });
    } catch (error) {
      await updateView($, router, {
        phase: 'unavailable',
        error: error.message?.endsWith(MIGRATION_HINT)
          ? 'router.json needs migration; run the plugin scripts/migrate-config.mjs with your router.json path'
          : 'invalid router configuration',
      });
    }
    return next(e);
  });

  on('command.run', { command: 'model' }, async ($, e, next) => {
    const result = await next(e);
    if (e.origin.kind !== 'plugin') {
      await changeMode($, router, 'manual');
      await updateView($, router, { nativeModel: await $.session.model(), reason: 'model selected manually' });
    }
    return result;
  });

  on('config.set', { key: 'model' }, async ($, e, next) => {
    const result = await next(e);
    if (!result.deny && e.origin.kind !== 'plugin') {
      await changeMode($, router, 'manual');
      await updateView($, router, { nativeModel: await $.session.model() });
    }
    return result;
  });

  on('command.run', { command: 'router' }, async ($, e) => {
    const [action, tier] = e.args.trim().split(/\s+/);
    if (action === 'auto' || action === 'off') {
      await changeMode($, router, action === 'auto' ? 'auto' : 'manual');
      return { text: action === 'auto' ? 'Auto routing enabled.' : 'Manual mode: Claude’s model is preserved.' };
    }
    if (action === 'pin')
      return { text: TIERS.includes(tier) ? await setPin($, router, tier) : `Choose ${TIERS.join(', ')}.` };
    const storedView = await readView($, router);
    const view = { ...storedView, mode: await modeOf($, router, storedView.mode) };
    if (!(await $.session.surfaces()).length) return { text: detailText(router.config, view) };
    await openPane($, router);
    return {};
  });

  on('turn.start', (_$, e, next) => {
    router.turnConfigs.set(e.turnId, router.config);
    router.prompts.set(e.turnId, clip(e.text, router.config.context.maxTextChars));
    return next(e);
  });

  on('turn.step', async function* ($, e, next) {
    if (e.agentId) return yield* next(e);
    const cfg = router.turnConfigs.get(e.turnId) ?? router.config;
    const sessionId = await $.session.id();
    const nativeModel = await $.session.model();
    const view = await readView($, router);
    const mode = await modeOf($, router, view.mode);
    if (e.index === 0) {
      const saved = await rememberMode($, mode);
      await updateView($, router, {
        mode,
        ...(!saved ? { notice: 'Resume preference could not be saved. Current mode remains active.' } : {}),
      });
    }
    const ref = { ...LOOP, id: 'main' };
    const loaded = await $.state.get(ref);
    let loopVersion = loaded.version;
    let loop = prepareLoop(loaded.value ?? emptyLoop(cfg, e.model), e.messageCount);
    if (view.phase === 'unavailable' || mode === 'manual') {
      return yield* passMain($, e, next, loop, loopVersion, nativeModel, 'manual', router);
    }
    if (loop.turnId === e.turnId && isNativeFallback(loop, e.model)) {
      return yield* passMain($, e, next, loop, loopVersion, nativeModel, 'native-fallback', router);
    }
    const context = await contextOf($, loop);
    const settings = await $.settings.read();
    const availableModels = settings.availableModels;
    const key = `${sessionId}:${e.turnId}:${loop.generation}`;
    if (loop.turnId !== e.turnId) {
      let job = router.decisions.get(key);
      if (!job) {
        job = decideTurn($, router, e, next.signal, {
          sessionId,
          view,
          cfg,
          loop,
          loopVersion,
          context,
          nativeModel,
          availableModels,
        });
        router.decisions.set(key, job);
      }
      const selected = await job;
      if (!selected) {
        if (!next.signal.aborted && (await $.session.id()) === sessionId && router.view?.activeTurnId === e.turnId) {
          const reserved = await $.state.set(ref, loop, { ifVersion: loopVersion });
          if (reserved.isSet) return yield* passMain($, e, next, loop, reserved.version, nativeModel, 'manual', router);
        }
        return yield* next(e);
      }
      loop = selected.loop;
      loopVersion = selected.version;
    } else {
      loop = continueRoute(cfg, loop, {
        nativeModel,
        contextTokens: context.tokens,
        contextKnown: context.known,
        availableModels,
        effort: e.effort,
      });
      await updateView($, router, {
        selectedModel: loop.decision.model,
        effort: loop.decision.effort,
        tier: loop.decision.tier,
        reason: loop.decision.reason,
        contextTokens: context.tokens,
        contextKnown: context.known,
      });
    }
    const request = { ...e, model: loop.decision.model };
    if (loop.decision.effort === null) delete request.effort;
    else request.effort = loop.decision.effort;
    const response = yield* next(request);
    if (!next.signal.aborted && (await $.session.id()) === sessionId) {
      const observed = observeResponse(loop, {
        usage: response.usage,
        requestedModel: request.model,
        effort: request.effort ?? null,
        stopReason: response.stopReason,
        now: Date.now(),
      });
      if (response.stopReason === null) observed.suspended = true;
      const written = await $.state.set(ref, observed, { ifVersion: loopVersion });
      // A substituted reply is not the tier's: the strip and trend must not count it as one.
      const tier = isSameModel(request.model, response.usage?.model) ? loop.decision.tier : null;
      if (written.isSet) await updateView($, router, responseMetrics(router.view, response, tier));
    }
    return response;
  });

  on('turn.complete', async ($, e, next) => {
    router.turnConfigs.delete(e.turnId);
    router.turnControllers.get(e.turnId)?.abort();
    if (router.view?.activeTurnId === e.turnId && router.view.phase === 'choosing') {
      router.view = { ...router.view, activeTurnId: null };
      const mode = await modeOf($, router);
      if (router.view.activeTurnId === null)
        await updateView($, router, { phase: mode === 'manual' ? 'manual' : 'ready', reason: 'interrupted' });
    }
    router.prompts.delete(e.turnId);
    for (const key of router.decisions.keys()) if (key.includes(`:${e.turnId}:`)) router.decisions.delete(key);
    return next(e);
  });

  on('session.compact', async ($, e, next) => {
    const result = await next(e);
    // Only the main conversation is routed, so an agent compaction changes nothing here.
    if (!result.skip && e.trigger !== 'precompute' && !e.agentId) {
      const ref = { ...LOOP, id: 'main' };
      const loop = (await $.state.get(ref)).value;
      if (loop) await $.state.set(ref, resetHistory(loop));
      for (const controller of router.controllers) controller.abort();
    }
    return result;
  });

  on('session.end', (_$, e, next) => {
    for (const controller of router.controllers) controller.abort();
    router.decisions.clear();
    router.prompts.clear();
    router.turnConfigs.clear();
    router.view = {
      ...initialView(router.view?.nativeModel ?? ''),
      mode: 'auto',
      credentials: router.view?.credentials ?? null,
      health: healthOf(clientOf(router, router.config.classifier), router.config.classifier),
      configPath: router.config.nativePath,
      phase: router.view?.phase === 'unavailable' ? 'unavailable' : 'ready',
      error: router.view?.phase === 'unavailable' ? router.view.error : null,
    };
    return next(e);
  });

  // While the classifier runs, the turn's spinner says so; the engine's own word returns once the route is set.
  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    if (e.props.message !== null) return next(e);
    const view = await readView($, router);
    return view.phase === 'choosing' ? next({ ...e, props: { ...e.props, message: 'Choosing model' } }) : next(e);
  });

  // Paused or broken routing stays visible in the prompt footer even when the band is collapsed.
  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    const view = await readView($, router);
    const label =
      view.phase === 'unavailable'
        ? 'router unavailable'
        : (await modeOf($, router, view.mode)) === 'manual'
          ? 'router off'
          : null;
    return label ? next({ ...e, props: { ...e.props, modes: [...e.props.modes, label] } }) : next(e);
  });

  on('ui.render', { component: ['AbovePrompt', 'Pane'] }, async ($, e, next) => {
    if (e.component === 'Pane' && e.requestId !== PANE) return next(e);
    const storedView = await readView($, router);
    const view = { ...storedView, mode: await modeOf($, router, storedView.mode) };
    const elements = $.ui.resolve(e);
    const { Box } = elements;
    const usage = await $.session.usage().catch(() => null);
    if (e.component === 'AbovePrompt') {
      if (e.props.hasSurvey) return next(e);
      return Box({
        flexDirection: 'column',
        children: [
          await next(e),
          renderBand(
            elements,
            router.config,
            view,
            usage,
            { columns: e.props.bodyColumns, agentId: e.props.view?.agentId },
            {
              open: () => openPane($, router),
              mode: (mode) => changeMode($, router, mode),
              pin: async (tier) => $.ui.toast(await setPin($, router, tier)),
              unpin: () => updateView($, router, { pendingPin: null }),
              key: () => openKeySettings($),
              toggleDetail: async () => {
                const bandDetail = !(router.view ?? view).bandDetail;
                await $.store.set(BAND_DETAIL, bandDetail).catch(() => {});
                await updateView($, router, { bandDetail });
              },
            },
          ),
        ],
      });
    }
    const settings = await $.settings.read().catch(() => ({}));
    const modelOptions = Object.keys(router.config.models).filter((alias) =>
      isModelAllowed(router.config.models[alias].id, settings.availableModels, view.nativeModel),
    );
    return renderPanel(elements, router.config, view, usage, paneActions($, router, view), { modelOptions });
  });
}
