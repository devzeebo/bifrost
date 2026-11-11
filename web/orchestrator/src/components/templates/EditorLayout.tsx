import type { ReactNode } from 'react'
import { AppNav } from '../molecules/AppNav'

type EditorLayoutProps = {
  readonly title: string
  readonly subtitle: string
  readonly actions?: ReactNode
  readonly children: ReactNode
}

export const EditorLayout = ({ title, subtitle, actions, children }: EditorLayoutProps) => (
  <main className="mx-auto flex h-dvh w-full max-w-[1600px] flex-col gap-4 overflow-hidden px-4 py-4 sm:px-6">
    <header className="flex shrink-0 flex-col gap-3">
      <AppNav current="workflows" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-medium tracking-tight text-fg">{title}</h1>
          <p className="text-sm text-muted">{subtitle}</p>
        </div>
        {actions}
      </div>
    </header>
    <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
  </main>
)
