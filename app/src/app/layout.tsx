import type { Metadata } from 'next'
import './globals.css'
import { Sidebar } from '@/components/sidebar'
import { Toaster } from 'sonner'

export const metadata: Metadata = {
  title: 'Auto Content Studio',
  description: 'Automated video content creation and publishing platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-slate-50 text-slate-900" style={{ fontFamily: "'Inter', sans-serif" }}>
        <Sidebar />
        <main className="ml-60 min-h-screen p-7">
          {children}
        </main>
        <Toaster
          theme="light"
          position="bottom-right"
          richColors
          toastOptions={{ style: { fontFamily: "'Inter', sans-serif", fontSize: '13px' } }}
        />
      </body>
    </html>
  )
}
