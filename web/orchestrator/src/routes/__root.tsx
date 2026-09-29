import { createRootRoute, Outlet } from '@tanstack/react-router'

const RootLayout = () => (
  <div className="min-h-screen bg-ink font-sans text-fg antialiased">
    <Outlet />
  </div>
)

export const Route = createRootRoute({
  component: RootLayout,
})
