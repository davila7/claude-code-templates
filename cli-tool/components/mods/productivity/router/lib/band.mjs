import { activeClassifier, TIERS } from './config.mjs';
import {
  classifierLabel,
  classifierStatus,
  classifierWarns,
  GATEWAY_SETTINGS,
  modelName,
  percent,
  routeLabel,
  SHORT_REASONS,
  switchCount,
  TIER_COLOR,
  usageMetrics,
} from './display.mjs';
import { isSameModel } from './route.mjs';

const BARS = '▂▄▆█';
const SEPARATOR = '  ·  ';
// Space the band keeps for the trailing Router button.
const ROUTER_BUTTON = 8;
const STRIP = 20;

const part = (text, style = {}) => ({ text, style });
const button = (props) => ({ button: props });
// `priority` 0 never drops; higher numbers drop first when the band is narrow.
const segment = (priority, ...parts) => ({ priority, parts: parts.flat().filter(Boolean) });
const partWidth = (p) => (p.button ? p.button.label.length + (p.button.plain ? 0 : 4) : p.text.length);
const lineWidth = (segments) =>
  segments.reduce((sum, s, i) => sum + (i ? SEPARATOR.length : 0) + s.parts.reduce((n, p) => n + partWidth(p), 0), 0);

// Drops the highest-priority segments, later ones first on a tie, until the line fits `columns`. If the priority-0
// segments alone are too wide, the later ones go too, and the first is cut with an ellipsis: Ink would otherwise
// shrink every Text in the row and garble it.
export function fitSegments(segments, columns) {
  const kept = [...segments];
  while (lineWidth(kept) > columns && kept.length > 1) {
    let drop = -1;
    kept.forEach((s, i) => {
      if (s.priority > 0 && (drop < 0 || s.priority >= kept[drop].priority)) drop = i;
    });
    kept.splice(drop < 0 ? kept.length - 1 : drop, 1);
  }
  const overflow = lineWidth(kept) - columns;
  if (overflow > 0 && kept.length) {
    const parts = [...kept[0].parts];
    const last = parts.findLastIndex((p) => !p.button && p.text.length > overflow);
    if (last >= 0) parts[last] = { ...parts[last], text: `${parts[last].text.slice(0, -overflow - 1)}…` };
    kept[0] = { ...kept[0], parts };
  }
  return kept;
}

// Signal-strength bars: lit up to the tier in its color, dim above it or when `dim`.
function meter(tier, dim = false) {
  const lit = dim ? -1 : TIERS.indexOf(tier);
  return [...BARS].map((bar, i) => part(bar, i <= lit ? { color: TIER_COLOR[tier] } : { dimColor: true }));
}

const route = (view) => routeLabel(view.actualModel ?? view.selectedModel ?? view.nativeModel, view.effort);

function served(view) {
  const { actualModel: actual, selectedModel: selected } = view;
  return Boolean(actual && selected && !isSameModel(selected, actual));
}

function supportText(config, estimate) {
  if (!Number.isFinite(estimate?.threshold)) return null;
  const mass = Number.isFinite(estimate.upgradeMass) ? estimate.upgradeMass : estimate.downgradeMass;
  if (!Number.isFinite(mass)) return null;
  return `${classifierLabel(config)} ${percent(mass)} ${mass >= estimate.threshold ? '≥' : '<'} ${percent(estimate.threshold)}`;
}

