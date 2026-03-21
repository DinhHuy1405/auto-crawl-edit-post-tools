'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, GitBranch, Film, CloudUpload, Archive, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/',         label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/workflow', label: 'Workflow',      icon: GitBranch },
  { href: '/editor',   label: 'Editor',       icon: Film },
  { href: '/upload',   label: 'Uploads',      icon: CloudUpload },
  { href: '/assets',   label: 'Assets',       icon: Archive },
  { href: '/settings', label: 'Settings',     icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-slate-50 border-r border-slate-200/50 flex flex-col z-50">
      {/* Brand */}
      <div className="px-6 py-6 mb-2">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-200">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-blue-700 leading-none tracking-tight">Studio</h1>
            <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-widest font-semibold">v2.4</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link key={href} href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group',
                active
                  ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
              )}
            >
              <Icon className={cn('w-[18px] h-[18px] shrink-0', active ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600')} />
              <span className={cn('text-sm', active ? 'font-semibold' : 'font-medium')}>{label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-5 border-t border-slate-200/50">
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg">
          <div className="w-2 h-2 rounded-full bg-green-500 shrink-0 shadow-sm shadow-green-300" />
          <p className="text-[11px] text-slate-500 font-medium">System Online</p>
          <span className="ml-auto text-[10px] text-slate-300">localhost</span>
        </div>
      </div>
    </aside>
  )
}
