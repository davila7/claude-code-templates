// ═══ TYPES ═══
// Define your domain entity types here.
// Use string literal unions for status/priority fields.

export type Item = {
  id: string
  name: string
  category: string
  status: 'active' | 'pending' | 'completed' | 'archived'
  priority: 'low' | 'medium' | 'high' | 'critical'
  assigned: string | null
  value: number
  created: string
}

export type FeedItem = {
  actor: string
  action: string
  time: string
  status: 'complete' | 'processing'
}

// ═══ MOCK DATA ═══
// Create 6-10 entries with varied statuses, priorities, and assignments.

export const items: Item[] = [
  { id: 'ITM-2026-0001', name: 'Project Alpha', category: 'Engineering', status: 'completed', priority: 'high', assigned: 'Sarah Chen', value: 125000, created: '15 Jan 2026' },
  { id: 'ITM-2026-0002', name: 'Initiative Beta', category: 'Marketing', status: 'active', priority: 'medium', assigned: 'Sarah Chen', value: 82000, created: '17 Jan 2026' },
  { id: 'ITM-2026-0003', name: 'Task Gamma', category: 'Engineering', status: 'pending', priority: 'high', assigned: 'James Wright', value: 157000, created: '18 Jan 2026' },
  { id: 'ITM-2026-0004', name: 'Proposal Delta', category: 'Sales', status: 'active', priority: 'medium', assigned: null, value: 63000, created: '19 Jan 2026' },
  { id: 'ITM-2026-0005', name: 'Review Epsilon', category: 'Operations', status: 'pending', priority: 'low', assigned: 'Maria Santos', value: 221000, created: '14 Jan 2026' },
  { id: 'ITM-2026-0006', name: 'Audit Zeta', category: 'Finance', status: 'archived', priority: 'critical', assigned: 'James Wright', value: 45000, created: '16 Jan 2026' },
]

// ═══ ACTIVITY FEED ═══
export const feedItems: FeedItem[] = [
  { actor: 'System', action: 'Created <strong>ITM-2026-0004</strong>', time: 'Just now', status: 'complete' },
  { actor: 'Processor', action: 'Classified <strong>ITM-2026-0006</strong> as Critical', time: '1 min ago', status: 'complete' },
  { actor: 'Analyzer', action: 'Computing metrics for <strong>ITM-2026-0002</strong>', time: '2 min ago', status: 'processing' },
  { actor: 'Validator', action: 'Validated 42 records for <strong>ITM-2026-0003</strong>', time: '5 min ago', status: 'complete' },
]
