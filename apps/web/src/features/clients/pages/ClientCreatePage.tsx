import { PageHeader } from '@/components/layout/AppShell'
import { ClientForm } from '@/features/clients/components/ClientForm'

// A contact + an optional first requirement. The SAME form the edit page
// renders (via <ClientForm>), so create and edit can never drift.
export default function ClientCreatePage() {
  return (
    <>
      <PageHeader title="New client" description="Capture a contact and, optionally, what they're looking for." />
      <ClientForm mode="create" />
    </>
  )
}
