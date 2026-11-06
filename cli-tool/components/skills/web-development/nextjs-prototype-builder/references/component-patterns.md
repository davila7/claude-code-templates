# Component Patterns Reference

## Server/Client Split for Static Export

Next.js static export (`output: 'export'`) requires `generateStaticParams()` for dynamic routes. The pattern splits each dynamic route into two files:

### `page.tsx` — Server Component

```tsx
import { items } from '@/data/mock'
import DetailClient from './client'

export function generateStaticParams() {
  return items.map(item => ({ id: item.id }))
}

export default async function DetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <DetailClient id={id} />
}
```

### `client.tsx` — Client Component

```tsx
'use client'

import { items } from '@/data/mock'
import Header from '@/components/Header'

export default function DetailClient({ id }: { id: string }) {
  const item = items.find(i => i.id === id)

  if (!item) {
    return (
      <>
        <Header title="Not Found" />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-slate-600">Item not found</p>
        </main>
      </>
    )
  }

  return (
    <>
      <Header breadcrumbs={[
        { label: 'Items', href: '/items' },
        { label: item.id },
      ]} />
      <main className="flex-1 overflow-y-auto p-6">
        {/* Detail content */}
      </main>
    </>
  )
}
```

**Key rules:**
- `page.tsx` must NOT have `'use client'` — it's a server component
- `params` is a `Promise` in Next.js 15 — must `await` it
- `generateStaticParams()` must return all valid IDs from mock data
- All interactive logic (useState, onClick, router) goes in `client.tsx`

## Sidebar Navigation

### Structure

```tsx
const navItems = [
  { section: 'Main' },                                              // Section header
  { href: '/', icon: LayoutGrid, label: 'Dashboard' },             // Nav link
  { href: '/items', icon: Inbox, label: 'Items', badge: count },   // With count badge
  { section: 'System' },
  { href: '/settings', icon: Settings, label: 'Settings' },
]
```

### Active State Detection

```tsx
const isActive = item.href === '/'
  ? pathname === '/'
  : pathname.startsWith(item.href)
```

### Active State Styling

```tsx
isActive
  ? 'bg-cyan-400/[0.08] text-cyan-400 border-l-cyan-400 shadow-[inset_0_0_20px_rgba(34,211,238,0.04)]'
  : 'text-slate-500 border-l-transparent hover:bg-white/[0.03] hover:text-slate-300'
```

### Brand Section

```tsx
<div className="flex items-center gap-2">
  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 via-cyan-500 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
    <Sparkles size={16} className="text-white" />
  </div>
  <span className="font-display font-extrabold text-xl tracking-[0.15em] bg-gradient-to-r from-cyan-300 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
    BRAND
  </span>
</div>
```

### User Profile Footer

```tsx
<div className="p-4 border-t border-white/[0.06] flex items-center gap-2.5">
  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 via-cyan-500 to-blue-500 flex items-center justify-center text-xs font-bold text-white shadow-lg shadow-cyan-500/20">
    JD
  </div>
  <div>
    <div className="text-[0.8rem] font-semibold leading-tight">Jane Doe</div>
    <div className="text-[0.62rem] text-slate-600 tracking-wide">Administrator</div>
  </div>
  <div className="ml-auto w-2 h-2 rounded-full bg-emerald-400 animate-pulse-dot" />
</div>
```

## Header Component

### Simple Title

```tsx
<Header title="Dashboard" />
```

### Breadcrumb Navigation

```tsx
<Header breadcrumbs={[
  { label: 'Submissions', href: '/submissions' },
  { label: 'SUB-2026-0147' },  // No href = current page (bold)
]} />
```

### Built-in Features

1. **Search Palette** — Triggered by click or `⌘K` keyboard shortcut
2. **Notifications Panel** — Bell icon with unread count badge, renders via `createPortal`
3. **User Avatar** — Gradient circle with initials

### Search Palette Pattern

The search palette is a modal overlay (`z-[200]`) with:
- Text input with auto-focus
- Arrow key navigation with selected highlight
- Enter to navigate, Escape to close
- `buildResults(query)` function filters mock data
- Results show icon, title, subtitle, badges

### Notifications Panel Pattern

