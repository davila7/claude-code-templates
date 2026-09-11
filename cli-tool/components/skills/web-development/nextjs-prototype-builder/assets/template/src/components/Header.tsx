'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, Bell, ChevronRight, X, AlertTriangle, Shield, Info, CheckCircle } from 'lucide-react'
import { items } from '@/data/mock'
import { formatCurrency, statusConfig } from '@/lib/utils'
import { Badge, PriorityDot } from './Badge'

type Breadcrumb = { label: string; href?: string }

// ═══ Notifications ═══
type Notification = {
  id: string
  type: 'critical' | 'warning' | 'info' | 'success'
  title: string
  message: string
  time: string
  href?: string
  read: boolean
}

// Customize these notifications for your domain
const notifications: Notification[] = [
  {
    id: 'n1',
    type: 'critical',
    title: 'Critical Alert',
    message: 'ITM-2026-0006 requires immediate attention. Escalation required.',
    time: '3 min ago',
    href: '/',
    read: false,
  },
  {
    id: 'n2',
    type: 'warning',
    title: 'Review Needed',
    message: 'ITM-2026-0003 is pending review. Assigned to James Wright.',
    time: '12 min ago',
    href: '/',
    read: false,
  },
  {
    id: 'n3',
    type: 'info',
    title: 'Processing Complete',
    message: 'ITM-2026-0002 metrics computed. Awaiting approval.',
    time: '25 min ago',
    href: '/',
    read: true,
  },
  {
    id: 'n4',
    type: 'success',
    title: 'Task Completed',
    message: 'ITM-2026-0001 has been finalized and archived.',
    time: '1 hr ago',
    href: '/',
    read: true,
  },
]

const notifIcon: Record<string, { icon: typeof AlertTriangle; cls: string }> = {
  critical: { icon: AlertTriangle, cls: 'text-red-400 bg-red-400/10' },
  warning: { icon: Shield, cls: 'text-amber-400 bg-amber-400/10' },
  info: { icon: Info, cls: 'text-blue-400 bg-blue-400/10' },
  success: { icon: CheckCircle, cls: 'text-emerald-400 bg-emerald-400/10' },
}

// ═══ Search result types ═══
type SearchResult = {
  id: string
  title: string
  subtitle: string
  href: string
  type: string
  priority?: string
  status?: string
}

function buildResults(q: string): SearchResult[] {
  if (!q.trim()) return []
  const lq = q.toLowerCase()

  return items
    .filter(item =>
      item.id.toLowerCase().includes(lq) ||
      item.name.toLowerCase().includes(lq) ||
      item.category.toLowerCase().includes(lq)
    )
    .map(item => ({
      id: item.id,
      title: item.id,
      subtitle: `${item.name} · ${item.category} · ${formatCurrency(item.value)}`,
      href: '/',
      type: 'item',
      priority: item.priority,
      status: item.status,
    }))
    .slice(0, 8)
}

