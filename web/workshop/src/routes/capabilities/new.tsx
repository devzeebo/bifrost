import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { createCapability } from '../../capabilities/api'
import { CreateCapabilityForm } from '../../components/organisms/CreateCapabilityForm'
import { WorkshopLayout } from '../../components/templates/WorkshopLayout'

const NewCapabilityPage = () => {
  const navigate = useNavigate()

  return (
    <WorkshopLayout
      title="New capability"
      subtitle="Name the capability and describe, in ordinary prose, what the work should do."
    >
      <CreateCapabilityForm
        onSubmit={async ({ name, ask }) => {
          const id = crypto.randomUUID()
          await createCapability({ id, name, ask })
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