Renders via `createPortal(content, document.body)` at `z-[9999]`:
- Fixed position `top-14 right-6`
- Click-outside handler to close
- Notification types: `critical`, `warning`, `info`, `success`
- Each type has icon + color mapping
- Unread indicator dots

## KPI Card

```tsx
<KPICard
  label="Active Submissions"
  value={42}
  trend="↑ 12%"
  trendDir="up"
  sub="vs last month"
  accent="cyan"
/>
```

### Props

| Prop | Type | Description |
|------|------|-------------|
| `label` | string | Small uppercase label |
| `value` | string \| ReactNode | Large mono value |
| `trend` | string? | Trend pill text |
| `trendDir` | 'up' \| 'down'? | Green or red pill |
| `sub` | string? | Subtitle below value |
| `children` | ReactNode? | Custom content |
| `accent` | 'cyan' \| 'emerald' \| 'violet' \| 'amber'? | Glow + border-top color |

### Layout Pattern

```tsx
<div className="grid grid-cols-4 gap-4 mb-6 stagger">
  <KPICard ... accent="cyan" />
  <KPICard ... accent="violet" />
  <KPICard ... accent="amber" />
  <KPICard ... accent="emerald" />
</div>
```

## Badge System

### Status Badge

```tsx
<Badge status="quoted" />               // Uses default statusConfig
<Badge status="data" config={catConfig} /> // Custom config
```

Maps status → `{ label, color }` → `badgeStyles[color]` for consistent pill rendering.

### Status Dot

```tsx
<Dot color="success" />             // Static dot
<Dot color="info" pulse />          // Pulsing dot
```

### Priority Dot

```tsx
<PriorityDot priority="critical" /> // Maps to 'error' dot
<PriorityDot priority="medium" />   // Maps to 'warning' dot
```

## Data Tables with Full-Row Click

```tsx
<table className="w-full">
  <thead>
    <tr className="text-left">
      {['ID', 'Name', 'Status', 'Value'].map(h => (
        <th key={h} className="px-3 py-2.5 text-[0.62rem] font-bold tracking-[0.06em] uppercase text-slate-600 border-b border-white/[0.04]">
          {h}
        </th>
      ))}
    </tr>
  </thead>
  <tbody>
    {items.map(item => (
      <tr
        key={item.id}
        onClick={() => router.push(`/items/${item.id}`)}
        className="cursor-pointer hover:bg-white/[0.03] transition-colors group"
      >
        <td className="px-3 py-3 text-[0.82rem] border-b border-white/[0.03]">
          <span className="font-mono text-[0.76rem] text-cyan-400/80 group-hover:text-cyan-400 transition-colors">
            {item.id}
          </span>
        </td>
        {/* ... more cells */}
      </tr>
    ))}
  </tbody>
</table>
```

**Key patterns:**
- Full-row `onClick` with `cursor-pointer`
- `group` class on `<tr>` for coordinated hover effects
- ID column uses `font-mono text-cyan-400/80` with hover brightening
- Border: `border-b border-white/[0.03]` (lighter than section borders)

## Guided Tour

### Defining Steps

```tsx
const tourSteps: TourStep[] = [
  {
    target: '#tour-dashboard',    // CSS selector
    title: 'Dashboard',
    content: 'Monitor KPIs and activity at a glance.',
    placement: 'right',           // top | bottom | left | right
  },
  {
    target: '#tour-search',
    title: 'Global Search',
    content: 'Use ⌘K for instant search.',
    placement: 'bottom',
  },
]
```

### TourProvider Pattern

```tsx
// In TourProvider.tsx
const TOUR_STORAGE_KEY = 'myapp-tour-completed'

export default function TourProvider() {
  const pathname = usePathname()
  const [tourOpen, setTourOpen] = useState(false)
  const [showLauncher, setShowLauncher] = useState(false)

  useEffect(() => {
    if (pathname !== '/') return
    const completed = localStorage.getItem(TOUR_STORAGE_KEY)
    if (!completed) {
      setTimeout(() => setTourOpen(true), 800)  // Auto-start on first visit
    } else {
      setShowLauncher(true)
    }
  }, [pathname])

  // ...render GuidedTour + TourLauncher
}
```

