import type { Metadata } from 'next'
import { DM_Sans, JetBrains_Mono, Syne } from 'next/font/google'
import Sidebar from '@/components/Sidebar'
import TourProvider from '@/components/TourProvider'
import './globals.css'

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans' })
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains' })
const syne = Syne({ subsets: ['latin'], variable: '--font-syne', weight: '800' })

export const metadata: Metadata = {
  title: 'Prototype',
  description: 'Interactive Prototype',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${jetbrains.variable} ${syne.variable}`}>
      <body className="font-sans bg-surface-2 text-slate-200 h-screen overflow-hidden">
        <div className="grid grid-cols-[240px_1fr] h-screen">
          <Sidebar />
          <div className="flex flex-col overflow-hidden min-w-0 bg-mesh">
            {children}
            <TourProvider />
          </div>
        </div>
      </body>
    </html>
  )
}
