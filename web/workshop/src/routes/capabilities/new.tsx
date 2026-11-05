import { useRef } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { createCapability, getCapability } from '../../capabilities/api'
import { CreateCapabilityForm } from '../../components/organisms/CreateCapabilityForm'
import { WorkshopLayout } from '../../components/templates/WorkshopLayout'

const NewCapabilityPage = () => {
  const navigate = useNavigate()
  const pending = useRef<{
    readonly id: string
    readonly name: string
    readonly ask: string
  } | null>(null)

  return (
    <WorkshopLayout
      title="New capability"
      subtitle="Name the capability and describe, in ordinary prose, what the work should do."
    >
      <CreateCapabilityForm
        onSubmit={async ({ name, ask }) => {
          const prior = pending.current
          const id =
            prior && prior.name === name && prior.ask === ask
              ? prior.id
              : crypto.randomUUID()
          pending.current = { id, name, ask }
          try {
            await createCapability({ id, name, ask })
          } catch (error) {
            // A lost response can hide a committed create. Accept it only when the stored values match.
            const stored = await getCapability(id).catch(() => null)
            if (!stored || stored.name !== name.trim() || stored.ask !== ask.trim()) {
              throw error
            }
          }
          await navigate({
            to: '/capabilities/$capabilityId',
            params: { capabilityId: id },
          })
        }}
      />
    </WorkshopLayout>
  )
}

export const Route = createFileRoute('/capabilities/new')({
  component: NewCapabilityPage,
})
