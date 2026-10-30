import { Link, usePage } from '@inertiajs/react'
import type { ReactNode } from 'react'
import { Seo } from '@/client/Seo'

export function Layout({ children }: { children: ReactNode }) {
  const page = usePage<{ appName: string }>()
  const flash = page.flash as { success?: string }
  return (
    <main className="mx-auto grid max-w-2xl gap-3 px-4 py-8">
      <Seo />
      <nav className="flex gap-3">
        <strong>{page.props.appName}</strong>
        <Link href="/">Home</Link>
      </nav>
      {flash.success && <p className="text-spoken">{flash.success}</p>}
      {children}
    </main>
  )
}
