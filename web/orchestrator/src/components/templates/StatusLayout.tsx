import type { ReactNode } from 'react'

type StatusLayoutProps = {
  readonly children: ReactNode
}

export const StatusLayout = ({ children }: StatusLayoutProps) => (
  <main className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-12">
    <header className="flex flex-col gap-2">
      <h1 className="text-3xl font-medium tracking-tight text-fg">Cluster status</h1>
      <p className="text-sm text-muted">Refreshes every 2 seconds.</p>
    </header>
    <div className="flex flex-col gap-8">{children}</div>
  </main>
)
