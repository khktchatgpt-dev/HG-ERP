import { authService } from '@/modules/core/auth/auth.service'
import { rbacService } from '@/modules/core/rbac/rbac.service'
import { EmptyState } from '@/components/erp/EmptyState'
import { PeopleList } from '../_components/PeopleList'
import { PersonPassport } from '../_components/PersonPassport'

/** Nhân viên (employee-first): danh sách + hộ chiếu quyền theo `?u=<userId>`. */
export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ u?: string }>
}) {
  const user = (await authService.currentUser())!
  const { u } = await searchParams

  const [people, person] = await Promise.all([
    rbacService.peopleList(user),
    u ? rbacService.person(user, u) : Promise.resolve(null),
  ])
  const roles = person ? (await rbacService.rolesData(user)).roles : []

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <div className={u ? 'hidden lg:block' : 'block'}>
        <PeopleList people={people} selectedId={u} />
      </div>
      <div className={u ? 'block' : 'hidden lg:block'}>
        {person ? (
          <PersonPassport detail={person} roles={roles} />
        ) : (
          <EmptyState
            icon="◐"
            title="Chọn một nhân viên"
            description="Danh sách bên trái."
          />
        )}
      </div>
    </div>
  )
}