// ═══ Search Command Palette ═══
function SearchPalette({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const results = buildResults(query)

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelected(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected(s => Math.min(s + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected(s => Math.max(s - 1, 0))
    } else if (e.key === 'Enter' && results[selected]) {
      router.push(results[selected].href)
      onClose()
    } else if (e.key === 'Escape') {
      onClose()
    }
  }, [results, selected, router, onClose])

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="fixed top-[15%] left-1/2 -translate-x-1/2 z-[201] w-[520px] animate-scale-in">
        <div className="glass rounded-xl border border-white/[0.08] shadow-2xl shadow-black/40 overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/[0.06]">
            <Search size={16} className="text-slate-500 flex-shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => { setQuery(e.target.value); setSelected(0) }}
              onKeyDown={handleKeyDown}
              placeholder="Search items..."
              className="flex-1 bg-transparent text-[0.88rem] text-slate-200 outline-none placeholder:text-slate-600"
            />
            <kbd className="font-mono text-[0.55rem] px-1.5 py-0.5 rounded bg-white/[0.04] text-slate-600 border border-white/[0.06]">ESC</kbd>
          </div>

          {/* Results */}
          <div className="max-h-[360px] overflow-y-auto">
            {query && results.length === 0 && (
              <div className="px-4 py-8 text-center text-[0.82rem] text-slate-600">
                No results for &ldquo;{query}&rdquo;
              </div>
            )}
            {results.map((r, i) => (
              <button
                key={r.id}
                onClick={() => { router.push(r.href); onClose() }}
                onMouseEnter={() => setSelected(i)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  i === selected ? 'bg-cyan-400/[0.06]' : 'hover:bg-white/[0.02]'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[0.78rem] text-slate-200">{r.title}</span>
                    {r.status && <Badge status={r.status} />}
                    {r.priority && <PriorityDot priority={r.priority} />}
                  </div>
                  <div className="text-[0.7rem] text-slate-500 truncate">{r.subtitle}</div>
                </div>
                {i === selected && (
                  <span className="text-[0.55rem] text-slate-600 font-mono flex-shrink-0">Enter ↵</span>
                )}
              </button>
            ))}
            {!query && (
              <div className="px-4 py-6 text-center">
                <div className="text-[0.78rem] text-slate-600 mb-2">Quick search across all items</div>
                <div className="flex items-center justify-center gap-3 text-[0.65rem] text-slate-700">
                  <span>Try: <span className="text-slate-500">Alpha</span></span>
                  <span className="text-slate-700">·</span>
                  <span><span className="text-slate-500">Engineering</span></span>
                  <span className="text-slate-700">·</span>
                  <span><span className="text-slate-500">ITM-2026</span></span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ═══ Notifications Panel ═══
function NotificationsPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const router = useRouter()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const unread = notifications.filter(n => !n.read).length

  return createPortal(
    <div ref={panelRef} className="fixed top-14 right-6 z-[9999] w-96 animate-scale-in origin-top-right">
      <div className="rounded-xl border border-white/[0.08] shadow-2xl shadow-black/60 overflow-hidden bg-[#111827]">
        <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[0.82rem] font-semibold text-slate-200">Notifications</span>
            {unread > 0 && (
              <span className="px-1.5 py-0.5 rounded-md text-[0.58rem] font-bold bg-red-400/10 text-red-400">{unread} new</span>
            )}
          </div>
          <button onClick={onClose} className="text-slate-600 hover:text-slate-400 transition-colors">
            <X size={14} />
          </button>
        </div>

        <div className="max-h-[420px] overflow-y-auto divide-y divide-white/[0.04]">
          {notifications.map(n => {
            const cfg = notifIcon[n.type]
            const Icon = cfg.icon
            return (
              <button
                key={n.id}
                onClick={() => { if (n.href) { router.push(n.href); onClose() } }}
                className={`w-full flex gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.02] ${
                  !n.read ? 'bg-white/[0.01]' : ''
                }`}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${cfg.cls}`}>
                  <Icon size={13} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-[0.78rem] font-medium ${!n.read ? 'text-slate-200' : 'text-slate-400'}`}>
                      {n.title}
                    </span>
                    {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 flex-shrink-0" />}
                  </div>
                  <p className="text-[0.7rem] text-slate-500 leading-relaxed mt-0.5">{n.message}</p>
                  <span className="text-[0.6rem] text-slate-600 mt-1 block">{n.time}</span>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>,
    document.body
  )
}

// ═══ Header ═══
export default function Header({ title, breadcrumbs }: { title?: string; breadcrumbs?: Breadcrumb[] }) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [notifsOpen, setNotifsOpen] = useState(false)

  const unreadCount = notifications.filter(n => !n.read).length

  // ⌘K keyboard shortcut
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(o => !o)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  return (
    <>
      <header className="px-6 h-14 border-b border-white/[0.06] flex items-center justify-between flex-shrink-0 bg-surface-1/80 backdrop-blur-md">
        <div className="flex items-center gap-2">
          {breadcrumbs ? (
            <div className="flex items-center gap-1.5 text-[0.85rem] text-slate-400">
              {breadcrumbs.map((b, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  {i > 0 && <ChevronRight size={12} className="text-slate-600" />}
                  {b.href ? (
                    <Link href={b.href} className="hover:text-cyan-400 transition-colors">{b.label}</Link>
                  ) : (
                    <span className="text-slate-200 font-medium">{b.label}</span>
                  )}
                </span>
              ))}
            </div>
          ) : (
            <h1 className="text-[0.95rem] font-semibold text-slate-200">{title}</h1>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            id="tour-search"
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05] text-slate-500 text-[0.78rem] cursor-pointer min-w-[200px] hover:border-white/[0.1] transition-colors text-left"
          >
            <Search size={13} className="opacity-50" />
            <span>Search...</span>
            <kbd className="ml-auto font-mono text-[0.58rem] px-1.5 py-0.5 rounded-md bg-white/[0.04] text-slate-600 border border-white/[0.06]">{'\u2318'}K</kbd>
          </button>
          <div className="relative">
            <button
              onClick={() => setNotifsOpen(o => !o)}
              className="relative cursor-pointer text-slate-500 hover:text-slate-300 p-1.5 rounded-lg hover:bg-white/[0.04] transition-all"
            >
              <Bell size={17} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-gradient-to-br from-red-400 to-rose-500 text-white text-[0.5rem] font-bold flex items-center justify-center shadow-lg shadow-red-500/30">
                  {unreadCount}
                </span>
              )}
            </button>
            <NotificationsPanel isOpen={notifsOpen} onClose={() => setNotifsOpen(false)} />
          </div>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-[0.62rem] font-bold text-white cursor-pointer shadow-md shadow-cyan-500/20 hover:shadow-lg hover:shadow-cyan-500/30 transition-shadow">
            JD
          </div>
        </div>
      </header>
      <SearchPalette isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  )
}
