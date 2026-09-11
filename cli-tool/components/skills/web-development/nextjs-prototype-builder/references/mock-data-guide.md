# Mock Data Guide

## Type Patterns

### Basic Entity Type

```ts
export type Item = {
  id: string
  name: string
  status: 'active' | 'pending' | 'completed' | 'archived'  // Discriminated union
  priority: 'low' | 'medium' | 'high' | 'critical'
  assigned: string | null        // null = unassigned
  value: number
  created: string                // Human-readable date string
}
```

### Key conventions:
- Use **string literal unions** for status/priority fields (enables type-safe badges)
- Use `null` for optional assignments (not `undefined`)
- Use `string` for dates in mock data (display-friendly, no Date parsing needed)
- IDs follow a pattern: `PREFIX-YYYY-NNNN` (e.g., `SUB-2026-0147`)

### Related Entity Type

```ts
export type Activity = {
  agent: string         // References AgentDef.name
  action: string        // Can include <strong> HTML for highlights
  time: string          // "Just now", "5 min ago"
  status: 'complete' | 'processing'
}
```

### Complex Entity with Nested Types

```ts
export type Workflow = {
  id: string
  name: string
  stages: WorkflowStage[]
  traceEvents: TraceEvent[]
}

export type WorkflowStage = {
  name: string
  agents: string[]
  input: string
  output: string
  duration: number     // seconds
  status: 'complete' | 'active' | 'pending'
}
```

## Realistic Data Guidelines

### Quantity
- **Main entities:** 6-10 entries (enough to fill a table, not overwhelming)
- **Related data:** 5-8 entries per feed/activity list
- **Nested items:** 3-7 stages/steps per workflow

### Variety
- Mix all status values across entries
- Vary priorities (not all "high")
- Include both assigned and unassigned (`null`) entries
- Use realistic names (companies, people, locations)
- Vary numeric values significantly (not all similar amounts)

### Example: Well-varied Data

```ts
export const items: Item[] = [
  { id: 'ITM-2026-0001', name: 'Project Alpha', status: 'completed', priority: 'high', assigned: 'Sarah Chen', value: 12500000, created: '15 Jan 2026' },
  { id: 'ITM-2026-0002', name: 'Initiative Beta', status: 'active', priority: 'medium', assigned: 'Sarah Chen', value: 8400000, created: '17 Jan 2026' },
  { id: 'ITM-2026-0003', name: 'Task Gamma', status: 'pending', priority: 'high', assigned: 'James Wright', value: 15700000, created: '18 Jan 2026' },
  { id: 'ITM-2026-0004', name: 'Proposal Delta', status: 'active', priority: 'medium', assigned: null, value: 6300000, created: '19 Jan 2026' },
  // ... 4-6 more with similar variety
]
```

### Realism Tips
- Use real company names for B2B contexts
- Use plausible financial figures (not round thousands)
- Include edge cases: null assignments, varied statuses
- Dates should be recent and logically ordered
- Activity feed times: "Just now", "1 min ago", "5 min ago", "12 min ago", etc.

## Helper Patterns

### Currency Formatting

```ts
export function formatCurrency(n: number): string {
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B'
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K'
  return '$' + n
}
```

### Number Formatting

```ts
export function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}
```

### Class Name Utility

```ts
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}
```

### Status Config Map

Maps status strings to display labels and badge color keys:

```ts
export const statusConfig: Record<string, { label: string; color: string }> = {
  active: { label: 'Active', color: 'success' },
  pending: { label: 'Pending', color: 'warning' },
  completed: { label: 'Completed', color: 'info' },
  archived: { label: 'Archived', color: 'muted' },
}
```

The `color` value maps to `badgeStyles` and `dotStyles` in the design system.

### Priority Config Map

```ts
export const priorityColor: Record<string, string> = {
  critical: 'error',
  high: 'error',
  medium: 'warning',
  low: 'muted',
}
```

## Feed / Activity Data Pattern

```ts
export const feedItems: FeedItem[] = [
  { agent: 'Data Processor', action: 'Parsed document for <strong>ITM-2026-0004</strong>', time: 'Just now', status: 'complete' },
  { agent: 'Classifier', action: 'Auto-classified <strong>ITM-2026-0005</strong> as High Priority', time: '1 min ago', status: 'complete' },
  { agent: 'Analyzer', action: 'Computing metrics for <strong>ITM-2026-0002</strong>', time: '2 min ago', status: 'processing' },
]
```

**Pattern:** Agent name + action with bold entity reference + relative time + status

## Aggregation Data Pattern

For charts and summary panels:

```ts
export const categoryBreakdown = [
  { name: 'Category A', pct: 45, color: 'bg-red-400' },
  { name: 'Category B', pct: 25, color: 'bg-violet-400' },
  { name: 'Category C', pct: 15, color: 'bg-blue-400' },
  { name: 'Category D', pct: 10, color: 'bg-amber-400' },
  { name: 'Category E', pct: 5, color: 'bg-cyan-400' },
]
```

Percentages should sum to 100. Colors use Tailwind bg classes for bar rendering.
