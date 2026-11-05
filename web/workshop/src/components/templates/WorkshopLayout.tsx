import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'

type WorkshopLayoutProps = {
  readonly title: string
  readonly subtitle?: string
  readonly actions?: ReactNode
  readonly children: ReactNode
}

export const WorkshopLayout = ({ title, subtitle, actions, children }: WorkshopLayoutProps) => (
  <main className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-12">
    <header className="flex flex-col gap-4">
      <p className="text-xs tracking-[0.16em] text-muted uppercase">
        <Link to="/" className="text-muted hover:text-fg">
          Workshop
        </Link>
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-medium tracking-tight text-fg">{title}</h1>
          {subtitle ? <p className="text-sm text-muted">{subtitle}</p> : null}
        </div>
        {actions}
      </div>
    </header>
    <div className="flex flex-col gap-8">{children}</div>
  </main>
)