### How It Works

1. **SVG Mask Spotlight** — Full-screen SVG with a mask that cuts out a rounded rect around the target element
2. **Glow Ring** — Animated cyan border around the cutout with `animate-pulse-ring`
3. **Tooltip** — Positioned relative to target rect, clamped to viewport, with progress bar
4. **Click Blocker** — Fixed div at `z-[9997]` prevents clicking through the overlay
5. **Auto-scroll** — Target elements are scrolled into view with `scrollIntoView({ behavior: 'smooth' })`

### Adding Tour Targets

Add `id` attributes to elements you want to highlight:

```tsx
<div id="tour-kpis" className="grid grid-cols-4 gap-4">
  {/* KPI cards */}
</div>
```

## Glass Card Pattern (generic)

```tsx
<div className="glass rounded-xl">
  <div className="px-4 py-3.5 border-b border-white/[0.06] flex items-center justify-between text-[0.8rem] font-semibold">
    Section Title
    <span className="text-[0.72rem] text-cyan-400">Action</span>
  </div>
  <div className="p-4">
    {/* Content */}
  </div>
</div>
```

## Drag-and-Drop Grid / Calendar

For roster grids, kanban boards, scheduling views, or any grid where items can be moved between cells. Uses `@dnd-kit/core` — the only maintained DnD library with React 19 support.

### Installation

```bash
npm install @dnd-kit/core
```

Only `@dnd-kit/core` is needed — no `@dnd-kit/sortable` since this is cell-to-cell movement, not reordering within a list.

### Architecture

The DnD grid has 4 key parts:

1. **DraggableCard** — wraps each item with `useDraggable`
2. **DroppableCell** — wraps each grid cell with `useDroppable`
3. **DndContext** — wraps the entire grid, handles sensors and events
4. **DragOverlay** — renders the ghost card during drag

### DraggableCard

```tsx
import { useDraggable } from '@dnd-kit/core'

function DraggableCard({ item, onClick }: { item: Item; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: { itemId: item.id },
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={cn(
        'group cursor-grab active:cursor-grabbing hover:-translate-y-0.5 hover:shadow-lg transition-all',
        isDragging && 'opacity-30'
      )}
    >
      <CardContent item={item} />
    </div>
  )
}
```

**Key points:**
- `isDragging` fades the source card to 30% opacity while dragging
- `data: { itemId }` attaches metadata readable in `handleDragEnd`
- Spread `listeners` and `attributes` on the wrapper div for accessibility

### DroppableCell

```tsx
import { useDroppable } from '@dnd-kit/core'

function DroppableCell({
  cellId,
  staffId,
  day,
  children,
}: {
  cellId: string
  staffId: string | null
  day: string
  children: React.ReactNode
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: cellId,
    data: { staffId, day },  // structured data — NOT encoded in the ID string
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'px-1.5 py-1.5 min-h-[80px] transition-colors duration-200 rounded-sm',
        isOver && 'bg-blue-50 ring-2 ring-blue-300 ring-inset'  // visual feedback
      )}
    >
      {children}
    </div>
  )
}
```

**IMPORTANT:** Always pass structured `data` to `useDroppable` instead of encoding values in the cell ID string. IDs like `cell-STF-001-Mon` break when split by `-` because entity IDs contain hyphens. Use `over.data.current` in `handleDragEnd` instead.

### DndContext Wrapper

```tsx
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'

export default function GridPage() {
  const [items, setItems] = useState<Item[]>(initialItems)
  const [activeItem, setActiveItem] = useState<Item | null>(null)

  // PointerSensor with distance: 5 disambiguates click vs drag
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const itemId = event.active.data.current?.itemId as string
    setActiveItem(items.find(i => i.id === itemId) ?? null)
  }, [items])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveItem(null)
    const { active, over } = event
    if (!over?.data.current) return

    const itemId = active.data.current?.itemId as string
    const { staffId, day } = over.data.current as { staffId: string | null; day: string }

    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item
      if (item.staffId === staffId && item.day === day) return item  // same cell
      return { ...item, staffId, day, staffName: findStaffName(staffId) }
    }))
  }, [])

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Grid content with DroppableCells containing DraggableCards */}

      <DragOverlay dropAnimation={null}>
        {activeItem ? (
          <div className="w-[160px] opacity-90 shadow-xl rotate-2">
            <CardContent item={activeItem} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
```

