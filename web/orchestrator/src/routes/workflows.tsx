import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/workflows')({
  component: () => <Outlet />,
})
