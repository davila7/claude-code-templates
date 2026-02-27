'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { X, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react'

export type TourStep = {
  target: string            // CSS selector for the element to highlight
  title: string
  content: string
  placement?: 'top' | 'bottom' | 'left' | 'right'
}

type Rect = { top: number; left: number; width: number; height: number }

function getRect(selector: string): Rect | null {
  const el = document.querySelector(selector)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

function Spotlight({ rect }: { rect: Rect }) {
  const pad = 6
  return (
    <div className="fixed inset-0 z-[9998] pointer-events-none" style={{ isolation: 'isolate' }}>
      <svg className="absolute inset-0 w-full h-full">
        <defs>
          <mask id="tour-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <rect
              x={rect.left - pad}
              y={rect.top - pad}
              width={rect.width + pad * 2}
              height={rect.height + pad * 2}
              rx="8"
              fill="black"
            />
          </mask>
        </defs>
        <rect
          x="0" y="0" width="100%" height="100%"
          fill="rgba(2, 6, 23, 0.75)"
          mask="url(#tour-mask)"
        />
      </svg>
      <div
        className="absolute rounded-lg border border-cyan-400/40 shadow-[0_0_20px_rgba(34,211,238,0.15),inset_0_0_20px_rgba(34,211,238,0.05)] transition-all duration-300 animate-pulse-ring"
        style={{
          top: rect.top - pad,
          left: rect.left - pad,
          width: rect.width + pad * 2,
          height: rect.height + pad * 2,
        }}
      />
    </div>
  )
}

function Tooltip({
  step,
  rect,
  current,
  total,
  onNext,
  onPrev,
  onSkip,
}: {
  step: TourStep
  rect: Rect
  current: number
  total: number
  onNext: () => void
  onPrev: () => void
  onSkip: () => void
}) {
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const placement = step.placement || 'bottom'

  useEffect(() => {
    if (!tooltipRef.current) return
    const tw = tooltipRef.current.offsetWidth
    const th = tooltipRef.current.offsetHeight
    const gap = 14

    let top = 0
    let left = 0

    switch (placement) {
      case 'bottom':
        top = rect.top + rect.height + gap
        left = rect.left + rect.width / 2 - tw / 2
        break
      case 'top':
        top = rect.top - th - gap
        left = rect.left + rect.width / 2 - tw / 2
        break
      case 'right':
        top = rect.top + rect.height / 2 - th / 2
        left = rect.left + rect.width + gap
        break
      case 'left':
        top = rect.top + rect.height / 2 - th / 2
        left = rect.left - tw - gap
        break
    }

    left = Math.max(12, Math.min(left, window.innerWidth - tw - 12))
    top = Math.max(12, Math.min(top, window.innerHeight - th - 12))

    setPos({ top, left })
  }, [rect, placement])

  const isLast = current === total - 1

  return (
    <div
      ref={tooltipRef}
      className="fixed z-[9999] w-80 animate-tour-in"
      style={{ top: pos.top, left: pos.left }}
    >
      <div className="glass rounded-xl border border-cyan-400/20 shadow-2xl shadow-cyan-500/10 overflow-hidden">
        <div className="h-0.5 bg-white/[0.04]">
          <div
            className="h-full bg-gradient-to-r from-cyan-400 to-blue-400 transition-all duration-500"
            style={{ width: `${((current + 1) / total) * 100}%` }}
          />
        </div>

        <div className="p-4">
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-[0.88rem] font-semibold text-slate-100">{step.title}</h3>
            <button
              onClick={onSkip}
              className="text-slate-600 hover:text-slate-400 transition-colors p-0.5 -mt-0.5 -mr-0.5"
            >
              <X size={14} />
            </button>
          </div>
          <p className="text-[0.78rem] text-slate-400 leading-relaxed mb-4">{step.content}</p>

          <div className="flex items-center justify-between">
            <span className="text-[0.62rem] font-mono text-slate-600">
              {current + 1} / {total}
            </span>
            <div className="flex items-center gap-2">
              {current > 0 && (
                <button
                  onClick={onPrev}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[0.72rem] font-medium text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] transition-all"
                >
                  <ChevronLeft size={12} /> Back
                </button>
              )}
              <button
                onClick={onNext}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[0.72rem] font-semibold bg-cyan-400/10 text-cyan-400 border border-cyan-400/20 hover:bg-cyan-400/20 hover:shadow-[0_0_12px_rgba(34,211,238,0.15)] transition-all"
              >
                {isLast ? 'Done' : 'Next'} {!isLast && <ChevronRight size={12} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function GuidedTour({
  steps,
  isOpen,
  onComplete,
}: {
  steps: TourStep[]
  isOpen: boolean
  onComplete: () => void
}) {
  const [current, setCurrent] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)

  const updateRect = useCallback(() => {
    if (!isOpen || !steps[current]) return
    const r = getRect(steps[current].target)
    if (r) setRect(r)
  }, [isOpen, current, steps])

  useEffect(() => {
    if (!isOpen) {
      setCurrent(0)
      return
    }
    updateRect()
    window.addEventListener('resize', updateRect)
    window.addEventListener('scroll', updateRect, true)
    return () => {
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('scroll', updateRect, true)
    }
  }, [isOpen, updateRect])

  useEffect(() => {
    if (!isOpen || !steps[current]) return
    const el = document.querySelector(steps[current].target)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      const t = setTimeout(updateRect, 350)
      return () => clearTimeout(t)
    }
  }, [isOpen, current, steps, updateRect])

  const handleNext = () => {
    if (current < steps.length - 1) {
      setCurrent(c => c + 1)
    } else {
      onComplete()
    }
  }
  const handlePrev = () => setCurrent(c => Math.max(0, c - 1))

  if (!isOpen || !rect) return null

  return (
    <>
      <div className="fixed inset-0 z-[9997]" onClick={e => e.stopPropagation()} />
      <Spotlight rect={rect} />
      <Tooltip
        step={steps[current]}
        rect={rect}
        current={current}
        total={steps.length}
        onNext={handleNext}
        onPrev={handlePrev}
        onSkip={onComplete}
      />
    </>
  )
}

export function TourLauncher({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[0.72rem] font-medium bg-cyan-400/8 text-cyan-400/70 border border-cyan-400/10 hover:bg-cyan-400/15 hover:text-cyan-400 hover:border-cyan-400/25 hover:shadow-[0_0_16px_rgba(34,211,238,0.1)] transition-all"
      title="Take a guided tour"
    >
      <Sparkles size={13} />
      Tour
    </button>
  )
}