### Read-Only Mode

For roles that can't edit, skip DnD entirely — zero overhead:

```tsx
const isEditable = canEdit('roster')

// Render either draggable or static cards
const renderCard = (item: Item) => {
  if (isEditable) return <DraggableCard item={item} onClick={...} />
  return <StaticCard item={item} onClick={...} />
}

// Render either droppable or static cells
const renderCell = (cellId: string, staffId: string | null, day: string, items: Item[]) => {
  const content = <div className="space-y-1.5">{items.map(renderCard)}</div>
  if (isEditable) return <DroppableCell cellId={cellId} staffId={staffId} day={day}>{content}</DroppableCell>
  return <div className="px-1.5 py-1.5 min-h-[80px]">{content}</div>
}

// Wrap grid conditionally
return isEditable ? (
  <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
    {gridContent}
    <DragOverlay>...</DragOverlay>
  </DndContext>
) : (
  gridContent
)
```

### Grid Layout Pattern (Roster/Calendar)

```tsx
<div className="glass rounded-xl overflow-hidden">
  {/* Header row */}
  <div className="grid grid-cols-[140px_repeat(7,1fr)] border-b border-slate-200">
    <div className="px-3 py-2.5 text-[0.68rem] font-semibold uppercase tracking-wide border-r border-slate-200">
      Staff / Day
    </div>
    {days.map(day => (
      <div key={day} className="px-2 py-2.5 text-center border-r border-slate-200 last:border-r-0">
        <div className="text-[0.72rem] font-semibold">{day.label}</div>
        <div className="text-[0.58rem] text-slate-400">{day.date}</div>
      </div>
    ))}
  </div>

  {/* Data rows */}
  {staffMembers.map(staff => (
    <div key={staff.id} className="grid grid-cols-[140px_repeat(7,1fr)] border-b border-slate-200 last:border-b-0">
      <div className="px-3 py-2 border-r border-slate-200 flex items-center gap-2">
        {/* Staff info */}
      </div>
      {days.map(day => {
        const cellItems = items.filter(i => i.staffId === staff.id && i.day === day.id)
        return <div key={day.id}>{renderCell(`cell-${staff.id}-${day.id}`, staff.id, day.id, cellItems)}</div>
      })}
    </div>
  ))}
</div>
```

### Checklist

- [ ] `npm install @dnd-kit/core`
- [ ] Mutable state: `useState<Item[]>(initialItems)` instead of importing directly
- [ ] `PointerSensor` with `distance: 5` — disambiguates click (opens detail) vs drag
- [ ] `DragOverlay` with `dropAnimation={null}` — ghost card with slight rotation + shadow
- [ ] Structured `data` on droppables (NOT encoded in ID strings)
- [ ] `isOver` visual feedback: `ring-2 ring-blue-300 ring-inset` on drop targets
- [ ] Read-only roles: no DnD wrappers, zero overhead
- [ ] Filter counts use `allItems` (mutable state), not the original import

---

## Optional: AI Chat Panel

For prototypes that need a chat interface, create `AgentChatPanel.tsx`:

### Pattern Overview

```tsx
type Message = { role: 'bot' | 'user' | 'system'; text: string }

export default function ChatPanel({ agent }: { agent: AgentDef }) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'bot', text: agent.greeting },
  ])
  const [typing, setTyping] = useState(false)
  const [input, setInput] = useState('')

  const send = (text: string) => {
    setMessages(prev => [...prev, { role: 'user', text }])
    setTyping(true)
    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'bot', text: mockResponse }])
      setTyping(false)
    }, 600 + Math.random() * 800)
  }
  // ...
}
```

### Key elements:
- Auto-scroll to bottom on new messages
- Typing indicator with 3 bouncing dots (`.typing-dot`)
- Suggestion chips below messages
- Context selector bar (optional — for binding chat to a specific entity)
- Message bubbles: bot = left-aligned dark, user = right-aligned accent-tinted
