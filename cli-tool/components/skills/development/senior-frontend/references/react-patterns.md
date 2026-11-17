# React patterns that hold up

Short rules with the smallest example that shows them. Sources: the React docs
([You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect),
[Synchronizing with Effects](https://react.dev/learn/synchronizing-with-effects))
and Vercel's [agent-skills](https://github.com/vercel-labs/agent-skills)
`react-best-practices` and `composition-patterns` (commit 1a2c79d, MIT, Vercel;
license in `NOTICE.md`). For the full 70-rule performance guide, install
the catalog's `development/react-best-practices` skill.

## State

**Derive instead of syncing.**

```tsx
// ✗ second source of truth, one render late
const [visible, setVisible] = useState(items);
useEffect(() => setVisible(items.filter(match)), [items, query]);

// ✓ computed during render (useMemo only if it is measurably slow)
const visible = items.filter(match);
```

**Event logic lives in the event handler**, not in an effect that watches a
flag the handler set.

**Model async state explicitly** so impossible combinations cannot happen:

```tsx
type Load<T> = { status: 'loading' } | { status: 'error'; error: string } | { status: 'ready'; data: T };
```

**Functional updates** when the next state depends on the previous one and the
update happens after an `await`: `setItems((prev) => prev.filter(...))`.

**Lazy initial state** for expensive defaults: `useState(() => parse(raw))`.

**Put shareable state in the URL** (search, filter, tab, page) with the
router's search params or a small hook; read it on load.

## Effects and fetching

Prefer the project's data layer (TanStack Query, SWR, server components,
framework loaders). When you must fetch in an effect:

```tsx
useEffect(() => {
  let ignore = false;
  setState({ status: 'loading' });
  fetchMembers().then(
    (data) => !ignore && setState({ status: 'ready', data }),
    (e) => !ignore && setState({ status: 'error', error: e.message }),
  );
  return () => { ignore = true; };
}, [reloadKey]);
```

- The cleanup handles out-of-order responses and React 18 Strict Mode's
  double mount in development.
- Retry by bumping `reloadKey`, not by duplicating the fetch code.
- Independent requests run in parallel: `Promise.all([a(), b()])`, never
  `await a(); await b();`.

## Mutations

- Disable or mark the specific item as pending while its request runs.
- Pessimistic (wait, then update) is the safe default. Optimistic updates must
  roll back and tell the user when the request fails.
- A failed mutation shows a message next to the item or in a live region and
  leaves the UI consistent with the server.
- Destructive mutations: confirm (native `confirm()` is acceptable in internal
  tools; a `<dialog>` with the item's name is better) or offer undo.
- After the item disappears, move focus to the next row, the previous row, or
  the list heading, so keyboard users are not dropped to `<body>`.

## Components

**Never define a component inside a component.** It is a new type every render:
React unmounts and remounts it, losing state and focus.

**Composition over boolean props.**

```tsx
// ✗ grows a flag per use case
<Composer isThread isEditing={false} showAttachments />

// ✓ explicit variants built from shared parts
<ThreadComposer />
<EditComposer />
```

**Compound components with context** for multi-part widgets (Tabs, Menu,
Disclosure): the parent owns state, children read it, callers arrange the
parts.

**Children over render props** unless the child needs data the parent owns.

**React 19**: `ref` is a regular prop (no `forwardRef`), and `use(Context)`
replaces `useContext`. Check the project's React version first.

## Performance (measure first)

From Vercel's list, the ones that matter most in ordinary app code:

1. Remove request waterfalls (start independent fetches together; stream with
   Suspense where the framework supports it).
2. Import directly instead of through barrel files; lazy-load heavy components
   (`React.lazy`, `next/dynamic`) and third-party scripts after hydration.
3. Do not subscribe to state you only read inside callbacks; split context so
   a fast-changing value does not re-render the whole tree.
4. Use `startTransition` / `useDeferredValue` to keep typing responsive while a
   large list filters.
5. Virtualize long lists; give images dimensions.

Memoization (`memo`, `useMemo`, `useCallback`) is for measured problems or for
values passed to memoized children, not a default.
