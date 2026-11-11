import { Link } from '@tanstack/react-router'

type AppNavProps = {
  readonly current: 'status' | 'usage' | 'skills' | 'workflows'
}

export const AppNav = ({ current }: AppNavProps) => (
  <nav className="flex flex-wrap gap-4 text-sm">
    <Link
      to="/"
      className={current === 'status' ? 'text-signal' : 'text-muted hover:text-fg'}
    >
      Status
    </Link>
    <Link
      to="/usage"
      className={current === 'usage' ? 'text-signal' : 'text-muted hover:text-fg'}
    >
      Usage
    </Link>
    <Link
      to="/skills"
      className={current === 'skills' ? 'text-signal' : 'text-muted hover:text-fg'}
    >
      Skills
    </Link>
    <Link
      to="/workflows"
      className={current === 'workflows' ? 'text-signal' : 'text-muted hover:text-fg'}
    >
      Workflows
    </Link>
  </nav>
)
