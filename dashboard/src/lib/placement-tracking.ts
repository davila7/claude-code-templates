// Browser side of placement reporting (see lib/placements.ts). Started once per
// page from DashboardLayout.astro. Watches every [data-spot] element, including
// ones React islands add later, and posts:
//   impression  once per element per page view, after VIEW_MS viewable; an
//               element marked data-spot-view="load" (a whole sponsor page,
//               too tall to be half on screen) counts on page load instead
//   click/cta   a click on a link inside it (same site / another site)
//   copy        a click on an element marked data-spot-copy inside it
// Links marked data-spot-ignore (a page's own "back" link) are not counted.
// Fails silently: reporting must never break the page.

import {
  SPOT_ENDPOINT,
  VIEW_MS,
  clickEvent,
  isSurface,
  isViewable,
  parsePlacement,
  type PlacementEvent,
  type SpotEvent,
} from './placements.ts';

function send(evt: SpotEvent): void {
  try {
    const body = JSON.stringify(evt);
    // sendBeacon survives the navigation a click starts.
    if (navigator.sendBeacon?.(SPOT_ENDPOINT, new Blob([body], { type: 'application/json' }))) return;
    void fetch(SPOT_ENDPOINT, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      credentials: 'omit',
    }).catch(() => {});
  } catch { /* ignore */ }
}

function spotOf(el: Element): { placement: string; surface: SpotEvent['surface'] } | null {
  const placement = el.getAttribute('data-spot');
  const surface = el.getAttribute('data-spot-surface');
  if (!parsePlacement(placement) || !isSurface(surface)) return null;
  return { placement: placement as string, surface };
}

export function initPlacementTracking(): void {
  if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return;
  // Automated browsers announce themselves; their views are not an audience.
  if ((navigator as Navigator & { webdriver?: boolean }).webdriver) return;
  const w = window as unknown as { __spotTracking?: boolean };
  if (w.__spotTracking) return;
  w.__spotTracking = true;

  const seen = new WeakSet<Element>();
  const timers = new WeakMap<Element, number>();

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const el = entry.target;
        if (seen.has(el)) continue;
        const viewable =
          entry.isIntersecting &&
          document.visibilityState === 'visible' &&
          isViewable(entry.intersectionRatio, entry.intersectionRect.height, window.innerHeight);
        const pending = timers.get(el);
        if (viewable && pending === undefined) {
          timers.set(
            el,
            window.setTimeout(() => {
              timers.delete(el);
              if (seen.has(el) || !el.isConnected) return;
              const spot = spotOf(el);
              if (!spot) return;
              seen.add(el);
              io.unobserve(el);
              send({ ...spot, event: 'impression' });
            }, VIEW_MS),
          );
        } else if (!viewable && pending !== undefined) {
          window.clearTimeout(pending);
          timers.delete(el);
        }
      }
    },
    { threshold: [0, 0.1, 0.25, 0.3, 0.5, 0.75, 1] },
  );

  const watch = (el: Element) => {
    if (seen.has(el)) return;
    if (el.getAttribute('data-spot-view') !== 'load') { io.observe(el); return; }
    const spot = spotOf(el);
    if (!spot) return;
    seen.add(el);
    const fire = () => send({ ...spot, event: 'impression' });
    if (document.visibilityState === 'visible') fire();
    else {
      // Opened in a background tab: count it when it is first shown.
      const onShow = () => {
        if (document.visibilityState !== 'visible') return;
        document.removeEventListener('visibilitychange', onShow);
        if (el.isConnected) fire();
      };
      document.addEventListener('visibilitychange', onShow);
    }
  };

  const observe = (root: ParentNode) => {
    if (root instanceof Element && root.hasAttribute('data-spot')) watch(root);
    root.querySelectorAll?.('[data-spot]').forEach(watch);
  };
  observe(document);

  new MutationObserver((records) => {
    for (const r of records) r.addedNodes.forEach((n) => { if (n instanceof Element) observe(n); });
  }).observe(document.body, { childList: true, subtree: true });

  // A tab switched away mid-count must not finish the second.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') {
      document.querySelectorAll('[data-spot]').forEach((el) => {
        const t = timers.get(el);
        if (t !== undefined) { window.clearTimeout(t); timers.delete(el); }
      });
    } else {
      // Re-arm: unobserve + observe delivers a fresh entry for each element.
      document.querySelectorAll('[data-spot]').forEach((el) => {
        if (!seen.has(el)) { io.unobserve(el); io.observe(el); }
      });
    }
  });

  // Capture phase, so a handler that stops propagation does not hide the click.
  document.addEventListener(
    'click',
    (e) => {
      const target = e.target instanceof Element ? e.target : null;
      const host = target?.closest('[data-spot]');
      if (!target || !host) return;
      const spot = spotOf(host);
      if (!spot) return;
      if (target.closest('[data-spot-ignore]')) return;
      let event: PlacementEvent | null = null;
      if (target.closest('[data-spot-copy]')) event = 'copy';
      else event = clickEvent(target.closest('a[href]')?.getAttribute('href') ?? null, location.origin);
      if (event) send({ ...spot, event });
    },
    { capture: true },
  );
}
