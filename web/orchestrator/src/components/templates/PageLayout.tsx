import type { ReactNode } from 'react'
import { AppNav } from '../molecules/AppNav'

type PageLayoutProps = {
  readonly title: string
  readonly subtitle: string
  readonly current: 'status' | 'usage' | 'skills' | 'workflows'
  readonly actions?: ReactNode
  readonly children: ReactNode
}

export const PageLayout = ({ title, subtitle, current, actions, children }: PageLayoutProps) => (
  <main className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-12">
    <header className="flex flex-col gap-4">
      <AppNav current={current} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-medium tracking-tight text-fg">{title}</h1>
          <p className="text-sm text-muted">{subtitle}</p>
        </div>
        {actions}
      </div>
    </header>
    <div className="flex flex-col gap-8">{children}</div>
  </main>
)
