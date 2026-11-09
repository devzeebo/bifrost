import { Link } from '@tanstack/react-router'

type AppNavProps = {
  readonly current: 'status' | 'usage'
}

export const AppNav = ({ current }: AppNavProps) => (
  <nav className="flex gap-4 text-sm">
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
  </nav>
)