export function bandSegments(config, view, usage, actions) {
  if (view.phase === 'unavailable')
    return [
      segment(0, part('✕ Router unavailable', { color: 'red' })),
      segment(
        2,
        part(view.error === GATEWAY_SETTINGS ? 'v0.8 gateway settings remain' : (view.error ?? 'unknown error'), {
          color: 'red',
        }),
      ),
      segment(1, button({ key: 'band-fix', label: 'Fix', onPress: actions.open })),
    ];
  if (view.mode === 'manual')
    return [
      segment(
        0,
        part('○ ', { dimColor: true }),
        part('Router '),
        part('off', { color: 'yellow' }),
        part(` · keeping ${modelName(view.nativeModel)}`),
        view.reason === 'model selected manually' ? part(' (/model)', { dimColor: true }) : null,
      ),
      segment(1, button({ key: 'band-auto', label: 'Auto', onPress: () => actions.mode('auto') })),
    ];
  if (view.phase === 'choosing')
    return [
      segment(0, meter(view.tier, true), part(' choosing for this turn…', { dimColor: true })),
      segment(
        3,
        part(`${classifierLabel(config)} · ${activeClassifier(config).timeoutMs / 1000} s deadline`, {
          dimColor: true,
        }),
      ),
    ];
  const pin = view.pendingPin
    ? segment(
        0,
        part('⏵ next turn: ', { color: 'yellow' }),
        part(view.pendingPin, { bold: true, color: TIER_COLOR[view.pendingPin] }),
        part(' '),
        button({ key: 'band-unpin', label: '✕', plain: true, onPress: actions.unpin }),
      )
    : null;
  if (!view.tier && view.phase === 'ready' && !view.actualModel)
    return [segment(0, meter(null, true), part(' Auto · ready', { dimColor: true })), pin].filter(Boolean);
  const main = segment(
    0,
    view.tier
      ? [...meter(view.tier), part(` ${view.tier} `, { bold: true, color: TIER_COLOR[view.tier] })]
      : part('○ '),
    part(route(view)),
    served(view) ? part(' fallback', { color: 'yellow' }) : null,
  );
  // The warning leads and the route yields: when the band is narrow, what to fix matters more than the model kept,
  // and a long classifier label ("Clef Flash: no account ID") must not push the warning out.
  if (classifierWarns(view.error))
    return [
      segment(0, part(`⚠ ${classifierStatus(config, view.error)}`, { color: 'yellow' })),
      view.error === 'missing-key' || view.error === 'missing-account'
        ? segment(0, button({ key: 'band-key', label: 'Set up', onPress: actions.key }))
        : segment(2, button({ key: 'band-fix', label: 'Details', onPress: actions.open })),
      { ...main, priority: 1 },
      pin,
      segment(3, part('keeping model', { color: 'yellow' })),
    ].filter(Boolean);
  const metrics = usageMetrics(config, view, usage);
  const reading = (bar) => part(bar.percent === null ? '?' : `${bar.percent}%`, { color: bar.color });
  const support = supportText(config, view.estimate);
  return [
    main,
    pin,
    segment(1, part(SHORT_REASONS[view.reason] ?? view.reason ?? '', { dimColor: true })),
    support ? segment(4, part(support, { dimColor: true })) : null,
    metrics.contextBar.percent === null && metrics.cacheBar.percent === null
      ? null
      : segment(3, part('ctx '), reading(metrics.contextBar), part(' · cache '), reading(metrics.cacheBar)),
  ].filter(Boolean);
}

// The second row of the detailed band: recent replies by tier and the session's switch economics.
function detailRow(config, view, usage) {
  const tiers = (view.tiers ?? []).slice(-STRIP);
  if (!tiers.length) return [part('no replies yet', { dimColor: true })];
  const switches = switchCount(tiers);
  const metrics = usageMetrics(config, view, usage);
  return [
    part('replies ', { dimColor: true }),
    ...tiers.map((tier) => (tier ? part('█', { color: TIER_COLOR[tier] }) : part('·', { dimColor: true }))),
    part(
      `  ${switches} switch${switches === 1 ? '' : 'es'}` +
        `${Number.isFinite(view.estimate?.taxUsd) ? ` · tax ≈ $${view.estimate.taxUsd.toFixed(2)}` : ''}` +
        `${Number.isFinite(metrics.cacheBenefit) ? ` · cache saved ≈ $${metrics.cacheBenefit.toFixed(2)}` : ''}`,
      { dimColor: true },
    ),
  ];
}

export function renderBand({ Box, Text, Button }, config, view, usage, { columns, agentId }, actions) {
  const draw = (p) => (p.button ? Button(p.button) : Text({ ...p.style, children: p.text }));
  const row = (parts) => Box({ children: parts.map(draw) });
  if (agentId) return row([part('○ Router · subagents keep their own model', { dimColor: true })]);
  const kept = fitSegments(bandSegments(config, view, usage, actions), Math.max(0, columns - ROUTER_BUTTON));
  const line = kept.flatMap((s, i) => (i ? [part(SEPARATOR, { dimColor: true }), ...s.parts] : s.parts));
  line.push(part('  '), button({ key: 'details', label: 'Router', plain: true, onPress: actions.open }));
  const routing = view.mode === 'auto' && view.phase !== 'unavailable';
  return Box({
    key: 'router-band',
    flexDirection: 'column',
    children: [
      row(line),
      view.bandDetail && routing ? row(detailRow(config, view, usage)) : null,
      // Revealed while the pointer is over the band; no digit hotkeys, since a bare digit in an
      // empty prompt would press them.
      Box({
        display: 'none',
        hover: { display: 'flex' },
        children: [
          Text({ dimColor: true, children: routing ? 'pin next turn ' : '' }),
          ...(routing
            ? TIERS.flatMap((tier) => [
                Button({ key: `band-pin-${tier}`, label: tier, onPress: () => actions.pin(tier) }),
                Text({ children: ' ' }),
              ])
            : []),
          Text({ children: routing ? '  ' : '' }),
          routing
            ? Button({ key: 'band-manual', label: 'Manual', onPress: () => actions.mode('manual') })
            : Button({ key: 'band-auto-row', label: 'Auto', onPress: () => actions.mode('auto') }),
          Text({ children: ' ' }),
          Button({
            key: 'band-detail',
            label: view.bandDetail ? '1 row' : '2 rows',
            onPress: actions.toggleDetail,
          }),
        ],
      }),
    ],
  });
}

export function switchToast(config, previous, next, estimate) {
  const label = (decision) => routeLabel(decision.model, decision.effort);
  const support = supportText(config, estimate);
  return `${label(previous)} → ${label(next)} — ${SHORT_REASONS[next.reason]?.replace(/^\W+\s*/, '') ?? next.reason}${support ? ` (${support})` : ''}`;
}
