'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import GuidedTour, { TourLauncher, type TourStep } from './GuidedTour'

const TOUR_STORAGE_KEY = 'prototype-tour-completed'

// Customize these tour steps for your prototype
const dashboardSteps: TourStep[] = [
  {
    target: '#tour-nav-dashboard',
    title: 'Dashboard',
    content: 'Your command center. Monitor KPIs and activity at a glance.',
    placement: 'right',
  },
  {
    target: '#tour-kpis',
    title: 'Key Metrics',
    content: 'Track your most important metrics in real-time with trend indicators.',
    placement: 'bottom',
  },
  {
    target: '#tour-search',
    title: 'Global Search',
    content: 'Quickly find items across the application. Use the keyboard shortcut \u2318K for instant access.',
    placement: 'bottom',
  },
]

export default function TourProvider() {
  const pathname = usePathname()
  const [tourOpen, setTourOpen] = useState(false)
  const [showLauncher, setShowLauncher] = useState(false)

  useEffect(() => {
    if (pathname !== '/') {
      setShowLauncher(false)
      setTourOpen(false)
      return
    }

    const completed = localStorage.getItem(TOUR_STORAGE_KEY)
    if (!completed) {
      const t = setTimeout(() => setTourOpen(true), 800)
      return () => clearTimeout(t)
    }
    setShowLauncher(true)
  }, [pathname])

  const handleComplete = () => {
    setTourOpen(false)
    localStorage.setItem(TOUR_STORAGE_KEY, 'true')
    setShowLauncher(true)
  }

  if (pathname !== '/') return null

  return (
    <>
      {showLauncher && !tourOpen && (
        <div className="fixed bottom-5 right-5 z-[100] animate-fade-in">
          <TourLauncher onClick={() => setTourOpen(true)} />
        </div>
      )}
      <GuidedTour
        steps={dashboardSteps}
        isOpen={tourOpen}
        onComplete={handleComplete}
      />
    </>
  )
}
