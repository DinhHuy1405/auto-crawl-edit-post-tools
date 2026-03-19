'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, GitBranch, Film, ArrowUpToLine, Archive, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/',         label: 'Dashboard',    icon: LayoutDashboard,   desc: 'Overview & stats' },
  { href: '/workflow', label: 'Workflow',      icon: GitBranch,         desc: 'Run pipeline' },
  { href: '/editor',   label: 'Video Editor', icon: Film,              desc: 'Edit & render' },
  { href: '/upload',   label: 'Upload',       icon: ArrowUpToLine,     desc: 'Platform upload' },
  { href: '/assets',   label: 'Assets',       icon: Archive,           desc: 'Media library' },
  { href: '/settings', label: 'Settings',     icon: SlidersHorizontal, desc: 'Configuration' },
]

export function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-white border-r border-slate-200 flex flex-col z-50">
      {/* Brand */}
      <div className="px-5 pt-6 pb-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-md shadow-blue-200">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7"/>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
            </svg>
          </div>
          <div>
            <p className="text-[13px] font-bold text-slate-900 leading-none">Auto Content</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Studio v1.0</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-3 mb-3">Navigation</p>
        {navItems.map(({ href, label, icon: Icon, desc }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link key={href} href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group',
                active
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              )}
            >
              <div className={cn(
                'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                active ? 'bg-blue-100' : 'bg-slate-100 group-hover:bg-slate-200'
              )}>
                <Icon className={cn('w-[14px] h-[14px]', active ? 'text-blue-600' : 'text-slate-500')} />
              </div>
              <div className="min-w-0">
                <p className={cn('text-[13px] leading-none', active ? 'font-semibold' : 'font-medium')}>{label}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{desc}</p>
              </div>
              {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500" />}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-slate-100">
        <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-slate-50 border border-slate-200">
          <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
          <p className="text-[11px] text-slate-600 font-medium">System Online · localhost:3838</p>
        </div>
      </div>
    </aside>
  )
}
