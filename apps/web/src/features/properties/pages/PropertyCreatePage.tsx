import { PageHeader } from '@/components/layout/AppShell'
import { PropertyForm } from '@/features/properties/components/PropertyForm'

export default function PropertyCreatePage() {
  return (
    <>
      <PageHeader title="New property" description="Create a listing and assign it to an agent." />
      <PropertyForm />
    </>
  )
}
