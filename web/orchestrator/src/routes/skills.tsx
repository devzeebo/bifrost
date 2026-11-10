import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/skills')({
  component: () => <Outlet />,
})
